/**
 * Fix Missing Finance Entries Script
 * 
 * This script creates missing finance entries for expenses and sales that don't have them.
 * It uses the same logic as syncFinanceEntryWithExpense and syncFinanceEntryWithSale.
 */

import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COMPANY_ID = process.argv[2] || 'lu2rRu4YIxczwnjQpQ8pRpFUVlQ2';
const DRY_RUN = process.argv.includes('--dry-run');

console.log(DRY_RUN ? `🔍 DRY RUN MODE - Analyzing company: ${COMPANY_ID}\n` : `🚀 Fixing missing finance entries for company: ${COMPANY_ID}\n`);

try {
  const serviceAccount = JSON.parse(readFileSync(join(__dirname, '../firebase-service-account.json'), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  // Load all data for this company
  console.log('📊 Loading company data...');
  
  // Finance entries
  const financesSnapshot = await db.collection('finances')
    .where('companyId', '==', COMPANY_ID)
    .get();
  
  // Expenses
  const expensesSnapshot = await db.collection('expenses')
    .where('companyId', '==', COMPANY_ID)
    .get();
  
  // Sales
  const salesSnapshot = await db.collection('sales')
    .where('companyId', '==', COMPANY_ID)
    .get();
  
  console.log(`✅ Loaded ${financesSnapshot.size} finance entries, ${expensesSnapshot.size} expenses, ${salesSnapshot.size} sales\n`);

  // Process finance entries
  const financeEntries = [];
  financesSnapshot.forEach(doc => {
    const entry = doc.data();
    financeEntries.push({ id: doc.id, ...entry });
  });

  // Process expenses
  const expenses = [];
  expensesSnapshot.forEach(doc => {
    const exp = doc.data();
    expenses.push({ id: doc.id, ...exp });
  });

  // Process sales
  const sales = [];
  salesSnapshot.forEach(doc => {
    const sale = doc.data();
    sales.push({ id: doc.id, ...sale });
  });

  // Find existing finance entry IDs for expenses and sales
  const expenseFinanceIds = new Set();
  const saleFinanceIds = new Set();
  
  financeEntries.forEach(entry => {
    if (entry.sourceType === 'expense' && entry.sourceId) {
      expenseFinanceIds.add(entry.sourceId);
    }
    if (entry.sourceType === 'sale' && entry.sourceId) {
      saleFinanceIds.add(entry.sourceId);
    }
  });

  // Find missing finance entries
  const missingExpenses = expenses.filter(exp => {
    // Only include active expenses that don't have finance entries
    return exp.isAvailable !== false && !expenseFinanceIds.has(exp.id);
  });

  const missingSales = sales.filter(sale => {
    // Only include active sales that don't have finance entries
    return sale.isAvailable !== false && !saleFinanceIds.has(sale.id);
  });

  const report = {
    companyId: COMPANY_ID,
    timestamp: new Date().toISOString(),
    dryRun: DRY_RUN,
    missingExpenses: missingExpenses.length,
    missingSales: missingSales.length,
    createdFinanceEntries: [],
    errors: []
  };

  let batch = db.batch();
  let batchCount = 0;

  // Create finance entries for missing expenses
  console.log(`\n📋 Creating finance entries for ${missingExpenses.length} missing expenses...`);
  for (const expense of missingExpenses) {
    try {
      if (!expense.id || !expense.userId || !expense.companyId) {
        report.errors.push({ type: 'expense', id: expense.id, error: 'Missing required fields' });
        continue;
      }

      const entry = {
        userId: expense.userId,
        companyId: expense.companyId,
        sourceType: 'expense',
        sourceId: expense.id,
        type: 'expense',
        amount: -Math.abs(expense.amount),
        description: expense.description || 'Expense',
        date: expense.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        isDeleted: expense.isAvailable === false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (!DRY_RUN) {
        const ref = db.collection('finances').doc();
        batch.set(ref, entry);
        batchCount++;
        
        if (batchCount >= 500) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }

      report.createdFinanceEntries.push({
        type: 'expense',
        expenseId: expense.id,
        amount: entry.amount,
        description: entry.description,
        action: DRY_RUN ? 'would-create' : 'created'
      });
    } catch (error) {
      report.errors.push({ type: 'expense', id: expense.id, error: error.message });
      console.error(`Error creating finance entry for expense ${expense.id}:`, error);
    }
  }

  // Create finance entries for missing sales
  console.log(`📋 Creating finance entries for ${missingSales.length} missing sales...`);
  for (const sale of missingSales) {
    try {
      if (!sale.id || !sale.userId || !sale.companyId) {
        report.errors.push({ type: 'sale', id: sale.id, error: 'Missing required fields' });
        continue;
      }

      const entry = {
        userId: sale.userId,
        companyId: sale.companyId,
        sourceType: 'sale',
        sourceId: sale.id,
        type: 'sale',
        amount: sale.totalAmount || 0,
        description: `Sale to ${sale.customerInfo?.name || 'Customer'}`,
        date: sale.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        isDeleted: sale.isAvailable === false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (!DRY_RUN) {
        const ref = db.collection('finances').doc();
        batch.set(ref, entry);
        batchCount++;
        
        if (batchCount >= 500) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }

      report.createdFinanceEntries.push({
        type: 'sale',
        saleId: sale.id,
        amount: entry.amount,
        description: entry.description,
        action: DRY_RUN ? 'would-create' : 'created'
      });
    } catch (error) {
      report.errors.push({ type: 'sale', id: sale.id, error: error.message });
      console.error(`Error creating finance entry for sale ${sale.id}:`, error);
    }
  }

  // Commit remaining batch
  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
  }

  // Calculate impact
  const expenseImpact = missingExpenses.reduce((sum, exp) => sum + (-Math.abs(exp.amount)), 0);
  const saleImpact = missingSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
  const totalImpact = expenseImpact + saleImpact;

  report.impact = {
    expenses: expenseImpact,
    sales: saleImpact,
    total: totalImpact
  };

  // Output summary
  console.log('\n📊 SUMMARY\n');
  console.log('='.repeat(60));
  console.log(`Missing Expenses: ${missingExpenses.length}`);
  console.log(`Missing Sales: ${missingSales.length}`);
  console.log(`Finance Entries to Create: ${report.createdFinanceEntries.length}`);
  console.log(`Errors: ${report.errors.length}`);
  console.log('='.repeat(60));
  console.log(`\n💰 Impact:`);
  console.log(`  Expenses: ${expenseImpact.toLocaleString()} XAF`);
  console.log(`  Sales: ${saleImpact.toLocaleString()} XAF`);
  console.log(`  Total: ${totalImpact.toLocaleString()} XAF`);
  
  if (DRY_RUN) {
    console.log('\n⚠️  This was a DRY RUN - No changes were made');
    console.log('Run without --dry-run to create finance entries');
  } else {
    console.log('\n✅ Finance entries created successfully!');
  }

  // Save report
  const filename = `fix-finance-entries-${COMPANY_ID}-${Date.now()}.json`;
  writeFileSync(join(__dirname, '..', filename), JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved to: ${filename}`);

  process.exit(0);
} catch (e) {
  console.error('❌ Error:', e);
  process.exit(1);
}

