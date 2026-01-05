import { useEffect, useCallback } from 'react';

interface UseInfiniteScrollOptions {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  threshold?: number; // Distance from bottom to trigger load (in pixels)
}

export const useInfiniteScroll = ({
  hasMore,
  loading,
  onLoadMore,
  threshold = 200
}: UseInfiniteScrollOptions) => {
  const handleScroll = useCallback(() => {
    // Don't load if already loading or no more data
    if (loading || !hasMore) return;

    // Calculate if user is near bottom
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    
    const distanceFromBottom = documentHeight - (scrollTop + windowHeight);
    
    // Trigger load more when user is within threshold of bottom
    if (distanceFromBottom < threshold) {
      console.log('🔄 Infinite scroll triggered - loading more data...');
      onLoadMore();
    }
  }, [loading, hasMore, onLoadMore, threshold]);

  useEffect(() => {
    // Add scroll listener
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Cleanup
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  // Also check on mount in case content doesn't fill screen
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      handleScroll();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [handleScroll]);
};
