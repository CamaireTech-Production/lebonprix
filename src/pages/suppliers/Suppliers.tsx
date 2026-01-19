import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Eye, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, Button, Badge, Modal, ModalFooter, Input, PriceInput, Textarea, Table, LoadingScreen } from '@components/common';
import { useSuppliers, useSupplierDebts, useFinanceEntries } from '@hooks/data/useFirestore';
import { addSupplierDebt } from '@services/firestore/suppliers/supplierDebtService';
import { createSupplierRefund } from '@services/firestore/suppliers/supplierService';
import { useAuth } from '@contexts/AuthContext';
import { showSuccessToast, showErrorToast, showWarningToast } from '@utils/core/toast';
import { formatCreatorName } from '@utils/business/employeeUtils';
import type { Supplier, SupplierDebt } from '../../types/models';
import StatCard from '../../components/dashboard/StatCard';
import { calculateSolde } from '@utils/calculations/financialCalculations';
import { PermissionButton, usePermissionCheck } from '@components/permissions';
import { RESOURCES } from '@constants/resources';

const Suppliers = () => {
  const { t } = useTranslation();
  const { suppliers, loading, error, addSupplier, updateSupplier, deleteSupplier } = useSuppliers();
  const { debts: supplierDebtsList, loading: debtsLoading } = useSupplierDebts();
  const { entries: financeEntries } = useFinanceEntries();
  const { user, company } = useAuth();
  const { canEdit, canDelete } = usePermissionCheck(RESOURCES.SUPPLIERS);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isDebtHistoryModalOpen, setIsDebtHistoryModalOpen] = useState(false);
  const [isAddDebtModalOpen, setIsAddDebtModalOpen] = useState(false);
  
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

  // Debt form state
  const [debtData, setDebtData] = useState({
    amount: '',
    description: ''
  });

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');

  // Map supplier debts by supplierId for easy lookup
  const supplierDebts = useMemo(() => {
    const debtsMap: Record<string, SupplierDebt> = {};
    
    supplierDebtsList.forEach((debt: SupplierDebt) => {
      debtsMap[debt.supplierId] = debt;
    });

    return debtsMap;
  }, [supplierDebtsList]);

  // Calculate total supplier debt
  const totalSupplierDebt = useMemo(() => {
    return Object.values(supplierDebts).reduce((sum, debt) => sum + (debt.outstanding || 0), 0);
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

  const handleRefundInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { name: string; value: string } }) => {
    const { name, value } = e.target;
    setRefundData(prev => ({ ...prev, [name]: value }));
  };

  const handleDebtInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { name: string; value: string } }) => {
    const { name, value } = e.target;
    setDebtData(prev => ({ ...prev, [name]: value }));
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

  const resetDebtForm = () => {
    setDebtData({
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

  const openAddDebtModal = (supplier: Supplier) => {
    setCurrentSupplier(supplier);
    resetDebtForm();
    setIsAddDebtModalOpen(true);
  };

  const handleAddSupplier = async () => {
    if (!user?.uid || !company?.id) return;
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
        userId: user.uid,
        companyId: company.id
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

  const handleAddDebt = async () => {
    if (!currentSupplier || !user?.uid || !company?.id) return;
    if (!debtData.amount || !debtData.description) {
      showWarningToast(t('suppliers.messages.warnings.requiredFields'));
      return;
    }

    const debtAmount = parseFloat(debtData.amount);
    if (isNaN(debtAmount) || debtAmount <= 0) {
      showWarningToast(t('suppliers.messages.warnings.requiredFields'));
      return;
    }

    setIsSubmitting(true);
    try {
      await addSupplierDebt(
        currentSupplier.id,
        debtAmount,
        debtData.description,
        company.id
      );
      setIsAddDebtModalOpen(false);
      resetDebtForm();
      showSuccessToast(t('suppliers.debt.addSuccess') || 'Dette ajoutée avec succès');
    } catch (err) {
      showErrorToast(t('suppliers.debt.addError') || 'Erreur lors de l\'ajout de la dette');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddRefund = async () => {
    if (!currentSupplier || !user?.uid || !company?.id) return;
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
    if (!supplierDebt || refundAmount > (supplierDebt.outstanding || 0)) {
      showErrorToast(t('suppliers.refund.refundExceeds'));
      return;
    }

    setIsSubmitting(true);
    try {
      // Find the first debt entry to link the refund to (optional, for tracking)
      const debtEntries = supplierDebt.entries?.filter(e => e.type === 'debt') || [];
      const debtToRefundId = debtEntries.length > 0 ? debtEntries[0].id : undefined;
      
      await createSupplierRefund(
        currentSupplier.id,
        refundAmount,
        refundData.description,
        debtToRefundId || '',
        company.id
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

  if (loading || debtsLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    showErrorToast(t('suppliers.messages.errors.loadSuppliers'));
    return null;
  }

  const tableData = filteredSuppliers.map(supplier => {
    const debt = supplierDebts[supplier.id];
    const totalDebt = debt?.totalDebt || 0;
    const outstandingDebt = debt?.outstanding || 0;
    return {
      id: supplier.id,
      name: supplier.name,
      contact: supplier.contact,
      location: supplier.location || '-',
      totalDebt: totalDebt.toLocaleString(),
      outstandingDebt: outstandingDebt.toLocaleString(),
      createdBy: formatCreatorName(supplier.createdBy),
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
          <Button
            icon={<DollarSign size={16} />}
            variant="outline"
            size="sm"
            onClick={() => openAddDebtModal(supplier)}
            title={t('suppliers.actions.addDebt') || 'Ajouter une dette'}
          >
            {t('suppliers.actions.addDebt') || 'Ajouter dette'}
          </Button>
          {outstandingDebt > 0 && (
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
          {canEdit && (
            <Button
              icon={<Edit2 size={16} />}
              variant="outline"
              size="sm"
              onClick={() => openEditModal(supplier)}
              title={t('suppliers.actions.editSupplier')}
            >
              {''}
            </Button>
          )}
          {canDelete && (
            <Button
              icon={<Trash2 size={16} />}
              variant="outline"
              size="sm"
              onClick={() => openDeleteModal(supplier)}
              title={t('suppliers.actions.deleteSupplier')}
            >
              {''}
            </Button>
          )}
        </div>
      )
    };
  });

  const tableColumns = [
    { header: t('suppliers.table.columns.name'), accessor: 'name' as const },
    { header: t('suppliers.table.columns.contact'), accessor: 'contact' as const },
    { header: t('suppliers.table.columns.location'), accessor: 'location' as const },
    { header: t('suppliers.table.columns.totalDebt'), accessor: 'totalDebt' as const },
    { header: t('suppliers.table.columns.outstandingDebt'), accessor: 'outstandingDebt' as const },
    { header: 'Créé par', accessor: 'createdBy' as const },
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
          <PermissionButton
            resource={RESOURCES.SUPPLIERS}
            action="create"
            icon={<Plus size={16} />}
            onClick={openAddModal}
            hideWhenNoPermission
          >
            {t('suppliers.actions.addSupplier')}
          </PermissionButton>
        </div>
      </div>

      {/* Balance Card (Solde) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-6">
        <div className="w-full">
          <StatCard
            title={t('dashboard.stats.solde')}
            value={(() => {
              // Calculate solde - supplier debts are excluded in calculateSolde function
              // Filter out supplier_debt and supplier_refund entries (they're already excluded in calculateSolde, but being explicit)
              const nonSupplierEntries = financeEntries.filter(
                e => e.type !== 'supplier_debt' && e.type !== 'supplier_refund'
              );
              const solde = calculateSolde(nonSupplierEntries, [], []);
              return solde.toLocaleString() + ' XAF';
            })()}
            icon={<DollarSign size={24} />}
            type="solde"
            className="ring-2 ring-green-400 shadow bg-green-50 text-green-900 border border-green-200 rounded-xl py-2 mb-2 w-full text-base md:text-xl font-bold break-words"
          />
        </div>
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
            type="tel"
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
            type="tel"
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
          
          <PriceInput
            label={t('suppliers.refund.amount')}
            name="amount"
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

      {/* Add Debt Modal */}
      <Modal
        isOpen={isAddDebtModalOpen}
        onClose={() => setIsAddDebtModalOpen(false)}
        title={t('suppliers.debt.addTitle') || 'Ajouter une dette'}
        footer={
          <ModalFooter 
            onCancel={() => setIsAddDebtModalOpen(false)}
            onConfirm={handleAddDebt}
            confirmText={t('suppliers.debt.addButton') || 'Ajouter la dette'}
            isLoading={isSubmitting}
          />
        }
      >
        <div className="space-y-4">
          {currentSupplier && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">
                {t('suppliers.debt.supplier') || 'Fournisseur'}: 
                <span className="font-semibold ml-1">
                  {currentSupplier.name}
                </span>
              </p>
              {supplierDebts[currentSupplier.id] && (
                <p className="text-sm text-gray-600 mt-1">
                  {t('suppliers.debtHistory.remaining') || 'Dette actuelle'}: 
                  <span className="font-semibold ml-1">
                    {(supplierDebts[currentSupplier.id]?.outstanding || 0).toLocaleString()} XAF
                  </span>
                </p>
              )}
            </div>
          )}
          
          <PriceInput
            label={t('suppliers.debt.amount') || 'Montant de la dette'}
            name="amount"
            value={debtData.amount}
            onChange={handleDebtInputChange}
            required
          />
          
          <Textarea
            label={t('suppliers.debt.description') || 'Description'}
            name="description"
            value={debtData.description}
            onChange={handleDebtInputChange}
            required
            rows={3}
            placeholder={t('suppliers.debt.descriptionPlaceholder') || 'Raison de la dette (ex: Achat de marchandises, Prêt, etc.)'}
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
                    {(supplierDebts[currentSupplier.id]?.totalDebt || 0).toLocaleString()} XAF
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
              {supplierDebts[currentSupplier.id]?.entries && supplierDebts[currentSupplier.id].entries.length > 0 ? (
                <div className="space-y-2">
                  {supplierDebts[currentSupplier.id].entries
                    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
                    .map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <Badge 
                              variant={entry.type === 'debt' ? 'error' : 'success'}
                            >
                              {entry.type === 'debt' 
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
                          {entry.createdAt?.seconds 
                            ? new Date(entry.createdAt.seconds * 1000).toLocaleDateString()
                            : '-'
                          }
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
      {/* Mobile spacing for floating action button */}
      <div className="h-20 md:hidden"></div>
    </div>
  );
};

export default Suppliers; 