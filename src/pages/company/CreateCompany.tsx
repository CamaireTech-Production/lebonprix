import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../services/firebase';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { Building2, Upload, ArrowLeft } from 'lucide-react';

interface CompanyFormData {
  name: string;
  description: string;
  phone: string;
  email: string;
  location: string;
  logo?: string;
}

export default function CreateCompany() {
  const [formData, setFormData] = useState<CompanyFormData>({
    name: '',
    description: '',
    phone: '',
    email: '',
    location: '',
    logo: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<CompanyFormData>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

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

  const validateForm = (): boolean => {
    const newErrors: Partial<CompanyFormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom de l\'entreprise est requis';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Le téléphone est requis';
    } else if (!/^[\d\s\-\+\(\)]+$/.test(formData.phone)) {
      newErrors.phone = 'Format de téléphone invalide';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'L\'email est requis';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Format d\'email invalide';
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
      // 1. Créer la company dans Firestore
      const companyData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        location: formData.location.trim(),
        logo: formData.logo || '',
        companyId: currentUser.uid, // L'utilisateur devient le owner
        role: 'Companie' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      console.log('Création de la company avec les données:', companyData);
      const companyRef = await addDoc(collection(db, 'companies'), companyData);
      const companyId = companyRef.id;

      console.log('✅ Company créée avec succès:', companyId);

      // 2. Ajouter le créateur comme employé avec role='owner'
      const { addUserToCompany } = await import('../../services/userCompanySyncService');
      
      await addUserToCompany(
        currentUser.uid,
        companyId,
        {
          name: formData.name.trim(),
          description: formData.description.trim(),
          logo: formData.logo
        },
        {
          firstname: (currentUser as any).firstname || currentUser.displayName?.split(' ')[0] || 'User',
          lastname: (currentUser as any).lastname || currentUser.displayName?.split(' ')[1] || '',
          email: currentUser.email || ''
        },
        'owner'
      );

      console.log('✅ Utilisateur ajouté comme owner');
      setSuccess(true);
      
      // 3. Redirection vers le dashboard de la company après un court délai
      setTimeout(() => {
        navigate(`/company/${companyId}/dashboard`);
      }, 1500);
      
    } catch (error) {
      console.error('Erreur lors de la création de la company:', error);
      setError('Erreur lors de la création de la company. Veuillez réessayer.');
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

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                  <p className="text-sm text-green-800">Company créée avec succès ! Redirection en cours...</p>
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

          <form onSubmit={handleSubmit} className="space-y-6" style={{ opacity: success ? 0.6 : 1 }}>
            {/* Logo Upload */}
            <div className="text-center">
              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4 relative">
                {isUploadingLogo ? (
                  <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
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
                  <div className={`flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md transition-colors ${
                    isUploadingLogo 
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
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  errors.name ? 'border-red-300' : 'border-gray-300'
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
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.phone ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="01 23 45 67 89"
                />
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                )}
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
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="contact@entreprise.com"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>
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

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                disabled={isLoading}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isLoading || success || isUploadingLogo}
                className="min-w-[120px]"
              >
                {isUploadingLogo ? 'Upload en cours...' : isLoading ? 'Création...' : success ? 'Créée !' : 'Créer la companie'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
