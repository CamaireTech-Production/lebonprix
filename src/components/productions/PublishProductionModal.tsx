// Publish Production Modal - Convert production to product
import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal, ModalFooter, PriceInput } from '@components/common';
import { useAuth } from '@contexts/AuthContext';
import { useProductCategories } from '@hooks/data/useFirestore';
import { useMatiereStocks } from '@hooks/business/useMatiereStocks';
import { showSuccessToast, showErrorToast, showWarningToast } from '@utils/core/toast';
import { formatPrice } from '@utils/formatting/formatPrice';
import type { Production } from '../../types/models';

interface PublishProductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  production: Production | null;
  onSuccess?: () => void;
}

const PublishProductionModal: React.FC<PublishProductionModalProps> = ({
  isOpen,
  onClose,
  production,
  onSuccess
}) => {
  const { user, company } = useAuth();
  const { categories } = useProductCategories();
  const { matiereStocks } = useMatiereStocks();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    sellingPrice: '',
    cataloguePrice: '',
    description: '',
    barCode: '',
    isVisible: true,
    validatedCostPrice: '' // Add cost validation field
  });

  // Stock validation
  const stockValidation = useMemo(() => {
    if (!production) return { isValid: true, errors: [] };

    const errors: string[] = [];
    for (const material of production.materials) {
      const stockInfo = matiereStocks.find(ms => ms.matiereId === material.matiereId);
      const availableStock = stockInfo?.currentStock || 0;
      
      if (availableStock < material.requiredQuantity) {
        const unit = material.unit || 'unité';
        errors.push(
          `${material.matiereName}: Stock insuffisant (requis: ${material.requiredQuantity} ${unit}, disponible: ${availableStock} ${unit})`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }, [production, matiereStocks]);

  useEffect(() => {
    if (isOpen && production) {
      setFormData({
        name: production.name,
        category: '', // Always start empty - ProductionCategory and Product Category are different
        sellingPrice: '',
        cataloguePrice: '',
        description: production.description || '',
        barCode: '',
        isVisible: true,
        validatedCostPrice: (production.validatedCostPrice || production.calculatedCostPrice || 0).toString()
      });
    }
  }, [isOpen, production]);

  const handleSubmit = async () => {
    if (!user || !company || !production) return;

    // Prevent double submission
    if (isSubmitting) return;

    if (!formData.name.trim()) {
      showWarningToast('Le nom du produit est requis');
      return;
    }

    if (!formData.sellingPrice || parseFloat(formData.sellingPrice) < 0) {
      showWarningToast('Le prix de vente est requis et doit être positif');
      return;
    }

    if (!stockValidation.isValid) {
      showErrorToast('Stock insuffisant pour certains matériaux');
      return;
    }

    if (!formData.validatedCostPrice || parseFloat(formData.validatedCostPrice) < 0) {
      showWarningToast('Veuillez entrer un coût validé valide');
      return;
    }

    // Check if production is already published
    if (production.isPublished) {
      showErrorToast('Cette production est déjà publiée');
      return;
    }

    setIsSubmitting(true);

    try {
      const { publishProduction } = await import('@services/firestore/productions/productionService');
      
      const sellingPrice = parseFloat(formData.sellingPrice);
      const cataloguePrice = formData.cataloguePrice && formData.cataloguePrice.trim() 
        ? parseFloat(formData.cataloguePrice) 
        : sellingPrice; // Use selling price if catalogue price is empty

      // Find the category name from the selected category ID
      const selectedCategory = formData.category 
        ? categories.find(cat => cat.id === formData.category)
        : null;

      await publishProduction(
        production.id,
        {
          name: formData.name.trim(),
          category: selectedCategory?.name || undefined, // Pass the category name, not the ID
          sellingPrice: sellingPrice,
          cataloguePrice: cataloguePrice,
          description: formData.description.trim() || undefined,
          barCode: formData.barCode.trim() || undefined,
          isVisible: formData.isVisible,
          costPrice: parseFloat(formData.validatedCostPrice)
        },
        company.id,
        user.uid
      );

      showSuccessToast('Production publiée avec succès');
      onClose();
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Error publishing production:', error);
      showErrorToast(error.message || 'Erreur lors de la publication de la production');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !production) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      title="Publier la production"
      size="lg"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={handleSubmit}
          cancelText="Annuler"
          confirmText={isSubmitting ? 'Publication...' : 'Publier'}
          isLoading={isSubmitting}
          disabled={isSubmitting || !stockValidation.isValid || !formData.validatedCostPrice || parseFloat(formData.validatedCostPrice) < 0 || !formData.name.trim() || !formData.sellingPrice || parseFloat(formData.sellingPrice) < 0}
        />
      }
    >
      <div className="space-y-6">
        {/* Stock Validation Warning */}
        {!stockValidation.isValid && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 mr-3" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-red-900 mb-2">
                  Stock insuffisant pour certains matériaux
                </h4>
                <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                  {stockValidation.errors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Cost Validation Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-blue-900">Coût calculé:</span>
            <span className="text-lg font-semibold text-blue-900">
              {formatPrice(production.calculatedCostPrice || 0)}
            </span>
          </div>
          <div>
            <PriceInput
              label="Coût validé (XAF) *"
              name="validatedCostPrice"
              value={formData.validatedCostPrice}
              onChange={(e) => setFormData({ ...formData, validatedCostPrice: e.target.value })}
              allowDecimals={false}
              placeholder="0"
            />
            <p className="mt-1 text-xs text-gray-500">
              Vous pouvez valider le coût calculé ou le modifier selon vos besoins
            </p>
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom du produit <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nom du produit"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catégorie
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Aucune catégorie</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code-barres
              </label>
              <input
                type="text"
                value={formData.barCode}
                onChange={(e) => setFormData({ ...formData, barCode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Auto-généré si vide"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <PriceInput
                label="Prix de vente (XAF) *"
                name="sellingPrice"
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                allowDecimals={false}
                placeholder="0"
              />
            </div>

            <div>
              <PriceInput
                label="Prix catalogue (XAF)"
                name="cataloguePrice"
                value={formData.cataloguePrice}
                onChange={(e) => setFormData({ ...formData, cataloguePrice: e.target.value })}
                allowDecimals={false}
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Description du produit..."
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isVisible"
              checked={formData.isVisible}
              onChange={(e) => setFormData({ ...formData, isVisible: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="isVisible" className="ml-2 block text-sm text-gray-900">
              Produit visible dans le catalogue
            </label>
          </div>
        </div>

        {/* Materials Summary */}
        {production.materials.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Matériaux à consommer:</h4>
            <div className="space-y-2">
              {production.materials.map((material, idx) => {
                const stockInfo = matiereStocks.find(ms => ms.matiereId === material.matiereId);
                const availableStock = stockInfo?.currentStock || 0;
                const isInsufficient = availableStock < material.requiredQuantity;

                return (
                  <div
                    key={idx}
                    className={`flex justify-between items-center text-sm p-2 rounded ${
                      isInsufficient ? 'bg-red-50' : 'bg-gray-50'
                    }`}
                  >
                    <span className={isInsufficient ? 'text-red-700' : 'text-gray-700'}>
                      {material.matiereName}: {material.requiredQuantity} {material.unit || 'unité'}
                    </span>
                    <span className={isInsufficient ? 'text-red-700 font-medium' : 'text-gray-600'}>
                      Stock: {availableStock} {material.unit || 'unité'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default PublishProductionModal;

