/**
 * Composant d'autocomplétion pour les lieux géographiques du Cameroun
 * Utilise react-select avec mode creatable pour permettre la saisie libre
 */

import React, { useState, useEffect } from 'react';
import Select, { components, MenuProps, GroupBase, OptionProps } from 'react-select';
import { useLocationSearch, type LocationOption } from '../../hooks/business/useLocationSearch';

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({
  value,
  onChange,
  placeholder = 'Quarter (optional)',
  className = '',
  disabled = false,
}) => {
  const { locations, loading, searchLocations, getLocationByValue, isInitialized } = useLocationSearch();
  const [inputValue, setInputValue] = useState('');
  const [selectedOption, setSelectedOption] = useState<LocationOption | null>(null);

  // Initialiser la valeur sélectionnée si value est fourni
  useEffect(() => {
    if (value && isInitialized) {
      const option = getLocationByValue(value);
      if (option) {
        // Option trouvée dans les données géographiques
        setSelectedOption(option);
      } else {
        // Option non trouvée : créer une option personnalisée
        // Cela permet d'afficher les quartiers des contacts même s'ils ne sont pas dans les données
        setSelectedOption({
          value: value,
          label: value,
        });
      }
    } else if (!value) {
      setSelectedOption(null);
    }
  }, [value, isInitialized, getLocationByValue]);

  // Rechercher quand l'utilisateur tape
  useEffect(() => {
    if (inputValue && isInitialized) {
      searchLocations(inputValue);
    }
  }, [inputValue, isInitialized, searchLocations]);

  // Gérer le changement de sélection
  const handleChange = (newValue: LocationOption | null) => {
    setSelectedOption(newValue);
    onChange(newValue?.value || '');
  };

  // Gérer la création d'une nouvelle option (saisie libre)
  const handleCreateOption = (inputValue: string) => {
    if (!inputValue.trim()) return;
    
    const newOption: LocationOption = {
      value: inputValue.trim(),
      label: inputValue.trim(),
    };
    
    setSelectedOption(newOption);
    onChange(inputValue.trim());
  };

  // Format personnalisé pour afficher le nom, la région et le département
  const formatOptionLabel = ({ label, region, department }: LocationOption) => {
    return (
      <div className="flex flex-col">
        <span className="font-medium text-gray-900">{label}</span>
        {(region || department) && (
          <div className="flex flex-col gap-0.5 mt-0.5">
            {region && (
              <span className="text-xs text-gray-500">{region}</span>
            )}
            {department && (
              <span className="text-xs text-gray-400">{department}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  // Composant personnalisé pour le menu avec option de création
  const CustomMenu = (props: MenuProps<LocationOption, false, GroupBase<LocationOption>>) => {
    const { children, ...rest } = props;

    const handleCreateClick = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (inputValue.trim()) {
        handleCreateOption(inputValue);
      }
    };

    const hasExactMatch = locations.some(
      (opt) => opt.label.toLowerCase() === inputValue.toLowerCase()
    );

    return (
      <components.Menu {...rest}>
        {children}
        {inputValue.trim() && !hasExactMatch && (
          <div
            role="button"
            tabIndex={0}
            className="w-full py-3 px-4 border-t border-gray-200 text-sm text-gray-600 flex items-center cursor-pointer bg-gray-50 hover:bg-gray-100 active:bg-gray-200 transition-colors"
            onClick={handleCreateClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCreateOption(inputValue);
              }
            }}
          >
            <span className="font-medium">Utiliser "{inputValue}"</span>
          </div>
        )}
      </components.Menu>
    );
  };

  // Option personnalisée pour le style
  const CustomOption = (props: OptionProps<LocationOption, false>) => {
    const { data, innerRef, innerProps } = props;
    return (
      <div
        ref={innerRef}
        {...innerProps}
        className="px-3 py-2 hover:bg-emerald-50 cursor-pointer"
      >
        {formatOptionLabel(data)}
      </div>
    );
  };

  // Si les données ne sont pas encore initialisées, afficher un input simple en fallback
  if (!isInitialized && !loading) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${className}`}
      />
    );
  }

  return (
    <Select<LocationOption>
      components={{ 
        Menu: CustomMenu,
        Option: CustomOption,
      }}
      value={selectedOption}
      onChange={handleChange}
      options={locations}
      inputValue={inputValue}
      onInputChange={setInputValue}
      formatOptionLabel={formatOptionLabel}
      placeholder={placeholder}
      className={`react-select-container ${className}`}
      classNamePrefix="react-select"
      isClearable
      isSearchable
      isLoading={loading}
      isDisabled={disabled}
      menuPlacement="auto"
      menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
      noOptionsMessage={({ inputValue }) => 
        inputValue ? `Aucun lieu trouvé pour "${inputValue}"` : 'Tapez pour rechercher un lieu...'
      }
      loadingMessage={() => 'Chargement des lieux...'}
      onKeyDown={(e) => {
        // Permettre la création avec Enter si l'utilisateur a tapé quelque chose
        // Même s'il y a des résultats, l'utilisateur peut vouloir utiliser sa propre valeur
        if (e.key === 'Enter' && inputValue.trim()) {
          // Vérifier si la valeur exacte existe déjà dans les résultats
          const exactMatch = locations.find(
            (opt) => opt.label.toLowerCase() === inputValue.trim().toLowerCase()
          );
          
          // Si pas de correspondance exacte, créer une nouvelle option
          if (!exactMatch) {
            e.preventDefault();
            e.stopPropagation();
            handleCreateOption(inputValue);
          }
        }
      }}
      filterOption={() => true} // Désactiver le filtrage par défaut, on utilise notre recherche
      styles={{
        menu: (base) => ({
          ...base,
          zIndex: 99999, // Au-dessus des modals
        }),
        menuPortal: (base) => ({
          ...base,
          zIndex: 99999,
        }),
        control: (base) => ({
          ...base,
          minHeight: '42px',
        }),
      }}
    />
  );
};

export default LocationAutocomplete;

