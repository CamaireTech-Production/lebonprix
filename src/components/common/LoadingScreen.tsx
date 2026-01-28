import SkeletonAppLoading from './SkeletonAppLoading';

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen = ({ message = 'Loading...' }: LoadingScreenProps) => {
  // NOTE: Kept for backward compatibility, but we no longer use spinners for page loading.
  // Message is currently ignored to guarantee a consistent skeleton-based UX.
  void message;
  return <SkeletonAppLoading />;
};

export default LoadingScreen;