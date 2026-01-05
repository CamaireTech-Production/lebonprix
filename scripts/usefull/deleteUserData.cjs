/**
 * Script de suppression: Supprimer toutes les données d'un utilisateur (sauf users et companies)
 * 
 * ⚠️ ATTENTION: Cette opération est IRRÉVERSIBLE!
 * Ce script supprime définitivement toutes les données créées par un utilisateur dans toutes les collections,
 * SAUF les documents dans les collections 'users' et 'companies'.
 * 
 * Usage: 
 *   node scripts/usefull/deleteUserData.cjs --email=user@example.com
 *   node scripts/usefull/deleteUserData.cjs --email=user@example.com --dry-run
 *   node scripts/usefull/deleteUserData.cjs --email=user@example.com --collections=products,sales,orders
 *   node scripts/usefull/deleteUserData.cjs --email=user@example.com --firebase-type=old
 *   node scripts/usefull/deleteUserData.cjs --email=user@example.com --old-firebase
 *   node scripts/usefull/deleteUserData.cjs --email=user@example.com --new-firebase
 * 
 * Options:
 *   --email=<email>              : Email de l'utilisateur (requis)
 *   --dry-run                    : Mode simulation (affiche ce qui sera supprimé sans supprimer)
 *   --collections=<list>         : Liste de collections spécifiques à supprimer (optionnel, par défaut toutes)
 *   --service-account=<path>     : Chemin vers le fichier de clé de service account (optionnel)
 *   --firebase-type=old|new      : Spécifier explicitement old ou new Firebase (optionnel)
 *   --old-firebase                : Utiliser l'ancien Firebase (équivalent à --firebase-type=old)
 *   --new-firebase                : Utiliser le nouveau Firebase (équivalent à --firebase-type=new)
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name, required = false) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  if (!arg && required) {
    console.error(`❌ Missing required argument: --${name}`);
    process.exit(1);
  }
  return arg ? arg.split('=')[1] : null;
};

const email = getArg('email', true);
const dryRun = args.includes('--dry-run');
const collectionsArg = getArg('collections', false);
const serviceAccountPath = getArg('service-account');
const firebaseTypeArg = getArg('firebase-type', false);
const useOldFirebase = args.includes('--old-firebase');
const useNewFirebase = args.includes('--new-firebase');

// All available collections (excluding users and companies)
const ALL_COLLECTIONS = [
  'products',
  'sales',
  'orders',
  'expenses',
  'finances',
  'suppliers',
  'customers',
  'categories',
  'stockBatches',
  'stockChanges',
  'objectives',
  'financeEntries',
  'financeEntryTypes',
  'expenseTypes',
  'customerSources',
  'invitations',
  'checkout_settings',
  'cinetpay_configs',
  'sellerSettings',
  'auditLogs'
];

// Parse collections to delete
const collectionsToDelete = collectionsArg
  ? collectionsArg.split(',').map(c => c.trim())
  : ALL_COLLECTIONS;

// Determine Firebase project (old or new) based on firebase-keys folder
let actualServiceAccountPath = null;
let serviceAccountData = null;
let isOldFirebase = false;

// Determine desired Firebase type from arguments
let desiredFirebaseType = null;
if (firebaseTypeArg) {
  if (firebaseTypeArg.toLowerCase() === 'old') {
    desiredFirebaseType = 'old';
  } else if (firebaseTypeArg.toLowerCase() === 'new') {
    desiredFirebaseType = 'new';
  } else {
    console.error(`❌ Invalid --firebase-type value: ${firebaseTypeArg}. Must be 'old' or 'new'`);
    process.exit(1);
  }
} else if (useOldFirebase) {
  desiredFirebaseType = 'old';
} else if (useNewFirebase) {
  desiredFirebaseType = 'new';
}

function initializeFirebase() {
  if (!admin.apps.length) {
    // If service account path is provided, use it
    if (serviceAccountPath) {
      const resolvedPath = path.resolve(serviceAccountPath);
      if (!fs.existsSync(resolvedPath)) {
        console.error(`❌ Service account file not found: ${resolvedPath}`);
        process.exit(1);
      }
      actualServiceAccountPath = resolvedPath;
      serviceAccountData = require(resolvedPath);
      
      // Try to detect type from filename if not specified
      if (desiredFirebaseType === null) {
        const filename = path.basename(resolvedPath).toLowerCase();
        if (filename.includes('old')) {
          isOldFirebase = true;
        } else if (filename.includes('new')) {
          isOldFirebase = false;
        }
      } else {
        isOldFirebase = desiredFirebaseType === 'old';
      }
    } else {
      // Try to detect old vs new Firebase from firebase-keys folder
      const firebaseKeysDir = path.join(__dirname, '../../firebase-keys');
      const possiblePaths = [
        {
          path: path.join(firebaseKeysDir, 'old-firebase-key.json'),
          isOld: true
        },
        {
          path: path.join(firebaseKeysDir, 'new-firebase-key.json'),
          isOld: false
        },
        {
          path: path.join(firebaseKeysDir, 'le-bon-prix-finances-firebase-adminsdk-fbsvc-530fd9488e.json'),
          isOld: false // Default to new if using the main key
        },
        {
          path: path.join(__dirname, '../../firebase-service-account.json'),
          isOld: false
        }
      ];

      // Filter paths based on desired Firebase type
      let pathsToCheck = possiblePaths;
      if (desiredFirebaseType === 'old') {
        pathsToCheck = possiblePaths.filter(p => p.isOld === true);
        if (pathsToCheck.length === 0) {
          console.error('❌ No old Firebase key file found. Expected: firebase-keys/old-firebase-key.json');
          process.exit(1);
        }
      } else if (desiredFirebaseType === 'new') {
        pathsToCheck = possiblePaths.filter(p => p.isOld === false);
        if (pathsToCheck.length === 0) {
          console.error('❌ No new Firebase key file found. Expected: firebase-keys/new-firebase-key.json');
          process.exit(1);
        }
      }

      let found = false;
      for (const possiblePath of pathsToCheck) {
        if (fs.existsSync(possiblePath.path)) {
          actualServiceAccountPath = possiblePath.path;
          isOldFirebase = possiblePath.isOld;
          serviceAccountData = require(possiblePath.path);
          console.log(`📁 Using service account: ${path.basename(actualServiceAccountPath)}`);
          console.log(`🔍 Firebase type: ${isOldFirebase ? 'OLD' : 'NEW'}${desiredFirebaseType ? ' (explicitly specified)' : ' (auto-detected)'}`);
          found = true;
          break;
        }
      }

      if (!found) {
        console.error('❌ Service account file not found. Tried:');
        pathsToCheck.forEach(p => console.error(`   - ${p.path}`));
        if (desiredFirebaseType) {
          console.error(`\n💡 Looking for ${desiredFirebaseType} Firebase key file.`);
        }
        console.error('\n💡 You can specify a service account file with: --service-account=./path/to/key.json');
        console.error('💡 Or use --firebase-type=old or --firebase-type=new to specify which Firebase to use');
        process.exit(1);
      }
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountData)
    });
  }
}

// Initialize Firebase
initializeFirebase();

const db = admin.firestore();
const auth = admin.auth();

/**
 * Display Firebase connection information
 */
