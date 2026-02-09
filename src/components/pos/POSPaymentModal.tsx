import React, { useState, useEffect, useRef } from 'react';
import { X, CreditCard, Smartphone, DollarSign, ChevronDown, ChevronUp, User, Calendar, Truck, Percent, Printer, Receipt, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@contexts/AuthContext';
import { useCustomerSources } from '@hooks/business/useCustomerSources';
import { useProducts } from '@hooks/data/useFirestore';
import { useCheckoutSettings } from '@hooks/data/useCheckoutSettings';
import { printPOSBillDirect } from '@utils/pos/posPrint';
import { showErrorToast, showSuccessToast } from '@utils/core/toast';
import { formatPrice } from '@utils/formatting/formatPrice';
import { useCurrency } from '@hooks/useCurrency';
import { normalizePhoneForComparison } from '@utils/core/phoneUtils';
import { POSCalculator } from './POSCalculator';
import Select from 'react-select';
import { Input, PriceInput, ImageWithSkeleton, Select as CommonSelect } from '@components/common';
import type { OrderStatus, Customer } from '../../types/models';
import type { CartItem } from '@hooks/forms/usePOS';

export interface POSPaymentData {
  // Payment
  paymentMethod?: 'cash' | 'mobile_money' | 'card'; // Optional for credit sales
  amountReceived?: number;
  change?: number;
  transactionReference: string; // Empty string if not provided
  mobileMoneyPhone: string; // Empty string if not provided

  // Customer Info
  customerPhone: string; // Always string, can be empty
  customerName: string;
  customerQuarter: string; // Always string, can be empty
  customerSourceId: string; // Empty string if not provided
  customerAddress: string; // Empty string if not provided
  customerTown: string; // Empty string if not provided

  // Sale Info
  saleDate: string;
  deliveryFee: number;
  status: OrderStatus;
  inventoryMethod: 'fifo' | 'lifo' | 'cmup';
  creditDueDate?: string; // Optional due date for credit sales (ISO date string)

  // Additional
  discountType?: 'amount' | 'percentage';
  discountValue?: number;
  discountAmount?: number; // Calculated discount amount
  discountOriginalValue?: number; // Original discount value (for percentage display)
  promoCode: string; // Empty string if not provided
  tax?: number;
  notes: string; // Empty string if not provided
  printReceipt?: boolean;
}

interface POSPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtotal: number;
  currentDeliveryFee: number;
  cart: CartItem[];
  currentCustomer: {
    name: string;
    phone: string;
    quarter?: string;
    address?: string;
    town?: string;
    sourceId?: string;
  } | null;
  onComplete: (data: POSPaymentData) => Promise<any> | void;
  onSaveDraft?: (data: POSPaymentData) => void;
  isSubmitting: boolean;
  checkoutSettings?: {
    posCalculatorEnabled: boolean;
  } | null;
  customers?: Customer[];
  applyTVA?: boolean;
  tvaRate?: number;
  onTVAToggle?: (apply: boolean) => void;
  defaultInventoryMethod?: 'fifo' | 'lifo' | 'cmup'; // Method from POS state (from settings)
}

