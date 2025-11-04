## Récap des rôles et périmètres de contrôle (LeBonPrix)

Ce document synthétise les rôles employés et les sections de l'application qu'ils peuvent contrôler, d'après les règles Firestore (`firebase.rules`) et la doc d'employés.

### Rôles disponibles
- **admin**
- **manager**
- **staff**

### Sections et actions

#### Produits (`products/*`)
- **admin**: créer, modifier, supprimer, lire
- **manager**: créer, modifier, lire
- **staff**: lire

#### Ventes (`sales/*`)
- **admin**: lire, créer, modifier, supprimer; peut modifier toute vente
- **manager**: lire, créer, modifier; peut modifier toute vente
- **staff**: lire, créer; peut modifier uniquement ses propres ventes

#### Dépenses (`expenses/*`)
- **admin**: lire, créer, modifier, supprimer
- **manager**: lire, créer, modifier
- **staff**: lire

#### Profils utilisateurs (`users/*`)
- **admin**: lire tous, mettre à jour n'importe quel profil, supprimer des profils
- **manager**: lire (authentifié), mettre à jour son propre profil
- **staff**: lire (authentifié), mettre à jour son propre profil

#### Employés d'entreprise (`companies/{companyId}/employees/*`)
- Droits d'écriture réservés au propriétaire de l'entreprise (champ `companies/{companyId}.userId == request.auth.uid`).
- En pratique:
  - **admin (propriétaire)**: créer, modifier, supprimer des employés; lire
  - **autres rôles**: lecture possible si authentifiés; pas de création/modification/suppression sauf si également propriétaire

#### Journaux d'audit (`auditLogs/*`)
- Tous rôles: peuvent lire et créer leurs propres logs (ceux dont `performedBy == request.auth.uid`). Pas de mise à jour/suppression.

### Vue synthétique par rôle

- **admin**:
  - Contrôle total sur Produits, Ventes, Dépenses (incluant suppression)
  - Administration des Profils utilisateurs (MAJ/suppression)
  - Gestion des Employés s'il est propriétaire de l'entreprise
  - Accède/lit ses journaux d'audit

- **manager**:
  - Gestion opérationnelle sur Produits (création/modification)
  - Gestion opérationnelle sur Ventes (création/modification globales)
  - Gestion opérationnelle sur Dépenses (création/modification)
  - Mise à jour de son propre profil
  - Lecture employés/audit selon règles ci-dessus

- **staff**:
  - Ventes: création + modification de ses propres ventes
  - Lecture Produits et Dépenses
  - Mise à jour de son propre profil
  - Lecture limitée employés/audit (selon portée définie)

### Remarques d'implémentation
- Les contrôles de rôle côté base reposent sur `users/{uid}.role` avec helpers `isAdmin()`/`isManager()`.
- Côté client, certaines pages peuvent être simplement protégées par authentification; affiner l'UI selon `role` est recommandé (ex: masquer suppression Produits pour `manager`/`staff`).
- La gestion Employés est liée à la propriété de `company` (propriétaire = créateur de la société).



