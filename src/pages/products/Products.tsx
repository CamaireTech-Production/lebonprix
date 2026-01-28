import { useState, useEffect } from 'react';
import { Grid, List, Plus, Search, Edit2, Upload, Trash2, CheckSquare, Square, Info, Eye, EyeOff, QrCode, ExternalLink, FileText, ChevronDown, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Card, Button, Badge, Modal, ModalFooter, Input, ImageWithSkeleton, SkeletonProductsGrid, SyncIndicator, PriceInput } from '@components/common';
import { useProducts, useStockChanges, useCategories, useSuppliers } from '@hooks/data/useFirestore';
import { useInfiniteProducts } from '@hooks/data/useInfiniteProducts';
import { useInfiniteScroll } from '@hooks/data/useInfiniteScroll';
import { useAllStockBatches } from '@hooks/business/useStockBatches';
import { createSupplier } from '@services/firestore/suppliers/supplierService';
import { recalculateCategoryProductCounts } from '@services/firestore/categories/categoryService';
import { correctBatchCostPrice } from '@services/firestore/stock/stockService';
import { useAuth } from '@contexts/AuthContext';
import { getCurrentEmployeeRef, formatCreatorName } from '@utils/business/employeeUtils';
import { getUserById } from '@services/utilities/userService';
import { FirebaseStorageService } from '@services/core/firebaseStorage';
import { showSuccessToast, showErrorToast, showWarningToast } from '@utils/core/toast';
import imageCompression from 'browser-image-compression';
import * as Papa from 'papaparse';
import type { Product, ProductTag, StockChange } from '../../types/models';
import type { ParseResult } from 'papaparse';
import { getLatestCostPrice } from '@utils/business/productUtils';
import { getProductBatchesForAdjustment } from '@services/firestore/stock/stockService';
import type { StockBatch } from '../../types/models';
import CostPriceCarousel from '../../components/products/CostPriceCarousel';
import ProductTagsManager from '../../components/products/ProductTagsManager';
import CategorySelector from '../../components/products/CategorySelector';
import BarcodeGenerator from '../../components/products/BarcodeGenerator';
import ProductsReportModal from '../../components/reports/ProductsReportModal';
import { PermissionButton, usePermissionCheck } from '@components/permissions';
import { RESOURCES } from '@constants/resources';

interface CsvRow {
  [key: string]: string;
}