export const POSPaymentModal: React.FC<POSPaymentModalProps> = ({
  isOpen,
  onClose,
  subtotal,
  currentDeliveryFee,
  cart,
  currentCustomer,
  onComplete,
  onSaveDraft,
  isSubmitting,
  checkoutSettings,
  customers,
  applyTVA = false,
  tvaRate = 19.25,
  onTVAToggle,
  defaultInventoryMethod,
}) => {
  // ✅ ALL HOOKS MUST BE CALLED FIRST - BEFORE ANY CONDITIONAL RETURNS
  const { t } = useTranslation();
  const { company } = useAuth();
  const { format, currency } = useCurrency();
  const { activeSources } = useCustomerSources();
  const { products } = useProducts();
  const { settings: checkoutSettingsData } = useCheckoutSettings();

  // State for logo base64
  const [logoBase64, setLogoBase64] = useState<string>('');

  // State for all form fields
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile_money' | 'card' | null>(null);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [transactionReference, setTransactionReference] = useState<string>('');
  const [mobileMoneyPhone, setMobileMoneyPhone] = useState<string>('');

  // Customer Info
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerQuarter, setCustomerQuarter] = useState<string>('');
  const [customerSourceId, setCustomerSourceId] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [customerTown, setCustomerTown] = useState<string>('');

  // Customer search state
  const [showCustomerDropdown, setShowCustomerDropdown] = useState<boolean>(false);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
  const [activeSearchField, setActiveSearchField] = useState<'phone' | 'name' | null>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Sale Info
  const [saleDate, setSaleDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [deliveryFee, setDeliveryFee] = useState<number>(currentDeliveryFee);
  const [status, setStatus] = useState<OrderStatus>('paid');
  const [saleType, setSaleType] = useState<'paid' | 'credit'>('paid'); // Sale type: paid or credit
  const [creditDueDate, setCreditDueDate] = useState<string>(''); // Optional due date for credit sales

  // Get default inventory method: use prop from POS state first, then settings, then fallback
  const getDefaultInventoryMethod = (): 'fifo' | 'lifo' | 'cmup' => {
    if (defaultInventoryMethod) {
      return defaultInventoryMethod;
    }
    const defaultMethod = checkoutSettingsData?.defaultInventoryMethod || 'FIFO';
    return defaultMethod.toLowerCase() as 'fifo' | 'lifo' | 'cmup';
  };

  const [inventoryMethod, setInventoryMethod] = useState<'fifo' | 'lifo' | 'cmup'>(getDefaultInventoryMethod());

  // Update inventory method when prop or settings change
  useEffect(() => {
    if (defaultInventoryMethod) {
      setInventoryMethod(defaultInventoryMethod);
    } else if (checkoutSettingsData?.defaultInventoryMethod) {
      const defaultMethod = checkoutSettingsData.defaultInventoryMethod.toLowerCase() as 'fifo' | 'lifo' | 'cmup';
      setInventoryMethod(defaultMethod);
    }
  }, [defaultInventoryMethod, checkoutSettingsData?.defaultInventoryMethod]);

  // Reset inventory method to default when modal opens
  useEffect(() => {
    if (isOpen) {
      const methodToUse = defaultInventoryMethod || getDefaultInventoryMethod();
      setInventoryMethod(methodToUse);
    }
  }, [isOpen, defaultInventoryMethod]);

  // Additional
  const [discountType, setDiscountType] = useState<'amount' | 'percentage'>('amount');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [promoCode, setPromoCode] = useState<string>('');
  const [tax, setTax] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [printReceipt, setPrintReceipt] = useState<boolean>(false);

  // UI State
  const [showCustomerSection, setShowCustomerSection] = useState<boolean>(false);
  const [showSaleInfoSection, setShowSaleInfoSection] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'calculator' | 'additional'>(
    checkoutSettings?.posCalculatorEnabled ? 'calculator' : 'additional'
  ); // Default to calculator if enabled, otherwise additional
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [completedSale, setCompletedSale] = useState<any>(null); // Store completed sale for preview
  const [hasAutoPrinted, setHasAutoPrinted] = useState(false); // Track if auto-print has been triggered
  const printFromPreviewRef = useRef<(() => void) | null>(null); // Ref to store handlePrintFromPreview function

  // Handle tab state when calculator is disabled
  useEffect(() => {
    if (!checkoutSettings?.posCalculatorEnabled && activeTab === 'calculator') {
      // If calculator is disabled and current tab is calculator, switch to additional
      setActiveTab('additional');
    }
  }, [checkoutSettings?.posCalculatorEnabled, activeTab]);

  // Get company colors
  const getCompanyColors = () => {
    const colors = {
      primary: company?.dashboardColors?.primary || company?.primaryColor || '#183524',
      secondary: company?.dashboardColors?.secondary || company?.secondaryColor || '#e2b069',
      tertiary: company?.dashboardColors?.tertiary || company?.tertiaryColor || '#2a4a3a'
    };
    return colors;
  };

  const colors = getCompanyColors();

  // Load company logo as base64 for consistent display
  useEffect(() => {
    const loadLogo = async () => {
      if (!company?.logo) {
        setLogoBase64('');
        return;
      }

      try {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = img.width;
          canvas.height = img.height;
          ctx?.drawImage(img, 0, 0);
          const base64 = canvas.toDataURL('image/png');
          setLogoBase64(base64);
        };
        img.onerror = () => setLogoBase64('');
        img.src = company.logo;
      } catch (error) {
        console.warn('Failed to load company logo:', error);
        setLogoBase64('');
      }
    };

    loadLogo();
  }, [company?.logo]);

  // Reset all form fields when modal opens or closes
  const resetForm = () => {
    setPaymentMethod(null);
    setAmountReceived('');
    setTransactionReference('');
    setMobileMoneyPhone('');
    setCustomerPhone('');
    setCustomerName('');
    setCustomerQuarter('');
    setCustomerSourceId('');
    setCustomerAddress('');
    setCustomerTown('');
    setSaleDate(new Date().toISOString().slice(0, 10));
    setDeliveryFee(currentDeliveryFee);
    setStatus('paid');
    setSaleType('paid');
    setCreditDueDate('');
    setInventoryMethod(getDefaultInventoryMethod());
    setDiscountType('amount');
    setDiscountValue('');
    setPromoCode('');
    setTax('');
    setNotes('');
    setPrintReceipt(false);
    setShowCustomerSection(false);
    setShowSaleInfoSection(false);
    setActiveTab(checkoutSettings?.posCalculatorEnabled ? 'calculator' : 'additional');
    setCompletedSale(null);
    setIsProcessingPayment(false);
    setHasAutoPrinted(false);
    printFromPreviewRef.current = null;
    setShowCustomerDropdown(false);
    setFoundCustomer(null);
    setCustomerSearch('');
    setActiveSearchField(null);
  };

  // Initialize form with current customer data when modal opens
  // Reset form only when modal opens/closes, not when dependencies change
  useEffect(() => {
    if (isOpen && !completedSale) {
      // Modal just opened and no sale completed yet - reset form
      resetForm();

      // Populate customer data if available
      if (currentCustomer) {
        setCustomerPhone(currentCustomer.phone || '');
        setCustomerName(currentCustomer.name || '');
        setCustomerQuarter(currentCustomer.quarter || '');
        setCustomerSourceId(currentCustomer.sourceId || '');
        setCustomerAddress(currentCustomer.address || '');
        setCustomerTown(currentCustomer.town || '');
      }
    } else if (!isOpen) {
      // Modal closed - always reset
      resetForm();
    }
  }, [isOpen]); // Only depend on isOpen, not on currentCustomer or currentDeliveryFee

  // Separate effect to update customer fields when customer changes (but don't reset form)
  useEffect(() => {
    if (isOpen && currentCustomer && !completedSale) {
      // Only update customer fields, don't reset entire form
      setCustomerPhone(currentCustomer.phone || '');
      setCustomerName(currentCustomer.name || '');
      setCustomerQuarter(currentCustomer.quarter || '');
      setCustomerSourceId(currentCustomer.sourceId || '');
      setCustomerAddress(currentCustomer.address || '');
      setCustomerTown(currentCustomer.town || '');
    }
  }, [currentCustomer, isOpen, completedSale]);

  // Click outside handler for customer dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showCustomerDropdown) {
        const target = event.target as Node;
        const isPhoneInputClick = phoneInputRef.current?.contains(target);
        const isNameInputClick = nameInputRef.current?.contains(target);
        const isDropdownClick = (event.target as Element).closest('[data-dropdown="customer"]');

        // Hide dropdown if click is outside both input fields and dropdown
        if (!isPhoneInputClick && !isNameInputClick && !isDropdownClick) {
          setShowCustomerDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCustomerDropdown]);

  // Auto-print when invoice preview is shown
  // This useEffect must be before the conditional return to respect React hooks rules
  useEffect(() => {
    // Only execute if modal is open and we have all required data
    if (!isOpen || !completedSale || hasAutoPrinted || isProcessingPayment || !company || !printFromPreviewRef.current) {
      return;
    }

    // Small delay to ensure the preview is fully rendered
    const timer = setTimeout(() => {
      if (printFromPreviewRef.current) {
        printFromPreviewRef.current();
        setHasAutoPrinted(true);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [isOpen, completedSale, hasAutoPrinted, isProcessingPayment, company]);

  // ✅ NOW we can do conditional return AFTER all hooks
  if (!isOpen) return null;

  // Calculate totals
  const discountAmount = discountValue ? (
    discountType === 'amount'
      ? parseFloat(discountValue)
      : (subtotal * parseFloat(discountValue)) / 100
  ) : 0;

  // Calculate tax amount (other taxes, not TVA)
  const taxAmount = tax ? parseFloat(tax) : 0;

  // Calculate TVA amount
  const tvaAmount = applyTVA ? (subtotal * (tvaRate / 100)) : 0;

  // Calculate total: subtotal + deliveryFee - discount + TVA + other tax
  const total = subtotal + (completedSale?.deliveryFee || 0) - discountAmount + tvaAmount + taxAmount;
  // Calculate change: if no amount received entered, assume exact amount (change = 0)
  // If amount received > total, calculate change
  const change = paymentMethod === 'cash' && amountReceived && parseFloat(amountReceived) > total
    ? Math.max(0, parseFloat(amountReceived) - total)
    : 0;

  const handleComplete = async () => {
    // For credit sales, skip payment method validation
    if (saleType === 'credit') {
      // Validate credit sales: require customer name only (phone and quarter are optional)
      if (!customerName || customerName.trim() === '') {
        showErrorToast(t('sales.messages.errors.customerNameRequiredForCredit') || 'Customer name is required for credit sales');
        return;
      }
    } else {
      // For paid sales, require payment method
      if (!paymentMethod) {
        showErrorToast(t('pos.payment.errors.selectMethod') || 'Please select a payment method');
        return;
      }

      // For cash payment: if amount received is entered, it must be >= total
      // If no amount received entered, assume exact amount (no change needed)
      if (paymentMethod === 'cash' && amountReceived) {
        const received = parseFloat(amountReceived);
        if (isNaN(received) || received < total) {
          showErrorToast(t('pos.payment.errors.insufficientAmount') || 'Insufficient amount received');
          return;
        }
      }

      if (paymentMethod === 'mobile_money' && !mobileMoneyPhone) {
        showErrorToast(t('pos.payment.errors.mobileMoneyPhone') || 'Mobile Money phone number is required');
        return;
      }
    }

    const paymentData: POSPaymentData = {
      paymentMethod: saleType === 'credit' ? undefined : (paymentMethod ?? undefined), // No payment method for credit
      amountReceived: saleType === 'paid' && paymentMethod === 'cash' && amountReceived && amountReceived.trim() !== ''
        ? parseFloat(amountReceived)
        : undefined,
      change: saleType === 'paid' && paymentMethod === 'cash' ? change : undefined,
      transactionReference: saleType === 'paid' && paymentMethod !== 'cash' ? (transactionReference || '') : '',
      mobileMoneyPhone: saleType === 'paid' && paymentMethod === 'mobile_money' ? (mobileMoneyPhone || '') : '',
      customerPhone: customerPhone || '',
      customerName: customerName || t('pos.payment.walkInCustomer'),
      customerQuarter: customerQuarter || '',
      customerSourceId: customerSourceId || '',
      customerAddress: customerAddress || '',
      customerTown: customerTown || '',
      saleDate,
      deliveryFee,
      status: saleType === 'credit' ? 'credit' : status,
      inventoryMethod,
      creditDueDate: saleType === 'credit' && creditDueDate ? creditDueDate : undefined,
      // Simplified discount data - save exactly what we have
      discountType: discountAmount > 0 ? discountType : undefined,
      discountValue: discountAmount > 0 ? parseFloat(discountValue) : undefined,
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      discountOriginalValue: discountAmount > 0 ? parseFloat(discountValue) : undefined,
      promoCode: promoCode || '',
      tax: applyTVA ? (subtotal * (tvaRate / 100)) : (tax ? parseFloat(tax) : undefined),
      notes: notes || '',
      printReceipt,
    };

    // Show loading state
    setIsProcessingPayment(true);

    try {
      // Call onComplete and wait for the sale to be created
      const sale = await onComplete(paymentData);

      // WORKAROUND: If backend ignored discount data, manually add it to the sale object
      if (sale && discountAmount > 0 && !sale.discountAmount) {
        sale.discountAmount = discountAmount;
        sale.discountType = discountType;
        sale.discountValue = parseFloat(discountValue);
        sale.discountOriginalValue = parseFloat(discountValue);

        // Recalculate total if backend got it wrong
        const expectedTotal = subtotal + deliveryFee - discountAmount + (tax ? parseFloat(tax) : 0);
        if (sale.totalAmount !== expectedTotal) {
          sale.totalAmount = expectedTotal;
        }
      }

      // Success notification
      showSuccessToast(t('pos.payment.paymentSuccess') || 'Payment completed successfully!');

      // Store completed sale for preview
      if (sale) {
        setCompletedSale(sale);
      }
    } catch (error) {
      console.error('Error completing payment:', error);
      setIsProcessingPayment(false);
    }
    // Note: isProcessingPayment will be set to false when showing the preview
  };

  // Handle save draft
  const handleSaveDraft = () => {
    if (cart.length === 0) {
      showErrorToast(t('pos.messages.emptyCart'));
      return;
    }

    // Get all form data (even if incomplete)
    const paymentData: POSPaymentData = {
      paymentMethod: paymentMethod || 'cash', // Default to cash for draft
      // For cash: if amount received is entered, use it; otherwise use total (exact amount)
      amountReceived: paymentMethod === 'cash'
        ? (amountReceived ? parseFloat(amountReceived) : total)
        : undefined,
      change: paymentMethod === 'cash' ? change : undefined,
      transactionReference: paymentMethod !== 'cash' ? (transactionReference || '') : '',
      mobileMoneyPhone: paymentMethod === 'mobile_money' ? (mobileMoneyPhone || '') : '',
      customerPhone: customerPhone || '',
      customerName: customerName || currentCustomer?.name || t('pos.payment.walkInCustomer'),
      customerQuarter: customerQuarter || currentCustomer?.quarter || '',
      customerSourceId: customerSourceId || currentCustomer?.sourceId || '',
      customerAddress: customerAddress || currentCustomer?.address || '',
      customerTown: customerTown || currentCustomer?.town || '',
      saleDate,
      deliveryFee,
      status: 'draft' as OrderStatus,
      inventoryMethod,
      discountType: discountValue ? discountType : undefined,
      discountValue: discountValue ? parseFloat(discountValue) : undefined,
      discountAmount: discountAmount,
      discountOriginalValue: discountValue ? parseFloat(discountValue) : undefined,
      promoCode: promoCode || '',
      tax: tax ? parseFloat(tax) : undefined,
      notes: notes || '',
      printReceipt: false,
    };

    if (onSaveDraft) {
      onSaveDraft(paymentData);
      onClose();
    }
  };

  // Handle print bill
  const handlePrintBill = async () => {
    if (!company) {
      showErrorToast(t('pos.payment.printError') || 'Company information not available');
      return;
    }

    if (cart.length === 0) {
      showErrorToast(t('pos.payment.printError') || 'No products to print');
      return;
    }

    try {
      setIsPrinting(true);

      // Calculate discount amount
      let discountAmount = 0;
      if (discountValue) {
        const discountNum = parseFloat(discountValue);
        if (discountType === 'percentage') {
          // Calculate percentage discount
          discountAmount = (subtotal * discountNum) / 100;
        } else {
          // Fixed amount discount
          discountAmount = discountNum;
        }
      }

      // Calculate tax amount
      const taxAmount = tax ? parseFloat(tax) : 0;

      // Build temporary sale object from cart
      const tempSale = {
        id: `temp - ${Date.now()} `,
        products: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          basePrice: item.product.sellingPrice,
          negotiatedPrice: item.negotiatedPrice ?? item.product.sellingPrice,
        })),
        totalAmount: subtotal + deliveryFee - discountAmount + taxAmount,
        customerInfo: {
          name: customerName || currentCustomer?.name || 'Walk-in Customer',
          phone: customerPhone || currentCustomer?.phone || '',
          quarter: customerQuarter || currentCustomer?.quarter || '',
        },
        deliveryFee: deliveryFee,
        discountType: discountType,
        discountValue: discountAmount,
        discountOriginalValue: discountValue ? parseFloat(discountValue) : undefined,
        tax: taxAmount,
        paymentMethod: paymentMethod,
        amountReceived: paymentMethod === 'cash' && amountReceived ? parseFloat(amountReceived) : undefined,
        createdAt: { seconds: Math.floor(new Date(saleDate).getTime() / 1000), nanoseconds: 0 },
      };

      // Use direct print (browser print dialog)
      printPOSBillDirect(tempSale as any, products || [], company, paymentMethod || undefined);
    } catch (error) {
      console.error('Error printing bill:', error);
      showErrorToast(t('pos.payment.printError') || 'Failed to print bill');
    } finally {
      setIsPrinting(false);
    }
  };

  // Handle customer phone change with search functionality
  const handleCustomerPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomerPhone(value);
    setCustomerSearch(value);
    setActiveSearchField('phone');

    // Show dropdown if there's input and customers exist
    if (value && customers && customers.length > 0) {
      setShowCustomerDropdown(true);
    } else {
      setShowCustomerDropdown(false);
    }
  };

  // Handle customer name change with search functionality
  const handleCustomerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomerName(value);
    setCustomerSearch(value);
    setActiveSearchField('name');

    // Show dropdown if there's input and customers exist
    if (value && customers && customers.length > 0) {
      setShowCustomerDropdown(true);
    } else {
      setShowCustomerDropdown(false);
    }
  };

  // Handle customer selection from dropdown
  const handleSelectCustomer = (customer: Customer) => {
    setCustomerPhone(customer.phone || '');
    setCustomerName(customer.name || '');
    setCustomerQuarter(customer.quarter || '');
    setCustomerSourceId(customer.customerSourceId || '');
    setCustomerAddress(customer.address || '');
    setCustomerTown(customer.town || '');
    setFoundCustomer(customer);
    setShowCustomerDropdown(false);
    setCustomerSearch('');
    setActiveSearchField(null);
  };

  // Handle print from preview - print directly without opening new tab
  const handlePrintFromPreview = () => {
    if (!completedSale || !company) return;

    // Helper function to convert image to base64 for print compatibility
    const getImageAsBase64 = (url: string): Promise<string> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = img.width;
          canvas.height = img.height;
          ctx?.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve('');
        img.src = url;
      });
    };

    // Load logo as base64 if available
    const loadLogo = async (): Promise<string> => {
      if (!company.logo) return '';
      try {
        const base64 = await getImageAsBase64(company.logo);
        return base64;
      } catch (error) {
        console.warn('Failed to load logo for printing:', error);
        return '';
      }
    };

    // Load logo and create print content
    loadLogo().then((logoBase64) => {
      // Create a hidden iframe for printing
      const printIframe = document.createElement('iframe');
      printIframe.style.position = 'absolute';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = 'none';
      printIframe.style.left = '-9999px';

      if (document.body) {
        document.body.appendChild(printIframe);
      }

      // Flag to ensure we only print once
      let hasPrinted = false;

      const printOnce = () => {
        if (hasPrinted || !printIframe.contentWindow) return;
        hasPrinted = true;
        printIframe.contentWindow.print();
        // Remove iframe after printing
        setTimeout(() => {
          if (printIframe.parentNode) {
            document.body.removeChild(printIframe);
          }
        }, 1000);
      };

      // Build invoice HTML content with logo
      const invoiceContent = `
  < !DOCTYPE html >
    <html>
      <head>
        <title>Invoice - ${completedSale.id || 'N/A'}</title>
        <style>
          @media print {
            @page {
            margin: 1cm;
                }
              }
          body {
            font - family: 'Arial', sans-serif;
          font-size: 12px;
          padding: 20px;
          margin: 0;
              }
        </style>
      </head>
      <body>
        <div style="width: 80mm; margin: 0 auto; padding: 10px;">
          ${logoBase64 ? `<div style="text-align: center; margin-bottom: 10px;"><img src="${logoBase64}" alt="${company.name || 'Company Logo'}" style="max-width: 60px; max-height: 40px; object-fit: contain;" /></div>` : ''}
          <h2 style="text-align: center; margin-bottom: 10px;">${company.name}</h2>
          <p style="text-align: center; margin-bottom: 5px;">${company.location || ''}</p>
          <p style="text-align: center; margin-bottom: 15px;">Tel: ${company.phone || ''}</p>
          <p><strong>Date:</strong> ${completedSale.createdAt?.seconds
          ? new Date(completedSale.createdAt.seconds * 1000).toLocaleString()
          : new Date().toLocaleString()}</p>
          <p><strong>Client:</strong> ${completedSale.customerInfo?.name || 'Walk-in Customer'}</p>
          ${completedSale.customerInfo?.phone ? `<p><strong>Téléphone:</strong> ${completedSale.customerInfo.phone}</p>` : ''}
          <p><strong>Facture ID:</strong> ${completedSale.id || completedSale.orderNumber || 'N/A'}</p>
          <hr style="border-top: 1px dashed #000; margin: 10px 0;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
              <thead>
                <tr>
                  <th style="text-align: left; padding: 2px 0;">Produit</th>
                  <th style="text-align: right; padding: 2px 0;">Qté</th>
                  <th style="text-align: right; padding: 2px 0;">Prix</th>
                  <th style="text-align: right; padding: 2px 0;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${completedSale.products?.map((item: any) => {
            const product = products?.find((p: any) => p.id === item.productId);
            const productName = product ? product.name : 'Unknown Product';
            const itemPrice = item.negotiatedPrice || item.basePrice;
            return `
                      <tr>
                        <td style="text-align: left; padding: 2px 0;">${productName}</td>
                        <td style="text-align: right; padding: 2px 0;">${item.quantity}</td>
                        <td style="text-align: right; padding: 2px 0;">${format(itemPrice)}</td>
                        <td style="text-align: right; padding: 2px 0;">${format(itemPrice * item.quantity)}</td>
                      </tr>
                    `;
          }).join('')}
              </tbody>
            </table>
            <hr style="border-top: 1px dashed #000; margin: 10px 0;">
              <p style="text-align: right;"><strong>Sous-total:</strong> ${(() => {
          // Calculate subtotal from completed sale products instead of current cart
          const saleSubtotal = completedSale.products?.reduce((sum: number, item: any) => {
            const itemPrice = item.negotiatedPrice || item.basePrice;
            return sum + (itemPrice * item.quantity);
          }, 0) || 0;
          return format(saleSubtotal);
        })()}</p>
              ${completedSale.deliveryFee > 0 ? `<p style="text-align: right;"><strong>Frais de livraison:</strong> ${format(completedSale.deliveryFee)}</p>` : ''}
              ${(() => {
          // Calculate discount from completed sale data
          const saleSubtotal = completedSale.products?.reduce((sum: number, item: any) => {
            const itemPrice = item.negotiatedPrice || item.basePrice;
            return sum + (itemPrice * item.quantity);
          }, 0) || 0;

          const saleDiscountAmount = completedSale.discountAmount || 0;
          const saleDiscountType = completedSale.discountType;
          const saleDiscountOriginalValue = completedSale.discountOriginalValue;
          const saleDiscountValue = completedSale.discountValue;

          const hasDiscount = saleDiscountAmount > 0 || saleDiscountValue > 0;

          if (hasDiscount) {
            let displayAmount = saleDiscountAmount;
            let displayType = saleDiscountType;
            let displayOriginalValue = saleDiscountOriginalValue;

            if (!displayAmount && saleDiscountValue) {
              displayType = saleDiscountType || 'amount';
              displayOriginalValue = saleDiscountType === 'percentage' ? parseFloat(saleDiscountValue) : undefined;

              if (saleDiscountType === 'percentage' && displayOriginalValue) {
                displayAmount = (saleSubtotal * displayOriginalValue) / 100;
              } else {
                displayAmount = parseFloat(saleDiscountValue) || 0;
              }
            }

            if (displayAmount && displayAmount > 0) {
              return `<p style="text-align: right;"><strong>Remise ${displayType === 'percentage' && displayOriginalValue ? `(${displayOriginalValue}%)` : ''}:</strong> -${format(displayAmount)}</p>`;
            }
          }
          return '';
        })()}
              ${(() => {
          // Calculate tax from completed sale data
          const saleTaxAmount = completedSale.tax || 0;
          return saleTaxAmount > 0 ? `<p style="text-align: right;"><strong>Taxe/TVA${applyTVA ? ` (${tvaRate}%)` : ''}:</strong> ${format(saleTaxAmount)}</p>` : '';
        })()}
              <h3 style="text-align: right; margin-top: 10px;">Total: ${format(completedSale.totalAmount || total)}</h3>
              ${paymentMethod === 'cash' && amountReceived && parseFloat(amountReceived) !== (completedSale.totalAmount || total) ? `<p style="text-align: right;"><strong>Montant reçu:</strong> ${format(parseFloat(amountReceived))}</p>` : ''}
              ${(() => {
          if (paymentMethod === 'cash' && amountReceived) {
            const actualTotal = completedSale.totalAmount || total;
            const received = parseFloat(amountReceived);
            const calculatedChange = received > actualTotal ? Math.max(0, received - actualTotal) : 0;
            return calculatedChange > 0 ? `<p style="text-align: right;"><strong>Monnaie:</strong> ${format(calculatedChange)}</p>` : '';
          }
          return '';
        })()}
              ${paymentMethod === 'cash' && (!amountReceived || parseFloat(amountReceived) === (completedSale.totalAmount || total)) ? `<p style="text-align: right;"><strong>Montant:</strong> ${format(completedSale.totalAmount || total)} (exact)</p>` : ''}
              <p style="text-align: right;"><strong>Méthode:</strong> ${completedSale?.status === 'credit' ? 'Crédit' : paymentMethod === 'cash' ? 'Espèces' : paymentMethod === 'mobile_money' ? 'Mobile Money' : paymentMethod === 'card' ? 'Carte' : ''}</p>
              <hr style="border-top: 1px dashed #000; margin: 10px 0;">
                ${completedSale.notes ? `<p style="margin-top: 10px;"><strong>Notes:</strong> ${completedSale.notes}</p>` : ''}
                <p style="text-align: center; margin-top: 15px;">Merci de votre achat!</p>
              </div>
            </body>
          </html>
          `;

      // Write content to iframe
      const iframeDoc = printIframe.contentDocument || printIframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(invoiceContent);
        iframeDoc.close();

        // Wait for content to load, then print
        printIframe.onload = () => {
          setTimeout(() => {
            printOnce();
          }, 250);
        };

        // Fallback: if onload doesn't fire, trigger print after a delay
        setTimeout(() => {
          printOnce();
        }, 1000);
      }

      showSuccessToast(t('pos.payment.printSuccess') || 'Bill printed successfully');
    }).catch((error) => {
      console.error('Error loading logo for printing:', error);
      showErrorToast(t('pos.payment.printError') || 'Failed to print bill');
    });
  };

  // Store handlePrintFromPreview in ref so it can be called from useEffect
  printFromPreviewRef.current = handlePrintFromPreview;

  // Handle close from preview
  const handleCloseFromPreview = () => {
    resetForm(); // Reset all form fields
    onClose(); // Close modal
  };

  // Show invoice preview if sale is completed
  if (completedSale) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-2">
        <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-2 my-2 max-h-[95vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <h2 className="text-2xl font-semibold">{t('pos.payment.invoicePreview')}</h2>
            <button
              onClick={handleCloseFromPreview}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Invoice Preview Content */}
          <div className="flex-1 overflow-y-auto pr-2">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              {/* Invoice Header */}
              <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-gray-300">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    {logoBase64 && (
                      <img
                        src={logoBase64}
                        alt={`${company?.name} Logo`}
                        className="h-12 w-12 object-contain rounded"
                      />
                    )}
                    <h3 className="text-2xl font-bold" style={{ color: colors.primary }}>
                      {company?.name || ''}
                    </h3>
                  </div>
                  {company?.location && <p className="text-sm text-gray-600">{company.location}</p>}
                  {company?.phone && <p className="text-sm text-gray-600">{t('common.phone')}: {company.phone}</p>}
                  {company?.email && <p className="text-sm text-gray-600">{t('common.email')}: {company.email}</p>}
                </div>
                <div className="text-right">
                  <h4 className="text-xl font-bold mb-2">{t('pos.payment.invoice')}</h4>
                  <p className="text-sm text-gray-600">{t('pos.payment.invoiceNumber')}: {completedSale.id || completedSale.orderNumber || 'N/A'}</p>
                  <p className="text-sm text-gray-600">
                    {t('pos.payment.date')}: {completedSale.createdAt?.seconds
                      ? new Date(completedSale.createdAt.seconds * 1000).toLocaleDateString()
                      : new Date().toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Customer Info */}
              <div className="mb-6">
                <h5 className="font-semibold mb-2">{t('pos.payment.customerInfo')}</h5>
                <div className="text-sm text-gray-700">
                  <p><strong>{t('pos.payment.customerName')}:</strong> {completedSale.customerInfo?.name || t('pos.payment.walkInCustomer')}</p>
                  {completedSale.customerInfo?.phone && (
                    <p><strong>{t('pos.payment.customerPhone')}:</strong> {completedSale.customerInfo.phone}</p>
                  )}
                  {completedSale.customerInfo?.quarter && (
                    <p><strong>{t('pos.payment.customerQuarter')}:</strong> {completedSale.customerInfo.quarter}</p>
                  )}
                </div>
              </div>

              {/* Products Table */}
              <div className="mb-6">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="text-left py-2 px-3 font-semibold">{t('pos.payment.product')}</th>
                      <th className="text-center py-2 px-3 font-semibold">{t('pos.payment.quantity')}</th>
                      <th className="text-right py-2 px-3 font-semibold">{t('pos.payment.unitPrice')}</th>
                      <th className="text-right py-2 px-3 font-semibold">{t('pos.payment.total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedSale.products?.map((saleProduct: any, index: number) => {
                      const product = products?.find((p: any) => p.id === saleProduct.productId);
                      const unitPrice = saleProduct.negotiatedPrice || saleProduct.basePrice;
                      const itemTotal = unitPrice * saleProduct.quantity;
                      return (
                        <tr key={index} className="border-b border-gray-200">
                          <td className="py-2 px-3">{product?.name || 'Unknown Product'}</td>
                          <td className="text-center py-2 px-3">{saleProduct.quantity}</td>
                          <td className="text-right py-2 px-3">{format(unitPrice)}</td>
                          <td className="text-right py-2 px-3 font-semibold">{format(itemTotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="border-t-2 border-gray-300 pt-4">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    {(() => {
                      // Calculate subtotal from completed sale products once and reuse
                      const saleSubtotal = completedSale.products?.reduce((sum: number, item: any) => {
                        const itemPrice = item.negotiatedPrice || item.basePrice;
                        return sum + (itemPrice * item.quantity);
                      }, 0) || 0;

                      return (
                        <>
                          <div className="flex justify-between text-sm">
                            <span>{t('pos.payment.subtotal')}:</span>
                            <span>{format(saleSubtotal)}</span>
                          </div>
                          {completedSale.deliveryFee > 0 && (
                            <div className="flex justify-between text-sm">
                              <span>{t('pos.payment.deliveryFee')}:</span>
                              <span>{format(completedSale.deliveryFee)}</span>
                            </div>
                          )}
                          {(() => {
                            const saleDiscountAmount = completedSale.discountAmount || 0;
                            const saleDiscountType = completedSale.discountType;
                            const saleDiscountOriginalValue = completedSale.discountOriginalValue;
                            const saleDiscountValue = completedSale.discountValue;

                            const hasDiscount = saleDiscountAmount > 0 || saleDiscountValue > 0;

                            if (hasDiscount) {
                              let displayAmount = saleDiscountAmount;
                              let displayType = saleDiscountType;
                              let displayOriginalValue = saleDiscountOriginalValue;

                              if (!displayAmount && saleDiscountValue) {
                                displayType = saleDiscountType || 'amount';
                                displayOriginalValue = saleDiscountType === 'percentage' ? parseFloat(saleDiscountValue) : undefined;

                                if (saleDiscountType === 'percentage' && displayOriginalValue) {
                                  displayAmount = (saleSubtotal * displayOriginalValue) / 100;
                                } else {
                                  displayAmount = parseFloat(saleDiscountValue) || 0;
                                }
                              }

                              if (displayAmount && displayAmount > 0) {
                                return (
                                  <div className="flex justify-between text-sm text-red-600">
                                    <span>{t('pos.payment.discount')} {displayType === 'percentage' && displayOriginalValue ? `(${displayOriginalValue}%)` : ''}:</span>
                                    <span>-{format(displayAmount)}</span>
                                  </div>
                                );
                              }
                            }
                            return null;
                          })()}
                          {(() => {
                            // Calculate tax from completed sale data
                            const saleTaxAmount = completedSale.tax || 0;
                            return saleTaxAmount > 0 ? (
                              <div className="flex justify-between text-sm">
                                <span>{t('pos.payment.tax')}{applyTVA ? ` (${tvaRate}%)` : ''}:</span>
                                <span>{format(saleTaxAmount)}</span>
                              </div>
                            ) : null;
                          })()}
                        </>
                      );
                    })()}
                    <div className="flex justify-between text-xl font-bold pt-2 border-t border-gray-300" style={{ color: colors.primary }}>
                      <span>{t('pos.payment.totalAmount')}:</span>
                      <span>{format(completedSale.totalAmount || total)}</span>
                    </div>
                    {paymentMethod === 'cash' && amountReceived && parseFloat(amountReceived) !== (completedSale.totalAmount || total) && (
                      <div className="flex justify-between text-sm pt-2">
                        <span>{t('pos.payment.amountReceived')}:</span>
                        <span>{format(parseFloat(amountReceived))}</span>
                      </div>
                    )}
                    {paymentMethod === 'cash' && amountReceived && (() => {
                      const actualTotal = completedSale.totalAmount || total;
                      const received = parseFloat(amountReceived);
                      const calculatedChange = received > actualTotal ? Math.max(0, received - actualTotal) : 0;
                      return calculatedChange > 0 ? (
                        <div className="flex justify-between text-sm text-green-600 font-semibold">
                          <span>{t('pos.payment.change')}:</span>
                          <span>{format(calculatedChange)}</span>
                        </div>
                      ) : null;
                    })()}
                    <div className="flex justify-between text-sm pt-2">
                      <span>{t('pos.payment.paymentMethod')}:</span>
                      <span className="font-semibold">
                        {completedSale?.status === 'credit'
                          ? t('sales.filters.status.credit') || 'Crédit'
                          : paymentMethod === 'cash' ? t('pos.payment.cash') :
                            paymentMethod === 'mobile_money' ? t('pos.payment.mobileMoney') :
                              paymentMethod === 'card' ? t('pos.payment.card') : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes if any */}
              {completedSale.notes && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    <strong>{t('pos.payment.notes')}:</strong> {completedSale.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 mt-4 pt-4 border-t border-gray-200 flex-shrink-0">
            <button
              onClick={handleCloseFromPreview}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              {t('pos.payment.close')}
            </button>
            <button
              onClick={handlePrintFromPreview}
              className="flex-1 px-4 py-3 text-white rounded-lg transition-colors font-medium flex items-center justify-center space-x-2"
              style={{ backgroundColor: colors.primary }}
            >
              <Printer size={18} />
              <span>{t('pos.payment.printBill')}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-2">
      <div className="bg-white rounded-lg p-6 max-w-[95vw] w-full mx-2 my-2 max-h-[95vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h2 className="text-2xl font-semibold">{t('pos.payment.title')}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isProcessingPayment}
          >
            <X size={24} />
          </button>
        </div>

        {/* Loading Overlay */}
        {isProcessingPayment && (
          <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50 rounded-lg">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4" style={{ borderColor: colors.primary }}></div>
              <p className="mt-4 text-lg font-semibold" style={{ color: colors.primary }}>
                {t('pos.payment.processingPayment')}
              </p>
              <p className="mt-2 text-sm text-gray-600">
                {t('pos.payment.pleaseWait')}
              </p>
            </div>
          </div>
        )}

        {/* Two Column Layout */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
          {/* Left Column - Bill Summary & Payment (60%) */}
          <div className="lg:col-span-2 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {/* Products List */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">{t('pos.payment.products')}</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {cart.length === 0 ? (
                    <p className="text-gray-500 text-sm">{t('pos.cart.empty')}</p>
                  ) : (
                    cart.map(item => {
                      const price = item.negotiatedPrice ?? item.product.sellingPrice;
                      const itemTotal = price * item.quantity;
                      return (
                        <div key={item.product.id} className="flex items-center space-x-3 p-2 bg-white rounded border border-gray-200">
                          <div className="w-12 h-12 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                            <ImageWithSkeleton
                              src={item.product.images && item.product.images.length > 0 ? item.product.images[0] : '/placeholder.png'}
                              alt={item.product.name}
                              className="w-full h-full object-cover"
                              placeholder="/placeholder.png"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.product.name}</p>
                            <p className="text-xs text-gray-500">
                              {format(price)} × {item.quantity}
                            </p>
                          </div>
                          <div className="font-semibold text-sm" style={{ color: colors.primary }}>
                            {format(itemTotal)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Total Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('pos.payment.subtotal')}</span>
                    <span className="font-semibold">{format(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('pos.payment.deliveryFee')}</span>
                    <span className="font-semibold">{format(deliveryFee)}</span>
                  </div>
                  {applyTVA && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">TVA ({tvaRate}%)</span>
                      <span className="font-semibold">{format(subtotal * (tvaRate / 100))}</span>
                    </div>
                  )}
                  {discountAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        {t('pos.payment.discount')} {discountType === 'percentage' ? `(${discountValue}%)` : ''}
                      </span>
                      <span className="font-semibold text-red-600">-{format(discountAmount)}</span>
                    </div>
                  )}
                  {taxAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('pos.payment.tax')}</span>
                      <span className="font-semibold">{format(taxAmount)}</span>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-300">
                  <div className="flex justify-between items-center">
                    <div className="text-lg font-medium text-gray-700">{t('pos.payment.totalAmount')}</div>
                    <div className="text-3xl font-bold" style={{ color: colors.primary }}>
                      {format(total)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sale Type Selection (Credit vs Paid) */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">{t('pos.payment.saleType') || 'Sale Type'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setSaleType('paid');
                      setStatus('paid');
                      setPaymentMethod(null); // Reset payment method when switching
                    }}
                    className={`p-4 border-2 rounded-lg transition-colors flex items-center space-x-3 ${saleType === 'paid'
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <DollarSign size={24} className="text-emerald-600" />
                    <div className="text-left">
                      <div className="font-semibold">{t('pos.payment.paidSale') || 'Paid Sale'}</div>
                      <div className="text-sm text-gray-600">{t('pos.payment.paidSaleDescription') || 'Customer pays immediately'}</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setSaleType('credit');
                      setStatus('credit');
                      setPaymentMethod(null); // Reset payment method when switching
                    }}
                    className={`p-4 border-2 rounded-lg transition-colors flex items-center space-x-3 ${saleType === 'credit'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <Clock size={24} className="text-orange-600" />
                    <div className="text-left">
                      <div className="font-semibold">{t('pos.payment.creditSale') || 'Credit Sale'}</div>
                      <div className="text-sm text-gray-600">{t('pos.payment.creditSaleDescription') || 'Customer pays later'}</div>
                    </div>
                  </button>
                </div>

                {/* Credit Sale Requirements */}
                {saleType === 'credit' && (
                  <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <User size={20} className="text-orange-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-orange-800 mb-1">
                          {t('pos.payment.creditRequirement') || 'Customer Name Required'}
                        </div>
                        <div className="text-xs text-orange-700">
                          {t('pos.payment.creditRequirementDescription') || 'The customer name is required for credit sales. Please enter the customer name in the client information section below.'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Credit Due Date (Optional) */}
                {saleType === 'credit' && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Calendar size={16} className="inline mr-2" />
                      {t('pos.payment.creditDueDate') || 'Due Date (Optional)'}
                    </label>
                    <input
                      type="date"
                      value={creditDueDate}
                      onChange={(e) => setCreditDueDate(e.target.value)}
                      min={new Date().toISOString().slice(0, 10)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t('pos.payment.creditDueDateHint') || 'Optional: Set a due date for this credit sale'}
                    </p>
                  </div>
                )}
              </div>

              {/* Payment Method Section - Only show for paid sales */}
              {saleType === 'paid' && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">{t('pos.payment.selectMethod')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      onClick={() => setPaymentMethod('cash')}
                      className={`p-4 border-2 rounded-lg transition-colors flex items-center space-x-3 ${paymentMethod === 'cash'
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <DollarSign size={24} className="text-emerald-600" />
                      <div className="text-left">
                        <div className="font-semibold">{t('pos.payment.cash')}</div>
                        <div className="text-sm text-gray-600">{t('pos.payment.cashDescription')}</div>
                      </div>
                    </button>

                    <button
                      onClick={() => setPaymentMethod('mobile_money')}
                      className={`p-4 border-2 rounded-lg transition-colors flex items-center space-x-3 ${paymentMethod === 'mobile_money'
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <Smartphone size={24} className="text-blue-600" />
                      <div className="text-left">
                        <div className="font-semibold">{t('pos.payment.mobileMoney')}</div>
                        <div className="text-sm text-gray-600">{t('pos.payment.mobileMoneyDescription')}</div>
                      </div>
                    </button>

                    <button
                      onClick={() => setPaymentMethod('card')}
                      className={`p-4 border-2 rounded-lg transition-colors flex items-center space-x-3 ${paymentMethod === 'card'
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <CreditCard size={24} className="text-purple-600" />
                      <div className="text-left">
                        <div className="font-semibold">{t('pos.payment.card')}</div>
                        <div className="text-sm text-gray-600">{t('pos.payment.cardDescription')}</div>
                      </div>
                    </button>
                  </div>

                  {/* Payment Method Specific Fields */}
                  {paymentMethod === 'cash' && (
                    <div className="mt-4 space-y-3">
                      <div>
                        <PriceInput
                          label={t('pos.payment.amountReceived') + ' ' + t('pos.payment.optional')}
                          name="amountReceived"
                          value={amountReceived}
                          onChange={(e) => setAmountReceived(e.target.value)}
                          placeholder={t('pos.payment.exactAmountHint') || `Laisser vide si montant exact (${format(total)})`}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {t('pos.payment.amountReceivedHint') || 'Laissez vide si le client paie le montant exact. Entrez le montant uniquement si vous devez rendre de la monnaie.'}
                        </p>
                      </div>
                      {change > 0 && (
                        <div className="p-3 bg-green-50 rounded-lg">
                          <div className="text-sm text-gray-600">{t('pos.payment.change')}</div>
                          <div className="text-xl font-bold text-green-600">{format(change)}</div>
                        </div>
                      )}
                      {!amountReceived && (
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <div className="text-sm text-gray-600">{t('pos.payment.exactAmount')}</div>
                          <div className="text-lg font-semibold text-blue-600">{format(total)}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {paymentMethod === 'mobile_money' && (
                    <div className="mt-4 space-y-3">
                      <Input
                        label={t('pos.payment.mobileMoneyPhone')}
                        type="tel"
                        value={mobileMoneyPhone}
                        onChange={(e) => setMobileMoneyPhone(e.target.value)}
                        placeholder="+237 6XX XXX XXX"
                        required
                      />
                      <Input
                        label={t('pos.payment.transactionReference')}
                        type="text"
                        value={transactionReference}
                        onChange={(e) => setTransactionReference(e.target.value)}
                        placeholder={t('pos.payment.transactionReferencePlaceholder')}
                      />
                    </div>
                  )}

                  {paymentMethod === 'card' && (
                    <div className="mt-4 space-y-3">
                      <Input
                        label={t('pos.payment.transactionReference')}
                        type="text"
                        value={transactionReference}
                        onChange={(e) => setTransactionReference(e.target.value)}
                        placeholder={t('pos.payment.transactionReferencePlaceholder')}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Tabs: Calculator / Additional Information (40%) */}
          <div className="lg:col-span-1 flex flex-col overflow-hidden">
            {/* Tabs Header */}
            <div className="flex border-b border-gray-200 mb-4 flex-shrink-0">
              {checkoutSettings?.posCalculatorEnabled && (
                <button
                  onClick={() => setActiveTab('calculator')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'calculator'
                    ? 'border-b-2 text-gray-900 font-semibold'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                  style={activeTab === 'calculator' ? { borderBottomColor: colors.primary } : {}}
                >
                  {t('pos.payment.calculator')}
                </button>
              )}
              <button
                onClick={() => setActiveTab('additional')}
                className={`${checkoutSettings?.posCalculatorEnabled ? 'flex-1' : 'flex-1'
                  } px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'additional'
                    ? 'border-b-2 text-gray-900 font-semibold'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
                style={activeTab === 'additional' ? { borderBottomColor: colors.primary } : {}}
              >
                {t('pos.payment.additionalInfo')}
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto pr-2">
              {/* Calculator Tab */}
              {activeTab === 'calculator' && checkoutSettings?.posCalculatorEnabled && (
                <div className="h-full">
                  <POSCalculator
                    onApplyValue={(value) => {
                      // Only set amount received if value is different from total (for change calculation)
                      if (value !== total) {
                        setAmountReceived(value.toString());
                      } else {
                        // If value equals total, clear amount received (exact amount)
                        setAmountReceived('');
                      }
                    }}
                    initialValue={amountReceived ? parseFloat(amountReceived) : total}
                  />
                </div>
              )}

              {/* Additional Information Tab */}
              {activeTab === 'additional' && (
                <div className="space-y-4">
                  {/* Customer Information */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <User size={20} className="mr-2" />
                      {t('pos.payment.customerInfo')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="relative">
                        <Input
                          label={t('pos.payment.customerPhone')}
                          type="tel"
                          value={customerPhone}
                          onChange={handleCustomerPhoneChange}
                          ref={phoneInputRef}
                        />

                        {/* Customer Dropdown - shown below phone field when phone field is active */}
                        {showCustomerDropdown && activeSearchField === 'phone' && (
                          <div
                            className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
                            data-dropdown="customer"
                          >
                            {customers && customers.length > 0
                              ? customers
                                .filter(c => {
                                  if (!customerSearch.trim()) return true;

                                  const searchTerm = customerSearch.trim().toLowerCase();
                                  const normalizedSearch = normalizePhoneForComparison(customerSearch);

                                  // Search by name (case-insensitive, partial match)
                                  const nameMatch = c.name?.toLowerCase().includes(searchTerm) || false;

                                  // Search by phone (normalized comparison for partial match)
                                  const phoneMatch = c.phone && normalizedSearch.length >= 1
                                    ? normalizePhoneForComparison(c.phone).includes(normalizedSearch) ||
                                    normalizedSearch.includes(normalizePhoneForComparison(c.phone))
                                    : false;

                                  // Return true if EITHER name OR phone matches
                                  return nameMatch || phoneMatch;
                                })
                                .slice(0, 10)
                                .map((customer) => (
                                  <button
                                    key={customer.id}
                                    type="button"
                                    className="w-full px-4 py-3 text-left hover:bg-gray-100 border-b border-gray-100 last:border-b-0 flex items-center justify-between"
                                    onClick={() => handleSelectCustomer(customer)}
                                  >
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900">{customer.name}</div>
                                      <div className="text-sm text-gray-500">{customer.phone}</div>
                                      {customer.quarter && (
                                        <div className="text-xs text-gray-400">{customer.quarter}</div>
                                      )}
                                    </div>
                                  </button>
                                ))
                              : null}
                          </div>
                        )}
                      </div>
                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('pos.payment.customerName')}
                          {saleType === 'credit' && <span className="text-red-600 ml-1">*</span>}
                        </label>
                        <Input
                          type="text"
                          value={customerName}
                          onChange={handleCustomerNameChange}
                          ref={nameInputRef}
                          error={saleType === 'credit' && (!customerName || customerName.trim() === '') ? (t('sales.messages.errors.customerNameRequiredForCredit') || 'Customer name is required for credit sales') : undefined}
                          helpText={saleType === 'credit' ? (t('pos.payment.customerNameRequiredForCredit') || 'Required for credit sales') : undefined}
                          className={saleType === 'credit' && (!customerName || customerName.trim() === '') ? 'border-red-300' : ''}
                        />

                        {/* Improved Customer Dropdown - Unified search by name AND phone */}
                        {showCustomerDropdown && activeSearchField === 'name' && (
                          <div
                            className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
                            data-dropdown="customer"
                          >
                            {customers && customers.length > 0 ? (() => {
                              const filteredCustomers = customers
                                .filter(c => {
                                  if (!customerSearch.trim()) return true;

                                  const searchTerm = customerSearch.trim().toLowerCase();
                                  const normalizedSearch = normalizePhoneForComparison(customerSearch);

                                  // Search by name (case-insensitive, partial match)
                                  const nameMatch = c.name?.toLowerCase().includes(searchTerm) || false;

                                  // Search by phone (normalized comparison for partial match)
                                  const phoneMatch = c.phone && normalizedSearch.length >= 1
                                    ? normalizePhoneForComparison(c.phone).includes(normalizedSearch) ||
                                    normalizedSearch.includes(normalizePhoneForComparison(c.phone))
                                    : false;

                                  // Return true if EITHER name OR phone matches
                                  return nameMatch || phoneMatch;
                                })
                                .slice(0, 10);

                              if (filteredCustomers.length === 0) {
                                return (
                                  <div className="p-4 text-sm text-gray-500 text-center">
                                    Aucun client trouvé pour "{customerSearch}"
                                  </div>
                                );
                              }

                              return (
                                <>
                                  <div className="p-2 bg-gray-50 border-b sticky top-0">
                                    <div className="text-xs font-medium text-gray-600">
                                      {filteredCustomers.length} {filteredCustomers.length === 1 ? 'client trouvé' : 'clients trouvés'} (nom ou téléphone)
                                    </div>
                                  </div>
                                  {filteredCustomers.map((customer) => {
                                    const searchTerm = customerSearch.trim().toLowerCase();
                                    const normalizedSearch = normalizePhoneForComparison(customerSearch);
                                    const nameMatch = customer.name?.toLowerCase().includes(searchTerm);
                                    const phoneMatch = customer.phone && normalizePhoneForComparison(customer.phone).includes(normalizedSearch);

                                    return (
                                      <button
                                        key={customer.id}
                                        type="button"
                                        className="w-full px-4 py-3 text-left hover:bg-emerald-50 border-b border-gray-100 last:border-b-0 transition-colors"
                                        onClick={() => handleSelectCustomer(customer)}
                                      >
                                        <div className="flex items-start gap-2">
                                          <div className="flex-1">
                                            <div className="font-medium text-gray-900 flex items-center gap-2">
                                              {customer.name || 'Client de passage'}
                                              {nameMatch && <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">Nom</span>}
                                              {phoneMatch && <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">Tél</span>}
                                            </div>
                                            {customer.phone && (
                                              <div className="text-sm text-gray-600 mt-1">
                                                📞 {customer.phone}
                                              </div>
                                            )}
                                            {customer.quarter && (
                                              <div className="text-xs text-gray-500 mt-1">
                                                📍 {customer.quarter}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </>
                              );
                            })() : null}
                          </div>
                        )}
                      </div>
                      <Input
                        label={t('pos.payment.customerQuarter')}
                        type="text"
                        value={customerQuarter}
                        onChange={(e) => setCustomerQuarter(e.target.value)}
                      />
                      {activeSources.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('pos.payment.customerSource')}
                          </label>
                          <Select
                            options={[
                              { value: '', label: t('pos.payment.noSource'), color: '#6B7280' },
                              ...activeSources.map(source => ({
                                value: source.id,
                                label: source.name,
                                color: source.color || '#3B82F6'
                              }))
                            ]}
                            value={customerSourceId && activeSources.find(s => s.id === customerSourceId)
                              ? {
                                value: customerSourceId,
                                label: activeSources.find(s => s.id === customerSourceId)?.name || '',
                                color: activeSources.find(s => s.id === customerSourceId)?.color || '#3B82F6'
                              }
                              : null
                            }
                            onChange={(option) => setCustomerSourceId(option?.value || '')}
                            formatOptionLabel={({ label, color }) => (
                              <div className="flex items-center gap-2">
                                {color && (
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: color }}
                                  />
                                )}
                                <span>{label}</span>
                              </div>
                            )}
                            className="react-select-container"
                            classNamePrefix="react-select"
                            isClearable
                            placeholder={t('pos.payment.selectSource')}
                          />
                        </div>
                      )}
                    </div>
                    {/* Additional customer fields - Collapsible */}
                    <button
                      onClick={() => setShowCustomerSection(!showCustomerSection)}
                      className="mt-3 text-sm text-gray-600 hover:text-gray-900 flex items-center space-x-1"
                    >
                      <span>{showCustomerSection ? t('pos.payment.hideAdditional') : t('pos.payment.showAdditional')}</span>
                      {showCustomerSection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {showCustomerSection && (
                      <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          label={t('pos.payment.customerAddress')}
                          type="text"
                          value={customerAddress}
                          onChange={(e) => setCustomerAddress(e.target.value)}
                        />
                        <Input
                          label={t('pos.payment.customerTown')}
                          type="text"
                          value={customerTown}
                          onChange={(e) => setCustomerTown(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Sale Date and Discount - Always Visible */}
                  <div className="flex flex-col gap-4">
                    {/* Row 1: Date and Promo Code */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          <Calendar size={16} className="inline mr-2" />
                          {t('pos.payment.saleDate')}
                        </label>
                        <Input
                          type="date"
                          value={saleDate}
                          onChange={(e) => setSaleDate(e.target.value)}
                          className="w-full"
                        />
                      </div>
                      <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('pos.payment.promoCode')}
                        </label>
                        <Input
                          type="text"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value)}
                          placeholder={t('pos.payment.promoCodePlaceholder')}
                          className="w-full"
                        />
                      </div>
                    </div>
                    {/* Row 2: Discount */}
                    <div className="w-full">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Percent size={16} className="inline mr-2" />
                        {t('pos.payment.discount')}
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2 w-full">
                        <select
                          value={discountType}
                          onChange={(e) => setDiscountType(e.target.value as 'amount' | 'percentage')}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm w-full sm:w-auto sm:min-w-[140px] flex-shrink-0"
                        >
                          <option value="amount">{t('pos.payment.discountAmount')} ({currency.symbol})</option>
                          <option value="percentage">{t('pos.payment.discountPercentage')}</option>
                        </select>
                        <PriceInput
                          name="discountValue"
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                          placeholder={discountType === 'amount' ? currency.symbol : '%'}
                          className="flex-1"
                          allowDecimals={discountType === 'percentage'}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sale Information Section (Collapsible) */}
                  <div className="border border-gray-200 rounded-lg">
                    <button
                      onClick={() => setShowSaleInfoSection(!showSaleInfoSection)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <Receipt size={20} />
                        <span className="font-semibold">{t('pos.payment.saleInfo')}</span>
                      </div>
                      {showSaleInfoSection ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                    {showSaleInfoSection && (
                      <div className="p-4 space-y-4 border-t border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              <Truck size={16} className="inline mr-2" />
                              {t('pos.payment.deliveryFee')}
                            </label>
                            <PriceInput
                              name="deliveryFee"
                              value={deliveryFee.toString()}
                              onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('pos.payment.status')}
                            </label>
                            <select
                              value={saleType === 'credit' ? 'credit' : status}
                              onChange={(e) => {
                                if (e.target.value === 'credit') {
                                  setSaleType('credit');
                                } else {
                                  setSaleType('paid');
                                  setStatus(e.target.value as OrderStatus);
                                }
                              }}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            >
                              <option value="commande">{t('pos.payment.statusOrder')}</option>
                              <option value="under_delivery">{t('pos.payment.statusDelivery')}</option>
                              <option value="paid">{t('pos.payment.statusPaid')}</option>
                              <option value="credit">{t('pos.payment.statusCredit') || 'Credit'}</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <CommonSelect
                            label={t('pos.payment.inventoryMethod')}
                            value={inventoryMethod}
                            onChange={(e) => setInventoryMethod(e.target.value as 'fifo' | 'lifo' | 'cmup')}
                            options={[
                              {
                                value: 'fifo',
                                label: t('sales.modals.add.inventoryMethod.fifo')
                              },
                              {
                                value: 'lifo',
                                label: t('sales.modals.add.inventoryMethod.lifo')
                              },
                              {
                                value: 'cmup',
                                label: t('sales.modals.add.inventoryMethod.cmup')
                              }
                            ]}
                            helpText={
                              inventoryMethod === 'fifo'
                                ? t('sales.modals.add.inventoryMethod.fifoDescription')
                                : inventoryMethod === 'lifo'
                                  ? t('sales.modals.add.inventoryMethod.lifoDescription')
                                  : t('sales.modals.add.inventoryMethod.cmupDescription')
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Additional Options */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-4">{t('pos.payment.additionalOptions')}</h3>
                    <div className="space-y-4">
                      {/* TVA Toggle */}
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">TVA Cameroun ({tvaRate}%):</label>
                        <button
                          onClick={() => onTVAToggle && onTVAToggle(!applyTVA)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${applyTVA ? 'bg-emerald-600' : 'bg-gray-200'
                            }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${applyTVA ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                        </button>
                      </div>

                      {/* TVA Amount Display */}
                      {applyTVA && (
                        <div className="text-sm text-gray-600">
                          TVA: {format(subtotal * (tvaRate / 100))}
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('pos.payment.tax')}
                        </label>
                        <PriceInput
                          name="tax"
                          value={tax}
                          onChange={(e) => setTax(e.target.value)}
                          placeholder={currency.symbol}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('pos.payment.notes')}
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder={t('pos.payment.notesPlaceholder')}
                          rows={3}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="printReceipt"
                          checked={printReceipt}
                          onChange={(e) => setPrintReceipt(e.target.checked)}
                          className="h-4 w-4 rounded"
                          style={{ color: colors.primary }}
                        />
                        <label htmlFor="printReceipt" className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                          <Printer size={16} />
                          <span>{t('pos.payment.printReceipt')}</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 mt-4 pt-4 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            disabled={isSubmitting || isPrinting}
          >
            {t('pos.payment.cancel')}
          </button>
          {onSaveDraft && (
            <button
              onClick={handleSaveDraft}
              disabled={isSubmitting || isPrinting || cart.length === 0}
              className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('pos.payment.saveDraft')}
            </button>
          )}
          <button
            onClick={handlePrintBill}
            disabled={isSubmitting || isPrinting || cart.length === 0}
            className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer size={18} />
            <span>{isPrinting ? t('pos.payment.printing') : t('pos.payment.printBill')}</span>
          </button>
          <button
            onClick={handleComplete}
            disabled={
              isSubmitting ||
              isPrinting ||
              (saleType === 'paid' && !paymentMethod) ||
              (saleType === 'credit' && (!customerName || customerName.trim() === ''))
            }
            className="flex-1 px-4 py-3 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 font-medium"
            style={{ backgroundColor: colors.primary }}
          >
            {isSubmitting ? t('common.saving') : t('pos.payment.completePayment')}
          </button>
        </div>
      </div>
    </div>
  );
};
