import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  CreditCard,
  Plus,
  Package,
  ArrowUpRight,
  Send,
  Eye,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  Product,
  ProductStatus,
  ProductType,
  Category,
  CreatorBalance,
  CreatorProfile,
} from '../types';
import { creatorService } from '../services/creatorService';
import { marketplaceService } from '../services/marketplaceService';
import { storageService } from '../services/storageService';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

export const CreatorDashboardPage: React.FC = () => {
  const { currentUser, isCreator } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();

  const [creatorProfile, setCreatorProfile] = useState<CreatorProfile | null>(null);
  const [balance, setBalance] = useState<CreatorBalance | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // New product form
  const [titleEn, setTitleEn] = useState('');
  const [titleAm, setTitleAm] = useState('');
  const [descEn, setDescEn] = useState('');
  const [descAm, setDescAm] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priceEtb, setPriceEtb] = useState('500');
  const [productType, setProductType] = useState<ProductType>('ebook');
  const [licenseType, setLicenseType] = useState<'personal' | 'commercial' | 'extended'>('personal');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [packageFile, setPackageFile] = useState<File | null>(null);

  useEffect(() => {
    if (!currentUser) {
      navigate('/signin?redirect=/creator');
      return;
    }

    if (!isCreator) {
      navigate('/become-seller');
      return;
    }

    async function loadData() {
      if (!currentUser) return;
      try {
        const [profile, bal, prods, cats] = await Promise.all([
          creatorService.getCreatorProfile(currentUser.uid),
          creatorService.getCreatorBalance(currentUser.uid),
          creatorService.getCreatorProducts(currentUser.uid),
          marketplaceService.getCategories(),
        ]);

        setCreatorProfile(profile);
        setBalance(bal);
        setProducts(prods);
        setCategories(cats);
        if (cats.length > 0) setCategoryId(cats[0].id);
      } catch (err) {
        console.error('Error loading creator dashboard:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [currentUser, isCreator, navigate]);

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !creatorProfile || !balance) return;

    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount < 500) {
      alert('Minimum payout request is 500 ETB.');
      return;
    }
    if (amount > balance.availableBalanceEtb) {
      alert('Requested amount exceeds available balance.');
      return;
    }

    setPayoutSubmitting(true);
    try {
      await creatorService.requestPayout({
        creatorId: currentUser.uid,
        creatorName: creatorProfile.brandName,
        creatorEmail: currentUser.email || '',
        amountEtb: amount,
        payoutMethod: creatorProfile.payoutMethod,
        payoutAccountName: creatorProfile.payoutAccountName,
        payoutAccountNumber: creatorProfile.payoutAccountNumber,
      });

      alert('Payout request submitted successfully! The administrator will review and process your transfer.');
      setPayoutModalOpen(false);
      setPayoutAmount('');
      const updatedBal = await creatorService.getCreatorBalance(currentUser.uid);
      setBalance(updatedBal);
    } catch (err: any) {
      alert(`Payout request error: ${err.message}`);
    } finally {
      setPayoutSubmitting(false);
    }
  };

  const handleSaveProduct = async (submitForReview: boolean) => {
    if (!currentUser || !creatorProfile) return;
    if (!titleEn || !priceEtb || !categoryId) {
      alert('Please fill out required title, category, and price.');
      return;
    }
    if (!coverFile) {
      alert('Please select a cover image for your product.');
      return;
    }
    if (!packageFile) {
      alert('Please select the digital product file/package to upload.');
      return;
    }

    setSavingProduct(true);
    setUploadProgress(10);

    try {
      // 1. Upload Cover Image (public)
      const coverUrl = await storageService.uploadPublicAsset(coverFile, (p) => {
        setUploadProgress(10 + Math.round(p * 0.4));
      });

      // 2. Generate temporary product ID
      const selectedCat = categories.find((c) => c.id === categoryId) || categories[0];
      const prodId = `prod-${Date.now()}`;

      // 3. Upload Protected Product File (private)
      const fileMeta = await storageService.uploadProtectedProductFile(
        prodId,
        packageFile,
        (p) => {
          setUploadProgress(50 + Math.round(p * 0.45));
        }
      );

      // 4. Save Product to Firestore
      const newId = await creatorService.saveProduct({
        id: prodId,
        creatorId: currentUser.uid,
        creatorName: creatorProfile.brandName,
        categoryId: selectedCat.id,
        categorySlug: selectedCat.slug,
        titleEn,
        titleAm: titleAm || undefined,
        descriptionEn: descEn,
        descriptionAm: descAm || undefined,
        priceEtb: parseFloat(priceEtb),
        productType,
        coverImageUrl: coverUrl,
        previewAssets: [],
        protectedFile: fileMeta,
        licenseType,
        tags: [productType, selectedCat.slug],
      });

      // 5. Submit for review if requested
      if (submitForReview) {
        await creatorService.submitForReview(newId, currentUser.uid);
      }

      setUploadProgress(100);
      alert(
        submitForReview
          ? 'Product uploaded and submitted for administrator review!'
          : 'Product draft saved successfully.'
      );

      // Reset form & reload
      setProductModalOpen(false);
      setTitleEn('');
      setTitleAm('');
      setDescEn('');
      setDescAm('');
      setCoverFile(null);
      setPackageFile(null);
      const prods = await creatorService.getCreatorProducts(currentUser.uid);
      setProducts(prods);
    } catch (err: any) {
      alert(`Error saving product: ${err.message}`);
    } finally {
      setSavingProduct(false);
      setUploadProgress(null);
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" className="py-32" />;
  }

  const getStatusBadge = (status: ProductStatus) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="brand">{t('creator.productStatus.APPROVED')}</Badge>;
      case 'PENDING_REVIEW':
        return <Badge variant="amber">{t('creator.productStatus.PENDING_REVIEW')}</Badge>;
      case 'REJECTED':
        return <Badge variant="rose">{t('creator.productStatus.REJECTED')}</Badge>;
      case 'SUSPENDED':
        return <Badge variant="rose">{t('creator.productStatus.SUSPENDED')}</Badge>;
      default:
        return <Badge variant="slate">{t('creator.productStatus.DRAFT')}</Badge>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {t('creator.dashboardTitle')}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              88/12 Creator Share
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {creatorProfile?.brandName} &middot; Verified Digital Seller
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setProductModalOpen(true)}
            variant="primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            <span>{t('creator.createNewProduct')}</span>
          </Button>

          <Button
            onClick={() => setPayoutModalOpen(true)}
            variant="secondary"
          >
            <ArrowUpRight className="w-4 h-4 mr-1" />
            <span>{t('creator.requestPayout')}</span>
          </Button>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Available Balance */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-800 to-emerald-950 text-white shadow-xl space-y-2">
          <span className="text-xs uppercase font-bold tracking-wider text-emerald-300">
            {t('creator.availableBalance')}
          </span>
          <div className="text-3xl font-extrabold">
            {(balance?.availableBalanceEtb || 0).toLocaleString()} <span className="text-sm font-normal">ETB</span>
          </div>
          <p className="text-xs text-emerald-200">
            Ready for manual CBE/Telebirr payout
          </p>
        </div>

        {/* Total Net Earnings */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
            {t('creator.netEarnings')}
          </span>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
            {(balance?.totalNetEarningsEtb || 0).toLocaleString()} <span className="text-sm font-normal text-slate-400">ETB</span>
          </div>
          <p className="text-xs text-emerald-600 font-medium">
            88% net of all lifetime sales
          </p>
        </div>

        {/* Platform Commission Deducted */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
            {t('creator.platformCommission')}
          </span>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
            {(balance?.totalCommissionEtb || 0).toLocaleString()} <span className="text-sm font-normal text-slate-400">ETB</span>
          </div>
          <p className="text-xs text-slate-500">
            12% platform fee for delivery & payment
          </p>
        </div>

        {/* Pending Payout */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
            {t('creator.pendingPayout')}
          </span>
          <div className="text-3xl font-extrabold text-amber-600">
            {(balance?.pendingPayoutEtb || 0).toLocaleString()} <span className="text-sm font-normal text-slate-400">ETB</span>
          </div>
          <p className="text-xs text-slate-500">
            In review with administrator
          </p>
        </div>

      </div>

      {/* Creator Products Section */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            <span>{t('creator.myProducts')} ({products.length})</span>
          </h2>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Package className="w-12 h-12 mx-auto text-slate-400 mb-3" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              No products created yet
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-6">
              Start selling by uploading your digital files, courses, guides, or code packages.
            </p>
            <Button onClick={() => setProductModalOpen(true)} variant="primary">
              <Plus className="w-4 h-4 mr-2" />
              <span>{t('creator.createNewProduct')}</span>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 px-4 rounded-l-xl">Product</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Sales</th>
                  <th className="py-3 px-4 rounded-r-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {products.map((prod) => (
                  <tr key={prod.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-4 px-4 flex items-center gap-3">
                      <img
                        src={prod.coverImageUrl || '/placeholder.png'}
                        alt={prod.titleEn}
                        className="w-12 h-12 rounded-xl object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 dark:text-white block truncate max-w-[240px]">
                          {prod.titleEn}
                        </span>
                        <span className="text-xs text-slate-400 capitalize">
                          {prod.productType.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 capitalize">{prod.categorySlug}</td>
                    <td className="py-4 px-4 font-bold text-slate-900 dark:text-white">
                      {prod.priceEtb.toLocaleString()} ETB
                    </td>
                    <td className="py-4 px-4">{getStatusBadge(prod.status)}</td>
                    <td className="py-4 px-4 font-medium">{prod.salesCount || 0}</td>
                    <td className="py-4 px-4">
                      {prod.status === 'APPROVED' ? (
                        <Link
                          to={`/products/${prod.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Live</span>
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">In Moderation</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payout Modal */}
      {payoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              <span>{t('creator.payoutModalTitle')}</span>
            </h3>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Available Balance:</span>
                <span className="font-bold text-emerald-700">
                  {(balance?.availableBalanceEtb || 0).toLocaleString()} ETB
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payout Target:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase">
                  {creatorProfile?.payoutMethod} ({creatorProfile?.payoutAccountNumber})
                </span>
              </div>
            </div>

            <form onSubmit={handleRequestPayout} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  {t('creator.payoutAmount')} *
                </label>
                <input
                  type="number"
                  min="500"
                  max={balance?.availableBalanceEtb || 0}
                  required
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  placeholder="500"
                  className="w-full text-base font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs">
                {t('creator.payoutWarning')}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setPayoutModalOpen(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  isLoading={payoutSubmitting}
                  variant="primary"
                >
                  {t('creator.requestPayout')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Product Modal */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto animate-in fade-in py-12">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 my-auto">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-600" />
              <span>{t('creator.createNewProduct')}</span>
            </h3>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Product Title (English) *
                </label>
                <input
                  type="text"
                  required
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  placeholder="e.g. Ethiopian Commercial Code & Tax Guide 2026"
                  className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Product Title (Amharic - Optional)
                </label>
                <input
                  type="text"
                  value={titleAm}
                  onChange={(e) => setTitleAm(e.target.value)}
                  placeholder="ለምሳሌ፡ የኢትዮጵያ የንግድ ህግ እና የታክስ መመሪያ"
                  className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {language === 'am' ? c.nameAm : c.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Product Type *
                  </label>
                  <select
                    value={productType}
                    onChange={(e: any) => setProductType(e.target.value)}
                    className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3"
                  >
                    <option value="ebook">E-Book / PDF Guide</option>
                    <option value="course">Video Course / Masterclass</option>
                    <option value="graphic_asset">Graphic & Design Asset</option>
                    <option value="software_code">Software & Source Code</option>
                    <option value="template">Document & Business Template</option>
                    <option value="audio_music">Music / Audio Asset</option>
                    <option value="video_photo">Photography / Stock Video</option>
                    <option value="cad_bim">Architecture, CAD & BIM</option>
                    <option value="other">Other Digital Good</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Price in ETB *
                  </label>
                  <input
                    type="number"
                    min="50"
                    required
                    value={priceEtb}
                    onChange={(e) => setPriceEtb(e.target.value)}
                    placeholder="500"
                    className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 font-bold"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    You earn: {Math.round(parseFloat(priceEtb || '0') * 0.88)} ETB (88%)
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    License Type *
                  </label>
                  <select
                    value={licenseType}
                    onChange={(e: any) => setLicenseType(e.target.value)}
                    className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3"
                  >
                    <option value="personal">Personal License</option>
                    <option value="commercial">Commercial License</option>
                    <option value="extended">Extended / Developer License</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Description *
                </label>
                <textarea
                  required
                  rows={3}
                  value={descEn}
                  onChange={(e) => setDescEn(e.target.value)}
                  placeholder="Detailed description of what buyers will receive..."
                  className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3"
                />
              </div>

              {/* Cover File Upload */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  {t('creator.uploadCover')} *
                </label>
                <input
                  type="file"
                  accept="image/*"
                  required
                  onChange={(e) => setCoverFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                />
              </div>

              {/* Paid Digital File Upload */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  {t('creator.uploadFiles')} *
                </label>
                <input
                  type="file"
                  required
                  onChange={(e) => setPackageFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-700 file:text-white hover:file:bg-emerald-800"
                />
                <p className="text-[11px] text-slate-400">
                  Protected storage. Encrypted and accessible only by customers with verified purchases. (Max 250MB)
                </p>
              </div>

              {uploadProgress !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Uploading product package...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="ghost"
                disabled={savingProduct}
                onClick={() => setProductModalOpen(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={savingProduct}
                onClick={() => handleSaveProduct(false)}
              >
                Save Draft
              </Button>
              <Button
                type="button"
                variant="primary"
                isLoading={savingProduct}
                onClick={() => handleSaveProduct(true)}
              >
                <Send className="w-4 h-4 mr-2" />
                <span>Submit for Review</span>
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
