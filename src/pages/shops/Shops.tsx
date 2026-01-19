import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, MapPin, Store, Users, Badge as BadgeIcon, Search } from 'lucide-react';
import { Card, Button, Badge, Modal, ModalFooter, Input, Textarea, Table, LoadingScreen } from '@components/common';
import { useShops } from '@hooks/data/useFirestore';
import { useAuth } from '@contexts/AuthContext';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import { PermissionButton, usePermissionCheck } from '@components/permissions';
import { RESOURCES } from '@constants/resources';
import type { Shop } from '../../types/models';
import { getStockBatchesByLocation } from '@services/firestore/stock/stockService';

const Shops = () => {
  const { shops, loading, error, addShop, updateShop, deleteShop } = useShops();
  const { user, company } = useAuth();
  const { canEdit, canDelete } = usePermissionCheck(RESOURCES.SHOPS);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
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

  // Filter shops
  const filteredShops = useMemo(() => {
    if (!searchQuery) return shops;
    
    const query = searchQuery.toLowerCase();
    return shops.filter(shop =>
      shop.name.toLowerCase().includes(query) ||
      (shop.location && shop.location.toLowerCase().includes(query)) ||
      (shop.address && shop.address.toLowerCase().includes(query))
    );
  }, [shops, searchQuery]);

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
      showErrorToast('Le nom du magasin est requis');
      return;
    }

    if (!user || !company) {
      showErrorToast('Utilisateur non authentifié');
      return;
    }

    // Validate email format if provided
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      showErrorToast('Format d\'email invalide');
      return;
    }

    setIsSubmitting(true);
    try {
      await addShop({
        name: formData.name.trim(),
        location: formData.location.trim() || undefined,
        address: formData.address.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        email: formData.email.trim() || undefined,
        companyId: company.id,
        userId: user.uid,
        isDefault: false
      });
      
      showSuccessToast('Magasin créé avec succès');
      setIsAddModalOpen(false);
      resetForm();
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur lors de la création du magasin';
      showErrorToast(errorMessage);
      console.error('Error creating shop:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateShop = async () => {
    if (!formData.name.trim()) {
      showErrorToast('Le nom du magasin est requis');
      return;
    }

    if (!currentShop || !user || !company) {
      showErrorToast('Données manquantes');
      return;
    }

    // Validate email format if provided
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      showErrorToast('Format d\'email invalide');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateShop(currentShop.id, {
        name: formData.name.trim(),
        location: formData.location.trim() || undefined,
        address: formData.address.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        email: formData.email.trim() || undefined
      });
      
      showSuccessToast('Magasin mis à jour avec succès');
      setIsEditModalOpen(false);
      setCurrentShop(null);
      resetForm();
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur lors de la mise à jour du magasin';
      showErrorToast(errorMessage);
      console.error('Error updating shop:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteShop = async () => {
    if (!currentShop || !user || !company) {
      showErrorToast('Données manquantes');
      return;
    }

    // Prevent deletion of default shop if it's the only shop
    if (currentShop.isDefault && shops.length === 1) {
      showErrorToast('Impossible de supprimer le magasin par défaut s\'il est le seul magasin');
      setIsDeleteModalOpen(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await deleteShop(currentShop.id);
      showSuccessToast('Magasin supprimé avec succès');
      setIsDeleteModalOpen(false);
      setCurrentShop(null);
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur lors de la suppression du magasin';
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Boutiques</h1>
          <p className="text-gray-600 mt-1">Gérez vos points de vente</p>
        </div>
        <PermissionButton
          resource={RESOURCES.SHOPS}
          action="create"
          onClick={openAddModal}
          className="flex items-center gap-2"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Nouveau Magasin</span>
          <span className="sm:hidden">Nouveau</span>
        </PermissionButton>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <Input
          type="text"
          placeholder="Rechercher un magasin..."
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
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun magasin</h3>
          <p className="text-gray-600 mb-4">
            {searchQuery ? 'Aucun magasin ne correspond à votre recherche' : 'Commencez par créer votre premier magasin'}
          </p>
          {!searchQuery && (
            <PermissionButton
              resource={RESOURCES.SHOPS}
              action="create"
              onClick={openAddModal}
            >
              <Plus size={20} className="mr-2" />
              Créer un magasin
            </PermissionButton>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredShops.map((shop) => (
            <Card key={shop.id} className="p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-lg">{shop.name}</h3>
                  {shop.isDefault && (
                    <Badge variant="success" className="text-xs">
                      Par défaut
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(shop)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 size={16} />
                    </Button>
                  )}
                  {canDelete && !shop.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDeleteModal(shop)}
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
                {shop.assignedUsers && shop.assignedUsers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Users size={14} />
                    <span>{shop.assignedUsers.length} utilisateur(s)</span>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <BadgeIcon size={14} />
                  <span className="font-medium">
                    Stock: {loadingStock ? '...' : (shopStockSummary[shop.id] || 0)} produits
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
        title="Nouveau Magasin"
        footer={
          <ModalFooter
            onCancel={() => {
              setIsAddModalOpen(false);
              resetForm();
            }}
            onConfirm={handleAddShop}
            cancelText="Annuler"
            confirmText="Créer"
            isLoading={isSubmitting}
            disabled={!formData.name.trim()}
          />
        }
      >
        <div className="space-y-4">
          <Input
            label="Nom du magasin *"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Ex: Boutique Centre-Ville"
            required
          />
          <Input
            label="Localisation"
            name="location"
            value={formData.location}
            onChange={handleInputChange}
            placeholder="Ex: Centre-ville"
          />
          <Textarea
            label="Adresse complète"
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            placeholder="Adresse complète du magasin"
            rows={2}
          />
          <Input
            label="Téléphone"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            placeholder="+237 6XX XXX XXX"
          />
          <Input
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="boutique@example.com"
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
        title="Modifier le Magasin"
        footer={
          <ModalFooter
            onCancel={() => {
              setIsEditModalOpen(false);
              setCurrentShop(null);
              resetForm();
            }}
            onConfirm={handleUpdateShop}
            cancelText="Annuler"
            confirmText="Mettre à jour"
            isLoading={isSubmitting}
            disabled={!formData.name.trim()}
          />
        }
      >
        <div className="space-y-4">
          <Input
            label="Nom du magasin *"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Ex: Boutique Centre-Ville"
            required
          />
          <Input
            label="Localisation"
            name="location"
            value={formData.location}
            onChange={handleInputChange}
            placeholder="Ex: Centre-ville"
          />
          <Textarea
            label="Adresse complète"
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            placeholder="Adresse complète du magasin"
            rows={2}
          />
          <Input
            label="Téléphone"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            placeholder="+237 6XX XXX XXX"
          />
          <Input
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="boutique@example.com"
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
        title="Supprimer le Magasin"
        footer={
          <ModalFooter
            onCancel={() => {
              setIsDeleteModalOpen(false);
              setCurrentShop(null);
            }}
            onConfirm={handleDeleteShop}
            cancelText="Annuler"
            confirmText="Supprimer"
            isLoading={isSubmitting}
            variant="danger"
          />
        }
      >
        <p className="text-gray-700">
          Êtes-vous sûr de vouloir supprimer le magasin <strong>{currentShop?.name}</strong> ?
          Cette action est irréversible.
        </p>
        {currentShop?.isDefault && (
          <p className="text-red-600 mt-2 text-sm">
            ⚠️ Ce magasin est le magasin par défaut. Vous ne pouvez pas le supprimer s'il est le seul magasin.
          </p>
        )}
      </Modal>
    </div>
  );
};

export default Shops;

