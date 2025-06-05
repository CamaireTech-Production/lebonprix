import { useState } from 'react';
import { Plus, Filter, FileDown, Edit2 } from 'lucide-react';
import Select from 'react-select';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Table from '../components/common/Table';
import Badge from '../components/common/Badge';
import Modal, { ModalFooter } from '../components/common/Modal';
import Input from '../components/common/Input';
import { useSales, useProducts } from '../hooks/useFirestore';
import LoadingScreen from '../components/common/LoadingScreen';
import type { Product } from '../types/models';

const Sales = () => {
  const { sales, loading: salesLoading, error: salesError, addSale, updateStatus } = useSales();
  const { products, loading: productsLoading } = useProducts();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentSale, setCurrentSale] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    quantity: '',
    negotiatedPrice: '',
    customerName: '',
    customerPhone: '',
    status: 'commande'
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
      status: 'commande'
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
  
  const handleAddSale = async () => {
    if (!selectedProduct) return;
    
    try {
      const quantity = parseInt(formData.quantity);
      const totalAmount = calculateTotal();
      
      await addSale({
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
        }
      });
      
      setIsAddModalOpen(false);
      resetForm();
    } catch (err) {
      console.error('Failed to add sale:', err);
    }
  };
  
  const handleEditSale = async () => {
    if (!currentSale) return;
    
    try {
      await updateStatus(
        currentSale.id,
        formData.status as any
      );
      setIsEditModalOpen(false);
      resetForm();
    } catch (err) {
      console.error('Failed to update sale:', err);
    }
  };
  
  const openEditModal = (sale: any) => {
    setCurrentSale(sale);
    setFormData(prev => ({
      ...prev,
      status: sale.status
    }));
    setIsEditModalOpen(true);
  };
  
  const columns = [
    { 
      header: 'Product',
      accessor: (sale: any) => {
        const product = products?.find(p => p.id === sale.productId);
        return product?.name || 'Unknown Product';
      }
    },
    { 
      header: 'Customer',
      accessor: (sale: any) => sale.customerInfo?.name || 'N/A'
    },
    { 
      header: 'Amount',
      accessor: (sale: any) => (
        <span>{(sale.totalAmount || 0).toLocaleString()} XAF</span>
      )
    },
    { 
      header: 'Status',
      accessor: (sale: any) => {
        let variant: 'success' | 'warning' | 'error' = 'warning';
        if (sale.status === 'paid') variant = 'success';
        if (sale.status === 'under_delivery') variant = 'info';
        
        return <Badge variant={variant}>{sale.status}</Badge>;
      }
    },
    { 
      header: 'Date',
      accessor: (sale: any) => {
        if (!sale.createdAt?.seconds) return 'N/A';
        return new Date(sale.createdAt.seconds * 1000).toLocaleDateString();
      }
    },
    { 
      header: 'Actions',
      accessor: (sale: any) => (
        <button 
          onClick={() => openEditModal(sale)}
          className="text-indigo-600 hover:text-indigo-900"
        >
          <Edit2 size={16} />
        </button>
      ),
      className: 'w-24'
    }
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
          <Button 
            variant="outline" 
            icon={<Filter size={16} />}
          >
            Filter
          </Button>
          <Button 
            variant="outline" 
            icon={<FileDown size={16} />}
          >
            Export
          </Button>
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
          data={sales || []}
          columns={columns}
          keyExtractor={(sale) => sale.id}
          emptyMessage="No sales records found"
        />
      </Card>
      
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
      
      {/* Edit Sale Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Update Sale Status"
        footer={
          <ModalFooter 
            onCancel={() => setIsEditModalOpen(false)}
            onConfirm={handleEditSale}
            confirmText="Update Sale"
          />
        }
      >
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
      </Modal>
    </div>
  );
};

export default Sales;