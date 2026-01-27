import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, Building2, DollarSign, TrendingUp, Eye } from 'lucide-react';
import { Card, Button, Badge, Table, Input, Textarea, Modal, LoadingSpinner } from '../../../components/ui';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { useSuppliers } from '../../../hooks/business/useSuppliers';
import { useAuth } from '../../../contexts/AuthContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { t } from '../../../utils/i18n';
import type { Supplier } from '../../../types/geskap';
import { formatPhoneNumber } from '../../../utils/phoneUtils';
import toast from 'react-hot-toast';
import { SupplierDebtModal } from '../../../components/suppliers/SupplierDebtModal';

const SuppliersPage = () => {
  const { currentUser, restaurant } = useAuth();
  const { language } = useLanguage();
  const restaurantId = restaurant?.id || currentUser?.uid || '';
  const userId = currentUser?.uid || '';

  const {
    suppliers,
    loading,
    error,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    getAllDebts
  } = useSuppliers({ restaurantId, userId });

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);

  // Form states
  const [currentSupplier, setCurrentSupplier] = useState<Supplier | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    location: '',
    email: '',
    notes: ''
  });

  // Debt data
  const [supplierDebts, setSupplierDebts] = useState<any[]>([]);
  const [debtsLoading, setDebtsLoading] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');

  // Load debts on mount
  React.useEffect(() => {
    const loadDebts = async () => {
      if (!restaurantId) return;
      setDebtsLoading(true);
      try {
        const debts = await getAllDebts();
        setSupplierDebts(debts);
      } catch (err) {
        console.error('Error loading debts:', err);
      } finally {
        setDebtsLoading(false);
      }
    };
    loadDebts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalSuppliers = suppliers.length;
    const totalDebt = supplierDebts.reduce((sum, debt) => sum + (debt.outstanding || 0), 0);
    const suppliersWithDebt = supplierDebts.filter(debt => debt.outstanding > 0).length;

    return {
      totalSuppliers,
      totalDebt,
      suppliersWithDebt
    };
  }, [suppliers, supplierDebts]);

  // Filter suppliers
  const filteredSuppliers = useMemo(() => {
    if (!searchQuery) return suppliers;

    const query = searchQuery.toLowerCase();
    return suppliers.filter(supplier => {
      return (
        supplier.name?.toLowerCase().includes(query) ||
        supplier.contact?.toLowerCase().includes(query) ||
        supplier.location?.toLowerCase().includes(query) ||
        supplier.email?.toLowerCase().includes(query)
      );
    });
  }, [suppliers, searchQuery]);

  // Get debt for a supplier
  const getSupplierDebt = (supplierId: string) => {
    return supplierDebts.find(debt => debt.supplierId === supplierId);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      contact: '',
      location: '',
      email: '',
      notes: ''
    });
    setCurrentSupplier(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setCurrentSupplier(supplier);
    setFormData({
      name: supplier.name || '',
      contact: supplier.contact || '',
      location: supplier.location || '',
      email: supplier.email || '',
      notes: supplier.notes || ''
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (supplier: Supplier) => {
    setCurrentSupplier(supplier);
    setIsDeleteModalOpen(true);
  };

  const openDebtModal = (supplier: Supplier) => {
    setCurrentSupplier(supplier);
    setIsDebtModalOpen(true);
  };

  const handleAddSupplier = async () => {
    if (!userId || !restaurantId) return;
    if (!formData.name || !formData.contact) {
      toast.error(t('supplier_name_contact_required', language));
      return;
    }

    setIsSubmitting(true);
    try {
      await addSupplier({
        name: formData.name,
        contact: formData.contact,
        location: formData.location || undefined,
        email: formData.email || undefined,
        notes: formData.notes || undefined,
        userId,
        restaurantId
      });
      setIsAddModalOpen(false);
      resetForm();
      toast.success(t('supplier_added_successfully', language));
    } catch (err: any) {
      toast.error(err.message || t('error_adding_supplier', language));
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSupplier = async () => {
    if (!currentSupplier?.id || !restaurantId) return;
    if (!formData.name || !formData.contact) {
      toast.error(t('supplier_name_contact_required', language));
      return;
    }

    setIsSubmitting(true);
    try {
      await updateSupplier(currentSupplier.id, {
        name: formData.name,
        contact: formData.contact,
        location: formData.location || undefined,
        email: formData.email || undefined,
        notes: formData.notes || undefined
      });
      setIsEditModalOpen(false);
      resetForm();
      toast.success(t('supplier_updated_successfully', language));
    } catch (err: any) {
      toast.error(err.message || t('error_updating_supplier', language));
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!currentSupplier?.id || !restaurantId) return;

    setIsSubmitting(true);
    try {
      await deleteSupplier(currentSupplier.id);
      setIsDeleteModalOpen(false);
      setCurrentSupplier(null);
      toast.success(t('supplier_deleted_successfully', language));
    } catch (err: any) {
      toast.error(err.message || t('error_deleting_supplier', language));
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title={t('suppliers', language)}>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title={t('suppliers', language)}>
        <div className="text-center py-8 text-red-500">
          {t('error_loading_suppliers', language)}: {error}
        </div>
      </DashboardLayout>
    );
  }

  const tableColumns = [
    { header: t('supplier_name', language), accessor: 'name' as const },
    { header: t('contact', language), accessor: 'contact' as const },
    { header: t('location', language), accessor: 'location' as const },
    { header: t('debt', language), accessor: 'debt' as const },
    { header: t('actions', language), accessor: 'actions' as const }
  ];

  const tableData = filteredSuppliers.map(supplier => {
    const debt = getSupplierDebt(supplier.id || '');
    const outstandingDebt = debt?.outstanding || 0;

    return {
      id: supplier.id || '',
      name: supplier.name,
      contact: formatPhoneNumber(supplier.contact),
      location: supplier.location || '-',
      debt: (
        <div className="flex items-center gap-2">
          <span className={outstandingDebt > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
            {outstandingDebt > 0 ? `${outstandingDebt.toLocaleString()} XAF` : t('no_debt', language)}
          </span>
        </div>
      ),
      actions: (
        <div className="flex space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openDebtModal(supplier);
            }}
            className="text-blue-600 hover:text-blue-900 p-1"
            title={t('view_debt', language)}
          >
            <Eye size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(supplier);
            }}
            className="text-blue-600 hover:text-blue-900 p-1"
            title={t('edit', language)}
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openDeleteModal(supplier);
            }}
            className="text-red-600 hover:text-red-900 p-1"
            title={t('delete', language)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    };
  });

  return (
    <DashboardLayout title={t('suppliers', language)}>
      <div className="pb-20 md:pb-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{t('suppliers', language)}</h1>
            <p className="text-gray-600">{t('manage_suppliers', language)}</p>
          </div>

          <div className="mt-4 md:mt-0">
            <Button icon={<Plus size={16} />} onClick={openAddModal}>
              {t('add_supplier', language)}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('total_suppliers', language)}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalSuppliers}</p>
              </div>
              <Building2 className="text-blue-500" size={32} />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('total_debt', language)}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalDebt.toLocaleString()} XAF</p>
              </div>
              <DollarSign className="text-red-500" size={32} />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('suppliers_with_debt', language)}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.suppliersWithDebt}</p>
              </div>
              <TrendingUp className="text-orange-500" size={32} />
            </div>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder={t('search_suppliers', language)}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* Suppliers Table */}
        <Card>
          <Table
            data={tableData}
            columns={tableColumns}
            keyExtractor={(item) => item.id}
            emptyMessage={t('no_suppliers_found', language)}
          />
        </Card>

        {/* Add Supplier Modal */}
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            resetForm();
          }}
          title={t('add_supplier', language)}
        >
          <div className="space-y-4">
            <Input
              label={t('supplier_name', language)}
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder={t('supplier_name_placeholder', language)}
              required
            />

            <Input
              label={t('contact', language)}
              name="contact"
              value={formData.contact}
              onChange={handleInputChange}
              placeholder={t('contact_placeholder', language)}
              required
            />

            <Input
              label={t('location', language)}
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder={t('location_placeholder', language)}
            />

            <Input
              label={t('email', language)}
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder={t('email_placeholder', language)}
            />

            <Textarea
              label={t('notes', language)}
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder={t('notes_placeholder', language)}
              rows={3}
            />

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddModalOpen(false);
                  resetForm();
                }}
              >
                {t('cancel', language)}
              </Button>
              <Button
                onClick={handleAddSupplier}
                disabled={isSubmitting || !formData.name || !formData.contact}
                loading={isSubmitting}
              >
                {t('add_supplier', language)}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Edit Supplier Modal */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            resetForm();
          }}
          title={t('edit_supplier', language)}
        >
          <div className="space-y-4">
            <Input
              label={t('supplier_name', language)}
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder={t('supplier_name_placeholder', language)}
              required
            />

            <Input
              label={t('contact', language)}
              name="contact"
              value={formData.contact}
              onChange={handleInputChange}
              placeholder={t('contact_placeholder', language)}
              required
            />

            <Input
              label={t('location', language)}
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder={t('location_placeholder', language)}
            />

            <Input
              label={t('email', language)}
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder={t('email_placeholder', language)}
            />

            <Textarea
              label={t('notes', language)}
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder={t('notes_placeholder', language)}
              rows={3}
            />

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditModalOpen(false);
                  resetForm();
                }}
              >
                {t('cancel', language)}
              </Button>
              <Button
                onClick={handleEditSupplier}
                disabled={isSubmitting || !formData.name || !formData.contact}
                loading={isSubmitting}
              >
                {t('save_changes', language)}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Delete Supplier Modal */}
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setCurrentSupplier(null);
          }}
          title={t('delete_supplier', language)}
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              {t('delete_supplier_confirm', language)} <strong>{currentSupplier?.name}</strong>?
              {t('action_cannot_be_undone', language)}
            </p>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setCurrentSupplier(null);
                }}
              >
                {t('cancel', language)}
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteSupplier}
                disabled={isSubmitting}
                loading={isSubmitting}
              >
                {t('delete', language)}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Debt Modal */}
        {currentSupplier && (
          <SupplierDebtModal
            isOpen={isDebtModalOpen}
            onClose={() => {
              setIsDebtModalOpen(false);
              setCurrentSupplier(null);
            }}
            supplier={currentSupplier}
            restaurantId={restaurantId}
            userId={userId}
            onDebtUpdated={() => {
              // Reload debts
              getAllDebts().then(setSupplierDebts);
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default SuppliersPage;
