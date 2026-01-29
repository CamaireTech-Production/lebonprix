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
import { normalizePhoneNumber, normalizePhoneForComparison } from '@utils/core/phoneUtils';
import { normalizeCustomerName } from './customerUtils';
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
    const normalizedPhone = normalizePhoneNumber(phone);
    const q = query(customersRef, where('phone', '==', normalizedPhone));
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

/**
 * Get customer by phone AND name (for duplicate detection)
 * Duplicate condition: same normalized phone AND same normalized name (case-insensitive)
 * @param phone - Customer phone number
 * @param name - Customer name
 * @param companyId - Company ID to filter by
 * @returns Customer if found, null otherwise
 */
export const getCustomerByPhoneAndName = async (
  phone: string,
  name: string,
  companyId: string
): Promise<Customer | null> => {
  try {
    const normalizedPhone = normalizePhoneNumber(phone);
    const normalizedName = name.trim().toLowerCase();
    
    // Search by companyId and phone
    const customersRef = collection(db, 'customers');
    const q = query(
      customersRef,
      where('companyId', '==', companyId),
      where('phone', '==', normalizedPhone)
    );
    const querySnapshot = await getDocs(q);
    
    // Check if any customer matches both phone AND name
    for (const doc of querySnapshot.docs) {
      const customer = doc.data() as Customer;
      const customerName = (customer.name || '').trim().toLowerCase();
      
      // Match found if phone matches AND name matches
      if (customerName === normalizedName && normalizedName !== '') {
        return {
          id: doc.id,
          ...customer
        };
      }
    }
    
    return null;
  } catch (error) {
    logError('Error getting customer by phone and name', error);
    throw error;
  }
};

/**
 * Update customer if new data is more complete than existing data
 * Only updates fields that are empty in existing but present in new data
 * @param customerId - Customer ID to update
 * @param newData - New customer data
 * @param companyId - Company ID for validation
 * @returns Updated customer
 */
export const updateCustomerIfNeeded = async (
  customerId: string,
  newData: Partial<Customer>,
  companyId: string
): Promise<Customer> => {
  try {
    const customerRef = doc(db, 'customers', customerId);
    const customerSnap = await getDoc(customerRef);
    
    if (!customerSnap.exists()) {
      throw new Error('Customer not found');
    }
    
    const existingCustomer = customerSnap.data() as Customer;
    
    // Verify companyId matches
    if (existingCustomer.companyId !== companyId) {
      throw new Error('Unauthorized to update this customer');
    }
    
    // Build update data: only update fields that are empty in existing but present in new
    const updateData: any = {
      updatedAt: serverTimestamp()
    };
    
    // Update name if existing is empty or "Client de passage" and new has value
    if (newData.name && newData.name.trim() && 
        (!existingCustomer.name || existingCustomer.name.trim() === '' || existingCustomer.name === 'Client de passage')) {
      updateData.name = newData.name.trim();
    }
    
    // Update quarter if existing is empty and new has value
    if (newData.quarter && newData.quarter.trim() && 
        (!existingCustomer.quarter || existingCustomer.quarter.trim() === '')) {
      updateData.quarter = newData.quarter.trim();
    }
    
    // Update other optional fields similarly
    if (newData.firstName && newData.firstName.trim() && !existingCustomer.firstName) {
      updateData.firstName = newData.firstName.trim();
    }
    if (newData.lastName && newData.lastName.trim() && !existingCustomer.lastName) {
      updateData.lastName = newData.lastName.trim();
    }
    if (newData.address && newData.address.trim() && !existingCustomer.address) {
      updateData.address = newData.address.trim();
    }
    if (newData.town && newData.town.trim() && !existingCustomer.town) {
      updateData.town = newData.town.trim();
    }
    if (newData.customerSourceId && !existingCustomer.customerSourceId) {
      updateData.customerSourceId = newData.customerSourceId;
    }
    
    // Only update if there are changes
    if (Object.keys(updateData).length > 1) { // More than just updatedAt
      await updateDoc(customerRef, updateData);
    }
    
    // Return updated customer
    const updatedSnap = await getDoc(customerRef);
    return {
      id: updatedSnap.id,
      ...updatedSnap.data()
    } as Customer;
  } catch (error) {
    logError('Error updating customer if needed', error);
    throw error;
  }
};

/**
 * Ensure customer exists - creates if not found, updates if found with more complete data
 * Duplicate detection: same normalized phone AND same normalized name (case-insensitive) for same company
 * @param customerInfo - Customer information (name, phone, quarter, etc.)
 * @param companyId - Company ID
 * @param userId - User ID creating/updating the customer
 * @returns Customer (existing or newly created)
 */
export const ensureCustomerExists = async (
  customerInfo: {
    name?: string;
    phone: string;
    quarter?: string;
    firstName?: string;
    lastName?: string;
    address?: string;
    town?: string;
    customerSourceId?: string;
  },
  companyId: string,
  userId: string
): Promise<Customer> => {
  try {
    // Normalize phone
    const normalizedPhone = normalizePhoneNumber(customerInfo.phone);
    
    if (!normalizedPhone) {
      throw new Error('Phone number is required');
    }
    
    // Normalize name (use "Client de passage" if empty)
    const customerName = normalizeCustomerName(normalizedPhone, customerInfo.name || '');
    
    // Check if customer exists by phone AND name
    const existing = await getCustomerByPhoneAndName(normalizedPhone, customerName, companyId);
    
    if (existing) {
      // Customer exists - update if needed with more complete data
      return await updateCustomerIfNeeded(existing.id, {
        name: customerName,
        phone: normalizedPhone,
        quarter: customerInfo.quarter,
        firstName: customerInfo.firstName,
        lastName: customerInfo.lastName,
        address: customerInfo.address,
        town: customerInfo.town,
        customerSourceId: customerInfo.customerSourceId
      }, companyId);
    }
    
    // Customer doesn't exist - create new one
    const newCustomerData: Omit<Customer, 'id'> = {
      phone: normalizedPhone,
      name: customerName,
      userId,
      companyId,
      createdAt: {
        seconds: Math.floor(Date.now() / 1000),
        nanoseconds: (Date.now() % 1000) * 1000000
      },
      updatedAt: {
        seconds: Math.floor(Date.now() / 1000),
        nanoseconds: (Date.now() % 1000) * 1000000
      }
    };
    
    // Add optional fields if provided
    if (customerInfo.quarter && customerInfo.quarter.trim()) {
      newCustomerData.quarter = customerInfo.quarter.trim();
    }
    if (customerInfo.firstName && customerInfo.firstName.trim()) {
      newCustomerData.firstName = customerInfo.firstName.trim();
    }
    if (customerInfo.lastName && customerInfo.lastName.trim()) {
      newCustomerData.lastName = customerInfo.lastName.trim();
    }
    if (customerInfo.address && customerInfo.address.trim()) {
      newCustomerData.address = customerInfo.address.trim();
    }
    if (customerInfo.town && customerInfo.town.trim()) {
      newCustomerData.town = customerInfo.town.trim();
    }
    if (customerInfo.customerSourceId && customerInfo.customerSourceId.trim()) {
      newCustomerData.customerSourceId = customerInfo.customerSourceId.trim();
      newCustomerData.firstSourceId = customerInfo.customerSourceId.trim();
    }
    
    return await addCustomer(newCustomerData);
  } catch (error) {
    logError('Error ensuring customer exists', error);
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

