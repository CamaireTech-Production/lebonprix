## Onglet Employés – Conception et Implémentation

### Objectif
Permettre à une compagnie de gérer ses employés dans un onglet dédié: lister, ajouter, éditer, supprimer et inviter des employés via un `loginLink` (identifiant d’invitation). Le mot de passe n’est jamais stocké en clair; l’employé le définira lui-même lors de l’activation de son compte.

---

### Modèle de données
- `companies/{companyId}`: ajout d’un champ `employees?: CompanyEmployee[]`.
- `CompanyEmployee` (proposé): `firstname`, `lastname`, `email`, `phone?`, `role`, `birthday?`, `loginLink?`.
- `loginLink`: identifiant d’invitation unique (ex: UUID) qui permet de retrouver l’employé et pré-remplir ses infos sans exposer de mot de passe.

Option A (simple): stocker `loginLink` directement dans `companies/{companyId}.employees[i].loginLink`.

Option B (scalable): créer une collection `invites/{inviteId}` contenant: `companyId`, `employeeEmail`, `claims`, `expiresAt`, `status`. L’employé accède à `/invite/:inviteId` pour activer son compte.

---

### Flux d’invitation (recommandé)
1) Admin ouvre l’onglet Employés, clique “Inviter un employé”.
2) Saisie: `firstname`, `lastname`, `email`, `role`, `phone?`, `birthday?`.
3) Génération `inviteId` (UUID) et enregistrement:
   - Option A: mettre `loginLink = inviteId` dans l’employé et enregistrer dans `employees`.
   - Option B: créer `invites/{inviteId}` en parallèle (recommandé si besoin d’expiration/suivi).
4) Envoi d’un email avec le lien d’activation: `/invite/:inviteId`.
5) Page `/invite/:inviteId`:
   - Récupère le profil (depuis `companies` ou `invites`).
   - Demande de définir un mot de passe et valide.
   - Crée le compte Firebase Auth (email + mot de passe) ou envoie un lien de réinitialisation si le compte existe.
   - Marque l’invitation `status = accepted` et supprime/annule `loginLink` côté `employees`.

---

### UI/UX – Onglet Employés
Sections:
- Liste des employés: tableau (nom, email, rôle, statut invitation, actions)
- Bouton “Inviter un employé” => modal de création
- Actions par ligne:
  - “Copier le lien d’invitation” (si en attente)
  - “Renvoyer l’invitation”
  - “Modifier” (rôle, téléphone, anniversaire, nom)
  - “Supprimer” (soft delete recommandé)

Validations:
- Email requis et formaté
- Rôle ∈ {admin, manager, staff}
- Unicité email dans la compagnie
- Date de naissance au format `YYYY-MM-DD` (si fourni)

États invitation (si Option B): `pending`, `accepted`, `expired`, `revoked`.

---

### Sécurité et règles Firestore
- Seul le propriétaire (ou admin) de `companies/{companyId}` peut lire/mettre à jour `employees`.
- Si rôles globaux (`users/{uid}.role`) sont utilisés, autoriser `admin/manager` à gérer les employés.
- L’invitation ne révèle que des infos non sensibles; le mot de passe est défini par l’employé à l’activation.

Exemple indicatif (à adapter):
```
match /companies/{companyId} {
  allow read, update: if isAuthenticated() && request.auth.uid == companyId;
}
match /invites/{inviteId} {
  allow read: if true; // page publique de vérification minimale
  allow write: if isAdmin(); // création/gestion par admin
}
```

---

### Intégration App
- Types: ajouter `CompanyEmployee` et `employees?: CompanyEmployee[]`.
- Contexte: `AuthContext` expose déjà `company`; l’onglet lit/écrit via `updateCompany({ employees: [...] })`.
- Routage:
  - `Settings > Employés` (onglet ou sous-page): `/settings/employees`
  - Page d’activation: `/invite/:inviteId`

API/Services côté client:
- `generateInviteId()`: UUID v4
- `createEmployeeInvite(employee)`: écrit `loginLink` et/ou doc `invites/{inviteId}`
- `acceptInvite(inviteId, password)`: crée compte Auth, met à jour statut, nettoie `loginLink`

---

### Étapes d’implémentation (résumé)
1) Migration: `employees: []` si manquant (script déjà fourni).
2) Types: ajouter `CompanyEmployee`, `UserRole` dans `src/types/models.ts`.
3) UI: créer un onglet `/settings/employees` avec liste + modal d’invitation.
4) Invite: générer `inviteId`, sauvegarder, envoyer email avec `/invite/:inviteId`.
5) Activation: page publique récupère l’invite, crée le compte Auth, marque “accepté”, retire `loginLink`.
6) Règles: ajuster la sécurité Firestore si `invites/` est introduit et pour la gestion employé.

---

### Notes techniques
- Ne jamais stocker `password` dans Firestore.
- Utiliser Firebase Auth (Email/Password) ou lien de réinitialisation.
- En production, ajouter expiration d’invitation (`expiresAt`) et signature du lien (ex: token JWT signé côté serveur) si nécessaire.




