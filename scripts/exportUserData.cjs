/**
 * Export User Data from Old Firebase
 * 
 * Exports Firestore data for specific users (identified by email) and their companies.
 * Uses email-based discovery to find all related data.
 * 
 * Usage: 
 *   node scripts/exportUserData.js \
 *     --old-service-account=./old-firebase-key.json \
 *     --emails=user1@example.com,user2@example.com \
 *     [--collections=users,companies,products,sales] \
 *     [--output=./exports] \
 *     [--dry-run]
 * 
 * Note: If --collections is not specified, ALL collections will be exported.
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

const oldServiceAccountPath = getArg('old-service-account');
const emailsArg = getArg('emails');
const collectionsArg = getArg('collections', false); // Make optional
const outputDir = getArg('output', false) || './exports';
const dryRun = args.includes('--dry-run');

// Initialize old Firebase
if (!admin.apps.length) {
  // Resolve path - handle both relative and absolute paths
  let serviceAccountPath = path.resolve(oldServiceAccountPath);
  
  // If file doesn't exist, try in scripts directory
  if (!fs.existsSync(serviceAccountPath)) {
    const scriptsPath = path.join(__dirname, path.basename(oldServiceAccountPath));
    if (fs.existsSync(scriptsPath)) {
      serviceAccountPath = scriptsPath;
      console.log(`📁 Using service account from scripts directory: ${path.basename(serviceAccountPath)}`);
    } else {
      console.error(`❌ Service account file not found: ${oldServiceAccountPath}`);
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

// All available collections
const ALL_COLLECTIONS = [
  'users',
  'companies',
  'products',
  'sales',
  'orders',
  'expenses',
  'finances',
  'suppliers',
  'customers',
  'categories',
  'stockBatches',
  'stockChanges',
  'objectives',
  'financeEntries',
  'financeEntryTypes',
  'expenseTypes',
  'customerSources',
  'invitations',
  'checkout_settings',
  'cinetpay_configs',
  'sellerSettings',
  'auditLogs'
];

// Parse emails and collections
const emails = emailsArg.split(',').map(e => e.trim().toLowerCase());
const collections = collectionsArg 
  ? collectionsArg.split(',').map(c => c.trim())
  : ALL_COLLECTIONS; // Export all if not specified

console.log('🚀 Starting data export...');
console.log(`📧 Emails: ${emails.join(', ')}`);
console.log(`📋 Collections: ${collections.length} collection(s)${collectionsArg ? ` (${collections.join(', ')})` : ' (ALL COLLECTIONS)'}`);
console.log(`🔍 Mode: ${dryRun ? 'DRY RUN (no files will be written)' : 'EXPORT'}`);

/**
 * Create export directory with timestamp
 */
function createExportDirectory() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const exportDir = path.join(outputDir, `export-${timestamp}`);
  
  if (!dryRun && !fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }
  
  return exportDir;
}

/**
 * Discover users and companies by email
 */
async function discoverUsersAndCompanies(emails) {
  console.log('\n🔍 Discovering users and companies by email...');
  
  const emailMapping = {};
  const allUserIds = new Set();
  const allCompanyIds = new Set();
  
  for (const email of emails) {
    console.log(`  📧 Searching for: ${email}`);
    
    // Find user by email
    const usersSnapshot = await db.collection('users')
      .where('email', '==', email)
      .get();
    
    if (usersSnapshot.empty) {
      console.log(`  ⚠️  User not found: ${email}`);
      continue;
    }
    
    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    const oldUserId = userDoc.id;
    
    allUserIds.add(oldUserId);
    
    // Find companies owned by this user
    const companiesSnapshot = await db.collection('companies')
      .where('userId', '==', oldUserId)
      .get();
    
    const companyIds = companiesSnapshot.docs.map(doc => doc.id);
    
    // Also find companies by email match
    const companiesByEmailSnapshot = await db.collection('companies')
      .where('email', '==', email)
      .get();
    
    companiesByEmailSnapshot.docs.forEach(doc => {
      if (!companyIds.includes(doc.id)) {
        companyIds.push(doc.id);
      }
    });
    
    companyIds.forEach(id => allCompanyIds.add(id));
    
    emailMapping[email] = {
      oldUserId,
      oldCompanyIds: companyIds,
      oldCompanyEmails: companiesSnapshot.docs
        .concat(companiesByEmailSnapshot.docs)
        .map(doc => doc.data().email)
        .filter(Boolean)
    };
    
    console.log(`  ✅ Found user: ${userData.firstname} ${userData.lastname} (${oldUserId})`);
    console.log(`  🏢 Found ${companyIds.length} companies`);
  }
  
  return {
    emailMapping,
    allUserIds: Array.from(allUserIds),
    allCompanyIds: Array.from(allCompanyIds)
  };
}

