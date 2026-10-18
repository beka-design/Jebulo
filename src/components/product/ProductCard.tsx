import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, DownloadCloud, Heart, CheckCircle2 } from 'lucide-react';
import { Product } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { marketplaceService } from '../../services/marketplaceService';

export const ProductCard: React.FC<{ product: Product; initialFavorited?: boolean }> = ({
  product,
  initialFavorited = false,
}) => {
  const { language, t } = useLanguage();
  const { currentUser } = useAuth();
  const [isFav, setIsFav] = useState(initialFavorited);
  const [favLoading, setFavLoading] = useState(false);

  const displayTitle = (language === 'am' && product.titleAm) ? product.titleAm : product.titleEn;
  const displayDesc = (language === 'am' && product.descriptionAm) ? product.descriptionAm : product.descriptionEn;

  const handleToggleFav = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUser) {
      alert('Please sign in to save products to your favorites.');
      return;
    }
    setFavLoading(true);
    try {
      const favorited = await marketplaceService.toggleFavorite(currentUser.uid, product.id);
      setIsFav(favorited);
    } catch (err) {
      console.error('Error toggling favorite:', err);
    } finally {
      setFavLoading(false);
    }
  };

  return (
    <div className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-sm hover:shadow-xl hover:border-emerald-600/30 dark:hover:border-emerald-500/30 transition-all duration-300 flex flex-col">
      {/* Cover Image & Favorite Badge */}
      <div className="relative aspect-[16/10] bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <img
          src={product.coverImageUrl || '/placeholder.png'}
          alt={displayTitle}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            // Fallback gradient if image not found
            (e.target as HTMLElement).style.display = 'none';
          }}
        />

        {/* Favorite Button */}
        <button
          onClick={handleToggleFav}
          disabled={favLoading}
          aria-label="Add to favorites"
          className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-colors ${
            isFav
              ? 'bg-rose-500 text-white shadow-md'
              : 'bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 hover:text-rose-500'
          }`}
        >
          <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
        </button>

        {/* Delivery / Digital Badge */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/70 backdrop-blur-md text-white text-[11px] font-medium">
          <DownloadCloud className="w-3.5 h-3.5 text-emerald-400" />
          <span>{product.productType.replace('_', ' ')}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Creator Info */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t('products.by')}{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {product.creatorName}
              </span>
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>

          {/* Product Title */}
          <Link to={`/products/${product.id}`} className="block group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
            <h3 className="font-bold text-base text-slate-900 dark:text-white line-clamp-1">
              {displayTitle}
            </h3>
          </Link>

          {/* Short Description */}
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
            {displayDesc}
          </p>
        </div>

        {/* Footer: Rating & Price */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {product.ratingAverage > 0 ? product.ratingAverage.toFixed(1) : 'New'}
            </span>
            {product.ratingCount > 0 && (
              <span className="text-slate-400">({product.ratingCount})</span>
            )}
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400 uppercase font-semibold mr-1">
              {t('common.currency')}
            </span>
            <span className="font-extrabold text-lg text-emerald-800 dark:text-emerald-400">
              {product.priceEtb.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
