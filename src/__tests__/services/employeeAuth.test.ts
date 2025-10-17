import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEmployeeUser } from '../../services/employeeAuth';

// Mock Firebase Auth
const mockCreateUserWithEmailAndPassword = vi.fn();
const mockUpdateProfile = vi.fn();

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: mockCreateUserWithEmailAndPassword,
  updateProfile: mockUpdateProfile,
}));

vi.mock('../../services/firebase', () => ({
  auth: {}
}));

describe('employeeAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createEmployeeUser', () => {
    it('should create a user successfully', async () => {
      const mockUser = {
        uid: 'test-uid-123',
        updateProfile: mockUpdateProfile
      };

      mockCreateUserWithEmailAndPassword.mockResolvedValue({
        user: mockUser
      });
      mockUpdateProfile.mockResolvedValue(undefined);

      const result = await createEmployeeUser({
        email: 'test@example.com',
        password: 'testpassword123',
        displayName: 'John Doe'
      });

      expect(result).toBe('test-uid-123');
      expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
        {},
        'test@example.com',
        'testpassword123'
      );
      expect(mockUpdateProfile).toHaveBeenCalledWith(mockUser, {
        displayName: 'John Doe'
      });
    });

    it('should handle creation errors', async () => {
      const error = new Error('Email already exists');
      mockCreateUserWithEmailAndPassword.mockRejectedValue(error);

      await expect(createEmployeeUser({
        email: 'existing@example.com',
        password: 'testpassword123',
        displayName: 'John Doe'
      })).rejects.toThrow('Impossible de créer l\'utilisateur: Email already exists');
    });

    it('should handle profile update errors', async () => {
      const mockUser = {
        uid: 'test-uid-123',
        updateProfile: mockUpdateProfile
      };

      mockCreateUserWithEmailAndPassword.mockResolvedValue({
        user: mockUser
      });
      mockUpdateProfile.mockRejectedValue(new Error('Profile update failed'));

      await expect(createEmployeeUser({
        email: 'test@example.com',
        password: 'testpassword123',
        displayName: 'John Doe'
      })).rejects.toThrow('Impossible de créer l\'utilisateur: Profile update failed');
    });

    it('should handle missing parameters', async () => {
      await expect(createEmployeeUser({
        email: '',
        password: '',
        displayName: ''
      })).rejects.toThrow();
    });
  });
});
