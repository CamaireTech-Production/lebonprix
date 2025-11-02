/**
 * Script de suppression: Supprimer toutes les companies commençant par "comp"
 * 
 * ⚠️ ATTENTION: Cette opération est IRRÉVERSIBLE!
 * Ce script supprime définitivement les companies et leurs données associées.
 * 
 * Usage: node scripts/deleteCompaniesByPrefix.cjs
 * 
 * Les companies suivantes seront supprimées:
 * - Le document company dans la collection 'companies'
 * - La sous-collection 'employeeRefs' si elle existe
 * - Toutes les données associées
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require('../firebase-service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

/**
 * Supprime récursivement une collection et toutes ses sous-collections
 */
async function deleteCollection(collectionPath, batchSize = 100) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve, reject);
  });
}

/**
 * Supprime un batch de documents
 */
function deleteQueryBatch(query, resolve, reject) {
  query.get()
    .then((snapshot) => {
      // Si aucun document, c'est terminé
      if (snapshot.size === 0) {
        return 0;
      }

      // Batch de suppression
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      return batch.commit().then(() => {
        return snapshot.size;
      });
    })
    .then((numDeleted) => {
      if (numDeleted === 0) {
        resolve();
        return;
      }
      // Récursion pour supprimer le prochain batch
      process.nextTick(() => {
        deleteQueryBatch(query, resolve, reject);
      });
    })
    .catch(reject);
}

/**
 * Supprime toutes les sous-collections d'une company
 */
async function deleteCompanySubcollections(companyId) {
  const subcollections = [
    'employeeRefs',
    'employees',
    'products',
    'categories',
    'sales',
    'purchases',
    'financialCategories',
    'transactions'
  ];

  const deletedSubcollections = [];

  for (const subcollection of subcollections) {
    try {
      const subcollectionPath = `companies/${companyId}/${subcollection}`;
      const subcollectionRef = db.collection(subcollectionPath);
      const snapshot = await subcollectionRef.limit(1).get();
      
      if (!snapshot.empty) {
        console.log(`   🗑️  Suppression de la sous-collection: ${subcollection}`);
        await deleteCollection(subcollectionPath);
        deletedSubcollections.push(subcollection);
      }
    } catch (error) {
      console.error(`   ❌ Erreur lors de la suppression de ${subcollection}:`, error.message);
    }
  }

  return deletedSubcollections;
}

/**
 * Supprime une company et toutes ses données associées
 */
async function deleteCompany(companyId, companyData) {
  const deletionReport = {
    companyId,
    companyName: companyData.name || 'Sans nom',
    deleted: false,
    error: null,
    subcollectionsDeleted: []
  };

  try {
    console.log(`\n🗑️  Suppression de: ${companyData.name || 'Sans nom'} (${companyId})`);

    // 1. Supprimer les sous-collections
    console.log('   📁 Suppression des sous-collections...');
    deletionReport.subcollectionsDeleted = await deleteCompanySubcollections(companyId);

    // 2. Supprimer le document company
    console.log('   📄 Suppression du document company...');
    await db.collection('companies').doc(companyId).delete();

    deletionReport.deleted = true;
    console.log(`   ✅ Company supprimée avec succès`);

  } catch (error) {
    deletionReport.error = error.message;
    console.error(`   ❌ Erreur lors de la suppression:`, error.message);
    throw error;
  }

  return deletionReport;
}

/**
 * Demande confirmation à l'utilisateur
 */
function askConfirmation(companies) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n⚠️  ATTENTION: Cette opération est IRRÉVERSIBLE!\n');
    console.log(`📋 Companies qui seront supprimées (${companies.length}):`);
    companies.forEach((company, index) => {
      console.log(`   ${index + 1}. ${company.name || 'Sans nom'} (${company.id})`);
    });

    rl.question('\n❓ Confirmez-vous la suppression? (tapez "OUI" pour confirmer): ', (answer) => {
      rl.close();
      resolve(answer.trim().toUpperCase() === 'OUI');
    });
  });
}

/**
 * Fonction principale
 */
