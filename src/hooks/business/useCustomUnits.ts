import { useState, useEffect } from 'react';
import { useAuth } from '@contexts/AuthContext';
import {
  subscribeToCustomUnits,
  createCustomUnit,
  updateCustomUnit,
  deleteCustomUnit,
  type CustomUnit
} from '@services/firestore/customUnits';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import { getCurrentEmployeeRef } from '@utils/business/employeeUtils';
import { getUserById } from '@services/utilities/userService';

export const useCustomUnits = () => {
  const { user, company } = useAuth();
  const [customUnits, setCustomUnits] = useState<CustomUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!company?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToCustomUnits(company.id, (units) => {
      setCustomUnits(units);
      setLoading(false);
      setError(null);
    });

    return () => {
      unsubscribe();
    };
  }, [company?.id]);

  const addCustomUnit = async (
    value: string,
    label: string
  ): Promise<CustomUnit | null> => {
    if (!user || !company) {
      showErrorToast('Utilisateur non authentifié');
      return null;
    }

    try {
      // Get employee reference for createdBy
      let createdBy = null;
      try {
        const userData = await getUserById(user.uid);
        createdBy = getCurrentEmployeeRef(null, { uid: user.uid } as any, true, userData);
      } catch (error) {
        console.error('Error fetching user data for createdBy:', error);
      }

      const newUnit = await createCustomUnit(
        {
          value,
          label,
          companyId: company.id,
          userId: user.uid,
          isDeleted: false
        },
        company.id,
        createdBy
      );

      showSuccessToast('Unité personnalisée créée avec succès');
      return newUnit;
    } catch (error: any) {
      console.error('Error adding custom unit:', error);
      showErrorToast(error.message || 'Erreur lors de la création de l\'unité');
      throw error;
    }
  };

  const updateCustomUnitData = async (
    id: string,
    data: Partial<CustomUnit>
  ): Promise<void> => {
    if (!company) {
      showErrorToast('Entreprise non trouvée');
      return;
    }

    try {
      await updateCustomUnit(id, data, company.id);
      showSuccessToast('Unité personnalisée mise à jour avec succès');
    } catch (error: any) {
      console.error('Error updating custom unit:', error);
      showErrorToast(error.message || 'Erreur lors de la mise à jour de l\'unité');
      throw error;
    }
  };

  const deleteCustomUnitData = async (id: string): Promise<void> => {
    if (!company) {
      showErrorToast('Entreprise non trouvée');
      return;
    }

    try {
      await deleteCustomUnit(id, company.id);
      showSuccessToast('Unité personnalisée supprimée avec succès');
    } catch (error: any) {
      console.error('Error deleting custom unit:', error);
      showErrorToast(error.message || 'Erreur lors de la suppression de l\'unité');
      throw error;
    }
  };

  return {
    customUnits,
    loading,
    error,
    addCustomUnit,
    updateCustomUnitData,
    deleteCustomUnitData
  };
};

