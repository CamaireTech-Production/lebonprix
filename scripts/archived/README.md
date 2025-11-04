# Scripts Archivés

Ce dossier contient les scripts de migration qui ont probablement déjà été exécutés et ne sont plus utilisés activement.

Ces scripts sont conservés uniquement pour référence historique et documentation.

## Scripts Archivés

- **`migrateCompanyEmployees.js`** - Migration des employés vers companies
- **`migrateEmployeeIds.js`** - Migration des IDs d'employés
- **`migrateEmployeesToCompanyDoc.cjs`** - Migration vers document company
- **`migrateToEmployeeRefs.cjs`** - Migration vers EmployeeRefs
- **`migrateToSimplifiedArchitecture.js`** - Migration vers architecture simplifiée
- **`migrateToUnifiedUsers.js`** - Migration vers système utilisateurs unifié
- **`provisionEmployees.js`** - Provision d'employés
- **`provisionEmployeeUsers.js`** - Provision d'utilisateurs Auth

## ⚠️ Attention

Ces scripts ne doivent être exécutés que si vous êtes certain qu'ils n'ont pas déjà été exécutés, ou si vous avez besoin de les réexécuter pour une raison spécifique.

Avant d'exécuter un script archivé :
1. Vérifier l'historique des migrations
2. Consulter les rapports dans `docs/migrations/`
3. Faire un backup complet
4. Tester en mode `--dry-run` d'abord

