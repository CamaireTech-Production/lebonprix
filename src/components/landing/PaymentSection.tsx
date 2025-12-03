import React, { useEffect, useRef, useState } from 'react';
import { SectionContainer } from './SectionContainer';
import { ImageWithSkeleton } from '../common/ImageWithSkeleton';

export const PaymentSection: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1, rootMargin: '-100px' }
    );

    if (imageRef.current) observer.observe(imageRef.current);
    if (contentRef.current) observer.observe(contentRef.current);

    return () => {
      if (imageRef.current) observer.unobserve(imageRef.current);
      if (contentRef.current) observer.unobserve(contentRef.current);
    };
  }, []);

  return (
    <SectionContainer backgroundColor="beige" className="py-20">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        {/* Image */}
        <div
          ref={imageRef}
          className={`relative transition-all duration-600 ${
            isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'
          }`}
        >
          <div className="aspect-[4/3] rounded-lg overflow-hidden">
            <ImageWithSkeleton
              src="/placeholder.png"
              alt="Paiements mobiles"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Content */}
        <div
          ref={contentRef}
          className={`transition-all duration-600 ${
            isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'
          }`}
        >
          <div className="mb-4">
            <span className="text-emerald-400 font-semibold text-sm uppercase tracking-wide">
              Paiements mobiles
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-title font-bold text-black mb-6">
            Accédez à 100M+ de nouveaux clients
          </h2>
          <p className="text-xl text-black/60 mb-8 leading-relaxed">
            Activez CinetPay et accédez à 100M+ d'acheteurs engagés dans le réseau mobile money.
            Développez votre liste de clients tout en alimentant chaque vente avec
            un processeur de paiement de classe mondiale.
          </p>
          <button className="border-2 border-black text-black px-8 py-4 rounded-md font-semibold hover:bg-black hover:text-white transition-all duration-300">
            Découvrir CinetPay
          </button>
        </div>
      </div>
    </SectionContainer>
  );
};
