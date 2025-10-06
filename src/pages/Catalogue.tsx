import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { getCompanyByUserId, subscribeToProducts } from '../services/firestore';
import type { Company, Product } from '../types/models';
import { Search, Package, AlertCircle, MapPin, Plus, ShoppingBag, Heart, Phone } from 'lucide-react';
import Button from '../components/common/Button';
import FloatingCartButton from '../components/common/FloatingCartButton';

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
  
  // Cart modal state (removed - using FloatingCartButton instead)
  
  // Cart management functions (now using global context)
  const handleAddToCart = (product: Product) => {
    addToCart(product, 1);
  };

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

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

  // Subscribe to products
  useEffect(() => {
    if (!companyId) return;

    const unsubscribe = subscribeToProducts(companyId, (productsData) => {
      const companyProducts = productsData.filter(
        p => p.isAvailable !== false && p.isDeleted !== true
      );
      setProducts(companyProducts);
      // Only set loading to false if we have company data
      if (company) {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [companyId, company]);

  // Apply search filter
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

    setFilteredProducts(result);
  }, [products, searchQuery]);

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
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white">
        <div className="p-4">
          {/* Shop Header with Logo, Name, and Contact */}
          <div className="flex items-center space-x-4 mb-4">
            {/* Shop Logo */}
            <div className="flex-shrink-0">
              {company?.logo ? (
                <img
                  src={company.logo}
                  alt={company.name || 'Shop Logo'}
                  className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-lg"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-white bg-opacity-20 flex items-center justify-center border-2 border-white">
                  <Package className="h-8 w-8 text-white" />
                </div>
              )}
            </div>
            
            {/* Shop Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-white mb-1 truncate">
                {company?.name || 'Best Products in your home'}
              </h1>
              <div className="flex items-center space-x-4 text-sm text-emerald-100">
                {company?.location && (
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span className="truncate">{company.location}</span>
                  </div>
                )}
                {company?.phone && (
                  <div className="flex items-center">
                    <Phone className="h-4 w-4 mr-1" />
                    <span>{company.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white rounded-lg border-0 focus:ring-2 focus:ring-emerald-300 focus:outline-none text-gray-900 placeholder-gray-500"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4">
        {/* New Arrival Section */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">New Arrival</h2>
          <button className="text-emerald-600 text-sm font-medium">See all →</button>
        </div>

        {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No products found</h3>
          <p className="mt-1 text-sm text-gray-500">
              Try adjusting your search or filters
          </p>
        </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filteredProducts.map((product) => {
                    const images = product.images ?? [];
              const mainImg = images.length > 0 ? (images[0]?.startsWith('data:image') ? images[0] : `data:image/jpeg;base64,${images[0]}`) : placeholderImg;
              
              return (
                <div key={product.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                  {/* Product Image - Clickable */}
                  <div 
                    className="relative aspect-square cursor-pointer"
                    onClick={() => navigate(`/product/${companyId}/${product.id}`)}
                  >
                    <img
                      src={mainImg}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                    <button className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-sm">
                      <Heart className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                  
                  {/* Product Info */}
                  <div className="p-3">
                    <h3 
                      className="font-medium text-gray-900 text-sm mb-1 line-clamp-2 cursor-pointer hover:text-emerald-600 transition-colors"
                      onClick={() => navigate(`/product/${companyId}/${product.id}`)}
                    >
                      {product.name}
                    </h3>
                    <p className="text-xs text-gray-500 mb-2">{product.category}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-emerald-600">
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
                        className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-white hover:bg-emerald-700 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
              </div>
        )}
        </div>


      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2">
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
      </div>

      {/* Floating Cart Button */}
      <FloatingCartButton />
    </div>
  );
};

export default Catalogue; 