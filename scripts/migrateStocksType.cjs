/**
 * Migration Script: Add 'type' field to all existing stocks, stockBatches, and stockChanges
 * 
 * This script sets the 'type' field for all existing stock-related documents:
 * - stocks: Determined by presence of productId (product) or matiereId (matiere)
 * - stockBatches: Determined by presence of productId (product) or matiereId (matiere)
 * - stockChanges: Determined by presence of productId (product) or matiereId (matiere)
 * 
 * For backward compatibility, all existing documents without a clear type indicator
 * will be set to type: 'product' (since matiere is a newer feature).
 * 
 * Usage:
 *   node scripts/migrateStocksType.cjs [--dry-run]
 * 
 * Options:
 *   --dry-run: Run in dry-run mode (log changes without applying them)
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
// const serviceAccountPath = path.join(__dirname, '../firebase-keys/new-firebase-key.json');
const serviceAccountPath = path.join(__dirname, '../firebase-keys/old-firebase-key.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Configuration
const BATCH_SIZE = 500; // Firestore batch write limit
const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Determine type based on document data
 */
function determineType(docData, collectionName) {
  // If already has type field and it's valid, use it
  if (docData.type === 'product' || docData.type === 'matiere') {
    return docData.type;
  }

  // Determine type based on ID fields
  const hasProductId = docData.productId && docData.productId.trim() !== '';
  const hasMatiereId = docData.matiereId && docData.matiereId.trim() !== '';

  if (hasMatiereId && !hasProductId) {
    return 'matiere';
  } else if (hasProductId) {
    return 'product';
  } else {
    // Default to product for backward compatibility
    // Log warning for documents without clear type indicator
    console.warn(`⚠️  ${collectionName} document ${docData.id || 'unknown'} has neither productId nor matiereId, defaulting to 'product'`);
    return 'product';
  }
}

/**
 * Migrate a collection
 */
