import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { StockBatch } from '../../types/models';
import { useAuth } from '@contexts/AuthContext';
import { CURRENCIES } from '@constants/currencies';

interface CostPriceCarouselProps {
  batches: StockBatch[];
  className?: string;
}

const CostPriceCarousel: React.FC<CostPriceCarouselProps> = ({ batches, className = '' }) => {
  const { t } = useTranslation();
  const { company } = useAuth();
  const currencyCode = company?.currency || 'XAF';
  const currencySymbol = CURRENCIES.find(c => c.code === currencyCode)?.symbol || currencyCode;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Filter batches with remaining quantity > 0 and sort by updatedAt (most recently modified first)
  // Falls back to createdAt if updatedAt is not available
  // This ensures that when a batch's cost price is corrected, it's recognized as the latest
  const activeBatches = batches
    .filter(batch => batch.remainingQuantity > 0)
    .sort((a, b) => {
      // Primary sort: updatedAt (most recently modified)
      const updatedA = a.updatedAt?.seconds || 0;
      const updatedB = b.updatedAt?.seconds || 0;
      if (updatedB !== updatedA) {
        return updatedB - updatedA;
      }
      // Secondary sort: createdAt (if updatedAt is same or missing)
      const createdA = a.createdAt?.seconds || 0;
      const createdB = b.createdAt?.seconds || 0;
      return createdB - createdA;
    });

  useEffect(() => {
    if (activeBatches.length <= 1 || isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % activeBatches.length);
    }, 3000); // Switch every 3 seconds

    return () => clearInterval(interval);
  }, [activeBatches.length, isPaused]);

  if (activeBatches.length === 0) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        {t('products.noActiveBatches', 'No active batches')}
      </div>
    );
  }

  if (activeBatches.length === 1) {
    const batch = activeBatches[0];
    return (
      <div className={`text-sm ${className}`}>
        <div className="font-medium text-gray-900">
          {batch.costPrice.toLocaleString()} {currencySymbol}
        </div>
        <div className="text-xs text-gray-500">
          {t('products.batchInfo', {
            batchId: batch.id.slice(-6),
            quantity: batch.remainingQuantity
          })}
        </div>
      </div>
    );
  }

  const currentBatch = activeBatches[currentIndex];

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Main display */}
      <div className="text-sm">
        <div className="font-medium text-gray-900">
          {currentBatch.costPrice.toLocaleString()} {currencySymbol}
        </div>
        <div className="text-xs text-gray-500">
          {t('products.batchInfo', {
            batchId: currentBatch.id.slice(-6),
            quantity: currentBatch.remainingQuantity
          })}
        </div>
      </div>

      {/* Navigation dots */}
      <div className="flex justify-center space-x-1 mt-1">
        {activeBatches.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${index === currentIndex
              ? 'bg-emerald-500'
              : 'bg-gray-300 hover:bg-gray-400'
              }`}
            aria-label={t('products.goToBatch', { index: index + 1 })}
          />
        ))}
      </div>

      {/* Batch counter */}
      <div className="absolute top-0 right-0 text-xs text-gray-400">
        {currentIndex + 1}/{activeBatches.length}
      </div>
    </div>
  );
};

export default CostPriceCarousel;
