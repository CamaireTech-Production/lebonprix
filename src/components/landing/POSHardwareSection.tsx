import React, { useEffect, useRef, useState } from 'react';
import { SectionContainer } from './SectionContainer';
import ImageWithSkeleton from '../common/ImageWithSkeleton';

export const POSHardwareSection: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1, rootMargin: '-100px' }
    );

    if (titleRef.current) {
      observer.observe(titleRef.current);
    }

    return () => {
      if (titleRef.current) {
        observer.unobserve(titleRef.current);
      }
    };
  }, []);

  const features = [
    {
      title: 'Démarrage rapide',
      description: 'Commencez à vendre en un rien de temps avec un matériel fiable prêt à l\'emploi.'
    },
    {
      title: 'Vendez sans interruption',
      description: 'Gardez la file de caisse en mouvement avec 99.9% de disponibilité sur la plateforme Firebase.'
    },
    {
      title: 'Personnalisez votre configuration',
      description: 'Choisissez le matériel adapté à votre budget et scénario de vente — au comptoir ou en déplacement.'
    }
  ];

  return (
    <SectionContainer backgroundColor="white" className="py-20">
      {/* Header et titre */}
      <div
        ref={titleRef}
        className={`mb-12 transition-all duration-600 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
        }`}
      >
        <div className="mb-4">
          <span className="text-gray-600 font-semibold text-sm uppercase tracking-wide">
            Matériel POS
          </span>
        </div>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-title font-bold text-gray-900 mb-4">
          Matériel intégré, quelle que soit votre façon de vendre
        </h2>
      </div>

      {/* Image principale */}
      <div className="mb-16">
        <div className="relative h-[500px] lg:h-[600px] rounded-lg overflow-hidden shadow-xl">
          <ImageWithSkeleton
            src="/placeholder.png"
            alt="Matériel POS Geskap"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* 3 colonnes de texte */}
      <div className="grid md:grid-cols-3 gap-8 mb-12">
        {features.map((feature, index) => (
          <div
            key={index}
            className={`transition-all duration-500 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            style={{ transitionDelay: `${index * 100}ms` }}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              {feature.title}
            </h3>
            <p className="text-gray-600 leading-relaxed">
              {feature.description}
            </p>
          </div>
        ))}
      </div>

      {/* Bouton CTA */}
      <div className="text-center">
        <button className="border-2 border-gray-900 text-gray-900 px-8 py-4 rounded-md font-semibold hover:bg-gray-900 hover:text-white transition-all duration-300">
          Découvrir le matériel POS
        </button>
      </div>
    </SectionContainer>
  );
};

