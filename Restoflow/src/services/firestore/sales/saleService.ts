// Sale service for Restoflow
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  addDoc,
  updateDoc,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../../firebase/config';
import type { Sale, SaleProduct, SaleStatus, PaymentStatus, EmployeeRef } from '../../../types/geskap';
import { createAuditLog } from '../shared';
import { consumeStockFIFO } from '../stock/stockService';

// ============================================================================
// SALE SUBSCRIPTIONS
// ============================================================================

export const subscribeToSales = (
  restaurantId: string,
  callback: (sales: Sale[]) => void,
  limitCount: number = 100
): (() => void) => {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'restaurants', restaurantId, 'sales'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(q, (snapshot) => {
    const sales = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Sale[];
    callback(sales.filter(sale => sale.isAvailable !== false));
  }, (error) => {
    console.error('Error in sales subscription:', error);
    callback([]);
  });
};

export const subscribeToSalesByStatus = (
  restaurantId: string,
  status: SaleStatus,
  callback: (sales: Sale[]) => void
): (() => void) => {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'restaurants', restaurantId, 'sales'),
    where('status', '==', status),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  return onSnapshot(q, (snapshot) => {
    const sales = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Sale[];
    callback(sales.filter(sale => sale.isAvailable !== false));
  }, (error) => {
    console.error('Error in sales by status subscription:', error);
    callback([]);
  });
};

// ============================================================================
// SALE CRUD OPERATIONS
// ============================================================================

export const createSale = async (
  data: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>,
  restaurantId: string,
  createdBy?: EmployeeRef | null
): Promise<Sale> => {
  const batch = writeBatch(db);
  const userId = data.userId || restaurantId;

  // Calculate totals
  let totalCost = 0;
  let totalProfit = 0;
  const productsWithProfit: SaleProduct[] = [];

  // Process each product and consume stock
  for (const product of data.products) {
    const { totalCost: productCost, consumedBatches } = await consumeStockFIFO(
      restaurantId,
      'product',
      product.productId,
      product.quantity,
      userId,
      'sale'
    );

    const price = product.negotiatedPrice || product.basePrice;
    const revenue = price * product.quantity;
    const profit = revenue - productCost;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

    productsWithProfit.push({
      ...product,
      costPrice: productCost / product.quantity,
      profit,
      profitMargin,
      consumedBatches
    });

    totalCost += productCost;
    totalProfit += profit;
  }

  const saleRef = doc(collection(db, 'restaurants', restaurantId, 'sales'));

  const saleData: any = {
    products: productsWithProfit,
    totalAmount: data.totalAmount,
    totalCost,
    totalProfit,
    averageProfitMargin: data.totalAmount > 0 ? (totalProfit / data.totalAmount) * 100 : 0,
    status: data.status,
    paymentStatus: data.paymentStatus,
    customerInfo: data.customerInfo,
    userId,
    restaurantId,
    isAvailable: true,
    inventoryMethod: data.inventoryMethod || 'FIFO',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    statusHistory: [{
      status: data.status,
      timestamp: new Date().toISOString(),
      userId
    }]
  };

  // Add optional fields
  if (data.customerSourceId) saleData.customerSourceId = data.customerSourceId;
  if (data.deliveryFee) saleData.deliveryFee = data.deliveryFee;
  if (data.discountType) saleData.discountType = data.discountType;
  if (data.discountValue) saleData.discountValue = data.discountValue;
  if (data.tax !== undefined) saleData.tax = data.tax;
  if (data.paymentMethod) saleData.paymentMethod = data.paymentMethod;
  if (data.amountReceived !== undefined) saleData.amountReceived = data.amountReceived;
  if (data.change !== undefined) saleData.change = data.change;
  if (data.tableNumber !== undefined) saleData.tableNumber = data.tableNumber;
  if (data.orderId) saleData.orderId = data.orderId;
  if (data.tvaRate !== undefined) saleData.tvaRate = data.tvaRate;
  if (data.tvaApplied !== undefined) saleData.tvaApplied = data.tvaApplied;
  if (createdBy) saleData.createdBy = createdBy;

  // Handle credit sales
  if (data.status === 'credit') {
    saleData.paidAmount = data.paidAmount || 0;
    saleData.remainingAmount = data.totalAmount - (data.paidAmount || 0);
    if (data.creditDueDate) saleData.creditDueDate = data.creditDueDate;
  }

  batch.set(saleRef, saleData);
  createAuditLog(batch, 'create', 'sale', saleRef.id, saleData, userId);

  await batch.commit();

  return {
    id: saleRef.id,
    ...saleData,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
  };
};

