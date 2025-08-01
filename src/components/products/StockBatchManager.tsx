import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Eye, Info } from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';
import Input from '../common/Input';
import Modal, { ModalFooter } from '../common/Modal';
import Badge from '../common/Badge';
import { useStockBatches } from '../../hooks/useStockBatches';
import { formatCostPrice, formatStockQuantity, getBatchStatusText, getBatchStatusColor } from '../../utils/inventoryManagement';
import { showSuccessToast, showErrorToast } from '../../utils/toast';
import type { StockBatch } from '../../types/models';

interface StockBatchManagerProps {
  productId: string;
  productName: string;
}

const StockBatchManager: React.FC<StockBatchManagerProps> = ({ productId, productName }) => {
  const { t } = useTranslation();
  const { batches, loading, error, addBatch, correctCostPrice } = useStockBatches(productId);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<StockBatch | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Add batch form state
  const [addBatchForm, setAddBatchForm] = useState({
    quantity: '',
    costPrice: '',
    supplierId: '',
    isOwnPurchase: true,
    isCredit: false,
    notes: ''
  });
  
  // Edit batch form state
  const [editBatchForm, setEditBatchForm] = useState({
    costPrice: ''
  });

  const handleAddBatch = async () => {
    if (!addBatchForm.quantity || !addBatchForm.costPrice) {
      showErrorToast(t('products.stockBatch.validation.requiredFields'));
      return;
    }

    const quantity = parseInt(addBatchForm.quantity);
    const costPrice = parseInt(addBatchForm.costPrice);

    if (quantity <= 0 || costPrice <= 0) {
      showErrorToast(t('products.stockBatch.validation.positiveValues'));
      return;
    }

    setIsSubmitting(true);
    try {
      await addBatch(
        quantity,
        costPrice,
        addBatchForm.supplierId || undefined,
        addBatchForm.isOwnPurchase,
        addBatchForm.isCredit,
        addBatchForm.notes || undefined
      );
      
      showSuccessToast(t('products.stockBatch.added'));
      setIsAddModalOpen(false);
      resetAddForm();
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : t('products.stockBatch.error.add'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditBatch = async () => {
    if (!selectedBatch || !editBatchForm.costPrice) {
      showErrorToast(t('products.stockBatch.validation.requiredFields'));
      return;
    }

    const newCostPrice = parseInt(editBatchForm.costPrice);
    if (newCostPrice <= 0) {
      showErrorToast(t('products.stockBatch.validation.positiveValues'));
      return;
    }

    setIsSubmitting(true);
    try {
      await correctCostPrice(selectedBatch.id, newCostPrice);
      showSuccessToast(t('products.stockBatch.updated'));
      setIsEditModalOpen(false);
      setSelectedBatch(null);
      resetEditForm();
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : t('products.stockBatch.error.update'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (batch: StockBatch) => {
    setSelectedBatch(batch);
    setEditBatchForm({ costPrice: batch.costPrice.toString() });
    setIsEditModalOpen(true);
  };

  const openViewModal = (batch: StockBatch) => {
    setSelectedBatch(batch);
    setIsViewModalOpen(true);
  };

  const resetAddForm = () => {
    setAddBatchForm({
      quantity: '',
      costPrice: '',
      supplierId: '',
      isOwnPurchase: true,
      isCredit: false,
      notes: ''
    });
  };

  const resetEditForm = () => {
    setEditBatchForm({ costPrice: '' });
  };

  const getActiveBatches = () => batches.filter(batch => batch.status === 'active');
  const getDepletedBatches = () => batches.filter(batch => batch.status === 'depleted');

  if (loading) {
    return (
      <Card>
        <div className="p-4 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">{t('common.loading')}</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="p-4 text-center text-red-600">
          <p>{error}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {t('products.stockBatch.title')} - {productName}
          </h3>
          <p className="text-sm text-gray-600">
            {t('products.stockBatch.subtitle')}
          </p>
        </div>
        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('products.stockBatch.add')}
        </Button>
      </div>

      {/* Active Batches */}
      <Card>
        <div className="p-4">
          <h4 className="text-md font-medium text-gray-900 mb-3">
            {t('products.stockBatch.active')} ({getActiveBatches().length})
          </h4>
          
          {getActiveBatches().length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              {t('products.stockBatch.noActiveBatches')}
            </p>
          ) : (
            <div className="space-y-3">
              {getActiveBatches().map((batch) => (
                <div
                  key={batch.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">
                        {formatStockQuantity(batch.remainingQuantity)} {t('products.stockBatch.units')}
                      </span>
                      <Badge variant={getBatchStatusColor(batch.status)}>
                        {getBatchStatusText(batch.status)}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600">
                      {t('products.stockBatch.costPrice')}: {formatCostPrice(batch.costPrice)}
                    </div>
                    {batch.notes && (
                      <div className="text-sm text-gray-500 mt-1">
                        {batch.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openViewModal(batch)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(batch)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Depleted Batches */}
      {getDepletedBatches().length > 0 && (
        <Card>
          <div className="p-4">
            <h4 className="text-md font-medium text-gray-900 mb-3">
              {t('products.stockBatch.depleted')} ({getDepletedBatches().length})
            </h4>
            <div className="space-y-2">
              {getDepletedBatches().map((batch) => (
                <div
                  key={batch.id}
                  className="flex items-center justify-between p-2 bg-gray-100 rounded"
                >
                  <div>
                    <span className="text-sm font-medium">
                      {formatStockQuantity(batch.quantity)} {t('products.stockBatch.units')}
                    </span>
                    <span className="text-sm text-gray-600 ml-2">
                      {t('products.stockBatch.costPrice')}: {formatCostPrice(batch.costPrice)}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openViewModal(batch)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Add Batch Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={t('products.stockBatch.add')}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('products.stockBatch.quantity')}
              type="number"
              value={addBatchForm.quantity}
              onChange={(e) => setAddBatchForm(prev => ({ ...prev, quantity: e.target.value }))}
              placeholder="0"
              required
            />
            <Input
              label={t('products.stockBatch.costPrice')}
              type="number"
              value={addBatchForm.costPrice}
              onChange={(e) => setAddBatchForm(prev => ({ ...prev, costPrice: e.target.value }))}
              placeholder="0"
              required
            />
          </div>
          
          <Input
            label={t('products.stockBatch.supplierId')}
            value={addBatchForm.supplierId}
            onChange={(e) => setAddBatchForm(prev => ({ ...prev, supplierId: e.target.value }))}
            placeholder={t('products.stockBatch.supplierIdPlaceholder')}
          />
          
          <div className="flex items-center gap-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={addBatchForm.isOwnPurchase}
                onChange={(e) => setAddBatchForm(prev => ({ ...prev, isOwnPurchase: e.target.checked }))}
                className="mr-2"
              />
              {t('products.stockBatch.ownPurchase')}
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={addBatchForm.isCredit}
                onChange={(e) => setAddBatchForm(prev => ({ ...prev, isCredit: e.target.checked }))}
                className="mr-2"
              />
              {t('products.stockBatch.credit')}
            </label>
          </div>
          
          <Input
            label={t('products.stockBatch.notes')}
            value={addBatchForm.notes}
            onChange={(e) => setAddBatchForm(prev => ({ ...prev, notes: e.target.value }))}
            placeholder={t('products.stockBatch.notesPlaceholder')}
          />
        </div>
        
        <ModalFooter
          onCancel={() => setIsAddModalOpen(false)}
          onConfirm={handleAddBatch}
          confirmText={isSubmitting ? t('common.saving') : t('common.save')}
          cancelText={t('common.cancel')}
          isLoading={isSubmitting}
          disabled={isSubmitting}
        />
      </Modal>

      {/* Edit Batch Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={t('products.stockBatch.edit')}
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <Info className="w-4 h-4 inline mr-1" />
              {t('products.stockBatch.editWarning')}
            </p>
          </div>
          
          <Input
            label={t('products.stockBatch.costPrice')}
            type="number"
            value={editBatchForm.costPrice}
            onChange={(e) => setEditBatchForm(prev => ({ ...prev, costPrice: e.target.value }))}
            placeholder="0"
            required
          />
        </div>
        
        <ModalFooter
          onCancel={() => setIsEditModalOpen(false)}
          onConfirm={handleEditBatch}
          confirmText={isSubmitting ? t('common.saving') : t('common.save')}
          cancelText={t('common.cancel')}
          isLoading={isSubmitting}
          disabled={isSubmitting}
        />
      </Modal>

      {/* View Batch Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={t('products.stockBatch.details')}
      >
        {selectedBatch && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('products.stockBatch.quantity')}
                </label>
                <p className="mt-1 text-sm text-gray-900">
                  {formatStockQuantity(selectedBatch.quantity)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('products.stockBatch.remainingQuantity')}
                </label>
                <p className="mt-1 text-sm text-gray-900">
                  {formatStockQuantity(selectedBatch.remainingQuantity)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('products.stockBatch.costPrice')}
                </label>
                <p className="mt-1 text-sm text-gray-900">
                  {formatCostPrice(selectedBatch.costPrice)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('products.stockBatch.status')}
                </label>
                <p className="mt-1">
                  <Badge variant={getBatchStatusColor(selectedBatch.status)}>
                    {getBatchStatusText(selectedBatch.status)}
                  </Badge>
                </p>
              </div>
            </div>
            
            {selectedBatch.notes && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('products.stockBatch.notes')}
                </label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedBatch.notes}
                </p>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t('products.stockBatch.createdAt')}
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {new Date(selectedBatch.createdAt.seconds * 1000).toLocaleString()}
              </p>
            </div>
          </div>
        )}
        
        <ModalFooter
          onCancel={() => setIsViewModalOpen(false)}
          onConfirm={() => setIsViewModalOpen(false)}
          confirmText={t('common.close')}
          cancelText={t('common.close')}
        />
      </Modal>
    </div>
  );
};

export default StockBatchManager; 