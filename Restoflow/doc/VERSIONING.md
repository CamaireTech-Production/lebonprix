# Versioning System Documentation

## Overview

This document describes the versioning system implemented in the Restaurant Management App. The system provides comprehensive version tracking, update notifications, and version history management.

## Version Naming Convention

The app follows **Semantic Versioning (SemVer)** with the format: `MAJOR.MINOR.PATCH`

### Version Components

- **MAJOR**: Breaking changes, major features, or significant architectural changes
- **MINOR**: New features that are backward compatible
- **PATCH**: Bug fixes and minor improvements

### Examples

- `0.1.0` - Initial release
- `0.1.1` - Bug fix release
- `0.2.0` - New features added
- `1.0.0` - First stable release
- `1.1.0` - New features in stable release
- `2.0.0` - Breaking changes

## Version Configuration

### Location: `src/config/version.ts`

```typescript
export const APP_VERSION: AppVersion = {
  version: '0.2.0',           // Current version
  buildNumber: '2024.1.1',    // Build identifier
  buildDate: '2024-01-15',    // Build date
  isStable: true,             // Release stability
  releaseNotes: [             // What's new in this version
    'Enhanced network error handling',
    'Improved offline functionality',
    'Better mobile responsiveness',
    'Added comprehensive admin features',
    'Enhanced payment integration'
  ]
};
```

## Version Display

### 1. Header Display
- Shows version in the top-left corner of the dashboard
- Displays as small text below the app title
- Format: `v0.2.0 (Stable)`

### 2. Sidebar Display
- Shows version in the sidebar footer
- Visible in both expanded and collapsed states
- Format: `v0.2.0 (Stable)`

### 3. Version Badge
- Color-coded badges for different release types:
  - **Green**: Stable releases
  - **Yellow**: Beta releases
  - **Gray**: Development releases

## Update Notifications

### Automatic Update Detection
- Compares current version with stored version
- Shows notification when updates are available
- Different priority levels for different update types

### Update Types
- **Major Updates**: High priority (red notification)
- **Minor Updates**: Medium priority (yellow notification)
- **Patch Updates**: Low priority (blue notification)

### Notification Features
- Dismissible notifications
- Release notes preview
- One-click update option
- Persistent dismissal tracking

## Version History Tracking

### Local Storage
- Stores version access history
- Tracks user agent information
- Maintains last 10 version accesses
- Enables version comparison

### Admin Version Info Page
- Comprehensive version information
- Version history table
- Update status indicators
- Release notes display

## Components

### 1. VersionDisplay Component
**Location**: `src/components/ui/VersionDisplay.tsx`

Features:
- Multiple display variants (badge, text, detailed)
- Release notes modal
- Configurable styling
- Click-to-view release notes

Usage:
```tsx
<VersionDisplay variant="badge" showReleaseNotes={true} />
```

### 2. VersionUpdateNotification Component
**Location**: `src/components/ui/VersionUpdateNotification.tsx`

Features:
- Automatic update detection
- Priority-based styling
- Dismissible notifications
- Update action buttons

### 3. VersionInfo Page
**Location**: `src/pages/admin/VersionInfo.tsx`

Features:
- Current version details
- Version history table
- Update status information
- Refresh functionality

## Utilities

### Version Management
**Location**: `src/utils/versionManager.ts`

Key Functions:
- `checkForUpdates()`: Detects available updates
- `getCurrentVersionInfo()`: Returns current version details
- `getVersionHistory()`: Retrieves version access history
- `initializeVersionTracking()`: Sets up version tracking

### Version Comparison
**Location**: `src/config/version.ts`

Key Functions:
- `compareVersions()`: Compares two version strings
- `isVersionNewer()`: Checks if one version is newer
- `formatVersionDisplay()`: Formats version for display
- `getVersionBadgeColor()`: Returns appropriate badge colors

## How to Update Versions

### 1. Update Version Configuration
Edit `src/config/version.ts`:

```typescript
export const APP_VERSION: AppVersion = {
  version: '0.2.1',           // Increment version
  buildNumber: '2024.1.2',    // Update build number
  buildDate: '2024-01-20',    // Update build date
  isStable: true,
  releaseNotes: [
    'Fixed critical bug in order processing',
    'Improved performance on mobile devices',
    'Added new payment method support'
  ]
};
```

### 2. Update Package.json
```json
{
  "version": "0.2.1"
}
```

### 3. Commit Changes
```bash
git add .
git commit -m "Bump version to 0.2.1"
git tag v0.2.1
git push origin main --tags
```

## Version Tracking Workflow

### 1. App Initialization
- Version tracking initializes on app start
- Stores current version in localStorage
- Logs version access

### 2. Update Detection
- Compares stored version with current version
- Shows notification if update detected
- Tracks update dismissal

### 3. Version History
- Logs each version access
- Stores user agent information
- Maintains access timestamps

## Best Practices

### 1. Version Naming
- Use semantic versioning consistently
- Increment appropriately for changes
- Document breaking changes clearly

### 2. Release Notes
- Keep release notes concise and clear
- Focus on user-facing changes
- Include both features and fixes

### 3. Update Frequency
- Release patches for critical bug fixes
- Release minor versions for new features
- Release major versions for breaking changes

### 4. Testing
- Test version display in all components
- Verify update notifications work correctly
- Check version history tracking

## Troubleshooting

### Common Issues

1. **Version not updating**
   - Check localStorage for cached version
   - Clear browser cache
   - Verify version configuration

2. **Update notifications not showing**
   - Check version comparison logic
   - Verify notification dismissal tracking
   - Ensure proper initialization

3. **Version history not recording**
   - Check localStorage permissions
   - Verify error handling in version tracking
   - Check browser console for errors

### Debug Commands

```javascript
// Check current version
console.log(APP_VERSION);

// Check stored version
console.log(localStorage.getItem('app_version'));

// Check version history
console.log(JSON.parse(localStorage.getItem('version_history') || '[]'));

// Force version update
localStorage.setItem('app_version', '0.1.0');
```

## Future Enhancements

### Planned Features
- Remote version checking via API
- Automatic update downloads
- Version rollback functionality
- Release channel management (stable, beta, alpha)
- Version compatibility checking

### Integration Possibilities
- CI/CD pipeline integration
- Automated version bumping
- Release note generation from commits
- Version analytics and reporting 