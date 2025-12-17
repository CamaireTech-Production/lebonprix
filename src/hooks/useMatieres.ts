import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToMatieres, createMatiere, updateMatiere, deleteMatiere } from '../services/firestore';
import type { Matiere } from '../types/models';
import { getCurrentEmployeeRef } from '../utils/employeeUtils';
import { getUserById } from '../services/userService';

export const useMatieres = () => {
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, company, currentEmployee, isOwner } = useAuth();

  useEffect(() => {
    if (!user || !company) return;
    
    setLoading(true);
    
    const unsubscribe = subscribeToMatieres(company.id, (data) => {
      setMatieres(data);
      setLoading(false);
      setError(null);
    });

    return () => unsubscribe();
  }, [user, company]);

  const addMatiere = async (
    matiereData: Omit<Matiere, 'id' | 'createdAt' | 'updatedAt'>,
    initialStock: number = 0,
    costPrice?: number,
    supplierInfo?: {
      supplierId?: string;
      isOwnPurchase?: boolean;
      isCredit?: boolean;
    }
  ) => {
    if (!user || !company) throw new Error('User not authenticated');
    
    try {
      // Get createdBy employee reference
      let createdBy = null;
      if (user && company) {
        let userData = null;
        if (isOwner && !currentEmployee) {
          // If owner, fetch user data to create EmployeeRef
          try {
            userData = await getUserById(user.uid);
          } catch (error) {
            // Ignore error, createdBy will be null
          }
        }
        createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
      }
      
      const createdMatiere = await createMatiere(
        matiereData,
        company.id,
        initialStock,
        costPrice,
        supplierInfo,
        createdBy
      );
      return createdMatiere;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateMatiereData = async (
    matiereId: string,
    data: Partial<Matiere>
  ) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await updateMatiere(matiereId, data, company.id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const deleteMatiereData = async (matiereId: string) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await deleteMatiere(matiereId, company.id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return {
    matieres,
    loading,
    error,
    addMatiere,
    updateMatiereData,
    deleteMatiereData
  };
};

