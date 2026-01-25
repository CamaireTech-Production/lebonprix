import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = (import.meta as { env?: { VITE_ENCRYPTION_KEY?: string } }).env?.VITE_ENCRYPTION_KEY || 'default-key-change-in-production';

export class EncryptionService {
  static encrypt(text: string): string {
    try {
      const encrypted = CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
      return encrypted;
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  static decrypt(encryptedText: string): string {
    try {
      // Check if already plain text (migration support)
      if (!encryptedText.includes('U2FsdGVkX1')) {
        return encryptedText;
      }
      
      const decrypted = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
      const result = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!result) {
        throw new Error('Decryption failed');
      }
      
      return result;
    } catch (error) {
      console.error('Decryption failed:', error);
      return encryptedText; // Fallback for migration
    }
  }

  static isEncrypted(text: string): boolean {
    return text.includes('U2FsdGVkX1');
  }
}
