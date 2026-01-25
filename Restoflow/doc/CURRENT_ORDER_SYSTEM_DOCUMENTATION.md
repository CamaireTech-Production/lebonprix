# Current Restaurant Ordering System Documentation

## 🎯 **System Overview**

This is a comprehensive restaurant ordering system built with React, TypeScript, and Firebase Firestore. The system supports both **in-restaurant table ordering** and **public delivery ordering** with WhatsApp integration for payment processing.

## 📊 **System Architecture**

### **Core Technologies**
- **Frontend:** React 18 with TypeScript
- **Backend:** Firebase Firestore (NoSQL database)
- **State Management:** React hooks (useState, useCallback)
- **UI Framework:** Tailwind CSS with custom design system
- **Payment Integration:** WhatsApp-based manual payment processing
- **Offline Support:** IndexedDB with offline sync capabilities

### **Database Structure**
- **Restaurants:** Main entity with payment info and settings
- **Categories:** Menu categories (supports parent-child relationships)
- **MenuItems (Dishes):** Individual food items with pricing
- **Orders:** Customer orders with status tracking
- **Tables:** Restaurant table management
- **MediaItems:** Image storage and management

## 🛒 **Customer Order Flow**

### **1. Menu Browsing Experience**

#### **Public Ordering (Delivery)**
- **URL Pattern:** `/public/order/{restaurantId}`
- **Features:**
  - Browse menu by categories with search functionality
  - Add items to cart with quantity selection
  - Customer information collection (name, phone, location)
  - WhatsApp integration for order placement
  - Multi-language support (English/French)

#### **In-Restaurant Ordering**
- **URL Pattern:** `/customer/menu/{restaurantId}`
- **Features:**
  - Table-based ordering system
  - Real-time order status tracking
  - Offline support with sync when online
  - Order history viewing

### **2. Cart Management System**

#### **Cart State Management**
```typescript
// Cart item structure
interface OrderItem {
  id: string;
  menuItemId: string;
  title: string;
  price: number;
  quantity: number;
  notes?: string;
  image?: string;
}
```

#### **Cart Operations**
- **Add to Cart:** Increment quantity or add new item
- **Update Quantity:** Increment/decrement with +/- buttons
- **Remove Items:** Individual item removal
- **Clear Cart:** Remove all items
- **Persistent Storage:** Cart saved to localStorage per restaurant

### **3. Checkout Process**

#### **Customer Information Collection**
- **Name:** Optional customer name
- **Phone:** Required Cameroon phone number validation
- **Location:** Required delivery/table location
- **Form Validation:** Real-time phone number validation

#### **Order Creation Flow**
1. **Validate Information:** Check phone number and required fields
2. **Calculate Totals:** Subtotal + delivery fees + payment fees
3. **Create Order:** Save to Firestore with 'pending' status
4. **Generate WhatsApp Message:** Format order details with payment instructions
5. **Redirect to WhatsApp:** Open WhatsApp with pre-filled message
6. **Clear Cart:** Reset customer state

## 💳 **Payment System**

### **Current Payment Methods**

#### **1. MTN Mobile Money (MOMO)**
- **USSD Code Generation:** `*126*1*{number}*{amount}#`
- **Merchant Code Support:** Restaurant-specific merchant codes
- **Fee Calculation:** Configurable percentage and fixed fees

#### **2. Orange Money (OM)**
- **USSD Code Generation:** `*150*1*{number}*{amount}#`
- **Merchant Code Support:** Restaurant-specific merchant codes
- **Fee Calculation:** Configurable percentage and fixed fees

#### **3. Payment Links**
- **External Payment Pages:** Custom payment URLs
- **Flexible Integration:** Support for various payment providers

### **Payment Message Generation**
```typescript
// WhatsApp message structure
const message = generatePaymentMessage(
  restaurantName,
  cartItems,
  totalAmount,
  customerPhone,
  customerLocation,
  restaurant.paymentInfo,
  language,
  customerName,
  deliveryFee,
  currencyCode,
  orderId
);
```

