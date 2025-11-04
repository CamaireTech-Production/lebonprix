## Implémentation: Employés par Compagnie (inspiré de `UserAnalyse.md`)

### Objectif
Étendre le modèle `Company` pour inclure un tableau `employees` pouvant être vide. Chaque employé est défini par: `firstname`, `lastname`, `password`, `email`, `phone`, `loginLink`, `role`, `birthday`.

Important: ne stockez jamais de mots de passe en clair dans Firestore. Utilisez Firebase Auth pour l’authentification des employés. Le champ `password` ne devrait pas être persisté en clair dans `employees`; s’il est requis, utilisez un flux d’invitation (lien magique `loginLink` ou réinitialisation de mot de passe).

---

### 1) Schéma proposé (Company)
Ajouter un champ optionnel `employees` de type tableau sur le document `companies/{companyId}`.

```typescript
// Exemple de types côté client
export type UserRole = 'admin' | 'manager' | 'staff';

export interface CompanyEmployee {
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  role: UserRole;
  birthday?: string; // ISO date (YYYY-MM-DD)
  loginLink?: string; // lien d'invitation / connexion
  // password: string; // Ne PAS stocker en clair; gérez via Firebase Auth
}

export interface Company /* étendre le modèle existant */ {
  // ...champs existants...
  employees?: CompanyEmployee[]; // peut être vide ou absent
}
```

Points clés:
- `employees` peut être omis ou un tableau vide.
- Gérez les mots de passe via Firebase Auth (création de comptes ou liens d’invitation). Évitez `password` en clair.

---

### 2) Migration Firestore
Un script Node.js (Admin SDK) met à jour chaque document `companies` pour y ajouter `employees: []` s’il n’existe pas encore, sans écraser les données.

Fichier: `scripts/migrateCompanyEmployees.js` (créé dans ce dépôt)

```bash
node scripts/migrateCompanyEmployees.js
```

Prérequis:
- Fichier d’identifiants service account: `lebonprix/firebase-service-account.json` (comme pour `scripts/testFirebase.js`).
- Variable d’environnement facultative `DRY_RUN=1` pour un essai à blanc.

Ce que fait la migration:
- Itère sur `companies`.
- Si `employees` est absent, le positionne à `[]` (tableau vide).
- N’écrase rien si le champ existe déjà.

---

### 3) Intégration côté application
1) Types: ajoutez `CompanyEmployee` et `employees?: CompanyEmployee[]` dans `src/types/models.ts`.

2) Chargement: `AuthContext` charge déjà `companies/{uid}`. L’attribut `employees` sera disponible dans `company` sans changement majeur.

3) Mise à jour: utilisez `updateCompany(...)` existant pour pousser des changements d’employés:

```typescript
// Exemple d’appel
await updateCompany({ employees: [
  { firstname: 'Ada', lastname: 'Lovelace', email: 'ada@ex.com', role: 'manager' },
  { firstname: 'Alan', lastname: 'Turing', email: 'alan@ex.com', role: 'staff' }
]});
```

4) Auth employé: créez les comptes employés via Firebase Auth (création par admin ou invitation par email). Stockez `loginLink` si vous mettez en place un flux d’invitation (ex: lien de réinitialisation de mot de passe).

5) UI: ajoutez un écran dans `Settings` pour lister/ajouter/éditer/supprimer des employés, avec validations (email unique par compagnie, rôle conforme, date valide).

---

### 4) Règles de sécurité Firestore (exemple)
Si `employees` contient des données personnelles, restreignez la lecture/écriture aux propriétaires/autorisés. Exemple indicatif:

```txt
match /companies/{companyId} {
  allow read, update: if isAuthenticated() && request.auth.uid == companyId; // propriétaire
}
```

Si vous gérez des rôles globaux via `users/{uid}.role`, adaptez les helpers `isAdmin()`/`isManager()` pour autoriser des mises à jour d’employés.

---

### 5) Script de migration (contenu et exécution)
Le script `scripts/migrateCompanyEmployees.js` ajoute `employees: []` là où manquant. Voir le fichier pour les logs et l’option `DRY_RUN`.

Étapes:
1. Placez `firebase-service-account.json` dans `lebonprix/`.
2. Exécutez un essai à blanc:
   - `DRY_RUN=1 node scripts/migrateCompanyEmployees.js`
3. Exécutez la migration:
   - `node scripts/migrateCompanyEmployees.js`

Rollback: le script n’écrase pas de données existantes et ne supprime rien; il ajoute seulement le champ manquant. Une sauvegarde n’est généralement pas nécessaire mais reste recommandée.

---

### 6) Bonnes pratiques
- Ne stockez pas les mots de passe en clair.
- Préférez un flux d’invitation et laissez Firebase Auth gérer l’authentification.
- Validez côté client et côté sécurité Firestore.
- Journalisez les changements et surveillez les échecs de migration.




