import { Suspense, lazy } from 'react';
import { useIntersectionObserver } from '@hooks/ui/useIntersectionObserver';
import { SkeletonTable } from '@components/common';

const BestClients = lazy(() => import('./BestClients'));

interface BestClient {
  initials: string;
  name: string;
  orders: number;
  totalSpent: number;
}

interface LazyBestClientsProps {
  clients: BestClient[];
  onViewMore?: () => void;
}

/**
 * Lazy-loaded BestClients that only renders when visible in viewport
 */
const LazyBestClients = (props: LazyBestClientsProps) => {
  const [isVisible, ref] = useIntersectionObserver();

  return (
    <div ref={ref}>
      {isVisible ? (
        <Suspense fallback={<SkeletonTable rows={5} />}>
          <BestClients {...props} />
        </Suspense>
      ) : (
        <SkeletonTable rows={5} />
      )}
    </div>
  );
};

export default LazyBestClients;

