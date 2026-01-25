# 🎨 Template Selection Fix - Enable for All Restaurants

## Problem
Restaurant users are seeing "Template Customization Disabled" because the `templateSelection` feature is not enabled for existing restaurants.

## Solution
I've implemented multiple ways to enable template selection for all restaurants:

### 1. **Admin Dashboard Quick Action** (Recommended)
- Go to **Admin Dashboard** → **Admin Overview**
- Look for the **"🚀 Quick Actions"** section at the top
- Click **"🎨 Enable Templates for All Restaurants"** button
- Confirm the action
- This will enable template selection for all existing restaurants

### 2. **Admin Restaurants Page**
- Go to **Admin Dashboard** → **Restaurants**
- Click the **"🎨 Enable Templates for All"** button in the top right
- Confirm the action

### 3. **Manual Script** (If needed)
- Run the script: `node src/scripts/enableTemplateSelectionImmediate.cjs`
- Make sure to update the Firebase config in the script first

## What This Does
- Enables `templateSelection: true` for all existing restaurants
- Allows restaurant users to access template customization immediately
- Logs the action for audit purposes
- Shows success message with count of updated restaurants

## After Enabling
- Restaurant users can now access `/template-customisation`
- They can customize templates for Menu, Order, and Daily Menu pages
- Full visual editor functionality is available
- All customizations are saved automatically

## Default for New Restaurants
- New restaurants are now created with `templateSelection: true` by default
- No manual intervention needed for new restaurants

## Verification
To verify it's working:
1. Go to any restaurant's template customization page
2. Should see the visual editor instead of "Template Customization Disabled"
3. Restaurant users can now customize their templates

---
**Status**: ✅ Fixed - Template selection can now be enabled for all restaurants with one click!
