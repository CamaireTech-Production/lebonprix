import React from 'react';
import { Link } from 'react-router-dom';

export const LandingFooter: React.FC = () => {
  const footerSections = [
    {
      title: 'Geskap',
      links: [
        { label: 'Qu\'est-ce que Geskap ?', href: '#why-geskap' },
        { label: 'Geskap Editions', href: '#' },
        { label: 'Carrières', href: '#' },
        { label: 'Investisseurs', href: '#' },
        { label: 'Actualités', href: '#' },
        { label: 'Durabilité', href: '#' }
      ]
    },
    {
      title: 'Écosystème',
      links: [
        { label: 'Documentation développeur', href: '#' },
        { label: 'Boutique de thèmes', href: '#' },
        { label: 'Boutique d\'applications', href: '#' },
        { label: 'Partenaires', href: '#' },
        { label: 'Affiliation', href: '#' }
      ]
    },
    {
      title: 'Ressources',
      links: [
        { label: 'Blog', href: '#' },
        { label: 'Comparer Geskap', href: '#' },
        { label: 'Guides', href: '#' },
        { label: 'Cours', href: '#' },
        { label: 'Outils gratuits', href: '#' },
        { label: 'Changelog', href: '#' }
      ]
    },
    {
      title: 'Support',
      links: [
        { label: 'Centre d\'aide Geskap', href: '#' },
        { label: 'Forum communautaire', href: '#' },
        { label: 'Engager un partenaire', href: '#' },
        { label: 'Statut du service', href: '#' }
      ]
    },
    {
      title: 'Légal',
      links: [
        { label: 'Conditions d\'utilisation', href: '#' },
        { label: 'Mentions légales', href: '#' },
        { label: 'Politique de confidentialité', href: '#' },
        { label: 'Plan du site', href: '#' },
        { label: 'Choix de confidentialité', href: '#' }
      ]
    }
  ];

  return (
    <footer className="bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 mb-8">
          {footerSections.map((section, index) => (
            <div key={index}>
              <h3 className="font-semibold mb-4">{section.title}</h3>
              <ul className="space-y-2">
                {section.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <a
                      href={link.href}
                      className="text-gray-300 hover:text-white text-sm transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-700 pt-8 mt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-gray-300 text-sm">Cameroun | Français</span>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-300">
              <span>© 2024 Geskap. Tous droits réservés.</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

