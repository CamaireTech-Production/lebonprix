/**
 * Script utilitaire: Mettre à jour le mot de passe d'un utilisateur Firebase Auth
 *
 * Ce script permet de:
 * - Mettre à jour le mot de passe d'un utilisateur par email ou UID
 * - Forcer la réinitialisation du mot de passe à la prochaine connexion (optionnel)
 * - Afficher les informations de l'utilisateur avant modification
 *
 * Usage:
 *   node scripts/usefull/updatePassword.cjs --email=user@example.com --password=newPassword123
 *   node scripts/usefull/updatePassword.cjs --uid=abc123xyz --password=newPassword123
 *   node scripts/usefull/updatePassword.cjs --email=user@example.com --password=newPassword123 --force-reset
 *
 * Options:
 *   --email=<email>        : Email de l'utilisateur (mutuellement exclusif avec --uid)
 *   --uid=<uid>            : UID Firebase de l'utilisateur (mutuellement exclusif avec --email)
 *   --password=<password>  : Nouveau mot de passe (requis, minimum 6 caractères)
 *   --force-reset          : Force la réinitialisation du mot de passe à la prochaine connexion
 *   --service-account=<path>: Chemin vers le fichier de clé de service account (optionnel)
 *   --show-info            : Affiche uniquement les informations de connexion Firebase (sans modifier le mot de passe)
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
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

const email = getArg('email');
const uid = getArg('uid');
const newPassword = getArg('password');
const forceReset = args.includes('--force-reset');
const serviceAccountPath = getArg('service-account');
const showInfoOnly = args.includes('--show-info');

// If showing info only, skip validation
if (!showInfoOnly) {
  // Validation
  if (!email && !uid) {
    console.error('❌ Vous devez fournir soit --email soit --uid');
    console.error('Usage: node scripts/usefull/updatePassword.cjs --email=user@example.com --password=newPassword123');
    console.error('   ou: node scripts/usefull/updatePassword.cjs --uid=abc123xyz --password=newPassword123');
    console.error('   ou: node scripts/usefull/updatePassword.cjs --show-info');
    process.exit(1);
  }

  if (email && uid) {
    console.error('❌ Vous ne pouvez pas fournir à la fois --email et --uid');
    process.exit(1);
  }

  if (!newPassword || newPassword.length < 6) {
    console.error('❌ Le mot de passe doit contenir au moins 6 caractères');
    process.exit(1);
  }
}

// Initialize Firebase Admin
let actualServiceAccountPath = null;
let serviceAccountData = null;

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
    } else {
      // Try multiple possible paths for service account
      const possiblePaths = [
        path.join(__dirname, '../../firebase-keys/le-bon-prix-finances-firebase-adminsdk-fbsvc-530fd9488e.json'),
        path.join(__dirname, '../../firebase-service-account.json'),
        path.join(__dirname, '../../firebase-keys/firebase-service-account.json')
      ];

      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          actualServiceAccountPath = possiblePath;
          break;
        }
      }

      if (!actualServiceAccountPath) {
        console.error('❌ Service account file not found. Tried:');
        possiblePaths.forEach(p => console.error(`   - ${p}`));
        console.error('\n💡 You can specify a service account file with: --service-account=./path/to/key.json');
        process.exit(1);
      }
    }

    serviceAccountData = require(actualServiceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountData)
    });
  } else {
    // Firebase already initialized - try to get info from environment or default location
    if (!serviceAccountData) {
      // Try to load from the same paths to show info
      const possiblePaths = [
        path.join(__dirname, '../../firebase-keys/le-bon-prix-finances-firebase-adminsdk-fbsvc-530fd9488e.json'),
        path.join(__dirname, '../../firebase-service-account.json'),
        path.join(__dirname, '../../firebase-keys/firebase-service-account.json')
      ];
      
      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          actualServiceAccountPath = possiblePath;
          try {
            serviceAccountData = require(possiblePath);
            break;
          } catch (e) {
            // Ignore errors
          }
        }
      }
    }
  }
}

// Initialize Firebase
initializeFirebase();

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
    console.log(`   Private Key ID: ${serviceAccountData.private_key_id || 'N/A'}`);
    console.log(`   Auth URI:       ${serviceAccountData.auth_uri || 'N/A'}`);
    console.log(`   Token URI:      ${serviceAccountData.token_uri || 'N/A'}`);
  } else {
    console.log('⚠️  Informations de service account non disponibles');
  }
  
  // Try to get project info from Firebase Admin
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
 * Get user by email or UID
 */
