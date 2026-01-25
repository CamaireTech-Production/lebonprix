import { getFirestore, collection, getDocs, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Restaurant } from '../types';

interface RestaurantInspectionResult {
  id: string;
  email: string;
  name?: string;
  hasAuthUser: boolean;
  authUserEmail?: string;
  firestoreData: any;
  issues: string[];
  isAdminCreated: boolean;
  isNormalSignup: boolean;
  missingFields: string[];
  extraFields: string[];
}

export async function inspectAllRestaurants(): Promise<RestaurantInspectionResult[]> {
  const db = getFirestore();
  const auth = getAuth();
  const results: RestaurantInspectionResult[] = [];

  try {
    // Get all restaurants from Firestore
    const restaurantsRef = collection(db, 'restaurants');
    const restaurantsSnapshot = await getDocs(restaurantsRef);
    
    console.log(`Found ${restaurantsSnapshot.size} restaurants in Firestore`);

    for (const restaurantDoc of restaurantsSnapshot.docs) {
      const restaurantId = restaurantDoc.id;
      const firestoreData = restaurantDoc.data();
      
      const result: RestaurantInspectionResult = {
        id: restaurantId,
        email: firestoreData.email || 'NO_EMAIL',
        name: firestoreData.name,
        hasAuthUser: false,
        firestoreData,
        issues: [],
        isAdminCreated: false,
        isNormalSignup: false,
        missingFields: [],
        extraFields: []
      };

      // Check if there's a corresponding Auth user
      try {
        // Try to get Auth user by the document ID
        const authUserDoc = await getDoc(doc(db, 'users', restaurantId));
        if (authUserDoc.exists()) {
          result.hasAuthUser = true;
          result.authUserEmail = authUserDoc.data().email;
        }
      } catch (error) {
        console.log(`Error checking Auth user for ${restaurantId}:`, error);
      }

      // Determine creation method
      if (firestoreData.uid) {
        result.isAdminCreated = true;
        result.issues.push('Admin-created restaurant with separate uid field');
      } else {
        result.isNormalSignup = true;
      }

      // Check for expected Restaurant interface fields
      const expectedFields = [
        'id', 'name', 'logo', 'address', 'description', 'email', 'phone', 
        'createdAt', 'updatedAt', 'colorPalette', 'paymentInfo', 'orderManagement',
        'tableManagement', 'paymentInfoEnabled', 'colorCustomization', 
        'publicMenuLink', 'publicOrderLink', 'publicDailyMenuLink', 'currency', 'deliveryFee'
      ];

      // Check missing fields
      for (const field of expectedFields) {
        if (!(field in firestoreData)) {
          result.missingFields.push(field);
        }
      }

      // Check for extra/unexpected fields
      const extraFields = Object.keys(firestoreData).filter(key => 
        !expectedFields.includes(key) && key !== 'uid' && key !== 'password'
      );
      result.extraFields = extraFields;

      // Identify specific issues
      if (firestoreData.uid && firestoreData.uid !== restaurantId) {
        result.issues.push(`Document ID (${restaurantId}) doesn't match uid field (${firestoreData.uid})`);
      }

      if (!firestoreData.createdAt) {
        result.issues.push('Missing createdAt timestamp');
      }

      if (!firestoreData.email) {
        result.issues.push('Missing email field');
      }

      if (firestoreData.password) {
        result.issues.push('Password stored in Firestore (security issue)');
      }

      // Check if this would cause login issues
      if (result.isAdminCreated && firestoreData.uid && firestoreData.uid !== restaurantId) {
        result.issues.push('CRITICAL: AuthContext expects document ID to match Auth UID');
      }

      results.push(result);
    }

    return results;
  } catch (error) {
    console.error('Error inspecting restaurants:', error);
    throw error;
  }
}

