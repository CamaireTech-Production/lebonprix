import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { EncryptionService } from '../../services/encryptionService';
import { FirestoreService } from '../../services/firestoreService';
import { CinetPayAuditLogger } from '../../services/auditLogger';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';
import toast from 'react-hot-toast';
import { TestTube, Trash2, Eye, EyeOff, Save, HelpCircle } from 'lucide-react';
import Modal from '../ui/Modal';

const CampaySettings: React.FC = () => {
  const { restaurant } = useAuth();
  const { language } = useLanguage();
  
  const [appId, setAppId] = useState('');
  const [environment, setEnvironment] = useState<'demo' | 'production'>('demo');
  const [isActive, setIsActive] = useState(false);
  const [minAmount, setMinAmount] = useState(100);
  const [maxAmount, setMaxAmount] = useState(1000000);
  const [showAppId, setShowAppId] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showAppIdModal, setShowAppIdModal] = useState(false);

  useEffect(() => {
    if (restaurant?.campayConfig) {
      // Don't decrypt for display, show placeholder
      setAppId(restaurant.campayConfig.appId ? '••••••••••••••••' : '');
      setEnvironment(restaurant.campayConfig.environment || 'demo');
      setIsActive(restaurant.campayConfig.isActive || false);
      setMinAmount(restaurant.campayConfig.minAmount || 100);
      setMaxAmount(restaurant.campayConfig.maxAmount || 1000000);
    }
  }, [restaurant]);

  const handleSave = async () => {
    if (!restaurant?.id) return;
    
    if (!appId.trim()) {
      toast.error(t('campay_app_id_required', language));
      return;
    }

    setIsSaving(true);
    
    try {
      // Only encrypt if it's a new App ID (not the placeholder)
      const encryptedAppId = appId.includes('••') 
        ? restaurant.campayConfig?.appId || ''
        : EncryptionService.encrypt(appId);

      // Merge with existing restaurant data to avoid validation issues
      // Keep existing supportedMethods if they exist (for backward compatibility)
      // Payment methods are configured in Campay dashboard, not here
      await FirestoreService.updateRestaurant(restaurant.id, {
        ...restaurant, // Include all existing restaurant data
        campayConfig: {
          appId: encryptedAppId,
          environment,
          isActive,
          minAmount,
          maxAmount,
          supportedMethods: restaurant.campayConfig?.supportedMethods || ['MTN', 'Orange'] // Keep existing or default
        }
      });

      // Log configuration update (using CinetPayAuditLogger for now, can create separate logger later)
      await CinetPayAuditLogger.log({
        userId: restaurant.id,
        action: 'cinetpay_config_updated', // Using same action type for now
        details: {
          restaurantId: restaurant.id,
          environment: environment === 'demo' ? 'sandbox' : 'production' // Map to CinetPay format
        }
      });

      toast.success(t('campay_config_saved_success', language));
      
      // Reset App ID field to placeholder
      setAppId('••••••••••••••••');
    } catch (error) {
      console.error('Failed to save Campay config:', error);
      toast.error(t('campay_config_saved_fail', language));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!appId.trim() || appId.includes('••')) {
      toast.error(t('campay_app_id_required_test', language));
      return;
    }

    setIsTesting(true);
    
    try {
      // Create a temporary CampayService instance for testing
      const { CampayService } = await import('../../services/campayService');
      const testService = new CampayService();
      
      // Test the connection with the provided App ID and environment
      const testResult = await testService.testConnection(appId.trim(), environment);
      
      if (testResult) {
        toast.success(t('campay_connection_test_success', language));
      } else {
        toast.error(t('campay_connection_test_fail', language));
      }
    } catch (error) {
      console.error('Campay test failed:', error);
      const errorMessage = error instanceof Error ? error.message : t('campay_connection_test_fail', language);
      toast.error(errorMessage);
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearCredentials = () => {
    if (window.confirm(t('campay_clear_credentials_confirm', language))) {
      setAppId('');
      setIsActive(false);
      toast.success(t('campay_credentials_cleared', language));
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-xl font-bold mb-4">{t('campay_payment_config', language)}</h2>
      
      <div className="space-y-4">
        {/* Environment Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('environment', language)}
          </label>
          <select
            value={environment}
            onChange={(e) => setEnvironment(e.target.value as 'demo' | 'production')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="demo">{t('demo_testing', language)}</option>
            <option value="production">{t('production', language)}</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {t('campay_environment_info', language)}
          </p>
        </div>

        {/* App ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('campay_app_id', language)} *
          </label>
          <button
            type="button"
            onClick={() => setShowAppIdModal(true)}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline mb-2 flex items-center gap-1"
          >
            <HelpCircle size={14} />
            {t('how_to_get_campay_app_id', language)}
          </button>
          <div className="relative">
            <input
              type={showAppId ? 'text' : 'password'}
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 pr-10"
              placeholder={t('enter_campay_app_id', language)}
            />
            <button
              type="button"
              onClick={() => setShowAppId(!showAppId)}
              className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
            >
              {showAppId ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {t('campay_app_id_encrypted_info', language)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {t('campay_payment_methods_note', language)}
          </p>
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
              onChange={(e) => setMinAmount(parseInt(e.target.value) || 0)}
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
              onChange={(e) => setMaxAmount(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Active Toggle */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="campay-active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="mr-2"
          />
          <label htmlFor="campay-active" className="text-sm font-medium text-gray-700">
            {t('enable_campay_payments', language)}
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
            disabled={isTesting || !appId || appId.includes('••')}
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

      {/* App ID Help Modal */}
      <Modal
        isOpen={showAppIdModal}
        onClose={() => setShowAppIdModal(false)}
        title={t('how_to_get_campay_app_id', language)}
        className="max-w-4xl"
      >
        <div className="space-y-6 py-2">
          <p className="text-base text-gray-600 leading-relaxed">
            {t('campay_app_id_modal_intro', language)}
          </p>
          
          <ol className="space-y-6 list-decimal list-inside">
            <li className="text-base text-gray-700 leading-relaxed">
              <strong className="text-lg block mb-2">{t('campay_app_id_step_1_title', language)}</strong>
              <p className="text-gray-600 mt-2 ml-6 leading-relaxed">
                {t('campay_app_id_step_1_desc', language)}
              </p>
            </li>
            
            <li className="text-base text-gray-700 leading-relaxed">
              <strong className="text-lg block mb-2">{t('campay_app_id_step_2_title', language)}</strong>
              <p className="text-gray-600 mt-2 ml-6 leading-relaxed">
                {t('campay_app_id_step_2_desc', language)}
              </p>
            </li>
            
            <li className="text-base text-gray-700 leading-relaxed">
              <strong className="text-lg block mb-2">{t('campay_app_id_step_3_title', language)}</strong>
              <p className="text-gray-600 mt-2 ml-6 leading-relaxed">
                {t('campay_app_id_step_3_desc', language)}
              </p>
            </li>
            
            <li className="text-base text-gray-700 leading-relaxed">
              <strong className="text-lg block mb-2">{t('campay_app_id_step_4_title', language)}</strong>
              <p className="text-gray-600 mt-2 ml-6 leading-relaxed">
                {t('campay_app_id_step_4_desc', language)}
              </p>
            </li>
          </ol>

          <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-base text-blue-800 mb-2">
              <strong>{t('campay_app_id_note_title', language)}</strong>
            </p>
            <p className="text-base text-blue-700 leading-relaxed">
              {t('campay_app_id_note_desc', language)}
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CampaySettings;

