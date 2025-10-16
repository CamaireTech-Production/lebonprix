import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const serviceAccount = JSON.parse(readFileSync(join(__dirname, '../firebase-service-account.json'), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  const snap = await db.collection('companies').get();
  let updated = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const employees = Array.isArray(data.employees) ? data.employees : [];
    if (employees.length === 0) continue;
    const next = employees.map((e) => {
      if (!e || typeof e !== 'object') return e;
      const { hashedPassword, ...rest } = e;
      return rest;
    });
    await doc.ref.update({ employees: next });
    updated++;
  }
  console.log(`Stripped hashedPassword from ${updated} company documents`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