/**
 * Export sub-collection
 */
async function exportSubCollection(parentCollection, parentId, subCollectionName, exportDir) {
  try {
    const subCollectionRef = db
      .collection(parentCollection)
      .doc(parentId)
      .collection(subCollectionName);
    
    const snapshot = await subCollectionRef.get();
    
    if (snapshot.empty) {
      return [];
    }
    
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Save to file
    const subDir = path.join(exportDir, parentCollection, parentId);
    if (!dryRun && !fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true });
    }
    
    const filePath = path.join(subDir, `${subCollectionName}.json`);
    if (!dryRun) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
    
    return data;
  } catch (error) {
    console.log(`  ⚠️  Sub-collection ${subCollectionName} not found or error: ${error.message}`);
    return [];
  }
}

/**
 * Extract Storage URLs and paths from a document
 */
function extractStorageReferences(doc, collectionName) {
  const storageRefs = [];
  
  if (collectionName === 'products') {
    // Product images
    if (doc.images && Array.isArray(doc.images)) {
      doc.images.forEach((url, index) => {
        if (url && typeof url === 'string' && (url.startsWith('https://') || url.startsWith('gs://'))) {
          storageRefs.push({ type: 'productImage', url, path: doc.imagePaths?.[index], productId: doc.id, index });
        }
      });
    }
  } else if (collectionName === 'categories') {
    // Category image
    if (doc.image && typeof doc.image === 'string' && (doc.image.startsWith('https://') || doc.image.startsWith('gs://'))) {
      storageRefs.push({ type: 'categoryImage', url: doc.image, path: doc.imagePath, categoryId: doc.id });
    }
  } else if (collectionName === 'companies') {
    // Company logo (could be Storage URL or base64)
    if (doc.logo && typeof doc.logo === 'string' && (doc.logo.startsWith('https://') || doc.logo.startsWith('gs://'))) {
      storageRefs.push({ type: 'companyLogo', url: doc.logo, companyId: doc.id });
    }
  } else if (collectionName === 'users') {
    // User photo
    if (doc.photoURL && typeof doc.photoURL === 'string' && (doc.photoURL.startsWith('https://') || doc.photoURL.startsWith('gs://'))) {
      storageRefs.push({ type: 'userPhoto', url: doc.photoURL, userId: doc.id });
    }
  }
  
  return storageRefs;
}

/**
 * Extract Storage path from URL
 */
function extractStoragePathFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  
  // Handle gs:// URLs
  if (url.startsWith('gs://')) {
    const match = url.match(/gs:\/\/[^\/]+\/(.+)/);
    return match ? match[1] : null;
  }
  
  // Handle https:// URLs (Firebase Storage download URLs)
  if (url.startsWith('https://')) {
    try {
      const urlObj = new URL(url);
      // Firebase Storage URLs have format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?alt=media
      const pathMatch = urlObj.pathname.match(/\/o\/(.+)/);
      if (pathMatch) {
        return decodeURIComponent(pathMatch[1].replace(/%2F/g, '/'));
      }
    } catch (e) {
      // Invalid URL, try to extract path manually
      const match = url.match(/\/o\/([^?]+)/);
      if (match) {
        return decodeURIComponent(match[1].replace(/%2F/g, '/'));
      }
    }
  }
  
  return null;
}

/**
 * Download file from Firebase Storage
 */
