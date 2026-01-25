import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@contexts/AuthContext';
import { auth } from '@services/core/firebase';
import { Card, Button, Input } from '@components/common';
import { getUserByEmail, createInvitation, sendInvitationEmailToUser, getInvitationLink } from '@services/firestore/employees/invitationService';
import { createUserViaBackend } from '@services/backend/userCreationService';
import { sendCredentialsEmail } from '@services/backend/emailService';
import { getCompanyTemplates } from '@services/firestore/employees/permissionTemplateService';
import { PermissionTemplate } from '../../types/permissions';
import { showErrorToast, showSuccessToast } from '@utils/core/toast';
import { Copy, X, UserPlus, Mail } from 'lucide-react';
import type { Invitation } from '../../types/models';
import UserCreationSummaryModal from './UserCreationSummaryModal';

interface InviteEmployeeFormProps {
  onInvitationCreated: () => void;
  companyId: string;
  companyName: string;
  inviterData: {
    id: string;
    name: string;
  };
}

type CreationMode = 'invitation' | 'direct';

const InviteEmployeeForm = ({ onInvitationCreated, companyId, companyName, inviterData }: InviteEmployeeFormProps) => {
  const { t } = useTranslation();
  const { isOwner, company, effectiveRole } = useAuth();
  
  // Check if user is actually an owner (same logic as PermissionsManagement)
  const isActualOwner = isOwner || effectiveRole === 'owner';
  
  // Mode selection
  const [creationMode, setCreationMode] = useState<CreationMode>('invitation');
  
  // Common fields
  const [email, setEmail] = useState('');
  const [permissionTemplateId, setPermissionTemplateId] = useState<string>('');
  
  // Direct creation fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sendCredentialsEmailOption, setSendCredentialsEmailOption] = useState(true);
  
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingUser, setIsCheckingUser] = useState(false);
  const [existingUser, setExistingUser] = useState<import('../../types/models').User | null>(null);
  const [userChecked, setUserChecked] = useState(false);
  const [isAlreadyMember, setIsAlreadyMember] = useState(false);
  const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [lastCreatedInvitation, setLastCreatedInvitation] = useState<Invitation | null>(null);
  const [copiedInvitationId, setCopiedInvitationId] = useState<string | null>(null);
  
  // Direct creation result
  const [createdUserCredentials, setCreatedUserCredentials] = useState<{
    username: string;
    email: string;
    password: string;
  } | null>(null);
  const [emailSent, setEmailSent] = useState(false);

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

  // Reset form when mode changes
  useEffect(() => {
    setEmail('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setExistingUser(null);
    setUserChecked(false);
    setIsAlreadyMember(false);
    setLastCreatedInvitation(null);
    setCreatedUserCredentials(null);
  }, [creationMode]);

  const handleEmailBlur = async () => {
    if (!email.trim() || creationMode === 'direct') return;
    
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

  const handleInvitationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!email) {
      showErrorToast('Email is required');
      return;
    }
    
    // Validate permission template is selected
    if (!permissionTemplateId) {
      showErrorToast('Please select a permission template');
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
      if (!isAlreadyMember) {
        // Always create invitation - both for existing and new users
        // Users must accept invitation before being added to company
        const invitation = await createInvitation(
          companyId,
          companyName,
          inviterData,
          { email, permissionTemplateId }
        );
        
        // Send invitation email
        await sendInvitationEmailToUser(invitation);
        
        // Store invitation for display
        setLastCreatedInvitation(invitation);
      }
      
      // Reset form
      setEmail('');
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

  const handleDirectCreationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!username || !username.trim()) {
      showErrorToast('Le nom d\'utilisateur est requis');
      return;
    }
    
    if (!email || !email.trim()) {
      showErrorToast('L\'email est requis');
      return;
    }
    
    if (!password) {
      showErrorToast('Le mot de passe est requis');
      return;
    }
    
    if (password.length < 6) {
      showErrorToast('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    
    if (password !== confirmPassword) {
      showErrorToast('Les mots de passe ne correspondent pas');
      return;
    }
    
    if (!permissionTemplateId) {
      showErrorToast('Le modèle de permissions est requis');
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showErrorToast('Format d\'email invalide');
      return;
    }

    setIsLoading(true);
    try {
      // Get Firebase Auth ID token for authentication
      const currentUser = auth.currentUser;
      if (!currentUser) {
        showErrorToast('Vous devez être connecté pour créer un utilisateur');
        return;
      }

      const idToken = await currentUser.getIdToken();

      // Create user via backend (Admin SDK - owner stays connected)
      const result = await createUserViaBackend(
        {
          username: username.trim(),
          email: email.trim(),
          password,
          companyId,
          permissionTemplateId
        },
        idToken
      );

      if (!result.success) {
        throw new Error(result.error || 'Erreur lors de la création de l\'utilisateur');
      }

      // Store credentials for display
      setCreatedUserCredentials({
        username: result.username,
        email: result.email,
        password: result.password
      });

      showSuccessToast('Compte utilisateur créé avec succès');

      // Send email if option is checked
      let emailSentResult = false;
      if (sendCredentialsEmailOption) {
        try {
          const loginUrl = `${window.location.origin}/auth/login`;
          const dashboardUrl = `${window.location.origin}/company/${companyId}/dashboard`;
          
          const emailResult = await sendCredentialsEmail({
            toEmail: result.email,
            toName: result.username,
            companyName,
            creatorName: inviterData.name,
            username: result.username,
            email: result.email,
            password: result.password,
            loginUrl,
            dashboardUrl,
            companyLogo: company?.logo
          });

          emailSentResult = emailResult.success;
          if (emailResult.success) {
            showSuccessToast('Email avec les identifiants envoyé avec succès');
          } else {
            showErrorToast(`Erreur lors de l'envoi de l'email: ${emailResult.error || 'Erreur inconnue'}`);
          }
        } catch (error) {
          console.error('Error sending credentials email:', error);
          // Don't fail the whole operation if email fails
          showErrorToast('Compte créé mais erreur lors de l\'envoi de l\'email');
        }
      }

      setEmailSent(emailSentResult);

      // Reset form
      setEmail('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setPermissionTemplateId('');
      
      // Don't call onInvitationCreated() here - wait for modal to close
      // The modal will trigger the reload when user explicitly closes it
    } catch (error: unknown) {
      console.error('Error creating user directly:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la création de l\'utilisateur';
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

  const handleCloseSummaryModal = () => {
    setCreatedUserCredentials(null);
    setEmailSent(false);
    // Reload the section only when modal is explicitly closed
    onInvitationCreated();
  };

  return (
    <>
      <Card>
        <div className="max-w-2xl mx-auto">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Invite Employee</h3>
          
          {/* Mode Selection - Only show for owners */}
          {isActualOwner && (
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Mode de création
              </label>
              <div className="flex gap-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="creationMode"
                    value="invitation"
                    checked={creationMode === 'invitation'}
                    onChange={(e) => setCreationMode(e.target.value as CreationMode)}
                    className="mr-2"
                  />
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 mr-2 text-gray-600" />
                    <span className="text-sm text-gray-700">Invitation Link</span>
                  </div>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="creationMode"
                    value="direct"
                    checked={creationMode === 'direct'}
                    onChange={(e) => setCreationMode(e.target.value as CreationMode)}
                    className="mr-2"
                  />
                  <div className="flex items-center">
                    <UserPlus className="h-4 w-4 mr-2 text-emerald-600" />
                    <span className="text-sm text-gray-700">Créer le compte directement</span>
                  </div>
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {creationMode === 'invitation' 
                  ? 'Envoyez un lien d\'invitation. L\'utilisateur créera son propre compte.'
                  : 'Créez le compte directement avec username, email et password. Vous pourrez partager les identifiants.'}
              </p>
            </div>
          )}

          <form onSubmit={creationMode === 'direct' ? handleDirectCreationSubmit : handleInvitationSubmit} className="space-y-4">
            {/* Username Field - Only for direct creation */}
            {creationMode === 'direct' && (
              <div>
                <Input
                  label="Nom d'utilisateur *"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="ex: john.doe"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Le nom d'utilisateur doit être unique
                </p>
              </div>
            )}

            {/* Email Field */}
            <div>
              <Input
                label="Email Address *"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (creationMode === 'invitation') {
                    setUserChecked(false);
                    setExistingUser(null);
                    setIsAlreadyMember(false);
                  }
                }}
                onBlur={handleEmailBlur}
                required
                disabled={isLoading}
              />
              {creationMode === 'invitation' && isCheckingUser && (
                <p className="text-sm text-gray-500 mt-1">{t('invitations.checkingUser')}</p>
              )}
              {creationMode === 'invitation' && userChecked && existingUser && !isAlreadyMember && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    ✅ {t('invitations.userFound', { name: existingUser.username || existingUser.email?.split('@')[0] || 'User' })}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    An invitation will be sent to this user. They must accept it before being added to the company.
                  </p>
                </div>
              )}
              {creationMode === 'invitation' && userChecked && !existingUser && !isAlreadyMember && (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    ℹ️ {t('invitations.userNotFound')}
                  </p>
                </div>
              )}
              {creationMode === 'invitation' && userChecked && isAlreadyMember && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800">
                    ⚠️ {t('invitations.alreadyMember')}
                  </p>
                </div>
              )}
            </div>

            {/* Password Fields - Only for direct creation */}
            {creationMode === 'direct' && (
              <>
                <div>
                  <Input
                    label="Mot de passe *"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    minLength={6}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Minimum 6 caractères
                  </p>
                </div>
                <div>
                  <Input
                    label="Confirmer le mot de passe *"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    minLength={6}
                  />
                </div>
              </>
            )}

            {/* Permission Template Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Permission Template *
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
                  required
                >
                  <option value="">-- Select a template --</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} - {template.description}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Select a permission template that defines what the employee can access and manage.
                This is required for all {creationMode === 'direct' ? 'user creations' : 'invitations'}.
              </p>
            </div>

            {/* Send Email Option - Only for direct creation */}
            {creationMode === 'direct' && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="sendCredentialsEmail"
                  checked={sendCredentialsEmailOption}
                  onChange={(e) => setSendCredentialsEmailOption(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="sendCredentialsEmail" className="text-sm text-gray-700">
                  Envoyer les identifiants par email à l'utilisateur
                </label>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end">
              <Button
                type="submit"
                isLoading={isLoading}
                disabled={isLoading || (creationMode === 'invitation' && (isCheckingUser || isAlreadyMember))}
                loadingText={creationMode === 'direct' ? 'Création du compte...' : (existingUser ? 'Adding to company...' : 'Sending invitation...')}
              >
                {creationMode === 'direct' 
                  ? 'Créer le compte' 
                  : (existingUser ? 'Add to Company' : 'Send Invitation')}
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
                      {lastCreatedInvitation.email}
                    </span>
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

      {/* User Creation Summary Modal */}
      {createdUserCredentials && (
        <UserCreationSummaryModal
          isOpen={!!createdUserCredentials}
          onClose={handleCloseSummaryModal}
          credentials={createdUserCredentials}
          companyName={companyName}
          loginUrl={`${window.location.origin}/auth/login`}
          dashboardUrl={`${window.location.origin}/company/${companyId}/dashboard`}
          emailSent={emailSent}
        />
      )}
    </>
  );
};

export default InviteEmployeeForm;
