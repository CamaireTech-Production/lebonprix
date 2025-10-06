import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { getCompanyByUserId, subscribeToProducts } from '../services/firestore';
import type { Company, Product } from '../types/models';
import { ArrowLeft, Share2, Heart, Star, Plus, Minus, ChevronRight } from 'lucide-react';
import FloatingCartButton from '../components/common/FloatingCartButton';

const placeholderImg = '/placeholder.png';

const ProductDetail = () => {
  const { companyId, productId } = useParams<{ companyId: string; productId: string }>();
  const navigate = useNavigate();
  useAuth();
  const { addToCart } = useCart();
  const [, setCompany] = useState<Company | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Product detail state
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

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

  // Subscribe to products and find the specific product
  useEffect(() => {
    if (!companyId || !productId) return;

    const unsubscribe = subscribeToProducts(companyId, (productsData) => {
      const foundProduct = productsData.find(p => p.id === productId);
      if (foundProduct) {
        setProduct(foundProduct);
        // Set default color and size if available (placeholder for future implementation)
        // Note: Product type doesn't currently have colors/sizes properties
        // This is prepared for future enhancement
      } else {
        setError('Product not found');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId, productId]);

  // Cart management functions (using global context)
  const handleAddToCart = () => {
    if (!product) return;
    addToCart(product, quantity, selectedColor, selectedSize);
    console.log('Added to cart:', product.name, 'Quantity:', quantity);
  };

  const updateQuantity = (newQuantity: number) => {
    if (newQuantity >= 1) {
      setQuantity(newQuantity);
    }
  };

  // Image navigation functions
  const nextImage = () => {
    if (product?.images && product.images.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % product.images!.length);
    }
  };

  const prevImage = () => {
    if (product?.images && product.images.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + product.images!.length) % product.images!.length);
    }
  };

  const goToImage = (index: number) => {
    setCurrentImageIndex(index);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error || 'Product not found'}</p>
          <button
            onClick={() => navigate(-1)}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const images = product?.images ?? [];
  const currentImg = images.length > 0 ? (images[currentImageIndex]?.startsWith('data:image') ? images[currentImageIndex] : `data:image/jpeg;base64,${images[currentImageIndex]}`) : placeholderImg;

  // Mock colors and sizes for demonstration (placeholder for future implementation)
  const colors = ['green', 'orange', 'pink'];
  const sizes = ['XS', 'S', 'M', 'L', 'XL'];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white shadow-sm z-30">
        <div className="h-full flex items-center justify-between px-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <Share2 className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Spacer for sticky header */}
      <div className="h-16"></div>

      {/* Product Image Area */}
      <div className="relative h-[50vh] bg-gray-100 mx-4 my-4 rounded-2xl overflow-hidden">
        <img
          src={currentImg}
          alt={product.name}
          className="w-full h-full object-cover"
        />
        
        {/* Image Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 shadow-lg transition-all"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 shadow-lg transition-all"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </>
        )}
        
        {/* Image Indicators */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => goToImage(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentImageIndex ? 'bg-white' : 'bg-white bg-opacity-50'
                }`}
              />
            ))}
          </div>
        )}
        
        {/* Floating Quantity Selector */}
        <div className="absolute right-4 top-4">
          <div className="bg-white rounded-lg border border-gray-200 p-2 shadow-lg">
            <button
              onClick={() => updateQuantity(quantity - 1)}
              className="w-8 h-8 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
            >
              <Minus className="h-4 w-4" />
            </button>
            <div className="w-8 h-8 flex items-center justify-center text-gray-900 font-medium">
              {quantity}
            </div>
            <button
              onClick={() => updateQuantity(quantity + 1)}
              className="w-8 h-8 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Sheet - Product Details */}
      <div className="bg-white rounded-t-3xl -mt-6 relative z-10 min-h-[40vh] flex flex-col">
        {/* Drag Handle */}
        <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mt-4 mb-6"></div>
        
        <div className="px-6 pb-32 flex-1">
          {/* Product Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900 mb-2">{product.name}</h1>
              <div className="flex items-center space-x-3">
                <span className="text-lg font-bold text-gray-900">
                  {(product.cataloguePrice ?? 0).toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: 'XAF'
                  })}
                </span>
                <div className="flex items-center space-x-1">
                  <Star className="h-4 w-4 text-yellow-400 fill-current" />
                  <span className="text-sm text-gray-600">4.9</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsFavorite(!isFavorite)}
              className={`p-2 rounded-full transition-colors ${
                isFavorite ? 'bg-emerald-100 text-emerald-500' : 'bg-gray-100 text-gray-400'
              }`}
            >
              <Heart className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Product Details */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Product Details</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Category:</span>
                <span className="font-medium">{product.category}</span>
              </div>
              <div className="flex justify-between">
                <span>Stock:</span>
                <span className="font-medium">{product.stock} available</span>
              </div>
              <div className="flex justify-between">
                <span>Quantity:</span>
                <span className="font-medium">{quantity} selected</span>
              </div>
            </div>
          </div>

          {/* Color Selection */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Color</h3>
            <div className="flex space-x-3">
              {colors.map((color: string) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-10 h-10 rounded-lg border-2 transition-all ${
                    selectedColor === color
                      ? 'border-emerald-500 scale-110'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={{ backgroundColor: color }}
                >
                  {selectedColor === color && (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-3 h-3 bg-white rounded-full"></div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Size Selection */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Size</h3>
            <div className="flex space-x-2">
              {sizes.map((size: string) => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedSize === size
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Description</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              {product.name}
            </p>
          </div>
        </div>
      </div>

      {/* Sticky Add to Cart Button */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 z-20">
        <button
          onClick={handleAddToCart}
          className="w-full bg-emerald-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-emerald-700 transition-colors shadow-lg"
        >
          Add to Cart - {((product.cataloguePrice ?? 0) * quantity).toLocaleString('fr-FR', {
            style: 'currency',
            currency: 'XAF'
          })}
        </button>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-20">
        <div className="flex items-center justify-around">
          <button className="flex flex-col items-center space-y-1 text-emerald-600">
            <div className="w-6 h-6 bg-emerald-600 rounded"></div>
            <span className="text-xs">Home</span>
          </button>
          <button className="flex flex-col items-center space-y-1 text-gray-400">
            <div className="w-6 h-6 bg-gray-300 rounded"></div>
            <span className="text-xs">Bag</span>
          </button>
          <button className="flex flex-col items-center space-y-1 text-gray-400">
            <div className="w-6 h-6 bg-gray-300 rounded"></div>
            <span className="text-xs">Cart</span>
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

export default ProductDetail;
