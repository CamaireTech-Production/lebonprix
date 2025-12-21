/**
 * Diagnose User-Company Relationship Issues
 * 
 * This script compares how a user is related to companies in old vs new Firebase
 * and identifies why the relationship might not be correctly established.
 * 
 * Usage:
 *   node scripts/diagnoseUserCompanyRelationship.cjs \
 *     --email=dainaviclair@gmail.com \
 *     --old-service-account=firebase-keys/old-firebase-key.json \
 *     --new-service-account=firebase-keys/new-firebase-key.json \
 *     [--propose-fix]
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
const proposeFix = args.includes('--propose-fix');

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
 * Get user by email from Firebase
 */
async function getUserByEmail(db, auth, email, label) {
  console.log(`🔍 Searching for user in ${label} Firebase: ${email}`);
  
  // Try to find user in Firestore by email
  const usersSnapshot = await db.collection('users')
    .where('email', '==', email.toLowerCase().trim())
    .get();
  
  let userDoc = null;
  let userData = null;
  let authUser = null;
  
  if (!usersSnapshot.empty) {
    userDoc = usersSnapshot.docs[0];
    userData = userDoc.data();
    console.log(`  ✅ Found user document: ${userDoc.id}`);
    console.log(`     Name: ${userData.firstname || ''} ${userData.lastname || ''}`);
    console.log(`     Email: ${userData.email || 'N/A'}`);
    console.log(`     Status: ${userData.status || 'N/A'}`);
    console.log(`     Companies count: ${userData.companies?.length || 0}`);
  } else {
    console.log(`  ⚠️  User document not found in Firestore`);
  }
  
  // Try to find user in Firebase Auth
  try {
    authUser = await auth.getUserByEmail(email);
    console.log(`  ✅ Found Auth user: ${authUser.uid}`);
    console.log(`     Display Name: ${authUser.displayName || 'N/A'}`);
    console.log(`     Email Verified: ${authUser.emailVerified}`);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.log(`  ⚠️  Auth user not found`);
    } else {
      console.log(`  ❌ Error checking Auth: ${error.message}`);
    }
  }
  
  return {
    userDoc,
    userData,
    userId: userDoc?.id || null,
    authUser,
    authUid: authUser?.uid || null
  };
}

/**
 * Get companies related to user
 */
async function getRelatedCompanies(db, userId, authUid, email, label) {
  console.log(`\n🏢 Finding companies related to user in ${label} Firebase...`);
  
  const companies = [];
  
  // Method 1: Find companies where userId matches
  if (userId) {
    const companiesByUserId = await db.collection('companies')
      .where('userId', '==', userId)
      .get();
    
    console.log(`  📋 Companies with userId=${userId}: ${companiesByUserId.size}`);
    companiesByUserId.forEach(doc => {
      const data = doc.data();
      companies.push({
        companyId: doc.id,
        name: data.name || 'N/A',
        email: data.email || 'N/A',
        userId: data.userId,
        source: 'userId field'
      });
      console.log(`     - ${doc.id}: ${data.name || 'N/A'}`);
    });
  }
  
  // Method 2: Find companies where email matches
  const companiesByEmail = await db.collection('companies')
    .where('email', '==', email.toLowerCase().trim())
    .get();
  
  console.log(`  📋 Companies with email=${email}: ${companiesByEmail.size}`);
  companiesByEmail.forEach(doc => {
    const data = doc.data();
    // Avoid duplicates
    if (!companies.find(c => c.companyId === doc.id)) {
      companies.push({
        companyId: doc.id,
        name: data.name || 'N/A',
        email: data.email || 'N/A',
        userId: data.userId,
        source: 'email field'
      });
      console.log(`     - ${doc.id}: ${data.name || 'N/A'}`);
    }
  });
  
  // Method 3: Find companies where companyId is in user.companies[] array
  // (We'll check this from the user document)
  
  return companies;
}

/**
 * Check user.companies[] array
 */
