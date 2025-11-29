import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DRY_RUN = process.argv.includes('--dry-run');

console.log(DRY_RUN ? '🔍 DRY RUN MODE - No changes will be made\n' : '🚀 Starting finances companyId migration...\n');

try {
  const serviceAccount = JSON.parse(readFileSync(join(__dirname, '../firebase-service-account.json'), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  console.log('📊 Loading users and companies...');
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

    const ownerId = company.userId || company.companyId || companyId;
    const isLegacyByDocId = companyId.length === 28;
    
    if (isLegacyByDocId) {
      if (!userIdToCompanyIds.has(companyId)) userIdToCompanyIds.set(companyId, []);
      const arr = userIdToCompanyIds.get(companyId);
      if (!arr.includes(companyId)) arr.push(companyId);
    }
    
    if (ownerId) {
      if (!userIdToCompanyIds.has(ownerId)) userIdToCompanyIds.set(ownerId, []);
      const arr = userIdToCompanyIds.get(ownerId);
      if (!arr.includes(companyId)) arr.push(companyId);
    }
  });

  usersSnapshot.forEach(doc => {
    const user = doc.data();
    const userId = user.id || doc.id;
    if (Array.isArray(user.companies)) {
      user.companies.forEach(ref => {
        const cid = ref.companyId || ref.id;
        if (!cid) return;
        if (!userIdToCompanyIds.has(userId)) userIdToCompanyIds.set(userId, []);
        const arr = userIdToCompanyIds.get(userId);
        if (!arr.includes(cid)) arr.push(cid);
      });
    }
  });

  console.log(`✅ Loaded ${usersMap.size} users and ${companiesMap.size} companies\n`);

  // Load sales and expenses for context-based inference
  console.log('📊 Loading sales and expenses for context...');
  const salesSnapshot = await db.collection('sales').get();
  const expensesSnapshot = await db.collection('expenses').get();
  
  const saleCompanyMap = new Map(); // saleId -> companyId
  const expenseCompanyMap = new Map(); // expenseId -> companyId
  
  salesSnapshot.forEach(doc => {
    const sale = doc.data();
    if (sale.companyId) {
      saleCompanyMap.set(doc.id, sale.companyId);
    }
  });
  
  expensesSnapshot.forEach(doc => {
    const expense = doc.data();
    if (expense.companyId) {
      expenseCompanyMap.set(doc.id, expense.companyId);
    }
  });
  
  console.log(`✅ Loaded ${saleCompanyMap.size} sales and ${expenseCompanyMap.size} expenses with companyId\n`);

  console.log('📋 Auditing finances...');
  const snapshot = await db.collection('finances').get();

  const report = {
    startTime: new Date().toISOString(),
    dryRun: DRY_RUN,
    total: snapshot.size,
    migrated: 0,
    skipped: 0,
    orphaned: 0,
    errors: 0,
    details: [],
    methods: {}
  };

  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    try {
      const entry = doc.data();
      
      // Skip if already has valid companyId
      if (entry.companyId && companiesMap.has(entry.companyId)) {
        report.skipped++;
        continue;
      }

      const userId = entry.userId;
      let companyId = null;
      let method = '';

      // Strategy 1: Infer from source (sale or expense)
      if (entry.sourceType === 'sale' && entry.sourceId) {
        if (saleCompanyMap.has(entry.sourceId)) {
          companyId = saleCompanyMap.get(entry.sourceId);
          method = 'context-sale';
        }
      } else if (entry.sourceType === 'expense' && entry.sourceId) {
        if (expenseCompanyMap.has(entry.sourceId)) {
          companyId = expenseCompanyMap.get(entry.sourceId);
          method = 'context-expense';
        }
      }

      // Strategy 2: Use userId to find company
      if (!companyId && userId) {
        const userCompanies = userIdToCompanyIds.get(userId) || [];
        
        if (userCompanies.length === 0) {
          // Legacy case: userId might be companyId directly
          if (companiesMap.has(userId)) {
            companyId = userId;
            method = method || 'legacy-direct-company';
          } else if (userId.length === 28 && !usersMap.has(userId)) {
            companyId = userId;
            method = method || 'legacy-grandfathered';
          } else {
            report.orphaned++;
            report.details.push({ id: doc.id, userId, sourceType: entry.sourceType, sourceId: entry.sourceId, reason: 'No company found' });
            continue;
          }
        } else if (userCompanies.length === 1) {
          companyId = userCompanies[0];
          method = method || 'single-company';
        } else {
          companyId = userCompanies[0];
          method = method || 'primary-company';
        }
      }

      if (!companyId) {
        report.orphaned++;
        report.details.push({ id: doc.id, userId, sourceType: entry.sourceType, sourceId: entry.sourceId, reason: 'Cannot determine companyId' });
        continue;
      }

      if (!DRY_RUN) {
        batch.update(db.collection('finances').doc(doc.id), {
          companyId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        batchCount++;
        if (batchCount >= 500) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }

      report.migrated++;
      report.methods[method] = (report.methods[method] || 0) + 1;
      report.details.push({ 
        id: doc.id, 
        userId, 
        companyId, 
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        method, 
        action: DRY_RUN ? 'would-update' : 'updated' 
      });
    } catch (error) {
      report.errors++;
      console.error(`Error processing finance entry ${doc.id}:`, error);
      report.details.push({ id: doc.id, error: error.message });
    }
  }

  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
  }

  report.endTime = new Date().toISOString();
  const file = `finances-company-migration-report-${Date.now()}.json`;
  writeFileSync(join(__dirname, '..', file), JSON.stringify(report, null, 2));

  console.log(`\n✅ finances: ${report.migrated} migrated, ${report.skipped} skipped, ${report.orphaned} orphaned, ${report.errors} errors`);
  console.log(`   Assignment methods:`, report.methods);
  console.log(`📄 Report: ${file}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  
  if (DRY_RUN) {
    console.log('\n⚠️  This was a DRY RUN - No changes were made');
    console.log('Run without --dry-run to execute migration');
  } else {
    console.log('\n✅ Migration complete!');
  }
  
  process.exit(0);
} catch (e) {
  console.error('❌ Error:', e);
  process.exit(1);
}







