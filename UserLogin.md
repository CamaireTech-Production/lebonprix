## Plan – Lien Login Employé et Page de Connexion Préremplie

### 1) Analyse du lien Catalogue (référence)
- Route existante: `/catalogue/:companyName/:companyId` (voir `src/App.tsx`).
- Principe: paramètres d’URL pour identifier la compagnie et router vers le catalogue public.

### 2) Lien Login Employé – Format proposé
- Objectif: garder un schéma similaire et y inclure l’identifiant d’employé (via loginLink César).
- Route publique proposée: `/employee-login/:companyName/:companyId/:loginLink`
  - `companyName`: identique au catalogue
  - `companyId`: identique au catalogue
  - `loginLink`: valeur issue de `buildLoginLink(firstname, lastname)` (code de César, cf. `userAdd.md`), et stockée dans `companies/{companyId}.employees[].loginLink`

Alternative (query string): `/employee-login/:companyName/:companyId?token=:loginLink`.

### 3) Page EmployeeLogin – UI/Flux
- Emplacement: `src/pages/EmployeeLogin.tsx`
- Accès: route publique non protégée
- Au chargement:
  1) Extraire `companyName`, `companyId`, `loginLink` depuis l’URL.
  2) Charger la `company` (fallback Firestore si non dispo dans `AuthContext`) et rechercher l’employé par `loginLink` dans `company.employees`.
  3) Si employé trouvé: préremplir `firstname`, `lastname`, `email` (read-only). Champ `password` vide.
  4) Sinon: afficher message/état d’invitation invalide (toast + CTA contact admin).

- Formulaire:
  - Champs: `firstname` (disabled), `lastname` (disabled), `email` (disabled), `password` (required)
  - Bouton “Se connecter”

- Soumission:
  - Vérifier `password` non vide.
  - Tenter `signInWithEmailAndPassword(email, password)`.
  - Succès: rediriger vers `/catalogue/:companyName/:companyId`.
  - Échec: toast “Informations de connexion incorrectes”.

### 4) Contexte et Services
- Service public proposé: `services/companyPublic.ts` → `getCompanyById(companyId)`.
- Option: encapsuler la logique en hook `useEmployeeLogin(companyId, loginLink)` si réutilisation souhaitée.

### 5) Sécurité et Données
- Ne pas exposer d’infos sensibles; conserver `hashedPassword` côté Firestore mais ne jamais l’afficher.
- `loginLink` (César) sert d’identifiant, pas de secret.
- Si besoin d’un flux plus sûr, basculer vers `invites/{inviteId}` signé/expirant.

### 6) Routage
- Ajouter dans `src/App.tsx`:
  - `const EmployeeLogin = lazy(() => import('./pages/EmployeeLogin'));`
  - Route: `/employee-login/:companyName/:companyId/:loginLink` (publique)

### 7) Toasts & Redirections
- Utiliser `react-hot-toast`:
  - Échec: `showErrorToast('Informations de connexion incorrectes')`
  - Succès: `navigate('/catalogue/${companyName}/${companyId}')`

### 8) Étapes d’implémentation
1) Créer `services/companyPublic.ts` avec `getCompanyById(companyId)`.
2) Créer `pages/EmployeeLogin.tsx` (préremplissage, Auth sign-in, redirection/erreur).
3) Ajouter la route dans `App.tsx`.
4) Optionnel: bouton pour copier le lien dans l’onglet Employés.

### 9) Tests (plan)
- Rendu initial OK avec URL valide: champs nom/email préremplis, password vide.
- URL invalide: toast d’erreur.
- Soumission succès: redirection catalogue.
- Soumission échec: toast d’erreur.
- Accessibilité: labels ARIA, navigation clavier.