function checkUserCompaniesArray(userData, label) {
  console.log(`\n📋 Checking user.companies[] array in ${label} Firebase...`);
  
  if (!userData || !userData.companies) {
    console.log(`  ⚠️  No companies array found`);
    return [];
  }
  
  console.log(`  ✅ Found ${userData.companies.length} company reference(s):`);
  userData.companies.forEach((companyRef, index) => {
    console.log(`     ${index + 1}. Company ID: ${companyRef.companyId || 'N/A'}`);
    console.log(`        Name: ${companyRef.name || 'N/A'}`);
    console.log(`        Role: ${companyRef.role || 'N/A'}`);
    console.log(`        Joined At: ${companyRef.joinedAt ? new Date(companyRef.joinedAt.toMillis ? companyRef.joinedAt.toMillis() : companyRef.joinedAt).toISOString() : 'N/A'}`);
  });
  
  return userData.companies || [];
}

/**
 * Check employeeRefs subcollection
 */
async function checkEmployeeRefs(db, companyId, userId, label) {
  console.log(`\n👥 Checking employeeRefs for company ${companyId} in ${label} Firebase...`);
  
  try {
    const employeeRefsSnapshot = await db.collection('companies')
      .doc(companyId)
      .collection('employeeRefs')
      .where('id', '==', userId)
      .get();
    
    if (employeeRefsSnapshot.empty) {
      console.log(`  ⚠️  No employeeRef found for userId=${userId}`);
      return null;
    }
    
    const employeeRef = employeeRefsSnapshot.docs[0];
    const data = employeeRef.data();
    console.log(`  ✅ Found employeeRef:`);
    console.log(`     ID: ${employeeRef.id}`);
    console.log(`     Name: ${data.firstname || ''} ${data.lastname || ''}`);
    console.log(`     Email: ${data.email || 'N/A'}`);
    console.log(`     Role: ${data.role || 'N/A'}`);
    console.log(`     Deleted: ${data.deleted || false}`);
    
    return data;
  } catch (error) {
    console.log(`  ❌ Error checking employeeRefs: ${error.message}`);
    return null;
  }
}

/**
 * Compare and diagnose
 */
function diagnoseIssues(oldUserInfo, newUserInfo, oldCompanies, newCompanies, oldUserCompanies, newUserCompanies) {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 DIAGNOSIS');
  console.log('='.repeat(80) + '\n');
  
  const issues = [];
  const recommendations = [];
  
  // Issue 1: User document exists in old but not in new
  if (oldUserInfo.userDoc && !newUserInfo.userDoc) {
    issues.push({
      severity: 'CRITICAL',
      issue: 'User document missing in new Firebase',
      description: `User document exists in old Firebase (ID: ${oldUserInfo.userId}) but not in new Firebase`,
      fix: `Create user document in new Firebase with ID: ${newUserInfo.authUid || 'NEW_ID'}`
    });
  }
  
  // Issue 2: Auth user exists but Firestore user doesn't
  if (newUserInfo.authUser && !newUserInfo.userDoc) {
    issues.push({
      severity: 'CRITICAL',
      issue: 'Auth user exists but Firestore user document missing',
      description: `Firebase Auth user exists (UID: ${newUserInfo.authUid}) but Firestore user document is missing`,
      fix: `Create Firestore user document with ID matching Auth UID: ${newUserInfo.authUid}`
    });
  }
  
  // Issue 3: User exists but has no companies in new Firebase
  if (newUserInfo.userDoc && newCompanies.length === 0 && oldCompanies.length > 0) {
    issues.push({
      severity: 'HIGH',
      issue: 'User has no associated companies in new Firebase',
      description: `User has ${oldCompanies.length} company(ies) in old Firebase but 0 in new Firebase`,
      fix: `Add company references to user.companies[] array`
    });
  }
  
  // Issue 4: Companies exist but not linked to user
  if (newUserInfo.userDoc && newCompanies.length > 0 && newUserCompanies.length === 0) {
    issues.push({
      severity: 'HIGH',
      issue: 'Companies exist but not in user.companies[] array',
      description: `Found ${newCompanies.length} company(ies) related to user but user.companies[] is empty`,
      fix: `Add companies to user.companies[] array`
    });
  }
  
  // Issue 5: Company userId field doesn't match user ID
  if (newUserInfo.userDoc && newCompanies.length > 0) {
    newCompanies.forEach(company => {
      if (company.userId !== newUserInfo.userId && company.userId !== newUserInfo.authUid) {
        issues.push({
          severity: 'MEDIUM',
          issue: `Company ${company.companyId} has incorrect userId`,
          description: `Company has userId=${company.userId} but user ID is ${newUserInfo.userId || newUserInfo.authUid}`,
          fix: `Update company.userId to ${newUserInfo.userId || newUserInfo.authUid}`
        });
      }
    });
  }
  
  // Issue 6: Missing employeeRefs (will be checked separately in main function)
  
  // Print issues
  if (issues.length === 0) {
    console.log('✅ No issues found! User-company relationship looks correct.\n');
  } else {
    console.log(`❌ Found ${issues.length} issue(s):\n`);
    issues.forEach((issue, index) => {
      console.log(`${index + 1}. [${issue.severity}] ${issue.issue}`);
      console.log(`   Description: ${issue.description}`);
      console.log(`   Fix: ${issue.fix}\n`);
    });
  }
  
  return { issues, recommendations };
}

