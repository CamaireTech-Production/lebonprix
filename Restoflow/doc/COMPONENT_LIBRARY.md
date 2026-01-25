# Component Library Documentation

## 🎨 **Design System Components**

### **Button Component**
A versatile button component with multiple variants and sizes.

```typescript
import { Button } from '../design-system/styled-primitives';

// Basic usage
<Button>Click me</Button>

// With variants
<Button variant="primary" size="md">Primary</Button>
<Button variant="secondary" size="lg">Secondary</Button>
<Button variant="outline" size="sm">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="danger">Delete</Button>

// With loading state
<Button loading>Loading...</Button>

// Disabled state
<Button disabled>Disabled</Button>
```

**Props:**
- `variant`: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
- `size`: 'sm' | 'md' | 'lg'
- `disabled`: boolean
- `loading`: boolean
- `onClick`: () => void

### **Input Component**
Form input with validation states and error handling.

```typescript
import { Input } from '../design-system/styled-primitives';

// Basic input
<Input
  type="email"
  placeholder="Enter email"
  value={email}
  onChange={setEmail}
/>

// With validation
<Input
  type="text"
  placeholder="Enter name"
  value={name}
  onChange={setName}
  error={hasError}
  errorMessage="Name is required"
/>

// Disabled state
<Input
  type="text"
  placeholder="Disabled input"
  disabled
/>
```

**Props:**
- `type`: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url'
- `placeholder`: string
- `value`: string
- `onChange`: (value: string) => void
- `disabled`: boolean
- `error`: boolean
- `errorMessage`: string

### **Card Component**
Container component with elevation and padding variants.

```typescript
import { Card } from '../design-system/styled-primitives';

// Basic card
<Card>
  <h3>Card Title</h3>
  <p>Card content</p>
</Card>

// With variants
<Card variant="elevated" padding="lg">
  <h3>Elevated Card</h3>
  <p>Content with large padding</p>
</Card>

<Card variant="outlined" padding="sm">
  <h3>Outlined Card</h3>
  <p>Content with small padding</p>
</Card>
```

**Props:**
- `variant`: 'default' | 'elevated' | 'outlined'
- `padding`: 'sm' | 'md' | 'lg'

### **Badge Component**
Status indicator with color variants.

```typescript
import { Badge } from '../design-system/styled-primitives';

// Status badges
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="error">Error</Badge>
<Badge variant="info">Info</Badge>

// With sizes
<Badge size="sm">Small</Badge>
<Badge size="md">Medium</Badge>
<Badge size="lg">Large</Badge>
```

**Props:**
- `variant`: 'default' | 'success' | 'warning' | 'error' | 'info'
- `size`: 'sm' | 'md' | 'lg'

### **Avatar Component**
User profile image with fallback support.

```typescript
import { Avatar } from '../design-system/styled-primitives';

// With image
<Avatar
  src="/path/to/image.jpg"
  alt="User avatar"
  size="md"
/>

// With fallback
<Avatar
  fallback="JD"
  size="lg"
/>

// Different sizes
<Avatar size="sm" fallback="A" />
<Avatar size="md" fallback="AB" />
<Avatar size="lg" fallback="ABC" />
<Avatar size="xl" fallback="ABCD" />
```

**Props:**
- `src`: string (image URL)
- `alt`: string (alt text)
- `size`: 'sm' | 'md' | 'lg' | 'xl'
- `fallback`: string (fallback text)

### **Spinner Component**
Loading indicator with size and color variants.

```typescript
import { Spinner } from '../design-system/styled-primitives';

// Basic spinner
<Spinner />

// With size
<Spinner size="sm" />
<Spinner size="md" />
<Spinner size="lg" />

// With color
<Spinner color="primary" />
<Spinner color="secondary" />
<Spinner color="white" />
```

**Props:**
- `size`: 'sm' | 'md' | 'lg'
- `color`: 'primary' | 'secondary' | 'white'

### **Alert Component**
Notification component with dismissible option.

```typescript
import { Alert } from '../design-system/styled-primitives';

// Basic alert
<Alert variant="info">
  This is an info message
</Alert>

// With title
<Alert variant="success" title="Success!">
  Operation completed successfully
</Alert>

// Dismissible alert
<Alert
  variant="warning"
  title="Warning"
  dismissible
  onDismiss={handleDismiss}
>
  This action cannot be undone
</Alert>
```

**Props:**
- `variant`: 'success' | 'warning' | 'error' | 'info'
- `title`: string
- `dismissible`: boolean
- `onDismiss`: () => void

### **Modal Component**
Overlay dialog with customizable size and behavior.

```typescript
import { Modal } from '../design-system/styled-primitives';

// Basic modal
<Modal
  isOpen={isOpen}
  onClose={handleClose}
  title="Modal Title"
>
  <p>Modal content goes here</p>
</Modal>

// With size variants
<Modal
  isOpen={isOpen}
  onClose={handleClose}
  size="lg"
  title="Large Modal"
>
  <p>Large modal content</p>
</Modal>

// Without close on overlay click
<Modal
  isOpen={isOpen}
  onClose={handleClose}
  closeOnOverlayClick={false}
  title="Persistent Modal"
>
  <p>This modal requires explicit close</p>
</Modal>
```

**Props:**
- `isOpen`: boolean
- `onClose`: () => void
- `title`: string
- `size`: 'sm' | 'md' | 'lg' | 'xl'
- `closeOnOverlayClick`: boolean

## 🧩 **Template Components**

### **TemplateHeader**
Header component for templates with customizable styling.

