import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, MapPin, Calendar, User, Search } from 'lucide-react';
import { Card, Button, Badge, Modal, Input, Textarea, Table, LoadingScreen } from '@components/common';
import { useInfiniteCustomers } from '@hooks/data/useInfiniteCustomers';
import { useInfiniteScroll } from '@hooks/data/useInfiniteScroll';
import { useCustomers } from '@hooks/data/useFirestore';
import { useAuth } from '@contexts/AuthContext';
import { showSuccessToast, showErrorToast, showWarningToast } from '@utils/core/toast';
import { PermissionButton, usePermissionCheck } from '@components/permissions';
import { RESOURCES } from '@constants/resources';
import type { Customer } from '../../types/models';

const Contacts = () => {
  const {
    customers,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    refresh
  } = useInfiniteCustomers();
  const { addCustomer, updateCustomer, deleteCustomer } = useCustomers();
  const { user, company } = useAuth();
  const { canEdit, canDelete } = usePermissionCheck(RESOURCES.CUSTOMERS);
  
  // Infinite scroll
  useInfiniteScroll({
    hasMore,
    loading: loadingMore,
    onLoadMore: loadMore,
    threshold: 300
  });

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
      const c = customer as Customer & { purchaseCount: number };
      return c.name?.toLowerCase().includes(query) ||
        c.phone?.toLowerCase().includes(query) ||
        c.firstName?.toLowerCase().includes(query) ||
        c.lastName?.toLowerCase().includes(query) ||
        c.quarter?.toLowerCase().includes(query) ||
        c.town?.toLowerCase().includes(query) ||
        c.address?.toLowerCase().includes(query);
    });
  }, [customers, searchQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    if (value.length <= 9) { // Only allow 9 digits after +237
      setFormData(prev => ({
        ...prev,
        phone: value
      }));
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
    // Extract 9 digits from phone number (remove +237 prefix if present)
    let phoneDigits = customer.phone || '';
    if (phoneDigits.startsWith('+237')) {
      phoneDigits = phoneDigits.substring(4); // Remove +237
    } else if (phoneDigits.startsWith('237')) {
      phoneDigits = phoneDigits.substring(3); // Remove 237
    }
    // Remove any non-digits
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
    if (!user?.uid || !company?.id) return;
    if (!formData.phone) {
      showWarningToast('Le numéro de téléphone est requis');
      return;
    }

    setIsSubmitting(true);
    try {
      // Combine +237 with the 9 digits entered
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
        userId: user.uid,
        companyId: company.id,
        createdAt: new Date()
      });
      setIsAddModalOpen(false);
      resetForm();
      showSuccessToast('Contact ajouté avec succès');
      refresh(); // Refresh the list
    } catch (err) {
      showErrorToast('Erreur lors de l\'ajout du contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCustomer = async () => {
    if (!currentCustomer?.id || !company?.id) return;
    if (!formData.phone) {
      showWarningToast('Le numéro de téléphone est requis');
      return;
    }

    setIsSubmitting(true);
    try {
      // Combine +237 with the 9 digits entered
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
      showSuccessToast('Contact modifié avec succès');
      refresh(); // Refresh the list
    } catch (err) {
      showErrorToast('Erreur lors de la modification du contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!currentCustomer?.id || !company?.id) return;

    setIsSubmitting(true);
    try {
      await deleteCustomer(currentCustomer.id);
      setIsDeleteModalOpen(false);
      setCurrentCustomer(null);
      showSuccessToast('Contact supprimé avec succès');
      refresh(); // Refresh the list
    } catch (err) {
      showErrorToast('Erreur lors de la suppression du contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    showErrorToast('Erreur lors du chargement des contacts');
    return null;
  }

  const tableData = filteredCustomers.map(customer => {
    const customerAsCustomer = customer as Customer & { purchaseCount: number };
    const fullName = customerAsCustomer.firstName && customerAsCustomer.lastName 
      ? `${customerAsCustomer.firstName} ${customerAsCustomer.lastName}`
      : customerAsCustomer.name || 'Sans nom';
    
    return {
      id: customerAsCustomer.id,
      name: fullName,
      phone: customerAsCustomer.phone,
      purchaseCount: (
        <Badge variant={customer.purchaseCount > 0 ? 'success' : 'info'}>
          {customer.purchaseCount || 0} {customer.purchaseCount === 1 ? 'achat' : 'achats'}
        </Badge>
      ),
      location: customerAsCustomer.town || customerAsCustomer.quarter || '-',
      address: customerAsCustomer.address || '-',
      birthdate: customerAsCustomer.birthdate || '-',
      howKnown: customerAsCustomer.howKnown || '-',
      actions: (
        <div className="flex space-x-2">
          {canEdit && (
            <button
              onClick={() => openEditModal(customerAsCustomer)}
              className="text-indigo-600 hover:text-indigo-900"
              title="Modifier"
            >
              <Edit2 size={16} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => openDeleteModal(customerAsCustomer)}
              className="text-red-600 hover:text-red-900"
              title="Supprimer"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )
    };
  });

  const tableColumns = [
    { header: 'Nom', accessor: 'name' as const },
    { header: 'Téléphone', accessor: 'phone' as const },
    { header: 'Achats', accessor: 'purchaseCount' as const },
    { header: 'Localisation', accessor: 'location' as const },
    { header: 'Adresse', accessor: 'address' as const },
    { header: 'Date de naissance', accessor: 'birthdate' as const },
    { header: 'Comment connu', accessor: 'howKnown' as const },
    { header: 'Actions', accessor: 'actions' as const }
  ];

  return (
    <div className="pb-16 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Contacts</h1>
          <p className="text-gray-600">Gérez tous vos contacts clients</p>
        </div>
        
        <div className="mt-4 md:mt-0">
          <PermissionButton
            resource={RESOURCES.CUSTOMERS}
            action="edit"
            icon={<Plus size={16} />}
            onClick={openAddModal}
            hideWhenNoPermission
          >
            Ajouter un contact
          </PermissionButton>
        </div>
      </div>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total contacts</p>
              <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
            </div>
            <User className="text-blue-500" size={32} />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avec adresse</p>
              <p className="text-2xl font-bold text-gray-900">
                {customers.filter(c => (c as Customer).address || (c as Customer).town).length}
              </p>
            </div>
            <MapPin className="text-green-500" size={32} />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avec date de naissance</p>
              <p className="text-2xl font-bold text-gray-900">
                {customers.filter(c => (c as Customer).birthdate).length}
              </p>
            </div>
            <Calendar className="text-purple-500" size={32} />
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <Input
            type="text"
            placeholder="Rechercher un contact (nom, téléphone, adresse...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 max-w-md"
          />
        </div>
      </div>

      {/* Contacts Table */}
      <Card>
        <Table
          data={tableData}
          columns={tableColumns}
          keyExtractor={(item) => item.id || ''}
          emptyMessage="Aucun contact trouvé"
        />
      </Card>

      {/* Add Customer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          resetForm();
        }}
        title="Ajouter un contact"
        footer={
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsAddModalOpen(false);
                resetForm();
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleAddCustomer}
              disabled={isSubmitting || !formData.phone}
            >
              {isSubmitting ? 'Ajout...' : 'Ajouter'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Téléphone <span className="text-red-500">*</span>
            </label>
            <div className="flex rounded-md shadow-sm">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                +237
              </span>
              <Input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handlePhoneChange}
                placeholder="678904568"
                className="flex-1 rounded-l-none"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom complet
            </label>
            <Input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Nom complet"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prénom
              </label>
              <Input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                placeholder="Prénom"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom de famille
              </label>
              <Input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                placeholder="Nom de famille"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quartier
            </label>
            <Input
              type="text"
              name="quarter"
              value={formData.quarter}
              onChange={handleInputChange}
              placeholder="Quartier"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Adresse complète
            </label>
            <Textarea
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="Adresse complète"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ville
            </label>
            <Input
              type="text"
              name="town"
              value={formData.town}
              onChange={handleInputChange}
              placeholder="Ville"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date de naissance
            </label>
            <Input
              type="date"
              name="birthdate"
              value={formData.birthdate}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comment il a connu l'entreprise
            </label>
            <Input
              type="text"
              name="howKnown"
              value={formData.howKnown}
              onChange={handleInputChange}
              placeholder="Publicité, Recommandation, etc."
            />
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
        title="Modifier le contact"
        footer={
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditModalOpen(false);
                resetForm();
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleEditCustomer}
              disabled={isSubmitting || !formData.phone}
            >
              {isSubmitting ? 'Modification...' : 'Modifier'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Téléphone <span className="text-red-500">*</span>
            </label>
            <div className="flex rounded-md shadow-sm">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                +237
              </span>
              <Input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handlePhoneChange}
                placeholder="678904568"
                className="flex-1 rounded-l-none"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom complet
            </label>
            <Input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Nom complet"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prénom
              </label>
              <Input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                placeholder="Prénom"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom de famille
              </label>
              <Input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                placeholder="Nom de famille"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quartier
            </label>
            <Input
              type="text"
              name="quarter"
              value={formData.quarter}
              onChange={handleInputChange}
              placeholder="Quartier"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Adresse complète
            </label>
            <Textarea
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="Adresse complète"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ville
            </label>
            <Input
              type="text"
              name="town"
              value={formData.town}
              onChange={handleInputChange}
              placeholder="Ville"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date de naissance
            </label>
            <Input
              type="date"
              name="birthdate"
              value={formData.birthdate}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comment il a connu l'entreprise
            </label>
            <Input
              type="text"
              name="howKnown"
              value={formData.howKnown}
              onChange={handleInputChange}
              placeholder="Publicité, Recommandation, etc."
            />
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
        title="Supprimer le contact"
        footer={
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setCurrentCustomer(null);
              }}
            >
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteCustomer}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Suppression...' : 'Supprimer'}
            </Button>
          </div>
        }
      >
        <p className="text-gray-600">
          Êtes-vous sûr de vouloir supprimer le contact{' '}
          <strong>{currentCustomer?.name || currentCustomer?.phone}</strong> ?
          Cette action est irréversible.
        </p>
      </Modal>
    </div>
  );
};

export default Contacts;