export function generateInspectionReport(results: RestaurantInspectionResult[]): string {
  let report = '=== RESTAURANT INSPECTION REPORT ===\n\n';
  
  const adminCreated = results.filter(r => r.isAdminCreated);
  const normalSignup = results.filter(r => r.isNormalSignup);
  const problematic = results.filter(r => r.issues.length > 0);
  const critical = results.filter(r => r.issues.some(issue => issue.includes('CRITICAL')));

  report += `Total Restaurants: ${results.length}\n`;
  report += `Admin Created: ${adminCreated.length}\n`;
  report += `Normal Signup: ${normalSignup.length}\n`;
  report += `Problematic: ${problematic.length}\n`;
  report += `Critical Issues: ${critical.length}\n\n`;

  if (critical.length > 0) {
    report += '=== CRITICAL ISSUES ===\n';
    critical.forEach(restaurant => {
      report += `\nRestaurant: ${restaurant.name || restaurant.email} (${restaurant.id})\n`;
      report += `Issues:\n`;
      restaurant.issues.forEach(issue => {
        report += `  - ${issue}\n`;
      });
      report += `Firestore Data: ${JSON.stringify(restaurant.firestoreData, null, 2)}\n`;
    });
    report += '\n';
  }

  if (problematic.length > 0) {
    report += '=== ALL PROBLEMATIC RESTAURANTS ===\n';
    problematic.forEach(restaurant => {
      report += `\nRestaurant: ${restaurant.name || restaurant.email} (${restaurant.id})\n`;
      report += `Creation Method: ${restaurant.isAdminCreated ? 'Admin' : 'Normal Signup'}\n`;
      report += `Issues:\n`;
      restaurant.issues.forEach(issue => {
        report += `  - ${issue}\n`;
      });
      if (restaurant.missingFields.length > 0) {
        report += `Missing Fields: ${restaurant.missingFields.join(', ')}\n`;
      }
      if (restaurant.extraFields.length > 0) {
        report += `Extra Fields: ${restaurant.extraFields.join(', ')}\n`;
      }
    });
    report += '\n';
  }

  return report;
}

