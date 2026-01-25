import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../common/Card';
import { ExternalLink } from 'lucide-react';

interface RevenueByStoreProps {
  data: Array<{ store: string; amount: number }>;
  onViewMore?: () => void;
  className?: string;
}

const RevenueByStore = ({ data, onViewMore, className = '' }: RevenueByStoreProps) => {
  const { t } = useTranslation();
  const { company } = useAuth();

  const getCompanyColors = () => {
    return {
      primary: company?.dashboardColors?.primary || company?.primaryColor || '#183524',
    };
  };

  return (
    <Card className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold" style={{color: getCompanyColors().primary}}>
          {t('dashboard.revenueByStore.title', { defaultValue: 'Revenus par magasin' })}
        </h3>
        {onViewMore && (
          <button
            onClick={onViewMore}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
          >
            {t('dashboard.revenueByStore.viewMore', { defaultValue: 'Voir plus' })}
            <ExternalLink size={14} />
          </button>
        )}
      </div>
      <div className="space-y-3">
        {data.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            {t('dashboard.revenueByStore.noData', { defaultValue: 'Aucune donnée' })}
          </p>
        ) : (
          data.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white border-2 border-gray-200">
                  <span className="text-xs font-semibold text-gray-600">
                    {item.store.substring(0, 2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                    {item.store}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold" style={{color: getCompanyColors().primary}}>
                  {item.amount.toLocaleString()} F CFA
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};

export default RevenueByStore;

