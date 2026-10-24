import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, CreditCard, Lock, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Product } from '../types';
import { marketplaceService } from '../services/marketplaceService';
import { paymentService } from '../services/paymentService';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

export const CheckoutPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const { currentUser, userProfile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      navigate(`/signin?redirect=/checkout/${productId}`);
      return;
    }

    async function loadData() {
      if (!productId) return;
      try {
        const prod = await marketplaceService.getProductById(productId);
        if (!prod) {
          setErrorMsg('Product not found or unavailable.');
          setLoading(false);
          return;
        }

        // Check if user already owns this product
        if (currentUser) {
          const alreadyOwned = await marketplaceService.checkPurchaseEntitlement(
            currentUser.uid,
            productId
          );
          if (alreadyOwned) {
            navigate(`/products/${productId}`);
            return;
          }
        }

        setProduct(prod);
        setLoading(false);
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to load checkout details');
        setLoading(false);
      }
    }

    loadData();
  }, [productId, currentUser, navigate]);

  const handlePay = async () => {
    if (!product || !currentUser) return;
    setInitializing(true);
    setErrorMsg(null);

    try {
      const res = await paymentService.initializeCheckout({
        product,
        buyerId: currentUser.uid,
        buyerEmail: currentUser.email || '',
        buyerName: userProfile?.displayName || currentUser.displayName || 'JEBULO Buyer',
      });

      // Redirect to Chapa checkout or local simulator
      if (res.mode === 'simulator') {
        navigate(res.checkoutUrl);
      } else {
        window.location.href = res.checkoutUrl;
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize payment gateway.');
      setInitializing(false);
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" className="py-32" />;
  }

  if (errorMsg || !product) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Checkout Error</h2>
        <p className="text-sm text-slate-500">{errorMsg}</p>
        <Link to="/explore">
          <Button variant="primary">Return to Marketplace</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      <Link
        to={`/products/${product.id}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>{t('common.back')}</span>
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        
        {/* Left: Product summary */}
        <div className="md:col-span-7 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {t('checkout.orderSummary')}
          </h2>

          <div className="flex gap-4 items-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <img
              src={product.coverImageUrl || '/placeholder.png'}
              alt={product.titleEn}
              className="w-20 h-20 rounded-xl object-cover"
            />
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 capitalize">
                {product.categorySlug}
              </span>
              <h3 className="font-bold text-base text-slate-900 dark:text-white truncate">
                {product.titleEn}
              </h3>
              <p className="text-xs text-slate-400">
                {t('products.by')} {product.creatorName}
              </p>
            </div>
            <div className="text-right">
              <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                {product.priceEtb.toLocaleString()} ETB
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-2 text-sm text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {product.priceEtb.toLocaleString()} ETB
              </span>
            </div>
            <div className="flex justify-between">
              <span>Platform Delivery & Processing</span>
              <span className="font-medium text-emerald-600">Included</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-base font-extrabold text-slate-900 dark:text-white">
              <span>Total Due</span>
              <span className="text-emerald-800 dark:text-emerald-400 text-xl">
                {product.priceEtb.toLocaleString()} ETB
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-200">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {t('checkout.paymentRedirectNotice')}
            </p>
          </div>
        </div>

        {/* Right: Payment Provider Action */}
        <div className="md:col-span-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-lg space-y-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            <span>Ethiopian Payment Gateway</span>
          </h3>

          <div className="space-y-2">
            <p className="text-xs text-slate-500">
              Supported payment methods through Chapa:
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-center bg-slate-50 dark:bg-slate-800">
                Telebirr
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-center bg-slate-50 dark:bg-slate-800">
                CBE Birr
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-center bg-slate-50 dark:bg-slate-800">
                Awash Birr
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-center bg-slate-50 dark:bg-slate-800">
                Debit / Credit Cards
              </div>
            </div>
          </div>

          <Button
            onClick={handlePay}
            isLoading={initializing}
            variant="primary"
            size="lg"
            className="w-full py-4 text-base"
          >
            <Lock className="w-4 h-4 mr-2" />
            <span>Pay {product.priceEtb.toLocaleString()} ETB</span>
          </Button>

          <p className="text-[11px] text-center text-slate-400">
            Encrypted with 256-bit SSL. JEBULO never stores card or bank credentials.
          </p>
        </div>

      </div>
    </div>
  );
};
