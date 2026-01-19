import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, MapPin, Warehouse as WarehouseIcon, Package, Search } from 'lucide-react';
import { Card, Button, Badge, Modal, ModalFooter, Input, Textarea, LoadingScreen } from '@components/common';
import { useWarehouses } from '@hooks/data/useFirestore';
import { useAuth } from '@contexts/AuthContext';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import { PermissionButton, usePermissionCheck } from '@components/permissions';
import { RESOURCES } from '@constants/resources';
import type { Warehouse } from '../../types/models';
import { getStockBatchesByLocation } from '@services/firestore/stock/stockService';

const Warehouse = () => {
  const { warehouses, loading, error, addWarehouse, updateWarehouse, deleteWarehouse } = useWarehouses();
  const { user, company } = useAuth();
  const { canEdit, canDelete } = usePermissionCheck(RESOURCES.WAREHOUSE);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
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

  // Load stock summary for all warehouses
  React.useEffect(() => {
    if (!company?.id || warehouses.length === 0) return;

    const loadStockSummary = async () => {
      setLoadingStock(true);
      const summary: Record<string, number> = {};

      for (const warehouse of warehouses) {
        try {
          const batches = await getStockBatchesByLocation(
            company.id,
            'product',
            undefined,
            warehouse.id,
            'warehouse'
          );
          const totalStock = batches.reduce((sum, batch) => sum + (batch.remainingQuantity || 0), 0);
          summary[warehouse.id] = totalStock;
        } catch (error) {
          console.error(`Error loading stock for warehouse ${warehouse.id}:`, error);
          summary[warehouse.id] = 0;
        }
      }

      setWarehouseStockSummary(summary);
      setLoadingStock(false);
    };

    loadStockSummary();
  }, [warehouses, company?.id]);

  // Filter warehouses
  const filteredWarehouses = useMemo(() => {
    if (!searchQuery) return warehouses;
    
    const query = searchQuery.toLowerCase();
    return warehouses.filter(warehouse =>
      warehouse.name.toLowerCase().includes(query) ||
      (warehouse.location && warehouse.location.toLowerCase().includes(query)) ||
      (warehouse.address && warehouse.address.toLowerCase().includes(query))
    );
  }, [warehouses, searchQuery]);

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
      showErrorToast('Le nom de l\'entrepôt est requis');
      return;
    }

    if (!user || !company) {
      showErrorToast('Utilisateur non authentifié');
      return;
    }

    setIsSubmitting(true);
    try {
      await addWarehouse({
        name: formData.name.trim(),
        location: formData.location.trim() || undefined,
        address: formData.address.trim() || undefined,
        companyId: company.id,
        userId: user.uid,
        isDefault: false
      });
      
      showSuccessToast('Entrepôt créé avec succès');
      setIsAddModalOpen(false);
      resetForm();
    } catch (error: any) {
      showErrorToast(error.message || 'Erreur lors de la création de l\'entrepôt');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateWarehouse = async () => {
    if (!formData.name.trim()) {
      showErrorToast('Le nom de l\'entrepôt est requis');
      return;
    }

    if (!currentWarehouse || !user || !company) {
      showErrorToast('Données manquantes');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateWarehouse(currentWarehouse.id, {
        name: formData.name.trim(),
        location: formData.location.trim() || undefined,
        address: formData.address.trim() || undefined
      });
      
      showSuccessToast('Entrepôt mis à jour avec succès');
      setIsEditModalOpen(false);
      setCurrentWarehouse(null);
      resetForm();
    } catch (error: any) {
      showErrorToast(error.message || 'Erreur lors de la mise à jour de l\'entrepôt');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWarehouse = async () => {
    if (!currentWarehouse || !user || !company) {
      showErrorToast('Données manquantes');
      return;
    }

    setIsSubmitting(true);
    try {
      await deleteWarehouse(currentWarehouse.id);
      showSuccessToast('Entrepôt supprimé avec succès');
      setIsDeleteModalOpen(false);
      setCurrentWarehouse(null);
    } catch (error: any) {
      showErrorToast(error.message || 'Erreur lors de la suppression de l\'entrepôt');
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Entrepôts Produits</h1>
          <p className="text-gray-600 mt-1">Gérez vos entrepôts de produits finis</p>
        </div>
        <PermissionButton
          resource={RESOURCES.WAREHOUSE}
          action="create"
          onClick={openAddModal}
          className="flex items-center gap-2"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Nouvel Entrepôt</span>
          <span className="sm:hidden">Nouveau</span>
        </PermissionButton>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <Input
          type="text"
          placeholder="Rechercher un entrepôt..."
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
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun entrepôt</h3>
          <p className="text-gray-600 mb-4">
            {searchQuery ? 'Aucun entrepôt ne correspond à votre recherche' : 'Commencez par créer votre premier entrepôt'}
          </p>
          {!searchQuery && (
            <PermissionButton
              resource={RESOURCES.WAREHOUSE}
              action="create"
              onClick={openAddModal}
            >
              <Plus size={20} className="mr-2" />
              Créer un entrepôt
            </PermissionButton>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWarehouses.map((warehouse) => (
            <Card key={warehouse.id} className="p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <WarehouseIcon className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-lg">{warehouse.name}</h3>
                  {warehouse.isDefault && (
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
                      onClick={() => openEditModal(warehouse)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 size={16} />
                    </Button>
                  )}
                  {canDelete && !warehouse.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDeleteModal(warehouse)}
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
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Package size={14} />
                  <span className="font-medium">
                    Stock: {loadingStock ? '...' : (warehouseStockSummary[warehouse.id] || 0)} produits
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
        title="Nouvel Entrepôt"
        footer={
          <ModalFooter
            onCancel={() => {
              setIsAddModalOpen(false);
              resetForm();
            }}
            onConfirm={handleAddWarehouse}
            cancelText="Annuler"
            confirmText="Créer"
            isLoading={isSubmitting}
            disabled={!formData.name.trim()}
          />
        }
      >
        <div className="space-y-4">
          <Input
            label="Nom de l'entrepôt *"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Ex: Entrepôt Principal"
            required
          />
          <Input
            label="Localisation"
            name="location"
            value={formData.location}
            onChange={handleInputChange}
            placeholder="Ex: Zone industrielle"
          />
          <Textarea
            label="Adresse complète"
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            placeholder="Adresse complète de l'entrepôt"
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
        title="Modifier l'Entrepôt"
        footer={
          <ModalFooter
            onCancel={() => {
              setIsEditModalOpen(false);
              setCurrentWarehouse(null);
              resetForm();
            }}
            onConfirm={handleUpdateWarehouse}
            cancelText="Annuler"
            confirmText="Mettre à jour"
            isLoading={isSubmitting}
            disabled={!formData.name.trim()}
          />
        }
      >
        <div className="space-y-4">
          <Input
            label="Nom de l'entrepôt *"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Ex: Entrepôt Principal"
            required
          />
          <Input
            label="Localisation"
            name="location"
            value={formData.location}
            onChange={handleInputChange}
            placeholder="Ex: Zone industrielle"
          />
          <Textarea
            label="Adresse complète"
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            placeholder="Adresse complète de l'entrepôt"
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
        title="Supprimer l'Entrepôt"
        footer={
          <ModalFooter
            onCancel={() => {
              setIsDeleteModalOpen(false);
              setCurrentWarehouse(null);
            }}
            onConfirm={handleDeleteWarehouse}
            cancelText="Annuler"
            confirmText="Supprimer"
            isLoading={isSubmitting}
            variant="danger"
          />
        }
      >
        <p className="text-gray-700">
          Êtes-vous sûr de vouloir supprimer l'entrepôt <strong>{currentWarehouse?.name}</strong> ?
          Cette action est irréversible.
        </p>
        {currentWarehouse?.isDefault && (
          <p className="text-red-600 mt-2 text-sm">
            ⚠️ Cet entrepôt est l'entrepôt par défaut. Vous ne pouvez pas le supprimer s'il est le seul entrepôt.
          </p>
        )}
      </Modal>
    </div>
  );
};

export default Warehouse;

