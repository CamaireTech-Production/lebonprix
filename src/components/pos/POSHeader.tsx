import { ArrowLeft, Clock, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { formatCreatorName } from '../../utils/employeeUtils';
import { useState, useEffect } from 'react';

interface POSHeaderProps {
  companyName: string;
}

export const POSHeader: React.FC<POSHeaderProps> = ({ companyName }) => {
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
    ? `${currentEmployee.firstname} ${currentEmployee.lastname}`
    : isOwner && user
    ? formatCreatorName(user)
    : 'Unknown';

  const handleBackToDashboard = () => {
    if (companyId) {
      navigate(`/company/${companyId}/dashboard`);
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
        <h1 className="text-xl font-bold" style={{ color: colors.headerText }}>{companyName}</h1>
        <div className="flex items-center space-x-2 text-sm" style={{ color: colors.headerText }}>
          <span className="opacity-90">Cashier:</span>
          <span className="font-semibold">{cashierName}</span>
        </div>
      </div>

      <div className="flex items-center space-x-6">
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

