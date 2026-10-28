/**
 * JEBULO - Payment Service
 * Interacts with Cloudflare Workers backend for secure checkout initialization,
 * transaction verification, and entitlement-gated download authorization.
 *
 * Security Guarantee:
 * - Client NEVER writes directly to `purchases`, `creatorLedger`, or `creatorBalances`.
 * - All financial splits (12% commission, 88% creator net) and entitlements are
 *   verified and committed on the server.
 * - The development simulator is isolated to non-production environments.
 */

import { Order, Product } from '../types';
import { apiClient } from './apiClient';

export interface InitializePaymentResponse {
  orderId: string;
  txRef: string;
  checkoutUrl: string;
  mode: 'chapa_redirect' | 'simulator';
}

export const paymentService = {
  /**
   * Initialize a checkout for a product with Chapa via Cloudflare Worker backend
   */
  async initializeCheckout(params: {
    product: Product;
    buyerId: string;
    buyerEmail: string;
    buyerName: string;
  }): Promise<InitializePaymentResponse> {
    const isDev = import.meta.env.DEV;
    const prefix = isDev ? 'JEBULO-SIM' : 'JEBULO';
    const txRef = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    try {
      // 1. Initialize checkout on trusted backend (server computes 12% commission & creates order)
      const res = await apiClient.initializeCheckout({
        orderId,
        txRef,
        productId: params.product.id,
        returnUrl: `${window.location.origin}/checkout/callback?tx_ref=${txRef}`,
      });

      return {
        orderId,
        txRef,
        checkoutUrl: res.checkoutUrl,
        mode: res.mode,
      };
    } catch (err: any) {
      console.warn('Backend checkout initialization fallback:', err.message);

      // In local development mode without running Worker backend, allow local simulation
      if (import.meta.env.DEV) {
        const testCheckoutUrl = `/checkout/simulator?tx_ref=${txRef}&order_id=${orderId}`;
        return {
          orderId,
          txRef,
          checkoutUrl: testCheckoutUrl,
          mode: 'simulator',
        };
      }

      throw new Error(`Unable to initiate payment: ${err.message}`);
    }
  },

  /**
   * Verify Chapa transaction via server-to-server check.
   * Entitlements are granted exclusively by the server!
   */
  async verifyPayment(txRef: string): Promise<{ success: boolean; order?: Order }> {
    try {
      const res = await apiClient.verifyPayment(txRef);
      return {
        success: res.success,
        order: res.order,
      };
    } catch (err: any) {
      console.warn('Backend payment verification fallback:', err.message);

      // In local development mode with simulator txRef
      if (import.meta.env.DEV && txRef.startsWith('JEBULO-SIM')) {
        return {
          success: true,
          order: {
            id: 'sim-order-' + Date.now(),
            txRef,
            buyerId: 'dev-buyer',
            buyerEmail: 'dev@jebulo.com',
            buyerName: 'Dev Buyer',
            productId: 'demo-prod',
            productTitle: 'Simulated Purchase',
            productCoverImage: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
            creatorId: 'dev-creator',
            amountEtb: 100,
            currency: 'ETB',
            status: 'PAID',
            appliedCommissionRate: 0.12,
            commissionAmountEtb: 12,
            creatorEarningsEtb: 88,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        };
      }

      throw new Error(`Payment verification failed: ${err.message}`);
    }
  },

  /**
   * Request authorized, short-lived download URL for purchased product
   */
  async requestAuthorizedDownload(params: {
    productId: string;
    buyerId: string;
  }): Promise<{ downloadUrl: string; fileName: string }> {
    try {
      const res = await apiClient.requestDownloadAuthorization(params.productId);
      return {
        downloadUrl: res.downloadUrl,
        fileName: res.fileName,
      };
    } catch (err: any) {
      console.warn('Backend download authorization fallback:', err.message);

      // In development mode: provide dummy simulated download blob
      if (import.meta.env.DEV) {
        const dummyBlob = new Blob([
          `JEBULO DIGITAL PRODUCT DOWNLOAD (LOCAL TEST)\n` +
          `Product ID: ${params.productId}\n` +
          `Buyer ID: ${params.buyerId}\n` +
          `Timestamp: ${new Date().toISOString()}\n\n` +
          `Thank you for supporting Ethiopian creators on JEBULO!\n`
        ], { type: 'text/plain' });

        return {
          downloadUrl: URL.createObjectURL(dummyBlob),
          fileName: `jebulo_product_${params.productId}.txt`,
        };
      }

      throw new Error(`Download authorization denied: ${err.message}`);
    }
  },
};
