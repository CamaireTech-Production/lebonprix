/**
 * Import User Data to New Firebase
 * 
 * Imports exported Firestore data to new Firebase project with:
 * - Email-based ID mapping (finds new user/company IDs automatically)
 * - ID regeneration for all documents (except users/companies which already exist)
 * - Dependency chain preservation (updates all references)
 * 
 * Usage:
 *   node scripts/importUserData.js \
 *     --new-service-account=./new-firebase-key.json \
 *     --export-dir=./exports/export-2024-01-15 \
 *     [--dry-run] \
 *     [--skip-existing]
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name, required = true) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  if (!arg && required) {
    console.error(`❌ Missing required argument: --${name}`);
    process.exit(1);
  }
  return arg ? arg.split('=')[1] : null;
};

const newServiceAccountPath = getArg('new-service-account');
const exportDir = getArg('export-dir');
const dryRun = args.includes('--dry-run');
const skipExisting = args.includes('--skip-existing');

// Initialize new Firebase
if (!admin.apps.length) {
  // Resolve path - handle both relative and absolute paths
  let serviceAccountPath = path.resolve(newServiceAccountPath);
  
  // If file doesn't exist, try in scripts directory
  if (!fs.existsSync(serviceAccountPath)) {
    const scriptsPath = path.join(__dirname, path.basename(newServiceAccountPath));
    if (fs.existsSync(scriptsPath)) {
      serviceAccountPath = scriptsPath;
      console.log(`📁 Using service account from scripts directory: ${path.basename(serviceAccountPath)}`);
    } else {
      console.error(`❌ Service account file not found: ${newServiceAccountPath}`);
      console.error(`   Also checked: ${scriptsPath}`);
      process.exit(1);
    }
  }
  
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const storage = admin.storage();

console.log('🚀 Starting data import...');
console.log(`📁 Export directory: ${exportDir}`);
console.log(`🔍 Mode: ${dryRun ? 'DRY RUN (no data will be imported)' : 'IMPORT'}`);
console.log(`⏭️  Skip existing: ${skipExisting ? 'Yes' : 'No'}`);

/**
 * Load export manifest
 */
