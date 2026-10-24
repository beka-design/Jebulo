import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  BookOpen,
  FolderHeart,
  LogOut,
  ShieldCheck,
  Sparkles,
  Menu,
  X,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { Button } from '../ui/Button';

export const Navbar: React.FC = () => {
  const { currentUser, userProfile, isAdmin, isCreator, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
      setMobileMenuOpen(false);
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'am' : 'en');
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Brand Logo & Name */}
          <Link to="/" className="flex items-center gap-3 shrink-0 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-800 to-emerald-950 flex items-center justify-center shadow-md shadow-emerald-900/20 group-hover:scale-105 transition-transform">
              <span className="text-amber-400 font-extrabold text-xl tracking-tight">J</span>
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                JEBULO
              </span>
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 -mt-1 tracking-wider uppercase">
                ጀቡሎ
              </span>
            </div>
          </Link>

          {/* Search bar (Desktop & Tablet) */}
          <form
            onSubmit={handleSearchSubmit}
            className="hidden md:flex flex-1 max-w-lg relative items-center"
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('nav.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-full bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
          </form>

          {/* Right Navigation Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Explore Link */}
            <Link
              to="/explore"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Layers className="w-4 h-4" />
              <span>{t('common.explore')}</span>
            </Link>

            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Toggle language / ቋንቋ ቀይር"
            >
              <span className={language === 'am' ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                አማ
              </span>
              <span className="text-slate-300 dark:text-slate-600">/</span>
              <span className={language === 'en' ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                EN
              </span>
            </button>

            {/* Creator / Seller CTA */}
            {!isAdmin && (
              <Link
                to={isCreator ? '/creator' : '/become-seller'}
                className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 rounded-lg hover:bg-emerald-100 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{isCreator ? t('common.creatorDashboard') : t('nav.becomeCreator')}</span>
              </Link>
            )}

            {/* Admin Portal Badge if Admin */}
            {isAdmin && (
              <Link
                to="/admin"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-lg hover:bg-rose-100 transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-rose-600" />
                <span>{t('common.adminDashboard')}</span>
              </Link>
            )}

            {/* Auth / Profile Area */}
            {currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-sm shadow-inner">
                    {userProfile?.displayName ? userProfile.displayName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
                </button>

                {/* Dropdown Menu */}
                {userDropdownOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 text-sm animate-in fade-in slide-in-from-top-2"
                    onMouseLeave={() => setUserDropdownOpen(false)}
                  >
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">
                        {userProfile?.displayName || currentUser.email}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {currentUser.email}
                      </p>
                    </div>

                    <Link
                      to="/library"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <BookOpen className="w-4 h-4 text-emerald-600" />
                      <span>{t('common.myPurchases')}</span>
                    </Link>

                    <Link
                      to="/favorites"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <FolderHeart className="w-4 h-4 text-amber-500" />
                      <span>{t('common.favorites')}</span>
                    </Link>

                    {isCreator && (
                      <Link
                        to="/creator"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span>{t('common.creatorDashboard')}</span>
                      </Link>
                    )}

                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      >
                        <ShieldCheck className="w-4 h-4 text-rose-600" />
                        <span>{t('common.adminDashboard')}</span>
                      </Link>
                    )}

                    <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        signOut();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{t('common.signOut')}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/signin">
                  <Button variant="ghost" size="sm">
                    {t('common.signIn')}
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button variant="primary" size="sm">
                    {t('common.signUp')}
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Search & Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-200 dark:border-slate-800 space-y-3 animate-in slide-in-from-top duration-200">
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('nav.searchPlaceholder')}
                className="w-full pl-10 pr-4 py-2 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            </form>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Link
                to="/explore"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 p-2.5 text-sm font-medium rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>{t('common.explore')}</span>
              </Link>

              <Link
                to={isCreator ? '/creator' : '/become-seller'}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 p-2.5 text-sm font-medium rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>{isCreator ? t('common.creatorDashboard') : t('nav.becomeCreator')}</span>
              </Link>

              {currentUser && (
                <>
                  <Link
                    to="/library"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 p-2.5 text-sm font-medium rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    <span>{t('common.myPurchases')}</span>
                  </Link>

                  <Link
                    to="/favorites"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 p-2.5 text-sm font-medium rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    <FolderHeart className="w-4 h-4 text-amber-500" />
                    <span>{t('common.favorites')}</span>
                  </Link>
                </>
              )}

              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="col-span-2 flex items-center gap-2 p-2.5 text-sm font-semibold rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300"
                >
                  <ShieldCheck className="w-4 h-4 text-rose-600" />
                  <span>{t('common.adminDashboard')}</span>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
