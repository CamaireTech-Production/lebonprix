import React, { useState, useEffect } from 'react';
import { CreditCard } from 'lucide-react';
import { Restaurant, PaymentInfo } from '../../types';
import PaymentSetup from '../payment/PaymentSetup';
import CinetPaySettings from './CinetPaySettings';
import CampaySettings from './CampaySettings';
import { t } from '../../utils/i18n';
import { useLanguage } from '../../contexts/LanguageContext';

interface PaymentSettingsTabProps {
  restaurant: Restaurant | null;
  onUpdate: (data: Record<string, unknown>) => Promise<void>;
}

const PaymentSettingsTab: React.FC<PaymentSettingsTabProps> = ({ restaurant, onUpdate }) => {
  const { language } = useLanguage();
  
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>(restaurant?.paymentInfo || {});
  const [deliveryFee, setDeliveryFee] = useState(restaurant?.deliveryFee || 0);
  const [mtnMerchantCode, setMtnMerchantCode] = useState(restaurant?.paymentInfo?.mtnMerchantCode || '');
  const [orangeMerchantCode, setOrangeMerchantCode] = useState(restaurant?.paymentInfo?.orangeMerchantCode || '');
  const [paymentLink, setPaymentLink] = useState(restaurant?.paymentInfo?.paymentLink || '');

  useEffect(() => {
    if (restaurant) {
      setPaymentInfo(restaurant.paymentInfo || {});
      setDeliveryFee(restaurant.deliveryFee || 0);
      setMtnMerchantCode(restaurant.paymentInfo?.mtnMerchantCode || '');
      setOrangeMerchantCode(restaurant.paymentInfo?.orangeMerchantCode || '');
      setPaymentLink(restaurant.paymentInfo?.paymentLink || '');
    }
  }, [restaurant]);

  const handlePaymentInfoChange = (newPaymentInfo: PaymentInfo) => {
    setPaymentInfo(newPaymentInfo);
  };

  const handleSave = async () => {
    try {
      await onUpdate({
        paymentInfo: {
          ...paymentInfo,
          mtnMerchantCode,
          orangeMerchantCode,
          paymentLink,
        },
        deliveryFee,
      });
    } catch (error) {
      console.error('Error updating payment info:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center">
          <CreditCard className="h-5 w-5 text-blue-600 mr-2" />
          <h3 className="text-sm font-medium text-blue-800">
            {t('payment_setup_title', language)}
          </h3>
        </div>
        <p className="mt-1 text-sm text-blue-700">
          {t('payment_setup_description', language)}
        </p>
      </div>

      {/* Restaurant Payment Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">{t('restaurant_payment_settings', language)}</h2>
        <PaymentSetup
          paymentInfo={paymentInfo}
          onPaymentInfoChange={handlePaymentInfoChange}
          isRequired={false}
          deliveryFee={deliveryFee}
          onDeliveryFeeChange={setDeliveryFee}
          mtnMerchantCode={mtnMerchantCode}
          setMtnMerchantCode={setMtnMerchantCode}
          orangeMerchantCode={orangeMerchantCode}
          setOrangeMerchantCode={setOrangeMerchantCode}
          paymentLink={paymentLink}
          setPaymentLink={setPaymentLink}
        />
        <div className="flex justify-end mt-6 pt-4 border-t">
          <button
            onClick={handleSave}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
          >
            {t('save_payment_settings', language)}
          </button>
        </div>
      </div>

      {/* CinetPay Configuration Section */}
      <div className="mt-8">
        <CinetPaySettings />
      </div>

      {/* Campay Configuration Section */}
      <div className="mt-8">
        <CampaySettings />
      </div>
    </div>
  );
};

export default PaymentSettingsTab;
