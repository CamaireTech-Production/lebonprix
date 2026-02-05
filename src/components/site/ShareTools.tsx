import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@contexts/AuthContext';
import { Button, Card } from '@components/common';
import { Copy, Check, ExternalLink, Share2, Facebook, Twitter, MessageCircle } from 'lucide-react';
import { showSuccessToast } from '@utils/core/toast';
import { QRCodeSVG } from 'qrcode.react';
import { useModules } from '@hooks/business/useModules';
import { useShops } from '@hooks/data/useFirestore';

interface ShareToolsProps {
  className?: string;
}

const ShareTools = ({ className = '' }: ShareToolsProps) => {
  const { t } = useTranslation();
  const { company } = useAuth();
  const [copied, setCopied] = useState(false);
  const { isStarter } = useModules();
  const { shops } = useShops();
  const activeShops = useMemo(() => shops.filter(s => s.isActive !== false), [shops]);

  // Generate catalogue URL - use company.id instead of user.uid to support both owners and employees
  // Memoize to prevent unnecessary recalculations
  const catalogueUrl = useMemo(() => {
    if (!company?.id) return '';
    return `${window.location.origin}/catalogue/${encodeURIComponent(company.name?.toLowerCase().replace(/\s+/g, '-') || 'catalogue')}/${company.id}`;
  }, [company?.id, company?.name]);

  // Helper to generate shop URL
  const getShopUrl = (shopId: string) => {
    if (!catalogueUrl) return '';
    return `${catalogueUrl}/shop/${shopId}`;
  };

  const handleCopyLink = async () => {
    if (!catalogueUrl) return;

    try {
      await navigator.clipboard.writeText(catalogueUrl);
      setCopied(true);
      showSuccessToast(t('site.share.linkCopied', 'Link copied to clipboard!'));
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
      showSuccessToast(t('site.share.linkCopyFailed', 'Failed to copy link'));
    }
  };

  const handleCopyShopLink = async (shopId: string) => {
    const url = getShopUrl(shopId);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      showSuccessToast(t('site.share.linkCopied', 'Link copied to clipboard!'));
    } catch (error) {
      console.error('Failed to copy link:', error);
      showSuccessToast(t('site.share.linkCopyFailed', 'Failed to copy link'));
    }
  };

  const handleShare = async (platform: 'whatsapp' | 'facebook' | 'twitter') => {
    if (!catalogueUrl) return;

    const encodedUrl = encodeURIComponent(catalogueUrl);
    const shareText = t('site.share.shareText', 'Check out {{companyName}} catalogue!', {
      companyName: company?.name || 'my'
    });
    const encodedText = encodeURIComponent(shareText);

    let shareUrl = '';

    switch (platform) {
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`;
        break;
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }
  };

  if (!company) {
    return (
      <Card title={t('site.share.title', 'Share Your Catalogue')} className={className}>
        <div className="text-center py-8 text-gray-500">
          <p>{t('site.share.companyNotAvailable', 'Company information not available')}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card title={t('site.share.title', 'Share Your Catalogue')} className={className}>
      <div className="space-y-6">
        {/* URL Display and Copy */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('site.share.catalogueUrl', 'Your Catalogue URL')}
          </label>
          <div className="flex items-center space-x-2">
            <code className="flex-1 bg-white p-2 rounded border text-sm font-mono break-all">
              {catalogueUrl}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            >
              {copied ? t('site.share.copied', 'Copied!') : t('site.share.copy', 'Copy')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(catalogueUrl, '_blank')}
              icon={<ExternalLink className="h-4 w-4" />}
            >
              {t('site.share.open', 'Open')}
            </Button>
          </div>
        </div>

        {/* SHOP SPECIFIC LINKS (Enterprise Only) */}
        {!isStarter && activeShops.length > 0 && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-4">
              {t('site.share.shopLinks', 'Liens par Boutique / Point de Vente')}
            </label>
            <div className="space-y-3">
              {activeShops.map((shop) => (
                <div key={shop.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-3 rounded border border-gray-200 gap-3">
                  <div className="flex items-center">
                    <div className={`w-2 h-8 rounded-l mr-3 ${shop.isWarehouse ? 'bg-orange-500' : 'bg-emerald-500'}`}></div>
                    <div>
                      <span className="font-medium text-gray-900">{shop.name}</span>
                      <span className="text-xs text-gray-500 block">
                        {shop.isWarehouse ? 'Entrepôt' : 'Boutique'} • {shop.location || 'No location'}
                      </span>
                    </div>
                  </div>
                  <div className="flex space-x-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyShopLink(shop.id)}
                      icon={<Copy className="h-4 w-4" />}
                      className="flex-1 sm:flex-none"
                    >
                      {t('site.share.copy', 'Copier')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(getShopUrl(shop.id), '_blank')}
                      icon={<ExternalLink className="h-4 w-4" />}
                      className="flex-1 sm:flex-none"
                    >
                      {t('site.share.open', 'Ouvrir')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              {t('site.share.shopLinksDesc', 'Ces liens affichent uniquement les produits disponibles dans la boutique spécifique.')}
            </p>
          </div>
        )}

        {/* QR Code */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-4">
            {t('site.share.qrCode', 'QR Code')}
          </label>
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-lg">
              <QRCodeSVG value={catalogueUrl} size={200} />
            </div>
          </div>
          <p className="text-xs text-gray-500 text-center mt-4">
            {t('site.share.qrCodeDescription', 'Scan this QR code to open your catalogue on mobile devices')}
          </p>
        </div>

        {/* Social Share Buttons */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-4">
            {t('site.share.socialShare', 'Share on Social Media')}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button
              variant="outline"
              onClick={() => handleShare('whatsapp')}
              icon={<MessageCircle className="h-4 w-4" />}
              className="w-full"
            >
              {t('site.share.whatsapp', 'WhatsApp')}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleShare('facebook')}
              icon={<Facebook className="h-4 w-4" />}
              className="w-full"
            >
              {t('site.share.facebook', 'Facebook')}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleShare('twitter')}
              icon={<Twitter className="h-4 w-4" />}
              className="w-full"
            >
              {t('site.share.twitter', 'Twitter')}
            </Button>
          </div>
        </div>

        {/* Share Instructions */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">{t('site.share.howToShare', 'How to Share')}</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• {t('site.share.howToShareItem1', 'Copy the URL and paste it anywhere (email, messages, etc.)')}</li>
            <li>• {t('site.share.howToShareItem2', 'Use the QR code for easy mobile sharing')}</li>
            <li>• {t('site.share.howToShareItem3', 'Share directly on social media using the buttons above')}</li>
            <li>• {t('site.share.howToShareItem4', 'The link works on all devices and browsers')}</li>
          </ul>
        </div>
      </div>
    </Card>
  );
};

export default ShareTools;
