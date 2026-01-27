import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, Users, Shield, Eye, Key, Power, PowerOff } from 'lucide-react';
import { Card, Button, Badge, Table, Input, Modal, LoadingSpinner, Select } from '../../../components/ui';
import { useEmployees } from '../../../hooks/business/useEmployees';
import { usePermissions } from '../../../hooks/business/usePermissions';
import { useAuth } from '../../../contexts/AuthContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { t } from '../../../utils/i18n';
import type { EmployeeRef, UserRole } from '../../../types/geskap';
import toast from 'react-hot-toast';
import { EmployeeCreateModal } from '../../../components/staff/EmployeeCreateModal';
import { createEmployeeAccount, getEmployeePassword, resetEmployeePassword, deactivateEmployee, activateEmployee } from '../../../services/firestore/employees/employeeAuthService';

const StaffPage = () => {
  const { currentUser, restaurant } = useAuth();
  const { language } = useLanguage();
  const restaurantId = restaurant?.id || currentUser?.uid || '';
  const userId = currentUser?.uid || '';

  const {
    employees,
    loading: employeesLoading,
    error: employeesError,
    updateRole,
    removeEmployee
  } = useEmployees({ restaurantId });

  const { templates, loading: templatesLoading } = usePermissions({ restaurantId, userId });

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditRoleModalOpen, setIsEditRoleModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isViewPasswordModalOpen, setIsViewPasswordModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);

  // Form states
  const [currentEmployee, setCurrentEmployee] = useState<EmployeeRef | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('staff');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const loading = employeesLoading || templatesLoading;

  // Calculate stats
  const stats = useMemo(() => {
    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(e => e.isActive).length;
    const inactiveEmployees = employees.filter(e => !e.isActive).length;

    return {
      totalEmployees,
      activeEmployees,
      inactiveEmployees
    };
  }, [employees]);

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

    if (filterStatus !== 'all') {
      const isActive = filterStatus === 'active';
      filtered = filtered.filter(employee => employee.isActive === isActive);
    }

    return filtered;
  }, [employees, searchQuery, filterRole, filterStatus]);

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

  const handleCreateEmployee = async (employeeData: {
    username: string;
    email: string;
    password: string;
    role: UserRole;
    permissionTemplateId?: string;
    phone?: string;
  }) => {
    try {
      await createEmployeeAccount(restaurantId, userId, employeeData);
      setIsCreateModalOpen(false);
      toast.success(t('employee_created_successfully', language));
    } catch (err: any) {
      throw err; // Let modal handle it
    }
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

  const openViewPasswordModal = (employee: EmployeeRef) => {
    setCurrentEmployee(employee);
    setIsViewPasswordModalOpen(true);
  };

  const openResetPasswordModal = (employee: EmployeeRef) => {
    setCurrentEmployee(employee);
    setNewPassword('');
    setIsResetPasswordModalOpen(true);
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

  const handleResetPassword = async () => {
    if (!currentEmployee?.id || !newPassword || newPassword.length < 6) {
      toast.error(t('password_min_length', language));
      return;
    }

    setIsSubmitting(true);
    try {
      const credentials = await resetEmployeePassword(restaurantId, currentEmployee.id, newPassword);
      toast.success(
        `${t('password_reset_successfully', language)}\nEmail: ${credentials.email}\n${t('password', language)}: ${credentials.password}`
      );
      setIsResetPasswordModalOpen(false);
      setCurrentEmployee(null);
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.message || t('error_resetting_password', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (employee: EmployeeRef) => {
    try {
      if (employee.isActive) {
        await deactivateEmployee(restaurantId, employee.id);
        toast.success(t('employee_deactivated', language));
      } else {
        await activateEmployee(restaurantId, employee.id);
        toast.success(t('employee_activated', language));
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const tableColumns = [
    { header: t('name', language), accessor: 'name' as const },
    { header: t('email', language), accessor: 'email' as const },
    { header: t('role', language), accessor: 'role' as const },
    { header: t('status', language), accessor: 'status' as const },
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
    status: (
      <Badge className={employee.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
        {employee.isActive ? t('active', language) : t('inactive', language)}
      </Badge>
    ),
    actions: (
      <div className="flex space-x-1">
        {employee.passwordHash && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              openViewPasswordModal(employee);
            }}
            className="text-gray-600 hover:text-gray-900 p-1"
            title={t('view_password', language)}
          >
            <Eye size={16} />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            openResetPasswordModal(employee);
          }}
          className="text-blue-600 hover:text-blue-900 p-1"
          title={t('reset_password', language)}
        >
          <Key size={16} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            openEditRoleModal(employee);
          }}
          className="text-indigo-600 hover:text-indigo-900 p-1"
          title={t('edit_role', language)}
        >
          <Edit2 size={16} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleToggleActive(employee);
          }}
          className={`p-1 ${employee.isActive ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'}`}
          title={employee.isActive ? t('deactivate_employee', language) : t('activate_employee', language)}
        >
          {employee.isActive ? <PowerOff size={16} /> : <Power size={16} />}
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
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('team', language)}</h1>
          <p className="text-gray-600">{t('manage_employees_roles', language)}</p>
        </div>

          <div className="mt-4 md:mt-0">
            <Button icon={<Plus size={16} />} onClick={() => setIsCreateModalOpen(true)}>
              {t('create_employee', language)}
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
                <p className="text-sm text-gray-600">{t('inactive', language)}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.inactiveEmployees}</p>
              </div>
              <PowerOff className="text-orange-500" size={32} />
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
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
            className="w-full md:w-48"
          >
            <option value="all">{t('all', language)}</option>
            <option value="active">{t('active', language)}</option>
            <option value="inactive">{t('inactive', language)}</option>
          </Select>
        </div>

        {/* Employees Table */}
        <Card>
          <Table
            data={tableData}
            columns={tableColumns}
            keyExtractor={(item) => item.id}
            emptyMessage={t('no_employees_found', language)}
          />
        </Card>

        {/* Create Employee Modal */}
        <EmployeeCreateModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateEmployee}
          templates={templates}
        />

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

        {/* View Password Modal */}
        <Modal
          isOpen={isViewPasswordModalOpen}
          onClose={() => {
            setIsViewPasswordModalOpen(false);
            setCurrentEmployee(null);
          }}
          title={t('view_password', language)}
        >
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800 mb-3">
                {t('employee', language)}: <strong>{currentEmployee?.username}</strong>
              </p>
              <div className="bg-white rounded p-3 border border-yellow-300">
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  {t('password', language)}:
                </label>
                <code className="text-lg font-mono text-gray-900">
                  {currentEmployee?.passwordHash ? getEmployeePassword(currentEmployee.passwordHash) : t('not_available', language)}
                </code>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button onClick={() => setIsViewPasswordModalOpen(false)}>
                {t('close', language)}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Reset Password Modal */}
        <Modal
          isOpen={isResetPasswordModalOpen}
          onClose={() => {
            setIsResetPasswordModalOpen(false);
            setCurrentEmployee(null);
            setNewPassword('');
          }}
          title={t('reset_password', language)}
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              {t('reset_password_confirm', language)} <strong>{currentEmployee?.username}</strong>
            </p>

            <Input
              label={t('new_password', language)}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('password_placeholder', language)}
              required
              helpText={t('password_min_6_chars', language)}
            />

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsResetPasswordModalOpen(false);
                  setCurrentEmployee(null);
                  setNewPassword('');
                }}
              >
                {t('cancel', language)}
              </Button>
              <Button
                onClick={handleResetPassword}
                disabled={isSubmitting || !newPassword || newPassword.length < 6}
                loading={isSubmitting}
              >
                {t('reset_password', language)}
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
    </>
  );
};

export default StaffPage;
