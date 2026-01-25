// Customer service for Restoflow
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  addDoc,
  limit
} from 'firebase/firestore';
import { db } from '../../../firebase/config';
import type { Customer, CustomerSource } from '../../../types/geskap';

// ============================================================================
// CUSTOMER SUBSCRIPTIONS
// ============================================================================

export const subscribeToCustomers = (
  restaurantId: string,
  callback: (customers: Customer[]) => void
): (() => void) => {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'restaurants', restaurantId, 'customers'),
    orderBy('createdAt', 'desc'),
    limit(100)
  );

  return onSnapshot(q, (snapshot) => {
    const customers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Customer[];
    callback(customers);
  }, (error) => {
    console.error('Error in customers subscription:', error);
    callback([]);
  });
};

// ============================================================================
// CUSTOMER CRUD OPERATIONS
// ============================================================================

export const getCustomerByPhone = async (
  restaurantId: string,
  phone: string
): Promise<Customer | null> => {
  try {
    const customersRef = collection(db, 'restaurants', restaurantId, 'customers');
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
    console.error('Error getting customer by phone:', error);
    throw error;
  }
};

export const addCustomer = async (
  customerData: Omit<Customer, 'id' | 'createdAt'>
): Promise<Customer> => {
  try {
    if (!customerData.restaurantId) {
      throw new Error('restaurantId is required for customer');
    }

    const customersRef = collection(db, 'restaurants', customerData.restaurantId, 'customers');

    const dataToSave: any = {
      phone: customerData.phone || '',
      name: customerData.name || '',
      userId: customerData.userId,
      restaurantId: customerData.restaurantId,
      createdAt: serverTimestamp()
    };

    // Add optional fields only if they have values
    if (customerData.quarter) dataToSave.quarter = customerData.quarter;
    if (customerData.firstName) dataToSave.firstName = customerData.firstName;
    if (customerData.lastName) dataToSave.lastName = customerData.lastName;
    if (customerData.address) dataToSave.address = customerData.address;
    if (customerData.town) dataToSave.town = customerData.town;
    if (customerData.birthdate) dataToSave.birthdate = customerData.birthdate;
    if (customerData.howKnown) dataToSave.howKnown = customerData.howKnown;
    if (customerData.customerSourceId) {
      dataToSave.customerSourceId = customerData.customerSourceId;
      dataToSave.firstSourceId = customerData.customerSourceId;
    }

    const docRef = await addDoc(customersRef, dataToSave);

    return {
      id: docRef.id,
      ...customerData,
      createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
    };
  } catch (error) {
    console.error('Error adding customer:', error);
    throw error;
  }
};

export const updateCustomer = async (
  restaurantId: string,
  customerId: string,
  customerData: Partial<Customer>
): Promise<void> => {
  try {
    const customerRef = doc(db, 'restaurants', restaurantId, 'customers', customerId);

    const updateData: any = { ...customerData };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    await updateDoc(customerRef, updateData);
  } catch (error) {
    console.error('Error updating customer:', error);
    throw error;
  }
};

export const deleteCustomer = async (
  restaurantId: string,
  customerId: string
): Promise<void> => {
  try {
    const customerRef = doc(db, 'restaurants', restaurantId, 'customers', customerId);
    await deleteDoc(customerRef);
  } catch (error) {
    console.error('Error deleting customer:', error);
    throw error;
  }
};

// ============================================================================
// CUSTOMER SOURCES
// ============================================================================

export const subscribeToCustomerSources = (
  restaurantId: string,
  callback: (sources: CustomerSource[]) => void
): (() => void) => {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'restaurants', restaurantId, 'customerSources'),
    where('isActive', '==', true),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const sources = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as CustomerSource[];
    callback(sources);
  }, (error) => {
    console.error('Error in customer sources subscription:', error);
    callback([]);
  });
};

export const addCustomerSource = async (
  restaurantId: string,
  userId: string,
  sourceData: { name: string; description?: string; color?: string }
): Promise<CustomerSource> => {
  try {
    const sourcesRef = collection(db, 'restaurants', restaurantId, 'customerSources');

    const dataToSave = {
      name: sourceData.name,
      description: sourceData.description || '',
      color: sourceData.color || '#3B82F6',
      isActive: true,
      userId,
      restaurantId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(sourcesRef, dataToSave);

    return {
      id: docRef.id,
      ...dataToSave,
      createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
      updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
    } as CustomerSource;
  } catch (error) {
    console.error('Error adding customer source:', error);
    throw error;
  }
};

export const updateCustomerSource = async (
  restaurantId: string,
  sourceId: string,
  updates: Partial<CustomerSource>
): Promise<void> => {
  try {
    const sourceRef = doc(db, 'restaurants', restaurantId, 'customerSources', sourceId);
    await updateDoc(sourceRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating customer source:', error);
    throw error;
  }
};

export const deleteCustomerSource = async (
  restaurantId: string,
  sourceId: string
): Promise<void> => {
  try {
    const sourceRef = doc(db, 'restaurants', restaurantId, 'customerSources', sourceId);
    await updateDoc(sourceRef, {
      isActive: false,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error deleting customer source:', error);
    throw error;
  }
};
