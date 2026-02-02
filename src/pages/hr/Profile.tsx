import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { User, Mail, Phone, Calendar, Briefcase, Edit2, Save, X } from 'lucide-react';
import UserAvatar from '../../components/common/UserAvatar';

const Profile: React.FC = () => {
  const { t } = useTranslation();
  const { user, company, currentEmployee } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: currentEmployee?.username || '',
    email: user?.email || '',
    phone: currentEmployee?.phone || '',
    role: currentEmployee?.role || '',
    birthday: currentEmployee?.birthday || ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = () => {
    // TODO: Implement save functionality
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      username: currentEmployee?.username || '',
      email: user?.email || '',
      phone: currentEmployee?.phone || '',
      role: currentEmployee?.role || '',
      birthday: currentEmployee?.birthday || ''
    });
    setIsEditing(false);
  };

  if (!user) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center">
          <p className="text-gray-500">{t('profile.noUser')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('profile.title')}</h1>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Edit2 size={16} />
            {t('common.edit')}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Save size={16} />
              {t('common.save')}
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <X size={16} />
              {t('common.cancel')}
            </button>
          </div>
        )}
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar */}
          <div className="flex flex-col items-center">
            <UserAvatar company={company} size="lg" />
            <h2 className="mt-4 text-xl font-semibold text-gray-900">
              {currentEmployee?.username || user?.email}
            </h2>
            <p className="text-gray-500">{currentEmployee?.role || t('profile.noRole')}</p>
          </div>

          {/* Info */}
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('profile.username')}
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <div className="flex items-center gap-2 text-gray-900">
                    <User size={16} className="text-gray-400" />
                    {currentEmployee?.username || '-'}
                  </div>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('profile.email')}
                </label>
                <div className="flex items-center gap-2 text-gray-900">
                  <Mail size={16} className="text-gray-400" />
                  {user?.email}
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('profile.phone')}
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <div className="flex items-center gap-2 text-gray-900">
                    <Phone size={16} className="text-gray-400" />
                    {currentEmployee?.phone || '-'}
                  </div>
                )}
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('profile.role')}
                </label>
                {isEditing ? (
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="admin">{t('profile.roles.admin')}</option>
                    <option value="manager">{t('profile.roles.manager')}</option>
                    <option value="staff">{t('profile.roles.staff')}</option>
                  </select>
                ) : (
                  <div className="flex items-center gap-2 text-gray-900">
                    <Briefcase size={16} className="text-gray-400" />
                    {currentEmployee?.role || '-'}
                  </div>
                )}
              </div>

              {/* Birthday */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('profile.birthday')}
                </label>
                {isEditing ? (
                  <input
                    type="date"
                    name="birthday"
                    value={formData.birthday}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <div className="flex items-center gap-2 text-gray-900">
                    <Calendar size={16} className="text-gray-400" />
                    {currentEmployee?.birthday ? new Date(currentEmployee.birthday).toLocaleDateString() : '-'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Account Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {t('profile.accountInfo')}
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">{t('profile.memberSince')}</span>
              <span className="text-gray-900">
                {user?.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('profile.lastLogin')}</span>
              <span className="text-gray-900">
                {user?.metadata?.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleDateString() : '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('profile.status')}</span>
              <span className="text-green-600 font-medium">
                {t('profile.active')}
              </span>
            </div>
          </div>
        </div>

        {/* Company Information */}
        {company && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {t('profile.companyInfo')}
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">{t('profile.company')}</span>
                <span className="text-gray-900">{company.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('profile.role')}</span>
                <span className="text-gray-900 capitalize">{currentEmployee?.role || '-'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
