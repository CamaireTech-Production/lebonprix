import { useState } from 'react';
import { Plus, FileDown, Edit2 } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Table from '../components/common/Table';
import Badge from '../components/common/Badge';
import Modal, { ModalFooter } from '../components/common/Modal';
import Input from '../components/common/Input';
import { useExpenses } from '../hooks/useFirestore';
import LoadingScreen from '../components/common/LoadingScreen';

const Expenses = () => {
  const { expenses, loading, error, addExpense, updateExpense } = useExpenses();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentExpense, setCurrentExpense] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Form state
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'Delivery',
  });
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const resetForm = () => {
    setFormData({
      description: '',
      amount: '',
      category: 'Delivery',
    });
  };
  
  const handleAddExpense = async () => {
    try {
      await addExpense({
        description: formData.description,
        amount: parseFloat(formData.amount),
        category: formData.category.toLowerCase() as 'delivery' | 'purchase' | 'other',
        createdBy: 'Current User', // In a real app, get from auth context
      });
      setIsAddModalOpen(false);
      resetForm();
    } catch (err) {
      console.error('Failed to add expense:', err);
      // Add proper error handling
    }
  };
  
  const handleEditExpense = async () => {
    if (!currentExpense) return;
    
    try {
      await updateExpense(currentExpense.id, {
        description: formData.description,
        amount: parseFloat(formData.amount),
        category: formData.category as 'delivery' | 'purchase' | 'other',
      });
      setIsEditModalOpen(false);
      resetForm();
    } catch (err) {
      console.error('Failed to update expense:', err);
      // Add proper error handling
    }
  };
  
  const openEditModal = (expense: any) => {
    setCurrentExpense(expense);
    setFormData({
      description: expense.description,
      amount: expense.amount.toString(),
      category: expense.category,
    });
    setIsEditModalOpen(true);
  };
  
  const columns = [
    { 
      header: 'Description', 
      accessor: 'description' as const,
    },
    { 
      header: 'Amount', 
      accessor: (expense: any) => (
        <span>{expense.amount.toLocaleString()} XAF</span>
      ),
    },
    { 
      header: 'Category', 
      accessor: (expense: any) => {
        let variant: 'info' | 'error' | 'warning' = 'info';
        if (expense.category === 'purchase') variant = 'error';
        if (expense.category === 'other') variant = 'warning';
        
        return <Badge variant={variant}>{expense.category}</Badge>;
      },
    },
    { 
      header: 'Date', 
      accessor: (expense: any) => {
        if (!expense.date?.seconds) return 'N/A';
        return new Date(expense.date.seconds * 1000).toLocaleDateString();
      },
    },
    { 
      header: 'Created By', 
      accessor: 'createdBy' as const,
    },
    { 
      header: 'Actions', 
      accessor: (expense: any) => (
        <div className="flex space-x-2">
          <button 
            onClick={() => openEditModal(expense)}
            className="text-indigo-600 hover:text-indigo-900"
          >
            <Edit2 size={16} />
          </button>
        </div>
      ),
      className: 'w-24',
    },
  ];

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-800 rounded-md">
        Error loading expenses: {error.message}
      </div>
    );
  }

  type CategoryKey = 'delivery' | 'purchase' | 'other';
  const summaryStats = expenses.reduce((acc: Record<CategoryKey, number>, expense) => {
    const normalizedCategory = expense.category.toLowerCase() as CategoryKey;
    if (acc[normalizedCategory] !== undefined) {
      acc[normalizedCategory] += expense.amount;
    }
    return acc;
  }, { delivery: 0, purchase: 0, other: 0 });

  // Filter expenses by category
  const filteredExpenses = selectedCategory === 'All'
    ? expenses
    : expenses.filter(expense => expense.category.toLowerCase() === selectedCategory.toLowerCase());

  return (
    <div className="pb-16 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Expenses</h1>
          <p className="text-gray-600">Track and manage your business expenses</p>
        </div>
        
        <div className="mt-4 md:mt-0 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <select
            className="rounded-md border border-gray-300 shadow-sm py-2 px-3 bg-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="All">All Categories</option>
            <option value="delivery">Delivery</option>
            <option value="purchase">Purchase</option>
            <option value="other">Other</option>
          </select>
          
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
            Add Expense
          </Button>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="text-sm font-medium text-blue-700">Delivery Expenses</p>
          <p className="text-xl font-semibold text-gray-900">
            {summaryStats.delivery.toLocaleString()} XAF
          </p>
        </Card>
        
        <Card>
          <p className="text-sm font-medium text-red-700">Purchase Expenses</p>
          <p className="text-xl font-semibold text-gray-900">
            {summaryStats.purchase.toLocaleString()} XAF
          </p>
        </Card>
        
        <Card>
          <p className="text-sm font-medium text-yellow-700">Other Expenses</p>
          <p className="text-xl font-semibold text-gray-900">
            {summaryStats.other.toLocaleString()} XAF
          </p>
        </Card>
      </div>
      
      <Card>
        <Table
          data={filteredExpenses}
          columns={columns}
          keyExtractor={(expense) => expense.id}
          emptyMessage="No expense records found"
        />
      </Card>
      
      {/* Add Expense Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Expense"
        footer={
          <ModalFooter 
            onCancel={() => setIsAddModalOpen(false)}
            onConfirm={handleAddExpense}
            confirmText="Add Expense"
          />
        }
      >
        <div className="space-y-4">
          <Input
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            required
          />
          
          <Input
            label="Amount (XAF)"
            name="amount"
            type="number"
            value={formData.amount}
            onChange={handleInputChange}
            required
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              name="category"
              className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={formData.category}
              onChange={handleInputChange}
            >
              <option value="delivery">Delivery</option>
              <option value="purchase">Purchase</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </Modal>
      
      {/* Edit Expense Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Expense"
        footer={
          <ModalFooter 
            onCancel={() => setIsEditModalOpen(false)}
            onConfirm={handleEditExpense}
            confirmText="Update Expense"
          />
        }
      >
        <div className="space-y-4">
          <Input
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            required
          />
          
          <Input
            label="Amount (XAF)"
            name="amount"
            type="number"
            value={formData.amount}
            onChange={handleInputChange}
            required
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              name="category"
              className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={formData.category}
              onChange={handleInputChange}
            >
              <option value="delivery">Delivery</option>
              <option value="purchase">Purchase</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Expenses;