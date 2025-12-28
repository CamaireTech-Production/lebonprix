import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Plus } from 'lucide-react';
import { useCustomUnits } from '@hooks/business/useCustomUnits';
import { getAllUnits, type UnifiedUnit } from '@utils/core/getAllUnits';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';

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
  const { customUnits, loading: customUnitsLoading, addCustomUnit } = useCustomUnits();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get all units (standard + custom)
  const allUnits = getAllUnits(customUnits, searchQuery);

  // Get selected unit info
  const selectedUnit = allUnits.find(unit => unit.value === value);

  // Filter units based on search
  const filteredUnits = searchQuery.trim() 
    ? allUnits
    : allUnits.slice(0, 30); // Show first 30 units if no search

  // Check if search query doesn't match any unit (for create option)
  const canCreateUnit = searchQuery.trim() !== '' && 
    filteredUnits.length === 0 &&
    searchQuery.trim().length >= 2;

  // Handle unit selection
  const handleUnitSelect = (unitValue: string) => {
    onChange(unitValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  // Handle create new unit (inline, like categories)
  const handleCreateNew = async () => {
    const unitLabel = searchQuery.trim();
    
    if (!unitLabel || unitLabel.length < 2) return;
    
    // Validation : vérifier si l'unité existe déjà (insensible à la casse)
    const exists = allUnits.some(
      unit => unit.label.toLowerCase() === unitLabel.toLowerCase() ||
              unit.value.toLowerCase() === unitLabel.toLowerCase()
    );
    
    if (exists) {
      showErrorToast('Cette unité existe déjà');
      return;
    }
    
    setIsCreating(true);
    try {
      // Auto-generate value from label
      const normalizedValue = unitLabel
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');

      if (!normalizedValue) {
        showErrorToast('Le nom doit contenir au moins un caractère alphanumérique');
        return;
      }

      const newUnit = await addCustomUnit(normalizedValue, unitLabel);
      
      if (newUnit) {
        // Sélectionner automatiquement la nouvelle unité
        onChange(newUnit.value);
        
        // Fermer le dropdown et réinitialiser
        setIsOpen(false);
        setSearchQuery('');
        
        // Feedback utilisateur
        showSuccessToast(`Unité "${newUnit.label}" créée avec succès`);
      }
    } catch (error: any) {
      console.error('Error creating unit:', error);
      // Error is already handled in addCustomUnit
      // Garder le dropdown ouvert pour permettre une nouvelle tentative
    } finally {
      setIsCreating(false);
    }
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
            {customUnitsLoading ? (
              <div className="p-4 text-center text-gray-500">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mx-auto mb-2"></div>
                Chargement...
              </div>
            ) : filteredUnits.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {searchQuery ? (
                  <div className="space-y-2">
                    <p>Aucune unité trouvée</p>
                    {canCreateUnit && (
                      <button
                        onClick={handleCreateNew}
                        disabled={isCreating}
                        className={`flex items-center space-x-2 text-emerald-600 hover:text-emerald-700 text-sm mx-auto ${
                          isCreating ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {isCreating ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
                            <span>Création...</span>
                          </>
                        ) : (
                          <>
                            <Plus size={16} />
                            <span>Créer "{searchQuery.trim()}"</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <p>Aucune unité disponible</p>
                )}
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
                
                {/* Create new unit option */}
                {canCreateUnit && (
                  <button
                    onClick={handleCreateNew}
                    disabled={isCreating}
                    className={`w-full px-3 py-2 text-left hover:bg-emerald-50 focus:outline-none focus:bg-emerald-50 text-emerald-600 border-t border-gray-200 ${
                      isCreating ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      {isCreating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
                          <span className="text-sm font-medium">Création...</span>
                        </>
                      ) : (
                        <>
                          <Plus size={16} />
                          <span className="text-sm font-medium">Créer "{searchQuery.trim()}"</span>
                        </>
                      )}
                    </div>
                  </button>
                )}
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

