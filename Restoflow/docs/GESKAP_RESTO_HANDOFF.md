# Geskap-Resto Implementation Handoff Document

> **Purpose:** This document provides complete context for any AI to continue implementing the Geskap-Resto project. Read this document fully before starting any work.

---

## Table of Contents
1. [Project Background](#project-background)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Environment Setup](#environment-setup)
5. [Authentication & Firebase](#authentication--firebase)
6. [Completed Work](#completed-work)
7. [How to Create New Features](#how-to-create-new-features)
8. [Pending Phases](#pending-phases)
9. [Key File References](#key-file-references)
10. [Troubleshooting](#troubleshooting)

---

## Project Background

### What is this project?
We are merging **Geskap** (a full ERP/inventory management system) into **Restoflow** (a restaurant digital menu and ordering system) to create **Geskap-Resto** - a complete Restaurant Management System.

### Strategy
**Copy Geskap features INTO Restoflow** - We enhance Restoflow by adapting and integrating Geskap's modules (customers, expenses, suppliers, inventory, POS, staff management, reports).

### Key Terminology
- **Geskap:** Source ERP system with full business management features (located at `/Geskap/`)
- **Restoflow:** Target restaurant system being enhanced (located at `/Restoflow/`)
- **restaurantId:** Equivalent to Geskap's `companyId` - the unique identifier for each restaurant
- **Matiere:** French word for "raw material" or "ingredient" - used in inventory management

### Current Branch
`Geskap-Resto`

---

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI Framework |
| TypeScript | 5.x | Type safety |
| Vite | 7.x | Build tool |
| Firebase | 10.x | Backend (Auth, Firestore, Storage) |
| Tailwind CSS | 3.x | Styling |
| React Router | 6.x | Routing |
| Lucide React | - | Icons |
| react-hot-toast | - | Notifications |

---

## Project Structure

### Root Directory
```
/Users/bosskonnofuente/Documents/GitHub/geskap/
├── Geskap/          # SOURCE - Reference ERP system (DO NOT MODIFY)
└── Restoflow/       # TARGET - Restaurant system being enhanced
```

### Restoflow Structure (Target)
```
Restoflow/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── DashboardLayout.tsx    # Main layout wrapper (MUST USE for all pages)
│   │   │   ├── Sidebar.tsx            # Navigation sidebar
│   │   │   └── Header.tsx             # Top header
│   │   ├── ui/                        # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Textarea.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   └── index.ts               # Exports all UI components
│   │   ├── customers/                 # Customer-specific components
│   │   ├── auth/                      # Authentication components
│   │   └── ...
│   │
│   ├── contexts/
│   │   ├── AuthContext.tsx            # Authentication state (provides currentUser, restaurant)
│   │   ├── LanguageContext.tsx        # i18n language state
│   │   └── OfflineSyncContext.tsx     # Offline/online status
│   │
│   ├── firebase/
│   │   └── config.ts                  # Firebase initialization (exports db, auth, storage)
│   │
│   ├── hooks/
│   │   └── business/                  # Business logic hooks
│   │       ├── useCustomers.ts
│   │       ├── useExpenses.ts
│   │       ├── useSuppliers.ts
│   │       ├── useMatieres.ts
│   │       └── ...
│   │
│   ├── pages/
│   │   ├── auth/                      # Login, Register, etc.
│   │   ├── restaurant/                # Restaurant management pages
│   │   │   ├── customers/
│   │   │   │   ├── CustomersPage.tsx
│   │   │   │   └── index.ts
│   │   │   ├── dashboard/
│   │   │   ├── menu/
│   │   │   ├── orders/
│   │   │   └── ...
│   │   └── admin/                     # Admin pages
│   │
│   ├── services/
│   │   └── firestore/                 # Firestore CRUD services
│   │       ├── shared.ts              # Audit logging utilities
│   │       ├── customers/
│   │       │   └── customerService.ts
│   │       ├── expenses/
│   │       │   └── expenseService.ts
│   │       ├── suppliers/
│   │       │   └── supplierService.ts
│   │       ├── matieres/
│   │       │   └── matiereService.ts
│   │       ├── stock/
│   │       │   └── stockService.ts
│   │       ├── sales/
│   │       │   └── saleService.ts
│   │       ├── employees/
│   │       │   ├── employeeRefService.ts
│   │       │   ├── invitationService.ts
│   │       │   └── permissionTemplateService.ts
│   │       └── finance/
│   │           └── financeService.ts
│   │
│   ├── types/
│   │   ├── index.ts                   # Original Restoflow types
│   │   └── geskap.ts                  # Geskap types (Customer, Expense, Supplier, etc.)
│   │
│   ├── utils/
│   │   ├── i18n.ts                    # Translations (EN/FR)
│   │   ├── phoneUtils.ts              # Cameroon phone formatting
│   │   └── calculations/
│   │       ├── expenseCalculations.ts
│   │       ├── financialCalculations.ts
│   │       └── inventoryCalculations.ts
│   │
│   ├── App.tsx                        # Main app with routes
│   └── main.tsx                       # Entry point
│
├── .env                               # Environment variables (Firebase config)
├── package.json
├── vite.config.ts
└── tsconfig.json
```

### Geskap Structure (Source Reference)
```
Geskap/src/
├── pages/
│   ├── customers/Contacts.tsx         # Reference for customer management
│   ├── expenses/                      # Reference for expense management
│   │   ├── ExpensesList.tsx
│   │   ├── ExpensesCategories.tsx
│   │   └── shared/
│   ├── suppliers/Suppliers.tsx        # Reference for supplier management
│   ├── magasin/                       # Reference for inventory (Matiere = Ingredient)
│   │   ├── Matieres.tsx
│   │   ├── Categories.tsx
│   │   └── Stocks.tsx
│   ├── pos/POS.tsx                    # Reference for POS system
│   ├── sales/Sales.tsx                # Reference for sales
│   ├── permissions/                   # Reference for permissions
│   └── hr/                            # Reference for HR/staff
│
├── components/
│   ├── pos/                           # POS components
│   ├── sales/                         # Sales components
│   ├── magasin/                       # Inventory components
│   └── hr/                            # HR components
│
├── hooks/forms/
│   └── usePOS.ts                      # Complete POS logic
│
├── services/firestore/                # Firestore services (reference patterns)
│
└── types/models.ts                    # All type definitions
```

---

## Environment Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Firebase project with Firestore enabled

### Running the Project
```bash
# Navigate to Restoflow
cd /Users/bosskonnofuente/Documents/GitHub/geskap/Restoflow

# Install dependencies
npm install

# Start development server (default port 5173)
npm run dev

# Start on specific port
npm run dev -- --port 3000

# Production build (validates TypeScript)
npm run build

# Type check only
npx tsc --noEmit
```

### Environment Variables
The `.env` file contains Firebase configuration:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

---

## Authentication & Firebase

### Authentication Context
All authenticated pages use `AuthContext` to access user and restaurant data:

```tsx
import { useAuth } from '../../../contexts/AuthContext';

const MyComponent = () => {
  const { currentUser, restaurant, signOut } = useAuth();

  // currentUser: Firebase Auth user object
  // restaurant: Current restaurant document from Firestore
  // restaurantId is typically: restaurant?.id || currentUser?.uid

  const restaurantId = restaurant?.id || currentUser?.uid || '';
  const userId = currentUser?.uid || '';
};
```

### Firestore Database Structure
All business data is stored as subcollections under each restaurant:

```
restaurants/
└── {restaurantId}/
    ├── customers/{customerId}
    ├── customerSources/{sourceId}
    ├── expenses/{expenseId}
    ├── expenseTypes/{typeId}
    ├── suppliers/{supplierId}
    ├── supplierDebts/{debtId}
    ├── matieres/{matiereId}           # Ingredients
    ├── stockBatches/{batchId}
    ├── stockChanges/{changeId}
    ├── sales/{saleId}
    ├── employeeRefs/{userId}
    ├── invitations/{inviteId}
    ├── permissionTemplates/{templateId}
    └── financeEntries/{entryId}
```

### Firebase Import Pattern
```tsx
import { db } from '../../firebase/config';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
```

---

## Completed Work

### Phase 0: Template System Removal ✅
Removed unused template builder/customizer from Restoflow.

### Phase 1: Foundation Setup ✅
Created all foundational types, services, hooks, and utilities.

**Key Files Created:**
- `src/types/geskap.ts` - All data models
- `src/services/firestore/` - All Firestore services
- `src/hooks/business/` - All business hooks
- `src/utils/calculations/` - Calculation utilities
- `src/utils/phoneUtils.ts` - Phone formatting

### Phase 2: Customer Management ✅
Full customer CRUD with search, stats, and DashboardLayout integration.

**Key Files:**
- `src/pages/restaurant/customers/CustomersPage.tsx`
- `src/components/ui/` (Card, Button, Input, Table, etc.)

**Route:** `/customers`
**Navigation:** Sidebar "Customers" with Users icon

---

## How to Create New Features

### Step 1: Check if Types Exist
Look in `src/types/geskap.ts` for the data model. Example:
```tsx
export interface Expense {
  id?: string;
  restaurantId: string;
  amount: number;
  description: string;
  category?: string;
  date: Date | Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
```

### Step 2: Check if Service Exists
Look in `src/services/firestore/` for the service. Example `expenseService.ts`:
```tsx
export const expenseService = {
  subscribeToExpenses(
    restaurantId: string,
    onData: (expenses: Expense[]) => void,
    onError: (error: Error) => void
  ) {
    const q = query(
      collection(db, 'restaurants', restaurantId, 'expenses'),
      orderBy('date', 'desc')
    );
    return onSnapshot(q,
      (snapshot) => onData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense))),
      onError
    );
  },

  async addExpense(restaurantId: string, data: Omit<Expense, 'id'>) {
    return addDoc(collection(db, 'restaurants', restaurantId, 'expenses'), {
      ...data,
      createdAt: serverTimestamp()
    });
  },
  // ... updateExpense, deleteExpense
};
```

### Step 3: Check if Hook Exists
Look in `src/hooks/business/`. Example `useExpenses.ts`:
```tsx
export function useExpenses({ restaurantId }: { restaurantId: string }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    const unsubscribe = expenseService.subscribeToExpenses(
      restaurantId,
      (data) => { setExpenses(data); setLoading(false); },
      (err) => { setError(err); setLoading(false); }
    );
    return () => unsubscribe();
  }, [restaurantId]);

  const addExpense = async (data: Omit<Expense, 'id'>) => {
    return expenseService.addExpense(restaurantId, data);
  };

  return { expenses, loading, error, addExpense, updateExpense, deleteExpense };
}
```

### Step 4: Create the Page
Create in `src/pages/restaurant/{feature}/`. Example structure:

```tsx
import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { Card, Button, Input, Modal, Table, LoadingSpinner } from '../../../components/ui';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { useExpenses } from '../../../hooks/business/useExpenses';
import { useAuth } from '../../../contexts/AuthContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { t } from '../../../utils/i18n';
import type { Expense } from '../../../types/geskap';
import toast from 'react-hot-toast';

const ExpensesPage = () => {
  const { currentUser, restaurant } = useAuth();
  const { language } = useLanguage();
  const restaurantId = restaurant?.id || currentUser?.uid || '';
  const userId = currentUser?.uid || '';

  const { expenses, loading, error, addExpense, updateExpense, deleteExpense } = useExpenses({ restaurantId });

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  // ... form states, handlers

  if (loading) {
    return (
      <DashboardLayout title={t('expenses', language)}>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={t('expenses', language)}>
      <div className="pb-20 md:pb-6">
        {/* Header with title and Add button */}
        {/* Stats cards */}
        {/* Search/filters */}
        {/* Table */}
        {/* Modals for Add/Edit/Delete */}
      </div>
    </DashboardLayout>
  );
};

export default ExpensesPage;
```

### Step 5: Create Index Export
Create `src/pages/restaurant/{feature}/index.ts`:
```tsx
export { default as ExpensesPage } from './ExpensesPage';
```

### Step 6: Add Route
In `src/App.tsx`, add import and route:
```tsx
// Import
import { ExpensesPage } from './pages/restaurant/expenses';

// Route (inside Routes)
<Route
  path="/expenses"
  element={
    <ProtectedRoute>
      <VerificationWrapper>
        <ExpensesPage />
      </VerificationWrapper>
    </ProtectedRoute>
  }
/>
```

### Step 7: Add Navigation
In `src/components/layout/Sidebar.tsx`:
1. Import icon: `import { DollarSign } from 'lucide-react';`
2. Add to navItems array:
```tsx
{
  name: t('expenses', language),
  path: '/expenses',
  icon: <DollarSign size={20} />,
},
```

### Step 8: Add Translations
In `src/utils/i18n.ts`, add keys in both `en` and `fr` sections:
```tsx
// English
'expenses': 'Expenses',

// French
'expenses': 'Dépenses',
```

### Step 9: Test
```bash
npm run build  # Check for TypeScript errors
npm run dev    # Test in browser
```

---

## Pending Phases

### Phase 3: Expense Management (NEXT)

**Goal:** Full expense tracking with categories, filters, and reporting.

**Source Reference:** `Geskap/src/pages/expenses/`

**Steps:**
1. Create `src/pages/restaurant/expenses/ExpensesPage.tsx`
2. Create `src/pages/restaurant/expenses/ExpenseCategoriesPage.tsx`
3. Create `src/pages/restaurant/expenses/index.ts`
4. Create `src/components/expenses/ExpenseFormModal.tsx`
5. Add routes: `/expenses`, `/expense-categories`
6. Add Sidebar navigation
7. Add i18n translations

**Database Collections:**
- `restaurants/{id}/expenses/`
- `restaurants/{id}/expenseTypes/`

**Default Expense Categories:**
Food Supplies, Beverages, Utilities, Rent, Salaries, Equipment, Maintenance, Marketing, Delivery

---

### Phase 4: Supplier Management

**Goal:** Supplier database with debt tracking.

**Source Reference:** `Geskap/src/pages/suppliers/Suppliers.tsx`

**Database:**
- `restaurants/{id}/suppliers/`
- `restaurants/{id}/supplierDebts/`

---

### Phase 5: Inventory/Ingredient Management

**Goal:** Ingredient tracking with stock levels, batches, and alerts.

**Source Reference:** `Geskap/src/pages/magasin/`

**UI Adaptation:** Rename "Matiere" to "Ingredient" in all user-facing text.

**Database:**
- `restaurants/{id}/matieres/`
- `restaurants/{id}/stockBatches/`
- `restaurants/{id}/stockChanges/`

---

### Phase 6: Staff & Permission System

**Goal:** Employee management with role-based permissions.

**Source Reference:**
- `Geskap/src/pages/permissions/`
- `Geskap/src/pages/hr/`

**Restaurant Roles:** Owner, Manager, Chef, Server/Waiter, Cashier, Delivery

**Database:**
- `restaurants/{id}/employeeRefs/`
- `restaurants/{id}/invitations/`
- `restaurants/{id}/permissionTemplates/`

---

### Phase 7: POS System

**Goal:** Point of sale for taking orders, processing payments.

**Source Reference:**
- `Geskap/src/pages/pos/POS.tsx`
- `Geskap/src/hooks/forms/usePOS.ts`

**Restaurant Adaptations:**
- Integrate with existing table management
- Use dishes (from menu) instead of products
- Add tip support
- Kitchen ticket generation

---

### Phase 8: Financial Dashboard & Reports

**Goal:** Revenue tracking, profit analysis, and report generation.

**Source Reference:**
- `Geskap/src/components/dashboard/`
- `Geskap/src/services/reports/`

**KPIs:** Daily/weekly/monthly revenue, Average order value, Popular dishes, Food cost %, Profit margins

---

### Phase 9: Integration & Polish

**Tasks:**
1. Complete Sidebar organization
2. Offline support for new collections
3. Payment provider integration (Campay/CinetPay)
4. Complete i18n translations
5. Full manual QA

---

## Key File References

| What | Source (Geskap) | Target (Restoflow) |
|------|-----------------|-------------------|
| All Types | `Geskap/src/types/models.ts` | `Restoflow/src/types/geskap.ts` |
| POS Logic | `Geskap/src/hooks/forms/usePOS.ts` | Phase 7 |
| Stock FIFO | `Geskap/src/services/firestore/stock/` | `Restoflow/src/services/firestore/stock/` |
| Permissions | `Geskap/src/pages/permissions/` | Phase 6 |
| Expense Page | `Geskap/src/pages/expenses/ExpensesList.tsx` | Phase 3 |
| Supplier Page | `Geskap/src/pages/suppliers/Suppliers.tsx` | Phase 4 |
| Inventory | `Geskap/src/pages/magasin/Matieres.tsx` | Phase 5 |

---

## Troubleshooting

### Build Errors
```bash
npm run build
```
Check for TypeScript errors. Common issues:
- Missing imports
- Type mismatches
- Missing translations

### Known Warnings (Safe to Ignore)
1. **Duplicate i18n keys:** `checkout`, `order_summary`, `customer_information` duplicated in `utils/i18n.ts`
2. **Large bundle size:** Main chunk >500KB (will optimize in Phase 9)

### Common Fixes

**Import path errors:**
```tsx
// Use relative paths from current file
import { useAuth } from '../../../contexts/AuthContext';
import DashboardLayout from '../../../components/layout/DashboardLayout';
```

**Missing translations:**
Add keys to both `en` and `fr` sections in `src/utils/i18n.ts`

**Page not showing in sidebar:**
1. Check route is added in `App.tsx`
2. Check navItem is added in `Sidebar.tsx`
3. Verify translation key exists

---

## Quick Start for Next Phase

To start **Phase 3 (Expense Management)**:

1. Read source files:
   - `Geskap/src/pages/expenses/ExpensesList.tsx`
   - `Geskap/src/pages/expenses/ExpensesCategories.tsx`

2. Verify foundation exists:
   - `Restoflow/src/types/geskap.ts` (Expense type)
   - `Restoflow/src/services/firestore/expenses/expenseService.ts`
   - `Restoflow/src/hooks/business/useExpenses.ts`

3. Create page following [How to Create New Features](#how-to-create-new-features)

4. Test: `npm run dev`, navigate to `/expenses`

---

*Last Updated: January 25, 2026*
*Phase Status: 0-2 Complete, 3-9 Pending*
*Next Phase: 3 (Expense Management)*
