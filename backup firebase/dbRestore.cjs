/**
 * Script de Restauration Base de Données JSON
 * 
 * Ce script restaure les données Firestore depuis les backups JSON,
 * avec support pour les deux formats de backup disponibles.
 * 
 * Usage: node scripts/dbRestore.cjs [backup-path] [options]
 */

/**
 * how to launch the script
 * node scripts/dbRestore.cjs /path/to/backup/folder --collections=collection1,collection2 --dry-run --yes --overwrite --merge
 * example: node scripts/dbRestore.cjs backup/2025-10-22-10-00-00 --collections=companies,users --dry-run --yes --overwrite --merge
 * example: node scripts/dbRestore.cjs backup/2025-10-22-10-00-00 --dry-run
 * for a the file : firestore-backup-2025-10-22-10-00-00.json :
 * node scripts/dbRestore.cjs firestore-backup-2025-10-22-10-00-00.json 
 * params are not an obligation. but they useful to control the restore.
 * --collections=collection1,collection2 : the collections to restore
 * --dry-run : dry run the restore
 * --yes : yes to the restore
 * --overwrite : overwrite the existing data
 * --merge : merge the existing data
 * example: node scripts/dbRestore.cjs firestore-backup-2025-10-22-10-00-00.json --collections=companies,users --dry-run --yes --overwrite --merge
 * example: node scripts/dbRestore.cjs firestore-backup-2025-10-22-10-00-00.json --dry-run
 * example: node scripts/dbRestore.cjs firestore-backup-2025-10-22-10-00-00.json --yes --overwrite --merge
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
 * Parse les arguments CLI
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    backupPath: null,
    collections: null,
    dryRun: false,
    yes: false,
    overwrite: false,
    merge: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--collections=')) {
      options.collections = arg.split('=')[1].split(',');
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--yes') {
      options.yes = true;
    } else if (arg === '--overwrite') {
      options.overwrite = true;
    } else if (arg === '--merge') {
      options.merge = true;
    } else if (!arg.startsWith('--') && !options.backupPath) {
      options.backupPath = arg;
    }
  }

  return options;
}

/**
 * Détecter le format de backup
 */
function detectBackupFormat(backupPath) {
  const fullPath = path.resolve(backupPath);
  
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Le chemin de backup n'existe pas: ${backupPath}`);
  }

  const stat = fs.statSync(fullPath);
  
  if (stat.isDirectory()) {
    // Format multi-fichiers
    const metadataFile = path.join(fullPath, 'backup-metadata.json');
    if (fs.existsSync(metadataFile)) {
      return {
        type: 'multi-files',
        path: fullPath,
        metadataFile: metadataFile
      };
    } else {
      throw new Error('Dossier de backup invalide: pas de backup-metadata.json');
    }
  } else if (stat.isFile() && fullPath.endsWith('.json')) {
    // Format fichier unique
    return {
      type: 'single-file',
      path: fullPath
    };
  } else {
    throw new Error('Format de backup non reconnu');
  }
}

/**
 * Lire les métadonnées du backup
 */
function readBackupMetadata(backupInfo) {
  if (backupInfo.type === 'multi-files') {
    const metadataContent = fs.readFileSync(backupInfo.metadataFile, 'utf8');
    return JSON.parse(metadataContent);
  } else {
    // Pour le format single-file, on lit le fichier pour extraire les métadonnées
    const content = fs.readFileSync(backupInfo.path, 'utf8');
    const data = JSON.parse(content);
    return {
      timestamp: data.timestamp,
      collections: Object.keys(data.collections || {}),
      totalDocuments: Object.values(data.collections || {}).reduce((sum, count) => sum + count, 0)
    };
  }
}

/**
 * Charger les données d'une collection depuis le backup
 */
