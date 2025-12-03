import React, { useEffect, useRef, useState } from 'react';
import { SectionContainer } from './SectionContainer';
import { Zap, Shield, CreditCard } from 'lucide-react';

export const WhyGeskapSection: React.FC = () => {
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

  const reasons = [
    {
      icon: Zap,
      title: 'Démarrez rapidement',
      subtitle: 'Vous pourriez gérer votre entreprise dès demain.',
      description: 'Passez à Geskap. Obtenez plus de clients. Faites plus de ventes.'
    },
    {
      icon: Shield,
      title: 'Fiable pour les entreprises de toutes tailles',
      subtitle: 'Peu importe votre taille, complexité ou ambition.'
    },
    {
      icon: CreditCard,
      title: 'Intégré dans chaque compte',
      subtitle: 'Meilleur système de paiement mobile',
      description: 'Prouvé pour convertir mieux. CinetPay - Votre intégration de paiement mobile money.'
    }
  ];

  return (
    <SectionContainer backgroundColor="white" className="py-20" id="why-geskap">
      <div
        ref={titleRef}
        className={`text-center mb-16 transition-all duration-600 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
        }`}
      >
        <h2 className="text-4xl sm:text-5xl font-title font-bold text-gray-900 mb-4">
          Pourquoi Geskap ?
        </h2>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {reasons.map((reason, index) => {
          const Icon = reason.icon;
          return (
            <div
              key={index}
              className={`text-center transition-all duration-500 delay-${index * 100} ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="mb-4 flex justify-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Icon className="w-8 h-8 text-emerald-600" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{reason.title}</h3>
              <p className="text-gray-600 mb-2">{reason.subtitle}</p>
              {reason.description && (
                <p className="text-gray-500 text-sm">{reason.description}</p>
              )}
            </div>
          );
        })}
      </div>
    </SectionContainer>
  );
};
