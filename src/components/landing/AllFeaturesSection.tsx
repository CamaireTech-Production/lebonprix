import React, { useEffect, useRef, useState } from 'react';
import { SectionContainer } from './SectionContainer';

export const AllFeaturesSection: React.FC = () => {
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
      title: 'Vente omnicanale',
      description: 'Utilisez un bureau connecté pour vendre en personne, en ligne, sur les réseaux sociaux et marketplaces.'
    },
    {
      title: 'Gestion du personnel',
      description: 'Définissez les permissions du personnel pour contrôler ce que les employés peuvent accéder.'
    },
    {
      title: 'Traitement des paiements',
      description: 'Acceptez les méthodes de paiement populaires avec des taux de transaction compétitifs.'
    },
    {
      title: 'Gestion des stocks',
      description: 'Gérez les stocks entre les emplacements et intégrez facilement votre IMS et OMS existants.'
    },
    {
      title: 'Gestion des clients',
      description: 'Capturez les informations clients de manière transparente à la caisse et utilisez les insights pour améliorer les expériences d\'achat.'
    },
    {
      title: 'Rapports et analyses',
      description: 'Comprenez votre entreprise, de ce qui se vend le mieux à quand vous êtes le plus occupé.'
    }
  ];

  return (
    <SectionContainer backgroundColor="beige" className="py-20">
      <div
        ref={titleRef}
        className={`text-center mb-12 transition-all duration-600 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
        }`}
      >
        <div className="mb-4">
          <span className="text-gray-600 font-semibold text-sm uppercase tracking-wide">
            Fonctionnalités
          </span>
        </div>
        <h2 className="text-4xl sm:text-5xl font-title font-bold text-gray-900 mb-4">
          Toutes les fonctionnalités. Tout en un seul endroit.
        </h2>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Augmentez la productivité de la boutique au bureau avec tout ce dont
          votre équipe a besoin pour faire tourner votre entreprise correctement.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {features.map((feature, index) => (
          <div
            key={index}
            className={`bg-white p-6 rounded-lg transition-all duration-500 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            style={{ transitionDelay: `${index * 100}ms` }}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
            <p className="text-gray-600">{feature.description}</p>
            <a
              href="#"
              className="text-emerald-600 font-semibold hover:text-emerald-700 mt-4 inline-block"
            >
              {feature.title} →
            </a>
          </div>
        ))}
      </div>

      <div
        className={`text-center mt-12 transition-all duration-500 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
        style={{ transitionDelay: '600ms' }}
      >
        <button className="border-2 border-gray-900 text-gray-900 px-8 py-4 rounded-md font-semibold hover:bg-gray-900 hover:text-white transition-all duration-300">
          Explorer toutes les fonctionnalités
        </button>
      </div>
    </SectionContainer>
  );
};
