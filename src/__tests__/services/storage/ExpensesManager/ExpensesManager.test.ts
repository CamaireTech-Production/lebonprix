import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import ExpensesManager from '../../../../services/storage/ExpensesManager'
import type { Expense } from '../../../../types/models'
import { Timestamp } from 'firebase/firestore'

/**
 * ExpensesManager Test Suite
 * 
 * PROBLEMS IDENTIFIED BEFORE TESTS:
 * 
 * None - ExpensesManager is a clean wrapper around LocalStorageService.
 * 
 * REFACTORING PERFORMED:
 * - None needed - code is clean and well-structured
 * 
 * FUNCTIONS TESTED:
 * - getKey() - Generate storage key
 * - load() - Load expenses from localStorage
 * - save() - Save expenses to localStorage
 * - needsSync() - Check if sync needed
 * - hasChanged() - Check if data changed
 * - updateLastSync() - Update sync timestamp
 * - getLastSync() - Get sync timestamp
 * - remove() - Remove expenses
 * - exists() - Check if expenses exist
 * - getStorageInfo() - Get complete storage info
 */

// Helper to create mock Timestamp
const createTimestamp = (date: Date): Timestamp => {
  return Timestamp.fromDate(date)
}

// Helper to create mock Expense
const createMockExpense = (id: string, description: string, amount: number): Expense => ({
  id,
  description,
  amount,
  category: 'transportation',
  userId: 'user1',
  companyId: 'company1',
  createdAt: createTimestamp(new Date()),
  updatedAt: createTimestamp(new Date())
})

