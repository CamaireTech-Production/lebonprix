import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ActivityLog } from '../types';

export async function logActivity({ userId, userEmail, action, entityType, entityId, details }: ActivityLog) {
  const db = getFirestore();
  const log: any = {
    userId,
    userEmail,
    action,
    entityType,
    details: details || null,
    timestamp: serverTimestamp(),
  };
  if (entityId !== undefined) log.entityId = entityId;
  await addDoc(collection(db, 'activityLogs'), log);
} 