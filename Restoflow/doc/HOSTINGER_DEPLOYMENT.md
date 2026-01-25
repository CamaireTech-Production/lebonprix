# Hostinger Deployment Guide

## Quick Fix for Firebase Auth CSP Error

If you're getting this error:
```
Refused to frame 'https://restaurant-app-85b58.firebaseapp.com/' because it violates the following Content Security Policy directive: "frame-src 'self' https://*.google.com https://*.firebase.com"
```

## Solution

1. **Upload the `.htaccess` file** from the `public` folder to your Hostinger root directory
2. **Make sure the file is named exactly `.htaccess`** (with the dot at the beginning)
3. **Upload all files** from the `dist` folder to your Hostinger public_html directory

## What the .htaccess file does:

- Overrides Hostinger's default CSP to allow Firebase Auth domains
- Specifically adds `https://*.firebaseapp.com` to the `frame-src` directive
- Ensures JavaScript files are served with correct MIME type

## File Structure on Hostinger:

```
public_html/
├── .htaccess          (upload from public/.htaccess)
├── index.html         (from dist/)
├── assets/            (from dist/assets/)
└── icons/             (from dist/icons/)
```

## Testing:

After deployment, test Google Sign-in:
1. Go to your website
2. Click "Sign in with Google"
3. The popup should now work without CSP errors

## If it still doesn't work:

1. Clear your browser cache
2. Try in an incognito/private window
3. Check browser console for any remaining errors
4. Contact Hostinger support if the .htaccess file isn't being processed
