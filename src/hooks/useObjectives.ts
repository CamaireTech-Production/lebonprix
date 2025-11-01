import { useEffect, useState, useCallback } from 'react';
import { Objective } from '../types/models';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToObjectives, createObjective, updateObjective as updateObjectiveService, deleteObjective as deleteObjectiveService } from '../services/firestore';

export const useObjectives = () => {
  const { user, company } = useAuth();
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !company) return;
    
    const unsubscribe = subscribeToObjectives(company.id, (objectives) => {
      setObjectives(objectives);
      setLoading(false);
    });
    
    return unsubscribe;
  }, [user, company]);

  const addObjective = useCallback(async (objective: Omit<Objective, 'id' | 'createdAt' | 'userId' | 'companyId'>) => {
    if (!user || !company) throw new Error('Not authenticated');
    return await createObjective({ ...objective, userId: user.uid, companyId: company.id }, company.id);
  }, [user, company]);

  const updateObjective = useCallback(async (id: string, data: Partial<Objective>) => {
    if (!user || !company) throw new Error('Not authenticated');
    return await updateObjectiveService(id, data, company.id);
  }, [user, company]);

  const deleteObjective = useCallback(async (id: string) => {
    if (!user || !company) throw new Error('Not authenticated');
    return await deleteObjectiveService(id, company.id);
  }, [user, company]);

  return { objectives, loading, addObjective, updateObjective, deleteObjective };
}; 