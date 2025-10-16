import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function caesarCipher(input, shift) {
  const a = 'a'.charCodeAt(0), z = 'z'.charCodeAt(0);
  const A = 'A'.charCodeAt(0), Z = 'Z'.charCodeAt(0);
  const mod = (n, m) => ((n % m) + m) % m;
  return input.split('').map(ch => {
    const code = ch.charCodeAt(0);
    if (code >= a && code <= z) return String.fromCharCode(a + mod(code - a + shift, 26));
    if (code >= A && code <= Z) return String.fromCharCode(A + mod(code - A + shift, 26));
    return ch;
  }).join('');
}

async function main() {
  const serviceAccountPath = join(__dirname, '../firebase-service-account.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  const companiesSnap = await db.collection('companies').get();
  let updated = 0;

  for (const doc of companiesSnap.docs) {
    const company = doc.data();
    const employees = Array.isArray(company.employees) ? company.employees : [];
    let changed = false;

    const updatedEmployees = employees.map((emp) => {
      if (!emp?.firstname || !emp?.lastname) return emp;
      if (emp.loginLink) return emp;
      const base = `${emp.firstname}${emp.lastname}`;
      const link = caesarCipher(base, 3);
      changed = true;
      return { ...emp, loginLink: link };
    });

    if (changed) {
      await doc.ref.update({ employees: updatedEmployees });
      updated++;
    }
  }

  console.log(`Updated companies with missing loginLink: ${updated}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


