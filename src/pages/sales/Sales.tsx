import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Edit2,
  Eye,
  Trash2,
  Download,
  Share,
  ChevronDown,
  ChevronRight,
  Loader2,
  Info,
  ChevronsLeft,
  ChevronLeft,
  ChevronsRight,
  FileText,
  Clock,
  RotateCcw
} from 'lucide-react';
import Select from 'react-select';
import { Modal, ModalFooter, Input, PriceInput, Badge, Button, Card, ImageWithSkeleton, SkeletonSalesList, SyncIndicator, DateRangePicker } from '@components/common';
import { useProducts, useCustomers } from '@hooks/data/useFirestore';
import { useCustomerSources } from '@hooks/business/useCustomerSources';
import { useInfiniteSales } from '@hooks/data/useInfiniteSales';
import { formatPrice } from '@utils/formatting/formatPrice';
import type { Product, OrderStatus, Sale, SaleProduct, Customer } from '../../types/models';
import { showSuccessToast, showErrorToast, showWarningToast } from '@utils/core/toast';
import Invoice from '../../components/sales/Invoice';
import { generatePDF, generatePDFBlob } from '@utils/core/pdf';
import { generateInvoiceFileName } from '@utils/core/fileUtils';
import { useAuth } from '@contexts/AuthContext';
import { useAllStockBatches } from '@hooks/business/useStockBatches';
import { buildProductStockMap, getEffectiveProductStock } from '@utils/inventory/stockHelpers';
import { normalizePhoneForComparison } from '@utils/core/phoneUtils';
import { logError } from '@utils/core/logger';
import { useTranslation } from 'react-i18next';
import { softDeleteSale, updateSaleStatus, cancelCreditSale, refundCreditSale, updateSaleDocument } from '@services/firestore/sales/saleService';
import { formatCreatorName } from '@utils/business/employeeUtils';
import { createPortal } from 'react-dom';
import AddSaleModal from '../../components/sales/AddSaleModal';
import SaleDetailsModal from '../../components/sales/SaleDetailsModal';
import ProfitDetailsModal from '../../components/sales/ProfitDetailsModal';
import SalesReportModal from '../../components/reports/SalesReportModal';
import { SettleCreditModal } from '../../components/sales/SettleCreditModal';
import { RefundCreditModal } from '../../components/sales/RefundCreditModal';
import { format } from 'date-fns';
import { PermissionButton, usePermissionCheck } from '@components/permissions';
import { RESOURCES } from '@constants/resources';
import { countCreditSales } from '@utils/calculations/financialCalculations';
import { useSearchParams } from 'react-router-dom';

interface FormProduct {
  product: Product | null;
  quantity: string;
  negotiatedPrice: string;
}

interface ProductOption {
  label: React.ReactNode;
  value: Product;
}

