// src/services/core/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, Firestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported, Analytics } from "firebase/analytics";
import { getMessaging, getToken, onMessage, Messaging, isSupported as isMessagingSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const auth = getAuth(app);
// Active cache persistant multi-onglets pour la résilience offline
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
// Instance Firestore sans cache pour les opérations critiques (ex: inscription)
// Cela évite les problèmes de cache qui peuvent causer des erreurs de permission
const dbNoCache = getFirestore(app);
const storage = getStorage(app);

// Initialize Analytics (only in browser environment)
let analytics: Analytics | null = null;

if (typeof window !== 'undefined') {
  // Check if Analytics is supported before initializing
  isSupported().then((supported) => {
    if (supported) {
      try {
        analytics = getAnalytics(app);
      } catch (error) {
        console.warn('[Firebase] Analytics initialization failed:', error);
      }
    }
  }).catch((error) => {
    console.warn('[Firebase] Analytics support check failed:', error);
  });
}

// Initialize Messaging (only in browser environment)
let messaging: Messaging | null = null;

if (typeof window !== 'undefined') {
  // Check if Messaging is supported before initializing
  isMessagingSupported().then((supported) => {
    if (supported) {
      try {
        messaging = getMessaging(app);
      } catch (error) {
        console.warn('[Firebase] Messaging initialization failed:', error);
      }
    }
  }).catch((error) => {
    console.warn('[Firebase] Messaging support check failed:', error);
  });
}

export { auth, db, dbNoCache, storage, app, analytics, messaging };
export { getFirestore } from "firebase/firestore";
export { getToken, onMessage } from "firebase/messaging";
export type { Firestore, Analytics, Messaging };

