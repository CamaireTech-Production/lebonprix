# Social Media Preview Implementation Guide

## Overview

This implementation adds dynamic Open Graph meta tags and structured data to restaurant menu pages, enabling rich social media previews when links are shared on platforms like Facebook, Twitter, LinkedIn, and others.

## Features Implemented

### 1. Dynamic Meta Tags (`RestaurantMetaTags.tsx`)
- **Open Graph tags** for Facebook, LinkedIn, and other platforms
- **Twitter Card tags** for Twitter sharing
- **Basic SEO meta tags** (title, description, keywords)
- **Restaurant-specific metadata** (cuisine, price range, location)

### 2. Structured Data (`StructuredData.tsx`)
- **Schema.org markup** for search engines
- **Restaurant information** (name, description, contact details)
- **Menu structure** with categorized items
- **Rich snippets** support for Google search results

### 3. Integration Points
- **PublicDailyMenuPage**: Daily menu with social previews
- **PublicMenuPage**: Full menu with social previews
- **HelmetProvider**: Wraps the entire app for meta tag management

## How It Works

### Meta Tags Generated
When someone visits a restaurant menu page, the following meta tags are dynamically generated:

```html
<!-- Basic Meta Tags -->
<title>Restaurant Name - Daily Menu</title>
<meta name="description" content="Discover today's special menu at Restaurant Name..." />
<meta name="keywords" content="restaurant, menu, food, dining, dish1, dish2..." />

<!-- Open Graph Tags -->
<meta property="og:type" content="website" />
<meta property="og:title" content="Restaurant Name - Daily Menu" />
<meta property="og:description" content="Discover today's special menu..." />
<meta property="og:url" content="https://your-domain.com/public-daily-menu/restaurantId" />
<meta property="og:image" content="https://your-domain.com/menu-item-image.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />

<!-- Twitter Card Tags -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Restaurant Name - Daily Menu" />
<meta name="twitter:description" content="Discover today's special menu..." />
<meta name="twitter:image" content="https://your-domain.com/menu-item-image.jpg" />
```

### Structured Data Generated
JSON-LD structured data is also generated for search engines:

```json
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Restaurant Name",
  "description": "Restaurant serving Italian cuisine",
  "url": "https://your-domain.com/public-daily-menu/restaurantId",
  "image": "https://your-domain.com/restaurant-logo.jpg",
  "telephone": "+1234567890",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Main St"
  },
  "servesCuisine": "Italian",
  "priceRange": "$$",
  "hasMenu": {
    "@type": "Menu",
    "name": "Daily Menu",
    "hasMenuSection": [...]
  }
}
```

## Testing Your Implementation

### 1. Facebook Sharing Debugger
- Visit: https://developers.facebook.com/tools/debug/
- Enter your restaurant menu URL
- Click "Debug" to see how it will appear on Facebook
- Use "Scrape Again" to refresh after making changes

### 2. Twitter Card Validator
- Visit: https://cards-dev.twitter.com/validator
- Enter your restaurant menu URL
- See how it will appear in Twitter posts

### 3. LinkedIn Post Inspector
- Visit: https://www.linkedin.com/post-inspector/
- Enter your restaurant menu URL
- Preview how it will look when shared on LinkedIn

### 4. Google Rich Results Test
- Visit: https://search.google.com/test/rich-results
- Enter your restaurant menu URL
- Verify structured data is properly formatted

## URL Structure

The implementation works with these URL patterns:
- **Daily Menu**: `/public-daily-menu/:restaurantId`
- **Full Menu**: `/public-menu/:restaurantId`

## Customization Options

### 1. Default Images
If no menu item images are available, the system falls back to:
1. Restaurant logo
2. Default app icon (`/icons/icon-512x512.png`)

### 2. Meta Tag Content
The meta tags are generated based on:
- Restaurant name and description
- Menu item count and names
- Restaurant cuisine type
- Restaurant address and contact info

### 3. Structured Data
The structured data includes:
- Restaurant information
- Menu sections and items
- Pricing information
- Contact details

## Troubleshooting

### Common Issues

1. **Images not showing in previews**
   - Ensure images are publicly accessible
   - Use absolute URLs for images
   - Recommended image size: 1200x630px

2. **Meta tags not updating**
   - Clear browser cache
   - Use social media debuggers to force refresh
   - Check that HelmetProvider is properly wrapped around your app

3. **Structured data errors**
   - Validate JSON-LD format
   - Ensure all required fields are present
   - Check for proper escaping of special characters

### Debug Mode
To debug meta tags in development:
1. Open browser developer tools
2. Check the `<head>` section for dynamically added meta tags
3. Use React DevTools to inspect Helmet components

## Performance Considerations

- Meta tags are generated client-side, so they may not be immediately available to crawlers
- For better SEO, consider implementing server-side rendering (SSR)
- Images should be optimized for web (compressed, appropriate dimensions)

## Future Enhancements

Potential improvements:
1. **Server-side rendering** for better SEO
2. **Dynamic image generation** for social previews
3. **A/B testing** for different meta tag variations
4. **Analytics integration** to track social media traffic
5. **Multi-language support** for international restaurants

## Support

For issues or questions about this implementation:
1. Check the browser console for errors
2. Verify all dependencies are installed
3. Test with social media debuggers
4. Review the component code for customization needs

