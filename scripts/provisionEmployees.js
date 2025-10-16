import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

async function main() {
  const serviceAccountPath = join(__dirname, '../firebase-service-account.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  const companiesSnap = await db.collection('companies').get();
  let created = 0, skipped = 0;

  for (const doc of companiesSnap.docs) {
    const company = doc.data();
    const companyId = doc.id;
    const employees = Array.isArray(company.employees) ? company.employees : [];

    for (const emp of employees) {
      if (!emp?.email) { skipped++; continue; }
      try {
        // Check if user exists
        let userRecord = null;
        try {
          userRecord = await admin.auth().getUserByEmail(emp.email);
        } catch {}
        if (userRecord) { skipped++; continue; }

        if (DRY_RUN) {
          console.log(`[DRY] Would create Auth user for ${emp.email}`);
        } else {
          // Create with a temporary password if none is set
          const tempPassword = `${emp.firstname || 'User'}123${emp.lastname || 'Temp'}`;
          await admin.auth().createUser({ email: emp.email, password: tempPassword, emailVerified: true });
          console.log(`Created Auth user for ${emp.email}`);
        }
        created++;
      } catch (e) {
        console.error(`Failed to provision ${emp.email}:`, e.message || e);
      }
    }
  }

  console.log(`\nProvisioning complete${DRY_RUN ? ' (DRY RUN)' : ''}. Created: ${created}, Skipped: ${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