describe('ExpensesManager', () => {
  let mockLocalStorage: { [key: string]: string }
  let originalDateNow: typeof Date.now
  let mockDateNow: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Clear localStorage mock
    mockLocalStorage = {}
    
    // Mock localStorage methods
    global.localStorage = {
      getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockLocalStorage[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete mockLocalStorage[key]
      }),
      clear: vi.fn(() => {
        mockLocalStorage = {}
      }),
      key: vi.fn(),
      length: 0
    } as any

    // Mock Date.now() for TTL tests
    originalDateNow = Date.now
    mockDateNow = vi.fn(() => 1000000) // Base timestamp
    Date.now = mockDateNow
  })

  afterEach(() => {
    Date.now = originalDateNow
  })

  describe('getKey()', () => {
    it('should generate correct storage key with prefix', () => {
      const key = ExpensesManager.getKey('company1')
      expect(key).toBe('expenses_company1')
    })

    it('should generate different keys for different companies', () => {
      const key1 = ExpensesManager.getKey('company1')
      const key2 = ExpensesManager.getKey('company2')
      
      expect(key1).toBe('expenses_company1')
      expect(key2).toBe('expenses_company2')
      expect(key1).not.toBe(key2)
    })
  })

  describe('save()', () => {
    it('should save expenses to localStorage', () => {
      const expenses: Expense[] = [
        createMockExpense('1', 'Expense 1', 100),
        createMockExpense('2', 'Expense 2', 200)
      ]

      ExpensesManager.save('company1', expenses)

      expect(localStorage.setItem).toHaveBeenCalled()
      const stored = mockLocalStorage['expenses_company1']
      expect(stored).toBeDefined()
      
      const parsed = JSON.parse(stored)
      expect(parsed.data).toEqual(expenses)
    })

    it('should save with correct TTL (5 minutes)', () => {
      const expenses: Expense[] = [createMockExpense('1', 'Expense 1', 100)]
      
      ExpensesManager.save('company1', expenses)
      
      const stored = JSON.parse(mockLocalStorage['expenses_company1'])
      expect(stored.metadata.ttl).toBe(5 * 60 * 1000) // 5 minutes
    })

    it('should save with companyId in metadata', () => {
      const expenses: Expense[] = [createMockExpense('1', 'Expense 1', 100)]
      
      ExpensesManager.save('company1', expenses)
      
      const stored = JSON.parse(mockLocalStorage['expenses_company1'])
      expect(stored.metadata.userId).toBe('company1')
    })
  })

  describe('load()', () => {
    it('should load expenses from localStorage', () => {
      const expenses: Expense[] = [
        createMockExpense('1', 'Expense 1', 100),
        createMockExpense('2', 'Expense 2', 200)
      ]
      
      ExpensesManager.save('company1', expenses)
      const loaded = ExpensesManager.load('company1')
      
      expect(loaded).toEqual(expenses)
    })

    it('should return null if no data exists', () => {
      const loaded = ExpensesManager.load('company1')
      expect(loaded).toBeNull()
    })

    it('should return null if data is expired', () => {
      const expenses: Expense[] = [createMockExpense('1', 'Expense 1', 100)]
      
      // Save with old timestamp (expired)
      const entry = {
        data: expenses,
        metadata: {
          timestamp: 1000000 - (6 * 60 * 1000), // 6 minutes ago (expired)
          ttl: 5 * 60 * 1000, // 5 minutes TTL
          version: '1.0.0',
          userId: 'company1'
        }
      }
      mockLocalStorage['expenses_company1'] = JSON.stringify(entry)
      
      const loaded = ExpensesManager.load('company1')
      expect(loaded).toBeNull()
    })
  })

  describe('needsSync()', () => {
    it('should return true if no data exists', () => {
      const needsSync = ExpensesManager.needsSync('company1')
      expect(needsSync).toBe(true)
    })

    it('should return false if data is fresh', () => {
      const expenses: Expense[] = [createMockExpense('1', 'Expense 1', 100)]
      ExpensesManager.save('company1', expenses)
      
      // Data is fresh (just saved)
      const needsSync = ExpensesManager.needsSync('company1')
      expect(needsSync).toBe(false)
    })

    it('should return true if data is stale (80% of TTL)', () => {
      const expenses: Expense[] = [createMockExpense('1', 'Expense 1', 100)]
      
      // Save with old timestamp
      const entry = {
        data: expenses,
        metadata: {
          timestamp: 1000000 - (4.1 * 60 * 1000), // 4.1 minutes ago (stale)
          ttl: 5 * 60 * 1000, // 5 minutes TTL
          version: '1.0.0',
          userId: 'company1'
        }
      }
      mockLocalStorage['expenses_company1'] = JSON.stringify(entry)
      
      const needsSync = ExpensesManager.needsSync('company1')
      expect(needsSync).toBe(true)
    })
  })

  describe('hasChanged()', () => {
    it('should return false if data is identical', () => {
      const expenses1: Expense[] = [createMockExpense('1', 'Expense 1', 100)]
      const expenses2: Expense[] = [createMockExpense('1', 'Expense 1', 100)]
      
      const changed = ExpensesManager.hasChanged(expenses1, expenses2)
      expect(changed).toBe(false)
    })

    it('should return true if lengths differ', () => {
      const expenses1: Expense[] = [createMockExpense('1', 'Expense 1', 100)]
      const expenses2: Expense[] = [
        createMockExpense('1', 'Expense 1', 100),
        createMockExpense('2', 'Expense 2', 200)
      ]
      
      const changed = ExpensesManager.hasChanged(expenses1, expenses2)
      expect(changed).toBe(true)
    })

    it('should return true if IDs differ', () => {
      const expenses1: Expense[] = [createMockExpense('1', 'Expense 1', 100)]
      const expenses2: Expense[] = [createMockExpense('2', 'Expense 1', 100)]
      
      const changed = ExpensesManager.hasChanged(expenses1, expenses2)
      expect(changed).toBe(true)
    })

    it('should return true if updatedAt differs', () => {
      const expense1 = createMockExpense('1', 'Expense 1', 100)
      const expense2 = createMockExpense('1', 'Expense 1', 100)
      expense2.updatedAt = createTimestamp(new Date(Date.now() + 1000))
      
      const changed = ExpensesManager.hasChanged([expense1], [expense2])
      expect(changed).toBe(true)
    })
  })

  describe('updateLastSync()', () => {
    it('should update last sync timestamp', () => {
      const expenses: Expense[] = [createMockExpense('1', 'Expense 1', 100)]
      ExpensesManager.save('company1', expenses)
      
      // Advance time
      mockDateNow.mockReturnValue(2000000)
      
      ExpensesManager.updateLastSync('company1')
      
      const lastSync = ExpensesManager.getLastSync('company1')
      expect(lastSync).toBe(2000000)
    })

    it('should not throw if data does not exist', () => {
      expect(() => {
        ExpensesManager.updateLastSync('company1')
      }).not.toThrow()
    })
  })

  describe('getLastSync()', () => {
    it('should return last sync timestamp', () => {
      const expenses: Expense[] = [createMockExpense('1', 'Expense 1', 100)]
      ExpensesManager.save('company1', expenses)
      
      const lastSync = ExpensesManager.getLastSync('company1')
      expect(lastSync).toBe(1000000) // Base timestamp
    })

    it('should return null if no data exists', () => {
      const lastSync = ExpensesManager.getLastSync('company1')
      expect(lastSync).toBeNull()
    })
  })

  describe('remove()', () => {
    it('should remove expenses from localStorage', () => {
      const expenses: Expense[] = [createMockExpense('1', 'Expense 1', 100)]
      ExpensesManager.save('company1', expenses)
      
      expect(ExpensesManager.exists('company1')).toBe(true)
      
      ExpensesManager.remove('company1')
      
      expect(localStorage.removeItem).toHaveBeenCalledWith('expenses_company1')
      expect(ExpensesManager.exists('company1')).toBe(false)
    })
  })

  describe('exists()', () => {
    it('should return true if expenses exist', () => {
      const expenses: Expense[] = [createMockExpense('1', 'Expense 1', 100)]
      ExpensesManager.save('company1', expenses)
      
      expect(ExpensesManager.exists('company1')).toBe(true)
    })

    it('should return false if expenses do not exist', () => {
      expect(ExpensesManager.exists('company1')).toBe(false)
    })

    it('should return false if data is expired', () => {
      const expenses: Expense[] = [createMockExpense('1', 'Expense 1', 100)]
      
      // Save with old timestamp (expired)
      const entry = {
        data: expenses,
        metadata: {
          timestamp: 1000000 - (6 * 60 * 1000), // 6 minutes ago (expired)
          ttl: 5 * 60 * 1000, // 5 minutes TTL
          version: '1.0.0',
          userId: 'company1'
        }
      }
      mockLocalStorage['expenses_company1'] = JSON.stringify(entry)
      
      expect(ExpensesManager.exists('company1')).toBe(false)
    })
  })

  describe('getStorageInfo()', () => {
    it('should return complete storage info', () => {
      const expenses: Expense[] = [createMockExpense('1', 'Expense 1', 100)]
      ExpensesManager.save('company1', expenses)
      
      const info = ExpensesManager.getStorageInfo('company1')
      
      expect(info.exists).toBe(true)
      expect(info.lastSync).toBe(1000000)
      expect(info.needsSync).toBe(false)
      expect(info.key).toBe('expenses_company1')
    })

    it('should return correct info when data does not exist', () => {
      const info = ExpensesManager.getStorageInfo('company1')
      
      expect(info.exists).toBe(false)
      expect(info.lastSync).toBeNull()
      expect(info.needsSync).toBe(true)
      expect(info.key).toBe('expenses_company1')
    })
  })
})

