import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../../../firebase/config';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  orderBy,
  addDoc,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
// import { useOfflineStorage } from '../../hooks/useOfflineStorage';
import { toast } from 'react-hot-toast';
import { 
  ShoppingCart,
  PlusCircle, 
  MinusCircle,
  Trash2,
  ChefHat,
  Table,
  ArrowLeft,
  Search,
  X,
  Menu as MenuIcon
} from 'lucide-react';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { Restaurant, Dish as MenuItem, Category, OrderItem } from '../../../types';
import DishDetailModal from './DishDetailModal';
import { Eye } from 'lucide-react';

const MenuPage: React.FC = () => {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [, setSidebarOpen] = useState(false);
  const [selectedDish, setSelectedDish] = useState<MenuItem | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const categoryTabsRef = useRef<HTMLDivElement | null>(null);
  
  // Helper to navigate to orders page
  const ordersPageUrl = tableNumber && restaurantId
    ? `/customer/orders/${tableNumber}`
    : undefined;

  useEffect(() => {
    // Get the selected table from localStorage
    const storedTable = localStorage.getItem('selectedTable');
    if (storedTable) {
      setTableNumber(parseInt(storedTable));
    }

    // Get the cart from localStorage
    const storedCart = localStorage.getItem(`cart_${restaurantId}`);
    if (storedCart) {
      try {
        setCart(JSON.parse(storedCart));
      } catch (error) {
        localStorage.removeItem(`cart_${restaurantId}`);
      }
    }

    const fetchRestaurantData = async () => {
      if (!restaurantId) return;

      try {
        // Fetch restaurant details
        const restaurantDoc = await getDoc(doc(db, 'restaurants', restaurantId));
        if (restaurantDoc.exists()) {
          setRestaurant({ id: restaurantDoc.id, ...restaurantDoc.data() } as Restaurant);
        }

        if (!navigator.onLine) {
          // Offline: load from localStorage
          const offlineCategories = localStorage.getItem('offline_menuCategories');
          const offlineMenuItems = localStorage.getItem('offline_menuItems');
          setCategories(offlineCategories ? JSON.parse(offlineCategories).filter((c:any)=>c.restaurantId===restaurantId&&c.status==='active') : []);
          setMenuItems(offlineMenuItems ? JSON.parse(offlineMenuItems).filter((m:any)=>m.restaurantId===restaurantId&&m.status==='active') : []);
          setLoading(false);
        } else {
          // Online: Set up real-time listeners for categories and menu items
          // Categories listener
          const categoriesQuery = query(
            collection(db, 'categories'),
            where('restaurantId', '==', restaurantId),
            where('status', '==', 'active'),
            orderBy('title')
          );
          
          const categoriesUnsub = onSnapshot(categoriesQuery, (categoriesSnapshot) => {
            const categoriesData = categoriesSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as Category[];
            setCategories(categoriesData);
          }, (error) => {
            console.error('Error listening to categories:', error);
            setCategories([]);
          });

          // Menu items listener
          const menuItemsQuery = query(
            collection(db, 'menuItems'),
            where('restaurantId', '==', restaurantId),
            where('status', '==', 'active'),
            orderBy('title')
          );
          
          const menuItemsUnsub = onSnapshot(menuItemsQuery, (menuItemsSnapshot) => {
            const menuItemsData = menuItemsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as MenuItem[];
            setMenuItems(menuItemsData);
          }, (error) => {
            console.error('Error listening to menu items:', error);
            setMenuItems([]);
          });

          // Set loading to false after initial data load
          const timer = setTimeout(() => {
            setLoading(false);
          }, 1000);

          // Store unsubscribers for cleanup
          return () => {
            categoriesUnsub();
            menuItemsUnsub();
            clearTimeout(timer);
          };
        }
      } catch (error) {
        console.error('Error fetching restaurant data:', error);
        toast.error('Failed to load menu');
        setLoading(false);
      }
    };

    const cleanup = fetchRestaurantData();
    return () => {
      if (cleanup && typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, [restaurantId]);

  useEffect(() => {
    // Save cart to localStorage whenever it changes
    if (restaurantId && cart.length > 0) {
      localStorage.setItem(`cart_${restaurantId}`, JSON.stringify(cart));
    } else if (restaurantId) {
      localStorage.removeItem(`cart_${restaurantId}`);
    }
  }, [cart, restaurantId]);

  const addToCart = (item: MenuItem) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(cartItem => cartItem.menuItemId === item.id);
      
      if (existingItem) {
        // Item already exists in cart, increment quantity
        return prevCart.map(cartItem => 
          cartItem.menuItemId === item.id 
            ? { ...cartItem, quantity: cartItem.quantity + 1 } 
            : cartItem
        );
      } else {
        // Item not in cart, add it
        return [...prevCart, {
          id: Date.now().toString(),
          menuItemId: item.id,
          title: item.title,
          price: item.price,
          quantity: 1,
        }];
      }
    });
    
    toast.success(`${item.title} added to cart`);
  };

  const decrementItem = (itemId: string) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(cartItem => cartItem.id === itemId);
      
      if (existingItem && existingItem.quantity > 1) {
        // Decrement quantity if more than 1
        return prevCart.map(cartItem => 
          cartItem.id === itemId 
            ? { ...cartItem, quantity: cartItem.quantity - 1 } 
            : cartItem
        );
      } else {
        // Remove item if quantity would become 0
        return prevCart.filter(cartItem => cartItem.id !== itemId);
      }
    });
  };

  const incrementItem = (itemId: string) => {
    setCart(prevCart => 
      prevCart.map(cartItem => 
        cartItem.id === itemId 
          ? { ...cartItem, quantity: cartItem.quantity + 1 } 
          : cartItem
      )
    );
  };

  const removeItem = (itemId: string) => {
    setCart(prevCart => prevCart.filter(cartItem => cartItem.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
    toast.success('Cart cleared');
  };

  // Use pendingOrders for offline queue
  const submitOrder = async () => {
    if (!restaurantId || !tableNumber || cart.length === 0) {
      toast.error('Cannot place order. Please check your table and cart.');
      return;
    }
    setSubmittingOrder(true);
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const orderPayload = {
      items: cart,
      tableNumber,
      restaurantId,
      status: 'pending',
      totalAmount,
      createdAt: new Date().toISOString(),
    };
    if (!navigator.onLine) {
      // Offline: queue the order for later sync in pendingOrders
      const pendingOrders = JSON.parse(localStorage.getItem('pendingOrders') || '[]');
      pendingOrders.push({ type: 'createOrder', payload: orderPayload, timestamp: Date.now() });
      localStorage.setItem('pendingOrders', JSON.stringify(pendingOrders));
      setCart([]);
      localStorage.removeItem(`cart_${restaurantId}`);
      toast.success('Order will be sent when back online!');
      setShowCart(false);
      setSubmittingOrder(false);
      return;
    }
    try {
      // Online: send to Firestore
      await addDoc(collection(db, 'orders'), {
        ...orderPayload,
        createdAt: serverTimestamp(),
      });
      setCart([]);
      localStorage.removeItem(`cart_${restaurantId}`);
      toast.success('Order placed successfully!');
      setShowCart(false);
    } catch (error) {
      console.error('Error submitting order:', error);
      toast.error('Failed to place order');
    } finally {
      setSubmittingOrder(false);
    }
  };

  // --- Scroll Spy Effect ---
  useEffect(() => {
    if (!categories.length) return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY + 120; // Offset for sticky header
          let found = 'all';
          for (const cat of categories) {
            const ref = sectionRefs.current[cat.id];
            if (ref) {
              const { top } = ref.getBoundingClientRect();
              if (top + window.scrollY - 120 <= scrollY) {
                found = cat.id;
              }
            }
          }
          setActiveCategory(found);
          // Scroll the active tab into view
          const tab = document.getElementById(`category-tab-${found}`);
          if (tab && tab.scrollIntoView) {
            tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [categories]);

  // --- Scroll to Section ---
  const handleCategoryClick = (catId: string) => {
    setSelectedCategory(catId);
    setActiveCategory(catId);
    if (catId === 'all') {
      window.scrollTo({ top: categoryTabsRef.current?.offsetTop! + 1 - 64, behavior: 'smooth' });
      return;
    }
    const ref = sectionRefs.current[catId];
    if (ref) {
      const y = ref.getBoundingClientRect().top + window.scrollY - 64; // 64px header offset
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
    // Scroll the tab into view
    const tab = document.getElementById(`category-tab-${catId}`);
    if (tab && tab.scrollIntoView) {
      tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  // --- Group dishes by category for section rendering ---
  const dishesByCategory = React.useMemo(() => {
    const map: { [catId: string]: MenuItem[] } = {};
    categories.forEach(cat => {
      map[cat.id] = menuItems.filter(item => item.categoryId === cat.id);
    });
    return map;
  }, [categories, menuItems]);


  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <LoadingSpinner size={60} />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <ChefHat size={48} className="text-primary mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Restaurant Not Found</h1>
        <p className="text-gray-600 mb-6">The restaurant you're looking for does not exist.</p>
        <Link
          to="/table-selection"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Restaurant Selection
        </Link>
      </div>
    );
  }

  if (!tableNumber) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <ChefHat size={48} className="text-primary mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{restaurant.name}</h1>
        <p className="text-gray-600 mb-6">Please select a table to continue.</p>
        <Link
          to="/table-selection"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        >
          <Table size={16} className="mr-2" />
          Select a Table
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Sticky Header + Category Tabs */}
      <div className="sticky top-0 z-30 bg-primary shadow-md">
        {/* Header */}
        <header className="text-white">
          <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
            <div className="flex flex-col sm:flex-row justify-between items-center py-3">
              <div className="flex items-center w-full sm:w-auto mb-2 sm:mb-0">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="mr-2 md:hidden"
                >
                  <MenuIcon size={24} />
                </button>
                <div className="flex items-center">
                  {restaurant?.logo ? (
                    <img
                      src={restaurant.logo}
                      alt={restaurant.name}
                      className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover border-2 shadow-md bg-white transition-all duration-200 flex-shrink-0"
                      style={{ borderColor: 'var(--color-accent, #f59e42)', background: 'white', aspectRatio: '1/1' }}
                    />
                  ) : (
                    <ChefHat size={24} className="mr-3" />
                  )}
                  <div className="flex flex-col">
                    <h1 className="text-xl font-bold text-white drop-shadow-md">{restaurant?.name}</h1>
                    <div className="flex items-center">
                      <Table size={14} className="mr-1" />
                      <span className="text-sm">Table #{tableNumber}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center w-full sm:w-auto justify-end">
                <button
                  onClick={() => setShowCart(true)}
                  className="relative p-2 rounded-full hover:bg-primary-dark transition-colors"
                >
                  <ShoppingCart size={24} />
                  {totalCartItems > 0 && (
                    <span className={`absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-accent rounded-full`}>
                      {totalCartItems}
                    </span>
                  )}
                </button>
                {ordersPageUrl && (
                  <Link
                    to={ordersPageUrl}
                    className="ml-4 px-4 py-2 rounded-md bg-white text-primary font-semibold border border-primary hover:bg-primary hover:text-white transition-colors"
                  >
                    View My Orders
                  </Link>
                )}
              </div>
            </div>
          </div>
        </header>
        {/* Category Tabs */}
        <div
          ref={categoryTabsRef}
          className="bg-white pt-2 pb-2 border-b border-gray-200 shadow-sm"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
            <div className="flex space-x-2 overflow-x-auto no-scrollbar py-2">
              <button
                onClick={() => handleCategoryClick('all')}
                className={`flex-shrink-0 px-5 py-2 rounded-full font-bold text-base sm:text-lg transition ${
                  activeCategory === 'all'
                    ? 'bg-primary text-white shadow'
                    : 'bg-gray-100 text-gray-700 hover:bg-primary/10'
                }`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  id={`category-tab-${cat.id}`}
                  onClick={() => handleCategoryClick(cat.id)}
                  className={`flex-shrink-0 px-5 py-2 rounded-full font-bold text-base sm:text-lg transition ${
                    activeCategory === cat.id
                      ? 'bg-primary text-white shadow'
                      : 'bg-gray-100 text-gray-700 hover:bg-primary/10'
                  }`}
                >
                  {cat.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-2">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes..."
              className="pl-9 p-2 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-rose focus:border-rose text-xs sm:text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Menu Sections */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-1 sm:px-4 lg:px-6 pt-2">
        {selectedCategory === 'all' && (
          <div>
            {categories.map((cat, idx) => (
              <div
                key={cat.id}
                ref={el => (sectionRefs.current[cat.id] = el)}
                className={`mb-10 ${idx !== 0 ? 'pt-6' : ''}`}
              >
                <h2
                  className="text-lg sm:text-xl font-bold text-gray-900 mb-4"
                  style={{
                    top: 104, // header + tabs height
                    background: 'rgba(249,250,251,0.97)',
                    zIndex: 10,
                  }}
                >
                  {cat.title}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
                  {dishesByCategory[cat.id]?.length ? (
                    dishesByCategory[cat.id]
                      .filter(item => {
                        const matchesSearch = searchQuery
                          ? item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
                          : true;
                        return matchesSearch;
                      })
                      .map(item => (
                        <div
                          key={item.id}
                          className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full cursor-pointer group min-h-0 flex-1"
                          style={{ minHeight: '220px', maxHeight: '370px' }}
                          onClick={() => {
                            setSelectedDish(item);
                            setModalOpen(true);
                          }}
                        >
                          {/* Dish section (clickable) */}
                          {item.image ? (
                            <div className="h-32 sm:h-48 w-full overflow-hidden">
                              <img
                                src={item.image}
                                alt={item.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="h-32 sm:h-48 w-full bg-gray-100 flex items-center justify-center">
                              <img
                                src="/icons/placeholder.png"
                                alt="No dish"
                                className="h-16 w-16 opacity-60"
                              />
                            </div>
                          )}
                          <div className="p-3 flex-1 flex flex-col w-full">
                            <div>
                              <h3 className="text-base sm:text-lg font-medium text-gray-900 truncate">
                                {item.title}
                              </h3>
                              {item.description && (
                                <p className="mt-1 text-xs sm:text-sm text-gray-500 line-clamp-2">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            <div className="text-base sm:text-lg font-semibold text-primary mt-2">
                              {item.price.toLocaleString()} FCFA
                            </div>
                            {/* Order button (stop click propagation so it doesn't open modal) */}
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                addToCart(item);
                              }}
                              className="mt-auto w-full inline-flex justify-center items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-xs sm:text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                            >
                              <PlusCircle size={14} className="mr-2" />
                              Add to Order
                            </button>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="bg-white rounded-lg shadow-sm p-8 text-center col-span-full">
                      <p className="text-gray-500 text-xs sm:text-base">No items in this category</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Single Category Section */}
        {selectedCategory !== 'all' && (
          <div
            ref={el => (sectionRefs.current[selectedCategory] = el)}
            className="mb-10 pt-6"
          >
            <h2
              className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sticky"
              style={{
                top: 104,
                background: 'rgba(249,250,251,0.97)',
                zIndex: 10,
              }}
            >
              {categories.find(c => c.id === selectedCategory)?.title || 'Dishes'}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
              {dishesByCategory[selectedCategory]?.length ? (
                dishesByCategory[selectedCategory]
                  .filter(item => {
                    const matchesSearch = searchQuery 
                      ? item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
                      : true;
                    return matchesSearch;
                  })
                  .map(item => (
                    <div
                      key={item.id}
                      className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full"
                      style={{ minHeight: '320px', maxHeight: '370px' }}
                    >
                      {item.image ? (
                        <div className="h-28 sm:h-32 w-full overflow-hidden">
                          <img
                            src={item.image}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-28 sm:h-32 w-full bg-gray-100 flex items-center justify-center">
                          <img
                            src="/icons/placeholder.png"
                            alt="No dish"
                            className="h-16 w-16 opacity-60"
                          />
                        </div>
                      )}
                      <div className="p-3 flex-1 flex flex-col">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-base sm:text-lg font-medium text-gray-900 truncate">
                              {item.title}
                            </h3>
                            {item.description && (
                              <p className="mt-1 text-xs sm:text-sm text-gray-500 line-clamp-2">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setSelectedDish(item);
                              setModalOpen(true);
                            }}
                            className="text-gray-500 hover:text-gray-700"
                            aria-label="View details"
                          >
                            <Eye size={18} />
                          </button>
                        </div>
                        <div className="text-base sm:text-lg font-semibold text-primary mt-2">
                          {item.price.toLocaleString()} FCFA
                        </div>
                        <button
                          onClick={() => addToCart(item)}
                          className="mt-auto w-full inline-flex justify-center items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-xs sm:text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                        >
                          <PlusCircle size={14} className="mr-2" />
                          Add to Order
                        </button>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center col-span-full">
                  <p className="text-gray-500 text-xs sm:text-base">No items in this category</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Cart Sidebar */}
      <div 
        className={`fixed inset-0 z-50 overflow-hidden ${showCart ? 'block' : 'hidden'}`}
        aria-labelledby="slide-over-title" 
        role="dialog" 
        aria-modal="true"
      >
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
            aria-hidden="true"
            onClick={() => setShowCart(false)}
          ></div>
          
          <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
            <div className="w-screen max-w-md">
              <div className="h-full flex flex-col bg-white shadow-xl overflow-y-scroll">
                <div className="flex-1 py-6 overflow-y-auto px-4 sm:px-6">
                  <div className="flex items-start justify-between">
                    <h2 className="text-lg font-medium text-gray-900" id="slide-over-title">
                      Your Order
                    </h2>
                    <div className="ml-3 h-7 flex items-center">
                      <button
                        type="button"
                        className="-m-2 p-2 text-gray-400 hover:text-gray-500"
                        onClick={() => setShowCart(false)}
                      >
                        <span className="sr-only">Close panel</span>
                        <X size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-8">
                    {cart.length === 0 ? (
                      <div className="text-center py-10">
                        <ShoppingCart size={48} className="mx-auto text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Your cart is empty</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          Add items from the menu to start your order
                        </p>
                      </div>
                    ) : (
                      <div className="flow-root">
                        <ul role="list" className="-my-6 divide-y divide-gray-200">
                          {cart.map((item) => (
                            <li key={item.id} className="py-6 flex">
                              <div className="flex-1 flex flex-col">
                                <div>
                                  <div className="flex justify-between text-base font-medium text-gray-900">
                                    <h3>{item.title}</h3>
                                  <p className="ml-4 px-2 py-1">{(item.price * item.quantity).toLocaleString()} FCFA</p>
                                  </div>
                                  <p className="mt-1 text-sm text-gray-500 px-2 py-1">{item.price.toLocaleString()} FCFA each</p>
                                </div>
                                <div className="flex-1 flex items-end justify-between text-sm">
                                  <div className="flex items-center">
                                    <button
                                      onClick={() => decrementItem(item.id)}
                                      className="text-gray-500 hover:text-gray-700"
                                    >
                                      <MinusCircle size={18} />
                                    </button>
                                    <span className="mx-2 text-gray-700">{item.quantity}</span>
                                    <button
                                      onClick={() => incrementItem(item.id)}
                                      className="text-gray-500 hover:text-gray-700"
                                    >
                                      <PlusCircle size={18} />
                                    </button>
                                  </div>

                                  <div className="flex">
                                    <button
                                      type="button"
                                      onClick={() => removeItem(item.id)}
                                      className="font-medium text-red-600 hover:text-red-500"
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {cart.length > 0 && (
                  <div className="border-t border-gray-200 py-6 px-4 sm:px-6">
                    <div className="flex justify-between text-base font-medium text-gray-900">
                      <p>Subtotal</p>
                      <p className="px-2 py-1">{totalCartAmount.toLocaleString()} FCFA</p>
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500">Table #{tableNumber}</p>
                    <div className="mt-6 flex justify-between">
                      <button
                        type="button"
                        onClick={clearCart}
                        className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8B0000]"
                      >
                        Clear Cart
                      </button>
                      <button
                        type="button"
                        onClick={submitOrder}
                        disabled={submittingOrder}
                        className="flex items-center justify-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                      >
                        {submittingOrder ? (
                          <LoadingSpinner size={20} color="#ffffff" />
                        ) : (
                          'Place Order'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

    <DishDetailModal
      isOpen={isModalOpen}
      dish={selectedDish}
      onClose={() => setModalOpen(false)}
    />

    </div>
  );
};

export default MenuPage;