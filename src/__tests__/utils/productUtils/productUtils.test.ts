import { describe, it, expect } from 'vitest'
import { getLatestCostPrice } from '../../../utils/productUtils'
import type { StockChange } from '../../../types/models'

/**
 * Product Utilities Test Suite
 * 
 * PROBLEMS IDENTIFIED BEFORE TESTS:
 * 
 * 1. REMOVED: getAverageCostPrice() - Not used in production
 * 2. REMOVED: getWeightedAverageCostPrice() - Not used in production
 * 3. REMOVED: calculateProductProfit() - Not used in production
 * 4. REMOVED: calculateProductProfitMargin() - Not used in production
 * 5. REMOVED: getDisplayCostPrice() - Not used in production
 * 
 * REFACTORING PERFORMED:
 * - Removed 5 unused functions (129 lines of dead code)
 * - Kept only production-used function: getLatestCostPrice()
 * 
 * FUNCTIONS TESTED:
 * - getLatestCostPrice() - Get latest cost price from stock changes
 */

// Helper function to create mock StockChange
const createMockStockChange = (
  productId: string,
  costPrice: number,
  change: number,
  createdAtSeconds: number
): StockChange => ({
  id: `change_${createdAtSeconds}`,
  productId,
  costPrice,
  change,
  reason: 'restock',
  createdAt: { seconds: createdAtSeconds, nanoseconds: 0 },
  userId: 'user1',
  companyId: 'company1'
})

