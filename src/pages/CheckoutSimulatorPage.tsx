import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Shield, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const CheckoutSimulatorPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const txRef = params.get('tx_ref') || 'DEMO-TX';
  const orderId = params.get('order_id') || 'DEMO-ORDER';

  const handleSimulateSuccess = () => {
    navigate(`/checkout/callback?tx_ref=${encodeURIComponent(txRef)}&status=success`);
  };

  const handleSimulateFailure = () => {
    navigate(`/checkout/callback?tx_ref=${encodeURIComponent(txRef)}&status=failed`);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            Chapa Sandbox Test Environment
          </span>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            Chapa Checkout Simulation
          </h2>
          <p className="text-xs text-slate-500">
            Simulate payment verification for GIZAY Marketplace order.
          </p>
        </div>

        {/* Transaction details card */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Order ID:</span>
            <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{orderId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Transaction Ref:</span>
            <span className="font-mono font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
              {txRef}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Currency:</span>
            <span className="font-bold text-emerald-700">ETB</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          <Button
            onClick={handleSimulateSuccess}
            variant="primary"
            size="lg"
            className="w-full bg-emerald-700 hover:bg-emerald-800"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            <span>Simulate Successful Payment</span>
          </Button>

          <Button
            onClick={handleSimulateFailure}
            variant="danger"
            size="lg"
            className="w-full"
          >
            <XCircle className="w-4 h-4 mr-2" />
            <span>Simulate Payment Failure</span>
          </Button>
        </div>

        <p className="text-[11px] text-center text-slate-400">
          In production with live credentials, buyer is redirected to api.chapa.co.
        </p>
      </div>
    </div>
  );
};
