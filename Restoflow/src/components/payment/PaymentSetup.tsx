import React, { useState } from 'react';
import { User, AlertCircle, CheckCircle } from 'lucide-react';
import { validateCameroonPhone, formatCameroonPhone } from '../../utils/paymentUtils';
import { PaymentInfo } from '../../types';
import { t } from '../../utils/i18n';
import { useLanguage } from '../../contexts/LanguageContext';

interface PaymentSetupProps {
  paymentInfo: PaymentInfo;
  onPaymentInfoChange: (paymentInfo: PaymentInfo) => void;
  isRequired?: boolean;
  deliveryFee?: number;
  onDeliveryFeeChange?: (fee: number) => void;
  mtnMerchantCode?: string;
  setMtnMerchantCode?: (v: string) => void;
  orangeMerchantCode?: string;
  setOrangeMerchantCode?: (v: string) => void;
  paymentLink?: string;
  setPaymentLink?: (v: string) => void;
}

const PaymentSetup: React.FC<PaymentSetupProps> = ({
  paymentInfo,
  onPaymentInfoChange,
  isRequired = false,
  deliveryFee,
  onDeliveryFeeChange,
  mtnMerchantCode,
  setMtnMerchantCode,
  orangeMerchantCode,
  setOrangeMerchantCode,
  paymentLink,
  setPaymentLink
}) => {
  const [errors, setErrors] = useState<{
    momoNumber?: string;
    momoName?: string;
    omNumber?: string;
    omName?: string;
  }>({});
  const { language } = useLanguage();

  const validateField = (_type: 'momo' | 'om', field: 'number' | 'name', value: string): string | undefined => {
    if (field === 'number' && value) {
      if (!validateCameroonPhone(value)) {
        return t('invalid_phone_number', language);
      }
    }
    if (field === 'name' && value && value.trim().length < 2) {
      return t('name_min_length', language);
    }
    return undefined;
  };

  const handleFieldChange = (type: 'momo' | 'om', field: 'number' | 'name', value: string) => {
    setErrors(prev => ({
      ...prev,
      [`${type}${field.charAt(0).toUpperCase() + field.slice(1)}`]: undefined
    }));

    // Always treat phone number as a string
    let safeValue = value || '';
    if (field === 'number') {
      // Only allow digits
      safeValue = safeValue.replace(/[^0-9]/g, '');
    }

    const updatedPaymentInfo = {
      ...paymentInfo,
      [type]: {
        type,
        number: field === 'number' ? safeValue : paymentInfo[type]?.number || '',
        name: field === 'name' ? value : paymentInfo[type]?.name || ''
      }
    };

    // Remove empty payment methods
    if (type === 'momo' && (!updatedPaymentInfo.momo?.number && !updatedPaymentInfo.momo?.name)) {
      delete updatedPaymentInfo.momo;
    }
    if (type === 'om' && (!updatedPaymentInfo.om?.number && !updatedPaymentInfo.om?.name)) {
      delete updatedPaymentInfo.om;
    }

    onPaymentInfoChange(updatedPaymentInfo);
  };

  const handleFieldBlur = (type: 'momo' | 'om', field: 'number' | 'name', value: string) => {
    const error = validateField(type, field, value);
    if (error) {
      setErrors(prev => ({
        ...prev,
        [`${type}${field.charAt(0).toUpperCase() + field.slice(1)}`]: error
      }));
    }
  };

  const hasValidPaymentInfo = () => {
    return (
      (paymentInfo.momo?.number && paymentInfo.momo?.name && validateCameroonPhone(paymentInfo.momo.number)) ||
      (paymentInfo.om?.number && paymentInfo.om?.name && validateCameroonPhone(paymentInfo.om.number))
    );
  };

  return (
    <div className="space-y-8">

      <div className="border-b border-gray-200 pb-6">
        <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
          {t('payment_information', language)}
          {isRequired && <span className="text-red-500">*</span>}
        </h3>
        <p className="text-sm text-gray-600 mt-2">
          {t('payment_information_desc', language)}
        </p>
      </div>

      {/* Mobile Money Section */}
      <div className="mb-10">
        <h3 className="text-lg font-bold text-gray-900 mb-4">{t('mobile_money', language)}</h3>
        {/* MTN Mobile Money */}
        <div className="mb-6">
          <h4 className="text-md font-semibold text-gray-900 mb-2">{t('mtn_mobile_money', language)}</h4>
          {/* Phone and Name fields for MTN */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">{t('phone_number', language)}</label>
              <div className="relative">
                <div className="flex">
                  <div className="flex items-center px-4 py-3 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md text-sm font-medium text-gray-700">+237</div>
                  <input type="tel" value={paymentInfo.momo?.number || ''} onChange={(e) => handleFieldChange('momo', 'number', e.target.value)} onBlur={(e) => handleFieldBlur('momo', 'number', e.target.value)} className={`flex-1 px-4 py-3 border border-gray-300 rounded-r-md shadow-sm focus:ring-primary focus:border-primary text-sm ${errors.momoNumber ? 'border-red-300' : ''}`} placeholder="612345678" />
                </div>
              </div>
              {errors.momoNumber && (<p className="mt-2 text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} />{errors.momoNumber}</p>)}
              {paymentInfo.momo?.number && !errors.momoNumber && (<p className="mt-2 text-sm text-gray-500">{formatCameroonPhone(paymentInfo.momo.number)}</p>)}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">{t('name', language)}</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><User size={18} className="text-gray-400" /></div>
                <input type="text" value={paymentInfo.momo?.name || ''} onChange={(e) => handleFieldChange('momo', 'name', e.target.value)} onBlur={(e) => handleFieldBlur('momo', 'name', e.target.value)} className={`pl-12 pr-4 py-3 block w-full border rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm ${errors.momoName ? 'border-red-300' : 'border-gray-300'}`} placeholder="e.g. John Doe" />
                {paymentInfo.momo?.name && paymentInfo.momo.name.trim().length >= 2 && (<div className="absolute inset-y-0 right-0 pr-4 flex items-center"><CheckCircle size={18} className="text-green-500" /></div>)}
              </div>
              {errors.momoName && (<p className="mt-2 text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} />{errors.momoName}</p>)}
            </div>
          </div>
        </div>
        {/* Orange Mobile Money */}
        <div className="mb-6">
          <h4 className="text-md font-semibold text-gray-900 mb-2">{t('orange_mobile_money', language)}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">{t('phone_number', language)}</label>
              <div className="relative">
                <div className="flex">
                  <div className="flex items-center px-4 py-3 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md text-sm font-medium text-gray-700">+237</div>
                  <input type="tel" value={paymentInfo.om?.number || ''} onChange={(e) => handleFieldChange('om', 'number', e.target.value)} onBlur={(e) => handleFieldBlur('om', 'number', e.target.value)} className={`flex-1 px-4 py-3 border border-gray-300 rounded-r-md shadow-sm focus:ring-primary focus:border-primary text-sm ${errors.omNumber ? 'border-red-300' : ''}`} placeholder="612345678" />
                </div>
              </div>
              {errors.omNumber && (<p className="mt-2 text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} />{errors.omNumber}</p>)}
              {paymentInfo.om?.number && !errors.omNumber && (<p className="mt-2 text-sm text-gray-500">{formatCameroonPhone(paymentInfo.om.number)}</p>)}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">{t('name', language)}</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><User size={18} className="text-gray-400" /></div>
                <input type="text" value={paymentInfo.om?.name || ''} onChange={(e) => handleFieldChange('om', 'name', e.target.value)} onBlur={(e) => handleFieldBlur('om', 'name', e.target.value)} className={`pl-12 pr-4 py-3 block w-full border rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm ${errors.omName ? 'border-red-300' : 'border-gray-300'}`} placeholder="e.g. John Doe" />
                {paymentInfo.om?.name && paymentInfo.om.name.trim().length >= 2 && (<div className="absolute inset-y-0 right-0 pr-4 flex items-center"><CheckCircle size={18} className="text-green-500" /></div>)}
              </div>
              {errors.omName && (<p className="mt-2 text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} />{errors.omName}</p>)}
            </div>
          </div>
        </div>
      </div>

      {/* Merchant Codes Section */}
      <div className="mb-10">
        <h3 className="text-lg font-bold text-gray-900 mb-4">{t('merchant_codes', language)}</h3>
        <div className="mb-4">
          <h4 className="text-md font-semibold text-gray-900 mb-2">{t('mtn_merchant_code', language)}</h4>
          <input type="text" value={typeof mtnMerchantCode === 'string' ? mtnMerchantCode : (paymentInfo.mtnMerchantCode || '')} onChange={e => setMtnMerchantCode ? setMtnMerchantCode(e.target.value) : onPaymentInfoChange({ ...paymentInfo, mtnMerchantCode: e.target.value })} className="w-full border border-gray-300 rounded-md p-2" placeholder={t('mtn_merchant_code_placeholder', language)} />
        </div>
        <div className="mb-4">
          <h4 className="text-md font-semibold text-gray-900 mb-2">{t('orange_merchant_code', language)}</h4>
          <input type="text" value={typeof orangeMerchantCode === 'string' ? orangeMerchantCode : (paymentInfo.orangeMerchantCode || '')} onChange={e => setOrangeMerchantCode ? setOrangeMerchantCode(e.target.value) : onPaymentInfoChange({ ...paymentInfo, orangeMerchantCode: e.target.value })} className="w-full border border-gray-300 rounded-md p-2" placeholder={t('orange_merchant_code_placeholder', language)} />
        </div>
      </div>

      {/* Payment Links Section */}
      <div className="mb-10">
        <h3 className="text-lg font-bold text-gray-900 mb-4">{t('payment_link', language)}</h3>
        <input type="text" value={typeof paymentLink === 'string' ? paymentLink : (paymentInfo.paymentLink || '')} onChange={e => setPaymentLink ? setPaymentLink(e.target.value) : onPaymentInfoChange({ ...paymentInfo, paymentLink: e.target.value })} className="w-full border border-gray-300 rounded-md p-2" placeholder={t('payment_link_placeholder', language)} />
      </div>

      {/* Delivery Fees Section */}
      <div className="mb-10">
        <h3 className="text-lg font-bold text-gray-900 mb-4">{t('delivery_fee', language)}</h3>
        <input type="number" min="0" value={typeof deliveryFee === 'number' ? deliveryFee : ''} onChange={e => onDeliveryFeeChange && onDeliveryFeeChange(Number(e.target.value))} className="w-full border border-gray-300 rounded-md p-2" placeholder={t('delivery_fee_placeholder', language)} />
      </div>

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <CheckCircle size={20} className="text-blue-500 mt-0.5" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-blue-900">{t('payment_setup_complete', language)}</h4>
            <p className="text-sm text-blue-700 mt-2">
              {hasValidPaymentInfo() 
                ? t('payment_info_included', language)
                : t('add_payment_method', language)
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSetup; 