import { collection, doc, setDoc, getDocs, getDoc, updateDoc, deleteDoc, serverTimestamp, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '../../core/firebase';
import type { PermissionTemplate, RolePermissions } from '../../../types/permissions';

const TEMPLATES_COLLECTION = (companyId: string) => collection(db, 'companies', companyId, 'permissionTemplates');

/**
 * Normalize template permissions to ensure canCreate exists (backward compatibility)
 */
function normalizeTemplatePermissions(permissions: any): RolePermissions {
  return {
    canView: permissions.canView || [],
    canCreate: permissions.canCreate || [], // Add canCreate if missing
    canEdit: permissions.canEdit || [],
    canDelete: permissions.canDelete || [],
    canManageEmployees: permissions.canManageEmployees || [],
  };
}

/**
 * Normalize template to ensure all required fields exist (backward compatibility)
 */
function normalizeTemplate(template: any): PermissionTemplate {
  if (!template) return template;
  
  return {
    ...template,
    permissions: normalizeTemplatePermissions(template.permissions || {}),
  };
}

export async function createTemplate(companyId: string, createdBy: string, data: Omit<PermissionTemplate, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'createdBy'>) {
  const id = `tpl_${Date.now()}`;
  const ref = doc(db, 'companies', companyId, 'permissionTemplates', id);
  const payload: PermissionTemplate = {
    id,
    companyId,
    name: data.name,
    description: data.description,
    ...(data.baseRole && { baseRole: data.baseRole }), // Only include if provided
    permissions: data.permissions,
    createdBy,
    createdAt: serverTimestamp() as unknown as import('../../../types/models').Timestamp,
    updatedAt: serverTimestamp() as unknown as import('../../../types/models').Timestamp,
  };
  await setDoc(ref, payload);
  return payload;
}

export async function getCompanyTemplates(companyId: string): Promise<PermissionTemplate[]> {
  const snapshot = await getDocs(TEMPLATES_COLLECTION(companyId));
  return snapshot.docs.map(d => normalizeTemplate(d.data() as PermissionTemplate));
}

export async function getTemplateById(companyId: string, templateId: string): Promise<PermissionTemplate | null> {
  const ref = doc(db, 'companies', companyId, 'permissionTemplates', templateId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return normalizeTemplate(snap.data() as PermissionTemplate);
}

export async function updateTemplate(companyId: string, templateId: string, updates: Partial<Pick<PermissionTemplate, 'name' | 'description' | 'baseRole' | 'permissions'>>) {
  const ref = doc(db, 'companies', companyId, 'permissionTemplates', templateId);
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
}

export async function deleteTemplate(companyId: string, templateId: string) {
  const ref = doc(db, 'companies', companyId, 'permissionTemplates', templateId);
  await deleteDoc(ref);
}

// Utility to assign a template to a user company ref (callers should update users collection accordingly)
export function buildUserCompanyTemplateUpdate(templateId: string) {
  return { permissionTemplateId: templateId };
}

/**
 * Subscribe to real-time changes to a permission template
 * Returns null if template doesn't exist, or the template if it does
 * @param companyId - Company ID
 * @param templateId - Template ID to listen to
 * @param callback - Callback function that receives the template (or null if deleted)
 * @returns Unsubscribe function
 */
export function subscribeToTemplate(
  companyId: string,
  templateId: string,
  callback: (template: PermissionTemplate | null) => void
): Unsubscribe {
  const ref = doc(db, 'companies', companyId, 'permissionTemplates', templateId);
  
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        // Template was deleted
        callback(null);
      } else {
        // Template exists or was updated
        callback(normalizeTemplate(snap.data() as PermissionTemplate));
      }
    },
    (error) => {
      // On error, try to get the template one more time
      console.error('Error listening to template:', error);
      // If it's a permission error or not found, treat as deleted
      if (error.code === 'permission-denied' || error.code === 'not-found') {
        callback(null);
      }
    }
  );
}


