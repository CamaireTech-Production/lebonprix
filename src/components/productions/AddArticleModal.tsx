// Add Article Modal - Add article to existing production
import React, { useState, useMemo, useEffect } from 'react';
import { X, AlertCircle, CheckCircle2, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { Modal, Button, LoadingScreen } from '@components/common';
import { useMatiereStocks } from '@hooks/business/useMatiereStocks';
import { useMatieres } from '@hooks/business/useMatieres';
import { showSuccessToast, showErrorToast, showWarningToast } from '@utils/core/toast';
import { formatPrice } from '@utils/formatting/formatPrice';
import type { Production, ProductionArticle, ProductionMaterial } from '../../types/models';
import {
  generateArticleId,
  getArticleName
} from '@utils/productions';

interface AddArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  production: Production | null;
}

const AddArticleModal: React.FC<AddArticleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  production
}) => {
  const { matiereStocks } = useMatiereStocks();
  const { matieres = [] } = useMatieres();

  const [articleName, setArticleName] = useState('');
  const [articleQuantity, setArticleQuantity] = useState<number>(1);
  const [articleDescription, setArticleDescription] = useState('');
  const [articleMaterials, setArticleMaterials] = useState<ProductionMaterial[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidatingStock, setIsValidatingStock] = useState(false);

  // Get available stock for a matiere
  const getAvailableStock = (matiereId: string): number => {
    const stockInfo = matiereStocks.find(ms => ms.matiereId === matiereId);
    return stockInfo?.currentStock || 0;
  };

  // Add material
  const handleAddMaterial = () => {
    setArticleMaterials(prev => [...prev, {
      matiereId: '',
      matiereName: '',
      requiredQuantity: 0,
      unit: '',
      costPrice: 0
    }]);
  };

  // Update material
  const handleUpdateMaterial = (index: number, field: keyof ProductionMaterial, value: any) => {
    setArticleMaterials(prev => {
      const updated = [...prev];
      if (field === 'matiereId') {
        const matiere = matieres.find(m => m.id === value);
        if (matiere) {
          updated[index] = {
            ...updated[index],
            matiereId: value,
            matiereName: matiere.name,
            unit: matiere.unit || 'unité',
            costPrice: matiere.costPrice
          };
        }
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  // Remove material
  const handleRemoveMaterial = (index: number) => {
    setArticleMaterials(prev => prev.filter((_, i) => i !== index));
  };

  // Calculate article cost from materials
  const articleCost = useMemo(() => {
    return articleMaterials.reduce((sum, material) => {
      return sum + (material.requiredQuantity * material.costPrice);
    }, 0);
  }, [articleMaterials]);


  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setArticleName('');
      setArticleQuantity(1);
      setArticleDescription('');
      setArticleMaterials([]);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!production) {
      showErrorToast('Production introuvable');
      return;
    }

    if (articleQuantity <= 0) {
      showErrorToast('La quantité doit être supérieure à 0');
      return;
    }

    // Stock validation is now done in the UI (materials section shows warnings)
    // User can still submit even with low stock warnings

    setIsSubmitting(true);
    try {
      const { addArticleToProduction } = await import('@services/firestore/productions/productionService');
      
      const articleNameFinal = getArticleName(
        production.name,
        (production.articles?.length || 0) + 1,
        articleName
      );

      // Calculate cost from materials
      const articleMaterialCost = articleMaterials.reduce((sum, material) => {
        return sum + (material.requiredQuantity * material.costPrice);
      }, 0);

      const newArticle: Omit<ProductionArticle, 'id'> = {
        name: articleNameFinal,
        quantity: articleQuantity,
        status: 'draft',
        materials: articleMaterials.filter(m => m.matiereId && m.requiredQuantity > 0), // Only valid materials
        calculatedCostPrice: articleMaterialCost,
        currentStepId: production.currentStepId || undefined,
        description: articleDescription || undefined
      };

      await addArticleToProduction(production.id, newArticle);
      showSuccessToast('Article ajouté avec succès');
      onClose();
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Error adding article:', error);
      showErrorToast(error.message || 'Erreur lors de l\'ajout de l\'article');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !production) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ajouter un article"
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            Ajouter l'article
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Article Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom de l'article (optionnel)
            </label>
            <input
              type="text"
              value={articleName}
              onChange={(e) => setArticleName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={`Auto: ${production.name} - Article ${(production.articles?.length || 0) + 1}`}
            />
            <p className="text-xs text-gray-400 mt-1">
              Si vide, le nom sera généré automatiquement
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantité <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={articleQuantity || ''}
              onChange={(e) => setArticleQuantity(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              step="1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optionnel)
            </label>
            <textarea
              value={articleDescription}
              onChange={(e) => setArticleDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Description de l'article..."
            />
          </div>
        </div>

        {/* Materials Assignment Section */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900">
              Matériaux pour cet article
            </h3>
            <Button
              icon={<Plus size={14} />}
              onClick={handleAddMaterial}
              variant="secondary"
              size="sm"
            >
              Ajouter un matériau
            </Button>
          </div>

          {articleMaterials.length === 0 ? (
            <div className="text-center py-4 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-500 mb-2">Aucun matériau ajouté</p>
              <p className="text-xs text-gray-400">
                Vous pouvez ajouter des matériaux maintenant ou plus tard
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {articleMaterials.map((material, index) => {
                const stockInfo = matiereStocks.find(ms => ms.matiereId === material.matiereId);
                const availableStock = stockInfo?.currentStock || 0;
                const isInsufficient = material.matiereId && material.requiredQuantity > 0 && availableStock < material.requiredQuantity;
                const isLowStock = material.matiereId && material.requiredQuantity > 0 && availableStock >= material.requiredQuantity && availableStock < material.requiredQuantity * 1.5;

                return (
                  <div key={index} className={`border rounded-md p-3 ${isInsufficient ? 'bg-red-50 border-red-200' : isLowStock ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'}`}>
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Matériau <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={material.matiereId}
                          onChange={(e) => handleUpdateMaterial(index, 'matiereId', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Sélectionner...</option>
                          {matieres.map(matiere => (
                            <option key={matiere.id} value={matiere.id}>
                              {matiere.name} ({getAvailableStock(matiere.id)} {matiere.unit || 'unité'})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Quantité requise <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            value={material.requiredQuantity || ''}
                            onChange={(e) => handleUpdateMaterial(index, 'requiredQuantity', parseFloat(e.target.value) || 0)}
                            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            min="0"
                            step="0.01"
                          />
                          <span className="text-xs text-gray-500">{material.unit || 'unité'}</span>
                        </div>
                      </div>
                    </div>
                    
                    {material.matiereId && (
                      <>
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="text-gray-600">
                            Prix unitaire: {formatPrice(material.costPrice)}
                          </span>
                          <span className="font-medium text-gray-900">
                            Total: {formatPrice(material.requiredQuantity * material.costPrice)}
                          </span>
                        </div>
                        
                        {/* Stock Status */}
                        {material.requiredQuantity > 0 && (
                          <div className={`text-xs p-2 rounded ${
                            isInsufficient ? 'bg-red-100 text-red-700' :
                            isLowStock ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            <div className="flex justify-between">
                              <span>Stock disponible:</span>
                              <span className="font-medium">{availableStock} {material.unit || 'unité'}</span>
                            </div>
                            {isInsufficient && (
                              <div className="mt-1 text-red-800 font-medium">
                                ⚠️ Stock insuffisant
                              </div>
                            )}
                            {isLowStock && !isInsufficient && (
                              <div className="mt-1 text-yellow-800">
                                ⚠️ Stock faible
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                    
                    <button
                      onClick={() => handleRemoveMaterial(index)}
                      className="mt-2 text-red-600 hover:text-red-800 text-xs flex items-center"
                    >
                      <Trash2 size={12} className="mr-1" />
                      Supprimer
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Cost Summary */}
          {articleCost > 0 && (
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-blue-900">Coût estimé des matériaux:</span>
                <span className="text-sm font-semibold text-blue-900">
                  {formatPrice(articleCost)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default AddArticleModal;

