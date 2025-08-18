import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { 
  subscribeToProducts, 
  subscribeToSales, 
  getProductStockBatches, 
  getProductStockInfo,
  getProductPerformance,
  subscribeToCompanies,
  subscribeToStockChanges,
  deleteStockChange
} from '../services/firestore';
import { 
  subscribeToCategories, 
  subscribeToSuppliers 
} from '../services/firestore';
import type { Product, Sale, StockBatch, Category, Supplier, Company, StockChange, SaleProduct } from '../types/models';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import StockChangeDetails from '../components/products/StockChangeDetails';
import { formatCostPrice, formatStockQuantity } from '../utils/inventoryManagement';
import { analyzeFIFO, validateFIFOConsistency, generateFIFOSummary } from '../utils/fifoDebugger';

const FIFODebugger: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stockChanges, setStockChanges] = useState<StockChange[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productBatches, setProductBatches] = useState<StockBatch[]>([]);
  const [productStockChanges, setProductStockChanges] = useState<StockChange[]>([]);
  const [productStockInfo, setProductStockInfo] = useState<any>(null);
  const [productPerformance, setProductPerformance] = useState<any>(null);
  const [fifoAnalysis, setFifoAnalysis] = useState<any>(null);
  const [consistencyCheck, setConsistencyCheck] = useState<any>(null);
  const [dataCoherenceAnalysis, setDataCoherenceAnalysis] = useState<any>(null);
  const [systemSummary, setSystemSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userProducts, setUserProducts] = useState<{ [userId: string]: Product[] }>({});
  const [showProductModal, setShowProductModal] = useState(false);
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [modalProductBatches, setModalProductBatches] = useState<StockBatch[]>([]);
  const [modalProductStockChanges, setModalProductStockChanges] = useState<StockChange[]>([]);
  const [modalProductStockInfo, setModalProductStockInfo] = useState<any>(null);
  const [modalProductPerformance, setModalProductPerformance] = useState<any>(null);
  const [modalFifoAnalysis, setModalFifoAnalysis] = useState<any>(null);
  const [modalConsistencyCheck, setModalConsistencyCheck] = useState<any>(null);
  const [modalDataCoherenceAnalysis, setModalDataCoherenceAnalysis] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [deletingStockChanges, setDeletingStockChanges] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.uid) return;

    // Only load essential data initially - reduce quota usage
    const unsubscribeProducts = subscribeToProducts(setProducts);
    const unsubscribeCategories = subscribeToCategories(setCategories);
    const unsubscribeSuppliers = subscribeToSuppliers(setSuppliers);
    const unsubscribeCompanies = subscribeToCompanies(setCompanies);

    setLoading(false);

    return () => {
      unsubscribeProducts();
      unsubscribeCategories();
      unsubscribeSuppliers();
      unsubscribeCompanies();
    };
  }, [user?.uid]);

  // Load sales and stock changes only when a user is selected - lazy loading
  useEffect(() => {
    if (!selectedUserId) return;

    const unsubscribeSales = subscribeToSales(setSales);
    const unsubscribeStockChanges = subscribeToStockChanges(setStockChanges);

    return () => {
      unsubscribeSales();
      unsubscribeStockChanges();
    };
  }, [selectedUserId]);

  // Generate system summary when data changes - only when user is selected
  useEffect(() => {
    if (products.length > 0 && sales.length > 0 && selectedUserId) {
      const summary = generateFIFOSummary(products, [], sales); // We'll get batches per product
      setSystemSummary(summary);
    }
  }, [products, sales, selectedUserId]);

  // Group products by user when products change
  useEffect(() => {
    if (products.length > 0) {
      const grouped = products.reduce((acc, product) => {
        const userId = product.userId;
        if (!acc[userId]) {
          acc[userId] = [];
        }
        acc[userId].push(product);
        return acc;
      }, {} as { [userId: string]: Product[] });
      
      setUserProducts(grouped);
      
      // Auto-select first user if none selected
      if (!selectedUserId && Object.keys(grouped).length > 0) {
        setSelectedUserId(Object.keys(grouped)[0]);
      }
    }
  }, [products, selectedUserId]);

  useEffect(() => {
    if (selectedProductId) {
      loadProductDetails(selectedProductId);
    }
  }, [selectedProductId]);

  const loadProductDetails = async (productId: string) => {
    try {
      // Only load essential data - reduce quota usage
      const [batches] = await Promise.all([
        getProductStockBatches(productId)
      ]);
      
      setProductBatches(batches);
      
      // Filter stock changes for this product
      const productStockChanges = stockChanges.filter(change => change.productId === productId);
      setProductStockChanges(productStockChanges);
      
      const product = products.find(p => p.id === productId);
      setSelectedProduct(product || null);

      // Generate basic analysis only - reduce computation
      if (product) {
        const userSales = selectedUserId ? sales.filter(sale => sale.userId === selectedUserId) : sales;
        const analysis = analyzeFIFO(product, batches, userSales);
        
        setFifoAnalysis(analysis);
        // Remove heavy computations for now
        setConsistencyCheck(null);
        setDataCoherenceAnalysis(null);
      }
    } catch (error) {
      console.error('Error loading product details:', error);
    }
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || 'Unknown';
  };

  const getSupplierName = (supplierId?: string) => {
    if (!supplierId) return 'N/A';
    return suppliers.find(s => s.id === supplierId)?.name || 'Unknown';
  };

  const getProductSales = (productId: string) => {
    return sales.filter(sale => 
      sale.products.some(product => product.productId === productId)
    );
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    return date.toLocaleString();
  };

  const getBatchStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'depleted': return 'default';
      case 'corrected': return 'warning';
      default: return 'default';
    }
  };

  const getUserDisplayName = (userId: string) => {
    // Find company by userId
    const company = companies.find(c => c.userId === userId);
    if (company) {
      return `${company.name} (${company.email})`;
    }
    
    // Fallback to user ID if no company found
    return `User ${userId.slice(-8)}`;
  };

  const getUserEmail = (userId: string) => {
    const company = companies.find(c => c.userId === userId);
    return company?.email || 'Unknown';
  };

  const getUserCompanyName = (userId: string) => {
    const company = companies.find(c => c.userId === userId);
    return company?.name || 'Unknown';
  };

  const getCurrentUserProducts = () => {
    return selectedUserId ? userProducts[selectedUserId] || [] : [];
  };

  const handleUserChange = (userId: string) => {
    setSelectedUserId(userId);
    setSelectedProductId(''); // Reset product selection when changing users
    setSelectedProduct(null);
    setProductBatches([]);
    setProductStockChanges([]);
    setProductStockInfo(null);
    setProductPerformance(null);
    setFifoAnalysis(null);
    setConsistencyCheck(null);
    setDataCoherenceAnalysis(null);
    setShowProductModal(false);
    setModalProduct(null);
  };

  const openProductModal = async (product: Product) => {
    setModalLoading(true);
    setModalProduct(product);
    setShowProductModal(true);

    try {
      // Only load essential data - reduce quota usage
      const [batches] = await Promise.all([
        getProductStockBatches(product.id)
      ]);
      
      setModalProductBatches(batches);
      
      // Filter stock changes for this product
      const productStockChanges = stockChanges.filter(change => change.productId === product.id);
      setModalProductStockChanges(productStockChanges);
      
      // Generate basic analysis only - reduce computation
      const userSales = selectedUserId ? sales.filter(sale => sale.userId === selectedUserId) : sales;
      const analysis = analyzeFIFO(product, batches, userSales);
      
      setModalFifoAnalysis(analysis);
      // Remove heavy computations for now
      setModalConsistencyCheck(null);
      setModalDataCoherenceAnalysis(null);
    } catch (error) {
      console.error('Error loading product modal details:', error);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteStockChange = async (stockChangeId: string) => {
    if (!confirm('Are you sure you want to delete this stock change? This action cannot be undone.')) {
      return;
    }
    
    try {
      setDeletingStockChanges(prev => new Set(prev).add(stockChangeId));
      await deleteStockChange(stockChangeId);
      
      // Remove from local state
      setStockChanges(prev => prev.filter(change => change.id !== stockChangeId));
      setProductStockChanges(prev => prev.filter(change => change.id !== stockChangeId));
      setModalProductStockChanges(prev => prev.filter(change => change.id !== stockChangeId));
      
      console.log(`Stock change ${stockChangeId} deleted successfully`);
    } catch (error) {
      console.error('Error deleting stock change:', error);
      alert('Failed to delete stock change. Please try again.');
    } finally {
      setDeletingStockChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(stockChangeId);
        return newSet;
      });
    }
  };

  const analyzeDataCoherence = (product: Product, batches: StockBatch[], stockChanges: StockChange[], sales: Sale[]) => {
    const analysis = {
      totalStockChanges: stockChanges.length,
      totalBatches: batches.length,
      totalSales: sales.filter(s => s.products.some(p => p.productId === product.id)).length,
      stockChangesByReason: {} as { [key: string]: number },
      batchesByStatus: {} as { [key: string]: number },
      stockChangesWithBatchId: 0,
      stockChangesWithoutBatchId: 0,
      salesWithBatchId: 0,
      salesWithoutBatchId: 0,
      stockChangesByDate: [] as { date: string; count: number; type: string }[],
      batchesByDate: [] as { date: string; count: number; type: string }[],
      salesByDate: [] as { date: string; count: number; type: string }[],
      issues: [] as string[],
      warnings: [] as string[],
      migrationData: {
        stockChangesFromMigration: 0,
        batchesFromMigration: 0,
        salesFromMigration: 0
      }
    };

    // Analyze stock changes
    stockChanges.forEach(change => {
      const reason = change.reason;
      analysis.stockChangesByReason[reason] = (analysis.stockChangesByReason[reason] || 0) + 1;
      
      if (change.batchId) {
        analysis.stockChangesWithBatchId++;
      } else {
        analysis.stockChangesWithoutBatchId++;
      }

      // Check if this looks like migration data (older timestamps, specific patterns)
      const changeDate = change.createdAt?.seconds ? new Date(change.createdAt.seconds * 1000) : new Date();
      const isMigrationData = changeDate < new Date('2024-12-01'); // Adjust date as needed
      if (isMigrationData) {
        analysis.migrationData.stockChangesFromMigration++;
      }

      analysis.stockChangesByDate.push({
        date: changeDate.toLocaleDateString(),
        count: 1,
        type: 'stockChange'
      });
    });

    // Analyze batches
    batches.forEach(batch => {
      const status = batch.status;
      analysis.batchesByStatus[status] = (analysis.batchesByStatus[status] || 0) + 1;

      const batchDate = batch.createdAt?.seconds ? new Date(batch.createdAt.seconds * 1000) : new Date();
      const isMigrationData = batchDate < new Date('2024-12-01'); // Adjust date as needed
      if (isMigrationData) {
        analysis.migrationData.batchesFromMigration++;
      }

      analysis.batchesByDate.push({
        date: batchDate.toLocaleDateString(),
        count: 1,
        type: 'batch'
      });
    });

    // Analyze sales
    const productSales = sales.filter(s => s.products.some(p => p.productId === product.id));
    productSales.forEach(sale => {
      const saleProducts = sale.products.filter(p => p.productId === product.id);
      saleProducts.forEach(product => {
        if (product.batchId) {
          analysis.salesWithBatchId++;
        } else {
          analysis.salesWithoutBatchId++;
        }
      });

      const saleDate = sale.createdAt?.seconds ? new Date(sale.createdAt.seconds * 1000) : new Date();
      const isMigrationData = saleDate < new Date('2024-12-01'); // Adjust date as needed
      if (isMigrationData) {
        analysis.migrationData.salesFromMigration++;
      }

      analysis.salesByDate.push({
        date: saleDate.toLocaleDateString(),
        count: 1,
        type: 'sale'
      });
    });

    // Identify issues and warnings
    if (analysis.stockChangesWithoutBatchId > 0) {
      analysis.warnings.push(`${analysis.stockChangesWithoutBatchId} stock changes without batch ID (pre-migration data)`);
    }

    if (analysis.salesWithoutBatchId > 0) {
      analysis.warnings.push(`${analysis.salesWithoutBatchId} sales without batch ID (pre-migration data)`);
    }

    if (analysis.migrationData.stockChangesFromMigration > 0 && analysis.migrationData.batchesFromMigration === 0) {
      analysis.issues.push('Stock changes from migration but no corresponding batches found');
    }

    if (analysis.totalStockChanges > 0 && analysis.totalBatches === 0) {
      analysis.issues.push('Product has stock changes but no batches (incomplete migration)');
    }

    return analysis;
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-center mt-2">Loading FIFO Debugger...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">FIFO/LIFO System Debugger</h1>
                 <div className="text-sm text-gray-600">
           Total Products: {products.length} | Total Sales: {sales.length} | Total Accounts: {companies.length} | Stock Changes: {stockChanges.length}
           {systemSummary && ` | Products with Batches: ${systemSummary.productsWithBatches}`}
         </div>
      </div>

      {/* User Selection */}
      <Card>
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">Select User Account</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.keys(userProducts).map((userId) => (
                             <div
                 key={userId}
                 className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                   selectedUserId === userId 
                     ? 'border-blue-500 bg-blue-50' 
                     : 'border-gray-200 hover:border-gray-300'
                 }`}
                 onClick={() => handleUserChange(userId)}
               >
                 <div className="font-medium">{getUserCompanyName(userId)}</div>
                 <div className="text-sm text-gray-600">
                   Email: {getUserEmail(userId)}
                 </div>
                 <div className="text-sm text-gray-500">
                   Products: {userProducts[userId].length} | Stock: {userProducts[userId].reduce((sum, p) => sum + (p.stock || 0), 0)}
                 </div>
               </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Product Selection */}
      {selectedUserId && (
        <Card>
          <div className="p-4">
                         <h2 className="text-lg font-semibold mb-4">
               Select Product to Debug - {getUserCompanyName(selectedUserId)}
             </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                             {getCurrentUserProducts().map((product) => (
                 <div
                   key={product.id}
                   className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                     selectedProductId === product.id 
                       ? 'border-blue-500 bg-blue-50' 
                       : 'border-gray-200 hover:border-gray-300'
                   }`}
                   onClick={() => setSelectedProductId(product.id)}
                 >
                   <div className="font-medium">{product.name}</div>
                   <div className="text-sm text-gray-600">
                     Ref: {product.reference} | Stock: {product.stock}
                   </div>
                   <div className="text-sm text-gray-500">
                     Category: {getCategoryName(product.category)}
                   </div>
                   <div className="mt-2">
                     <Button
                       size="sm"
                       variant="outline"
                       onClick={(e) => {
                         e.stopPropagation();
                         openProductModal(product);
                       }}
                     >
                       View Details
                     </Button>
                   </div>
                 </div>
               ))}
            </div>
            {getCurrentUserProducts().length === 0 && (
              <p className="text-gray-500 text-center py-4">No products found for this user</p>
            )}
          </div>
        </Card>
      )}

             {/* User Summary */}
       {selectedUserId && (
         <Card>
           <div className="p-4">
             <h2 className="text-lg font-semibold mb-4">Account Summary - {getUserCompanyName(selectedUserId)}</h2>
             <div className="mb-4 p-3 bg-gray-50 rounded-lg">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                 <div>
                   <span className="font-medium">Company:</span> {getUserCompanyName(selectedUserId)}
                 </div>
                 <div>
                   <span className="font-medium">Email:</span> {getUserEmail(selectedUserId)}
                 </div>
                 <div>
                   <span className="font-medium">User ID:</span> {selectedUserId}
                 </div>
                 <div>
                   <span className="font-medium">Account Created:</span> {(() => {
                     const company = companies.find(c => c.userId === selectedUserId);
                     return company?.createdAt ? new Date(company.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown';
                   })()}
                 </div>
               </div>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <div>
                 <label className="block text-sm font-medium text-gray-700">Total Products</label>
                 <p className="mt-1 text-lg font-semibold text-gray-900">{getCurrentUserProducts().length}</p>
               </div>
               <div>
                 <label className="block text-sm font-medium text-gray-700">Total Stock</label>
                 <p className="mt-1 text-lg font-semibold text-gray-900">
                   {getCurrentUserProducts().reduce((sum, p) => sum + (p.stock || 0), 0)}
                 </p>
               </div>
               <div>
                 <label className="block text-sm font-medium text-gray-700">Total Value</label>
                 <p className="mt-1 text-lg font-semibold text-gray-900">
                   {formatCostPrice(
                     getCurrentUserProducts().reduce((sum, p) => sum + ((p.stock || 0) * (p.sellingPrice || 0)), 0)
                   )}
                 </p>
               </div>
               <div>
                 <label className="block text-sm font-medium text-gray-700">Account Sales</label>
                 <p className="mt-1 text-lg font-semibold text-gray-900">
                   {sales.filter(sale => sale.userId === selectedUserId).length}
                 </p>
               </div>
             </div>
           </div>
         </Card>
       )}

      {selectedProduct && (
        <>
          {/* Product Overview */}
          <Card>
            <div className="p-4">
              <h2 className="text-lg font-semibold mb-4">Product Overview</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Product ID</label>
                  <p className="mt-1 text-sm text-gray-900 font-mono bg-gray-100 p-1 rounded">{selectedProduct.id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedProduct.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Reference</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedProduct.reference}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Current Stock</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedProduct.stock}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Selling Price</label>
                  <p className="mt-1 text-sm text-gray-900">{formatCostPrice(selectedProduct.sellingPrice)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Category</label>
                  <p className="mt-1 text-sm text-gray-900">{getCategoryName(selectedProduct.category)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Inventory Method</label>
                  <p className="mt-1 text-sm text-gray-900">{(selectedProduct as any).inventoryMethod || 'FIFO'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Batch Tracking</label>
                  <p className="mt-1 text-sm text-gray-900">{(selectedProduct as any).enableBatchTracking !== false ? 'Enabled' : 'Disabled'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Created</label>
                  <p className="mt-1 text-sm text-gray-900">{formatDate(selectedProduct.createdAt)}</p>
                </div>
              </div>
            </div>
          </Card>

                     {/* Stock Changes */}
           <Card>
             <div className="p-4">
               <div className="flex justify-between items-center mb-4">
                 <h2 className="text-lg font-semibold">Stock Changes ({productStockChanges.length})</h2>
                 {(() => {
                   const preMigrationWithoutBatchId = productStockChanges.filter(change => {
                     const changeDate = change.createdAt?.seconds ? new Date(change.createdAt.seconds * 1000) : new Date();
                     const isPreMigrationData = changeDate < new Date('2024-12-01');
                     return isPreMigrationData && !change.batchId;
                   });
                   
                   if (preMigrationWithoutBatchId.length > 0) {
                     return (
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={async () => {
                           if (!confirm(`Are you sure you want to delete ${preMigrationWithoutBatchId.length} pre-migration stock changes without batch IDs? This action cannot be undone.`)) {
                             return;
                           }
                           
                           try {
                             for (const change of preMigrationWithoutBatchId) {
                               await handleDeleteStockChange(change.id);
                             }
                           } catch (error) {
                             console.error('Error in bulk delete:', error);
                           }
                         }}
                         className="text-red-600 hover:text-red-700 hover:bg-red-50"
                       >
                         Delete {preMigrationWithoutBatchId.length} Pre-Migration (No Batch ID)
                       </Button>
                     );
                   }
                   return null;
                 })()}
               </div>
               {productStockChanges.length === 0 ? (
                 <p className="text-gray-500 text-center py-4">No stock changes found for this product</p>
               ) : (
                 <div className="space-y-3">
                   {productStockChanges.map((change) => (
                     <div key={change.id} className="relative">
                       <StockChangeDetails stockChange={change} />
                       <div className="absolute top-2 right-2">
                           <Button
                             size="sm"
                             variant="outline"
                             onClick={() => handleDeleteStockChange(change.id)}
                             disabled={deletingStockChanges.has(change.id)}
                             className="text-red-600 hover:text-red-700 hover:bg-red-50"
                           >
                             {deletingStockChanges.has(change.id) ? 'Deleting...' : 'Delete'}
                           </Button>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>
           </Card>

           {/* Stock Batches */}
           <Card>
             <div className="p-4">
               <h2 className="text-lg font-semibold mb-4">Stock Batches ({productBatches.length})</h2>
               {productBatches.length === 0 ? (
                 <p className="text-gray-500 text-center py-4">No stock batches found for this product</p>
               ) : (
                 <div className="space-y-3">
                   {productBatches.map((batch) => (
                     <div key={batch.id} className="border rounded-lg p-3">
                       <div className="flex justify-between items-start mb-2">
                         <div className="flex items-center gap-2">
                           <Badge variant={getBatchStatusColor(batch.status)}>
                             {batch.status}
                           </Badge>
                           <span className="text-sm font-medium">Batch {batch.id.slice(-8)}</span>
                         </div>
                         <div className="text-sm text-gray-500">
                           {formatDate(batch.createdAt)}
                         </div>
                       </div>
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                         <div>
                           <span className="font-medium">Quantity:</span> {formatStockQuantity(batch.quantity)}
                         </div>
                         <div>
                           <span className="font-medium">Remaining:</span> {formatStockQuantity(batch.remainingQuantity)}
                         </div>
                         <div>
                           <span className="font-medium">Cost Price:</span> {formatCostPrice(batch.costPrice)}
                         </div>
                         <div>
                           <span className="font-medium">Supplier:</span> {getSupplierName(batch.supplierId)}
                         </div>
                         {batch.notes && (
                           <div className="col-span-2">
                             <span className="font-medium">Notes:</span> {batch.notes}
                           </div>
                         )}
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>
           </Card>

          {/* Stock Information */}
          {productStockInfo && (
            <Card>
              <div className="p-4">
                <h2 className="text-lg font-semibold mb-4">Stock Information</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Total Stock</label>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{productStockInfo.totalStock}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Total Value</label>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{formatCostPrice(productStockInfo.totalValue)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Average Cost Price</label>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{formatCostPrice(productStockInfo.averageCostPrice)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Active Batches</label>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{productStockInfo.batches.filter((b: any) => b.status === 'active').length}</p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Product Performance */}
          {productPerformance && (
            <Card>
              <div className="p-4">
                <h2 className="text-lg font-semibold mb-4">Product Performance</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Total Sales</label>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{productPerformance.totalSales}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Total Revenue</label>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{formatCostPrice(productPerformance.totalRevenue)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Total Profit</label>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{formatCostPrice(productPerformance.totalProfit)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Average Price</label>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{formatCostPrice(productPerformance.averagePrice)}</p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Sales History */}
          <Card>
            <div className="p-4">
              <h2 className="text-lg font-semibold mb-4">Sales History</h2>
              {(() => {
                const productSales = getProductSales(selectedProduct.id);
                return productSales.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No sales found for this product</p>
                ) : (
                  <div className="space-y-3">
                    {productSales.map((sale) => (
                      <div key={sale.id} className="border rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Sale {sale.id.slice(-8)}</span>
                            <Badge variant={sale.status === 'paid' ? 'success' : 'warning'}>
                              {sale.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatDate(sale.createdAt)}
                          </div>
                        </div>
                        <div className="space-y-2">
                          {sale.products
                            .filter(product => product.productId === selectedProduct.id)
                            .map((product, index) => (
                              <div key={index} className="bg-gray-50 p-2 rounded">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <span className="font-medium">Quantity:</span> {product.quantity}
                                  </div>
                                  <div>
                                    <span className="font-medium">Price:</span> {formatCostPrice(product.basePrice)}
                                  </div>
                                  <div>
                                    <span className="font-medium">Cost Price:</span> {formatCostPrice(product.costPrice || 0)}
                                  </div>
                                  <div>
                                    <span className="font-medium">Profit:</span> {formatCostPrice(product.profit || 0)}
                                  </div>
                                  {product.batchId && (
                                    <div className="col-span-2">
                                      <span className="font-medium">Batch ID:</span> {product.batchId.slice(-8)}
                                    </div>
                                  )}
                                  {(product as any).consumedBatches && (product as any).consumedBatches.length > 0 && (
                                    <div className="col-span-4">
                                      <span className="font-medium">Consumed Batches:</span>
                                      <div className="mt-1 space-y-1">
                                        {(product as any).consumedBatches.map((batch: any, batchIndex: number) => (
                                          <div key={batchIndex} className="text-xs bg-white p-1 rounded">
                                            Batch {batch.batchId.slice(-8)}: {batch.consumedQuantity} units @ {formatCostPrice(batch.costPrice)}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                        <div className="mt-2 text-sm text-gray-600">
                          Customer: {sale.customerInfo.name} | Total: {formatCostPrice(sale.totalAmount)}
                          {sale.totalCost && ` | Cost: ${formatCostPrice(sale.totalCost)}`}
                          {sale.totalProfit && ` | Profit: ${formatCostPrice(sale.totalProfit)}`}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
                     </Card>

           {/* FIFO Analysis */}
           {fifoAnalysis && (
             <Card>
               <div className="p-4">
                 <h2 className="text-lg font-semibold mb-4">FIFO Analysis</h2>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                   <div>
                     <label className="block text-sm font-medium text-gray-700">Total Stock</label>
                     <p className="mt-1 text-lg font-semibold text-gray-900">{fifoAnalysis.totalStock}</p>
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-gray-700">Total Value</label>
                     <p className="mt-1 text-lg font-semibold text-gray-900">{formatCostPrice(fifoAnalysis.totalValue)}</p>
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-gray-700">Average Cost Price</label>
                     <p className="mt-1 text-lg font-semibold text-gray-900">{formatCostPrice(fifoAnalysis.averageCostPrice)}</p>
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-gray-700">Stock Movements</label>
                     <p className="mt-1 text-lg font-semibold text-gray-900">{fifoAnalysis.stockMovements.length}</p>
                   </div>
                 </div>
                 
                 {/* Stock Movements Timeline */}
                 <div className="mt-4">
                   <h3 className="text-md font-medium mb-2">Stock Movements Timeline</h3>
                   <div className="space-y-2 max-h-40 overflow-y-auto">
                     {fifoAnalysis.stockMovements.map((movement: any, index: number) => (
                       <div key={index} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                         <div className="flex items-center gap-2">
                           <Badge variant={movement.type === 'restock' ? 'success' : 'warning'}>
                             {movement.type}
                           </Badge>
                           <span>{movement.quantity > 0 ? '+' : ''}{movement.quantity}</span>
                         </div>
                         <div className="text-gray-600">
                           {movement.costPrice && `${formatCostPrice(movement.costPrice)}`}
                         </div>
                         <div className="text-gray-500 text-xs">
                           {movement.date.toLocaleDateString()}
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               </div>
             </Card>
           )}

                       {/* Consistency Check - Temporarily Disabled for Performance */}
          {/* {consistencyCheck && (
              <Card>
                <div className="p-4">
                  <h2 className="text-lg font-semibold mb-4">Consistency Check</h2>
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant={consistencyCheck.isValid ? 'success' : 'error'}>
                      {consistencyCheck.isValid ? 'Valid' : 'Issues Found'}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      {consistencyCheck.issues.length} issues, {consistencyCheck.warnings.length} warnings
                    </span>
                  </div>
                  
                  {consistencyCheck.issues.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-md font-medium text-red-700 mb-2">Issues:</h3>
                      <ul className="space-y-1">
                        {consistencyCheck.issues.map((issue: string, index: number) => (
                          <li key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                            • {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {consistencyCheck.warnings.length > 0 && (
                    <div>
                      <h3 className="text-md font-medium text-yellow-700 mb-2">Warnings:</h3>
                      <ul className="space-y-1">
                        {consistencyCheck.warnings.map((warning: string, index: number) => (
                          <li key={index} className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                            • {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Card>
            )} */}

                        {/* Data Coherence Analysis - Temporarily Disabled for Performance */}
            {/* {dataCoherenceAnalysis && (
                <Card>
                  <div className="p-4">
                    <h2 className="text-lg font-semibold mb-4">Data Coherence Analysis</h2>
                    <p className="text-gray-500">This section is temporarily disabled to improve performance.</p>
                  </div>
                </Card>
            )} */}
          </>
        )}

        {/* Product Details Modal */}
        {showProductModal && modalProduct && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-7xl max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="flex justify-between items-center p-6 border-b">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{modalProduct.name}</h2>
                  <p className="text-sm text-gray-600">
                    {getUserCompanyName(selectedUserId)} • {modalProduct.reference}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowProductModal(false)}
                >
                  Close
                </Button>
              </div>

              {/* Modal Content */}
              <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-6">
                {modalLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-2">Loading product details...</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Product Overview */}
                    <Card>
                      <div className="p-4">
                        <h3 className="text-lg font-semibold mb-4">Product Overview</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Product ID</label>
                            <p className="mt-1 text-sm text-gray-900 font-mono bg-gray-100 p-1 rounded">{modalProduct.id}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Name</label>
                            <p className="mt-1 text-sm text-gray-900">{modalProduct.name}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Reference</label>
                            <p className="mt-1 text-sm text-gray-900">{modalProduct.reference}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Current Stock</label>
                            <p className="mt-1 text-sm text-gray-900">{modalProduct.stock}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Selling Price</label>
                            <p className="mt-1 text-sm text-gray-900">{formatCostPrice(modalProduct.sellingPrice)}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Category</label>
                            <p className="mt-1 text-sm text-gray-900">{getCategoryName(modalProduct.category)}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Inventory Method</label>
                            <p className="mt-1 text-sm text-gray-900">{(modalProduct as any).inventoryMethod || 'FIFO'}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Batch Tracking</label>
                            <p className="mt-1 text-sm text-gray-900">{(modalProduct as any).enableBatchTracking !== false ? 'Enabled' : 'Disabled'}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Created</label>
                            <p className="mt-1 text-sm text-gray-900">{formatDate(modalProduct.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    </Card>

                    {/* Stock Changes */}
                    <Card>
                      <div className="p-4">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-semibold">Stock Movements Timeline ({modalProductStockChanges.length})</h3>
                          {(() => {
                            const preMigrationWithoutBatchId = modalProductStockChanges.filter(change => {
                              const changeDate = change.createdAt?.seconds ? new Date(change.createdAt.seconds * 1000) : new Date();
                              const isPreMigrationData = changeDate < new Date('2024-12-01');
                              return isPreMigrationData && !change.batchId;
                            });
                            
                            if (preMigrationWithoutBatchId.length > 0) {
                              return (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    if (!confirm(`Are you sure you want to delete ${preMigrationWithoutBatchId.length} pre-migration stock changes without batch IDs? This action cannot be undone.`)) {
                                      return;
                                    }
                                    
                                    try {
                                      for (const change of preMigrationWithoutBatchId) {
                                        await handleDeleteStockChange(change.id);
                                      }
                                    } catch (error) {
                                      console.error('Error in bulk delete:', error);
                                    }
                                  }}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  Delete {preMigrationWithoutBatchId.length} Pre-Migration (No Batch ID)
                                </Button>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        {modalProductStockChanges.length === 0 ? (
                          <p className="text-gray-500 text-center py-4">No stock changes found for this product</p>
                        ) : (
                          <div className="space-y-3 max-h-80 overflow-y-auto">
                            {/* Sort stock changes by date (oldest first) */}
                            {modalProductStockChanges
                              .sort((a, b) => {
                                const dateA = a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(0);
                                const dateB = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(0);
                                return dateA.getTime() - dateB.getTime();
                              })
                              .map((change, index) => {
                                const changeDate = change.createdAt?.seconds ? new Date(change.createdAt.seconds * 1000) : new Date();
                                const isMigrationData = changeDate < new Date('2024-12-01');
                                
                                return (
                                  <div key={change.id} className={`relative ${isMigrationData ? 'bg-yellow-50 border-yellow-200' : ''}`}>
                                    <StockChangeDetails stockChange={change} />
                                        {isMigrationData && (
                                      <div className="absolute top-2 left-2">
                                          <Badge variant="warning" className="text-xs">
                                            Migration
                                          </Badge>
                                      </div>
                                    )}
                                    <div className="absolute top-2 right-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleDeleteStockChange(change.id)}
                                          disabled={deletingStockChanges.has(change.id)}
                                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                          {deletingStockChanges.has(change.id) ? 'Deleting...' : 'Delete'}
                                        </Button>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    </Card>

                    {/* Current Stock State */}
                    <Card>
                      <div className="p-4">
                        <h3 className="text-lg font-semibold mb-4">Current Stock State</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <div className="text-sm font-medium text-blue-800">Current Stock</div>
                            <div className="text-2xl font-bold text-blue-900">{modalProduct.stock || 0}</div>
                          </div>
                          <div className="bg-green-50 p-3 rounded-lg">
                            <div className="text-sm font-medium text-green-800">Selling Price</div>
                            <div className="text-2xl font-bold text-green-900">{formatCostPrice(modalProduct.sellingPrice)}</div>
                          </div>
                          <div className="bg-purple-50 p-3 rounded-lg">
                            <div className="text-sm font-medium text-purple-800">Cost Price</div>
                            <div className="text-2xl font-bold text-purple-900">{formatCostPrice((modalProduct as any).costPrice || 0)}</div>
                          </div>
                          <div className="bg-orange-50 p-3 rounded-lg">
                            <div className="text-sm font-medium text-orange-800">Profit Margin</div>
                            <div className="text-2xl font-bold text-orange-900">
                              {(() => {
                                const costPrice = (modalProduct as any).costPrice || 0;
                                const sellingPrice = modalProduct.sellingPrice || 0;
                                if (costPrice > 0 && sellingPrice > 0) {
                                  return `${Math.round(((sellingPrice - costPrice) / sellingPrice) * 100)}%`;
                                }
                                return 'N/A';
                              })()}
                            </div>
                          </div>
                        </div>
                        
                        {/* Stock Value Summary */}
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <div className="text-sm font-medium text-gray-700 mb-2">Stock Value Summary</div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Total Stock Value:</span>
                              <div className="font-semibold text-gray-900">
                                {formatCostPrice((modalProduct.stock || 0) * (modalProduct.sellingPrice || 0))}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-600">Total Cost Value:</span>
                              <div className="font-semibold text-gray-900">
                                {formatCostPrice((modalProduct.stock || 0) * ((modalProduct as any).costPrice || 0))}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-600">Potential Profit:</span>
                              <div className="font-semibold text-green-600">
                                {formatCostPrice(
                                  (modalProduct.stock || 0) * ((modalProduct.sellingPrice || 0) - ((modalProduct as any).costPrice || 0))
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>

                    {/* Stock Batches Summary */}
                    <Card>
                      <div className="p-4">
                        <h3 className="text-lg font-semibold mb-4">Stock Batches ({modalProductBatches.length})</h3>
                        {modalProductBatches.length === 0 ? (
                          <p className="text-gray-500 text-center py-4">No stock batches found for this product</p>
                        ) : (
                          <div className="space-y-3 max-h-60 overflow-y-auto">
                            {/* Sort batches by creation date (oldest first) */}
                            {modalProductBatches
                              .sort((a, b) => {
                                const dateA = a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(0);
                                const dateB = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(0);
                                return dateA.getTime() - dateB.getTime();
                              })
                              .map((batch) => {
                                const batchDate = batch.createdAt?.seconds ? new Date(batch.createdAt.seconds * 1000) : new Date();
                                const isMigrationData = batchDate < new Date('2024-12-01');
                                
                                return (
                                  <div key={batch.id} className={`border rounded-lg p-3 ${isMigrationData ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                      <div className="flex items-center gap-2">
                                        <Badge variant={getBatchStatusColor(batch.status)}>
                                          {batch.status}
                                        </Badge>
                                        <span className="text-sm font-medium">Batch {batch.id.slice(-8)}</span>
                                        {isMigrationData && (
                                          <Badge variant="warning" className="text-xs">
                                            Migration
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        {batchDate.toLocaleDateString()}
                                      </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                                                             <div>
                                         <span className="font-medium text-gray-600">Initial:</span>
                                         <div className="font-semibold text-gray-900">{formatStockQuantity((batch as any).initialQuantity || batch.quantity)}</div>
                                       </div>
                                      <div>
                                        <span className="font-medium text-gray-600">Remaining:</span>
                                        <div className="font-semibold text-gray-900">{formatStockQuantity(batch.remainingQuantity)}</div>
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-600">Cost Price:</span>
                                        <div className="font-semibold text-gray-900">{formatCostPrice(batch.costPrice)}</div>
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-600">Supplier:</span>
                                        <div className="text-gray-900">{getSupplierName(batch.supplierId)}</div>
                                      </div>
                                      
                                      <div className="col-span-2 md:col-span-4">
                                        <span className="font-medium text-gray-600">Document ID:</span>
                                        <div className="font-mono text-xs text-gray-700 bg-gray-100 p-1 rounded">
                                          {batch.id}
                                        </div>
                                      </div>
                                      
                                      {batch.notes && (
                                        <div className="col-span-2 md:col-span-4">
                                          <span className="font-medium text-gray-600">Notes:</span>
                                          <div className="text-gray-900 text-sm">{batch.notes}</div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    </Card>

                    {/* Stock Information */}
                    {modalProductStockInfo && (
                      <Card>
                        <div className="p-4">
                          <h3 className="text-lg font-semibold mb-4">Stock Information</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Total Stock</label>
                              <p className="mt-1 text-lg font-semibold text-gray-900">{modalProductStockInfo.totalStock}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Total Value</label>
                              <p className="mt-1 text-lg font-semibold text-gray-900">{formatCostPrice(modalProductStockInfo.totalValue)}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Average Cost Price</label>
                              <p className="mt-1 text-lg font-semibold text-gray-900">{formatCostPrice(modalProductStockInfo.averageCostPrice)}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Active Batches</label>
                              <p className="mt-1 text-lg font-semibold text-gray-900">{modalProductStockInfo.batches.filter((b: any) => b.status === 'active').length}</p>
                            </div>
                          </div>
                        </div>
                      </Card>
                    )}

                    {/* Product Performance */}
                    {modalProductPerformance && (
                      <Card>
                        <div className="p-4">
                          <h3 className="text-lg font-semibold mb-4">Product Performance</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Total Sales</label>
                              <p className="mt-1 text-lg font-semibold text-gray-900">{modalProductPerformance.totalSales}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Total Revenue</label>
                              <p className="mt-1 text-lg font-semibold text-gray-900">{formatCostPrice(modalProductPerformance.totalRevenue)}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Total Profit</label>
                              <p className="mt-1 text-lg font-semibold text-gray-900">{formatCostPrice(modalProductPerformance.totalProfit)}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Average Price</label>
                              <p className="mt-1 text-lg font-semibold text-gray-900">{formatCostPrice(modalProductPerformance.averagePrice)}</p>
                            </div>
                          </div>
                        </div>
                      </Card>
                    )}

                    {/* Sales History */}
                    <Card>
                      <div className="p-4">
                        <h3 className="text-lg font-semibold mb-4">Sales History</h3>
                        {(() => {
                          const productSales = getProductSales(modalProduct.id);
                          return productSales.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">No sales found for this product</p>
                          ) : (
                            <div className="space-y-3 max-h-60 overflow-y-auto">
                              {productSales.map((sale) => (
                                <div key={sale.id} className="border rounded-lg p-3">
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium">Sale {sale.id.slice(-8)}</span>
                                      <Badge variant={sale.status === 'paid' ? 'success' : 'warning'}>
                                        {sale.status}
                                      </Badge>
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      {formatDate(sale.createdAt)}
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    {sale.products
                                      .filter(product => product.productId === modalProduct.id)
                                      .map((product, index) => (
                                        <div key={index} className="bg-gray-50 p-2 rounded">
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                            <div>
                                              <span className="font-medium">Quantity:</span> {product.quantity}
                                            </div>
                                            <div>
                                              <span className="font-medium">Price:</span> {formatCostPrice(product.basePrice)}
                                            </div>
                                            <div>
                                              <span className="font-medium">Cost Price:</span> {formatCostPrice(product.costPrice || 0)}
                                            </div>
                                            <div>
                                              <span className="font-medium">Profit:</span> {formatCostPrice(product.profit || 0)}
                                            </div>
                                            {product.batchId && (
                                              <div className="col-span-2">
                                                <span className="font-medium">Batch ID:</span> {product.batchId.slice(-8)}
                                              </div>
                                            )}
                                            {(product as any).consumedBatches && (product as any).consumedBatches.length > 0 && (
                                              <div className="col-span-4">
                                                <span className="font-medium">Consumed Batches:</span>
                                                <div className="mt-1 space-y-1">
                                                  {(product as any).consumedBatches.map((batch: any, batchIndex: number) => (
                                                    <div key={batchIndex} className="text-xs bg-white p-1 rounded">
                                                      Batch {batch.batchId.slice(-8)}: {batch.consumedQuantity} units @ {formatCostPrice(batch.costPrice)}
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            
                                            <div className="col-span-4">
                                              <span className="font-medium text-gray-600">Product Sale ID:</span>
                                              <div className="font-mono text-xs text-gray-700 bg-gray-100 p-1 rounded">
                                                {product.productId}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                  </div>
                                  <div className="mt-2 text-sm text-gray-600">
                                    Customer: {sale.customerInfo.name} | Total: {formatCostPrice(sale.totalAmount)}
                                    {sale.totalCost && ` | Cost: ${formatCostPrice(sale.totalCost)}`}
                                    {sale.totalProfit && ` | Profit: ${formatCostPrice(sale.totalProfit)}`}
                                  </div>
                                  <div className="mt-2">
                                    <span className="font-medium text-gray-600 text-sm">Sale Document ID:</span>
                                    <div className="font-mono text-xs text-gray-700 bg-gray-100 p-1 rounded mt-1">
                                      {sale.id}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </Card>

                    {/* FIFO Analysis */}
                    {modalFifoAnalysis && (
                      <Card>
                        <div className="p-4">
                          <h3 className="text-lg font-semibold mb-4">FIFO Analysis</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Total Stock</label>
                              <p className="mt-1 text-lg font-semibold text-gray-900">{modalFifoAnalysis.totalStock}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Total Value</label>
                              <p className="mt-1 text-lg font-semibold text-gray-900">{formatCostPrice(modalFifoAnalysis.totalValue)}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Average Cost Price</label>
                              <p className="mt-1 text-lg font-semibold text-gray-900">{formatCostPrice(modalFifoAnalysis.averageCostPrice)}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Stock Movements</label>
                              <p className="mt-1 text-lg font-semibold text-gray-900">{modalFifoAnalysis.stockMovements.length}</p>
                            </div>
                          </div>
                          
                          {/* Stock Movements Timeline */}
                          <div className="mt-4">
                            <h4 className="text-md font-medium mb-2">Stock Movements Timeline</h4>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {modalFifoAnalysis.stockMovements.map((movement: any, index: number) => (
                                <div key={index} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                                  <div className="flex items-center gap-2">
                                    <Badge variant={movement.type === 'restock' ? 'success' : 'warning'}>
                                      {movement.type}
                                    </Badge>
                                    <span>{movement.quantity > 0 ? '+' : ''}{movement.quantity}</span>
                                  </div>
                                  <div className="text-gray-600">
                                    {movement.costPrice && `${formatCostPrice(movement.costPrice)}`}
                                  </div>
                                  <div className="text-gray-500 text-xs">
                                    {movement.date.toLocaleDateString()}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </Card>
                    )}

                    {/* Consistency Check */}
                    {modalConsistencyCheck && (
                      <Card>
                        <div className="p-4">
                          <h3 className="text-lg font-semibold mb-4">Consistency Check</h3>
                          <div className="flex items-center gap-2 mb-4">
                            <Badge variant={modalConsistencyCheck.isValid ? 'success' : 'error'}>
                              {modalConsistencyCheck.isValid ? 'Valid' : 'Issues Found'}
                            </Badge>
                            <span className="text-sm text-gray-600">
                              {modalConsistencyCheck.issues.length} issues, {modalConsistencyCheck.warnings.length} warnings
                            </span>
                          </div>
                          
                          {modalConsistencyCheck.issues.length > 0 && (
                            <div className="mb-4">
                              <h4 className="text-md font-medium text-red-700 mb-2">Issues:</h4>
                              <ul className="space-y-1">
                                {modalConsistencyCheck.issues.map((issue: string, index: number) => (
                                  <li key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                                    • {issue}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {modalConsistencyCheck.warnings.length > 0 && (
                            <div>
                              <h4 className="text-md font-medium text-yellow-700 mb-2">Warnings:</h4>
                              <ul className="space-y-1">
                                {modalConsistencyCheck.warnings.map((warning: string, index: number) => (
                                  <li key={index} className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                                    • {warning}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </Card>
                    )}

                    {/* Data Coherence Analysis */}
                    {modalDataCoherenceAnalysis && (
                      <Card>
                        <div className="p-4">
                          <h3 className="text-lg font-semibold mb-4">Data Coherence Analysis</h3>
                          
                          {/* Summary Statistics */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Stock Changes</label>
                              <p className="mt-1 text-lg font-semibold text-gray-900">{modalDataCoherenceAnalysis.totalStockChanges}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Stock Batches</label>
                              <p className="mt-1 text-lg font-semibold text-gray-900">{modalDataCoherenceAnalysis.totalBatches}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Sales</label>
                              <p className="mt-1 text-lg font-semibold text-gray-900">{modalDataCoherenceAnalysis.totalSales}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Migration Data</label>
                              <p className="mt-1 text-lg font-semibold text-gray-900">
                                {modalDataCoherenceAnalysis.migrationData.stockChangesFromMigration + 
                                 modalDataCoherenceAnalysis.migrationData.batchesFromMigration + 
                                 modalDataCoherenceAnalysis.migrationData.salesFromMigration}
                              </p>
                            </div>
                          </div>

                          {/* Migration Data Breakdown */}
                          <div className="mb-6">
                            <h4 className="text-md font-medium mb-3">Migration Data Breakdown</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-blue-50 p-3 rounded-lg">
                                <div className="text-sm font-medium text-blue-800">Stock Changes from Migration</div>
                                <div className="text-lg font-semibold text-blue-900">{modalDataCoherenceAnalysis.migrationData.stockChangesFromMigration}</div>
                              </div>
                              <div className="bg-green-50 p-3 rounded-lg">
                                <div className="text-sm font-medium text-green-800">Batches from Migration</div>
                                <div className="text-lg font-semibold text-green-900">{modalDataCoherenceAnalysis.migrationData.batchesFromMigration}</div>
                              </div>
                              <div className="bg-purple-50 p-3 rounded-lg">
                                <div className="text-sm font-medium text-purple-800">Sales from Migration</div>
                                <div className="text-lg font-semibold text-purple-900">{modalDataCoherenceAnalysis.migrationData.salesFromMigration}</div>
                              </div>
                            </div>
                          </div>

                          {/* Batch ID Coverage */}
                          <div className="mb-6">
                            <h4 className="text-md font-medium mb-3">Batch ID Coverage</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-sm font-medium text-gray-700">Stock Changes with Batch ID</div>
                                <div className="text-lg font-semibold text-gray-900">{modalDataCoherenceAnalysis.stockChangesWithBatchId}</div>
                                <div className="text-xs text-gray-500">
                                  {modalDataCoherenceAnalysis.totalStockChanges > 0 
                                    ? `${Math.round((modalDataCoherenceAnalysis.stockChangesWithBatchId / modalDataCoherenceAnalysis.totalStockChanges) * 100)}% coverage`
                                    : 'No stock changes'
                                  }
                                </div>
                              </div>
                              <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-sm font-medium text-gray-700">Sales with Batch ID</div>
                                <div className="text-lg font-semibold text-gray-900">{modalDataCoherenceAnalysis.salesWithBatchId}</div>
                                <div className="text-xs text-gray-500">
                                  {modalDataCoherenceAnalysis.totalSales > 0 
                                    ? `${Math.round((modalDataCoherenceAnalysis.salesWithBatchId / modalDataCoherenceAnalysis.totalSales) * 100)}% coverage`
                                    : 'No sales'
                                  }
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Stock Changes by Reason */}
                          {Object.keys(modalDataCoherenceAnalysis.stockChangesByReason).length > 0 && (
                            <div className="mb-6">
                              <h4 className="text-md font-medium mb-3">Stock Changes by Reason</h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {Object.entries(modalDataCoherenceAnalysis.stockChangesByReason).map(([reason, count]) => (
                                  <div key={reason} className="bg-gray-50 p-2 rounded">
                                    <div className="text-sm font-medium text-gray-700">{reason}</div>
                                    <div className="text-lg font-semibold text-gray-900">{count as React.ReactNode}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Batches by Status */}
                          {Object.keys(modalDataCoherenceAnalysis.batchesByStatus).length > 0 && (
                            <div className="mb-6">
                              <h4 className="text-md font-medium mb-3">Batches by Status</h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {Object.entries(modalDataCoherenceAnalysis.batchesByStatus).map(([status, count]) => (
                                  <div key={status} className="bg-gray-50 p-2 rounded">
                                    <div className="text-sm font-medium text-gray-700">{status}</div>
                                    <div className="text-lg font-semibold text-gray-900">{count as React.ReactNode}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Issues and Warnings */}
                          {(modalDataCoherenceAnalysis.issues.length > 0 || modalDataCoherenceAnalysis.warnings.length > 0) && (
                            <div>
                              {modalDataCoherenceAnalysis.issues.length > 0 && (
                                <div className="mb-4">
                                  <h4 className="text-md font-medium text-red-700 mb-2">Data Coherence Issues:</h4>
                                  <ul className="space-y-1">
                                    {modalDataCoherenceAnalysis.issues.map((issue: string, index: number) => (
                                      <li key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                                        • {issue}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              {modalDataCoherenceAnalysis.warnings.length > 0 && (
                                <div>
                                  <h4 className="text-md font-medium text-yellow-700 mb-2">Data Coherence Warnings:</h4>
                                  <ul className="space-y-1">
                                    {modalDataCoherenceAnalysis.warnings.map((warning: string, index: number) => (
                                      <li key={index} className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                                        • {warning}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

export default FIFODebugger; 