/**
 * Propose fix script
 */
function generateFixScript(oldUserInfo, newUserInfo, oldCompanies, newCompanies, oldUserCompanies, newUserCompanies, issues) {
  if (!proposeFix) return;
  
  console.log('\n' + '='.repeat(80));
  console.log('🔧 PROPOSED FIX SCRIPT');
  console.log('='.repeat(80) + '\n');
  
  const fixSteps = [];
  
  // Step 1: Create user document if missing
  if (!newUserInfo.userDoc && newUserInfo.authUser) {
    fixSteps.push({
      step: 1,
      action: 'Create Firestore user document',
      code: `
// Create user document
const userData = {
  id: '${newUserInfo.authUid}',
  firstname: '${oldUserInfo.userData?.firstname || ''}',
  lastname: '${oldUserInfo.userData?.lastname || ''}',
  email: '${email}',
  phone: '${oldUserInfo.userData?.phone || ''}',
  photoURL: ${oldUserInfo.userData?.photoURL ? `'${oldUserInfo.userData.photoURL}'` : 'null'},
  createdAt: admin.firestore.Timestamp.now(),
  updatedAt: admin.firestore.Timestamp.now(),
  companies: [],
  status: 'active'
};

await newDb.collection('users').doc('${newUserInfo.authUid}').set(userData);
`
    });
  }
  
  // Step 2: Add companies to user.companies[] array
  if (newUserInfo.userDoc && newCompanies.length > 0 && newUserCompanies.length === 0) {
    const companiesToAdd = newCompanies.map(company => {
      const oldCompanyRef = oldUserCompanies.find(c => 
        c.companyId === company.companyId || 
        (oldCompanies.find(oc => oc.companyId === company.companyId) && 
         oldUserCompanies.find(c => c.name === company.name))
      );
      
      return {
        companyId: company.companyId,
        name: company.name,
        description: oldCompanyRef?.description || '',
        logo: oldCompanyRef?.logo || '',
        role: oldCompanyRef?.role || 'owner',
        joinedAt: oldCompanyRef?.joinedAt || admin.firestore.Timestamp.now()
      };
    });
    
    fixSteps.push({
      step: fixSteps.length + 1,
      action: 'Add companies to user.companies[] array',
      code: `
// Add companies to user.companies[] array
const companiesToAdd = ${JSON.stringify(companiesToAdd, null, 2)};

await newDb.collection('users').doc('${newUserInfo.userId || newUserInfo.authUid}').update({
  companies: admin.firestore.FieldValue.arrayUnion(...companiesToAdd),
  updatedAt: admin.firestore.Timestamp.now()
});
`
    });
  }
  
  // Step 3: Update company.userId fields
  if (newUserInfo.userDoc && newCompanies.length > 0) {
    const companiesToUpdate = newCompanies.filter(company => 
      company.userId !== newUserInfo.userId && company.userId !== newUserInfo.authUid
    );
    
    if (companiesToUpdate.length > 0) {
      fixSteps.push({
        step: fixSteps.length + 1,
        action: 'Update company.userId fields',
        code: `
// Update company.userId fields
const batch = newDb.batch();

${companiesToUpdate.map(company => `
batch.update(newDb.collection('companies').doc('${company.companyId}'), {
  userId: '${newUserInfo.userId || newUserInfo.authUid}',
  updatedAt: admin.firestore.Timestamp.now()
});
`).join('')}

await batch.commit();
`
      });
    }
  }
  
  // Step 4: Create employeeRefs
  if (newUserInfo.userDoc && newCompanies.length > 0) {
    // Determine role from old data or default to 'owner'
    const defaultRole = oldUserCompanies.length > 0 
      ? oldUserCompanies[0].role || 'owner'
      : 'owner';
    
    fixSteps.push({
      step: fixSteps.length + 1,
      action: 'Create employeeRefs subcollection entries',
      code: `
// Create employeeRefs
const batch = newDb.batch();

${newCompanies.map(company => {
  const oldCompanyRef = oldUserCompanies.find(c => 
    c.companyId === company.companyId || 
    (oldCompanies.find(oc => oc.companyId === company.companyId) && 
     oldUserCompanies.find(c => c.name === company.name))
  );
  const role = oldCompanyRef?.role || defaultRole;
  
  return `
batch.set(
  newDb.collection('companies').doc('${company.companyId}').collection('employeeRefs').doc('${newUserInfo.userId || newUserInfo.authUid}'),
  {
    id: '${newUserInfo.userId || newUserInfo.authUid}',
    firstname: '${(newUserInfo.userData?.firstname || oldUserInfo.userData?.firstname || '').replace(/'/g, "\\'")}',
    lastname: '${(newUserInfo.userData?.lastname || oldUserInfo.userData?.lastname || '').replace(/'/g, "\\'")}',
    email: '${email}',
    role: '${role}',
    deleted: false,
    addedAt: admin.firestore.Timestamp.now()
  }
);`;
}).join('')}

await batch.commit();
`
    });
  }
  
  // Step 5: Update company.employees{} object
  if (newUserInfo.userDoc && newCompanies.length > 0) {
    fixSteps.push({
      step: fixSteps.length + 1,
      action: 'Update company.employees{} object',
      code: `
// Update company.employees{} object
const batch = newDb.batch();

${newCompanies.map(company => {
  const oldCompanyRef = oldUserCompanies.find(c => 
    c.companyId === company.companyId || 
    (oldCompanies.find(oc => oc.companyId === company.companyId) && 
     oldUserCompanies.find(c => c.name === company.name))
  );
  const role = oldCompanyRef?.role || 'owner';
  
  return `
batch.update(newDb.collection('companies').doc('${company.companyId}'), {
  ['employees.${newUserInfo.userId || newUserInfo.authUid}']: {
    firstname: '${(newUserInfo.userData?.firstname || oldUserInfo.userData?.firstname || '').replace(/'/g, "\\'")}',
    lastname: '${(newUserInfo.userData?.lastname || oldUserInfo.userData?.lastname || '').replace(/'/g, "\\'")}',
    email: '${email}',
    role: '${role}'
  },
  updatedAt: admin.firestore.Timestamp.now()
});`;
}).join('')}

await batch.commit();
`
    });
  }
  
  // Print fix steps
  if (fixSteps.length === 0) {
    console.log('✅ No fixes needed!\n');
  } else {
    console.log(`📝 Proposed ${fixSteps.length} fix step(s):\n`);
    fixSteps.forEach((fix, index) => {
      console.log(`Step ${fix.step}: ${fix.action}`);
      console.log('```javascript');
      console.log(fix.code.trim());
      console.log('```\n');
    });
    
    // Generate complete fix script
    const fixScript = `
/**
 * Fix User-Company Relationship for ${email}
 * Generated by diagnoseUserCompanyRelationship.cjs
 * Date: ${new Date().toISOString()}
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize new Firebase
const newServiceAccount = require(path.join(__dirname, '..', '${newServiceAccountPath}'));
const newApp = admin.initializeApp({
  credential: admin.credential.cert(newServiceAccount)
}, 'new-firebase-fix');

const newDb = newApp.firestore();

async function fixUserCompanyRelationship() {
  try {
    console.log('🔧 Starting fix...\\n');
    
${fixSteps.map(fix => `    // ${fix.action}\n${fix.code.trim().split('\n').map(line => '    ' + line).join('\n')}\n`).join('    \n')}
    console.log('✅ Fix completed successfully!\\n');
  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
}

