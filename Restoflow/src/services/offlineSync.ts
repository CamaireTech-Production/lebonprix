import { getFirestore, collection, getDocs, addDoc, updateDoc, doc, serverTimestamp, query, limit, startAfter, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

// 1. Fetch and cache all Firestore collections to localStorage (with offline_* keys)
export async function fetchAndCacheAll(restaurantId?: string, collections?: string[]) {
  const db = getFirestore();
  const allCollections = [
    { key: 'offline_menuCategories', ref: collection(db, 'categories') },
    { key: 'offline_menuItems', ref: collection(db, 'menuItems') },
    { key: 'offline_tables', ref: collection(db, 'tables') },
    { key: 'offline_orders', ref: collection(db, 'orders') },
  ];

  // Filter collections if specific ones are requested
  const collectionsToLoad = collections 
    ? allCollections.filter(c => collections.includes(c.key))
    : allCollections;

  for (const { key, ref } of collectionsToLoad) {
    let q = ref;
    if (restaurantId) {
      q = collection(db, ref.path);
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    localStorage.setItem(key, JSON.stringify(items));
  }
}

// New function to load specific collection with pagination
export async function loadCollectionWithPagination(
  collectionName: string,
  pageSize: number = 20,
  lastDoc?: QueryDocumentSnapshot<DocumentData>
) {
  const db = getFirestore();
  const ref = collection(db, collectionName);
  let q = query(ref, limit(pageSize));
  
  if (lastDoc) {
    q = query(ref, limit(pageSize), startAfter(lastDoc));
  }

  const snap = await getDocs(q);
  const items = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
  
  return {
    items,
    lastDoc: snap.docs[snap.docs.length - 1],
    hasMore: snap.docs.length === pageSize
  };
}

// New function to get cached data with pagination
export function getCachedData(collectionKey: string, pageSize: number = 20, page: number = 1) {
  const cachedData = JSON.parse(localStorage.getItem(collectionKey) || '[]');
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  
  return {
    items: cachedData.slice(start, end),
    total: cachedData.length,
    hasMore: end < cachedData.length
  };
}

// 2. Replay queued actions from localStorage (merge pendingOrders and pendingActions)
export async function replayQueuedActions(restaurantId: string) {
  const db = getFirestore();
  // Get both queues
  const pendingOrders: any[] = JSON.parse(localStorage.getItem('pendingOrders') || '[]');
  const pendingActions: any[] = JSON.parse(localStorage.getItem('pendingActions') || '[]');
  // Merge and sort by timestamp
  const all = [...pendingOrders.map(o => ({ ...o, _queue: 'pendingOrders' })), ...pendingActions.map(a => ({ ...a, _queue: 'pendingActions' }))];
  all.sort((a, b) => a.timestamp - b.timestamp);
  const syncLogs: any[] = [];
  for (const entry of all) {
    let status: 'success' | 'error' = 'success';
    let error: string | undefined = undefined;
    try {
      if (entry._queue === 'pendingOrders') {
        // Always create order
        await addDoc(collection(db, 'orders'), { ...entry.payload, createdAt: entry.timestamp });
      } else {
        // Admin actions: type can be create/update/delete for menu/category/table/order
        switch (entry.type) {
          case 'createMenuItem': // Dish
            await addDoc(collection(db, 'menuItems'), { ...entry.payload, createdAt: entry.timestamp });
            break;
          case 'updateMenuItem': // Dish
            await updateDoc(doc(db, 'menuItems', entry.payload.id), { ...entry.payload.data, updatedAt: entry.timestamp });
            break;
          case 'deleteMenuItem': // Dish
            await updateDoc(doc(db, 'menuItems', entry.payload.id), { deleted: true, updatedAt: entry.timestamp });
            break;
          case 'createCategory':
            await addDoc(collection(db, 'categories'), { ...entry.payload, createdAt: entry.timestamp });
            break;
          case 'updateCategory':
            await updateDoc(doc(db, 'categories', entry.payload.id), { ...entry.payload.data, updatedAt: entry.timestamp });
            break;
          case 'deleteCategory':
            await updateDoc(doc(db, 'categories', entry.payload.id), { deleted: true, updatedAt: entry.timestamp });
            break;
          case 'createTable':
            await addDoc(collection(db, 'tables'), { ...entry.payload, createdAt: entry.timestamp });
            break;
          case 'updateTable':
            await updateDoc(doc(db, 'tables', entry.payload.id), { ...entry.payload.data, updatedAt: entry.timestamp });
            break;
          case 'deleteTable':
            await updateDoc(doc(db, 'tables', entry.payload.id), { deleted: true, updatedAt: entry.timestamp });
            break;
          case 'updateOrderStatus':
            await updateDoc(doc(db, 'orders', entry.payload.id), { status: entry.payload.status, updatedAt: entry.timestamp });
            break;
          default:
            throw new Error('Unknown action type: ' + entry.type);
        }
      }
    } catch (err: any) {
      status = 'error';
      error = err?.message || String(err);
    }
    syncLogs.push({ 
      entry, 
      status, 
      timestamp: Date.now(), 
      error: error || null,  // Ensure error is never undefined
      syncedAt: serverTimestamp()
    });
  }
  // Write sync logs to Firestore
  if (syncLogs.length) {
    const batchId = `batch_${Date.now()}`;
    const logsRef = collection(db, 'syncLogs', batchId, 'logs');
    for (const log of syncLogs) {
      await addDoc(logsRef, log);  // Remove the spread operator since we already included syncedAt
    }
  }
  // Clear queues on success
  if (syncLogs.every(l => l.status === 'success')) {
    localStorage.setItem('pendingOrders', '[]');
    localStorage.setItem('pendingActions', '[]');
  }
}


