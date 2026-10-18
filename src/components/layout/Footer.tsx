import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Sparkles, Heart } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export const Footer: React.FC = () => {
  const { t } = useLanguage();

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 transition-colors mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-950 flex items-center justify-center shadow-lg shadow-emerald-950/50">
                <span className="text-amber-400 font-extrabold text-xl">G</span>
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-2xl tracking-tight text-white">GIZAY</span>
                <span className="text-xs font-semibold text-amber-400 tracking-wider">ግዛኝ</span>
              </div>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
              {t('footer.about')}
            </p>
            <div className="pt-2 flex items-center gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 text-emerald-400 border border-slate-700">
                <Shield className="w-3.5 h-3.5" />
                <span>Chapa Verified Checkout</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 text-amber-400 border border-slate-700">
                <Sparkles className="w-3.5 h-3.5" />
                <span>100% ETB Pricing</span>
              </span>
            </div>
          </div>

          {/* Quick Categories */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {t('common.categories')}
            </h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link to="/explore?category=ebooks" className="hover:text-emerald-400 transition-colors">
                  {t('categories.ebooks')}
                </Link>
              </li>
              <li>
                <Link to="/explore?category=courses" className="hover:text-emerald-400 transition-colors">
                  {t('categories.courses')}
                </Link>
              </li>
              <li>
                <Link to="/explore?category=graphics" className="hover:text-emerald-400 transition-colors">
                  {t('categories.graphics')}
                </Link>
              </li>
              <li>
                <Link to="/explore?category=software" className="hover:text-emerald-400 transition-colors">
                  {t('categories.software')}
                </Link>
              </li>
              <li>
                <Link to="/explore?category=templates" className="hover:text-emerald-400 transition-colors">
                  {t('categories.templates')}
                </Link>
              </li>
              <li>
                <Link to="/explore?category=cad-bim" className="hover:text-emerald-400 transition-colors">
                  {t('categories.cadBim')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Creators */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {t('footer.creatorLinks')}
            </h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link to="/become-seller" className="hover:text-amber-400 transition-colors">
                  {t('nav.becomeCreator')}
                </Link>
              </li>
              <li>
                <Link to="/creator" className="hover:text-amber-400 transition-colors">
                  {t('common.creatorDashboard')}
                </Link>
              </li>
              <li>
                <Link to="/policies/creator-terms" className="hover:text-amber-400 transition-colors">
                  {t('common.creatorPolicy')} (88/12 Split)
                </Link>
              </li>
              <li>
                <Link to="/payout-guide" className="hover:text-amber-400 transition-colors">
                  Telebirr & CBE Payouts
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Security */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {t('footer.legalLinks')}
            </h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link to="/policies/terms" className="hover:text-white transition-colors">
                  {t('common.terms')}
                </Link>
              </li>
              <li>
                <Link to="/policies/privacy" className="hover:text-white transition-colors">
                  {t('common.privacy')}
                </Link>
              </li>
              <li>
                <Link to="/policies/refunds" className="hover:text-white transition-colors">
                  {t('common.refundPolicy')}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  {t('common.support')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            &copy; {new Date().getFullYear()} GIZAY. {t('footer.allRightsReserved')}
          </p>
          <div className="flex items-center gap-1">
            <span>{t('footer.madeWithLove')}</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 inline ml-1" />
          </div>
        </div>
      </div>
    </footer>
  );
};
