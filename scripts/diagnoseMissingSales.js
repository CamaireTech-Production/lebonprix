/**
 * Diagnose Missing Sales Script
 * 
 * This script investigates why specific sales from the old system are not appearing in the new system.
 * It performs comprehensive checks on:
 * 1. Sales existence in database
 * 2. Company ID associations
 * 3. User ID associations
 * 4. Soft-delete flags (isAvailable)
 * 5. Timestamp formatting
 * 6. Data structure integrity
 */

import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Target company and user
const COMPANY_ID = process.argv[2] || 'lu2rRu4YIxczwnjQpQ8pRpFUVlQ2';
const USER_ID = process.argv[3] || 'lu2rRu4YIxczwnjQpQ8pRpFUVlQ2';

// Missing sales data from old system
const MISSING_SALES = [
  {
    phone: '694079598',
    amount: 5000,
    date: '2025-11-02 08:02',
    profit: 3681
  },
  {
    phone: '693821879',
    amount: 8000,
    date: '2025-11-01 14:17',
    profit: 6000
  },
  {
    phone: '693821879',
    amount: 4000,
    date: '2025-11-01 14:07',
    profit: 3000
  }
];

console.log('🔍 MISSING SALES DIAGNOSTIC TOOL\n');
console.log('=' .repeat(70));
console.log(`Target Company: ${COMPANY_ID}`);
console.log(`Target User:    ${USER_ID}`);
console.log(`Missing Sales:  ${MISSING_SALES.length}`);
console.log('=' .repeat(70) + '\n');

