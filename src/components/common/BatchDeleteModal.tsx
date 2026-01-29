import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@contexts/AuthContext';
import { Modal, ModalFooter } from '@components/common';
import { deleteStockBatch, canDeleteBatch } from '@services/firestore/stock/stockAdjustments';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import { logError } from '@utils/core/logger';
import type { StockBatch } from '../../types/models';

interface BatchDeleteModalProps {
  isOpen: boolean;
  batch: StockBatch | null;
  itemName: string; // Product or matiere name for display
  onClose: () => void;
  onSuccess: () => void;
}

const BatchDeleteModal = ({ isOpen, batch, itemName, onClose, onSuccess }: BatchDeleteModalProps) => {
  const { t } = useTranslation();
  const { user, company } = useAuth();
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDelete = async () => {
    if (!batch || !user?.uid || !company?.id) {
      return;
    }
    
    setDeleteLoading(true);
    try {
      await deleteStockBatch(batch.id, company.id, user.uid);
      showSuccessToast(t('products.stocksPage.batchDeleteModal.messages.success'));
      onSuccess();
      onClose();
    } catch (error) {
      logError('Failed to delete stock batch', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showErrorToast(t('products.stocksPage.batchDeleteModal.messages.error', { error: errorMessage }));
    } finally {
      setDeleteLoading(false);
    }
  };

  // Use the new validation function
  const canDelete = batch ? canDeleteBatch(batch) : false;
  
  // Determine deletion reason for better messaging
  const isUnused = batch ? batch.remainingQuantity === batch.quantity : false;
  const isConsumedButConsolidated = batch ? 
    batch.remainingQuantity < batch.quantity && 
    batch.remainingQuantity === 0 && 
    (batch.status === 'corrected' || batch.status === 'depleted') : false;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('products.stocksPage.batchDeleteModal.title')}
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={handleDelete}
          confirmText={t('products.stocksPage.batchDeleteModal.actions.delete')}
          cancelText={t('products.stocksPage.batchDeleteModal.actions.cancel')}
          isDanger
          isLoading={deleteLoading}
          disabled={!canDelete}
        />
      }
    >
      <div className="text-center space-y-4">
        {batch && (
          <div className="bg-gray-50 p-4 rounded-lg text-left">
            <h4 className="font-medium text-gray-900 mb-2">{t('products.stocksPage.batchDeleteModal.batchDetails.title')}</h4>
            <div className="space-y-1 text-sm">
              <div>
                <span className="font-medium text-gray-700">{t('products.stocksPage.batchDeleteModal.batchDetails.item')}</span>
                <span className="ml-2 text-gray-900">{itemName}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">{t('products.stocksPage.batchDeleteModal.batchDetails.batchId')}</span>
                <span className="ml-2 font-mono text-xs text-gray-900">{batch.id}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">{t('products.stocksPage.batchDeleteModal.batchDetails.remainingStock')}</span>
                <span className="ml-2 text-gray-900">{batch.remainingQuantity} / {batch.quantity}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">{t('products.stocksPage.batchDeleteModal.batchDetails.status')}</span>
                <span className="ml-2 text-gray-900 capitalize">{batch.status}</span>
              </div>
            </div>
          </div>
        )}
        
        {canDelete ? (
          <>
            <p className="text-gray-600">
              {t('products.stocksPage.batchDeleteModal.confirmQuestion')}
            </p>
            {isUnused ? (
              <p className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                {t('products.stocksPage.batchDeleteModal.notes.unused', { 
                  remaining: batch?.remainingQuantity || 0, 
                  total: batch?.quantity || 0 
                })}
              </p>
            ) : isConsumedButConsolidated ? (
              <p className="text-sm text-orange-600 bg-orange-50 p-3 rounded-lg">
                {batch?.status === 'corrected' 
                  ? t('products.stocksPage.batchDeleteModal.notes.consolidated')
                  : t('products.stocksPage.batchDeleteModal.notes.destocked')
                }
              </p>
            ) : null}
            <p className="text-sm text-orange-600">
              {t('products.stocksPage.batchDeleteModal.warning')}
            </p>
          </>
        ) : (
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-red-800 font-medium mb-2">
              {t('products.stocksPage.batchDeleteModal.cannotDelete.title')}
            </p>
            {batch && batch.remainingQuantity > 0 && batch.remainingQuantity < batch.quantity ? (
              <>
                <p className="text-sm text-red-600">
                  {t('products.stocksPage.batchDeleteModal.cannotDelete.partiallyConsumed', {
                    remaining: batch.remainingQuantity,
                    total: batch.quantity
                  })}
                </p>
                <p className="text-xs text-red-500 mt-2">
                  {t('products.stocksPage.batchDeleteModal.cannotDelete.instructions')}
                  <ul className="list-disc list-inside mt-1">
                    <li>{t('products.stocksPage.batchDeleteModal.cannotDelete.destockOption')}</li>
                    <li>{t('products.stocksPage.batchDeleteModal.cannotDelete.consolidateOption')}</li>
                  </ul>
                </p>
              </>
            ) : batch && batch.remainingQuantity > 0 ? (
              <>
                <p className="text-sm text-red-600">
                  {t('products.stocksPage.batchDeleteModal.cannotDelete.hasRemaining', {
                    remaining: batch.remainingQuantity
                  })}
                </p>
                <p className="text-xs text-red-500 mt-2">
                  {t('products.stocksPage.batchDeleteModal.cannotDelete.adjustFirst')}
                </p>
              </>
            ) : (
              <p className="text-sm text-red-600">
                {t('products.stocksPage.batchDeleteModal.cannotDelete.generic')}
              </p>
            )}
          </div>
        )}
        
        {batch?.supplierId && batch.isCredit && !batch.isOwnPurchase && canDelete && (
          <p className="text-xs text-green-600 bg-green-50 p-2 rounded">
            <strong>{t('products.stocksPage.batchDeleteModal.supplierDebtNote')}</strong>
          </p>
        )}
      </div>
    </Modal>
  );
};

export default BatchDeleteModal;
