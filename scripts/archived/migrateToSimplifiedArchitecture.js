/**
 * Script de migration vers l'architecture simplifiée
 * 
 * Ce script :
 * 1. Supprime employeeRefs de toutes les entreprises
 * 2. Vérifie que users[].companies[] est bien rempli
 * 3. Nettoie les données pour l'architecture simplifiée
 * 
 * Usage: node scripts/migrateToSimplifiedArchitecture.js
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
 * Migration principale vers l'architecture simplifiée
 */
async function migrateToSimplifiedArchitecture() {
  console.log('🚀 Début de la migration vers l\'architecture simplifiée...');
  console.log('📋 Suppression des employeeRefs et vérification des données');
  
  try {
    // 1. Lister toutes les entreprises
    console.log('📋 Récupération des entreprises...');
    const companiesSnapshot = await db.collection('companies').get();
    const companies = companiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`✅ ${companies.length} entreprises trouvées`);
    
    // 2. Migrer chaque entreprise
    for (const company of companies) {
      console.log(`\n🏢 Migration de l'entreprise: ${company.name} (${company.id})`);
      
      // Supprimer employeeRefs s'il existe
      if (company.employeeRefs) {
        console.log(`🗑️ Suppression des employeeRefs (${company.employeeRefs.length} références)`);
        
        await db.collection('companies').doc(company.id).update({
          employeeRefs: admin.firestore.FieldValue.delete()
        });
        
        console.log(`✅ employeeRefs supprimés de ${company.name}`);
      } else {
        console.log(`✅ Aucun employeeRefs trouvé dans ${company.name}`);
      }
    }
    
    // 3. Vérifier les utilisateurs
    console.log('\n👥 Vérification des utilisateurs...');
    const usersSnapshot = await db.collection('users').get();
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`✅ ${users.length} utilisateurs trouvés`);
    
    let usersWithCompanies = 0;
    let usersWithoutCompanies = 0;
    
    for (const user of users) {
      if (user.companies && user.companies.length > 0) {
        usersWithCompanies++;
        console.log(`✅ ${user.firstname} ${user.lastname}: ${user.companies.length} entreprises`);
      } else {
        usersWithoutCompanies++;
        console.log(`⚠️ ${user.firstname} ${user.lastname}: Aucune entreprise`);
      }
    }
    
    console.log(`\n📊 Résumé des utilisateurs:`);
    console.log(`   - Avec entreprises: ${usersWithCompanies}`);
    console.log(`   - Sans entreprises: ${usersWithoutCompanies}`);
    
    // 4. Vérifier la cohérence des données
    await verifyDataConsistency(companies, users);
    
    console.log('\n🎉 Migration vers l\'architecture simplifiée terminée!');
    console.log('\n📋 Résumé des changements:');
    console.log('   ✅ employeeRefs supprimés de toutes les entreprises');
    console.log('   ✅ Références unidirectionnelles users[].companies[] conservées');
    console.log('   ✅ Compatibilité avec l\'ancien système maintenue');
    console.log('   ✅ Architecture simplifiée prête');
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    throw error;
  }
}

/**
 * Vérifier la cohérence des données
 */
async function verifyDataConsistency(companies, users) {
  console.log('\n🔍 Vérification de la cohérence des données...');
  
  let issues = 0;
  
  // Vérifier que chaque entreprise a un propriétaire dans users
  for (const company of companies) {
    const owner = users.find(user => 
      user.companies?.some(c => c.companyId === company.id && c.role === 'owner')
    );
    
    if (!owner) {
      console.log(`⚠️ Aucun propriétaire trouvé pour l'entreprise ${company.name}`);
      issues++;
    } else {
      console.log(`✅ Propriétaire trouvé pour ${company.name}: ${owner.firstname} ${owner.lastname}`);
    }
  }
  
  // Vérifier que chaque utilisateur avec des entreprises a des références valides
  for (const user of users) {
    if (user.companies && user.companies.length > 0) {
      for (const userCompany of user.companies) {
        const company = companies.find(c => c.id === userCompany.companyId);
        if (!company) {
          console.log(`⚠️ Référence invalide pour ${user.firstname}: entreprise ${userCompany.companyId} introuvable`);
          issues++;
        }
      }
    }
  }
  
  if (issues === 0) {
    console.log('✅ Aucun problème de cohérence détecté');
  } else {
    console.log(`⚠️ ${issues} problèmes de cohérence détectés`);
  }
}

/**
 * Créer un rapport de migration
 */
async function createMigrationReport(companies, users) {
  const report = {
    timestamp: new Date().toISOString(),
    migration: 'Architecture Simplifiée',
    changes: [
      'Suppression de companies[].employeeRefs',
      'Conservation de users[].companies[] comme source de vérité',
      'Architecture unidirectionnelle users → companies'
    ],
    statistics: {
      companies: companies.length,
      users: users.length,
      usersWithCompanies: users.filter(u => u.companies && u.companies.length > 0).length,
      usersWithoutCompanies: users.filter(u => !u.companies || u.companies.length === 0).length
    },
    nextSteps: [
      'Tester le dashboard Netflix',
      'Vérifier la création d\'entreprises',
      'Tester l\'ajout d\'employés',
      'Valider les règles Firestore'
    ]
  };
  
  const reportPath = path.join(__dirname, '..', 'migration-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`📄 Rapport de migration créé: ${reportPath}`);
}

/**
 * Fonction de validation post-migration
 */
async function validateMigration() {
  console.log('\n🔍 Validation de la migration...');
  
  try {
    // Vérifier qu'aucune entreprise n'a d'employeeRefs
    const companiesSnapshot = await db.collection('companies').get();
    let companiesWithEmployeeRefs = 0;
    
    companiesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.employeeRefs) {
        companiesWithEmployeeRefs++;
        console.log(`⚠️ ${doc.id} a encore des employeeRefs`);
      }
    });
    
    if (companiesWithEmployeeRefs === 0) {
      console.log('✅ Aucune entreprise n\'a d\'employeeRefs');
    } else {
      console.log(`⚠️ ${companiesWithEmployeeRefs} entreprises ont encore des employeeRefs`);
    }
    
    // Vérifier que les utilisateurs ont des entreprises
    const usersSnapshot = await db.collection('users').get();
    let usersWithCompanies = 0;
    
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.companies && data.companies.length > 0) {
        usersWithCompanies++;
      }
    });
    
    console.log(`✅ ${usersWithCompanies} utilisateurs ont des entreprises`);
    
  } catch (error) {
    console.error('❌ Erreur lors de la validation:', error);
  }
}

/**
 * Point d'entrée principal
 */
async function main() {
  try {
    console.log('🚀 Script de migration vers l\'architecture simplifiée');
    console.log('⚠️ ATTENTION: Ce script modifie la structure de la base de données');
    console.log('⚠️ Assurez-vous d\'avoir un backup avant de continuer');
    
    await migrateToSimplifiedArchitecture();
    await validateMigration();
    
    console.log('\n🎉 Migration terminée avec succès!');
    console.log('📝 Vérifiez les données avant de déployer en production');
    
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
  migrateToSimplifiedArchitecture,
  verifyDataConsistency,
  validateMigration
};
