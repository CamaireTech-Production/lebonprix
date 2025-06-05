import { useState } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Input from '../components/common/Input';
import Modal, { ModalFooter } from '../components/common/Modal';

// Mock data
const initialUsers = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@lebonprix.com',
    role: 'Admin',
    lastActive: '2025-04-12 14:30',
  },
  {
    id: '2',
    name: 'Marie Tongo',
    email: 'marie@lebonprix.com',
    role: 'Manager',
    lastActive: '2025-04-12 10:15',
  },
  {
    id: '3',
    name: 'Pierre Kameni',
    email: 'pierre@lebonprix.com',
    role: 'User',
    lastActive: '2025-04-11 16:45',
  },
  {
    id: '4',
    name: 'Sophie Mbida',
    email: 'sophie@lebonprix.com',
    role: 'User',
    lastActive: '2025-04-10 09:20',
  },
];

const initialLogs = [
  {
    id: '1',
    user: 'John Doe',
    action: 'Created a new sale',
    timestamp: '2025-04-12 14:30',
    ipAddress: '192.168.1.1',
  },
  {
    id: '2',
    user: 'Marie Tongo',
    action: 'Updated product stock',
    timestamp: '2025-04-12 12:15',
    ipAddress: '192.168.1.2',
  },
  {
    id: '3',
    user: 'System',
    action: 'Automatic backup completed',
    timestamp: '2025-04-12 00:00',
    ipAddress: 'System',
  },
  {
    id: '4',
    user: 'Pierre Kameni',
    action: 'Logged in',
    timestamp: '2025-04-11 16:45',
    ipAddress: '192.168.1.3',
  },
  {
    id: '5',
    user: 'John Doe',
    action: 'Added new expense',
    timestamp: '2025-04-11 14:10',
    ipAddress: '192.168.1.1',
  },
  {
    id: '6',
    user: 'Marie Tongo',
    action: 'Generated monthly report',
    timestamp: '2025-04-11 10:30',
    ipAddress: '192.168.1.2',
  },
];

const Settings = () => {
  const [activeTab, setActiveTab] = useState('team');
  const [users, setUsers] = useState(initialUsers);
  const [logs] = useState(initialLogs);
  
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'User',
    password: '',
  });
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      role: 'User',
      password: '',
    });
  };
  
  const handleAddUser = () => {
    const newUser = {
      id: Date.now().toString(),
      name: formData.name,
      email: formData.email,
      role: formData.role,
      lastActive: 'Never',
    };
    
    setUsers(prev => [...prev, newUser]);
    setIsAddUserModalOpen(false);
    resetForm();
  };
  
  const handleEditUser = () => {
    if (!currentUser) return;
    
    const updatedUsers = users.map(user => {
      if (user.id === currentUser.id) {
        return {
          ...user,
          name: formData.name,
          email: formData.email,
          role: formData.role,
        };
      }
      return user;
    });
    
    setUsers(updatedUsers);
    setIsEditUserModalOpen(false);
    resetForm();
  };
  
  const handleDeleteUser = (id: string) => {
    setUsers(prev => prev.filter(user => user.id !== id));
  };
  
  const openEditUserModal = (user: any) => {
    setCurrentUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      password: '', // Don't fill password field when editing
    });
    setIsEditUserModalOpen(true);
  };

  return (
    <div className="pb-16 md:pb-0"> {/* Add padding to bottom for mobile nav */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your account settings and preferences</p>
      </div>
      
      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('team')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'team'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            Team Management
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'activity'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            Activity Logs
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'account'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            Account Settings
          </button>
        </nav>
      </div>
      
      {/* Team Management Tab */}
      {activeTab === 'team' && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Team Members</h2>
            <Button 
              icon={<Plus size={16} />}
              onClick={() => setIsAddUserModalOpen(true)}
            >
              Add User
            </Button>
          </div>
          
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Active
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-medium">
                            {user.name.charAt(0)}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge 
                          variant={
                            user.role === 'Admin' ? 'error' : 
                            user.role === 'Manager' ? 'warning' : 
                            'info'
                          }
                        >
                          {user.role}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.lastActive}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button 
                            onClick={() => openEditUserModal(user)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-600 hover:text-red-900"
                            disabled={user.role === 'Admin'} // Prevent deleting admin
                          >
                            <Trash2 size={16} className={user.role === 'Admin' ? 'opacity-50 cursor-not-allowed' : ''} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      
      {/* Activity Logs Tab */}
      {activeTab === 'activity' && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Activity Logs</h2>
          </div>
          
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP Address
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {log.user}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.action}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.timestamp}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.ipAddress}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      
      {/* Account Settings Tab */}
      {activeTab === 'account' && (
        <Card>
          <div className="max-w-xl mx-auto">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Account Information</h3>
                <div className="space-y-4">
                  <Input
                    label="Full Name"
                    defaultValue="Current User"
                  />
                  <Input
                    label="Email Address"
                    type="email"
                    defaultValue="user@lebonprix.com"
                  />
                </div>
              </div>
              
              <div className="pt-5 border-t border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Change Password</h3>
                <div className="space-y-4">
                  <Input
                    label="Current Password"
                    type="password"
                  />
                  <Input
                    label="New Password"
                    type="password"
                  />
                  <Input
                    label="Confirm New Password"
                    type="password"
                  />
                </div>
              </div>
              
              <div className="pt-5 border-t border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Preferences</h3>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="email-notifications"
                        name="email-notifications"
                        type="checkbox"
                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                        defaultChecked
                      />
                    </div>
                    <div className="ml-3">
                      <label htmlFor="email-notifications" className="text-sm font-medium text-gray-700">
                        Email Notifications
                      </label>
                      <p className="text-sm text-gray-500">
                        Receive email notifications for important events
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Language
                    </label>
                    <select className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                      <option value="en">English</option>
                      <option value="fr">French</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-5 border-t border-gray-200">
                <Button variant="outline">
                  Cancel
                </Button>
                <Button>
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
      
      {/* Add User Modal */}
      <Modal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        title="Add New User"
        footer={
          <ModalFooter 
            onCancel={() => setIsAddUserModalOpen(false)}
            onConfirm={handleAddUser}
            confirmText="Add User"
          />
        }
      >
        <div className="space-y-4">
          <Input
            label="Full Name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
          />
          
          <Input
            label="Email Address"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            required
          />
          
          <Input
            label="Password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleInputChange}
            required
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              name="role"
              className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={formData.role}
              onChange={handleInputChange}
            >
              <option value="User">User</option>
              <option value="Manager">Manager</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
        </div>
      </Modal>
      
      {/* Edit User Modal */}
      <Modal
        isOpen={isEditUserModalOpen}
        onClose={() => setIsEditUserModalOpen(false)}
        title="Edit User"
        footer={
          <ModalFooter 
            onCancel={() => setIsEditUserModalOpen(false)}
            onConfirm={handleEditUser}
            confirmText="Update User"
          />
        }
      >
        <div className="space-y-4">
          <Input
            label="Full Name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
          />
          
          <Input
            label="Email Address"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            required
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              name="role"
              className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={formData.role}
              onChange={handleInputChange}
            >
              <option value="User">User</option>
              <option value="Manager">Manager</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
          
          <Input
            label="New Password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleInputChange}
            helpText="Leave blank to keep current password"
          />
        </div>
      </Modal>
    </div>
  );
};

export default Settings;