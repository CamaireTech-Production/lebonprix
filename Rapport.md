## Rapport – Éléments manquants et recommandations d’implémentation

Ce rapport synthétise les écarts pour que l’ensemble Employés/Invitations/Login fonctionne de bout en bout. Basé sur: `userAdd.md`, `UserLogin.md`, `UserRapport.md`, `userVerify.md`, et la structure actuelle du projet.

---

### 1) Création de compte Employé (Firebase Auth)
**État actuel**
- Lors de l’ajout d’un employé, on génère `hashedPassword` (client) et `loginLink` mais on ne crée pas de compte Firebase Auth correspondant.
- La page `EmployeeLogin` tente un `signIn(email, password)` → échouera si le compte n’existe pas.

**À implémenter (option recommandée)**
- Côté back (script Admin SDK ou Cloud Function), créer le compte Auth à la création d’employé avec un mot de passe initial (ou envoyer un lien de réinitialisation).
- Exposer une route d’admin (script) pour provisionner en batch les comptes manquants.

**À implémenter (option côté client, limitée)**
- À l’activation via une page dédiée, si le compte n’existe pas: proposer `createUserWithEmailAndPassword` et lier l’employé à la compagnie (nécessite une logique claire pour ne pas créer une `company` supplémentaire). Cela impose des garde-fous et n’est pas idéal côté sécurité.

---

### 2) Règles Firestore – Accès public minimal
**État actuel**
- `EmployeeLogin` lit `companies/{companyId}` en public. Les règles actuelles peuvent restreindre cette lecture.

**À implémenter**
- Adapter `firebase.rules` pour autoriser une lecture minimale (nom, email, éventuellement `employees.loginLink`, mais pas de champs sensibles) ou exposer une collection/endpoint public minimal (ex: `companiesPublic/{companyId}`) alimenté via backend.

---

### 3) Flux d’invitation robuste (Option B)
**État actuel**
- `loginLink` (César) stocké dans `companies/{id}.employees[]`.

**À implémenter (recommandé)**
- Créer une collection `invites` pour gérer `inviteId`, `companyId`, `employeeEmail`, `role`, `expiresAt`, `status`.
- Ajuster la page d’activation/login pour vérifier `invites` et non une simple chaîne César.
- Mettre à jour les règles Firestore (lecture publique minimale des invites).

---

### 4) Alignement de la page d’activation
**État actuel**
- `InviteActivate` utilise `signUp` qui crée aussi une `company` (logique current-owner). Non adapté au compte employé.

**À implémenter**
- Remplacer le flux par: vérification de l’invite → création du compte Auth employé (ou reset) → liaison employé/compagnie → invalider l’invitation → redirection.

---

### 5) Envoi d’email d’invitation
**État actuel**
- Aucun envoi d’email. L’admin doit copier le lien manuellement.

**À implémenter**
- Intégrer un service d’email (EmailJS, Firebase Extensions, ou backend) pour envoyer le lien `/employee-login/:companyName/:companyId/:loginLink`.

---

### 6) Internationalisation (i18n)
**État actuel**
- Messages et labels ajoutés (Employees/EmployeeLogin) ne sont pas tous dans `i18n/locales/*.json`.

**À implémenter**
- Ajouter les clés i18n pour: labels (Employees, Copy link, Open, Login Employé, erreurs/confirmations), toasts.

---

### 7) Tests unitaires et d’intégration
**État actuel**
- Pas de tests pour les nouveaux modules.

**À implémenter** (conformément à `lebonprix/unit-test`)
- Tests pour:
  - `utils/security.ts` (hash builder, caesarCipher, buildLoginLink)
  - `EmployeesTab` (ajout, affichage lien, copy/open, sauvegarde)
  - `EmployeeLogin` (préremplissage, validation password, succès/erreur)
  - `services/companyPublic.ts` (lecture Firestore mockée)
- Mettre à jour `docs/UNIT_TESTING_STATUS.md`.

---

### 8) UX et robustesse
**État actuel**
- Lien affiché dépend de `window.location.origin` (OK en client).
- `copyLink`/`open` implémentés côté client.

**À implémenter**
- Bouton pour régénérer `loginLink` (rotation du lien) + confirmation.
- Indicateurs de statut d’invitation (pending/accepted/expired) si Option B activée.

---

### 9) Données héritées & migration
**État actuel**
- Script `migrateCompanyEmployees.js` pour ajouter `employees: []`.

**À implémenter**
- Script d’enrichissement pour peupler `loginLink` pour les employés existants.
- Script (Admin SDK) pour provisionner les comptes Auth employés existants et envoyer des resets.

---

### 10) Sécurité mots de passe
**État actuel**
- Hash côté client (SHA-256 Web Crypto) implémenté en placeholder.

**À implémenter**
- Centraliser la logique de hash côté serveur (Admin) si stockage requis; sinon, ne pas stocker de hash dans Firestore et s’appuyer uniquement sur Firebase Auth.

---

## Check-list d’implémentation suggérée
1) Backend/Script: création comptes Auth employés + envoi email (ou reset).
2) Règles Firestore: lecture publique minimale (company public/invites) + rôles.
3) Option B: collection `invites` et ajustement de la page d’activation.
4) `InviteActivate`: aligner le flux pour employés (plus de création de `company`).
5) i18n: ajouter les clés manquantes.
6) Tests: ajouter tests unitaires/intégration des nouveaux modules.
7) Scripts migration: générer `loginLink` pour anciens employés et provisionner Auth.


