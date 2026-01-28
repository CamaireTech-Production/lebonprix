import { Suspense, ReactNode } from 'react';
import SkeletonAppLoading from './SkeletonAppLoading';

interface LazyPageProps {
  children: ReactNode;
}

const LazyPage = ({ children }: LazyPageProps) => {
  return (
    <Suspense fallback={<SkeletonAppLoading />}>
      {children}
    </Suspense>
  );
};

export default LazyPage;
