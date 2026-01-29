import { useState, useEffect, useRef } from 'react';

/**
 * Hook to detect when an element becomes visible in the viewport
 * Useful for lazy loading components and data
 */
export const useIntersectionObserver = (
  options?: IntersectionObserverInit
): [boolean, React.RefObject<HTMLDivElement>] => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Once visible, we can disconnect to avoid unnecessary checks
          observer.disconnect();
        }
      },
      {
        rootMargin: '100px', // Start loading 100px before element is visible
        threshold: 0.1,
        ...options,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [options]);

  return [isVisible, ref];
};