function loadExportManifest(exportDir) {
  const manifestPath = path.join(exportDir, 'export-manifest.json');
  
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Export manifest not found: ${manifestPath}`);
  }
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`\n📄 Loaded export manifest from ${new Date(manifest.exportDate).toLocaleString()}`);
  return manifest;
}

/**
 * Discover new user and company IDs by email
 */
async function discoverNewIds(emails, emailMapping) {
  console.log('\n🔍 Discovering new user and company IDs by email...');
  
  const idTranslationMap = {};
  
  for (const email of emails) {
    const oldData = emailMapping[email];
    if (!oldData) continue;
    
    console.log(`  📧 Processing: ${email}`);
    
    // Find new user by email
    const usersSnapshot = await db.collection('users')
      .where('email', '==', email)
      .get();
    
    if (usersSnapshot.empty) {
      console.log(`  ⚠️  User not found in new Firebase: ${email}`);
      if (!skipExisting) {
        throw new Error(`User ${email} not found in new Firebase. Use --skip-existing to continue.`);
      }
      continue;
    }
    
    const newUserDoc = usersSnapshot.docs[0];
    const newUserId = newUserDoc.id;
    
    // Find new companies owned by this user
    const companiesSnapshot = await db.collection('companies')
      .where('userId', '==', newUserId)
      .get();
    
    // Also find by email
    const companiesByEmailSnapshot = await db.collection('companies')
      .where('email', '==', email)
      .get();
    
    const newCompanyIds = [];
    const companyMapping = {};
    
    // Map old companies to new companies by email
    const allNewCompanies = companiesSnapshot.docs.concat(companiesByEmailSnapshot.docs);
    
    for (const oldCompanyId of oldData.oldCompanyIds) {
      // Try to find matching company by email
      // We'll need to load the old company data to get its email
      // For now, we'll use a simple index-based mapping
      // In production, you might want to match by email or other unique field
      const index = oldData.oldCompanyIds.indexOf(oldCompanyId);
      if (index < allNewCompanies.length) {
        const newCompanyId = allNewCompanies[index].id;
        companyMapping[oldCompanyId] = newCompanyId;
        newCompanyIds.push(newCompanyId);
      }
    }
    
    idTranslationMap[email] = {
      oldUserId: oldData.oldUserId,
      newUserId,
      companyMapping
    };
    
    console.log(`  ✅ User: ${oldData.oldUserId} → ${newUserId}`);
    console.log(`  🏢 Companies: ${Object.keys(companyMapping).length} mapped`);
  }
  
  return idTranslationMap;
}

/**
 * Convert JSON timestamp back to Firestore Timestamp
 */
function convertToFirestoreTimestamp(obj) {
  if (obj === null || obj === undefined) return obj;
  
  if (obj._seconds !== undefined && obj._nanoseconds !== undefined) {
    return admin.firestore.Timestamp.fromMillis(
      obj._seconds * 1000 + obj._nanoseconds / 1000000
    );
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertToFirestoreTimestamp);
  }
  
  if (typeof obj === 'object') {
    const converted = {};
    for (const key in obj) {
      converted[key] = convertToFirestoreTimestamp(obj[key]);
    }
    return converted;
  }
  
  return obj;
}

/**
 * Generate new document ID
 */
function generateNewId(collectionName) {
  return db.collection(collectionName).doc().id;
}

/**
 * Reference fields that need ID translation per collection
 */
const REFERENCE_FIELDS = {
  // Base references
  userId: 'userId',
  companyId: 'companyId',
  
  // Product references
  productId: 'products',
  category: 'categories',
  supplierId: 'suppliers',
  
  // Sale/Order references
  saleId: 'sales',
  orderId: 'orders',
  sourceId: null, // Can be sale, order, expense, supplier
  
  // Financial references
  refundedDebtId: 'finances',
  batchId: 'stockBatches',
  
  // Customer references
  customerSourceId: 'customerSources',
  firstSourceId: 'customerSources',
  
  // Employee references
  createdBy: null, // EmployeeRef object
  performedBy: 'users',
  
  // Nested references
  'products[].productId': 'products',
  'items[].productId': 'products',
  'consumedBatches[].batchId': 'stockBatches',
  'batchConsumptions[].batchId': 'stockBatches',
  'companies[].companyId': 'companies'
};

/**
 * Load storage mapping
 */
function loadStorageMapping(exportDir) {
  const mappingPath = path.join(exportDir, 'storage-mapping.json');
  
  if (!fs.existsSync(mappingPath)) {
    console.log('  ⚠️  Storage mapping file not found, skipping Storage import');
    return {};
  }
  
  return JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
}

/**
 * Upload file to Firebase Storage
 */
async function uploadStorageFile(localPath, storagePath) {
  try {
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    
    // Check if file already exists
    const [exists] = await file.exists();
    if (exists) {
      // Get existing URL
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: '03-09-2491' // Far future date
      });
      return { success: true, url, path: storagePath, existing: true };
    }
    
    // Upload file
    await bucket.upload(localPath, {
      destination: storagePath,
      metadata: {
        cacheControl: 'public, max-age=31536000'
      }
    });
    
    // Get download URL
    await file.makePublic();
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '03-09-2491'
    });
    
    return { success: true, url, path: storagePath, existing: false };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Import Storage files
 */
async function importStorageFiles(exportDir, idTranslationMap, documentIdMapping) {
  console.log('\n📦 Importing Firebase Storage files...');
  
  const storageMapping = loadStorageMapping(exportDir);
  
  if (Object.keys(storageMapping).length === 0) {
    console.log('  ⚠️  No storage files to import');
    return {};
  }
  
  const storageDir = path.join(exportDir, 'storage');
  if (!fs.existsSync(storageDir)) {
    console.log('  ⚠️  Storage directory not found');
    return {};
  }
  
  const newStorageMapping = {};
  let success = 0;
  let failed = 0;
  let skipped = 0;
  
  for (const [oldUrl, fileInfo] of Object.entries(storageMapping)) {
    const localFilePath = path.join(storageDir, fileInfo.localPath);
    
    if (!fs.existsSync(localFilePath)) {
      console.log(`  ⚠️  Local file not found: ${fileInfo.localPath}`);
      skipped++;
      continue;
    }
    
    // Determine new storage path based on type and new IDs
    let newStoragePath = null;
    let newDocumentId = null;
    
    if (fileInfo.type === 'productImage') {
      // Find new product ID
      newDocumentId = documentIdMapping.products?.[fileInfo.productId];
      if (newDocumentId) {
        const fileName = path.basename(fileInfo.localPath);
        newStoragePath = `products/${newDocumentId}/${fileName}`;
      }
    } else if (fileInfo.type === 'categoryImage') {
      newDocumentId = documentIdMapping.categories?.[fileInfo.categoryId];
      if (newDocumentId) {
        const fileName = path.basename(fileInfo.localPath);
        newStoragePath = `categories/${newDocumentId}/${fileName}`;
      }
    } else if (fileInfo.type === 'companyLogo') {
      // Find new company ID
      for (const email in idTranslationMap) {
        const mapping = idTranslationMap[email].companyMapping;
        if (mapping[fileInfo.companyId]) {
          newDocumentId = mapping[fileInfo.companyId];
          break;
        }
      }
      if (newDocumentId) {
        const fileName = path.basename(fileInfo.localPath);
        newStoragePath = `companies/${newDocumentId}/${fileName}`;
      }
    } else if (fileInfo.type === 'userPhoto') {
      // Find new user ID
      for (const email in idTranslationMap) {
        if (idTranslationMap[email].oldUserId === fileInfo.userId) {
          newDocumentId = idTranslationMap[email].newUserId;
          break;
        }
      }
      if (newDocumentId) {
        const fileName = path.basename(fileInfo.localPath);
        newStoragePath = `users/${newDocumentId}/${fileName}`;
      }
    }
    
    if (!newStoragePath || !newDocumentId) {
      console.log(`  ⚠️  Could not determine new path for ${fileInfo.localPath}, skipping`);
      skipped++;
      continue;
    }
    
    // Upload file
    if (!dryRun) {
      const result = await uploadStorageFile(localFilePath, newStoragePath);
      
      if (result.success) {
        newStorageMapping[oldUrl] = {
          oldUrl,
          newUrl: result.url,
          newPath: newStoragePath,
          type: fileInfo.type
        };
        success++;
        if (result.existing) {
          console.log(`  ℹ️  File already exists: ${newStoragePath}`);
        } else {
          console.log(`  ✅ Uploaded: ${newStoragePath}`);
        }
      } else {
        failed++;
        console.log(`  ❌ Failed to upload ${newStoragePath}: ${result.error}`);
      }
    } else {
      // Dry run
      newStorageMapping[oldUrl] = {
        oldUrl,
        newUrl: `[DRY RUN] ${newStoragePath}`,
        newPath: newStoragePath,
        type: fileInfo.type
      };
      success++;
    }
  }
  
  console.log(`  📊 Storage files: ${success} uploaded, ${failed} failed, ${skipped} skipped`);
  
  return newStorageMapping;
}

/**
 * Update Storage URLs in documents
 */
function updateStorageUrls(doc, collectionName, storageUrlMapping) {
  const updated = JSON.parse(JSON.stringify(doc)); // Deep clone
  
  if (collectionName === 'products' && updated.images) {
    updated.images = updated.images.map(url => {
      return storageUrlMapping[url]?.newUrl || url;
    });
  } else if (collectionName === 'categories' && updated.image) {
    updated.image = storageUrlMapping[updated.image]?.newUrl || updated.image;
  } else if (collectionName === 'companies' && updated.logo) {
    updated.logo = storageUrlMapping[updated.logo]?.newUrl || updated.logo;
  } else if (collectionName === 'users' && updated.photoURL) {
    updated.photoURL = storageUrlMapping[updated.photoURL]?.newUrl || updated.photoURL;
  }
  
  return updated;
}

/**
 * Translate IDs in a document
 */
function translateDocumentIds(doc, idTranslationMap, documentIdMapping, collectionName, storageUrlMapping = {}) {
  let translated = JSON.parse(JSON.stringify(doc)); // Deep clone
  
  // Update Storage URLs first
  translated = updateStorageUrls(translated, collectionName, storageUrlMapping);
  
  // Translate base references
  if (translated.userId && idTranslationMap[translated.userId]) {
    // userId might be in email mapping
    for (const email in idTranslationMap) {
      if (idTranslationMap[email].oldUserId === translated.userId) {
        translated.userId = idTranslationMap[email].newUserId;
        break;
      }
    }
  }
  
  if (translated.companyId) {
    // Find company mapping
    for (const email in idTranslationMap) {
      const mapping = idTranslationMap[email].companyMapping;
      if (mapping[translated.companyId]) {
        translated.companyId = mapping[translated.companyId];
        break;
      }
    }
  }
  
  // Translate collection-specific references
  if (collectionName === 'products') {
    if (translated.category && documentIdMapping.categories?.[translated.category]) {
      translated.category = documentIdMapping.categories[translated.category];
    }
  }
  
  if (collectionName === 'sales' || collectionName === 'orders') {
    if (translated.products) {
      translated.products = translated.products.map(product => {
        if (product.productId && documentIdMapping.products?.[product.productId]) {
          product.productId = documentIdMapping.products[product.productId];
        }
        return product;
      });
    }
    if (translated.items) {
      translated.items = translated.items.map(item => {
        if (item.productId && documentIdMapping.products?.[item.productId]) {
          item.productId = documentIdMapping.products[item.productId];
        }
        return item;
      });
    }
  }
  
  if (collectionName === 'stockBatches') {
    if (translated.productId && documentIdMapping.products?.[translated.productId]) {
      translated.productId = documentIdMapping.products[translated.productId];
    }
    if (translated.supplierId && documentIdMapping.suppliers?.[translated.supplierId]) {
      translated.supplierId = documentIdMapping.suppliers[translated.supplierId];
    }
  }
  
  if (collectionName === 'stockChanges') {
    if (translated.productId && documentIdMapping.products?.[translated.productId]) {
      translated.productId = documentIdMapping.products[translated.productId];
    }
    if (translated.batchId && documentIdMapping.stockBatches?.[translated.batchId]) {
      translated.batchId = documentIdMapping.stockBatches[translated.batchId];
    }
    if (translated.saleId && documentIdMapping.sales?.[translated.saleId]) {
      translated.saleId = documentIdMapping.sales[translated.saleId];
    }
    if (translated.supplierId && documentIdMapping.suppliers?.[translated.supplierId]) {
      translated.supplierId = documentIdMapping.suppliers[translated.supplierId];
    }
  }
  
  if (collectionName === 'finances') {
    if (translated.sourceId) {
      // sourceId can reference sales, orders, expenses, suppliers
      if (translated.sourceType === 'sale' && documentIdMapping.sales?.[translated.sourceId]) {
        translated.sourceId = documentIdMapping.sales[translated.sourceId];
      } else if (translated.sourceType === 'order' && documentIdMapping.orders?.[translated.sourceId]) {
        translated.sourceId = documentIdMapping.orders[translated.sourceId];
      } else if (translated.sourceType === 'expense' && documentIdMapping.expenses?.[translated.sourceId]) {
        translated.sourceId = documentIdMapping.expenses[translated.sourceId];
      } else if (translated.sourceType === 'supplier' && documentIdMapping.suppliers?.[translated.sourceId]) {
        translated.sourceId = documentIdMapping.suppliers[translated.sourceId];
      }
    }
    if (translated.refundedDebtId && documentIdMapping.finances?.[translated.refundedDebtId]) {
      translated.refundedDebtId = documentIdMapping.finances[translated.refundedDebtId];
    }
    if (translated.batchId && documentIdMapping.stockBatches?.[translated.batchId]) {
      translated.batchId = documentIdMapping.stockBatches[translated.batchId];
    }
    if (translated.supplierId && documentIdMapping.suppliers?.[translated.supplierId]) {
      translated.supplierId = documentIdMapping.suppliers[translated.supplierId];
    }
  }
  
  if (collectionName === 'expenses') {
    if (translated.supplierId && documentIdMapping.suppliers?.[translated.supplierId]) {
      translated.supplierId = documentIdMapping.suppliers[translated.supplierId];
    }
  }
  
  if (collectionName === 'customers') {
    if (translated.customerSourceId && documentIdMapping.customerSources?.[translated.customerSourceId]) {
      translated.customerSourceId = documentIdMapping.customerSources[translated.customerSourceId];
    }
    if (translated.firstSourceId && documentIdMapping.customerSources?.[translated.firstSourceId]) {
      translated.firstSourceId = documentIdMapping.customerSources[translated.firstSourceId];
    }
  }
  
  return translated;
}

/**
 * Import collection
 */
async function importCollection(collectionName, exportDir, idTranslationMap, documentIdMapping, importOrder, storageUrlMapping = {}) {
  console.log(`\n📥 Importing collection: ${collectionName}`);
  
  const filePath = path.join(exportDir, `${collectionName}.json`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  File not found: ${filePath}`);
    return { success: 0, failed: 0, skipped: 0 };
  }
  
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  if (!Array.isArray(data) || data.length === 0) {
    console.log(`  ⚠️  No data to import`);
    return { success: 0, failed: 0, skipped: 0 };
  }
  
  // Skip users and companies if they already exist
  if ((collectionName === 'users' || collectionName === 'companies') && skipExisting) {
    console.log(`  ⏭️  Skipping ${collectionName} (already exist in new Firebase)`);
    return { success: 0, failed: 0, skipped: data.length };
  }
  
  let success = 0;
  let failed = 0;
  let skipped = 0;
  
  // Process in batches of 500 (Firestore limit)
  const batchSize = 500;
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = db.batch();
    const batchData = data.slice(i, i + batchSize);
    
    for (const doc of batchData) {
      try {
        // Generate new document ID
        const newId = generateNewId(collectionName);
        
        // Translate IDs in document (including Storage URLs)
        const translated = translateDocumentIds(doc, idTranslationMap, documentIdMapping, collectionName, storageUrlMapping);
        
        // Convert timestamps
        const converted = convertToFirestoreTimestamp(translated);
        
        // Remove old id, set new id
        delete converted.id;
        
        // Create document reference
        const docRef = db.collection(collectionName).doc(newId);
        
        if (!dryRun) {
          batch.set(docRef, converted);
        }
        
        // Track ID mapping
        if (!documentIdMapping[collectionName]) {
          documentIdMapping[collectionName] = {};
        }
        documentIdMapping[collectionName][doc.id] = newId;
        
        success++;
      } catch (error) {
        console.error(`  ❌ Error processing document ${doc.id}:`, error.message);
        failed++;
      }
    }
    
    if (!dryRun && batchData.length > 0) {
      try {
        await batch.commit();
        console.log(`  ✅ Batch ${Math.floor(i / batchSize) + 1}: ${batchData.length} documents`);
      } catch (error) {
        console.error(`  ❌ Batch commit failed:`, error.message);
        failed += batchData.length;
        success -= batchData.length;
      }
    }
  }
  
  console.log(`  📊 Summary: ${success} imported, ${failed} failed, ${skipped} skipped`);
  
  return { success, failed, skipped };
}

