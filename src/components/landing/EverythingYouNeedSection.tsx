import React, { useEffect, useRef, useState } from 'react';
import { SectionContainer } from './SectionContainer';
import { ImageWithSkeleton } from '../common/ImageWithSkeleton';
import { Plus, Minus } from 'lucide-react';

export const EverythingYouNeedSection: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [expandedItems, setExpandedItems] = useState<{ [key: number]: boolean }>({});
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

  const toggleDescription = (index: number) => {
    setExpandedItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const features = [
    {
      label: 'Bureau',
      image: '/placeholder.png',
      description: 'Gérez votre entreprise depuis un bureau centralisé. Accédez à tous vos outils de gestion, inventaire, ventes et rapports depuis une interface unique et intuitive.',
      tagPosition: { top: '8%', left: '5%' },
      imageWidth: 'w-[85%]', // Légèrement plus petite pour centrage
      imageHeight: 'h-[400px] md:h-[500px]',
      offsetTop: '4%' // Légèrement en dessous de la 2e image
    },
    {
      label: 'Système POS',
      image: '/placeholder.png',
      description: 'Système de point de vente complet avec matériel intégré. Acceptez les paiements en magasin avec des terminaux modernes et synchronisez toutes vos ventes en temps réel.',
      tagPosition: { bottom: '10%', left: '8%' },
      imageWidth: 'w-[90%]', // Plus grande, centrée
      imageHeight: 'h-[500px] md:h-[600px]',
      offsetTop: '0%' // Image de référence (centrée)
    },
    {
      label: 'Ventes en ligne',
      image: '/placeholder.png',
      description: 'La plateforme pour vendre partout où les clients font leurs achats : en ligne, sur les réseaux sociaux, et plus encore.',
      tagPosition: { top: '12%', right: '6%' },
      imageWidth: 'w-[80%]', // Plus petite pour centrage
      imageHeight: 'h-[350px] md:h-[450px]',
      offsetTop: '0%' // Centrée
    }
  ];

  return (
    <SectionContainer backgroundColor="white" className="py-20">
      {/* Headline et description */}
      <div
        ref={titleRef}
        className={`mb-12 transition-all duration-600 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
        }`}
      >
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-title font-bold text-gray-900 mb-4">
          Tout ce dont vous avez besoin en magasin, en ligne et au-delà
        </h2>
        <p className="text-xl text-gray-600 max-w-3xl leading-relaxed">
          La puissance de vendre en personne soutenue par la puissance de vendre en ligne,
          le tout sur la meilleure plateforme de commerce.
        </p>
      </div>

      {/* 3 visuels avec tags cliquables en position absolute */}
      <div className="grid md:grid-cols-3 gap-4 lg:gap-6">
        {features.map((feature, index) => {
          const isExpanded = expandedItems[index] || false;

          return (
            <div
              key={index}
              className={`relative flex items-center justify-center transition-all duration-500 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ 
                transitionDelay: `${index * 100}ms`,
                marginTop: feature.offsetTop
              }}
            >
              {/* Image avec taille variable, centrée */}
              <div className={`${feature.imageWidth} ${feature.imageHeight} rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 relative mx-auto`}>
                <ImageWithSkeleton
                  src={feature.image}
                  alt={feature.label}
                  className="w-full h-full object-cover"
                />

                {/* Tag/Bouton cliquable en position absolute sur l'image */}
                <button
                  onClick={() => toggleDescription(index)}
                  className={`absolute z-10 bg-emerald-100 text-emerald-700 px-4 py-3 rounded-md flex flex-col items-start gap-2 text-sm font-semibold hover:bg-emerald-200 transition-all duration-300 cursor-pointer shadow-lg max-w-[280px] ${
                    isExpanded ? 'min-w-[250px]' : 'w-auto'
                  }`}
                  style={{
                    top: feature.tagPosition.top,
                    bottom: feature.tagPosition.bottom,
                    left: feature.tagPosition.left,
                    right: feature.tagPosition.right
                  }}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <Minus className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <Plus className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="whitespace-nowrap">{feature.label}</span>
                  </div>
                  
                  {/* Description qui s'affiche dans le bouton */}
                  <div
                    className={`w-full text-left transition-all duration-300 overflow-hidden ${
                      isExpanded ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <p className="text-gray-600 text-xs leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </SectionContainer>
  );
};
