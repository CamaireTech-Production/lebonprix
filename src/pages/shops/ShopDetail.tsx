import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Store, MapPin, Users, Package, TrendingUp, ArrowRight, ShoppingCart } from 'lucide-react';
import { Card, Button, LoadingScreen, Badge } from '@components/common';
import { useShops, useSales, useStockTransfers, useProducts, useStockReplenishmentRequests } from '@hooks/data/useFirestore';
import { useAuth } from '@contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { getStockBatchesByLocation } from '@services/firestore/stock/stockService';
import type { StockBatch } from '../../types/models';
import ReplenishmentRequestModal from '@components/shops/ReplenishmentRequestModal';
import { PermissionButton, usePermissionCheck } from '@components/permissions';
import { RESOURCES } from '@constants/resources';

const ShopDetail: React.FC = () => {
  const { t } = useTranslation();
  const { company } = useAuth();
  const { shopId, companyId } = useParams<{ shopId: string; companyId: string }>();
  const navigate = useNavigate();

  const { shops, loading: shopsLoading, error: shopsError } = useShops();
  const { products } = useProducts();
  const { sales, loading: salesLoading } = useSales();
  const { transfers, loading: transfersLoading } = useStockTransfers({ shopId });
  const { createRequest } = useStockReplenishmentRequests();
  const { canCreate } = usePermissionCheck(RESOURCES.PRODUCTS);

  const [stockBatches, setStockBatches] = React.useState<StockBatch[]>([]);
  const [loadingStock, setLoadingStock] = React.useState(false);
  const [stockError, setStockError] = React.useState<string | null>(null);
  const [isReplenishmentModalOpen, setIsReplenishmentModalOpen] = useState(false);

  const shop = useMemo(
    () => shops.find((s) => s.id === shopId),
    [shops, shopId]
  );

  // Load stock batches for this shop
  React.useEffect(() => {
    const loadStock = async () => {
      if (!company?.id || !shopId) return;
      try {
        setLoadingStock(true);
        setStockError(null);
        const batches = await getStockBatchesByLocation(company.id, 'product', shopId, undefined, 'shop');
        setStockBatches(batches as StockBatch[]);
      } catch (error: any) {
        console.error('Error loading shop stock:', error);
        setStockError(error.message || 'Erreur lors du chargement du stock');
      } finally {
        setLoadingStock(false);
      }
    };

    loadStock();
  }, [company?.id, shopId]);

  const stockByProduct = useMemo(() => {
    const map = new Map<string, number>();
    stockBatches.forEach((batch) => {
      if (!batch.productId) return;
      const current = map.get(batch.productId) || 0;
      map.set(batch.productId, current + (batch.remainingQuantity || 0));
    });
    return map;
  }, [stockBatches]);

  const productIndex = useMemo(() => {
    const index = new Map<string, { name: string }>();
    products.forEach((p) => {
      index.set(p.id, { name: p.name });
    });
    return index;
  }, [products]);

  const shopSales = useMemo(
    () => sales.filter((sale) => sale.shopId === shopId),
    [sales, shopId]
  );

  const totalRevenue = useMemo(
    () => shopSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0),
    [shopSales]
  );

  if (!shopId) {
    return (
      <div className="p-4">
        <Card className="p-4">
          <p className="text-red-600">Shop ID manquant dans l'URL.</p>
        </Card>
      </div>
    );
  }

  if (shopsLoading || salesLoading || transfersLoading || loadingStock) {
    return <LoadingScreen />;
  }

  if (shopsError) {
    return (
      <div className="p-4">
        <Card className="p-4">
          <p className="text-red-600">{shopsError.message}</p>
        </Card>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="p-4">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <Card className="p-4">
          <p className="text-gray-600">Magasin introuvable.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate(`/company/${companyId || company?.id}/shops`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('shops.backToList', 'Retour aux boutiques')}
          </Button>
        </div>
        <div className="flex gap-2">
          <PermissionButton
            resource={RESOURCES.PRODUCTS}
            action="create"
            onClick={() => setIsReplenishmentModalOpen(true)}
            disabled={shop?.isActive === false}
            className="flex items-center gap-2"
          >
            <ShoppingCart size={16} />
            {t('replenishmentRequests.requestReplenishment', 'Demander réapprovisionnement')}
          </PermissionButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Shop Info */}
        <Card className="p-4 space-y-3 lg:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <Store className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-semibold">{shop.name}</h1>
            {shop.isDefault && (
              <Badge variant="success" className="text-xs">
                {t('shops.default')}
              </Badge>
            )}
          </div>
          {shop.location && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin size={14} />
              <span>{shop.location}</span>
            </div>
          )}
          {shop.address && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin size={14} />
              <span>{shop.address}</span>
            </div>
          )}
          <div className="mt-3 space-y-1 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <Users size={14} />
              <span>
                {(shop.assignedUsers?.length || 0) + (shop.readOnlyUsers?.length || 0)}{' '}
                utilisateurs assignés
              </span>
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:col-span-2">
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase">Ventes</p>
              <p className="text-lg font-semibold">{shopSales.length}</p>
            </div>
            <TrendingUp className="h-6 w-6 text-emerald-600" />
          </Card>
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase">Chiffre d'affaires</p>
              <p className="text-lg font-semibold">{totalRevenue.toLocaleString()} FCFA</p>
            </div>
            <ArrowRight className="h-6 w-6 text-indigo-600" />
          </Card>
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase">Transferts</p>
              <p className="text-lg font-semibold">{transfers.length}</p>
            </div>
            <Package className="h-6 w-6 text-amber-600" />
          </Card>
        </div>
      </div>

      {/* Stock by product */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-md font-semibold flex items-center gap-2">
            <Package className="h-4 w-4" />
            Stock par produit
          </h2>
        </div>
        {stockError && (
          <p className="text-red-600 text-sm mb-2">{stockError}</p>
        )}
        {stockByProduct.size === 0 ? (
          <p className="text-sm text-gray-500">Aucun stock pour ce magasin.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">Produit</th>
                  <th className="py-2 pr-4">Quantité</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(stockByProduct.entries()).map(([productId, qty]) => (
                  <tr key={productId} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      {productIndex.get(productId)?.name || productId}
                    </td>
                    <td className="py-2 pr-4">{qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Transfers history */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-md font-semibold flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            Derniers transferts liés à ce magasin
          </h2>
        </div>
        {transfers.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun transfert pour ce magasin.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Produit</th>
                  <th className="py-2 pr-4">Quantité</th>
                  <th className="py-2 pr-4">Statut</th>
                </tr>
              </thead>
              <tbody>
                {transfers.slice(0, 10).map((tr) => (
                  <tr key={tr.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{tr.transferType}</td>
                    <td className="py-2 pr-4">{tr.productId}</td>
                    <td className="py-2 pr-4">{tr.quantity}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={tr.status === 'completed' ? 'success' : tr.status === 'pending' ? 'warning' : 'danger'}>
                        {tr.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Replenishment Request Modal */}
      {shop && (
        <ReplenishmentRequestModal
          isOpen={isReplenishmentModalOpen}
          onClose={() => setIsReplenishmentModalOpen(false)}
          onCreateRequest={async (requestData) => {
            await createRequest(requestData);
          }}
          shop={shop}
        />
      )}
    </div>
  );
};

export default ShopDetail;
