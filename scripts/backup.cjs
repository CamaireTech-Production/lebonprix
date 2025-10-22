/**
 * Script de sauvegarde complète - Architecture Simplifiée
 * 
 * Ce script sauvegarde :
 * 1. Toutes les données Firestore
 * 2. Tous les fichiers de code modifiés
 * 3. Les règles Firestore
 * 4. La documentation
 * 
 * Usage: node scripts/backup.js
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
  const backupDir = path.join(__dirname, '..', 'backup', `backup-${timestamp}`);
  
  // Créer les sous-dossiers
  const firestoreDir = path.join(backupDir, 'firestore');
  const codeDir = path.join(backupDir, 'code');
  const rulesDir = path.join(backupDir, 'rules');
  const docsDir = path.join(backupDir, 'docs');
  
  [firestoreDir, codeDir, rulesDir, docsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  return { backupDir, firestoreDir, codeDir, rulesDir, docsDir };
}

/**
 * Sauvegarder toutes les collections Firestore
 */
async function backupFirestore(firestoreDir) {
  console.log('📡 Sauvegarde des données Firestore...');
  
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
      
      const snapshot = await db.collection(collectionName).get();
      const data = [];
      
      for (const doc of snapshot.docs) {
        const docData = {
          id: doc.id,
          ...doc.data()
        };
        
        // Si c'est une collection companies, sauvegarder aussi les sous-collections
        if (collectionName === 'companies') {
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
        }
        
        data.push(docData);
      }
      
      // Sauvegarder dans un fichier JSON
      const filePath = path.join(firestoreDir, `${collectionName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`✅ ${collectionName}: ${data.length} documents sauvegardés`);
    }
    
    console.log('✅ Sauvegarde Firestore terminée');
    
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde Firestore:', error);
    throw error;
  }
}

/**
 * Sauvegarder les fichiers de code modifiés
 */
function backupCodeFiles(codeDir) {
  console.log('💾 Sauvegarde des fichiers de code...');
  
  const filesToBackup = [
    'src/types/models.ts',
    'src/services/companyService.ts',
    'src/services/employeeService.ts',
    'src/services/userService.ts',
    'src/contexts/AuthContext.tsx',
    'src/services/authService.ts', // Si existe
    'src/components/dashboard/CompanySelector.tsx', // Si existe
    'src/components/auth/SignUp.tsx' // Si existe
  ];
  
  const projectRoot = path.join(__dirname, '..');
  
  filesToBackup.forEach(filePath => {
    const fullPath = path.join(projectRoot, filePath);
    const backupPath = path.join(codeDir, path.basename(filePath));
    
    if (fs.existsSync(fullPath)) {
      fs.copyFileSync(fullPath, backupPath);
      console.log(`✅ ${filePath} sauvegardé`);
    } else {
      console.log(`⚠️ ${filePath} n'existe pas encore`);
    }
  });
  
  console.log('✅ Sauvegarde des fichiers de code terminée');
}

/**
 * Sauvegarder les règles Firestore
 */
function backupFirestoreRules(rulesDir) {
  console.log('🔒 Sauvegarde des règles Firestore...');
  
  const rulesFiles = [
    'firebase.rules',
    'storage.rules'
  ];
  
  const projectRoot = path.join(__dirname, '..');
  
  rulesFiles.forEach(fileName => {
    const fullPath = path.join(projectRoot, fileName);
    const backupPath = path.join(rulesDir, fileName);
    
    if (fs.existsSync(fullPath)) {
      fs.copyFileSync(fullPath, backupPath);
      console.log(`✅ ${fileName} sauvegardé`);
    } else {
      console.log(`⚠️ ${fileName} n'existe pas`);
    }
  });
  
  console.log('✅ Sauvegarde des règles terminée');
}

/**
 * Sauvegarder la documentation
 */
function backupDocumentation(docsDir) {
  console.log('📚 Sauvegarde de la documentation...');
  
  const docFiles = [
    'db.md',
    'README.md',
    'docs/',
    'scripts/migrateToUnifiedUsers.js',
    'scripts/migrateToSimplifiedArchitecture.js' // Si existe
  ];
  
  const projectRoot = path.join(__dirname, '..');
  
  docFiles.forEach(filePath => {
    const fullPath = path.join(projectRoot, filePath);
    const backupPath = path.join(docsDir, path.basename(filePath));
    
    if (fs.existsSync(fullPath)) {
      if (fs.statSync(fullPath).isDirectory()) {
        // Copier récursivement le dossier
        copyDirectory(fullPath, backupPath);
        console.log(`✅ ${filePath}/ sauvegardé`);
      } else {
        fs.copyFileSync(fullPath, backupPath);
        console.log(`✅ ${filePath} sauvegardé`);
      }
    } else {
      console.log(`⚠️ ${filePath} n'existe pas`);
    }
  });
  
  console.log('✅ Sauvegarde de la documentation terminée');
}

/**
 * Copier un dossier récursivement
 */
function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Créer un fichier de métadonnées du backup
 */
function createBackupMetadata(backupDir) {
  const metadata = {
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    description: 'Backup avant simplification architecture - Suppression employeeRefs',
    changes: [
      'Suppression de companies[].employeeRefs',
      'Flux inscription utilisateur puis création entreprise',
      'Dashboard type Netflix',
      'Références unidirectionnelles users[].companies[]'
    ],
    files: {
      firestore: 'Toutes les collections Firestore',
      code: 'Fichiers TypeScript et services modifiés',
      rules: 'Règles Firestore',
      docs: 'Documentation et scripts de migration'
    }
  };
  
  const metadataPath = path.join(backupDir, 'backup-metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  
  console.log('✅ Métadonnées du backup créées');
}

/**
 * Fonction principale de backup
 */
async function performBackup() {
  console.log('🚀 Début de la sauvegarde complète...');
  console.log('⚠️ ATTENTION: Cette opération peut prendre plusieurs minutes');
  
  try {
    // 1. Créer la structure de backup
    const { backupDir, firestoreDir, codeDir, rulesDir, docsDir } = createBackupDirectory();
    console.log(`📁 Dossier de backup créé: ${backupDir}`);
    
    // 2. Sauvegarder Firestore
    await backupFirestore(firestoreDir);
    
    // 3. Sauvegarder le code
    backupCodeFiles(codeDir);
    
    // 4. Sauvegarder les règles
    backupFirestoreRules(rulesDir);
    
    // 5. Sauvegarder la documentation
    backupDocumentation(docsDir);
    
    // 6. Créer les métadonnées
    createBackupMetadata(backupDir);
    
    console.log('\n🎉 Sauvegarde complète terminée!');
    console.log(`📁 Backup sauvegardé dans: ${backupDir}`);
    console.log('\n📋 Résumé:');
    console.log('- ✅ Données Firestore sauvegardées');
    console.log('- ✅ Fichiers de code sauvegardés');
    console.log('- ✅ Règles Firestore sauvegardées');
    console.log('- ✅ Documentation sauvegardée');
    console.log('- ✅ Métadonnées créées');
    
    console.log('\n🔄 Pour restaurer ce backup, utilisez: node scripts/restore.js');
    
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
    await performBackup();
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
  performBackup,
  backupFirestore,
  backupCodeFiles,
  backupFirestoreRules,
  backupDocumentation
};
