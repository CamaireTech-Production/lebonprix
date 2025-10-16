import { useState, useEffect } from 'react';
import { useCart } from '../../contexts/CartContext';
import { getCompanyByUserId, subscribeToProducts } from '../../services/firestore';
import type { Company, Product} from '../../types/models';
import { X, Share2, Heart, Star, Plus, Minus, ChevronRight } from 'lucide-react';
import FloatingCartButton from './FloatingCartButton';
import { ImageWithSkeleton } from './ImageWithSkeleton';
import DesktopProductDetail from './DesktopProductDetail';

const placeholderImg = '/placeholder.png';

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  company: Company;
  companyId: string;
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  isOpen,
  onClose,
  product: initialProduct,
  company: initialCompany,
  companyId
}) => {
  const { addToCart } = useCart();
  const [isDesktop, setIsDesktop] = useState(false);

  // Check if screen is desktop size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 1024); // lg breakpoint
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  
  // Use passed data immediately
  const [company, setCompany] = useState<Company | null>(initialCompany);
  const [product, setProduct] = useState<Product | null>(initialProduct);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Product detail state
  const [quantity, setQuantity] = useState(1);
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Fetch fresh data in background to ensure data freshness
  useEffect(() => {
    if (!isOpen) return;

    const fetchFreshData = async () => {
      try {
        const [companyData, productsData] = await Promise.all([
          getCompanyByUserId(companyId),
          new Promise<Product[]>((resolve) => {
            const unsubscribe = subscribeToProducts(companyId, (products) => {
              unsubscribe(); // Unsubscribe immediately after getting data
              resolve(products);
            });
          })
        ]);

        const foundProduct = productsData.find(p => p.id === product?.id);
        if (foundProduct) {
          // Only update if there are actual changes
          setProduct(prev => prev?.id === foundProduct.id ? foundProduct : prev);
          setCompany(companyData);
        }
      } catch (err) {
        console.error('Error fetching fresh data:', err);
        // Don't show error for background fetch failures
      }
    };

    fetchFreshData();
  }, [isOpen, companyId, product?.id]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setProduct(initialProduct);
      setCompany(initialCompany);
      setQuantity(1);
      setSelectedVariations({});
      setCurrentImageIndex(0);
      setError(null);
    }
  }, [isOpen, initialProduct, initialCompany]);

  // Cart management functions
  const handleAddToCart = () => {
    if (!product) return;
    // Convert selectedVariations to the format expected by addToCart
    const selectedColor = selectedVariations['Color'] || '';
    const selectedSize = selectedVariations['Size'] || '';
    addToCart(product, quantity, selectedColor, selectedSize);
    console.log('Added to cart:', product.name, 'Quantity:', quantity, 'Variations:', selectedVariations);
  };

  const updateQuantity = (newQuantity: number) => {
    if (newQuantity >= 1) {
      setQuantity(newQuantity);
    }
  };

  // Image navigation functions
  const nextImage = () => {
    if (!product?.images) return;
    setCurrentImageIndex((prev) => 
      prev < product.images!.length - 1 ? prev + 1 : 0
    );
  };

  const prevImage = () => {
    if (!product?.images) return;
    setCurrentImageIndex((prev) => 
      prev > 0 ? prev - 1 : product.images!.length - 1
    );
  };

  const goToImage = (index: number) => {
    setCurrentImageIndex(index);
  };

  // Handle variation selection
  const handleVariationChange = (tagId: string, variationId: string) => {
    setSelectedVariations(prev => ({
      ...prev,
      [tagId]: variationId
    }));
    
    // If this variation has an associated image, switch to it
    if (product?.tags) {
      const tag = product.tags.find(t => t.id === tagId);
      const variation = tag?.variations.find(v => v.id === variationId);
      if (variation?.imageIndex !== undefined && variation.imageIndex < images.length) {
        setCurrentImageIndex(variation.imageIndex);
      }
    }
  };

  if (!isOpen || !product) return null;

  // Render desktop version for larger screens
  if (isDesktop) {
    return (
      <DesktopProductDetail
        isOpen={isOpen}
        onClose={onClose}
        product={product}
        company={company || initialCompany}
        companyId={companyId}
      />
    );
  }

  const images = product.images ?? [];
  const currentImage = images.length > 0 ? images[currentImageIndex] : placeholderImg;

  // Get available tags for this product
  const availableTags = product.tags || [];

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-hidden">
      {/* Sticky Header */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white shadow-sm z-30">
        <div className="h-full flex items-center justify-between px-6">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
          <div className="flex items-center space-x-2">
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <Share2 className="h-5 w-5 text-gray-600" />
            </button>
            <button
              onClick={() => setIsFavorite(!isFavorite)}
              className={`p-2 rounded-full transition-colors ${
<<<<<<< HEAD
                isFavorite ? 'bg-theme-orange/20 text-theme-orange' : 'bg-gray-100 text-gray-400'
=======
                isFavorite ? 'bg-gray-100' : 'bg-gray-100 text-gray-400'
>>>>>>> 6ebbc3f2247be4ac81bd6a39eecb98d4aba53680
              }`}
              style={isFavorite ? {backgroundColor: 'rgba(226, 176, 105, 0.1)', color: '#e2b069'} : {}}
            >
              <Heart className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Spacer for sticky header */}
      <div className="h-16"></div>

      {/* Scrollable Content */}
      <div className="h-[calc(100vh-4rem)] overflow-y-auto">
        {/* Product Image Area */}
        <div className="relative h-[50vh] bg-gray-100 mx-4 my-4 rounded-2xl overflow-hidden">
          <ImageWithSkeleton
            src={currentImage}
            alt={product.name}
            className="w-full h-full object-cover"
            placeholder={placeholderImg}
          />
          
          {/* Image Navigation Arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 shadow-lg transition-all"
              >
                <ChevronRight className="h-5 w-5 text-gray-600 rotate-180" />
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
<<<<<<< HEAD
                className="w-8 h-8 flex items-center justify-center text-theme-brown hover:bg-theme-brown/20 rounded transition-colors"
=======
                className="w-8 h-8 flex items-center justify-center rounded transition-colors"
                style={{color: '#e2b069'}}
                onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = 'rgba(226, 176, 105, 0.1)'}
                onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = 'transparent'}
>>>>>>> 6ebbc3f2247be4ac81bd6a39eecb98d4aba53680
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="w-8 h-8 flex items-center justify-center text-gray-900 font-medium">
                {quantity}
              </div>
              <button
                onClick={() => updateQuantity(quantity + 1)}
<<<<<<< HEAD
                className="w-8 h-8 flex items-center justify-center text-theme-brown hover:bg-theme-brown/20 rounded transition-colors"
=======
                className="w-8 h-8 flex items-center justify-center rounded transition-colors"
                style={{color: '#e2b069'}}
                onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = 'rgba(226, 176, 105, 0.1)'}
                onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = 'transparent'}
>>>>>>> 6ebbc3f2247be4ac81bd6a39eecb98d4aba53680
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
            </div>

            {/* Product Details */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Product Details</h3>
              
<<<<<<< HEAD
              {/* Colors */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Color</h4>
                <div className="flex space-x-2">
                  {availableColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        selectedColor === color
                          ? 'bg-theme-orange/20 text-theme-brown border-theme-brown'
                          : 'bg-gray-100 text-gray-700 border-gray-300'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sizes */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Size</h4>
                <div className="flex space-x-2">
                  {availableSizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`w-10 h-10 rounded-full text-sm font-medium border transition-colors ${
                        selectedSize === size
                          ? 'bg-theme-orange/20 text-theme-brown border-theme-brown'
                          : 'bg-gray-100 text-gray-700 border-gray-300'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
=======
              {/* Dynamic Tags */}
              {availableTags.length > 0 ? (
                availableTags.map((tag) => (
                  <div key={tag.id} className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">{tag.name}</h4>
                    <div className="flex flex-wrap gap-2">
                      {tag.variations.map((variation) => (
                        <button
                          key={variation.id}
                          onClick={() => handleVariationChange(tag.id, variation.id)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                            selectedVariations[tag.id] === variation.id
                              ? 'text-gray-700 border-gray-300'
                              : 'bg-gray-100 text-gray-700 border-gray-300'
                          }`}
                          style={selectedVariations[tag.id] === variation.id ? {backgroundColor: 'rgba(226, 176, 105, 0.1)', color: '#183524', borderColor: '#e2b069'} : {}}
                        >
                          {variation.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500 italic">
                  No variations available for this product
                </div>
              )}
>>>>>>> 6ebbc3f2247be4ac81bd6a39eecb98d4aba53680

              {/* Description */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {product.name}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Add to Cart Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 z-20 pb-safe">
        <button
          onClick={handleAddToCart}
<<<<<<< HEAD
          className="w-full bg-gradient-to-br from-theme-olive to-theme-forest text-white py-4 rounded-xl font-semibold text-lg  transition-colors shadow-lg"
=======
          className="w-full text-white py-4 rounded-xl font-semibold text-lg transition-colors shadow-lg" style={{backgroundColor: '#e2b069'}} onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#d4a05a'} onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#e2b069'}
>>>>>>> 6ebbc3f2247be4ac81bd6a39eecb98d4aba53680
        >
          Add to Cart - {((product.cataloguePrice ?? 0) * quantity).toLocaleString('fr-FR', {
            style: 'currency',
            currency: 'XAF'
          })}
        </button>
      </div>

      {/* Floating Cart Button */}
      <FloatingCartButton />
    </div>
  );
};

export default ProductDetailModal;
