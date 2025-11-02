# Guide de Lecture des EmployeeRefs

## Vue d'ensemble

Ce guide explique comment lire et afficher les employés d'une entreprise dans l'application Le Bon Prix. L'architecture utilise deux sources de données :

1. **`company.employees{}`** - Lecture rapide pour l'affichage
2. **Sous-collection `employeeRefs`** - Source de vérité pour les opérations

## Architecture des Données

### Structure Firestore

```typescript
// Document companies/{companyId}
{
  name: "bobyshopz",
  companyId: "userId-du-owner",
  employees: {                              // Miroir pour lecture rapide
    "userId1": {
      firstname: "bob",
      lastname: "spong", 
      email: "bob@bo.bob",
      role: "owner"
    },
    "userId2": {
      firstname: "john",
      lastname: "doe",
      email: "john@example.com", 
      role: "admin"
    }
  },
  employeeCount: 2                          // Compteur rapide
}

// Sous-collection companies/{companyId}/employeeRefs/{userId}
// (Source de vérité, inchangée)
{
  id: "userId1",
  firstname: "bob",
  lastname: "spong",
  email: "bob@bo.bob",
  role: "owner",
  addedAt: Timestamp
}
```

## Services Disponibles

### 1. `employeeDisplayService.ts` - Lecture et Affichage

#### Lecture Rapide depuis `company.employees{}`

```typescript
import { getEmployeesFromCompanyDoc, getEmployeeCount } from '@/services/employeeDisplayService';

// Récupérer tous les employés (rapide)
const employees = await getEmployeesFromCompanyDoc(companyId);
console.log(employees);
// Résultat: { "userId1": { firstname: "bob", lastname: "spong", ... }, ... }

// Récupérer le nombre d'employés (très rapide)
const count = await getEmployeeCount(companyId);
console.log(count); // 2

// Vérifier si un utilisateur est employé
const isEmployee = await isUserEmployeeOfCompany(companyId, userId);
console.log(isEmployee); // true/false

// Obtenir le rôle d'un employé
const role = await getEmployeeRole(companyId, userId);
console.log(role); // "owner", "admin", etc.
```

#### Lecture depuis Sous-collection (Source de Vérité)

```typescript
import { getEmployeesFromSubcollection } from '@/services/employeeDisplayService';

// Récupérer les employés depuis la sous-collection
const employees = await getEmployeesFromSubcollection(companyId);
console.log(employees);
// Résultat: [{ id: "userId1", firstname: "bob", role: "owner", addedAt: ... }, ...]
```

### 2. `userCompanySyncService.ts` - Synchronisation

#### Ajouter un Employé

```typescript
import { addUserToCompany } from '@/services/userCompanySyncService';

await addUserToCompany(
  userId,           // ID de l'utilisateur
  companyId,        // ID de l'entreprise
  {
    name: "bobyshopz",
    description: "Mon entreprise",
    logo: "base64..."
  },
  {
    firstname: "bob",
    lastname: "spong",
    email: "bob@bo.bob"
  },
  "admin"           // Rôle
);
// ✅ Crée employeeRef + met à jour company.employees{} + users.companies[]
```

#### Supprimer un Employé

```typescript
import { removeUserFromCompany } from '@/services/userCompanySyncService';

await removeUserFromCompany(userId, companyId);
// ✅ Supprime employeeRef + retire de company.employees{} + users.companies[]
```

#### Mettre à Jour un Rôle

```typescript
import { updateUserRole } from '@/services/userCompanySyncService';

await updateUserRole(userId, companyId, "manager");
// ✅ Met à jour employeeRef + company.employees{} + users.companies[]
```

## Quand Utiliser Chaque Méthode

### Utiliser `company.employees{}` (Lecture Rapide)

✅ **Pour l'affichage dans l'UI :**
- Liste des employés dans un tableau
- Nombre d'employés dans un dashboard
- Vérification rapide des permissions
- Affichage des rôles

```typescript
// Exemple: Afficher la liste des employés
const employees = await getEmployeesFromCompanyDoc(companyId);
const employeeList = Object.values(employees).map(emp => ({
  name: `${emp.firstname} ${emp.lastname}`,
  email: emp.email,
  role: emp.role
}));
```

### Utiliser la Sous-collection (Source de Vérité)

✅ **Pour les opérations complexes :**
- Recherche avancée d'employés
- Tri par date d'ajout
- Filtrage par critères spécifiques
- Opérations de gestion détaillées

```typescript
// Exemple: Employés triés par date d'ajout
const employees = await getEmployeesFromSubcollection(companyId);
const sortedEmployees = employees.sort((a, b) => 
  b.addedAt.toDate() - a.addedAt.toDate()
);
```

## Gestion des Incohérences

### Détecter les Incohérences

```typescript
import { detectEmployeeInconsistencies } from '@/services/employeeDisplayService';

const report = await detectEmployeeInconsistencies(companyId);
console.log(report);

// Résultat:
{
  isConsistent: false,
  issues: [
    "Nombre d'employés différent: company.employees=2, sous-collection=3",
    "Employé userId3 présent dans sous-collection mais absent de company.employees{}"
  ],
  details: {
    missingInCompany: ["userId3"],
    missingInSubcollection: [],
    roleMismatches: [],
    countMismatch: true,
    companyCount: 2,
    subcollectionCount: 3
  }
}
```

