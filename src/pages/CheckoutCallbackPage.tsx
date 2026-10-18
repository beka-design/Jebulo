import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, DownloadCloud, BookOpen, ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { paymentService } from '../services/paymentService';
import { Order } from '../types';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

export const CheckoutCallbackPage: React.FC = () => {
  const [params] = useSearchParams();
  const { t } = useLanguage();

  const txRef = params.get('tx_ref');
  const simulatedStatus = params.get('status');

  const [verifying, setVerifying] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!txRef) {
      setErrorMsg('No transaction reference found in callback.');
      setVerifying(false);
      return;
    }

    if (simulatedStatus === 'failed') {
      setErrorMsg('Transaction was cancelled or declined by the provider.');
      setVerifying(false);
      setIsSuccess(false);
      return;
    }

    async function verify() {
      try {
        const result = await paymentService.verifyPayment(txRef!);
        if (result.success) {
          setIsSuccess(true);
          setOrder(result.order);
        } else {
          setIsSuccess(false);
          setErrorMsg('Payment verification could not be confirmed.');
        }
      } catch (err: any) {
        setIsSuccess(false);
        setErrorMsg(err.message || 'Payment verification failed');
      } finally {
        setVerifying(false);
      }
    }

    verify();
  }, [txRef, simulatedStatus]);

  if (verifying) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 space-y-4">
        <LoadingSpinner size="lg" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
          {t('checkout.verifying')}
        </h2>
        <p className="text-xs text-slate-400">
          Confirming transaction with Ethiopian payment network...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-xl text-center space-y-6">
        
        {isSuccess ? (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                {t('checkout.successTitle')}
              </h1>
              <p className="text-sm text-slate-500">
                {t('checkout.successMessage')}
              </p>
            </div>

            {order && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 space-y-2 text-xs text-left">
                <div className="flex justify-between">
                  <span className="text-slate-400">Product:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[220px]">
                    {order.productTitle}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount Paid:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    {order.amountEtb.toLocaleString()} ETB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Transaction Ref:</span>
                  <span className="font-mono text-slate-500 truncate max-w-[200px]">
                    {order.txRef}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-3 pt-2">
              {order && (
                <Link to={`/products/${order.productId}`}>
                  <Button variant="primary" size="lg" className="w-full">
                    <DownloadCloud className="w-4 h-4 mr-2" />
                    <span>Download Files</span>
                  </Button>
                </Link>
              )}

              <Link to="/library">
                <Button variant="outline" size="lg" className="w-full">
                  <BookOpen className="w-4 h-4 mr-2" />
                  <span>{t('checkout.viewLibrary')}</span>
                </Button>
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto">
              <XCircle className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {t('checkout.failedTitle')}
              </h1>
              <p className="text-sm text-slate-500">
                {errorMsg || t('checkout.failedMessage')}
              </p>
            </div>

            {txRef && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-500">
                {t('checkout.txRef')}: {txRef}
              </div>
            )}

            <div className="pt-2">
              <Link to="/explore">
                <Button variant="primary" size="lg" className="w-full">
                  <span>Return to Marketplace</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </>
        )}

      </div>
    </div>
  );
};
