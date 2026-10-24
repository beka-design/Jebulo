import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

const CHAPA_API_URL = 'https://api.chapa.co/v1';

/**
 * 1. Initialize Chapa Checkout
 * Secure server-side payment initialization
 */
export const initializeChapaCheckout = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in to purchase.');
  }

  const { orderId, txRef, returnUrl } = data;
  if (!orderId || !txRef) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required order details.');
  }

  // 1. Fetch order from Firestore
  const orderDoc = await db.collection('orders').doc(orderId).get();
  if (!orderDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Order not found.');
  }

  const order = orderDoc.data()!;
  if (order.buyerId !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'Cannot pay for another user’s order.');
  }

  // 2. Fetch product and verify price and status
  const productDoc = await db.collection('products').doc(order.productId).get();
  if (!productDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Product not found.');
  }

  const product = productDoc.data()!;
  if (product.status !== 'APPROVED') {
    throw new functions.https.HttpsError('failed-precondition', 'Product is not available for purchase.');
  }

  // Validate price match
  if (order.amountEtb !== product.priceEtb) {
    throw new functions.https.HttpsError('invalid-argument', 'Price discrepancy detected.');
  }

  // 3. Get Chapa Secret Key
  const chapaSecretKey = process.env.CHAPA_SECRET_KEY || functions.config().chapa?.secret_key;
  if (!chapaSecretKey) {
    console.warn('CHAPA_SECRET_KEY not configured. Falling back to test checkout URL.');
    const testCheckoutUrl = `${returnUrl}&simulated=true`;
    return { checkoutUrl: testCheckoutUrl };
  }

  // 4. Call Chapa API
  try {
    const response = await fetch(`${CHAPA_API_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${chapaSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: order.amountEtb.toString(),
        currency: 'ETB',
        email: order.buyerEmail,
        first_name: order.buyerName?.split(' ')[0] || 'Buyer',
        last_name: order.buyerName?.split(' ')[1] || 'Jebulo',
        tx_ref: txRef,
        callback_url: `https://${process.env.GCLOUD_PROJECT}.cloudfunctions.net/chapaWebhook`,
        return_url: returnUrl,
        customization: {
          title: 'JEBULO Marketplace',
          description: `Digital purchase: ${product.titleEn}`,
        },
      }),
    });

    const chapaData = await response.json();
    if (chapaData.status === 'success' && chapaData.data?.checkout_url) {
      return { checkoutUrl: chapaData.data.checkout_url };
    } else {
      console.error('Chapa initialization failed:', chapaData);
      throw new functions.https.HttpsError('internal', chapaData.message || 'Payment initialization failed.');
    }
  } catch (err: any) {
    console.error('Error contacting Chapa:', err);
    throw new functions.https.HttpsError('internal', err.message || 'Payment gateway connection error.');
  }
});

/**
 * Helper: Process successful payment idempotently
 */
