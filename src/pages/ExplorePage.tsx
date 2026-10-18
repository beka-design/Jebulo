import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, PackageX } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { ProductCard } from '../components/product/ProductCard';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Category, Product } from '../types';
import { marketplaceService } from '../services/marketplaceService';

export const ExplorePage: React.FC = () => {
  const { language, t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentCategory = searchParams.get('category') || 'all';
  const initialSearchQuery = searchParams.get('q') || '';
  const currentSort = (searchParams.get('sort') as 'newest' | 'price_asc' | 'price_desc' | 'popular') || 'newest';

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(initialSearchQuery);

  useEffect(() => {
    async function fetchCategories() {
      const cats = await marketplaceService.getCategories();
      setCategories(cats);
    }
    fetchCategories();
  }, []);

  useEffect(() => {
    let isCurrent = true;
    async function loadProducts() {
      setLoading(true);
      try {
        const res = await marketplaceService.getApprovedProducts({
          categorySlug: currentCategory,
          searchQuery: initialSearchQuery,
          sortBy: currentSort,
          limitCount: 24,
        });
        if (isCurrent) {
          setProducts(res.products);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading explore products:', err);
        if (isCurrent) setLoading(false);
      }
    }
    loadProducts();
    return () => {
      isCurrent = false;
    };
  }, [currentCategory, initialSearchQuery, currentSort]);

  const handleCategoryChange = (slug: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (slug === 'all') {
      nextParams.delete('category');
    } else {
      nextParams.set('category', slug);
    }
    setSearchParams(nextParams);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('sort', e.target.value);
    setSearchParams(nextParams);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextParams = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      nextParams.set('q', searchInput.trim());
    } else {
      nextParams.delete('q');
    }
    setSearchParams(nextParams);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
          {t('common.explore')}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Browse digital products from independent creators across Ethiopia.
        </p>
      </div>

      {/* Filter and Search Bar Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('nav.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </form>

        {/* Sort Select */}
        <div className="flex items-center gap-2 shrink-0">
          <SlidersHorizontal className="w-4 h-4 text-slate-400" />
          <select
            value={currentSort}
            onChange={handleSortChange}
            className="text-sm font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="newest">{t('common.newest')}</option>
            <option value="popular">{t('common.popular')}</option>
            <option value="price_asc">{t('common.priceLowHigh')}</option>
            <option value="price_desc">{t('common.priceHighLow')}</option>
          </select>
        </div>
      </div>

      {/* Category Pills (Dynamic from Firestore) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => handleCategoryChange('all')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shrink-0 transition-colors ${
            currentCategory === 'all'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'
          }`}
        >
          {t('common.all')}
        </button>
        {categories.map((cat) => {
          const isSelected = currentCategory === cat.slug;
          const catName = language === 'am' ? cat.nameAm : cat.nameEn;
          return (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.slug)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shrink-0 transition-colors ${
                isSelected
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'
              }`}
            >
              {catName}
            </button>
          );
        })}
      </div>

      {/* Products Grid */}
      {loading ? (
        <LoadingSpinner size="lg" className="py-24" />
      ) : products.length === 0 ? (
        <div className="text-center py-20 px-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <PackageX className="w-12 h-12 mx-auto text-slate-400 mb-3" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
            {t('common.empty')}
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
            Try adjusting your search terms or selecting a different category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((prod) => (
            <ProductCard key={prod.id} product={prod} />
          ))}
        </div>
      )}
    </div>
  );
};
