// IMPORTANT: Initialize console logger FIRST, before anything else
// This ensures we capture ALL logs, even if React fails to load
import './services/consoleLogger.ts';

// CRITICAL: Intercept ALL fetch calls to force HTTP for IP addresses
// This must be done BEFORE any other imports that might use fetch
const originalFetch = window.fetch;
(window as any).fetch = function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // Convert input to string URL
  let url: string;
  let correctedInput: RequestInfo | URL = input;
  
  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else if (input instanceof Request) {
    url = input.url;
  } else {
    url = String(input);
  }
  
  // CRITICAL: Force HTTP for IP addresses (HTTPS doesn't work with IPs)
  const ipPattern = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/;
  if (ipPattern.test(url) && url.startsWith('https://')) {
    const httpUrl = url.replace('https://', 'http://');
    console.error('🚨 [GLOBAL FETCH INTERCEPTOR] Forced HTTPS to HTTP:', url, '→', httpUrl);
    
    // Reconstruct the input with HTTP URL
    if (typeof input === 'string') {
      correctedInput = httpUrl;
    } else if (input instanceof URL) {
      correctedInput = new URL(httpUrl);
    } else if (input instanceof Request) {
      correctedInput = new Request(httpUrl, input);
    }
  }
  
  // Call original fetch with corrected URL
  return originalFetch.call(window, correctedInput, init);
};

console.log('🔒 [GLOBAL] Fetch interceptor installed - will force HTTP for IP addresses');

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
