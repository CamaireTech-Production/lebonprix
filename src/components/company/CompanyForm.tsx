import React, { useState } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@services/core/firebase';
import { Card, Button, Input, PhoneInput } from '@components/common';
import { Building2, Upload, Info, X } from 'lucide-react';
import { showWarningToast } from '@utils/core/toast';
import { useTranslation } from 'react-i18next';
import { validatePhoneNumber, getCountryFromPhone } from '@utils/core/phoneUtils';
import { createCompany } from '@services/firestore/companies/companyService';
import { CURRENCIES, DEFAULT_CURRENCY } from '@constants/currencies';

interface CompanyFormData {
    name: string;
    description: string;
    phone: string;
    email: string;
    report_mail: string;
    report_time: string;
    location: string;
    logo?: string;
    currency: string;
}

interface CompanyFormProps {
    onSuccess: (companyId: string) => void;
    onCancel: () => void;
    isModal?: boolean;
}

export const CompanyForm: React.FC<CompanyFormProps> = ({ onSuccess, onCancel, isModal = false }) => {
    const { t } = useTranslation();
    const { currentUser } = useAuth();

    // Default to starter plan
    const [selectedPlan] = useState<'starter' | 'enterprise' | null>('starter');

    const [formData, setFormData] = useState<CompanyFormData>({
        name: '',
        description: '',
        phone: '',
        email: '',
        report_mail: '',
        report_time: '08:00',
        location: '',
        logo: '',
        currency: DEFAULT_CURRENCY.code
    });

    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<Partial<CompanyFormData>>({});
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        if (errors[name as keyof CompanyFormData]) {
            setErrors(prev => ({
                ...prev,
                [name]: undefined
            }));
        }
    };

    // PhoneInput returns the full value string directly
    const handlePhoneChange = (value: string) => {
        setFormData(prev => ({
            ...prev,
            phone: value
        }));

        if (errors.phone) {
            setErrors(prev => ({
                ...prev,
                phone: undefined
            }));
        }
    };

    const validateForm = (): boolean => {
        const newErrors: Partial<CompanyFormData> = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Le nom de l\'entreprise est requis'; // Using hardcoded fr string as fallback, normally t()
        }

        if (!formData.phone.trim()) {
            newErrors.phone = 'Le téléphone est requis';
        } else {
            const country = getCountryFromPhone(formData.phone);
            if (!validatePhoneNumber(formData.phone, country)) {
                newErrors.phone = `Numéro invalide pour ${country.name}`;
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
        setError('');

        try {
            let reportTime = formData.report_time || '08:00';
            const timePattern = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
            if (!timePattern.test(reportTime)) {
                reportTime = '08:00';
                showWarningToast(t('settingsPage.messages.reportTimeDefault'));
            }

            const company = await createCompany(currentUser.uid, {
                name: formData.name.trim(),
                description: formData.description.trim(),
                phone: formData.phone.trim(),
                email: formData.email.trim(),
                report_mail: formData.report_mail.trim(),
                report_time: reportTime,
                location: formData.location.trim(),
                logo: formData.logo || undefined,
                planType: selectedPlan || 'starter',
                currency: formData.currency
            });


            setSuccess(true);

            // Notify parent after delay or immediately?
            // Usually immediate callback is better, parent can handle UI feedback or delay
            // But CreateCompany.tsx had a 1.5s delay.
            // We'll wait 1.5s here to show success state, then call onSuccess

            setTimeout(() => {
                onSuccess(company.id);
            }, 1500);

        } catch (error: any) {
            console.error('Erreur lors de la création de la company:', error);

            if (error.message && error.message.includes('report_mail')) {
                showWarningToast('Email de rapport non sauvegardé (les autres modifications sont OK)');
                // Treat as partial success?
                // For now, let's just warn and maybe not redirect? Or redirect?
                // Original code didn't redirect on catch.
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

        if (!file.type.startsWith('image/')) {
            setError('Veuillez sélectionner un fichier image valide');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError('L\'image ne doit pas dépasser 5MB');
            return;
        }

        setIsUploadingLogo(true);
        setError('');

        try {
            const logoRef = ref(storage, `company-logos/${currentUser?.uid}/${Date.now()}-${file.name}`);
            const snapshot = await uploadBytes(logoRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

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

    const Content = (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Success Message */}
            {success && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <Info className="h-5 w-5 text-green-400" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-green-800">
                                Company créée avec succès ! Redirection en cours...
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
                            <X className="h-5 w-5 text-red-400" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    </div>
                </div>
            )}

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
                    aria-label={t('company.create.logo.change')}
                >
                    <div className={`flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md transition-colors ${isUploadingLogo
                        ? 'opacity-50 cursor-not-allowed bg-gray-100'
                        : 'hover:bg-gray-50'
                        }`}>
                        <Upload className="h-4 w-4 mr-2" />
                        {isUploadingLogo ? t('company.create.logo.uploading') : formData.logo ? t('company.create.logo.change') : t('company.create.logo.upload')}
                    </div>
                </label>

                {formData.logo && (
                    <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, logo: '' }))}
                        className="mt-2 text-sm text-red-600 hover:text-red-800"
                        disabled={isUploadingLogo}
                    >
                        {t('company.create.logo.remove')}
                    </button>
                )}
            </div>

            {/* Company Name */}
            <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('company.create.name')} *
                </label>
                <Input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={errors.name ? 'border-red-300' : ''}
                    placeholder={t('company.create.namePlaceholder')}
                    error={errors.name}
                />
            </div>

            {/* Description */}
            <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('company.create.description')}
                </label>
                <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={t('company.create.descriptionPlaceholder')}
                />
            </div>

            {/* Phone and Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <PhoneInput
                        label={t('company.create.phone')}
                        value={formData.phone}
                        onChange={handlePhoneChange}
                        error={errors.phone}
                        helpText={t('company.create.phoneHelp')}
                        required
                    />
                </div>

                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                        {t('company.create.email')} *
                    </label>
                    <Input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className={errors.email ? 'border-red-300' : ''}
                        placeholder="contact@entreprise.com"
                        error={errors.email}
                    />
                </div>
            </div>

            {/* Report Mail */}
            <div>
                <label htmlFor="report_mail" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('company.create.reportMail')} *
                </label>
                <Input
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
                    className={errors.report_mail ? 'border-red-300' : ''}
                    placeholder={t('company.create.reportMailPlaceholder')}
                    error={errors.report_mail}
                />
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

            {/* Currency */}
            <div>
                <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settingsPage.ordering.currency', 'Devise')}
                </label>
                <select
                    id="currency"
                    name="currency"
                    value={formData.currency}
                    onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                    className="block w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                    {CURRENCIES.map(currency => (
                        <option key={currency.code} value={currency.code}>
                            {currency.name} ({currency.symbol})
                        </option>
                    ))}
                </select>
                <p className="mt-1 text-sm text-gray-500">
                    {t('company.create.currencyHelp', 'La devise utilisée pour l\'affichage des prix.')}
                </p>
            </div>

            {/* Location */}
            <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('company.create.location')}
                </label>
                <Input
                    type="text"
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder={t('company.create.locationPlaceholder')}
                />
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                    type="button"
                    className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    onClick={onCancel}
                    disabled={isUploadingLogo}
                >
                    {t('company.create.buttons.cancel')}
                </button>
                <Button
                    type="submit"
                    disabled={isUploadingLogo || isLoading || success}
                >
                    {isLoading ? t('company.create.buttons.creating') : success ? t('company.create.buttons.success') : t('company.create.buttons.create')}
                </Button>
            </div>
        </form>
    );

    if (isModal) {
        return Content;
    }

    return (
        <Card className="p-8">
            {Content}
        </Card>
    );
};