async function downloadStorageFile(storagePath, localPath) {
  try {
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      return { success: false, error: 'File not found' };
    }
    
    // Create directory if it doesn't exist
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Download file
    await file.download({ destination: localPath });
    
    // Get file stats
    const stats = fs.statSync(localPath);
    
    return { success: true, size: stats.size };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Export Storage files from documents
 */
async function exportStorageFiles(exportDir, collectionStats, allExportedData) {
  console.log('\n📦 Exporting Firebase Storage files...');
  
  const storageDir = path.join(exportDir, 'storage');
  if (!dryRun && !fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
  
  const storageMapping = {};
  let totalFiles = 0;
  let successFiles = 0;
  let failedFiles = 0;
  
  // Process each collection
  for (const stat of collectionStats) {
    if (stat.error || !stat.data || stat.data.length === 0) continue;
    
    const collectionName = stat.name;
    const documents = stat.data;
    
    for (const doc of documents) {
      const storageRefs = extractStorageReferences(doc, collectionName);
      
      for (const ref of storageRefs) {
        totalFiles++;
        
        // Extract storage path
        let storagePath = ref.path || extractStoragePathFromUrl(ref.url);
        
        if (!storagePath) {
          console.log(`  ⚠️  Could not extract path from URL: ${ref.url}`);
          failedFiles++;
          continue;
        }
        
        // Create local file path
        const fileName = path.basename(storagePath);
        const relativePath = `${collectionName}/${doc.id}/${fileName}`;
        const localPath = path.join(storageDir, relativePath);
        
        // Download file
        if (!dryRun) {
          const result = await downloadStorageFile(storagePath, localPath);
          
          if (result.success) {
            successFiles++;
            storageMapping[ref.url] = {
              oldUrl: ref.url,
              oldPath: storagePath,
              localPath: relativePath,
              type: ref.type,
              size: result.size
            };
          } else {
            failedFiles++;
            console.log(`  ❌ Failed to download ${storagePath}: ${result.error}`);
          }
        } else {
          // Dry run - just track
          storageMapping[ref.url] = {
            oldUrl: ref.url,
            oldPath: storagePath,
            localPath: relativePath,
            type: ref.type
          };
          successFiles++;
        }
      }
    }
  }
  
  // Save storage mapping
  const mappingPath = path.join(exportDir, 'storage-mapping.json');
  if (!dryRun) {
    fs.writeFileSync(mappingPath, JSON.stringify(storageMapping, null, 2));
  }
  
  console.log(`  📊 Storage files: ${successFiles} downloaded, ${failedFiles} failed`);
  
  return { totalFiles, successFiles, failedFiles, storageMapping };
}

/**
 * Export collection
 */
async function exportCollection(collectionName, filters, exportDir, discoveredData) {
  console.log(`\n📋 Exporting collection: ${collectionName}`);
  
  try {
    let query = db.collection(collectionName);
    
    // Apply filters based on collection type
    if (collectionName === 'users') {
      // Filter by discovered user IDs
      if (discoveredData.allUserIds.length > 0) {
        query = query.where(admin.firestore.FieldPath.documentId(), 'in', discoveredData.allUserIds);
      } else {
        console.log(`  ⚠️  No users found, skipping`);
        return { count: 0, data: [] };
      }
    } else if (collectionName === 'companies') {
      // Filter by discovered company IDs
      if (discoveredData.allCompanyIds.length > 0) {
        query = query.where(admin.firestore.FieldPath.documentId(), 'in', discoveredData.allCompanyIds);
      } else {
        console.log(`  ⚠️  No companies found, skipping`);
        return { count: 0, data: [] };
      }
    } else {
      // Filter by companyId for all other collections
      if (discoveredData.allCompanyIds.length > 0) {
        query = query.where('companyId', 'in', discoveredData.allCompanyIds);
      } else {
        console.log(`  ⚠️  No companies found, skipping`);
        return { count: 0, data: [] };
      }
    }
    
    const snapshot = await query.get();
    const data = [];
    
    for (const doc of snapshot.docs) {
      const docData = {
        id: doc.id,
        ...doc.data()
      };
      
      // Convert Firestore Timestamps to JSON format
      const convertTimestamps = (obj) => {
        if (obj === null || obj === undefined) return obj;
        if (obj.constructor && obj.constructor.name === 'Timestamp') {
          return {
            _seconds: obj.seconds,
            _nanoseconds: obj.nanoseconds
          };
        }
        if (Array.isArray(obj)) {
          return obj.map(convertTimestamps);
        }
        if (typeof obj === 'object') {
          const converted = {};
          for (const key in obj) {
            converted[key] = convertTimestamps(obj[key]);
          }
          return converted;
        }
        return obj;
      };
      
      const convertedData = convertTimestamps(docData);
      data.push(convertedData);
      
      // Export sub-collections for companies
      if (collectionName === 'companies') {
        await exportSubCollection('companies', doc.id, 'employeeRefs', exportDir);
        await exportSubCollection('companies', doc.id, 'permissionTemplates', exportDir);
      }
    }
    
    // Save to file
    const filePath = path.join(exportDir, `${collectionName}.json`);
    if (!dryRun) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
    
    console.log(`  ✅ Exported ${data.length} documents`);
    
    return { count: data.length, data };
    
  } catch (error) {
    console.error(`  ❌ Error exporting ${collectionName}:`, error.message);
    return { count: 0, data: [], error: error.message };
  }
}

/**
 * Create export manifest
 */
function createExportManifest(exportDir, emailMapping, collectionStats, storageStats) {
  const manifest = {
    exportDate: new Date().toISOString(),
    sourceProject: admin.app().options.projectId,
    emails: Object.keys(emailMapping),
    emailMapping,
    collections: collectionStats.map(s => s.name),
    documentCounts: {},
    storageFiles: {
      total: storageStats?.totalFiles || 0,
      success: storageStats?.successFiles || 0,
      failed: storageStats?.failedFiles || 0
    },
    dryRun,
    version: '1.0.0'
  };
  
  collectionStats.forEach(stat => {
    manifest.documentCounts[stat.name] = stat.count;
  });
  
  const manifestPath = path.join(exportDir, 'export-manifest.json');
  if (!dryRun) {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }
  
  return manifest;
}

/**
 * Main export function
 */
async function performExport() {
  try {
    // 1. Create export directory
    const exportDir = createExportDirectory();
    console.log(`\n📁 Export directory: ${exportDir}`);
    
    // 2. Discover users and companies
    const discoveredData = await discoverUsersAndCompanies(emails);
    
    if (discoveredData.allUserIds.length === 0) {
      console.error('❌ No users found for the provided emails');
      process.exit(1);
    }
    
    console.log(`\n📊 Discovery Summary:`);
    console.log(`  👤 Users found: ${discoveredData.allUserIds.length}`);
    console.log(`  🏢 Companies found: ${discoveredData.allCompanyIds.length}`);
    
    // 3. Export collections
    const collectionStats = [];
    const allExportedData = {};
    
    for (const collectionName of collections) {
      const result = await exportCollection(collectionName, {}, exportDir, discoveredData);
      collectionStats.push({
        name: collectionName,
        count: result.count,
        data: result.data,
        error: result.error
      });
      allExportedData[collectionName] = result.data || [];
    }
    
    // 4. Export Storage files
    const storageStats = await exportStorageFiles(exportDir, collectionStats, allExportedData);
    
    // 5. Create manifest
    const manifest = createExportManifest(exportDir, discoveredData.emailMapping, collectionStats, storageStats);
    
    // 6. Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 EXPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`📁 Export directory: ${exportDir}`);
    console.log(`📧 Emails processed: ${emails.length}`);
    console.log(`👤 Users found: ${discoveredData.allUserIds.length}`);
    console.log(`🏢 Companies found: ${discoveredData.allCompanyIds.length}`);
    console.log(`\n📋 Collections exported:`);
    collectionStats.forEach(stat => {
      const status = stat.error ? '❌' : '✅';
      console.log(`  ${status} ${stat.name}: ${stat.count} documents${stat.error ? ` (Error: ${stat.error})` : ''}`);
    });
    console.log(`\n📦 Storage files exported:`);
    console.log(`  ✅ ${storageStats.successFiles} files downloaded, ${storageStats.failedFiles} failed`);
    console.log(`\n📄 Manifest: export-manifest.json`);
    
    if (dryRun) {
      console.log('\n⚠️  DRY RUN MODE - No files were written');
    } else {
      console.log('\n✅ Export completed successfully!');
    }
    
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

// Run export
performExport();

