/**
 * Script de Backup Base de Données JSON
 * 
 * Ce script sauvegarde uniquement les données Firestore en format JSON,
 * avec une structure organisée par collection et horodatage.
 * 
 * Usage: node scripts/dbBackup.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Configuration Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require('../firebase-service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

/**
 * Créer le dossier de backup avec timestamp
 */
function createBackupDirectory() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', 'backup', `db-backup-${timestamp}`);
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  return backupDir;
}

/**
 * Sauvegarder toutes les collections Firestore
 */
async function backupFirestoreCollections(backupDir) {
  console.log('📡 Sauvegarde des données Firestore...');
  
  const startTime = Date.now();
  const backupStats = {
    collections: {},
    totalDocuments: 0,
    errors: []
  };
  
  try {
    // Collections principales
    const collections = [
      'users',
      'companies', 
      'products',
      'sales',
      'expenses',
      'suppliers',
      'financeEntries',
      'financeEntryTypes',
      'expenseTypes',
      'stockBatches',
      'stockChanges',
      'objectives',
      'customers',
      'dashboardStats',
      'auditLogs'
    ];
    
    for (const collectionName of collections) {
      console.log(`📋 Sauvegarde de la collection: ${collectionName}`);
      
      try {
        const snapshot = await db.collection(collectionName).get();
        const data = [];
        
        for (const doc of snapshot.docs) {
          const docData = {
            id: doc.id,
            ...doc.data()
          };
          
          // Si c'est une collection companies, sauvegarder aussi les sous-collections
          if (collectionName === 'companies') {
            // Sauvegarder la sous-collection employees (ancienne structure)
            try {
              const employeesSnapshot = await db
                .collection(collectionName)
                .doc(doc.id)
                .collection('employees')
                .get();
              
              if (!employeesSnapshot.empty) {
                docData.employees = [];
                employeesSnapshot.forEach(empDoc => {
                  docData.employees.push({
                    id: empDoc.id,
                    ...empDoc.data()
                  });
                });
              }
            } catch (error) {
              console.log(`⚠️ Pas de sous-collection employees pour ${doc.id}`);
            }

            // Sauvegarder la sous-collection employeeRefs (nouvelle structure)
            try {
              const employeeRefsSnapshot = await db
                .collection(collectionName)
                .doc(doc.id)
                .collection('employeeRefs')
                .get();
              
              if (!employeeRefsSnapshot.empty) {
                docData.employeeRefs = [];
                employeeRefsSnapshot.forEach(empRefDoc => {
                  docData.employeeRefs.push({
                    id: empRefDoc.id,
                    ...empRefDoc.data()
                  });
                });
              }
            } catch (error) {
              console.log(`⚠️ Pas de sous-collection employeeRefs pour ${doc.id}`);
            }
          }
          
          data.push(docData);
        }
        
        // Sauvegarder dans un fichier JSON
        const filePath = path.join(backupDir, `${collectionName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        
        backupStats.collections[collectionName] = data.length;
        backupStats.totalDocuments += data.length;
        
        console.log(`✅ ${collectionName}: ${data.length} documents sauvegardés`);
        
      } catch (error) {
        console.error(`❌ Erreur lors de la sauvegarde de ${collectionName}:`, error.message);
        backupStats.errors.push({
          collection: collectionName,
          error: error.message
        });
      }
    }
    
    const duration = Date.now() - startTime;
    backupStats.duration = duration;
    
    console.log('✅ Sauvegarde Firestore terminée');
    console.log(`⏱️ Durée: ${Math.round(duration / 1000)}s`);
    console.log(`📊 Total: ${backupStats.totalDocuments} documents sauvegardés`);
    
    return backupStats;
    
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde Firestore:', error);
    throw error;
  }
}

/**
 * Créer un fichier de métadonnées du backup
 */
function createBackupMetadata(backupDir, backupStats) {
  const metadata = {
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    description: 'Backup base de données Firestore en format JSON',
    duration: backupStats.duration,
    totalDocuments: backupStats.totalDocuments,
    collections: backupStats.collections,
    errors: backupStats.errors,
    files: {
      firestore: 'Toutes les collections Firestore en format JSON'
    }
  };
  
  const metadataPath = path.join(backupDir, 'backup-metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  
  console.log('✅ Métadonnées du backup créées');
}

/**
 * Fonction principale de backup
 */
async function performDatabaseBackup() {
  console.log('🚀 Début de la sauvegarde de la base de données...');
  console.log('⚠️ ATTENTION: Cette opération peut prendre plusieurs minutes');
  
  try {
    // 1. Créer la structure de backup
    const backupDir = createBackupDirectory();
    console.log(`📁 Dossier de backup créé: ${backupDir}`);
    
    // 2. Sauvegarder Firestore
    const backupStats = await backupFirestoreCollections(backupDir);
    
    // 3. Créer les métadonnées
    createBackupMetadata(backupDir, backupStats);
    
    console.log('\n🎉 Sauvegarde de la base de données terminée!');
    console.log(`📁 Backup sauvegardé dans: ${backupDir}`);
    console.log('\n📋 Résumé:');
    console.log(`- ✅ ${Object.keys(backupStats.collections).length} collections sauvegardées`);
    console.log(`- ✅ ${backupStats.totalDocuments} documents au total`);
    console.log(`- ⏱️ Durée: ${Math.round(backupStats.duration / 1000)}s`);
    
    if (backupStats.errors.length > 0) {
      console.log(`- ⚠️ ${backupStats.errors.length} erreurs rencontrées`);
      backupStats.errors.forEach(err => {
        console.log(`  - ${err.collection}: ${err.error}`);
      });
    }
    
    console.log('\n📄 Fichiers générés:');
    Object.keys(backupStats.collections).forEach(collection => {
      console.log(`- ${collection}.json (${backupStats.collections[collection]} documents)`);
    });
    console.log('- backup-metadata.json');
    
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde:', error);
    process.exit(1);
  }
}

/**
 * Point d'entrée principal
 */
async function main() {
  try {
    await performDatabaseBackup();
  } catch (error) {
    console.error('❌ Backup échoué:', error);
    process.exit(1);
  }
}

// Exécuter le script
if (require.main === module) {
  main();
}

module.exports = {
  performDatabaseBackup,
  backupFirestoreCollections,
  createBackupMetadata
};
