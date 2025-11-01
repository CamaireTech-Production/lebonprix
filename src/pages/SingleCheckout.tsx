import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { createOrder } from '../services/orderService';
import { getCompanyByUserId, getSellerSettings } from '../services/firestore';
import { getCheckoutSettingsWithDefaults, subscribeToCheckoutSettings } from '../services/checkoutSettingsService';
// Removed useCheckoutPersistence - using manual save approach
import { subscribeToCinetPayConfig, isCinetPayConfigured } from '../services/cinetpayService';
import { processCinetPayPayment, validatePaymentData, formatPhoneForCinetPay } from '../utils/cinetpayHandler';
import type { CinetPayConfig } from '../types/cinetpay';
// import { generateWhatsAppMessage } from '../utils/whatsapp';
import { 
  CreditCard, 
  Truck, 
  ShoppingBag,
  ArrowLeft,
  CheckCircle,
  Lock,
  Shield,
  RotateCcw,
  HelpCircle
} from 'lucide-react';
import PhoneInput from '../components/common/PhoneInput';
import { ImageWithSkeleton } from '../components/common/ImageWithSkeleton';
import SaveStatusIndicator from '../components/checkout/SaveStatusIndicator';
import AmountTooLowModal from '../components/common/AmountTooLowModal';
import { toast } from 'react-hot-toast';
import type { Order, CustomerInfo, PaymentMethodType } from '../types/order';
import type { CheckoutSettings } from '../types/checkoutSettings';

interface Company {
  id: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
}

interface SellerSettings {
  deliveryFee: number;
  minOrderAmount: number;
  deliveryAreas: string[];
  pickupInstructions: string;
}

