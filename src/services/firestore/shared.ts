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
  entityType: 'product' | 'sale' | 'expense' | 'category' | 'objective' | 'finance' | 'supplier' | 'matiere' | 'productionFlowStep' | 'productionFlow' | 'productionCategory' | 'productionCharge' | 'production' | 'order' | 'stock' | 'supplier_debt',
  entityId: string,
  changes: any,
  performedBy: string,
  oldData?: any // NEW parameter to track previous state
) => {
  function replaceUndefined(obj: any): any {
    if (obj === undefined) return null;
    if (obj === null) return null;
    if (typeof obj === 'object') {
      // Handle Date objects and Timestamps
      if (obj instanceof Date) return obj.toISOString();
      if (obj && typeof obj === 'object' && 'seconds' in obj) return new Date(obj.seconds * 1000).toISOString();
      
      const newObj: any = {};
      for (const key in obj) {
        newObj[key] = replaceUndefined(obj[key]);
      }
      return newObj;
    }
    return obj;
  }
  
  const formattedChanges: any = {};
  
  if (action === 'update' && oldData) {
    // For updates, we want to see what changed from -> to
    // If changes object is flat, we map each key
    for (const key in changes) {
      if (changes.hasOwnProperty(key)) {
        // Only record if value actually changed (loose equality to handle types)
        if (JSON.stringify(replaceUndefined(oldData[key])) !== JSON.stringify(replaceUndefined(changes[key]))) {
          formattedChanges[key] = {
            old: replaceUndefined(oldData[key]),
            new: replaceUndefined(changes[key])
          };
        }
      }
    }
    
    // Fallback: if changes object was empty or nothing detected, just store the full change payload
    if (Object.keys(formattedChanges).length === 0 && Object.keys(changes).length > 0) {
      formattedChanges['raw_update'] = replaceUndefined(changes);
    }
  } else {
    // For create/delete, or update without oldData, store as before but wrapped
    formattedChanges.all = {
      old: action === 'delete' ? replaceUndefined(changes) : null,
      new: action === 'create' ? replaceUndefined(changes) : replaceUndefined(changes)
    };
  }
  
  const auditRef = doc(collection(db, 'auditLogs'));
  batch.set(auditRef, {
    action,
    entityType,
    entityId,
    changes: formattedChanges,
    performedBy,
    timestamp: serverTimestamp()
  });
};

