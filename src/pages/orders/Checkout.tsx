import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { useCart } from '@contexts/CartContext';
import { getCompanyByUserId } from '@services/firestore/firestore';
import { createOrder } from '@services/firestore/orders/orderService';
import { getCurrentEmployeeRef } from '@utils/business/employeeUtils';
import { getUserById } from '@services/utilities/userService';
import { formatPrice } from '@utils/formatting/formatPrice';
import type { Company } from '@types/models';
import type { CustomerInfo, OrderData, OrderPaymentMethod, OrderPricing, DeliveryInfo, Order } from '@types/order';
import { ArrowLeft, MapPin, Phone, User, MessageSquare, CreditCard, Truck, CheckCircle, Clock } from 'lucide-react';
import { Button, ImageWithSkeleton } from '@components/common';
import toast from 'react-hot-toast';
import { formatPhoneForWhatsApp } from '@utils/core/phoneUtils';

const Checkout = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { user, company, currentEmployee, isOwner } = useAuth();
  const { cart, getCartTotal, clearCart } = useCart();
  const [companyData, setCompanyData] = useState<Company | null>(null);
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

  // Payment method selection state
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<OrderPaymentMethod | null>(null);
  const [showPaymentSelection, setShowPaymentSelection] = useState(false);
  const [orderCreated, setOrderCreated] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  // Fetch company data
  useEffect(() => {
    const fetchCompany = async () => {
      if (!companyId) {
        setLoading(false);
        return;
      }

      try {
        const fetchedCompany = await getCompanyByUserId(companyId);
        setCompanyData(fetchedCompany);
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


  // Calculate totals
  const subtotal = getCartTotal();
  const deliveryFee = 0; // Can be configured later
  const finalTotal = subtotal + deliveryFee;

  // Handle customer info submission
  const handleSubmitCustomerInfo = () => {
    if (!validateForm()) {
      return;
    }
    setShowPaymentSelection(true);
  };

  // Handle payment method selection
  const handlePaymentMethodSelect = (method: OrderPaymentMethod) => {
    setSelectedPaymentMethod(method);
    handleCreateOrder(method);
  };

  // Create order based on selected payment method
  const handleCreateOrder = async (paymentMethod: OrderPaymentMethod) => {
    if (!companyId) {
      toast.error('Company ID not found');
      return;
    }

    setSubmitting(true);

    try {
      // Create pricing object
      const pricing: OrderPricing = {
        subtotal,
        deliveryFee,
        total: finalTotal
      };

      // Create delivery info
      const deliveryInfo: DeliveryInfo = {
        method: 'pickup',
        instructions: customerInfo.deliveryInstructions
      };

      // Get createdBy employee reference
      let createdBy = null;
      if (user && company) {
        let userData = null;
        if (isOwner && !currentEmployee) {
          // If owner, fetch user data to create EmployeeRef
          try {
            userData = await getUserById(user.uid);
          } catch (error) {
            console.error('Error fetching user data for createdBy:', error);
          }
        }
        createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
      }

      // Create order in database
      const order = await createOrder(
        companyId,
        {
          customerInfo: {
            ...customerInfo,
            phone: formatPhoneNumber(customerInfo.phone)
          },
          cartItems: cart,
          pricing,
          paymentMethod,
          deliveryInfo,
          metadata: {
            source: 'catalogue',
            deviceInfo: {
              type: 'desktop',
              os: navigator.platform,
              browser: navigator.userAgent
            },
            createdBy: createdBy || undefined
          }
        }
      );

      setCreatedOrder(order);
      setOrderCreated(true);

      // Handle based on payment method
      if (paymentMethod === 'onsite') {
        // Send WhatsApp confirmation for onsite payment
        const orderData: OrderData = {
          customerInfo: {
            ...customerInfo,
            phone: formatPhoneNumber(customerInfo.phone)
          },
          cartItems: cart,
          totalAmount: subtotal,
          deliveryFee,
          finalTotal,
          orderId: order.orderId,
          timestamp: new Date()
        };

        const message = generateOrderMessage(orderData, companyData, order.orderNumber);
        const whatsappUrl = createWhatsAppUrl(companyData?.phone || '', message);
        
        // Clear cart
        clearCart();
        
        // Open WhatsApp
        window.open(whatsappUrl, '_blank');
        
        toast.success('Order created! WhatsApp confirmation sent.');
      } else if (paymentMethod === 'online') {
        // Show "payment pending" message for online payment
        toast.success('Order created! Online payment integration coming soon.');
      }

    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Failed to create order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };


  // Generate order message (following documentation template)
  const generateOrderMessage = (orderData: OrderData, company: Company | null, orderNumber?: string): string => {
    const { customerInfo, cartItems, totalAmount, deliveryFee, finalTotal, orderId } = orderData;
    const businessName = company?.name || 'Your Business';
    const orderRef = orderNumber || orderId;
    
    let message = `🛒 Commande ${businessName} #${orderRef}\n\n`;
    
    // Order details
    message += `📋 Détails:\n`;
    cartItems.forEach(item => {
      const itemTotal = item.price * item.quantity;
      message += `- ${item.name} x ${item.quantity} = ${formatPrice(itemTotal)} XAF\n`;
    });
    
    message += `\n💰 Total: ${formatPrice(totalAmount)} XAF\n`;
    
    if ((deliveryFee || 0) > 0) {
      message += `🚚 Frais de livraison: ${formatPrice(deliveryFee || 0)} XAF\n`;
    }
    
    message += `💳 Total final: ${formatPrice(finalTotal || 0)} XAF\n\n`;
    
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
    const formattedPhone = formatPhoneForWhatsApp(phone);
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
                <ImageWithSkeleton
                  src={item.image || '/placeholder.png'}
                  alt={item.name}
                  className="w-12 h-12 object-cover rounded"
                  placeholder="/placeholder.png"
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
                    {formatPrice(item.price * item.quantity)} XAF
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
                {formatPrice(subtotal)} XAF
              </span>
            </div>
            {deliveryFee > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Delivery Fee:</span>
                <span className="font-medium">
                  {formatPrice(deliveryFee)} XAF
                </span>
              </div>
            )}
            <div className="flex justify-between text-lg font-semibold">
              <span>Total:</span>
              <span className="text-emerald-600">
                {formatPrice(finalTotal)} XAF
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

        {/* Payment Method Selection */}
        {showPaymentSelection && !orderCreated && (
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <CreditCard className="h-5 w-5 mr-2" />
              Choose Payment Method
            </h2>
            
            <div className="space-y-3">
              {/* Onsite Payment Option */}
              <button
                onClick={() => handlePaymentMethodSelect('onsite')}
                disabled={submitting}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-emerald-100 rounded-full">
                    <Truck className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">Pay at Pickup</h3>
                    <p className="text-sm text-gray-600">Pay when you collect your order</p>
                  </div>
                  <CheckCircle className="h-5 w-5 text-emerald-600 ml-auto" />
                </div>
              </button>

              {/* Online Payment Option */}
              <button
                onClick={() => handlePaymentMethodSelect('online')}
                disabled={submitting}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">Pay Online</h3>
                    <p className="text-sm text-gray-600">Secure online payment (Coming Soon)</p>
                  </div>
                  <Clock className="h-5 w-5 text-blue-600 ml-auto" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Order Success */}
        {orderCreated && createdOrder && (
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100 mb-4">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Order Created Successfully!</h2>
              <p className="text-sm text-gray-600 mb-4">
                Order Number: <span className="font-mono font-semibold">{createdOrder.orderNumber}</span>
              </p>
              
              {selectedPaymentMethod === 'onsite' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-emerald-800">
                    <strong>WhatsApp confirmation sent!</strong>
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    Please check your WhatsApp for pickup instructions and payment details.
                  </p>
                </div>
              )}
              
              {selectedPaymentMethod === 'online' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-blue-800">
                    <strong>Online payment integration coming soon!</strong>
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Your order is saved and will be processed when online payment is available.
                  </p>
                </div>
              )}
              
              <Button
                onClick={() => navigate(`/catalogue/${companyId}`)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-semibold"
              >
                Continue Shopping
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Submit Button - Only show if not in payment selection or order created */}
      {!showPaymentSelection && !orderCreated && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-safe">
          <Button
            onClick={handleSubmitCustomerInfo}
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
                <CreditCard className="h-4 w-4 mr-2" />
                Choose Payment Method
              </div>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default Checkout;
