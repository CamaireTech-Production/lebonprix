/**
 * Fix Sales Company ID Migration Script
 * 
 * This script adds companyId to sales that are missing it.
 * For legacy sales, the companyId is derived from the userId (since legacy companies use Firebase Auth UID as company ID).
 * 
 * It also optionally:
 * - Sets isAvailable: true for sales where it's undefined
 * - Ensures the id field matches the document ID
 */

import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Options
const DRY_RUN = process.argv.includes('--dry-run');
const FIX_ISAVAILABLE = process.argv.includes('--fix-isavailable');
const FIX_ID_FIELD = process.argv.includes('--fix-id');
const SPECIFIC_USER = process.argv.find(arg => arg.startsWith('--user='))?.split('=')[1];

console.log('🔧 SALES COMPANY ID FIX SCRIPT\n');
console.log('=' .repeat(70));
console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes will be made)' : '🚀 LIVE (changes will be applied)'}`);
console.log(`Fix isAvailable: ${FIX_ISAVAILABLE ? 'YES' : 'NO'}`);
console.log(`Fix id field: ${FIX_ID_FIELD ? 'YES' : 'NO'}`);
if (SPECIFIC_USER) {
  console.log(`Target User: ${SPECIFIC_USER}`);
} else {
  console.log(`Target: ALL users`);
}
console.log('=' .repeat(70) + '\n');

