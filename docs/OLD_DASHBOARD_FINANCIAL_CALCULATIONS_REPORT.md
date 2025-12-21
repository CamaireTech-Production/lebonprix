# Rapport d'Analyse - Calculs Financiers et Objectifs (Ancien Système Dashboard)

**Date**: 2025-01-27  
**Branche analysée**: Ancien système du Dashboard  
**Fichier source**: `src/pages/dashboard/Dashboard.tsx` (ancienne version)

---

## 📋 Table des Matières

1. [Calcul du Profit](#1-calcul-du-profit)
2. [Calcul des Dépenses](#2-calcul-des-dépenses)
3. [Calcul du Solde](#3-calcul-du-solde)
4. [Chargement et Utilisation des Objectifs](#4-chargement-et-utilisation-des-objectifs)
5. [Fonctions Utilitaires](#5-fonctions-utilitaires)
6. [Filtrage des Données](#6-filtrage-des-données)
7. [Implémentation Recommandée](#7-implémentation-recommandée)

---

## 1. Calcul du Profit

### 1.1 Fonction Principale : `calculateDashboardProfit`

**Fichier**: `src/utils/calculations/financialCalculations.ts`

Cette fonction est utilisée exclusivement par le Dashboard pour calculer le profit en tenant compte d'une période de profit optionnelle.

```typescript
export const calculateDashboardProfit = (
  sales: Sale[],
  products: Product[],
  stockChanges: StockChange[],
  periodStartDate: Date | null,
  dateRangeFrom: Date
): number => {
  // Determine effective start date (latest of periodStartDate or dateRangeFrom)
  const effectiveStartDate = periodStartDate 
    ? new Date(Math.max(periodStartDate.getTime(), dateRangeFrom.getTime()))
    : dateRangeFrom;
  
  // Filter sales by effective start date
  const periodSales = sales.filter(sale => {
    if (!sale.createdAt?.seconds) return false;
    const saleDate = new Date(sale.createdAt.seconds * 1000);
    return saleDate >= effectiveStartDate;
  });
  
  // Use existing calculateTotalProfit function for consistency
  return calculateTotalProfit(periodSales, products, stockChanges);
};
```

**Paramètres**:
- `sales`: Array de ventes (déjà filtrées par dateRange)
- `products`: Array de tous les produits
- `stockChanges`: Array de changements de stock (pour obtenir les prix de revient)
- `periodStartDate`: Date de début optionnelle pour le calcul de période (null = tout le temps)
- `dateRangeFrom`: Date de début de la plage de dates sélectionnée par l'utilisateur

**Logique**:
1. Détermine la date de début effective (le maximum entre `periodStartDate` et `dateRangeFrom`)
2. Filtre les ventes pour ne garder que celles >= `effectiveStartDate`
3. Appelle `calculateTotalProfit` avec les ventes filtrées

### 1.2 Fonction de Base : `calculateTotalProfit`

**Fichier**: `src/utils/calculations/financialCalculations.ts`

Cette fonction calcule le profit total à partir des ventes.

```typescript
export const calculateTotalProfit = (
  sales: Sale[],
  products: Product[],
  stockChanges: StockChange[]
): number => {
  return sales.reduce((sum, sale) => {
    return sum + sale.products.reduce((productSum: number, product) => {
      const productData = products.find(p => p.id === product.productId);
      if (!productData) return productSum;
      
      const sellingPrice = product.negotiatedPrice || product.basePrice;
      const safeStockChanges = Array.isArray(stockChanges) ? stockChanges : [];
      const costPrice = getLatestCostPrice(productData.id, safeStockChanges);
      
      if (costPrice === undefined) return productSum;
      
      return productSum + (sellingPrice - costPrice) * product.quantity;
    }, 0);
  }, 0);
};
```

**Formule**: 
```
Profit = Σ((Prix de vente - Prix de revient) × Quantité) pour chaque produit dans chaque vente
```

**Détails**:
- Pour chaque vente, parcourt tous les produits
- Trouve les données du produit dans l'array `products`
- Utilise `product.negotiatedPrice` si disponible, sinon `product.basePrice`
- Obtient le prix de revient via `getLatestCostPrice` depuis les `stockChanges`
- Si le prix de revient n'est pas disponible, ignore ce produit
- Calcule: `(sellingPrice - costPrice) * quantity`

### 1.3 Utilisation dans Dashboard (Ancien Système)

**Fichier**: `src/pages/dashboard/Dashboard.tsx` (lignes 131-147)

```typescript
// 💰 PROFIT PERIOD: Calculate profit with dynamic date from periodType (Dashboard only)
const customDate = profitPeriodPreference?.periodStartDate 
  ? new Date(profitPeriodPreference.periodStartDate.seconds * 1000)
  : null;

const actualStartDate = profitPeriodPreference?.periodType
  ? getPeriodStartDate(profitPeriodPreference.periodType, customDate)
  : null;

const profit = calculateDashboardProfit(
  filteredSales || [],
  products || [],
  (stockChanges || []) as StockChange[],
  actualStartDate,
  dateRange.from
);
```

**Flux**:
1. Récupère la préférence de période de profit (`profitPeriodPreference`)
2. Convertit la date personnalisée si elle existe
3. Calcule `actualStartDate` via `getPeriodStartDate`
4. Appelle `calculateDashboardProfit` avec les ventes filtrées et la date de début effective

---

## 2. Calcul des Dépenses

### 2.1 Fonction : `calculateTotalExpenses`

**Fichier**: `src/utils/calculations/financialCalculations.ts`

```typescript
export const calculateTotalExpenses = (
  expenses: Expense[],
  manualEntries: FinanceEntry[]
): number => {
  const expensesSum = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const negativeManualSum = manualEntries
    .filter(e => e.amount < 0)
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);
  
  return expensesSum + negativeManualSum;
};
```

**Formule**:
```
Total Dépenses = Σ(Montant des dépenses) + Σ(Valeur absolue des entrées manuelles négatives)
```

**Détails**:
- Somme tous les montants des dépenses
- Filtre les entrées manuelles avec `amount < 0`
- Ajoute la valeur absolue de ces entrées négatives
- Retourne la somme totale

### 2.2 Utilisation dans Dashboard (Ancien Système)

**Fichier**: `src/pages/dashboard/Dashboard.tsx` (lignes 149-151)

```typescript
// 🔄 BACKGROUND DATA: Calculate expenses only when available
// Note: Dashboard only uses expenses, not manual entries, so we pass an empty array for manual entries
const totalExpenses = expensesLoading ? 0 : calculateTotalExpenses(filteredExpenses || [], []);
```

**Note importante**: Le Dashboard n'utilise **PAS** les entrées manuelles, seulement les dépenses. C'est pourquoi on passe un array vide `[]` pour `manualEntries`.

---

## 3. Calcul du Solde

### 3.1 Fonction : `calculateSolde`

**Fichier**: `src/utils/calculations/financialCalculations.ts`

```typescript
export const calculateSolde = (
  financeEntries: FinanceEntry[],
  debtEntries: FinanceEntry[],
  refundEntries: FinanceEntry[]
): number => {
  // Sum of all non-debt entries
  const nonDebtEntries = financeEntries.filter(
    (entry) => 
      entry.type !== 'debt' && 
      entry.type !== 'refund' && 
      entry.type !== 'supplier_debt' && 
      entry.type !== 'supplier_refund'
  );
  const nonDebtSum = nonDebtEntries.reduce((sum, entry) => sum + entry.amount, 0);
  
  // Calculate only customer debt (excluding supplier debt)
  const customerDebt = debtEntries
    .filter(debt => debt.type === 'debt') // Only customer debts, not supplier debts
    .reduce((sum, debt) => {
      const linkedRefunds = refundEntries.filter(
        (refund) => {
          const match = refund.refundedDebtId && String(refund.refundedDebtId) === String(debt.id);
          return match;
        }
      );
      const refundedAmount = linkedRefunds.reduce((s, r) => s + r.amount, 0);
      return sum + Math.max(0, debt.amount - refundedAmount);
    }, 0);
  
  return nonDebtSum + customerDebt;
};
```

**Formule**:
```
Solde = Σ(Entrées non-dette) + Σ(Dettes clients - Remboursements clients)
```

**Détails**:
1. **Filtre les entrées non-dette**: Exclut `debt`, `refund`, `supplier_debt`, `supplier_refund`
2. **Somme les entrées non-dette**: Additionne tous les montants
3. **Calcule les dettes clients**: 
   - Filtre uniquement les dettes de type `'debt'` (pas `'supplier_debt'`)
   - Pour chaque dette, trouve les remboursements liés via `refundedDebtId`
   - Calcule: `max(0, debt.amount - refundedAmount)`
4. **Retourne**: `nonDebtSum + customerDebt`

### 3.2 Utilisation dans Dashboard (Ancien Système)

**Fichier**: `src/pages/dashboard/Dashboard.tsx` (lignes 372-378)

```typescript
// 🔄 BACKGROUND DATA: Calculate balance only when finance data is available
// Note: Dashboard only uses non-debt entries (no customer debt added), so we pass empty arrays for debt/refund
const solde = financeLoading ? 0 : calculateSolde(
  financeEntries?.filter(entry => !entry.isDeleted) || [],
  [], // No debt entries for Dashboard calculation
  []  // No refund entries for Dashboard calculation
);
```

**Note importante**: Le Dashboard n'inclut **PAS** les dettes clients dans le solde. Il utilise uniquement les entrées non-dette. C'est pourquoi on passe des arrays vides pour `debtEntries` et `refundEntries`.

---

## 4. Chargement et Utilisation des Objectifs

### 4.1 Hook : `useObjectives`

**Fichier**: `src/hooks/business/useObjectives.ts`

```typescript
import { useEffect, useState, useCallback } from 'react';
import { Objective } from '../../types/models';
import { useAuth } from '@contexts/AuthContext';
import { subscribeToObjectives, createObjective, updateObjective as updateObjectiveService, deleteObjective as deleteObjectiveService } from '@services/firestore/objectives/objectiveService';

export const useObjectives = () => {
  const { user, company } = useAuth();
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !company) return;
    
    const unsubscribe = subscribeToObjectives(company.id, (objectives) => {
      setObjectives(objectives);
      setLoading(false);
    });
    
    return unsubscribe;
  }, [user, company]);

  const addObjective = useCallback(async (objective: Omit<Objective, 'id' | 'createdAt' | 'userId' | 'companyId'>) => {
    if (!user || !company) throw new Error('Not authenticated');
    return await createObjective({ ...objective, userId: user.uid, companyId: company.id }, company.id);
  }, [user, company]);

  const updateObjective = useCallback(async (id: string, data: Partial<Objective>) => {
    if (!user || !company) throw new Error('Not authenticated');
    return await updateObjectiveService(id, data, company.id);
  }, [user, company]);

  const deleteObjective = useCallback(async (id: string) => {
    if (!user || !company) throw new Error('Not authenticated');
    return await deleteObjectiveService(id, company.id);
  }, [user, company]);

  return { objectives, loading, addObjective, updateObjective, deleteObjective };
};
```

**Fonctionnalités**:
- **Abonnement en temps réel**: Utilise `subscribeToObjectives` pour recevoir les mises à jour automatiques
- **Chargement initial**: `loading` est `true` jusqu'à la première réception de données
- **CRUD complet**: `addObjective`, `updateObjective`, `deleteObjective`

### 4.2 Service : `subscribeToObjectives`

**Fichier**: `src/services/firestore/objectives/objectiveService.ts`

```typescript
export const subscribeToObjectives = (companyId: string, callback: (objectives: Objective[]) => void): (() => void) => {
  const q = query(
    collection(db, 'objectives'),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const objectives = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Objective[];
    callback(objectives);
  });
};
```

**Détails**:
- Requête Firestore filtrée par `companyId`
- Tri par `createdAt` décroissant (plus récents en premier)
- Utilise `onSnapshot` pour un abonnement en temps réel
- Retourne une fonction de désabonnement

### 4.3 Structure de l'Objectif

**Fichier**: `src/types/models.ts`

```typescript
export interface Objective extends BaseModel {
  title: string;
  description?: string;
  metric: string; // key of stat (profit, totalExpenses, etc.)
  targetAmount: number;
  periodType: 'predefined' | 'custom';
  predefined?: string; // this_month, this_year, etc.
  startAt?: Timestamp; // Firebase Timestamp (for custom period)
  endAt?: Timestamp; // Firebase Timestamp (for custom period)
  userId: string;
  isAvailable?: boolean; // false = soft deleted
}
```

### 4.4 Utilisation dans Dashboard (Ancien Système)

**Fichier**: `src/pages/dashboard/Dashboard.tsx` (lignes 589-620)

```typescript
{/* Objectives global bar */}
{(expensesLoading || stockChangesLoading) ? (
  <SkeletonObjectivesBar />
) : (
  <ObjectivesBar
    onAdd={() => { setShowObjectivesModal(true); }}
    onView={() => { setShowObjectivesModal(true); }}
    stats={statsMap}
    dateRange={dateRange}
    applyDateFilter={applyDateFilter}
    onToggleFilter={setApplyDateFilter}
    sales={sales}
    expenses={expenses}
    products={products}
    stockChanges={stockChanges}
  />
)}
{showObjectivesModal && (
  <ObjectivesModal
    isOpen={showObjectivesModal}
    onClose={() => setShowObjectivesModal(false)}
    stats={statsMap}
    dateRange={dateRange}
    metricsOptions={metricsOptions}
    applyDateFilter={applyDateFilter}
    sales={sales}
    expenses={expenses}
    products={products}
    stockChanges={stockChanges}
    onAfterAdd={() => setApplyDateFilter(false)}
  />
)}
```

**Props passées à ObjectivesBar**:
- `stats`: Map des statistiques calculées (`profit`, `totalExpenses`, etc.)
- `dateRange`: Plage de dates sélectionnée
- `applyDateFilter`: Booléen pour activer/désactiver le filtre de date
- `sales`, `expenses`, `products`, `stockChanges`: Données brutes pour les calculs

### 4.5 Calcul des Statistiques pour les Objectifs

**Fichier**: `src/components/objectives/ObjectivesBar.tsx` (lignes 47-96)

```typescript
const getStatsForObjective = (obj: any) => {
  let from: Date, to: Date;
  if (obj.periodType === 'predefined') {
    const now = new Date();
    if (obj.predefined === 'this_year') {
      from = new Date(now.getFullYear(), 0, 1);
      to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }
  } else {
    from = obj.startAt?.toDate ? obj.startAt.toDate() : new Date(obj.startAt);
    to = obj.endAt?.toDate ? obj.endAt.toDate() : new Date(obj.endAt);
  }
  const salesInPeriod = sales?.filter(sale => sale.createdAt?.seconds && new Date(sale.createdAt.seconds * 1000) >= from && new Date(sale.createdAt.seconds * 1000) <= to) || [];
  const expensesInPeriod = expenses?.filter(exp => {
    if (exp.isAvailable === false) return false;
    if (!exp.createdAt?.seconds) return false;
    const expDate = new Date(exp.createdAt.seconds * 1000);
    return expDate >= from && expDate <= to;
  }) || [];
  switch (obj.metric) {
    case 'profit': {
      const profit = salesInPeriod.reduce((sum: number, sale: any) => sum + sale.products.reduce((productSum: number, product: any) => {
        const sellingPrice = product.negotiatedPrice || product.basePrice || 0;
        const safeStockChanges = Array.isArray(stockChanges) ? stockChanges : [];
        const latestCost = getLatestCostPrice(product.productId, safeStockChanges);
        const costPrice = latestCost ?? 0;
        return productSum + (sellingPrice - costPrice) * (product.quantity || 0);
      }, 0), 0);
      return Number.isFinite(profit) ? profit : 0;
    }
    case 'totalExpenses':
      return expensesInPeriod.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    case 'totalOrders':
    case 'totalSalesCount':
      return salesInPeriod.length;
    case 'totalProductsSold':
      return salesInPeriod.reduce((sum, sale) => sum + sale.products.reduce((acc: number, p: any) => acc + (p.quantity || 0), 0), 0);
    case 'deliveryFee':
      return salesInPeriod.reduce((sum, sale) => sum + (sale.deliveryFee || 0), 0);
    case 'deliveryExpenses':
      return expensesInPeriod.filter(e => (e.category || '').toLowerCase() === 'delivery').reduce((sum, e) => sum + (e.amount || 0), 0);
    case 'totalSalesAmount':
      return salesInPeriod.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
    default:
      return 0;
  }
};
```

**Métriques supportées**:
- `profit`: Calcul identique à `calculateTotalProfit`
- `totalExpenses`: Somme des dépenses dans la période
- `totalOrders` / `totalSalesCount`: Nombre de ventes
- `totalProductsSold`: Quantité totale de produits vendus
- `deliveryFee`: Somme des frais de livraison
- `deliveryExpenses`: Somme des dépenses de catégorie "delivery"
- `totalSalesAmount`: Montant total des ventes

### 4.6 Filtrage des Objectifs

**Fichier**: `src/components/objectives/ObjectivesBar.tsx` (lignes 27-45, 98-102)

```typescript
const isOverlapping = (obj: any) => {
  let objFrom: Date | null = null;
  let objTo: Date | null = null;
  if (obj.periodType === 'predefined') {
    const now = new Date();
    if (obj.predefined === 'this_year') {
      objFrom = new Date(now.getFullYear(), 0, 1);
      objTo = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else {
      objFrom = new Date(now.getFullYear(), now.getMonth(), 1);
      objTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }
  } else {
    objFrom = obj.startAt?.toDate ? obj.startAt.toDate() : (obj.startAt ? new Date(obj.startAt) : null);
    objTo = obj.endAt?.toDate ? obj.endAt.toDate() : (obj.endAt ? new Date(obj.endAt) : null);
  }
  if (!objFrom || !objTo) return true;
  return objFrom <= dateRange.to && objTo >= dateRange.from;
};

const filteredObjectives = useMemo(() => {
  const active = objectives.filter(o => o.isAvailable !== false);
  if (!applyDateFilter) return active;
  return active.filter(isOverlapping);
}, [objectives, dateRange, applyDateFilter]);
```

**Logique de filtrage**:
1. Filtre les objectifs actifs (`isAvailable !== false`)
2. Si `applyDateFilter` est `true`, filtre par chevauchement avec `dateRange`
3. Un objectif chevauche si: `objFrom <= dateRange.to && objTo >= dateRange.from`

### 4.7 Calcul du Progrès

**Fichier**: `src/components/objectives/ObjectivesBar.tsx` (lignes 104-116)

```typescript
const objectivesWithProgress = useMemo(() => {
  return filteredObjectives.map(obj => {
    const current = getStatsForObjective(obj);
    const pct = obj.targetAmount ? Math.max(0, Math.min(100, (current / obj.targetAmount) * 100)) : 0;
    return { ...obj, progress: Math.round(pct), currentValue: current } as any;
  });
}, [filteredObjectives, sales, expenses, products]);

const averageProgress = useMemo(() => {
  if (!objectivesWithProgress.length) return 0;
  const sum = objectivesWithProgress.reduce((acc, obj: any) => acc + (obj.progress || 0), 0);
  return Math.round(sum / objectivesWithProgress.length);
}, [objectivesWithProgress]);
```

**Formule du progrès**:
```
Progrès (%) = min(100, max(0, (Valeur actuelle / Montant cible) * 100))
```

**Progrès moyen**: Moyenne arithmétique de tous les progrès individuels

---

## 5. Fonctions Utilitaires

### 5.1 `getLatestCostPrice`

**Fichier**: `src/utils/business/productUtils.ts`

```typescript
export const getLatestCostPrice = (productId: string, stockChanges: StockChange[]): number | undefined => {
  if (!stockChanges || !Array.isArray(stockChanges)) {
    return undefined;
  }
  
  const productStockChanges = stockChanges
    .filter(sc => sc.productId === productId && sc.costPrice !== undefined && sc.costPrice > 0)
    .sort((a, b) => {
      // Sort by creation time, newest first
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });

  return productStockChanges.length > 0 ? productStockChanges[0].costPrice : undefined;
};
```

**Fonction**: Retourne le prix de revient le plus récent pour un produit donné.

**Logique**:
1. Filtre les `stockChanges` pour le `productId` avec `costPrice > 0`
2. Trie par `createdAt` décroissant (plus récent en premier)
3. Retourne le premier `costPrice` ou `undefined` si aucun trouvé

### 5.2 Autres Fonctions Utilitaires

**Fichier**: `src/utils/calculations/financialCalculations.ts`

#### `calculateTotalSalesAmount`
```typescript
export const calculateTotalSalesAmount = (sales: Sale[]): number => {
  return sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
};
```

#### `calculateTotalDeliveryFee`
```typescript
export const calculateTotalDeliveryFee = (sales: Sale[]): number => {
  return sales.reduce((sum, sale) => sum + (sale.deliveryFee || 0), 0);
};
```

#### `calculateTotalProductsSold`
```typescript
export const calculateTotalProductsSold = (sales: Sale[]): number => {
  return sales.reduce(
    (sum, sale) => sum + sale.products.reduce((pSum: number, p) => pSum + p.quantity, 0),
    0
  );
};
```

#### `calculateTotalOrders`
```typescript
export const calculateTotalOrders = (sales: Sale[]): number => {
  return sales.length;
};
```

---

## 6. Filtrage des Données

### 6.1 Filtrage des Ventes

**Fichier**: `src/pages/dashboard/Dashboard.tsx` (lignes 115-119)

```typescript
const salesDataToUse = allSales.length > 0 ? allSales : sales;
const filteredSales = salesDataToUse?.filter(sale => {
  if (!sale.createdAt?.seconds) return false;
  const saleDate = new Date(sale.createdAt.seconds * 1000);
  return saleDate >= dateRange.from && saleDate <= dateRange.to;
});
```

**Logique**:
- Utilise `allSales` si disponible (chargement en arrière-plan), sinon `sales`
- Filtre par `dateRange.from` et `dateRange.to`
- Exclut les ventes sans `createdAt`

### 6.2 Filtrage des Dépenses

**Fichier**: `src/pages/dashboard/Dashboard.tsx` (lignes 122-129)

```typescript
const filteredExpenses = expenses?.filter(expense => {
  // First filter out soft-deleted expenses
  if (expense.isAvailable === false) return false;
  // Then apply date range filter
  if (!expense.createdAt?.seconds) return false;
  const expenseDate = new Date(expense.createdAt.seconds * 1000);
  return expenseDate >= dateRange.from && expenseDate <= dateRange.to;
});
```

**Logique**:
1. Exclut les dépenses soft-deleted (`isAvailable === false`)
2. Filtre par `dateRange`
3. Exclut les dépenses sans `createdAt`

---

## 7. Implémentation Recommandée

### 7.1 Pour le Profit

**Dans la nouvelle branche**, utiliser la même logique :

```typescript
// 1. Récupérer la préférence de période de profit
const { preference: profitPeriodPreference } = useProfitPeriod();

// 2. Calculer la date de début effective
const customDate = profitPeriodPreference?.periodStartDate 
  ? new Date(profitPeriodPreference.periodStartDate.seconds * 1000)
  : null;

const actualStartDate = profitPeriodPreference?.periodType
  ? getPeriodStartDate(profitPeriodPreference.periodType, customDate)
  : null;

// 3. Calculer le profit
const profit = calculateDashboardProfit(
  filteredSales || [],
  products || [],
  (stockChanges || []) as StockChange[],
  actualStartDate,
  dateRange.from
);
```

**Note**: Si `actualStartDate` est `null`, utiliser directement `calculateTotalProfit` pour être identique à Finance.tsx.

### 7.2 Pour les Dépenses

```typescript
// Dashboard n'utilise PAS les entrées manuelles
const totalExpenses = expensesLoading 
  ? 0 
  : calculateTotalExpenses(filteredExpenses || [], []);
```

### 7.3 Pour le Solde

```typescript
// Dashboard n'inclut PAS les dettes clients
const solde = financeLoading 
  ? 0 
  : calculateSolde(
      financeEntries?.filter(entry => !entry.isDeleted) || [],
      [], // Pas de dettes
      []  // Pas de remboursements
    );
```

### 7.4 Pour les Objectifs

```typescript
// 1. Utiliser le hook useObjectives
const { objectives, loading } = useObjectives();

// 2. Passer les données nécessaires à ObjectivesBar
<ObjectivesBar
  onAdd={() => setShowObjectivesModal(true)}
  onView={() => setShowObjectivesModal(true)}
  stats={statsMap}
  dateRange={dateRange}
  applyDateFilter={applyDateFilter}
  onToggleFilter={setApplyDateFilter}
  sales={sales}
  expenses={expenses}
  products={products}
  stockChanges={stockChanges}
/>
```

---

## 8. Fichiers à Copier/Conserver

### 8.1 Fichiers de Calculs (À CONSERVER)

- ✅ `src/utils/calculations/financialCalculations.ts` - **COMPLET**
- ✅ `src/utils/business/productUtils.ts` - Fonction `getLatestCostPrice`
- ✅ `src/utils/calculations/profitPeriodUtils.ts` - Utilitaires de période

### 8.2 Hooks (À CONSERVER)

- ✅ `src/hooks/business/useObjectives.ts` - Hook pour les objectifs
- ✅ `src/hooks/business/useProfitPeriod.ts` - Hook pour la période de profit

### 8.3 Services (À CONSERVER)

- ✅ `src/services/firestore/objectives/objectiveService.ts` - Service des objectifs

### 8.4 Composants (À CONSERVER)

- ✅ `src/components/objectives/ObjectivesBar.tsx` - Barre d'objectifs
- ✅ `src/components/objectives/ObjectivesModal.tsx` - Modal des objectifs
- ✅ `src/components/objectives/ObjectiveForm.tsx` - Formulaire d'objectif
- ✅ `src/components/objectives/ObjectiveItem.tsx` - Item d'objectif

---

## 9. Points d'Attention

### 9.1 Différences Dashboard vs Finance

| Métrique | Dashboard | Finance |
|----------|-----------|---------|
| **Profit** | Utilise `calculateDashboardProfit` avec période | Utilise `calculateTotalProfit` directement |
| **Dépenses** | Seulement `expenses` (pas d'entrées manuelles) | `expenses` + entrées manuelles négatives |
| **Solde** | Seulement entrées non-dette (pas de dettes) | Entrées non-dette + dettes clients |

### 9.2 Gestion de la Période de Profit

- Le Dashboard supporte une **préférence de période de profit** configurable par l'utilisateur
- Cette préférence peut être: `this_month`, `this_year`, `last_30_days`, `custom`, etc.
- Si une période est configurée, le profit est calculé à partir de cette date
- Si aucune période n'est configurée, le profit utilise toute la plage `dateRange`

### 9.3 Chargement des Objectifs

- Les objectifs sont chargés via **abonnement en temps réel** (`onSnapshot`)
- Le chargement est **automatique** dès que `user` et `company` sont disponibles
- Les objectifs sont **filtrés par `companyId`** et triés par `createdAt` décroissant
- Les objectifs soft-deleted (`isAvailable === false`) sont exclus

---

## 10. Checklist d'Implémentation

Pour implémenter dans la nouvelle branche :

- [ ] Copier `calculateDashboardProfit` depuis `financialCalculations.ts`
- [ ] Copier `calculateTotalProfit` depuis `financialCalculations.ts`
- [ ] Copier `calculateTotalExpenses` depuis `financialCalculations.ts`
- [ ] Copier `calculateSolde` depuis `financialCalculations.ts`
- [ ] Copier `getLatestCostPrice` depuis `productUtils.ts`
- [ ] Importer et utiliser `useProfitPeriod` hook
- [ ] Importer et utiliser `useObjectives` hook
- [ ] Implémenter le filtrage des ventes par `dateRange`
- [ ] Implémenter le filtrage des dépenses par `dateRange` (avec exclusion soft-deleted)
- [ ] Passer les bonnes props à `ObjectivesBar` et `ObjectivesModal`
- [ ] S'assurer que le calcul du profit respecte la préférence de période
- [ ] S'assurer que les dépenses n'incluent pas les entrées manuelles
- [ ] S'assurer que le solde n'inclut pas les dettes clients

---

**Fin du Rapport**

