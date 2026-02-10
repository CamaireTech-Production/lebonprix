import React, { useState, useMemo } from 'react';
import { Modal, Button, Badge, Table, SkeletonLoader } from '@components/common';
import { useStockTransfers, useProducts, useShops, useWarehouses } from '@hooks/data/useFirestore';
import { Plus, ArrowRight, Package, Eye } from 'lucide-react';
import StockTransferModal from './StockTransferModal';
import StockTransferDetailModal from './StockTransferDetailModal';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import type { StockTransfer } from '../../types/models';
import { format } from 'date-fns';

interface LocationTransfersModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationType: 'shop' | 'warehouse';
  locationId: string;
  locationName: string;
}

const LocationTransfersModal: React.FC<LocationTransfersModalProps> = ({
  isOpen,
  onClose,
  locationType,
  locationId,
  locationName
}) => {
  const { transfers, loading, error, createTransfer } = useStockTransfers();
  const { products } = useProducts();
  const { shops } = useShops();
  const { warehouses } = useWarehouses();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);

  const handleViewDetails = (transfer: StockTransfer) => {
    setSelectedTransfer(transfer);
    setIsDetailModalOpen(true);
  };

  // Filter transfers related to this location
  const locationTransfers = useMemo(() => {
    if (!transfers) return [];

    return transfers.filter(transfer => {
      // Check if transfer is from this location
      if (locationType === 'shop' && transfer.fromShopId === locationId) {
        return true;
      }
      if (locationType === 'warehouse' && transfer.fromWarehouseId === locationId) {
        return true;
      }

      // Check if transfer is to this location
      if (locationType === 'shop' && transfer.toShopId === locationId) {
        return true;
      }
      if (locationType === 'warehouse' && transfer.toWarehouseId === locationId) {
        return true;
      }

      return false;
    });
  }, [transfers, locationType, locationId]);

  // Sort by date (newest first)
  const sortedTransfers = useMemo(() => {
    return [...locationTransfers].sort((a, b) => {
      const dateA = a.createdAt?.seconds || 0;
      const dateB = b.createdAt?.seconds || 0;
      return dateB - dateA;
    });
  }, [locationTransfers]);

  const getTransferTypeLabel = (type: StockTransfer['transferType']): string => {
    const labels: Record<StockTransfer['transferType'], string> = {
      'warehouse_to_shop': 'Entrepôt → Boutique',
      'warehouse_to_warehouse': 'Entrepôt → Entrepôt',
      'shop_to_shop': 'Boutique → Boutique',
      'shop_to_warehouse': 'Boutique → Entrepôt'
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: StockTransfer['status']) => {
    const variants: Record<StockTransfer['status'], 'success' | 'warning' | 'error'> = {
      'completed': 'success',
      'pending': 'warning',
      'cancelled': 'error'
    };
    return (
      <Badge variant={variants[status]}>
        {status === 'completed' ? 'Terminé' : status === 'pending' ? 'En attente' : 'Annulé'}
      </Badge>
    );
  };

  const columns = useMemo(() => [
    {
      header: 'Date',
      accessor: (transfer: StockTransfer) => transfer.createdAt?.seconds
        ? format(new Date(transfer.createdAt.seconds * 1000), 'dd/MM/yyyy HH:mm')
        : '-'
    },
    {
      header: 'Produit',
      accessor: (transfer: StockTransfer) => {
        const product = products?.find(p => p.id === transfer.productId);
        return product?.name || transfer.productId;
      }
    },
    {
      header: 'Type',
      accessor: (transfer: StockTransfer) => getTransferTypeLabel(transfer.transferType)
    },
    {
      header: 'Direction',
      accessor: (transfer: StockTransfer) => {
        const isFrom =
          (locationType === 'shop' && transfer.fromShopId === locationId) ||
          (locationType === 'warehouse' && transfer.fromWarehouseId === locationId);
        const isTo =
          (locationType === 'shop' && transfer.toShopId === locationId) ||
          (locationType === 'warehouse' && transfer.toWarehouseId === locationId);

        return (
          <div className="flex items-center gap-1">
            {isFrom && (
              <span className="flex items-center gap-1 text-orange-600">
                <ArrowRight size={14} />
                Sortant
              </span>
            )}
            {isTo && (
              <span className="flex items-center gap-1 text-green-600">
                <ArrowRight size={14} className="rotate-180" />
                Entrant
              </span>
            )}
          </div>
        );
      }
    },
    {
      header: 'Quantité',
      accessor: (transfer: StockTransfer) => transfer.quantity,
      className: 'font-medium'
    },
    {
      header: 'Statut',
      accessor: (transfer: StockTransfer) => getStatusBadge(transfer.status)
    },
    {
      header: 'Actions',
      accessor: (transfer: StockTransfer) => (
        <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleViewDetails(transfer)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            title="Voir les détails"
          >
            <Eye size={18} />
          </button>
        </div>
      ),
      className: 'text-center'
    }
  ], [products, locationType, locationId]);

  if (loading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={`Transferts - ${locationName}`}>
        <div className="space-y-4 py-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <SkeletonLoader width="w-16" height="h-4" />
              <SkeletonLoader width="w-24" height="h-4" />
              <SkeletonLoader width="w-20" height="h-5" rounded />
              <SkeletonLoader width="w-24" height="h-4" />
            </div>
          ))}
        </div>
      </Modal>
    );
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Transferts - ${locationName}`}
        size="lg"
      >
        <div className="space-y-4">
          {/* Header with create button */}
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              {sortedTransfers.length} transfert{sortedTransfers.length > 1 ? 's' : ''} trouvé{sortedTransfers.length > 1 ? 's' : ''}
            </p>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              icon={<Plus size={16} />}
            >
              Nouveau transfert
            </Button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error.message}
            </div>
          )}

          {/* Transfers List */}
          {sortedTransfers.length === 0 ? (
            <div className="text-center py-8">
              <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun transfert</h3>
              <p className="text-gray-600 mb-4">
                Aucun transfert n'a été effectué depuis/vers cette localisation
              </p>
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 mx-auto"
              >
                <Plus size={16} />
                Créer un transfert
              </Button>
            </div>
          ) : (
            <Table
              data={sortedTransfers}
              columns={columns as any}
              keyExtractor={(item) => item.id}
              onRowClick={handleViewDetails}
            />
          )}
        </div>
      </Modal>

      {/* Create Transfer Modal */}
      <StockTransferModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateTransfer={async (transferData) => {
          try {
            await createTransfer(transferData);
            showSuccessToast('Transfert créé avec succès');
            setIsCreateModalOpen(false);
          } catch (error: any) {
            showErrorToast(error.message || 'Erreur lors de la création du transfert');
            throw error;
          }
        }}
        initialTransferType={
          locationType === 'shop' ? 'warehouse_to_shop' : 'shop_to_warehouse'
        }
        onSuccess={() => {
          setIsCreateModalOpen(false);
        }}
      />

      {/* Detail Modal */}
      <StockTransferDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        transfer={selectedTransfer}
        products={products || []}
        shops={shops || []}
        warehouses={warehouses || []}
      />
    </>
  );
};

export default LocationTransfersModal;

