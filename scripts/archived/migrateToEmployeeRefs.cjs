/**
 * Script de Migration vers EmployeeRefs
 * 
 * Ce script migre les employés de l'ancienne structure (employees) 
 * vers la nouvelle architecture (employeeRefs) avec synchronisation bidirectionnelle.
 * 
 * Usage: node scripts/migrateToEmployeeRefs.cjs [options]
 * Options:
 *   --dry-run          # Simuler sans modifier
 *   --company=ID       # Migrer une seule company
 *   --skip-users-update # Ne pas mettre à jour users.companies[]
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
 * Parse les arguments CLI
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    companyId: null,
    skipUsersUpdate: false
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--company=')) {
      options.companyId = arg.split('=')[1];
    } else if (arg === '--skip-users-update') {
      options.skipUsersUpdate = true;
    }
  }

  return options;
}

/**
 * Récupérer toutes les companies ou une seule
 */
async function getCompanies(companyId = null) {
  if (companyId) {
    const companyDoc = await db.collection('companies').doc(companyId).get();
    if (!companyDoc.exists) {
      throw new Error(`Company ${companyId} non trouvée`);
    }
    return [{ id: companyId, ...companyDoc.data() }];
  }

  const companiesSnapshot = await db.collection('companies').get();
  const companies = [];
  
  companiesSnapshot.forEach(doc => {
    companies.push({ id: doc.id, ...doc.data() });
  });

  return companies;
}

/**
 * Migrer les employés d'une company
 */
async function migrateCompanyEmployees(company, options) {
  console.log(`\n🏢 Migration de l'entreprise: ${company.name} (${company.id})`);
  
  const migrationStats = {
    companyId: company.id,
    companyName: company.name,
    employeesFound: 0,
    employeesWithFirebaseUid: 0,
    employeeRefsCreated: 0,
    usersUpdated: 0,
    errors: []
  };

  try {
    // 1. Récupérer tous les employés de la sous-collection employees
    const employeesSnapshot = await db
      .collection('companies')
      .doc(company.id)
      .collection('employees')
      .get();

    migrationStats.employeesFound = employeesSnapshot.size;
    console.log(`📋 ${migrationStats.employeesFound} employés trouvés dans l'ancienne structure`);

    if (employeesSnapshot.empty) {
      console.log(`⚠️ Aucun employé à migrer pour ${company.name}`);
      return migrationStats;
    }

    // 2. Filtrer les employés qui ont un firebaseUid
    const employeesWithUid = [];
    employeesSnapshot.forEach(doc => {
      const employeeData = doc.data();
      if (employeeData.firebaseUid) {
        employeesWithUid.push({
          id: doc.id,
          firebaseUid: employeeData.firebaseUid,
          ...employeeData
        });
      }
    });

    migrationStats.employeesWithFirebaseUid = employeesWithUid.length;
    console.log(`👤 ${migrationStats.employeesWithFirebaseUid} employés avec firebaseUid trouvés`);

    if (employeesWithUid.length === 0) {
      console.log(`⚠️ Aucun employé avec firebaseUid à migrer pour ${company.name}`);
      return migrationStats;
    }

    // 3. Pour chaque employé avec firebaseUid
    for (const employee of employeesWithUid) {
      try {
        console.log(`🔄 Migration de l'employé: ${employee.firstname} ${employee.lastname} (${employee.firebaseUid})`);

        // Vérifier si l'employé n'est pas déjà dans employeeRefs
        const existingEmployeeRef = await db
          .collection('companies')
          .doc(company.id)
          .collection('employeeRefs')
          .doc(employee.firebaseUid)
          .get();

        if (existingEmployeeRef.exists) {
          console.log(`⚠️ Employé ${employee.firebaseUid} déjà présent dans employeeRefs`);
          continue;
        }

        if (!options.dryRun) {
          // Créer le document dans employeeRefs
          const employeeRefData = {
            id: employee.firebaseUid,
            firstname: employee.firstname,
            lastname: employee.lastname,
            email: employee.email,
            role: employee.role,
            addedAt: admin.firestore.Timestamp.now()
          };

          await db
            .collection('companies')
            .doc(company.id)
            .collection('employeeRefs')
            .doc(employee.firebaseUid)
            .set(employeeRefData);

          console.log(`✅ Référence employé créée dans employeeRefs`);
          migrationStats.employeeRefsCreated++;

          // Mettre à jour users.companies[] si demandé
          if (!options.skipUsersUpdate) {
            try {
              const userRef = db.collection('users').doc(employee.firebaseUid);
              const userDoc = await userRef.get();

              if (userDoc.exists) {
                const userData = userDoc.data();
                const userCompanyRef = {
                  companyId: company.id,
                  name: company.name,
                  description: company.description || '',
                  logo: company.logo || '',
                  role: employee.role,
                  joinedAt: admin.firestore.Timestamp.now()
                };

                // Vérifier si l'entreprise n'est pas déjà dans la liste
                const existingCompanies = userData.companies || [];
                const companyExists = existingCompanies.some(c => c.companyId === company.id);

                if (!companyExists) {
                  const updatedCompanies = [...existingCompanies, userCompanyRef];
                  await userRef.update({ companies: updatedCompanies });
                  console.log(`✅ Utilisateur mis à jour avec la référence d'entreprise`);
                  migrationStats.usersUpdated++;
                } else {
                  console.log(`⚠️ Entreprise déjà présente dans la liste de l'utilisateur`);
                }
              } else {
                console.log(`⚠️ Utilisateur ${employee.firebaseUid} non trouvé dans la collection users`);
              }
            } catch (userError) {
              console.error(`❌ Erreur lors de la mise à jour de l'utilisateur ${employee.firebaseUid}:`, userError.message);
              migrationStats.errors.push({
                employeeId: employee.firebaseUid,
                error: userError.message
              });
            }
          }
        } else {
          console.log(`[DRY-RUN] Employé ${employee.firebaseUid} serait migré`);
          migrationStats.employeeRefsCreated++;
        }

      } catch (employeeError) {
        console.error(`❌ Erreur lors de la migration de l'employé ${employee.firebaseUid}:`, employeeError.message);
        migrationStats.errors.push({
          employeeId: employee.firebaseUid,
          error: employeeError.message
        });
      }
    }

    console.log(`✅ Migration terminée pour ${company.name}`);
    return migrationStats;

  } catch (error) {
    console.error(`❌ Erreur lors de la migration de l'entreprise ${company.id}:`, error.message);
    migrationStats.errors.push({
      companyId: company.id,
      error: error.message
    });
    return migrationStats;
  }
}

