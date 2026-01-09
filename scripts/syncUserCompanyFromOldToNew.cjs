/**
 * Sync User Company from Old Firebase to New Firebase
 * 
 * This script:
 * 1. Reads the user's companies[] array from OLD Firebase
 * 2. Finds the corresponding company in NEW Firebase
 * 3. Adds it to the user's companies[] array in NEW Firebase
 * 
 * Usage:
 *   node scripts/syncUserCompanyFromOldToNew.cjs \
 *     --email=dainaviclair@gmail.com \
 *     --old-service-account=firebase-keys/old-firebase-key.json \
 *     --new-service-account=firebase-keys/new-firebase-key.json \
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
const oldServiceAccountPath = getArg('old-service-account');
const newServiceAccountPath = getArg('new-service-account');
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

// Initialize Firebase Admin instances
let oldDb, newDb, oldAuth, newAuth;

function initializeFirebase() {
  console.log('🔧 Initializing Firebase connections...\n');
  
  // Initialize old Firebase
  const oldServiceAccount = require(resolveServiceAccountPath(oldServiceAccountPath));
  const oldApp = admin.initializeApp({
    credential: admin.credential.cert(oldServiceAccount)
  }, 'old-firebase');
  
  oldDb = oldApp.firestore();
  oldAuth = oldApp.auth();
  
  // Initialize new Firebase
  const newServiceAccount = require(resolveServiceAccountPath(newServiceAccountPath));
  const newApp = admin.initializeApp({
    credential: admin.credential.cert(newServiceAccount)
  }, 'new-firebase');
  
  newDb = newApp.firestore();
  newAuth = newApp.auth();
  
  console.log('✅ Firebase connections initialized\n');
}

/**
 * Get user and companies from OLD Firebase
 */
async function getUserCompaniesFromOld(email) {
  console.log('📊 Reading from OLD Firebase...\n');
  
  // Find user by email
  const usersSnapshot = await oldDb.collection('users')
    .where('email', '==', email.toLowerCase().trim())
    .get();
  
  if (usersSnapshot.empty) {
    throw new Error(`User not found in OLD Firebase: ${email}`);
  }
  
  const userDoc = usersSnapshot.docs[0];
  const userData = userDoc.data();
  const oldUserId = userDoc.id;
  
  console.log(`✅ Found user in OLD Firebase: ${oldUserId}`);
  console.log(`   Name: ${userData.firstname || ''} ${userData.lastname || ''}`);
  console.log(`   Companies in array: ${userData.companies?.length || 0}\n`);
  
  if (!userData.companies || userData.companies.length === 0) {
    console.log('⚠️  User has no companies in OLD Firebase. Nothing to sync.\n');
    return { oldUserId, companies: [] };
  }
  
  // Display companies from old Firebase
  console.log('📋 Companies in OLD Firebase user.companies[]:');
  userData.companies.forEach((company, index) => {
    console.log(`   ${index + 1}. ${company.name || 'N/A'} (${company.companyId || 'N/A'})`);
    console.log(`      Role: ${company.role || 'N/A'}`);
    console.log(`      Company ID: ${company.companyId || 'N/A'}\n`);
  });
  
  return {
    oldUserId,
    companies: userData.companies || []
  };
}

/**
 * Find corresponding company in NEW Firebase
 */
