/**
 * Audit Script: Duplicate Expense Types
 * 
 * This script audits and identifies duplicate expense types in the database,
 * particularly focusing on default expense types that may have been created multiple times.
 * 
 * Features:
 * - Identifies duplicate expense types by name and isDefault status
 * - Shows usage counts for each duplicate
 * - Provides cleanup functionality to remove duplicates (keeping the oldest)
 * - Detailed audit report
 * 
 * Usage: 
 *   node scripts/auditDuplicateExpenseTypes.js [--dry-run] [--cleanup]
 */

import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DRY_RUN = process.argv.includes('--dry-run');
const CLEANUP = process.argv.includes('--cleanup');

console.log(DRY_RUN ? '🔍 DRY RUN MODE - No changes will be made\n' : '🚀 Starting duplicate expense types audit...\n');

try {
  // Load service account
  const serviceAccount = JSON.parse(readFileSync(join(__dirname, '../firebase-service-account.json'), 'utf8'));
  console.log('✅ Service account loaded');

  // Initialize Firebase
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  console.log('✅ Firebase initialized');

  const db = admin.firestore();

  // Audit report structure
  const auditReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalExpenseTypes: 0,
      uniqueTypes: 0,
      duplicateGroups: 0,
      totalDuplicates: 0,
      duplicatesToClean: 0
    },
    duplicates: [],
    uniqueTypes: []
  };

  console.log('📋 Fetching all expense types from database...\n');

  // Get all expense types
  const expenseTypesSnapshot = await db.collection('expenseTypes').get();
  console.log(`✅ Found ${expenseTypesSnapshot.size} expense types in database\n`);

  auditReport.summary.totalExpenseTypes = expenseTypesSnapshot.size;

  // Group expense types by name and isDefault status
  const typeGroups = new Map();
  const expenseTypesData = [];

  expenseTypesSnapshot.forEach((doc) => {
    const data = doc.data();
    const expenseType = {
      id: doc.id,
      name: data.name || '',
      isDefault: data.isDefault === true,
      userId: data.userId || null,
      companyId: data.companyId || null,
      createdAt: data.createdAt || null
    };
    
    expenseTypesData.push(expenseType);

    // Create a unique key: name + isDefault status
    // For duplicates, we want to group by name and default status
    const groupKey = `${expenseType.name}|${expenseType.isDefault}`;
    
    if (!typeGroups.has(groupKey)) {
      typeGroups.set(groupKey, []);
    }
    typeGroups.get(groupKey).push(expenseType);
  });

  console.log(`📊 Analyzing ${typeGroups.size} unique type groups...\n`);

  // Identify duplicates and unique types
  typeGroups.forEach((types, groupKey) => {
    const [name, isDefaultStr] = groupKey.split('|');
    const isDefault = isDefaultStr === 'true';

    if (types.length === 1) {
      // Unique type
      auditReport.uniqueTypes.push({
        id: types[0].id,
        name: types[0].name,
        isDefault: types[0].isDefault,
        userId: types[0].userId,
        companyId: types[0].companyId,
        createdAt: types[0].createdAt?.toDate?.()?.toISOString() || types[0].createdAt
      });
    } else {
      // Duplicate group
      auditReport.summary.duplicateGroups++;
      auditReport.summary.totalDuplicates += types.length - 1; // All but one are duplicates

      // Sort by creation date (oldest first) to keep the oldest one
      const sorted = types.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
        return dateA - dateB;
      });

      const keepType = sorted[0]; // Oldest - keep this one
      const duplicates = sorted.slice(1); // All others are duplicates to remove

      auditReport.duplicates.push({
        name,
        isDefault,
        groupCount: types.length,
        keep: {
          id: keepType.id,
          createdAt: keepType.createdAt?.toDate?.()?.toISOString() || keepType.createdAt,
          userId: keepType.userId,
          companyId: keepType.companyId
        },
        remove: duplicates.map(dup => ({
          id: dup.id,
          name: dup.name,
          createdAt: dup.createdAt?.toDate?.()?.toISOString() || dup.createdAt,
          userId: dup.userId,
          companyId: dup.companyId,
          reason: 'Duplicate of older entry'
        }))
      });

      auditReport.summary.duplicatesToClean += duplicates.length;
    }
  });

  auditReport.summary.uniqueTypes = auditReport.uniqueTypes.length;

  // Display results
  console.log('='.repeat(60));
  console.log('📊 AUDIT RESULTS');
  console.log('='.repeat(60));
  console.log(`Total Expense Types: ${auditReport.summary.totalExpenseTypes}`);
  console.log(`Unique Types: ${auditReport.summary.uniqueTypes}`);
  console.log(`Duplicate Groups: ${auditReport.summary.duplicateGroups}`);
  console.log(`Total Duplicates: ${auditReport.summary.totalDuplicates}`);
  console.log(`Duplicates to Clean: ${auditReport.summary.duplicatesToClean}`);
  console.log('='.repeat(60));
  console.log('');

  // Display duplicate groups
  if (auditReport.duplicates.length > 0) {
    console.log('🔍 DUPLICATE GROUPS FOUND:\n');
    auditReport.duplicates.forEach((group, index) => {
      console.log(`Group ${index + 1}: "${group.name}" (${group.isDefault ? 'Default' : 'Custom'})`);
      console.log(`  Total entries: ${group.groupCount}`);
      console.log(`  ✅ Keep: ${group.keep.id} (created: ${group.keep.createdAt || 'N/A'})`);
      console.log(`  ❌ Remove: ${group.remove.length} duplicate(s)`);
      group.remove.forEach((dup, idx) => {
        console.log(`     ${idx + 1}. ${dup.id} (created: ${dup.createdAt || 'N/A'})`);
      });
      console.log('');
    });
  } else {
    console.log('✅ No duplicates found!\n');
  }

  // Check usage of duplicates before cleanup
  if (CLEANUP && auditReport.duplicates.length > 0) {
    console.log('🔍 Checking usage of duplicate expense types...\n');
    
    const duplicateIds = [];
    auditReport.duplicates.forEach(group => {
      group.remove.forEach(dup => duplicateIds.push(dup.id));
    });

    // Check if any expenses are using the duplicate types
    const expensesSnapshot = await db.collection('expenses').get();
    const usageMap = new Map();
    
    expensesSnapshot.forEach((doc) => {
      const expense = doc.data();
      const categoryName = expense.category;
      
      // Find which duplicate type ID this expense might be using
      auditReport.duplicates.forEach(group => {
        if (group.name === categoryName) {
          group.remove.forEach(dup => {
            if (!usageMap.has(dup.id)) {
              usageMap.set(dup.id, []);
            }
          });
        }
      });
    });

    // Count expenses by category name (not by type ID, since expenses use category name)
    const categoryUsageCounts = {};
    expensesSnapshot.forEach((doc) => {
      const expense = doc.data();
      const categoryName = expense.category || 'unknown';
      categoryUsageCounts[categoryName] = (categoryUsageCounts[categoryName] || 0) + 1;
    });

    console.log('📈 Category Usage Counts (by name, not type ID):');
    Object.entries(categoryUsageCounts).forEach(([name, count]) => {
      console.log(`  "${name}": ${count} expense(s)`);
    });
    console.log('');

    // Since expenses use category names (strings), not type IDs, 
    // we can safely delete duplicate type documents
    console.log('ℹ️  Note: Expenses use category names (strings), not type IDs.');
    console.log('   Deleting duplicate type documents will not affect existing expenses.\n');
  }

  // Cleanup duplicates if requested
  if (CLEANUP && !DRY_RUN && auditReport.duplicates.length > 0) {
    console.log('🧹 Starting cleanup of duplicate expense types...\n');

    let deletedCount = 0;
    const batch = db.batch();

    for (const group of auditReport.duplicates) {
      for (const dup of group.remove) {
        const docRef = db.collection('expenseTypes').doc(dup.id);
        batch.delete(docRef);
        deletedCount++;
      }
    }

    await batch.commit();
    console.log(`✅ Deleted ${deletedCount} duplicate expense type(s)\n`);
  } else if (CLEANUP && DRY_RUN) {
    console.log('🔍 DRY RUN: Would delete duplicate expense types:\n');
    let wouldDeleteCount = 0;
    auditReport.duplicates.forEach(group => {
      wouldDeleteCount += group.remove.length;
      console.log(`  "${group.name}": Would delete ${group.remove.length} duplicate(s)`);
    });
    console.log(`\n📊 Total: Would delete ${wouldDeleteCount} duplicate expense type(s)\n`);
  }

  // Save audit report
  const reportFilename = `duplicate-expense-types-audit-${Date.now()}.json`;
  const reportPath = join(__dirname, '..', reportFilename);
  writeFileSync(reportPath, JSON.stringify(auditReport, null, 2));
  console.log(`📄 Audit report saved to: ${reportFilename}`);

  console.log('\n✅ Audit completed successfully!');

} catch (error) {
  console.error('❌ Error during audit:', error);
  process.exit(1);
}

