// Main services barrel export

// Core services (Firebase config, storage)
export * from './core';

// Auth services (Firebase Auth)
export * from './auth';

// Payment services (CinetPay)
export * from './payment';

// Firestore services (all collections)
export * from './firestore';

// Utilities services
export * from './utilities/barcodeService';
export * from './utilities/checkoutSettingsService';
export * from './utilities/emailService';
export * from './utilities/localStorageService';
export * from './utilities/locationService';
export * from './utilities/migrationLogger';
export * from './utilities/navigationService';
// Note: getUserCompanies from userService is excluded to avoid conflict with companyVerificationService
export { getUserById, updateUser, createUser } from './utilities/userService';
export * from './utilities/backgroundSync';

// Storage services (localStorage managers)
export * from './storage';

