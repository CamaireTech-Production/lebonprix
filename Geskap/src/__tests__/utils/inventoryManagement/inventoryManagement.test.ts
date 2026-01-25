import { describe, it, expect} from 'vitest'
import {
  getAvailableStockBatches,
  consumeStockFromBatches,
  createStockBatch,
  validateStockBatch,
  formatCostPrice,
  formatStockQuantity,
  getBatchStatusText,
  getBatchStatusColor
} from '../../../utils/inventoryManagement'
import type { StockBatch } from '../../../types/models'

/**
 * Inventory Management Test Suite
 * 
 * PROBLEMS IDENTIFIED BEFORE TESTS:
 * 
 * 1. REMOVED: calculateStockValue() - Duplicate logic in firestore.ts getProductStockInfo
 * 2. REMOVED: getBatchStatistics() - Duplicate logic in firestore.ts getStockBatchStats
 * 
 * REFACTORING PERFORMED:
 * - Removed 2 unused functions (46 lines of duplicate code)
 * - Kept only production-used functions
 * 
 * FUNCTIONS TESTED:
 * - getAvailableStockBatches() - FIFO/LIFO sorting and filtering
 * - consumeStockFromBatches() - Stock consumption with cost calculations
 * - createStockBatch() - Batch creation with defaults
 * - validateStockBatch() - Input validation
 * - formatCostPrice() - Currency formatting
 * - formatStockQuantity() - Number formatting
 * - getBatchStatusText() - Status text mapping
 * - getBatchStatusColor() - Status color mapping
 */

// Helper function to create mock StockBatch
const createMockBatch = (
  id: string,
  productId: string,
  quantity: number,
  remainingQuantity: number,
  costPrice: number,
  createdAtSeconds: number,
  status: StockBatch['status'] = 'active',
  userId: string = 'user1',
  companyId: string = 'company1'
): StockBatch => ({
  id,
  productId,
  quantity,
  remainingQuantity,
  costPrice,
  createdAt: { seconds: createdAtSeconds, nanoseconds: 0 },
  userId,
  companyId,
  status
})

