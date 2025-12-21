/**
 * Fix User Companies Array from EmployeeRefs
 * 
 * This script fixes the user.companies[] array by reading from employeeRefs subcollections.
 * If a user is found in a company's employeeRefs but not in user.companies[], it adds the reference.
 * 
 * Usage:
 *   node scripts/fixUserCompaniesArray.cjs \
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
const dryRun = args.includes('--dry-run');

// Helper: Resolve service account path
function resolveServiceAccountPath(serviceAccountPath) {
  let resolvedPath = path.resolve(serviceAccountPath);
  
  // Try multiple possible paths
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

/**
 * Find user by email
 */
async function findUserByEmail(email) {
  console.log(`🔍 Searching for user: ${email}`);
  
  const usersSnapshot = await db.collection('users')
    .where('email', '==', email.toLowerCase().trim())
    .get();
  
  if (usersSnapshot.empty) {
    throw new Error(`User not found: ${email}`);
  }
  
  const userDoc = usersSnapshot.docs[0];
  const userData = userDoc.data();
  
  // Also get Auth UID if available
  let authUid = null;
  try {
    const auth = admin.auth();
    const authUser = await auth.getUserByEmail(email);
    authUid = authUser.uid;
    console.log(`✅ Found Auth user: ${authUid}`);
  } catch (error) {
    console.log(`⚠️  Could not get Auth UID: ${error.message}`);
  }
  
  console.log(`✅ Found user document: ${userDoc.id}`);
  console.log(`   Name: ${userData.firstname || ''} ${userData.lastname || ''}`);
  console.log(`   Auth UID: ${authUid || 'N/A'}`);
  console.log(`   User document ID: ${userDoc.id}`);
  console.log(`   Auth UID in userData: ${userData.authUid || 'N/A'}`);
  console.log(`   Current companies in array: ${userData.companies?.length || 0}\n`);
  
  return {
    userId: userDoc.id,
    authUid: authUid || userData.authUid || null,
    userData,
    userRef: userDoc.ref
  };
}

/**
 * Find all companies where user exists in employeeRefs
 * Checks both user document ID and Auth UID
 */
async function findCompaniesFromEmployeeRefs(userId, authUid) {
  console.log(`🔍 Searching for companies with user in employeeRefs...\n`);
  console.log(`   Checking with user document ID: ${userId}`);
  if (authUid) {
    console.log(`   Also checking with Auth UID: ${authUid}\n`);
  }
  
  const companies = [];
  const foundCompanyIds = new Set(); // Avoid duplicates
  
  // Get all companies
  const companiesSnapshot = await db.collection('companies').get();
  console.log(`📋 Checking ${companiesSnapshot.size} companies...\n`);
  
  for (const companyDoc of companiesSnapshot.docs) {
    const companyId = companyDoc.id;
    const companyData = companyDoc.data();
    
    // Skip if already found
    if (foundCompanyIds.has(companyId)) {
      continue;
    }
    
    // Check employeeRefs subcollection with user document ID
    try {
      let employeeRefDoc = await db.collection('companies')
        .doc(companyId)
        .collection('employeeRefs')
        .doc(userId)
        .get();
      
      // If not found with user document ID, try Auth UID
      if (!employeeRefDoc.exists() && authUid) {
        employeeRefDoc = await db.collection('companies')
          .doc(companyId)
          .collection('employeeRefs')
          .doc(authUid)
          .get();
      }
      
      // Also check by searching employeeRefs where id field matches
      if (!employeeRefDoc.exists()) {
        const employeeRefsSnapshot = await db.collection('companies')
          .doc(companyId)
          .collection('employeeRefs')
          .where('id', '==', userId)
          .get();
        
        if (employeeRefsSnapshot.empty && authUid) {
          const authEmployeeRefsSnapshot = await db.collection('companies')
            .doc(companyId)
            .collection('employeeRefs')
            .where('id', '==', authUid)
            .get();
          
          if (!authEmployeeRefsSnapshot.empty) {
            employeeRefDoc = authEmployeeRefsSnapshot.docs[0];
          }
        } else if (!employeeRefsSnapshot.empty) {
          employeeRefDoc = employeeRefsSnapshot.docs[0];
        }
      }
      
      if (employeeRefDoc.exists()) {
        const employeeRefData = employeeRefDoc.data();
        
        console.log(`✅ Found user in company: ${companyData.name || companyId}`);
        console.log(`   Company ID: ${companyId}`);
        console.log(`   EmployeeRef document ID: ${employeeRefDoc.id}`);
        console.log(`   User Role: ${employeeRefData.role || 'N/A'}`);
        console.log(`   Company Name: ${companyData.name || 'N/A'}`);
        
        companies.push({
          companyId,
          companyData,
          employeeRefData,
          employeeRefDoc: employeeRefDoc.ref
        });
        
        foundCompanyIds.add(companyId);
      }
    } catch (error) {
      // Skip if error (company might not have employeeRefs subcollection)
      continue;
    }
  }
  
  console.log(`\n📊 Found ${companies.length} company(ies) with user in employeeRefs\n`);
  
  return companies;
}

