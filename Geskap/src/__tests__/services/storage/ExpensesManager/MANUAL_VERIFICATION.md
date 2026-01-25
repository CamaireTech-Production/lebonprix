# Manual Verification Guide
## ExpensesManager - Storage Layer

**Test File**: `ExpensesManager.test.ts`  
**Source File**: `src/services/storage/ExpensesManager.ts`  
**Last Updated**: 2024-11-17

---

## Overview

ExpensesManager handles localStorage caching for expenses data. It provides TTL-based caching with sync detection.

---

## Functions to Verify

1. `getKey()` - Storage key generation
2. `load()` - Load from localStorage
3. `save()` - Save to localStorage
4. `needsSync()` - Check if sync needed
5. `hasChanged()` - Detect data changes
6. `updateLastSync()` - Update sync timestamp
7. `getLastSync()` - Get sync timestamp
8. `remove()` - Remove from localStorage
9. `exists()` - Check existence
10. `getStorageInfo()` - Get complete info

---

## UI Testing Steps

### 1. Caching Behavior

**Location**: Expenses page

1. Load expenses page → Data cached in localStorage
2. Refresh page → Data loaded from cache (faster)
3. Wait 5+ minutes → Cache expires, fresh data loaded
4. Check Network tab → Fewer requests when cached

**Expected**: Faster loading when cached, fresh data after TTL

---

### 2. Sync Detection

**Location**: Expenses page → Sync indicator

1. View expenses → Sync indicator shows status
2. Wait 4+ minutes → Indicator shows "needs sync"
3. Manual refresh → Sync happens

**Expected**: Sync indicator reflects cache freshness

---

## Console Logs

No specific console logs for ExpensesManager (uses LocalStorageService internally).

---

## Database Verification

Not applicable - ExpensesManager only handles localStorage caching.

---

## Edge Cases to Test

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| No cache | First load | Load from server |
| Expired cache | 6+ minutes old | Load from server |
| Fresh cache | < 4 minutes | Use cache |
| Large data | > 2MB | Skip cache, log warning |

---

## Test Checklist

- [ ] Expenses cached correctly
- [ ] Cache expires after 5 minutes
- [ ] Sync detection works
- [ ] Data changes detected
- [ ] Storage info accurate

---

**Last Verified**: [Date]  
**Status**: ✅ All tests passing

