import React, { useState, useEffect } from 'react';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { getCompanyByUserId, getSellerSettings } from '@services/firestore/firestore';
import { createOrder } from '@services/firestore/orders/orderService';
// NOTE: ensureCustomerExists is NOT imported here - customers are created only when order is converted to sale
import { logError } from '@utils/core/logger';
import { formatPrice } from '@utils/formatting/formatPrice';
import type { Company } from '../../types/models';
import type { CustomerInfo, OrderData, SellerSettings, OrderPaymentMethod, OrderPricing, DeliveryInfo, Order } from '../../types/order';
import { X, ArrowLeft, ArrowRight, ShoppingBag, User, MapPin, Phone, MessageSquare, CreditCard, Truck, CheckCircle, Clock } from 'lucide-react';
import { PhoneInput } from '@components/common';
import toast from 'react-hot-toast';
import { formatPhoneForWhatsApp } from '@utils/core/phoneUtils';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, companyId }) => {
  const { cart, getCartTotal, clearCart } = useCart();
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [sellerSettings, setSellerSettings] = useState<SellerSettings | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Customer information form state
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    // Contact info
    name: '',
    phone: '',
    quarter: '',
    email: '',
    // Delivery info
    deliveryName: '',
    deliveryPhone: '',
    deliveryAddressLine1: '',
    deliveryAddressLine2: '',
    deliveryQuarter: '',
    deliveryCity: '',
    deliveryInstructions: '',
    deliveryCountry: 'CM'
  });

  // Form validation state
  const [errors, setErrors] = useState<Partial<CustomerInfo>>({});

  // Payment method selection state
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<OrderPaymentMethod | null>(null);
  const [orderCreated, setOrderCreated] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  // Fetch company data and seller settings
  useEffect(() => {
    const fetchData = async () => {
      if (!companyId) return;
      try {
        const [companyData, settings] = await Promise.all([
          getCompanyByUserId(companyId),
          getSellerSettings(companyId)
        ]);
        setCompany(companyData);
        setSellerSettings(settings);
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };

    if (isOpen) {
      fetchData();
    }
  }, [companyId, isOpen]);

  // Reset modal state when opening
  useEffect(() => {
    console.log('Modal useEffect triggered, isOpen:', isOpen);
    if (isOpen) {
      console.log('Resetting form data');
      setCurrentStep(1);
      setCustomerInfo({
        // Contact info
        name: '',
        phone: '',
        quarter: '',
        email: '',
        // Delivery info
        deliveryName: '',
        deliveryPhone: '',
        deliveryAddressLine1: '',
        deliveryAddressLine2: '',
        deliveryQuarter: '',
        deliveryCity: '',
        deliveryInstructions: '',
        deliveryCountry: 'CM'
      });
      setErrors({});
    }
  }, [isOpen]);

  // Form validation
  const validateForm = (): boolean => {
    console.log('validateForm called with customerInfo:', customerInfo);
    const newErrors: Partial<CustomerInfo> = {};

    // Contact info validation
    if (!customerInfo.name.trim()) {
      console.log('Name validation failed');
      newErrors.name = 'Name is required';
    }

    if (!customerInfo.phone.trim()) {
      console.log('Phone validation failed - empty');
      newErrors.phone = 'Phone number is required';
    } else if (!isValidPhoneNumber(customerInfo.phone)) {
      console.log('Phone validation failed - invalid format');
      newErrors.phone = 'Please enter a valid phone number';
    }

    // Delivery info validation
    if (!(customerInfo.deliveryName || customerInfo.name)?.trim()) {
      newErrors.deliveryName = 'Delivery name is required';
    }

    if (!(customerInfo.deliveryPhone || customerInfo.phone)?.trim()) {
      newErrors.deliveryPhone = 'Delivery phone is required';
    }

    if (!customerInfo.deliveryAddressLine1?.trim()) {
      console.log('Delivery address validation failed');
      newErrors.deliveryAddressLine1 = 'Delivery address is required';
    }

    if (!customerInfo.deliveryQuarter?.trim()) {
      console.log('Delivery quarter validation failed');
      newErrors.deliveryQuarter = 'Delivery quarter/zone is required';
    }

    console.log('Validation errors:', newErrors);
    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    console.log('Form is valid:', isValid);
    return isValid;
  };

  // Phone number validation (supports multiple countries)
  const isValidPhoneNumber = (phone: string): boolean => {
    console.log('Validating phone number:', phone);
    
    if (!phone || phone.trim() === '') {
      console.log('Phone is empty');
      return false;
    }
    
    const cleanPhone = phone.replace(/[^\d]/g, '');
    console.log('Clean phone:', cleanPhone, 'Length:', cleanPhone.length);
    
    // Check if it's a valid international format (country code + number)
    if (cleanPhone.length >= 10 && cleanPhone.length <= 15) {
      // Additional validation: should start with a valid country code
      const validCountryCodes = ['1', '7', '20', '27', '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44', '45', '46', '47', '48', '49', '51', '52', '53', '54', '55', '56', '57', '58', '60', '61', '62', '63', '64', '65', '66', '81', '82', '84', '86', '90', '91', '92', '93', '94', '95', '98', '212', '213', '216', '218', '220', '221', '222', '223', '224', '225', '226', '227', '228', '229', '230', '231', '232', '233', '234', '235', '236', '237', '238', '239', '240', '241', '242', '243', '244', '245', '246', '248', '249', '250', '251', '252', '253', '254', '255', '256', '257', '258', '260', '261', '262', '263', '264', '265', '266', '267', '268', '269', '290', '291', '297', '298', '299', '350', '351', '352', '353', '354', '355', '356', '357', '358', '359', '370', '371', '372', '373', '374', '375', '376', '377', '378', '380', '381', '382', '383', '385', '386', '387', '389', '420', '421', '423', '500', '501', '502', '503', '504', '505', '506', '507', '508', '509', '590', '591', '592', '593', '594', '595', '596', '597', '598', '599', '670', '672', '673', '674', '675', '676', '677', '678', '679', '680', '681', '682', '683', '684', '685', '686', '687', '688', '689', '690', '691', '692', '850', '852', '853', '855', '856', '880', '886', '960', '961', '962', '963', '964', '965', '966', '967', '968', '970', '971', '972', '973', '974', '975', '976', '977', '992', '993', '994', '995', '996', '998'];
      
      // Check if the phone number starts with a valid country code
      for (const countryCode of validCountryCodes) {
        if (cleanPhone.startsWith(countryCode)) {
          console.log('Valid phone number with country code:', countryCode);
          return true;
        }
      }
      console.log('No valid country code found');
    } else {
      console.log('Invalid length:', cleanPhone.length);
    }
    
    console.log('Phone validation failed');
    return false;
  };

  // Format phone number for display (already formatted by PhoneInput)
  const formatPhoneNumber = (phone: string): string => {
    // PhoneInput already provides properly formatted phone numbers
    return phone;
  };

  // Handle form input changes
  const handleInputChange = (field: keyof CustomerInfo, value: string) => {
    console.log('handleInputChange called:', { field, value, currentCustomerInfo: customerInfo });
    setCustomerInfo(prev => {
      const newInfo = { ...prev, [field]: value };
      console.log('Updated customerInfo:', newInfo);
      return newInfo;
    });
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };


  // Calculate totals
  const subtotal = getCartTotal();
  const deliveryFee = 0;
  const finalTotal = subtotal + deliveryFee;

  // Handle step navigation
  const handleNextStep = () => {
    console.log('handleNextStep called, currentStep:', currentStep);
    if (currentStep === 1) {
      // Step 1: Review Order -> Move to Customer Info (no validation needed)
      console.log('Moving from Review Order to Customer Info');
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // Step 2: Customer Info -> Validate and move to Payment Selection
      console.log('Validating customer info form...');
      const isValid = validateForm();
      console.log('Form validation result:', isValid);
      if (isValid) {
        console.log('Moving to payment selection');
        setCurrentStep(3);
      } else {
        console.log('Form validation failed, errors:', errors);
      }
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
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
        deliveryFee: sellerSettings?.deliveryFee || 0,
        total: finalTotal
      };

      // Create delivery info with new structure
      const deliveryInfo: DeliveryInfo = {
        method: 'delivery',
        address: customerInfo.deliveryAddressLine1 + (customerInfo.deliveryAddressLine2 ? ', ' + customerInfo.deliveryAddressLine2 : ''),
        instructions: customerInfo.deliveryInstructions
      };

      // NOTE: Customer is NOT created here - it will be created only when order is converted to sale
      // This ensures we don't create duplicate customers for orders that may never be converted

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
            }
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
          deliveryFee: sellerSettings?.deliveryFee || 0,
          finalTotal,
          orderId: order.orderId,
          timestamp: new Date()
        };

        const message = generateOrderMessage(orderData, company, sellerSettings, order.orderNumber);
        const whatsappUrl = createWhatsAppUrl(company?.phone || sellerSettings?.whatsappNumber || '', message);
        
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


  // Generate order message
  const generateOrderMessage = (orderData: OrderData, company: Company | null, settings: SellerSettings | null, orderNumber?: string): string => {
    const { customerInfo, cartItems, totalAmount, deliveryFee, finalTotal, orderId } = orderData;
    const businessName = company?.name || settings?.businessName || 'Your Business';
    const orderRef = orderNumber || orderId;
    const currency = settings?.currency || 'XAF';
    
    let message = `🛒 Commande ${businessName} #${orderRef}\n\n`;
    
    message += `📋 Détails:\n`;
    cartItems.forEach(item => {
      const itemTotal = item.price * item.quantity;
      message += `- ${item.name} x ${item.quantity} = ${formatPrice(itemTotal)} ${currency}\n`;
    });
    
    message += `\n💰 Total: ${formatPrice(totalAmount)} ${currency}\n`;
    
    if ((deliveryFee || 0) > 0) {
      message += `🚚 Frais de livraison: ${formatPrice(deliveryFee || 0)} ${currency}\n`;
    }
    
    message += `💳 Total final: ${formatPrice(finalTotal)} ${currency}\n\n`;
    
    message += `👤 Client: ${customerInfo.name}\n`;
    message += `📞 Téléphone: ${customerInfo.phone}\n`;
    message += `📍 Adresse: ${customerInfo.deliveryAddressLine1 || ''}${customerInfo.deliveryAddressLine2 ? ', ' + customerInfo.deliveryAddressLine2 : ''}\n`;
    message += `📍 Quartier: ${customerInfo.deliveryQuarter || ''}\n`;
    
    if (customerInfo.deliveryInstructions) {
      message += `📝 Instructions de livraison: ${customerInfo.deliveryInstructions}\n`;
    }
    
    message += `\n💳 Modes de paiement disponibles:\n`;
    
    // Add standard payment methods
    if (settings?.paymentMethods?.mobileMoney) {
      message += `📱 Mobile Money\n`;
    }
    if (settings?.paymentMethods?.bankTransfer) {
      message += `🏦 Virement bancaire\n`;
    }
    if (settings?.paymentMethods?.cashOnDelivery) {
      message += `💵 Paiement à la livraison\n`;
    }
    
    // Add custom payment methods
    if (settings?.paymentMethods?.customMethods) {
      settings.paymentMethods.customMethods
        .filter(method => method.isActive)
        .forEach(method => {
          const icon = method.type === 'phone' ? '📞' : 
                      method.type === 'ussd' ? '🔢' : '🔗';
          message += `${icon} ${method.name}: ${method.value}\n`;
        });
    }
    
    message += `\n📝 Instructions:\n`;
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            {currentStep > 1 && (
              <button
                onClick={handlePrevStep}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {currentStep === 1 ? 'Review Your Order' : currentStep === 2 ? 'Delivery Information' : 'Choose Payment Method'}
              </h2>
              <p className="text-sm text-gray-500">
                Step {currentStep} of 3
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-4 py-2">
          <div className="flex space-x-2">
            <div className={`flex-1 h-2 rounded-full ${currentStep >= 1 ? 'bg-theme-beige' : 'bg-gray-200'}`} />
            <div className={`flex-1 h-2 rounded-full ${currentStep >= 2 ? 'bg-theme-beige' : 'bg-gray-200'}`} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 pb-2">
          {currentStep === 1 ? (
            // Step 1: Cart Review
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-theme-brown">
                <ShoppingBag className="h-5 w-5" />
                <span className="font-medium">Order  Summary</span>
              </div>
              
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={`${item.productId}-${item.selectedColor || 'default'}-${item.selectedSize || 'default'}`} 
                       className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <img
                      src={item.image || '/placeholder.png'}
                      alt={item.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                    <div className="flex-1">
                      <h3 className="font-medium text-theme-brown text-sm">{item.name}</h3>
                      <p className="text-xs text-gray-500">
                        {item.category}
                        {item.selectedColor && ` • ${item.selectedColor}`}
                        {item.selectedSize && ` • ${item.selectedSize}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">x{item.quantity}</p>
                      <p className="text-theme-brown font-semibold text-sm">
                        {formatPrice(item.price * item.quantity)} XAF
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Totals */}
              <div className="border-t border-gray-200 pt-4 space-y-2">
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
                  <span className="text-theme-brown">
                    {formatPrice(finalTotal)} XAF
                  </span>
                </div>
              </div>
            </div>
          ) : currentStep === 2 ? (
            // Step 2: Customer Information
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-theme-brown">
                <User className="h-5 w-5" />
                <span className="font-medium">Delivery Information</span>
              </div>
              
              <div className="space-y-3">
                {/* Contact Section */}
                <div className="border-b pb-3 mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Contact Information</h3>
                  
                  {/* Name */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <User className="inline h-4 w-4 mr-1" />
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={customerInfo.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-theme-brown focus:border-theme-brown ${
                        errors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter your full name"
                    />
                    {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                  </div>

                  {/* Phone */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Phone className="inline h-4 w-4 mr-1" />
                      Phone Number *
                    </label>
                    <PhoneInput
                      value={customerInfo.phone}
                      onChange={(value) => handleInputChange('phone', value)}
                      error={errors.phone}
                      placeholder="Enter phone number"
                    />
                  </div>

                  {/* Quarter (optional) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <MapPin className="inline h-4 w-4 mr-1" />
                      Quarter/Residence (Optional)
                    </label>
                    <input
                      type="text"
                      value={customerInfo.quarter || ''}
                      onChange={(e) => handleInputChange('quarter', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-theme-brown focus:border-theme-brown"
                      placeholder="Your quarter or residence"
                    />
                  </div>
                </div>

                {/* Delivery Section */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Delivery Information</h3>
                  
                  {/* Delivery Name */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <User className="inline h-4 w-4 mr-1" />
                      Delivery Name *
                    </label>
                    <input
                      type="text"
                      value={customerInfo.deliveryName || customerInfo.name || ''}
                      onChange={(e) => handleInputChange('deliveryName', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-theme-brown focus:border-theme-brown ${
                        errors.deliveryName ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Name for delivery"
                    />
                    {errors.deliveryName && <p className="text-red-500 text-xs mt-1">{errors.deliveryName}</p>}
                  </div>

                  {/* Delivery Phone */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Phone className="inline h-4 w-4 mr-1" />
                      Delivery Phone *
                    </label>
                    <PhoneInput
                      value={customerInfo.deliveryPhone || customerInfo.phone || ''}
                      onChange={(value) => handleInputChange('deliveryPhone', value)}
                      error={errors.deliveryPhone}
                      placeholder="Phone for delivery"
                    />
                  </div>

                  {/* Delivery Address Line 1 */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <MapPin className="inline h-4 w-4 mr-1" />
                      Address (Street + Number) *
                    </label>
                    <input
                      type="text"
                      value={customerInfo.deliveryAddressLine1 || ''}
                      onChange={(e) => handleInputChange('deliveryAddressLine1', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-theme-brown focus:border-theme-brown ${
                        errors.deliveryAddressLine1 ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Ex: 123 Rue de la Paix"
                    />
                    {errors.deliveryAddressLine1 && <p className="text-red-500 text-xs mt-1">{errors.deliveryAddressLine1}</p>}
                  </div>

                  {/* Delivery Address Line 2 */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address Complement (Optional)
                    </label>
                    <input
                      type="text"
                      value={customerInfo.deliveryAddressLine2 || ''}
                      onChange={(e) => handleInputChange('deliveryAddressLine2', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-theme-brown focus:border-theme-brown"
                      placeholder="Ex: Appartement 4B, Bâtiment C"
                    />
                  </div>

                  {/* Delivery Quarter */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <MapPin className="inline h-4 w-4 mr-1" />
                      Delivery Quarter/Zone *
                    </label>
                    <input
                      type="text"
                      value={customerInfo.deliveryQuarter || ''}
                      onChange={(e) => handleInputChange('deliveryQuarter', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-theme-brown focus:border-theme-brown ${
                        errors.deliveryQuarter ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Ex: Mvog-Ada, Bastos"
                    />
                    {errors.deliveryQuarter && <p className="text-red-500 text-xs mt-1">{errors.deliveryQuarter}</p>}
                  </div>

                  {/* Delivery City */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City (Optional)
                    </label>
                    <input
                      type="text"
                      value={customerInfo.deliveryCity || ''}
                      onChange={(e) => handleInputChange('deliveryCity', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-theme-brown focus:border-theme-brown"
                      placeholder="Ex: Yaoundé, Douala"
                    />
                  </div>

                  {/* Delivery Instructions */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <MessageSquare className="inline h-4 w-4 mr-1" />
                      Delivery Instructions (Optional)
                    </label>
                    <textarea
                      value={customerInfo.deliveryInstructions || ''}
                      onChange={(e) => handleInputChange('deliveryInstructions', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-theme-brown focus:border-theme-brown resize-none"
                      placeholder="Any special delivery instructions..."
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Step 3: Payment Method Selection
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-emerald-600">
                <CreditCard className="h-5 w-5" />
                <span className="font-medium">Choose Payment Method</span>
              </div>
              
              <div className="bg-white rounded-lg p-4 shadow-sm border">
                
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

              {/* Order Success */}
              {orderCreated && createdOrder && (
                <div className="bg-white rounded-lg p-4 shadow-sm border">
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
                    
                    <button
                      onClick={onClose}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-semibold"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer - Show in steps 1 and 2, hide in step 3 and when order is created */}
        {(currentStep === 1 || currentStep === 2) && !orderCreated && (
          <div className="border-t border-gray-200 p-4 flex-shrink-0">
            <button
              onClick={handleNextStep}
              disabled={submitting}
              className="w-full bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4 mr-2" />
                {currentStep === 1 ? 'Proceed to Order' : 'Continue to Payment'}
              </>
            )}
          </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckoutModal;
