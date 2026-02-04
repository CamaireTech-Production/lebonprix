import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { updateUser } from '../../services/utilities/userService';
import { User, Mail, Phone, Briefcase, Edit2, Save, X, Loader2 } from 'lucide-react';
import UserAvatar from '../../components/common/UserAvatar';

const Profile: React.FC = () => {
  const { t } = useTranslation();
  const { user, company, currentEmployee, userCompanies } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    username: currentEmployee?.username || '',
    email: user?.email || '',
    phone: currentEmployee?.phone || '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    if (!user?.uid) return;

    // Basic validation
    if (!formData.username.trim()) {
      // You could add a toast here if you have a toast system
      alert(t('common.required'));
      return;
    }

    setIsSaving(true);
    try {
      await updateUser(user.uid, {
        username: formData.username,
        phone: formData.phone
      });

      // Force reload to ensure all contexts (AuthContext, etc.) get the fresh data
      // This is the simplest way to ensure "changes reflect" given the current architecture
      window.location.reload();

    } catch (error) {
      console.error("Failed to update profile", error);
      setIsSaving(false);
      alert(t('common.error'));
    }
  };

  const handleCancel = () => {
    setFormData({
      username: currentEmployee?.username || '',
      email: user?.email || '',
      phone: currentEmployee?.phone || '',
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
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">{t('profile.title')}</h1>
          <p className="text-gray-500 mt-1">{t('profile.subtitle', 'Gérez vos informations personnelles et paramètres de compte')}</p>
        </div>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-blue-200"
          >
            <Edit2 size={18} />
            {t('common.edit')}
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-emerald-200 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {isSaving ? t('common.saving') : t('common.save')}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gray-100 text-gray-600 font-semibold rounded-xl hover:bg-gray-200 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70"
            >
              <X size={18} />
              {t('common.cancel')}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Avatar & Summary */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center text-center relative overflow-hidden group">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-blue-500 to-indigo-600 opacity-10" />

            <div className="relative mt-4">
              <div className="p-1 bg-white rounded-full shadow-xl">
                <UserAvatar company={company} size="lg" className="w-32 h-32 text-3xl font-bold ring-4 ring-blue-50" />
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight leading-tight">
                {currentEmployee?.username || user?.email?.split('@')[0]}
              </h2>
              <div className="inline-flex items-center px-4 py-1 rounded-full text-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                {t('profile.active')}
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-gray-50 w-full grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-xs text-gray-400 uppercase font-bold tracking-widest">{t('profile.memberSince')}</p>
                <p className="text-sm font-bold text-gray-700 mt-1">
                  {user?.metadata?.creationTime ? new Date(user.metadata.creationTime).getFullYear() : '-'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400 uppercase font-bold tracking-widest">{t('profile.lastLogin')}</p>
                <p className="text-sm font-bold text-gray-700 mt-1">
                  {user?.metadata?.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Account Details */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Mail size={14} />
              {t('profile.accountInfo')}
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{t('profile.email')}</span>
                <span className="text-sm font-semibold text-gray-700 truncate ml-4" title={user?.email || ''}>
                  {user?.email}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{t('profile.status')}</span>
                <span className="text-sm font-bold text-emerald-600">{t('profile.active')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Detailed Info & Companies */}
        <div className="lg:col-span-2 space-y-8">
          {/* Personal Info Card */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-50 bg-gray-50/30">
              <h3 className="text-xl font-bold text-gray-900">{t('profile.personalInfo', 'Informations Personnelles')}</h3>
              <p className="text-sm text-gray-500 mt-1">{t('profile.personalInfoSubtitle', 'Informations de contact et détails du profil')}</p>
            </div>

            <div className="p-8 space-y-0 divide-y divide-gray-100">
              {/* Row: Username */}
              <div className="py-6 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 group">
                <div className="flex items-center gap-3 sm:w-1/3">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                    <User size={18} />
                  </div>
                  <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                    {t('profile.username')}
                  </label>
                </div>
                <div className="sm:flex-1">
                  {isEditing ? (
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all text-gray-900 font-semibold"
                    />
                  ) : (
                    <p className="text-lg font-bold text-gray-900">{currentEmployee?.username || '-'}</p>
                  )}
                </div>
              </div>

              {/* Row: Email */}
              <div className="py-6 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 group">
                <div className="flex items-center gap-3 sm:w-1/3">
                  <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-all shadow-sm">
                    <Mail size={18} />
                  </div>
                  <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                    {t('profile.email')}
                  </label>
                </div>
                <div className="sm:flex-1">
                  <p className="text-lg font-bold text-gray-900 break-all">{user?.email}</p>
                </div>
              </div>

              {/* Row: Phone */}
              <div className="py-6 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 group">
                <div className="flex items-center gap-3 sm:w-1/3">
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">
                    <Phone size={18} />
                  </div>
                  <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                    {t('profile.phone')}
                  </label>
                </div>
                <div className="sm:flex-1">
                  {isEditing ? (
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all text-gray-900 font-semibold"
                    />
                  ) : (
                    <p className="text-lg font-bold text-gray-900">{currentEmployee?.phone || '-'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Companies & Roles Card */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{t('profile.companyInfo', 'Mes Entreprises')}</h3>
                <p className="text-sm text-gray-500 mt-1">{t('profile.companyInfoSubtitle', 'Vos rôles et accès à travers vos différentes entreprises')}</p>
              </div>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-full">
                <Briefcase size={20} />
              </div>
            </div>

            <div className="p-8">
              {userCompanies && userCompanies.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {userCompanies.map((userCompany) => (
                    <div
                      key={userCompany.companyId}
                      className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${userCompany.companyId === company?.id
                        ? 'bg-blue-50/50 border-blue-200 ring-1 ring-blue-100'
                        : 'bg-gray-50/50 border-gray-100 hover:border-gray-200'
                        }`}
                    >
                      <div className="flex items-center gap-4">
                        {userCompany.logo ? (
                          <img
                            src={userCompany.logo}
                            alt={userCompany.name}
                            className={`w-12 h-12 rounded-xl object-cover shadow-sm ${userCompany.companyId === company?.id ? 'ring-2 ring-blue-500' : 'border border-gray-100'}`}
                          />
                        ) : (
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl shadow-sm ${userCompany.companyId === company?.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 border border-gray-100'
                            }`}>
                            {userCompany.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-gray-900 text-lg flex items-center gap-2">
                            {userCompany.name}
                            {userCompany.companyId === company?.id && (
                              <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 bg-blue-600 text-white rounded-md font-extrabold">
                                {t('common.active', 'Actuelle')}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 font-medium">{t('profile.memberSince')} {userCompany.joinedAt ? new Date(userCompany.joinedAt.seconds * 1000).toLocaleDateString() : '-'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold shadow-sm ${userCompany.role === 'owner' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                          userCompany.role === 'admin' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                            userCompany.role === 'manager' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                              'bg-gray-100 text-gray-700 border border-gray-200'
                          }`}>
                          {t(`profile.roles.${userCompany.role}`, userCompany.role)}
                        </div>
                        {userCompany.permissionTemplateId && (
                          <p className="text-[10px] text-gray-400 mt-1 font-bold uppercase tracking-tight">
                            Template ID: {userCompany.permissionTemplateId.split('_')[1] || userCompany.permissionTemplateId}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                  <p className="text-gray-500 font-medium">{t('profile.noCompanies', 'Aucune entreprise associée')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
