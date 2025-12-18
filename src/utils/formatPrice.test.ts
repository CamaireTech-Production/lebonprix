import { describe, it, expect } from 'vitest';
import { formatPrice } from './formatPrice';

/**
 * PROBLEMS IDENTIFIED BEFORE TESTS:
 * 
 * None - This is a new utility function with no existing design problems.
 * 
 * REFACTORING PERFORMED:
 * - N/A (new function)
 */

describe('formatPrice', () => {
  describe('Main behavior', () => {
    it('should format normal numbers with spaces every 3 digits', () => {
      expect(formatPrice(1000)).toBe('1 000');
      expect(formatPrice(10000)).toBe('10 000');
      expect(formatPrice(100000)).toBe('100 000');
      expect(formatPrice(1000000)).toBe('1 000 000');
      expect(formatPrice(1234567)).toBe('1 234 567');
    });

    it('should format numbers less than 1000 without spaces', () => {
      expect(formatPrice(0)).toBe('0');
      expect(formatPrice(1)).toBe('1');
      expect(formatPrice(99)).toBe('99');
      expect(formatPrice(999)).toBe('999');
    });

    it('should round decimal numbers', () => {
      expect(formatPrice(1234.4)).toBe('1 234');
      expect(formatPrice(1234.5)).toBe('1 235');
      expect(formatPrice(1234.9)).toBe('1 235');
      expect(formatPrice(1000.7)).toBe('1 001');
    });
  });

  describe('Edge cases', () => {
    it('should handle null values', () => {
      expect(formatPrice(null)).toBe('0');
    });

    it('should handle undefined values', () => {
      expect(formatPrice(undefined)).toBe('0');
    });

    it('should handle NaN values', () => {
      expect(formatPrice(NaN)).toBe('0');
    });

    it('should handle zero', () => {
      expect(formatPrice(0)).toBe('0');
    });

    it('should handle negative numbers', () => {
      expect(formatPrice(-1000)).toBe('-1 000');
      expect(formatPrice(-1000000)).toBe('-1 000 000');
      expect(formatPrice(-1234.5)).toBe('-1 235');
    });

    it('should handle very large numbers', () => {
      expect(formatPrice(999999999)).toBe('999 999 999');
      expect(formatPrice(1000000000)).toBe('1 000 000 000');
      expect(formatPrice(1234567890)).toBe('1 234 567 890');
    });

    it('should handle very small numbers', () => {
      expect(formatPrice(0.1)).toBe('0');
      expect(formatPrice(0.5)).toBe('1');
      expect(formatPrice(0.9)).toBe('1');
    });
  });

  describe('French formatting', () => {
    it('should use French locale formatting (spaces as thousand separators)', () => {
      const result = formatPrice(1234567);
      // Should contain spaces, not commas or dots
      expect(result).toContain(' ');
      expect(result).not.toContain(',');
      expect(result).toBe('1 234 567');
    });

    it('should format according to French number format', () => {
      expect(formatPrice(1000000)).toBe('1 000 000');
      expect(formatPrice(500000)).toBe('500 000');
      expect(formatPrice(50000)).toBe('50 000');
    });
  });
});


