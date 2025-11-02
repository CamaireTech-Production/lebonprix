/**
 * Audit Script: Analyze userId to companyId Migration State
 * 
 * This script analyzes all collections to determine:
 * - Current state of userId vs companyId fields
 * - Records that need migration
 * - Multi-company user scenarios
 * - Orphaned records
 * 
 * Usage: node scripts/auditUserIdToCompanyId.js
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Starting userId to companyId audit...\n');

try {
  // Load service account
  const serviceAccount = JSON.parse(readFileSync(join(__dirname, '../firebase-service-account.json'), 'utf8'));
  
  // Initialize Firebase
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  const db = admin.firestore();
  
  // Collections to audit
  const collections = [
    'products',
    'sales',
    'orders',
    'categories',
    'expenses',
    'customers',
    'objectives',
    'stockChanges',
    'stockBatches',
    'financeEntries',
    'suppliers',
    'financeEntryTypes',
    'expenseTypes'
  ];
  
  const auditReport = {
    startTime: new Date().toISOString(),
    collections: {},
    summary: {
      totalRecords: 0,
      recordsWithUserId: 0,
      recordsWithCompanyId: 0,
      recordsNeedingMigration: 0,
      orphanedRecords: 0,
      multiCompanyUsers: 0
    },
    multiCompanyUserDetails: [],
    orphanedRecords: []
  };
  
  // Get all users and their companies for reference
  console.log('📊 Loading users and companies data...');
  const usersSnapshot = await db.collection('users').get();
  const companiesSnapshot = await db.collection('companies').get();
  
  const usersMap = new Map();
  const companiesMap = new Map();
  const userIdToCompanyIds = new Map(); // Map userId -> array of companyIds
  
  usersSnapshot.forEach(doc => {
    const user = doc.data();
    usersMap.set(user.id, user);
    
    if (user.companies && Array.isArray(user.companies)) {
      const companyIds = user.companies.map(c => c.companyId);
      userIdToCompanyIds.set(user.id, companyIds);
      if (companyIds.length > 1) {
        auditReport.summary.multiCompanyUsers++;
        auditReport.multiCompanyUserDetails.push({
          userId: user.id,
          email: user.email,
          companies: companyIds,
          companiesCount: companyIds.length
        });
      }
    }
  });
  
  companiesSnapshot.forEach(doc => {
    const company = doc.data();
    companiesMap.set(doc.id, company);
    
    // Legacy companies: company ID = Firebase Auth UID
    const isLegacyCompany = doc.id.length === 28 && !doc.id.startsWith('company_');
    if (isLegacyCompany) {
      // For legacy companies, the companyId in the document should match the owner's userId
      const ownerId = company.companyId || company.userId || doc.id;
      if (!userIdToCompanyIds.has(ownerId)) {
        userIdToCompanyIds.set(ownerId, []);
      }
      userIdToCompanyIds.get(ownerId).push(doc.id);
    }
  });
  
  console.log(`✅ Loaded ${usersMap.size} users and ${companiesMap.size} companies\n`);
  
  // Audit each collection
  for (const collectionName of collections) {
    console.log(`📋 Auditing collection: ${collectionName}...`);
    
    const snapshot = await db.collection(collectionName).get();
    const collectionReport = {
      totalRecords: snapshot.size,
      withUserId: 0,
      withCompanyId: 0,
      withBoth: 0,
      missingCompanyId: 0,
      missingUserId: 0,
      recordsNeedingMigration: [],
      orphanedRecords: []
    };
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const hasUserId = data.userId !== undefined && data.userId !== null;
      const hasCompanyId = data.companyId !== undefined && data.companyId !== null;
      
      if (hasUserId) collectionReport.withUserId++;
      if (hasCompanyId) collectionReport.withCompanyId++;
      if (hasUserId && hasCompanyId) collectionReport.withBoth++;
      if (hasUserId && !hasCompanyId) collectionReport.missingCompanyId++;
      if (!hasUserId && hasCompanyId) collectionReport.missingUserId++;
      
      // Check if needs migration
      if (hasUserId && !hasCompanyId) {
        const userId = data.userId;
        const companyIds = userIdToCompanyIds.get(userId) || [];
        
        if (companyIds.length === 0) {
          // Orphaned: user doesn't exist or has no companies
          collectionReport.orphanedRecords.push({
            id: doc.id,
            userId: userId,
            reason: 'User not found or has no companies'
          });
          auditReport.summary.orphanedRecords++;
        } else {
          collectionReport.recordsNeedingMigration.push({
            id: doc.id,
            userId: userId,
            possibleCompanyIds: companyIds,
            needsSmartAssignment: companyIds.length > 1
          });
          auditReport.summary.recordsNeedingMigration++;
        }
      }
      
      // Validate companyId exists
      if (hasCompanyId) {
        const companyId = data.companyId;
        if (!companiesMap.has(companyId)) {
          collectionReport.orphanedRecords.push({
            id: doc.id,
            companyId: companyId,
            reason: 'Company ID does not exist'
          });
          auditReport.summary.orphanedRecords++;
        }
      }
    });
    
    auditReport.collections[collectionName] = collectionReport;
    auditReport.summary.totalRecords += snapshot.size;
    auditReport.summary.recordsWithUserId += collectionReport.withUserId;
    auditReport.summary.recordsWithCompanyId += collectionReport.withCompanyId;
    
    console.log(`  ✅ ${collectionName}: ${snapshot.size} records`);
    console.log(`     - With userId: ${collectionReport.withUserId}`);
    console.log(`     - With companyId: ${collectionReport.withCompanyId}`);
    console.log(`     - Missing companyId: ${collectionReport.missingCompanyId}`);
    console.log(`     - Orphaned: ${collectionReport.orphanedRecords.length}\n`);
  }
  
  // Generate summary report
  auditReport.endTime = new Date().toISOString();
  auditReport.duration = new Date(auditReport.endTime) - new Date(auditReport.startTime);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 AUDIT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Records: ${auditReport.summary.totalRecords}`);
  console.log(`Records with userId: ${auditReport.summary.recordsWithUserId}`);
  console.log(`Records with companyId: ${auditReport.summary.recordsWithCompanyId}`);
  console.log(`Records needing migration: ${auditReport.summary.recordsNeedingMigration}`);
  console.log(`Orphaned records: ${auditReport.summary.orphanedRecords}`);
  console.log(`Multi-company users: ${auditReport.summary.multiCompanyUsers}`);
  console.log(`\nDuration: ${(auditReport.duration / 1000).toFixed(2)}s`);
  
  if (auditReport.summary.multiCompanyUsers > 0) {
    console.log('\n⚠️  Multi-company users detected:');
    auditReport.multiCompanyUserDetails.forEach(user => {
      console.log(`  - ${user.email} (${user.userId}): ${user.companiesCount} companies`);
    });
  }
  
  // Save detailed report
  const timestamp = Date.now();
  const reportPath = join(__dirname, '..', `audit-report-${timestamp}.json`);
  writeFileSync(reportPath, JSON.stringify(auditReport, null, 2));
  console.log(`\n✅ Detailed audit report saved to: ${reportPath}`);
  
  // Recommendations
  console.log('\n' + '='.repeat(60));
  console.log('💡 RECOMMENDATIONS');
  console.log('='.repeat(60));
  
  if (auditReport.summary.recordsNeedingMigration > 0) {
    console.log(`✓ ${auditReport.summary.recordsNeedingMigration} records need migration`);
    if (auditReport.summary.multiCompanyUsers > 0) {
      console.log('⚠️  Smart assignment strategy needed for multi-company users');
    }
  } else {
    console.log('✅ No records need migration');
  }
  
  if (auditReport.summary.orphanedRecords > 0) {
    console.log(`⚠️  ${auditReport.summary.orphanedRecords} orphaned records found - review needed`);
  }
  
  if (auditReport.summary.totalRecords > 10000) {
    console.log('⚠️  Large dataset detected - consider batch processing');
  }
  
  console.log('\n✅ Audit complete!');
  
  process.exit(0);
  
} catch (error) {
  console.error('❌ Audit failed:', error);
  console.error(error.stack);
  process.exit(1);
}





