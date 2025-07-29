import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Eye, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal, { ModalFooter } from '../components/common/Modal';
import Input from '../components/common/Input';
import Textarea from '../components/common/Textarea';
import Table from '../components/common/Table';
import { useSuppliers, useFinanceEntries } from '../hooks/useFirestore';
import { createSupplierRefund } from '../services/firestore';
import { useAuth } from '../contexts/AuthContext';
import LoadingScreen from '../components/common/LoadingScreen';
import { showSuccessToast, showErrorToast, showWarningToast } from '../utils/toast';
import type { Supplier, FinanceEntry } from '../types/models';

const Suppliers = () => {
  const { t } = useTranslation();
  const { suppliers, loading, error, addSupplier, updateSupplier, deleteSupplier } = useSuppliers();
  const { entries } = useFinanceEntries();
  const { user } = useAuth();

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isDebtHistoryModalOpen, setIsDebtHistoryModalOpen] = useState(false);
  
  // Form states
  const [currentSupplier, setCurrentSupplier] = useState<Supplier | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    location: ''
  });

  // Refund form state
  const [refundData, setRefundData] = useState({
    amount: '',
    description: ''
  });

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate supplier debts
  const supplierDebts = useMemo(() => {
    const debts: Record<string, { total: number; outstanding: number; entries: FinanceEntry[] }> = {};
    
    entries.forEach((entry: FinanceEntry) => {
      if (entry.type === 'supplier_debt' && entry.supplierId) {
        if (!debts[entry.supplierId]) {
          debts[entry.supplierId] = { total: 0, outstanding: 0, entries: [] };
        }
        debts[entry.supplierId].total += entry.amount;
        debts[entry.supplierId].entries.push(entry);
      } else if (entry.type === 'supplier_refund' && entry.supplierId) {
        if (!debts[entry.supplierId]) {
          debts[entry.supplierId] = { total: 0, outstanding: 0, entries: [] };
        }
        debts[entry.supplierId].outstanding -= entry.amount;
        debts[entry.supplierId].entries.push(entry);
      }
    });

    // Calculate outstanding amounts
    Object.keys(debts).forEach(supplierId => {
      debts[supplierId].outstanding = Math.max(0, debts[supplierId].total + debts[supplierId].outstanding);
    });

    return debts;
  }, [entries]);

  // Calculate total supplier debt
  const totalSupplierDebt = useMemo(() => {
    return Object.values(supplierDebts).reduce((sum, debt) => sum + debt.outstanding, 0);
  }, [supplierDebts]);

  // Filter suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(supplier => 
      supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.contact.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (supplier.location && supplier.location.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [suppliers, searchQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRefundInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setRefundData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      contact: '',
      location: ''
    });
  };

  const resetRefundForm = () => {
    setRefundData({
      amount: '',
      description: ''
    });
  };

  const openAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setCurrentSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact: supplier.contact,
      location: supplier.location || ''
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (supplier: Supplier) => {
    setCurrentSupplier(supplier);
    setIsDeleteModalOpen(true);
  };

  const openRefundModal = (supplier: Supplier) => {
    setCurrentSupplier(supplier);
    resetRefundForm();
    setIsRefundModalOpen(true);
  };

  const openDebtHistoryModal = (supplier: Supplier) => {
    setCurrentSupplier(supplier);
    setIsDebtHistoryModalOpen(true);
  };

  const handleAddSupplier = async () => {
    if (!user?.uid) return;
    if (!formData.name || !formData.contact) {
      showWarningToast(t('suppliers.messages.warnings.requiredFields'));
      return;
    }

    setIsSubmitting(true);
    try {
      await addSupplier({
        name: formData.name,
        contact: formData.contact,
        location: formData.location || undefined,
        userId: user.uid
      });
      setIsAddModalOpen(false);
      resetForm();
      showSuccessToast(t('suppliers.messages.supplierAdded'));
    } catch (err) {
      showErrorToast(t('suppliers.messages.errors.addSupplier'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSupplier = async () => {
    if (!currentSupplier || !user?.uid) return;
    if (!formData.name || !formData.contact) {
      showWarningToast(t('suppliers.messages.warnings.requiredFields'));
      return;
    }

    setIsSubmitting(true);
    try {
      await updateSupplier(currentSupplier.id, {
        name: formData.name,
        contact: formData.contact,
        location: formData.location || undefined
      });
      setIsEditModalOpen(false);
      resetForm();
      showSuccessToast(t('suppliers.messages.supplierUpdated'));
    } catch (err) {
      showErrorToast(t('suppliers.messages.errors.updateSupplier'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!currentSupplier || !user?.uid) return;

    setIsSubmitting(true);
    try {
      await deleteSupplier(currentSupplier.id);
      setIsDeleteModalOpen(false);
      setCurrentSupplier(null);
      showSuccessToast(t('suppliers.messages.supplierDeleted'));
    } catch (err) {
      if (err instanceof Error && err.message.includes('outstanding debts')) {
        showErrorToast(t('suppliers.messages.errors.hasOutstandingDebts'));
      } else {
        showErrorToast(t('suppliers.messages.errors.deleteSupplier'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddRefund = async () => {
    if (!currentSupplier || !user?.uid) return;
    if (!refundData.amount || !refundData.description) {
      showWarningToast(t('suppliers.messages.warnings.requiredFields'));
      return;
    }

    const refundAmount = parseFloat(refundData.amount);
    if (isNaN(refundAmount) || refundAmount <= 0) {
      showWarningToast(t('suppliers.messages.warnings.requiredFields'));
      return;
    }

    const supplierDebt = supplierDebts[currentSupplier.id];
    if (!supplierDebt || refundAmount > supplierDebt.outstanding) {
      showErrorToast(t('suppliers.refund.refundExceeds'));
      return;
    }

    setIsSubmitting(true);
    try {
      // Find the debt entry to refund
      const debtEntries = supplierDebts[currentSupplier.id]?.entries.filter(e => e.type === 'supplier_debt') || [];
      if (debtEntries.length === 0) {
        throw new Error('No debt found to refund');
      }
      
      // For now, refund the first debt entry (in a real app, you might want to let user choose)
      const debtToRefund = debtEntries[0];
      
      await createSupplierRefund(
        currentSupplier.id,
        refundAmount,
        refundData.description,
        debtToRefund.id,
        user.uid
      );
      setIsRefundModalOpen(false);
      resetRefundForm();
      showSuccessToast(t('suppliers.refund.success'));
    } catch (err) {
      showErrorToast(t('suppliers.refund.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    showErrorToast(t('suppliers.messages.errors.loadSuppliers'));
    return null;
  }

  const tableData = filteredSuppliers.map(supplier => {
    const debt = supplierDebts[supplier.id] || { total: 0, outstanding: 0, entries: [] };
    return {
      id: supplier.id,
      name: supplier.name,
      contact: supplier.contact,
      location: supplier.location || '-',
      email: supplier.email || '-',
      totalDebt: debt.total.toLocaleString(),
      outstandingDebt: debt.outstanding.toLocaleString(),
      actions: (
        <div className="flex space-x-2">
          <Button
            icon={<Eye size={16} />}
            variant="outline"
            size="sm"
            onClick={() => openDebtHistoryModal(supplier)}
            title={t('suppliers.actions.viewDebtHistory')}
          >
            {t('suppliers.actions.viewDebtHistory')}
          </Button>
          {debt.outstanding > 0 && (
            <Button
              icon={<DollarSign size={16} />}
              variant="outline"
              size="sm"
              onClick={() => openRefundModal(supplier)}
              title={t('suppliers.actions.addRefund')}
            >
              {t('suppliers.actions.addRefund')}
            </Button>
          )}
          <Button
            icon={<Edit2 size={16} />}
            variant="outline"
            size="sm"
            onClick={() => openEditModal(supplier)}
            title={t('suppliers.actions.editSupplier')}
          >
            {t('suppliers.actions.editSupplier')}
          </Button>
          <Button
            icon={<Trash2 size={16} />}
            variant="outline"
            size="sm"
            onClick={() => openDeleteModal(supplier)}
            title={t('suppliers.actions.deleteSupplier')}
          >
            {t('suppliers.actions.deleteSupplier')}
          </Button>
        </div>
      )
    };
  });

  const tableColumns = [
    { header: t('suppliers.table.columns.name'), accessor: 'name' as const },
    { header: t('suppliers.table.columns.contact'), accessor: 'contact' as const },
    { header: t('suppliers.table.columns.location'), accessor: 'location' as const },
    { header: t('suppliers.table.columns.email'), accessor: 'email' as const },
    { header: t('suppliers.table.columns.totalDebt'), accessor: 'totalDebt' as const },
    { header: t('suppliers.table.columns.outstandingDebt'), accessor: 'outstandingDebt' as const },
    { header: t('suppliers.table.columns.actions'), accessor: 'actions' as const }
  ];

  return (
    <div className="pb-16 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('suppliers.title')}</h1>
          <p className="text-gray-600">{t('suppliers.subtitle')}</p>
        </div>
        
        <div className="mt-4 md:mt-0">
          <Button 
            icon={<Plus size={16} />}
            onClick={openAddModal}
          >
            {t('suppliers.actions.addSupplier')}
          </Button>
        </div>
      </div>

      {/* Supplier Debt Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="bg-red-50 border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm md:text-lg text-red-800 mb-1 md:mb-2">
                {t('suppliers.debtCard.title')}
              </div>
              <div className="text-base md:text-xl font-bold text-red-900 mb-1 md:mb-2">
                {totalSupplierDebt.toLocaleString()} XAF
              </div>
            </div>
            <DollarSign className="text-red-600" size={24} />
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-6">
        <Input
          type="text"
          placeholder={t('suppliers.search')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Suppliers Table */}
      <Card>
        <Table
          data={tableData}
          columns={tableColumns}
          keyExtractor={(item) => item.id}
          emptyMessage={t('suppliers.noSuppliers')}
        />
      </Card>

      {/* Add Supplier Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={t('suppliers.actions.addSupplier')}
        footer={
          <ModalFooter 
            onCancel={() => setIsAddModalOpen(false)}
            onConfirm={handleAddSupplier}
            confirmText={t('suppliers.actions.addSupplier')}
            isLoading={isSubmitting}
          />
        }
      >
        <div className="space-y-4">
          <Input
            label={t('suppliers.form.name')}
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
          />
          
          <Input
            label={t('suppliers.form.contact')}
            name="contact"
            value={formData.contact}
            onChange={handleInputChange}
            required
          />
          
          <Input
            label={t('suppliers.form.location')}
            name="location"
            value={formData.location}
            onChange={handleInputChange}
          />
        </div>
      </Modal>

      {/* Edit Supplier Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={t('suppliers.actions.editSupplier')}
        footer={
          <ModalFooter 
            onCancel={() => setIsEditModalOpen(false)}
            onConfirm={handleEditSupplier}
            confirmText={t('suppliers.actions.editSupplier')}
            isLoading={isSubmitting}
          />
        }
      >
        <div className="space-y-4">
          <Input
            label={t('suppliers.form.name')}
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
          />
          
          <Input
            label={t('suppliers.form.contact')}
            name="contact"
            value={formData.contact}
            onChange={handleInputChange}
            required
          />
          
          <Input
            label={t('suppliers.form.location')}
            name="location"
            value={formData.location}
            onChange={handleInputChange}
          />
        </div>
      </Modal>

      {/* Delete Supplier Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t('suppliers.actions.deleteSupplier')}
        footer={
          <ModalFooter 
            onCancel={() => setIsDeleteModalOpen(false)}
            onConfirm={handleDeleteSupplier}
            confirmText={t('suppliers.actions.deleteSupplier')}
            isLoading={isSubmitting}
            isDanger
          />
        }
      >
        <p className="text-gray-600">
          {t('suppliers.messages.warnings.deleteConfirm')}
          {currentSupplier && (
            <span className="font-semibold"> {currentSupplier.name}</span>
          )}
        </p>
      </Modal>

      {/* Add Refund Modal */}
      <Modal
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        title={t('suppliers.refund.title')}
        footer={
          <ModalFooter 
            onCancel={() => setIsRefundModalOpen(false)}
            onConfirm={handleAddRefund}
            confirmText={t('suppliers.refund.title')}
            isLoading={isSubmitting}
          />
        }
      >
        <div className="space-y-4">
          {currentSupplier && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">
                {t('suppliers.refund.remainingDebt')}: 
                <span className="font-semibold ml-1">
                  {(supplierDebts[currentSupplier.id]?.outstanding || 0).toLocaleString()} XAF
                </span>
              </p>
            </div>
          )}
          
          <Input
            label={t('suppliers.refund.amount')}
            name="amount"
            type="number"
            value={refundData.amount}
            onChange={handleRefundInputChange}
            required
          />
          
          <Textarea
            label={t('suppliers.refund.description')}
            name="description"
            value={refundData.description}
            onChange={handleRefundInputChange}
            required
            rows={3}
          />
        </div>
      </Modal>

      {/* Debt History Modal */}
      <Modal
        isOpen={isDebtHistoryModalOpen}
        onClose={() => setIsDebtHistoryModalOpen(false)}
        title={t('suppliers.debtHistory.title')}
        size="lg"
      >
        {currentSupplier && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-lg mb-2">{currentSupplier.name}</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">{t('suppliers.debtHistory.total')}: </span>
                  <span className="font-semibold">
                    {(supplierDebts[currentSupplier.id]?.total || 0).toLocaleString()} XAF
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">{t('suppliers.debtHistory.remaining')}: </span>
                  <span className="font-semibold">
                    {(supplierDebts[currentSupplier.id]?.outstanding || 0).toLocaleString()} XAF
                  </span>
                </div>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {supplierDebts[currentSupplier.id]?.entries.length > 0 ? (
                <div className="space-y-2">
                  {supplierDebts[currentSupplier.id].entries
                    .sort((a, b) => b.createdAt.seconds - a.createdAt.seconds)
                    .map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <Badge 
                              variant={entry.type === 'supplier_debt' ? 'error' : 'success'}
                            >
                              {entry.type === 'supplier_debt' 
                                ? t('suppliers.debtHistory.debtEntry')
                                : t('suppliers.debtHistory.refundEntry')
                              }
                            </Badge>
                            <span className="font-semibold">
                              {entry.amount.toLocaleString()} XAF
                            </span>
                          </div>
                          {entry.description && (
                            <p className="text-sm text-gray-600 mt-1">{entry.description}</p>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(entry.createdAt.seconds * 1000).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  {t('suppliers.debtHistory.noDebts')}
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Suppliers; 