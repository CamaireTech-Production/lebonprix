import { useState, ChangeEvent, useEffect } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { Card, Button, Input, PriceInput } from '@components/common';
import ActivityList from '../../components/dashboard/ActivityList';
import { showSuccessToast, showErrorToast, showWarningToast } from '@utils/core/toast';
import { useTranslation } from 'react-i18next';
import { useSales, useExpenses, useAuditLogs, useProducts } from '@hooks/data/useFirestore';
import { getSellerSettings, updateSellerSettings } from '@services/firestore/firestore';
import { getCheckoutSettingsWithDefaults, saveCheckoutSettings, resetCheckoutSettings, subscribeToCheckoutSettings } from '@services/utilities/checkoutSettingsService';
import { saveCinetPayConfig, subscribeToCinetPayConfig, validateCinetPayCredentials, initializeCinetPayConfig } from '@services/payment/cinetpayService';
import { AuditLogger } from '@utils/core/auditLogger';
import type { SellerSettings, PaymentMethod } from '../../types/order';
import type { CheckoutSettings, CheckoutSettingsUpdate } from '../../types/checkoutSettings';
import type { CinetPayConfig, CinetPayConfigUpdate } from '../../types/cinetpay';
import PaymentMethodModal from '../../components/settings/PaymentMethodModal';
import i18n from '../../i18n/config';
import { combineActivities } from '@utils/business/activityUtils';
import { Plus, Copy, Check, ExternalLink, CreditCard, Truck, ShoppingBag, Save, RotateCcw, Eye, Trash2 } from 'lucide-react';

