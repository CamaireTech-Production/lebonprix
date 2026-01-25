import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { updateEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { toast } from 'react-hot-toast';
import { t } from '../../utils/i18n';
import { useLanguage } from '../../contexts/LanguageContext';

interface SecuritySettingsTabProps {
  restaurant: Record<string, unknown> | null;
  onUpdate: (data: Record<string, unknown>) => Promise<void>;
}

const SecuritySettingsTab: React.FC<SecuritySettingsTabProps> = ({ restaurant }) => {
  const { language } = useLanguage();
  
  const [email, setEmail] = useState((restaurant?.email as string) || '');
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleEmailUpdate = async () => {
    setEmailError('');
    setIsEmailLoading(true);
    try {
      if (!auth.currentUser) throw new Error('No user');
      const credential = EmailAuthProvider.credential(auth.currentUser.email!, emailPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updateEmail(auth.currentUser, newEmail);
      setEmail(newEmail);
      setNewEmail('');
      setEmailPassword('');
      toast.success(t('email_updated_success_profile', language));
    } catch (err: unknown) {
      const errorMessage = (err as Error).message || t('failed_update_email_profile', language);
      setEmailError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handlePasswordUpdate = async () => {
    setPasswordError('');
    setIsPasswordLoading(true);
    try {
      if (!auth.currentUser) throw new Error('No user');
      if (newPassword !== confirmPassword) throw new Error('Passwords do not match');
      if (newPassword.length < 6) throw new Error('Password must be at least 6 characters');
      const credential = EmailAuthProvider.credential(auth.currentUser.email!, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success(t('password_updated_success_profile', language));
    } catch (err: unknown) {
      const errorMessage = (err as Error).message || t('failed_update_password_profile', language);
      setPasswordError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Email Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <Mail className="h-5 w-5 text-gray-600 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">
            {t('change_email_title_profile', language)}
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('current_email_label_profile', language)}
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full px-3 py-3 border border-gray-300 rounded-md bg-gray-100 text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('new_email_label_profile', language)}
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              className="w-full px-3 py-3 border border-gray-300 rounded-md"
              placeholder={t('new_email_placeholder_profile', language)}
            />
          </div>
        </div>
        
        <div className="mt-4 md:w-1/2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('current_password_label_profile', language)}
          </label>
          <input
            type="password"
            value={emailPassword}
            onChange={e => setEmailPassword(e.target.value)}
            className="w-full px-3 py-3 border border-gray-300 rounded-md"
            placeholder={t('current_password_placeholder_profile', language)}
          />
        </div>
        
        {emailError && <div className="mt-2 text-red-600 text-sm">{emailError}</div>}
        
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={isEmailLoading || !newEmail || !emailPassword}
            className="px-6 py-2 rounded-md bg-primary text-white font-medium disabled:opacity-50"
            onClick={handleEmailUpdate}
          >
            {isEmailLoading ? t('updating_profile', language) : t('update_email_profile', language)}
          </button>
        </div>
      </div>

      {/* Password Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <Lock className="h-5 w-5 text-gray-600 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">
            {t('change_password_title_profile', language)}
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('current_password_label_profile', language)}
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 rounded-md"
                placeholder={t('current_password_placeholder_profile', language)}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(v => !v)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400"
                tabIndex={-1}
              >
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('new_password_label_profile', language)}
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 rounded-md"
                placeholder={t('new_password_placeholder_profile', language)}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(v => !v)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400"
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('confirm_new_password_label_profile', language)}
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 rounded-md"
                placeholder={t('confirm_new_password_placeholder_profile', language)}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(v => !v)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        </div>
        
        {passwordError && <div className="mt-2 text-red-600 text-sm">{passwordError}</div>}
        
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={isPasswordLoading || !currentPassword || !newPassword || !confirmPassword}
            className="px-6 py-2 rounded-md bg-primary text-white font-medium disabled:opacity-50"
            onClick={handlePasswordUpdate}
          >
            {isPasswordLoading ? t('updating_profile', language) : t('update_password_profile', language)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SecuritySettingsTab;
