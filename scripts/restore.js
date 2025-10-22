/**
 * Script de restauration depuis backup
 * 
 * Ce script restaure :
 * 1. Toutes les données Firestore depuis backup
 * 2. Tous les fichiers de code depuis backup
 * 3. Les règles Firestore
 * 4. La documentation
 * 
 * Usage: node scripts/restore.js [backup-folder-name]
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
 * Lister les backups disponibles
 */
function listAvailableBackups() {
  const backupDir = path.join(__dirname, '..', 'backup');
  
  if (!fs.existsSync(backupDir)) {
    console.log('❌ Aucun dossier backup trouvé');
    return [];
  }
  
  const backups = fs.readdirSync(backupDir)
    .filter(item => {
      const itemPath = path.join(backupDir, item);
      return fs.statSync(itemPath).isDirectory() && item.startsWith('backup-');
    })
    .sort()
    .reverse(); // Plus récent en premier
  
  return backups;
}

/**
 * Sélectionner le backup à restaurer
 */
function selectBackup(backupName) {
  const backupDir = path.join(__dirname, '..', 'backup');
  
  if (backupName) {
    const backupPath = path.join(backupDir, backupName);
    if (fs.existsSync(backupPath)) {
      return backupPath;
    } else {
      console.log(`❌ Backup '${backupName}' non trouvé`);
      process.exit(1);
    }
  }
  
  const backups = listAvailableBackups();
  
  if (backups.length === 0) {
    console.log('❌ Aucun backup disponible');
    process.exit(1);
  }
  
  console.log('📁 Backups disponibles:');
  backups.forEach((backup, index) => {
    const backupPath = path.join(backupDir, backup);
    const stats = fs.statSync(backupPath);
    console.log(`  ${index + 1}. ${backup} (${stats.mtime.toLocaleString()})`);
  });
  
  // Pour l'instant, prendre le plus récent
  const selectedBackup = backups[0];
  console.log(`✅ Sélection automatique: ${selectedBackup}`);
  
  return path.join(backupDir, selectedBackup);
}

/**
 * Restaurer les données Firestore
 */
async function restoreFirestore(firestoreDir) {
  console.log('📡 Restauration des données Firestore...');
  
  try {
    const files = fs.readdirSync(firestoreDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    for (const file of jsonFiles) {
      const collectionName = file.replace('.json', '');
      console.log(`📋 Restauration de la collection: ${collectionName}`);
      
      const filePath = path.join(firestoreDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Vider la collection existante
      const snapshot = await db.collection(collectionName).get();
      const batch = db.batch();
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      if (!snapshot.empty) {
        await batch.commit();
        console.log(`🗑️ Collection ${collectionName} vidée`);
      }
      
      // Restaurer les données
      for (const item of data) {
        const { id, ...itemData } = item;
        
        // Gérer les sous-collections employees
        if (collectionName === 'companies' && item.employees) {
          const { employees, ...companyData } = itemData;
          
          // Créer le document company
          await db.collection(collectionName).doc(id).set(companyData);
          
          // Créer les sous-collections employees
          for (const employee of employees) {
            const { id: empId, ...empData } = employee;
            await db.collection(collectionName)
              .doc(id)
              .collection('employees')
              .doc(empId)
              .set(empData);
          }
          
          console.log(`✅ ${collectionName}/${id} restauré avec ${employees.length} employés`);
        } else {
          await db.collection(collectionName).doc(id).set(itemData);
          console.log(`✅ ${collectionName}/${id} restauré`);
        }
      }
    }
    
    console.log('✅ Restauration Firestore terminée');
    
  } catch (error) {
    console.error('❌ Erreur lors de la restauration Firestore:', error);
    throw error;
  }
}

/**
 * Restaurer les fichiers de code
 */
function restoreCodeFiles(codeDir) {
  console.log('💾 Restauration des fichiers de code...');
  
  const projectRoot = path.join(__dirname, '..');
  
  const filesToRestore = [
    { backup: 'models.ts', target: 'src/types/models.ts' },
    { backup: 'companyService.ts', target: 'src/services/companyService.ts' },
    { backup: 'employeeService.ts', target: 'src/services/employeeService.ts' },
    { backup: 'userService.ts', target: 'src/services/userService.ts' },
    { backup: 'AuthContext.tsx', target: 'src/contexts/AuthContext.tsx' }
  ];
  
  filesToRestore.forEach(({ backup, target }) => {
    const backupPath = path.join(codeDir, backup);
    const targetPath = path.join(projectRoot, target);
    
    if (fs.existsSync(backupPath)) {
      // Créer le dossier cible si nécessaire
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      fs.copyFileSync(backupPath, targetPath);
      console.log(`✅ ${target} restauré`);
    } else {
      console.log(`⚠️ ${backup} non trouvé dans le backup`);
    }
  });
  
  console.log('✅ Restauration des fichiers de code terminée');
}

/**
 * Restaurer les règles Firestore
 */
function restoreFirestoreRules(rulesDir) {
  console.log('🔒 Restauration des règles Firestore...');
  
  const projectRoot = path.join(__dirname, '..');
  
  const rulesFiles = ['firebase.rules', 'storage.rules'];
  
  rulesFiles.forEach(fileName => {
    const backupPath = path.join(rulesDir, fileName);
    const targetPath = path.join(projectRoot, fileName);
    
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, targetPath);
      console.log(`✅ ${fileName} restauré`);
    } else {
      console.log(`⚠️ ${fileName} non trouvé dans le backup`);
    }
  });
  
  console.log('✅ Restauration des règles terminée');
}

