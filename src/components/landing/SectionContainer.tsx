import React, { useEffect, useRef, useState } from 'react';

interface SectionContainerProps {
  children: React.ReactNode;
  backgroundColor?: 'white' | 'beige' | 'dark' | 'green';
  className?: string;
  id?: string;
}

export const SectionContainer: React.FC<SectionContainerProps> = ({
  children,
  backgroundColor = 'white',
  className = '',
  id
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1, rootMargin: '-100px' }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, []);

  const bgClasses = {
    white: 'bg-white',
    beige: 'bg-[#f5f5f0]',
    dark: 'bg-theme-forest',
    green: 'bg-emerald-600'
  };

  return (
    <section
      ref={ref}
      id={id}
      className={`${bgClasses[backgroundColor]} ${className}`}
    >
      <div
        className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-600 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
        }`}
      >
        {children}
      </div>
    </section>
  );
};
