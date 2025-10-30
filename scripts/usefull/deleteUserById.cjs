/**
 * Script utilitaire: Supprimer proprement un utilisateur par UID Firebase
 *
 * Ce script supprime:
 * - Le document users/{userId}
 * - Toutes les références dans companies/{companyId}/employeeRefs/{userId}
 * - Les entrées miroir dans companies/{companyId}.employees{userId}
 * - Décrémente companies/{companyId}.employeeCount si nécessaire
 * - (Compat) Supprime toute entrée legacy dans companies/{companyId}/employees/* liant firebaseUid === userId
 *
 * Usage:
 *   node scripts/usefull/deleteUserById.cjs <USER_ID>
 *
 * ATTENTION: Opération irréversible.
 */

const admin = require('firebase-admin');
const readline = require('readline');

// Initialisation Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require('../../firebase-service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

function askConfirmation(userId) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('\n⚠️  Cette opération est IRRÉVERSIBLE');
    rl.question(`Confirmez-vous la suppression définitive de l'utilisateur ${userId}? (tapez "OUI"): `, (answer) => {
      rl.close();
      resolve(answer.trim().toUpperCase() === 'OUI');
    });
  });
}

async function removeFromAllCompanies(userId) {
  const companiesSnap = await db.collection('companies').get();
  const touched = [];

  for (const companyDoc of companiesSnap.docs) {
    const companyId = companyDoc.id;

    // Supprimer employeeRef si présent
    const employeeRefDoc = await db.doc(`companies/${companyId}/employeeRefs/${userId}`).get();
    let changed = false;

    if (employeeRefDoc.exists) {
      await db.doc(`companies/${companyId}/employeeRefs/${userId}`).delete();
      changed = true;
      console.log(`   🗑️  companies/${companyId}/employeeRefs/${userId} supprimé`);
    }

    // Compat: supprimer tout doc legacy dans employees/* ayant firebaseUid === userId
    const legacySnap = await db.collection(`companies/${companyId}/employees`).where('firebaseUid', '==', userId).get();
    if (!legacySnap.empty) {
      const batch = db.batch();
      legacySnap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      changed = true;
      console.log(`   🗑️  ${legacySnap.size} doc(s) legacy employees supprimés pour ${companyId}`);
    }

    // Mettre à jour le miroir company.employees{userId} et décrémenter employeeCount
    if (changed) {
      const update = {
        [`employees.${userId}`]: admin.firestore.FieldValue.delete(),
        employeeCount: admin.firestore.FieldValue.increment(-1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('companies').doc(companyId).set(update, { merge: true });
      touched.push(companyId);
      console.log(`   ✅ Miroir employees{} mis à jour et employeeCount décrémenté pour ${companyId}`);
    }
  }

  return touched;
}

async function removeUserDocument(userId) {
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    console.log('ℹ️  users/' + userId + ' introuvable (déjà supprimé?)');
    return false;
  }
  await userRef.delete();
  console.log(`🗑️  users/${userId} supprimé`);
  return true;
}

async function deleteUserById(userId) {
  const report = {
    userId,
    startTime: new Date().toISOString(),
    companiesTouched: [],
    userDeleted: false,
    error: null
  };

  try {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║  Suppression d\'un utilisateur par UID        ║');
    console.log('╚══════════════════════════════════════════════╝\n');

    // 1) Nettoyer toutes les companies
    console.log('🔍 Recherche et nettoyage des références dans companies/...');
    report.companiesTouched = await removeFromAllCompanies(userId);

    // 2) Supprimer le document user
    console.log('\n📄 Suppression du document utilisateur...');
    report.userDeleted = await removeUserDocument(userId);

    report.endTime = new Date().toISOString();
    report.success = true;
    console.log('\n🎉 Suppression terminée');
    return report;
  } catch (err) {
    report.endTime = new Date().toISOString();
    report.success = false;
    report.error = err && err.message ? err.message : String(err);
    console.error('❌ Erreur:', report.error);
    return report;
  }
}

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error('❌ Usage: node scripts/usefull/deleteUserById.cjs <USER_ID>');
    process.exit(1);
  }

  const confirmed = await askConfirmation(userId);
  if (!confirmed) {
    console.log('❌ Opération annulée');
    process.exit(0);
  }

  const report = await deleteUserById(userId);
  if (!report.success) process.exit(1);
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { deleteUserById };


