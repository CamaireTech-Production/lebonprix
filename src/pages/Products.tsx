import { useState, useEffect } from 'react';
import { Grid, List, Plus, Search, Edit2, Upload, Trash2, CheckSquare, Square, Info, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal, { ModalFooter } from '../components/common/Modal';
import Input from '../components/common/Input';
import { useProducts, useStockChanges, useCategories, useSuppliers } from '../hooks/useFirestore';
import { useInfiniteProducts } from '../hooks/useInfiniteProducts';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useAllStockBatches } from '../hooks/useStockBatches';
import { createSupplier, updateProduct} from '../services/firestore';
import { useAuth } from '../contexts/AuthContext';
import { FirebaseStorageService } from '../services/firebaseStorageService';
import { ImageWithSkeleton } from '../components/common/ImageWithSkeleton';
import LoadingScreen from '../components/common/LoadingScreen';
import SyncIndicator from '../components/common/SyncIndicator';
import { showSuccessToast, showErrorToast, showWarningToast } from '../utils/toast';
import imageCompression from 'browser-image-compression';
import * as Papa from 'papaparse';
import type { Product, ProductTag} from '../types/models';
import type { ParseResult } from 'papaparse';
import { getLatestCostPrice} from '../utils/productUtils';
import { 
  getProductBatchesForAdjustment,
  adjustBatchWithDebtManagement
} from '../services/stockAdjustments';
import type { StockBatch } from '../types/models';
import CostPriceCarousel from '../components/products/CostPriceCarousel';
import ProductTagsManager from '../components/products/ProductTagsManager';
import CategorySelector from '../components/products/CategorySelector';

interface CsvRow {
  [key: string]: string;
}

