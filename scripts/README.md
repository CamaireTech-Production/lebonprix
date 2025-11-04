# Scripts du Projet Lebonprix

Ce dossier contient tous les scripts utilitaires pour la gestion, la migration et la maintenance de la base de données.

## 📁 Structure

- **Scripts actifs** : Scripts utilisés régulièrement
- **`archived/`** : Scripts de migration obsolètes (archivés pour référence)
- **`usefull/`** : Scripts utilitaires spécifiques

## 🔧 Scripts de Migration d'Images

### `setupMigration.js`
Configure l'environnement de migration et vérifie les prérequis.

### `analyzeImages.js`
Analyse le stockage actuel des images et fournit des estimations de migration.

### `migrateImages.js`
Script principal de migration qui convertit les images base64 en URLs Firebase Storage.

**Usage:**
```bash
# Dry run (recommandé)
node scripts/migrateImages.js --dry-run

# Migration complète
node scripts/migrateImages.js

# Migrer un utilisateur spécifique
node scripts/migrateImages.js --user user123
```

### `verifyMigration.js`
Vérifie que la migration a réussi et que toutes les images sont accessibles.

## 🔄 Scripts de Migration de Données

### `migrateUserIdToCompanyId.js`
Migre les données de `userId` vers `companyId` pour l'isolation des données.

**Usage:**
```bash
# Audit
node scripts/migrateUserIdToCompanyId.js --audit

# Dry run
node scripts/migrateUserIdToCompanyId.js --dry-run

# Migration réelle
node scripts/migrateUserIdToCompanyId.js
```

### `migrateCinetPayConfigs.js`
Migre les configurations CinetPay vers la nouvelle structure.

### `migrateExpensesCompanyId.js`
Migre les dépenses vers le nouveau système `companyId`.

### `migrateFinancesCompanyId.js`
Migre les entrées financières vers le nouveau système `companyId`.

### `fixSalesCompanyId.js`
Corrige les `companyId` manquants dans les ventes.

### `fixMissingFinanceEntries.js`
Corrige les entrées financières manquantes.

### `fixCompanyIds.cjs`
Corrige les IDs de company dans les documents.

## 🔍 Scripts de Diagnostic et Audit

### `diagnoseBalance.js`
Diagnostique les problèmes de calcul de balance.

### `diagnoseMissingSales.js`
Diagnostique les ventes manquantes.

### `checkBalanceCalculation.js`
Vérifie les calculs de balance.

### `checkUndefinedFinanceEntries.js`
Vérifie les entrées financières non définies.

### `auditDuplicateExpenseTypes.js`
Audite les types de dépenses en double.

### `auditUserIdToCompanyId.js`
Audite les migrations `userId` vers `companyId`.

## 💾 Scripts de Backup et Restore

### `dbBackup.cjs` / `dbBackup.js`
Sauvegarde complète de la base de données Firestore.

**Usage:**
```bash
node scripts/dbBackup.cjs
# ou
node scripts/dbBackup.js
```

### `dbRestore.cjs`
Restaure une sauvegarde de la base de données.

**Usage:**
```bash
node scripts/dbRestore.cjs <backup-directory>
```

### `restore.js`
Restaure des données spécifiques.

### `restoreSale.js`
Restaure une vente spécifique.

## 🛠️ Scripts Utilitaires

### `testFirebase.js`
Teste la connexion Firebase (Firestore, Storage, Auth).

**Usage:**
```bash
node scripts/testFirebase.js
```

### `createUsersForExistingCompanies.cjs`
Crée des utilisateurs Firebase Auth pour les entreprises existantes.

### `generateLoginLinks.js`
Génère des liens de connexion pour les utilisateurs.

### `stripHashedPassword.js`
Supprime les mots de passe hashés des documents company.

### `deleteCompaniesByPrefix.cjs`
Supprime les entreprises par préfixe (utile pour nettoyer les données de test).

### `clear_storage.js`
Nettoie le localStorage (à exécuter dans la console du navigateur).

## 📂 Scripts Archivés

Les scripts de migration suivants ont été archivés dans `archived/` car ils ont probablement déjà été exécutés :

- `migrateCompanyEmployees.js` - Migration des employés vers companies
- `migrateEmployeeIds.js` - Migration des IDs d'employés
- `migrateEmployeesToCompanyDoc.cjs` - Migration vers document company
- `migrateToEmployeeRefs.cjs` - Migration vers EmployeeRefs
- `migrateToSimplifiedArchitecture.js` - Migration vers architecture simplifiée
- `migrateToUnifiedUsers.js` - Migration vers système utilisateurs unifié
- `provisionEmployees.js` - Provision d'employés
- `provisionEmployeeUsers.js` - Provision d'utilisateurs Auth

Ces scripts sont conservés pour référence historique mais ne sont plus utilisés activement.

## 🚀 Scripts Shell

### `apply.sh`
Applique les changements EmployeeRefs pour les companies.

### `runMigration.sh`
Exécute les migrations de manière sécurisée avec vérifications.

## 📋 Prérequis

1. **Firebase Service Account** : Fichier `firebase-service-account.json` à la racine du projet
2. **Node.js** : Version 18+ recommandée
3. **Variables d'environnement** : Configurées dans `.env` si nécessaire

## ⚠️ Avertissements

- **Toujours faire un backup** avant d'exécuter des scripts de migration
- **Utiliser `--dry-run`** pour tester les scripts avant l'exécution réelle
- **Vérifier les logs** après chaque exécution
- **Documenter les changements** dans les rapports de migration

## 📝 Notes

- Les scripts utilisent principalement CommonJS (`.cjs`) ou ES Modules (`.js`)
- Les scripts de migration génèrent des rapports JSON dans `docs/migrations/`
- Tous les scripts de migration incluent une gestion d'erreur complète

---

**Dernière mise à jour** : Après nettoyage et organisation des scripts
