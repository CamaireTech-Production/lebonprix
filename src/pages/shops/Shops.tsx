import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, MapPin, Store, Users, Badge as BadgeIcon, Search, UserCheck, Eye } from 'lucide-react';
import { Card, Button, Badge, Modal, ModalFooter, Input, Textarea, Table, LoadingScreen } from '@components/common';
import { useShops } from '@hooks/data/useFirestore';
import { useAuth } from '@contexts/AuthContext';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import { PermissionButton, usePermissionCheck } from '@components/permissions';
import { RESOURCES } from '@constants/resources';
import type { Shop } from '../../types/models';
import { getStockBatchesByLocation } from '@services/firestore/stock/stockService';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import AssignUsersModal from '@components/shops/AssignUsersModal';
import { updateShopUsers } from '@services/firestore/shops/shopService';
import { getAccessibleLocations } from '@utils/permissions/locationAccess';

const Shops = () => {
  const { t } = useTranslation();
  const { shops, loading, error, addShop, updateShop, deleteShop } = useShops();
  const { user, company } = useAuth();
  const { canEdit, canDelete } = usePermissionCheck(RESOURCES.SHOPS);
  const navigate = useNavigate();
  const { companyId } = useParams<{ companyId: string }>();

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAssignUsersModalOpen, setIsAssignUsersModalOpen] = useState(false);
  const [selectedShopForAssignment, setSelectedShopForAssignment] = useState<Shop | null>(null);
  
  // Form states
  const [currentShop, setCurrentShop] = useState<Shop | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    address: '',
    phone: '',
    email: ''
  });

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');

  // Stock summary state
  const [shopStockSummary, setShopStockSummary] = useState<Record<string, number>>({});
  const [loadingStock, setLoadingStock] = useState(false);

  // Load stock summary for all shops (optimized with debouncing)
  React.useEffect(() => {
    if (!company?.id || shops.length === 0) {
      setShopStockSummary({});
      return;
    }

    let cancelled = false;

    const loadStockSummary = async () => {
      setLoadingStock(true);
      const summary: Record<string, number> = {};

      // Load stock in parallel for better performance
      const stockPromises = shops.map(async (shop) => {
        try {
          const batches = await getStockBatchesByLocation(
            company.id,
            'product',
            shop.id,
            undefined,
            'shop'
          );
          const totalStock = batches.reduce((sum, batch) => sum + (batch.remainingQuantity || 0), 0);
          return { shopId: shop.id, stock: totalStock };
        } catch (error) {
          console.error(`Error loading stock for shop ${shop.id}:`, error);
          return { shopId: shop.id, stock: 0 };
        }
      });

      const results = await Promise.all(stockPromises);
      
      if (!cancelled) {
        results.forEach(({ shopId, stock }) => {
          summary[shopId] = stock;
        });
        setShopStockSummary(summary);
        setLoadingStock(false);
      }
    };

    // Debounce to avoid excessive calls
    const timeoutId = setTimeout(loadStockSummary, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [shops, company?.id]);

  // Filter shops by permissions and search
  const filteredShops = useMemo(() => {
    if (!user || !company) return [];
    
    // Filter by permissions (only show shops user can access)
    const accessibleShops = getAccessibleLocations(user, shops, 'read');
    
    // Filter by search query
    if (!searchQuery) return accessibleShops;
    
    const query = searchQuery.toLowerCase();
    return accessibleShops.filter(shop =>
      shop.name.toLowerCase().includes(query) ||
      (shop.location && shop.location.toLowerCase().includes(query)) ||
      (shop.address && shop.address.toLowerCase().includes(query))
    );
  }, [shops, searchQuery, user, company]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      location: '',
      address: '',
      phone: '',
      email: ''
    });
  };

  const openAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const openEditModal = (shop: Shop) => {
    setCurrentShop(shop);
    setFormData({
      name: shop.name,
      location: shop.location || '',
      address: shop.address || '',
      phone: shop.phone || '',
      email: shop.email || ''
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (shop: Shop) => {
    setCurrentShop(shop);
    setIsDeleteModalOpen(true);
  };

  const handleAddShop = async () => {
    if (!formData.name.trim()) {
      showErrorToast(t('shops.messages.nameRequired'));
      return;
    }

    if (!user || !company) {
      showErrorToast(t('shops.messages.userNotAuthenticated'));
      return;
    }

    // Validate email format if provided
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      showErrorToast(t('shops.messages.invalidEmailFormat'));
      return;
    }

    setIsSubmitting(true);
    try {
      await addShop({
        name: formData.name.trim(),
        location: formData.location.trim() || null,
        address: formData.address.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        companyId: company.id,
        userId: user.uid,
        isDefault: false
      });
      
      showSuccessToast(t('shops.messages.createSuccess'));
      setIsAddModalOpen(false);
      resetForm();
    } catch (error: any) {
      const errorMessage = error.message || t('shops.messages.createError');
      showErrorToast(errorMessage);
      console.error('Error creating shop:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateShop = async () => {
    if (!formData.name.trim()) {
      showErrorToast(t('shops.messages.nameRequired'));
      return;
    }

    if (!currentShop || !user || !company) {
      showErrorToast(t('shops.messages.missingData'));
      return;
    }

    // Validate email format if provided
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      showErrorToast(t('shops.messages.invalidEmailFormat'));
      return;
    }

    setIsSubmitting(true);
    try {
      await updateShop(currentShop.id, {
        name: formData.name.trim(),
        location: formData.location.trim() || null,
        address: formData.address.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null
      });
      
      showSuccessToast(t('shops.messages.updateSuccess'));
      setIsEditModalOpen(false);
      setCurrentShop(null);
      resetForm();
    } catch (error: any) {
      const errorMessage = error.message || t('shops.messages.updateError');
      showErrorToast(errorMessage);
      console.error('Error updating shop:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteShop = async () => {
    if (!currentShop || !user || !company) {
      showErrorToast(t('shops.messages.missingData'));
      return;
    }

    // Prevent deletion of default shop if it's the only shop
    if (currentShop.isDefault && shops.length === 1) {
      showErrorToast(t('shops.messages.cannotDeleteDefaultOnly'));
      setIsDeleteModalOpen(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await deleteShop(currentShop.id);
      showSuccessToast(t('shops.messages.deleteSuccess'));
      setIsDeleteModalOpen(false);
      setCurrentShop(null);
    } catch (error: any) {
      const errorMessage = error.message || t('shops.messages.deleteError');
      showErrorToast(errorMessage);
      console.error('Error deleting shop:', error);
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('shops.title')}</h1>
          <p className="text-gray-600 mt-1">{t('shops.subtitle')}</p>
        </div>
        <PermissionButton
          resource={RESOURCES.SHOPS}
          action="create"
          onClick={openAddModal}
          className="flex items-center gap-2"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">{t('shops.newShop')}</span>
          <span className="sm:hidden">{t('shops.new')}</span>
        </PermissionButton>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <Input
          type="text"
          placeholder={t('shops.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Shops List */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error.message}
        </div>
      )}

      {filteredShops.length === 0 ? (
        <Card className="p-8 text-center">
          <Store className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('shops.noShops')}</h3>
          <p className="text-gray-600 mb-4">
            {searchQuery ? t('shops.noShopsMessage') : t('shops.noShopsEmpty')}
          </p>
          {!searchQuery && (
            <PermissionButton
              resource={RESOURCES.SHOPS}
              action="create"
              onClick={openAddModal}
            >
              <Plus size={20} className="mr-2" />
              {t('shops.createShop')}
            </PermissionButton>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredShops.map((shop) => (
            <Card
              key={shop.id}
              className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => {
                const cid = companyId || company?.id;
                if (cid) {
                  navigate(`/company/${cid}/shops/${shop.id}`);
                }
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-lg">{shop.name}</h3>
                  {shop.isDefault && (
                    <Badge variant="success" className="text-xs">
                      {t('shops.default')}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  {canEdit && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Empêcher la navigation vers le détail
                          event?.stopPropagation();
                          setSelectedShopForAssignment(shop);
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
                          openEditModal(shop);
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 size={16} />
                      </Button>
                    </>
                  )}
                  {canDelete && !shop.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        openDeleteModal(shop);
                      }}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                {shop.location && (
                  <div className="flex items-center gap-2">
                    <MapPin size={14} />
                    <span>{shop.location}</span>
                  </div>
                )}
                {shop.address && (
                  <div className="flex items-center gap-2">
                    <MapPin size={14} />
                    <span>{shop.address}</span>
                  </div>
                )}
                {shop.phone && (
                  <div className="flex items-center gap-2">
                    <span>📞</span>
                    <span>{shop.phone}</span>
                  </div>
                )}
                {shop.email && (
                  <div className="flex items-center gap-2">
                    <span>✉️</span>
                    <span>{shop.email}</span>
                  </div>
                )}
                {/* Assigned Users Display */}
                {(shop.assignedUsers && shop.assignedUsers.length > 0) || (shop.readOnlyUsers && shop.readOnlyUsers.length > 0) ? (
                  <div className="space-y-1">
                    {shop.assignedUsers && shop.assignedUsers.length > 0 && (
                      <div className="flex items-center gap-2">
                        <UserCheck size={14} className="text-green-600" />
                        <span className="text-xs">
                          {shop.assignedUsers.length} accès complet
                        </span>
                      </div>
                    )}
                    {shop.readOnlyUsers && shop.readOnlyUsers.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Eye size={14} className="text-blue-600" />
                        <span className="text-xs">
                          {shop.readOnlyUsers.length} lecture seule
                        </span>
                      </div>
                    )}
                  </div>
                ) : shop.isDefault ? (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Users size={14} />
                    <span>Accessible à tous les employés</span>
                  </div>
                ) : null}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <BadgeIcon size={14} />
                  <span className="font-medium">
                    {t('shops.stock')}: {loadingStock ? '...' : (shopStockSummary[shop.id] || 0)} {t('shops.products')}
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
        title={t('shops.addModal.title')}
        footer={
          <ModalFooter
            onCancel={() => {
              setIsAddModalOpen(false);
              resetForm();
            }}
            onConfirm={handleAddShop}
            cancelText={t('shops.addModal.cancel')}
            confirmText={t('shops.addModal.create')}
            isLoading={isSubmitting}
            disabled={!formData.name.trim()}
          />
        }
      >
        <div className="space-y-4">
          <Input
            label={t('shops.addModal.nameLabel')}
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder={t('shops.addModal.namePlaceholder')}
            required
          />
          <Input
            label={t('shops.addModal.locationLabel')}
            name="location"
            value={formData.location}
            onChange={handleInputChange}
            placeholder={t('shops.addModal.locationPlaceholder')}
          />
          <Textarea
            label={t('shops.addModal.addressLabel')}
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            placeholder={t('shops.addModal.addressPlaceholder')}
            rows={2}
          />
          <Input
            label={t('shops.addModal.phoneLabel')}
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            placeholder={t('shops.addModal.phonePlaceholder')}
          />
          <Input
            label={t('shops.addModal.emailLabel')}
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder={t('shops.addModal.emailPlaceholder')}
          />
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setCurrentShop(null);
          resetForm();
        }}
        title={t('shops.editModal.title')}
        footer={
          <ModalFooter
            onCancel={() => {
              setIsEditModalOpen(false);
              setCurrentShop(null);
              resetForm();
            }}
            onConfirm={handleUpdateShop}
            cancelText={t('shops.editModal.cancel')}
            confirmText={t('shops.editModal.update')}
            isLoading={isSubmitting}
            disabled={!formData.name.trim()}
          />
        }
      >
        <div className="space-y-4">
          <Input
            label={t('shops.editModal.nameLabel')}
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder={t('shops.editModal.namePlaceholder')}
            required
          />
          <Input
            label={t('shops.editModal.locationLabel')}
            name="location"
            value={formData.location}
            onChange={handleInputChange}
            placeholder={t('shops.editModal.locationPlaceholder')}
          />
          <Textarea
            label={t('shops.editModal.addressLabel')}
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            placeholder={t('shops.editModal.addressPlaceholder')}
            rows={2}
          />
          <Input
            label={t('shops.editModal.phoneLabel')}
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            placeholder={t('shops.editModal.phonePlaceholder')}
          />
          <Input
            label={t('shops.editModal.emailLabel')}
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder={t('shops.editModal.emailPlaceholder')}
          />
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setCurrentShop(null);
        }}
        title={t('shops.deleteModal.title')}
        footer={
          <ModalFooter
            onCancel={() => {
              setIsDeleteModalOpen(false);
              setCurrentShop(null);
            }}
            onConfirm={handleDeleteShop}
            cancelText={t('shops.deleteModal.cancel')}
            confirmText={t('shops.deleteModal.delete')}
            isLoading={isSubmitting}
            variant="danger"
          />
        }
      >
        <p className="text-gray-700" dangerouslySetInnerHTML={{
          __html: t('shops.deleteModal.message', { name: currentShop?.name })
        }} />
        {currentShop?.isDefault && (
          <p className="text-red-600 mt-2 text-sm">
            {t('shops.deleteModal.defaultWarning')}
          </p>
        )}
      </Modal>

      {/* Assign Users Modal */}
      {selectedShopForAssignment && (
        <AssignUsersModal
          isOpen={isAssignUsersModalOpen}
          onClose={() => {
            setIsAssignUsersModalOpen(false);
            setSelectedShopForAssignment(null);
          }}
          locationType="shop"
          locationId={selectedShopForAssignment.id}
          locationName={selectedShopForAssignment.name}
          currentAssignedUsers={selectedShopForAssignment.assignedUsers || []}
          currentReadOnlyUsers={selectedShopForAssignment.readOnlyUsers || []}
          onUpdate={async (assignedUsers, readOnlyUsers) => {
            if (!company?.id) return;
            await updateShopUsers(
              selectedShopForAssignment.id,
              assignedUsers,
              readOnlyUsers,
              company.id
            );
            // Refresh shops list will happen automatically via subscription
          }}
        />
      )}
    </div>
  );
};

export default Shops;

