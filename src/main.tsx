import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// Import i18n configuration
import './i18n/config';
// Initialize error logger early to catch all errors
import '@/services/errorLogger';

// Service worker is automatically registered by Vite PWA plugin
// No manual registration needed here

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
