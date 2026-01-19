// Shop and Warehouse Migration Service
// Migrates existing companies to the new shop/warehouse system
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  limit,
  doc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../core/firebase';
import { logError } from '@utils/core/logger';
import { createShop } from '../firestore/shops/shopService';
import { createWarehouse } from '../firestore/warehouse/warehouseService';
import { getShopsByCompany, getDefaultShop } from '../firestore/shops/shopService';
import { getWarehousesByCompany, getDefaultWarehouse } from '../firestore/warehouse/warehouseService';
import { getStockBatchesByLocation } from '../firestore/stock/stockService';
import type { Company, StockBatch, Sale, Customer } from '../../types/models';

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

/**
 * Migrate a single company to shop/warehouse system
 * Creates default shop and warehouse if they don't exist
 */
export const migrateCompany = async (
  companyId: string,
  userId: string
): Promise<{
  shopCreated: boolean;
  warehouseCreated: boolean;
  stockMigrated: number;
  salesMigrated: number;
}> => {
  try {
    console.log(`🔄 Migration de l'entreprise ${companyId}...`);

    let shopCreated = false;
    let warehouseCreated = false;

    // 1. Check if default shop exists, create if not
    let defaultShop = await getDefaultShop(companyId);
    if (!defaultShop) {
      console.log('🏪 Création du magasin par défaut...');
      defaultShop = await createShop(
        {
          name: 'Boutique Principale',
          companyId,
          userId,
          isDefault: true
        },
        companyId,
        null
      );
      shopCreated = true;
      console.log('✅ Magasin par défaut créé');
    }

    // 2. Check if default warehouse exists, create if not
    let defaultWarehouse = await getDefaultWarehouse(companyId);
    if (!defaultWarehouse) {
      console.log('📦 Création de l\'entrepôt par défaut...');
      defaultWarehouse = await createWarehouse(
        {
          name: 'Entrepôt Principal',
          companyId,
          userId,
          isDefault: true
        },
        companyId,
        null
      );
      warehouseCreated = true;
      console.log('✅ Entrepôt par défaut créé');
    }

    // 3. Migrate stock batches (assign to default shop if no location)
    const stockMigrated = await migrateStockBatches(companyId, defaultShop.id, defaultWarehouse.id);

    // 4. Migrate sales (assign to default shop)
    const salesMigrated = await migrateSales(companyId, defaultShop.id);

    console.log(`✅ Migration terminée pour l'entreprise ${companyId}`);
    return {
      shopCreated,
      warehouseCreated,
      stockMigrated,
      salesMigrated
    };

  } catch (error) {
    logError('Error migrating company', error);
    throw error;
  }
};

/**
 * Migrate all existing companies (batch migration)
 * Use with caution - only run once
 */
export const migrateAllCompanies = async (
  userId: string,
  batchSize: number = 10
): Promise<{
  total: number;
  migrated: number;
  errors: Array<{ companyId: string; error: string }>;
}> => {
  try {
    console.log('🔄 Début de la migration de toutes les entreprises...');

    const companiesQuery = query(collection(db, 'companies'));
    const companiesSnapshot = await getDocs(companiesQuery);
    const companies = companiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Company[];

    let migrated = 0;
    const errors: Array<{ companyId: string; error: string }> = [];

    for (const company of companies) {
      try {
        await migrateCompany(company.id, userId);
        migrated++;
        console.log(`✅ ${migrated}/${companies.length} entreprises migrées`);
      } catch (error: any) {
        errors.push({
          companyId: company.id,
          error: error.message || 'Unknown error'
        });
        console.error(`❌ Erreur lors de la migration de l'entreprise ${company.id}:`, error);
      }
    }

    console.log(`✅ Migration terminée: ${migrated}/${companies.length} entreprises migrées`);
    return {
      total: companies.length,
      migrated,
      errors
    };

  } catch (error) {
    logError('Error migrating all companies', error);
    throw error;
  }
};

/**
 * Migrate stock batches to default shop
 * Assigns batches without locationType to default shop
 */
const migrateStockBatches = async (
  companyId: string,
  defaultShopId: string,
  defaultWarehouseId: string
): Promise<number> => {
  try {
    console.log('📦 Migration des lots de stock...');

    // Get all product stock batches without locationType
    const q = query(
      collection(db, 'stockBatches'),
      where('companyId', '==', companyId),
      where('type', '==', 'product')
    );

    const snapshot = await getDocs(q);
    const batches = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as StockBatch[];

    // Filter batches without locationType
    const batchesToMigrate = batches.filter(batch => !batch.locationType);

    if (batchesToMigrate.length === 0) {
      console.log('✅ Aucun lot de stock à migrer');
      return 0;
    }

    // Update batches in batches (Firestore batch limit is 500)
    const batchSize = 500;
    let migrated = 0;

    for (let i = 0; i < batchesToMigrate.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchChunk = batchesToMigrate.slice(i, i + batchSize);

      for (const stockBatch of batchChunk) {
        const batchRef = doc(db, 'stockBatches', stockBatch.id);
        batch.update(batchRef, {
          locationType: 'shop',
          shopId: defaultShopId
        });
      }

      await batch.commit();
      migrated += batchChunk.length;
      console.log(`✅ ${migrated}/${batchesToMigrate.length} lots migrés`);
    }

    console.log(`✅ Migration des lots terminée: ${migrated} lots migrés`);
    return migrated;

  } catch (error) {
    logError('Error migrating stock batches', error);
    throw error;
  }
};

