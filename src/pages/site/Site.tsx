import { useState, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { LivePreview, ShareTools, AnalyticsDashboard, SEOSettings } from '@components/site';
import { SkeletonLoader } from '@components/common';

const Site = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('preview');

  // Memoize tabs array to prevent unnecessary re-renders
  const tabs = useMemo(() => [
    { id: 'preview', label: t('site.tabs.preview', 'Preview') },
    { id: 'share', label: t('site.tabs.share', 'Share') },
    { id: 'analytics', label: t('site.tabs.analytics', 'Analytics') },
    { id: 'seo', label: t('site.tabs.seo', 'SEO Settings') }
  ], [t]);

  return (
    <div className="pb-16 md:pb-0">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          {t('site.title', 'Site')}
        </h1>
        <p className="text-gray-600">
          {t('site.subtitle', 'Manage your catalogue site')}
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content - Use more stable rendering pattern */}
      <div>
        {activeTab === 'preview' && <LivePreview key="preview" />}
        {activeTab === 'share' && <ShareTools key="share" />}
        {activeTab === 'analytics' && <AnalyticsDashboard key="analytics" />}
        {activeTab === 'seo' && <SEOSettings key="seo" />}
      </div>
    </div>
  );
};

// Memoize Site component to prevent unnecessary re-renders
export default memo(Site);

