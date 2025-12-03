import { Search, ScanLine } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import BarcodeScanner from '../products/BarcodeScanner';

interface POSProductSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  onBarcodeScan: (productId: string) => void;
  companyId: string;
  companyName: string;
}

export const POSProductSearch: React.FC<POSProductSearchProps> = ({
  searchQuery,
  onSearchChange,
  searchInputRef,
  onBarcodeScan,
  companyId,
  companyName,
}) => {
  const { t } = useTranslation();
  const [showScanner, setShowScanner] = useState(false);

  const handleProductFound = (productId: string) => {
    onBarcodeScan(productId);
    setShowScanner(false);
  };

  return (
    <>
      <div className="flex items-center space-x-2 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('pos.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-lg"
            autoFocus
          />
        </div>
        <button
          onClick={() => setShowScanner(true)}
          className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <ScanLine size={20} />
          <span>Scan</span>
        </button>
      </div>

      {showScanner && (
        <BarcodeScanner
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          companyName={companyName}
          companyId={companyId}
          onProductFound={handleProductFound}
        />
      )}
    </>
  );
};

