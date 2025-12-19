import { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, Package, Grid3X3 } from 'lucide-react';
import { Card, Button, Input, Badge, Modal, ModalFooter, ImageWithSkeleton } from '@components/common';
import { useMatieres } from '@hooks/business/useMatieres';
import { useCategories } from '@hooks/data/useFirestore';
import MatiereFormModal from '../../components/magasin/MatiereFormModal';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import type { Matiere } from '../../types/models';

const Matieres = () => {
  const { matieres, loading, error, addMatiere, updateMatiereData, deleteMatiereData } = useMatieres();
  const { categories } = useCategories();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentMatiere, setCurrentMatiere] = useState<Matiere | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filter matieres
  const filteredMatieres = useMemo(() => {
    let filtered = matieres;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.name.toLowerCase().includes(query) ||
        (m.description && m.description.toLowerCase().includes(query))
      );
    }

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(m => m.refCategorie === selectedCategory);
    }

    return filtered;
  }, [matieres, searchQuery, selectedCategory]);

  // Get unique categories from matieres
  const availableCategories = useMemo(() => {
    const cats = ['All', ...new Set(matieres.map(m => m.refCategorie).filter(Boolean))];
    return cats;
  }, [matieres]);

  const handleDelete = async () => {
    if (!currentMatiere) return;

    try {
      await deleteMatiereData(currentMatiere.id);
      showSuccessToast('Matière supprimée avec succès');
      setIsDeleteModalOpen(false);
      setCurrentMatiere(null);
    } catch (error: any) {
      showErrorToast(error.message || 'Erreur lors de la suppression');
    }
  };

  const openEditModal = (matiere: Matiere) => {
    setCurrentMatiere(matiere);
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (matiere: Matiere) => {
    setCurrentMatiere(matiere);
    setIsDeleteModalOpen(true);
  };

  const getCategoryName = (categoryName: string) => {
    const category = categories.find(c => c.name === categoryName);
    return category?.name || categoryName;
  };

  if (loading && matieres.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="text-center py-12 text-red-600">
          <p>Erreur lors du chargement des matières: {error.message}</p>
        </div>
      </Card>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Matières premières</h2>
          <p className="text-gray-600">Gérer vos matières premières et leurs stocks</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} icon={<Plus size={20} />}>
          Ajouter une matière
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <Input
            placeholder="Rechercher une matière..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="sm:w-48">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            {availableCategories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'All' ? 'Toutes les catégories' : cat}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-emerald-100 text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Grid3X3 size={20} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-emerald-100 text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Package size={20} />
          </button>
        </div>
      </div>

      {/* Matieres List */}
      {filteredMatieres.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Package className="text-gray-400" size={32} />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery || selectedCategory !== 'All' ? 'Aucune matière trouvée' : 'Aucune matière'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchQuery || selectedCategory !== 'All'
                ? 'Essayez de modifier vos critères de recherche'
                : 'Commencez par ajouter votre première matière première'}
            </p>
            {!searchQuery && selectedCategory === 'All' && (
              <Button onClick={() => setIsAddModalOpen(true)} icon={<Plus size={20} />}>
                Ajouter une matière
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className={viewMode === 'grid'
          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
          : 'space-y-4'
        }>
          {filteredMatieres.map(matiere => (
            <Card key={matiere.id} className="h-full">
              {viewMode === 'grid' ? (
                // Grid View
                <div className="flex flex-col h-full">
                  {/* Matiere Image */}
                  <div className="aspect-square rounded-lg overflow-hidden mb-4 bg-gray-100">
                    {matiere.images && matiere.images.length > 0 ? (
                      <ImageWithSkeleton
                        src={matiere.images[0]}
                        alt={matiere.name}
                        className="w-full h-full object-cover"
                        placeholder="/placeholder.png"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Package size={48} />
                      </div>
                    )}
                  </div>
                  
                  {/* Matiere Info */}
                  <div className="flex-1 flex flex-col">
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                      {matiere.name}
                    </h3>
                    {matiere.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                        {matiere.description}
                      </p>
                    )}
                    <div className="mt-auto">
                      <div className="flex flex-wrap gap-2 mb-3">
                        <Badge variant="info">
                          {getCategoryName(matiere.refCategorie)}
                        </Badge>
                        <Badge variant="info">
                          {matiere.unit}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 mb-3">
                        Prix: {matiere.costPrice.toLocaleString()} XAF
                      </div>
                      
                      {/* Actions */}
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => openEditModal(matiere)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Modifier"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => openDeleteModal(matiere)}
                          className="text-red-600 hover:text-red-900"
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // List View
                <div className="flex items-center space-x-4">
                  {/* Matiere Image */}
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {matiere.images && matiere.images.length > 0 ? (
                      <ImageWithSkeleton
                        src={matiere.images[0]}
                        alt={matiere.name}
                        className="w-full h-full object-cover"
                        placeholder="/placeholder.png"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Package size={24} />
                      </div>
                    )}
                  </div>
                  
                  {/* Matiere Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {matiere.name}
                    </h3>
                    {matiere.description && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {matiere.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge variant="info">
                        {getCategoryName(matiere.refCategorie)}
                      </Badge>
                      <Badge variant="info">
                        {matiere.unit}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600">
                      Prix: {matiere.costPrice.toLocaleString()} XAF
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => openEditModal(matiere)}
                      className="text-indigo-600 hover:text-indigo-900"
                      title="Modifier"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => openDeleteModal(matiere)}
                      className="text-red-600 hover:text-red-900"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <MatiereFormModal
        isOpen={isAddModalOpen || isEditModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setIsEditModalOpen(false);
          setCurrentMatiere(null);
        }}
        matiere={currentMatiere}
        onSuccess={() => {
          setIsAddModalOpen(false);
          setIsEditModalOpen(false);
          setCurrentMatiere(null);
        }}
      />

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setCurrentMatiere(null);
        }}
        title="Supprimer la matière"
        size="sm"
        footer={
          <ModalFooter
            onCancel={() => {
              setIsDeleteModalOpen(false);
              setCurrentMatiere(null);
            }}
            onConfirm={handleDelete}
            confirmText="Supprimer"
            confirmVariant="danger"
          />
        }
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Êtes-vous sûr de vouloir supprimer la matière <strong>"{currentMatiere?.name}"</strong> ?
          </p>
          <p className="text-sm text-red-600">
            Cette action est irréversible. Tous les stocks et données associés seront supprimés.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default Matieres;

