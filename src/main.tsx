// IMPORTANT: Initialize console logger FIRST, before anything else
// This ensures we capture ALL logs, even if React fails to load
import './services/consoleLogger.ts';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// Import i18n configuration
import './i18n/config.ts';
// Initialize error logger early to catch all errors
import '@/services/errorLogger';
// Initialize Analytics after other services
import { initializeAnalytics } from '@services/analytics/analyticsInit';

// Service worker is automatically registered by Vite PWA plugin
// No manual registration needed here

// Initialize Analytics after other services
if (typeof window !== 'undefined') {
  initializeAnalytics().catch((error) => {
    console.warn('[Analytics] Failed to initialize:', error);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