/**
 * Migrate sales to default shop
 * Assigns sales without shopId to default shop
 */
const migrateSales = async (
  companyId: string,
  defaultShopId: string
): Promise<number> => {
  try {
    console.log('💰 Migration des ventes...');

    // Get all sales without shopId
    const q = query(
      collection(db, 'sales'),
      where('companyId', '==', companyId)
    );

    const snapshot = await getDocs(q);
    const sales = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Sale[];

    // Filter sales without shopId
    const salesToMigrate = sales.filter(sale => !sale.shopId && !sale.warehouseId);

    if (salesToMigrate.length === 0) {
      console.log('✅ Aucune vente à migrer');
      return 0;
    }

    // Update sales in batches
    const batchSize = 500;
    let migrated = 0;

    for (let i = 0; i < salesToMigrate.length; i += batchSize) {
      const batch = writeBatch(db);
      const salesChunk = salesToMigrate.slice(i, i + batchSize);

      for (const sale of salesChunk) {
        const saleRef = doc(db, 'sales', sale.id);
        batch.update(saleRef, {
          shopId: defaultShopId,
          sourceType: 'shop'
        });
      }

      await batch.commit();
      migrated += salesChunk.length;
      console.log(`✅ ${migrated}/${salesToMigrate.length} ventes migrées`);
    }

    console.log(`✅ Migration des ventes terminée: ${migrated} ventes migrées`);
    return migrated;

  } catch (error) {
    logError('Error migrating sales', error);
    throw error;
  }
};

/**
 * Migrate customers (update associated shops based on sales)
 * This is optional and can be run separately
 */
export const migrateCustomers = async (
  companyId: string
): Promise<number> => {
  try {
    console.log('👥 Migration des clients...');

    const defaultShop = await getDefaultShop(companyId);
    if (!defaultShop) {
      throw new Error('Default shop not found. Run migrateCompany first.');
    }

    // Get all customers
    const q = query(
      collection(db, 'customers'),
      where('companyId', '==', companyId)
    );

    const snapshot = await getDocs(q);
    const customers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Customer[];

    // Get all sales for this company to determine customer associations
    const salesQuery = query(
      collection(db, 'sales'),
      where('companyId', '==', companyId)
    );
    const salesSnapshot = await getDocs(salesQuery);
    const sales = salesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Sale[];

    // Build customer-shop associations from sales
    const customerShopMap = new Map<string, Set<string>>();
    for (const sale of sales) {
      if (sale.customerInfo?.phone) {
        const phone = sale.customerInfo.phone;
        if (!customerShopMap.has(phone)) {
          customerShopMap.set(phone, new Set());
        }
        if (sale.shopId) {
          customerShopMap.get(phone)!.add(sale.shopId);
        } else {
          // If sale has no shopId, associate with default shop
          customerShopMap.get(phone)!.add(defaultShop.id);
        }
      }
    }

    // Update customers
    const batchSize = 500;
    let migrated = 0;

    for (let i = 0; i < customers.length; i += batchSize) {
      const batch = writeBatch(db);
      const customerChunk = customers.slice(i, i + batchSize);

      for (const customer of customerChunk) {
        const customerRef = doc(db, 'customers', customer.id || '');
        if (!customerRef) continue;

        const associatedShops = customerShopMap.get(customer.phone) || new Set();
        const shopArray = Array.from(associatedShops);

        const updates: any = {};
        if (shopArray.length > 0) {
          updates.associatedShops = shopArray;
          // Set primary shop to first one (or default shop)
          updates.primaryShopId = shopArray[0] || defaultShop.id;
        } else {
          // No sales yet, set default shop as primary
          updates.primaryShopId = defaultShop.id;
          updates.associatedShops = [defaultShop.id];
        }

        batch.update(customerRef, updates);
      }

      await batch.commit();
      migrated += customerChunk.length;
      console.log(`✅ ${migrated}/${customers.length} clients migrés`);
    }

    console.log(`✅ Migration des clients terminée: ${migrated} clients migrés`);
    return migrated;

  } catch (error) {
    logError('Error migrating customers', error);
    throw error;
  }
};

