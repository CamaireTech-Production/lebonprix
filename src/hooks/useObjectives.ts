import { useEffect, useState, useCallback } from 'react';
import { Objective } from '../types/models';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToObjectives, createObjective, updateObjective as updateObjectiveService, deleteObjective as deleteObjectiveService } from '../services/firestore';

export const useObjectives = () => {
  const { currentUser } = useAuth();
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    
    const unsubscribe = subscribeToObjectives(currentUser.uid, (objectives) => {
      setObjectives(objectives);
      setLoading(false);
    });
    
    return unsubscribe;
  }, [currentUser]);

  const addObjective = useCallback(async (objective: Omit<Objective, 'id' | 'createdAt' | 'userId'>) => {
    if (!currentUser) throw new Error('Not authenticated');
    return await createObjective(objective, currentUser.uid);
  }, [currentUser]);

  const updateObjective = useCallback(async (id: string, data: Partial<Objective>) => {
    if (!currentUser) throw new Error('Not authenticated');
    return await updateObjectiveService(id, data, currentUser.uid);
  }, [currentUser]);

  const deleteObjective = useCallback(async (id: string) => {
    if (!currentUser) throw new Error('Not authenticated');
    return await deleteObjectiveService(id, currentUser.uid);
  }, [currentUser]);

  return { objectives, loading, addObjective, updateObjective, deleteObjective };
}; 