# Manual Verification Guide
## Data Cache - src/utils/dataCache.ts

**Test File**: `dataCache.test.ts`  
**Source File**: `src/utils/dataCache.ts`  
**Last Updated**: 2024-11-17

---

## Overview

Internal cache utility for storing data with TTL. Used by useFirestore hooks to cache categories, stockChanges, and suppliers. Cache is transparent to users but improves performance.

---

## Functions Tested

1. `dataCache.set()` - Store data with TTL
2. `dataCache.get()` - Retrieve cached data
3. `dataCache.has()` - Check if key exists
4. `dataCache.delete()` - Remove key
5. `dataCache.clear()` - Clear all cache
6. `dataCache.getStats()` - Get cache statistics
7. `dataCache.cleanExpired()` - Remove expired entries
8. `cacheKeys` - Key generators
9. `invalidateCompanyCache()` - Clear all company cache
10. `invalidateSpecificCache()` - Clear specific cache type

---

## Quick Test Steps

### 1. Cache Performance (Categories)
1. Go to **Products** → **Categories** tab
2. First load: Data fetched from Firestore
3. Navigate away and back
4. **Check**: Console log "✅ Cache hit for key: categories_{companyId}"
5. **Check**: Categories load instantly (from cache)

### 2. Cache Performance (Stock Changes)
1. Go to **Products** → Select product
2. First load: Stock changes fetched
3. Navigate away and back
4. **Check**: Console log "✅ Cache hit for key: stockChanges_{companyId}"
5. **Check**: Stock changes load instantly

### 3. Cache Invalidation (Product Update)
1. Go to **Products** → Edit product → Save
2. **Check**: Console log "🗑️ Invalidated products cache for company: {companyId}"
3. **Check**: Next product list fetch gets fresh data

### 4. Cache Expiration
1. Wait 3+ minutes (cache TTL for stockChanges)
2. Navigate to product with stock changes
3. **Check**: Console log "⏰ Cache expired for key: stockChanges_{companyId}"
4. **Check**: Fresh data fetched from Firestore

---

## Console Logs

```javascript
// Cache operations
console.log('📦 Cached data for key:', key)
console.log('✅ Cache hit for key:', key)
console.log('⏰ Cache expired for key:', key)
console.log('🗑️ Removed cache for key:', key)
console.log('🧹 Cleared all cache')
console.log('🧹 Cleaned N expired cache entries')

// Cache invalidation
console.log('🗑️ Invalidated all cache for company:', companyId)
console.log('🗑️ Invalidated products cache for company:', companyId)
```

---

## Performance Indicators

- **First Load**: Data fetched from Firestore (slower)
- **Cached Load**: Data from cache (instant)
- **Cache Hit**: Console shows "✅ Cache hit"
- **Cache Miss**: Console shows "⏰ Cache expired" or no cache log

---

## Quick Checklist

- [ ] Categories load faster on second visit
- [ ] Stock changes load faster on second visit
- [ ] Suppliers load faster on second visit
- [ ] Cache invalidated when product updated
- [ ] Cache invalidated when sale created
- [ ] Console logs show cache operations
- [ ] Expired cache automatically cleaned

---

**Last Verified**: 2024-11-17  
**Status**: ✅ All functions tested

