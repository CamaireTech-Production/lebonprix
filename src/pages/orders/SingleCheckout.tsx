import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '@contexts/CartContext';
import { useAuth } from '@contexts/AuthContext';
import { createOrder } from '@services/firestore/orders/orderService';
import { getCompanyById } from '@services/firestore/companies/companyPublic';
import { getSellerSettings } from '@services/firestore/firestore';
import { getCurrentEmployeeRef } from '@utils/business/employeeUtils';
import { getUserById } from '@services/utilities/userService';
import { formatPrice } from '@utils/formatting/formatPrice';
import { subscribeToCheckoutSettingsByCompanyId } from '@services/utilities/checkoutSettingsService';
// Removed useCheckoutPersistence - using manual save approach
import { subscribeToCinetPayConfig, isCinetPayConfigured } from '@services/payment/cinetpayService';
import { processCinetPayPayment, validatePaymentData, formatPhoneForCinetPay } from '@utils/core/cinetpayHandler';
// Campay integration uses useCampay hook (matching RestoFlow pattern)
import { useCampay } from '@hooks/useCampay';
import { getCampayConfig } from '@services/payment/campayService';
import { formatPhoneForWhatsApp } from '@utils/core/phoneUtils';
import type { CinetPayConfig } from '../../types/cinetpay';
import type { Company } from '../../types/models';
// import { generateWhatsAppMessage } from '@utils/whatsapp';
import { 
  CreditCard, 
  Truck, 
  ShoppingBag,
  ArrowLeft,
  CheckCircle,
  Check,
  Lock,
  Shield,
  RotateCcw,
  HelpCircle
} from 'lucide-react';
import { PhoneInput, ImageWithSkeleton, AmountTooLowModal } from '@components/common';
import SaveStatusIndicator from '@components/checkout/SaveStatusIndicator';
import { toast } from 'react-hot-toast';
import type { Order, CustomerInfo, PaymentMethodType } from '../../types/order';
import type { CheckoutSettings } from '../../types/checkoutSettings';

interface SellerSettings {
  deliveryFee: number;
  minOrderAmount: number;
  deliveryAreas: string[];
  pickupInstructions: string;
}

