import { useState } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { Modal, ModalFooter } from '@components/common';
import { deleteStockBatch } from '@services/firestore/stock/stockAdjustments';
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
  const { user, company } = useAuth();
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDelete = async () => {
    if (!batch || !user?.uid || !company?.id) {
      return;
    }
    
    setDeleteLoading(true);
    try {
      await deleteStockBatch(batch.id, company.id, user.uid);
      showSuccessToast('Stock batch deleted successfully');
      onSuccess();
      onClose();
    } catch (error) {
      logError('Failed to delete stock batch', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showErrorToast(`Failed to delete batch: ${errorMessage}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const canDelete = batch?.remainingQuantity === 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Stock Batch"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={handleDelete}
          confirmText="Delete Batch"
          isDanger
          isLoading={deleteLoading}
          disabled={!canDelete}
        />
      }
    >
      <div className="text-center space-y-4">
        {batch && (
          <div className="bg-gray-50 p-4 rounded-lg text-left">
            <h4 className="font-medium text-gray-900 mb-2">Batch Details</h4>
            <div className="space-y-1 text-sm">
              <div>
                <span className="font-medium text-gray-700">Item:</span>
                <span className="ml-2 text-gray-900">{itemName}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Batch ID:</span>
                <span className="ml-2 font-mono text-xs text-gray-900">{batch.id}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Remaining Stock:</span>
                <span className="ml-2 text-gray-900">{batch.remainingQuantity} / {batch.quantity}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Status:</span>
                <span className="ml-2 text-gray-900 capitalize">{batch.status}</span>
              </div>
            </div>
          </div>
        )}
        
        {canDelete ? (
          <>
            <p className="text-gray-600">
              Are you sure you want to delete this stock batch?
            </p>
            <p className="text-sm text-orange-600">
              <strong>Warning:</strong> This action will soft delete the batch and preserve all historical records. 
              The batch will no longer appear in active inventory but will remain in audit logs.
            </p>
          </>
        ) : (
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-red-800 font-medium mb-2">
              Cannot Delete Batch
            </p>
            <p className="text-sm text-red-600">
              This batch has {batch?.remainingQuantity || 0} units remaining. 
              You can only delete batches with zero remaining stock.
            </p>
            <p className="text-xs text-red-500 mt-2">
              Please adjust the stock to 0 first, then try deleting again.
            </p>
          </div>
        )}
        
        {batch?.supplierId && batch.isCredit && !batch.isOwnPurchase && (
          <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
            <strong>Note:</strong> This batch was purchased on credit. Any outstanding supplier debt will remain as a financial obligation.
          </p>
        )}
      </div>
    </Modal>
  );
};

export default BatchDeleteModal;
