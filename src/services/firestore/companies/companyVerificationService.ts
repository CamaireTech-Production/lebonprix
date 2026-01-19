import { db } from '../../core/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Company } from '../../../types/models';

export interface CompanyVerificationResult {
  hasCompany: boolean;
  companyId?: string;
  company?: Company;
  companies?: Company[];
}

/**
 * Vérifie si un utilisateur a des companies où il est owner
 */
export async function verifyUserCompany(userId: string): Promise<CompanyVerificationResult> {
  try {
    console.log('🔍 Vérification company pour userId:', userId);
    
    // 1. Récupérer toutes les companies où l'utilisateur est owner
    // Le champ 'companyId' dans le document company contient l'ID de l'utilisateur owner
    const companiesRef = collection(db, 'companies');
    const q = query(companiesRef, where('companyId', '==', userId));
    console.log('📊 Requête Firestore pour userId:', userId);
    
    const querySnapshot = await getDocs(q);
    console.log('📋 Nombre de companies trouvées:', querySnapshot.size);

    if (querySnapshot.empty) {
      console.log('❌ Aucune company trouvée pour cet utilisateur');
      return { hasCompany: false };
    }

    const companies: Company[] = [];
    querySnapshot.forEach((doc) => {
      const companyData = {
        id: doc.id,
        ...doc.data()
      } as Company;
      companies.push(companyData);
      console.log('🏢 Company trouvée:', companyData.name, 'ID:', doc.id);
    });

    // Retourner la première company trouvée
    const result = {
      hasCompany: true,
      companyId: companies[0].id,
      company: companies[0],
      companies: companies
    };
    
    console.log('✅ Résultat final:', result);
    return result;
  } catch (error) {
    console.error('❌ Erreur lors de la vérification des companies:', error);
    throw new Error('Impossible de vérifier les companies de l\'utilisateur');
  }
}

/**
 * Vérifie si un utilisateur est employé d'une company spécifique
 */
export async function verifyUserEmployeeStatus(userId: string, companyId: string): Promise<{
  isEmployee: boolean;
  role?: string;
  company?: Company;
}> {
  try {
    // 1. Vérifier si l'utilisateur est owner de la company
    const companyDoc = await getDoc(doc(db, 'companies', companyId));
    if (companyDoc.exists()) {
      const companyData = companyDoc.data() as Company;
      if (companyData.companyId === userId) {
        return {
          isEmployee: true,
          role: 'owner',
          company: companyData
        };
      }
    }

    // 2. Vérifier dans la sous-collection employeeRefs
    const employeeRefsRef = collection(db, 'companies', companyId, 'employeeRefs');
    const employeeRefDoc = await getDoc(doc(employeeRefsRef, userId));
    
    if (employeeRefDoc.exists()) {
      const employeeData = employeeRefDoc.data();
      return {
        isEmployee: true,
        role: employeeData.role,
        company: companyDoc.exists() ? { id: companyId, ...companyDoc.data() } as Company : undefined
      };
    }

    return { isEmployee: false };
  } catch (error) {
    console.error('Erreur lors de la vérification du statut employé:', error);
    throw new Error('Impossible de vérifier le statut employé');
  }
}

/**
 * Récupère toutes les companies où l'utilisateur est employé (owner ou employeeRef)
 */
export async function getUserCompanies(userId: string): Promise<Company[]> {
  try {
    const companies: Company[] = [];

    // 1. Récupérer les companies où l'utilisateur est owner
    const companiesRef = collection(db, 'companies');
    const ownerQuery = query(companiesRef, where('companyId', '==', userId));
    const ownerSnapshot = await getDocs(ownerQuery);
    
    ownerSnapshot.forEach((doc) => {
      companies.push({
        id: doc.id,
        ...doc.data()
      } as Company);
    });

    // 2. Récupérer les companies où l'utilisateur est employé via employeeRefs
    // Note: Cette requête nécessite une approche différente car on ne peut pas faire de requête
    // sur une sous-collection sans connaître l'ID de la company parent
    // Pour l'instant, on se contente des companies où l'utilisateur est owner
    // Dans une implémentation complète, il faudrait maintenir une liste des companies
    // dans le document user ou utiliser une approche différente

    return companies;
  } catch (error) {
    console.error('Erreur lors de la récupération des companies:', error);
    throw new Error('Impossible de récupérer les companies de l\'utilisateur');
  }
}

/**
 * Vérifie les permissions d'un utilisateur pour une company
 */
export async function checkUserPermissions(
  userId: string, 
  companyId: string, 
  action: string
): Promise<{
  canAccess: boolean;
  role?: string;
  reason?: string;
}> {
  try {
    // 1. Vérifier si l'utilisateur est owner
    const companyDoc = await getDoc(doc(db, 'companies', companyId));
    if (companyDoc.exists()) {
      const companyData = companyDoc.data() as Company;
      if (companyData.companyId === userId) {
        return {
          canAccess: true,
          role: 'owner'
        };
      }
    }

    // 2. Vérifier dans employeeRefs
    const employeeRefDoc = await getDoc(doc(db, 'companies', companyId, 'employeeRefs', userId));
    if (employeeRefDoc.exists()) {
      const employeeData = employeeRefDoc.data();
      const role = employeeData.role;

      // Vérifier les permissions selon le rôle
      const permissions = getRolePermissions(role);
      const canAccess = checkActionPermission(action, permissions);

      return {
        canAccess,
        role,
        reason: canAccess ? undefined : `Action '${action}' non autorisée pour le rôle '${role}'`
      };
    }

    return {
      canAccess: false,
      reason: 'Utilisateur non trouvé dans cette company'
    };
  } catch (error) {
    console.error('Erreur lors de la vérification des permissions:', error);
    return {
      canAccess: false,
      reason: 'Erreur lors de la vérification des permissions'
    };
  }
}

