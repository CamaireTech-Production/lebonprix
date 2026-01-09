import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ShoppingBag, X, Plus, Minus, CheckCircle2 } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const placeholderImg = '/placeholder.png';

interface FloatingCartButtonProps {
  className?: string;
}

const FloatingCartButton: React.FC<FloatingCartButtonProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ companyId?: string }>();
  const { cart, updateCartItem, getCartItemCount, getCartTotal, currentCompanyId } = useCart();
  const { company } = useAuth();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showAddedAnimation, setShowAddedAnimation] = useState(false);

  // Get company colors with fallbacks
  const getCompanyColors = () => {
    const colors = {
      primary: company?.catalogueColors?.primary || company?.primaryColor || '#183524',
      secondary: company?.catalogueColors?.secondary || company?.secondaryColor || '#e2b069',
      tertiary: company?.catalogueColors?.tertiary || company?.tertiaryColor || '#2a4a3a',
    };
    return colors;
  };

  const handleUpdateQuantity = (productId: string, newQuantity: number, selectedColor?: string, selectedSize?: string) => {
    updateCartItem(productId, newQuantity, selectedColor, selectedSize);
  };

      // Listen for cart item added events
  useEffect(() => {
    const handleCartItemAdded = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { product, isUpdate } = customEvent.detail;
      
      // Show success animation on the button
      setShowAddedAnimation(true);
      setTimeout(() => setShowAddedAnimation(false), 1000);
      
      // Show toast notification
      const message = isUpdate 
        ? `${product.name} mis à jour dans le panier` 
        : `${product.name} ajouté au panier`;
      
      toast.success(message, {
        duration: 2000,
        icon: '🛒',
        style: {
          background: getCompanyColors().primary,
          color: '#fff',
        },
      });
      
      // Auto-open cart drawer on mobile and tablet (always for better UX)
      setIsCartOpen(true);
      
      // Optional: Auto-close after 5 seconds on mobile to not block the view
      // User can still scroll through cart or close it manually
      // Commented out to let user control when to close
      // setTimeout(() => {
      //   if (window.innerWidth < 768) {
      //     setIsCartOpen(false);
      //   }
      // }, 5000);
    };

    window.addEventListener('cart:itemAdded', handleCartItemAdded);
    return () => window.removeEventListener('cart:itemAdded', handleCartItemAdded);
  }, [company]);

  return (
    <>
      {/* Floating Cart Button */}
      <div className={`fixed bottom-20 right-4 z-40 ${className}`}>
        <button
          onClick={() => setIsCartOpen(true)}
          className={`relative text-white p-4 rounded-full shadow-lg transition-all duration-200 hover:scale-105 ${
            showAddedAnimation ? 'animate-bounce scale-110' : ''
          }`}
          style={{backgroundColor: getCompanyColors().secondary}}
          onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = getCompanyColors().primary}
          onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = getCompanyColors().secondary}
        >
          <ShoppingBag className="h-6 w-6" />
          {getCartItemCount() > 0 && (
            <div className={`absolute -top-2 -right-2 bg-theme-brown text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-semibold ${
              showAddedAnimation ? 'animate-pulse' : ''
            }`}>
              {getCartItemCount()}
            </div>
          )}
          {showAddedAnimation && (
            <div className="absolute -top-1 -right-1">
              <CheckCircle2 className="h-5 w-5 text-green-500 bg-white rounded-full" />
            </div>
          )}
        </button>
      </div>

      {/* Cart Modal */}
      {isCartOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end animate-fadeIn"
          onClick={() => setIsCartOpen(false)}
        >
          <div 
            className="bg-white w-full max-h-[90vh] rounded-t-lg flex flex-col animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cart Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg font-semibold" style={{color: getCompanyColors().primary}}>
                Panier ({getCartItemCount()})
              </h3>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1 transition-colors"
                style={{color: getCompanyColors().primary}}
                onMouseEnter={(e) => (e.target as HTMLButtonElement).style.color = getCompanyColors().secondary}
                onMouseLeave={(e) => (e.target as HTMLButtonElement).style.color = getCompanyColors().primary}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Cart Content - Scrollable */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-500 text-lg">Votre panier est vide</p>
                  <p className="text-gray-400 text-sm mt-2">Ajoutez des produits pour commencer</p>
                </div>
              ) : (
                <div className="p-4 space-y-4 pb-4">
                  {cart.map((item) => (
                    <div key={`${item.productId}-${item.selectedColor || 'default'}-${item.selectedSize || 'default'}`} 
                         className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      {/* Product Image */}
                      <img
                        src={item.image || placeholderImg}
                        alt={item.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                      
                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate" style={{color: getCompanyColors().primary}}>
                          {item.name}
                        </h4>
                        <p className="text-xs" style={{color: getCompanyColors().tertiary}}>
                          {item.category}
                          {item.selectedColor && ` • ${item.selectedColor}`}
                          {item.selectedSize && ` • ${item.selectedSize}`}
                        </p>
                        <p className="font-semibold text-sm" style={{color: getCompanyColors().secondary}}>
                          {(item.price * item.quantity).toLocaleString('fr-FR', {
                            style: 'currency',
                            currency: 'XAF'
                          })}
                        </p>
                      </div>
                      
                      {/* Quantity Controls */}
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1, item.selectedColor, item.selectedSize)}
                          className="w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                          style={{backgroundColor: `${getCompanyColors().primary}20`}}
                          onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = `${getCompanyColors().primary}40`}
                          onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = `${getCompanyColors().primary}20`}
                        >
                          <Minus className="h-3 w-3" style={{color: getCompanyColors().primary}} />
                        </button>
                        <span className="w-8 text-center text-sm font-medium" style={{color: getCompanyColors().primary}}>{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1, item.selectedColor, item.selectedSize)}
                          className="w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                          style={{backgroundColor: `${getCompanyColors().primary}20`}}
                          onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = `${getCompanyColors().primary}40`}
                          onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = `${getCompanyColors().primary}20`}
                        >
                          <Plus className="h-3 w-3" style={{color: getCompanyColors().primary}} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cart Footer - Always visible */}
            {cart.length > 0 && (
              <div className="border-t border-gray-200 p-4 flex-shrink-0">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-semibold" style={{color: getCompanyColors().primary}}>Total :</span>
                  <span className="font-bold text-lg" style={{color: getCompanyColors().secondary}}>
                    {getCartTotal().toLocaleString('fr-FR', {
                      style: 'currency',
                      currency: 'XAF'
                    })}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setIsCartOpen(false);
                    
                    // Try multiple sources for companyId:
                    // 1. From cart context (set when items are added to cart)
                    // 2. From auth context (if user is logged in)
                    // 3. From URL params (if on catalogue page)
                    // 4. Parse from URL pathname as fallback
                    let companyIdToUse = currentCompanyId || company?.id || params.companyId;
                    
                    // If still not found, try to extract from URL pathname
                    if (!companyIdToUse && location.pathname) {
                      // Pattern: /catalogue/:companyName/:companyId
                      const catalogueMatch = location.pathname.match(/\/catalogue\/[^/]+\/([^/]+)/);
                      if (catalogueMatch && catalogueMatch[1]) {
                        companyIdToUse = catalogueMatch[1];
                      }
                    }
                    
                    if (companyIdToUse) {
                      navigate(`/checkout/${companyIdToUse}`);
                    } else {
                      toast.error('Unable to determine company. Please add items to cart from catalogue.');
                    }
                  }}
                  className="w-full text-white py-3 rounded-lg font-semibold transition-colors"
                  style={{backgroundColor: getCompanyColors().primary}}
                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = getCompanyColors().secondary}
                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = getCompanyColors().primary}
                >
                  Passer la commande
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </>
  );
};

export default FloatingCartButton;
