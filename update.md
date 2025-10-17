# Méthodologie pour la création automatique d'utilisateurs Firebase Auth lors de l'ajout d'employés

## Vue d'ensemble

L'objectif est de créer automatiquement un utilisateur Firebase Auth avec un mot de passe par défaut non hashé lors de l'ajout d'un nouvel employé dans l'interface. L'employé aura un ID unique qui permettra de l'identifier de manière univoque.

## Architecture proposée

### 1. Modèle de données mis à jour

```typescript
// src/types/models.ts
export interface CompanyEmployee {
  id: string; // ID unique généré automatiquement
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  role: UserRole;
  birthday?: string;
  loginLink?: string; // lien d'invitation / connexion
  firebaseUid?: string; // UID Firebase Auth (optionnel, pour liaison)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 2. Service de création d'utilisateur Firebase Auth

```typescript
// src/services/employeeAuth.ts
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from './firebase';

export interface CreateEmployeeUserParams {
  email: string;
  password: string;
  displayName: string;
}

export const createEmployeeUser = async ({
  email,
  password,
  displayName
}: CreateEmployeeUserParams): Promise<string> => {
  try {
    // Créer l'utilisateur Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Mettre à jour le profil avec le nom d'affichage
    await updateProfile(user, {
      displayName: displayName
    });
    
    return user.uid;
  } catch (error) {
    console.error('Erreur lors de la création de l\'utilisateur:', error);
    throw new Error(`Impossible de créer l'utilisateur: ${error.message}`);
  }
};
```

### 3. Service de gestion des employés mis à jour

```typescript
// src/services/employees.ts
import { doc, setDoc, updateDoc, deleteDoc, collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { CompanyEmployee, UserRole } from '../types/models';
import { createEmployeeUser } from './employeeAuth';
import { buildLoginLink, makeDefaultEmployeePassword } from '../utils/security';

export const addEmployeeWithAuth = async (
  companyId: string,
  employeeData: Omit<CompanyEmployee, 'id' | 'firebaseUid' | 'createdAt' | 'updatedAt'>
): Promise<CompanyEmployee> => {
  try {
    // 1. Générer un ID unique pour l'employé
    const employeeId = `emp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 2. Créer le mot de passe par défaut
    const defaultPassword = makeDefaultEmployeePassword(employeeData.firstname, employeeData.lastname);
    
    // 3. Créer l'utilisateur Firebase Auth
    const firebaseUid = await createEmployeeUser({
      email: employeeData.email,
      password: defaultPassword,
      displayName: `${employeeData.firstname} ${employeeData.lastname}`
    });
    
    // 4. Générer le loginLink
    const loginLink = buildLoginLink(employeeData.firstname, employeeData.lastname, 3);
    
    // 5. Créer l'objet employé complet
    const newEmployee: CompanyEmployee = {
      ...employeeData,
      id: employeeId,
      firebaseUid,
      loginLink,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // 6. Sauvegarder dans Firestore
    const employeeRef = doc(db, 'companies', companyId, 'employees', employeeId);
    await setDoc(employeeRef, newEmployee);
    
    // 7. Mettre à jour la liste des employés dans le document company
    const companyRef = doc(db, 'companies', companyId);
    await updateDoc(companyRef, {
      [`employees.${employeeId}`]: newEmployee
    });
    
    return newEmployee;
  } catch (error) {
    console.error('Erreur lors de l\'ajout de l\'employé:', error);
    throw error;
  }
};

export const updateEmployee = async (
  companyId: string,
  employeeId: string,
  updates: Partial<CompanyEmployee>
): Promise<void> => {
  const employeeRef = doc(db, 'companies', companyId, 'employees', employeeId);
  await updateDoc(employeeRef, {
    ...updates,
    updatedAt: new Date()
  });
  
  // Mettre à jour aussi dans le document company
  const companyRef = doc(db, 'companies', companyId);
  await updateDoc(companyRef, {
    [`employees.${employeeId}.updatedAt`]: new Date(),
    ...Object.keys(updates).reduce((acc, key) => {
      acc[`employees.${employeeId}.${key}`] = updates[key];
      return acc;
    }, {})
  });
};

export const removeEmployee = async (
  companyId: string,
  employeeId: string
): Promise<void> => {
  // Supprimer de la sous-collection
  const employeeRef = doc(db, 'companies', companyId, 'employees', employeeId);
  await deleteDoc(employeeRef);
  
  // Supprimer du document company
  const companyRef = doc(db, 'companies', companyId);
  await updateDoc(companyRef, {
    [`employees.${employeeId}`]: null
  });
};
```

### 4. Mise à jour du composant EmployeesTab

```typescript
// src/components/settings/EmployeesTab.tsx
import { addEmployeeWithAuth } from '../services/employees';

// Dans la fonction addEmployee
const addEmployee = async () => {
  if (!newEmployee.firstname || !newEmployee.lastname || !newEmployee.email) {
    showErrorToast('Veuillez remplir tous les champs obligatoires');
    return;
  }

  try {
    setIsLoading(true);
    
    // Utiliser le nouveau service qui crée automatiquement l'utilisateur Firebase Auth
    const createdEmployee = await addEmployeeWithAuth(companyId, {
      firstname: newEmployee.firstname,
      lastname: newEmployee.lastname,
      email: newEmployee.email,
      phone: newEmployee.phone,
      role: newEmployee.role,
      birthday: newEmployee.birthday
    });
    
    // Ajouter à la liste locale
    setEmployees(prev => [...prev, createdEmployee]);
    
    // Réinitialiser le formulaire
    setNewEmployee({
      firstname: '',
      lastname: '',
      email: '',
      phone: '',
      role: 'staff',
      birthday: ''
    });
    
    showSuccessToast('Employé créé avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'ajout de l\'employé:', error);
    showErrorToast(error.message || 'Erreur lors de la création de l\'employé');
  } finally {
    setIsLoading(false);
  }
};
```

## Avantages de cette approche

1. **ID unique** : Chaque employé a un ID unique généré automatiquement
2. **Authentification intégrée** : Création automatique d'un utilisateur Firebase Auth
3. **Mot de passe par défaut** : Utilisation du format `{firstname}123{lastname}` non hashé
4. **Synchronisation** : Les données sont stockées à la fois dans une sous-collection et dans le document company
5. **Gestion d'erreurs** : Gestion complète des erreurs avec messages utilisateur
6. **Flexibilité** : Possibilité de lier l'employé à son UID Firebase Auth

## Considérations de sécurité

1. **Permissions Firestore** : Mettre à jour les règles pour permettre la création d'utilisateurs
2. **Validation côté serveur** : Implémenter des Cloud Functions pour valider les données
3. **Audit trail** : Conserver un historique des modifications
4. **Gestion des erreurs** : Rollback en cas d'échec partiel

## Étapes d'implémentation

1. Mettre à jour le modèle `CompanyEmployee` avec l'ID unique
2. Créer le service `employeeAuth.ts`
3. Créer le service `employees.ts` avec les nouvelles fonctions
4. Mettre à jour `EmployeesTab.tsx` pour utiliser le nouveau service
5. Tester la création d'employés avec authentification
6. Mettre à jour les règles Firestore si nécessaire
7. Implémenter la gestion d'erreurs et les rollbacks

## Migration des employés existants

Pour les employés existants sans ID unique :

```typescript
// scripts/migrateEmployeeIds.js
export const migrateEmployeeIds = async (companyId: string) => {
  const companyRef = doc(db, 'companies', companyId);
  const companySnap = await getDoc(companyRef);
  
  if (companySnap.exists()) {
    const company = companySnap.data();
    const employees = company.employees || {};
    
    for (const [key, employee] of Object.entries(employees)) {
      if (!employee.id) {
        const newId = `emp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await updateDoc(companyRef, {
          [`employees.${key}.id`]: newId
        });
      }
    }
  }
};
```

Cette méthodologie assure une intégration complète entre la gestion des employés et l'authentification Firebase, tout en maintenant la cohérence des données et la sécurité du système.
