import { Sale, Product } from '../../types/models';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

interface InvoiceProps {
  sale: Sale;
  products: Product[];
}

const Invoice = ({ sale, products }: InvoiceProps) => {
  const { company } = useAuth();
  const { t, i18n } = useTranslation();

  const formatDate = (timestamp: any) => {
    if (!timestamp?.seconds) return 'N/A';
    return format(new Date(timestamp.seconds * 1000), 'PPP', { 
      locale: i18n.language === 'fr' ? fr : undefined 
    });
  };

  const calculateSubtotal = () => {
    return sale.products.reduce((total, product) => {
      const price = product.negotiatedPrice || product.basePrice;
      return total + (price * product.quantity);
    }, 0);
  };

  // Helper to format sale number from timestamp
  const getSaleNumber = (timestamp: any) => {
    if (!timestamp?.seconds) return 'N/A';
    const date = new Date(timestamp.seconds * 1000);
    // Format as YYYYMMDDHHMMSS
    const pad = (n: number) => n.toString().padStart(2, '0');
    return (
      date.getFullYear().toString() +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) +
      pad(date.getHours()) +
      pad(date.getMinutes()) +
      pad(date.getSeconds())
    );
  };

  if (!company) {
    return (
      <div className="p-4 text-red-600">
        {t('invoice.errors.companyInfo')}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 w-full max-w-4xl mx-auto bg-white" id="invoice-content">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-8">
        <div className="mb-4 md:mb-0 flex items-start space-x-4">
          {company.logo && (
            <img 
              src={company.logo} 
              alt={`${company.name} logo`}
              className="w-16 h-16 object-contain"
            />
          )}
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">{company.name}</h1>
            <p className="text-sm md:text-base text-gray-600">{company.location || t('invoice.locationNotSpecified')}</p>
            <p className="text-sm md:text-base text-gray-600">{t('invoice.phone')}: {company.phone}</p>
            {company.email && <p className="text-sm md:text-base text-gray-600">Email: {company.email}</p>}
          </div>
        </div>
        <div className="text-left md:text-right">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900">{t('invoice.title')}</h2>
          <p className="text-sm md:text-base text-gray-600">{t('invoice.number')} {getSaleNumber(sale.createdAt)}</p>
          <p className="text-sm md:text-base text-gray-600">{t('invoice.date')}: {formatDate(sale.createdAt)}</p>
        </div>
      </div>

      {/* Customer Info */}
      <div className="mb-8">
        <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-2">{t('invoice.customer')}</h3>
        <div className="bg-gray-50 p-3 md:p-4 rounded-lg">
          <p className="font-medium text-gray-900">{sale.customerInfo.name}</p>
          <p className="text-sm md:text-base text-gray-600">{t('invoice.phone')}: {sale.customerInfo.phone}</p>
          {sale.customerInfo.quarter && (
            <p className="text-sm md:text-base text-gray-600">{t('invoice.quarter')}: {sale.customerInfo.quarter}</p>
          )}
        </div>
      </div>

      {/* Products Table */}
      <div className="mb-8 overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-medium text-gray-500">{t('invoice.products.name')}</th>
              <th className="text-right py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-medium text-gray-500">{t('invoice.products.quantity')}</th>
              <th className="text-right py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-medium text-gray-500">{t('invoice.products.unitPrice')}</th>
              <th className="text-right py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-medium text-gray-500">{t('invoice.products.total')}</th>
            </tr>
          </thead>
          <tbody>
            {sale.products.map((saleProduct, index) => {
              const product = products.find(p => p.id === saleProduct.productId);
              const unitPrice = saleProduct.negotiatedPrice || saleProduct.basePrice;
              const total = unitPrice * saleProduct.quantity;
              return (
                <tr key={index} className="border-b border-gray-100">
                  <td className="py-2 md:py-3 px-2 md:px-4 text-sm text-gray-900">{product?.name || t('invoice.products.unknown')}</td>
                  <td className="py-2 md:py-3 px-2 md:px-4 text-sm text-gray-900 text-right">{saleProduct.quantity}</td>
                  <td className="py-2 md:py-3 px-2 md:px-4 text-sm text-gray-900 text-right">{unitPrice.toLocaleString()} XAF</td>
                  <td className="py-2 md:py-3 px-2 md:px-4 text-sm text-gray-900 text-right">{total.toLocaleString()} XAF</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-full md:w-64">
          <div className="space-y-2">
            <div className="flex justify-between text-sm md:text-base text-gray-600">
              <span>{t('invoice.summary.subtotal')}</span>
              <span>{calculateSubtotal().toLocaleString()} XAF</span>
            </div>
            {(sale.deliveryFee ?? 0) > 0 && (
              <div className="flex justify-between text-sm md:text-base text-gray-600">
                <span>{t('invoice.summary.deliveryFee')}</span>
                <span>{(sale.deliveryFee ?? 0).toLocaleString()} XAF</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold text-sm md:text-base text-gray-900">
              <span>{t('invoice.summary.total')}</span>
              <span>{(calculateSubtotal() + (sale.deliveryFee ?? 0)).toLocaleString()} XAF</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 md:mt-12 pt-4 md:pt-8 border-t border-gray-200">
        <p className="text-center text-xs md:text-sm text-gray-500">
          {t('invoice.footer')}
        </p>
      </div>
    </div>
  );
};

export default Invoice; 