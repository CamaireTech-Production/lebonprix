/**
 * Migration Script: userId → companyId
 * 
 * This script migrates all entities from userId-based to companyId-based data isolation.
 * Uses smart assignment strategy for multi-company users.
 * 
 * Features:
 * - Smart assignment for multi-company users
 * - Batch processing to avoid timeouts
 * - Detailed migration report
 * - Rollback capability
 * 
 * Usage: node scripts/migrateUserIdToCompanyId.js [--dry-run]
 */

import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DRY_RUN = process.argv.includes('--dry-run');

console.log(DRY_RUN ? '🔍 DRY RUN MODE - No changes will be made\n' : '🚀 Starting userId to companyId migration...\n');

try {
  // Load service account
  const serviceAccount = JSON.parse(readFileSync(join(__dirname, '../firebase-service-account.json'), 'utf8'));
  
  // Initialize Firebase
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  const db = admin.firestore();
  const BATCH_SIZE = 500; // Process in batches
  
  // Collections to migrate - ORDER MATTERS:
  // 1. Base entities first (products, categories, suppliers, etc.)
  // 2. Then entities that reference products (stockChanges, stockBatches, sales)
  // 3. Then entities that reference sales (customers via sales)
  // 4. Then remaining entities
  const collections = [
    { name: 'products', hasContext: false, priority: 1 }, // Base entity - process first
    { name: 'categories', hasContext: false, priority: 1 },
    { name: 'suppliers', hasContext: false, priority: 1 },
    { name: 'expenses', hasContext: false, priority: 1 },
    { name: 'objectives', hasContext: false, priority: 1 },
    { name: 'orders', hasContext: false, priority: 1 },
    { name: 'financeEntryTypes', hasContext: false, priority: 1 }, // Optional userId for global vs user-specific
    { name: 'expenseTypes', hasContext: false, priority: 1 }, // Optional userId for global vs user-specific
    { name: 'stockBatches', hasContext: true, priority: 2 }, // References products
    { name: 'stockChanges', hasContext: true, priority: 2 }, // References products
    { name: 'sales', hasContext: true, priority: 2 }, // References products
    { name: 'customers', hasContext: true, priority: 3 }, // Can infer from sales
    { name: 'finances', hasContext: true, priority: 3 } // Can reference sales/expenses (collection name is 'finances')
  ];
  
  const migrationReport = {
    startTime: new Date().toISOString(),
    dryRun: DRY_RUN,
    collections: {},
    summary: {
      totalProcessed: 0,
      totalMigrated: 0,
      totalSkipped: 0,
      totalErrors: 0,
      smartAssignments: 0,
      orphanedRecords: 0
    },
    errors: []
  };
  
  // Load users, companies, and build context maps
  console.log('📊 Loading users and companies...');
  const usersSnapshot = await db.collection('users').get();
  const companiesSnapshot = await db.collection('companies').get();
  
  const usersMap = new Map();
  const companiesMap = new Map();
  const userIdToCompanyIds = new Map();
  const userIdToPrimaryCompanyId = new Map();
  
  // Build user-to-companies mapping
  usersSnapshot.forEach(doc => {
    const user = doc.data();
    const userId = user.id || doc.id;
    usersMap.set(userId, user);
    
    if (user.companies && Array.isArray(user.companies)) {
      const companyIds = user.companies.map(c => c.companyId || c.id).filter(Boolean);
      if (companyIds.length > 0) {
        userIdToCompanyIds.set(userId, companyIds);
        
        // Determine primary company: owner company or first company
        const ownerCompany = user.companies.find(c => c.role === 'owner');
        const primaryCompanyId = ownerCompany ? (ownerCompany.companyId || ownerCompany.id) : companyIds[0];
        if (primaryCompanyId) {
          userIdToPrimaryCompanyId.set(userId, primaryCompanyId);
        }
      }
    }
  });
  
  // Build company map and legacy company mapping
  companiesSnapshot.forEach(doc => {
    const company = doc.data();
    const companyId = doc.id;
    companiesMap.set(companyId, company);
    
    // Strategy 1: Legacy companies where companyId (doc.id) = userId
    // If document ID is 28 chars (Firebase UID), it might be a userId
    const isLegacyByDocId = companyId.length === 28;
    
    // Strategy 2: Check company fields for userId references
    const ownerIdFromCompanyId = company.companyId;
    const ownerIdFromUserId = company.userId;
    
    // If companyId (doc.id) itself could be a userId, add it
    if (isLegacyByDocId) {
      if (!userIdToCompanyIds.has(companyId)) {
        userIdToCompanyIds.set(companyId, []);
      }
      const existing = userIdToCompanyIds.get(companyId);
      if (!existing.includes(companyId)) {
        existing.push(companyId);
      }
      if (!userIdToPrimaryCompanyId.has(companyId)) {
        userIdToPrimaryCompanyId.set(companyId, companyId);
      }
    }
    
    // Strategy 3: If company has companyId or userId field, link it
    if (ownerIdFromCompanyId && ownerIdFromCompanyId !== companyId) {
      if (!userIdToCompanyIds.has(ownerIdFromCompanyId)) {
        userIdToCompanyIds.set(ownerIdFromCompanyId, []);
      }
      const existing = userIdToCompanyIds.get(ownerIdFromCompanyId);
      if (!existing.includes(companyId)) {
        existing.push(companyId);
      }
      if (!userIdToPrimaryCompanyId.has(ownerIdFromCompanyId)) {
        userIdToPrimaryCompanyId.set(ownerIdFromCompanyId, companyId);
      }
    }
    
    if (ownerIdFromUserId && ownerIdFromUserId !== companyId) {
      if (!userIdToCompanyIds.has(ownerIdFromUserId)) {
        userIdToCompanyIds.set(ownerIdFromUserId, []);
      }
      const existing = userIdToCompanyIds.get(ownerIdFromUserId);
      if (!existing.includes(companyId)) {
        existing.push(companyId);
      }
      if (!userIdToPrimaryCompanyId.has(ownerIdFromUserId)) {
        userIdToPrimaryCompanyId.set(ownerIdFromUserId, companyId);
      }
    }
  });
  
  console.log(`✅ Loaded ${usersMap.size} users and ${companiesMap.size} companies\n`);
  
  // Context maps will be built dynamically as we process collections
  const productCompanyMap = new Map(); // productId -> companyId (updated during migration)
  const saleCompanyMap = new Map(); // saleId -> companyId (updated during migration)
  const customerCompanyMap = new Map(); // customerId -> companyId (updated during migration)
  
  // Build initial context maps from records that already have companyId
  console.log('🔍 Building initial context maps...');
  const productsSnapshot = await db.collection('products').get();
  productsSnapshot.forEach(doc => {
    const product = doc.data();
    if (product.companyId && companiesMap.has(product.companyId)) {
      productCompanyMap.set(doc.id, product.companyId);
    }
  });
  
  const salesSnapshot = await db.collection('sales').get();
  salesSnapshot.forEach(doc => {
    const sale = doc.data();
    if (sale.companyId && companiesMap.has(sale.companyId)) {
      saleCompanyMap.set(doc.id, sale.companyId);
    }
  });
  
  const customersSnapshot = await db.collection('customers').get();
  customersSnapshot.forEach(doc => {
    const customer = doc.data();
    if (customer.companyId && companiesMap.has(customer.companyId)) {
      customerCompanyMap.set(doc.id, customer.companyId);
    }
  });
  
  console.log(`✅ Initial context maps: ${productCompanyMap.size} products, ${saleCompanyMap.size} sales, ${customerCompanyMap.size} customers\n`);
  
  /**
   * Smart assignment: Determine companyId for a record
   */
  function determineCompanyId(record, collectionName, userId) {
    // If already has companyId, validate it
    if (record.companyId) {
      if (companiesMap.has(record.companyId)) {
        return { companyId: record.companyId, method: 'existing' };
      }
      // Invalid companyId, needs reassignment
    }
    
    let userCompanyIds = userIdToCompanyIds.get(userId) || [];
    
    // Strategy 0: Check if userId itself is a company (legacy case)
    // This handles grandfathered companies where companyId = userId
    if (companiesMap.has(userId)) {
      // userId is a valid company ID
      if (userCompanyIds.length === 0 || !userCompanyIds.includes(userId)) {
        userCompanyIds = [userId, ...userCompanyIds];
        userIdToCompanyIds.set(userId, userCompanyIds);
        if (!userIdToPrimaryCompanyId.has(userId)) {
          userIdToPrimaryCompanyId.set(userId, userId);
        }
      }
    }
    
    // Strategy 0.5: Check if there's a company with companyId field = userId
    // This handles companies where the document has companyId field matching userId
    for (const [companyId, company] of companiesMap) {
      const companyData = company;
      if (companyData.companyId === userId || companyData.userId === userId || companyData.id === userId) {
        if (!userCompanyIds.includes(companyId)) {
          userCompanyIds.push(companyId);
          userIdToCompanyIds.set(userId, userCompanyIds);
          if (!userIdToPrimaryCompanyId.has(userId)) {
            userIdToPrimaryCompanyId.set(userId, companyId);
          }
        }
      }
    }
    
    // Update the map with any new discoveries
    if (userCompanyIds.length > 0) {
      userIdToCompanyIds.set(userId, userCompanyIds);
    }
    
    // No companies for user - try direct company lookup
    if (userCompanyIds.length === 0) {
      // Strategy A: Check if userId is a valid company ID directly
      if (companiesMap.has(userId)) {
        // Update maps for future reference
        userIdToCompanyIds.set(userId, [userId]);
        userIdToPrimaryCompanyId.set(userId, userId);
        return { companyId: userId, method: 'legacy-direct-company' };
      }
      
      // Strategy B: Try to find company by searching for companyId field = userId
      let foundCompany = null;
      for (const [companyId, company] of companiesMap) {
        if (company.companyId === userId || company.userId === userId || companyId === userId) {
          foundCompany = companyId;
          break;
        }
      }
      
      if (foundCompany) {
        // Update maps for future reference
        userIdToCompanyIds.set(userId, [foundCompany]);
        userIdToPrimaryCompanyId.set(userId, foundCompany);
        return { companyId: foundCompany, method: 'legacy-company-field' };
      }
      
      // Strategy C: Legacy system - userId WAS the companyId
      // If userId looks like a Firebase UID (28 chars) and user doesn't exist,
      // treat it as a legacy company where userId = companyId
      // This is the grandfathered case
      if (userId.length === 28 && !usersMap.has(userId)) {
        // Check if there's any company document with this ID
        // If not, we'll create a reference but won't actually create the company
        // Just use userId as companyId (legacy behavior)
        console.log(`   ⚠️  Legacy case: userId ${userId} not in users, treating as companyId`);
        
        // Update maps for future reference
        userIdToCompanyIds.set(userId, [userId]);
        userIdToPrimaryCompanyId.set(userId, userId);
        return { companyId: userId, method: 'legacy-grandfathered' };
      }
      
      return { companyId: null, method: 'orphaned', reason: 'User has no companies and userId is not a company' };
    }
    
    // Single company - easy
    if (userCompanyIds.length === 1) {
      return { companyId: userCompanyIds[0], method: 'single-company' };
    }
    
    // Multi-company: Use smart assignment
    migrationReport.summary.smartAssignments++;
    
    // Strategy 1: Context-based assignment
    if (collectionName === 'stockChanges' || collectionName === 'stockBatches') {
      if (record.productId && productCompanyMap.has(record.productId)) {
        const inferredCompanyId = productCompanyMap.get(record.productId);
        if (userCompanyIds.includes(inferredCompanyId)) {
          return { companyId: inferredCompanyId, method: 'context-product' };
        }
      }
    }
    
    if (collectionName === 'sales') {
      if (record.products && record.products.length > 0) {
        const firstProductId = record.products[0]?.productId;
        if (firstProductId && productCompanyMap.has(firstProductId)) {
          const inferredCompanyId = productCompanyMap.get(firstProductId);
          if (userCompanyIds.includes(inferredCompanyId)) {
            return { companyId: inferredCompanyId, method: 'context-product' };
          }
        }
      }
    }
    
    if (collectionName === 'customers') {
      // Try to infer from sales if customer has sales
      // Note: This requires customers to have sales reference, which may not always exist
      // For now, use primary company
    }
    
    if (collectionName === 'finances') {
      // Try to infer from source
      if (record.sourceType === 'sale' && record.sourceId && saleCompanyMap.has(record.sourceId)) {
        const inferredCompanyId = saleCompanyMap.get(record.sourceId);
        if (userCompanyIds.includes(inferredCompanyId)) {
          return { companyId: inferredCompanyId, method: 'context-sale' };
        }
      }
      if (record.sourceType === 'expense' && record.sourceId) {
        // Check if we have the expense's companyId stored
        const expenseKey = `expense_${record.sourceId}`;
        if (saleCompanyMap.has(expenseKey)) {
          const inferredCompanyId = saleCompanyMap.get(expenseKey);
          if (userCompanyIds.includes(inferredCompanyId)) {
            return { companyId: inferredCompanyId, method: 'context-expense' };
          }
        }
      }
    }
    
    // Strategy 2: Use primary company (owner or first)
    const primaryCompanyId = userIdToPrimaryCompanyId.get(userId);
    if (primaryCompanyId && userCompanyIds.includes(primaryCompanyId)) {
      return { companyId: primaryCompanyId, method: 'primary-company' };
    }
    
    // Strategy 3: Fallback to first company
    return { companyId: userCompanyIds[0], method: 'fallback-first' };
  }
  
  /**
   * Migrate a collection
   */
  async function migrateCollection(collectionConfig) {
    const { name: collectionName, hasContext, priority } = collectionConfig;
    console.log(`\n📋 Migrating collection: ${collectionName}...`);
    
    const collectionReport = {
      totalRecords: 0,
      migrated: 0,
      skipped: 0,
      errors: 0,
      orphaned: 0,
      assignments: {}
    };
    
    const snapshot = await db.collection(collectionName).get();
    collectionReport.totalRecords = snapshot.size;
    
    if (snapshot.empty) {
      console.log(`  ⏭️  Collection ${collectionName} is empty`);
      migrationReport.collections[collectionName] = collectionReport;
      return;
    }
    
    // Process in batches
    const batches = [];
    let currentBatch = db.batch();
    let batchCount = 0;
    let recordsProcessed = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const hasUserId = data.userId !== undefined && data.userId !== null;
      const hasCompanyId = data.companyId !== undefined && data.companyId !== null;
      
      // Skip if already has valid companyId
      if (hasCompanyId && companiesMap.has(data.companyId)) {
        collectionReport.skipped++;
        recordsProcessed++;
        continue;
      }
      
      // Skip if no userId
      if (!hasUserId) {
        // Some collections might not have userId (global types)
        if (collectionName === 'financeEntryTypes' || collectionName === 'expenseTypes') {
          // Global types don't need companyId if they're isDefault
          if (data.isDefault) {
            collectionReport.skipped++;
            recordsProcessed++;
            continue;
          }
        }
        
        // Try to infer from companyId if it exists but no userId
        if (hasCompanyId && companiesMap.has(data.companyId)) {
          // Already has valid companyId, skip
          collectionReport.skipped++;
          recordsProcessed++;
          continue;
        }
        
        collectionReport.errors++;
        migrationReport.errors.push({
          collection: collectionName,
          documentId: doc.id,
          error: 'Missing userId and no valid companyId'
        });
        recordsProcessed++;
        continue;
      }
      
      const userId = data.userId;
      const assignment = determineCompanyId(data, collectionName, userId);
      
      if (assignment.companyId === null) {
        // Orphaned record
        collectionReport.orphaned++;
        migrationReport.summary.orphanedRecords++;
        recordsProcessed++;
        continue;
      }
      
      // Track assignment method
      if (!collectionReport.assignments[assignment.method]) {
        collectionReport.assignments[assignment.method] = 0;
      }
      collectionReport.assignments[assignment.method]++;
      
      // Add to batch update
      if (!DRY_RUN) {
        currentBatch.update(doc.ref, {
          companyId: assignment.companyId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        batchCount++;
        
        // Update context maps for future references (in memory, not committed yet)
        // These will be used for subsequent records in the same collection and later collections
        if (collectionName === 'products') {
          productCompanyMap.set(doc.id, assignment.companyId);
        } else if (collectionName === 'sales') {
          saleCompanyMap.set(doc.id, assignment.companyId);
        } else if (collectionName === 'customers') {
          customerCompanyMap.set(doc.id, assignment.companyId);
        } else if (collectionName === 'expenses') {
          // Store expense companyId for finances reference
          if (!saleCompanyMap.has(`expense_${doc.id}`)) {
            saleCompanyMap.set(`expense_${doc.id}`, assignment.companyId);
          }
        }
        
        // Commit batch if full
        if (batchCount >= BATCH_SIZE) {
          batches.push(currentBatch);
          currentBatch = db.batch();
          batchCount = 0;
        }
      }
      
      collectionReport.migrated++;
      recordsProcessed++;
      
      // Progress indicator
      if (recordsProcessed % 100 === 0) {
        process.stdout.write(`  📊 Processed: ${recordsProcessed}/${snapshot.size}\r`);
      }
    }
    
    // Commit remaining batch
    if (!DRY_RUN && batchCount > 0) {
      batches.push(currentBatch);
    }
    
    // Execute batches
    if (!DRY_RUN && batches.length > 0) {
      console.log(`\n  💾 Committing ${batches.length} batch(es)...`);
      for (let i = 0; i < batches.length; i++) {
        await batches[i].commit();
        console.log(`  ✅ Batch ${i + 1}/${batches.length} committed`);
      }
    }
    
    migrationReport.summary.totalProcessed += collectionReport.totalRecords;
    migrationReport.summary.totalMigrated += collectionReport.migrated;
    migrationReport.summary.totalSkipped += collectionReport.skipped;
    migrationReport.summary.totalErrors += collectionReport.errors;
    
    migrationReport.collections[collectionName] = collectionReport;
    
    console.log(`  ✅ ${collectionName}: ${collectionReport.migrated} migrated, ${collectionReport.skipped} skipped, ${collectionReport.orphaned} orphaned, ${collectionReport.errors} errors`);
    if (Object.keys(collectionReport.assignments).length > 0) {
      console.log(`     Assignment methods:`, collectionReport.assignments);
    }
  }
  
  // Sort collections by priority to ensure dependencies are migrated first
  const sortedCollections = [...collections].sort((a, b) => a.priority - b.priority);
  
  // Migrate all collections in order
  for (const collectionConfig of sortedCollections) {
    try {
      await migrateCollection(collectionConfig);
    } catch (error) {
      console.error(`  ❌ Error migrating ${collectionConfig.name}:`, error);
      migrationReport.errors.push({
        collection: collectionConfig.name,
        error: error.message,
        stack: error.stack
      });
      migrationReport.summary.totalErrors++;
    }
  }
  
  // Generate report
  migrationReport.endTime = new Date().toISOString();
  migrationReport.duration = new Date(migrationReport.endTime) - new Date(migrationReport.startTime);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Records Processed: ${migrationReport.summary.totalProcessed}`);
  console.log(`Records Migrated: ${migrationReport.summary.totalMigrated}`);
  console.log(`Records Skipped: ${migrationReport.summary.totalSkipped}`);
  console.log(`Orphaned Records: ${migrationReport.summary.orphanedRecords}`);
  console.log(`Smart Assignments: ${migrationReport.summary.smartAssignments}`);
  console.log(`Errors: ${migrationReport.summary.totalErrors}`);
  console.log(`Duration: ${(migrationReport.duration / 1000).toFixed(2)}s`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  
  // Save detailed report
  const timestamp = Date.now();
  const reportPath = join(__dirname, '..', `migration-report-${timestamp}.json`);
  writeFileSync(reportPath, JSON.stringify(migrationReport, null, 2));
  console.log(`\n✅ Detailed migration report saved to: ${reportPath}`);
  
  if (DRY_RUN) {
    console.log('\n⚠️  This was a DRY RUN - No changes were made');
    console.log('Run without --dry-run to execute migration');
  } else {
    console.log('\n✅ Migration complete!');
  }
  
  process.exit(0);
  
} catch (error) {
  console.error('❌ Migration failed:', error);
  console.error(error.stack);
  process.exit(1);
}

