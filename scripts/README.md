# Image Migration Scripts

This directory contains scripts for migrating product images from base64 strings stored in Firestore to Firebase Storage URLs.

## Prerequisites

1. **Firebase Service Account Key**: Download from Firebase Console → Project Settings → Service Accounts
2. **Environment Variables**: Ensure your `.env` file contains:
   ```bash
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   FIREBASE_SERVICE_ACCOUNT_PATH=./path/to/serviceAccountKey.json
   ```

## Scripts Overview

### 1. `setupMigration.js`
Sets up the migration environment and checks prerequisites.

```bash
node scripts/setupMigration.js
```

### 2. `analyzeImages.js`
Analyzes current image storage and provides migration estimates.

```bash
node scripts/analyzeImages.js
```

**Output:**
- Total products with images
- Total images to migrate
- Storage size estimates
- Cost estimates
- Migration time estimates

### 3. `migrateImages.js`
Main migration script that converts base64 images to Firebase Storage URLs.

```bash
# Dry run (recommended first)
node scripts/migrateImages.js --dry-run

# Full migration
node scripts/migrateImages.js

# Migrate specific user
node scripts/migrateImages.js --user user123

# Custom batch size
node scripts/migrateImages.js --batch-size 5 --max-concurrent 3
```

**Options:**
- `--dry-run`: Run without making changes
- `--user <userId>`: Migrate only specific user's products
- `--batch-size <number>`: Products per batch (default: 10)
- `--max-concurrent <number>`: Max concurrent uploads (default: 5)
- `--retry-attempts <number>`: Retry attempts (default: 3)

### 4. `verifyMigration.js`
Verifies that the migration was successful and all images are accessible.

```bash
node scripts/verifyMigration.js
```

**Checks:**
- Migration completion rate
- Image accessibility
- Storage usage
- Error detection

## Migration Process

### Step 1: Setup
```bash
node scripts/setupMigration.js
```

### Step 2: Analysis
```bash
node scripts/analyzeImages.js
```

### Step 3: Test Migration
```bash
node scripts/migrateImages.js --dry-run
```

### Step 4: Run Migration
```bash
node scripts/migrateImages.js
```

### Step 5: Verify
```bash
node scripts/verifyMigration.js
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket name | Required |
| `BATCH_SIZE` | Products per batch | 10 |
| `MAX_CONCURRENT` | Max concurrent uploads | 5 |
| `RETRY_ATTEMPTS` | Retry attempts | 3 |
| `DRY_RUN` | Enable dry run mode | false |
| `USER_ID` | Migrate specific user | undefined |

## Error Handling

The migration script includes comprehensive error handling:

- **Retry Logic**: Automatic retry with exponential backoff
- **Batch Processing**: Failed batches don't stop the entire migration
- **Error Logging**: Detailed error logs for troubleshooting
- **Rollback Support**: Ability to rollback individual products

## Monitoring

The migration provides real-time progress updates:

- Current batch being processed
- Success/failure rates
- Processing time estimates
- Storage usage statistics

## Troubleshooting

### Common Issues

1. **Storage Quota Exceeded**
   ```bash
   # Check current usage
   gsutil du -s gs://your-bucket-name
   ```

2. **Permission Denied**
   - Verify service account has Storage Admin role
   - Check Firebase Storage rules

3. **Invalid Base64 Data**
   - Script will skip invalid images and log warnings
   - Check logs for specific product IDs

4. **Network Timeouts**
   - Increase retry attempts
   - Reduce batch size
   - Check network connectivity

### Logs

All scripts generate detailed logs:
- Console output with progress updates
- Error details for failed operations
- Performance metrics
- Final migration report

## Safety Features

- **Dry Run Mode**: Test migration without making changes
- **Batch Processing**: Process products in small batches
- **Rate Limiting**: Avoid Firebase quota limits
- **Error Recovery**: Continue migration despite individual failures
- **Verification**: Post-migration validation

## Performance Tips

1. **Batch Size**: Start with 10, adjust based on performance
2. **Concurrency**: Start with 5, increase if network allows
3. **Timing**: Run during off-peak hours
4. **Monitoring**: Watch Firebase quotas and usage

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review error logs
3. Test with dry-run mode
4. Contact development team

---

**⚠️ Important**: Always test the migration in a staging environment before running in production. Ensure you have a complete backup and rollback plan in place.
