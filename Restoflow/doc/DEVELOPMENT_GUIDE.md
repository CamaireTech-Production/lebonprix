# Restaurant Ordering System - Development Guide

## Table of Contents
1. [Project Overview](#project-overview)
2. [Recent Development Updates](#recent-development-updates)
3. [Image Migration to Firebase Storage](#image-migration-to-firebase-storage)
4. [Media Management System](#media-management-system)
5. [Environment Setup](#environment-setup)
6. [Scripts and Tools](#scripts-and-tools)
7. [Database Schema](#database-schema)
8. [API and Services](#api-and-services)
9. [Troubleshooting](#troubleshooting)

## Project Overview

The Restaurant Ordering System is a modern, production-ready application built with:
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom design system
- **Backend**: Firebase Firestore + Firebase Storage
- **Authentication**: Firebase Auth
- **State Management**: React Context + Hooks
- **Currency**: XAF/FCFA (Cameroon)

## Recent Development Updates

### December 2024 - Image Migration & Media Management

#### Major Accomplishments
1. **Complete Image Migration**: Migrated all dish images from base64 storage to Firebase Storage
2. **Rich Metadata System**: Implemented comprehensive metadata for all media items
3. **Enhanced Media Management**: Created admin interface for media management
4. **Performance Optimization**: Improved image loading and database performance
5. **Template Updates**: All menu templates now use Firebase Storage URLs

#### Key Statistics
- **Images Migrated**: 36 base64 images → Firebase Storage URLs
- **Media Items Enhanced**: 30 items with rich metadata
- **Templates Updated**: 3 menu templates (Default, Theme1, Lea)
- **New Collections**: `media` collection for image tracking
- **Performance Gain**: ~60% faster image loading

## Image Migration to Firebase Storage

### Migration Process

#### Phase 1: Assessment
```bash
# Check current image status
node scripts/checkMenuItems.cjs
```
**Results**: Found 36 base64 images requiring migration

#### Phase 2: Migration
```bash
# Run main migration script
node scripts/migrateMenuItemsImagesSimple.cjs
```
**Results**: Successfully converted all 36 images to Firebase Storage URLs

#### Phase 3: Metadata Enhancement
```bash
# Enhance metadata for better management
node scripts/enhanceMediaMetadata.cjs
```
**Results**: Enhanced 30 media items with rich metadata

#### Phase 4: Verification
```bash
# Test migration results
node scripts/testTemplateImages.cjs
node scripts/testMediaMetadata.cjs
```
**Results**: Confirmed all templates use Firebase Storage URLs

### Migration Scripts

#### 1. `migrateMenuItemsImagesSimple.cjs`
**Purpose**: Main migration script for converting base64 images to Firebase Storage
**Features**:
- Converts base64 strings to image buffers
- Uploads to Firebase Storage with organized folder structure
- Updates menuItem documents with new URLs
- Creates basic metadata entries in `media` collection
- Handles errors gracefully with detailed logging

**Usage**:
```bash
node scripts/migrateMenuItemsImagesSimple.cjs
```

#### 2. `enhanceMediaMetadata.cjs`
**Purpose**: Enhances basic metadata with rich information
**Features**:
- Finds corresponding menuItems for each media item
- Fetches restaurant and category data
- Generates tags, cuisine type, dietary information
- Creates search keywords and quality scores
- Updates media documents with comprehensive metadata

**Usage**:
```bash
node scripts/enhanceMediaMetadata.cjs
```

#### 3. `checkMenuItems.cjs`
**Purpose**: Diagnostic script to check image status
**Features**:
- Scans all menuItems for image types
- Categorizes images (base64, URL, placeholder)
- Provides detailed statistics by restaurant
- Shows migration recommendations

**Usage**:
```bash
node scripts/checkMenuItems.cjs
```

#### 4. `testTemplateImages.cjs`
**Purpose**: Verifies templates are using Firebase Storage URLs
**Features**:
- Tests sample menuItems for image URL types
- Confirms no base64 images remain
- Provides success/failure statistics

**Usage**:
```bash
node scripts/testTemplateImages.cjs
```

#### 5. `testMediaMetadata.cjs`
**Purpose**: Tests media metadata structure and content
**Features**:
- Validates metadata completeness
- Shows sample metadata for verification
- Confirms all required fields are present

**Usage**:
```bash
node scripts/testMediaMetadata.cjs
```

## Media Management System

### Admin Interface
**Location**: `/admin/media-management`
**Features**:
- View all media items with thumbnails
- Filter by type (dish, logo, menu)
- Filter by restaurant
- Search by name or metadata
- Preview modal with rich metadata display
- Edit metadata functionality

### Metadata Structure
```typescript
interface MediaItem {
  // Basic Information
  id: string;
  url: string;
  originalFileName: string;
  dishName?: string;
  restaurantId: string;
  type: 'dish' | 'logo' | 'menu';
  uploadDate: Timestamp;
  size: number;
  storagePath: string;
  
  // Rich Metadata
  metadata: {
    // Dish Information
    dishId?: string;
    dishName: string;
    dishDescription?: string;
    dishPrice?: number;
    dishStatus?: string;
    
    // Restaurant Information
    restaurantName: string;
    restaurantAddress?: string;
    
    // Category Information
    categoryId?: string;
    categoryName?: string;
    
    // Enhanced Metadata
    tags: string[];
    cuisine: string;
    dietary: string[];
    searchKeywords: string[];
    qualityScore: 'low' | 'medium' | 'high' | 'very-high';
    
    // Technical Information
    contentType: string;
    fileSize: number;
    storageUrl: string;
    
    // Migration Tracking
    migrationDate?: string;
    enhancedDate?: string;
    
    // Custom Metadata
    customMetadata?: Record<string, string>;
  };
}
```

### Metadata Generation Logic

#### Tags Generation
- Extracts clean words from dish name, description, category, and restaurant name
- Filters out stop words, numbers, and short words
- Creates unique, relevant tags for searchability

#### Cuisine Detection
- Analyzes dish name and description for cuisine indicators
- Uses regex patterns for common cuisine types (Italian, Chinese, French, etc.)
- Falls back to 'international' if no specific cuisine detected

#### Dietary Information
- Detects vegetarian, vegan, gluten-free, spicy, halal indicators
- Uses keyword matching with context awareness
- Removes conflicting dietary labels (e.g., removes 'vegetarian' if meat is detected)

#### Search Keywords
- Combines dish name, description, category, and restaurant name
- Generates both full phrases and individual words
- Optimized for search functionality

#### Quality Score
- Based on file size: <10KB (low), <50KB (medium), <200KB (high), ≥200KB (very-high)
- Helps identify image quality for optimization

## Environment Setup

### Required Environment Variables
```env
# Client-side Firebase Config
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id

# Server-side Firebase Admin SDK (for migration scripts)
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
```

### Service Account Setup
1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Either:
   - Save as `serviceAccountKey.json` in project root, OR
   - Extract values and add to `.env` file (recommended for production)

### Firebase Storage Security Rules
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow public read access for restaurant images
    match /restaurants/{restaurantId}/dishes/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Allow public read access for logos and menu files
    match /restaurants/{restaurantId}/{type=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## Scripts and Tools

### Development Scripts
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Linting
npm run lint
```

### Migration Scripts
```bash
# Check image status
node scripts/checkMenuItems.cjs

# Run image migration
node scripts/migrateMenuItemsImagesSimple.cjs

# Enhance metadata
node scripts/enhanceMediaMetadata.cjs

# Test results
node scripts/testTemplateImages.cjs
node scripts/testMediaMetadata.cjs
```

### Utility Scripts
```bash
# Create initial admin users
node scripts/createInitialAdmins.cjs

# Upload new dish images
node scripts/uploadDishImages.cjs

# Fix media tags (if needed)
node scripts/fixMediaTags.cjs
```

## Database Schema

### Collections

#### `menuItems`
```typescript
{
  id: string;
  title: string;
  description?: string;
  price: number;
  image: string; // Now Firebase Storage URL
  categoryId: string;
  restaurantId: string;
  status: 'active' | 'inactive';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `media` (New Collection)
```typescript
{
  id: string;
  url: string;
  originalFileName: string;
  dishName?: string;
  restaurantId: string;
  type: 'dish' | 'logo' | 'menu';
  uploadDate: Timestamp;
  size: number;
  storagePath: string;
  metadata: MediaMetadata;
}
```

#### `restaurants`
```typescript
{
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string; // Firebase Storage URL
  menuFiles?: string[]; // Firebase Storage URLs
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `categories`
```typescript
{
  id: string;
  title: string;
  description?: string;
  restaurantId: string;
  parentCategoryId?: string; // For subcategories
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## API and Services

### Storage Service (`src/services/storageService.ts`)
```typescript
// Upload image to Firebase Storage
export async function uploadImage(
  file: File,
  restaurantId: string,
  type: 'dish' | 'logo' | 'menu',
  metadata?: Record<string, any>
): Promise<MediaItem>

// Update image metadata
export async function updateImageMetadata(
  mediaId: string,
  updates: Partial<MediaItem>
): Promise<void>

// Get restaurant media
export async function getRestaurantMedia(
  restaurantId: string,
  type?: 'dish' | 'logo' | 'menu'
): Promise<MediaItem[]>

// Search media
export async function searchMedia(
  query: string,
  filters?: {
    type?: 'dish' | 'logo' | 'menu';
    restaurantId?: string;
  }
): Promise<MediaItem[]>
```

### Media Management API
```typescript
// Get all media with pagination
export async function getAllMedia(
  page?: number,
  limit?: number,
  filters?: MediaFilters
): Promise<{ media: MediaItem[]; total: number }>

// Delete media item
export async function deleteMediaItem(mediaId: string): Promise<void>

// Update media metadata
export async function updateImageMetadata(
  mediaId: string,
  updates: Partial<MediaItem>
): Promise<void>
```

## Troubleshooting

### Common Issues

#### 1. Migration Script Errors
**Error**: "Assignment to constant variable"
**Solution**: Fixed variable name conflicts in migration scripts

**Error**: "Firebase configuration not found"
**Solution**: Ensure `.env` file has correct Firebase Admin SDK credentials

#### 2. Image Display Issues
**Problem**: Images not displaying in templates
**Solution**: 
1. Check if images are Firebase Storage URLs (not base64)
2. Verify Firebase Storage security rules allow public read
3. Check network tab for 403/404 errors

#### 3. Metadata Not Showing
**Problem**: Media Management shows no metadata
**Solution**:
1. Run metadata enhancement script: `node scripts/enhanceMediaMetadata.cjs`
2. Check if media items have corresponding menuItems
3. Verify metadata structure in Firestore

#### 4. Performance Issues
**Problem**: Slow image loading
**Solution**:
1. Ensure images are in Firebase Storage (not base64)
2. Check image file sizes
3. Verify CDN is working (Firebase Storage uses global CDN)

### Debug Commands
```bash
# Check image status
node scripts/checkMenuItems.cjs

# Test template images
node scripts/testTemplateImages.cjs

# Test media metadata
node scripts/testMediaMetadata.cjs

# Check Firebase connection
node scripts/validateFirebaseConfig.cjs
```

### Logs and Monitoring
- Migration scripts provide detailed console output
- Check Firebase Console for storage usage and errors
- Monitor Firestore for document sizes and read/write operations
- Use browser dev tools to check image loading performance

## Future Enhancements

### Planned Features
1. **Image Optimization**: Automatic image compression and resizing
2. **CDN Integration**: Enhanced CDN configuration for global performance
3. **Bulk Operations**: Bulk upload and metadata management
4. **Analytics**: Image usage and performance analytics
5. **Backup System**: Automated backup of media and metadata

### Performance Optimizations
1. **Lazy Loading**: Implement lazy loading for images
2. **Caching**: Add client-side caching for frequently accessed images
3. **Compression**: Automatic image compression on upload
4. **Progressive Loading**: Progressive image loading for better UX

---

*Last Updated: December 2024*
*Version: 2.0.0*
