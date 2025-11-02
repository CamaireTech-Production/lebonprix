/**
 * Quick Fix Script: Add Missing ID Fields to Companies
 * 
 * This script adds the missing 'id' field to all company documents
 * to ensure they match their document IDs for consistency.
 * 
 * Usage: node scripts/fixCompanyIds.cjs
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

/**
 * Fix missing id fields in companies
 */
async function fixCompanyIds() {
  console.log('🔧 Correction des champs ID manquants dans les entreprises...\n');
  
  const fixReport = {
    startTime: new Date().toISOString(),
    companiesFixed: 0,
    companiesAlreadyFixed: 0,
    errors: []
  };
  
  try {
    // Get all companies
    const companiesSnapshot = await db.collection('companies').get();
    console.log(`📋 ${companiesSnapshot.size} entreprises trouvées\n`);
    
    for (const companyDoc of companiesSnapshot.docs) {
      const companyId = companyDoc.id;
      const companyData = companyDoc.data();
      
      console.log(`🏢 Traitement: ${companyData.name} (${companyId})`);
      
      // Check if id field is missing
      if (!companyData.id) {
        console.log('   ❌ Champ id manquant, ajout en cours...');
        
        const now = admin.firestore.Timestamp.now();
        
        await db.collection('companies').doc(companyId).update({
          id: companyId,  // Document ID = Data ID
          updatedAt: now
        });
        
        console.log('   ✅ Champ id ajouté');
        fixReport.companiesFixed++;
      } else {
        console.log('   ✅ Champ id déjà présent');
        fixReport.companiesAlreadyFixed++;
      }
      
      console.log('');
    }
    
    // Save report
    fixReport.endTime = new Date().toISOString();
    fixReport.success = true;
    
    const timestamp = Date.now();
    const reportPath = path.join(__dirname, '..', `id-fix-report-${timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(fixReport, null, 2));
    
    console.log('🎉 Correction terminée avec succès!\n');
    console.log('📊 Résumé:');
    console.log(`   ✅ Entreprises corrigées: ${fixReport.companiesFixed}`);
    console.log(`   ℹ️  Entreprises déjà correctes: ${fixReport.companiesAlreadyFixed}`);
    console.log(`   ❌ Erreurs: ${fixReport.errors.length}\n`);
    console.log(`📄 Rapport: ${reportPath}\n`);
    
  } catch (error) {
    console.error('❌ Erreur lors de la correction:', error);
    fixReport.errors.push({
      error: error.message,
      stack: error.stack
    });
    
    const timestamp = Date.now();
    const reportPath = path.join(__dirname, '..', `id-fix-error-${timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(fixReport, null, 2));
    
    throw error;
  }
}

/**
 * Verify the fix
 */
async function verifyFix() {
  console.log('🔍 Vérification de la correction...\n');
  
  const companiesSnapshot = await db.collection('companies').get();
  
  let companiesWithId = 0;
  let companiesWithoutId = 0;
  
  companiesSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`🏢 ${data.name} (${doc.id})`);
    console.log(`   Document ID: ${doc.id}`);
    console.log(`   Data.id: ${data.id || 'MISSING!'}`);
    console.log(`   Match: ${data.id === doc.id ? '✅' : '❌'}`);
    console.log('');
    
    if (data.id && data.id === doc.id) {
      companiesWithId++;
    } else {
      companiesWithoutId++;
    }
  });
  
  console.log(`📊 Résumé de la vérification:`);
  console.log(`   ✅ Entreprises avec ID correct: ${companiesWithId}`);
  console.log(`   ❌ Entreprises sans ID: ${companiesWithoutId}`);
  
  if (companiesWithoutId === 0) {
    console.log('\n🎉 Toutes les entreprises ont maintenant un champ ID correct!');
  } else {
    console.log('\n⚠️ Certaines entreprises n\'ont toujours pas de champ ID.');
  }
}

/**
 * Point d'entrée
 */
async function main() {
  try {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║  Correction: Ajout des champs ID manquants          ║');
    console.log('║  (Document ID = Data ID pour cohérence)              ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
    
    await fixCompanyIds();
    await verifyFix();
    
    console.log('\n✅ Correction réussie!');
    console.log('📝 Toutes les entreprises ont maintenant une structure cohérente.\n');
    
  } catch (error) {
    console.error('❌ Correction échouée:', error);
    process.exit(1);
  }
}

// Exécuter le script
if (require.main === module) {
  main();
}

module.exports = {
  fixCompanyIds,
  verifyFix
};
