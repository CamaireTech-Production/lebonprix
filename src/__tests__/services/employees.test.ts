import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addEmployeeWithAuth, updateEmployee, removeEmployee } from '../../services/employees';
import { CompanyEmployee } from '../../types/models';

// Mock Firebase Firestore
const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  Timestamp: {
    now: () => ({ seconds: 1234567890, nanoseconds: 0 })
  }
}));

vi.mock('../../services/firebase', () => ({
  db: {}
}));

// Mock employeeAuth service
const mockCreateEmployeeUser = vi.fn();
vi.mock('../../services/employeeAuth', () => ({
  createEmployeeUser: mockCreateEmployeeUser
}));

// Mock security utils
const mockMakeDefaultEmployeePassword = vi.fn();
const mockBuildLoginLink = vi.fn();
const mockGenerateEmployeeId = vi.fn();

vi.mock('../../utils/security', () => ({
  makeDefaultEmployeePassword: mockMakeDefaultEmployeePassword,
  buildLoginLink: mockBuildLoginLink,
  generateEmployeeId: mockGenerateEmployeeId
}));

describe('employees service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    mockGenerateEmployeeId.mockReturnValue('emp_1234567890_abc123');
    mockMakeDefaultEmployeePassword.mockReturnValue('john123doe');
    mockBuildLoginLink.mockReturnValue('mrykqrg');
    mockCreateEmployeeUser.mockResolvedValue('firebase-uid-123');
    mockSetDoc.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    
    // Mock doc function to return mock references
    mockDoc.mockImplementation((...path) => ({
      path: path.join('/'),
      id: path[path.length - 1]
    }));
  });

  describe('addEmployeeWithAuth', () => {
    const mockEmployeeData = {
      firstname: 'John',
      lastname: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      role: 'staff' as const,
      birthday: '1990-01-01'
    };

    it('should create an employee with Firebase Auth user', async () => {
      const result = await addEmployeeWithAuth('company-123', mockEmployeeData);

      expect(mockGenerateEmployeeId).toHaveBeenCalled();
      expect(mockMakeDefaultEmployeePassword).toHaveBeenCalledWith('John', 'Doe');
      expect(mockCreateEmployeeUser).toHaveBeenCalledWith({
        email: 'john.doe@example.com',
        password: 'john123doe',
        displayName: 'John Doe'
      });
      expect(mockBuildLoginLink).toHaveBeenCalledWith('John', 'Doe', 3);

      expect(result).toEqual({
        ...mockEmployeeData,
        id: 'emp_1234567890_abc123',
        firebaseUid: 'firebase-uid-123',
        loginLink: 'mrykqrg',
        createdAt: { seconds: 1234567890, nanoseconds: 0 },
        updatedAt: { seconds: 1234567890, nanoseconds: 0 }
      });

      expect(mockSetDoc).toHaveBeenCalled();
      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should handle Firebase Auth creation failure', async () => {
      const authError = new Error('Email already exists');
      mockCreateEmployeeUser.mockRejectedValue(authError);

      await expect(addEmployeeWithAuth('company-123', mockEmployeeData))
        .rejects.toThrow('Email already exists');

      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('should handle Firestore save failure', async () => {
      const firestoreError = new Error('Permission denied');
      mockSetDoc.mockRejectedValue(firestoreError);

      await expect(addEmployeeWithAuth('company-123', mockEmployeeData))
        .rejects.toThrow('Permission denied');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        firstname: '',
        lastname: 'Doe',
        email: 'invalid-email',
        role: 'staff' as const
      };

      await expect(addEmployeeWithAuth('company-123', invalidData))
        .rejects.toThrow();
    });
  });

  describe('updateEmployee', () => {
    it('should update employee in both subcollection and company document', async () => {
      const updates = {
        firstname: 'Jane',
        phone: '+0987654321'
      };

      await updateEmployee('company-123', 'emp-123', updates);

      expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
      
      // Check subcollection update
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'companies/company-123/employees/emp-123' }),
        expect.objectContaining({
          firstname: 'Jane',
          phone: '+0987654321',
          updatedAt: { seconds: 1234567890, nanoseconds: 0 }
        })
      );

      // Check company document update
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'companies/company-123' }),
        expect.objectContaining({
          'employees.emp-123.updatedAt': { seconds: 1234567890, nanoseconds: 0 },
          'employees.emp-123.firstname': 'Jane',
          'employees.emp-123.phone': '+0987654321'
        })
      );
    });

    it('should handle update failure', async () => {
      const updateError = new Error('Document not found');
      mockUpdateDoc.mockRejectedValue(updateError);

      await expect(updateEmployee('company-123', 'emp-123', { firstname: 'Jane' }))
        .rejects.toThrow('Document not found');
    });
  });

  describe('removeEmployee', () => {
    it('should remove employee from both subcollection and company document', async () => {
      await removeEmployee('company-123', 'emp-123');

      expect(mockDeleteDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'companies/company-123/employees/emp-123' })
      );

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'companies/company-123' }),
        { 'employees.emp-123': null }
      );
    });

    it('should handle removal failure', async () => {
      const deleteError = new Error('Permission denied');
      mockDeleteDoc.mockRejectedValue(deleteError);

      await expect(removeEmployee('company-123', 'emp-123'))
        .rejects.toThrow('Permission denied');
    });
  });
});
