import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

/**
 * Interface for the beforeinstallprompt event
 * This event is fired when the browser determines the app is installable
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAContextType {
  deferredPrompt: BeforeInstallPromptEvent | null;
  setDeferredPrompt: (prompt: BeforeInstallPromptEvent | null) => void;
  clearDeferredPrompt: () => void;
  isIOS: boolean;
  isStandalone: boolean;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

interface PWAProviderProps {
  children: ReactNode;
}

/**
 * PWA Context Provider
 * 
 * Manages global PWA state, particularly the deferredPrompt event
 * which must be stored globally to persist across navigation.
 * 
 * The beforeinstallprompt event is only fired once per browser session,
 * so we need to store it globally to ensure it's available when the user
 * clicks the install button, even if they've navigated to different pages.
 */
export const PWAProvider: React.FC<PWAProviderProps> = ({ children }) => {
  const [deferredPrompt, setDeferredPromptState] = useState<BeforeInstallPromptEvent | null>(null);
  
  // Detect iOS Safari (doesn't support beforeinstallprompt)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  
  // Detect if app is already installed
  const isStandalone = 
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;

  useEffect(() => {
    // Listen for the beforeinstallprompt event
    // This event is fired when the browser determines the app is installable
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      // Store the event globally so it persists across navigation
      setDeferredPromptState(e as BeforeInstallPromptEvent);
      console.log('[PWA] beforeinstallprompt event captured and stored globally');
    };

    // Listen for the appinstalled event
    // This is fired after the user accepts the install prompt
    const handleAppInstalled = () => {
      console.log('[PWA] App installed successfully');
      // Clear the deferred prompt since installation is complete
      setDeferredPromptState(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const setDeferredPrompt = (prompt: BeforeInstallPromptEvent | null) => {
    setDeferredPromptState(prompt);
  };

  const clearDeferredPrompt = () => {
    setDeferredPromptState(null);
  };

  const value: PWAContextType = {
    deferredPrompt,
    setDeferredPrompt,
    clearDeferredPrompt,
    isIOS,
    isStandalone,
  };

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>;
};

/**
 * Hook to access PWA context
 * 
 * @throws Error if used outside PWAProvider
 */
export const usePWAContext = (): PWAContextType => {
  const context = useContext(PWAContext);
  if (context === undefined) {
    throw new Error('usePWAContext must be used within a PWAProvider');
  }
  return context;
};

