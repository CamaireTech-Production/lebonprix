# CLAUDE.md - Claude Code Guidelines for Geskap-Restoflow

This file provides guidance for Claude Code instances working in this repository.

## Project Overview

This repository contains **two related projects** being merged:

1. **Restoflow** (`/Restoflow`) - A restaurant management system (the active project)
2. **Geskap** (`/Geskap`) - A full ERP system used as a reference for features being ported to Restoflow

The current effort (branch: `Geskap-Resto`) focuses on integrating Geskap's business modules into Restoflow while maintaining Restoflow's architecture patterns.

## Build & Development Commands

All commands should be run from the `/Restoflow` directory:

```bash
# Development server
npm run dev

# Production build
npm run build

# Linting
npm run lint

# Testing
npm run test          # Watch mode
npm run test:run      # Single run
npm run test:coverage # With coverage report
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Backend**: Firebase (Firestore, Auth, Storage)
- **Charts**: Recharts (NOT Chart.js - Geskap uses Chart.js but Restoflow uses Recharts)
- **Icons**: Lucide React
- **Notifications**: React Hot Toast
- **Routing**: React Router v6
- **State**: React Context + Custom Hooks

## Architecture Patterns

### Multi-Tenant Architecture
All data is scoped by `restaurantId`. This is the critical isolation key:
```typescript
// Always filter queries by restaurantId
const expenses = await getExpenses(restaurantId);
```

### Page Layout Pattern
Pages use `DashboardLayout` wrapper for consistent layout:
```typescript
const SomePage = () => {
  return (
    <DashboardLayout title={t('page_title', language)}>
      {/* Page content */}
    </DashboardLayout>
  );
};
```

### Nested Routes with Tabs
For modules with sub-pages, use a Layout component with `<Outlet />`:
```typescript
// Layout component handles tabs
<Route path="/expenses" element={<ExpensesLayout />}>
  <Route index element={<Navigate to="/expenses/list" replace />} />
  <Route path="list" element={<ExpensesList />} />
  <Route path="categories" element={<ExpensesCategories />} />
</Route>
```

### Custom Hooks for Data
All data fetching is done via custom hooks in `/src/hooks/`:
```typescript
const { expenses, loading, error, addExpense } = useExpenses({ restaurantId });
const { categories, addCategory } = useExpenseCategories({ restaurantId });
```

### Services Layer
Business logic and Firebase interactions are in `/src/services/`:
- `storage/` - Firestore operations
- Split by domain (orders, inventory, etc.)

### i18n Translations
All user-facing text uses the translation system:
```typescript
import { t } from '../utils/i18n';
// Usage: t('translation_key', language)
```
Translations are defined in `/src/utils/i18n.ts` with EN/FR support.

## File Structure

```
Restoflow/src/
├── components/       # Reusable UI components
│   ├── layout/       # DashboardLayout, Sidebar, etc.
│   ├── expenses/     # Domain-specific components
│   └── ...
├── contexts/         # React Context providers
├── hooks/            # Custom hooks (useExpenses, useAuth, etc.)
│   ├── business/     # Business logic hooks
│   └── ...
├── pages/            # Page components
│   └── restaurant/   # Restaurant-specific pages
│       ├── expenses/ # Expense module pages
│       └── ...
├── services/         # Firebase and business services
│   └── storage/      # Firestore operations
├── types/            # TypeScript interfaces
└── utils/            # Utility functions (i18n, dates, etc.)
```

## Key Conventions

### Naming
- Components: PascalCase (`ExpensesList.tsx`)
- Hooks: camelCase with `use` prefix (`useExpenses.ts`)
- Services: camelCase (`expenseService.ts`)
- Utilities: camelCase (`dateUtils.ts`)

### Exports
Use index.ts barrel files for clean imports:
```typescript
// pages/restaurant/expenses/index.ts
export { default as ExpensesLayout } from './ExpensesLayout';
export { default as ExpensesList } from './ExpensesList';
```

### Protected Routes
All restaurant pages wrap routes with `ProtectedRoute` and `VerificationWrapper`:
```typescript
<Route path="/expenses" element={
  <ProtectedRoute>
    <VerificationWrapper>
      <ExpensesLayout />
    </VerificationWrapper>
  </ProtectedRoute>
}>
```

## Geskap Reference

When porting features from Geskap to Restoflow:

1. **Study Geskap's implementation** in `/Geskap/src/`
2. **Adapt to Restoflow patterns** - Don't copy directly; translate to Restoflow conventions
3. **Use Recharts** instead of Chart.js for visualizations
4. **Maintain restaurantId scoping** for all data
5. **Add i18n translations** for all new text (EN/FR)

### Geskap Module Locations
- Expenses: `/Geskap/src/pages/expenses/`
- Inventory: `/Geskap/src/pages/inventory/`
- Suppliers: `/Geskap/src/pages/suppliers/`
- Staff: `/Geskap/src/pages/staff/`

## Current Implementation Status

### Completed Phases
- **Phase 0**: Foundation & Setup
- **Phase 1**: Expenses Module (List, Categories, Analytics tabs)
- **Phase 2**: Enhanced Dashboard with Widgets
- **Phase 3**: Expense Analytics & Reporting

### Pending Phases
- **Phase 4**: Supplier Management
- **Phase 5**: Inventory Integration
- **Phase 6**: Staff Management
- **Phase 7**: POS Enhancement
- **Phase 8**: Financial Reporting
- **Phase 9**: System Integration

## Firebase Collections

Key Firestore collections (scoped by restaurantId):
- `restaurants` - Restaurant profiles
- `expenses` - Expense records
- `expenseTypes` - Expense categories
- `sales` - Sales transactions
- `inventory` - Stock items
- `suppliers` - Supplier records
- `staff` - Employee records

## Testing

Tests use Vitest with React Testing Library:
```bash
npm run test        # Watch mode
npm run test:run    # CI mode
```

## Common Pitfalls

1. **Always scope by restaurantId** - Forgetting this causes data leaks between tenants
2. **Use Recharts, not Chart.js** - Restoflow standardized on Recharts
3. **Check i18n key uniqueness** - Duplicate keys cause build warnings
4. **Use existing hooks** - Check `/src/hooks/` before creating new data fetching logic
5. **Wrap pages in DashboardLayout** - Unless it's a nested route child

## Related Documentation

- `.cursorrules` - Additional coding guidelines and context
- Geskap source code - Reference implementation for features being ported
