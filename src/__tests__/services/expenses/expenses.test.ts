import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Expense, EmployeeRef } from '../../../types/models'
import { Timestamp } from 'firebase/firestore'

/**
 * Expenses Service Test Suite
 * 
 * PROBLEMS IDENTIFIED BEFORE TESTS:
 * 
 * 1. Strong coupling with Firebase - Functions directly use Firestore
 *    - Solution: Mock Firebase/Firestore for testing
 * 
 * 2. Complex date/Timestamp handling - Multiple formats supported
 *    - Solution: Test all date formats (Date, Timestamp, string, undefined)
 * 
 * 3. Authorization logic mixed with business logic
 *    - Solution: Test authorization paths separately
 * 
 * REFACTORING PERFORMED:
 * - None needed - code structure is acceptable for service layer
 * - Tests use mocks to isolate Firebase dependencies
 * 
 * FUNCTIONS TESTED:
 * - createExpense() - Create expense with date handling, createdBy support
 * - updateExpense() - Update with authorization, createdAt preservation, date conversion
 * - softDeleteExpense() - Soft delete expense and finance entry
 */

// Mock Firebase/Firestore
const mockAddDoc = vi.fn()
const mockGetDoc = vi.fn()
const mockUpdateDoc = vi.fn()
const mockWriteBatch = vi.fn()
const mockBatchUpdate = vi.fn()
const mockBatchCommit = vi.fn()
const mockGetDocs = vi.fn()
const mockCollection = vi.fn()
const mockDoc = vi.fn()
const mockQuery = vi.fn()
const mockWhere = vi.fn()
const mockServerTimestamp = vi.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 }))
const mockSyncFinanceEntryWithExpense = vi.fn().mockResolvedValue(undefined)
const mockCreateAuditLog = vi.fn()

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore')
  return {
    ...actual,
    addDoc: (...args: any[]) => mockAddDoc(...args),
    getDoc: (...args: any[]) => mockGetDoc(...args),
    updateDoc: (...args: any[]) => mockUpdateDoc(...args),
    writeBatch: (...args: any[]) => mockWriteBatch(...args),
    getDocs: (...args: any[]) => mockGetDocs(...args),
    collection: (...args: any[]) => mockCollection(...args),
    doc: (...args: any[]) => mockDoc(...args),
    query: (...args: any[]) => mockQuery(...args),
    where: (...args: any[]) => mockWhere(...args),
    serverTimestamp: () => mockServerTimestamp(),
    Timestamp: actual.Timestamp
  }
})

vi.mock('../../../services/firebase', () => ({
  db: {}
}))

// Import after mocks are set up
import { createExpense, updateExpense, softDeleteExpense } from '../../../services/firestore'

// Helper functions
const createTimestamp = (date: Date): Timestamp => {
  return Timestamp.fromDate(date)
}

const createMockExpense = (
  id: string,
  description: string,
  amount: number,
  companyId: string = 'company1',
  userId: string = 'user1'
): Expense => ({
  id,
  description,
  amount,
  category: 'transportation',
  companyId,
  userId,
  isAvailable: true,
  createdAt: createTimestamp(new Date()),
  updatedAt: createTimestamp(new Date())
})

const createMockEmployeeRef = (id: string = 'emp1'): EmployeeRef => ({
  id,
  firstname: 'John',
  lastname: 'Doe'
})

