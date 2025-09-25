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
  navigator.serviceWorker.register('/firebase-messaging-sw.js')
    .then((registration) => {
      console.log('Firebase service worker registered in development:', registration);
    })
    .catch((error) => {
      console.log('Service worker registration failed in development:', error);
    });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
