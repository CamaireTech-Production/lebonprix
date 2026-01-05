import React, { useMemo, useState } from 'react';
import { useSales } from '@hooks/data/useFirestore';
import { useAuth } from '@contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Clock, User, DollarSign, CheckCircle, XCircle, ChevronDown, ChevronUp, Trash2, FileText } from 'lucide-react';
import { Modal, ModalFooter } from '@components/common';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import type { Sale, OrderStatus, PaymentStatus } from '../../types/models';
import type { POSDraft } from '@utils/pos/posDraftStorage';

interface POSTransactionsSidebarProps {
  onTransactionClick?: (sale: Sale) => void;
  onResumeDraft?: (draft: POSDraft) => void;
  onDeleteDraft?: (draftId: string) => boolean;
  drafts?: POSDraft[];
}

export const POSTransactionsSidebar: React.FC<POSTransactionsSidebarProps> = ({
  onTransactionClick,
  onResumeDraft,
  onDeleteDraft,
  drafts = [],
}) => {
  const { t } = useTranslation();
  const { sales, loading } = useSales();
  const { user, currentEmployee, isOwner } = useAuth();
  const [showRecentTransactions, setShowRecentTransactions] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [draftToDelete, setDraftToDelete] = useState<POSDraft | null>(null);

  // Filter sales by current cashier/employee
  const cashierSales = useMemo(() => {
    if (!sales || sales.length === 0) return [];
    
    // Get all possible IDs for current user/employee
    // This handles cases where firebaseUid, id, or user.uid might be used
    const possibleUserIds = new Set<string>();
    if (currentEmployee?.firebaseUid) possibleUserIds.add(currentEmployee.firebaseUid);
    if (currentEmployee?.id) possibleUserIds.add(currentEmployee.id);
    if (user?.uid) possibleUserIds.add(user.uid);
    
    if (possibleUserIds.size === 0) return [];

    // Filter sales created by current cashier
    return sales
      .filter(sale => {
        // Check if sale was created by current employee
        if (sale.createdBy) {
          // Match if createdBy.id matches any of the possible user IDs
          return possibleUserIds.has(sale.createdBy.id);
        }
        // Fallback: check userId (for older sales or owner sales)
        return sale.userId && possibleUserIds.has(sale.userId);
      })
      .sort((a, b) => {
        // Sort by createdAt descending (most recent first)
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });
  }, [sales, currentEmployee, user, isOwner]);

  // Filter completed sales (exclude drafts)
  const completedSales = useMemo(() => {
    return cashierSales
      .filter(sale => sale.status !== 'draft')
      .slice(0, 15); // Limit to last 15 completed transactions
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

  const formatDraftDate = (timestamp: number) => {
    const date = new Date(timestamp);
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

  const handleDeleteDraft = (e: React.MouseEvent, draft: POSDraft) => {
    e.stopPropagation();
    setDraftToDelete(draft);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = () => {
    if (draftToDelete && onDeleteDraft) {
      const success = onDeleteDraft(draftToDelete.id);
      if (success) {
        showSuccessToast(t('pos.transactions.draftDeleted') || 'Draft deleted successfully');
      } else {
        showErrorToast(t('pos.transactions.draftDeleteError') || 'Failed to delete draft');
      }
    }
    setShowDeleteModal(false);
    setDraftToDelete(null);
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setDraftToDelete(null);
  };

  return (
    <div className="hidden lg:flex lg:w-[15%] bg-white border-r border-gray-200 flex-col overflow-hidden relative">
      {/* Drafts Section - Always visible, takes available space */}
      <div className="flex-1 flex flex-col min-h-0" style={{ paddingBottom: '60px' }}>
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center space-x-2">
            <FileText size={16} />
            <span>{t('pos.transactions.drafts')}</span>
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {drafts.length} {drafts.length === 1 ? t('pos.transactions.draft') : t('pos.transactions.drafts')}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {drafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText size={32} className="text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">{t('pos.transactions.noDrafts')}</p>
            </div>
          ) : (
            drafts.map((draft) => (
              <div
                key={draft.id}
                className="w-full p-3 bg-yellow-50 hover:bg-yellow-100 rounded-lg border-2 border-dashed border-yellow-300 transition-colors"
              >
                {/* Date and Actions */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <Clock size={12} />
                    <span>{formatDraftDate(draft.updatedAt)}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => handleDeleteDraft(e, draft)}
                      className="p-1 hover:bg-red-100 rounded text-red-600 transition-colors"
                      title={t('pos.transactions.deleteDraft') || 'Delete draft'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="flex items-center space-x-2 mb-2">
                  <User size={14} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 truncate">
                    {draft.customer?.name || t('pos.transactions.walkIn')}
                  </span>
                </div>

                {/* Amount */}
                <div className="flex items-center space-x-2 mb-2">
                  <DollarSign size={14} className="text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-600">
                    {draft.total?.toLocaleString() || 0} XAF
                  </span>
                </div>

                {/* Product Count */}
                {draft.cart && draft.cart.length > 0 && (
                  <div className="text-xs text-gray-500 mb-2">
                    {draft.cart.length} {draft.cart.length === 1 ? t('pos.transactions.product') : t('pos.transactions.products')}
                  </div>
                )}

                {/* Resume Button */}
                <button
                  onClick={() => onResumeDraft?.(draft)}
                  className="w-full mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
                >
                  {t('pos.transactions.resumeDraft')}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Transactions Section - Fixed at bottom, expands upward */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex flex-col-reverse">
        {/* Button - Always visible at bottom */}
        <button
          onClick={() => setShowRecentTransactions(!showRecentTransactions)}
          className="w-full p-4 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between flex-shrink-0"
        >
          <div className="flex items-center space-x-2">
            <Clock size={16} />
            <span className="text-sm font-semibold text-gray-700">
              {t('pos.transactions.recentTransactions')}
            </span>
            {completedSales.length > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {completedSales.length}
              </span>
            )}
          </div>
          {showRecentTransactions ? (
            <ChevronUp size={16} className="text-gray-500" />
          ) : (
            <ChevronDown size={16} className="text-gray-500" />
          )}
        </button>

        {/* Content - Expands upward when visible */}
        {showRecentTransactions && (
          <div 
            className="overflow-y-auto p-2 space-y-2 border-b border-gray-200"
            style={{ 
              maxHeight: '50vh',
            }}
          >
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-gray-500">{t('common.loading')}</div>
              </div>
            ) : completedSales.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock size={32} className="text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">{t('pos.transactions.noTransactions')}</p>
              </div>
            ) : (
              completedSales.map((sale) => (
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
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={handleDeleteCancel}
        title={t('pos.transactions.deleteDraft') || 'Delete Draft'}
        footer={
          <ModalFooter
            onCancel={handleDeleteCancel}
            onConfirm={handleDeleteConfirm}
            confirmText={t('common.delete') || 'Delete'}
            cancelText={t('common.cancel') || 'Cancel'}
            isDanger
          />
        }
      >
        <div className="text-center py-4">
          <p className="text-gray-600 mb-4">
            {t('pos.transactions.confirmDeleteDraft') || 'Are you sure you want to delete this draft?'}
          </p>
          {draftToDelete && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left">
              <p className="text-sm font-medium text-gray-700 mb-2">
                {t('pos.transactions.customer') || 'Customer'}: {draftToDelete.customer?.name || t('pos.transactions.walkIn') || 'Walk-in'}
              </p>
              <p className="text-sm text-gray-600">
                {t('pos.transactions.total') || 'Total'}: {draftToDelete.total?.toLocaleString() || 0} XAF
              </p>
              {draftToDelete.cart && draftToDelete.cart.length > 0 && (
                <p className="text-sm text-gray-600">
                  {t('pos.transactions.products') || 'Products'}: {draftToDelete.cart.length}
                </p>
              )}
            </div>
          )}
          <p className="text-sm text-red-600">
            {t('pos.transactions.deleteWarning') || 'This action cannot be undone.'}
          </p>
        </div>
      </Modal>
    </div>
  );
};

