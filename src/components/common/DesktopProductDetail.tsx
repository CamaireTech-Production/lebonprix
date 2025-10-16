import { useState, useEffect } from 'react';
import { useCart } from '../../contexts/CartContext';
import { getCompanyByUserId, subscribeToProducts } from '../../services/firestore';
import type { Company, Product } from '../../types/models';
import { ArrowLeft, Heart, Plus, Minus, MessageCircle, ShoppingCart } from 'lucide-react';
import { ImageWithSkeleton } from './ImageWithSkeleton';

const placeholderImg = '/placeholder.png';

interface DesktopProductDetailProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  company: Company;
  companyId: string;
}

const DesktopProductDetail: React.FC<DesktopProductDetailProps> = ({
  isOpen,
  onClose,
  product: initialProduct,
  company: initialCompany,
  companyId
}) => {
  const { addToCart } = useCart();
  
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

  const handleWhatsAppOrder = () => {
    if (!product || !company) return;
    
    const selectedColor = selectedVariations['Color'] || '';
    const selectedSize = selectedVariations['Size'] || '';
    const variations = Object.entries(selectedVariations)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    
    const message = `Hello! I would like to order:

*${product.name}*
${variations ? `Variations: ${variations}` : ''}
Quantity: ${quantity}
Price: ${(product.cataloguePrice || product.sellingPrice).toLocaleString('fr-FR', {
  style: 'currency',
  currency: 'XAF'
})}

Please confirm availability and provide delivery details.`;

    // Clean phone number - remove all non-digits and ensure it starts with country code
    let cleanPhone = company.phone.replace(/\D/g, '');
    
    // If phone doesn't start with country code, assume it's Cameroon (+237)
    if (!cleanPhone.startsWith('237') && !cleanPhone.startsWith('+237')) {
      // Remove leading zeros and add Cameroon country code
      cleanPhone = cleanPhone.replace(/^0+/, '');
      cleanPhone = '237' + cleanPhone;
    }

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const updateQuantity = (newQuantity: number) => {
    if (newQuantity >= 1) {
      setQuantity(newQuantity);
    }
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
      if (variation?.imageIndex !== undefined && variation.imageIndex < (product.images?.length || 0)) {
        setCurrentImageIndex(variation.imageIndex);
      }
    }
  };

  if (!isOpen || !product) return null;

  const images = product.images ?? [];
  const currentImage = images.length > 0 ? images[currentImageIndex] : placeholderImg;
  const availableTags = product.tags || [];
  const stockText = product.stock <= 5 ? `Only ${product.stock} pieces available` : `${product.stock} pieces available`;

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-hidden animate-in fade-in duration-300">
      {/* Header */}
      <div className="h-16 bg-[#f5f5f0] border-b border-gray-200 flex items-center px-6">
        <button
          onClick={onClose}
          className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium">Back to Collection</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left Side - Product Image */}
        <div className="w-3/5 bg-[#f5f5f0] flex items-center justify-center p-8">
          <div className="relative w-full max-w-lg">
            <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-white shadow-lg">
              <ImageWithSkeleton
                src={currentImage}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Image Navigation Dots */}
            {images.length > 1 && (
              <div className="flex justify-center mt-4 space-x-2">
                {images.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentImageIndex ? 'bg-[#e2b069]' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Product Information */}
        <div className="w-2/5 bg-[#f5f5f0] p-8 flex flex-col justify-between">
          <div className="space-y-6">
            {/* Limited Edition Tag */}
            {product.stock <= 5 && (
              <div className="inline-block">
                <span className="bg-[#e2b069] text-[#183524] px-3 py-1 rounded-full text-xs font-medium">
                  Limited Edition
                </span>
              </div>
            )}

            {/* Product Name */}
            <h1 className="text-3xl font-serif text-[#183524] leading-tight">
              {product.name}
            </h1>

            {/* Price */}
            <div className="text-2xl font-semibold text-[#e2b069]">
              {(product.cataloguePrice || product.sellingPrice).toLocaleString('fr-FR', {
                style: 'currency',
                currency: 'XAF'
              })}
            </div>

            {/* Stock Availability */}
            <p className="text-sm text-gray-600">
              {stockText}
            </p>

            {/* Description */}
            <p className="text-gray-700 leading-relaxed">
              {product.description || "Pure sophistication meets cultural pride. This piece is for the woman who knows her worth."}
            </p>

            {/* Product Tags/Variations */}
            {availableTags.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-[#183524]">Details</h3>
                {availableTags.map((tag) => (
                  <div key={tag.id} className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-700">{tag.name}</h4>
                    <div className="flex flex-wrap gap-2">
                      {tag.variations.map((variation) => (
                        <button
                          key={variation.id}
                          onClick={() => handleVariationChange(tag.id, variation.id)}
                          className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                            selectedVariations[tag.id] === variation.id
                              ? 'bg-[#e2b069] text-[#183524] border-[#e2b069]'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-[#e2b069]'
                          }`}
                        >
                          {variation.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Product Features */}
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-[#183524]">Features</h3>
              <ul className="space-y-1 text-sm text-gray-700">
                <li>• Refined silhouette</li>
                <li>• Premium construction</li>
                <li>• Exclusive design</li>
                <li>• Limited availability</li>
              </ul>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="space-y-4">
            {/* Quantity Selector */}
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700">Quantity:</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => updateQuantity(quantity - 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 hover:border-[#e2b069] transition-colors"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center font-medium">{quantity}</span>
                <button
                  onClick={() => updateQuantity(quantity + 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 hover:border-[#e2b069] transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleAddToCart}
                className="w-full bg-[#183524] text-white py-4 rounded-xl font-semibold text-lg hover:bg-[#0f2418] transition-colors flex items-center justify-center space-x-2"
              >
                <ShoppingCart className="h-5 w-5" />
                <span>Add to Cart</span>
              </button>
              
              <button
                onClick={handleWhatsAppOrder}
                className="w-full bg-[#25D366] text-white py-4 rounded-xl font-semibold text-lg hover:bg-[#1da851] transition-colors flex items-center justify-center space-x-2"
              >
                <MessageCircle className="h-5 w-5" />
                <span>Order via WhatsApp</span>
              </button>
            </div>

            {/* Shipping Info */}
            <p className="text-xs text-gray-500 text-center">
              Worldwide shipping available • No refunds
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesktopProductDetail;
