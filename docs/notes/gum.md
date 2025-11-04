## Plan d’action – Résolution des problèmes et complétude des fichiers

### 1) Erreur Vite (import InviteActivate introuvable)
- Symptôme: Failed to resolve import "./pages/InviteActivate" from `src/App.tsx`.
- Causes possibles:
  - Chemin ou casse de fichier incorrects.
  - Caractères spéciaux dans le chemin projet impactant l’analyse (répertoire avec `&`).
  - Cache Vite.
- Actions:
  1) Confirmer l’existence de `src/pages/InviteActivate.tsx` et l’export par défaut.
  2) S’assurer que l’import dans `App.tsx` correspond exactement au chemin et casse.
  3) Éviter d’ouvrir via un chemin contenant `&` (mauvaise expansion shell). Toujours ouvrir le workspace correct.
  4) Redémarrer Vite (arrêt/démarrage) et vider le cache si nécessaire.
  5) Si besoin, renommer temporairement le fichier en `InviteActivate/index.tsx` et importer `./pages/InviteActivate/index`.

### 2) Création de comptes Auth employés
- Implémenter un script Admin SDK pour provisionner les comptes manquants à partir de `companies/{id}.employees`.
- Option: Cloud Function déclenchée à l’update de `employees`.

### 3) Règles Firestore (lecture publique minimale)
- Adapter `firebase.rules` pour autoriser la lecture des champs publics nécessaires à `EmployeeLogin`, ou créer une vue publique `companiesPublic/` alimentée par backend.

### 4) Flux d’invitation robuste (Option B)
- Créer `invites` avec `inviteId`, `companyId`, `employeeEmail`, `role`, `expiresAt`, `status`.
- Adapter `EmployeeLogin`/`InviteActivate` pour vérifier `invites`.

### 5) Aligner `InviteActivate`
- Remplacer l’usage de `signUp` (création company) par un flux dédié employé: vérification, création Auth/Reset, liaison, invalidation.

### 6) i18n
- Ajouter les traductions manquantes pour libellés et toasts.

### 7) Tests
- Ajouter tests unitaires (`security.ts`, `companyPublic.ts`) et composants (`EmployeesTab`, `EmployeeLogin`).

### 8) Scripts de migration
- Générer `loginLink` pour les employés existants et provisionner les comptes Auth.

### 9) Vérifications finales
- Build dev: Vite démarre sans erreur d’import.
- Parcours: lien `EmployeesTab` → page `EmployeeLogin` → connexion → redirection catalogue.
- Règles Firestore: lectures minimales OK (ou via vue publique).


