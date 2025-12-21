import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../common/Card';
import { ExternalLink } from 'lucide-react';

interface BestClient {
  initials: string;
  name: string;
  orders: number;
  totalSpent: number;
}

interface BestClientsProps {
  clients: BestClient[];
  onViewMore?: () => void;
  className?: string;
}

const BestClients = ({ clients, onViewMore, className = '' }: BestClientsProps) => {
  const { t } = useTranslation();
  const { company } = useAuth();

  const getCompanyColors = () => {
    return {
      primary: company?.dashboardColors?.primary || company?.primaryColor || '#183524',
    };
  };

  const getInitialsColor = (initials: string) => {
    const colors = [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
      '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#A855F7'
    ];
    const index = initials.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <Card className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold" style={{color: getCompanyColors().primary}}>
          {t('dashboard.bestClients.title', { defaultValue: 'Meilleurs clients' })}
        </h3>
        {onViewMore && (
          <button
            onClick={onViewMore}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
          >
            {t('dashboard.bestClients.viewMore', { defaultValue: 'Voir plus' })}
            <ExternalLink size={14} />
          </button>
        )}
      </div>
      <div className="space-y-3">
        {clients.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            {t('dashboard.bestClients.noData', { defaultValue: 'Aucun client' })}
          </p>
        ) : (
          clients.map((client, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                  style={{ backgroundColor: getInitialsColor(client.initials) }}
                >
                  {client.initials}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                    {client.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {client.orders} {t('dashboard.bestClients.orders', { defaultValue: 'Commandes' })}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold" style={{color: getCompanyColors().primary}}>
                  {client.totalSpent.toLocaleString()} FCFA
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};

export default BestClients;

