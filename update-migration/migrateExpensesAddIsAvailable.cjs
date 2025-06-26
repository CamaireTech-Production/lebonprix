const admin = require('firebase-admin');
const serviceAccount = require('./le-bon-prix-finances-firebase-adminsdk-fbsvc-f715c394df.json'); // Update path if needed

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migrateExpensesAddIsAvailable() {
  const expensesRef = db.collection('expenses');
  const snapshot = await expensesRef.get();

  let updatedCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    // Only update if isAvailable is missing
    if (typeof data.isAvailable === 'undefined') {
      await doc.ref.update({ isAvailable: true });
      updatedCount++;
      console.log(`Updated expense ${doc.id}`);
    }
  }

  console.log(`Migration complete. Updated ${updatedCount} expenses to add isAvailable: true.`);
}

migrateExpensesAddIsAvailable().catch(console.error);
