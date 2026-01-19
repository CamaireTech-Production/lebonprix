import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { getCompanyByUserId } from '@services/firestore/firestore';
import { subscribeToProducts } from '@services/firestore/products/productService';
import { subscribeToCategories } from '@services/firestore/categories/categoryService';
import { trackCatalogueView } from '@services/firestore/site/siteService';
import { subscribeToShops, getDefaultShop } from '@services/firestore/shops/shopService';
import { getAvailableStockBatches } from '@services/firestore/stock/stockService';
import type { Company, Product, Category, Shop } from '../../types/models';
import { Search, Package, AlertCircle, MapPin, Plus, Heart, Phone, Store } from 'lucide-react';
import { Button, FloatingCartButton, ProductDetailModal, ImageWithSkeleton, LanguageSwitcher } from '@components/common';

const placeholderImg = '/placeholder.png';

const Catalogue = () => {
  const { companyId, shopId } = useParams<{ companyName: string; companyId: string; shopId?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get('category'); // For backward compatibility
  const categoriesParam = searchParams.get('categories'); // For multiple categories
  const { addToCart } = useCart();
  const [company, setCompany] = useState<Company | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>(shopId || '');
  const [productStockMap, setProductStockMap] = useState<Map<string, number>>(new Map());
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Cache for products to prevent re-fetching - use ref to avoid infinite loops
  const productsCacheRef = useRef<Map<string, Product[]>>(new Map());
  
  // Cart modal state (removed - using FloatingCartButton instead)
  
  // Cart management functions (now using global context)
  const handleAddToCart = (product: Product) => {
    if (companyId) {
      addToCart(product, 1, undefined, undefined, companyId, selectedShopId);
    } else {
      addToCart(product, 1);
    }
  };

  // Handle shop selection change
  const handleShopChange = (newShopId: string) => {
    setSelectedShopId(newShopId);
    // Update URL to shop-specific route if not already on one
    if (companyId && company?.name) {
      const companyName = company.name.toLowerCase().replace(/\s+/g, '-');
      const newPath = `/catalogue/${companyName}/${companyId}/shop/${newShopId}`;
      navigate(newPath, { replace: true });
    }
  };

  // Product detail modal functions
  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setIsProductModalOpen(true);
  };

  const handleCloseProductModal = () => {
    setIsProductModalOpen(false);
    setSelectedProduct(null);
  };

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Category filter state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  
  // Product detail modal state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  
  // Ref to track if we're updating from URL to prevent infinite loops
  const isUpdatingFromUrl = useRef(false);

  // Get company colors with fallbacks - prioritize catalogue colors
  const getCompanyColors = () => {
    const colors = {
      primary: company?.catalogueColors?.primary || company?.primaryColor || '#183524',
      secondary: company?.catalogueColors?.secondary || company?.secondaryColor || '#e2b069',
      tertiary: company?.catalogueColors?.tertiary || company?.tertiaryColor || '#2a4a3a'
    };
    
    return colors;
  };

  // Set selected categories from URL parameters
  useEffect(() => {
    if (products.length > 0) {
      let categoriesToSet: string[] = [];
      
      // Check for multiple categories first (new format)
      if (categoriesParam) {
        const categories = categoriesParam.split(',').map(c => c.trim());
        categoriesToSet = categories.filter(category => 
          products.some(p => p.category === category)
        );
      }
      // Fallback to single category (backward compatibility)
      else if (categoryParam) {
        const categoryExists = products.some(p => p.category === categoryParam);
        if (categoryExists) {
          categoriesToSet = [categoryParam];
        }
      }
      
      if (categoriesToSet.length > 0) {
        isUpdatingFromUrl.current = true;
        setSelectedCategories(categoriesToSet);
        isUpdatingFromUrl.current = false;
      }
    }
  }, [categoryParam, categoriesParam, products]);

  // Clear selected categories when URL parameters are removed
  useEffect(() => {
    if (!categoryParam && !categoriesParam && selectedCategories.length > 0 && !isUpdatingFromUrl.current) {
      setSelectedCategories([]);
    }
  }, [categoryParam, categoriesParam, selectedCategories.length]);

  // Fetch company data
  useEffect(() => {
    const fetchCompany = async () => {
      if (!companyId) {
        setError('Company ID is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const companyData = await getCompanyByUserId(companyId);
        setCompany(companyData);
      } catch (err) {
        console.error('Error fetching company:', err);
        setError(`Company not found: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchCompany();
  }, [companyId]);

  // Subscribe to products with caching and real-time updates
  useEffect(() => {
    // Wait for company to be loaded before loading products
    if (!company?.id) return;

    // If we have cached data, show it immediately while waiting for real-time updates
    if (productsCacheRef.current.has(company.id)) {
      const cachedProducts = productsCacheRef.current.get(company.id)!;
      const filteredProducts = cachedProducts.filter(
        p => {
          // Filter out products that should not be shown in catalogue:
          // - Products marked as deleted (isDeleted: true)
          // - Products marked as unavailable (isAvailable: false) 
          // - Products marked as invisible (isVisible: false)
          const isAvailable = p.isAvailable !== false;
          const isNotDeleted = p.isDeleted !== true;
          const isVisible = p.isVisible !== false;
          
          return isAvailable && isNotDeleted && isVisible;
        }
      );
      setProducts(filteredProducts);
      setLoading(false);
    } else {
      // No cached data - set loading to true while we wait for subscription
      setLoading(true);
    }

    // Always subscribe to real-time updates, even if we have cached data
    // Note: onSnapshot fires immediately with current data, so callback will be called right away
    const unsubscribe = subscribeToProducts(company.id, (productsData) => {
      const companyProducts = productsData.filter(
        p => {
          // Filter out products that should not be shown in catalogue:
          // - Products marked as deleted (isDeleted: true)
          // - Products marked as unavailable (isAvailable: false) 
          // - Products marked as invisible (isVisible: false)
          const isAvailable = p.isAvailable !== false;
          const isNotDeleted = p.isDeleted !== true;
          const isVisible = p.isVisible !== false;
          
          return isAvailable && isNotDeleted && isVisible;
        }
      );
      
      // Cache the products for future use using company.id (using ref to avoid re-renders)
      productsCacheRef.current.set(company.id, productsData);
      setProducts(companyProducts);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [company?.id]);

  // Subscribe to categories for enhanced display
  useEffect(() => {
    // Wait for company to be loaded before loading categories
    if (!company?.id) return;

    const unsubscribe = subscribeToCategories(company.id, (categoriesData) => {
      setCategories(categoriesData);
    });

    return () => unsubscribe();
  }, [company?.id]);

  // Subscribe to shops
  useEffect(() => {
    if (!company?.id) return;

    const unsubscribe = subscribeToShops(company.id, (shopsData) => {
      setShops(shopsData);
      // Auto-select default shop if none selected
      if (!selectedShopId && shopsData.length > 0) {
        const defaultShop = shopsData.find(s => s.isDefault) || shopsData[0];
        if (defaultShop) {
          setSelectedShopId(defaultShop.id);
        }
      }
    });

    return () => unsubscribe();
  }, [company?.id, selectedShopId]);

  // Initialize shop from URL or default
  useEffect(() => {
    if (shopId && shopId !== selectedShopId) {
      setSelectedShopId(shopId);
    } else if (!shopId && company?.id && !selectedShopId) {
      const initializeDefaultShop = async () => {
        try {
          const defaultShop = await getDefaultShop(company.id);
          if (defaultShop) {
            setSelectedShopId(defaultShop.id);
          }
        } catch (error) {
          console.error('Error loading default shop', error);
        }
      };
      initializeDefaultShop();
    }
  }, [shopId, company?.id, selectedShopId]);

  // Load product stock for selected shop
  useEffect(() => {
    if (!company?.id || !selectedShopId || products.length === 0) {
      setProductStockMap(new Map());
      return;
    }

    const loadProductStock = async () => {
      const stockMap = new Map<string, number>();
      
      for (const product of products) {
        try {
          const batches = await getAvailableStockBatches(
            product.id,
            company.id,
            'product',
            selectedShopId,
            undefined,
            'shop'
          );
          const totalStock = batches.reduce((sum, batch) => sum + (batch.remainingQuantity || 0), 0);
          stockMap.set(product.id, totalStock);
        } catch (error) {
          console.error(`Error loading stock for product ${product.id}:`, error);
          stockMap.set(product.id, 0);
        }
      }
      
      setProductStockMap(stockMap);
    };

    loadProductStock();
  }, [company?.id, selectedShopId, products]);

  // Track catalogue view for analytics (gracefully handle errors for non-authenticated users)
  useEffect(() => {
    if (company?.id) {
      // Track view but don't break the page if it fails (e.g., for non-authenticated users)
      trackCatalogueView(company.id, {
        userAgent: navigator.userAgent,
        referrer: document.referrer
      }).catch((error) => {
        // Silently fail - analytics tracking should not break the catalogue experience
        // Error is already logged in trackCatalogueView function
        console.debug('Catalogue view tracking failed (non-critical):', error);
      });
    }
  }, [company?.id]);

  // Get unique categories from products
  const getUniqueCategories = () => {
    const productCategories = products.map(product => product.category);
    return Array.from(new Set(productCategories)).sort();
  };

  // Get category information (with fallback for categories without rich data)
  const getCategoryInfo = (categoryName: string) => {
    const category = categories.find(cat => cat.name === categoryName);
    if (category) {
      return {
        name: category.name,
        description: category.description,
        image: category.image,
        productCount: category.productCount || 0
      };
    }
    
    // Fallback for categories without rich data
    const productCount = products.filter(p => p.category === categoryName).length;
    return {
      name: categoryName,
      description: '',
      image: null,
      productCount
    };
  };

  // Handle category filter toggle
  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev => {
      let newCategories: string[];
      if (prev.includes(category)) {
        newCategories = prev.filter(c => c !== category);
      } else {
        newCategories = [...prev, category];
      }
      
      // Update URL parameters using navigate to ensure proper state update
      const newSearchParams = new URLSearchParams();
      if (newCategories.length > 0) {
        // Support multiple categories in URL as comma-separated values
        newSearchParams.set('categories', newCategories.join(','));
      }
      
      const newUrl = `${window.location.pathname}${newSearchParams.toString() ? '?' + newSearchParams.toString() : ''}`;
      navigate(newUrl, { replace: true });
      
      return newCategories;
    });
  };

  // Clear all category filters
  const clearCategoryFilters = () => {
    setSelectedCategories([]);
    
    // Clear URL parameters using navigate
    const newUrl = window.location.pathname;
    navigate(newUrl, { replace: true });
  };

  // Apply search, category, and shop stock filters
  useEffect(() => {
    let result = [...products];

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(product =>
        product.name.toLowerCase().includes(query) ||
        (product.category && product.category.toLowerCase().includes(query))
      );
    }

    // Apply category filter
    if (selectedCategories.length > 0) {
      result = result.filter(product =>
        product.category && selectedCategories.includes(product.category)
      );
    }

    // Apply shop stock filter (only show products with stock in selected shop)
    if (selectedShopId) {
      result = result.filter(product => {
        const stock = productStockMap.get(product.id) || 0;
        return stock > 0;
      });
    }

    setFilteredProducts(result);
  }, [products, searchQuery, selectedCategories, selectedShopId, productStockMap, categoryParam, categoriesParam]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{borderColor: getCompanyColors().primary}}></div>
      </div>
    );
  }

  if (error && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Catalogue non trouvé</h2>
        <p className="text-gray-600 mb-4 text-center max-w-md">
          {error.includes('Company not found') 
            ? 'L\'entreprise associée à ce catalogue n\'existe pas ou n\'est plus accessible. Vérifiez que le lien est correct.'
            : error
          }
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={() => navigate(-1)} variant="outline">
            Retour
          </Button>
          <Button onClick={() => window.location.reload()}>
            Réessayer
          </Button>
        </div>
        <div className="mt-4 text-sm text-gray-500">
          <p>Si le problème persiste, contactez l'administrateur.</p>
          <p className="mt-1">ID de l'entreprise: {companyId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Top Section - Shop Information */}
      <div className="text-white" style={{background: `linear-gradient(to right, ${getCompanyColors().primary}, ${getCompanyColors().tertiary})`}}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Language Switcher - Top Right */}
          <div className="flex justify-end mb-4">
            <LanguageSwitcher variant="dark" />
          </div>
          
          {/* Shop Header with Logo, Name, and Contact */}
          <div className="flex items-center space-x-6 mb-6">
            {/* Shop Logo */}
            <div className="flex-shrink-0">
              {company?.logo ? (
              <img
                src={company.logo}
                  alt={company.name || 'Shop Logo'}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-3 border-white shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white bg-opacity-20 flex items-center justify-center border-3 border-white">
                  <Package className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
                </div>
              )}
                </div>
            
            {/* Shop Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-allura sm:text-3xl lg:text-4xl font-bold text-white mb-2">
                {company?.name || 'Best Products in your home'}
              </h1>
              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-6 text-sm sm:text-base" style={{color: 'rgba(255, 255, 255, 0.8)'}}>
                {company?.location && (
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    <span className="truncate">{company.location}</span>
                  </div>
                )}
                {company?.phone && (
                  <div className="flex items-center">
                    <Phone className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    <span>{company.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Shop Selector and Search Bar */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            {/* Shop Selector - Only show if multiple shops exist */}
            {shops.length > 1 && (
              <div className="flex items-center gap-2 bg-white bg-opacity-20 rounded-xl px-4 py-2 backdrop-blur-sm">
                <Store className="h-5 w-5 text-white" />
                <select
                  value={selectedShopId}
                  onChange={(e) => handleShopChange(e.target.value)}
                  className="bg-transparent text-white border-none outline-none cursor-pointer text-sm sm:text-base font-medium"
                  style={{ color: 'white' }}
                >
                  {shops.map((shop) => (
                    <option key={shop.id} value={shop.id} style={{ color: '#000' }}>
                      {shop.name} {shop.isDefault ? '(Par défaut)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Search Bar */}
            <div className="relative flex-1 max-w-2xl">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-theme-brown" />
              <input
                type="text"
                placeholder="Rechercher des produits..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white rounded-xl border-0 focus:outline-none text-gray-900 placeholder-gray-500 text-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter Chips */}
      {products.length > 0 && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center space-x-3 overflow-x-auto scrollbar-hide pb-2">
              {/* All Categories Chip */}
              <button
                onClick={clearCategoryFilters}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  selectedCategories.length === 0
                    ? 'text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                style={selectedCategories.length === 0 ? {backgroundColor: getCompanyColors().primary} : {}}
              >
                {selectedCategories.length === 0 
                  ? `Tous (${products.length})` 
                  : `Effacer (${selectedCategories.length} sélectionné${selectedCategories.length > 1 ? 's' : ''})`
                }
              </button>
              
              {/* Category Chips */}
              {getUniqueCategories().filter((cat): cat is string => cat !== undefined).map((categoryName) => {
                const isSelected = selectedCategories.includes(categoryName);
                const categoryInfo = getCategoryInfo(categoryName);
                
                return (
                  <button
                    key={categoryName}
                    onClick={() => handleCategoryToggle(categoryName)}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
                      isSelected
                        ? 'text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    style={isSelected ? {backgroundColor: getCompanyColors().primary} : {}}
                  >
                    {categoryInfo.image && (
                      <div className="w-5 h-5 rounded-full overflow-hidden bg-white bg-opacity-20 flex-shrink-0">
                        <ImageWithSkeleton
                          src={categoryInfo.image}
                          alt={categoryInfo.name}
                          className="w-full h-full object-cover"
                          placeholder=""
                        />
                      </div>
                    )}
                    <span>
                      {categoryInfo.name} ({categoryInfo.productCount})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* New Arrival Section */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Produits</h2>
          <button className="text-sm sm:text-base font-medium transition-colors" style={{color: getCompanyColors().primary}} onMouseEnter={(e) => (e.target as HTMLButtonElement).style.color = getCompanyColors().tertiary} onMouseLeave={(e) => (e.target as HTMLButtonElement).style.color = getCompanyColors().primary}>
            Voir tout →
                </button>
        </div>

        {/* Products Grid */}
      {filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <Package className="mx-auto h-16 w-16 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">Aucun produit trouvé</h3>
            <p className="mt-2 text-gray-500">
              Essayez d'ajuster votre recherche ou vos filtres
          </p>
        </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
            {filteredProducts.map((product) => {
                    const images = product.images! ;
              const mainImg = images.length > 0 ? images[0] : placeholderImg;
              
                    return (
                <div key={product.id} className="bg-white rounded-lg sm:rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-200 overflow-hidden group">
                  {/* Product Image - Clickable */}
                  <div 
                    className="relative aspect-square cursor-pointer overflow-hidden"
                    onClick={() => handleProductClick(product)}
                  >
                      <ImageWithSkeleton
                        src={mainImg}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        placeholder={placeholderImg}
                      />
                    <button className="absolute top-2 right-2 sm:top-3 sm:right-3 p-1.5 sm:p-2 bg-white rounded-full shadow-md hover:shadow-lg transition-shadow">
                      <Heart className="h-3 w-3 sm:h-4 sm:w-4 border-theme-brown text-gray-400 hover:text-red-500 transition-colors" />
                    </button>
                </div>
                  
                  {/* Product Info */}
                  <div className="p-3 sm:p-4">
                    <h3 
                      className="font-semibold text-gray-900 text-xs sm:text-sm md:text-base mb-1 sm:mb-2 line-clamp-2 cursor-pointer transition-colors" style={{color: getCompanyColors().primary}} onMouseEnter={(e) => (e.target as HTMLElement).style.color = getCompanyColors().secondary} onMouseLeave={(e) => (e.target as HTMLElement).style.color = getCompanyColors().primary}
                      onClick={() => handleProductClick(product)}
                    >
                      {product.name}
                    </h3>
                    <p className="text-xs text-gray-500 mb-2 sm:mb-3">{product.category}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm md:text-base font-bold" style={{color: getCompanyColors().secondary}}>
                        {(product.cataloguePrice ?? 0).toLocaleString('fr-FR', {
                          style: 'currency',
                          currency: 'XAF'
                        })}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(product);
                        }}
                        className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white transition-colors shadow-md hover:shadow-lg" style={{backgroundColor: getCompanyColors().secondary}} onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = getCompanyColors().tertiary} onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = getCompanyColors().secondary}
                      >
                        <Plus className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
              </div>
        )}
        </div>


      {/* Bottom Navigation - Hidden */}
      {/* <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 md:hidden">
        <div className="flex items-center justify-around">
          <button className="flex flex-col items-center space-y-1 text-emerald-600">
            <div className="w-6 h-6 bg-emerald-600 rounded"></div>
            <span className="text-xs">Home</span>
          </button>
          <button className="flex flex-col items-center space-y-1 text-gray-400">
            <ShoppingBag className="w-6 h-6" />
            <span className="text-xs">Bag</span>
                                  </button>
          <button className="flex flex-col items-center space-y-1 text-gray-400">
            <div className="w-6 h-6 bg-gray-300 rounded-full"></div>
            <span className="text-xs">Profile</span>
                                  </button>
                        </div>
      </div> */}

      {/* Floating Cart Button */}
      <FloatingCartButton />

      {/* Product Detail Modal */}
      {selectedProduct && company && (
        <ProductDetailModal
          isOpen={isProductModalOpen}
          onClose={handleCloseProductModal}
          product={selectedProduct}
          company={company}
          companyId={companyId || ''}
        />
      )}
    </div>
  );
};

export default Catalogue; 