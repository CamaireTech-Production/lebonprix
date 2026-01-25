// PendingAction type for offline admin actions
export type PendingAction =
  | { type: 'createMenuItem'; payload: any; timestamp?: number }
  | { type: 'updateMenuItem'; payload: any; timestamp?: number }
  | { type: 'deleteMenuItem'; payload: any; timestamp?: number }
  | { type: 'createCategory'; payload: any; timestamp?: number }
  | { type: 'updateCategory'; payload: any; timestamp?: number }
  | { type: 'deleteCategory'; payload: any; timestamp?: number }
  | { type: 'createTable'; payload: any; timestamp?: number }
  | { type: 'updateTable'; payload: any; timestamp?: number }
  | { type: 'deleteTable'; payload: any; timestamp?: number }
  | { type: 'updateOrderStatus'; payload: any; timestamp?: number };
// Restaurant Types
export interface Restaurant {
  id: string;
  name: string;
  logo?: string;
  address?: string;
  description?: string;
  email: string;
  phone?: string;
  managerName?: string;
  menuFiles?: string[]; // Base64 encoded files
  createdAt: any;
  updatedAt?: any;
  isVerified?: boolean; // New field for account verification status
  verificationStatus?: 'pending' | 'verified' | 'rejected'; // Detailed verification status
  verificationNotes?: string; // Admin notes for verification
  verifiedAt?: any; // When account was verified
  verifiedBy?: string; // Admin who verified the account
  colorPalette?: {
    primary: string;
    secondary: string;
  };
  // Payment information for Cameroon context
  paymentInfo?: PaymentInfo;
  // Feature toggles
  orderManagement?: boolean;
  tableManagement?: boolean;
  paymentInfoEnabled?: boolean;
  colorCustomization?: boolean;
  publicMenuLink?: boolean;
  publicOrderLink?: boolean;
  whatsappBulkMessaging?: boolean; // New field for WhatsApp bulk messaging
  publicDailyMenuLink?: string; // New field for delivery menu link
  templateSelection?: boolean; // New field for template selection toggle
  currency?: string;
  deliveryFee?: number;
  // Template settings for public pages
  publicTemplates?: {
    menu?: TemplateSettings;
    order?: TemplateSettings;
    dailyMenu?: TemplateSettings;
  };
  // Social media preview settings
  socialMediaPreview?: SocialMediaPreviewSettings;
  // CinetPay configuration
  cinetpayConfig?: {
    siteId: string;
    apiKey: string; // encrypted
    isActive: boolean;
    environment: 'sandbox' | 'production';
    supportedMethods: string[];
    minAmount: number;
    maxAmount: number;
  };
  // Campay configuration
  campayConfig?: {
    appId: string; // encrypted
    isActive: boolean;
    environment: 'demo' | 'production';
    supportedMethods: string[];
    minAmount: number;
    maxAmount: number;
  };
}

// Social Media Preview Settings
export interface SocialMediaPreviewSettings {
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

// Dish Types
export interface Dish {
  id: string;
  title: string;
  price: number;
  image?: string;
  description?: string;
  categoryId: string;
  status: 'active' | 'inactive';
  restaurantId: string;
  createdAt: any;
  updatedAt?: any;
  dailyMenu?: boolean; // New field for delivery menu
}

// Category Types
export interface Category {
  id: string;
  title: string;
  status: 'active' | 'inactive';
  restaurantId: string;
  order?: number;
  deleted?: boolean;
  parentCategoryId?: string | null;
}

// Table Types
export interface Table {
  id: string;
  number: number;
  name?: string;
  status: 'available' | 'occupied' | 'reserved';
  restaurantId: string;
  createdAt: any;
  updatedAt?: any;
}

// Order Types
export interface OrderItem {
  id: string;
  menuItemId: string;
  title: string;
  price: number;
  quantity: number;
  notes?: string;
  image?: string;
}

export interface Order {
  id: string;
  items: OrderItem[];
  restaurantId: string;
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  totalAmount: number;
  customerViewStatus?: string;
  tableNumber?: number;
  createdAt?: any;
  updatedAt?: any;
  deleted?: boolean;
  customerName?: string;
  customerPhone?: string;
  customerLocation?: string;
  deliveryFee?: number;
  mtnFee?: number;
  orangeFee?: number;
  // CinetPay payment fields
  orderType?: 'online' | 'restaurant';
  paymentMethod?: 'cinetpay' | 'campay' | 'whatsapp' | 'cash' | 'card';
  paymentStatus?: 'pending' | 'completed' | 'failed' | 'cancelled';
  cinetpayTransactionId?: string;
  paymentVerified?: boolean;
  cinetpayMetadata?: {
    transactionId: string;
    paymentMethod: string;
    timestamp: string;
  };
  // Campay payment fields
  campayReference?: string;
  campayStatus?: string;
  campayMetadata?: {
    reference: string;
    transactionId?: string;
    paymentMethod?: string;
    timestamp: string;
  };
}

// Demo Account Types
export interface DemoAccount {
  id: string;
  email: string;
  phone: string;
  createdAt: any;
  expiresAt: any;
  active: boolean;
  expired: boolean;
  name: string;
  logo: string;
  colorPalette: {
    primary: string;
    secondary: string;
  };
  // Payment information for Cameroon context
  paymentInfo?: PaymentInfo;
  currency?: string;
  deliveryFee?: number;
  // Template settings for public pages
  publicTemplates?: {
    menu?: TemplateSettings;
    order?: TemplateSettings;
    dailyMenu?: TemplateSettings;
  };
}

// Admin Types
export interface AdminUser {
  id: string;
  email: string;
  role: 'admin' | 'super_admin';
  isDeleted: boolean;
  // Template settings for admin's own customization
  publicTemplates?: {
    menu?: TemplateSettings;
    order?: TemplateSettings;
    dailyMenu?: TemplateSettings;
  };
}

// Activity Log Types
export interface ActivityLog {
  userId?: string;
  userEmail?: string;
  action: string;
  entityType?: string;
  entityId?: string | null;
  details?: any;
  timestamp?: any;
}

// Payment Types for Cameroon
export interface PaymentMethod {
  type: 'momo' | 'om';
  number: string;
  name: string;
}

export interface PaymentInfo {
  momo?: PaymentMethod;
  om?: PaymentMethod;
  mtnMerchantCode?: string;
  orangeMerchantCode?: string;
  paymentLink?: string;
  mtnFee?: number;
  orangeFee?: number;
}

export interface Contact {
  phone: string;
  name: string;
  location: string;
  count: number;
  lastOrderDate: any;
}

// Template Types
export interface PublicTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  category: 'modern' | 'classic' | 'minimal' | 'elegant' | 'bold';
  isActive: boolean;
  isDefault: boolean;
  version: string;
  createdAt: any;
  updatedAt: any;
}