const SingleCheckout: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { cart, clearCart, getCartTotal, loadCartForCompany, setCurrentCompanyId } = useCart();
  const { user, company } = useAuth();
  
  // Get company colors with fallbacks
  const getCompanyColors = () => {
    const colors = {
      primary: company?.catalogueColors?.primary || company?.primaryColor || '#183524',
      secondary: company?.catalogueColors?.secondary || company?.secondaryColor || '#e2b069',
      tertiary: company?.catalogueColors?.tertiary || company?.tertiaryColor || '#2a4a3a',
      headerText: '#ffffff',
    };
    return colors;
  };

  // Manual data loading
  const loadCheckoutData = useCallback(() => {
    if (!company?.id || typeof company.id !== 'string') return null;
    
    try {
      const key = `checkout_data_${company.id}`;
      const stored = localStorage.getItem(key);
      
      if (!stored) return null;
      
      const payload = JSON.parse(stored);
      
      // Check if data has expired
      if (Date.now() > payload.expiresAt) {
        localStorage.removeItem(key);
        return null;
      }
      
      // Handle both old and new data formats
      if (payload.formData) {
        // New format - return the full payload
        return payload;
      } else if (payload.data) {
        // Old format - convert to new format
        return {
          formData: payload.data,
          cartItems: payload.data.cartItems || [],
          cartTotal: 0,
          timestamp: payload.timestamp,
          expiresAt: payload.expiresAt
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error loading checkout data:', error);
      return null;
    }
  }, [company?.id]);

  const clearCheckoutData = useCallback(() => {
    if (!company?.id || typeof company.id !== 'string') return;
    
    try {
      const key = `checkout_data_${company.id}`;
      localStorage.removeItem(key);
      console.log('Checkout data cleared');
    } catch (error) {
      console.error('Error clearing checkout data:', error);
    }
  }, [company?.id]);
  
  // Save status state
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  
  // State management
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: '',
    phone: '',
    location: '',
    deliveryInstructions: '',
    country: 'Cameroon'
  });
  const [email, setEmail] = useState('');
  const [emailNewsletter, setEmailNewsletter] = useState(true);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodType | null>(null);
  const [selectedPaymentOption, setSelectedPaymentOption] = useState<string | null>(null);
  
  // Payment form data
  const [paymentFormData, setPaymentFormData] = useState({
    mtnNumber: '',
    orangeNumber: '',
    cardNumber: '',
    expiryDate: '',
    securityCode: '',
    nameOnCard: ''
  });
  const [, setCompanyData] = useState<Company | null>(null);
  const [sellerSettings, setSellerSettings] = useState<SellerSettings | null>(null);
  const [checkoutSettings, setCheckoutSettings] = useState<CheckoutSettings | null>(null);
  const [cinetpayConfig, setCinetpayConfig] = useState<CinetPayConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderCreated, setOrderCreated] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  
  // Amount too low modal state
  const [showAmountTooLowModal, setShowAmountTooLowModal] = useState(false);
  const [minimumAmount, setMinimumAmount] = useState(100); // Default minimum
  const [errors, setErrors] = useState<Partial<CustomerInfo>>({});

  // Load companyData and settings data
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.uid) return;
      
      try {
        if (!company) {
          toast.error('Company not found');
          return;
        }
        
        const [companyDataResult, settingsData] = await Promise.all([
          getCompanyByUserId(company.id),
          getSellerSettings(company.id)
        ]);
        
        if (companyDataResult) {
          setCompanyData(companyDataResult);
        }
        if (settingsData) {
          setSellerSettings(settingsData as unknown as SellerSettings);
        }
      } catch (error) {
        console.error('Error fetching companyData data:', error);
        toast.error('Error loading companyData information');
      }
    };

    fetchData();
  }, [user?.uid]);

  // Real-time checkout settings subscription
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeToCheckoutSettings(user.uid, (settings) => {
      if (settings) {
        setCheckoutSettings(settings);
      } else {
        // If no settings exist, get defaults
        getCheckoutSettingsWithDefaults(user.uid).then(setCheckoutSettings);
      }
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Load CinetPay configuration
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeToCinetPayConfig(user.uid, (config) => {
      setCinetpayConfig(config);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Manual save on form changes (no auto-save)
  const saveCheckoutData = useCallback(() => {
    if (!company?.id || typeof company.id !== 'string') return;
    
    try {
      setIsSaving(true);
      const formData = {
        customerInfo,
        selectedPaymentMethod: selectedPaymentMethod || '',
        selectedPaymentOption: selectedPaymentOption || '',
        paymentFormData,
        cartItems: cart,
        lastSaved: new Date().toISOString(),
        companyId: company.id
      };
      
      // Save to localStorage
      const key = `checkout_data_${company.id}`;
      const payload = {
        formData,
        cartItems: cart,
        cartTotal: getCartTotal(),
        timestamp: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      };
      
      localStorage.setItem(key, JSON.stringify(payload));
      setLastSaved(new Date().toISOString());
      console.log('Checkout data saved manually');
    } catch (error) {
      console.error('Error saving checkout data:', error);
    } finally {
      setIsSaving(false);
    }
  }, [company?.id, customerInfo, selectedPaymentMethod, selectedPaymentOption, paymentFormData, cart, getCartTotal]);

  // Save data when user makes significant changes
  useEffect(() => {
    // Save when cart changes
    if (cart.length > 0) {
      const timeoutId = setTimeout(() => {
        saveCheckoutData();
      }, 2000); // Save 2 seconds after cart change
      
      return () => clearTimeout(timeoutId);
    }
  }, [cart, saveCheckoutData]);

  // Save data when payment method changes
  useEffect(() => {
    if (selectedPaymentMethod) {
      const timeoutId = setTimeout(() => {
        saveCheckoutData();
      }, 1000); // Save 1 second after payment method change
      
      return () => clearTimeout(timeoutId);
    }
  }, [selectedPaymentMethod, saveCheckoutData]);

  // Load saved checkout data on component mount
  useEffect(() => {
    if (company?.id) {
      // Set current company ID in cart context
      setCurrentCompanyId(company.id);
      
      // Load cart data for this company
      loadCartForCompany(company.id);
      
      // Load form data
      const savedData = loadCheckoutData();
      console.log('Loading checkout data for company:', company.id);
      console.log('Saved data found:', savedData);
      
      if (savedData) {
        console.log('Saved data structure:', {
          hasFormData: !!savedData.formData,
          formDataKeys: savedData.formData ? Object.keys(savedData.formData) : [],
          hasCustomerInfo: !!(savedData.formData && savedData.formData.customerInfo)
        });
        
        if (savedData.formData) {
          // Restore form data with null checks
          if (savedData.formData.customerInfo) {
            setCustomerInfo(savedData.formData.customerInfo);
          }
          if (savedData.formData.selectedPaymentMethod) {
            setSelectedPaymentMethod(savedData.formData.selectedPaymentMethod as PaymentMethodType);
          }
          if (savedData.formData.selectedPaymentOption) {
            setSelectedPaymentOption(savedData.formData.selectedPaymentOption);
          }
          if (savedData.formData.paymentFormData) {
            setPaymentFormData(savedData.formData.paymentFormData);
          }
          
          console.log('Form data restored:', savedData.formData);
          
          // Show restoration message
          if (savedData.formData.customerInfo && (savedData.formData.customerInfo.name || savedData.formData.customerInfo.phone)) {
            toast.success('Previous checkout data restored');
          }
        } else {
          console.log('No formData found in saved data');
        }
      } else {
        console.log('No saved checkout data found for company:', company.id);
      }
    }
  }, [company?.id, loadCheckoutData, loadCartForCompany, setCurrentCompanyId]);

  // Form validation
  const validateForm = (): boolean => {
    const newErrors: Partial<CustomerInfo> = {};

    // Only validate fields that are enabled in checkout settings
    if (checkoutSettings?.showContactSection) {
      // Validate name field only if it's enabled
      if (checkoutSettings.showFirstName && !customerInfo.name.trim()) {
        newErrors.name = 'Name is required';
      }

      // Validate phone field only if it's enabled
      if (checkoutSettings.showPhone && !customerInfo.phone.trim()) {
        newErrors.phone = 'Phone number is required';
      } else if (checkoutSettings.showPhone && customerInfo.phone.trim()) {
        // Basic phone validation only if phone field is enabled
        const phoneRegex = /^[+]?[0-9\s\-()]{8,}$/;
        if (!phoneRegex.test(customerInfo.phone.replace(/\s/g, ''))) {
          newErrors.phone = 'Please enter a valid phone number';
        }
      }
    }

    // Validate delivery fields only if delivery section is enabled
    if (checkoutSettings?.showDeliverySection) {
      // Validate address field only if it's enabled
      if (checkoutSettings.showAddress && !customerInfo.location.trim()) {
        newErrors.location = 'Location is required';
      }
      
      // Validate first name field only if it's enabled
      if (checkoutSettings.showFirstName && !customerInfo.name.trim()) {
        newErrors.name = 'First name is required';
      }
      
      // Validate last name field only if it's enabled
      if (checkoutSettings.showLastName && !customerInfo.surname?.trim()) {
        newErrors.surname = 'Last name is required';
      }
      
      // Validate city field only if it's enabled
      if (checkoutSettings.showCity && !customerInfo.location.trim()) {
        newErrors.location = 'City is required';
      }
    }

    // Validate payment-specific fields only if payment section is enabled
    if (checkoutSettings?.showPaymentSection && selectedPaymentOption) {
      if (selectedPaymentOption === 'mtn_money' && !customerInfo.phone.trim()) {
        newErrors.phone = 'MTN Mobile Money number is required';
      }
      if (selectedPaymentOption === 'orange_money' && !customerInfo.phone.trim()) {
        newErrors.phone = 'Orange Mobile Money number is required';
      }
      if (selectedPaymentOption === 'visa_card') {
        if (!paymentFormData.cardNumber.trim()) {
          newErrors.name = 'Card number is required';
        }
        if (!paymentFormData.expiryDate.trim()) {
          newErrors.location = 'Expiry date is required';
        }
        if (!paymentFormData.securityCode.trim()) {
          newErrors.deliveryInstructions = 'Security code is required';
        }
        if (!paymentFormData.nameOnCard.trim()) {
          newErrors.name = 'Name on card is required';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form input changes
  const handleInputChange = (field: keyof CustomerInfo, value: string) => {
    setCustomerInfo(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Handle payment method selection
  const handlePaymentMethodSelect = (method: string) => {
    setSelectedPaymentMethod(method as PaymentMethodType);
    setSelectedPaymentOption(method);
    // Reset form data when changing payment method
    setPaymentFormData({
      mtnNumber: '',
      orangeNumber: '',
      cardNumber: '',
      expiryDate: '',
      securityCode: '',
      nameOnCard: ''
    });
  };

  // Handle payment form input changes
  const handlePaymentFormChange = (field: string, value: string) => {
    setPaymentFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle order creation
  const handleCreateOrder = async () => {
    if (!selectedPaymentMethod) {
      toast.error('Please select a payment method');
      return;
    }

    if (!validateForm()) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate payment form data based on selected method and checkout settings
    if (checkoutSettings?.showPaymentSection) {
      if (selectedPaymentOption === 'mtn_money' && !customerInfo.phone.trim()) {
        toast.error('Please enter your MTN Mobile Money number');
        return;
      }

      if (selectedPaymentOption === 'orange_money' && !customerInfo.phone.trim()) {
        toast.error('Please enter your Orange Money number');
        return;
      }

      if (selectedPaymentOption === 'visa_card') {
        if (!paymentFormData.cardNumber.trim() || !paymentFormData.expiryDate.trim() || 
            !paymentFormData.securityCode.trim() || !paymentFormData.nameOnCard.trim()) {
          toast.error('Please fill in all card details');
          return;
        }
      }
    }

    // Pay onsite doesn't require additional form validation

    setSubmitting(true);
    try {
      // Ensure all fields have proper default values to avoid undefined errors
      const sanitizedCustomerInfo = {
        name: customerInfo.name || '',
        phone: customerInfo.phone || '',
        email: customerInfo.email || '',
        location: customerInfo.location || '',
        deliveryInstructions: customerInfo.deliveryInstructions || ''
      };

      const sanitizedPaymentFormData = {
        mtnNumber: paymentFormData.mtnNumber || '',
        orangeNumber: paymentFormData.orangeNumber || '',
        cardNumber: paymentFormData.cardNumber || '',
        expiryDate: paymentFormData.expiryDate || '',
        securityCode: paymentFormData.securityCode || '',
        nameOnCard: paymentFormData.nameOnCard || ''
      };

      // Check if this is a CinetPay payment
      const isCinetPayPayment = selectedPaymentOption?.startsWith('cinetpay_');
      
      if (isCinetPayPayment && cinetpayConfig) {
        // Handle CinetPay payment
        const paymentData = {
          amount: getCartTotal() + (sellerSettings?.deliveryFee || 0),
          currency: 'XAF',
          transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          description: `Order from ${company?.name || 'Store'}`,
          customerInfo: {
            name: sanitizedCustomerInfo.name,
            phone: formatPhoneForCinetPay(sanitizedCustomerInfo.phone),
            email: sanitizedCustomerInfo.email || email,
            address: sanitizedCustomerInfo.location,
            city: sanitizedCustomerInfo.location.split(',')[0] || 'Douala',
            country: 'CM',
            zipCode: ''
          },
          returnUrl: `${window.location.origin}/catalogue/${company?.name?.toLowerCase().replace(/\s+/g, '-')}/${company?.id}`,
          notifyUrl: `${window.location.origin}/api/cinetpay/webhook`
        };

        // Validate payment data
        const validation = validatePaymentData(paymentData);
        if (!validation.isValid) {
          toast.error(validation.errors.join(', '));
          return;
        }

        // Process CinetPay payment
        const paymentResult = await processCinetPayPayment(
          cinetpayConfig,
          paymentData,
          {
            onSuccess: (transaction) => {
              console.log('CinetPay payment successful:', transaction);
              toast.success('Payment successful! Your order is being processed.');
            },
            onError: (error) => {
              console.error('CinetPay payment error:', error);
              
              // Check if it's an amount too low error
              if (error.code === 'UNKNOWN_ERROR' && error.message === 'ERROR_AMOUNT_TOO_LOW') {
                // Try to extract minimum amount from error details
                if (error.details && typeof error.details === 'object') {
                  const details = error.details as Record<string, unknown>;
                  if (details.description && typeof details.description === 'string') {
                    const match = details.description.match(/(\d+)\s*XAF/);
                    if (match) {
                      setMinimumAmount(parseInt(match[1]));
                    }
                  }
                }
                setShowAmountTooLowModal(true);
              } else {
                toast.error(`Payment failed: ${error.message}`);
              }
            },
            onClose: () => {
              console.log('CinetPay payment popup closed');
            }
          }
        );

        if (paymentResult.success && company) {
          // Create order with CinetPay payment details
          const order = await createOrder(
            company.id,
            {
              customerInfo: sanitizedCustomerInfo,
              cartItems: cart,
              pricing: {
                subtotal: getCartTotal(),
                deliveryFee: sellerSettings?.deliveryFee || 0,
                total: getCartTotal() + (sellerSettings?.deliveryFee || 0)
              },
              paymentMethod: selectedPaymentOption || 'online',
              paymentOption: selectedPaymentOption || '',
              paymentFormData: sanitizedPaymentFormData,
              deliveryInfo: {
                method: 'delivery',
                address: sanitizedCustomerInfo.location,
                instructions: sanitizedCustomerInfo.deliveryInstructions
              },
              metadata: {
                source: 'catalogue',
                userId: user?.uid, // Include userId in metadata for audit
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
          
          // Clear cart and saved data
          clearCart();
          clearCheckoutData();
          
          toast.success('Order created successfully! Payment processing...');
          
          // Redirect to catalogue page after a short delay
          setTimeout(() => {
            if (company) {
              navigate(`/catalogue/${company.name.toLowerCase().replace(/\s+/g, '-')}/${company.id}`);
            } else {
              navigate('/');
            }
          }, 2000);
        } else {
          toast.error(paymentResult.error || 'Payment failed');
        }
      } else if (company) {
        // Handle regular payment methods (existing logic)
        const order = await createOrder(
          company.id,
          {
            customerInfo: sanitizedCustomerInfo,
            cartItems: cart,
            pricing: {
              subtotal: getCartTotal(),
              deliveryFee: sellerSettings?.deliveryFee || 0,
              total: getCartTotal() + (sellerSettings?.deliveryFee || 0)
            },
            paymentMethod: selectedPaymentOption || 'online',
            paymentOption: selectedPaymentOption || '',
            paymentFormData: sanitizedPaymentFormData,
            deliveryInfo: {
              method: 'delivery',
              address: sanitizedCustomerInfo.location,
              instructions: sanitizedCustomerInfo.deliveryInstructions
            },
            metadata: {
              source: 'catalogue',
              userId: user?.uid, // Include userId in metadata for audit
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
        
        // Clear cart and saved data
        clearCart();
        clearCheckoutData();
        
        // Show success message
        if (selectedPaymentOption === 'pay_onsite') {
          toast.success('Order created successfully! WhatsApp confirmation sent.');
        } else {
          toast.success('Order created successfully! Payment integration coming soon.');
        }
        
        // Redirect to catalogue page after a short delay
        setTimeout(() => {
          if (company) {
            navigate(`/catalogue/${company.name.toLowerCase().replace(/\s+/g, '-')}/${company.id}`);
          } else {
            navigate('/');
          }
        }, 2000);
      }
      
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Failed to create order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate totals
  const subtotal = getCartTotal();
  const deliveryFee = sellerSettings?.deliveryFee || 0;
  const finalTotal = subtotal + deliveryFee;

  // Scroll to cart function
  const scrollToCart = () => {
    const cartElement = document.getElementById('cart-section');
    if (cartElement) {
      cartElement.scrollIntoView({ behavior: 'smooth' });
    } else {
      // If cart section is not visible, redirect to catalogue
      navigate('/catalogue');
    }
  };

  // If cart is empty, redirect to catalogue
  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ShoppingBag className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Your cart is empty</h2>
          <p className="text-gray-600 mb-4">Add some items to your cart to proceed with checkout</p>
          <button
            onClick={() => {
              if (company) {
                navigate(`/catalogue/${company.name.toLowerCase().replace(/\s+/g, '-')}/${company.id}`);
              } else {
                navigate('/');
              }
            }}
            className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => {
              if (company) {
                navigate(`/catalogue/${company.name.toLowerCase().replace(/\s+/g, '-')}/${company.id}`);
              } else {
                navigate('/');
              }
            }}
            className="flex items-center mb-4 transition-colors"
            style={{color: getCompanyColors().primary}}
            onMouseEnter={(e) => (e.target as HTMLButtonElement).style.color = getCompanyColors().secondary}
            onMouseLeave={(e) => (e.target as HTMLButtonElement).style.color = getCompanyColors().primary}
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            {t('checkout.returnToCatalogue')}
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold" style={{color: getCompanyColors().primary}}>{t('checkout.title')}</h1>
            <div className="flex items-center space-x-3">
              <SaveStatusIndicator
                isSaving={isSaving}
                lastSaved={lastSaved}
                hasUnsavedChanges={false} // No continuous unsaved changes
                isDataFresh={true} // Manual save is always fresh
                dataAge={0} // Manual save doesn't track age
                className="text-sm"
              />
              <button
                onClick={saveCheckoutData}
                disabled={isSaving}
                className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
              >
                {isSaving ? t('common.saving') : t('checkout.saveDraft')}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Forms */}
          <div className="space-y-8">
            {/* Contact Section */}
            {checkoutSettings?.showContactSection && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-bold mb-4" style={{color: getCompanyColors().primary}}>{t('checkout.contact')}</h2>
                
                <div className="space-y-4">
                  {checkoutSettings.showEmail && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('checkout.fields.email')}
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder={t('checkout.fields.email')}
                      />
                    </div>
                  )}

                  {checkoutSettings.showPhone && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('checkout.fields.phone')}
                      </label>
                      <PhoneInput
                        value={customerInfo.phone}
                        onChange={(value) => handleInputChange('phone', value)}
                        error={errors.phone}
                        placeholder={t('checkout.fields.phone')}
                      />
                    </div>
                  )}
                  
                  {checkoutSettings.showNewsletter && (
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="newsletter"
                        checked={emailNewsletter}
                        onChange={(e) => setEmailNewsletter(e.target.checked)}
                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                      />
                      <label htmlFor="newsletter" className="ml-2 text-sm text-gray-700">
                        Email me with news and offers
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Delivery Section */}
            {checkoutSettings?.showDeliverySection && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-bold mb-4" style={{color: getCompanyColors().primary}}>{t('checkout.delivery')}</h2>
                
                <div className="space-y-4">
                  {/* Country/Region */}
                  {checkoutSettings.showCountry && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Country/Region
                      </label>
                      <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
                        <option value="CM">Cameroon</option>
                      </select>
                    </div>
                  )}

                  {/* Name Fields */}
                  {(checkoutSettings.showFirstName || checkoutSettings.showLastName) && (
                    <div className="grid grid-cols-2 gap-4">
                      {checkoutSettings.showFirstName && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            First name *
                          </label>
                          <input
                            type="text"
                            value={customerInfo.name}
                            onChange={(e) => {
                              setCustomerInfo(prev => ({ 
                                ...prev, 
                                name: e.target.value 
                              }));
                            }}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                              errors.name ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="First name"
                          />
                        </div>
                      )}
                      {checkoutSettings.showLastName && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Last name *
                          </label>
                          <input
                            type="text"
                            value={customerInfo.surname || ''}
                            onChange={(e) => {
                              setCustomerInfo(prev => ({ 
                                ...prev, 
                                surname: e.target.value 
                              }));
                            }}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                              errors.surname ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="Last name"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Address */}
                  {checkoutSettings.showAddress && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('checkout.fields.address')} *
                      </label>
                      <input
                        type="text"
                        value={customerInfo.location}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                          errors.location ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="Enter your address"
                      />
                      {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location}</p>}
                    </div>
                  )}

                  {/* Apartment/Suite */}
                  {checkoutSettings.showApartment && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Apartment, suite, etc. (optional)
                      </label>
                      <input
                        type="text"
                        value={customerInfo.deliveryInstructions}
                        onChange={(e) => handleInputChange('deliveryInstructions', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="Apartment, suite, etc."
                      />
                    </div>
                  )}

                  {/* City */}
                  {checkoutSettings.showCity && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('checkout.fields.city')}
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="Enter your city"
                      />
                    </div>
                  )}

                  {/* Delivery Instructions */}
                  {checkoutSettings.showDeliveryInstructions && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Delivery Instructions (optional)
                      </label>
                      <textarea
                        value={customerInfo.deliveryInstructions}
                        onChange={(e) => handleInputChange('deliveryInstructions', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="Any special delivery instructions..."
                        rows={3}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Shipping Method Section */}
            {checkoutSettings?.showShippingMethod && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-bold mb-4" style={{color: getCompanyColors().primary}}>Shipping method</h2>
                
                <div className="space-y-3">
                  <div className="border border-gray-200 rounded-lg p-4 bg-emerald-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <input
                          type="radio"
                          name="shipping"
                          defaultChecked
                          className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                        />
                        <div>
                          <p className="font-medium text-gray-900">Standard Delivery</p>
                          <p className="text-sm text-gray-600">3-5 Business Days</p>
                        </div>
                      </div>
                      <span className="font-semibold text-gray-900">
                        {deliveryFee > 0 ? `${deliveryFee.toLocaleString('fr-FR', { style: 'currency', currency: 'XAF' })}` : 'Free'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Section */}
            {checkoutSettings?.showPaymentSection && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-bold mb-4" style={{color: getCompanyColors().primary}}>{t('checkout.payment')}</h2>
                <p className="text-sm text-gray-600 mb-4">All transactions are secure and encrypted.</p>
                
                {/* Payment Options Container */}
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                  {/* MTN Money Option */}
                  {checkoutSettings.enabledPaymentMethods.mtnMoney && (
                    <div className={`p-4 ${selectedPaymentOption === 'mtn_money' ? 'bg-gray-50' : ''}`}>
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="paymentMethod"
                      id="mtn_money"
                      checked={selectedPaymentOption === 'mtn_money'}
                      onChange={() => handlePaymentMethodSelect('mtn_money')}
                      className="h-4 w-4 text-gray-900 focus:ring-gray-500 border-gray-300"
                    />
                    <label htmlFor="mtn_money" className="flex items-center space-x-3 cursor-pointer flex-1">
                      <div className="w-8 h-8 bg-yellow-500 rounded flex items-center justify-center">
                        <span className="text-white font-bold text-sm">MTN</span>
                      </div>
                      <span className="font-medium text-gray-900">{t('checkout.paymentMethods.mtnMoney')}</span>
                    </label>
                  </div>
                  
                  {/* MTN Money Form - appears directly under the option */}
                  {selectedPaymentOption === 'mtn_money' && (
                    <div className="mt-4 pl-8">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          MTN Mobile Money Number *
                        </label>
                        <input
                          type="text"
                          value={paymentFormData.mtnNumber}
                          onChange={(e) => handlePaymentFormChange('mtnNumber', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                          placeholder="Enter your MTN Mobile Money number"
                        />
                      </div>
                    </div>
                  )}
                  </div>
                )}

                  {/* Orange Money Option */}
                  {checkoutSettings.enabledPaymentMethods.orangeMoney && (
                    <div className={`p-4 border-t border-gray-200 ${selectedPaymentOption === 'orange_money' ? 'bg-gray-50' : ''}`}>
                      <div className="flex items-center space-x-3">
                        <input
                          type="radio"
                          name="paymentMethod"
                          id="orange_money"
                          checked={selectedPaymentOption === 'orange_money'}
                          onChange={() => handlePaymentMethodSelect('orange_money')}
                          className="h-4 w-4 text-gray-900 focus:ring-gray-500 border-gray-300"
                        />
                        <label htmlFor="orange_money" className="flex items-center space-x-3 cursor-pointer flex-1">
                          <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center">
                            <span className="text-white font-bold text-sm">O</span>
                          </div>
                          <span className="font-medium text-gray-900">{t('checkout.paymentMethods.orangeMoney')}</span>
                        </label>
                      </div>
                      
                      {/* Orange Money Form - appears directly under the option */}
                      {selectedPaymentOption === 'orange_money' && (
                        <div className="mt-4 pl-8">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Orange Money Number *
                            </label>
                            <input
                              type="text"
                              value={paymentFormData.orangeNumber}
                              onChange={(e) => handlePaymentFormChange('orangeNumber', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                              placeholder="Enter your Orange Money number"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Visa Card Option */}
                  {checkoutSettings.enabledPaymentMethods.visaCard && (
                    <div className={`p-4 border-t border-gray-200 ${selectedPaymentOption === 'visa_card' ? 'bg-gray-50' : ''}`}>
                      <div className="flex items-center space-x-3">
                        <input
                          type="radio"
                          name="paymentMethod"
                          id="visa_card"
                          checked={selectedPaymentOption === 'visa_card'}
                          onChange={() => handlePaymentMethodSelect('visa_card')}
                          className="h-4 w-4 text-gray-900 focus:ring-gray-500 border-gray-300"
                        />
                        <label htmlFor="visa_card" className="flex items-center space-x-3 cursor-pointer flex-1">
                          <CreditCard className="h-5 w-5 text-gray-600" />
                          <span className="font-medium text-gray-900">{t('checkout.paymentMethods.visaCard')}</span>
                          <div className="flex space-x-1 ml-auto">
                            <div className="w-8 h-5 bg-blue-600 rounded text-white text-xs flex items-center justify-center">V</div>
                            <div className="w-8 h-5 bg-red-600 rounded text-white text-xs flex items-center justify-center">M</div>
                            <div className="w-8 h-5 bg-blue-800 rounded text-white text-xs flex items-center justify-center">A</div>
                            <span className="text-xs text-gray-500">+4</span>
                          </div>
                        </label>
                      </div>
                      
                      {/* Visa Card Form - appears directly under the option */}
                      {selectedPaymentOption === 'visa_card' && (
                        <div className="mt-4 pl-8 space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Card number *
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                value={paymentFormData.cardNumber}
                                onChange={(e) => handlePaymentFormChange('cardNumber', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                                placeholder="1234 5678 9012 3456"
                              />
                              <Lock className="h-4 w-4 text-gray-400 absolute right-3 top-3" />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Expiration date (MM/YY) *
                              </label>
                              <input
                                type="text"
                                value={paymentFormData.expiryDate}
                                onChange={(e) => handlePaymentFormChange('expiryDate', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                                placeholder="MM/YY"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Security code *
                              </label>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={paymentFormData.securityCode}
                                  onChange={(e) => handlePaymentFormChange('securityCode', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                                  placeholder="123"
                                />
                                <HelpCircle className="h-4 w-4 text-gray-400 absolute right-3 top-3" />
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Name on card *
                            </label>
                            <input
                              type="text"
                              value={paymentFormData.nameOnCard}
                              onChange={(e) => handlePaymentFormChange('nameOnCard', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                              placeholder="Enter name as it appears on card"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CinetPay Online Payment Options */}
                  {cinetpayConfig && isCinetPayConfigured(cinetpayConfig) && (
                    <>
                      {/* CinetPay Mobile Money */}
                      {cinetpayConfig.enabledChannels.mobileMoney && (
                        <div className={`p-4 border-t border-gray-200 ${selectedPaymentOption === 'cinetpay_mobile_money' ? 'bg-gray-50' : ''}`}>
                          <div className="flex items-center space-x-3">
                            <input
                              type="radio"
                              name="paymentMethod"
                              id="cinetpay_mobile_money"
                              checked={selectedPaymentOption === 'cinetpay_mobile_money'}
                              onChange={() => handlePaymentMethodSelect('cinetpay_mobile_money')}
                              className="h-4 w-4 text-gray-900 focus:ring-gray-500 border-gray-300"
                            />
                            <label htmlFor="cinetpay_mobile_money" className="flex items-center space-x-3 cursor-pointer flex-1">
                              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                                <span className="text-white font-bold text-sm">CM</span>
                              </div>
                              <span className="font-medium text-gray-900">Mobile Money (CinetPay)</span>
                              <span className="text-xs text-gray-500">MTN • Orange</span>
                            </label>
                          </div>
                          
                          {/* CinetPay Mobile Money Form */}
                          {selectedPaymentOption === 'cinetpay_mobile_money' && (
                            <div className="mt-4 pl-8">
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-center space-x-2 text-blue-700 mb-2">
                                  <CreditCard className="h-4 w-4" />
                                  <span className="font-medium text-sm">Secure Online Payment</span>
                                </div>
                                <p className="text-sm text-blue-600">
                                  Pay securely with MTN Money or Orange Money. You'll be redirected to a secure payment page.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* CinetPay Credit Card */}
                      {cinetpayConfig.enabledChannels.creditCard && (
                        <div className={`p-4 border-t border-gray-200 ${selectedPaymentOption === 'cinetpay_credit_card' ? 'bg-gray-50' : ''}`}>
                          <div className="flex items-center space-x-3">
                            <input
                              type="radio"
                              name="paymentMethod"
                              id="cinetpay_credit_card"
                              checked={selectedPaymentOption === 'cinetpay_credit_card'}
                              onChange={() => handlePaymentMethodSelect('cinetpay_credit_card')}
                              className="h-4 w-4 text-gray-900 focus:ring-gray-500 border-gray-300"
                            />
                            <label htmlFor="cinetpay_credit_card" className="flex items-center space-x-3 cursor-pointer flex-1">
                              <CreditCard className="h-5 w-5 text-gray-600" />
                              <span className="font-medium text-gray-900">Credit Card (CinetPay)</span>
                              <div className="flex space-x-1 ml-auto">
                                <div className="w-8 h-5 bg-blue-600 rounded text-white text-xs flex items-center justify-center">V</div>
                                <div className="w-8 h-5 bg-red-600 rounded text-white text-xs flex items-center justify-center">M</div>
                              </div>
                            </label>
                          </div>
                          
                          {/* CinetPay Credit Card Form */}
                          {selectedPaymentOption === 'cinetpay_credit_card' && (
                            <div className="mt-4 pl-8">
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-center space-x-2 text-blue-700 mb-2">
                                  <CreditCard className="h-4 w-4" />
                                  <span className="font-medium text-sm">Secure Card Payment</span>
                                </div>
                                <p className="text-sm text-blue-600">
                                  Pay securely with Visa or Mastercard. You'll be redirected to a secure payment page.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* CinetPay Wallet */}
                      {cinetpayConfig.enabledChannels.wallet && (
                        <div className={`p-4 border-t border-gray-200 ${selectedPaymentOption === 'cinetpay_wallet' ? 'bg-gray-50' : ''}`}>
                          <div className="flex items-center space-x-3">
                            <input
                              type="radio"
                              name="paymentMethod"
                              id="cinetpay_wallet"
                              checked={selectedPaymentOption === 'cinetpay_wallet'}
                              onChange={() => handlePaymentMethodSelect('cinetpay_wallet')}
                              className="h-4 w-4 text-gray-900 focus:ring-gray-500 border-gray-300"
                            />
                            <label htmlFor="cinetpay_wallet" className="flex items-center space-x-3 cursor-pointer flex-1">
                              <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center">
                                <span className="text-white font-bold text-sm">W</span>
                              </div>
                              <span className="font-medium text-gray-900">Digital Wallet (CinetPay)</span>
                            </label>
                          </div>
                          
                          {/* CinetPay Wallet Form */}
                          {selectedPaymentOption === 'cinetpay_wallet' && (
                            <div className="mt-4 pl-8">
                              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                <div className="flex items-center space-x-2 text-purple-700 mb-2">
                                  <CreditCard className="h-4 w-4" />
                                  <span className="font-medium text-sm">Digital Wallet Payment</span>
                                </div>
                                <p className="text-sm text-purple-600">
                                  Pay with your digital wallet. You'll be redirected to a secure payment page.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Pay Onsite Option */}
                  {checkoutSettings.enabledPaymentMethods.payOnsite && (
                    <div className={`p-4 border-t border-gray-200 ${selectedPaymentOption === 'pay_onsite' ? 'bg-gray-50' : ''}`}>
                      <div className="flex items-center space-x-3">
                        <input
                          type="radio"
                          name="paymentMethod"
                          id="pay_onsite"
                          checked={selectedPaymentOption === 'pay_onsite'}
                          onChange={() => handlePaymentMethodSelect('pay_onsite')}
                          className="h-4 w-4 text-gray-900 focus:ring-gray-500 border-gray-300"
                        />
                        <label htmlFor="pay_onsite" className="flex items-center space-x-3 cursor-pointer flex-1">
                          <Truck className="h-5 w-5 text-emerald-600" />
                          <span className="font-medium text-gray-900">{t('checkout.paymentMethods.payOnsite')}</span>
                        </label>
                      </div>
                      
                      {/* Pay Onsite Form - appears directly under the option */}
                      {selectedPaymentOption === 'pay_onsite' && (
                        <div className="mt-4 pl-8">
                          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                            <div className="flex items-center space-x-2 text-emerald-700 mb-2">
                              <Truck className="h-4 w-4" />
                              <span className="font-medium text-sm">Pay at Pickup</span>
                            </div>
                            <p className="text-sm text-emerald-600">
                              You will pay when you collect your order. WhatsApp confirmation will be sent with pickup instructions.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Order Summary */}
          {checkoutSettings?.showOrderSummary && (
            <div className="lg:sticky lg:top-8" id="cart-section">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold mb-6" style={{color: getCompanyColors().primary}}>{t('checkout.orderSummary')}</h3>
              
              {/* Cart Items */}
              <div className="space-y-4 mb-6">
                {cart.map((item) => (
                  <div key={`${item.productId}-${item.selectedColor || 'default'}-${item.selectedSize || 'default'}`} 
                       className="flex items-center space-x-3">
                    <div className="relative">
                      <ImageWithSkeleton
                        src={item.image || '/placeholder.png'}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded"
                      />
                      <div className="absolute -top-2 -right-2 bg-gray-900 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                        {item.quantity}
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm text-gray-900">{item.name}</h4>
                      <p className="text-xs text-gray-500">
                        {item.selectedColor && `${item.selectedColor}`}
                        {item.selectedColor && item.selectedSize && ' • '}
                        {item.selectedSize && `${item.selectedSize}`}
                      </p>
                      <p className="text-sm font-medium text-emerald-600">
                        {(item.price * item.quantity).toLocaleString('fr-FR', {
                          style: 'currency',
                          currency: 'XAF'
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Discount Code */}
              {checkoutSettings?.showDiscountCode && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discount code or gift card
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="Enter code"
                    />
                    <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                      Apply
                    </button>
                  </div>
                </div>
              )}

              {/* Cost Breakdown */}
              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('checkout.orderSummaryDetails.subtotal')}</span>
                  <span className="font-medium">
                    {subtotal.toLocaleString('fr-FR', {
                      style: 'currency',
                      currency: 'XAF'
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium">
                    {deliveryFee > 0 ? deliveryFee.toLocaleString('fr-FR', {
                      style: 'currency',
                      currency: 'XAF'
                    }) : 'Free'}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>{t('checkout.orderSummaryDetails.total')}</span>
                    <span className="text-emerald-600">
                      {finalTotal.toLocaleString('fr-FR', {
                        style: 'currency',
                        currency: 'XAF'
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trust Badges */}
              {checkoutSettings?.showTrustBadges && (
                <div className="space-y-3 mb-6">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Lock className="h-4 w-4 text-yellow-500" />
                    <span>SECURE CHECKOUT</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Shield className="h-4 w-4 text-yellow-500" />
                    <span>EXCEPTIONAL CUSTOMER SERVICE</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <RotateCcw className="h-4 w-4 text-yellow-500" />
                    <span>14 DAYS RETURNS</span>
                  </div>
                </div>
              )}

              {/* Complete Order Button */}
              {!orderCreated ? (
                <button
                  onClick={handleCreateOrder}
                  disabled={submitting}
                  className="w-full text-white py-4 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  style={{
                    backgroundColor: getCompanyColors().primary,
                    '--tw-bg-opacity': '1'
                  } as React.CSSProperties}
                  onMouseEnter={(e) => {
                    if (!submitting) {
                      (e.target as HTMLButtonElement).style.backgroundColor = getCompanyColors().secondary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!submitting) {
                      (e.target as HTMLButtonElement).style.backgroundColor = getCompanyColors().primary;
                    }
                  }}
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    t('checkout.completeOrder')
                  )}
                </button>
              ) : (
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-2 mb-4" style={{color: getCompanyColors().primary}}>
                    <CheckCircle className="h-8 w-8" />
                    <span className="font-medium text-xl">Order Created Successfully!</span>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <p className="text-lg font-semibold text-gray-900 mb-2">
                      Order Number: {createdOrder?.orderNumber}
                    </p>
                    <p className="text-gray-600">
                      {selectedPaymentOption === 'pay_onsite' 
                        ? 'WhatsApp confirmation has been sent. Please check your messages for pickup instructions.'
                        : 'Payment integration coming soon. We will contact you for payment details.'
                      }
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      You will be redirected to the catalogue in a few seconds...
                    </p>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        if (company) {
                          navigate(`/catalogue/${company.name}/${company.id}`);
                        } else {
                          navigate('/');
                        }
                      }}
                      className="w-full text-white py-3 rounded-lg font-semibold transition-colors"
                      style={{backgroundColor: getCompanyColors().primary}}
                      onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = getCompanyColors().secondary}
                      onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = getCompanyColors().primary}
                    >
                      Continue Shopping
                    </button>
                    <button
                      onClick={() => navigate('/orders')}
                      className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                    >
                      View Orders
                    </button>
                  </div>
                </div>
              )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Amount Too Low Modal */}
      <AmountTooLowModal
        isOpen={showAmountTooLowModal}
        onClose={() => setShowAmountTooLowModal(false)}
        currentAmount={getCartTotal()}
        minimumAmount={minimumAmount}
        currency="XAF"
        onAddMoreItems={scrollToCart}
      />
    </div>
  );
};

export default SingleCheckout;