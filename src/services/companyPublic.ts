import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Company } from '../types/models';

export async function getCompanyById(companyId: string): Promise<Company | null> {
  const ref = doc(db, 'companies', companyId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Company, 'id'>) } as Company;
}