```typescript
import { TemplateHeader } from '../components/templates/components/TemplateHeader';

<TemplateHeader
  restaurant={restaurant}
  customizations={customizations}
  colors={colors}
  selectedElement={selectedElement}
  onElementClick={onElementClick}
/>
```

### **TemplateCategoryTabs**
Category navigation for templates.

```typescript
import { TemplateCategoryTabs } from '../components/templates/components/TemplateCategoryTabs';

<TemplateCategoryTabs
  categories={categories}
  activeCategory={activeCategory}
  onCategoryChange={setActiveCategory}
  customizations={customizations}
  colors={colors}
/>
```

### **MenuCard**
Menu item card with add-to-cart functionality.

```typescript
import { MenuCard } from '../components/templates/components/MenuCard';

<MenuCard
  dish={dish}
  currencySymbol={currencySymbol}
  onDishClick={handleDishClick}
  customizations={customizations}
  colors={colors}
  showOrderOverlay={showOrderOverlay}
  restaurantId={restaurantId}
  language={language}
  translate={translate}
/>
```

### **MenuGrid**
Grid layout for menu items.

```typescript
import { MenuGrid } from '../components/templates/layouts/MenuGrid';

<MenuGrid
  dishes={dishes}
  currencySymbol={currencySymbol}
  onDishClick={handleDishClick}
  customizations={customizations}
  colors={colors}
  showOrderOverlay={showOrderOverlay}
  restaurantId={restaurantId}
  language={language}
  translate={translate}
/>
```

## 🛒 **Order Components**

### **CartPanel**
Shopping cart with item management.

```typescript
import { CartPanel } from '../components/order/CartPanel';

<CartPanel
  items={cartItems}
  total={total}
  onRemoveItem={handleRemoveItem}
  onIncrementItem={handleIncrementItem}
  onDecrementItem={handleDecrementItem}
  onClearCart={handleClearCart}
  currencySymbol={currencySymbol}
  language={language}
  translate={translate}
/>
```

### **CheckoutForm**
Customer information form for orders.

```typescript
import { CheckoutForm } from '../components/order/CheckoutForm';

<CheckoutForm
  formData={formData}
  errors={errors}
  onFormDataChange={handleFormDataChange}
  onSubmit={handleSubmit}
  isSubmitting={isSubmitting}
  language={language}
  translate={translate}
/>
```

### **OrderCard**
Order item display with management controls.

```typescript
import { OrderCard } from '../components/templates/components/OrderCard';

<OrderCard
  item={orderItem}
  onIncrement={handleIncrement}
  onDecrement={handleDecrement}
  onRemove={handleRemove}
  currencySymbol={currencySymbol}
  language={language}
  translate={translate}
/>
```

## 🎨 **Safe HTML Components**

### **SafeHTML**
Safe HTML rendering with sanitization.

```typescript
import { SafeHTML } from '../design-system/safe-html';

<SafeHTML
  content={userContent}
  allowedTags={['p', 'br', 'strong', 'em']}
  allowedAttributes={['class', 'style']}
/>
```

### **SafeMarkdown**
Markdown to HTML conversion with sanitization.

```typescript
import { SafeMarkdown } from '../design-system/safe-html';

<SafeMarkdown
  content="# Hello World\nThis is **bold** text"
/>
```

### **SafeCodeBlock**
HTML-escaped code blocks.

```typescript
import { SafeCodeBlock } from '../design-system/safe-html';

<SafeCodeBlock
  code="const hello = 'world';"
  language="javascript"
/>
```

## 🎭 **Theme Components**

### **ThemeProvider**
Theme context provider for the application.

```typescript
import { ThemeProvider } from '../design-system/theme';

<ThemeProvider defaultTheme="light">
  <App />
</ThemeProvider>
```

### **ThemeSelector**
Theme switching component.

```typescript
import { ThemeSelector } from '../design-system/theme';

<ThemeSelector />
```

### **CustomThemeCreator**
Dynamic theme creation component.

```typescript
import { CustomThemeCreator } from '../design-system/theme';

<CustomThemeCreator
  onThemeCreate={handleThemeCreate}
/>
```

## 🧪 **Testing Components**

### **Test Utilities**
Testing utilities and mocks.

```typescript
import {
  renderWithProviders,
  mockRestaurant,
  mockDish,
  mockCartItem,
  setupMocks,
  cleanupMocks
} from '../__tests__/utils/test-utils';

// Render with providers
renderWithProviders(<MyComponent />, {
  theme: 'dark',
  language: 'fr',
  user: mockUser
});

// Setup mocks
setupMocks();
// ... test code ...
cleanupMocks();
```

## 📱 **Responsive Design**

All components are built with mobile-first responsive design:

- **Breakpoints**: sm (640px), md (768px), lg (1024px), xl (1280px)
- **Grid System**: CSS Grid and Flexbox layouts
- **Typography**: Responsive font sizes and line heights
- **Spacing**: Consistent spacing scale across devices

## ♿ **Accessibility**

All components include accessibility features:

- **ARIA Labels**: Proper labeling for screen readers
- **Keyboard Navigation**: Full keyboard support
- **Focus Management**: Visible focus indicators
- **Color Contrast**: WCAG AA compliant color combinations
- **Semantic HTML**: Proper HTML structure and semantics

## 🎨 **Customization**

Components can be customized through:

- **CSS Variables**: Design token customization
- **Props**: Component-specific customization
- **Themes**: Global theme switching
- **CSS Classes**: Additional styling options

---

**Last Updated:** October 22, 2025  
**Version:** 2.0.0  
**Components:** 20+ reusable components

