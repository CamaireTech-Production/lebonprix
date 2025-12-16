import React, { useEffect, useRef, useState } from 'react';
import { SectionContainer } from './SectionContainer';
import { Link } from 'react-router-dom';

export const GettingStartedSection: React.FC = () => {
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

  const steps = [
    {
      number: 1,
      title: 'Commencez gratuitement',
      description: 'Essayez Geskap gratuitement—aucune carte bancaire requise.'
    },
    {
      number: 2,
      title: 'Configurez votre entreprise',
      description: 'Obtenez de l\'aide à chaque étape, du service client dédié aux applications de migration.'
    },
    {
      number: 3,
      title: 'Personnalisez votre solution',
      description: 'Personnalisez Geskap avec des applications et créez des solutions personnalisées avec nos partenaires.'
    }
  ];

  return (
    <SectionContainer backgroundColor="white" className="py-20">
      <div
        ref={titleRef}
        className={`text-center mb-12 transition-all duration-600 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
        }`}
      >
        <h2 className="text-4xl sm:text-5xl font-title font-bold text-gray-900 mb-4">
          Comment commencer avec Geskap
        </h2>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Que vous débutiez ou que vous changiez de plateforme, nous sommes là pour vous aider.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-12">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`text-center transition-all duration-500 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            style={{ transitionDelay: `${index * 100}ms` }}
          >
            <div className="w-16 h-16 bg-yellow-400 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl font-bold text-gray-900">{step.number}</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h3>
            <p className="text-gray-600">{step.description}</p>
          </div>
        ))}
      </div>

      <div
        className={`text-center transition-all duration-500 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
        style={{ transitionDelay: '300ms' }}
      >
        <Link
          to="/auth/register"
          className="bg-black text-white px-8 py-4 rounded-md font-semibold inline-block hover:bg-gray-900 transition-all duration-300 hover:scale-105"
        >
          Commencer
        </Link>
      </div>
    </SectionContainer>
  );
};
