#!/bin/bash

# Migration Script Runner
# This script helps you run the userId to companyId migration safely

echo "🚀 userId → companyId Migration Script"
echo "======================================"
echo ""

# Check if firebase-service-account.json exists
if [ ! -f "firebase-service-account.json" ]; then
    echo "❌ Error: firebase-service-account.json not found!"
    echo "Please make sure you have the Firebase service account JSON file in the project root."
    exit 1
fi

# Check if dry-run flag is passed
if [ "$1" == "--dry-run" ]; then
    echo "🔍 Running in DRY RUN mode (no changes will be made)"
    echo ""
    node scripts/migrateUserIdToCompanyId.js --dry-run
elif [ "$1" == "--run" ]; then
    echo "⚠️  WARNING: This will update your database!"
    echo "Make sure you have:"
    echo "  1. Backed up your Firestore database"
    echo "  2. Tested the migration on a staging environment"
    echo "  3. Reviewed the dry-run report"
    echo ""
    read -p "Type 'YES' to continue: " confirm
    if [ "$confirm" != "YES" ]; then
        echo "Migration cancelled."
        exit 0
    fi
    echo ""
    echo "🚀 Running migration..."
    node scripts/migrateUserIdToCompanyId.js
else
    echo "Usage:"
    echo "  ./scripts/runMigration.sh --dry-run    # Test migration without making changes"
    echo "  ./scripts/runMigration.sh --run        # Run actual migration"
    echo ""
    echo "Recommended steps:"
    echo "  1. First run: ./scripts/runMigration.sh --dry-run"
    echo "  2. Review the migration report"
    echo "  3. If everything looks good, run: ./scripts/runMigration.sh --run"
    exit 0
fi


