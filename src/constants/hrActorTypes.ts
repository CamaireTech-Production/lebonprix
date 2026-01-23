/**
 * HR Actor Types Constants
 *
 * Defines the available types of HR actors in the system.
 * These represent real human resources personnel, not app users.
 */

export const HR_ACTOR_TYPES = {
  GARDIEN: 'gardien',
  CAISSIER: 'caissier',
  MAGASINIER: 'magasinier',
  LIVREUR: 'livreur',
  COMPTABLE: 'comptable',
  MANAGER: 'manager',
  SECRETAIRE: 'secretaire',
  TECHNICIEN: 'technicien',
  COMMERCIAL: 'commercial',
  CUSTOM: 'custom',
} as const;

export type HRActorType = typeof HR_ACTOR_TYPES[keyof typeof HR_ACTOR_TYPES];

/**
 * Human-readable labels for HR actor types
 */
export const HR_ACTOR_TYPE_LABELS: Record<string, string> = {
  [HR_ACTOR_TYPES.GARDIEN]: 'Gardien',
  [HR_ACTOR_TYPES.CAISSIER]: 'Caissier(ère)',
  [HR_ACTOR_TYPES.MAGASINIER]: 'Boutiquier',
  [HR_ACTOR_TYPES.LIVREUR]: 'Livreur',
  [HR_ACTOR_TYPES.COMPTABLE]: 'Comptable',
  [HR_ACTOR_TYPES.MANAGER]: 'Manager',
  [HR_ACTOR_TYPES.SECRETAIRE]: 'Secrétaire',
  [HR_ACTOR_TYPES.TECHNICIEN]: 'Technicien',
  [HR_ACTOR_TYPES.COMMERCIAL]: 'Commercial',
  [HR_ACTOR_TYPES.CUSTOM]: 'Autre',
};

/**
 * Array of all HR actor types (excluding custom)
 */
export const ALL_HR_ACTOR_TYPES: HRActorType[] = [
  HR_ACTOR_TYPES.GARDIEN,
  HR_ACTOR_TYPES.CAISSIER,
  HR_ACTOR_TYPES.MAGASINIER,
  HR_ACTOR_TYPES.LIVREUR,
  HR_ACTOR_TYPES.COMPTABLE,
  HR_ACTOR_TYPES.MANAGER,
  HR_ACTOR_TYPES.SECRETAIRE,
  HR_ACTOR_TYPES.TECHNICIEN,
  HR_ACTOR_TYPES.COMMERCIAL,
  HR_ACTOR_TYPES.CUSTOM,
];

/**
 * Contract types for HR actors
 */
export const CONTRACT_TYPES = {
  CDI: 'CDI',
  CDD: 'CDD',
  STAGE: 'stage',
  FREELANCE: 'freelance',
  INTERIM: 'interim',
} as const;

export type ContractType = typeof CONTRACT_TYPES[keyof typeof CONTRACT_TYPES];

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  [CONTRACT_TYPES.CDI]: 'CDI (Contrat à Durée Indéterminée)',
  [CONTRACT_TYPES.CDD]: 'CDD (Contrat à Durée Déterminée)',
  [CONTRACT_TYPES.STAGE]: 'Stage',
  [CONTRACT_TYPES.FREELANCE]: 'Freelance',
  [CONTRACT_TYPES.INTERIM]: 'Intérim',
};

export const ALL_CONTRACT_TYPES: ContractType[] = [
  CONTRACT_TYPES.CDI,
  CONTRACT_TYPES.CDD,
  CONTRACT_TYPES.STAGE,
  CONTRACT_TYPES.FREELANCE,
  CONTRACT_TYPES.INTERIM,
];

/**
 * Salary frequency options
 */
export const SALARY_FREQUENCIES = {
  HOURLY: 'hourly',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  BIWEEKLY: 'biweekly',
  MONTHLY: 'monthly',
} as const;

export type SalaryFrequency = typeof SALARY_FREQUENCIES[keyof typeof SALARY_FREQUENCIES];

export const SALARY_FREQUENCY_LABELS: Record<string, string> = {
  [SALARY_FREQUENCIES.HOURLY]: 'Par heure',
  [SALARY_FREQUENCIES.DAILY]: 'Par jour',
  [SALARY_FREQUENCIES.WEEKLY]: 'Par semaine',
  [SALARY_FREQUENCIES.BIWEEKLY]: 'Bi-mensuel',
  [SALARY_FREQUENCIES.MONTHLY]: 'Par mois',
};

export const ALL_SALARY_FREQUENCIES: SalaryFrequency[] = [
  SALARY_FREQUENCIES.HOURLY,
  SALARY_FREQUENCIES.DAILY,
  SALARY_FREQUENCIES.WEEKLY,
  SALARY_FREQUENCIES.BIWEEKLY,
  SALARY_FREQUENCIES.MONTHLY,
];

/**
 * HR Actor status options
 */
export const HR_ACTOR_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
} as const;

export type HRActorStatus = typeof HR_ACTOR_STATUS[keyof typeof HR_ACTOR_STATUS];

export const HR_ACTOR_STATUS_LABELS: Record<string, string> = {
  [HR_ACTOR_STATUS.ACTIVE]: 'Actif',
  [HR_ACTOR_STATUS.INACTIVE]: 'Inactif',
  [HR_ACTOR_STATUS.ARCHIVED]: 'Archivé',
};
