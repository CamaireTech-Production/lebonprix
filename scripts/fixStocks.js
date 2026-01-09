/**
 * Stock System Fix Script
 * 
 * This script fixes stock system issues:
 * 1. Removes product.stock field from all products (batches are source of truth)
 * 2. Fixes invalid batches (where remainingQuantity > quantity)
 * 3. Validates and corrects batch data
 * 
 * Usage:
 *   node scripts/fixStocks.js [--companyId=COMPANY_ID] [--type=product|matiere|all] [--dry-run]
 *   
 *   Options:
 *     --companyId=ID    Filter by specific company ID
 *     --type=TYPE       Fix 'product', 'matiere', or 'all' (default: 'all')
 *     --dry-run         Show what would be fixed without making changes
 *     --key=KEY         Use 'old' or 'new' Firebase key (default: 'old')
 * 
 * WARNING: This script modifies data. Use --dry-run first to preview changes.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple argv parser
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    return [key, value === undefined ? true : value];
  })
);

const companyIdFilter = args.companyId || null;
const typeFilter = args.type || 'all';
const keyType = args.key || 'old';
const DRY_RUN = args['dry-run'] === true || args.dryRun === true;

// Resolve service account credentials
function getServiceAccount() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (fs.existsSync(envPath)) {
      console.log(`📁 Using service account from GOOGLE_APPLICATION_CREDENTIALS: ${envPath}`);
      return JSON.parse(fs.readFileSync(envPath, 'utf8'));
    }
  }
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log('📁 Using service account from FIREBASE_SERVICE_ACCOUNT environment variable');
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }
  
  const possiblePaths = [
    path.join(__dirname, '../firebase-keys/old-firebase-key.json'),
    path.join(__dirname, '../firebase-keys/new-firebase-key.json'),
    path.join(__dirname, '../firebase-keys/le-bon-prix-finances-firebase-adminsdk-fbsvc-530fd9488e.json'),
  ];
  
  if (keyType === 'old') {
    const oldKeyPath = path.join(__dirname, '../firebase-keys/old-firebase-key.json');
    if (fs.existsSync(oldKeyPath)) {
      console.log(`📁 Using OLD Firebase key: ${oldKeyPath}`);
      return JSON.parse(fs.readFileSync(oldKeyPath, 'utf8'));
    }
  } else if (keyType === 'new') {
    const newKeyPath = path.join(__dirname, '../firebase-keys/new-firebase-key.json');
    if (fs.existsSync(newKeyPath)) {
      console.log(`📁 Using NEW Firebase key: ${newKeyPath}`);
      return JSON.parse(fs.readFileSync(newKeyPath, 'utf8'));
    }
  }
  
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      console.log(`📁 Auto-detected service account: ${possiblePath}`);
      return JSON.parse(fs.readFileSync(possiblePath, 'utf8'));
    }
  }
  
  throw new Error('Missing service account. See diagnoseStocks.js for setup instructions.');
}

function initAdmin() {
  if (!admin.apps.length) {
    const credential = admin.credential.cert(getServiceAccount());
    admin.initializeApp({ credential });
  }
  return admin.firestore();
}

async function main() {
  const db = initAdmin();
  
  console.log('\n' + '='.repeat(80));
  console.log(DRY_RUN ? '🔍 STOCK SYSTEM FIX (DRY RUN - NO CHANGES)' : '🔧 STOCK SYSTEM FIX');
  console.log('='.repeat(80));
  console.log(`Company Filter: ${companyIdFilter || 'ALL COMPANIES'}`);
  console.log(`Type Filter: ${typeFilter.toUpperCase()}`);
  console.log(`Firebase Key: ${keyType.toUpperCase()}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (preview only)' : 'LIVE (will modify data)'}`);
  console.log('='.repeat(80) + '\n');

  const report = {
    timestamp: new Date().toISOString(),
    dryRun: DRY_RUN,
    companyId: companyIdFilter,
    typeFilter,
    products: {
      stockFieldRemoved: 0,
      batchesFixed: 0,
      batchesDeleted: 0
    },
    matieres: {
      batchesFixed: 0,
      batchesDeleted: 0
    }
  };

  // ============================================================================
  // 1. FIX INVALID BATCHES
  // ============================================================================
  console.log('🔧 Fixing invalid batches...');
  const batchesRef = db.collection('stockBatches');
  const batchesQuery = companyIdFilter
    ? batchesRef.where('companyId', '==', companyIdFilter)
    : batchesRef;
  
  const batchesSnap = await batchesQuery.get();
  const allBatches = batchesSnap.docs.map(doc => ({
    id: doc.id,
    ref: doc.ref,
    ...doc.data()
  }));

  const productBatches = allBatches.filter(b => b.type === 'product');
  const matiereBatches = allBatches.filter(b => b.type === 'matiere');

  const batch = db.batch();
  let batchCount = 0;

  // Fix product batches
  if (typeFilter === 'all' || typeFilter === 'product') {
    for (const batchDoc of productBatches) {
      const issues = [];
      
      // Check if remainingQuantity > quantity (impossible!)
      if (batchDoc.remainingQuantity > batchDoc.quantity) {
        issues.push(`remainingQuantity (${batchDoc.remainingQuantity}) > quantity (${batchDoc.quantity})`);
        
        if (!DRY_RUN) {
          // Fix: Set remainingQuantity to quantity (can't have more remaining than total)
          batch.update(batchDoc.ref, {
            remainingQuantity: batchDoc.quantity,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          report.products.batchesFixed++;
        } else {
          console.log(`   Would fix batch ${batchDoc.id}: remainingQuantity ${batchDoc.remainingQuantity} → ${batchDoc.quantity}`);
        }
        batchCount++;
      }
      
      // Check for negative values
      if (batchDoc.remainingQuantity < 0) {
        issues.push(`remainingQuantity is negative: ${batchDoc.remainingQuantity}`);
        
        if (!DRY_RUN) {
          // Fix: Set to 0 or delete if quantity is also invalid
          if (batchDoc.quantity <= 0) {
            batch.delete(batchDoc.ref);
            report.products.batchesDeleted++;
            console.log(`   Deleting invalid batch ${batchDoc.id} (negative values)`);
          } else {
            batch.update(batchDoc.ref, {
              remainingQuantity: 0,
              status: 'depleted',
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            report.products.batchesFixed++;
          }
        } else {
          console.log(`   Would fix batch ${batchDoc.id}: negative remainingQuantity`);
        }
        batchCount++;
      }
      
      if (batchDoc.quantity < 0) {
        issues.push(`quantity is negative: ${batchDoc.quantity}`);
        
        if (!DRY_RUN) {
          batch.delete(batchDoc.ref);
          report.products.batchesDeleted++;
          console.log(`   Deleting invalid batch ${batchDoc.id} (negative quantity)`);
        } else {
          console.log(`   Would delete batch ${batchDoc.id} (negative quantity)`);
        }
        batchCount++;
      }
      
      // Check for missing productId
      if (!batchDoc.productId) {
        issues.push('missing productId');
        
        if (!DRY_RUN) {
          batch.delete(batchDoc.ref);
          report.products.batchesDeleted++;
          console.log(`   Deleting orphaned batch ${batchDoc.id} (no productId)`);
        } else {
          console.log(`   Would delete batch ${batchDoc.id} (no productId)`);
        }
        batchCount++;
      }
      
      if (issues.length > 0 && DRY_RUN) {
        console.log(`   Batch ${batchDoc.id} (product: ${batchDoc.productId || 'N/A'}): ${issues.join(', ')}`);
      }
    }
  }

  // Fix matiere batches
  if (typeFilter === 'all' || typeFilter === 'matiere') {
    for (const batchDoc of matiereBatches) {
      const issues = [];
      
      if (batchDoc.remainingQuantity > batchDoc.quantity) {
        issues.push(`remainingQuantity (${batchDoc.remainingQuantity}) > quantity (${batchDoc.quantity})`);
        
        if (!DRY_RUN) {
          batch.update(batchDoc.ref, {
            remainingQuantity: batchDoc.quantity,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          report.matieres.batchesFixed++;
        } else {
          console.log(`   Would fix matiere batch ${batchDoc.id}: remainingQuantity ${batchDoc.remainingQuantity} → ${batchDoc.quantity}`);
        }
        batchCount++;
      }
      
      if (batchDoc.remainingQuantity < 0 || batchDoc.quantity < 0) {
        issues.push('negative values');
        
        if (!DRY_RUN) {
          if (batchDoc.quantity <= 0) {
            batch.delete(batchDoc.ref);
            report.matieres.batchesDeleted++;
          } else {
            batch.update(batchDoc.ref, {
              remainingQuantity: 0,
              status: 'depleted',
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            report.matieres.batchesFixed++;
          }
        } else {
          console.log(`   Would fix matiere batch ${batchDoc.id}: negative values`);
        }
        batchCount++;
      }
      
      if (!batchDoc.matiereId) {
        if (!DRY_RUN) {
          batch.delete(batchDoc.ref);
          report.matieres.batchesDeleted++;
        } else {
          console.log(`   Would delete matiere batch ${batchDoc.id} (no matiereId)`);
        }
        batchCount++;
      }
    }
  }

  if (batchCount > 0 && !DRY_RUN) {
    await batch.commit();
    console.log(`\n✅ Fixed/deleted ${batchCount} invalid batches`);
  } else if (batchCount > 0) {
    console.log(`\n📋 Would fix/delete ${batchCount} invalid batches`);
  } else {
    console.log('✅ No invalid batches found');
  }

  // ============================================================================
  // 2. REMOVE product.stock FIELD
  // ============================================================================
  if (typeFilter === 'all' || typeFilter === 'product') {
    console.log('\n🗑️  Removing product.stock field...');
    const productsRef = db.collection('products');
    const productsQuery = companyIdFilter
      ? productsRef.where('companyId', '==', companyIdFilter)
      : productsRef;
    
    const productsSnap = await productsQuery.get();
    const removeBatch = db.batch();
    let removeCount = 0;

    for (const productDoc of productsSnap.docs) {
      const product = productDoc.data();
      
      if ('stock' in product) {
        if (!DRY_RUN) {
          removeBatch.update(productDoc.ref, {
            stock: admin.firestore.FieldValue.delete()
          });
          report.products.stockFieldRemoved++;
        } else {
          console.log(`   Would remove stock field from product: ${product.name || productDoc.id} (current: ${product.stock})`);
        }
        removeCount++;
      }
    }

    if (removeCount > 0 && !DRY_RUN) {
      await removeBatch.commit();
      console.log(`✅ Removed stock field from ${removeCount} products`);
    } else if (removeCount > 0) {
      console.log(`📋 Would remove stock field from ${removeCount} products`);
    } else {
      console.log('✅ No products have stock field to remove');
    }
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('📊 FIX SUMMARY');
  console.log('='.repeat(80));
  
  if (typeFilter === 'all' || typeFilter === 'product') {
    console.log('\n📦 PRODUCTS:');
    console.log(`   Stock fields removed: ${report.products.stockFieldRemoved}`);
    console.log(`   Batches fixed: ${report.products.batchesFixed}`);
    console.log(`   Batches deleted: ${report.products.batchesDeleted}`);
  }
  
  if (typeFilter === 'all' || typeFilter === 'matiere') {
    console.log('\n🧪 MATIERES:');
    console.log(`   Batches fixed: ${report.matieres.batchesFixed}`);
    console.log(`   Batches deleted: ${report.matieres.batchesDeleted}`);
  }

  if (DRY_RUN) {
    console.log('\n💡 This was a DRY RUN. No changes were made.');
    console.log('   Run without --dry-run to apply fixes.');
  } else {
    console.log('\n✅ Fixes applied successfully!');
    console.log('   Run diagnoseStocks.js to verify the fixes.');
  }

  console.log('\n');
}

main().catch((err) => {
  console.error('❌ Fix failed:', err);
  process.exit(1);
});