const Products = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Check if we're in a company route
  const isCompanyRoute = location.pathname.startsWith('/company/');
  const companyId = isCompanyRoute ? location.pathname.split('/')[2] : null;
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
  const { categories: categoryList } = useCategories('product');
  const { suppliers } = useSuppliers();
  const { batches: allStockBatches, loading: batchesLoading } = useAllStockBatches();
  const { user, company, currentEmployee, isOwner } = useAuth();
  const { canEdit, canDelete } = usePermissionCheck(RESOURCES.PRODUCTS);


  // Refresh products list when other parts of the app (e.g., sales) update stock
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleProductsRefresh = (event: Event) => {
      const { detail } = event as CustomEvent<{ companyId?: string }>;
      if (!company?.id) return;
      if (detail?.companyId && detail.companyId !== company.id) return;
      refresh();
    };

    window.addEventListener('products:refresh', handleProductsRefresh as EventListener);
    return () => {
      window.removeEventListener('products:refresh', handleProductsRefresh as EventListener);
    };
  }, [company?.id, refresh]);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(t('products.filters.allCategories'));

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Local state to track visibility changes for immediate UI updates
  const [visibilityOverrides, setVisibilityOverrides] = useState<Record<string, boolean>>({});

  // Two-step form state
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Step 1: Basic product info
  // Images can be File objects (new uploads) or string URLs (existing images)
  const [step1Data, setStep1Data] = useState<{
    name: string;
    reference: string;
    category: string;
    images: (File | string)[];
    tags: ProductTag[];
    isVisible: boolean;
    barCode?: string;
  }>({
    name: '',
    reference: '',
    category: '',
    images: [],
    tags: [],
    isVisible: true, // Default to visible
    barCode: '', // Optional barcode field
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

  // Field-level error states
  const [step1Errors, setStep1Errors] = useState<Record<string, string>>({});
  const [step2Errors, setStep2Errors] = useState<Record<string, string>>({});

  // Clear errors when modals open
  useEffect(() => {
    if (isAddModalOpen) {
      setStep1Errors({});
      setStep2Errors({});
    }
  }, [isAddModalOpen]);

  useEffect(() => {
    if (isEditModalOpen) {
      setStep1Errors({});
      setStep2Errors({});
    }
  }, [isEditModalOpen]);

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

  // Barcode/QR Code modal state
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [selectedProductForBarcode, setSelectedProductForBarcode] = useState<Product | null>(null);
  // State for stock adjustment tab
  const [, setStockAdjustment] = useState('');
  const [stockReason, setStockReason] = useState<'restock' | 'adjustment' | 'damage'>('restock');

  // State for stock adjustment supplier info
  const [, setStockAdjustmentSupplier] = useState({
    supplyType: 'ownPurchase' as 'ownPurchase' | 'fromSupplier',
    supplierId: '',
    paymentType: 'paid' as 'credit' | 'paid',
    costPrice: '',
  });

  // Enhanced Stock Management State (All Scenarios)
  const [, setAvailableBatches] = useState<StockBatch[]>([]);
  const [, setSelectedBatchId] = useState('');
  const [, setSelectedBatch] = useState<StockBatch | null>(null);
  const [, setLoadingBatches] = useState(false);

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

  const [, setBatchEditForm] = useState({
    stock: '',
    costPrice: '',
    supplyType: 'ownPurchase' as 'ownPurchase' | 'fromSupplier',
    supplierId: '',
    paymentType: 'paid' as 'paid' | 'credit'
  });

  // Scenario 3: Damage State
  const [, setBatchDamageForm] = useState({
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

  // Check for productId in URL params and open product detail modal
  useEffect(() => {
    const productIdFromUrl = searchParams.get('productId');
    const actionFromUrl = searchParams.get('action');
    
    // Only process if we have a productId in URL and products are loaded
    if (productIdFromUrl && infiniteProducts.length > 0 && !isDetailModalOpen && !infiniteLoading) {
      const product = infiniteProducts.find(p => p.id === productIdFromUrl);
      if (product) {
        setDetailProduct(product);
        setIsDetailModalOpen(true);
        // Set tab based on action
        if (actionFromUrl === 'restock') {
          setDetailTab('stock');
        }
        // Clean up URL params after opening modal
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('productId');
        newSearchParams.delete('action');
        setSearchParams(newSearchParams, { replace: true });
      }
    }
  }, [searchParams, infiniteProducts, isDetailModalOpen, infiniteLoading, setSearchParams]);

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
    // Clear error when user starts typing
    if (step1Errors[name]) {
      setStep1Errors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleStep2InputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: string } }) => {
    const { name, value } = e.target;

    // PriceInput already handles formatting and returns numeric value
    // No need to filter price fields - PriceInput component handles that
    setStep2Data(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (step2Errors[name]) {
      setStep2Errors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
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
    setStep1Errors({});
    setStep2Errors({});
    setCurrentStep(1);
  };

  // Get unique categories from products (filter out empty/undefined categories)
  const categories = [t('products.filters.allCategories'), ...new Set(infiniteProducts?.filter(p => p.category).map(p => p.category!) || [])];


  const compressImage = async (file: File): Promise<File> => {
    try {
      console.log('Compressing image:', file.name, 'Type:', file.type, 'Size:', file.size);

      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 600,
        useWebWorker: true,
        initialQuality: 0.7,
        alwaysKeepResolution: false,
        fileType: 'image/jpeg' // Force JPEG output
      };

      const compressedFile = await imageCompression(file, options);
      console.log('Compressed file:', compressedFile.name, 'Type:', compressedFile.type, 'Size:', compressedFile.size);

      // Ensure we return a File object (imageCompression should return File, but ensure it)
      if (compressedFile instanceof File) {
        return compressedFile;
      } else {
        // If it's a Blob, convert to File
        const blobType = (compressedFile as Blob).type || 'image/jpeg';
        return new File([compressedFile], file.name, { type: blobType });
      }
    } catch (error) {
      console.error('Error compressing image:', error);
      throw error;
    }
  };

  const validateForm = (): boolean => {
    const step1Errs: Record<string, string> = {};
    const step2Errs: Record<string, string> = {};
    let isValid = true;

    // Validate Step 1
    if (!step1Data.name || step1Data.name.trim() === '') {
      step1Errs.name = t('products.form.step1.name') + ' ' + t('common.required');
      isValid = false;
    }

    // Validate Step 2
    if (!step2Data.stock || step2Data.stock.trim() === '') {
      step2Errs.stock = t('products.form.step2.stock') + ' ' + t('common.required');
      isValid = false;
    } else if (parseInt(step2Data.stock) < 0) {
      step2Errs.stock = t('products.form.step2.stock') + ' ' + (t('common.mustBeGreaterThanOrEqualToZero') || 'must be greater than or equal to zero');
      isValid = false;
    }

    if (!step2Data.stockCostPrice || step2Data.stockCostPrice.trim() === '') {
      step2Errs.stockCostPrice = t('products.form.step2.stockCostPrice') + ' ' + t('common.required');
      isValid = false;
    } else if (parseFloat(step2Data.stockCostPrice) < 0) {
      step2Errs.stockCostPrice = t('products.form.step2.stockCostPrice') + ' ' + (t('common.mustBeGreaterThanOrEqualToZero') || 'must be greater than or equal to zero');
      isValid = false;
    }

    if (!step2Data.sellingPrice || step2Data.sellingPrice.trim() === '') {
      step2Errs.sellingPrice = t('products.form.step2.sellingPrice') + ' ' + t('common.required');
      isValid = false;
    } else if (parseFloat(step2Data.sellingPrice) <= 0) {
      step2Errs.sellingPrice = t('products.form.step2.sellingPrice') + ' ' + (t('common.mustBeGreaterThanZero') || 'must be greater than zero');
      isValid = false;
    }

    if (step2Data.supplyType === 'fromSupplier' && (!step2Data.supplierId || step2Data.supplierId.trim() === '')) {
      step2Errs.supplierId = t('products.form.step2.supplier') + ' ' + t('common.required');
      isValid = false;
    }

    setStep1Errors(step1Errs);
    setStep2Errors(step2Errs);

    // If there are errors, show a general message and scroll to first error
    if (!isValid) {
      const firstErrorField = Object.keys(step1Errs)[0] || Object.keys(step2Errs)[0];
      if (firstErrorField) {
        // If error is in step 2, switch to step 2
        if (step2Errs[firstErrorField]) {
          setCurrentStep(2);
          setTimeout(() => {
            const element = document.querySelector(`[name="${firstErrorField}"]`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              (element as HTMLElement).focus();
            }
          }, 100);
        } else {
          // Error is in step 1
          setCurrentStep(1);
          setTimeout(() => {
            const element = document.querySelector(`[name="${firstErrorField}"]`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              (element as HTMLElement).focus();
            }
          }, 100);
        }
      }
      showWarningToast(t('products.messages.warnings.pleaseFillRequiredFields') || t('products.messages.warnings.requiredFields'));
    }

    return isValid;
  };

  const handleAddProduct = async () => {
    if (!user?.uid) return;

    // Validate form with specific field errors
    if (!validateForm()) {
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
      // Filter only File objects (new uploads), exclude existing URLs
      const imageFiles = step1Data.images.filter((img): img is File => img instanceof File);

      if (imageFiles.length > 0) {
        try {
          const storageService = new FirebaseStorageService();
          // Generate a temporary ID for the upload
          const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const uploadResults = await storageService.uploadProductImagesFromFiles(
            imageFiles,
            user.uid,
            tempId
          );

          imageUrls = uploadResults.map((result: { url: string; path: string }) => result.url);
          imagePaths = uploadResults.map((result: { url: string; path: string }) => result.path);
        } catch (error) {
          console.error('Error uploading images:', error);
          showErrorToast('Image upload failed');
          return;
        }
      }

      // Create product data after image upload
      const productData: any = {
        name: step1Data.name,
        reference,
        sellingPrice: parseFloat(step2Data.sellingPrice),
        cataloguePrice: step2Data.cataloguePrice ? parseFloat(step2Data.cataloguePrice) : 0,
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

      // Include barcode if provided (otherwise will be auto-generated)
      if (step1Data.barCode && step1Data.barCode.trim()) {
        productData.barCode = step1Data.barCode.trim();
      }

      // Only include category if it's not empty (Firestore doesn't accept undefined)
      if (step1Data.category && step1Data.category.trim()) {
        productData.category = step1Data.category.trim();
      }

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

      // Get createdBy employee reference
      let createdBy: ReturnType<typeof getCurrentEmployeeRef> | null = null;
      if (user && company) {
        let userData: Awaited<ReturnType<typeof getUserById>> | null = null;
        if (isOwner && !currentEmployee) {
          // If owner, fetch user data to create EmployeeRef
          try {
            userData = await getUserById(user.uid);
          } catch (error) {
            console.error('Error fetching user data for createdBy:', error);
          }
        }
        createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
      }

      // Create the product with supplier information and image URLs included
      let createdProduct;
      try {
        createdProduct = await addProduct(productData, supplierInfo, createdBy);
        console.log('Created product result:', createdProduct);

        if (!createdProduct) {
          throw new Error('addProduct returned undefined');
        }

        if (!createdProduct.id) {
          throw new Error('addProduct returned product without ID');
        }
      } catch (error) {
        console.error('Error in addProduct:', error);
        showErrorToast('Failed to create product');
        return;
      }

      // Recalculate category product counts after adding product
      try {
        await recalculateCategoryProductCounts(user.uid);
      } catch (error) {
        console.error('Error recalculating category counts:', error);
        // Don't show error to user as product creation was successful
      }

      // Refresh the product list to show the new product
      refresh();

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
      // Validate step 1 with specific field errors
      const step1Errs: Record<string, string> = {};
      if (!step1Data.name || step1Data.name.trim() === '') {
        step1Errs.name = t('products.form.step1.name') + ' ' + t('common.required');
        setStep1Errors(step1Errs);
        showWarningToast(t('products.messages.warnings.pleaseFillRequiredFields') || t('products.messages.warnings.requiredFields'));
        // Scroll to and focus the error field
        setTimeout(() => {
          const element = document.querySelector(`[name="name"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            (element as HTMLElement).focus();
          }
        }, 100);
        return;
      }
      // Clear any previous errors if validation passes
      setStep1Errors({});
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
      // Get createdBy employee reference
      let createdBy: ReturnType<typeof getCurrentEmployeeRef> | null = null;
      if (user && company) {
        let userData: Awaited<ReturnType<typeof getUserById>> | null = null;
        if (isOwner && !currentEmployee) {
          try {
            userData = await getUserById(user.uid);
          } catch (error) {
            console.error('Error fetching user data for createdBy:', error);
          }
        }
        createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
      }

      if (!company) {
        showErrorToast('Company not found');
        return;
      }

      const newSupplier = await createSupplier({
        name: quickSupplierData.name,
        contact: quickSupplierData.contact,
        location: quickSupplierData.location || undefined,
        userId: user.uid,
        companyId: company.id
      }, company.id, createdBy);

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











  const handleQuickAddSupplierForStock = async () => {
    if (!user?.uid) return;
    if (!quickSupplierData.name || !quickSupplierData.contact) {
      showWarningToast(t('suppliers.messages.warnings.requiredFields'));
      return;
    }

    setIsAddingSupplier(true);
    try {
      // Get createdBy employee reference
      let createdBy: ReturnType<typeof getCurrentEmployeeRef> | null = null;
      if (user && company) {
        let userData: Awaited<ReturnType<typeof getUserById>> | null = null;
        if (isOwner && !currentEmployee) {
          try {
            userData = await getUserById(user.uid);
          } catch (error) {
            console.error('Error fetching user data for createdBy:', error);
          }
        }
        createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
      }

      if (!company) {
        showErrorToast('Company not found');
        return;
      }

      const newSupplier = await createSupplier({
        name: quickSupplierData.name,
        contact: quickSupplierData.contact,
        location: quickSupplierData.location || undefined,
        userId: user.uid,
        companyId: company.id
      }, company.id, createdBy);

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
      category: product.category || '',
      images: Array.isArray(product.images) ? product.images : (product.images ? [product.images] : []),
      tags: product.tags || [], // Load existing tags
      isVisible: product.isVisible !== undefined ? product.isVisible : true, // Load visibility setting
      barCode: product.barCode || '', // Load existing barcode
    });
    // Find latest stock change for this product
    const latestStockChange = (stockChanges as StockChange[])
      .filter((sc: StockChange) => sc.productId === product.id)
      .sort((a: StockChange, b: StockChange) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0];
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

  const validateEditForm = (): boolean => {
    const step1Errs: Record<string, string> = {};
    let isValid = true;

    // Validate Step 1 (name is required for edit)
    if (!step1Data.name || step1Data.name.trim() === '') {
      step1Errs.name = t('products.form.step1.name') + ' ' + t('common.required');
      isValid = false;
    }

    setStep1Errors(step1Errs);

    if (!isValid) {
      const firstErrorField = Object.keys(step1Errs)[0];
      if (firstErrorField) {
        setTimeout(() => {
          const element = document.querySelector(`[name="${firstErrorField}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            (element as HTMLElement).focus();
          }
        }, 100);
      }
      showWarningToast(t('products.messages.warnings.pleaseFillRequiredFields') || t('products.messages.warnings.requiredFields'));
    }

    return isValid;
  };

  const handleEditProduct = async () => {
    if (!currentProduct || !user?.uid) {
      return;
    }

    // Validate form with specific field errors
    if (!validateEditForm()) {
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
      images: safeProduct.images, // Keep existing images, will be updated separately if needed
      tags: step1Data.tags || [], // Include tags in the update, default to empty array
      isAvailable: safeProduct.isAvailable,
      isVisible: step1Data.isVisible !== false, // Default to true, never undefined
      userId: safeProduct.userId,
      // updatedAt will be set by firestore.ts with serverTimestamp()
      sellingPrice: editPrices.sellingPrice ? parseFloat(editPrices.sellingPrice) : safeProduct.sellingPrice,
      cataloguePrice: editPrices.cataloguePrice ? parseFloat(editPrices.cataloguePrice) : safeProduct.cataloguePrice,
      // Include barcode if provided
      ...(step1Data.barCode && step1Data.barCode.trim() && { barCode: step1Data.barCode.trim() }),
    };

    // Only include category if it's not empty
    // Omit the field entirely if empty to preserve existing value
    if (step1Data.category && step1Data.category.trim()) {
      updateData.category = step1Data.category.trim();
    }
    // If category is empty, don't include it in updateData - Firestore will preserve existing value
    if (step1Data.reference && step1Data.reference.trim() !== '') {
      updateData.reference = step1Data.reference;
    }

    try {
      // Update product info only (stock management moved to dedicated Stocks page)
      await updateProductData(currentProduct.id, updateData);

      // Handle base64 to Firebase Storage conversion for images
      // Separate existing URLs from new File objects
      const existingImages: string[] = [];
      const newImageFiles: File[] = [];

      step1Data.images.forEach(img => {
        if (img instanceof File) {
          // New file to upload
          newImageFiles.push(img);
        } else if (typeof img === 'string') {
          // Existing URL - preserve it
          const trimmedUrl = img.trim();
          if (trimmedUrl !== '') {
            existingImages.push(trimmedUrl);
          }
        } else if (img && typeof img === 'object' && 'type' in img) {
          // Blob that's not a File - convert to File
          const blob = img as Blob;
          const file = new File([blob], `image_${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
          newImageFiles.push(file);
        }
      });

      if (newImageFiles.length > 0) {
        try {
          const storageService = new FirebaseStorageService();
          const uploadResults = await storageService.uploadProductImagesFromFiles(
            newImageFiles,
            user.uid,
            currentProduct.id
          );

          // Merge new image URLs with existing ones
          const newImageUrls = uploadResults.map(result => result.url);
          const newImagePaths = uploadResults.map(result => result.path);
          const allImageUrls = [...existingImages, ...newImageUrls];

          // Get existing imagePaths and merge with new ones
          const existingImagePaths = currentProduct.imagePaths || [];
          const allImagePaths = [...existingImagePaths, ...newImagePaths];

          // Debug: Check userId before updating
          console.log('Updating product images:', {
            productId: currentProduct.id,
            productUserId: currentProduct.userId,
            currentUserId: user.uid,
            imagesCount: allImageUrls.length
          });

          // Verify userId matches before updating
          // If product has a userId set, it must match the current user
          if (currentProduct.userId && currentProduct.userId !== user.uid) {
            console.error('Product userId mismatch detected!', {
              productUserId: currentProduct.userId,
              currentUserId: user.uid,
              productId: currentProduct.id
            });
            showErrorToast('Cannot update: Product ownership mismatch. Please refresh the product list.');
            return;
          }

          // Ensure userId is set when updating (for legacy products without userId)
          const imageUpdateData: Partial<Product> = {
            images: allImageUrls,
            imagePaths: allImagePaths
          };

          // If product doesn't have userId, set it to current user (for legacy compatibility)
          if (!currentProduct.userId) {
            imageUpdateData.userId = user.uid;
            console.log('Setting userId for legacy product:', currentProduct.id);
          }

          // Update the product with merged image URLs and paths
          await updateProductData(currentProduct.id, imageUpdateData);
        } catch (error) {
          console.error('Error uploading images:', error);
          showErrorToast('Product updated but images failed to upload');
        }
      } else if (existingImages.length !== currentProduct.images?.length ||
        JSON.stringify(existingImages.sort()) !== JSON.stringify((currentProduct.images || []).sort())) {
        // Images were reordered or some were removed, update with current selection
        // Extract existing imagePaths for remaining images
        const remainingImagePaths: string[] = [];
        existingImages.forEach(url => {
          // Try to find matching path from current product
          const currentIndex = currentProduct.images?.indexOf(url);
          if (currentIndex !== undefined && currentIndex >= 0 && currentProduct.imagePaths?.[currentIndex]) {
            remainingImagePaths.push(currentProduct.imagePaths[currentIndex]);
          }
        });

        await updateProductData(currentProduct.id, {
          images: existingImages,
          imagePaths: remainingImagePaths
        });
      }

      // Update latest stock change cost price if changed
      const latestStockChange = (stockChanges as StockChange[])
        .filter((sc: StockChange) => sc.productId === currentProduct.id)
        .sort((a: StockChange, b: StockChange) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0];
      if (latestStockChange && editPrices.costPrice && parseFloat(editPrices.costPrice) !== latestStockChange.costPrice) {
        // Update the batch cost price directly using correctBatchCostPrice
        if (latestStockChange.batchId) {
          await correctBatchCostPrice(
            latestStockChange.batchId,
            parseFloat(editPrices.costPrice),
            user.uid
          );
        }
      }

      // Recalculate category product counts after updating product
      try {
        await recalculateCategoryProductCounts(user.uid);
      } catch (error) {
        console.error('Error recalculating category counts:', error);
        // Don't show error to user as product update was successful
      }

      // Refresh the product list to show the updated product
      refresh();

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
    infiniteProducts.forEach(async (product: Product) => {
      const hasStockChange = (stockChanges as StockChange[]).some((sc: StockChange) => sc.productId === product.id);
      if ((product.stock ?? 0) > 0 && !hasStockChange) {
        // Create an initial adjustment with 'creation' reason
        try {
          await updateProductData(product.id, { stock: product.stock ?? 0 }, 'creation', product.stock ?? 0);
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
          const product = infiniteProducts.find((p: Product) => p.id === productId);
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
        const product = infiniteProducts.find((p: Product) => p.id === id);
        if (!product) continue;
        const safeProduct = {
          ...product,
          isAvailable: typeof product.isAvailable === 'boolean' ? product.isAvailable : true,
          images: (product.images ?? []).length > 0 ? product.images : [],
          userId: product.userId || user.uid,
          updatedAt: product.updatedAt || { seconds: 0, nanoseconds: 0 },
        };
        const updateData = { isAvailable: false, images: safeProduct.images, userId: safeProduct.userId, updatedAt: { seconds: 0, nanoseconds: 0 } };
        await updateProductData(id, updateData);
      }

      // Recalculate category product counts after bulk deletion
      try {
        await recalculateCategoryProductCounts(user.uid);
      } catch (error) {
        console.error('Error recalculating category counts:', error);
        // Don't show error to user as product deletion was successful
      }

      // Refresh the product list to remove the deleted products
      refresh();

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
      await updateProductData(productToDelete.id, updateData);

      // Recalculate category product counts after deletion
      try {
        await recalculateCategoryProductCounts(user.uid);
      } catch (error) {
        console.error('Error recalculating category counts:', error);
        // Don't show error to user as product deletion was successful
      }

      // Refresh the product list to remove the deleted product
      refresh();

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
    return allStockBatches.filter((batch: StockBatch) => batch.productId === productId);
  };

  // Helper function to calculate stock from batches (sum of remainingQuantity from active batches)
  const getProductStockFromBatches = (productId: string): number => {
    const batches = getProductBatches(productId);
    const activeBatches = batches.filter(batch => batch.status === 'active');
    return activeBatches.reduce((sum, batch) => sum + (batch.remainingQuantity || 0), 0);
  };

  // Helper function to get latest cost price from active stock batches
  // Uses updatedAt to get the most recently modified batch (for cost price corrections)
  // Falls back to createdAt if updatedAt is not available
  const getLatestCostPriceFromBatches = (productId: string): number | undefined => {
    const batches = getProductBatches(productId);
    const activeBatches = batches.filter(batch => batch.status === 'active' && batch.remainingQuantity > 0);
    if (activeBatches.length === 0) return undefined;

    // Sort by updatedAt (most recently modified first), fallback to createdAt if updatedAt is not available
    // This ensures that when a batch's cost price is corrected, it's recognized as the latest
    const sortedBatches = activeBatches.sort((a, b) => {
      // Primary sort: updatedAt (most recently modified)
      const updatedA = a.updatedAt?.seconds || 0;
      const updatedB = b.updatedAt?.seconds || 0;
      if (updatedB !== updatedA) {
        return updatedB - updatedA;
      }
      // Secondary sort: createdAt (if updatedAt is same or missing)
      const createdA = a.createdAt?.seconds || 0;
      const createdB = b.createdAt?.seconds || 0;
      return createdB - createdA;
    });

    return sortedBatches[0]?.costPrice || undefined;
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
    const matchesCategory = selectedCategory === t('products.filters.allCategories') ||
      product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }) || [];

  const resetImportState = (): void => {
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMapping({});
    setImportProgress(0);
  };

  if (infiniteLoading) {
    return <SkeletonProductsGrid rows={20} />;
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

    // Get createdBy employee reference once for all imports
    let createdBy: ReturnType<typeof getCurrentEmployeeRef> | null = null;
    if (user && company) {
      let userData: Awaited<ReturnType<typeof getUserById>> | null = null;
      if (isOwner && !currentEmployee) {
        // If owner, fetch user data to create EmployeeRef
        try {
          userData = await getUserById(user.uid);
        } catch (error) {
          console.error('Error fetching user data for createdBy:', error);
        }
      }
      createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
    }

    if (!company) {
      showErrorToast('Company not found');
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
        companyId: company.id,
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
        let supplier: Awaited<ReturnType<typeof createSupplier>> | undefined = undefined;
        if (supplierName) {
          supplier = suppliers.find((s: { name: string; id: string }) => s.name.toLowerCase() === supplierName.toLowerCase());
          if (!supplier) {
            supplier = await createSupplier({
              name: supplierName,
              contact: 'Imported',
              userId: user.uid,
              companyId: company.id
            }, company.id, createdBy);
          }
          finalSupplierId = supplier.id;
        } else if (finalSupplierId) {
          supplier = suppliers.find((s: { id: string }) => s.id === finalSupplierId);
          if (!supplier) {
            supplier = await createSupplier({
              name: finalSupplierId,
              contact: 'Imported',
              userId: user.uid,
              companyId: company.id
            }, company.id, createdBy);
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
        await addProduct(productData, supplierInfo, createdBy);
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
            icon={<FileText size={16} />}
            onClick={() => setIsReportModalOpen(true)}
            variant="outline"
          >
            Générer un rapport
          </Button>

          <PermissionButton
            resource={RESOURCES.PRODUCTS}
            action="create"
            icon={<Plus size={16} />}
            onClick={() => setIsAddModalOpen(true)}
            hideWhenNoPermission
          >
            {t('products.actions.addProduct')}
          </PermissionButton>

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
            {categories.map((category: string) => (
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
                  {(product.images ?? []).map((img: string, idx: number) => (
                    <div
                      key={idx}
                      onClick={() => handleSetMainImage(product.id, idx)}
                      className="cursor-pointer"
                    >
                      <ImageWithSkeleton
                        src={img}
                        alt={`Preview ${idx + 1}`}
                        className={`w-10 h-10 object-cover rounded border transition-transform duration-200 ${mainImageIndexes[product.id] === idx ? 'ring-2 ring-emerald-500 scale-105' : 'opacity-70 hover:opacity-100'}`}
                        placeholder="/placeholder.png"
                      />
                    </div>
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
                      {batchesLoading ? (
                        <div className="h-5 w-16 bg-gray-200 rounded animate-pulse" />
                      ) : (
                        (() => {
                          const stockFromBatches = getProductStockFromBatches(product.id);
                          return (
                            <Badge variant={stockFromBatches > 10 ? 'success' : stockFromBatches > 5 ? 'warning' : 'error'}>
                              {stockFromBatches} units
                            </Badge>
                          );
                        })()
                      )}
                    </div>
                  </div>
                  {product.category && (
                    <p className="mt-2 text-sm text-gray-500">{product.category}</p>
                  )}
                  <div className="mt-2 text-xs text-gray-400">
                    Créé par: {formatCreatorName(product.createdBy)}
                  </div>
                </div>
                <div className="mt-4 flex justify-end space-x-2 px-4 pb-3">
                  <button
                    onClick={() => { setDetailProduct(product); setIsDetailModalOpen(true); }}
                    className="text-blue-600 hover:text-blue-900"
                    title={t('products.actions.viewDetails')}
                  >
                    <Info size={16} />
                  </button>
                  {product.barCode && (
                    <button
                      onClick={() => {
                        setSelectedProductForBarcode(product);
                        setIsBarcodeModalOpen(true);
                      }}
                      className="text-emerald-600 hover:text-emerald-900"
                      title="Voir le QR code"
                    >
                      <QrCode size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleVisibility(product)}
                    className={`px-2 py-1 text-xs rounded-full border transition-colors ${getEffectiveVisibility(product)
                      ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    title={getEffectiveVisibility(product) ? t('products.actions.hideFromCatalogue') : t('products.actions.showInCatalogue')}
                  >
                    {getEffectiveVisibility(product) ? 'Visible on catalogue' : 'Hidden from catalogue'}
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => openEditModal(product)}
                      className="text-indigo-600 hover:text-indigo-900"
                      title={t('products.actions.editProduct')}
                    >
                      <Edit2 size={16} />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => openDeleteModal(product)}
                      className="text-red-600 hover:text-red-900"
                      title={t('products.actions.deleteProduct')}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
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
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Créé par
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
                      <td className="absolute left-0 top-0 w-full h-full bg-black bg-opacity-20 z-10" colSpan={8} />
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
                      {batchesLoading ? (
                        <div className="h-5 w-16 bg-gray-200 rounded animate-pulse" />
                      ) : (
                        (() => {
                          const stockFromBatches = getProductStockFromBatches(product.id);
                          return (
                            <Badge variant={stockFromBatches > 10 ? 'success' : stockFromBatches > 5 ? 'warning' : 'error'}>
                              {stockFromBatches} units
                            </Badge>
                          );
                        })()
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{product.category}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{formatCreatorName(product.createdBy)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => { setDetailProduct(product); setIsDetailModalOpen(true); }}
                          className="text-blue-600 hover:text-blue-900"
                          title={t('products.actions.viewDetails')}
                        >
                          <Info size={16} />
                        </button>
                        {product.barCode && (
                          <button
                            onClick={() => {
                              setSelectedProductForBarcode(product);
                              setIsBarcodeModalOpen(true);
                            }}
                            className="text-emerald-600 hover:text-emerald-900"
                            title="Voir le QR code"
                          >
                            <QrCode size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleVisibility(product)}
                          className={`px-2 py-1 text-xs rounded-full border transition-colors ${getEffectiveVisibility(product)
                            ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                            }`}
                          title={getEffectiveVisibility(product) ? t('products.actions.hideFromCatalogue') : t('products.actions.showInCatalogue')}
                        >
                          {getEffectiveVisibility(product) ? 'Visible on catalogue' : 'Hidden from catalogue'}
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => openEditModal(product)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title={t('products.actions.editProduct')}
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => openDeleteModal(product)}
                            className="text-red-600 hover:text-red-900"
                            title={t('products.actions.deleteProduct')}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center py-6">
          <Button
            onClick={loadMore}
            disabled={loadingMore}
            variant="outline"
            icon={loadingMore ? <Loader2 className="animate-spin" size={16} /> : <ChevronDown size={16} />}
          >
            {loadingMore ? t('common.loading') : t('common.loadMore')}
          </Button>
        </div>
      )}
      {!hasMore && infiniteProducts.length > 0 && (
        <div className="text-center py-6 text-gray-500">
          <p>✅ {t('products.messages.allLoaded', { count: infiniteProducts.length }) || `All products loaded (${infiniteProducts.length} total)`}</p>
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
                error={step1Errors.name}
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
                  onChange={(category: string) => setStep1Data(prev => ({ ...prev, category }))}
                  showImages={true}
                  placeholder={t('products.form.step1.categoryPlaceholder')}
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
                      <span className="animate-pulse text-emerald-500"><Upload size={28} /></span>
                    ) : (
                      <Upload size={28} className="text-gray-400" />
                    )}
                  </label>
                  <div className="flex overflow-x-auto custom-scrollbar space-x-2 py-1">
                    {(step1Data.images ?? []).map((img: File | string, idx: number) => {
                      // Handle both File objects and existing URLs
                      let imageSrc: string;
                      if (img instanceof File) {
                        imageSrc = URL.createObjectURL(img);
                      } else if (typeof img === 'string') {
                        imageSrc = img;
                      } else if (img && typeof img === 'object' && 'type' in img) {
                        // Handle Blob objects (convert to object URL)
                        imageSrc = URL.createObjectURL(img as Blob);
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
                <p className="mt-1 text-sm text-gray-500">{t('products.form.step1.imageHelp')}</p>
              </div>

              <Input
                label="Code-barres EAN-13 (optionnel)"
                name="barCode"
                value={step1Data.barCode || ''}
                onChange={handleStep1InputChange}
                placeholder="Laissez vide pour génération automatique"
                helpText="Si vide, un code-barres EAN-13 sera généré automatiquement"
              />

              {/* Product Tags Manager */}
              <ProductTagsManager
                tags={step1Data.tags}
                onTagsChange={(tags: ProductTag[]) => setStep1Data(prev => ({ ...prev, tags }))}
                images={step1Data.images
                  .map((img: File | string) => typeof img === 'string' ? img : URL.createObjectURL(img))
                  .filter((url): url is string => typeof url === 'string')
                }
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
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${step1Data.isVisible ? 'bg-emerald-600' : 'bg-gray-200'
                      }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${step1Data.isVisible ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                  </button>
                </div>
              </div>
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
                error={step2Errors.stock}
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
                        className={`flex-1 rounded-md border ${step2Errors.supplierId ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-emerald-500 focus:ring-emerald-500'
                          } shadow-sm focus:outline-none focus:ring-1 sm:text-sm px-3 py-2`}
                      >
                        <option value="">{t('common.select')}</option>
                        {suppliers.filter((s: { isDeleted?: boolean }) => !s.isDeleted).map((supplier: { id: string; name: string }) => (
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
                    {step2Errors.supplierId && (
                      <p className="mt-1 text-sm text-red-500">{step2Errors.supplierId}</p>
                    )}
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
              <PriceInput
                label={t('products.form.step2.stockCostPrice')}
                name="stockCostPrice"
                value={step2Data.stockCostPrice}
                onChange={handleStep2InputChange}
                error={step2Errors.stockCostPrice}
                helpText={step2Errors.stockCostPrice ? undefined : t('products.form.step2.stockCostPriceHelp')}
                allowDecimals={true}
                required
              />
              <PriceInput
                label={t('products.form.step2.sellingPrice')}
                name="sellingPrice"
                value={step2Data.sellingPrice}
                onChange={handleStep2InputChange}
                error={step2Errors.sellingPrice}
                helpText={step2Errors.sellingPrice ? undefined : t('products.form.step2.sellingPriceHelp')}
                allowDecimals={false}
                required
              />
              <PriceInput
                label={t('products.form.step2.cataloguePrice')}
                name="cataloguePrice"
                value={step2Data.cataloguePrice}
                onChange={handleStep2InputChange}
                helpText={t('products.form.step2.cataloguePriceHelp')}
                allowDecimals={false}
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
            className={`px-4 py-2 ${editTab === 'pricing' ? 'font-bold border-b-2 border-emerald-500' : 'text-gray-500'}`}
            onClick={() => setEditTab('pricing')}
            type="button"
          >
            {t('products.editTabs.pricing')}
          </button>
          <button
            className={`px-4 py-2 ${editTab === 'stock' ? 'font-bold border-b-2 border-emerald-500' : 'text-gray-500'}`}
            onClick={() => setEditTab('stock')}
            type="button"
          >
            {t('products.editTabs.stock')}
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
              error={step1Errors.name}
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
            {/* Barcode */}
            <Input
              label="Code-barres EAN-13"
              name="barCode"
              value={step1Data.barCode || ''}
              onChange={handleStep1InputChange}
              placeholder="Code-barres EAN-13"
              helpText="Code-barres EAN-13 du produit"
            />
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('products.form.category')}</label>
              <CategorySelector
                value={step1Data.category}
                onChange={(category: string) => setStep1Data(prev => ({ ...prev, category }))}
                showImages={true}
                placeholder={t('products.form.categoryPlaceholder')}
              />
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
                      } else if (image && typeof image === 'object' && 'type' in image) {
                        // Handle Blob objects (convert to object URL)
                        imageSrc = URL.createObjectURL(image as Blob);
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
                    <div className="animate-pulse bg-gray-200 w-4 h-4 rounded-full"></div>
                    <span>{t('products.actions.uploadingImages')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Product Tags Manager */}
            <ProductTagsManager
              tags={step1Data.tags}
              onTagsChange={(tags: ProductTag[]) => setStep1Data(prev => ({ ...prev, tags }))}
              images={step1Data.images
                .map((img: File | string) => typeof img === 'string' ? img : URL.createObjectURL(img))
                .filter((url): url is string => typeof url === 'string')
              }
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
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${step1Data.isVisible ? 'bg-emerald-600' : 'bg-gray-200'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${step1Data.isVisible ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
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
            <PriceInput
              label={t('products.form.step2.sellingPrice')}
              name="sellingPrice"
              value={editPrices.sellingPrice || ''}
              onChange={(e) => setEditPrices((p: typeof editPrices) => ({ ...p, sellingPrice: e.target.value }))}
              required
              helpText={t('products.form.sellingPriceHelp', 'Required: The price at which you sell this product.')}
            />
            {/* Catalogue Price */}
            <PriceInput
              label={t('products.form.step2.cataloguePrice')}
              name="cataloguePrice"
              value={editPrices.cataloguePrice || ''}
              onChange={(e) => setEditPrices((p: typeof editPrices) => ({ ...p, cataloguePrice: e.target.value }))}
              helpText={t('products.form.cataloguePriceHelp', 'Optional: Used for reference or promotions.')}
            />
            {/* Profit/Cost Info */}
            <div className="space-y-1">
              <div className="text-sm text-gray-700">
                {t('products.form.latestCostPrice', 'Latest Cost Price')}: {currentProduct?.id ? (getLatestCostPriceFromBatches(currentProduct.id)?.toLocaleString() || '0') : '0'} XAF
              </div>
              <div className="text-sm text-gray-700">
                {t('products.form.profitPerUnit', 'Profit per unit')}: {editPrices.sellingPrice && currentProduct?.id && getLatestCostPriceFromBatches(currentProduct.id) !== undefined ? (parseFloat(editPrices.sellingPrice) - (getLatestCostPriceFromBatches(currentProduct.id) ?? 0)).toLocaleString() : '-'} XAF
              </div>
              {editPrices.sellingPrice && currentProduct?.id && getLatestCostPriceFromBatches(currentProduct.id) !== undefined && parseFloat(editPrices.sellingPrice) < (getLatestCostPriceFromBatches(currentProduct.id) ?? 0) && (
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
        {editTab === 'stock' && (
          <div className="space-y-6">
            {/* Info Box */}
            <div className="flex items-start bg-blue-50 border-l-4 border-blue-400 p-4 rounded-md mb-4">
              <svg className="w-5 h-5 text-blue-400 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              <div className="text-sm text-blue-800">
                Stock management has been moved to the dedicated <strong>Stocks</strong> page for better organization and easier batch management.
              </div>
            </div>

            {/* Current Stock Display */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Current Stock Level</h3>
                  <p className="text-sm text-gray-600">Total available units for this product</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600">{currentProduct?.id ? getProductStockFromBatches(currentProduct.id) : 0}</div>
                  <div className="text-sm text-gray-500">units</div>
                </div>
              </div>
            </div>

            {/* Link to Stocks Page */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-emerald-900 mb-1">Manage Stock in Inventory Page</h4>
                  <p className="text-sm text-emerald-700">
                    Use the dedicated Stocks page to restock, adjust batches, record damage, and view complete stock history.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    const stocksPath = isCompanyRoute && companyId
                      ? `/company/${companyId}/products/stocks`
                      : '/products/stocks';
                    navigate(stocksPath);
                    setIsEditModalOpen(false);
                  }}
                  icon={<ExternalLink size={16} />}
                >
                  Go to Stocks
                </Button>
              </div>
            </div>

            {/* Read-only Stock Information */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-gray-700 mb-1">Product Name</div>
                  <div className="text-lg font-semibold text-gray-900">{currentProduct?.name || '—'}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-gray-700 mb-1">Reference</div>
                  <div className="text-lg font-semibold text-gray-900">{currentProduct?.reference || '—'}</div>
                </div>
              </div>

              {/* Mini Stock History Table (last 2 changes) - Read Only */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">{t('products.actions.stockHistory')}</h4>
                  <span className="text-xs text-gray-500">Last 2 changes</span>
                </div>
                {(() => {
                  const history = (stockChanges as StockChange[]).filter((sc: StockChange) => sc.productId === currentProduct?.id).slice(-2).reverse();
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
                          const supplier = sc.supplierId ? suppliers.find((s: { id: string }) => s.id === sc.supplierId) : null;
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
                  <button
                    onClick={() => {
                      const stocksPath = isCompanyRoute && companyId
                        ? `/company/${companyId}/products/stocks`
                        : '/products/stocks';
                      navigate(stocksPath);
                      setIsEditModalOpen(false);
                    }}
                    className="text-xs text-emerald-600 hover:text-emerald-700 underline"
                  >
                    {t('products.actions.viewAllHistory', 'View All History in Stocks Page')}
                  </button>
                </div>
              </div>
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
        title={t('products.actions.viewDetails')}
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
                  {detailProduct.images.map((img: string, idx: number) => (
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('products.form.latestCostPrice', 'Latest Cost Price')}</label>
                    {detailProduct?.id ? (
                      <CostPriceCarousel batches={getProductBatches(detailProduct.id)} />
                    ) : (
                      <p className="mt-1 text-sm text-gray-900">0 XAF</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Stock Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('products.detailTabs.stock', 'Stock Information')}</h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('products.table.columns.stock')}</label>
                  <div className="mt-1">
                    {(() => {
                      const stockFromBatches = detailProduct?.id ? getProductStockFromBatches(detailProduct.id) : 0;
                      return (
                        <Badge variant={stockFromBatches > 10 ? 'success' : stockFromBatches > 5 ? 'warning' : 'error'}>
                          {stockFromBatches} units
                        </Badge>
                      );
                    })()}
                  </div>
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
              let filteredStockChanges = (stockChanges as StockChange[]).filter((sc: StockChange) => sc.productId === detailProduct?.id);

              // Apply type filter
              if (stockHistoryFilterType) {
                filteredStockChanges = filteredStockChanges.filter((sc: StockChange) => sc.reason === stockHistoryFilterType);
              }

              // Apply supplier filter
              if (stockHistoryFilterSupplier) {
                if (stockHistoryFilterSupplier === 'ownPurchase') {
                  filteredStockChanges = filteredStockChanges.filter((sc: StockChange) => sc.isOwnPurchase);
                } else {
                  filteredStockChanges = filteredStockChanges.filter((sc: StockChange) => sc.supplierId === stockHistoryFilterSupplier);
                }
              }

              // Apply search filter
              if (stockHistorySearch) {
                const searchLower = stockHistorySearch.toLowerCase();
                filteredStockChanges = filteredStockChanges.filter((sc: StockChange) => {
                  const supplier = sc.supplierId ? suppliers.find(s => s.id === sc.supplierId) : null;
                  return (
                    sc.reason.toLowerCase().includes(searchLower) ||
                    (supplier && supplier.name.toLowerCase().includes(searchLower))
                  );
                });
              }

              // Sort stock changes
              filteredStockChanges.sort((a: StockChange, b: StockChange) => {
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
                        {paginatedStockChanges.map((stockChange: StockChange) => {
                          const supplier = stockChange.supplierId ? suppliers.find((s: { id: string }) => s.id === stockChange.supplierId) : null;
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

      {/* Barcode/QR Code Modal */}
      <Modal
        isOpen={isBarcodeModalOpen}
        onClose={() => {
          setIsBarcodeModalOpen(false);
          setSelectedProductForBarcode(null);
        }}
        title="Codes-barres et QR Codes"
        size="lg"
      >
        {selectedProductForBarcode && company && (
          <BarcodeGenerator
            product={selectedProductForBarcode}
            companyName={company.name}
            companyId={company.id}
          />
        )}
      </Modal>

      {/* Products Report Modal */}
      <ProductsReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        products={infiniteProducts}
        stockBatches={allStockBatches}
        stocks={[]}
        categories={categoryList}
        suppliers={suppliers}
        companyName={company?.name}
        companyLogo={company?.logo}
      />

      {/* Mobile spacing for floating action button */}
      <div className="h-20 md:hidden"></div>
    </div>
  );
};

export default Products;