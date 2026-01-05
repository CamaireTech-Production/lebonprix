/**
 * Create Firebase Auth User and Firestore User Document with Specific ID
 * 
 * Creates a Firebase Auth user and a Firestore user document with a specific ID.
 * This is useful for migrating employees where the employeeRef references a specific user ID.
 * 
 * Usage:
 *   node scripts/createUserWithSpecificId.cjs \
 *     --email=dainaviclair@gmail.com \
 *     --password=20Mai2002 \
 *     --user-id=VyVDLzkcPxQzocHghnJO \
 *     --firstname=Daina \
 *     --lastname=Viclaire \
 *     [--service-account=firebase-keys/new-firebase-key.json]
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
const password = getArg('password');
const userId = getArg('user-id'); // Specific Firestore document ID
const firstname = getArg('firstname', false) || 'User';
const lastname = getArg('lastname', false) || 'Name';
const serviceAccountPath = getArg('service-account', false) || 'firebase-keys/new-firebase-key.json';

// Initialize Firebase Admin
if (!admin.apps.length) {
  let serviceAccountPathResolved = path.resolve(serviceAccountPath);
  
  // Try multiple possible paths
  if (!fs.existsSync(serviceAccountPathResolved)) {
    const possiblePaths = [
      path.join(__dirname, '..', serviceAccountPath),
      path.join(__dirname, '..', 'firebase-keys', path.basename(serviceAccountPath)),
      path.join(__dirname, '..', path.basename(serviceAccountPath))
    ];
    
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        serviceAccountPathResolved = possiblePath;
        break;
      }
    }
  }
  
  if (!fs.existsSync(serviceAccountPathResolved)) {
    console.error(`❌ Service account file not found: ${serviceAccountPath}`);
    process.exit(1);
  }
  
  const serviceAccount = require(serviceAccountPathResolved);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const auth = admin.auth();
const db = admin.firestore();

console.log('🚀 Creating user with specific ID...');
console.log(`📧 Email: ${email}`);
console.log(`🆔 User Document ID: ${userId}`);
console.log(`👤 Name: ${firstname} ${lastname}`);

/**
 * Create Firebase Auth user
 */
async function createAuthUser(email, password, displayName) {
  try {
    console.log('\n🔥 Creating Firebase Auth user...');
    
    // Check if user already exists
    try {
      const existingUser = await auth.getUserByEmail(email);
      console.log(`⚠️  User already exists in Auth with UID: ${existingUser.uid}`);
      return existingUser.uid;
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }
    
    // Create new user
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: displayName,
      emailVerified: false
    });
    
    console.log(`✅ Firebase Auth user created: ${userRecord.uid}`);
    return userRecord.uid;
    
  } catch (error) {
    console.error('❌ Error creating Auth user:', error.message);
    throw error;
  }
}

/**
 * Create Firestore user document with specific ID
 */
async function createFirestoreUser(authUid, userId, email, firstname, lastname) {
  try {
    console.log('\n📄 Creating Firestore user document...');
    
    // Check if document already exists
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    
    if (userDoc.exists) {
      console.log(`⚠️  User document already exists with ID: ${userId}`);
      const existingData = userDoc.data();
      console.log(`   Current data:`, {
        email: existingData.email,
        firstname: existingData.firstname,
        lastname: existingData.lastname
      });
      
      // Update with Auth UID if not set
      if (!existingData.authUid || existingData.authUid !== authUid) {
        console.log(`   Updating with Auth UID: ${authUid}`);
        await userDocRef.update({
          authUid: authUid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      return existingData;
    }
    
    // Create new user document
    const now = admin.firestore.Timestamp.now();
    const userData = {
      id: userId,
      authUid: authUid, // Store Auth UID for reference
      email: email.toLowerCase().trim(),
      firstname: firstname,
      lastname: lastname,
      createdAt: now,
      updatedAt: now,
      companies: [],
      status: 'active'
    };
    
    await userDocRef.set(userData);
    console.log(`✅ Firestore user document created with ID: ${userId}`);
    
    return userData;
    
  } catch (error) {
    console.error('❌ Error creating Firestore user:', error.message);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // 1. Create Firebase Auth user
    const authUid = await createAuthUser(email, password, `${firstname} ${lastname}`);
    
    // 2. Create Firestore user document with specific ID
    const userData = await createFirestoreUser(authUid, userId, email, firstname, lastname);
    
    // 3. Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ USER CREATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`📧 Email: ${email}`);
    console.log(`🔥 Auth UID: ${authUid}`);
    console.log(`🆔 Firestore Document ID: ${userId}`);
    console.log(`👤 Name: ${firstname} ${lastname}`);
    console.log(`📊 Status: ${userData.status || 'active'}`);
    console.log(`\n✅ User created successfully!`);
    console.log(`\n💡 The user can now log in with:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    
  } catch (error) {
    console.error('\n❌ Failed to create user:', error);
    process.exit(1);
  }
}

// Run
main();


