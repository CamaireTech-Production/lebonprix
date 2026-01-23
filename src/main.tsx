// IMPORTANT: Initialize console logger FIRST, before anything else
// This ensures we capture ALL logs, even if React fails to load
import './services/consoleLogger.ts';

// Note: Using domain with SSL (geskap-api.camairetech.com)
// No need for HTTP enforcement - domain supports HTTPS properly
console.log('🌐 [GLOBAL] Backend will use domain with SSL support');

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// Import i18n configuration
import './i18n/config.ts';
// Initialize error logger early to catch all errors
import '@/services/errorLogger';

// Service worker is automatically registered by Vite PWA plugin
// No manual registration needed here

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
