import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronLeft, ChevronDown, Package, AlertCircle, Search, Trash2, Settings, AlertTriangle } from 'lucide-react';
import { SkeletonTable, Button, Input, Modal } from "@components/common";
import { useMatieres } from '@hooks/business/useMatieres';
import { useAllStockBatches } from '@hooks/business/useStockBatches';
import { useStockChanges, useSuppliers } from '@hooks/data/useFirestore';
import MatiereRestockModal from '../../components/magasin/MatiereRestockModal';
import MatiereDirectConsumptionModal from '../../components/magasin/MatiereDirectConsumptionModal';
import UnifiedBatchAdjustmentModal from '../../components/magasin/UnifiedBatchAdjustmentModal';
import BatchDeleteModal from '../../components/common/BatchDeleteModal';
import { usePermissionCheck } from '@components/permissions';
import { RESOURCES } from '@constants/resources';
import { getUserById } from '@services/utilities/userService';
import type { Matiere, StockBatch, StockChange } from '../../types/models';

const PAGE_SIZES = [10, 20, 50];

// Skeleton row matching the actual table flexbox structure
const SkeletonRow = () => (
  <div className="animate-pulse border-b border-gray-200">
    <div className="flex items-start px-4 py-3 gap-x-4">
      <div className="w-8 flex-shrink-0 pt-1">
        <div className="w-4 h-4 bg-gray-200 rounded" />
      </div>
      <div className="flex-1 min-w-[150px]">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-1" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
      </div>
      <div className="flex-1 min-w-[100px]">
        <div className="h-4 bg-gray-200 rounded w-2/3" />
      </div>
      <div className="flex-shrink-0 min-w-[100px]">
        <div className="h-4 bg-gray-200 rounded w-1/2" />
      </div>
      <div className="flex-shrink-0 min-w-[120px]">
        <div className="h-4 bg-gray-200 rounded w-2/3" />
      </div>
      <div className="flex-shrink-0 min-w-[180px] flex justify-end items-center gap-2">
        <div className="h-7 w-16 bg-gray-200 rounded" />
        <div className="h-7 w-20 bg-gray-200 rounded" />
      </div>
    </div>
  </div>
);

// Skeleton for expanded batch table
const SkeletonExpanded = () => (
  <div className="animate-pulse bg-gray-50 px-10 py-4">
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-7 gap-4 mb-3">
          {[1, 2, 3, 4, 5, 6, 7].map((col) => (
            <div key={col} className="h-3 bg-gray-200 rounded" />
          ))}
        </div>
        {[1, 2, 3].map((key) => (
          <div key={key} className="grid grid-cols-7 gap-4 py-2 border-b border-gray-200">
            {[1, 2, 3, 4, 5, 6, 7].map((col) => (
              <div key={col} className="h-3 bg-gray-200 rounded" />
            ))}
          </div>
        ))}
      </div>
    </div>
  </div>
);

const formatNumber = (value: number | undefined) =>
  typeof value === 'number' ? value.toLocaleString() : '-';

