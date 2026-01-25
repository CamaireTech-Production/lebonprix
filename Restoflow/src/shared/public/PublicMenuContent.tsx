import React, { useRef, useState, useEffect, useMemo } from 'react';
import designSystem from '../../designSystem';
import { ChefHat, Search, X, MapPin, Phone, ArrowUp, Globe } from 'lucide-react';
import WireframeLoader from '../../components/ui/WireframeLoader';
import LoadingMessage from '../../components/ui/LoadingMessage';
import DishDetailModal from '../../pages/client/customer/DishDetailModal';
import { Dish, Category, Restaurant } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';
import { getCurrencySymbol } from '../../data/currencies';

type MenuItem = Dish;


interface PublicMenuContentProps {
  restaurant: Restaurant | null;
  categories: Category[];
  menuItems: MenuItem[];
  loading: boolean;
  isDemo?: boolean;
}

const PublicMenuContent: React.FC<PublicMenuContentProps> = ({ restaurant, categories, menuItems, loading, isDemo: _isDemo }) => {
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
  const [, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  // Refs for each main category section
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const categoryTabsRef = useRef<HTMLDivElement | null>(null);
  const [selectedDish, setSelectedDish] = useState<MenuItem | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { language, setLanguage, supportedLanguages } = useLanguage();
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const langSwitcherRef = useRef<HTMLDivElement>(null);

  const currencySymbol = restaurant?.currency ? getCurrencySymbol(restaurant.currency) : 'FCFA';

  // Helper to get sticky header + tabs height
  const getStickyOffset = () => {
    const header = document.querySelector('.sticky-header-anchor');
    const tabs = categoryTabsRef.current;
    let offset = 0;
    if (header) offset += (header as HTMLElement).offsetHeight;
    if (tabs) offset += tabs.offsetHeight;
    // Fallback if not found
    if (!offset) offset = 200;
    return offset;
  };

  // --- Intersection Observer Scroll Spy ---
  useEffect(() => {
    if (!mainCategories.length) return;
    const headerOffset = getStickyOffset();
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
  }, [mainCategories, sectionRefs, getStickyOffset]);

  // --- Scroll to Section ---
  const handleCategoryClick = (catId: string) => {
    setSelectedCategory(catId);
    setActiveCategory(catId);
    const offset = getStickyOffset();
    if (catId === 'all') {
      window.scrollTo({ top: (categoryTabsRef.current?.offsetTop || 0) - offset + 1, behavior: 'smooth' });
      return;
    }
    const ref = sectionRefs.current[catId];
    if (ref) {
      // Prefer scrolling to the first dish card inside this category section, if present
      const firstDishEl = ref.querySelector('.dish-card') as HTMLElement | null;
      const targetEl = firstDishEl || ref;
      const y = targetEl.getBoundingClientRect().top + window.scrollY - offset + 1;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
    // Scroll the tab into view
    const tab = document.getElementById(`category-tab-${catId}`);
    if (tab && tab.scrollIntoView) {
      tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  // --- Group dishes by category for section rendering ---
  const dishesByCategory = useMemo(() => {
    const map: { [catId: string]: MenuItem[] } = {};
    categories.forEach(cat => {
      const items = menuItems.filter(item => item.categoryId === cat.id);
      // Only include categories that have items
      if (items.length > 0) {
        map[cat.id] = items;
      }
    });
    return map;
  }, [categories, menuItems]);

  // Filter categories to only show those with items
  const filteredCategories = useMemo(() => {
    return categories.filter(cat => {
      const items = dishesByCategory[cat.id] || [];
      if (searchQuery) {
        // During search, only show categories with matching items
        return items.some(item => 
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      }
      // When not searching, show all categories with items
      return items.length > 0;
    });
  }, [categories, dishesByCategory, searchQuery]);

  // Debug logs

  // Custom scrollbar CSS for category tabs
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


  // Always show loading state initially until we have data or a definitive error
  // Always show loading state initially until ALL data (restaurant, categories, AND dishes) are loaded
  if (loading || !restaurant || categories.length === 0 || menuItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <LoadingMessage language={language} onReload={() => window.location.reload()} />
        <WireframeLoader count={8} />
      </div>
    );
  }

  // Only show error state if we're not loading AND we've definitively determined the restaurant doesn't exist
  if (!loading && !restaurant && menuItems.length === 0 && categories.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <ChefHat size={48} className="text-primary mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('restaurantNotFound', language)}</h1>
        <p className="text-gray-600 mb-6">{t('restaurantNotFoundDescription', language)}</p>
      </div>
    );
  }

  return (
    <>
      <style>{customScrollbarStyle}</style>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Sticky Header + Category Tabs */}
        <div className="sticky-header-anchor" style={{ height: 0, width: 0, position: 'absolute', top: 0, left: 0 }} />
        <div className="relative z-10" style={{ background: designSystem.colors.white }}>
          {/* Header - Content-based height with proper padding */}
          <header className="w-full" style={{ background: designSystem.colors.white }}>
            <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4 flex flex-row items-center justify-between gap-2 sm:gap-4">
              <div className="flex flex-row items-center gap-3 sm:gap-5 min-w-0">
                {/* Name and Details - Compact on mobile */}
                <div className="flex flex-col flex-1 min-w-0">
                  <h1
                    className="break-words sm:truncate"
                    style={{
                      fontFamily: designSystem.fonts.heading,
                      fontWeight: 700,
                      fontSize: isMobile ? '1rem' : '1.3rem',
                      color: designSystem.colors.primary,
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
                    <span style={{ fontSize: isMobile ? '1.2rem' : '2.1rem' }}>{restaurant?.name}</span>
                  </h1>
                  <div 
                    className="flex flex-row flex-wrap items-center gap-2 sm:gap-4 mt-1 sm:mt-2 text-xs sm:text-sm min-w-0"
                    style={{
                      transition: 'opacity 0.3s ease, max-height 0.3s ease',
                      opacity: isScrolled ? 0 : 1,
                      maxHeight: isScrolled ? 0 : '100px',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Address */}
                    {restaurant?.address && (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(restaurant.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 sm:gap-2 min-w-0 max-w-[180px] sm:max-w-[220px] break-words group transition-colors"
                        style={{ color: designSystem.colors.subtitleGray, cursor: 'pointer', textDecoration: 'none' }}
                        tabIndex={0}
                      >
                        <MapPin size={isMobile ? 12 : 16} color={designSystem.colors.iconGray} style={{ opacity: 0.7, minWidth: isMobile ? 12 : 16, verticalAlign: 'middle' }} />
                        <span className="min-w-0 break-words group-hover:underline group-focus:underline group-hover:text-primary group-focus:text-primary transition-colors" style={{wordBreak:'break-word'}}>{restaurant.address}</span>
                      </a>
                    )}
                    {/* Phone */}
                    {restaurant?.phone && (
                      <a
                        href={`tel:${restaurant.phone.replace(/[^\d+]/g, '')}`}
                        className="flex items-center gap-1 sm:gap-2 min-w-0 max-w-[120px] sm:max-w-[140px] break-words group transition-colors"
                        style={{ color: designSystem.colors.subtitleGray, cursor: 'pointer', textDecoration: 'none' }}
                        tabIndex={0}
                      >
                        <Phone size={isMobile ? 12 : 16} color={designSystem.colors.iconGray} style={{ opacity: 0.7, minWidth: isMobile ? 12 : 16, verticalAlign: 'middle' }} />
                        <span className="min-w-0 break-words group-hover:underline group-focus:underline group-hover:text-primary group-focus:text-primary transition-colors" style={{wordBreak:'break-word'}}>{restaurant.phone}</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
              {/* Language Selector - Modern Dropdown */}
              <div ref={langSwitcherRef} className="relative ml-2">
                <button
                  className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-gray-50 border border-gray-200 shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-accent transition-all text-xs sm:text-sm font-medium text-gray-700"
                  style={{ minWidth: isMobile ? 60 : 80 }}
                  aria-haspopup="listbox"
                  aria-expanded={langDropdownOpen}
                  aria-label={t('select_language', language)}
                  onClick={() => setLangDropdownOpen(v => !v)}
                  tabIndex={0}
                  type="button"
                >
                  <Globe size={isMobile ? 14 : 18} className="text-gray-400 mr-1" />
                  <span className="capitalize">{supportedLanguages.find(l => l.code === language)?.label || language}</span>
                  <svg className={`ml-1 w-3 h-3 sm:w-4 sm:h-4 transition-transform ${langDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {langDropdownOpen && (
                  <ul
                    className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 animate-fade-in"
                    role="listbox"
                    tabIndex={-1}
                  >
                    {supportedLanguages.map(lang => (
                      <li
                        key={lang.code}
                        className={`px-4 py-2 cursor-pointer text-gray-700 hover:bg-accent/10 rounded-lg transition-all ${lang.code === language ? 'font-semibold bg-accent/20' : ''}`}
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

          {/* Category Tabs - Only Main Categories */}
          <div
            ref={categoryTabsRef}
            className="pt-1 pb-2 border-b overflow-x-auto no-scrollbar custom-cat-scrollbar"
            style={{ background: designSystem.colors.white, borderColor: designSystem.colors.borderLightGray, WebkitOverflowScrolling: 'touch' }}
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
                      background: activeCategory === cat.id ? designSystem.colors.highlightYellow : designSystem.colors.backgroundLight,
                      color: activeCategory === cat.id ? designSystem.colors.primary : designSystem.colors.primary,
                      border: `1.5px solid ${designSystem.colors.borderLightGray}`,
                      fontFamily: designSystem.fonts.heading,
                      fontWeight: 500,
                      minWidth: '80px',
                    }}
                    onMouseEnter={e => {
                      if (activeCategory !== cat.id) {
                        e.currentTarget.style.background = designSystem.colors.primary;
                        e.currentTarget.style.color = designSystem.colors.white;
                      }
                    }}
                    onMouseLeave={e => {
                      if (activeCategory === cat.id) {
                        e.currentTarget.style.background = designSystem.colors.highlightYellow;
                        e.currentTarget.style.color = designSystem.colors.primary;
                      } else {
                        e.currentTarget.style.background = designSystem.colors.backgroundLight;
                        e.currentTarget.style.color = designSystem.colors.primary;
                      }
                    }}
                  >
                    {cat.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Search bar - Redesigned */}
        <div className="bg-gray-50" style={{ borderBottom: `1.5px solid ${designSystem.colors.borderLightGray}` }}>
          <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-6">
            <div className="relative max-w-md mx-auto">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={20} className="text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('search_Dishes_Placeholder', language)}
                className="pl-10 p-3 block w-full border border-gray-200 rounded-lg shadow-sm focus:ring-0 focus:border-primary text-base bg-white"
                style={{ fontFamily: designSystem.fonts.body, fontSize: '1rem', color: designSystem.colors.primary }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Menu Sections */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-2 sm:px-4 lg:px-6 pt-2 pb-20">
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
                  <div>
                    <h2
                      className="text-xl sm:text-2xl font-bold text-gray-900 mb-2"
                      style={{ fontFamily: designSystem.fonts.heading }}
                    >
                      {mainCat.title}
                    </h2>
                    <div style={{ height: 2, background: designSystem.colors.highlightYellow, width: '100%', borderRadius: 2, marginBottom: 24 }} />
                  </div>
                  {/* Dishes directly under main category (not in subcategories) - RENDERED FIRST */}
                  {filteredMainCatDishes.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 px-2 sm:px-0 mb-6">
                      {filteredMainCatDishes.map(item => (
                        <div
                          key={item.id}
                          className="dish-card bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full cursor-pointer group min-h-0 flex-1"
                          style={{ minHeight: '220px', maxHeight: '370px' }}
                          onClick={() => {
                            setSelectedDish(item);
                            setTimeout(() => setModalOpen(true), 0);
                          }}
                        >
                          {item.image ? (
                            <div className="h-32 sm:h-48 w-full overflow-hidden">
                              <img
                                src={item.image}
                                alt={item.title}
                                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
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
                                <div className="text-xs text-gray-500 mt-1 truncate" style={{ maxWidth: '100%' }}>
                                  {item.description.length > 40 ? item.description.slice(0, 40) + '…' : item.description}
                                </div>
                              )}
                            </div>
                            <div className="text-base sm:text-lg font-semibold text-primary mt-2">
                              {item.price.toLocaleString()} {currencySymbol}
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
                        <h3
                          className="text-lg font-semibold mb-2 px-3 py-1 rounded-full inline-block"
                          style={{
                            fontFamily: designSystem.fonts.heading,
                            background: designSystem.colors.highlightYellow,
                            color: designSystem.colors.primary,
                            fontWeight: 700,
                            letterSpacing: '0.5px',
                          }}
                        >
                          {subcat.title}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 px-2 sm:px-0">
                          {subcatDishes.map(item => (
                            <div
                              key={item.id}
                              className="dish-card bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full cursor-pointer group min-h-0 flex-1"
                              style={{ minHeight: '220px', maxHeight: '370px' }}
                              onClick={() => {
                                setSelectedDish(item);
                                setTimeout(() => setModalOpen(true), 0);
                              }}
                            >
                              {item.image ? (
                                <div className="h-32 sm:h-48 w-full overflow-hidden">
                                  <img
                                    src={item.image}
                                    alt={item.title}
                                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
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
                                    <div className="text-xs text-gray-500 mt-1 truncate" style={{ maxWidth: '100%' }}>
                                      {item.description.length > 40 ? item.description.slice(0, 40) + '…' : item.description}
                                    </div>
                                  )}
                                </div>
                                <div className="text-base sm:text-lg font-semibold text-primary mt-2">
                                  {item.price.toLocaleString()} {currencySymbol}
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
            {/* If no main categories, fallback to old logic */}
            {mainCategories.length === 0 && filteredCategories.map((cat, idx) => (
              <div
                key={cat.id}
                ref={el => (sectionRefs.current[cat.id] = el)}
                data-cat-id={cat.id}
                className={`mb-10 ${idx !== 0 ? 'pt-6' : ''}`}
              >
                <div>
                  <h2
                    className="text-xl sm:text-2xl font-bold text-gray-900 mb-2"
                    style={{ fontFamily: designSystem.fonts.heading }}
                  >
                    {cat.title}
                  </h2>
                  <div style={{ height: 2, background: designSystem.colors.highlightYellow, width: '100%', borderRadius: 2, marginBottom: 24 }} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 px-2 sm:px-0">
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
                          className="dish-card bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full cursor-pointer group min-h-0 flex-1"
                          style={{ minHeight: '220px', maxHeight: '370px' }}
                          onClick={() => {
                            setSelectedDish(item);
                            setTimeout(() => setModalOpen(true), 0);
                          }}
                        >
                          {item.image ? (
                            <div className="h-32 sm:h-48 w-full overflow-hidden">
                              <img
                                src={item.image}
                                alt={item.title}
                                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
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
                                <div className="text-xs text-gray-500 mt-1 truncate" style={{ maxWidth: '100%' }}>
                                  {item.description.length > 40 ? item.description.slice(0, 40) + '…' : item.description}
                                </div>
                              )}
                            </div>
                            <div className="text-base sm:text-lg font-semibold text-primary mt-2">
                              {item.price.toLocaleString()} {currencySymbol}
                            </div>
                          </div>
                        </div>
                      ))
                  ) : null}
                </div>
              </div>
            ))}
            {!loading && mainCategories.length === 0 && filteredCategories.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">{t('noItemsFoundMatchingSearch', language)}</p>
              </div>
            )}
          </div>
        </main>

        {/* Sticky Footer */}
        <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t border-gray-200 py-2 px-4 text-center">
          <p className="text-xs text-gray-500">
            {t('powered_by', language)}{' '}
            <a 
              href="https://camairetech.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Camairetech
            </a>
          </p>
        </footer>

        {/* Dish Detail Modal */}
        <DishDetailModal
          isOpen={isModalOpen}
          dish={selectedDish}
          onClose={() => setModalOpen(false)}
          categoryName={selectedDish ? (categories.find(cat => cat.id === selectedDish.categoryId)?.title || '') : ''}
        />
        {/* Floating Back to Top Button */}
        {showScrollTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 right-6 z-50 bg-primary text-white rounded-full shadow-lg p-4 flex items-center justify-center hover:bg-primary-dark transition-colors"
            aria-label="Back to top"
          >
            <ArrowUp size={28} />
          </button>
        )}
      </div>
    </>
  );
};

export default PublicMenuContent;