function normalizeWebsite(raw: string): string | undefined {
  const url = (raw || '').trim();
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url.replace(/^\/+/, '')}`;
}

const Settings = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('colors');
  const { company, updateCompany, updateUserPassword, user, isOwner, effectiveRole } = useAuth();
  
  // Checkout settings state
  const [checkoutSettings, setCheckoutSettings] = useState<CheckoutSettings | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutSaving, setCheckoutSaving] = useState(false);
  
  // CinetPay settings state
  const [cinetpayConfig, setCinetpayConfig] = useState<CinetPayConfig | null>(null);
  const [cinetpayLoading, setCinetpayLoading] = useState(true);
  const [cinetpaySaving, setCinetpaySaving] = useState(false);
  const [cinetpayTesting, setCinetpayTesting] = useState(false);
  
  // Only fetch data if user is authenticated
  const { sales } = useSales();
  const { expenses } = useExpenses();
  const { auditLogs } = useAuditLogs();
  const { products } = useProducts();
  
  // Combine and sort recent activities using the new activity system
  const activities = user ? combineActivities(sales, expenses, auditLogs, t) : [];

  // Form state for company settings
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    phone: '',
    location: '',
    email: '',
    report_mail: '',
    report_time: '',
    logo: '',
    website: '',
    // Catalogue colors
    cataloguePrimaryColor: '#183524',
    catalogueSecondaryColor: '#e2b069',
    catalogueTertiaryColor: '#2a4a3a',
    // Dashboard colors
    dashboardPrimaryColor: '#183524',
    dashboardSecondaryColor: '#e2b069',
    dashboardTertiaryColor: '#2a4a3a',
    dashboardHeaderTextColor: '#ffffff',
    // Legacy colors (for backward compatibility)
    primaryColor: '#183524',
    secondaryColor: '#e2b069',
    tertiaryColor: '#2a4a3a',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Update form data when company data becomes available
  useEffect(() => {
    if (company) {
      setFormData(prev => ({
        ...prev,
        name: company.name || '',
        description: company.description || '',
        phone: company.phone?.replace('+237', '') || '',
        location: company.location || '',
        email: company.email || '',
        report_mail: company.report_mail || '',
        report_time: company.report_time?.toString() || '8',
        logo: company.logo || '',
        website: company.website || '',
        // Catalogue colors
        cataloguePrimaryColor: company.catalogueColors?.primary || company.primaryColor || '#183524',
        catalogueSecondaryColor: company.catalogueColors?.secondary || company.secondaryColor || '#e2b069',
        catalogueTertiaryColor: company.catalogueColors?.tertiary || company.tertiaryColor || '#2a4a3a',
        // Dashboard colors
        dashboardPrimaryColor: company.dashboardColors?.primary || company.primaryColor || '#183524',
        dashboardSecondaryColor: company.dashboardColors?.secondary || company.secondaryColor || '#e2b069',
        dashboardTertiaryColor: company.dashboardColors?.tertiary || company.tertiaryColor || '#2a4a3a',
        dashboardHeaderTextColor: company.dashboardColors?.headerText || '#ffffff',
        // Legacy colors (for backward compatibility)
        primaryColor: company.primaryColor || '#183524',
        secondaryColor: company.secondaryColor || '#e2b069',
        tertiaryColor: company.tertiaryColor || '#2a4a3a',
      }));
    }
  }, [company]);

  // Real-time checkout settings subscription
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeToCheckoutSettings(user.uid, (settings) => {
      if (settings) {
        setCheckoutSettings(settings);
        setCheckoutLoading(false);
      } else {
        // If no settings exist, get defaults
        getCheckoutSettingsWithDefaults(user.uid).then(settings => {
          setCheckoutSettings(settings);
          setCheckoutLoading(false);
        });
      }
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Real-time CinetPay settings subscription
  useEffect(() => {
    if (!company?.id) return;

    setCinetpayLoading(true);

    const unsubscribe = subscribeToCinetPayConfig(company.id, (config) => {
      if (config) {
        setCinetpayConfig(config);
        setCinetpayLoading(false);
      } else {
        // If no config exists, initialize with defaults
        initializeCinetPayConfig(company.id, user?.uid).then(config => {
          setCinetpayConfig(config);
          setCinetpayLoading(false);
        }).catch(error => {
          console.error('Error initializing CinetPay config:', error);
          setCinetpayLoading(false);
        });
      }
    });

    return () => unsubscribe();
  }, [company?.id, user?.uid]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Ordering settings state
  const [orderingSettings, setOrderingSettings] = useState<SellerSettings | null>(null);
  const [orderingLoading, setOrderingLoading] = useState(false);
  const [orderingSaving, setOrderingSaving] = useState(false);
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  
  // Catalogue links state
  const [copiedLinks, setCopiedLinks] = useState<Set<string>>(new Set());

  // Copy to clipboard function
  const copyToClipboard = async (text: string, linkId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLinks(prev => new Set(prev).add(linkId));
      showSuccessToast('Link copied to clipboard!');
      
      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopiedLinks(prev => {
          const newSet = new Set(prev);
          newSet.delete(linkId);
          return newSet;
        });
      }, 2000);
    } catch {
      showErrorToast('Failed to copy link');
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      if (!company?.id) return;
      setOrderingLoading(true);
      try {
        const settings = await getSellerSettings(company.id);
        setOrderingSettings(settings || {
          whatsappNumber: company.phone || '+237',
          businessName: company.name || '',
          paymentMethods: {
            mobileMoney: true,
            bankTransfer: false,
            cashOnDelivery: true,
            customMethods: []
          },
          deliveryFee: 0,
          currency: 'XAF'
        });
      } catch (e) {
        console.error('Failed to load seller settings', e);
      } finally {
        setOrderingLoading(false);
      }
    };
    loadSettings();
  }, [company?.id, company?.name, company?.phone]);

  // Payment method management functions
  const handleAddPaymentMethod = (paymentMethod: PaymentMethod) => {
    if (!orderingSettings) return;
    
    const updatedSettings = {
      ...orderingSettings,
      paymentMethods: {
        ...orderingSettings.paymentMethods,
        customMethods: [...(orderingSettings.paymentMethods.customMethods || []), paymentMethod]
      }
    };
    setOrderingSettings(updatedSettings);
  };

  const handleUpdatePaymentMethod = (id: string, updatedMethod: Partial<PaymentMethod>) => {
    if (!orderingSettings) return;
    
    const updatedSettings = {
      ...orderingSettings,
      paymentMethods: {
        ...orderingSettings.paymentMethods,
        customMethods: (orderingSettings.paymentMethods.customMethods || []).map(method =>
          method.id === id ? { ...method, ...updatedMethod } : method
        )
      }
    };
    setOrderingSettings(updatedSettings);
  };

  const handleDeletePaymentMethod = (id: string) => {
    if (!orderingSettings) return;
    
    const updatedSettings = {
      ...orderingSettings,
      paymentMethods: {
        ...orderingSettings.paymentMethods,
        customMethods: (orderingSettings.paymentMethods.customMethods || []).filter(method => method.id !== id)
      }
    };
    setOrderingSettings(updatedSettings);
  };
  
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear password error when user starts typing
    if (name.startsWith('password') || name === 'currentPassword') {
      setPasswordError('');
    }
  };
  
  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    if (value.length <= 9) { // Only allow 9 digits after +237
      setFormData(prev => ({ ...prev, phone: value }));
    }
  };
  
  
  
  const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, logo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleWebsiteChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value || '';
    const domain = raw.replace(/^\s+/, '').replace(/^https?:\/\//i, '').replace(/^\/+/, '');
    setFormData(prev => ({
      ...prev,
      website: domain ? `https://${domain}` : ''
    }));
  };
  
  const validatePasswordChange = () => {
    if (!formData.currentPassword && (formData.newPassword || formData.confirmPassword)) {
      setPasswordError(t('settings.messages.currentPasswordRequired'));
      return false;
    }
    
    if (formData.newPassword !== formData.confirmPassword) {
      setPasswordError(t('settings.messages.passwordsDoNotMatch'));
      return false;
    }
    
    if (formData.newPassword && formData.newPassword.length < 6) {
      setPasswordError(t('settings.messages.passwordTooShort'));
      return false;
    }
    
    return true;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePasswordChange()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const normalizedWebsite = normalizeWebsite(formData.website);
      if (normalizedWebsite) {
        try {
          new URL(normalizedWebsite);
        } catch {
          showErrorToast('URL de site web invalide (doit être http/https)');
          setIsLoading(false);
          return;
        }
      }
      
      // Handle report_time: default to 8 if empty, show warning
      let reportTime = 8;
      if (formData.report_time && formData.report_time.trim() !== '') {
        const parsedTime = parseInt(formData.report_time);
        if (!isNaN(parsedTime) && parsedTime >= 0 && parsedTime <= 23) {
          reportTime = parsedTime;
        }
      } else {
        showWarningToast(t('settings.messages.reportTimeDefault'));
      }
      
      // Update company information
      const companyData = {
        name: formData.name,
        description: formData.description || undefined,
        phone: `+237${formData.phone}`,
        location: formData.location || undefined,
        logo: formData.logo || undefined,
        email: formData.email,
        report_mail: formData.report_mail || undefined,
        report_time: reportTime,
        website: normalizedWebsite,
        // New color schemes
        catalogueColors: {
          primary: formData.cataloguePrimaryColor,
          secondary: formData.catalogueSecondaryColor,
          tertiary: formData.catalogueTertiaryColor
        },
        dashboardColors: {
          primary: formData.dashboardPrimaryColor,
          secondary: formData.dashboardSecondaryColor,
          tertiary: formData.dashboardTertiaryColor,
          headerText: formData.dashboardHeaderTextColor
        },
        // Legacy colors (for backward compatibility)
        primaryColor: formData.primaryColor,
        secondaryColor: formData.secondaryColor,
        tertiaryColor: formData.tertiaryColor
      };

      try {
        await updateCompany(companyData);
      } catch (error: any) {
        // Si l'erreur concerne report_mail, continuer avec les autres champs
        if (error.message && error.message.includes('report_mail')) {
          showWarningToast('Email de rapport non sauvegardé (les autres modifications sont OK)');
          // Retirer report_mail et réessayer
          const { report_mail, ...companyDataWithoutReportMail } = companyData;
          await updateCompany(companyDataWithoutReportMail);
        } else {
          throw error;
        }
      }

      // Update password if provided
      if (formData.currentPassword && formData.newPassword) {
        await updateUserPassword(formData.currentPassword, formData.newPassword);
      }

      showSuccessToast(t('settings.messages.settingsUpdated'));
      
      // Reset password fields after successful update
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
    } catch (error: unknown) {
      console.error('Error updating settings:', error);
      showErrorToast((error as Error).message || t('settings.messages.updateFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (company) {
      setFormData(prev => ({
        ...prev,
        name: company.name || '',
        description: company.description || '',
        phone: company.phone?.replace('+237', '') || '',
        location: company.location || '',
        email: company.email || '',
        report_time: company.report_time?.toString() || '8',
        logo: company.logo || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
    }
    setPasswordError('');
  };

  // Language change handler
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
  };

  // Checkout settings handlers
  const handleCheckoutSettingsUpdate = (updates: CheckoutSettingsUpdate) => {
    if (!checkoutSettings) return;
    setCheckoutSettings(prev => {
      if (!prev) return null;
      const merged = { ...prev, ...updates };
      // Ensure enabledPaymentMethods is properly merged
      if (updates.enabledPaymentMethods) {
        merged.enabledPaymentMethods = {
          ...prev.enabledPaymentMethods,
          ...updates.enabledPaymentMethods
        };
      }
      return merged as CheckoutSettings;
    });
  };

  const handleSaveCheckoutSettings = async () => {
    if (!user?.uid || !checkoutSettings) return;
    
    try {
      setCheckoutSaving(true);
      await saveCheckoutSettings(user.uid, checkoutSettings);
      showSuccessToast('Checkout settings saved successfully!');
    } catch (error) {
      console.error('Error saving checkout settings:', error);
      showErrorToast('Failed to save checkout settings');
    } finally {
      setCheckoutSaving(false);
    }
  };

  const handleResetCheckoutSettings = async () => {
    if (!user?.uid) return;
    
    if (window.confirm('Are you sure you want to reset all checkout settings to default?')) {
      try {
        setCheckoutSaving(true);
        await resetCheckoutSettings(user.uid);
        const settings = await getCheckoutSettingsWithDefaults(user.uid);
        setCheckoutSettings(settings);
        showSuccessToast('Checkout settings reset to default!');
      } catch (error) {
        console.error('Error resetting checkout settings:', error);
        showErrorToast('Failed to reset checkout settings');
      } finally {
        setCheckoutSaving(false);
      }
    }
  };

  // CinetPay settings handlers
  const handleCinetpayConfigUpdate = (updates: CinetPayConfigUpdate) => {
    if (!cinetpayConfig) return;
    setCinetpayConfig(prev => {
      if (!prev) return null;
      const merged = { ...prev, ...updates };
      // Ensure enabledChannels is properly merged with all required boolean values
      if (updates.enabledChannels) {
        merged.enabledChannels = {
          mobileMoney: updates.enabledChannels.mobileMoney ?? prev.enabledChannels.mobileMoney,
          creditCard: updates.enabledChannels.creditCard ?? prev.enabledChannels.creditCard,
          wallet: updates.enabledChannels.wallet ?? prev.enabledChannels.wallet
        };
      }
      return merged as CinetPayConfig;
    });
  };

  const handleSaveCinetpayConfig = async () => {
    if (!company?.id || !cinetpayConfig) return;
    
    try {
      setCinetpaySaving(true);
      await saveCinetPayConfig(company.id, cinetpayConfig, user?.uid);
      
      // Log configuration change
      await AuditLogger.logConfigChange(user?.uid || company.id, 'cinetpay_config_saved', {
        configType: 'cinetpay',
        changes: {
          isActive: cinetpayConfig.isActive,
          testMode: cinetpayConfig.testMode,
          enabledChannels: cinetpayConfig.enabledChannels
        }
      });
      
      showSuccessToast('Payment integration settings saved');
    } catch (error) {
      console.error('Error saving CinetPay config:', error);
      showErrorToast('Failed to save payment integration settings');
    } finally {
      setCinetpaySaving(false);
    }
  };

  const handleTestCinetpayConnection = async () => {
    if (!cinetpayConfig?.siteId || !cinetpayConfig?.apiKey) {
      showErrorToast('Please enter Site ID and API Key first');
      return;
    }
    
    try {
      setCinetpayTesting(true);
      const result = await validateCinetPayCredentials(cinetpayConfig.siteId, cinetpayConfig.apiKey);
      
      if (result.isValid) {
        showSuccessToast('Connection successful! Credentials are valid.');
      } else {
        showErrorToast(`Connection failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Error testing CinetPay connection:', error);
      showErrorToast('Failed to test connection');
    } finally {
      setCinetpayTesting(false);
    }
  };

  const handleClearCinetpayCredentials = async () => {
    if (!company?.id || !cinetpayConfig) return;

    // Show confirmation dialog
    const confirmed = window.confirm(
      'Are you sure you want to clear your CinetPay credentials?\n\n' +
      'This will remove your Site ID and API Key. You will need to re-enter them to use online payments.\n\n' +
      'This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      setCinetpaySaving(true);
      
      // Clear credentials by setting them to empty strings
      await saveCinetPayConfig(company.id, {
        siteId: '',
        apiKey: '',
        isActive: false, // Also disable the integration
        testMode: cinetpayConfig.testMode,
        enabledChannels: cinetpayConfig.enabledChannels
      }, user?.uid);

      // Log the action
      await AuditLogger.logConfigChange(user?.uid || company.id, 'cinetpay_credentials_cleared', {
        configType: 'cinetpay',
        changes: {
          credentialsCleared: true,
          integrationDisabled: true
        }
      });

      showSuccessToast('CinetPay credentials cleared successfully');
    } catch (error) {
      console.error('Error clearing CinetPay credentials:', error);
      showErrorToast('Failed to clear credentials');
    } finally {
      setCinetpaySaving(false);
    }
  };

  // Show loading if company data is not yet available
  if (!company && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="pb-16 md:pb-0">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{t('settings.title')}</h1>
        <p className="text-gray-600">{t('settings.subtitle')}</p>
      </div>
      
      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('colors')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'colors'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
{t('settings.tabs.colors')}
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'account'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            {t('settings.tabs.account')}
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'activity'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            {t('settings.tabs.activity')}
          </button>
          <button
            onClick={() => setActiveTab('ordering')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'ordering'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
{t('settings.tabs.ordering')}
          </button>
          <button
            onClick={() => setActiveTab('catalogue')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'catalogue'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
{t('settings.tabs.catalogue')}
          </button>
          <button
            onClick={() => setActiveTab('checkout')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'checkout'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            Checkout Settings
          </button>
          <button
            onClick={() => setActiveTab('payment')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'payment'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            Payment Integration
          </button>
        </nav>
      </div>
      
      {/* Colors Tab */}
      {activeTab === 'colors' && (
        <form onSubmit={handleSubmit}>
          <Card>
            <div className="max-w-4xl mx-auto">
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">🎨 Color Customization</h2>
                  <p className="text-gray-600">
                    Customize colors for different parts of your platform. You can have different color schemes for your catalogue and dashboard.
                  </p>
                </div>
                
                {/* Catalogue Colors */}
                <div className="bg-blue-50 p-6 rounded-lg">
                  <div className="flex items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Catalogue Colors</h3>
                    <span className="ml-3 text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">Public</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-6">
                    Colors used on your public catalogue page that customers see.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Catalogue Primary Color */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Primary Color
                      </label>
                      <div className="flex items-center space-x-3">
                        <input
                          type="color"
                          name="cataloguePrimaryColor"
                          value={formData.cataloguePrimaryColor}
                          onChange={handleInputChange}
                          className="h-12 w-16 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          name="cataloguePrimaryColor"
                          value={formData.cataloguePrimaryColor}
                          onChange={handleInputChange}
                          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
                          placeholder="#183524"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Headers, buttons, highlights</p>
                    </div>
                    
                    {/* Catalogue Secondary Color */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Secondary Color
                      </label>
                      <div className="flex items-center space-x-3">
                        <input
                          type="color"
                          name="catalogueSecondaryColor"
                          value={formData.catalogueSecondaryColor}
                          onChange={handleInputChange}
                          className="h-12 w-16 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          name="catalogueSecondaryColor"
                          value={formData.catalogueSecondaryColor}
                          onChange={handleInputChange}
                          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
                          placeholder="#e2b069"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Prices, accents, add to cart</p>
                    </div>
                    
                    {/* Catalogue Tertiary Color */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tertiary Color
                      </label>
                      <div className="flex items-center space-x-3">
                        <input
                          type="color"
                          name="catalogueTertiaryColor"
                          value={formData.catalogueTertiaryColor}
                          onChange={handleInputChange}
                          className="h-12 w-16 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          name="catalogueTertiaryColor"
                          value={formData.catalogueTertiaryColor}
                          onChange={handleInputChange}
                          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
                          placeholder="#2a4a3a"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Gradients, hover effects</p>
                    </div>
                  </div>
                </div>

                {/* Dashboard Colors */}
                <div className="bg-green-50 p-6 rounded-lg">
                  <div className="flex items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Dashboard Colors</h3>
                    <span className="ml-3 text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">Admin</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-6">
                    Colors used on your admin dashboard for internal management.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Dashboard Primary Color */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Primary Color
                      </label>
                      <div className="flex items-center space-x-3">
                        <input
                          type="color"
                          name="dashboardPrimaryColor"
                          value={formData.dashboardPrimaryColor}
                          onChange={handleInputChange}
                          className="h-12 w-16 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          name="dashboardPrimaryColor"
                          value={formData.dashboardPrimaryColor}
                          onChange={handleInputChange}
                          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
                          placeholder="#183524"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Headers, values, primary buttons</p>
                    </div>
                    
                    {/* Dashboard Secondary Color */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Secondary Color
                      </label>
                      <div className="flex items-center space-x-3">
                        <input
                          type="color"
                          name="dashboardSecondaryColor"
                          value={formData.dashboardSecondaryColor}
                          onChange={handleInputChange}
                          className="h-12 w-16 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          name="dashboardSecondaryColor"
                          value={formData.dashboardSecondaryColor}
                          onChange={handleInputChange}
                          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
                          placeholder="#e2b069"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Trends, secondary buttons</p>
                    </div>
                    
                    {/* Dashboard Tertiary Color */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tertiary Color
                      </label>
                      <div className="flex items-center space-x-3">
                        <input
                          type="color"
                          name="dashboardTertiaryColor"
                          value={formData.dashboardTertiaryColor}
                          onChange={handleInputChange}
                          className="h-12 w-16 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          name="dashboardTertiaryColor"
                          value={formData.dashboardTertiaryColor}
                          onChange={handleInputChange}
                          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
                          placeholder="#2a4a3a"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Gradients, expenses, delivery</p>
                    </div>
                    
                    {/* Dashboard Header Text Color */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Header Text Color
                      </label>
                      <div className="flex items-center space-x-3">
                        <input
                          type="color"
                          name="dashboardHeaderTextColor"
                          value={formData.dashboardHeaderTextColor}
                          onChange={handleInputChange}
                          className="h-12 w-16 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          name="dashboardHeaderTextColor"
                          value={formData.dashboardHeaderTextColor}
                          onChange={handleInputChange}
                          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
                          placeholder="#ffffff"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Text color for dashboard header</p>
                    </div>
                  </div>
                </div>
                
                {/* Firebase Integration Info */}
                <div className="bg-blue-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-blue-800 mb-4">{t('settings.firebaseIntegration.title')}</h3>
                  <p className="text-sm text-blue-700 mb-4">
                    {t('settings.firebaseIntegration.description')}
                  </p>
                  <div className="bg-white p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">{t('settings.firebaseIntegration.companyId')}</p>
                        <code className="text-sm bg-gray-100 px-3 py-2 rounded font-mono text-gray-800">
                          {user?.uid || 'Loading...'}
                        </code>
                      </div>
                      <button 
                        onClick={() => {
                          if (user?.uid) {
                            navigator.clipboard.writeText(user.uid);
                            showSuccessToast(t('settings.firebaseIntegration.copySuccess'));
                          }
                        }}
                        className="ml-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                        disabled={!user?.uid}
                      >
{t('settings.firebaseIntegration.copyId')}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {t('settings.firebaseIntegration.helpText')}
                    </p>
                  </div>
                </div>

                {/* Color Preview */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Live Preview</h3>
                  
                  {/* Catalogue Preview */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-600 mb-3">Catalogue Preview</h4>
                    <div className="flex items-center space-x-4">
                      <div 
                        className="px-4 py-3 rounded-lg text-white text-sm font-medium shadow-sm"
                        style={{ backgroundColor: formData.cataloguePrimaryColor }}
                      >
                        Header
                      </div>
                      <div 
                        className="px-4 py-3 rounded-lg text-white text-sm font-medium shadow-sm"
                        style={{ backgroundColor: formData.catalogueSecondaryColor }}
                      >
                        Price
                      </div>
                      <div 
                        className="px-4 py-3 rounded-lg text-white text-sm font-medium shadow-sm"
                        style={{ backgroundColor: formData.catalogueTertiaryColor }}
                      >
                        Button
                      </div>
                    </div>
                  </div>

                  {/* Dashboard Preview */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-600 mb-3">Dashboard Preview</h4>
                    <div className="flex items-center space-x-4">
                      <div 
                        className="px-4 py-3 rounded-lg text-white text-sm font-medium shadow-sm"
                        style={{ backgroundColor: formData.dashboardPrimaryColor }}
                      >
                        Value
                      </div>
                      <div 
                        className="px-4 py-3 rounded-lg text-white text-sm font-medium shadow-sm"
                        style={{ backgroundColor: formData.dashboardSecondaryColor }}
                      >
                        Trend
                      </div>
                      <div 
                        className="px-4 py-3 rounded-lg text-white text-sm font-medium shadow-sm"
                        style={{ backgroundColor: formData.dashboardTertiaryColor }}
                      >
                        Icon
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setActiveTab('account')}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    isLoading={isLoading}
                    disabled={isLoading}
                  >
                    Save Colors
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </form>
      )}
      
      {/* Account Settings Tab */}
      {activeTab === 'account' && (
        <form onSubmit={handleSubmit}>
          <Card>
            <div className="max-w-xl mx-auto">
              <div className="space-y-6">
                {/* Company Logo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('settings.account.companyLogo')}
                  </label>
                  <div className="mt-1 flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {formData.logo ? (
                        <img
                          src={formData.logo}
                          alt="Company logo"
                          className="h-16 w-16 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                          <span className="text-gray-400">{t('settings.account.noLogo')}</span>
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-gray-300 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                    />
                  </div>
                </div>

                {/* Company Information */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">{t('settings.account.companyInformation')}</h3>
                  <div className="space-y-4">
                    <Input
                      label={t('settings.account.companyName')}
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                    />
                    <Input
                      label={t('settings.account.description')}
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      helpText={t('settings.account.descriptionHelp')}
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('settings.account.phoneNumber')}
                      </label>
                      <div className="flex rounded-md shadow-sm">
                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                          +237
                        </span>
                        <Input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handlePhoneChange}
                          placeholder="678904568"
                          className="flex-1 rounded-l-none"
                          required
                          helpText={t('settings.account.phoneHelp')}
                        />
                      </div>
                    </div>
                    <Input
                      label={t('settings.account.location')}
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      helpText={t('settings.account.locationHelp')}
                    />
                    <Input
                      label={t('settings.account.emailAddress')}
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                    />
                    {(isOwner || effectiveRole !== 'vendeur') && (
                      <Input
                        label={t('settings.account.reportMail')}
                        name="report_mail"
                        type="email"
                        value={formData.report_mail}
                        onChange={handleInputChange}
                        onBlur={() => {
                          if (formData.report_mail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.report_mail)) {
                            // Validation silencieuse
                          }
                        }}
                        placeholder="rapports@entreprise.com"
                        helpText={t('settings.account.reportMailHelp')}
                      />
                    )}
                    {(isOwner || effectiveRole !== 'vendeur') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('settings.account.reportTime')}
                        </label>
                        <div className="flex rounded-md shadow-sm">
                          <input
                            type="number"
                            name="report_time"
                            min="0"
                            max="23"
                            value={formData.report_time}
                            onChange={handleInputChange}
                            className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                            placeholder="8"
                          />
                          <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                            h
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                          {t('settings.account.reportTimeHelp')}
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Site web</label>
                      <div className="flex rounded-md shadow-sm">
                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                          https://
                        </span>
                        <input
                          type="text"
                          name="website"
                          value={(formData.website || '').replace(/^https?:\/\//i, '')}
                          onChange={handleWebsiteChange}
                          placeholder="mon-entreprise.com"
                          className="flex-1 rounded-l-none border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <p className="mt-1 text-sm text-gray-500">URL publique de votre entreprise (facultatif)</p>
                    </div>
                  </div>
                </div>
                
                {/* Password Change */}
                <div className="pt-5 border-t border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">{t('settings.account.changePassword')}</h3>
                  {passwordError && (
                    <div className="mb-4 bg-red-50 text-red-800 p-3 rounded-md text-sm">
                      {passwordError}
                    </div>
                  )}
                  <div className="space-y-4">
                    <Input
                      label={t('settings.account.currentPassword')}
                      name="currentPassword"
                      type="password"
                      value={formData.currentPassword}
                      onChange={handleInputChange}
                      helpText={t('settings.account.currentPasswordHelp')}
                    />
                    <Input
                      label={t('settings.account.newPassword')}
                      name="newPassword"
                      type="password"
                      value={formData.newPassword}
                      onChange={handleInputChange}
                      helpText={t('settings.account.newPasswordHelp')}
                    />
                    <Input
                      label={t('settings.account.confirmNewPassword')}
                      name="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      helpText={t('settings.account.confirmNewPasswordHelp')}
                    />
                  </div>
                </div>
                
                {/* Preferences */}
                <div className="pt-5 border-t border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">{t('settings.account.preferences')}</h3>
                  <div className="space-y-4">
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="email-notifications"
                          name="email-notifications"
                          type="checkbox"
                          className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                          defaultChecked
                        />
                      </div>
                      <div className="ml-3">
                        <label htmlFor="email-notifications" className="text-sm font-medium text-gray-700">
                          {t('settings.account.emailNotifications')}
                        </label>
                        <p className="text-sm text-gray-500">
                          {t('settings.account.emailNotificationsHelp')}
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('settings.account.language')}
                      </label>
                      <select
                        className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={i18n.language}
                        onChange={handleLanguageChange}
                      >
                        <option value="en">{t('languages.en')}</option>
                        <option value="fr">{t('languages.fr')}</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                
                {/* Form Actions */}
                <div className="flex justify-end space-x-3">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isLoading}
                  >
                    {t('settings.account.cancel')}
                  </Button>
                  <Button 
                    type="submit" 
                    isLoading={isLoading}
                    disabled={isLoading}
                  >
                    {t('settings.account.saveChanges')}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </form>
      )}
      
      {/* Ordering Settings Tab */}
      {activeTab === 'ordering' && (
        <Card>
          <div className="max-w-xl mx-auto">
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Ordering and Delivery</h3>
              {/* Business Info */}
              <div className="space-y-4">
                <Input
                  label="Business Name"
                  name="businessName"
                  value={orderingSettings?.businessName || ''}
                  onChange={(e) => setOrderingSettings(prev => prev ? { ...prev, businessName: e.target.value } : prev)}
                />
                <Input
                  label="WhatsApp Number"
                  name="whatsappNumber"
                  value={orderingSettings?.whatsappNumber || ''}
                  onChange={(e) => setOrderingSettings(prev => prev ? { ...prev, whatsappNumber: e.target.value } : prev)}
                  helpText="Include country code, e.g. +237..."
                />
              </div>

              {/* Payment Methods */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-800">Payment Methods</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsPaymentMethodModalOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Payment Method
                  </Button>
                </div>
                
                {/* Standard Payment Methods */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      id="pm-mm"
                      type="checkbox"
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                      checked={!!orderingSettings?.paymentMethods?.mobileMoney}
                      onChange={(e) => setOrderingSettings(prev => prev ? { ...prev, paymentMethods: { ...prev.paymentMethods, mobileMoney: e.target.checked } } : prev)}
                    />
                    <label htmlFor="pm-mm" className="text-sm text-gray-700">Mobile Money</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      id="pm-bank"
                      type="checkbox"
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                      checked={!!orderingSettings?.paymentMethods?.bankTransfer}
                      onChange={(e) => setOrderingSettings(prev => prev ? { ...prev, paymentMethods: { ...prev.paymentMethods, bankTransfer: e.target.checked } } : prev)}
                    />
                    <label htmlFor="pm-bank" className="text-sm text-gray-700">Bank Transfer</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      id="pm-cod"
                      type="checkbox"
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                      checked={!!orderingSettings?.paymentMethods?.cashOnDelivery}
                      onChange={(e) => setOrderingSettings(prev => prev ? { ...prev, paymentMethods: { ...prev.paymentMethods, cashOnDelivery: e.target.checked } } : prev)}
                    />
                    <label htmlFor="pm-cod" className="text-sm text-gray-700">Cash on Delivery</label>
                  </div>
                </div>

                {/* Custom Payment Methods */}
                {orderingSettings?.paymentMethods?.customMethods && orderingSettings.paymentMethods.customMethods.length > 0 && (
                  <div className="mt-4">
                    <h5 className="text-xs font-medium text-gray-600 mb-2">Custom Payment Methods</h5>
                    <div className="space-y-2">
                      {orderingSettings.paymentMethods.customMethods.map((method) => (
                        <div key={method.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              method.isActive 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {method.isActive ? 'Active' : 'Inactive'}
                            </span>
                            <span className="text-sm font-medium text-gray-900">{method.name}</span>
                            <span className="text-xs text-gray-500">
                              {method.type === 'phone' && '📞'}
                              {method.type === 'ussd' && '🔢'}
                              {method.type === 'link' && '🔗'}
                              {' '}{method.value}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Delivery Fee and Currency */}
              <div className="grid grid-cols-2 gap-4">
                <PriceInput
                  label="Delivery Fee"
                  name="deliveryFee"
                  value={orderingSettings?.deliveryFee ?? 0}
                  onChange={(e) => setOrderingSettings(prev => prev ? { ...prev, deliveryFee: Number(e.target.value) } : prev)}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select
                    className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                    value={orderingSettings?.currency || 'XAF'}
                    onChange={(e) => setOrderingSettings(prev => prev ? { ...prev, currency: e.target.value } : prev)}
                  >
                    <option value="XAF">XAF</option>
                    <option value="XOF">XOF</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  type="button"
                  disabled={orderingSaving || orderingLoading}
                  onClick={() => {
                    // Reset from server/company defaults
                    if (!company) return;
                    setOrderingSettings({
                      whatsappNumber: company.phone || '+237',
                      businessName: company.name || '',
                      paymentMethods: {
                        mobileMoney: true,
                        bankTransfer: false,
                        cashOnDelivery: true,
                        customMethods: []
                      },
                      deliveryFee: 0,
                      currency: 'XAF'
                    });
                  }}
                >
                  Reset
                </Button>
                <Button
                  type="button"
                  isLoading={orderingSaving}
                  disabled={orderingSaving || orderingLoading || !orderingSettings}
                  onClick={async () => {
                    if (!company?.id || !orderingSettings) return;
                    try {
                      setOrderingSaving(true);
                      await updateSellerSettings(company.id, orderingSettings);
                      showSuccessToast('Ordering settings updated');
                    } catch (e: unknown) {
                      console.error(e);
                      showErrorToast((e as Error).message || 'Failed to update settings');
                    } finally {
                      setOrderingSaving(false);
                    }
                  }}
                >
{t('settings.ordering.saveSettings')}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
      {/* Activity Logs Tab */}
      {activeTab === 'activity' && (
        <ActivityList activities={activities} />
      )}

      {/* Catalogue Links Tab */}
      {activeTab === 'catalogue' && (
        <Card>
          <div className="max-w-4xl mx-auto">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">{t('settings.catalogue.title')}</h3>
                <p className="text-sm text-gray-600">
                  Generate shareable links for your product categories to use on your external landing pages.
                </p>
              </div>

              {/* Base Catalogue URL */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Your Catalogue URL</h4>
                <div className="flex items-center space-x-2">
                  <code className="flex-1 bg-white p-2 rounded border text-sm font-mono">
                    {typeof window !== 'undefined' 
                      ? `${window.location.origin}/catalogue/${company?.name?.toLowerCase().replace(/\s+/g, '-')}/${user?.uid}`
                      : 'Loading...'
                    }
                  </code>
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(
                      `${window.location.origin}/catalogue/${company?.name?.toLowerCase().replace(/\s+/g, '-')}/${user?.uid}`,
                      'base-catalogue'
                    )}
                  >
                    {copiedLinks.has('base-catalogue') ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Category Links */}
              <div>
                <h4 className="font-medium text-gray-900 mb-4">Category-Specific Links</h4>
                {(() => {
                  const categories = Array.from(new Set(products.map(p => p.category))).sort();
                  
                  if (categories.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-500">
                        <p>No products found. Add some products to generate category links.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {categories.map(category => {
                        const categoryProducts = products.filter(p => p.category === category);
                        const categoryUrl = `${window.location.origin}/catalogue/${company?.name?.toLowerCase().replace(/\s+/g, '-')}/${user?.uid}?categories=${encodeURIComponent(category)}`;
                        const linkId = `category-${category}`;
                        
                        return (
                          <div key={category} className="bg-white border rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h5 className="font-medium text-gray-900">{category}</h5>
                                <p className="text-sm text-gray-500">
                                  {categoryProducts.length} product{categoryProducts.length !== 1 ? 's' : ''}
                                </p>
                                <code className="text-xs text-gray-600 mt-1 block font-mono">
                                  {categoryUrl}
                                </code>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(categoryUrl, '_blank')}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => copyToClipboard(categoryUrl, linkId)}
                                >
                                  {copiedLinks.has(linkId) ? (
                                    <Check className="h-4 w-4" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Multi-Category Links */}
              {(() => {
                const categories = Array.from(new Set(products.map(p => p.category))).sort();
                return categories.length > 1;
              })() && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Multi-Category Links</h4>
                  <div className="bg-yellow-50 p-4 rounded-lg mb-4">
                    <p className="text-sm text-yellow-800">
                      You can combine multiple categories in one link by separating them with commas.
                    </p>
                    <div className="mt-2">
                      <code className="text-xs bg-white p-2 rounded border font-mono">
                        {window.location.origin}/catalogue/{company?.name?.toLowerCase().replace(/\s+/g, '-')}/{user?.uid}?categories=Category1,Category2
                      </code>
                    </div>
                  </div>
                </div>
              )}

              {/* Usage Instructions */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">How to Use</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Copy the base catalogue URL to link to your full product catalog</li>
                  <li>• Copy category-specific links to showcase particular product types</li>
                  <li>• Combine multiple categories by adding commas: ?categories=Electronics,Clothing</li>
                  <li>• Paste these links into your external landing pages or websites</li>
                  <li>• When customers click these links, they'll see your products in your POS system</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Checkout Settings Tab */}
      {activeTab === 'checkout' && (
        <div className="space-y-6">
          {checkoutLoading ? (
            <Card>
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                <span className="ml-3 text-gray-600">Loading checkout settings...</span>
              </div>
            </Card>
          ) : checkoutSettings ? (
            <>
              {/* General Sections */}
              <Card>
                <div className="max-w-4xl mx-auto">
                  <div className="space-y-6">
                    <div className="text-center mb-8">
                      <h3 className="text-2xl font-semibold text-gray-900 mb-2">Checkout Settings</h3>
                      <p className="text-gray-600">Customize your checkout form and payment options</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Settings Controls */}
                      <div className="space-y-6">
                        {/* Section-Level Controls */}
                        <div className="bg-white rounded-lg shadow-sm border p-6">
                          <div className="flex items-center space-x-2 mb-4">
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            <h2 className="text-xl font-semibold text-gray-900">Disable Entire Sections</h2>
                          </div>
                          <p className="text-sm text-gray-600 mb-6">Completely hide entire sections from the checkout form. When disabled, the entire section disappears.</p>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                              <div>
                                <label className="text-sm font-medium text-gray-700">Contact Section</label>
                                <p className="text-xs text-gray-500">Hide entire contact information section</p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checkoutSettings.showContactSection}
                                  onChange={(e) => handleCheckoutSettingsUpdate({ showContactSection: e.target.checked })}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                              </label>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                              <div>
                                <label className="text-sm font-medium text-gray-700">Delivery Section</label>
                                <p className="text-xs text-gray-500">Hide entire delivery address section</p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checkoutSettings.showDeliverySection}
                                  onChange={(e) => handleCheckoutSettingsUpdate({ showDeliverySection: e.target.checked })}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                              </label>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                              <div>
                                <label className="text-sm font-medium text-gray-700">Payment Section</label>
                                <p className="text-xs text-gray-500">Hide entire payment method selection</p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checkoutSettings.showPaymentSection}
                                  onChange={(e) => handleCheckoutSettingsUpdate({ showPaymentSection: e.target.checked })}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                              </label>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                              <div>
                                <label className="text-sm font-medium text-gray-700">Order Summary Section</label>
                                <p className="text-xs text-gray-500">Hide entire order summary section</p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checkoutSettings.showOrderSummary}
                                  onChange={(e) => handleCheckoutSettingsUpdate({ showOrderSummary: e.target.checked })}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                              </label>
                            </div>
                          </div>
                        </div>

                        {/* Contact Section Field Controls */}
                        {checkoutSettings.showContactSection && (
                          <div className="bg-white rounded-lg shadow-sm border p-6 ml-4 border-l-4 border-l-blue-200">
                            <div className="flex items-center space-x-2 mb-4">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <h3 className="text-lg font-semibold text-gray-900">Contact Section Fields</h3>
                            </div>
                            <p className="text-sm text-gray-600 mb-4">Control which fields appear in the Contact section</p>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Email Field</label>
                                  <p className="text-xs text-gray-500">Show email input field</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checkoutSettings.showEmail}
                                    onChange={(e) => handleCheckoutSettingsUpdate({ showEmail: e.target.checked })}
                                    className="sr-only peer"
                                  />
                                  <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                              </div>

                              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Phone Field</label>
                                  <p className="text-xs text-gray-500">Show phone number input field</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checkoutSettings.showPhone}
                                    onChange={(e) => handleCheckoutSettingsUpdate({ showPhone: e.target.checked })}
                                    className="sr-only peer"
                                  />
                                  <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                              </div>

                              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Newsletter Opt-in</label>
                                  <p className="text-xs text-gray-500">Show newsletter subscription checkbox</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checkoutSettings.showNewsletter}
                                    onChange={(e) => handleCheckoutSettingsUpdate({ showNewsletter: e.target.checked })}
                                    className="sr-only peer"
                                  />
                                  <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Delivery Section Field Controls */}
                        {checkoutSettings.showDeliverySection && (
                          <div className="bg-white rounded-lg shadow-sm border p-6 ml-4 border-l-4 border-l-green-200">
                            <div className="flex items-center space-x-2 mb-4">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <h3 className="text-lg font-semibold text-gray-900">Delivery Section Fields</h3>
                            </div>
                            <p className="text-sm text-gray-600 mb-4">Control which fields appear in the Delivery section</p>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Country/Region</label>
                                  <p className="text-xs text-gray-500">Show country selection dropdown</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checkoutSettings.showCountry}
                                    onChange={(e) => handleCheckoutSettingsUpdate({ showCountry: e.target.checked })}
                                    className="sr-only peer"
                                  />
                                  <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                                </label>
                              </div>

                              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                <div>
                                  <label className="text-sm font-medium text-gray-700">First Name</label>
                                  <p className="text-xs text-gray-500">Show first name input field</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checkoutSettings.showFirstName}
                                    onChange={(e) => handleCheckoutSettingsUpdate({ showFirstName: e.target.checked })}
                                    className="sr-only peer"
                                  />
                                  <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                                </label>
                              </div>

                              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Last Name</label>
                                  <p className="text-xs text-gray-500">Show last name input field</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checkoutSettings.showLastName}
                                    onChange={(e) => handleCheckoutSettingsUpdate({ showLastName: e.target.checked })}
                                    className="sr-only peer"
                                  />
                                  <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                                </label>
                              </div>

                              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Address</label>
                                  <p className="text-xs text-gray-500">Show address input field</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checkoutSettings.showAddress}
                                    onChange={(e) => handleCheckoutSettingsUpdate({ showAddress: e.target.checked })}
                                    className="sr-only peer"
                                  />
                                  <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                                </label>
                              </div>

                              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Apartment/Suite</label>
                                  <p className="text-xs text-gray-500">Show apartment/suite input field</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checkoutSettings.showApartment}
                                    onChange={(e) => handleCheckoutSettingsUpdate({ showApartment: e.target.checked })}
                                    className="sr-only peer"
                                  />
                                  <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                                </label>
                              </div>

                              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                <div>
                                  <label className="text-sm font-medium text-gray-700">City</label>
                                  <p className="text-xs text-gray-500">Show city input field</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checkoutSettings.showCity}
                                    onChange={(e) => handleCheckoutSettingsUpdate({ showCity: e.target.checked })}
                                    className="sr-only peer"
                                  />
                                  <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                                </label>
                              </div>

                              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Delivery Instructions</label>
                                  <p className="text-xs text-gray-500">Show delivery instructions textarea</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checkoutSettings.showDeliveryInstructions}
                                    onChange={(e) => handleCheckoutSettingsUpdate({ showDeliveryInstructions: e.target.checked })}
                                    className="sr-only peer"
                                  />
                                  <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                                </label>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Payment Methods */}
                        <div className="bg-white rounded-lg shadow-sm border p-6">
                          <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Methods</h2>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 bg-yellow-500 rounded flex items-center justify-center">
                                  <span className="text-white font-bold text-xs">M</span>
                                </div>
                                <span className="text-sm font-medium text-gray-700">MTN Money</span>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checkoutSettings.enabledPaymentMethods.mtnMoney}
                                  onChange={(e) => handleCheckoutSettingsUpdate({ 
                                    enabledPaymentMethods: { 
                                      ...checkoutSettings.enabledPaymentMethods, 
                                      mtnMoney: e.target.checked 
                                    } 
                                  })}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                              </label>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center">
                                  <span className="text-white font-bold text-xs">O</span>
                                </div>
                                <span className="text-sm font-medium text-gray-700">Orange Money</span>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checkoutSettings.enabledPaymentMethods.orangeMoney}
                                  onChange={(e) => handleCheckoutSettingsUpdate({ 
                                    enabledPaymentMethods: { 
                                      ...checkoutSettings.enabledPaymentMethods, 
                                      orangeMoney: e.target.checked 
                                    } 
                                  })}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                              </label>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <CreditCard className="h-5 w-5 text-gray-600" />
                                <span className="text-sm font-medium text-gray-700">Visa Card</span>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checkoutSettings.enabledPaymentMethods.visaCard}
                                  onChange={(e) => handleCheckoutSettingsUpdate({ 
                                    enabledPaymentMethods: { 
                                      ...checkoutSettings.enabledPaymentMethods, 
                                      visaCard: e.target.checked 
                                    } 
                                  })}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                              </label>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Truck className="h-5 w-5 text-emerald-600" />
                                <span className="text-sm font-medium text-gray-700">Pay Onsite</span>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checkoutSettings.enabledPaymentMethods.payOnsite}
                                  onChange={(e) => handleCheckoutSettingsUpdate({ 
                                    enabledPaymentMethods: { 
                                      ...checkoutSettings.enabledPaymentMethods, 
                                      payOnsite: e.target.checked 
                                    } 
                                  })}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                              </label>
                            </div>
                          </div>
                        </div>

                        {/* Catalogue Display Settings */}
                        <div className="bg-white rounded-lg shadow-sm border p-6">
                          <div className="flex items-center space-x-2 mb-4">
                            <ShoppingBag className="h-5 w-5 text-emerald-600" />
                            <h2 className="text-xl font-semibold text-gray-900">Catalogue Display</h2>
                          </div>
                          
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <label className="text-sm font-medium text-gray-700">Show Checkout in Catalogue</label>
                                <p className="text-xs text-gray-500">Display checkout button on catalogue page</p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checkoutSettings.showCheckoutInCatalogue}
                                  onChange={(e) => handleCheckoutSettingsUpdate({ showCheckoutInCatalogue: e.target.checked })}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                              </label>
                            </div>

                            {checkoutSettings.showCheckoutInCatalogue && (
                              <div className="ml-4 space-y-4 border-l-2 border-gray-200 pl-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Checkout Button Text
                                  </label>
                                  <input
                                    type="text"
                                    value={checkoutSettings.checkoutButtonText}
                                    onChange={(e) => handleCheckoutSettingsUpdate({ checkoutButtonText: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    placeholder="Checkout Now"
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Button Color
                                  </label>
                                  <div className="flex items-center space-x-3">
                                    <input
                                      type="color"
                                      value={checkoutSettings.checkoutButtonColor}
                                      onChange={(e) => handleCheckoutSettingsUpdate({ checkoutButtonColor: e.target.value })}
                                      className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
                                    />
                                    <input
                                      type="text"
                                      value={checkoutSettings.checkoutButtonColor}
                                      onChange={(e) => handleCheckoutSettingsUpdate({ checkoutButtonColor: e.target.value })}
                                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                      placeholder="#10b981"
                                    />
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1">
                                    Choose a color for the checkout button in the catalogue
                                  </p>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-4">
                                  <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                                  <button
                                    style={{ backgroundColor: checkoutSettings.checkoutButtonColor }}
                                    className="px-4 py-2 text-white rounded-lg font-medium"
                                  >
                                    {checkoutSettings.checkoutButtonText}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end space-x-4">
                          <Button
                            onClick={handleResetCheckoutSettings}
                            disabled={checkoutSaving}
                            variant="outline"
                            className="flex items-center"
                          >
                            <RotateCcw size={20} className="mr-2" />
                            Reset to Default
                          </Button>
                          <Button
                            onClick={handleSaveCheckoutSettings}
                            disabled={checkoutSaving}
                            className="flex items-center"
                          >
                            {checkoutSaving ? (
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                            ) : (
                              <Save size={20} className="mr-2" />
                            )}
                            Save Settings
                          </Button>
                        </div>
                      </div>

                      {/* Preview Panel */}
                      <div className="bg-white rounded-lg shadow-sm border p-6 h-fit">
                        <div className="flex items-center space-x-2 mb-4">
                          <Eye className="h-5 w-5 text-emerald-600" />
                          <h3 className="text-lg font-semibold text-gray-900">Live Preview</h3>
                        </div>
                        
                        <div className="space-y-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Contact Section</span>
                            <span className={`px-2 py-1 rounded text-xs ${
                              checkoutSettings.showContactSection ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {checkoutSettings.showContactSection ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Delivery Section</span>
                            <span className={`px-2 py-1 rounded text-xs ${
                              checkoutSettings.showDeliverySection ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {checkoutSettings.showDeliverySection ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Payment Section</span>
                            <span className={`px-2 py-1 rounded text-xs ${
                              checkoutSettings.showPaymentSection ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {checkoutSettings.showPaymentSection ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Order Summary</span>
                            <span className={`px-2 py-1 rounded text-xs ${
                              checkoutSettings.showOrderSummary ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {checkoutSettings.showOrderSummary ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>

                          {/* Individual Field Status */}
                          {checkoutSettings.showContactSection && (
                            <div className="border-t border-gray-200 pt-3">
                              <div className="text-gray-600 mb-2">Contact Fields:</div>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">Email</span>
                                  <span className={`w-2 h-2 rounded-full ${
                                    checkoutSettings.showEmail ? 'bg-emerald-500' : 'bg-gray-300'
                                  }`}></span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">Phone</span>
                                  <span className={`w-2 h-2 rounded-full ${
                                    checkoutSettings.showPhone ? 'bg-emerald-500' : 'bg-gray-300'
                                  }`}></span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">Newsletter</span>
                                  <span className={`w-2 h-2 rounded-full ${
                                    checkoutSettings.showNewsletter ? 'bg-emerald-500' : 'bg-gray-300'
                                  }`}></span>
                                </div>
                              </div>
                            </div>
                          )}

                          {checkoutSettings.showDeliverySection && (
                            <div className="border-t border-gray-200 pt-3">
                              <div className="text-gray-600 mb-2">Delivery Fields:</div>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">Country</span>
                                  <span className={`w-2 h-2 rounded-full ${
                                    checkoutSettings.showCountry ? 'bg-emerald-500' : 'bg-gray-300'
                                  }`}></span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">First Name</span>
                                  <span className={`w-2 h-2 rounded-full ${
                                    checkoutSettings.showFirstName ? 'bg-emerald-500' : 'bg-gray-300'
                                  }`}></span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">Last Name</span>
                                  <span className={`w-2 h-2 rounded-full ${
                                    checkoutSettings.showLastName ? 'bg-emerald-500' : 'bg-gray-300'
                                  }`}></span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">Address</span>
                                  <span className={`w-2 h-2 rounded-full ${
                                    checkoutSettings.showAddress ? 'bg-emerald-500' : 'bg-gray-300'
                                  }`}></span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">Apartment</span>
                                  <span className={`w-2 h-2 rounded-full ${
                                    checkoutSettings.showApartment ? 'bg-emerald-500' : 'bg-gray-300'
                                  }`}></span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">City</span>
                                  <span className={`w-2 h-2 rounded-full ${
                                    checkoutSettings.showCity ? 'bg-emerald-500' : 'bg-gray-300'
                                  }`}></span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">Instructions</span>
                                  <span className={`w-2 h-2 rounded-full ${
                                    checkoutSettings.showDeliveryInstructions ? 'bg-emerald-500' : 'bg-gray-300'
                                  }`}></span>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          <div className="border-t border-gray-200 pt-3">
                            <div className="text-gray-600 mb-2">Payment Methods:</div>
                            <div className="space-y-1">
                              {Object.entries(checkoutSettings.enabledPaymentMethods).map(([method, enabled]) => (
                                <div key={method} className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500 capitalize">
                                    {method.replace(/([A-Z])/g, ' $1').trim()}
                                  </span>
                                  <span className={`w-2 h-2 rounded-full ${
                                    enabled ? 'bg-emerald-500' : 'bg-gray-300'
                                  }`}></span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="border-t border-gray-200 pt-3">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Catalogue Checkout</span>
                              <span className={`px-2 py-1 rounded text-xs ${
                                checkoutSettings.showCheckoutInCatalogue ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {checkoutSettings.showCheckoutInCatalogue ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>
                            {checkoutSettings.showCheckoutInCatalogue && (
                              <div className="mt-2">
                                <div className="text-xs text-gray-500 mb-1">Button Preview:</div>
                                <button
                                  style={{ backgroundColor: checkoutSettings.checkoutButtonColor }}
                                  className="px-3 py-1 text-white rounded text-xs font-medium"
                                >
                                  {checkoutSettings.checkoutButtonText}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <Card>
              <div className="text-center py-8 text-gray-500">
                <p>Failed to load checkout settings. Please try again.</p>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Payment Integration Tab */}
      {activeTab === 'payment' && (
        <div className="space-y-6">
          {cinetpayLoading ? (
            <Card>
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                <span className="ml-3 text-gray-600">Loading payment integration settings...</span>
              </div>
            </Card>
          ) : cinetpayConfig ? (
            <>
              {/* CinetPay Configuration */}
              <Card>
                <div className="max-w-4xl mx-auto">
                  <div className="space-y-6">
                    <div className="text-center mb-8">
                      <h3 className="text-2xl font-semibold text-gray-900 mb-2">Payment Integration</h3>
                      <p className="text-gray-600">Configure CinetPay for online payment processing</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Configuration Controls */}
                      <div className="space-y-6">
                        {/* Master Enable/Disable */}
                        <div className="bg-white rounded-lg shadow-sm border p-6">
                          <div className="flex items-center space-x-2 mb-4">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                            <h2 className="text-xl font-semibold text-gray-900">Payment Integration</h2>
                          </div>
                          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div>
                              <label className="text-sm font-medium text-gray-700">Enable Online Payments</label>
                              <p className="text-xs text-gray-500">Master switch for all online payment processing</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={cinetpayConfig.isActive}
                                onChange={(e) => handleCinetpayConfigUpdate({ isActive: e.target.checked })}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                            </label>
                          </div>
                        </div>

                        {/* Test/Live Mode */}
                        <div className="bg-white rounded-lg shadow-sm border p-6">
                          <div className="flex items-center space-x-2 mb-4">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <h2 className="text-xl font-semibold text-gray-900">Environment Mode</h2>
                          </div>
                          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div>
                              <label className="text-sm font-medium text-gray-700">Test Mode</label>
                              <p className="text-xs text-gray-500">Use sandbox environment for testing</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={cinetpayConfig.testMode}
                                onChange={(e) => handleCinetpayConfigUpdate({ testMode: e.target.checked })}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </div>
                          {cinetpayConfig.testMode && (
                            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                              <div className="flex items-center">
                                <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                                <span className="text-sm text-yellow-800 font-medium">Test Mode Active</span>
                              </div>
                              <p className="text-xs text-yellow-700 mt-1">All payments will be processed in sandbox mode</p>
                            </div>
                          )}
                        </div>

                        {/* CinetPay Credentials */}
                        <div className="bg-white rounded-lg shadow-sm border p-6">
                          <div className="flex items-center space-x-2 mb-4">
                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                            <h2 className="text-xl font-semibold text-gray-900">CinetPay Credentials</h2>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Site ID</label>
                              <Input
                                type="text"
                                value={cinetpayConfig.siteId}
                                onChange={(e) => handleCinetpayConfigUpdate({ siteId: e.target.value })}
                                placeholder="Enter your CinetPay Site ID"
                                className="w-full"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                              <Input
                                type="password"
                                value={cinetpayConfig.apiKey}
                                onChange={(e) => handleCinetpayConfigUpdate({ apiKey: e.target.value })}
                                placeholder="Enter your CinetPay API Key"
                                className="w-full"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                              <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-600">
                                XAF (Cameroon Franc) - Fixed
                              </div>
                            </div>
                            <div className="flex space-x-3">
                              <Button
                                onClick={handleTestCinetpayConnection}
                                disabled={cinetpayTesting || !cinetpayConfig.siteId || !cinetpayConfig.apiKey}
                                className="flex-1"
                              >
                                {cinetpayTesting ? 'Testing...' : 'Test Connection'}
                              </Button>
                              <Button
                                onClick={handleClearCinetpayCredentials}
                                disabled={cinetpaySaving || !cinetpayConfig.siteId || !cinetpayConfig.apiKey}
                                variant="outline"
                                className="flex-1 bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                              >
                                {cinetpaySaving ? (
                                  'Clearing...'
                                ) : (
                                  <>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Clear Credentials
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Payment Channels */}
                        <div className="bg-white rounded-lg shadow-sm border p-6">
                          <div className="flex items-center space-x-2 mb-4">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <h2 className="text-xl font-semibold text-gray-900">Enabled Payment Methods</h2>
                          </div>
                          <p className="text-sm text-gray-600 mb-4">Select which payment methods to offer to your customers</p>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                              <div>
                                <label className="text-sm font-medium text-gray-700">Mobile Money</label>
                                <p className="text-xs text-gray-500">MTN Money, Orange Money</p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={cinetpayConfig.enabledChannels.mobileMoney}
                                  onChange={(e) => handleCinetpayConfigUpdate({ 
                                    enabledChannels: { 
                                      ...cinetpayConfig.enabledChannels, 
                                      mobileMoney: e.target.checked 
                                    } 
                                  })}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                              </label>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                              <div>
                                <label className="text-sm font-medium text-gray-700">Credit Card</label>
                                <p className="text-xs text-gray-500">Visa, Mastercard</p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={cinetpayConfig.enabledChannels.creditCard}
                                  onChange={(e) => handleCinetpayConfigUpdate({ 
                                    enabledChannels: { 
                                      ...cinetpayConfig.enabledChannels, 
                                      creditCard: e.target.checked 
                                    } 
                                  })}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                              </label>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                              <div>
                                <label className="text-sm font-medium text-gray-700">Wallet</label>
                                <p className="text-xs text-gray-500">Electronic wallets</p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={cinetpayConfig.enabledChannels.wallet}
                                  onChange={(e) => handleCinetpayConfigUpdate({ 
                                    enabledChannels: { 
                                      ...cinetpayConfig.enabledChannels, 
                                      wallet: e.target.checked 
                                    } 
                                  })}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                              </label>
                            </div>
                          </div>
                        </div>

                        {/* Save Button */}
                        <div className="flex justify-end space-x-3">
                          <Button
                            onClick={handleSaveCinetpayConfig}
                            disabled={cinetpaySaving}
                            className="flex items-center space-x-2"
                          >
                            <Save className="h-4 w-4" />
                            <span>{cinetpaySaving ? 'Saving...' : 'Save Settings'}</span>
                          </Button>
                        </div>
                      </div>

                      {/* Preview Panel */}
                      <div className="space-y-6">
                        <div className="bg-white rounded-lg shadow-sm border p-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuration Preview</h3>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Payment Integration</span>
                              <span className={`px-2 py-1 rounded text-xs ${
                                cinetpayConfig.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {cinetpayConfig.isActive ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Environment</span>
                              <span className={`px-2 py-1 rounded text-xs ${
                                cinetpayConfig.testMode ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                              }`}>
                                {cinetpayConfig.testMode ? 'Test Mode' : 'Live Mode'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Site ID</span>
                              <span className="text-xs text-gray-500">
                                {cinetpayConfig.siteId ? `${cinetpayConfig.siteId.substring(0, 8)}...` : 'Not set'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">API Key</span>
                              <span className="text-xs text-gray-500">
                                {cinetpayConfig.apiKey ? '••••••••' : 'Not set'}
                              </span>
                            </div>
                            <div className="border-t border-gray-200 pt-3">
                              <div className="text-gray-600 mb-2">Enabled Payment Methods:</div>
                              <div className="space-y-1">
                                {Object.entries(cinetpayConfig.enabledChannels).map(([channel, enabled]) => (
                                  <div key={channel} className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500 capitalize">
                                      {channel.replace(/([A-Z])/g, ' $1').trim()}
                                    </span>
                                    <span className={`w-2 h-2 rounded-full ${
                                      enabled ? 'bg-emerald-500' : 'bg-gray-300'
                                    }`}></span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <Card>
              <div className="text-center py-8 text-gray-500">
                <p>Failed to load payment integration settings. Please try again.</p>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Payment Method Modal */}
      <PaymentMethodModal
        isOpen={isPaymentMethodModalOpen}
        onClose={() => setIsPaymentMethodModalOpen(false)}
        onSave={handleAddPaymentMethod}
        onUpdate={handleUpdatePaymentMethod}
        onDelete={handleDeletePaymentMethod}
        paymentMethods={orderingSettings?.paymentMethods?.customMethods || []}
      />
    </div>
  );
};

export default Settings;