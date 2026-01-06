# Rapport : Formulaires de création utilisant `hasCompanyAccess`

## Collections avec règles Firestore `hasCompanyAccess` pour CREATE

### ✅ Collections AVEC règles (18 collections)

| Collection | Règle ligne | Fonction service | Formulaire UI | Statut |
|------------|-------------|------------------|---------------|--------|
| **products** | 70, 87 | `createProduct()` | `Products.tsx` | ✅ Règles OK |
| **sales** | 94, 109 | `createSale()` | `AddSaleModal.tsx`, `POSPaymentModal.tsx` | ✅ Règles OK |
| **expenses** | 116, 137 | `createExpense()` | `ExpenseFormModal.tsx` | ✅ Règles OK |
| **dashboardStats** | 144 | N/A (écriture directe) | Dashboard | ✅ Règles OK |
| **finances** | 150 | `createFinanceEntry()` | Finance pages | ✅ Règles OK |
| **financeEntryTypes** | 161 | `createFinanceEntryType()` | Settings | ✅ Règles OK |
| **expenseTypes** | 173 | `createExpenseType()` | Settings | ✅ Règles OK |
| **categories** | 235 | `createCategory()` | `Categories.tsx` | ✅ Règles OK |
| **suppliers** | 243 | `createSupplier()` | `Suppliers.tsx` | ✅ Règles OK |
| **objectives** | 251 | `createObjective()` | `ObjectiveForm.tsx` | ✅ Règles OK |
| **stockBatches** | 259 | `createStockBatch()` | Automatique (via produits/matières) | ✅ Règles OK |
| **stockChanges** | 267 | `createStockChange()` | Automatique (via produits/matières) | ✅ Règles OK |
| **customers** | 275 | `createCustomer()` | Customer forms | ✅ Règles OK |
| **orders** | 283, 309 | `createOrder()` | `CheckoutModal.tsx`, `Checkout.tsx` | ✅ Règles OK |
| **orders/{orderId}/events** | 318 | Automatique | Automatique | ✅ Règles OK |
| **orders/{orderId}/payments** | 328 | Automatique | Automatique | ✅ Règles OK |
| **orders/{orderId}/notes** | 339 | Automatique | Automatique | ✅ Règles OK |
| **cinetpay_configs** | 348, 366 | `createCinetPayConfig()` | Settings | ✅ Règles OK |
| **cinetpay_transactions** | 373 | Automatique | Automatique | ✅ Règles OK |

### ❌ Collections SANS règles (2 collections manquantes)

| Collection | Fonction service | Formulaire UI | Statut |
|------------|------------------|---------------|--------|
| **matieres** | `createMatiere()` | `MatiereFormModal.tsx` | ❌ **RÈGLES MANQUANTES** |
| **stocks** | Créé automatiquement par `createMatiere()` | N/A (automatique) | ❌ **RÈGLES MANQUANTES** |

---

## Détails des formulaires de création

### 1. **Products** (Produits)
- **Service**: `createProduct()` dans `src/services/firestore.ts:764`
- **Formulaire**: `src/pages/Products.tsx`
- **Règle**: Ligne 70, 87 dans `firebase.rules`
- **Validation**: `isValidProduct()` - vérifie name, costPrice, sellingPrice, stock, companyId

### 2. **Sales** (Ventes)
- **Service**: `createSale()` dans `src/services/firestore.ts:1617`
- **Formulaires**: 
  - `src/components/sales/AddSaleModal.tsx`
  - `src/components/pos/POSPaymentModal.tsx`
- **Règle**: Ligne 94, 109 dans `firebase.rules`
- **Validation**: `isValidSale()` - vérifie products, totalAmount, companyId, userId, createdAt

### 3. **Expenses** (Dépenses)
- **Service**: `createExpense()` dans `src/services/firestore.ts:1863`
- **Formulaire**: `src/pages/expenses/shared/ExpenseFormModal.tsx`
- **Règle**: Ligne 116, 137 dans `firebase.rules`
- **Validation**: `isValidExpense()` - vérifie description, amount, companyId, date/createdAt

### 4. **Categories** (Catégories)
- **Service**: `createCategory()` dans `src/services/firestore.ts:504`
- **Formulaire**: `src/pages/Categories.tsx`
- **Règle**: Ligne 235 dans `firebase.rules`
- **Validation**: Aucune fonction de validation spécifique

### 5. **Suppliers** (Fournisseurs)
- **Service**: `createSupplier()` dans `src/services/firestore.ts:3088`
- **Formulaire**: `src/pages/Suppliers.tsx`
- **Règle**: Ligne 243 dans `firebase.rules`
- **Validation**: Aucune fonction de validation spécifique

