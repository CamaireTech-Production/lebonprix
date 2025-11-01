/**
 * Migration Script: Update CinetPay Configs to use companyId
 * 
 * This script migrates cinetpay_configs collection from userId-based to companyId-based.
 * Since configs are company-specific, the document ID will be changed from userId to companyId.
 */

import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DRY_RUN = process.argv.includes('--dry-run');

console.log(DRY_RUN ? '🔍 DRY RUN MODE - No changes will be made\n' : '🚀 Starting CinetPay configs migration...\n');

try {
  // Load service account
  const serviceAccount = JSON.parse(readFileSync(join(__dirname, '../firebase-service-account.json'), 'utf8'));
  
  // Initialize Firebase
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  const db = admin.firestore();
  
  console.log('📊 Loading users and companies...');
  
  // Load users and companies
  const usersSnapshot = await db.collection('users').get();
  const companiesSnapshot = await db.collection('companies').get();
  
  const usersMap = new Map();
  usersSnapshot.forEach(doc => {
    const user = doc.data();
    usersMap.set(user.id || doc.id, user);
  });
  
  const companiesMap = new Map();
  const userIdToCompanyIds = new Map();
  
  companiesSnapshot.forEach(doc => {
    const company = doc.data();
    const companyId = doc.id;
    companiesMap.set(companyId, company);
    
    // Build user-to-company mapping
    const ownerId = company.userId || company.companyId || companyId;
    
    // Legacy companies where companyId = userId
    const isLegacyByDocId = companyId.length === 28;
    
    if (isLegacyByDocId) {
      if (!userIdToCompanyIds.has(companyId)) {
        userIdToCompanyIds.set(companyId, []);
      }
      const existing = userIdToCompanyIds.get(companyId);
      if (!existing.includes(companyId)) {
        existing.push(companyId);
      }
    }
    
    // Companies with userId/companyId fields
    if (ownerId && ownerId !== companyId) {
      if (!userIdToCompanyIds.has(ownerId)) {
        userIdToCompanyIds.set(ownerId, []);
      }
      const existing = userIdToCompanyIds.get(ownerId);
      if (!existing.includes(companyId)) {
        existing.push(companyId);
      }
    }
  });
  
  // Also build from users.companies array
  usersSnapshot.forEach(doc => {
    const user = doc.data();
    const userId = user.id || doc.id;
    
    if (user.companies && Array.isArray(user.companies)) {
      user.companies.forEach((companyRef) => {
        const companyId = companyRef.companyId || companyRef.id;
        if (companyId) {
          if (!userIdToCompanyIds.has(userId)) {
            userIdToCompanyIds.set(userId, []);
          }
          const existing = userIdToCompanyIds.get(userId);
          if (!existing.includes(companyId)) {
            existing.push(companyId);
          }
        }
      });
    }
  });
  
  console.log(`✅ Loaded ${usersMap.size} users and ${companiesMap.size} companies\n`);
  
  // Get all cinetpay_configs
  console.log('📋 Migrating collection: cinetpay_configs...');
  const configsSnapshot = await db.collection('cinetpay_configs').get();
  
  const migrationReport = {
    startTime: new Date().toISOString(),
    dryRun: DRY_RUN,
    totalRecords: configsSnapshot.size,
    migrated: 0,
    skipped: 0,
    orphaned: 0,
    errors: 0,
    errorDetails: [],
    details: []
  };
  
  let batch = db.batch();
  let batchCount = 0;
  
  // Process each config
  for (const doc of configsSnapshot.docs) {
    const config = doc.data();
    const oldDocId = doc.id; // This is the userId
    const userId = config.userId || oldDocId;
    
    // Determine companyId for this userId
    const userCompanyIds = userIdToCompanyIds.get(userId) || [];
    
    let companyId = null;
    let method = '';
    
    if (userCompanyIds.length === 0) {
      // Legacy case: userId might be companyId directly
      if (companiesMap.has(userId)) {
        companyId = userId;
        method = 'legacy-direct-company';
      } else {
        // Orphaned: no company found
        migrationReport.orphaned++;
        migrationReport.details.push({
          oldDocId,
          userId,
          reason: 'No company found for userId',
          action: 'skipped'
        });
        continue;
      }
    } else if (userCompanyIds.length === 1) {
      companyId = userCompanyIds[0];
      method = 'single-company';
    } else {
      // Multi-company: use primary company (first one)
      companyId = userCompanyIds[0];
      method = 'primary-company';
      console.log(`   ⚠️  Multi-company user ${userId}: using primary company ${companyId}`);
    }
    
    // Check if config already exists for this companyId
    const newDocRef = db.collection('cinetpay_configs').doc(companyId);
    
    if (oldDocId === companyId) {
      // Document ID already matches companyId, just add companyId field if missing
      if (!config.companyId) {
        if (!DRY_RUN) {
          batch.update(newDocRef, {
            companyId: companyId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          batchCount++;
        }
        migrationReport.migrated++;
        migrationReport.details.push({
          oldDocId,
          newDocId: companyId,
          userId,
          companyId,
          method: 'updated-companyId-field',
          action: DRY_RUN ? 'would-update' : 'updated'
        });
      } else {
        migrationReport.skipped++;
        migrationReport.details.push({
          oldDocId,
          newDocId: companyId,
          userId,
          companyId,
          method: 'already-migrated',
          action: 'skipped'
        });
      }
    } else {
      // Document ID needs to change from userId to companyId
      // Check if new document already exists
      const newDocSnap = await newDocRef.get();
      
      if (newDocSnap && newDocSnap.exists) {
        // Merge with existing config
        console.log(`   ℹ️  Config for companyId ${companyId} already exists, merging...`);
        if (!DRY_RUN) {
          batch.update(newDocRef, {
            ...config,
            companyId: companyId,
            userId: userId, // Keep userId for audit
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          // Delete old document
          batch.delete(db.collection('cinetpay_configs').doc(oldDocId));
          batchCount += 2;
        }
        migrationReport.migrated++;
        migrationReport.details.push({
          oldDocId,
          newDocId: companyId,
          userId,
          companyId,
          method: method + '-merged',
          action: DRY_RUN ? 'would-merge-and-delete' : 'merged-and-deleted'
        });
      } else {
        // Create new document with companyId as ID
        if (!DRY_RUN) {
          batch.set(newDocRef, {
            ...config,
            companyId: companyId,
            userId: userId, // Keep userId for audit
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          // Delete old document
          batch.delete(db.collection('cinetpay_configs').doc(oldDocId));
          batchCount += 2;
        }
        migrationReport.migrated++;
        migrationReport.details.push({
          oldDocId,
          newDocId: companyId,
          userId,
          companyId,
          method: method + '-moved',
          action: DRY_RUN ? 'would-move' : 'moved'
        });
      }
    }
    
    // Commit batch if it's getting large
    if (batchCount >= 500) {
      if (!DRY_RUN) {
        await batch.commit();
      }
      batch = db.batch(); // Create new batch
      batchCount = 0;
    }
  }
  
  // Commit remaining batch
  if (batchCount > 0 && !DRY_RUN) {
    await batch.commit();
  }
  
  migrationReport.endTime = new Date().toISOString();
  
  console.log(`\n✅ cinetpay_configs: ${migrationReport.migrated} migrated, ${migrationReport.skipped} skipped, ${migrationReport.orphaned} orphaned, ${migrationReport.errors} errors\n`);
  
  console.log('============================================================');
  console.log('📊 MIGRATION SUMMARY');
  console.log('============================================================');
  console.log(`Total Records: ${migrationReport.totalRecords}`);
  console.log(`Records Migrated: ${migrationReport.migrated}`);
  console.log(`Records Skipped: ${migrationReport.skipped}`);
  console.log(`Orphaned Records: ${migrationReport.orphaned}`);
  console.log(`Errors: ${migrationReport.errors}`);
  console.log(`Duration: ${new Date(migrationReport.endTime) - new Date(migrationReport.startTime)}ms`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  
  // Save report
  const reportFileName = `cinetpay-config-migration-report-${Date.now()}.json`;
  const reportPath = join(__dirname, '..', reportFileName);
  writeFileSync(reportPath, JSON.stringify(migrationReport, null, 2));
  console.log(`\n✅ Detailed migration report saved to: ${reportPath}\n`);
  
  if (DRY_RUN) {
    console.log('⚠️  This was a DRY RUN - No changes were made');
    console.log('Run without --dry-run to execute migration');
  } else {
    console.log('✅ Migration complete!');
  }
  
  process.exit(0);
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

