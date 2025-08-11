import type { StockBatch, Sale, Product } from '../types/models';

export interface FIFOAnalysis {
  productId: string;
  productName: string;
  totalStock: number;
  totalValue: number;
  averageCostPrice: number;
  batches: StockBatch[];
  sales: Sale[];
  stockMovements: {
    type: 'restock' | 'sale' | 'adjustment';
    quantity: number;
    costPrice?: number;
    date: Date;
    batchId?: string;
  }[];
  fifoSimulation: {
    remainingStock: number;
    consumedBatches: Array<{
      batchId: string;
      consumedQuantity: number;
      remainingQuantity: number;
      costPrice: number;
    }>;
  };
}

/**
 * Analyze FIFO/LIFO behavior for a specific product
 */
export const analyzeFIFO = (
  product: Product,
  batches: StockBatch[],
  sales: Sale[]
): FIFOAnalysis => {
  const productSales = sales.filter(sale => 
    sale.products.some(p => p.productId === product.id)
  );

  // Calculate total stock and value
  const activeBatches = batches.filter(b => b.status === 'active' && b.remainingQuantity > 0);
  const totalStock = activeBatches.reduce((sum, b) => sum + b.remainingQuantity, 0);
  const totalValue = activeBatches.reduce((sum, b) => sum + (b.remainingQuantity * b.costPrice), 0);
  const averageCostPrice = totalStock > 0 ? totalValue / totalStock : 0;

  // Create stock movements timeline
  const stockMovements = [];
  
  // Add batch creations (restocks)
  batches.forEach(batch => {
    stockMovements.push({
      type: 'restock' as const,
      quantity: batch.quantity,
      costPrice: batch.costPrice,
      date: new Date(batch.createdAt.seconds * 1000),
      batchId: batch.id
    });
  });

  // Add sales
  productSales.forEach(sale => {
    const productInSale = sale.products.find(p => p.productId === product.id);
    if (productInSale) {
      stockMovements.push({
        type: 'sale' as const,
        quantity: -productInSale.quantity,
        costPrice: productInSale.costPrice,
        date: new Date(sale.createdAt.seconds * 1000),
        batchId: productInSale.batchId
      });
    }
  });

  // Sort by date
  stockMovements.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Simulate FIFO consumption
  const fifoSimulation = simulateFIFOConsumption(activeBatches, totalStock);

  return {
    productId: product.id,
    productName: product.name,
    totalStock,
    totalValue,
    averageCostPrice,
    batches,
    sales: productSales,
    stockMovements,
    fifoSimulation
  };
};

/**
 * Simulate FIFO consumption of stock
 */
export const simulateFIFOConsumption = (
  batches: StockBatch[],
  quantityToConsume: number
) => {
  // Sort by creation date (FIFO)
  const sortedBatches = [...batches].sort((a, b) => 
    (a.createdAt.seconds || 0) - (b.createdAt.seconds || 0)
  );

  let remainingQuantity = quantityToConsume;
  const consumedBatches = [];

  for (const batch of sortedBatches) {
    if (remainingQuantity <= 0) break;

    const consumeQuantity = Math.min(remainingQuantity, batch.remainingQuantity);
    const newRemainingQuantity = batch.remainingQuantity - consumeQuantity;

    consumedBatches.push({
      batchId: batch.id,
      consumedQuantity: consumeQuantity,
      remainingQuantity: newRemainingQuantity,
      costPrice: batch.costPrice
    });

    remainingQuantity -= consumeQuantity;
  }

  return {
    remainingStock: remainingQuantity,
    consumedBatches
  };
};

/**
 * Calculate profit margin for a sale
 */
export const calculateProfitMargin = (
  sellingPrice: number,
  costPrice: number,
  quantity: number
) => {
  const totalRevenue = sellingPrice * quantity;
  const totalCost = costPrice * quantity;
  const profit = totalRevenue - totalCost;
  const profitMargin = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  return {
    totalRevenue,
    totalCost,
    profit,
    profitMargin
  };
};

/**
 * Validate FIFO/LIFO consistency
 */
export const validateFIFOConsistency = (
  product: Product,
  batches: StockBatch[],
  sales: Sale[]
): {
  isValid: boolean;
  issues: string[];
  warnings: string[];
} => {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Check if product stock matches batch totals
  const activeBatches = batches.filter(b => b.status === 'active');
  const batchStock = activeBatches.reduce((sum, b) => sum + b.remainingQuantity, 0);
  
  if (batchStock !== product.stock) {
    issues.push(`Stock mismatch: Product shows ${product.stock} but batches total ${batchStock}`);
  }

  // Check for negative remaining quantities
  const negativeBatches = batches.filter(b => b.remainingQuantity < 0);
  if (negativeBatches.length > 0) {
    issues.push(`Found ${negativeBatches.length} batches with negative remaining quantities`);
  }

  // Check for sales without batch references
  const productSales = sales.filter(sale => 
    sale.products.some(p => p.productId === product.id)
  );
  
  const salesWithoutBatches = productSales.filter(sale => 
    sale.products.some(p => p.productId === product.id && !p.batchId)
  );
  
  if (salesWithoutBatches.length > 0) {
    warnings.push(`Found ${salesWithoutBatches.length} sales without batch references`);
  }

  // Check for inconsistent cost prices
  const salesWithCostPrices = productSales.filter(sale => 
    sale.products.some(p => p.productId === product.id && p.costPrice)
  );
  
  const costPriceVariations = new Set();
  salesWithCostPrices.forEach(sale => {
    sale.products.forEach(p => {
      if (p.productId === product.id && p.costPrice) {
        costPriceVariations.add(p.costPrice);
      }
    });
  });

  if (costPriceVariations.size > 1) {
    warnings.push(`Found ${costPriceVariations.size} different cost prices in sales (expected for FIFO/LIFO)`);
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings
  };
};

/**
 * Generate a summary report for debugging
 */
export const generateFIFOSummary = (
  products: Product[],
  batches: StockBatch[],
  sales: Sale[]
) => {
  const summary = {
    totalProducts: products.length,
    totalBatches: batches.length,
    totalSales: sales.length,
    productsWithBatches: 0,
    productsWithoutBatches: 0,
    activeBatches: 0,
    depletedBatches: 0,
    totalStockValue: 0,
    averageCostPrice: 0
  };

  // Count products with/without batches
  const productIdsWithBatches = new Set(batches.map(b => b.productId));
  summary.productsWithBatches = productIdsWithBatches.size;
  summary.productsWithoutBatches = products.length - summary.productsWithBatches;

  // Count batch statuses
  summary.activeBatches = batches.filter(b => b.status === 'active').length;
  summary.depletedBatches = batches.filter(b => b.status === 'depleted').length;

  // Calculate total stock value
  const activeBatches = batches.filter(b => b.status === 'active');
  summary.totalStockValue = activeBatches.reduce((sum, b) => 
    sum + (b.remainingQuantity * b.costPrice), 0
  );

  const totalStock = activeBatches.reduce((sum, b) => sum + b.remainingQuantity, 0);
  summary.averageCostPrice = totalStock > 0 ? summary.totalStockValue / totalStock : 0;

  return summary;
}; 