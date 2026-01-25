import { describe, it, expect } from 'vitest';
import {
  normalizePhoneNumber,
  formatPhoneForWhatsApp,
  validateCameroonPhone,
  getPhoneDisplayValue,
  normalizePhoneForComparison
} from '../../../utils/phoneUtils';

/**
 * PROBLEMS IDENTIFIED BEFORE TESTS:
 * 
 * None - This is a new utility file created to centralize phone normalization.
 * 
 * REFACTORING PERFORMED:
 * - Created centralized phone normalization utility
 * - Extracted phone formatting logic from multiple files
 */

describe('phoneUtils', () => {
  describe('normalizePhoneNumber', () => {
    describe('Cameroon phone numbers', () => {
      it('should normalize phone number with +237 prefix', () => {
        expect(normalizePhoneNumber('+237678904568')).toBe('+237678904568');
      });

      it('should normalize phone number with 237 prefix (no +)', () => {
        expect(normalizePhoneNumber('237678904568')).toBe('+237678904568');
      });

      it('should normalize phone number starting with 0', () => {
        expect(normalizePhoneNumber('0678904568')).toBe('+237678904568');
      });

      it('should normalize 9-digit phone number (assume Cameroon)', () => {
        expect(normalizePhoneNumber('678904568')).toBe('+237678904568');
      });

      it('should remove leading zeros before adding country code', () => {
        expect(normalizePhoneNumber('00678904568')).toBe('+237678904568');
      });

      it('should handle phone number with spaces', () => {
        expect(normalizePhoneNumber('678 90 45 68')).toBe('+237678904568');
      });

      it('should handle phone number with dashes', () => {
        expect(normalizePhoneNumber('678-90-45-68')).toBe('+237678904568');
      });

      it('should handle phone number with parentheses', () => {
        expect(normalizePhoneNumber('(678) 904-568')).toBe('+237678904568');
      });
    });

    describe('Edge cases', () => {
      it('should return empty string for null input', () => {
        expect(normalizePhoneNumber(null as any)).toBe('');
      });

      it('should return empty string for undefined input', () => {
        expect(normalizePhoneNumber(undefined as any)).toBe('');
      });

      it('should return empty string for empty string', () => {
        expect(normalizePhoneNumber('')).toBe('');
      });

      it('should return empty string for whitespace only', () => {
        expect(normalizePhoneNumber('   ')).toBe('');
      });

      it('should handle phone number with extra digits (take last 9)', () => {
        expect(normalizePhoneNumber('12345678904568')).toBe('+237678904568');
      });

      it('should handle incomplete phone numbers', () => {
        expect(normalizePhoneNumber('678')).toBe('+237678');
      });
    });

    describe('International numbers', () => {
      it('should preserve US phone number format', () => {
        // US numbers are 11 digits with country code 1
        const usNumber = '15551234567';
        const normalized = normalizePhoneNumber(usNumber, '+1');
        // Should add +1 if not present
        expect(normalized).toContain('1');
      });
    });
  });

  describe('formatPhoneForWhatsApp', () => {
    it('should format normalized phone for WhatsApp (digits only)', () => {
      expect(formatPhoneForWhatsApp('+237678904568')).toBe('237678904568');
    });

    it('should handle phone number with +237 prefix', () => {
      expect(formatPhoneForWhatsApp('+237678904568')).toBe('237678904568');
    });

    it('should handle phone number without prefix', () => {
      expect(formatPhoneForWhatsApp('678904568')).toBe('237678904568');
    });

    it('should handle phone number starting with 0', () => {
      expect(formatPhoneForWhatsApp('0678904568')).toBe('237678904568');
    });

    it('should return empty string for null input', () => {
      expect(formatPhoneForWhatsApp(null as any)).toBe('');
    });

    it('should return empty string for undefined input', () => {
      expect(formatPhoneForWhatsApp(undefined as any)).toBe('');
    });
  });

  describe('validateCameroonPhone', () => {
    it('should validate correct Cameroon phone number', () => {
      expect(validateCameroonPhone('+237678904568')).toBe(true);
    });

    it('should validate phone number starting with 6', () => {
      expect(validateCameroonPhone('+237678904568')).toBe(true);
    });

    it('should validate phone number starting with 7', () => {
      expect(validateCameroonPhone('+237778904568')).toBe(true);
    });

    it('should validate phone number starting with 8', () => {
      expect(validateCameroonPhone('+237878904568')).toBe(true);
    });

    it('should validate phone number starting with 9', () => {
      expect(validateCameroonPhone('+237978904568')).toBe(true);
    });

    it('should reject phone number not starting with +237', () => {
      expect(validateCameroonPhone('678904568')).toBe(false);
    });

    it('should reject phone number with wrong length', () => {
      expect(validateCameroonPhone('+23767890456')).toBe(false); // 8 digits
      expect(validateCameroonPhone('+2376789045689')).toBe(false); // 10 digits
    });

    it('should reject phone number starting with invalid prefix', () => {
      expect(validateCameroonPhone('+237578904568')).toBe(false); // starts with 5
    });

    it('should return false for null input', () => {
      expect(validateCameroonPhone(null as any)).toBe(false);
    });

    it('should return false for undefined input', () => {
      expect(validateCameroonPhone(undefined as any)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(validateCameroonPhone('')).toBe(false);
    });
  });

  describe('getPhoneDisplayValue', () => {
    it('should format phone number for display', () => {
      expect(getPhoneDisplayValue('+237678904568')).toBe('+237 67 89 04 56 8');
    });

    it('should handle phone number without prefix', () => {
      const normalized = normalizePhoneNumber('678904568');
      expect(getPhoneDisplayValue(normalized)).toContain('+237');
    });

    it('should return empty string for null input', () => {
      expect(getPhoneDisplayValue(null as any)).toBe('');
    });

    it('should return empty string for undefined input', () => {
      expect(getPhoneDisplayValue(undefined as any)).toBe('');
    });
  });

  describe('normalizePhoneForComparison', () => {
    it('should return digits only for comparison', () => {
      expect(normalizePhoneForComparison('+237678904568')).toBe('237678904568');
    });

    it('should handle phone number with spaces', () => {
      expect(normalizePhoneForComparison('+237 678 90 45 68')).toBe('237678904568');
    });

    it('should handle phone number with dashes', () => {
      expect(normalizePhoneForComparison('+237-678-90-45-68')).toBe('237678904568');
    });

    it('should return empty string for null input', () => {
      expect(normalizePhoneForComparison(null as any)).toBe('');
    });

    it('should return empty string for undefined input', () => {
      expect(normalizePhoneForComparison(undefined as any)).toBe('');
    });
  });
});

