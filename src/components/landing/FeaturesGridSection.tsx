import React from 'react';
import { SectionContainer } from './SectionContainer';
import { FeatureCard } from './FeatureCard';
import {
  BarChart3,
  ShoppingCart,
  Package,
  DollarSign,
  CreditCard,
  ShoppingBag,
  FileText,
  Users
} from 'lucide-react';

export const FeaturesGridSection: React.FC = () => {
  const features = [
    {
      icon: BarChart3,
      title: 'Dashboard intelligent',
      description: 'Statistiques clés, ventes, dépenses, profits et objectifs en temps réel.'
    },
    {
      icon: ShoppingCart,
      title: 'Gestion des ventes',
      description: 'Créez, éditez et suivez vos ventes avec informations clients et factures.'
    },
    {
      icon: Package,
      title: 'Gestion des stocks',
      description: 'Gérez vos produits, stocks, catégories avec import en masse CSV/Excel. Méthodes FIFO/LIFO intégrées.'
    },
    {
      icon: DollarSign,
      title: 'Gestion financière',
      description: 'Vue unifiée de toutes vos transactions financières (ventes, dépenses, entrées manuelles).'
    },
    {
      icon: CreditCard,
      title: 'Paiements mobiles',
      description: 'Intégration CinetPay pour MTN Money, Orange Money, cartes bancaires et virements.'
    },
    {
      icon: ShoppingBag,
      title: 'Système de commandes',
      description: 'Gérez les commandes en ligne et WhatsApp avec suivi complet du statut et traçabilité.'
    },
    {
      icon: FileText,
      title: 'Rapports & Export',
      description: 'Générez et exportez vos rapports d\'activité en quelques clics.'
    },
    {
      icon: Users,
      title: 'Multi-utilisateurs',
      description: 'Authentification sécurisée avec contrôle d\'accès basé sur les rôles.'
    }
  ];

  return (
    <SectionContainer backgroundColor="white" className="py-20" id="features">
      <div className="text-center mb-12">
        <h2 className="text-4xl sm:text-5xl font-title font-bold text-gray-900 mb-4">
          Tout ce dont vous avez besoin pour gérer votre entreprise
        </h2>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          La puissance de gérer vos ventes, stocks, finances et paiements,
          le tout sur la meilleure plateforme de gestion d'entreprise.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <FeatureCard
              key={index}
              title={feature.title}
              description={feature.description}
              icon={Icon}
              delay={index * 0.05}
            />
          );
        })}
      </div>
    </SectionContainer>
  );
};

