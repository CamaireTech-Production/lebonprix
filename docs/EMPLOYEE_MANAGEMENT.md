# Gestion des Employés - Documentation

## Vue d'ensemble

Le système de gestion des employés permet aux entreprises de créer et gérer leurs employés avec une authentification Firebase intégrée. Chaque employé reçoit automatiquement un compte Firebase Auth avec un mot de passe par défaut.

## Fonctionnalités

### 1. Création d'employés
- **ID unique** : Chaque employé reçoit un ID unique généré automatiquement
- **Authentification Firebase** : Création automatique d'un utilisateur Firebase Auth
- **Mot de passe par défaut** : Format `{firstname}123{lastname}` (non hashé)
- **Lien de connexion** : Généré automatiquement avec chiffrement César

### 2. Gestion des employés
- **Tableau de bord** : Vue d'ensemble avec statistiques
- **Ajout/Modification/Suppression** : Interface complète de gestion
- **Détails des employés** : Affichage complet des informations
- **Liens de connexion** : Copie et ouverture des liens d'invitation

### 3. Authentification
- **Connexion employé** : Page dédiée avec pré-remplissage
- **Validation côté client** : Vérification des champs obligatoires
- **Redirection** : Vers le catalogue après connexion réussie

## Architecture technique

### Modèles de données

```typescript
export interface CompanyEmployee {
  id: string; // ID unique généré automatiquement
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  role: UserRole;
  birthday?: string; // ISO date (YYYY-MM-DD)
  loginLink?: string; // lien d'invitation / connexion
  firebaseUid?: string; // UID Firebase Auth
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type UserRole = 'admin' | 'manager' | 'staff';
```

### Services

#### `employeeAuth.ts`
- `createEmployeeUser()` : Création d'utilisateur Firebase Auth
- Gestion des erreurs et validation

#### `employees.ts`
- `addEmployeeWithAuth()` : Ajout d'employé avec authentification
- `updateEmployee()` : Mise à jour des informations
- `removeEmployee()` : Suppression d'employé

#### `security.ts`
- `makeDefaultEmployeePassword()` : Génération du mot de passe par défaut
- `buildLoginLink()` : Création du lien de connexion
- `generateEmployeeId()` : Génération d'ID unique
- `caesarCipher()` : Chiffrement César pour les liens

### Composants

#### `EmployeesTab.tsx`
- Interface de gestion des employés
- Formulaire d'ajout avec validation
- Tableau des employés existants
- Actions : voir, copier lien, ouvrir, supprimer

#### `EmployeeLogin.tsx`
- Page de connexion pour les employés
- Pré-remplissage des informations
- Validation et redirection

## Utilisation

### 1. Ajouter un employé

1. Aller dans **Paramètres** > **Employés**
2. Remplir le formulaire :
   - Prénom (obligatoire)
   - Nom (obligatoire)
   - Email (obligatoire)
   - Téléphone (optionnel)
   - Rôle (admin/manager/staff)
   - Date de naissance (optionnel)
3. Cliquer sur **"Add employee"**

Le système va :
- Générer un ID unique
- Créer un utilisateur Firebase Auth
- Générer un mot de passe par défaut
- Créer un lien de connexion
- Sauvegarder dans Firestore

### 2. Gérer les employés

- **Voir** : Afficher les détails complets
- **Copier lien** : Copier le lien de connexion
- **Ouvrir** : Ouvrir le lien dans un nouvel onglet
- **Supprimer** : Retirer l'employé

### 3. Connexion employé

1. L'employé clique sur son lien de connexion
2. La page se charge avec ses informations pré-remplies
3. Il saisit son mot de passe par défaut
4. Après connexion, redirection vers le catalogue

## Migration des données existantes

### Scripts disponibles

#### `migrateEmployeeIds.js`
```bash
# Ajouter des IDs uniques aux employés existants
node scripts/migrateEmployeeIds.js migrate-ids [companyId]

# Créer des utilisateurs Firebase Auth
node scripts/migrateEmployeeIds.js provision-users [companyId]

# Exécuter les deux migrations
node scripts/migrateEmployeeIds.js migrate-all [companyId]
```

