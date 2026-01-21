import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Badge, Table, LoadingScreen } from '@components/common';
import { useStockTransfers, useProducts } from '@hooks/data/useFirestore';
import { Plus, ArrowRight, Package } from 'lucide-react';
import StockTransferModal from './StockTransferModal';
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
  const { t } = useTranslation();
  const { transfers, loading, error, createTransfer } = useStockTransfers();
  const { products } = useProducts();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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
      'production_to_warehouse': 'Production → Entrepôt',
      'warehouse_to_shop': 'Entrepôt → Magasin',
      'warehouse_to_warehouse': 'Entrepôt → Entrepôt',
      'shop_to_shop': 'Magasin → Magasin'
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
    // This will be handled by the parent component
    // For now, we'll use the useStockTransfers hook
    // The modal will handle the creation
  };

  if (loading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={`Transferts - ${locationName}`}>
        <LoadingScreen />
      </Modal>
    );
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Transferts - ${locationName}`}
        size="large"
      >
        <div className="space-y-4">
          {/* Header with create button */}
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              {sortedTransfers.length} transfert{sortedTransfers.length > 1 ? 's' : ''} trouvé{sortedTransfers.length > 1 ? 's' : ''}
            </p>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus size={16} />
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
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Produit</th>
                    <th>Type</th>
                    <th>Direction</th>
                    <th>Quantité</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTransfers.map((transfer) => {
                    const product = products?.find(p => p.id === transfer.productId);
                    const isFrom = 
                      (locationType === 'shop' && transfer.fromShopId === locationId) ||
                      (locationType === 'warehouse' && transfer.fromWarehouseId === locationId);
                    const isTo = 
                      (locationType === 'shop' && transfer.toShopId === locationId) ||
                      (locationType === 'warehouse' && transfer.toWarehouseId === locationId);
                    
                    return (
                      <tr key={transfer.id}>
                        <td>
                          {transfer.createdAt?.seconds
                            ? format(new Date(transfer.createdAt.seconds * 1000), 'dd/MM/yyyy HH:mm')
                            : '-'}
                        </td>
                        <td className="font-medium">{product?.name || transfer.productId}</td>
                        <td>{getTransferTypeLabel(transfer.transferType)}</td>
                        <td>
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
                        </td>
                        <td className="font-medium">{transfer.quantity}</td>
                        <td>{getStatusBadge(transfer.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
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
          locationType === 'shop' ? 'warehouse_to_shop' : 'production_to_warehouse'
        }
        onSuccess={() => {
          setIsCreateModalOpen(false);
        }}
      />
    </>
  );
};

export default LocationTransfersModal;

