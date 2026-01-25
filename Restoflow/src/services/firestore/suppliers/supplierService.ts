// Supplier service for Restoflow
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
  limit
} from 'firebase/firestore';
import { db } from '../../../firebase/config';
import type { Supplier, SupplierDebt, SupplierDebtEntry, EmployeeRef } from '../../../types/geskap';
import { createAuditLog } from '../shared';

// ============================================================================
// SUPPLIER SUBSCRIPTIONS
// ============================================================================

export const subscribeToSuppliers = (
  restaurantId: string,
  callback: (suppliers: Supplier[]) => void
): (() => void) => {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'restaurants', restaurantId, 'suppliers'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  return onSnapshot(q, (snapshot) => {
    const suppliers = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter(s => !s.isDeleted) as Supplier[];
    callback(suppliers);
  }, (error) => {
    console.error('Error in suppliers subscription:', error);
    callback([]);
  });
};

// ============================================================================
// SUPPLIER CRUD OPERATIONS
// ============================================================================

export const createSupplier = async (
  data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>,
  restaurantId: string,
  createdBy?: EmployeeRef | null
): Promise<Supplier> => {
  if (!data.name || !data.contact) {
    throw new Error('Invalid supplier data: name and contact are required');
  }

  const batch = writeBatch(db);
  const userId = data.userId || restaurantId;

  const supplierRef = doc(collection(db, 'restaurants', restaurantId, 'suppliers'));
  const supplierData: any = {
    name: data.name,
    contact: data.contact,
    userId,
    restaurantId,
    isDeleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  if (data.location) supplierData.location = data.location;
  if (data.email) supplierData.email = data.email;
  if (data.notes) supplierData.notes = data.notes;
  if (createdBy) supplierData.createdBy = createdBy;

  batch.set(supplierRef, supplierData);
  createAuditLog(batch, 'create', 'supplier', supplierRef.id, supplierData, userId);

  await batch.commit();

  return {
    id: supplierRef.id,
    ...supplierData,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
  };
};

export const updateSupplier = async (
  id: string,
  data: Partial<Supplier>,
  restaurantId: string
): Promise<void> => {
  const batch = writeBatch(db);
  const supplierRef = doc(db, 'restaurants', restaurantId, 'suppliers', id);

  const supplierSnap = await getDoc(supplierRef);
  if (!supplierSnap.exists()) {
    throw new Error('Supplier not found');
  }

  const supplier = supplierSnap.data() as Supplier;
  const userId = supplier.userId || restaurantId;

  const updateData = {
    ...data,
    updatedAt: serverTimestamp()
  };

  batch.update(supplierRef, updateData);
  createAuditLog(batch, 'update', 'supplier', id, updateData, userId);

  await batch.commit();
};

export const softDeleteSupplier = async (
  id: string,
  restaurantId: string
): Promise<void> => {
  const batch = writeBatch(db);
  const supplierRef = doc(db, 'restaurants', restaurantId, 'suppliers', id);

  const supplierSnap = await getDoc(supplierRef);
  if (!supplierSnap.exists()) {
    throw new Error('Supplier not found');
  }

  const supplier = supplierSnap.data() as Supplier;
  const userId = supplier.userId || restaurantId;

  // Check for outstanding debts
  const debtRef = doc(db, 'restaurants', restaurantId, 'supplierDebts', id);
  const debtSnap = await getDoc(debtRef);

  if (debtSnap.exists()) {
    const debt = debtSnap.data() as SupplierDebt;
    if (debt.outstanding > 0) {
      throw new Error('Cannot delete supplier with outstanding debts');
    }
  }

  batch.update(supplierRef, {
    isDeleted: true,
    updatedAt: serverTimestamp()
  });

  createAuditLog(batch, 'delete', 'supplier', id, { isDeleted: true }, userId);

  await batch.commit();
};

// ============================================================================
// SUPPLIER DEBT MANAGEMENT
// ============================================================================

export const subscribeToSupplierDebt = (
  restaurantId: string,
  supplierId: string,
  callback: (debt: SupplierDebt | null) => void
): (() => void) => {
  const debtRef = doc(db, 'restaurants', restaurantId, 'supplierDebts', supplierId);

  return onSnapshot(debtRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({
        id: snapshot.id,
        ...snapshot.data()
      } as SupplierDebt);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('Error in supplier debt subscription:', error);
    callback(null);
  });
};

export const getSupplierDebt = async (
  supplierId: string,
  restaurantId: string
): Promise<SupplierDebt | null> => {
  const debtRef = doc(db, 'restaurants', restaurantId, 'supplierDebts', supplierId);
  const debtSnap = await getDoc(debtRef);

  if (!debtSnap.exists()) {
    return null;
  }

  return {
    id: debtSnap.id,
    ...debtSnap.data()
  } as SupplierDebt;
};

export const addSupplierDebt = async (
  supplierId: string,
  amount: number,
  description: string,
  restaurantId: string,
  userId: string,
  batchId?: string
): Promise<void> => {
  const batch = writeBatch(db);
  const debtRef = doc(db, 'restaurants', restaurantId, 'supplierDebts', supplierId);
  const debtSnap = await getDoc(debtRef);

  const entry: SupplierDebtEntry = {
    id: doc(collection(db, 'temp')).id, // Generate unique ID
    type: 'debt',
    amount,
    description,
    batchId,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
  };

  if (debtSnap.exists()) {
    const currentDebt = debtSnap.data() as SupplierDebt;
    const newTotalDebt = currentDebt.totalDebt + amount;
    const newOutstanding = currentDebt.outstanding + amount;

    batch.update(debtRef, {
      totalDebt: newTotalDebt,
      outstanding: newOutstanding,
      entries: [...currentDebt.entries, entry],
      updatedAt: serverTimestamp()
    });
  } else {
    batch.set(debtRef, {
      supplierId,
      totalDebt: amount,
      totalRefunded: 0,
      outstanding: amount,
      entries: [entry],
      userId,
      restaurantId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  await batch.commit();
};

export const addSupplierRefund = async (
  supplierId: string,
  amount: number,
  description: string,
  restaurantId: string,
  refundedDebtId?: string
): Promise<void> => {
  const debtRef = doc(db, 'restaurants', restaurantId, 'supplierDebts', supplierId);
  const debtSnap = await getDoc(debtRef);

  if (!debtSnap.exists()) {
    throw new Error('No debt record found for this supplier');
  }

  const currentDebt = debtSnap.data() as SupplierDebt;

  if (amount > currentDebt.outstanding) {
    throw new Error('Refund amount exceeds outstanding debt');
  }

  const entry: SupplierDebtEntry = {
    id: doc(collection(db, 'temp')).id,
    type: 'refund',
    amount,
    description,
    refundedDebtId,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
  };

  const batch = writeBatch(db);
  batch.update(debtRef, {
    totalRefunded: currentDebt.totalRefunded + amount,
    outstanding: currentDebt.outstanding - amount,
    entries: [...currentDebt.entries, entry],
    updatedAt: serverTimestamp()
  });

  await batch.commit();
};

export const getAllSupplierDebts = async (
  restaurantId: string
): Promise<SupplierDebt[]> => {
  const q = query(
    collection(db, 'restaurants', restaurantId, 'supplierDebts'),
    where('outstanding', '>', 0)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as SupplierDebt[];
};
