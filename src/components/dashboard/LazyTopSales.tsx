import { Suspense, lazy } from 'react';
import { useIntersectionObserver } from '@hooks/ui/useIntersectionObserver';
import { SkeletonTable } from '@components/common';
import type { Sale } from '../../types/models';

const TopSales = lazy(() => import('./TopSales'));

interface LazyTopSalesProps {
  sales: Sale[];
  onViewMore?: () => void;
}

/**
 * Lazy-loaded TopSales that only renders when visible in viewport
 */
const LazyTopSales = (props: LazyTopSalesProps) => {
  const [isVisible, ref] = useIntersectionObserver();

  return (
    <div ref={ref}>
      {isVisible ? (
        <Suspense fallback={<SkeletonTable rows={5} />}>
          <TopSales {...props} />
        </Suspense>
      ) : (
        <SkeletonTable rows={5} />
      )}
    </div>
  );
};

export default LazyTopSales;

