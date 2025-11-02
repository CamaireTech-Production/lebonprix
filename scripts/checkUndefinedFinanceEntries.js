/**
 * Check Undefined isDeleted Finance Entries
 * 
 * This script identifies finance entries where isDeleted is undefined
 * and analyzes their linked sources to determine if they should be deleted
 */

import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COMPANY_ID = process.argv[2] || 'lu2rRu4YIxczwnjQpQ8pRpFUVlQ2';

console.log('🔍 CHECKING UNDEFINED ISDELETED FINANCE ENTRIES\n');
console.log('=' .repeat(70));
console.log(`Company ID: ${COMPANY_ID}`);
console.log('=' .repeat(70) + '\n');

try {
  const serviceAccount = JSON.parse(readFileSync(join(__dirname, '../firebase-service-account.json'), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  console.log('📊 Step 1: Loading finance entries...\n');

  // Load all finance entries for this company
  const financesSnapshot = await db.collection('finances')
    .where('companyId', '==', COMPANY_ID)
    .get();
  
  console.log(`   Total finance entries: ${financesSnapshot.size}\n`);

  // Load sales and expenses for reference checking
  const salesSnapshot = await db.collection('sales')
    .where('companyId', '==', COMPANY_ID)
    .get();
  
  const expensesSnapshot = await db.collection('expenses')
    .where('companyId', '==', COMPANY_ID)
    .get();

  console.log(`   Total sales: ${salesSnapshot.size}`);
  console.log(`   Total expenses: ${expensesSnapshot.size}\n`);

  // Process data
  const allFinanceEntries = [];
  financesSnapshot.forEach(doc => {
    const entry = doc.data();
    allFinanceEntries.push({ docId: doc.id, ...entry });
  });

  const sales = [];
  salesSnapshot.forEach(doc => {
    const sale = doc.data();
    sales.push({ docId: doc.id, ...sale });
  });

  const expenses = [];
  expensesSnapshot.forEach(doc => {
    const expense = doc.data();
    expenses.push({ docId: doc.id, ...expense });
  });

  // Build lookup maps
  const activeSaleIds = new Set(
    sales.filter(s => s.isAvailable !== false).map(s => s.docId)
  );
  
  const activeExpenseIds = new Set(
    expenses.filter(e => e.isAvailable !== false).map(e => e.docId)
  );

  console.log(`   Active sales: ${activeSaleIds.size}`);
  console.log(`   Active expenses: ${activeExpenseIds.size}\n`);

  console.log('🔍 Step 2: Analyzing isDeleted status...\n');

  // Categorize entries
  const undefinedEntries = allFinanceEntries.filter(e => e.isDeleted === undefined);
  const falseEntries = allFinanceEntries.filter(e => e.isDeleted === false);
  const trueEntries = allFinanceEntries.filter(e => e.isDeleted === true);

  console.log(`   isDeleted === undefined: ${undefinedEntries.length}`);
  console.log(`   isDeleted === false:     ${falseEntries.length}`);
  console.log(`   isDeleted === true:      ${trueEntries.length}`);
  console.log(`   Total:                   ${allFinanceEntries.length}\n`);

  if (undefinedEntries.length === 0) {
    console.log('✅ No entries with undefined isDeleted field!\n');
    process.exit(0);
  }

  console.log('🔍 Step 3: Checking linked sources for undefined entries...\n');

  const report = {
    companyId: COMPANY_ID,
    timestamp: new Date().toISOString(),
    summary: {
      totalEntries: allFinanceEntries.length,
      undefinedEntries: undefinedEntries.length,
      falseEntries: falseEntries.length,
      trueEntries: trueEntries.length
    },
    undefinedEntriesAnalysis: {
      orphaned: [],
      active: [],
      manual: []
    }
  };

  // Analyze each undefined entry
  for (const entry of undefinedEntries) {
    const analysis = {
      docId: entry.docId,
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      type: entry.type,
      amount: entry.amount,
      description: entry.description,
      createdAt: entry.createdAt?.toDate?.()?.toISOString() || entry.createdAt,
      status: '',
      reason: ''
    };

    // Check if entry is orphaned (points to deleted/non-existent source)
    if (entry.sourceType === 'sale' && entry.sourceId) {
      if (activeSaleIds.has(entry.sourceId)) {
        analysis.status = 'ACTIVE';
        analysis.reason = 'Linked sale exists and is active';
        report.undefinedEntriesAnalysis.active.push(analysis);
      } else {
        analysis.status = 'ORPHANED';
        analysis.reason = 'Linked sale does not exist or is deleted';
        report.undefinedEntriesAnalysis.orphaned.push(analysis);
      }
    } else if (entry.sourceType === 'expense' && entry.sourceId) {
      if (activeExpenseIds.has(entry.sourceId)) {
        analysis.status = 'ACTIVE';
        analysis.reason = 'Linked expense exists and is active';
        report.undefinedEntriesAnalysis.active.push(analysis);
      } else {
        analysis.status = 'ORPHANED';
        analysis.reason = 'Linked expense does not exist or is deleted';
        report.undefinedEntriesAnalysis.orphaned.push(analysis);
      }
    } else if (entry.sourceType === 'manual') {
      analysis.status = 'MANUAL';
      analysis.reason = 'Manual entry (no linked source)';
      report.undefinedEntriesAnalysis.manual.push(analysis);
    } else if (entry.sourceType === 'supplier') {
      analysis.status = 'SUPPLIER';
      analysis.reason = 'Supplier entry (no linked source check)';
      report.undefinedEntriesAnalysis.manual.push(analysis);
    } else {
      analysis.status = 'UNKNOWN';
      analysis.reason = 'Unknown source type';
      report.undefinedEntriesAnalysis.manual.push(analysis);
    }
  }

  // Summary
  const orphanedCount = report.undefinedEntriesAnalysis.orphaned.length;
  const activeCount = report.undefinedEntriesAnalysis.active.length;
  const manualCount = report.undefinedEntriesAnalysis.manual.length;

  console.log('📊 Analysis Results:\n');
  console.log(`   Orphaned entries (should be deleted): ${orphanedCount}`);
  if (orphanedCount > 0) {
    const orphanedAmount = report.undefinedEntriesAnalysis.orphaned.reduce((sum, e) => sum + e.amount, 0);
    console.log(`   Orphaned amount: ${orphanedAmount.toLocaleString()} XAF`);
    console.log(`\n   Orphaned entries (first 10):`);
    report.undefinedEntriesAnalysis.orphaned.slice(0, 10).forEach(e => {
      console.log(`      - ${e.docId}: ${e.amount.toLocaleString()} XAF (${e.sourceType}) - ${e.reason}`);
    });
    if (orphanedCount > 10) {
      console.log(`      ... and ${orphanedCount - 10} more`);
    }
  }

  console.log(`\n   Active entries (should be kept): ${activeCount}`);
  if (activeCount > 0) {
    const activeAmount = report.undefinedEntriesAnalysis.active.reduce((sum, e) => sum + e.amount, 0);
    console.log(`   Active amount: ${activeAmount.toLocaleString()} XAF`);
    console.log(`\n   Active entries (first 10):`);
    report.undefinedEntriesAnalysis.active.slice(0, 10).forEach(e => {
      console.log(`      - ${e.docId}: ${e.amount.toLocaleString()} XAF (${e.sourceType}) - ${e.reason}`);
    });
    if (activeCount > 10) {
      console.log(`      ... and ${activeCount - 10} more`);
    }
  }

  console.log(`\n   Manual/Other entries: ${manualCount}`);
  if (manualCount > 0) {
    const manualAmount = report.undefinedEntriesAnalysis.manual.reduce((sum, e) => sum + e.amount, 0);
    console.log(`   Manual amount: ${manualAmount.toLocaleString()} XAF`);
  }

  // Breakdown by source type
  console.log('\n📋 Breakdown by Source Type:\n');
  const bySourceType = {
    sale: undefinedEntries.filter(e => e.sourceType === 'sale').length,
    expense: undefinedEntries.filter(e => e.sourceType === 'expense').length,
    manual: undefinedEntries.filter(e => e.sourceType === 'manual').length,
    supplier: undefinedEntries.filter(e => e.sourceType === 'supplier').length
  };

  console.log(`   Sale entries:     ${bySourceType.sale}`);
  console.log(`   Expense entries:   ${bySourceType.expense}`);
  console.log(`   Manual entries:    ${bySourceType.manual}`);
  console.log(`   Supplier entries: ${bySourceType.supplier}`);

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS\n');
  console.log('=' .repeat(70));

  if (orphanedCount > 0) {
    console.log(`1. ⚠️  Mark ${orphanedCount} orphaned entries as deleted (isDeleted: true)`);
    console.log(`   These entries point to deleted/non-existent sales or expenses`);
  }

  if (activeCount > 0) {
    console.log(`2. ✅ Set ${activeCount} active entries to isDeleted: false`);
    console.log(`   These entries have valid linked sources and should be visible`);
  }

  if (manualCount > 0) {
    console.log(`3. ℹ️  ${manualCount} manual/supplier entries need manual review`);
    console.log(`   These entries have no linked source to verify`);
  }

  console.log('=' .repeat(70) + '\n');

  // Save detailed report
  const filename = `undefined-finance-entries-${COMPANY_ID}-${Date.now()}.json`;
  writeFileSync(join(__dirname, '..', filename), JSON.stringify(report, null, 2));
  console.log(`📄 Detailed report saved to: ${filename}\n`);

  process.exit(0);
} catch (e) {
  console.error('\n❌ ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
}

