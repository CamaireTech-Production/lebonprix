export interface DeviceInfo {
  isIOS: boolean;
  isAndroid: boolean;
  isMobile: boolean;
  isStandalone: boolean;
  isInstalled: boolean;
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
}

export const getDeviceInfo = (): DeviceInfo => {
  const userAgent = navigator.userAgent;
  
  // Check for iOS devices
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  // Check for Android devices
  const isAndroid = /Android/.test(userAgent);
  
  // Check if it's a mobile device
  const isMobile = isIOS || isAndroid || /Mobile|Tablet/.test(userAgent);
  
  // Check if app is running in standalone mode (PWA)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;
  
  // Check if app is already installed
  const isInstalled = isStandalone;
  
  // Determine platform
  let platform: 'ios' | 'android' | 'desktop' | 'unknown' = 'unknown';
  if (isIOS) {
    platform = 'ios';
  } else if (isAndroid) {
    platform = 'android';
  } else if (!isMobile) {
    platform = 'desktop';
  }
  
  return {
    isIOS,
    isAndroid,
    isMobile,
    isStandalone,
    isInstalled,
    platform
  };
};

export const getDownloadLinks = () => {
  const deviceInfo = getDeviceInfo();
  
  // These would be your actual app store links
  const links = {
    ios: 'https://apps.apple.com/app/le-bon-prix/id123456789', // Replace with actual App Store link
    android: 'https://play.google.com/store/apps/details?id=com.lebonprix.app', // Replace with actual Play Store link
    pwa: window.location.origin // Current PWA URL
  };
  
  return {
    ...links,
    current: deviceInfo.isIOS ? links.ios : deviceInfo.isAndroid ? links.android : links.pwa
  };
};
