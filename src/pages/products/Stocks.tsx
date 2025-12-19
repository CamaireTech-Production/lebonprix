import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, RefreshCcw, Package, AlertCircle, Search } from 'lucide-react';
import { Button, Input, Modal, LoadingScreen } from '@components/common';
import { useInfiniteProducts } from '@hooks/data/useInfiniteProducts';
import { useAllStockBatches } from '@hooks/business/useStockBatches';
import { useStockChanges, useSuppliers } from '@hooks/data/useFirestore';
import ProductRestockModal from '../../components/products/ProductRestockModal';
import ManualAdjustmentModal from '../../components/products/ManualAdjustmentModal';
import DamageAdjustmentModal from '../../components/products/DamageAdjustmentModal';
import type { Product, StockBatch, StockChange } from '../../types/models';

const PAGE_SIZES = [10, 20, 50];

// Skeleton row matching the actual table grid structure
const SkeletonRow = () => (
  <div className="animate-pulse border-b border-gray-200">
    <div className="grid grid-cols-12 items-center px-4 py-3">
      <div className="col-span-1">
        <div className="w-4 h-4 bg-gray-200 rounded" />
      </div>
      <div className="col-span-3">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-1" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
      </div>
      <div className="col-span-2">
        <div className="h-4 bg-gray-200 rounded w-2/3" />
      </div>
      <div className="col-span-2">
        <div className="h-4 bg-gray-200 rounded w-1/2" />
      </div>
      <div className="col-span-2">
        <div className="h-4 bg-gray-200 rounded w-2/3" />
      </div>
      <div className="col-span-2 flex justify-end space-x-2">
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
  const { products, loading, loadingMore, hasMore, loadMore, refresh, error: productsError } = useInfiniteProducts();
  const { batches, loading: batchesLoading, error: batchesError } = useAllStockBatches();
  const { stockChanges } = useStockChanges();
  const { suppliers } = useSuppliers();

  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  
  // Modal states
  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [damageModalOpen, setDamageModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<StockBatch | null>(null);
  const [selectedBatchTotals, setSelectedBatchTotals] = useState<{ remaining: number; total: number } | undefined>(undefined);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const query = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.reference && p.reference.toLowerCase().includes(query))
    );
  }, [products, search]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleExpand = (productId: string) => {
    setExpandedProductId((prev) => (prev === productId ? null : productId));
  };

  const batchesByProduct = useMemo(() => {
    const map = new Map<string, StockBatch[]>();
    batches.forEach((batch) => {
      const productId = batch.productId || '';
      const arr = map.get(productId) || [];
      arr.push(batch);
      map.set(productId, arr);
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

  const handleRestock = (product: Product) => {
    setSelectedProduct(product);
    setSelectedBatch(null);
    const productBatches = batchesByProduct.get(product.id) || [];
    const remaining = productBatches.reduce((sum, b) => sum + (b.remainingQuantity || 0), 0);
    const total = productBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
    setSelectedBatchTotals(productBatches.length ? { remaining, total } : undefined);
    setExpandedProductId(product.id || '');
    setRestockModalOpen(true);
  };

  const handleAdjust = (product: Product, batch?: StockBatch) => {
    setSelectedProduct(product);
    setSelectedBatch(batch || null);
    const productBatches = batchesByProduct.get(product.id || '') || [];
    const remaining = productBatches.reduce((sum, b) => sum + (b.remainingQuantity || 0), 0);
    const total = productBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
    setSelectedBatchTotals(productBatches.length ? { remaining, total } : undefined);
    setExpandedProductId(product.id || '');
    setAdjustModalOpen(true);
  };

  const handleDamage = (product: Product, batch: StockBatch) => {
    setSelectedProduct(product);
    setSelectedBatch(batch);
    const productBatches = batchesByProduct.get(product.id) || [];
    const remaining = productBatches.reduce((sum, b) => sum + (b.remainingQuantity || 0), 0);
    const total = productBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
    setSelectedBatchTotals(productBatches.length ? { remaining, total } : undefined);
    setExpandedProductId(product.id || '');
    setDamageModalOpen(true);
  };

  const handleHistory = (product: Product) => {
    setSelectedProduct(product);
    setHistoryModalOpen(true);
  };

  const handleModalSuccess = () => {
    refresh();
    setRestockModalOpen(false);
    setAdjustModalOpen(false);
    setDamageModalOpen(false);
    setHistoryModalOpen(false);
    setSelectedProduct(null);
    setSelectedBatch(null);
  };

  const handleModalClose = () => {
    setRestockModalOpen(false);
    setAdjustModalOpen(false);
    setDamageModalOpen(false);
    setHistoryModalOpen(false);
    setSelectedProduct(null);
    setSelectedBatch(null);
  };

  const productStockChanges = useMemo(() => {
    if (!selectedProduct) return [];
    return stockChanges
      .filter((sc: StockChange) => sc.productId === selectedProduct.id)
      .sort((a: StockChange, b: StockChange) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA; // Newest first
      });
  }, [stockChanges, selectedProduct]);

  // Show loading screen on initial load
  if (loading && products.length === 0) {
    return <LoadingScreen />;
  }

  // Show error state
  if (productsError) {
    return (
      <div className="p-4">
        <div className="bg-white border border-red-200 rounded-lg shadow-sm p-8">
          <div className="flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Products</h2>
            <p className="text-gray-600 mb-4 max-w-md">
              {productsError.message || 'Failed to load products. Please try again.'}
            </p>
            <div className="flex space-x-3">
              <Button variant="outline" onClick={() => window.location.reload()}>
                Reload Page
              </Button>
              <Button onClick={refresh} icon={<RefreshCcw size={16} />}>
                Retry
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
          <h1 className="text-2xl font-semibold text-gray-900">Stocks</h1>
          <p className="text-sm text-gray-600">
            Manage inventory with batch visibility. Orders do not deduct stock; sales do.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={refresh} icon={<RefreshCcw size={16} />} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="px-4 py-3 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="w-full sm:w-80">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name or reference"
              name="search"
            />
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600">Rows per page</label>
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

        <div className="overflow-x-auto">
          <div className="min-w-[960px]">
            <div className="grid grid-cols-12 px-4 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200 bg-gray-50">
              <div className="col-span-1" />
              <div className="col-span-3">Product</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-2">Stock</div>
              <div className="col-span-2">Batches</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {loading && paginatedProducts.length === 0 ? (
              <>
                {Array.from({ length: pageSize }).map((_, idx) => (
                  <SkeletonRow key={`skeleton-${idx}`} />
                ))}
              </>
            ) : (
              paginatedProducts.map((product) => {
                const productBatches = batchesByProduct.get(product.id) || [];
                const activeBatches = productBatches.filter((b) => b.status === 'active');
                const depletedBatches = productBatches.filter((b) => b.status === 'depleted');
                const batchRemaining = productBatches.reduce((sum, b) => sum + (b.remainingQuantity || 0), 0);
                const batchTotal = productBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
                return (
                  <div key={product.id} className="border-b border-gray-200">
                    <div className="grid grid-cols-12 items-center px-4 py-3">
                      <button
                        onClick={() => handleExpand(product.id)}
                        className="col-span-1 text-gray-500 hover:text-gray-700"
                        aria-label="Toggle batches"
                      >
                        {expandedProductId === product.id ? (
                          <ChevronDown size={18} />
                        ) : (
                          <ChevronRight size={18} />
                        )}
                      </button>
                      <div className="col-span-3">
                        <div className="font-medium text-gray-900">{product.name}</div>
                        <div className="text-xs text-gray-500">{product.reference || '—'}</div>
                      </div>
                      <div className="col-span-2 text-sm text-gray-700">
                        {product.category || '—'}
                      </div>
                      <div className="col-span-2 text-sm text-gray-900">
                        {productBatches.length > 0
                          ? `${formatNumber(batchRemaining)} / ${formatNumber(batchTotal)} units`
                          : `${formatNumber(product.stock)} units`}
                      </div>
                      <div className="col-span-2 text-sm text-gray-900">
                        {activeBatches.length} active / {depletedBatches.length} depleted
                      </div>
                      <div className="col-span-2 flex justify-end space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleHistory(product)}
                        >
                          History
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => handleRestock(product)}
                        >
                          Restock
                        </Button>
                      </div>
                    </div>

                    {expandedProductId === product.id && (
                      <div className="bg-gray-50 px-10 py-5">
                        {batchesLoading ? (
                          <SkeletonExpanded />
                        ) : batchesError ? (
                          <div className="flex items-center space-x-2 text-sm text-red-600">
                            <AlertCircle size={16} />
                            <span>Error loading batches. Please try again.</span>
                          </div>
                        ) : productBatches.length === 0 ? (
                          <div className="flex flex-col items-center py-6">
                            <Package className="h-8 w-8 text-gray-400 mb-2" />
                            <p className="text-sm text-gray-600">No batches found for this product.</p>
                            <p className="text-xs text-gray-500 mt-1">Create a batch by restocking this product.</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[960px] table-fixed text-sm text-left text-gray-700">
                              <thead>
                                <tr className="text-xs uppercase text-gray-500 border-b bg-white/60">
                                  <th className="py-3 pr-4 w-52">Batch ID</th>
                                  <th className="py-3 pr-4 w-40">Remaining / Total</th>
                                  <th className="py-3 pr-4 w-32">Cost Price</th>
                                  <th className="py-3 pr-4 w-48">Supplier</th>
                                  <th className="py-3 pr-4 w-28">Payment</th>
                                  <th className="py-3 pr-4 w-28">Status</th>
                                  <th className="py-3 pr-4 text-right w-48">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {productBatches.map((batch) => (
                                  <tr key={batch.id} className="border-b last:border-b-0 bg-white">
                                    <td className="py-3 pr-4 font-mono text-xs text-gray-700 break-all">
                                      {batch.id}
                                    </td>
                                    <td className="py-3 pr-4">
                                      {formatNumber(batch.remainingQuantity)} / {formatNumber(batch.quantity)}
                                    </td>
                                    <td className="py-3 pr-4">
                                      {batch.costPrice ? `${batch.costPrice.toLocaleString()} XAF` : '—'}
                                    </td>
                                    <td className="py-3 pr-4">
                                      {batch.supplierId 
                                        ? (suppliersMap.get(batch.supplierId) || batch.supplierId)
                                        : 'Own purchase'}
                                    </td>
                                    <td className="py-3 pr-4">
                                      {batch.isCredit ? 'Credit' : 'Paid'}
                                    </td>
                                    <td className="py-3 pr-4 capitalize">{batch.status}</td>
                                    <td className="py-3 pr-4 text-right space-x-3">
                                      {batch.status === 'active' ? (
                                        <>
                                          <Button 
                                            size="sm" 
                                            variant="outline"
                                            className="px-3 py-1.5 text-sm"
                                            onClick={() => handleAdjust(product, batch)}
                                          >
                                            Adjust
                                          </Button>
                                          {batch.remainingQuantity > 0 && (
                                            <Button 
                                              size="sm" 
                                              variant="outline"
                                              className="px-3 py-1.5 text-sm"
                                              onClick={() => handleDamage(product, batch)}
                                            >
                                              Damage
                                            </Button>
                                          )}
                                        </>
                                      ) : (
                                        <span className="inline-flex items-center justify-end text-xs text-gray-500">
                                          No actions (depleted)
                                        </span>
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

            {!loading && filteredProducts.length === 0 && (
              <div className="px-4 py-12 text-center">
                {search.trim() ? (
                  <div className="flex flex-col items-center">
                    <Search className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
                    <p className="text-sm text-gray-600 mb-4 max-w-md">
                      No products match your search "{search}". Try adjusting your search terms.
                    </p>
                    <Button variant="outline" onClick={() => setSearch('')}>
                      Clear Search
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Package className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No products yet</h3>
                    <p className="text-sm text-gray-600 mb-4 max-w-md">
                      Start by adding products to your inventory. Once products are added, they will appear here with their stock information.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {filteredProducts.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-700">
            <div className="flex items-center space-x-2">
              <span>
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredProducts.length)} of {filteredProducts.length} products
              </span>
              {hasMore && (
                <span className="text-gray-500">(More available)</span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
              >
                Previous
              </Button>
              <div className="flex items-center space-x-1">
                <span className="text-gray-600">Page</span>
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
                <span className="text-gray-600">of {totalPages}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || loading}
              >
                Next
              </Button>
              {hasMore && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadMore} 
                  disabled={loadingMore || loading}
                >
                  {loadingMore ? 'Loading…' : 'Load More'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stock Operation Modals */}
      <ProductRestockModal
        isOpen={restockModalOpen}
        onClose={handleModalClose}
        product={selectedProduct}
        batchTotals={selectedBatchTotals}
        onSuccess={handleModalSuccess}
      />

      <ManualAdjustmentModal
        isOpen={adjustModalOpen}
        onClose={handleModalClose}
        product={selectedProduct}
        selectedBatch={selectedBatch}
        batchTotals={selectedBatchTotals}
        onSuccess={handleModalSuccess}
      />

      <DamageAdjustmentModal
        isOpen={damageModalOpen}
        onClose={handleModalClose}
        product={selectedProduct}
        selectedBatch={selectedBatch}
        batchTotals={selectedBatchTotals}
        onSuccess={handleModalSuccess}
      />

      {/* Stock History Modal */}
      <Modal
        isOpen={historyModalOpen}
        onClose={handleModalClose}
        title={`Stock History - ${selectedProduct?.name || ''}`}
        size="lg"
      >
        <div className="space-y-4">
          {selectedProduct && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Product:</span>
                  <p className="text-gray-900">{selectedProduct.name}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Current Stock:</span>
                  <p className="text-gray-900">{selectedProduct.stock} units</p>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Date</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Change</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Reason</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Supplier</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Payment</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Cost Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {productStockChanges.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No stock history found for this product.
                    </td>
                  </tr>
                ) : (
                  productStockChanges.map((change: any) => {
                    const supplierName = change.supplierId
                      ? (suppliersMap.get(change.supplierId) || change.supplierId)
                      : change.isOwnPurchase
                      ? 'Own purchase'
                      : '—';
                    
                    return (
                      <tr key={change.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-700">
                          {change.createdAt?.seconds
                            ? new Date(change.createdAt.seconds * 1000).toLocaleString()
                            : '—'}
                        </td>
                        <td className={`px-4 py-2 font-medium ${
                          change.change > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {change.change > 0 ? '+' : ''}{change.change}
                        </td>
                        <td className="px-4 py-2 text-gray-700 capitalize">{change.reason}</td>
                        <td className="px-4 py-2 text-gray-700">{supplierName}</td>
                        <td className="px-4 py-2 text-gray-700">
                          {change.isOwnPurchase ? (
                            '—'
                          ) : change.isCredit ? (
                            <span className="text-red-600">Credit</span>
                          ) : (
                            <span className="text-green-600">Paid</span>
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
    </div>
  );
};

export default Stocks;
