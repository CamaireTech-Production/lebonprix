import { useState, useEffect } from 'react';
import { Grid, List, Plus, Search, Edit2, Upload, Trash2, CheckSquare, Square, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal, { ModalFooter } from '../components/common/Modal';
import Input from '../components/common/Input';
import CreatableSelect from '../components/common/CreatableSelect';
import { useProducts, useStockChanges, useCategories, useSuppliers } from '../hooks/useFirestore';
import { createSupplierDebt, createSupplier } from '../services/firestore';
import { useAuth } from '../contexts/AuthContext';
import LoadingScreen from '../components/common/LoadingScreen';
import { showSuccessToast, showErrorToast, showWarningToast } from '../utils/toast';
import imageCompression from 'browser-image-compression';
import Papa from 'papaparse';
import type { Product } from '../types/models';
import type { ParseResult } from 'papaparse';
import { getLatestCostPrice } from '../utils/productUtils';

interface CsvRow {
  [key: string]: string;
}

const Products = () => {
  const { t, i18n } = useTranslation();
  const { products, loading, error, addProduct, updateProduct } = useProducts();
  const { stockChanges } = useStockChanges();
  useCategories();
  const { suppliers } = useSuppliers();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(t('products.filters.allCategories'));
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Two-step form state
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  
  // Step 1: Basic product info
  const [step1Data, setStep1Data] = useState({
    name: '',
    reference: '',
    category: '',
    images: [] as string[],
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
  const [stockReason, setStockReason] = useState<'restock' | 'adjustment'>('restock');
  
  // State for stock adjustment supplier info
  const [stockAdjustmentSupplier, setStockAdjustmentSupplier] = useState({
    supplyType: 'ownPurchase' as 'ownPurchase' | 'fromSupplier',
    supplierId: '',
    paymentType: 'paid' as 'credit' | 'paid',
    costPrice: '',
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
    setStep2Data(prev => ({ ...prev, [name]: value }));
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
  const categories = [t('products.filters.allCategories'), ...new Set(products?.map(p => p.category) || [])];

  const handleCategoryChange = (option: { label: string; value: string } | null) => {
    setStep1Data(prev => ({
      ...prev,
      category: option?.label ?? ''
    }));
  };
  
  const compressImage = async (file: File): Promise<string> => {
    try {
      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 600,
        useWebWorker: true,
        initialQuality: 0.7,
        alwaysKeepResolution: false
      };

      const compressedFile = await imageCompression(file, options);
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(compressedFile);
        reader.onload = () => {
          const base64 = reader.result as string;
          const base64Data = base64.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
      });
    } catch (error) {
      console.error('Error compressing image:', error);
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
      const samePrefixCount = products.filter(p => p.reference && p.reference.startsWith(prefix)).length;
      const nextNumber = (samePrefixCount + 1).toString().padStart(3, '0');
      reference = `${prefix}${nextNumber}`;
    }
      
      const stockQuantity = parseInt(step2Data.stock);
      const stockCostPrice = step2Data.stockCostPrice ? parseFloat(step2Data.stockCostPrice) : 0;
      
      // Create product data
    const productData = {
        name: step1Data.name,
      reference,
        sellingPrice: parseFloat(step2Data.sellingPrice),
        cataloguePrice: step2Data.cataloguePrice ? parseFloat(step2Data.cataloguePrice) : undefined,
        category: step1Data.category,
        stock: stockQuantity,
        images: (step1Data.images ?? []).length > 0 ? step1Data.images : [],
      isAvailable: true,
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
      
      // Create the product with supplier information
      await addProduct(productData, supplierInfo);
      
      // Create supplier debt if applicable (this will be handled by the createProduct function)
      if (step2Data.supplyType === 'fromSupplier' && step2Data.paymentType === 'credit') {
        const debtAmount = stockCostPrice * stockQuantity;
        const description = `Initial stock purchase for ${step1Data.name} (${stockQuantity} units)`;
        
        await createSupplierDebt(
          step2Data.supplierId,
          debtAmount,
          description,
          user.uid
        );
      }
      
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
      }, user.uid);

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
      }, user.uid);

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
      images: Array.isArray(product.images) ? product.images : (product.images ? [product.images] : []),
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
      images: (step1Data.images ?? []).length > 0 ? step1Data.images : [],
      isAvailable: safeProduct.isAvailable,
      userId: safeProduct.userId,
      updatedAt: { seconds: 0, nanoseconds: 0 },
      sellingPrice: editPrices.sellingPrice ? parseFloat(editPrices.sellingPrice) : safeProduct.sellingPrice,
      cataloguePrice: editPrices.cataloguePrice ? parseFloat(editPrices.cataloguePrice) : safeProduct.cataloguePrice
    };
    if (step1Data.reference && step1Data.reference.trim() !== '') {
      updateData.reference = step1Data.reference;
    }
    try {
      await updateProduct(currentProduct.id, updateData, user.uid);
      // Update latest stock change cost price if changed
      const latestStockChange = stockChanges
        .filter(sc => sc.productId === currentProduct.id)
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0];
      if (latestStockChange && editPrices.costPrice && parseFloat(editPrices.costPrice) !== latestStockChange.costPrice) {
        // Use updateProduct with stockReason 'adjustment' and stockChange 0 to update cost price only
        await updateProduct(currentProduct.id, {}, user.uid, 'adjustment', 0, {
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
      showErrorToast(t('products.messages.errors.updateProduct'));
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
    if (!products?.length || !stockChanges?.length || !user?.uid) return;
    products.forEach(async (product) => {
      const hasStockChange = stockChanges.some((sc) => sc.productId === product.id);
      if (product.stock > 0 && !hasStockChange) {
        // Create an initial adjustment with 'creation' reason
        try {
          await updateProduct(product.id, { stock: product.stock }, user.uid, 'creation', product.stock);
        } catch (e) { console.error(`Failed to create initial stock for ${product.id}:`, e) }
      }
    });
  }, [products, stockChanges, user, updateProduct]);

  useEffect(() => {
    setSelectedCategory(t('products.filters.allCategories'));
  }, [i18n.language, t]);

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
        const product = products.find(p => p.id === id);
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
    const newImages: string[] = [];
    for (const file of files) {
      try {
        const base64 = await compressImage(file);
        newImages.push(base64);
      } catch (err) {
        console.error('Error compressing image:', err);
        showErrorToast(t('products.messages.errors.addProduct'));
      }
    }
    setStep1Data(prev => ({ ...prev, images: [...prev.images, ...newImages] }));
    setIsUploadingImages(false);
  };
  
  const handleRemoveImage = (idx: number) => {
    setStep1Data(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));
  };

  // Place filteredProducts and resetImportState above their first usage
  const filteredProducts: Product[] = products?.filter((product: Product) => {
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

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    showErrorToast(t('products.messages.errors.loadProducts'));
    return null;
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
            }, user.uid);
          }
          finalSupplierId = supplier.id;
        } else if (finalSupplierId) {
          supplier = suppliers.find(s => s.id === finalSupplierId);
          if (!supplier) {
            supplier = await createSupplier({
              name: finalSupplierId,
              contact: 'Imported',
              userId: user.uid
            }, user.uid);
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
                    const mainImg = images.length > 0 ? (images[mainIdx]?.startsWith('data:image') ? images[mainIdx] : `data:image/jpeg;base64,${images[mainIdx]}`) : '/placeholder.png';
                    return (
                      <img
                        src={mainImg}
                        alt={product.name}
                        className="absolute h-full w-full object-cover transition-all duration-300"
                        key={mainImg}
                      />
                    );
                  })()}
                </div>
                <div
                  className="flex items-center gap-1 px-2 py-2 bg-white border-b border-gray-100 overflow-x-auto custom-scrollbar"
                >
                  {(product.images ?? []).map((img, idx) => (
                    <img
                      key={idx}
                      src={img.startsWith('data:image') ? img : `data:image/jpeg;base64,${img}`}
                      alt={`Preview ${idx + 1}`}
                      className={`w-10 h-10 object-cover rounded border cursor-pointer transition-transform duration-200 ${mainImageIndexes[product.id] === idx ? 'ring-2 ring-emerald-500 scale-105' : 'opacity-70 hover:opacity-100'}`}
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
                      <span className="font-medium">{getLatestCostPrice(product.id, stockChanges)} XAF</span>
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
                            const mainImg = images.length > 0 ? (images[mainIdx]?.startsWith('data:image') ? images[mainIdx] : `data:image/jpeg;base64,${images[mainIdx]}`) : '/placeholder.png';
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
                                <img className="h-10 w-10 rounded-md object-cover transition-all duration-300" src={mainImg} alt="" key={mainImg} />
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
                      <div className="text-sm text-gray-900">{getLatestCostPrice(product.id, stockChanges)} XAF</div>
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
      
      {/* Add Product Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={t('products.actions.addProduct')}
        footer={
          <ModalFooter 
            onCancel={() => setIsAddModalOpen(false)}
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
            label={t('products.form.name')}
            name="name"
                value={step1Data.name}
                onChange={handleStep1InputChange}
            required
          />
          
          <Input
            label={t('products.form.reference')}
            name="reference"
                value={step1Data.reference}
                onChange={handleStep1InputChange}
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('products.form.category')}
            </label>
            <CreatableSelect
                  value={step1Data.category ? { label: step1Data.category, value: step1Data.category } : null}
              onChange={handleCategoryChange}
              placeholder={t('products.form.categoryPlaceholder')}
              className="custom-select"
            />
          </div>
          
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
                    {(step1Data.images ?? []).map((img, idx) => (
                  <div key={idx} className="relative w-20 h-20 flex-shrink-0 rounded-md overflow-hidden group">
                    <img
                      src={img.startsWith('data:image') ? img : `data:image/jpeg;base64,${img}`}
                      alt={`Product ${idx + 1}`}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                    <button
                      type="button"
                      className="absolute top-1 right-1 bg-white bg-opacity-80 rounded-full p-1 text-red-600 hover:text-red-800 shadow"
                      onClick={() => handleRemoveImage(idx)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-1 text-sm text-gray-500">{t('products.form.imageHelp')}</p>
          </div>
            </div>
          ) : (
            /* Step 2: Initial Stock and Supply Information */
            <div className="space-y-4">
              <Input
                label={t('products.form.stock')}
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
              <CreatableSelect
                value={step1Data.category ? { label: step1Data.category, value: step1Data.category } : null}
                onChange={handleCategoryChange}
                placeholder={t('products.form.categoryPlaceholder')}
                className="custom-select"
              />
            </div>
          </div>
        )}
        {editTab === 'stock' && (
          <div className="space-y-6">
            {/* Info Box */}
            <div className="flex items-start bg-blue-50 border-l-4 border-blue-400 p-4 rounded-md mb-4">
              <svg className="w-5 h-5 text-blue-400 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" /></svg>
              <div className="text-sm text-blue-800">
                {t('products.editTabs.stockInfoBox', 'Use this section to add or adjust stock. Restock increases available units, while adjustment is for correcting errors or losses.')}
              </div>
            </div>
            {/* Stock Change Type Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('products.form.stockChangeType', 'Stock Change Type')}</label>
            <select 
              className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2" 
              value={stockReason} 
              onChange={e => setStockReason(e.target.value as 'restock' | 'adjustment')}
            >
              <option value="restock">{t('products.actions.restock')}</option>
              <option value="adjustment">{t('products.actions.adjustment')}</option>
            </select>
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
                <div className="text-sm text-gray-700 bg-gray-50 rounded-md p-2">
                  {`Current Stock: ${currentProduct?.stock ?? 0} → New Stock: ${(currentProduct?.stock ?? 0) + (parseInt(stockAdjustment) || 0)} (+${parseInt(stockAdjustment) || 0})`}
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
            <Input
              label={t('products.form.step2.stockCostPrice')}
              name="costPrice"
              type="number"
                        min={0}
                        value={stockAdjustmentSupplier.costPrice}
                        onChange={e => setStockAdjustmentSupplier(prev => ({ ...prev, costPrice: e.target.value.replace(/[^0-9.]/g, '') }))}
              required
                        helpText={t('products.form.step2.stockCostPriceHelp')}
                      />
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
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
                {/* Live Preview */}
                <div className="text-sm text-gray-700 bg-gray-50 rounded-md p-2">
                  {`Current Stock: ${currentProduct?.stock ?? 0} → New Stock: ${parseInt(stockAdjustment) || 0} (${(parseInt(stockAdjustment) || 0) - (currentProduct?.stock ?? 0) >= 0 ? '+' : ''}${(parseInt(stockAdjustment) || 0) - (currentProduct?.stock ?? 0)})`}
          </div>
              </>
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
              onChange={e => setEditPrices(p => ({ ...p, sellingPrice: e.target.value.replace(/[^0-9.]/g, '') }))}
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
              onChange={e => setEditPrices(p => ({ ...p, cataloguePrice: e.target.value.replace(/[^0-9.]/g, '') }))}
              helpText={t('products.form.cataloguePriceHelp', 'Optional: Used for reference or promotions.')}
            />
            {/* Profit/Cost Info */}
            <div className="space-y-1">
              <div className="text-sm text-gray-700">
                {t('products.form.latestCostPrice', 'Latest Cost Price')}: {(getLatestCostPrice(currentProduct?.id || '', stockChanges) ?? 0)} XAF
              </div>
              <div className="text-sm text-gray-700">
                {t('products.form.profitPerUnit', 'Profit per unit')}: {editPrices.sellingPrice && getLatestCostPrice(currentProduct?.id || '', stockChanges) !== undefined ? (parseFloat(editPrices.sellingPrice) - (getLatestCostPrice(currentProduct?.id || '', stockChanges) ?? 0)).toLocaleString() : '-'} XAF
              </div>
              {editPrices.sellingPrice && getLatestCostPrice(currentProduct?.id || '', stockChanges) !== undefined && parseFloat(editPrices.sellingPrice) < (getLatestCostPrice(currentProduct?.id || '', stockChanges) ?? 0) && (
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
                  {(step1Data.images ?? []).map((img, idx) => (
                    <div key={idx} className="relative w-20 h-20 flex-shrink-0 rounded-md overflow-hidden group">
                      <img
                        src={img.startsWith('data:image') ? img : `data:image/jpeg;base64,${img}`}
                        alt={`Product ${idx + 1}`}
                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                      <button
                        type="button"
                        className="absolute top-1 right-1 bg-white bg-opacity-80 rounded-full p-1 text-red-600 hover:text-red-800 shadow"
                        onClick={() => handleRemoveImage(idx)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
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
                    <img
                      key={idx}
                      src={img.startsWith('data:image') ? img : `data:image/jpeg;base64,${img}`}
                      alt={`${detailProduct.name} - Image ${idx + 1}`}
                      className="w-24 h-24 object-cover rounded-lg border border-gray-200 flex-shrink-0"
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
                    <p className="mt-1 text-sm text-gray-900">{getLatestCostPrice(detailProduct?.id || '', stockChanges)?.toLocaleString() || '0'} XAF</p>
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
                    {detailProduct && getLatestCostPrice(detailProduct.id, stockChanges) !== undefined
                      ? (detailProduct.sellingPrice - (getLatestCostPrice(detailProduct.id, stockChanges) || 0)).toLocaleString()
                      : '-'
                    } XAF
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('products.detailTabs.totalValue', 'Total Stock Value')}</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {detailProduct && getLatestCostPrice(detailProduct.id, stockChanges) !== undefined
                      ? ((getLatestCostPrice(detailProduct.id, stockChanges) || 0) * detailProduct.stock).toLocaleString()
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
                <div>
                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
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
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
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
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
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
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('products.form.step2.supplier', 'Supplier')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('products.form.step2.paymentType', 'Payment')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('products.form.step2.stockCostPrice', 'Cost Price')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedStockChanges.map((stockChange) => {
                          const supplier = stockChange.supplierId ? suppliers.find(s => s.id === stockChange.supplierId) : null;
                          return (
                            <tr key={stockChange.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {stockChange.createdAt?.seconds 
                                  ? new Date(stockChange.createdAt.seconds * 1000).toLocaleString()
                                  : '-'
                                }
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className={`font-medium ${stockChange.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {stockChange.change > 0 ? '+' : ''}{stockChange.change}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {stockChange.reason}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {stockChange.isOwnPurchase ? (
                                  <span className="text-gray-500">-</span>
                                ) : stockChange.isCredit ? (
                                  <span className="text-red-600">{t('products.form.step2.credit')}</span>
                                ) : (
                                  <span className="text-green-600">{t('products.form.step2.paid')}</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
                    <div className="flex items-center justify-between mt-4">
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
    </div>
  );
};

export default Products;