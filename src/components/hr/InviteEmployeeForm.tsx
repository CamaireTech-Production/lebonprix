import { useState, useEffect } from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import Input from '../common/Input';
import { getUserByEmail, createInvitation, sendInvitationEmailToUser, handleExistingUserInvitation } from '../../services/invitationService';
import { getCompanyTemplates } from '../../services/permissionTemplateService';
import { PermissionTemplate } from '../../types/permissions';
import { showErrorToast } from '../../utils/toast';

interface InviteEmployeeFormProps {
  onInvitationCreated: () => void;
  companyId: string;
  companyName: string;
  inviterData: {
    id: string;
    name: string;
  };
}

const InviteEmployeeForm = ({ onInvitationCreated, companyId, companyName, inviterData }: InviteEmployeeFormProps) => {
  const [email, setEmail] = useState('');
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'staff' | 'manager' | 'admin'>('staff');
  const [permissionTemplateId, setPermissionTemplateId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingUser, setIsCheckingUser] = useState(false);
  const [existingUser, setExistingUser] = useState<import('../../types/models').User | null>(null);
  const [userChecked, setUserChecked] = useState(false);
  const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  // Load company templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setTemplatesLoading(true);
        const companyTemplates = await getCompanyTemplates(companyId);
        setTemplates(companyTemplates);
      } catch (error) {
        console.error('Error loading templates:', error);
      } finally {
        setTemplatesLoading(false);
      }
    };

    loadTemplates();
  }, [companyId]);

  const handleEmailBlur = async () => {
    if (!email.trim()) return;
    
    setIsCheckingUser(true);
    try {
      const user = await getUserByEmail(email);
      setExistingUser(user);
      setUserChecked(true);
      
      if (user) {
        // Pre-fill form with existing user data
        setFirstname(user.firstname || '');
        setLastname(user.lastname || '');
        setPhone(user.phone || '');
      }
    } catch (error) {
      console.error('Error checking user:', error);
      showErrorToast('Failed to check if user exists');
    } finally {
      setIsCheckingUser(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !firstname || !lastname) {
      showErrorToast('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    try {
      if (existingUser) {
        // User exists - add to company immediately
        await handleExistingUserInvitation(
          companyId,
          companyName,
          inviterData,
          { email, firstname, lastname, phone, role, permissionTemplateId },
          existingUser
        );
      } else {
        // User doesn't exist - create invitation
        const invitation = await createInvitation(
          companyId,
          companyName,
          inviterData,
          { email, firstname, lastname, phone, role, permissionTemplateId }
        );
        
        // Send invitation email
        await sendInvitationEmailToUser(invitation);
      }
      
      // Reset form
      setEmail('');
      setFirstname('');
      setLastname('');
      setPhone('');
      setRole('staff');
      setPermissionTemplateId('');
      setExistingUser(null);
      setUserChecked(false);
      
      onInvitationCreated();
    } catch (error: unknown) {
      console.error('Error creating invitation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create invitation';
      showErrorToast(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <div className="max-w-2xl mx-auto">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Invite Employee</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Field */}
          <div>
            <Input
              label="Email Address *"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setUserChecked(false);
                setExistingUser(null);
              }}
              onBlur={handleEmailBlur}
              required
              disabled={isLoading}
            />
            {isCheckingUser && (
              <p className="text-sm text-gray-500 mt-1">Checking if user exists...</p>
            )}
            {userChecked && existingUser && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  ✅ User found: {existingUser.firstname} {existingUser.lastname}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  This user will be added to the company immediately and notified via email.
                </p>
              </div>
            )}
            {userChecked && !existingUser && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  ℹ️ User not found. An invitation will be sent to create an account.
                </p>
              </div>
            )}
          </div>

          {/* Name Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="First Name *"
              value={firstname}
              onChange={(e) => setFirstname(e.target.value)}
              required
              disabled={isLoading}
            />
            <Input
              label="Last Name *"
              value={lastname}
              onChange={(e) => setLastname(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          {/* Phone Field */}
          <Input
            label="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={isLoading}
          />

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role *
            </label>
            <select
              className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as 'staff' | 'manager' | 'admin')}
              required
              disabled={isLoading}
            >
              <option value="staff">Staff (Vendeur)</option>
              <option value="manager">Manager (Gestionnaire)</option>
              <option value="admin">Admin (Magasinier)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Staff: Basic access to sales and products
              <br />
              Manager: Access to finance and reports
              <br />
              Admin: Full access including HR and settings
            </p>
          </div>

          {/* Permission Template Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Permission Template (Optional)
            </label>
            {templatesLoading ? (
              <div className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 bg-gray-50">
                <span className="text-sm text-gray-500">Loading templates...</span>
              </div>
            ) : (
              <select
                className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                value={permissionTemplateId}
                onChange={(e) => setPermissionTemplateId(e.target.value)}
                disabled={isLoading}
              >
                <option value="">Base Role Only</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} - {template.description}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Select a permission template to override the base role permissions.
              If no template is selected, the user will get standard permissions for their role.
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              isLoading={isLoading}
              disabled={isLoading || isCheckingUser}
              loadingText={existingUser ? 'Adding to company...' : 'Sending invitation...'}
            >
              {existingUser ? 'Add to Company' : 'Send Invitation'}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
};

export default InviteEmployeeForm;
