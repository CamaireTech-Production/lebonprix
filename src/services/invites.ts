import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { CompanyEmployee } from '../types/models';
import { buildLoginLink } from '../utils/security';

export interface EmployeeInvite {
  inviteId: string;
  companyId: string;
  employeeEmail: string;
  role: string;
  expiresAt?: number;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  createdAt?: any;
}

export async function createEmployeeInvite(companyId: string, employee: CompanyEmployee, inviteId?: string): Promise<string> {
  // For Option A we can reuse loginLink; for Option B we would use a random inviteId.
  const id = inviteId || buildLoginLink(employee.firstname, employee.lastname, 3);
  const ref = doc(db, 'invites', id);
  await setDoc(ref, {
    inviteId: id,
    companyId,
    employeeEmail: employee.email,
    role: employee.role,
    status: 'pending',
    createdAt: serverTimestamp()
  } as EmployeeInvite, { merge: true });
  return id;
}

export async function acceptInvite(inviteId: string): Promise<EmployeeInvite | null> {
  const ref = doc(db, 'invites', inviteId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as EmployeeInvite;
}


