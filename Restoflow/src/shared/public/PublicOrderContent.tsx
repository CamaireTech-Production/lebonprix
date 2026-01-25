import React, { useRef, useState, useEffect, useMemo } from 'react';
import { ChefHat, Search, X, ShoppingCart, PlusCircle, MinusCircle, Trash2, AlertCircle, MapPin, Phone, ArrowUp, Globe } from 'lucide-react';
import WireframeLoader from '../../components/ui/WireframeLoader';
import LoadingMessage from '../../components/ui/LoadingMessage';
import DishDetailModal from '../../pages/client/customer/DishDetailModal';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';
import designSystem from '../../designSystem';
import { Dish, Category, Restaurant, OrderItem, Order } from '../../types';
import { validateCameroonPhone, formatCameroonPhone} from '../../utils/paymentUtils';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';
import { getCurrencySymbol } from '../../data/currencies';

// Dark + Gold palette for Lea template
const GOLD = '#d4af37';
const GOLD_SOFT = 'rgba(212, 175, 55, 0.15)';

interface PublicOrderContentProps {
  restaurant: Restaurant | null;
  categories: Category[];
  menuItems: Dish[];
  loading: boolean;
  createOrder: (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) => Promise<any>;
  isDemo?: boolean;
}

const PublicOrderContent: React.FC<PublicOrderContentProps> = ({ restaurant, categories, menuItems, loading, createOrder, isDemo }) => {
  const [, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const categoryTabsRef = useRef<HTMLDivElement | null>(null);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [checkoutLocation, setCheckoutLocation] = useState('');
  const [checkoutName, setCheckoutName] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [cartAnim, setCartAnim] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  let lastManualClick = 0;
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { language, setLanguage, supportedLanguages } = useLanguage();
  const phoneError = phoneTouched && !validateCameroonPhone(checkoutPhone) ? t('invalid_phone_number', language) : '';
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const langSwitcherRef = useRef<HTMLDivElement>(null);
  const currencySymbol = restaurant?.currency ? getCurrencySymbol(restaurant.currency) : 'FCFA';
  
  // Background URL for Lea template
  const bgUrl = '/lea-bg.jpg';

  // --- Cart Logic ---
  const addToCart = (item: Dish) => {
    setCart(prev => {
      const existing = prev.find(ci => ci.menuItemId === item.id);
      if (existing) {
        setCartAnim(true);
        setTimeout(() => setCartAnim(false), 300);
        return prev.map(ci => ci.menuItemId === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci);
      }
      setCartAnim(true);
      setTimeout(() => setCartAnim(false), 300);
      return [...prev, { id: Date.now().toString(), menuItemId: item.id, title: item.title, price: item.price, quantity: 1 }];
    });
  };
  const incrementItem = (itemId: string) => setCart(prev => prev.map(ci => ci.id === itemId ? { ...ci, quantity: ci.quantity + 1 } : ci));
  const decrementItem = (itemId: string) => setCart(prev => prev.map(ci => ci.id === itemId ? { ...ci, quantity: Math.max(1, ci.quantity - 1) } : ci));
  const removeItem = (itemId: string) => setCart(prev => prev.filter(ci => ci.id !== itemId));
  const clearCart = () => setCart([]);
  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // --- Checkout Logic ---
  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error('Your cart is empty');
      return;
    }
    
    // Save cart to localStorage
    localStorage.setItem(`cart_${restaurant?.id}`, JSON.stringify(cart));
    
    // Navigate to checkout
    window.location.href = `/public-order/${restaurant?.id}/checkout`;
  };

  // --- Scroll Spy Effect ---
  useEffect(() => {
    if (!categories.length) return;
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (Date.now() - lastManualClick < 400) {
            ticking = false;
            return;
          }
          const scrollY = window.scrollY + 120;
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
          const tab = document.getElementById(`category-tab-${found}`);
          if (tab && tab.scrollIntoView) {
            const tabRect = tab.getBoundingClientRect();
            const container = tab.parentElement;
            if (container) {
              const containerRect = container.getBoundingClientRect();
              if (tabRect.left < containerRect.left || tabRect.right > containerRect.right) {
                tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
              }
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [categories]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 200);
      setIsScrolled(window.scrollY > 50);
    };
    
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    // Set initial mobile state
    handleResize();
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // --- Scroll to Section ---
  const handleCategoryClick = (catId: string) => {
    if (catId === activeCategory) return;
    setSelectedCategory(catId);
    setActiveCategory(catId);
    lastManualClick = Date.now();
    if (catId === 'all') {
      const main = document.querySelector('main');
      if (main) {
        window.scrollTo({ top: main.getBoundingClientRect().top + window.scrollY - 64, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: categoryTabsRef.current?.offsetTop! + 1 - 64, behavior: 'smooth' });
      }
      return;
    }
    const ref = sectionRefs.current[catId];
    if (ref) {
      const y = ref.getBoundingClientRect().top + window.scrollY - 64;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
    const tab = document.getElementById(`category-tab-${catId}`);
    if (tab && tab.scrollIntoView) {
      tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  // --- Group dishes by category for section rendering ---
  const dishesByCategory = useMemo(() => {
    const map: { [catId: string]: Dish[] } = {};
    categories.forEach(cat => {
      const items = menuItems.filter(item => item.categoryId === cat.id);
      if (items.length > 0) map[cat.id] = items;
    });
    return map;
  }, [categories, menuItems]);

  // Filter categories to only show those with items
  const filteredCategories = useMemo(() => {
    return categories.filter(cat => {
      const items = dishesByCategory[cat.id] || [];
      if (searchQuery) {
        return items.some(item => 
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      }
      return items.length > 0;
    });
  }, [categories, dishesByCategory, searchQuery]);

  // Map subcategories by parent
  const subcategoriesByParent: { [parentId: string]: Category[] } = {};
  categories.forEach(cat => {
    if (cat.parentCategoryId) {
      if (!subcategoriesByParent[cat.parentCategoryId]) subcategoriesByParent[cat.parentCategoryId] = [];
      subcategoriesByParent[cat.parentCategoryId].push(cat);
    }
  });
  // Only main categories for filter tabs, but only if they or their subcategories have dishes
  const mainCategories = categories.filter(cat => {
    if (cat.parentCategoryId) return false;
    // Dishes directly under main category
    const mainCatDishes = menuItems.filter(item => item.categoryId === cat.id);
    // Dishes in subcategories
    const subcats = subcategoriesByParent[cat.id] || [];
    const subcatDishes = subcats.flatMap(subcat => menuItems.filter(item => item.categoryId === subcat.id));
    return mainCatDishes.length > 0 || subcatDishes.length > 0;
  });

  // --- Intersection Observer Scroll Spy ---
  useEffect(() => {
    if (!mainCategories.length) return;
    const headerOffset = 64; // adjust as needed or use getStickyOffset if available
    const observer = new window.IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let active = 'all';
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            active = entry.target.getAttribute('data-cat-id')!;
          }
        });
        setActiveCategory(active);
      },
      {
        root: null,
        rootMargin: `-${headerOffset}px 0px 0px 0px`,
        threshold: [0.4, 0.6, 1.0],
      }
    );
    mainCategories.forEach(cat => {
      const ref = sectionRefs.current[cat.id];
      if (ref) observer.observe(ref);
    });
    return () => observer.disconnect();
  }, [mainCategories, sectionRefs]);

  // Add custom scrollbar CSS for category tabs
  const customScrollbarStyle = `
    .custom-cat-scrollbar::-webkit-scrollbar {
      height: 6px;
    }
    .custom-cat-scrollbar::-webkit-scrollbar-thumb {
      background: #E5E7EB;
      border-radius: 4px;
    }
    .custom-cat-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
  `;


  // Always show loading state initially until ALL data (restaurant, categories, AND dishes) are loaded
  if (loading || !restaurant || categories.length === 0 || menuItems.length === 0) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-4" style={{ background: '#0b0b0b' }}>
        <LoadingMessage language={language} onReload={() => window.location.reload()} />
        <WireframeLoader count={8} />
      </div>
    );
  }

  // Only show error state if we're not loading AND we've definitively determined the restaurant doesn't exist
  if (!loading && !restaurant && menuItems.length === 0 && categories.length === 0) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-4" style={{ background: '#0b0b0b' }}>
        <ChefHat size={48} style={{ color: GOLD }} className="mb-4" />
        <h1 className="text-2xl font-bold mb-2" style={{ color: '#f5f5f5' }}>{t('restaurant_not_found', language)}</h1>
        <p className="mb-6" style={{ color: '#bfbfbf' }}>{t('restaurant_not_found_description', language)}</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .lea-scrollbar, .lea-cat-scrollbar { scrollbar-width: thin; scrollbar-color: ${GOLD} #0b0b0b; }
        .lea-scrollbar::-webkit-scrollbar { width: 10px; height: 10px; }
        .lea-scrollbar::-webkit-scrollbar-thumb { background: ${GOLD}; border-radius: 8px; border: 1px solid rgba(212,175,55,0.4); }
        .lea-scrollbar::-webkit-scrollbar-track { background: #0b0b0b; }
        .lea-cat-scrollbar::-webkit-scrollbar { height: 8px; }
        .lea-cat-scrollbar::-webkit-scrollbar-thumb { background: ${GOLD}; border-radius: 9999px; border: 1px solid rgba(212,175,55,0.4); }
        .gold-border { box-shadow: 0 0 0 1px rgba(212,175,55,0.35) inset; }
        .gold-glow { box-shadow: 0 6px 20px rgba(212,175,55,0.15); }
        ${customScrollbarStyle}
      `}</style>
      
      <div className="min-h-screen lea-scrollbar relative">
        {/* Dark textured background with gold overlay */}
        <div
          className="fixed inset-0 -z-10"
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.5)), url('${bgUrl}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
            backgroundRepeat: 'no-repeat',
            filter: 'drop-shadow(0 0 20px rgba(0, 0, 0, 0.6))'
          }}
        />
        {/* Header + Category Tabs */}
        <div className="sticky-header-anchor" style={{ height: 0, width: 0, position: 'absolute', top: 0, left: 0 }} />
        <div className="sticky top-0 z-30" style={{ background: 'rgba(10,10,10,0.72)', backdropFilter: 'blur(6px)' }}>
          {/* Header - Content-based height with proper padding */}
          <header className="w-full" style={{ background: 'rgba(10,10,10,0.72)' }}>
            <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4 flex flex-row items-center justify-between gap-2 sm:gap-4">
              <div className="flex flex-row items-center gap-3 sm:gap-5 min-w-0">
                {/* Restaurant Icon */}
                <span className="flex items-center justify-center rounded-full flex-shrink-0" style={{ height: isMobile ? '48px' : '72px', width: isMobile ? '48px' : '72px' }}>
                  {isDemo ? (
                    <ChefHat size={isMobile ? 24 : 36} color={designSystem.colors.primary} />
                  ) : restaurant?.logo ? (
                    <img
                      src={restaurant.logo}
                      alt={restaurant.name}
                      className="rounded-full object-cover transition-all duration-200 flex-shrink-0"
                      style={{ height: isMobile ? '48px' : '72px', width: isMobile ? '48px' : '72px', aspectRatio: '1/1' }}
                    />
                  ) : (
                    <ChefHat size={isMobile ? 24 : 36} color={designSystem.colors.primary} />
                  )}
                </span>
                {/* Name and Details */}
                <div className="flex flex-col flex-1 min-w-0">
                  <h1
                    className="break-words sm:truncate"
                    style={{
                      fontFamily: designSystem.fonts.heading,
                      fontWeight: 700,
                      fontSize: isMobile ? '1rem' : '1.3rem',
                      color: '#f5f5f5',
                      letterSpacing: '-0.5px',
                      lineHeight: isScrolled && isMobile ? 1.2 : 1.1,
                      transition: 'all 0.3s ease',
                      overflow: 'hidden',
                      textOverflow: isScrolled && isMobile ? 'ellipsis' : 'clip',
                      whiteSpace: isScrolled && isMobile ? 'nowrap' : 'normal',
                      maxHeight: isScrolled && isMobile ? '1.4em' : 'none',
                      textIndent: !isScrolled && isMobile ? '0.5em' : '0',
                      wordBreak: !isScrolled && isMobile ? 'break-word' : 'normal',
                      paddingBottom: isScrolled && isMobile ? '0.1em' : '0',
                    }}
                  >
                    <span style={{ fontSize: isMobile ? '1.5rem' : '2.1rem' }}>{restaurant?.name}</span>
                  </h1>
                  <div 
                    className="flex flex-row flex-wrap items-center gap-2 sm:gap-4 mt-2 text-sm min-w-0"
                    style={{
                      maxHeight: isScrolled ? 0 : '100px',
                      overflow: 'hidden',
                      transition: 'max-height 0.3s ease'
                    }}
                  >
                    {/* Address */}
                    {restaurant?.address && (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(restaurant.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs sm:text-sm min-w-0 max-w-[220px] break-words group transition-colors"
                        style={{ color: designSystem.colors.subtitleGray, cursor: 'pointer', textDecoration: 'none' }}
                        tabIndex={0}
                      >
                        <MapPin size={isMobile ? 12 : 16} color={designSystem.colors.iconGray} style={{ opacity: 0.7, minWidth: isMobile ? 12 : 16, verticalAlign: 'middle' }} />
                        <span className="min-w-0 break-words group-hover:underline group-focus:underline transition-colors" style={{wordBreak:'break-word', color: designSystem.colors.subtitleGray}}>{restaurant.address}</span>
                      </a>
                    )}
                    {/* Phone */}
                    {restaurant?.phone && (
                      <a
                        href={`tel:${restaurant.phone.replace(/[^\d+]/g, '')}`}
                        className="flex items-center gap-2 text-xs sm:text-sm min-w-0 max-w-[140px] break-words group transition-colors"
                        style={{ color: designSystem.colors.subtitleGray, cursor: 'pointer', textDecoration: 'none' }}
                        tabIndex={0}
                      >
                        <Phone size={isMobile ? 12 : 16} color={designSystem.colors.iconGray} style={{ opacity: 0.7, minWidth: isMobile ? 12 : 16, verticalAlign: 'middle' }} />
                        <span className="min-w-0 break-words group-hover:underline group-focus:underline transition-colors" style={{wordBreak:'break-word', color: designSystem.colors.subtitleGray}}>{restaurant.phone}</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
              {/* Language Selector - Lea Template Style */}
              <div ref={langSwitcherRef} className="relative ml-2">
                <button
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full gold-border gold-glow"
                  style={{ backgroundColor: '#121212', color: GOLD, minWidth: isMobile ? 60 : 80 }}
                  aria-haspopup="listbox"
                  aria-expanded={langDropdownOpen}
                  aria-label={t('select_language', language)}
                  onClick={() => setLangDropdownOpen(v => !v)}
                  tabIndex={0}
                  type="button"
                >
                  <Globe size={isMobile ? 14 : 18} style={{ color: GOLD }} />
                  <span className="capitalize">{supportedLanguages.find(l => l.code === language)?.label || language}</span>
                  <svg className={`ml-1 w-3 h-3 sm:w-4 sm:h-4 transition-transform ${langDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {langDropdownOpen && (
                  <ul
                    className="absolute right-0 mt-2 w-40 rounded-xl shadow-lg py-1 z-50"
                    style={{ backgroundColor: '#0f0f0f', border: '1px solid rgba(212,175,55,0.25)' }}
                    role="listbox"
                    tabIndex={-1}
                  >
                    {supportedLanguages.map(lang => (
                      <li
                        key={lang.code}
                        className={`px-4 py-2 cursor-pointer rounded-lg transition-all ${lang.code === language ? 'font-semibold' : ''}`}
                        style={{ color: '#e5e5e5' }}
                        role="option"
                        aria-selected={lang.code === language}
                        onClick={() => { setLanguage(lang.code); setLangDropdownOpen(false); }}
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setLanguage(lang.code); setLangDropdownOpen(false); } }}
                      >
                        {lang.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </header>
          {/* Category Tabs - Lea Template Style */}
          <div
            ref={categoryTabsRef}
            className="pt-1 pb-2 border-b overflow-x-auto no-scrollbar lea-cat-scrollbar"
            style={{ background: 'rgba(10,10,10,0.72)', borderColor: 'rgba(212,175,55,0.25)', WebkitOverflowScrolling: 'touch' }}
          >
            <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
              <div className="flex space-x-2 py-2" style={{ minHeight: '40px' }}>
                {mainCategories.map(cat => (
                  <button
                    key={cat.id}
                    id={`category-tab-${cat.id}`}
                    onClick={() => handleCategoryClick(cat.id)}
                    className={`flex-shrink-0 px-5 py-1.5 rounded-full font-medium text-sm sm:text-base transition shadow-none`}
                    style={{
                      background: activeCategory === cat.id ? GOLD : '#121212',
                      color: activeCategory === cat.id ? '#0b0b0b' : '#e5e5e5',
                      border: `1px solid rgba(212,175,55,0.25)`,
                      fontFamily: designSystem.fonts.heading,
                      fontWeight: 500,
                      minWidth: '80px',
                    }}
                  >
                    {cat.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Search bar - Lea Template Style */}
        <div className="relative z-10" style={{ background: 'rgba(10,10,10,0.72)', backdropFilter: 'blur(6px)', borderBottom: '1px solid rgba(212,175,55,0.25)' }}>
          <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-6">
            <div className="relative max-w-md mx-auto">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={20} style={{ color: GOLD }} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('search_Dishes_Placeholder', language)}
                className="pl-10 p-3 block w-full border border-gray-200 rounded-lg shadow-sm focus:ring-0 focus:border-gold-400 text-base"
                style={{ fontFamily: designSystem.fonts.body, fontSize: '1rem', color: '#f5f5f5', backgroundColor: '#0f0f0f', border: '1px solid rgba(212,175,55,0.25)' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  style={{ color: GOLD }}
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
        {/* Menu Sections - Lea Template Style */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-5 lg:px-8 pt-6 sm:pt-8 pb-28">
          <div>
            {mainCategories.map((mainCat, idx) => {
              // Dishes directly under main category (not in subcategories)
              const mainCatDishes = menuItems.filter(item => item.categoryId === mainCat.id);
              // Subcategories for this main category
              const subcats = subcategoriesByParent[mainCat.id] || [];
              // If searching, filter subcategories and dishes
              const filteredSubcats = subcats.filter(subcat => {
                const items = menuItems.filter(item => item.categoryId === subcat.id);
                if (searchQuery) {
                  return items.some(item =>
                    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
                  );
                }
                return items.length > 0;
              });
              const filteredMainCatDishes = mainCatDishes.filter(item => {
                if (searchQuery) {
                  return item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
                }
                return true;
              });
              // Only render section if there are dishes in main or subcategories
              if (
                filteredMainCatDishes.length === 0 &&
                filteredSubcats.every(subcat => menuItems.filter(item => item.categoryId === subcat.id).length === 0)
              ) return null;
              return (
                <div
                  key={mainCat.id}
                  ref={el => (sectionRefs.current[mainCat.id] = el)}
                  data-cat-id={mainCat.id}
                  className={`mb-10 ${idx !== 0 ? 'pt-6' : ''}`}
                >
                  <div className="mb-6 text-center">
                    <h2 className="mb-2" style={{ color: GOLD, fontWeight: 700, fontSize: '1.5rem', fontFamily: designSystem.fonts.heading }}>{mainCat.title}</h2>
                    <div className="h-1 w-24 mx-auto rounded-full" style={{ backgroundColor: GOLD_SOFT }} />
                  </div>
                  {/* Dishes directly under main category (not in subcategories) - RENDERED FIRST */}
                  {filteredMainCatDishes.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 px-2 sm:px-0 mb-6">
                      {filteredMainCatDishes.map(item => (
                        <div
                          key={item.id}
                          className="rounded-2xl overflow-hidden cursor-pointer group"
                          style={{ backgroundColor: '#0f0f0f', border: '2px solid #d4af37', minHeight: '180px', maxHeight: '300px' }}
                          onClick={() => {
                            setSelectedDish(item);
                            setModalOpen(true);
                          }}
                        >
                          {item.image ? (
                            <div className="h-24 sm:h-32 w-full overflow-hidden">
                              <img
                                src={item.image}
                                alt={item.title}
                                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                              />
                            </div>
                          ) : (
                            <div className="h-24 sm:h-32 w-full bg-gray-100 flex items-center justify-center">
                              <img
                                src="/icons/placeholder.png"
                                alt="No dish"
                                className="h-12 w-12 opacity-60"
                              />
                            </div>
                          )}
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="truncate" style={{ color: '#f3f3f3', fontWeight: 600 }}>{item.title}</h3>
                              <span className="text-xs sm:text-sm font-semibold px-2 py-1 rounded-full whitespace-nowrap" style={{ color: '#0b0b0b', backgroundColor: GOLD }}>
                                {item.price.toLocaleString()} {currencySymbol}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-xs mt-1 line-clamp-2" style={{ color: '#bfbfbf' }}>{item.description}</p>
                            )}
                            <div className="mt-auto w-full flex items-center gap-2">
                              {!cart.find(ci => ci.menuItemId === item.id) ? (
                                <button
                                  onClick={e => { e.stopPropagation(); addToCart(item); }}
                                  className="inline-flex justify-center items-center px-3 py-2 mt-4 border border-transparent rounded-md shadow-sm text-xs sm:text-sm font-medium transition-colors"
                                  style={{ backgroundColor: GOLD, color: '#0b0b0b' }}
                                >
                                  <PlusCircle size={14} className="mr-2" />
                                  {t('order_now', language)}
                                </button>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <button onClick={e => { e.stopPropagation(); decrementItem(cart.find(ci => ci.menuItemId === item.id)!.id); }} className="hover:text-gold-400 transition-colors" style={{ color: '#bfbfbf' }}><MinusCircle size={18} /></button>
                                  <span className="mx-1 font-semibold" style={{ color: '#f5f5f5' }}>{cart.find(ci => ci.menuItemId === item.id)!.quantity}</span>
                                  <button onClick={e => { e.stopPropagation(); incrementItem(cart.find(ci => ci.menuItemId === item.id)!.id); }} className="hover:text-gold-400 transition-colors" style={{ color: '#bfbfbf' }}><PlusCircle size={18} /></button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Subcategories - RENDERED AFTER parent category dishes */}
                  {filteredSubcats.length > 0 && filteredSubcats.map(subcat => {
                    const subcatDishes = menuItems.filter(item => item.categoryId === subcat.id).filter(item => {
                      if (searchQuery) {
                        return item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
                      }
                      return true;
                    });
                    if (subcatDishes.length === 0) return null;
                    return (
                      <div key={subcat.id} className="mb-6">
                        <h3 className="inline-block mb-3 px-3 py-1 rounded-full" style={{ color: GOLD, backgroundColor: '#121212', border: '1px solid rgba(212,175,55,0.25)' }}>
                          {subcat.title}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 px-2 sm:px-0">
                          {subcatDishes.map(item => (
                            <div
                              key={item.id}
                              className="rounded-2xl overflow-hidden cursor-pointer group"
                              style={{ backgroundColor: '#0f0f0f', border: '2px solid #d4af37', minHeight: '180px', maxHeight: '300px' }}
                              onClick={() => {
                                setSelectedDish(item);
                                setModalOpen(true);
                              }}
                            >
                              {item.image ? (
                                <div className="h-24 sm:h-32 w-full overflow-hidden">
                                  <img
                                    src={item.image}
                                    alt={item.title}
                                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                                  />
                                </div>
                              ) : (
                                <div className="h-24 sm:h-32 w-full bg-gray-100 flex items-center justify-center">
                                  <img
                                    src="/icons/placeholder.png"
                                    alt="No dish"
                                    className="h-12 w-12 opacity-60"
                                  />
                                </div>
                              )}
                              <div className="p-4">
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="truncate" style={{ color: '#f3f3f3', fontWeight: 600 }}>{item.title}</h4>
                                  <span className="text-xs sm:text-sm font-semibold px-2 py-1 rounded-full whitespace-nowrap" style={{ color: '#0b0b0b', backgroundColor: GOLD }}>
                                    {item.price.toLocaleString()} {currencySymbol}
                                  </span>
                                </div>
                                {item.description && (
                                  <p className="text-xs mt-1 line-clamp-2" style={{ color: '#bfbfbf' }}>{item.description}</p>
                                )}
                                <div className="mt-auto w-full flex items-center gap-2">
                                  {!cart.find(ci => ci.menuItemId === item.id) ? (
                                    <button
                                      onClick={e => { e.stopPropagation(); addToCart(item); }}
                                      className="inline-flex justify-center items-center px-3 py-2 mt-4 border border-transparent rounded-md shadow-sm text-xs sm:text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                                    >
                                      <PlusCircle size={14} className="mr-2" />
                                      {t('order_now', language)}
                                    </button>
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      <button onClick={e => { e.stopPropagation(); decrementItem(cart.find(ci => ci.menuItemId === item.id)!.id); }} className="text-gray-500 hover:text-gray-700"><MinusCircle size={18} /></button>
                                      <span className="mx-1 text-gray-700 font-semibold">{cart.find(ci => ci.menuItemId === item.id)!.quantity}</span>
                                      <button onClick={e => { e.stopPropagation(); incrementItem(cart.find(ci => ci.menuItemId === item.id)!.id); }} className="text-gray-500 hover:text-gray-700"><PlusCircle size={18} /></button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
                         {!loading && filteredCategories.length === 0 && (
               <div className="text-center py-8">
                 <p style={{ color: '#cfcfcf' }}>{t('no_items_found', language)}</p>
               </div>
             )}
          </div>
        </main>

        {/* Floating Action Buttons Row - Lea Template Style */}
        {(showScrollTop || cart.length > 0) && (
          <div className="fixed bottom-6 right-6 z-50 flex flex-row gap-4 items-end">
            {/* Cart Button */}
            {cart.length > 0 && (
              <button
                className={`rounded-full shadow-lg p-4 flex items-center transition-transform ${cartAnim ? 'scale-110' : ''}`}
                style={{ backgroundColor: GOLD, color: '#0b0b0b', minWidth: 56, minHeight: 56 }}
                onClick={() => setShowCart(true)}
                aria-label={t('view_cart', language)}
              >
                <ShoppingCart size={28} />
                {totalCartItems > 0 && (
                  <span className="ml-2 rounded-full px-2 py-1 text-xs font-bold animate-bounce" style={{ backgroundColor: '#0b0b0b', color: GOLD }}>
                    {totalCartItems}
                  </span>
                )}
              </button>
            )}
            {/* Back to Top Button */}
            {showScrollTop && (
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="rounded-full shadow-lg p-4 flex items-center justify-center transition-colors"
                style={{ backgroundColor: GOLD, color: '#0b0b0b', minWidth: 56, minHeight: 56 }}
                aria-label={t('back_to_top', language)}
              >
                <ArrowUp size={28} />
              </button>
            )}
          </div>
        )}

        {/* Cart Modal - Lea Template Style */}
        <Modal isOpen={showCart} onClose={() => { setShowCart(false); setShowCheckout(false); }} title={t('your_cart', language)} className="max-w-lg">
          {cart.length === 0 ? (
            <div className="text-center py-10">
              <ShoppingCart size={48} className="mx-auto" style={{ color: GOLD }} />
              <h3 className="mt-2 text-sm font-medium" style={{ color: '#f5f5f5' }}>{t('your_cart_is_empty', language)}</h3>
              <p className="mt-1 text-sm" style={{ color: '#bfbfbf' }}>{t('add_items_to_start_order', language)}</p>
            </div>
          ) : showCheckout ? (
            <div className="space-y-4">
              <div className="mb-2 text-sm" style={{ color: '#bfbfbf' }}>
                {t('checkout_instructions', language)}
              </div>
              <button type="button" onClick={() => setShowCheckout(false)} className="mb-4 hover:underline" style={{ color: GOLD }}>&larr; {t('back_to_cart', language)}</button>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1" style={{ color: '#f5f5f5' }}>{t('customer_name', language)} ({t('optional', language)})</label>
                <input type="text" value={checkoutName} onChange={e => setCheckoutName(e.target.value)} className="w-full border rounded-md p-2" style={{ backgroundColor: '#0f0f0f', color: '#f5f5f5', border: '1px solid rgba(212,175,55,0.25)' }} />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1" style={{ color: '#f5f5f5' }}>{t('phone_number', language)}</label>
                <div className="relative">
                  <div className="flex">
                    {/* Fixed +237 prefix */}
                    <div className="flex items-center px-4 py-3 border border-r-0 rounded-l-md text-sm font-medium" style={{ backgroundColor: '#121212', color: GOLD, border: '1px solid rgba(212,175,55,0.25)' }}>
                      +237
                    </div>
                    {/* Phone number input */}
                    <input
                      type="tel"
                      value={checkoutPhone}
                      onChange={e => setCheckoutPhone(e.target.value.replace(/[^0-9]/g, ''))}
                      onBlur={() => setPhoneTouched(true)}
                      className={`flex-1 px-4 py-3 border rounded-r-md shadow-sm text-sm ${
                        phoneError ? 'border-red-500' : ''
                      }`}
                      style={{ backgroundColor: '#0f0f0f', color: '#f5f5f5', border: '1px solid rgba(212,175,55,0.25)' }}
                      placeholder={t('phone_number_placeholder', language)}
                      maxLength={9}
                    />
                  </div>
                </div>
                {phoneError && (
                  <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle size={14} />
                    {phoneError}
                  </p>
                )}
                {checkoutPhone && !phoneError && (
                  <p className="mt-2 text-sm" style={{ color: '#bfbfbf' }}>
                    {formatCameroonPhone(checkoutPhone)}
                  </p>
                )}
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1" style={{ color: '#f5f5f5' }}>{t('location_address', language)}</label>
                <input type="text" value={checkoutLocation} onChange={e => setCheckoutLocation(e.target.value)} className="w-full border rounded-md p-2" style={{ backgroundColor: '#0f0f0f', color: '#f5f5f5', border: '1px solid rgba(212,175,55,0.25)' }} required />
              </div>
              <button type="button" onClick={handleCheckout} className="w-full py-2 px-4 rounded-md font-semibold transition-colors flex items-center justify-center gap-2" style={{ backgroundColor: GOLD, color: '#0b0b0b' }}>
                {t('proceed_to_checkout', language)}
              </button>
            </div>
          ) : (
            <div>
              <ul className="divide-y mb-4" style={{ borderColor: 'rgba(212,175,55,0.25)' }}>
                {cart.map(item => (
                  <li key={item.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium" style={{ color: '#f5f5f5' }}>{item.title}</div>
                      <div className="text-xs" style={{ color: '#bfbfbf' }}>{item.price.toLocaleString()} {currencySymbol} {t('each', language)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => decrementItem(item.id)} className="hover:text-gold-400 transition-colors" style={{ color: '#bfbfbf' }}><MinusCircle size={18} /></button>
                      <span className="mx-1 font-semibold" style={{ color: '#f5f5f5' }}>{item.quantity}</span>
                      <button onClick={() => incrementItem(item.id)} className="hover:text-gold-400 transition-colors" style={{ color: '#bfbfbf' }}><PlusCircle size={18} /></button>
                      <button onClick={() => removeItem(item.id)} className="hover:text-red-400 transition-colors" style={{ color: '#bfbfbf' }}><Trash2 size={18} /></button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between font-bold mb-4" style={{ color: '#f5f5f5' }}>
                <span>{t('subtotal', language)}:</span>
                <span>{totalCartAmount.toLocaleString()} {currencySymbol}</span>
              </div>
              <div className="flex justify-between gap-2">
                <button onClick={clearCart} className="px-4 py-2 rounded-md font-medium transition-colors" style={{ backgroundColor: '#121212', color: '#bfbfbf', border: '1px solid rgba(212,175,55,0.25)' }}>{t('clear_cart', language)}</button>
                <button onClick={handleCheckout} className="px-4 py-2 rounded-md font-semibold transition-colors" style={{ backgroundColor: GOLD, color: '#0b0b0b' }}>{t('proceed_to_checkout', language)}</button>
              </div>
            </div>
          )}
        </Modal>

        {/* Sticky Footer - Lea Template Style */}
        <footer className="fixed bottom-0 left-0 right-0 py-2 px-4 text-center z-40" style={{ background: 'rgba(10,10,10,0.72)', backdropFilter: 'blur(6px)' }}>
          <p className="text-xs" style={{ color: '#cfcfcf' }}>
            {t('powered_by', language)}{' '}
            <a 
              href="https://camairetech.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="font-medium transition-colors"
              style={{ color: GOLD }}
            >
              Camairetech
            </a>
          </p>
        </footer>

        {/* Dish Detail Modal (with add to cart) */}
        <DishDetailModal
          isOpen={isModalOpen}
          dish={selectedDish}
          onClose={() => setModalOpen(false)}
          addToCart={addToCart}
          inCart={cart.find(ci => ci.menuItemId === selectedDish?.id)}
          incrementItem={incrementItem}
          decrementItem={decrementItem}
          categoryName={selectedDish ? (categories.find(cat => cat.id === selectedDish.categoryId)?.title || '') : ''}
          currencyCode={restaurant?.currency}
        />
      </div>
    </>
  );
};

export default PublicOrderContent;