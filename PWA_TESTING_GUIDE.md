# PWA Testing Guide - Le Bon Prix

## 🚀 Current Status
- ✅ Development server running on: `http://localhost:3011/`
- ✅ PWA components implemented
- ✅ Enhanced install prompt with debugging
- ✅ Build files generated successfully

## 🔧 Testing Steps

### 1. **Open Your App**
Go to: `http://localhost:3011/`

### 2. **Check PWA Debug Info**
- Look for the **bug icon (🐛)** in the bottom-right corner
- Click it to see PWA status
- Check if all items are green:
  - ✅ Service Worker
  - ✅ Manifest  
  - ✅ HTTPS/Localhost
  - ✅ Install Prompt Available

### 3. **Look for Install Prompt**
- Wait 3 seconds after page load
- Look for red install prompt at bottom of screen
- Click "Installer Maintenant" button

### 4. **Check Browser Console**
Press F12 → Console tab and look for:
- Service worker registration messages
- PWA status logs
- Any error messages

## 🛠️ Manual Installation Methods

### Chrome/Edge Desktop:
1. Look for **install icon** in address bar (usually a download/plus icon)
2. Or go to **Menu (⋮)** → **"Install Le Bon Prix"**
3. Or press **F12** → **Application** → **Manifest** → **"Add to homescreen"**

### Chrome Mobile:
1. Tap **Menu (⋮)** → **"Add to Home screen"**
2. Or tap **Menu (⋮)** → **"Install app"**

### Firefox:
1. Tap **Menu (⋮)** → **"Install"**

### Safari (iOS):
1. Tap **Share** button
2. Scroll down → **"Add to Home Screen"**

## 🔍 Troubleshooting

### If Install Prompt Doesn't Appear:
1. **Check debug info** (bug icon)
2. **Clear browser data**: 
   - Press F12 → Application → Storage → Clear storage
3. **Try different browser** (Chrome/Edge work best)
4. **Check console errors**

### If Install Button Doesn't Work:
1. **Check console** for error messages
2. **Try manual installation** (see methods above)
3. **Verify all PWA requirements** are met

### Common Issues:
- **Service Worker**: May not register in development mode
- **Manifest**: Should load without errors
- **Icons**: Placeholder icons should work for testing
- **HTTPS**: Not required for localhost

## 📱 Expected Behavior

### Successful Installation:
1. Install prompt appears after 3 seconds
2. Clicking install shows browser's native install dialog
3. App installs and appears on home screen/desktop
4. App opens in standalone mode (no browser UI)

### Debug Info Should Show:
- ✅ Service Worker: Green (may be yellow in dev mode)
- ✅ Manifest: Green
- ✅ HTTPS/Localhost: Green
- ✅ Install Prompt Available: Green (when installable)

## 🎯 Next Steps

1. **Test the current setup** using the steps above
2. **Check debug info** to see what's working
3. **Try manual installation** if automatic doesn't work
4. **Report what you see** in the debug info

The enhanced install prompt now shows detailed PWA status and will guide you through any issues!
