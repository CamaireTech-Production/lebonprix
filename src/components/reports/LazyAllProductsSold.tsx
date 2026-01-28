import { Suspense, lazy } from 'react';
import { useIntersectionObserver } from '@hooks/ui/useIntersectionObserver';
import { SkeletonTable } from '@components/common';

const AllProductsSold = lazy(() => import('./AllProductsSold'));

interface LazyAllProductsSoldProps {
  productsData: any[];
}

/**
 * Lazy-loaded AllProductsSold that only renders when visible in viewport
 */
const LazyAllProductsSold = (props: LazyAllProductsSoldProps) => {
  const [isVisible, ref] = useIntersectionObserver();

  return (
    <div ref={ref}>
      {isVisible ? (
        <Suspense fallback={<SkeletonTable rows={10} />}>
          <AllProductsSold {...props} />
        </Suspense>
      ) : (
        <SkeletonTable rows={10} />
      )}
    </div>
  );
};

export default LazyAllProductsSold;

