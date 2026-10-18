import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

export const PolicyPage: React.FC = () => {
  const { policyType } = useParams<{ policyType: string }>();

  const renderContent = () => {
    switch (policyType) {
      case 'terms':
        return (
          <div className="space-y-6">
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
              Terms of Service
            </h1>
            <p className="text-sm text-slate-500">Last updated: October 2026</p>

            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">1. Introduction</h2>
              <p>
                Welcome to <strong>GIZAY (ግዛኝ)</strong>, an Ethiopian digital marketplace platform connecting independent creators and purchasers of legitimate digital products and intellectual assets.
              </p>

              <h2 className="text-lg font-bold text-slate-900 dark:text-white">2. Eligibility & Accounts</h2>
              <p>
                You must provide accurate registration details. You are responsible for safeguarding your credentials. GIZAY reserves the right to suspend accounts that engage in fraudulent behavior, impersonation, or copyright violations.
              </p>

              <h2 className="text-lg font-bold text-slate-900 dark:text-white">3. Currency & Pricing</h2>
              <p>
                All marketplace transactions, balances, and payouts are conducted in <strong>Ethiopian Birr (ETB)</strong>. Prices are set by creators and processed securely through Chapa.
              </p>

              <h2 className="text-lg font-bold text-slate-900 dark:text-white">4. Digital Deliverables</h2>
              <p>
                Purchasers receive non-exclusive licenses to download verified digital files upon successful payment confirmation. Permanent public sharing or unauthorized redistribution of downloaded assets is prohibited.
              </p>
            </div>
          </div>
        );

      case 'privacy':
        return (
          <div className="space-y-6">
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
              Privacy Policy
            </h1>
            <p className="text-sm text-slate-500">Last updated: October 2026</p>

            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">1. Information We Collect</h2>
              <p>
                We collect your account email, display name, preferred language, transaction history, and creator payout account numbers (Telebirr or CBE). We never collect or store payment card details on GIZAY servers; all payment card details are handled directly by Chapa.
              </p>

              <h2 className="text-lg font-bold text-slate-900 dark:text-white">2. How Information is Used</h2>
              <p>
                Your information is used strictly to authenticate your account, fulfill digital download entitlements, send transaction receipts, and remit creator earnings.
              </p>
            </div>
          </div>
        );

      case 'refunds':
        return (
          <div className="space-y-6">
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
              Digital Product Refund Policy
            </h1>
            <p className="text-sm text-slate-500">Last updated: October 2026</p>

            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">1. Nature of Digital Products</h2>
              <p>
                Because digital products (e-books, source code, courses, templates) are delivered electronically immediately upon payment verification, sales are generally final once the digital package has been downloaded.
              </p>

              <h2 className="text-lg font-bold text-slate-900 dark:text-white">2. Eligible Exceptions</h2>
              <p>
                Refunds will be granted if:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>The digital file is corrupt, unopenable, and the creator fails to provide a working replacement within 48 hours.</li>
                <li>The file materially misrepresents the description provided on the product page.</li>
                <li>You were erroneously billed multiple times for the same transaction.</li>
              </ul>

              <h2 className="text-lg font-bold text-slate-900 dark:text-white">3. Filing a Claim</h2>
              <p>
                To request a refund review, contact support@gizay.com with your unique transaction reference (e.g., GIZAY-12345) within 7 days of purchase.
              </p>
            </div>
          </div>
        );

      case 'creator-terms':
      default:
        return (
          <div className="space-y-6">
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
              Creator Agreement & Commission Terms
            </h1>
            <p className="text-sm text-slate-500">Last updated: October 2026</p>

            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>88% Creator / 12% Marketplace Revenue Split</span>
                </h3>
                <p className="text-xs mt-1">
                  Creators receive 88% of the gross sale price for every completed digital transaction. The platform retains a 12% commission to cover payment processing, hosting, server infrastructure, and secure delivery.
                </p>
              </div>

              <h2 className="text-lg font-bold text-slate-900 dark:text-white">1. Copyright Warranty</h2>
              <p>
                By publishing on GIZAY, you represent and warrant that you own all copyrights or possess explicit legal authorization to license and distribute the content. Uploading pirated, cracked, or unauthorized material results in immediate account termination.
              </p>

              <h2 className="text-lg font-bold text-slate-900 dark:text-white">2. Manual Payouts via Telebirr & CBE</h2>
              <p>
                Creators may request payouts whenever their available balance reaches or exceeds <strong>500 ETB</strong>. Payouts are manually reviewed and transferred by platform administrators to the creator's verified Telebirr or bank account within 1-2 business days.
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Return to Home</span>
      </Link>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 sm:p-12 shadow-sm">
        {renderContent()}
      </div>
    </div>
  );
};
