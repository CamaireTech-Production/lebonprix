import React, { useEffect, useRef, useState } from 'react';
import { SectionContainer } from './SectionContainer';
import { ImageWithSkeleton } from '../common/ImageWithSkeleton';

export const UseCasesSection: React.FC = () => {
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

  const useCases = [
    {
      title: 'Boutique unique',
      description: 'Gérez votre boutique avec matériel intégré, logiciel et paiements intégrés.',
      image: '/placeholder.png'
    },
    {
      title: 'Plusieurs points de vente',
      description: 'Simplifiez vos opérations avec données unifiées, rapports et gestion d\'inventaire.',
      image: '/placeholder.png'
    },
    {
      title: 'En déplacement',
      description: 'Utilisez le logiciel POS sans fil pour vendre lors de pop-ups, marchés et plus encore.',
      image: '/placeholder.png'
    }
  ];

  return (
    <SectionContainer backgroundColor="white" className="py-20" id="business-sizes">
      <div
        ref={titleRef}
        className={`text-center mb-12 transition-all duration-600 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
        }`}
      >
        <h2 className="text-4xl sm:text-5xl font-title font-bold text-gray-900 mb-4">
          Des entreprises de toutes tailles nous font confiance
        </h2>
      </div>

      <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
        {useCases.map((useCase, index) => (
          <div
            key={index}
            className={`bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            style={{ transitionDelay: `${index * 100}ms` }}
          >
            {/* Image en haut - format vertical */}
            <div className="aspect-[3/4] relative overflow-hidden">
              <ImageWithSkeleton
                src={useCase.image}
                alt={useCase.title}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Contenu texte en bas */}
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">{useCase.title}</h3>
              <p className="text-gray-600 leading-relaxed">{useCase.description}</p>
            </div>
          </div>
        ))}
      </div>
    </SectionContainer>
  );
};
