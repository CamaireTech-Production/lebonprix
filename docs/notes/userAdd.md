## Topo: Attribution d’un mot de passe par défaut et génération du loginLink

Objectif: Lors de l’ajout d’un employé, attribuer automatiquement un mot de passe par défaut, en le hashant avec la fonction de hash de la compagnie, puis générer et stocker un `loginLink` basé sur le prénom+nom, préalablement chiffrés par un code de César avant l’enregistrement.

Références: `UserRapport.md`, `UserPromt.Md`, `Usermanage.md`, `userImplemet.md`, `UserAnalyse.md`.

---

### 1) Mot de passe par défaut
- Motif: `passwordParDefaut = firstname + '123' + lastname`
- Hashage: utiliser la fonction de hashage de la compagnie (existante côté projet). Si aucune fonction n’est encore disponible publiquement dans le code, exposer/utiliser un utilitaire commun (ex: `utils/security.ts`) qui appelle la logique de hash «compagnie».

Pseudo-implémentation (TypeScript):

```typescript
// utils/security.ts (proposition)
export async function hashCompanyPassword(plain: string): Promise<string> {
  // TODO: brancher ici la fonction de hashage officielle de la compagnie
  // Exemple placeholder (ne pas utiliser en prod):
  // return sha256(plain)
  throw new Error('hashCompanyPassword non implémenté: brancher la fonction officielle.');
}

export function makeDefaultEmployeePassword(firstname: string, lastname: string): string {
  return `${firstname}123${lastname}`;
}

export async function buildDefaultHashedPassword(firstname: string, lastname: string): Promise<string> {
  const defaultPwd = makeDefaultEmployeePassword(firstname, lastname);
  return hashCompanyPassword(defaultPwd);
}
```

Intégration (lors de la création d’un employé):

```typescript
// Au moment d’ajouter un employé (ex: dans EmployeesTab ou un service dédié)
const hashedPassword = await buildDefaultHashedPassword(employee.firstname, employee.lastname);
// Ne pas stocker le mot de passe en clair; si besoin de l’associer côté Auth,
// stocker uniquement la version hashée dans Firestore OU mieux: créer le compte Auth immédiatement
// avec ce mot de passe et ne rien stocker côté Firestore.
```

Recommandation: ne pas stocker le hash du mot de passe dans `companies.employees`. Préférer créer le compte Firebase Auth et conserver les infos non sensibles côté Firestore. Si le hash doit exister côté Firestore (exigence métier), s’assurer qu’il n’est lisible que par des rôles autorisés.

---

### 2) loginLink basé sur code de César
- Chaîne source: `key = firstname + lastname`
- Transformation: appliquer un code de César (décalage configurable, p. ex. `shift = 3`) pour obtenir `cipher`, puis stocker `cipher` comme `loginLink`.
- Note sécurité: un code de César n’est pas une protection forte. À utiliser uniquement comme obfuscation/identifiant. Pour de la sécurité réelle, préférer un token signé (JWT) ou un identifiant aléatoire (UUID) côté serveur.

Pseudo-implémentation:

```typescript
// utils/security.ts (suite)
export function caesarCipher(input: string, shift: number): string {
  const a = 'a'.charCodeAt(0);
  const z = 'z'.charCodeAt(0);
  const A = 'A'.charCodeAt(0);
  const Z = 'Z'.charCodeAt(0);
  const mod = (n: number, m: number) => ((n % m) + m) % m;
  return input.split('').map(ch => {
    const code = ch.charCodeAt(0);
    if (code >= a && code <= z) {
      return String.fromCharCode(a + mod(code - a + shift, 26));
    }
    if (code >= A && code <= Z) {
      return String.fromCharCode(A + mod(code - A + shift, 26));
    }
    return ch; // conserve chiffres, espaces, accents, etc.
  }).join('');
}

export function buildLoginLink(firstname: string, lastname: string, shift = 3): string {
  const base = `${firstname}${lastname}`;
  return caesarCipher(base, shift);
}
```

Intégration (lors de la création d’un employé):

```typescript
// Lors de l’ajout
const loginLink = buildLoginLink(employee.firstname, employee.lastname, 3);
// Stocker loginLink dans companies/{companyId}.employees[i].loginLink
```

---

### 3) Point d’insertion dans l’application
- UI: onglet `Settings > Employees` déjà en place.
- Au moment d’ajouter un employé dans l’UI (ou via un service dédié):
  1) Construire le `hashedPassword` via `buildDefaultHashedPassword`.
  2) Générer `loginLink` via `buildLoginLink`.
  3) Sauvegarder l’employé (avec `loginLink`).
  4) Côté Auth, créer le compte (option recommandé) avec le mot de passe par défaut; sinon, conserver le hash en Firestore (selon politique).

---

### 4) Considérations de sécurité et conformité
- Éviter de stocker des secrets en clair dans Firestore.
- Limiter l’accès aux champs sensibles via `firebase.rules`.
- Préférer un jeton aléatoire signé pour l’invitation si l’usage dépasse la simple obfuscation.
- Journaliser la création/modification d’employés (audit logs) si nécessaire.

---

### 5) Tests (à prévoir)
- Génération correcte du mot de passe par défaut (chaîne attendue).
- Hashage: vérifier que la fonction de hash est appelée et que la valeur n’est pas égale au clair.
- Code de César: vérifier plusieurs cas (minuscules/majuscules, wrap-around).
- Intégration: vérification que `loginLink` est persisté et que la sauvegarde `employees` passe.



