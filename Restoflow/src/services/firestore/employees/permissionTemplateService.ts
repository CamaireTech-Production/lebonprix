// Permission Template service for Restoflow
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  setDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../../../firebase/config';
import type { PermissionTemplate, UserRole, ResourceValue } from '../../../types/geskap';
import { RESTAURANT_RESOURCES } from '../../../types/geskap';

// Default permission templates for restaurants
const DEFAULT_TEMPLATES: Omit<PermissionTemplate, 'id' | 'restaurantId' | 'createdAt' | 'updatedAt' | 'createdBy'>[] = [
  {
    name: 'Owner',
    description: 'Full access to all features',
    baseRole: 'owner',
    permissions: {
      canView: Object.values(RESTAURANT_RESOURCES),
      canCreate: Object.values(RESTAURANT_RESOURCES),
      canEdit: Object.values(RESTAURANT_RESOURCES),
      canDelete: Object.values(RESTAURANT_RESOURCES)
    },
    isDefault: true
  },
  {
    name: 'Manager',
    description: 'Can manage most operations except permissions',
    baseRole: 'manager',
    permissions: {
      canView: Object.values(RESTAURANT_RESOURCES),
      canCreate: ['menu', 'orders', 'pos', 'sales', 'inventory', 'customers', 'suppliers', 'expenses'],
      canEdit: ['menu', 'orders', 'pos', 'sales', 'inventory', 'customers', 'suppliers', 'expenses'],
      canDelete: ['orders', 'inventory']
    },
    isDefault: true
  },
  {
    name: 'Server',
    description: 'Can take orders and manage tables',
    baseRole: 'staff',
    permissions: {
      canView: ['dashboard', 'menu', 'orders', 'tables', 'pos', 'customers'],
      canCreate: ['orders', 'customers'],
      canEdit: ['orders'],
      canDelete: []
    },
    isDefault: true
  },
  {
    name: 'Cashier',
    description: 'Can process payments and view sales',
    baseRole: 'staff',
    permissions: {
      canView: ['dashboard', 'pos', 'sales', 'orders', 'customers'],
      canCreate: ['sales'],
      canEdit: ['sales'],
      canDelete: []
    },
    isDefault: true
  }
];

// ============================================================================
// PERMISSION TEMPLATE SUBSCRIPTIONS
// ============================================================================

export const subscribeToPermissionTemplates = (
  restaurantId: string,
  callback: (templates: PermissionTemplate[]) => void
): (() => void) => {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'restaurants', restaurantId, 'permissionTemplates'),
    orderBy('name')
  );

  return onSnapshot(q, async (snapshot) => {
    let templates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as PermissionTemplate[];

    // Initialize defaults if empty
    if (templates.length === 0) {
      await initializeDefaultTemplates(restaurantId, restaurantId);
      // The subscription will fire again with the new templates
    } else {
      callback(templates);
    }
  }, (error) => {
    console.error('Error in permission templates subscription:', error);
    callback([]);
  });
};

// ============================================================================
// PERMISSION TEMPLATE INITIALIZATION
// ============================================================================

