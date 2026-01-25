// src/services/storage/FinanceEntryTypesManager.ts
import localStorageService from '@services/utilities/localStorageService';
import type { FinanceEntryType } from '../../types/models';

const FINANCE_ENTRY_TYPES_PREFIX = 'finance_entry_types_';
const FINANCE_ENTRY_TYPES_TTL = 30 * 60 * 1000; // 30 minutes - these rarely change

class FinanceEntryTypesManager {
  static getKey(userId: string): string {
    return `${FINANCE_ENTRY_TYPES_PREFIX}${userId}`;
  }

  static load(userId: string): FinanceEntryType[] | null {
    return localStorageService.get<FinanceEntryType[]>(FinanceEntryTypesManager.getKey(userId));
  }

  static save(userId: string, entryTypes: FinanceEntryType[]): void {
    localStorageService.set(FinanceEntryTypesManager.getKey(userId), entryTypes, FINANCE_ENTRY_TYPES_TTL);
  }

  static remove(userId: string): void {
    localStorageService.remove(FinanceEntryTypesManager.getKey(userId));
  }

  static needsSync(userId: string): boolean {
    const lastSync = localStorageService.getLastSync(FinanceEntryTypesManager.getKey(userId));
    if (!lastSync) return true; // No data or no sync yet
    return (Date.now() - lastSync) > FINANCE_ENTRY_TYPES_TTL;
  }

  static updateLastSync(userId: string): void {
    localStorageService.updateLastSync(FinanceEntryTypesManager.getKey(userId));
  }

  /**
   * Compares two arrays of finance entry types to check for changes.
   * This is a shallow comparison based on length and item IDs/names.
   */
  static hasChanged(localTypes: FinanceEntryType[], remoteTypes: FinanceEntryType[]): boolean {
    if (localTypes.length !== remoteTypes.length) {
      return true;
    }
    
    // Simple check: if any type ID or name differs, assume change
    for (let i = 0; i < localTypes.length; i++) {
      if (localTypes[i].id !== remoteTypes[i].id || 
          localTypes[i].name !== remoteTypes[i].name) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get last sync timestamp for entry types
   */
  static getLastSync(userId: string): number | null {
    return localStorageService.getLastSync(FinanceEntryTypesManager.getKey(userId));
  }
}

export default FinanceEntryTypesManager;
