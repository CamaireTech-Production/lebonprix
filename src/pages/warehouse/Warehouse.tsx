import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, MapPin, Warehouse as WarehouseIcon, Package, Search, UserCheck, Eye, Users } from 'lucide-react';
import { Card, Button, Badge, Modal, ModalFooter, Input, Textarea, LoadingScreen } from '@components/common';
import { useWarehouses } from '@hooks/data/useFirestore';
import { useAuth } from '@contexts/AuthContext';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import { PermissionButton, usePermissionCheck } from '@components/permissions';
import { RESOURCES } from '@constants/resources';
import type { Warehouse } from '../../types/models';
import { getStockBatchesByLocation } from '@services/firestore/stock/stockService';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import LocationTransfersModal from '@components/stock/LocationTransfersModal';
import { ArrowRight } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import AssignUsersModal from '@components/shops/AssignUsersModal';
import { updateWarehouseUsers } from '@services/firestore/warehouse/warehouseService';
import { getAccessibleLocations } from '@utils/permissions/locationAccess';

const Warehouse = () => {
  const { t } = useTranslation();
  const { warehouses, loading, error, addWarehouse, updateWarehouse, deleteWarehouse } = useWarehouses();
  const { user, company } = useAuth();
  const { canEdit, canDelete } = usePermissionCheck(RESOURCES.WAREHOUSE);
  const navigate = useNavigate();
  const { companyId } = useParams<{ companyId: string }>();

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAssignUsersModalOpen, setIsAssignUsersModalOpen] = useState(false);
  const [selectedWarehouseForAssignment, setSelectedWarehouseForAssignment] = useState<Warehouse | null>(null);
  
  // Form states
  const [currentWarehouse, setCurrentWarehouse] = useState<Warehouse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    address: ''
  });

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');

  // Stock summary state
  const [warehouseStockSummary, setWarehouseStockSummary] = useState<Record<string, number>>({});
  const [loadingStock, setLoadingStock] = useState(false);

  // Load stock summary for all warehouses (optimized with debouncing)
  React.useEffect(() => {
    if (!company?.id || warehouses.length === 0) {
      setWarehouseStockSummary({});
      return;
    }

    let cancelled = false;

    const loadStockSummary = async () => {
      setLoadingStock(true);
      const summary: Record<string, number> = {};

      // Load stock in parallel for better performance
      const stockPromises = warehouses.map(async (warehouse) => {
        try {
          const batches = await getStockBatchesByLocation(
            company.id,
            'product',
            undefined,
            warehouse.id,
            'warehouse'
          );
          const totalStock = batches.reduce((sum, batch) => sum + (batch.remainingQuantity || 0), 0);
          return { warehouseId: warehouse.id, stock: totalStock };
        } catch (error) {
          console.error(`Error loading stock for warehouse ${warehouse.id}:`, error);
          return { warehouseId: warehouse.id, stock: 0 };
        }
      });

      const results = await Promise.all(stockPromises);
      
      if (!cancelled) {
        results.forEach(({ warehouseId, stock }) => {
          summary[warehouseId] = stock;
        });
        setWarehouseStockSummary(summary);
        setLoadingStock(false);
      }
    };

    // Debounce to avoid excessive calls
    const timeoutId = setTimeout(loadStockSummary, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [warehouses, company?.id]);

  // Filter warehouses by permissions and search
  const filteredWarehouses = useMemo(() => {
    if (!user || !company) return [];
    
    // Filter by permissions (only show warehouses user can access)
    const accessibleWarehouses = getAccessibleLocations(user, warehouses, 'read');
    
    // Filter by search query
    if (!searchQuery) return accessibleWarehouses;
    
    const query = searchQuery.toLowerCase();
    return accessibleWarehouses.filter(warehouse =>
      warehouse.name.toLowerCase().includes(query) ||
      (warehouse.location && warehouse.location.toLowerCase().includes(query)) ||
      (warehouse.address && warehouse.address.toLowerCase().includes(query))
    );
  }, [warehouses, searchQuery, user, company]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      location: '',
      address: ''
    });
  };

  const openAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const openEditModal = (warehouse: Warehouse) => {
    setCurrentWarehouse(warehouse);
    setFormData({
      name: warehouse.name,
      location: warehouse.location || '',
      address: warehouse.address || ''
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (warehouse: Warehouse) => {
    setCurrentWarehouse(warehouse);
    setIsDeleteModalOpen(true);
  };

  const handleAddWarehouse = async () => {
    if (!formData.name.trim()) {
      showErrorToast(t('warehouse.messages.nameRequired'));
      return;
    }

    if (!user || !company) {
      showErrorToast(t('warehouse.messages.userNotAuthenticated'));
      return;
    }

    setIsSubmitting(true);
    try {
      await addWarehouse({
        name: formData.name.trim(),
        location: formData.location.trim() || null,
        address: formData.address.trim() || null,
        companyId: company.id,
        userId: user.uid,
        isDefault: false
      });
      
      showSuccessToast(t('warehouse.messages.createSuccess'));
      setIsAddModalOpen(false);
      resetForm();
    } catch (error: any) {
      showErrorToast(error.message || t('warehouse.messages.createError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateWarehouse = async () => {
    if (!formData.name.trim()) {
      showErrorToast(t('warehouse.messages.nameRequired'));
      return;
    }

    if (!currentWarehouse || !user || !company) {
      showErrorToast(t('warehouse.messages.missingData'));
      return;
    }

    setIsSubmitting(true);
    try {
      await updateWarehouse(currentWarehouse.id, {
        name: formData.name.trim(),
        location: formData.location.trim() || null,
        address: formData.address.trim() || null
      });
      
      showSuccessToast(t('warehouse.messages.updateSuccess'));
      setIsEditModalOpen(false);
      setCurrentWarehouse(null);
      resetForm();
    } catch (error: any) {
      showErrorToast(error.message || t('warehouse.messages.updateError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWarehouse = async () => {
    if (!currentWarehouse || !user || !company) {
      showErrorToast(t('warehouse.messages.missingData'));
      return;
    }

    // Prevent deletion of default warehouse if it's the only warehouse
    if (currentWarehouse.isDefault && warehouses.length === 1) {
      showErrorToast(t('warehouse.messages.cannotDeleteDefaultOnly'));
      setIsDeleteModalOpen(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await deleteWarehouse(currentWarehouse.id);
      showSuccessToast(t('warehouse.messages.deleteSuccess'));
      setIsDeleteModalOpen(false);
      setCurrentWarehouse(null);
    } catch (error: any) {
      const errorMessage = error.message || t('warehouse.messages.deleteError');
      showErrorToast(errorMessage);
      console.error('Error deleting warehouse:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('warehouse.title')}</h1>
          <p className="text-gray-600 mt-1">{t('warehouse.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <PermissionButton
            resource={RESOURCES.PRODUCTS}
            action="create"
            onClick={() => {
              const cid = companyId || company?.id;
              if (cid) {
                navigate(`/company/${cid}/stock-transfers`);
              }
            }}
            className="flex items-center gap-2"
          >
            <ArrowRight size={20} />
            <span className="hidden sm:inline">Transferts</span>
            <span className="sm:hidden">Trans.</span>
          </PermissionButton>
          <PermissionButton
            resource={RESOURCES.WAREHOUSE}
            action="create"
            onClick={openAddModal}
            className="flex items-center gap-2"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">{t('warehouse.newWarehouse')}</span>
            <span className="sm:hidden">{t('warehouse.new')}</span>
          </PermissionButton>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <Input
          type="text"
          placeholder={t('warehouse.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Warehouses List */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error.message}
        </div>
      )}

      {filteredWarehouses.length === 0 ? (
        <Card className="p-8 text-center">
          <WarehouseIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('warehouse.noWarehouses')}</h3>
          <p className="text-gray-600 mb-4">
            {searchQuery ? t('warehouse.noWarehousesMessage') : t('warehouse.noWarehousesEmpty')}
          </p>
          {!searchQuery && (
            <PermissionButton
              resource={RESOURCES.WAREHOUSE}
              action="create"
              onClick={openAddModal}
            >
              <Plus size={20} className="mr-2" />
              {t('warehouse.createWarehouse')}
            </PermissionButton>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWarehouses.map((warehouse) => (
            <Card
              key={warehouse.id}
              className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => {
                const cid = companyId || company?.id;
                if (cid) {
                  navigate(`/company/${cid}/warehouse/${warehouse.id}`);
                }
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <WarehouseIcon className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-lg">{warehouse.name}</h3>
                  {warehouse.isDefault && (
                    <Badge variant="success" className="text-xs">
                      {t('warehouse.default')}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  {canEdit && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedWarehouseForAssignment(warehouse);
                          setIsAssignUsersModalOpen(true);
                        }}
                        className="h-8 w-8 p-0"
                        title="Assigner des utilisateurs"
                      >
                        <Users size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditModal(warehouse);
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 size={16} />
                      </Button>
                    </>
                  )}
                  {canDelete && !warehouse.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        openDeleteModal(warehouse);
                      }}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                {warehouse.location && (
                  <div className="flex items-center gap-2">
                    <MapPin size={14} />
                    <span>{warehouse.location}</span>
                  </div>
                )}
                {warehouse.address && (
                  <div className="flex items-center gap-2">
                    <MapPin size={14} />
                    <span>{warehouse.address}</span>
                  </div>
                )}
                {/* Assigned Users Display */}
                {(warehouse.assignedUsers && warehouse.assignedUsers.length > 0) || (warehouse.readOnlyUsers && warehouse.readOnlyUsers.length > 0) ? (
                  <div className="space-y-1">
                    {warehouse.assignedUsers && warehouse.assignedUsers.length > 0 && (
                      <div className="flex items-center gap-2">
                        <UserCheck size={14} className="text-green-600" />
                        <span className="text-xs">
                          {warehouse.assignedUsers.length} accès complet
                        </span>
                      </div>
                    )}
                    {warehouse.readOnlyUsers && warehouse.readOnlyUsers.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Eye size={14} className="text-blue-600" />
                        <span className="text-xs">
                          {warehouse.readOnlyUsers.length} lecture seule
                        </span>
                      </div>
                    )}
                  </div>
                ) : warehouse.isDefault ? (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Users size={14} />
                    <span>Accessible à tous les employés</span>
                  </div>
                ) : null}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Package size={14} />
                  <span className="font-medium">
                    {t('warehouse.stock')}: {loadingStock ? '...' : (warehouseStockSummary[warehouse.id] || 0)} {t('warehouse.products')}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          resetForm();
        }}
        title={t('warehouse.addModal.title')}
        footer={
          <ModalFooter
            onCancel={() => {
              setIsAddModalOpen(false);
              resetForm();
            }}
            onConfirm={handleAddWarehouse}
            cancelText={t('warehouse.addModal.cancel')}
            confirmText={t('warehouse.addModal.create')}
            isLoading={isSubmitting}
            disabled={!formData.name.trim()}
          />
        }
      >
        <div className="space-y-4">
          <Input
            label={t('warehouse.addModal.nameLabel')}
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder={t('warehouse.addModal.namePlaceholder')}
            required
          />
          <Input
            label={t('warehouse.addModal.locationLabel')}
            name="location"
            value={formData.location}
            onChange={handleInputChange}
            placeholder={t('warehouse.addModal.locationPlaceholder')}
          />
          <Textarea
            label={t('warehouse.addModal.addressLabel')}
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            placeholder={t('warehouse.addModal.addressPlaceholder')}
            rows={2}
          />
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setCurrentWarehouse(null);
          resetForm();
        }}
        title={t('warehouse.editModal.title')}
        footer={
          <ModalFooter
            onCancel={() => {
              setIsEditModalOpen(false);
              setCurrentWarehouse(null);
              resetForm();
            }}
            onConfirm={handleUpdateWarehouse}
            cancelText={t('warehouse.editModal.cancel')}
            confirmText={t('warehouse.editModal.update')}
            isLoading={isSubmitting}
            disabled={!formData.name.trim()}
          />
        }
      >
        <div className="space-y-4">
          <Input
            label={t('warehouse.editModal.nameLabel')}
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder={t('warehouse.editModal.namePlaceholder')}
            required
          />
          <Input
            label={t('warehouse.editModal.locationLabel')}
            name="location"
            value={formData.location}
            onChange={handleInputChange}
            placeholder={t('warehouse.editModal.locationPlaceholder')}
          />
          <Textarea
            label={t('warehouse.editModal.addressLabel')}
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            placeholder={t('warehouse.editModal.addressPlaceholder')}
            rows={2}
          />
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setCurrentWarehouse(null);
        }}
        title={t('warehouse.deleteModal.title')}
        footer={
          <ModalFooter
            onCancel={() => {
              setIsDeleteModalOpen(false);
              setCurrentWarehouse(null);
            }}
            onConfirm={handleDeleteWarehouse}
            cancelText={t('warehouse.deleteModal.cancel')}
            confirmText={t('warehouse.deleteModal.delete')}
            isLoading={isSubmitting}
            variant="danger"
          />
        }
      >
        <p className="text-gray-700" dangerouslySetInnerHTML={{
          __html: t('warehouse.deleteModal.message', { name: currentWarehouse?.name })
        }} />
        {currentWarehouse?.isDefault && (
          <p className="text-red-600 mt-2 text-sm">
            {t('warehouse.deleteModal.defaultWarning')}
          </p>
        )}
      </Modal>

      {/* Assign Users Modal */}
      {selectedWarehouseForAssignment && (
        <AssignUsersModal
          isOpen={isAssignUsersModalOpen}
          onClose={() => {
            setIsAssignUsersModalOpen(false);
            setSelectedWarehouseForAssignment(null);
          }}
          locationType="warehouse"
          locationId={selectedWarehouseForAssignment.id}
          locationName={selectedWarehouseForAssignment.name}
          currentAssignedUsers={selectedWarehouseForAssignment.assignedUsers || []}
          currentReadOnlyUsers={selectedWarehouseForAssignment.readOnlyUsers || []}
          onUpdate={async (assignedUsers, readOnlyUsers) => {
            if (!company?.id) return;
            await updateWarehouseUsers(
              selectedWarehouseForAssignment.id,
              assignedUsers,
              readOnlyUsers,
              company.id
            );
            // Refresh warehouses list will happen automatically via subscription
          }}
        />
      )}
    </div>
  );
};

export default Warehouse;