async function getUser(identifier, isEmail = false) {
  try {
    if (isEmail) {
      const userRecord = await auth.getUserByEmail(identifier);
      return userRecord;
    } else {
      const userRecord = await auth.getUser(identifier);
      return userRecord;
    }
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      throw new Error(`Utilisateur non trouvé: ${identifier}`);
    }
    throw error;
  }
}

/**
 * Ask for confirmation
 */
function askConfirmation(userInfo, newPassword) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║  Informations de l\'utilisateur               ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log(`UID:        ${userInfo.uid}`);
    console.log(`Email:      ${userInfo.email || 'N/A'}`);
    console.log(`Nom:        ${userInfo.displayName || 'N/A'}`);
    console.log(`Créé le:    ${userInfo.metadata.creationTime}`);
    console.log(`Dernière connexion: ${userInfo.metadata.lastSignInTime || 'Jamais'}`);
    console.log(`Email vérifié: ${userInfo.emailVerified ? '✅' : '❌'}`);
    console.log(`Désactivé:  ${userInfo.disabled ? '❌ Oui' : '✅ Non'}`);
    console.log(`\nNouveau mot de passe: ${'*'.repeat(newPassword.length)}`);
    if (forceReset) {
      console.log(`⚠️  L'utilisateur devra réinitialiser son mot de passe à la prochaine connexion`);
    }
    console.log('\n⚠️  Cette opération modifiera le mot de passe de l\'utilisateur');
    rl.question('Confirmez-vous cette modification? (tapez "OUI"): ', (answer) => {
      rl.close();
      resolve(answer.trim().toUpperCase() === 'OUI');
    });
  });
}

/**
 * Update user password
 */
async function updatePassword(userId, password, forcePasswordReset = false) {
  try {
    // Update password
    await auth.updateUser(userId, {
      password: password
    });
    
    // If force reset is requested, set a custom claim
    // The client app should check this claim and force password change
    if (forcePasswordReset) {
      const user = await auth.getUser(userId);
      const currentClaims = user.customClaims || {};
      await auth.setCustomUserClaims(userId, {
        ...currentClaims,
        forcePasswordReset: true,
        passwordResetRequired: true
      });
    }

    return true;
  } catch (error) {
    if (error.code === 'auth/weak-password') {
      throw new Error('Le mot de passe est trop faible (minimum 6 caractères)');
    }
    if (error.code === 'auth/invalid-password') {
      throw new Error('Le mot de passe est invalide');
    }
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Display Firebase connection info
    displayFirebaseInfo();
    
    // If only showing info, exit here
    if (showInfoOnly) {
      console.log('ℹ️  Mode --show-info: Aucune modification effectuée');
      process.exit(0);
    }
    
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║  Mise à jour du mot de passe Firebase Auth   ║');
    console.log('╚══════════════════════════════════════════════╝\n');

    // Get user
    const identifier = email || uid;
    const isEmail = !!email;
    
    console.log(`🔍 Recherche de l'utilisateur ${isEmail ? 'par email' : 'par UID'}...`);
    const user = await getUser(identifier, isEmail);
    
    console.log(`✅ Utilisateur trouvé: ${user.email || user.uid}`);

    // Ask for confirmation
    const confirmed = await askConfirmation(user, newPassword);
    if (!confirmed) {
      console.log('❌ Opération annulée');
      process.exit(0);
    }

    // Update password
    console.log('\n🔐 Mise à jour du mot de passe...');
    await updatePassword(user.uid, newPassword, forceReset);
    
    console.log('✅ Mot de passe mis à jour avec succès!');
    
    if (forceReset) {
      console.log('⚠️  L\'utilisateur devra réinitialiser son mot de passe à la prochaine connexion');
    }

    console.log('\n📋 Résumé:');
    console.log(`   UID: ${user.uid}`);
    console.log(`   Email: ${user.email || 'N/A'}`);
    console.log(`   Mot de passe: Mis à jour ${forceReset ? '(réinitialisation forcée)' : ''}`);
    console.log(`   Date: ${new Date().toISOString()}`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { updatePassword, getUser };