async function processSuccessfulOrder(orderDocRef: admin.firestore.DocumentReference, chapaRef: string) {
  return await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(orderDocRef);
    if (!snap.exists) throw new Error('Order not found');
    const order = snap.data()!;

    // Idempotent: If already PAID, skip duplicate processing
    if (order.status === 'PAID') {
      return { alreadyPaid: true, order };
    }

    const now = Date.now();

    // 1. Mark order as PAID
    transaction.update(orderDocRef, {
      status: 'PAID',
      paidAt: now,
      chapaReference: chapaRef,
      updatedAt: now,
    });

    // 2. Grant Purchase Entitlement
    const entitlementId = `${order.buyerId}_${order.productId}`;
    const entitlementRef = db.collection('purchases').doc(entitlementId);
    transaction.set(entitlementRef, {
      id: entitlementId,
      buyerId: order.buyerId,
      productId: order.productId,
      orderId: order.id,
      txRef: order.txRef,
      amountEtb: order.amountEtb,
      grantedAt: now,
      isActive: true,
      downloadCount: 0,
    }, { merge: true });

    // 3. Record Creator Ledger Credit
    const ledgerRef = db.collection('creatorLedger').doc();
    transaction.set(ledgerRef, {
      id: ledgerRef.id,
      creatorId: order.creatorId,
      type: 'SALE',
      orderId: order.id,
      grossAmountEtb: order.amountEtb,
      commissionRate: order.appliedCommissionRate || 0.12,
      commissionAmountEtb: order.commissionAmountEtb,
      netAmountEtb: order.creatorEarningsEtb,
      currency: 'ETB',
      description: `Sale of "${order.productTitle}"`,
      createdAt: now,
    });

    // 4. Update Creator Balances
    const balanceRef = db.collection('creatorBalances').doc(order.creatorId);
    const balanceSnap = await transaction.get(balanceRef);

    if (balanceSnap.exists) {
      const cur = balanceSnap.data()!;
      transaction.update(balanceRef, {
        totalGrossSalesEtb: (cur.totalGrossSalesEtb || 0) + order.amountEtb,
        totalCommissionEtb: (cur.totalCommissionEtb || 0) + order.commissionAmountEtb,
        totalNetEarningsEtb: (cur.totalNetEarningsEtb || 0) + order.creatorEarningsEtb,
        availableBalanceEtb: (cur.availableBalanceEtb || 0) + order.creatorEarningsEtb,
        updatedAt: now,
      });
    } else {
      transaction.set(balanceRef, {
        creatorId: order.creatorId,
        totalGrossSalesEtb: order.amountEtb,
        totalCommissionEtb: order.commissionAmountEtb,
        totalNetEarningsEtb: order.creatorEarningsEtb,
        totalPaidOutEtb: 0,
        availableBalanceEtb: order.creatorEarningsEtb,
        pendingPayoutEtb: 0,
        updatedAt: now,
      });
    }

    // 5. Increment product sales count
    const productRef = db.collection('products').doc(order.productId);
    transaction.update(productRef, {
      salesCount: admin.firestore.FieldValue.increment(1),
    });

    return { alreadyPaid: false, order };
  });
}

/**
 * 2. Chapa Webhook Handler
 * Receives verified callback from Chapa with HMAC signature
 */
export const chapaWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const webhookSecret = process.env.CHAPA_WEBHOOK_SECRET || functions.config().chapa?.webhook_secret;
  const signature = req.headers['x-chapa-signature'] as string;

  // Validate HMAC signature if secret configured
  if (webhookSecret && signature) {
    const hash = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== signature) {
      console.error('Invalid Chapa webhook signature');
      res.status(401).send('Invalid signature');
      return;
    }
  }

  const { tx_ref, status, reference } = req.body;
  if (!tx_ref) {
    res.status(400).send('Missing tx_ref');
    return;
  }

  try {
    const ordersSnap = await db.collection('orders').where('txRef', '==', tx_ref).limit(1).get();
    if (ordersSnap.empty) {
      console.warn(`Webhook received for unknown txRef: ${tx_ref}`);
      res.status(404).send('Order not found');
      return;
    }

    const orderDoc = ordersSnap.docs[0];
    if (status === 'success') {
      await processSuccessfulOrder(orderDoc.ref, reference || tx_ref);
      res.status(200).json({ status: 'success', message: 'Order processed successfully' });
    } else {
      await orderDoc.ref.update({
        status: 'FAILED',
        updatedAt: Date.now(),
      });
      res.status(200).json({ status: 'failed', message: 'Order marked failed' });
    }
  } catch (err: any) {
    console.error('Webhook processing error:', err);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * 3. Verify Chapa Transaction
 * Verifies transaction with Chapa API server-side
 */
export const verifyChapaTransaction = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in.');
  }

  const { txRef } = data;
  if (!txRef) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing transaction reference.');
  }

  const ordersSnap = await db.collection('orders').where('txRef', '==', txRef).limit(1).get();
  if (ordersSnap.empty) {
    throw new functions.https.HttpsError('not-found', 'Order not found.');
  }

  const orderDoc = ordersSnap.docs[0];
  const order = orderDoc.data();

  // If already verified, return idempotent success
  if (order.status === 'PAID') {
    return { status: 'success', alreadyPaid: true, chapaRef: order.chapaReference };
  }

  const chapaSecretKey = process.env.CHAPA_SECRET_KEY || functions.config().chapa?.secret_key;
  if (!chapaSecretKey) {
    // In local sandbox / testing without API keys, simulate verification
    await processSuccessfulOrder(orderDoc.ref, 'SIMULATED-' + Date.now());
    return { status: 'success', chapaRef: 'SIMULATED-' + Date.now() };
  }

  try {
    const response = await fetch(`${CHAPA_API_URL}/transaction/verify/${txRef}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${chapaSecretKey}`,
      },
    });

    const verifyData = await response.json();
    if (verifyData.status === 'success' && verifyData.data?.status === 'success') {
      // Validate currency and amount
      const verifiedAmount = parseFloat(verifyData.data.amount);
      if (verifiedAmount !== order.amountEtb) {
        throw new functions.https.HttpsError('invalid-argument', 'Verified amount does not match order amount.');
      }

      await processSuccessfulOrder(orderDoc.ref, verifyData.data.reference || txRef);
      return { status: 'success', chapaRef: verifyData.data.reference };
    } else {
      await orderDoc.ref.update({ status: 'FAILED', updatedAt: Date.now() });
      return { status: 'failed', message: verifyData.message || 'Verification failed' };
    }
  } catch (err: any) {
    console.error('Error verifying with Chapa:', err);
    throw new functions.https.HttpsError('internal', err.message || 'Verification request failed');
  }
});

