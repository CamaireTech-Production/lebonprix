/**
 * Balance Calculation Diagnostic Script
 * 
 * This script thoroughly checks balance calculations by:
 * 1. Calculating balance from finance entries
 * 2. Checking for missing finance entries for sales and expenses
 * 3. Comparing actual vs expected balance
 * 4. Identifying discrepancies
 */

import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COMPANY_ID = process.argv[2] || 'lu2rRu4YIxczwnjQpQ8pRpFUVlQ2';
const EXPECTED_BALANCE = parseFloat(process.argv[3]) || 280900;

console.log('💰 BALANCE CALCULATION DIAGNOSTIC\n');
console.log('=' .repeat(70));
console.log(`Company ID: ${COMPANY_ID}`);
console.log(`Expected Balance (from old system): ${EXPECTED_BALANCE.toLocaleString()} XAF`);
console.log('=' .repeat(70) + '\n');

try {
  const serviceAccount = JSON.parse(readFileSync(join(__dirname, '../firebase-service-account.json'), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  console.log('📊 Step 1: Loading all data...\n');

  // Load finance entries
  const financesSnapshot = await db.collection('finances')
    .where('companyId', '==', COMPANY_ID)
    .get();
  
  // Load sales
  const salesSnapshot = await db.collection('sales')
    .where('companyId', '==', COMPANY_ID)
    .get();
  
  // Load expenses
  const expensesSnapshot = await db.collection('expenses')
    .where('companyId', '==', COMPANY_ID)
    .get();

  console.log(`   Finance entries: ${financesSnapshot.size}`);
  console.log(`   Sales: ${salesSnapshot.size}`);
  console.log(`   Expenses: ${expensesSnapshot.size}\n`);

  // Process data
  const financeEntries = [];
  financesSnapshot.forEach(doc => {
    const entry = doc.data();
    financeEntries.push({ docId: doc.id, ...entry });
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

  console.log('🔍 Step 2: Analyzing finance entries...\n');

  // Active finance entries (not deleted)
  const activeFinanceEntries = financeEntries.filter(entry => !entry.isDeleted);
  
  // Filter out debt-related entries for balance calculation
  const balanceFinanceEntries = activeFinanceEntries.filter(
    entry => entry.type !== 'debt' && 
             entry.type !== 'refund' && 
             entry.type !== 'supplier_debt' && 
             entry.type !== 'supplier_refund'
  );

  // Calculate balance
  const currentBalance = balanceFinanceEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);

  console.log(`   Active finance entries: ${activeFinanceEntries.length}`);
  console.log(`   Balance entries (excluding debts): ${balanceFinanceEntries.length}`);
  console.log(`   Current Balance: ${currentBalance.toLocaleString()} XAF\n`);

  // Breakdown by type
  const breakdown = {
    sale: balanceFinanceEntries.filter(e => e.type === 'sale' || e.sourceType === 'sale'),
    expense: balanceFinanceEntries.filter(e => e.type === 'expense' || e.sourceType === 'expense'),
    manual: balanceFinanceEntries.filter(e => e.sourceType === 'manual'),
    supplier: balanceFinanceEntries.filter(e => e.sourceType === 'supplier'),
    other: balanceFinanceEntries.filter(e => 
      e.sourceType !== 'sale' && 
      e.sourceType !== 'expense' && 
      e.sourceType !== 'manual' && 
      e.sourceType !== 'supplier' &&
      e.type !== 'sale' &&
      e.type !== 'expense'
    )
  };

  console.log('📋 Balance Breakdown by Type:');
  console.log(`   Sales: ${breakdown.sale.length} entries = ${breakdown.sale.reduce((sum, e) => sum + e.amount, 0).toLocaleString()} XAF`);
  console.log(`   Expenses: ${breakdown.expense.length} entries = ${breakdown.expense.reduce((sum, e) => sum + e.amount, 0).toLocaleString()} XAF`);
  console.log(`   Manual: ${breakdown.manual.length} entries = ${breakdown.manual.reduce((sum, e) => sum + e.amount, 0).toLocaleString()} XAF`);
  console.log(`   Supplier: ${breakdown.supplier.length} entries = ${breakdown.supplier.reduce((sum, e) => sum + e.amount, 0).toLocaleString()} XAF`);
  console.log(`   Other: ${breakdown.other.length} entries = ${breakdown.other.reduce((sum, e) => sum + e.amount, 0).toLocaleString()} XAF\n`);

  console.log('🔍 Step 3: Checking sales and finance entry sync...\n');

  // Active sales
  const activeSales = sales.filter(sale => sale.isAvailable !== false);
  
  // Finance entries for sales
  const saleFinanceEntries = financeEntries.filter(e => e.sourceType === 'sale');
  const saleFinanceIds = new Set(saleFinanceEntries.map(e => e.sourceId));

  // Missing finance entries for sales
  const salesWithoutFinance = activeSales.filter(sale => !saleFinanceIds.has(sale.docId));
  const missingSaleAmount = salesWithoutFinance.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);

  console.log(`   Active sales: ${activeSales.length}`);
  console.log(`   Sales with finance entries: ${activeSales.length - salesWithoutFinance.length}`);
  console.log(`   Sales missing finance entries: ${salesWithoutFinance.length}`);
  if (salesWithoutFinance.length > 0) {
    console.log(`   Missing sale amount: ${missingSaleAmount.toLocaleString()} XAF`);
    console.log(`\n   Missing sales:`);
    salesWithoutFinance.slice(0, 10).forEach(sale => {
      console.log(`      - ${sale.docId}: ${(sale.totalAmount || 0).toLocaleString()} XAF (${sale.customerInfo?.name || 'Unknown'})`);
    });
    if (salesWithoutFinance.length > 10) {
      console.log(`      ... and ${salesWithoutFinance.length - 10} more`);
    }
  }
  console.log('');

  console.log('🔍 Step 4: Checking expenses and finance entry sync...\n');

  // Active expenses
  const activeExpenses = expenses.filter(expense => expense.isAvailable !== false);
  
  // Finance entries for expenses
  const expenseFinanceEntries = financeEntries.filter(e => e.sourceType === 'expense');
  const expenseFinanceIds = new Set(expenseFinanceEntries.map(e => e.sourceId));

  // Missing finance entries for expenses
  const expensesWithoutFinance = activeExpenses.filter(expense => !expenseFinanceIds.has(expense.docId));
  const missingExpenseAmount = expensesWithoutFinance.reduce((sum, expense) => sum + (-Math.abs(expense.amount || 0)), 0);

  console.log(`   Active expenses: ${activeExpenses.length}`);
  console.log(`   Expenses with finance entries: ${activeExpenses.length - expensesWithoutFinance.length}`);
  console.log(`   Expenses missing finance entries: ${expensesWithoutFinance.length}`);
  if (expensesWithoutFinance.length > 0) {
    console.log(`   Missing expense amount: ${missingExpenseAmount.toLocaleString()} XAF`);
    console.log(`\n   Missing expenses:`);
    expensesWithoutFinance.slice(0, 10).forEach(expense => {
      console.log(`      - ${expense.docId}: ${(-Math.abs(expense.amount || 0)).toLocaleString()} XAF (${expense.description || 'No description'})`);
    });
    if (expensesWithoutFinance.length > 10) {
      console.log(`      ... and ${expensesWithoutFinance.length - 10} more`);
    }
  }
  console.log('');

  // Calculate expected balance
  const expectedBalanceFromData = currentBalance + missingSaleAmount + missingExpenseAmount;

  console.log('📊 Step 5: Balance Comparison\n');
  console.log('=' .repeat(70));
  console.log(`Current Balance (from finance entries):  ${currentBalance.toLocaleString()} XAF`);
  console.log(`Expected Balance (from old system):      ${EXPECTED_BALANCE.toLocaleString()} XAF`);
  console.log(`Expected Balance (if missing synced):    ${expectedBalanceFromData.toLocaleString()} XAF`);
  console.log('-'.repeat(70));
  console.log(`Difference (current vs old system):      ${(currentBalance - EXPECTED_BALANCE).toLocaleString()} XAF`);
  console.log(`Difference (adjusted vs old system):     ${(expectedBalanceFromData - EXPECTED_BALANCE).toLocaleString()} XAF`);
  console.log('=' .repeat(70) + '\n');

  // Additional checks
  console.log('🔍 Step 6: Additional Data Integrity Checks\n');

  // Check for orphaned finance entries (pointing to non-existent sales/expenses)
  const saleIds = new Set(sales.map(s => s.docId));
  const expenseIds = new Set(expenses.map(e => e.docId));

  const orphanedSaleFinances = saleFinanceEntries.filter(e => e.sourceId && !saleIds.has(e.sourceId));
  const orphanedExpenseFinances = expenseFinanceEntries.filter(e => e.sourceId && !expenseIds.has(e.sourceId));

  if (orphanedSaleFinances.length > 0) {
    const orphanedSaleAmount = orphanedSaleFinances.reduce((sum, e) => sum + e.amount, 0);
    console.log(`   ⚠️  Orphaned sale finance entries: ${orphanedSaleFinances.length} (${orphanedSaleAmount.toLocaleString()} XAF)`);
    console.log(`       These finance entries point to deleted/non-existent sales`);
  }

  if (orphanedExpenseFinances.length > 0) {
    const orphanedExpenseAmount = orphanedExpenseFinances.reduce((sum, e) => sum + e.amount, 0);
    console.log(`   ⚠️  Orphaned expense finance entries: ${orphanedExpenseFinances.length} (${orphanedExpenseAmount.toLocaleString()} XAF)`);
    console.log(`       These finance entries point to deleted/non-existent expenses`);
  }

  // Check for deleted entries still in balance
  const deletedFinances = financeEntries.filter(e => e.isDeleted);
  if (deletedFinances.length > 0) {
    const deletedAmount = deletedFinances.reduce((sum, e) => sum + e.amount, 0);
    console.log(`   📋 Deleted finance entries: ${deletedFinances.length} (${deletedAmount.toLocaleString()} XAF)`);
    console.log(`       These should NOT be in balance calculation (already excluded)`);
  }

  // Check sales totals
  const totalSalesAmount = activeSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
  const totalSaleFinanceAmount = breakdown.sale.reduce((sum, e) => sum + e.amount, 0);
  
  console.log(`\n   Total from active sales: ${totalSalesAmount.toLocaleString()} XAF`);
  console.log(`   Total from sale finance entries: ${totalSaleFinanceAmount.toLocaleString()} XAF`);
  console.log(`   Difference: ${(totalSalesAmount - totalSaleFinanceAmount).toLocaleString()} XAF`);

  // Check expenses totals
  const totalExpensesAmount = activeExpenses.reduce((sum, expense) => sum + (-Math.abs(expense.amount || 0)), 0);
  const totalExpenseFinanceAmount = breakdown.expense.reduce((sum, e) => sum + e.amount, 0);
  
  console.log(`\n   Total from active expenses: ${totalExpensesAmount.toLocaleString()} XAF`);
  console.log(`   Total from expense finance entries: ${totalExpenseFinanceAmount.toLocaleString()} XAF`);
  console.log(`   Difference: ${(totalExpensesAmount - totalExpenseFinanceAmount).toLocaleString()} XAF\n`);

  // Generate report
  const report = {
    companyId: COMPANY_ID,
    timestamp: new Date().toISOString(),
    expectedBalanceOldSystem: EXPECTED_BALANCE,
    currentBalance,
    expectedBalanceFromData,
    differences: {
      currentVsOldSystem: currentBalance - EXPECTED_BALANCE,
      adjustedVsOldSystem: expectedBalanceFromData - EXPECTED_BALANCE
    },
    breakdown: {
      sales: {
        count: breakdown.sale.length,
        amount: breakdown.sale.reduce((sum, e) => sum + e.amount, 0)
      },
      expenses: {
        count: breakdown.expense.length,
        amount: breakdown.expense.reduce((sum, e) => sum + e.amount, 0)
      },
      manual: {
        count: breakdown.manual.length,
        amount: breakdown.manual.reduce((sum, e) => sum + e.amount, 0)
      },
      supplier: {
        count: breakdown.supplier.length,
        amount: breakdown.supplier.reduce((sum, e) => sum + e.amount, 0)
      },
      other: {
        count: breakdown.other.length,
        amount: breakdown.other.reduce((sum, e) => sum + e.amount, 0)
      }
    },
    missingFinanceEntries: {
      sales: {
        count: salesWithoutFinance.length,
        amount: missingSaleAmount,
        list: salesWithoutFinance.map(s => ({
          docId: s.docId,
          amount: s.totalAmount,
          customer: s.customerInfo?.name,
          date: s.createdAt?.toDate?.()?.toISOString() || s.createdAt
        }))
      },
      expenses: {
        count: expensesWithoutFinance.length,
        amount: missingExpenseAmount,
        list: expensesWithoutFinance.map(e => ({
          docId: e.docId,
          amount: e.amount,
          description: e.description,
          date: e.createdAt?.toDate?.()?.toISOString() || e.createdAt
        }))
      }
    },
    orphanedFinanceEntries: {
      sales: orphanedSaleFinances.map(e => ({
        docId: e.docId,
        sourceId: e.sourceId,
        amount: e.amount
      })),
      expenses: orphanedExpenseFinances.map(e => ({
        docId: e.docId,
        sourceId: e.sourceId,
        amount: e.amount
      }))
    },
    totals: {
      salesFromSalesCollection: totalSalesAmount,
      salesFromFinanceEntries: totalSaleFinanceAmount,
      expensesFromExpensesCollection: totalExpensesAmount,
      expensesFromFinanceEntries: totalExpenseFinanceAmount
    }
  };

  console.log('💡 RECOMMENDATIONS\n');
  console.log('=' .repeat(70));

  if (salesWithoutFinance.length > 0) {
    console.log(`1. ⚠️  Create finance entries for ${salesWithoutFinance.length} sales`);
    console.log(`   Impact: +${missingSaleAmount.toLocaleString()} XAF`);
  }

  if (expensesWithoutFinance.length > 0) {
    console.log(`2. ⚠️  Create finance entries for ${expensesWithoutFinance.length} expenses`);
    console.log(`   Impact: ${missingExpenseAmount.toLocaleString()} XAF`);
  }

  if (orphanedSaleFinances.length > 0 || orphanedExpenseFinances.length > 0) {
    console.log(`3. ⚠️  Clean up orphaned finance entries`);
  }

  const totalImpact = missingSaleAmount + missingExpenseAmount;
  if (Math.abs(totalImpact) > 1) {
    console.log(`\n   Total potential balance adjustment: ${totalImpact.toLocaleString()} XAF`);
    console.log(`   Balance after sync: ${expectedBalanceFromData.toLocaleString()} XAF`);
  }

  if (Math.abs(expectedBalanceFromData - EXPECTED_BALANCE) < 1) {
    console.log(`\n✅ After syncing missing finance entries, balance should match old system!`);
  } else {
    console.log(`\n⚠️  After syncing, there's still a difference of ${(expectedBalanceFromData - EXPECTED_BALANCE).toLocaleString()} XAF`);
    console.log(`   This may indicate other data discrepancies or calculation differences`);
  }
  console.log('=' .repeat(70) + '\n');

  // Save report
  const filename = `balance-check-${COMPANY_ID}-${Date.now()}.json`;
  writeFileSync(join(__dirname, '..', filename), JSON.stringify(report, null, 2));
  console.log(`📄 Detailed report saved to: ${filename}\n`);

  process.exit(0);
} catch (e) {
  console.error('\n❌ ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
}



