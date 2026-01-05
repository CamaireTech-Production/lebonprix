/**
 * Comprehensive Stock System Diagnostic Tool (READ-ONLY)
 * 
 * This script inspects the entire stock management system:
 * - Stock batches (products and matieres)
 * - Product.stock field vs batch calculations
 * - Matiere stock vs batch calculations (if applicable)
 * - Stock changes/history consistency
 * - Orphaned batches
 * - Invalid data
 * 
 * Usage:
 *   node scripts/diagnoseStocks.js [--companyId=COMPANY_ID] [--type=product|matiere|all] [--key=old|new] [--export]
 *   
 *   Options:
 *     --companyId=ID    Filter by specific company ID
 *     --type=TYPE      Filter by type: 'product', 'matiere', or 'all' (default: 'all')
 *     --key=KEY         Use 'old' or 'new' Firebase key (default: tries to find old-firebase-key.json)
 *     --export          Export full report to JSON file
 * 
 *   Firebase Authentication:
 *     - Set GOOGLE_APPLICATION_CREDENTIALS to point to service account JSON, OR
 *     - Set FIREBASE_SERVICE_ACCOUNT with JSON string, OR
 *     - Script will try to find firebase-keys/old-firebase-key.json automatically
 * 
 * Output:
 *   - Detailed report of all discrepancies
 *   - Summary statistics
 *   - JSON export of issues (if --export flag is used)
 * 
 * NOTE: This is a READ-ONLY diagnostic tool. No data will be modified.
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
const typeFilter = args.type || 'all'; // 'product', 'matiere', or 'all'
const keyType = args.key || 'old'; // 'old' or 'new'

// Resolve service account credentials
function getServiceAccount() {
  // 1. Check environment variables first
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
  
  // 2. Try to find Firebase key files automatically
  const possiblePaths = [
    path.join(__dirname, '../firebase-keys/old-firebase-key.json'),
    path.join(__dirname, '../firebase-keys/new-firebase-key.json'),
    path.join(__dirname, '../firebase-keys/le-bon-prix-finances-firebase-adminsdk-fbsvc-530fd9488e.json'),
  ];
  
  // If key type is specified, prioritize that
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
  
  // 3. Try all possible paths
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      console.log(`📁 Auto-detected service account: ${possiblePath}`);
      return JSON.parse(fs.readFileSync(possiblePath, 'utf8'));
    }
  }
  
  throw new Error(
    'Missing service account. Options:\n' +
    '  1. Set GOOGLE_APPLICATION_CREDENTIALS environment variable\n' +
    '  2. Set FIREBASE_SERVICE_ACCOUNT environment variable with JSON string\n' +
    '  3. Place service account JSON in firebase-keys/old-firebase-key.json or firebase-keys/new-firebase-key.json\n' +
    '  4. Use --key=old or --key=new to specify which key to use'
  );
}

function initAdmin() {
  if (!admin.apps.length) {
    const credential = admin.credential.cert(getServiceAccount());
    admin.initializeApp({ credential });
  }
  return admin.firestore();
}

// Helper to format timestamp
function formatTimestamp(timestamp) {
  if (!timestamp) return 'N/A';
  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000).toISOString();
  }
  return timestamp.toString();
}

// Helper to calculate batch totals
function calculateBatchTotals(batches) {
  const remaining = batches.reduce((sum, b) => sum + (b.remainingQuantity || 0), 0);
  const total = batches.reduce((sum, b) => sum + (b.quantity || 0), 0);
  const active = batches.filter(b => b.status === 'active').length;
  const depleted = batches.filter(b => b.status === 'depleted').length;
  const corrected = batches.filter(b => b.status === 'corrected').length;
  
  return { remaining, total, active, depleted, corrected, count: batches.length };
}

async function main() {
  const db = initAdmin();
  
  console.log('\n' + '='.repeat(80));
  console.log('🔍 COMPREHENSIVE STOCK SYSTEM DIAGNOSTIC (READ-ONLY)');
  console.log('='.repeat(80));
  console.log(`Company Filter: ${companyIdFilter || 'ALL COMPANIES'}`);
  console.log(`Type Filter: ${typeFilter.toUpperCase()}`);
  console.log(`Firebase Key: ${keyType.toUpperCase()}`);
  console.log('='.repeat(80) + '\n');

  const report = {
    timestamp: new Date().toISOString(),
    companyId: companyIdFilter,
    typeFilter,
    products: {
      total: 0,
      withBatches: 0,
      withoutBatches: 0,
      discrepancies: [],
      orphanedBatches: [],
      invalidBatches: []
    },
    matieres: {
      total: 0,
      withBatches: 0,
      withoutBatches: 0,
      discrepancies: [],
      orphanedBatches: [],
      invalidBatches: []
    },
    stockBatches: {
      products: { total: 0, active: 0, depleted: 0, corrected: 0, invalid: [] },
      matieres: { total: 0, active: 0, depleted: 0, corrected: 0, invalid: [] }
    },
    stockChanges: {
      products: { total: 0, issues: [] },
      matieres: { total: 0, issues: [] }
    }
  };

  // ============================================================================
  // 1. FETCH ALL STOCK BATCHES
  // ============================================================================
  console.log('📦 Fetching stock batches...');
  const batchesRef = db.collection('stockBatches');
  const batchesQuery = companyIdFilter
    ? batchesRef.where('companyId', '==', companyIdFilter)
    : batchesRef;
  
  const batchesSnap = await batchesQuery.get();
  const allBatches = batchesSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  // Separate by type
  const productBatches = allBatches.filter(b => b.type === 'product');
  const matiereBatches = allBatches.filter(b => b.type === 'matiere');

  report.stockBatches.products.total = productBatches.length;
  report.stockBatches.matieres.total = matiereBatches.length;

  console.log(`   Found ${productBatches.length} product batches`);
  console.log(`   Found ${matiereBatches.length} matiere batches`);

  // Check for invalid batches
  const invalidProductBatches = productBatches.filter(b => {
    return !b.productId || 
           b.remainingQuantity < 0 || 
           b.quantity < 0 ||
           b.remainingQuantity > b.quantity ||
           !b.type ||
           b.type !== 'product';
  });

  const invalidMatiereBatches = matiereBatches.filter(b => {
    return !b.matiereId || 
           b.remainingQuantity < 0 || 
           b.quantity < 0 ||
           b.remainingQuantity > b.quantity ||
           !b.type ||
           b.type !== 'matiere';
  });

  report.stockBatches.products.invalid = invalidProductBatches;
  report.stockBatches.matieres.invalid = invalidMatiereBatches;

  if (invalidProductBatches.length > 0) {
    console.log(`   ⚠️  Found ${invalidProductBatches.length} invalid product batches`);
  }
  if (invalidMatiereBatches.length > 0) {
    console.log(`   ⚠️  Found ${invalidMatiereBatches.length} invalid matiere batches`);
  }

  // Group batches by productId/matiereId
  const batchesByProduct = new Map();
  const batchesByMatiere = new Map();

  productBatches.forEach(batch => {
    if (batch.productId) {
      const arr = batchesByProduct.get(batch.productId) || [];
      arr.push(batch);
      batchesByProduct.set(batch.productId, arr);
    }
  });

  matiereBatches.forEach(batch => {
    if (batch.matiereId) {
      const arr = batchesByMatiere.get(batch.matiereId) || [];
      arr.push(batch);
      batchesByMatiere.set(batch.matiereId, arr);
    }
  });

  // ============================================================================
  // 2. CHECK PRODUCTS
  // ============================================================================
  if (typeFilter === 'all' || typeFilter === 'product') {
    console.log('\n📋 Checking products...');
    const productsRef = db.collection('products');
    const productsQuery = companyIdFilter
      ? productsRef.where('companyId', '==', companyIdFilter)
      : productsRef;
    
    const productsSnap = await productsQuery.get();
    const products = productsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    report.products.total = products.length;
    console.log(`   Found ${products.length} products`);

    for (const product of products) {
      const productBatches = batchesByProduct.get(product.id) || [];
      const batchTotals = calculateBatchTotals(productBatches);
      const recordedStock = typeof product.stock === 'number' ? product.stock : 0;

      if (productBatches.length > 0) {
        report.products.withBatches++;
        
        // Check for discrepancy
        if (batchTotals.remaining !== recordedStock) {
          report.products.discrepancies.push({
            productId: product.id,
            productName: product.name || 'N/A',
            companyId: product.companyId || 'N/A',
            recordedStock,
            batchRemaining: batchTotals.remaining,
            batchTotal: batchTotals.total,
            batchCount: batchTotals.count,
            difference: batchTotals.remaining - recordedStock,
            batches: productBatches.map(b => ({
              id: b.id,
              quantity: b.quantity,
              remaining: b.remainingQuantity,
              status: b.status,
              costPrice: b.costPrice
            }))
          });
        }
      } else {
        report.products.withoutBatches++;
        
        // Product has stock but no batches - potential issue
        if (recordedStock > 0) {
          report.products.discrepancies.push({
            productId: product.id,
            productName: product.name || 'N/A',
            companyId: product.companyId || 'N/A',
            recordedStock,
            batchRemaining: 0,
            batchTotal: 0,
            batchCount: 0,
            difference: -recordedStock,
            issue: 'Product has stock field but no batches (legacy data)',
            batches: []
          });
        }
      }
    }

    // Find orphaned batches (batches pointing to non-existent products)
    console.log('   Checking for orphaned product batches...');
    const productIds = new Set(products.map(p => p.id));
    for (const batch of productBatches) {
      if (batch.productId && !productIds.has(batch.productId)) {
        report.products.orphanedBatches.push({
          batchId: batch.id,
          productId: batch.productId,
          quantity: batch.quantity,
          remaining: batch.remainingQuantity,
          status: batch.status,
          companyId: batch.companyId || 'N/A',
          createdAt: formatTimestamp(batch.createdAt)
        });
      }
    }

    console.log(`   Products with batches: ${report.products.withBatches}`);
    console.log(`   Products without batches: ${report.products.withoutBatches}`);
    console.log(`   Discrepancies found: ${report.products.discrepancies.length}`);
    console.log(`   Orphaned batches: ${report.products.orphanedBatches.length}`);
  }

  // ============================================================================
  // 3. CHECK MATIERES
  // ============================================================================
  if (typeFilter === 'all' || typeFilter === 'matiere') {
    console.log('\n🧪 Checking matieres...');
    const matieresRef = db.collection('matieres');
    const matieresQuery = companyIdFilter
      ? matieresRef.where('companyId', '==', companyIdFilter)
      : matieresRef;
    
    const matieresSnap = await matieresQuery.get();
    const matieres = matieresSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    report.matieres.total = matieres.length;
    console.log(`   Found ${matieres.length} matieres`);

    for (const matiere of matieres) {
      const matiereBatches = batchesByMatiere.get(matiere.id) || [];
      const batchTotals = calculateBatchTotals(matiereBatches);
      
      // Matieres might not have a stock field, but we check if they do
      const recordedStock = typeof matiere.stock === 'number' ? matiere.stock : null;

      if (matiereBatches.length > 0) {
        report.matieres.withBatches++;
        
        // Check for discrepancy if stock field exists
        if (recordedStock !== null && batchTotals.remaining !== recordedStock) {
          report.matieres.discrepancies.push({
            matiereId: matiere.id,
            matiereName: matiere.name || 'N/A',
            companyId: matiere.companyId || 'N/A',
            recordedStock,
            batchRemaining: batchTotals.remaining,
            batchTotal: batchTotals.total,
            batchCount: batchTotals.count,
            difference: batchTotals.remaining - recordedStock,
            batches: matiereBatches.map(b => ({
              id: b.id,
              quantity: b.quantity,
              remaining: b.remainingQuantity,
              status: b.status,
              costPrice: b.costPrice
            }))
          });
        }
      } else {
        report.matieres.withoutBatches++;
      }
    }

    // Find orphaned batches
    console.log('   Checking for orphaned matiere batches...');
    const matiereIds = new Set(matieres.map(m => m.id));
    for (const batch of matiereBatches) {
      if (batch.matiereId && !matiereIds.has(batch.matiereId)) {
        report.matieres.orphanedBatches.push({
          batchId: batch.id,
          matiereId: batch.matiereId,
          quantity: batch.quantity,
          remaining: batch.remainingQuantity,
          status: batch.status,
          companyId: batch.companyId || 'N/A',
          createdAt: formatTimestamp(batch.createdAt)
        });
      }
    }

    console.log(`   Matieres with batches: ${report.matieres.withBatches}`);
    console.log(`   Matieres without batches: ${report.matieres.withoutBatches}`);
    console.log(`   Discrepancies found: ${report.matieres.discrepancies.length}`);
    console.log(`   Orphaned batches: ${report.matieres.orphanedBatches.length}`);
  }

  // ============================================================================
  // 4. CHECK STOCK CHANGES
  // ============================================================================
  console.log('\n📊 Checking stock changes...');
  const changesRef = db.collection('stockChanges');
  const changesQuery = companyIdFilter
    ? changesRef.where('companyId', '==', companyIdFilter)
    : changesRef;
  
  const changesSnap = await changesQuery.get();
  const allChanges = changesSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  const productChanges = allChanges.filter(c => c.type === 'product');
  const matiereChanges = allChanges.filter(c => c.type === 'matiere');

  report.stockChanges.products.total = productChanges.length;
  report.stockChanges.matieres.total = matiereChanges.length;

  console.log(`   Found ${productChanges.length} product stock changes`);
  console.log(`   Found ${matiereChanges.length} matiere stock changes`);

  // Check for changes with invalid references
  const productIds = typeFilter === 'all' || typeFilter === 'product' 
    ? new Set((await db.collection('products').get()).docs.map(d => d.id))
    : new Set();
  
  const matiereIds = typeFilter === 'all' || typeFilter === 'matiere'
    ? new Set((await db.collection('matieres').get()).docs.map(d => d.id))
    : new Set();

  for (const change of productChanges) {
    if (change.productId && !productIds.has(change.productId)) {
      report.stockChanges.products.issues.push({
        changeId: change.id,
        productId: change.productId,
        change: change.change,
        reason: change.reason,
        issue: 'References non-existent product'
      });
    }
  }

  for (const change of matiereChanges) {
    if (change.matiereId && !matiereIds.has(change.matiereId)) {
      report.stockChanges.matieres.issues.push({
        changeId: change.id,
        matiereId: change.matiereId,
        change: change.change,
        reason: change.reason,
        issue: 'References non-existent matiere'
      });
    }
  }

  if (report.stockChanges.products.issues.length > 0) {
    console.log(`   ⚠️  Found ${report.stockChanges.products.issues.length} product stock changes with issues`);
  }
  if (report.stockChanges.matieres.issues.length > 0) {
    console.log(`   ⚠️  Found ${report.stockChanges.matieres.issues.length} matiere stock changes with issues`);
  }

  // ============================================================================
  // 5. SUMMARY REPORT
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('📊 DIAGNOSTIC SUMMARY');
  console.log('='.repeat(80));

  if (typeFilter === 'all' || typeFilter === 'product') {
    console.log('\n📦 PRODUCTS:');
    console.log(`   Total products: ${report.products.total}`);
    console.log(`   With batches: ${report.products.withBatches}`);
    console.log(`   Without batches: ${report.products.withoutBatches}`);
    console.log(`   Stock discrepancies: ${report.products.discrepancies.length}`);
    console.log(`   Orphaned batches: ${report.products.orphanedBatches.length}`);
    console.log(`   Invalid batches: ${report.stockBatches.products.invalid.length}`);
    
    if (report.products.discrepancies.length > 0) {
      console.log('\n   🔴 TOP DISCREPANCIES:');
      report.products.discrepancies
        .slice(0, 10)
        .forEach((d, idx) => {
          console.log(`   ${idx + 1}. ${d.productName} (${d.productId})`);
          console.log(`      Recorded: ${d.recordedStock} | Batches: ${d.batchRemaining} | Diff: ${d.difference > 0 ? '+' : ''}${d.difference}`);
        });
    }
  }

  if (typeFilter === 'all' || typeFilter === 'matiere') {
    console.log('\n🧪 MATIERES:');
    console.log(`   Total matieres: ${report.matieres.total}`);
    console.log(`   With batches: ${report.matieres.withBatches}`);
    console.log(`   Without batches: ${report.matieres.withoutBatches}`);
    console.log(`   Stock discrepancies: ${report.matieres.discrepancies.length}`);
    console.log(`   Orphaned batches: ${report.matieres.orphanedBatches.length}`);
    console.log(`   Invalid batches: ${report.stockBatches.matieres.invalid.length}`);
    
    if (report.matieres.discrepancies.length > 0) {
      console.log('\n   🔴 TOP DISCREPANCIES:');
      report.matieres.discrepancies
        .slice(0, 10)
        .forEach((d, idx) => {
          console.log(`   ${idx + 1}. ${d.matiereName} (${d.matiereId})`);
          console.log(`      Recorded: ${d.recordedStock} | Batches: ${d.batchRemaining} | Diff: ${d.difference > 0 ? '+' : ''}${d.difference}`);
        });
    }
  }

  console.log('\n' + '='.repeat(80));

  // ============================================================================
  // 6. EXPORT REPORT (OPTIONAL)
  // ============================================================================
  if (args.export) {
    const filename = `stock-diagnostic-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log(`\n💾 Full report exported to: ${filename}`);
  }

  // Calculate total issues
  const totalIssues = 
    report.products.discrepancies.length +
    report.products.orphanedBatches.length +
    report.stockBatches.products.invalid.length +
    report.matieres.discrepancies.length +
    report.matieres.orphanedBatches.length +
    report.stockBatches.matieres.invalid.length +
    report.stockChanges.products.issues.length +
    report.stockChanges.matieres.issues.length;

  if (totalIssues === 0) {
    console.log('\n✅ No issues found! Stock system is healthy.');
  } else {
    console.log(`\n⚠️  Total issues found: ${totalIssues}`);
    console.log('   Run fixStocks.js to correct these issues.');
  }

  console.log('\n');
}

main().catch((err) => {
  console.error('❌ Diagnostic failed:', err);
  process.exit(1);
});

