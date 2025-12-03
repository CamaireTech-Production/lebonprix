import { X, CreditCard, Smartphone, DollarSign, ChevronDown, ChevronUp, User, Calendar, Truck, FileText, Percent, Printer, Receipt } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useCustomerSources } from '../../hooks/useCustomerSources';
import Select from 'react-select';
import Input from '../common/Input';
import { ImageWithSkeleton } from '../common/ImageWithSkeleton';
import type { OrderStatus } from '../../types/models';
import type { CartItem } from '../../hooks/usePOS';

export interface POSPaymentData {
  // Payment
  paymentMethod: 'cash' | 'mobile_money' | 'card';
  amountReceived?: number;
  change?: number;
  transactionReference: string; // Empty string if not provided
  mobileMoneyPhone: string; // Empty string if not provided
  
  // Customer Info
  customerPhone: string; // Always string, can be empty
  customerName: string;
  customerQuarter: string; // Always string, can be empty
  customerSourceId: string; // Empty string if not provided
  customerAddress: string; // Empty string if not provided
  customerTown: string; // Empty string if not provided
  
  // Sale Info
  saleDate: string;
  deliveryFee: number;
  status: OrderStatus;
  inventoryMethod: 'fifo' | 'lifo';
  
  // Additional
  discountType?: 'amount' | 'percentage';
  discountValue?: number;
  promoCode: string; // Empty string if not provided
  tax?: number;
  notes: string; // Empty string if not provided
  printReceipt?: boolean;
}

interface POSPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtotal: number;
  currentDeliveryFee: number;
  cart: CartItem[];
  currentCustomer: {
    name: string;
    phone: string;
    quarter?: string;
    address?: string;
    town?: string;
    sourceId?: string;
  } | null;
  onComplete: (data: POSPaymentData) => void;
  isSubmitting: boolean;
}

