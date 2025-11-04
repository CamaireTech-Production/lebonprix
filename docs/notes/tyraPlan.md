## Plan d’application — Mapping des rôles vers la barre de menu et redirections

Objectif: attribuer aux rôles `vendeur` (staff), `gestionnaire` (manager) et `magasinier` (admin) un accès précis aux sections de la barre de menu, et rediriger tout employé connecté via lien vers le dashboard principal avec accès restreint. Une entreprise connectée (propriétaire) a accès à toutes les sections.

### 1) Cartographie des rôles → sections (Menu)
- vendeurs (staff):
  - Dashboard (`/`)
  - Ventes (`/sales`)
  - Lecture Dépenses (`/expenses`) — sans actions de suppression
  - Lecture Produits (`/products`)
  - Lecture Fournisseurs (`/suppliers`)
- gestionnaires (manager):
  - Tout l’accès vendeur
  - Création/modification Produits (`/products`)
  - Création/modification Dépenses (`/expenses`)
  - Ventes (création/modif globales)
  - Rapports (`/reports`)
  - Finance (`/finance`) — si activée
- magasiniers (admin):
  - Accès complet aux sections: Dashboard, Ventes, Dépenses, Produits, Fournisseurs, Rapports, Finance, Paramètres (`/settings`)
  - Actions d’administration (suppression produits/dépenses, gestion globale)
- entreprise (propriétaire `company.userId == currentUser.uid`):
  - Accès à toutes les sections et gestion des employés (via `settings` / onglet employés)

Alignement Firestore (rappel):
- `admin`: create/update/delete Produits, Ventes, Dépenses
- `manager`: create/update Produits, Ventes, Dépenses
- `staff`: create Ventes, update ses ventes, lecture Produits/Dépenses

### 2) Stratégie UI — filtrage du menu
- Déclarer `allowedRoles` pour chaque item de menu (existant partiellement dans `Sidebar.tsx`).
- Normaliser les rôles affichés côté UI:
  - Map UI → règles: `vendeur → staff`, `gestionnaire → manager`, `magasinier → admin`, `Companie → owner`
- Filtrer l’affichage d’un item si `allowedRoles.includes(effectiveRole)`.
- Pour l’entreprise (propriétaire), bypass du filtre: afficher tous les items.
- Appliquer la même logique à `MobileNav` pour cohérence mobile.

### 3) Redirections — flux d’authentification employé vs entreprise
- Employé via lien (`/employee-login/:companyName/:companyId/:loginLink`):
  - Après succès: rediriger vers `/` (Dashboard) toujours, avec menu filtré selon rôle.
- Entreprise (login classique):
  - Après succès: rediriger vers `/` (Dashboard) avec accès complet.
- Protection des routes:
  - Conserver `ProtectedRoute` pour exiger l’authentification.
  - Optionnel: ajouter `RoleRoute` si des pages exigent des rôles spécifiques (ex: `/settings` => admin/owner).

### 4) Détermination du rôle effectif et ownership
- Source du rôle:
  - `users/{uid}.role` pour `admin/manager/staff` (selon `firebase.rules`).
  - Rôle d’entreprise/owner: vérifier `companies/{companyId}.userId == currentUser.uid` (existence déjà exploitée dans règles employé).
- `AuthContext`:
  - Exposer `company`, `currentUser`, et `effectiveRole` (dérivé du doc `users/{uid}` ou de l’employé connecté).
  - Exposer un booléen `isOwner` basé sur `company.userId === currentUser.uid`.
- Fallback UI:
  - Si `effectiveRole` non résolu, afficher minimum: Dashboard.
  - Désactiver actions sensibles tant que le rôle n’est pas chargé.

### 5) Cohérence avec logique de données et règles
- Côté Firestore, les droits sont déjà encodés via `isAdmin()`/`isManager()` et vérifs d’ownership.
- Côté UI, masquer les actions non autorisées (ex: boutons supprimer produit/dépense non visibles pour `manager/staff`).
- En cas d’accès direct à une route bloquée par rôle, renvoyer vers `/` avec notification « accès refusé ».

### 6) Étapes d'implémentation ✅ COMPLÉTÉ
1. ✅ Rôles/ownership dans contexte:
   - ✅ Ajouté `effectiveRole` et `isOwner` dans `AuthContext`.
   - ✅ Fonction `determineUserRole()` pour déterminer le rôle depuis `users/{uid}.role` ou employés.
2. ✅ Normaliser mapping labels↔rôles:
   - ✅ Créé `roleUtils.ts` avec mapping centralisé.
   - ✅ `vendeur=staff`, `gestionnaire=manager`, `magasinier=admin`, `Companie=owner`.
3. ✅ Filtrer menu (`Sidebar`, `MobileNav`):
   - ✅ Ajouté `allowedRoles` sur chaque item de navigation.
   - ✅ Filtrage par `effectiveRole` ou `isOwner`.
4. ✅ Redirection post-login:
   - ✅ `EmployeeLogin`: redirige vers `/` (dashboard) au lieu du catalogue.
   - ✅ `Login` (entreprise): redirige vers `/` avec accès complet.
5. ✅ Garde de routes avancée:
   - ✅ Créé `RoleRoute` pour sections critiques.
   - ✅ Appliqué sur `/finance`, `/reports`, `/settings`.
6. ✅ Affichage personnalisé sidebar:
   - ✅ "Bonjour {nom}" pour les employés avec leur rôle affiché.
   - ✅ Affichage normal (nom entreprise) pour les propriétaires.
7. ✅ Mapping des rôles UI:
   - ✅ `vendeur` (staff), `gestionnaire` (manager), `magasinier` (admin), `owner`.
   - ✅ Mise à jour de tous les composants de navigation.
8. ✅ Cache et persistance des données:
   - ✅ Utilisation de `useMemo` pour conserver les infos de compagnie.
   - ✅ Cache intelligent avec expiration (24h) et gestion d'erreurs.
   - ✅ Restauration immédiate des données lors de la reconnexion.
   - ✅ Nettoyage automatique du cache lors de la déconnexion.
9. 🔄 Masquage d'actions (à implémenter):
   - Dans pages Produits/Dépenses/Ventes, conditionner boutons selon `effectiveRole`.
10. 🔄 Tests et validation (à implémenter):
    - Cas UI: chaque rôle voit uniquement les items autorisés.
    - Cas routes: accès refusé redirige vers `/`.
    - Cas actions: suppression produits/dépenses inaccessible à `gestionnaire/vendeur`.

### 7) Checklist de test (haut niveau)
- Affichage menu pour `vendeur`, `gestionnaire`, `magasinier`, `owner`.
- Redirection depuis `EmployeeLogin` et `Login` vers `/`.
- Accès restreint aux pages sensibles (`/settings`, `/finance`) selon rôle.
- Masquage/désactivation des actions non autorisées dans les pages métiers.
- Résilience: comportement correct quand `effectiveRole` est en chargement.



