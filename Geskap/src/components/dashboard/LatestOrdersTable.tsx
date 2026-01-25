import { useTranslation } from 'react-i18next';
import { useCompanyColors } from '@hooks/business/useCompanyColors';
import Card from '../common/Card';
import { format } from 'date-fns';
import type { Sale } from '../../types/models';

interface LatestOrdersTableProps {
  orders: Sale[];
  onOrderClick?: (order: Sale) => void;
  className?: string;
}

const LatestOrdersTable = ({ orders, onOrderClick, className = '' }: LatestOrdersTableProps) => {
  const { t } = useTranslation();
  const colors = useCompanyColors();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'under_delivery':
        return 'bg-blue-100 text-blue-800';
      case 'commande':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    return t(`orders.status.${status}`, { defaultValue: status });
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp?.seconds) return '-';
    const date = new Date(timestamp.seconds * 1000);
    return format(date, 'dd MMM yyyy à HH:mm');
  };

  return (
    <Card className={className}>
      <h3 className="text-lg font-semibold mb-4" style={{color: colors.primary}}>
        {t('dashboard.latestOrders.title', { defaultValue: 'Dernières commandes' })}
      </h3>
      {orders.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">
          {t('dashboard.latestOrders.noData', { defaultValue: 'Aucune commande récente' })}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                  {t('dashboard.latestOrders.reference', { defaultValue: 'Référence' })}
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                  {t('dashboard.latestOrders.date', { defaultValue: 'Date' })}
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                  {t('dashboard.latestOrders.status', { defaultValue: 'Statut' })}
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                  {t('dashboard.latestOrders.client', { defaultValue: 'Client' })}
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onOrderClick?.(order)}
                >
                  <td className="py-3 px-4 text-sm font-medium text-gray-900">
                    #{order.id.substring(0, 8).toUpperCase()}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {order.customerInfo?.name || t('dashboard.latestOrders.noClient', { defaultValue: 'Aucun client' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

export default LatestOrdersTable;

