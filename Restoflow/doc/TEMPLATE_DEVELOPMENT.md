# Template Development Guide

This document explains the template system architecture in the Restaurant App and provides step-by-step instructions for creating new themes/templates.

## Table of Contents

- [Template System Overview](#template-system-overview)
- [File Structure](#file-structure)
- [How Templates Work](#how-templates-work)
- [Creating a New Template](#creating-a-new-template)
- [Template Customization](#template-customization)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Template System Overview

The restaurant app uses a modular template system that allows restaurants to customize the appearance of their public pages (menu, order, and daily menu). The system supports multiple themes with customization options while maintaining consistency across the application.

### Key Features

- **Multiple Themes**: Support for different visual designs
- **Page-Specific Templates**: Different templates for menu, order, and daily menu pages
- **Real-time Preview**: Live preview of template changes
- **Customization Options**: Color schemes, typography, spacing, and more
- **Responsive Design**: All templates work on mobile and desktop
- **Fallback System**: Graceful fallback to default template if issues occur

## File Structure

```
src/
├── components/templates/
│   ├── TemplateSelector.tsx          # Main template selection UI
│   ├── TemplateWrapper.tsx           # Template routing logic
│   ├── TemplateSettingsPanel.tsx     # Template customization settings
│   ├── TemplatePreview.tsx           # Preview functionality
│   └── templates/                    # Individual template components
│       ├── DefaultTemplate.tsx       # Default theme (current design)
│       └── (Only DefaultTemplate.tsx is active; legacy theme files removed)

> **Note:** Legacy template variants such as `Theme1Template` and `LeaTemplate` have been removed from the codebase. Remaining references in this document are kept for historical context only.
├── config/
│   └── templates.ts                  # Template definitions and metadata
├── pages/restaurant/templates/
│   └── TemplateManagement.tsx        # Restaurant template management
├── pages/demo/
│   └── DemoTemplateManagement.tsx    # Demo template management
└── shared/public/
    ├── TemplateAwarePublicMenuContent.tsx
    └── TemplateAwarePublicOrderContent.tsx

public/
└── assets/theme preview/
    ├── default.png                   # Default template preview
    └── theme1.png                    # Theme 1 preview
```

## How Templates Work

### 1. Template Definition (`src/config/templates.ts`)

Templates are defined in the `AVAILABLE_TEMPLATES` array with metadata:

```typescript
export const AVAILABLE_TEMPLATES: PublicTemplate[] = [
  {
    id: 'default',
    name: 'Default Theme',
    description: 'The current actual design used in public links',
    thumbnail: '/assets/theme preview/default.png',
    category: 'modern',
    isActive: true,
    isDefault: true,
    version: '1.0.0',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];
```

### 2. Template Selection (`src/components/templates/TemplateSelector.tsx`)

- Provides UI for users to browse and select templates
- Handles preview creation and template application
- Manages template settings and customization

### 3. Template Routing (`src/components/templates/TemplateWrapper.tsx`)

Acts as a router that determines which template component to render:

```typescript
switch (templateId) {
  case 'default':
    return <DefaultTemplate settings={settings}>{children}</DefaultTemplate>;
  case 'theme1':
    return <Theme1Template settings={settings}>{children}</Theme1Template>;
  default:
    return <DefaultTemplate settings={settings}>{children}</DefaultTemplate>;
}
```

### 4. Template Storage

Template settings are stored in the restaurant's data structure:

```typescript
restaurant.publicTemplates = {
  menu: { templateId: 'default', isActive: true, customizations: {...} },
  order: { templateId: 'theme1', isActive: true, customizations: {...} },
  dailyMenu: { templateId: 'default', isActive: true, customizations: {...} }
}
```

### 5. Template Application

Public pages wrap their content with `TemplateWrapper`:

```typescript
<TemplateWrapper
  templateId={templateId}
  restaurant={restaurant}
  pageType="menu"
>
  <TemplateAwarePublicMenuContent {...props} />
</TemplateWrapper>
```

## Creating a New Template

### Step 1: Create the Template Component

Create a new file in `src/components/templates/templates/`:

```typescript
// src/components/templates/templates/Theme2Template.tsx
import React, { useRef, useState, useEffect } from 'react';
import { TemplateSettings, Restaurant, Category, Dish } from '../../../types';
import { ChefHat, Search, X, MapPin, Phone, ArrowUp } from 'lucide-react';
import { getCurrencySymbol } from '../../../data/currencies';
import { useLanguage } from '../../../contexts/LanguageContext';
import { t } from '../../../utils/i18n';
import DishDetailModal from '../../../pages/client/customer/DishDetailModal';

interface Theme2TemplateProps {
  settings?: TemplateSettings;
  children?: React.ReactNode;
  restaurant?: Restaurant;
  categories?: Category[];
  menuItems?: Dish[];
  isDemo?: boolean;
}

const Theme2Template: React.FC<Theme2TemplateProps> = ({ 
  settings, 
  children,
  restaurant,
  categories = [],
  menuItems = [],
  isDemo = false
}) => {
  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Hooks
  const { language } = useLanguage();
  const currencySymbol = restaurant?.currency ? getCurrencySymbol(restaurant.currency) : 'FCFA';

  // Filter data
  const filteredCategories = categories.filter(cat => 
    cat.status === 'active' && (cat.deleted === undefined || cat.deleted === false)
  );
  
  const filteredMenuItems = menuItems.filter(item => 
    item.status === 'active'
  );

  // Scroll handling
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 200);
      setIsScrolled(window.scrollY > 50);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Your template JSX here
  return (
    <div className="theme2-template min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        {/* Your header implementation */}
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6">
        {/* Your main content implementation */}
      </main>

      {/* Dish detail modal */}
      {selectedDish && (
        <DishDetailModal
          isOpen={isModalOpen}
          dish={selectedDish}
          onClose={() => {
            setModalOpen(false);
            setSelectedDish(null);
          }}
          categoryName={filteredCategories.find(cat => cat.id === selectedDish.categoryId)?.title}
          currencyCode={currencySymbol}
        />
      )}
    </div>
  );
};

export default Theme2Template;
```

### Step 2: Add Template to Configuration

Update `src/config/templates.ts`:

```typescript
export const AVAILABLE_TEMPLATES: PublicTemplate[] = [
  // ... existing templates
  {
    id: 'theme2',
    name: 'Theme 2',
    description: 'A modern, elegant theme with clean typography and smooth animations',
    thumbnail: '/assets/theme preview/theme2.png',
    category: 'elegant', // Options: 'modern', 'classic', 'minimal', 'elegant', 'bold'
    isActive: true,
    isDefault: false,
    version: '1.0.0',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];
```

### Step 3: Update Template Wrapper

Update `src/components/templates/TemplateWrapper.tsx`:

```typescript
import Theme2Template from './templates/Theme2Template';

// In the switch statement:
switch (templateId) {
  case 'default':
    return <DefaultTemplate settings={settings}>{children}</DefaultTemplate>;
  case 'theme1':
    return <Theme1Template settings={settings}>{children}</Theme1Template>;
  case 'theme2':
    return <Theme2Template settings={settings}>{children}</Theme2Template>;
  default:
    return <DefaultTemplate settings={settings}>{children}</DefaultTemplate>;
}
```

### Step 4: Create Preview Image

1. Create a preview image (recommended size: 400x300px)
2. Save it as `public/assets/theme preview/theme2.png`
3. Ensure the image represents your template's design accurately

### Step 5: Test Your Template

1. Start the development server: `pnpm dev`
2. Navigate to your restaurant dashboard
3. Go to Template Management
4. Select your new template
5. Test on different page types (menu, order, daily menu)
6. Test responsive behavior on mobile and desktop

## Template Customization

### Settings Interface

Templates can be customized through the `TemplateSettings` interface:

```typescript
interface TemplateSettings {
  templateId: string;
  isActive: boolean;
  customizations?: {
    headerStyle?: 'centered' | 'left-aligned' | 'minimal';
    cardStyle?: 'rounded' | 'square' | 'elevated';
    colorScheme?: 'auto' | 'custom';
    typography?: 'default' | 'elegant' | 'bold';
    spacing?: 'compact' | 'comfortable' | 'spacious';
    customColors?: {
      primary?: string;
      secondary?: string;
      accent?: string;
    };
  };
}
```

### Using Settings in Your Template

```typescript
const Theme2Template: React.FC<Theme2TemplateProps> = ({ settings, ... }) => {
  // Apply customizations
  const headerStyle = settings?.customizations?.headerStyle || 'centered';
  const cardStyle = settings?.customizations?.cardStyle || 'rounded';
  const spacing = settings?.customizations?.spacing || 'comfortable';
  
  // Apply custom colors
  const customColors = settings?.customizations?.customColors;
  const primaryColor = customColors?.primary || restaurant?.colorPalette?.primary;
  
  return (
    <div className={`theme2-template spacing-${spacing}`}>
      <header className={`header-style-${headerStyle}`}>
        {/* Header content */}
      </header>
      
      <div className={`card-style-${cardStyle}`}>
        {/* Card content */}
      </div>
    </div>
  );
};
```

## Best Practices

### 1. Component Structure

- Follow the same props interface as existing templates
- Use TypeScript for type safety
- Implement proper error handling and fallbacks

### 2. Responsive Design

- Ensure your template works on all screen sizes
- Test on mobile, tablet, and desktop
- Use Tailwind CSS responsive classes

### 3. Performance

- Optimize images and assets
- Use lazy loading for images
- Minimize re-renders with proper React patterns

### 4. Accessibility

- Maintain proper heading hierarchy
- Ensure sufficient color contrast
- Add proper ARIA labels
- Support keyboard navigation

### 5. Data Handling

- Handle missing or empty data gracefully
- Provide loading states
- Implement proper error boundaries

### 6. Styling

- Use Tailwind CSS for consistency
- Follow the existing design system
- Use CSS custom properties for dynamic styling
- Ensure proper color palette integration

## Template Categories

Available template categories for organization:

- **modern**: Contemporary designs with clean lines
- **classic**: Traditional, elegant designs
- **minimal**: Simple, focused designs
- **elegant**: Sophisticated, refined designs
- **bold**: High-impact, vibrant designs

## Troubleshooting

### Common Issues

1. **Template not appearing in selector**
   - Check that the template is added to `AVAILABLE_TEMPLATES`
   - Verify the template ID matches the case statement in `TemplateWrapper`

2. **Template not rendering**
   - Check import statements in `TemplateWrapper.tsx`
   - Verify the component exports correctly
   - Check browser console for errors

3. **Styling issues**
   - Ensure Tailwind classes are properly applied
   - Check for CSS conflicts
   - Verify responsive breakpoints

4. **Data not displaying**
   - Check props being passed to template
   - Verify data filtering logic
   - Ensure proper state management

### Debugging Tips

1. Use React DevTools to inspect component props
2. Check browser console for errors
3. Test with different data sets
4. Verify template settings are being applied
5. Test on different devices and browsers

## Example Template Implementation

See `src/components/templates/templates/DefaultTemplate.tsx` and `Theme1Template.tsx` for complete examples of how to implement a template with all features including:

- Search functionality
- Category filtering
- Dish detail modals
- Responsive design
- Scroll handling
- Language support
- Currency formatting

## Contributing

When contributing new templates:

1. Follow the existing code style and patterns
2. Add comprehensive documentation
3. Include preview images
4. Test thoroughly on multiple devices
5. Ensure accessibility compliance
6. Update this documentation if needed

---

For more information, refer to the existing template implementations and the main application documentation.
