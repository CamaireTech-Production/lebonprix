import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { getCompanyByUserId, subscribeToProducts } from '../services/firestore';
import type { Company, Product } from '../types/models';
import { Search, Package, AlertCircle, MapPin, Plus, ShoppingBag, Heart, Phone } from 'lucide-react';
import Button from '../components/common/Button';
import FloatingCartButton from '../components/common/FloatingCartButton';
import ProductDetailModal from '../components/common/ProductDetailModal';
import { ImageWithSkeleton } from '../components/common/ImageWithSkeleton';

const placeholderImg = '/placeholder.png';

const Catalogue = () => {
  const { companyId } = useParams<{ companyName: string; companyId: string }>();
  const navigate = useNavigate();
  useAuth();
  const { addToCart } = useCart();
  const [company, setCompany] = useState<Company | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Cache for products to prevent re-fetching
  const [productsCache, setProductsCache] = useState<Map<string, Product[]>>(new Map());
  
  // Cart modal state (removed - using FloatingCartButton instead)
  
  // Cart management functions (now using global context)
  const handleAddToCart = (product: Product) => {
    addToCart(product, 1);
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
        setError('Company not found');
      } finally {
        setLoading(false);
      }
    };

    fetchCompany();
  }, [companyId]);

  // Subscribe to products with caching
  useEffect(() => {
    if (!companyId) return;

    // Check if we already have cached products for this company
    if (productsCache.has(companyId)) {
      const cachedProducts = productsCache.get(companyId)!;
      const filteredProducts = cachedProducts.filter(
        p => p.isAvailable !== false && p.isDeleted !== true
      );
      setProducts(filteredProducts);
      setLoading(false);
      return;
    }

    // Only fetch if not cached
    const unsubscribe = subscribeToProducts(companyId, (productsData) => {
      const companyProducts = productsData.filter(
        p => p.isAvailable !== false && p.isDeleted !== true
      );
      
      // Cache the products for future use
      setProductsCache(prev => new Map(prev).set(companyId, productsData));
      setProducts(companyProducts);
      
      // Only set loading to false if we have company data
      if (company) {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [companyId, company, productsCache]);

  // Get unique categories from products
  const getUniqueCategories = () => {
    const categories = products.map(product => product.category);
    return Array.from(new Set(categories)).sort();
  };

  // Handle category filter toggle
  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };

  // Clear all category filters
  const clearCategoryFilters = () => {
    setSelectedCategories([]);
  };

  // Apply search and category filters
  useEffect(() => {
    let result = [...products];

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(product =>
        product.name.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (selectedCategories.length > 0) {
      result = result.filter(product =>
        selectedCategories.includes(product.category)
      );
    }

    setFilteredProducts(result);
  }, [products, searchQuery, selectedCategories]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Top Section - Shop Information */}
      <div className="bg-gradient-to-r from-theme-brown  to-theme-forest text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-6 text-sm sm:text-base text-emerald-100">
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
          
          {/* Search Bar */}
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-theme-brown" />
            <input
                type="text"
              placeholder="Search products..."
                value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white rounded-xl border-0 focus:ring-2 focus:ring-theme-forest/60 focus:outline-none text-gray-900 placeholder-gray-500 text-lg shadow-lg"
              />
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
                    ? 'bg-theme-orange text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({products.length})
              </button>
              
              {/* Category Chips */}
              {getUniqueCategories().map((category) => {
                const categoryCount = products.filter(p => p.category === category).length;
                const isSelected = selectedCategories.includes(category);
                
                return (
                  <button
                    key={category}
                    onClick={() => handleCategoryToggle(category)}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                      isSelected
                        ? 'bg-theme-orange text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {category} ({categoryCount})
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
          <h2 className="text-2xl sm:text-3xl font-semibold  font-allura text-gray-900">Products</h2>
          <button className="text-theme-forest text-sm sm:text-base font-medium hover:text-theme-brown transition-colors">
            See all →
                </button>
        </div>

        {/* Products Grid */}
      {filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <Package className="mx-auto h-16 w-16 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No products found</h3>
            <p className="mt-2 text-gray-500">
              Try adjusting your search or filters
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
                      className="font-semibold text-theme-brown  text-xs sm:text-sm md:text-base mb-1 sm:mb-2 line-clamp-2 cursor-pointer hover:text-emerald-600 transition-colors"
                      onClick={() => handleProductClick(product)}
                    >
                      {product.name}
                    </h3>
                    <p className="text-xs text-gray-500 mb-2 sm:mb-3">{product.category}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm md:text-base font-bold text-theme-brown">
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
                        className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-gradient-to-br from-theme-olive to-theme-forest rounded-full flex items-center justify-center text-white hover:bg-emerald-700 transition-colors shadow-md hover:shadow-lg"
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