function displayFirebaseInfo() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  Informations de connexion Firebase          ║');
  console.log('╚══════════════════════════════════════════════╝\n');
  
  if (serviceAccountData) {
    console.log(`📁 Fichier de clé:`);
    console.log(`   ${actualServiceAccountPath}`);
    console.log(`\n🔑 Informations du projet:`);
    console.log(`   Project ID:     ${serviceAccountData.project_id || 'N/A'}`);
    console.log(`   Client Email:   ${serviceAccountData.client_email || 'N/A'}`);
    console.log(`   Firebase Type:  ${isOldFirebase ? 'OLD' : 'NEW'}`);
  }
  
  try {
    const app = admin.app();
    console.log(`\n✅ Firebase Admin initialisé`);
    console.log(`   App Name: ${app.name}`);
  } catch (error) {
    console.log(`\n⚠️  Impossible de récupérer les informations de l'app Firebase`);
  }
  
  console.log('');
}

/**
 * Discover user and companies by email
 */
async function discoverUserAndCompanies(email) {
  console.log(`\n🔍 Recherche de l'utilisateur et des entreprises par email: ${email}...`);
  
  // Find user by email in Firestore
  const usersSnapshot = await db.collection('users')
    .where('email', '==', email.toLowerCase())
    .get();
  
  if (usersSnapshot.empty) {
    // Try to find user in Firebase Auth
    try {
      const authUser = await auth.getUserByEmail(email);
      console.log(`   ✅ Utilisateur trouvé dans Firebase Auth: ${authUser.uid}`);
      
      // Check if user document exists in Firestore
      const userDoc = await db.collection('users').doc(authUser.uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        const userId = authUser.uid;
        
        // Find companies owned by this user
        const companiesByUserId = await db.collection('companies')
          .where('userId', '==', userId)
          .get();
        
        // Also find companies by email match
        const companiesByEmail = await db.collection('companies')
          .where('email', '==', email.toLowerCase())
          .get();
        
        const companyIds = new Set();
        companiesByUserId.docs.forEach(doc => companyIds.add(doc.id));
        companiesByEmail.docs.forEach(doc => companyIds.add(doc.id));
        
        // Also check user's companies array
        if (userData.companies && Array.isArray(userData.companies)) {
          userData.companies.forEach(companyRef => {
            if (companyRef.companyId) {
              companyIds.add(companyRef.companyId);
            }
          });
        }
        
        const allCompanyIds = Array.from(companyIds);
        
        console.log(`   ✅ Utilisateur trouvé: ${userData.firstname || ''} ${userData.lastname || ''} (${userId})`);
        console.log(`   🏢 Entreprises trouvées: ${allCompanyIds.length}`);
        allCompanyIds.forEach(id => console.log(`      - ${id}`));
        
        return {
          userId,
          userData,
          companyIds: allCompanyIds
        };
      } else {
        throw new Error(`User document not found in Firestore for email: ${email}`);
      }
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        throw new Error(`Utilisateur non trouvé: ${email}`);
      }
      throw error;
    }
  } else {
    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    const userId = userDoc.id;
    
    // Find companies owned by this user
    const companiesByUserId = await db.collection('companies')
      .where('userId', '==', userId)
      .get();
    
    // Also find companies by email match
    const companiesByEmail = await db.collection('companies')
      .where('email', '==', email.toLowerCase())
      .get();
    
    const companyIds = new Set();
    companiesByUserId.docs.forEach(doc => companyIds.add(doc.id));
    companiesByEmail.docs.forEach(doc => companyIds.add(doc.id));
    
    // Also check user's companies array
    if (userData.companies && Array.isArray(userData.companies)) {
      userData.companies.forEach(companyRef => {
        if (companyRef.companyId) {
          companyIds.add(companyRef.companyId);
        }
      });
    }
    
    const allCompanyIds = Array.from(companyIds);
    
    console.log(`   ✅ Utilisateur trouvé: ${userData.firstname || ''} ${userData.lastname || ''} (${userId})`);
    console.log(`   🏢 Entreprises trouvées: ${allCompanyIds.length}`);
    allCompanyIds.forEach(id => console.log(`      - ${id}`));
    
    return {
      userId,
      userData,
      companyIds: allCompanyIds
    };
  }
}