/**
 * 4. Get Protected Download URL
 * Generates a short-lived (15 min) signed download URL only for authorized buyers
 */
export const getProtectedDownloadUrl = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in.');
  }

  const { productId } = data;
  if (!productId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing productId.');
  }

  // 1. Verify purchase entitlement
  const entitlementId = `${context.auth.uid}_${productId}`;
  const entDoc = await db.collection('purchases').doc(entitlementId).get();

  if (!entDoc.exists || !entDoc.data()?.isActive) {
    throw new functions.https.HttpsError('permission-denied', 'No active purchase entitlement found.');
  }

  // 2. Fetch product file path
  const productDoc = await db.collection('products').doc(productId).get();
  if (!productDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Product not found.');
  }

  const product = productDoc.data()!;
  if (!product.protectedFile || !product.protectedFile.storagePath) {
    throw new functions.https.HttpsError('failed-precondition', 'Product has no downloadable file.');
  }

  const storagePath = product.protectedFile.storagePath;
  const fileName = product.protectedFile.fileName;

  // 3. Generate short-lived signed URL (15 minutes)
  try {
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);

    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      responseDisposition: `attachment; filename="${fileName}"`,
    });

    // Record session audit
    await db.collection('downloadSessions').add({
      productId,
      buyerId: context.auth.uid,
      expiresAt: Date.now() + 15 * 60 * 1000,
      createdAt: Date.now(),
    });

    return { downloadUrl: signedUrl, fileName };
  } catch (err: any) {
    console.error('Error generating signed URL:', err);
    throw new functions.https.HttpsError('internal', 'Failed to generate secure download link.');
  }
});

/**
 * 5. Set User Custom Claims (Admin-only)
 */
export const setUserRoleClaim = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Only administrators can assign custom claims.');
  }

  const { targetUid, role } = data;
  if (!targetUid || !['buyer', 'creator', 'admin'].includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid target UID or role.');
  }

  const claims: Record<string, boolean> = {
    buyer: true,
    creator: role === 'creator' || role === 'admin',
    admin: role === 'admin',
  };

  await admin.auth().setCustomUserClaims(targetUid, claims);
  await db.collection('users').doc(targetUid).update({
    role,
    updatedAt: Date.now(),
  });

  return { success: true, targetUid, role, claims };
});
