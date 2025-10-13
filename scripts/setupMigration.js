// scripts/setupMigration.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function setupMigration() {
  console.log('🔧 Setting up image migration environment...\n');
  
  // Check if .env file exists
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env file not found. Please create one with your Firebase configuration.');
    console.log('Required environment variables:');
    console.log('  FIREBASE_PROJECT_ID=your-project-id');
    console.log('  FIREBASE_STORAGE_BUCKET=your-project.appspot.com');
    console.log('  FIREBASE_SERVICE_ACCOUNT_PATH=./path/to/serviceAccountKey.json');
    return;
  }
  
  // Check if service account key exists
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';
  if (!fs.existsSync(serviceAccountPath)) {
    console.log('❌ Firebase service account key not found.');
    console.log(`Expected path: ${serviceAccountPath}`);
    console.log('Please download your service account key from Firebase Console and place it in the correct location.');
    return;
  }
  
  // Check if Firebase Storage is configured
  const envContent = fs.readFileSync(envPath, 'utf8');
  if (!envContent.includes('FIREBASE_STORAGE_BUCKET')) {
    console.log('⚠️  FIREBASE_STORAGE_BUCKET not found in .env file.');
    console.log('Please add: FIREBASE_STORAGE_BUCKET=your-project.appspot.com');
  }
  
  console.log('✅ Environment setup complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Run analysis: node scripts/analyzeImages.js');
  console.log('2. Test migration: node scripts/migrateImages.js --dry-run');
  console.log('3. Run migration: node scripts/migrateImages.js');
  console.log('4. Verify migration: node scripts/verifyMigration.js');
}

setupMigration();
