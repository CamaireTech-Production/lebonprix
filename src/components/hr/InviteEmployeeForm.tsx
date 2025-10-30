import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Button from '../common/Button';
import Input from '../common/Input';
import { getUserByEmail, createInvitation, sendInvitationEmailToUser, handleExistingUserInvitation, getInvitationLink } from '../../services/invitationService';
import { getCompanyTemplates } from '../../services/permissionTemplateService';
import { PermissionTemplate } from '../../types/permissions';
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import { Copy, X } from 'lucide-react';
import type { Invitation } from '../../types/models';

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
  const { t } = useTranslation();
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
  const [isAlreadyMember, setIsAlreadyMember] = useState(false);
  const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [lastCreatedInvitation, setLastCreatedInvitation] = useState<Invitation | null>(null);
  const [copiedInvitationId, setCopiedInvitationId] = useState<string | null>(null);

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
      const result = await getUserByEmail(email, companyId);
      setUserChecked(true);
      
      switch (result.type) {
        case 'not_found':
          setExistingUser(null);
          setIsAlreadyMember(false);
          break;
          
        case 'found':
          setExistingUser(result.user);
          setIsAlreadyMember(false);
          // Pre-fill form with existing user data
          setFirstname(result.user.firstname || '');
          setLastname(result.user.lastname || '');
          setPhone(result.user.phone || '');
          break;
          
        case 'already_member':
          setExistingUser(null);
          setIsAlreadyMember(true);
          showErrorToast(t('invitations.alreadyMember'));
          break;
          
        case 'has_pending_invitation':
          setExistingUser(null);
          setIsAlreadyMember(true);
          showErrorToast(t('invitations.hasPendingInvitation'));
          break;
      }
    } catch (error) {
      console.error('Error checking user:', error);
      showErrorToast(t('invitations.checkFailed'));
    } finally {
      setIsCheckingUser(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!email || !firstname || !lastname) {
      showErrorToast(t('invitations.requiredFields'));
      return;
    }
    
    // Validate email format
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      showErrorToast('Email is required');
      return;
    }
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      showErrorToast('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      if (existingUser && !isAlreadyMember) {
        // User exists - add to company immediately
        await handleExistingUserInvitation(
          companyId,
          companyName,
          inviterData,
          { email, firstname, lastname, phone, role, permissionTemplateId },
          existingUser
        );
      } else if (!isAlreadyMember) {
        // User doesn't exist - create invitation
        const invitation = await createInvitation(
          companyId,
          companyName,
          inviterData,
          { email, firstname, lastname, phone, role, permissionTemplateId }
        );
        
        // Send invitation email
        await sendInvitationEmailToUser(invitation);
        
        // Store invitation for display
        setLastCreatedInvitation(invitation);
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
      setIsAlreadyMember(false);
      
      onInvitationCreated();
    } catch (error: unknown) {
      console.error('Error creating invitation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create invitation';
      showErrorToast(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async (invitationId: string) => {
    try {
      const link = getInvitationLink(invitationId);
      await navigator.clipboard.writeText(link);
      setCopiedInvitationId(invitationId);
      showSuccessToast('Invitation link copied to clipboard');
      
      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopiedInvitationId(null);
      }, 2000);
    } catch (error) {
      console.error('Error copying link:', error);
      showErrorToast('Failed to copy link');
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
                setIsAlreadyMember(false);
              }}
              onBlur={handleEmailBlur}
              required
              disabled={isLoading}
            />
            {isCheckingUser && (
              <p className="text-sm text-gray-500 mt-1">{t('invitations.checkingUser')}</p>
            )}
            {userChecked && existingUser && !isAlreadyMember && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  ✅ {t('invitations.userFound', { name: `${existingUser.firstname} ${existingUser.lastname}` })}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {t('invitations.userFoundDescription')}
                </p>
              </div>
            )}
            {userChecked && !existingUser && !isAlreadyMember && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  ℹ️ {t('invitations.userNotFound')}
                </p>
              </div>
            )}
            {userChecked && isAlreadyMember && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">
                  ⚠️ {t('invitations.alreadyMember')}
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
              disabled={isLoading || isCheckingUser || isAlreadyMember}
              loadingText={existingUser ? 'Adding to company...' : 'Sending invitation...'}
            >
              {existingUser ? 'Add to Company' : 'Send Invitation'}
            </Button>
          </div>
        </form>
        
        {/* Success message with invitation link */}
        {lastCreatedInvitation && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-sm font-medium text-green-800">
                  Invitation sent successfully!
                </h4>
                <p className="text-sm text-green-700 mt-1">
                  An invitation email has been sent to{' '}
                  <span className="font-medium">
                    {lastCreatedInvitation.firstname} {lastCreatedInvitation.lastname}
                  </span>{' '}
                  ({lastCreatedInvitation.email})
                </p>
              </div>
              <button
                onClick={() => setLastCreatedInvitation(null)}
                className="text-green-600 hover:text-green-800 transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Invitation Link:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={getInvitationLink(lastCreatedInvitation.id)}
                  className="flex-1 bg-white border border-green-200 rounded-md px-3 py-2 text-sm font-mono text-gray-800 focus:outline-none focus:ring-0"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyLink(lastCreatedInvitation.id)}
                  className="shrink-0"
                >
                  <Copy className="h-4 w-4 mr-1" />
                  {copiedInvitationId === lastCreatedInvitation.id ? 'Copié !' : 'Copier'}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                You can copy this link to share it manually if needed.
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default InviteEmployeeForm;
