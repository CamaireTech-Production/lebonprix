import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { getCompanyByUserId, subscribeToProducts } from '../services/firestore';
import type { Company, Product } from '../types/models';
import { ArrowLeft, Share2, Plus, Minus, ShoppingCart, Camera, QrCode } from 'lucide-react';
import FloatingCartButton from '../components/common/FloatingCartButton';
import { ImageWithSkeleton } from '../components/common/ImageWithSkeleton';
import BarcodeGenerator from '../components/products/BarcodeGenerator';
import BarcodeScanner from '../components/products/BarcodeScanner';
import Button from '../components/common/Button';
import { showSuccessToast, showErrorToast } from '../utils/toast';

const placeholderImg = '/placeholder.png';

const ProductDetailPage = () => {
  const { companyName, companyId, productId } = useParams<{ 
    companyName: string; 
    companyId: string; 
    productId: string 
  }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const action = searchParams.get('action'); // 'buy' ou 'view'
  
  const { addToCart } = useCart();
  const [company, setCompany] = useState<Company | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Product detail state
  const [quantity, setQuantity] = useState(1);
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showBarcodeGenerator, setShowBarcodeGenerator] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeMode, setBarcodeMode] = useState<'buy' | 'view'>('view');

  // Extract available colors and sizes from product variations
  const availableColors = product?.tags?.find(tag => tag.name === 'Color')?.variations?.map(v => v.name) || [];
  const availableSizes = product?.tags?.find(tag => tag.name === 'Size')?.variations?.map(v => v.name) || [];

  // Load company and product data
  useEffect(() => {
    if (!companyId || !productId) {
      setError('Paramètres manquants');
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [companyData, productsData] = await Promise.all([
          getCompanyByUserId(companyId),
          new Promise<Product[]>((resolve) => {
            const unsubscribe = subscribeToProducts(companyId, (products) => {
              unsubscribe();
              resolve(products);
            });
          })
        ]);

        const foundProduct = productsData.find(p => p.id === productId);
        
        if (!foundProduct) {
          setError('Produit non trouvé');
          setLoading(false);
          return;
        }

        setCompany(companyData);
        setProduct(foundProduct);

        // Si action=buy, ajouter automatiquement au panier
        if (action === 'buy' && foundProduct) {
          addToCart(foundProduct, 1);
          showSuccessToast('Produit ajouté au panier');
        }
      } catch (err: any) {
        console.error('Erreur lors du chargement des données:', err);
        setError(err.message || 'Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [companyId, productId, action, addToCart]);

  // Get company colors with fallbacks
  const getCompanyColors = () => {
    if (!company) {
      return {
        primary: '#183524',
        secondary: '#e2b069',
        tertiary: '#2a4a3a'
      };
    }
    return {
      primary: company.catalogueColors?.primary || company.primaryColor || '#183524',
      secondary: company.catalogueColors?.secondary || company.secondaryColor || '#e2b069',
      tertiary: company.catalogueColors?.tertiary || company.tertiaryColor || '#2a4a3a'
    };
  };

  const colors = getCompanyColors();

  const handleAddToCart = () => {
    if (!product) return;
    addToCart(product, quantity);
    showSuccessToast('Produit ajouté au panier');
  };

  const handleBuyNow = () => {
    if (!product) return;
    addToCart(product, quantity);
    navigate('/checkout');
  };

  const handleShare = async () => {
    if (!product || !companyName || !companyId) return;
    
    const url = `${window.location.origin}/catalogue/${encodeURIComponent(companyName)}/${companyId}/product/${product.id}`;
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: product.name,
          text: product.description || product.name,
          url: url
        });
      } else {
        await navigator.clipboard.writeText(url);
        showSuccessToast('Lien copié dans le presse-papiers');
      }
    } catch (err) {
      // L'utilisateur a annulé le partage
      console.log('Partage annulé');
    }
  };

  const handleProductFound = (foundProductId: string) => {
    if (companyName && companyId) {
      navigate(`/catalogue/${encodeURIComponent(companyName)}/${companyId}/product/${foundProductId}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div 
          className="animate-spin rounded-full h-12 w-12 border-b-2"
          style={{ borderColor: colors.primary }}
        />
      </div>
    );
  }

  if (error || !product || !company) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Erreur</h2>
        <p className="text-gray-600 mb-4">{error || 'Produit non trouvé'}</p>
        <Button
          onClick={() => navigate(`/catalogue/${encodeURIComponent(companyName || '')}/${companyId}`)}
          variant="primary"
        >
          Retour au catalogue
        </Button>
      </div>
    );
  }

  const images = product.images && product.images.length > 0 ? product.images : [placeholderImg];
  const displayPrice = product.cataloguePrice || product.sellingPrice;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div 
        className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: colors.primary }}
      >
        <button
          onClick={() => navigate(`/catalogue/${encodeURIComponent(companyName || '')}/${companyId}`)}
          className="text-white hover:text-gray-200 transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-white font-semibold text-lg flex-1 text-center mx-4 truncate">
          {product.name}
        </h1>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleShare}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <Share2 size={20} />
          </button>
          <button
            onClick={() => setShowBarcodeScanner(true)}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <Camera size={20} />
          </button>
        </div>
      </div>

      {/* Product Images */}
      <div className="relative bg-white">
        <div className="overflow-x-auto snap-x snap-mandatory flex" style={{ scrollbarWidth: 'none' }}>
          {images.map((image, index) => (
            <div
              key={index}
              className="w-full flex-shrink-0 snap-center"
            >
              <ImageWithSkeleton
                src={image}
                alt={`${product.name} - Image ${index + 1}`}
                className="w-full h-96 object-cover"
              />
            </div>
          ))}
        </div>
        
        {/* Image indicators */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentImageIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="bg-white px-4 py-6 space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h2>
          {product.description && (
            <p className="text-gray-600 text-sm leading-relaxed">{product.description}</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold" style={{ color: colors.primary }}>
              {displayPrice.toLocaleString('fr-FR')} FCFA
            </p>
            {product.cataloguePrice && product.cataloguePrice !== product.sellingPrice && (
              <p className="text-sm text-gray-500 line-through">
                {product.sellingPrice.toLocaleString('fr-FR')} FCFA
              </p>
            )}
          </div>
        </div>

        {/* Variations */}
        {availableColors.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Couleur</p>
            <div className="flex flex-wrap gap-2">
              {availableColors.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedVariations(prev => ({ ...prev, Color: color }))}
                  className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                    selectedVariations.Color === color
                      ? 'border-emerald-600 bg-emerald-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>
        )}

        {availableSizes.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Taille</p>
            <div className="flex flex-wrap gap-2">
              {availableSizes.map((size) => (
                <button
                  key={size}
                  onClick={() => setSelectedVariations(prev => ({ ...prev, Size: size }))}
                  className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                    selectedVariations.Size === size
                      ? 'border-emerald-600 bg-emerald-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quantity */}
        <div className="flex items-center space-x-4">
          <p className="text-sm font-medium text-gray-700">Quantité</p>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
              className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
            >
              <Minus size={16} />
            </button>
            <span className="text-lg font-semibold w-8 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(prev => prev + 1)}
              className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Stock info */}
        {product.stock !== undefined && (
          <div className="text-sm text-gray-600">
            {product.stock > 0 ? (
              <span className="text-emerald-600">En stock ({product.stock} disponibles)</span>
            ) : (
              <span className="text-red-600">Rupture de stock</span>
            )}
          </div>
        )}

        {/* Barcode section */}
        {product.barCode && (
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-700">Codes-barres et QR codes</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setBarcodeMode('view');
                    setShowBarcodeGenerator(true);
                  }}
                  className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center space-x-1"
                >
                  <QrCode size={14} />
                  <span>Voir</span>
                </button>
                <button
                  onClick={() => {
                    setBarcodeMode('buy');
                    setShowBarcodeGenerator(true);
                  }}
                  className="px-3 py-1 text-xs bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors flex items-center space-x-1"
                  style={{ backgroundColor: colors.secondary + '40' }}
                >
                  <ShoppingCart size={14} />
                  <span>Acheter</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 space-y-2">
        <Button
          onClick={handleBuyNow}
          variant="primary"
          className="w-full"
          style={{ backgroundColor: colors.primary }}
          disabled={product.stock === 0}
        >
          Acheter maintenant
        </Button>
        <Button
          onClick={handleAddToCart}
          variant="outline"
          className="w-full flex items-center justify-center space-x-2"
          disabled={product.stock === 0}
        >
          <ShoppingCart size={18} />
          <span>Ajouter au panier</span>
        </Button>
      </div>

      {/* Floating Cart Button */}
      <FloatingCartButton />

      {/* Barcode Generator Modal */}
      {showBarcodeGenerator && companyName && companyId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {barcodeMode === 'buy' ? 'QR Code pour achat direct' : 'Codes-barres et QR codes'}
              </h3>
              <button
                onClick={() => setShowBarcodeGenerator(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft size={24} />
              </button>
            </div>
            <div className="p-4">
              <BarcodeGenerator
                product={product}
                companyName={companyName}
                companyId={companyId}
                mode={barcodeMode}
              />
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showBarcodeScanner && companyName && companyId && (
        <BarcodeScanner
          isOpen={showBarcodeScanner}
          onClose={() => setShowBarcodeScanner(false)}
          companyName={companyName}
          companyId={companyId}
          onProductFound={handleProductFound}
        />
      )}

      {/* Spacer for fixed buttons */}
      <div className="h-32" />
    </div>
  );
};

export default ProductDetailPage;

