import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeDefaultEmployeePassword,
  hashCompanyPassword,
  buildDefaultHashedPassword,
  caesarCipher,
  buildLoginLink,
  generateEmployeeId
} from '../../utils/security';

describe('security utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('makeDefaultEmployeePassword', () => {
    it('should generate password with firstname and lastname', () => {
      const result = makeDefaultEmployeePassword('John', 'Doe');
      expect(result).toBe('John123Doe');
    });

    it('should handle names with spaces', () => {
      const result = makeDefaultEmployeePassword('John Paul', 'Doe Smith');
      expect(result).toBe('JohnPaul123DoeSmith');
    });

    it('should handle empty names', () => {
      const result = makeDefaultEmployeePassword('', '');
      expect(result).toBe('123');
    });

    it('should handle special characters', () => {
      const result = makeDefaultEmployeePassword('Jean-Pierre', 'O\'Connor');
      expect(result).toBe('Jean-Pierre123O\'Connor');
    });
  });

  describe('hashCompanyPassword', () => {
    it('should hash password using Web Crypto API when available', async () => {
      // Mock Web Crypto API
      const mockDigest = vi.fn().mockResolvedValue(new ArrayBuffer(32));
      const mockSubtle = {
        digest: mockDigest
      };
      
      Object.defineProperty(window, 'crypto', {
        value: { subtle: mockSubtle },
        writable: true
      });

      const result = await hashCompanyPassword('testpassword');
      
      expect(mockDigest).toHaveBeenCalledWith('SHA-256', expect.any(Uint8Array));
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should use fallback hash when Web Crypto API is not available', async () => {
      // Mock environment without Web Crypto API
      Object.defineProperty(window, 'crypto', {
        value: undefined,
        writable: true
      });

      const result = await hashCompanyPassword('testpassword');
      
      expect(result).toMatch(/^fallback_/);
      expect(typeof result).toBe('string');
    });

    it('should produce consistent results for same input', async () => {
      const password = 'testpassword123';
      
      const result1 = await hashCompanyPassword(password);
      const result2 = await hashCompanyPassword(password);
      
      expect(result1).toBe(result2);
    });
  });

  describe('buildDefaultHashedPassword', () => {
    it('should build hashed password from firstname and lastname', async () => {
      const result = await buildDefaultHashedPassword('John', 'Doe');
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('caesarCipher', () => {
    it('should encrypt lowercase letters correctly', () => {
      const result = caesarCipher('hello', 3);
      expect(result).toBe('khoor');
    });

    it('should encrypt uppercase letters correctly', () => {
      const result = caesarCipher('HELLO', 3);
      expect(result).toBe('KHOOR');
    });

    it('should handle mixed case', () => {
      const result = caesarCipher('Hello World', 3);
      expect(result).toBe('Khoor Zruog');
    });

    it('should leave non-alphabetic characters unchanged', () => {
      const result = caesarCipher('hello123!@#', 3);
      expect(result).toBe('khoor123!@#');
    });

    it('should handle negative shift', () => {
      const result = caesarCipher('khoor', -3);
      expect(result).toBe('hello');
    });

    it('should handle large shifts', () => {
      const result = caesarCipher('hello', 26);
      expect(result).toBe('hello'); // 26 is equivalent to 0
    });

    it('should handle empty string', () => {
      const result = caesarCipher('', 3);
      expect(result).toBe('');
    });
  });

  describe('buildLoginLink', () => {
    it('should build login link with default shift', () => {
      const result = buildLoginLink('john', 'doe');
      expect(result).toBe('mrykqrg'); // 'johndoe' shifted by 3
    });

    it('should build login link with custom shift', () => {
      const result = buildLoginLink('john', 'doe', 5);
      expect(result).toBe('otmsitj'); // 'johndoe' shifted by 5
    });

    it('should handle names with different cases', () => {
      const result = buildLoginLink('John', 'Doe');
      expect(result).toBe('Mrykqrg'); // 'JohnDoe' shifted by 3
    });

    it('should handle names with spaces', () => {
      const result = buildLoginLink('John Paul', 'Doe Smith');
      expect(result).toBe('Mrykqrg'); // 'John PaulDoe Smith' shifted by 3
    });
  });

  describe('generateEmployeeId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateEmployeeId();
      const id2 = generateEmployeeId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^emp_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^emp_\d+_[a-z0-9]+$/);
    });

    it('should have consistent format', () => {
      const id = generateEmployeeId();
      const parts = id.split('_');
      
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('emp');
      expect(parts[1]).toMatch(/^\d+$/); // timestamp
      expect(parts[2]).toMatch(/^[a-z0-9]+$/); // random string
    });

    it('should generate different IDs on subsequent calls', () => {
      const ids = new Set();
      
      for (let i = 0; i < 100; i++) {
        ids.add(generateEmployeeId());
      }
      
      expect(ids.size).toBe(100);
    });
  });
});