async function findCompanyInNew(companyFromOld) {
  console.log(`🔍 Searching for company in NEW Firebase: ${companyFromOld.name}\n`);
  
  // Method 1: Try to find by companyId (if it exists in new Firebase)
  if (companyFromOld.companyId) {
    try {
      const companyDoc = await newDb.collection('companies').doc(companyFromOld.companyId).get();
      if (companyDoc.exists()) {
        console.log(`✅ Found company by ID: ${companyFromOld.companyId}`);
        return {
          companyId: companyDoc.id,
          companyData: companyDoc.data(),
          foundBy: 'companyId'
        };
      }
    } catch (error) {
      // Continue to other methods
    }
  }
  
  // Method 2: Find by name
  const companiesByName = await newDb.collection('companies')
    .where('name', '==', companyFromOld.name)
    .get();
  
  if (!companiesByName.empty) {
    // If multiple companies with same name, we'll need to check employeeRefs
    console.log(`   Found ${companiesByName.size} company(ies) with name "${companyFromOld.name}"`);
    
    // For now, take the first one (or we could check employeeRefs)
    const companyDoc = companiesByName.docs[0];
    console.log(`✅ Found company by name: ${companyDoc.id}`);
    return {
      companyId: companyDoc.id,
      companyData: companyDoc.data(),
      foundBy: 'name'
    };
  }
  
  // Method 3: Search all companies and check employeeRefs for the user
  console.log(`   Company not found by name, searching all companies...`);
  const allCompanies = await newDb.collection('companies').get();
  
  for (const companyDoc of allCompanies.docs) {
    const companyData = companyDoc.data();
    
    // Check if name matches (case insensitive)
    if (companyData.name && companyData.name.toLowerCase() === companyFromOld.name.toLowerCase()) {
      console.log(`✅ Found company by name (case-insensitive): ${companyDoc.id}`);
      return {
        companyId: companyDoc.id,
        companyData: companyData,
        foundBy: 'name (case-insensitive)'
      };
    }
  }
  
  throw new Error(`Company "${companyFromOld.name}" not found in NEW Firebase`);
}

/**
 * Get user from NEW Firebase
 */
async function getUserFromNew(email) {
  console.log(`🔍 Finding user in NEW Firebase: ${email}\n`);
  
  const usersSnapshot = await newDb.collection('users')
    .where('email', '==', email.toLowerCase().trim())
    .get();
  
  if (usersSnapshot.empty) {
    throw new Error(`User not found in NEW Firebase: ${email}`);
  }
  
  const userDoc = usersSnapshot.docs[0];
  const userData = userDoc.data();
  const newUserId = userDoc.id;
  
  console.log(`✅ Found user in NEW Firebase: ${newUserId}`);
  console.log(`   Name: ${userData.firstname || ''} ${userData.lastname || ''}`);
  console.log(`   Current companies in array: ${userData.companies?.length || 0}\n`);
  
  return {
    userId: newUserId,
    userData,
    userRef: userDoc.ref
  };
}

/**
 * Create company reference matching old structure
 */
function createCompanyRef(companyFromOld, newCompanyId, newCompanyData) {
  const companyRef = {
    companyId: newCompanyId,
    name: companyFromOld.name || newCompanyData.name || '',
    role: companyFromOld.role || 'staff'
  };
  
  // Copy optional fields from old if they exist
  if (companyFromOld.description) {
    companyRef.description = companyFromOld.description;
  } else if (newCompanyData.description) {
    companyRef.description = newCompanyData.description;
  }
  
  if (companyFromOld.logo) {
    companyRef.logo = companyFromOld.logo;
  } else if (newCompanyData.logo) {
    companyRef.logo = newCompanyData.logo;
  }
  
  if (companyFromOld.permissionTemplateId) {
    companyRef.permissionTemplateId = companyFromOld.permissionTemplateId;
  }
  
  // Handle joinedAt - use from old if available, otherwise current time
  if (companyFromOld.joinedAt) {
    // Convert Firestore Timestamp if needed
    if (companyFromOld.joinedAt.toMillis) {
      companyRef.joinedAt = companyFromOld.joinedAt;
    } else if (companyFromOld.joinedAt._seconds) {
      companyRef.joinedAt = admin.firestore.Timestamp.fromMillis(
        companyFromOld.joinedAt._seconds * 1000 + (companyFromOld.joinedAt._nanoseconds || 0) / 1000000
      );
    } else {
      companyRef.joinedAt = admin.firestore.Timestamp.now();
    }
  } else {
    companyRef.joinedAt = admin.firestore.Timestamp.now();
  }
  
  // Add createdAt if it exists in old
  if (companyFromOld.createdAt) {
    if (companyFromOld.createdAt.toMillis) {
      companyRef.createdAt = companyFromOld.createdAt;
    } else if (companyFromOld.createdAt._seconds) {
      companyRef.createdAt = admin.firestore.Timestamp.fromMillis(
        companyFromOld.createdAt._seconds * 1000 + (companyFromOld.createdAt._nanoseconds || 0) / 1000000
      );
    }
  }
  
  return companyRef;
}

/**
 * Main sync function
 */
