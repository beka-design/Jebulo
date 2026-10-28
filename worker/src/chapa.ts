/**
 * JEBULO - Chapa Payment Security Service for Cloudflare Workers
 * Enforces server-side price & commission calculation, HMAC webhook authentication,
 * server-to-server transaction verification, and fail-closed simulator isolation.
 */

import { Env } from './types';
import { firestoreService } from './firestore';

const CHAPA_API_URL = 'https://api.chapa.co/v1';

/**
 * Fail-closed simulator check:
 * The simulator is strictly disabled in production by construction.
 * Missing or unrecognized ENVIRONMENT values fail closed.
 */
export function isSimulatorAllowed(env: Env): boolean {
  if (!env.ENVIRONMENT) return false;
  if (env.ENVIRONMENT === 'production') return false;
  if (env.ENVIRONMENT !== 'development' && env.ENVIRONMENT !== 'test') return false;
  return env.ENABLE_CHAPA_SIMULATOR === 'true';
}

/**
 * Verifies HMAC-SHA256 webhook signature using Web Crypto API.
 * Fails closed if secret or signature is missing.
 */
export async function verifyChapaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  env: Env
): Promise<boolean> {
  const webhookSecret = env.CHAPA_WEBHOOK_SECRET;

  // Fail-closed: Never accept webhooks without configured secret
  if (!webhookSecret) {
    console.error('CHAPA_WEBHOOK_SECRET is not configured. Webhook rejected.');
    return false;
  }

  if (!signatureHeader) {
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const hex = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return hex.toLowerCase() === signatureHeader.toLowerCase();
  } catch (err) {
    console.error('Error verifying HMAC signature:', err);
    return false;
  }
}

/**
 * Initializes a Chapa checkout session on the trusted backend
 */
