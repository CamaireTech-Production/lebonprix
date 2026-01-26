import { ArrowLeft, Clock, X, CreditCard } from 'lucide-react';
import { useAuth } from '@contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';

interface POSHeaderProps {
  companyName: string;
  shops?: Array<{ id: string; name: string; isDefault?: boolean }>;
  selectedShopId?: string;
  onShopChange?: (shopId: string) => void;
  creditSalesCount?: number;
}

export const POSHeader: React.FC<POSHeaderProps> = ({ companyName, shops, selectedShopId, onShopChange, creditSalesCount = 0 }) => {
  const { user, currentEmployee, isOwner, company } = useAuth();
  const navigate = useNavigate();
  const { companyId } = useParams<{ companyId: string }>();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Get company colors with fallbacks - prioritize dashboard colors
  const getCompanyColors = () => {
    const colors = {
      primary: company?.dashboardColors?.primary || company?.primaryColor || '#183524',
      secondary: company?.dashboardColors?.secondary || company?.secondaryColor || '#e2b069',
      tertiary: company?.dashboardColors?.tertiary || company?.tertiaryColor || '#2a4a3a',
      headerText: company?.dashboardColors?.headerText || '#ffffff'
    };
    return colors;
  };

  const colors = getCompanyColors();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const cashierName = currentEmployee
    ? currentEmployee.username
    : isOwner && user
    ? `${user.displayName || user.email || 'Owner'}`
    : 'Unknown';

  const handleBackToDashboard = () => {
    if (companyId) {
      navigate(`/company/${companyId}/dashboard`);
    }
  };

  const handleCreditSalesClick = () => {
    if (companyId) {
      navigate(`/company/${companyId}/sales?status=credit`);
    }
  };

  return (
    <div 
      className="h-16 text-white flex items-center justify-between px-6 shadow-md"
      style={{ backgroundColor: colors.primary }}
    >
      <div className="flex items-center space-x-6">
        <button
          onClick={handleBackToDashboard}
          className="flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors hover:opacity-90"
          style={{ 
            backgroundColor: colors.tertiary,
            color: colors.headerText
          }}
          title="Back to Dashboard"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <h1 className="text-xl font-bold flex items-center space-x-3" style={{ color: colors.headerText }}>
          {company?.logo && (
            <img 
              src={company.logo} 
              alt={`${company.name} Logo`}
              className="h-8 w-8 object-contain rounded"
            />
          )}
          <span>{companyName}</span>
        </h1>
        <div className="flex items-center space-x-2 text-sm" style={{ color: colors.headerText }}>
          <span className="opacity-90">Cashier:</span>
          <span className="font-semibold">{cashierName}</span>
        </div>
        {/* Shop Selector */}
        {shops && shops.length > 1 && (
          <div className="flex items-center space-x-2">
            <span className="text-sm opacity-90" style={{ color: colors.headerText }}>Magasin:</span>
            <select
              value={selectedShopId || ''}
              onChange={(e) => {
                if (onShopChange && e.target.value) {
                  onShopChange(e.target.value);
                }
              }}
              className="px-3 py-1 rounded-md text-sm font-medium border-0 focus:outline-none focus:ring-2 focus:ring-white/50"
              style={{ 
                backgroundColor: colors.tertiary,
                color: colors.headerText
              }}
            >
              {shops.map(shop => (
                <option key={shop.id} value={shop.id} style={{ backgroundColor: colors.primary }}>
                  {shop.name} {shop.isDefault && '(Par défaut)'}
                </option>
              ))}
            </select>
          </div>
        )}
        {shops && shops.length === 1 && selectedShopId && (
          <div className="flex items-center space-x-2 text-sm" style={{ color: colors.headerText }}>
            <span className="opacity-90">Magasin:</span>
            <span className="font-semibold">{shops[0].name}</span>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-6">
        {/* Credit Sales Counter */}
        {creditSalesCount > 0 && (
          <button
            onClick={handleCreditSalesClick}
            className="relative flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors hover:opacity-90"
            style={{ 
              backgroundColor: colors.tertiary,
              color: colors.headerText
            }}
            title="View Credit Sales"
          >
            <CreditCard size={16} />
            <span className="text-sm font-medium">Credit</span>
            <span 
              className="px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ 
                backgroundColor: '#f97316',
                color: 'white'
              }}
            >
              {creditSalesCount}
            </span>
          </button>
        )}
        <div className="flex items-center space-x-2 text-sm" style={{ color: colors.headerText }}>
          <Clock size={16} />
          <span>{currentTime.toLocaleTimeString()}</span>
        </div>
        <button
          onClick={handleBackToDashboard}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors hover:opacity-90"
          style={{ 
            backgroundColor: colors.tertiary,
            color: colors.headerText
          }}
          title="Exit POS"
        >
          <X size={16} />
          <span>Exit POS</span>
        </button>
      </div>
    </div>
  );
};

