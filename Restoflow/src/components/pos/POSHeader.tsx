// POSHeader - Header component for POS screen
import React from 'react';
import { ArrowLeft, Clock, MapPin, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';
import type { Table } from '../../types/index';
import type { POSOrderType } from '../../types/pos';

interface POSHeaderProps {
  selectedTable: Table | null;
  orderType: POSOrderType;
  onTableClick: () => void;
  onOrderTypeChange: (type: POSOrderType) => void;
}

const POSHeader: React.FC<POSHeaderProps> = ({
  selectedTable,
  orderType,
  onTableClick,
  onOrderTypeChange,
}) => {
  const navigate = useNavigate();
  const { restaurant } = useAuth();
  const { language } = useLanguage();
  const [currentTime, setCurrentTime] = React.useState(new Date());

  // Update time every minute
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const orderTypes: { value: POSOrderType; label: string; icon: React.ReactNode }[] = [
    { value: 'dine-in', label: t('pos_dine_in', language) || 'Dine-in', icon: <Users size={16} /> },
    { value: 'takeaway', label: t('pos_takeaway', language) || 'Takeaway', icon: <MapPin size={16} /> },
    { value: 'delivery', label: t('pos_delivery', language) || 'Delivery', icon: <MapPin size={16} /> },
  ];

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left side - Back button and restaurant info */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={t('back_to_dashboard', language) || 'Back to Dashboard'}
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>

          <div className="flex items-center space-x-3">
            {restaurant?.logo && (
              <img
                src={restaurant.logo}
                alt={restaurant.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            )}
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {t('pos', language) || 'Point of Sale'}
              </h1>
              <p className="text-sm text-gray-500">{restaurant?.name}</p>
            </div>
          </div>
        </div>

        {/* Center - Order type selector */}
        <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
          {orderTypes.map(type => (
            <button
              key={type.value}
              onClick={() => onOrderTypeChange(type.value)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                orderType === type.value
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              {type.icon}
              <span>{type.label}</span>
            </button>
          ))}
        </div>

        {/* Right side - Table selector and time */}
        <div className="flex items-center space-x-4">
          {/* Table selector (only for dine-in) */}
          {orderType === 'dine-in' && (
            <button
              onClick={onTableClick}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
                selectedTable
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-300 text-gray-600 hover:border-primary hover:bg-gray-50'
              }`}
            >
              <Users size={18} />
              <span className="font-medium">
                {selectedTable
                  ? `${t('table', language) || 'Table'} ${selectedTable.number}`
                  : t('pos_select_table', language) || 'Select Table'}
              </span>
            </button>
          )}

          {/* Current time */}
          <div className="flex items-center space-x-2 text-gray-600">
            <Clock size={18} />
            <span className="font-medium">{formatTime(currentTime)}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default POSHeader;