async function loadCollectionData(backupInfo, collectionName) {
  if (backupInfo.type === 'multi-files') {
    const filePath = path.join(backupInfo.path, `${collectionName}.json`);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️ Fichier ${collectionName}.json non trouvé`);
      return [];
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } else {
    // Format single-file
    const content = fs.readFileSync(backupInfo.path, 'utf8');
    const data = JSON.parse(content);
    return data.collections[collectionName] || [];
  }
}

/**
 * Restaurer une collection
 */
async function restoreCollection(collectionName, data, options) {
  console.log(`📦 Restauration de la collection: ${collectionName}`);
  
  if (options.dryRun) {
    console.log(`   [DRY-RUN] ${data.length} documents seraient restaurés`);
    return { success: true, count: data.length };
  }

  const batch = db.batch();
  let successCount = 0;
  let errorCount = 0;

  for (const docData of data) {
    try {
      const docRef = db.collection(collectionName).doc(docData.id);
      
      if (options.overwrite) {
        // Écraser les données existantes
        batch.set(docRef, docData);
      } else if (options.merge) {
        // Fusionner avec les données existantes
        batch.set(docRef, docData, { merge: true });
      } else {
        // Créer seulement si n'existe pas
        batch.set(docRef, docData, { merge: false });
      }
      
      successCount++;
    } catch (error) {
      console.error(`❌ Erreur document ${docData.id}: ${error.message}`);
      errorCount++;
    }
  }

  try {
    await batch.commit();
    console.log(`✅ ${collectionName}: ${successCount} documents restaurés`);
    return { success: true, count: successCount, errors: errorCount };
  } catch (error) {
    console.error(`❌ Erreur batch ${collectionName}: ${error.message}`);
    return { success: false, count: 0, errors: errorCount };
  }
}

/**
 * Restaurer les sous-collections employees
 */
async function restoreEmployees(companyId, employees, options) {
  if (!employees || employees.length === 0) return;

  console.log(`👥 Restauration des employés pour l'entreprise ${companyId}`);
  
  if (options.dryRun) {
    console.log(`   [DRY-RUN] ${employees.length} employés seraient restaurés`);
    return { success: true, count: employees.length };
  }

  const batch = db.batch();
  let successCount = 0;

  for (const employee of employees) {
    try {
      const empRef = db.collection('companies').doc(companyId).collection('employees').doc(employee.id);
      batch.set(empRef, employee);
      successCount++;
    } catch (error) {
      console.error(`❌ Erreur employé ${employee.id}: ${error.message}`);
    }
  }

  try {
    await batch.commit();
    console.log(`✅ Employés ${companyId}: ${successCount} documents restaurés`);
    return { success: true, count: successCount };
  } catch (error) {
    console.error(`❌ Erreur batch employés ${companyId}: ${error.message}`);
    return { success: false, count: 0 };
  }
}

/**
 * Demander confirmation à l'utilisateur
 */
async function askConfirmation(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Fonction principale de restauration
 */
async function performRestore() {
  console.log('🚀 Script de Restauration Base de Données JSON');
  console.log('================================================');

  const options = parseArguments();
  
  if (!options.backupPath) {
    console.error('❌ Chemin de backup requis');
    console.log('Usage: node scripts/dbRestore.cjs [backup-path] [options]');
    process.exit(1);
  }

  try {
    // 1. Détecter le format de backup
    console.log('🔍 Détection du format de backup...');
    const backupInfo = detectBackupFormat(options.backupPath);
    console.log(`✅ Format détecté: ${backupInfo.type}`);

    // 2. Lire les métadonnées
    console.log('📋 Lecture des métadonnées...');
    const metadata = readBackupMetadata(backupInfo);
    console.log(`📅 Backup du: ${metadata.timestamp}`);
    console.log(`📊 Collections: ${Object.keys(metadata.collections || {}).length}`);
    console.log(`📄 Documents: ${metadata.totalDocuments || 'N/A'}`);

    // 3. Déterminer les collections à restaurer
    const collectionsToRestore = options.collections || Object.keys(metadata.collections || {});
    console.log(`🎯 Collections à restaurer: ${collectionsToRestore.join(', ')}`);

    // 4. Mode dry-run
    if (options.dryRun) {
      console.log('\n🔍 MODE DRY-RUN - Aucune modification ne sera effectuée');
      for (const collectionName of collectionsToRestore) {
        const data = await loadCollectionData(backupInfo, collectionName);
        console.log(`📦 ${collectionName}: ${data.length} documents`);
      }
      console.log('\n✅ Simulation terminée');
      return;
    }

    // 5. Confirmation utilisateur
    if (!options.yes) {
      const confirmed = await askConfirmation(
        `\n⚠️ ATTENTION: Cette opération va restaurer ${collectionsToRestore.length} collections. Continuer?`
      );
      if (!confirmed) {
        console.log('❌ Restauration annulée');
        return;
      }
    }

    // 6. Restauration
    console.log('\n🔄 Début de la restauration...');
    const startTime = Date.now();
    const results = {};

    for (const collectionName of collectionsToRestore) {
      try {
        const data = await loadCollectionData(backupInfo, collectionName);
        const result = await restoreCollection(collectionName, data, options);
        results[collectionName] = result;

        // Restaurer les sous-collections employees pour companies
        if (collectionName === 'companies' && result.success) {
          for (const company of data) {
            if (company.employees && company.employees.length > 0) {
              await restoreEmployees(company.id, company.employees, options);
            }
          }
        }
      } catch (error) {
        console.error(`❌ Erreur collection ${collectionName}: ${error.message}`);
        results[collectionName] = { success: false, count: 0, errors: 1 };
      }
    }

    // 7. Rapport final
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log('\n🎉 Restauration terminée!');
    console.log(`⏱️ Durée: ${duration}s`);
    console.log('\n📊 Résumé:');
    
    let totalSuccess = 0;
    let totalErrors = 0;
    
    for (const [collection, result] of Object.entries(results)) {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${collection}: ${result.count} documents`);
      totalSuccess += result.count;
      totalErrors += result.errors || 0;
    }
    
    console.log(`\n📈 Total: ${totalSuccess} documents restaurés`);
    if (totalErrors > 0) {
      console.log(`⚠️ ${totalErrors} erreurs rencontrées`);
    }

  } catch (error) {
    console.error('❌ Erreur lors de la restauration:', error.message);
    process.exit(1);
  }
}

/**
 * Point d'entrée principal
 */
async function main() {
  try {
    await performRestore();
  } catch (error) {
    console.error('❌ Restauration échouée:', error);
    process.exit(1);
  }
}

// Exécuter le script
if (require.main === module) {
  main();
}

module.exports = {
  performRestore,
  detectBackupFormat,
  loadCollectionData,
  restoreCollection
};
