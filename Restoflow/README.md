# FoodOrder v2 – Restaurant Ordering System

A modern, production-ready restaurant ordering app built with React, TypeScript, Firebase Firestore, and Tailwind CSS.

## Features
- Customer menu browsing and table-based ordering (with FCFA currency)
- Real-time order dashboard for restaurant staff
- Restaurant dashboard with menu, category, and table management
- Sidebar navigation and responsive layouts
- Cameroon phone number support with country code dropdown
- Toast notifications for user feedback
- Consistent design system using Tailwind CSS with a custom primary color
- Firestore as the backend for menu, categories, tables, and orders

## Getting Started

### 1. Clone the Repository
```sh
git clone https://github.com/CamaireTech-Production/Restaurant-Ordering-System.git
cd "Restaurant App/restaurant app v2"
```

### 2. Install Dependencies
```sh
npm install
```

### 3. Set Up Firebase Credentials
Create a `.env` file in the project root with your Firebase config:

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

> **Note:** Never commit your real credentials to a public repository.

### 4. (Optional) Initialize Firestore Collections
If you have a seeding script, run it to upload sample menu items and categories:

```sh
npx tsx src/scripts/initFirestore.ts
```

### 5. Start the Development Server
```sh
npm run dev
```

The app will be available at `http://localhost:5173` (or as shown in your terminal).

## Firestore Security Rules (Development Only)
For local development, you can use permissive rules. In the Firebase Console, set your Firestore rules to:

```
service cloud.firestore {
  match /databases/{database}/documents {
    match /{doc=**} {
      allow read, write: if true;
    }
  }
}
```

> **Warning:** These rules allow full read/write access to your database. **Do not use in production!**

## Deployment
- Push your code to GitHub.
- You can deploy to Vercel, Netlify, or Firebase Hosting. Make sure to set the same environment variables in your deployment platform.

## License
MIT

# Recent Development Updates

## Image Migration to Firebase Storage (December 2024)

### Overview
Successfully migrated all dish images from base64 storage in Firestore to Firebase Storage URLs for improved performance and scalability.

### What Was Accomplished
- **Migration Scope**: Converted 36 base64 images to Firebase Storage URLs
- **Organization**: Images are now organized by restaurant folders: `restaurants/{restaurantId}/dishes/{uuid}.jpg`
- **Metadata Enhancement**: Enhanced media metadata with rich information for better management
- **Template Updates**: All menu templates now use Firebase Storage URLs instead of base64 strings

### Migration Scripts Created
1. **`migrateMenuItemsImagesSimple.cjs`** - Main migration script that:
   - Converts base64 images to Firebase Storage
   - Updates menuItem documents with new URLs
   - Creates basic metadata entries in the `media` collection

2. **`enhanceMediaMetadata.cjs`** - Metadata enhancement script that:
   - Finds corresponding menuItems for each media item
   - Generates rich metadata including tags, cuisine type, dietary info
   - Updates media documents with comprehensive metadata

3. **`testTemplateImages.cjs`** - Verification script to confirm migration success

### Database Changes
- **Before**: Images stored as base64 strings in `menuItems.image` field
- **After**: Images stored in Firebase Storage with URLs in `menuItems.image` field
- **New Collection**: `media` collection tracks all images with rich metadata

### Metadata Structure
Each media item now includes:
```typescript
{
  // Basic info
  url: string;
  originalFileName: string;
  dishName: string;
  restaurantId: string;
  type: 'dish' | 'logo' | 'menu';
  uploadDate: Timestamp;
  size: number;
  storagePath: string;
  
  // Rich metadata
  metadata: {
    dishId: string;
    dishName: string;
    dishDescription: string;
    dishPrice: number;
    restaurantName: string;
    categoryName: string;
    tags: string[];
    cuisine: string;
    dietary: string[];
    searchKeywords: string[];
    qualityScore: 'low' | 'medium' | 'high' | 'very-high';
    migrationDate: string;
    enhancedDate: string;
  }
}
```

### Performance Benefits
- **Faster Loading**: Firebase Storage URLs load faster than base64 strings
- **Reduced Database Size**: Firestore documents are smaller without base64 data
- **Better Scalability**: Firebase Storage handles large images more efficiently
- **CDN Benefits**: Images served through Firebase's global CDN

### Media Management
- **Admin Interface**: Enhanced Media Management page displays rich metadata
- **Search & Filter**: Improved search capabilities with tags and keywords
- **Quality Tracking**: Quality scores based on file size
- **Migration Tracking**: Full audit trail of image migrations

## Environment Setup for Migration Scripts

### Required Environment Variables
Add these to your `.env` file for running migration scripts:

```env
# Firebase Admin SDK (for server-side scripts)
VITE_FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

### Service Account Setup
1. Go to Firebase Console → Project Settings → Service Accounts
2. Generate a new private key
3. Save as `serviceAccountKey.json` in project root (optional)
4. Or use environment variables (recommended for production)

### Running Migration Scripts
```bash
# Check current image status
node scripts/checkMenuItems.cjs

# Run image migration
node scripts/migrateMenuItemsImagesSimple.cjs

# Enhance metadata
node scripts/enhanceMediaMetadata.cjs

# Test migration results
node scripts/testTemplateImages.cjs
node scripts/testMediaMetadata.cjs
```

## Firebase Storage Security Rules
Update your Firebase Storage rules to allow public read access for images:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /restaurants/{restaurantId}/dishes/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

# Subcategory Support for Menu Categories

## Overview
- Categories now support subcategories via a `parentCategoryId` field.
- Categories with no `parentCategoryId` are main categories; those with a value are subcategories.
- The UI (admin, restaurant, demo) allows creating, editing, and viewing categories in a tree/expandable list.
- Dishes can be assigned to either main or subcategories.

## Migration Notes
- Existing categories will have `parentCategoryId: undefined` (main category).
- No migration is needed unless you want to organize existing categories into a hierarchy.
- All category CRUD and dish assignment logic is backward compatible.

## Activity Logging
- All subcategory-related actions (create, edit, delete, restore, assign to dish, change parent) are logged in the activity log for regular, demo, and admin actions.
- Log entries include the `parentCategoryId` and relevant details.

## Feature Flag
- Subcategory support is always enabled; there is no feature flag for this feature.

## UI Usage
- In the admin and restaurant panels, you can select a parent category when creating or editing a category.
- The category table displays categories in a tree, with subcategories indented under their parent.
- You cannot set a category as its own parent or create circular references.
