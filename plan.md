# Plan d'action - Séparation des responsabilités de sauvegarde

## Problème identifié

La fonction `addEmployeeWithAuth` mélange la création d'employé avec la création d'utilisateur Firebase Auth, ce qui a modifié le comportement de création de compagnie. Il faut séparer ces responsabilités en 3 fonctions distinctes.

## Objectif

Créer 3 fonctions séparées et réutilisables :
1. **Sauvegarder une compagnie** (logique existante préservée)
2. **Sauvegarder un employé** (logique métier employé)
3. **Enregistrer un utilisateur Firebase Auth** (logique d'authentification)

## Architecture proposée

### 1. Fonction de sauvegarde d'utilisateur Firebase Auth
```typescript
// src/services/userAuth.ts
export const createFirebaseUser = async (userData: {
  email: string;
  password: string;
  displayName: string;
}): Promise<string> => {
  // Créer l'utilisateur Firebase Auth
  // Retourner l'UID
}
```

### 2. Fonction de sauvegarde de compagnie
```typescript
// src/services/companyService.ts
export const saveCompany = async (companyData: CompanyData): Promise<Company> => {
  // 1. Créer l'utilisateur Firebase Auth (utilise createFirebaseUser)
  // 2. Sauvegarder la compagnie en base de données
  // 3. Retourner la compagnie créée
}
```

### 3. Fonction de sauvegarde d'employé
```typescript
// src/services/employeeService.ts
export const saveEmployee = async (
  companyId: string, 
  employeeData: EmployeeData
): Promise<CompanyEmployee> => {
  // 1. Créer l'utilisateur Firebase Auth (utilise createFirebaseUser)
  // 2. Sauvegarder l'employé en base de données
  // 3. Retourner l'employé créé
}
```

## Étapes d'implémentation

### Étape 1 : Créer le service d'authentification utilisateur
- **Fichier** : `src/services/userAuth.ts`
- **Fonction** : `createFirebaseUser()`
- **Responsabilité** : Créer un utilisateur Firebase Auth uniquement
- **Réutilisable** : Par compagnie ET employé

### Étape 2 : Créer le service de compagnie
- **Fichier** : `src/services/companyService.ts`
- **Fonction** : `saveCompany()`
- **Responsabilité** : 
  - Créer l'utilisateur Firebase Auth (via createFirebaseUser)
  - Sauvegarder la compagnie en base
- **Préserve** : La logique existante de création de compagnie

### Étape 3 : Créer le service d'employé
- **Fichier** : `src/services/employeeService.ts`
- **Fonction** : `saveEmployee()`
- **Responsabilité** :
  - Créer l'utilisateur Firebase Auth (via createFirebaseUser)
  - Sauvegarder l'employé en base
- **Remplace** : La fonction addEmployeeWithAuth actuelle

### Étape 4 : Mettre à jour les composants
- **EmployeesTab** : Utiliser `saveEmployee()` au lieu de `addEmployeeWithAuth()`
- **Register/Company creation** : Utiliser `saveCompany()` pour préserver la logique existante
- **Supprimer** : `addEmployeeWithAuth()` et `employeeAuth.ts` (remplacés)

### Étape 5 : Tests et validation
- Tester la création de compagnie (doit fonctionner comme avant)
- Tester la création d'employé (nouvelle logique)
- Vérifier que les deux utilisent la même fonction d'authentification

## Avantages de cette approche

1. **Séparation des responsabilités** : Chaque fonction a un rôle clair
2. **Réutilisabilité** : `createFirebaseUser()` est utilisée par compagnie ET employé
3. **Préservation** : La logique de création de compagnie reste inchangée
4. **Maintenabilité** : Plus facile à déboguer et modifier
5. **Cohérence** : Même logique d'authentification partout

## Structure des fichiers

```
src/services/
├── userAuth.ts          # Création d'utilisateurs Firebase Auth
├── companyService.ts    # Gestion des compagnies
├── employeeService.ts   # Gestion des employés
└── employees.ts         # À supprimer (remplacé par employeeService.ts)
```

## Migration

1. **Créer** les nouveaux services
2. **Tester** individuellement chaque service
3. **Mettre à jour** les composants pour utiliser les nouveaux services
4. **Supprimer** les anciens fichiers/services
5. **Valider** que tout fonctionne comme avant

## Critères de succès

- [ ] La création de compagnie fonctionne exactement comme avant
- [ ] La création d'employé crée automatiquement un utilisateur Firebase Auth
- [ ] Les deux utilisent la même fonction `createFirebaseUser()`
- [ ] Aucune régression dans les fonctionnalités existantes
- [ ] Code plus maintenable et modulaire

## Risques et mitigations

**Risque** : Casser la création de compagnie existante
**Mitigation** : Tester soigneusement et préserver la logique existante

**Risque** : Duplication de code
**Mitigation** : Factoriser la logique commune dans `createFirebaseUser()`

**Risque** : Erreurs de migration
**Mitigation** : Migration progressive et tests à chaque étape