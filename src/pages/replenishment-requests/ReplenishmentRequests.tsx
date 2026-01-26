import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingCart, Package, Store, Calendar, Filter, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { Card, Button, Badge, LoadingScreen, Select, Input } from '@components/common';
import { useStockReplenishmentRequests, useShops, useProducts } from '@hooks/data/useFirestore';
import { useAuth } from '@contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useStockTransfers } from '@hooks/data/useFirestore';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import { PermissionButton, usePermissionCheck } from '@components/permissions';
import { RESOURCES } from '@constants/resources';
import StockTransferModal from '@components/stock/StockTransferModal';
import type { StockReplenishmentRequest } from '../../types/models';

const ReplenishmentRequests: React.FC = () => {
  const { t } = useTranslation();
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { company, user, isOwner, effectiveRole } = useAuth();
  const { canCreate } = usePermissionCheck(RESOURCES.PRODUCTS);
  const isActualOwner = isOwner || effectiveRole === 'owner';

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | StockReplenishmentRequest['status']>('all');
  const [shopFilter, setShopFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { requests, loading, error, approveRequest, rejectRequest, fulfillRequest } = useStockReplenishmentRequests();
  const { shops } = useShops();
  const { products } = useProducts();
  const { createTransfer } = useStockTransfers();

  const [selectedRequestForTransfer, setSelectedRequestForTransfer] = useState<StockReplenishmentRequest | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter requests
  const filteredRequests = useMemo(() => {
    let result = [...requests];

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(req => req.status === statusFilter);
    }

    // Shop filter
    if (shopFilter !== 'all') {
      result = result.filter(req => req.shopId === shopFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);

      result = result.filter(req => {
        const reqDate = req.createdAt?.toDate?.() || new Date(req.createdAt);
        if (dateFilter === 'today') {
          return reqDate >= today;
        } else if (dateFilter === 'week') {
          return reqDate >= weekAgo;
        } else if (dateFilter === 'month') {
          return reqDate >= monthAgo;
        }
        return true;
      });
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(req => {
        const product = products.find(p => p.id === req.productId);
        const shop = shops.find(s => s.id === req.shopId);
        return (
          product?.name.toLowerCase().includes(query) ||
          shop?.name.toLowerCase().includes(query) ||
          req.notes?.toLowerCase().includes(query)
        );
      });
    }

    return result;
  }, [requests, statusFilter, shopFilter, dateFilter, searchQuery, products, shops]);

  const handleApprove = async (request: StockReplenishmentRequest) => {
    if (!isActualOwner && !canCreate(RESOURCES.PRODUCTS)) {
      showErrorToast(t('replenishmentRequests.messages.noPermission', 'You do not have permission to approve requests'));
      return;
    }

    setIsProcessing(true);
    try {
      await approveRequest(request.id);
      showSuccessToast(t('replenishmentRequests.messages.approveSuccess', 'Request approved successfully'));
    } catch (error: any) {
      showErrorToast(error.message || t('replenishmentRequests.messages.approveError', 'Error approving request'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (request: StockReplenishmentRequest) => {
    if (!isActualOwner && !canCreate(RESOURCES.PRODUCTS)) {
      showErrorToast(t('replenishmentRequests.messages.noPermission', 'You do not have permission to reject requests'));
      return;
    }

    const reason = prompt(t('replenishmentRequests.rejectReasonPrompt', 'Enter rejection reason (optional):'));
    setIsProcessing(true);
    try {
      await rejectRequest(request.id, reason || undefined);
      showSuccessToast(t('replenishmentRequests.messages.rejectSuccess', 'Request rejected successfully'));
    } catch (error: any) {
      showErrorToast(error.message || t('replenishmentRequests.messages.rejectError', 'Error rejecting request'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFulfill = async (request: StockReplenishmentRequest) => {
    if (!isActualOwner && !canCreate(RESOURCES.PRODUCTS)) {
      showErrorToast(t('replenishmentRequests.messages.noPermission', 'You do not have permission to fulfill requests'));
      return;
    }

    // Open transfer modal to create the transfer
    setSelectedRequestForTransfer(request);
    setIsTransferModalOpen(true);
  };

  const handleCreateTransfer = async (transferData: {
    transferType: 'warehouse_to_shop';
    productId: string;
    quantity: number;
    fromWarehouseId?: string;
    toShopId?: string;
    inventoryMethod?: 'FIFO' | 'LIFO';
    notes?: string;
  }) => {
    if (!selectedRequestForTransfer) return;

    setIsProcessing(true);
    try {
      // Create the transfer
      const transfer = await createTransfer({
        ...transferData,
        transferType: 'warehouse_to_shop',
        productId: selectedRequestForTransfer.productId,
        quantity: selectedRequestForTransfer.quantity,
        toShopId: selectedRequestForTransfer.shopId
      });

      // Fulfill the request and link the transfer
      await fulfillRequest(selectedRequestForTransfer.id, transfer.id);

      showSuccessToast(t('replenishmentRequests.messages.fulfillSuccess', 'Request fulfilled successfully'));
      setIsTransferModalOpen(false);
      setSelectedRequestForTransfer(null);
    } catch (error: any) {
      showErrorToast(error.message || t('replenishmentRequests.messages.fulfillError', 'Error fulfilling request'));
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: StockReplenishmentRequest['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning" className="flex items-center gap-1"><Clock size={12} /> {t('replenishmentRequests.status.pending', 'Pending')}</Badge>;
      case 'approved':
        return <Badge variant="info" className="flex items-center gap-1"><CheckCircle size={12} /> {t('replenishmentRequests.status.approved', 'Approved')}</Badge>;
      case 'rejected':
        return <Badge variant="danger" className="flex items-center gap-1"><XCircle size={12} /> {t('replenishmentRequests.status.rejected', 'Rejected')}</Badge>;
      case 'fulfilled':
        return <Badge variant="success" className="flex items-center gap-1"><CheckCircle size={12} /> {t('replenishmentRequests.status.fulfilled', 'Fulfilled')}</Badge>;
      default:
        return <Badge>{status}</Badge>;
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('replenishmentRequests.title', 'Stock Replenishment Requests')}</h1>
          <p className="text-gray-600 mt-1">{t('replenishmentRequests.subtitle', 'Manage stock replenishment requests from shops')}</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('replenishmentRequests.filters.status', 'Status')}
            </label>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="w-full"
            >
              <option value="all">{t('common.all', 'All')}</option>
              <option value="pending">{t('replenishmentRequests.status.pending', 'Pending')}</option>
              <option value="approved">{t('replenishmentRequests.status.approved', 'Approved')}</option>
              <option value="rejected">{t('replenishmentRequests.status.rejected', 'Rejected')}</option>
              <option value="fulfilled">{t('replenishmentRequests.status.fulfilled', 'Fulfilled')}</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('replenishmentRequests.filters.shop', 'Shop')}
            </label>
            <Select
              value={shopFilter}
              onChange={(e) => setShopFilter(e.target.value)}
              className="w-full"
            >
              <option value="all">{t('common.all', 'All')}</option>
              {shops.filter(s => s.isActive !== false).map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('replenishmentRequests.filters.date', 'Date')}
            </label>
            <Select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}
              className="w-full"
            >
              <option value="all">{t('common.all', 'All')}</option>
              <option value="today">{t('replenishmentRequests.filters.today', 'Today')}</option>
              <option value="week">{t('replenishmentRequests.filters.week', 'This Week')}</option>
              <option value="month">{t('replenishmentRequests.filters.month', 'This Month')}</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('common.search', 'Search')}
            </label>
            <Input
              type="text"
              placeholder={t('replenishmentRequests.filters.searchPlaceholder', 'Search by product, shop...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
      </Card>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error.message}
        </div>
      )}

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <Card className="p-8 text-center">
          <ShoppingCart className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('replenishmentRequests.noRequests', 'No requests found')}</h3>
          <p className="text-gray-600">
            {searchQuery || statusFilter !== 'all' || shopFilter !== 'all' || dateFilter !== 'all'
              ? t('replenishmentRequests.noRequestsMessage', 'No requests match your filters')
              : t('replenishmentRequests.noRequestsEmpty', 'No replenishment requests have been created yet')}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => {
            const product = products.find(p => p.id === request.productId);
            const shop = shops.find(s => s.id === request.shopId);

            return (
              <Card key={request.id} className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      {getStatusBadge(request.status)}
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">{product?.name || request.productId}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-600">{shop?.name || request.shopId}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{request.quantity}</span>
                        <span className="text-sm text-gray-500">{t('replenishmentRequests.units', 'units')}</span>
                      </div>
                    </div>
                    {request.notes && (
                      <p className="text-sm text-gray-600">{request.notes}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar size={12} />
                        <span>
                          {request.createdAt?.toDate?.()?.toLocaleDateString() || 
                           new Date(request.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {request.fulfilledAt && (
                        <div className="flex items-center gap-1">
                          <CheckCircle size={12} />
                          <span>
                            {t('replenishmentRequests.fulfilledAt', 'Fulfilled')}:{' '}
                            {request.fulfilledAt?.toDate?.()?.toLocaleDateString() || 
                             new Date(request.fulfilledAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {request.rejectedReason && (
                        <div className="flex items-center gap-1 text-red-600">
                          <AlertCircle size={12} />
                          <span>{request.rejectedReason}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {request.status === 'pending' && (isActualOwner || canCreate(RESOURCES.PRODUCTS)) && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApprove(request)}
                          disabled={isProcessing}
                          className="flex items-center gap-1"
                        >
                          <CheckCircle size={14} />
                          {t('replenishmentRequests.approve', 'Approve')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReject(request)}
                          disabled={isProcessing}
                          className="flex items-center gap-1 text-red-600"
                        >
                          <XCircle size={14} />
                          {t('replenishmentRequests.reject', 'Reject')}
                        </Button>
                      </>
                    )}
                    {request.status === 'approved' && (isActualOwner || canCreate(RESOURCES.PRODUCTS)) && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleFulfill(request)}
                        disabled={isProcessing}
                        className="flex items-center gap-1"
                      >
                        <Package size={14} />
                        {t('replenishmentRequests.fulfill', 'Fulfill')}
                      </Button>
                    )}
                    {request.status === 'fulfilled' && request.transferId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const cid = companyId || company?.id;
                          if (cid) {
                            navigate(`/company/${cid}/stock-transfers`);
                          }
                        }}
                        className="flex items-center gap-1"
                      >
                        {t('replenishmentRequests.viewTransfer', 'View Transfer')}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Transfer Modal for Fulfilling Request */}
      {selectedRequestForTransfer && (
        <StockTransferModal
          isOpen={isTransferModalOpen}
          onClose={() => {
            setIsTransferModalOpen(false);
            setSelectedRequestForTransfer(null);
          }}
          onCreateTransfer={handleCreateTransfer}
          initialProductId={selectedRequestForTransfer.productId}
          initialTransferType="warehouse_to_shop"
        />
      )}
    </div>
  );
};

export default ReplenishmentRequests;

