import React, { useState, useEffect } from 'react';
import { PlusCircle, Edit, Trash2, Eye, EyeOff, Search, X, Upload, Image, Filter, ChevronLeft, ChevronRight, Download, ArrowUp, ArrowDown, ArrowUpDown, ChevronRight as ChevronRightIcon } from 'lucide-react';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ImageSuggestions from '../components/ui/ImageSuggestions';
import designSystem from '../designSystem';
import { Category, Dish } from '../types';
import Papa from 'papaparse';
import type { ParseResult } from 'papaparse';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import imageCompression from 'browser-image-compression';
import { useLanguage } from '../contexts/LanguageContext';
import { t } from '../utils/i18n';
import { getCurrencySymbol } from '../data/currencies';
import { toast } from 'react-hot-toast';
import { ImageSuggestion, uploadImage } from '../services/storageService';

type MenuItem = Dish & {
  deleted: boolean;
  [key: string]: any;
};

interface MenuManagementContentProps {
  menuItems: MenuItem[];
  categories: Category[];
  loading: boolean;
  onAdd: (data: Omit<Dish, 'id'> & { [key: string]: any }) => void;
  onEdit: (item: MenuItem, data: any) => void;
  onDelete: (itemId: string) => void;
  onToggleStatus: (item: MenuItem) => void;
  onBulkAction: (action: 'delete' | 'activate' | 'deactivate', itemIds: string[]) => void;
  isDemoUser: boolean;
  restaurantId: string; // <-- add this prop
  onImportComplete?: () => void; // optional callback
  restaurant?: any; // <-- add this prop for currency
}

const initialFormState = {
  title: '',
  price: '',
  description: '',
  categoryId: '',
  status: 'active',
  image: null as File | null,
  imageURL: '',
  imageBase64: '',
  dailyMenu: false,
  // Tracking fields to prevent metadata generation for existing images
  isFromSuggestion: false,
  selectedSuggestionId: null as string | null,
};

