# Git Workflow Guide - Dev to Production

## Branch Structure

- **`prod`** (main/master) - Production-ready code, always stable
- **`dev`** (develop) - Integration branch for new features
- **`release/*`** - Staging branch between dev and prod
- **`feature/*`** - Individual feature development
- **`hotfix/*`** - Urgent production bug fixes

---

## Standard Workflow

### 1. Feature Development

```bash
# Create feature branch from dev
git checkout dev
git pull origin dev
git checkout -b feature/new-functionality

# Work on feature, commit changes
git add .
git commit -m "Add new functionality"

# Merge back to dev when complete
git checkout dev
git merge feature/new-functionality
git push origin dev
```

### 2. Releasing to Production

```bash
# When dev is ready for production, create release branch
git checkout dev
git pull origin dev
git checkout -b release/v1.2.0

# Test and fix any issues on release branch
# Make final adjustments, then merge to prod
git checkout prod
git merge release/v1.2.0
git push origin prod

# Also merge back to dev to keep it updated
git checkout dev
git merge release/v1.2.0
git push origin dev

# Delete release branch
git branch -d release/v1.2.0
```

### 3. Urgent Production Fixes (Hotfix)

```bash
# Create hotfix branch from prod
git checkout prod
git pull origin prod
git checkout -b hotfix/critical-bug-fix

# Fix the bug, commit
git add .
git commit -m "Fix critical bug"

# Merge to prod immediately
git checkout prod
git merge hotfix/critical-bug-fix
git push origin prod

# IMPORTANT: Also merge to dev to keep branches in sync
git checkout dev
git merge hotfix/critical-bug-fix
git push origin dev

# Delete hotfix branch
git branch -d hotfix/critical-bug-fix
```

---

## Key Rules

1. **Never merge dev directly to prod** - Always use a release branch
2. **Always merge hotfixes to both prod AND dev** - Keeps branches synchronized
3. **Test on release branch before production** - Catch issues before users see them
4. **Keep prod stable** - Only tested, approved code goes to prod

---

## Visual Flow

```
Feature Development:
dev → feature/new-feature → dev

Release Process:
dev → release/v1.2.0 → prod
                ↓
               dev (merge back)

Hotfix Process:
prod → hotfix/bug-fix → prod
                ↓
               dev (merge back)
```

---

## Benefits

- ✅ Production stays stable
- ✅ New features can be developed in parallel
- ✅ Urgent fixes don't break ongoing development
- ✅ No conflicts between dev and prod
- ✅ Clear separation of concerns

