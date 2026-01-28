import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, MapPin, Warehouse as WarehouseIcon, Package, Search, UserCheck, Eye, Users, Power, PowerOff } from 'lucide-react';
import { SkeletonWarehouse, Input, Card, Badge, Button, Modal, ModalFooter, Textarea } from "@components/common";
import { useWarehouses, useProducts } from '@hooks/data/useFirestore';
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
import AssignUsersModal from '@components/shops/AssignUsersModal';
import { updateWarehouseUsers } from '@services/firestore/warehouse/warehouseService';
import { getAccessibleLocations } from '@utils/permissions/locationAccess';
import ToggleActiveModal from '@components/shops/ToggleActiveModal';

const Warehouse = () => {
  const { t } = useTranslation();
  const { warehouses, loading, error, addWarehouse, updateWarehouse, deleteWarehouse } = useWarehouses();
  const { products } = useProducts();
  const { user, company, isOwner, effectiveRole } = useAuth();
  const { canEdit, canDelete } = usePermissionCheck(RESOURCES.WAREHOUSE);
  const navigate = useNavigate();
  const { companyId } = useParams<{ companyId: string }>();
  const isActualOwner = isOwner || effectiveRole === 'owner';

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAssignUsersModalOpen, setIsAssignUsersModalOpen] = useState(false);
  const [selectedWarehouseForAssignment, setSelectedWarehouseForAssignment] = useState<Warehouse | null>(null);
  const [isToggleActiveModalOpen, setIsToggleActiveModalOpen] = useState(false);
  const [selectedWarehouseForToggle, setSelectedWarehouseForToggle] = useState<Warehouse | null>(null);
  const [isTogglingActive, setIsTogglingActive] = useState(false);
  
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

  // Product count summary state (number of unique products with stock)
  const [warehouseProductCount, setWarehouseProductCount] = useState<Record<string, number>>({});
  const [loadingStock, setLoadingStock] = useState(false);

  // Load product count for all warehouses (optimized with debouncing)
  React.useEffect(() => {
    if (!company?.id || warehouses.length === 0 || products.length === 0) {
      setWarehouseProductCount({});
      return;
    }

    let cancelled = false;

    const loadProductCount = async () => {
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
          
          // Count unique products with stock (excluding deleted/unavailable products)
          const productIdsWithStock = new Set<string>();
          
          batches.forEach((batch) => {
            // Skip if no product ID or no remaining quantity
            if (!batch.productId || !batch.remainingQuantity || batch.remainingQuantity <= 0) {
              return;
            }

            // Find the product
            const product = products.find(p => p.id === batch.productId);
            
            // Only count if product exists, is not deleted, and is available
            if (product && product.isDeleted !== true && product.isAvailable !== false) {
              productIdsWithStock.add(batch.productId);
            }
          });
          
          return { warehouseId: warehouse.id, productCount: productIdsWithStock.size };
        } catch (error) {
          console.error(`Error loading stock for warehouse ${warehouse.id}:`, error);
          return { warehouseId: warehouse.id, productCount: 0 };
        }
      });

      const results = await Promise.all(stockPromises);
      
      if (!cancelled) {
        results.forEach(({ warehouseId, productCount }) => {
          summary[warehouseId] = productCount;
        });
        setWarehouseProductCount(summary);
        setLoadingStock(false);
      }
    };

    // Debounce to avoid excessive calls
    const timeoutId = setTimeout(loadProductCount, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [warehouses, company?.id, products]);

  // Filter warehouses by permissions, active status, and search
  const filteredWarehouses = useMemo(() => {
    if (!user || !company) return [];
    
    // Create user object with required properties for permission check
    const userForPermissions = {
      id: user.uid,
      isOwner: isActualOwner,
      role: effectiveRole || undefined,
      companyId: company.id
    };
    
    // Filter by permissions (only show warehouses user can access)
    // For owners, show all warehouses regardless of permissions
    let accessibleWarehouses = isActualOwner 
      ? warehouses 
      : getAccessibleLocations(userForPermissions, warehouses, 'read');
    
    // Filter inactive warehouses for employees (owners/admins can see all)
    if (!isActualOwner) {
      accessibleWarehouses = accessibleWarehouses.filter(warehouse => warehouse.isActive !== false);
    }
    
    // Filter by search query
    if (!searchQuery) return accessibleWarehouses;
    
    const query = searchQuery.toLowerCase();
    return accessibleWarehouses.filter(warehouse =>
      warehouse.name.toLowerCase().includes(query) ||
      (warehouse.location && warehouse.location.toLowerCase().includes(query)) ||
      (warehouse.address && warehouse.address.toLowerCase().includes(query))
    );
  }, [warehouses, searchQuery, user, company, isActualOwner, effectiveRole]);

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

  const handleToggleActive = async () => {
    if (!selectedWarehouseForToggle || !user || !company) {
      showErrorToast(t('warehouse.messages.missingData'));
      return;
    }

    setIsTogglingActive(true);
    try {
      const newActiveStatus = !selectedWarehouseForToggle.isActive;
      await updateWarehouse(selectedWarehouseForToggle.id, { isActive: newActiveStatus }, company.id);
      showSuccessToast(
        newActiveStatus
          ? t('warehouse.messages.activateSuccess', { name: selectedWarehouseForToggle.name })
          : t('warehouse.messages.deactivateSuccess', { name: selectedWarehouseForToggle.name })
      );
      setIsToggleActiveModalOpen(false);
      setSelectedWarehouseForToggle(null);
    } catch (error: any) {
      const errorMessage = error.message || t('warehouse.messages.toggleActiveError');
      showErrorToast(errorMessage);
      console.error('Error toggling warehouse active status:', error);
    } finally {
      setIsTogglingActive(false);
    }
  };

  // Show skeleton if loading OR if no warehouses yet (initial load)
  if (loading || (warehouses.length === 0 && !error)) {
    return <SkeletonWarehouse />;
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
            icon={<ArrowRight size={20} />}
          >
            <span className="hidden sm:inline">Transferts</span>
            <span className="sm:hidden">Trans.</span>
          </PermissionButton>
          <PermissionButton
            resource={RESOURCES.WAREHOUSE}
            action="create"
            onClick={openAddModal}
            icon={<Plus size={20} />}
          >
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
              icon={<Plus size={20} />}
            >
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
                  {warehouse.isActive === false && (
                    <Badge variant="warning" className="text-xs">
                      {t('warehouse.inactive', 'Désactivé')}
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedWarehouseForToggle(warehouse);
                          setIsToggleActiveModalOpen(true);
                        }}
                        className={`h-8 w-8 p-0 ${
                          warehouse.isActive === false
                            ? 'text-green-600 hover:text-green-700'
                            : 'text-yellow-600 hover:text-yellow-700'
                        }`}
                        title={
                          warehouse.isActive === false
                            ? t('warehouse.activate', 'Activer')
                            : t('warehouse.deactivate', 'Désactiver')
                        }
                      >
                        {warehouse.isActive === false ? <Power size={16} /> : <PowerOff size={16} />}
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
                    {t('warehouse.stock')}: {loadingStock ? '...' : (warehouseProductCount[warehouse.id] || 0)} {t('warehouse.products')}
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

      {/* Toggle Active Modal */}
      {selectedWarehouseForToggle && (
        <ToggleActiveModal
          isOpen={isToggleActiveModalOpen}
          onClose={() => {
            setIsToggleActiveModalOpen(false);
            setSelectedWarehouseForToggle(null);
          }}
          onConfirm={handleToggleActive}
          location={selectedWarehouseForToggle}
          locationType="warehouse"
          isActivating={selectedWarehouseForToggle.isActive === false}
          isLoading={isTogglingActive}
        />
      )}
    </div>
  );
};

export default Warehouse;