const Sales: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    sales,
    loading: salesLoading,
    loadingMore: salesLoadingMore,
    syncing: salesSyncing,
    hasMore: salesHasMore,
    error: salesError,
    loadMore: loadMoreSales,
    refresh: refreshSales,
    updateSaleInList,
    removeSaleFromList
  } = useInfiniteSales();
  const { products, loading: productsLoading } = useProducts();
  const { customers } = useCustomers();
  const { activeSources } = useCustomerSources();
  const { user, company } = useAuth();
  // OPTIMIZATION: Removed useSales() hook to avoid duplicate subscription
  // useInfiniteSales() already provides real-time updates via subscription
  // We'll use updateSaleDocument directly from service instead
  const { canEdit, canDelete } = usePermissionCheck(RESOURCES.SALES);
  const { batches: allBatches } = useAllStockBatches();

  const stockMap = React.useMemo(
    () => buildProductStockMap(allBatches || []),
    [allBatches]
  );


  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isProfitModalOpen, setIsProfitModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSettleCreditModalOpen, setIsSettleCreditModalOpen] = useState(false);
  const [isRefundCreditModalOpen, setIsRefundCreditModalOpen] = useState(false);
  const [currentSale, setCurrentSale] = useState<Sale | null>(null);
  const [viewedSale, setViewedSale] = useState<Sale | null>(null);
  const [profitSale, setProfitSale] = useState<Sale | null>(null);
  const [saleToSettle, setSaleToSettle] = useState<Sale | null>(null);
  const [saleToRefund, setSaleToRefund] = useState<Sale | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [shareableLink] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState<'date' | 'amount' | null>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    // Default to all_time: from app start date to far future
    const APP_START_DATE = new Date(2025, 3, 1); // April 1st, 2025
    return {
      from: APP_START_DATE,
      to: new Date(2100, 0, 1)
    };
  });

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerQuarter: '',
    customerSourceId: '',
    status: 'commande' as OrderStatus,
    deliveryFee: '',
    products: [{ product: null, quantity: '', negotiatedPrice: '' }] as FormProduct[],
  });

  const [customerDropdownPos, setCustomerDropdownPos] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const phoneInputRef = useRef<HTMLInputElement>(null);



  // Use centralized phone normalization for comparison
  const normalizePhone = normalizePhoneForComparison;

  // Read status filter from URL query parameter on mount
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam) {
      setFilterStatus(statusParam);
      setPage(1); // Reset to first page when filter is applied from URL
    }
  }, [searchParams]);

  useEffect(() => {
    if (showCustomerDropdown && phoneInputRef.current) {
      const rect = phoneInputRef.current.getBoundingClientRect();
      setCustomerDropdownPos({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [showCustomerDropdown, formData.customerPhone]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: string } }): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value.replace(/\D/g, '');
    setFormData((prev) => ({ ...prev, customerPhone: value }));
    setCustomerSearch(value);
    setShowCustomerDropdown(!!value);
  };



  const handleProductChange = (index: number, option: ProductOption | null): void => {
    setFormData((prev) => {
      const newProducts = [...prev.products];
      newProducts[index] = {
        ...newProducts[index],
        product: option ? option.value : null,
        quantity: option ? '1' : '',
        negotiatedPrice: option ? option.value.sellingPrice.toString() : '',
      };
      return { ...prev, products: newProducts };
    });
  };

  const handleProductInputChange = (index: number, field: keyof FormProduct, value: string): void => {
    setFormData((prev) => {
      const newProducts = [...prev.products];
      newProducts[index] = { ...newProducts[index], [field]: value };
      return { ...prev, products: newProducts };
    });
  };

  const addProductField = (): void => {
    setFormData((prev) => ({
      ...prev,
      products: [...prev.products, { product: null, quantity: '', negotiatedPrice: '' }],
    }));
  };

  const removeProductField = (index: number): void => {
    setFormData((prev) => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index),
    }));
  };

  const resetForm = (): void => {
    setFormData({
      customerName: '',
      customerPhone: '',
      customerQuarter: '',
      customerSourceId: '',
      status: 'commande',
      deliveryFee: '',
      products: [{ product: null, quantity: '', negotiatedPrice: '' }],
    });
    setShowCustomerDropdown(false);
    setCustomerSearch('');
  };

  const calculateProductTotal = (product: FormProduct): number => {
    if (!product.product || !product.quantity) return 0;
    const quantity = parseInt(product.quantity, 10);
    const price = product.negotiatedPrice ? parseFloat(product.negotiatedPrice) : product.product.sellingPrice;
    return quantity * price;
  };

  const calculateTotal = (): number => {
    return formData.products.reduce((total, product) => total + calculateProductTotal(product), 0);
  };

  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    const hasSelectedProducts = formData.products.some((p) => p.product !== null);
    if (!hasSelectedProducts) {
      errors.products = t('sales.messages.warnings.atLeastOneProduct');
      return errors;
    }
    formData.products.forEach((product, index) => {
      if (!product.product) return;
      const quantity = parseInt(product.quantity, 10);
      if (isNaN(quantity) || quantity <= 0) {
        errors[`quantity_${index}`] = t('sales.messages.warnings.quantityInvalid');
      } else {
        const effectiveStock = getEffectiveProductStock(product.product, stockMap);
        if (quantity > effectiveStock) {
          errors[`quantity_${index}`] = t('sales.messages.warnings.quantityExceeded', { stock: effectiveStock });
        }
      }
    });
    const deliveryFee = parseFloat(formData.deliveryFee);
    if (!isNaN(deliveryFee) && deliveryFee < 0) {
      errors.deliveryFee = t('sales.messages.warnings.deliveryFeeInvalid');
    }
    return errors;
  };

  // Removed unused handleGenerateLink to avoid warnings

  const handleViewSale = (sale: Sale): void => {
    setViewedSale(sale);
    setIsViewModalOpen(true);
  };

  const handleShowProfitDetails = (sale: Sale): void => {
    setProfitSale(sale);
    setIsProfitModalOpen(true);
  };

  // Helper: Compute profit per sale
  const computeSaleProfit = (sale: Sale): number => {
    return sale.products.reduce((sum: number, sp: SaleProduct) => {
      const unitSalePrice = sp.negotiatedPrice ?? sp.basePrice;
      if (sp.batchLevelProfits && sp.batchLevelProfits.length > 0) {
        return (
          sum +
          sp.batchLevelProfits.reduce(
            (batchSum: number, batch: { costPrice: number; consumedQuantity: number }) => batchSum + (unitSalePrice - batch.costPrice) * batch.consumedQuantity,
            0,
          )
        );
      }
      return sum + (unitSalePrice - sp.costPrice) * sp.quantity;
    }, 0);
  };

  // Compute overall profit from all filtered sales
  // Filter out soft-deleted sales (isAvailable === false)
  let filteredSales: Sale[] = (sales || []).filter(sale => sale.isAvailable !== false);
  
  // Apply date range filter
  filteredSales = filteredSales.filter(sale => {
    if (!sale.createdAt?.seconds) return false;
    const saleDate = new Date(sale.createdAt.seconds * 1000);
    return saleDate >= dateRange.from && saleDate <= dateRange.to;
  });
  
  // Calculate credit sales count (before status filter is applied, after date range)
  const creditSalesCount = React.useMemo(() => {
    return countCreditSales(filteredSales);
  }, [filteredSales]);
  
  // Apply status filter (independent)
  if (filterStatus) {
    filteredSales = filteredSales.filter(sale => sale.status === filterStatus);
  }
  
  // Apply search filter (existing)
  if (search.trim()) {
    const s = search.trim().toLowerCase();
    filteredSales = filteredSales.filter(
      (sale) =>
        sale.customerInfo.name.toLowerCase().includes(s) ||
        sale.customerInfo.phone.toLowerCase().includes(s)
    );
  }
  if (sortBy === 'date') {
    filteredSales = filteredSales.slice().sort((a, b) => {
      const aTime = a.createdAt.seconds || 0;
      const bTime = b.createdAt.seconds || 0;
      return sortDir === 'asc' ? aTime - bTime : bTime - aTime;
    });
  } else if (sortBy === 'amount') {
    filteredSales = filteredSales.slice().sort((a, b) => {
      return sortDir === 'asc' ? a.totalAmount - b.totalAmount : b.totalAmount - a.totalAmount;
    });
  }
  const totalRows: number = filteredSales.length;
  const totalPages: number = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const pagedSales: Sale[] = filteredSales.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const overallTotalProfit = filteredSales.reduce((sum, sale) => sum + computeSaleProfit(sale), 0);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    setFilterStatus(e.target.value || null);
  };

  const handleCreditFilterClick = (): void => {
    setFilterStatus(filterStatus === 'credit' ? null : 'credit');
    setPage(1); // Reset to first page when filter changes
  };

  const handleDateRangeChange = (range: { from: Date; to: Date }) => {
    setDateRange(range);
    setPage(1); // Reset to first page when filter changes
  };

  const handleSettleCredit = async (
    saleId: string,
    paymentMethod: 'cash' | 'mobile_money' | 'card',
    amountPaid: number,
    transactionReference?: string,
    mobileMoneyPhone?: string
  ): Promise<void> => {
    if (!user?.uid || !company?.id) {
      throw new Error('User or company not found');
    }

    try {
      // Update sale status from credit to paid with payment details
      await updateSaleStatus(
        saleId,
        'paid',
        'paid',
        user.uid,
        paymentMethod,
        amountPaid,
        transactionReference,
        mobileMoneyPhone
      );
      
      showSuccessToast(t('sales.messages.creditSettled') || 'Credit sale marked as paid');
      // Refresh sales list
      refreshSales();
    } catch (error: any) {
      logError('Error settling credit sale', error);
      showErrorToast(error.message || t('sales.messages.errors.settleCreditFailed') || 'Failed to settle credit sale');
      throw error;
    }
  };

  const handleCancelCredit = async (saleId: string): Promise<void> => {
    if (!user?.uid || !company?.id) {
      throw new Error('User or company not found');
    }

    try {
      await cancelCreditSale(saleId, user.uid, company.id);
      showSuccessToast(t('sales.messages.creditCancelled') || 'Credit sale cancelled and stock restored');
      // Refresh sales list
      refreshSales();
    } catch (error: any) {
      logError('Error cancelling credit sale', error);
      showErrorToast(error.message || t('sales.messages.errors.cancelCreditFailed') || 'Failed to cancel credit sale');
      throw error;
    }
  };

  const handleRefundCredit = async (
    saleId: string,
    refundAmount: number,
    reason?: string,
    paymentMethod?: 'cash' | 'mobile_money' | 'card',
    transactionReference?: string
  ): Promise<void> => {
    if (!user?.uid) {
      throw new Error('User not found');
    }

    try {
      await refundCreditSale(
        saleId,
        refundAmount,
        user.uid,
        reason,
        paymentMethod,
        transactionReference
      );
      showSuccessToast(t('sales.refund.success') || 'Refund processed successfully');
      // Refresh sales list
      refreshSales();
    } catch (error: any) {
      logError('Error refunding credit sale', error);
      showErrorToast(error.message || t('sales.refund.errors.failed') || 'Failed to process refund');
      throw error;
    }
  };

  const handleEditSale = async (): Promise<void> => {
    if (!currentSale) return;
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      Object.values(errors).forEach((error) => showWarningToast(error));
      return;
    }
    try {
      setIsSubmitting(true);
      const totalAmount = calculateTotal();
      const saleProducts: SaleProduct[] = formData.products.map((p) => {
        const quantity = parseInt(p.quantity, 10);
        const basePrice = p.product!.sellingPrice;
        const negotiatedPrice = p.negotiatedPrice ? parseFloat(p.negotiatedPrice) : undefined;
        const costPrice = p.product!.costPrice ?? 0;
        const priceUsed = negotiatedPrice ?? basePrice;
        const profit = (priceUsed - costPrice) * quantity;
        const profitMargin = costPrice > 0 ? ((priceUsed - costPrice) / costPrice) * 100 : 0;
        return {
          productId: p.product!.id,
          quantity,
          basePrice,
          ...(negotiatedPrice !== undefined ? { negotiatedPrice } : {}),
          costPrice,
          profit,
          profitMargin,
        };
      });
      const customerInfo = {
        name: formData.customerName,
        phone: formData.customerPhone,
        ...(formData.customerQuarter && { quarter: formData.customerQuarter }),
      };
      const updateData: Partial<Sale> = {};
      // Include companyId - required by Firebase rules
      if (company?.id) updateData.companyId = company.id;
      if (saleProducts) updateData.products = saleProducts;
      if (totalAmount !== undefined) updateData.totalAmount = totalAmount;
      if (formData.status) updateData.status = formData.status;
      if (customerInfo) updateData.customerInfo = customerInfo;
      if (formData.customerSourceId) updateData.customerSourceId = formData.customerSourceId;
      if (formData.deliveryFee !== undefined && formData.deliveryFee !== '')
        updateData.deliveryFee = parseFloat(formData.deliveryFee);
      // OPTIMIZATION: Use updateSaleDocument directly instead of useSales() hook
      // This avoids duplicate subscription (useInfiniteSales already provides real-time updates)
      await updateSaleDocument(currentSale.id, updateData, company?.id || '');
      
      // Update the sale in the local list immediately
      // Merge current sale data with updates to ensure all fields are preserved
      const updatedSale: Sale = {
        ...currentSale,
        ...updateData,
        id: currentSale.id,
        createdAt: currentSale.createdAt,
        updatedAt: new Date() as any
      };
      updateSaleInList(currentSale.id, updatedSale);
      
      setIsEditModalOpen(false);
      setCurrentSale(null);
      resetForm();
      showSuccessToast(t('sales.messages.saleUpdated'));
    } catch (err) {
      logError('Failed to update sale', err);
      showErrorToast(t('sales.messages.errors.updateSale'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (sale: Sale): void => {
    setCurrentSale(sale);
    setFormData({
      customerName: sale.customerInfo.name,
      customerPhone: sale.customerInfo.phone,
      customerQuarter: sale.customerInfo.quarter || '',
      customerSourceId: sale.customerSourceId || '',
      status: sale.status,
      deliveryFee: sale.deliveryFee?.toString() || '',
      products: sale.products.map((p: SaleProduct) => {
        const product = products?.find((prod) => prod.id === p.productId);
        return {
          product: product || null,
          quantity: p.quantity.toString(),
          negotiatedPrice: p.negotiatedPrice?.toString() || '',
        };
      }),
    });
    setIsEditModalOpen(true);
  };

  const handleCopyLink = (saleId: string): void => {
    const link = `${window.location.origin}/track/${saleId}`;
    const message = t('sales.modals.link.message.preview', { link });
    navigator.clipboard.writeText(message).then(() => {
      showSuccessToast(t('sales.messages.messageCopied'));
    });
  };

  const handleShareInvoice = async (sale: Sale): Promise<void> => {
    try {
      const filename = generateInvoiceFileName(
        sale.customerInfo.name,
        company?.name || ''
      );
      const result = await generatePDFBlob(sale, products || [], company || {}, filename.replace('.pdf', ''));
      if (!(result instanceof Blob)) {
        throw new Error('PDF generation did not return a Blob');
      }
      const pdfFile = new File([result], filename, { type: 'application/pdf' });
      if (navigator.share) {
        try {
          await navigator.share({
            files: [pdfFile],
            title: `Facture - ${sale.customerInfo.name}`,
            text: `Facture pour la commande de ${sale.customerInfo.name}`,
          });
          showSuccessToast(t('sales.messages.invoiceShared'));
        } catch (err) {
          if (err instanceof Error && err.name !== 'AbortError') {
            const url = URL.createObjectURL(result);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showSuccessToast(t('sales.messages.invoiceDownloaded'));
          }
        }
      } else {
        const url = URL.createObjectURL(result);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSuccessToast(t('sales.messages.invoiceDownloaded'));
      }
    } catch (error) {
      console.error('Error sharing invoice:', error);
      showErrorToast(t('sales.messages.errors.shareInvoice'));
    }
  };

  const handleDeleteSale = async (): Promise<void> => {
    if (!currentSale || !company?.id) return;
    setDeleteLoading(true);
    try {
      await softDeleteSale(currentSale.id, company.id);
      // Remove sale from list immediately for instant UI update
      removeSaleFromList(currentSale.id);
      setIsDeleteModalOpen(false);
      setCurrentSale(null);
      showSuccessToast(t('sales.messages.saleDeleted'));
    } catch (err) {
      logError('Failed to delete sale', err);
      showErrorToast(t('sales.messages.errors.deleteSale'));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteClick = (sale: Sale): void => {
    setCurrentSale(sale);
    setIsDeleteModalOpen(true);
  };

  const getProductDetails = (sale: Sale) => {
    return sale.products.map((sp: SaleProduct, idx: number) => {
      const product = products?.find((p) => p.id === sp.productId);
      return (
        <tr key={sp.productId + idx} className="bg-gray-50">
          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 font-medium">
            {product ? product.name : t('sales.table.unknownProduct')}
          </td>
          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{sp.quantity}</td>
          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
            {formatPrice(sp.basePrice)} XAF
          </td>
          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
            {sp.negotiatedPrice ? formatPrice(sp.negotiatedPrice) : '-'} XAF
          </td>
          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
            {product ? product.reference : '-'}
          </td>
        </tr>
      );
    });
  };

  const renderRows = (data: Sale[]) => {
    return data.map((sale) => {
      const isExpanded = expandedSaleId === sale.id;
      const saleProfit = computeSaleProfit(sale);
      return [
        <tr 
          key={sale.id} 
          className={`group transition cursor-pointer ${
            sale.status === 'credit' 
              ? 'bg-orange-50/50 hover:bg-orange-100/50' 
              : 'hover:bg-gray-50'
          }`} 
          onClick={() => handleViewSale(sale)}
        >
          <td
            className="px-2 py-4 text-center align-middle cursor-pointer w-8"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedSaleId(isExpanded ? null : sale.id);
            }}
          >
            {isExpanded ? (
              <ChevronDown size={18} className="mx-auto text-emerald-600" />
            ) : (
              <ChevronRight size={18} className="mx-auto text-gray-400 group-hover:text-emerald-600" />
            )}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            {sale.customerInfo.name}
            <div className="text-xs text-gray-600 mt-1">
              Profit: {formatPrice(saleProfit)} XAF
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm">
            <a href={`tel:${sale.customerInfo.phone}`} className="text-blue-600 hover:underline">
              {sale.customerInfo.phone}
            </a>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
            {t('sales.table.productCount', {
              count: sale.products.length,
              defaultValue: `${sale.products.length} products`,
            })}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm">
            {formatPrice(sale.totalAmount)} XAF
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm">
            {sale.createdAt && typeof sale.createdAt.seconds === 'number'
              ? format(new Date(sale.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm')
              : 'Pending...'}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm">
            {(() => {
              let variant: 'success' | 'warning' | 'info' = 'warning';
              if (sale.status === 'paid') variant = 'success';
              if (sale.status === 'under_delivery') variant = 'info';
              if (sale.status === 'credit') variant = 'warning'; // Orange/yellow for credit
              const statusLabel = sale.status === 'credit' 
                ? (t('sales.filters.status.credit') || 'Credit')
                : t(`sales.filters.status.${sale.status}`);
              return (
                <Badge 
                  variant={variant}
                  className={sale.status === 'credit' ? 'bg-orange-500 text-white' : ''}
                >
                  {statusLabel}
                </Badge>
              );
            })()}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
            {sale.customerSourceId ? (() => {
              const source = activeSources.find(s => s.id === sale.customerSourceId);
              return source ? (
                <div className="flex items-center gap-2">
                  {source.color && (
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: source.color }}
                    />
                  )}
                  <span>{source.name}</span>
                </div>
              ) : (
                <span className="text-gray-400">-</span>
              );
            })() : (
              <span className="text-gray-400">-</span>
            )}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
            {formatCreatorName(sale.createdBy)}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm">
            <div className="flex space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewSale(sale);
                }}
                className="text-blue-600 hover:text-blue-900"
                title={t('sales.actions.viewSale')}
              >
                <Eye size={16} />
              </button>
              {sale.status === 'credit' && (sale.remainingAmount ?? sale.totalAmount) > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSaleToRefund(sale);
                    setIsRefundCreditModalOpen(true);
                  }}
                  className="text-orange-600 hover:text-orange-900"
                  title={t('sales.actions.refundCredit') || 'Remboursement'}
                >
                  <RotateCcw size={16} />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditClick(sale);
                }}
                className="text-indigo-600 hover:text-indigo-900"
                title={t('sales.actions.editSale')}
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleShowProfitDetails(sale);
                }}
                className="text-teal-600 hover:text-teal-900"
                title="View Profit Details"
              >
                <Info size={16} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyLink(sale.id);
                }}
                className="text-green-600 hover:text-green-900"
                title={t('sales.actions.copyLink')}
              >
                {t('sales.actions.copyLink')}
              </button>
              {canDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(sale);
                  }}
                  className="text-red-600 hover:text-red-900 flex items-center"
                  title={t('sales.actions.deleteSale')}
                  disabled={deleteLoading && currentSale?.id === sale.id}
                >
                  {deleteLoading && currentSale?.id === sale.id ? (
                    <Loader2 size={16} className="animate-spin mr-1" />
                  ) : null}
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </td>
        </tr>,
        isExpanded && (
          <tr key={sale.id + '-details'}>
            <td colSpan={10} className="p-0 bg-white border-t-0">
              <div className="overflow-x-auto custom-scrollbar border-t border-gray-100">
                <table className="min-w-[600px] w-full text-sm">
                  <thead className="bg-emerald-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-emerald-700">
                        {t('products.table.columns.name')}
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-emerald-700">
                        {t('sales.modals.add.products.quantity')}
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-emerald-700">
                        {t('products.table.columns.sellingPrice')}
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-emerald-700">
                        {t('sales.modals.add.products.negotiatedPrice')}
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-emerald-700">
                        {t('products.table.columns.reference')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>{getProductDetails(sale)}</tbody>
                </table>
              </div>
            </td>
          </tr>
        ),
      ];
    });
  };

  const handleSort = (col: 'date' | 'amount' | null): void => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  // Move useMemo before early returns to follow Rules of Hooks
  const availableProducts = React.useMemo(
    () =>
      (products || []).filter((p) => {
        if (!p.isAvailable) return false;
        const stock = getEffectiveProductStock(p, stockMap);
        return stock > 0;
      }),
    [products, stockMap]
  );

  // Show skeleton only while loading
  if (salesLoading || productsLoading) {
    return <SkeletonSalesList rows={15} />;
  }

  if (salesError) {
    showErrorToast(t('sales.messages.errors.loadSales'));
    return null;
  }

  const productOptions = availableProducts.map((product) => ({
    label: (
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
          <ImageWithSkeleton
            src={product.images && product.images.length > 0 ? product.images[0] : '/placeholder.png'}
            alt={product.name}
            className="w-full h-full object-cover"
            placeholder="/placeholder.png"
          />
        </div>
        <div>
          <div className="font-medium">{product.name}</div>
          <div className="text-sm text-gray-500">
            {getEffectiveProductStock(product, stockMap)} {t('sales.modals.add.products.inStock')} - {formatPrice(product.sellingPrice)} XAF
          </div>
        </div>
      </div>
    ),
    value: product,
  }));

  // Removed unused handleSaveCustomer to avoid warnings

  const handleSelectCustomer = (customer: Customer): void => {
    setFormData((prev) => ({
      ...prev,
      customerPhone: customer.phone,
      customerName: customer.name || '',
      customerQuarter: customer.quarter || '',
    }));
    setShowCustomerDropdown(false);
  };

  return (
    <div className="pb-16 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-2">
        <div className="flex-1">
          <input
            type="text"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
            placeholder={t('sales.filters.search') || 'Search by name or phone...'}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {t('sales.table.rowsPerPage') || 'Rows per page:'}
          </span>
          <select
            className="rounded-md border border-gray-300 shadow-sm py-1 px-2 bg-white focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(1);
            }}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
      {/* Date Range Filter - positioned below search bar */}
      <div className="mb-4">
        <DateRangePicker 
          onChange={handleDateRangeChange}
          className="w-full"
        />
      </div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('sales.title')}</h1>
          <p className="text-gray-600">{t('sales.subtitle')}</p>
          <p className="text-gray-800 mt-2 font-medium">
            {t('sales.overallProfit', { defaultValue: 'Total Profit:' })} {formatPrice(overallTotalProfit)} XAF
          </p>
        </div>

        {/* Sync Indicator */}
        <SyncIndicator
          isSyncing={salesSyncing}
          message="Updating sales..."
          className="mb-4"
        />

        <div className="mt-4 md:mt-0 grid grid-cols-2 gap-2 md:flex md:flex-row md:space-x-2 md:gap-0">
          {/* Row 1: Status filters */}
          <select
            className="border rounded-md p-2"
            onChange={handleFilterChange}
            value={filterStatus || ''}
          >
            <option value="">{t('sales.filters.allStatuses')}</option>
            <option value="commande">{t('sales.filters.status.commande')}</option>
            <option value="under_delivery">{t('sales.filters.status.under_delivery')}</option>
            <option value="paid">{t('sales.filters.status.paid')}</option>
            <option value="credit">{t('sales.filters.status.credit') || 'Credit'}</option>
          </select>
          
          {/* Credit Sales Filter Button */}
          <button
            onClick={handleCreditFilterClick}
            className={`relative px-4 py-2 rounded-md border-2 transition-colors flex items-center justify-center space-x-2 ${
              filterStatus === 'credit'
                ? 'border-orange-500 bg-orange-50 text-orange-700'
                : 'border-gray-300 bg-white text-gray-700 hover:border-orange-300 hover:bg-orange-50'
            }`}
            title={t('sales.filters.creditSales') || 'Credit Sales'}
          >
            <Clock size={16} className={filterStatus === 'credit' ? 'text-orange-600' : 'text-gray-600'} />
            <span className="text-sm font-medium">{t('sales.filters.creditSales') || 'Credit Sales'}</span>
            {creditSalesCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                filterStatus === 'credit'
                  ? 'bg-orange-600 text-white'
                  : 'bg-orange-500 text-white'
              }`}>
                {creditSalesCount}
              </span>
            )}
          </button>
          
          {/* Row 2: Action buttons */}
          <Button
            icon={<FileText size={16} />}
            onClick={() => setIsReportModalOpen(true)}
            variant="outline"
            className="w-full md:w-auto"
          >
            Générer un rapport
          </Button>
          <PermissionButton
            resource={RESOURCES.SALES}
            action="create"
            icon={<Plus size={16} />}
            onClick={() => setIsAddModalOpen(true)}
            hideWhenNoPermission
            className="w-full md:w-auto"
          >
            {t('sales.actions.addSale')}
          </PermissionButton>
        </div>
      </div>
      <Card>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-8"></th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort(null)}
                >
                  {t('sales.table.columns.name')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('sales.table.columns.phone')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('sales.table.columns.products')}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('amount')}
                >
                  {t('sales.table.columns.amount')}
                  {sortBy === 'amount' &&
                    (sortDir === 'asc'
                      ? ` ${t('common.ascArrow', { defaultValue: '▲' })}`
                      : ` ${t('common.descArrow', { defaultValue: '▼' })}`)}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('date')}
                >
                  {t('sales.table.columns.date') || t('common.date') || 'Date'}
                  {sortBy === 'date' &&
                    (sortDir === 'asc'
                      ? ` ${t('common.ascArrow', { defaultValue: '▲' })}`
                      : ` ${t('common.descArrow', { defaultValue: '▼' })}`)}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('sales.table.columns.status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Créé par
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('sales.table.columns.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pagedSales && pagedSales.length > 0 ? (
                renderRows(pagedSales).flat()
              ) : (
                <tr>
                  <td colSpan={11} className="px-6 py-4 text-center text-sm text-gray-500">
                    {t('sales.table.emptyMessage')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-4 px-2 sm:px-4">
          <span className="text-xs sm:text-sm text-gray-600">
            {t('sales.table.showing', {
              from: (page - 1) * rowsPerPage + 1,
              to: Math.min(page * rowsPerPage, totalRows),
              total: totalRows,
            }) ||
              `Showing ${(page - 1) * rowsPerPage + 1}-${Math.min(page * rowsPerPage, totalRows)} of ${totalRows}`}
          </span>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(1)}
              disabled={page === 1}
              icon={<ChevronsLeft size={14} />}
              title={t('common.first') || 'First'}
              className="p-1 sm:p-2"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              icon={<ChevronLeft size={14} />}
              title={t('common.prev') || 'Previous'}
              className="p-1 sm:p-2"
            />
            <span className="text-xs sm:text-sm px-2 sm:px-3 py-1 bg-gray-100 rounded-md">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              icon={<ChevronRight size={14} />}
              title={t('common.next') || 'Next'}
              className="p-1 sm:p-2"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              icon={<ChevronsRight size={14} />}
              title={t('common.last') || 'Last'}
              className="p-1 sm:p-2"
            />
          </div>
        </div>

        {/* Load More Button */}
        {salesHasMore && (
          <div className="flex justify-center py-6">
            <Button
              onClick={loadMoreSales}
              disabled={salesLoadingMore}
              variant="outline"
              icon={salesLoadingMore ? <Loader2 className="animate-spin" size={16} /> : <ChevronDown size={16} />}
            >
              {salesLoadingMore ? t('common.loading') : t('common.loadMore')}
            </Button>
          </div>
        )}
        {!salesHasMore && sales.length > 0 && (
          <div className="text-center py-6 text-gray-500">
            <p>✅ {t('sales.messages.allLoaded', { count: sales.length }) || `All sales loaded (${sales.length} total)`}</p>
          </div>
        )}
      </Card>
      {/* Mobile spacing for floating action button */}
      <div className="h-20 md:hidden"></div>
      <AddSaleModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSaleAdded={() => {
          // Rafraîchir la liste des ventes après l'ajout
          refreshSales();
        }}
      /><SaleDetailsModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        sale={viewedSale}
        products={products || []}
        onSettleCredit={(saleId) => {
          const sale = sales.find(s => s.id === saleId);
          if (sale) {
            setSaleToSettle(sale);
            setIsSettleCreditModalOpen(true);
          }
        }}
        onCancelCredit={handleCancelCredit}
        onRefundCredit={(saleId) => {
          const sale = sales.find(s => s.id === saleId);
          if (sale) {
            setSaleToRefund(sale);
            setIsRefundCreditModalOpen(true);
          }
        }}
      />
      <Modal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} title={t('sales.modals.link.title')} size="lg">
        {shareableLink && currentSale && (
          <div className="space-y-6">
            <div className="bg-emerald-50 p-4 rounded-lg">
              <p className="text-emerald-700 font-medium">{t('sales.modals.link.success.title')}</p>
              <p className="text-sm text-emerald-600 mt-1">
                {t('sales.modals.link.success.customer')}: {currentSale.customerInfo.name}
              </p>
              <p className="text-sm text-emerald-600">
                {t('sales.modals.link.success.totalAmount')}: {formatPrice(currentSale.totalAmount)} XAF
              </p>
            </div>
            <div className="flex justify-end space-x-2 sticky top-0 bg-white z-10 py-2">
              <Button
                variant="outline"
                icon={<Download size={16} />}
                onClick={() => {
                  const filename = generateInvoiceFileName(
                    currentSale.customerInfo.name,
                    company?.name || ''
                  );
                  generatePDF(currentSale, products || [], company || {}, filename.replace('.pdf', ''));
                }}
              >
                {t('sales.modals.link.actions.downloadPDF')}
              </Button>
              <Button variant="outline" icon={<Share size={16} />} onClick={() => handleShareInvoice(currentSale)}>
                {t('sales.modals.link.actions.shareInvoice')}
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                <Invoice sale={currentSale} products={products || []} />
              </div>
            </div>
            <div className="space-y-4 sticky bottom-0 bg-white z-10 pt-2 border-t">
              <p className="font-medium text-gray-900">{t('sales.modals.link.message.title')}</p>
              <div className="bg-gray-50 p-4 rounded-lg text-sm">
                <p className="whitespace-pre-line">{t('sales.modals.link.message.preview', { link: shareableLink })}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareableLink);
                    showSuccessToast(t('sales.messages.linkCopied'));
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
                >
                  {t('sales.modals.link.actions.copyLinkOnly')}
                </button>
                <button
                  onClick={() => {
                    const message = t('sales.modals.link.message.preview', { link: shareableLink });
                    navigator.clipboard.writeText(message);
                    showSuccessToast(t('sales.messages.messageCopied'));
                  }}
                  className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors"
                >
                  {t('sales.modals.link.actions.copyWithMessage')}
                </button>
              </div>
              <p className="text-sm text-gray-500">{t('sales.modals.link.message.help')}</p>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={t('sales.modals.edit.title')}
        footer={
          <ModalFooter
            onCancel={() => setIsEditModalOpen(false)}
            onConfirm={handleEditSale}
            confirmText={t('sales.modals.edit.updateSale')}
            cancelText={t('sales.modals.common.cancel')}
            isLoading={isSubmitting}
          />
        }
      >
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t('sales.modals.edit.customerInfo.name')}
                name="customerName"
                value={formData.customerName}
                onChange={handleInputChange}
                required
              />
              <Input
                label={t('sales.modals.edit.customerInfo.quarter')}
                name="customerQuarter"
                value={formData.customerQuarter}
                onChange={handleInputChange}
                placeholder={t('sales.modals.edit.customerInfo.quarterPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('sales.modals.edit.customerInfo.phone')}
              </label>
              <Input
                type="tel"
                name="customerPhone"
                value={formData.customerPhone}
                onChange={handlePhoneChange}
                placeholder={t('sales.modals.edit.customerInfo.phone')}
                className="w-full"
                required
                helpText={t('sales.modals.edit.customerInfo.phoneHelp')}
              />
            </div>
            {activeSources.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source Clientelle <span className="text-gray-500 font-normal">(optionnel)</span>
                </label>
                <Select
                  options={[
                    { value: '', label: 'Aucune source', color: '#9CA3AF' },
                    ...activeSources.map(source => ({
                      value: source.id,
                      label: source.name,
                      color: source.color || '#3B82F6'
                    }))
                  ]}
                  value={
                    formData.customerSourceId && activeSources.find(s => s.id === formData.customerSourceId)
                      ? { 
                          value: formData.customerSourceId, 
                          label: activeSources.find(s => s.id === formData.customerSourceId)?.name || '',
                          color: activeSources.find(s => s.id === formData.customerSourceId)?.color || '#3B82F6'
                        }
                      : null
                  }
                  onChange={(option) => {
                    setFormData(prev => ({
                      ...prev,
                      customerSourceId: option?.value || ''
                    }));
                  }}
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
                  placeholder="Sélectionner une source (optionnel)..."
                  isSearchable={false}
                />
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">{t('sales.modals.edit.products.title')}</h3>
              <Button variant="outline" icon={<Plus size={16} />} onClick={addProductField}>
                {t('sales.modals.edit.products.addProduct')}
              </Button>
            </div>
            {formData.products.map((product, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <Select
                      options={productOptions}
                      value={productOptions.find((option) => option.value.id === product.product?.id)}
                      onChange={(option) => handleProductChange(index, option)}
                      isSearchable
                      placeholder={t('sales.modals.edit.products.selectPlaceholder')}
                      className="text-sm"
                    />
                  </div>
                  {index > 0 && (
                    <button onClick={() => removeProductField(index)} className="ml-2 p-2 text-red-600 hover:text-red-900">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                {product.product && (
                  <>
                    <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-md">
                      <div>
                        <span className="text-sm font-medium text-gray-700">
                          {t('sales.modals.edit.products.standardPrice')}:
                        </span>
                        <span className="ml-2">{formatPrice(product.product.sellingPrice)} XAF</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700">
                          {t('sales.modals.edit.products.availableStock')}:
                        </span>
                        <span className="ml-2">{getEffectiveProductStock(product.product, stockMap)}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label={t('sales.modals.edit.products.quantity')}
                        type="number"
                        min="1"
                        step="1"
                        max={getEffectiveProductStock(product.product, stockMap).toString()}
                        value={product.quantity}
                        onChange={(e) => handleProductInputChange(index, 'quantity', e.target.value)}
                        required
                        helpText={t('sales.modals.edit.products.cannotExceed', { value: getEffectiveProductStock(product.product, stockMap) })}
                      />
                      <PriceInput
                        label={t('sales.modals.edit.products.negotiatedPrice')}
                        name={`negotiatedPrice-${index}`}
                        value={product.negotiatedPrice}
                        onChange={(e) => handleProductInputChange(index, 'negotiatedPrice', e.target.value)}
                      />
                    </div>
                    {product.quantity && (
                      <div className="p-3 bg-blue-50 rounded-md">
                        <span className="text-sm font-medium text-blue-700">
                          {t('sales.modals.edit.products.productTotal')}:
                        </span>
                        <span className="ml-2 text-blue-900">{formatPrice(calculateProductTotal(product))} XAF</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
            {formData.products.some((p) => p.quantity) && (
              <div className="p-4 bg-emerald-50 rounded-md">
                <span className="text-lg font-medium text-emerald-700">
                  {t('sales.modals.edit.products.totalAmount')}:
                </span>
                <span className="ml-2 text-emerald-900 text-lg">{formatPrice(calculateTotal())} XAF</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <PriceInput
              label={t('sales.modals.edit.delivery.fee')}
              name="deliveryFee"
              value={formData.deliveryFee}
              onChange={handleInputChange}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('sales.modals.edit.status.label')}
              </label>
              <select
                name="status"
                className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={formData.status}
                onChange={handleInputChange}
              >
                <option value="commande">{t('sales.filters.status.commande')}</option>
                <option value="under_delivery">{t('sales.filters.status.under_delivery')}</option>
                <option value="paid">{t('sales.filters.status.paid')}</option>
                <option value="credit">{t('sales.filters.status.credit') || 'Credit'}</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t('sales.modals.delete.title')}
        footer={
          <ModalFooter
            onCancel={() => setIsDeleteModalOpen(false)}
            onConfirm={handleDeleteSale}
            confirmText={t('sales.modals.delete.confirm')}
            cancelText={t('sales.modals.common.cancel')}
            isLoading={deleteLoading}
            isDanger={true}
          />
        }
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            {t('sales.modals.delete.message', {
              customerName: currentSale?.customerInfo.name,
              amount: formatPrice(currentSale?.totalAmount ?? 0),
            })}
          </p>
          <div className="bg-red-50 p-4 rounded-md">
            <p className="text-sm text-red-700">{t('sales.modals.delete.warning')}</p>
          </div>
        </div>
      </Modal>
      {showCustomerDropdown && customerSearch && customerDropdownPos &&
        createPortal(
          <div
            className="bg-white border border-gray-200 rounded shadow z-50 max-h-48 overflow-y-auto mt-1"
            style={{
              position: 'absolute',
              top: customerDropdownPos.top,
              left: customerDropdownPos.left,
              width: customerDropdownPos.width,
            }}
          >
            {customers
              .filter(
                (c) =>
                  normalizePhone(c.phone).startsWith(normalizePhone(customerSearch)) ||
                  (c.name && c.name.toLowerCase().includes(customerSearch.toLowerCase()))
              )
              .slice(0, 5)
              .map((c) => (
                <button
                  key={c.id}
                  className="block w-full text-left px-4 py-2 hover:bg-emerald-50"
                  onClick={() => handleSelectCustomer(c)}
                >
                  <div className="font-medium">{c.name || t('sales.modals.add.customerInfo.divers')}</div>
                  <div className="text-xs text-gray-500">
                    {c.phone}
                    {c.quarter ? ` • ${c.quarter}` : ''}
                  </div>
                </button>
              ))}
            {customers.filter(
              (c) =>
                normalizePhone(c.phone).startsWith(normalizePhone(customerSearch)) ||
                (c.name && c.name.toLowerCase().includes(customerSearch.toLowerCase()))
            ).length === 0 && (
                <div className="px-4 py-2 text-gray-400 text-sm">{t('common.noResults')}</div>
              )}
          </div>,
          document.body
        )
      }
      <SettleCreditModal
        isOpen={isSettleCreditModalOpen}
        onClose={() => {
          setIsSettleCreditModalOpen(false);
          setSaleToSettle(null);
        }}
        sale={saleToSettle}
        onSettle={handleSettleCredit}
      />
      <RefundCreditModal
        isOpen={isRefundCreditModalOpen}
        onClose={() => {
          setIsRefundCreditModalOpen(false);
          setSaleToRefund(null);
        }}
        sale={saleToRefund}
        onRefund={handleRefundCredit}
      />
      <ProfitDetailsModal
        isOpen={isProfitModalOpen}
        onClose={() => setIsProfitModalOpen(false)}
        sale={profitSale}
        products={products || []}
      />

      <SalesReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        sales={sales}
        products={products}
        companyId={company?.id || ''}
        companyName={company?.name}
        companyLogo={company?.logo}
      />
    </div>
  );
};

export default Sales;