// scripts/analyzeImages.js
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

async function analyzeCurrentImages() {
  console.log('🔍 Analyzing current image storage...\n');
  
  try {
    const productsSnapshot = await db.collection('products').get();
    
    let totalProducts = 0;
    let totalImages = 0;
    let totalSize = 0;
    let usersWithImages = new Set();
    let sizeByUser = new Map();
    let productsByUser = new Map();
    
    for (const doc of productsSnapshot.docs) {
      const product = doc.data();
      if (product.images && product.images.length > 0) {
        // Check if images are base64 (not already migrated URLs)
        const hasBase64Images = product.images.some((img) => 
          img.startsWith('data:image/') || 
          (!img.startsWith('http') && img.length > 100)
        );
        
        if (hasBase64Images) {
          totalProducts++;
          totalImages += product.images.length;
          usersWithImages.add(product.userId);
          
          // Calculate size for this user
          const userSize = sizeByUser.get(product.userId) || 0;
          const userProducts = productsByUser.get(product.userId) || 0;
          let productSize = 0;
          
          product.images.forEach(img => {
            // Approximate byte size of base64 data
            const size = (img.length * 3) / 4;
            productSize += size;
          });
          
          sizeByUser.set(product.userId, userSize + productSize);
          productsByUser.set(product.userId, userProducts + 1);
          totalSize += productSize;
        }
      }
    }
    
    console.log('=== IMAGE MIGRATION ANALYSIS ===');
    console.log(`📦 Total products with base64 images: ${totalProducts}`);
    console.log(`🖼️  Total images to migrate: ${totalImages}`);
    console.log(`💾 Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`👥 Unique users: ${usersWithImages.size}`);
    
    console.log('\n📊 Size by user:');
    const sortedUsers = Array.from(sizeByUser.entries())
      .sort((a, b) => b[1] - a[1]);
    
    sortedUsers.forEach(([userId, size]) => {
      const products = productsByUser.get(userId) || 0;
      console.log(`  ${userId}: ${(size / 1024 / 1024).toFixed(2)} MB (${products} products)`);
    });
    
    console.log('\n=== MIGRATION ESTIMATES ===');
    const estimatedStorageCost = (totalSize / 1024 / 1024) * 0.026; // $0.026 per GB per month
    const estimatedTime = Math.ceil(totalProducts / 10); // Assuming 10 products per minute
    
    console.log(`💰 Estimated Firebase Storage cost: $${estimatedStorageCost.toFixed(4)}/month`);
    console.log(`⏱️  Estimated migration time: ${estimatedTime} minutes`);
    console.log(`📈 Average images per product: ${(totalImages / totalProducts).toFixed(1)}`);
    console.log(`📏 Average image size: ${(totalSize / totalImages / 1024).toFixed(1)} KB`);
    
    console.log('\n=== RECOMMENDATIONS ===');
    if (totalSize > 100 * 1024 * 1024) { // 100MB
      console.log('⚠️  Large dataset detected. Consider running migration in batches.');
    }
    
    if (usersWithImages.size > 10) {
      console.log('👥 Multiple users detected. Consider migrating by user to manage quotas.');
    }
    
    console.log('✅ Ready for migration!');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

// Run analysis
analyzeCurrentImages().catch(console.error);
