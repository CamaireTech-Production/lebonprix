/**
 * Migration Script: Add 'type' field to all existing categories
 * 
 * This script sets all existing categories in Firebase to type: 'product'
 * as per the migration plan where all historical categories are product categories.
 * 
 * Usage:
 *   node scripts/migrateCategoriesType.cjs [--dry-run]
 * 
 * Options:
 *   --dry-run: Run in dry-run mode (log changes without applying them)
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../firebase-keys/new-firebase-key.json');
// const serviceAccountPath = path.join(__dirname, '../firebase-keys/old-firebase-key.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Configuration
const BATCH_SIZE = 500; // Firestore batch write limit
const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Migrate all categories to have type: 'product'
 */
async function migrateCategories() {
  console.log('\n🚀 Starting Category Type Migration...');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be applied)' : 'LIVE (changes will be applied)'}\n`);

  try {
    // Get all categories
    const categoriesSnapshot = await db.collection('categories').get();
    const totalCategories = categoriesSnapshot.size;
    
    console.log(`📊 Found ${totalCategories} categories to process\n`);

    if (totalCategories === 0) {
      console.log('✅ No categories found. Migration complete.');
      return;
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

    for (const doc of categoriesSnapshot.docs) {
      const categoryData = doc.data();
      const categoryId = doc.id;

      // Check if category already has type field
      if (categoryData.type) {
        if (categoryData.type === 'product' || categoryData.type === 'matiere') {
          // Already has valid type
          skipped++;
          console.log(`⏭️  Skipped ${categoryId}: Already has type "${categoryData.type}"`);
          continue;
        } else {
          // Has invalid type, will update to 'product'
          console.log(`⚠️  Category ${categoryId} has invalid type "${categoryData.type}", will set to 'product'`);
        }
      }

      // Add to batch
      const categoryRef = db.collection('categories').doc(categoryId);
      currentBatch.update(categoryRef, {
        type: 'product',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      batchCount++;
      updated++;

      // Commit batch when it reaches BATCH_SIZE
      if (batchCount >= BATCH_SIZE) {
        batches.push(currentBatch);
        currentBatch = db.batch();
        batchCount = 0;
      }

      processed++;
      
      if (processed % 100 === 0) {
        console.log(`📈 Progress: ${processed}/${totalCategories} processed...`);
      }
    }

    // Add remaining batch if any
    if (batchCount > 0) {
      batches.push(currentBatch);
    }

    // Execute batches
    if (!DRY_RUN && batches.length > 0) {
      console.log(`\n💾 Committing ${batches.length} batch(es)...`);
      
      for (let i = 0; i < batches.length; i++) {
        try {
          await batches[i].commit();
          console.log(`✅ Batch ${i + 1}/${batches.length} committed successfully`);
        } catch (error) {
          errors++;
          const errorMsg = `❌ Error committing batch ${i + 1}: ${error.message}`;
          errorsList.push(errorMsg);
          console.error(errorMsg);
        }
      }
    } else if (DRY_RUN) {
      console.log(`\n🔍 DRY RUN: Would commit ${batches.length} batch(es)...`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total categories found: ${totalCategories}`);
    console.log(`Categories processed: ${processed}`);
    console.log(`Categories updated: ${updated}`);
    console.log(`Categories skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);
    
    if (DRY_RUN) {
      console.log('\n⚠️  DRY RUN MODE: No changes were applied');
      console.log('Run without --dry-run to apply changes');
    } else {
      console.log('\n✅ Migration completed!');
    }

    if (errorsList.length > 0) {
      console.log('\n❌ ERRORS ENCOUNTERED:');
      errorsList.forEach(error => console.log(`  - ${error}`));
    }

    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    throw error;
  }
}

// Run migration
migrateCategories()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

