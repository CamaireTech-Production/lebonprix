import type { EmployeeRef, CompanyEmployee, User } from '../../types/models';
import { Timestamp } from 'firebase/firestore';

/**
 * Convertit un CompanyEmployee en EmployeeRef
 */
const convertCompanyEmployeeToEmployeeRef = (
  employee: CompanyEmployee,
  userId: string
): EmployeeRef => {
  return {
    id: employee.firebaseUid || userId,
    firstname: employee.firstname,
    lastname: employee.lastname,
    email: employee.email,
    role: employee.role === 'admin' ? 'admin' : employee.role === 'manager' ? 'manager' : 'staff',
    addedAt: employee.createdAt
  };
};

/**
 * Crée un EmployeeRef depuis les données User (pour les owners)
 */
const createEmployeeRefFromUser = (user: User, userId: string): EmployeeRef => {
  return {
    id: userId,
    firstname: user.firstname,
    lastname: user.lastname,
    email: user.email,
    role: 'admin', // Owners sont considérés comme admin
    addedAt: user.createdAt || {
      seconds: Math.floor(Date.now() / 1000),
      nanoseconds: 0
    } as Timestamp
  };
};

/**
 * Récupère l'EmployeeRef de l'utilisateur actuel
 * @param currentEmployee - L'employé actuel depuis AuthContext
 * @param user - L'utilisateur Firebase depuis AuthContext
 * @param isOwner - Si l'utilisateur est owner de l'entreprise
 * @param userData - Les données User complètes (optionnel, pour le cas owner)
 * @returns EmployeeRef ou null si aucune information disponible
 */
export const getCurrentEmployeeRef = (
  currentEmployee: CompanyEmployee | null,
  user: { uid: string; email: string | null } | null,
  isOwner: boolean,
  userData?: User | null
): EmployeeRef | null => {
  // Cas 1: L'utilisateur est un employé
  if (currentEmployee && user) {
    return convertCompanyEmployeeToEmployeeRef(currentEmployee, user.uid);
  }

  // Cas 2: L'utilisateur est owner (pas d'employé mais propriétaire)
  if (isOwner && user && userData) {
    return createEmployeeRefFromUser(userData, user.uid);
  }

  // Cas 3: Aucune information disponible
  return null;
};

/**
 * Formate le nom complet d'un EmployeeRef pour l'affichage
 * @param createdBy - L'EmployeeRef
 * @returns Le nom formaté ou "Company" si null/undefined
 */
export const formatCreatorName = (createdBy?: EmployeeRef | null): string => {
  if (!createdBy) {
    return 'Company';
  }
  return `${createdBy.firstname} ${createdBy.lastname}`.trim() || createdBy.email || 'Company';
};

