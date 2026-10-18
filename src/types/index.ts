/**
 * GIZAY - Ethiopian Digital Product Marketplace
 * Core Domain Models & Type Definitions
 */

export type UserRole = 'buyer' | 'creator' | 'admin';

export type UserStatus = 'active' | 'suspended' | 'pending_verification';

export type SupportedLanguage = 'en' | 'am';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  status: UserStatus;
  preferredLanguage: SupportedLanguage;
  bio?: string;
  phoneNumber?: string;
  createdAt: number;
  updatedAt: number;
}

export type CreatorApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface CreatorApplication {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  brandName: string;
  portfolioOrWebsiteUrl?: string;
  payoutMethod: 'telebirr' | 'cbe' | 'awash' | 'bank_transfer';
  payoutAccountNumber: string;
  payoutAccountName: string;
  nationalIdOrPassportRef?: string;
  bio: string;
  intendedCategories: string[];
  status: CreatorApplicationStatus;
  adminNotes?: string;
  reviewedBy?: string;
  reviewedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreatorProfile {
  id: string; // matches uid
  userId: string;
  brandName: string;
  bio?: string;
  logoUrl?: string;
  bannerUrl?: string;
  payoutMethod: 'telebirr' | 'cbe' | 'awash' | 'bank_transfer';
  payoutAccountNumber: string;
  payoutAccountName: string;
  isVerified: boolean;
  totalProductsCount: number;
  totalSalesCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id: string;
  slug: string;
  nameEn: string;
  nameAm: string;
  descriptionEn?: string;
  descriptionAm?: string;
  iconName?: string;
  sortOrder: number;
  isActive: boolean;
  productCount?: number;
  createdAt: number;
  updatedAt: number;
}

export type ProductStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'ARCHIVED';

export type ProductType =
  | 'ebook'
  | 'course'
  | 'graphic_asset'
  | 'software_code'
  | 'template'
  | 'audio_music'
  | 'video_photo'
  | 'cad_bim'
  | 'other';

export interface ProductFileMetadata {
  fileName: string;
  fileSize: number; // in bytes
  mimeType: string;
  fileExtension: string;
  storagePath: string; // private protected bucket path
  uploadedAt: number;
  checksumSha256?: string;
}

export interface ProductPreviewAsset {
  id: string;
  url: string; // Cloudinary public URL
  thumbnailUrl?: string;
  caption?: string;
  type: 'image' | 'video' | 'audio' | 'pdf_preview';
}

export interface Product {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string;
  categoryId: string;
  categorySlug: string;
  
  titleEn: string;
  titleAm?: string;
  descriptionEn: string;
  descriptionAm?: string;
  
  priceEtb: number; // Stored in ETB as full decimal / integer (e.g. 500 ETB)
  currency: 'ETB';
  
  productType: ProductType;
  tags: string[];
  
  // Public Media
  coverImageUrl: string;
  previewAssets: ProductPreviewAsset[];
  
  // Protected File Metadata (Private download ref; storagePath stripped on public queries)
  protectedFile?: ProductFileMetadata;
  
  // Licensing & delivery
  licenseType: 'personal' | 'commercial' | 'extended';
  licenseTermsEn?: string;
  licenseTermsAm?: string;
  
  status: ProductStatus;
  moderationNotes?: string;
  approvedBy?: string;
  approvedAt?: number;
  
  // Aggregates
  salesCount: number;
  ratingAverage: number;
  ratingCount: number;
  viewsCount: number;
  
  createdAt: number;
  updatedAt: number;
}

export type OrderStatus =
  | 'CREATED'
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface Order {
  id: string; // Internal unique reference
  txRef: string; // Chapa transaction reference (unpredictable, unique)
  buyerId: string;
  buyerEmail: string;
  buyerName: string;
  
  productId: string;
  productTitle: string;
  productCoverImage: string;
  creatorId: string;
  
  amountEtb: number;
  currency: 'ETB';
  
  status: OrderStatus;
  
  chapaCheckoutUrl?: string;
  chapaReference?: string;
  paymentMethod?: string;
  
  // Financial breakdown snapshot (immutable once generated)
  appliedCommissionRate: number; // e.g. 0.12 (12%)
  commissionAmountEtb: number;
  creatorEarningsEtb: number;
  
  paidAt?: number;
  refundedAt?: number;
  refundReason?: string;
  
  createdAt: number;
  updatedAt: number;
}

export interface PurchaseEntitlement {
  id: string;
  buyerId: string;
  productId: string;
  orderId: string;
  txRef: string;
  amountEtb: number;
  grantedAt: number;
  isActive: boolean;
  revokedAt?: number;
  revocationReason?: string;
  downloadCount: number;
  lastDownloadedAt?: number;
}

export interface Review {
  id: string;
  productId: string;
  orderId: string;
  buyerId: string;
  buyerName: string;
  buyerAvatar?: string;
  rating: number; // 1 to 5
  comment: string;
  createdAt: number;
  updatedAt: number;
}

export interface FavoriteItem {
  id: string;
  userId: string;
  productId: string;
  addedAt: number;
}

export type LedgerEntryType =
  | 'SALE'
  | 'COMMISSION_DEDUCTION'
  | 'PAYOUT'
  | 'REFUND_REVERSAL'
  | 'ADMIN_ADJUSTMENT';

export interface CreatorLedgerEntry {
  id: string;
  creatorId: string;
  type: LedgerEntryType;
  orderId?: string;
  payoutRequestId?: string;
  grossAmountEtb: number;
  commissionRate: number;
  commissionAmountEtb: number;
  netAmountEtb: number; // positive for credits, negative for debits (payouts/refunds)
  currency: 'ETB';
  description: string;
  createdAt: number;
}

export interface CreatorBalance {
  creatorId: string;
  totalGrossSalesEtb: number;
  totalCommissionEtb: number;
  totalNetEarningsEtb: number;
  totalPaidOutEtb: number;
  availableBalanceEtb: number;
  pendingPayoutEtb: number;
  updatedAt: number;
}

export type PayoutRequestStatus =
  | 'REQUESTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'PAID'
  | 'REJECTED'
  | 'CANCELLED';

export interface PayoutRequest {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  amountEtb: number;
  payoutMethod: 'telebirr' | 'cbe' | 'awash' | 'bank_transfer';
  payoutAccountName: string;
  payoutAccountNumber: string;
  status: PayoutRequestStatus;
  requestedAt: number;
  reviewedBy?: string;
  reviewedAt?: number;
  adminNotes?: string;
  transactionReference?: string; // CBE reference / Telebirr TX ID
  completedAt?: number;
}

export interface ProductReport {
  id: string;
  productId: string;
  productTitle: string;
  reporterId: string;
  reporterEmail: string;
  reason: 'copyright' | 'misrepresentation' | 'malware_suspicious' | 'inappropriate' | 'other';
  description: string;
  status: 'PENDING' | 'INVESTIGATING' | 'RESOLVED_DISMISSED' | 'RESOLVED_ACTION_TAKEN';
  adminNotes?: string;
  resolvedBy?: string;
  resolvedAt?: number;
  createdAt: number;
}

export interface MarketplaceSettings {
  id: 'general';
  commissionRate: number; // 0.12 default (12%)
  minPayoutAmountEtb: number; // default 500 ETB
  maxUploadSizeBytes: number; // default 250MB
  isMaintenanceMode: boolean;
  allowedFileExtensions: string[];
  contactEmail: string;
  supportPhone?: string;
  updatedAt: number;
  updatedBy?: string;
}

export interface AdminAuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetCollection: string;
  targetDocId: string;
  details: Record<string, unknown>;
  timestamp: number;
}

export interface DownloadSession {
  sessionId: string;
  productId: string;
  buyerId: string;
  downloadUrl: string;
  expiresAt: number; // epoch ms (e.g. 15 minutes)
  createdAt: number;
}
