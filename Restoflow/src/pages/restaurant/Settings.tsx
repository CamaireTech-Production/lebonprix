import React from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { ChefHat, Store, CreditCard, Shield, Share2 } from 'lucide-react';
import { t } from '../../utils/i18n';
import { useLanguage } from '../../contexts/LanguageContext';
import TabbedSettings from '../../components/settings/TabbedSettings';
import GeneralSettingsTab from '../../components/settings/GeneralSettingsTab';
import PaymentSettingsTab from '../../components/settings/PaymentSettingsTab';
import SecuritySettingsTab from '../../components/settings/SecuritySettingsTab';
import SocialMediaSettingsTab from '../../components/settings/SocialMediaSettingsTab';

const Settings: React.FC = () => {
  const { restaurant, updateRestaurantProfile } = useAuth();
  const { language } = useLanguage();

  // Always show sidebar for settings page
  const showSidebar = true;

  // Define tabs for the settings interface
  const tabs = [
    {
      id: 'general',
      label: t('general_settings', language),
      icon: Store,
      component: () => <GeneralSettingsTab restaurant={restaurant} onUpdate={updateRestaurantProfile} />
    },
    {
      id: 'payment',
      label: t('payment_settings', language),
      icon: CreditCard,
      component: () => <PaymentSettingsTab restaurant={restaurant} onUpdate={updateRestaurantProfile} />
    },
    {
      id: 'security',
      label: t('security_settings', language),
      icon: Shield,
      component: () => <SecuritySettingsTab restaurant={restaurant as unknown as Record<string, unknown>} onUpdate={updateRestaurantProfile} />
    },
    {
      id: 'social',
      label: t('social_media', language),
      icon: Share2,
      component: () => <SocialMediaSettingsTab restaurant={restaurant} onUpdate={updateRestaurantProfile} />
    }
  ];

  const content = (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <ChefHat size={48} className="mx-auto text-primary" />
          <h1 className="mt-6 text-3xl font-extrabold text-gray-900">
            {t('restaurant_settings', language)}
          </h1>
          <p className="mt-2 text-gray-600">
            {t('manage_restaurant_settings_description', language)}
          </p>
        </div>

        <TabbedSettings 
          tabs={tabs} 
          defaultTab="general"
          className="shadow-lg"
        />
      </div>
    </div>
  );

  return showSidebar ? (
    <DashboardLayout title={""}>{content}</DashboardLayout>
  ) : content;
};

export default Settings;