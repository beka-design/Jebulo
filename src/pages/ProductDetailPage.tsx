import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  DownloadCloud,
  CheckCircle2,
  Star,
  Shield,
  FileCheck,
  AlertTriangle,
  Share2,
  Lock,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Product, Review } from '../types';
import { marketplaceService } from '../services/marketplaceService';
import { paymentService } from '../services/paymentService';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

export const ProductDetailPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const { currentUser } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState<'copyright' | 'misrepresentation' | 'malware_suspicious' | 'inappropriate' | 'other'>('copyright');
  const [reportDesc, setReportDesc] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadProduct() {
      if (!productId) return;
      try {
        const prod = await marketplaceService.getProductById(productId);
        if (!prod) {
          setLoading(false);
          return;
        }

        const [revs, purchased] = await Promise.all([
          marketplaceService.getProductReviews(productId),
          currentUser ? marketplaceService.checkPurchaseEntitlement(currentUser.uid, productId) : false,
        ]);

        if (isMounted) {
          setProduct(prod);
          setReviews(revs);
          setHasPurchased(purchased);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading product details:', err);
        if (isMounted) setLoading(false);
      }
    }

    loadProduct();
    return () => {
      isMounted = false;
    };
  }, [productId, currentUser]);

  const handleBuyNow = () => {
    if (!currentUser) {
      navigate(`/signin?redirect=/products/${productId}`);
      return;
    }
    navigate(`/checkout/${productId}`);
  };

  const handleDownload = async () => {
    if (!currentUser || !productId) return;
    setDownloading(true);
    try {
      const res = await paymentService.requestAuthorizedDownload({
        productId,
        buyerId: currentUser.uid,
      });

      // Trigger browser download
      const a = document.createElement('a');
      a.href = res.downloadUrl;
      a.download = res.fileName || 'gizay-digital-package';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Download error: ${err.message || 'Could not download product files'}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !product) return;
    try {
      await marketplaceService.submitReport({
        productId: product.id,
        productTitle: product.titleEn,
        reporterId: currentUser.uid,
        reporterEmail: currentUser.email || '',
        reason: reportReason,
        description: reportDesc,
      });
      setReportSubmitted(true);
      setTimeout(() => {
        setReportModalOpen(false);
        setReportSubmitted(false);
        setReportDesc('');
      }, 2000);
    } catch (err) {
      console.error('Report submission error:', err);
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" className="py-32" />;
  }

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          Product Not Found
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          This product may have been archived or is currently under review.
        </p>
        <Link to="/explore" className="inline-block mt-6">
          <Button variant="primary">Back to Explore</Button>
        </Link>
      </div>
    );
  }

  const title = (language === 'am' && product.titleAm) ? product.titleAm : product.titleEn;
  const description = (language === 'am' && product.descriptionAm) ? product.descriptionAm : product.descriptionEn;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      
      {/* Back button */}
      <Link
        to="/explore"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>{t('common.back')}</span>
      </Link>

      {/* Main Product Showcase Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        
        {/* Left Column: Media & Previews (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="aspect-[16/10] bg-slate-900 rounded-3xl overflow-hidden shadow-md border border-slate-200 dark:border-slate-800">
            <img
              src={product.coverImageUrl || '/placeholder.png'}
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Previews Gallery if available */}
          {product.previewAssets && product.previewAssets.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {t('products.preview')}
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {product.previewAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100"
                  >
                    <img
                      src={asset.url}
                      alt={asset.caption || 'Preview'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Description */}
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {t('products.description')}
            </h2>
            <div className="prose dark:prose-invert max-w-none text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
              {description}
            </div>
          </div>
        </div>

        {/* Right Column: Checkout & Details Box (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-lg space-y-6">
            
            {/* Category & Type badges */}
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {product.categorySlug}
              </span>
              <span className="text-xs text-slate-400 capitalize">
                {product.productType.replace('_', ' ')}
              </span>
            </div>

            {/* Product Title */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">
              {title}
            </h1>

            {/* Creator line */}
            <div className="flex items-center gap-2 pt-1 border-b border-slate-100 dark:border-slate-800 pb-4">
              <span className="text-xs text-slate-500">
                {t('products.by')}{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {product.creatorName}
                </span>
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>

            {/* Price Box */}
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xs text-slate-400 font-semibold uppercase">
                  {t('common.price')}
                </span>
                <div className="text-3xl sm:text-4xl font-extrabold text-emerald-800 dark:text-emerald-400">
                  {product.priceEtb.toLocaleString()}{' '}
                  <span className="text-base font-semibold text-slate-500">ETB</span>
                </div>
              </div>

              {/* Rating */}
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                  <span className="font-extrabold text-base text-slate-800 dark:text-white">
                    {product.ratingAverage > 0 ? product.ratingAverage.toFixed(1) : 'New'}
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  {product.ratingCount} {t('common.reviews')}
                </span>
              </div>
            </div>

            {/* Purchase / Download Button */}
            <div className="space-y-3 pt-2">
              {hasPurchased ? (
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{t('products.alreadyPurchased')}</span>
                  </div>
                  <Button
                    onClick={handleDownload}
                    isLoading={downloading}
                    variant="primary"
                    size="lg"
                    className="w-full"
                  >
                    <DownloadCloud className="w-5 h-5 mr-2" />
                    <span>{t('products.downloadNow')}</span>
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleBuyNow}
                  variant="primary"
                  size="lg"
                  className="w-full py-4 text-lg"
                >
                  <Lock className="w-5 h-5 mr-2" />
                  <span>{t('common.buyNow')} ({product.priceEtb.toLocaleString()} ETB)</span>
                </Button>
              )}
            </div>

            {/* Specifications & Trust checklist */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                  <span>{t('products.license')}</span>
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                  {product.licenseType}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <DownloadCloud className="w-4 h-4 text-amber-500" />
                  <span>Delivery</span>
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Instant Download (ZIP)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-sky-500" />
                  <span>Payment Gateway</span>
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Chapa / Telebirr
                </span>
              </div>
            </div>

            {/* Actions: Report */}
            <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setReportModalOpen(true)}
                className="hover:text-rose-600 transition-colors flex items-center gap-1"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{t('products.reportProduct')}</span>
              </button>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  alert('Product link copied to clipboard!');
                }}
                className="hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Reviews Section */}
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {t('products.customerReviews')} ({reviews.length})
        </h2>

        {reviews.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">
            {t('products.noRatingsYet')}
          </p>
        ) : (
          <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
            {reviews.map((rev) => (
              <div key={rev.id} className="pt-4 first:pt-0 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                      {rev.buyerName}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">
                      Verified Purchase
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < rev.rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-300 dark:text-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {rev.comment}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Report Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              <span>{t('products.reportProduct')}</span>
            </h3>

            {reportSubmitted ? (
              <div className="p-4 rounded-xl bg-emerald-50 text-emerald-800 text-sm font-medium">
                Thank you. Your report has been submitted to marketplace administrators for review.
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reason
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e: any) => setReportReason(e.target.value)}
                    className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5"
                  >
                    <option value="copyright">Copyright Infringement / Intellectual Property</option>
                    <option value="misrepresentation">Misleading Description or Missing Content</option>
                    <option value="malware_suspicious">Suspicious or Harmful File</option>
                    <option value="inappropriate">Inappropriate or Prohibited Content</option>
                    <option value="other">Other Violation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Description & Evidence
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={reportDesc}
                    onChange={(e) => setReportDesc(e.target.value)}
                    placeholder="Provide details about why this product violates GIZAY policies..."
                    className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setReportModalOpen(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" variant="danger">
                    {t('common.submit')}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
