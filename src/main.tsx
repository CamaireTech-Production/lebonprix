import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// Import i18n configuration
import './i18n/config';

// Register service worker - Vite PWA will handle this automatically in production
// In development, we'll register manually
if ('serviceWorker' in navigator && import.meta.env.DEV) {
  // Only register manually in development
  // Try to register firebase-messaging-sw.js first (it exists and works)
  navigator.serviceWorker.register('/firebase-messaging-sw.js')
    .then((registration) => {
      console.log('Firebase service worker registered in development:', registration);
    })
    .catch((error) => {
      console.log('Firebase service worker registration failed in development:', error);
      // If firebase-messaging-sw.js doesn't work, try to register the service worker that Vite PWA generates
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Vite PWA service worker registered in development:', registration);
        })
        .catch((viteError) => {
          console.log('Vite PWA service worker registration also failed:', viteError);
        });
    });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
