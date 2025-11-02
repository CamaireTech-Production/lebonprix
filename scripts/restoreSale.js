/**
 * Restore Soft-Deleted Sale Script
 * 
 * This script restores a soft-deleted sale by setting isAvailable to true
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Sale to restore
const SALE_DOC_ID = process.argv[2] || 'HgMEjWmEoAUbpd7Tc7IP';

console.log('🔄 RESTORE SOFT-DELETED SALE\n');
console.log('=' .repeat(70));
console.log(`Sale Document ID: ${SALE_DOC_ID}`);
console.log('=' .repeat(70) + '\n');

try {
  const serviceAccount = JSON.parse(readFileSync(join(__dirname, '../firebase-service-account.json'), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  console.log('📊 Loading sale...\n');

  const saleRef = db.collection('sales').doc(SALE_DOC_ID);
  const saleDoc = await saleRef.get();

  if (!saleDoc.exists) {
    console.error('❌ Sale not found!\n');
    process.exit(1);
  }

  const sale = saleDoc.data();

  console.log('📋 Current Sale Data:');
  console.log(`   Customer: ${sale.customerInfo?.name || sale.customerName || 'Unknown'}`);
  console.log(`   Phone: ${sale.customerInfo?.phone || sale.phone || 'N/A'}`);
  console.log(`   Amount: ${sale.totalAmount || sale.total || 0} XAF`);
  console.log(`   isAvailable: ${sale.isAvailable}`);
  console.log(`   Company ID: ${sale.companyId || 'N/A'}`);
  console.log(`   User ID: ${sale.userId || 'N/A'}\n`);

  if (sale.isAvailable !== false) {
    console.log('✅ Sale is already available (not deleted)\n');
    process.exit(0);
  }

  console.log('🔧 Restoring sale...\n');

  await saleRef.update({
    isAvailable: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log('✅ Sale restored successfully!\n');
  console.log('=' .repeat(70));
  console.log('Sale is now visible in the system');
  console.log('=' .repeat(70) + '\n');

  process.exit(0);
} catch (e) {
  console.error('\n❌ ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
}