#### `provisionEmployeeUsers.js`
```bash
# Créer des utilisateurs Firebase Auth
node scripts/provisionEmployeeUsers.js provision [companyId]

# Nettoyer les utilisateurs supprimés
node scripts/provisionEmployeeUsers.js cleanup [companyId]

# Exécuter les deux opérations
node scripts/provisionEmployeeUsers.js all [companyId]
```

### Étapes de migration

1. **Sauvegarde** : Faire une sauvegarde de la base de données
2. **Migration des IDs** : Exécuter `migrateEmployeeIds.js migrate-ids`
3. **Provisionnement** : Exécuter `provisionEmployeeUsers.js provision`
4. **Vérification** : Tester la création d'employés
5. **Nettoyage** : Exécuter `provisionEmployeeUsers.js cleanup` si nécessaire

## Sécurité

### Règles Firestore

```javascript
// Companies
match /companies/{companyId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated() && request.resource.data.userId == request.auth.uid;
  allow update: if isAuthenticated() && resource.data.userId == request.auth.uid;
  allow delete: if isAuthenticated() && resource.data.userId == request.auth.uid;
  
  // Employee subcollection
  match /employees/{employeeId} {
    allow read: if isAuthenticated();
    allow create: if isAuthenticated() && 
      get(/databases/$(database)/documents/companies/$(companyId)).data.userId == request.auth.uid;
    allow update: if isAuthenticated() && 
      get(/databases/$(database)/documents/companies/$(companyId)).data.userId == request.auth.uid;
    allow delete: if isAuthenticated() && 
      get(/databases/$(database)/documents/companies/$(companyId)).data.userId == request.auth.uid;
  }
}
```

### Considérations de sécurité

1. **Mots de passe** : Non hashés côté client, gérés par Firebase Auth
2. **Liens de connexion** : Chiffrés avec César (shift=3)
3. **Permissions** : Seul le propriétaire de l'entreprise peut gérer les employés
4. **Validation** : Validation côté client et serveur
5. **Audit** : Traçabilité des modifications

## Tests

### Tests unitaires

- `employeeAuth.test.ts` : Tests du service d'authentification
- `employees.test.ts` : Tests du service de gestion
- `security.test.ts` : Tests des utilitaires de sécurité

### Tests d'intégration

- `EmployeesTab.test.tsx` : Tests du composant de gestion
- Tests de création d'employés
- Tests de validation
- Tests des actions utilisateur

### Exécution des tests

```bash
# Tests unitaires
npm run test

# Tests avec couverture
npm run test:coverage

# Tests en mode watch
npm run test:watch
```

## Dépannage

### Problèmes courants

1. **Erreur de création d'utilisateur**
   - Vérifier que l'email n'existe pas déjà
   - Vérifier les permissions Firebase Auth
   - Vérifier la configuration du projet

2. **Erreur de sauvegarde Firestore**
   - Vérifier les règles de sécurité
   - Vérifier les permissions de l'utilisateur
   - Vérifier la structure des données

3. **Lien de connexion invalide**
   - Vérifier que l'employé existe
   - Vérifier le format du lien
   - Vérifier le chiffrement César

### Logs et débogage

- Activer les logs Firebase dans la console
- Vérifier les erreurs dans la console du navigateur
- Utiliser les outils de développement Firebase

## Évolutions futures

### Fonctionnalités prévues

1. **Invitations par email** : Envoi automatique d'invitations
2. **Gestion des rôles** : Permissions granulaires
3. **Historique des modifications** : Audit trail complet
4. **Import/Export** : Gestion en masse des employés
5. **Notifications** : Alertes pour les nouveaux employés

### Améliorations techniques

1. **Cloud Functions** : Automatisation des tâches
2. **Webhooks** : Intégration avec des services externes
3. **API REST** : Interface programmatique
4. **Monitoring** : Surveillance des performances
5. **Backup automatique** : Sauvegarde régulière

## Support

Pour toute question ou problème :

1. Consulter cette documentation
2. Vérifier les logs d'erreur
3. Tester avec des données de test
4. Contacter l'équipe de développement

---

**Version** : 1.0.0  
**Dernière mise à jour** : 2024-12-13  
**Auteur** : Équipe Le Bon Prix
