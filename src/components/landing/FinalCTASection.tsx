import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SectionContainer } from './SectionContainer';

export const FinalCTASection: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <SectionContainer backgroundColor="dark" className="py-20">
      <div
        ref={ref}
        className={`text-center transition-all duration-600 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
        }`}
      >
        <h2 className="text-4xl sm:text-5xl font-title font-bold text-white mb-6">
          Gérez mieux avec Geskap
        </h2>
        <p className="text-xl text-gray-100 mb-8 max-w-2xl mx-auto">
          Rejoignez des milliers d'entreprises qui font confiance à Geskap
          pour gérer leurs opérations quotidiennes.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/auth/register"
            className="bg-white text-theme-forest px-8 py-4 rounded-md font-semibold hover:bg-gray-100 transition-all duration-300 hover:scale-105"
          >
            Commencer gratuitement
          </Link>
        </div>
        <p className="mt-6 text-sm text-gray-200">
          Vous avez déjà un compte ?{' '}
          <Link to="/auth/login" className="text-white hover:text-gray-200 font-medium underline">
            Connectez-vous pour configurer Geskap
          </Link>
        </p>
      </div>
    </SectionContainer>
  );
};
