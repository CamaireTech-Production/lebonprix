## Instructions – Lien de connexion employé et vérifications côté client

### Objectif
Présenter le lien de connexion employé au même format que le catalogue, avec boutons Copy et Open, et s’assurer que le login ne s’exécute qu’après saisie d’un mot de passe et clic explicite sur “Se connecter”.

---

### Lien et actions dans l’onglet Employés
- Format du lien (exposé): `/employee-login/:companyName/:companyId/:loginLink`
- Affichage dans `Settings > Employees`:
  - Afficher l’URL complète (origin + path) si `loginLink` est présent.
  - Bouton “Copy link”: copie l’URL dans le presse-papiers.
  - Bouton “Open”: ouvre l’URL dans un nouvel onglet.

Implémenté dans: `src/components/settings/EmployeesTab.tsx`
- `buildEmployeeLoginUrl(emp)` pour composer l’URL
- `copyLoginLink(emp)` utilise `navigator.clipboard.writeText`
- `openLoginLink(emp)` ouvre avec `window.open(..., '_blank')`

---

### Page de connexion employé (vérifications)
- Route: `/employee-login/:companyName/:companyId/:loginLink`
- Préremplissage: `firstname`, `lastname`, `email` (read-only), `password` vide.
- Vérification côté client: le champ `password` est requis; sinon toast d’erreur.
- Soumission: la connexion n’est tentée qu’au clic sur “Se connecter”.
- Succès: redirection vers `/catalogue/:companyName/:companyId`.
- Échec: toast “Informations de connexion incorrectes”.

Implémenté dans: `src/pages/EmployeeLogin.tsx`
- `handleSubmit` vérifie le `password` puis appelle `signIn(email, password)`.

---

### Points à vérifier
- Lien affiché pour chaque employé muni d’un `loginLink`.
- Copie/ouvre le bon lien.
- Le mot de passe est requis; aucun login automatique.
- Redirection correcte vers le catalogue sur succès.
- Toast d’erreur en cas d’échec ou lien invalide.


