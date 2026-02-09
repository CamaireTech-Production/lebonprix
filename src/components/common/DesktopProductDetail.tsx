import { useState, useEffect, useMemo } from 'react';
import { useCart } from '../../contexts/CartContext';
import { getCompanyByUserId, getSellerSettings } from '@services/firestore/firestore';
import { subscribeToProducts } from '@services/firestore/products/productService';
import type { Company, Product } from '../../types/models';
import type { SellerSettings } from '../../types/order';
import { ArrowLeft, Plus, Minus, MessageCircle, ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';
import { ImageWithSkeleton } from '@components/common';
import { formatPhoneForWhatsApp } from '@utils/core/phoneUtils';
import { useAllStockBatches } from '@hooks/business/useStockBatches';
import { buildProductStockMap, getEffectiveProductStock } from '@utils/inventory/stockHelpers';
import { useCurrency } from '@hooks/useCurrency';

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
  const { format } = useCurrency();

  // Use passed data immediately
  const [company, setCompany] = useState<Company | null>(initialCompany);
  const [product, setProduct] = useState<Product | null>(initialProduct);
  const [sellerSettings, setSellerSettings] = useState<SellerSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get stock from batches
  const { batches: allBatches } = useAllStockBatches('product');
  const stockMap = useMemo(
    () => buildProductStockMap(allBatches || []),
    [allBatches]
  );

  // Calculate product stock from batches
  const productStock = useMemo(() => {
    if (!product) return 0;
    return getEffectiveProductStock(product, stockMap);
  }, [product, stockMap]);

  // Product detail state
  const [quantity, setQuantity] = useState(1);
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Fetch fresh data in background to ensure data freshness
  useEffect(() => {
    if (!isOpen) return;

    const fetchFreshData = async () => {
      try {
        const [companyData, productsData, settingsData] = await Promise.all([
          getCompanyByUserId(companyId),
          new Promise<Product[]>((resolve) => {
            const unsubscribe = subscribeToProducts(companyId, (products) => {
              unsubscribe(); // Unsubscribe immediately after getting data
              resolve(products);
            });
          }),
          getSellerSettings(companyId)
        ]);

        const foundProduct = productsData.find(p => p.id === product?.id);
        if (foundProduct) {
          // Only update if there are actual changes
          setProduct(prev => prev?.id === foundProduct.id ? foundProduct : prev);
          setCompany(companyData);
        }

        // Load seller settings for WhatsApp number
        if (settingsData) {
          setSellerSettings(settingsData);
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

  // Preload all product images when modal opens or product changes
  useEffect(() => {
    if (isOpen && product?.images && product.images.length > 0) {
      product.images.forEach((imageUrl) => {
        if (imageUrl && typeof imageUrl === 'string') {
          const img = new Image();
          img.src = imageUrl;
        }
      });
    }
  }, [isOpen, product?.images]);

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

    const variations = Object.entries(selectedVariations)
      .filter(([_key, value]) => value) // Only include selected variations
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    const message = `Bonjour! Je voudrais commander:

*${product.name}*
${variations ? `Options: ${variations}` : ''}
Quantité: ${quantity}
Prix unitaire: ${format(product.cataloguePrice || product.sellingPrice)}
Total: ${format((product.cataloguePrice || product.sellingPrice) * quantity)}

Veuillez confirmer la disponibilité et fournir les détails de livraison.`;

    // Use seller settings WhatsApp number first, fallback to company phone
    const whatsappNumber = sellerSettings?.whatsappNumber || company.phone;

    // Use centralized WhatsApp formatting function
    const cleanPhone = formatPhoneForWhatsApp(whatsappNumber);

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const updateQuantity = (newQuantity: number) => {
    if (newQuantity >= 1) {
      setQuantity(newQuantity);
    }
  };

  // Handle image navigation
  const handlePreviousImage = () => {
    if (!product?.images || product.images.length <= 1) return;
    setCurrentImageIndex((prev) =>
      prev === 0 ? product.images!.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    if (!product?.images || product.images.length <= 1) return;
    setCurrentImageIndex((prev) =>
      prev === product.images!.length - 1 ? 0 : prev + 1
    );
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
  const stockText = productStock <= 5 ? `Only ${productStock} pieces available` : `${productStock} pieces available`;

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
            <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-white shadow-lg group">
              <ImageWithSkeleton
                src={currentImage}
                alt={product.name}
                className="w-full h-full object-cover"
              />

              {/* Previous Image Button */}
              {images.length > 1 && (
                <button
                  onClick={handlePreviousImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white bg-opacity-90 hover:bg-opacity-100 text-gray-700 hover:text-[#e2b069] rounded-full p-2 shadow-lg transition-all duration-200 hover:scale-110 opacity-0 group-hover:opacity-100 z-10"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}

              {/* Next Image Button */}
              {images.length > 1 && (
                <button
                  onClick={handleNextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white bg-opacity-90 hover:bg-opacity-100 text-gray-700 hover:text-[#e2b069] rounded-full p-2 shadow-lg transition-all duration-200 hover:scale-110 opacity-0 group-hover:opacity-100 z-10"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Image Navigation Dots */}
            {images.length > 1 && (
              <div className="flex justify-center mt-4 space-x-2">
                {images.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`w-3 h-3 rounded-full transition-all duration-200 hover:scale-110 ${index === currentImageIndex
                      ? 'bg-[#e2b069] ring-2 ring-[#e2b069] ring-offset-2 ring-offset-[#f5f5f0]'
                      : 'bg-gray-300 hover:bg-gray-400'
                      }`}
                    aria-label={`Go to image ${index + 1}`}
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
            {productStock <= 5 && (
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
              {format(product.cataloguePrice || product.sellingPrice)}
            </div>

            {/* Stock Availability */}
            <p className="text-sm text-gray-600">
              {stockText}
            </p>

            {/* Description */}
            {product.description && (
              <p className="text-gray-700 leading-relaxed">
                {product.description}
              </p>
            )}

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
                          className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${selectedVariations[tag.id] === variation.id
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
                <span>Ajouter au panier</span>
              </button>

              <button
                onClick={handleWhatsAppOrder}
                className="w-full bg-[#25D366] text-white py-4 rounded-xl font-semibold text-lg hover:bg-[#1da851] transition-colors flex items-center justify-center space-x-2"
              >
                <MessageCircle className="h-5 w-5" />
                <span>Commander via WhatsApp</span>
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default DesktopProductDetail;
