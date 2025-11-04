## Onglet Employés – Plan d’implémentation et design

### Objectif
Proposer un onglet dédié à la gestion des employés, intégré aux Paramètres, permettant de lister, ajouter, modifier et supprimer des employés dans une interface élégante et claire (tableau responsive + modales).

---

### Emplacement et Routage
- Intégration dans `Settings` via un onglet "Employees" (déjà présent si `Settings.tsx` est utilisé).
- Route: `/settings` puis onglet interne `employees` (pas d’URL dédiée nécessaire, navigation par état d’onglet).

---

### Données et Modèle
- Source: `companies/{companyId}.employees` (tableau d’objets `CompanyEmployee`).
- Type `CompanyEmployee` (déjà ajouté):
  - `firstname`, `lastname`, `email`, `phone?`, `role`, `birthday?`, `loginLink?`, `hashedPassword?`
- Mise à jour: via `updateCompany({ employees })` exposé par `AuthContext`.

---

### Composants UI
- `EmployeesTab` (conteneur principal):
  - En-tête avec titre et CTA "Add employee" (ouvre une modale de création).
  - Tableau responsive pour la liste des employés:
    - Colonnes: Nom, Email, Rôle, Téléphone, Anniversaire, Actions
    - Actions par ligne: Edit, Delete, Copy Link, Open
  - Bouton "Save" global pour persister les changements groupés (ou sauvegarde immédiate selon choix UX).

- `EmployeeInviteModal` (proposé):
  - Formulaire d’ajout: `firstname`, `lastname`, `email`, `role`, `phone?`, `birthday?`.
  - Validation: email requis/valide, rôle ∈ {admin, manager, staff}, unicité email par compagnie.
  - Génération automatique: `hashedPassword` (par défaut `{firstname}123{lastname}` hashé) et `loginLink` (César sur `firstname+lastname`).

- `EmployeeEditModal` (proposé):
  - Permet de modifier les champs non sensibles: `firstname`, `lastname`, `email`, `role`, `phone`, `birthday`.
  - Conserve `loginLink` existant (option: régénérer avec confirmation).

---

### Look & Feel (style élégant)
- Table au style épuré (bordures légères, hover states, lignes alternées sur mobile).
- Boutons primaires/secondaires cohérents avec la charte (par ex. Emerald/Indigo).
- Modales centrées, arrondies, ombrées, avec champs bien espacés.
- Messages d’aide et toasts de confirmation/erreur discrets mais visibles.

---

### Actions et Comportements
- Ajouter: ouvre la modale d’invitation → ajoute en mémoire → "Save" persiste via `updateCompany`.
- Modifier: ouvre la modale d’édition → met à jour la ligne → "Save" persiste.
- Supprimer: action par ligne avec confirmation (soft delete en retirant l’élément du tableau puis "Save").
- Copy Link / Open: construit l’URL publique `/employee-login/:companyName/:companyId/:loginLink` et propose copier/ouverture nouvel onglet.
- Validations: côté client (email/format/rôle/unicité), messages d’erreur via toasts.

---

### Sécurité & Données sensibles
- Ne pas afficher/stocker de mot de passe en clair.
- `hashedPassword` peut être conservé si requis, mais privilégier Firebase Auth pour l’authentification réelle.
- `loginLink` est un identifiant; pour un flux avancé, préférer des `invites/{inviteId}` avec expiration et statut.

---

### Intégrations
- `AuthContext.updateCompany` pour la persistance.
- `utils/security` pour hash du mot de passe par défaut et génération `loginLink` (César).
- `services/invites` (Option B) si on passe sur une collection d’invitations robuste.

---

### Tests à prévoir
- Rendu du tableau et pagination responsive.
- Ajout/édition/suppression avec validations et toasts.
- Génération du lien et actions Copy/Open.
- Persistance via `updateCompany` (mock Firestore).


