import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { getCompanyByUserId } from '../services/firestore';
import type { Company } from '../types/models';
import type { CustomerInfo, OrderData } from '../types/order';
import { ArrowLeft, MapPin, Phone, User, MessageSquare, CreditCard, Truck } from 'lucide-react';
import Button from '../components/common/Button';

const Checkout = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  useAuth();
  const { cart, getCartTotal, clearCart } = useCart();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Customer information form state
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: '',
    phone: '',
    location: '',
    deliveryInstructions: ''
  });

  // Form validation state
  const [errors, setErrors] = useState<Partial<CustomerInfo>>({});

  // Fetch company data
  useEffect(() => {
    const fetchCompany = async () => {
      if (!companyId) {
        setLoading(false);
        return;
      }

      try {
        const companyData = await getCompanyByUserId(companyId);
        setCompany(companyData);
      } catch (err) {
        console.error('Error fetching company:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCompany();
  }, [companyId]);

  // Redirect if cart is empty
  useEffect(() => {
    if (cart.length === 0 && !loading) {
      navigate(`/catalogue/${companyId}`);
    }
  }, [cart, loading, navigate, companyId]);

  // Form validation
  const validateForm = (): boolean => {
    const newErrors: Partial<CustomerInfo> = {};

    if (!customerInfo.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!customerInfo.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!isValidPhoneNumber(customerInfo.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    if (!customerInfo.location.trim()) {
      newErrors.location = 'Location is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Phone number validation (Cameroon format)
  const isValidPhoneNumber = (phone: string): boolean => {
    const cleanPhone = phone.replace(/[^\d]/g, '');
    // Cameroon phone numbers: +237 followed by 8-9 digits
    return /^237[6-9]\d{8}$/.test(cleanPhone) || /^[6-9]\d{8}$/.test(cleanPhone);
  };

  // Format phone number for display
  const formatPhoneNumber = (phone: string): string => {
    const cleanPhone = phone.replace(/[^\d]/g, '');
    if (cleanPhone.startsWith('237')) {
      return `+${cleanPhone}`;
    } else if (cleanPhone.length === 9) {
      return `+237${cleanPhone}`;
    }
    return phone;
  };

  // Handle form input changes
  const handleInputChange = (field: keyof CustomerInfo, value: string) => {
    setCustomerInfo(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Generate order ID
  const generateOrderId = (): string => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `ORD-${timestamp}-${random}`.toUpperCase();
  };

  // Calculate totals
  const subtotal = getCartTotal();
  const deliveryFee = 0; // Can be configured later
  const finalTotal = subtotal + deliveryFee;

  // Handle order submission
  const handleSubmitOrder = async () => {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      // Create order data
      const orderData: OrderData = {
        customerInfo: {
          ...customerInfo,
          phone: formatPhoneNumber(customerInfo.phone)
        },
        cartItems: cart,
        totalAmount: subtotal,
        deliveryFee,
        finalTotal,
        orderId: generateOrderId(),
        timestamp: new Date()
      };

      // Generate WhatsApp message
      const message = generateOrderMessage(orderData, company);
      
      // Create WhatsApp URL
      const whatsappUrl = createWhatsAppUrl(company?.phone || '', message);
      
      // Clear cart
      clearCart();
      
      // Redirect to WhatsApp
      window.open(whatsappUrl, '_blank');
      
      // Navigate back to catalogue
      navigate(`/catalogue/${companyId}`);
      
    } catch (error) {
      console.error('Error submitting order:', error);
      // TODO: Show error notification
    } finally {
      setSubmitting(false);
    }
  };

  // Generate order message (following documentation template)
  const generateOrderMessage = (orderData: OrderData, company: Company | null): string => {
    const { customerInfo, cartItems, totalAmount, deliveryFee, finalTotal, orderId } = orderData;
    const businessName = company?.name || 'Your Business';
    
    let message = `🛒 Commande ${businessName} #${orderId}\n\n`;
    
    // Order details
    message += `📋 Détails:\n`;
    cartItems.forEach(item => {
      const itemTotal = item.price * item.quantity;
      message += `- ${item.name} x ${item.quantity} = ${itemTotal.toLocaleString('fr-FR', {
        style: 'currency',
        currency: 'XAF'
      })}\n`;
    });
    
    message += `\n💰 Total: ${totalAmount.toLocaleString('fr-FR', {
      style: 'currency',
      currency: 'XAF'
    })}\n`;
    
    if (deliveryFee > 0) {
      message += `🚚 Frais de livraison: ${deliveryFee.toLocaleString('fr-FR', {
        style: 'currency',
        currency: 'XAF'
      })}\n`;
    }
    
    message += `💳 Total final: ${finalTotal.toLocaleString('fr-FR', {
      style: 'currency',
      currency: 'XAF'
    })}\n\n`;
    
    // Customer information
    message += `👤 Client: ${customerInfo.name}\n`;
    message += `📞 Téléphone: ${customerInfo.phone}\n`;
    message += `📍 Adresse: ${customerInfo.location}\n`;
    
    if (customerInfo.deliveryInstructions) {
      message += `📝 Instructions de livraison: ${customerInfo.deliveryInstructions}\n`;
    }
    
    message += `\n💳 Paiement:\n`;
    message += `Veuillez confirmer le mode de paiement souhaité.\n\n`;
    message += `📝 Instructions:\n`;
    message += `1. Confirmez votre commande\n`;
    message += `2. Indiquez votre mode de paiement préféré\n`;
    message += `3. Précisez l'heure de livraison souhaitée\n`;
    
    return message;
  };

  // Create WhatsApp URL
  const createWhatsAppUrl = (phone: string, message: string): string => {
    const formattedPhone = phone.replace(/[^\d]/g, '');
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (cart.length === 0) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="h-16 bg-white shadow-sm flex items-center px-4">
        <button
          onClick={() => navigate(-1)}
          className="mr-4 p-2 hover:bg-gray-100 rounded-full"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Checkout</h1>
      </div>

      <div className="p-4 space-y-6">
        {/* Order Summary */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
          <div className="space-y-3">
            {cart.map((item) => (
              <div key={`${item.productId}-${item.selectedColor || 'default'}-${item.selectedSize || 'default'}`} 
                   className="flex items-center space-x-3">
                <img
                  src={item.image || '/placeholder.png'}
                  alt={item.name}
                  className="w-12 h-12 object-cover rounded"
                />
                <div className="flex-1">
                  <h3 className="font-medium text-sm">{item.name}</h3>
                  <p className="text-xs text-gray-500">
                    {item.category}
                    {item.selectedColor && ` • ${item.selectedColor}`}
                    {item.selectedSize && ` • ${item.selectedSize}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">x{item.quantity}</p>
                  <p className="text-emerald-600 font-semibold text-sm">
                    {(item.price * item.quantity).toLocaleString('fr-FR', {
                      style: 'currency',
                      currency: 'XAF'
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          {/* Totals */}
          <div className="border-t border-gray-200 mt-4 pt-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">
                {subtotal.toLocaleString('fr-FR', {
                  style: 'currency',
                  currency: 'XAF'
                })}
              </span>
            </div>
            {deliveryFee > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Delivery Fee:</span>
                <span className="font-medium">
                  {deliveryFee.toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: 'XAF'
                  })}
                </span>
              </div>
            )}
            <div className="flex justify-between text-lg font-semibold">
              <span>Total:</span>
              <span className="text-emerald-600">
                {finalTotal.toLocaleString('fr-FR', {
                  style: 'currency',
                  currency: 'XAF'
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Customer Information Form */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h2>
          
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="inline h-4 w-4 mr-1" />
                Full Name *
              </label>
              <input
                type="text"
                value={customerInfo.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter your full name"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Phone className="inline h-4 w-4 mr-1" />
                Phone Number *
              </label>
              <input
                type="tel"
                value={customerInfo.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                  errors.phone ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="+237 6XX XXX XXX"
              />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MapPin className="inline h-4 w-4 mr-1" />
                Delivery Location *
              </label>
              <input
                type="text"
                value={customerInfo.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                  errors.location ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter your delivery address"
              />
              {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location}</p>}
            </div>

            {/* Delivery Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MessageSquare className="inline h-4 w-4 mr-1" />
                Delivery Instructions (Optional)
              </label>
              <textarea
                value={customerInfo.deliveryInstructions}
                onChange={(e) => handleInputChange('deliveryInstructions', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Any special delivery instructions..."
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Payment Information */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <CreditCard className="h-5 w-5 mr-2" />
            Payment Information
          </h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Payment will be confirmed via WhatsApp</strong>
            </p>
            <p className="text-xs text-blue-600 mt-1">
              You'll receive a WhatsApp message with payment options and delivery details.
            </p>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <Button
          onClick={handleSubmitOrder}
          disabled={submitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Processing...
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <Truck className="h-4 w-4 mr-2" />
              Send Order via WhatsApp
            </div>
          )}
        </Button>
      </div>
    </div>
  );
};

export default Checkout;