async function migrateCollection(collectionName) {
  console.log(`\n📦 Migrating ${collectionName}...`);
  
  try {
    const snapshot = await db.collection(collectionName).get();
    const totalDocs = snapshot.size;
    
    console.log(`   Found ${totalDocs} documents to process`);

    if (totalDocs === 0) {
      console.log(`   ✅ No documents found in ${collectionName}`);
      return { processed: 0, updated: 0, skipped: 0, errors: 0 };
    }

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const errorsList = [];

    // Process in batches
    const batches = [];
    let currentBatch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
      const docData = doc.data();
      const docId = doc.id;

      // Determine the type
      const determinedType = determineType({ ...docData, id: docId }, collectionName);

      // Check if document already has correct type
      if (docData.type === determinedType) {
        skipped++;
        if (processed < 10) { // Log first 10 skipped for visibility
          console.log(`   ⏭️  Skipped ${docId}: Already has correct type "${docData.type}"`);
        }
        processed++;
        continue;
      }

      // Add to batch
      const docRef = db.collection(collectionName).doc(docId);
      currentBatch.update(docRef, {
        type: determinedType,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      batchCount++;
      updated++;

      if (updated <= 10) { // Log first 10 updates for visibility
        console.log(`   📝 Will update ${docId}: ${docData.type || 'no type'} → ${determinedType}`);
      }

      // Commit batch when it reaches BATCH_SIZE
      if (batchCount >= BATCH_SIZE) {
        batches.push(currentBatch);
        currentBatch = db.batch();
        batchCount = 0;
      }

      processed++;
      
      if (processed % 100 === 0) {
        console.log(`   📈 Progress: ${processed}/${totalDocs} processed...`);
      }
    }

    // Add remaining batch if any
    if (batchCount > 0) {
      batches.push(currentBatch);
    }

    // Execute batches
    if (!DRY_RUN && batches.length > 0) {
      console.log(`   💾 Committing ${batches.length} batch(es)...`);
      
      for (let i = 0; i < batches.length; i++) {
        try {
          await batches[i].commit();
          console.log(`   ✅ Batch ${i + 1}/${batches.length} committed successfully`);
        } catch (error) {
          errors++;
          const errorMsg = `   ❌ Error committing batch ${i + 1}: ${error.message}`;
          errorsList.push(errorMsg);
          console.error(errorMsg);
        }
      }
    } else if (DRY_RUN && batches.length > 0) {
      console.log(`   🔍 DRY RUN: Would commit ${batches.length} batch(es)...`);
    }

    console.log(`   ✅ ${collectionName} migration complete: ${updated} updated, ${skipped} skipped, ${errors} errors`);

    return { processed, updated, skipped, errors, errorsList };
  } catch (error) {
    console.error(`   ❌ Error migrating ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Main migration function
 */
async function migrateStocks() {
  console.log('\n🚀 Starting Stock Type Migration...');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be applied)' : 'LIVE (changes will be applied)'}\n`);

  try {
    const results = {
      stocks: { processed: 0, updated: 0, skipped: 0, errors: 0 },
      stockBatches: { processed: 0, updated: 0, skipped: 0, errors: 0 },
      stockChanges: { processed: 0, updated: 0, skipped: 0, errors: 0 }
    };

    // Migrate each collection
    results.stocks = await migrateCollection('stocks');
    results.stockBatches = await migrateCollection('stockBatches');
    results.stockChanges = await migrateCollection('stockChanges');

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    
    console.log('\n📦 stocks:');
    console.log(`   Total processed: ${results.stocks.processed}`);
    console.log(`   Updated: ${results.stocks.updated}`);
    console.log(`   Skipped: ${results.stocks.skipped}`);
    console.log(`   Errors: ${results.stocks.errors}`);

    console.log('\n📦 stockBatches:');
    console.log(`   Total processed: ${results.stockBatches.processed}`);
    console.log(`   Updated: ${results.stockBatches.updated}`);
    console.log(`   Skipped: ${results.stockBatches.skipped}`);
    console.log(`   Errors: ${results.stockBatches.errors}`);

    console.log('\n📦 stockChanges:');
    console.log(`   Total processed: ${results.stockChanges.processed}`);
    console.log(`   Updated: ${results.stockChanges.updated}`);
    console.log(`   Skipped: ${results.stockChanges.skipped}`);
    console.log(`   Errors: ${results.stockChanges.errors}`);

    const totalProcessed = results.stocks.processed + results.stockBatches.processed + results.stockChanges.processed;
    const totalUpdated = results.stocks.updated + results.stockBatches.updated + results.stockChanges.updated;
    const totalSkipped = results.stocks.skipped + results.stockBatches.skipped + results.stockChanges.skipped;
    const totalErrors = results.stocks.errors + results.stockBatches.errors + results.stockChanges.errors;

    console.log('\n' + '-'.repeat(60));
    console.log('📊 TOTALS:');
    console.log(`   Total processed: ${totalProcessed}`);
    console.log(`   Total updated: ${totalUpdated}`);
    console.log(`   Total skipped: ${totalSkipped}`);
    console.log(`   Total errors: ${totalErrors}`);
    
    if (DRY_RUN) {
      console.log('\n⚠️  DRY RUN MODE: No changes were applied');
      console.log('Run without --dry-run to apply changes');
    } else {
      console.log('\n✅ Migration completed!');
    }

    if (totalErrors > 0) {
      console.log('\n❌ ERRORS ENCOUNTERED:');
      if (results.stocks.errorsList) results.stocks.errorsList.forEach(e => console.log(`  - ${e}`));
      if (results.stockBatches.errorsList) results.stockBatches.errorsList.forEach(e => console.log(`  - ${e}`));
      if (results.stockChanges.errorsList) results.stockChanges.errorsList.forEach(e => console.log(`  - ${e}`));
    }

    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    throw error;
  }
}

// Run migration
migrateStocks()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

