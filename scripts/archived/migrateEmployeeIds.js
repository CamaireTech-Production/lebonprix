const admin = require('firebase-admin');
const { generateEmployeeId } = require('../src/utils/security');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    // Add your Firebase project configuration here
  });
}

const db = admin.firestore();

/**
 * Migrate existing employees to add unique IDs
 * This script adds an 'id' field to existing employees that don't have one
 */
async function migrateEmployeeIds(companyId = null) {
  try {
    console.log('Starting employee ID migration...');
    
    let companiesQuery = db.collection('companies');
    
    // If specific company ID provided, only migrate that company
    if (companyId) {
      companiesQuery = companiesQuery.where(admin.firestore.FieldPath.documentId(), '==', companyId);
    }
    
    const companiesSnapshot = await companiesQuery.get();
    
    if (companiesSnapshot.empty) {
      console.log('No companies found to migrate.');
      return;
    }
    
    let totalMigrated = 0;
    let totalCompanies = 0;
    
    for (const companyDoc of companiesSnapshot.docs) {
      const companyId = companyDoc.id;
      const companyData = companyDoc.data();
      const employees = companyData.employees || {};
      
      console.log(`Processing company: ${companyData.name || companyId}`);
      
      let companyMigrated = 0;
      const updates = {};
      
      // Check each employee and add ID if missing
      for (const [employeeKey, employee] of Object.entries(employees)) {
        if (!employee.id) {
          const newId = generateEmployeeId();
          updates[`employees.${employeeKey}.id`] = newId;
          updates[`employees.${employeeKey}.createdAt`] = admin.firestore.Timestamp.now();
          updates[`employees.${employeeKey}.updatedAt`] = admin.firestore.Timestamp.now();
          companyMigrated++;
          console.log(`  - Added ID for employee: ${employee.firstname} ${employee.lastname} (${employee.email})`);
        }
      }
      
      // Apply updates if any
      if (companyMigrated > 0) {
        await companyDoc.ref.update(updates);
        console.log(`  ✓ Migrated ${companyMigrated} employees for company ${companyData.name || companyId}`);
        totalMigrated += companyMigrated;
      } else {
        console.log(`  - No employees to migrate for company ${companyData.name || companyId}`);
      }
      
      totalCompanies++;
    }
    
    console.log(`\nMigration completed!`);
    console.log(`- Companies processed: ${totalCompanies}`);
    console.log(`- Total employees migrated: ${totalMigrated}`);
    
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
}

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
    
    for (const companyDoc of companiesSnapshot.docs) {
      const companyId = companyDoc.id;
      const companyData = companyDoc.data();
      const employees = companyData.employees || {};
      
      console.log(`Processing company: ${companyData.name || companyId}`);
      
      let companyProvisioned = 0;
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
            console.log(`  - Created Firebase Auth user for: ${employee.firstname} ${employee.lastname} (${employee.email})`);
            
          } catch (authError) {
            console.error(`  ✗ Failed to create user for ${employee.email}:`, authError.message);
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
      
      totalCompanies++;
    }
    
    console.log(`\nUser provisioning completed!`);
    console.log(`- Companies processed: ${totalCompanies}`);
    console.log(`- Total users provisioned: ${totalProvisioned}`);
    
  } catch (error) {
    console.error('Error during user provisioning:', error);
    throw error;
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const companyId = args[1] || null;
  
  switch (command) {
    case 'migrate-ids':
      await migrateEmployeeIds(companyId);
      break;
    case 'provision-users':
      await provisionEmployeeUsers(companyId);
      break;
    case 'migrate-all':
      await migrateEmployeeIds(companyId);
      await provisionEmployeeUsers(companyId);
      break;
    default:
      console.log('Usage:');
      console.log('  node migrateEmployeeIds.js migrate-ids [companyId]');
      console.log('  node migrateEmployeeIds.js provision-users [companyId]');
      console.log('  node migrateEmployeeIds.js migrate-all [companyId]');
      console.log('');
      console.log('Commands:');
      console.log('  migrate-ids     - Add unique IDs to existing employees');
      console.log('  provision-users - Create Firebase Auth users for employees');
      console.log('  migrate-all     - Run both migrations');
      console.log('');
      console.log('Optional companyId parameter limits migration to specific company');
      break;
  }
  
  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  migrateEmployeeIds,
  provisionEmployeeUsers
};
