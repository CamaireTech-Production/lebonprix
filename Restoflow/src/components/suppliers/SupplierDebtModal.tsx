import React, { useState, useEffect } from 'react';
import { Plus, X, DollarSign, TrendingDown, History } from 'lucide-react';
import { Modal, Button, Input, Textarea, LoadingSpinner, Card } from '../ui';
import { useSuppliers } from '../../hooks/business/useSuppliers';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';
import type { Supplier, SupplierDebt } from '../../types/geskap';
import toast from 'react-hot-toast';

interface SupplierDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier;
  restaurantId: string;
  userId: string;
  onDebtUpdated?: () => void;
}

export const SupplierDebtModal: React.FC<SupplierDebtModalProps> = ({
  isOpen,
  onClose,
  supplier,
  restaurantId,
  userId,
  onDebtUpdated
}) => {
  const { language } = useLanguage();
  const { getDebt, addDebt, addRefund } = useSuppliers({ restaurantId, userId });

  const [debt, setDebt] = useState<SupplierDebt | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAddDebtModalOpen, setIsAddDebtModalOpen] = useState(false);
  const [isAddRefundModalOpen, setIsAddRefundModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [debtFormData, setDebtFormData] = useState({
    amount: '',
    description: ''
  });

  const [refundFormData, setRefundFormData] = useState({
    amount: '',
    description: ''
  });

  useEffect(() => {
    if (isOpen && supplier.id) {
      loadDebt();
    }
  }, [isOpen, supplier.id]);

  const loadDebt = async () => {
    if (!supplier.id) return;
    setLoading(true);
    try {
      const debtData = await getDebt(supplier.id);
      setDebt(debtData);
    } catch (err) {
      console.error('Error loading debt:', err);
      toast.error(t('error_loading_debt', language));
    } finally {
      setLoading(false);
    }
  };

  const handleDebtInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setDebtFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRefundInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setRefundFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddDebt = async () => {
    if (!supplier.id) return;
    const amount = parseFloat(debtFormData.amount);
    if (!amount || amount <= 0) {
      toast.error(t('invalid_amount', language));
      return;
    }

    setIsSubmitting(true);
    try {
      await addDebt(supplier.id, amount, debtFormData.description);
      setIsAddDebtModalOpen(false);
      setDebtFormData({ amount: '', description: '' });
      await loadDebt();
      onDebtUpdated?.();
      toast.success(t('debt_added_successfully', language));
    } catch (err: any) {
      toast.error(err.message || t('error_adding_debt', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddRefund = async () => {
    if (!supplier.id) return;
    const amount = parseFloat(refundFormData.amount);
    if (!amount || amount <= 0) {
      toast.error(t('invalid_amount', language));
      return;
    }

    if (debt && amount > debt.outstanding) {
      toast.error(t('refund_exceeds_debt', language));
      return;
    }

    setIsSubmitting(true);
    try {
      await addRefund(supplier.id, amount, refundFormData.description);
      setIsAddRefundModalOpen(false);
      setRefundFormData({ amount: '', description: '' });
      await loadDebt();
      onDebtUpdated?.();
      toast.success(t('refund_added_successfully', language));
    } catch (err: any) {
      toast.error(err.message || t('error_adding_refund', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US');
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`${t('debt_management', language)} - ${supplier.name}`}
        className="max-w-4xl"
      >
        <div className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : (
            <>
              {/* Debt Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">{t('total_debt', language)}</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {debt ? debt.totalDebt.toLocaleString() : '0'} XAF
                      </p>
                    </div>
                    <DollarSign className="text-red-500" size={32} />
                  </div>
                </Card>
                <Card>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">{t('total_refunded', language)}</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {debt ? debt.totalRefunded.toLocaleString() : '0'} XAF
                      </p>
                    </div>
                    <TrendingDown className="text-green-500" size={32} />
                  </div>
                </Card>
                <Card>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">{t('outstanding', language)}</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {debt ? debt.outstanding.toLocaleString() : '0'} XAF
                      </p>
                    </div>
                    <History className="text-orange-500" size={32} />
                  </div>
                </Card>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  icon={<Plus size={16} />}
                  onClick={() => setIsAddDebtModalOpen(true)}
                  variant="outline"
                >
                  {t('add_debt', language)}
                </Button>
                <Button
                  icon={<TrendingDown size={16} />}
                  onClick={() => setIsAddRefundModalOpen(true)}
                  variant="outline"
                  disabled={!debt || debt.outstanding <= 0}
                >
                  {t('add_refund', language)}
                </Button>
              </div>

              {/* Debt History */}
              {debt && debt.entries && debt.entries.length > 0 ? (
                <div>
                  <h3 className="text-lg font-semibold mb-4">{t('debt_history', language)}</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {[...debt.entries].reverse().map((entry, index) => (
                      <Card key={entry.id || index} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`px-2 py-1 rounded text-xs font-semibold ${
                                  entry.type === 'debt'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-green-100 text-green-800'
                                }`}
                              >
                                {entry.type === 'debt' ? t('debt', language) : t('refund', language)}
                              </span>
                              <span className="text-sm text-gray-600">
                                {formatDate(entry.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700">{entry.description || '-'}</p>
                            {entry.batchId && (
                              <p className="text-xs text-gray-500 mt-1">
                                {t('batch_id', language)}: {entry.batchId}
                              </p>
                            )}
                          </div>
                          <div
                            className={`text-lg font-bold ${
                              entry.type === 'debt' ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {entry.type === 'debt' ? '+' : '-'}
                            {entry.amount.toLocaleString()} XAF
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {t('no_debt_history', language)}
                </div>
              )}
            </>
          )}

          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              {t('close', language)}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Debt Modal */}
      <Modal
        isOpen={isAddDebtModalOpen}
        onClose={() => {
          setIsAddDebtModalOpen(false);
          setDebtFormData({ amount: '', description: '' });
        }}
        title={t('add_debt', language)}
      >
        <div className="space-y-4">
          <Input
            label={t('amount', language)}
            name="amount"
            type="number"
            value={debtFormData.amount}
            onChange={handleDebtInputChange}
            placeholder="0"
            required
            min="0"
            step="0.01"
          />

          <Textarea
            label={t('description', language)}
            name="description"
            value={debtFormData.description}
            onChange={handleDebtInputChange}
            placeholder={t('debt_description_placeholder', language)}
            rows={3}
          />

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDebtModalOpen(false);
                setDebtFormData({ amount: '', description: '' });
              }}
            >
              {t('cancel', language)}
            </Button>
            <Button
              onClick={handleAddDebt}
              disabled={isSubmitting || !debtFormData.amount}
              loading={isSubmitting}
            >
              {t('add_debt', language)}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Refund Modal */}
      <Modal
        isOpen={isAddRefundModalOpen}
        onClose={() => {
          setIsAddRefundModalOpen(false);
          setRefundFormData({ amount: '', description: '' });
        }}
        title={t('add_refund', language)}
      >
        <div className="space-y-4">
          <Input
            label={t('amount', language)}
            name="amount"
            type="number"
            value={refundFormData.amount}
            onChange={handleRefundInputChange}
            placeholder="0"
            required
            min="0"
            max={debt?.outstanding || 0}
            step="0.01"
          />
          {debt && (
            <p className="text-sm text-gray-500">
              {t('outstanding_debt', language)}: {debt.outstanding.toLocaleString()} XAF
            </p>
          )}

          <Textarea
            label={t('description', language)}
            name="description"
            value={refundFormData.description}
            onChange={handleRefundInputChange}
            placeholder={t('refund_description_placeholder', language)}
            rows={3}
          />

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsAddRefundModalOpen(false);
                setRefundFormData({ amount: '', description: '' });
              }}
            >
              {t('cancel', language)}
            </Button>
            <Button
              onClick={handleAddRefund}
              disabled={isSubmitting || !refundFormData.amount || (debt && parseFloat(refundFormData.amount) > debt.outstanding)}
              loading={isSubmitting}
            >
              {t('add_refund', language)}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