export async function initializeChapaCheckout(
  env: Env,
  params: {
    orderId: string;
    txRef: string;
    productId: string;
    buyerId: string;
    buyerEmail: string;
    buyerName: string;
    returnUrl: string;
  }
): Promise<{ checkoutUrl: string; mode: 'chapa_redirect' | 'simulator' }> {
  // 1. Fetch product from Firestore to verify price and status on trusted backend
  const product = await firestoreService.getDocument(env, 'products', params.productId);
  if (!product) {
    throw new Error('Product not found.');
  }

  if (product.status !== 'APPROVED') {
    throw new Error('Product is not approved for sale.');
  }

  const commissionRate = parseFloat(env.MARKETPLACE_COMMISSION_RATE || '0.12');
  const priceEtb = product.priceEtb;
  const commissionAmountEtb = Math.round(priceEtb * commissionRate * 100) / 100;
  const creatorEarningsEtb = Math.round((priceEtb - commissionAmountEtb) * 100) / 100;

  const orderData = {
    id: params.orderId,
    txRef: params.txRef,
    buyerId: params.buyerId,
    buyerEmail: params.buyerEmail,
    buyerName: params.buyerName,
    productId: params.productId,
    productTitle: product.titleEn,
    productCoverImage: product.coverImageUrl,
    creatorId: product.creatorId,
    amountEtb: priceEtb,
    currency: 'ETB',
    status: 'PENDING_PAYMENT',
    appliedCommissionRate: commissionRate,
    commissionAmountEtb,
    creatorEarningsEtb,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // 2. Persist order under orderId AND save alias mapping for O(1) lookup by txRef
  await firestoreService.setDocument(env, 'orders', params.orderId, orderData);
  await firestoreService.setDocument(env, 'orders_by_txRef', params.txRef, {
    orderId: params.orderId,
    txRef: params.txRef,
    createdAt: Date.now(),
  });

  const simulatorAllowed = isSimulatorAllowed(env);
  const secretKey = env.CHAPA_SECRET_KEY;

  // 3. Simulator Mode Isolation: only allowed in non-production development environments
  if (simulatorAllowed && (!secretKey || secretKey.startsWith('mock_'))) {
    const simulatorUrl = `/checkout/simulator?tx_ref=${encodeURIComponent(params.txRef)}&order_id=${encodeURIComponent(params.orderId)}`;
    return { checkoutUrl: simulatorUrl, mode: 'simulator' };
  }

  if (!secretKey) {
    throw new Error('CHAPA_SECRET_KEY is missing from environment. Cannot initiate real payment.');
  }

  // 4. Live / Sandbox Call to Chapa API
  const response = await fetch(`${CHAPA_API_URL}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: priceEtb.toString(),
      currency: 'ETB',
      email: params.buyerEmail,
      first_name: params.buyerName.split(' ')[0] || 'Buyer',
      last_name: params.buyerName.split(' ')[1] || 'Jebulo',
      tx_ref: params.txRef,
      return_url: params.returnUrl,
      customization: {
        title: 'JEBULO Marketplace',
        description: `Digital Purchase: ${product.titleEn}`,
      },
    }),
  });

  const chapaData = (await response.json()) as any;
  if (chapaData.status === 'success' && chapaData.data?.checkout_url) {
    return { checkoutUrl: chapaData.data.checkout_url, mode: 'chapa_redirect' };
  }

  throw new Error(`Chapa initialization failed: ${chapaData.message || 'Payment provider error'}`);
}

/**
 * Server-to-server transaction verification with Chapa API.
 * Validates reference, amount, currency, and provider success status.
 */
export async function verifyChapaTransaction(
  env: Env,
  txRef: string,
  userId?: string
): Promise<{ success: boolean; alreadyPaid?: boolean; chapaRef?: string; order?: any }> {
  // 1. Fetch order consistently using txRef resolver (supports orderId !== txRef)
  const order = await firestoreService.getOrderByTxRef(env, txRef);
  if (!order) {
    throw new Error(`Order with reference "${txRef}" not found.`);
  }

  // If userId provided, check authorization (buyer or admin)
  if (userId && order.buyerId !== userId) {
    throw new Error('Unauthorized: You can only verify orders belonging to your account.');
  }

  // Idempotent: If already PAID, return success early without re-crediting
  if (order.status === 'PAID') {
    return { success: true, alreadyPaid: true, chapaRef: order.chapaReference, order };
  }

  const simulatorAllowed = isSimulatorAllowed(env);

  // In development test mode with simulator enabled
  if (simulatorAllowed && (!env.CHAPA_SECRET_KEY || txRef.startsWith('JEBULO-SIM-'))) {
    const simRef = `SIM-${Date.now()}`;
    await firestoreService.processSuccessfulOrder(env, order, simRef);
    return { success: true, chapaRef: simRef, order: { ...order, status: 'PAID' } };
  }

  // In production: Reject any attempt to simulate
  if (txRef.startsWith('JEBULO-SIM-')) {
    throw new Error('Security violation: Simulated transactions are strictly forbidden in production mode.');
  }

  const secretKey = env.CHAPA_SECRET_KEY;
  if (!secretKey) {
    throw new Error('CHAPA_SECRET_KEY missing from environment. Cannot verify transaction.');
  }

  // 2. Query Chapa API server-to-server
  const response = await fetch(`${CHAPA_API_URL}/transaction/verify/${txRef}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });

  const verifyData = (await response.json()) as any;

  if (verifyData.status === 'success' && verifyData.data?.status === 'success') {
    // 3. Strict verification of amount and currency
    const verifiedAmount = parseFloat(verifyData.data.amount);
    if (isNaN(verifiedAmount) || verifiedAmount !== order.amountEtb) {
      await firestoreService.setDocument(env, 'orders', order.id, {
        status: 'FAILED',
        failureReason: `Amount mismatch: expected ${order.amountEtb} ETB, got ${verifyData.data.amount}`,
        updatedAt: Date.now(),
      });
      throw new Error(`Security discrepancy: Verified amount (${verifiedAmount} ETB) does not match order (${order.amountEtb} ETB).`);
    }

    const verifiedCurrency = (verifyData.data.currency || '').toUpperCase();
    if (verifiedCurrency !== (order.currency || 'ETB').toUpperCase()) {
      await firestoreService.setDocument(env, 'orders', order.id, {
        status: 'FAILED',
        failureReason: `Currency mismatch: expected ${order.currency}, got ${verifiedCurrency}`,
        updatedAt: Date.now(),
      });
      throw new Error(`Security discrepancy: Verified currency (${verifiedCurrency}) does not match order (${order.currency}).`);
    }

    const chapaRef = verifyData.data.reference || txRef;
    const res = await firestoreService.processSuccessfulOrder(env, order, chapaRef);
    return { success: true, alreadyPaid: res.alreadyPaid, chapaRef, order: { ...order, status: 'PAID' } };
  }

  await firestoreService.setDocument(env, 'orders', order.id, {
    status: 'FAILED',
    failureReason: verifyData.message || 'Payment provider verification failed',
    updatedAt: Date.now(),
  });

  return { success: false, order: { ...order, status: 'FAILED' } };
}