describe('Expenses Service - CRUD Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mocks
    mockCollection.mockReturnValue({})
    mockDoc.mockReturnValue({})
    mockAddDoc.mockResolvedValue({ id: 'expense123' })
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => createMockExpense('expense123', 'Test Expense', 100)
    })
    mockWriteBatch.mockReturnValue({
      update: mockBatchUpdate,
      commit: mockBatchCommit
    })
    mockBatchCommit.mockResolvedValue(undefined)
    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: []
    })
  })

  describe('createExpense()', () => {
    it('should create expense with Date object', async () => {
      const expenseDate = new Date('2024-01-15')
      const data = {
        description: 'Test Expense',
        amount: 100,
        category: 'transportation',
        userId: 'user1',
        companyId: 'company1',
        date: expenseDate
      }

      const result = await createExpense(data, 'company1')

      expect(mockAddDoc).toHaveBeenCalled()
      expect(result.id).toBe('expense123')
      expect(result.description).toBe('Test Expense')
      expect(result.amount).toBe(100)
      expect(result.companyId).toBe('company1')
      expect(result.isAvailable).toBe(true)
    })

    it('should create expense with Timestamp', async () => {
      const expenseDate = createTimestamp(new Date('2024-01-15'))
      const data = {
        description: 'Test Expense',
        amount: 100,
        category: 'transportation',
        userId: 'user1',
        companyId: 'company1',
        date: expenseDate
      }

      const result = await createExpense(data, 'company1')

      expect(result.id).toBe('expense123')
      expect(result.date).toEqual(expenseDate)
    })

    it('should create expense without date (uses serverTimestamp)', async () => {
      const data = {
        description: 'Test Expense',
        amount: 100,
        category: 'transportation',
        userId: 'user1',
        companyId: 'company1'
      }

      const result = await createExpense(data, 'company1')

      expect(mockServerTimestamp).toHaveBeenCalled()
      expect(result.id).toBe('expense123')
      expect(result.date).toBeDefined()
    })

    it('should include createdBy when provided', async () => {
      const createdBy = createMockEmployeeRef()
      const data = {
        description: 'Test Expense',
        amount: 100,
        category: 'transportation',
        userId: 'user1',
        companyId: 'company1'
      }

      const result = await createExpense(data, 'company1', createdBy)

      expect(result.createdBy).toEqual(createdBy)
    })

    it('should set isAvailable to true by default', async () => {
      const data = {
        description: 'Test Expense',
        amount: 100,
        category: 'transportation',
        userId: 'user1',
        companyId: 'company1'
      }

      const result = await createExpense(data, 'company1')

      expect(result.isAvailable).toBe(true)
    })

    it('should use userId from data or fallback to companyId', async () => {
      const data = {
        description: 'Test Expense',
        amount: 100,
        category: 'transportation',
        companyId: 'company1'
        // No userId
      }

      const result = await createExpense(data, 'company1')

      expect(result.userId).toBe('company1')
    })
  })

  describe('updateExpense()', () => {
    it('should update expense successfully', async () => {
      const expense = createMockExpense('expense123', 'Old Description', 100)
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => expense
      })

      const updateData = {
        description: 'New Description',
        amount: 200
      }

      await updateExpense('expense123', updateData, 'company1')

      expect(mockBatchUpdate).toHaveBeenCalled()
      expect(mockBatchCommit).toHaveBeenCalled()
    })

    it('should preserve createdAt (never modify)', async () => {
      const originalCreatedAt = createTimestamp(new Date('2024-01-01'))
      const expense = {
        ...createMockExpense('expense123', 'Test', 100),
        createdAt: originalCreatedAt
      }
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => expense
      })

      const updateData = {
        description: 'Updated',
        createdAt: createTimestamp(new Date('2024-02-01')) // Try to change createdAt
      }

      await updateExpense('expense123', updateData, 'company1')

      // Verify createdAt was deleted from updateData
      const updateCall = mockBatchUpdate.mock.calls[0]
      expect(updateCall[1].createdAt).toBeUndefined()
    })

    it('should convert Date to Timestamp in update', async () => {
      const expense = createMockExpense('expense123', 'Test', 100)
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => expense
      })

      const newDate = new Date('2024-02-15')
      const updateData = {
        date: newDate
      }

      await updateExpense('expense123', updateData, 'company1')

      const updateCall = mockBatchUpdate.mock.calls[0]
      expect(updateCall[1].date).toBeInstanceOf(Timestamp)
    })

    it('should allow update when companyId matches', async () => {
      const expense = createMockExpense('expense123', 'Test', 100, 'company1', 'user1')
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => expense
      })

      await updateExpense('expense123', { description: 'Updated' }, 'company1')

      expect(mockBatchCommit).toHaveBeenCalled()
    })

    it('should allow update for legacy expense (userId match, companyId different)', async () => {
      const expense = createMockExpense('expense123', 'Test', 100, 'oldCompany', 'user1')
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => expense
      })

      const updateData = {
        description: 'Updated',
        userId: 'user1' // Same user
      }

      await updateExpense('expense123', updateData, 'newCompany')

      expect(mockBatchCommit).toHaveBeenCalled()
    })

    it('should reject update when companyId and userId both differ', async () => {
      const expense = createMockExpense('expense123', 'Test', 100, 'company1', 'user1')
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => expense
      })

      const updateData = {
        description: 'Updated',
        userId: 'differentUser'
      }

      await expect(
        updateExpense('expense123', updateData, 'differentCompany')
      ).rejects.toThrow('Unauthorized: Expense belongs to different company')
    })

    it('should throw error if expense not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false
      })

      await expect(
        updateExpense('nonexistent', { description: 'Updated' }, 'company1')
      ).rejects.toThrow('Expense not found')
    })
  })

  describe('softDeleteExpense()', () => {
    it('should soft delete expense and finance entry', async () => {
      const expense = createMockExpense('expense123', 'Test', 100)
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => expense
      })
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{
          id: 'finance123',
          data: () => ({ sourceType: 'expense', sourceId: 'expense123' })
        }]
      })

      await softDeleteExpense('expense123', 'user1')

      // Verify expense was soft deleted (isAvailable: false)
      expect(mockBatchUpdate).toHaveBeenCalled()
      expect(mockBatchCommit).toHaveBeenCalled()
    })

    it('should handle case when finance entry does not exist', async () => {
      const expense = createMockExpense('expense123', 'Test', 100)
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => expense
      })
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: []
      })

      await softDeleteExpense('expense123', 'user1')

      expect(mockBatchCommit).toHaveBeenCalled()
    })
  })
})