/**
 * Générer le rapport de migration
 */
function generateMigrationReport(allStats, options) {
  const timestamp = new Date().toISOString();
  const report = {
    timestamp,
    options,
    summary: {
      totalCompanies: allStats.length,
      totalEmployeesFound: allStats.reduce((sum, stat) => sum + stat.employeesFound, 0),
      totalEmployeesWithUid: allStats.reduce((sum, stat) => sum + stat.employeesWithFirebaseUid, 0),
      totalEmployeeRefsCreated: allStats.reduce((sum, stat) => sum + stat.employeeRefsCreated, 0),
      totalUsersUpdated: allStats.reduce((sum, stat) => sum + stat.usersUpdated, 0),
      totalErrors: allStats.reduce((sum, stat) => sum + stat.errors.length, 0)
    },
    companies: allStats
  };

  // Sauvegarder le rapport
  const reportPath = path.join(__dirname, '..', 'migration-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n📊 RAPPORT DE MIGRATION');
  console.log('======================');
  console.log(`📅 Date: ${timestamp}`);
  console.log(`🏢 Entreprises traitées: ${report.summary.totalCompanies}`);
  console.log(`👥 Employés trouvés: ${report.summary.totalEmployeesFound}`);
  console.log(`🔗 Employés avec firebaseUid: ${report.summary.totalEmployeesWithFirebaseUid}`);
  console.log(`✅ Références employés créées: ${report.summary.totalEmployeeRefsCreated}`);
  console.log(`👤 Utilisateurs mis à jour: ${report.summary.totalUsersUpdated}`);
  console.log(`❌ Erreurs: ${report.summary.totalErrors}`);
  console.log(`📄 Rapport détaillé: ${reportPath}`);

  if (report.summary.totalErrors > 0) {
    console.log('\n⚠️ ERREURS DÉTECTÉES:');
    allStats.forEach(stat => {
      if (stat.errors.length > 0) {
        console.log(`\n🏢 ${stat.companyName} (${stat.companyId}):`);
        stat.errors.forEach(error => {
          console.log(`  - ${error.employeeId || 'N/A'}: ${error.error}`);
        });
      }
    });
  }
}

/**
 * Fonction principale de migration
 */
async function performMigration() {
  console.log('🚀 Script de Migration vers EmployeeRefs');
  console.log('==========================================');

  const options = parseArguments();
  
  console.log('⚙️ Options:');
  console.log(`  - Dry-run: ${options.dryRun ? 'OUI' : 'NON'}`);
  console.log(`  - Company spécifique: ${options.companyId || 'TOUTES'}`);
  console.log(`  - Mise à jour users: ${options.skipUsersUpdate ? 'NON' : 'OUI'}`);

  if (options.dryRun) {
    console.log('\n🔍 MODE DRY-RUN - Aucune modification ne sera effectuée');
  }

  try {
    // 1. Récupérer les companies à migrer
    console.log('\n📋 Récupération des entreprises...');
    const companies = await getCompanies(options.companyId);
    console.log(`✅ ${companies.length} entreprise(s) trouvée(s)`);

    // 2. Migrer chaque company
    const allStats = [];
    for (const company of companies) {
      const stats = await migrateCompanyEmployees(company, options);
      allStats.push(stats);
    }

    // 3. Générer le rapport
    generateMigrationReport(allStats, options);

    console.log('\n🎉 Migration terminée!');
    
    if (options.dryRun) {
      console.log('💡 Pour effectuer la migration réelle, relancez le script sans --dry-run');
    }

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error.message);
    process.exit(1);
  }
}

/**
 * Point d'entrée principal
 */
async function main() {
  try {
    await performMigration();
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
  performMigration,
  migrateCompanyEmployees,
  generateMigrationReport
};