/**
 * Restaurer la documentation
 */
function restoreDocumentation(docsDir) {
  console.log('📚 Restauration de la documentation...');
  
  const projectRoot = path.join(__dirname, '..');
  
  const docFiles = ['db.md', 'README.md'];
  
  docFiles.forEach(fileName => {
    const backupPath = path.join(docsDir, fileName);
    const targetPath = path.join(projectRoot, fileName);
    
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, targetPath);
      console.log(`✅ ${fileName} restauré`);
    } else {
      console.log(`⚠️ ${fileName} non trouvé dans le backup`);
    }
  });
  
  console.log('✅ Restauration de la documentation terminée');
}

/**
 * Lire les métadonnées du backup
 */
function readBackupMetadata(backupDir) {
  const metadataPath = path.join(backupDir, 'backup-metadata.json');
  
  if (fs.existsSync(metadataPath)) {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    console.log('\n📋 Informations du backup:');
    console.log(`   Timestamp: ${metadata.timestamp}`);
    console.log(`   Description: ${metadata.description}`);
    console.log(`   Changements: ${metadata.changes.join(', ')}`);
    return metadata;
  } else {
    console.log('⚠️ Métadonnées du backup non trouvées');
    return null;
  }
}

/**
 * Fonction principale de restauration
 */
async function performRestore(backupName) {
  console.log('🔄 Début de la restauration...');
  console.log('⚠️ ATTENTION: Cette opération va écraser les données actuelles');
  
  try {
    // 1. Sélectionner le backup
    const backupDir = selectBackup(backupName);
    console.log(`📁 Backup sélectionné: ${backupDir}`);
    
    // 2. Lire les métadonnées
    const metadata = readBackupMetadata(backupDir);
    
    // 3. Vérifier la structure du backup
    const firestoreDir = path.join(backupDir, 'firestore');
    const codeDir = path.join(backupDir, 'code');
    const rulesDir = path.join(backupDir, 'rules');
    const docsDir = path.join(backupDir, 'docs');
    
    if (!fs.existsSync(firestoreDir)) {
      throw new Error('Dossier firestore non trouvé dans le backup');
    }
    
    // 4. Restaurer Firestore
    await restoreFirestore(firestoreDir);
    
    // 5. Restaurer le code
    if (fs.existsSync(codeDir)) {
      restoreCodeFiles(codeDir);
    }
    
    // 6. Restaurer les règles
    if (fs.existsSync(rulesDir)) {
      restoreFirestoreRules(rulesDir);
    }
    
    // 7. Restaurer la documentation
    if (fs.existsSync(docsDir)) {
      restoreDocumentation(docsDir);
    }
    
    console.log('\n🎉 Restauration terminée!');
    console.log('\n📋 Résumé:');
    console.log('- ✅ Données Firestore restaurées');
    console.log('- ✅ Fichiers de code restaurés');
    console.log('- ✅ Règles Firestore restaurées');
    console.log('- ✅ Documentation restaurée');
    
    console.log('\n🔄 Redémarrez l\'application pour appliquer les changements');
    
  } catch (error) {
    console.error('❌ Erreur lors de la restauration:', error);
    process.exit(1);
  }
}

/**
 * Point d'entrée principal
 */
async function main() {
  const backupName = process.argv[2];
  
  try {
    await performRestore(backupName);
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
  restoreFirestore,
  restoreCodeFiles,
  restoreFirestoreRules,
  restoreDocumentation
};
