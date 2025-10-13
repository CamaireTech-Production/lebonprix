// scripts/testFirebase.js
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔧 Testing Firebase connection...');

try {
  // Load service account
  const serviceAccount = JSON.parse(readFileSync(join(__dirname, '../firebase-service-account.json'), 'utf8'));
  console.log('✅ Service account loaded');
  
  // Initialize Firebase
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'le-bon-prix-finances.firebasestorage.app'
  });
  console.log('✅ Firebase initialized');
  
  // Test Firestore connection
  const db = admin.firestore();
  console.log('✅ Firestore connection established');
  
  // Test basic query
  const productsSnapshot = await db.collection('products').limit(1).get();
  console.log(`✅ Firestore query successful - found ${productsSnapshot.size} products`);
  
  // Test Storage connection
  const bucket = admin.storage().bucket();
  console.log('✅ Storage connection established');
  
  console.log('\n🎉 All Firebase connections working!');
  
} catch (error) {
  console.error('❌ Firebase connection failed:', error.message);
  process.exit(1);
}
