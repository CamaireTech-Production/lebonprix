// POSTableSelector - Table selection modal for POS
import React from 'react';
import { X, Users } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';
import type { Table } from '../../types/index';

interface POSTableSelectorProps {
  isOpen: boolean;
  tables: Table[];
  selectedTable: Table | null;
  onSelect: (table: Table | null) => void;
  onClose: () => void;
}

const POSTableSelector: React.FC<POSTableSelectorProps> = ({
  isOpen,
  tables,
  selectedTable,
  onSelect,
  onClose,
}) => {
  const { language } = useLanguage();

  if (!isOpen) return null;

  const getStatusColor = (status: Table['status']) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 border-green-500 text-green-700 hover:bg-green-200';
      case 'occupied':
        return 'bg-red-100 border-red-500 text-red-700';
      case 'reserved':
        return 'bg-yellow-100 border-yellow-500 text-yellow-700';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-700';
    }
  };

  const getStatusLabel = (status: Table['status']) => {
    switch (status) {
      case 'available':
        return t('available', language) || 'Available';
      case 'occupied':
        return t('occupied', language) || 'Occupied';
      case 'reserved':
        return t('reserved', language) || 'Reserved';
      default:
        return status;
    }
  };

  // Sort tables by number
  const sortedTables = [...tables].sort((a, b) => a.number - b.number);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {t('pos_select_table', language) || 'Select Table'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {t('pos_select_table_hint', language) || 'Choose a table for this order'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Legend */}
        <div className="px-4 py-2 bg-gray-50 border-b flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded bg-green-100 border border-green-500"></div>
            <span className="text-gray-600">{t('available', language) || 'Available'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded bg-red-100 border border-red-500"></div>
            <span className="text-gray-600">{t('occupied', language) || 'Occupied'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-500"></div>
            <span className="text-gray-600">{t('reserved', language) || 'Reserved'}</span>
          </div>
        </div>

        {/* Tables Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {sortedTables.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <Users size={48} className="mb-4" />
              <p>{t('no_tables', language) || 'No tables available'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {sortedTables.map(table => {
                const isSelected = selectedTable?.id === table.id;
                const isAvailable = table.status === 'available';

                return (
                  <button
                    key={table.id}
                    onClick={() => {
                      if (isAvailable || isSelected) {
                        onSelect(isSelected ? null : table);
                      }
                    }}
                    disabled={!isAvailable && !isSelected}
                    className={`
                      aspect-square rounded-lg border-2 flex flex-col items-center justify-center
                      transition-all relative
                      ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}
                      ${getStatusColor(table.status)}
                      ${!isAvailable && !isSelected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <Users size={20} className="mb-1" />
                    <span className="font-semibold text-lg">{table.number}</span>
                    <span className="text-xs mt-0.5">{getStatusLabel(table.status)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-between items-center bg-gray-50">
          <button
            onClick={() => onSelect(null)}
            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {t('pos_no_table', language) || 'No Table'}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            {selectedTable
              ? `${t('confirm', language) || 'Confirm'} - ${t('table', language) || 'Table'} ${selectedTable.number}`
              : t('close', language) || 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default POSTableSelector;
