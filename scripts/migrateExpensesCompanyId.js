import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DRY_RUN = process.argv.includes('--dry-run');

console.log(DRY_RUN ? '🔍 DRY RUN MODE - No changes will be made\n' : '🚀 Starting expenses companyId migration...\n');

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

  // Also aggregate from users.companies[]
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

  console.log('📋 Auditing expenses...');
  const snapshot = await db.collection('expenses').get();

  const report = {
    startTime: new Date().toISOString(),
    dryRun: DRY_RUN,
    total: snapshot.size,
    migrated: 0,
    skipped: 0,
    orphaned: 0,
    errors: 0,
    details: []
  };

  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    const exp = doc.data();
    if (exp.companyId && companiesMap.has(exp.companyId)) {
      report.skipped++;
      continue;
    }

    const userId = exp.userId;
    let companyId = null;
    let method = '';

    const userCompanies = userId ? (userIdToCompanyIds.get(userId) || []) : [];

    if (userCompanies.length === 0) {
      if (userId && companiesMap.has(userId)) {
        companyId = userId;
        method = 'legacy-direct-company';
      } else if (userId && userId.length === 28 && !usersMap.has(userId)) {
        companyId = userId;
        method = 'legacy-grandfathered';
      } else {
        report.orphaned++;
        report.details.push({ id: doc.id, userId, reason: 'No company found' });
        continue;
      }
    } else if (userCompanies.length === 1) {
      companyId = userCompanies[0];
      method = 'single-company';
    } else {
      companyId = userCompanies[0];
      method = 'primary-company';
    }

    if (!DRY_RUN) {
      batch.update(db.collection('expenses').doc(doc.id), {
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
    report.details.push({ id: doc.id, userId, companyId, method, action: DRY_RUN ? 'would-update' : 'updated' });
  }

  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
  }

  report.endTime = new Date().toISOString();
  const file = `expenses-company-migration-report-${Date.now()}.json`;
  writeFileSync(join(__dirname, '..', file), JSON.stringify(report, null, 2));

  console.log(`\n✅ expenses: ${report.migrated} migrated, ${report.skipped} skipped, ${report.orphaned} orphaned, ${report.errors} errors`);
  console.log(`📄 Report: ${file}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  process.exit(0);
} catch (e) {
  console.error('❌ Error:', e);
  process.exit(1);
}
