import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Input, Textarea, Button, CreatableSelect } from '@components/common';
import { useSiteSettings } from '@hooks/business/useSiteSettings';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import type { SEOSettings } from '@services/firestore/site/siteService';

interface SEOSettingsProps {
  className?: string;
}

const SEOSettings = ({ className = '' }: SEOSettingsProps) => {
  const { t } = useTranslation();
  const { settings, updateSettings, loading, saving } = useSiteSettings();
  
  const [formData, setFormData] = useState<SEOSettings>({
    metaTitle: '',
    metaDescription: '',
    metaKeywords: [],
    ogImage: '',
    twitterCard: 'summary'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update form data when settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        metaTitle: settings.metaTitle || '',
        metaDescription: settings.metaDescription || '',
        metaKeywords: settings.metaKeywords || [],
        ogImage: settings.ogImage || '',
        twitterCard: settings.twitterCard || 'summary'
      });
    }
  }, [settings]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.metaTitle && formData.metaTitle.length > 60) {
      newErrors.metaTitle = t('site.seo.validation.titleTooLong', 'Meta title should be 60 characters or less');
    }

    if (formData.metaDescription && formData.metaDescription.length > 160) {
      newErrors.metaDescription = t('site.seo.validation.descriptionTooLong', 'Meta description should be 160 characters or less');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      showErrorToast(t('site.seo.validation.fixErrors', 'Please fix the validation errors'));
      return;
    }

    try {
      await updateSettings(formData);
    } catch (error) {
      // Error is already handled in the hook
    }
  };

  const handleKeywordChange = (keywords: string[]) => {
    setFormData(prev => ({
      ...prev,
      metaKeywords: keywords
    }));
  };

  const previewTitle = formData.metaTitle || 'Your Catalogue';
  const previewDescription = formData.metaDescription || 'Browse our products';
  const previewImage = formData.ogImage || '';

  return (
    <div className={`space-y-6 ${className}`}>
      <Card title={t('site.seo.title', 'SEO Settings')}>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Meta Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('site.seo.metaTitle', 'Meta Title')}
              <span className="text-gray-500 text-xs ml-2">
                ({formData.metaTitle?.length || 0}/60 {t('site.seo.characters', 'characters')})
              </span>
            </label>
            <Input
              value={formData.metaTitle || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, metaTitle: e.target.value }))}
              placeholder={t('site.seo.metaTitlePlaceholder', 'Your Catalogue - Best Products Online')}
              maxLength={60}
              error={errors.metaTitle}
            />
            <p className="mt-1 text-xs text-gray-500">
              {t('site.seo.metaTitleDescription', 'The title that appears in search engine results and browser tabs')}
            </p>
          </div>

          {/* Meta Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('site.seo.metaDescription', 'Meta Description')}
              <span className="text-gray-500 text-xs ml-2">
                ({formData.metaDescription?.length || 0}/160 {t('site.seo.characters', 'characters')})
              </span>
            </label>
            <Textarea
              value={formData.metaDescription || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, metaDescription: e.target.value }))}
              placeholder={t('site.seo.metaDescriptionPlaceholder', 'Discover our amazing collection of products...')}
              rows={3}
              maxLength={160}
              error={errors.metaDescription}
            />
            <p className="mt-1 text-xs text-gray-500">
              {t('site.seo.metaDescriptionDescription', 'A brief description that appears in search engine results')}
            </p>
          </div>

          {/* Meta Keywords */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('site.seo.metaKeywords', 'Meta Keywords')}
            </label>
            <CreatableSelect
              value={formData.metaKeywords || []}
              onChange={handleKeywordChange}
              placeholder={t('site.seo.metaKeywordsPlaceholder', 'Add keywords (press Enter to add)')}
              isMulti
            />
            <p className="mt-1 text-xs text-gray-500">
              {t('site.seo.metaKeywordsDescription', 'Keywords that describe your catalogue (comma-separated)')}
            </p>
          </div>

          {/* OG Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('site.seo.ogImage', 'Open Graph Image URL')}
            </label>
            <Input
              value={formData.ogImage || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, ogImage: e.target.value }))}
              placeholder={t('site.seo.ogImagePlaceholder', 'https://example.com/image.jpg')}
              type="url"
            />
            <p className="mt-1 text-xs text-gray-500">
              {t('site.seo.ogImageDescription', 'Image URL that appears when sharing on social media (recommended: 1200x630px)')}
            </p>
            {previewImage && (
              <div className="mt-2">
                <img
                  src={previewImage}
                  alt={t('site.seo.ogImagePreview', 'OG Image Preview')}
                  className="max-w-xs border rounded"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          {/* Twitter Card Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('site.seo.twitterCard', 'Twitter Card Type')}
            </label>
            <select
              value={formData.twitterCard || 'summary'}
              onChange={(e) => setFormData(prev => ({ ...prev, twitterCard: e.target.value as 'summary' | 'summary_large_image' }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="summary">{t('site.seo.twitterCardSummary', 'Summary')}</option>
              <option value="summary_large_image">{t('site.seo.twitterCardLarge', 'Summary with Large Image')}</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {t('site.seo.twitterCardDescription', 'How your catalogue appears when shared on Twitter')}
            </p>
          </div>

          {/* Preview */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3">{t('site.seo.previewTitle', 'Preview')}</h4>
            <div className="bg-white border rounded-lg p-4">
              <div className="text-blue-600 text-sm mb-1">
                {window.location.origin}
              </div>
              <div className="text-lg text-blue-800 font-medium mb-1">
                {previewTitle}
              </div>
              <div className="text-sm text-gray-600">
                {previewDescription}
              </div>
              {previewImage && (
                <img
                  src={previewImage}
                  alt="Preview"
                  className="mt-2 max-w-full h-32 object-cover rounded"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              isLoading={saving}
              disabled={loading || saving}
            >
              {saving ? t('site.seo.saving', 'Saving...') : t('site.seo.save', 'Save SEO Settings')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default SEOSettings;

