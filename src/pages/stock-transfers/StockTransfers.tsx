import React, { useState, useMemo } from 'react';
import { Plus, ArrowRight, Package, Search, Filter, X } from 'lucide-react';
import { Card, Button, Badge, Modal, ModalFooter, Input, LoadingScreen } from '@components/common';
import { useStockTransfers, useProducts, useShops, useWarehouses } from '@hooks/data/useFirestore';
import { useAuth } from '@contexts/AuthContext';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import { PermissionButton, usePermissionCheck } from '@components/permissions';
import { RESOURCES } from '@constants/resources';
import StockTransferModal from '@components/stock/StockTransferModal';
import type { StockTransfer } from '../../types/models';
import { format } from 'date-fns';

const StockTransfers = () => {
  const { transfers, loading, error, createTransfer, cancelTransfer } = useStockTransfers();
  const { products } = useProducts();
  const { shops } = useShops();
  const { warehouses } = useWarehouses();
  const { user, company } = useAuth();
  const { canCreate } = usePermissionCheck(RESOURCES.PRODUCTS);

  // Modal states
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<StockTransfer['transferType'] | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<StockTransfer['status'] | 'all'>('all');
  const [filterShopId, setFilterShopId] = useState<string | 'all'>('all');
  const [filterWarehouseId, setFilterWarehouseId] = useState<string | 'all'>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');

  // Filter transfers
  const filteredTransfers = useMemo(() => {
    let result = transfers || [];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(transfer => {
        const product = products?.find(p => p.id === transfer.productId);
        return product?.name.toLowerCase().includes(query);
      });
    }

    // Filter by type
    if (filterType !== 'all') {
      result = result.filter(transfer => transfer.transferType === filterType);
    }

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter(transfer => transfer.status === filterStatus);
    }

    // Filter by shop
    if (filterShopId !== 'all') {
      result = result.filter(transfer => 
        transfer.fromShopId === filterShopId || transfer.toShopId === filterShopId
      );
    }

    // Filter by warehouse
    if (filterWarehouseId !== 'all') {
      result = result.filter(transfer => 
        transfer.fromWarehouseId === filterWarehouseId || transfer.toWarehouseId === filterWarehouseId
      );
    }

    // Filter by date range
    if (filterDateFrom) {
      const fromDate = new Date(filterDateFrom);
      result = result.filter(transfer => {
        if (!transfer.createdAt?.seconds) return false;
        const transferDate = new Date(transfer.createdAt.seconds * 1000);
        return transferDate >= fromDate;
      });
    }

    if (filterDateTo) {
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      result = result.filter(transfer => {
        if (!transfer.createdAt?.seconds) return false;
        const transferDate = new Date(transfer.createdAt.seconds * 1000);
        return transferDate <= toDate;
      });
    }

    return result;
  }, [transfers, searchQuery, filterType, filterStatus, filterShopId, filterWarehouseId, filterDateFrom, filterDateTo, products]);

  const handleCreateTransfer = async (transferData: {
    transferType: StockTransfer['transferType'];
    productId: string;
    quantity: number;
    fromWarehouseId?: string;
    fromShopId?: string;
    fromProductionId?: string;
    toWarehouseId?: string;
    toShopId?: string;
    inventoryMethod?: 'FIFO' | 'LIFO';
    notes?: string;
  }) => {
    try {
      await createTransfer(transferData);
      setIsTransferModalOpen(false);
    } catch (error: any) {
      throw error; // Let the modal handle the error display
    }
  };

  const handleCancelTransfer = async () => {
    if (!selectedTransfer || !user) return;

    try {
      await cancelTransfer(selectedTransfer.id);
      showSuccessToast('Transfert annulé avec succès');
      setIsCancelModalOpen(false);
      setSelectedTransfer(null);
    } catch (error: any) {
      showErrorToast(error.message || 'Erreur lors de l\'annulation');
    }
  };

  const getTransferTypeLabel = (type: StockTransfer['transferType']): string => {
    const labels: Record<StockTransfer['transferType'], string> = {
      'warehouse_to_shop': 'Entrepôt → Magasin',
      'warehouse_to_warehouse': 'Entrepôt → Entrepôt',
      'shop_to_shop': 'Magasin → Magasin',
      'shop_to_warehouse': 'Magasin → Entrepôt'
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: StockTransfer['status']) => {
    const variants: Record<StockTransfer['status'], 'success' | 'warning' | 'danger'> = {
      'completed': 'success',
      'pending': 'warning',
      'cancelled': 'danger'
    };
    return (
      <Badge variant={variants[status]}>
        {status === 'completed' ? 'Terminé' : status === 'pending' ? 'En attente' : 'Annulé'}
      </Badge>
    );
  };

  const getLocationName = (locationId: string, type: 'shop' | 'warehouse'): string => {
    if (type === 'shop') {
      const shop = shops?.find(s => s.id === locationId);
      return shop?.name || locationId;
    } else {
      const warehouse = warehouses?.find(w => w.id === locationId);
      return warehouse?.name || locationId;
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Transferts de Stock</h1>
          <p className="text-gray-600 mt-1">Gérez les transferts entre vos emplacements</p>
        </div>
        <PermissionButton
          resource={RESOURCES.PRODUCTS}
          action="create"
          onClick={() => setIsTransferModalOpen(true)}
          icon={<Plus size={20} />}
        >
          <span className="hidden sm:inline">Nouveau Transfert</span>
          <span className="sm:hidden">Nouveau</span>
        </PermissionButton>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <Input
              type="text"
              placeholder="Rechercher un produit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as StockTransfer['transferType'] | 'all')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les types</option>
              <option value="warehouse_to_shop">Entrepôt → Magasin</option>
              <option value="warehouse_to_warehouse">Entrepôt → Entrepôt</option>
              <option value="shop_to_shop">Magasin → Magasin</option>
              <option value="shop_to_warehouse">Magasin → Entrepôt</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as StockTransfer['status'] | 'all')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les statuts</option>
              <option value="completed">Terminé</option>
              <option value="pending">En attente</option>
              <option value="cancelled">Annulé</option>
            </select>
          </div>
        </div>

        {/* Active Filters */}
        {(searchQuery || filterType !== 'all' || filterStatus !== 'all' || 
          filterShopId !== 'all' || filterWarehouseId !== 'all' || filterDateFrom || filterDateTo) && (
          <div className="flex flex-wrap gap-2 mt-4">
            {searchQuery && (
              <Badge variant="default" className="flex items-center gap-1">
                Recherche: {searchQuery}
                <button onClick={() => setSearchQuery('')} className="ml-1">
                  <X size={14} />
                </button>
              </Badge>
            )}
            {filterType !== 'all' && (
              <Badge variant="default" className="flex items-center gap-1">
                Type: {getTransferTypeLabel(filterType)}
                <button onClick={() => setFilterType('all')} className="ml-1">
                  <X size={14} />
                </button>
              </Badge>
            )}
            {filterStatus !== 'all' && (
              <Badge variant="default" className="flex items-center gap-1">
                Statut: {filterStatus}
                <button onClick={() => setFilterStatus('all')} className="ml-1">
                  <X size={14} />
                </button>
              </Badge>
            )}
            {filterShopId !== 'all' && (
              <Badge variant="default" className="flex items-center gap-1">
                Boutique: {shops?.find(s => s.id === filterShopId)?.name || filterShopId}
                <button onClick={() => setFilterShopId('all')} className="ml-1">
                  <X size={14} />
                </button>
              </Badge>
            )}
            {filterWarehouseId !== 'all' && (
              <Badge variant="default" className="flex items-center gap-1">
                Entrepôt: {warehouses?.find(w => w.id === filterWarehouseId)?.name || filterWarehouseId}
                <button onClick={() => setFilterWarehouseId('all')} className="ml-1">
                  <X size={14} />
                </button>
              </Badge>
            )}
            {filterDateFrom && (
              <Badge variant="default" className="flex items-center gap-1">
                Du: {filterDateFrom}
                <button onClick={() => setFilterDateFrom('')} className="ml-1">
                  <X size={14} />
                </button>
              </Badge>
            )}
            {filterDateTo && (
              <Badge variant="default" className="flex items-center gap-1">
                Au: {filterDateTo}
                <button onClick={() => setFilterDateTo('')} className="ml-1">
                  <X size={14} />
                </button>
              </Badge>
            )}
          </div>
        )}
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="p-4 bg-red-50 border border-red-200">
          <div className="text-red-700">
            <p className="font-medium">Erreur lors du chargement des transferts</p>
            <p className="text-sm mt-1">{error.message}</p>
            {error.message?.includes('Index requis') && (
              <div className="mt-3 p-3 bg-white rounded border border-red-200">
                <p className="text-xs font-medium mb-2">Pour créer l'index requis :</p>
                <ol className="text-xs list-decimal list-inside space-y-1 text-gray-700">
                  <li>Ouvrez la <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Firebase Console</a></li>
                  <li>Allez dans Firestore Database → Indexes</li>
                  <li>Cliquez sur "Create Index"</li>
                  <li>Collection ID: <code className="bg-gray-100 px-1 rounded">stockTransfers</code></li>
                  <li>Champs à indexer:
                    <ul className="list-disc list-inside ml-4 mt-1">
                      <li><code className="bg-gray-100 px-1 rounded">companyId</code> (Ascending)</li>
                      <li><code className="bg-gray-100 px-1 rounded">createdAt</code> (Descending)</li>
                    </ul>
                  </li>
                  <li>Cliquez sur "Create"</li>
                </ol>
                <p className="text-xs mt-2 text-gray-600">
                  L'index sera créé automatiquement. Cela peut prendre quelques minutes.
                </p>
              </div>
            )}
            <p className="text-xs mt-2 text-red-600">
              Vérifiez la console du navigateur pour plus de détails.
            </p>
          </div>
        </Card>
      )}

      {/* Transfers List */}
      {loading ? (
        <Card className="p-8 text-center">
          <div className="text-gray-500">Chargement des transferts...</div>
        </Card>
      ) : filteredTransfers.length === 0 ? (
        <Card className="p-8 text-center">
          <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun transfert</h3>
          <p className="text-gray-600 mb-4">
            {searchQuery || filterType !== 'all' || filterStatus !== 'all'
              ? 'Aucun transfert ne correspond à vos filtres'
              : 'Commencez par créer votre premier transfert'}
          </p>
          {!searchQuery && filterType === 'all' && filterStatus === 'all' && (
            <PermissionButton
              resource={RESOURCES.PRODUCTS}
              action="create"
              onClick={() => setIsTransferModalOpen(true)}
              icon={<Plus size={20} />}
            >
              Créer un transfert
            </PermissionButton>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destination</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTransfers.map((transfer) => {
                  if (!transfer || !transfer.id) {
                    console.warn('Invalid transfer data:', transfer);
                    return null;
                  }
                  const product = products?.find(p => p.id === transfer.productId);
                  return (
                    <tr key={transfer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transfer.createdAt?.seconds
                          ? format(new Date(transfer.createdAt.seconds * 1000), 'dd/MM/yyyy HH:mm')
                          : transfer.createdAt
                          ? format(new Date(transfer.createdAt as any), 'dd/MM/yyyy HH:mm')
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {product?.name || transfer.productId || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transfer.transferType ? getTransferTypeLabel(transfer.transferType) : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transfer.fromWarehouseId && (
                          <span>📦 {getLocationName(transfer.fromWarehouseId, 'warehouse')}</span>
                        )}
                        {transfer.fromShopId && (
                          <span>🏪 {getLocationName(transfer.fromShopId, 'shop')}</span>
                        )}
                        {transfer.fromProductionId && (
                          <span>🏭 Production {transfer.fromProductionId.slice(0, 8)}</span>
                        )}
                        {!transfer.fromWarehouseId && !transfer.fromShopId && !transfer.fromProductionId && (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transfer.toWarehouseId && (
                          <span>📦 {getLocationName(transfer.toWarehouseId, 'warehouse')}</span>
                        )}
                        {transfer.toShopId && (
                          <span>🏪 {getLocationName(transfer.toShopId, 'shop')}</span>
                        )}
                        {!transfer.toWarehouseId && !transfer.toShopId && (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {transfer.quantity || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getStatusBadge(transfer.status || 'completed')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transfer.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedTransfer(transfer);
                              setIsCancelModalOpen(true);
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            Annuler
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Transfer Modal */}
      <StockTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onCreateTransfer={handleCreateTransfer}
        onSuccess={() => {
          // Refresh will happen automatically via subscription
        }}
      />

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => {
          setIsCancelModalOpen(false);
          setSelectedTransfer(null);
        }}
        title="Annuler le Transfert"
        footer={
          <ModalFooter
            onCancel={() => {
              setIsCancelModalOpen(false);
              setSelectedTransfer(null);
            }}
            onConfirm={handleCancelTransfer}
            cancelText="Non"
            confirmText="Oui, annuler"
            variant="danger"
          />
        }
      >
        <p className="text-gray-700">
          Êtes-vous sûr de vouloir annuler ce transfert ? Cette action est irréversible.
        </p>
      </Modal>
    </div>
  );
};

export default StockTransfers;