### **Payment Flow**
1. **Order Placement:** Customer places order through checkout
2. **WhatsApp Redirect:** System redirects to WhatsApp with payment details
3. **Manual Payment:** Customer completes payment via USSD codes
4. **Payment Confirmation:** Restaurant receives WhatsApp notification
5. **Order Processing:** Restaurant updates order status

## 📱 **Order Management System**

### **Order Status Lifecycle**
```typescript
type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
```

#### **Status Flow**
1. **Pending:** Order placed, awaiting payment confirmation
2. **Preparing:** Payment confirmed, kitchen starts preparation
3. **Ready:** Order ready for pickup/delivery
4. **Completed:** Order fulfilled and delivered
5. **Cancelled:** Order cancelled by customer or restaurant

### **Order Types**

#### **1. Public Orders (Delivery)**
- **Table Number:** 0 (indicates public order)
- **Customer Info:** Name, phone, delivery location
- **Payment:** WhatsApp-based payment processing
- **Communication:** WhatsApp notifications

#### **2. Restaurant Orders (In-house)**
- **Table Number:** Specific table number
- **Customer Info:** Optional name, phone, location
- **Payment:** Can be cash or mobile money
- **Communication:** Real-time status updates

### **Order Processing**

#### **Real-time Updates**
- **Firestore Listeners:** Real-time order status synchronization
- **Customer View:** Live order status tracking
- **Restaurant Dashboard:** Order management interface

#### **Offline Support**
- **IndexedDB Storage:** Offline order queuing
- **Sync Mechanism:** Automatic sync when connection restored
- **Conflict Resolution:** Handle offline/online data conflicts

## 🏗️ **Technical Implementation**

### **Key Components**

#### **1. Cart Management**
```typescript
// useCart hook
const {
  cart,
  addToCart,
  incrementItem,
  decrementItem,
  removeItem,
  clearCart,
  totalCartItems,
  totalCartAmount
} = useCart(language);
```

#### **2. Checkout Processing**
```typescript
// useCheckout hook
const {
  checkoutName,
  checkoutPhone,
  checkoutLocation,
  phoneError,
  placingOrder,
  handleWhatsAppOrder,
  handleRestaurantOrder
} = useCheckout({
  restaurant,
  cart,
  totalCartAmount,
  clearCart,
  createOrder,
  language
});
```

#### **3. Order Service**
```typescript
// Order creation
const orderId = await createOrder({
  items: cart,
  restaurantId: restaurant.id,
  status: 'pending',
  totalAmount: totalCartAmount,
  customerName: checkoutName,
  customerPhone: checkoutPhone,
  customerLocation: checkoutLocation,
  deliveryFee: restaurant.deliveryFee
});
```

### **Database Operations**

#### **Firestore Service Layer**
- **Restaurant-scoped Collections:** All data scoped by restaurant ID
- **Real-time Subscriptions:** Live data synchronization
- **Offline Support:** IndexedDB-based offline storage
- **Error Handling:** Retry logic and error recovery

#### **Order Repository**
```typescript
// Order operations
- createOrder(restaurantId, orderData)
- updateOrderStatus(restaurantId, orderId, status)
- getOrdersByTable(restaurantId, tableNumber)
- subscribeToTableOrders(restaurantId, tableNumber, callback)
```

### **Payment Integration**

#### **Payment Utilities**
```typescript
// USSD code generation
const momoCode = generatePaymentCode('momo', phoneNumber, amount);
const omCode = generatePaymentCode('om', phoneNumber, amount);

// WhatsApp message formatting
const message = generatePaymentMessage(
  restaurantName,
  orderItems,
  totalAmount,
  customerPhone,
  customerLocation,
  paymentInfo,
  language
);
```

