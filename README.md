# Le Bon Prix | Management System

A modern, production-ready management system for small businesses, built with React, TypeScript, Tailwind CSS, and Firebase. It provides sales, expenses, product, and finance management, with beautiful UI, responsive design, and multi-language support.

## Features

- **Dashboard**: Key business stats, sales, expenses, profit, and objectives.
- **Sales Management**: Add, edit, and track sales with customer info and invoices.
- **Expenses Tracking**: Record and categorize business expenses.
- **Product Catalog**: Manage products, stock, categories, and bulk import from CSV/Excel.
- **Finance Entries**: Unified view of all financial transactions (sales, expenses, manual entries).
- **Objectives**: Set and track business goals.
- **Reports**: Generate and export business reports.
- **User Authentication**: Secure login/register with role-based access.
- **Localization**: Full support for English and French.
- **Responsive UI**: Mobile-first, beautiful design using Tailwind CSS and Lucide icons.

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **State/Context**: React Context, custom hooks
- **Icons**: Lucide React
- **Backend/Database**: Firebase (Firestore, Auth, Storage)
- **Other**: ESLint, PostCSS

## Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/CamaireTech-Production/lebonprix.git
cd lebonprix
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Firebase Setup
- Create a Firebase project at [firebase.google.com](https://firebase.google.com/).
- Enable Firestore, Authentication, and Storage.
- Download your service account key and place it in the project root (for migration scripts).
- Copy your Firebase config to `.env` or directly into `src/services/firebase.ts` as needed.

### 4. Environment Variables
Create a `.env` file (if not using hardcoded config) with:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 5. Run the App
```bash
npm run dev
```
Visit [http://localhost:5173](http://localhost:5173) in your browser.

### 6. Build for Production
```bash
npm run build
```

## Migration Scripts

To backfill finance entries from existing sales and expenses:
1. Ensure your Firebase service account key is in the project (update the path in the script if needed).
2. Run:
```bash
node update-migration/migrateFinanceEntriesFromSalesAndExpenses.cjs
```
This will create finance entries for all sales and expenses that do not already have one.

## Translation & Localization
- All user-facing strings are wrapped in the translation function (`t`).
- Edit `src/i18n/locales/en.json` and `src/i18n/locales/fr.json` to update translations.
- The UI supports English and French out of the box.

## Project Structure
```
lebonprix/
  src/
    components/    # Reusable UI components
    pages/         # Main app pages (Dashboard, Sales, Expenses, etc.)
    hooks/         # Custom React hooks
    contexts/      # React Context providers
    services/      # Firebase and Firestore logic
    i18n/          # Localization config and translations
    types/         # TypeScript models
    utils/         # Utility functions
  update-migration/ # Migration scripts
  public/           # Static assets
```

## Linting & Formatting
Run ESLint to check code quality:
```bash
npm run lint
```

## Contact & Support
For questions, issues, or feature requests, please open an issue or contact the maintainer.

---
**Le Bon Prix** — Modern business management, made simple.
