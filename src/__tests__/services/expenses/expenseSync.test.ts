import { describe, it, expect, beforeEach, vi } from 'vitest'
import { syncFinanceEntryWithExpense } from '../../../services/firestore'
import type { Expense } from '../../../types/models'
import { Timestamp } from 'firebase/firestore'

/**
 * Expense Sync Test Suite
 * 
 * Tests for syncFinanceEntryWithExpense() - synchronizes expense with finance entry
 */

// Mock Firebase/Firestore
const mockGetDocs = vi.fn()
const mockCreateFinanceEntry = vi.fn()
const mockUpdateFinanceEntry = vi.fn()
const mockQuery = vi.fn()
const mockWhere = vi.fn()
const mockCollection = vi.fn()

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore')
  return {
    ...actual,
    getDocs: (...args: any[]) => mockGetDocs(...args),
    query: (...args: any[]) => mockQuery(...args),
    where: (...args: any[]) => mockWhere(...args),
    collection: (...args: any[]) => mockCollection(...args),
    Timestamp: actual.Timestamp
  }
})

vi.mock('../../../services/firebase', () => ({
  db: {}
}))

// Mock createFinanceEntry and updateFinanceEntry
vi.mock('../../../services/firestore', async () => {
  const actual = await vi.importActual('../../../services/firestore') as any
  return {
    ...actual,
    createFinanceEntry: mockCreateFinanceEntry,
    updateFinanceEntry: mockUpdateFinanceEntry
  }
})

// Helper functions
const createTimestamp = (date: Date): Timestamp => {
  return Timestamp.fromDate(date)
}

const createMockExpense = (id: string, amount: number, date?: Date): Expense => ({
  id,
  description: 'Test Expense',
  amount,
  category: 'transportation',
  userId: 'user1',
  companyId: 'company1',
  isAvailable: true,
  date: date ? createTimestamp(date) : createTimestamp(new Date()),
  createdAt: createTimestamp(new Date()),
  updatedAt: createTimestamp(new Date())
})

describe('syncFinanceEntryWithExpense', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCollection.mockReturnValue({})
    mockWhere.mockReturnValue({})
    mockQuery.mockReturnValue({})
    mockCreateFinanceEntry.mockResolvedValue(undefined)
    mockUpdateFinanceEntry.mockResolvedValue(undefined)
  })

  it('should create finance entry if it does not exist', async () => {
    const expense = createMockExpense('expense123', 100)
    mockGetDocs.mockResolvedValue({
      empty: true,
      docs: []
    })

    await syncFinanceEntryWithExpense(expense)

    expect(mockCreateFinanceEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'expense',
        sourceId: 'expense123',
        type: 'expense',
        amount: -100, // Negative amount
        description: 'Test Expense',
        userId: 'user1',
        companyId: 'company1',
        isDeleted: false
      })
    )
  })

  it('should update finance entry if it exists', async () => {
    const expense = createMockExpense('expense123', 200)
    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [{
        id: 'finance123',
        data: () => ({ sourceType: 'expense', sourceId: 'expense123' })
      }]
    })

    await syncFinanceEntryWithExpense(expense)

    expect(mockUpdateFinanceEntry).toHaveBeenCalledWith(
      'finance123',
      expect.objectContaining({
        amount: -200, // Negative amount
        description: 'Test Expense'
      })
    )
  })

  it('should use negative amount (expense)', async () => {
    const expense = createMockExpense('expense123', 150)
    mockGetDocs.mockResolvedValue({
      empty: true,
      docs: []
    })

    await syncFinanceEntryWithExpense(expense)

    expect(mockCreateFinanceEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: -150
      })
    )
  })

  it('should use date if available, otherwise createdAt', async () => {
    const expenseDate = new Date('2024-01-15')
    const expense = createMockExpense('expense123', 100, expenseDate)
    mockGetDocs.mockResolvedValue({
      empty: true,
      docs: []
    })

    await syncFinanceEntryWithExpense(expense)

    expect(mockCreateFinanceEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        date: createTimestamp(expenseDate)
      })
    )
  })

  it('should use createdAt if date is not available', async () => {
    const expense: Expense = {
      id: 'expense123',
      description: 'Test',
      amount: 100,
      category: 'transportation',
      userId: 'user1',
      companyId: 'company1',
      createdAt: createTimestamp(new Date('2024-01-10')),
      updatedAt: createTimestamp(new Date())
      // No date field
    }
    mockGetDocs.mockResolvedValue({
      empty: true,
      docs: []
    })

    await syncFinanceEntryWithExpense(expense)

    expect(mockCreateFinanceEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        date: expense.createdAt
      })
    )
  })

  it('should set isDeleted based on isAvailable', async () => {
    const expense = {
      ...createMockExpense('expense123', 100),
      isAvailable: false
    }
    mockGetDocs.mockResolvedValue({
      empty: true,
      docs: []
    })

    await syncFinanceEntryWithExpense(expense)

    expect(mockCreateFinanceEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        isDeleted: true
      })
    )
  })

  it('should skip sync if expense is invalid (missing id)', async () => {
    const expense = {
      ...createMockExpense('expense123', 100),
      id: ''
    } as Expense

    await syncFinanceEntryWithExpense(expense)

    expect(mockGetDocs).not.toHaveBeenCalled()
    expect(mockCreateFinanceEntry).not.toHaveBeenCalled()
  })

  it('should skip sync if expense is invalid (missing userId)', async () => {
    const expense = {
      ...createMockExpense('expense123', 100),
      userId: ''
    } as Expense

    await syncFinanceEntryWithExpense(expense)

    expect(mockGetDocs).not.toHaveBeenCalled()
    expect(mockCreateFinanceEntry).not.toHaveBeenCalled()
  })

  it('should skip sync if expense is invalid (missing companyId)', async () => {
    const expense = {
      ...createMockExpense('expense123', 100),
      companyId: ''
    } as Expense

    await syncFinanceEntryWithExpense(expense)

    expect(mockGetDocs).not.toHaveBeenCalled()
    expect(mockCreateFinanceEntry).not.toHaveBeenCalled()
  })
})