/**
 * Définit les permissions par rôle
 */
function getRolePermissions(role: string) {
  const permissions = {
    owner: {
      canView: ['all'],
      canCreate: ['all'],
      canEdit: ['all'],
      canDelete: ['all'],
      canManageEmployees: ['all']
    },
    admin: {
      canView: ['all'],
      canCreate: ['all'],
      canEdit: ['all'],
      canDelete: ['all-except-company'],
      canManageEmployees: ['staff', 'manager', 'admin']
    },
    manager: {
      canView: ['dashboard', 'sales', 'customers', 'products', 'expenses'],
      canCreate: ['sales', 'customers', 'products', 'expenses'],
      canEdit: ['sales', 'customers', 'products', 'expenses'],
      canDelete: ['sales', 'customers', 'products', 'expenses'],
      canManageEmployees: ['staff']
    },
    staff: {
      canView: ['dashboard', 'sales', 'customers'],
      canCreate: ['sales', 'customers'],
      canEdit: ['sales', 'customers'],
      canDelete: ['sales', 'customers'],
      canManageEmployees: []
    }
  };

  return permissions[role as keyof typeof permissions] || permissions.staff;
}

/**
 * Vérifie si une action est autorisée pour un rôle
 */
function checkActionPermission(action: string, permissions: any): boolean {
  // Actions de lecture
  if (action.startsWith('view:')) {
    const resource = action.replace('view:', '');
    return permissions.canView.includes('all') || permissions.canView.includes(resource);
  }

  // Actions de création
  if (action.startsWith('create:')) {
    const resource = action.replace('create:', '');
    // Backward compatibility: if canCreate is missing, fall back to canEdit
    if (permissions.canCreate && permissions.canCreate.length > 0) {
      return permissions.canCreate.includes('all') || permissions.canCreate.includes(resource);
    }
    return permissions.canEdit.includes('all') || permissions.canEdit.includes(resource);
  }

  // Actions d'édition
  if (action.startsWith('edit:')) {
    const resource = action.replace('edit:', '');
    return permissions.canEdit.includes('all') || permissions.canEdit.includes(resource);
  }

  // Actions de suppression
  if (action.startsWith('delete:')) {
    const resource = action.replace('delete:', '');
    return permissions.canDelete.includes('all') || permissions.canDelete.includes(resource);
  }

  // Gestion des employés
  if (action.startsWith('manage:')) {
    const role = action.replace('manage:', '');
    return permissions.canManageEmployees.includes('all') || permissions.canManageEmployees.includes(role);
  }

  return false;
}

/**
 * Vérifie les companies où l'utilisateur a le rôle "owner" dans employeeRefs
 * Cette fonction garantit que l'utilisateur a bien le rôle "owner" avant redirection
 */
export async function verifyUserOwnerCompanies(userId: string): Promise<CompanyVerificationResult> {
  try {
    console.log('🔍 Vérification des companies où l\'utilisateur est owner...');
    
    // 1. Récupérer toutes les companies où l'utilisateur est owner (companyId === userId)
    const companiesRef = collection(db, 'companies');
    const q = query(companiesRef, where('companyId', '==', userId));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('❌ Aucune company trouvée pour cet utilisateur');
      return { hasCompany: false };
    }

    const companies: Company[] = [];
    
    // 2. Vérifier le rôle dans employeeRefs pour chaque company
    for (const companyDoc of querySnapshot.docs) {
      const companyId = companyDoc.id;
      
      try {
        const employeeRefDoc = await getDoc(doc(db, 'companies', companyId, 'employeeRefs', userId));
        
        if (employeeRefDoc.exists()) {
          const employeeData = employeeRefDoc.data();
          
          // ✅ VÉRIFICATION CRITIQUE : Rôle doit être "owner"
          if (employeeData.role === 'owner') {
            const companyData = { id: companyDoc.id, ...companyDoc.data() } as Company;
            companies.push(companyData);
            console.log('✅ Company avec rôle owner trouvée:', companyData.name);
          } else {
            console.log('⚠️ Company trouvée mais rôle non-owner:', employeeData.role);
          }
        } else {
          console.log('⚠️ EmployeeRef non trouvé pour company:', companyId);
        }
      } catch (error) {
        console.error('❌ Erreur lors de la vérification du rôle pour company:', companyId, error);
      }
    }

    if (companies.length === 0) {
      console.log('❌ Aucune company avec rôle owner trouvée');
      return { hasCompany: false };
    }

    console.log(`✅ ${companies.length} company(s) avec rôle owner trouvée(s)`);
    return {
      hasCompany: true,
      companyId: companies[0].id,
      company: companies[0],
      companies: companies
    };
  } catch (error) {
    console.error('❌ Erreur lors de la vérification des companies owner:', error);
    throw new Error('Impossible de vérifier les companies owner de l\'utilisateur');
  }
}

export default {
  verifyUserCompany,
  verifyUserOwnerCompanies,
  verifyUserEmployeeStatus,
  getUserCompanies,
  checkUserPermissions
};
