import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { UNITS, searchUnits, type Unit } from '@utils/core/units';

interface UnitSelectorProps {
  value: string;
  onChange: (unit: string) => void;
  placeholder?: string;
  className?: string;
}

const UnitSelector: React.FC<UnitSelectorProps> = ({
  value,
  onChange,
  placeholder = "Sélectionner une unité",
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get selected unit info
  const selectedUnit = UNITS.find(unit => unit.value === value);

  // Filter units based on search
  const filteredUnits = searchQuery.trim() 
    ? searchUnits(searchQuery)
    : UNITS.slice(0, 20); // Show first 20 units if no search

  // Handle unit selection
  const handleUnitSelect = (unitValue: string) => {
    onChange(unitValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
      >
        <div className="flex items-center justify-between">
          <span className={`${selectedUnit ? 'text-gray-900' : 'text-gray-500'} truncate`}>
            {selectedUnit ? `${selectedUnit.label} (${selectedUnit.value})` : placeholder}
          </span>
          
          <ChevronDown 
            size={20} 
            className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div 
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-hidden"
        >
          {/* Search Input */}
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Rechercher une unité..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                autoFocus
              />
            </div>
          </div>

          {/* Units List */}
          <div className="max-h-60 overflow-y-auto">
            {filteredUnits.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <p>Aucune unité trouvée</p>
              </div>
            ) : (
              <div className="py-1">
                {filteredUnits.map((unit) => (
                  <button
                    key={unit.value}
                    onClick={() => handleUnitSelect(unit.value)}
                    className={`w-full px-3 py-2 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 ${
                      value === unit.value ? 'bg-emerald-50 text-emerald-700' : 'text-gray-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">
                          {unit.label}
                        </div>
                        <div className="text-xs text-gray-500">
                          {unit.value}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default UnitSelector;

