// Date utility functions for consistent date handling across the application
import type { Timestamp } from 'firebase/firestore';

/**
 * Normalize a date value to a Date object
 * Handles Timestamp, Date, string, or number
 */
export function normalizeDate(date: Timestamp | Date | string | number | undefined | null): Date | null {
  if (!date) return null;
  
  if (date instanceof Date) {
    return date;
  }
  
  if (typeof date === 'string') {
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  
  if (typeof date === 'number') {
    return new Date(date);
  }
  
  // Handle Firestore Timestamp
  if (typeof date === 'object' && 'seconds' in date) {
    return new Date((date as Timestamp).seconds * 1000);
  }
  
  return null;
}

/**
 * Convert a date to Firestore Timestamp format
 */
export function toFirestoreDate(date: Date | string | Timestamp | undefined | null): Timestamp | null {
  if (!date) return null;
  
  const normalized = normalizeDate(date);
  if (!normalized) return null;
  
  return {
    seconds: Math.floor(normalized.getTime() / 1000),
    nanoseconds: 0
  } as Timestamp;
}

/**
 * Format date for input[type="date"]
 */
export function formatDateForInput(date: Timestamp | Date | string | undefined | null): string {
  const normalized = normalizeDate(date);
  if (!normalized) return new Date().toISOString().split('T')[0];
  
  return normalized.toISOString().split('T')[0];
}

/**
 * Check if a date is in the past (before today)
 */
export function isDateInPast(date: Date | string | Timestamp | undefined | null): boolean {
  const normalized = normalizeDate(date);
  if (!normalized) return false;
  
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return normalized > today;
}
