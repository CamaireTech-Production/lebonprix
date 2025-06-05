import { useState } from 'react';
import { Plus, Edit2, Eye } from 'lucide-react';
import Select from 'react-select';
import Table from '../components/common/Table';
import Modal, { ModalFooter } from '../components/common/Modal';
import Input from '../components/common/Input';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import { useSales, useProducts } from '../hooks/useFirestore';
import type { Product, OrderStatus, Sale } from '../types/models';
import type { Column } from '../components/common/Table';
import LoadingScreen from '../components/common/LoadingScreen';
import Swal from 'sweetalert2';

const Sales = () => {
  const { sales, loading: salesLoading, error: salesError, addSale, updateStatus } = useSales();
  const { products, loading: productsLoading } = useProducts();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [currentSale, setCurrentSale] = useState<any>(null);
  const [viewedSale, setViewedSale] = useState<Sale | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [shareableLink, setShareableLink] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    quantity: '',
    negotiatedPrice: '',
    customerName: '',
    customerPhone: '',
    status: 'commande' as OrderStatus, // Explicitly type as OrderStatus
    deliveryFee: ''
  });
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const resetForm = () => {
    setFormData({
      quantity: '',
      negotiatedPrice: '',
      customerName: '',
      customerPhone: '',
      status: 'commande' as OrderStatus,
      deliveryFee: ''
    });
    setSelectedProduct(null);
  };
  
  const handleProductSelect = (option: any) => {
    setSelectedProduct(option?.value || null);
  };
  
  const calculateTotal = () => {
    if (!selectedProduct || !formData.quantity) return 0;
    const quantity = parseInt(formData.quantity);
    const price = formData.negotiatedPrice 
      ? parseFloat(formData.negotiatedPrice)
      : selectedProduct.sellingPrice;
    return quantity * price;
  };
  
  const validateForm = () => {
    const errors: Record<string, string> = {};

    // Validate quantity
    const quantity = parseInt(formData.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      errors.quantity = 'Quantity must be greater than zero.';
    }

    // Validate negotiated price
    const negotiatedPrice = parseFloat(formData.negotiatedPrice);
    if (
      !isNaN(negotiatedPrice) &&
      selectedProduct &&
      negotiatedPrice > selectedProduct.sellingPrice
    ) {
      errors.negotiatedPrice = 'Negotiated price cannot exceed the standard selling price.';
    }

    // Validate shipping fee
    const deliveryFee = parseFloat(formData.deliveryFee);
    if (!isNaN(deliveryFee) && deliveryFee < 0) {
      errors.deliveryFee = 'Shipping fee must be a non-negative number.';
    }

    return errors;
  };
  
  const handleGenerateLink = (saleId: string) => {
    const link = `${window.location.origin}/track/${saleId}`;
    setShareableLink(link);
    setIsLinkModalOpen(true);
  };

  const handleAddSale = async () => {
    if (!selectedProduct) return;

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      console.error('Validation errors:', errors);
      return;
    }

    try {
      const quantity = parseInt(formData.quantity);
      const totalAmount = calculateTotal();

      const newSale = await addSale({
        productId: selectedProduct.id,
        quantity,
        basePrice: selectedProduct.sellingPrice,
        negotiatedPrice: formData.negotiatedPrice
          ? parseFloat(formData.negotiatedPrice)
          : selectedProduct.sellingPrice,
        totalAmount,
        status: formData.status as 'commande' | 'under_delivery' | 'paid',
        customerInfo: {
          name: formData.customerName,
          phone: formData.customerPhone
        },
        paymentStatus: 'paid'
      });

      if (newSale && newSale.id) {
        handleGenerateLink(newSale.id);
      }

      setIsAddModalOpen(false);
      resetForm();
    } catch (err) {
      console.error('Failed to add sale:', err);
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

    try {
      await updateStatus(currentSale.id, formData.status, 'pending');
      await addSale({
        ...currentSale,
        ...formData,
        totalAmount: calculateTotal(),
      });
      setIsEditModalOpen(false);
    } catch (err) {
      console.error('Failed to update sale:', err);
    }
  };
  
  const handleCopyLink = (saleId: string) => {
    const link = `${window.location.origin}/track/${saleId}`;
    navigator.clipboard.writeText(link).then(() => {
      Swal.fire({
        icon: 'success',
        title: 'Link Copied',
        text: 'The shareable link has been copied to your clipboard.',
        timer: 2000,
        showConfirmButton: false
      });
    });
  };

  const columns: Column<Sale>[] = [
    {
      header: 'Nom',
      accessor: (sale: Sale) => sale.customerInfo.name, // Use function accessor to get customer name
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
            onClick={() => {
              setCurrentSale(sale);
              setIsEditModalOpen(true);
              setFormData({
                quantity: sale.quantity.toString(),
                negotiatedPrice: sale.negotiatedPrice?.toString() || '',
                customerName: sale.customerInfo.name,
                customerPhone: sale.customerInfo.phone,
                status: sale.status,
                deliveryFee: sale.deliveryFee?.toString() || ''
              });
              setSelectedProduct(products?.find(p => p.id === sale.productId) || null);
            }}
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
    return (
      <div className="p-4 bg-red-50 text-red-800 rounded-md">
        Error loading sales: {salesError.message}
      </div>
    );
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
      >
        {viewedSale && (
          <div className="space-y-4">
            <p><strong>Customer Name:</strong> {viewedSale.customerInfo.name}</p>
            <p><strong>Customer Phone:</strong> {viewedSale.customerInfo.phone}</p>
            <p><strong>Product Name:</strong> {products?.find(p => p.id === viewedSale.productId)?.name || 'Unknown'}</p>
            <p><strong>Quantity:</strong> {viewedSale.quantity}</p>
            <p><strong>Total Amount:</strong> {viewedSale.totalAmount.toLocaleString()} XAF</p>
            <p><strong>Status:</strong> {viewedSale.status}</p>
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
          />
        }
      >
        <div className="space-y-6">
          {/* Product Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product
            </label>
            <Select
              options={productOptions}
              value={productOptions.find(option => option.value === selectedProduct)}
              onChange={handleProductSelect}
              isSearchable
              placeholder="Select a product..."
              className="text-sm"
            />
          </div>
          
          {selectedProduct && (
            <>
              <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-md">
                <div>
                  <span className="text-sm font-medium text-gray-700">Standard Price:</span>
                  <span className="ml-2">{selectedProduct.sellingPrice.toLocaleString()} XAF</span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700">Available Stock:</span>
                  <span className="ml-2">{selectedProduct.stock}</span>
                </div>
              </div>
              
              <Input
                label="Quantity"
                name="quantity"
                type="number"
                min="1"
                max={selectedProduct.stock.toString()}
                value={formData.quantity}
                onChange={handleInputChange}
                required
                helpText={`Cannot exceed ${selectedProduct.stock}`}
              />
              
              <Input
                label="Negotiated Price (Optional)"
                name="negotiatedPrice"
                type="number"
                max={selectedProduct.sellingPrice.toString()}
                value={formData.negotiatedPrice}
                onChange={handleInputChange}
                helpText={`Cannot exceed ${selectedProduct.sellingPrice.toLocaleString()} XAF`}
              />
              
              {formData.quantity && (
                <div className="p-3 bg-emerald-50 rounded-md">
                  <span className="text-sm font-medium text-emerald-700">Total Amount:</span>
                  <span className="ml-2 text-emerald-900">{calculateTotal().toLocaleString()} XAF</span>
                </div>
              )}
            </>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Customer Name"
              name="customerName"
              value={formData.customerName}
              onChange={handleInputChange}
              required
            />
            
            <Input
              label="Customer Phone"
              name="customerPhone"
              value={formData.customerPhone}
              onChange={handleInputChange}
              required
            />
          </div>
          
          {/* New Input for Delivery Fee */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delivery Fee
            </label>
            <Input
              name="deliveryFee"
              type="number"
              value={formData.deliveryFee}
              onChange={handleInputChange}
            />
          </div>
          
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
      </Modal>
      
      {/* Link Modal */}
      <Modal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        title="Shareable Link"
      >
        {shareableLink && (
          <div className="space-y-4">
            <p>Share this link with the client:</p>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={shareableLink}
                readOnly
                className="border rounded-md p-2 w-full"
              />
              <button
                onClick={() => navigator.clipboard.writeText(shareableLink)}
                className="bg-blue-500 text-white px-4 py-2 rounded-md"
              >
                Copy
              </button>
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
          />
        }
      >
        <div className="space-y-6">
          <Input
            label="Quantity"
            name="quantity"
            type="number"
            value={formData.quantity}
            onChange={handleInputChange}
            required
          />
          <Input
            label="Negotiated Price"
            name="negotiatedPrice"
            type="number"
            value={formData.negotiatedPrice}
            onChange={handleInputChange}
          />
          <Input
            label="Customer Name"
            name="customerName"
            value={formData.customerName}
            onChange={handleInputChange}
            required
          />
          <Input
            label="Customer Phone"
            name="customerPhone"
            value={formData.customerPhone}
            onChange={handleInputChange}
            required
          />
          <Input
            label="Delivery Fee"
            name="deliveryFee"
            type="number"
            value={formData.deliveryFee}
            onChange={handleInputChange}
          />
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
      </Modal>
    </div>
  );
};

export default Sales;