import React, { useState, useEffect, useRef } from 'react';
import { SectionContainer } from './SectionContainer';
import { ImageWithSkeleton } from '../common/ImageWithSkeleton';

export const POSSoftwareCarouselSection: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const images = [
    '/placeholder.png',
    '/placeholder.png',
    '/placeholder.png'
  ];

  const SLIDE_DURATION = 3000; // 3 secondes
  const PROGRESS_UPDATE_INTERVAL = 50; // Mise à jour toutes les 50ms pour animation fluide

  // Titre et descriptions fixes (ne changent pas)
  const title = 'Commerce connecté.';
  const subtitle = 'La façon dont ça devrait être.';
  const features = [
    {
      title: 'Vendez partout',
      description: 'Clôturez les ventes au comptoir et gardez les commandes hors ligne et en ligne synchronisées avec Geskap.'
    },
    {
      title: 'Construisez la fidélité',
      description: 'Connaissez vos clients en magasin et en ligne et créez des expériences d\'achat personnalisées qui convertissent.'
    },
    {
      title: 'Simplifiez les tâches',
      description: 'Rationalisez les opérations quotidiennes avec un seul bureau pour gérer l\'inventaire, les commandes, les clients et le personnel.'
    }
  ];

  useEffect(() => {
    // Réinitialiser la progression quand on change de slide
    setProgress(0);

    // Démarrer le timer de progression
    progressIntervalRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          return 0;
        }
        return prev + (100 / (SLIDE_DURATION / PROGRESS_UPDATE_INTERVAL));
      });
    }, PROGRESS_UPDATE_INTERVAL);

    // Changer de slide automatiquement
    intervalRef.current = setTimeout(() => {
      setCurrentSlide(prev => (prev + 1) % images.length);
    }, SLIDE_DURATION);

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [currentSlide, images.length]);

  const handleFeatureClick = (slideIndex: number) => {
    setCurrentSlide(slideIndex);
    setProgress(0);
  };

  return (
    <SectionContainer backgroundColor="dark" className="py-20">
        <div>

            <div className="mb-4">
            <span className="text-emerald-400 font-semibold text-sm uppercase tracking-wide">
                Logiciel
            </span>
            </div>

            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-title font-bold text-white mb-4">
            {title}
            </h2>
            
            <p className="text-2xl text-gray-300 mb-12">
            {subtitle}
            </p>
            <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[600px]">
                {/* Partie droite : Images avec transition fade */}
                <div className="relative h-[500px] lg:h-[600px]">
                {images.map((image, index) => (
                    <div
                    key={index}
                    className={`absolute inset-0 transition-opacity duration-500 ${
                        index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
                    }`}
                    >
                    <div className="w-full h-full rounded-lg overflow-hidden shadow-2xl">
                        <ImageWithSkeleton
                        src={image}
                        alt={`Slide ${index + 1}`}
                        className="w-full h-full object-cover"
                        />
                    </div>
                    </div>
                ))}
                </div>

                {/* Partie gauche : Texte avec barre de progression unique */}
                <div className="relative">
                {/* Barre de progression verticale unique à gauche */}
                <div className="absolute left-0 top-0 bottom-0 flex justify-center">
                    <div className="relative w-1 h-full bg-gray-700 rounded-full overflow-hidden">
                    {/* Barre de progression qui se remplit */}
                    <div
                        className="absolute bottom-0 left-0 right-0 bg-emerald-500 transition-all duration-75"
                        style={{
                        height: `${progress}%`,
                        transition: 'height 50ms linear'
                        }}
                    />
                    
                    {/* Indicateurs de position pour chaque slide */}
                    <div className="absolute inset-0 flex flex-col justify-between py-2">
                        {images.map((_, index) => (
                        <div
                            key={index}
                            className={`w-3 h-3 rounded-full border-2 transition-all duration-300 ${
                            index === currentSlide
                                ? 'bg-emerald-500 border-emerald-500 scale-125'
                                : index < currentSlide
                                ? 'bg-emerald-500/30 border-emerald-500/30'
                                : 'bg-transparent border-gray-500'
                            }`}
                            style={{
                            marginLeft: '-4px'
                            }}
                        />
                        ))}
                    </div>
                    </div>
                </div>

                {/* Contenu texte fixe */}
                <div className="pl-8">
                    

                    {/* Liste des fonctionnalités cliquables */}
                    <div className="space-y-8">
                    {features.map((feature, index) => (
                        <div
                        key={index}
                        className="flex gap-4 cursor-pointer group"
                        onClick={() => handleFeatureClick(index)}
                        >
                        {/* Ligne verte verticale */}
                        <div className="w-1 bg-emerald-500 flex-shrink-0"></div>
                        
                        {/* Contenu */}
                        <div className="flex-1">
                            <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-emerald-400 transition-colors">
                            {feature.title}
                            </h3>
                            <p className="text-gray-300 leading-relaxed">
                            {feature.description}
                            </p>
                        </div>
                        </div>
                    ))}
                    </div>
                </div>
                </div>
            </div>
        </div>
      
    </SectionContainer>
  );
};
