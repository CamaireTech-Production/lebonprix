/**
 * Verify User Login Readiness
 * 
 * This script checks if a user's data is correctly set up for login redirection.
 * It verifies what the login code expects vs what's actually in the database.
 * 
 * Usage:
 *   node scripts/verifyUserLoginReadiness.cjs \
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

/**
 * Main verification function
 */
async function verifyUserLoginReadiness() {
  try {
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║  Verify User Login Readiness                                                ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');
    console.log(`📧 Email: ${email}\n`);
    
    // 1. Find user
    console.log('🔍 Finding user...\n');
    const usersSnapshot = await db.collection('users')
      .where('email', '==', email.toLowerCase().trim())
      .get();
    
    if (usersSnapshot.empty) {
      throw new Error(`User not found: ${email}`);
    }
    
    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    const userId = userDoc.id;
    
    console.log(`✅ Found user: ${userId}`);
    console.log(`   Name: ${userData.firstname || ''} ${userData.lastname || ''}`);
    console.log(`   Email: ${userData.email || 'N/A'}`);
    console.log(`   Status: ${userData.status || 'N/A'}\n`);
    
    // 2. Check what login code expects
    console.log('📋 LOGIN CODE REQUIREMENTS:');
    console.log('='.repeat(80));
    console.log('The login code checks:');
    console.log('  1. if (userData.companies && userData.companies.length > 0)');
    console.log('  2. Find company where role === "owner" || role === "admin"');
    console.log('  3. If found → navigate to dashboard');
    console.log('  4. If not found → navigate to /mode-selection\n');
    
    // 3. Check actual user data
    console.log('📊 ACTUAL USER DATA:');
    console.log('='.repeat(80));
    
    const companies = userData.companies || [];
    console.log(`   companies array exists: ${userData.companies !== undefined}`);
    console.log(`   companies array length: ${companies.length}\n`);
    
    if (companies.length === 0) {
      console.log('❌ PROBLEM: companies array is empty or missing!\n');
      console.log('   This will cause redirect to /mode-selection\n');
      return;
    }
    
    console.log(`✅ Companies array has ${companies.length} company(ies):\n`);
    
    let hasOwnerOrAdmin = false;
    
    companies.forEach((company, index) => {
      console.log(`   Company ${index + 1}:`);
      console.log(`      companyId: ${company.companyId || 'MISSING ❌'}`);
      console.log(`      name: ${company.name || 'MISSING ❌'}`);
      console.log(`      role: ${company.role || 'MISSING ❌'}`);
      
      // Check if role is owner or admin
      const isOwnerOrAdmin = company.role === 'owner' || company.role === 'admin';
      if (isOwnerOrAdmin) {
        hasOwnerOrAdmin = true;
        console.log(`      ✅ Role is owner/admin - WILL REDIRECT TO DASHBOARD`);
      } else {
        console.log(`      ⚠️  Role is "${company.role}" - NOT owner/admin`);
      }
      
      // Check other fields
      if (company.joinedAt) {
        const joinedAt = company.joinedAt.toDate ? company.joinedAt.toDate() : company.joinedAt;
        console.log(`      joinedAt: ${joinedAt.toISOString()}`);
      } else {
        console.log(`      joinedAt: MISSING ⚠️`);
      }
      
      if (company.description) {
        console.log(`      description: ${company.description.substring(0, 50)}...`);
      }
      
      if (company.logo) {
        console.log(`      logo: ${company.logo.substring(0, 50)}...`);
      }
      
      if (company.permissionTemplateId) {
        console.log(`      permissionTemplateId: ${company.permissionTemplateId}`);
      }
      
      console.log('');
    });
    
    // 4. Final verdict
    console.log('\n' + '='.repeat(80));
    console.log('🎯 VERDICT:');
    console.log('='.repeat(80) + '\n');
    
    if (companies.length === 0) {
      console.log('❌ LOGIN WILL REDIRECT TO: /mode-selection');
      console.log('   Reason: companies array is empty\n');
    } else if (!hasOwnerOrAdmin) {
      console.log('❌ LOGIN WILL REDIRECT TO: /companies/me/{userId}');
      console.log('   Reason: No company with role "owner" or "admin" found\n');
      console.log('   Companies found but roles are:');
      companies.forEach((c, i) => {
        console.log(`      ${i + 1}. ${c.name || 'N/A'}: role="${c.role || 'MISSING'}"`);
      });
      console.log('');
    } else {
      console.log('✅ LOGIN WILL REDIRECT TO: /company/{companyId}/dashboard');
      console.log('   Reason: Found company with role "owner" or "admin"\n');
      
      // Show which company will be used
      const ownerOrAdminCompany = companies.find(c => 
        c.role === 'owner' || c.role === 'admin'
      );
      if (ownerOrAdminCompany) {
        console.log('   Company that will be used:');
        console.log(`      Name: ${ownerOrAdminCompany.name}`);
        console.log(`      ID: ${ownerOrAdminCompany.companyId}`);
        console.log(`      Role: ${ownerOrAdminCompany.role}\n`);
      }
    }
    
    // 5. Check if company document exists
    if (companies.length > 0) {
      console.log('🔍 VERIFYING COMPANY DOCUMENTS:');
      console.log('='.repeat(80) + '\n');
      
      for (const company of companies) {
        if (!company.companyId) {
          console.log(`❌ Company "${company.name || 'N/A'}" has no companyId!\n`);
          continue;
        }
        
        try {
          const companyDoc = await db.collection('companies').doc(company.companyId).get();
          
          if (companyDoc.exists()) {
            const companyData = companyDoc.data();
            console.log(`✅ Company document exists: ${company.companyId}`);
            console.log(`   Name: ${companyData.name || 'N/A'}`);
            console.log(`   Matches user.companies[].name: ${companyData.name === company.name ? '✅' : '❌'}\n`);
          } else {
            console.log(`❌ Company document NOT FOUND: ${company.companyId}`);
            console.log(`   This will cause errors when trying to load company data!\n`);
          }
        } catch (error) {
          console.log(`❌ Error checking company ${company.companyId}: ${error.message}\n`);
        }
      }
    }
    
    console.log('✅ Verification completed!\n');
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run
verifyUserLoginReadiness();