const MenuManagementContent: React.FC<MenuManagementContentProps> = ({
  menuItems,
  categories,
  onAdd,
  onEdit,
  onDelete,
  onToggleStatus,
  onBulkAction,
  restaurantId,
  onImportComplete,
  restaurant,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [formData, setFormData] = useState(initialFormState);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [isCSVModalOpen, setIsCSVModalOpen] = useState(false);
  const [csvFile, setCSVFile] = useState<File | null>(null);
  const [csvHeaders, setCSVHeaders] = useState<string[]>([]);
  const [csvRows, setCSVRows] = useState<any[]>([]);
  const [csvMapping, setCSVMapping] = useState<{ [key: string]: string }>({});
  const [csvStep, setCSVStep] = useState<'upload' | 'mapping' | 'importing' | 'done'>('upload');
  const [csvProgress, setCSVProgress] = useState(0);
  const [csvError, setCSVError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<{ total: number; success: number; failed: number; errors: string[] }>({ total: 0, success: 0, failed: 0, errors: [] });
  const [localCategories, setLocalCategories] = useState<Category[]>(categories);
  const [localMenuItems, setLocalMenuItems] = useState<MenuItem[]>(menuItems);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'createdAt' | 'title' | 'price'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const { language } = useLanguage();

  useEffect(() => { setLocalCategories(categories); }, [categories]);
  useEffect(() => { setLocalMenuItems(menuItems); }, [menuItems]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterCategory, searchQuery]);

  // Determine currency symbol
  const currencyCode = restaurant?.currency || 'XAF';
  const currencySymbol = getCurrencySymbol(currencyCode) || 'FCFA';

  const dishFields = [
    { key: 'title', label: t('dish_title', language) + '*' },
    { key: 'price', label: t('dish_price', language) + `* (${currencySymbol})` },
    { key: 'description', label: t('dish_description', language) },
    { key: 'category', label: t('dish_category', language) + '*' },
    { key: 'status', label: t('dish_status', language) + ' (active/inactive)' },
    { key: 'image', label: t('dish_image_url', language) },
  ];

  // Filter out deleted menu items for admin view
  const visibleMenuItems = localMenuItems.filter(item => item.deleted !== true);

  // Helper function to get all subcategory IDs for a given category
  const getSubcategoryIds = (categoryId: string): string[] => {
    const subcategories = localCategories.filter(cat => cat.parentCategoryId === categoryId);
    const subcategoryIds = subcategories.map(cat => cat.id);
    
    // Recursively get subcategories of subcategories
    const nestedSubcategoryIds = subcategories.flatMap(cat => getSubcategoryIds(cat.id));
    
    return [...subcategoryIds, ...nestedSubcategoryIds];
  };

  // Helper function to get category hierarchy display info
  const getCategoryHierarchyInfo = (categoryId: string): { 
    displayName: string; 
    isSubcategory: boolean; 
    parentName?: string; 
    categoryName: string;
  } => {
    const category = localCategories.find(cat => cat.id === categoryId);
    if (!category) return { 
      displayName: t('uncategorized', language), 
      isSubcategory: false, 
      categoryName: t('uncategorized', language)
    };
    
    if (category.parentCategoryId) {
      const parentCategory = localCategories.find(cat => cat.id === category.parentCategoryId);
      if (parentCategory) {
        return {
          displayName: `${parentCategory.title} ${category.title}`,
          isSubcategory: true,
          parentName: parentCategory.title,
          categoryName: category.title
        };
      }
    }
    
    return {
      displayName: category.title,
      isSubcategory: false,
      categoryName: category.title
    };
  };

  // Helper function to organize categories hierarchically for display
  const getHierarchicalCategories = () => {
    const mainCategories = localCategories.filter(cat => !cat.parentCategoryId);
    const result: { id: string; title: string; displayName: string; level: number; isSubcategory: boolean; parentName?: string }[] = [];
    
    mainCategories.forEach(category => {
      // Add main category
      result.push({
        id: category.id,
        title: category.title,
        displayName: category.title,
        level: 0,
        isSubcategory: false
      });
      
      // Add subcategories
      const subcategories = localCategories.filter(cat => cat.parentCategoryId === category.id);
      subcategories.forEach(subcat => {
        result.push({
          id: subcat.id,
          title: subcat.title,
          displayName: `${category.title} ${subcat.title}`,
          level: 1,
          isSubcategory: true,
          parentName: category.title
        });
      });
    });
    
    return result;
  };

  // Filter and search
  const filteredItems = visibleMenuItems.filter(item => {
    let matchesCategory = true;
    
    if (filterCategory) {
      // Check if the item's category matches the filter category directly
      const directMatch = item.categoryId === filterCategory;
      
      // Check if the item's category is a subcategory of the filter category
      const subcategoryIds = getSubcategoryIds(filterCategory);
      const subcategoryMatch = subcategoryIds.includes(item.categoryId);
      
      matchesCategory = directMatch || subcategoryMatch;
    }
    
    const matchesSearch = searchQuery 
      ? item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;
    
    return matchesCategory && matchesSearch;
  });

  // Sort items
  const sortedItems = [...filteredItems].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case 'title':
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
        break;
      case 'price':
        aValue = a.price;
        bValue = b.price;
        break;
      case 'createdAt':
      default:
        aValue = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        bValue = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        break;
    }

    if (sortDirection === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  // Pagination
  const totalPages = Math.ceil(sortedItems.length / itemsPerPage);
  
  // Ensure current page is valid after filtering
  const validCurrentPage = currentPage > totalPages && totalPages > 0 ? 1 : currentPage;
  const startIndex = (validCurrentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = sortedItems.slice(startIndex, endIndex);

  // Modal logic
  const resetForm = () => {
    setFormData(initialFormState);
    setEditingItem(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      price: item.price.toString(),
      description: item.description || '',
      categoryId: item.categoryId,
      status: item.status,
      image: null,
      imageURL: item.image || '',
      imageBase64: '',
      dailyMenu: (item as any).dailyMenu || false,
      // When editing, existing image is considered "from suggestion" to prevent metadata regeneration
      isFromSuggestion: true,
      selectedSuggestionId: null,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsImageUploading(true);
      setImageError(null);
      const file = e.target.files[0];
      console.log('[Image Upload] Original size:', file.size, 'bytes');
      let compressedFile = file;
      if (file.size > 300 * 1024) { // 300KB threshold
        try {
          compressedFile = await imageCompression(file, {
            maxSizeMB: 0.3,
            maxWidthOrHeight: 1024,
            useWebWorker: true,
          });
          console.log('[Image Upload] Compressed size:', compressedFile.size, 'bytes');
        } catch (err) {
          console.error('[Image Compression Error]', err);
          // fallback to original file
          compressedFile = file;
        }
      }
      const base64 = await fileToBase64(compressedFile);
      // Check base64 length (Firestore doc limit is 1MB, be safe and use 900,000 chars)
      if (base64.length > 900000) {
        setImageError('Image is too large to upload. Please choose a smaller image.');
        setIsImageUploading(false);
        return;
      }
      setFormData({
        ...formData,
        image: file,
        imageURL: URL.createObjectURL(compressedFile),
        imageBase64: base64,
        isFromSuggestion: false, // Mark as new upload (will generate metadata)
        selectedSuggestionId: null, // Clear suggestion ID
      });
      
      console.log('[Image Upload] New file selected for upload:', {
        fileName: file.name,
        fileSize: file.size,
        willGenerateMetadata: true // New upload - will generate metadata
      });
      setIsImageUploading(false);
    }
  };

  const removeImage = () => {
    setFormData({
      ...formData,
      image: null,
      imageURL: '',
      imageBase64: '',
    });
  };

  // Handle image selection from suggestions
  const handleImageSuggestionSelect = (imageUrl: string, suggestion: ImageSuggestion) => {
    setFormData({
      ...formData,
      image: null, // Clear file since we're using URL
      imageURL: imageUrl,
      imageBase64: '', // Clear base64 since we're using URL
      isFromSuggestion: true, // Mark that this image is from suggestions (no metadata generation needed)
      selectedSuggestionId: suggestion.id, // Track which suggestion was selected
    });
    
    console.log('[Image Selection] Selected existing image from suggestions:', {
      suggestionId: suggestion.id,
      dishName: suggestion.dishName,
      url: imageUrl,
      willGenerateMetadata: false // Existing image - no metadata generation
    });
    
    toast.success(`${t('image_selected', language) || 'Image selected'}: ${suggestion.dishName || suggestion.originalFileName}`, {
      style: {
        background: designSystem.colors.success,
        color: designSystem.colors.textInverse,
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.price || !formData.categoryId) return;
    const price = parseFloat(formData.price);
    if (isNaN(price) || price <= 0) return;
    const status: 'active' | 'inactive' = formData.status === 'inactive' ? 'inactive' : 'active';
    
    let imageUrl = formData.imageURL || '/icons/placeholder.jpg';
    
    // EXPLICIT LOGIC: Only generate metadata and upload for NEW images (not from suggestions)
    if (formData.image && formData.image instanceof File && !formData.isFromSuggestion) {
      try {
        setIsSubmitting(true);
        const category = categories.find(cat => cat.id === formData.categoryId);
        
        console.log('[Metadata Generation] Uploading NEW image with metadata generation:', {
          fileName: formData.image.name,
          dishName: formData.title.trim(),
          description: formData.description.trim(),
          price,
          category: category?.title,
          isFromSuggestion: formData.isFromSuggestion,
          willGenerateMetadata: true
        });
        
        const uploadResult = await uploadImage(
          formData.image,
          `restaurants/${restaurantId}/dishes`,
          {
            dishName: formData.title.trim(),
            restaurantId,
            type: 'dish',
            originalName: formData.image.name,
            description: formData.description.trim(),
            price,
            category: category?.title
          }
        );
        imageUrl = uploadResult.url;
        console.log('[Image Upload] Successfully uploaded NEW image to Firebase Storage with generated metadata:', uploadResult.url);
      } catch (error) {
        console.error('[Image Upload Error]', error);
        toast.error('Failed to upload image. Using base64 fallback.');
        // Fallback to base64 if upload fails
        imageUrl = formData.imageBase64 || formData.imageURL || '/icons/placeholder.jpg';
      }
    } else if (formData.isFromSuggestion && formData.imageURL) {
      // EXPLICIT LOGIC: Use existing image from suggestions (NO metadata generation)
      console.log('[Existing Image] Using existing image from suggestions (NO metadata generation):', {
        suggestionId: formData.selectedSuggestionId,
        imageUrl: formData.imageURL,
        isFromSuggestion: formData.isFromSuggestion,
        willGenerateMetadata: false
      });
      imageUrl = formData.imageURL;
    } else {
      // EXPLICIT LOGIC: Using existing image URL or fallback
      console.log('[Image Selection] Using existing image or fallback:', {
        imageUrl: formData.imageURL || '/icons/placeholder.jpg',
        isFromSuggestion: formData.isFromSuggestion,
        willGenerateMetadata: false
      });
      imageUrl = formData.imageURL || '/icons/placeholder.jpg';
    }
    
    const data = {
      title: formData.title.trim(),
      price,
      description: formData.description.trim(),
      categoryId: formData.categoryId,
      status,
      image: imageUrl,
      restaurantId,
      createdAt: new Date().toISOString(),
      dailyMenu: formData.dailyMenu,
    };
    
    try {
      if (editingItem) {
        console.log('[Dish Edit] Payload:', data);
        await onEdit(editingItem, data);
      } else {
        console.log('[Dish Add] Payload:', data);
        await onAdd(data);
      }
    } catch (error) {
      console.error('[Dish Submit Error]', error);
    }
    setIsSubmitting(false);
    closeModal();
  };

  // Bulk actions
  const handleSelectItem = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === sortedItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(sortedItems.map(item => item.id));
    }
  };

  const handleBulkAction = (action: 'delete' | 'activate' | 'deactivate') => {
    if (selectedItems.length === 0) return;
    if (action === 'delete') {
      setBulkDeleteConfirmOpen(true);
    } else {
      onBulkAction(action, selectedItems);
      setSelectedItems([]);
    }
  };

  // Pagination controls
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  const handleSort = (field: 'createdAt' | 'title' | 'price') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const renderPagination = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, validCurrentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    // Previous
    pages.push(
      <button
        key="prev"
        onClick={() => handlePageChange(validCurrentPage - 1)}
        disabled={validCurrentPage === 1}
        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronLeft size={20} />
      </button>
    );
    if (startPage > 1) {
      pages.push(
        <button key={1} onClick={() => handlePageChange(1)} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">1</button>
      );
      if (startPage > 2) {
        pages.push(
          <span key="start-ellipsis" className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>
        );
      }
    }
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium ${validCurrentPage === i ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          {i}
        </button>
      );
    }
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push(
          <span key="end-ellipsis" className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>
        );
      }
      pages.push(
        <button key={totalPages} onClick={() => handlePageChange(totalPages)} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">{totalPages}</button>
      );
    }
    pages.push(
      <button
        key="next"
        onClick={() => handlePageChange(validCurrentPage + 1)}
        disabled={validCurrentPage === totalPages}
        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronRight size={20} />
      </button>
    );
    return pages;
  };

  // Component to render category hierarchy with styling
  const CategoryHierarchyDisplay = ({ categoryId }: { categoryId: string }) => {
    const hierarchyInfo = getCategoryHierarchyInfo(categoryId);
    
    if (hierarchyInfo.isSubcategory && hierarchyInfo.parentName) {
      return (
        <div className="flex items-center space-x-1">
          <span className="text-sm font-medium" style={{ color: designSystem.colors.primary }}>
            {hierarchyInfo.parentName}
          </span>
          <ChevronRightIcon size={14} className="text-gray-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
            {hierarchyInfo.categoryName}
          </span>
        </div>
      );
    }
    
    return (
      <div className="text-sm font-medium" style={{ color: designSystem.colors.primary }}>
        {hierarchyInfo.categoryName}
      </div>
    );
  };

  const exportCSVTemplate = () => {
    // Create empty CSV with translated headers
    const headers = [
      t('dish_title', language),
      t('dish_price', language), 
      t('dish_description', language),
      t('dish_category', language),
      t('dish_status', language),
      t('dish_image', language)
    ];
    
    const csvContent = Papa.unparse({
      fields: headers,
      data: [] // Empty data, just headers
    });
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'dishes_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(t('csv_template_downloaded', language), {
      style: {
        background: designSystem.colors.success,
        color: designSystem.colors.textInverse,
      },
    });
  };

  const openCSVModal = () => {
    setIsCSVModalOpen(true);
    setCSVFile(null);
    setCSVHeaders([]);
    setCSVRows([]);
    setCSVMapping({});
    setCSVStep('upload');
    setCSVProgress(0);
    setCSVError(null);
    setImportSummary({ total: 0, success: 0, failed: 0, errors: [] });
  };

  const closeCSVModal = () => {
    setIsCSVModalOpen(false);
    setCSVFile(null);
    setCSVHeaders([]);
    setCSVRows([]);
    setCSVMapping({});
    setCSVStep('upload');
    setCSVProgress(0);
    setCSVError(null);
    setImportSummary({ total: 0, success: 0, failed: 0, errors: [] });
  };

  const handleCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCSVFile(e.target.files[0]);
      Papa.parse(e.target.files[0], {
        header: true,
        skipEmptyLines: true,
        complete: (results: ParseResult<any>) => {
          if (results.errors.length) {
            setCSVError(t('csv_parsing_error', language));
            return;
          }
          const headers = results.meta.fields || [];
          setCSVHeaders(headers);
          setCSVRows(results.data as any[]);
          setCSVStep('mapping');
        },
        error: () => setCSVError(t('csv_parsing_error', language)),
      });
    }
  };

  const handleCSVMappingChange = (field: string, header: string) => {
    setCSVMapping(prev => ({ ...prev, [field]: header }));
  };

  const handleCSVImport = async () => {
    setCSVStep('importing');
    setCSVProgress(0);
    setCSVError(null);
    setImportSummary({ total: csvRows.length, success: 0, failed: 0, errors: [] });
    let createdCategories: { [name: string]: string } = {};
    let updatedCategories = [...localCategories];
    // 1. Create categories if not found (in Firestore)
    const uniqueCategoryNames = Array.from(new Set(csvRows.map(row => row[csvMapping['category']]).filter(Boolean)));
    let totalSteps = uniqueCategoryNames.length + csvRows.length;
    let currentStep = 0;
    for (const categoryName of uniqueCategoryNames) {
      const normalizedCategoryName = categoryName.trim().toLowerCase();
      const existingCategory = updatedCategories.find(c => (c as any).deleted !== true && c.title.trim().toLowerCase() === normalizedCategoryName);
      if (categoryName && !existingCategory && !createdCategories[normalizedCategoryName]) {
        try {
          const docRef = await addDoc(collection(db, 'categories'), {
            title: categoryName,
            status: 'active' as 'active',
            restaurantId,
            order: 0,
            createdAt: serverTimestamp(),
            deleted: false,
          });
          createdCategories[normalizedCategoryName] = docRef.id;
          const newCat = {
            id: docRef.id,
            title: categoryName,
            status: 'active' as 'active',
            restaurantId,
            order: 0,
            createdAt: new Date().toISOString(),
          };
          updatedCategories.push(newCat);
          setLocalCategories(prev => [...prev, newCat]);
        } catch (err) {
          setCSVError(t('failed_create_category', language) + ': ' + categoryName);
          setCSVStep('mapping');
          setImportSummary(prev => ({ ...prev, failed: prev.failed + 1, errors: [...prev.errors, `${t('category', language)}: ${categoryName}`] }));
          return;
        }
      }
      currentStep++;
      setCSVProgress(Math.round((currentStep / totalSteps) * 100));
    }
    // 2. Import dishes
    let success = 0;
    let failed = 0;
    let errors: string[] = [];
    const existingDishTitles = localMenuItems.map(d => d.title.trim().toLowerCase());
    const newDishes: any[] = [];
    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i];
      const dishTitle = row[csvMapping['title']]?.trim().toLowerCase() || '';
      if (existingDishTitles.includes(dishTitle) || newDishes.some(d => d.title.trim().toLowerCase() === dishTitle)) {
        failed++;
        errors.push(t('duplicate_dish_skipped', language) + `: ${row[csvMapping['title']]}`);
        currentStep++;
        setCSVProgress(Math.round((currentStep / totalSteps) * 100));
        continue;
      }
      const categoryName = row[csvMapping['category']];
      const normalizedCategoryName = categoryName ? categoryName.trim().toLowerCase() : '';
      const categoryId = createdCategories[normalizedCategoryName] || (updatedCategories.find(c => (c as any).deleted !== true && c.title.trim().toLowerCase() === normalizedCategoryName)?.id ?? '');
      const rawStatus = (row[csvMapping['status']] || 'active').toString().trim().toLowerCase();
      const status: 'active' | 'inactive' = rawStatus === 'inactive' ? 'inactive' : 'active';
      // Do NOT use MenuItem type here, just use 'any' or inline type
      const dish = {
        title: row[csvMapping['title']] || '',
        price: parseFloat(row[csvMapping['price']] || '0'),
        description: row[csvMapping['description']] || '',
        categoryId,
        status,
        image: row[csvMapping['image']] || '/icons/placeholder.jpg',
        restaurantId,
        deleted: false,
        createdAt: new Date().toISOString(), // optional
      };
      try {
        await onAdd(dish);
        success++;
        newDishes.push(dish);
      } catch (err) {
        failed++;
        errors.push(t('failed_import_dish', language) + `: ${dish.title}`);
      }
      currentStep++;
      setCSVProgress(Math.round((currentStep / totalSteps) * 100));
    }
    // For local state only, add a temporary id to each new dish (not sent to Firestore)
    setLocalMenuItems(prev => [
      ...newDishes.map(dish => ({ ...dish, id: `${Date.now()}_${Math.random()}` })),
      ...prev
    ]);
    setImportSummary({ total: csvRows.length, success, failed, errors });
    setCSVStep('done');
    if (typeof onImportComplete === 'function') onImportComplete();
  };

  return (
    <div className="shadow rounded-lg overflow-hidden" style={{ background: designSystem.colors.white }}>
      <div className="p-4 sm:p-6 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4" style={{ borderColor: designSystem.colors.borderLightGray }}>
        <div>
          <h2 className="text-xl font-semibold" style={{ color: designSystem.colors.primary }}>{t('dishes', language)}</h2>
          <p className="text-sm" style={{ color: designSystem.colors.text }}>{t('manage_your_dishes', language)}</p>
                         <p className="text-xs text-gray-500 mt-1"><span className="font-semibold text-green-600">{localMenuItems.length} {t('active_dishes', language)}</span></p>
        </div>
        <div className="flex flex-row gap-2 items-center">
          <button
            onClick={openAddModal}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium"
            style={{ background: designSystem.colors.primary, color: designSystem.colors.white }}
          >
            <PlusCircle size={16} className="mr-2" /> {t('add_dish', language)}
          </button>
          <button
            onClick={exportCSVTemplate}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium bg-green-600 text-white hover:bg-green-700"
          >
            <Download size={16} className="mr-2" /> {t('export_template', language)}
          </button>
          <button
            onClick={openCSVModal}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
          >
            <Upload size={16} className="mr-2" /> {t('import_csv', language)}
          </button>
        </div>
      </div>
      {/* Search & Filter */}
      <div className="p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} style={{ color: designSystem.colors.iconFiltercolor }} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('search_dishes', language)}
            className="pl-10 block w-full py-3 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-600"
              style={{ color: designSystem.colors.iconFiltercolor }}
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Filter size={18} style={{ color: designSystem.colors.iconFiltercolor }} />
          </div>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="pl-10 block w-full py-3 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
          >
            <option value="">{t('all_categories', language)}</option>
            {getHierarchicalCategories().map(category => (
              <option key={category.id} value={category.id}>
                {category.isSubcategory ? '  → ' : ''}{category.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>
      {/* Bulk Actions */}
      {selectedItems.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-md flex items-center justify-between">
          <div className="text-sm font-medium text-gray-700">
            {selectedItems.length} {t('items_selected', language)}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkAction('activate')}
              className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              disabled={isDeleting}
            >
              <Eye size={14} className="mr-1" /> {t('activate', language)}
            </button>
            <button
              onClick={() => handleBulkAction('deactivate')}
              className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
              disabled={isDeleting}
            >
              <EyeOff size={14} className="mr-1" /> {t('deactivate', language)}
            </button>
            <button
              onClick={() => handleBulkAction('delete')}
              className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
              disabled={isDeleting}
            >
              <Trash2 size={14} className="mr-1" /> {t('delete', language)}
            </button>
      {/* Bulk Delete Confirmation Modal */}
      <Modal isOpen={bulkDeleteConfirmOpen} onClose={() => setBulkDeleteConfirmOpen(false)} title={t('delete_dishes', language)}>
        <div className="p-4">
          <p className="text-gray-800 text-base mb-4">
            {t('delete_dishes_confirm', language)}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setBulkDeleteConfirmOpen(false)}
              className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:w-auto sm:text-sm"
            >
              {t('cancel', language)}
            </button>
            <button
              type="button"
              onClick={() => {
                onBulkAction('delete', selectedItems);
                setSelectedItems([]);
                setBulkDeleteConfirmOpen(false);
              }}
              className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm"
            >
              {t('delete', language)}
            </button>
          </div>
        </div>
      </Modal>
          </div>
        </div>
      )}
      {/* Top Pagination */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-200">
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <p className="text-sm text-gray-700">
              {t('showing_results', language)}
            </p>
            <div className="flex items-center space-x-2">
              <label htmlFor="itemsPerPage" className="text-sm text-gray-700">{t('items_per_page', language)}</label>
              <select
                id="itemsPerPage"
                value={itemsPerPage}
                onChange={handleItemsPerPageChange}
                className="block w-20 py-1 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              {renderPagination()}
            </nav>
          </div>
        </div>
      </div>
      {/* Dishes Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedItems.length > 0 && selectedItems.length === filteredItems.length}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('title')}
                  className="flex items-center space-x-1 hover:text-gray-700 transition-colors"
                >
                  <span>{t('dish_column', language)}</span>
                  {sortField === 'title' ? (
                    sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                  ) : (
                    <ArrowUpDown size={14} className="opacity-50" />
                  )}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('category_column', language)}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('price')}
                  className="flex items-center space-x-1 hover:text-gray-700 transition-colors"
                >
                  <span>{t('price_column', language)}</span>
                  {sortField === 'price' ? (
                    sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                  ) : (
                    <ArrowUpDown size={14} className="opacity-50" />
                  )}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('status_column', language)}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('daily_menu_column', language)}</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('actions_column', language)}</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                  {localMenuItems.length === 0 ? 
                    t('no_dishes_found', language) : 
                    t('no_dishes_match', language)}
                </td>
              </tr>
            ) : (
              currentItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={() => handleSelectItem(item.id)}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        {item.image ? (
                          <img className="h-10 w-10 rounded-full object-cover" src={item.image} alt={item.title} />
                        ) : (
                          <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: designSystem.colors.statusDefaultBg }}>
                            <Image size={20} style={{ color: designSystem.colors.secondary }} />
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium" style={{ color: designSystem.colors.primary }}>{item.title}</div>
                        {item.description && (
                          <div className="text-sm truncate max-w-xs" style={{ color: designSystem.colors.text }}>{item.description}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <CategoryHierarchyDisplay categoryId={item.categoryId} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm" style={{ color: designSystem.colors.primary }}>{item.price.toLocaleString()} {currencySymbol}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                      style={{
                        background: item.status === 'active' ? designSystem.colors.statusReadyBg : designSystem.colors.statusPendingBg,
                        color: item.status === 'active' ? designSystem.colors.statusReadyText : designSystem.colors.statusPendingText
                      }}
                    >
                      {item.status === 'active' ? t('active', language) : t('inactive', language)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.dailyMenu && (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full" style={{ background: designSystem.colors.statusReadyBg, color: designSystem.colors.statusReadyText }}>
                        {t('daily_menu', language)}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => onToggleStatus(item)}
                        title={item.status === 'active' ? t('deactivate', language) : t('activate', language)}
                      >
                        {item.status === 'active' ? <EyeOff size={18} style={{ color: designSystem.colors.secondary }} /> : <Eye size={18} style={{ color: designSystem.colors.secondary }} />}
                      </button>
                      <button
                        onClick={() => openEditModal(item)}
                        title={t('edit', language)}
                      >
                        <Edit size={18} style={{ color: designSystem.colors.secondary }} />
                      </button>
                      <button
                        onClick={() => { setItemToDelete(item); setDeleteConfirmOpen(true); }}
                        title={t('delete', language)}
                      >
                        <Trash2 size={18} style={{ color: designSystem.colors.secondary }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* Bottom Pagination */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <p className="text-sm text-gray-700">
              {t('showing_results', language)}
            </p>
            <div className="flex items-center space-x-2">
              <label htmlFor="itemsPerPageBottom" className="text-sm text-gray-700">{t('items_per_page', language)}</label>
              <select
                id="itemsPerPageBottom"
                value={itemsPerPage}
                onChange={handleItemsPerPageChange}
                className="block w-20 py-1 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              {renderPagination()}
            </nav>
          </div>
        </div>
      </div>
      {/* Add/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingItem ? t('edit_dish', language) : t('add_dish', language)}>
        {/* Field requirements explanation */}
        <div className="mb-3 text-xs text-gray-500">
          <span className="text-red-500">*</span> {t('required_fields', language)} <span className="ml-2">{t('other_fields_optional', language)}</span>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="mb-2">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">{t('dish_title', language)}*</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className="block w-full py-3 px-3 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
              required
            />
          </div>

          {/* Smart Image Suggestions - moved to top */}
          <ImageSuggestions
            restaurantId={restaurantId}
            dishName={formData.title}
            onImageSelect={handleImageSuggestionSelect}
            currentImageUrl={formData.imageURL}
            disabled={isSubmitting || isImageUploading}
          />
          <div className="mb-2">
            <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">{t('dish_price', language)}*</label>
            <div className="relative rounded-md shadow-sm">
              <input
                type="number"
                id="price"
                name="price"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={handleInputChange}
                className="block w-full py-3 px-3 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
                required
              />
              <div className="absolute inset-y-0 right-2 pl-3 pr-6 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">{currencySymbol}</span>
              </div>
            </div>
          </div>
          <div className="mb-2">
            <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700 mb-1">{t('dish_category', language)}*</label>
            <select
              id="categoryId"
              name="categoryId"
              value={formData.categoryId}
              onChange={handleInputChange}
              className="block w-full py-3 px-3 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
              required
            >
              <option value="">{t('select_category', language)}</option>
              {getHierarchicalCategories().map(category => (
                <option key={category.id} value={category.id}>
                  {category.isSubcategory ? '  → ' : ''}{category.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">{t('dish_description', language)}</label>
            <textarea
              id="description"
              name="description"
              rows={3}
              value={formData.description}
              onChange={handleInputChange}
              className="block w-full py-3 px-3 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
            />
          </div>
          <div className="mb-2">
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">{t('dish_status', language)}</label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="block w-full py-3 px-3 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
            >
              <option value="active">{t('active', language)}</option>
              <option value="inactive">{t('inactive', language)}</option>
            </select>
          </div>
          <div className="mb-2">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="dailyMenu"
                name="dailyMenu"
                checked={formData.dailyMenu}
                onChange={(e) => setFormData(prev => ({ ...prev, dailyMenu: e.target.checked }))}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <label htmlFor="dailyMenu" className="ml-2 block text-sm font-medium text-gray-700">
                {t('include_daily_delivery_menu', language)}
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t('daily_delivery_menu_description', language)}
            </p>
          </div>
          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('dish_image', language)}</label>
            <div className="flex items-center">
              {isImageUploading ? (
                <div className="w-24 h-24 flex items-center justify-center">
                  <LoadingSpinner size={36} />
                </div>
              ) : formData.imageURL ? (
                <div className="relative">
                  <img
                    src={formData.imageURL}
                    alt="Dish preview"
                    className="w-24 h-24 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary transition-colors"
                >
                  <Upload size={24} className="text-gray-400" />
                  <span className="mt-2 text-xs text-gray-500">{t('upload_image', language)}</span>
                </label>
              )}
              <input
                id="image-upload"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>
            {imageError && <div className="text-xs text-red-500 mt-2">{imageError}</div>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:w-auto sm:text-sm"
            >
              {t('cancel', language)}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:w-auto sm:text-sm disabled:opacity-50"
            >
              {isSubmitting ? <LoadingSpinner size={20} /> : (editingItem ? t('save_changes', language) : t('add_dish', language))}
            </button>
          </div>
        </form>
      </Modal>
      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title={t('delete_dish', language)} >
        <div className="p-4">
          <p className="text-gray-800 text-base mb-4">{t('delete_dish_confirm', language)}{itemToDelete?.title ? `: ${itemToDelete.title}` : ''}</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(false)}
              className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:w-auto sm:text-sm"
            >
              {t('cancel', language)}
            </button>
            <button
              type="button"
              onClick={() => { if (itemToDelete) { onDelete(itemToDelete.id); setDeleteConfirmOpen(false); setItemToDelete(null); } }}
              className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm"
            >
              {t('delete', language)}
            </button>
          </div>
        </div>
      </Modal>
      {/* CSV Import Modal */}
      <Modal isOpen={isCSVModalOpen} onClose={closeCSVModal} title={t('import_dishes_csv', language)}>
        {csvStep === 'upload' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-blue-400 rounded-lg p-6 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer relative w-full max-w-md mx-auto"
              onClick={() => document.getElementById('csv-upload-input')?.click()}
              tabIndex={0}
              onKeyPress={e => { if (e.key === 'Enter') document.getElementById('csv-upload-input')?.click(); }}
              role="button"
              aria-label={t('upload_csv_file', language)}
            >
              <Upload size={36} className="text-blue-500 mb-2" />
              <span className="text-base font-medium text-blue-700">{t('click_or_drag_csv', language)}</span>
              <span className="text-xs text-blue-500 mt-1">{t('only_csv_supported', language)}</span>
              <input
                id="csv-upload-input"
                type="file"
                accept=".csv"
                onChange={handleCSVFileChange}
                className="hidden"
              />
              {csvFile && (
                <div className="mt-4 flex items-center gap-2 bg-white px-3 py-2 rounded shadow border border-gray-200">
                  <span className="text-sm text-gray-700">{csvFile.name}</span>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setCSVFile(null); setCSVHeaders([]); setCSVRows([]); setCSVMapping({}); setCSVStep('upload'); }}
                    className="ml-2 text-red-500 hover:text-red-700"
                    aria-label={t('remove_file', language)}
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
            </div>
            {csvError && <div className="text-red-500 text-sm text-center">{csvError}</div>}
          </div>
        )}
        {csvStep === 'mapping' && (
          <div className="space-y-4">
            <div className="text-sm text-gray-700">{t('map_csv_columns', language)}</div>
            {dishFields.map(field => (
              <div key={field.key} className="flex items-center gap-2">
                <label className="w-40 text-gray-700">{field.label}</label>
                <select
                  value={csvMapping[field.key] || ''}
                  onChange={e => handleCSVMappingChange(field.key, e.target.value)}
                  className="block w-60 py-2 px-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
                >
                  <option value="">-- {t('not_mapped', language)} --</option>
                  {csvHeaders.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>
            ))}
            <button
              onClick={handleCSVImport}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium bg-green-600 text-white hover:bg-green-700"
              disabled={!csvMapping['title'] || !csvMapping['price'] || !csvMapping['category']}
            >
              {t('start_import', language)}
            </button>
          </div>
        )}
        {csvStep === 'importing' && (
          <div className="space-y-4">
            <div className="text-sm text-gray-700">{t('importing_dishes_wait', language)}</div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                style={{ width: `${csvProgress}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-500">{csvProgress}% {t('complete', language)}</div>
          </div>
        )}
        {csvStep === 'done' && (
          <div className="space-y-4">
            <div className="text-green-600 text-sm font-medium">{t('import_complete', language)}</div>
            <div className="text-sm text-gray-700">
              <div>{t('total_rows_processed', language)} <b>{importSummary.total}</b></div>
              <div>{t('successfully_imported', language)} <b>{importSummary.success}</b></div>
              <div>{t('skipped_failed', language)} <b>{importSummary.failed}</b></div>
              {importSummary.errors.length > 0 && (
                <ul className="mt-2 text-xs text-red-500 list-disc list-inside">
                  {importSummary.errors.map((err, idx) => <li key={idx}>{err}</li>)}
                </ul>
              )}
            </div>
            <button
              onClick={closeCSVModal}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium bg-primary text-white hover:bg-primary-dark"
            >
              {t('close', language)}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MenuManagementContent; 