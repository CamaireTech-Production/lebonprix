/**
 * Balance Diagnosis Script
 * 
 * This script calculates the correct balance for a company by:
 * 1. Summing all active finance entries (excluding debts/refunds)
 * 2. Identifying missing finance entries for expenses and sales
 * 3. Comparing actual balance vs expected balance
 * 4. Providing detailed breakdown of all transactions
 */

import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COMPANY_ID = process.argv[2] || 'lu2rRu4YIxczwnjQpQ8pRpFUVlQ2';

console.log(`🔍 Diagnosing balance for company: ${COMPANY_ID}\n`);

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

  // Calculate current balance from finance entries
  const activeFinanceEntries = financeEntries.filter(entry => !entry.isDeleted);
  const nonDebtEntries = activeFinanceEntries.filter(
    entry => entry.type !== 'debt' && 
             entry.type !== 'refund' && 
             entry.type !== 'supplier_debt' && 
             entry.type !== 'supplier_refund'
  );
  
  const currentBalance = nonDebtEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);

  // Find missing finance entries
  const expenseIds = new Set(expenses.map(e => e.id));
  const saleIds = new Set(sales.map(s => s.id));
  
  const financeExpenseIds = new Set(
    financeEntries
      .filter(e => e.sourceType === 'expense' && e.sourceId)
      .map(e => e.sourceId)
  );
  
  const financeSaleIds = new Set(
    financeEntries
      .filter(e => e.sourceType === 'sale' && e.sourceId)
      .map(e => e.sourceId)
  );

  const missingExpenseFinanceEntries = [];
  expenses.forEach(exp => {
    if (!exp.isAvailable) return; // Skip deleted expenses
    if (!financeExpenseIds.has(exp.id)) {
      missingExpenseFinanceEntries.push({
        expenseId: exp.id,
        amount: exp.amount,
        description: exp.description,
        createdAt: exp.createdAt?.toDate?.()?.toISOString() || exp.createdAt
      });
    }
  });

  const missingSaleFinanceEntries = [];
  sales.forEach(sale => {
    if (sale.isAvailable === false) return; // Skip deleted sales
    if (!financeSaleIds.has(sale.id)) {
      missingSaleFinanceEntries.push({
        saleId: sale.id,
        amount: sale.totalAmount,
        customerName: sale.customerInfo?.name,
        createdAt: sale.createdAt?.toDate?.()?.toISOString() || sale.createdAt
      });
    }
  });

  // Calculate expected balance
  const expectedBalanceAdjustments = {
    missingExpenses: missingExpenseFinanceEntries.reduce((sum, exp) => sum + (-Math.abs(exp.amount)), 0),
    missingSales: missingSaleFinanceEntries.reduce((sum, sale) => sum + sale.amount, 0)
  };
  
  const expectedBalance = currentBalance + expectedBalanceAdjustments.missingExpenses + expectedBalanceAdjustments.missingSales;

  // Breakdown by type
  const breakdown = {
    sales: nonDebtEntries.filter(e => e.type === 'sale' || e.sourceType === 'sale').reduce((sum, e) => sum + e.amount, 0),
    expenses: nonDebtEntries.filter(e => e.type === 'expense' || e.sourceType === 'expense').reduce((sum, e) => sum + e.amount, 0),
    manual: nonDebtEntries.filter(e => e.sourceType === 'manual').reduce((sum, e) => sum + e.amount, 0),
    supplier: nonDebtEntries.filter(e => e.sourceType === 'supplier').reduce((sum, e) => sum + e.amount, 0)
  };

  // Deleted entries (should not be in balance)
  const deletedEntries = financeEntries.filter(e => e.isDeleted);
  const deletedAmount = deletedEntries.reduce((sum, e) => sum + e.amount, 0);

  // Expenses analysis
  const expensesAnalysis = {
    total: expenses.length,
    active: expenses.filter(e => e.isAvailable !== false).length,
    deleted: expenses.filter(e => e.isAvailable === false).length,
    totalAmount: expenses.filter(e => e.isAvailable !== false).reduce((sum, e) => sum + e.amount, 0),
    withFinanceEntry: expenses.filter(e => e.isAvailable !== false && financeExpenseIds.has(e.id)).length,
    withoutFinanceEntry: missingExpenseFinanceEntries.length
  };

  // Sales analysis
  const salesAnalysis = {
    total: sales.length,
    active: sales.filter(s => s.isAvailable !== false).length,
    deleted: sales.filter(s => s.isAvailable === false).length,
    totalAmount: sales.filter(s => s.isAvailable !== false).reduce((sum, s) => sum + s.totalAmount, 0),
    withFinanceEntry: sales.filter(s => s.isAvailable !== false && financeSaleIds.has(s.id)).length,
    withoutFinanceEntry: missingSaleFinanceEntries.length
  };

  // Finance entries analysis
  const financeAnalysis = {
    total: financeEntries.length,
    active: activeFinanceEntries.length,
    deleted: deletedEntries.length,
    bySourceType: {
      sale: financeEntries.filter(e => e.sourceType === 'sale').length,
      expense: financeEntries.filter(e => e.sourceType === 'expense').length,
      manual: financeEntries.filter(e => e.sourceType === 'manual').length,
      supplier: financeEntries.filter(e => e.sourceType === 'supplier').length
    }
  };

  // Report
  const report = {
    companyId: COMPANY_ID,
    timestamp: new Date().toISOString(),
    currentBalance,
    expectedBalance,
    difference: expectedBalance - currentBalance,
    breakdown,
    missingFinanceEntries: {
      expenses: missingExpenseFinanceEntries,
      sales: missingSaleFinanceEntries,
      totalMissing: missingExpenseFinanceEntries.length + missingSaleFinanceEntries.length,
      impact: {
        expenses: expectedBalanceAdjustments.missingExpenses,
        sales: expectedBalanceAdjustments.missingSales
      }
    },
    deletedEntries: {
      count: deletedEntries.length,
      totalAmount: deletedAmount
    },
    expensesAnalysis,
    salesAnalysis,
    financeAnalysis,
    activeFinanceEntries: activeFinanceEntries.map(e => ({
      id: e.id,
      sourceType: e.sourceType,
      sourceId: e.sourceId,
      type: e.type,
      amount: e.amount,
      description: e.description,
      date: e.date?.toDate?.()?.toISOString() || e.date
    }))
  };

  // Output
  console.log('\n📊 BALANCE DIAGNOSIS REPORT\n');
  console.log('=' .repeat(60));
  console.log(`Current Balance:  ${currentBalance.toLocaleString()} XAF`);
  console.log(`Expected Balance: ${expectedBalance.toLocaleString()} XAF`);
  console.log(`Difference:       ${report.difference.toLocaleString()} XAF`);
  console.log('='.repeat(60));
  
  console.log('\n💰 Balance Breakdown:');
  console.log(`  Sales:     ${breakdown.sales.toLocaleString()} XAF`);
  console.log(`  Expenses:  ${breakdown.expenses.toLocaleString()} XAF`);
  console.log(`  Manual:    ${breakdown.manual.toLocaleString()} XAF`);
  console.log(`  Supplier:  ${breakdown.supplier.toLocaleString()} XAF`);

  console.log('\n📋 Missing Finance Entries:');
  console.log(`  Expenses without finance entry: ${missingExpenseFinanceEntries.length}`);
  if (missingExpenseFinanceEntries.length > 0) {
    console.log(`    Total impact: ${expectedBalanceAdjustments.missingExpenses.toLocaleString()} XAF`);
    missingExpenseFinanceEntries.slice(0, 5).forEach(exp => {
      console.log(`    - ${exp.description || 'No description'} (${exp.amount.toLocaleString()} XAF)`);
    });
    if (missingExpenseFinanceEntries.length > 5) {
      console.log(`    ... and ${missingExpenseFinanceEntries.length - 5} more`);
    }
  }
  
  console.log(`  Sales without finance entry: ${missingSaleFinanceEntries.length}`);
  if (missingSaleFinanceEntries.length > 0) {
    console.log(`    Total impact: ${expectedBalanceAdjustments.missingSales.toLocaleString()} XAF`);
    missingSaleFinanceEntries.slice(0, 5).forEach(sale => {
      console.log(`    - Sale to ${sale.customerName || 'Unknown'} (${sale.amount.toLocaleString()} XAF)`);
    });
    if (missingSaleFinanceEntries.length > 5) {
      console.log(`    ... and ${missingSaleFinanceEntries.length - 5} more`);
    }
  }

  console.log('\n📈 Expenses Analysis:');
  console.log(`  Total expenses: ${expensesAnalysis.total}`);
  console.log(`  Active: ${expensesAnalysis.active} | Deleted: ${expensesAnalysis.deleted}`);
  console.log(`  Total amount: ${expensesAnalysis.totalAmount.toLocaleString()} XAF`);
  console.log(`  With finance entry: ${expensesAnalysis.withFinanceEntry}`);
  console.log(`  Without finance entry: ${expensesAnalysis.withoutFinanceEntry}`);

  console.log('\n📈 Sales Analysis:');
  console.log(`  Total sales: ${salesAnalysis.total}`);
  console.log(`  Active: ${salesAnalysis.active} | Deleted: ${salesAnalysis.deleted}`);
  console.log(`  Total amount: ${salesAnalysis.totalAmount.toLocaleString()} XAF`);
  console.log(`  With finance entry: ${salesAnalysis.withFinanceEntry}`);
  console.log(`  Without finance entry: ${salesAnalysis.withoutFinanceEntry}`);

  console.log('\n📈 Finance Entries Analysis:');
  console.log(`  Total: ${financeAnalysis.total}`);
  console.log(`  Active: ${financeAnalysis.active} | Deleted: ${financeAnalysis.deleted}`);
  console.log(`  By source type:`);
  console.log(`    Sale: ${financeAnalysis.bySourceType.sale}`);
  console.log(`    Expense: ${financeAnalysis.bySourceType.expense}`);
  console.log(`    Manual: ${financeAnalysis.bySourceType.manual}`);
  console.log(`    Supplier: ${financeAnalysis.bySourceType.supplier}`);

  if (deletedEntries.length > 0) {
    console.log(`\n⚠️  Deleted Finance Entries: ${deletedEntries.length} (${deletedAmount.toLocaleString()} XAF)`);
    console.log('   These should NOT be included in balance calculation');
  }

  // Save detailed report
  const filename = `balance-diagnosis-${COMPANY_ID}-${Date.now()}.json`;
  writeFileSync(join(__dirname, '..', filename), JSON.stringify(report, null, 2));
  console.log(`\n📄 Detailed report saved to: ${filename}`);

  process.exit(0);
} catch (e) {
  console.error('❌ Error:', e);
  process.exit(1);
}







