import { useState, useEffect } from 'react';
import { Plus, Edit2, Eye, Trash2, Download, Share, Save } from 'lucide-react';
import Select from 'react-select';
import Table from '../components/common/Table';
import Modal, { ModalFooter } from '../components/common/Modal';
import Input from '../components/common/Input';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import { useSales, useProducts } from '../hooks/useFirestore';
import type { Product, OrderStatus, Sale, SaleProduct, Customer } from '../types/models';
import type { Column } from '../components/common/Table';
import LoadingScreen from '../components/common/LoadingScreen';
import { showSuccessToast, showErrorToast, showWarningToast } from '../utils/toast';
import Invoice from '../components/sales/Invoice';
import { generatePDF } from '../utils/pdf';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { deleteSale as deleteSaleFromFirestore, getCustomerByPhone, addCustomer } from '../services/firestore';

interface FormProduct {
  product: Product | null;
  quantity: string;
  negotiatedPrice: string;
}

interface ProductOption {
  label: React.ReactNode;
  value: Product;
}

const Sales = () => {
  const { t } = useTranslation();
  const { sales, loading: salesLoading, error: salesError, addSale, updateSale, deleteSale } = useSales();
  const { products, loading: productsLoading } = useProducts();
  const { user } = useAuth();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentSale, setCurrentSale] = useState<Sale | null>(null);
  const [viewedSale, setViewedSale] = useState<Sale | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [shareableLink, setShareableLink] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerQuarter: '',
    status: 'commande' as OrderStatus,
    deliveryFee: '',
    products: [{ product: null, quantity: '', negotiatedPrice: '' }] as FormProduct[]
  });
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhoneChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove all non-digit characters
    const value = e.target.value.replace(/\D/g, '');
    setFormData(prev => ({ ...prev, customerPhone: value }));

    // If phone number is complete (e.g., 10 digits), search for customer
    if (value.length >= 10) {
      try {
        const customer = await getCustomerByPhone(value);
        if (customer) {
          setFoundCustomer(customer);
          setFormData(prev => ({
            ...prev,
            customerName: customer.name || '',
            customerQuarter: customer.quarter || ''
          }));
        } else {
          setFoundCustomer(null);
        }
      } catch (err) {
        console.error('Error searching for customer:', err);
      }
    } else {
      setFoundCustomer(null);
    }
  };

  const handleProductChange = (index: number, option: ProductOption | null) => {
    console.log('Product selected:', option?.value); // Debug log
    setFormData(prev => {
      const newProducts = [...prev.products];
      newProducts[index] = {
        ...newProducts[index],
        product: option?.value || null,
        quantity: option?.value ? '1' : '',
        negotiatedPrice: option?.value ? option.value.sellingPrice.toString() : ''
      };
      console.log('Updated products:', newProducts); // Debug log
      return { ...prev, products: newProducts };
    });
  };

  const handleProductInputChange = (index: number, field: keyof FormProduct, value: string) => {
    setFormData(prev => {
      const newProducts = [...prev.products];
      newProducts[index] = {
        ...newProducts[index],
        [field]: value
      };
      return { ...prev, products: newProducts };
    });
  };

  const addProductField = () => {
    setFormData(prev => ({
      ...prev,
      products: [...prev.products, { product: null, quantity: '', negotiatedPrice: '' }]
    }));
  };

  const removeProductField = (index: number) => {
    setFormData(prev => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index)
    }));
  };
  
  const resetForm = () => {
    setFormData({
      customerName: '',
      customerPhone: '',
      customerQuarter: '',
      status: 'commande' as OrderStatus,
      deliveryFee: '',
      products: [{ product: null, quantity: '', negotiatedPrice: '' }]
    });
  };
  
  const calculateProductTotal = (product: FormProduct) => {
    if (!product.product || !product.quantity) return 0;
    const quantity = parseInt(product.quantity);
    const price = product.negotiatedPrice 
      ? parseFloat(product.negotiatedPrice)
      : product.product.sellingPrice;
    return quantity * price;
  };
  
  const calculateTotal = () => {
    return formData.products.reduce((total, product) => total + calculateProductTotal(product), 0);
  };
  
  const validateForm = () => {
    const errors: Record<string, string> = {};
    console.log('Validating form data:', formData); // Debug log

    if (!formData.customerPhone.trim()) {
      errors.customerPhone = t('sales.messages.warnings.customerPhone');
    }

    // Check if there's at least one product selected
    const hasSelectedProducts = formData.products.some(p => p.product !== null);
    console.log('Has selected products:', hasSelectedProducts); // Debug log

    if (!hasSelectedProducts) {
      errors.products = t('sales.messages.warnings.atLeastOneProduct');
      return errors;
    }

    formData.products.forEach((product, index) => {
      if (!product.product) {
        return; // Skip validation for unselected products
      }

      const quantity = parseInt(product.quantity);
      if (isNaN(quantity) || quantity <= 0) {
        errors[`quantity_${index}`] = t('sales.messages.warnings.quantityInvalid');
      } else if (quantity > product.product.stock) {
        errors[`quantity_${index}`] = t('sales.messages.warnings.quantityExceeded', { stock: product.product.stock });
      }

      const negotiatedPrice = parseFloat(product.negotiatedPrice);
      if (!isNaN(negotiatedPrice) && negotiatedPrice > product.product.sellingPrice) {
        errors[`price_${index}`] = t('sales.messages.warnings.priceExceeded');
      }
    });

    const deliveryFee = parseFloat(formData.deliveryFee);
    if (!isNaN(deliveryFee) && deliveryFee < 0) {
      errors.deliveryFee = t('sales.messages.warnings.deliveryFeeInvalid');
    }

    console.log('Validation errors:', errors); // Debug log
    return errors;
  };
  
  const handleGenerateLink = (saleId: string) => {
    const link = `${window.location.origin}/track/${saleId}`;
    setShareableLink(link);
    setIsLinkModalOpen(true);
  };

  const handleAddSale = async () => {
    console.log('Starting sale creation with form data:', formData); // Debug log
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      Object.values(errors).forEach(error => showWarningToast(error));
      return;
    }

    if (!user?.uid) {
      showErrorToast(t('sales.messages.errors.notLoggedIn'));
      return;
    }

    try {
      setIsSubmitting(true);
      const totalAmount = calculateTotal();

      const saleProducts: SaleProduct[] = formData.products
        .filter(p => p.product !== null && p.quantity) // Only include products that have both product and quantity
        .map(p => ({
          productId: p.product!.id,
          quantity: parseInt(p.quantity),
          basePrice: p.product!.sellingPrice,
          negotiatedPrice: p.negotiatedPrice ? parseFloat(p.negotiatedPrice) : p.product!.sellingPrice,
        }));

      console.log('Creating sale with products:', saleProducts); // Debug log

      const customerInfo = {
        name: formData.customerName,
        phone: formData.customerPhone,
        ...(formData.customerQuarter && { quarter: formData.customerQuarter })
      };

      const newSale = await addSale({
        products: saleProducts,
        totalAmount,
        status: formData.status,
        customerInfo,
        deliveryFee: formData.deliveryFee ? parseFloat(formData.deliveryFee) : 0,
        paymentStatus: 'pending',
        userId: user.uid
      });

      if (newSale && newSale.id) {
        setCurrentSale(newSale);
        setIsAddModalOpen(false);
        resetForm();
        handleGenerateLink(newSale.id);
        showSuccessToast(t('sales.messages.saleAdded'));
      }
    } catch (err) {
      console.error('Failed to add sale:', err);
      showErrorToast(t('sales.messages.errors.addSale'));
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleViewSale = (sale: Sale) => {
    setViewedSale(sale);
    setIsViewModalOpen(true);
  };

  const filteredSales = filterStatus
    ? sales?.filter(sale => sale.status === filterStatus)
    : sales;

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterStatus(e.target.value || null);
  };

  const handleEditSale = async () => {
    if (!currentSale) return;

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      Object.values(errors).forEach(error => showWarningToast(error));
      return;
    }

    try {
      setIsSubmitting(true);
      const totalAmount = calculateTotal();

      const saleProducts: SaleProduct[] = formData.products.map(p => ({
        productId: p.product!.id,
        quantity: parseInt(p.quantity),
        basePrice: p.product!.sellingPrice,
        negotiatedPrice: p.negotiatedPrice ? parseFloat(p.negotiatedPrice) : undefined,
      }));

      const customerInfo = {
        name: formData.customerName,
        phone: formData.customerPhone,
        ...(formData.customerQuarter && { quarter: formData.customerQuarter })
      };

      // Prepare the update data
      const updateData: Partial<Sale> = {
        products: saleProducts,
        totalAmount,
        status: formData.status,
        customerInfo,
        deliveryFee: formData.deliveryFee ? parseFloat(formData.deliveryFee) : 0,
      };

      // Update the sale
      await updateSale(currentSale.id, updateData);

      // Close modal and reset form only after successful update
      setIsEditModalOpen(false);
      setCurrentSale(null);
      resetForm();
      showSuccessToast(t('sales.messages.saleUpdated'));
    } catch (err) {
      console.error('Failed to update sale:', err);
      showErrorToast(t('sales.messages.errors.updateSale'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update the edit button click handler in the table
  const handleEditClick = (sale: Sale) => {
    setCurrentSale(sale);
    setFormData({
      customerName: sale.customerInfo.name,
      customerPhone: sale.customerInfo.phone,
      customerQuarter: sale.customerInfo.quarter || '',
      status: sale.status,
      deliveryFee: sale.deliveryFee?.toString() || '',
      products: sale.products.map(p => {
        const product = products?.find(prod => prod.id === p.productId);
        return {
          product: product || null,
          quantity: p.quantity.toString(),
          negotiatedPrice: p.negotiatedPrice?.toString() || ''
        };
      })
    });
    setIsEditModalOpen(true);
  };
  
  const handleCopyLink = (saleId: string) => {
    const link = `${window.location.origin}/track/${saleId}`;
    const message = t('sales.modals.link.message.preview', { link });
    navigator.clipboard.writeText(message).then(() => {
      showSuccessToast(t('sales.messages.messageCopied'));
    });
  };

  const handleShareInvoice = async (sale: Sale) => {
    try {
      // Generate PDF blob
      const result = await generatePDF('invoice-content', `facture-${sale.id}`, true);
      if (!result || !(result instanceof Blob)) {
        throw new Error('Failed to generate PDF');
      }

      const pdfFile = new File([result], `facture-${sale.id}.pdf`, { type: 'application/pdf' });

      // Check if Web Share API is available
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
            // If sharing fails, fall back to download
            const url = URL.createObjectURL(result);
            const a = document.createElement('a');
            a.href = url;
            a.download = `facture-${sale.id}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showSuccessToast(t('sales.messages.invoiceDownloaded'));
          }
        }
      } else {
        // Fallback for browsers that don't support Web Share API
        const url = URL.createObjectURL(result);
        const a = document.createElement('a');
        a.href = url;
        a.download = `facture-${sale.id}.pdf`;
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

  const handleDeleteSale = async () => {
    if (!currentSale || !user?.uid) return;

    try {
      setIsSubmitting(true);
      await deleteSaleFromFirestore(currentSale.id, user.uid);
      setIsDeleteModalOpen(false);
      setCurrentSale(null);
      showSuccessToast(t('sales.messages.saleDeleted'));
    } catch (err) {
      console.error('Failed to delete sale:', err);
      showErrorToast(t('sales.messages.errors.deleteSale'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (sale: Sale) => {
    setCurrentSale(sale);
    setIsDeleteModalOpen(true);
  };

  const columns: Column<Sale>[] = [
    {
      header: t('sales.table.columns.name'),
      accessor: (sale: Sale) => sale.customerInfo.name,
    },
    {
      header: t('sales.table.columns.phone'),
      accessor: (sale: Sale) => (
        <a href={`tel:${sale.customerInfo.phone}`} className="text-blue-600 hover:underline">
          {sale.customerInfo.phone}
        </a>
      ),
    },
    {
      header: t('sales.table.columns.products'),
      accessor: (sale: Sale) => (
        <span className="text-sm text-gray-600">
          {t('sales.table.productCount', { count: sale.products.length, defaultValue: `${sale.products.length} products` })}
        </span>
      ),
    },
    {
      header: t('sales.table.columns.amount'),
      accessor: (sale: Sale) => (
        <span>{sale.totalAmount.toLocaleString()} XAF</span>
      ),
    },
    {
      header: t('sales.table.columns.status'),
      accessor: (sale: Sale) => {
        let variant: 'success' | 'warning' | 'info' = 'warning';
        if (sale.status === 'paid') variant = 'success';
        if (sale.status === 'under_delivery') variant = 'info';

        return <Badge variant={variant}>{t(`sales.filters.status.${sale.status}`)}</Badge>;
      }
    },
    {
      header: t('sales.table.columns.actions'),
      accessor: (sale: Sale) => (
        <div className="flex space-x-2">
          <button
            onClick={() => handleViewSale(sale)}
            className="text-blue-600 hover:text-blue-900"
            title={t('sales.actions.viewSale')}
          >
            <Eye size={16} />
          </button>
          <button
            onClick={() => handleEditClick(sale)}
            className="text-indigo-600 hover:text-indigo-900"
            title={t('sales.actions.editSale')}
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => handleCopyLink(sale.id)}
            className="text-green-600 hover:text-green-900"
            title={t('sales.actions.copyLink')}
          >
            {t('sales.actions.copyLink')}
          </button>
          <button
            onClick={() => handleDeleteClick(sale)}
            className="text-red-600 hover:text-red-900"
            title={t('sales.actions.deleteSale')}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  if (salesLoading || productsLoading) {
    return <LoadingScreen />;
  }

  if (salesError) {
    showErrorToast(t('sales.messages.errors.loadSales'));
    return null;
  }

  const availableProducts = products?.filter(p => p.isAvailable && p.stock > 0) || [];
  const filteredProducts = (productSearchQuery
    ? availableProducts.filter(product =>
        product.name.toLowerCase().includes(productSearchQuery.toLowerCase())
      )
    : availableProducts).slice(0, showAllProducts ? undefined : 10);

  const productOptions = availableProducts.map(product => ({
    label: (
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
          <img 
            src={product.imageUrl || '/placeholder.png'} 
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <div className="font-medium">{product.name}</div>
          <div className="text-sm text-gray-500">
            {product.stock} {t('sales.modals.add.products.inStock')} - {product.sellingPrice.toLocaleString()} XAF
          </div>
        </div>
      </div>
    ),
    value: product
  }));

  const handleSaveCustomer = async () => {
    if (!user?.uid || !formData.customerPhone) return;

    try {
      setIsSavingCustomer(true);
      const customerData: Customer = {
        phone: formData.customerPhone,
        name: formData.customerName,
        quarter: formData.customerQuarter,
        userId: user.uid,
        createdAt: new Date()
      };

      await addCustomer(customerData);
      setFoundCustomer(customerData);
      showSuccessToast(t('sales.messages.customerSaved'));
    } catch (err) {
      console.error('Error saving customer:', err);
      showErrorToast(t('sales.messages.errors.saveCustomer'));
    } finally {
      setIsSavingCustomer(false);
    }
  };

  return (
    <div className="pb-16 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('sales.title')}</h1>
          <p className="text-gray-600">{t('sales.subtitle')}</p>
        </div>

        <div className="mt-4 md:mt-0 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <select
            className="border rounded-md p-2"
            onChange={handleFilterChange}
            value={filterStatus || ''}
          >
            <option value="">{t('sales.filters.allStatuses')}</option>
            <option value="commande">{t('sales.filters.status.commande')}</option>
            <option value="under_delivery">{t('sales.filters.status.under_delivery')}</option>
            <option value="paid">{t('sales.filters.status.paid')}</option>
          </select>
          <Button
            icon={<Plus size={16} />}
            onClick={() => setIsAddModalOpen(true)}
          >
            {t('sales.actions.addSale')}
          </Button>
        </div>
      </div>

      <Card>
        <Table
          data={filteredSales || []}
          columns={columns}
          keyExtractor={(sale) => sale.id}
          emptyMessage={t('sales.table.emptyMessage')}
        />
      </Card>
      
      {/* View Sale Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={t('sales.modals.view.title')}
        size="lg"
      >
        {viewedSale && (
          <div className="space-y-6">
            {/* Invoice Actions */}
            <div className="flex justify-end space-x-2 mb-4 sticky top-0 bg-white z-10 py-2">
              <Button
                variant="outline"
                icon={<Download size={16} />}
                onClick={() => generatePDF('invoice-content', `facture-${viewedSale.id}`)}
              >
                {t('sales.modals.view.actions.downloadPDF')}
              </Button>
              <Button
                variant="outline"
                icon={<Share size={16} />}
                onClick={() => handleShareInvoice(viewedSale)}
              >
                {t('sales.modals.view.actions.shareInvoice')}
              </Button>
            </div>

            {/* Invoice Preview */}
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                <Invoice sale={viewedSale} products={products || []} />
              </div>
            </div>

            {/* Customer Information Card */}
            <Card>
              <div className="p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">{t('sales.modals.view.customerInfo.title')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">{t('sales.modals.view.customerInfo.name')}</p>
                    <p className="mt-1 text-sm text-gray-900">{viewedSale.customerInfo.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">{t('sales.modals.view.customerInfo.phone')}</p>
                    <a 
                      href={`tel:${viewedSale.customerInfo.phone}`}
                      className="mt-1 text-sm text-blue-600 hover:text-blue-900"
                    >
                      {viewedSale.customerInfo.phone}
                    </a>
                  </div>
                </div>
              </div>
            </Card>

            {/* Products Card */}
            <Card>
              <div className="p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">{t('sales.modals.view.products.title')}</h3>
                <div className="space-y-4">
                  {viewedSale.products.map((product, index) => {
                    const productData = products?.find(p => p.id === product.productId);
                    return (
                      <div key={index} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900">{productData?.name}</p>
                            <p className="text-sm text-gray-500">{t('sales.modals.view.products.quantity')}: {product.quantity}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">{t('sales.modals.view.products.basePrice')}</p>
                            <p className="font-medium text-gray-900">{product.basePrice.toLocaleString()} XAF</p>
                            {product.negotiatedPrice && (
                              <>
                                <p className="text-sm text-gray-500 mt-1">{t('sales.modals.view.products.negotiatedPrice')}</p>
                                <p className="font-medium text-emerald-600">{product.negotiatedPrice.toLocaleString()} XAF</p>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="text-sm text-gray-500">{t('sales.modals.view.products.productTotal')}</p>
                          <p className="font-medium text-emerald-600">
                            {((product.negotiatedPrice || product.basePrice) * product.quantity).toLocaleString()} XAF
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>

            {/* Order Summary Card */}
            <Card>
              <div className="p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">{t('sales.modals.view.orderSummary.title')}</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <p className="text-sm text-gray-500">{t('sales.modals.view.orderSummary.subtotal')}</p>
                    <p className="text-sm text-gray-900">{viewedSale.totalAmount.toLocaleString()} XAF</p>
                  </div>
                  {(viewedSale.deliveryFee ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <p className="text-sm text-gray-500">{t('sales.modals.view.orderSummary.deliveryFee')}</p>
                      <p className="text-sm text-gray-900">{viewedSale.deliveryFee?.toLocaleString()} XAF</p>
                    </div>
                  )}
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex justify-between">
                      <p className="font-medium text-gray-900">{t('sales.modals.view.orderSummary.totalAmount')}</p>
                      <p className="font-medium text-emerald-600">
                        {(viewedSale.totalAmount + (viewedSale.deliveryFee ?? 0)).toLocaleString()} XAF
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Status Information */}
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500">{t('sales.modals.view.status.orderStatus')}</p>
                <Badge variant={
                  viewedSale.status === 'paid' ? 'success' :
                  viewedSale.status === 'under_delivery' ? 'info' : 'warning'
                }>
                  {t(`sales.filters.status.${viewedSale.status}`)}
                </Badge>
              </div>
              {/* <div>
                <p className="text-sm font-medium text-gray-500">{t('sales.modals.view.status.paymentStatus')}</p>
                <Badge variant={
                  viewedSale.paymentStatus === 'paid' ? 'success' :
                  viewedSale.paymentStatus === 'cancelled' ? 'error' : 'warning'
                }>
                  {t(`sales.filters.status.${viewedSale.paymentStatus}`)}
                </Badge>
              </div> */}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() => {
                  handleCopyLink(viewedSale.id);
                  setIsViewModalOpen(false);
                }}
              >
                {t('sales.modals.view.actions.copyTrackingLink')}
              </Button>
              <Button
                onClick={() => {
                  handleEditClick(viewedSale);
                  setIsViewModalOpen(false);
                }}
              >
                {t('sales.modals.view.actions.editSale')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Sale Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={t('sales.modals.add.title')}
        size="xl"
        footer={
          <ModalFooter 
            onCancel={() => setIsAddModalOpen(false)}
            onConfirm={handleAddSale}
            confirmText={t('sales.actions.addSale')}
            cancelText={t('sales.modals.common.cancel')}
            isLoading={isSubmitting}
          />
        }
      >
        <div className="flex flex-col lg:flex-row gap-6 max-w-4xl mx-auto">
          {/* Main Form */}
          <div className="flex-1 space-y-6">
            {/* Customer Information Section */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('sales.modals.add.customerInfo.phone')}
                </label>
                <div className="flex space-x-2">
                  <Input
                    type="tel"
                    name="customerPhone"
                    value={formData.customerPhone}
                    onChange={handlePhoneChange}
                    placeholder={t('sales.modals.add.customerInfo.phone')}
                    className="flex-1"
                    required
                    helpText={t('sales.modals.add.customerInfo.phoneHelp')}
                  />
                  {!foundCustomer && formData.customerPhone.length >= 10 && (
                    <Button
                      variant="outline"
                      icon={<Save size={16} />}
                      onClick={handleSaveCustomer}
                      isLoading={isSavingCustomer}
                    >
                      {t('sales.actions.saveCustomer')}
                    </Button>
                  )}
                </div>
                {foundCustomer && (
                  <div className="mt-2 p-2 bg-emerald-50 rounded-md">
                    <p className="text-sm text-emerald-700">
                      {t('sales.messages.customerFound', { name: foundCustomer.name || t('sales.messages.unnamedCustomer') })}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={t('sales.modals.add.customerInfo.name')}
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleInputChange}
                />
                
                <Input
                  label={t('sales.modals.add.customerInfo.quarter')}
                  name="customerQuarter"
                  value={formData.customerQuarter}
                  onChange={handleInputChange}
                  placeholder={t('sales.modals.add.customerInfo.quarterPlaceholder')}
                />
              </div>
            </div>
            
            {/* Selected Products Section - Desktop View */}
            <div className="hidden lg:block space-y-4">
              <h3 className="text-lg font-medium text-gray-900">{t('sales.modals.add.products.selectedProducts')}</h3>
              <div className="space-y-4">
                {formData.products.map((product, index) => (
                  product.product && (
                    <div key={index} className="p-4 border rounded-lg space-y-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                          <img 
                            src={product.product.imageUrl || '/placeholder.png'} 
                            alt={product.product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{product.product.name}</p>
                          <p className="text-sm text-gray-500">
                            {product.product.stock} {t('sales.modals.add.products.inStock')} - {product.product.sellingPrice.toLocaleString()} XAF
                          </p>
                        </div>
                        <button
                          onClick={() => removeProductField(index)}
                          className="p-2 text-red-600 hover:text-red-900"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label={t('sales.modals.add.products.quantity')}
                          type="number"
                          min="1"
                          max={product.product.stock.toString()}
                          value={product.quantity}
                          onChange={(e) => handleProductInputChange(index, 'quantity', e.target.value)}
                          required
                          helpText={t('sales.modals.add.products.cannotExceed', { stock: product.product.stock })}
                        />
                        
                        <Input
                          label={t('sales.modals.add.products.negotiatedPrice')}
                          type="number"
                          max={product.product.sellingPrice.toString()}
                          value={product.negotiatedPrice}
                          onChange={(e) => handleProductInputChange(index, 'negotiatedPrice', e.target.value)}
                          helpText={t('sales.modals.add.products.cannotExceed', { price: product.product.sellingPrice.toLocaleString() })}
                        />
                      </div>

                      {product.quantity && (
                        <div className="p-3 bg-emerald-50 rounded-md">
                          <span className="text-sm font-medium text-emerald-700">{t('sales.modals.add.products.productTotal')}:</span>
                          <span className="ml-2 text-emerald-900">{calculateProductTotal(product).toLocaleString()} XAF</span>
                        </div>
                      )}
                    </div>
                  )
                ))}
              </div>
            </div>
            
            {/* Products Section - Mobile View */}
            <div className="lg:hidden space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">{t('sales.modals.add.products.title')}</h3>
                <Button
                  variant="outline"
                  icon={<Plus size={16} />}
                  onClick={addProductField}
                >
                  {t('sales.modals.add.products.addProduct')}
                </Button>
              </div>

              {formData.products.map((product, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <Select
                        options={productOptions}
                        value={productOptions.find(option => option.value.id === product.product?.id)}
                        onChange={(option) => handleProductChange(index, option)}
                        isSearchable
                        placeholder={t('sales.modals.add.products.searchPlaceholder')}
                        className="text-sm"
                        classNamePrefix="select"
                        noOptionsMessage={() => t('sales.modals.add.products.noProductsFound')}
                        formatOptionLabel={(option) => option.label}
                      />
                    </div>
                    {index > 0 && (
                      <button
                        onClick={() => removeProductField(index)}
                        className="ml-2 p-2 text-red-600 hover:text-red-900"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  {product.product && (
                    <>
                      <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-md">
                        <div>
                          <span className="text-sm font-medium text-gray-700">{t('sales.modals.add.products.standardPrice')}:</span>
                          <span className="ml-2">{product.product.sellingPrice.toLocaleString()} XAF</span>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">{t('sales.modals.add.products.availableStock')}:</span>
                          <span className="ml-2">{product.product.stock}</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label={t('sales.modals.add.products.quantity')}
                          type="number"
                          min="1"
                          max={product.product.stock.toString()}
                          value={product.quantity}
                          onChange={(e) => handleProductInputChange(index, 'quantity', e.target.value)}
                          required
                          helpText={t('sales.modals.add.products.cannotExceed', { stock: product.product.stock })}
                        />
                        
                        <Input
                          label={t('sales.modals.add.products.negotiatedPrice')}
                          type="number"
                          max={product.product.sellingPrice.toString()}
                          value={product.negotiatedPrice}
                          onChange={(e) => handleProductInputChange(index, 'negotiatedPrice', e.target.value)}
                          helpText={t('sales.modals.add.products.cannotExceed', { price: product.product.sellingPrice.toLocaleString() })}
                        />
                      </div>

                      {product.quantity && (
                        <div className="p-3 bg-emerald-50 rounded-md">
                          <span className="text-sm font-medium text-emerald-700">{t('sales.modals.add.products.productTotal')}:</span>
                          <span className="ml-2 text-emerald-900">{calculateProductTotal(product).toLocaleString()} XAF</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}

              {formData.products.some(p => p.quantity) && (
                <div className="p-4 bg-emerald-50 rounded-md">
                  <span className="text-lg font-medium text-emerald-700">{t('sales.modals.add.products.totalAmount')}:</span>
                  <span className="ml-2 text-emerald-900 text-lg">{calculateTotal().toLocaleString()} XAF</span>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('sales.modals.add.delivery.fee')}
                name="deliveryFee"
                type="number"
                value={formData.deliveryFee}
                onChange={handleInputChange}
              />
            
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('sales.modals.add.status.label')}
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
                </select>
              </div>
            </div>
          </div>

          {/* Products Side Panel - Desktop View */}
          <div className="hidden lg:block w-80 border-l pl-6">
            <div className="sticky top-0">
              <h3 className="text-lg font-medium text-gray-900 mb-4">{t('sales.modals.add.products.title')}</h3>
              
              {/* Search Bar */}
              <div className="mb-4">
                <Input
                  type="text"
                  placeholder={t('sales.modals.add.products.searchPlaceholder')}
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Available Products */}
              <div className="space-y-2">
                <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
                  {filteredProducts.map(product => (
                    <button
                      key={product.id}
                      onClick={() => {
                        const newProduct = { product, quantity: '1', negotiatedPrice: '' };
                        setFormData(prev => ({
                          ...prev,
                          products: [...prev.products, newProduct]
                        }));
                      }}
                      className="w-full p-3 bg-white border rounded-lg hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                          <img 
                            src={product.imageUrl || '/placeholder.png'} 
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{product.name}</p>
                          <p className="text-sm text-gray-500">
                            {product.stock} {t('sales.modals.add.products.inStock')} - {product.sellingPrice.toLocaleString()} XAF
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* View More Button */}
                {!showAllProducts && availableProducts.length > 10 && (
                  <button
                    onClick={() => setShowAllProducts(true)}
                    className="w-full p-2 text-center text-sm text-blue-600 hover:text-blue-900 border-t"
                  >
                    {t('sales.modals.add.products.viewMore')}
                  </button>
                )}
              </div>

              {/* Total Amount */}
              {formData.products.some(p => p.quantity) && (
                <div className="mt-6 p-4 bg-emerald-50 rounded-md">
                  <span className="text-lg font-medium text-emerald-700">{t('sales.modals.add.products.totalAmount')}:</span>
                  <span className="ml-2 text-emerald-900 text-lg">{calculateTotal().toLocaleString()} XAF</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>
      
      {/* Link Modal */}
      <Modal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        title={t('sales.modals.link.title')}
        size="lg"
      >
        {shareableLink && currentSale && (
          <div className="space-y-6">
            <div className="bg-emerald-50 p-4 rounded-lg">
              <p className="text-emerald-700 font-medium">{t('sales.modals.link.success.title')}</p>
              <p className="text-sm text-emerald-600 mt-1">
                {t('sales.modals.link.success.customer')}: {currentSale.customerInfo.name}
              </p>
              <p className="text-sm text-emerald-600">
                {t('sales.modals.link.success.totalAmount')}: {currentSale.totalAmount.toLocaleString()} XAF
              </p>
            </div>

            {/* Invoice Actions */}
            <div className="flex justify-end space-x-2 sticky top-0 bg-white z-10 py-2">
              <Button
                variant="outline"
                icon={<Download size={16} />}
                onClick={() => generatePDF('invoice-content', `facture-${currentSale.id}`)}
              >
                {t('sales.modals.link.actions.downloadPDF')}
              </Button>
              <Button
                variant="outline"
                icon={<Share size={16} />}
                onClick={() => handleShareInvoice(currentSale)}
              >
                {t('sales.modals.link.actions.shareInvoice')}
              </Button>
            </div>

            {/* Invoice Preview */}
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                <Invoice sale={currentSale} products={products || []} />
              </div>
            </div>

            {/* Shareable Link with Message */}
            <div className="space-y-4 sticky bottom-0 bg-white z-10 pt-2 border-t">
              <p className="font-medium text-gray-900">{t('sales.modals.link.message.title')}</p>
              
              {/* Message Preview */}
              <div className="bg-gray-50 p-4 rounded-lg text-sm">
                <p className="whitespace-pre-line">
                  {t('sales.modals.link.message.preview', { link: shareableLink })}
                </p>
              </div>

              {/* Copy Options */}
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

              <p className="text-sm text-gray-500">
                {t('sales.modals.link.message.help')}
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Sale Modal */}
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
          {/* Customer Information Section */}
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
          </div>

          {/* Products Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">{t('sales.modals.edit.products.title')}</h3>
              <Button
                variant="outline"
                icon={<Plus size={16} />}
                onClick={addProductField}
              >
                {t('sales.modals.edit.products.addProduct')}
              </Button>
            </div>

            {formData.products.map((product, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <Select
                      options={productOptions}
                      value={productOptions.find(option => option.value.id === product.product?.id)}
                      onChange={(option) => handleProductChange(index, option)}
                      isSearchable
                      placeholder={t('sales.modals.edit.products.selectPlaceholder')}
                      className="text-sm"
                    />
                  </div>
                  {index > 0 && (
                    <button
                      onClick={() => removeProductField(index)}
                      className="ml-2 p-2 text-red-600 hover:text-red-900"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {product.product && (
                  <>
                    <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-md">
                      <div>
                        <span className="text-sm font-medium text-gray-700">{t('sales.modals.edit.products.standardPrice')}:</span>
                        <span className="ml-2">{product.product.sellingPrice.toLocaleString()} XAF</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700">{t('sales.modals.edit.products.availableStock')}:</span>
                        <span className="ml-2">{product.product.stock}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label={t('sales.modals.edit.products.quantity')}
                        type="number"
                        min="1"
                        max={product.product.stock.toString()}
                        value={product.quantity}
                        onChange={(e) => handleProductInputChange(index, 'quantity', e.target.value)}
                        required
                        helpText={t('sales.modals.edit.products.cannotExceed', { value: product.product.stock })}
                      />
                      
                      <Input
                        label={t('sales.modals.edit.products.negotiatedPrice')}
                        type="number"
                        max={product.product.sellingPrice.toString()}
                        value={product.negotiatedPrice}
                        onChange={(e) => handleProductInputChange(index, 'negotiatedPrice', e.target.value)}
                        helpText={t('sales.modals.edit.products.cannotExceed', { value: product.product.sellingPrice.toLocaleString() })}
                      />
                    </div>

                    {product.quantity && (
                      <div className="p-3 bg-emerald-50 rounded-md">
                        <span className="text-sm font-medium text-emerald-700">{t('sales.modals.edit.products.productTotal')}:</span>
                        <span className="ml-2 text-emerald-900">{calculateProductTotal(product).toLocaleString()} XAF</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            {formData.products.some(p => p.quantity) && (
              <div className="p-4 bg-emerald-50 rounded-md">
                <span className="text-lg font-medium text-emerald-700">{t('sales.modals.edit.products.totalAmount')}:</span>
                <span className="ml-2 text-emerald-900 text-lg">{calculateTotal().toLocaleString()} XAF</span>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('sales.modals.edit.delivery.fee')}
              name="deliveryFee"
              type="number"
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
              </select>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
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
            isLoading={isSubmitting}
            isDanger={true}
          />
        }
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            {t('sales.modals.delete.message', {
              customerName: currentSale?.customerInfo.name,
              amount: currentSale?.totalAmount.toLocaleString()
            })}
          </p>
          <div className="bg-red-50 p-4 rounded-md">
            <p className="text-sm text-red-700">
              {t('sales.modals.delete.warning')}
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Sales;