import React, { useState, useEffect, useRef } from 'react';
import { X, CreditCard, Smartphone, DollarSign, ChevronDown, ChevronUp, User, Calendar, Truck, Percent, Printer, Receipt } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useCustomerSources } from '../../hooks/useCustomerSources';
import { useProducts } from '../../hooks/useFirestore';
import { printPOSBillDirect } from '../../utils/posPrint';
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import { POSCalculator } from './POSCalculator';
import Select from 'react-select';
import Input from '../common/Input';
import { ImageWithSkeleton } from '../common/ImageWithSkeleton';
import type { OrderStatus } from '../../types/models';
import type { CartItem } from '../../hooks/usePOS';

export interface POSPaymentData {
  // Payment
  paymentMethod: 'cash' | 'mobile_money' | 'card';
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
  inventoryMethod: 'fifo' | 'lifo';
  
  // Additional
  discountType?: 'amount' | 'percentage';
  discountValue?: number;
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
}) => {
  // ✅ ALL HOOKS MUST BE CALLED FIRST - BEFORE ANY CONDITIONAL RETURNS
  const { t } = useTranslation();
  const { company } = useAuth();
  const { activeSources } = useCustomerSources();
  const { products } = useProducts();
  
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
  
  // Sale Info
  const [saleDate, setSaleDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [deliveryFee, setDeliveryFee] = useState<number>(currentDeliveryFee);
  const [status, setStatus] = useState<OrderStatus>('paid');
  const [inventoryMethod, setInventoryMethod] = useState<'fifo' | 'lifo'>('fifo');
  
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
  const [activeTab, setActiveTab] = useState<'calculator' | 'additional'>('calculator'); // Calculator is default
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [completedSale, setCompletedSale] = useState<any>(null); // Store completed sale for preview
  const [hasAutoPrinted, setHasAutoPrinted] = useState(false); // Track if auto-print has been triggered
  const printFromPreviewRef = useRef<(() => void) | null>(null); // Ref to store handlePrintFromPreview function

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
    setInventoryMethod('fifo');
    setDiscountType('amount');
    setDiscountValue('');
    setPromoCode('');
    setTax('');
    setNotes('');
    setPrintReceipt(false);
    setShowCustomerSection(false);
    setShowSaleInfoSection(false);
    setActiveTab('calculator');
    setCompletedSale(null);
    setIsProcessingPayment(false);
    setHasAutoPrinted(false);
    printFromPreviewRef.current = null;
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
  
  const taxAmount = tax ? parseFloat(tax) : 0;
  const total = subtotal + deliveryFee - discountAmount + taxAmount;
  // Calculate change: if no amount received entered, assume exact amount (change = 0)
  // If amount received > total, calculate change
  const change = paymentMethod === 'cash' && amountReceived && parseFloat(amountReceived) > total
    ? Math.max(0, parseFloat(amountReceived) - total)
    : 0;

  const handleComplete = async () => {
    if (!paymentMethod) {
      alert(t('pos.payment.errors.selectMethod'));
      return;
    }
    
    // For cash payment: if amount received is entered, it must be >= total
    // If no amount received entered, assume exact amount (no change needed)
    if (paymentMethod === 'cash' && amountReceived) {
      const received = parseFloat(amountReceived);
      if (isNaN(received) || received < total) {
        alert(t('pos.payment.errors.insufficientAmount'));
        return;
      }
    }
    
    if (paymentMethod === 'mobile_money' && !mobileMoneyPhone) {
      alert(t('pos.payment.errors.mobileMoneyPhone'));
      return;
    }

    // Customer phone is optional for POS system

    const paymentData: POSPaymentData = {
      paymentMethod,
      amountReceived: paymentMethod === 'cash' && amountReceived && amountReceived.trim() !== '' 
        ? parseFloat(amountReceived) 
        : undefined,
      change: paymentMethod === 'cash' ? change : undefined,
      transactionReference: paymentMethod !== 'cash' ? (transactionReference || '') : '',
      mobileMoneyPhone: paymentMethod === 'mobile_money' ? (mobileMoneyPhone || '') : '',
      customerPhone: customerPhone || '',
      customerName: customerName || t('pos.payment.walkInCustomer'),
      customerQuarter: customerQuarter || '',
      customerSourceId: customerSourceId || '',
      customerAddress: customerAddress || '',
      customerTown: customerTown || '',
      saleDate,
      deliveryFee,
      status,
      inventoryMethod,
      discountType: discountValue ? discountType : undefined,
      discountValue: discountValue ? parseFloat(discountValue) : undefined,
      promoCode: promoCode || '',
      tax: tax ? parseFloat(tax) : undefined,
      notes: notes || '',
      printReceipt,
    };

    // Show loading state
    setIsProcessingPayment(true);

    try {
      // Call onComplete and wait for the sale to be created
      const sale = await onComplete(paymentData);
      
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
        id: `temp-${Date.now()}`,
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
        tax: taxAmount,
        createdAt: { seconds: Math.floor(new Date(saleDate).getTime() / 1000), nanoseconds: 0 },
      };

      // Use direct print (browser print dialog)
      printPOSBillDirect(tempSale as any, products || [], company);
    } catch (error) {
      console.error('Error printing bill:', error);
      showErrorToast(t('pos.payment.printError') || 'Failed to print bill');
    } finally {
      setIsPrinting(false);
    }
  };

  // Handle print from preview - print directly without opening new tab
  const handlePrintFromPreview = () => {
    if (!completedSale || !company) return;
    
    try {
      // Create a hidden iframe for printing
      const printIframe = document.createElement('iframe');
      printIframe.style.position = 'absolute';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = 'none';
      printIframe.style.left = '-9999px';
      
      document.body.appendChild(printIframe);
      
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
      
      // Build invoice HTML content
      const invoiceContent = `
        <!DOCTYPE html>
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
                font-family: 'Arial', sans-serif;
                font-size: 12px;
                padding: 20px;
                margin: 0;
              }
            </style>
          </head>
          <body>
            <div style="width: 80mm; margin: 0 auto; padding: 10px;">
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
                        <td style="text-align: right; padding: 2px 0;">${itemPrice.toLocaleString()}</td>
                        <td style="text-align: right; padding: 2px 0;">${(itemPrice * item.quantity).toLocaleString()}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
              <hr style="border-top: 1px dashed #000; margin: 10px 0;">
              <p style="text-align: right;"><strong>Sous-total:</strong> ${subtotal.toLocaleString()} XAF</p>
              ${completedSale.deliveryFee > 0 ? `<p style="text-align: right;"><strong>Frais de livraison:</strong> ${completedSale.deliveryFee.toLocaleString()} XAF</p>` : ''}
              ${discountAmount > 0 ? `<p style="text-align: right;"><strong>Remise:</strong> -${discountAmount.toLocaleString()} XAF</p>` : ''}
              ${taxAmount > 0 ? `<p style="text-align: right;"><strong>Taxe:</strong> ${taxAmount.toLocaleString()} XAF</p>` : ''}
              <h3 style="text-align: right; margin-top: 10px;">Total: ${completedSale.totalAmount?.toLocaleString() || total.toLocaleString()} XAF</h3>
              ${paymentMethod === 'cash' && amountReceived && parseFloat(amountReceived) !== (completedSale.totalAmount || total) ? `<p style="text-align: right;"><strong>Montant reçu:</strong> ${parseFloat(amountReceived).toLocaleString()} XAF</p>` : ''}
              ${(() => {
                if (paymentMethod === 'cash' && amountReceived) {
                  const actualTotal = completedSale.totalAmount || total;
                  const received = parseFloat(amountReceived);
                  const calculatedChange = received > actualTotal ? Math.max(0, received - actualTotal) : 0;
                  return calculatedChange > 0 ? `<p style="text-align: right;"><strong>Monnaie:</strong> ${calculatedChange.toLocaleString()} XAF</p>` : '';
                }
                return '';
              })()}
              ${paymentMethod === 'cash' && (!amountReceived || parseFloat(amountReceived) === (completedSale.totalAmount || total)) ? `<p style="text-align: right;"><strong>Montant:</strong> ${(completedSale.totalAmount || total).toLocaleString()} XAF (exact)</p>` : ''}
              <p style="text-align: right;"><strong>Méthode:</strong> ${paymentMethod === 'cash' ? 'Espèces' : paymentMethod === 'mobile_money' ? 'Mobile Money' : paymentMethod === 'card' ? 'Carte' : ''}</p>
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
    } catch (error) {
      console.error('Error printing from preview:', error);
      showErrorToast(t('pos.payment.printError') || 'Failed to print bill');
    }
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
                  <h3 className="text-2xl font-bold mb-2" style={{ color: colors.primary }}>
                    {company?.name || ''}
                  </h3>
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
                          <td className="text-right py-2 px-3">{unitPrice.toLocaleString()} XAF</td>
                          <td className="text-right py-2 px-3 font-semibold">{itemTotal.toLocaleString()} XAF</td>
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
                    <div className="flex justify-between text-sm">
                      <span>{t('pos.payment.subtotal')}:</span>
                      <span>{subtotal.toLocaleString()} XAF</span>
                    </div>
                    {completedSale.deliveryFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>{t('pos.payment.deliveryFee')}:</span>
                        <span>{completedSale.deliveryFee.toLocaleString()} XAF</span>
                      </div>
                    )}
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-sm text-red-600">
                        <span>{t('pos.payment.discount')}:</span>
                        <span>-{discountAmount.toLocaleString()} XAF</span>
                      </div>
                    )}
                    {taxAmount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>{t('pos.payment.tax')}:</span>
                        <span>{taxAmount.toLocaleString()} XAF</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xl font-bold pt-2 border-t border-gray-300" style={{ color: colors.primary }}>
                      <span>{t('pos.payment.totalAmount')}:</span>
                      <span>{completedSale.totalAmount?.toLocaleString() || total.toLocaleString()} XAF</span>
                    </div>
                    {paymentMethod === 'cash' && amountReceived && parseFloat(amountReceived) !== (completedSale.totalAmount || total) && (
                      <div className="flex justify-between text-sm pt-2">
                        <span>{t('pos.payment.amountReceived')}:</span>
                        <span>{parseFloat(amountReceived).toLocaleString()} XAF</span>
                      </div>
                    )}
                    {paymentMethod === 'cash' && amountReceived && (() => {
                      const actualTotal = completedSale.totalAmount || total;
                      const received = parseFloat(amountReceived);
                      const calculatedChange = received > actualTotal ? Math.max(0, received - actualTotal) : 0;
                      return calculatedChange > 0 ? (
                        <div className="flex justify-between text-sm text-green-600 font-semibold">
                          <span>{t('pos.payment.change')}:</span>
                          <span>{calculatedChange.toLocaleString()} XAF</span>
                        </div>
                      ) : null;
                    })()}
                    <div className="flex justify-between text-sm pt-2">
                      <span>{t('pos.payment.paymentMethod')}:</span>
                      <span className="font-semibold">
                        {paymentMethod === 'cash' ? t('pos.payment.cash') : 
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
                              {price.toLocaleString()} XAF × {item.quantity}
                            </p>
                          </div>
                          <div className="font-semibold text-sm" style={{ color: colors.primary }}>
                            {itemTotal.toLocaleString()} XAF
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
                    <span className="font-semibold">{subtotal.toLocaleString()} XAF</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('pos.payment.deliveryFee')}</span>
                    <span className="font-semibold">{deliveryFee.toLocaleString()} XAF</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('pos.payment.discount')}</span>
                      <span className="font-semibold text-red-600">-{discountAmount.toLocaleString()} XAF</span>
                    </div>
                  )}
                  {taxAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('pos.payment.tax')}</span>
                      <span className="font-semibold">{taxAmount.toLocaleString()} XAF</span>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-300">
                  <div className="flex justify-between items-center">
                    <div className="text-lg font-medium text-gray-700">{t('pos.payment.totalAmount')}</div>
                    <div className="text-3xl font-bold" style={{ color: colors.primary }}>
                      {total.toLocaleString()} XAF
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3">{t('pos.payment.selectMethod')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => setPaymentMethod('cash')}
                    className={`p-4 border-2 rounded-lg transition-colors flex items-center space-x-3 ${
                      paymentMethod === 'cash'
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
                    className={`p-4 border-2 rounded-lg transition-colors flex items-center space-x-3 ${
                      paymentMethod === 'mobile_money'
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
                    className={`p-4 border-2 rounded-lg transition-colors flex items-center space-x-3 ${
                      paymentMethod === 'card'
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
                      <Input
                        label={t('pos.payment.amountReceived') + ' ' + t('pos.payment.optional')}
                        type="number"
                        value={amountReceived}
                        onChange={(e) => setAmountReceived(e.target.value)}
                        min={total.toString()}
                        placeholder={t('pos.payment.exactAmountHint') || `Laisser vide si montant exact (${total.toLocaleString()} XAF)`}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {t('pos.payment.amountReceivedHint') || 'Laissez vide si le client paie le montant exact. Entrez le montant uniquement si vous devez rendre de la monnaie.'}
                      </p>
                    </div>
                    {change > 0 && (
                      <div className="p-3 bg-green-50 rounded-lg">
                        <div className="text-sm text-gray-600">{t('pos.payment.change')}</div>
                        <div className="text-xl font-bold text-green-600">{change.toLocaleString()} XAF</div>
                      </div>
                    )}
                    {!amountReceived && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="text-sm text-gray-600">{t('pos.payment.exactAmount')}</div>
                        <div className="text-lg font-semibold text-blue-600">{total.toLocaleString()} XAF</div>
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
            </div>
          </div>

          {/* Right Column - Tabs: Calculator / Additional Information (40%) */}
          <div className="lg:col-span-1 flex flex-col overflow-hidden">
            {/* Tabs Header */}
            <div className="flex border-b border-gray-200 mb-4 flex-shrink-0">
              <button
                onClick={() => setActiveTab('calculator')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'calculator'
                    ? 'border-b-2 text-gray-900 font-semibold'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                style={activeTab === 'calculator' ? { borderBottomColor: colors.primary } : {}}
              >
                {t('pos.payment.calculator')}
              </button>
              <button
                onClick={() => setActiveTab('additional')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'additional'
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
              {activeTab === 'calculator' && (
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
              <Input
                label={t('pos.payment.customerPhone')}
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder={t('pos.payment.customerPhoneOptional')}
              />
              <Input
                label={t('pos.payment.customerName')}
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
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
                  <option value="amount">{t('pos.payment.discountAmount')}</option>
                  <option value="percentage">{t('pos.payment.discountPercentage')}</option>
                </select>
                <Input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'amount' ? 'XAF' : '%'}
                  min="0"
                  className="w-full sm:flex-1"
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
                            <Input
                              type="number"
                              value={deliveryFee.toString()}
                              onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                              min="0"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('pos.payment.status')}
                            </label>
                            <select
                              value={status}
                              onChange={(e) => setStatus(e.target.value as OrderStatus)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            >
                              <option value="commande">{t('pos.payment.statusOrder')}</option>
                              <option value="under_delivery">{t('pos.payment.statusDelivery')}</option>
                              <option value="paid">{t('pos.payment.statusPaid')}</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('pos.payment.inventoryMethod')}
                          </label>
                          <div className="flex space-x-4">
                            <label className="flex items-center space-x-2">
                              <input
                                type="radio"
                                value="fifo"
                                checked={inventoryMethod === 'fifo'}
                                onChange={(e) => setInventoryMethod(e.target.value as 'fifo' | 'lifo')}
                                className="form-radio h-4 w-4"
                                style={{ color: colors.primary }}
                              />
                              <span className="text-sm">FIFO</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="radio"
                                value="lifo"
                                checked={inventoryMethod === 'lifo'}
                                onChange={(e) => setInventoryMethod(e.target.value as 'fifo' | 'lifo')}
                                className="form-radio h-4 w-4"
                                style={{ color: colors.primary }}
                              />
                              <span className="text-sm">LIFO</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Additional Options */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-4">{t('pos.payment.additionalOptions')}</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('pos.payment.tax')}
                        </label>
                        <Input
                          type="number"
                          value={tax}
                          onChange={(e) => setTax(e.target.value)}
                          placeholder="XAF"
                          min="0"
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
            disabled={!paymentMethod || isSubmitting || isPrinting}
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
