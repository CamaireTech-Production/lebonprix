import { Sale, Product } from '../../types/models';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';

interface InvoiceProps {
  sale: Sale;
  products: Product[];
}

const Invoice = ({ sale, products }: InvoiceProps) => {
  const { company } = useAuth();

  const formatDate = (timestamp: any) => {
    if (!timestamp?.seconds) return 'N/A';
    return format(new Date(timestamp.seconds * 1000), 'PPP', { locale: fr });
  };

  const calculateSubtotal = () => {
    return sale.products.reduce((total, product) => {
      const price = product.negotiatedPrice || product.basePrice;
      return total + (price * product.quantity);
    }, 0);
  };

  if (!company) {
    return (
      <div className="p-4 text-red-600">
        Company information not available. Please contact support.
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
            <p className="text-sm md:text-base text-gray-600">{company.location || 'Location not specified'}</p>
            <p className="text-sm md:text-base text-gray-600">Tel: {company.phone}</p>
            {company.email && <p className="text-sm md:text-base text-gray-600">Email: {company.email}</p>}
          </div>
        </div>
        <div className="text-left md:text-right">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900">Facture</h2>
          <p className="text-sm md:text-base text-gray-600">N° {sale.id}</p>
          <p className="text-sm md:text-base text-gray-600">Date: {formatDate(sale.createdAt)}</p>
        </div>
      </div>

      {/* Customer Info */}
      <div className="mb-8">
        <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-2">Client</h3>
        <div className="bg-gray-50 p-3 md:p-4 rounded-lg">
          <p className="font-medium text-gray-900">{sale.customerInfo.name}</p>
          <p className="text-sm md:text-base text-gray-600">Tel: {sale.customerInfo.phone}</p>
        </div>
      </div>

      {/* Products Table */}
      <div className="mb-8 overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-medium text-gray-500">Produit</th>
              <th className="text-right py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-medium text-gray-500">Quantité</th>
              <th className="text-right py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-medium text-gray-500">Prix Unitaire</th>
              <th className="text-right py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-medium text-gray-500">Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.products.map((product, index) => {
              const productData = products.find(p => p.id === product.productId);
              const price = product.negotiatedPrice || product.basePrice;
              const total = price * product.quantity;

              return (
                <tr key={index} className="border-b border-gray-100">
                  <td className="py-2 md:py-3 px-2 md:px-4">
                    <p className="font-medium text-sm md:text-base text-gray-900">{productData?.name}</p>
                    {product.negotiatedPrice && (
                      <p className="text-xs md:text-sm text-gray-500">Prix négocié</p>
                    )}
                  </td>
                  <td className="text-right py-2 md:py-3 px-2 md:px-4 text-sm md:text-base text-gray-600">{product.quantity}</td>
                  <td className="text-right py-2 md:py-3 px-2 md:px-4 text-sm md:text-base text-gray-600">{price.toLocaleString()} XAF</td>
                  <td className="text-right py-2 md:py-3 px-2 md:px-4 font-medium text-sm md:text-base text-gray-900">{total.toLocaleString()} XAF</td>
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
              <span>Sous-total</span>
              <span>{calculateSubtotal().toLocaleString()} XAF</span>
            </div>
            {(sale.deliveryFee ?? 0) > 0 && (
              <div className="flex justify-between text-sm md:text-base text-gray-600">
                <span>Frais de livraison</span>
                <span>{(sale.deliveryFee ?? 0).toLocaleString()} XAF</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold text-sm md:text-base text-gray-900">
              <span>Total</span>
              <span>{(calculateSubtotal() + (sale.deliveryFee ?? 0)).toLocaleString()} XAF</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 md:mt-12 pt-4 md:pt-8 border-t border-gray-200">
        <p className="text-center text-xs md:text-sm text-gray-500">
          Merci de votre confiance! Pour toute question, n'hésitez pas à nous contacter.
        </p>
      </div>
    </div>
  );
};

export default Invoice; 