try {
  const serviceAccount = JSON.parse(readFileSync(join(__dirname, '../firebase-service-account.json'), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  console.log('📊 Step 1: Loading all sales data...\n');

  // Load ALL sales (no filters) to check data integrity
  const allSalesSnapshot = await db.collection('sales').get();
  console.log(`   Total sales in database: ${allSalesSnapshot.size}`);

  // Load sales for this specific company
  const companySalesSnapshot = await db.collection('sales')
    .where('companyId', '==', COMPANY_ID)
    .get();
  console.log(`   Sales for company ${COMPANY_ID}: ${companySalesSnapshot.size}`);

  // Load sales for this specific user
  const userSalesSnapshot = await db.collection('sales')
    .where('userId', '==', USER_ID)
    .get();
  console.log(`   Sales for user ${USER_ID}: ${userSalesSnapshot.size}\n`);

  // Process all sales
  const allSales = [];
  allSalesSnapshot.forEach(doc => {
    const sale = doc.data();
    allSales.push({
      id: doc.id,
      ...sale,
      _docId: doc.id // Store document ID separately for verification
    });
  });

  const companySales = [];
  companySalesSnapshot.forEach(doc => {
    const sale = doc.data();
    companySales.push({
      id: doc.id,
      ...sale
    });
  });

  console.log('🔎 Step 2: Searching for missing sales by phone numbers...\n');

  const report = {
    companyId: COMPANY_ID,
    userId: USER_ID,
    timestamp: new Date().toISOString(),
    databaseStats: {
      totalSales: allSalesSnapshot.size,
      companySales: companySalesSnapshot.size,
      userSales: userSalesSnapshot.size
    },
    missingSalesAnalysis: [],
    potentialMatches: [],
    dataIntegrityIssues: []
  };

  // For each missing sale, search the database
  for (const missingSale of MISSING_SALES) {
    console.log(`📌 Searching for sale: ${missingSale.phone} - ${missingSale.amount} XAF (${missingSale.date})`);
    
    const analysis = {
      expectedSale: missingSale,
      foundInDatabase: false,
      exactMatch: null,
      partialMatches: [],
      issues: []
    };

    // Search by phone number
    const phoneMatches = allSales.filter(sale => {
      const customerPhone = sale.customerInfo?.phone || sale.phone || '';
      return customerPhone.includes(missingSale.phone) || missingSale.phone.includes(customerPhone);
    });

    console.log(`   Found ${phoneMatches.length} sales with matching phone number`);

    if (phoneMatches.length > 0) {
      // Check for exact amount match
      const exactMatches = phoneMatches.filter(sale => {
        const saleAmount = sale.totalAmount || sale.total || 0;
        return Math.abs(saleAmount - missingSale.amount) < 1; // Allow for rounding
      });

      if (exactMatches.length > 0) {
        analysis.foundInDatabase = true;
        
        for (const match of exactMatches) {
          console.log(`   ✅ EXACT MATCH FOUND!`);
          console.log(`      Document ID: ${match._docId}`);
          console.log(`      Amount: ${match.totalAmount || match.total} XAF`);
          console.log(`      Company ID: ${match.companyId || 'MISSING'}`);
          console.log(`      User ID: ${match.userId || 'MISSING'}`);
          console.log(`      isAvailable: ${match.isAvailable !== undefined ? match.isAvailable : 'undefined'}`);
          console.log(`      Customer: ${match.customerInfo?.name || match.customerName || 'Unknown'}`);
          console.log(`      Phone: ${match.customerInfo?.phone || match.phone || 'N/A'}`);
          
          // Check for issues
          const issues = [];
          
          // Check company ID
          if (!match.companyId) {
            issues.push('MISSING_COMPANY_ID');
            console.log(`      ⚠️  Issue: No companyId field`);
          } else if (match.companyId !== COMPANY_ID) {
            issues.push('WRONG_COMPANY_ID');
            console.log(`      ⚠️  Issue: Wrong companyId (${match.companyId})`);
          }
          
          // Check user ID
          if (!match.userId) {
            issues.push('MISSING_USER_ID');
            console.log(`      ⚠️  Issue: No userId field`);
          } else if (match.userId !== USER_ID) {
            issues.push('WRONG_USER_ID');
            console.log(`      ⚠️  Issue: Wrong userId (${match.userId})`);
          }
          
          // Check soft delete flag
          if (match.isAvailable === false) {
            issues.push('SOFT_DELETED');
            console.log(`      ⚠️  Issue: Sale is marked as deleted (isAvailable: false)`);
          }
          
          // Check if isAvailable is undefined (could be the issue)
          if (match.isAvailable === undefined) {
            issues.push('MISSING_ISAVAILABLE_FLAG');
            console.log(`      ⚠️  Issue: isAvailable field is undefined (may cause filtering issues)`);
          }
          
          // Check document ID vs id field
          if (match.id && match.id !== match._docId) {
            issues.push('ID_MISMATCH');
            console.log(`      ⚠️  Issue: Document ID (${match._docId}) doesn't match id field (${match.id})`);
          }
          
          // Check timestamps
          if (!match.createdAt) {
            issues.push('MISSING_TIMESTAMP');
            console.log(`      ⚠️  Issue: No createdAt timestamp`);
          } else {
            const timestamp = match.createdAt.toDate ? match.createdAt.toDate() : new Date(match.createdAt);
            console.log(`      Created: ${timestamp.toISOString()}`);
          }
          
          if (issues.length === 0) {
            console.log(`      ✅ No data integrity issues found`);
          }
          
          analysis.exactMatch = {
            ...match,
            issues
          };
          
          console.log('');
        }
      } else {
        // No exact amount match, show partial matches
        console.log(`   ⚠️  Phone number matches but amount doesn't`);
        for (const match of phoneMatches) {
          const saleAmount = match.totalAmount || match.total || 0;
          console.log(`      - ${saleAmount} XAF (Expected: ${missingSale.amount} XAF) - Doc: ${match._docId}`);
          analysis.partialMatches.push({
            docId: match._docId,
            amount: saleAmount,
            expectedAmount: missingSale.amount,
            companyId: match.companyId,
            userId: match.userId,
            isAvailable: match.isAvailable
          });
        }
        console.log('');
      }
    } else {
      console.log(`   ❌ NO MATCH FOUND - Sale does not exist in database\n`);
      analysis.issues.push('NOT_IN_DATABASE');
    }

    report.missingSalesAnalysis.push(analysis);
  }

  // Additional checks
  console.log('\n🔍 Step 3: Checking data integrity issues...\n');

  // Check for sales with missing companyId
  const salesMissingCompanyId = companySales.filter(sale => !sale.companyId);
  if (salesMissingCompanyId.length > 0) {
    console.log(`⚠️  Found ${salesMissingCompanyId.length} sales with missing companyId`);
    report.dataIntegrityIssues.push({
      issue: 'MISSING_COMPANY_ID',
      count: salesMissingCompanyId.length,
      samples: salesMissingCompanyId.slice(0, 3).map(s => s.id)
    });
  }

  // Check for sales with missing userId
  const salesMissingUserId = companySales.filter(sale => !sale.userId);
  if (salesMissingUserId.length > 0) {
    console.log(`⚠️  Found ${salesMissingUserId.length} sales with missing userId`);
    report.dataIntegrityIssues.push({
      issue: 'MISSING_USER_ID',
      count: salesMissingUserId.length,
      samples: salesMissingUserId.slice(0, 3).map(s => s.id)
    });
  }

  // Check for sales with isAvailable undefined
  const salesMissingAvailableFlag = companySales.filter(sale => sale.isAvailable === undefined);
  if (salesMissingAvailableFlag.length > 0) {
    console.log(`⚠️  Found ${salesMissingAvailableFlag.length} sales with undefined isAvailable flag`);
    report.dataIntegrityIssues.push({
      issue: 'MISSING_ISAVAILABLE_FLAG',
      count: salesMissingAvailableFlag.length,
      samples: salesMissingAvailableFlag.slice(0, 3).map(s => s.id)
    });
  }

  // Check for soft-deleted sales
  const softDeletedSales = companySales.filter(sale => sale.isAvailable === false);
  if (softDeletedSales.length > 0) {
    console.log(`📋 Found ${softDeletedSales.length} soft-deleted sales (isAvailable: false)`);
    report.dataIntegrityIssues.push({
      issue: 'SOFT_DELETED_SALES',
      count: softDeletedSales.length,
      samples: softDeletedSales.slice(0, 3).map(s => s.id)
    });
  }

  // Check for ID mismatches
  const salesWithIdMismatch = companySales.filter(sale => sale.id && sale.id !== sale._docId);
  if (salesWithIdMismatch.length > 0) {
    console.log(`⚠️  Found ${salesWithIdMismatch.length} sales with ID field mismatch`);
    report.dataIntegrityIssues.push({
      issue: 'ID_MISMATCH',
      count: salesWithIdMismatch.length,
      samples: salesWithIdMismatch.slice(0, 3).map(s => ({ docId: s._docId, idField: s.id }))
    });
  }

  // Summary
  console.log('\n📊 DIAGNOSTIC SUMMARY\n');
  console.log('=' .repeat(70));
  
  const foundCount = report.missingSalesAnalysis.filter(a => a.foundInDatabase).length;
  const notFoundCount = MISSING_SALES.length - foundCount;
  
  console.log(`Missing Sales Status:`);
  console.log(`  ✅ Found in database:     ${foundCount}/${MISSING_SALES.length}`);
  console.log(`  ❌ Not found in database: ${notFoundCount}/${MISSING_SALES.length}`);
  
  if (foundCount > 0) {
    console.log(`\nIssues with found sales:`);
    report.missingSalesAnalysis.forEach((analysis, index) => {
      if (analysis.exactMatch) {
        const issues = analysis.exactMatch.issues;
        if (issues.length > 0) {
          console.log(`  Sale ${index + 1}: ${issues.join(', ')}`);
        }
      }
    });
  }
  
  if (report.dataIntegrityIssues.length > 0) {
    console.log(`\nData Integrity Issues:`);
    report.dataIntegrityIssues.forEach(issue => {
      console.log(`  - ${issue.issue}: ${issue.count} sales affected`);
    });
  }
  
  console.log('=' .repeat(70));

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS\n');
  
  const allIssues = new Set();
  report.missingSalesAnalysis.forEach(analysis => {
    if (analysis.exactMatch) {
      analysis.exactMatch.issues.forEach(issue => allIssues.add(issue));
    }
  });

  if (allIssues.has('MISSING_COMPANY_ID')) {
    console.log('1. Run a migration script to add companyId to sales missing it');
  }
  if (allIssues.has('WRONG_COMPANY_ID')) {
    console.log('2. Fix sales with incorrect companyId values');
  }
  if (allIssues.has('MISSING_USER_ID')) {
    console.log('3. Run a migration script to add userId to sales missing it');
  }
  if (allIssues.has('WRONG_USER_ID')) {
    console.log('4. Fix sales with incorrect userId values');
  }
  if (allIssues.has('SOFT_DELETED')) {
    console.log('5. Check if sales are incorrectly marked as deleted (isAvailable: false)');
  }
  if (allIssues.has('MISSING_ISAVAILABLE_FLAG')) {
    console.log('6. Add isAvailable: true to sales missing this flag');
  }
  if (allIssues.has('ID_MISMATCH')) {
    console.log('7. Fix sales where document ID doesn\'t match id field');
  }
  if (allIssues.has('NOT_IN_DATABASE')) {
    console.log('8. Sales not found - may need to restore from backup or old system');
  }

  if (allIssues.size === 0 && foundCount === MISSING_SALES.length) {
    console.log('✅ All sales found with no issues!');
    console.log('   The problem may be in the frontend query/filtering logic.');
  }

  // Save detailed report
  const filename = `missing-sales-diagnosis-${COMPANY_ID}-${Date.now()}.json`;
  writeFileSync(join(__dirname, '..', filename), JSON.stringify(report, null, 2));
  console.log(`\n📄 Detailed report saved to: ${filename}\n`);

  process.exit(0);
} catch (e) {
  console.error('\n❌ ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
}

