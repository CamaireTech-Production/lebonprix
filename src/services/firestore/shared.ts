// Shared utilities for firestore services
import {
  collection,
  doc,
  serverTimestamp,
  type WriteBatch
} from 'firebase/firestore';
import { db } from '../core/firebase';

/**
 * Create an audit log entry
 */
export const createAuditLog = async (
  batch: WriteBatch,
  action: 'create' | 'update' | 'delete',
  entityType: 'product' | 'sale' | 'expense' | 'category' | 'objective' | 'finance' | 'supplier' | 'matiere',
  entityId: string,
  changes: any,
  performedBy: string
) => {
  function replaceUndefined(obj: any): any {
    if (obj === undefined) return null;
    if (obj === null) return null;
    if (typeof obj === 'object') {
      const newObj: any = {};
      for (const key in obj) {
        newObj[key] = replaceUndefined(obj[key]);
      }
      return newObj;
    }
    return obj;
  }
  
  const auditRef = doc(collection(db, 'auditLogs'));
  batch.set(auditRef, {
    action,
    entityType,
    entityId,
    changes: replaceUndefined(changes),
    performedBy,
    timestamp: serverTimestamp()
  });
};

