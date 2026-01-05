/**
 * Migration Script: Supplier Debts to New Structure
 * 
 * Migrates supplier_debt and supplier_refund finance entries to the new
 * supplier_debts collection structure for simplified debt tracking.
 * 
 * The new structure:
 * - One SupplierDebt document per supplier per company
 * - Contains aggregated totals (totalDebt, totalRefunded, outstanding)
 * - Contains entries array with all debt/refund transactions
 * 
 * Usage:
 *   node scripts/migrateSupplierDebtsToNewStructure.cjs --dry-run
 *   node scripts/migrateSupplierDebtsToNewStructure.cjs
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

console.log(DRY_RUN ? '🔍 DRY RUN MODE - No changes will be made\n' : '🚀 Starting supplier debts migration...\n');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require('../firebase-keys/new-firebase-key.json');
//   const serviceAccount = require('../firebase-keys/old-firebase-key.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

/**
 * Convert Firestore Timestamp to our Timestamp format
 */
function toTimestamp(firestoreTimestamp) {
  if (!firestoreTimestamp) {
    return { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 };
  }
  
  if (firestoreTimestamp.toMillis) {
    // Firestore Timestamp object
    const seconds = Math.floor(firestoreTimestamp.toMillis() / 1000);
    const nanoseconds = (firestoreTimestamp.toMillis() % 1000) * 1000000;
    return { seconds, nanoseconds };
  }
  
  if (firestoreTimestamp.seconds !== undefined) {
    // Already in our format
    return firestoreTimestamp;
  }
  
  return { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 };
}

/**
 * Main migration function
 */
