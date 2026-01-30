import { Suspense, ReactNode } from 'react';
import SkeletonPageLoading from './SkeletonPageLoading';

interface LazyPageProps {
  children: ReactNode;
}

const LazyPage = ({ children }: LazyPageProps) => {
  return (
    <Suspense fallback={<SkeletonPageLoading />}>
      {children}
    </Suspense>
  );
};

export default LazyPage;
