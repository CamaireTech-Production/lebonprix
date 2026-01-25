import React, { useState, useEffect } from 'react';
import { PlusCircle, Edit, Trash2, Eye, EyeOff, Search, X, Layers, ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import designSystem from '../designSystem';
import { t } from '../utils/i18n';
import { useLanguage } from '../contexts/LanguageContext';

// This file will contain the shared UI for category management, similar to DashboardContent.
// It will receive props for categories, CRUD handlers, loading, and user type (demo or restaurant).

interface CategoryManagementContentProps {
  categories: any[];
  loading: boolean;
  onAdd: (data: any) => void;
  onEdit: (category: any, data: any) => void;
  onDelete: (categoryId: string) => void;
  onToggleStatus: (category: any) => void;
  isDemoUser: boolean;
  menuItems?: any[];
}



const initialFormState = { title: '', status: 'active', order: 0, parentCategoryId: '' };

const CategoryManagementContent: React.FC<CategoryManagementContentProps> = ({
  categories,
  loading,
  onAdd,
  onEdit,
  onDelete,
  onToggleStatus,
  menuItems,
}) => {

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [formData, setFormData] = useState(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'title' | 'order' | 'createdAt'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<any | null>(null);
  // Filter out deleted categories for admin view
  const visibleCategories = categories;
  
  // Calculate main categories and subcategories
  const mainCategories = visibleCategories.filter(category => !category.parentCategoryId);
  const subCategories = visibleCategories.filter(category => category.parentCategoryId);
  
  // Search, sort, and pagination logic
  const filteredCategories = visibleCategories.filter(category =>
    category.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSort = (field: 'title' | 'order' | 'createdAt') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedCategories = React.useMemo(() => {
    return [...filteredCategories].sort((a, b) => {
      if (sortField === 'title') {
        return sortDirection === 'asc'
          ? a.title.localeCompare(b.title)
          : b.title.localeCompare(a.title);
      } else if (sortField === 'createdAt') {
        const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
        const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
        if (dateA.getTime() === dateB.getTime()) {
          return sortDirection === 'asc'
            ? a.title.localeCompare(b.title)
            : b.title.localeCompare(a.title);
        }
        return sortDirection === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
      } else {
        const orderA = a.order || 0;
        const orderB = b.order || 0;
        if (orderA === orderB) {
          return sortDirection === 'asc'
            ? a.title.localeCompare(b.title)
            : b.title.localeCompare(a.title);
        }
        return sortDirection === 'asc' ? orderA - orderB : orderB - orderA;
      }
    });
  }, [filteredCategories, sortField, sortDirection]);

  // Accordion state for expanded main category
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  // Main categories for pagination (using sorted categories)
  const sortedMainCategories = sortedCategories.filter(cat => !cat.parentCategoryId);
  const totalPages = Math.ceil(sortedMainCategories.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentMainCategories = sortedMainCategories.slice(startIndex, endIndex);

  // Helper: build tree structure for categories
  const buildCategoryTree = (mainCats: any[], allCats: any[]) => {
    const map = new Map();
    allCats.forEach(cat => map.set(cat.id, { ...cat, children: [] }));
    mainCats.forEach(main => {
      map.set(main.id, { ...main, children: [] });
    });
    map.forEach(cat => {
      if (cat.parentCategoryId && map.has(cat.parentCategoryId)) {
        map.get(cat.parentCategoryId).children.push(cat);
      }
    });
    return currentMainCategories.map(main => map.get(main.id));
  };
  const categoryTree = buildCategoryTree(currentMainCategories, sortedCategories);

  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Helper to count dishes for a category
  const getDishCount = (catId: string) => {
    if (!menuItems) return 0;
    // If parent category, sum its own dishes and all its subcategories' dishes
    const cat = categories.find((c: any) => c.id === catId);
    if (cat && !cat.parentCategoryId) {
      // Parent: sum own + all subcategories
      const own = menuItems.filter(item => item.categoryId === catId).length;
      const subcats = categories.filter((c: any) => c.parentCategoryId === catId);
      const subcatDishes = subcats.reduce((sum: number, subcat: any) => sum + menuItems.filter(item => item.categoryId === subcat.id).length, 0);
      return own + subcatDishes;
    }
    // Subcategory: just its own
    return menuItems.filter(item => item.categoryId === catId).length;
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  const renderPagination = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    // Previous
    pages.push(
      <button
        key="prev"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
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
          className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium ${currentPage === i ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
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
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronRight size={20} />
      </button>
    );
    return pages;
  };

  const openAddModal = () => {
    setEditingCategory(null);
    setFormData(initialFormState);
    setIsModalOpen(true);
  };
  const openEditModal = (category: any) => {
    setEditingCategory(category);
    setFormData({
      title: category.title,
      status: category.status,
      order: category.order || 0,
      parentCategoryId: category.parentCategoryId || '',
    });
    setIsModalOpen(true);
  };
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setFormData(initialFormState);
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: name === 'order' ? Number(value) : value });
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (editingCategory) {
      await onEdit(editingCategory, formData);
    } else {
      await onAdd(formData);
    }
    setIsSubmitting(false);
    closeModal();
  };

  const { language } = useLanguage();

  return (
    <div className="shadow rounded-lg overflow-hidden" style={{ background: designSystem.colors.white }}>
      <div className="p-4 sm:p-6 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4" style={{ borderColor: designSystem.colors.borderLightGray }}>
        <div>
          <h2 className="text-xl font-semibold" style={{ color: designSystem.colors.primary }}>{t('categories', language)}</h2>
          <p className="text-sm" style={{ color: designSystem.colors.text }}>{t('manage_your_categories', language)}</p>
                         <p className="text-xs text-gray-500 mt-1"><span className="font-semibold text-purple-600">{mainCategories.length} {t('main_categories', language)}</span>, <span className="font-semibold text-indigo-600">{subCategories.length} {t('subcategories', language)}</span></p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium"
          style={{ background: designSystem.colors.primary, color: designSystem.colors.white }}
        >
          <PlusCircle size={16} className="mr-2" style={{ color: designSystem.colors.white }} /> {t('add_category', language)}
        </button>
      </div>
      {/* Search */}
      <div className="p-4">
        <div className="relative max-w-xs mb-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} style={{ color: designSystem.colors.iconFiltercolor }} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('search_categories', language)}
                              className="pl-10 block w-full py-3 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
            style={{ color: designSystem.colors.text }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              style={{ color: designSystem.colors.secondary }}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

        {/* Top Pagination */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-200">
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <p className="text-sm text-gray-700">
              {t('showing_results', language)} <span className="font-medium">{startIndex + 1}</span> to{' '}
              <span className="font-medium">{Math.min(endIndex, sortedMainCategories.length)}</span>{' '}
              {t('of_results', language)} <span className="font-medium">{sortedMainCategories.length}</span>
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

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead style={{ background: designSystem.colors.statusDefaultBg }}>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: designSystem.colors.text }}>
                <button
                  onClick={() => handleSort('title')}
                  className="flex items-center space-x-1"
                  style={{ color: designSystem.colors.primary }}
                >
                  <span>{t('category_title', language)}</span>
                  {sortField === 'title' ? (
                    sortDirection === 'asc' ? <ArrowUp size={14} style={{ color: designSystem.colors.primary }} /> : <ArrowDown size={14} style={{ color: designSystem.colors.primary }} />
                  ) : (
                    <ArrowUpDown size={14} style={{ color: designSystem.colors.primary }} />
                  )}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: designSystem.colors.text }}>
                <button
                  onClick={() => handleSort('order')}
                  className="flex items-center space-x-1"
                  style={{ color: designSystem.colors.primary }}
                >
                  <span>{t('display_order', language)}</span>
                  {sortField === 'order' ? (
                    sortDirection === 'asc' ? <ArrowUp size={14} style={{ color: designSystem.colors.primary }} /> : <ArrowDown size={14} style={{ color: designSystem.colors.primary }} />
                  ) : (
                    <ArrowUpDown size={14} style={{ color: designSystem.colors.primary }} />
                  )}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: designSystem.colors.text }}>
                <button
                  onClick={() => handleSort('createdAt')}
                  className="flex items-center space-x-1"
                  style={{ color: designSystem.colors.primary }}
                >
                  <span>{t('date', language)}</span>
                  {sortField === 'createdAt' ? (
                    sortDirection === 'asc' ? <ArrowUp size={14} style={{ color: designSystem.colors.primary }} /> : <ArrowDown size={14} style={{ color: designSystem.colors.primary }} />
                  ) : (
                    <ArrowUpDown size={14} style={{ color: designSystem.colors.primary }} />
                  )}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: designSystem.colors.text }}>
                {t('dish_count', language)}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: designSystem.colors.text }}>{t('status_column', language)}</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: designSystem.colors.text }}>{t('actions_column', language)}</th>
            </tr>
          </thead>
          <tbody style={{ background: designSystem.colors.white }}>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center" style={{ color: designSystem.colors.text }}>
                  <LoadingSpinner size={40} />
                </td>
              </tr>
            ) : currentMainCategories.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center" style={{ color: designSystem.colors.text }}>
                  {visibleCategories.length === 0 ? t('no_categories_found', language) : t('no_categories_match', language)}
                </td>
              </tr>
            ) : (
              // Render tree structure with accordion
              categoryTree.map((category) => (
                <React.Fragment key={category.id}>
                  <tr
                    style={{ background: designSystem.colors.white, cursor: category.children.length > 0 ? 'pointer' : 'default' }}
                    className={`hover:bg-gray-50 ${expandedCategoryId === category.id ? 'bg-gray-50' : ''}`}
                    onClick={() => setExpandedCategoryId(expandedCategoryId === category.id ? null : category.id)}
                  >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full" style={{ background: designSystem.colors.statusDefaultBg }}>
                        <Layers size={20} style={{ color: designSystem.colors.secondary }} />
                      </div>
                        <div className="ml-4 flex items-center gap-2">
                        <div className="text-sm font-medium" style={{ color: designSystem.colors.primary }}>{category.title}</div>
                          {category.children.length > 0 && (
                            <span className="ml-2 flex items-center">
                              {expandedCategoryId === category.id ? (
                                <ChevronDown size={18} style={{ color: designSystem.colors.secondary }} />
                              ) : (
                                <ChevronRight size={18} style={{ color: designSystem.colors.secondary }} />
                              )}
                            </span>
                          )}
                        </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm" style={{ color: designSystem.colors.primary }}>{category.order || 0}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm" style={{ color: designSystem.colors.primary }}>
                      {category.createdAt ? (
                        (category.createdAt.toDate ? category.createdAt.toDate() : new Date(category.createdAt)).toLocaleDateString()
                      ) : '-'}
                    </div>
                  </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm" style={{ color: designSystem.colors.primary }}>{getDishCount(category.id)}</div>
                    </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                      style={{
                        background: category.status === 'active' ? designSystem.colors.statusReadyBg : designSystem.colors.statusPendingBg,
                        color: category.status === 'active' ? designSystem.colors.statusReadyText : designSystem.colors.statusPendingText,
                      }}
                    >
                      {category.status === 'active' ? t('active', language) : t('inactive', language)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                          onClick={e => { e.stopPropagation(); onToggleStatus(category); }}
                        title={category.status === 'active' ? t('deactivate', language) : t('activate', language)}
                        style={{ color: designSystem.colors.secondary }}
                      >
                        {category.status === 'active' ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                      <button
                          onClick={e => { e.stopPropagation(); openEditModal(category); }}
                          title={t('edit', language)}
                          style={{ color: designSystem.colors.secondary }}
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setCategoryToDelete(category); setDeleteConfirmOpen(true); }}
                          title={t('delete', language)}
                          style={{ color: designSystem.colors.secondary }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Accordion: Render subcategories only if expanded */}
                  {expandedCategoryId === category.id && category.children && category.children.map((subcat: any) => (
                    <tr key={subcat.id} style={{ background: designSystem.colors.white }} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center ml-8">
                          <span className="mr-2">└</span>
                          <div className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-full" style={{ background: designSystem.colors.statusDefaultBg }}>
                            <Layers size={18} style={{ color: designSystem.colors.secondary }} />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium" style={{ color: designSystem.colors.primary }}>{subcat.title}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm" style={{ color: designSystem.colors.primary }}>{subcat.order || 0}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm" style={{ color: designSystem.colors.primary }}>
                          {subcat.createdAt ? (
                            (subcat.createdAt.toDate ? subcat.createdAt.toDate() : new Date(subcat.createdAt)).toLocaleDateString()
                          ) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm" style={{ color: designSystem.colors.primary }}>{getDishCount(subcat.id)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                          style={{
                            background: subcat.status === 'active' ? designSystem.colors.statusReadyBg : designSystem.colors.statusPendingBg,
                            color: subcat.status === 'active' ? designSystem.colors.statusReadyText : designSystem.colors.statusPendingText,
                          }}
                        >
                          {subcat.status === 'active' ? t('active', language) : t('inactive', language)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={e => { e.stopPropagation(); onToggleStatus(subcat); }}
                            title={subcat.status === 'active' ? t('deactivate', language) : t('activate', language)}
                            style={{ color: designSystem.colors.secondary }}
                          >
                            {subcat.status === 'active' ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); openEditModal(subcat); }}
                        title={t('edit', language)}
                        style={{ color: designSystem.colors.secondary }}
                      >
                        <Edit size={18} />
                      </button>
                      <button
                            onClick={e => { e.stopPropagation(); setCategoryToDelete(subcat); setDeleteConfirmOpen(true); }}
                        title={t('delete', language)}
                        style={{ color: designSystem.colors.secondary }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
                  ))}
                </React.Fragment>
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
              {t('showing_results', language)} <span className="font-medium">{startIndex + 1}</span> to{' '}
              <span className="font-medium">{Math.min(endIndex, sortedMainCategories.length)}</span>{' '}
              {t('of_results', language)} <span className="font-medium">{sortedMainCategories.length}</span>
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
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingCategory ? t('edit_category', language) : t('add_category', language)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">{t('category_title', language)}*</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className="mt-1 block w-full py-3 px-3 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">{t('status_column', language)}</label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="mt-1 block w-full py-3 px-3 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
            >
              <option value="active">{t('active', language)}</option>
              <option value="inactive">{t('inactive', language)}</option>
            </select>
          </div>
          <div>
            <label htmlFor="order" className="block text-sm font-medium text-gray-700">{t('display_order', language)}</label>
            <input
              type="number"
              id="order"
              name="order"
              min="0"
              value={formData.order}
              onChange={handleInputChange}
              className="mt-1 block w-full py-3 px-3 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">{t('display_order_hint', language)}</p>
          </div>
          <div>
            <label htmlFor="parentCategoryId" className="block text-sm font-medium text-gray-700">{t('parent_category', language)}</label>
            <select
              id="parentCategoryId"
              name="parentCategoryId"
              value={formData.parentCategoryId}
              onChange={handleInputChange}
              className="mt-1 block w-full py-3 px-3 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
            >
              <option value="">{t('none', language)}</option>
              {visibleCategories
                .filter(cat => !editingCategory || cat.id !== editingCategory.id)
                .filter(cat => !cat.parentCategoryId)
                .map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.title}</option>
                ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">{t('parent_category_hint', language)}</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:w-auto sm:text-sm"
              disabled={isSubmitting}
            >
              {t('cancel', language)}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:w-auto sm:text-sm disabled:opacity-50"
            >
              {isSubmitting ? t('saving', language) : (editingCategory ? t('save_changes', language) : t('add_category', language))}
            </button>
          </div>
        </form>
      </Modal>
      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title={t('delete_category', language)}>
        <div className="p-4">
          <p className="text-gray-800 text-base mb-4">{t('delete_category_confirm', language)} <span className="font-semibold">{categoryToDelete?.title}</span> {t('delete_category_confirm_note', language)}</p>
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
              onClick={() => { if (categoryToDelete) { onDelete(categoryToDelete.id); setDeleteConfirmOpen(false); setCategoryToDelete(null); } }}
              className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm"
            >
              {t('delete', language)}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CategoryManagementContent;
