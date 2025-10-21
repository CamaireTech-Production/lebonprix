# Structure de la Base de Données - Le Bon Prix

## Vue d'ensemble

Le projet "Le Bon Prix" utilise Firebase Firestore comme base de données NoSQL. La structure est organisée autour de deux entités principales : les **Compagnies** et les **Employés**.

## Collections Principales

### 1. Collection `companies`
**Chemin** : `/companies/{companyId}`

**Structure** :
```typescript
interface Company extends BaseModel {
  id: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  userId: string; // Référence vers l'utilisateur propriétaire
  
  // Informations de l'entreprise
  name: string;
  logo?: string; // Base64 string pour le logo
  description?: string;
  phone: string;
  role: "Companie";
  location?: string;
  email: string;
  
  // Employés de l'entreprise
  employees?: Record<string, CompanyEmployee>; // Mapping des employés par ID
}
```

**Règles de sécurité** :
- Lecture : Utilisateurs authentifiés
- Création : Utilisateur authentifié (userId = auth.uid)
- Mise à jour : Propriétaire de l'entreprise uniquement
- Suppression : Propriétaire de l'entreprise uniquement

### 2. Sous-collection `employees`
**Chemin** : `/companies/{companyId}/employees/{employeeId}`

**Structure** :
```typescript
interface CompanyEmployee {
  id: string; // ID unique généré automatiquement
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  role: UserRole; // 'admin' | 'manager' | 'staff'
  birthday?: string; // ISO date (YYYY-MM-DD)
  loginLink?: string; // Lien d'invitation/connexion chiffré
  firebaseUid?: string; // UID Firebase Auth (optionnel)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type UserRole = 'admin' | 'manager' | 'staff';
```

**Règles de sécurité** :
- Lecture : Utilisateurs authentifiés
- Création : Propriétaire de l'entreprise uniquement
- Mise à jour : Propriétaire de l'entreprise uniquement
- Suppression : Propriétaire de l'entreprise uniquement

### 3. Collection `users`
**Chemin** : `/users/{userId}`

**Structure** :
```typescript
interface User {
  id: string;
  role: UserRole; // 'admin' | 'manager' | 'staff'
  // Autres champs utilisateur...
}
```

**Utilisation** : Gestion des rôles globaux pour les permissions Firestore.

## Relations et Intégrations

### Relation Compagnie ↔ Employés
- **Type** : Relation hiérarchique (document → sous-collection)
- **Cardinalité** : 1:N (une compagnie peut avoir plusieurs employés)
- **Stockage** : Double stockage
  1. Dans le document `companies/{companyId}` : champ `employees` (Record<string, CompanyEmployee>)
  2. Dans la sous-collection `companies/{companyId}/employees/{employeeId}`

### Intégration Firebase Auth
- **Authentification** : Chaque employé a un compte Firebase Auth
- **Mot de passe par défaut** : Format `{firstname}123{lastname}`
- **Lien de connexion** : Chiffré avec chiffrement César (shift=3)
- **Liaison** : Champ `firebaseUid` pour lier l'employé à son compte Auth

## Sécurité et Permissions

### Règles Firestore
```javascript
// Compagnies
match /companies/{companyId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated() && request.resource.data.userId == request.auth.uid;
  allow update: if isAuthenticated() && resource.data.userId == request.auth.uid;
  allow delete: if isAuthenticated() && resource.data.userId == request.auth.uid;
  
  // Employés
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

### Contrôles d'accès
- **Propriétaire de l'entreprise** : Accès complet à ses employés
- **Employés** : Accès limité selon leur rôle
- **Administrateurs** : Accès global (via `users/{uid}.role`)

## Flux de Données

### Création d'un Employé
1. **Validation** : Vérification des champs obligatoires
2. **Génération** : ID unique, mot de passe par défaut, lien de connexion
3. **Authentification** : Création d'utilisateur Firebase Auth
4. **Sauvegarde** : Stockage dans Firestore (sous-collection + document company)
5. **Interface** : Mise à jour de l'état local

### Connexion d'un Employé
1. **Lien de connexion** : Décryptage et validation
2. **Pré-remplissage** : Chargement des informations employé
3. **Authentification** : Connexion Firebase Auth
4. **Redirection** : Vers le catalogue de l'entreprise

## Migration et Maintenance

### Scripts de Migration
- **`migrateEmployeeIds.js`** : Ajout d'IDs uniques aux employés existants
- **`provisionEmployeeUsers.js`** : Création d'utilisateurs Firebase Auth
- **`cleanupEmployeeUsers.js`** : Nettoyage des utilisateurs supprimés

### Sauvegarde et Restauration
- **Sauvegarde automatique** : Via Firebase
- **Export des données** : Scripts de migration disponibles
- **Restauration** : Processus de migration inverse

## Optimisations et Performances

### Indexation
- **Index automatiques** : Firebase gère les index de base
- **Index composites** : Pour les requêtes complexes sur les employés
- **Index sur les rôles** : Pour les filtres par rôle

### Mise en cache
- **Cache local** : État des employés mis en cache côté client
- **Synchronisation** : Mise à jour en temps réel via Firestore listeners
- **Optimisation** : Requêtes paginées pour les grandes listes

## Monitoring et Logs

### Audit Trail
- **Collection `auditLogs`** : Traçabilité des modifications
- **Logs d'authentification** : Connexions/déconnexions des employés
- **Logs de sécurité** : Tentatives d'accès non autorisées

### Métriques
- **Nombre d'employés** : Par entreprise et global
- **Activité** : Connexions, modifications, créations
- **Performance** : Temps de réponse des requêtes

## Évolutions Futures

### Fonctionnalités Prévues
1. **Invitations par email** : Envoi automatique d'invitations
2. **Gestion des rôles granulaires** : Permissions détaillées
3. **Historique des modifications** : Audit trail complet
4. **Import/Export** : Gestion en masse des employés
5. **Notifications** : Alertes pour les nouveaux employés

### Améliorations Techniques
1. **Cloud Functions** : Automatisation des tâches
2. **Webhooks** : Intégration avec des services externes
3. **API REST** : Interface programmatique
4. **Monitoring avancé** : Surveillance des performances
5. **Backup automatique** : Sauvegarde régulière

---

**Version** : 1.0.0  
**Dernière mise à jour** : 2024-12-13  
**Base de données** : Firebase Firestore  
**Authentification** : Firebase Auth

