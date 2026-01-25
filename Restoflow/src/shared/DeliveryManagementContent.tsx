import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { Copy, ExternalLink, Truck, X, Plus, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Modal from '../components/ui/Modal';
import designSystem from '../designSystem';
import { useLanguage } from '../contexts/LanguageContext';
import { t } from '../utils/i18n';

interface DeliveryManagementContentProps {
  restaurant: any;
  updateRestaurantProfile: (data: any) => Promise<void>;
  isDemoUser: boolean;
}

const DeliveryManagementContent: React.FC<DeliveryManagementContentProps> = ({
  restaurant,
}) => {
  const { language } = useLanguage();
  const [allDishes, setAllDishes] = useState<any[]>([]);
  const [dailyMenuDishes, setDailyMenuDishes] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  
  // Daily menu table pagination
  const [dailyMenuCurrentPage, setDailyMenuCurrentPage] = useState(1);
  const [dailyMenuItemsPerPage] = useState(8);

  // Check if daily menu link is enabled
  const isDailyMenuEnabled = restaurant?.publicDailyMenuLink;

  // If daily menu is disabled, show message
  if (!isDailyMenuEnabled) {
    return (
      <div className="space-y-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Truck className="h-8 w-8 text-yellow-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-yellow-800">
                {t('delivery_menu_disabled_title', language)}
              </h3>
              <p className="text-yellow-700 mt-1">
                {t('delivery_menu_disabled_message', language)}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    const fetchData = async () => {
      if (!restaurant?.id) return;
      setLoading(true);
      try {
        // Fetch categories
        const categoriesQuery = query(
          collection(db, 'categories'),
          where('restaurantId', '==', restaurant.id),
          where('status', '==', 'active')
        );
        const categoriesSnapshot = await getDocs(categoriesQuery);
        const categoriesData = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCategories(categoriesData);

        // Fetch all dishes (excluding soft deleted)
        const dishesQuery = query(
          collection(db, 'menuItems'),
          where('restaurantId', '==', restaurant.id)
        );
        const dishesSnapshot = await getDocs(dishesQuery);
        const dishesData = dishesSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(dish => !(dish as any).deleted);
        
        setAllDishes(dishesData);
        
        // Filter daily menu dishes
        const dailyMenuItems = dishesData.filter(dish => (dish as any).dailyMenu === true);
        setDailyMenuDishes(dailyMenuItems);
      } catch (error) {
        console.error('Error fetching delivery data:', error);
        toast.error(t('delivery_error_load_data', language));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [restaurant]);

  // Filter and paginate dishes for modal
  const filteredDishes = allDishes.filter(dish => {
    const matchesSearch = dish.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || dish.categoryId === selectedCategory;
    const isNotInDailyMenu = !dailyMenuDishes.some(dailyDish => dailyDish.id === dish.id);
    return matchesSearch && matchesCategory && isNotInDailyMenu;
  });

  // Filter out soft deleted categories for the dropdown
  const activeCategories = categories.filter(category => !category.deleted);

  // Calculate totalPages as a number
  const totalPages: number = Math.ceil(filteredDishes.length / itemsPerPage);
  const paginatedDishes = filteredDishes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Daily menu table pagination
  const dailyMenuTotalPages = Math.ceil(dailyMenuDishes.length / dailyMenuItemsPerPage);
  const paginatedDailyMenuDishes = dailyMenuDishes.slice(
    (dailyMenuCurrentPage - 1) * dailyMenuItemsPerPage,
    dailyMenuCurrentPage * dailyMenuItemsPerPage
  );

  const addToDailyMenu = async (dish: any) => {
    if (!restaurant?.id) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'menuItems', dish.id), {
        dailyMenu: true,
        updatedAt: serverTimestamp()
      });
      
      // Update local state
      setDailyMenuDishes(prev => [...prev, { ...dish, dailyMenu: true }]);
      toast.success(t('delivery_dish_added', language).replace('{{title}}', dish.title));
    } catch (error) {
      console.error('Error adding dish to daily menu:', error);
      toast.error(t('delivery_error_add_dish', language));
    } finally {
      setUpdating(false);
    }
  };

  const removeFromDailyMenu = async (dish: any) => {
    if (!restaurant?.id) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'menuItems', dish.id), {
        dailyMenu: false,
        updatedAt: serverTimestamp()
      });
      
      // Update local state
      setDailyMenuDishes(prev => prev.filter(d => d.id !== dish.id));
      toast.success(t('delivery_dish_removed', language).replace('{{title}}', dish.title));
    } catch (error) {
      console.error('Error removing dish from daily menu:', error);
      toast.error(t('delivery_error_remove_dish', language));
    } finally {
      setUpdating(false);
    }
  };

  const copyDeliveryLink = () => {
    const link = `${window.location.origin}/public-daily-menu/${restaurant?.id}`;
    navigator.clipboard.writeText(link);
    toast.success(t('delivery_link_copied', language));
  };

  const openDeliveryLink = () => {
    const link = `${window.location.origin}/public-daily-menu/${restaurant?.id}`;
    window.open(link, '_blank');
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category?.title || t('unknown_category', language);
  };

  const getSubCategoryName = (parentCategoryId: string) => {
    const subCategory = categories.find(cat => cat.id === parentCategoryId);
    return subCategory?.title || '';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size={60} />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <Truck className="h-6 w-6" style={{ color: designSystem.colors.primary }} />
            <h2 className="text-xl font-semibold">{t('delivery_daily_menu_title', language)}</h2>
          </div>
          <p className="text-gray-600 mb-4">
            {t('delivery_daily_menu_description', language)}
          </p>
          <p className="text-xs text-gray-500 mb-4">
            <span className="font-semibold text-teal-600">{dailyMenuDishes.length} {t('dishes_in_daily_menu', language)}</span>, <span className="font-semibold text-blue-600">{allDishes.length - dailyMenuDishes.length} {t('remaining_dishes_available', language)}</span>
          </p>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mb-4">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors"
            >
              <Plus size={16} />
              {t('delivery_add_to_menu', language)}
            </button>
            
            <button
              onClick={copyDeliveryLink}
              className="flex items-center gap-2 px-4 py-2 bg-secondary text-primary rounded-lg font-medium hover:opacity-90 transition-colors"
            >
              <Copy size={16} />
              {t('delivery_copy_link', language)}
            </button>
            
            <button
              onClick={openDeliveryLink}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              <ExternalLink size={16} />
              {t('delivery_view_menu', language)}
            </button>
          </div>

          {/* Delivery Link Section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium mb-2">{t('delivery_menu_link_title', language)}</h3>
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="flex-1 px-3 py-2 border rounded bg-white text-gray-700 text-sm"
                value={`${window.location.origin}/public-daily-menu/${restaurant?.id}`}
                readOnly
              />
            </div>
          </div>
        </div>

        {/* Daily Menu Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">{t('delivery_today_menu_title', language)}</h3>
            <p className="text-gray-600 text-sm">
              {t('delivery_dishes_in_menu', language).replace('{{count}}', String(dailyMenuDishes.length))} - <span className="font-semibold text-teal-600">{dailyMenuDishes.length} {t('dishes', language)}</span>
            </p>
          </div>
          
          <div className="p-6">
            {dailyMenuDishes.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Truck className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">{t('delivery_no_dishes', language)}</p>
                <p className="text-sm">{t('delivery_click_add_to_menu', language)}</p>
              </div>
            ) : (
              <>
                {/* Dishes Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
                  {paginatedDailyMenuDishes.map(dish => (
                    <div
                      key={dish.id}
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{dish.title}</h4>
                          <p className="text-xs text-gray-500">
                            {getCategoryName(dish.categoryId)}
                            {dish.parentCategoryId && (
                              <span className="ml-1">• {getSubCategoryName(dish.parentCategoryId)}</span>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={() => removeFromDailyMenu(dish)}
                          disabled={updating}
                          className="flex-shrink-0 ml-2 p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                          title={t('delivery_remove_from_menu', language)}
                        >
                          <X size={14} />
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {dish.image ? (
                          <img
                            src={dish.image}
                            alt={dish.title}
                            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-gray-400 text-xs">{t('delivery_no_image', language)}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">
                            {dish.price} {restaurant?.currency || 'XAF'}
                          </div>
                          {dish.description && (
                            <div className="text-xs text-gray-500 truncate mt-1">
                              {dish.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {dailyMenuTotalPages > 1 && (
                  <div className="flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-gray-500">
                      {t('delivery_showing_dishes', language)
                        .replace('{{from}}', String(((dailyMenuCurrentPage - 1) * dailyMenuItemsPerPage) + 1))
                        .replace('{{to}}', String(Math.min(dailyMenuCurrentPage * dailyMenuItemsPerPage, dailyMenuDishes.length)))
                        .replace('{{total}}', String(dailyMenuDishes.length))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDailyMenuCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={dailyMenuCurrentPage === 1}
                        className="p-2 rounded border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-sm">
                        {t('delivery_page_of', language)
                          .replace('{{current}}', String(dailyMenuCurrentPage))
                          .replace('{{total}}', String(dailyMenuTotalPages))}
                      </span>
                      <button
                        onClick={() => setDailyMenuCurrentPage(prev => Math.min(dailyMenuTotalPages, prev + 1))}
                        disabled={dailyMenuCurrentPage === dailyMenuTotalPages}
                        className="p-2 rounded border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {/* Render modal outside the main content wrapper for full overlay coverage */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          title={t('delivery_add_to_menu', language)}
          onClose={() => {
            setIsAddModalOpen(false);
            setSearchTerm('');
            setSelectedCategory('all');
            setCurrentPage(1);
          }}
          className="max-w-5xl"
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-3 sticky top-0 bg-white py-2 z-30">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder={t('delivery_search_placeholder', language)}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="pl-10 pr-8 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent appearance-none bg-white"
                >
                  <option value="all">{t('delivery_all_categories', language)}</option>
                  {activeCategories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative min-w-[120px]">
                <select
                  value={itemsPerPage}
                  onChange={e => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="py-2 px-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent appearance-none bg-white"
                >
                  {[4, 8, 12, 16, 24].map(num => (
                    <option key={num} value={num}>{t('delivery_per_page', language).replace('{{num}}', num.toString())}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Results Count */}
            <div className="text-sm text-gray-600">
              {t('delivery_dishes_found', language).replace('{{count}}', String(filteredDishes.length))}
            </div>

            {/* Dishes Grid */}
            {filteredDishes.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>{t('delivery_no_dishes_found', language)}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {paginatedDishes.map(dish => (
                    <div
                      key={dish.id}
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow relative"
                    >
                      {/* Icon-only add button in top-right */}
                      <button
                        onClick={() => addToDailyMenu(dish)}
                        disabled={updating}
                        className="absolute top-2 right-2 p-2 bg-primary text-white rounded-full shadow hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed z-10"
                        title={t('delivery_add_to_daily_menu', language)}
                      >
                        <Plus size={18} />
                      </button>
                      <div className="flex flex-col items-center gap-2">
                        {dish.image ? (
                          <img
                            src={dish.image}
                            alt={dish.title}
                            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-gray-400 text-xs">{t('delivery_no_image', language)}</span>
                          </div>
                        )}
                        <div className="w-full">
                          <h4 className="font-medium text-sm truncate text-center">{dish.title}</h4>
                          <p className="text-xs text-gray-500 text-center">
                            {getCategoryName(dish.categoryId)}
                            {dish.parentCategoryId && (
                              <span className="ml-1">• {getSubCategoryName(dish.parentCategoryId)}</span>
                            )}
                          </p>
                          <div className="font-semibold text-sm text-center">
                            {dish.price} {restaurant?.currency || 'XAF'}
                          </div>
                          {dish.description && (
                            <div className="text-xs text-gray-500 truncate mt-1 text-center">
                              {dish.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-gray-500">
                      {t('delivery_showing_dishes', language)
                        .replace('{{from}}', String(((currentPage - 1) * itemsPerPage) + 1))
                        .replace('{{to}}', String(Math.min(currentPage * itemsPerPage, filteredDishes.length)))
                        .replace('{{total}}', String(filteredDishes.length))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-sm">
                        {t('delivery_page_of', language)
                          .replace('{{current}}', String(currentPage))
                          .replace('{{total}}', String(totalPages))}
                      </span>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};

export default DeliveryManagementContent; 