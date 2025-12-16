/**
 * Migration script to normalize existing phone numbers in Firestore
 * 
 * This script normalizes all phone numbers in the database to ensure
 * they have the proper +237 country code prefix.
 * 
 * Usage:
 *   npx ts-node scripts/migratePhoneNumbers.ts
 * 
 * WARNING: This script modifies data in Firestore. Make sure to:
 * 1. Backup your database before running
 * 2. Test on a development environment first
 * 3. Review the changes before running in production
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';
import { normalizePhoneNumber } from '../src/utils/phoneUtils';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Firebase configuration (use your existing config)
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

interface MigrationStats {
  total: number;
  updated: number;
  skipped: number;
  errors: number;
}

/**
 * Migrate phone numbers in a collection
 */
async function migrateCollection(
  collectionName: string,
  phoneField: string,
  stats: MigrationStats
): Promise<void> {
  console.log(`\n📦 Migrating ${collectionName} collection...`);
  
  try {
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);
    
    console.log(`   Found ${snapshot.size} documents`);
    
    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      const currentPhone = data[phoneField];
      
      if (!currentPhone || typeof currentPhone !== 'string') {
        stats.skipped++;
        continue;
      }
      
      // Normalize the phone number
      const normalizedPhone = normalizePhoneNumber(currentPhone);
      
      // Only update if the phone number changed
      if (normalizedPhone !== currentPhone && normalizedPhone) {
        try {
          await updateDoc(doc(db, collectionName, docSnapshot.id), {
            [phoneField]: normalizedPhone
          });
          stats.updated++;
          console.log(`   ✅ Updated ${docSnapshot.id}: ${currentPhone} → ${normalizedPhone}`);
        } catch (error) {
          stats.errors++;
          console.error(`   ❌ Error updating ${docSnapshot.id}:`, error);
        }
      } else {
        stats.skipped++;
      }
      
      stats.total++;
    }
  } catch (error) {
    console.error(`   ❌ Error migrating ${collectionName}:`, error);
    stats.errors++;
  }
}

/**
 * Main migration function
 */
async function migratePhoneNumbers(): Promise<void> {
  console.log('🚀 Starting phone number migration...\n');
  console.log('⚠️  WARNING: This will modify data in Firestore!');
  console.log('   Make sure you have a backup before proceeding.\n');
  
  const stats: MigrationStats = {
    total: 0,
    updated: 0,
    skipped: 0,
    errors: 0
  };
  
  // Migrate customers collection
  await migrateCollection('customers', 'phone', stats);
  
  // Migrate users collection
  await migrateCollection('users', 'phone', stats);
  
  // Migrate companies collection
  await migrateCollection('companies', 'phone', stats);
  
  // Migrate orders collection (customerInfo.phone)
  console.log('\n📦 Migrating orders collection (customerInfo.phone)...');
  try {
    const ordersRef = collection(db, 'orders');
    const ordersSnapshot = await getDocs(ordersRef);
    
    console.log(`   Found ${ordersSnapshot.size} orders`);
    
    for (const orderDoc of ordersSnapshot.docs) {
      const orderData = orderDoc.data();
      const customerInfo = orderData.customerInfo;
      
      if (customerInfo && customerInfo.phone && typeof customerInfo.phone === 'string') {
        const normalizedPhone = normalizePhoneNumber(customerInfo.phone);
        
        if (normalizedPhone !== customerInfo.phone && normalizedPhone) {
          try {
            await updateDoc(doc(db, 'orders', orderDoc.id), {
              'customerInfo.phone': normalizedPhone
            });
            stats.updated++;
            console.log(`   ✅ Updated order ${orderDoc.id}: ${customerInfo.phone} → ${normalizedPhone}`);
          } catch (error) {
            stats.errors++;
            console.error(`   ❌ Error updating order ${orderDoc.id}:`, error);
          }
        } else {
          stats.skipped++;
        }
      } else {
        stats.skipped++;
      }
      
      stats.total++;
    }
  } catch (error) {
    console.error('   ❌ Error migrating orders:', error);
    stats.errors++;
  }
  
  // Print summary
  console.log('\n📊 Migration Summary:');
  console.log(`   Total documents processed: ${stats.total}`);
  console.log(`   Updated: ${stats.updated}`);
  console.log(`   Skipped (already normalized or empty): ${stats.skipped}`);
  console.log(`   Errors: ${stats.errors}`);
  
  if (stats.errors > 0) {
    console.log('\n⚠️  Some errors occurred during migration. Please review the logs above.');
  } else {
    console.log('\n✅ Migration completed successfully!');
  }
}

// Run migration
if (require.main === module) {
  migratePhoneNumbers()
    .then(() => {
      console.log('\n✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

export { migratePhoneNumbers };

