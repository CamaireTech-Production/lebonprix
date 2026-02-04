### ✏️ Edit/Update Logic & Cascading Effects

- **Editable Entities:** Products, Sales, Orders, Expenses, Suppliers, Employees, Customers, Finance Entries, Stock Batches, Shops, Warehouses.
- **Edit Permissions:** Only users with the correct role/permission can edit sensitive entities (e.g., finance, stock, HR, settings).
- **Product Edits:**
  - Changing product info (name, price, category) updates the product and search indexes.
  - Editing stock (restock, adjustment) creates new stock batches and logs stock changes; does not retroactively affect past sales or batches.
  - Changing cost price on restock affects future profit calculations, not past sales.
- **Sale Edits:**
  - Only allowed if sale is not deleted/cancelled and user has permission.
  - Editing a sale (products, quantities, payment status) triggers recalculation of stock, profit, and finance entries:
    - If sale is changed from 'commande' to 'paid', stock and finance moves are triggered.
    - If sale is edited after payment, stock/finance entries are updated to reflect new totals (with audit log).
    - If sale is changed to 'credit', finance entry is removed and debt is tracked.
- **Order Edits:**
  - Orders can be updated in status, products, or customer info before being converted to a sale.
  - Once converted to sale, order edits are limited and cascade to the linked sale.
- **Expense Edits:**
  - Editing an expense updates the linked finance entry and reports.
- **Supplier Edits:**
  - Supplier info and debt/refund entries can be updated; edits cascade to debt calculations and finance entries.
- **HR/Employee Edits:**
  - Employee info, roles, and permissions can be updated; changes take effect immediately for access control.
- **Cascading & Audit:**
  - All edits are logged for audit.
  - Edits to entities with financial/stock impact (sales, products, expenses) always update or recreate the related finance/stock/debt entries to ensure data consistency.
  - Some edits (e.g., changing product cost price) do not retroactively affect past transactions, only future ones.

# Geskap App – Explicit Functionality & Flow Summary

## What is Geskap?
Geskap is a full-featured, production-grade business management system for SMEs, built with React, TypeScript, Tailwind CSS, and Firebase. It covers all business flows: sales, POS, inventory, finance, HR, suppliers, orders, catalogue, and more, with robust permission and deletion logic.

---

## Core Functionalities & Implementation Details

### 💰 Sales & POS (Point of Sale)
- Sales require at least one product; client is optional.
- Stock batch per location: Each sale debits product stock from the correct batch and location (shop/warehouse), using FIFO/LIFO/CMUP as configured.
- Finance entry: Each completed sale (status 'paid') creates a finance entry in the solde (cashbox). Credit sales do not create a finance entry until paid.
- Profit calculation: Profit is calculated per sale based on the cost price of the debited stock batches.
- Stock reduction: Product stock is reduced per batch/location. Sale cannot proceed if insufficient stock in the selected location.
- Sale status: Supports 'commande' (reservation, no stock/finance move), 'paid' (stock/finance move), 'credit' (stock move, no finance, tracked as debt), 'under_delivery', and 'draft'.
- Deletion: Deleting a sale soft-deletes the record, reverses stock/finance moves, and logs the action.

### 📦 Orders Management
- Order sources: Online catalogue, WhatsApp, in-store.
- Order-to-sale flow: Orders can be converted to sales. When status changes to 'paid', triggers stock and finance moves as above.
- Order status: Tracks full lifecycle (pending, confirmed, preparing, ready, delivered, cancelled).
- Finance moves: Only when order is converted to sale and paid.
- Deletion: Soft-delete with cascade to related finance/stock entries.

### 🛍️ Product & Inventory Management
- Product creation: Adds product and creates initial stock batch at specified location (shop/warehouse/production). If supplier is set and purchase is on credit, creates supplier debt entry.
- Stock management: All stock is batch-based and location-aware. Stock changes (restock, sale, adjustment) are logged per batch.
- Finance moves: Own-purchase creates finance entry (sortie from solde). Supplier credit creates supplier debt.
- Production: Production orders create products and stock batches, with cost calculation and finance moves as above.
- Deletion: Soft-delete product, update stock, and adjust related finance/debt entries.


### 📦 Warehouse & Shop Management
- Multi-location: Track stock, sales, and transfers per shop/warehouse.
- Stock transfers: Move stock between locations, with full batch and audit tracking.
- Default locations: Each company has a default shop and warehouse.
- Deletion: Soft-delete with protection for default locations.

### 💸 Expenses Management
- Expense creation: Adds expense, creates negative finance entry (sortie) in solde.
- Categories: Organize expenses for reporting.
- Receipt upload: Attach receipts to expenses.
- Deletion: Soft-delete expense, reverses finance entry.