#### **Phone Number Validation**
```typescript
// Cameroon phone validation
const isValid = validateCameroonPhone(phoneNumber);
const formatted = formatCameroonPhone(phoneNumber);
const whatsappFormat = formatForWhatsApp(phoneNumber);
```

## 🔄 **Data Flow Architecture**

### **Order Creation Flow**
1. **Customer Action:** Add items to cart
2. **Checkout Initiation:** Fill customer information
3. **Validation:** Validate phone number and required fields
4. **Order Creation:** Save order to Firestore
5. **Payment Processing:** Generate WhatsApp message
6. **WhatsApp Redirect:** Open WhatsApp with order details
7. **State Cleanup:** Clear cart and reset form

### **Order Status Updates**
1. **Restaurant Action:** Update order status in dashboard
2. **Firestore Update:** Status change saved to database
3. **Real-time Sync:** Customer view updates automatically
4. **Activity Logging:** Track status changes for audit

### **Offline Synchronization**
1. **Offline Detection:** Check navigator.onLine status
2. **Queue Operations:** Store actions in IndexedDB
3. **Connection Restoration:** Detect when online
4. **Sync Process:** Replay queued operations
5. **Conflict Resolution:** Handle data conflicts

## 🎨 **User Interface**

### **Design System**
- **Custom Design System:** Consistent colors, typography, spacing
- **Responsive Design:** Mobile-first approach
- **Template System:** Multiple restaurant templates
- **Accessibility:** ARIA labels and keyboard navigation

### **Key UI Components**
- **Menu Grid:** Responsive dish display
- **Cart Panel:** Slide-out cart with item management
- **Checkout Form:** Customer information collection
- **Order Status:** Real-time status indicators
- **Payment Instructions:** Clear payment guidance

## 🔧 **Configuration & Settings**

### **Restaurant Settings**
- **Payment Information:** MOMO/OM numbers and merchant codes
- **Currency Support:** XAF, USD, EUR, NGN
- **Delivery Fees:** Configurable delivery charges
- **WhatsApp Integration:** Restaurant phone number
- **Template Customization:** UI theme and branding

### **Feature Toggles**
- **Order Management:** Enable/disable order processing
- **Table Management:** Enable/disable table system
- **Payment Integration:** Enable/disable payment features
- **Public Menu:** Enable/disable public menu access
- **Template Selection:** Enable/disable template customization

## 📊 **Performance & Optimization**

### **Loading Strategies**
- **Lazy Loading:** Component-based code splitting
- **Image Optimization:** Responsive image loading
- **Caching:** IndexedDB for offline data
- **Real-time Updates:** Efficient Firestore listeners

### **Error Handling**
- **Network Errors:** Offline queue and retry logic
- **Validation Errors:** Real-time form validation
- **Payment Errors:** Graceful fallback to manual payment
- **Sync Conflicts:** Automatic conflict resolution

## 🚀 **Deployment & Hosting**

### **Build Process**
- **Vite Build:** Optimized production builds
- **PWA Support:** Service worker and manifest
- **Static Hosting:** Compatible with various hosting providers
- **Environment Configuration:** Development and production settings

### **Monitoring & Analytics**
- **Visitor Tracking:** Page view and interaction tracking
- **Order Analytics:** Order volume and success rates
- **Error Monitoring:** Real-time error tracking
- **Performance Metrics:** Loading times and user experience

---

## 📝 **Summary**

This restaurant ordering system provides a complete solution for both in-restaurant and delivery ordering with:

- **Dual Ordering Modes:** Table-based and public delivery ordering
- **WhatsApp Integration:** Seamless payment processing via WhatsApp
- **Real-time Updates:** Live order status synchronization
- **Offline Support:** Full offline functionality with sync
- **Multi-language:** English and French support
- **Responsive Design:** Mobile-optimized user experience
- **Admin Dashboard:** Complete order and restaurant management
- **Payment Flexibility:** Multiple payment methods and fee structures

The system is designed to be scalable, maintainable, and user-friendly while providing restaurants with powerful tools to manage their operations effectively.
