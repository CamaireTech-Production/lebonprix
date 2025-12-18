/**
 * Script simple pour initialiser les collections Firestore nécessaires pour Magasin
 * 
 * Ce script crée les collections en créant puis supprimant un document vide.
 * Les collections sont ainsi créées et prêtes à être utilisées.
 * 
 * Usage: node scripts/initializeMagasinCollections.cjs
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
 * Initialise une collection en créant puis supprimant un document vide
 */
async function initializeCollection(collectionName) {
  try {
    const collectionRef = db.collection(collectionName);
    // Utiliser un ID généré automatiquement pour éviter les IDs réservés
    const placeholderRef = collectionRef.doc();
    
    // Créer un document vide
    await placeholderRef.set({
      _initialized: true,
      _createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Supprimer immédiatement le document (la collection reste créée)
    await placeholderRef.delete();
    
    console.log(`✅ Collection '${collectionName}' initialisée`);
    return true;
  } catch (error) {
    console.error(`❌ Erreur lors de l'initialisation de '${collectionName}':`, error.message);
    return false;
  }
}

/**
 * Fonction principale
 */
async function initializeMagasinCollections() {
  console.log('🚀 Initialisation des collections Magasin...\n');
  
  const collections = [
    'matieres'
    // stockBatches et stockChanges existent déjà pour les produits
  ];
  
  const results = {
    success: [],
    failed: []
  };
  
  for (const collectionName of collections) {
    const success = await initializeCollection(collectionName);
    if (success) {
      results.success.push(collectionName);
    } else {
      results.failed.push(collectionName);
    }
  }
  
  console.log('\n📊 Résumé:');
  console.log(`   ✅ Collections initialisées: ${results.success.length}`);
  if (results.success.length > 0) {
    console.log(`      - ${results.success.join(', ')}`);
  }
  
  if (results.failed.length > 0) {
    console.log(`   ❌ Collections en échec: ${results.failed.length}`);
    console.log(`      - ${results.failed.join(', ')}`);
    process.exit(1);
  }
  
  console.log('\n✅ Toutes les collections ont été initialisées avec succès!');
  console.log('   Les collections sont maintenant prêtes à être utilisées.');
}

// Exécuter le script
initializeMagasinCollections()
  .then(() => {
    console.log('\n✨ Terminé!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  });

