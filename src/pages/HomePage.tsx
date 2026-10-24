import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  TrendingUp,
  BookOpen,
  GraduationCap,
  Palette,
  Code,
  FileSpreadsheet,
  Headphones,
  Camera,
  Layers,
  Package,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { ProductCard } from '../components/product/ProductCard';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Button } from '../components/ui/Button';
import { Category, Product } from '../types';
import { marketplaceService } from '../services/marketplaceService';

// Dynamic icon mapper for categories
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  BookOpen: <BookOpen className="w-6 h-6" />,
  GraduationCap: <GraduationCap className="w-6 h-6" />,
  Palette: <Palette className="w-6 h-6" />,
  Code: <Code className="w-6 h-6" />,
  FileSpreadsheet: <FileSpreadsheet className="w-6 h-6" />,
  Headphones: <Headphones className="w-6 h-6" />,
  Camera: <Camera className="w-6 h-6" />,
  Layers: <Layers className="w-6 h-6" />,
  Package: <Package className="w-6 h-6" />,
};

export const HomePage: React.FC = () => {
  const { language, t } = useLanguage();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [cats, featRes, recentRes] = await Promise.all([
          marketplaceService.getCategories(),
          marketplaceService.getApprovedProducts({ sortBy: 'popular', limitCount: 4 }),
          marketplaceService.getApprovedProducts({ sortBy: 'newest', limitCount: 8 }),
        ]);

        if (isMounted) {
          setCategories(cats);
          setFeaturedProducts(featRes.products);
          setRecentProducts(recentRes.products);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading home data:', err);
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="space-y-16 pb-20">
      
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-950 via-slate-900 to-slate-950 text-white py-16 sm:py-24">
        {/* Ethiopian ornamental pattern background flair */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#4ade80_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm font-medium mb-6 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{t('hero.badge')}</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight max-w-4xl mx-auto leading-tight sm:leading-none">
            {t('hero.title')}
          </h1>

          {/* Subtitle */}
          <p className="mt-5 text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {t('hero.subtitle')}
          </p>

          {/* Search bar inside Hero */}
          <form
            onSubmit={handleHeroSearch}
            className="mt-8 max-w-2xl mx-auto flex flex-col sm:flex-row gap-2.5 p-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl"
          >
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('nav.searchPlaceholder')}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-900/80 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
              />
            </div>
            <Button type="submit" variant="secondary" size="lg" className="sm:px-8">
              <span>{t('common.explore')}</span>
            </Button>
          </form>

          {/* Trust points */}
          <div className="mt-10 pt-6 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto text-xs text-slate-400">
            <div className="flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{t('hero.trust1')}</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>{t('hero.trust2')}</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky-400" />
              <span>{t('hero.trust3')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Dynamic Categories Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {t('categories.title')}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t('categories.subtitle')}
            </p>
          </div>
          <Link
            to="/explore"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800"
          >
            <span>{t('common.viewAll')}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <LoadingSpinner size="lg" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((cat) => {
              const catName = language === 'am' ? cat.nameAm : cat.nameEn;
              const catDesc = language === 'am' ? cat.descriptionAm : cat.descriptionEn;
              const icon = cat.iconName && CATEGORY_ICONS[cat.iconName] ? CATEGORY_ICONS[cat.iconName] : <Package className="w-6 h-6" />;

              return (
                <Link
                  key={cat.id}
                  to={`/explore?category=${cat.slug}`}
                  className="group p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-600/40 hover:shadow-lg transition-all duration-200 flex flex-col justify-between"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-emerald-100 transition-all">
                    {icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      {catName}
                    </h3>
                    {catDesc && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {catDesc}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* 2.5 Featured Products if available */}
      {featuredProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                {t('products.featured')}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Top rated and most popular digital resources on JEBULO.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* 3. Featured / Recent Products Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {t('products.recent')}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Verified digital items ready for instant download in ETB.
            </p>
          </div>
          <Link
            to="/explore"
            className="text-sm font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 flex items-center gap-1"
          >
            <span>{t('common.viewAll')}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <LoadingSpinner size="lg" />
        ) : recentProducts.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-3xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            <Package className="w-12 h-12 mx-auto text-slate-400 mb-3" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              New products coming soon
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
              Independent creators are currently submitting new digital products for review.
            </p>
            <Link to="/become-seller">
              <Button variant="primary">
                <span>{t('nav.becomeCreator')}</span>
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {recentProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* 4. Creator Callout Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-slate-900 text-white p-8 sm:p-12 shadow-xl relative overflow-hidden">
          <div className="relative z-10 max-w-2xl space-y-4">
            <span className="px-3 py-1 rounded-full bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wide">
              Creator Economy
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
              {t('creator.applyTitle')}
            </h2>
            <p className="text-emerald-100 text-sm sm:text-base leading-relaxed">
              {t('creator.applySubtitle')}
            </p>
            <div className="pt-2 flex flex-wrap gap-3">
              <Link to="/become-seller">
                <Button variant="secondary" size="lg">
                  <span>{t('hero.ctaSell')}</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to="/policies/creator-terms">
                <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10">
                  <span>{t('common.creatorPolicy')}</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};