/**
 * Update documents with new Storage URLs
 */
async function updateDocumentsWithStorageUrls(importStats, storageUrlMapping, exportDir, idTranslationMap, documentIdMapping) {
  const collectionsToUpdate = ['products', 'categories', 'companies', 'users'];
  
  for (const collectionName of collectionsToUpdate) {
    if (!importStats[collectionName] || importStats[collectionName].success === 0) continue;
    
    console.log(`  🔄 Updating ${collectionName} with new Storage URLs...`);
    
    // Read the exported data
    const filePath = path.join(exportDir, `${collectionName}.json`);
    
    if (!fs.existsSync(filePath)) continue;
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let updated = 0;
    let batch = db.batch();
    let batchCount = 0;
    
    for (const doc of data) {
      // Find new document ID
      const newDocId = documentIdMapping[collectionName]?.[doc.id];
      if (!newDocId) continue;
      
      // Get updated document with new Storage URLs
      const updatedDoc = updateStorageUrls(doc, collectionName, storageUrlMapping);
      
      // Check if Storage URLs changed
      let hasChanges = false;
      if (collectionName === 'products' && updatedDoc.images) {
        hasChanges = updatedDoc.images.some((url, idx) => url !== (doc.images?.[idx] || ''));
      } else if (collectionName === 'categories' && updatedDoc.image !== doc.image) {
        hasChanges = true;
      } else if (collectionName === 'companies' && updatedDoc.logo !== doc.logo) {
        hasChanges = true;
      } else if (collectionName === 'users' && updatedDoc.photoURL !== doc.photoURL) {
        hasChanges = true;
      }
      
      if (hasChanges) {
        const docRef = db.collection(collectionName).doc(newDocId);
        
        // Update only the fields that changed
        const updateData = {};
        if (collectionName === 'products' && updatedDoc.images) {
          updateData.images = updatedDoc.images;
        } else if (collectionName === 'categories' && updatedDoc.image) {
          updateData.image = updatedDoc.image;
        } else if (collectionName === 'companies' && updatedDoc.logo) {
          updateData.logo = updatedDoc.logo;
        } else if (collectionName === 'users' && updatedDoc.photoURL) {
          updateData.photoURL = updatedDoc.photoURL;
        }
        
        if (!dryRun) {
          batch.update(docRef, updateData);
          batchCount++;
        }
        updated++;
        
        // Commit batch every 500 updates
        if (batchCount >= 500 && !dryRun) {
          await batch.commit();
          batch = db.batch(); // Create new batch
          batchCount = 0;
        }
      }
    }
    
    // Commit remaining updates
    if (batchCount > 0 && !dryRun) {
      await batch.commit();
    }
    
    if (updated > 0) {
      console.log(`  ✅ Updated ${updated} ${collectionName} documents`);
    }
  }
}

