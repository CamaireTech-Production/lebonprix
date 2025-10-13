// src/services/storage/FinanceTypesManager.ts
import localStorageService from '../localStorageService';

const FINANCE_TYPES_SETUP_PREFIX = 'finance_types_setup_';
const FINANCE_TYPES_SETUP_TTL = 365 * 24 * 60 * 60 * 1000; // 1 year (setup is permanent)

class FinanceTypesManager {
  static getKey(userId: string): string {
    return `${FINANCE_TYPES_SETUP_PREFIX}${userId}`;
  }

  static isSetup(userId: string): boolean {
    const setupFlag = localStorageService.get<boolean>(FinanceTypesManager.getKey(userId));
    return setupFlag === true;
  }

  static markAsSetup(userId: string): void {
    localStorageService.set(FinanceTypesManager.getKey(userId), true, FINANCE_TYPES_SETUP_TTL);
  }

  static needsSetup(userId: string): boolean {
    return !FinanceTypesManager.isSetup(userId);
  }

  static remove(userId: string): void {
    localStorageService.remove(FinanceTypesManager.getKey(userId));
  }
}

export default FinanceTypesManager;
