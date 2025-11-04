const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    // Add your Firebase project configuration here
  });
}

const db = admin.firestore();

/**
 * Provision Firebase Auth users for existing employees
 * This script creates Firebase Auth users for employees that don't have firebaseUid
 */
async function provisionEmployeeUsers(companyId = null) {
  try {
    console.log('Starting employee user provisioning...');
    
    let companiesQuery = db.collection('companies');
    
    // If specific company ID provided, only process that company
    if (companyId) {
      companiesQuery = companiesQuery.where(admin.firestore.FieldPath.documentId(), '==', companyId);
    }
    
    const companiesSnapshot = await companiesQuery.get();
    
    if (companiesSnapshot.empty) {
      console.log('No companies found to process.');
      return;
    }
    
    let totalProvisioned = 0;
    let totalCompanies = 0;
    let totalErrors = 0;
    
    for (const companyDoc of companiesSnapshot.docs) {
      const companyId = companyDoc.id;
      const companyData = companyDoc.data();
      const employees = companyData.employees || {};
      
      console.log(`Processing company: ${companyData.name || companyId}`);
      
      let companyProvisioned = 0;
      let companyErrors = 0;
      const updates = {};
      
      // Check each employee and create Firebase Auth user if needed
      for (const [employeeKey, employee] of Object.entries(employees)) {
        if (!employee.firebaseUid && employee.email) {
          try {
            // Generate default password
            const defaultPassword = `${employee.firstname}123${employee.lastname}`;
            
            // Create Firebase Auth user
            const userRecord = await admin.auth().createUser({
              email: employee.email,
              password: defaultPassword,
              displayName: `${employee.firstname} ${employee.lastname}`,
              emailVerified: false
            });
            
            // Update employee with Firebase UID
            updates[`employees.${employeeKey}.firebaseUid`] = userRecord.uid;
            updates[`employees.${employeeKey}.updatedAt`] = admin.firestore.Timestamp.now();
            
            companyProvisioned++;
            console.log(`  ✓ Created Firebase Auth user for: ${employee.firstname} ${employee.lastname} (${employee.email})`);
            
          } catch (authError) {
            companyErrors++;
            console.error(`  ✗ Failed to create user for ${employee.email}:`, authError.message);
            
            // If user already exists, try to get the existing user
            if (authError.code === 'auth/email-already-exists') {
              try {
                const existingUser = await admin.auth().getUserByEmail(employee.email);
                updates[`employees.${employeeKey}.firebaseUid`] = existingUser.uid;
                updates[`employees.${employeeKey}.updatedAt`] = admin.firestore.Timestamp.now();
                companyProvisioned++;
                console.log(`  ✓ Linked existing Firebase Auth user for: ${employee.firstname} ${employee.lastname} (${employee.email})`);
              } catch (getUserError) {
                console.error(`  ✗ Failed to get existing user for ${employee.email}:`, getUserError.message);
              }
            }
          }
        }
      }
      
      // Apply updates if any
      if (companyProvisioned > 0) {
        await companyDoc.ref.update(updates);
        console.log(`  ✓ Provisioned ${companyProvisioned} users for company ${companyData.name || companyId}`);
        totalProvisioned += companyProvisioned;
      } else {
        console.log(`  - No users to provision for company ${companyData.name || companyId}`);
      }
      
      if (companyErrors > 0) {
        console.log(`  ⚠ ${companyErrors} errors for company ${companyData.name || companyId}`);
        totalErrors += companyErrors;
      }
      
      totalCompanies++;
    }
    
    console.log(`\nUser provisioning completed!`);
    console.log(`- Companies processed: ${totalCompanies}`);
    console.log(`- Total users provisioned: ${totalProvisioned}`);
    console.log(`- Total errors: ${totalErrors}`);
    
  } catch (error) {
    console.error('Error during user provisioning:', error);
    throw error;
  }
}

/**
 * Clean up Firebase Auth users for deleted employees
 * This script removes Firebase Auth users for employees that no longer exist
 */
async function cleanupDeletedEmployeeUsers(companyId = null) {
  try {
    console.log('Starting cleanup of deleted employee users...');
    
    let companiesQuery = db.collection('companies');
    
    // If specific company ID provided, only process that company
    if (companyId) {
      companiesQuery = companiesQuery.where(admin.firestore.FieldPath.documentId(), '==', companyId);
    }
    
    const companiesSnapshot = await companiesQuery.get();
    
    if (companiesSnapshot.empty) {
      console.log('No companies found to process.');
      return;
    }
    
    // Get all employee Firebase UIDs
    const employeeUids = new Set();
    
    for (const companyDoc of companiesSnapshot.docs) {
      const companyData = companyDoc.data();
      const employees = companyData.employees || {};
      
      for (const employee of Object.values(employees)) {
        if (employee.firebaseUid) {
          employeeUids.add(employee.firebaseUid);
        }
      }
    }
    
    console.log(`Found ${employeeUids.size} active employee Firebase UIDs`);
    
    // Get all Firebase Auth users
    const listUsersResult = await admin.auth().listUsers();
    let deletedCount = 0;
    
    for (const userRecord of listUsersResult.users) {
      // Check if this user is not in our employee list
      if (!employeeUids.has(userRecord.uid)) {
        // Check if this user has a company-related email or display name
        const email = userRecord.email || '';
        const displayName = userRecord.displayName || '';
        
        // Only delete users that look like employees (have company-related patterns)
        if (email.includes('@') && (displayName.includes(' ') || email.includes('employee'))) {
          try {
            await admin.auth().deleteUser(userRecord.uid);
            deletedCount++;
            console.log(`  ✓ Deleted Firebase Auth user: ${userRecord.email} (${userRecord.displayName})`);
          } catch (deleteError) {
            console.error(`  ✗ Failed to delete user ${userRecord.email}:`, deleteError.message);
          }
        }
      }
    }
    
    console.log(`\nCleanup completed!`);
    console.log(`- Total users deleted: ${deletedCount}`);
    
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const companyId = args[1] || null;
  
  switch (command) {
    case 'provision':
      await provisionEmployeeUsers(companyId);
      break;
    case 'cleanup':
      await cleanupDeletedEmployeeUsers(companyId);
      break;
    case 'all':
      await provisionEmployeeUsers(companyId);
      await cleanupDeletedEmployeeUsers(companyId);
      break;
    default:
      console.log('Usage:');
      console.log('  node provisionEmployeeUsers.js provision [companyId]');
      console.log('  node provisionEmployeeUsers.js cleanup [companyId]');
      console.log('  node provisionEmployeeUsers.js all [companyId]');
      console.log('');
      console.log('Commands:');
      console.log('  provision - Create Firebase Auth users for employees');
      console.log('  cleanup   - Remove Firebase Auth users for deleted employees');
      console.log('  all       - Run both provision and cleanup');
      console.log('');
      console.log('Optional companyId parameter limits operation to specific company');
      break;
  }
  
  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  provisionEmployeeUsers,
  cleanupDeletedEmployeeUsers
};