const SingleCheckout: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { companyId } = useParams<{ companyId: string }>();
  const { cart, clearCart, getCartTotal, loadCartForCompany, setCurrentCompanyId } = useCart();
  const { user, currentEmployee, isOwner } = useAuth();
  
  // Local company state (fetched by companyId from URL)
  const [company, setCompany] = useState<Company | null>(null);
  
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
    if (!companyId || typeof companyId !== 'string') return null;
    
    try {
      const key = `checkout_data_${companyId}`;
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
  }, [companyId]);

  const clearCheckoutData = useCallback(() => {
    if (!companyId || typeof companyId !== 'string') return;
    
    try {
      const key = `checkout_data_${companyId}`;
      localStorage.removeItem(key);
      console.log('Checkout data cleared');
    } catch (error) {
      console.error('Error clearing checkout data:', error);
    }
  }, [companyId]);
  
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
  // Use Campay hook (matching RestoFlow pattern)
  const { processPayment: processCampayPayment, isInitialized: isCampayInitialized, hiddenButtonId: campayButtonId } = useCampay(companyId || null);
  const [submitting, setSubmitting] = useState(false);
  const [orderCreated, setOrderCreated] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  
  // Amount too low modal state
  const [showAmountTooLowModal, setShowAmountTooLowModal] = useState(false);
  const [minimumAmount, setMinimumAmount] = useState(100); // Default minimum
  const [errors, setErrors] = useState<Partial<CustomerInfo>>({});

  // Load company data from URL parameter
  useEffect(() => {
    const fetchCompanyData = async () => {
      if (!companyId) {
        toast.error('Company ID not found in URL');
        return;
      }
      
      try {
        const companyData = await getCompanyById(companyId);
        
        if (companyData) {
          setCompany(companyData);
          setCompanyData(companyData);
          
          // Also load seller settings
          try {
            const settingsData = await getSellerSettings(companyId);
            if (settingsData) {
              setSellerSettings(settingsData as unknown as SellerSettings);
            }
          } catch (error) {
            console.error('Error loading seller settings:', error);
          }
        } else {
          toast.error('Company not found');
          navigate('/');
        }
      } catch (error) {
        console.error('Error fetching company data:', error);
        toast.error('Error loading company information');
      }
    };

    fetchCompanyData();
  }, [companyId, navigate]);

  // Real-time checkout settings subscription by companyId
  useEffect(() => {
    if (!companyId) return;

    const unsubscribe = subscribeToCheckoutSettingsByCompanyId(companyId, (settings) => {
      console.log('Checkout settings loaded:', {
        hasSettings: !!settings,
        enabledPaymentMethods: settings?.enabledPaymentMethods,
        mtnMoney: settings?.enabledPaymentMethods?.mtnMoney,
        orangeMoney: settings?.enabledPaymentMethods?.orangeMoney,
        visaCard: settings?.enabledPaymentMethods?.visaCard,
        payOnsite: settings?.enabledPaymentMethods?.payOnsite,
      });
      setCheckoutSettings(settings);
    });

    return () => unsubscribe();
  }, [companyId]);

  // Load CinetPay configuration by companyId
  useEffect(() => {
    if (!companyId) return;

    const unsubscribe = subscribeToCinetPayConfig(companyId, (config) => {
      setCinetpayConfig(config);
    });

    return () => unsubscribe();
  }, [companyId]);

  // Campay config is now managed by useCampay hook - no need for separate subscription
  // Removed duplicate subscription to avoid state sync issues

  // Manual save on form changes (no auto-save)
  const saveCheckoutData = useCallback(() => {
    if (!companyId || typeof companyId !== 'string') return;
    
    try {
      setIsSaving(true);
      const formData = {
        customerInfo,
        selectedPaymentMethod: selectedPaymentMethod || '',
        selectedPaymentOption: selectedPaymentOption || '',
        paymentFormData,
        cartItems: cart,
        lastSaved: new Date().toISOString(),
        companyId: companyId
      };
      
      // Save to localStorage
      const key = `checkout_data_${companyId}`;
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
  }, [companyId, customerInfo, selectedPaymentMethod, selectedPaymentOption, paymentFormData, cart, getCartTotal]);

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
    if (companyId) {
      // Set current company ID in cart context
      setCurrentCompanyId(companyId);
      
      // Load cart data for this company
      loadCartForCompany(companyId);
      
      // Load form data
      const savedData = loadCheckoutData();
      console.log('Loading checkout data for company:', companyId);
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
        console.log('No saved checkout data found for company:', companyId);
      }
    }
  }, [companyId, loadCheckoutData, loadCartForCompany, setCurrentCompanyId]);

  // Form validation
  const validateForm = (): boolean => {
    const newErrors: Partial<CustomerInfo> = {};

    // Only validate fields that are enabled in checkout settings
    if (checkoutSettings?.showContactSection) {
      // Validate name field only if it's enabled
      if (checkoutSettings.showFirstName && !customerInfo.name.trim()) {
        newErrors.name = 'Le nom est requis';
      }

      // Validate phone field only if it's enabled
      if (checkoutSettings.showPhone && !customerInfo.phone.trim()) {
        newErrors.phone = 'Le numéro de téléphone est requis';
      } else if (checkoutSettings.showPhone && customerInfo.phone.trim()) {
        // Basic phone validation only if phone field is enabled
        const phoneRegex = /^[+]?[0-9\s\-()]{8,}$/;
        if (!phoneRegex.test(customerInfo.phone.replace(/\s/g, ''))) {
          newErrors.phone = 'Veuillez entrer un numéro de téléphone valide';
        }
      }
    }

    // Validate delivery fields only if delivery section is enabled
    if (checkoutSettings?.showDeliverySection) {
      // Validate address field only if it's enabled
      if (checkoutSettings.showAddress && !customerInfo.location.trim()) {
        newErrors.location = 'L\'adresse est requise';
      }
      
      // Validate first name field only if it's enabled
      if (checkoutSettings.showFirstName && !customerInfo.name.trim()) {
        newErrors.name = 'Le prénom est requis';
      }
      
      // Validate last name field only if it's enabled
      if (checkoutSettings.showLastName && !customerInfo.surname?.trim()) {
        newErrors.surname = 'Le nom de famille est requis';
      }
      
      // Validate city field only if it's enabled
      if (checkoutSettings.showCity && !customerInfo.location.trim()) {
        newErrors.location = 'La ville est requise';
      }
    }

    // Validate payment-specific fields only if payment section is enabled
    if (checkoutSettings?.showPaymentSection && selectedPaymentOption) {
      if (selectedPaymentOption === 'mtn_money' && !customerInfo.phone.trim()) {
        newErrors.phone = 'Le numéro MTN Mobile Money est requis';
      }
      if (selectedPaymentOption === 'orange_money' && !customerInfo.phone.trim()) {
        newErrors.phone = 'Le numéro Orange Mobile Money est requis';
      }
      if (selectedPaymentOption === 'visa_card') {
        if (!paymentFormData.cardNumber.trim()) {
          newErrors.name = 'Le numéro de carte est requis';
        }
        if (!paymentFormData.expiryDate.trim()) {
          newErrors.location = 'La date d\'expiration est requise';
        }
        if (!paymentFormData.securityCode.trim()) {
          newErrors.deliveryInstructions = 'Le code de sécurité est requis';
        }
        if (!paymentFormData.nameOnCard.trim()) {
          newErrors.name = 'Le nom sur la carte est requis';
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

  // Generate order message for WhatsApp
  const generateOrderMessage = (order: Order, orderNumber: string): string => {
    const businessName = company?.name || 'Your Business';
    
    let message = `🛒 Commande ${businessName} #${orderNumber}\n\n`;
    
    // Order details
    message += `📋 Détails:\n`;
    order.items.forEach(item => {
      const itemTotal = item.price * item.quantity;
      message += `- ${item.name} x ${item.quantity} = ${formatPrice(itemTotal)} XAF\n`;
    });
    
    message += `\n💰 Total: ${formatPrice(order.pricing.subtotal)} XAF\n`;
    
    if (order.pricing.deliveryFee > 0) {
      message += `🚚 Frais de livraison: ${formatPrice(order.pricing.deliveryFee)} XAF\n`;
    }
    
    message += `💳 Total final: ${formatPrice(order.pricing.total)} XAF\n\n`;
    
    // Customer information
    message += `👤 Client: ${order.customerInfo.name}\n`;
    message += `📞 Téléphone: ${order.customerInfo.phone}\n`;
    message += `📍 Adresse: ${order.customerInfo.location}\n`;
    
    if (order.customerInfo.deliveryInstructions) {
      message += `📝 Instructions de livraison: ${order.customerInfo.deliveryInstructions}\n`;
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

  // Handle order creation
  const handleCreateOrder = async () => {
    if (!companyId) {
      toast.error('Company ID not found');
      return;
    }

    if (!selectedPaymentMethod) {
      toast.error('Veuillez sélectionner un mode de paiement');
      return;
    }

    if (!validateForm()) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }

    // Validate payment form data based on selected method and checkout settings
    if (checkoutSettings?.showPaymentSection) {
      if (selectedPaymentOption === 'mtn_money' && !customerInfo.phone.trim()) {
        toast.error('Veuillez entrer votre numéro MTN Mobile Money');
        return;
      }

      if (selectedPaymentOption === 'orange_money' && !customerInfo.phone.trim()) {
        toast.error('Veuillez entrer votre numéro Orange Money');
        return;
      }

      if (selectedPaymentOption === 'visa_card') {
        if (!paymentFormData.cardNumber.trim() || !paymentFormData.expiryDate.trim() || 
            !paymentFormData.securityCode.trim() || !paymentFormData.nameOnCard.trim()) {
          toast.error('Veuillez remplir tous les détails de la carte');
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
          returnUrl: `${window.location.origin}/catalogue/${company?.name?.toLowerCase().replace(/\s+/g, '-')}/${companyId}`,
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
          
          // Create order with CinetPay payment details
          const order = await createOrder(
            companyId!,
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
                userId: user?.uid || undefined, // Optional: Include userId if user is logged in
                createdBy: createdBy || undefined,
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
            if (company && companyId) {
              navigate(`/catalogue/${company.name.toLowerCase().replace(/\s+/g, '-')}/${companyId}`);
            } else {
              navigate('/');
            }
          }, 2000);
        } else {
          toast.error(paymentResult.error || 'Payment failed');
        }
        return;
      }

      // Check if this is a Campay payment (matching RestoFlow pattern)
      const isCampayPayment = selectedPaymentOption === 'campay';
      
      if (isCampayPayment) {
        // Validate that Campay SDK is initialized (matching RestoFlow)
        if (!isCampayInitialized) {
          toast.error('Payment system not configured. Please contact the company.');
          setSubmitting(false);
          return;
        }

        // Get Campay config for amount calculation
        let campayConfig = null;
        try {
          campayConfig = await getCampayConfig(companyId!);
        } catch (error) {
          console.error('Error fetching Campay config:', error);
        }

        // Calculate final total
        const calculatedTotal = getCartTotal() + (sellerSettings?.deliveryFee || 0);
        
        // Use 10 XAF for demo mode, otherwise use calculated total
        const finalTotal = campayConfig?.environment === 'demo' ? 10 : calculatedTotal;
        
        if (campayConfig?.environment === 'demo') {
          console.log(`[DEMO MODE] Using fixed amount: 10 XAF (Actual total: ${calculatedTotal} XAF)`);
        }

        // Validate amount limits if config is available
        if (campayConfig) {
          if (calculatedTotal < campayConfig.minAmount) {
            toast.error(`Minimum payment amount is ${campayConfig.minAmount} ${campayConfig.currency}`);
            setSubmitting(false);
            return;
          }
          if (calculatedTotal > campayConfig.maxAmount) {
            toast.error(`Maximum payment amount is ${campayConfig.maxAmount} ${campayConfig.currency}`);
            setSubmitting(false);
            return;
          }
        }

        // Process Campay payment (matching RestoFlow pattern)
        const externalReference = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const paymentOptions = {
          payButtonId: campayButtonId,
          description: `Order from ${company?.name || 'Store'}`,
          amount: finalTotal,
          currency: 'XAF',
          externalReference: externalReference,
          redirectUrl: `${window.location.origin}/catalogue/${company?.name?.toLowerCase().replace(/\s+/g, '-')}/${companyId}`
        };

        const paymentResult = await processCampayPayment(
          paymentOptions,
          // onSuccess callback (matching RestoFlow pattern)
          async (data) => {
            console.log('Campay payment successful:', data);
            
            // Get createdBy employee reference
            let createdBy = null;
            if (user && company) {
              let userData = null;
              if (isOwner && !currentEmployee) {
                try {
                  userData = await getUserById(user.uid);
                } catch (error) {
                  console.error('Error fetching user data for createdBy:', error);
                }
              }
              createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
            }
            
            // Create order with Campay payment details
            // In demo mode, use 10 XAF for payment but keep actual pricing for records
            const actualTotal = getCartTotal() + (sellerSettings?.deliveryFee || 0);
            const order = await createOrder(
              companyId!,
              {
                customerInfo: sanitizedCustomerInfo,
                cartItems: cart,
                pricing: {
                  subtotal: getCartTotal(),
                  deliveryFee: sellerSettings?.deliveryFee || 0,
                  total: campayConfig?.environment === 'demo' ? 10 : actualTotal
                },
                paymentMethod: 'campay',
                paymentOption: 'campay',
                paymentFormData: sanitizedPaymentFormData,
                deliveryInfo: {
                  method: 'delivery',
                  address: sanitizedCustomerInfo.location,
                  instructions: sanitizedCustomerInfo.deliveryInstructions
                },
                metadata: {
                  source: 'catalogue',
                  userId: user?.uid || undefined,
                  createdBy: createdBy || undefined,
                  deviceInfo: {
                    type: 'desktop',
                    os: navigator.platform,
                    browser: navigator.userAgent
                  }
                },
                campayPaymentDetails: {
                  reference: data.reference || '',
                  transactionId: data.transactionId || '',
                  campayStatus: data.status || 'SUCCESS',
                  status: data.status || 'SUCCESS',
                  paidAt: new Date(),
                  paymentMethod: data.paymentMethod || 'mobile_money',
                  amount: finalTotal,
                  currency: 'XAF',
                  metadata: {
                    externalReference: externalReference,
                    environment: campayConfig?.environment || 'production',
                    timestamp: new Date().toISOString()
                  }
                }
              }
            );

            setCreatedOrder(order);
            setOrderCreated(true);
            
            // Clear cart and saved data
            clearCart();
            clearCheckoutData();
            
            toast.success('Payment successful! Order created.');
            setSubmitting(false);
          },
          // onFail callback (matching RestoFlow pattern)
          (data) => {
            console.error('Campay payment failed:', data);
            // Check for demo amount limit error
            const errorMessage = data.message || '';
            if (errorMessage.includes('Maximum amount') || errorMessage.includes('ER201') || errorMessage.includes('demo system')) {
              const demoError = `Demo environment limit: Maximum amount is 10 XAF. Your order total is ${calculatedTotal} XAF. Please use production environment for larger amounts.`;
              toast.error(demoError, { duration: 6000 });
            } else {
              toast.error(data.message || 'Payment failed. Please try again.');
            }
            setSubmitting(false);
          },
          // onModalClose callback (matching RestoFlow pattern)
          () => {
            // User cancelled - no error message needed (matching RestoFlow)
            setSubmitting(false);
          }
        );

        // Note: The actual order creation happens in the onSuccess callback
        // This promise resolves when payment is processed
        if (!paymentResult) {
          // Payment was cancelled or failed - already handled in callbacks
          return;
        }
        
        // Payment initiated - modal should open
        return;
      }
      
      // Only proceed to regular payment methods if Campay is NOT selected
      if (company && !isCampayPayment) {
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
              createdBy: createdBy || undefined,
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
        
        // Handle WhatsApp redirect for pay_onsite orders
        if (selectedPaymentOption === 'pay_onsite' && company) {
          try {
            const message = generateOrderMessage(order, order.orderNumber);
            const companyPhone = company.phone || '';
            
            if (companyPhone) {
              const whatsappUrl = createWhatsAppUrl(companyPhone, message);
              // Open WhatsApp in new tab
              window.open(whatsappUrl, '_blank');
              toast.success('Order created successfully! WhatsApp confirmation sent.');
            } else {
              toast.success('Order created successfully! (WhatsApp number not configured)');
            }
          } catch (error) {
            console.error('Error generating WhatsApp message:', error);
            toast.success('Order created successfully! (WhatsApp message failed)');
          }
        } else {
          // Show success message for other payment methods
          toast.success('Order created successfully! Payment integration coming soon.');
        }
        
        // Redirect to catalogue page after a short delay
        setTimeout(() => {
          if (company && companyId) {
            navigate(`/catalogue/${company.name.toLowerCase().replace(/\s+/g, '-')}/${companyId}`);
          } else {
            navigate('/');
          }
        }, 2000);
      } else {
        // If Campay was selected but config is missing, show error
        if (isCampayPayment) {
          toast.error('Campay payment is not configured. Please contact support or select another payment method.');
          setSubmitting(false);
          return;
        }
        
        // If no company, show error
        toast.error('Company information not found. Please refresh the page.');
        setSubmitting(false);
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
              if (company && companyId) {
                navigate(`/catalogue/${company.name.toLowerCase().replace(/\s+/g, '-')}/${companyId}`);
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
              if (company && companyId) {
                navigate(`/catalogue/${company.name.toLowerCase().replace(/\s+/g, '-')}/${companyId}`);
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
                        Instructions de livraison (facultatif)
                      </label>
                      <textarea
                        value={customerInfo.deliveryInstructions}
                        onChange={(e) => handleInputChange('deliveryInstructions', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="Instructions spéciales pour la livraison..."
                        rows={3}
                      />
                    </div>
                  )}

                  {/* Shipping Method Section - Inside Delivery Card */}
                  {checkoutSettings?.showShippingMethod && (
                    <>
                      <div className="border-t border-gray-200 pt-4 mt-4">
                        <h3 className="text-lg font-bold mb-4" style={{color: getCompanyColors().primary}}>Mode de livraison</h3>
                        
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
                                  <p className="font-medium text-gray-900">Livraison standard</p>
                                  <p className="text-sm text-gray-600">3-5 jours ouvrables</p>
                                </div>
                              </div>
                              <span className="font-semibold text-gray-900">
                                {deliveryFee > 0 ? `${formatPrice(deliveryFee)} XAF` : 'À confirmer après commande'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* Right Column - Payment and Order Summary */}
          <div className="space-y-8">
            {/* Payment Section - Moved to Right Column */}
            {/* Show payment section if enabled OR if any payment integration (Campay/CinetPay) is configured */}
            {((checkoutSettings?.showPaymentSection) || 
              isCampayInitialized || 
              (cinetpayConfig && isCinetPayConfigured(cinetpayConfig))) && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-bold mb-4" style={{color: getCompanyColors().primary}}>{t('checkout.payment')}</h2>
                <p className="text-sm text-gray-600 mb-4">Toutes les transactions sont sécurisées et cryptées.</p>
                
                {/* Payment Options Container */}
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                  {/* MTN Money Option */}
                  {checkoutSettings && checkoutSettings.enabledPaymentMethods && checkoutSettings.enabledPaymentMethods.mtnMoney === true && (
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
                          Numéro MTN Mobile Money *
                        </label>
                        <input
                          type="tel"
                          value={paymentFormData.mtnNumber}
                          onChange={(e) => handlePaymentFormChange('mtnNumber', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                          placeholder="Entrez votre numéro MTN Mobile Money"
                        />
                      </div>
                    </div>
                  )}
                  </div>
                )}

                  {/* Orange Money Option */}
                  {checkoutSettings && checkoutSettings.enabledPaymentMethods && checkoutSettings.enabledPaymentMethods.orangeMoney === true && (
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
                              Numéro Orange Money *
                            </label>
                            <input
                              type="tel"
                              value={paymentFormData.orangeNumber}
                              onChange={(e) => handlePaymentFormChange('orangeNumber', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                              placeholder="Entrez votre numéro Orange Money"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Visa Card Option */}
                  {checkoutSettings && checkoutSettings.enabledPaymentMethods && checkoutSettings.enabledPaymentMethods.visaCard === true && (
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
                              Numéro de carte *
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
                                Date d'expiration (MM/AA) *
                              </label>
                              <input
                                type="text"
                                value={paymentFormData.expiryDate}
                                onChange={(e) => handlePaymentFormChange('expiryDate', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                                placeholder="MM/AA"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Code de sécurité *
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
                              Nom sur la carte *
                            </label>
                            <input
                              type="text"
                              value={paymentFormData.nameOnCard}
                              onChange={(e) => handlePaymentFormChange('nameOnCard', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                              placeholder="Entrez le nom tel qu'il apparaît sur la carte"
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
                                  <span className="font-medium text-sm">Paiement en ligne sécurisé</span>
                                </div>
                                <p className="text-sm text-blue-600">
                                  Payez en toute sécurité avec MTN Money ou Orange Money. Vous serez redirigé vers une page de paiement sécurisée.
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
                              <span className="font-medium text-gray-900">Carte de crédit (CinetPay)</span>
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
                                  <span className="font-medium text-sm">Paiement par carte sécurisé</span>
                                </div>
                                <p className="text-sm text-blue-600">
                                  Payez en toute sécurité avec Visa ou Mastercard. Vous serez redirigé vers une page de paiement sécurisée.
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
                              <span className="font-medium text-gray-900">Portefeuille numérique (CinetPay)</span>
                            </label>
                          </div>
                          
                          {/* CinetPay Wallet Form */}
                          {selectedPaymentOption === 'cinetpay_wallet' && (
                            <div className="mt-4 pl-8">
                              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                <div className="flex items-center space-x-2 text-purple-700 mb-2">
                                  <CreditCard className="h-4 w-4" />
                                  <span className="font-medium text-sm">Paiement par portefeuille numérique</span>
                                </div>
                                <p className="text-sm text-purple-600">
                                  Payez avec votre portefeuille numérique. Vous serez redirigé vers une page de paiement sécurisée.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Campay Payment Option */}
                  {isCampayInitialized && (
                    <div 
                      className={`p-4 border-t border-gray-200 transition-all duration-200 ${
                        selectedPaymentOption === 'campay' 
                          ? 'bg-emerald-50 border-l-4 border-l-emerald-500' 
                          : 'hover:bg-gray-50'
                      }`}
                      role="group"
                      aria-labelledby="campay-payment-label"
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="radio"
                          name="paymentMethod"
                          id="campay"
                          value="campay"
                          checked={selectedPaymentOption === 'campay'}
                          onChange={() => handlePaymentMethodSelect('campay')}
                          className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 cursor-pointer"
                          aria-labelledby="campay-payment-label"
                          aria-describedby="campay-payment-description"
                        />
                        <label 
                          htmlFor="campay" 
                          id="campay-payment-label"
                          className="flex items-center space-x-3 cursor-pointer flex-1"
                        >
                          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-sm transition-transform duration-200 hover:scale-105">
                            <span className="text-white font-bold text-sm">CP</span>
                          </div>
                          <div className="flex-1">
                            <span className="font-medium text-gray-900 block">MTN ou Orange Money</span>
                            <span className="text-xs text-gray-500 block mt-0.5">Paiement mobile</span>
                          </div>
                          {selectedPaymentOption === 'campay' && (
                            <div className="flex items-center text-emerald-600 animate-fade-in">
                              <Check className="h-5 w-5" aria-label="Selected" />
                            </div>
                          )}
                        </label>
                      </div>
                      
                      {/* Campay Payment Form */}
                      {selectedPaymentOption === 'campay' && (
                        <div 
                          className="mt-4 pl-8 animate-slide-down"
                          id="campay-payment-description"
                          role="region"
                          aria-labelledby="campay-payment-label"
                        >
                          <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-lg p-4 shadow-sm">
                            <div className="flex items-start space-x-3 mb-3">
                              <div className="flex-shrink-0 mt-0.5">
                                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                                  <CreditCard className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                                </div>
                              </div>
                              <div className="flex-1">
                                <h4 className="font-medium text-emerald-900 mb-1">Paiement sécurisé via Campay</h4>
                                <p className="text-sm text-emerald-700 leading-relaxed">
                                  Payez en toute sécurité avec MTN Mobile Money ou Orange Money.
                                </p>
                                <p className="text-sm text-emerald-700 leading-relaxed mt-2">
                                  Nom de confirmation de paiement: Tawind Group
                                </p>
                              </div>
                            </div>
                            
                            {/* Payment Methods Icons */}
                            <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-emerald-200">
                              <span className="text-xs text-emerald-600 font-medium">Méthodes acceptées:</span>
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 bg-yellow-500 rounded flex items-center justify-center" title="MTN Mobile Money">
                                  <span className="text-white text-xs font-bold">M</span>
                                </div>
                                <div className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center" title="Orange Money">
                                  <span className="text-white text-xs font-bold">O</span>
                                </div>
                              </div>
                            </div>
                            
                            {isCampayInitialized && (
                              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg animate-fade-in">
                                <div className="flex items-start">
                                  <div className="flex-shrink-0 mt-0.5">
                                    <span className="text-amber-600 text-sm" aria-label="Warning">⚠️</span>
                                  </div>
                                  <div className="flex-1 ml-2">
                                    <p className="text-xs text-amber-800 font-medium">Mode démo actif</p>
                                    <p className="text-xs text-amber-700 mt-0.5">
                                      Montant maximum: <strong>10 XAF</strong> par transaction. Pour des montants plus élevés, passez en mode production.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pay Onsite Option */}
                  {checkoutSettings && checkoutSettings.enabledPaymentMethods && checkoutSettings.enabledPaymentMethods.payOnsite === true && (
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
                              <span className="font-medium text-sm">Payer à la réception</span>
                            </div>
                            <p className="text-sm text-emerald-600">
                              Vous paierez lors de la réception de votre commande. Une confirmation WhatsApp sera envoyée avec les instructions de retrait.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* No payment methods available message */}
                  {(!checkoutSettings || !checkoutSettings.enabledPaymentMethods || checkoutSettings.enabledPaymentMethods.mtnMoney !== true) &&
                   (!checkoutSettings || !checkoutSettings.enabledPaymentMethods || checkoutSettings.enabledPaymentMethods.orangeMoney !== true) &&
                   (!checkoutSettings || !checkoutSettings.enabledPaymentMethods || checkoutSettings.enabledPaymentMethods.visaCard !== true) &&
                   (!checkoutSettings || !checkoutSettings.enabledPaymentMethods || checkoutSettings.enabledPaymentMethods.payOnsite !== true) &&
                   !(cinetpayConfig && isCinetPayConfigured(cinetpayConfig)) &&
                   !isCampayInitialized && (
                    <div className="p-4 text-center text-gray-500">
                      <p className="text-sm">Aucun mode de paiement disponible. Veuillez activer au moins un mode de paiement dans les paramètres.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Order Summary */}
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
                        {formatPrice(item.price * item.quantity)} XAF
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
                    {formatPrice(subtotal)} XAF
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Livraison</span>
                  <span className="font-medium">
                    {deliveryFee > 0 ? `${formatPrice(deliveryFee)} XAF` : 'À confirmer'}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>{t('checkout.orderSummaryDetails.total')}</span>
                    <span className="text-emerald-600">
                      {formatPrice(finalTotal)} XAF
                    </span>
                  </div>
                </div>
              </div>

              {/* Trust Badges */}
              {checkoutSettings?.showTrustBadges && (
                <div className="space-y-3 mb-6">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Lock className="h-4 w-4 text-yellow-500" />
                    <span>PAIEMENT SÉCURISÉ</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Shield className="h-4 w-4 text-yellow-500" />
                    <span>SERVICE CLIENT EXCEPTIONNEL</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <RotateCcw className="h-4 w-4 text-yellow-500" />
                    <span>RETOURS 14 JOURS</span>
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
                      Traitement en cours...
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
                        if (company && companyId) {
                          navigate(`/catalogue/${company.name.toLowerCase().replace(/\s+/g, '-')}/${companyId}`);
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

      {/* Hidden button for Campay SDK */}
      {isCampayInitialized && (
        <button
          id={campayButtonId}
          type="button"
          style={{ display: 'none' }}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default SingleCheckout;