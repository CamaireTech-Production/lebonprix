import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

export const HeroSection: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (contentRef.current) observer.observe(contentRef.current);

    return () => {
      if (contentRef.current) observer.unobserve(contentRef.current);
    };
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Background avec image Shopify */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('https://cdn.shopify.com/b/shopify-brochure2-assets/7fc4d8489bab18f6eabbc775bd90a948.webp')`,
          }}
        >
          {/* Overlay léger pour améliorer la lisibilité du texte */}
          <div className="absolute inset-0 bg-white/10"></div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="relative z-10 flex-1 flex flex-col">
        {/* Section texte - Top half */}
        <div className="flex-1 flex items-center justify-center pt-32 pb-12 px-4 sm:px-6 lg:px-8">
          <div
            ref={contentRef}
            className={`max-w-4xl mx-auto text-center transition-all duration-800 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
            }`}
          >
            <div className="mb-4">
              <span className="text-emerald-600 font-semibold text-sm uppercase tracking-wide">
                Gestion d'entreprise
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-title font-bold text-gray-900 mb-6 leading-tight">
              Gérez votre entreprise comme un pro
            </h1>
            <p className="text-xl sm:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              De la première vente à l'échelle complète, les meilleures entreprises d'aujourd'hui utilisent le système Geskap.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <Link
                to="/auth/register"
                className="bg-black text-white px-8 py-4 rounded-md font-semibold text-center hover:bg-gray-900 transition-all duration-300 hover:scale-105"
              >
                Commencer
              </Link>
            </div>
            <p className="text-sm text-gray-500">
              Vous avez déjà un compte ?{' '}
              <Link to="/auth/login" className="text-emerald-600 hover:text-emerald-700 font-medium underline">
                Connectez-vous pour configurer Geskap
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
