/**

* Script de Backup Firestore (un seul fichier)
* Sauvegarde toutes les collections dans un seul fichier JSON structuré.
*
* Usage: node scripts/dbBackupSingle.js
  */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialisation Firebase Admin
if (!admin.apps.length) {
const serviceAccount = require('../firebase-service-account.json');
admin.initializeApp({
credential: admin.credential.cert(serviceAccount)
});
}

const db = admin.firestore();

async function backupFirestore() {
console.log('🚀 Début de la sauvegarde Firestore (fichier unique)...');
const startTime = Date.now();

// Nom du fichier
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(__dirname, '..', 'backup');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
const filePath = path.join(backupDir, `firestore-backup-${timestamp}.json`);

// Liste des collections à sauvegarder
const collections = [
'users', 'companies', 'products', 'sales', 'expenses', 'suppliers',
'financeEntries', 'financeEntryTypes', 'expenseTypes', 'stockBatches',
'stockChanges', 'objectives', 'customers', 'dashboardStats', 'auditLogs'
];

const result = { timestamp: new Date().toISOString(), collections: {} };

for (const collectionName of collections) {
try {
console.log(`📦 Lecture de la collection: ${collectionName}`);
const snapshot = await db.collection(collectionName).get();
const data = [];

  for (const doc of snapshot.docs) {
    const docData = { id: doc.id, ...doc.data() };

    // Inclure sous-collections pour companies
    if (collectionName === 'companies') {
      // Sous-collection employees (ancienne structure)
      const employees = await db
        .collection(collectionName)
        .doc(doc.id)
        .collection('employees')
        .get();
      if (!employees.empty) {
        docData.employees = employees.docs.map(e => ({
          id: e.id,
          ...e.data()
        }));
      }

      // Sous-collection employeeRefs (nouvelle structure)
      const employeeRefs = await db
        .collection(collectionName)
        .doc(doc.id)
        .collection('employeeRefs')
        .get();
      if (!employeeRefs.empty) {
        docData.employeeRefs = employeeRefs.docs.map(e => ({
          id: e.id,
          ...e.data()
        }));
      }
    }
    data.push(docData);
  }

  result.collections[collectionName] = data;
  console.log(`✅ ${collectionName}: ${data.length} documents`);
} catch (err) {
  console.error(`❌ Erreur ${collectionName}: ${err.message}`);
  result.collections[collectionName] = { error: err.message };
}

}

// Sauvegarde finale en un seul fichier
fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
const duration = Math.round((Date.now() - startTime) / 1000);
console.log(`\n🎉 Sauvegarde terminée (${duration}s)`);
console.log(`📁 Fichier généré: ${filePath}`);
}

backupFirestore().catch(err => {
console.error('❌ Échec du backup:', err);
process.exit(1);
});
