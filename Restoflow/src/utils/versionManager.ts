import { APP_VERSION, compareVersions, isVersionNewer } from '../config/version';

export interface VersionInfo {
  version: string;
  buildNumber: string;
  buildDate: string;
  releaseNotes: string[];
  isBeta: boolean;
  isStable: boolean;
  downloadUrl?: string;
  changelog?: string;
}

export interface VersionUpdate {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  isMajorUpdate: boolean;
  isMinorUpdate: boolean;
  isPatchUpdate: boolean;
  releaseNotes: string[];
  downloadUrl?: string;
}

// Store version in localStorage for comparison
const VERSION_STORAGE_KEY = 'app_version';

export const getStoredVersion = (): string | null => {
  try {
    return localStorage.getItem(VERSION_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to get stored version:', error);
    return null;
  }
};

export const setStoredVersion = (version: string): void => {
  try {
    localStorage.setItem(VERSION_STORAGE_KEY, version);
  } catch (error) {
    console.warn('Failed to set stored version:', error);
  }
};

export const checkForUpdates = (): VersionUpdate => {
  const storedVersion = getStoredVersion();
  const currentVersion = storedVersion || APP_VERSION.version;
  const latestVersion = APP_VERSION.version;
  
  const hasUpdate = isVersionNewer(currentVersion, latestVersion);
  const comparison = compareVersions(currentVersion, latestVersion);
  
  // Determine update type
  const currentParts = currentVersion.split('.').map(Number);
  const latestParts = latestVersion.split('.').map(Number);
  
  const isMajorUpdate = hasUpdate && currentParts[0] < latestParts[0];
  const isMinorUpdate = hasUpdate && currentParts[0] === latestParts[0] && currentParts[1] < latestParts[1];
  const isPatchUpdate = hasUpdate && currentParts[0] === latestParts[0] && currentParts[1] === latestParts[1] && currentParts[2] < latestParts[2];
  
  return {
    currentVersion,
    latestVersion,
    hasUpdate,
    isMajorUpdate,
    isMinorUpdate,
    isPatchUpdate,
    releaseNotes: APP_VERSION.releaseNotes || [],
  };
};

export const updateStoredVersion = (): void => {
  setStoredVersion(APP_VERSION.version);
};

export const getUpdateNotificationMessage = (update: VersionUpdate): string => {
  if (!update.hasUpdate) return '';
  
  if (update.isMajorUpdate) {
    return `New major version available: v${update.latestVersion}`;
  } else if (update.isMinorUpdate) {
    return `New version available: v${update.latestVersion}`;
  } else {
    return `Update available: v${update.latestVersion}`;
  }
};

export const getUpdatePriority = (update: VersionUpdate): 'high' | 'medium' | 'low' => {
  if (update.isMajorUpdate) return 'high';
  if (update.isMinorUpdate) return 'medium';
  return 'low';
};

// Version history tracking
export const logVersionAccess = (): void => {
  try {
    const versionHistory = JSON.parse(localStorage.getItem('version_history') || '[]');
    const accessLog = {
      version: APP_VERSION.version,
      buildNumber: APP_VERSION.buildNumber,
      accessedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
    };
    
    // Keep only last 10 entries
    versionHistory.push(accessLog);
    if (versionHistory.length > 10) {
      versionHistory.shift();
    }
    
    localStorage.setItem('version_history', JSON.stringify(versionHistory));
  } catch (error) {
    console.warn('Failed to log version access:', error);
  }
};

export const getVersionHistory = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem('version_history') || '[]');
  } catch (error) {
    console.warn('Failed to get version history:', error);
    return [];
  }
};

// Initialize version tracking
export const initializeVersionTracking = (): void => {
  const storedVersion = getStoredVersion();
  
  if (!storedVersion) {
    // First time access
    setStoredVersion(APP_VERSION.version);
  } else if (storedVersion !== APP_VERSION.version) {
    // Version has changed
    setStoredVersion(APP_VERSION.version);
  }
  
  logVersionAccess();
};

// Export current version info
export const getCurrentVersionInfo = (): VersionInfo => {
  return {
    version: APP_VERSION.version,
    buildNumber: APP_VERSION.buildNumber,
    buildDate: APP_VERSION.buildDate,
    releaseNotes: APP_VERSION.releaseNotes || [],
    isBeta: APP_VERSION.isBeta || false,
    isStable: APP_VERSION.isStable || false,
  };
}; 