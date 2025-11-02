#!/usr/bin/env node

/**
 * Script de migration pour peupler company.employees{} depuis les sous-collections employeeRefs
 * 
 * Usage:
 *   node migrateEmployeesToCompanyDoc.cjs --dry-run    # Simulation
 *   node migrateEmployeesToCompanyDoc.cjs --execute   # Migration réelle
 *   node migrateEmployeesToCompanyDoc.cjs --check     # Vérifier les incohérences
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Configuration Firebase Admin
const serviceAccount = require('../firebase-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://lebonprix-8a8b8-default-rtdb.firebaseio.com"
  });
}

const db = admin.firestore();

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const EXECUTE = process.argv.includes('--execute');
const CHECK_ONLY = process.argv.includes('--check');

if (!DRY_RUN && !EXECUTE && !CHECK_ONLY) {
  console.log('❌ Veuillez spécifier --dry-run, --execute ou --check');
  process.exit(1);
}

/**
 * Récupérer toutes les companies
 */
async function getAllCompanies() {
  console.log('📋 Récupération de toutes les companies...');
  
  const companiesSnapshot = await db.collection('companies').get();
  const companies = [];
  
  companiesSnapshot.forEach(doc => {
    companies.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  console.log(`✅ ${companies.length} companies trouvées`);
  return companies;
}

/**
 * Récupérer les employeeRefs d'une company
 */
async function getEmployeeRefs(companyId) {
  const employeeRefsSnapshot = await db
    .collection('companies')
    .doc(companyId)
    .collection('employeeRefs')
    .get();
  
  const employeeRefs = [];
  employeeRefsSnapshot.forEach(doc => {
    const data = doc.data();
    // Ignorer les employés marqués comme supprimés
    if (!data.deleted) {
      employeeRefs.push({
        id: doc.id,
        ...data
      });
    }
  });
  
  return employeeRefs;
}

/**
 * Créer l'objet employees{} pour une company
 */
function createEmployeesObject(employeeRefs) {
  const employees = {};
  
  for (const emp of employeeRefs) {
    employees[emp.id] = {
      id: emp.id,
      firstname: emp.firstname,
      lastname: emp.lastname,
      email: emp.email,
      role: emp.role,
      createdAt: emp.addedAt,
      updatedAt: emp.addedAt,
      userId: emp.id // ID de l'utilisateur
    };
  }
  
  return employees;
}

/**
 * Vérifier les incohérences pour une company
 */
async function checkCompanyInconsistencies(company) {
  const employeeRefs = await getEmployeeRefs(company.id);
  const currentEmployees = company.employees || {};
  const currentCount = company.employeeCount || 0;
  
  const issues = [];
  
  // Vérifier le nombre d'employés
  if (currentCount !== employeeRefs.length) {
    issues.push(`Nombre d'employés différent: company.employeeCount=${currentCount}, sous-collection=${employeeRefs.length}`);
  }
  
  // Vérifier les employés manquants dans company.employees{}
  for (const emp of employeeRefs) {
    if (!currentEmployees[emp.id]) {
      issues.push(`Employé ${emp.id} (${emp.firstname} ${emp.lastname}) présent dans sous-collection mais absent de company.employees{}`);
    }
  }
  
  // Vérifier les employés manquants dans la sous-collection
  for (const [userId, emp] of Object.entries(currentEmployees)) {
    const found = employeeRefs.find(e => e.id === userId);
    if (!found) {
      issues.push(`Employé ${userId} (${emp.firstname} ${emp.lastname}) présent dans company.employees{} mais absent de sous-collection`);
    }
  }
  
  return {
    companyId: company.id,
    companyName: company.name,
    issues,
    hasIssues: issues.length > 0,
    employeeRefsCount: employeeRefs.length,
    currentEmployeesCount: Object.keys(currentEmployees).length,
    currentEmployeeCount: currentCount
  };
}

/**
 * Migrer une company
 */
async function migrateCompany(company) {
  console.log(`\n🔄 Migration de la company: ${company.name} (${company.id})`);
  
  try {
    // Récupérer les employeeRefs
    const employeeRefs = await getEmployeeRefs(company.id);
    console.log(`   📋 ${employeeRefs.length} employés trouvés dans la sous-collection`);
    
    if (employeeRefs.length === 0) {
      console.log('   ⚠️  Aucun employé trouvé, passage à la suivante');
      return {
        companyId: company.id,
        companyName: company.name,
        success: true,
        employeesProcessed: 0,
        message: 'Aucun employé à migrer'
      };
    }
    
    // Créer l'objet employees{}
    const employees = createEmployeesObject(employeeRefs);
    
    if (DRY_RUN) {
      console.log('   🔍 [DRY-RUN] Objet employees{} qui serait créé:');
      console.log('   📊 Structure:', Object.keys(employees).map(userId => ({
        userId,
        name: `${employees[userId].firstname} ${employees[userId].lastname}`,
        role: employees[userId].role
      })));
      
      return {
        companyId: company.id,
        companyName: company.name,
        success: true,
        employeesProcessed: employeeRefs.length,
        message: 'Simulation réussie'
      };
    }
    
    // Mise à jour réelle
    await db.collection('companies').doc(company.id).update({
      employees: employees,
      employeeCount: employeeRefs.length,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`   ✅ Company mise à jour avec ${employeeRefs.length} employés`);
    
    return {
      companyId: company.id,
      companyName: company.name,
      success: true,
      employeesProcessed: employeeRefs.length,
      message: 'Migration réussie'
    };
    
  } catch (error) {
    console.error(`   ❌ Erreur lors de la migration de ${company.name}:`, error.message);
    return {
      companyId: company.id,
      companyName: company.name,
      success: false,
      employeesProcessed: 0,
      error: error.message
    };
  }
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🚀 Démarrage de la migration des employés vers company.employees{}');
  console.log(`📋 Mode: ${DRY_RUN ? 'DRY-RUN (simulation)' : EXECUTE ? 'EXECUTION' : 'VÉRIFICATION'}`);
  
  const startTime = Date.now();
  
  try {
    // Récupérer toutes les companies
    const companies = await getAllCompanies();
    
    if (companies.length === 0) {
      console.log('⚠️  Aucune company trouvée');
      return;
    }
    
    const results = [];
    let totalEmployees = 0;
    let successCount = 0;
    let errorCount = 0;
    
    // Traiter chaque company
    for (const company of companies) {
      if (CHECK_ONLY) {
        const checkResult = await checkCompanyInconsistencies(company);
        results.push(checkResult);
        
        if (checkResult.hasIssues) {
          console.log(`\n❌ Incohérences détectées pour ${company.name}:`);
          checkResult.issues.forEach(issue => console.log(`   - ${issue}`));
        } else {
          console.log(`\n✅ ${company.name}: Aucune incohérence détectée`);
        }
      } else {
        const result = await migrateCompany(company);
        results.push(result);
        
        if (result.success) {
          successCount++;
          totalEmployees += result.employeesProcessed;
        } else {
          errorCount++;
        }
      }
    }
    
    // Générer le rapport
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log('\n📊 RAPPORT FINAL');
    console.log('================');
    console.log(`⏱️  Durée: ${duration}s`);
    console.log(`📋 Companies traitées: ${companies.length}`);
    
    if (CHECK_ONLY) {
      const inconsistentCompanies = results.filter(r => r.hasIssues);
      console.log(`✅ Companies cohérentes: ${results.length - inconsistentCompanies.length}`);
      console.log(`❌ Companies avec incohérences: ${inconsistentCompanies.length}`);
      
      if (inconsistentCompanies.length > 0) {
        console.log('\n📋 Companies avec incohérences:');
        inconsistentCompanies.forEach(company => {
          console.log(`   - ${company.companyName} (${company.companyId})`);
          company.issues.forEach(issue => console.log(`     • ${issue}`));
        });
      }
    } else {
      console.log(`✅ Companies migrées avec succès: ${successCount}`);
      console.log(`❌ Companies en erreur: ${errorCount}`);
      console.log(`👥 Total employés traités: ${totalEmployees}`);
      
      if (errorCount > 0) {
        console.log('\n❌ Companies en erreur:');
        results.filter(r => !r.success).forEach(result => {
          console.log(`   - ${result.companyName}: ${result.error}`);
        });
      }
    }
    
    // Sauvegarder le rapport
    const reportPath = path.join(__dirname, `migration-report-${Date.now()}.json`);
    const report = {
      timestamp: new Date().toISOString(),
      mode: DRY_RUN ? 'dry-run' : EXECUTE ? 'execute' : 'check',
      duration: duration,
      companiesProcessed: companies.length,
      results: results,
      summary: CHECK_ONLY ? {
        consistentCompanies: results.length - results.filter(r => r.hasIssues).length,
        inconsistentCompanies: results.filter(r => r.hasIssues).length
      } : {
        successCount,
        errorCount,
        totalEmployees
      }
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Rapport sauvegardé: ${reportPath}`);
    
    if (DRY_RUN) {
      console.log('\n💡 Pour exécuter la migration réelle, utilisez: node migrateEmployeesToCompanyDoc.cjs --execute');
    }
    
  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }
}

// Exécution
if (require.main === module) {
  main().then(() => {
    console.log('\n🎉 Migration terminée');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
}

module.exports = {
  getAllCompanies,
  getEmployeeRefs,
  createEmployeesObject,
  checkCompanyInconsistencies,
  migrateCompany
};
