// useMatieres hook for Restoflow (Ingredients)
import { useState, useEffect, useCallback } from 'react';
import type { Matiere, EmployeeRef } from '../../types/geskap';
import {
  subscribeToMatieres,
  createMatiere,
  updateMatiere,
  softDeleteMatiere,
  deleteMatiere
} from '../../services/firestore/matieres';

interface UseMatieresOptions {
  restaurantId: string;
  userId: string;
  createdBy?: EmployeeRef | null;
}

interface UseMatieresReturn {
  matieres: Matiere[];
  loading: boolean;
  error: string | null;
  addMatiere: (
    data: Omit<Matiere, 'id' | 'createdAt' | 'updatedAt'>,
    initialStock?: number,
    costPrice?: number,
    supplierInfo?: { supplierId?: string; isOwnPurchase?: boolean; isCredit?: boolean }
  ) => Promise<Matiere>;
  updateMatiere: (matiereId: string, data: Partial<Matiere>) => Promise<void>;
  softDeleteMatiere: (matiereId: string) => Promise<void>;
  deleteMatiere: (matiereId: string) => Promise<void>;
}

export const useMatieres = ({
  restaurantId,
  userId,
  createdBy
}: UseMatieresOptions): UseMatieresReturn => {
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setMatieres([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToMatieres(restaurantId, (data) => {
      setMatieres(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [restaurantId]);

  const handleAddMatiere = useCallback(
    async (
      data: Omit<Matiere, 'id' | 'createdAt' | 'updatedAt'>,
      initialStock?: number,
      costPrice?: number,
      supplierInfo?: { supplierId?: string; isOwnPurchase?: boolean; isCredit?: boolean }
    ) => {
      try {
        return await createMatiere(
          { ...data, userId, restaurantId },
          restaurantId,
          initialStock,
          costPrice,
          supplierInfo,
          createdBy
        );
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId, userId, createdBy]
  );

  const handleUpdateMatiere = useCallback(
    async (matiereId: string, data: Partial<Matiere>) => {
      try {
        await updateMatiere(matiereId, data, restaurantId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleSoftDeleteMatiere = useCallback(
    async (matiereId: string) => {
      try {
        await softDeleteMatiere(matiereId, restaurantId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleDeleteMatiere = useCallback(
    async (matiereId: string) => {
      try {
        await deleteMatiere(matiereId, restaurantId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  return {
    matieres,
    loading,
    error,
    addMatiere: handleAddMatiere,
    updateMatiere: handleUpdateMatiere,
    softDeleteMatiere: handleSoftDeleteMatiere,
    deleteMatiere: handleDeleteMatiere
  };
};
