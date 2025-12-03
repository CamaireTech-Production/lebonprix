import { useMemo, useState } from 'react';
import { useSales } from '../../hooks/useFirestore';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Clock, User, DollarSign, CheckCircle, XCircle} from 'lucide-react';
import type { Sale, OrderStatus, PaymentStatus } from '../../types/models';

interface POSTransactionsSidebarProps {
  onTransactionClick?: (sale: Sale) => void;
  onResumeDraft?: (sale: Sale) => void;
}

export const POSTransactionsSidebar: React.FC<POSTransactionsSidebarProps> = ({
  onTransactionClick,
  onResumeDraft,
}) => {
  const { t } = useTranslation();
  const { sales, loading } = useSales();
  const { user, currentEmployee, isOwner } = useAuth();
  const [showDrafts, setShowDrafts] = useState<boolean>(true);

  // Filter sales by current cashier/employee
  const cashierSales = useMemo(() => {
    if (!sales || sales.length === 0) return [];
    
    // Get current employee/user ID
    const currentUserId = currentEmployee?.firebaseUid || currentEmployee?.id || user?.uid;
    if (!currentUserId) return [];

    // Filter sales created by current cashier
    return sales
      .filter(sale => {
        // Check if sale was created by current employee
        if (sale.createdBy) {
          return sale.createdBy.id === currentUserId;
        }
        // Fallback: check userId (for older sales or owner sales)
        return sale.userId === currentUserId;
      })
      .sort((a, b) => {
        // Sort by createdAt descending (most recent first)
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });
  }, [sales, currentEmployee, user, isOwner]);

  // Separate completed sales and drafts
  const completedSales = useMemo(() => {
    return cashierSales
      .filter(sale => sale.status !== 'draft')
      .slice(0, 15); // Limit to last 15 completed transactions
  }, [cashierSales]);

  const draftSales = useMemo(() => {
    return cashierSales
      .filter(sale => sale.status === 'draft')
      .slice(0, 10); // Limit to last 10 drafts
  }, [cashierSales]);

  const getStatusIcon = (status: OrderStatus, paymentStatus: PaymentStatus) => {
    if (paymentStatus === 'paid') {
      return <CheckCircle size={14} className="text-green-600" />;
    }
    if (paymentStatus === 'cancelled') {
      return <XCircle size={14} className="text-red-600" />;
    }
    return <Clock size={14} className="text-yellow-600" />;
  };

  const getStatusText = (status: OrderStatus, paymentStatus: PaymentStatus) => {
    if (paymentStatus === 'paid') {
      return t('pos.transactions.paid');
    }
    if (paymentStatus === 'cancelled') {
      return t('pos.transactions.cancelled');
    }
    return t('pos.transactions.pending');
  };

  const formatDate = (timestamp: { seconds: number; nanoseconds: number } | undefined) => {
    if (!timestamp) return '';
    const date = new Date(timestamp.seconds * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return t('pos.transactions.justNow');
    if (diffMins < 60) return `${diffMins}${t('pos.transactions.minAgo')}`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}${t('pos.transactions.hourAgo')}`;
    
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="hidden lg:flex lg:w-[15%] bg-white border-r border-gray-200 flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center space-x-2">
          <Clock size={16} />
          <span>{t('pos.transactions.recentTransactions')}</span>
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          {cashierSales.length} {t('pos.transactions.transactions')}
        </p>
      </div>

      {/* Transactions List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-gray-500">{t('common.loading')}</div>
          </div>
        ) : cashierSales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock size={32} className="text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">{t('pos.transactions.noTransactions')}</p>
          </div>
        ) : (
          cashierSales.map((sale) => (
            <button
              key={sale.id}
              onClick={() => onTransactionClick?.(sale)}
              className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors text-left"
            >
              {/* Date and Status */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <Clock size={12} />
                  <span>{formatDate(sale.createdAt)}</span>
                </div>
                <div className="flex items-center space-x-1">
                  {getStatusIcon(sale.status, sale.paymentStatus)}
                  <span className="text-xs text-gray-600">
                    {getStatusText(sale.status, sale.paymentStatus)}
                  </span>
                </div>
              </div>

              {/* Customer Info */}
              <div className="flex items-center space-x-2 mb-2">
                <User size={14} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-700 truncate">
                  {sale.customerInfo?.name || t('pos.transactions.walkIn')}
                </span>
              </div>

              {/* Amount */}
              <div className="flex items-center space-x-2">
                <DollarSign size={14} className="text-emerald-600" />
                <span className="text-sm font-bold text-emerald-600">
                  {sale.totalAmount?.toLocaleString() || 0} XAF
                </span>
              </div>

              {/* Product Count */}
              {sale.products && sale.products.length > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  {sale.products.length} {sale.products.length === 1 ? t('pos.transactions.product') : t('pos.transactions.products')}
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

