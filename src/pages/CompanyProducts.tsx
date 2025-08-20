import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getCompanyByUserId, subscribeToProducts } from '../services/firestore';
import type { Company, Product } from '../types/models';
import { Search, Package, AlertCircle, Grid, List, Phone, MapPin, ChevronLeft, ChevronRight, ArrowUp } from 'lucide-react';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';

const placeholderImg = '/placeholder.png';

const CompanyProducts = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  // For image navigation in list view
  const [mainImageIndexes, setMainImageIndexes] = useState<Record<string, number>>({});
  
  // Scroll to top functionality
  const handleScrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // Handle scroll detection
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      setShowScrollToTop(scrollTop > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSetMainImage = (productId: string, idx: number) => {
    setMainImageIndexes(prev => ({ ...prev, [productId]: idx }));
  };
  const handlePrevImage = (productId: string, images: string[]) => {
    setMainImageIndexes(prev => {
      const current = prev[productId] ?? 0;
      return { ...prev, [productId]: (current - 1 + images.length) % images.length };
    });
  };
  const handleNextImage = (productId: string, images: string[]) => {
    setMainImageIndexes(prev => {
      const current = prev[productId] ?? 0;
      return { ...prev, [productId]: (current + 1) % images.length };
    });
  };

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Fetch company data
  useEffect(() => {
    const fetchCompany = async () => {
      if (!companyId) {
        setError('Company ID is required');
        setLoading(false);
        return;
      }

      try {
        const companyData = await getCompanyByUserId(companyId);
        setCompany(companyData);
      } catch (err) {
        setError('Company not found');
        console.error('Error fetching company:', err);
      }
    };

    fetchCompany();
  }, [companyId]);

  // Subscribe to products
  useEffect(() => {
    if (!companyId) return;

    const unsubscribe = subscribeToProducts((productsData) => {
      const companyProducts = productsData.filter(
        p => p.userId === companyId && p.isAvailable !== false && p.isDeleted !== true
      );
      setProducts(companyProducts);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId]);

  // Apply filters and search
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
    if (categoryFilter) {
      result = result.filter(product => product.category === categoryFilter);
    }

    // Apply availability filter
    if (availabilityFilter === 'available') {
      result = result.filter(product => product.isAvailable && product.stock > 0);
    } else if (availabilityFilter === 'out_of_stock') {
      result = result.filter(product => product.stock === 0);
    } else if (availabilityFilter === 'unavailable') {
      result = result.filter(product => !product.isAvailable);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'price':
          comparison = (a.cataloguePrice ?? 0) - (b.cataloguePrice ?? 0);
          break;
        case 'stock':
          comparison = a.stock - b.stock;
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredProducts(result);
  }, [products, searchQuery, categoryFilter, availabilityFilter, sortBy, sortOrder]);

  // Get unique categories
  const categories = Array.from(new Set(products.map(p => p.category)));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
        <p className="text-gray-600 mb-4">{error || 'Company not found'}</p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Company Header */}
      <Card className="mb-8">
        <div className="p-4 md:p-6">
          <div className="flex flex-row items-center gap-3 md:gap-6">
            {company.logo && (
              <img
                src={company.logo}
                alt={company.name}
                className="h-12 w-12 md:h-20 md:w-20 rounded-lg object-cover flex-shrink-0"
              />
            )}
            <div className="flex-grow min-w-0">
              <h1 className="text-lg md:text-2xl font-bold text-gray-900 truncate">{company.name}</h1>
              {company.description && (
                <p className="text-sm md:text-base text-gray-600 mt-1 line-clamp-2 md:line-clamp-none">{company.description}</p>
              )}
              <div className="mt-2 md:mt-4 flex flex-col sm:flex-row sm:gap-4 gap-1">
                <div className="flex items-center text-xs md:text-sm text-gray-500">
                  <Phone className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 flex-shrink-0" />
                  <a href={`tel:${company.phone}`} className="hover:text-emerald-600 truncate">
                    {company.phone}
                  </a>
                </div>
                {company.location && (
                  <div className="flex items-center text-xs md:text-sm text-gray-500">
                    <MapPin className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 flex-shrink-0" />
                    <span className="truncate">{company.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Filters and Search */}
      <Card className="mb-6">
        <div className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Rechercher des produits..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="grid grid-cols-2 md:flex md:space-x-2 gap-2">
                <select
                  className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 bg-white focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                  value={categoryFilter}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCategoryFilter(e.target.value)}
                >
                  <option value="">Toutes les catégories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>

                <select
                  className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 bg-white focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                  value={availabilityFilter}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAvailabilityFilter(e.target.value)}
                >
                  <option value="">Tous les produits</option>
                  <option value="available">En stock</option>
                  <option value="out_of_stock">Rupture de stock</option>
                  <option value="unavailable">Non disponible</option>
                </select>

                <div className="col-span-2 md:col-span-1 flex gap-2">
                  <select
                    className="flex-grow rounded-md border border-gray-300 shadow-sm py-2 px-3 bg-white focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                    value={sortBy}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortBy(e.target.value)}
                  >
                    <option value="name">Trier par nom</option>
                    <option value="price">Trier par prix</option>
                    <option value="stock">Trier par stock</option>
                  </select>

                  <Button
                    variant="outline"
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="px-2 py-2"
                  >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </Button>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-gray-200' : 'bg-white'}`}
                  onClick={() => setViewMode('grid')}
                  title="Vue en grille"
                >
                  <Grid size={18} />
                </button>
                <button
                  className={`p-2 rounded-md ${viewMode === 'table' ? 'bg-gray-200' : 'bg-white'}`}
                  onClick={() => setViewMode('table')}
                  title="Vue en tableau"
                >
                  <List size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Products Display */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun produit trouvé</h3>
          <p className="mt-1 text-sm text-gray-500">
            Essayez de modifier vos filtres ou votre recherche
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="h-full" contentClassName="p-0">
              <div className="flex flex-col h-full p-0">
                {/* Main image: full width, edge-to-edge */}
                <div className="relative w-full aspect-[1.35/1] overflow-hidden rounded-t-md">
                  {(() => {
                    const images = product.images ?? [];
                    const mainIdx = mainImageIndexes[product.id] ?? 0;
                    const mainImg = images.length > 0 ? (images[mainIdx]?.startsWith('data:image') ? images[mainIdx] : `data:image/jpeg;base64,${images[mainIdx]}`) : placeholderImg;
                    return (
                      <img
                        src={mainImg}
                        alt={product.name}
                        className="absolute h-full w-full object-cover transition-all duration-300"
                        key={mainImg}
                      />
                    );
                  })()}
                </div>
                {/* Preview row */}
                <div className="flex items-center gap-1 px-2 py-2 bg-white border-b border-gray-100 overflow-x-auto custom-scrollbar">
                  {(product.images ?? []).map((img, idx) => (
                    <img
                      key={idx}
                      src={img.startsWith('data:image') ? img : `data:image/jpeg;base64,${img}`}
                      alt={`Preview ${idx + 1}`}
                      className={`w-10 h-10 object-cover rounded border cursor-pointer transition-transform duration-200 ${mainImageIndexes[product.id] === idx ? 'ring-2 ring-emerald-500 scale-105' : 'opacity-70 hover:opacity-100'}`}
                      onClick={() => handleSetMainImage(product.id, idx)}
                    />
                  ))}
                </div>
                <div className="p-4 flex-grow">
                  <h3 className="font-medium text-gray-900 mb-1 line-clamp-2">{product.name}</h3>
                  <p className="text-sm text-gray-500 mb-2">{product.category}</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-emerald-600">
                        {(product.cataloguePrice ?? 0).toLocaleString('fr-FR', {
                          style: 'currency',
                          currency: 'XAF'
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <Badge
                        variant={product.stock > 10 ? 'success' : product.stock > 5 ? 'warning' : 'error'}
                      >
                        {product.stock > 0 ? `${product.stock} en stock` : 'Rupture de stock'}
                      </Badge>
                      {!product.isAvailable && (
                        <span className="text-sm text-red-600">Non disponible</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Produit
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Catégorie
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prix
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 relative group">
                          {(() => {
                            const images = product.images ?? [];
                            const mainIdx = mainImageIndexes[product.id] ?? 0;
                            const mainImg = images.length > 0 ? (images[mainIdx]?.startsWith('data:image') ? images[mainIdx] : `data:image/jpeg;base64,${images[mainIdx]}`) : placeholderImg;
                            return (
                              <>
                                {images.length > 1 && (
                                  <button
                                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white bg-opacity-80 rounded-full p-0.5 border border-gray-200 opacity-40 group-hover:opacity-90 transition-opacity duration-200"
                                    onClick={() => handlePrevImage(product.id, images)}
                                    style={{ left: '-20px' }}
                                    tabIndex={-1}
                                    aria-label="Previous image"
                                  >
                                    <ChevronLeft size={12} className="text-gray-400" />
                                  </button>
                                )}
                                <img className="h-10 w-10 rounded-md object-cover transition-all duration-300" src={mainImg} alt="" key={mainImg} />
                                {images.length > 1 && (
                                  <button
                                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white bg-opacity-80 rounded-full p-0.5 border border-gray-200 opacity-40 group-hover:opacity-90 transition-opacity duration-200"
                                    onClick={() => handleNextImage(product.id, images)}
                                    style={{ right: '-20px' }}
                                    tabIndex={-1}
                                    aria-label="Next image"
                                  >
                                    <ChevronRight size={12} className="text-gray-400" />
                                  </button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        <div className="ml-6">
                          <div className="text-sm font-medium text-gray-900">{product.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{product.category}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-emerald-600">
                        {product.cataloguePrice?.toLocaleString('fr-FR', {
                          style: 'currency',
                          currency: 'XAF'
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge
                        variant={product.stock > 10 ? 'success' : product.stock > 5 ? 'warning' : 'error'}
                      >
                        {product.stock > 0 ? `${product.stock} en stock` : 'Rupture de stock'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {/* Scroll to Top Button */}
      {showScrollToTop && (
        <button
          onClick={handleScrollToTop}
          className="fixed bottom-6 right-6 z-50 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full p-3 shadow-lg transition-all duration-300 hover:scale-110"
          title="Retour en haut"
          aria-label="Retour en haut"
        >
          <ArrowUp size={24} />
        </button>
      )}
    </div>
  );
};

export default CompanyProducts; 