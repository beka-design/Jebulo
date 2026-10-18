import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FolderHeart, PackageX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Product } from '../types';
import { marketplaceService } from '../services/marketplaceService';
import { ProductCard } from '../components/product/ProductCard';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

export const FavoritesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [favorites, setFavorites] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      navigate('/signin?redirect=/favorites');
      return;
    }

    async function loadFavorites() {
      if (!currentUser) return;
      try {
        const prods = await marketplaceService.getUserFavorites(currentUser.uid);
        setFavorites(prods);
      } catch (err) {
        console.error('Error fetching favorites:', err);
      } finally {
        setLoading(false);
      }
    }

    loadFavorites();
  }, [currentUser, navigate]);

  if (loading) {
    return <LoadingSpinner size="lg" className="py-32" />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
          <FolderHeart className="w-8 h-8 text-amber-500" />
          <span>{t('common.favorites')}</span>
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Digital items you have saved for later.
        </p>
      </div>

      {favorites.length === 0 ? (
        <div className="text-center py-20 px-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <PackageX className="w-12 h-12 mx-auto text-slate-400 mb-3" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
            No saved products
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-6">
            Click the heart icon on any product card to save it to your favorites.
          </p>
          <Link to="/explore">
            <Button variant="primary">
              {t('common.explore')}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {favorites.map((product) => (
            <ProductCard key={product.id} product={product} initialFavorited={true} />
          ))}
        </div>
      )}
    </div>
  );
};
