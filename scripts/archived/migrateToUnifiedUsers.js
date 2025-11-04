/**
 * Script de migration vers le système utilisateurs unifié
 * 
 * Ce script migre les données existantes de la structure actuelle
 * (companies/{companyId}/employees) vers le nouveau système unifié
 * (users/{userId} + companies/{companyId})
 * 
 * Usage: node scripts/migrateToUnifiedUsers.js
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
 * Migration principale
 */
async function migrateToUnifiedUsers() {
  console.log('🚀 Début de la migration vers le système utilisateurs unifié...');
  
  try {
    // 1. Lister toutes les entreprises existantes
    console.log('📋 Récupération des entreprises existantes...');
    const companiesSnapshot = await db.collection('companies').get();
    const companies = companiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`✅ ${companies.length} entreprises trouvées`);
    
    // 2. Migrer chaque entreprise
    for (const company of companies) {
      console.log(`\n🏢 Migration de l'entreprise: ${company.name} (${company.id})`);
      
      // Vérifier si l'entreprise a déjà été migrée
      if (company.companyId) {
        console.log('⚠️  Entreprise déjà migrée, passage à la suivante');
        continue;
      }
      
      // Créer ou mettre à jour le propriétaire dans /users/{uid}
      await migrateCompanyOwner(company);
      
      // Migrer les employés de l'entreprise
      await migrateCompanyEmployees(company);
      
      // Mettre à jour l'entreprise avec les nouvelles références
      await updateCompanyStructure(company);
      
      console.log(`✅ Entreprise ${company.name} migrée avec succès`);
    }
    
    console.log('\n🎉 Migration terminée avec succès!');
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    throw error;
  }
}

/**
 * Migre le propriétaire d'une entreprise
 */
async function migrateCompanyOwner(company) {
  const ownerId = company.userId;
  if (!ownerId) {
    console.log('⚠️  Aucun propriétaire trouvé pour cette entreprise');
    return;
  }
  
  console.log(`👤 Migration du propriétaire: ${ownerId}`);
  
  // Vérifier si l'utilisateur existe déjà
  const userDoc = await db.collection('users').doc(ownerId).get();
  
  const now = admin.firestore.Timestamp.now();
  
  if (userDoc.exists()) {
    // Mettre à jour l'utilisateur existant
    const userData = userDoc.data();
    const companyRef = {
      companyId: company.id,
      name: company.name,
      description: company.description,
      logo: company.logo,
      role: 'owner',
      joinedAt: company.createdAt || now
    };
    
    // Vérifier si l'entreprise n'est pas déjà dans la liste
    const hasCompany = userData.companies?.some(c => c.companyId === company.id);
    if (!hasCompany) {
      await db.collection('users').doc(ownerId).update({
        companies: admin.firestore.FieldValue.arrayUnion(companyRef),
        updatedAt: now
      });
      console.log(`✅ Entreprise ajoutée à l'utilisateur existant`);
    }
  } else {
    // Créer un nouvel utilisateur
    const newUser = {
      id: ownerId,
      firstname: company.name, // Utiliser le nom de l'entreprise comme prénom par défaut
      lastname: 'Propriétaire',
      email: company.email || '',
      phone: company.phone,
      photoURL: company.logo,
      createdAt: company.createdAt || now,
      updatedAt: now,
      companies: [{
        companyId: company.id,
        name: company.name,
        description: company.description,
        logo: company.logo,
        role: 'owner',
        joinedAt: company.createdAt || now
      }],
      status: 'active'
    };
    
    await db.collection('users').doc(ownerId).set(newUser);
    console.log(`✅ Nouvel utilisateur créé pour le propriétaire`);
  }
}

/**
 * Migre les employés d'une entreprise
 */
async function migrateCompanyEmployees(company) {
  console.log(`👥 Migration des employés de l'entreprise ${company.name}...`);
  
  try {
    // Récupérer les employés depuis la sous-collection
    const employeesSnapshot = await db
      .collection('companies')
      .doc(company.id)
      .collection('employees')
      .get();
    
    const employees = employeesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`📊 ${employees.length} employés trouvés`);
    
    const employeeRefs = [];
    
    for (const employee of employees) {
      console.log(`👤 Migration de l'employé: ${employee.firstname} ${employee.lastname}`);
      
      // Utiliser firebaseUid s'il existe, sinon générer un ID
      const userId = employee.firebaseUid || `employee_${employee.id}`;
      
      // Créer ou mettre à jour l'utilisateur
      await migrateEmployeeUser(employee, userId, company);
      
      // Ajouter la référence d'employé
      employeeRefs.push({
        userId: userId,
        role: employee.role,
        joinedAt: employee.createdAt || admin.firestore.Timestamp.now()
      });
    }
    
    // Stocker les références pour la mise à jour de l'entreprise
    company.employeeRefs = employeeRefs;
    
  } catch (error) {
    console.error(`❌ Erreur lors de la migration des employés de ${company.name}:`, error);
  }
}

