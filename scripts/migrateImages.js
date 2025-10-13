// scripts/migrateImages.js
import admin from 'firebase-admin';
import { ImageMigrationService } from '../src/services/migrationService.js';

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

async function runMigration() {
  console.log('🚀 Starting Image Migration to Firebase Storage\n');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const config = {
    batchSize: parseInt(process.env.BATCH_SIZE) || 10,
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT) || 5,
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS) || 3,
    dryRun: process.env.DRY_RUN === 'true' || args.includes('--dry-run'),
    userId: process.env.USER_ID || (args.includes('--user') ? args[args.indexOf('--user') + 1] : undefined)
  };
  
  console.log('📋 Migration Configuration:');
  console.log(`  Batch Size: ${config.batchSize}`);
  console.log(`  Max Concurrent: ${config.maxConcurrent}`);
  console.log(`  Retry Attempts: ${config.retryAttempts}`);
  console.log(`  Dry Run: ${config.dryRun}`);
  console.log(`  User ID: ${config.userId || 'All users'}`);
  console.log('');
  
  if (config.dryRun) {
    console.log('🔍 DRY RUN MODE - No actual changes will be made\n');
  }
  
  const migrationService = new ImageMigrationService(config);
  
  try {
    console.log('⏳ Starting migration process...\n');
    const startTime = Date.now();
    
    const results = await migrationService.migrateAllProducts();
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    // Generate report
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalImages = results.reduce((sum, r) => sum + r.imagesUploaded, 0);
    
    console.log('\n=== MIGRATION COMPLETED ===');
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`📦 Total Products: ${results.length}`);
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`🖼️  Images Migrated: ${totalImages}`);
    console.log(`📊 Success Rate: ${((successful / results.length) * 100).toFixed(2)}%`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Products:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.productId}: ${r.errors.join(', ')}`);
      });
    }
    
    // Show processing times
    const avgProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;
    console.log(`\n⏱️  Average Processing Time: ${Math.round(avgProcessingTime)}ms per product`);
    
    // Generate detailed report
    const logger = migrationService.getLogger();
    const report = logger.generateReport();
    console.log('\n' + report);
    
    if (config.dryRun) {
      console.log('\n🔍 This was a dry run. No actual changes were made.');
      console.log('To run the actual migration, remove --dry-run flag.');
    } else {
      console.log('\n✅ Migration completed successfully!');
      console.log('📝 Check the logs above for any warnings or errors.');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Image Migration Script

Usage: node scripts/migrateImages.js [options]

Options:
  --dry-run              Run migration without making changes
  --user <userId>        Migrate only specific user's products
  --batch-size <number>  Number of products to process in each batch (default: 10)
  --max-concurrent <num> Maximum concurrent uploads (default: 5)
  --retry-attempts <num> Number of retry attempts (default: 3)
  --help, -h             Show this help message

Environment Variables:
  DRY_RUN=true           Enable dry run mode
  USER_ID=<userId>       Migrate only specific user
  BATCH_SIZE=<number>    Batch size
  MAX_CONCURRENT=<num>   Max concurrent uploads
  RETRY_ATTEMPTS=<num>   Retry attempts
  FIREBASE_STORAGE_BUCKET=<bucket> Firebase Storage bucket

Examples:
  node scripts/migrateImages.js --dry-run
  node scripts/migrateImages.js --user user123
  node scripts/migrateImages.js --batch-size 5 --max-concurrent 3
`);
  process.exit(0);
}

// Run migration
runMigration().catch(console.error);
