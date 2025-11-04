// scripts/migrateCompanyEmployees.js
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

console.log(`\n🚀 Migrate companies: ensure employees[] exists${DRY_RUN ? ' (DRY RUN)' : ''}`);

try {
  const serviceAccountPath = join(__dirname, '../firebase-service-account.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  const db = admin.firestore();

  const companiesRef = db.collection('companies');
  const snapshot = await companiesRef.get();
  console.log(`📦 Companies found: ${snapshot.size}`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const hasEmployees = Array.isArray(data.employees);

    if (hasEmployees) {
      skippedCount++;
      console.log(`➡️  ${doc.id}: employees already present (size=${data.employees.length})`);
      continue;
    }

    console.log(`✏️  ${doc.id}: adding employees: []`);
    if (!DRY_RUN) {
      await doc.ref.update({ employees: [] });
    }
    updatedCount++;
  }

  console.log(`\n✅ Migration complete${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Skipped: ${skippedCount}`);
} catch (error) {
  console.error('❌ Migration failed:', error.message || error);
  process.exit(1);
}




