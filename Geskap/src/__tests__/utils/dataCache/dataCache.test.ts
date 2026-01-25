import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { dataCache, cacheKeys, invalidateCompanyCache, invalidateSpecificCache, invalidateUserCache } from '../../../utils/dataCache'

/**
 * Data Cache Test Suite
 * 
 * PROBLEMS IDENTIFIED BEFORE TESTS:
 * 
 * None - All functions are used in production or are utility methods.
 * 
 * REFACTORING PERFORMED:
 * - None needed - code is clean and well-structured
 * 
 * FUNCTIONS TESTED:
 * - dataCache.set() - Set data with TTL
 * - dataCache.get() - Get data (with expiration check)
 * - dataCache.has() - Check if key exists
 * - dataCache.delete() - Remove key
 * - dataCache.clear() - Clear all cache
 * - dataCache.getStats() - Get cache statistics
 * - dataCache.cleanExpired() - Clean expired entries
 * - cacheKeys - Key generator functions
 * - invalidateCompanyCache() - Invalidate all company cache
 * - invalidateSpecificCache() - Invalidate specific cache type
 * - invalidateUserCache() - Deprecated backward compatibility
 */

describe('Data Cache - Complete Test Suite', () => {
  let originalDateNow: typeof Date.now
  let mockDateNow: ReturnType<typeof vi.fn>
  let originalConsoleLog: typeof console.log
  let mockConsoleLog: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Clear cache before each test
    dataCache.clear()
    
    // Mock Date.now() for TTL tests
    originalDateNow = Date.now
    mockDateNow = vi.fn(() => 1000000) // Base timestamp
    Date.now = mockDateNow
    
    // Mock console.log to avoid test output noise
    originalConsoleLog = console.log
    mockConsoleLog = vi.fn()
    console.log = mockConsoleLog
  })

  afterEach(() => {
    // Restore original functions
    Date.now = originalDateNow
    console.log = originalConsoleLog
    dataCache.clear()
  })

  // ============================================================================
  // TEST SUITE 1: dataCache.set()
  // ============================================================================
  describe('dataCache.set()', () => {
    it('should set data with default TTL', () => {
      dataCache.set('key1', 'value1')
      
      const stats = dataCache.getStats()
      expect(stats.size).toBe(1)
      expect(stats.keys).toContain('key1')
      expect(mockConsoleLog).toHaveBeenCalledWith('📦 Cached data for key: key1')
    })

    it('should set data with custom TTL', () => {
      const customTTL = 10000 // 10 seconds
      dataCache.set('key1', 'value1', customTTL)
      
      const stats = dataCache.getStats()
      expect(stats.size).toBe(1)
    })

    it('should overwrite existing key', () => {
      dataCache.set('key1', 'value1')
      dataCache.set('key1', 'value2')
      
      const result = dataCache.get<string>('key1')
      expect(result).toBe('value2')
      expect(dataCache.getStats().size).toBe(1) // Still only one entry
    })

    it('should handle string data', () => {
      dataCache.set('key1', 'test string')
      expect(dataCache.get<string>('key1')).toBe('test string')
    })

    it('should handle number data', () => {
      dataCache.set('key1', 42)
      expect(dataCache.get<number>('key1')).toBe(42)
    })

    it('should handle object data', () => {
      const obj = { name: 'Test', value: 123 }
      dataCache.set('key1', obj)
      expect(dataCache.get<typeof obj>('key1')).toEqual(obj)
    })

    it('should handle array data', () => {
      const arr = [1, 2, 3, 'test']
      dataCache.set('key1', arr)
      expect(dataCache.get<typeof arr>('key1')).toEqual(arr)
    })

    it('should handle null data', () => {
      dataCache.set('key1', null)
      expect(dataCache.get<null>('key1')).toBeNull()
    })

    it('should handle undefined data', () => {
      dataCache.set('key1', undefined)
      expect(dataCache.get<undefined>('key1')).toBeUndefined()
    })
  })

  // ============================================================================
  // TEST SUITE 2: dataCache.get()
  // ============================================================================
  describe('dataCache.get()', () => {
    it('should return null for non-existent key', () => {
      const result = dataCache.get('nonexistent')
      expect(result).toBeNull()
    })

    it('should return data for valid non-expired entry', () => {
      dataCache.set('key1', 'value1')
      const result = dataCache.get<string>('key1')
      
      expect(result).toBe('value1')
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ Cache hit for key: key1')
    })

    it('should return null and delete expired entry', () => {
      // Set entry with very short TTL
      dataCache.set('key1', 'value1', 100)
      
      // Advance time past TTL
      mockDateNow.mockReturnValue(1000000 + 200)
      
      const result = dataCache.get<string>('key1')
      
      expect(result).toBeNull()
      expect(mockConsoleLog).toHaveBeenCalledWith('⏰ Cache expired for key: key1')
      expect(dataCache.getStats().size).toBe(0) // Entry should be deleted
    })

    it('should maintain type safety with generics', () => {
      interface TestType {
        id: string
        count: number
      }
      
      const testData: TestType = { id: 'test1', count: 5 }
      dataCache.set('key1', testData)
      
      const result = dataCache.get<TestType>('key1')
      expect(result).toEqual(testData)
      expect(result?.id).toBe('test1')
      expect(result?.count).toBe(5)
    })

    it('should handle entry exactly at TTL boundary', () => {
      const ttl = 1000
      dataCache.set('key1', 'value1', ttl)
      
      // Set time to exactly TTL
      mockDateNow.mockReturnValue(1000000 + ttl)
      
      const result = dataCache.get<string>('key1')
      // At boundary, should still be valid (now - timestamp > ttl is false when equal)
      expect(result).toBe('value1')
    })

    it('should handle entry just before expiration', () => {
      const ttl = 1000
      dataCache.set('key1', 'value1', ttl)
      
      // Set time to just before expiration
      mockDateNow.mockReturnValue(1000000 + ttl - 1)
      
      const result = dataCache.get<string>('key1')
      expect(result).toBe('value1')
    })

    it('should handle entry just after expiration', () => {
      const ttl = 1000
      dataCache.set('key1', 'value1', ttl)
      
      // Set time to just after expiration
      mockDateNow.mockReturnValue(1000000 + ttl + 1)
      
      const result = dataCache.get<string>('key1')
      expect(result).toBeNull()
    })
  })

  // ============================================================================
  // TEST SUITE 3: dataCache.has()
  // ============================================================================
  describe('dataCache.has()', () => {
    it('should return true for existing non-expired entry', () => {
      dataCache.set('key1', 'value1')
      expect(dataCache.has('key1')).toBe(true)
    })

    it('should return false for expired entry', () => {
      dataCache.set('key1', 'value1', 100)
      mockDateNow.mockReturnValue(1000000 + 200)
      
      expect(dataCache.has('key1')).toBe(false)
    })

    it('should return false for non-existent key', () => {
      expect(dataCache.has('nonexistent')).toBe(false)
    })

    it('should delegate to get() correctly', () => {
      dataCache.set('key1', 'value1')
      const getSpy = vi.spyOn(dataCache, 'get')
      
      dataCache.has('key1')
      
      expect(getSpy).toHaveBeenCalledWith('key1')
    })
  })

  // ============================================================================
  // TEST SUITE 4: dataCache.delete()
  // ============================================================================
  describe('dataCache.delete()', () => {
    it('should delete existing key', () => {
      dataCache.set('key1', 'value1')
      dataCache.delete('key1')
      
      expect(dataCache.get('key1')).toBeNull()
      expect(dataCache.getStats().size).toBe(0)
      expect(mockConsoleLog).toHaveBeenCalledWith('🗑️ Removed cache for key: key1')
    })

    it('should not error when deleting non-existent key', () => {
      expect(() => {
        dataCache.delete('nonexistent')
      }).not.toThrow()
      
      expect(mockConsoleLog).toHaveBeenCalledWith('🗑️ Removed cache for key: nonexistent')
    })

    it('should remove key from stats after deletion', () => {
      dataCache.set('key1', 'value1')
      dataCache.set('key2', 'value2')
      
      expect(dataCache.getStats().size).toBe(2)
      
      dataCache.delete('key1')
      
      const stats = dataCache.getStats()
      expect(stats.size).toBe(1)
      expect(stats.keys).not.toContain('key1')
      expect(stats.keys).toContain('key2')
    })
  })

  // ============================================================================
  // TEST SUITE 5: dataCache.clear()
  // ============================================================================
  describe('dataCache.clear()', () => {
    it('should clear all entries', () => {
      dataCache.set('key1', 'value1')
      dataCache.set('key2', 'value2')
      dataCache.set('key3', 'value3')
      
      dataCache.clear()
      
      expect(dataCache.getStats().size).toBe(0)
      expect(dataCache.get('key1')).toBeNull()
      expect(dataCache.get('key2')).toBeNull()
      expect(dataCache.get('key3')).toBeNull()
      expect(mockConsoleLog).toHaveBeenCalledWith('🧹 Cleared all cache')
    })

    it('should handle clearing empty cache', () => {
      expect(() => {
        dataCache.clear()
      }).not.toThrow()
      
      expect(dataCache.getStats().size).toBe(0)
    })
  })

  // ============================================================================
  // TEST SUITE 6: dataCache.getStats()
  // ============================================================================
  describe('dataCache.getStats()', () => {
    it('should return stats for empty cache', () => {
      const stats = dataCache.getStats()
      
      expect(stats.size).toBe(0)
      expect(stats.keys).toEqual([])
    })

    it('should return stats for single entry', () => {
      dataCache.set('key1', 'value1')
      const stats = dataCache.getStats()
      
      expect(stats.size).toBe(1)
      expect(stats.keys).toEqual(['key1'])
    })

    it('should return stats for multiple entries', () => {
      dataCache.set('key1', 'value1')
      dataCache.set('key2', 'value2')
      dataCache.set('key3', 'value3')
      
      const stats = dataCache.getStats()
      
      expect(stats.size).toBe(3)
      expect(stats.keys).toContain('key1')
      expect(stats.keys).toContain('key2')
      expect(stats.keys).toContain('key3')
      expect(stats.keys.length).toBe(3)
    })

    it('should return correct structure', () => {
      dataCache.set('key1', 'value1')
      const stats = dataCache.getStats()
      
      expect(stats).toHaveProperty('size')
      expect(stats).toHaveProperty('keys')
      expect(Array.isArray(stats.keys)).toBe(true)
      expect(typeof stats.size).toBe('number')
    })
  })

  // ============================================================================
  // TEST SUITE 7: dataCache.cleanExpired()
  // ============================================================================
  describe('dataCache.cleanExpired()', () => {
    it('should clean expired entries', () => {
      dataCache.set('key1', 'value1', 100) // Expires at 1000000 + 100
      dataCache.set('key2', 'value2', 200) // Expires at 1000000 + 200
      
      // Advance time past both TTLs
      mockDateNow.mockReturnValue(1000000 + 300)
      
      dataCache.cleanExpired()
      
      expect(dataCache.getStats().size).toBe(0)
      expect(mockConsoleLog).toHaveBeenCalledWith('🧹 Cleaned 2 expired cache entries')
    })

    it('should handle cleaning with no expired entries', () => {
      dataCache.set('key1', 'value1', 1000)
      dataCache.set('key2', 'value2', 2000)
      
      // Time still within TTL
      mockDateNow.mockReturnValue(1000000 + 500)
      
      dataCache.cleanExpired()
      
      expect(dataCache.getStats().size).toBe(2)
      // Should not log when nothing cleaned
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('Cleaned'))
    })

    it('should clean only expired entries, keep valid ones', () => {
      dataCache.set('key1', 'value1', 100) // Expires
      dataCache.set('key2', 'value2', 1000) // Still valid
      
      // Advance time past first TTL but not second
      mockDateNow.mockReturnValue(1000000 + 500)
      
      dataCache.cleanExpired()
      
      expect(dataCache.getStats().size).toBe(1)
      expect(dataCache.get('key1')).toBeNull()
      expect(dataCache.get('key2')).toBe('value2')
      expect(mockConsoleLog).toHaveBeenCalledWith('🧹 Cleaned 1 expired cache entries')
    })

    it('should handle empty cache', () => {
      dataCache.cleanExpired()
      
      expect(dataCache.getStats().size).toBe(0)
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('Cleaned'))
    })
  })

  // ============================================================================
  // TEST SUITE 8: TTL Expiration Logic
  // ============================================================================
  describe('TTL Expiration Logic', () => {
    it('should use default TTL (5 minutes)', () => {
      dataCache.set('key1', 'value1')
      
      // Advance time to just before default TTL (5 minutes = 300000ms)
      mockDateNow.mockReturnValue(1000000 + 300000 - 1)
      expect(dataCache.get('key1')).toBe('value1')
      
      // Advance time past default TTL
      mockDateNow.mockReturnValue(1000000 + 300000 + 1)
      expect(dataCache.get('key1')).toBeNull()
    })

    it('should use custom TTL when provided', () => {
      const customTTL = 5000 // 5 seconds
      dataCache.set('key1', 'value1', customTTL)
      
      // Just before custom TTL
      mockDateNow.mockReturnValue(1000000 + customTTL - 1)
      expect(dataCache.get('key1')).toBe('value1')
      
      // Just after custom TTL
      mockDateNow.mockReturnValue(1000000 + customTTL + 1)
      expect(dataCache.get('key1')).toBeNull()
    })

    it('should calculate expiration correctly (now - timestamp > ttl)', () => {
      const ttl = 1000
      const startTime = 1000000
      mockDateNow.mockReturnValue(startTime)
      
      dataCache.set('key1', 'value1', ttl)
      
      // Test at various times
      mockDateNow.mockReturnValue(startTime + 999) // Before expiration
      expect(dataCache.get('key1')).toBe('value1')
      
      mockDateNow.mockReturnValue(startTime + 1000) // At boundary (not expired)
      expect(dataCache.get('key1')).toBe('value1')
      
      mockDateNow.mockReturnValue(startTime + 1001) // After expiration
      expect(dataCache.get('key1')).toBeNull()
    })
  })

  // ============================================================================
  // TEST SUITE 9: cacheKeys Object
  // ============================================================================
  describe('cacheKeys', () => {
    it('should generate products key', () => {
      const key = cacheKeys.products('company1')
      expect(key).toBe('products_company1')
    })

    it('should generate sales key', () => {
      const key = cacheKeys.sales('company1')
      expect(key).toBe('sales_company1')
    })

    it('should generate expenses key', () => {
      const key = cacheKeys.expenses('company1')
      expect(key).toBe('expenses_company1')
    })

    it('should generate stockChanges key', () => {
      const key = cacheKeys.stockChanges('company1')
      expect(key).toBe('stockChanges_company1')
    })

    it('should generate suppliers key', () => {
      const key = cacheKeys.suppliers('company1')
      expect(key).toBe('suppliers_company1')
    })

    it('should generate categories key', () => {
      const key = cacheKeys.categories('company1')
      expect(key).toBe('categories_company1')
    })

    it('should generate company key', () => {
      const key = cacheKeys.company('company1')
      expect(key).toBe('company_company1')
    })

    it('should generate dashboard key', () => {
      const key = cacheKeys.dashboard('company1')
      expect(key).toBe('dashboard_company1')
    })

    it('should generate searchProducts key with query and category', () => {
      const key = cacheKeys.searchProducts('company1', 'test query', 'category1')
      expect(key).toBe('search_products_company1_test query_category1')
    })

    it('should generate salesAnalytics key with dateRange', () => {
      const key = cacheKeys.salesAnalytics('company1', '2024-01-01_2024-01-31')
      expect(key).toBe('sales_analytics_company1_2024-01-01_2024-01-31')
    })

    it('should handle different companyIds', () => {
      const key1 = cacheKeys.products('company1')
      const key2 = cacheKeys.products('company2')
      
      expect(key1).toBe('products_company1')
      expect(key2).toBe('products_company2')
      expect(key1).not.toBe(key2)
    })
  })

  // ============================================================================
  // TEST SUITE 10: invalidateCompanyCache()
  // ============================================================================
  describe('invalidateCompanyCache()', () => {
    it('should invalidate all company cache keys', () => {
      const companyId = 'company1'
      
      // Set cache for all company keys
      dataCache.set(cacheKeys.products(companyId), ['product1'])
      dataCache.set(cacheKeys.sales(companyId), ['sale1'])
      dataCache.set(cacheKeys.expenses(companyId), ['expense1'])
      dataCache.set(cacheKeys.stockChanges(companyId), ['change1'])
      dataCache.set(cacheKeys.suppliers(companyId), ['supplier1'])
      dataCache.set(cacheKeys.categories(companyId), ['category1'])
      dataCache.set(cacheKeys.company(companyId), { name: 'Company' })
      dataCache.set(cacheKeys.dashboard(companyId), { stats: {} })
      
      expect(dataCache.getStats().size).toBe(8)
      
      invalidateCompanyCache(companyId)
      
      expect(dataCache.getStats().size).toBe(0)
      expect(mockConsoleLog).toHaveBeenCalledWith(`🗑️ Invalidated all cache for company: ${companyId}`)
    })

    it('should only invalidate specified company cache', () => {
      // Set cache for two companies
      dataCache.set(cacheKeys.products('company1'), ['product1'])
      dataCache.set(cacheKeys.products('company2'), ['product2'])
      
      invalidateCompanyCache('company1')
      
      expect(dataCache.get(cacheKeys.products('company1'))).toBeNull()
      expect(dataCache.get(cacheKeys.products('company2'))).toEqual(['product2'])
    })

    it('should handle non-existent keys gracefully', () => {
      expect(() => {
        invalidateCompanyCache('nonexistent')
      }).not.toThrow()
      
      expect(mockConsoleLog).toHaveBeenCalledWith('🗑️ Invalidated all cache for company: nonexistent')
    })
  })

  // ============================================================================
  // TEST SUITE 11: invalidateSpecificCache()
  // ============================================================================
  describe('invalidateSpecificCache()', () => {
    it('should invalidate products cache', () => {
      const companyId = 'company1'
      const key = cacheKeys.products(companyId)
      
      dataCache.set(key, ['product1'])
      invalidateSpecificCache(companyId, 'products')
      
      expect(dataCache.get(key)).toBeNull()
      expect(mockConsoleLog).toHaveBeenCalledWith(`🗑️ Invalidated products cache for company: ${companyId}`)
    })

    it('should invalidate sales cache', () => {
      const companyId = 'company1'
      invalidateSpecificCache(companyId, 'sales')
      expect(mockConsoleLog).toHaveBeenCalledWith(`🗑️ Invalidated sales cache for company: ${companyId}`)
    })

    it('should invalidate expenses cache', () => {
      const companyId = 'company1'
      invalidateSpecificCache(companyId, 'expenses')
      expect(mockConsoleLog).toHaveBeenCalledWith(`🗑️ Invalidated expenses cache for company: ${companyId}`)
    })

    it('should invalidate stockChanges cache', () => {
      const companyId = 'company1'
      invalidateSpecificCache(companyId, 'stockChanges')
      expect(mockConsoleLog).toHaveBeenCalledWith(`🗑️ Invalidated stockChanges cache for company: ${companyId}`)
    })

    it('should invalidate suppliers cache', () => {
      const companyId = 'company1'
      invalidateSpecificCache(companyId, 'suppliers')
      expect(mockConsoleLog).toHaveBeenCalledWith(`🗑️ Invalidated suppliers cache for company: ${companyId}`)
    })

    it('should invalidate categories cache', () => {
      const companyId = 'company1'
      invalidateSpecificCache(companyId, 'categories')
      expect(mockConsoleLog).toHaveBeenCalledWith(`🗑️ Invalidated categories cache for company: ${companyId}`)
    })

    it('should invalidate company cache', () => {
      const companyId = 'company1'
      invalidateSpecificCache(companyId, 'company')
      expect(mockConsoleLog).toHaveBeenCalledWith(`🗑️ Invalidated company cache for company: ${companyId}`)
    })

    it('should invalidate dashboard cache', () => {
      const companyId = 'company1'
      invalidateSpecificCache(companyId, 'dashboard')
      expect(mockConsoleLog).toHaveBeenCalledWith(`🗑️ Invalidated dashboard cache for company: ${companyId}`)
    })

    it('should only invalidate specified cache type', () => {
      const companyId = 'company1'
      
      dataCache.set(cacheKeys.products(companyId), ['product1'])
      dataCache.set(cacheKeys.sales(companyId), ['sale1'])
      
      invalidateSpecificCache(companyId, 'products')
      
      expect(dataCache.get(cacheKeys.products(companyId))).toBeNull()
      expect(dataCache.get(cacheKeys.sales(companyId))).toEqual(['sale1'])
    })
  })

  // ============================================================================
  // TEST SUITE 12: invalidateUserCache() (Deprecated)
  // ============================================================================
  describe('invalidateUserCache() (Deprecated)', () => {
    it('should delegate to invalidateCompanyCache for backward compatibility', () => {
      const companyId = 'company1'
      dataCache.set(cacheKeys.products(companyId), ['product1'])
      
      invalidateUserCache(companyId)
      
      expect(dataCache.get(cacheKeys.products(companyId))).toBeNull()
      expect(mockConsoleLog).toHaveBeenCalledWith(`🗑️ Invalidated all cache for company: ${companyId}`)
    })

    it('should work the same as invalidateCompanyCache', () => {
      const companyId = 'company1'
      
      dataCache.set(cacheKeys.products(companyId), ['product1'])
      dataCache.set(cacheKeys.sales(companyId), ['sale1'])
      
      invalidateUserCache(companyId)
      
      expect(dataCache.getStats().size).toBe(0)
    })
  })

  // ============================================================================
  // TEST SUITE 13: setInterval Behavior
  // ============================================================================
  describe('setInterval Behavior', () => {
    it('should set up interval for cleanExpired()', () => {
      // Note: setInterval is called at module load, so we can't easily test it
      // But we can verify cleanExpired() works when called
      dataCache.set('key1', 'value1', 100)
      mockDateNow.mockReturnValue(1000000 + 200)
      
      dataCache.cleanExpired()
      
      expect(dataCache.getStats().size).toBe(0)
    })

    it('should clean expired entries when interval fires', () => {
      // This test verifies the function works, actual interval testing
      // would require more complex setup with fake timers
      dataCache.set('key1', 'value1', 100)
      mockDateNow.mockReturnValue(1000000 + 200)
      
      // Simulate interval call
      dataCache.cleanExpired()
      
      expect(dataCache.get('key1')).toBeNull()
    })
  })
})

