import { useState, useEffect } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { Card, Button, Input } from '@components/common';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import { User, Building2, Mail, Phone, Calendar, Briefcase, Save } from 'lucide-react';
import { getUserById, updateUser } from '@services/utilities/userService';
import type { User as UserType } from '../../types/models';

const Profile = () => {
  const { user, company, isOwner, currentEmployee, updateCompany: updateCompanyContext } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState<UserType | null>(null);
  
  // Form state - will be different for employee vs company
  const [formData, setFormData] = useState({
    firstname: '',
    lastname: '',
    email: '',
    phone: '',
  });

  // Determine if we're showing employee profile or company profile
  // Un utilisateur est owner si isOwner est true
  const isActualOwner = isOwner;
  const isEmployeeProfile = !isActualOwner && !!currentEmployee;

  useEffect(() => {
    const loadProfileData = async () => {
      if (!user?.uid) return;
      
      setLoading(true);
      try {
        if (isEmployeeProfile) {
          // Load employee profile data
          const userDoc = await getUserById(user.uid);
          if (userDoc) {
            setUserData(userDoc);
            setFormData({
              firstname: userDoc.firstname || '',
              lastname: userDoc.lastname || '',
              email: userDoc.email || '',
              phone: userDoc.phone || '',
            });
          }
        } else if (company) {
          // Load company profile data (for owners)
          setFormData({
            firstname: company.name || '',
            lastname: '',
            email: company.email || '',
            phone: company.phone || '',
          });
        }
      } catch (error) {
        console.error('Error loading profile data:', error);
        showErrorToast('Erreur lors du chargement du profil');
      } finally {
        setLoading(false);
      }
    };

    loadProfileData();
  }, [user, company, isEmployeeProfile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    if (!user?.uid) return;
    
    setSaving(true);
    try {
      if (isEmployeeProfile && userData) {
        // Update employee profile (user document)
        await updateUser(user.uid, {
          firstname: formData.firstname,
          lastname: formData.lastname,
          phone: formData.phone || undefined,
        });
        showSuccessToast('Profil employé mis à jour avec succès');
      } else if (company) {
        // Update company profile
        await updateCompanyContext({
          name: formData.firstname, // Company name goes in firstname field
          email: formData.email,
          phone: formData.phone,
        });
        showSuccessToast('Profil entreprise mis à jour avec succès');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      showErrorToast('Erreur lors de la sauvegarde du profil');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="pb-16 md:pb-0">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          {isEmployeeProfile ? 'Mon Profil' : 'Profil de l\'Entreprise'}
        </h1>
        <p className="text-gray-600">
          {isEmployeeProfile 
            ? 'Gérez vos informations personnelles' 
            : 'Gérez les informations de votre entreprise'}
        </p>
      </div>

      {/* Profile Type Indicator */}
      {isEmployeeProfile && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2 text-blue-700">
            <User className="h-5 w-5" />
            <span className="text-sm font-medium">
              Vous gérez le compte de l'entreprise <strong>{company?.name}</strong> en tant qu'employé
            </span>
          </div>
        </div>
      )}

      <Card>
        <div className="space-y-6">
          {/* Profile Header */}
          <div className="flex items-center space-x-4 pb-6 border-b border-gray-200">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
              {isEmployeeProfile ? (
                <User className="h-10 w-10 text-emerald-600" />
              ) : (
                <Building2 className="h-10 w-10 text-emerald-600" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {isEmployeeProfile 
                  ? `${formData.firstname} ${formData.lastname}`.trim() || 'Employé'
                  : formData.firstname || company?.name || 'Entreprise'}
              </h2>
              {isEmployeeProfile && currentEmployee && (
                <p className="text-sm text-gray-500 capitalize">
                  Rôle: {currentEmployee.role === 'admin' ? 'Administrateur' : 
                         currentEmployee.role === 'manager' ? 'Gestionnaire' : 
                         'Employé'}
                </p>
              )}
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isEmployeeProfile ? 'Prénom' : 'Nom de l\'entreprise'}
              </label>
              <Input
                name="firstname"
                value={formData.firstname}
                onChange={handleInputChange}
                placeholder={isEmployeeProfile ? 'Votre prénom' : 'Nom de l\'entreprise'}
              />
            </div>

            {isEmployeeProfile && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom
                </label>
                <Input
                  name="lastname"
                  value={formData.lastname}
                  onChange={handleInputChange}
                  placeholder="Votre nom"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="h-4 w-4 inline mr-1" />
                Email
              </label>
              <Input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="email@example.com"
                disabled={isEmployeeProfile} // Email cannot be changed for employees
              />
              {isEmployeeProfile && (
                <p className="mt-1 text-xs text-gray-500">
                  L'email ne peut pas être modifié
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="h-4 w-4 inline mr-1" />
                Téléphone
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="+237 6XX XXX XXX"
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Additional Info for Employees */}
          {isEmployeeProfile && currentEmployee && (
            <div className="pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations de l'entreprise</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <Building2 className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-500">Entreprise</p>
                    <p className="text-sm font-medium text-gray-900">{company?.name || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <Briefcase className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-500">Rôle</p>
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {currentEmployee.role === 'admin' ? 'Administrateur' : 
                       currentEmployee.role === 'manager' ? 'Gestionnaire' : 
                       'Employé'}
                    </p>
                  </div>
                </div>
                {currentEmployee.createdAt && (
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <Calendar className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Date d'ajout</p>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(currentEmployee.createdAt.seconds * 1000).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="pt-6 border-t border-gray-200">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full md:w-auto"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Profile;