### Réparer les Incohérences

```typescript
import { repairEmployeeSync } from '@/services/employeeDisplayService';

// Synchronise depuis la sous-collection (source de vérité)
await repairEmployeeSync(companyId);
console.log('✅ Synchronisation réparée');
```

## Exemples d'Usage dans l'UI

### 1. Dashboard avec Nombre d'Employés

```typescript
// Component Dashboard
import { getEmployeeCount } from '@/services/employeeDisplayService';

function Dashboard({ companyId }) {
  const [employeeCount, setEmployeeCount] = useState(0);
  
  useEffect(() => {
    getEmployeeCount(companyId).then(setEmployeeCount);
  }, [companyId]);
  
  return (
    <div>
      <h2>Dashboard</h2>
      <p>Employés: {employeeCount}</p>
    </div>
  );
}
```

### 2. Liste des Employés

```typescript
// Component EmployeeList
import { getEmployeesFromCompanyDoc } from '@/services/employeeDisplayService';

function EmployeeList({ companyId }) {
  const [employees, setEmployees] = useState({});
  
  useEffect(() => {
    getEmployeesFromCompanyDoc(companyId).then(setEmployees);
  }, [companyId]);
  
  return (
    <div>
      <h3>Employés ({Object.keys(employees).length})</h3>
      {Object.values(employees).map(emp => (
        <div key={emp.id}>
          <span>{emp.firstname} {emp.lastname}</span>
          <span className="role">{emp.role}</span>
        </div>
      ))}
    </div>
  );
}
```

### 3. Vérification de Permissions

```typescript
// Hook pour vérifier les permissions
import { getEmployeeRole } from '@/services/employeeDisplayService';

function useEmployeePermissions(companyId, userId) {
  const [role, setRole] = useState(null);
  
  useEffect(() => {
    getEmployeeRole(companyId, userId).then(setRole);
  }, [companyId, userId]);
  
  return {
    isOwner: role === 'owner',
    isAdmin: role === 'admin',
    isManager: role === 'manager',
    isStaff: role === 'staff',
    canManageEmployees: ['owner', 'admin'].includes(role),
    canViewReports: ['owner', 'admin', 'manager'].includes(role)
  };
}
```

## Migration des Données Existantes

### Script de Migration

```bash
# Vérifier les incohérences
node scripts/migrateEmployeesToCompanyDoc.cjs --check

# Simulation de la migration
node scripts/migrateEmployeesToCompanyDoc.cjs --dry-run

# Migration réelle
node scripts/migrateEmployeesToCompanyDoc.cjs --execute
```

### Rapport de Migration

Le script génère un rapport détaillé :

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "mode": "execute",
  "duration": 45,
  "companiesProcessed": 5,
  "summary": {
    "successCount": 5,
    "errorCount": 0,
    "totalEmployees": 12
  },
  "results": [
    {
      "companyId": "company1",
      "companyName": "bobyshopz",
      "success": true,
      "employeesProcessed": 3,
      "message": "Migration réussie"
    }
  ]
}
```

## Bonnes Pratiques

### 1. Performance

- ✅ Utilisez `company.employees{}` pour l'affichage fréquent
- ✅ Utilisez la sous-collection pour les opérations ponctuelles
- ✅ Cachez les données en local si nécessaire

### 2. Cohérence

- ✅ Toujours utiliser `userCompanySyncService` pour les modifications
- ✅ Vérifiez les incohérences périodiquement
- ✅ Réparez automatiquement en cas d'erreur

### 3. Gestion d'Erreurs

```typescript
try {
  const employees = await getEmployeesFromCompanyDoc(companyId);
  // Utiliser les données
} catch (error) {
  console.error('Erreur lors de la récupération des employés:', error);
  // Fallback vers la sous-collection
  const employees = await getEmployeesFromSubcollection(companyId);
}
```

### 4. Tests

```typescript
// Test de cohérence
describe('Employee Sync', () => {
  it('should maintain consistency between sources', async () => {
    const report = await detectEmployeeInconsistencies(companyId);
    expect(report.isConsistent).toBe(true);
  });
});
```

## Dépannage

### Problèmes Courants

1. **Données manquantes dans `company.employees{}`**
   - Solution: Exécuter `repairEmployeeSync(companyId)`

2. **Nombre d'employés incorrect**
   - Solution: Vérifier avec `detectEmployeeInconsistencies()`

3. **Rôles différents entre sources**
   - Solution: Utiliser `updateUserRole()` pour resynchroniser

### Logs de Débogage

```typescript
// Activer les logs détaillés
console.log('🔍 Vérification de cohérence...');
const report = await detectEmployeeInconsistencies(companyId);
console.log('📊 Rapport:', report);
```

## Conclusion

Cette architecture offre le meilleur des deux mondes :
- **Performance** avec `company.employees{}` pour l'affichage
- **Flexibilité** avec la sous-collection pour les opérations complexes
- **Cohérence** grâce à la synchronisation automatique

Utilisez toujours les services fournis plutôt que d'accéder directement à Firestore pour garantir la cohérence des données.