export const updateSaleStatus = async (
  saleId: string,
  restaurantId: string,
  newStatus: SaleStatus,
  userId: string
): Promise<void> => {
  const saleRef = doc(db, 'restaurants', restaurantId, 'sales', saleId);
  const saleSnap = await getDoc(saleRef);

  if (!saleSnap.exists()) {
    throw new Error('Sale not found');
  }

  const sale = saleSnap.data() as Sale;
  const statusHistory = sale.statusHistory || [];

  statusHistory.push({
    status: newStatus,
    timestamp: new Date().toISOString(),
    userId
  });

  const batch = writeBatch(db);
  batch.update(saleRef, {
    status: newStatus,
    statusHistory,
    updatedAt: serverTimestamp()
  });

  createAuditLog(batch, 'update', 'sale', saleId, { status: newStatus }, userId);

  await batch.commit();
};

export const updatePaymentStatus = async (
  saleId: string,
  restaurantId: string,
  paymentStatus: PaymentStatus,
  paymentDetails?: {
    paymentMethod?: string;
    amountReceived?: number;
    change?: number;
    paidAmount?: number;
  }
): Promise<void> => {
  const saleRef = doc(db, 'restaurants', restaurantId, 'sales', saleId);
  const saleSnap = await getDoc(saleRef);

  if (!saleSnap.exists()) {
    throw new Error('Sale not found');
  }

  const sale = saleSnap.data() as Sale;
  const userId = sale.userId || restaurantId;

  const updates: any = {
    paymentStatus,
    updatedAt: serverTimestamp()
  };

  if (paymentDetails?.paymentMethod) updates.paymentMethod = paymentDetails.paymentMethod;
  if (paymentDetails?.amountReceived !== undefined) updates.amountReceived = paymentDetails.amountReceived;
  if (paymentDetails?.change !== undefined) updates.change = paymentDetails.change;

  // Handle credit payment
  if (sale.status === 'credit' && paymentDetails?.paidAmount !== undefined) {
    const newPaidAmount = (sale.paidAmount || 0) + paymentDetails.paidAmount;
    const newRemainingAmount = sale.totalAmount - newPaidAmount;

    updates.paidAmount = newPaidAmount;
    updates.remainingAmount = newRemainingAmount;

    if (newRemainingAmount <= 0) {
      updates.status = 'paid';
      updates.paymentStatus = 'paid';
    }
  }

  await updateDoc(saleRef, updates);
};

export const softDeleteSale = async (
  saleId: string,
  restaurantId: string
): Promise<void> => {
  const saleRef = doc(db, 'restaurants', restaurantId, 'sales', saleId);
  await updateDoc(saleRef, {
    isAvailable: false,
    updatedAt: serverTimestamp()
  });
};

// ============================================================================
// SALE REFUNDS
// ============================================================================

export const addRefundToSale = async (
  saleId: string,
  restaurantId: string,
  refundAmount: number,
  userId: string,
  reason?: string,
  paymentMethod?: string
): Promise<void> => {
  const saleRef = doc(db, 'restaurants', restaurantId, 'sales', saleId);
  const saleSnap = await getDoc(saleRef);

  if (!saleSnap.exists()) {
    throw new Error('Sale not found');
  }

  const sale = saleSnap.data() as Sale;
  const totalRefunded = (sale.totalRefunded || 0) + refundAmount;

  if (totalRefunded > sale.totalAmount) {
    throw new Error('Refund amount exceeds sale total');
  }

  const refund = {
    id: doc(collection(db, 'temp')).id,
    amount: refundAmount,
    timestamp: new Date().toISOString(),
    userId,
    reason,
    paymentMethod
  };

  const refunds = sale.refunds || [];
  refunds.push(refund);

  const batch = writeBatch(db);
  batch.update(saleRef, {
    refunds,
    totalRefunded,
    updatedAt: serverTimestamp()
  });

  createAuditLog(batch, 'update', 'sale', saleId, { refund }, userId);

  await batch.commit();
};

// ============================================================================
// SALE QUERIES
// ============================================================================

export const getSalesByDateRange = async (
  restaurantId: string,
  startDate: Date,
  endDate: Date
): Promise<Sale[]> => {
  const startTimestamp = Timestamp.fromDate(startDate);
  const endTimestamp = Timestamp.fromDate(endDate);

  const q = query(
    collection(db, 'restaurants', restaurantId, 'sales'),
    where('createdAt', '>=', startTimestamp),
    where('createdAt', '<=', endTimestamp),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    .filter(sale => sale.isAvailable !== false) as Sale[];
};

export const getCreditSales = async (restaurantId: string): Promise<Sale[]> => {
  const q = query(
    collection(db, 'restaurants', restaurantId, 'sales'),
    where('status', '==', 'credit'),
    where('remainingAmount', '>', 0),
    orderBy('remainingAmount', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Sale[];
};

export const getSaleById = async (
  restaurantId: string,
  saleId: string
): Promise<Sale | null> => {
  const saleRef = doc(db, 'restaurants', restaurantId, 'sales', saleId);
  const saleSnap = await getDoc(saleRef);

  if (!saleSnap.exists()) {
    return null;
  }

  return {
    id: saleSnap.id,
    ...saleSnap.data()
  } as Sale;
};
