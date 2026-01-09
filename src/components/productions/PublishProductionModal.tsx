// Publish Production Modal - Convert production to product (supports multi-article)
import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { Modal, ModalFooter, PriceInput } from '@components/common';
import { useAuth } from '@contexts/AuthContext';
import { useProductCategories } from '@hooks/data/useFirestore';
import { useMatiereStocks } from '@hooks/business/useMatiereStocks';
import { showSuccessToast, showErrorToast, showWarningToast } from '@utils/core/toast';
import { formatPrice } from '@utils/formatting/formatPrice';
import { calculateMaterialsForArticleFromProduction } from '@utils/productions/materialCalculations';
import type { Production, ProductionArticle } from '../../types/models';

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
  const [publishMode, setPublishMode] = useState<'all' | 'selected'>('all'); // 'all' for legacy, 'selected' for articles
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null); // Track which article is expanded
  const [articleFormData, setArticleFormData] = useState<Map<string, {
    name: string;
    category: string;
    sellingPrice: string;
    cataloguePrice: string;
    description: string;
    barCode: string;
    isVisible: boolean;
    costPrice: string;
    selectedChargeIds: string[]; // IDs of charges selected for this article
  }>>(new Map());
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

  // Field error tracking for highlighting
  const [fieldErrors, setFieldErrors] = useState<{
    legacy?: {
      name?: boolean;
      sellingPrice?: boolean;
      validatedCostPrice?: boolean;
    };
    articles?: Map<string, {
      name?: boolean;
      sellingPrice?: boolean;
      costPrice?: boolean;
    }>;
  }>({});

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

  // Check if production has articles (multi-article mode)
  const hasArticles = useMemo(() => {
    return production && production.articles && production.articles.length > 0;
  }, [production]);

  // Get publishable articles (not already published)
  const publishableArticles = useMemo(() => {
    if (!production || !production.articles) return [];
    return production.articles.filter(a => a.status !== 'published');
  }, [production]);

  useEffect(() => {
    if (isOpen && production) {
      // Clear any previous errors
      setFieldErrors({});
      
      // Initialize form data
      setFormData({
        name: production.name,
        category: '',
        sellingPrice: '',
        cataloguePrice: '',
        description: production.description || '',
        barCode: '',
        isVisible: true,
        validatedCostPrice: (production.validatedCostPrice || production.calculatedCostPrice || 0).toString()
      });

      // Initialize article form data
      const articleDataMap = new Map<string, any>();
      if (production.articles) {
        production.articles.forEach(article => {
          if (article.status !== 'published') {
            // Calculate cost from article's own materials (not ratio-based)
            const articleMaterialsCost = (article.materials || []).reduce((sum, material) => {
              return sum + (material.requiredQuantity * material.costPrice);
            }, 0);
            
            // Use article's calculatedCostPrice if available, otherwise calculate from materials
            const articleCostPrice = article.calculatedCostPrice || articleMaterialsCost;
            
            // Round to integer (no decimals for XAF)
            const roundedCostPrice = Math.round(articleCostPrice);
            
            articleDataMap.set(article.id, {
              name: article.name,
              category: '',
              sellingPrice: '',
              cataloguePrice: '',
              description: article.description || production.description || '',
              barCode: '',
              isVisible: true,
              costPrice: roundedCostPrice.toString(),
              selectedChargeIds: [] // Default: no charges selected, user selects which charges to include
            });
          }
        });
      }
      setArticleFormData(articleDataMap);
      setSelectedArticles(new Set(publishableArticles.map(a => a.id)));
      setPublishMode(hasArticles ? 'selected' : 'all');
      setExpandedArticleId(null); // Reset expanded article when modal opens
    } else if (!isOpen) {
      setExpandedArticleId(null); // Reset when modal closes
    }
  }, [isOpen, production, hasArticles, publishableArticles]);

  const handleSubmit = async () => {
    if (!user || !company || !production) return;

    // Prevent double submission
    if (isSubmitting) return;

    // Clear previous errors
    setFieldErrors({});

    // Multi-article mode: publish selected articles
    if (hasArticles && publishMode === 'selected') {
      if (selectedArticles.size === 0) {
        showWarningToast('Veuillez sélectionner au moins un article à publier');
        return;
      }

      // Validate all selected articles have required data
      const articleErrors = new Map<string, { name?: boolean; sellingPrice?: boolean; costPrice?: boolean }>();
      let hasErrors = false;

      for (const articleId of selectedArticles) {
        const articleData = articleFormData.get(articleId);
        const errors: { name?: boolean; sellingPrice?: boolean; costPrice?: boolean } = {};
        
        if (!articleData) {
          showErrorToast(`Données manquantes pour l'article ${articleId}`);
          hasErrors = true;
          continue;
        }
        
        if (!articleData.name || !articleData.name.trim()) {
          errors.name = true;
          hasErrors = true;
        }
        
        if (!articleData.sellingPrice || parseFloat(articleData.sellingPrice) < 0) {
          errors.sellingPrice = true;
          hasErrors = true;
        }
        
        if (!articleData.costPrice || parseFloat(articleData.costPrice) < 0) {
          errors.costPrice = true;
          hasErrors = true;
        }

        if (Object.keys(errors).length > 0) {
          articleErrors.set(articleId, errors);
        }
      }

      if (hasErrors) {
        setFieldErrors({ articles: articleErrors });
        // Expand first article with errors and scroll to it
        const firstErrorArticleId = Array.from(articleErrors.keys())[0];
        if (firstErrorArticleId) {
          setExpandedArticleId(firstErrorArticleId);
          // Scroll to the first error field after a short delay to allow DOM update
          setTimeout(() => {
            const errorField = document.querySelector(`[name="name-${firstErrorArticleId}"], [name="sellingPrice-${firstErrorArticleId}"], [name="costPrice-${firstErrorArticleId}"]`);
            if (errorField) {
              errorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
              (errorField as HTMLElement).focus();
            }
          }, 100);
        }
        showErrorToast('Veuillez remplir tous les champs requis pour les articles sélectionnés');
        return;
      }

      setIsSubmitting(true);
      try {
        const { bulkPublishArticles } = await import('@services/firestore/productions/productionService');
        
        // Build product data map
        const productDataMap = new Map();
        for (const articleId of selectedArticles) {
          const articleData = articleFormData.get(articleId);
          if (!articleData) continue;
          
          const selectedCategory = articleData.category 
            ? categories.find(cat => cat.id === articleData.category)
            : null;

          productDataMap.set(articleId, {
            name: articleData.name.trim(),
            costPrice: parseFloat(articleData.costPrice),
            sellingPrice: parseFloat(articleData.sellingPrice),
            stock: production.articles?.find(a => a.id === articleId)?.quantity || 0,
            category: selectedCategory?.name || undefined,
            cataloguePrice: articleData.cataloguePrice && articleData.cataloguePrice.trim()
              ? parseFloat(articleData.cataloguePrice)
              : parseFloat(articleData.sellingPrice),
            description: articleData.description.trim() || undefined,
            barCode: articleData.barCode.trim() || undefined,
            isVisible: articleData.isVisible,
            selectedChargeIds: articleData.selectedChargeIds || [] // Pass selected charge IDs
          });
        }

        const results = await bulkPublishArticles(production.id, Array.from(selectedArticles), company.id, productDataMap);
        showSuccessToast(`${results.length} article(s) publié(s) avec succès`);
        onClose();
        if (onSuccess) onSuccess();
      } catch (error: any) {
        console.error('Error publishing articles:', error);
        showErrorToast(error.message || 'Erreur lors de la publication des articles');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Legacy mode: publish entire production as single product
    const legacyErrors: { name?: boolean; sellingPrice?: boolean; validatedCostPrice?: boolean } = {};
    let hasLegacyErrors = false;

    if (!formData.name.trim()) {
      legacyErrors.name = true;
      hasLegacyErrors = true;
    }

    if (!formData.sellingPrice || parseFloat(formData.sellingPrice) < 0) {
      legacyErrors.sellingPrice = true;
      hasLegacyErrors = true;
    }

    if (!formData.validatedCostPrice || parseFloat(formData.validatedCostPrice) < 0) {
      legacyErrors.validatedCostPrice = true;
      hasLegacyErrors = true;
    }

    if (hasLegacyErrors) {
      setFieldErrors({ legacy: legacyErrors });
      // Scroll to first error field
      setTimeout(() => {
        const firstErrorField = document.querySelector(
          legacyErrors.name ? '[name="name"]' :
          legacyErrors.sellingPrice ? '[name="sellingPrice"]' :
          legacyErrors.validatedCostPrice ? '[name="validatedCostPrice"]' : null
        );
        if (firstErrorField) {
          firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
          (firstErrorField as HTMLElement).focus();
        }
      }, 100);
      showErrorToast('Veuillez remplir tous les champs requis');
      return;
    }

    if (!stockValidation.isValid) {
      showErrorToast('Stock insuffisant pour certains matériaux');
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
        : sellingPrice;

      const selectedCategory = formData.category 
        ? categories.find(cat => cat.id === formData.category)
        : null;

      await publishProduction(
        production.id,
        {
          name: formData.name.trim(),
          category: selectedCategory?.name || undefined,
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
          confirmText={isSubmitting ? 'Publication...' : hasArticles && publishMode === 'selected' ? `Publier ${selectedArticles.size} article(s)` : 'Publier'}
          isLoading={isSubmitting}
          disabled={
            isSubmitting || 
            (hasArticles && publishMode === 'selected' 
              ? selectedArticles.size === 0
              : !stockValidation.isValid || !formData.validatedCostPrice || parseFloat(formData.validatedCostPrice) < 0 || !formData.name.trim() || !formData.sellingPrice || parseFloat(formData.sellingPrice) < 0)
          }
        />
      }
    >
      <div className="space-y-6">
        {/* Article Selection Mode (if has articles) */}
        {hasArticles && publishableArticles.length > 0 ? (
          <div className="space-y-4">
            {/* Article Selection Header */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-blue-900">
                  Sélectionnez les articles à publier
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-600">
                    {selectedArticles.size} sur {publishableArticles.length} sélectionné(s)
                  </span>
                  {publishableArticles.length > 1 && (
                    <>
                      <button
                        onClick={() => setSelectedArticles(new Set(publishableArticles.map(a => a.id)))}
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        Tout sélectionner
                      </button>
                      <span className="text-blue-300">|</span>
                      <button
                        onClick={() => setSelectedArticles(new Set())}
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        Tout désélectionner
                      </button>
                    </>
                  )}
                </div>
              </div>
              <p className="text-xs text-blue-700">
                Configurez les données de catalogue pour chaque article sélectionné
              </p>
            </div>

            {/* Article List with Checkboxes and Forms */}
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {publishableArticles.map((article) => {
                const isSelected = selectedArticles.has(article.id);
                const isExpanded = expandedArticleId === article.id;
                const articleData = articleFormData.get(article.id);
                if (!articleData) return null;
                
                // Calculate materials for this article
                const articleMaterials = calculateMaterialsForArticleFromProduction(
                  article.quantity,
                  production.materials,
                  production.totalArticlesQuantity || 0
                );

                return (
                  <div key={article.id} className={`border rounded-lg transition-all ${isSelected ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white'}`}>
                    {/* Checkbox and Article Header - Clickable to expand/collapse */}
                    <div 
                      className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => {
                        // Toggle expansion: if already expanded, collapse; otherwise expand this one
                        setExpandedArticleId(isExpanded ? null : article.id);
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation(); // Prevent expanding when clicking checkbox
                          const newSelected = new Set(selectedArticles);
                          if (e.target.checked) {
                            newSelected.add(article.id);
                          } else {
                            newSelected.delete(article.id);
                          }
                          setSelectedArticles(newSelected);
                        }}
                        onClick={(e) => e.stopPropagation()} // Prevent expanding when clicking checkbox
                        className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium text-gray-900">{articleData.name}</h5>
                            <p className="text-xs text-gray-500">Quantité: {article.quantity} unité(s)</p>
                          </div>
                          <div className="flex items-center gap-3">
                            {/* Cost Price Display */}
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Coût estimé:</p>
                              <p className="text-sm font-semibold text-gray-900">
                                {(() => {
                                  // Show the current cost price (user-edited or calculated)
                                  const costValue = parseFloat(articleData.costPrice || '0');
                                  return formatPrice(isNaN(costValue) ? 0 : costValue);
                                })()}
                              </p>
                            </div>
                            {/* Expand/Collapse Icon */}
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-gray-400" />
                            )}
                          </div>
                        </div>
                        {article.description && !isExpanded && (
                          <p className="text-xs text-gray-400 mt-1">{article.description}</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Article Form (only shown if expanded) */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 border-t border-gray-200 space-y-3">
                        {/* Product Name */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Nom du produit <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            name={`name-${article.id}`}
                            value={articleData.name}
                            onChange={(e) => {
                              const newData = new Map(articleFormData);
                              const current = newData.get(article.id) || articleData;
                              newData.set(article.id, { ...current, name: e.target.value });
                              setArticleFormData(newData);
                              // Clear error when field is filled
                              if (fieldErrors.articles?.get(article.id)?.name && e.target.value.trim()) {
                                const newErrors = new Map(fieldErrors.articles);
                                const articleError = newErrors.get(article.id) || {};
                                delete articleError.name;
                                if (Object.keys(articleError).length === 0) {
                                  newErrors.delete(article.id);
                                } else {
                                  newErrors.set(article.id, articleError);
                                }
                                setFieldErrors({ articles: newErrors });
                              }
                            }}
                            className={`w-full px-2 py-1 text-sm border rounded-md focus:outline-none focus:ring-2 ${
                              fieldErrors.articles?.get(article.id)?.name
                                ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50'
                                : 'border-gray-300 focus:ring-blue-500'
                            }`}
                          />
                          {fieldErrors.articles?.get(article.id)?.name && (
                            <p className="mt-1 text-xs text-red-500">Ce champ est requis</p>
                          )}
                        </div>

                        {/* Category and Barcode */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Catégorie</label>
                            <select
                              value={articleData.category}
                              onChange={(e) => {
                                const newData = new Map(articleFormData);
                                const current = newData.get(article.id) || articleData;
                                newData.set(article.id, { ...current, category: e.target.value });
                                setArticleFormData(newData);
                              }}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Aucune</option>
                              {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Code-barres</label>
                            <input
                              type="text"
                              value={articleData.barCode}
                              onChange={(e) => {
                                const newData = new Map(articleFormData);
                                const current = newData.get(article.id) || articleData;
                                newData.set(article.id, { ...current, barCode: e.target.value });
                                setArticleFormData(newData);
                              }}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Auto-généré"
                            />
                          </div>
                        </div>

                        {/* Cost Price Section */}
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-medium text-blue-900">Coût matériaux:</span>
                            <span className="text-sm font-semibold text-blue-900">
                              {(() => {
                                // Calculate cost from article's materials
                                const articleMaterialsCost = (article.materials || []).reduce((sum, material) => {
                                  return sum + (material.requiredQuantity * material.costPrice);
                                }, 0);
                                return formatPrice(articleMaterialsCost);
                              })()}
                            </span>
                          </div>
                          
                          {/* Charges Selection Section */}
                          {production.charges && production.charges.length > 0 && (
                            <div className="pt-2 border-t border-blue-200">
                              <div className="mb-2">
                                <span className="text-xs font-medium text-blue-900">Sélectionner les charges:</span>
                              </div>
                              <div className="space-y-2 max-h-32 overflow-y-auto">
                                {production.charges.map((charge) => {
                                  const isSelected = (articleData.selectedChargeIds || []).includes(charge.chargeId);
                                  const selectedChargesTotal = (articleData.selectedChargeIds || [])
                                    .reduce((sum, chargeId) => {
                                      const selectedCharge = production.charges.find(c => c.chargeId === chargeId);
                                      return sum + (selectedCharge?.amount || 0);
                                    }, 0);
                                  
                                  return (
                                    <label
                                      key={charge.chargeId}
                                      className="flex items-center justify-between p-2 bg-white rounded border border-gray-200 hover:bg-gray-50 cursor-pointer"
                                    >
                                      <div className="flex items-center flex-1">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            const newData = new Map(articleFormData);
                                            const current = newData.get(article.id) || articleData;
                                            const currentSelected = current.selectedChargeIds || [];
                                            
                                            let newSelected: string[];
                                            if (e.target.checked) {
                                              newSelected = [...currentSelected, charge.chargeId];
                                            } else {
                                              newSelected = currentSelected.filter(id => id !== charge.chargeId);
                                            }
                                            
                                            // Calculate selected charges total
                                            const selectedChargesTotal = newSelected.reduce((sum, chargeId) => {
                                              const selectedCharge = production.charges.find(c => c.chargeId === chargeId);
                                              return sum + (selectedCharge?.amount || 0);
                                            }, 0);
                                            
                                            // Calculate base cost from materials
                                            const articleMaterialsCost = (article.materials || []).reduce((sum, material) => {
                                              return sum + (material.requiredQuantity * material.costPrice);
                                            }, 0);
                                            
                                            // Total cost = materials + selected charges
                                            const totalCost = articleMaterialsCost + selectedChargesTotal;
                                            
                                            newData.set(article.id, { 
                                              ...current, 
                                              selectedChargeIds: newSelected,
                                              costPrice: totalCost.toString()
                                            });
                                            setArticleFormData(newData);
                                          }}
                                          className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <div className="ml-2 flex-1">
                                          <span className="text-xs font-medium text-gray-900">
                                            {charge.name || charge.description || 'Charge sans nom'}
                                          </span>
                                          {charge.description && charge.name && charge.name !== charge.description && (
                                            <p className="text-xs text-gray-500 mt-0.5">{charge.description}</p>
                                          )}
                                        </div>
                                      </div>
                                      <span className="text-xs font-medium text-gray-700 ml-2">
                                        {formatPrice(charge.amount)}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                              {(() => {
                                const selectedChargesTotal = (articleData.selectedChargeIds || [])
                                  .reduce((sum, chargeId) => {
                                    const selectedCharge = production.charges.find(c => c.chargeId === chargeId);
                                    return sum + (selectedCharge?.amount || 0);
                                  }, 0);
                                
                                if (selectedChargesTotal > 0) {
                                  return (
                                    <div className="mt-2 pt-2 border-t border-blue-200">
                                      <div className="flex justify-between items-center">
                                        <span className="text-xs font-medium text-blue-900">Total charges sélectionnées:</span>
                                        <span className="text-xs font-semibold text-blue-900">
                                          {formatPrice(selectedChargesTotal)}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          )}
                          
                          <div>
                            <PriceInput
                              label="Prix d'achat (XAF) *"
                              name={`costPrice-${article.id}`}
                              value={articleData.costPrice || '0'}
                              onChange={(e) => {
                                const newData = new Map(articleFormData);
                                const current = newData.get(article.id) || articleData;
                                // Clean the value to ensure it's a valid integer
                                const cleanValue = e.target.value.replace(/\s/g, '').replace(/[^\d]/g, '');
                                newData.set(article.id, { ...current, costPrice: cleanValue || '0' });
                                setArticleFormData(newData);
                                // Clear error when field is filled
                                if (fieldErrors.articles?.get(article.id)?.costPrice && parseFloat(cleanValue) > 0) {
                                  const newErrors = new Map(fieldErrors.articles);
                                  const articleError = newErrors.get(article.id) || {};
                                  delete articleError.costPrice;
                                  if (Object.keys(articleError).length === 0) {
                                    newErrors.delete(article.id);
                                  } else {
                                    newErrors.set(article.id, articleError);
                                  }
                                  setFieldErrors({ articles: newErrors });
                                }
                              }}
                              allowDecimals={false}
                              placeholder="0"
                              error={fieldErrors.articles?.get(article.id)?.costPrice ? 'Ce champ est requis' : undefined}
                            />
                            <p className="mt-1 text-xs text-gray-500">
                              Vous pouvez valider le coût calculé ou le modifier selon vos besoins
                            </p>
                          </div>
                        </div>

                        {/* Selling Price and Catalogue Price */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <PriceInput
                              label="Prix de vente (XAF) *"
                              name={`sellingPrice-${article.id}`}
                              value={articleData.sellingPrice}
                              onChange={(e) => {
                                const newData = new Map(articleFormData);
                                const current = newData.get(article.id) || articleData;
                                newData.set(article.id, { ...current, sellingPrice: e.target.value });
                                setArticleFormData(newData);
                                // Clear error when field is filled
                                if (fieldErrors.articles?.get(article.id)?.sellingPrice && parseFloat(e.target.value) > 0) {
                                  const newErrors = new Map(fieldErrors.articles);
                                  const articleError = newErrors.get(article.id) || {};
                                  delete articleError.sellingPrice;
                                  if (Object.keys(articleError).length === 0) {
                                    newErrors.delete(article.id);
                                  } else {
                                    newErrors.set(article.id, articleError);
                                  }
                                  setFieldErrors({ articles: newErrors });
                                }
                              }}
                              allowDecimals={false}
                              placeholder="0"
                              error={fieldErrors.articles?.get(article.id)?.sellingPrice ? 'Ce champ est requis' : undefined}
                            />
                          </div>
                          <div>
                            <PriceInput
                              label="Prix catalogue (XAF)"
                              name={`cataloguePrice-${article.id}`}
                              value={articleData.cataloguePrice}
                              onChange={(e) => {
                                const newData = new Map(articleFormData);
                                const current = newData.get(article.id) || articleData;
                                newData.set(article.id, { ...current, cataloguePrice: e.target.value });
                                setArticleFormData(newData);
                              }}
                              allowDecimals={false}
                              placeholder="0"
                            />
                          </div>
                        </div>

                        {/* Description */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                          <textarea
                            value={articleData.description}
                            onChange={(e) => {
                              const newData = new Map(articleFormData);
                              const current = newData.get(article.id) || articleData;
                              newData.set(article.id, { ...current, description: e.target.value });
                              setArticleFormData(newData);
                            }}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={2}
                          />
                        </div>

                        {/* Visibility Checkbox */}
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={articleData.isVisible}
                            onChange={(e) => {
                              const newData = new Map(articleFormData);
                              const current = newData.get(article.id) || articleData;
                              newData.set(article.id, { ...current, isVisible: e.target.checked });
                              setArticleFormData(newData);
                            }}
                            className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <label className="ml-2 text-xs text-gray-700">Visible dans le catalogue</label>
                        </div>

                        {/* Materials Preview for this article */}
                        {articleMaterials.length > 0 && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                            <p className="text-xs font-medium text-yellow-800 mb-1">Matériaux à consommer pour cet article:</p>
                            <div className="space-y-1">
                              {articleMaterials.map((mat, idx) => {
                                const stockInfo = matiereStocks.find(ms => ms.matiereId === mat.matiereId);
                                const availableStock = stockInfo?.currentStock || 0;
                                const isInsufficient = availableStock < mat.requiredQuantity;
                                return (
                                  <div key={idx} className={`text-xs ${isInsufficient ? 'text-red-700' : 'text-yellow-700'}`}>
                                    {mat.matiereName}: {mat.requiredQuantity} {mat.unit || 'unité'} 
                                    {isInsufficient && (
                                      <span className="ml-1 font-medium">(Stock insuffisant: {availableStock} disponible)</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Legacy mode: Show single product form (only if no articles) */
          <>
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
                  onChange={(e) => {
                    setFormData({ ...formData, validatedCostPrice: e.target.value });
                    // Clear error when field is filled
                    if (fieldErrors.legacy?.validatedCostPrice && parseFloat(e.target.value) > 0) {
                      setFieldErrors({
                        legacy: { ...fieldErrors.legacy, validatedCostPrice: false }
                      });
                    }
                  }}
                  allowDecimals={false}
                  placeholder="0"
                  error={fieldErrors.legacy?.validatedCostPrice ? 'Ce champ est requis' : undefined}
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
              name="name"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                // Clear error when field is filled
                if (fieldErrors.legacy?.name && e.target.value.trim()) {
                  setFieldErrors({
                    legacy: { ...fieldErrors.legacy, name: false }
                  });
                }
              }}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                fieldErrors.legacy?.name
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              placeholder="Nom du produit"
            />
            {fieldErrors.legacy?.name && (
              <p className="mt-1 text-sm text-red-500">Ce champ est requis</p>
            )}
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
                onChange={(e) => {
                  setFormData({ ...formData, sellingPrice: e.target.value });
                  // Clear error when field is filled
                  if (fieldErrors.legacy?.sellingPrice && parseFloat(e.target.value) > 0) {
                    setFieldErrors({
                      legacy: { ...fieldErrors.legacy, sellingPrice: false }
                    });
                  }
                }}
                allowDecimals={false}
                placeholder="0"
                error={fieldErrors.legacy?.sellingPrice ? 'Ce champ est requis' : undefined}
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

            {/* Materials Summary (only for legacy mode) */}
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
          </>
        )}
      </div>
    </Modal>
  );
};

export default PublishProductionModal;