fixUserCompanyRelationship();
`;
    
    const fixScriptPath = path.join(__dirname, `fix-user-company-${Date.now()}.cjs`);
    fs.writeFileSync(fixScriptPath, fixScript);
    console.log(`💾 Complete fix script saved to: ${fixScriptPath}\n`);
    console.log('📋 To apply the fix, run:');
    console.log(`   node ${path.basename(fixScriptPath)}\n`);
  }
}

/**
 * Check all employeeRefs and collect results
 */
async function checkAllEmployeeRefs(db, companies, userId, label) {
  const employeeRefsResults = {};
  
  for (const company of companies) {
    const employeeRef = await checkEmployeeRefs(db, company.companyId, userId, label);
    employeeRefsResults[company.companyId] = employeeRef;
  }
  
  return employeeRefsResults;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║  User-Company Relationship Diagnostic Tool                                 ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');
    console.log(`📧 Email: ${email}\n`);
    
    // Initialize Firebase
    initializeFirebase();
    
    // Get user info from old Firebase
    console.log('📊 OLD FIREBASE ANALYSIS');
    console.log('='.repeat(80));
    const oldUserInfo = await getUserByEmail(oldDb, oldAuth, email, 'OLD');
    const oldCompanies = await getRelatedCompanies(oldDb, oldUserInfo.userId, oldUserInfo.authUid, email, 'OLD');
    const oldUserCompanies = checkUserCompaniesArray(oldUserInfo.userData, 'OLD');
    
    // Check employeeRefs in old Firebase
    let oldEmployeeRefs = {};
    if (oldUserInfo.userDoc && oldCompanies.length > 0) {
      console.log('\n👥 Checking employeeRefs in OLD Firebase...');
      oldEmployeeRefs = await checkAllEmployeeRefs(oldDb, oldCompanies, oldUserInfo.userId || oldUserInfo.authUid, 'OLD');
    }
    
    // Get user info from new Firebase
    console.log('\n\n📊 NEW FIREBASE ANALYSIS');
    console.log('='.repeat(80));
    const newUserInfo = await getUserByEmail(newDb, newAuth, email, 'NEW');
    const newCompanies = await getRelatedCompanies(newDb, newUserInfo.userId, newUserInfo.authUid, email, 'NEW');
    const newUserCompanies = checkUserCompaniesArray(newUserInfo.userData, 'NEW');
    
    // Check employeeRefs for each company in new Firebase
    let newEmployeeRefs = {};
    if (newUserInfo.userDoc && newCompanies.length > 0) {
      console.log('\n👥 Checking employeeRefs in NEW Firebase...');
      newEmployeeRefs = await checkAllEmployeeRefs(newDb, newCompanies, newUserInfo.userId || newUserInfo.authUid, 'NEW');
    }
    
    // Diagnose issues
    const { issues, recommendations } = diagnoseIssues(
      oldUserInfo,
      newUserInfo,
      oldCompanies,
      newCompanies,
      oldUserCompanies,
      newUserCompanies
    );
    
    // Check for missing employeeRefs
    if (newUserInfo.userDoc && newCompanies.length > 0) {
      newCompanies.forEach(company => {
        if (!newEmployeeRefs[company.companyId]) {
          issues.push({
            severity: 'MEDIUM',
            issue: `Missing employeeRef for company ${company.companyId}`,
            description: `Company exists but employeeRef subcollection entry is missing`,
            fix: `Create employeeRef in companies/${company.companyId}/employeeRefs/${newUserInfo.userId || newUserInfo.authUid}`
          });
        }
      });
    }
    
    // Re-print issues if we found more
    if (issues.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('🔍 UPDATED DIAGNOSIS');
      console.log('='.repeat(80) + '\n');
      console.log(`❌ Found ${issues.length} issue(s):\n`);
      issues.forEach((issue, index) => {
        console.log(`${index + 1}. [${issue.severity}] ${issue.issue}`);
        console.log(`   Description: ${issue.description}`);
        console.log(`   Fix: ${issue.fix}\n`);
      });
    }
    
    // Generate fix script if requested
    if (proposeFix) {
      generateFixScript(
        oldUserInfo,
        newUserInfo,
        oldCompanies,
        newCompanies,
        oldUserCompanies,
        newUserCompanies,
        issues
      );
    } else {
      console.log('\n💡 To generate a fix script, run with --propose-fix flag\n');
    }
    
    console.log('✅ Diagnostic completed!\n');
    
  } catch (error) {
    console.error('\n❌ Diagnostic failed:', error);
    process.exit(1);
  }
}

// Run
main();

