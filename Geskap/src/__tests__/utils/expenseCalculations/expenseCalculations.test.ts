import { describe, it, expect } from 'vitest'
import {
  filterExpenses,
  calculateExpenseStats,
  calculateCategoryBreakdown,
  type ExpenseFilterOptions
} from '../../../utils/expenseCalculations'
import type { Expense } from '../../../types/models'
import { Timestamp } from 'firebase/firestore'

/**
 * PROBLEMS IDENTIFIED BEFORE TESTS:
 * 
 * 1. Business logic was mixed with React hook (useExpenseStats) - REFACTORED
 *    - Extracted all calculation logic into pure functions in expenseCalculations.ts
 * 
 * 2. Calculations were embedded in useMemo hook - REFACTORED
 *    - Created pure functions that can be tested in isolation
 * 
 * REFACTORING PERFORMED:
 * - Created 3 pure functions: filterExpenses(), calculateExpenseStats(), calculateCategoryBreakdown()
 * - Refactored useExpenseStats.ts to use extracted functions
 * - All calculations are now testable without React dependencies
 */

// Helper to create mock Timestamp
const createTimestamp = (date: Date): Timestamp => {
  return Timestamp.fromDate(date)
}

// Mock data factories
const createMockExpense = (
  id: string,
  description: string,
  amount: number,
  category: string = 'transportation',
  isAvailable: boolean = true,
  date?: Date
): Expense => ({
  id,
  description,
  amount,
  category,
  isAvailable,
  date: date ? createTimestamp(date) : createTimestamp(new Date()),
  userId: 'user1',
  companyId: 'company1',
  createdAt: createTimestamp(new Date()),
  updatedAt: createTimestamp(new Date())
})

