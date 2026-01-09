// src/services/storage/CompanyManager.ts
import localStorageService from '@services/utilities/localStorageService';
import type { Company } from '../../types/models';

const COMPANY_PREFIX = 'company_';
const COMPANY_TTL = 24 * 60 * 60 * 1000; // 24 hours (company data rarely changes)

class CompanyManager {
  static getKey(userId: string): string {
    return `${COMPANY_PREFIX}${userId}`;
  }

  static load(userId: string): Company | null {
    return localStorageService.get<Company>(CompanyManager.getKey(userId));
  }

  static save(userId: string, company: Company): void {
    localStorageService.set(CompanyManager.getKey(userId), company, COMPANY_TTL);
  }

  static remove(userId: string): void {
    localStorageService.remove(CompanyManager.getKey(userId));
  }

  static needsSync(userId: string): boolean {
    const lastSync = localStorageService.getLastSync(CompanyManager.getKey(userId));
    if (!lastSync) return true; // No data or no sync yet
    return (Date.now() - lastSync) > COMPANY_TTL;
  }

  static updateLastSync(userId: string): void {
    localStorageService.updateLastSync(CompanyManager.getKey(userId));
  }

  static hasChanged(localCompany: Company, remoteCompany: Company): boolean {
    // Simple comparison - could be enhanced with deep comparison
    return JSON.stringify(localCompany) !== JSON.stringify(remoteCompany);
  }

  static getLastSync(userId: string): number | null {
    return localStorageService.getLastSync(CompanyManager.getKey(userId));
  }
}

export default CompanyManager;