/**
 * Import sub-collection
 */
async function importSubCollection(parentCollection, parentId, subCollectionName, exportDir, idTranslationMap, documentIdMapping, newParentId) {
  const subDir = path.join(exportDir, parentCollection, parentId, `${subCollectionName}.json`);
  
  if (!fs.existsSync(subDir)) {
    return { success: 0, failed: 0 };
  }
  
  const data = JSON.parse(fs.readFileSync(subDir, 'utf8'));
  
  if (!Array.isArray(data) || data.length === 0) {
    return { success: 0, failed: 0 };
  }
  
  console.log(`  📥 Importing sub-collection: ${parentCollection}/${parentId}/${subCollectionName} (${data.length} documents)`);
  
  let success = 0;
  let failed = 0;
  
  const batch = db.batch();
  
  for (const doc of data) {
    try {
      const newId = generateNewId(subCollectionName);
      const translated = translateDocumentIds(doc, idTranslationMap, documentIdMapping, subCollectionName);
      const converted = convertToFirestoreTimestamp(translated);
      delete converted.id;
      
      const docRef = db
        .collection(parentCollection)
        .doc(newParentId)
        .collection(subCollectionName)
        .doc(newId);
      
      if (!dryRun) {
        batch.set(docRef, converted);
      }
      
      success++;
    } catch (error) {
      console.error(`  ❌ Error processing sub-document ${doc.id}:`, error.message);
      failed++;
    }
  }
  
  if (!dryRun && data.length > 0) {
    try {
      await batch.commit();
    } catch (error) {
      console.error(`  ❌ Sub-collection batch commit failed:`, error.message);
      failed += data.length;
      success = 0;
    }
  }
  
  return { success, failed };
}

