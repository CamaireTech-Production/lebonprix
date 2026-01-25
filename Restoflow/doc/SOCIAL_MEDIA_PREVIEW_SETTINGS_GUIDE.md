# Social Media Preview Settings Guide

## Overview

The Social Media Preview Settings feature allows restaurant owners to customize how their menu links appear when shared on social media platforms like Facebook, Twitter, LinkedIn, and others. This feature provides complete control over the title, description, and preview image for both the regular menu and daily menu pages.

## Features

### 🎯 Custom Preview Settings
- **Custom Titles**: Set specific titles for social media previews
- **Custom Descriptions**: Write compelling descriptions for better engagement
- **Custom Images**: Upload dedicated preview images for maximum visual impact
- **Live Preview**: See exactly how your links will appear on social media
- **Separate Settings**: Different settings for regular menu and daily menu

### 📱 Supported Platforms
- Facebook
- Twitter
- LinkedIn
- WhatsApp
- Telegram
- Discord
- And any other platform that supports Open Graph meta tags

## How to Access

1. **Login** to your restaurant account
2. **Navigate** to Settings (from the main dashboard)
3. **Scroll down** to find the "Social Media Preview Settings" section
4. **Customize** your preview settings for both menu types

## Settings Interface

### Menu Preview Settings
- **Preview Title**: Custom title for your regular menu (max 60 characters)
- **Preview Description**: Custom description for your regular menu (max 160 characters)
- **Preview Image**: Upload a custom image (recommended: 1200x630px)

### Daily Menu Preview Settings
- **Preview Title**: Custom title for your daily menu (max 60 characters)
- **Preview Description**: Custom description for your daily menu (max 160 characters)
- **Preview Image**: Upload a custom image (recommended: 1200x630px)

## Best Practices

### 📝 Writing Effective Titles
- Keep titles under 60 characters for optimal display
- Include your restaurant name
- Use action words like "Discover", "Explore", "Taste"
- Examples:
  - ✅ "Mama's Kitchen - Discover Our Menu"
  - ✅ "Bella Vista - Fresh Daily Specials"
  - ❌ "Mama's Kitchen Restaurant Menu with All Our Delicious Dishes and Specials"

### 📖 Writing Compelling Descriptions
- Keep descriptions under 160 characters
- Highlight what makes your restaurant unique
- Include key selling points (fresh ingredients, local cuisine, etc.)
- Use emotional language
- Examples:
  - ✅ "Experience authentic Italian cuisine with fresh, locally-sourced ingredients. From traditional pasta to wood-fired pizzas."
  - ✅ "Today's special menu featuring seasonal dishes and chef's recommendations. Book your table now!"
  - ❌ "Our restaurant serves food and drinks. We have many different types of food including appetizers, main courses, and desserts."

### 🖼️ Choosing the Right Images
- **Size**: 1200x630px for optimal display across all platforms
- **Format**: JPG or PNG
- **Content**: Show your best dishes, restaurant ambiance, or logo
- **Quality**: High-resolution, well-lit images
- **Branding**: Consistent with your restaurant's visual identity

## Technical Implementation

### Data Structure
The settings are stored in the restaurant document under `socialMediaPreview`:

```typescript
interface SocialMediaPreviewSettings {
  menu?: {
    title?: string;
    description?: string;
    image?: string;
  };
  dailyMenu?: {
    title?: string;
    description?: string;
    image?: string;
  };
}
```

### Meta Tags Generated
When custom settings are provided, the system generates:

```html
<!-- Custom Title -->
<title>Your Custom Title</title>
<meta property="og:title" content="Your Custom Title" />

<!-- Custom Description -->
<meta name="description" content="Your custom description" />
<meta property="og:description" content="Your custom description" />

<!-- Custom Image -->
<meta property="og:image" content="https://your-domain.com/custom-image.jpg" />
<meta name="twitter:image" content="https://your-domain.com/custom-image.jpg" />
```

### Fallback System
If custom settings are not provided, the system falls back to:
1. **Title**: Restaurant name + page type (e.g., "Mama's Kitchen - Menu")
2. **Description**: Auto-generated based on menu items and restaurant info
3. **Image**: First menu item image → Restaurant logo → Default icon

## Testing Your Settings

### 1. Facebook Sharing Debugger
- Visit: https://developers.facebook.com/tools/debug/
- Enter your menu URL
- Click "Debug" to see the preview
- Use "Scrape Again" to refresh after changes

### 2. Twitter Card Validator
- Visit: https://cards-dev.twitter.com/validator
- Enter your menu URL
- Preview how it will appear on Twitter

### 3. LinkedIn Post Inspector
- Visit: https://www.linkedin.com/post-inspector/
- Enter your menu URL
- See the LinkedIn preview

### 4. Real-World Testing
- Share your menu link on different social platforms
- Test with friends and colleagues
- Check how it appears on mobile devices

## Troubleshooting

### Common Issues

#### Images Not Showing
- **Check image URL**: Ensure the image is publicly accessible
- **Verify format**: Use JPG or PNG formats
- **Check size**: Large images may take time to load
- **Clear cache**: Social platforms cache previews, use debuggers to refresh

#### Titles/Descriptions Not Updating
- **Save settings**: Make sure you clicked "Save Settings"
- **Clear browser cache**: Refresh your browser
- **Use debuggers**: Social platforms cache previews
- **Wait for propagation**: Changes may take a few minutes

#### Preview Not Matching Settings
- **Check character limits**: Titles (60) and descriptions (160)
- **Verify image dimensions**: 1200x630px recommended
- **Test with debuggers**: Use platform-specific tools
- **Check for typos**: Review your custom text

### Getting Help

1. **Check the preview**: Use the live preview in settings
2. **Test with debuggers**: Use platform-specific tools
3. **Clear caches**: Browser and social platform caches
4. **Contact support**: If issues persist

## Advanced Tips

### 🎨 Visual Consistency
- Use consistent colors and fonts in your preview images
- Match your restaurant's branding
- Consider seasonal updates for daily menu images

### 📊 A/B Testing
- Try different titles and descriptions
- Test various images
- Monitor engagement metrics
- Update based on performance

### 🔄 Regular Updates
- Update daily menu previews regularly
- Refresh images seasonally
- Keep descriptions current
- Test new approaches

### 📱 Mobile Optimization
- Ensure images look good on mobile
- Keep text concise for small screens
- Test on different devices
- Consider mobile-first design

## Benefits

### For Restaurant Owners
- **Brand Control**: Complete control over how your restaurant appears
- **Increased Engagement**: Better previews lead to more clicks
- **Professional Appearance**: Consistent, polished social media presence
- **Marketing Tool**: Use previews as part of your marketing strategy

### For Customers
- **Clear Information**: Know exactly what to expect
- **Visual Appeal**: Attractive previews catch attention
- **Easy Sharing**: Professional-looking shared links
- **Better Experience**: Consistent branding across platforms

## Future Enhancements

Potential upcoming features:
- **Analytics**: Track preview performance
- **Templates**: Pre-designed preview templates
- **Scheduling**: Automatic updates for daily menus
- **Multi-language**: Support for multiple languages
- **A/B Testing**: Built-in testing tools

## Support

For technical support or questions:
1. Check this guide first
2. Test with social media debuggers
3. Contact the development team
4. Report bugs or feature requests

---

*This feature enhances your restaurant's social media presence and helps attract more customers through professional, engaging link previews.*