const Products = () => {
  const { t, i18n } = useTranslation();
  // Use infinite scroll for products instead of limited loading
  const { 
    products: infiniteProducts, 
    loading: infiniteLoading, 
    loadingMore, 
    syncing: infiniteSyncing, // Add syncing state
    hasMore, 
    error: infiniteError, 
    loadMore, 
    refresh 
  } = useInfiniteProducts();
  
  // Keep original hook for adding/updating products
  const { addProduct, updateProductData } = useProducts();
  const { stockChanges } = useStockChanges();
  useCategories();
  const { suppliers } = useSuppliers();
  const { batches: allStockBatches } = useAllStockBatches();
  const { user } = useAuth();
  
  // Set up infinite scroll
  useInfiniteScroll({
    hasMore,
    loading: loadingMore,
    onLoadMore: loadMore,
    threshold: 300 // Load more when 300px from bottom
  });
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(t('products.filters.allCategories'));
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Local state to track visibility changes for immediate UI updates
  const [visibilityOverrides, setVisibilityOverrides] = useState<Record<string, boolean>>({});
  
  // Two-step form state
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  
  // Step 1: Basic product info
  const [step1Data, setStep1Data] = useState({
    name: '',
    reference: '',
    category: '',
    images: [] as File[],
    tags: [] as ProductTag[],
    isVisible: true, // Default to visible
  });
  
  // Step 2: Initial stock and supply info
  const [step2Data, setStep2Data] = useState({
    stock: '',
    supplyType: 'ownPurchase' as 'ownPurchase' | 'fromSupplier',
    supplierId: '',
    paymentType: 'paid' as 'credit' | 'paid',
    stockCostPrice: '',
    sellingPrice: '',
    cataloguePrice: '',
  });
  
  // Quick add supplier state
  const [isQuickAddSupplierOpen, setIsQuickAddSupplierOpen] = useState(false);
  const [quickSupplierData, setQuickSupplierData] = useState({
    name: '',
    contact: '',
    location: ''
  });
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [editTab, setEditTab] = useState<'info' | 'stock' | 'pricing'>('info');
  // State for stock adjustment tab
  const [stockAdjustment, setStockAdjustment] = useState('');
  const [stockReason, setStockReason] = useState<'restock' | 'adjustment' | 'damage'>('restock');
  
  // State for stock adjustment supplier info
  const [stockAdjustmentSupplier, setStockAdjustmentSupplier] = useState({
    supplyType: 'ownPurchase' as 'ownPurchase' | 'fromSupplier',
    supplierId: '',
    paymentType: 'paid' as 'credit' | 'paid',
    costPrice: '',
  });

  // Enhanced Stock Management State (All Scenarios)
  const [availableBatches, setAvailableBatches] = useState<StockBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<StockBatch | null>(null);
  const [loadingBatches, setLoadingBatches] = useState(false);
  
  // Scenario 2: Manual Adjustment - Enhanced with purchase method editing
  const [tempBatchEdits, setTempBatchEdits] = useState<Array<{
    batchId: string;
    batch: StockBatch;
    newStock: number;
    newCostPrice: number;
    quantityChange: number;
    newSupplyType: 'ownPurchase' | 'fromSupplier';
    newSupplierId?: string;
    newPaymentType: 'paid' | 'credit';
    timestamp: Date;
    scenario: 'adjustment' | 'damage';
  }>>([]);
  
  const [batchEditForm, setBatchEditForm] = useState({
    stock: '',
    costPrice: '',
    supplyType: 'ownPurchase' as 'ownPurchase' | 'fromSupplier',
    supplierId: '',
    paymentType: 'paid' as 'paid' | 'credit'
  });
  
  // Scenario 3: Damage State
  const [damageForm, setBatchDamageForm] = useState({
    damagedQuantity: ''
  });
  
  const [isBulkSelection, setIsBulkSelection] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  
  // Add state for saveCategories
  const [saveCategories, setSaveCategories] = useState(false);

  // Add state for detail modal
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [detailTab, setDetailTab] = useState<'details' | 'stock'>('details');

  // Add state for stock history table controls
  const [stockHistoryPage, setStockHistoryPage] = useState(1);
  const [stockHistoryPerPage, setStockHistoryPerPage] = useState(10);
  const [stockHistorySortBy, setStockHistorySortBy] = useState<'date' | 'change' | 'reason'>('date');
  const [stockHistorySortOrder, setStockHistorySortOrder] = useState<'asc' | 'desc'>('desc');
  const [stockHistoryFilterType, setStockHistoryFilterType] = useState<string>('');
  const [stockHistoryFilterSupplier, setStockHistoryFilterSupplier] = useState<string>('');
  const [stockHistorySearch, setStockHistorySearch] = useState('');
  
  // --- State for image gallery per product ---
  const [mainImageIndexes, setMainImageIndexes] = useState<Record<string, number>>({});
  const handleSetMainImage = (productId: string, idx: number) => {
    setMainImageIndexes(prev => ({ ...prev, [productId]: idx }));
  };
  const handlePrevImage = (productId: string, images: string[]) => {
    setMainImageIndexes(prev => {
      const current = prev[productId] ?? 0;
      return { ...prev, [productId]: (current - 1 + images.length) % images.length };
    });
  };
  const handleNextImage = (productId: string, images: string[]) => {
    setMainImageIndexes(prev => {
      const current = prev[productId] ?? 0;
      return { ...prev, [productId]: (current + 1) % images.length };
    });
  };
  
  const handleStep1InputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setStep1Data(prev => ({ ...prev, [name]: value }));
  };
  
  const handleStep2InputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Filter out decimals for price fields
    const filteredValue = ['stockCostPrice', 'sellingPrice', 'cataloguePrice'].includes(name) 
      ? value.replace(/[^0-9]/g, '') 
      : value;
    
    setStep2Data(prev => ({ ...prev, [name]: filteredValue }));
  };
  
  const handleQuickSupplierInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setQuickSupplierData(prev => ({ ...prev, [name]: value }));
  };
  
  const resetForm = () => {
    setStep1Data({
      name: '',
      reference: '',
      category: '',
      images: [],
      tags: [],
      isVisible: true,
    });
    setStep2Data({
      stock: '',
      supplyType: 'ownPurchase',
      supplierId: '',
      paymentType: 'paid',
      stockCostPrice: '',
      sellingPrice: '',
      cataloguePrice: '',
    });
    setCurrentStep(1);
  };

  // Get unique categories from products
  const categories = [t('products.filters.allCategories'), ...new Set(infiniteProducts?.map(p => p.category) || [])];

  
  const compressImage = async (file: File): Promise<File> => {
      const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
        useWebWorker: true,
      };
    try {
      const compressedFile = await imageCompression(file, options);
      console.log(`Compressed image from ${file.size / 1024 / 1024} MB to ${compressedFile.size / 1024 / 1024} MB`);
        // Return the compressed File object
      return compressedFile;
    } catch (error) {
      console.error('Image compression error:', error);
      throw error;
    }
  };

  const handleAddProduct = async () => {
    if (!user?.uid) return;
    
    // Validate step 1 data
    if (!step1Data.name || !step1Data.category) {
      showWarningToast(t('products.messages.warnings.requiredFields'));
      return;
    }
    
    // Validate step 2 data
    if (!step2Data.stock || parseInt(step2Data.stock) <= 0 || !step2Data.stockCostPrice || !step2Data.sellingPrice) {
      showWarningToast(t('products.messages.warnings.requiredFields'));
      return;
    }
    
    if (step2Data.supplyType === 'fromSupplier' && !step2Data.supplierId) {
      showWarningToast(t('products.form.step2.supplierRequired'));
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      let reference = step1Data.reference.trim();
    if (!reference) {
      // Auto-generate reference: first 3 uppercase letters of name + 3-digit number
        const prefix = step1Data.name.substring(0, 3).toUpperCase();
      // Count existing products with this prefix
      const samePrefixCount = infiniteProducts.filter(p => p.reference && p.reference.startsWith(prefix)).length;
      const nextNumber = (samePrefixCount + 1).toString().padStart(3, '0');
      reference = `${prefix}${nextNumber}`;
    }
      
      const stockQuantity = parseInt(step2Data.stock);
      const stockCostPrice = step2Data.stockCostPrice ? parseFloat(step2Data.stockCostPrice) : 0;
      
      // Initialize image variables first
      let imageUrls: string[] = [];
      let imagePaths: string[] = [];
      
      // Upload images to Firebase Storage first if any
      
      if (step1Data.images.length > 0) {
        try {
          const storageService = new FirebaseStorageService();
          // Generate a temporary ID for the upload
          const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const uploadResults = await storageService.uploadProductImagesFromFiles(
            step1Data.images,
            user.uid,
            tempId
          );
          
          imageUrls = uploadResults.map(result => result.url);
          imagePaths = uploadResults.map(result => result.path);
        } catch (error) {
          console.error('Error uploading images:', error);
          showErrorToast('Image upload failed');
          return;
        }
      }

      // Create product data after image upload
      const productData = {
        name: step1Data.name,
        reference,
        sellingPrice: parseFloat(step2Data.sellingPrice),
        cataloguePrice: step2Data.cataloguePrice ? parseFloat(step2Data.cataloguePrice) : 0,
        category: step1Data.category,
        stock: stockQuantity,
        costPrice: stockCostPrice,
        images: imageUrls, // Firebase Storage URLs
        imagePaths: imagePaths, // Firebase Storage paths
        tags: step1Data.tags.length > 0 ? step1Data.tags : [],
        isAvailable: true,
        isVisible: step1Data.isVisible !== false, // Default to true, never undefined
        enableBatchTracking: true, // Explicitly enable batch tracking
        userId: user.uid,
        updatedAt: { seconds: 0, nanoseconds: 0 }
      };
      
      // Create supplier info for the product creation
      const supplierInfo = step2Data.supplyType === 'fromSupplier' ? {
        supplierId: step2Data.supplierId,
        isOwnPurchase: false,
        isCredit: step2Data.paymentType === 'credit',
        costPrice: stockCostPrice
      } : {
        isOwnPurchase: true,
        isCredit: false,
        costPrice: stockCostPrice
      };

      // Create the product with supplier information (debt creation is now handled in createProduct)
      await addProduct(productData, supplierInfo);
      
      setIsAddModalOpen(false);
      resetForm();
      showSuccessToast(t('products.messages.productAdded'));
      
    } catch (err) {
      console.error('Error adding product:', err);
      showErrorToast(t('products.messages.errors.addProduct'));
      setIsAddModalOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Step navigation functions
  const nextStep = () => {
    if (currentStep === 1) {
      // Validate step 1
      if (!step1Data.name || !step1Data.category) {
      showWarningToast(t('products.messages.warnings.requiredFields'));
      return;
    }
      setCurrentStep(2);
    }
  };

  const prevStep = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    }
  };

  // Quick add supplier function
  const handleQuickAddSupplier = async () => {
    if (!user?.uid) return;
    if (!quickSupplierData.name || !quickSupplierData.contact) {
      showWarningToast(t('suppliers.messages.warnings.requiredFields'));
      return;
    }

    setIsAddingSupplier(true);
    try {
      const newSupplier = await createSupplier({
        name: quickSupplierData.name,
        contact: quickSupplierData.contact,
        location: quickSupplierData.location || undefined,
        userId: user.uid
      });

      // Set the new supplier as selected
      setStep2Data(prev => ({
      ...prev,
        supplierId: newSupplier.id
      }));

      setIsQuickAddSupplierOpen(false);
      setQuickSupplierData({
        name: '',
        contact: '',
        location: ''
      });
      showSuccessToast(t('suppliers.messages.supplierAdded'));
    } catch (err) {
      console.error('Error adding supplier:', err);
      showErrorToast(t('suppliers.messages.errors.addSupplier'));
    } finally {
      setIsAddingSupplier(false);
    }
  };

  const handleStockAdjustmentSupplierChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setStockAdjustmentSupplier(prev => ({ ...prev, [name]: value }));
  };

  // Enhanced Manual Adjustment Functions
  const loadBatchesForAdjustment = async (productId: string) => {
    if (!productId) return;
    
    setLoadingBatches(true);
    try {
      const batches = await getProductBatchesForAdjustment(productId);
      // Filter out batches that are already in temp edits
      const filteredBatches = batches.filter(batch => 
        !tempBatchEdits.some(edit => edit.batchId === batch.id)
      );
      setAvailableBatches(filteredBatches);
    } catch (error) {
      console.error('Error loading batches:', error);
      showErrorToast('Failed to load available batches');
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleBatchSelection = (batchId: string) => {
    setSelectedBatchId(batchId);
    const batch = availableBatches.find(b => b.id === batchId);
    if (batch) {
      setSelectedBatch(batch);
      
      // Pre-fill form based on scenario
      if (stockReason === 'adjustment') {
        // Manual adjustment: pre-fill with TOTAL QUANTITY (not remaining)
        // This maintains coherence between quantity and remainingQuantity
        // For manual adjustment, we preserve the original batch's supplier and payment type
        setBatchEditForm({
          stock: batch.quantity.toString(), // Use total quantity instead of remaining
          costPrice: batch.costPrice.toString(),
          supplyType: batch.isOwnPurchase ? 'ownPurchase' : 'fromSupplier',
          supplierId: batch.supplierId || '', // Preserve original supplier
          paymentType: batch.isCredit ? 'credit' : 'paid' // Preserve original payment type
        });
      } else if (stockReason === 'damage') {
        // Damage: only pre-fill damage quantity form
        setBatchDamageForm({
          damagedQuantity: ''
        });
      }
    } else {
      setSelectedBatch(null);
      setBatchEditForm({ 
        stock: '', 
        costPrice: '',
        supplyType: 'ownPurchase',
        supplierId: '',
        paymentType: 'paid'
      });
      setBatchDamageForm({ damagedQuantity: '' });
    }
  };

  const handleBatchEditFormChange = (field: string, value: string) => {
    setBatchEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleDamageFormChange = (field: string, value: string) => {
    setBatchDamageForm(prev => ({ ...prev, [field]: value }));
    
    // Real-time validation for damage quantity
    if (field === 'damagedQuantity' && selectedBatch && value) {
      const damagedQuantity = parseFloat(value);
      if (!isNaN(damagedQuantity) && damagedQuantity > selectedBatch.remainingQuantity) {
        showErrorToast(`Cannot exceed available stock: ${selectedBatch.remainingQuantity} units`);
      }
    }
  };

  const addTempBatchEdit = () => {
    if (!selectedBatch) return;

    // Validation based on scenario
    if (stockReason === 'adjustment') {
      if (!batchEditForm.stock || !batchEditForm.costPrice) {
        showErrorToast('Please fill in all required fields');
        return;
      }
      // For manual adjustment, supplier is preserved from the original batch
      // No need to validate supplier selection as it's automatically set

      const newTotalQuantity = parseFloat(batchEditForm.stock);
      const usedQuantity = selectedBatch.quantity - selectedBatch.remainingQuantity;
      const newRemainingQuantity = newTotalQuantity - usedQuantity;

      // Check if the new remaining quantity would be negative
      if (newRemainingQuantity < 0) {
        showErrorToast(`Invalid quantity! This batch has ${usedQuantity} units already used. Minimum total quantity: ${usedQuantity}`);
        return;
      }

      // Calculate the actual quantity change (difference in total quantity)
      const quantityChange = newTotalQuantity - selectedBatch.quantity;

      const newEdit = {
        batchId: selectedBatch.id,
        batch: selectedBatch,
        newStock: newTotalQuantity,
        newCostPrice: parseFloat(batchEditForm.costPrice),
        quantityChange,
        newSupplyType: selectedBatch.isOwnPurchase ? 'ownPurchase' as const : 'fromSupplier' as const,
        newSupplierId: selectedBatch.supplierId, // Preserve the original supplier from the batch
        newPaymentType: selectedBatch.isCredit ? 'credit' as const : 'paid' as const, // Preserve the original payment type
        timestamp: new Date(),
        scenario: 'adjustment' as const
      };

      setTempBatchEdits(prev => [...prev, newEdit]);
      showSuccessToast(`Manual adjustment added: ${quantityChange >= 0 ? '+' : ''}${quantityChange} units @ ${parseFloat(batchEditForm.costPrice).toLocaleString()} XAF`);

    } else if (stockReason === 'damage') {
      if (!damageForm.damagedQuantity) {
        showErrorToast('Please enter the damaged quantity');
        return;
      }

      const damagedQuantity = parseFloat(damageForm.damagedQuantity);
      if (damagedQuantity <= 0 || damagedQuantity > selectedBatch.remainingQuantity) {
        showErrorToast(`Invalid quantity. Must be between 1 and ${selectedBatch.remainingQuantity}`);
        return;
      }

      const newEdit = {
        batchId: selectedBatch.id,
        batch: selectedBatch,
        newStock: selectedBatch.remainingQuantity - damagedQuantity,
        newCostPrice: selectedBatch.costPrice,
        quantityChange: -damagedQuantity,
        newSupplyType: selectedBatch.isOwnPurchase ? 'ownPurchase' as const : 'fromSupplier' as const,
        newSupplierId: selectedBatch.supplierId,
        newPaymentType: selectedBatch.isCredit ? 'credit' as const : 'paid' as const,
        timestamp: new Date(),
        scenario: 'damage' as const
      };

      setTempBatchEdits(prev => [...prev, newEdit]);
      showSuccessToast(`Damage recorded: -${damagedQuantity} units`);
    }

    // Reset form and reload batches
    setBatchEditForm({
      stock: '',
      costPrice: '',
      supplyType: 'ownPurchase',
      supplierId: '',
      paymentType: 'paid'
    });
    setBatchDamageForm({ damagedQuantity: '' });
    setSelectedBatchId('');
    setSelectedBatch(null);
    
    // Reload batches to exclude the one just added
    if (currentProduct?.id) {
      loadBatchesForAdjustment(currentProduct.id);
    }
  };

  const removeTempBatchEdit = (batchId: string) => {
    setTempBatchEdits(prev => prev.filter(edit => edit.batchId !== batchId));
    showSuccessToast('Batch edit removed from list');
    
    // Reload batches to include the removed one back
    if (currentProduct?.id) {
      loadBatchesForAdjustment(currentProduct.id);
    }
  };

  const clearAllTempBatchEdits = () => {
    setTempBatchEdits([]);
    setBatchEditForm({
      stock: '',
      costPrice: '',
      supplyType: 'ownPurchase',
      supplierId: '',
      paymentType: 'paid'
    });
    setBatchDamageForm({ damagedQuantity: '' });
    setSelectedBatchId('');
    setSelectedBatch(null);
    showSuccessToast('All batch edits cleared');
    
    // Reload batches
    if (currentProduct?.id) {
      loadBatchesForAdjustment(currentProduct.id);
    }
  };





  const handleQuickAddSupplierForStock = async () => {
    if (!user?.uid) return;
    if (!quickSupplierData.name || !quickSupplierData.contact) {
      showWarningToast(t('suppliers.messages.warnings.requiredFields'));
      return;
    }

    setIsAddingSupplier(true);
    try {
      const newSupplier = await createSupplier({
        name: quickSupplierData.name,
        contact: quickSupplierData.contact,
        location: quickSupplierData.location || undefined,
        userId: user.uid
      });

      // Set the new supplier as selected for stock adjustment
      setStockAdjustmentSupplier(prev => ({
        ...prev,
        supplierId: newSupplier.id
      }));

      setIsQuickAddSupplierOpen(false);
      setQuickSupplierData({
        name: '',
        contact: '',
        location: ''
      });
      showSuccessToast(t('suppliers.messages.supplierAdded'));
    } catch (err) {
      console.error('Error adding supplier for stock:', err);
      showErrorToast(t('suppliers.messages.errors.addSupplier'));
    } finally {
      setIsAddingSupplier(false);
    }
  };
  
  // Add state for editable prices
  const [editPrices, setEditPrices] = useState({
    sellingPrice: '',
    cataloguePrice: '',
    costPrice: ''
  });
  
  // In openEditModal, initialize editPrices from product and latest stock change
  const openEditModal = (product: Product) => {
    setCurrentProduct(product);
    setStep1Data({
      name: product.name,
      reference: product.reference,
      category: product.category,
      images: [], // Will be handled separately for editing
      tags: product.tags || [],
      isVisible: product.isVisible !== undefined ? product.isVisible : true, // Load visibility setting
    });
    // Find latest stock change for this product
    const latestStockChange = stockChanges
      .filter(sc => sc.productId === product.id)
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0];
    setEditPrices({
      sellingPrice: product.sellingPrice?.toString() || '',
      cataloguePrice: product.cataloguePrice?.toString() || '',
      costPrice: latestStockChange?.costPrice?.toString() || ''
    });
    
    // Reset enhancement states for all scenarios
    setTempBatchEdits([]);
    setSelectedBatchId('');
    setSelectedBatch(null);
    setBatchEditForm({ 
      stock: '', 
      costPrice: '',
      supplyType: 'ownPurchase',
      supplierId: '',
      paymentType: 'paid'
    });
    setBatchDamageForm({ damagedQuantity: '' });
    setStockReason('restock');
    
    setIsEditModalOpen(true);
    setEditTab('info');
    setStockAdjustment('');
  };
  
  const handleEditProduct = async () => {
    if (!currentProduct || !user?.uid) {
      return;
    }
    if (!step1Data.name || !step1Data.category) {
      showWarningToast(t('products.messages.warnings.requiredFields'));
      return;
    }
    setIsSubmitting(true);
    const safeProduct = {
      ...currentProduct,
      isAvailable: typeof currentProduct.isAvailable === 'boolean' ? currentProduct.isAvailable : true,
      userId: currentProduct.userId || user.uid,
      updatedAt: currentProduct.updatedAt || { seconds: 0, nanoseconds: 0 },
    };
    const updateData: Partial<Product> = {
      name: step1Data.name,
      category: step1Data.category,
      images: safeProduct.images, // Keep existing images, will be updated separately if needed
      tags: step1Data.tags || [], // Include tags in the update, default to empty array
      isAvailable: safeProduct.isAvailable,
      isVisible: step1Data.isVisible !== false, // Default to true, never undefined
      userId: safeProduct.userId,
      updatedAt: { seconds: 0, nanoseconds: 0 },
      sellingPrice: editPrices.sellingPrice ? parseFloat(editPrices.sellingPrice) : safeProduct.sellingPrice,
      cataloguePrice: editPrices.cataloguePrice ? parseFloat(editPrices.cataloguePrice) : safeProduct.cataloguePrice
    };
    if (step1Data.reference && step1Data.reference.trim() !== '') {
      updateData.reference = step1Data.reference;
    }
    
    try {
      // Handle enhanced manual adjustment and damage scenarios with batch edits
      if ((stockReason === 'adjustment' || stockReason === 'damage') && tempBatchEdits.length > 0) {
        // First update product info
        await updateProductData(currentProduct.id, updateData);
        
        // Then apply all batch adjustments with enhanced debt management
        const adjustments = tempBatchEdits.map(edit => ({
          batchId: edit.batchId,
          quantityChange: edit.quantityChange,
          newCostPrice: edit.newCostPrice,
          newSupplyType: edit.newSupplyType,
          newSupplierId: edit.newSupplierId,
          newPaymentType: edit.newPaymentType,
          scenario: edit.scenario,
          notes: `${edit.scenario === 'damage' ? 'Damage' : 'Manual adjustment'} via product edit`
        }));
        
        await adjustBatchWithDebtManagement(currentProduct.id, adjustments);
        showSuccessToast(`Applied ${tempBatchEdits.length} ${stockReason === 'damage' ? 'damage records' : 'batch adjustments'}!`);
      }
      // Handle traditional stock adjustment if provided (restock or simple adjustment)
      else if (stockAdjustment && parseInt(stockAdjustment) !== 0) {
        const stockChange = parseInt(stockAdjustment);
        const stockReasonType = stockReason as 'restock' | 'adjustment';
        
        // For restock, add to current stock
        if (stockReasonType === 'restock') {
          const newStock = (currentProduct.stock || 0) + stockChange;
          updateData.stock = newStock;
          
          // Create stock change with supplier info
          await updateProductData(currentProduct.id, updateData, stockReasonType, stockChange, {
            supplierId: stockAdjustmentSupplier.supplierId || undefined,
            isOwnPurchase: stockAdjustmentSupplier.supplyType === 'ownPurchase',
            isCredit: stockAdjustmentSupplier.paymentType === 'credit',
            costPrice: stockAdjustmentSupplier.costPrice ? parseFloat(stockAdjustmentSupplier.costPrice) : undefined
          });
          
          // Create supplier debt if applicable (same logic as product creation)
          if (stockAdjustmentSupplier.supplyType === 'fromSupplier' && stockAdjustmentSupplier.paymentType === 'credit' && stockAdjustmentSupplier.supplierId) {
            const debtAmount = parseFloat(stockAdjustmentSupplier.costPrice) * stockChange;
            const description = `Restock purchase for ${currentProduct.name} (${stockChange} units)`;
            
            // Note: Debt creation with batchId is now handled in updateProductData function
            // The batchId will be included automatically
          }
        } else {
          // For simple adjustment, set to new value
          updateData.stock = stockChange;
          await updateProductData(currentProduct.id, updateData, stockReasonType, stockChange - (currentProduct.stock || 0));
        }
      } else {
        // No stock adjustment, just update product info
        await updateProductData(currentProduct.id, updateData);
      }
      
      // Handle File to Firebase Storage conversion for images
      if (step1Data.images.length > 0) {
        try {
          const storageService = new FirebaseStorageService();
          const uploadResults = await storageService.uploadProductImagesFromFiles(
            step1Data.images,
            user.uid,
            currentProduct.id
          );
          
          // Update product with new image URLs and paths
          const imageUrls = uploadResults.map(result => result.url);
          const imagePaths = uploadResults.map(result => result.path);
          
          // Update the product with new image URLs
          await updateProduct(currentProduct.id, {
            images: imageUrls,
            imagePaths: imagePaths
          });
        } catch (error) {
          console.error('Error uploading images:', error);
          showErrorToast('Product updated but images failed to upload');
        }
      }

      // Update latest stock change cost price if changed
      const latestStockChange = stockChanges
        .filter(sc => sc.productId === currentProduct.id)
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0];
      if (latestStockChange && editPrices.costPrice && parseFloat(editPrices.costPrice) !== latestStockChange.costPrice) {
        // Use updateProductData with stockReason 'adjustment' and stockChange 0 to update cost price only
        await updateProductData(currentProduct.id, {}, 'adjustment', 0, {
          supplierId: latestStockChange.supplierId,
          isOwnPurchase: latestStockChange.isOwnPurchase,
          isCredit: latestStockChange.isCredit,
          costPrice: parseFloat(editPrices.costPrice)
        });
      }
      setIsEditModalOpen(false);
      resetForm();
      showSuccessToast(t('products.messages.productUpdated'));
    } catch (err) {
      console.error('Error updating product:', err);
      showErrorToast(t('products.messages.errors.updateProductData'));
      setIsEditModalOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };



  const openDeleteModal = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteModalOpen(true);
  };

  // Migration: create initial StockChange for products with stock > 0 and no StockChange
  useEffect(() => {
    if (!infiniteProducts?.length || !stockChanges?.length || !user?.uid) return;
    infiniteProducts.forEach(async (product) => {
      const hasStockChange = stockChanges.some((sc) => sc.productId === product.id);
      if (product.stock > 0 && !hasStockChange) {
        // Create an initial adjustment with 'creation' reason
        try {
          await updateProductData(product.id, { stock: product.stock }, 'creation', product.stock);
        } catch (e) { console.error(`Failed to create initial stock for ${product.id}:`, e) }
      }
    });
  }, [infiniteProducts, stockChanges, user, updateProductData]);

  useEffect(() => {
    setSelectedCategory(t('products.filters.allCategories'));
  }, [i18n.language, t]);

  // Clean up visibility overrides when server data matches our override
  useEffect(() => {
    if (infiniteProducts.length > 0) {
      setVisibilityOverrides(prev => {
        const newOverrides = { ...prev };
        let hasChanges = false;
        
        // Only remove overrides when the server data actually matches our override
        Object.keys(newOverrides).forEach(productId => {
          const product = infiniteProducts.find(p => p.id === productId);
          if (product && product.isVisible === newOverrides[productId]) {
            // Server data now matches our override, so we can remove it
            console.log('Cleaning up override for product:', productId, 'server data matches override');
            delete newOverrides[productId];
            hasChanges = true;
          }
        });
        
        if (hasChanges) {
          console.log('Updated overrides:', newOverrides);
        }
        
        return hasChanges ? newOverrides : prev;
      });
    }
  }, [infiniteProducts]);

  // Load batches when stock reason changes to adjustment or damage
  useEffect(() => {
    if ((stockReason === 'adjustment' || stockReason === 'damage') && currentProduct?.id && isEditModalOpen) {
      loadBatchesForAdjustment(currentProduct.id);
    }
  }, [stockReason, currentProduct?.id, isEditModalOpen]);

  const toggleBulkSelection = () => {
    setIsBulkSelection((prev) => !prev);
    setSelectedProducts([]);
  };

  const handleSelectProduct = (id: string) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map((p) => p.id));
    }
  };

  const handleBulkDelete = async () => {
    if (!user?.uid) return;
    try {
      setIsDeleting(true);
      for (const id of selectedProducts) {
        const product = infiniteProducts.find(p => p.id === id);
        if (!product) continue;
        const safeProduct = {
          ...product,
          isAvailable: typeof product.isAvailable === 'boolean' ? product.isAvailable : true,
          images: (product.images ?? []).length > 0 ? product.images : [],
          userId: product.userId || user.uid,
          updatedAt: product.updatedAt || { seconds: 0, nanoseconds: 0 },
        };
        const updateData = { isAvailable: false, images: safeProduct.images, userId: safeProduct.userId, updatedAt: { seconds: 0, nanoseconds: 0 } };
        await updateProduct(id, updateData, user.uid);
      }
      showSuccessToast(t('products.messages.bulkDeleteSuccess', { count: selectedProducts.length }));
      setIsBulkDeleteModalOpen(false);
      setSelectedProducts([]);
      setIsBulkSelection(false);
    } catch (error) {
      console.error('Error in bulk delete:', error);
      showErrorToast(t('products.messages.errors.deleteProduct'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete || !user?.uid) return;
    const safeProduct = {
      ...productToDelete,
      isAvailable: typeof productToDelete.isAvailable === 'boolean' ? productToDelete.isAvailable : true,
      images: (productToDelete.images ?? []).length > 0 ? productToDelete.images : [],
      userId: productToDelete.userId || user.uid,
      updatedAt: productToDelete.updatedAt || { seconds: 0, nanoseconds: 0 },
    };
    const updateData = { isAvailable: false, images: safeProduct.images, userId: safeProduct.userId, updatedAt: { seconds: 0, nanoseconds: 0 } };
    try {
      setIsDeleting(true);
      await updateProduct(productToDelete.id, updateData, user.uid);
      showSuccessToast(t('products.messages.productDeleted'));
      setIsDeleteModalOpen(false);
      setProductToDelete(null);
    } catch (error) {
      console.error('Error deleting product:', error);
      showErrorToast(t('products.messages.errors.deleteProduct'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Add new handler for multiple image upload
  const handleImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setIsUploadingImages(true);
    const newImages: File[] = [];
    for (const file of files) {
      try {
        const compressedFile = await compressImage(file);
        newImages.push(compressedFile);
      } catch (err) {
        console.error('Error compressing image:', err);
        showErrorToast(t('products.messages.errors.addProduct'));
      }
    }
    console.log('Adding new images to step1Data:', newImages.map(img => img.substring(0, 50) + '...'));
    setStep1Data(prev => ({ ...prev, images: [...prev.images, ...newImages] }));
    setIsUploadingImages(false);
  };
  
  const handleRemoveImage = (idx: number) => {
    setStep1Data(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));
  };

  // Toggle product visibility
  const handleToggleVisibility = async (product: Product) => {
    if (!user?.uid) return;
    
    try {
      const currentEffectiveVisibility = getEffectiveVisibility(product);
      const newVisibility = !currentEffectiveVisibility;
      
      console.log('Toggle visibility:', {
        productId: product.id,
        originalVisibility: product.isVisible,
        currentEffectiveVisibility,
        newVisibility,
        currentOverrides: visibilityOverrides
      });
      
      // Optimistic update - immediately update the local state for instant UI feedback
      setVisibilityOverrides(prev => ({
        ...prev,
        [product.id]: newVisibility
      }));
      
      await updateProductData(product.id, { isVisible: newVisibility });
      
      showSuccessToast(
        newVisibility 
          ? t('products.messages.productShown') 
          : t('products.messages.productHidden')
      );
      
    } catch (error) {
      console.error('Error toggling product visibility:', error);
      showErrorToast(t('products.messages.errors.toggleVisibility'));
      
      // Revert the optimistic update on error
      setVisibilityOverrides(prev => {
        const newOverrides = { ...prev };
        delete newOverrides[product.id];
        return newOverrides;
      });
    }
  };

  // Helper function to get batches for a specific product
  const getProductBatches = (productId: string): StockBatch[] => {
    return allStockBatches.filter(batch => batch.productId === productId);
  };

  // Helper function to get the effective visibility state (considering optimistic updates)
  const getEffectiveVisibility = (product: Product): boolean => {
    return visibilityOverrides[product.id] !== undefined 
      ? visibilityOverrides[product.id] 
      : product.isVisible !== false;
  };

  // Place filteredProducts and resetImportState above their first usage
  const filteredProducts: Product[] = infiniteProducts?.filter((product: Product) => {
    if (typeof product.isAvailable !== 'undefined' && product.isAvailable === false) return false;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.reference.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === t('products.filters.allCategories') || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }) || [];

  const resetImportState = (): void => {
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMapping({});
    setImportProgress(0);
  };

  if (infiniteLoading) {
    return <LoadingScreen />;
  }

  if (infiniteError) {
    return (
      <div className="p-4 text-center text-red-600">
        <p>{t('products.messages.errors.loadProducts')}</p>
      </div>
    );
  }

  // Add handleImport, handleFileUpload, and handleColumnMappingChange above their first usage (modal code)
  const handleImport = async () => {
    if (!user?.uid) return;
    if (csvData.length === 0) {
      showWarningToast(t('products.import.noData'));
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    let importedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      // Extract and validate fields
      const name = columnMapping.name ? row[columnMapping.name]?.trim() : '';
      const reference = columnMapping.reference ? row[columnMapping.reference]?.trim() : '';
      const sellingPrice = columnMapping.sellingPrice ? parseFloat(row[columnMapping.sellingPrice]) : undefined;
      const cataloguePrice = columnMapping.cataloguePrice ? parseFloat(row[columnMapping.cataloguePrice]) : undefined;
      const category = columnMapping.category ? row[columnMapping.category]?.trim() : '';
      const stock = columnMapping.stock ? parseInt(row[columnMapping.stock]) : undefined;
      const costPrice = columnMapping.costPrice ? parseFloat(row[columnMapping.costPrice]) : undefined;
      const supplyType = columnMapping.supplyType ? row[columnMapping.supplyType]?.trim() : 'ownPurchase';
      const supplierIdRaw = columnMapping.supplierId ? row[columnMapping.supplierId]?.trim() : '';
      const paymentType = columnMapping.paymentType ? row[columnMapping.paymentType]?.trim() : 'paid';
      const supplierName = columnMapping.supplierName ? row[columnMapping.supplierName]?.trim() : '';

      if (!name || !category || !stock || !sellingPrice) {
        failedCount++;
        setImportProgress((i / csvData.length) * 100);
        continue;
      }

      // Build productData
      const productData = {
        name,
        reference,
        sellingPrice,
        cataloguePrice,
        category,
        stock,
        costPrice: costPrice || 0,
        images: [],
        isAvailable: true,
        userId: user.uid,
        updatedAt: { seconds: 0, nanoseconds: 0 }
      };

      // Build supplierInfo
      let supplierInfo: {
        supplierId?: string;
        isOwnPurchase: boolean;
        isCredit: boolean;
        costPrice?: number;
      } | undefined = undefined;
      let finalSupplyType = supplyType;
      let finalSupplierId = supplierIdRaw;
      if (supplyType === 'fromSupplier') {
        // Prefer supplierName if present
        let supplier = null;
        if (supplierName) {
          supplier = suppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase());
          if (!supplier) {
            supplier = await createSupplier({
              name: supplierName,
              contact: 'Imported',
              userId: user.uid
            });
          }
          finalSupplierId = supplier.id;
        } else if (finalSupplierId) {
          supplier = suppliers.find(s => s.id === finalSupplierId);
          if (!supplier) {
            supplier = await createSupplier({
              name: finalSupplierId,
              contact: 'Imported',
              userId: user.uid
            });
            finalSupplierId = supplier.id;
          }
        } else {
          // No supplier info, treat as own purchase
          finalSupplyType = 'ownPurchase';
        }
      }
      if (finalSupplyType === 'fromSupplier') {
        supplierInfo = {
          supplierId: finalSupplierId || undefined,
          isOwnPurchase: false,
          isCredit: paymentType === 'credit',
          costPrice: costPrice || 0
        };
      } else {
        supplierInfo = {
          isOwnPurchase: true,
          isCredit: false,
          costPrice: costPrice || 0
        };
      }

      try {
        await addProduct(productData, supplierInfo);
        importedCount++;
      } catch (err) {
        console.error(`Failed to import product ${name}:`, err);
        failedCount++;
      }
      setImportProgress(((i + 1) / csvData.length) * 100);
    }

    setIsImportModalOpen(false);
    resetImportState();
    showSuccessToast(t('products.import.success', { imported: importedCount, failed: failedCount }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: ParseResult<CsvRow>) => {
        setCsvData(results.data);
        setCsvHeaders(results.meta.fields || []);
        setColumnMapping({}); // Clear previous mapping
        setImportProgress(0);
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        showErrorToast(t('products.import.parseError'));
        setImportProgress(0);
      },
    });
  };

  const handleColumnMappingChange = (header: string, value: string) => {
    setColumnMapping(prev => ({ ...prev, [header]: value }));
  };

  return (
    <div className="pb-16 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('products.title')}</h1>
          <p className="text-gray-600">{t('products.subtitle')}</p>
        </div>
        
        <div className="mt-4 md:mt-0 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <div className="flex space-x-1">
            <button
              className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-gray-200' : 'bg-white'}`}
              onClick={() => setViewMode('grid')}
              title={t('products.actions.gridView')}
            >
              <Grid size={18} />
            </button>
            <button
              className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-gray-200' : 'bg-white'}`}
              onClick={() => setViewMode('list')}
              title={t('products.actions.listView')}
            >
              <List size={18} />
            </button>
          </div>
          
          <Button 
            icon={<Upload size={16} />}
            onClick={() => setIsImportModalOpen(true)}
            variant="outline"
          >
            {t('products.actions.importCSV')}
          </Button>
          
          <Button 
            icon={<Plus size={16} />}
            onClick={() => setIsAddModalOpen(true)}
          >
            {t('products.actions.addProduct')}
          </Button>
          
          {/* Temporary refresh button to clear old cached data */}
          <Button 
            variant="outline"
            onClick={() => {
              refresh();
              showSuccessToast('Products refreshed - images should now load properly');
            }}
          >
            🔄 Refresh Images
          </Button>
        </div>
      </div>
      
      {/* Search and filters */}
      <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 mb-6">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
            placeholder={t('products.filters.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {/* Sync Indicator */}
        <SyncIndicator 
          isSyncing={infiniteSyncing} 
          message="Updating products..." 
          className="mb-4"
        />
        
        <div className="flex space-x-2">
          <select
            className="rounded-md border border-gray-300 shadow-sm py-2 px-3 bg-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Bulk selection actions below filters */}
      <div className="flex space-x-2 mb-6">
        <Button
          icon={<CheckSquare size={16} />}
          variant={isBulkSelection ? 'primary' : 'outline'}
          onClick={toggleBulkSelection}
        >
          {isBulkSelection ? t('products.actions.cancelBulkSelection') : t('products.actions.bulkSelection')}
        </Button>
        {isBulkSelection && (
          <Button
            icon={<Square size={16} />}
            variant="outline"
            onClick={handleSelectAll}
          >
            {t('products.actions.selectAll')}
          </Button>
        )}
        {isBulkSelection && selectedProducts.length > 0 && (
          <Button
            icon={<Trash2 size={16} />}
            variant="danger"
            onClick={() => setIsBulkDeleteModalOpen(true)}
          >
            {t('products.actions.deleteSelected', { count: selectedProducts.length })}
          </Button>
        )}
      </div>
      
      {/* Products */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map(product => (
            <Card key={product.id} className="h-full relative" contentClassName="p-0">
              {isBulkSelection && !selectedProducts.includes(product.id) && (
                <div className="absolute inset-0 bg-black bg-opacity-20 z-10 rounded-md transition-opacity" />
              )}
              {isBulkSelection && (
                <button
                  className="absolute top-2 left-2 z-20 bg-white rounded-full p-1 border border-gray-300 shadow"
                  onClick={() => handleSelectProduct(product.id)}
                  aria-label={t('products.actions.selectProduct')}
                >
                  {selectedProducts.includes(product.id) ? <CheckSquare size={20} className="text-emerald-600" /> : <Square size={20} className="text-gray-400" />}
                </button>
              )}
              <div className="flex flex-col h-full p-0">
                <div className="relative w-full aspect-[1.35/1] overflow-hidden rounded-t-md">
                  {(() => {
                    const images = product.images ?? [];
                    const mainIdx = mainImageIndexes[product.id] ?? 0;
                    const mainImg = images.length > 0 ? images[mainIdx] : '/placeholder.png';
                    
                    return (
                      <ImageWithSkeleton
                        src={mainImg}
                        alt={product.name}
                        className="h-full w-full object-cover transition-all duration-300"
                        placeholder="/placeholder.png"
                      />
                    );
                  })()}
                </div>
                <div
                  className="flex items-center gap-1 px-2 py-2 bg-white border-b border-gray-100 overflow-x-auto custom-scrollbar"
                >
                  {(product.images ?? []).map((img, idx) => (
                    <ImageWithSkeleton
                      key={idx}
                      src={img}
                      alt={`Preview ${idx + 1}`}
                      className={`w-10 h-10 object-cover rounded border cursor-pointer transition-transform duration-200 ${mainImageIndexes[product.id] === idx ? 'ring-2 ring-emerald-500 scale-105' : 'opacity-70 hover:opacity-100'}`}
                      placeholder="/placeholder.png"
                      onClick={() => handleSetMainImage(product.id, idx)}
                    />
                  ))}
                  {/* If less than 4 images, fill with empty slots */}
                  {Array.from({ length: Math.max(0, 4 - (product.images?.length ?? 0)) }).map((_, idx) => (
                    <div
                      key={`empty-${idx}`}
                      className="w-10 h-10 rounded border border-dashed border-gray-300 flex items-center justify-center text-gray-300 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-all duration-200"
                    >
                      <Plus size={18} />
                    </div>
                  ))}
                </div>
                <div className="flex-grow px-4 pt-1 pb-3">
                  <h3 className="font-medium text-gray-900">{product.name}</h3>
                  <p className="text-sm text-gray-500">{product.reference}</p>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{t('products.table.columns.costPrice')}:</span>
                      <div className="font-medium">
                        <CostPriceCarousel batches={getProductBatches(product.id)} />
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{t('products.table.columns.sellingPrice')}:</span>
                      <span className="text-emerald-600 font-medium">{product.sellingPrice.toLocaleString()} XAF</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{t('products.table.columns.stock')}:</span>
                      <Badge variant={product.stock > 10 ? 'success' : product.stock > 5 ? 'warning' : 'error'}>
                        {product.stock} units
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">{product.category}</p>
                </div>
                <div className="mt-4 flex justify-end space-x-2 px-4 pb-3">
                  <button
                    onClick={() => { setDetailProduct(product); setIsDetailModalOpen(true); }}
                    className="text-blue-600 hover:text-blue-900"
                    title={t('products.actions.viewDetails', 'View Details')}
                  >
                    <Info size={16} />
                  </button>
                  <button
                    onClick={() => handleToggleVisibility(product)}
                    className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                      getEffectiveVisibility(product)
                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                    title={getEffectiveVisibility(product) ? t('products.actions.hideFromCatalogue') : t('products.actions.showInCatalogue')}
                  >
                    {getEffectiveVisibility(product) ? 'Visible on catalogue' : 'Hidden from catalogue'}
                  </button>
                  <button
                    onClick={() => openEditModal(product)}
                    className="text-indigo-600 hover:text-indigo-900"
                    title={t('products.actions.editProduct')}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => openDeleteModal(product)}
                    className="text-red-600 hover:text-red-900"
                    title={t('products.actions.deleteProduct')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {isBulkSelection && (
                    <th className="px-4 py-3">
                      <button onClick={handleSelectAll} aria-label={t('products.actions.selectAll')}>
                        {selectedProducts.length === filteredProducts.length && filteredProducts.length > 0 ? <CheckSquare size={18} className="text-emerald-600" /> : <Square size={18} className="text-gray-400" />}
                      </button>
                    </th>
                  )}
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('products.table.columns.product')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('products.table.columns.costPrice')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('products.table.columns.sellingPrice')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('products.table.columns.stock')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('products.table.columns.category')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('products.table.columns.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className={isBulkSelection && !selectedProducts.includes(product.id) ? 'relative' : ''}>
                    {isBulkSelection && !selectedProducts.includes(product.id) && (
                      <td className="absolute left-0 top-0 w-full h-full bg-black bg-opacity-20 z-10" colSpan={7} />
                    )}
                    {isBulkSelection && (
                      <td className="px-4 py-4 relative z-20">
                        <button onClick={() => handleSelectProduct(product.id)} aria-label={t('products.actions.selectProduct')}>
                          {selectedProducts.includes(product.id) ? <CheckSquare size={18} className="text-emerald-600" /> : <Square size={18} className="text-gray-400" />}
                        </button>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 relative group">
                          {(() => {
                            const images = product.images ?? [];
                            const mainIdx = mainImageIndexes[product.id] ?? 0;
                            const mainImg = images.length > 0 ? images[mainIdx] : '/placeholder.png';
                            return (
                              <>
                                {images.length > 1 && (
                                  <button
                                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white bg-opacity-80 rounded-full p-0.5 border border-gray-200 opacity-40 group-hover:opacity-90 transition-opacity duration-200"
                                    onClick={() => handlePrevImage(product.id, images)}
                                    style={{ left: '-20px' }}
                                    tabIndex={-1}
                                    aria-label="Previous image"
                                  >
                                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-gray-400">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                  </button>
                                )}
                                <ImageWithSkeleton
                                  src={mainImg}
                                  alt={product.name}
                                  className="h-10 w-10 rounded-md object-cover transition-all duration-300"
                                  placeholder="/placeholder.png"
                                />
                                {images.length > 1 && (
                                  <button
                                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white bg-opacity-80 rounded-full p-0.5 border border-gray-200 opacity-40 group-hover:opacity-90 transition-opacity duration-200"
                                    onClick={() => handleNextImage(product.id, images)}
                                    style={{ right: '-20px' }}
                                    tabIndex={-1}
                                    aria-label="Next image"
                                  >
                                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-gray-400">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        <div className="ml-6">
                          <div className="text-sm font-medium text-gray-900">{product.name}</div>
                          <div className="text-sm text-gray-500">{product.reference}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <CostPriceCarousel batches={getProductBatches(product.id)} />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-emerald-600 font-medium">{product.sellingPrice.toLocaleString()} XAF</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={product.stock > 10 ? 'success' : product.stock > 5 ? 'warning' : 'error'}>
                        {product.stock} units
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{product.category}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => { setDetailProduct(product); setIsDetailModalOpen(true); }}
                          className="text-blue-600 hover:text-blue-900"
                          title={t('products.actions.viewDetails', 'View Details')}
                        >
                          <Info size={16} />
                        </button>
                        <button
                          onClick={() => handleToggleVisibility(product)}
                          className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                            getEffectiveVisibility(product)
                              ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                              : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                          }`}
                          title={getEffectiveVisibility(product) ? t('products.actions.hideFromCatalogue') : t('products.actions.showInCatalogue')}
                        >
                          {getEffectiveVisibility(product) ? 'Visible on catalogue' : 'Hidden from catalogue'}
                        </button>
                        <button
                          onClick={() => openEditModal(product)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title={t('products.actions.editProduct')}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => openDeleteModal(product)}
                          className="text-red-600 hover:text-red-900"
                          title={t('products.actions.deleteProduct')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      
      {/* Infinite Scroll Loading Indicator */}
      {loadingMore && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          <span className="ml-3 text-gray-600">Loading more products...</span>
        </div>
      )}
      
      {/* End of products indicator */}
      {!hasMore && infiniteProducts.length > 0 && (
        <div className="text-center py-6 text-gray-500">
          <p>✅ All products loaded ({infiniteProducts.length} total)</p>
        </div>
      )}
      
      {/* Add Product Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          resetForm();
        }}
        title={t('products.actions.addProduct')}
        footer={
          <ModalFooter 
            onCancel={() => {
              setIsAddModalOpen(false);
              resetForm();
            }}
            onConfirm={currentStep === 1 ? nextStep : handleAddProduct}
            confirmText={currentStep === 1 ? t('products.actions.nextStep') : t('products.actions.complete')}
            isLoading={isSubmitting}
          />
        }
      >
        <div className="space-y-4">
          {/* Step indicator */}
          <div className="flex items-center justify-center space-x-4 mb-6">
            <div className={`flex items-center ${currentStep === 1 ? 'text-emerald-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 1 ? 'bg-emerald-600 text-white' : 'bg-gray-200'}`}>
                1
              </div>
              <span className="ml-2 text-sm font-medium">{t('products.form.step1.title')}</span>
            </div>
            <div className="w-8 h-0.5 bg-gray-300"></div>
            <div className={`flex items-center ${currentStep === 2 ? 'text-emerald-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 2 ? 'bg-emerald-600 text-white' : 'bg-gray-200'}`}>
                2
              </div>
              <span className="ml-2 text-sm font-medium">{t('products.form.step2.title')}</span>
            </div>
          </div>

          {currentStep === 1 ? (
            /* Step 1: Basic Product Information */
        <div className="space-y-4">
          <Input
            label={t('products.form.step1.name')}
            name="name"
                value={step1Data.name}
                onChange={handleStep1InputChange}
            required
          />
          
          <Input
            label={t('products.form.step1.reference')}
            name="reference"
                value={step1Data.reference}
                onChange={handleStep1InputChange}
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('products.form.step1.category')}
            </label>
            <CategorySelector
              value={step1Data.category}
              onChange={(category) => setStep1Data(prev => ({ ...prev, category }))}
              showImages={true}
              placeholder={t('products.form.categoryPlaceholder')}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('products.form.step1.image')}</label>
            <div className="flex items-center space-x-2 pb-2">
              <label className="w-20 h-20 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-md cursor-pointer bg-gray-50 hover:bg-gray-100 transition-all duration-200 relative flex-shrink-0">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={handleImagesUpload}
                  disabled={isUploadingImages}
                />
                {isUploadingImages ? (
                  <span className="animate-spin text-emerald-500"><Upload size={28} /></span>
                ) : (
                  <Upload size={28} className="text-gray-400" />
                )}
              </label>
              <div className="flex overflow-x-auto custom-scrollbar space-x-2 py-1">
                    {(step1Data.images ?? []).map((img, idx) => {
                      // Handle both File objects and existing URLs
                      let imageSrc: string;
                      if (img instanceof File) {
                        imageSrc = URL.createObjectURL(img);
                      } else if (typeof img === 'string') {
                        imageSrc = img;
                      } else {
                        console.warn('Invalid image object:', img);
                        imageSrc = '/placeholder.png';
                      }
                      
                      return (
                        <div key={idx} className="relative w-20 h-20 flex-shrink-0 rounded-md overflow-hidden group">
                          <ImageWithSkeleton
                            src={imageSrc}
                            alt={`Product ${idx + 1}`}
                            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                            placeholder="/placeholder.png"
                          />
                          <button
                            type="button"
                            className="absolute top-1 right-1 bg-white bg-opacity-80 rounded-full p-1 text-red-600 hover:text-red-800 shadow"
                            onClick={() => handleRemoveImage(idx)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      );
                    })}
              </div>
            </div>
            <p className="mt-1 text-sm text-gray-500">{t('products.form.imageHelp')}</p>
          </div>

          {/* Product Tags Manager */}
          <ProductTagsManager
            tags={step1Data.tags}
            onTagsChange={(tags) => setStep1Data(prev => ({ ...prev, tags }))}
            images={step1Data.images.map(img => img instanceof File ? URL.createObjectURL(img) : img)}
          />
            </div>
          ) : (
            /* Step 2: Initial Stock and Supply Information */
            <div className="space-y-4">
              <Input
                label={t('products.form.step2.stock')}
                name="stock"
                type="number"
                value={step2Data.stock}
                onChange={handleStep2InputChange}
                required
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('products.form.step2.supplyType')}
                </label>
                <select
                  name="supplyType"
                  value={step2Data.supplyType}
                  onChange={handleStep2InputChange}
                  className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2"
                >
                  <option value="ownPurchase">{t('products.form.step2.ownPurchase')}</option>
                  <option value="fromSupplier">{t('products.form.step2.fromSupplier')}</option>
                </select>
              </div>
              
              {/* Only supplier fields are conditional */}
              {step2Data.supplyType === 'fromSupplier' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('products.form.step2.supplier')}
                    </label>
                    <div className="flex space-x-2">
                      <select
                        name="supplierId"
                        value={step2Data.supplierId}
                        onChange={handleStep2InputChange}
                        className="flex-1 rounded-md border border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2"
                      >
                        <option value="">{t('common.select')}</option>
                        {suppliers.filter(s => !s.isDeleted).map(supplier => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsQuickAddSupplierOpen(true)}
                      >
                        {t('products.actions.addSupplier')}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('products.form.step2.paymentType')}
                    </label>
                    <select
                      name="paymentType"
                      value={step2Data.paymentType}
                      onChange={handleStep2InputChange}
                      className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2"
                    >
                      <option value="paid">{t('products.form.step2.paid')}</option>
                      <option value="credit">{t('products.form.step2.credit')}</option>
                    </select>
                  </div>
                </>
              )}
              
              {/* These price fields are ALWAYS visible */}
              <Input
                label={t('products.form.step2.stockCostPrice')}
                name="stockCostPrice"
                type="number"
                value={step2Data.stockCostPrice}
                onChange={handleStep2InputChange}
                helpText={t('products.form.step2.stockCostPriceHelp')}
                required
              />
              <Input
                label={t('products.form.step2.sellingPrice')}
                name="sellingPrice"
                type="number"
                value={step2Data.sellingPrice}
                onChange={handleStep2InputChange}
                helpText={t('products.form.step2.sellingPriceHelp')}
                required
              />
              <Input
                label={t('products.form.step2.cataloguePrice')}
                name="cataloguePrice"
                type="number"
                value={step2Data.cataloguePrice}
                onChange={handleStep2InputChange}
                helpText={t('products.form.step2.cataloguePriceHelp')}
              />
              
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={prevStep}>
                  {t('products.actions.previousStep')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
      
      {/* Edit Product Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={t('products.actions.editProduct')}
        size="lg"
        footer={
          <ModalFooter 
            onCancel={() => setIsEditModalOpen(false)}
            onConfirm={handleEditProduct}
            confirmText={t('products.actions.editProduct')}
            isLoading={isSubmitting}
          />
        }
      >
        {/* Tab navigation */}
        <div className="flex border-b mb-4">
                      <button
            className={`px-4 py-2 ${editTab === 'info' ? 'font-bold border-b-2 border-emerald-500' : 'text-gray-500'}`}
            onClick={() => setEditTab('info')}
                        type="button"
          >
            {t('products.editTabs.info')}
          </button>
          <button
            className={`px-4 py-2 ${editTab === 'stock' ? 'font-bold border-b-2 border-emerald-500' : 'text-gray-500'}`}
            onClick={() => setEditTab('stock')}
            type="button"
          >
            {t('products.editTabs.stock')}
          </button>
          <button
            className={`px-4 py-2 ${editTab === 'pricing' ? 'font-bold border-b-2 border-emerald-500' : 'text-gray-500'}`}
            onClick={() => setEditTab('pricing')}
            type="button"
          >
            {t('products.editTabs.pricing')}
                      </button>
                    </div>
        {/* Tab content */}
        {editTab === 'info' && (
          <div className="space-y-6">
            {/* Info Box */}
            <div className="flex items-start bg-blue-50 border-l-4 border-blue-400 p-4 rounded-md mb-4">
              <svg className="w-5 h-5 text-blue-400 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" /></svg>
              <div className="text-sm text-blue-800">
                {t('products.editTabs.infoBox', 'The product name and reference help you identify this item in your catalog. Categories help you organize products for easier filtering and reporting.')}
                </div>
              </div>
            {/* Product Name */}
          <Input
              label={t('products.form.name')}
              name="name"
              value={step1Data.name}
              onChange={handleStep1InputChange}
            required
          />
            {/* Reference */}
            <Input
              label={t('products.form.reference')}
              name="reference"
              value={step1Data.reference}
              onChange={handleStep1InputChange}
              helpText={t('products.form.referenceHelp', 'Auto-generated from name, but you can edit it.')}
            />
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('products.form.category')}</label>
              <CategorySelector
                value={step1Data.category}
                onChange={(category) => setStep1Data(prev => ({ ...prev, category }))}
                showImages={true}
                placeholder={t('products.form.categoryPlaceholder')}
              />
            </div>

            {/* Product Tags Manager */}
            <ProductTagsManager
              tags={step1Data.tags}
              onTagsChange={(tags) => setStep1Data(prev => ({ ...prev, tags }))}
              images={step1Data.images.map(img => img instanceof File ? URL.createObjectURL(img) : img)}
            />

            {/* Product Visibility Toggle */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    {step1Data.isVisible ? (
                      <Eye className="h-5 w-5 text-green-600" />
                    ) : (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    )}
                    <span className="text-sm font-medium text-gray-900">
                      {t('products.form.step1.visibility')}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {step1Data.isVisible 
                      ? t('products.form.step1.visibleInCatalogue') 
                      : t('products.form.step1.hiddenFromCatalogue')
                    }
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setStep1Data(prev => ({ ...prev, isVisible: !prev.isVisible }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                    step1Data.isVisible ? 'bg-emerald-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      step1Data.isVisible ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Product Images */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('products.form.step1.images')}
              </label>
              <div className="space-y-4">
                {/* Current Images Display */}
                {step1Data.images.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {step1Data.images.map((image, idx) => {
                      // Handle both File objects and existing URLs
                      let imageSrc: string;
                      if (image instanceof File) {
                        imageSrc = URL.createObjectURL(image);
                      } else if (typeof image === 'string') {
                        imageSrc = image;
                      } else {
                        console.warn('Invalid image object:', image);
                        imageSrc = '/placeholder.png';
                      }
                      
                      return (
                        <div key={idx} className="relative group">
                          <div className="aspect-square rounded-lg overflow-hidden border border-gray-200">
                            <ImageWithSkeleton
                              src={imageSrc}
                              alt={`Product image ${idx + 1}`}
                              className="w-full h-full object-cover"
                              placeholder="Loading image..."
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                            title={t('products.actions.removeImage')}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Image Button */}
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-2 text-gray-400" />
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">{t('products.actions.clickToUpload')}</span> {t('products.actions.orDragAndDrop')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t('products.form.step1.imageFormats')}
                      </p>
                    </div>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImagesUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Image Upload Progress */}
                {isUploadingImages && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500"></div>
                    <span>{t('products.actions.uploadingImages')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Product Tags Manager */}
            <ProductTagsManager
              tags={step1Data.tags}
              onTagsChange={(tags) => setStep1Data(prev => ({ ...prev, tags }))}
              images={step1Data.images.map(img => img instanceof File ? URL.createObjectURL(img) : img)}
            />

            {/* Visibility Toggle */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    {step1Data.isVisible ? (
                      <Eye className="h-5 w-5 text-green-600" />
                    ) : (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    )}
                    <span className="text-sm font-medium text-gray-900">
                      {t('products.form.step1.visibility')}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {step1Data.isVisible 
                      ? t('products.form.step1.visibleInCatalogue') 
                      : t('products.form.step1.hiddenFromCatalogue')
                    }
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setStep1Data(prev => ({ ...prev, isVisible: !prev.isVisible }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                    step1Data.isVisible ? 'bg-emerald-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      step1Data.isVisible ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}
        {editTab === 'stock' && (
          <div className="space-y-6">
            {/* Current Stock Display */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Current Stock Level</h3>
                  <p className="text-sm text-gray-600">Total available units for this product</p>
              </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600">{currentProduct?.stock ?? 0}</div>
                  <div className="text-sm text-gray-500">units</div>
            </div>
              </div>
            </div>
            {/* Stock Management Scenario Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock Management Scenario</label>
            <select 
              className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2" 
              value={stockReason} 
                onChange={e => setStockReason(e.target.value as 'restock' | 'adjustment' | 'damage')}
            >
                <option value="restock">📦 Restock - Add New Stock Batch</option>
                <option value="adjustment">✏️ Manual Adjustment - Edit Existing Batch</option>
                <option value="damage">💥 Damage - Record Physical Losses</option>
            </select>
            </div>

            {/* Scenario Explanations */}
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-md">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-blue-400 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
                </svg>
                <div className="text-sm text-blue-800">
                  {stockReason === 'restock' && (
                    <div>
                      <strong>📦 Restock Scenario:</strong> Create a new stock batch by adding fresh inventory. 
                      Specify the quantity, cost price, and purchase method (own purchase or from supplier). 
                      If purchased from a supplier on credit, this will create a supplier debt automatically.
                    </div>
                  )}
                  {stockReason === 'adjustment' && (
                    <div>
                      <strong>✏️ Manual Adjustment Scenario:</strong> Edit an existing stock batch comprehensively. 
                      You can modify stock quantity, cost price, and even the purchase details (supplier, payment method). 
                      This will automatically adjust any related supplier debts to maintain data coherence.
                    </div>
                  )}
                  {stockReason === 'damage' && (
                    <div>
                      <strong>💥 Damage Scenario:</strong> Record physically damaged or lost inventory. 
                      Only the stock quantity is reduced - cost prices and supplier debts remain unchanged 
                      since the financial obligations still exist despite physical losses.
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Stock Value Input */}
            {stockReason === 'restock' ? (
              <>
                <Input
                  label={t('products.actions.quantityToAdd', 'Quantity to Add')}
                  name="stockAdjustment"
                  type="number"
                  min={1}
                  value={stockAdjustment}
                  onChange={e => setStockAdjustment(e.target.value.replace(/[^0-9]/g, ''))}
                  required
                  helpText={t('products.form.restockHelp', 'This value will be added to your current stock.')}
                />
                {/* Live Preview */}
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <h4 className="text-sm font-medium text-green-800 mb-2">📦 Restock Preview</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-green-700">Current Total Stock:</span>
                      <div className="text-lg font-bold text-green-900">{currentProduct?.stock ?? 0}</div>
                    </div>
                    <div>
                      <span className="font-medium text-green-700">Adding:</span>
                      <div className="text-lg font-bold text-blue-600">+{parseInt(stockAdjustment) || 0}</div>
                    </div>
                    <div>
                      <span className="font-medium text-green-700">New Total Stock:</span>
                      <div className="text-lg font-bold text-green-600">
                        {(currentProduct?.stock ?? 0) + (parseInt(stockAdjustment) || 0)}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Supplier Section (only for restock) */}
                <div className="space-y-4">
            <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('products.form.step2.supplyType')}</label>
              <select
                name="supplyType"
                value={stockAdjustmentSupplier.supplyType}
                onChange={handleStockAdjustmentSupplierChange}
                className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2"
              >
                <option value="ownPurchase">{t('products.form.step2.ownPurchase')}</option>
                <option value="fromSupplier">{t('products.form.step2.fromSupplier')}</option>
              </select>
            </div>
            {/* Supplier and Payment Type (only for restock) */}
            {stockAdjustmentSupplier.supplyType === 'fromSupplier' && (
              <>
                <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('products.form.step2.supplier')}</label>
                  <div className="flex space-x-2">
                    <select
                      name="supplierId"
                      value={stockAdjustmentSupplier.supplierId}
                      onChange={handleStockAdjustmentSupplierChange}
                      className="flex-1 rounded-md border border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2"
                    >
                      <option value="">{t('common.select')}</option>
                      {suppliers.filter(s => !s.isDeleted).map(supplier => (
                              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsQuickAddSupplierOpen(true)}
                    >
                      {t('products.actions.addSupplier')}
                    </Button>
                  </div>
                </div>
                <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('products.form.step2.paymentType')}</label>
                  <select
                    name="paymentType"
                    value={stockAdjustmentSupplier.paymentType}
                    onChange={handleStockAdjustmentSupplierChange}
                    className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2"
                  >
                    <option value="paid">{t('products.form.step2.paid')}</option>
                    <option value="credit">{t('products.form.step2.credit')}</option>
                  </select>
                </div>
              </>
            )}
                </div>
              </>
            ) : (
              <>
                {/* Enhanced Manual Adjustment with Batch Selection */}
                
                {/* Temporary Edits History */}
                {tempBatchEdits.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium text-gray-900">Pending Batch Adjustments</h4>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearAllTempBatchEdits}
                        className="text-red-600 border-red-600 hover:bg-red-50"
                      >
                        Clear All
                      </Button>
                    </div>
                    
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="space-y-3">
                        {tempBatchEdits.map((edit) => (
                          <div key={edit.batchId} className="bg-white p-3 rounded border">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                  <h5 className="font-medium text-gray-900">
                                    Batch {edit.batchId.slice(-8)}
                                  </h5>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removeTempBatchEdit(edit.batchId)}
                                    className="text-red-600 border-red-600 hover:bg-red-50"
                                  >
                                    Remove
                                  </Button>
                                </div>
                                <div className="space-y-2 text-sm">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <span className="font-medium text-gray-600">Current Stock:</span>
                                      <span className="ml-2 text-gray-900">{edit.batch.remainingQuantity}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-600">New Stock:</span>
                                      <span className="ml-2 text-gray-900">{edit.newStock}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-600">Total Quantity Change:</span>
                                      <span className={`ml-2 ${edit.quantityChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {edit.quantityChange > 0 ? '+' : ''}{edit.quantityChange}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-600">New Remaining:</span>
                                      <span className="ml-2 text-blue-600">
                                        {edit.newStock} units
                                      </span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-600">Cost Price:</span>
                                      <span className="ml-2 text-gray-900">
                                        {edit.newCostPrice.toLocaleString()} XAF
                                        {edit.scenario === 'damage' && (
                                          <span className="text-xs text-gray-500"> (Unchanged)</span>
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {/* Purchase Method Info */}
                                  <div className="pt-2 border-t border-gray-200">
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <span className="font-medium text-gray-600">Type:</span>
                                        <span className="ml-2 text-gray-900">
                                          {edit.newSupplyType === 'ownPurchase' ? 'Own Purchase' : 'From Supplier'}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-600">Payment:</span>
                                        <span className="ml-2 text-gray-900">
                                          {edit.newPaymentType === 'credit' ? 'Credit' : 'Paid'}
                                        </span>
                                      </div>
                                    </div>
                                    {edit.newSupplierId && (
                                      <div className="mt-1">
                                        <span className="font-medium text-gray-600">Supplier:</span>
                                        <span className="ml-2 text-gray-900">
                                          {suppliers.find(s => s.id === edit.newSupplierId)?.name || 'Unknown'}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Scenario Badge */}
                                  <div className="pt-2">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      edit.scenario === 'damage' 
                                        ? 'bg-red-100 text-red-800' 
                                        : 'bg-blue-100 text-blue-800'
                                    }`}>
                                      {edit.scenario === 'damage' ? '💥 Damage' : '✏️ Manual Adjustment'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Batch Selection */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">
                    {tempBatchEdits.length > 0 ? 'Add Another Batch' : 'Select Stock Batch to Adjust'}
                  </h4>
                  
                  {loadingBatches ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-sm text-gray-600">Loading available batches...</p>
                    </div>
                  ) : availableBatches.length === 0 ? (
                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        {tempBatchEdits.length > 0 
                          ? 'All available batches have been added to the adjustment list.'
                          : 'No active batches found for this product. Please create a batch first.'
                        }
                      </p>
                    </div>
                  ) : (
                    <select
                      value={selectedBatchId}
                      onChange={(e) => handleBatchSelection(e.target.value)}
                      className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2"
                    >
                      <option value="">Select a batch to adjust</option>
                      {availableBatches.map(batch => (
                        <option key={batch.id} value={batch.id}>
                          Batch {batch.id.slice(-8)} - {batch.remainingQuantity} units @ {batch.costPrice.toLocaleString()} XAF
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Batch Edit Form */}
                {selectedBatch && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">Selected Batch Information</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-blue-700">Batch ID:</span>
                          <p className="text-blue-900 font-mono">{selectedBatch.id}</p>
                        </div>
                        <div>
                          <span className="font-medium text-blue-700">Total Quantity:</span>
                          <p className="text-blue-900">{selectedBatch.quantity} (original)</p>
                        </div>
                        <div>
                          <span className="font-medium text-blue-700">Remaining:</span>
                          <p className="text-blue-900">{selectedBatch.remainingQuantity} units</p>
                        </div>
                        <div>
                          <span className="font-medium text-blue-700">Used:</span>
                          <p className="text-blue-900">{selectedBatch.quantity - selectedBatch.remainingQuantity} units</p>
                        </div>
                        <div>
                          <span className="font-medium text-blue-700">Damaged:</span>
                          <p className="text-blue-900">{(selectedBatch.damagedQuantity || 0)} units</p>
                        </div>
                        <div>
                          <span className="font-medium text-blue-700">Current Cost Price:</span>
                          <p className="text-blue-900">{selectedBatch.costPrice.toLocaleString()} XAF</p>
                        </div>
                        <div>
                          <span className="font-medium text-blue-700">Status:</span>
                          <p className="text-blue-900 capitalize">{selectedBatch.status}</p>
                        </div>
                      </div>
                    </div>

                    {stockReason === 'adjustment' ? (
                      <div className="space-y-4">
                        {/* Stock and Cost Price */}
                        <div className="grid grid-cols-2 gap-4">
                          <Input
                            label="Total Batch Quantity"
                            type="number"
                            min={selectedBatch ? (selectedBatch.quantity - selectedBatch.remainingQuantity).toString() : "0"}
                            value={batchEditForm.stock}
                            onChange={(e) => handleBatchEditFormChange('stock', e.target.value)}
                            placeholder="Enter total batch quantity"
                            helpText={selectedBatch ? `Minimum: ${selectedBatch.quantity - selectedBatch.remainingQuantity} (${selectedBatch.quantity - selectedBatch.remainingQuantity} already used)` : undefined}
                            required
                          />
                          <Input
                            label="New Cost Price"
                            type="number"
                            min="0"
                            value={batchEditForm.costPrice}
                            onChange={(e) => handleBatchEditFormChange('costPrice', e.target.value.replace(/[^0-9]/g, ''))}
                            placeholder="Enter new cost price"
                            required
                          />
                        </div>

                        {/* Purchase Method Section - Read Only for Manual Adjustment */}
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h4 className="font-medium text-gray-800 mb-3">📝 Purchase Method (Preserved from Original Batch)</h4>
                          
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Type</label>
                              <div className="block w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700">
                                {batchEditForm.supplyType === 'ownPurchase' ? 'Own Purchase' : 'From Supplier'}
                              </div>
                            </div>

                            {batchEditForm.supplyType === 'fromSupplier' && (
                              <>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                                  <div className="block w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700">
                                    {suppliers.find(s => s.id === batchEditForm.supplierId)?.name || 'Unknown Supplier'}
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Type</label>
                                  <div className="block w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700">
                                    {batchEditForm.paymentType === 'credit' ? 'Credit' : 'Paid'}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-3">
                            ℹ️ For manual adjustments, the original purchase method and supplier information are preserved to maintain data integrity.
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Damage Scenario: Only quantity adjustment */
                      <div className="space-y-4">
                        <div className="bg-red-50 p-4 rounded-lg">
                          <h4 className="font-medium text-red-800 mb-3">💥 Damage Recording</h4>
                          <p className="text-sm text-red-700 mb-4">
                            Record the quantity of damaged/lost items. Cost price and supplier debt will remain unchanged.
                          </p>
                          
                          {/* Show batch supplier information for damage */}
                          {selectedBatch.supplierId && (
                            <div className="bg-white p-3 rounded border border-red-200 mb-4">
                              <h5 className="font-medium text-red-800 mb-2">Batch Supplier Information</h5>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="font-medium text-red-700">Supplier:</span>
                                  <span className="ml-2 text-red-900">
                                    {suppliers.find(s => s.id === selectedBatch.supplierId)?.name || 'Unknown'}
                                  </span>
                                </div>
                                <div>
                                  <span className="font-medium text-red-700">Payment Type:</span>
                                  <span className="ml-2 text-red-900">
                                    {selectedBatch.isCredit ? 'Credit' : 'Paid'}
                                  </span>
                                </div>
                              </div>
                              <p className="text-xs text-red-600 mt-2">
                                ℹ️ Supplier debt will remain unchanged as this is only a physical damage adjustment.
                              </p>
                            </div>
                          )}
                          <Input
                            label="Damaged Quantity"
                            type="number"
                            min="1"
                            max={selectedBatch.remainingQuantity.toString()}
                            value={damageForm.damagedQuantity}
                            onChange={(e) => handleDamageFormChange('damagedQuantity', e.target.value)}
                            placeholder="Enter damaged quantity"
                            required
                            helpText={`Maximum: ${selectedBatch.remainingQuantity} units available`}
                            error={
                              damageForm.damagedQuantity && 
                              (parseFloat(damageForm.damagedQuantity) > selectedBatch.remainingQuantity || parseFloat(damageForm.damagedQuantity) <= 0)
                                ? `Invalid quantity. Must be between 1 and ${selectedBatch.remainingQuantity}`
                                : undefined
                            }
                          />
                        </div>
                      </div>
                    )}

                    {/* Preview Changes */}
                    {((stockReason === 'adjustment' && batchEditForm.stock && batchEditForm.costPrice) || 
                      (stockReason === 'damage' && damageForm.damagedQuantity)) && (
                      <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="font-medium text-green-800 mb-2">Preview Changes</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {stockReason === 'adjustment' ? (
                            <>
                              <div>
                                <span className="font-medium text-green-700">Total Quantity Change:</span>
                                <span className={`ml-2 ${(parseFloat(batchEditForm.stock) - selectedBatch.quantity) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {(parseFloat(batchEditForm.stock) - selectedBatch.quantity) >= 0 ? '+' : ''}
                                  {parseFloat(batchEditForm.stock) - selectedBatch.quantity}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium text-green-700">New Remaining:</span>
                                <span className="ml-2 text-blue-600">
                                  {parseFloat(batchEditForm.stock) - (selectedBatch.quantity - selectedBatch.remainingQuantity)} units
                                </span>
                              </div>
                              <div>
                                <span className="font-medium text-green-700">Cost Price Change:</span>
                                <span className={`ml-2 ${(parseFloat(batchEditForm.costPrice) - selectedBatch.costPrice) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {(parseFloat(batchEditForm.costPrice) - selectedBatch.costPrice) >= 0 ? '+' : ''}
                                  {(parseFloat(batchEditForm.costPrice) - selectedBatch.costPrice).toLocaleString()} XAF
                                </span>
                              </div>
                              <div>
                                <span className="font-medium text-green-700">Purchase Type:</span>
                                <span className="ml-2 text-green-900">
                                  {batchEditForm.supplyType === 'ownPurchase' ? 'Own Purchase' : 'From Supplier'}
                                </span>
                              </div>
                              {batchEditForm.supplyType === 'fromSupplier' && (
                                <>
                                  <div>
                                    <span className="font-medium text-green-700">Supplier:</span>
                                    <span className="ml-2 text-green-900">
                                      {suppliers.find(s => s.id === batchEditForm.supplierId)?.name || 'Unknown'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-green-700">Payment Type:</span>
                                    <span className="ml-2 text-green-900">
                                      {batchEditForm.paymentType === 'credit' ? 'Credit' : 'Paid'}
                                    </span>
                                  </div>
                                </>
                              )}
                                <div>
                                  <span className="font-medium text-green-700">Payment:</span>
                                  <span className="ml-2 text-green-900">
                                    {batchEditForm.paymentType === 'credit' ? 'Credit (Debt Impact)' : 'Paid'}
                                  </span>
                                </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <span className="font-medium text-green-700">Damaged Quantity:</span>
                                <span className="ml-2 text-red-600">-{damageForm.damagedQuantity}</span>
                              </div>
                              <div>
                                <span className="font-medium text-green-700">New Stock:</span>
                                <span className="ml-2 text-green-900">
                                  {selectedBatch.remainingQuantity - parseFloat(damageForm.damagedQuantity)}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium text-green-700">Total Damaged:</span>
                                <span className="ml-2 text-red-600">
                                  {(selectedBatch.damagedQuantity || 0) + parseFloat(damageForm.damagedQuantity)} units
                                </span>
                              </div>
                              <div className="col-span-2">
                                <span className="font-medium text-green-700">Cost Price:</span>
                                <span className="ml-2 text-green-900">
                                  {selectedBatch.costPrice.toLocaleString()} XAF (Unchanged)
                                </span>
                              </div>
                              {selectedBatch.supplierId && (
                                <>
                                  <div>
                                    <span className="font-medium text-green-700">Supplier:</span>
                                    <span className="ml-2 text-green-900">
                                      {suppliers.find(s => s.id === selectedBatch.supplierId)?.name || 'Unknown'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-green-700">Payment Type:</span>
                                    <span className="ml-2 text-green-900">
                                      {selectedBatch.isCredit ? 'Credit' : 'Paid'} (Debt Unchanged)
                                    </span>
                                  </div>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    <Button
                      type="button"
                      onClick={addTempBatchEdit}
                      className="w-full"
                      disabled={
                        stockReason === 'adjustment' 
                          ? (batchEditForm.stock === '' || batchEditForm.costPrice === '' || 
                             (selectedBatch && batchEditForm.stock !== '' && 
                              parseFloat(batchEditForm.stock) < (selectedBatch.quantity - selectedBatch.remainingQuantity)))
                          : (damageForm.damagedQuantity === '' || 
                             (selectedBatch && parseFloat(damageForm.damagedQuantity) > selectedBatch.remainingQuantity) ||
                             parseFloat(damageForm.damagedQuantity) <= 0)
                      }
                    >
                      {stockReason === 'damage' ? '💥 Record Damage & Add to List' : '✏️ Validate & Add to List'}
                    </Button>
                  </div>
                )}

                {/* Fallback: Simple Stock Adjustment for old flow */}
                {availableBatches.length === 0 && tempBatchEdits.length === 0 && !loadingBatches && (
                  <div className="space-y-4">
                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        No batches available. Using simple stock adjustment.
                      </p>
                    </div>
            <Input
                  label={t('products.actions.newTotalStock', 'New Stock Value')}
                  name="stockAdjustment"
              type="number"
                  min={0}
                  value={stockAdjustment}
                  onChange={e => setStockAdjustment(e.target.value.replace(/[^0-9]/g, ''))}
              required
                  helpText={t('products.form.adjustmentHelp', 'Set the actual stock you have after counting. This will replace the current stock value.')}
                />
                <div className="text-sm text-gray-700 bg-gray-50 rounded-md p-2">
                  {`Current Stock: ${currentProduct?.stock ?? 0} → New Stock: ${parseInt(stockAdjustment) || 0} (${(parseInt(stockAdjustment) || 0) - (currentProduct?.stock ?? 0) >= 0 ? '+' : ''}${(parseInt(stockAdjustment) || 0) - (currentProduct?.stock ?? 0)})`}
          </div>
                  </div>
                )}
              </>
            )}
            
            {/* Cost Price Field - Only for Restock Scenario */}
            {stockReason === 'restock' && (
             <div className="space-y-2">
               <Input
                 label={t('products.form.step2.stockCostPrice')}
                 name="costPrice"
                 type="number"
                 min={0}
                 value={stockAdjustmentSupplier.costPrice}
                  onChange={e => setStockAdjustmentSupplier(prev => ({ ...prev, costPrice: e.target.value.replace(/[^0-9]/g, '') }))}
                 required
                 helpText={t('products.form.step2.stockCostPriceHelp')}
               />
                      </div>
                    )}
             
             {/* Mini Stock History Table (last 2 changes) */}
             <div className="mt-6">
               <h4 className="font-semibold mb-2">{t('products.actions.stockHistory')}</h4>
               {(() => {
                 const history = stockChanges.filter(sc => sc.productId === currentProduct?.id).slice(-2).reverse();
                 if (history.length === 0) {
                   return <span className="text-sm text-gray-500">{t('products.messages.noStockHistory')}</span>;
                 }
                 return (
                   <table className="min-w-full text-sm border rounded-md overflow-hidden">
                     <thead className="bg-gray-50">
                       <tr>
                         <th className="text-left px-2 py-1">{t('products.actions.date')}</th>
                         <th className="text-left px-2 py-1">{t('products.actions.change')}</th>
                         <th className="text-left px-2 py-1">{t('products.actions.reason')}</th>
                         <th className="text-left px-2 py-1">{t('products.form.step2.supplier')}</th>
                         <th className="text-left px-2 py-1">{t('products.form.step2.paymentType')}</th>
                         <th className="text-left px-2 py-1">{t('products.form.step2.stockCostPrice')}</th>
                       </tr>
                     </thead>
                     <tbody>
                       {history.map(sc => {
                         const supplier = sc.supplierId ? suppliers.find(s => s.id === sc.supplierId) : null;
                         return (
                           <tr key={sc.id} className="border-b last:border-b-0">
                             <td className="px-2 py-1">{sc.createdAt?.seconds ? new Date(sc.createdAt.seconds * 1000).toLocaleString() : ''}</td>
                             <td className="px-2 py-1">{sc.change > 0 ? '+' : ''}{sc.change}</td>
                             <td className="px-2 py-1">{t('products.actions.' + sc.reason)}</td>
                             <td className="px-2 py-1">
                               {sc.isOwnPurchase ? (
                                 <span className="text-gray-500">{t('products.form.step2.ownPurchase')}</span>
                               ) : supplier ? (
                                 <span className={supplier.isDeleted ? 'text-red-500 line-through' : ''}>
                                   {supplier.name}
                                   {supplier.isDeleted && ' (Deleted)'}
                                 </span>
                               ) : (
                                 <span className="text-gray-400">Unknown</span>
                               )}
                             </td>
                             <td className="px-2 py-1">
                               {sc.isOwnPurchase ? (
                                 <span className="text-gray-500">-</span>
                               ) : sc.isCredit ? (
                                 <span className="text-red-600">{t('products.form.step2.credit')}</span>
                               ) : (
                                 <span className="text-green-600">{t('products.form.step2.paid')}</span>
                               )}
                             </td>
                             <td className="px-2 py-1">
                               {sc.costPrice ? `${sc.costPrice.toLocaleString()} XAF` : '-'}
                             </td>
                           </tr>
                         );
                       })}
                     </tbody>
                   </table>
                 );
               })()}
               <div className="mt-2 text-right">
                 <span className="text-xs text-emerald-600 cursor-pointer underline">{t('products.actions.viewAllHistory', 'View All History')}</span>
               </div>
             </div>
           </div>
        )}
        {editTab === 'pricing' && (
          <div className="space-y-6">
            {/* Info Box */}
            <div className="flex items-start bg-blue-50 border-l-4 border-blue-400 p-4 rounded-md mb-4">
              <svg className="w-5 h-5 text-blue-400 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" /></svg>
              <div className="text-sm text-blue-800">
                {t('products.editTabs.pricingInfoBox', 'Set the price at which you sell this product. The catalogue price is optional and can be used for reference or promotions.')}
              </div>
            </div>
            {/* Selling Price */}
            <Input
              label={t('products.form.step2.sellingPrice')}
              name="sellingPrice"
              type="number"
              min={0}
              value={editPrices.sellingPrice}
              onChange={e => setEditPrices(p => ({ ...p, sellingPrice: e.target.value.replace(/[^0-9]/g, '') }))}
              required
              helpText={t('products.form.sellingPriceHelp', 'Required: The price at which you sell this product.')}
            />
            {/* Catalogue Price */}
            <Input
              label={t('products.form.step2.cataloguePrice')}
              name="cataloguePrice"
              type="number"
              min={0}
              value={editPrices.cataloguePrice}
              onChange={e => setEditPrices(p => ({ ...p, cataloguePrice: e.target.value.replace(/[^0-9]/g, '') }))}
              helpText={t('products.form.cataloguePriceHelp', 'Optional: Used for reference or promotions.')}
            />
            {/* Profit/Cost Info */}
            <div className="space-y-1">
              <div className="text-sm text-gray-700">
                {t('products.form.latestCostPrice', 'Latest Cost Price')}: {(getLatestCostPrice(currentProduct?.id || '', Array.isArray(stockChanges) ? stockChanges : []) ?? 0)} XAF
              </div>
              <div className="text-sm text-gray-700">
                {t('products.form.profitPerUnit', 'Profit per unit')}: {editPrices.sellingPrice && getLatestCostPrice(currentProduct?.id || '', Array.isArray(stockChanges) ? stockChanges : []) !== undefined ? (parseFloat(editPrices.sellingPrice) - (getLatestCostPrice(currentProduct?.id || '', Array.isArray(stockChanges) ? stockChanges : []) ?? 0)).toLocaleString() : '-'} XAF
              </div>
              {editPrices.sellingPrice && getLatestCostPrice(currentProduct?.id || '', Array.isArray(stockChanges) ? stockChanges : []) !== undefined && parseFloat(editPrices.sellingPrice) < (getLatestCostPrice(currentProduct?.id || '', Array.isArray(stockChanges) ? stockChanges : []) ?? 0) && (
                <div className="flex items-center bg-red-50 border-l-4 border-red-400 p-2 rounded-md mt-2">
                  <svg className="w-4 h-4 text-red-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="text-xs text-red-800">{t('products.form.sellingBelowCost', 'Warning: Selling price is below cost price!')}</span>
                </div>
              )}
            </div>
            {/* Images */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('products.form.image')}</label>
              <div className="flex items-center space-x-2 pb-2">
                <label className="w-20 h-20 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-md cursor-pointer bg-gray-50 hover:bg-gray-100 transition-all duration-200 relative flex-shrink-0">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleImagesUpload}
                    disabled={isUploadingImages}
                  />
                  {isUploadingImages ? (
                    <span className="animate-spin text-emerald-500"><Upload size={28} /></span>
                  ) : (
                    <Upload size={28} className="text-gray-400" />
                  )}
                </label>
                <div className="flex overflow-x-auto custom-scrollbar space-x-2 py-1">
                  {(step1Data.images ?? []).map((img, idx) => {
                    // Handle both File objects and existing URLs
                    let imageSrc: string;
                    if (img instanceof File) {
                      imageSrc = URL.createObjectURL(img);
                    } else if (typeof img === 'string') {
                      imageSrc = img;
                    } else {
                      console.warn('Invalid image object:', img);
                      imageSrc = '/placeholder.png';
                    }
                    
                    return (
                      <div key={idx} className="relative w-20 h-20 flex-shrink-0 rounded-md overflow-hidden group">
                        <ImageWithSkeleton
                          src={imageSrc}
                          alt={`Product ${idx + 1}`}
                          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                          placeholder="/placeholder.png"
                        />
                        <button
                          type="button"
                          className="absolute top-1 right-1 bg-white bg-opacity-80 rounded-full p-1 text-red-600 hover:text-red-800 shadow"
                          onClick={() => handleRemoveImage(idx)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="mt-1 text-sm text-gray-500">{t('products.form.imageHelp', 'Add clear images to help identify this product. You can upload multiple images.')}</p>
        </div>
          </div>
        )}
      </Modal>

      {/* Import CSV Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          resetImportState();
        }}
        title={t('products.import.title')}
        size="lg"
        footer={
          <ModalFooter 
            onCancel={() => {
              setIsImportModalOpen(false);
              resetImportState();
            }}
            onConfirm={handleImport}
            confirmText={t('products.actions.importCSV')}
            isLoading={isImporting}
          />
        }
      >
        <div className="space-y-6">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('products.import.upload')}
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-gray-300 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
            <p className="mt-1 text-sm text-gray-500">
              {t('products.import.uploadHelp')}
            </p>
          </div>

          {/* Column Mapping */}
          {csvHeaders.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">{t('products.import.mapping')}</h3>
              <div className="grid grid-cols-2 gap-4">
                {csvHeaders.map(header => (
                  <div key={header} className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {header}
                    </label>
                    <select
                      value={columnMapping[header]}
                      onChange={(e) => handleColumnMappingChange(header, e.target.value)}
                      className="block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    >
                      <option value="">{t('common.select')}</option>
                      <option value="name">{t('products.import.fields.name')}</option>
                      <option value="reference">{t('products.import.fields.reference')}</option>
                      <option value="costPrice">{t('products.import.fields.costPrice')}</option>
                      <option value="sellingPrice">{t('products.import.fields.sellingPrice')}</option>
                      <option value="cataloguePrice">{t('products.import.fields.cataloguePrice')}</option>
                      <option value="category">{t('products.import.fields.category')}</option>
                      <option value="stock">{t('products.import.fields.stock')}</option>
                      <option value="supplyType">Supply Type</option>
                      <option value="supplierId">Supplier ID</option>
                      <option value="paymentType">Payment Type</option>
                      <option value="supplierName">Supplier Name</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {csvData.length > 0 && (
            <div className="space-y-4">
              <div className="text-sm text-gray-700 font-medium mb-2">
                {t('products.import.productsToImport', { count: csvData.length })}
              </div>
              <div className="max-h-60 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {csvHeaders.map(header => (
                        <th
                          key={header}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {csvData.slice(0, 5).map((row, index) => (
                      <tr key={index}>
                        {csvHeaders.map(header => (
                          <td
                            key={header}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >
                            {row[header]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvData.length > 5 && (
                  <p className="text-sm text-gray-500 mt-2">
                    {t('products.import.previewHelp', { total: csvData.length })}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {isImporting && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>{t('products.import.progress')}</span>
                <span>{Math.round(importProgress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Save Categories Checkbox */}
          <div className="flex items-center space-x-2 mt-4">
            <input
              type="checkbox"
              id="saveCategoriesCheckbox"
              checked={saveCategories}
              onChange={e => setSaveCategories(e.target.checked)}
              className="form-checkbox h-4 w-4 text-emerald-600 border-gray-300 rounded"
            />
            <label htmlFor="saveCategoriesCheckbox" className="text-sm text-gray-700">
              {t('products.import.saveCategories')}
            </label>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setProductToDelete(null);
        }}
        title={t('products.actions.deleteProduct')}
        footer={
          <ModalFooter 
            onCancel={() => {
              setIsDeleteModalOpen(false);
              setProductToDelete(null);
            }}
            onConfirm={handleDeleteProduct}
            confirmText={t('products.actions.delete')}
            isLoading={isDeleting}
            isDanger
          />
        }
      >
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            {t('products.messages.deleteConfirmation', { 
              name: productToDelete?.name,
              reference: productToDelete?.reference 
            })}
          </p>
          <p className="text-sm text-red-600">
            {t('products.messages.deleteWarning')}
          </p>
        </div>
      </Modal>

      {/* Bulk Delete Confirmation Modal */}
      <Modal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        title={t('products.actions.deleteSelectedTitle')}
        footer={
          <ModalFooter
            onCancel={() => setIsBulkDeleteModalOpen(false)}
            onConfirm={handleBulkDelete}
            confirmText={t('products.actions.delete')}
            isLoading={isDeleting}
            isDanger
          />
        }
      >
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            {t('products.messages.bulkDeleteConfirmation', { count: selectedProducts.length })}
          </p>
          <ul className="text-sm text-gray-500 mb-2 max-h-32 overflow-y-auto">
            {filteredProducts.filter(p => selectedProducts.includes(p.id)).map(p => (
              <li key={p.id}>{p.name} ({p.reference})</li>
            ))}
          </ul>
          <p className="text-sm text-red-600">
            {t('products.messages.bulkDeleteWarning')}
          </p>
        </div>
      </Modal>

      {/* Quick Add Supplier Modal */}
      <Modal
        isOpen={isQuickAddSupplierOpen}
        onClose={() => setIsQuickAddSupplierOpen(false)}
        title={t('suppliers.actions.addSupplier')}
        footer={
          <ModalFooter 
            onCancel={() => setIsQuickAddSupplierOpen(false)}
            onConfirm={isEditModalOpen ? handleQuickAddSupplierForStock : handleQuickAddSupplier}
            confirmText={t('suppliers.actions.addSupplier')}
            isLoading={isAddingSupplier}
          />
        }
      >
        <div className="space-y-4">
          <Input
            label={t('suppliers.form.name')}
            name="name"
            value={quickSupplierData.name}
            onChange={handleQuickSupplierInputChange}
            required
          />
          
          <Input
            label={t('suppliers.form.contact')}
            name="contact"
            value={quickSupplierData.contact}
            onChange={handleQuickSupplierInputChange}
            required
          />
          
          <Input
            label={t('suppliers.form.location')}
            name="location"
            value={quickSupplierData.location}
            onChange={handleQuickSupplierInputChange}
          />
        </div>
      </Modal>

      {/* Product Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => { setIsDetailModalOpen(false); setDetailProduct(null); }}
        title={t('products.actions.viewDetails', 'Product Details')}
        size="xl"
      >
        <div className="mb-4 flex border-b">
          <button
            className={`px-4 py-2 ${detailTab === 'details' ? 'font-bold border-b-2 border-emerald-500' : 'text-gray-500'}`}
            onClick={() => setDetailTab('details')}
            type="button"
          >
            {t('products.detailTabs.details', 'Details')}
          </button>
          <button
            className={`px-4 py-2 ${detailTab === 'stock' ? 'font-bold border-b-2 border-emerald-500' : 'text-gray-500'}`}
            onClick={() => setDetailTab('stock')}
            type="button"
          >
            {t('products.detailTabs.stock', 'Stock History')}
          </button>
        </div>
        {detailTab === 'details' && (
          <div className="space-y-6">
            {/* Product Images */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('products.form.image', 'Images')}</h3>
              {detailProduct?.images && detailProduct.images.length > 0 ? (
                <div className="flex space-x-2 overflow-x-auto pb-2">
                  {detailProduct.images.map((img, idx) => (
                    <ImageWithSkeleton
                      key={idx}
                      src={img}
                      alt={`${detailProduct.name} - Image ${idx + 1}`}
                      className="w-24 h-24 object-cover rounded-lg border border-gray-200 flex-shrink-0"
                      placeholder="/placeholder.png"
                    />
                  ))}
                </div>
              ) : (
                <div className="w-24 h-24 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                  <span className="text-gray-400 text-sm">No image</span>
                </div>
              )}
            </div>

            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('products.detailTabs.basicInfo', 'Basic Information')}</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('products.form.name')}</label>
                    <p className="mt-1 text-sm text-gray-900">{detailProduct?.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('products.form.reference')}</label>
                    <p className="mt-1 text-sm text-gray-900">{detailProduct?.reference}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('products.form.category')}</label>
                    <p className="mt-1 text-sm text-gray-900">{detailProduct?.category}</p>
                  </div>
                </div>
              </div>

              {/* Pricing Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('products.detailTabs.pricing', 'Pricing')}</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('products.form.step2.sellingPrice')}</label>
                    <p className="mt-1 text-sm font-semibold text-emerald-600">{detailProduct?.sellingPrice?.toLocaleString()} XAF</p>
                  </div>
                  {detailProduct?.cataloguePrice && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('products.form.step2.cataloguePrice')}</label>
                      <p className="mt-1 text-sm text-gray-900">{detailProduct.cataloguePrice.toLocaleString()} XAF</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('products.form.latestCostPrice', 'Latest Cost Price')}</label>
                    <p className="mt-1 text-sm text-gray-900">{getLatestCostPrice(detailProduct?.id || '', Array.isArray(stockChanges) ? stockChanges : [])?.toLocaleString() || '0'} XAF</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stock Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('products.detailTabs.stock', 'Stock Information')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('products.table.columns.stock')}</label>
                  <div className="mt-1">
                    <Badge variant={detailProduct && detailProduct.stock > 10 ? 'success' : detailProduct && detailProduct.stock > 5 ? 'warning' : 'error'}>
                      {detailProduct?.stock || 0} units
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('products.detailTabs.profitPerUnit', 'Profit per Unit')}</label>
                  <p className="mt-1 text-sm font-semibold text-emerald-600">
                    {detailProduct && getLatestCostPrice(detailProduct.id, Array.isArray(stockChanges) ? stockChanges : []) !== undefined
? (detailProduct.sellingPrice - (getLatestCostPrice(detailProduct.id, Array.isArray(stockChanges) ? stockChanges : []) || 0)).toLocaleString()
                      : '-'
                    } XAF
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('products.detailTabs.totalValue', 'Total Stock Value')}</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {detailProduct && getLatestCostPrice(detailProduct.id, Array.isArray(stockChanges) ? stockChanges : []) !== undefined
? ((getLatestCostPrice(detailProduct.id, Array.isArray(stockChanges) ? stockChanges : []) || 0) * detailProduct.stock).toLocaleString()
                      : '0'
                    } XAF
                  </p>
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('products.detailTabs.additional', 'Additional Information')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('products.detailTabs.createdAt', 'Created')}</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {detailProduct?.createdAt?.seconds 
                      ? new Date(detailProduct.createdAt.seconds * 1000).toLocaleDateString()
                      : 'Unknown'
                    }
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('products.detailTabs.lastUpdated', 'Last Updated')}</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {detailProduct?.updatedAt?.seconds 
                      ? new Date(detailProduct.updatedAt.seconds * 1000).toLocaleDateString()
                      : 'Unknown'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        {detailTab === 'stock' && (
          <div className="space-y-4">
            {/* Filters and Search */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('products.stockHistory.filterByType', 'Filter by Type')}</label>
                <select
                  value={stockHistoryFilterType}
                  onChange={(e) => setStockHistoryFilterType(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2"
                >
                  <option value="">{t('common.all', 'All Types')}</option>
                  <option value="restock">{t('products.actions.restock')}</option>
                  <option value="sale">{t('products.actions.sale')}</option>
                  <option value="adjustment">{t('products.actions.adjustment')}</option>
                  <option value="creation">{t('products.actions.creation')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('products.stockHistory.filterBySupplier', 'Filter by Supplier')}</label>
                <select
                  value={stockHistoryFilterSupplier}
                  onChange={(e) => setStockHistoryFilterSupplier(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2"
                >
                  <option value="">{t('common.all', 'All Suppliers')}</option>
                  <option value="ownPurchase">{t('products.form.step2.ownPurchase')}</option>
                  {suppliers.filter(s => !s.isDeleted).map(supplier => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.search', 'Search')}</label>
                <input
                  type="text"
                  value={stockHistorySearch}
                  onChange={(e) => setStockHistorySearch(e.target.value)}
                  placeholder={t('products.stockHistory.searchPlaceholder', 'Search by reason, supplier...')}
                  className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('products.stockHistory.itemsPerPage', 'Items per Page')}</label>
                <select
                  value={stockHistoryPerPage}
                  onChange={(e) => setStockHistoryPerPage(Number(e.target.value))}
                  className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            {/* Stock History Table */}
            {(() => {
              // Filter stock changes for this product
              let filteredStockChanges = stockChanges.filter(sc => sc.productId === detailProduct?.id);
              
              // Apply type filter
              if (stockHistoryFilterType) {
                filteredStockChanges = filteredStockChanges.filter(sc => sc.reason === stockHistoryFilterType);
              }
              
              // Apply supplier filter
              if (stockHistoryFilterSupplier) {
                if (stockHistoryFilterSupplier === 'ownPurchase') {
                  filteredStockChanges = filteredStockChanges.filter(sc => sc.isOwnPurchase);
                } else {
                  filteredStockChanges = filteredStockChanges.filter(sc => sc.supplierId === stockHistoryFilterSupplier);
                }
              }
              
              // Apply search filter
              if (stockHistorySearch) {
                const searchLower = stockHistorySearch.toLowerCase();
                filteredStockChanges = filteredStockChanges.filter(sc => {
                  const supplier = sc.supplierId ? suppliers.find(s => s.id === sc.supplierId) : null;
                  return (
                    sc.reason.toLowerCase().includes(searchLower) ||
                    (supplier && supplier.name.toLowerCase().includes(searchLower))
                  );
                });
              }
              
              // Sort stock changes
              filteredStockChanges.sort((a, b) => {
                let aValue: number | string, bValue: number | string;
                
                switch (stockHistorySortBy) {
                  case 'date':
                    aValue = a.createdAt?.seconds || 0;
                    bValue = b.createdAt?.seconds || 0;
                    break;
                  case 'change':
                    aValue = a.change;
                    bValue = b.change;
                    break;
                  case 'reason':
                    aValue = a.reason;
                    bValue = b.reason;
                    break;
                  default:
                    aValue = a.createdAt?.seconds || 0;
                    bValue = b.createdAt?.seconds || 0;
                }
                
                if (stockHistorySortOrder === 'asc') {
                  return aValue > bValue ? 1 : -1;
                } else {
                  return aValue < bValue ? 1 : -1;
                }
              });
              
              // Pagination
              const totalPages = Math.ceil(filteredStockChanges.length / stockHistoryPerPage);
              const startIndex = (stockHistoryPage - 1) * stockHistoryPerPage;
              const paginatedStockChanges = filteredStockChanges.slice(startIndex, startIndex + stockHistoryPerPage);
              
              return (
                <div className="max-h-96 overflow-y-auto">
                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <th 
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => {
                              if (stockHistorySortBy === 'date') {
                                setStockHistorySortOrder(stockHistorySortOrder === 'asc' ? 'desc' : 'asc');
                              } else {
                                setStockHistorySortBy('date');
                                setStockHistorySortOrder('desc');
                              }
                            }}
                          >
                            {t('common.date', 'Date')}
                            {stockHistorySortBy === 'date' && (
                              <span className="ml-1">
                                {stockHistorySortOrder === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </th>
                          <th 
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => {
                              if (stockHistorySortBy === 'change') {
                                setStockHistorySortOrder(stockHistorySortOrder === 'asc' ? 'desc' : 'asc');
                              } else {
                                setStockHistorySortBy('change');
                                setStockHistorySortOrder('desc');
                              }
                            }}
                          >
                            {t('products.actions.change', 'Change')}
                            {stockHistorySortBy === 'change' && (
                              <span className="ml-1">
                                {stockHistorySortOrder === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </th>
                          <th 
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => {
                              if (stockHistorySortBy === 'reason') {
                                setStockHistorySortOrder(stockHistorySortOrder === 'asc' ? 'desc' : 'asc');
                              } else {
                                setStockHistorySortBy('reason');
                                setStockHistorySortOrder('desc');
                              }
                            }}
                          >
                            {t('products.actions.reason', 'Reason')}
                            {stockHistorySortBy === 'reason' && (
                              <span className="ml-1">
                                {stockHistorySortOrder === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('products.form.step2.supplier', 'Supplier')}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('products.form.step2.paymentType', 'Payment')}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('products.form.step2.stockCostPrice', 'Cost Price')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedStockChanges.map((stockChange) => {
                          const supplier = stockChange.supplierId ? suppliers.find(s => s.id === stockChange.supplierId) : null;
                          return (
                            <tr key={stockChange.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {stockChange.createdAt?.seconds 
                                  ? new Date(stockChange.createdAt.seconds * 1000).toLocaleString()
                                  : '-'
                                }
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                <span className={`font-medium ${stockChange.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {stockChange.change > 0 ? '+' : ''}{stockChange.change}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {stockChange.reason}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {stockChange.isOwnPurchase ? (
                                  <span className="text-gray-500">{t('products.form.step2.ownPurchase')}</span>
                                ) : supplier ? (
                                  <span className={supplier.isDeleted ? 'text-red-500 line-through' : ''}>
                                    {supplier.name}
                                    {supplier.isDeleted && ' (Deleted)'}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">Unknown</span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                {stockChange.isOwnPurchase ? (
                                  <span className="text-gray-500">-</span>
                                ) : stockChange.isCredit ? (
                                  <span className="text-red-600">{t('products.form.step2.credit')}</span>
                                ) : (
                                  <span className="text-green-600">{t('products.form.step2.paid')}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {stockChange.costPrice ? stockChange.costPrice.toLocaleString() : '-'} XAF
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 sticky bottom-0 bg-white border-t pt-2">
                      <div className="text-sm text-gray-700">
                        Showing {startIndex + 1} to {Math.min(startIndex + stockHistoryPerPage, filteredStockChanges.length)} of {filteredStockChanges.length} results
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setStockHistoryPage(Math.max(1, stockHistoryPage - 1))}
                          disabled={stockHistoryPage === 1}
                          className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          {t('common.previous', 'Previous')}
                        </button>
                        <span className="px-3 py-1 text-sm text-gray-700">
                          {stockHistoryPage} {t('common.of', 'of')} {totalPages}
                        </span>
                        <button
                          onClick={() => setStockHistoryPage(Math.min(totalPages, stockHistoryPage + 1))}
                          disabled={stockHistoryPage === totalPages}
                          className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          {t('common.next', 'Next')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* No results message */}
                  {filteredStockChanges.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      {t('products.stockHistory.noResults', 'No stock changes found matching your filters.')}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </Modal>
      {/* Mobile spacing for floating action button */}
      <div className="h-20 md:hidden"></div>
    </div>
  );
};

export default Products;