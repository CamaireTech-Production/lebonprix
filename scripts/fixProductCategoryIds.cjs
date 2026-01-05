/**
 * Migration Script: Fix Product Categories (ID → Name)
 * 
 * This script corrects products that have category IDs instead of category names.
 * It finds products with category values that match category document IDs and
 * replaces them with the corresponding category names.
 * 
 * Usage:
 *   node scripts/fixProductCategoryIds.cjs [--dry-run]
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
 * Check if a string looks like a Firestore document ID
 * Firestore IDs are typically 20 characters long and alphanumeric
 */
function looksLikeDocumentId(str) {
  if (!str || typeof str !== 'string') return false;
  // Firestore IDs are typically 20 characters, alphanumeric
  // But they can vary, so we'll check if it matches a category ID
  return /^[a-zA-Z0-9]{15,30}$/.test(str);
}

/**
 * Migrate product categories from IDs to names
 */
async function fixProductCategories() {
  console.log('\n🚀 Starting Product Category Fix Migration...');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be applied)' : 'LIVE (changes will be applied)'}\n`);

  try {
    // Step 1: Get all categories and build a map of ID -> name
    console.log('📦 Step 1: Loading categories...');
    const categoriesSnapshot = await db.collection('categories').get();
    const categoryMap = new Map();
    const categoryNameSet = new Set();
    
    categoriesSnapshot.forEach(doc => {
      const categoryData = doc.data();
      categoryMap.set(doc.id, categoryData.name || '');
      if (categoryData.name) {
        categoryNameSet.add(categoryData.name.toLowerCase());
      }
    });
    
    console.log(`   Found ${categoryMap.size} categories\n`);

    // Step 2: Get all products
    console.log('📦 Step 2: Loading products...');
    const productsSnapshot = await db.collection('products').get();
    const totalProducts = productsSnapshot.size;
    console.log(`   Found ${totalProducts} products\n`);

    if (totalProducts === 0) {
      console.log('✅ No products found. Migration complete.');
      return;
    }

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const errorsList = [];
    const updates = [];

    // Step 3: Process each product
    console.log('📦 Step 3: Analyzing products...');
    for (const doc of productsSnapshot.docs) {
      const productData = doc.data();
      const productId = doc.id;
      const currentCategory = productData.category;

      // Skip if no category
      if (!currentCategory || typeof currentCategory !== 'string') {
        skipped++;
        continue;
      }

      // Check if category is already a name (exists in category names)
      const isCategoryName = categoryNameSet.has(currentCategory.toLowerCase());
      
      // Check if category looks like an ID
      const looksLikeId = looksLikeDocumentId(currentCategory);

      // If it's already a valid category name, skip
      if (isCategoryName) {
        skipped++;
        continue;
      }

      // If it looks like an ID, try to find the corresponding category
      if (looksLikeId && categoryMap.has(currentCategory)) {
        const categoryName = categoryMap.get(currentCategory);
        if (categoryName) {
          updates.push({
            productId: productId,
            productName: productData.name || 'Unknown',
            oldCategory: currentCategory,
            newCategory: categoryName,
            companyId: productData.companyId || 'unknown'
          });
        } else {
          // Category ID exists but has no name - skip
          skipped++;
          console.log(`⚠️  Product ${productId}: Category ID ${currentCategory} has no name, skipping`);
        }
      } else {
        // Category doesn't match any ID and isn't a valid name
        // This might be an orphaned category or invalid data
        skipped++;
        console.log(`⚠️  Product ${productId}: Category "${currentCategory}" doesn't match any category ID or name`);
      }

      processed++;
      
      if (processed % 100 === 0) {
        console.log(`   Progress: ${processed}/${totalProducts} analyzed...`);
      }
    }

    console.log(`\n📊 Analysis complete:`);
    console.log(`   Products to update: ${updates.length}`);
    console.log(`   Products skipped: ${skipped}`);
    console.log(`   Total processed: ${processed}\n`);

    if (updates.length === 0) {
      console.log('✅ No products need updating. Migration complete.');
      return;
    }

    // Step 4: Apply updates in batches
    if (!DRY_RUN) {
      console.log(`💾 Step 4: Applying updates in batches...`);
      
      const batches = [];
      let currentBatch = db.batch();
      let batchCount = 0;

      for (const update of updates) {
        const productRef = db.collection('products').doc(update.productId);
        currentBatch.update(productRef, {
          category: update.newCategory,
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

        if (updated % 100 === 0) {
          console.log(`   Progress: ${updated}/${updates.length} updated...`);
        }
      }

      // Add remaining batch if any
      if (batchCount > 0) {
        batches.push(currentBatch);
      }

      // Execute batches
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
    } else {
      console.log(`\n🔍 DRY RUN: Would update ${updates.length} products...`);
      console.log('\n📋 Sample updates (first 10):');
      updates.slice(0, 10).forEach((update, idx) => {
        console.log(`   ${idx + 1}. Product: ${update.productName} (${update.productId})`);
        console.log(`      Company: ${update.companyId}`);
        console.log(`      Category: "${update.oldCategory}" → "${update.newCategory}"`);
      });
      if (updates.length > 10) {
        console.log(`   ... and ${updates.length - 10} more`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total products found: ${totalProducts}`);
    console.log(`Products processed: ${processed}`);
    console.log(`Products updated: ${updated}`);
    console.log(`Products skipped: ${skipped}`);
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

    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      mode: DRY_RUN ? 'dry-run' : 'live',
      summary: {
        totalProducts: totalProducts,
        processed: processed,
        updated: updated,
        skipped: skipped,
        errors: errors
      },
      updates: updates.map(u => ({
        productId: u.productId,
        productName: u.productName,
        companyId: u.companyId,
        oldCategory: u.oldCategory,
        newCategory: u.newCategory
      })),
      errors: errorsList
    };

    const reportPath = path.join(__dirname, `../product-category-fix-report-${Date.now()}.json`);
    const fs = require('fs');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${reportPath}`);

    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    throw error;
  }
}

// Run migration
fixProductCategories()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

