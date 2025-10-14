import React, { useState, useEffect } from 'react';
import { useCart } from '../../contexts/CartContext';
import { getCompanyByUserId, getSellerSettings } from '../../services/firestore';
import type { Company } from '../../types/models';
import type { CustomerInfo, OrderData, SellerSettings } from '../../types/order';
import { X, ArrowLeft, ArrowRight, ShoppingBag, User, MapPin, Phone, MessageSquare, CreditCard, Truck, Check } from 'lucide-react';
import PhoneInput from '../common/PhoneInput';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, companyId }) => {
  const { cart, getCartTotal, clearCart } = useCart();
  const [company, setCompany] = useState<Company | null>(null);
  const [sellerSettings, setSellerSettings] = useState<SellerSettings | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
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
    if (isOpen) {
      setCurrentStep(1);
      setCustomerInfo({
        name: '',
        phone: '',
        location: '',
        deliveryInstructions: ''
      });
      setErrors({});
    }
  }, [isOpen]);

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
    setCustomerInfo(prev => ({ ...prev, [field]: value }));
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
  const deliveryFee = 0;
  const finalTotal = subtotal + deliveryFee;

  // Handle step navigation
  const handleNextStep = () => {
    if (currentStep === 1) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (validateForm()) {
        handleSubmitOrder();
      }
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Handle order submission
  const handleSubmitOrder = async () => {
    setSubmitting(true);

    try {
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

      const message = generateOrderMessage(orderData, company, sellerSettings);
      const whatsappUrl = createWhatsAppUrl(company?.phone || sellerSettings?.whatsappNumber || '', message);
      
      clearCart();
      window.open(whatsappUrl, '_blank');
      onClose();
      
    } catch (error) {
      console.error('Error submitting order:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Generate order message
  const generateOrderMessage = (orderData: OrderData, company: Company | null, settings: SellerSettings | null): string => {
    const { customerInfo, cartItems, totalAmount, deliveryFee, finalTotal, orderId } = orderData;
    const businessName = company?.name || settings?.businessName || 'Your Business';
    const currency = settings?.currency || 'XAF';
    
    let message = `🛒 Commande ${businessName} #${orderId}\n\n`;
    
    message += `📋 Détails:\n`;
    cartItems.forEach(item => {
      const itemTotal = item.price * item.quantity;
      message += `- ${item.name} x ${item.quantity} = ${itemTotal.toLocaleString('fr-FR', {
        style: 'currency',
        currency: currency
      })}\n`;
    });
    
    message += `\n💰 Total: ${totalAmount.toLocaleString('fr-FR', {
      style: 'currency',
      currency: currency
    })}\n`;
    
    if (deliveryFee > 0) {
      message += `🚚 Frais de livraison: ${deliveryFee.toLocaleString('fr-FR', {
        style: 'currency',
        currency: currency
      })}\n`;
    }
    
    message += `💳 Total final: ${finalTotal.toLocaleString('fr-FR', {
      style: 'currency',
      currency: currency
    })}\n\n`;
    
    message += `👤 Client: ${customerInfo.name}\n`;
    message += `📞 Téléphone: ${customerInfo.phone}\n`;
    message += `📍 Adresse: ${customerInfo.location}\n`;
    
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
    const formattedPhone = phone.replace(/[^\d]/g, '');
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
                {currentStep === 1 ? 'Review Your Order' : 'Delivery Information'}
              </h2>
              <p className="text-sm text-gray-500">
                Step {currentStep} of 2
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
              <div className="border-t border-gray-200 pt-4 space-y-2">
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
                  <span className="text-theme-brown">
                    {finalTotal.toLocaleString('fr-FR', {
                      style: 'currency',
                      currency: 'XAF'
                    })}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            // Step 2: Customer Information
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-theme-brown">
                <User className="h-5 w-5" />
                <span className="font-medium">Delivery Information</span>
              </div>
              
              <div className="space-y-3">
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
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-theme-brown focus:border-theme-brown ${
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
                  <PhoneInput
                    value={customerInfo.phone}
                    onChange={(value) => handleInputChange('phone', value)}
                    error={errors.phone}
                    placeholder="Enter phone number"
                  />
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
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-theme-brown focus:border-theme-brown ${
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-theme-brown focus:border-theme-brown resize-none"
                    placeholder="Any special delivery instructions..."
                    rows={2}
                  />
                </div>
              </div>

              {/* Payment Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                <div className="flex items-center space-x-2 text-blue-800">
                  <CreditCard className="h-4 w-4" />
                  <span className="text-sm font-medium">Payment Information</span>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  Payment will be confirmed via WhatsApp
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 flex-shrink-0">
          <button
            onClick={handleNextStep}
            disabled={submitting}
            className="w-full bg-gradient-to-br from-theme-olive to-theme-forest text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : currentStep === 1 ? (
              <>
                <ArrowRight className="h-4 w-4 mr-2" />
                Proceed to Order
              </>
            ) : (
              <>
                <Truck className="h-4 w-4 mr-2" />
                Send Order via WhatsApp
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;
