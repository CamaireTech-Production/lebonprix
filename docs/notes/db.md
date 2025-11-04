# Structure de la Base de Données - Le Bon Prix

## Vue d'ensemble

Le projet "Le Bon Prix" utilise Firebase Firestore comme base de données NoSQL. La structure utilise maintenant une **architecture simplifiée centrée sur l'utilisateur** avec un dashboard type Netflix.

### Architecture Simplifiée

- **Connexion utilisateur** : Les utilisateurs se connectent (pas les entreprises)
- **Dashboard Netflix** : Affichage de toutes les entreprises de l'utilisateur
- **Références unidirectionnelles** : `users[].companies[]` uniquement (suppression de `companies[].employeeRefs`)
- **Création d'entreprise** : Après connexion, via le dashboard avec bouton +

## Collections Principales

### 1. Collection `users` (Nouveau Système Unifié)
**Chemin** : `/users/{userId}`

**Structure** :
```typescript
interface User {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  photoURL?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  companies: UserCompanyRef[]; // Liste des entreprises où l'utilisateur est membre
  status: 'active' | 'suspended' | 'invited';
  lastLogin?: Timestamp;
}

interface UserCompanyRef {
  companyId: string;
  name: string;
  description?: string;
  logo?: string;
  role: 'owner' | 'admin' | 'manager' | 'staff';
  joinedAt: Timestamp;
}
```

**Règles de sécurité** :
- Lecture : L'utilisateur lui-même ou les membres de la même entreprise
- Création : Utilisateur authentifié (userId = auth.uid)
- Mise à jour : Utilisateur authentifié (userId = auth.uid)
- Suppression : Interdite (soft delete uniquement)

### 2. Collection `companies` (Système Unifié)
**Chemin** : `/companies/{companyId}`

**Structure** :
```typescript
interface Company extends BaseModel {
  id: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  companyId: string; // ID de l'entreprise (remplace userId)
  
  // Informations de l'entreprise
  name: string;
  logo?: string; // Base64 string pour le logo
  description?: string;
  phone: string;
  role: "Companie";
  location?: string;
  email: string;
  
  // ❌ SUPPRIMÉ - Architecture simplifiée ne gère plus employeeRefs
  // Les références sont uniquement dans users[].companies[]
  
  // Ancien système - Maintenu pour compatibilité
  employees?: Record<string, CompanyEmployee>; // Mapping des employés par ID
}
```

**Règles de sécurité** :
- Lecture : Membres de l'entreprise uniquement
- Création : Utilisateur authentifié
- Mise à jour : Propriétaire de l'entreprise (companyId = auth.uid)
- Suppression : Propriétaire de l'entreprise uniquement

### 3. Sous-collection `employees` (Ancien Système - Compatibilité)
**Chemin** : `/companies/{companyId}/employees/{employeeId}`

**Note** : Cette sous-collection est maintenue pour compatibilité avec l'ancien système. Les nouvelles implémentations doivent utiliser la collection `users` et les références `employeeRefs`.

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
  firebaseUid?: string; // UID Firebase Auth (référence vers /users/{uid})
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

## Relations et Intégrations

### Architecture Simplifiée: Relation Utilisateurs ↔ Entreprises

#### Architecture Unidirectionnelle
- **Type** : Relation unidirectionnelle (users → companies)
- **Cardinalité** : N:N (un utilisateur peut être dans plusieurs entreprises)
- **Source de vérité** : `users[].companies[]` uniquement

#### Stockage des Références

**Dans `/users/{userId}` uniquement:**
```typescript
companies: [
  {
    companyId: "company123",
    name: "Mon Entreprise",
    role: "owner",
    joinedAt: Timestamp
  },
  {
    companyId: "company456", 
    name: "Autre Entreprise",
    role: "staff",
    joinedAt: Timestamp
  }
]
```

**❌ SUPPRIMÉ dans `/companies/{companyId}`:**
- Plus de `employeeRefs` (architecture simplifiée)
- Les références sont uniquement dans `users[].companies[]`

### Relation Compagnie ↔ Employés (Ancien Système - Compatibilité)
- **Type** : Relation hiérarchique (document → sous-collection)
- **Cardinalité** : 1:N (une compagnie peut avoir plusieurs employés)
- **Stockage** : Double stockage (pour compatibilité)
  1. Dans `/users/{userId}` : liste `companies` avec références (source de vérité)
  2. Dans la sous-collection `companies/{companyId}/employees/{employeeId}` (compatibilité)

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

## Flux de Données et Logique Métier

### Inscription Utilisateur (Nouveau Flux)
1. **Création du compte Firebase Auth** pour l'utilisateur
2. **Création du document utilisateur** dans `/users/{uid}` avec `companies: []`
3. **Redirection vers dashboard Netflix** (vide ou avec entreprises existantes)

### Création d'Entreprise (Post-Connexion)
1. **Utilisateur connecté** accède au dashboard
2. **Clic sur bouton +** pour créer une entreprise
3. **Création du document entreprise** dans `/companies/{companyId}`
4. **Ajout de la référence** dans `users[].companies[]` uniquement
5. **Redirection vers l'entreprise** créée

### Ajout d'Employé
1. **Création du compte Firebase Auth** pour l'employé
2. **Création du document utilisateur** dans `/users/{uid}`
3. **Ajout de la référence** dans `users[].companies[]` uniquement
4. **Création dans la sous-collection** `companies/{companyId}/employees/{employeeId}` (compatibilité)

### Connexion Utilisateur (Dashboard Netflix)
1. **Authentification Firebase Auth**
2. **Chargement du document utilisateur** depuis `/users/{uid}`
3. **Récupération des entreprises** depuis `user.companies[]`
4. **Logique du dashboard** :
   - 0 entreprise → Dashboard vide avec bouton "Créer entreprise"
   - 1 entreprise → Chargement automatique
   - 2+ entreprises → Dashboard Netflix avec sélection

### Création d'un Employé (Ancien Système - Compatibilité)
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