/**
 * Check if company is already in user.companies[] array
 */
function isCompanyInUserArray(userCompanies, companyId) {
  if (!userCompanies || userCompanies.length === 0) {
    return false;
  }
  
  return userCompanies.some(c => c.companyId === companyId);
}

/**
 * Create company reference object matching the structure from screenshot
 */
function createCompanyRef(companyId, companyData, employeeRefData) {
  // Get joinedAt from employeeRefData, or use addedAt, or current time
  let joinedAt = null;
  if (employeeRefData.joinedAt) {
    joinedAt = employeeRefData.joinedAt;
  } else if (employeeRefData.addedAt) {
    joinedAt = employeeRefData.addedAt;
  } else {
    joinedAt = admin.firestore.Timestamp.now();
  }
  
  // Create the company reference matching the screenshot structure
  const companyRef = {
    companyId: companyId, // The actual company document ID
    name: companyData.name || '',
    role: employeeRefData.role || 'staff',
    joinedAt: joinedAt
  };
  
  // Add optional fields if they exist
  if (companyData.description) {
    companyRef.description = companyData.description;
  }
  
  if (companyData.logo) {
    companyRef.logo = companyData.logo;
  }
  
  if (employeeRefData.permissionTemplateId) {
    companyRef.permissionTemplateId = employeeRefData.permissionTemplateId;
  }
  
  // Add createdAt if it exists in companyData
  if (companyData.createdAt) {
    companyRef.createdAt = companyData.createdAt;
  }
  
  return companyRef;
}

/**
 * Main fix function
 */
async function fixUserCompaniesArray() {
  try {
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║  Fix User Companies Array from EmployeeRefs                               ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');
    console.log(`📧 Email: ${email}`);
    console.log(`🔍 Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'FIX MODE'}\n`);
    
    // 1. Find user
    const { userId, authUid, userData, userRef } = await findUserByEmail(email);
    
    // 2. Find companies from employeeRefs (check both user ID and Auth UID)
    const companiesFromEmployeeRefs = await findCompaniesFromEmployeeRefs(userId, authUid);
    
    if (companiesFromEmployeeRefs.length === 0) {
      console.log('⚠️  No companies found in employeeRefs. Nothing to fix.\n');
      return;
    }
    
    // 3. Check which companies are missing from user.companies[]
    const currentUserCompanies = userData.companies || [];
    const companiesToAdd = [];
    
    console.log('📋 Analyzing which companies need to be added...\n');
    
    for (const companyInfo of companiesFromEmployeeRefs) {
      const { companyId, companyData, employeeRefData } = companyInfo;
      
      if (!isCompanyInUserArray(currentUserCompanies, companyId)) {
        const companyRef = createCompanyRef(companyId, companyData, employeeRefData);
        
        companiesToAdd.push(companyRef);
        
        console.log(`➕ Will add company: ${companyData.name || companyId}`);
        console.log(`   Role: ${companyRef.role}`);
        console.log(`   Company ID: ${companyId}\n`);
      } else {
        console.log(`✅ Company already in user.companies[]: ${companyData.name || companyId}\n`);
      }
    }
    
    if (companiesToAdd.length === 0) {
      console.log('✅ All companies are already in user.companies[] array. Nothing to fix.\n');
      return;
    }
    
    // 4. Apply fix
    if (dryRun) {
      console.log('🔍 DRY RUN - Would add the following companies:\n');
      companiesToAdd.forEach((companyRef, index) => {
        console.log(`${index + 1}. ${companyRef.name} (${companyRef.companyId})`);
        console.log(`   Role: ${companyRef.role}`);
        console.log(`   Joined At: ${companyRef.joinedAt.toDate ? companyRef.joinedAt.toDate().toISOString() : 'N/A'}\n`);
      });
      console.log('💡 Run without --dry-run to apply the fix.\n');
    } else {
      console.log('🔧 Applying fix...\n');
      
      // Update user document with new companies
      const updatedCompanies = [...currentUserCompanies, ...companiesToAdd];
      
      await userRef.update({
        companies: updatedCompanies,
        updatedAt: admin.firestore.Timestamp.now()
      });
      
      console.log('✅ Successfully updated user.companies[] array!\n');
      console.log(`📊 Summary:`);
      console.log(`   Companies before: ${currentUserCompanies.length}`);
      console.log(`   Companies added: ${companiesToAdd.length}`);
      console.log(`   Companies after: ${updatedCompanies.length}\n`);
      
      // Show what was added
      console.log('📋 Added companies:');
      companiesToAdd.forEach((companyRef, index) => {
        console.log(`   ${index + 1}. ${companyRef.name} (${companyRef.companyId}) - Role: ${companyRef.role}`);
      });
      console.log('');
    }
    
    console.log('✅ Fix completed!\n');
    
  } catch (error) {
    console.error('\n❌ Fix failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run
fixUserCompaniesArray();