async function deleteCompaniesByPrefix() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  Suppression: Companies commençant par "comp"        ║');
  console.log('║  ⚠️  OPÉRATION IRRÉVERSIBLE!                         ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  const report = {
    startTime: new Date().toISOString(),
    prefix: 'comp',
    companiesFound: [],
    companiesDeleted: [],
    companiesFailed: [],
    totalDeleted: 0,
    totalFailed: 0,
    errors: []
  };

  try {
    // 1. Récupérer toutes les companies
    console.log('🔍 Recherche des companies commençant par "comp"...\n');
    const companiesSnapshot = await db.collection('companies').get();
    
    // Filtrer les companies commençant par "comp"
    const companiesToDelete = [];
    companiesSnapshot.forEach((doc) => {
      const companyId = doc.id;
      if (companyId.toLowerCase().startsWith('comp')) {
        companiesToDelete.push({
          id: companyId,
          ...doc.data()
        });
      }
    });

    report.companiesFound = companiesToDelete.map(c => ({
      id: c.id,
      including: false,
      name: c.name || 'Sans nom'
    }));

    if (companiesToDelete.length === 0) {
      console.log('✅ Aucune company trouvée commençant par "comp"\n');
      report.endTime = new Date().toISOString();
      report.success = true;
      return report;
    }

    console.log(`📋 ${companiesToDelete.length} company(ies) trouvée(s) commençant par "comp"\n`);

    // 2. Demander confirmation
    const confirmed = await askConfirmation(companiesToDelete);
    
    if (!confirmed) {
      console.log('\n❌ Opération annulée par l\'utilisateur\n');
      report.cancelled = true;
      report.endTime = new Date().toISOString();
      return report;
    }

    console.log('\n🚀 Début de la suppression...\n');

    // 3. Supprimer chaque company
    for (const company of companiesToDelete) {
      try {
        const deletionReport = await deleteCompany(company.id, company);
        report.companiesDeleted.push(deletionReport);
        report.totalDeleted++;
      } catch (error) {
        report.companiesFailed.push({
          companyId: company.id,
          companyName: company.name || 'Sans nom',
          error: error.message
        });
        report.totalFailed++;
        report.errors.push({
          companyId: company.id,
          error: error.message,
          stack: error.stack
        });
      }
    }

    // 4. Générer le rapport
    report.endTime = new Date().toISOString();
    report.success = report.totalFailed === 0;
    report.duration = new Date(report.endTime) - new Date(report.startTime);

    const timestamp = Date.now();
    const reportPath = path.join(__dirname, '..', `delete-companies-report-${timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // 5. Afficher le résumé
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║  Résumé de la suppression                            ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
    console.log(`📊 Companies trouvées: ${companiesToDelete.length}`);
    console.log(`✅ Companies supprimées: ${report.totalDeleted}`);
    console.log(`❌ Companies en erreur: ${report.totalFailed}`);
    console.log(`⏱️  Durée: ${(report.duration / 1000).toFixed(2)}s\n`);
    console.log(`📄 Rapport détaillé: ${reportPath}\n`);

    if (report.totalFailed > 0) {
      console.log('⚠️  Certaines companies n\'ont pas pu être supprimées:');
      report.companiesFailed.forEach((failure) => {
        console.log(`   - ${failure.companyName} (${failure.companyId}): ${failure.error}`);
      });
      console.log('');
    }

    if (report.totalDeleted === companiesToDelete.length) {
      console.log('🎉 Toutes les companies ont été supprimées avec succès!\n');
    }

  } catch (error) {
    console.error('❌ Erreur fatale lors de la suppression:', error);
    report.errors.push({
      error: error.message,
      stack: error.stack
    });

    const timestamp = Date.now();
    const reportPath = path.join(__dirname, '..', `delete-companies-error-${timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    throw error;
  }

  return report;
}

/**
 * Point d'entrée
 */
async function main() {
  try {
    await deleteCompaniesByPrefix();
    console.log('✅ Script terminé\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Script échoué:', error);
    process.exit(1);
  }
}

// Exécuter le script
if (require.main === module) {
  main();
}

module.exports = {
  deleteCompaniesByPrefix,
  deleteCompany,
  deleteCompanySubcollections
};
