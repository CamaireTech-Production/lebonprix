import { useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Calendar, User, Building2, Info } from 'lucide-react';
import type { Customer } from '../../types/models';

interface CustomerAdditionalInfoProps {
  customer: Customer;
}

const CustomerAdditionalInfo = ({ customer }: CustomerAdditionalInfoProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Vérifier s'il y a des informations supplémentaires à afficher
  const hasAdditionalInfo = 
    customer.firstName || 
    customer.lastName || 
    customer.address || 
    customer.town || 
    customer.birthdate || 
    customer.howKnown;

  if (!hasAdditionalInfo) {
    return null;
  }

  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
      >
        <span className="flex items-center">
          <Info className="h-4 w-4 mr-2" />
          Informations supplémentaires
        </span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Prénom */}
            {customer.firstName && (
              <div>
                <p className="text-xs font-medium text-gray-500 flex items-center mb-1">
                  <User className="h-3 w-3 mr-1" />
                  Prénom
                </p>
                <p className="text-sm text-gray-900">{customer.firstName}</p>
              </div>
            )}

            {/* Nom de famille */}
            {customer.lastName && (
              <div>
                <p className="text-xs font-medium text-gray-500 flex items-center mb-1">
                  <User className="h-3 w-3 mr-1" />
                  Nom de famille
                </p>
                <p className="text-sm text-gray-900">{customer.lastName}</p>
              </div>
            )}

            {/* Adresse */}
            {customer.address && (
              <div className="md:col-span-2">
                <p className="text-xs font-medium text-gray-500 flex items-center mb-1">
                  <MapPin className="h-3 w-3 mr-1" />
                  Adresse
                </p>
                <p className="text-sm text-gray-900">{customer.address}</p>
              </div>
            )}

            {/* Ville */}
            {customer.town && (
              <div>
                <p className="text-xs font-medium text-gray-500 flex items-center mb-1">
                  <Building2 className="h-3 w-3 mr-1" />
                  Ville
                </p>
                <p className="text-sm text-gray-900">{customer.town}</p>
              </div>
            )}

            {/* Date de naissance */}
            {customer.birthdate && (
              <div>
                <p className="text-xs font-medium text-gray-500 flex items-center mb-1">
                  <Calendar className="h-3 w-3 mr-1" />
                  Date de naissance
                </p>
                <p className="text-sm text-gray-900">
                  {new Date(customer.birthdate).toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            )}

            {/* Comment il a connu l'entreprise */}
            {customer.howKnown && (
              <div className="md:col-span-2">
                <p className="text-xs font-medium text-gray-500 flex items-center mb-1">
                  <Info className="h-3 w-3 mr-1" />
                  Comment il a connu l'entreprise
                </p>
                <p className="text-sm text-gray-900">{customer.howKnown}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerAdditionalInfo;

