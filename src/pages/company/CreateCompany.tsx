import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@services/core/firebase';
import { Card, Button, Input } from '@components/common';
import { Building2, Upload, ArrowLeft, ArrowRight } from 'lucide-react';
import { showWarningToast } from '@utils/core/toast';
import { useTranslation } from 'react-i18next';
import { validateCameroonPhone, normalizePhoneNumber } from '@utils/core/phoneUtils';
import PendingInvitationsBanner from '@components/invitations/PendingInvitationsBanner';
import PackageSelector from '@components/company/PackageSelector';

interface CompanyFormData {
  name: string;
  description: string;
  phone: string;
  email: string;
  report_mail: string;
  report_time: string;
  location: string;
  logo?: string;
}

export default function CreateCompany() {
  const { t } = useTranslation();
  // Step state: 1 = company info, 2 = plan selection
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'enterprise' | null>(null);
  const [formData, setFormData] = useState<CompanyFormData>({
    name: '',
    description: '',
    phone: '',
    email: '',
    report_mail: '',
    report_time: '08:00',
    location: '',
    logo: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<CompanyFormData>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const navigate = useNavigate();
  const { currentUser, user } = useAuth();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user starts typing
    if (errors[name as keyof CompanyFormData]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    if (value.length <= 9) { // Only allow 9 digits after +237
      setFormData(prev => ({
        ...prev,
        phone: value
      }));

      // Clear error when user starts typing
      if (errors.phone) {
        setErrors(prev => ({
          ...prev,
          phone: undefined
        }));
      }
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<CompanyFormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom de l\'entreprise est requis';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Le téléphone est requis';
    } else {
      // Combine +237 with the 9 digits entered
      const fullPhone = `+237${formData.phone}`;
      // Validate using the existing phone validation utility
      if (!validateCameroonPhone(fullPhone)) {
        if (formData.phone.length !== 9) {
          newErrors.phone = 'Le numéro de téléphone doit contenir 9 chiffres';
        } else {
          newErrors.phone = 'Format de téléphone invalide. Le numéro doit commencer par 6, 7, 8 ou 9';
        }
      }
    }

    if (!formData.email.trim()) {
      newErrors.email = 'L\'email est requis';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Format d\'email invalide';
    }

    if (!formData.report_mail.trim()) {
      newErrors.report_mail = 'L\'email de rapport est requis';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.report_mail)) {
      newErrors.report_mail = 'Format d\'email invalide';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!currentUser) {
      console.error('Utilisateur non connecté');
      setError('Vous devez être connecté pour créer une company');
      return;
    }

    if (isUploadingLogo) {
      setError('Veuillez attendre la fin de l\'upload du logo');
      return;
    }

    setIsLoading(true);
    setError(''); // Clear previous errors

    try {
      // Handle report_time: validate "HH:mm" format or default to "08:00"
      let reportTime = formData.report_time || '08:00';
      const timePattern = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
      if (!timePattern.test(reportTime)) {
        reportTime = '08:00';
        showWarningToast(t('settingsPage.messages.reportTimeDefault'));
      }

      // Import the correct createCompany function
      const { createCompany } = await import('@services/firestore/companies/companyService');

      // Normalize phone number before saving (combine +237 with the 9 digits)
      const normalizedPhone = normalizePhoneNumber(`+237${formData.phone.trim()}`);

      // Create company using the standardized function with planType
      const company = await createCompany(currentUser.uid, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        phone: normalizedPhone,
        email: formData.email.trim(),
        report_mail: formData.report_mail.trim(),
        report_time: reportTime,
        location: formData.location.trim(),
        logo: formData.logo || undefined,
        planType: selectedPlan || 'enterprise' // Use selected plan
      });

      console.log('✅ Company créée avec succès:', company.id);
      setSuccess(true);

      // 3. Redirection vers le dashboard de la company après un court délai
      setTimeout(() => {
        navigate(`/company/${company.id}/dashboard`);
      }, 1500);

    } catch (error: any) {
      console.error('Erreur lors de la création de la company:', error);

      // Vérifier si c'est une erreur spécifique à report_mail
      if (error.message && error.message.includes('report_mail')) {
        showWarningToast('Email de rapport non sauvegardé (les autres modifications sont OK)');
      } else {
        setError('Erreur lors de la création de la company. Veuillez réessayer.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      setError('Veuillez sélectionner un fichier image valide');
      return;
    }

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('L\'image ne doit pas dépasser 5MB');
      return;
    }

    setIsUploadingLogo(true);
    setError('');

    try {
      // Créer une référence unique pour l'image
      const logoRef = ref(storage, `company-logos/${currentUser?.uid}/${Date.now()}-${file.name}`);

      // Uploader le fichier
      const snapshot = await uploadBytes(logoRef, file);

      // Obtenir l'URL de téléchargement
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Mettre à jour le formulaire avec l'URL
      setFormData(prev => ({
        ...prev,
        logo: downloadURL
      }));

      console.log('Logo uploadé avec succès:', downloadURL);
    } catch (error) {
      console.error('Erreur lors de l\'upload du logo:', error);
      setError('Erreur lors de l\'upload de l\'image. Veuillez réessayer.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center">
              <button
                onClick={() => navigate(-1)}
                className="mr-4 p-2 text-gray-400 hover:text-gray-600"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Building2 className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-3">
                <h1 className="text-2xl font-bold text-gray-900">Créer une companie</h1>
                <p className="text-sm text-gray-500">Remplissez les informations de votre entreprise</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Invitations Banner */}
      {user?.email && (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <PendingInvitationsBanner userEmail={user.email} />
        </div>
      )}

      {/* Step Indicator */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex items-center justify-center space-x-4">
          <div className={`flex items-center ${currentStep >= 1 ? 'text-indigo-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep >= 1 ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300'}`}>
              1
            </div>
            <span className="ml-2 text-sm font-medium">Informations</span>
          </div>
          <div className={`w-16 h-0.5 ${currentStep >= 2 ? 'bg-indigo-600' : 'bg-gray-300'}`} />
          <div className={`flex items-center ${currentStep >= 2 ? 'text-indigo-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep >= 2 ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300'}`}>
              2
            </div>
            <span className="ml-2 text-sm font-medium">Plan</span>
          </div>
        </div>
      </div>

      {/* Step 2: Plan Selection */}
      {currentStep === 2 && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="p-8">
            {/* Success Message */}
            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-800">
                      Company {selectedPlan === 'starter' ? 'Starter' : 'Enterprise'} créée avec succès ! Redirection en cours...
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <PackageSelector
              selectedPlan={selectedPlan}
              onSelect={setSelectedPlan}
              disabled={isLoading || success}
            />

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(1)}
                disabled={isLoading}
                icon={<ArrowLeft className="h-4 w-4" />}
              >
                Retour
              </Button>
              <div className="flex space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                  disabled={isLoading}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!selectedPlan || isLoading || success}
                  className="min-w-[120px]"
                >
                  {isLoading ? 'Création...' : success ? 'Créée !' : 'Créer la companie'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Step 1: Company Info Form */}
      {currentStep === 1 && (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="p-8">
            <form onSubmit={(e) => { e.preventDefault(); if (validateForm()) setCurrentStep(2); }} className="space-y-6">
              {/* Logo Upload */}
              <div className="text-center">
                <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4 relative">
                  {isUploadingLogo ? (
                    <div className="flex flex-col items-center">
                      <div className="animate-pulse bg-gray-200 w-6 h-6 rounded-full" />
                      <span className="text-xs text-gray-500 mt-1">Upload...</span>
                    </div>
                  ) : formData.logo ? (
                    <img
                      src={formData.logo}
                      alt="Logo"
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <Building2 className="h-8 w-8 text-gray-400" />
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                  disabled={isUploadingLogo}
                />
                <label
                  htmlFor="logo-upload"
                  className={`cursor-pointer inline-block ${isUploadingLogo ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-label="Sélectionner un logo"
                >
                  <div className={`flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md transition-colors ${isUploadingLogo
                    ? 'opacity-50 cursor-not-allowed bg-gray-100'
                    : 'hover:bg-gray-50'
                    }`}>
                    <Upload className="h-4 w-4 mr-2" />
                    {isUploadingLogo ? 'Upload en cours...' : formData.logo ? 'Changer le logo' : 'Ajouter un logo'}
                  </div>
                </label>

                {formData.logo && (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, logo: '' }))}
                    className="mt-2 text-sm text-red-600 hover:text-red-800"
                    disabled={isUploadingLogo}
                  >
                    Supprimer le logo
                  </button>
                )}
              </div>

              {/* Company Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Nom de l'entreprise *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.name ? 'border-red-300' : 'border-gray-300'
                    }`}
                  placeholder="Nom de votre entreprise"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Décrivez votre entreprise en quelques mots"
                />
              </div>

              {/* Phone and Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Téléphone *
                  </label>
                  <div className="flex rounded-md shadow-sm">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                      +237
                    </span>
                    <Input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handlePhoneChange}
                      placeholder="678904568"
                      className={`flex-1 rounded-l-none ${errors.phone ? 'border-red-300' : ''
                        }`}
                      error={errors.phone}
                      helpText="9 chiffres après +237"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.email ? 'border-red-300' : 'border-gray-300'
                      }`}
                    placeholder="contact@entreprise.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                  )}
                </div>
              </div>

              {/* Report Mail */}
              <div>
                <label htmlFor="report_mail" className="block text-sm font-medium text-gray-700 mb-2">
                  Email pour les rapports de vente *
                </label>
                <input
                  type="email"
                  id="report_mail"
                  name="report_mail"
                  value={formData.report_mail}
                  onChange={handleInputChange}
                  onBlur={() => {
                    if (formData.report_mail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.report_mail)) {
                      setErrors(prev => ({ ...prev, report_mail: 'Format d\'email invalide' }));
                    }
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.report_mail ? 'border-red-300' : 'border-gray-300'
                    }`}
                  placeholder="rapports@entreprise.com"
                />
                {errors.report_mail && (
                  <p className="mt-1 text-sm text-red-600">{errors.report_mail}</p>
                )}
              </div>

              {/* Report Time */}
              <div>
                <label htmlFor="report_time" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('settingsPage.account.reportTime')}
                </label>
                <input
                  type="time"
                  id="report_time"
                  name="report_time"
                  value={formData.report_time}
                  onChange={handleInputChange}
                  className="block w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  required
                />
                <p className="mt-1 text-sm text-gray-500">
                  {t('settingsPage.account.reportTimeHelp')}
                </p>
              </div>

              {/* Location */}
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                  Localisation
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ville, Pays"
                />
              </div>

              {/* Navigation Buttons */}
              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                  disabled={isUploadingLogo}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={isUploadingLogo}
                >
                  {isUploadingLogo ? 'Upload en cours...' : 'Continuer'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
