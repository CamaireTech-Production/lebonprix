import React from 'react';
import { Check, List } from 'lucide-react';
import { ReportField } from '../../types/reports';

interface FieldSelectorProps {
  fields: ReportField[];
  selectedFields: string[];
  onChange: (selectedKeys: string[]) => void;
  label?: string;
  className?: string;
}

const FieldSelector: React.FC<FieldSelectorProps> = ({
  fields,
  selectedFields,
  onChange,
  label = 'Champs à inclure',
  className = ''
}) => {
  const handleToggleField = (fieldKey: string) => {
    if (selectedFields.includes(fieldKey)) {
      onChange(selectedFields.filter(key => key !== fieldKey));
    } else {
      onChange([...selectedFields, fieldKey]);
    }
  };

  const handleSelectAll = () => {
    onChange(fields.map(f => f.key));
  };

  const handleDeselectAll = () => {
    onChange([]);
  };

  const allSelected = selectedFields.length === fields.length;
  const noneSelected = selectedFields.length === 0;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>

        <div className="flex gap-2">
          <button
            onClick={handleSelectAll}
            disabled={allSelected}
            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Tout sélectionner
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={handleDeselectAll}
            disabled={noneSelected}
            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Tout désélectionner
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto
                    border border-gray-200 rounded-md p-3 bg-white">
        {fields.map(field => (
          <label
            key={field.key}
            className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <input
              type="checkbox"
              checked={selectedFields.includes(field.key)}
              onChange={() => handleToggleField(field.key)}
              className="w-4 h-4 text-emerald-600 border-gray-300 rounded
                       focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            />
            <span className="text-sm text-gray-700">
              {field.label}
            </span>
          </label>
        ))}
      </div>

      <p className="text-xs text-gray-500">
        {selectedFields.length} champ(s) sélectionné(s)
      </p>
    </div>
  );
};

export default FieldSelector;