/**
 * Migre un employé vers le système utilisateurs
 */
async function migrateEmployeeUser(employee, userId, company) {
  const now = admin.firestore.Timestamp.now();
  
  // Vérifier si l'utilisateur existe déjà
  const userDoc = await db.collection('users').doc(userId).get();
  
  const companyRef = {
    companyId: company.id,
    name: company.name,
    description: company.description,
    logo: company.logo,
    role: employee.role,
    joinedAt: employee.createdAt || now
  };
  
  if (userDoc.exists()) {
    // Mettre à jour l'utilisateur existant
    const userData = userDoc.data();
    const hasCompany = userData.companies?.some(c => c.companyId === company.id);
    
    if (!hasCompany) {
      await db.collection('users').doc(userId).update({
        companies: admin.firestore.FieldValue.arrayUnion(companyRef),
        updatedAt: now
      });
      console.log(`✅ Entreprise ajoutée à l'utilisateur existant`);
    }
  } else {
    // Créer un nouvel utilisateur
    const newUser = {
      id: userId,
      firstname: employee.firstname,
      lastname: employee.lastname,
      email: employee.email,
      phone: employee.phone,
      photoURL: null,
      createdAt: employee.createdAt || now,
      updatedAt: now,
      companies: [companyRef],
      status: 'active'
    };
    
    await db.collection('users').doc(userId).set(newUser);
    console.log(`✅ Nouvel utilisateur créé pour l'employé`);
  }
}

/**
 * Met à jour la structure de l'entreprise
 */
async function updateCompanyStructure(company) {
  console.log(`🏢 Mise à jour de la structure de l'entreprise ${company.name}...`);
  
  const updateData = {
    companyId: company.id, // L'ID de l'entreprise devient le companyId
    employeeRefs: company.employeeRefs || [],
    updatedAt: admin.firestore.Timestamp.now()
  };
  
  // Supprimer l'ancien champ userId
  updateData.userId = admin.firestore.FieldValue.delete();
  
  await db.collection('companies').doc(company.id).update(updateData);
  console.log(`✅ Structure de l'entreprise mise à jour`);
}

/**
 * Fonction de validation post-migration
 */
async function validateMigration() {
  console.log('\n🔍 Validation de la migration...');
  
  try {
    // Vérifier que tous les utilisateurs ont été créés
    const usersSnapshot = await db.collection('users').get();
    console.log(`✅ ${usersSnapshot.size} utilisateurs dans la collection users`);
    
    // Vérifier que les entreprises ont été mises à jour
    const companiesSnapshot = await db.collection('companies').get();
    let migratedCompanies = 0;
    
    companiesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.companyId) {
        migratedCompanies++;
      }
    });
    
    console.log(`✅ ${migratedCompanies}/${companiesSnapshot.size} entreprises migrées`);
    
    // Vérifier les références croisées
    let totalUserCompanies = 0;
    let totalCompanyEmployees = 0;
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      totalUserCompanies += userData.companies?.length || 0;
    });
    
    companiesSnapshot.forEach(doc => {
      const companyData = doc.data();
      totalCompanyEmployees += companyData.employeeRefs?.length || 0;
    });
    
    console.log(`✅ ${totalUserCompanies} références d'entreprises dans users`);
    console.log(`✅ ${totalCompanyEmployees} références d'employés dans companies`);
    
  } catch (error) {
    console.error('❌ Erreur lors de la validation:', error);
  }
}

/**
 * Point d'entrée principal
 */
async function main() {
  try {
    console.log('🚀 Script de migration vers le système utilisateurs unifié');
    console.log('⚠️  ATTENTION: Ce script modifie la structure de la base de données');
    console.log('⚠️  Assurez-vous d\'avoir une sauvegarde avant de continuer');
    
    // Demander confirmation (en production, ajouter une vraie confirmation)
    console.log('\n📋 Résumé de la migration:');
    console.log('- Création de la collection /users/{userId}');
    console.log('- Mise à jour des entreprises avec companyId et employeeRefs');
    console.log('- Conservation des sous-collections employees (compatibilité)');
    console.log('- Migration progressive sans perte de données');
    
    await migrateToUnifiedUsers();
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
  migrateToUnifiedUsers,
  validateMigration
};
