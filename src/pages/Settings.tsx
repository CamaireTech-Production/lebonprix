import { useState, ChangeEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import ActivityList from '../components/dashboard/ActivityList';
import { showSuccessToast, showErrorToast } from '../utils/toast';

// Mock activities for now - will be replaced with real data
const mockActivities = [
  {
    id: '1',
    title: 'New Sale Created',
    description: 'Created a new sale for John Doe',
    timestamp: new Date('2024-03-12T14:30:00'),
    type: 'sale' as const,
  },
  {
    id: '2',
    title: 'Product Stock Updated',
    description: 'Updated stock for Product XYZ',
    timestamp: new Date('2024-03-12T12:15:00'),
    type: 'product' as const,
  },
  {
    id: '3',
    title: 'New Expense Added',
    description: 'Added delivery expense of 5000 XAF',
    timestamp: new Date('2024-03-11T14:10:00'),
    type: 'expense' as const,
  },
];

const Settings = () => {
  const [activeTab, setActiveTab] = useState('account');
  const { company, user, updateCompany, updateUserPassword } = useAuth();
  
  // Form state for company settings
  const [formData, setFormData] = useState({
    name: company?.name || '',
    description: company?.description || '',
    phone: company?.phone?.replace('+237', '') || '', // Remove +237 prefix for display
    location: company?.location || '',
    email: company?.email || '',
    logo: company?.logo || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear password error when user starts typing
    if (name.startsWith('password') || name === 'currentPassword') {
      setPasswordError('');
    }
  };
  
  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    if (value.length <= 9) { // Only allow 9 digits after +237
      setFormData(prev => ({ ...prev, phone: value }));
    }
  };
  
  const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, logo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };
  
  const validatePasswordChange = () => {
    if (!formData.currentPassword && (formData.newPassword || formData.confirmPassword)) {
      setPasswordError('Current password is required to change password');
      return false;
    }
    
    if (formData.newPassword !== formData.confirmPassword) {
      setPasswordError('New passwords do not match');
      return false;
    }
    
    if (formData.newPassword && formData.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return false;
    }
    
    return true;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePasswordChange()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Update company information
      const companyData = {
        name: formData.name,
        description: formData.description || undefined,
        phone: `+237${formData.phone}`,
        location: formData.location || undefined,
        logo: formData.logo || undefined,
        email: formData.email
      };

      await updateCompany(companyData);

      // Update password if provided
      if (formData.currentPassword && formData.newPassword) {
        await updateUserPassword(formData.currentPassword, formData.newPassword);
      }

      showSuccessToast('Settings updated successfully');
      
      // Reset password fields after successful update
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
    } catch (error: any) {
      console.error('Error updating settings:', error);
      showErrorToast(error.message || 'Failed to update settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: company?.name || '',
      description: company?.description || '',
      phone: company?.phone?.replace('+237', '') || '',
      location: company?.location || '',
      email: company?.email || '',
      logo: company?.logo || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setPasswordError('');
  };

  return (
    <div className="pb-16 md:pb-0">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your account settings and preferences</p>
      </div>
      
      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
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
        </nav>
      </div>
      
      {/* Account Settings Tab */}
      {activeTab === 'account' && (
        <form onSubmit={handleSubmit}>
          <Card>
            <div className="max-w-xl mx-auto">
              <div className="space-y-6">
                {/* Company Logo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Logo
                  </label>
                  <div className="mt-1 flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {formData.logo ? (
                        <img
                          src={formData.logo}
                          alt="Company logo"
                          className="h-16 w-16 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                          <span className="text-gray-400">No logo</span>
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-gray-300 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                    />
                  </div>
                </div>

                {/* Company Information */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Company Information</h3>
                  <div className="space-y-4">
                    <Input
                      label="Company Name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                    />
                    <Input
                      label="Description"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      helpText="Optional"
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone Number
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
                          helpText="Enter 9 digits after +237"
                        />
                      </div>
                    </div>
                    <Input
                      label="Location"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      helpText="Optional"
                    />
                    <Input
                      label="Email Address"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
                
                {/* Password Change */}
                <div className="pt-5 border-t border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Change Password</h3>
                  {passwordError && (
                    <div className="mb-4 bg-red-50 text-red-800 p-3 rounded-md text-sm">
                      {passwordError}
                    </div>
                  )}
                  <div className="space-y-4">
                    <Input
                      label="Current Password"
                      name="currentPassword"
                      type="password"
                      value={formData.currentPassword}
                      onChange={handleInputChange}
                      helpText="Required only if changing password"
                    />
                    <Input
                      label="New Password"
                      name="newPassword"
                      type="password"
                      value={formData.newPassword}
                      onChange={handleInputChange}
                      helpText="Leave blank to keep current password"
                    />
                    <Input
                      label="Confirm New Password"
                      name="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      helpText="Leave blank to keep current password"
                    />
                  </div>
                </div>
                
                {/* Preferences */}
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
                
                {/* Form Actions */}
                <div className="flex justify-end space-x-3">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    isLoading={isLoading}
                    disabled={isLoading}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </form>
      )}
      
      {/* Activity Logs Tab */}
      {activeTab === 'activity' && (
        <ActivityList activities={mockActivities} />
      )}
    </div>
  );
};

export default Settings;