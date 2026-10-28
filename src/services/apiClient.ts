/**
 * JEBULO - API Client for Cloudflare Workers Backend
 * Handles communication with server-side endpoints, automatically attaching
 * Firebase ID tokens and formatting request payloads.
 */

import { auth } from '../lib/firebase';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function getAuthHeader(): Promise<Record<string, string>> {
  if (!auth.currentUser) return {};
  try {
    const token = await auth.currentUser.getIdToken();
    return { Authorization: `Bearer ${token}` };
  } catch (err) {
    console.warn('Unable to get Firebase ID token:', err);
    return {};
  }
}

export const apiClient = {
  /**
   * Health check
   */
  async getHealth() {
    const res = await fetch(`${API_BASE}/api/health`);
    return await res.json();
  },

  /**
   * Initialize Chapa Checkout on backend
   */
  async initializeCheckout(params: {
    orderId: string;
    txRef: string;
    productId: string;
    returnUrl?: string;
  }): Promise<{ checkoutUrl: string; mode: 'chapa_redirect' | 'simulator' }> {
    const authHeaders = await getAuthHeader();
    const res = await fetch(`${API_BASE}/api/checkout/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(params),
    });

    const data = (await res.json()) as any;
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to initialize checkout.');
    }
    return data.data;
  },

  /**
   * Verify Payment via server-to-server check
   */
  async verifyPayment(txRef: string): Promise<{ success: boolean; alreadyPaid?: boolean; chapaRef?: string; order?: any }> {
    const authHeaders = await getAuthHeader();
    const res = await fetch(`${API_BASE}/api/payment/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ txRef }),
    });

    const data = (await res.json()) as any;
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Payment verification failed.');
    }
    return data.data;
  },

  /**
   * Request restricted Backblaze B2 upload authorization (11 MiB limit enforced)
   */
  async requestUploadAuthorization(params: {
    productId: string;
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
  }): Promise<{
    uploadUrl: string;
    authorizationToken: string;
    storagePath: string;
    headers: Record<string, string>;
    isSimulated?: boolean;
  }> {
    const authHeaders = await getAuthHeader();
    const res = await fetch(`${API_BASE}/api/products/upload-authorization`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(params),
    });

    const data = (await res.json()) as any;
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Upload authorization denied.');
    }
    return data.data;
  },

  /**
   * Notify server of completed product upload to record metadata
   */
  async completeUpload(params: {
    productId: string;
    fileName: string;
    storagePath: string;
    fileSizeBytes: number;
    mimeType: string;
    fileExtension: string;
  }): Promise<void> {
    const authHeaders = await getAuthHeader();
    const res = await fetch(`${API_BASE}/api/products/upload-complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(params),
    });

    const data = (await res.json()) as any;
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to complete upload registration.');
    }
  },

  /**
   * Request temporary Backblaze B2 download authorization
   */
  async requestDownloadAuthorization(productId: string): Promise<{
    downloadUrl: string;
    fileName: string;
    expiresInSeconds: number;
    isSimulated?: boolean;
  }> {
    const authHeaders = await getAuthHeader();
    const res = await fetch(`${API_BASE}/api/products/download-authorization`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ productId }),
    });

    const data = (await res.json()) as any;
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Download authorization denied.');
    }
    return data.data;
  },

  /**
   * Request Creator Payout with atomic server-side balance deduction
   */
  async requestPayout(params: {
    amountEtb: number;
    payoutMethod: string;
    accountNumber: string;
    accountName: string;
  }): Promise<{ payoutId: string; deductedEtb: number; remainingBalanceEtb: number }> {
    const authHeaders = await getAuthHeader();
    const res = await fetch(`${API_BASE}/api/creator/payout-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(params),
    });

    const data = (await res.json()) as any;
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Payout request failed.');
    }
    return data.data;
  },
};
