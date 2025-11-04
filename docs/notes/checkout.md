## Login Checkout – Analyse du flux et constats

### 1) Formulaire Login (src/pages/auth/Login.tsx)
- Au submit, appelle `signIn(email, password)` puis `navigate('/')` en cas de succès.
- Messages d’erreur basiques si champs vides ou si l’auth échoue.

### 2) AuthContext (src/contexts/AuthContext.tsx)
- `signIn(email, password)` délègue à `signInWithEmailAndPassword(auth, email, password)` (Firebase Auth).
- Après authentification (onAuthStateChanged), la compagnie est chargée: `getDoc(doc(db,'companies', user.uid))`.

### 3) Causes probables d’échec
- Aucun compte Firebase Auth correspondant à l’email (provisionnement manquant). Le formulaire renvoie "Failed to sign in".
- Mot de passe incorrect (l’app ne fait pas de mapping entre `employees.hashedPassword` et Firebase Auth; elle repose sur `signInWithEmailAndPassword`).
- Règles Firestore n’impactent pas la connexion, mais la suite (chargement company) échoue si doc `companies/{uid}` absent.

### 4) Écarts identifiés
- Les employés ajoutés via l’onglet ne créent pas automatiquement un compte Auth. Le login échoue tant que le compte n’est pas provisionné.
- La page `EmployeeLogin` utilise aussi `signIn` standard: nécessite que l’employé existe dans Firebase Auth.

### 5) Recommandations
- Utiliser le script Admin: `scripts/provisionEmployees.js` pour créer les comptes Auth employés (DRY_RUN pour tester).
- Optionnel: à l’ajout d’un employé, déclencher un workflow (backend/Cloud Function) pour provisionner le compte et envoyer l’invitation.
- S’assurer que `companies/{uid}` existe pour l’utilisateur connecté (owner). Pour employés, charger la compagnie via `companyPublic` au besoin.


