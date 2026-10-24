import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, DownloadCloud, FileCheck, ExternalLink, PackageX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Product } from '../types';
import { marketplaceService } from '../services/marketplaceService';
import { paymentService } from '../services/paymentService';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

export const LibraryPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();

  const [purchases, setPurchases] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      navigate('/signin?redirect=/library');
      return;
    }

    async function loadPurchases() {
      if (!currentUser) return;
      try {
        const prods = await marketplaceService.getUserPurchases(currentUser.uid);
        setPurchases(prods);
      } catch (err) {
        console.error('Error fetching purchases:', err);
      } finally {
        setLoading(false);
      }
    }

    loadPurchases();
  }, [currentUser, navigate]);

  const handleDownload = async (productId: string) => {
    if (!currentUser) return;
    setDownloadingId(productId);
    try {
      const res = await paymentService.requestAuthorizedDownload({
        productId,
        buyerId: currentUser.uid,
      });

      const a = document.createElement('a');
      a.href = res.downloadUrl;
      a.download = res.fileName || 'jebulo_digital_product';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Download failed: ${err.message || 'Server error'}`);
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" className="py-32" />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-emerald-700" />
            <span>{t('common.myPurchases')}</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Access and download all your verified digital assets, files, and licenses.
          </p>
        </div>
        <Link to="/explore">
          <Button variant="outline" size="sm">
            Browse More Products
          </Button>
        </Link>
      </div>

      {purchases.length === 0 ? (
        <div className="text-center py-20 px-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <PackageX className="w-12 h-12 mx-auto text-slate-400 mb-3" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
            Your Library is Empty
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-6">
            You haven’t purchased any digital items yet. Explore thousands of resources on JEBULO.
          </p>
          <Link to="/explore">
            <Button variant="primary">
              {t('hero.ctaExplore')}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {purchases.map((product) => {
            const title = (language === 'am' && product.titleAm) ? product.titleAm : product.titleEn;
            const isDownloading = downloadingId === product.id;

            return (
              <div
                key={product.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="relative aspect-[16/10] bg-slate-100 overflow-hidden">
                    <img
                      src={product.coverImageUrl || '/placeholder.png'}
                      alt={title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-emerald-900/80 backdrop-blur-md text-emerald-300 text-[11px] font-semibold flex items-center gap-1">
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>Verified License</span>
                    </div>
                  </div>

                  <div className="p-5 space-y-2">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 capitalize">
                      {product.categorySlug}
                    </span>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white line-clamp-1">
                      {title}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {t('products.by')} {product.creatorName}
                    </p>
                  </div>
                </div>

                <div className="p-5 pt-0 space-y-3">
                  <Button
                    onClick={() => handleDownload(product.id)}
                    isLoading={isDownloading}
                    variant="primary"
                    className="w-full"
                  >
                    <DownloadCloud className="w-4 h-4 mr-2" />
                    <span>{isDownloading ? t('common.downloading') : t('common.download')}</span>
                  </Button>

                  <div className="flex justify-between items-center text-xs text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="capitalize">License: {product.licenseType}</span>
                    <Link
                      to={`/products/${product.id}`}
                      className="hover:text-emerald-700 flex items-center gap-1"
                    >
                      <span>View details</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
