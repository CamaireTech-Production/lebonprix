/**
 * PackageSelector Component
 * Allows users to choose between Starter and Enterprise plans during company creation
 */

import React from 'react';
import { Store, Factory, Check, Sparkles } from 'lucide-react';

interface PackageSelectorProps {
    selectedPlan: 'starter' | 'enterprise' | null;
    onSelect: (plan: 'starter' | 'enterprise') => void;
    disabled?: boolean;
}

interface PlanFeature {
    text: string;
    included: boolean;
}

interface Plan {
    id: 'starter' | 'enterprise';
    name: string;
    tagline: string;
    icon: React.ReactNode;
    price: string;
    priceNote: string;
    features: PlanFeature[];
    recommended?: boolean;
}

const plans: Plan[] = [
    {
        id: 'starter',
        name: 'Geskap Starter',
        tagline: 'Pour les petites entreprises et boutiques',
        icon: <Store className="h-8 w-8" />,
        price: '10,000 XAF',
        priceNote: '/mois',
        features: [
            { text: 'Point de Vente (POS)', included: true },
            { text: 'Gestion des Ventes', included: true },
            { text: 'Commandes clients', included: true },
            { text: 'Catalogue en ligne', included: true },
            { text: 'Produits & Stock (1 boutique)', included: true },
            { text: 'Dépenses & Contacts', included: true },
            { text: 'Permissions & Invitations', included: true },
            { text: 'Rapports de base', included: true },
            { text: 'Multi-boutiques', included: false },
            { text: 'Production & Matières premières', included: false },
            { text: 'Gestion RH', included: false }
        ]
    },
    {
        id: 'enterprise',
        name: 'Geskap Enterprise',
        tagline: 'Pour les grandes entreprises et usines',
        icon: <Factory className="h-8 w-8" />,
        price: '100,000 XAF',
        priceNote: '/mois',
        recommended: true,
        features: [
            { text: 'Tout de Starter, plus:', included: true },
            { text: 'Multi-boutiques & Entrepôts', included: true },
            { text: 'Transferts de stock', included: true },
            { text: 'Production & Manufacturing', included: true },
            { text: 'Matières premières (Magasin)', included: true },
            { text: 'Gestion des Ressources Humaines', included: true },
            { text: 'Rapports financiers détaillés', included: true },
            { text: 'Support prioritaire', included: true },
            { text: 'API Access (bientôt)', included: true }
        ]
    }
];

export const PackageSelector: React.FC<PackageSelectorProps> = ({
    selectedPlan,
    onSelect,
    disabled = false
}) => {
    return (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Choisissez votre plan
                </h2>
                <p className="text-gray-600">
                    Sélectionnez le plan qui correspond à vos besoins. Vous pouvez changer plus tard.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {plans.map((plan) => {
                    const isSelected = selectedPlan === plan.id;

                    return (
                        <button
                            key={plan.id}
                            type="button"
                            onClick={() => onSelect(plan.id)}
                            disabled={disabled}
                            className={`
                relative flex flex-col p-6 rounded-2xl border-2 transition-all duration-200 text-left
                ${isSelected
                                    ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-600 ring-offset-2'
                                    : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-lg'
                                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
                        >
                            {/* Recommended Badge */}
                            {plan.recommended && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg">
                                        <Sparkles className="h-3 w-3" />
                                        Recommandé
                                    </span>
                                </div>
                            )}

                            {/* Selected Indicator */}
                            {isSelected && (
                                <div className="absolute top-4 right-4">
                                    <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center">
                                        <Check className="h-4 w-4 text-white" />
                                    </div>
                                </div>
                            )}

                            {/* Plan Header */}
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                    {plan.icon}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                                    <p className="text-sm text-gray-500">{plan.tagline}</p>
                                </div>
                            </div>

                            {/* Features */}
                            <ul className="space-y-2 flex-grow">
                                {plan.features.map((feature, index) => (
                                    <li key={index} className="flex items-start gap-2">
                                        <span className={`flex-shrink-0 mt-0.5 ${feature.included ? 'text-green-500' : 'text-gray-300'}`}>
                                            {feature.included ? (
                                                <Check className="h-4 w-4" />
                                            ) : (
                                                <span className="block w-4 h-4 text-center">—</span>
                                            )}
                                        </span>
                                        <span className={`text-sm ${feature.included ? 'text-gray-700' : 'text-gray-400'}`}>
                                            {feature.text}
                                        </span>
                                    </li>
                                ))}
                            </ul>

                            {/* CTA Text */}
                            <div className="mt-6 pt-4 border-t border-gray-100">
                                <span className={`text-sm font-medium ${isSelected ? 'text-indigo-600' : 'text-gray-500'}`}>
                                    {isSelected ? '✓ Sélectionné' : 'Cliquez pour sélectionner'}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Trial Note */}
            <p className="text-center text-sm text-gray-500 mt-4">
                🎁 Commencez avec une période d'essai gratuite. Pas de carte de crédit requise.
            </p>
        </div>
    );
};

export default PackageSelector;