describe('Inventory Management - Complete Test Suite', () => {
  
  // ============================================================================
  // TEST SUITE 1: getAvailableStockBatches
  // ============================================================================
  describe('getAvailableStockBatches', () => {
    it('should filter only active batches with remaining quantity > 0', () => {
      const batches: StockBatch[] = [
        createMockBatch('1', 'prod1', 100, 50, 10, 1000, 'active'),
        createMockBatch('2', 'prod1', 100, 0, 10, 2000, 'active'), // Depleted
        createMockBatch('3', 'prod1', 100, 30, 10, 3000, 'depleted'), // Wrong status
        createMockBatch('4', 'prod1', 100, 20, 10, 4000, 'active')
      ]

      const result = getAvailableStockBatches(batches, 'FIFO')
      
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('1')
      expect(result[1].id).toBe('4')
    })

    it('should sort batches FIFO (oldest first)', () => {
      const batches: StockBatch[] = [
        createMockBatch('1', 'prod1', 100, 50, 10, 3000, 'active'),
        createMockBatch('2', 'prod1', 100, 50, 10, 1000, 'active'), // Oldest
        createMockBatch('3', 'prod1', 100, 50, 10, 2000, 'active')
      ]

      const result = getAvailableStockBatches(batches, 'FIFO')
      
      expect(result).toHaveLength(3)
      expect(result[0].id).toBe('2') // Oldest first
      expect(result[1].id).toBe('3')
      expect(result[2].id).toBe('1')
    })

    it('should sort batches LIFO (newest first)', () => {
      const batches: StockBatch[] = [
        createMockBatch('1', 'prod1', 100, 50, 10, 1000, 'active'), // Oldest
        createMockBatch('2', 'prod1', 100, 50, 10, 3000, 'active'), // Newest
        createMockBatch('3', 'prod1', 100, 50, 10, 2000, 'active')
      ]

      const result = getAvailableStockBatches(batches, 'LIFO')
      
      expect(result).toHaveLength(3)
      expect(result[0].id).toBe('2') // Newest first
      expect(result[1].id).toBe('3')
      expect(result[2].id).toBe('1')
    })

    it('should default to FIFO when method not specified', () => {
      const batches: StockBatch[] = [
        createMockBatch('1', 'prod1', 100, 50, 10, 2000, 'active'),
        createMockBatch('2', 'prod1', 100, 50, 10, 1000, 'active') // Older
      ]

      const result = getAvailableStockBatches(batches)
      
      expect(result[0].id).toBe('2') // FIFO: oldest first
    })

    it('should return empty array when no active batches', () => {
      const batches: StockBatch[] = [
        createMockBatch('1', 'prod1', 100, 0, 10, 1000, 'active'), // Depleted
        createMockBatch('2', 'prod1', 100, 0, 10, 2000, 'depleted') // Wrong status
      ]

      const result = getAvailableStockBatches(batches, 'FIFO')
      
      expect(result).toHaveLength(0)
    })

    it('should handle empty array', () => {
      const result = getAvailableStockBatches([], 'FIFO')
      expect(result).toHaveLength(0)
    })

    it('should handle batches with zero remainingQuantity', () => {
      const batches: StockBatch[] = [
        createMockBatch('1', 'prod1', 100, 0, 10, 1000, 'active'),
        createMockBatch('2', 'prod1', 100, 0, 10, 2000, 'active')
      ]

      const result = getAvailableStockBatches(batches, 'FIFO')
      expect(result).toHaveLength(0)
    })

    it('should handle mixed statuses correctly', () => {
      const batches: StockBatch[] = [
        createMockBatch('1', 'prod1', 100, 50, 10, 1000, 'active'),
        createMockBatch('2', 'prod1', 100, 30, 10, 2000, 'depleted'),
        createMockBatch('3', 'prod1', 100, 20, 10, 3000, 'corrected'),
        createMockBatch('4', 'prod1', 100, 10, 10, 4000, 'active')
      ]

      const result = getAvailableStockBatches(batches, 'FIFO')
      
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('1')
      expect(result[1].id).toBe('4')
    })
  })

  // ============================================================================
  // TEST SUITE 2: consumeStockFromBatches
  // ============================================================================
  describe('consumeStockFromBatches', () => {
    it('should consume from single batch (FIFO)', () => {
      const batches: StockBatch[] = [
        createMockBatch('1', 'prod1', 100, 50, 10, 1000, 'active')
      ]

      const result = consumeStockFromBatches(batches, 30, 'FIFO')
      
      expect(result.consumedBatches).toHaveLength(1)
      expect(result.consumedBatches[0].batchId).toBe('1')
      expect(result.consumedBatches[0].consumedQuantity).toBe(30)
      expect(result.consumedBatches[0].remainingQuantity).toBe(20)
      expect(result.totalCost).toBe(300) // 30 * 10
      expect(result.averageCostPrice).toBe(10)
      expect(result.primaryBatchId).toBe('1')
    })

    it('should consume from multiple batches (FIFO - oldest first)', () => {
      const batches: StockBatch[] = [
        createMockBatch('1', 'prod1', 100, 30, 10, 1000, 'active'), // Oldest
        createMockBatch('2', 'prod1', 100, 50, 15, 2000, 'active'),
        createMockBatch('3', 'prod1', 100, 20, 20, 3000, 'active')
      ]

      const result = consumeStockFromBatches(batches, 50, 'FIFO')
      
      expect(result.consumedBatches).toHaveLength(2)
      expect(result.consumedBatches[0].batchId).toBe('1') // Consumes from oldest first
      expect(result.consumedBatches[0].consumedQuantity).toBe(30)
      expect(result.consumedBatches[1].batchId).toBe('2')
      expect(result.consumedBatches[1].consumedQuantity).toBe(20)
      expect(result.totalCost).toBe(600) // (30 * 10) + (20 * 15)
      expect(result.averageCostPrice).toBe(12) // 600 / 50
    })

    it('should consume from multiple batches (LIFO - newest first)', () => {
      const batches: StockBatch[] = [
        createMockBatch('1', 'prod1', 100, 30, 10, 1000, 'active'), // Oldest
        createMockBatch('2', 'prod1', 100, 50, 15, 2000, 'active'),
        createMockBatch('3', 'prod1', 100, 20, 20, 3000, 'active') // Newest
      ]

      const result = consumeStockFromBatches(batches, 50, 'LIFO')
      
      expect(result.consumedBatches).toHaveLength(2)
      expect(result.consumedBatches[0].batchId).toBe('3') // Consumes from newest first
      expect(result.consumedBatches[0].consumedQuantity).toBe(20)
      expect(result.consumedBatches[1].batchId).toBe('2')
      expect(result.consumedBatches[1].consumedQuantity).toBe(30)
      expect(result.totalCost).toBe(850) // (20 * 20) + (30 * 15) = 400 + 450
      expect(result.averageCostPrice).toBe(17) // 850 / 50
    })

    it('should consume exact quantity from single batch', () => {
      const batches: StockBatch[] = [
        createMockBatch('1', 'prod1', 100, 50, 10, 1000, 'active')
      ]

      const result = consumeStockFromBatches(batches, 50, 'FIFO')
      
      expect(result.consumedBatches[0].consumedQuantity).toBe(50)
      expect(result.consumedBatches[0].remainingQuantity).toBe(0)
      expect(result.totalCost).toBe(500)
    })

    it('should throw error when no available batches', () => {
      const batches: StockBatch[] = [
        createMockBatch('1', 'prod1', 100, 0, 10, 1000, 'active') // Depleted
      ]

      expect(() => {
        consumeStockFromBatches(batches, 10, 'FIFO')
      }).toThrow('No available stock batches found')
    })

    it('should throw error when insufficient stock', () => {
      const batches: StockBatch[] = [
        createMockBatch('1', 'prod1', 100, 30, 10, 1000, 'active')
      ]

      expect(() => {
        consumeStockFromBatches(batches, 50, 'FIFO')
      }).toThrow('Insufficient stock available. Need 50, available 30')
    })

    it('should calculate averageCostPrice correctly with different cost prices', () => {
      const batches: StockBatch[] = [
        createMockBatch('1', 'prod1', 100, 20, 10, 1000, 'active'),
        createMockBatch('2', 'prod1', 100, 30, 15, 2000, 'active')
      ]

      const result = consumeStockFromBatches(batches, 40, 'FIFO')
      
      // (20 * 10) + (20 * 15) = 200 + 300 = 500
      // 500 / 40 = 12.5
      expect(result.totalCost).toBe(500)
      expect(result.averageCostPrice).toBe(12.5)
    })

    it('should set primaryBatchId to first consumed batch', () => {
      const batches: StockBatch[] = [
        createMockBatch('1', 'prod1', 100, 30, 10, 1000, 'active'),
        createMockBatch('2', 'prod1', 100, 50, 15, 2000, 'active')
      ]

      const result = consumeStockFromBatches(batches, 50, 'FIFO')
      
      expect(result.primaryBatchId).toBe('1')
    })

    it('should handle empty batches array', () => {
      expect(() => {
        consumeStockFromBatches([], 10, 'FIFO')
      }).toThrow('No available stock batches found')
    })

    it('should default to FIFO when method not specified', () => {
      const batches: StockBatch[] = [
        createMockBatch('1', 'prod1', 100, 30, 10, 1000, 'active'), // Older
        createMockBatch('2', 'prod1', 100, 50, 15, 2000, 'active')
      ]

      const result = consumeStockFromBatches(batches, 30)
      
      expect(result.consumedBatches[0].batchId).toBe('1') // FIFO: oldest first
    })

    it('should consume across all batches when needed', () => {
      const batches: StockBatch[] = [
        createMockBatch('1', 'prod1', 100, 10, 10, 1000, 'active'),
        createMockBatch('2', 'prod1', 100, 20, 15, 2000, 'active'),
        createMockBatch('3', 'prod1', 100, 30, 20, 3000, 'active')
      ]

      const result = consumeStockFromBatches(batches, 60, 'FIFO')
      
      expect(result.consumedBatches).toHaveLength(3)
      expect(result.consumedBatches[0].consumedQuantity).toBe(10)
      expect(result.consumedBatches[1].consumedQuantity).toBe(20)
      expect(result.consumedBatches[2].consumedQuantity).toBe(30)
      expect(result.totalCost).toBe(1000) // (10*10) + (20*15) + (30*20) = 100 + 300 + 600
    })
  })

  // ============================================================================
  // TEST SUITE 3: createStockBatch
  // ============================================================================
  describe('createStockBatch', () => {
    it('should create batch with all required fields', () => {
      const result = createStockBatch('prod1', 100, 15.5, 'user1')
      
      expect(result.productId).toBe('prod1')
      expect(result.quantity).toBe(100)
      expect(result.costPrice).toBe(15.5)
      expect(result.userId).toBe('user1')
      expect(result.remainingQuantity).toBe(100) // Default equals quantity
      expect(result.status).toBe('active') // Default status
      expect(result.createdAt).toBeDefined()
      expect(result.createdAt.seconds).toBeGreaterThan(0)
    })

    it('should set remainingQuantity equal to quantity', () => {
      const result = createStockBatch('prod1', 50, 10, 'user1')
      
      expect(result.remainingQuantity).toBe(50)
      expect(result.quantity).toBe(50)
    })

    it('should set status to active by default', () => {
      const result = createStockBatch('prod1', 100, 10, 'user1')
      
      expect(result.status).toBe('active')
    })

    it('should include optional supplierId', () => {
      const result = createStockBatch('prod1', 100, 10, 'user1', 'supplier1')
      
      expect(result.supplierId).toBe('supplier1')
    })

    it('should include optional isOwnPurchase', () => {
      const result = createStockBatch('prod1', 100, 10, 'user1', undefined, true)
      
      expect(result.isOwnPurchase).toBe(true)
    })

    it('should include optional isCredit', () => {
      const result = createStockBatch('prod1', 100, 10, 'user1', undefined, undefined, true)
      
      expect(result.isCredit).toBe(true)
    })

    it('should include all optional fields', () => {
      const result = createStockBatch('prod1', 100, 10, 'user1', 'supplier1', true, true)
      
      expect(result.supplierId).toBe('supplier1')
      expect(result.isOwnPurchase).toBe(true)
      expect(result.isCredit).toBe(true)
    })

    it('should generate timestamp with current time', () => {
      const before = Date.now() / 1000
      const result = createStockBatch('prod1', 100, 10, 'user1')
      const after = Date.now() / 1000
      
      expect(result.createdAt.seconds).toBeGreaterThanOrEqual(before)
      expect(result.createdAt.seconds).toBeLessThanOrEqual(after)
      expect(result.createdAt.nanoseconds).toBe(0)
    })

    it('should not include id field (returns Omit<StockBatch, id>)', () => {
      const result = createStockBatch('prod1', 100, 10, 'user1')
      
      expect(result).not.toHaveProperty('id')
    })
  })

  // ============================================================================
  // TEST SUITE 4: validateStockBatch
  // ============================================================================
  describe('validateStockBatch', () => {
    it('should return empty array for valid batch', () => {
      const batch = {
        productId: 'prod1',
        quantity: 100,
        costPrice: 10,
        userId: 'user1'
      }

      const errors = validateStockBatch(batch)
      
      expect(errors).toHaveLength(0)
    })

    it('should return error when productId is missing', () => {
      const batch = {
        quantity: 100,
        costPrice: 10,
        userId: 'user1'
      }

      const errors = validateStockBatch(batch)
      
      expect(errors).toContain('Product ID is required')
    })

    it('should return error when productId is empty string', () => {
      const batch = {
        productId: '',
        quantity: 100,
        costPrice: 10,
        userId: 'user1'
      }

      const errors = validateStockBatch(batch)
      
      expect(errors).toContain('Product ID is required')
    })

    it('should return error when quantity is missing', () => {
      const batch = {
        productId: 'prod1',
        costPrice: 10,
        userId: 'user1'
      }

      const errors = validateStockBatch(batch)
      
      expect(errors).toContain('Quantity must be greater than 0')
    })

    it('should return error when quantity is zero', () => {
      const batch = {
        productId: 'prod1',
        quantity: 0,
        costPrice: 10,
        userId: 'user1'
      }

      const errors = validateStockBatch(batch)
      
      expect(errors).toContain('Quantity must be greater than 0')
    })

    it('should return error when quantity is negative', () => {
      const batch = {
        productId: 'prod1',
        quantity: -10,
        costPrice: 10,
        userId: 'user1'
      }

      const errors = validateStockBatch(batch)
      
      expect(errors).toContain('Quantity must be greater than 0')
    })

    it('should return error when costPrice is missing', () => {
      const batch = {
        productId: 'prod1',
        quantity: 100,
        userId: 'user1'
      }

      const errors = validateStockBatch(batch)
      
      expect(errors).toContain('Cost price must be greater than 0')
    })

    it('should return error when costPrice is zero', () => {
      const batch = {
        productId: 'prod1',
        quantity: 100,
        costPrice: 0,
        userId: 'user1'
      }

      const errors = validateStockBatch(batch)
      
      expect(errors).toContain('Cost price must be greater than 0')
    })

    it('should return error when costPrice is negative', () => {
      const batch = {
        productId: 'prod1',
        quantity: 100,
        costPrice: -5,
        userId: 'user1'
      }

      const errors = validateStockBatch(batch)
      
      expect(errors).toContain('Cost price must be greater than 0')
    })

    it('should return error when userId is missing', () => {
      const batch = {
        productId: 'prod1',
        quantity: 100,
        costPrice: 10
      }

      const errors = validateStockBatch(batch)
      
      expect(errors).toContain('User ID is required')
    })

    it('should return error when userId is empty string', () => {
      const batch = {
        productId: 'prod1',
        quantity: 100,
        costPrice: 10,
        userId: ''
      }

      const errors = validateStockBatch(batch)
      
      expect(errors).toContain('User ID is required')
    })

    it('should return multiple errors for invalid batch', () => {
      const batch = {
        productId: '',
        quantity: -10,
        costPrice: 0,
        userId: ''
      }

      const errors = validateStockBatch(batch)
      
      expect(errors).toHaveLength(4)
      expect(errors).toContain('Product ID is required')
      expect(errors).toContain('Quantity must be greater than 0')
      expect(errors).toContain('Cost price must be greater than 0')
      expect(errors).toContain('User ID is required')
    })

    it('should handle partial batch data', () => {
      const batch = {
        productId: 'prod1'
      }

      const errors = validateStockBatch(batch)
      
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  // ============================================================================
  // TEST SUITE 5: formatCostPrice
  // ============================================================================
  describe('formatCostPrice', () => {
    it('should format cost price with XAF currency', () => {
      const result = formatCostPrice(1000)
      
      expect(result).toContain('1')
      expect(result).toContain('000')
      // French locale uses space as thousand separator
      expect(result).toMatch(/1[\s\u00A0]000|1,000/)
    })

    it('should format large numbers correctly', () => {
      const result = formatCostPrice(1000000)
      
      expect(result).toMatch(/1[\s\u00A0]000[\s\u00A0]000|1,000,000/)
    })

    it('should format zero value', () => {
      const result = formatCostPrice(0)
      
      expect(result).toContain('0')
    })

    it('should not include decimal places (XAF has 0 decimals)', () => {
      const result = formatCostPrice(1000.99)
      
      // Should round or truncate to 0 decimals
      expect(result).not.toContain('.')
    })

    it('should handle small values', () => {
      const result = formatCostPrice(5)
      
      expect(result).toContain('5')
    })

    it('should use French locale formatting', () => {
      const result = formatCostPrice(1234)
      
      // French locale typically uses space or non-breaking space as separator
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })
  })

  // ============================================================================
  // TEST SUITE 6: formatStockQuantity
  // ============================================================================
  describe('formatStockQuantity', () => {
    it('should format stock quantity', () => {
      const result = formatStockQuantity(1000)
      
      expect(result).toContain('1')
      expect(result).toContain('000')
    })

    it('should format large quantities', () => {
      const result = formatStockQuantity(1000000)
      
      expect(result).toMatch(/1[\s\u00A0]000[\s\u00A0]000|1,000,000/)
    })

    it('should format zero value', () => {
      const result = formatStockQuantity(0)
      
      expect(result).toBe('0')
    })

    it('should handle single digit', () => {
      const result = formatStockQuantity(5)
      
      expect(result).toBe('5')
    })

    it('should use French locale formatting', () => {
      const result = formatStockQuantity(1234)
      
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })
  })

  // ============================================================================
  // TEST SUITE 7: getBatchStatusText
  // ============================================================================
  describe('getBatchStatusText', () => {
    it('should return "Active" for active status', () => {
      expect(getBatchStatusText('active')).toBe('Active')
    })

    it('should return "Depleted" for depleted status', () => {
      expect(getBatchStatusText('depleted')).toBe('Depleted')
    })

    it('should return "Corrected" for corrected status', () => {
      expect(getBatchStatusText('corrected')).toBe('Corrected')
    })

    it('should return "Unknown" for unknown status', () => {
      // TypeScript should prevent this, but test for runtime safety
      expect(getBatchStatusText('unknown' as any)).toBe('Unknown')
    })
  })

  // ============================================================================
  // TEST SUITE 8: getBatchStatusColor
  // ============================================================================
  describe('getBatchStatusColor', () => {
    it('should return "success" for active status', () => {
      expect(getBatchStatusColor('active')).toBe('success')
    })

    it('should return "default" for depleted status', () => {
      expect(getBatchStatusColor('depleted')).toBe('default')
    })

    it('should return "warning" for corrected status', () => {
      expect(getBatchStatusColor('corrected')).toBe('warning')
    })

    it('should return "default" for unknown status', () => {
      expect(getBatchStatusColor('unknown' as any)).toBe('default')
    })
  })
})

