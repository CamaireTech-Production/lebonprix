import React from 'react';

export const PartnersLogosSection: React.FC = () => {
  // Logos des partenaires - à remplacer par de vrais logos plus tard
  const partners = [
    { name: 'Partner 1', logo: '/placeholder.png' },
    { name: 'Partner 2', logo: '/placeholder.png' },
    { name: 'Partner 3', logo: '/placeholder.png' },
    { name: 'Partner 4', logo: '/placeholder.png' },
    { name: 'Partner 5', logo: '/placeholder.png' },
    { name: 'Partner 6', logo: '/placeholder.png' }
  ];

  return (
    <section className="bg-white border-y border-gray-200" style={{ height: '10vh', minHeight: '80px' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex items-center justify-center h-full gap-8 md:gap-12 lg:gap-16">
          {partners.map((partner, index) => (
            <div
              key={index}
              className="flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity duration-300"
            >
              <img
                src={partner.logo}
                alt={partner.name}
                className="h-8 md:h-10 lg:h-12 w-auto object-contain grayscale hover:grayscale-0 transition-all duration-300"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

