import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, MapPin, Calendar, User, Search, Phone, X } from 'lucide-react';
import { Card, Button, Badge, Table, Input, Textarea, Modal, LoadingSpinner } from '../../../components/ui';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { useCustomers } from '../../../hooks/business/useCustomers';
import { useAuth } from '../../../contexts/AuthContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { t } from '../../../utils/i18n';
import type { Customer } from '../../../types/geskap';
import { formatPhoneNumber } from '../../../utils/phoneUtils';
import toast from 'react-hot-toast';

const CustomersPage = () => {
  const { currentUser, restaurant } = useAuth();
  const { language } = useLanguage();
  const restaurantId = restaurant?.id || currentUser?.uid || '';
  const userId = currentUser?.uid || '';

  const {
    customers,
    loading,
    error,
    addCustomer,
    updateCustomer,
    deleteCustomer
  } = useCustomers({ restaurantId });

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Form states
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    firstName: '',
    lastName: '',
    quarter: '',
    address: '',
    town: '',
    birthdate: '',
    howKnown: ''
  });

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');

  // Filter customers
  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;

    const query = searchQuery.toLowerCase();
    return customers.filter(customer => {
      return (
        customer.name?.toLowerCase().includes(query) ||
        customer.phone?.toLowerCase().includes(query) ||
        customer.firstName?.toLowerCase().includes(query) ||
        customer.lastName?.toLowerCase().includes(query) ||
        customer.quarter?.toLowerCase().includes(query) ||
        customer.town?.toLowerCase().includes(query) ||
        customer.address?.toLowerCase().includes(query)
      );
    });
  }, [customers, searchQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 9) {
      setFormData(prev => ({ ...prev, phone: value }));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      firstName: '',
      lastName: '',
      quarter: '',
      address: '',
      town: '',
      birthdate: '',
      howKnown: ''
    });
    setCurrentCustomer(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setCurrentCustomer(customer);
    let phoneDigits = customer.phone || '';
    if (phoneDigits.startsWith('+237')) {
      phoneDigits = phoneDigits.substring(4);
    } else if (phoneDigits.startsWith('237')) {
      phoneDigits = phoneDigits.substring(3);
    }
    phoneDigits = phoneDigits.replace(/\D/g, '');

    setFormData({
      name: customer.name || '',
      phone: phoneDigits,
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      quarter: customer.quarter || '',
      address: customer.address || '',
      town: customer.town || '',
      birthdate: customer.birthdate || '',
      howKnown: customer.howKnown || ''
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (customer: Customer) => {
    setCurrentCustomer(customer);
    setIsDeleteModalOpen(true);
  };

  const handleAddCustomer = async () => {
    if (!userId || !restaurantId) return;
    if (!formData.phone) {
      toast.error('Phone number is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const fullPhone = `+237${formData.phone}`;

      await addCustomer({
        phone: fullPhone,
        name: formData.name || undefined,
        firstName: formData.firstName || undefined,
        lastName: formData.lastName || undefined,
        quarter: formData.quarter || undefined,
        address: formData.address || undefined,
        town: formData.town || undefined,
        birthdate: formData.birthdate || undefined,
        howKnown: formData.howKnown || undefined,
        userId,
        restaurantId
      });
      setIsAddModalOpen(false);
      resetForm();
      toast.success('Customer added successfully');
    } catch (err) {
      toast.error('Error adding customer');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCustomer = async () => {
    if (!currentCustomer?.id || !restaurantId) return;
    if (!formData.phone) {
      toast.error('Phone number is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const fullPhone = `+237${formData.phone}`;

      await updateCustomer(currentCustomer.id, {
        phone: fullPhone,
        name: formData.name || undefined,
        firstName: formData.firstName || undefined,
        lastName: formData.lastName || undefined,
        quarter: formData.quarter || undefined,
        address: formData.address || undefined,
        town: formData.town || undefined,
        birthdate: formData.birthdate || undefined,
        howKnown: formData.howKnown || undefined
      });
      setIsEditModalOpen(false);
      resetForm();
      toast.success('Customer updated successfully');
    } catch (err) {
      toast.error('Error updating customer');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!currentCustomer?.id || !restaurantId) return;

    setIsSubmitting(true);
    try {
      await deleteCustomer(currentCustomer.id);
      setIsDeleteModalOpen(false);
      setCurrentCustomer(null);
      toast.success('Customer deleted successfully');
    } catch (err) {
      toast.error('Error deleting customer');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title={t('customers', language)}>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title={t('customers', language)}>
        <div className="text-center py-8 text-red-500">
          Error loading customers: {error}
        </div>
      </DashboardLayout>
    );
  }

  const tableColumns = [
    { header: 'Name', accessor: 'name' as const },
    { header: 'Phone', accessor: 'phone' as const },
    { header: 'Location', accessor: 'location' as const },
    { header: 'Address', accessor: 'address' as const },
    { header: 'Birthday', accessor: 'birthdate' as const },
    { header: 'Actions', accessor: 'actions' as const }
  ];

  const tableData = filteredCustomers.map(customer => {
    const fullName =
      customer.firstName && customer.lastName
        ? `${customer.firstName} ${customer.lastName}`
        : customer.name || 'No name';

    return {
      id: customer.id || '',
      name: fullName,
      phone: formatPhoneNumber(customer.phone),
      location: customer.town || customer.quarter || '-',
      address: customer.address || '-',
      birthdate: customer.birthdate || '-',
      actions: (
        <div className="flex space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(customer);
            }}
            className="text-blue-600 hover:text-blue-900 p-1"
            title="Edit"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openDeleteModal(customer);
            }}
            className="text-red-600 hover:text-red-900 p-1"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    };
  });

  return (
    <DashboardLayout title={t('customers', language)}>
      <div className="pb-20 md:pb-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{t('customers', language)}</h1>
            <p className="text-gray-600">Manage your restaurant customers</p>
          </div>

          <div className="mt-4 md:mt-0">
            <Button icon={<Plus size={16} />} onClick={openAddModal}>
              Add Customer
            </Button>
          </div>
        </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Customers</p>
              <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
            </div>
            <User className="text-blue-500" size={32} />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">With Address</p>
              <p className="text-2xl font-bold text-gray-900">
                {customers.filter(c => c.address || c.town).length}
              </p>
            </div>
            <MapPin className="text-green-500" size={32} />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">With Birthday</p>
              <p className="text-2xl font-bold text-gray-900">
                {customers.filter(c => c.birthdate).length}
              </p>
            </div>
            <Calendar className="text-purple-500" size={32} />
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* Customers Table */}
      <Card>
        <Table
          data={tableData}
          columns={tableColumns}
          keyExtractor={(item) => item.id}
          emptyMessage="No customers found. Add your first customer!"
        />
      </Card>

      {/* Add Customer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          resetForm();
        }}
        title="Add Customer"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone <span className="text-red-500">*</span>
            </label>
            <div className="flex rounded-lg shadow-sm">
              <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                +237
              </span>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handlePhoneChange}
                placeholder="678904568"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
          </div>

          <Input
            label="Full Name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Full name"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              placeholder="First name"
            />
            <Input
              label="Last Name"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              placeholder="Last name"
            />
          </div>

          <Input
            label="Quarter/Neighborhood"
            name="quarter"
            value={formData.quarter}
            onChange={handleInputChange}
            placeholder="Quarter"
          />

          <Textarea
            label="Full Address"
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            placeholder="Full address"
            rows={2}
          />

          <Input
            label="City"
            name="town"
            value={formData.town}
            onChange={handleInputChange}
            placeholder="City"
          />

          <Input
            label="Birthday"
            type="date"
            name="birthdate"
            value={formData.birthdate}
            onChange={handleInputChange}
          />

          <Input
            label="How did they find us?"
            name="howKnown"
            value={formData.howKnown}
            onChange={handleInputChange}
            placeholder="Advertising, Recommendation, etc."
          />

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsAddModalOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddCustomer}
              disabled={isSubmitting || !formData.phone}
              loading={isSubmitting}
            >
              Add Customer
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Customer Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          resetForm();
        }}
        title="Edit Customer"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone <span className="text-red-500">*</span>
            </label>
            <div className="flex rounded-lg shadow-sm">
              <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                +237
              </span>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handlePhoneChange}
                placeholder="678904568"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
          </div>

          <Input
            label="Full Name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Full name"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              placeholder="First name"
            />
            <Input
              label="Last Name"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              placeholder="Last name"
            />
          </div>

          <Input
            label="Quarter/Neighborhood"
            name="quarter"
            value={formData.quarter}
            onChange={handleInputChange}
            placeholder="Quarter"
          />

          <Textarea
            label="Full Address"
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            placeholder="Full address"
            rows={2}
          />

          <Input
            label="City"
            name="town"
            value={formData.town}
            onChange={handleInputChange}
            placeholder="City"
          />

          <Input
            label="Birthday"
            type="date"
            name="birthdate"
            value={formData.birthdate}
            onChange={handleInputChange}
          />

          <Input
            label="How did they find us?"
            name="howKnown"
            value={formData.howKnown}
            onChange={handleInputChange}
            placeholder="Advertising, Recommendation, etc."
          />

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditModalOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditCustomer}
              disabled={isSubmitting || !formData.phone}
              loading={isSubmitting}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Customer Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setCurrentCustomer(null);
        }}
        title="Delete Customer"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete{' '}
            <strong>{currentCustomer?.name || currentCustomer?.phone}</strong>?
            This action cannot be undone.
          </p>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setCurrentCustomer(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteCustomer}
              disabled={isSubmitting}
              loading={isSubmitting}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
      </div>
    </DashboardLayout>
  );
};

export default CustomersPage;
