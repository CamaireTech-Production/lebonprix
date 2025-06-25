import { useState, useEffect } from 'react';
import { Grid, List, Plus, Search, Edit2, Upload, Trash2, CheckSquare, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal, { ModalFooter } from '../components/common/Modal';
import Input from '../components/common/Input';
import CreatableSelect from '../components/common/CreatableSelect';
import { useProducts, useStockChanges, useCategories } from '../hooks/useFirestore';
import { useAuth } from '../contexts/AuthContext';
import LoadingScreen from '../components/common/LoadingScreen';
import { showSuccessToast, showErrorToast, showWarningToast } from '../utils/toast';
import imageCompression from 'browser-image-compression';
import Papa from 'papaparse';
import type { Product } from '../types/models';
import type { ParseResult } from 'papaparse';

interface CsvRow {
  [key: string]: string;
}

const Products = () => {
  const { t, i18n } = useTranslation();
  const { products, loading, error, addProduct, updateProduct, deleteProduct } = useProducts();
  const { stockChanges, loading: stockChangesLoading } = useStockChanges();
  const { addCategory } = useCategories();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(t('products.filters.allCategories'));
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    reference: '',
    costPrice: '',
    sellingPrice: '',
    category: '',
    stock: '',
    imageUrl: '',
    imageFile: null as File | null
  });
  
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [editTab, setEditTab] = useState<'details' | 'stock'>('details');
  // State for stock adjustment tab
  const [stockAdjustment, setStockAdjustment] = useState('');
  const [stockReason, setStockReason] = useState<'restock' | 'adjustment'>('restock');
  const [isStockSubmitting, setIsStockSubmitting] = useState(false);
  
  const [isBulkSelection, setIsBulkSelection] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  
  // Add state for saveCategories
  const [saveCategories, setSaveCategories] = useState(false);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const resetForm = () => {
    setFormData({
      name: '',
      reference: '',
      costPrice: '',
      sellingPrice: '',
      category: '',
      stock: '',
      imageUrl: '',
      imageFile: null
    });
  };

  // Get unique categories from products
  const categories = [t('products.filters.allCategories'), ...new Set(products?.map(p => p.category) || [])];

  const handleCategoryChange = (option: { label: string; value: string } | null) => {
    setFormData(prev => ({
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
    if (!formData.name || !formData.costPrice || !formData.sellingPrice || !formData.category) {
      showWarningToast(t('products.messages.warnings.requiredFields'));
      return;
    }
    setIsSubmitting(true);
    let imageBase64 = '/placeholder.png';
    if (formData.imageFile) {
      try {
        imageBase64 = await compressImage(formData.imageFile);
      } catch (err) {
        showErrorToast(t('products.messages.errors.addProduct'));
        setIsSubmitting(false);
        return;
      }
    }
    const productData = {
      name: formData.name,
      reference: formData.reference,
      costPrice: parseFloat(formData.costPrice),
      sellingPrice: parseFloat(formData.sellingPrice),
      category: formData.category,
      stock: parseInt(formData.stock) || 0,
      imageUrl: imageBase64,
      isAvailable: true,
      userId: user.uid,
      updatedAt: { seconds: 0, nanoseconds: 0 }
    };
    try {
      await addProduct(productData);
      setIsAddModalOpen(false);
      resetForm();
      showSuccessToast(t('products.messages.productAdded'));
    } catch (err) {
      showErrorToast(t('products.messages.errors.addProduct'));
      setIsAddModalOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleEditProduct = async () => {
    if (!currentProduct || !user?.uid) return;
    if (!formData.name || !formData.costPrice || !formData.sellingPrice || !formData.category) {
        showWarningToast(t('products.messages.warnings.requiredFields'));
        return;
      }
      setIsSubmitting(true);
    let imageBase64 = currentProduct.imageUrl || '/placeholder.png';
      if (formData.imageFile) {
        try {
          imageBase64 = await compressImage(formData.imageFile);
        } catch (err) {
          showErrorToast(t('products.messages.errors.updateProduct'));
        setIsSubmitting(false);
        return;
        }
    }
    // Ensure all required fields are present for legacy products
    const safeProduct = {
      ...currentProduct,
      isAvailable: typeof currentProduct.isAvailable === 'boolean' ? currentProduct.isAvailable : true,
      imageUrl: currentProduct.imageUrl || '/placeholder.png',
      userId: currentProduct.userId || user.uid,
      updatedAt: currentProduct.updatedAt || { seconds: 0, nanoseconds: 0 },
    };
    // Only include reference if it is a non-empty string
    const updateData: any = {
          name: formData.name,
          costPrice: parseFloat(formData.costPrice),
          sellingPrice: parseFloat(formData.sellingPrice),
          category: formData.category,
          imageUrl: imageBase64,
      isAvailable: safeProduct.isAvailable,
      userId: safeProduct.userId,
        updatedAt: { seconds: 0, nanoseconds: 0 }
    };
    if (formData.reference && formData.reference.trim() !== '') {
      updateData.reference = formData.reference;
    }
    try {
      await updateProduct(currentProduct.id, updateData, user.uid);
        setIsEditModalOpen(false);
        resetForm();
        showSuccessToast(t('products.messages.productUpdated'));
    } catch (err) {
      showErrorToast(t('products.messages.errors.updateProduct'));
      setIsEditModalOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const openEditModal = (product: Product) => {
    setCurrentProduct(product);
    setFormData({
      name: product.name,
      reference: product.reference,
      costPrice: product.costPrice.toString(),
      sellingPrice: product.sellingPrice.toString(),
      category: product.category,
      stock: '', // Not used in edit details, reset to avoid issues
      imageUrl: product.imageUrl || '/placeholder.png',
      imageFile: null
    });
    setIsEditModalOpen(true);
    setEditTab('details'); // Reset to details tab on open
    setStockAdjustment(''); // Reset stock adjustment field
  };
  
  // Filter products by search query and category
  const filteredProducts = products?.filter(product => {
    if (typeof product.isAvailable !== 'undefined' && product.isAvailable === false) return false;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.reference.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === t('products.filters.allCategories') || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }) || [];

  const resetImportState = () => {
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMapping({});
    setImportProgress(0);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      transform: (value: string) => value.trim(),
      complete: (results: ParseResult<CsvRow>) => {
        if (results.data && results.data.length > 0) {
          console.log('Parsed CSV data:', results.data);
          setCsvData(results.data);
          const headers = Object.keys(results.data[0]);
          setCsvHeaders(headers);
          
          // Initialize column mapping with empty values
          const initialMapping: Record<string, string> = {};
          headers.forEach(header => {
            initialMapping[header] = '';
          });
          
          // Try to automatically map columns based on common patterns
          headers.forEach(header => {
            const lowerHeader = header.toLowerCase();
            // Reference/ID patterns
            if (lowerHeader.includes('ref') || lowerHeader.includes('id') || lowerHeader.includes('code')) {
              initialMapping[header] = 'reference';
            }
            // Name patterns
            else if (lowerHeader.includes('name') || lowerHeader.includes('designation') || lowerHeader.includes('product') || lowerHeader.includes('description')) {
              initialMapping[header] = 'name';
            }
            // Cost price patterns
            else if (lowerHeader.includes('cost') || lowerHeader.includes('buy') || lowerHeader.includes('purchase') || lowerHeader.includes('prix d\'achat')) {
              initialMapping[header] = 'costPrice';
            }
            // Selling price patterns
            else if (lowerHeader.includes('price') || lowerHeader.includes('sell') || lowerHeader.includes('prix de vente')) {
              initialMapping[header] = 'sellingPrice';
            }
            // Stock patterns
            else if (lowerHeader.includes('stock') || lowerHeader.includes('quantity') || lowerHeader.includes('qty') || lowerHeader.includes('inventory')) {
              initialMapping[header] = 'stock';
            }
            // Category patterns
            else if (lowerHeader.includes('category') || lowerHeader.includes('type') || lowerHeader.includes('catégorie')) {
              initialMapping[header] = 'category';
            }
          });
          
          setColumnMapping(initialMapping);
        } else {
          showErrorToast(t('products.messages.errors.emptyFile'));
        }
      },
      error: (error: Error) => {
        console.error('CSV parsing error:', error);
        showErrorToast(t('products.messages.errors.parseError', { error: error.message }));
      }
    });
  };

  const handleColumnMappingChange = (csvColumn: string, productField: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [csvColumn]: productField
    }));
  };

  const validateMapping = () => {
    const requiredFields = ['name', 'reference', 'costPrice', 'sellingPrice', 'category', 'stock'];
    const mappedFields = Object.values(columnMapping);
    
    for (const field of requiredFields) {
      if (!mappedFields.includes(field)) {
        showWarningToast(t('products.messages.warnings.mapField', { field: t(`products.import.fields.${field}`) }));
        return false;
      }
    }

    // Validate that all required fields are mapped to non-empty CSV columns
    for (const [csvColumn, productField] of Object.entries(columnMapping)) {
      if (requiredFields.includes(productField) && !csvColumn) {
        showWarningToast(t('products.messages.warnings.emptyMapping', { field: t(`products.import.fields.${productField}`) }));
        return false;
      }
    }

    return true;
  };

  const formatCategory = (category: string): string => {
    return category
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const handleImport = async () => {
    if (!validateMapping()) return;
    if (!user?.uid) {
      showErrorToast(t('products.messages.errors.notLoggedIn'));
      return;
    }

    try {
      setIsImporting(true);
      const totalProducts = csvData.length;
      let processedCount = 0;
      let successCount = 0;
      let errorCount = 0;

      // Process each row
      for (const row of csvData) {
        try {
          // Clean and validate the data
          const cleanData = {
            name: row[columnMapping.name]?.trim() || '',
            reference: row[columnMapping.reference]?.trim() || '',
            costPrice: row[columnMapping.costPrice]?.replace(/[^0-9.-]+/g, '') || '0',
            sellingPrice: row[columnMapping.sellingPrice]?.replace(/[^0-9.-]+/g, '') || '0',
            stock: row[columnMapping.stock]?.replace(/[^0-9.-]+/g, '') || '0',
            category: row[columnMapping.category]?.trim() || 'Non catégorisé'
          };

          // Validate required fields
          if (!cleanData.name) {
            throw new Error(t('products.messages.warnings.missingName'));
          }
          if (!cleanData.reference) {
            throw new Error(t('products.messages.warnings.missingReference'));
          }
          if (isNaN(parseFloat(cleanData.costPrice)) || parseFloat(cleanData.costPrice) < 0) {
            throw new Error(t('products.messages.warnings.invalidCostPrice'));
          }
          if (isNaN(parseFloat(cleanData.sellingPrice)) || parseFloat(cleanData.sellingPrice) < 0) {
            throw new Error(t('products.messages.warnings.invalidSellingPrice'));
          }
          if (isNaN(parseInt(cleanData.stock)) || parseInt(cleanData.stock) < 0) {
            throw new Error(t('products.messages.warnings.invalidStock'));
          }

          // Create the product data
          const productData = {
            name: cleanData.name,
            reference: cleanData.reference,
            costPrice: parseFloat(cleanData.costPrice),
            sellingPrice: parseFloat(cleanData.sellingPrice),
            category: formatCategory(cleanData.category),
            stock: parseInt(cleanData.stock),
            imageUrl: '', // No image provided in CSV, so leave empty
            isAvailable: true,
            userId: user.uid,
            updatedAt: {
              seconds: 0,
              nanoseconds: 0
            }
          };

          await addProduct(productData);
          successCount++;
        } catch (error) {
          console.error('Error processing row:', row);
          console.error('Error details:', error);
          errorCount++;
        } finally {
          processedCount++;
          setImportProgress((processedCount / totalProducts) * 100);
        }
      }

      if (successCount > 0) {
        showSuccessToast(t('products.messages.importSuccess', { 
          count: successCount,
          total: totalProducts,
          errors: errorCount
        }));
      } else {
        showErrorToast(t('products.messages.errors.importFailed'));
      }
      setIsImportModalOpen(false);
      resetImportState();

      // In handleImport, after importing products, if saveCategories is true, save new categories
      if (saveCategories) {
        // Collect unique categories from csvData
        const csvCategories = Array.from(new Set(csvData.map(row => row[columnMapping.category]?.trim()).filter(Boolean)));
        // Get existing categories from products
        const existingCategories = new Set(products.map(p => p.category));
        // Find new categories
        const newCategories = csvCategories.filter(cat => !existingCategories.has(cat));
        // Save new categories (assume addCategory is available from useCategories)
        for (const cat of newCategories) {
          if (cat) {
            try {
              await addCategory(cat);
            } catch (e) { /* ignore errors for duplicates */ }
          }
        }
      }
    } catch (error) {
      console.error('Import failed:', error);
      showErrorToast(t('products.messages.errors.importFailed'));
    } finally {
      setIsImporting(false);
    }
  };

  const handleStockSubmit = async () => {
    if (!currentProduct || !user?.uid || !stockAdjustment) return;
    const adjustmentAmount = parseInt(stockAdjustment, 10);
    if (isNaN(adjustmentAmount)) {
      showErrorToast(t('products.messages.errors.invalidStock'));
      return;
    }
    setIsStockSubmitting(true);
    let newStock: number;
    let change: number;
    if (stockReason === 'restock') {
      if (adjustmentAmount <= 0) {
        showErrorToast(t('products.messages.warnings.positiveQuantity'));
        setIsStockSubmitting(false);
        return;
      }
      change = adjustmentAmount;
      newStock = currentProduct.stock + change;
    } else { // 'adjustment'
      if (adjustmentAmount < 0) {
        showErrorToast(t('products.messages.warnings.nonNegativeStock'));
        setIsStockSubmitting(false);
        return;
      }
      newStock = adjustmentAmount;
      change = newStock - currentProduct.stock;
    }
    if (change === 0) {
      showWarningToast(t('products.messages.warnings.noStockChange'));
      setIsStockSubmitting(false);
      return;
    }
    const safeProduct = {
      ...currentProduct,
      isAvailable: typeof currentProduct.isAvailable === 'boolean' ? currentProduct.isAvailable : true,
      imageUrl: currentProduct.imageUrl || '/placeholder.png',
      userId: currentProduct.userId || user.uid,
      updatedAt: currentProduct.updatedAt || { seconds: 0, nanoseconds: 0 },
    };
    const updateData = { stock: newStock, isAvailable: safeProduct.isAvailable, imageUrl: safeProduct.imageUrl, userId: safeProduct.userId, updatedAt: { seconds: 0, nanoseconds: 0 } };
    try {
      await updateProduct(currentProduct.id, updateData, user.uid, stockReason, change);
      showSuccessToast(t('products.messages.productUpdated'));
      setCurrentProduct(prev => prev ? { ...prev, stock: newStock } : null);
      setStockAdjustment('');
    } catch (err) {
      showErrorToast(t('products.messages.errors.updateProduct'));
    } finally {
      setIsStockSubmitting(false);
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
  }, [products, stockChanges, user]);

  useEffect(() => {
    setSelectedCategory(t('products.filters.allCategories'));
  }, [i18n.language]);

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
          imageUrl: product.imageUrl || '/placeholder.png',
          userId: product.userId || user.uid,
          updatedAt: product.updatedAt || { seconds: 0, nanoseconds: 0 },
        };
        const updateData = { isAvailable: false, imageUrl: safeProduct.imageUrl, userId: safeProduct.userId, updatedAt: { seconds: 0, nanoseconds: 0 } };
        await updateProduct(id, updateData, user.uid);
      }
      showSuccessToast(t('products.messages.bulkDeleteSuccess', { count: selectedProducts.length }));
      setIsBulkDeleteModalOpen(false);
      setSelectedProducts([]);
      setIsBulkSelection(false);
    } catch (error) {
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
      imageUrl: productToDelete.imageUrl || '/placeholder.png',
      userId: productToDelete.userId || user.uid,
      updatedAt: productToDelete.updatedAt || { seconds: 0, nanoseconds: 0 },
    };
    const updateData = { isAvailable: false, imageUrl: safeProduct.imageUrl, userId: safeProduct.userId, updatedAt: { seconds: 0, nanoseconds: 0 } };
    try {
      setIsDeleting(true);
      await updateProduct(productToDelete.id, updateData, user.uid);
      showSuccessToast(t('products.messages.productDeleted'));
      setIsDeleteModalOpen(false);
      setProductToDelete(null);
    } catch (error) {
      showErrorToast(t('products.messages.errors.deleteProduct'));
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    showErrorToast(t('products.messages.errors.loadProducts'));
    return null;
  }

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
            <Card key={product.id} className="h-full relative">
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
              <div className="flex flex-col h-full">
                <div className="relative pb-[65%] overflow-hidden rounded-md mb-3">
                  <img
                    src={product.imageUrl?.startsWith('data:image') ? product.imageUrl : product.imageUrl ? `data:image/jpeg;base64,${product.imageUrl}` : '/placeholder.png'}
                    alt={product.name}
                    className="absolute h-full w-full object-cover"
                  />
                </div>
                
                <div className="flex-grow">
                  <h3 className="font-medium text-gray-900">{product.name}</h3>
                  <p className="text-sm text-gray-500">{product.reference}</p>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{t('products.table.columns.costPrice')}:</span>
                      <span className="font-medium">{product.costPrice.toLocaleString()} XAF</span>
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
                
                <div className="mt-4 flex justify-end space-x-2">
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
                        <div className="h-10 w-10 flex-shrink-0">
                          <img className="h-10 w-10 rounded-md object-cover" src={product.imageUrl?.startsWith('data:image') ? product.imageUrl : product.imageUrl ? `data:image/jpeg;base64,${product.imageUrl}` : '/placeholder.png'} alt="" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{product.name}</div>
                          <div className="text-sm text-gray-500">{product.reference}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{product.costPrice.toLocaleString()} XAF</div>
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
            onConfirm={handleAddProduct}
            confirmText={t('products.actions.addProduct')}
            isLoading={isSubmitting}
          />
        }
      >
        <div className="space-y-4">
          <Input
            label={t('products.form.name')}
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
          />
          
          <Input
            label={t('products.form.reference')}
            name="reference"
            value={formData.reference}
            onChange={handleInputChange}
            required
          />
          
          <Input
            label={t('products.form.costPrice')}
            name="costPrice"
            type="number"
            value={formData.costPrice}
            onChange={handleInputChange}
            required
          />
          
          <Input
            label={t('products.form.sellingPrice')}
            name="sellingPrice"
            type="number"
            value={formData.sellingPrice}
            onChange={handleInputChange}
            required
            helpText={t('products.form.sellingPriceHelp')}
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('products.form.category')}
            </label>
            <CreatableSelect
              value={formData.category ? { label: formData.category, value: formData.category } : null}
              onChange={handleCategoryChange}
              placeholder={t('products.form.categoryPlaceholder')}
              className="custom-select"
            />
          </div>
          
          <Input
            label={t('products.form.stock')}
            name="stock"
            type="number"
            value={formData.stock}
            onChange={handleInputChange}
            required
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('products.form.image')}
            </label>
            <input
              type="file"
              name="imageFile"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setFormData(prev => ({ ...prev, imageFile: file }));
                }
              }}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-gray-300 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
            <p className="mt-1 text-sm text-gray-500">{t('products.form.imageHelp')}</p>
          </div>
        </div>
      </Modal>
      
      {/* Edit Product Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={t('products.actions.editProduct')}
        footer={
          editTab === 'details' ? (
          <ModalFooter 
            onCancel={() => setIsEditModalOpen(false)}
            onConfirm={handleEditProduct}
            confirmText={t('products.actions.editProduct')}
            isLoading={isSubmitting}
          />
          ) : null
        }
      >
        <div className="mb-4 flex border-b">
          <button onClick={() => setEditTab('details')} className={`px-4 py-2 ${editTab === 'details' ? 'font-bold border-b-2 border-emerald-500' : ''}`}>{t('common.edit')}</button>
          <button onClick={() => setEditTab('stock')} className={`px-4 py-2 ${editTab === 'stock' ? 'font-bold border-b-2 border-emerald-500' : ''}`}>{t('products.table.columns.stock')}</button>
        </div>
        {editTab === 'details' ? (
        <div className="space-y-4">
            <Input label={t('products.form.name')} name="name" value={formData.name} onChange={handleInputChange} required />
            <Input label={t('products.form.reference')} name="reference" value={formData.reference} onChange={handleInputChange} required />
            <Input label={t('products.form.costPrice')} name="costPrice" type="number" value={formData.costPrice} onChange={handleInputChange} required />
            <Input label={t('products.form.sellingPrice')} name="sellingPrice" type="number" value={formData.sellingPrice} onChange={handleInputChange} required helpText={t('products.form.sellingPriceHelp')} />
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('products.form.category')}</label>
              <CreatableSelect value={formData.category ? { label: formData.category, value: formData.category } : null} onChange={handleCategoryChange} placeholder={t('products.form.categoryPlaceholder')} className="custom-select" />
          </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('products.form.image')}</label>
              <input type="file" name="imageFile" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setFormData(prev => ({ ...prev, imageFile: file })); } }} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-gray-300 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200" />
              <p className="mt-1 text-sm text-gray-500">{t('products.form.imageHelp')}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <span className="block text-sm font-medium text-gray-700 mb-1">{currentProduct?.name}</span>
              <span className="block text-xs text-gray-500 mb-2">{t('products.table.columns.stock')}: {currentProduct?.stock}</span>
            </div>
          <Input
              label={stockReason === 'restock' ? t('products.actions.quantityToAdd') : t('products.actions.newTotalStock')}
              name="stockAdjustment" 
            type="number"
              value={stockAdjustment} 
              onChange={e => setStockAdjustment(e.target.value)} 
            required
          />
            <select className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2" value={stockReason} onChange={e => setStockReason(e.target.value as 'restock' | 'adjustment')}>
              <option value="restock">{t('products.actions.restock')}</option>
              <option value="adjustment">{t('products.actions.adjustment')}</option>
            </select>
            <p className="mt-2 text-sm text-gray-500">
              <span className="block mb-2">
                <strong>{t('products.actions.restock')}:</strong> {t('products.actions.restockHelp')}
              </span>
              <span className="block">
                <strong>{t('products.actions.adjustment')}:</strong> {t('products.actions.adjustmentHelp')}
              </span>
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleStockSubmit} isLoading={isStockSubmitting}>{t('common.save')}</Button>
          </div>
            <div className="mt-6">
              <h4 className="font-semibold mb-2">{t('products.actions.stockHistory')}</h4>
              {(stockChanges.filter(sc => sc.productId === currentProduct?.id).length === 0) ? (
                <span className="text-sm text-gray-500">{t('products.messages.noStockHistory')}</span>
              ) : (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left">{t('products.actions.date')}</th>
                      <th className="text-left">{t('products.actions.change')}</th>
                      <th className="text-left">{t('products.actions.reason')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockChanges.filter(sc => sc.productId === currentProduct?.id).map(sc => (
                      <tr key={sc.id}>
                        <td>{sc.createdAt?.seconds ? new Date(sc.createdAt.seconds * 1000).toLocaleString() : ''}</td>
                        <td>{sc.change > 0 ? '+' : ''}{sc.change}</td>
                        <td>{t('products.actions.' + sc.reason)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
                      <option value="category">{t('products.import.fields.category')}</option>
                      <option value="stock">{t('products.import.fields.stock')}</option>
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
    </div>
  );
};

export default Products;