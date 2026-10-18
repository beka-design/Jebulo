import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
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
  CreatorBalance,
  CreatorLedgerEntry,
  PayoutRequest,
} from '../types';

export const creatorService = {
  /**
   * Submit application to sell on GIZAY
   */
  async submitApplication(
    data: Omit<CreatorApplication, 'id' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const colRef = collection(db, 'creatorApplications');
    const docRef = await addDoc(colRef, {
      ...data,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      serverCreatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  /**
   * Get application by user ID
   */
  async getApplicationByUserId(userId: string): Promise<CreatorApplication | null> {
    const q = query(
      collection(db, 'creatorApplications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as CreatorApplication;
  },

  /**
   * Get creator public/private profile
   */
  async getCreatorProfile(userId: string): Promise<CreatorProfile | null> {
    const docRef = doc(db, 'creators', userId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as CreatorProfile;
  },

  /**
   * Get all products belonging to a creator (including DRAFT, PENDING_REVIEW, REJECTED, APPROVED)
   */
  async getCreatorProducts(creatorId: string): Promise<Product[]> {
    const q = query(
      collection(db, 'products'),
      where('creatorId', '==', creatorId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
  },

  /**
   * Save or update product draft
   */
  async saveProduct(
    productData: Partial<Product> & { creatorId: string; titleEn: string; priceEtb: number }
  ): Promise<string> {
    const now = Date.now();
    if (productData.id) {
      const docRef = doc(db, 'products', productData.id);
      const existing = await getDoc(docRef);
      if (existing.exists() && existing.data().creatorId !== productData.creatorId) {
        throw new Error('Unauthorized to modify this product');
      }

      await updateDoc(docRef, {
        ...productData,
        updatedAt: now,
      });
      return productData.id;
    } else {
      const colRef = collection(db, 'products');
      const newProduct = {
        ...productData,
        currency: 'ETB' as const,
        status: 'DRAFT' as ProductStatus,
        salesCount: 0,
        ratingAverage: 0,
        ratingCount: 0,
        viewsCount: 0,
        createdAt: now,
        updatedAt: now,
        serverCreatedAt: serverTimestamp(),
      };
      const docRef = await addDoc(colRef, newProduct);
      return docRef.id;
    }
  },

  /**
   * Submit product for administrator review
   */
  async submitForReview(productId: string, creatorId: string): Promise<void> {
    const docRef = doc(db, 'products', productId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Product not found');
    const data = snap.data();
    if (data.creatorId !== creatorId) throw new Error('Unauthorized');
    
    // Validate minimal requirements before submission
    if (!data.titleEn || !data.priceEtb || !data.coverImageUrl) {
      throw new Error('Please ensure title, price, and cover image are provided before submitting for review.');
    }

    await updateDoc(docRef, {
      status: 'PENDING_REVIEW' as ProductStatus,
      updatedAt: Date.now(),
    });
  },

  /**
   * Financial: Fetch creator balance summary
   */
  async getCreatorBalance(creatorId: string): Promise<CreatorBalance> {
    const docRef = doc(db, 'creatorBalances', creatorId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as CreatorBalance;
    }
    // Return empty balance summary
    return {
      creatorId,
      totalGrossSalesEtb: 0,
      totalCommissionEtb: 0,
      totalNetEarningsEtb: 0,
      totalPaidOutEtb: 0,
      availableBalanceEtb: 0,
      pendingPayoutEtb: 0,
      updatedAt: Date.now(),
    };
  },

  /**
   * Financial: Fetch creator auditable ledger
   */
  async getCreatorLedger(creatorId: string): Promise<CreatorLedgerEntry[]> {
    const q = query(
      collection(db, 'creatorLedger'),
      where('creatorId', '==', creatorId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CreatorLedgerEntry));
  },

  /**
   * Payouts: Request payout
   */
  async requestPayout(params: {
    creatorId: string;
    creatorName: string;
    creatorEmail: string;
    amountEtb: number;
    payoutMethod: 'telebirr' | 'cbe' | 'awash' | 'bank_transfer';
    payoutAccountName: string;
    payoutAccountNumber: string;
  }): Promise<string> {
    // Check available balance first
    const balance = await this.getCreatorBalance(params.creatorId);
    if (params.amountEtb <= 0) {
      throw new Error('Invalid payout amount');
    }
    if (params.amountEtb > balance.availableBalanceEtb) {
      throw new Error(`Requested amount exceeds available balance (${balance.availableBalanceEtb} ETB)`);
    }
    if (params.amountEtb < 500) {
      throw new Error('Minimum payout request is 500 ETB');
    }

    const docRef = await addDoc(collection(db, 'payoutRequests'), {
      ...params,
      status: 'REQUESTED',
      requestedAt: Date.now(),
      createdAt: serverTimestamp(),
    });

    // Mark pending payout in creatorBalances
    const balanceRef = doc(db, 'creatorBalances', params.creatorId);
    await updateDoc(balanceRef, {
      availableBalanceEtb: balance.availableBalanceEtb - params.amountEtb,
      pendingPayoutEtb: balance.pendingPayoutEtb + params.amountEtb,
      updatedAt: Date.now(),
    });

    return docRef.id;
  },

  /**
   * Payouts: Get creator payout history
   */
  async getPayoutHistory(creatorId: string): Promise<PayoutRequest[]> {
    const q = query(
      collection(db, 'payoutRequests'),
      where('creatorId', '==', creatorId),
      orderBy('requestedAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PayoutRequest));
  },
};
