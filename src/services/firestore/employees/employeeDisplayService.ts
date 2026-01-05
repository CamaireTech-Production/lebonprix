import { 
  doc, 
  getDoc, 
  getDocs, 
  collection, 
  query, 
  orderBy,
  updateDoc
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { EmployeeRef, CompanyEmployee, Company, UserCompanyRef } from '../../../types/models';
import { getUserById } from '../../utilities/userService';

/**
 * Service pour lire et gérer l'affichage des employés
 * Fournit des fonctions pour lire depuis company.employees{} (rapide) 
 * et depuis la sous-collection employeeRefs (source de vérité)
 */

/**
 * Récupérer les employés depuis company.employees{} (lecture rapide)
 * @param companyId - ID de l'entreprise
 * @returns Record des employés pour affichage rapide
 */
export const getEmployeesFromCompanyDoc = async (
  companyId: string
): Promise<Record<string, CompanyEmployee>> => {
  try {
    console.log(`📋 Récupération des employés depuis company.employees{} pour ${companyId}`);

    const companyRef = doc(db, 'companies', companyId);
    const companySnap = await getDoc(companyRef);
    
    if (!companySnap.exists()) {
      throw new Error(`Entreprise ${companyId} non trouvée`);
    }

    const companyData = companySnap.data() as Company;
    const employees = companyData.employees || {};
    const employeeCount = companyData.employeeCount || 0;

    console.log(`✅ ${Object.keys(employees).length} employés récupérés depuis company.employees{} (count: ${employeeCount})`);
    return employees;

  } catch (error: any) {
    console.error('❌ Erreur lors de la récupération des employés depuis company.employees{}:', error);
    throw error;
  }
};

/**
 * Récupérer les employés depuis la sous-collection employeeRefs (source de vérité)
 * @param companyId - ID de l'entreprise
 * @returns Liste des employés depuis la sous-collection
 */
export const getEmployeesFromSubcollection = async (
  companyId: string
): Promise<EmployeeRef[]> => {
  try {
    console.log(`📋 Récupération des employés depuis sous-collection employeeRefs pour ${companyId}`);

    const employeeRefs = collection(db, 'companies', companyId, 'employeeRefs');
    const q = query(employeeRefs, orderBy('addedAt', 'desc'));
    const snapshot = await getDocs(q);

    const employees: EmployeeRef[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as EmployeeRef;
      // Add employee to list (EmployeeRef doesn't have deleted property)
      employees.push(data);
    });

    console.log(`✅ ${employees.length} employés récupérés depuis sous-collection`);
    return employees;

  } catch (error: any) {
    console.error('❌ Erreur lors de la récupération des employés depuis sous-collection:', error);
    throw error;
  }
};

/**
 * Détecter les incohérences entre company.employees{} et la sous-collection employeeRefs
 * @param companyId - ID de l'entreprise
 * @returns Rapport d'incohérences
 */
