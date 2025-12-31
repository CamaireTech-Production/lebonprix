/**
 * Fix User Auth UID Lookup Issue
 * 
 * This script checks if getUserById is being called with Auth UID instead of document ID,
 * and verifies if the user document can be found by Auth UID.
 * 
 * Usage:
 *   node scripts/fixUserAuthUidLookup.cjs \
 *     --email=dainaviclair@gmail.com \
 *     --service-account=firebase-keys/new-firebase-key.json
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
 * Main diagnostic function
 */
async function diagnoseAuthUidLookup() {
  try {
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║  Diagnose Auth UID vs Document ID Lookup Issue                           ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');
    console.log(`📧 Email: ${email}\n`);
    
    // 1. Get Auth UID
    console.log('🔍 Step 1: Getting Firebase Auth UID...\n');
    let authUid = null;
    try {
      const authUser = await auth.getUserByEmail(email);
      authUid = authUser.uid;
      console.log(`✅ Auth UID: ${authUid}\n`);
    } catch (error) {
      console.log(`❌ Could not get Auth UID: ${error.message}\n`);
      return;
    }
    
    // 2. Find user document by email
    console.log('🔍 Step 2: Finding user document by email...\n');
    const usersSnapshot = await db.collection('users')
      .where('email', '==', email.toLowerCase().trim())
      .get();
    
    if (usersSnapshot.empty) {
      console.log('❌ User document not found!\n');
      return;
    }
    
    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    const documentId = userDoc.id;
    
    console.log(`✅ Found user document:`);
    console.log(`   Document ID: ${documentId}`);
    console.log(`   Auth UID in document (authUid field): ${userData.authUid || 'MISSING ❌'}`);
    console.log(`   Companies array length: ${userData.companies?.length || 0}\n`);
    
    // 3. Check if Auth UID matches document ID
    console.log('🔍 Step 3: Checking ID matching...\n');
    if (documentId === authUid) {
      console.log('✅ Document ID matches Auth UID - getUserById will work correctly\n');
    } else {
      console.log('❌ PROBLEM: Document ID does NOT match Auth UID!');
      console.log(`   Document ID: ${documentId}`);
      console.log(`   Auth UID: ${authUid}`);
      console.log(`   When login calls getUserById(${authUid}), it will NOT find the document!\n`);
    }
    
    // 4. Try to get user by Auth UID (as document ID)
    console.log('🔍 Step 4: Testing getUserById with Auth UID...\n');
    try {
      const userByAuthUid = await db.collection('users').doc(authUid).get();
      if (userByAuthUid.exists()) {
        const data = userByAuthUid.data();
        console.log(`✅ Found user document using Auth UID as document ID`);
        console.log(`   Companies array length: ${data.companies?.length || 0}\n`);
      } else {
        console.log(`❌ PROBLEM: getUserById(${authUid}) returns NULL!`);
        console.log(`   This is why login redirects to mode-selection!\n`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}\n`);
    }
    
    // 5. Try to find user by authUid field
    console.log('🔍 Step 5: Testing lookup by authUid field...\n');
    try {
      const usersByAuthUidField = await db.collection('users')
        .where('authUid', '==', authUid)
        .get();
      
      if (!usersByAuthUidField.empty) {
        console.log(`✅ Found user by authUid field`);
        const foundDoc = usersByAuthUidField.docs[0];
        const foundData = foundDoc.data();
        console.log(`   Document ID: ${foundDoc.id}`);
        console.log(`   Companies array length: ${foundData.companies?.length || 0}\n`);
      } else {
        console.log(`❌ No user found with authUid field = ${authUid}\n`);
      }
    } catch (error) {
      console.log(`⚠️  Cannot query by authUid field (might need index): ${error.message}\n`);
    }
    
    // 6. Solution
    console.log('='.repeat(80));
    console.log('💡 SOLUTION:');
    console.log('='.repeat(80) + '\n');
    
    if (documentId !== authUid) {
      console.log('The issue is that getUserById() is called with Auth UID, but the');
      console.log('user document has a different ID. There are two solutions:\n');
      console.log('Option 1: Update user document ID to match Auth UID');
      console.log('   - This requires creating a new document with Auth UID as ID');
      console.log('   - And deleting the old document\n');
      console.log('Option 2: Update getUserById to search by authUid field');
      console.log('   - Modify getUserById to first try document ID, then search by authUid field\n');
      console.log('Option 3: Ensure authUid field exists and matches');
      console.log('   - Add/update authUid field in user document\n');
    } else {
      console.log('✅ IDs match - the issue might be elsewhere (localStorage cache, etc.)\n');
    }
    
    console.log('✅ Diagnosis completed!\n');
    
  } catch (error) {
    console.error('\n❌ Diagnosis failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run
diagnoseAuthUidLookup();