### 6. **Objectives** (Objectifs)
- **Service**: `createObjective()` dans `src/services/firestore.ts:2684`
- **Formulaire**: `src/components/objectives/ObjectiveForm.tsx`
- **Règle**: Ligne 251 dans `firebase.rules`
- **Validation**: Aucune fonction de validation spécifique

### 7. **Orders** (Commandes)
- **Service**: `createOrder()` dans `src/services/orderService.ts`
- **Formulaires**: 
  - `src/components/checkout/CheckoutModal.tsx`
  - `src/pages/Checkout.tsx`
  - `src/pages/SingleCheckout.tsx`
- **Règle**: Ligne 283, 309 dans `firebase.rules`
- **Validation**: `isValidOrder()` - validation complète des données de commande

### 8. **Matieres** (Matières premières) ⚠️ **PROBLÈME**
- **Service**: `createMatiere()` dans `src/services/firestore.ts:1160`
- **Formulaire**: `src/components/magasin/MatiereFormModal.tsx`
- **Règle**: ❌ **MANQUANTE** dans `firebase.rules`
- **Validation**: Aucune validation dans les règles (mais validation dans le code)
- **Impact**: Erreur "Missing or insufficient permissions" lors de la création

### 9. **Stocks** (Stocks) ⚠️ **PROBLÈME**
- **Service**: Créé automatiquement par `createMatiere()` dans `src/services/firestore.ts:1215`
- **Formulaire**: N/A (création automatique)
- **Règle**: ❌ **MANQUANTE** dans `firebase.rules`
- **Impact**: Erreur "Missing or insufficient permissions" lors de la création de matières

---

## Règles à ajouter pour corriger le problème

### Règles pour `matieres` (à ajouter après ligne 262)

```firestore
// Matieres - Company-scoped access
match /matieres/{matiereId} {
  allow read: if isAuthenticated() && hasCompanyAccess(resource.data.companyId);
  allow create: if isAuthenticated() && hasCompanyAccess(request.resource.data.companyId);
  allow update: if isAuthenticated() && hasCompanyAccess(resource.data.companyId) && hasCompanyAccess(request.resource.data.companyId);
  allow delete: if isAuthenticated() && hasCompanyAccess(resource.data.companyId);
  
  // Validate matiere data
  function isValidMatiere() {
    let data = request.resource.data;
    return data.name is string && data.name.size() > 0 &&
           data.refCategorie is string && data.refCategorie.size() > 0 &&
           data.unit is string && data.unit.size() > 0 &&
           data.costPrice is number && data.costPrice >= 0 &&
           data.companyId is string &&
           (!('description' in data) || data.description is string) &&
           (!('qualite' in data) || data.qualite is string) &&
           (!('images' in data) || (data.images is list)) &&
           (!('imagePaths' in data) || (data.imagePaths is list));
  }
  
  allow create: if isValidMatiere() && hasCompanyAccess(request.resource.data.companyId);
  allow update: if isValidMatiere() && hasCompanyAccess(request.resource.data.companyId);
}
```

### Règles pour `stocks` (à ajouter après les règles `matieres`)

```firestore
// Stocks - Company-scoped access
match /stocks/{stockId} {
  allow read: if isAuthenticated() && hasCompanyAccess(resource.data.companyId);
  allow create: if isAuthenticated() && hasCompanyAccess(request.resource.data.companyId);
  allow update: if isAuthenticated() && hasCompanyAccess(resource.data.companyId) && hasCompanyAccess(request.resource.data.companyId);
  allow delete: if isAuthenticated() && hasCompanyAccess(resource.data.companyId);
  
  // Validate stock data
  function isValidStock() {
    let data = request.resource.data;
    return data.id is string && data.id.size() > 0 &&
           data.matiereId is string && data.matiereId.size() > 0 &&
           data.quantity is number && data.quantity >= 0 &&
           data.companyId is string;
  }
  
  allow create: if isValidStock() && hasCompanyAccess(request.resource.data.companyId);
  allow update: if isValidStock() && hasCompanyAccess(request.resource.data.companyId);
}
```

---

## Résumé

- **Total collections avec `hasCompanyAccess`**: 18
- **Collections manquantes**: 2 (matieres, stocks)
- **Formulaires affectés**: `MatiereFormModal.tsx`
- **Action requise**: Ajouter les règles Firestore pour `matieres` et `stocks`, puis déployer

---

**Date de génération**: 2025-01-07
**Dernière vérification**: Analyse complète des règles Firestore et des services de création

