import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, Users, UserPlus, Mail, Shield } from 'lucide-react';
import { Card, Button, Badge, Table, Input, Modal, LoadingSpinner, Select } from '../../../components/ui';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { useEmployees } from '../../../hooks/business/useEmployees';
import { useInvitations } from '../../../hooks/business/useInvitations';
import { usePermissions } from '../../../hooks/business/usePermissions';
import { useAuth } from '../../../contexts/AuthContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { t } from '../../../utils/i18n';
import type { EmployeeRef, UserRole, Invitation } from '../../../types/geskap';
import toast from 'react-hot-toast';
import { EmployeeInviteModal } from '../../../components/staff/EmployeeInviteModal';

const StaffPage = () => {
  const { currentUser, restaurant } = useAuth();
  const { language } = useLanguage();
  const restaurantId = restaurant?.id || currentUser?.uid || '';
  const userId = currentUser?.uid || '';
  const restaurantName = restaurant?.name || '';

  const {
    employees,
    loading: employeesLoading,
    error: employeesError,
    updateRole,
    removeEmployee
  } = useEmployees({ restaurantId });

  const {
    invitations,
    pendingInvitations,
    loading: invitationsLoading,
    inviteEmployee,
    cancelInvite
  } = useInvitations({
    restaurantId,
    restaurantName,
    invitedBy: userId,
    invitedByName: currentUser?.displayName || currentUser?.email || 'Owner'
  });

  const { templates, loading: templatesLoading } = usePermissions({ restaurantId, userId });

  // Modal states
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditRoleModalOpen, setIsEditRoleModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCancelInviteModalOpen, setIsCancelInviteModalOpen] = useState(false);

  // Form states
  const [currentEmployee, setCurrentEmployee] = useState<EmployeeRef | null>(null);
  const [currentInvitation, setCurrentInvitation] = useState<Invitation | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('staff');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');

  const loading = employeesLoading || invitationsLoading || templatesLoading;

  // Calculate stats
  const stats = useMemo(() => {
    const totalEmployees = employees.length;
    const activeEmployees = employees.length; // All employees are active
    const pendingInvites = pendingInvitations.length;

    return {
      totalEmployees,
      activeEmployees,
      pendingInvites
    };
  }, [employees, pendingInvitations]);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    let filtered = employees;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(employee => {
        return (
          employee.username?.toLowerCase().includes(query) ||
          employee.email?.toLowerCase().includes(query) ||
          employee.role?.toLowerCase().includes(query)
        );
      });
    }

    if (filterRole !== 'all') {
      filtered = filtered.filter(employee => employee.role === filterRole);
    }

    return filtered;
  }, [employees, searchQuery, filterRole]);

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-800';
      case 'admin':
        return 'bg-blue-100 text-blue-800';
      case 'manager':
        return 'bg-green-100 text-green-800';
      case 'staff':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const openInviteModal = () => {
    setIsInviteModalOpen(true);
  };

  const openEditRoleModal = (employee: EmployeeRef) => {
    setCurrentEmployee(employee);
    setSelectedRole(employee.role);
    setIsEditRoleModalOpen(true);
  };

  const openDeleteModal = (employee: EmployeeRef) => {
    setCurrentEmployee(employee);
    setIsDeleteModalOpen(true);
  };

  const openCancelInviteModal = (invitation: Invitation) => {
    setCurrentInvitation(invitation);
    setIsCancelInviteModalOpen(true);
  };

  const handleUpdateRole = async () => {
    if (!currentEmployee?.id) return;

    setIsSubmitting(true);
    try {
      await updateRole(currentEmployee.id, selectedRole);
      setIsEditRoleModalOpen(false);
      setCurrentEmployee(null);
      toast.success(t('role_updated_successfully', language));
    } catch (err: any) {
      toast.error(err.message || t('error_updating_role', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveEmployee = async () => {
    if (!currentEmployee?.id) return;

    setIsSubmitting(true);
    try {
      await removeEmployee(currentEmployee.id);
      setIsDeleteModalOpen(false);
      setCurrentEmployee(null);
      toast.success(t('employee_removed_successfully', language));
    } catch (err: any) {
      toast.error(err.message || t('error_removing_employee', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelInvite = async () => {
    if (!currentInvitation?.id) return;

    setIsSubmitting(true);
    try {
      await cancelInvite(currentInvitation.id);
      setIsCancelInviteModalOpen(false);
      setCurrentInvitation(null);
      toast.success(t('invitation_cancelled_successfully', language));
    } catch (err: any) {
      toast.error(err.message || t('error_cancelling_invitation', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title={t('staff', language)}>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    );
  }

  const tableColumns = [
    { header: t('name', language), accessor: 'name' as const },
    { header: t('email', language), accessor: 'email' as const },
    { header: t('role', language), accessor: 'role' as const },
    { header: t('actions', language), accessor: 'actions' as const }
  ];

  const tableData = filteredEmployees.map(employee => ({
    id: employee.id,
    name: employee.username,
    email: employee.email,
    role: (
      <Badge className={getRoleBadgeColor(employee.role)}>
        {t(`role_${employee.role}`, language)}
      </Badge>
    ),
    actions: (
      <div className="flex space-x-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            openEditRoleModal(employee);
          }}
          className="text-blue-600 hover:text-blue-900 p-1"
          title={t('edit_role', language)}
        >
          <Edit2 size={16} />
        </button>
        {employee.role !== 'owner' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              openDeleteModal(employee);
            }}
            className="text-red-600 hover:text-red-900 p-1"
            title={t('remove_employee', language)}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    )
  }));

  return (
    <DashboardLayout title={t('staff', language)}>
      <div className="pb-20 md:pb-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{t('staff', language)}</h1>
            <p className="text-gray-600">{t('manage_staff', language)}</p>
          </div>

          <div className="mt-4 md:mt-0">
            <Button icon={<Plus size={16} />} onClick={openInviteModal}>
              {t('invite_employee', language)}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('total_employees', language)}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalEmployees}</p>
              </div>
              <Users className="text-blue-500" size={32} />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('active_employees', language)}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeEmployees}</p>
              </div>
              <Shield className="text-green-500" size={32} />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('pending_invitations', language)}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingInvites}</p>
              </div>
              <Mail className="text-orange-500" size={32} />
            </div>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder={t('search_staff', language)}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <Select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as UserRole | 'all')}
            className="w-full md:w-48"
          >
            <option value="all">{t('all_roles', language)}</option>
            <option value="owner">{t('role_owner', language)}</option>
            <option value="admin">{t('role_admin', language)}</option>
            <option value="manager">{t('role_manager', language)}</option>
            <option value="staff">{t('role_staff', language)}</option>
          </Select>
        </div>

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <Card className="mb-6">
            <h2 className="text-lg font-semibold mb-4">{t('pending_invitations', language)}</h2>
            <div className="space-y-2">
              {pendingInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200"
                >
                  <div>
                    <p className="font-medium">{invitation.email}</p>
                    <p className="text-sm text-gray-600">
                      {t('invited_by', language)} {invitation.invitedByName}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openCancelInviteModal(invitation)}
                  >
                    {t('cancel', language)}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Employees Table */}
        <Card>
          <Table
            data={tableData}
            columns={tableColumns}
            keyExtractor={(item) => item.id}
            emptyMessage={t('no_employees_found', language)}
          />
        </Card>

        {/* Edit Role Modal */}
        <Modal
          isOpen={isEditRoleModalOpen}
          onClose={() => {
            setIsEditRoleModalOpen(false);
            setCurrentEmployee(null);
          }}
          title={t('edit_role', language)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('employee', language)}
              </label>
              <p className="text-gray-900">{currentEmployee?.username}</p>
              <p className="text-sm text-gray-600">{currentEmployee?.email}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('role', language)}
              </label>
              <Select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                className="w-full"
              >
                <option value="owner">{t('role_owner', language)}</option>
                <option value="admin">{t('role_admin', language)}</option>
                <option value="manager">{t('role_manager', language)}</option>
                <option value="staff">{t('role_staff', language)}</option>
              </Select>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditRoleModalOpen(false);
                  setCurrentEmployee(null);
                }}
              >
                {t('cancel', language)}
              </Button>
              <Button
                onClick={handleUpdateRole}
                disabled={isSubmitting}
                loading={isSubmitting}
              >
                {t('save_changes', language)}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Delete Employee Modal */}
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setCurrentEmployee(null);
          }}
          title={t('remove_employee', language)}
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              {t('remove_employee_confirm', language)} <strong>{currentEmployee?.username}</strong>?
              {t('action_cannot_be_undone', language)}
            </p>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setCurrentEmployee(null);
                }}
              >
                {t('cancel', language)}
              </Button>
              <Button
                variant="danger"
                onClick={handleRemoveEmployee}
                disabled={isSubmitting}
                loading={isSubmitting}
              >
                {t('remove', language)}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Cancel Invitation Modal */}
        <Modal
          isOpen={isCancelInviteModalOpen}
          onClose={() => {
            setIsCancelInviteModalOpen(false);
            setCurrentInvitation(null);
          }}
          title={t('cancel_invitation', language)}
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              {t('cancel_invitation_confirm', language)} <strong>{currentInvitation?.email}</strong>?
            </p>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCancelInviteModalOpen(false);
                  setCurrentInvitation(null);
                }}
              >
                {t('cancel', language)}
              </Button>
              <Button
                variant="danger"
                onClick={handleCancelInvite}
                disabled={isSubmitting}
                loading={isSubmitting}
              >
                {t('cancel_invitation', language)}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Invite Employee Modal */}
        {isInviteModalOpen && (
          <EmployeeInviteModal
            isOpen={isInviteModalOpen}
            onClose={() => setIsInviteModalOpen(false)}
            onInvite={async (email, permissionTemplateId, additionalInfo) => {
              try {
                await inviteEmployee(email, permissionTemplateId, additionalInfo);
                setIsInviteModalOpen(false);
                toast.success(t('invitation_sent_successfully', language));
              } catch (err: any) {
                toast.error(err.message || t('error_sending_invitation', language));
              }
            }}
            templates={templates}
            restaurantId={restaurantId}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default StaffPage;
