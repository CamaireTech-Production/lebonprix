import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import AdminDashboardLayout from '../../components/layout/AdminDashboardLayout';
import designSystem from '../../designSystem';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { Trash2, RotateCcw, ArrowLeft, Eye, Pencil, EyeOff, Copy, ExternalLink, Link as LinkIcon, Check, Share2, Mail, MessageCircle } from 'lucide-react';
import { logActivity } from '../../services/activityLogService';
import { Switch } from '@headlessui/react';
import { Dish, Category, Table } from '../../types';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import ColorPicker from '../../components/ui/ColorPicker';
import PaymentSetup from '../../components/payment/PaymentSetup';
import Papa from 'papaparse';
import { subscribeToVisitorStats, VisitorStats } from '../../services/visitorTrackingService';


const TABS = [
  { key: 'dishes', label: 'Dishes' },
  { key: 'categories', label: 'Categories' },
  { key: 'tables', label: 'Tables' },
  { key: 'orders', label: 'Orders' },
  { key: 'settings', label: 'Settings' },
];

const Card = ({ title, value }: { title: string; value: number | string }) => (
  <div className="flex-1 bg-white rounded-lg shadow p-4 flex flex-col items-center justify-center min-w-[120px]">
    <div className="text-2xl font-bold" style={{ color: designSystem.colors.primary }}>{value}</div>
    <div className="text-sm mt-1 text-gray-500">{title}</div>
  </div>
);

const RestaurantDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const db = getFirestore();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dishes');
  const [counts, setCounts] = useState({ dishes: 0, categories: 0, tables: 0, orders: 0 });
  const [dishes, setDishes] = useState<any[]>([]);
  const [dishesLoading, setDishesLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | { type: string; dish: any }>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [confirmCategoryAction, setConfirmCategoryAction] = useState<null | { type: 'delete' | 'restore'; category: any }>(null);
  // Change showCategoryModal type to only allow 'add' | 'edit'
  const [showCategoryModal, setShowCategoryModal] = useState<null | { mode: 'add' | 'edit', category?: any }>(null);
  const [tables, setTables] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [confirmOrderAction, setConfirmOrderAction] = useState<null | { type: 'delete' | 'restore'; order: any }>(null);
  const [showOrderDetails, setShowOrderDetails] = useState<null | any>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settings, setSettings] = useState({
    orderManagement: false,
    tableManagement: false,
    paymentInfo: false,
    colorCustomization: false,
    publicMenuLink: false,
    publicOrderLink: false,
    whatsappBulkMessaging: false,
    publicDailyMenuLink: false,
    templateSelection: true,
  });
  // Add modal state for add/edit/details
  const [showAddEditModal, setShowAddEditModal] = useState<null | { mode: 'add' | 'edit' | 'details', dish?: any }>(null);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [confirmTableAction, setConfirmTableAction] = useState<null | { type: 'delete' | 'restore'; table: any }>(null);
  const [showTableModal, setShowTableModal] = useState<null | { mode: 'add' | 'edit', table?: any }>(null);
  const { currentAdmin } = useAdminAuth();
  const [profileForm, setProfileForm] = useState({
    name: '',
    address: '',
    phone: '',
    description: '',
    logo: '',
    logoFile: null as File | null,
    logoPreview: '',
    primaryColor: '',
    secondaryColor: '',
    paymentInfo: {},
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [email, setEmail] = useState(restaurant?.email || '');
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // In state, add deleted items arrays for each entity
  const [deletedDishes, setDeletedDishes] = useState<any[]>([]);
  const [deletedCategories, setDeletedCategories] = useState<any[]>([]);
  const [deletedTables, setDeletedTables] = useState<any[]>([]);
  const [deletedOrders, setDeletedOrders] = useState<any[]>([]);
  // Add visitor stats state
  const [visitorStats, setVisitorStats] = useState<VisitorStats | null>(null);
  // Add at the top of RestaurantDetail component state
  const [dishPage, setDishPage] = useState(1);
  const [dishItemsPerPage, setDishItemsPerPage] = useState(10);
  // Add at the top of RestaurantDetail component state
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryItemsPerPage, setCategoryItemsPerPage] = useState(10);
  // Add at the top of RestaurantDetail component state
  const [tablePage, setTablePage] = useState(1);
  const [tableItemsPerPage, setTableItemsPerPage] = useState(10);
  // Add at the top of RestaurantDetail component state
  const [orderPage, setOrderPage] = useState(1);
  const [orderItemsPerPage, setOrderItemsPerPage] = useState(10);
  const [copiedLinkKey, setCopiedLinkKey] = useState<string | null>(null);
  const [openShareKey, setOpenShareKey] = useState<string | null>(null);

  // Sync form state with restaurant data
  useEffect(() => {
    if (restaurant) {
      setProfileForm({
        name: restaurant.name || '',
        address: restaurant.address || '',
        phone: restaurant.phone || '',
        description: restaurant.description || '',
        logo: restaurant.logo || '',
        logoFile: null,
        logoPreview: restaurant.logo || '',
        primaryColor: restaurant.colorPalette?.primary || designSystem.colors.primary,
        secondaryColor: restaurant.colorPalette?.secondary || designSystem.colors.secondary,
        paymentInfo: restaurant.paymentInfo || {},
      });
      setEmail(restaurant.email || '');
    }
  }, [restaurant]);

  const handleProfileInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfileForm(prev => ({ ...prev, [name]: value }));
  };
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfileForm(prev => ({ ...prev, logoFile: file, logoPreview: URL.createObjectURL(file) }));
      const reader = new FileReader();
      reader.onload = () => setProfileForm(prev => ({ ...prev, logo: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };
  const removeLogo = () => {
    setProfileForm(prev => ({ ...prev, logo: '', logoFile: null, logoPreview: '' }));
  };
  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    if (!profileForm.name.trim()) {
      setProfileError('Restaurant name is required');
      return;
    }
    setProfileLoading(true);
    try {
      // Use phone as entered (no country code enforcement)
      const formattedPhone = profileForm.phone;
      
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        name: profileForm.name,
        address: profileForm.address,
        phone: formattedPhone,
        description: profileForm.description,
        logo: profileForm.logo,
        colorPalette: {
          primary: profileForm.primaryColor,
          secondary: profileForm.secondaryColor,
        },
        paymentInfo: profileForm.paymentInfo,
        updatedAt: serverTimestamp(),
      });
      toast.success('Profile updated successfully!', {
        style: {
          background: designSystem.colors.success,
          color: designSystem.colors.textInverse,
        },
      });
      setRestaurant((prev: any) => prev ? { ...prev, ...profileForm, colorPalette: { primary: profileForm.primaryColor, secondary: profileForm.secondaryColor } } : prev);
    } catch (error) {
      setProfileError('Failed to update profile');
      toast.error('Failed to update profile', {
        style: {
          background: designSystem.colors.error,
          color: designSystem.colors.textInverse,
        },
      });
    } finally {
      setProfileLoading(false);
    }
  };

  // Move handleOrderAction here so it is defined before usage in JSX
  const handleOrderAction = async (type: 'delete' | 'restore', order: any) => {
    setOrdersLoading(true);
    try {
      const ref = doc(db, 'orders', order.id);
      if (type === 'delete') {
        await updateDoc(ref, { deleted: true, updatedAt: serverTimestamp() });
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, deleted: true } : o));
        await logActivity({
          userId: currentAdmin?.id,
          userEmail: currentAdmin?.email,
          action: 'admin_delete_order',
          entityType: 'order',
          entityId: order.id,
          details: { tableNumber: order.tableNumber, totalAmount: order.totalAmount, role: 'admin' },
        });
        toast('Order deleted.', {
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
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, deleted: false } : o));
        await logActivity({
          userId: currentAdmin?.id,
          userEmail: currentAdmin?.email,
          action: 'admin_restore_order',
          entityType: 'order',
          entityId: order.id,
          details: { tableNumber: order.tableNumber, totalAmount: order.totalAmount, role: 'admin' },
        });
        toast('Order restored.', {
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
      setOrdersLoading(false);
      setConfirmOrderAction(null);
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Fetch restaurant
        const ref = doc(db, 'restaurants', id!);
        const snap = await getDoc(ref);
        setRestaurant(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        // Fetch settings from restaurant doc
        if (snap.exists()) {
          const data = snap.data();
          setSettings({
            orderManagement: !!data.orderManagement,
            tableManagement: !!data.tableManagement,
            paymentInfo: !!data.paymentInfo,
            colorCustomization: !!data.colorCustomization,
            publicMenuLink: !!data.publicMenuLink,
            publicOrderLink: !!data.publicOrderLink,
            whatsappBulkMessaging: !!data.whatsappBulkMessaging,
            publicDailyMenuLink: !!data.publicDailyMenuLink,
            templateSelection: !!data.templateSelection,
          });
        }
        // Fetch entities
        const [dishesSnap, categoriesSnap, tablesSnap, ordersSnap] = await Promise.all([
          getDocs(query(collection(db, 'menuItems'), where('restaurantId', '==', id))),
          getDocs(query(collection(db, 'categories'), where('restaurantId', '==', id))),
          getDocs(query(collection(db, 'tables'), where('restaurantId', '==', id))),
          getDocs(query(collection(db, 'orders'), where('restaurantId', '==', id), where('deleted', '!=', true))),
        ]);
        const dishesData = dishesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setDishes(dishesData.filter((d: any) => !d.deleted));
        setDeletedDishes(dishesData.filter((d: any) => d.deleted));
        const categoriesData = categoriesSnap.docs.map(c => ({ id: c.id, ...c.data() }));
        setCategories(categoriesData.filter((c: any) => !c.deleted));
        setDeletedCategories(categoriesData.filter((c: any) => c.deleted));
        const tablesData = tablesSnap.docs.map(t => ({ id: t.id, ...t.data() }));
        setTables(tablesData.filter((t: any) => !t.deleted));
        setDeletedTables(tablesData.filter((t: any) => t.deleted));
        const ordersData = ordersSnap.docs.map(o => ({ id: o.id, ...o.data() }));
        setOrders(ordersData.filter((o: any) => !o.deleted));
        setDeletedOrders(ordersData.filter((o: any) => o.deleted));
        setCounts({
          dishes: dishesData.length,
          categories: categoriesData.length,
          tables: tablesData.length, // TODO: add deleted filter if needed
          orders: ordersData.length,
        });
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [db, id]);

  // Subscribe to visitor statistics
  useEffect(() => {
    if (!id) return;
    
    const unsubscribe = subscribeToVisitorStats(
      id,
      false, // isDemo = false for regular restaurants
      undefined,
      (stats) => {
        setVisitorStats(stats);
      }
    );
    
    return unsubscribe;
  }, [id]);

  // Dishes tab: soft delete/restore
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
      setConfirmAction(null);
    }
  };

  const handleToggleSetting = async (key: keyof typeof settings) => {
    if (!restaurant) return;
    setSettingsLoading(true);
    try {
      const ref = doc(db, 'restaurants', restaurant.id);
      const newValue = !settings[key];
      await updateDoc(ref, { [key]: newValue, updatedAt: serverTimestamp() });
      setSettings(prev => ({ ...prev, [key]: newValue }));
      toast(`${key.replace(/([A-Z])/g, ' $1')} ${newValue ? 'enabled' : 'disabled'}.`, {
        style: {
          background: designSystem.colors.white,
          color: designSystem.colors.primary,
          border: `1px solid ${newValue ? designSystem.colors.success : designSystem.colors.error}`,
          fontWeight: 500,
        },
        icon: newValue ? '✅' : '❌',
      });
    } catch (err) {
      toast('Failed to update setting.', {
        style: {
          background: designSystem.colors.white,
          color: designSystem.colors.primary,
          border: `1px solid ${designSystem.colors.error}`,
          fontWeight: 500,
        },
        icon: '❌',
      });
    } finally {
      setSettingsLoading(false);
    }
  };

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
      setConfirmCategoryAction(null);
    }
  };

  const handleCategorySave = async (mode: 'add' | 'edit', categoryData: Partial<Category>, editingCategory?: any) => {
    setCategoriesLoading(true);
    try {
      if (mode === 'add') {
        const ref = await addDoc(collection(db, 'categories'), {
          ...categoryData,
          restaurantId: restaurant.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          deleted: false,
        });
        setCategories(prev => [...prev, { id: ref.id, ...categoryData, deleted: false }]);
        await logActivity({
          userId: currentAdmin?.id,
          userEmail: currentAdmin?.email,
          action: 'admin_add_category',
          entityType: 'category',
          entityId: ref.id,
          details: { ...categoryData, role: 'admin' },
        });
        toast.success('Category added!');
      } else if (mode === 'edit' && editingCategory) {
        const ref = doc(db, 'categories', editingCategory.id);
        await updateDoc(ref, {
          ...categoryData,
          updatedAt: serverTimestamp(),
        });
        setCategories(prev => prev.map(c => c.id === editingCategory.id ? { ...c, ...categoryData } : c));
        await logActivity({
          userId: currentAdmin?.id,
          userEmail: currentAdmin?.email,
          action: 'admin_edit_category',
          entityType: 'category',
          entityId: editingCategory.id,
          details: { ...categoryData, role: 'admin' },
        });
        toast.success('Category updated!');
      }
      setShowCategoryModal(null);
    } catch (err) {
      toast.error('Failed to save category.');
    } finally {
      setCategoriesLoading(false);
    }
  };

  const getCategoryName = (categoryId: string) => {
    if (!categoryId) return '—';
    const cat = categories.find((c: any) => c.id === categoryId);
    return cat ? cat.title : '—';
  };

  // Compute paginated dishes
  const dishTotalPages = Math.ceil(dishes.length / dishItemsPerPage);
  const dishStartIndex = (dishPage - 1) * dishItemsPerPage;
  const dishEndIndex = dishStartIndex + dishItemsPerPage;
  const paginatedDishes = dishes.slice(dishStartIndex, dishEndIndex);

  // Pagination controls
  const handleDishPageChange = (page: number) => setDishPage(page);
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

  // In renderDishesTable, replace dishes.map with paginatedDishes.map, and add controls above and below
  const renderDishesTable = () => (
    <div className="overflow-x-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Dishes</h2>
        <div className="flex gap-2"> {/* Group the buttons together */}
        <button
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition"
          onClick={() => setShowAddEditModal({ mode: 'add' })}
        >
          + Add Dish
        </button>
          <button
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition"
            onClick={openCSVModal}
          >
            Import CSV
        </button>
        </div>
      </div>
      {/* Pagination controls (top) */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-200">
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{dishStartIndex + 1}</span> to{' '}
              <span className="font-medium">{Math.min(dishEndIndex, dishes.length)}</span>{' '}
              of <span className="font-medium">{dishes.length}</span> results
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
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {dishes.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-10 text-center text-gray-500">No dishes found.</td>
            </tr>
          ) : (
            paginatedDishes.map((dish) => (
              <tr key={dish.id} className={`hover:bg-gray-50 transition ${dish.deleted ? 'opacity-60' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap">
                  {dish.image ? (
                    <img src={dish.image} alt={dish.title} className="w-12 h-12 object-cover rounded" />
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-primary">{dish.title}</td>
                <td className="px-6 py-4 whitespace-nowrap">{getCategoryName(dish.categoryId)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{dish.price ? `${dish.price} FCFA` : '—'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${dish.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{dish.status === 'active' ? 'Active' : 'Inactive'}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex justify-end space-x-2">
                    <button title="View Details" onClick={() => setShowAddEditModal({ mode: 'details', dish })} className="p-2 rounded hover:bg-blue-100 transition text-blue-600"><Eye size={18} /></button>
                    {!dish.deleted && (
                      <button title="Edit" onClick={() => setShowAddEditModal({ mode: 'edit', dish })} className="p-2 rounded hover:bg-green-100 transition text-green-600"><Pencil size={18} /></button>
                    )}
                    {!dish.deleted && (
                      <button title="Delete" onClick={() => setConfirmAction({ type: 'delete', dish })} className="p-2 rounded hover:bg-red-100 transition"><Trash2 size={18} className="text-red-600" /></button>
                    )}
                    {dish.deleted && (
                      <button title="Restore" onClick={() => setConfirmAction({ type: 'restore', dish })} className="p-2 rounded hover:bg-blue-100 transition"><RotateCcw size={18} className="text-blue-600" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {/* Pagination controls (bottom) */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{dishStartIndex + 1}</span> to{' '}
              <span className="font-medium">{Math.min(dishEndIndex, dishes.length)}</span>{' '}
              of <span className="font-medium">{dishes.length}</span> results
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
      {dishesLoading && <div className="flex justify-center items-center py-4"><LoadingSpinner size={32} color={designSystem.colors.primary} /></div>}
      {/* Deleted Dishes Table */}
      {deletedDishes.length > 0 && (
        <div className="mt-8">
          <h3 className="text-base font-semibold mb-2 text-red-600">Deleted Dishes</h3>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {deletedDishes.map((dish) => (
                <tr key={dish.id} className="opacity-60">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {dish.image ? (
                      <img src={dish.image} alt={dish.title} className="w-12 h-12 object-cover rounded" />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-primary">{dish.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{getCategoryName(dish.categoryId)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{dish.price ? `${dish.price} FCFA` : '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Deleted</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end space-x-2">
                      <button title="View Details" onClick={() => setShowAddEditModal({ mode: 'details', dish })} className="p-2 rounded hover:bg-blue-100 transition text-blue-600"><Eye size={18} /></button>
                      <button title="Restore" onClick={() => setConfirmAction({ type: 'restore', dish })} className="p-2 rounded hover:bg-blue-100 transition"><RotateCcw size={18} className="text-blue-600" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // Compute paginated categories
  const categoryTotalPages = Math.ceil(categories.length / categoryItemsPerPage);
  const categoryStartIndex = (categoryPage - 1) * categoryItemsPerPage;
  const categoryEndIndex = categoryStartIndex + categoryItemsPerPage;

  // Pagination controls
  const handleCategoryPageChange = (page: number) => setCategoryPage(page);
  const handleCategoryItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategoryItemsPerPage(Number(e.target.value));
    setCategoryPage(1);
  };
  const renderCategoryPagination = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, categoryPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(categoryTotalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    // Previous
    pages.push(
      <button
        key="prev"
        onClick={() => handleCategoryPageChange(categoryPage - 1)}
        disabled={categoryPage === 1}
        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {'<'}
      </button>
    );
    if (startPage > 1) {
      pages.push(
        <button key={1} onClick={() => handleCategoryPageChange(1)} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">1</button>
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
          onClick={() => handleCategoryPageChange(i)}
          className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium ${categoryPage === i ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          {i}
        </button>
      );
    }
    if (endPage < categoryTotalPages) {
      if (endPage < categoryTotalPages - 1) {
        pages.push(
          <span key="end-ellipsis" className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>
        );
      }
      pages.push(
        <button key={categoryTotalPages} onClick={() => handleCategoryPageChange(categoryTotalPages)} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">{categoryTotalPages}</button>
      );
    }
    pages.push(
      <button
        key="next"
        onClick={() => handleCategoryPageChange(categoryPage + 1)}
        disabled={categoryPage === categoryTotalPages}
        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {'>'}
      </button>
    );
    return pages;
  };

  // 1. Define renderCategoryTree before renderCategoriesTable
  const renderCategoryTree = (categories: Category[], parentId: string = '', level: number = 0): React.ReactNode[] => {
    return categories
      .filter((cat: Category) => (cat.parentCategoryId || '') === parentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((cat: Category) => [
        <tr key={cat.id} className={`hover:bg-gray-50 transition ${cat.deleted ? 'opacity-60' : ''}`}>
          <td className="px-6 py-4 whitespace-nowrap font-medium text-primary" style={{ paddingLeft: `${level * 24}px` }}>{cat.title}</td>
          <td className="px-6 py-4 whitespace-nowrap">{cat.status === 'active' ? 'Active' : 'Inactive'}</td>
          <td className="px-6 py-4 whitespace-nowrap">{cat.order ?? '—'}</td>
          <td className="px-6 py-4 whitespace-nowrap">{cat.parentCategoryId ? (categories.find((c: Category) => c.id === cat.parentCategoryId)?.title || '—') : '—'}</td>
          <td className="px-6 py-4 whitespace-nowrap text-right">
            <div className="flex justify-end space-x-2">
              <button title="Edit" onClick={() => setShowCategoryModal({ mode: 'edit', category: cat })} className="p-2 rounded hover:bg-green-100 transition text-green-600"><Pencil size={18} /></button>
              {!cat.deleted && (
                <button title="Delete" onClick={() => setConfirmCategoryAction({ type: 'delete', category: cat })} className="p-2 rounded hover:bg-red-100 transition"><Trash2 size={18} className="text-red-600" /></button>
              )}
              {cat.deleted && (
                <button title="Restore" onClick={() => setConfirmCategoryAction({ type: 'restore', category: cat })} className="p-2 rounded hover:bg-blue-100 transition"><RotateCcw size={18} className="text-blue-600" /></button>
              )}
            </div>
          </td>
        </tr>,
        ...renderCategoryTree(categories, cat.id, level + 1)
      ]).flat();
  };

  // In renderCategoriesTable, replace categories.map with paginatedCategories.map, and add controls above and below
  const renderCategoriesTable = () => (
    <div className="overflow-x-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Categories</h2>
        <button
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition"
          onClick={() => setShowCategoryModal({ mode: 'add' })}
        >
          + Add Category
        </button>
      </div>
      {/* Pagination controls (top) */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-200">
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{categoryStartIndex + 1}</span> to{' '}
              <span className="font-medium">{Math.min(categoryEndIndex, categories.length)}</span>{' '}
              of <span className="font-medium">{categories.length}</span> results
            </p>
            <div className="flex items-center space-x-2">
              <label htmlFor="categoryItemsPerPage" className="text-sm text-gray-700">Items per page:</label>
              <select
                id="categoryItemsPerPage"
                value={categoryItemsPerPage}
                onChange={handleCategoryItemsPerPageChange}
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
              {renderCategoryPagination()}
            </nav>
          </div>
        </div>
      </div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parent Category</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {categories.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-6 py-10 text-center text-gray-500">No categories found.</td>
            </tr>
          ) : (
            renderCategoryTree(categories)
          )}
        </tbody>
      </table>
      {/* Pagination controls (bottom) */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{categoryStartIndex + 1}</span> to{' '}
              <span className="font-medium">{Math.min(categoryEndIndex, categories.length)}</span>{' '}
              of <span className="font-medium">{categories.length}</span> results
            </p>
            <div className="flex items-center space-x-2">
              <label htmlFor="categoryItemsPerPageBottom" className="text-sm text-gray-700">Items per page:</label>
              <select
                id="categoryItemsPerPageBottom"
                value={categoryItemsPerPage}
                onChange={handleCategoryItemsPerPageChange}
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
              {renderCategoryPagination()}
            </nav>
          </div>
        </div>
      </div>
      {categoriesLoading && <div className="flex justify-center items-center py-4"><LoadingSpinner size={32} color={designSystem.colors.primary} /></div>}
      {/* Deleted Categories Table */}
      {deletedCategories.length > 0 && (
        <div className="mt-8">
          <h3 className="text-base font-semibold mb-2 text-red-600">Deleted Categories</h3>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parent Category</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {deletedCategories.map((cat) => (
                <tr key={cat.id} className="opacity-60">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-primary">{cat.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Deleted</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{cat.order ?? '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{cat.parentCategoryId ? (categories.find(c => c.id === cat.parentCategoryId)?.title || '—') : '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end space-x-2">
                      <button title="Restore" onClick={() => setConfirmCategoryAction({ type: 'restore', category: cat })} className="p-2 rounded hover:bg-blue-100 transition"><RotateCcw size={18} className="text-blue-600" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // Compute paginated tables
  const tableTotalPages = Math.ceil(tables.length / tableItemsPerPage);
  const tableStartIndex = (tablePage - 1) * tableItemsPerPage;
  const tableEndIndex = tableStartIndex + tableItemsPerPage;
  const paginatedTables = tables.slice(tableStartIndex, tableEndIndex);

  // Pagination controls
  const handleTablePageChange = (page: number) => setTablePage(page);
  const handleTableItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTableItemsPerPage(Number(e.target.value));
    setTablePage(1);
  };
  const renderTablePagination = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, tablePage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(tableTotalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    // Previous
    pages.push(
      <button
        key="prev"
        onClick={() => handleTablePageChange(tablePage - 1)}
        disabled={tablePage === 1}
        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {'<'}
      </button>
    );
    if (startPage > 1) {
      pages.push(
        <button key={1} onClick={() => handleTablePageChange(1)} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">1</button>
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
          onClick={() => handleTablePageChange(i)}
          className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium ${tablePage === i ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          {i}
        </button>
      );
    }
    if (endPage < tableTotalPages) {
      if (endPage < tableTotalPages - 1) {
        pages.push(
          <span key="end-ellipsis" className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>
        );
      }
      pages.push(
        <button key={tableTotalPages} onClick={() => handleTablePageChange(tableTotalPages)} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">{tableTotalPages}</button>
      );
    }
    pages.push(
      <button
        key="next"
        onClick={() => handleTablePageChange(tablePage + 1)}
        disabled={tablePage === tableTotalPages}
        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {'>'}
      </button>
    );
    return pages;
  };

  // In renderTablesTable, replace tables.map with paginatedTables.map, and add controls above and below
  const renderTablesTable = () => (
    <div className="overflow-x-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Tables</h2>
        <button
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition"
          onClick={() => setShowTableModal({ mode: 'add' })}
        >
          + Add Table
        </button>
      </div>
      {/* Pagination controls (top) */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-200">
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{tableStartIndex + 1}</span> to{' '}
              <span className="font-medium">{Math.min(tableEndIndex, tables.length)}</span>{' '}
              of <span className="font-medium">{tables.length}</span> results
            </p>
            <div className="flex items-center space-x-2">
              <label htmlFor="tableItemsPerPage" className="text-sm text-gray-700">Items per page:</label>
              <select
                id="tableItemsPerPage"
                value={tableItemsPerPage}
                onChange={handleTableItemsPerPageChange}
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
              {renderTablePagination()}
            </nav>
          </div>
        </div>
      </div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {tables.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-6 py-10 text-center text-gray-500">No tables found.</td>
            </tr>
          ) : (
            paginatedTables.map((table) => (
              <tr key={table.id} className={`hover:bg-gray-50 transition ${table.deleted ? 'opacity-60' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-primary">{table.number}</td>
                <td className="px-6 py-4 whitespace-nowrap">{table.name || '—'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${table.status === 'available' ? 'bg-green-100 text-green-800' : table.status === 'occupied' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>{table.status}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex justify-end space-x-2">
                    <button title="Edit" onClick={() => setShowTableModal({ mode: 'edit', table })} className="p-2 rounded hover:bg-green-100 transition text-green-600"><Pencil size={18} /></button>
                    {!table.deleted && (
                      <button title="Delete" onClick={() => setConfirmTableAction({ type: 'delete', table })} className="p-2 rounded hover:bg-red-100 transition"><Trash2 size={18} className="text-red-600" /></button>
                    )}
                    {table.deleted && (
                      <button title="Restore" onClick={() => setConfirmTableAction({ type: 'restore', table })} className="p-2 rounded hover:bg-blue-100 transition"><RotateCcw size={18} className="text-blue-600" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {/* Pagination controls (bottom) */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{tableStartIndex + 1}</span> to{' '}
              <span className="font-medium">{Math.min(tableEndIndex, tables.length)}</span>{' '}
              of <span className="font-medium">{tables.length}</span> results
            </p>
            <div className="flex items-center space-x-2">
              <label htmlFor="tableItemsPerPageBottom" className="text-sm text-gray-700">Items per page:</label>
              <select
                id="tableItemsPerPageBottom"
                value={tableItemsPerPage}
                onChange={handleTableItemsPerPageChange}
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
              {renderTablePagination()}
            </nav>
          </div>
        </div>
      </div>
      {tablesLoading && <div className="flex justify-center items-center py-4"><LoadingSpinner size={32} color={designSystem.colors.primary} /></div>}
      {/* Deleted Tables Table */}
      {deletedTables.length > 0 && (
        <div className="mt-8">
          <h3 className="text-base font-semibold mb-2 text-red-600">Deleted Tables</h3>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {deletedTables.map((table) => (
                <tr key={table.id} className="opacity-60">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-primary">{table.number}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{table.name || '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Deleted</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end space-x-2">
                      <button title="Restore" onClick={() => setConfirmTableAction({ type: 'restore', table })} className="p-2 rounded hover:bg-blue-100 transition"><RotateCcw size={18} className="text-blue-600" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // Compute paginated orders
  const orderTotalPages = Math.ceil(orders.length / orderItemsPerPage);
  const orderStartIndex = (orderPage - 1) * orderItemsPerPage;
  const orderEndIndex = orderStartIndex + orderItemsPerPage;
  const paginatedOrders = orders.slice(orderStartIndex, orderEndIndex);

  // Pagination controls
  const handleOrderPageChange = (page: number) => setOrderPage(page);
  const handleOrderItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setOrderItemsPerPage(Number(e.target.value));
    setOrderPage(1);
  };
  const renderOrderPagination = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, orderPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(orderTotalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    // Previous
    pages.push(
      <button
        key="prev"
        onClick={() => handleOrderPageChange(orderPage - 1)}
        disabled={orderPage === 1}
        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {'<'}
      </button>
    );
    if (startPage > 1) {
      pages.push(
        <button key={1} onClick={() => handleOrderPageChange(1)} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">1</button>
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
          onClick={() => handleOrderPageChange(i)}
          className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium ${orderPage === i ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          {i}
        </button>
      );
    }
    if (endPage < orderTotalPages) {
      if (endPage < orderTotalPages - 1) {
        pages.push(
          <span key="end-ellipsis" className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>
        );
      }
      pages.push(
        <button key={orderTotalPages} onClick={() => handleOrderPageChange(orderTotalPages)} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">{orderTotalPages}</button>
      );
    }
    pages.push(
      <button
        key="next"
        onClick={() => handleOrderPageChange(orderPage + 1)}
        disabled={orderPage === orderTotalPages}
        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {'>'}
      </button>
    );
    return pages;
  };

  // In renderOrdersTable, replace orders.map with paginatedOrders.map, and add controls above and below
  const renderOrdersTable = () => (
    <div className="overflow-x-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Orders</h2>
      </div>
      {/* Pagination controls (top) */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-200">
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{orderStartIndex + 1}</span> to{' '}
              <span className="font-medium">{Math.min(orderEndIndex, orders.length)}</span>{' '}
              of <span className="font-medium">{orders.length}</span> results
            </p>
            <div className="flex items-center space-x-2">
              <label htmlFor="orderItemsPerPage" className="text-sm text-gray-700">Items per page:</label>
              <select
                id="orderItemsPerPage"
                value={orderItemsPerPage}
                onChange={handleOrderItemsPerPageChange}
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
              {renderOrderPagination()}
            </nav>
          </div>
        </div>
      </div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Table</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {orders.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-6 py-10 text-center text-gray-500">No orders found.</td>
            </tr>
          ) : (
            paginatedOrders.map((order) => (
              <tr key={order.id} className={`hover:bg-gray-50 transition ${order.deleted ? 'opacity-60' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-primary">{order.id}</td>
                <td className="px-6 py-4 whitespace-nowrap">{order.tableNumber ?? '—'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${order.status === 'completed' ? 'bg-green-100 text-green-800' : order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : order.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{order.status}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{order.totalAmount ? `${order.totalAmount} FCFA` : '—'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex justify-end space-x-2">
                    <button title="View Details" onClick={() => setShowOrderDetails(order)} className="p-2 rounded hover:bg-blue-100 transition text-blue-600"><Eye size={18} /></button>
                    {!order.deleted && (
                      <button title="Delete" onClick={() => setConfirmOrderAction({ type: 'delete', order })} className="p-2 rounded hover:bg-red-100 transition"><Trash2 size={18} className="text-red-600" /></button>
                    )}
                    {order.deleted && (
                      <button title="Restore" onClick={() => setConfirmOrderAction({ type: 'restore', order })} className="p-2 rounded hover:bg-blue-100 transition"><RotateCcw size={18} className="text-blue-600" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {/* Pagination controls (bottom) */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{orderStartIndex + 1}</span> to{' '}
              <span className="font-medium">{Math.min(orderEndIndex, orders.length)}</span>{' '}
              of <span className="font-medium">{orders.length}</span> results
            </p>
            <div className="flex items-center space-x-2">
              <label htmlFor="orderItemsPerPageBottom" className="text-sm text-gray-700">Items per page:</label>
              <select
                id="orderItemsPerPageBottom"
                value={orderItemsPerPage}
                onChange={handleOrderItemsPerPageChange}
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
              {renderOrderPagination()}
            </nav>
          </div>
        </div>
      </div>
      {ordersLoading && <div className="flex justify-center items-center py-4"><LoadingSpinner size={32} color={designSystem.colors.primary} /></div>}
      {/* Deleted Orders Table */}
      {deletedOrders.length > 0 && (
        <div className="mt-8">
          <h3 className="text-base font-semibold mb-2 text-red-600">Deleted Orders</h3>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Table</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {deletedOrders.map((delOrder) => (
                <tr key={delOrder.id} className="opacity-60">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-primary">{delOrder.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{delOrder.tableNumber ?? '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Deleted</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{delOrder.totalAmount ? `${delOrder.totalAmount} FCFA` : '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end space-x-2">
                      <button title="Restore" onClick={() => setConfirmOrderAction({ type: 'restore', order: delOrder })} className="p-2 rounded hover:bg-blue-100 transition"><RotateCcw size={18} className="text-blue-600" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderSettingsTab = () => (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-10 gap-8">
        {/* Profile Form Left (70%) */}
        <div className="md:col-span-7 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Restaurant Profile</h2>
          <form onSubmit={handleProfileSave} className="space-y-6">
            {profileError && <div className="mb-2 text-red-600 text-sm">{profileError}</div>}
            {/* Logo upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
              <div className="flex items-center gap-6 flex-wrap">
                {profileForm.logoPreview ? (
                  <div className="relative">
                    <img
                      src={profileForm.logoPreview}
                      alt="Logo preview"
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="logo-upload"
                    className="cursor-pointer flex flex-col items-center justify-center w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#8B0000] transition-colors"
                  >
                    <span className="text-gray-400">Upload</span>
                    <span className="mt-2 text-xs text-gray-500">Logo</span>
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                name="name"
                className="w-full border rounded px-3 py-2"
                value={profileForm.name}
                onChange={handleProfileInput}
                required
              />
            </div>
            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                name="address"
                className="w-full border rounded px-3 py-2"
                value={profileForm.address}
                onChange={handleProfileInput}
              />
            </div>
            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                name="phone"
                className="w-full border rounded px-3 py-2"
                value={profileForm.phone}
                onChange={handleProfileInput}
              />
            </div>
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                name="description"
                className="w-full border rounded px-3 py-2"
                value={profileForm.description}
                onChange={handleProfileInput}
                rows={3}
              />
            </div>
            {/* Color Picker */}
            {settings.colorCustomization && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Colors</label>
                <ColorPicker
                  initialPrimary={profileForm.primaryColor}
                  initialSecondary={profileForm.secondaryColor}
                  onChange={(primary, secondary) => setProfileForm(prev => ({ ...prev, primaryColor: primary, secondaryColor: secondary }))}
                />
              </div>
            )}
            {/* Payment Info */}
            {settings.paymentInfo && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Info</label>
                <PaymentSetup
                  paymentInfo={profileForm.paymentInfo}
                  onPaymentInfoChange={paymentInfo => setProfileForm(prev => ({ ...prev, paymentInfo }))}
                  isRequired={false}
                />
              </div>
            )}
            {/* Email Edit */}
            <div className="border-t pt-6 mt-6">
              <h3 className="text-lg font-semibold mb-2">Change Email</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Email</label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-100 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                    placeholder="Enter new email"
                  />
                </div>
              </div>
              <div className="mt-4 md:w-1/2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password (for security)</label>
                <input
                  type="password"
                  value={emailPassword}
                  onChange={e => setEmailPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  placeholder="Current password"
                />
              </div>
              {emailError && <div className="mt-2 text-red-600 text-sm">{emailError}</div>}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  disabled={isEmailLoading || !newEmail || !emailPassword}
                  className="px-6 py-2 rounded-md bg-primary text-white font-medium disabled:opacity-50"
                  onClick={async () => {
                    setEmailError('');
                    setIsEmailLoading(true);
                    try {
                      // Implement email update logic here (see ProfileSetup.tsx for reference)
                      // ...
                      toast.success('Email updated successfully!');
                      setEmail(newEmail);
                      setNewEmail('');
                      setEmailPassword('');
                    } catch (err: any) {
                      setEmailError(err.message || 'Failed to update email');
                      toast.error(err.message || 'Failed to update email');
                    } finally {
                      setIsEmailLoading(false);
                    }
                  }}
                >
                  {isEmailLoading ? 'Updating...' : 'Update Email'}
                </button>
              </div>
            </div>
            {/* Password Edit */}
            <div className="border-t pt-6 mt-6">
              <h3 className="text-lg font-semibold mb-2">Change Password</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                      placeholder="Current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(v => !v)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400"
                      tabIndex={-1}
                    >
                      {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                      placeholder="New password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(v => !v)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(v => !v)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>
              {passwordError && <div className="mt-2 text-red-600 text-sm">{passwordError}</div>}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  disabled={isPasswordLoading || !currentPassword || !newPassword || !confirmPassword}
                  className="px-6 py-2 rounded-md bg-primary text-white font-medium disabled:opacity-50"
                  onClick={async () => {
                    setPasswordError('');
                    setIsPasswordLoading(true);
                    try {
                      // Implement password update logic here (see ProfileSetup.tsx for reference)
                      // ...
                      toast.success('Password updated successfully!');
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                    } catch (err: any) {
                      setPasswordError(err.message || 'Failed to update password');
                      toast.error(err.message || 'Failed to update password');
                    } finally {
                      setIsPasswordLoading(false);
                    }
                  }}
                >
                  {isPasswordLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="submit" className="px-4 py-2 bg-primary text-white rounded" disabled={profileLoading}>
                {profileLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
        {/* Feature Toggles Right (30%) */}
        <div className="md:col-span-3 bg-white rounded-lg shadow p-6 h-fit">
          <h2 className="text-xl font-semibold mb-4">Feature Toggles</h2>
          {Object.entries({
            orderManagement: 'Order Management',
            tableManagement: 'Table Management',
            paymentInfo: 'Payment Info',
            colorCustomization: 'Color Customization',
            publicMenuLink: 'Public Menu Link',
            publicOrderLink: 'Public Order Link',
            whatsappBulkMessaging: 'WhatsApp Bulk Messaging',
            publicDailyMenuLink: 'Public Daily Menu Link',
            templateSelection: 'Template Selection',
          }).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between py-3 border-b">
              <div className="flex items-center gap-3">
                <span className="text-gray-700 font-medium">{label}</span>
                {/* Display visitor counts for public links */}
                {key === 'publicMenuLink' && visitorStats && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Eye className="h-3 w-3" />
                    <span>{visitorStats.menuVisits || 0} visitors</span>
                  </div>
                )}
                {key === 'publicOrderLink' && visitorStats && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Eye className="h-3 w-3" />
                    <span>{visitorStats.orderVisits || 0} visitors</span>
                  </div>
                )}
                {/* Add daily menu visitor count */}
                {key === 'publicDailyMenuLink' && visitorStats && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Eye className="h-3 w-3" />
                    <span>{visitorStats.dailyMenuVisits || 0} visitors</span>
                  </div>
                )}
              </div>
              <Switch
                checked={settings[key as keyof typeof settings]}
                onChange={() => handleToggleSetting(key as keyof typeof settings)}
                className={`${settings[key as keyof typeof settings] ? 'bg-primary' : 'bg-gray-200'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none`}
                disabled={settingsLoading}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings[key as keyof typeof settings] ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </Switch>
            </div>
          ))}
          {settingsLoading && <div className="flex justify-center items-center py-2"><LoadingSpinner size={24} color={designSystem.colors.primary} /></div>}
        </div>
      </div>
    </div>
  );

  // Restore handleTableAction function
  const handleTableAction = async (type: 'delete' | 'restore', table: any) => {
    setTablesLoading(true);
    try {
      const ref = doc(db, 'tables', table.id);
      if (type === 'delete') {
        await updateDoc(ref, { deleted: true, updatedAt: serverTimestamp() });
        setTables(prev => prev.map(t => t.id === table.id ? { ...t, deleted: true } : t));
        await logActivity({
          userId: currentAdmin?.id,
          userEmail: currentAdmin?.email,
          action: 'admin_delete_table',
          entityType: 'table',
          entityId: table.id,
          details: { number: table.number, name: table.name, role: 'admin' },
        });
        toast('Table deleted.', {
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
        setTables(prev => prev.map(t => t.id === table.id ? { ...t, deleted: false } : t));
        await logActivity({
          userId: currentAdmin?.id,
          userEmail: currentAdmin?.email,
          action: 'admin_restore_table',
          entityType: 'table',
          entityId: table.id,
          details: { number: table.number, name: table.name, role: 'admin' },
        });
        toast('Table restored.', {
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
      setTablesLoading(false);
      setConfirmTableAction(null);
    }
  };

  // Restore handleTableSave function
  const handleTableSave = async (mode: 'add' | 'edit', tableData: Partial<Table>, editingTable?: any) => {
    setTablesLoading(true);
    try {
      if (mode === 'add') {
        const ref = await addDoc(collection(db, 'tables'), {
          ...tableData,
          restaurantId: restaurant.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          deleted: false,
        });
        setTables(prev => [...prev, { id: ref.id, ...tableData, deleted: false }]);
        await logActivity({
          userId: currentAdmin?.id,
          userEmail: currentAdmin?.email,
          action: 'admin_add_table',
          entityType: 'table',
          entityId: ref.id,
          details: { ...tableData, role: 'admin' },
        });
        toast.success('Table added!');
      } else if (mode === 'edit' && editingTable) {
        const ref = doc(db, 'tables', editingTable.id);
        await updateDoc(ref, {
          ...tableData,
          updatedAt: serverTimestamp(),
        });
        setTables(prev => prev.map(t => t.id === editingTable.id ? { ...t, ...tableData } : t));
        await logActivity({
          userId: currentAdmin?.id,
          userEmail: currentAdmin?.email,
          action: 'admin_edit_table',
          entityType: 'table',
          entityId: editingTable.id,
          details: { ...tableData, role: 'admin' },
        });
        toast.success('Table updated!');
      }
      setShowTableModal(null);
    } catch (err) {
      toast.error('Failed to save table.');
    } finally {
      setTablesLoading(false);
    }
  };

  // --- CSV Import State for Dishes ---
  const [isCSVModalOpen, setIsCSVModalOpen] = useState(false);
  const [csvFile, setCSVFile] = useState<File | null>(null);
  const [csvHeaders, setCSVHeaders] = useState<string[]>([]);
  const [csvRows, setCSVRows] = useState<any[]>([]);
  const [csvMapping, setCSVMapping] = useState<{ [key: string]: string }>({});
  const [csvStep, setCSVStep] = useState<'upload' | 'mapping' | 'importing' | 'done'>('upload');
  const [csvProgress, setCSVProgress] = useState(0);
  const [csvError, setCSVError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<{ total: number; success: number; failed: number; errors: string[] }>({ total: 0, success: 0, failed: 0, errors: [] });
  const dishFields = [
    { key: 'title', label: 'Title*' },
    { key: 'price', label: 'Price*' },
    { key: 'description', label: 'Description' },
    { key: 'category', label: 'Category*' },
    { key: 'status', label: 'Status (active/inactive)' },
    { key: 'image', label: 'Image URL' },
  ];

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
        complete: (results: any) => {
          if (results.errors.length) {
            setCSVError('CSV parsing error. Please check your file.');
            return;
          }
          const headers = results.meta.fields || [];
          setCSVHeaders(headers);
          setCSVRows(results.data as any[]);
          setCSVStep('mapping');
        },
        error: () => setCSVError('CSV parsing error. Please check your file.'),
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
    let updatedCategories = [...categories];
    // 1. Create categories if not found (in Firestore)
    const uniqueCategoryNames = Array.from(new Set(csvRows.map(row => row[csvMapping['category']]).filter(Boolean)));
    let totalSteps = uniqueCategoryNames.length + csvRows.length;
    let currentStep = 0;
    for (const categoryName of uniqueCategoryNames) {
      const normalizedCategoryName = categoryName.trim().toLowerCase();
      const existingCategory = updatedCategories.find(c => c.title.trim().toLowerCase() === normalizedCategoryName);
      if (categoryName && !existingCategory && !createdCategories[normalizedCategoryName]) {
        try {
          const docRef = await addDoc(collection(db, 'categories'), {
            title: categoryName,
            status: 'active',
            restaurantId: restaurant.id,
            order: 0,
            createdAt: serverTimestamp(),
            deleted: false,
          });
          createdCategories[normalizedCategoryName] = docRef.id;
          const newCat = {
            id: docRef.id,
            title: categoryName,
            status: 'active',
            restaurantId: restaurant.id,
            order: 0,
            createdAt: new Date().toISOString(),
          };
          updatedCategories.push(newCat);
          setCategories(prev => [...prev, newCat]);
        } catch (err) {
          setCSVError('Failed to create category: ' + categoryName);
          setCSVStep('mapping');
          setImportSummary(prev => ({ ...prev, failed: prev.failed + 1, errors: [...prev.errors, `Category: ${categoryName}`] }));
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
    const existingDishTitles = dishes.map(d => d.title.trim().toLowerCase());
    const newDishes: any[] = [];
    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i];
      const dishTitle = row[csvMapping['title']]?.trim().toLowerCase() || '';
      if (existingDishTitles.includes(dishTitle) || newDishes.some(d => d.title.trim().toLowerCase() === dishTitle)) {
        failed++;
        errors.push(`Duplicate dish skipped: ${row[csvMapping['title']]}`);
        currentStep++;
        setCSVProgress(Math.round((currentStep / totalSteps) * 100));
        continue;
      }
      const categoryName = row[csvMapping['category']];
      const normalizedCategoryName = categoryName ? categoryName.trim().toLowerCase() : '';
      const categoryId = createdCategories[normalizedCategoryName] || (updatedCategories.find(c => c.title.trim().toLowerCase() === normalizedCategoryName)?.id ?? '');
      const rawStatus = (row[csvMapping['status']] || 'active').toString().trim().toLowerCase();
      const status: 'active' | 'inactive' = rawStatus === 'inactive' ? 'inactive' : 'active';
      const dish = {
        title: row[csvMapping['title']] || '',
        price: parseFloat(row[csvMapping['price']] || '0'),
        description: row[csvMapping['description']] || '',
        categoryId,
        status,
        image: row[csvMapping['image']] || '/icons/placeholder.jpg',
        restaurantId: restaurant.id,
        deleted: false,
        createdAt: new Date().toISOString(),
      };
      try {
        // Add to Firestore
        const docRef = await addDoc(collection(db, 'menuItems'), {
          ...dish,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setDishes(prev => [...prev, { ...dish, id: docRef.id }]);
        success++;
        newDishes.push(dish);
      } catch (err) {
        failed++;
        errors.push(`Failed to import dish: ${dish.title}`);
      }
      currentStep++;
      setCSVProgress(Math.round((currentStep / totalSteps) * 100));
    }
    setImportSummary({ total: csvRows.length, success, failed, errors });
    setCSVStep('done');
  };

  return (
    <AdminDashboardLayout>
      <div className="mb-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-2">
          <ArrowLeft size={18} /> Back
        </button>
        <h1 className="text-2xl font-bold">{restaurant?.name || 'Restaurant'}</h1>
        {restaurant && (
          <span className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${restaurant.isDeleted ? 'bg-red-100 text-red-800' : restaurant.isDeactivated ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
            {restaurant.isDeleted ? 'Deleted' : restaurant.isDeactivated ? 'Deactivated' : 'Active'}
          </span>
        )}
      </div>
      {/* Entity Count Cards */}
      <div className="flex gap-4 mb-6">
        <Card title="Dishes" value={counts.dishes} />
        <Card title="Categories" value={counts.categories} />
        <Card title="Tables" value={counts.tables} />
        <Card title="Orders" value={counts.orders} />
      </div>
      {/* Client Links Card */}
      {restaurant?.id && (
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-2 mb-3">
            <LinkIcon size={18} className="text-gray-600" />
            <h2 className="text-lg font-semibold">Client Links</h2>
          </div>
          <div className="space-y-3">
            {[
              { key: 'publicMenu', label: 'Public Menu', path: `/public-menu/${restaurant.id}` },
              { key: 'publicDailyMenu', label: 'Public Daily Menu', path: `/public-daily-menu/${restaurant.id}` },
              { key: 'publicOrder', label: 'Public Ordering', path: `/public-order/${restaurant.id}` },
              { key: 'customerMenu', label: 'Customer Menu (with cart)', path: `/menu/${restaurant.id}` },
            ].map(link => {
              const url = `${window.location.origin}${link.path}`;
              const perLinkCount =
                link.key === 'publicMenu'
                  ? (visitorStats?.menuVisits || 0)
                  : link.key === 'publicDailyMenu'
                  ? (visitorStats?.dailyMenuVisits || 0)
                  : link.key === 'publicOrder'
                  ? (visitorStats?.orderVisits || 0)
                  : undefined;
              return (
                <div key={link.key} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border border-gray-100 rounded-md p-3">
                  <div>
                    <div className="text-sm font-medium text-gray-800 flex items-center gap-2">
                      <span>{link.label}</span>
                      {typeof perLinkCount === 'number' && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-600">
                          <Eye className="h-3 w-3" />
                          <span>{perLinkCount}</span>
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 break-all font-mono">{url}</div>
                  </div>
                  <div className="flex items-center gap-2 relative">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(url);
                          setCopiedLinkKey(link.key);
                          toast.success('Link copied to clipboard');
                          setTimeout(() => setCopiedLinkKey(prev => (prev === link.key ? null : prev)), 1500);
                        } catch {
                          toast.error('Failed to copy');
                        }
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50"
                      aria-label={`Copy ${link.label} URL`}
                    >
                      {copiedLinkKey === link.key ? <Check size={16} className="text-green-600" /> : <Copy size={16} className="text-gray-600" />}
                      <span>{copiedLinkKey === link.key ? 'Copied' : 'Copy'}</span>
                    </button>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-primary text-white hover:bg-primary-dark"
                      aria-label={`Open ${link.label} in new tab`}
                    >
                      <ExternalLink size={16} />
                      <span>Open</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setOpenShareKey(prev => (prev === link.key ? null : link.key))}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50"
                      aria-haspopup="menu"
                      aria-expanded={openShareKey === link.key}
                      aria-label={`Share ${link.label}`}
                    >
                      <Share2 size={16} className="text-gray-700" />
                      <span>Share</span>
                    </button>
                    {openShareKey === link.key && (
                      <div className="absolute right-0 top-10 z-10 w-56 bg-white border border-gray-200 rounded-md shadow-lg p-2">
                        <div className="text-xs text-gray-500 px-2 py-1">Share via</div>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(`${link.label} - ${url}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-50 text-sm"
                          onClick={() => setOpenShareKey(null)}
                        >
                          <MessageCircle size={16} className="text-green-600" />
                          <span>WhatsApp</span>
                        </a>
                        <a
                          href={`mailto:?subject=${encodeURIComponent(`RestoFlow - ${link.label}`)}&body=${encodeURIComponent(url)}`}
                          className="flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-50 text-sm"
                          onClick={() => setOpenShareKey(null)}
                        >
                          <Mail size={16} className="text-blue-600" />
                          <span>Email</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Tabs */}
      <div className="mb-4 flex gap-2 border-b">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`px-4 py-2 -mb-px border-b-2 font-medium transition ${activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-primary'}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow p-6 min-h-[300px]">
        {loading ? (
          <div className="flex justify-center items-center h-32"><LoadingSpinner size={48} color={designSystem.colors.primary} /></div>
        ) : activeTab === 'dishes' ? (
          renderDishesTable()
        ) : activeTab === 'categories' ? (
          renderCategoriesTable()
        ) : activeTab === 'tables' ? (
          renderTablesTable()
        ) : activeTab === 'orders' ? (
          renderOrdersTable()
        ) : activeTab === 'settings' ? (
          renderSettingsTab()
        ) : (
          <div className="text-gray-400">Coming soon...</div>
        )}
      </div>
      {/* Confirmation Modal for Dishes */}
      {confirmAction && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2">Confirm {confirmAction.type === 'delete' ? 'Delete' : 'Restore'}</h2>
            <p className="mb-4">Are you sure you want to {confirmAction.type} <span className="font-semibold">{confirmAction.dish.title}</span>?</p>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => setConfirmAction(null)}>Cancel</button>
              <button className="px-4 py-2 bg-primary text-white rounded" onClick={() => handleDishAction(confirmAction.type as any, confirmAction.dish)}>Confirm</button>
            </div>
          </div>
        </div>
      )}
      {/* Confirmation Modal for Categories */}
      {confirmCategoryAction && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2">Confirm {confirmCategoryAction.type === 'delete' ? 'Delete' : 'Restore'}</h2>
            <p className="mb-4">Are you sure you want to {confirmCategoryAction.type} <span className="font-semibold">{confirmCategoryAction.category.title}</span>?</p>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => setConfirmCategoryAction(null)}>Cancel</button>
              <button className="px-4 py-2 bg-primary text-white rounded" onClick={() => handleCategoryAction(confirmCategoryAction.type, confirmCategoryAction.category)}>Confirm</button>
            </div>
          </div>
        </div>
      )}
      {/* Add/Edit Modal for Categories */}
      {showCategoryModal && (showCategoryModal.mode === 'add' || showCategoryModal.mode === 'edit') && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50" onClick={e => { if (e.target === e.currentTarget) setShowCategoryModal(null); }}>
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">
              {showCategoryModal.mode === 'add' ? 'Add Category' : 'Edit Category'}
            </h2>
            <CategoryModalContent
              mode={showCategoryModal.mode}
              category={showCategoryModal.category}
              onClose={() => setShowCategoryModal(null)}
              onSave={data => handleCategorySave(showCategoryModal.mode, data, showCategoryModal.category)}
              categories={categories}
            />
          </div>
        </div>
      )}
      {/* Add/Edit/Details Modal (filled) */}
      {showAddEditModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50" onClick={e => { if (e.target === e.currentTarget) setShowAddEditModal(null); }}>
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Modal content based on mode: add, edit, details */}
            <h2 className="text-lg font-bold mb-4">
              {showAddEditModal.mode === 'add' ? 'Add Dish' : showAddEditModal.mode === 'edit' ? 'Edit Dish' : 'Dish Details'}
            </h2>
            <DishModalContent
              mode={showAddEditModal.mode}
              dish={showAddEditModal.dish}
              categories={categories}
              restaurantId={restaurant?.id}
              onClose={() => setShowAddEditModal(null)}
              onSave={async (dishData) => {
                setDishesLoading(true);
                try {
                  if (showAddEditModal.mode === 'add') {
                    const ref = await addDoc(collection(db, 'menuItems'), {
                      ...dishData,
                      restaurantId: restaurant.id,
                      createdAt: serverTimestamp(),
                      updatedAt: serverTimestamp(),
                      deleted: false,
                    });
                    setDishes(prev => [...prev, { id: ref.id, ...dishData, deleted: false }]);
                    await logActivity({
                      userId: currentAdmin?.id,
                      userEmail: currentAdmin?.email,
                      action: 'admin_add_dish',
                      entityType: 'dish',
                      entityId: ref.id,
                      details: { ...dishData, role: 'admin' },
                    });
                    toast.success('Dish added!');
                  } else if (showAddEditModal.mode === 'edit') {
                    const ref = doc(db, 'menuItems', showAddEditModal.dish.id);
                    await updateDoc(ref, {
                      ...dishData,
                      updatedAt: serverTimestamp(),
                    });
                    setDishes(prev => prev.map(d => d.id === showAddEditModal.dish.id ? { ...d, ...dishData } : d));
                    await logActivity({
                      userId: currentAdmin?.id,
                      userEmail: currentAdmin?.email,
                      action: 'admin_edit_dish',
                      entityType: 'dish',
                      entityId: showAddEditModal.dish.id,
                      details: { ...dishData, role: 'admin' },
                    });
                    toast.success('Dish updated!');
                  }
                  setShowAddEditModal(null);
                } catch (err) {
                  toast.error('Failed to save dish.');
                } finally {
                  setDishesLoading(false);
                }
              }}
            />
          </div>
        </div>
      )}
      {/* Confirmation Modal for Tables */}
      {confirmTableAction && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2">Confirm {confirmTableAction.type === 'delete' ? 'Delete' : 'Restore'}</h2>
            <p className="mb-4">Are you sure you want to {confirmTableAction.type} <span className="font-semibold">Table {confirmTableAction.table.number}</span>?</p>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => setConfirmTableAction(null)}>Cancel</button>
              <button className="px-4 py-2 bg-primary text-white rounded" onClick={() => handleTableAction(confirmTableAction.type, confirmTableAction.table)}>Confirm</button>
            </div>
          </div>
        </div>
      )}
      {/* Add/Edit Modal for Tables */}
      {showTableModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50" onClick={e => { if (e.target === e.currentTarget) setShowTableModal(null); }}>
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">
              {showTableModal.mode === 'add' ? 'Add Table' : 'Edit Table'}
            </h2>
            <TableModalContent
              mode={showTableModal.mode}
              table={showTableModal.table}
              onClose={() => setShowTableModal(null)}
              onSave={data => handleTableSave(showTableModal.mode, data, showTableModal.table)}
            />
          </div>
        </div>
      )}
      {/* Confirmation Modal for Orders */}
      {confirmOrderAction && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2">Confirm {confirmOrderAction.type === 'delete' ? 'Delete' : 'Restore'}</h2>
            <p className="mb-4">Are you sure you want to {confirmOrderAction.type} <span className="font-semibold">Order {confirmOrderAction.order.id}</span>?</p>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => setConfirmOrderAction(null)}>Cancel</button>
              <button className="px-4 py-2 bg-primary text-white rounded" onClick={() => handleOrderAction(confirmOrderAction.type, confirmOrderAction.order)}>Confirm</button>
            </div>
          </div>
        </div>
      )}
      {/* Details Modal for Orders */}
      {showOrderDetails && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50" onClick={e => { if (e.target === e.currentTarget) setShowOrderDetails(null); }}>
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Order Details</h2>
            <OrderDetailsModalContent order={showOrderDetails} onClose={() => setShowOrderDetails(null)} />
          </div>
        </div>
      )}
      {isCSVModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50" onClick={closeCSVModal}>
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto relative" onClick={e => e.stopPropagation()}>
            {/* Close icon top right */}
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-2xl font-bold focus:outline-none"
              onClick={closeCSVModal}
              aria-label="Close"
              type="button"
            >
              ×
            </button>
            <h2 className="text-lg font-bold mb-4">Import Dishes from CSV</h2>
            {/* CSV Modal Steps */}
            {csvStep === 'upload' && (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-blue-400 rounded-lg p-6 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer relative w-full max-w-md mx-auto"
                  onClick={() => document.getElementById('csv-upload-input')?.click()}
                  tabIndex={0}
                  onKeyPress={e => { if (e.key === 'Enter') document.getElementById('csv-upload-input')?.click(); }}
                  role="button"
                  aria-label="Upload CSV file"
                >
                  <span className="text-base font-medium text-blue-700">Click or drag CSV file to upload</span>
                  <span className="text-xs text-blue-500 mt-1">Only .csv files are supported</span>
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
                        aria-label="Remove file"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
                {csvError && <div className="text-red-500 text-sm text-center">{csvError}</div>}
              </div>
            )}
            {csvStep === 'mapping' && (
              <div className="space-y-4">
                <div className="text-sm text-gray-700">Map CSV columns to dish fields:</div>
                {dishFields.map(field => (
                  <div key={field.key} className="flex items-center gap-2">
                    <label className="w-40 text-gray-700">{field.label}</label>
                    <select
                      value={csvMapping[field.key] || ''}
                      onChange={e => handleCSVMappingChange(field.key, e.target.value)}
                      className="block w-60 py-2 px-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
                    >
                      <option value="">-- Not mapped --</option>
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
                  Start Import
                </button>
              </div>
            )}
            {csvStep === 'importing' && (
              <div className="space-y-4">
                <div className="text-sm text-gray-700">Importing dishes... Please wait.</div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                    style={{ width: `${csvProgress}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500">{csvProgress}% complete</div>
              </div>
            )}
            {csvStep === 'done' && (
              <div className="space-y-4">
                <div className="text-green-600 text-sm font-medium">Import complete!</div>
                <div className="text-sm text-gray-700">
                  <div>Total rows processed: <b>{importSummary.total}</b></div>
                  <div>Successfully imported: <b>{importSummary.success}</b></div>
                  <div>Skipped/Failed: <b>{importSummary.failed}</b></div>
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
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminDashboardLayout>
  );
};

export default RestaurantDetail;

// DishModalContent component (to be placed at the end of the file)
interface DishModalContentProps {
  mode: 'add' | 'edit' | 'details';
  dish?: Dish;
  categories: Category[];
  restaurantId?: string;
  onClose: () => void;
  onSave: (dishData: Partial<Dish>) => void;
}

function DishModalContent({ mode, dish, categories, onClose, onSave }: DishModalContentProps) {
  const [title, setTitle] = useState<string>(dish?.title || '');
  const [price, setPrice] = useState<string | number>(dish?.price || '');
  const [categoryId, setCategoryId] = useState<string>(dish?.categoryId || (categories[0]?.id || ''));
  const [status, setStatus] = useState<'active' | 'inactive'>(dish?.status || 'active');
  const [description, setDescription] = useState<string>(dish?.description || '');
  const [image, setImage] = useState<string | undefined>(dish?.image || undefined);
  const [, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');
  const isDetails = mode === 'details';

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImage(undefined);
    setImageFile(null);
  };

  const handleSave = () => {
    setError('');
    if (!title.trim() || !price || !categoryId) {
      setError('Title, price, and category are required.');
      return;
    }
    onSave({
      title: title.trim(),
      price: Number(price),
      categoryId,
      status,
      description,
      image: image || undefined,
    });
  };

  return (
    <form onSubmit={e => { e.preventDefault(); if (!isDetails) handleSave(); }}>
      {error && <div className="mb-2 text-red-600 text-sm">{error}</div>}
      <div className="flex flex-col gap-4">
        {/* Image upload/preview styled like dashboard */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
          <div className="flex items-center gap-6 flex-wrap">
            {image ? (
              <div className="relative">
                <img
                  src={image}
                  alt="Dish"
                  className="w-24 h-24 object-cover rounded-lg"
                />
                {!isDetails && (
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>
            ) : (
              !isDetails && (
                <label
                  htmlFor="dish-image-upload"
                  className="cursor-pointer flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#8B0000] transition-colors"
                >
                  <span className="text-gray-400">Upload</span>
                  <span className="mt-2 text-xs text-gray-500">Image</span>
                  <input
                    id="dish-image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )
            )}
          </div>
        </div>
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={isDetails}
            required
          />
        </div>
        {/* Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Price (FCFA)</label>
          <input
            type="number"
            className="w-full border rounded px-3 py-2"
            value={price}
            onChange={e => setPrice(e.target.value)}
            disabled={isDetails}
            required
            min={0}
          />
        </div>
        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            disabled={isDetails}
            required
          >
            {categories.map((cat: Category) => (
              <option key={cat.id} value={cat.id}>{cat.title}</option>
            ))}
          </select>
        </div>
        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={status}
            onChange={e => setStatus(e.target.value as 'active' | 'inactive')}
            disabled={isDetails}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            className="w-full border rounded px-3 py-2"
            value={description}
            onChange={e => setDescription(e.target.value)}
            disabled={isDetails}
            rows={3}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button type="button" className="px-4 py-2 bg-gray-200 rounded" onClick={onClose}>Close</button>
        {!isDetails && (
          <button type="submit" className="px-4 py-2 bg-primary text-white rounded">Save</button>
        )}
      </div>
    </form>
  );
}

// Category Modal Component
function CategoryModalContent({ category, onClose, onSave, categories }: { mode: 'add' | 'edit'; category?: Category; onClose: () => void; onSave: (data: Partial<Category>) => void; categories: Category[] }) {
  const [title, setTitle] = useState<string>(category?.title || '');
  const [status, setStatus] = useState<'active' | 'inactive'>(category?.status || 'active');
  const [order, setOrder] = useState<number>(category?.order ?? 0);
  const [error, setError] = useState<string>('');
  const [parentCategoryId, setParentCategoryId] = useState<string>(category?.parentCategoryId || '');

  const handleSave = () => {
    setError('');
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    onSave({ title: title.trim(), status, order, parentCategoryId: parentCategoryId || undefined });
  };

  return (
    <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
      {error && <div className="mb-2 text-red-600 text-sm">{error}</div>}
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={status}
            onChange={e => setStatus(e.target.value as 'active' | 'inactive')}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
          <input
            type="number"
            className="w-full border rounded px-3 py-2"
            value={order}
            onChange={e => setOrder(Number(e.target.value))}
            min={0}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Parent Category</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={parentCategoryId}
            onChange={e => setParentCategoryId(e.target.value)}
          >
            <option value="">None (Main Category)</option>
            {categories.filter((c: Category) => !category || (c.id !== category.id && c.parentCategoryId !== category.id)).map((c: Category) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button type="button" className="px-4 py-2 bg-gray-200 rounded" onClick={onClose}>Close</button>
        <button type="submit" className="px-4 py-2 bg-primary text-white rounded">Save</button>
      </div>
    </form>
  );
}

// Table Modal Component
function TableModalContent({ table, onClose, onSave }: { mode: 'add' | 'edit'; table?: any; onClose: () => void; onSave: (data: Partial<Table>) => void }) {
  const [number, setNumber] = useState<number>(table?.number || 1);
  const [name, setName] = useState<string>(table?.name || '');
  const [status, setStatus] = useState<'available' | 'occupied' | 'reserved'>(table?.status || 'available');
  const [error, setError] = useState<string>('');

  const handleSave = () => {
    setError('');
    if (!number || number <= 0) {
      setError('Table number is required and must be greater than 0.');
      return;
    }
    onSave({ number, name, status });
  };

  return (
    <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
      {error && <div className="mb-2 text-red-600 text-sm">{error}</div>}
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Table Number</label>
          <input
            type="number"
            className="w-full border rounded px-3 py-2"
            value={number}
            onChange={e => setNumber(Number(e.target.value))}
            min={1}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Table Name (optional)</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={`Table ${number}`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={status}
            onChange={e => setStatus(e.target.value as 'available' | 'occupied' | 'reserved')}
          >
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="occupied">Occupied</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button type="button" className="px-4 py-2 bg-gray-200 rounded" onClick={onClose}>Close</button>
        <button type="submit" className="px-4 py-2 bg-primary text-white rounded">Save</button>
      </div>
    </form>
  );
}

// Enhanced Order Details Modal Component
function OrderDetailsModalContent({ order, onClose }: { order: any; onClose: () => void }) {
  const statusColors: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    preparing: 'bg-blue-100 text-blue-800',
    ready: 'bg-cyan-100 text-cyan-800',
    cancelled: 'bg-red-100 text-red-800',
    deleted: 'bg-gray-200 text-gray-500',
  };
  const status = typeof order.status === 'string' ? order.status : '';
  const statusClass = statusColors[status] || 'bg-gray-100 text-gray-700';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
        <div>
          <div className="font-semibold text-primary text-lg flex items-center gap-2">
            <span>Order</span>
            <span className="font-mono text-base bg-gray-100 px-2 py-0.5 rounded">{order.id}</span>
            <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${statusClass}`}>{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</span>
          </div>
          <div className="text-sm text-gray-500 mt-1">Table: <span className="font-semibold text-gray-700">{order.tableNumber ?? '—'}</span></div>
        </div>
        <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-medium transition" onClick={onClose}>Close</button>
      </div>
      {/* Divider */}
      <div className="border-b" />
      {/* Items Table */}
      <div>
        <h3 className="font-semibold mb-3 text-gray-800">Ordered Items</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-100 bg-gray-50">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Dish</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase">Price</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase">Subtotal</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {order.items?.map((item: any, idx: number) => (
                <tr key={idx}>
                  <td className="px-3 py-2 flex items-center gap-2">
                    {item.image && (
                      <img src={item.image} alt={item.title} className="w-8 h-8 rounded object-cover border" />
                    )}
                    <span className="font-medium text-primary">{item.title}</span>
                  </td>
                  <td className="px-3 py-2 text-center">{item.quantity}</td>
                  <td className="px-3 py-2 text-right">{item.price ? `${item.price} FCFA` : '—'}</td>
                  <td className="px-3 py-2 text-right">{item.price && item.quantity ? `${item.price * item.quantity} FCFA` : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right font-bold text-gray-700">Total</td>
                <td className="px-3 py-2 text-right font-bold text-primary">{order.totalAmount ? `${order.totalAmount} FCFA` : '—'}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      {/* Divider */}
      <div className="border-b" />
      {/* Summary Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div className="space-y-1">
          <div className="text-gray-500">Created:</div>
          <div className="font-medium text-gray-700">{order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : '—'}</div>
        </div>
        <div className="space-y-1">
          <div className="text-gray-500">Last Updated:</div>
          <div className="font-medium text-gray-700">{order.updatedAt?.toDate ? order.updatedAt.toDate().toLocaleString() : '—'}</div>
        </div>
      </div>
    </div>
  );
} 