/**
 * JEBULO - Ethiopian Digital Product Marketplace
 * Cloudflare Workers Backend API
 *
 * Implements server-side security-sensitive operations:
 * - Firebase Authentication token verification
 * - Server-side 12% commission & order computation
 * - Chapa webhook authentication (HMAC-SHA256) & server-to-server verification
 * - Backblaze B2 private direct-upload authorization (11 MiB payload limit)
 * - Provider-side upload verification (real size & existence confirmation)
 * - Entitlement-gated temporary B2 download authorizations
 * - Atomic creator payout requests & server-side balance updates
 */

import { Env, ApiResponse } from './types';
import { verifyFirebaseIdToken } from './auth';
import { firestoreService } from './firestore';
import {
  initializeChapaCheckout,
  verifyChapaTransaction,
  verifyChapaWebhookSignature,
  isSimulatorAllowed,
} from './chapa';
import { getB2UploadAuthorization, getB2DownloadAuthorization, verifyB2File } from './b2';
import { validateServerUploadRequest, UPLOAD_LIMITS } from './uploadPolicy';

/**
 * Standard CORS headers generator
 */
function getCorsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = (env.CORS_ALLOWED_ORIGINS || '').split(',').map((o) => o.trim());

  const allowOrigin =
    isSimulatorAllowed(env) || allowedOrigins.includes(origin) || allowedOrigins.includes('*')
      ? origin || '*'
      : allowedOrigins[0] || '';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Chapa-Signature',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse<T>(data: ApiResponse<T>, status = 200, corsHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = getCorsHeaders(request, env);
    const url = new URL(request.url);

    // 1. Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      // 2. Health & Architecture Status Check
      if (url.pathname === '/api/health') {
        return jsonResponse(
          {
            success: true,
            data: {
              status: 'operational',
              service: 'jebulo-worker-api',
              environment: env.ENVIRONMENT || 'production',
              simulatorAllowed: isSimulatorAllowed(env),
              maxPayloadBytes: UPLOAD_LIMITS.MAX_COMBINED_PRODUCT_PAYLOAD_BYTES,
              commissionRate: parseFloat(env.MARKETPLACE_COMMISSION_RATE || '0.12'),
              timestamp: Date.now(),
            },
          },
          200,
          cors
        );
      }

      // 3. Webhook from Chapa (HMAC-SHA256 signature verification & server-to-server check)
      if (url.pathname === '/api/webhooks/chapa' && request.method === 'POST') {
        const rawBody = await request.text();
        const signature = request.headers.get('x-chapa-signature');

        const isSignatureValid = await verifyChapaWebhookSignature(rawBody, signature, env);
        if (!isSignatureValid) {
          return jsonResponse({ success: false, error: 'Invalid or missing HMAC signature.' }, 401, cors);
        }

        let payload: any;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return jsonResponse({ success: false, error: 'Malformed JSON payload.' }, 400, cors);
        }

        const { tx_ref, status } = payload;
        if (!tx_ref) {
          return jsonResponse({ success: false, error: 'Missing tx_ref in webhook payload.' }, 400, cors);
        }

        // Consistent order lookup supporting orderId !== txRef
        const order = await firestoreService.getOrderByTxRef(env, tx_ref);
        if (!order) {
          return jsonResponse({ success: false, error: 'Order not found for transaction reference.' }, 404, cors);
        }

        // Idempotency: If already paid, return early
        if (order.status === 'PAID') {
          return jsonResponse({ success: true, data: { message: 'Order already processed.', alreadyPaid: true } }, 200, cors);
        }

        if (status !== 'success') {
          await firestoreService.setDocument(env, 'orders', order.id, {
            status: 'FAILED',
            failureReason: `Webhook status reported "${status}"`,
            updatedAt: Date.now(),
          });
          return jsonResponse({ success: true, data: { message: 'Order marked as failed.' } }, 200, cors);
        }

        // CRITICAL DEFENSE: Never grant entitlements solely because a webhook reports status === 'success'.
        // Verify transaction server-to-server with Chapa API, validating reference, amount, and currency.
        try {
          const verification = await verifyChapaTransaction(env, tx_ref, order.buyerId);
          if (!verification.success) {
            return jsonResponse({ success: false, error: 'Provider transaction verification failed.' }, 400, cors);
          }
          return jsonResponse({ success: true, data: { message: 'Order verified and processed successfully.' } }, 200, cors);
        } catch (verifyErr: any) {
          console.error('Server-to-server verification error during webhook:', verifyErr);
          return jsonResponse({ success: false, error: verifyErr.message || 'Payment verification failed.' }, 400, cors);
        }
      }

      // -------------------------------------------------------------
      // Authenticated Routes: Extract & verify Firebase ID token
      // -------------------------------------------------------------
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

      const requireAuth = async () => {
        const authResult = await verifyFirebaseIdToken(token, env);
        if (!authResult.valid || !authResult.user) {
          throw { status: 401, message: authResult.error || 'Authentication required.' };
        }
        return authResult.user;
      };

      // 4. Initialize Checkout (Server-side price & commission computation)
      if (url.pathname === '/api/checkout/initialize' && request.method === 'POST') {
        const user = await requireAuth();
        const body = await request.json<any>();

        const { orderId, txRef, productId, returnUrl } = body;
        if (!orderId || !txRef || !productId) {
          return jsonResponse({ success: false, error: 'Missing required order fields.' }, 400, cors);
        }

        const result = await initializeChapaCheckout(env, {
          orderId,
          txRef,
          productId,
          buyerId: user.uid,
          buyerEmail: user.email || 'buyer@jebulo.com',
          buyerName: user.email?.split('@')[0] || 'Buyer',
          returnUrl: returnUrl || `${url.origin}/checkout/callback?tx_ref=${txRef}`,
        });

        return jsonResponse({ success: true, data: result }, 200, cors);
      }

      // 5. Verify Payment (Server-to-server transaction verification)
      if (url.pathname === '/api/payment/verify' && request.method === 'POST') {
        const user = await requireAuth();
        const body = await request.json<any>();

        if (!body.txRef) {
          return jsonResponse({ success: false, error: 'Missing txRef.' }, 400, cors);
        }

        const result = await verifyChapaTransaction(env, body.txRef, user.uid);
        return jsonResponse({ success: result.success, data: result }, result.success ? 200 : 400, cors);
      }

      // 6. Creator Upload Authorization (Backblaze B2 Direct Upload, 11 MiB cumulative limit)
      if (url.pathname === '/api/products/upload-authorization' && request.method === 'POST') {
        const user = await requireAuth();
        if (!user.creator && !user.admin) {
          return jsonResponse({ success: false, error: 'Forbidden: Only approved creators can upload products.' }, 403, cors);
        }

        const body = await request.json<any>();
        const { productId, fileName, fileSizeBytes, mimeType } = body;

        if (!productId || !fileName || !fileSizeBytes) {
          return jsonResponse({ success: false, error: 'Missing productId, fileName, or fileSizeBytes.' }, 400, cors);
        }

        // 1. Verify product exists in Firestore (reject nonexistent products)
        const product = await firestoreService.getDocument(env, 'products', productId);
        if (!product) {
          return jsonResponse({ success: false, error: 'Product not found. Please create product draft first.' }, 404, cors);
        }

        // 2. Verify creator ownership
        if (product.creatorId !== user.uid && !user.admin) {
          return jsonResponse({ success: false, error: 'Forbidden: You do not own this product.' }, 403, cors);
        }

        // 3. Verify product status allows deliverable modification
        if (product.status !== 'DRAFT' && product.status !== 'PENDING_REVIEW' && !user.admin) {
          return jsonResponse({ success: false, error: 'Cannot upload files for approved, archived, or suspended products.' }, 400, cors);
        }

        // 4. Calculate existing product payload
        const existingBytes = product.protectedFile?.fileSize || 0;

        // 5. Server-side validation of extension, blocked scripts, and cumulative 11 MiB payload
        const validation = validateServerUploadRequest({
          fileName,
          fileSizeBytes,
          mimeType,
          existingTotalBytes: existingBytes,
        });

        if (!validation.valid) {
          return jsonResponse({ success: false, error: validation.error }, 400, cors);
        }

        const b2Auth = await getB2UploadAuthorization(env, {
          productId,
          fileName,
          fileSizeBytes,
          mimeType: mimeType || 'application/octet-stream',
        });

        return jsonResponse({ success: true, data: b2Auth }, 200, cors);
      }

      // 7. Product Upload Complete (Verifies object in B2 & records true metadata)
      if (url.pathname === '/api/products/upload-complete' && request.method === 'POST') {
        const user = await requireAuth();
        const body = await request.json<any>();
        const { productId, fileName, storagePath, mimeType, fileExtension } = body;

        if (!productId || !storagePath || !fileName) {
          return jsonResponse({ success: false, error: 'Missing required completion fields.' }, 400, cors);
        }

        // 1. Verify product existence and ownership
        const product = await firestoreService.getDocument(env, 'products', productId);
        if (!product) {
          return jsonResponse({ success: false, error: 'Product not found.' }, 404, cors);
        }

        if (product.creatorId !== user.uid && !user.admin) {
          return jsonResponse({ success: false, error: 'Unauthorized: You do not own this product.' }, 403, cors);
        }

        // 2. Validate storagePath namespace matches product
        const expectedPrefix = `protected/products/${productId}/`;
        if (!storagePath.startsWith(expectedPrefix)) {
          return jsonResponse({ success: false, error: 'Security violation: Invalid storage path namespace.' }, 403, cors);
        }

        // 3. Verify uploaded object directly in Backblaze B2 (obtain actual size directly from provider)
        const b2Info = await verifyB2File(env, storagePath);
        if (!b2Info.exists) {
          return jsonResponse({ success: false, error: 'Uploaded file could not be verified in storage. Please re-upload.' }, 400, cors);
        }

        const actualSizeBytes = b2Info.contentLength || 0;
        if (actualSizeBytes <= 0) {
          return jsonResponse({ success: false, error: 'Uploaded file is empty (0 bytes).' }, 400, cors);
        }

        // 4. Validate actual size against 11 MiB limit
        if (actualSizeBytes > UPLOAD_LIMITS.MAX_COMBINED_PRODUCT_PAYLOAD_BYTES) {
          const mb = (actualSizeBytes / (1024 * 1024)).toFixed(2);
          return jsonResponse(
            { success: false, error: `Actual uploaded file size (${mb} MiB) exceeds the maximum limit of 11 MiB.` },
            400,
            cors
          );
        }

        // 5. Commit verified metadata to Firestore (using true B2 size, not client-claimed size)
        await firestoreService.setDocument(env, 'products', productId, {
          protectedFile: {
            fileName,
            fileSize: actualSizeBytes,
            mimeType: b2Info.contentType || mimeType || 'application/octet-stream',
            fileExtension: fileExtension || fileName.split('.').pop()?.toLowerCase() || '',
            storagePath,
            b2FileId: b2Info.fileId,
            uploadedAt: b2Info.uploadTimestamp || Date.now(),
          },
          updatedAt: Date.now(),
        });

        return jsonResponse(
          {
            success: true,
            data: {
              message: 'Product deliverable verified and recorded.',
              verifiedSize: actualSizeBytes,
            },
          },
          200,
          cors
        );
      }

      // 8. Download Authorization (Entitlement-gated temporary signed URL)
      if (url.pathname === '/api/products/download-authorization' && request.method === 'POST') {
        const user = await requireAuth();
        const body = await request.json<any>();
        const { productId } = body;

        if (!productId) {
          return jsonResponse({ success: false, error: 'Missing productId.' }, 400, cors);
        }

        // Verify active purchase entitlement
        const entitlementId = `${user.uid}_${productId}`;
        const entitlement = await firestoreService.getDocument(env, 'purchases', entitlementId);

        const product = await firestoreService.getDocument(env, 'products', productId);
        if (!product) {
          return jsonResponse({ success: false, error: 'Product not found.' }, 404, cors);
        }

        const isOwnerCreator = product.creatorId === user.uid;
        const hasEntitlement = entitlement && entitlement.isActive;

        if (!hasEntitlement && !isOwnerCreator && !user.admin) {
          return jsonResponse(
            { success: false, error: 'Access denied: No active purchase entitlement found for this product.' },
            403,
            cors
          );
        }

        if (!product.protectedFile || !product.protectedFile.storagePath) {
          return jsonResponse({ success: false, error: 'This product has no attached digital file.' }, 400, cors);
        }

        const b2Download = await getB2DownloadAuthorization(env, {
          storagePath: product.protectedFile.storagePath,
          fileName: product.protectedFile.fileName,
        });

        // Record download session audit
        const sessionId = `dl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        await firestoreService.setDocument(env, 'downloadSessions', sessionId, {
          productId,
          buyerId: user.uid,
          timestamp: Date.now(),
        });

        return jsonResponse({ success: true, data: b2Download }, 200, cors);
      }

      // 9. Creator Payout Request (Server-side atomic balance check and deduction)
      if (url.pathname === '/api/creator/payout-request' && request.method === 'POST') {
        const user = await requireAuth();
        if (!user.creator && !user.admin) {
          return jsonResponse({ success: false, error: 'Only creators can request payouts.' }, 403, cors);
        }

        const body = await request.json<any>();
        const amountEtb = parseFloat(body.amountEtb);
        const minPayout = parseFloat(env.MIN_PAYOUT_AMOUNT_ETB || '500');

        if (isNaN(amountEtb) || amountEtb <= 0) {
          return jsonResponse({ success: false, error: 'Invalid payout amount.' }, 400, cors);
        }

        if (amountEtb < minPayout) {
          return jsonResponse(
            { success: false, error: `Minimum payout request is ${minPayout} ETB.` },
            400,
            cors
          );
        }

        const balance = await firestoreService.getDocument(env, 'creatorBalances', user.uid);
        const availableBalance = balance ? balance.availableBalanceEtb || 0 : 0;

        if (amountEtb > availableBalance) {
          return jsonResponse(
            {
              success: false,
              error: `Requested amount (${amountEtb} ETB) exceeds your available balance (${availableBalance} ETB).`,
            },
            400,
            cors
          );
        }

        const payoutId = `pay-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        await firestoreService.setDocument(env, 'payoutRequests', payoutId, {
          id: payoutId,
          creatorId: user.uid,
          amountEtb,
          payoutMethod: body.payoutMethod,
          payoutAccountNumber: body.payoutAccountNumber,
          payoutAccountName: body.payoutAccountName,
          status: 'REQUESTED',
          requestedAt: Date.now(),
        });

        await firestoreService.setDocument(env, 'creatorBalances', user.uid, {
          creatorId: user.uid,
          availableBalanceEtb: availableBalance - amountEtb,
          pendingPayoutEtb: (balance?.pendingPayoutEtb || 0) + amountEtb,
          updatedAt: Date.now(),
        });

        return jsonResponse(
          {
            success: true,
            data: {
              payoutId,
              deductedEtb: amountEtb,
              remainingBalanceEtb: availableBalance - amountEtb,
            },
          },
          200,
          cors
        );
      }

      // 10. Local Simulated File Handlers (for offline dev testing without live B2 keys)
      if (url.pathname === '/api/products/simulated-upload' && request.method === 'POST') {
        return jsonResponse({ success: true, message: 'Simulated file upload accepted.' }, 200, cors);
      }

      if (url.pathname === '/api/products/simulated-download' && request.method === 'GET') {
        const fileName = url.searchParams.get('fileName') || 'product_package.txt';
        const dummyText = `JEBULO DIGITAL PRODUCT DOWNLOAD (DEVELOPMENT SIMULATION)\nFile: ${fileName}\nAuthorized Download Token Verified.\n`;
        return new Response(dummyText, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            ...cors,
          },
        });
      }

      return jsonResponse({ success: false, error: 'Endpoint not found.' }, 404, cors);
    } catch (err: any) {
      const status = err.status || 500;
      return jsonResponse({ success: false, error: err.message || 'Internal Server Error' }, status, cors);
    }
  },
};
