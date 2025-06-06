import { useState } from 'react';
import { Grid, List, Plus, Search, Edit2 } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal, { ModalFooter } from '../components/common/Modal';
import Input from '../components/common/Input';
import CreatableSelect from '../components/common/CreatableSelect';
import { useProducts } from '../hooks/useFirestore';
import LoadingScreen from '../components/common/LoadingScreen';
import { showSuccessToast, showErrorToast, showWarningToast } from '../utils/toast';

const Products = () => {
  const { products, loading, error, addProduct, updateProduct } = useProducts();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<any>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    costPrice: '',
    sellingPrice: '',
    category: '',
    stock: '',
    imageUrl: '',
    imageFile: null as File | null
  });
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const resetForm = () => {
    setFormData({
      name: '',
      costPrice: '',
      sellingPrice: '',
      category: '',
      stock: '',
      imageUrl: '',
      imageFile: null
    });
  };

  // Get unique categories from products
  const categories = ['All', ...new Set(products?.map(p => p.category) || [])];

  const handleCategoryChange = (option: any) => {
    setFormData(prev => ({
      ...prev,
      category: option?.label || ''
    }));
  };
  
  const handleAddProduct = async () => {
    try {
      // Close modal and reset form immediately
      setIsAddModalOpen(false);
      resetForm();

      let imageBase64 = '';
      if (formData.imageFile) {
        const reader = new FileReader();
        reader.onload = async () => {
          imageBase64 = reader.result?.toString() || '';
          await addProduct({
            name: formData.name,
            costPrice: parseFloat(formData.costPrice),
            sellingPrice: parseFloat(formData.sellingPrice),
            category: formData.category,
            stock: parseInt(formData.stock),
            imageUrl: imageBase64 || '/placeholder.png',
            isAvailable: true,
            updatedAt: {
              seconds: 0,
              nanoseconds: 0
            }
          });
          showSuccessToast('Product added successfully!');
        };
        reader.readAsDataURL(formData.imageFile);
      } else {
        await addProduct({
          name: formData.name,
          costPrice: parseFloat(formData.costPrice),
          sellingPrice: parseFloat(formData.sellingPrice),
          category: formData.category,
          stock: parseInt(formData.stock),
          imageUrl: '/placeholder.png',
          isAvailable: true,
          updatedAt: {
            seconds: 0,
            nanoseconds: 0
          }
        });
        showSuccessToast('Product added successfully!');
      }
    } catch (err) {
      console.error('Failed to add product:', err);
      showErrorToast('Failed to add product. Please try again.');
      // Reopen modal if there's an error
      setIsAddModalOpen(true);
    }
  };
  
  const handleEditProduct = async () => {
    if (!currentProduct) return;
    
    try {
      // Close modal and reset form immediately
      setIsEditModalOpen(false);
      resetForm();

      await updateProduct(currentProduct.id, {
        name: formData.name,
        costPrice: parseFloat(formData.costPrice),
        sellingPrice: parseFloat(formData.sellingPrice),
        category: formData.category,
        stock: parseInt(formData.stock),
        imageUrl: formData.imageUrl || currentProduct.imageUrl
      });
      showSuccessToast('Product updated successfully!');
    } catch (err) {
      console.error('Failed to update product:', err);
      showErrorToast('Failed to update product. Please try again.');
      // Reopen modal if there's an error
      setIsEditModalOpen(true);
    }
  };
  
  const openEditModal = (product: any) => {
    setCurrentProduct(product);
    setFormData({
      name: product.name,
      costPrice: product.costPrice.toString(),
      sellingPrice: product.sellingPrice.toString(),
      category: product.category,
      stock: product.stock.toString(),
      imageUrl: product.imageUrl,
      imageFile: null
    });
    setIsEditModalOpen(true);
  };
  
  // Filter products by search query and category
  const filteredProducts = products?.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }) || [];

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    showErrorToast('Failed to load products. Please refresh the page.');
    return null;
  }

  return (
    <div className="pb-16 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Products</h1>
          <p className="text-gray-600">Manage your product inventory</p>
        </div>
        
        <div className="mt-4 md:mt-0 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <div className="flex space-x-1">
            <button
              className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-gray-200' : 'bg-white'}`}
              onClick={() => setViewMode('grid')}
            >
              <Grid size={18} />
            </button>
            <button
              className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-gray-200' : 'bg-white'}`}
              onClick={() => setViewMode('list')}
            >
              <List size={18} />
            </button>
          </div>
          
          <Button 
            icon={<Plus size={16} />}
            onClick={() => setIsAddModalOpen(true)}
          >
            Add Product
          </Button>
        </div>
      </div>
      
      {/* Search and filters */}
      <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 mb-6">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex space-x-2">
          <select
            className="rounded-md border border-gray-300 shadow-sm py-2 px-3 bg-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Products */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map(product => (
            <Card key={product.id} className="h-full">
              <div className="flex flex-col h-full">
                <div className="relative pb-[65%] overflow-hidden rounded-md mb-3">
                  <img
                    src={product.imageUrl || '/placeholder.png'}
                    alt={product.name}
                    className="absolute h-full w-full object-cover"
                  />
                </div>
                
                <div className="flex-grow">
                  <h3 className="font-medium text-gray-900">{product.name}</h3>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Cost Price:</span>
                      <span className="font-medium">{product.costPrice.toLocaleString()} XAF</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Selling Price:</span>
                      <span className="text-emerald-600 font-medium">{product.sellingPrice.toLocaleString()} XAF</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Stock:</span>
                      <Badge variant={product.stock > 10 ? 'success' : product.stock > 5 ? 'warning' : 'error'}>
                        {product.stock} units
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">{product.category}</p>
                </div>
                
                <div className="mt-4 flex justify-end space-x-2">
                  <button 
                    onClick={() => openEditModal(product)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cost Price
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Selling Price
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <img className="h-10 w-10 rounded-md object-cover" src={product.imageUrl} alt="" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{product.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{product.costPrice.toLocaleString()} XAF</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-emerald-600 font-medium">{product.sellingPrice.toLocaleString()} XAF</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={product.stock > 10 ? 'success' : product.stock > 5 ? 'warning' : 'error'}>
                        {product.stock} units
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{product.category}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => openEditModal(product)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        <Edit2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      
      {/* Add Product Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Product"
        footer={
          <ModalFooter 
            onCancel={() => setIsAddModalOpen(false)}
            onConfirm={handleAddProduct}
            confirmText="Add Product"
          />
        }
      >
        <div className="space-y-4">
          <Input
            label="Product Name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
          />
          
          <Input
            label="Cost Price (XAF)"
            name="costPrice"
            type="number"
            value={formData.costPrice}
            onChange={handleInputChange}
            required
          />
          
          <Input
            label="Selling Price (XAF)"
            name="sellingPrice"
            type="number"
            value={formData.sellingPrice}
            onChange={handleInputChange}
            required
            helpText="Must be greater than cost price"
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <CreatableSelect
              value={formData.category ? { label: formData.category, value: formData.category } : null}
              onChange={handleCategoryChange}
              placeholder="Select or create a category..."
              className="custom-select"
            />
          </div>
          
          <Input
            label="Stock Quantity"
            name="stock"
            type="number"
            value={formData.stock}
            onChange={handleInputChange}
            required
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Image
            </label>
            <input
              type="file"
              name="imageFile"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setFormData(prev => ({ ...prev, imageFile: file }));
                }
              }}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-gray-300 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
            <p className="mt-1 text-sm text-gray-500">Upload an image file for the product</p>
          </div>
        </div>
      </Modal>
      
      {/* Edit Product Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Product"
        footer={
          <ModalFooter 
            onCancel={() => setIsEditModalOpen(false)}
            onConfirm={handleEditProduct}
            confirmText="Update Product"
          />
        }
      >
        <div className="space-y-4">
          <Input
            label="Product Name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
          />
          
          <Input
            label="Cost Price (XAF)"
            name="costPrice"
            type="number"
            value={formData.costPrice}
            onChange={handleInputChange}
            required
          />
          
          <Input
            label="Selling Price (XAF)"
            name="sellingPrice"
            type="number"
            value={formData.sellingPrice}
            onChange={handleInputChange}
            required
            helpText="Must be greater than cost price"
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <CreatableSelect
              value={formData.category ? { label: formData.category, value: formData.category } : null}
              onChange={handleCategoryChange}
              placeholder="Select or create a category..."
              className="custom-select"
            />
          </div>
          
          <Input
            label="Stock Quantity"
            name="stock"
            type="number"
            value={formData.stock}
            onChange={handleInputChange}
            required
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Image
            </label>
            <input
              type="file"
              name="imageFile"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setFormData(prev => ({ ...prev, imageFile: file }));
                }
              }}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-gray-300 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
            <p className="mt-1 text-sm text-gray-500">Upload an image file for the product</p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Products;