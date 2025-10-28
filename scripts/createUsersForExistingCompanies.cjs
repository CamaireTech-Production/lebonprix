/**
 * Simple Migration Script: Create Users for Existing Companies
 * 
 * This script creates User documents for existing company owners
 * WITHOUT changing any company IDs or related data.
 * 
 * - Existing companies keep their Firebase Auth UID as company ID
 * - New companies (created after migration) will use generated IDs
 * 
 * Usage: node scripts/createUsersForExistingCompanies.cjs
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Configuration Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require('../firebase-service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Helper: Parse full name into firstname and lastname
function parseFullName(fullName) {
  if (!fullName) return { firstname: '', lastname: '' };
  
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) {
    return { firstname: parts[0], lastname: '' };
  }
  
  return {
    firstname: parts[0],
    lastname: parts.slice(1).join(' ')
  };
}

/**
 * Main migration: Create users for existing companies
 */
async function createUsersForExistingCompanies() {
  console.log('🚀 Création des utilisateurs pour les entreprises existantes...\n');
  
  const migrationReport = {
    startTime: new Date().toISOString(),
    usersCreated: 0,
    companiesUpdated: 0,
    errors: []
  };
  
  try {
    // Get all existing companies
    const companiesSnapshot = await db.collection('companies').get();
    console.log(`📋 ${companiesSnapshot.size} entreprises trouvées\n`);
    
    for (const companyDoc of companiesSnapshot.docs) {
      const companyId = companyDoc.id;
      const companyData = companyDoc.data();
      
      console.log(`🏢 Traitement: ${companyData.name} (${companyId})`);
      
      // Check if this is a legacy company (ID = Firebase Auth UID)
      // Firebase Auth UIDs are 28 characters
      const isLegacyCompany = companyId.length === 28;
      
      if (!isLegacyCompany) {
        console.log('   ✅ Entreprise déjà migrée (ID généré), passage...\n');
        continue;
      }
      
      const now = admin.firestore.Timestamp.now();
      const firebaseAuthUid = companyId; // For legacy companies, company ID = Auth UID
      
      // Step 1: Check if user already exists
      const userDoc = await db.collection('users').doc(firebaseAuthUid).get();
      
      if (userDoc.exists) {
        console.log('   ℹ️  Utilisateur existe déjà');
        
        // Check if company is already in user's companies array
        const userData = userDoc.data();
        const hasCompany = userData.companies?.some(c => c.companyId === companyId);
        
        if (!hasCompany) {
          console.log('   🔗 Ajout de l\'entreprise à l\'utilisateur existant...');
          await db.collection('users').doc(firebaseAuthUid).update({
            companies: admin.firestore.FieldValue.arrayUnion({
              companyId: companyId,
              name: companyData.name,
              description: companyData.description,
              logo: companyData.logo,
              role: 'owner',
              joinedAt: companyData.createdAt || now
            }),
            updatedAt: now
          });
          console.log('   ✅ Entreprise ajoutée à l\'utilisateur');
        }
      } else {
        console.log('   👤 Création du document utilisateur...');
        
        // Parse name
        const parsedName = parseFullName(companyData.name);
        
        // Create user document
        const userData = {
          id: firebaseAuthUid,
          firstname: parsedName.firstname,
          lastname: parsedName.lastname,
          email: companyData.email || '',
          phone: companyData.phone || '',
          photoURL: null,
          createdAt: companyData.createdAt || now,
          updatedAt: now,
          companies: [{
            companyId: companyId, // Same as Firebase Auth UID for legacy companies
            name: companyData.name,
            description: companyData.description,
            logo: companyData.logo,
            role: 'owner',
            joinedAt: companyData.createdAt || now
          }],
          status: 'active',
          lastLogin: companyData.updatedAt || now
        };
        
        await db.collection('users').doc(firebaseAuthUid).set(userData);
        console.log('   ✅ Utilisateur créé');
        migrationReport.usersCreated++;
      }
      
      // Step 2: Add userId field to company if missing
      if (!companyData.userId) {
        console.log('   🔧 Ajout du champ userId à l\'entreprise...');
        await db.collection('companies').doc(companyId).update({
          userId: firebaseAuthUid,
          updatedAt: now
        });
        console.log('   ✅ Champ userId ajouté');
        migrationReport.companiesUpdated++;
      }
      
      console.log('   ✅ Migration terminée pour cette entreprise\n');
    }
    
    // Save report
    migrationReport.endTime = new Date().toISOString();
    migrationReport.success = true;
    
    const timestamp = Date.now();
    const reportPath = path.join(__dirname, '..', `simple-migration-report-${timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(migrationReport, null, 2));
    
    console.log('🎉 Migration terminée avec succès!\n');
    console.log('📊 Résumé:');
    console.log(`   ✅ Utilisateurs créés: ${migrationReport.usersCreated}`);
    console.log(`   ✅ Entreprises mises à jour: ${migrationReport.companiesUpdated}`);
    console.log(`   ❌ Erreurs: ${migrationReport.errors.length}\n`);
    console.log(`📄 Rapport: ${reportPath}\n`);
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    migrationReport.errors.push({
      error: error.message,
      stack: error.stack
    });
    
    const timestamp = Date.now();
    const reportPath = path.join(__dirname, '..', `simple-migration-error-${timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(migrationReport, null, 2));
    
    throw error;
  }
}

/**
 * Point d'entrée
 */
async function main() {
  try {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║  Migration Simple: Création d\'Utilisateurs           ║');
    console.log('║  (Préservation des IDs d\'entreprises existantes)     ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
    
    await createUsersForExistingCompanies();
    
    console.log('✅ Migration réussie!\n');
    console.log('📝 Prochaines étapes:');
    console.log('   1. Vérifier les 2 utilisateurs créés dans Firebase Console');
    console.log('   2. Tester la connexion avec les comptes existants');
    console.log('   3. Les nouvelles entreprises utiliseront des IDs générés');
    console.log('   4. Aucun changement nécessaire pour les produits/ventes\n');
    
  } catch (error) {
    console.error('❌ Migration échouée:', error);
    process.exit(1);
  }
}

// Exécuter le script
if (require.main === module) {
  main();
}

module.exports = {
  createUsersForExistingCompanies
};