async function syncUserCompany() {
  try {
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║  Sync User Company from OLD Firebase to NEW Firebase                      ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');
    console.log(`📧 Email: ${email}`);
    console.log(`🔍 Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'SYNC MODE'}\n`);
    
    // Initialize Firebase
    initializeFirebase();
    
    // 1. Get user and companies from OLD Firebase
    const { oldUserId, companies: oldCompanies } = await getUserCompaniesFromOld(email);
    
    if (oldCompanies.length === 0) {
      console.log('✅ Nothing to sync.\n');
      return;
    }
    
    // 2. Get user from NEW Firebase
    const { userId: newUserId, userData: newUserData, userRef: newUserRef } = await getUserFromNew(email);
    
    // 3. For each company in old, find it in new and add to user
    const companiesToAdd = [];
    
    for (const oldCompany of oldCompanies) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Processing: ${oldCompany.name || 'Unknown Company'}`);
      console.log('='.repeat(80) + '\n');
      
      // Check if already exists in new user's companies
      const existingCompany = (newUserData.companies || []).find(
        c => c.companyId && (
          c.companyId === oldCompany.companyId ||
          c.name === oldCompany.name
        )
      );
      
      if (existingCompany) {
        console.log(`✅ Company already exists in NEW Firebase user.companies[]`);
        console.log(`   Company ID: ${existingCompany.companyId}`);
        console.log(`   Name: ${existingCompany.name}\n`);
        continue;
      }
      
      // Find company in NEW Firebase
      const { companyId: newCompanyId, companyData: newCompanyData, foundBy } = await findCompanyInNew(oldCompany);
      
      console.log(`✅ Found company in NEW Firebase`);
      console.log(`   New Company ID: ${newCompanyId}`);
      console.log(`   Found by: ${foundBy}`);
      console.log(`   Company Name: ${newCompanyData.name || 'N/A'}\n`);
      
      // Create company reference
      const companyRef = createCompanyRef(oldCompany, newCompanyId, newCompanyData);
      
      companiesToAdd.push(companyRef);
      
      console.log(`📋 Company reference to add:`);
      console.log(`   companyId: ${companyRef.companyId}`);
      console.log(`   name: ${companyRef.name}`);
      console.log(`   role: ${companyRef.role}`);
      console.log(`   joinedAt: ${companyRef.joinedAt.toDate ? companyRef.joinedAt.toDate().toISOString() : 'N/A'}\n`);
    }
    
    if (companiesToAdd.length === 0) {
      console.log('✅ All companies already exist in NEW Firebase. Nothing to sync.\n');
      return;
    }
    
    // 4. Apply sync
    if (dryRun) {
      console.log(`\n🔍 DRY RUN - Would add ${companiesToAdd.length} company(ies) to user.companies[]:\n`);
      companiesToAdd.forEach((companyRef, index) => {
        console.log(`${index + 1}. ${companyRef.name} (${companyRef.companyId})`);
        console.log(`   Role: ${companyRef.role}`);
        console.log(`   Joined At: ${companyRef.joinedAt.toDate ? companyRef.joinedAt.toDate().toISOString() : 'N/A'}\n`);
      });
      console.log('💡 Run without --dry-run to apply the sync.\n');
    } else {
      console.log(`\n🔧 Applying sync...\n`);
      
      // Get current companies array
      const currentCompanies = newUserData.companies || [];
      const updatedCompanies = [...currentCompanies, ...companiesToAdd];
      
      // Update user document
      await newUserRef.update({
        companies: updatedCompanies,
        updatedAt: admin.firestore.Timestamp.now()
      });
      
      console.log('✅ Successfully synced companies to NEW Firebase!\n');
      console.log(`📊 Summary:`);
      console.log(`   Companies before: ${currentCompanies.length}`);
      console.log(`   Companies added: ${companiesToAdd.length}`);
      console.log(`   Companies after: ${updatedCompanies.length}\n`);
      
      // Show what was added
      console.log('📋 Added companies:');
      companiesToAdd.forEach((companyRef, index) => {
        console.log(`   ${index + 1}. ${companyRef.name} (${companyRef.companyId}) - Role: ${companyRef.role}`);
      });
      console.log('');
    }
    
    console.log('✅ Sync completed!\n');
    
  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run
syncUserCompany();

