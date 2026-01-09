/**
 * Fix Auth UID to Match User Document ID
 * 
 * This script:
 * 1. Finds the user document by email (the one with authUid field set)
 * 2. Gets the current Auth user
 * 3. Creates a new Auth user with UID = user document ID
 * 4. Copies email/password from old Auth user
 * 5. Deletes the old Auth user
 * 6. Updates user document's authUid field to match new UID
 * 7. Deletes the unused user document (if it exists with old UID as ID)
 * 
 * WARNING: This will require the user to log in again with the same credentials
 * 
 * Usage:
 *   node scripts/fixAuthUidToMatchDocumentId.cjs \
 *     --email=dainaviclair@gmail.com \
 *     --service-account=firebase-keys/new-firebase-key.json \
 *     [--dry-run]
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name, required = true) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  if (!arg && required) {
    console.error(`❌ Missing required argument: --${name}`);
    process.exit(1);
  }
  return arg ? arg.split('=')[1] : null;
};

const email = getArg('email');
const serviceAccountPath = getArg('service-account');
const password = getArg('password', false) || '20Mai2002'; // Default password
const dryRun = args.includes('--dry-run');

// Helper: Resolve service account path
function resolveServiceAccountPath(serviceAccountPath) {
  let resolvedPath = path.resolve(serviceAccountPath);
  
  if (!fs.existsSync(resolvedPath)) {
    const possiblePaths = [
      path.join(__dirname, '..', serviceAccountPath),
      path.join(__dirname, '..', 'firebase-keys', path.basename(serviceAccountPath)),
      path.join(__dirname, '..', path.basename(serviceAccountPath))
    ];
    
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        resolvedPath = possiblePath;
        break;
      }
    }
  }
  
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Service account file not found: ${serviceAccountPath}`);
  }
  
  return resolvedPath;
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require(resolveServiceAccountPath(serviceAccountPath));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const auth = admin.auth();

/**
 * Main fix function
 */
