import { useTranslation } from 'react-i18next';
import { useCompanyColors } from '@hooks/business/useCompanyColors';
import Card from '../common/Card';
import { ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import type { Sale } from '../../types/models';

interface TopSalesProps {
  sales: Sale[];
  onViewMore?: () => void;
  className?: string;
}

const TopSales = ({ sales, onViewMore, className = '' }: TopSalesProps) => {
  const { t } = useTranslation();
  const colors = useCompanyColors();

  const formatDate = (timestamp: any) => {
    if (!timestamp?.seconds) return '-';
    const date = new Date(timestamp.seconds * 1000);
    return format(date, 'dd MMM yyyy');
  };

  return (
    <Card className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold" style={{color: colors.primary}}>
          {t('dashboard.topSales.title', { defaultValue: 'Meilleures ventes' })}
        </h3>
        {onViewMore && (
          <button
            onClick={onViewMore}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
          >
            {t('dashboard.topSales.viewMore', { defaultValue: 'Voir plus' })}
            <ExternalLink size={14} />
          </button>
        )}
      </div>
      <div className="space-y-3">
        {sales.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            {t('dashboard.topSales.noData', { defaultValue: 'Aucune vente' })}
          </p>
        ) : (
          sales.map((sale, index) => (
            <div key={sale.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {sale.customerInfo?.name || t('dashboard.topSales.noClient', { defaultValue: 'Aucun client' })}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDate(sale.createdAt)}
                </p>
              </div>
              <div className="text-right ml-3">
                <p className="text-sm font-semibold" style={{color: colors.primary}}>
                  {sale.totalAmount.toLocaleString()} FCFA
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};

export default TopSales;