/**
 * Delete documents from a collection by companyId and userId
 */
async function deleteCollectionData(collectionName, companyIds, userId) {
  console.log(`\n📋 Suppression de la collection: ${collectionName}`);
  
  if ((!companyIds || companyIds.length === 0) && !userId) {
    console.log(`   ⚠️  Aucune entreprise ou utilisateur trouvé, passage à la collection suivante`);
    return { count: 0, errors: [] };
  }
  
  const deletionReport = {
    collection: collectionName,
    count: 0,
    errors: []
  };
  
  const deletedDocIds = new Set(); // Track deleted docs to avoid duplicates
  
  try {
    // Delete by companyId
    if (companyIds && companyIds.length > 0) {
      // Firestore has a limit of 10 items in 'in' queries
      const batchSize = 10;
      
      for (let i = 0; i < companyIds.length; i += batchSize) {
        const batchCompanyIds = companyIds.slice(i, i + batchSize);
        
        let query = db.collection(collectionName);
        
        // Apply filter by companyId
        if (batchCompanyIds.length === 1) {
          query = query.where('companyId', '==', batchCompanyIds[0]);
        } else {
          query = query.where('companyId', 'in', batchCompanyIds);
        }
        
        // Delete in batches
        let hasMore = true;
        while (hasMore) {
          const snapshot = await query.limit(500).get();
          
          if (snapshot.empty) {
            hasMore = false;
            break;
          }
          
          if (dryRun) {
            console.log(`   🔍 [DRY RUN] Trouvé ${snapshot.size} documents (par companyId) à supprimer`);
            snapshot.docs.forEach(doc => deletedDocIds.add(doc.id));
            hasMore = snapshot.size === 500;
          } else {
            // Delete in batches of 500 (Firestore batch limit)
            const deleteBatch = db.batch();
            let batchCount = 0;
            
            snapshot.docs.forEach((doc) => {
              if (!deletedDocIds.has(doc.id)) {
                deleteBatch.delete(doc.ref);
                deletedDocIds.add(doc.id);
                batchCount++;
              }
            });
            
            if (batchCount > 0) {
              await deleteBatch.commit();
              console.log(`   ✅ Supprimé ${batchCount} documents (par companyId)`);
            }
            
            hasMore = snapshot.size === 500;
          }
        }
      }
    }
    
    // Also delete by userId (to catch any data created by user but not linked to company)
    if (userId) {
      let query = db.collection(collectionName).where('userId', '==', userId);
      
      let hasMore = true;
      while (hasMore) {
        const snapshot = await query.limit(500).get();
        
        if (snapshot.empty) {
          hasMore = false;
          break;
        }
        
        if (dryRun) {
          const newDocs = snapshot.docs.filter(doc => !deletedDocIds.has(doc.id));
          if (newDocs.length > 0) {
            console.log(`   🔍 [DRY RUN] Trouvé ${newDocs.length} documents supplémentaires (par userId) à supprimer`);
            newDocs.forEach(doc => deletedDocIds.add(doc.id));
          }
          hasMore = snapshot.size === 500;
        } else {
          // Delete in batches of 500
          const deleteBatch = db.batch();
          let batchCount = 0;
          
          snapshot.docs.forEach((doc) => {
            if (!deletedDocIds.has(doc.id)) {
              deleteBatch.delete(doc.ref);
              deletedDocIds.add(doc.id);
              batchCount++;
            }
          });
          
          if (batchCount > 0) {
            await deleteBatch.commit();
            console.log(`   ✅ Supprimé ${batchCount} documents supplémentaires (par userId)`);
          }
          
          hasMore = snapshot.size === 500;
        }
      }
    }
    
    deletionReport.count = deletedDocIds.size;
    console.log(`   ✅ Total supprimé: ${deletedDocIds.size} documents`);
    
  } catch (error) {
    console.error(`   ❌ Erreur lors de la suppression: ${error.message}`);
    deletionReport.errors.push({
      error: error.message,
      stack: error.stack
    });
  }
  
  return deletionReport;
}

