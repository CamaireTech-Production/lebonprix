// Add Article Modal - Add article to existing production
import React, { useState, useMemo, useEffect } from 'react';
import { X, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Modal, Button, LoadingScreen } from '@components/common';
import { useMatiereStocks } from '@hooks/business/useMatiereStocks';
import { showSuccessToast, showErrorToast, showWarningToast } from '@utils/core/toast';
import { formatPrice } from '@utils/formatting/formatPrice';
import type { Production, ProductionArticle } from '../../types/models';
import {
  generateArticleId,
  getArticleName,
  calculateMaterialsForArticleFromProduction,
  validateMaterialsStockSync,
  calculateTotalArticlesQuantity
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

  const [articleName, setArticleName] = useState('');
  const [articleQuantity, setArticleQuantity] = useState<number>(1);
  const [articleDescription, setArticleDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidatingStock, setIsValidatingStock] = useState(false);

  // Calculate materials needed for this article
  const requiredMaterials = useMemo(() => {
    if (!production || articleQuantity <= 0 || !production.materials || production.materials.length === 0) {
      return [];
    }
    return calculateMaterialsForArticleFromProduction(
      articleQuantity,
      production.materials,
      production.totalArticlesQuantity || 0
    );
  }, [production, articleQuantity]);

  // Create stock data map for validation
  const stockDataMap = useMemo(() => {
    const map = new Map<string, number>();
    matiereStocks.forEach(stock => {
      map.set(stock.matiereId, stock.currentStock);
    });
    return map;
  }, [matiereStocks]);

  // Validate stock
  const stockValidation = useMemo(() => {
    if (requiredMaterials.length === 0) {
      return { isValid: true, warnings: [], hasOutOfStock: false, hasLowStock: false };
    }
    return validateMaterialsStockSync(requiredMaterials, stockDataMap);
  }, [requiredMaterials, stockDataMap]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setArticleName('');
      setArticleQuantity(1);
      setArticleDescription('');
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

    // Check stock validation - prevent creation if out of stock
    if (!stockValidation.isValid) {
      const outOfStockMaterials = stockValidation.warnings.filter(w => w.status === 'out_of_stock');
      if (outOfStockMaterials.length > 0) {
        const materialsList = outOfStockMaterials.map(m => m.matiereName).join(', ');
        showErrorToast(
          `Impossible d'ajouter l'article: ${materialsList} ${outOfStockMaterials.length > 1 ? 'sont' : 'est'} en rupture de stock. Veuillez réapprovisionner avant de continuer.`
        );
        return;
      }
      // If only low stock warnings, show warning but allow
      showWarningToast('Attention: Certains matériaux ont un stock faible. Vérifiez les quantités disponibles.');
    }

    setIsSubmitting(true);
    try {
      const { addArticleToProduction } = await import('@services/firestore/productions/productionService');
      
      const articleNameFinal = getArticleName(
        production.name,
        (production.articles?.length || 0) + 1,
        articleName
      );

      const newArticle: Omit<ProductionArticle, 'id'> = {
        name: articleNameFinal,
        quantity: articleQuantity,
        status: 'draft',
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
            disabled={isSubmitting || !stockValidation.isValid}
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

        {/* Stock Validation */}
        {requiredMaterials.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              Matériaux nécessaires pour {articleQuantity} unité{articleQuantity !== 1 ? 's' : ''}
            </h3>
            
            {stockValidation.warnings.length > 0 ? (
              <div className="space-y-3">
                {stockValidation.warnings.map((warning, index) => {
                  const getStatusIcon = () => {
                    if (warning.status === 'out_of_stock') {
                      return <XCircle className="text-red-500" size={16} />;
                    } else if (warning.status === 'low_stock') {
                      return <AlertTriangle className="text-yellow-500" size={16} />;
                    } else {
                      return <CheckCircle2 className="text-green-500" size={16} />;
                    }
                  };

                  const getStatusColor = () => {
                    if (warning.status === 'out_of_stock') {
                      return 'bg-red-50 border-red-200';
                    } else if (warning.status === 'low_stock') {
                      return 'bg-yellow-50 border-yellow-200';
                    } else {
                      return 'bg-green-50 border-green-200';
                    }
                  };

                  const getStatusText = () => {
                    if (warning.status === 'out_of_stock') {
                      return 'Rupture de stock';
                    } else if (warning.status === 'low_stock') {
                      return 'Stock faible';
                    } else {
                      return 'Stock suffisant';
                    }
                  };

                  return (
                    <div
                      key={index}
                      className={`border rounded-md p-3 ${getStatusColor()}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-2 flex-1">
                          {getStatusIcon()}
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-gray-900">
                                {warning.matiereName}
                              </span>
                              <span className={`text-xs font-semibold ${
                                warning.status === 'out_of_stock' ? 'text-red-700' :
                                warning.status === 'low_stock' ? 'text-yellow-700' :
                                'text-green-700'
                              }`}>
                                {getStatusText()}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <div className="flex justify-between">
                                <span>Nécessaire:</span>
                                <span className="font-medium">
                                  {warning.required.toFixed(2)} {warning.unit}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Disponible:</span>
                                <span className="font-medium">
                                  {warning.available.toFixed(2)} {warning.unit}
                                </span>
                              </div>
                              {warning.shortage && (
                                <div className="flex justify-between text-red-600 font-medium">
                                  <span>Manquant:</span>
                                  <span>{warning.shortage.toFixed(2)} {warning.unit}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Aucun matériau requis</p>
            )}

            {stockValidation.hasOutOfStock && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="text-red-500 mt-0.5" size={16} />
                  <div>
                    <p className="text-sm font-medium text-red-800">
                      Impossible d'ajouter l'article
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      Certains matériaux sont en rupture de stock. Veuillez réapprovisionner avant de continuer.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {stockValidation.hasLowStock && !stockValidation.hasOutOfStock && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="text-yellow-500 mt-0.5" size={16} />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">
                      Attention: Stock faible
                    </p>
                    <p className="text-xs text-yellow-600 mt-1">
                      Certains matériaux ont un stock faible. Vérifiez les quantités disponibles.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default AddArticleModal;

