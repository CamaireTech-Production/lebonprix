import { useState } from 'react';
import { Plus, Edit2, Eye, Trash2, Download, Share2 } from 'lucide-react';
import Select from 'react-select';
import Table from '../components/common/Table';
import Modal, { ModalFooter } from '../components/common/Modal';
import Input from '../components/common/Input';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import { useSales, useProducts } from '../hooks/useFirestore';
import type { Product, OrderStatus, Sale, SaleProduct } from '../types/models';
import type { Column } from '../components/common/Table';
import LoadingScreen from '../components/common/LoadingScreen';
import { showSuccessToast, showErrorToast, showWarningToast } from '../utils/toast';
import Invoice from '../components/sales/Invoice';
import { generatePDF, sharePDF } from '../utils/pdf';
import { useAuth } from '../contexts/AuthContext';

interface FormProduct {
  product: Product | null;
  quantity: string;
  negotiatedPrice: string;
}

const Sales = () => {
  const { sales, loading: salesLoading, error: salesError, addSale, updateSale } = useSales();
  const { products, loading: productsLoading } = useProducts();
  const { user } = useAuth();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [currentSale, setCurrentSale] = useState<any>(null);
  const [viewedSale, setViewedSale] = useState<Sale | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [shareableLink, setShareableLink] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    status: 'commande' as OrderStatus,
    deliveryFee: '',
    products: [{ product: null, quantity: '', negotiatedPrice: '' }] as FormProduct[]
  });
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    if (value.length <= 9) { // Only allow 9 digits after +237
      setFormData(prev => ({ ...prev, customerPhone: value }));
    }
  };

  const handleProductChange = (index: number, option: any) => {
    setFormData(prev => {
      const newProducts = [...prev.products];
      newProducts[index] = {
        ...newProducts[index],
        product: option?.value || null,
        negotiatedPrice: option?.value ? option.value.sellingPrice.toString() : ''
      };
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

    // Validate customer info
    if (!formData.customerName.trim()) {
      errors.customerName = 'Customer name is required.';
    }
    if (!formData.customerPhone.trim()) {
      errors.customerPhone = 'Customer phone is required.';
    }

    // Validate products
    formData.products.forEach((product, index) => {
      if (!product.product) {
        errors[`product_${index}`] = 'Please select a product.';
      }

      const quantity = parseInt(product.quantity);
    if (isNaN(quantity) || quantity <= 0) {
        errors[`quantity_${index}`] = 'Quantity must be greater than zero.';
      } else if (product.product && quantity > product.product.stock) {
        errors[`quantity_${index}`] = `Cannot exceed available stock (${product.product.stock}).`;
    }

      const negotiatedPrice = parseFloat(product.negotiatedPrice);
    if (
      !isNaN(negotiatedPrice) &&
        product.product &&
        negotiatedPrice > product.product.sellingPrice
    ) {
        errors[`price_${index}`] = 'Negotiated price cannot exceed the standard selling price.';
    }
    });

    // Validate delivery fee
    const deliveryFee = parseFloat(formData.deliveryFee);
    if (!isNaN(deliveryFee) && deliveryFee < 0) {
      errors.deliveryFee = 'Delivery fee must be a non-negative number.';
    }

    return errors;
  };
  
  const handleGenerateLink = (saleId: string) => {
    const link = `${window.location.origin}/track/${saleId}`;
    setShareableLink(link);
    setIsLinkModalOpen(true);
  };

  const handleAddSale = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      Object.values(errors).forEach(error => showWarningToast(error));
      return;
    }

    if (!user) {
      showErrorToast('You must be logged in to create a sale');
      return;
    }

    try {
      setIsSubmitting(true);
      const totalAmount = calculateTotal();

      const saleProducts: SaleProduct[] = formData.products.map(p => ({
        productId: p.product!.id,
        quantity: parseInt(p.quantity),
        basePrice: p.product!.sellingPrice,
        negotiatedPrice: p.negotiatedPrice ? parseFloat(p.negotiatedPrice) : p.product!.sellingPrice,
      }));

      const newSale = await addSale({
        products: saleProducts,
        totalAmount,
        status: formData.status,
        customerInfo: {
          name: formData.customerName,
          phone: formData.customerPhone
        },
        deliveryFee: formData.deliveryFee ? parseFloat(formData.deliveryFee) : 0,
        paymentStatus: 'pending',
        userId: user.uid
      });

      if (newSale && newSale.id) {
        setCurrentSale(newSale);
        setIsAddModalOpen(false);
        resetForm();
        handleGenerateLink(newSale.id);
        showSuccessToast('Sale added successfully!');
      }
    } catch (err) {
      console.error('Failed to add sale:', err);
      showErrorToast('Failed to add sale. Please try again.');
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

      // Create the updated sale products array
      const saleProducts: SaleProduct[] = formData.products.map(p => ({
        productId: p.product!.id,
        quantity: parseInt(p.quantity),
        basePrice: p.product!.sellingPrice,
        negotiatedPrice: p.negotiatedPrice ? parseFloat(p.negotiatedPrice) : undefined,
      }));

      // Prepare the update data
      const updateData: Partial<Sale> = {
        products: saleProducts,
        totalAmount,
        status: formData.status,
        customerInfo: {
          name: formData.customerName,
          phone: formData.customerPhone
        },
        deliveryFee: formData.deliveryFee ? parseFloat(formData.deliveryFee) : 0,
      };

      // Update the sale
      await updateSale(currentSale.id, updateData);

      // Close modal and reset form only after successful update
      setIsEditModalOpen(false);
      setCurrentSale(null);
      resetForm();
      showSuccessToast('Sale updated successfully!');
    } catch (err) {
      console.error('Failed to update sale:', err);
      showErrorToast(err instanceof Error ? err.message : 'Failed to update sale. Please try again.');
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
    navigator.clipboard.writeText(link).then(() => {
      showSuccessToast('Link copied to clipboard!');
    });
  };

  const columns: Column<Sale>[] = [
    {
      header: 'Nom',
      accessor: (sale: Sale) => sale.customerInfo.name,
    },
    {
      header: 'Numéro Client',
      accessor: (sale: Sale) => (
        <a href={`tel:${sale.customerInfo.phone}`} className="text-blue-600 hover:underline">
          {sale.customerInfo.phone}
        </a>
      ),
    },
    {
      header: 'Produits',
      accessor: (sale: Sale) => (
        <span className="text-sm text-gray-600">
          {sale.products.length} {sale.products.length === 1 ? 'produit' : 'produits'}
        </span>
      ),
    },
    {
      header: 'Montant',
      accessor: (sale: Sale) => (
        <span>{sale.totalAmount.toLocaleString()} XAF</span>
      ),
    },
    {
      header: 'Status',
      accessor: (sale: Sale) => {
        let variant: 'success' | 'warning' | 'info' = 'warning';
        if (sale.status === 'paid') variant = 'success';
        if (sale.status === 'under_delivery') variant = 'info';

        return <Badge variant={variant}>{sale.status}</Badge>;
      }
    },
    {
      header: 'Actions',
      accessor: (sale: Sale) => (
        <div className="flex space-x-2">
          <button
            onClick={() => handleViewSale(sale)}
            className="text-blue-600 hover:text-blue-900"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={() => handleEditClick(sale)}
            className="text-indigo-600 hover:text-indigo-900"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => handleCopyLink(sale.id)}
            className="text-green-600 hover:text-green-900"
          >
            Copy Link
          </button>
        </div>
      ),
    },
  ];

  if (salesLoading || productsLoading) {
    return <LoadingScreen />;
  }

  if (salesError) {
    showErrorToast('Failed to load sales. Please refresh the page.');
    return null;
  }

  const availableProducts = products?.filter(p => p.isAvailable && p.stock > 0) || [];
  const productOptions = availableProducts.map(product => ({
    label: `${product.name} (${product.stock} in stock)`,
    value: product
  }));

  return (
    <div className="pb-16 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Sales</h1>
          <p className="text-gray-600">Manage your sales transactions</p>
        </div>

        <div className="mt-4 md:mt-0 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <select
            className="border rounded-md p-2"
            onChange={handleFilterChange}
            value={filterStatus || ''}
          >
            <option value="">All Statuses</option>
            <option value="commande">Commande</option>
            <option value="under_delivery">Under Delivery</option>
            <option value="paid">Paid</option>
          </select>
          <Button
            icon={<Plus size={16} />}
            onClick={() => setIsAddModalOpen(true)}
          >
            Add Sale
          </Button>
        </div>
      </div>

      <Card>
        <Table
          data={filteredSales || []}
          columns={columns}
          keyExtractor={(sale) => sale.id}
          emptyMessage="No sales records found"
        />
      </Card>
      
      {/* View Sale Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Sale Details"
        size="lg"
      >
        {viewedSale && (
          <div className="space-y-6">
            {/* Invoice Actions */}
            <div className="flex justify-end space-x-2 mb-4 sticky top-0 bg-white z-10 py-2">
              <Button
                variant="outline"
                icon={<Download size={16} />}
                onClick={() => generatePDF('invoice-content', `invoice-${viewedSale.id}`)}
              >
                Download PDF
              </Button>
              <Button
                variant="outline"
                icon={<Share2 size={16} />}
                onClick={() => sharePDF('invoice-content', `invoice-${viewedSale.id}`)}
              >
                Share Invoice
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
                <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Name</p>
                    <p className="mt-1 text-sm text-gray-900">{viewedSale.customerInfo.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Phone</p>
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
                <h3 className="text-lg font-medium text-gray-900 mb-4">Products</h3>
          <div className="space-y-4">
                  {viewedSale.products.map((product, index) => {
                    const productData = products?.find(p => p.id === product.productId);
                    return (
                      <div key={index} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900">{productData?.name}</p>
                            <p className="text-sm text-gray-500">Quantity: {product.quantity}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Base Price</p>
                            <p className="font-medium text-gray-900">{product.basePrice.toLocaleString()} XAF</p>
                            {product.negotiatedPrice && (
                              <>
                                <p className="text-sm text-gray-500 mt-1">Negotiated Price</p>
                                <p className="font-medium text-emerald-600">{product.negotiatedPrice.toLocaleString()} XAF</p>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="text-sm text-gray-500">Product Total</p>
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
                <h3 className="text-lg font-medium text-gray-900 mb-4">Order Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <p className="text-sm text-gray-500">Subtotal</p>
                    <p className="text-sm text-gray-900">{viewedSale.totalAmount.toLocaleString()} XAF</p>
                  </div>
                  {(viewedSale.deliveryFee ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <p className="text-sm text-gray-500">Delivery Fee</p>
                      <p className="text-sm text-gray-900">{viewedSale.deliveryFee?.toLocaleString()} XAF</p>
                    </div>
                  )}
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex justify-between">
                      <p className="font-medium text-gray-900">Total Amount</p>
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
                <p className="text-sm font-medium text-gray-500">Order Status</p>
                <Badge variant={
                  viewedSale.status === 'paid' ? 'success' :
                  viewedSale.status === 'under_delivery' ? 'info' : 'warning'
                }>
                  {viewedSale.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Payment Status</p>
                <Badge variant={
                  viewedSale.paymentStatus === 'paid' ? 'success' :
                  viewedSale.paymentStatus === 'cancelled' ? 'error' : 'warning'
                }>
                  {viewedSale.paymentStatus}
                </Badge>
              </div>
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
                Copy Tracking Link
              </Button>
              <Button
                onClick={() => {
                  handleEditClick(viewedSale);
                  setIsViewModalOpen(false);
                }}
              >
                Edit Sale
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Sale Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Sale"
        footer={
          <ModalFooter 
            onCancel={() => setIsAddModalOpen(false)}
            onConfirm={handleAddSale}
            confirmText="Add Sale"
            isLoading={isSubmitting}
          />
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Customer Name"
              name="customerName"
              value={formData.customerName}
              onChange={handleInputChange}
              required
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Phone
              </label>
              <div className="flex rounded-md shadow-sm">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                  +237
                </span>
                <Input
                  type="tel"
                  name="customerPhone"
                  value={formData.customerPhone}
                  onChange={handlePhoneChange}
                  placeholder="678904568"
                  className="flex-1 rounded-l-none"
                  required
                  helpText="Enter 9 digits after +237"
                />
              </div>
            </div>
          </div>
          
          {/* Products Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Products</h3>
              <Button
                variant="outline"
                icon={<Plus size={16} />}
                onClick={addProductField}
              >
                Add Product
              </Button>
            </div>

            {formData.products.map((product, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product {index + 1}
            </label>
                    <Select
                      options={productOptions}
                      value={productOptions.find(option => option.value.id === product.product?.id)}
                      onChange={(option) => handleProductChange(index, option)}
                      isSearchable
                      placeholder="Select a product..."
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
                        <span className="text-sm font-medium text-gray-700">Standard Price:</span>
                        <span className="ml-2">{product.product.sellingPrice.toLocaleString()} XAF</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700">Available Stock:</span>
                        <span className="ml-2">{product.product.stock}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Quantity"
                        type="number"
                        min="1"
                        max={product.product.stock.toString()}
                        value={product.quantity}
                        onChange={(e) => handleProductInputChange(index, 'quantity', e.target.value)}
                        required
                        helpText={`Cannot exceed ${product.product.stock}`}
                      />
                      
                      <Input
                        label="Negotiated Price (Optional)"
                        type="number"
                        max={product.product.sellingPrice.toString()}
                        value={product.negotiatedPrice}
                        onChange={(e) => handleProductInputChange(index, 'negotiatedPrice', e.target.value)}
                        helpText={`Cannot exceed ${product.product.sellingPrice.toLocaleString()} XAF`}
                      />
                    </div>

                    {product.quantity && (
                      <div className="p-3 bg-emerald-50 rounded-md">
                        <span className="text-sm font-medium text-emerald-700">Product Total:</span>
                        <span className="ml-2 text-emerald-900">{calculateProductTotal(product).toLocaleString()} XAF</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            {formData.products.some(p => p.quantity) && (
              <div className="p-4 bg-emerald-50 rounded-md">
                <span className="text-lg font-medium text-emerald-700">Total Amount:</span>
                <span className="ml-2 text-emerald-900 text-lg">{calculateTotal().toLocaleString()} XAF</span>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Delivery Fee"
              name="deliveryFee"
              type="number"
              value={formData.deliveryFee}
              onChange={handleInputChange}
            />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              name="status"
              className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={formData.status}
              onChange={handleInputChange}
            >
              <option value="commande">Commande</option>
              <option value="under_delivery">Under Delivery</option>
              <option value="paid">Paid</option>
            </select>
            </div>
          </div>
        </div>
      </Modal>
      
      {/* Link Modal */}
      <Modal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        title="Sale Confirmation"
        size="lg"
      >
        {shareableLink && currentSale && (
          <div className="space-y-6">
            <div className="bg-emerald-50 p-4 rounded-lg">
              <p className="text-emerald-700 font-medium">Sale added successfully!</p>
              <p className="text-sm text-emerald-600 mt-1">
                Customer: {currentSale.customerInfo.name}
              </p>
              <p className="text-sm text-emerald-600">
                Total Amount: {currentSale.totalAmount.toLocaleString()} XAF
              </p>
            </div>

            {/* Invoice Actions */}
            <div className="flex justify-end space-x-2 sticky top-0 bg-white z-10 py-2">
              <Button
                variant="outline"
                icon={<Download size={16} />}
                onClick={() => generatePDF('invoice-content', `invoice-${currentSale.id}`)}
              >
                Download Invoice
              </Button>
              <Button
                variant="outline"
                icon={<Share2 size={16} />}
                onClick={() => sharePDF('invoice-content', `invoice-${currentSale.id}`)}
              >
                Share Invoice
              </Button>
            </div>

            {/* Invoice Preview */}
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                <Invoice sale={currentSale} products={products || []} />
              </div>
            </div>

            {/* Shareable Link */}
            <div className="space-y-4 sticky bottom-0 bg-white z-10 pt-2 border-t">
              <p className="font-medium text-gray-900">Share this tracking link with the client:</p>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={shareableLink}
                  readOnly
                  className="border rounded-md p-2 w-full"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareableLink);
                    showSuccessToast('Link copied to clipboard!');
                  }}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                >
                  Copy
                </button>
              </div>
              <p className="text-sm text-gray-500">
                The client can use this link to track their order status.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Sale Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Sale"
        footer={
          <ModalFooter
            onCancel={() => setIsEditModalOpen(false)}
            onConfirm={handleEditSale}
            confirmText="Update Sale"
            isLoading={isSubmitting}
          />
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
          <Input
            label="Customer Name"
            name="customerName"
            value={formData.customerName}
            onChange={handleInputChange}
            required
          />
            
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Phone
            </label>
            <div className="flex rounded-md shadow-sm">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                +237
              </span>
              <Input
                type="tel"
                name="customerPhone"
                value={formData.customerPhone}
                onChange={handlePhoneChange}
                placeholder="678904568"
                className="flex-1 rounded-l-none"
                required
                helpText="Enter 9 digits after +237"
              />
            </div>
          </div>
          </div>

          {/* Products Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Products</h3>
              <Button
                variant="outline"
                icon={<Plus size={16} />}
                onClick={addProductField}
              >
                Add Product
              </Button>
            </div>

            {formData.products.map((product, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product {index + 1}
                    </label>
                    <Select
                      options={productOptions}
                      value={productOptions.find(option => option.value.id === product.product?.id)}
                      onChange={(option) => handleProductChange(index, option)}
                      isSearchable
                      placeholder="Select a product..."
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
                        <span className="text-sm font-medium text-gray-700">Standard Price:</span>
                        <span className="ml-2">{product.product.sellingPrice.toLocaleString()} XAF</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700">Available Stock:</span>
                        <span className="ml-2">{product.product.stock}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Quantity"
                        type="number"
                        min="1"
                        max={product.product.stock.toString()}
                        value={product.quantity}
                        onChange={(e) => handleProductInputChange(index, 'quantity', e.target.value)}
                        required
                        helpText={`Cannot exceed ${product.product.stock}`}
                      />
                      
                      <Input
                        label="Negotiated Price (Optional)"
                        type="number"
                        max={product.product.sellingPrice.toString()}
                        value={product.negotiatedPrice}
                        onChange={(e) => handleProductInputChange(index, 'negotiatedPrice', e.target.value)}
                        helpText={`Cannot exceed ${product.product.sellingPrice.toLocaleString()} XAF`}
                      />
                    </div>

                    {product.quantity && (
                      <div className="p-3 bg-emerald-50 rounded-md">
                        <span className="text-sm font-medium text-emerald-700">Product Total:</span>
                        <span className="ml-2 text-emerald-900">{calculateProductTotal(product).toLocaleString()} XAF</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            {formData.products.some(p => p.quantity) && (
              <div className="p-4 bg-emerald-50 rounded-md">
                <span className="text-lg font-medium text-emerald-700">Total Amount:</span>
                <span className="ml-2 text-emerald-900 text-lg">{calculateTotal().toLocaleString()} XAF</span>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
          <Input
            label="Delivery Fee"
            name="deliveryFee"
            type="number"
            value={formData.deliveryFee}
            onChange={handleInputChange}
          />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
          <select
            name="status"
            className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={formData.status}
            onChange={handleInputChange}
          >
            <option value="commande">Commande</option>
            <option value="under_delivery">Under Delivery</option>
            <option value="paid">Paid</option>
          </select>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Sales;