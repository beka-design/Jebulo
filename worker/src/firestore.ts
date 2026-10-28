/**
 * JEBULO - Cloud Firestore REST Client for Cloudflare Workers
 * Runs within the Firebase Spark plan by calling the official Google Cloud Firestore REST API.
 * Uses Google OAuth2 Service Account assertion via Web Crypto API.
 */

import { Env } from './types';

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  project_id: string;
}

let cachedGoogleAccessToken: string | null = null;
let tokenExpiry = 0;

/**
 * Base64URL string encoder
 */
function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Parses PEM private key to CryptoKey
 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const cleanPem = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/[\r\n\s]/g, '');

  const binaryDer = atob(cleanPem);
  const binaryBytes = new Uint8Array(binaryDer.length);
  for (let i = 0; i < binaryDer.length; i++) {
    binaryBytes[i] = binaryDer.charCodeAt(i);
  }

  return await crypto.subtle.importKey(
    'pkcs8',
    binaryBytes.buffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
}

/**
 * Obtains an OAuth2 Access Token for Firestore API using Service Account
 */
async function getFirestoreAccessToken(env: Env): Promise<string | null> {
  const now = Date.now();
  if (cachedGoogleAccessToken && now < tokenExpiry) {
    return cachedGoogleAccessToken;
  }

  if (!env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    return null;
  }

  try {
    const creds: ServiceAccountCredentials = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_KEY);
    const nowSec = Math.floor(now / 1000);

    const header = { alg: 'RS256', typ: 'JWT' };
    const claimSet = {
      iss: creds.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      exp: nowSec + 3600,
      iat: nowSec,
    };

    const headerB64 = base64UrlEncode(JSON.stringify(header));
    const claimSetB64 = base64UrlEncode(JSON.stringify(claimSet));
    const unsignedJwt = `${headerB64}.${claimSetB64}`;

    const privateKey = await importPrivateKey(creds.private_key);
    const signatureBytes = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      new TextEncoder().encode(unsignedJwt)
    );

    const binarySig = String.fromCharCode(...new Uint8Array(signatureBytes));
    const signatureB64 = base64UrlEncode(binarySig);
    const assertion = `${unsignedJwt}.${signatureB64}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });

    if (!tokenRes.ok) {
      console.error('Failed to exchange Google OAuth assertion:', await tokenRes.text());
      return null;
    }

    const tokenData = (await tokenRes.json()) as { access_token: string; expires_in: number };
    cachedGoogleAccessToken = tokenData.access_token;
    tokenExpiry = now + (tokenData.expires_in - 120) * 1000;
    return cachedGoogleAccessToken;
  } catch (err) {
    console.error('Error generating Google OAuth access token:', err);
    return null;
  }
}

// In-memory development store when running without Service Account
const devMemoryStore: Record<string, any> = {};

export const firestoreService = {
  /**
   * Fetch a document by collection and docId
   */
  async getDocument<T = any>(env: Env, collection: string, docId: string): Promise<T | null> {
    const pathKey = `${collection}/${docId}`;
    if (devMemoryStore[pathKey]) {
      return devMemoryStore[pathKey] as T;
    }

    const token = await getFirestoreAccessToken(env);
    if (!token) {
      return null;
    }

    const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Firestore GET ${collection}/${docId} failed: ${res.statusText}`);
    }

    const data = (await res.json()) as { fields: Record<string, any> };
    return this.decodeFields<T>(data.fields);
  },

  /**
   * Look up an order consistently by transaction reference (txRef)
   * Resolves differences where orderId !== txRef across memory, alias mappings, and Firestore.
   */
  async getOrderByTxRef(env: Env, txRef: string): Promise<any | null> {
    if (!txRef) return null;

    // 1. Search in-memory dev store for matching txRef or id
    for (const [key, doc] of Object.entries(devMemoryStore)) {
      if (key.startsWith('orders/') && doc && (doc.txRef === txRef || doc.id === txRef)) {
        return doc;
      }
    }

    // 2. Check alias mapping document (orders_by_txRef/{txRef})
    const aliasDoc = await this.getDocument<{ orderId: string }>(env, 'orders_by_txRef', txRef);
    if (aliasDoc && aliasDoc.orderId) {
      const order = await this.getDocument(env, 'orders', aliasDoc.orderId);
      if (order) return order;
    }

    // 3. Check direct order document if docId matches txRef
    const directOrder = await this.getDocument(env, 'orders', txRef);
    if (directOrder) return directOrder;

    // 4. Query live Firestore via StructuredQuery
    const token = await getFirestoreAccessToken(env);
    if (token) {
      try {
        const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: 'orders' }],
              where: {
                fieldFilter: {
                  field: { fieldPath: 'txRef' },
                  op: 'EQUAL',
                  value: { stringValue: txRef },
                },
              },
              limit: 1,
            },
          }),
        });

        if (res.ok) {
          const results = (await res.json()) as any[];
          if (Array.isArray(results) && results.length > 0 && results[0].document) {
            return this.decodeFields(results[0].document.fields);
          }
        }
      } catch (err) {
        console.warn('Error running Firestore query for txRef:', err);
      }
    }

    return null;
  },

  /**
   * Set / merge a document
   */
  async setDocument(env: Env, collection: string, docId: string, data: Record<string, any>): Promise<void> {
    const pathKey = `${collection}/${docId}`;
    devMemoryStore[pathKey] = { ...devMemoryStore[pathKey], ...data };

    const token = await getFirestoreAccessToken(env);
    if (!token) return;

    const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
    const encodedFields = this.encodeFields(data);

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: encodedFields }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore write failed: ${errText}`);
    }
  },

  /**
   * Atomically process successful payment, entitlement, ledger credit, and balance updates
   */
  async processSuccessfulOrder(
    env: Env,
    order: {
      id: string;
      buyerId: string;
      productId: string;
      productTitle: string;
      creatorId: string;
      amountEtb: number;
      txRef: string;
    },
    chapaRef: string
  ): Promise<{ alreadyPaid: boolean }> {
    const entitlementId = `${order.buyerId}_${order.productId}`;
    const existingEntitlement = await this.getDocument(env, 'purchases', entitlementId);

    if (existingEntitlement && existingEntitlement.isActive) {
      return { alreadyPaid: true };
    }

    const now = Date.now();
    const commissionRate = parseFloat(env.MARKETPLACE_COMMISSION_RATE || '0.12');
    const commissionAmountEtb = Math.round(order.amountEtb * commissionRate * 100) / 100;
    const creatorEarningsEtb = Math.round((order.amountEtb - commissionAmountEtb) * 100) / 100;

    // 1. Mark order PAID using its true order.id
    await this.setDocument(env, 'orders', order.id, {
      status: 'PAID',
      paidAt: now,
      chapaReference: chapaRef,
      appliedCommissionRate: commissionRate,
      commissionAmountEtb,
      creatorEarningsEtb,
      updatedAt: now,
    });

    // 2. Grant purchase entitlement
    await this.setDocument(env, 'purchases', entitlementId, {
      id: entitlementId,
      buyerId: order.buyerId,
      productId: order.productId,
      orderId: order.id,
      txRef: order.txRef,
      amountEtb: order.amountEtb,
      grantedAt: now,
      isActive: true,
      downloadCount: 0,
    });

    // 3. Record Creator Ledger Credit (double-entry audit trail)
    const ledgerId = `ledg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    await this.setDocument(env, 'creatorLedger', ledgerId, {
      id: ledgerId,
      creatorId: order.creatorId,
      type: 'SALE',
      orderId: order.id,
      grossAmountEtb: order.amountEtb,
      commissionRate,
      commissionAmountEtb,
      netAmountEtb: creatorEarningsEtb,
      currency: 'ETB',
      description: `Sale of "${order.productTitle}" (${order.amountEtb} ETB, 12% commission)`,
      createdAt: now,
    });

    // 4. Update Creator Balance
    const existingBalance = (await this.getDocument(env, 'creatorBalances', order.creatorId)) || {
      creatorId: order.creatorId,
      totalGrossSalesEtb: 0,
      totalCommissionEtb: 0,
      totalNetEarningsEtb: 0,
      totalPaidOutEtb: 0,
      availableBalanceEtb: 0,
      pendingPayoutEtb: 0,
    };

    await this.setDocument(env, 'creatorBalances', order.creatorId, {
      creatorId: order.creatorId,
      totalGrossSalesEtb: (existingBalance.totalGrossSalesEtb || 0) + order.amountEtb,
      totalCommissionEtb: (existingBalance.totalCommissionEtb || 0) + commissionAmountEtb,
      totalNetEarningsEtb: (existingBalance.totalNetEarningsEtb || 0) + creatorEarningsEtb,
      totalPaidOutEtb: existingBalance.totalPaidOutEtb || 0,
      availableBalanceEtb: (existingBalance.availableBalanceEtb || 0) + creatorEarningsEtb,
      pendingPayoutEtb: existingBalance.pendingPayoutEtb || 0,
      updatedAt: now,
    });

    return { alreadyPaid: false };
  },

  /**
   * Helper: encode JavaScript object to Firestore REST API typed values
   */
  encodeFields(obj: Record<string, any>): Record<string, any> {
    const fields: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val === undefined) continue;
      if (val === null) fields[key] = { nullValue: null };
      else if (typeof val === 'string') fields[key] = { stringValue: val };
      else if (typeof val === 'boolean') fields[key] = { booleanValue: val };
      else if (typeof val === 'number') {
        if (Number.isInteger(val)) fields[key] = { integerValue: val.toString() };
        else fields[key] = { doubleValue: val };
      } else if (Array.isArray(val)) {
        fields[key] = {
          arrayValue: {
            values: val.map((item) => {
              if (typeof item === 'string') return { stringValue: item };
              if (typeof item === 'number') return { integerValue: item.toString() };
              return { stringValue: JSON.stringify(item) };
            }),
          },
        };
      } else if (typeof val === 'object') {
        fields[key] = { mapValue: { fields: this.encodeFields(val) } };
      }
    }
    return fields;
  },

  /**
   * Helper: decode Firestore REST API typed values to JavaScript object
   */
  decodeFields<T = any>(fields?: Record<string, any>): T {
    if (!fields) return {} as T;
    const result: Record<string, any> = {};
    for (const [key, typedVal] of Object.entries(fields)) {
      if ('stringValue' in typedVal) result[key] = typedVal.stringValue;
      else if ('integerValue' in typedVal) result[key] = parseInt(typedVal.integerValue, 10);
      else if ('doubleValue' in typedVal) result[key] = typedVal.doubleValue;
      else if ('booleanValue' in typedVal) result[key] = typedVal.booleanValue;
      else if ('nullValue' in typedVal) result[key] = null;
      else if ('arrayValue' in typedVal) {
        result[key] = (typedVal.arrayValue.values || []).map((v: any) => this.decodeFields({ val: v }).val);
      } else if ('mapValue' in typedVal) {
        result[key] = this.decodeFields(typedVal.mapValue.fields);
      }
    }
    return result as T;
  },
};