describe('expenseCalculations', () => {
  describe('filterExpenses', () => {
    it('should exclude expenses with isAvailable === false', () => {
      const expenses: Expense[] = [
        createMockExpense('1', 'Expense 1', 100, 'transportation', true),
        createMockExpense('2', 'Expense 2', 200, 'purchase', false),
        createMockExpense('3', 'Expense 3', 300, 'other', true)
      ]

      const result = filterExpenses(expenses)

      expect(result).toHaveLength(2)
      expect(result.map(e => e.id)).toEqual(['1', '3'])
    })

    it('should return all expenses when no filters provided', () => {
      const expenses: Expense[] = [
        createMockExpense('1', 'Expense 1', 100),
        createMockExpense('2', 'Expense 2', 200),
        createMockExpense('3', 'Expense 3', 300)
      ]

      const result = filterExpenses(expenses)

      expect(result).toHaveLength(3)
    })

    it('should filter by category', () => {
      const expenses: Expense[] = [
        createMockExpense('1', 'Expense 1', 100, 'transportation'),
        createMockExpense('2', 'Expense 2', 200, 'purchase'),
        createMockExpense('3', 'Expense 3', 300, 'transportation')
      ]

      const filters: ExpenseFilterOptions = { category: 'transportation' }
      const result = filterExpenses(expenses, filters)

      expect(result).toHaveLength(2)
      expect(result.every(e => e.category === 'transportation')).toBe(true)
    })

    it('should not filter when category is "All"', () => {
      const expenses: Expense[] = [
        createMockExpense('1', 'Expense 1', 100, 'transportation'),
        createMockExpense('2', 'Expense 2', 200, 'purchase')
      ]

      const filters: ExpenseFilterOptions = { category: 'All' }
      const result = filterExpenses(expenses, filters)

      expect(result).toHaveLength(2)
    })

    it('should filter by search query (case-insensitive)', () => {
      const expenses: Expense[] = [
        createMockExpense('1', 'Taxi ride', 100),
        createMockExpense('2', 'Office supplies', 200),
        createMockExpense('3', 'TAXI FARE', 300)
      ]

      const filters: ExpenseFilterOptions = { searchQuery: 'taxi' }
      const result = filterExpenses(expenses, filters)

      expect(result).toHaveLength(2)
      expect(result.map(e => e.id)).toEqual(['1', '3'])
    })

    it('should filter by date range', () => {
      const expenses: Expense[] = [
        createMockExpense('1', 'Expense 1', 100, 'transportation', true, new Date('2024-01-15')),
        createMockExpense('2', 'Expense 2', 200, 'purchase', true, new Date('2024-02-15')),
        createMockExpense('3', 'Expense 3', 300, 'other', true, new Date('2024-03-15'))
      ]

      const filters: ExpenseFilterOptions = {
        dateRange: {
          from: new Date('2024-02-01'),
          to: new Date('2024-02-28')
        }
      }
      const result = filterExpenses(expenses, filters)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('2')
    })

    it('should use createdAt if date is not available', () => {
      const expense: Expense = {
        id: '1',
        description: 'Expense 1',
        amount: 100,
        category: 'transportation',
        userId: 'user1',
        companyId: 'company1',
        createdAt: createTimestamp(new Date('2024-02-15')),
        updatedAt: createTimestamp(new Date())
      }

      const filters: ExpenseFilterOptions = {
        dateRange: {
          from: new Date('2024-02-01'),
          to: new Date('2024-02-28')
        }
      }
      const result = filterExpenses([expense], filters)

      expect(result).toHaveLength(1)
    })

    it('should exclude expenses without valid timestamp', () => {
      const expense: Expense = {
        id: '1',
        description: 'Expense 1',
        amount: 100,
        category: 'transportation',
        userId: 'user1',
        companyId: 'company1',
        createdAt: { seconds: 0, nanoseconds: 0 },
        updatedAt: createTimestamp(new Date())
      }

      const filters: ExpenseFilterOptions = {
        dateRange: {
          from: new Date('2024-02-01'),
          to: new Date('2024-02-28')
        }
      }
      const result = filterExpenses([expense], filters)

      expect(result).toHaveLength(0)
    })

    it('should filter by minimum amount', () => {
      const expenses: Expense[] = [
        createMockExpense('1', 'Expense 1', 100),
        createMockExpense('2', 'Expense 2', 250),
        createMockExpense('3', 'Expense 3', 300)
      ]

      const filters: ExpenseFilterOptions = { minAmount: 200 }
      const result = filterExpenses(expenses, filters)

      expect(result).toHaveLength(2)
      expect(result.every(e => e.amount >= 200)).toBe(true)
    })

    it('should filter by maximum amount', () => {
      const expenses: Expense[] = [
        createMockExpense('1', 'Expense 1', 100),
        createMockExpense('2', 'Expense 2', 250),
        createMockExpense('3', 'Expense 3', 300)
      ]

      const filters: ExpenseFilterOptions = { maxAmount: 200 }
      const result = filterExpenses(expenses, filters)

      expect(result).toHaveLength(1)
      expect(result[0].amount).toBe(100)
    })

    it('should filter by amount range', () => {
      const expenses: Expense[] = [
        createMockExpense('1', 'Expense 1', 100),
        createMockExpense('2', 'Expense 2', 250),
        createMockExpense('3', 'Expense 3', 300)
      ]

      const filters: ExpenseFilterOptions = { minAmount: 150, maxAmount: 280 }
      const result = filterExpenses(expenses, filters)

      expect(result).toHaveLength(1)
      expect(result[0].amount).toBe(250)
    })

    it('should combine all filters', () => {
      const expenses: Expense[] = [
        createMockExpense('1', 'Taxi ride', 100, 'transportation', true, new Date('2024-02-15')),
        createMockExpense('2', 'Taxi fare', 250, 'transportation', true, new Date('2024-02-20')),
        createMockExpense('3', 'Office supplies', 300, 'purchase', true, new Date('2024-02-15')),
        createMockExpense('4', 'Taxi payment', 150, 'transportation', true, new Date('2024-03-15'))
      ]

      const filters: ExpenseFilterOptions = {
        category: 'transportation',
        searchQuery: 'taxi',
        dateRange: {
          from: new Date('2024-02-01'),
          to: new Date('2024-02-28')
        },
        minAmount: 200
      }
      const result = filterExpenses(expenses, filters)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('2')
    })

    it('should handle empty expenses array', () => {
      const result = filterExpenses([])
      expect(result).toHaveLength(0)
    })
  })

  describe('calculateCategoryBreakdown', () => {
    it('should calculate category breakdown correctly', () => {
      const expenses: Expense[] = [
        createMockExpense('1', 'Expense 1', 100, 'transportation'),
        createMockExpense('2', 'Expense 2', 200, 'purchase'),
        createMockExpense('3', 'Expense 3', 300, 'transportation')
      ]

      const result = calculateCategoryBreakdown(expenses, 600)

      expect(result).toHaveLength(2)
      expect(result[0].category).toBe('transportation')
      expect(result[0].totalAmount).toBe(400)
      expect(result[0].count).toBe(2)
      expect(result[0].percentage).toBeCloseTo(66.67, 1)
      expect(result[1].category).toBe('purchase')
      expect(result[1].totalAmount).toBe(200)
      expect(result[1].count).toBe(1)
      expect(result[1].percentage).toBeCloseTo(33.33, 1)
    })

    it('should sort by totalAmount descending', () => {
      const expenses: Expense[] = [
        createMockExpense('1', 'Expense 1', 100, 'transportation'),
        createMockExpense('2', 'Expense 2', 500, 'purchase'),
        createMockExpense('3', 'Expense 3', 200, 'other')
      ]

      const result = calculateCategoryBreakdown(expenses, 800)

      expect(result[0].category).toBe('purchase')
      expect(result[1].category).toBe('other')
      expect(result[2].category).toBe('transportation')
    })

    it('should calculate percentages correctly', () => {
      const expenses: Expense[] = [
        createMockExpense('1', 'Expense 1', 100, 'transportation'),
        createMockExpense('2', 'Expense 2', 300, 'purchase')
      ]

      const result = calculateCategoryBreakdown(expenses, 400)

      expect(result[0].percentage).toBe(75) // 300/400 * 100
      expect(result[1].percentage).toBe(25) // 100/400 * 100
    })

    it('should return 0% when totalAmount is 0', () => {
      const expenses: Expense[] = [
        createMockExpense('1', 'Expense 1', 0, 'transportation')
      ]

      const result = calculateCategoryBreakdown(expenses, 0)

      expect(result[0].percentage).toBe(0)
    })

    it('should handle empty expenses array', () => {
      const result = calculateCategoryBreakdown([], 0)
      expect(result).toHaveLength(0)
    })
  })

  describe('calculateExpenseStats', () => {
    it('should calculate all statistics correctly', () => {
      const expenses: Expense[] = [
        createMockExpense('1', 'Expense 1', 100, 'transportation'),
        createMockExpense('2', 'Expense 2', 200, 'purchase'),
        createMockExpense('3', 'Expense 3', 300, 'transportation')
      ]

      const result = calculateExpenseStats(expenses)

      expect(result.totalAmount).toBe(600)
      expect(result.totalCount).toBe(3)
      expect(result.averageAmount).toBe(200)
      expect(result.summaryStats.transportation).toBe(400)
      expect(result.summaryStats.purchase).toBe(200)
      expect(result.categoryBreakdown).toHaveLength(2)
    })

    it('should calculate averageAmount correctly', () => {
      const expenses: Expense[] = [
        createMockExpense('1', 'Expense 1', 100),
        createMockExpense('2', 'Expense 2', 200),
        createMockExpense('3', 'Expense 3', 300)
      ]

      const result = calculateExpenseStats(expenses)

      expect(result.averageAmount).toBe(200) // (100 + 200 + 300) / 3
    })

    it('should return 0 for averageAmount when no expenses', () => {
      const result = calculateExpenseStats([])

      expect(result.averageAmount).toBe(0)
      expect(result.totalAmount).toBe(0)
      expect(result.totalCount).toBe(0)
    })

    it('should calculate summaryStats by category', () => {
      const expenses: Expense[] = [
        createMockExpense('1', 'Expense 1', 100, 'transportation'),
        createMockExpense('2', 'Expense 2', 200, 'purchase'),
        createMockExpense('3', 'Expense 3', 300, 'transportation'),
        createMockExpense('4', 'Expense 4', 150, 'purchase')
      ]

      const result = calculateExpenseStats(expenses)

      expect(result.summaryStats.transportation).toBe(400)
      expect(result.summaryStats.purchase).toBe(350)
    })

    it('should calculate categoryBreakdown with correct percentages', () => {
      const expenses: Expense[] = [
        createMockExpense('1', 'Expense 1', 100, 'transportation'),
        createMockExpense('2', 'Expense 2', 300, 'purchase')
      ]

      const result = calculateExpenseStats(expenses)

      expect(result.categoryBreakdown[0].percentage).toBe(75) // 300/400 * 100
      expect(result.categoryBreakdown[1].percentage).toBe(25) // 100/400 * 100
    })

    it('should sort categoryBreakdown by totalAmount descending', () => {
      const expenses: Expense[] = [
        createMockExpense('1', 'Expense 1', 100, 'transportation'),
        createMockExpense('2', 'Expense 2', 500, 'purchase'),
        createMockExpense('3', 'Expense 3', 200, 'other')
      ]

      const result = calculateExpenseStats(expenses)

      expect(result.categoryBreakdown[0].category).toBe('purchase')
      expect(result.categoryBreakdown[0].totalAmount).toBe(500)
      expect(result.categoryBreakdown[1].category).toBe('other')
      expect(result.categoryBreakdown[2].category).toBe('transportation')
    })

    it('should handle expenses with same category', () => {
      const expenses: Expense[] = [
        createMockExpense('1', 'Expense 1', 100, 'transportation'),
        createMockExpense('2', 'Expense 2', 200, 'transportation'),
        createMockExpense('3', 'Expense 3', 300, 'transportation')
      ]

      const result = calculateExpenseStats(expenses)

      expect(result.summaryStats.transportation).toBe(600)
      expect(result.categoryBreakdown).toHaveLength(1)
      expect(result.categoryBreakdown[0].count).toBe(3)
    })

    it('should handle empty expenses array', () => {
      const result = calculateExpenseStats([])

      expect(result.totalAmount).toBe(0)
      expect(result.totalCount).toBe(0)
      expect(result.averageAmount).toBe(0)
      expect(Object.keys(result.summaryStats)).toHaveLength(0)
      expect(result.categoryBreakdown).toHaveLength(0)
    })
  })
})

