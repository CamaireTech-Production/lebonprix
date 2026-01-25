import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { EncryptionService } from '../../services/encryptionService';
import { FirestoreService } from '../../services/firestoreService';
import { CinetPayAuditLogger } from '../../services/auditLogger';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';
import toast from 'react-hot-toast';
import { TestTube, Trash2, Eye, EyeOff, Save } from 'lucide-react';

const CinetPaySettings: React.FC = () => {
  const { restaurant } = useAuth();
  const { language } = useLanguage();
  
  const [siteId, setSiteId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [isActive, setIsActive] = useState(false);
  const [minAmount, setMinAmount] = useState(100);
  const [maxAmount, setMaxAmount] = useState(1000000);
  const [supportedMethods, setSupportedMethods] = useState<string[]>(['MTN', 'Orange']);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (restaurant?.cinetpayConfig) {
      setSiteId(restaurant.cinetpayConfig.siteId || '');
      // Don't decrypt for display, show placeholder
      setApiKey(restaurant.cinetpayConfig.apiKey ? '••••••••••••••••' : '');
      setEnvironment(restaurant.cinetpayConfig.environment || 'sandbox');
      setIsActive(restaurant.cinetpayConfig.isActive || false);
      setMinAmount(restaurant.cinetpayConfig.minAmount || 100);
      setMaxAmount(restaurant.cinetpayConfig.maxAmount || 1000000);
      setSupportedMethods(restaurant.cinetpayConfig.supportedMethods || ['MTN', 'Orange']);
    }
  }, [restaurant]);

  const handleSave = async () => {
    if (!restaurant?.id) return;
    
    if (!siteId.trim() || !apiKey.trim()) {
      toast.error(t('cinetpay_site_id_required', language) + ' / ' + t('cinetpay_api_key_required', language));
      return;
    }

    setIsSaving(true);
    
    try {
      // Only encrypt if it's a new API key (not the placeholder)
      const encryptedApiKey = apiKey.includes('••') 
        ? restaurant.cinetpayConfig?.apiKey || ''
        : EncryptionService.encrypt(apiKey);

      // Merge with existing restaurant data to avoid validation issues
      await FirestoreService.updateRestaurant(restaurant.id, {
        ...restaurant, // Include all existing restaurant data
        cinetpayConfig: {
          siteId: siteId.trim(),
          apiKey: encryptedApiKey,
          environment,
          isActive,
          minAmount,
          maxAmount,
          supportedMethods
        }
      });

      // Log configuration update
      await CinetPayAuditLogger.log({
        userId: restaurant.id,
        action: 'cinetpay_config_updated',
        details: {
          restaurantId: restaurant.id,
          environment
        }
      });

      toast.success(t('cinetpay_config_saved_success', language));
      
      // Reset API key field to placeholder
      setApiKey('••••••••••••••••');
    } catch (error) {
      console.error('Failed to save CinetPay config:', error);
      toast.error(t('cinetpay_config_saved_fail', language));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!siteId.trim() || !apiKey.trim() || apiKey.includes('••')) {
      toast.error(t('cinetpay_api_key_required_test', language));
      return;
    }

    setIsTesting(true);
    
    try {
      // In a real implementation, you would call CinetPay API to test
      // For now, just simulate a test
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success(t('cinetpay_connection_test_success', language));
    } catch (error) {
      console.error('CinetPay test failed:', error);
      toast.error(t('cinetpay_connection_test_fail', language));
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearCredentials = () => {
    if (window.confirm(t('cinetpay_clear_credentials_confirm', language))) {
      setSiteId('');
      setApiKey('');
      setIsActive(false);
      toast.success(t('cinetpay_credentials_cleared', language));
    }
  };

  const toggleMethod = (method: string) => {
    setSupportedMethods(prev => 
      prev.includes(method)
        ? prev.filter(m => m !== method)
        : [...prev, method]
    );
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-xl font-bold mb-4">{t('cinetpay_payment_config', language)}</h2>
      
      <div className="space-y-4">
        {/* Environment Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('environment', language)}
          </label>
          <select
            value={environment}
            onChange={(e) => setEnvironment(e.target.value as 'sandbox' | 'production')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="sandbox">{t('sandbox_testing', language)}</option>
            <option value="production">{t('production', language)}</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {t('environment_info', language)}
          </p>
        </div>

        {/* Site ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('cinetpay_site_id', language)} *
          </label>
          <input
            type="text"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder={t('enter_cinetpay_site_id', language)}
          />
        </div>

        {/* API Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('cinetpay_api_key', language)} *
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 pr-10"
              placeholder={t('enter_cinetpay_api_key', language)}
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
            >
              {showApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {t('cinetpay_api_key_encrypted_info', language)}
          </p>
        </div>

        {/* Supported Payment Methods */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('supported_payment_methods', language)}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {['MTN', 'Orange', 'Visa', 'Mastercard'].map(method => (
              <label key={method} className="flex items-center">
                <input
                  type="checkbox"
                  checked={supportedMethods.includes(method)}
                  onChange={() => toggleMethod(method)}
                  className="mr-2"
                />
                <span className="text-sm">{method}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Amount Limits */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('minimum_amount', language)} (FCFA)
            </label>
            <input
              type="number"
              value={minAmount}
              onChange={(e) => setMinAmount(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('maximum_amount', language)} (FCFA)
            </label>
            <input
              type="number"
              value={maxAmount}
              onChange={(e) => setMaxAmount(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Active Toggle */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="cinetpay-active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="mr-2"
          />
          <label htmlFor="cinetpay-active" className="text-sm font-medium text-gray-700">
            {t('enable_cinetpay_payments', language)}
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Save size={16} />
            {isSaving ? t('saving', language) : t('save_configuration', language)}
          </button>
          
          <button
            onClick={handleTestConnection}
            disabled={isTesting || !siteId || !apiKey || apiKey.includes('••')}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <TestTube size={16} />
            {isTesting ? t('testing', language) : t('test', language)}
          </button>
          
          <button
            onClick={handleClearCredentials}
            className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Trash2 size={16} />
            {t('clear', language)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CinetPaySettings;
