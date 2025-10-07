// scripts/verifyMigration.js
import admin from 'firebase-admin';

// Initialize Firebase Admin
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serviceAccount = JSON.parse(readFileSync(join(__dirname, '../firebase-service-account.json'), 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'le-bon-prix-finances.firebasestorage.app'
});

const db = admin.firestore();

async function verifyMigration() {
  console.log('🔍 Verifying image migration...\n');
  
  try {
    const productsSnapshot = await db.collection('products').get();
    
    let totalProducts = 0;
    let migratedProducts = 0;
    let productsWithBase64 = 0;
    let productsWithUrls = 0;
    let totalImages = 0;
    let accessibleImages = 0;
    let inaccessibleImages = 0;
    let errors = [];
    
    console.log('📊 Analyzing products...\n');
    
    for (const doc of productsSnapshot.docs) {
      const product = doc.data();
      if (product.images && product.images.length > 0) {
        totalProducts++;
        totalImages += product.images.length;
        
        // Check if product has been migrated
        if (product.migratedAt) {
          migratedProducts++;
        }
        
        // Check image types
        const hasBase64Images = product.images.some((img) => 
          img.startsWith('data:image/') || 
          (!img.startsWith('http') && img.length > 100)
        );
        
        const hasUrlImages = product.images.some((img) => 
          img.startsWith('http')
        );
        
        if (hasBase64Images) {
          productsWithBase64++;
        }
        
        if (hasUrlImages) {
          productsWithUrls++;
        }
        
        // Test image accessibility
        for (const imageUrl of product.images) {
          if (imageUrl.startsWith('http')) {
            try {
              const response = await fetch(imageUrl, { method: 'HEAD' });
              if (response.ok) {
                accessibleImages++;
              } else {
                inaccessibleImages++;
                errors.push(`Product ${doc.id}: Image ${imageUrl} returned ${response.status}`);
              }
            } catch (error) {
              inaccessibleImages++;
              errors.push(`Product ${doc.id}: Image ${imageUrl} - ${error.message}`);
            }
          }
        }
      }
    }
    
    console.log('=== MIGRATION VERIFICATION RESULTS ===');
    console.log(`📦 Total products with images: ${totalProducts}`);
    console.log(`✅ Migrated products: ${migratedProducts}`);
    console.log(`🖼️  Total images: ${totalImages}`);
    console.log(`🌐 Accessible images: ${accessibleImages}`);
    console.log(`❌ Inaccessible images: ${inaccessibleImages}`);
    
    console.log('\n📊 Image Type Analysis:');
    console.log(`  Products with base64 images: ${productsWithBase64}`);
    console.log(`  Products with URL images: ${productsWithUrls}`);
    
    if (productsWithBase64 > 0) {
      console.log(`\n⚠️  ${productsWithBase64} products still have base64 images`);
    }
    
    if (inaccessibleImages > 0) {
      console.log(`\n❌ ${inaccessibleImages} images are not accessible:`);
      errors.slice(0, 10).forEach(error => {
        console.log(`  - ${error}`);
      });
      
      if (errors.length > 10) {
        console.log(`  ... and ${errors.length - 10} more errors`);
      }
    }
    
    // Calculate success metrics
    const migrationRate = totalProducts > 0 ? (migratedProducts / totalProducts * 100).toFixed(2) : 0;
    const accessibilityRate = totalImages > 0 ? (accessibleImages / totalImages * 100).toFixed(2) : 0;
    
    console.log('\n📈 Success Metrics:');
    console.log(`  Migration Rate: ${migrationRate}%`);
    console.log(`  Image Accessibility: ${accessibilityRate}%`);
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    
    if (productsWithBase64 > 0) {
      console.log('  - Some products still have base64 images. Consider re-running migration.');
    }
    
    if (inaccessibleImages > 0) {
      console.log('  - Some images are not accessible. Check Firebase Storage permissions.');
    }
    
    if (migrationRate < 100) {
      console.log('  - Migration is incomplete. Check logs for failed products.');
    }
    
    if (migrationRate === 100 && accessibilityRate === 100) {
      console.log('  ✅ Migration completed successfully! All images are accessible.');
    }
    
    // Storage usage check
    console.log('\n💾 Storage Usage Check:');
    try {
      const bucket = admin.storage().bucket();
      const [files] = await bucket.getFiles({ prefix: 'products/' });
      
      let totalStorageSize = 0;
      files.forEach(file => {
        totalStorageSize += file.metadata.size || 0;
      });
      
      console.log(`  Total files in storage: ${files.length}`);
      console.log(`  Total storage size: ${(totalStorageSize / 1024 / 1024).toFixed(2)} MB`);
      
    } catch (error) {
      console.log(`  ⚠️  Could not check storage usage: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

// Run verification
verifyMigration().catch(console.error);
