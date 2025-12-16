/**
 * Stock consistency checker / fixer.
 * 
 * Usage:
 *   node scripts/checkStocks.js --companyId=COMPANY_ID [--fix=true]
 *   GOOGLE_APPLICATION_CREDENTIALS must point to a service account JSON
 *   (or set FIREBASE_SERVICE_ACCOUNT with the JSON string).
 *
 * What it does:
 * - Reads products (optionally scoped by companyId).
 * - Sums stockBatches (all statuses) for each product.
 * - Reports discrepancies between product.stock and summed remainingQuantity.
 * - With --fix=true, writes product.stock = summedRemainingQuantity.
 *
 * Notes:
 * - Uses firebase-admin; ensure the service account has read/write on products
 *   and stockBatches collections.
 * - No batch documents are modified; only product.stock when --fix is set.
 */

import fs from 'fs';
import admin from 'firebase-admin';

// Simple argv parser
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    return [key, value === undefined ? true : value];
  })
);

const companyIdFilter = args.companyId || null;
const doFix = String(args.fix).toLowerCase() === 'true';

// Resolve service account credentials
function getServiceAccount() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }
  throw new Error('Missing service account. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT.');
}

function initAdmin() {
  if (!admin.apps.length) {
    const credential = admin.credential.cert(getServiceAccount());
    admin.initializeApp({ credential });
  }
  return admin.firestore();
}

async function main() {
  const db = initAdmin();

  const productsRef = db.collection('products');
  const productsQuery = companyIdFilter
    ? productsRef.where('companyId', '==', companyIdFilter)
    : productsRef;

  const productsSnap = await productsQuery.get();
  console.log(`Products scanned: ${productsSnap.size}`);

  const discrepancies = [];
  const batch = db.batch();

  for (const productDoc of productsSnap.docs) {
    const product = productDoc.data();
    const productId = productDoc.id;

    const batchesSnap = await db
      .collection('stockBatches')
      .where('productId', '==', productId)
      .get();

    const batches = batchesSnap.docs.map((d) => d.data());
    const remainingSum = batches.reduce((sum, b) => sum + (b.remainingQuantity || 0), 0);
    const totalSum = batches.reduce((sum, b) => sum + (b.quantity || 0), 0);
    const recorded = product.stock ?? 0;

    if (remainingSum !== recorded) {
      discrepancies.push({
        productId,
        name: product.name,
        companyId: product.companyId,
        recordedStock: recorded,
        batchRemaining: remainingSum,
        batchTotal: totalSum
      });

      if (doFix) {
        batch.update(productDoc.ref, { stock: remainingSum });
      }
    }
  }

  if (discrepancies.length === 0) {
    console.log('No discrepancies found. ✅');
  } else {
    console.table(
      discrepancies.map((d) => ({
        productId: d.productId,
        name: d.name,
        companyId: d.companyId,
        recordedStock: d.recordedStock,
        batchRemaining: d.batchRemaining,
        batchTotal: d.batchTotal
      }))
    );
  }

  if (doFix && discrepancies.length > 0) {
    await batch.commit();
    console.log(`Updated ${discrepancies.length} product(s) to match batch remaining quantities.`);
  }
}

main().catch((err) => {
  console.error('Stock check failed:', err);
  process.exit(1);
});