describe('Product Utils - Complete Test Suite', () => {
  
  // ============================================================================
  // TEST SUITE 1: getLatestCostPrice
  // ============================================================================
  describe('getLatestCostPrice', () => {
    it('should return latest cost price from valid stock changes', () => {
      const stockChanges: StockChange[] = [
        createMockStockChange('prod1', 100, 10, 1000), // Oldest
        createMockStockChange('prod1', 150, 20, 2000), // Middle
        createMockStockChange('prod1', 200, 30, 3000) // Newest
      ]

      const result = getLatestCostPrice('prod1', stockChanges)
      
      expect(result).toBe(200) // Should return newest cost price
    })

    it('should return undefined for empty array', () => {
      const result = getLatestCostPrice('prod1', [])
      
      expect(result).toBeUndefined()
    })

    it('should return undefined for null stockChanges', () => {
      const result = getLatestCostPrice('prod1', null as any)
      
      expect(result).toBeUndefined()
    })

    it('should return undefined for undefined stockChanges', () => {
      const result = getLatestCostPrice('prod1', undefined as any)
      
      expect(result).toBeUndefined()
    })

    it('should return undefined for non-array stockChanges', () => {
      const result = getLatestCostPrice('prod1', {} as any)
      
      expect(result).toBeUndefined()
    })

    it('should filter by productId correctly', () => {
      const stockChanges: StockChange[] = [
        createMockStockChange('prod1', 100, 10, 2000), // Matching product
        createMockStockChange('prod2', 150, 20, 3000), // Different product (newer but ignored)
        createMockStockChange('prod1', 200, 30, 1000) // Matching product (older)
      ]

      const result = getLatestCostPrice('prod1', stockChanges)
      
      expect(result).toBe(100) // Should return newest for prod1, not prod2
    })

    it('should filter out zero costPrice', () => {
      const stockChanges: StockChange[] = [
        createMockStockChange('prod1', 0, 10, 2000), // Zero cost (filtered out)
        createMockStockChange('prod1', 150, 20, 1000) // Valid cost
      ]

      const result = getLatestCostPrice('prod1', stockChanges)
      
      expect(result).toBe(150) // Should return the valid cost, not zero
    })

    it('should filter out negative costPrice', () => {
      const stockChanges: StockChange[] = [
        createMockStockChange('prod1', -50, 10, 2000), // Negative cost (filtered out)
        createMockStockChange('prod1', 150, 20, 1000) // Valid cost
      ]

      const result = getLatestCostPrice('prod1', stockChanges)
      
      expect(result).toBe(150)
    })

    it('should filter out undefined costPrice', () => {
      const stockChanges: StockChange[] = [
        { ...createMockStockChange('prod1', 100, 10, 2000), costPrice: undefined as any },
        createMockStockChange('prod1', 150, 20, 1000)
      ]

      const result = getLatestCostPrice('prod1', stockChanges)
      
      expect(result).toBe(150)
    })

    it('should sort by createdAt.seconds (newest first)', () => {
      const stockChanges: StockChange[] = [
        createMockStockChange('prod1', 100, 10, 1000), // Oldest timestamp
        createMockStockChange('prod1', 200, 20, 3000), // Newest timestamp
        createMockStockChange('prod1', 150, 30, 2000) // Middle timestamp
      ]

      const result = getLatestCostPrice('prod1', stockChanges)
      
      expect(result).toBe(200) // Should return newest (timestamp 3000)
    })

    it('should return undefined when no matching productId', () => {
      const stockChanges: StockChange[] = [
        createMockStockChange('prod2', 100, 10, 1000),
        createMockStockChange('prod3', 150, 20, 2000)
      ]

      const result = getLatestCostPrice('prod1', stockChanges)
      
      expect(result).toBeUndefined()
    })

    it('should handle single stock change', () => {
      const stockChanges: StockChange[] = [
        createMockStockChange('prod1', 100, 10, 1000)
      ]

      const result = getLatestCostPrice('prod1', stockChanges)
      
      expect(result).toBe(100)
    })

    it('should handle all changes with same timestamp (returns first in array)', () => {
      const stockChanges: StockChange[] = [
        createMockStockChange('prod1', 100, 10, 1000),
        createMockStockChange('prod1', 150, 20, 1000), // Same timestamp
        createMockStockChange('prod1', 200, 30, 1000) // Same timestamp
      ]

      const result = getLatestCostPrice('prod1', stockChanges)
      
      // When timestamps are equal, sort is stable, returns first matching
      expect(result).toBeDefined()
      expect([100, 150, 200]).toContain(result) // One of the values
    })

    it('should handle missing createdAt.seconds (defaults to 0)', () => {
      const stockChanges: StockChange[] = [
        { ...createMockStockChange('prod1', 100, 10, 2000), createdAt: { seconds: undefined as any, nanoseconds: 0 } },
        createMockStockChange('prod1', 150, 20, 1000)
      ]

      const result = getLatestCostPrice('prod1', stockChanges)
      
      // The one with undefined seconds will be treated as 0, so the one with 1000 should be newer
      expect(result).toBe(150)
    })

    it('should handle multiple products and return correct one', () => {
      const stockChanges: StockChange[] = [
        createMockStockChange('prod1', 100, 10, 2000),
        createMockStockChange('prod2', 250, 20, 3000), // Newer but different product
        createMockStockChange('prod1', 150, 30, 1000), // Older for prod1
        createMockStockChange('prod3', 300, 40, 4000) // Newest but different product
      ]

      const result = getLatestCostPrice('prod1', stockChanges)
      
      expect(result).toBe(100) // Should return newest for prod1 (timestamp 2000)
    })

    it('should filter out all invalid entries and return undefined', () => {
      const stockChanges: StockChange[] = [
        createMockStockChange('prod1', 0, 10, 1000), // Zero cost
        createMockStockChange('prod1', -50, 20, 2000), // Negative cost
        { ...createMockStockChange('prod1', 100, 30, 3000), costPrice: undefined as any } // Undefined cost
      ]

      const result = getLatestCostPrice('prod1', stockChanges)
      
      expect(result).toBeUndefined()
    })

    it('should handle very large timestamps', () => {
      const stockChanges: StockChange[] = [
        createMockStockChange('prod1', 100, 10, 9999999999), // Very large timestamp
        createMockStockChange('prod1', 150, 20, 1000) // Small timestamp
      ]

      const result = getLatestCostPrice('prod1', stockChanges)
      
      expect(result).toBe(100) // Should return the one with largest timestamp
    })

    it('should handle negative timestamps', () => {
      const stockChanges: StockChange[] = [
        createMockStockChange('prod1', 100, 10, -1000), // Negative timestamp
        createMockStockChange('prod1', 150, 20, 0) // Zero timestamp
      ]

      const result = getLatestCostPrice('prod1', stockChanges)
      
      // Zero is greater than -1000, so should return 150
      expect(result).toBe(150)
    })

    it('should handle mixed valid and invalid entries', () => {
      const stockChanges: StockChange[] = [
        createMockStockChange('prod1', 0, 10, 1000), // Invalid: zero cost
        createMockStockChange('prod2', 150, 20, 2000), // Valid but wrong product
        createMockStockChange('prod1', 200, 30, 3000), // Valid and correct
        createMockStockChange('prod1', -50, 40, 4000) // Invalid: negative cost
      ]

      const result = getLatestCostPrice('prod1', stockChanges)
      
      expect(result).toBe(200) // Should return valid entry for prod1
    })
  })
})

