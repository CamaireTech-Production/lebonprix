import { useEffect, useState, useCallback } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Objective } from '../types/models';
import { useAuth } from '../contexts/AuthContext';

export const useObjectives = () => {
  const { currentUser } = useAuth();
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'objectives'), where('userId', '==', currentUser.uid));
    const unsub = onSnapshot(q, snapshot => {
      const data: Objective[] = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Objective));
      setObjectives(data);
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser]);

  const addObjective = useCallback(async (objective: Omit<Objective, 'id' | 'createdAt' | 'userId'>) => {
    if (!currentUser) throw new Error('Not authenticated');
    await addDoc(collection(db, 'objectives'), {
      ...objective,
      userId: currentUser.uid,
      createdAt: serverTimestamp(),
    });
  }, [currentUser]);

  const updateObjective = useCallback(async (id: string, data: Partial<Objective>) => {
    await updateDoc(doc(db, 'objectives', id), data);
  }, []);

  const deleteObjective = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'objectives', id));
  }, []);

  return { objectives, loading, addObjective, updateObjective, deleteObjective };
}; 