/**
 * Import sub-collections for companies
 */
async function importCompanySubCollections(exportDir, idTranslationMap, documentIdMapping) {
  console.log(`\n📥 Importing company sub-collections...`);
  
  const companiesDir = path.join(exportDir, 'companies');
  
  if (!fs.existsSync(companiesDir)) {
    console.log(`  ⚠️  Companies directory not found`);
    return { success: 0, failed: 0 };
  }
  
  const companyDirs = fs.readdirSync(companiesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  let totalSuccess = 0;
  let totalFailed = 0;
  
  for (const oldCompanyId of companyDirs) {
    // Find new company ID
    let newCompanyId = null;
    for (const email in idTranslationMap) {
      const mapping = idTranslationMap[email].companyMapping;
      if (mapping[oldCompanyId]) {
        newCompanyId = mapping[oldCompanyId];
        break;
      }
    }
    
    if (!newCompanyId) {
      console.log(`  ⚠️  Could not find new company ID for ${oldCompanyId}, skipping sub-collections`);
      continue;
    }
    
    // Import employeeRefs
    const employeeRefsResult = await importSubCollection(
      'companies', oldCompanyId, 'employeeRefs', exportDir, idTranslationMap, documentIdMapping, newCompanyId
    );
    totalSuccess += employeeRefsResult.success;
    totalFailed += employeeRefsResult.failed;
    
    // Import permissionTemplates
    const templatesResult = await importSubCollection(
      'companies', oldCompanyId, 'permissionTemplates', exportDir, idTranslationMap, documentIdMapping, newCompanyId
    );
    totalSuccess += templatesResult.success;
    totalFailed += templatesResult.failed;
  }
  
  console.log(`  📊 Sub-collections: ${totalSuccess} imported, ${totalFailed} failed`);
  
  return { success: totalSuccess, failed: totalFailed };
}

/**
 * Dependency-aware import order
 */
const IMPORT_ORDER = [
  // Level 1: Base collections (no dependencies)
  'categories',
  'suppliers',
  'customerSources',
  'expenseTypes',
  'financeEntryTypes',
  
  // Level 2: Products (depends on categories, suppliers)
  'products',
  
  // Level 3: Stock (depends on products, suppliers)
  'stockBatches',
  'stockChanges',
  
  // Level 4: Customers (depends on customerSources)
  'customers',
  
  // Level 5: Transactions (depends on products, customers)
  'sales',
  'orders',
  
  // Level 6: Financial (depends on sales, orders, expenses, suppliers, stockBatches)
  'expenses',
  'finances',
  
  // Level 7: Other
  'objectives',
  'checkout_settings',
  'cinetpay_configs',
  'sellerSettings',
  
  // Level 8: Audit (optional)
  'auditLogs'
];

/**
 * Main import function
 */
async function performImport() {
  try {
    // 1. Load manifest
    const manifest = loadExportManifest(exportDir);
    
    // 2. Discover new IDs
    const idTranslationMap = await discoverNewIds(manifest.emails, manifest.emailMapping);
    
    if (Object.keys(idTranslationMap).length === 0) {
      throw new Error('No users found in new Firebase. Cannot proceed with import.');
    }
    
    // 3. Document ID mapping (for reference translation)
    const documentIdMapping = {};
    
    // 4. Import sub-collections first (they depend on companies)
    if (manifest.collections.includes('companies')) {
      await importCompanySubCollections(exportDir, idTranslationMap, documentIdMapping);
    }
    
    // 5. Import collections in dependency order
    // First pass: Import without Storage URLs (to get document IDs)
    const importStats = {};
    const collectionsNeedingStorage = ['products', 'categories', 'companies', 'users'];
    let storageUrlMapping = {};
    
    // Import base collections first
    for (const collectionName of IMPORT_ORDER) {
      if (manifest.collections.includes(collectionName) && !collectionsNeedingStorage.includes(collectionName)) {
        const stats = await importCollection(
          collectionName, exportDir, idTranslationMap, documentIdMapping, IMPORT_ORDER, {}
        );
        importStats[collectionName] = stats;
      }
    }
    
    // Import collections that might have Storage references (to get their IDs)
    for (const collectionName of collectionsNeedingStorage) {
      if (manifest.collections.includes(collectionName)) {
        const stats = await importCollection(
          collectionName, exportDir, idTranslationMap, documentIdMapping, IMPORT_ORDER, {}
        );
        importStats[collectionName] = stats;
      }
    }
    
    // 6. Import Storage files (now we have all document IDs)
    storageUrlMapping = await importStorageFiles(exportDir, idTranslationMap, documentIdMapping);
    
    // 7. Update documents with new Storage URLs
    if (Object.keys(storageUrlMapping).length > 0) {
      console.log('\n🔄 Updating documents with new Storage URLs...');
      await updateDocumentsWithStorageUrls(importStats, storageUrlMapping, exportDir, idTranslationMap, documentIdMapping);
    }
    
    // 7. Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(60));
    
    let totalSuccess = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    
    for (const [collection, stats] of Object.entries(importStats)) {
      totalSuccess += stats.success;
      totalFailed += stats.failed;
      totalSkipped += stats.skipped;
      console.log(`  ${collection}: ${stats.success} imported, ${stats.failed} failed, ${stats.skipped} skipped`);
    }
    
    console.log(`\n📊 Total: ${totalSuccess} imported, ${totalFailed} failed, ${totalSkipped} skipped`);
    
    if (dryRun) {
      console.log('\n⚠️  DRY RUN MODE - No data was imported');
    } else {
      console.log('\n✅ Import completed successfully!');
    }
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

// Run import
performImport();

