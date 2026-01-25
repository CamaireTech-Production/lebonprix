// useSales hook for Restoflow
import { useState, useEffect, useCallback } from 'react';
import type { Sale, SaleStatus, PaymentStatus, EmployeeRef } from '../../types/geskap';
import {
  subscribeToSales,
  subscribeToSalesByStatus,
  createSale,
  updateSaleStatus,
  updatePaymentStatus,
  softDeleteSale,
  addRefundToSale,
  getSalesByDateRange,
  getCreditSales,
  getSaleById
} from '../../services/firestore/sales';

interface UseSalesOptions {
  restaurantId: string;
  userId: string;
  createdBy?: EmployeeRef | null;
  statusFilter?: SaleStatus;
  limitCount?: number;
}

interface UseSalesReturn {
  sales: Sale[];
  loading: boolean;
  error: string | null;
  createSale: (data: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Sale>;
  updateStatus: (saleId: string, newStatus: SaleStatus) => Promise<void>;
  updatePayment: (
    saleId: string,
    paymentStatus: PaymentStatus,
    paymentDetails?: { paymentMethod?: string; amountReceived?: number; change?: number; paidAmount?: number }
  ) => Promise<void>;
  deleteSale: (saleId: string) => Promise<void>;
  addRefund: (saleId: string, amount: number, reason?: string, paymentMethod?: string) => Promise<void>;
  getSalesByDate: (startDate: Date, endDate: Date) => Promise<Sale[]>;
  getCreditSales: () => Promise<Sale[]>;
  getSale: (saleId: string) => Promise<Sale | null>;
}

export const useSales = ({
  restaurantId,
  userId,
  createdBy,
  statusFilter,
  limitCount = 100
}: UseSalesOptions): UseSalesReturn => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setSales([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let unsubscribe: () => void;

    if (statusFilter) {
      unsubscribe = subscribeToSalesByStatus(restaurantId, statusFilter, (data) => {
        setSales(data);
        setLoading(false);
      });
    } else {
      unsubscribe = subscribeToSales(restaurantId, (data) => {
        setSales(data);
        setLoading(false);
      }, limitCount);
    }

    return () => unsubscribe();
  }, [restaurantId, statusFilter, limitCount]);

  const handleCreateSale = useCallback(
    async (data: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>) => {
      try {
        return await createSale({ ...data, userId, restaurantId }, restaurantId, createdBy);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId, userId, createdBy]
  );

  const handleUpdateStatus = useCallback(
    async (saleId: string, newStatus: SaleStatus) => {
      try {
        await updateSaleStatus(saleId, restaurantId, newStatus, userId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId, userId]
  );

  const handleUpdatePayment = useCallback(
    async (
      saleId: string,
      paymentStatus: PaymentStatus,
      paymentDetails?: { paymentMethod?: string; amountReceived?: number; change?: number; paidAmount?: number }
    ) => {
      try {
        await updatePaymentStatus(saleId, restaurantId, paymentStatus, paymentDetails);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleDeleteSale = useCallback(
    async (saleId: string) => {
      try {
        await softDeleteSale(saleId, restaurantId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleAddRefund = useCallback(
    async (saleId: string, amount: number, reason?: string, paymentMethod?: string) => {
      try {
        await addRefundToSale(saleId, restaurantId, amount, userId, reason, paymentMethod);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId, userId]
  );

  const handleGetSalesByDate = useCallback(
    async (startDate: Date, endDate: Date) => {
      try {
        return await getSalesByDateRange(restaurantId, startDate, endDate);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleGetCreditSales = useCallback(async () => {
    try {
      return await getCreditSales(restaurantId);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [restaurantId]);

  const handleGetSale = useCallback(
    async (saleId: string) => {
      try {
        return await getSaleById(restaurantId, saleId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  return {
    sales,
    loading,
    error,
    createSale: handleCreateSale,
    updateStatus: handleUpdateStatus,
    updatePayment: handleUpdatePayment,
    deleteSale: handleDeleteSale,
    addRefund: handleAddRefund,
    getSalesByDate: handleGetSalesByDate,
    getCreditSales: handleGetCreditSales,
    getSale: handleGetSale
  };
};
