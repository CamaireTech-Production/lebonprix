import { UserRole } from '../types/models';

/**
 * Mapping des rôles UI vers les rôles système
 */
export const ROLE_MAPPING = {
  'vendeur': 'staff' as UserRole,
  'gestionnaire': 'manager' as UserRole,
  'magasinier': 'admin' as UserRole,
  'Companie': 'owner' as const,
} as const;

/**
 * Détermine le rôle effectif d'un utilisateur
 * @param company - Données de l'entreprise
 * @param userId - ID de l'utilisateur
 * @param userRole - Rôle de l'utilisateur (optionnel)
 * @returns Le rôle effectif ou null
 */
export const getEffectiveRole = (
  company: any,
  userId: string,
  userRole?: UserRole
): UserRole | 'owner' | null => {
  // 1. Vérifier si l'utilisateur est propriétaire de l'entreprise
  if (company?.userId === userId) {
    return 'owner';
  }

  // 2. Utiliser le rôle fourni
  if (userRole) {
    return userRole;
  }

  // 3. Chercher dans les employés de l'entreprise
  if (company?.employees) {
    const employee = Object.values(company.employees).find(
      (emp: any) => emp.firebaseUid === userId
    );
    if (employee) {
      return employee.role;
    }
  }

  return null;
};

/**
 * Vérifie si un utilisateur a accès à une section
 * @param effectiveRole - Rôle effectif de l'utilisateur
 * @param isOwner - Si l'utilisateur est propriétaire
 * @param allowedRoles - Rôles autorisés pour la section
 * @returns true si l'utilisateur a accès
 */
export const hasAccess = (
  effectiveRole: UserRole | 'owner' | null,
  isOwner: boolean,
  allowedRoles: Array<UserRole | 'owner'>
): boolean => {
  // Un utilisateur est owner si isOwner est true OU si effectiveRole est 'owner'
  const isActualOwner = isOwner || effectiveRole === 'owner';
  
  if (isActualOwner) return true;
  if (!effectiveRole) return false;
  return allowedRoles.includes(effectiveRole);
};

/**
 * Obtient le label d'affichage pour un rôle
 * @param role - Rôle système
 * @returns Label d'affichage
 */
export const getRoleLabel = (role: UserRole | 'owner'): string => {
  const labels = {
    'staff': 'Vendeur',
    'manager': 'Gestionnaire',
    'admin': 'Magasinier',
    'owner': 'Propriétaire',
  };
  return labels[role] || role;
};
