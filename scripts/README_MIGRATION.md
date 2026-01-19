# Shop & Warehouse Migration Script

## Overview

This script migrates existing companies to the shop/warehouse system. It supports selecting which Firebase instance to use (old or new) and provides various options for safe migration.

## Prerequisites

1. **Firebase Admin SDK**: Ensure `firebase-admin` is installed
   ```bash
   npm install firebase-admin
   ```

2. **Firebase Keys**: Ensure the following files exist in `firebase-keys/`:
   - `old-firebase-key.json` - Service account key for old Firebase
   - `new-firebase-key.json` - Service account key for new Firebase

## Usage

### Interactive Mode (Recommended)

Run without arguments for interactive prompts:

```bash
npm run migrate:shop-warehouse
```

The script will prompt you to:
1. Select Firebase instance (old or new)
2. Enter admin user ID
3. Confirm migration settings

### Command Line Mode

You can also provide all arguments via command line:

```bash
# Basic usage
node scripts/migrateShopWarehouse.cjs --firebase=old --userId=YOUR_USER_ID

# With options
node scripts/migrateShopWarehouse.cjs --firebase=new --userId=YOUR_USER_ID --dry-run --skip-existing --batchSize=500 --validate
```

### Command Line Arguments

- `--firebase=<old|new>`: Select Firebase instance
  - `old`: Uses `firebase-keys/old-firebase-key.json`
  - `new`: Uses `firebase-keys/new-firebase-key.json`

- `--userId=<USER_ID>`: Admin user ID for migration

- `--dry-run` or `--dryRun`: Test migration without making changes

- `--skip-existing` or `--skipExisting`: Skip companies that already have shops/warehouses

- `--batchSize=<NUMBER>`: Batch size for Firestore operations (default: 500)

- `--validate`: Enable data validation before migration

## Examples

### Test Migration (Dry Run)

```bash
# Test on old Firebase
npm run migrate:shop-warehouse -- --firebase=old --userId=YOUR_USER_ID --dry-run

# Test on new Firebase
npm run migrate:shop-warehouse -- --firebase=new --userId=YOUR_USER_ID --dry-run
```

### Run Actual Migration

```bash
# Migrate old Firebase
npm run migrate:shop-warehouse -- --firebase=old --userId=YOUR_USER_ID

# Migrate new Firebase
npm run migrate:shop-warehouse -- --firebase=new --userId=YOUR_USER_ID
```

### With Custom Options

```bash
# Small batch size for testing
npm run migrate:shop-warehouse -- --firebase=old --userId=YOUR_USER_ID --batchSize=100

# Skip existing, validate data
npm run migrate:shop-warehouse -- --firebase=new --userId=YOUR_USER_ID --skip-existing --validate
```

## What the Script Does

1. **Creates Default Shop**: Creates "Boutique Principale" if it doesn't exist
2. **Creates Default Warehouse**: Creates "Entrepôt Principal" if it doesn't exist
3. **Migrates Stock Batches**: Assigns stock batches without `locationType` to default shop
4. **Migrates Sales**: Assigns sales without `shopId` to default shop

## Safety Features

- **Dry Run Mode**: Test migration without making changes
- **Skip Existing**: Skip companies that already have shops/warehouses
- **Batch Processing**: Process in batches to avoid Firestore limits
- **Error Handling**: Continue migration even if some companies fail
- **Progress Tracking**: Real-time progress updates
- **Summary Report**: Detailed summary at the end

## Output

The script provides:
- Real-time progress updates
- Success/error messages per company
- Final summary with statistics
- List of errors (if any)
- List of warnings (if any)

## Troubleshooting

### Error: Firebase key file not found

**Solution**: Ensure `firebase-keys/old-firebase-key.json` and `firebase-keys/new-firebase-key.json` exist

### Error: Permission denied

**Solution**: Ensure the service account has proper Firestore permissions

### Error: Batch size too large

**Solution**: Reduce batch size (Firestore limit is 500 operations per batch)

### Migration takes too long

**Solution**: 
- Use larger batch size (up to 500)
- Run during off-peak hours
- Process companies in smaller groups

## Best Practices

1. **Always test first**: Run with `--dry-run` before actual migration
2. **Backup data**: Export Firestore data before migration
3. **Start small**: Test with a few companies first
4. **Monitor progress**: Watch for errors during migration
5. **Review summary**: Check the final summary for any issues

## Notes

- The script uses Firebase Admin SDK (server-side)
- It requires Node.js to run
- It can be run multiple times safely (idempotent)
- Default shop/warehouse are protected from deletion
- Migration is atomic per company (all or nothing)

## Support

For issues or questions:
1. Check error messages in the console
2. Review the migration summary
3. Check Firestore console for data state
4. Contact development team if needed
