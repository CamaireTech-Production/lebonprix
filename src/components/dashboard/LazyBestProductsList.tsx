import { Suspense, lazy } from 'react';
import { useIntersectionObserver } from '@hooks/ui/useIntersectionObserver';
import { SkeletonTable } from '@components/common';
import type { Product } from '../../types/models';

const BestProductsList = lazy(() => import('./BestProductsList'));

interface BestProduct {
  productId: string;
  name: string;
  orders: number;
  revenue: number;
}

interface LazyBestProductsListProps {
  products: BestProduct[];
  allProducts?: Product[];
  onViewAll?: () => void;
}

/**
 * Lazy-loaded BestProductsList that only renders when visible in viewport
 */
const LazyBestProductsList = (props: LazyBestProductsListProps) => {
  const [isVisible, ref] = useIntersectionObserver();

  return (
    <div ref={ref}>
      {isVisible ? (
        <Suspense fallback={<SkeletonTable rows={3} />}>
          <BestProductsList {...props} />
        </Suspense>
      ) : (
        <SkeletonTable rows={3} />
      )}
    </div>
  );
};

export default LazyBestProductsList;

