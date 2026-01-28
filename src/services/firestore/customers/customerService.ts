// Customer service - extracted from firestore.ts
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  addDoc
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { logError } from '@utils/core/logger';
import { normalizePhoneNumber } from '@utils/core/phoneUtils';
import type { Customer } from '../../../types/models';

// ============================================================================
// CUSTOMER SUBSCRIPTIONS
// ============================================================================

export const subscribeToCustomers = (companyId: string, callback: (customers: Customer[]) => void, limitCount?: number) => {
  const defaultLimit = 100; // OPTIMIZATION: Default limit to reduce Firebase reads
  const q = query(
    collection(db, 'customers'),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc'),
    limit(limitCount || defaultLimit)
  );
  return onSnapshot(q, (snapshot) => {
    const customers = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data
      } as Customer;
    });
    callback(customers);
  }, (error) => {
    logError('Error in customers subscription', error);
    callback([]);
  });
};

// ============================================================================
// CUSTOMER CRUD OPERATIONS
// ============================================================================

export const getCustomerByPhone = async (phone: string): Promise<Customer | null> => {
  try {
    const customersRef = collection(db, 'customers');
    const q = query(customersRef, where('phone', '==', phone));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }

    const customerDoc = querySnapshot.docs[0];
    return {
      id: customerDoc.id,
      ...customerDoc.data()
    } as Customer;
  } catch (error) {
    logError('Error getting customer', error);
    throw error;
  }
};

export const addCustomer = async (customerData: Omit<Customer, 'id'>): Promise<Customer> => {
  try {
    if (!customerData.companyId) {
      logError('Missing companyId in customerData');
      throw new Error('companyId is required for customer');
    }
    
    const customersRef = collection(db, 'customers');
    const { createdAt, ...dataWithoutCreatedAt } = customerData as any;
    
    const dataToSave: any = {
      phone: dataWithoutCreatedAt.phone ? normalizePhoneNumber(dataWithoutCreatedAt.phone) : '',
      name: dataWithoutCreatedAt.name,
      userId: dataWithoutCreatedAt.userId,
      companyId: dataWithoutCreatedAt.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    if (dataWithoutCreatedAt.quarter !== undefined && dataWithoutCreatedAt.quarter !== null && dataWithoutCreatedAt.quarter !== '') {
      dataToSave.quarter = dataWithoutCreatedAt.quarter;
    }
    if (dataWithoutCreatedAt.firstName !== undefined && dataWithoutCreatedAt.firstName !== null && dataWithoutCreatedAt.firstName !== '') {
      dataToSave.firstName = dataWithoutCreatedAt.firstName;
    }
    if (dataWithoutCreatedAt.lastName !== undefined && dataWithoutCreatedAt.lastName !== null && dataWithoutCreatedAt.lastName !== '') {
      dataToSave.lastName = dataWithoutCreatedAt.lastName;
    }
    if (dataWithoutCreatedAt.address !== undefined && dataWithoutCreatedAt.address !== null && dataWithoutCreatedAt.address !== '') {
      dataToSave.address = dataWithoutCreatedAt.address;
    }
    if (dataWithoutCreatedAt.town !== undefined && dataWithoutCreatedAt.town !== null && dataWithoutCreatedAt.town !== '') {
      dataToSave.town = dataWithoutCreatedAt.town;
    }
    if (dataWithoutCreatedAt.birthdate !== undefined && dataWithoutCreatedAt.birthdate !== null && dataWithoutCreatedAt.birthdate !== '') {
      dataToSave.birthdate = dataWithoutCreatedAt.birthdate;
    }
    if (dataWithoutCreatedAt.howKnown !== undefined && dataWithoutCreatedAt.howKnown !== null && dataWithoutCreatedAt.howKnown !== '') {
      dataToSave.howKnown = dataWithoutCreatedAt.howKnown;
    }
    if (dataWithoutCreatedAt.customerSourceId !== undefined && dataWithoutCreatedAt.customerSourceId !== null && dataWithoutCreatedAt.customerSourceId !== '') {
      dataToSave.customerSourceId = dataWithoutCreatedAt.customerSourceId;
      dataToSave.firstSourceId = dataWithoutCreatedAt.customerSourceId;
    }
    
    const docRef = await addDoc(customersRef, dataToSave);
    
    const savedCustomer = {
      id: docRef.id,
      ...customerData
    };
    
    return savedCustomer;
  } catch (error: any) {
    logError('Error adding customer', error);
    throw error;
  }
};

export const updateCustomer = async (customerId: string, customerData: Partial<Customer>, companyId: string): Promise<void> => {
  try {
    const customerRef = doc(db, 'customers', customerId);
    const updateData: any = {
      ...customerData,
      updatedAt: serverTimestamp()
    };
    
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    await updateDoc(customerRef, updateData);
  } catch (error: any) {
    logError('Error updating customer', error);
    throw error;
  }
};

export const deleteCustomer = async (customerId: string, companyId: string): Promise<void> => {
  try {
    const customerRef = doc(db, 'customers', customerId);
    await deleteDoc(customerRef);
  } catch (error: any) {
    logError('Error deleting customer', error);
    throw error;
  }
};