export const POSPaymentModal: React.FC<POSPaymentModalProps> = ({
  isOpen,
  onClose,
  subtotal,
  currentDeliveryFee,
  cart,
  currentCustomer,
  onComplete,
  isSubmitting,
}) => {
  // ✅ ALL HOOKS MUST BE CALLED FIRST - BEFORE ANY CONDITIONAL RETURNS
  const { t } = useTranslation();
  const { company } = useAuth();
  const { activeSources } = useCustomerSources();
  
  // State for all form fields
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile_money' | 'card' | null>(null);
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [transactionReference, setTransactionReference] = useState<string>('');
  const [mobileMoneyPhone, setMobileMoneyPhone] = useState<string>('');
  
  // Customer Info
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerQuarter, setCustomerQuarter] = useState<string>('');
  const [customerSourceId, setCustomerSourceId] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [customerTown, setCustomerTown] = useState<string>('');
  
  // Sale Info
  const [saleDate, setSaleDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [deliveryFee, setDeliveryFee] = useState<number>(currentDeliveryFee);
  const [status, setStatus] = useState<OrderStatus>('paid');
  const [inventoryMethod, setInventoryMethod] = useState<'fifo' | 'lifo'>('fifo');
  
  // Additional
  const [discountType, setDiscountType] = useState<'amount' | 'percentage'>('amount');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [promoCode, setPromoCode] = useState<string>('');
  const [tax, setTax] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [printReceipt, setPrintReceipt] = useState<boolean>(false);
  
  // UI State
  const [showCustomerSection, setShowCustomerSection] = useState<boolean>(false);
  const [showSaleInfoSection, setShowSaleInfoSection] = useState<boolean>(false);
  const [showAdditionalSection, setShowAdditionalSection] = useState<boolean>(false);

  // Get company colors
  const getCompanyColors = () => {
    const colors = {
      primary: company?.dashboardColors?.primary || company?.primaryColor || '#183524',
      secondary: company?.dashboardColors?.secondary || company?.secondaryColor || '#e2b069',
      tertiary: company?.dashboardColors?.tertiary || company?.tertiaryColor || '#2a4a3a'
    };
    return colors;
  };

  const colors = getCompanyColors();

  // Initialize form with current customer data
  useEffect(() => {
    if (isOpen && currentCustomer) {
      setCustomerPhone(currentCustomer.phone || '');
      setCustomerName(currentCustomer.name || '');
      setCustomerQuarter(currentCustomer.quarter || '');
      setCustomerSourceId(currentCustomer.sourceId || '');
      setCustomerAddress(currentCustomer.address || '');
      setCustomerTown(currentCustomer.town || '');
    }
  }, [isOpen, currentCustomer]);

  // Reset delivery fee when modal opens
  useEffect(() => {
    if (isOpen) {
      setDeliveryFee(currentDeliveryFee);
    }
  }, [isOpen, currentDeliveryFee]);

  // ✅ NOW we can do conditional return AFTER all hooks
  if (!isOpen) return null;

  // Calculate totals
  const discountAmount = discountValue ? (
    discountType === 'amount' 
      ? parseFloat(discountValue) 
      : (subtotal * parseFloat(discountValue)) / 100
  ) : 0;
  
  const taxAmount = tax ? parseFloat(tax) : 0;
  const total = subtotal + deliveryFee - discountAmount + taxAmount;
  const change = paymentMethod === 'cash' && amountReceived 
    ? Math.max(0, parseFloat(amountReceived) - total)
    : 0;

  const handleComplete = () => {
    if (!paymentMethod) {
      alert(t('pos.payment.errors.selectMethod'));
      return;
    }
    
    if (paymentMethod === 'cash') {
      const received = parseFloat(amountReceived);
      if (isNaN(received) || received < total) {
        alert(t('pos.payment.errors.insufficientAmount'));
        return;
      }
    }
    
    if (paymentMethod === 'mobile_money' && !mobileMoneyPhone) {
      alert(t('pos.payment.errors.mobileMoneyPhone'));
      return;
    }

    // Customer phone is optional for POS system

    const paymentData: POSPaymentData = {
      paymentMethod,
      amountReceived: paymentMethod === 'cash' ? parseFloat(amountReceived) : undefined,
      change: paymentMethod === 'cash' ? change : undefined,
      transactionReference: paymentMethod !== 'cash' ? (transactionReference || '') : '',
      mobileMoneyPhone: paymentMethod === 'mobile_money' ? (mobileMoneyPhone || '') : '',
      customerPhone: customerPhone || '',
      customerName: customerName || t('pos.payment.walkInCustomer'),
      customerQuarter: customerQuarter || '',
      customerSourceId: customerSourceId || '',
      customerAddress: customerAddress || '',
      customerTown: customerTown || '',
      saleDate,
      deliveryFee,
      status,
      inventoryMethod,
      discountType: discountValue ? discountType : undefined,
      discountValue: discountValue ? parseFloat(discountValue) : undefined,
      promoCode: promoCode || '',
      tax: tax ? parseFloat(tax) : undefined,
      notes: notes || '',
      printReceipt,
    };

    onComplete(paymentData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white rounded-lg p-6 max-w-6xl w-full mx-4 my-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h2 className="text-2xl font-semibold">{t('pos.payment.title')}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Two Column Layout */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
          {/* Left Column - Bill Summary & Payment (60%) */}
          <div className="lg:col-span-2 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {/* Products List */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">{t('pos.payment.products')}</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {cart.length === 0 ? (
                    <p className="text-gray-500 text-sm">{t('pos.cart.empty')}</p>
                  ) : (
                    cart.map(item => {
                      const price = item.negotiatedPrice ?? item.product.sellingPrice;
                      const itemTotal = price * item.quantity;
                      return (
                        <div key={item.product.id} className="flex items-center space-x-3 p-2 bg-white rounded border border-gray-200">
                          <div className="w-12 h-12 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                            <ImageWithSkeleton
                              src={item.product.images && item.product.images.length > 0 ? item.product.images[0] : '/placeholder.png'}
                              alt={item.product.name}
                              className="w-full h-full object-cover"
                              placeholder="/placeholder.png"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.product.name}</p>
                            <p className="text-xs text-gray-500">
                              {price.toLocaleString()} XAF × {item.quantity}
                            </p>
                          </div>
                          <div className="font-semibold text-sm" style={{ color: colors.primary }}>
                            {itemTotal.toLocaleString()} XAF
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Total Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('pos.payment.subtotal')}</span>
                    <span className="font-semibold">{subtotal.toLocaleString()} XAF</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('pos.payment.deliveryFee')}</span>
                    <span className="font-semibold">{deliveryFee.toLocaleString()} XAF</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('pos.payment.discount')}</span>
                      <span className="font-semibold text-red-600">-{discountAmount.toLocaleString()} XAF</span>
                    </div>
                  )}
                  {taxAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('pos.payment.tax')}</span>
                      <span className="font-semibold">{taxAmount.toLocaleString()} XAF</span>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-300">
                  <div className="flex justify-between items-center">
                    <div className="text-lg font-medium text-gray-700">{t('pos.payment.totalAmount')}</div>
                    <div className="text-3xl font-bold" style={{ color: colors.primary }}>
                      {total.toLocaleString()} XAF
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3">{t('pos.payment.selectMethod')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => setPaymentMethod('cash')}
                    className={`p-4 border-2 rounded-lg transition-colors flex items-center space-x-3 ${
                      paymentMethod === 'cash'
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <DollarSign size={24} className="text-emerald-600" />
                    <div className="text-left">
                      <div className="font-semibold">{t('pos.payment.cash')}</div>
                      <div className="text-sm text-gray-600">{t('pos.payment.cashDescription')}</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setPaymentMethod('mobile_money')}
                    className={`p-4 border-2 rounded-lg transition-colors flex items-center space-x-3 ${
                      paymentMethod === 'mobile_money'
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Smartphone size={24} className="text-blue-600" />
                    <div className="text-left">
                      <div className="font-semibold">{t('pos.payment.mobileMoney')}</div>
                      <div className="text-sm text-gray-600">{t('pos.payment.mobileMoneyDescription')}</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setPaymentMethod('card')}
                    className={`p-4 border-2 rounded-lg transition-colors flex items-center space-x-3 ${
                      paymentMethod === 'card'
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <CreditCard size={24} className="text-purple-600" />
                    <div className="text-left">
                      <div className="font-semibold">{t('pos.payment.card')}</div>
                      <div className="text-sm text-gray-600">{t('pos.payment.cardDescription')}</div>
                    </div>
                  </button>
                </div>

                {/* Payment Method Specific Fields */}
                {paymentMethod === 'cash' && (
                  <div className="mt-4 space-y-3">
                    <Input
                      label={t('pos.payment.amountReceived')}
                      type="number"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      min={total.toString()}
                      required
                    />
                    {change > 0 && (
                      <div className="p-3 bg-green-50 rounded-lg">
                        <div className="text-sm text-gray-600">{t('pos.payment.change')}</div>
                        <div className="text-xl font-bold text-green-600">{change.toLocaleString()} XAF</div>
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod === 'mobile_money' && (
                  <div className="mt-4 space-y-3">
                    <Input
                      label={t('pos.payment.mobileMoneyPhone')}
                      type="tel"
                      value={mobileMoneyPhone}
                      onChange={(e) => setMobileMoneyPhone(e.target.value)}
                      placeholder="+237 6XX XXX XXX"
                      required
                    />
                    <Input
                      label={t('pos.payment.transactionReference')}
                      type="text"
                      value={transactionReference}
                      onChange={(e) => setTransactionReference(e.target.value)}
                      placeholder={t('pos.payment.transactionReferencePlaceholder')}
                    />
                  </div>
                )}

                {paymentMethod === 'card' && (
                  <div className="mt-4 space-y-3">
                    <Input
                      label={t('pos.payment.transactionReference')}
                      type="text"
                      value={transactionReference}
                      onChange={(e) => setTransactionReference(e.target.value)}
                      placeholder={t('pos.payment.transactionReferencePlaceholder')}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Additional Information (40%) */}
          <div className="lg:col-span-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {/* Customer Information - Always Visible */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <User size={20} className="mr-2" />
              {t('pos.payment.customerInfo')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label={t('pos.payment.customerPhone')}
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder={t('pos.payment.customerPhoneOptional')}
              />
              <Input
                label={t('pos.payment.customerName')}
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <Input
                label={t('pos.payment.customerQuarter')}
                type="text"
                value={customerQuarter}
                onChange={(e) => setCustomerQuarter(e.target.value)}
              />
              {activeSources.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('pos.payment.customerSource')}
                  </label>
                  <Select
                    options={[
                      { value: '', label: t('pos.payment.noSource') },
                      ...activeSources.map(source => ({
                        value: source.id,
                        label: source.name,
                        color: source.color || '#3B82F6'
                      }))
                    ]}
                    value={customerSourceId && activeSources.find(s => s.id === customerSourceId)
                      ? { 
                          value: customerSourceId, 
                          label: activeSources.find(s => s.id === customerSourceId)?.name || '',
                          color: activeSources.find(s => s.id === customerSourceId)?.color || '#3B82F6'
                        }
                      : null
                    }
                    onChange={(option) => setCustomerSourceId(option?.value || '')}
                    formatOptionLabel={({ label, color }) => (
                      <div className="flex items-center gap-2">
                        {color && (
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        )}
                        <span>{label}</span>
                      </div>
                    )}
                    className="react-select-container"
                    classNamePrefix="react-select"
                    isClearable
                    placeholder={t('pos.payment.selectSource')}
                  />
                </div>
              )}
            </div>
            {/* Additional customer fields - Collapsible */}
            <button
              onClick={() => setShowCustomerSection(!showCustomerSection)}
              className="mt-3 text-sm text-gray-600 hover:text-gray-900 flex items-center space-x-1"
            >
              <span>{showCustomerSection ? t('pos.payment.hideAdditional') : t('pos.payment.showAdditional')}</span>
              {showCustomerSection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showCustomerSection && (
              <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label={t('pos.payment.customerAddress')}
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                />
                <Input
                  label={t('pos.payment.customerTown')}
                  type="text"
                  value={customerTown}
                  onChange={(e) => setCustomerTown(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Sale Date and Discount - Always Visible */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar size={16} className="inline mr-2" />
                {t('pos.payment.saleDate')}
              </label>
              <Input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Percent size={16} className="inline mr-2" />
                {t('pos.payment.discount')}
              </label>
              <div className="flex space-x-2">
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as 'amount' | 'percentage')}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
                >
                  <option value="amount">{t('pos.payment.discountAmount')}</option>
                  <option value="percentage">{t('pos.payment.discountPercentage')}</option>
                </select>
                <Input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'amount' ? 'XAF' : '%'}
                  min="0"
                  className="flex-1"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('pos.payment.promoCode')}
              </label>
              <Input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder={t('pos.payment.promoCodePlaceholder')}
              />
            </div>
          </div>


          {/* Sale Information Section (Collapsible) */}
          <div className="border border-gray-200 rounded-lg">
            <button
              onClick={() => setShowSaleInfoSection(!showSaleInfoSection)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Receipt size={20} />
                <span className="font-semibold">{t('pos.payment.saleInfo')}</span>
              </div>
              {showSaleInfoSection ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            {showSaleInfoSection && (
              <div className="p-4 space-y-4 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Truck size={16} className="inline mr-2" />
                      {t('pos.payment.deliveryFee')}
                    </label>
                    <Input
                      type="number"
                      value={deliveryFee.toString()}
                      onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('pos.payment.status')}
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as OrderStatus)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="commande">{t('pos.payment.statusOrder')}</option>
                      <option value="under_delivery">{t('pos.payment.statusDelivery')}</option>
                      <option value="paid">{t('pos.payment.statusPaid')}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('pos.payment.inventoryMethod')}
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        value="fifo"
                        checked={inventoryMethod === 'fifo'}
                        onChange={(e) => setInventoryMethod(e.target.value as 'fifo' | 'lifo')}
                        className="form-radio h-4 w-4"
                        style={{ color: colors.primary }}
                      />
                      <span className="text-sm">FIFO</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        value="lifo"
                        checked={inventoryMethod === 'lifo'}
                        onChange={(e) => setInventoryMethod(e.target.value as 'fifo' | 'lifo')}
                        className="form-radio h-4 w-4"
                        style={{ color: colors.primary }}
                      />
                      <span className="text-sm">LIFO</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Additional Options Section (Collapsible) */}
          <div className="border border-gray-200 rounded-lg">
            <button
              onClick={() => setShowAdditionalSection(!showAdditionalSection)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <FileText size={20} />
                <span className="font-semibold">{t('pos.payment.additionalOptions')}</span>
              </div>
              {showAdditionalSection ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            {showAdditionalSection && (
              <div className="p-4 space-y-4 border-t border-gray-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('pos.payment.tax')}
                  </label>
                  <Input
                    type="number"
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                    placeholder="XAF"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('pos.payment.notes')}
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('pos.payment.notesPlaceholder')}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="printReceipt"
                    checked={printReceipt}
                    onChange={(e) => setPrintReceipt(e.target.checked)}
                    className="h-4 w-4 rounded"
                    style={{ color: colors.primary }}
                  />
                  <label htmlFor="printReceipt" className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <Printer size={16} />
                    <span>{t('pos.payment.printReceipt')}</span>
                  </label>
                </div>
              </div>
            )}
          </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 mt-4 pt-4 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            disabled={isSubmitting}
          >
            {t('pos.payment.cancel')}
          </button>
          <button
            onClick={handleComplete}
            disabled={!paymentMethod || isSubmitting}
            className="flex-1 px-4 py-3 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 font-medium"
            style={{ backgroundColor: colors.primary }}
          >
            {isSubmitting ? t('common.saving') : t('pos.payment.completePayment')}
          </button>
        </div>
      </div>
    </div>
  );
};