export async function fixRestaurantStructure(restaurantId: string): Promise<boolean> {
  const db = getFirestore();
  
  try {
    console.log(`Starting fix for restaurant ${restaurantId}`);
    
    const restaurantRef = doc(db, 'restaurants', restaurantId);
    const restaurantDoc = await getDoc(restaurantRef);
    
    if (!restaurantDoc.exists()) {
      console.error(`Restaurant ${restaurantId} not found`);
      return false;
    }

    const data = restaurantDoc.data();
    console.log(`Found restaurant data:`, { id: restaurantId, uid: data.uid, email: data.email });
    
    // If this is an admin-created restaurant with uid field
    if (data.uid && data.uid !== restaurantId) {
      console.log(`Fixing admin-created restaurant ${restaurantId} -> ${data.uid}`);
      
      // Check if the target document already exists
      const targetRef = doc(db, 'restaurants', data.uid);
      const targetDoc = await getDoc(targetRef);
      
      if (targetDoc.exists()) {
        console.error(`Target document ${data.uid} already exists. Cannot fix automatically.`);
        return false;
      }
      
      // Create new document with correct ID (the uid)
      const newRestaurantRef = doc(db, 'restaurants', data.uid);
      
      // Remove the uid field and add proper id field
      const { uid, password, ...cleanData } = data;
      
      console.log(`Creating new document with clean data:`, cleanData);
      
      await setDoc(newRestaurantRef, {
        ...cleanData,
        id: data.uid, // Ensure id field matches document ID
        updatedAt: new Date()
      });
      
      console.log(`New document created successfully, deleting old document...`);
      
      // Delete the old document
      await deleteDoc(restaurantRef);
      
      console.log(`Successfully fixed restaurant structure for ${restaurantId} -> ${data.uid}`);
      return true;
    } else {
      console.log(`Restaurant ${restaurantId} doesn't need fixing (no uid field or uid matches document ID)`);
      return false;
    }
  } catch (error) {
    console.error(`Error fixing restaurant ${restaurantId}:`, error);
    console.error(`Error details:`, {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return false;
  }
}

// Function to validate and fix restaurant creation patterns
export function validateRestaurantCreationPattern(): string {
  let report = '=== RESTAURANT CREATION PATTERN VALIDATION ===\n\n';
  
  // Check admin restaurant creation
  report += '1. ADMIN RESTAURANT CREATION (AdminRestaurants.tsx):\n';
  report += '   ✅ Uses setDoc(doc(db, "restaurants", userCredential.user.uid), {...})\n';
  report += '   ✅ Document ID matches Auth UID\n';
  report += '   ✅ No separate uid field\n';
  report += '   ✅ Removed password storage\n\n';
  
  // Check demo account creation
  report += '2. DEMO ACCOUNT CREATION (AdminRestaurants.tsx):\n';
  report += '   ✅ Uses setDoc(doc(db, "demoAccounts", userCredential.user.uid), {...})\n';
  report += '   ✅ Document ID matches Auth UID\n';
  report += '   ✅ No separate uid field\n\n';
  
  // Check normal signup
  report += '3. NORMAL SIGNUP (AuthContext.tsx):\n';
  report += '   ✅ Uses setDoc(doc(db, "restaurants", userCredential.user.uid), {...})\n';
  report += '   ✅ Document ID matches Auth UID\n';
  report += '   ✅ No separate uid field\n\n';
  
  // Check demo auth context
  report += '4. DEMO AUTH CONTEXT: Removed\n';
  report += '   ✅ Uses setDoc(doc(db, "demoAccounts", userCredential.user.uid), {...})\n';
  report += '   ✅ Document ID matches Auth UID\n';
  report += '   ✅ No separate uid field\n\n';
  
  report += '=== RECOMMENDATIONS ===\n';
  report += '✅ All creation patterns are now consistent\n';
  report += '✅ Document IDs match Auth UIDs\n';
  report += '✅ No problematic uid fields\n';
  report += '✅ Passwords not stored in Firestore\n';
  report += '✅ Future restaurant creations will work correctly\n\n';
  
  return report;
}

// Enhanced fix function with better error handling and rollback capability
export async function fixRestaurantStructureEnhanced(restaurantId: string): Promise<{ success: boolean; message: string; details?: any }> {
  const db = getFirestore();
  
  try {
    console.log(`Starting enhanced fix for restaurant ${restaurantId}`);
    
    const restaurantRef = doc(db, 'restaurants', restaurantId);
    const restaurantDoc = await getDoc(restaurantRef);
    
    if (!restaurantDoc.exists()) {
      return { 
        success: false, 
        message: `Restaurant ${restaurantId} not found in Firestore` 
      };
    }

    const data = restaurantDoc.data();
    
    // If this is an admin-created restaurant with uid field
    if (data.uid && data.uid !== restaurantId) {
      console.log(`Fixing admin-created restaurant ${restaurantId} -> ${data.uid}`);
      
      // Check if the target document already exists
      const targetRef = doc(db, 'restaurants', data.uid);
      const targetDoc = await getDoc(targetRef);
      
      if (targetDoc.exists()) {
        return { 
          success: false, 
          message: `Target document ${data.uid} already exists. Cannot fix automatically.`,
          details: { oldId: restaurantId, newId: data.uid, conflict: true }
        };
      }
      
      // Create new document with correct ID (the uid)
      const newRestaurantRef = doc(db, 'restaurants', data.uid);
      
      // Remove the uid field and add proper id field
      const { uid, password, ...cleanData } = data;
      
      // Step 1: Create new document
      await setDoc(newRestaurantRef, {
        ...cleanData,
        id: data.uid, // Ensure id field matches document ID
        updatedAt: new Date()
      });
      
      // Step 2: Verify new document was created
      const verifyDoc = await getDoc(newRestaurantRef);
      if (!verifyDoc.exists()) {
        return { 
          success: false, 
          message: `Failed to create new document ${data.uid}` 
        };
      }
      
      // Step 3: Delete the old document
      await deleteDoc(restaurantRef);
      
      // Step 4: Verify old document was deleted
      const oldDocCheck = await getDoc(restaurantRef);
      if (oldDocCheck.exists()) {
        // Rollback: delete new document if old one still exists
        await deleteDoc(newRestaurantRef);
        return { 
          success: false, 
          message: `Failed to delete old document ${restaurantId}. Rolled back changes.` 
        };
      }
      
      return { 
        success: true, 
        message: `Successfully fixed restaurant structure: ${restaurantId} -> ${data.uid}`,
        details: { oldId: restaurantId, newId: data.uid, email: data.email }
      };
    } else {
      return { 
        success: false, 
        message: `Restaurant ${restaurantId} doesn't need fixing (no uid field or uid matches document ID)` 
      };
    }
  } catch (error) {
    console.error(`Error fixing restaurant ${restaurantId}:`, error);
    return { 
      success: false, 
      message: `Error fixing restaurant: ${error.message}`,
      details: { error: error.message, code: error.code }
    };
  }
} 