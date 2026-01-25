// Shared utilities for firestore services
import {
  collection,
  doc,
  serverTimestamp,
  type WriteBatch
} from 'firebase/firestore';
import { db } from '../../firebase/config';

/**
 * Entity types for audit logging
 */
export type AuditEntityType =
  | 'customer'
  | 'expense'
  | 'supplier'
  | 'matiere'
  | 'sale'
  | 'finance'
  | 'category'
  | 'stock'
  | 'order'
  | 'menu_item'
  | 'table'
  | 'employee'
  | 'invitation'
  | 'permission_template';

/**
 * Create an audit log entry
 */
export const createAuditLog = (
  batch: WriteBatch,
  action: 'create' | 'update' | 'delete',
  entityType: AuditEntityType,
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

/**
 * Clean data object by removing undefined values
 * Firestore doesn't support undefined values
 */
export const cleanData = <T extends Record<string, any>>(data: T): Partial<T> => {
  const cleaned: Partial<T> = {};
  for (const key in data) {
    if (data[key] !== undefined) {
      cleaned[key] = data[key];
    }
  }
  return cleaned;
};

/**
 * Convert a date to Firestore Timestamp or serverTimestamp
 */
export const toFirestoreDate = (date: Date | any | undefined) => {
  if (!date) {
    return serverTimestamp();
  }
  if (date instanceof Date) {
    return { seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 };
  }
  if (date.seconds) {
    return date;
  }
  return serverTimestamp();
};