### 🏢 Supplier Management
- Supplier creation: Track supplier info and purchase history.
- Supplier debt: Credit purchases create supplier debt entries, tracked per batch.
- Refunds: Repayments reduce debt and create finance entries.
- Deletion: Soft-delete supplier, preserves debt/payment history.

### 👨‍💼 Human Resources (HR) & Permission Management
- Employee management: Add/edit employees, assign roles (manager, cashier, etc.).
- Permission templates: Define what each role can access/do (sales, products, finance, etc.).
- Access control: All sensitive actions (finance, deletion, settings) are permission-checked.
- Deletion: Soft-delete employee, revoke access, preserve audit trail.

### Deletion & Soft-Delete Logic
- All major entities (sales, products, orders, expenses, suppliers, employees, finance entries) use soft-delete.
- Soft-delete reverses or marks related finance/stock/debt entries as deleted, preserving audit trail and data integrity.

---

## Summary
Geskap is a comprehensive, audit-safe business management system that:
- Handles all sales, POS, and order flows with explicit stock, finance, and debt logic
- Tracks every product, batch, and location for true inventory accuracy
- Manages all finance entries, supplier debts, and refunds with real-time solde calculation
- Provides robust permission and access control for all sensitive actions
- Ensures all deletions are soft and auditable, with full data integrity
- Supports multi-location, multi-language, and PWA/mobile use

### 🏠 Dashboard
- Overview of total sales, expenses, profit, best-selling products, top customers, recent activity, sales charts, and business goals.

### 💰 Sales Management
- Track and manage all sales.
- Point of Sale (POS) system for quick sales processing.
- Sales history and analytics.

### 📦 Orders Management
- Handle online, WhatsApp, and in-store orders.
- Order tracking, status management, payment tracking, customer info, order notes, bulk actions, order search, and public tracking links.

### 🛍️ Products & Inventory
- Manage product catalog, categories, and stock levels.
- Bulk import/export via CSV/Excel.
- Stock management, adjustments, and alerts.

### 🏭 Production Management
- Create and track production orders.
- Define production flows and categories.
- Track materials, calculate costs, publish products, and view production history.

### 📦 Warehouse Management
- Manage warehouses, stock transfers, and raw materials.
- Track supplies and inventory across multiple locations.

### 💸 Expenses Management
- Record, categorize, and analyze expenses.
- Attach receipts, generate reports, filter/search, and export data.

### 💳 Finance Management
- Unified view of all financial transactions.
- Automatic profit calculation, financial reports, period comparison, cash flow, and analytics.

### 👥 Customer Management
- Manage customer profiles, contact info, and purchase history.
- Track loyalty and communication.

### 🏢 Supplier Management
- Manage supplier details, purchase orders, and relationships.

### 👨‍💼 Human Resources (HR) Management
- Employee management, roles, permission templates, access control, invitations, team overview, and profiles.

### 📊 Reports & Analytics
- Generate, view, and export business reports.
- Visual charts and performance dashboards.

### 🌐 Online Product Catalogue
- Public-facing product catalog for online orders.

### 💳 Payment Integration
- CinetPay and credit card payments.
- Payment tracking, secure processing, payment history.

### ⚙️ Settings
- Configure business info, payment methods, notifications, and preferences.

### 📱 Progressive Web App (PWA)
- Installable on devices, offline access, push notifications, app-like experience, fast loading.

### 🌍 Multi-Language Support
- Full English and French interface.
- Easy language switching, complete translation.

### 🔐 Security & Access Control
- Secure login, role-based access, data protection, activity logging, encrypted payments.

### 📈 Business Objectives
- Set and track goals, visual progress indicators, period goals.

### 🔄 Data Synchronization
- Real-time sync with Firebase backend.

### 📞 Customer Support Features
- Help guides, support contact, and documentation.

---

## Technical Stack
- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **State/Context:** React Context, custom hooks
- **Icons:** Lucide React
- **Backend/Database:** Firebase (Firestore, Auth, Storage)
- **Other:** ESLint, PostCSS

---

## Project Structure
```
src/
  components/    # Reusable UI components
  pages/         # Main app pages (Dashboard, Sales, Expenses, etc.)
  hooks/         # Custom React hooks
  contexts/      # React Context providers
  services/      # Firebase and Firestore logic
  i18n/          # Localization config and translations
  types/         # TypeScript models
  utils/         # Utility functions
public/           # Static assets
```

---

## Summary
Geskap is a comprehensive business management system that helps you:
- Sell products and process sales
- Manage inventory and stock
- Handle orders from multiple sources
- Track expenses and finances
- Manage customers and suppliers
- Control employee access and permissions
- Generate reports and analytics
- Accept online and in-store payments
- Manage production and warehouse operations
- Use as a PWA with multi-language support

Whether you run a shop, restaurant, manufacturing business, or online store, Geskap provides all the tools needed for efficient management and growth.

---

**For more details, see the user guide or contact support.**
