/**
 * Script pour déployer les index Firestore
 * 
 * Ce script déploie les index définis dans firestore.indexes.json
 * en utilisant Firebase CLI.
 * 
 * Usage: node scripts/deployFirestoreIndexes.cjs
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Déploiement des index Firestore...\n');

// Vérifier que firestore.indexes.json existe
const indexesFile = path.join(__dirname, '..', 'firestore.indexes.json');
if (!fs.existsSync(indexesFile)) {
  console.error('❌ Erreur: firestore.indexes.json n\'existe pas!');
  console.error('   Créez d\'abord le fichier firestore.indexes.json à la racine du projet.');
  process.exit(1);
}

console.log('✅ Fichier firestore.indexes.json trouvé');

// Vérifier que firebase.json référence le fichier d'index
const firebaseConfigFile = path.join(__dirname, '..', 'firebase.json');
if (!fs.existsSync(firebaseConfigFile)) {
  console.error('❌ Erreur: firebase.json n\'existe pas!');
  process.exit(1);
}

const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigFile, 'utf8'));
if (!firebaseConfig.firestore?.indexes) {
  console.error('❌ Erreur: firebase.json ne référence pas firestore.indexes.json!');
  console.error('   Ajoutez "indexes": "firestore.indexes.json" dans firebase.json');
  process.exit(1);
}

console.log('✅ Configuration firebase.json valide\n');

try {
  console.log('📦 Déploiement des index Firestore...');
  console.log('   (Cela peut prendre quelques minutes)\n');
  
  // Déployer uniquement les index
  execSync('firebase deploy --only firestore:indexes', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  
  console.log('\n✅ Index Firestore déployés avec succès!');
  console.log('   Les index sont en cours de création sur Firebase.');
  console.log('   Vous pouvez vérifier leur statut dans la console Firebase.');
  
} catch (error) {
  console.error('\n❌ Erreur lors du déploiement des index:');
  console.error(error.message);
  process.exit(1);
}

