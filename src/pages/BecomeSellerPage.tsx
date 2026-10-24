import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, ShieldCheck, CheckCircle2, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { creatorService } from '../services/creatorService';
import { marketplaceService } from '../services/marketplaceService';
import { CreatorApplication, Category } from '../types';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

export const BecomeSellerPage: React.FC = () => {
  const { currentUser, isCreator } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();

  const [application, setApplication] = useState<CreatorApplication | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [brandName, setBrandName] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'telebirr' | 'cbe' | 'awash' | 'bank_transfer'>('telebirr');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [bio, setBio] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [declaredRights, setDeclaredRights] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      navigate('/signin?redirect=/become-seller');
      return;
    }

    if (isCreator) {
      navigate('/creator');
      return;
    }

    async function loadData() {
      if (!currentUser) return;
      try {
        const [app, cats] = await Promise.all([
          creatorService.getApplicationByUserId(currentUser.uid),
          marketplaceService.getCategories(),
        ]);
        setApplication(app);
        setCategories(cats);
      } catch (err) {
        console.error('Error loading seller application data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [currentUser, isCreator, navigate]);

  const toggleCategory = (slug: string) => {
    if (selectedCategories.includes(slug)) {
      setSelectedCategories(selectedCategories.filter((c) => c !== slug));
    } else {
      setSelectedCategories([...selectedCategories, slug]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!declaredRights) {
      alert('You must confirm that you hold legal ownership or distribution rights for all digital products you submit.');
      return;
    }

    setSubmitting(true);
    try {
      await creatorService.submitApplication({
        userId: currentUser.uid,
        userEmail: currentUser.email || '',
        userName: currentUser.displayName || 'Creator',
        brandName,
        portfolioOrWebsiteUrl: portfolioUrl,
        payoutMethod,
        payoutAccountNumber: accountNumber,
        payoutAccountName: accountName,
        bio,
        intendedCategories: selectedCategories,
      });

      // Reload
      const app = await creatorService.getApplicationByUserId(currentUser.uid);
      setApplication(app);
    } catch (err: any) {
      alert(`Submission error: ${err.message || 'Failed to submit application'}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" className="py-32" />;
  }

  // Already submitted an application
  if (application) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-xl text-center space-y-6">
          
          {application.status === 'pending' && (
            <>
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center mx-auto">
                <Clock className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Application Under Review
              </h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                {t('creator.applicationUnderReview')}
              </p>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 text-xs text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Brand Name:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{application.brandName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Payout:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase">{application.payoutMethod} ({application.payoutAccountNumber})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Submitted:</span>
                  <span className="text-slate-600 dark:text-slate-400">{new Date(application.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </>
          )}

          {application.status === 'approved' && (
            <>
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Application Approved!
              </h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Congratulations, your creator application has been approved. You can now publish digital products and start earning.
              </p>
              <Link to="/creator">
                <Button variant="primary" size="lg" className="w-full">
                  <span>Enter Creator Studio</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </>
          )}

          {application.status === 'rejected' && (
            <>
              <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Application Requires Changes
              </h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                {t('creator.applicationRejected')}
              </p>
              {application.adminNotes && (
                <div className="p-4 rounded-2xl bg-rose-50 text-rose-800 text-xs text-left">
                  <span className="font-bold">Administrator Feedback:</span>
                  <p className="mt-1">{application.adminNotes}</p>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      
      {/* Title */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-xs font-semibold">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Keep 88% of your sales earnings</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {t('creator.applyTitle')}
        </h1>
        <p className="text-sm sm:text-base text-slate-500 max-w-xl mx-auto">
          {t('creator.applySubtitle')}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-10 shadow-lg space-y-6">
        
        {/* Brand Name */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
            {t('creator.applyBrandName')} *
          </label>
          <input
            type="text"
            required
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="e.g. Addis Studio, Solomon Tech, Habesha Graphics"
            className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Payout method & details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              {t('creator.applyPayoutMethod')} *
            </label>
            <select
              value={payoutMethod}
              onChange={(e: any) => setPayoutMethod(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="telebirr">Telebirr (Mobile Wallet)</option>
              <option value="cbe">Commercial Bank of Ethiopia (CBE)</option>
              <option value="awash">Awash Bank</option>
              <option value="bank_transfer">Other Ethiopian Bank Transfer</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              {t('creator.applyAccountNumber')} *
            </label>
            <input
              type="text"
              required
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="e.g. 0911XXXXXX or 1000XXXXXXXX"
              className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
            {t('creator.applyAccountName')} *
          </label>
          <input
            type="text"
            required
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="Official legal name registered on bank or Telebirr account"
            className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Intended Categories */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
            What digital products will you sell?
          </label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const isSelected = selectedCategories.includes(cat.slug);
              const catName = language === 'am' ? cat.nameAm : cat.nameEn;
              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => toggleCategory(cat.slug)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    isSelected
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {catName}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bio */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
            {t('creator.applyBio')} *
          </label>
          <textarea
            required
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Briefly describe your creative work, experience, or product portfolio..."
            className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Portfolio / Website */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
            Portfolio / Social Profile (Optional)
          </label>
          <input
            type="url"
            value={portfolioUrl}
            onChange={(e) => setPortfolioUrl(e.target.value)}
            placeholder="https://t.me/yourchannel, github.com, behance.net, etc."
            className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Rights Declaration */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              required
              checked={declaredRights}
              onChange={(e) => setDeclaredRights(e.target.checked)}
              className="mt-1 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
            />
            <span className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              I certify that I hold all necessary copyrights, intellectual property licenses, and distribution rights for any digital products I upload to JEBULO. I agree that fraudulent or copyrighted content will result in immediate suspension and forfeiture of earnings.
            </span>
          </label>
        </div>

        <Button
          type="submit"
          isLoading={submitting}
          variant="primary"
          size="lg"
          className="w-full py-4 text-base"
        >
          <ShieldCheck className="w-5 h-5 mr-2" />
          <span>{t('creator.applySubmit')}</span>
        </Button>
      </form>

    </div>
  );
};
