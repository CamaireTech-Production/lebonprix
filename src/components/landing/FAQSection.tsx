import React, { useEffect, useRef, useState } from 'react';
import { SectionContainer } from './SectionContainer';
import { FAQItem } from './FAQItem';

export const FAQSection: React.FC = () => {
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

  const faqs = [
    {
      question: 'Qu\'est-ce que Geskap ?',
      answer: 'Geskap est une solution complète de gestion d\'entreprise pour les petites et moyennes entreprises. Il combine la gestion des ventes, stocks, finances et paiements mobiles dans une seule plateforme moderne et intuitive.'
    },
    {
      question: 'Quels sont les avantages d\'utiliser Geskap ?',
      answer: '- Gestion centralisée de toutes vos opérations\n- Intégration native avec CinetPay pour les paiements mobiles\n- Rapports et analyses en temps réel\n- Application PWA fonctionnant hors ligne\n- Support multi-langue (français/anglais)\n- Interface moderne et facile à utiliser'
    },
    {
      question: 'Quels types d\'entreprises utilisent Geskap ?',
      answer: 'Geskap est conçu pour les petites et moyennes entreprises de tous secteurs : boutiques de détail, e-commerce, restaurants, services, et plus encore. Que vous ayez un seul point de vente ou plusieurs emplacements, Geskap s\'adapte à vos besoins.'
    },
    {
      question: 'Comment fonctionne le système Geskap ?',
      answer: 'Geskap fonctionne sur Firebase, une plateforme cloud sécurisée et fiable. Vous créez un compte, configurez votre entreprise, et commencez à gérer vos opérations immédiatement. Toutes vos données sont synchronisées en temps réel et accessibles depuis n\'importe quel appareil.'
    },
    {
      question: 'Geskap peut-il s\'intégrer avec d\'autres outils ?',
      answer: 'Oui, Geskap peut s\'intégrer avec de nombreux outils via des APIs. Nous supportons l\'import/export de données, l\'intégration avec des systèmes de comptabilité, et plus encore. Contactez-nous pour des intégrations personnalisées.'
    },
    {
      question: 'Geskap est-il disponible dans mon pays ?',
      answer: 'Geskap est actuellement disponible au Cameroun avec support complet des paiements mobiles (MTN Money, Orange Money). Nous étendons progressivement notre présence en Afrique. Contactez-nous pour connaître la disponibilité dans votre pays.'
    },
    {
      question: 'Y a-t-il des frais cachés ?',
      answer: 'Non, Geskap est transparent sur ses tarifs. Vous pouvez commencer gratuitement et passer à un plan payant selon vos besoins. Tous les frais sont clairement indiqués avant l\'engagement.'
    },
    {
      question: 'Mes données sont-elles sécurisées ?',
      answer: 'Absolument. Geskap utilise Firebase, une plateforme sécurisée de Google, avec chiffrement des données, authentification sécurisée, et sauvegardes automatiques. Vos données sont protégées selon les meilleures pratiques de l\'industrie.'
    }
  ];

  return (
    <SectionContainer backgroundColor="epic" className="py-20">
      <div
        ref={titleRef}
        className={`text-center mb-12 transition-all duration-600 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
        }`}
      >
        <h2 className="text-4xl sm:text-5xl font-title font-bold text-white mb-8">
          Questions fréquemment posées
        </h2>
      </div>

      <div className="max-w-3xl mx-auto">
        {faqs.map((faq, index) => (
          <div
            key={index}
            className={`transition-all duration-400 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: `${index * 50}ms` }}
          >
            <FAQItem question={faq.question} answer={faq.answer} />
          </div>
        ))}
      </div>
    </SectionContainer>
  );
};
