import React from 'react';
import { SectionContainer } from './SectionContainer';
import { ResourceCard } from './ResourceCard';

export const ResourcesSection: React.FC = () => {
  const resources = [
    {
      title: 'Qu\'est-ce qu\'un système de gestion d\'entreprise ?',
      description: 'Apprenez comment gérer votre entreprise avec un système de gestion complet.',
      image: '/placeholder.png',
      linkText: 'En savoir plus sur les systèmes de gestion'
    },
    {
      title: 'Comment choisir un système de gestion ?',
      description: 'Découvrez ce qu\'il faut rechercher lors de la comparaison des systèmes de gestion.',
      image: '/placeholder.png',
      linkText: 'En savoir plus sur le choix'
    },
    {
      title: 'Guide de migration',
      description: 'Trouvez comment migrer vos données vers Geskap en toute simplicité.',
      image: '/placeholder.png',
      linkText: 'En savoir plus sur la migration'
    }
  ];

  return (
    <SectionContainer backgroundColor="dark" className="py-20">
      <div className="text-center mb-12">
        <h2 className="text-4xl sm:text-5xl font-title font-bold text-white mb-4">
          Ressources pour les entrepreneurs
        </h2>
        <p className="text-xl text-gray-300 max-w-3xl mx-auto">
          Accédez à des guides gratuits, découvrez les tendances du commerce,
          et apprenez comment des entreprises comme la vôtre utilisent Geskap.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {resources.map((resource, index) => (
          <ResourceCard
            key={index}
            title={resource.title}
            description={resource.description}
            image={resource.image}
            classname='bg-black text-white w-full' 
            linkText={resource.linkText}
            delay={index * 0.1}
          />
        ))}
      </div>

      <div className="text-center mt-12">
        <button className="border-2 border-gray-300 text-white px-8 py-4 rounded-md font-semibold hover:bg-gray-900 hover:text-white transition-all duration-300">
          Visiter le blog Geskap
        </button>
      </div>
    </SectionContainer>
  );
};

