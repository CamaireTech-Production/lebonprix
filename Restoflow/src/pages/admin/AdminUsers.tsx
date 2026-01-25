import React, { useEffect, useState } from 'react';
import AdminDashboardLayout from '../../components/layout/AdminDashboardLayout';
import { getFirestore, collection, getDocs, query, where, orderBy, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import designSystem from '../../designSystem';
import Modal from '../../components/ui/Modal';
import { Pencil, Trash2, Eye, EyeOff, PlusCircle, UserX, UserCheck } from 'lucide-react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { getAuth, updatePassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { logActivity } from '../../services/activityLogService';
import { deleteUserAccount, disableUserAccount, enableUserAccount } from '../../utils/userManagement';

const ITEMS_PER_PAGE_OPTIONS = [5, 10, 20, 50, 100];

const AdminUsers: React.FC = () => {
  const db = getFirestore();
  const { currentAdmin } = useAdminAuth();
  const [admins, setAdmins] = useState<any[]>([]);
  const [superAdmins, setSuperAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [adminPage, setAdminPage] = useState(1);
  const [adminItemsPerPage, setAdminItemsPerPage] = useState(10);
  const [superAdminPage, setSuperAdminPage] = useState(1);
  const [superAdminItemsPerPage, setSuperAdminItemsPerPage] = useState(10);

  // Modal state
  const [editModal, setEditModal] = useState<{ open: boolean; user: any | null }>({ open: false, user: null });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; user: any | null }>({ open: false, user: null });
  const [disableModal, setDisableModal] = useState<{ open: boolean; user: any | null }>({ open: false, user: null });
  const [editForm, setEditForm] = useState({ email: '', password: '', role: 'admin' });
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableReason, setDisableReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add Admin modal state
  const [addModal, setAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ email: '', password: '', role: 'admin' });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');

  // Password reveal/hide state
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('role', 'in', ['admin', 'super_admin']), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const all = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setAdmins(all.filter(u => u.role === 'admin'));
        setSuperAdmins(all.filter(u => u.role === 'super_admin'));
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [db, editLoading, deleteLoading, addLoading]);

  // Pagination logic
  const paginatedAdmins = admins.slice((adminPage - 1) * adminItemsPerPage, adminPage * adminItemsPerPage);
  const adminTotalPages = Math.ceil(admins.length / adminItemsPerPage);
  const paginatedSuperAdmins = superAdmins.slice((superAdminPage - 1) * superAdminItemsPerPage, superAdminPage * superAdminItemsPerPage);
  const superAdminTotalPages = Math.ceil(superAdmins.length / superAdminItemsPerPage);

  // Role-based action permissions
  const canEdit = (user: any) => {
    if (!currentAdmin) return false;
    if (currentAdmin.role === 'super_admin') return true;
    if (currentAdmin.role === 'admin') {
      // Admins can edit their own account and other admins (not super_admins)
      return user.role === 'admin';
    }
    return false;
  };
  const canDelete = (user: any) => {
    if (!currentAdmin) return false;
    // Only super_admins can delete
    return currentAdmin.role === 'super_admin' && user.id !== currentAdmin.id;
  };
  const canToggleStatus = (user: any) => {
    if (!currentAdmin) return false;
    // Only super_admins can activate/deactivate
    return currentAdmin.role === 'super_admin' && user.id !== currentAdmin.id;
  };

  // Action handlers
  const openEditModal = (user: any) => {
    setEditForm({ email: user.email, password: '', role: user.role });
    setEditModal({ open: true, user });
    setError('');
    setSuccess('');
  };
  const openDeleteModal = (user: any) => {
    setDeleteModal({ open: true, user });
    setError('');
    setSuccess('');
  };
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setEditForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal.user || !currentAdmin) return;
    setEditLoading(true);
    setError('');
    setSuccess('');
    try {
      const ref = doc(db, 'users', editModal.user.id);
      const oldData = { email: editModal.user.email, role: editModal.user.role };
      // If editing self, update email/password in Auth and Firestore
      if (editModal.user.id === currentAdmin.id) {
        const auth = getAuth();
        if (auth.currentUser) {
          if (editForm.email !== currentAdmin.email) {
            await import('firebase/auth').then(({ updateEmail }) => updateEmail(auth.currentUser!, editForm.email));
          }
          if (editForm.password) {
            await updatePassword(auth.currentUser, editForm.password);
          }
        }
        await updateDoc(ref, {
          email: editForm.email,
          role: editForm.role,
          updatedAt: new Date(),
        });
        // Log activity for edit
        await logActivity({
          userId: currentAdmin?.id,
          userEmail: currentAdmin?.email,
          action: 'admin_edit_user',
          entityType: 'admin',
          entityId: editModal.user.id,
          details: {
            oldEmail: oldData.email,
            newEmail: editForm.email,
            oldRole: oldData.role,
            newRole: editForm.role,
            selfEdit: true,
          },
        });
        setSuccess('Account updated successfully.');
      } else {
        // Editing another user: only update Firestore, show note for email/password
        await updateDoc(ref, {
          email: editForm.email,
          role: editForm.role,
          updatedAt: new Date(),
        });
        // Log activity for edit
        await logActivity({
          userId: currentAdmin?.id,
          userEmail: currentAdmin?.email,
          action: 'admin_edit_user',
          entityType: 'admin',
          entityId: editModal.user.id,
          details: {
            oldEmail: oldData.email,
            newEmail: editForm.email,
            oldRole: oldData.role,
            newRole: editForm.role,
            selfEdit: false,
          },
        });
        setSuccess('Account updated in database. Email/password changes require admin action.');
      }
      setEditModal({ open: false, user: null });
    } catch (err: any) {
      setError(err.message || 'Failed to update admin');
    } finally {
      setEditLoading(false);
    }
  };
  const handleDeleteConfirm = async () => {
    if (!deleteModal.user || !currentAdmin) return;
    setDeleteLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await deleteUserAccount(
        deleteModal.user.id,
        deleteModal.user.email,
        currentAdmin.id,
        currentAdmin.email,
        'admin'
      );
      
      if (result.success) {
        setSuccess(result.message);
        // Refresh the admin list
        fetchAdmins();
        setDeleteModal({ open: false, user: null });
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete admin');
    } finally {
      setDeleteLoading(false);
    }
  };
  const handleDisableUser = async () => {
    if (!disableModal.user || !currentAdmin) return;
    setDisableLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await disableUserAccount(
        disableModal.user.id,
        disableModal.user.email,
        currentAdmin.id,
        currentAdmin.email,
        'admin',
        disableReason
      );
      
      if (result.success) {
        setSuccess(result.message);
        fetchAdmins();
        setDisableModal({ open: false, user: null });
        setDisableReason('');
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to disable admin');
    } finally {
      setDisableLoading(false);
    }
  };

  const handleEnableUser = async (user: any) => {
    if (!currentAdmin) return;
    setEditLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await enableUserAccount(
        user.id,
        user.email,
        currentAdmin.id,
        currentAdmin.email,
        'admin'
      );
      
      if (result.success) {
        setSuccess(result.message);
        fetchAdmins();
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to enable admin');
    } finally {
      setEditLoading(false);
    }
  };

  // Add Admin handlers (update role select logic)
  const openAddModal = () => {
    setAddForm({ email: '', password: '', role: currentAdmin?.role === 'super_admin' ? 'admin' : 'admin' });
    setShowAddPassword(false); // Reset password reveal state
    setAddModal(true);
    setAddError('');
    setAddSuccess('');
  };
  const handleAddChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setAddForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError('');
    setAddSuccess('');
    try {
      const auth = getAuth();
      // Create user in Firebase Auth
      const userCred = await createUserWithEmailAndPassword(auth, addForm.email, addForm.password);
      // Add user to Firestore 'users' collection
      await setDoc(doc(db, 'users', userCred.user.uid), {
        email: addForm.email,
        role: addForm.role,
        isDeleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // Log activity
      await logActivity({
        userId: currentAdmin?.id,
        userEmail: currentAdmin?.email,
        action: 'admin_add_user',
        entityType: 'admin',
        entityId: userCred.user.uid,
        details: { email: addForm.email, role: addForm.role },
      });
      setAddSuccess('Admin account created successfully!');
      setAddModal(false);
    } catch (err: any) {
      setAddError(err.message || 'Failed to create admin');
    } finally {
      setAddLoading(false);
    }
  };

  const renderRow = (user: any, idx: number) => (
    <tr key={user.id || idx} className="hover:bg-gray-50 transition border-b last:border-none">
      <td className="px-6 py-4 whitespace-nowrap font-medium text-primary">{user.email || '—'}</td>
      <td className="px-6 py-4 whitespace-nowrap capitalize">{user.role ? user.role.replace('_', ' ') : '—'}</td>
      <td className="px-6 py-4 whitespace-nowrap">{user.createdAt?.toDate ? user.createdAt.toDate().toLocaleString() : '—'}</td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
          user.isDeleted ? 'bg-red-100 text-red-800' : 
          user.isDeactivated ? 'bg-yellow-100 text-yellow-800' : 
          'bg-green-100 text-green-800'
        }`}>
          {user.isDeleted ? 'Deleted' : user.isDeactivated ? 'Disabled' : 'Active'}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className="flex justify-end space-x-2">
          {canEdit(user) && (
            <button title="Edit" onClick={() => openEditModal(user)} className="p-2 rounded hover:bg-green-100 transition text-green-600"><Pencil size={18} /></button>
          )}
          {!user.isDeleted && !user.isDeactivated && canToggleStatus(user) && (
            <button
              title="Disable Account"
              onClick={() => setDisableModal({ open: true, user })}
              className="p-2 rounded hover:bg-yellow-100 transition text-yellow-600"
            >
              <UserX size={18} />
            </button>
          )}
          {user.isDeactivated && canToggleStatus(user) && (
            <button
              title="Enable Account"
              onClick={() => handleEnableUser(user)}
              className="p-2 rounded hover:bg-green-100 transition text-green-600"
            >
              <UserCheck size={18} />
            </button>
          )}
          {canDelete(user) && (
            <button title="Permanently Delete" onClick={() => openDeleteModal(user)} className="p-2 rounded hover:bg-red-100 transition"><Trash2 size={18} className="text-red-600" /></button>
          )}
        </div>
      </td>
    </tr>
  );

  const renderPagination = (page: number, totalPages: number, setPage: (p: number) => void, itemsPerPage: number, setItemsPerPage: (n: number) => void, totalItems: number, idPrefix: string) => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    // Previous
    pages.push(
      <button
        key="prev"
        onClick={() => setPage(page - 1)}
        disabled={page === 1}
        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {'<'}
      </button>
    );
    if (startPage > 1) {
      pages.push(
        <button key={1} onClick={() => setPage(1)} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">1</button>
      );
      if (startPage > 2) {
        pages.push(
          <span key="start-ellipsis" className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>
        );
      }
    }
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => setPage(i)}
          className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium ${page === i ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          {i}
        </button>
      );
    }
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push(
          <span key="end-ellipsis" className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>
        );
      }
      pages.push(
        <button key={totalPages} onClick={() => setPage(totalPages)} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">{totalPages}</button>
      );
    }
    pages.push(
      <button
        key="next"
        onClick={() => setPage(page + 1)}
        disabled={page === totalPages}
        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {'>'}
      </button>
    );
    return (
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{(page - 1) * itemsPerPage + 1}</span> to{' '}
              <span className="font-medium">{Math.min(page * itemsPerPage, totalItems)}</span>{' '}
              of <span className="font-medium">{totalItems}</span> results
            </p>
            <div className="flex items-center space-x-2">
              <label htmlFor={`${idPrefix}-itemsPerPage`} className="text-sm text-gray-700">Items per page:</label>
              <select
                id={`${idPrefix}-itemsPerPage`}
                value={itemsPerPage}
                onChange={e => { setItemsPerPage(Number(e.target.value)); setPage(1); }}
                className="block w-20 py-1 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              >
                {ITEMS_PER_PAGE_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              {pages}
            </nav>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AdminDashboardLayout>
      <h1 className="text-2xl font-bold mb-4">
        {currentAdmin?.role === 'super_admin' ? 'Users (Admins & Superadmins)' : 'Users (Admins)'}
      </h1>
      {loading ? (
        <div className="flex justify-center items-center h-32">
          <LoadingSpinner size={48} color={designSystem.colors.primary} />
        </div>
      ) : (
        <>
          {currentAdmin?.role === 'super_admin' && (
            <div className="bg-white shadow rounded p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">Superadmins</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedSuperAdmins.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-gray-500">No superadmins found.</td>
                      </tr>
                    ) : (
                      paginatedSuperAdmins.map(renderRow)
                    )}
                  </tbody>
                </table>
                {renderPagination(superAdminPage, superAdminTotalPages, setSuperAdminPage, superAdminItemsPerPage, setSuperAdminItemsPerPage, superAdmins.length, 'superadmin')}
              </div>
            </div>
          )}
          <div className="bg-white shadow rounded p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Admins</h2>
              {currentAdmin?.role === 'super_admin' && (
                <button
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition font-semibold"
                  onClick={openAddModal}
                  disabled={addLoading}
                >
                  <PlusCircle size={18} /> Add Admin
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedAdmins.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-gray-500">No admins found.</td>
                    </tr>
                  ) : (
                    paginatedAdmins.map(renderRow)
                  )}
                </tbody>
              </table>
              {renderPagination(adminPage, adminTotalPages, setAdminPage, adminItemsPerPage, setAdminItemsPerPage, admins.length, 'admin')}
            </div>
          </div>

          {/* Add Admin Modal */}
          <Modal isOpen={addModal} title="Add Admin" onClose={() => setAddModal(false)}>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={addForm.email}
                  onChange={handleAddChange}
                  className="w-full border rounded px-3 py-2"
                  required
                  disabled={addLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showAddPassword ? 'text' : 'password'}
                    name="password"
                    value={addForm.password}
                    onChange={handleAddChange}
                    className="w-full border rounded px-3 py-2 pr-10"
                    required
                    disabled={addLoading}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    tabIndex={-1}
                    onClick={() => setShowAddPassword(v => !v)}
                  >
                    {showAddPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  name="role"
                  value={addForm.role}
                  onChange={handleAddChange}
                  className="w-full border rounded px-3 py-2"
                  disabled={addLoading}
                >
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Only super_admins can create super_admins.</p>
              </div>
              {addError && <div className="text-red-600 text-sm">{addError}</div>}
              {addSuccess && <div className="text-green-600 text-sm">{addSuccess}</div>}
              <div className="flex justify-end gap-2">
                <button type="button" className="px-4 py-2 rounded bg-gray-200 text-gray-700" onClick={() => setAddModal(false)} disabled={addLoading}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded bg-primary text-white font-semibold hover:bg-primary-dark transition" disabled={addLoading}>
                  {addLoading ? 'Creating...' : 'Create Admin'}
                </button>
              </div>
            </form>
          </Modal>

          {/* Edit Modal */}
          <Modal isOpen={editModal.open} title="Edit Admin" onClose={() => setEditModal({ open: false, user: null })}>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={editForm.email}
                  onChange={handleEditChange}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              {currentAdmin?.role === 'super_admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    name="role"
                    value={editForm.role}
                    onChange={handleEditChange}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    name="password"
                    value={editForm.password}
                    onChange={handleEditChange}
                    className="w-full border rounded px-3 py-2 pr-10"
                    placeholder={editModal.user && editModal.user.id === currentAdmin?.id ? 'Enter new password to change' : 'Password change not supported for other users'}
                    disabled={editModal.user && editModal.user.id !== currentAdmin?.id}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    tabIndex={-1}
                    onClick={() => setShowEditPassword(v => !v)}
                    disabled={editModal.user && editModal.user.id !== currentAdmin?.id}
                  >
                    {showEditPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {editModal.user && editModal.user.id !== currentAdmin?.id && (
                  <p className="text-xs text-gray-500 mt-1">Password change is only supported for your own account.</p>
                )}
              </div>
              {error && <div className="text-red-600 text-sm">{error}</div>}
              {success && <div className="text-green-600 text-sm">{success}</div>}
              <div className="flex justify-end gap-2">
                <button type="button" className="px-4 py-2 rounded bg-gray-200 text-gray-700" onClick={() => setEditModal({ open: false, user: null })}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded bg-primary text-white font-semibold hover:bg-primary-dark transition" disabled={editLoading}>
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </Modal>

          {/* Delete Confirmation Modal */}
          <Modal isOpen={deleteModal.open} title="Permanently Delete Admin" onClose={() => setDeleteModal({ open: false, user: null })}>
            <div className="space-y-4">
              <p className="text-red-600 font-semibold">⚠️ WARNING: This action is irreversible!</p>
              <p>Are you sure you want to permanently delete this admin account? This will:</p>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                <li>Delete the user from Firebase Authentication</li>
                <li>Delete the user document from Firestore</li>
                <li>Remove all associated data</li>
              </ul>
              <p className="text-sm text-gray-500">This action cannot be undone.</p>
              {error && <div className="text-red-600 text-sm">{error}</div>}
              <div className="flex justify-end gap-2">
                <button type="button" className="px-4 py-2 rounded bg-gray-200 text-gray-700" onClick={() => setDeleteModal({ open: false, user: null })}>Cancel</button>
                <button type="button" className="px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition" onClick={handleDeleteConfirm} disabled={deleteLoading}>
                  {deleteLoading ? 'Deleting...' : 'Permanently Delete'}
                </button>
              </div>
            </div>
          </Modal>

          {/* Disable Account Modal */}
          <Modal isOpen={disableModal.open} title="Disable Admin Account" onClose={() => setDisableModal({ open: false, user: null })}>
            <div className="space-y-4">
              <p>This will disable the admin account, preventing them from logging in. The account can be re-enabled later.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason for disabling (optional)</label>
                <textarea
                  value={disableReason}
                  onChange={(e) => setDisableReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  rows={3}
                  placeholder="Enter reason for disabling this account..."
                />
              </div>
              {error && <div className="text-red-600 text-sm">{error}</div>}
              <div className="flex justify-end gap-2">
                <button type="button" className="px-4 py-2 rounded bg-gray-200 text-gray-700" onClick={() => setDisableModal({ open: false, user: null })}>Cancel</button>
                <button type="button" className="px-4 py-2 rounded bg-yellow-600 text-white font-semibold hover:bg-yellow-700 transition" onClick={handleDisableUser} disabled={disableLoading}>
                  {disableLoading ? 'Disabling...' : 'Disable Account'}
                </button>
              </div>
            </div>
          </Modal>
        </>
      )}
    </AdminDashboardLayout>
  );
};

export default AdminUsers; 