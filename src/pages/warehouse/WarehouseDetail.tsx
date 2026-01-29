import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Warehouse as WarehouseIcon, MapPin, Users, Package, ArrowRight } from 'lucide-react';
import { SkeletonTable, Card, Button, Badge } from "@components/common";
import { useWarehouses, useStockTransfers, useProducts } from '@hooks/data/useFirestore';
import { useAuth } from '@contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { getStockBatchesByLocation } from '@services/firestore/stock/stockService';
import type { StockBatch, Product } from '../../types/models';

const WarehouseDetail: React.FC = () => {
  const { t } = useTranslation();
  const { company } = useAuth();
  const { warehouseId, companyId } = useParams<{ warehouseId: string; companyId: string }>();
  const navigate = useNavigate();

  const { warehouses, loading: warehousesLoading, error: warehousesError } = useWarehouses();
  const { products } = useProducts();
  const { transfers, loading: transfersLoading } = useStockTransfers({ warehouseId });

  const [stockBatches, setStockBatches] = React.useState<StockBatch[]>([]);
  const [loadingStock, setLoadingStock] = React.useState(false);
  const [stockError, setStockError] = React.useState<string | null>(null);

  const warehouse = useMemo(
    () => warehouses.find((w) => w.id === warehouseId),
    [warehouses, warehouseId]
  );

  // Load stock batches for this warehouse
  React.useEffect(() => {
    const loadStock = async () => {
      if (!company?.id || !warehouseId) return;
      try {
        setLoadingStock(true);
        setStockError(null);
        const batches = await getStockBatchesByLocation(company.id, 'product', undefined, warehouseId, 'warehouse');
        setStockBatches(batches as StockBatch[]);
      } catch (error: any) {
        console.error('Error loading warehouse stock:', error);
        setStockError(error.message || 'Erreur lors du chargement du stock');
      } finally {
        setLoadingStock(false);
      }
    };

    loadStock();
  }, [company?.id, warehouseId]);

  // Filter and aggregate products with stock for this warehouse
  // Only show products that:
  // 1. Have stock in this warehouse (remainingQuantity > 0)
  // 2. Product exists and is not soft-deleted
  // 3. Product is available
  const productsWithStock = useMemo(() => {
    const productStockMap = new Map<string, { product: Product; stock: number }>();

    stockBatches.forEach((batch) => {
      // Skip if no product ID or no remaining quantity
      if (!batch.productId || !batch.remainingQuantity || batch.remainingQuantity <= 0) {
        return;
      }

      // Find the product
      const product = products.find(p => p.id === batch.productId);
      
      // Skip if product doesn't exist, is deleted, or is unavailable
      if (!product || product.isDeleted === true || product.isAvailable === false) {
        return;
      }

      // Aggregate stock for this product
      const existing = productStockMap.get(batch.productId);
      if (existing) {
        existing.stock += batch.remainingQuantity;
      } else {
        productStockMap.set(batch.productId, {
          product,
          stock: batch.remainingQuantity
        });
      }
    });

    return productStockMap;
  }, [stockBatches, products]);

  if (!warehouseId) {
    return (
      <div className="p-4">
        <Card className="p-4">
          <p className="text-red-600">Warehouse ID manquant dans l'URL.</p>
        </Card>
      </div>
    );
  }

  if (warehousesLoading || transfersLoading || loadingStock) {
    return <SkeletonTable rows={5} />;
  }

  if (warehousesError) {
    return (
      <div className="p-4">
        <Card className="p-4">
          <p className="text-red-600">{warehousesError.message}</p>
        </Card>
      </div>
    );
  }

  if (!warehouse) {
    return (
      <div className="p-4">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => navigate(-1)}
          icon={<ArrowLeft className="h-4 w-4" />}
        >
          Retour
        </Button>
        <Card className="p-4">
          <p className="text-gray-600">Entrepôt introuvable.</p>
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
            onClick={() => navigate(`/company/${companyId || company?.id}/warehouse`)}
            icon={<ArrowLeft className="h-4 w-4" />}
          >
            {t('warehouse.backToList', 'Retour aux entrepôts')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Warehouse Info */}
        <Card className="p-4 space-y-3 lg:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <WarehouseIcon className="h-6 w-6 text-green-600" />
            <h1 className="text-xl font-semibold">{warehouse.name}</h1>
            {warehouse.isDefault && (
              <Badge variant="success" className="text-xs">
                {t('warehouse.default')}
              </Badge>
            )}
          </div>
          {warehouse.location && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin size={14} />
              <span>{warehouse.location}</span>
            </div>
          )}
          {warehouse.address && warehouse.address !== warehouse.location && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin size={14} />
              <span>{warehouse.address}</span>
            </div>
          )}
          <div className="mt-3 space-y-1 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <Users size={14} />
              <span>
                {(warehouse.assignedUsers?.length || 0) + (warehouse.readOnlyUsers?.length || 0)}{' '}
                utilisateurs assignés
              </span>
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:col-span-2">
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase">Produits en stock</p>
              <p className="text-lg font-semibold">{productsWithStock.size}</p>
            </div>
            <Package className="h-6 w-6 text-amber-600" />
          </Card>
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase">Transferts</p>
              <p className="text-lg font-semibold">{transfers.length}</p>
            </div>
            <ArrowRight className="h-6 w-6 text-indigo-600" />
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
        {productsWithStock.size === 0 ? (
          <p className="text-sm text-gray-500">Aucun stock pour cet entrepôt.</p>
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
                {Array.from(productsWithStock.entries()).map(([productId, { product, stock }]) => (
                  <tr key={productId} className="border-b last:border-0">
                    <td className="py-2 pr-4">{product.name}</td>
                    <td className="py-2 pr-4">{stock}</td>
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
            Derniers transferts liés à cet entrepôt
          </h2>
        </div>
        {transfers.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun transfert pour cet entrepôt.</p>
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
                {transfers.slice(0, 10).map((tr) => {
                  const product = products.find(p => p.id === tr.productId);
                  return (
                    <tr key={tr.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{tr.transferType}</td>
                      <td className="py-2 pr-4">{product?.name || tr.productId}</td>
                      <td className="py-2 pr-4">{tr.quantity}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={tr.status === 'completed' ? 'success' : tr.status === 'pending' ? 'warning' : 'danger'}>
                          {tr.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default WarehouseDetail;
