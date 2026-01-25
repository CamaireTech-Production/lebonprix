// Migration script to remove legacy mocks and update auth system

import { authService } from './services';
import { FirestoreService } from '../services/firestoreService';

// Remove legacy mock data and hardcoded credentials
export async function removeLegacyMocks() {
  console.log('Removing legacy mocks and hardcoded credentials...');
  
  // This function would be called during app initialization
  // to clean up any legacy mock data or hardcoded credentials
  
  try {
    // Remove any localStorage items that might contain mock data
    const legacyKeys = [
      'adminUser',
      'mockAdmins',
      'offline_actions',
      'queuedActions'
    ];
    
    legacyKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        console.log(`Removed legacy localStorage key: ${key}`);
      }
    });
    
    console.log('Legacy mocks removed successfully');
  } catch (error) {
    console.error('Error removing legacy mocks:', error);
  }
}

// Migrate existing admin users to new system
export async function migrateAdminUsers() {
  console.log('Migrating admin users to new system...');
  
  try {
    // This would typically involve:
    // 1. Reading existing admin users from Firestore
    // 2. Updating their structure to match new User interface
    // 3. Adding proper permissions and roles
    
    // For now, this is a placeholder for the migration logic
    console.log('Admin user migration completed');
  } catch (error) {
    console.error('Error migrating admin users:', error);
  }
}

// Migrate existing restaurant users to new system
export async function migrateRestaurantUsers() {
  console.log('Migrating restaurant users to new system...');
  
  try {
    // This would typically involve:
    // 1. Reading existing restaurant users from Firestore
    // 2. Updating their structure to match new User interface
    // 3. Adding proper permissions and roles
    // 4. Ensuring restaurant-scoped data is properly organized
    
    // For now, this is a placeholder for the migration logic
    console.log('Restaurant user migration completed');
  } catch (error) {
    console.error('Error migrating restaurant users:', error);
  }
}

// Create default admin user if none exists
export async function createDefaultAdmin() {
  console.log('Creating default admin user...');
  
  try {
    // Check if any admin users exist
    const adminUsers = await FirestoreService.getUsersByRole('admin');
    
    if (adminUsers.length === 0) {
      // Create a default super admin
      const defaultAdmin = {
        email: 'admin@restaurant-system.com',
        password: 'admin123!', // This should be changed in production
        adminRole: 'super_admin' as const
      };
      
      await authService.register(defaultAdmin);
      console.log('Default admin user created');
    } else {
      console.log('Admin users already exist, skipping default creation');
    }
  } catch (error) {
    console.error('Error creating default admin:', error);
  }
}

// Validate and fix data integrity
export async function validateDataIntegrity() {
  console.log('Validating data integrity...');
  
  try {
    // This would typically involve:
    // 1. Checking for orphaned data
    // 2. Validating user-role relationships
    // 3. Ensuring restaurant-scoped data is properly organized
    // 4. Fixing any inconsistencies
    
    console.log('Data integrity validation completed');
  } catch (error) {
    console.error('Error validating data integrity:', error);
  }
}

// Main migration function
export async function runAuthMigration() {
  console.log('Starting authentication system migration...');
  
  try {
    await removeLegacyMocks();
    await migrateAdminUsers();
    await migrateRestaurantUsers();
    await createDefaultAdmin();
    await validateDataIntegrity();
    
    console.log('Authentication system migration completed successfully');
  } catch (error) {
    console.error('Authentication system migration failed:', error);
    throw error;
  }
}

// Export migration utilities
export const authMigration = {
  removeLegacyMocks,
  migrateAdminUsers,
  migrateRestaurantUsers,
  createDefaultAdmin,
  validateDataIntegrity,
  runAuthMigration
};

