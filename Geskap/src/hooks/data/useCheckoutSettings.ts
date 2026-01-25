import { useState, useEffect } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { getCheckoutSettingsWithDefaults, subscribeToCheckoutSettings } from '@services/utilities/checkoutSettingsService';
import type { CheckoutSettings } from '../../types/checkoutSettings';

export const useCheckoutSettings = () => {
  const { company } = useAuth();
  const [settings, setSettings] = useState<CheckoutSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company?.id) return;

    setLoading(true);

    const unsubscribe = subscribeToCheckoutSettings(company.id, (checkoutSettings) => {
      if (checkoutSettings) {
        setSettings(checkoutSettings);
        setLoading(false);
      } else {
        // If no settings exist, get defaults
        getCheckoutSettingsWithDefaults(company.id).then(defaultSettings => {
          setSettings(defaultSettings);
          setLoading(false);
        });
      }
    });

    return unsubscribe;
  }, [company?.id]);

  return { settings, loading };
};
