// useSuppliers hook for Restoflow
import { useState, useEffect, useCallback } from 'react';
import type { Supplier, SupplierDebt, EmployeeRef } from '../../types/geskap';
import {
  subscribeToSuppliers,
  createSupplier,
  updateSupplier,
  softDeleteSupplier,
  getSupplierDebt,
  addSupplierDebt,
  addSupplierRefund,
  getAllSupplierDebts
} from '../../services/firestore/suppliers';

interface UseSuppliersOptions {
  restaurantId: string;
  userId: string;
  createdBy?: EmployeeRef | null;
}

interface UseSuppliersReturn {
  suppliers: Supplier[];
  loading: boolean;
  error: string | null;
  addSupplier: (data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Supplier>;
  updateSupplier: (supplierId: string, data: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (supplierId: string) => Promise<void>;
  getDebt: (supplierId: string) => Promise<SupplierDebt | null>;
  addDebt: (supplierId: string, amount: number, description: string, batchId?: string) => Promise<void>;
  addRefund: (supplierId: string, amount: number, description: string, refundedDebtId?: string) => Promise<void>;
  getAllDebts: () => Promise<SupplierDebt[]>;
}

export const useSuppliers = ({
  restaurantId,
  userId,
  createdBy
}: UseSuppliersOptions): UseSuppliersReturn => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setSuppliers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToSuppliers(restaurantId, (data) => {
      setSuppliers(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [restaurantId]);

  const handleAddSupplier = useCallback(
    async (data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) => {
      try {
        return await createSupplier({ ...data, userId, restaurantId }, restaurantId, createdBy);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId, userId, createdBy]
  );

  const handleUpdateSupplier = useCallback(
    async (supplierId: string, data: Partial<Supplier>) => {
      try {
        await updateSupplier(supplierId, data, restaurantId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleDeleteSupplier = useCallback(
    async (supplierId: string) => {
      try {
        await softDeleteSupplier(supplierId, restaurantId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleGetDebt = useCallback(
    async (supplierId: string) => {
      try {
        return await getSupplierDebt(supplierId, restaurantId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleAddDebt = useCallback(
    async (supplierId: string, amount: number, description: string, batchId?: string) => {
      try {
        await addSupplierDebt(supplierId, amount, description, restaurantId, userId, batchId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId, userId]
  );

  const handleAddRefund = useCallback(
    async (supplierId: string, amount: number, description: string, refundedDebtId?: string) => {
      try {
        await addSupplierRefund(supplierId, amount, description, restaurantId, refundedDebtId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleGetAllDebts = useCallback(async () => {
    try {
      return await getAllSupplierDebts(restaurantId);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [restaurantId]);

  return {
    suppliers,
    loading,
    error,
    addSupplier: handleAddSupplier,
    updateSupplier: handleUpdateSupplier,
    deleteSupplier: handleDeleteSupplier,
    getDebt: handleGetDebt,
    addDebt: handleAddDebt,
    addRefund: handleAddRefund,
    getAllDebts: handleGetAllDebts
  };
};
