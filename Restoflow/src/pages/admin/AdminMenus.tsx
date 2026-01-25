import React, { useEffect, useState } from 'react';
import AdminDashboardLayout from '../../components/layout/AdminDashboardLayout';
import { getFirestore, collection, getDocs, orderBy, query, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { logActivity } from '../../services/activityLogService';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import designSystem from '../../designSystem';
import { Pencil, Trash2, RotateCcw, Eye } from 'lucide-react';

const PAGE_SIZE = 10;

const AdminMenus: React.FC = () => {
  const db = getFirestore();
  const { currentAdmin } = useAdminAuth();
  const [dishes, setDishes] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any>({});
  const [loading, setLoading] = useState(true);
  // Filtering and pagination state
  const [selectedRestaurant, setSelectedRestaurant] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [dishSortField, setDishSortField] = useState('title');
  const [dishSortDirection, setDishSortDirection] = useState<'asc' | 'desc'>('asc');
  // Pagination state (refactored)
  const [dishPage, setDishPage] = useState(1);
  const [dishItemsPerPage, setDishItemsPerPage] = useState(10);
  const [catPage, setCatPage] = useState(1);
  // Dish action handlers
  const [dishAction, setDishAction] = useState<null | { type: 'delete' | 'restore'; dish: any }>(null);
  const [categoryAction, setCategoryAction] = useState<null | { type: 'delete' | 'restore'; category: any }>(null);
  const [dishesLoading, setDishesLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Fetch all restaurants and build a map
        const restaurantsSnap = await getDocs(query(collection(db, 'restaurants')));
        const restaurantMap: Record<string, any> = {};
        restaurantsSnap.docs.forEach(doc => {
          restaurantMap[doc.id] = doc.data();
        });
        setRestaurants(restaurantMap);
        // Fetch all categories
        const categoriesSnap = await getDocs(query(collection(db, 'categories'), orderBy('title')));
        const allCategories = categoriesSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setCategories(allCategories);
        // Fetch all dishes
        const dishesSnap = await getDocs(query(collection(db, 'menuItems'), orderBy('title')));
        const allDishes = dishesSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setDishes(allDishes);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [db]);

  const getCategoryName = (categoryId: string) => categories.find((c: any) => c.id === categoryId)?.title || '—';
  const getRestaurantName = (restaurantId: string) => restaurants[restaurantId]?.name || '—';

  // Filtering
  const filteredDishes = dishes.filter(dish => {
    const matchRestaurant = selectedRestaurant === 'all' || dish.restaurantId === selectedRestaurant;
    const matchCategory = selectedCategory === 'all' || dish.categoryId === selectedCategory;
    return matchRestaurant && matchCategory;
  });

  // Sorting
  const sortedDishes = [...filteredDishes].sort((a, b) => {
    let aValue = a[dishSortField];
    let bValue = b[dishSortField];
    if (dishSortField === 'price') {
      aValue = Number(aValue);
      bValue = Number(bValue);
    }
    if (aValue < bValue) return dishSortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return dishSortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination for dishes (refactored)
  const dishTotalPages = Math.ceil(sortedDishes.length / dishItemsPerPage);
  const dishStartIndex = (dishPage - 1) * dishItemsPerPage;
  const dishEndIndex = dishStartIndex + dishItemsPerPage;
  const paginatedDishes = sortedDishes.slice(dishStartIndex, dishEndIndex);

  // Pagination for categories
  const catTotalPages = Math.ceil(categories.length / PAGE_SIZE);
  const paginatedCategories = categories.slice((catPage - 1) * PAGE_SIZE, catPage * PAGE_SIZE);

  const handleDishSort = (field: string) => {
    if (dishSortField === field) {
      setDishSortDirection(dishSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setDishSortField(field);
      setDishSortDirection('asc');
    }
  };

  // Pagination controls (refactored)
  const handleDishPageChange = (page: number) => {
    setDishPage(page);
  };
  const handleDishItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDishItemsPerPage(Number(e.target.value));
    setDishPage(1);
  };
  const renderDishPagination = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, dishPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(dishTotalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    // Previous
    pages.push(
      <button
        key="prev"
        onClick={() => handleDishPageChange(dishPage - 1)}
        disabled={dishPage === 1}
        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {'<'}
      </button>
    );
    if (startPage > 1) {
      pages.push(
        <button key={1} onClick={() => handleDishPageChange(1)} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">1</button>
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
          onClick={() => handleDishPageChange(i)}
          className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium ${dishPage === i ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          {i}
        </button>
      );
    }
    if (endPage < dishTotalPages) {
      if (endPage < dishTotalPages - 1) {
        pages.push(
          <span key="end-ellipsis" className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>
        );
      }
      pages.push(
        <button key={dishTotalPages} onClick={() => handleDishPageChange(dishTotalPages)} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">{dishTotalPages}</button>
      );
    }
    pages.push(
      <button
        key="next"
        onClick={() => handleDishPageChange(dishPage + 1)}
        disabled={dishPage === dishTotalPages}
        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {'>'}
      </button>
    );
    return pages;
  };

  // Dish action handlers
  const handleDishAction = async (type: 'delete' | 'restore', dish: any) => {
    setDishesLoading(true);
    try {
      const ref = doc(db, 'menuItems', dish.id);
      if (type === 'delete') {
        await updateDoc(ref, { deleted: true, updatedAt: serverTimestamp() });
        setDishes(prev => prev.map(d => d.id === dish.id ? { ...d, deleted: true } : d));
        await logActivity({
          userId: currentAdmin?.id,
          userEmail: currentAdmin?.email,
          action: 'admin_delete_dish',
          entityType: 'dish',
          entityId: dish.id,
          details: { title: dish.title, role: 'admin' },
        });
        toast('Dish deleted.', {
          style: {
            background: designSystem.colors.white,
            color: designSystem.colors.primary,
            border: `1px solid ${designSystem.colors.error}`,
            fontWeight: 500,
          },
          icon: '❌',
        });
      } else if (type === 'restore') {
        await updateDoc(ref, { deleted: false, updatedAt: serverTimestamp() });
        setDishes(prev => prev.map(d => d.id === dish.id ? { ...d, deleted: false } : d));
        await logActivity({
          userId: currentAdmin?.id,
          userEmail: currentAdmin?.email,
          action: 'admin_restore_dish',
          entityType: 'dish',
          entityId: dish.id,
          details: { title: dish.title, role: 'admin' },
        });
        toast('Dish restored.', {
          style: {
            background: designSystem.colors.white,
            color: designSystem.colors.primary,
            border: `1px solid ${designSystem.colors.success}`,
            fontWeight: 500,
          },
          icon: '✅',
        });
      }
    } catch (err) {
      toast('Action failed. Please try again.', {
        style: {
          background: designSystem.colors.white,
          color: designSystem.colors.primary,
          border: `1px solid ${designSystem.colors.error}`,
          fontWeight: 500,
        },
        icon: '❌',
      });
    } finally {
      setDishesLoading(false);
      setDishAction(null);
    }
  };
  // Category action handlers
  const handleCategoryAction = async (type: 'delete' | 'restore', category: any) => {
    setCategoriesLoading(true);
    try {
      const ref = doc(db, 'categories', category.id);
      if (type === 'delete') {
        await updateDoc(ref, { deleted: true, updatedAt: serverTimestamp() });
        setCategories(prev => prev.map(c => c.id === category.id ? { ...c, deleted: true } : c));
        await logActivity({
          userId: currentAdmin?.id,
          userEmail: currentAdmin?.email,
          action: 'admin_delete_category',
          entityType: 'category',
          entityId: category.id,
          details: { title: category.title, role: 'admin' },
        });
        toast('Category deleted.', {
          style: {
            background: designSystem.colors.white,
            color: designSystem.colors.primary,
            border: `1px solid ${designSystem.colors.error}`,
            fontWeight: 500,
          },
          icon: '❌',
        });
      } else if (type === 'restore') {
        await updateDoc(ref, { deleted: false, updatedAt: serverTimestamp() });
        setCategories(prev => prev.map(c => c.id === category.id ? { ...c, deleted: false } : c));
        await logActivity({
          userId: currentAdmin?.id,
          userEmail: currentAdmin?.email,
          action: 'admin_restore_category',
          entityType: 'category',
          entityId: category.id,
          details: { title: category.title, role: 'admin' },
        });
        toast('Category restored.', {
          style: {
            background: designSystem.colors.white,
            color: designSystem.colors.primary,
            border: `1px solid ${designSystem.colors.success}`,
            fontWeight: 500,
          },
          icon: '✅',
        });
      }
    } catch (err) {
      toast('Action failed. Please try again.', {
        style: {
          background: designSystem.colors.white,
          color: designSystem.colors.primary,
          border: `1px solid ${designSystem.colors.error}`,
          fontWeight: 500,
        },
        icon: '❌',
      });
    } finally {
      setCategoriesLoading(false);
      setCategoryAction(null);
    }
  };

  const renderDishRow = (dish: any, idx: number) => (
    <tr
      key={dish.id || idx}
      className={`hover:bg-gray-50 transition border-b last:border-none ${dish.deleted ? 'opacity-60' : ''}`}
    >
      <td className="px-6 py-4 whitespace-nowrap">
        {dish.image ? (
          <img src={dish.image} alt={dish.title} className="w-12 h-12 object-cover rounded" />
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap font-medium text-primary">{dish.title || '—'}</td>
      <td className="px-6 py-4 whitespace-nowrap text-right">{dish.price ? `${dish.price} FCFA` : '—'}</td>
      <td className="px-6 py-4 whitespace-nowrap">{getCategoryName(dish.categoryId)}</td>
      <td className="px-6 py-4 whitespace-nowrap">{getRestaurantName(dish.restaurantId)}</td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${dish.deleted ? 'bg-red-100 text-red-800' : dish.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{dish.deleted ? 'Deleted' : dish.status === 'active' ? 'Active' : 'Inactive'}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className="flex justify-end space-x-2">
          <button title="View Details" className="p-2 rounded hover:bg-blue-100 transition text-blue-600"><Eye size={18} /></button>
          {!dish.deleted && (
            <button title="Edit" className="p-2 rounded hover:bg-green-100 transition text-green-600"><Pencil size={18} /></button>
          )}
          {!dish.deleted && (
            <button title="Delete" onClick={() => setDishAction({ type: 'delete', dish })} className="p-2 rounded hover:bg-red-100 transition"><Trash2 size={18} className="text-red-600" /></button>
          )}
          {dish.deleted && (
            <button title="Restore" onClick={() => setDishAction({ type: 'restore', dish })} className="p-2 rounded hover:bg-blue-100 transition"><RotateCcw size={18} className="text-blue-600" /></button>
          )}
        </div>
      </td>
    </tr>
  );

  const renderCategoryRow = (cat: any, idx: number) => (
    <tr
      key={cat.id || idx}
      className={`hover:bg-gray-50 transition border-b last:border-none ${cat.deleted ? 'opacity-60' : ''}`}
    >
      <td className="px-6 py-4 whitespace-nowrap font-medium text-primary">{cat.title || '—'}</td>
      <td className="px-6 py-4 whitespace-nowrap">{getRestaurantName(cat.restaurantId)}</td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${cat.deleted ? 'bg-red-100 text-red-800' : cat.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{cat.deleted ? 'Deleted' : cat.status === 'active' ? 'Active' : 'Inactive'}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className="flex justify-end space-x-2">
          <button title="Edit" className="p-2 rounded hover:bg-green-100 transition text-green-600"><Pencil size={18} /></button>
          {!cat.deleted && (
            <button title="Delete" onClick={() => setCategoryAction({ type: 'delete', category: cat })} className="p-2 rounded hover:bg-red-100 transition"><Trash2 size={18} className="text-red-600" /></button>
          )}
          {cat.deleted && (
            <button title="Restore" onClick={() => setCategoryAction({ type: 'restore', category: cat })} className="p-2 rounded hover:bg-blue-100 transition"><RotateCcw size={18} className="text-blue-600" /></button>
          )}
        </div>
      </td>
    </tr>
  );

  // 1. Split categories into active and deleted
  const activeCategories = categories.filter((cat: any) => !cat.deleted);
  const deletedCategories = categories.filter((cat: any) => cat.deleted);
  // 2. Pagination state for each
  const [activeCatPage, setActiveCatPage] = useState(1);
  const [activeCatItemsPerPage, setActiveCatItemsPerPage] = useState(10);
  const [deletedCatPage, setDeletedCatPage] = useState(1);
  const [deletedCatItemsPerPage, setDeletedCatItemsPerPage] = useState(10);
  const activeCatTotalPages = Math.ceil(activeCategories.length / activeCatItemsPerPage);
  const deletedCatTotalPages = Math.ceil(deletedCategories.length / deletedCatItemsPerPage);
  const activeCatStartIndex = (activeCatPage - 1) * activeCatItemsPerPage;
  const activeCatEndIndex = activeCatStartIndex + activeCatItemsPerPage;
  const deletedCatStartIndex = (deletedCatPage - 1) * deletedCatItemsPerPage;
  const deletedCatEndIndex = deletedCatStartIndex + deletedCatItemsPerPage;
  const paginatedActiveCategories = activeCategories.slice(activeCatStartIndex, activeCatEndIndex);
  const paginatedDeletedCategories = deletedCategories.slice(deletedCatStartIndex, deletedCatEndIndex);
  // 3. Render tree for each
  const renderCategoryTree = (cats: any[], parentId: string = '', level: number = 0): React.ReactNode[] => {
    return cats
      .filter((cat: any) => (cat.parentCategoryId || '') === parentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((cat: any, idx: number) => [
        <tr key={cat.id} className={`hover:bg-gray-50 transition border-b last:border-none ${cat.deleted ? 'opacity-60' : ''}`}
          style={level === 0 && idx !== 0 ? { borderTop: '4px solid #f3f4f6' } : {}} // extra space between main categories
        >
          <td
            className="px-6 py-4 whitespace-nowrap font-medium text-primary"
            style={{
              paddingLeft: `${level * 32 + 24}px`, // more indentation for subcategories
              background: level > 0 ? '#f9fafb' : undefined, // subtle background for subcategories
              borderLeft: level > 0 ? '3px solid #e5e7eb' : undefined,
              borderRadius: level > 0 ? '4px' : undefined,
              fontWeight: level === 0 ? 600 : 500,
              fontSize: level === 0 ? '1rem' : '0.97rem',
              marginTop: level === 0 && idx !== 0 ? '8px' : undefined,
              marginBottom: level === 0 ? '8px' : undefined,
              transition: 'background 0.2s',
            }}
          >
            {cat.title}
          </td>
          <td className="px-6 py-4 whitespace-nowrap">{getRestaurantName(cat.restaurantId)}</td>
          <td className="px-6 py-4 whitespace-nowrap">{cat.deleted ? 'Deleted' : cat.status === 'active' ? 'Active' : 'Inactive'}</td>
          <td className="px-6 py-4 whitespace-nowrap">{cat.parentCategoryId ? (categories.find((c: any) => c.id === cat.parentCategoryId)?.title || '—') : '—'}</td>
          <td className="px-6 py-4 whitespace-nowrap text-right">
            <div className="flex justify-end space-x-2">
              <button title="Edit" className="p-2 rounded hover:bg-green-100 transition text-green-600"><Pencil size={18} /></button>
              {!cat.deleted && (
                <button title="Delete" onClick={() => setCategoryAction({ type: 'delete', category: cat })} className="p-2 rounded hover:bg-red-100 transition"><Trash2 size={18} className="text-red-600" /></button>
              )}
              {cat.deleted && (
                <button title="Restore" onClick={() => setCategoryAction({ type: 'restore', category: cat })} className="p-2 rounded hover:bg-blue-100 transition"><RotateCcw size={18} className="text-blue-600" /></button>
              )}
            </div>
          </td>
        </tr>,
        ...renderCategoryTree(cats, cat.id, level + 1)
      ]).flat();
  };

  return (
    <AdminDashboardLayout>
      <h1 className="text-2xl font-bold mb-4">Menus & Categories</h1>
      {loading ? (
        <div className="flex justify-center items-center h-32">
          <LoadingSpinner size={48} color={designSystem.colors.primary} />
        </div>
      ) : (
        <>
          <div className="bg-white shadow rounded-lg overflow-hidden mb-8">
            <div className="flex flex-wrap gap-4 mb-4 p-4">
              <div>
                <label className="block text-sm font-medium mb-1">Filter by Restaurant</label>
                <select value={selectedRestaurant} onChange={e => { setSelectedRestaurant(e.target.value); setDishPage(1); }} className="border px-2 py-1 rounded">
                  <option value="all">All</option>
                  {Object.entries(restaurants).map(([id, r]: any) => (
                    <option key={id} value={id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Filter by Category</label>
                <select value={selectedCategory} onChange={e => { setSelectedCategory(e.target.value); setDishPage(1); }} className="border px-2 py-1 rounded">
                  <option value="all">All</option>
                  {categories.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>{cat.title}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Pagination controls (top) */}
            <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-200">
              <div className="flex-1 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{dishStartIndex + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(dishEndIndex, sortedDishes.length)}</span>{' '}
                    of <span className="font-medium">{sortedDishes.length}</span> results
                  </p>
                  <div className="flex items-center space-x-2">
                    <label htmlFor="dishItemsPerPage" className="text-sm text-gray-700">Items per page:</label>
                    <select
                      id="dishItemsPerPage"
                      value={dishItemsPerPage}
                      onChange={handleDishItemsPerPageChange}
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
                    {renderDishPagination()}
                  </nav>
                </div>
              </div>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Restaurant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedDishes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-gray-500">No dishes found.</td>
                  </tr>
                ) : (
                  paginatedDishes.map(renderDishRow)
                )}
              </tbody>
            </table>
            {/* Pagination controls (bottom) */}
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
              <div className="flex-1 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{dishStartIndex + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(dishEndIndex, sortedDishes.length)}</span>{' '}
                    of <span className="font-medium">{sortedDishes.length}</span> results
                  </p>
                  <div className="flex items-center space-x-2">
                    <label htmlFor="dishItemsPerPageBottom" className="text-sm text-gray-700">Items per page:</label>
                    <select
                      id="dishItemsPerPageBottom"
                      value={dishItemsPerPage}
                      onChange={handleDishItemsPerPageChange}
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
                    {renderDishPagination()}
                  </nav>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <h2 className="text-xl font-semibold mb-4 p-4">Categories</h2>
            {/* Active Categories Table */}
            <div className="mb-6">
              <div className="flex items-center justify-between px-4 py-2 bg-green-50 border-b border-green-200">
                <span className="font-semibold text-green-700">Active Categories</span>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700">Items per page:</label>
                  <select value={activeCatItemsPerPage} onChange={e => { setActiveCatItemsPerPage(Number(e.target.value)); setActiveCatPage(1); }} className="border px-2 py-1 rounded">
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Restaurant</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parent</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activeCategories.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">No active categories found.</td></tr>
                  ) : (
                    renderCategoryTree(paginatedActiveCategories)
                  )}
                </tbody>
              </table>
              <div className="flex justify-between items-center mt-4 p-4">
                <button disabled={activeCatPage === 1} onClick={() => setActiveCatPage(p => Math.max(1, p - 1))} className="px-4 py-2 rounded bg-primary text-white disabled:opacity-50">Previous</button>
                <span>Page {activeCatPage} of {activeCatTotalPages}</span>
                <button disabled={activeCatPage === activeCatTotalPages} onClick={() => setActiveCatPage(p => Math.min(activeCatTotalPages, p + 1))} className="px-4 py-2 rounded bg-primary text-white disabled:opacity-50">Next</button>
              </div>
            </div>
            {/* Deleted Categories Table */}
            <div>
              <div className="flex items-center justify-between px-4 py-2 bg-red-50 border-b border-red-200">
                <span className="font-semibold text-red-700">Deleted Categories</span>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700">Items per page:</label>
                  <select value={deletedCatItemsPerPage} onChange={e => { setDeletedCatItemsPerPage(Number(e.target.value)); setDeletedCatPage(1); }} className="border px-2 py-1 rounded">
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Restaurant</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parent</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {deletedCategories.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">No deleted categories found.</td></tr>
                  ) : (
                    renderCategoryTree(paginatedDeletedCategories)
                  )}
                </tbody>
              </table>
              <div className="flex justify-between items-center mt-4 p-4">
                <button disabled={deletedCatPage === 1} onClick={() => setDeletedCatPage(p => Math.max(1, p - 1))} className="px-4 py-2 rounded bg-primary text-white disabled:opacity-50">Previous</button>
                <span>Page {deletedCatPage} of {deletedCatTotalPages}</span>
                <button disabled={deletedCatPage === deletedCatTotalPages} onClick={() => setDeletedCatPage(p => Math.min(deletedCatTotalPages, p + 1))} className="px-4 py-2 rounded bg-primary text-white disabled:opacity-50">Next</button>
              </div>
            </div>
          </div>
        </>
      )}
      {/* Confirmation modals */}
      {dishAction && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2">Confirm {dishAction.type === 'delete' ? 'Delete' : 'Restore'}</h2>
            <p className="mb-4">Are you sure you want to {dishAction.type} <span className="font-semibold">{dishAction.dish.title}</span>?</p>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => setDishAction(null)}>Cancel</button>
              <button className="px-4 py-2 bg-primary text-white rounded" onClick={() => handleDishAction(dishAction.type, dishAction.dish)} disabled={dishesLoading}>Confirm</button>
            </div>
          </div>
        </div>
      )}
      {categoryAction && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2">Confirm {categoryAction.type === 'delete' ? 'Delete' : 'Restore'}</h2>
            <p className="mb-4">Are you sure you want to {categoryAction.type} <span className="font-semibold">{categoryAction.category.title}</span>?</p>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => setCategoryAction(null)}>Cancel</button>
              <button className="px-4 py-2 bg-primary text-white rounded" onClick={() => handleCategoryAction(categoryAction.type, categoryAction.category)} disabled={categoriesLoading}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </AdminDashboardLayout>
  );
};

export default AdminMenus; 