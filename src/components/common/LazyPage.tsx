import { Suspense, ReactNode } from 'react';
import PageLoader from './PageLoader';

interface LazyPageProps {
  children: ReactNode;
}

const LazyPage = ({ children }: LazyPageProps) => {
  return (
    <Suspense fallback={<PageLoader />}>
      {children}
    </Suspense>
  );
};

export default LazyPage;
