# Deployment Guide for Restaurant App

## Issues Fixed

### 1. Build Configuration
- ✅ Added proper `base` path configuration
- ✅ Added manual chunk splitting to reduce bundle size
- ✅ Disabled sourcemaps for production
- ✅ Optimized build output

### 2. Security Configuration
- ✅ Added comprehensive security headers
- ✅ Force HTTPS redirection
- ✅ Content Security Policy (CSP) configuration
- ✅ Protection against common vulnerabilities

### 3. SPA Routing
- ✅ Fixed .htaccess for proper client-side routing
- ✅ Added fallback redirects for all routes
- ✅ Excluded static assets from SPA routing

### 4. Service Worker
- ✅ Removed conflicting service worker registrations
- ✅ Let Vite PWA plugin handle service worker properly

## Deployment Steps

### 1. Build the Application
```bash
pnpm run build
```

### 2. Upload Files to Server
Upload the entire `dist/` folder contents to your web server's root directory.

### 3. Ensure .htaccess is Uploaded
Make sure the updated `.htaccess` file is in your server's root directory.

### 4. Verify SSL Certificate
- Check that your SSL certificate is valid and not expired
- Ensure it covers your domain (app.restoflowapp.com)
- Verify the certificate chain is complete

### 5. Test the Deployment
1. Visit https://app.restoflowapp.com/
2. Check that it redirects to HTTPS
3. Test navigation between pages
4. Verify no console errors

## Common Issues and Solutions

### "Page Not Found" Error
**Cause**: Server not properly configured for SPA routing
**Solution**: Ensure .htaccess file is uploaded and server supports mod_rewrite

### "Network is not private" Error
**Cause**: SSL certificate issues
**Solutions**:
1. Check certificate validity: https://www.ssllabs.com/ssltest/
2. Ensure certificate covers your domain
3. Verify certificate chain is complete
4. Contact your hosting provider if issues persist

### Mixed Content Warnings
**Cause**: Loading HTTP resources on HTTPS site
**Solution**: All resources are now configured to load over HTTPS

## Server Requirements

### Apache Server
- mod_rewrite enabled
- mod_headers enabled (for security headers)
- mod_deflate enabled (for compression)
- mod_expires enabled (for caching)

### Nginx Server
If using Nginx, you'll need to configure:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}

# Security headers
add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
```

## CI/CD Configuration

### GitHub Actions Example
```yaml
- name: Build
  run: pnpm run build

- name: Deploy
  run: |
    # Upload dist/ contents to server
    # Ensure .htaccess is included
```

### Environment Variables
Ensure these are set in your CI/CD:
- `NODE_ENV=production`
- Any Firebase configuration variables

## Monitoring

### SSL Certificate Monitoring
Set up monitoring for SSL certificate expiration:
- Use tools like UptimeRobot
- Set alerts for certificate expiration

### Performance Monitoring
- Monitor Core Web Vitals
- Check bundle size regularly
- Monitor loading times

## Troubleshooting

### If deployment still fails:
1. Check server error logs
2. Verify file permissions (644 for files, 755 for directories)
3. Test with a simple HTML file first
4. Contact hosting provider for server configuration issues

### Browser Developer Tools
- Check Network tab for failed requests
- Check Console for JavaScript errors
- Check Application tab for service worker status