export const detectEmployeeInconsistencies = async (
  companyId: string
): Promise<{
  isConsistent: boolean;
  issues: string[];
  companyEmployees: Record<string, CompanyEmployee>;
  subcollectionEmployees: EmployeeRef[];
  details: {
    missingInCompany: string[];
    missingInSubcollection: string[];
    roleMismatches: Array<{userId: string, companyRole: string, subcollectionRole: string}>;
    countMismatch: boolean;
    companyCount: number;
    subcollectionCount: number;
  };
}> => {
  const issues: string[] = [];
  const details = {
    missingInCompany: [] as string[],
    missingInSubcollection: [] as string[],
    roleMismatches: [] as Array<{userId: string, companyRole: string, subcollectionRole: string}>,
    countMismatch: false,
    companyCount: 0,
    subcollectionCount: 0
  };

  try {
    console.log(`🔍 Vérification de cohérence pour l'entreprise ${companyId}`);

    // Récupérer les deux sources
    const companyEmployees = await getEmployeesFromCompanyDoc(companyId);
    const subcollectionEmployees = await getEmployeesFromSubcollection(companyId);

    details.companyCount = Object.keys(companyEmployees).length;
    details.subcollectionCount = subcollectionEmployees.length;

    // Vérifier le nombre d'employés
    if (details.companyCount !== details.subcollectionCount) {
      issues.push(`Nombre d'employés différent: company.employees=${details.companyCount}, sous-collection=${details.subcollectionCount}`);
      details.countMismatch = true;
    }

    // Créer des maps pour faciliter la comparaison
    const companyEmployeeMap = new Map(Object.entries(companyEmployees));
    const subcollectionEmployeeMap = new Map(subcollectionEmployees.map(emp => [emp.id, emp]));

    // Vérifier les employés manquants dans company.employees{}
    for (const [userId, subcollectionEmp] of subcollectionEmployeeMap) {
      if (!companyEmployeeMap.has(userId)) {
        issues.push(`Employé ${userId} (${subcollectionEmp.firstname} ${subcollectionEmp.lastname}) présent dans sous-collection mais absent de company.employees{}`);
        details.missingInCompany.push(userId);
      }
    }

    // Vérifier les employés manquants dans la sous-collection
    for (const [userId, companyEmp] of companyEmployeeMap) {
      if (!subcollectionEmployeeMap.has(userId)) {
        issues.push(`Employé ${userId} (${companyEmp.firstname} ${companyEmp.lastname}) présent dans company.employees{} mais absent de sous-collection`);
        details.missingInSubcollection.push(userId);
      }
    }

    // Vérifier les différences de rôle
    for (const [userId, companyEmp] of companyEmployeeMap) {
      const subcollectionEmp = subcollectionEmployeeMap.get(userId);
      if (subcollectionEmp && companyEmp.role !== subcollectionEmp.role) {
        issues.push(`Rôle différent pour ${userId}: company.employees=${companyEmp.role}, sous-collection=${subcollectionEmp.role}`);
        details.roleMismatches.push({
          userId,
          companyRole: companyEmp.role,
          subcollectionRole: subcollectionEmp.role
        });
      }
    }

    const isConsistent = issues.length === 0;

    console.log(`🔍 Vérification terminée: ${isConsistent ? '✅ Cohérent' : '❌ Incohérences détectées'}`);
    if (issues.length > 0) {
      console.log('📋 Incohérences détectées:', issues);
    }

    return {
      isConsistent,
      issues,
      companyEmployees,
      subcollectionEmployees,
      details
    };

  } catch (error: any) {
    console.error('❌ Erreur lors de la vérification de cohérence:', error);
    return {
      isConsistent: false,
      issues: ['Erreur lors de la vérification de cohérence'],
      companyEmployees: {},
      subcollectionEmployees: [],
      details
    };
  }
};

/**
 * Réparer les incohérences en synchronisant depuis la sous-collection (source de vérité)
 * @param companyId - ID de l'entreprise
 */
export const repairEmployeeSync = async (companyId: string): Promise<void> => {
  try {
    console.log(`🔧 Réparation de la synchronisation pour l'entreprise ${companyId}`);

    // Récupérer les employés depuis la sous-collection (source de vérité)
    const subcollectionEmployees = await getEmployeesFromSubcollection(companyId);

    // Créer le nouvel objet employees{}
    const newEmployees: Record<string, CompanyEmployee> = {};
    
    for (const emp of subcollectionEmployees) {
      newEmployees[emp.id] = {
        id: emp.id,
        firstname: emp.firstname,
        lastname: emp.lastname,
        email: emp.email,
        role: emp.role as any, // Conversion de type
        createdAt: emp.addedAt as any,
        updatedAt: emp.addedAt as any
      };
    }

    // Mettre à jour le document company
    const companyRef = doc(db, 'companies', companyId);
    await updateDoc(companyRef, {
      employees: newEmployees,
      employeeCount: subcollectionEmployees.length,
      updatedAt: new Date() as any
    });

    console.log(`✅ Synchronisation réparée: ${subcollectionEmployees.length} employés synchronisés`);

  } catch (error: any) {
    console.error('❌ Erreur lors de la réparation de la synchronisation:', error);
    throw error;
  }
};

/**
 * Obtenir le nombre d'employés depuis company.employees{} (rapide)
 * @param companyId - ID de l'entreprise
 * @returns Nombre d'employés
 */
export const getEmployeeCount = async (companyId: string): Promise<number> => {
  try {
    const companyRef = doc(db, 'companies', companyId);
    const companySnap = await getDoc(companyRef);
    
    if (!companySnap.exists()) {
      return 0;
    }

    const companyData = companySnap.data() as Company;
    return companyData.employeeCount || 0;

  } catch (error: any) {
    console.error('❌ Erreur lors de la récupération du nombre d\'employés:', error);
    return 0;
  }
};

/**
 * Vérifier si un utilisateur est employé dans une entreprise (lecture rapide)
 * @param companyId - ID de l'entreprise
 * @param userId - ID de l'utilisateur
 * @returns True si l'utilisateur est employé
 */
export const isUserEmployeeOfCompany = async (
  companyId: string, 
  userId: string
): Promise<boolean> => {
  try {
    const employees = await getEmployeesFromCompanyDoc(companyId);
    return userId in employees;

  } catch (error: any) {
    console.error('❌ Erreur lors de la vérification de l\'employé:', error);
    return false;
  }
};