const Stocks = () => {
  const { t } = useTranslation();
  const { matieres, loading, error: matieresError } = useMatieres();
  const { batches, loading: batchesLoading, error: batchesError } = useAllStockBatches('matiere');
  const { stockChanges } = useStockChanges('matiere');
  const { suppliers } = useSuppliers();
  const { canDelete } = usePermissionCheck(RESOURCES.MAGASIN);

  const [expandedMatiereId, setExpandedMatiereId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  
  // Modal states
  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [directConsumptionModalOpen, setDirectConsumptionModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedMatiere, setSelectedMatiere] = useState<Matiere | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<StockBatch | null>(null);
  const [selectedBatchTotals, setSelectedBatchTotals] = useState<{ remaining: number; total: number } | undefined>(undefined);
  const [userNamesMap, setUserNamesMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    setPage(1);
  }, [search]);

  const filteredMatieres = useMemo(() => {
    if (!search.trim()) return matieres;
    const query = search.toLowerCase();
    return matieres.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        (m.description && m.description.toLowerCase().includes(query))
    );
  }, [matieres, search]);

  const totalPages = Math.max(1, Math.ceil(filteredMatieres.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedMatieres = filteredMatieres.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleExpand = (matiereId: string) => {
    setExpandedMatiereId((prev) => (prev === matiereId ? null : matiereId));
  };

  const batchesByMatiere = useMemo(() => {
    const map = new Map<string, StockBatch[]>();
    batches.forEach((batch) => {
      const matiereId = batch.matiereId || '';
      const arr = map.get(matiereId) || [];
      arr.push(batch);
      map.set(matiereId, arr);
    });
    return map;
  }, [batches]);

  const suppliersMap = useMemo(() => {
    const map = new Map<string, string>();
    suppliers.forEach((supplier) => {
      map.set(supplier.id, supplier.name);
    });
    return map;
  }, [suppliers]);


  const handleRestock = (matiere: Matiere) => {
    setSelectedMatiere(matiere);
    setSelectedBatch(null);
    const matiereBatches = batchesByMatiere.get(matiere.id) || [];
    const remaining = matiereBatches.reduce((sum, b) => sum + (b.remainingQuantity || 0), 0);
    const total = matiereBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
    setSelectedBatchTotals(matiereBatches.length ? { remaining, total } : undefined);
    setExpandedMatiereId(matiere.id || '');
    setRestockModalOpen(true);
  };

  const handleDirectConsumption = (matiere: Matiere) => {
    setSelectedMatiere(matiere);
    setSelectedBatch(null);
    const matiereBatches = batchesByMatiere.get(matiere.id) || [];
    const remaining = matiereBatches.reduce((sum, b) => sum + (b.remainingQuantity || 0), 0);
    const total = matiereBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
    setSelectedBatchTotals(matiereBatches.length ? { remaining, total } : undefined);
    setExpandedMatiereId(matiere.id || '');
    setDirectConsumptionModalOpen(true);
  };

  const handleAdjust = (matiere: Matiere, batch?: StockBatch) => {
    setSelectedMatiere(matiere);
    setSelectedBatch(batch || null);
    const matiereBatches = batchesByMatiere.get(matiere.id || '') || [];
    const remaining = matiereBatches.reduce((sum, b) => sum + (b.remainingQuantity || 0), 0);
    const total = matiereBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
    setSelectedBatchTotals(matiereBatches.length ? { remaining, total } : undefined);
    setExpandedMatiereId(matiere.id || '');
    setAdjustModalOpen(true);
  };

  const handleHistory = (matiere: Matiere) => {
    setSelectedMatiere(matiere);
    setHistoryModalOpen(true);
  };

  const handleDelete = (matiere: Matiere, batch: StockBatch) => {
    setSelectedMatiere(matiere);
    setSelectedBatch(batch);
    setDeleteModalOpen(true);
  };

  const handleModalSuccess = () => {
    // Clear search filter and reset pagination to ensure all matieres are visible after restock
    // Note: useMatieres uses real-time subscription, so data updates automatically
    setSearch('');
    setPage(1);
    setRestockModalOpen(false);
    setDirectConsumptionModalOpen(false);
    setAdjustModalOpen(false);
    setHistoryModalOpen(false);
    setDeleteModalOpen(false);
    setSelectedMatiere(null);
    setSelectedBatch(null);
  };

  const handleModalClose = () => {
    setRestockModalOpen(false);
    setDirectConsumptionModalOpen(false);
    setAdjustModalOpen(false);
    setHistoryModalOpen(false);
    setDeleteModalOpen(false);
    setSelectedMatiere(null);
    setSelectedBatch(null);
  };

  const matiereStockChanges = useMemo(() => {
    if (!selectedMatiere) return [];
    return stockChanges
      .filter((sc: StockChange) => sc.matiereId === selectedMatiere.id)
      .sort((a: StockChange, b: StockChange) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA; // Newest first
      });
  }, [stockChanges, selectedMatiere]);

  // Fetch user names for stock changes
  useEffect(() => {
    const fetchUserNames = async () => {
      if (!matiereStockChanges || matiereStockChanges.length === 0) {
        return;
      }

      const userIds = new Set<string>();
      matiereStockChanges.forEach((change: StockChange) => {
        if (change.userId) {
          userIds.add(change.userId);
        }
      });

      const namesMap = new Map<string, string>();
      const fetchPromises = Array.from(userIds).map(async (userId) => {
        try {
          const user = await getUserById(userId);
          if (user) {
            const fullName = user.username || user.email || userId;
            namesMap.set(userId, fullName);
          } else {
            namesMap.set(userId, userId); // Fallback to userId if user not found
          }
        } catch (error) {
          console.error(`Error fetching user ${userId}:`, error);
          namesMap.set(userId, userId); // Fallback to userId on error
        }
      });

      await Promise.all(fetchPromises);
      setUserNamesMap(namesMap);
    };

    fetchUserNames();
  }, [matiereStockChanges]);

  // Show loading screen on initial load
  if (loading && matieres.length === 0) {
    return <SkeletonTable rows={5} />;
  }

  // Show error state
  if (matieresError) {
    return (
      <div className="p-4">
        <div className="bg-white border border-red-200 rounded-lg shadow-sm p-8">
          <div className="flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('navigation.warehouseMenu.stocksPage.messages.errorLoading')}</h2>
            <p className="text-gray-600 mb-4 max-w-md">
              {matieresError.message || t('navigation.warehouseMenu.stocksPage.messages.failedToLoad')}
            </p>
            <div className="flex space-x-3">
              <Button variant="outline" onClick={() => window.location.reload()}>
                {t('navigation.warehouseMenu.stocksPage.messages.reloadPage')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('navigation.warehouseMenu.stocksPage.title')}</h1>
          <p className="text-sm text-gray-600">
            {t('navigation.warehouseMenu.stocksPage.subtitle')}
          </p>
        </div>
        {/* Refresh button removed - data updates automatically via Firestore subscription */}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="px-4 py-3 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="w-full sm:w-80">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('navigation.warehouseMenu.stocksPage.searchPlaceholder')}
              name="search"
            />
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600">{t('navigation.warehouseMenu.stocksPage.rowsPerPage')}</label>
            <select
              className="rounded-md border border-gray-300 px-2 py-1 text-sm"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)]">
          <div className="w-full">
            <div className="flex items-center px-4 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200 bg-gray-50 sticky top-0 z-10 gap-x-4">
              <div className="w-8 flex-shrink-0" />
              <div className="flex-1 min-w-[150px]">{t('navigation.warehouseMenu.stocksPage.columns.matiere')}</div>
              <div className="flex-1 min-w-[100px]">{t('navigation.warehouseMenu.stocksPage.columns.category')}</div>
              <div className="flex-shrink-0 min-w-[100px] text-right">{t('navigation.warehouseMenu.stocksPage.columns.stock')}</div>
              <div className="flex-shrink-0 min-w-[120px]">{t('navigation.warehouseMenu.stocksPage.columns.batches')}</div>
              <div className="flex-shrink-0 min-w-[180px] text-right">{t('navigation.warehouseMenu.stocksPage.columns.actions')}</div>
            </div>

            {loading && paginatedMatieres.length === 0 ? (
              <>
                {Array.from({ length: pageSize }).map((_, idx) => (
                  <SkeletonRow key={`skeleton-${idx}`} />
                ))}
              </>
            ) : (
              paginatedMatieres.map((matiere) => {
                const matiereBatches = batchesByMatiere.get(matiere.id) || [];
                const activeBatches = matiereBatches.filter((b) => b.status === 'active');
                const depletedBatches = matiereBatches.filter((b) => b.status === 'depleted');
                const batchRemaining = matiereBatches.reduce((sum, b) => sum + (b.remainingQuantity || 0), 0);
                const batchTotal = matiereBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
                return (
                  <div key={matiere.id} className="border-b border-gray-200">
                    <div className="flex items-start px-4 py-3 gap-x-4">
                      <button
                        onClick={() => handleExpand(matiere.id)}
                        className="w-8 flex-shrink-0 text-gray-500 hover:text-gray-700 pt-1"
                        aria-label={t('navigation.warehouseMenu.stocksPage.actions.toggleBatches')}
                      >
                        {expandedMatiereId === matiere.id ? (
                          <ChevronDown size={18} />
                        ) : (
                          <ChevronRight size={18} />
                        )}
                      </button>
                      <div className="flex-1 min-w-[150px] pr-2 overflow-hidden">
                        <div className="font-medium text-gray-900 break-words line-clamp-2">{matiere.name}</div>
                        {matiere.description && (
                          <div className="text-xs text-gray-500 break-words line-clamp-2 mt-1">{matiere.description}</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-[100px] text-sm text-gray-700 break-words pr-2 overflow-hidden">
                        <div className="line-clamp-2">{matiere.refCategorie || '—'}</div>
                      </div>
                      <div className="flex-shrink-0 min-w-[100px] text-sm text-gray-900 whitespace-nowrap text-right pr-2 overflow-hidden">
                        {matiereBatches.length > 0
                          ? (
                              <>
                                {formatNumber(batchRemaining)} / {formatNumber(batchTotal)}
                              </>
                            )
                          : (
                              <>
                                0
                              </>
                            )}
                      </div>
                      <div className="flex-shrink-0 min-w-[120px] text-sm text-gray-900 break-words pr-2 overflow-hidden">
                        <div className="line-clamp-2">{t('navigation.warehouseMenu.stocksPage.status.activeDepleted', { active: activeBatches.length, depleted: depletedBatches.length })}</div>
                      </div>
                      <div className="flex-shrink-0 min-w-[180px] flex justify-end items-center gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleHistory(matiere)}
                          className="whitespace-nowrap"
                        >
                          {t('navigation.warehouseMenu.stocksPage.actions.history')}
                        </Button>
                        {batchRemaining > 0 && (
                          <Button 
                            size="sm"
                            variant="outline"
                            onClick={() => handleDirectConsumption(matiere)}
                            className="whitespace-nowrap"
                          >
                            {t('navigation.warehouseMenu.stocksPage.actions.destock')}
                          </Button>
                        )}
                        <Button 
                          size="sm"
                          onClick={() => handleRestock(matiere)}
                          className="whitespace-nowrap"
                        >
                          {t('navigation.warehouseMenu.stocksPage.actions.restock')}
                        </Button>
                      </div>
                    </div>

                    {expandedMatiereId === matiere.id && (
                      <div className="bg-gray-50 px-10 py-5">
                        {batchesLoading ? (
                          <SkeletonExpanded />
                        ) : batchesError ? (
                          <div className="flex items-center space-x-2 text-sm text-red-600">
                            <AlertCircle size={16} />
                            <span>{t('navigation.warehouseMenu.stocksPage.messages.errorLoadingBatches')}</span>
                          </div>
                        ) : matiereBatches.length === 0 ? (
                          <div className="flex flex-col items-center py-6">
                            <Package className="h-8 w-8 text-gray-400 mb-2" />
                            <p className="text-sm text-gray-600">{t('navigation.warehouseMenu.stocksPage.messages.noBatchesFound')}</p>
                            <p className="text-xs text-gray-500 mt-1">{t('navigation.warehouseMenu.stocksPage.messages.createBatchByRestocking')}</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[960px] table-fixed text-sm text-left text-gray-700">
                              <thead>
                                <tr className="text-xs uppercase text-gray-500 border-b bg-white/60">
                                  <th className="py-3 pr-4 w-52">{t('navigation.warehouseMenu.stocksPage.batchTable.batchId')}</th>
                                  <th className="py-3 pr-4 w-40">{t('navigation.warehouseMenu.stocksPage.batchTable.remainingTotal')}</th>
                                  <th className="py-3 pr-4 w-28">{t('navigation.warehouseMenu.stocksPage.batchTable.status')}</th>
                                  <th className="py-3 pr-4 text-right w-48">{t('navigation.warehouseMenu.stocksPage.batchTable.actions')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {matiereBatches.map((batch) => (
                                  <tr key={batch.id} className="border-b last:border-b-0 bg-white">
                                    <td className="py-3 pr-4 font-mono text-xs text-gray-700 break-all">
                                      {batch.id}
                                    </td>
                                    <td className="py-3 pr-4">
                                      {formatNumber(batch.remainingQuantity)} / {formatNumber(batch.quantity)}
                                    </td>
                                    <td className="py-3 pr-4 capitalize">{batch.status === 'active' ? t('navigation.warehouseMenu.stocksPage.status.active') : t('navigation.warehouseMenu.stocksPage.status.depleted')}</td>
                                    <td className="py-3 pr-4 text-right space-x-3">
                                      {batch.status === 'active' ? (
                                        <>
                                          <Button 
                                            size="sm" 
                                            variant="outline"
                                            className="px-3 py-1.5 text-sm"
                                            onClick={() => handleAdjust(matiere, batch)}
                                            title={t('navigation.warehouseMenu.stocksPage.actions.adjust')}
                                          >
                                            <Settings className="w-4 h-4" />
                                          </Button>
                                          {canDelete && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="px-3 py-1.5 text-sm text-red-600 border-red-300 hover:bg-red-50"
                                              onClick={() => handleDelete(matiere, batch)}
                                              disabled={batch.remainingQuantity > 0}
                                              title={batch.remainingQuantity > 0 ? "Can only delete batches with zero remaining stock" : "Delete batch"}
                                            >
                                              <Trash2 size={14} />
                                            </Button>
                                          )}
                                        </>
                                      ) : (
                                        <div className="flex items-center justify-end space-x-3">
                                          <span className="inline-flex items-center justify-end text-xs text-gray-500">
                                            {t('navigation.warehouseMenu.stocksPage.messages.noActionsDepleted')}
                                          </span>
                                          {canDelete && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="px-3 py-1.5 text-sm text-red-600 border-red-300 hover:bg-red-50"
                                              onClick={() => handleDelete(matiere, batch)}
                                              title="Delete batch"
                                            >
                                              <Trash2 size={14} />
                                            </Button>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {!loading && filteredMatieres.length === 0 && (
              <div className="px-4 py-12 text-center">
                {search.trim() ? (
                  <div className="flex flex-col items-center">
                    <Search className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('navigation.warehouseMenu.stocksPage.messages.noMatieresFound')}</h3>
                    <p className="text-sm text-gray-600 mb-4 max-w-md">
                      {t('navigation.warehouseMenu.stocksPage.messages.noMatieresMatchSearch', { search })}
                    </p>
                    <Button variant="outline" onClick={() => setSearch('')}>
                      {t('navigation.warehouseMenu.stocksPage.messages.clearSearch')}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Package className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('navigation.warehouseMenu.stocksPage.messages.noMatieresYet')}</h3>
                    <p className="text-sm text-gray-600 mb-4 max-w-md">
                      {t('navigation.warehouseMenu.stocksPage.messages.startByAdding')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {filteredMatieres.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-700">
            <div className="flex items-center space-x-2">
              <span>
                {t('navigation.warehouseMenu.stocksPage.messages.showingResults', {
                  from: ((currentPage - 1) * pageSize) + 1,
                  to: Math.min(currentPage * pageSize, filteredMatieres.length),
                  total: filteredMatieres.length
                })}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
                title={t('navigation.warehouseMenu.stocksPage.messages.previous')}
              >
                <ChevronLeft size={16} />
              </Button>
              <div className="flex items-center space-x-1">
                <span className="text-gray-600">{t('navigation.warehouseMenu.stocksPage.messages.page')}</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={currentPage}
                  onChange={(e) => {
                    const pageNum = parseInt(e.target.value);
                    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                      setPage(pageNum);
                    }
                  }}
                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center"
                />
                <span className="text-gray-600">{t('navigation.warehouseMenu.stocksPage.messages.of')} {totalPages}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || loading}
                title={t('navigation.warehouseMenu.stocksPage.messages.next')}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Stock Operation Modals */}
      <MatiereRestockModal
        isOpen={restockModalOpen}
        onClose={handleModalClose}
        matiere={selectedMatiere}
        batchTotals={selectedBatchTotals}
        onSuccess={handleModalSuccess}
      />

      <MatiereDirectConsumptionModal
        isOpen={directConsumptionModalOpen}
        onClose={handleModalClose}
        matiere={selectedMatiere}
        batchTotals={selectedBatchTotals}
        onSuccess={handleModalSuccess}
      />

      <UnifiedBatchAdjustmentModal
        isOpen={adjustModalOpen}
        onClose={handleModalClose}
        matiere={selectedMatiere}
        selectedBatch={selectedBatch}
        batchTotals={selectedBatchTotals}
        onSuccess={handleModalSuccess}
      />

      {/* Stock History Modal */}
      <Modal
        isOpen={historyModalOpen}
        onClose={handleModalClose}
        title={t('navigation.warehouseMenu.stocksPage.historyModal.title', { name: selectedMatiere?.name || '' })}
        size="lg"
      >
        <div className="space-y-4">
          {selectedMatiere && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">{t('navigation.warehouseMenu.stocksPage.historyModal.matiere')}</span>
                  <p className="text-gray-900">{selectedMatiere.name}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">{t('navigation.warehouseMenu.stocksPage.historyModal.currentStock')}</span>
                  <p className="text-gray-900">
                    {batchesByMatiere.get(selectedMatiere.id)?.reduce((sum, b) => sum + (b.remainingQuantity || 0), 0) || 0} {selectedMatiere.unit || 'unité'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">{t('navigation.warehouseMenu.stocksPage.historyModal.columns.date')}</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">{t('navigation.warehouseMenu.stocksPage.historyModal.columns.user')}</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">{t('navigation.warehouseMenu.stocksPage.historyModal.columns.change')}</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">{t('navigation.warehouseMenu.stocksPage.historyModal.columns.reason')}</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">{t('navigation.warehouseMenu.stocksPage.historyModal.columns.supplier')}</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">{t('navigation.warehouseMenu.stocksPage.historyModal.columns.payment')}</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">{t('navigation.warehouseMenu.stocksPage.historyModal.columns.costPrice')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {matiereStockChanges.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      {t('navigation.warehouseMenu.stocksPage.historyModal.noHistoryFound')}
                    </td>
                  </tr>
                ) : (
                  matiereStockChanges.map((change: any) => {
                    const userName = change.userId ? (userNamesMap.get(change.userId) || change.userId) : '—';
                    const supplierName = change.supplierId
                      ? (suppliersMap.get(change.supplierId) || change.supplierId)
                      : change.isOwnPurchase
                      ? t('navigation.warehouseMenu.stocksPage.payment.ownPurchase')
                      : '—';
                    return (
                      <tr key={change.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-700">
                          {change.createdAt?.seconds
                            ? new Date(change.createdAt.seconds * 1000).toLocaleString()
                            : '—'}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {userName}
                        </td>
                        <td className={`px-4 py-2 font-medium ${
                          change.change > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {change.change > 0 ? '+' : ''}{change.change}
                          <span className="ml-1 text-xs text-gray-500">({selectedMatiere?.unit || ''})</span>
                        </td>
                        <td className="px-4 py-2 text-gray-700 capitalize">{change.reason}</td>
                        <td className="px-4 py-2 text-gray-700">{supplierName}</td>
                        <td className="px-4 py-2 text-gray-700">
                          {change.isOwnPurchase ? (
                            '—'
                          ) : change.isCredit ? (
                            <span className="text-red-600">{t('navigation.warehouseMenu.stocksPage.payment.credit')}</span>
                          ) : (
                            <span className="text-green-600">{t('navigation.warehouseMenu.stocksPage.payment.paid')}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {change.costPrice ? `${change.costPrice.toLocaleString()} XAF` : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* Batch Delete Modal */}
      <BatchDeleteModal
        isOpen={deleteModalOpen}
        batch={selectedBatch}
        itemName={selectedMatiere?.name || ''}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
};

export default Stocks;
