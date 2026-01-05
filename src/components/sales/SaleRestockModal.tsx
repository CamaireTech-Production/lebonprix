import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { restockProduct, subscribeToSuppliers } from '../../services/firestore';
import { getProductStockBatches } from '../../services/firestore/stock/stockService';
import type { Product, Supplier } from '../../types/models';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import PriceInput from '../common/PriceInput';
import Select from '../common/Select';
import { formatCostPrice } from '../../utils/inventory/inventoryManagement';

interface RestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSuccess?: () => void;
}

const SaleRestockModal: React.FC<RestockModalProps> = ({
  isOpen,
  onClose,
  product,
  onSuccess
}) => {
  const { user, company } = useAuth();
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [productBatches, setProductBatches] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    quantity: '',
    costPrice: '',
    supplierId: '',
    isOwnPurchase: false,
    isCredit: false,
    notes: ''
  });

  // Load suppliers
  useEffect(() => {
    if (isOpen && user?.uid && company?.id) {
      const unsubscribe = subscribeToSuppliers(company.id, setSuppliers);
      return unsubscribe;
    }
  }, [isOpen, user?.uid, company?.id]);

  // Load latest cost price and reset form when modal opens
  useEffect(() => {
    if (isOpen && product) {
      const loadLatestCostPrice = async () => {
        try {
          if (!company?.id) {
            throw new Error('Company ID not available');
          }
          // Get stock batches ordered by creation date (newest first)
          const batches = await getProductStockBatches(product.id, company.id);
          setProductBatches(batches);
          
          // Get cost price from the most recent batch, or fallback to product's costPrice
          let latestCostPrice = '';
          if (batches.length > 0 && batches[0].costPrice > 0) {
            latestCostPrice = batches[0].costPrice.toString();
          } else if (product.costPrice > 0) {
            latestCostPrice = product.costPrice.toString();
          }

          setFormData({
            quantity: '',
            costPrice: latestCostPrice,
            supplierId: '',
            isOwnPurchase: false,
            isCredit: false,
            notes: ''
          });
        } catch (error) {
          console.error('Error loading latest cost price:', error);
          // Fallback to product's costPrice if batch fetch fails
          setFormData({
            quantity: '',
            costPrice: product.costPrice > 0 ? product.costPrice.toString() : '',
            supplierId: '',
            isOwnPurchase: false,
            isCredit: false,
            notes: ''
          });
        }
      };

      loadLatestCostPrice();
    }
  }, [isOpen, product]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!product || !user?.uid) return;

    const quantity = parseInt(formData.quantity, 10);
    const costPrice = parseFloat(formData.costPrice);

    if (isNaN(quantity) || quantity <= 0) {
      alert('Please enter a valid quantity (whole number greater than 0)');
      return;
    }

    if (isNaN(costPrice) || costPrice < 0) {
      alert('Please enter a valid cost price');
      return;
    }

    setLoading(true);

    try {
      await restockProduct(
        product.id,
        quantity,
        costPrice,
        user.uid,
        formData.supplierId || undefined,
        formData.isOwnPurchase,
        formData.isCredit,
        formData.notes || undefined
      );

      alert('Product restocked successfully!');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error restocking product:', error);
      alert(`Error restocking product: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalCost = () => {
    const quantity = parseInt(formData.quantity, 10) || 0;
    const costPrice = parseFloat(formData.costPrice) || 0;
    return quantity * costPrice;
  };

  const getSupplierOptions = () => {
    return [
      { value: '', label: 'Select supplier (optional)' },
      ...suppliers.map(supplier => ({
        value: supplier.id,
        label: supplier.name
      }))
    ];
  };

  if (!product) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Restock ${product.name}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Product Information */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Product Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Name:</span>
              <p className="text-gray-900">{product.name}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Reference:</span>
              <p className="text-gray-900">{product.reference}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Current Stock:</span>
              <p className="text-gray-900">
                {productBatches.reduce((sum, b) => sum + (b.remainingQuantity || 0), 0)}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Selling Price:</span>
              <p className="text-gray-900">{formatCostPrice(product.sellingPrice)}</p>
            </div>
          </div>
        </div>

        {/* Restock Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Restock Details</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Quantity"
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={(e) => handleInputChange('quantity', e.target.value)}
              placeholder="Enter quantity"
              required
              min="1"
              step="1"
            />
            
            <PriceInput
              label="Cost Price per Unit"
              name="costPrice"
              value={formData.costPrice}
              onChange={(e) => handleInputChange('costPrice', e.target.value)}
              placeholder="Enter cost price"
              required
              allowDecimals={true}
            />
          </div>

          {/* Total Cost Display */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-sm font-medium text-blue-800">Total Cost</div>
            <div className="text-lg font-semibold text-blue-900">
              {formatCostPrice(calculateTotalCost())}
            </div>
          </div>
        </div>

        {/* Supplier Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Supplier Information</h3>
          
          <Select
            label="Supplier"
            value={formData.supplierId}
            onChange={(e) => handleInputChange('supplierId', e.target.value)}
            options={getSupplierOptions()}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isOwnPurchase"
                checked={formData.isOwnPurchase}
                onChange={(e) => handleInputChange('isOwnPurchase', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isOwnPurchase" className="ml-2 block text-sm text-gray-900">
                Own Purchase
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isCredit"
                checked={formData.isCredit}
                onChange={(e) => handleInputChange('isCredit', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled={formData.isOwnPurchase}
              />
              <label htmlFor="isCredit" className="ml-2 block text-sm text-gray-900">
                Credit Purchase
              </label>
            </div>
          </div>

          {formData.isOwnPurchase && (
            <div className="text-sm text-gray-600 bg-yellow-50 p-2 rounded">
              Own purchase selected - no supplier debt will be created
            </div>
          )}

          {formData.isCredit && !formData.isOwnPurchase && formData.supplierId && (
            <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
              Credit purchase selected - supplier debt will be created
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (Optional)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            placeholder="Add any notes about this restock..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            rows={3}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
          >
            {loading ? 'Restocking...' : 'Restock Product'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default SaleRestockModal;

