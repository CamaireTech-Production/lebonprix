import { useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Calendar, User, Building2, Info } from 'lucide-react';
import type { Customer } from '../../types/geskap';

interface CustomerAdditionalInfoProps {
  customer: Customer;
}

const CustomerAdditionalInfo = ({ customer }: CustomerAdditionalInfoProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

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
          Additional Information
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
            {customer.firstName && (
              <div>
                <p className="text-xs font-medium text-gray-500 flex items-center mb-1">
                  <User className="h-3 w-3 mr-1" />
                  First Name
                </p>
                <p className="text-sm text-gray-900">{customer.firstName}</p>
              </div>
            )}

            {customer.lastName && (
              <div>
                <p className="text-xs font-medium text-gray-500 flex items-center mb-1">
                  <User className="h-3 w-3 mr-1" />
                  Last Name
                </p>
                <p className="text-sm text-gray-900">{customer.lastName}</p>
              </div>
            )}

            {customer.address && (
              <div className="md:col-span-2">
                <p className="text-xs font-medium text-gray-500 flex items-center mb-1">
                  <MapPin className="h-3 w-3 mr-1" />
                  Address
                </p>
                <p className="text-sm text-gray-900">{customer.address}</p>
              </div>
            )}

            {customer.town && (
              <div>
                <p className="text-xs font-medium text-gray-500 flex items-center mb-1">
                  <Building2 className="h-3 w-3 mr-1" />
                  City
                </p>
                <p className="text-sm text-gray-900">{customer.town}</p>
              </div>
            )}

            {customer.birthdate && (
              <div>
                <p className="text-xs font-medium text-gray-500 flex items-center mb-1">
                  <Calendar className="h-3 w-3 mr-1" />
                  Birthday
                </p>
                <p className="text-sm text-gray-900">
                  {new Date(customer.birthdate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            )}

            {customer.howKnown && (
              <div className="md:col-span-2">
                <p className="text-xs font-medium text-gray-500 flex items-center mb-1">
                  <Info className="h-3 w-3 mr-1" />
                  How they found us
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
