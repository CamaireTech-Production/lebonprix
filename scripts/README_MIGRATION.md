# Database Migration: userId → companyId

This migration updates all database entities to use `companyId` instead of `userId` for data isolation.

## Prerequisites

1. **Backup your database** - This is critical! Always backup before running migrations.
2. **Firebase Service Account** - Ensure `firebase-service-account.json` exists in the project root.
3. **Node.js** - Make sure you have Node.js installed (required for Firebase Admin SDK).

## Step-by-Step Migration Process

### Step 1: Audit Current State (Optional but Recommended)

Run the audit script to see what needs to be migrated:

```bash
npm run migrate-company:audit
```

This will generate a report showing:
- Which collections have records needing migration
- How many records need `companyId` added
- Records that may need smart assignment (multi-company users)

### Step 2: Dry Run (Test Without Changes)

Run the migration in dry-run mode to see what would happen:

```bash
npm run migrate-company:dry-run
```

Or directly:
```bash
node scripts/migrateUserIdToCompanyId.js --dry-run
```

This will:
- ✅ Analyze all records
- ✅ Determine companyId assignments
- ✅ Generate a detailed report
- ❌ **NOT** make any changes to the database

Review the report carefully before proceeding.

### Step 3: Run Actual Migration

Once you've reviewed the dry-run report and are confident:

```bash
npm run migrate-company:run
```

Or using the shell script:
```bash
./scripts/runMigration.sh --run
```

This will:
- ✅ Update all entities with `companyId`
- ✅ Generate a detailed migration report
- ✅ Show progress and statistics

## Collections Migrated

The script migrates these collections (in priority order):

### Priority 1 (Base Entities):
- `products`
- `categories`
- `suppliers`
- `expenses`
- `objectives`
- `orders`
- `financeEntryTypes`
- `expenseTypes`

### Priority 2 (Dependent on Products):
- `stockBatches` (infers from products)
- `stockChanges` (infers from products)
- `sales` (infers from products)

### Priority 3 (Dependent on Sales/Expenses):
- `customers` (infers from sales)
- `financeEntries` (infers from sales/expenses)

## Smart Assignment Strategy

For users with multiple companies, the script uses smart assignment:

1. **Context-based**: Uses related entity's companyId (e.g., stockChanges use product's companyId)
2. **Primary Company**: Uses the user's owner company or first company
3. **Fallback**: Uses the first available company

## Migration Report

After migration, a detailed JSON report is saved to:
```
migration-report-{timestamp}.json
```

The report includes:
- Summary statistics
- Per-collection details
- Assignment methods used
- Orphaned records (if any)
- Errors encountered

## Troubleshooting

### Error: "firebase-service-account.json not found"
- Ensure the Firebase service account JSON file is in the project root
- Download it from Firebase Console → Project Settings → Service Accounts

### Error: "User has no companies"
- These records are marked as "orphaned" in the report
- You may need to manually fix these or create company associations

### Large Database Timeout
- The script processes in batches of 500 records
- If timeouts occur, you can modify `BATCH_SIZE` in the script
- Consider running during low-traffic periods

## Post-Migration Steps

1. **Verify Data**: Check that all entities have `companyId`
2. **Test Application**: Verify data isolation works correctly
3. **Deploy Security Rules**: Update Firestore rules (already done)
4. **Monitor**: Watch for any data access issues

## Rollback

If you need to rollback:
- Restore from your database backup
- The migration report includes all changes made

## Support

If you encounter issues:
1. Check the migration report JSON file
2. Review the error logs in the console
3. Ensure all prerequisites are met
4. Verify your Firebase service account has proper permissions