try {
  const serviceAccount = JSON.parse(readFileSync(join(__dirname, '../firebase-service-account.json'), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  console.log('📊 Step 1: Loading sales data...\n');

  // Load all sales
  let salesQuery = db.collection('sales');
  if (SPECIFIC_USER) {
    salesQuery = salesQuery.where('userId', '==', SPECIFIC_USER);
  }
  
  const salesSnapshot = await salesQuery.get();
  console.log(`   Loaded ${salesSnapshot.size} sales\n`);

  // Process sales
  const allSales = [];
  salesSnapshot.forEach(doc => {
    const sale = doc.data();
    allSales.push({
      docId: doc.id,
      ...sale
    });
  });

  console.log('🔎 Step 2: Identifying sales needing updates...\n');

  const report = {
    timestamp: new Date().toISOString(),
    dryRun: DRY_RUN,
    options: {
      fixIsAvailable: FIX_ISAVAILABLE,
      fixIdField: FIX_ID_FIELD,
      specificUser: SPECIFIC_USER || 'ALL'
    },
    stats: {
      totalSales: allSales.length,
      salesNeedingCompanyId: 0,
      salesNeedingIsAvailable: 0,
      salesNeedingIdFix: 0,
      salesUpdated: 0,
      userCompanyMappings: {}
    },
    updates: [],
    errors: []
  };

  // Load users to map userId to companyId
  console.log('📋 Loading user-company mappings...\n');
  const usersSnapshot = await db.collection('users').get();
  const userCompanyMap = new Map();

  usersSnapshot.forEach(doc => {
    const user = doc.data();
    const userId = doc.id;
    
    // For legacy companies, userId === companyId
    // For new architecture, check user.companies array
    if (user.companies && user.companies.length > 0) {
      // New architecture: user can have multiple companies
      // We'll use the first company as default, but log if there are multiple
      const primaryCompany = user.companies[0];
      userCompanyMap.set(userId, {
        companyId: primaryCompany.companyId,
        isLegacy: false,
        multipleCompanies: user.companies.length > 1,
        companies: user.companies
      });
      
      if (user.companies.length > 1) {
        console.log(`   ⚠️  User ${userId} has ${user.companies.length} companies`);
      }
    } else {
      // Legacy: userId is the companyId
      userCompanyMap.set(userId, {
        companyId: userId,
        isLegacy: true,
        multipleCompanies: false,
        companies: []
      });
    }
  });

  console.log(`   Loaded ${userCompanyMap.size} user-company mappings\n`);

  // Identify sales needing updates
  const salesToUpdate = [];

  for (const sale of allSales) {
    const updates = {};
    let needsUpdate = false;

    // Check companyId
    if (!sale.companyId) {
      report.stats.salesNeedingCompanyId++;
      
      if (!sale.userId) {
        report.errors.push({
          docId: sale.docId,
          error: 'Sale has no userId - cannot determine companyId'
        });
        console.log(`   ❌ Sale ${sale.docId} has no userId`);
        continue;
      }

      const userCompanyInfo = userCompanyMap.get(sale.userId);
      if (!userCompanyInfo) {
        report.errors.push({
          docId: sale.docId,
          userId: sale.userId,
          error: 'User not found in users collection'
        });
        console.log(`   ⚠️  Sale ${sale.docId}: User ${sale.userId} not found`);
        continue;
      }

      // If user has multiple companies, we need to be careful
      if (userCompanyInfo.multipleCompanies) {
        console.log(`   ⚠️  Sale ${sale.docId}: User ${sale.userId} has multiple companies`);
        console.log(`       Using primary company: ${userCompanyInfo.companyId}`);
      }

      updates.companyId = userCompanyInfo.companyId;
      needsUpdate = true;
    }

    // Check isAvailable
    if (FIX_ISAVAILABLE && sale.isAvailable === undefined) {
      report.stats.salesNeedingIsAvailable++;
      updates.isAvailable = true;
      needsUpdate = true;
    }

    // Check id field
    if (FIX_ID_FIELD && (!sale.id || sale.id !== sale.docId)) {
      report.stats.salesNeedingIdFix++;
      updates.id = sale.docId;
      needsUpdate = true;
    }

    if (needsUpdate) {
      salesToUpdate.push({
        docId: sale.docId,
        currentData: {
          companyId: sale.companyId,
          userId: sale.userId,
          isAvailable: sale.isAvailable,
          id: sale.id
        },
        updates
      });
    }
  }

  console.log(`\n📊 Sales Analysis:`);
  console.log(`   Total sales: ${report.stats.totalSales}`);
  console.log(`   Missing companyId: ${report.stats.salesNeedingCompanyId}`);
  if (FIX_ISAVAILABLE) {
    console.log(`   Missing isAvailable: ${report.stats.salesNeedingIsAvailable}`);
  }
  if (FIX_ID_FIELD) {
    console.log(`   Needs id field fix: ${report.stats.salesNeedingIdFix}`);
  }
  console.log(`   Total to update: ${salesToUpdate.length}\n`);

  if (salesToUpdate.length === 0) {
    console.log('✅ No sales need updating!\n');
    const filename = `fix-sales-companyid-${Date.now()}.json`;
    writeFileSync(join(__dirname, '..', filename), JSON.stringify(report, null, 2));
    console.log(`📄 Report saved to: ${filename}\n`);
    process.exit(0);
  }

  // Apply updates
  console.log(`🔧 Step 3: ${DRY_RUN ? 'Simulating' : 'Applying'} updates...\n`);

  let batch = db.batch();
  let batchCount = 0;
  let updatedCount = 0;

  for (const saleUpdate of salesToUpdate) {
    try {
      if (!DRY_RUN) {
        const saleRef = db.collection('sales').doc(saleUpdate.docId);
        batch.update(saleRef, saleUpdate.updates);
        batchCount++;

        // Commit batch every 500 operations (Firestore limit)
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`   ✅ Committed batch (${updatedCount + batchCount} sales updated)`);
          batch = db.batch();
          batchCount = 0;
        }
      }

      updatedCount++;
      report.updates.push({
        docId: saleUpdate.docId,
        updates: saleUpdate.updates,
        status: DRY_RUN ? 'would-update' : 'updated'
      });

      // Log progress every 50 sales
      if (updatedCount % 50 === 0) {
        console.log(`   Progress: ${updatedCount}/${salesToUpdate.length} sales processed`);
      }

    } catch (error) {
      report.errors.push({
        docId: saleUpdate.docId,
        error: error.message
      });
      console.error(`   ❌ Error updating sale ${saleUpdate.docId}:`, error.message);
    }
  }

  // Commit remaining batch
  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
    console.log(`   ✅ Committed final batch\n`);
  }

  report.stats.salesUpdated = updatedCount;

  // Summary
  console.log('\n📊 MIGRATION SUMMARY\n');
  console.log('=' .repeat(70));
  console.log(`Total sales processed: ${report.stats.totalSales}`);
  console.log(`Sales ${DRY_RUN ? 'would be' : ''} updated: ${updatedCount}`);
  
  if (report.stats.salesNeedingCompanyId > 0) {
    console.log(`  - Added companyId: ${report.stats.salesNeedingCompanyId}`);
  }
  if (FIX_ISAVAILABLE && report.stats.salesNeedingIsAvailable > 0) {
    console.log(`  - Fixed isAvailable: ${report.stats.salesNeedingIsAvailable}`);
  }
  if (FIX_ID_FIELD && report.stats.salesNeedingIdFix > 0) {
    console.log(`  - Fixed id field: ${report.stats.salesNeedingIdFix}`);
  }
  
  if (report.errors.length > 0) {
    console.log(`\n⚠️  Errors encountered: ${report.errors.length}`);
    report.errors.slice(0, 5).forEach(err => {
      console.log(`   - ${err.docId}: ${err.error}`);
    });
    if (report.errors.length > 5) {
      console.log(`   ... and ${report.errors.length - 5} more (see report)`);
    }
  }
  console.log('=' .repeat(70));

  if (DRY_RUN) {
    console.log('\n💡 This was a DRY RUN - no changes were made');
    console.log('   Run without --dry-run to apply changes\n');
    console.log('   Options:');
    console.log('   --fix-isavailable  : Also set isAvailable=true where undefined');
    console.log('   --fix-id           : Also fix id field to match document ID');
    console.log('   --user=<userId>    : Only process sales for specific user\n');
  } else {
    console.log('\n✅ Migration completed successfully!\n');
  }

  // Save detailed report
  const filename = `fix-sales-companyid-${DRY_RUN ? 'dry-run-' : ''}${Date.now()}.json`;
  writeFileSync(join(__dirname, '..', filename), JSON.stringify(report, null, 2));
  console.log(`📄 Detailed report saved to: ${filename}\n`);

  process.exit(0);
} catch (e) {
  console.error('\n❌ FATAL ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
}