async function fixAuthUidToMatchDocumentId() {
  try {
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║  Fix Auth UID to Match User Document ID                                  ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');
    console.log(`📧 Email: ${email}`);
    console.log(`🔍 Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'FIX MODE'}\n`);
    
    // 1. Find user document (the one with authUid field - this is the one used in collections)
    console.log('🔍 Step 1: Finding user document with authUid field...\n');
    const usersSnapshot = await db.collection('users')
      .where('email', '==', email.toLowerCase().trim())
      .get();
    
    if (usersSnapshot.empty) {
      throw new Error(`User document not found: ${email}`);
    }
    
    // Find the document that has authUid field (the one actually used)
    let userDoc = null;
    let documentId = null;
    
    for (const doc of usersSnapshot.docs) {
      const data = doc.data();
      if (data.authUid) {
        userDoc = doc;
        documentId = doc.id;
        break;
      }
    }
    
    // If no document with authUid found, use the first one
    if (!userDoc) {
      userDoc = usersSnapshot.docs[0];
      documentId = userDoc.id;
    }
    
    const userData = userDoc.data();
    
    console.log(`✅ Found user document (the one used in collections):`);
    console.log(`   Document ID: ${documentId}`);
    console.log(`   Name: ${userData.firstname || ''} ${userData.lastname || ''}`);
    console.log(`   Current authUid field: ${userData.authUid || 'NOT SET'}\n`);
    
    // Check if there's another document with old UID as ID
    const oldUid = userData.authUid;
    if (oldUid && oldUid !== documentId) {
      console.log(`🔍 Checking for unused document with ID = old UID (${oldUid})...\n`);
      try {
        const oldDoc = await db.collection('users').doc(oldUid).get();
        if (oldDoc.exists()) {
          console.log(`⚠️  Found unused user document with ID: ${oldUid}`);
          console.log(`   This will be deleted after Auth UID is changed\n`);
        }
      } catch (error) {
        // Document doesn't exist, that's fine
      }
    }
    
    // 2. Get current Auth user
    console.log('🔍 Step 2: Getting current Auth user...\n');
    let currentAuthUser = null;
    try {
      currentAuthUser = await auth.getUserByEmail(email);
      console.log(`✅ Found Auth user:`);
      console.log(`   Current Auth UID: ${currentAuthUser.uid}`);
      console.log(`   Email Verified: ${currentAuthUser.emailVerified}`);
      console.log(`   Display Name: ${currentAuthUser.displayName || 'N/A'}\n`);
    } catch (error) {
      throw new Error(`Auth user not found: ${error.message}`);
    }
    
    // 3. Check if they already match
    if (currentAuthUser.uid === documentId) {
      console.log('✅ Auth UID already matches document ID! No fix needed.\n');
      
      // Just update authUid field if missing
      if (!userData.authUid || userData.authUid !== documentId) {
        if (dryRun) {
          console.log('💡 Would update authUid field in user document\n');
        } else {
          await userDoc.ref.update({
            authUid: documentId,
            updatedAt: admin.firestore.Timestamp.now()
          });
          console.log('✅ Updated authUid field in user document\n');
        }
      }
      return;
    }
    
    console.log('❌ Auth UID does NOT match document ID');
    console.log(`   Need to change Auth UID from: ${currentAuthUser.uid}`);
    console.log(`   To: ${documentId}\n`);
    
    // 4. Check if new UID already exists
    console.log('🔍 Step 3: Checking if new UID already exists...\n');
    try {
      const existingUserWithNewUid = await auth.getUser(documentId);
      console.log(`⚠️  WARNING: Auth user with UID ${documentId} already exists!`);
      console.log(`   Email: ${existingUserWithNewUid.email}`);
      console.log(`   This will cause a conflict. Aborting.\n`);
      throw new Error(`Auth user with UID ${documentId} already exists`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log('✅ New UID is available\n');
      } else {
        throw error;
      }
    }
    
    // 5. Delete old Auth user FIRST (so we can reuse the email)
    console.log('🔍 Step 4: Deleting old Auth user first...\n');
    
    if (dryRun) {
      console.log('💡 DRY RUN - Would:');
      console.log(`   1. Delete old Auth user: ${currentAuthUser.uid}`);
      console.log(`   2. Create new Auth user with UID: ${documentId}`);
      console.log(`   3. Set email: ${currentAuthUser.email}`);
      console.log(`   4. Set password: ${password.replace(/./g, '*')} (hidden)`);
      console.log(`   5. Set displayName: ${currentAuthUser.displayName || userData.firstname + ' ' + userData.lastname}`);
      console.log(`   6. Set emailVerified: ${currentAuthUser.emailVerified}`);
      console.log(`   7. Update user document authUid field`);
      console.log(`   8. Delete unused user document (if exists)\n`);
    } else {
      // Delete old Auth user FIRST
      await auth.deleteUser(currentAuthUser.uid);
      console.log(`✅ Deleted old Auth user: ${currentAuthUser.uid}\n`);
      
      // 6. Create new Auth user with document ID as UID
      console.log('🔍 Step 5: Creating new Auth user with document ID as UID...\n');
      
      const newAuthUser = await auth.createUser({
        uid: documentId, // Use document ID as UID
        email: currentAuthUser.email,
        emailVerified: currentAuthUser.emailVerified,
        displayName: currentAuthUser.displayName || `${userData.firstname || ''} ${userData.lastname || ''}`.trim(),
        password: password, // Use provided password
        disabled: false
      });
      
      console.log(`✅ Created new Auth user with UID: ${newAuthUser.uid}`);
      console.log(`   Email: ${newAuthUser.email}`);
      console.log(`   Password: ${password.replace(/./g, '*')} (hidden)\n`);
      
      // 7. Update user document
      console.log('🔍 Step 6: Updating user document...\n');
      await userDoc.ref.update({
        authUid: documentId,
        updatedAt: admin.firestore.Timestamp.now()
      });
      console.log(`✅ Updated user document authUid field to: ${documentId}\n`);
      
      // 8. Delete unused user document (if it exists with old UID as ID)
      if (currentAuthUser.uid !== documentId) {
        console.log('🔍 Step 7: Checking for unused user document to delete...\n');
        try {
          const oldDocRef = db.collection('users').doc(currentAuthUser.uid);
          const oldDoc = await oldDocRef.get();
          
          if (oldDoc.exists()) {
            console.log(`⚠️  Found unused user document with ID: ${currentAuthUser.uid}`);
            console.log(`   Deleting it...\n`);
            await oldDocRef.delete();
            console.log(`✅ Deleted unused user document: ${currentAuthUser.uid}\n`);
          } else {
            console.log(`✅ No unused document found with ID: ${currentAuthUser.uid}\n`);
          }
        } catch (error) {
          console.log(`⚠️  Could not delete old document: ${error.message}\n`);
        }
      }
      
      // 9. Summary
      console.log('='.repeat(80));
      console.log('✅ FIX COMPLETED!');
      console.log('='.repeat(80) + '\n');
      console.log('📋 Summary:');
      console.log(`   Old Auth UID: ${currentAuthUser.uid}`);
      console.log(`   New Auth UID: ${documentId}`);
      console.log(`   User Document ID: ${documentId}`);
      console.log(`   ✅ Auth UID now matches document ID!\n`);
      console.log('⚠️  IMPORTANT:');
      console.log(`   1. User can now log in with email: ${email}`);
      console.log(`   2. Password: ${password.replace(/./g, '*')} (hidden - use the provided password)`);
      console.log(`   3. Auth UID now matches document ID - login should work correctly!`);
      console.log(`   4. Unused user document (${currentAuthUser.uid}) has been deleted\n`);
    }
    
    console.log('✅ Fix process completed!\n');
    
  } catch (error) {
    console.error('\n❌ Fix failed:', error);
    console.error(error.stack);
    
    if (error.code === 'auth/email-already-exists') {
      console.error('\n💡 The email is already associated with another Auth user.');
      console.error('   You may need to delete the conflicting Auth user first.\n');
    }
    
    process.exit(1);
  }
}

// Run
fixAuthUidToMatchDocumentId();

