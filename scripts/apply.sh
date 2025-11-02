#!/bin/bash

echo "🏢 Application des changements EmployeeRefs - Companies uniquement"
echo "================================================================="

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
    echo "❌ Erreur: Ce script doit être exécuté depuis la racine du projet lebonprix"
    exit 1
fi

echo "📋 Étapes d'application (Companies uniquement):"
echo "1. Vérification des fichiers EmployeeRefs"
echo "2. Test du script de migration (dry-run)"
echo "3. Application de la migration des companies"
echo "4. Vérification des résultats"
echo ""

# 1. Vérifier les fichiers spécifiques à EmployeeRefs
echo "🔍 Vérification des fichiers EmployeeRefs..."

employee_ref_files=(
    "src/types/models.ts"
    "src/services/employeeRefService.ts"
    "src/components/settings/EmployeeRefsTab.tsx"
    "scripts/migrateToEmployeeRefs.cjs"
)

missing_files=()
for file in "${employee_ref_files[@]}"; do
    if [ ! -f "$file" ]; then
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -gt 0 ]; then
    echo "❌ Fichiers EmployeeRefs manquants:"
    for file in "${missing_files[@]}"; do
        echo "  - $file"
    done
    echo "Veuillez d'abord créer ces fichiers avant de continuer."
    exit 1
fi

echo "✅ Tous les fichiers EmployeeRefs sont présents"

# 2. Vérifier la configuration Firebase
echo ""
echo "🔧 Vérification de la configuration Firebase..."
if [ ! -f "firebase-service-account.json" ]; then
    echo "❌ Fichier firebase-service-account.json manquant"
    echo "Veuillez télécharger le fichier de service account depuis la console Firebase"
    exit 1
fi

echo "✅ Configuration Firebase trouvée"

# 3. Lister les companies existantes
echo ""
echo "📊 Analyse des companies existantes..."
node -e "
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function analyzeCompanies() {
  try {
    const companiesSnapshot = await db.collection('companies').get();
    console.log(\`📈 Nombre total de companies: \${companiesSnapshot.size}\`);
    
    let companiesWithEmployees = 0;
    let totalEmployees = 0;
    let employeesWithUid = 0;
    
    for (const companyDoc of companiesSnapshot.docs) {
      const companyData = companyDoc.data();
      const companyId = companyDoc.id;
      
      // Compter les employés dans l'ancienne structure
      const employeesSnapshot = await db
        .collection('companies')
        .doc(companyId)
        .collection('employees')
        .get();
      
      if (!employeesSnapshot.empty) {
        companiesWithEmployees++;
        totalEmployees += employeesSnapshot.size;
        
        // Compter les employés avec firebaseUid
        employeesSnapshot.forEach(empDoc => {
          const empData = empDoc.data();
          if (empData.firebaseUid) {
            employeesWithUid++;
          }
        });
      }
    }
    
    console.log(\`🏢 Companies avec employés: \${companiesWithEmployees}\`);
    console.log(\`👥 Total employés: \${totalEmployees}\`);
    console.log(\`🔗 Employés avec firebaseUid: \${employeesWithUid}\`);
    console.log(\`📊 Pourcentage migrable: \${totalEmployees > 0 ? Math.round((employeesWithUid / totalEmployees) * 100) : 0}%\`);
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'analyse:', error.message);
    process.exit(1);
  }
}

analyzeCompanies();
"

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de l'analyse des companies"
    exit 1
fi

# 4. Test du script de migration (dry-run)
echo ""
echo "🧪 Test du script de migration (mode dry-run)..."
echo "Cette étape simule la migration sans modifier les données"

read -p "Voulez-vous continuer avec le test de migration? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔄 Exécution du test de migration..."
    node scripts/migrateToEmployeeRefs.cjs --dry-run
    
    if [ $? -eq 0 ]; then
        echo "✅ Test de migration réussi"
        echo "📄 Consultez le rapport de migration pour les détails"
    else
        echo "❌ Erreur lors du test de migration"
        echo "Veuillez vérifier les logs ci-dessus et corriger les erreurs"
        exit 1
    fi
else
    echo "⏭️ Test de migration ignoré"
fi

# 5. Application de la migration réelle
echo ""
echo "🔄 Application de la migration réelle des companies..."
echo "⚠️ ATTENTION: Cette étape va modifier votre base de données"

read -p "Êtes-vous sûr de vouloir appliquer la migration? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Exécution de la migration..."
    node scripts/migrateToEmployeeRefs.cjs
    
    if [ $? -eq 0 ]; then
        echo "✅ Migration des companies appliquée avec succès"
        echo "📄 Consultez le fichier migration-report.json pour les détails"
    else
        echo "❌ Erreur lors de la migration"
        echo "Veuillez vérifier les logs ci-dessus"
        exit 1
    fi
else
    echo "⏭️ Migration ignorée"
fi

# 6. Vérification post-migration
echo ""
echo "🔍 Vérification post-migration..."

read -p "Voulez-vous vérifier les résultats de la migration? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔄 Vérification des employeeRefs créés..."
    node -e "
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function verifyMigration() {
  try {
    const companiesSnapshot = await db.collection('companies').get();
    let companiesWithEmployeeRefs = 0;
    let totalEmployeeRefs = 0;
    
    for (const companyDoc of companiesSnapshot.docs) {
      const companyId = companyDoc.id;
      
      // Vérifier les employeeRefs
      const employeeRefsSnapshot = await db
        .collection('companies')
        .doc(companyId)
        .collection('employeeRefs')
        .get();
      
      if (!employeeRefsSnapshot.empty) {
        companiesWithEmployeeRefs++;
        totalEmployeeRefs += employeeRefsSnapshot.size;
      }
    }
    
    console.log(\`✅ Companies avec employeeRefs: \${companiesWithEmployeeRefs}\`);
    console.log(\`👥 Total employeeRefs créés: \${totalEmployeeRefs}\`);
    
    if (totalEmployeeRefs > 0) {
      console.log(\`🎉 Migration réussie! \${totalEmployeeRefs} références employés créées dans \${companiesWithEmployeeRefs} companies\`);
    } else {
      console.log(\`⚠️ Aucune référence employé trouvée. Vérifiez que la migration s'est bien déroulée.\`);
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error.message);
    process.exit(1);
  }
}

verifyMigration();
"
fi

# 7. Instructions finales
echo ""
echo "🎉 Application des changements EmployeeRefs terminée!"
echo ""
echo "📋 Résumé des changements appliqués:"
echo "✅ Interface EmployeeRef ajoutée aux types"
echo "✅ Service employeeRefService créé"
echo "✅ Composant EmployeeRefsTab créé"
echo "✅ Script de migration exécuté"
echo "✅ Sous-collections employeeRefs créées"
echo ""
echo "📚 Prochaines étapes:"
echo "1. Intégrer EmployeeRefsTab dans votre interface Settings"
echo "2. Mettre à jour AuthContext pour utiliser employeeRefService"
echo "3. Tester l'interface utilisateur"
echo "4. Former les utilisateurs sur la nouvelle gestion des employés"
echo ""
echo "🔧 Commandes utiles:"
echo "- Vérifier une company spécifique: node scripts/migrateToEmployeeRefs.cjs --company=ID --dry-run"
echo "- Re-migrer si nécessaire: node scripts/migrateToEmployeeRefs.cjs"
echo "- Consulter le rapport: cat migration-report.json"