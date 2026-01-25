export interface AppVersion {
  version: string;
  buildNumber: string;
  buildDate: string;
  releaseNotes?: string[];
  isBeta?: boolean;
  isStable?: boolean;
}

// Version naming convention: MAJOR.MINOR.PATCH
// - MAJOR: Breaking changes, major features
// - MINOR: New features, backward compatible
// - PATCH: Bug fixes, minor improvements
export const APP_VERSION: AppVersion = {
  version: '0.2.0',
  buildNumber: '2024.1.1',
  buildDate: '2024-01-15',
  isStable: true,
  releaseNotes: [
    'Enhanced network error handling',
    'Improved offline functionality',
    'Better mobile responsiveness',
    'Added comprehensive admin features',
    'Enhanced payment integration'
  ]
};

// Version comparison utilities
export const compareVersions = (version1: string, version2: string): number => {
  const v1Parts = version1.split('.').map(Number);
  const v2Parts = version2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1 = v1Parts[i] || 0;
    const v2 = v2Parts[i] || 0;
    
    if (v1 > v2) return 1;
    if (v1 < v2) return -1;
  }
  
  return 0;
};

export const isVersionNewer = (currentVersion: string, newVersion: string): boolean => {
  return compareVersions(newVersion, currentVersion) > 0;
};

export const formatVersionDisplay = (version: AppVersion): string => {
  let display = `v${version.version}`;
  
  if (version.isBeta) {
    display += ' (Beta)';
  } else if (version.isStable) {
    display += ' (Stable)';
  }
  
  return display;
};

export const getVersionBadgeColor = (version: AppVersion): string => {
  if (version.isBeta) return 'bg-yellow-100 text-yellow-800';
  if (version.isStable) return 'bg-green-100 text-green-800';
  return 'bg-gray-100 text-gray-800';
}; 