## Plan d’implémentation – Provision des comptes employés sans hash en base

### 0) État actuel (résumé)
- Les employés sont stockés dans `companies/{companyId}.employees[]` (types `CompanyEmployee`).
- L’UI `EmployeesTab` permet d’ajouter/éditer/supprimer et génère `loginLink`.
- Le login s’appuie sur Firebase Auth (`signInWithEmailAndPassword`).
- Problème: certains employés n’ont pas de compte Auth → échec login. Le champ `hashedPassword` côté Firestore n’est pas utile et doit être supprimé.

---

### 1) Cible
- Ne plus stocker de hash en Firestore.
- Créer automatiquement un compte Auth pour chaque employé nouvellement ajouté avec mot de passe par défaut `{firstname}123{lastname}`.
- Faciliter la migration des données existantes (provisionnement + suppression du champ `hashedPassword`).

---

### 2) Changements côté UI (immédiat)
- `src/components/settings/EmployeesTab.tsx`:
  - Retirer l’ajout de `hashedPassword` lors de la création d’un employé. Ne stocker que les champs non sensibles + `loginLink`.
  - Après `updateCompany`, déclencher une action de provisioning (voir §4 Flux). Option A: laisser faire une Cloud Function automatique; Option B: appeler une Callable.

---

### 3) Backend/Automatisation
- Option recommandée: Cloud Function (automatique)
  - Déclencheur Firestore sur `companies/{companyId}` (onWrite/onUpdate):
    - Détecter les nouveaux employés (présents dans `after` mais pas dans `before`).
    - Pour chaque nouvel employé: si pas d’utilisateur Auth existant → `admin.auth().createUser({ email, password: firstname + '123' + lastname })`.
    - NE RIEN écrire du mot de passe dans Firestore.
  - Avantage: pas d’action manuelle depuis l’UI; robuste et consistant.

- Alternative: Callable Function (déclenchée par l’UI)
  - Endpoint `createEmployeeAuth(email, firstname, lastname)`.
  - L’UI appelle la Callable pour chaque nouvel employé après `updateCompany`.
  - À sécuriser (accès admin uniquement).

---

### 4) Flux proposé (UI → Auth)
- Ajout employé dans `EmployeesTab` → `updateCompany({ employees })`.
- Provisioning:
  - Si Cloud Function: no-op côté client; la fonction crée les comptes automatiquement.
  - Si Callable: l’UI enchaîne un appel par nouvel employé ajouté.
- Envoi d’invitation (optionnel): e-mail avec lien `/employee-login/:companyName/:companyId/:loginLink`.

---

### 5) Migration des données existantes
- Provisionner les comptes pour les employés existants:
  - Script Admin fourni: `scripts/provisionEmployees.js` (mot de passe par défaut si non existant).
  - DRY_RUN, puis run réel.
- Supprimer `hashedPassword` de Firestore:
  - Script Admin `scripts/stripHashedPassword.js` (cf. exemple dans userAdd.md): met à jour `companies` en supprimant la clé sur chaque employé.

---

### 6) Règles Firestore
- Aucune règle spécifique pour l’auth; ajuster si une collection `invites` est ajoutée (lecture publique minimale).
- S’assurer que l’UI ne lit/écrit que ce qui est autorisé pour `companies/{companyId}`.

---

### 7) Tests & Validation
- Unit:
  - `security.ts`: ne plus tester la génération de hash dans l’UI.
  - `EmployeesTab`: ajout/édition/suppression, génération `loginLink`, persistance.
  - `companyPublic.ts`: lecture de compagnie pour employee login.
- Intégration:
  - Parcours: Ajout employé → provisioning (CF ou Callable) → login avec `{firstname}123{lastname}` → redirection catalogue.
- E2E (manuel):
  - Cas e-mail déjà existant → ne pas recréer; logs ok.

---

### 8) Déploiement & Rollout
- Étape 1: retirer `hashedPassword` côté UI et déployer (aucun impact critique).
- Étape 2: déployer Cloud Function (ou Callable) et scripts Admin.
- Étape 3: exécuter `generateLoginLinks.js` (si nécessaire) puis `provisionEmployees.js` pour anciens employés.
- Étape 4: exécuter `stripHashedPassword.js` pour nettoyer la base.
- Étape 5: supervision logs (CF/Admin) et retour utilisateurs.

---

### 9) Suivi des risques
- Collisions e-mail: gérer le cas où l’e-mail existe déjà (ignorer et logguer).
- Conformité: ne jamais stocker de mots de passe en clair dans Firestore.
- Sécurité Callable: vérifier rôle admin dans `req.auth`.