export interface TemplateSettings {
  templateId: string;
  isActive: boolean;
  appliedAt?: any;
  customizations?: {
    headerStyle?: 'centered' | 'left-aligned' | 'minimal';
    cardStyle?: 'rounded' | 'square' | 'elevated' | 'minimal' | 'glass' | 'neon';
    colorScheme?: 'auto' | 'preset' | 'custom';
    presetTheme?: 'warm' | 'cool' | 'elegant' | 'nature' | 'monochrome' | 'vibrant';
    typography?: 'default' | 'elegant' | 'bold' | 'modern' | 'classic' | 'minimal' | 'playful';
    fontFamily?: 'default' | 'serif' | 'sans-serif' | 'monospace' | 'cursive' | 'fantasy';
    textSize?: 'small' | 'medium' | 'large' | 'extra-large';
    lineHeight?: 'tight' | 'normal' | 'relaxed' | 'loose';
    spacing?: 'compact' | 'comfortable' | 'spacious';
    searchBarShape?: 'rounded' | 'square' | 'pill' | 'minimal';
    logoPosition?: 'left' | 'center' | 'right' | 'top-left' | 'top-center' | 'top-right';
    cardLayout?: 'grid' | 'list' | 'masonry' | 'carousel';
    cardPosition?: 'left' | 'center' | 'right' | 'stretch';
    categoryHeaderShape?: 'rounded' | 'square' | 'pill' | 'minimal' | 'banner' | 'underline' | 'gradient';
    categoryHeaderPosition?: 'left' | 'center' | 'right';
    categoryHeaderButtonShape?: 'square' | 'rounded' | 'pill' | 'circle' | 'minimal' | 'elevated';
    categoryTitleColor?: string;
    categoryTitlePosition?: 'left' | 'center' | 'right' | 'justify';
    categoryTitleFontFamily?: 'default' | 'serif' | 'sans-serif' | 'monospace' | 'cursive' | 'fantasy';
    categoryTitleFontSize?: 'small' | 'medium' | 'large' | 'extra-large';
    categoryTitleFontWeight?: 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold';
    // Logo customization
    logoDisplay?: 'show' | 'hide';
    // Restaurant name customization
    restaurantNameSize?: 'small' | 'medium' | 'large' | 'extra-large';
    restaurantNameFont?: 'default' | 'serif' | 'sans-serif' | 'monospace' | 'cursive' | 'fantasy';
    restaurantNamePosition?: 'left' | 'center' | 'right';
    restaurantNameDisplay?: 'show' | 'hide';
    // Translate button customization
    translateButtonPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    translateButtonSize?: 'small' | 'medium' | 'large';
    // Location customization
    locationSize?: 'small' | 'medium' | 'large';
    locationPosition?: 'left' | 'center' | 'right';
    // Contact customization
    contactSize?: 'small' | 'medium' | 'large';
    contactPosition?: 'left' | 'center' | 'right';
    // Category button customization
    categoryButtonShape?: 'square' | 'rounded' | 'pill' | 'circle' | 'minimal' | 'elevated';
    categoryButtonPosition?: 'left' | 'center' | 'right';
    categoryButtonSize?: 'small' | 'medium' | 'large';
    categoryButtonFontFamily?: 'default' | 'serif' | 'sans-serif' | 'monospace' | 'cursive' | 'fantasy';
    // Search bar customization
    searchBarPosition?: 'left' | 'center' | 'right';
    searchBarSize?: 'small' | 'medium' | 'large';
    searchBarShape?: 'square' | 'rounded' | 'pill' | 'minimal';
    // Category title customization
    categoryTitlePosition?: 'left' | 'center' | 'right';
    categoryTitleSize?: 'small' | 'medium' | 'large' | 'extra-large';
    categoryTitleFontFamily?: 'default' | 'serif' | 'sans-serif' | 'monospace' | 'cursive' | 'fantasy';
    categoryTitleAnimation?: 'none' | 'fade-in' | 'slide-up' | 'bounce' | 'pulse';
    // Menu card customization
    menuCardImageSize?: 'small' | 'medium' | 'large' | 'extra-large';
    menuCardImageShape?: 'square' | 'rounded' | 'circle' | 'pill';
    menuCardSize?: 'small' | 'medium' | 'large';
    menuCardShape?: 'square' | 'rounded' | 'minimal';
    menuCardPosition?: 'left' | 'center' | 'right';
    menuCardFontFamily?: 'default' | 'serif' | 'sans-serif' | 'monospace' | 'cursive' | 'fantasy';
    // Separator line customization
    separatorLineSize?: 'small' | 'medium' | 'large' | 'extra-large';
    // Scrollbar customization
    scrollbarSize?: 'small' | 'medium' | 'large' | 'extra-large';
          logoSize?: 'small' | 'medium' | 'large' | 'extra-large';
          cardSize?: 'small' | 'medium' | 'large';
          imageShape?: 'rounded' | 'square' | 'circle' | 'rounded-lg' | 'rounded-xl' | 'rounded-2xl' | 'pill';
          imageSize?: 'small' | 'medium' | 'large' | 'extra-large';
          gridColumns?: 'auto' | '1' | '2' | '3' | '4';
          cardSpacing?: 'tight' | 'normal' | 'loose' | 'extra-loose';
          cardAspectRatio?: 'auto' | 'square' | 'portrait' | 'landscape' | 'wide';
          transitionButtonPosition?: 'bottom-right' | 'bottom-left' | 'bottom-center' | 'top-right' | 'top-left' | 'top-center' | 'floating';
          animationEffects?: 'none' | 'fade' | 'slide' | 'bounce' | 'zoom' | 'flip';
          transitionSpeed?: 'slow' | 'normal' | 'fast';
          borderRadius?: 'none' | 'small' | 'medium' | 'large' | 'extra-large';
          shadowIntensity?: 'none' | 'light' | 'medium' | 'heavy';
          hoverEffects?: 'none' | 'subtle' | 'lift' | 'glow' | 'scale';
    customColors?: {
      primary?: string;
      secondary?: string;
      accent?: string;
      background?: string;
      textPrimary?: string;
      textSecondary?: string;
      logoColor?: string;
      iconColor?: string;
      cardBackground?: string;
      cardBorder?: string;
      searchBackground?: string;
      searchText?: string;
      searchBorder?: string;
      categoryHeaderBackground?: string;
      categoryHeaderText?: string;
      categoryHeaderBorder?: string;
      restaurantNameColor?: string;
      transitionButtonColor?: string;
      transitionButtonBackground?: string;
      bodyLinesColor?: string;
      separatorColor?: string;
      // Translate button colors
      translateButtonColor?: string;
      translateButtonTextColor?: string;
      translateIconColor?: string;
      // Location colors
      locationIconColor?: string;
      locationTextColor?: string;
      // Contact colors
      contactIconColor?: string;
      contactNumberColor?: string;
      // Category button colors
      categoryButtonBackground?: string;
      categoryButtonTextColor?: string;
      // Search bar colors
      searchBarTextColor?: string;
      searchIconColor?: string;
      // Category title colors
      categoryTitleColor?: string;
      // Menu card colors
      menuCardBorderColor?: string;
      menuCardTitleColor?: string;
      menuCardDescriptionColor?: string;
      menuCardPriceColor?: string;
      // Separator line colors
      separatorLineColor?: string;
      // Background colors
      backgroundColor?: string;
      backgroundImage?: string;
      backgroundOpacity?: number;
      // Scrollbar colors
      scrollbarColor?: string;
    };
  };
}

export interface TemplatePreview {
  id: string;
  restaurantId: string;
  isDemo: boolean;
  demoId?: string;
  pageType: 'menu' | 'order' | 'dailyMenu';
  templateId: string;
  settings: TemplateSettings;
  expiresAt: any;
  previewUrl: string;
  createdAt: any;
}

// Media Management Types
export interface MediaItem {
  id: string;
  url: string;
  originalFileName: string;
  dishName?: string;
  restaurantId: string;
  type: 'dish' | 'logo' | 'menu';
  uploadDate: any;
  size: number;
  storagePath: string;
  quality?: number; // Quality rating from 1-5 (5 being highest quality)
  metadata: {
    dishId?: string;
    originalName: string;
    contentType: string;
    customMetadata?: Record<string, string>;
  };
}
