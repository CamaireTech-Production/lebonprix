import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getSaleDetails } from '../services/firestore';
import type { SaleDetails } from '../types/models';
import LoadingScreen from '../components/common/LoadingScreen';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import { useProducts } from '../hooks/useFirestore';
import { CheckCircle, Circle } from 'lucide-react';

const STATUS_ORDER = [
  { key: 'commande', label: 'Commande' },
  { key: 'under_delivery', label: 'En cours de livraison' },
  { key: 'paid', label: 'Payé' },
];


const TimelinePage = () => {
  const { id } = useParams<{ id: string }>();
  const [saleDetails, setSaleDetails] = useState<SaleDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const { products } = useProducts();

  useEffect(() => {
    const fetchSaleDetails = async () => {
      if (!id) return;
      try {
        const details = await getSaleDetails(id);
        const transformedDetails: SaleDetails = {
          ...details,
          statusHistory: details.statusHistory || [],
        };
        setSaleDetails(transformedDetails);
      } catch (error) {
        console.error('Failed to fetch sale details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSaleDetails();
  }, [id]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!saleDetails) {
    return (
      <div className="p-4 bg-red-50 text-red-800 rounded-md">
        Error: Sale details not found.
      </div>
    );
  }

  const orderedProduct = products?.find(p => p.id === saleDetails.productId);

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
      {/* Order Details Card */}
      <Card className="mb-8 bg-emerald-50 border-l-4 border-emerald-500">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h2 className="text-lg font-semibold mb-3 text-emerald-700">Customer</h2>
            <p className="mb-2"><span className="font-medium">Name:</span> {saleDetails.customerInfo.name}</p>
            <p className="mb-2"><span className="font-medium">Phone:</span> {saleDetails.customerInfo.phone}</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-3 text-emerald-700">Order</h2>
            <p className="mb-2"><span className="font-medium">Product:</span> {orderedProduct?.name || 'Unknown'}</p>
            <p className="mb-2"><span className="font-medium">Quantity:</span> {saleDetails.quantity}</p>
            <p className="mb-2"><span className="font-medium">Total Amount:</span> {saleDetails.totalAmount.toLocaleString()} XAF</p>
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
                    <div className={`text-lg font-semibold ${isCurrent ? 'text-emerald-700' : isDone ? 'text-gray-900' : 'text-gray-500'}`}>{status.label}</div>
                    {timestamp && (
                      <div className="text-sm text-gray-500 mt-1">
                        {new Date(timestamp).toLocaleString()}
                      </div>
                    )}
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
