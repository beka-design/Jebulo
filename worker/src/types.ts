/**
 * JEBULO Cloudflare Worker - TypeScript Type Definitions
 */

export interface Env {
  ENVIRONMENT?: 'development' | 'staging' | 'production' | 'test';
  ENABLE_CHAPA_SIMULATOR?: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_SERVICE_ACCOUNT_KEY?: string; // JSON string
  MARKETPLACE_COMMISSION_RATE?: string;
  MIN_PAYOUT_AMOUNT_ETB?: string;
  MAX_COMBINED_PRODUCT_PAYLOAD_BYTES?: string;
  CORS_ALLOWED_ORIGINS?: string;

  // Backblaze B2 Secrets
  B2_APPLICATION_KEY_ID?: string;
  B2_APPLICATION_KEY?: string;
  B2_BUCKET_ID?: string;
  B2_BUCKET_NAME?: string;
  B2_ENDPOINT?: string; // e.g. https://api.backblazeb2.com or s3.<region>.backblazeb2.com

  // Chapa Secrets
  CHAPA_SECRET_KEY?: string;
  CHAPA_WEBHOOK_SECRET?: string;
}

export interface AuthUser {
  uid: string;
  email?: string;
  role?: 'buyer' | 'creator' | 'admin';
  admin?: boolean;
  creator?: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface InitializeCheckoutRequest {
  orderId: string;
  txRef: string;
  productId: string;
  buyerEmail: string;
  buyerName: string;
  returnUrl: string;
}

export interface VerifyPaymentRequest {
  txRef: string;
}

export interface UploadAuthorizationRequest {
  productId: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
}

export interface UploadCompleteRequest {
  productId: string;
  fileName: string;
  storagePath: string;
  fileSizeBytes: number;
  mimeType: string;
  fileExtension: string;
}

export interface DownloadAuthorizationRequest {
  productId: string;
}

export interface PayoutApiRequest {
  amountEtb: number;
  payoutMethod: string;
  accountNumber: string;
  accountName: string;
}
