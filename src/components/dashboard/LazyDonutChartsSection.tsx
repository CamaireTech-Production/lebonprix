import { Suspense, lazy } from 'react';
import { useIntersectionObserver } from '@hooks/ui/useIntersectionObserver';
import { SkeletonChart } from '@components/common';

const DonutChartsSection = lazy(() => import('./DonutChartsSection'));

interface LazyDonutChartsSectionProps {
  salesByCategoryData: Array<{ category: string; amount: number }>;
  expensesByCategoryData: Array<{ category: string; amount: number; count: number }>;
  salesBySourceData: Array<{ source: string; amount: number; count: number }>;
  salesByPaymentStatusData: Array<{ status: string; amount: number; count: number }>;
  loading: {
    sales: boolean;
    products: boolean;
    expenses: boolean;
  };
}

/**
 * Lazy-loaded DonutChartsSection that only renders when visible in viewport
 */
const LazyDonutChartsSection = (props: LazyDonutChartsSectionProps) => {
  const [isVisible, ref] = useIntersectionObserver();

  return (
    <div ref={ref}>
      {isVisible ? (
        <Suspense fallback={<SkeletonChart />}>
          <DonutChartsSection {...props} />
        </Suspense>
      ) : (
        <SkeletonChart />
      )}
    </div>
  );
};

export default LazyDonutChartsSection;

