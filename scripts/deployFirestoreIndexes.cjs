/**
 * Script pour déployer les index Firestore
 * 
 * Ce script déploie les index définis dans firestore.indexes.json
 * en utilisant Firebase CLI vers le projet spécifié (dev ou prod).
 * 
 * Usage: 
 *   node scripts/deployFirestoreIndexes.cjs dev   # Déployer vers dev Firebase
 *   node scripts/deployFirestoreIndexes.cjs prod   # Déployer vers prod Firebase
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Récupérer l'environnement depuis les arguments
const environment = process.argv[2]?.toLowerCase();

// Valider l'environnement
if (!environment || !['dev', 'prod'].includes(environment)) {
  console.error('❌ Erreur: Vous devez spécifier un environnement (dev ou prod)');
  console.error('\nUsage:');
  console.error('  node scripts/deployFirestoreIndexes.cjs dev   # Déployer vers dev Firebase');
  console.error('  node scripts/deployFirestoreIndexes.cjs prod  # Déployer vers prod Firebase');
  process.exit(1);
}

console.log(`🚀 Déploiement des index Firestore vers ${environment.toUpperCase()}...\n`);

// Déterminer le fichier de clé Firebase selon l'environnement
const keyFileMap = {
  dev: 'new-firebase-key.json',
  prod: 'old-firebase-key.json'
};

const keyFilePath = path.join(__dirname, '..', 'firebase-keys', keyFileMap[environment]);

if (!fs.existsSync(keyFilePath)) {
  console.error(`❌ Erreur: Fichier de clé Firebase introuvable: ${keyFilePath}`);
  process.exit(1);
}

// Lire le project_id depuis le fichier de clé
let projectId;
try {
  const keyFile = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
  projectId = keyFile.project_id;
  
  if (!projectId) {
    console.error(`❌ Erreur: project_id introuvable dans ${keyFileMap[environment]}`);
    process.exit(1);
  }
} catch (error) {
  console.error(`❌ Erreur lors de la lecture du fichier de clé: ${error.message}`);
  process.exit(1);
}

console.log(`📋 Projet Firebase: ${projectId}`);

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

// Lire .firebaserc pour obtenir l'alias du projet
const firebasercPath = path.join(__dirname, '..', '.firebaserc');
let projectAlias = environment;

if (fs.existsSync(firebasercPath)) {
  try {
    const firebaserc = JSON.parse(fs.readFileSync(firebasercPath, 'utf8'));
    if (firebaserc.projects && firebaserc.projects[environment]) {
      // Vérifier que l'alias pointe vers le bon projet
      const aliasProjectId = firebaserc.projects[environment];
      if (aliasProjectId === projectId) {
        projectAlias = environment;
        console.log(`✅ Alias Firebase trouvé: ${projectAlias} → ${projectId}`);
      } else {
        console.warn(`⚠️  Attention: L'alias "${environment}" dans .firebaserc pointe vers "${aliasProjectId}" mais la clé indique "${projectId}"`);
        console.warn(`   Utilisation de l'alias "${environment}" quand même...`);
      }
    }
  } catch (error) {
    console.warn(`⚠️  Impossible de lire .firebaserc: ${error.message}`);
    console.warn(`   Utilisation de l'environnement "${environment}" comme alias...`);
  }
}

const projectRoot = path.join(__dirname, '..');

try {
  console.log(`\n🔄 Passage au projet Firebase: ${projectAlias}...`);
  
  // Utiliser l'alias du projet Firebase
  execSync(`firebase use ${projectAlias}`, {
    stdio: 'inherit',
    cwd: projectRoot
  });
  
  console.log('\n📦 Déploiement des index Firestore...');
  console.log('   (Cela peut prendre quelques minutes)\n');
  
  // Déployer uniquement les index
  execSync('firebase deploy --only firestore:indexes', {
    stdio: 'inherit',
    cwd: projectRoot
  });
  
  console.log(`\n✅ Index Firestore déployés avec succès vers ${environment.toUpperCase()}!`);
  console.log(`   Projet: ${projectId}`);
  console.log('   Les index sont en cours de création sur Firebase.');
  console.log('   Vous pouvez vérifier leur statut dans la console Firebase.');
  
} catch (error) {
  console.error(`\n❌ Erreur lors du déploiement des index vers ${environment.toUpperCase()}:`);
  console.error(error.message);
  process.exit(1);
}

