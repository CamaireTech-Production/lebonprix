import { Suspense, lazy, useState, useEffect } from 'react';
import { useIntersectionObserver } from '@hooks/ui/useIntersectionObserver';
import { SkeletonChart } from '@components/common';
import type { ChartOptions } from 'chart.js';

const Bar = lazy(() => import('react-chartjs-2').then(module => ({ default: module.Bar })));
const Pie = lazy(() => import('react-chartjs-2').then(module => ({ default: module.Pie })));
const Line = lazy(() => import('react-chartjs-2').then(module => ({ default: module.Line })));

interface LazyChartProps {
  type: 'bar' | 'pie' | 'line';
  data: any;
  options: ChartOptions<any>;
  fallback?: React.ReactNode;
}

/**
 * Lazy-loaded Chart component that only renders when visible in viewport
 */
const LazyChart = ({ type, data, options, fallback }: LazyChartProps) => {
  const [isVisible, ref] = useIntersectionObserver();
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isVisible) {
      // Small delay to ensure smooth rendering
      const timeoutId = setTimeout(() => {
        setShouldRender(true);
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [isVisible]);

  const ChartComponent = type === 'bar' ? Bar : type === 'pie' ? Pie : Line;

  return (
    <div ref={ref} className="w-full h-full min-h-[300px]">
      {shouldRender ? (
        <Suspense fallback={fallback || <SkeletonChart />}>
          <ChartComponent data={data} options={options} />
        </Suspense>
      ) : (
        fallback || <SkeletonChart />
      )}
    </div>
  );
};

export default LazyChart;