/**
 * Ask for confirmation
 */
function askConfirmation(userInfo, companyIds, collectionsToDelete) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║  ⚠️  ATTENTION: Opération IRRÉVERSIBLE!     ║');
    console.log('╚══════════════════════════════════════════════╝\n');
    console.log(`📧 Email: ${email}`);
    console.log(`👤 Utilisateur: ${userInfo.firstname || ''} ${userInfo.lastname || ''} (${userInfo.userId})`);
    console.log(`🏢 Entreprises: ${companyIds.length}`);
    companyIds.forEach((id, index) => {
      console.log(`   ${index + 1}. ${id}`);
    });
    console.log(`\n📋 Collections à supprimer (${collectionsToDelete.length}):`);
    collectionsToDelete.forEach((col, index) => {
      console.log(`   ${index + 1}. ${col}`);
    });
    console.log(`\n⚠️  Les collections 'users' et 'companies' ne seront PAS supprimées`);
    console.log(`\n🔍 Mode: ${dryRun ? 'DRY RUN (simulation)' : 'SUPPRESSION RÉELLE'}`);

    rl.question('\n❓ Confirmez-vous la suppression? (tapez "OUI" pour confirmer): ', (answer) => {
      rl.close();
      resolve(answer.trim().toUpperCase() === 'OUI');
    });
  });
}

