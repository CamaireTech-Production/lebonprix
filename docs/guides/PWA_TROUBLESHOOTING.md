# PWA Installation Troubleshooting Guide

## 🔧 Common Issues and Solutions

### Issue: Install Button Doesn't Work

#### 1. **Check Browser Console**
Open your browser's Developer Tools (F12) and check the Console tab for any errors. Look for:
- Service worker registration errors
- Manifest loading errors
- JavaScript errors

#### 2. **Verify PWA Requirements**
Your app must meet these criteria to be installable:
- ✅ **HTTPS or localhost** - Required for PWA
- ✅ **Web App Manifest** - Must be valid JSON
- ✅ **Service Worker** - Must register successfully
- ✅ **Icons** - At least 192x192 and 512x512 icons
- ✅ **User Engagement** - User must interact with the site

#### 3. **Browser Support**
PWA install prompts work on:
- ✅ **Chrome/Edge** (Android & Desktop) - Full support
- ✅ **Firefox** (Android & Desktop) - Full support
- ⚠️ **Safari** (iOS) - Manual "Add to Home Screen" only
- ❌ **Safari** (macOS) - No install prompt

#### 4. **Check PWA Debug Info**
Click the bug icon (🐛) in the bottom-right corner to see:
- Service Worker status
- Manifest status
- Browser compatibility
- Install prompt availability

### Issue: Install Prompt Doesn't Appear

#### Possible Causes:
1. **Already Installed** - Check if app is already installed
2. **Browser Doesn't Support** - Use Chrome/Edge for best support
3. **Missing Requirements** - Check debug info
4. **User Dismissed** - Clear localStorage: `localStorage.removeItem('pwa-install-dismissed')`

### Issue: Service Worker Not Registering

#### Check:
1. **File Exists** - Ensure `/sw.js` or `/firebase-messaging-sw.js` exists
2. **HTTPS** - Service workers require HTTPS (except localhost)
3. **Console Errors** - Check for registration errors

### Issue: Manifest Not Loading

#### Check:
1. **File Path** - Ensure `/manifest.json` exists in public folder
2. **Valid JSON** - Use JSON validator to check syntax
3. **Icons Exist** - All referenced icons must exist

## 🚀 Quick Fixes

### 1. **Clear Browser Data**
```javascript
// In browser console:
localStorage.clear();
// Then refresh the page
```

### 2. **Force Install Prompt (Development)**
```javascript
// In browser console:
window.dispatchEvent(new Event('beforeinstallprompt'));
```

### 3. **Check PWA Status**
```javascript
// In browser console:
console.log('Service Worker:', 'serviceWorker' in navigator);
console.log('Manifest:', !!document.querySelector('link[rel="manifest"]'));
console.log('HTTPS:', location.protocol === 'https:' || location.hostname === 'localhost');
```

## 📱 Testing Steps

### 1. **Local Testing**
1. Run `npm run dev`
2. Open Chrome/Edge
3. Go to `http://localhost:3010`
4. Check console for errors
5. Look for install prompt after 3 seconds

### 2. **Production Testing**
1. Deploy to HTTPS
2. Test on mobile device
3. Check install prompt appears
4. Verify app installs correctly

### 3. **Browser DevTools**
1. Open DevTools (F12)
2. Go to **Application** tab
3. Check **Manifest** section
4. Check **Service Workers** section
5. Look for any errors

## 🔍 Debug Information

The PWA Debugger component shows:
- ✅ **Service Worker**: Is service worker supported and registered?
- ✅ **Manifest**: Is manifest file loaded?
- ✅ **HTTPS**: Is the site served over HTTPS or localhost?
- ✅ **Install Prompt**: Is the install prompt available?
- ✅ **Already Installed**: Is the app already installed?

## 🛠️ Manual Installation

### For iOS Safari:
1. Tap the **Share** button
2. Scroll down and tap **"Add to Home Screen"**
3. Tap **"Add"**

### For Android Chrome:
1. Tap the **menu** (three dots)
2. Tap **"Add to Home Screen"** or **"Install App"**

## 📞 Still Having Issues?

If the install still doesn't work:

1. **Check the debug info** (bug icon in bottom-right)
2. **Clear browser data** and try again
3. **Try a different browser** (Chrome/Edge recommended)
4. **Check console errors** in DevTools
5. **Verify all files exist** in the public folder

The most common issue is missing icon files or service worker registration problems.
