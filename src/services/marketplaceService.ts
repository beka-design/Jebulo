import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Category,
  Product,
  Review,
  FavoriteItem,
  ProductReport,
} from '../types';

// Default initial categories representing a diverse, general-purpose digital marketplace
export const INITIAL_CATEGORIES: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    slug: 'ebooks',
    nameEn: 'E-Books & Publications',
    nameAm: 'ኢ-መጽሐፍት እና መመሪያዎች',
    descriptionEn: 'Digital books, guides, fiction, non-fiction, academic papers, and manuals.',
    descriptionAm: 'የዲጂታል መጽሐፍት፣ መመሪያዎች፣ የምርምር ጽሁፎች እና የአሰራር ማኑዋሎች።',
    iconName: 'BookOpen',
    sortOrder: 1,
    isActive: true,
  },
  {
    slug: 'courses',
    nameEn: 'Courses & Tutorials',
    nameAm: 'የኦንላይን ኮርሶች እና ስልጠናዎች',
    descriptionEn: 'Structured video courses, coding bootcamps, language lessons, and masterclasses.',
    descriptionAm: 'የቪዲዮ ትምህርቶች፣ የኮዲንግ እና የቋንቋ ስልጠናዎች።',
    iconName: 'GraduationCap',
    sortOrder: 2,
    isActive: true,
  },
  {
    slug: 'graphics',
    nameEn: 'Design & Creative Assets',
    nameAm: 'ግራፊክስ እና ዲዛይን',
    descriptionEn: 'Illustrations, fonts, icon packs, branding kits, 3D models, and vectors.',
    descriptionAm: 'ስዕሎች፣ ፎንቶች፣ አይኮኖች፣ የብራንዲንግ ፋይሎች እና ቬክተሮች።',
    iconName: 'Palette',
    sortOrder: 3,
    isActive: true,
  },
  {
    slug: 'software',
    nameEn: 'Software & Developer Tools',
    nameAm: 'ሶፍትዌር እና የኮድ ፋይሎች',
    descriptionEn: 'Source code, web templates, scripts, WordPress plugins, APIs, and mobile apps.',
    descriptionAm: 'የሶፍትዌር ምንጭ ኮድ፣ ስክሪፕቶች፣ ዌብሳይት ቴምፕሌቶች እና የሞባይል አፖች።',
    iconName: 'Code',
    sortOrder: 4,
    isActive: true,
  },
  {
    slug: 'templates',
    nameEn: 'Business & Productivity',
    nameAm: 'የቢዝነስ ቴምፕሌቶች እና ሰነዶች',
    descriptionEn: 'Excel financial models, Notion workspaces, contracts, slide decks, and resumes.',
    descriptionAm: 'የፋይናንስ ኤክሴል ሞዴሎች፣ የውል ሰነዶች፣ የፓወር ፖይንት ቴምፕሌቶች።',
    iconName: 'FileSpreadsheet',
    sortOrder: 5,
    isActive: true,
  },
  {
    slug: 'audio',
    nameEn: 'Music & Audio Assets',
    nameAm: 'ድምጽ እና የሙዚቃ ቅንብሮች',
    descriptionEn: 'Instrumentals, beats, sound effects, voiceovers, podcast themes, and samples.',
    descriptionAm: 'የሙዚቃ ቢቶች፣ የድምጽ ውጤቶች፣ ዜማዎች እና ፖድካስት ኢንትሮዎች።',
    iconName: 'Headphones',
    sortOrder: 6,
    isActive: true,
  },
  {
    slug: 'photo-video',
    nameEn: 'Photography & Video',
    nameAm: 'ፎቶግራፍ እና ቪዲዮዎች',
    descriptionEn: 'Stock photos, LUTs, Premiere presets, video motion templates, and drone footage.',
    descriptionAm: 'ስቶክ ፎቶዎች፣ የቪዲዮ ኤዲቲንግ ፕሪሴቶች እና የእንቅስቃሴ ቪዲዮዎች።',
    iconName: 'Camera',
    sortOrder: 7,
    isActive: true,
  },
  {
    slug: 'cad-bim',
    nameEn: 'Architecture, CAD & 3D',
    nameAm: 'አርክቴክቸር፣ CAD እና 3D ፋይሎች',
    descriptionEn: 'AutoCAD drawings, Revit BIM families, 3ds Max models, and engineering details.',
    descriptionAm: 'የኦቶካድ ዲዛይኖች፣ የሬቪት ሞዴሎች፣ የምህንድስና ስዕሎች እና 3D ፋይሎች።',
    iconName: 'Layers',
    sortOrder: 8,
    isActive: true,
  },
  {
    slug: 'other',
    nameEn: 'Other Digital Goods',
    nameAm: 'ሌሎች ዲጂታል ምርቶች',
    descriptionEn: 'Unique digital collectibles, research datasets, game assets, and specialty files.',
    descriptionAm: 'ልዩ የዲጂታል ስራዎች፣ የጥናት ዳታዎች እና የተለያዩ ፋይሎች።',
    iconName: 'Package',
    sortOrder: 9,
    isActive: true,
  },
];

