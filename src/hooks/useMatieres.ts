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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/53875ac0-7379-4748-ad91-884130143881',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useMatieres.ts:28',message:'addMatiere entry',data:{userId:user?.uid,companyId:company?.id,matiereName:matiereData.name,matiereCategory:matiereData.refCategorie,matiereUnit:matiereData.unit,matiereCompanyId:matiereData.companyId,initialStock,costPrice},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
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

