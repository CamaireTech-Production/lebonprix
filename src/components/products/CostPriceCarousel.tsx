import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { StockBatch } from '../../types/models';

interface CostPriceCarouselProps {
  batches: StockBatch[];
  className?: string;
}

const CostPriceCarousel: React.FC<CostPriceCarouselProps> = ({ batches, className = '' }) => {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Filter batches with remaining quantity > 0 and sort by creation date (newest first)
  const activeBatches = batches
    .filter(batch => batch.remainingQuantity > 0)
    .sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
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
          {batch.costPrice.toLocaleString()} XAF
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
          {currentBatch.costPrice.toLocaleString()} XAF
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
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              index === currentIndex 
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
