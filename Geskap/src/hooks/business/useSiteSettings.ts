import { useState, useEffect } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { getSiteSettings, updateSiteSettings, type SEOSettings } from '@services/firestore/site/siteService';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';

export const useSiteSettings = () => {
  const { company } = useAuth();
  const [settings, setSettings] = useState<SEOSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load settings when company is available
  useEffect(() => {
    if (!company?.id) {
      setLoading(false);
      return;
    }

    const loadSettings = async () => {
      try {
        setLoading(true);
        setError(null);
        const seoSettings = await getSiteSettings(company.id);
        setSettings(seoSettings || {
          metaTitle: '',
          metaDescription: '',
          metaKeywords: [],
          ogImage: '',
          twitterCard: 'summary'
        });
      } catch (err: any) {
        console.error('Error loading site settings:', err);
        setError(err.message || 'Failed to load SEO settings');
        // Set defaults on error
        setSettings({
          metaTitle: '',
          metaDescription: '',
          metaKeywords: [],
          ogImage: '',
          twitterCard: 'summary'
        });
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [company?.id]);

  const updateSettings = async (newSettings: SEOSettings): Promise<void> => {
    if (!company?.id) {
      throw new Error('Company not found');
    }

    try {
      setSaving(true);
      setError(null);
      await updateSiteSettings(company.id, newSettings);
      setSettings(newSettings);
      showSuccessToast('SEO settings updated successfully');
    } catch (err: any) {
      console.error('Error updating site settings:', err);
      const errorMessage = err.message || 'Failed to update SEO settings';
      setError(errorMessage);
      showErrorToast(errorMessage);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return {
    settings,
    updateSettings,
    loading,
    saving,
    error
  };
};

