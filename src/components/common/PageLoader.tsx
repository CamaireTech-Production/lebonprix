import SkeletonAppLoading from './SkeletonAppLoading';

const PageLoader = () => {
  // NOTE: Kept for backward compatibility, but we no longer use spinners for page loading.
  return <SkeletonAppLoading />;
};

export default PageLoader;