async function migrateSupplierDebts() {
  const report = {
    startTime: new Date().toISOString(),
    dryRun: DRY_RUN,
    totalFinanceEntries: 0,
    supplierDebtsProcessed: 0,
    supplierDebtsCreated: 0,
    supplierDebtsUpdated: 0,
    entriesMigrated: 0,
    skipped: 0,
    errors: 0,
    details: [],
    summary: {}
  };

  try {
    console.log('📊 Loading supplier debt and refund finance entries...');
    
    // Query all supplier_debt and supplier_refund entries
    const debtQuery = db.collection('finances')
      .where('type', 'in', ['supplier_debt', 'supplier_refund'])
      .where('isDeleted', '==', false);
    
    const debtSnapshot = await debtQuery.get();
    report.totalFinanceEntries = debtSnapshot.size;
    
    console.log(`✅ Found ${debtSnapshot.size} supplier debt/refund finance entries\n`);
    
    if (debtSnapshot.empty) {
      console.log('ℹ️  No supplier debts to migrate.\n');
      return report;
    }

    // Group entries by supplierId and companyId
    const supplierDebtsMap = new Map(); // key: `${companyId}_${supplierId}`
    
    console.log('📋 Grouping entries by supplier and company...');
    
    for (const doc of debtSnapshot.docs) {
      try {
        const entry = doc.data();
        
        // Validate required fields
        if (!entry.supplierId || !entry.companyId) {
          report.skipped++;
          report.details.push({
            financeEntryId: doc.id,
            reason: 'Missing supplierId or companyId',
            entry
          });
          continue;
        }
        
        const key = `${entry.companyId}_${entry.supplierId}`;
        
        if (!supplierDebtsMap.has(key)) {
          supplierDebtsMap.set(key, {
            supplierId: entry.supplierId,
            companyId: entry.companyId,
            userId: entry.userId || entry.companyId, // Fallback to companyId for legacy
            debts: [],
            refunds: []
          });
        }
        
        const supplierDebt = supplierDebtsMap.get(key);
        
        if (entry.type === 'supplier_debt') {
          supplierDebt.debts.push({
            id: doc.id,
            amount: Math.abs(entry.amount), // Ensure positive
            description: entry.description || 'Supplier debt',
            batchId: entry.batchId,
            createdAt: toTimestamp(entry.createdAt || entry.date)
          });
        } else if (entry.type === 'supplier_refund') {
          supplierDebt.refunds.push({
            id: doc.id,
            amount: Math.abs(entry.amount), // Ensure positive (refunds are stored as negative in old system)
            description: entry.description || 'Supplier refund',
            refundedDebtId: entry.refundedDebtId, // Link to original debt
            createdAt: toTimestamp(entry.createdAt || entry.date)
          });
        }
        
        report.entriesMigrated++;
      } catch (error) {
        report.errors++;
        console.error(`Error processing finance entry ${doc.id}:`, error);
        report.details.push({
          financeEntryId: doc.id,
          error: error.message
        });
      }
    }
    
    console.log(`✅ Grouped into ${supplierDebtsMap.size} supplier debt records\n`);
    report.supplierDebtsProcessed = supplierDebtsMap.size;
    
    // Create or update SupplierDebt documents
    console.log('📝 Creating/updating supplier_debts collection...');
    
    let batch = db.batch();
    let batchCount = 0;
    
    for (const [key, supplierDebtData] of supplierDebtsMap.entries()) {
      try {
        // Calculate totals
        const totalDebt = supplierDebtData.debts.reduce((sum, d) => sum + d.amount, 0);
        const totalRefunded = supplierDebtData.refunds.reduce((sum, r) => sum + r.amount, 0);
        const outstanding = Math.max(0, totalDebt - totalRefunded);
        
        // Combine all entries (debts first, then refunds, sorted by date)
        const allEntries = [
          ...supplierDebtData.debts.map(d => ({
            id: d.id,
            type: 'debt',
            amount: d.amount,
            description: d.description,
            batchId: d.batchId,
            createdAt: d.createdAt
          })),
          ...supplierDebtData.refunds.map(r => ({
            id: r.id,
            type: 'refund',
            amount: r.amount,
            description: r.description,
            refundedDebtId: r.refundedDebtId,
            createdAt: r.createdAt
          }))
        ].sort((a, b) => {
          // Sort by createdAt (oldest first)
          const aTime = a.createdAt.seconds || 0;
          const bTime = b.createdAt.seconds || 0;
          return aTime - bTime;
        });
        
        // Find or create SupplierDebt document
        // Use a composite key: supplierId + companyId for document ID
        // This ensures one document per supplier per company
        const supplierDebtId = `${supplierDebtData.supplierId}_${supplierDebtData.companyId}`;
        const supplierDebtRef = db.collection('supplier_debts').doc(supplierDebtId);
        
        const existingDoc = await supplierDebtRef.get();
        const now = admin.firestore.Timestamp.now();
        const timestamp = toTimestamp(now);
        
        if (existingDoc.exists) {
          // Update existing document
          const existingData = existingDoc.data();
          
          // Merge entries (avoid duplicates)
          const existingEntryIds = new Set(existingData.entries?.map(e => e.id) || []);
          const newEntries = allEntries.filter(e => !existingEntryIds.has(e.id));
          
          const mergedEntries = [
            ...(existingData.entries || []),
            ...newEntries
          ].sort((a, b) => {
            const aTime = a.createdAt?.seconds || 0;
            const bTime = b.createdAt?.seconds || 0;
            return aTime - bTime;
          });
          
          // Recalculate totals with merged entries
          const mergedTotalDebt = mergedEntries
            .filter(e => e.type === 'debt')
            .reduce((sum, e) => sum + e.amount, 0);
          const mergedTotalRefunded = mergedEntries
            .filter(e => e.type === 'refund')
            .reduce((sum, e) => sum + e.amount, 0);
          const mergedOutstanding = Math.max(0, mergedTotalDebt - mergedTotalRefunded);
          
          if (!DRY_RUN) {
            batch.update(supplierDebtRef, {
              totalDebt: mergedTotalDebt,
              totalRefunded: mergedTotalRefunded,
              outstanding: mergedOutstanding,
              entries: mergedEntries,
              updatedAt: now
            });
          }
          
          report.supplierDebtsUpdated++;
          report.details.push({
            supplierDebtId,
            supplierId: supplierDebtData.supplierId,
            companyId: supplierDebtData.companyId,
            action: DRY_RUN ? 'would-update' : 'updated',
            totalDebt: mergedTotalDebt,
            totalRefunded: mergedTotalRefunded,
            outstanding: mergedOutstanding,
            entriesCount: mergedEntries.length,
            newEntriesCount: newEntries.length
          });
        } else {
          // Create new document
          const supplierDebtDoc = {
            id: supplierDebtId,
            supplierId: supplierDebtData.supplierId,
            companyId: supplierDebtData.companyId,
            userId: supplierDebtData.userId,
            totalDebt,
            totalRefunded,
            outstanding,
            entries: allEntries,
            createdAt: now,
            updatedAt: now
          };
          
          if (!DRY_RUN) {
            batch.set(supplierDebtRef, supplierDebtDoc);
          }
          
          report.supplierDebtsCreated++;
          report.details.push({
            supplierDebtId,
            supplierId: supplierDebtData.supplierId,
            companyId: supplierDebtData.companyId,
            action: DRY_RUN ? 'would-create' : 'created',
            totalDebt,
            totalRefunded,
            outstanding,
            entriesCount: allEntries.length
          });
        }
        
        batchCount++;
        if (batchCount >= 500) {
          if (!DRY_RUN) {
            await batch.commit();
          }
          batch = db.batch();
          batchCount = 0;
          console.log(`   ✅ Processed batch (${report.supplierDebtsCreated + report.supplierDebtsUpdated} documents)`);
        }
      } catch (error) {
        report.errors++;
        console.error(`Error processing supplier debt ${key}:`, error);
        report.details.push({
          key,
          supplierId: supplierDebtData.supplierId,
          companyId: supplierDebtData.companyId,
          error: error.message
        });
      }
    }
    
    // Commit remaining batch
    if (!DRY_RUN && batchCount > 0) {
      await batch.commit();
    }
    
    // Generate summary
    report.summary = {
      totalSuppliers: supplierDebtsMap.size,
      totalDebtAmount: Array.from(supplierDebtsMap.values())
        .reduce((sum, sd) => sum + sd.debts.reduce((s, d) => s + d.amount, 0), 0),
      totalRefundedAmount: Array.from(supplierDebtsMap.values())
        .reduce((sum, sd) => sum + sd.refunds.reduce((s, r) => s + r.amount, 0), 0),
      totalOutstanding: Array.from(supplierDebtsMap.values())
        .reduce((sum, sd) => {
          const totalDebt = sd.debts.reduce((s, d) => s + d.amount, 0);
          const totalRefunded = sd.refunds.reduce((s, r) => s + r.amount, 0);
          return sum + Math.max(0, totalDebt - totalRefunded);
        }, 0)
    };
    
    report.endTime = new Date().toISOString();
    
    return report;
  } catch (error) {
    console.error('❌ Migration error:', error);
    report.errors++;
    report.error = error.message;
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║  Migration: Supplier Debts to New Structure         ║');
    console.log('║  From: finances collection (supplier_debt/refund)    ║');
    console.log('║  To:   supplier_debts collection                     ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
    
    const report = await migrateSupplierDebts();
    
    // Save report
    const timestamp = Date.now();
    const reportPath = path.join(__dirname, '..', `supplier-debts-migration-report-${timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Print summary
    console.log('\n📊 Migration Summary:');
    console.log(`   Total finance entries processed: ${report.totalFinanceEntries}`);
    console.log(`   Supplier debt records processed: ${report.supplierDebtsProcessed}`);
    console.log(`   Supplier debts created: ${report.supplierDebtsCreated}`);
    console.log(`   Supplier debts updated: ${report.supplierDebtsUpdated}`);
    console.log(`   Entries migrated: ${report.entriesMigrated}`);
    console.log(`   Skipped: ${report.skipped}`);
    console.log(`   Errors: ${report.errors}`);
    
    if (report.summary) {
      console.log('\n💰 Financial Summary:');
      console.log(`   Total Debt Amount: ${report.summary.totalDebtAmount.toLocaleString()} XAF`);
      console.log(`   Total Refunded: ${report.summary.totalRefundedAmount.toLocaleString()} XAF`);
      console.log(`   Total Outstanding: ${report.summary.totalOutstanding.toLocaleString()} XAF`);
    }
    
    console.log(`\n📄 Detailed report: ${reportPath}`);
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    
    if (DRY_RUN) {
      console.log('\n⚠️  This was a DRY RUN - No changes were made');
      console.log('Run without --dry-run to execute migration');
    } else {
      console.log('\n✅ Migration complete!');
      console.log('\n⚠️  IMPORTANT: Old finance entries are still in the finances collection.');
      console.log('   They will be excluded from financial calculations but kept for historical reference.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Execute
if (require.main === module) {
  main();
}

module.exports = {
  migrateSupplierDebts
};

