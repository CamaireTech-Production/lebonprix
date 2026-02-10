import React from 'react';
import { Modal, ModalFooter, Badge, Card } from '@components/common';
import {
    ArrowRight,
    Package,
    Calendar,
    User,
    MapPin,
    FileText,
    Clock,
    Warehouse as WarehouseIcon,
    Store
} from 'lucide-react';
import type { StockTransfer, Product, Shop, Warehouse } from '../../types/models';
import { format } from 'date-fns';
import { formatCreatorName } from '@utils/business/employeeUtils';

interface StockTransferDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    transfer: StockTransfer | null;
    products: Product[];
    shops: Shop[];
    warehouses: Warehouse[];
}

const StockTransferDetailModal: React.FC<StockTransferDetailModalProps> = ({
    isOpen,
    onClose,
    transfer,
    products,
    shops,
    warehouses,
}) => {
    if (!transfer) return null;

    const product = products.find((p) => p.id === transfer.productId);

    const getLocationName = (
        type: 'shop' | 'warehouse',
        id?: string
    ) => {
        if (!id) return 'Inconnu';
        if (type === 'shop') {
            return shops.find((s) => s.id === id)?.name || 'Boutique inconnue';
        }
        return warehouses.find((w) => w.id === id)?.name || 'Entrepôt inconnu';
    };

    const getSourceLocation = () => {
        if (transfer.fromWarehouseId) {
            return { name: getLocationName('warehouse', transfer.fromWarehouseId), icon: <WarehouseIcon size={18} className="text-blue-600" /> };
        }
        if (transfer.fromShopId) {
            return { name: getLocationName('shop', transfer.fromShopId), icon: <Store size={18} className="text-blue-600" /> };
        }
        if (transfer.fromProductionId) {
            return { name: 'Production', icon: <Package size={18} className="text-blue-600" /> };
        }
        return { name: 'Source inconnue', icon: <MapPin size={18} className="text-gray-400" /> };
    };

    const getDestinationLocation = () => {
        if (transfer.toWarehouseId) {
            return { name: getLocationName('warehouse', transfer.toWarehouseId), icon: <WarehouseIcon size={18} className="text-green-600" /> };
        }
        if (transfer.toShopId) {
            return { name: getLocationName('shop', transfer.toShopId), icon: <Store size={18} className="text-green-600" /> };
        }
        return { name: 'Destination inconnue', icon: <MapPin size={18} className="text-gray-400" /> };
    };

    const source = getSourceLocation();
    const destination = getDestinationLocation();

    const getStatusBadge = (status: StockTransfer['status']) => {
        const variants: Record<StockTransfer['status'], 'success' | 'warning' | 'error'> = {
            completed: 'success',
            pending: 'warning',
            cancelled: 'error',
        };
        return (
            <Badge variant={variants[status]}>
                {status === 'completed' ? 'Terminé' : status === 'pending' ? 'En attente' : 'Annulé'}
            </Badge>
        );
    };

    const formatDate = (date: any) => {
        if (!date) return 'N/A';
        // Handle Firestore Timestamp or Date
        const d = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
        return format(d, 'dd/MM/yyyy HH:mm');
    };

    const transferBusinessDate = transfer.date
        ? (transfer.date.seconds ? new Date(transfer.date.seconds * 1000) : new Date(transfer.date))
        : (transfer.createdAt?.seconds ? new Date(transfer.createdAt.seconds * 1000) : new Date());

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Détails du transfert"
            size="lg"
            footer={
                <ModalFooter
                    onCancel={onClose}
                    onConfirm={onClose}
                    confirmText="Fermer"
                    cancelText=""
                />
            }
        >
            <div className="space-y-6">
                {/* Status and ID */}
                <div className="flex justify-between items-center border-b pb-4">
                    <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Référence</p>
                        <p className="text-lg font-bold text-gray-900">#{transfer.id.slice(-8).toUpperCase()}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Statut</p>
                        {getStatusBadge(transfer.status)}
                    </div>
                </div>

                {/* Locations Row */}
                <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
                    <Card className="md:col-span-5 bg-blue-50/30 border-blue-100 shadow-none">
                        <div className="flex flex-col items-center p-2 text-center">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                                {source.icon}
                            </div>
                            <p className="text-xs text-blue-600 font-bold uppercase mb-1">Source</p>
                            <p className="text-sm font-semibold text-gray-900">{source.name}</p>
                        </div>
                    </Card>

                    <div className="md:col-span-1 flex justify-center">
                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                            <ArrowRight size={16} className="text-gray-400" />
                        </div>
                    </div>

                    <Card className="md:col-span-5 bg-green-50/30 border-green-100 shadow-none">
                        <div className="flex flex-col items-center p-2 text-center">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-2">
                                {destination.icon}
                            </div>
                            <p className="text-xs text-green-600 font-bold uppercase mb-1">Destination</p>
                            <p className="text-sm font-semibold text-gray-900">{destination.name}</p>
                        </div>
                    </Card>
                </div>

                {/* Product Info */}
                <Card title="Produit transféré" className="border-gray-200 shadow-none">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <Package size={24} className="text-emerald-600" />
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between">
                                <div>
                                    <p className="text-base font-bold text-gray-900">{product?.name || 'Produit inconnu'}</p>
                                    <p className="text-xs text-gray-500">REF: {product?.reference || 'N/A'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500 font-semibold uppercase">Quantité</p>
                                    <p className="text-xl font-black text-emerald-600">{transfer.quantity}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Informational Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-500">
                                <Calendar size={16} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-semibold">Date du transfert</p>
                                <p className="text-sm font-medium">{format(transferBusinessDate, 'dd MMMM yyyy')}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-500">
                                <Clock size={16} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-semibold">Heure d'enregistrement</p>
                                <p className="text-sm font-medium">{formatDate(transfer.createdAt)}</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-500">
                                <User size={16} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-semibold">Effectué par</p>
                                <p className="text-sm font-medium">{formatCreatorName(transfer.createdBy) || 'Utilisateur inconnu'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notes Section */}
                {transfer.notes && (
                    <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                        <div className="flex items-center gap-2 mb-2">
                            <FileText size={16} className="text-amber-600" />
                            <p className="text-xs font-bold text-amber-800 uppercase">Notes</p>
                        </div>
                        <p className="text-sm text-amber-900 leading-relaxed italic">
                            "{transfer.notes}"
                        </p>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default StockTransferDetailModal;
