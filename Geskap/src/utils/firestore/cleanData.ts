/**
 * Firestore Data Cleaning Utilities
 * 
 * Removes undefined values from objects before writing to Firestore,
 * as Firestore doesn't support undefined values.
 */

/**
 * Recursively removes undefined fields from an object or array
 * 
 * @param obj - The object or array to clean
 * @returns Cleaned object/array with undefined fields removed
 */
export function removeUndefinedFields<T>(obj: T): T {
  // Handle null or undefined
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedFields(item)) as unknown as T;
  }

  // Handle objects
  if (typeof obj === 'object' && obj.constructor === Object) {
    const cleaned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = (obj as any)[key];
        // Only include non-undefined values
        if (value !== undefined) {
          cleaned[key] = removeUndefinedFields(value);
        }
      }
    }
    return cleaned as T;
  }

  // Return primitive values as-is
  return obj;
}

/**
 * Clean data before writing to Firestore
 * This is a convenience wrapper around removeUndefinedFields
 */
export function cleanForFirestore<T>(data: T): T {
  return removeUndefinedFields(data);
}

