import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getCompanyByUserId } from '@services/firestore/firestore';
import { getSaleDetails, subscribeToSaleUpdates } from '@services/firestore/sales/saleService';
import type { SaleDetails, Company } from '../../types/models';
import { SkeletonTable, Card, Badge } from "@components/common";
import { useProducts } from '@hooks/data/useFirestore';
import { CheckCircle, Circle } from 'lucide-react';

const STATUS_ORDER = [
  { key: 'commande', label: 'Commande' },
  { key: 'under_delivery', label: 'En cours de livraison' },
  { key: 'paid', label: 'Payé' },
];

const TimelinePage = () => {
  const { id } = useParams<{ id: string }>();
  const [saleDetails, setSaleDetails] = useState<SaleDetails | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const { products } = useProducts();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const fetchData = async () => {
      if (!id) return;
      try {
        // Set up real-time listener for sale updates
        unsubscribe = subscribeToSaleUpdates(id, (updatedSale: SaleDetails) => {
          const transformedDetails: SaleDetails = {
            ...updatedSale,
            statusHistory: updatedSale.statusHistory || [],
          };
          setSaleDetails(transformedDetails);
        });

        // Initial fetch of sale details
        const details = await getSaleDetails(id);
        const transformedDetails: SaleDetails = {
          ...details,
          statusHistory: details.statusHistory || [],
        };
        setSaleDetails(transformedDetails);

        // Fetch company details using the sale's companyId
        if (details.companyId) {
          const companyData = await getCompanyByUserId(details.companyId);
          setCompany(companyData);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Cleanup subscription when component unmounts
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [id]);

  if (loading) {
    return <SkeletonTable rows={5} />;
  }

  if (!saleDetails) {
    return (
      <div className="p-4 bg-red-50 text-red-800 rounded-md">
        Error: Sale details not found.
      </div>
    );
  }

  // Get all products in the sale
  const saleProducts = saleDetails.products.map(saleProduct => {
    const product = products?.find(p => p.id === saleProduct.productId);
    return {
      ...saleProduct,
      product
    };
  });

  // Map statusHistory to a dictionary for quick lookup
  const statusTimestamps: Record<string, string> = {};
  saleDetails.statusHistory.forEach(s => {
    statusTimestamps[s.status] = s.timestamp;
  });

  // Find the current status index
  const currentStatusIndex = STATUS_ORDER.findIndex(
    s => s.key === saleDetails.status
  );

  return (
    <div className="p-6 max-w-2xl mx-auto bg-gray-50 min-h-screen rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold mb-8 text-emerald-700">Order Tracking</h1>
      
      {/* Combined Info Card */}
      <Card className="mb-8 bg-white">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Company Info */}
          <div className="flex items-start space-x-3">
            {company?.logo && (
              <img 
                src={company.logo} 
                alt={`${company.name} logo`}
                className="w-12 h-12 object-contain"
              />
            )}
            <div>
              <h2 className="text-lg font-semibold mb-2 text-indigo-700">Company</h2>
              <p className="text-sm text-gray-600">{company?.name || 'Loading...'}</p>
              <p className="text-sm text-gray-600">{company?.phone || 'Loading...'}</p>
            </div>
          </div>

          {/* Customer Info */}
          <div>
            <h2 className="text-lg font-semibold mb-2 text-emerald-700">Customer</h2>
            <p className="text-sm text-gray-600">{saleDetails.customerInfo.name}</p>
            <p className="text-sm text-gray-600">{saleDetails.customerInfo.phone}</p>
            {saleDetails.customerInfo.quarter && (
              <p className="text-sm text-gray-600">Quartier: {saleDetails.customerInfo.quarter}</p>
            )}
          </div>

          {/* Order Info */}
          <div>
            <h2 className="text-lg font-semibold mb-2 text-emerald-700">Order #{saleDetails.id}</h2>
            <p className="text-sm text-gray-600">
              Total: {(saleDetails.totalAmount + (saleDetails.deliveryFee || 0)).toLocaleString()} XAF
            </p>
            <p className="text-sm text-gray-600">Status: {saleDetails.status}</p>
          </div>
        </div>
      </Card>

      {/* Products Summary */}
      <Card className="mb-8 bg-white">
        <h2 className="text-lg font-semibold mb-4 text-emerald-700">Ordered Products</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {saleProducts.map((saleProduct, index) => {
              const unitPrice = saleProduct.negotiatedPrice || saleProduct.basePrice;
              const subtotal = unitPrice * saleProduct.quantity;
              return (
                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">{saleProduct.product?.name || 'Unknown Product'}</p>
                      <p className="text-sm text-gray-500">Qty: {saleProduct.quantity}</p>
                      <p className="text-sm text-gray-500">Unit Price: {unitPrice.toLocaleString()} XAF</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-emerald-600">
                        {subtotal.toLocaleString()} XAF
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order Totals */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{saleDetails.totalAmount.toLocaleString()} XAF</span>
              </div>
              {saleDetails.deliveryFee && saleDetails.deliveryFee > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Delivery Fee</span>
                  <span>{saleDetails.deliveryFee.toLocaleString()} XAF</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold text-emerald-700 pt-2 border-t border-gray-200">
                <span>Total Amount</span>
                <span>{(saleDetails.totalAmount + (saleDetails.deliveryFee || 0)).toLocaleString()} XAF</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Timeline Card */}
      <Card className="bg-white">
        <h2 className="text-lg font-semibold mb-6 text-indigo-700">Order Status Timeline</h2>
        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute left-6 top-0 bottom-0 w-1 bg-emerald-100 rounded-full"></div>
          <ul className="space-y-10">
            {STATUS_ORDER.map((status, idx) => {
              const isDone = idx < currentStatusIndex;
              const isCurrent = idx === currentStatusIndex;
              const timestamp = statusTimestamps[status.key];
              return (
                <li key={status.key} className="relative flex items-start">
                  {/* Timeline Icon */}
                  <span className="z-10 flex items-center justify-center w-12 h-12 rounded-full border-4 border-white shadow-lg"
                    style={{
                      background:
                        isDone || isCurrent
                          ? idx === 0
                            ? '#6366f1' // indigo-500
                            : idx === 1
                            ? '#10b981' // emerald-500
                            : '#047857' // emerald-700
                          : '#e5e7eb', // gray-200
                    }}
                  >
                    {isDone || isCurrent ? (
                      <CheckCircle className="w-8 h-8 text-white" />
                    ) : (
                      <Circle className="w-8 h-8 text-gray-300" />
                    )}
                  </span>
                  <div className={`ml-6 flex-1 ${isDone ? 'opacity-100' : isCurrent ? 'opacity-100' : 'opacity-60'}`}>
                    <div className="flex justify-between items-center">
                      <div className={`text-lg font-semibold ${isCurrent ? 'text-emerald-700' : isDone ? 'text-gray-900' : 'text-gray-500'}`}>
                        {status.label}
                      </div>
                      {timestamp && (
                        <div className="text-sm text-gray-500">
                          {new Date(timestamp).toLocaleString()}
                        </div>
                      )}
                    </div>
                    {isCurrent && (
                      <div className="mt-2">
                        <Badge variant="info">Current Status</Badge>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default TimelinePage;
