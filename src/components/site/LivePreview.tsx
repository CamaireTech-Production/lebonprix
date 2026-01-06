import { useState, useEffect, useMemo, useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@contexts/AuthContext';
import { Button, Card } from '@components/common';
import { RefreshCw, Smartphone, Monitor, ExternalLink } from 'lucide-react';

interface LivePreviewProps {
  className?: string;
}

const LivePreview = ({ className = '' }: LivePreviewProps) => {
  const { t } = useTranslation();
  const { company } = useAuth();
  const [viewMode, setViewMode] = useState<'mobile' | 'desktop'>('desktop');
  const [isLoading, setIsLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);
  
  // Solution 1: Stabilize company object reference
  // Memoize company based only on id and name to prevent unnecessary recalculations
  const memoizedCompany = useMemo(() => {
    if (!company) return null;
    return {
      id: company.id,
      name: company.name
    };
  }, [company?.id, company?.name]);

  // Generate catalogue URL - use company.id instead of user.uid to support both owners and employees
  // Memoize to prevent unnecessary recalculations and iframe reloads
  const catalogueUrl = useMemo(() => {
    if (!memoizedCompany?.id) return '';
    return `${window.location.origin}/catalogue/${encodeURIComponent(memoizedCompany.name?.toLowerCase().replace(/\s+/g, '-') || 'catalogue')}/${memoizedCompany.id}`;
  }, [memoizedCompany?.id, memoizedCompany?.name]);
  
  // Solution 3: Prevent iframe reload if URL hasn't changed
  // Use sessionStorage to persist iframeSrc across unmounts
  const storageKeyRef = useRef<string>('');
  const prevUrlRef = useRef<string>('');
  
  // Update storage key when company changes
  useEffect(() => {
    if (memoizedCompany?.id) {
      storageKeyRef.current = `livePreview_iframeSrc_${memoizedCompany.id}`;
    }
  }, [memoizedCompany?.id]);
  
  // Initialize iframeSrc from sessionStorage or catalogueUrl
  const [iframeSrc, setIframeSrc] = useState<string>(() => {
    if (typeof window !== 'undefined' && memoizedCompany?.id) {
      const key = `livePreview_iframeSrc_${memoizedCompany.id}`;
      const stored = sessionStorage.getItem(key);
      if (stored && stored === catalogueUrl) {
        return stored;
      }
    }
    return '';
  });
  
  useEffect(() => {
    if (catalogueUrl && catalogueUrl !== prevUrlRef.current) {
      prevUrlRef.current = catalogueUrl;
      setIframeSrc(catalogueUrl);
      setIsLoading(true);
      // Persist to sessionStorage
      if (typeof window !== 'undefined' && storageKeyRef.current) {
        sessionStorage.setItem(storageKeyRef.current, catalogueUrl);
      }
    } else if (!catalogueUrl) {
      setIframeSrc('');
      prevUrlRef.current = '';
      if (typeof window !== 'undefined' && storageKeyRef.current) {
        sessionStorage.removeItem(storageKeyRef.current);
      }
    }
  }, [catalogueUrl]);

  const handleRefresh = () => {
    setIsLoading(true);
    // Force iframe reload by updating key (this will remount the iframe)
    setIframeKey(prev => prev + 1);
  };

  const handleOpenInNewTab = () => {
    if (catalogueUrl) {
      window.open(catalogueUrl, '_blank');
    }
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
  };

  if (!memoizedCompany) {
    return (
      <Card title={t('site.preview.title', 'Live Preview')} className={className}>
        <div className="text-center py-8 text-gray-500">
          <p>{t('site.preview.companyNotAvailable', 'Company information not available')}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card title={t('site.preview.title', 'Live Preview')} className={className}>
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('desktop')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'desktop'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Monitor className="h-4 w-4 inline mr-2" />
              {t('site.preview.desktop', 'Desktop')}
            </button>
            <button
              onClick={() => setViewMode('mobile')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'mobile'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Smartphone className="h-4 w-4 inline mr-2" />
              {t('site.preview.mobile', 'Mobile')}
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              {t('site.preview.refresh', 'Refresh')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenInNewTab}
              icon={<ExternalLink className="h-4 w-4" />}
            >
              {t('site.preview.openInNewTab', 'Open in New Tab')}
            </Button>
          </div>
        </div>

        {/* Preview Container */}
        <div
          className={`relative border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-100 ${
            viewMode === 'mobile' ? 'max-w-sm mx-auto' : 'w-full'
          }`}
          style={{
            height: viewMode === 'mobile' ? '600px' : '700px'
          }}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">{t('site.preview.loadingPreview', 'Loading preview...')}</p>
              </div>
            </div>
          )}
          <iframe
            key={iframeKey}
            src={iframeSrc}
            className="w-full h-full border-0"
            title={t('site.preview.title', 'Live Preview')}
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        </div>

        {/* URL Display */}
        <div className="bg-gray-50 p-3 rounded-md">
          <p className="text-xs text-gray-500 mb-1">{t('site.preview.previewUrl', 'Preview URL')}:</p>
          <code className="text-xs text-gray-700 break-all">{catalogueUrl}</code>
        </div>
      </div>
    </Card>
  );
};

// Memoize LivePreview to prevent unnecessary re-renders
export default memo(LivePreview);

