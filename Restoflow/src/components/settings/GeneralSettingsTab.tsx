import React, { useState, useEffect } from 'react';
import { Store, MapPin, FileText, Upload, X } from 'lucide-react';
import { Restaurant } from '../../types';
import { formatCameroonPhone } from '../../utils/paymentUtils';
import { t } from '../../utils/i18n';
import { useLanguage } from '../../contexts/LanguageContext';
import CurrencyDropdown from '../ui/CurrencyDropdown';
import { currencies } from '../../data/currencies';
import ColorPicker from '../ui/ColorPicker';
import designSystem from '../../designSystem';

interface GeneralSettingsTabProps {
  restaurant: Restaurant | null;
  onUpdate: (data: Record<string, unknown>) => Promise<void>;
}

const GeneralSettingsTab: React.FC<GeneralSettingsTabProps> = ({ restaurant, onUpdate }) => {
  const { language } = useLanguage();
  
  const [name, setName] = useState(restaurant?.name || '');
  const [address, setAddress] = useState(restaurant?.address || '');
  const [phone, setPhone] = useState(() => {
    if (restaurant?.phone) {
      const formatted = formatCameroonPhone(restaurant.phone);
      return formatted.replace('+237 ', '');
    }
    return '';
  });
  const [description, setDescription] = useState(restaurant?.description || '');
  const [currency, setCurrency] = useState(restaurant?.currency || 'XAF');
  const [deliveryFee, setDeliveryFee] = useState(restaurant?.deliveryFee || 0);
  const [logoPreview, setLogoPreview] = useState<string | null>(restaurant?.logo || null);
  const [logoBase64, setLogoBase64] = useState<string | null>(restaurant?.logo || null);
  const [primaryColor, setPrimaryColor] = useState(restaurant?.colorPalette?.primary || '#000000');
  const [secondaryColor, setSecondaryColor] = useState(restaurant?.colorPalette?.secondary || '#FFFFFF');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const colorCustomizationEnabled = restaurant?.colorCustomization === true;

  useEffect(() => {
    if (restaurant) {
      setName(restaurant.name || '');
      setAddress(restaurant.address || '');
      setPhone(restaurant.phone || '');
      setDescription(restaurant.description || '');
      setCurrency(restaurant.currency || 'XAF');
      setDeliveryFee(restaurant.deliveryFee || 0);
      setLogoPreview(restaurant.logo || null);
      setPrimaryColor(restaurant.colorPalette?.primary || designSystem.colors.primary);
      setSecondaryColor(restaurant.colorPalette?.secondary || designSystem.colors.secondary);
    }
  }, [restaurant]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoPreview(URL.createObjectURL(file));
      const base64 = await fileToBase64(file);
      setLogoBase64(base64);
    }
  };

  const removeLogo = () => {
    setLogoPreview(null);
    setLogoBase64(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!name.trim()) {
      setError(t('restaurant_name_required_profile', language));
      return;
    }
    
    setIsLoading(true);
    try {
      const logoData = logoBase64 || restaurant?.logo || '';
      const formattedPhone = phone;
      
      await onUpdate({
        name,
        logo: logoData,
        address,
        description,
        phone: formattedPhone,
        currency,
        deliveryFee,
        colorPalette: {
          primary: primaryColor,
          secondary: secondaryColor,
        },
      });
    } catch (error: unknown) {
      console.error('Error updating profile:', error);
      setError(t('failed_update_profile', language));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {/* Logo and Colors */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          {t('logo_colors_label_profile', language)}
        </label>
        <div className="flex items-center gap-10 flex-wrap">
          {/* Logo upload */}
          {logoPreview ? (
            <div className="relative">
              <img
                src={logoPreview}
                alt="Restaurant logo preview"
                className="w-24 h-24 object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={removeLogo}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <label
              htmlFor="logo-upload"
              className="cursor-pointer flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#8B0000] transition-colors"
            >
              <Upload size={24} className="text-gray-400" />
              <span className="mt-2 text-xs text-gray-500">{t('upload_logo_profile', language)}</span>
            </label>
          )}
          <input
            id="logo-upload"
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            className="hidden"
          />
          {/* Color pickers */}
          {colorCustomizationEnabled && (
            <ColorPicker
              initialPrimary={primaryColor}
              initialSecondary={secondaryColor}
              onChange={(p, s) => {
                setPrimaryColor(p);
                setSecondaryColor(s);
              }}
            />
          )}
        </div>
      </div>

      {/* Basic Information */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            {t('restaurant_name_label_profile', language)}*
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Store size={18} className="text-gray-400" />
            </div>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-10 block w-full py-3 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
              placeholder={t('restaurant_name_placeholder_profile', language)}
            />
          </div>
        </div>

        <div>
          <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
            {t('currency', language)}
          </label>
          <CurrencyDropdown
            value={currency}
            onChange={setCurrency}
            currencies={currencies}
            language={language}
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
            {t('phone_label_profile', language)}
          </label>
          <div className="mt-1 relative rounded-md shadow-sm flex">
            <select
              className="block appearance-none w-24 py-3 pl-3 pr-8 border border-gray-300 bg-white rounded-l-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
              value={'+237'}
              disabled
            >
              <option value="+237">🇨🇲 +237</option>
            </select>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="block w-full py-3 border-t border-b border-r border-gray-300 rounded-r-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm px-3"
              placeholder={t('phone_placeholder_profile', language)}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{t('phone_hint_profile', language)}</p>
        </div>

        <div>
          <label htmlFor="deliveryFee" className="block text-sm font-medium text-gray-700">
            {t('delivery_fee', language)} ({currency})
          </label>
          <input
            id="deliveryFee"
            name="deliveryFee"
            type="number"
            min="0"
            step="100"
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(Number(e.target.value))}
            className="mt-1 block w-full py-3 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
            placeholder="0"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="address" className="block text-sm font-medium text-gray-700">
            {t('address_label_profile', language)}
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MapPin size={18} className="text-gray-400" />
            </div>
            <input
              id="address"
              name="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="pl-10 block w-full py-3 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
              placeholder={t('address_placeholder_profile', language)}
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            {t('description_label_profile', language)}
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute top-3 left-3 pointer-events-none">
              <FileText size={18} className="text-gray-400" />
            </div>
            <textarea
              id="description"
              name="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="pl-10 block w-full py-3 border border-gray-300 rounded-md shadow-sm focus:ring-rose focus:border-rose sm:text-sm"
              placeholder={t('description_placeholder_profile', language)}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? t('saving_profile', language) : t('save_changes_profile', language)}
        </button>
      </div>
    </form>
  );
};

export default GeneralSettingsTab;
