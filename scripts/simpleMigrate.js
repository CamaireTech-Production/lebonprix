// scripts/simpleMigrate.js
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting Image Migration to Firebase Storage\n');

try {
  // Load service account
  const serviceAccount = JSON.parse(readFileSync(join(__dirname, '../firebase-service-account.json'), 'utf8'));
  
  // Initialize Firebase
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'le-bon-prix-finances.firebasestorage.app'
  });
  
  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const batchSize = 5; // Small batch size for safety
  
  console.log(`📋 Configuration:`);
  console.log(`  Dry Run: ${dryRun}`);
  console.log(`  Batch Size: ${batchSize}`);
  console.log('');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No actual changes will be made\n');
  }
  
  // Get products with base64 images
  const productsSnapshot = await db.collection('products').get();
  const productsToMigrate = [];
  
  console.log(`📦 Analyzing ${productsSnapshot.size} products...`);
  
  for (const doc of productsSnapshot.docs) {
    const product = doc.data();
    if (product.images && product.images.length > 0) {
      // Check if images are base64 (not already migrated URLs)
      const hasBase64Images = product.images.some((img) => 
        img.startsWith('data:image/') || 
        (!img.startsWith('http') && img.length > 100)
      );
      
      if (hasBase64Images) {
        productsToMigrate.push({
          id: doc.id,
          ...product
        });
      }
    }
  }
  
  console.log(`🖼️  Found ${productsToMigrate.length} products with base64 images to migrate\n`);
  
  if (productsToMigrate.length === 0) {
    console.log('✅ No products need migration!');
    process.exit(0);
  }
  
  let migratedCount = 0;
  let errorCount = 0;
  const startTime = Date.now();
  
  // Process in batches
  for (let i = 0; i < productsToMigrate.length; i += batchSize) {
    const batch = productsToMigrate.slice(i, i + batchSize);
    console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(productsToMigrate.length / batchSize)}`);
    
    for (const product of batch) {
      try {
        console.log(`  🔄 Migrating product: ${product.name} (${product.id})`);
        
        const newImageUrls = [];
        
        // Process each image
        for (let imgIndex = 0; imgIndex < product.images.length; imgIndex++) {
          const base64Image = product.images[imgIndex];
          
          // Skip if already a URL
          if (base64Image.startsWith('http')) {
            newImageUrls.push(base64Image);
            continue;
          }
          
          if (!dryRun) {
            // Convert base64 to buffer
            const base64String = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
            const buffer = Buffer.from(base64String, 'base64');
            
            // Upload to Firebase Storage
            const fileName = `products/${product.userId}/${product.id}/image_${imgIndex}_${Date.now()}.jpg`;
            const file = bucket.file(fileName);
            
            await file.save(buffer, {
              metadata: {
                contentType: 'image/jpeg',
                customMetadata: {
                  userId: product.userId,
                  productId: product.id,
                  imageIndex: imgIndex.toString(),
                  uploadedAt: new Date().toISOString()
                }
              },
            });
            
            // Make file public and get URL
            await file.makePublic();
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
            
            newImageUrls.push(publicUrl);
          } else {
            // In dry run, just simulate the URL
            newImageUrls.push(`https://storage.googleapis.com/${bucket.name}/products/${product.userId}/${product.id}/image_${imgIndex}_${Date.now()}.jpg`);
          }
        }
        
        // Update product document
        if (!dryRun) {
          await db.collection('products').doc(product.id).update({
            images: newImageUrls,
            migratedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
        
        migratedCount++;
        console.log(`    ✅ Migrated ${product.images.length} images`);
        
      } catch (error) {
        errorCount++;
        console.log(`    ❌ Error: ${error.message}`);
      }
    }
    
    // Rate limiting
    if (i + batchSize < productsToMigrate.length) {
      console.log('  ⏳ Waiting 2 seconds before next batch...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);
  
  console.log('\n=== MIGRATION COMPLETED ===');
  console.log(`⏱️  Duration: ${duration} seconds`);
  console.log(`📦 Total Products: ${productsToMigrate.length}`);
  console.log(`✅ Successful: ${migratedCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`📊 Success Rate: ${((migratedCount / productsToMigrate.length) * 100).toFixed(2)}%`);
  
  if (dryRun) {
    console.log('\n🔍 This was a dry run. No actual changes were made.');
    console.log('To run the actual migration, remove --dry-run flag.');
  } else {
    console.log('\n✅ Migration completed successfully!');
  }
  
} catch (error) {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
}