/**
 * Obtenir le rôle d'un employé dans une entreprise (lecture rapide)
 * @param companyId - ID de l'entreprise
 * @param userId - ID de l'utilisateur
 * @returns Rôle de l'employé ou null
 */
export const getEmployeeRole = async (
  companyId: string, 
  userId: string
): Promise<string | null> => {
  try {
    const employees = await getEmployeesFromCompanyDoc(companyId);
    const employee = employees[userId];
    return employee ? employee.role : null;

  } catch (error: any) {
    console.error('❌ Erreur lors de la récupération du rôle:', error);
    return null;
  }
};

/**
 * Convertit un EmployeeRef en UserCompanyRef pour l'affichage dans HR
 * @param employeeRef - Référence d'employé depuis employeeRefs
 * @param companyId - ID de l'entreprise
 * @param companyData - Données de l'entreprise (nom, description, logo)
 * @param permissionTemplateId - ID du template de permissions (optionnel, récupéré depuis users.companies[])
 * @returns UserCompanyRef pour l'affichage
 */
export const convertEmployeeRefToUserCompanyRef = (
  employeeRef: EmployeeRef,
  companyId: string,
  companyData: { name: string; description?: string; logo?: string },
  permissionTemplateId?: string
): UserCompanyRef => {
  return {
    companyId,
    userId: employeeRef.id,
    name: `${employeeRef.firstname} ${employeeRef.lastname}`,
    description: companyData.description,
    logo: companyData.logo,
    role: employeeRef.role as 'owner' | 'admin' | 'manager' | 'staff',
    joinedAt: employeeRef.addedAt,
    permissionTemplateId
  };
};

/**
 * Récupère les informations du propriétaire de l'entreprise et crée un UserCompanyRef
 * @param ownerId - ID du propriétaire (company.companyId)
 * @param companyId - ID de l'entreprise
 * @param companyData - Données de l'entreprise (nom, description, logo)
 * @returns UserCompanyRef pour le propriétaire ou null si non trouvé
 */
export const getOwnerUserCompanyRef = async (
  ownerId: string,
  companyId: string,
  companyData: { name: string; description?: string; logo?: string }
): Promise<UserCompanyRef | null> => {
  try {
    console.log(`👤 Récupération des infos du propriétaire ${ownerId} pour l'entreprise ${companyId}`);
    
    const ownerUser = await getUserById(ownerId);
    
    if (!ownerUser) {
      console.warn(`⚠️ Propriétaire ${ownerId} non trouvé dans la collection users`);
      return null;
    }

    // Récupérer le permissionTemplateId depuis users.companies[]
    let permissionTemplateId: string | undefined;
    if (Array.isArray(ownerUser.companies)) {
      const userCompanyRef = ownerUser.companies.find((c: any) => c.companyId === companyId);
      permissionTemplateId = userCompanyRef?.permissionTemplateId;
    }

    // Vérifier si le propriétaire a déjà un employeeRef pour cette entreprise
    const employeeRefDoc = await getDoc(doc(db, 'companies', companyId, 'employeeRefs', ownerId));
    
    if (employeeRefDoc.exists()) {
      // Le propriétaire existe déjà dans employeeRefs, utiliser ces données
      const employeeRefData = employeeRefDoc.data() as EmployeeRef;
      console.log(`✅ Propriétaire trouvé dans employeeRefs avec rôle: ${employeeRefData.role}`);
      return convertEmployeeRefToUserCompanyRef(employeeRefData, companyId, companyData, permissionTemplateId);
    }

    // Le propriétaire n'est pas dans employeeRefs, créer un UserCompanyRef avec rôle owner
    console.log(`✅ Propriétaire créé avec rôle owner (non présent dans employeeRefs)`);
    return {
      companyId,
      userId: ownerId,
      name: `${ownerUser.firstname} ${ownerUser.lastname}`,
      description: companyData.description,
      logo: companyData.logo,
      role: 'owner',
      joinedAt: ownerUser.createdAt,
      permissionTemplateId
    };
  } catch (error: any) {
    console.error('❌ Erreur lors de la récupération du propriétaire:', error);
    return null;
  }
};

export default {
  getEmployeesFromCompanyDoc,
  getEmployeesFromSubcollection,
  detectEmployeeInconsistencies,
  repairEmployeeSync,
  getEmployeeCount,
  isUserEmployeeOfCompany,
  getEmployeeRole,
  convertEmployeeRefToUserCompanyRef,
  getOwnerUserCompanyRef
};
