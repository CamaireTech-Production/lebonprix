## Plan d’implémentation détaillé – Utilisateurs, Rôles et Gestion des Employés

Ce document consolide `UserAnalyse.md`, `userImplemet.md` et `Usermanage.md` pour fournir une suite d’instructions claire, non redondante et exécutable.

---

### 1) Objectifs et portée
- Mettre en place un modèle d’employés par compagnie (`companies/{companyId}.employees[]`).
- Garantir une gestion d’invitation via `loginLink` (ou collection `invites/`) sans stocker les mots de passe en clair.
- Établir la cohérence avec les règles de sécurité Firestore existantes et la logique d’authentification.
- Créer un onglet de gestion des employés dans l’app (liste, ajout, édition, suppression, invitations).

Résultat attendu: un flux complet, sûr et robuste, de la création d’employés à l’activation de leur compte, intégré à l’app et à la sécurité.

---

### 2) Modèle de données et types
2.1 Types côté client
- Ajouter dans `src/types/models.ts`:
  - `export type UserRole = 'admin' | 'manager' | 'staff'`
  - `export interface CompanyEmployee { firstname: string; lastname: string; email: string; phone?: string; role: UserRole; birthday?: string; loginLink?: string; }`
  - Étendre `Company` avec `employees?: CompanyEmployee[]`

2.2 Séparation des identités
- Continuer d’utiliser Firebase Auth pour gérer les identités (email/mot de passe).
- Ne PAS stocker `password` dans Firestore.
- Conserver (ou introduire) `users/{uid}` pour les rôles globaux si nécessaire (aligné avec `firebase.rules`).

---

### 3) Sécurité Firestore
3.1 Règles existantes
- `firebase.rules` utilise `users/{uid}.role` pour `isAdmin()` et `isManager()`.

3.2 Ajustements recommandés
- Autoriser le propriétaire `companyId == request.auth.uid` à lire/mettre à jour sa compagnie, y compris `employees`.
- Si gestion par rôles: autoriser `admin/manager` (depuis `users/{uid}.role`) à écrire `employees`.

Exemple indicatif:
```
match /companies/{companyId} {
  allow read, update: if isAuthenticated() && request.auth.uid == companyId;
}
```

3.3 Invitations (Option B)
- Si `invites/{inviteId}` est introduit: lecture publique minimale (contenu non sensible), écriture réservée aux admins. Gérer les champs: `companyId`, `employeeEmail`, `claims/role`, `expiresAt`, `status`.

---

### 4) Migration de données
4.1 Script fourni
- `scripts/migrateCompanyEmployees.js` ajoute `employees: []` aux compagnies sans ce champ.

4.2 Exécution
- Dry-run: `DRY_RUN=1 node lebonprix/scripts/migrateCompanyEmployees.js`
- Réel: `node lebonprix/scripts/migrateCompanyEmployees.js`
- Prérequis: `lebonprix/firebase-service-account.json`

4.3 Sécurité migration
- Le script n’écrase pas de données existantes, ajoute seulement le champ manquant.

---

### 5) Contexte et APIs côté client
5.1 Chargement compagnie
- `AuthContext` charge `companies/{uid}`; `company.employees` sera disponible automatiquement.

5.2 Mise à jour
- Utiliser `updateCompany({ employees: [...] })` pour écrire l’état des employés.

5.3 Services utilitaires (à créer)
- `generateInviteId(): string` (UUID v4)
- `createEmployeeInvite(employee: CompanyEmployee)`
- `acceptInvite(inviteId: string, password: string)`

---

### 6) Onglet Employés (UI/UX)
6.1 Routage
- Ajouter `/settings/employees` (onglet ou sous-page de `Settings`).
- Ajouter `/invite/:inviteId` pour l’activation.

6.2 Composants (proposé)
- `EmployeesPage`: liste et actions.
- `EmployeeInviteModal`: formulaire d’invitation (firstname, lastname, email, role, phone?, birthday?).
- `EmployeeEditModal`: édition des champs non sensibles et du rôle.

6.3 Actions
- Inviter: génère `inviteId`, enregistre `loginLink`, envoie email.
- Copier/renvoyer invitation: récupère le lien et le partage.
- Modifier: met à jour `employees[i]` via `updateCompany`.
- Supprimer: soft delete (retirer du tableau) ou marquer un état `isDeleted` si nécessaire.

6.4 Validations
- Email format, unicité dans la compagnie.
- Rôle ∈ {admin, manager, staff}.
- `birthday` ISO `YYYY-MM-DD` si fourni.

---

### 7) Flux d’invitation et activation
7.1 Invitation (création)
- Générer `inviteId`.
- Option A (simple): stocker `loginLink = inviteId` dans `employees[i]`.
- Option B (scalable): créer `invites/{inviteId}` avec métadonnées (statut, expiration, claims).
- Envoyer email vers `/invite/:inviteId`.

7.2 Activation (page `/invite/:inviteId`)
- Récupérer l’invite (depuis `employees` ou `invites`).
- Demander de définir un mot de passe.
- Créer le compte Firebase Auth (email + mot de passe) ou initier un flow de réinitialisation.
- Marquer l’invitation comme `accepted`, purger `loginLink` dans `employees`.

---

### 8) Tests et validation
8.1 Tests unitaires
- Validation des champs employés (email, rôle, birthday).
- Génération d’invitation (inviteId unique).

8.2 Tests d’intégration
- Mise à jour `employees` via `updateCompany`.
- Parcours d’invitation: création → email → activation → Auth OK → purge `loginLink`.

8.3 Tests sécurité
- Accès aux docs `companies` limité à l’owner (ou admin/manager via `users/{uid}.role`).
- `invites/` lecture publique minimale sans données sensibles.

---

### 9) Déploiement et exploitation
9.1 Migration
- Lancer le script migration en dry-run, puis réel.

9.2 Configuration
- Variables d’env Firebase (Auth/Firestore), service account côté scripts.

9.3 Observabilité
- Logs d’invitation (création, renvoi, activation, échecs).

---

### 10) Roadmap incrémentale
1) Ajouter types et Migration (`employees: []`).
2) Créer UI `/settings/employees` (liste + invite).
3) Implémenter génération et persistance `loginLink` (Option A) puis, si besoin, migrer vers `invites/` (Option B).
4) Ajouter page `/invite/:inviteId` (activation Auth + purge du lien).
5) Ajuster `firebase.rules` si `invites/` est introduit et pour écriture `employees` par rôles.
6) Ajouter tests automatisés (validation, intégration, sécurité).