export const marketplaceService = {
  /**
   * Fetch all active categories dynamically from Firestore
   */
  async getCategories(): Promise<Category[]> {
    try {
      const q = query(
        collection(db, 'categories'),
        where('isActive', '==', true),
        orderBy('sortOrder', 'asc')
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
      }

      // If categories collection is empty in Firestore, return fallback categories
      return INITIAL_CATEGORIES.map((c, i) => ({
        ...c,
        id: `cat-${i + 1}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
    } catch (err) {
      console.warn('Failed to fetch categories from Firestore, using defaults:', err);
      return INITIAL_CATEGORIES.map((c, i) => ({
        ...c,
        id: `cat-${i + 1}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
    }
  },

  /**
   * Seed default categories into Firestore (used on setup or admin init)
   */
  async seedDefaultCategories(): Promise<void> {
    const colRef = collection(db, 'categories');
    for (const cat of INITIAL_CATEGORIES) {
      const docRef = doc(colRef, cat.slug);
      await setDoc(docRef, {
        ...cat,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        serverCreatedAt: serverTimestamp(),
      }, { merge: true });
    }
  },

  /**
   * Get public approved products with filtering and pagination
   */
  async getApprovedProducts(params: {
    categorySlug?: string;
    searchQuery?: string;
    sortBy?: 'newest' | 'price_asc' | 'price_desc' | 'popular';
    limitCount?: number;
    lastDoc?: QueryDocumentSnapshot;
  }): Promise<{ products: Product[]; lastVisible?: QueryDocumentSnapshot }> {
    try {
      let q = query(
        collection(db, 'products'),
        where('status', '==', 'APPROVED')
      );

      if (params.categorySlug && params.categorySlug !== 'all') {
        q = query(q, where('categorySlug', '==', params.categorySlug));
      }

      if (params.sortBy === 'price_asc') {
        q = query(q, orderBy('priceEtb', 'asc'));
      } else if (params.sortBy === 'price_desc') {
        q = query(q, orderBy('priceEtb', 'desc'));
      } else if (params.sortBy === 'popular') {
        q = query(q, orderBy('salesCount', 'desc'));
      } else {
        q = query(q, orderBy('createdAt', 'desc'));
      }

      if (params.lastDoc) {
        q = query(q, startAfter(params.lastDoc));
      }

      q = query(q, limit(params.limitCount || 12));

      const snap = await getDocs(q);
      let products = snap.docs.map((d) => {
        const data = d.data() as Product;
        // Strip private download path for security
        if (data.protectedFile) {
          delete (data.protectedFile as { storagePath?: string }).storagePath;
        }
        return { ...data, id: d.id };
      });

      // In-memory search filter if client searched keyword
      if (params.searchQuery && params.searchQuery.trim().length > 0) {
        const queryLower = params.searchQuery.toLowerCase().trim();
        products = products.filter((p) =>
          p.titleEn.toLowerCase().includes(queryLower) ||
          (p.titleAm && p.titleAm.includes(queryLower)) ||
          p.descriptionEn.toLowerCase().includes(queryLower) ||
          p.creatorName.toLowerCase().includes(queryLower) ||
          (p.tags && p.tags.some((tag) => tag.toLowerCase().includes(queryLower)))
        );
      }

      return {
        products,
        lastVisible: snap.docs[snap.docs.length - 1],
      };
    } catch (err) {
      console.warn('Error fetching approved products from Firestore:', err);
      return { products: [] };
    }
  },

  /**
   * Fetch single product by ID (sanitized)
   */
  async getProductById(productId: string): Promise<Product | null> {
    try {
      const docRef = doc(db, 'products', productId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;

      const data = snap.data() as Product;
      // Never expose storagePath in public view
      if (data.protectedFile) {
        delete (data.protectedFile as { storagePath?: string }).storagePath;
      }
      return { ...data, id: snap.id };
    } catch (err) {
      console.error('Error fetching product by ID:', err);
      return null;
    }
  },

  /**
   * Check if a buyer has purchased a product
   */
  async checkPurchaseEntitlement(buyerId: string, productId: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, 'purchases'),
        where('buyerId', '==', buyerId),
        where('productId', '==', productId),
        where('isActive', '==', true),
        limit(1)
      );
      const snap = await getDocs(q);
      return !snap.empty;
    } catch (err) {
      console.error('Error checking entitlement:', err);
      return false;
    }
  },

  /**
   * Get user's purchased products (Library)
   */
  async getUserPurchases(buyerId: string): Promise<Product[]> {
    try {
      const q = query(
        collection(db, 'purchases'),
        where('buyerId', '==', buyerId),
        where('isActive', '==', true),
        orderBy('grantedAt', 'desc')
      );
      const snap = await getDocs(q);
      const productIds = snap.docs.map((d) => d.data().productId as string);

      if (productIds.length === 0) return [];

      const products: Product[] = [];
      for (const pid of productIds) {
        const prod = await this.getProductById(pid);
        if (prod) products.push(prod);
      }
      return products;
    } catch (err) {
      console.error('Error fetching user purchases:', err);
      return [];
    }
  },

  /**
   * Favorites management
   */
  async toggleFavorite(userId: string, productId: string): Promise<boolean> {
    const favId = `${userId}_${productId}`;
    const favRef = doc(db, 'favorites', favId);
    const snap = await getDoc(favRef);

    if (snap.exists()) {
      // Remove
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(favRef);
      return false;
    } else {
      // Add
      await setDoc(favRef, {
        userId,
        productId,
        addedAt: Date.now(),
      } as FavoriteItem);
      return true;
    }
  },

  async isFavorite(userId: string, productId: string): Promise<boolean> {
    const favId = `${userId}_${productId}`;
    const snap = await getDoc(doc(db, 'favorites', favId));
    return snap.exists();
  },

  async getUserFavorites(userId: string): Promise<Product[]> {
    try {
      const q = query(collection(db, 'favorites'), where('userId', '==', userId));
      const snap = await getDocs(q);
      const products: Product[] = [];
      for (const d of snap.docs) {
        const prod = await this.getProductById(d.data().productId);
        if (prod) products.push(prod);
      }
      return products;
    } catch (err) {
      console.error('Error fetching favorites:', err);
      return [];
    }
  },

  /**
   * Reviews
   */
  async getProductReviews(productId: string): Promise<Review[]> {
    try {
      const q = query(
        collection(db, 'reviews'),
        where('productId', '==', productId),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Review));
    } catch (err) {
      console.warn('Error fetching reviews:', err);
      return [];
    }
  },

  /**
   * Submit product report
   */
  async submitReport(report: Omit<ProductReport, 'id' | 'createdAt' | 'status'>): Promise<void> {
    await addDoc(collection(db, 'reports'), {
      ...report,
      status: 'PENDING',
      createdAt: Date.now(),
    });
  },
};
