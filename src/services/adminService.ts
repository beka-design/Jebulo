import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  CreatorApplication,
  CreatorProfile,
  Product,
  ProductStatus,
  Category,
  Order,
  PayoutRequest,
  ProductReport,
  MarketplaceSettings,
  CreatorBalance,
  AdminAuditLog,
} from '../types';

export const adminService = {
  /**
   * Creator Applications
   */
  async getCreatorApplications(status?: string): Promise<CreatorApplication[]> {
    let q = query(collection(db, 'creatorApplications'), orderBy('createdAt', 'desc'));
    if (status && status !== 'all') {
      q = query(collection(db, 'creatorApplications'), where('status', '==', status), orderBy('createdAt', 'desc'));
    }
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CreatorApplication));
  },

  async approveCreatorApplication(
    app: CreatorApplication,
    adminId: string,
    adminEmail: string
  ): Promise<void> {
    const now = Date.now();

    // 1. Update application status
    await updateDoc(doc(db, 'creatorApplications', app.id), {
      status: 'approved',
      reviewedBy: adminId,
      reviewedAt: now,
      updatedAt: now,
    });

    // 2. Update user role in 'users' collection
    await updateDoc(doc(db, 'users', app.userId), {
      role: 'creator',
      updatedAt: now,
    });

    // 3. Create or update creator profile
    const creatorProfile: CreatorProfile = {
      id: app.userId,
      userId: app.userId,
      brandName: app.brandName,
      bio: app.bio,
      payoutMethod: app.payoutMethod,
      payoutAccountNumber: app.payoutAccountNumber,
      payoutAccountName: app.payoutAccountName,
      isVerified: true,
      totalProductsCount: 0,
      totalSalesCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(db, 'creators', app.userId), {
      ...creatorProfile,
      serverCreatedAt: serverTimestamp(),
    });

    // 4. Initialize creator balance if not existing
    const balanceRef = doc(db, 'creatorBalances', app.userId);
    const balanceSnap = await getDoc(balanceRef);
    if (!balanceSnap.exists()) {
      const initialBalance: CreatorBalance = {
        creatorId: app.userId,
        totalGrossSalesEtb: 0,
        totalCommissionEtb: 0,
        totalNetEarningsEtb: 0,
        totalPaidOutEtb: 0,
        availableBalanceEtb: 0,
        pendingPayoutEtb: 0,
        updatedAt: now,
      };
      await setDoc(balanceRef, initialBalance);
    }

    // 5. Log audit trail
    await this.logAudit({
      adminId,
      adminEmail,
      action: 'APPROVE_CREATOR',
      targetCollection: 'creatorApplications',
      targetDocId: app.id,
      details: { userId: app.userId, brandName: app.brandName },
    });
  },

  async rejectCreatorApplication(
    appId: string,
    adminId: string,
    adminEmail: string,
    adminNotes: string
  ): Promise<void> {
    const now = Date.now();
    await updateDoc(doc(db, 'creatorApplications', appId), {
      status: 'rejected',
      adminNotes,
      reviewedBy: adminId,
      reviewedAt: now,
      updatedAt: now,
    });

    await this.logAudit({
      adminId,
      adminEmail,
      action: 'REJECT_CREATOR',
      targetCollection: 'creatorApplications',
      targetDocId: appId,
      details: { adminNotes },
    });
  },

  /**
   * Product Moderation
   */
  async getProductsForReview(status?: ProductStatus): Promise<Product[]> {
    let q = query(collection(db, 'products'), orderBy('updatedAt', 'desc'));
    if (status) {
      q = query(collection(db, 'products'), where('status', '==', status), orderBy('updatedAt', 'desc'));
    }
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
  },

  async updateProductStatus(params: {
    productId: string;
    newStatus: ProductStatus;
    adminId: string;
    adminEmail: string;
    moderationNotes?: string;
  }): Promise<void> {
    const now = Date.now();
    const updateData: Record<string, any> = {
      status: params.newStatus,
      moderationNotes: params.moderationNotes || null,
      updatedAt: now,
    };

    if (params.newStatus === 'APPROVED') {
      updateData.approvedBy = params.adminId;
      updateData.approvedAt = now;
    }

    await updateDoc(doc(db, 'products', params.productId), updateData as any);

    await this.logAudit({
      adminId: params.adminId,
      adminEmail: params.adminEmail,
      action: `PRODUCT_STATUS_${params.newStatus}`,
      targetCollection: 'products',
      targetDocId: params.productId,
      details: { newStatus: params.newStatus, moderationNotes: params.moderationNotes },
    });
  },

  /**
   * Category Management (Dynamic Firestore Categories)
   */
  async getAllCategories(): Promise<Category[]> {
    const q = query(collection(db, 'categories'), orderBy('sortOrder', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
  },

  async saveCategory(
    category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<string> {
    const now = Date.now();
    const slug = category.slug || category.nameEn.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const docId = category.id || slug;

    const dataToSave = {
      ...category,
      id: docId,
      slug,
      updatedAt: now,
    };

    const docRef = doc(db, 'categories', docId);
    await setDoc(docRef, dataToSave, { merge: true });
    return docId;
  },

  async deleteCategory(categoryId: string): Promise<void> {
    await deleteDoc(doc(db, 'categories', categoryId));
  },

  /**
   * Orders & Transactions
   */
  async getRecentOrders(): Promise<Order[]> {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
  },

  /**
   * Payout Management (Manual Payout Workflow)
   */
  async getPayoutRequests(status?: string): Promise<PayoutRequest[]> {
    let q = query(collection(db, 'payoutRequests'), orderBy('requestedAt', 'desc'));
    if (status && status !== 'all') {
      q = query(collection(db, 'payoutRequests'), where('status', '==', status), orderBy('requestedAt', 'desc'));
    }
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PayoutRequest));
  },

  async markPayoutPaid(params: {
    payoutId: string;
    creatorId: string;
    amountEtb: number;
    transactionReference: string;
    adminId: string;
    adminEmail: string;
    adminNotes?: string;
  }): Promise<void> {
    const now = Date.now();

    // 1. Update payout request status to PAID
    await updateDoc(doc(db, 'payoutRequests', params.payoutId), {
      status: 'PAID',
      transactionReference: params.transactionReference,
      completedAt: now,
      reviewedBy: params.adminId,
      reviewedAt: now,
      adminNotes: params.adminNotes || 'Confirmed manual transfer',
    });

    // 2. Record payout debit in creatorLedger
    await addDoc(collection(db, 'creatorLedger'), {
      creatorId: params.creatorId,
      type: 'PAYOUT',
      payoutRequestId: params.payoutId,
      grossAmountEtb: params.amountEtb,
      commissionRate: 0,
      commissionAmountEtb: 0,
      netAmountEtb: -params.amountEtb, // debit
      currency: 'ETB',
      description: `Manual payout sent via ${params.transactionReference}`,
      createdAt: now,
    });

    // 3. Update creator balance summary
    const balanceRef = doc(db, 'creatorBalances', params.creatorId);
    const balanceSnap = await getDoc(balanceRef);
    if (balanceSnap.exists()) {
      const cur = balanceSnap.data() as CreatorBalance;
      await updateDoc(balanceRef, {
        pendingPayoutEtb: Math.max(0, cur.pendingPayoutEtb - params.amountEtb),
        totalPaidOutEtb: (cur.totalPaidOutEtb || 0) + params.amountEtb,
        updatedAt: now,
      });
    }

    // 4. Log audit event
    await this.logAudit({
      adminId: params.adminId,
      adminEmail: params.adminEmail,
      action: 'PAYOUT_COMPLETED',
      targetCollection: 'payoutRequests',
      targetDocId: params.payoutId,
      details: {
        creatorId: params.creatorId,
        amountEtb: params.amountEtb,
        transactionReference: params.transactionReference,
      },
    });
  },

  async rejectPayout(params: {
    payoutId: string;
    creatorId: string;
    amountEtb: number;
    adminId: string;
    adminEmail: string;
    adminNotes: string;
  }): Promise<void> {
    const now = Date.now();

    // 1. Update payout request status to REJECTED
    await updateDoc(doc(db, 'payoutRequests', params.payoutId), {
      status: 'REJECTED',
      reviewedBy: params.adminId,
      reviewedAt: now,
      adminNotes: params.adminNotes,
    });

    // 2. Restore pending funds back to available balance
    const balanceRef = doc(db, 'creatorBalances', params.creatorId);
    const balanceSnap = await getDoc(balanceRef);
    if (balanceSnap.exists()) {
      const cur = balanceSnap.data() as CreatorBalance;
      await updateDoc(balanceRef, {
        pendingPayoutEtb: Math.max(0, cur.pendingPayoutEtb - params.amountEtb),
        availableBalanceEtb: (cur.availableBalanceEtb || 0) + params.amountEtb,
        updatedAt: now,
      });
    }

    // 3. Log audit event
    await this.logAudit({
      adminId: params.adminId,
      adminEmail: params.adminEmail,
      action: 'PAYOUT_REJECTED',
      targetCollection: 'payoutRequests',
      targetDocId: params.payoutId,
      details: { creatorId: params.creatorId, amountEtb: params.amountEtb, reason: params.adminNotes },
    });
  },

  /**
   * Reports
   */
  async getReports(): Promise<ProductReport[]> {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProductReport));
  },

  async resolveReport(reportId: string, actionTaken: 'dismissed' | 'product_suspended'): Promise<void> {
    await updateDoc(doc(db, 'reports', reportId), {
      status: actionTaken === 'dismissed' ? 'RESOLVED_DISMISSED' : 'RESOLVED_ACTION_TAKEN',
      resolvedAt: Date.now(),
    });
  },

  /**
   * Settings (Configurable 12% commission, min payout)
   */
  async getSettings(): Promise<MarketplaceSettings> {
    const docRef = doc(db, 'settings', 'general');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as MarketplaceSettings;
    }
    const defaultSettings: MarketplaceSettings = {
      id: 'general',
      commissionRate: 0.12, // 12% platform commission
      minPayoutAmountEtb: 500,
      maxUploadSizeBytes: 250 * 1024 * 1024, // 250MB
      isMaintenanceMode: false,
      allowedFileExtensions: ['.zip', '.pdf', '.epub', '.mp3', '.mp4', '.json', '.dwg', '.rvt', '.xlsx', '.psd', '.ai', '.fig'],
      contactEmail: 'support@jebulo.com',
      updatedAt: Date.now(),
    };
    await setDoc(docRef, defaultSettings);
    return defaultSettings;
  },

  async updateSettings(settings: Partial<MarketplaceSettings>, adminId: string, adminEmail: string): Promise<void> {
    const docRef = doc(db, 'settings', 'general');
    await updateDoc(docRef, {
      ...settings,
      updatedAt: Date.now(),
      updatedBy: adminId,
    } as any);

    await this.logAudit({
      adminId,
      adminEmail,
      action: 'SETTINGS_UPDATED',
      targetCollection: 'settings',
      targetDocId: 'general',
      details: settings as Record<string, unknown>,
    });
  },

  /**
   * Audit Trail
   */
  async logAudit(log: Omit<AdminAuditLog, 'id' | 'timestamp'>): Promise<void> {
    await addDoc(collection(db, 'adminAuditLogs'), {
      ...log,
      timestamp: Date.now(),
    });
  },

  async getAuditLogs(limitCount = 50): Promise<AdminAuditLog[]> {
    const q = query(collection(db, 'adminAuditLogs'), orderBy('timestamp', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.slice(0, limitCount).map((d) => ({ id: d.id, ...d.data() } as AdminAuditLog));
  },
};