/**
 * Main deletion function
 */
async function performDeletion() {
  try {
    // Display Firebase info
    displayFirebaseInfo();
    
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║  Suppression des données utilisateur        ║');
    console.log('╚══════════════════════════════════════════════╝\n');
    
    // Discover user and companies
    const { userId, userData, companyIds } = await discoverUserAndCompanies(email);
    
    if (companyIds.length === 0) {
      console.log('⚠️  Aucune entreprise trouvée pour cet utilisateur');
      console.log('ℹ️  Aucune donnée à supprimer');
      process.exit(0);
    }
    
    // Ask for confirmation
    const confirmed = await askConfirmation(
      { userId, ...userData },
      companyIds,
      collectionsToDelete
    );
    
    if (!confirmed) {
      console.log('\n❌ Opération annulée par l\'utilisateur');
      process.exit(0);
    }
    
    console.log('\n🚀 Début de la suppression...\n');
    
    // Delete data from each collection
    const deletionReport = {
      startTime: new Date().toISOString(),
      email,
      userId,
      companyIds,
      collections: [],
      totalDeleted: 0,
      totalErrors: 0
    };
    
    for (const collectionName of collectionsToDelete) {
      const result = await deleteCollectionData(collectionName, companyIds, userId);
      deletionReport.collections.push({
        name: collectionName,
        count: result.count,
        errors: result.errors
      });
      deletionReport.totalDeleted += result.count;
      deletionReport.totalErrors += result.errors.length;
    }
    
    // Generate report
    deletionReport.endTime = new Date().toISOString();
    deletionReport.duration = new Date(deletionReport.endTime) - new Date(deletionReport.startTime);
    deletionReport.success = deletionReport.totalErrors === 0;
    deletionReport.dryRun = dryRun;
    
    const timestamp = Date.now();
    const reportPath = path.join(__dirname, '..', '..', `delete-user-data-report-${timestamp}.json`);
    if (!dryRun) {
      fs.writeFileSync(reportPath, JSON.stringify(deletionReport, null, 2));
    }
    
    // Display summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ DE LA SUPPRESSION');
    console.log('='.repeat(60));
    console.log(`📧 Email: ${email}`);
    console.log(`👤 Utilisateur: ${userData.firstname || ''} ${userData.lastname || ''} (${userId})`);
    console.log(`🏢 Entreprises: ${companyIds.length}`);
    console.log(`📋 Collections traitées: ${collectionsToDelete.length}`);
    console.log(`✅ Documents supprimés: ${deletionReport.totalDeleted}`);
    console.log(`❌ Erreurs: ${deletionReport.totalErrors}`);
    console.log(`⏱️  Durée: ${(deletionReport.duration / 1000).toFixed(2)}s`);
    console.log(`\n📋 Détails par collection:`);
    deletionReport.collections.forEach(col => {
      const status = col.errors.length > 0 ? '⚠️' : '✅';
      console.log(`   ${status} ${col.name}: ${col.count} documents supprimés`);
      if (col.errors.length > 0) {
        col.errors.forEach(err => {
          console.log(`      ❌ Erreur: ${err.error}`);
        });
      }
    });
    
    if (!dryRun) {
      console.log(`\n📄 Rapport détaillé: ${reportPath}`);
    } else {
      console.log(`\n⚠️  MODE DRY RUN - Aucune donnée n'a été supprimée`);
    }
    
    if (deletionReport.totalErrors === 0) {
      console.log('\n🎉 Suppression terminée avec succès!');
    } else {
      console.log('\n⚠️  Suppression terminée avec des erreurs');
    }
    
    console.log('');
    
  } catch (error) {
    console.error('\n❌ Erreur fatale lors de la suppression:', error);
    console.error(`   Message: ${error.message}`);
    if (error.stack) {
      console.error(`   Stack: ${error.stack}`);
    }
    process.exit(1);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await performDeletion();
    process.exit(0);
  } catch (error) {
    console.error('❌ Script échoué:', error);
    process.exit(1);
  }
}

// Run script
if (require.main === module) {
  main();
}

module.exports = {
  deleteUserData: performDeletion,
  discoverUserAndCompanies,
  deleteCollectionData
};