export const initializeDefaultTemplates = async (
  restaurantId: string,
  createdBy: string
): Promise<void> => {
  const batch = writeBatch(db);

  for (const template of DEFAULT_TEMPLATES) {
    const templateRef = doc(collection(db, 'restaurants', restaurantId, 'permissionTemplates'));
    batch.set(templateRef, {
      ...template,
      restaurantId,
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  await batch.commit();
};

// ============================================================================
// PERMISSION TEMPLATE CRUD OPERATIONS
// ============================================================================

export const createPermissionTemplate = async (
  restaurantId: string,
  createdBy: string,
  data: {
    name: string;
    description?: string;
    baseRole: UserRole;
    permissions: {
      canView: ResourceValue[];
      canCreate: ResourceValue[];
      canEdit: ResourceValue[];
      canDelete: ResourceValue[];
    };
  }
): Promise<PermissionTemplate> => {
  const templateRef = doc(collection(db, 'restaurants', restaurantId, 'permissionTemplates'));

  const templateData = {
    ...data,
    isDefault: false,
    restaurantId,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(templateRef, templateData);

  return {
    id: templateRef.id,
    ...templateData,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
  } as PermissionTemplate;
};

export const updatePermissionTemplate = async (
  restaurantId: string,
  templateId: string,
  updates: Partial<Omit<PermissionTemplate, 'id' | 'restaurantId' | 'createdAt' | 'createdBy'>>
): Promise<void> => {
  const templateRef = doc(db, 'restaurants', restaurantId, 'permissionTemplates', templateId);
  const templateSnap = await getDoc(templateRef);

  if (!templateSnap.exists()) {
    throw new Error('Permission template not found');
  }

  await updateDoc(templateRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
};

export const deletePermissionTemplate = async (
  restaurantId: string,
  templateId: string
): Promise<void> => {
  const templateRef = doc(db, 'restaurants', restaurantId, 'permissionTemplates', templateId);
  const templateSnap = await getDoc(templateRef);

  if (!templateSnap.exists()) {
    throw new Error('Permission template not found');
  }

  const template = templateSnap.data() as PermissionTemplate;

  if (template.isDefault) {
    throw new Error('Cannot delete default permission templates');
  }

  // Check if template is in use by any employees
  const employeesQuery = query(
    collection(db, 'restaurants', restaurantId, 'employeeRefs'),
    where('permissionTemplateId', '==', templateId)
  );
  const employeesSnap = await getDocs(employeesQuery);

  if (!employeesSnap.empty) {
    throw new Error(`Cannot delete: ${employeesSnap.size} employee(s) are using this template`);
  }

  await deleteDoc(templateRef);
};

// ============================================================================
// PERMISSION TEMPLATE QUERIES
// ============================================================================

export const getPermissionTemplate = async (
  restaurantId: string,
  templateId: string
): Promise<PermissionTemplate | null> => {
  const templateRef = doc(db, 'restaurants', restaurantId, 'permissionTemplates', templateId);
  const templateSnap = await getDoc(templateRef);

  if (!templateSnap.exists()) {
    return null;
  }

  return {
    id: templateSnap.id,
    ...templateSnap.data()
  } as PermissionTemplate;
};

export const getPermissionTemplatesByRole = async (
  restaurantId: string,
  role: UserRole
): Promise<PermissionTemplate[]> => {
  const q = query(
    collection(db, 'restaurants', restaurantId, 'permissionTemplates'),
    where('baseRole', '==', role)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as PermissionTemplate[];
};

export const getDefaultTemplateForRole = async (
  restaurantId: string,
  role: UserRole
): Promise<PermissionTemplate | null> => {
  const q = query(
    collection(db, 'restaurants', restaurantId, 'permissionTemplates'),
    where('baseRole', '==', role),
    where('isDefault', '==', true)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }

  return {
    id: snapshot.docs[0].id,
    ...snapshot.docs[0].data()
  } as PermissionTemplate;
};

// ============================================================================
// PERMISSION CHECKING UTILITIES
// ============================================================================

export const checkPermission = async (
  restaurantId: string,
  userId: string,
  resource: ResourceValue,
  action: 'view' | 'create' | 'edit' | 'delete'
): Promise<boolean> => {
  // Get employee ref to find their template
  const employeeRef = doc(db, 'restaurants', restaurantId, 'employeeRefs', userId);
  const employeeSnap = await getDoc(employeeRef);

  if (!employeeSnap.exists()) {
    return false;
  }

  const employee = employeeSnap.data();

  // Owners always have full access
  if (employee.role === 'owner') {
    return true;
  }

  // Get the permission template
  const templateId = employee.permissionTemplateId;
  if (!templateId) {
    // Fall back to role-based defaults if no template assigned
    return checkDefaultRolePermission(employee.role, resource, action);
  }

  const template = await getPermissionTemplate(restaurantId, templateId);
  if (!template) {
    return false;
  }

  // Check the appropriate permission array
  const permissionKey = `can${action.charAt(0).toUpperCase() + action.slice(1)}` as keyof typeof template.permissions;
  const allowedResources = template.permissions[permissionKey] || [];

  return allowedResources.includes(resource);
};

const checkDefaultRolePermission = (
  role: UserRole,
  resource: ResourceValue,
  action: 'view' | 'create' | 'edit' | 'delete'
): boolean => {
  // Basic role-based permissions as fallback
  if (role === 'owner' || role === 'admin') {
    return true;
  }

  if (role === 'manager') {
    // Managers can do most things except manage permissions
    if (resource === 'permissions') {
      return action === 'view';
    }
    return true;
  }

  // Staff has limited access
  if (action === 'delete') {
    return false;
  }

  const staffViewResources: ResourceValue[] = ['dashboard', 'menu', 'orders', 'tables', 'pos', 'customers'];
  const staffCreateResources: ResourceValue[] = ['orders', 'customers'];
  const staffEditResources: ResourceValue[] = ['orders'];

  if (action === 'view') {
    return staffViewResources.includes(resource);
  }
  if (action === 'create') {
    return staffCreateResources.includes(resource);
  }
  if (action === 'edit') {
    return staffEditResources.includes(resource);
  }

  return false;
};
