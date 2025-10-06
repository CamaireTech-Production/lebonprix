# Unit Testing Implementation Guide
## Le Bon Prix - React/TypeScript Application

### Table of Contents
1. [Project Overview](#project-overview)
2. [Testing Strategy](#testing-strategy)
3. [Testing Tools & Setup](#testing-tools--setup)
4. [Project Structure Analysis](#project-structure-analysis)
5. [Implementation Plan](#implementation-plan)
6. [Testing Patterns & Best Practices](#testing-patterns--best-practices)
7. [Mocking Strategies](#mocking-strategies)
8. [Coverage Goals](#coverage-goals)
9. [Commands & Scripts](#commands--scripts)
10. [Troubleshooting](#troubleshooting)

---

## Project Overview

**Le Bon Prix** is a comprehensive inventory and sales management application built with:

- **Frontend**: React 18 + TypeScript + Vite
- **State Management**: Zustand + React Context
- **Database**: Firebase Firestore
- **UI**: Custom components + Tailwind CSS
- **Features**: 
  - Inventory management (FIFO/LIFO)
  - Sales tracking & reporting
  - Financial calculations
  - PWA capabilities
  - Multi-language support (i18n)
  - Offline functionality

---

## Testing Strategy

### Core Principles
1. **Test Behavior, Not Implementation**: Focus on what the code does, not how it does it
2. **Isolation**: Each test should be independent and not rely on other tests
3. **Realistic Scenarios**: Test with data that mirrors production usage
4. **Fast Feedback**: Tests should run quickly and provide immediate feedback
5. **Maintainable**: Tests should be easy to understand and modify

### Testing Pyramid
```
    /\
   /  \     E2E Tests (5%)
  /____\    - Critical user flows
 /      \   - Cross-browser testing
/        \  - Performance testing
/          \
/            \  Integration Tests (15%)
/              \ - Component interactions
/                \ - API integration
/                  \ - Context providers
/                    \
/                      \  Unit Tests (80%)
/                        \ - Utility functions
/                          \ - Individual components
/                            \ - Custom hooks
/                              \ - Service functions
```

---

## Testing Tools & Setup

### Primary Testing Stack

#### 1. **Vitest** (Test Runner)
```bash
npm install -D vitest @vitest/ui
```
- **Why**: Native Vite integration, fast execution, TypeScript support
- **Features**: Hot reload, parallel execution, coverage reports

#### 2. **React Testing Library** (Component Testing)
```bash
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
```
- **Why**: Encourages testing user behavior, not implementation details
- **Features**: DOM queries, user interactions, accessibility testing

#### 3. **MSW (Mock Service Worker)** (API Mocking)
```bash
npm install -D msw
```
- **Why**: Intercepts network requests at the service worker level
- **Features**: Realistic API mocking, offline testing, request/response inspection

#### 4. **Additional Utilities**
```bash
npm install -D @testing-library/react-hooks jsdom
```

### Configuration Files

#### `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/',
        'public/'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

#### `src/__tests__/setup.ts`
```typescript
import '@testing-library/jest-dom'
import { beforeAll, afterEach, afterAll } from 'vitest'
import { server } from './mocks/server'

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

// Reset handlers after each test
afterEach(() => server.resetHandlers())

// Clean up after all tests
afterAll(() => server.close())

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))
```

---

## Project Structure Analysis

### Current Project Structure
```
src/
├── components/           # UI Components (52 files)
│   ├── auth/            # Authentication components
│   ├── common/          # Reusable UI components
│   ├── dashboard/       # Dashboard-specific components
│   ├── layout/          # Layout components
│   ├── objectives/      # Objectives management
│   ├── products/        # Product management components
│   └── sales/           # Sales-related components
├── contexts/            # React Context providers
├── hooks/               # Custom React hooks (10 files)
├── pages/               # Page components (13 files)
├── services/            # Business logic services (12 files)
├── types/               # TypeScript type definitions
├── utils/               # Utility functions (10 files)
└── i18n/                # Internationalization
```

### Testing Structure (Proposed)
```
src/
├── __tests__/                    # Test utilities and setup
│   ├── setup.ts                  # Global test setup
│   ├── mocks/                    # Mock implementations
│   │   ├── firebase.ts          # Firebase/Firestore mocks
│   │   ├── localStorage.ts      # localStorage mocks
│   │   ├── handlers.ts          # MSW API handlers
│   │   ├── pwa.ts              # PWA API mocks
│   │   └── i18n.ts             # i18n mocks
│   └── utils/                   # Test utilities
│       ├── render.tsx           # Custom render with providers
│       ├── test-utils.ts        # Helper functions
│       └── fixtures/            # Test data fixtures
│           ├── products.ts      # Product test data
│           ├── sales.ts         # Sales test data
│           ├── users.ts         # User test data
│           └── companies.ts     # Company test data
├── components/
│   ├── common/
│   │   ├── Button.test.tsx      # Component tests
│   │   ├── Modal.test.tsx
│   │   ├── Input.test.tsx
│   │   ├── Select.test.tsx
│   │   └── Table.test.tsx
│   ├── sales/
│   │   ├── AddSaleModal.test.tsx
│   │   ├── SaleDetailsModal.test.tsx
│   │   └── Invoice.test.tsx
│   └── products/
│       ├── StockBatchManager.test.tsx
│       ├── CostPriceCarousel.test.tsx
│       └── RestockModal.test.tsx
├── hooks/
│   ├── useFinancialData.test.ts
│   ├── useAddSaleForm.test.ts
│   ├── useInfiniteProducts.test.ts
│   ├── useInfiniteSales.test.ts
│   ├── useInfiniteExpenses.test.ts
│   ├── useStockBatches.test.ts
│   └── usePWA.test.ts
├── services/
│   ├── firestore.test.ts
│   ├── localStorageService.test.ts
│   ├── backgroundSync.test.ts
│   └── storage/
│       ├── ProductsManager.test.ts
│       ├── SalesManager.test.ts
│       ├── ExpensesManager.test.ts
│       └── CompanyManager.test.ts
├── utils/
│   ├── inventoryManagement.test.ts
│   ├── productUtils.test.ts
│   ├── fifoDebugger.test.ts
│   ├── activityUtils.test.ts
│   └── pdf.test.ts
├── contexts/
│   └── AuthContext.test.tsx
└── pages/
    ├── Dashboard.test.tsx
    ├── Products.test.tsx
    ├── Sales.test.tsx
    └── Expenses.test.tsx
```

---

## Implementation Plan

### Phase 1: Foundation Setup (Week 1-2)

#### 1.1 Install Dependencies
```bash
# Core testing dependencies
npm install -D vitest @vitest/ui @vitest/coverage-v8
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D msw jsdom

# Additional utilities
npm install -D @testing-library/react-hooks
```

#### 1.2 Create Configuration Files
- [ ] `vitest.config.ts` - Vitest configuration
- [ ] `src/__tests__/setup.ts` - Global test setup
- [ ] `src/__tests__/mocks/server.ts` - MSW server setup

#### 1.3 Create Test Utilities
- [ ] `src/__tests__/utils/render.tsx` - Custom render function
- [ ] `src/__tests__/utils/test-utils.ts` - Helper functions
- [ ] `src/__tests__/mocks/firebase.ts` - Firebase mocks

#### 1.4 Create Test Data Fixtures
- [ ] `src/__tests__/utils/fixtures/products.ts`
- [ ] `src/__tests__/utils/fixtures/sales.ts`
- [ ] `src/__tests__/utils/fixtures/users.ts`
- [ ] `src/__tests__/utils/fixtures/companies.ts`

### Phase 2: Utility Functions Testing (Week 3-4)

#### 2.1 Business Logic Utils (Priority: HIGH)
- [ ] `utils/inventoryManagement.test.ts`
  - `getAvailableStockBatches()`
  - `consumeStockFromBatches()`
  - `createStockBatch()`
  - `validateStockBatch()`
  - `calculateFIFOProfit()`
  - `calculateLIFOProfit()`

- [ ] `utils/productUtils.test.ts`
  - `getLatestCostPrice()`
  - `calculateProductProfit()`
  - `formatProductData()`
  - `validateProductData()`

- [ ] `utils/fifoDebugger.test.ts`
  - FIFO calculation accuracy
  - Batch consumption logic
  - Profit calculation validation

#### 2.2 Financial Calculations (Priority: HIGH)
- [ ] `utils/financialCalculations.test.ts` (to be created)
  - `calculateTotalProfit()`
  - `calculateProfitMargin()`
  - `calculateSolde()`
  - `formatCurrency()`

#### 2.3 Other Utilities (Priority: MEDIUM)
- [ ] `utils/activityUtils.test.ts`
- [ ] `utils/pdf.test.ts`
- [ ] `utils/imageCompression.test.ts`

### Phase 3: Service Layer Testing (Week 5-6)

#### 3.1 Firestore Services (Priority: HIGH)
- [ ] `services/firestore.test.ts`
  - CRUD operations for all models
  - Batch operations
  - Real-time listeners
  - Offline synchronization
  - Error handling

#### 3.2 Storage Managers (Priority: HIGH)
- [ ] `services/storage/ProductsManager.test.ts`
- [ ] `services/storage/SalesManager.test.ts`
- [ ] `services/storage/ExpensesManager.test.ts`
- [ ] `services/storage/CompanyManager.test.ts`

#### 3.3 Background Services (Priority: MEDIUM)
- [ ] `services/backgroundSync.test.ts`
- [ ] `services/localStorageService.test.ts`
- [ ] `services/stockAdjustments.test.ts`

### Phase 4: Custom Hooks Testing (Week 7-8)

#### 4.1 Data Fetching Hooks (Priority: HIGH)
- [ ] `hooks/useFinancialData.test.ts`
- [ ] `hooks/useInfiniteProducts.test.ts`
- [ ] `hooks/useInfiniteSales.test.ts`
- [ ] `hooks/useInfiniteExpenses.test.ts`

#### 4.2 Form Hooks (Priority: HIGH)
- [ ] `hooks/useAddSaleForm.test.ts`
- [ ] `hooks/useObjectives.test.ts`

#### 4.3 Utility Hooks (Priority: MEDIUM)
- [ ] `hooks/useStockBatches.test.ts`
- [ ] `hooks/usePWA.test.ts`
- [ ] `hooks/useInfiniteScroll.test.ts`

### Phase 5: Component Testing (Week 9-10)

#### 5.1 Common Components (Priority: MEDIUM)
- [ ] `components/common/Button.test.tsx`
- [ ] `components/common/Modal.test.tsx`
- [ ] `components/common/Input.test.tsx`
- [ ] `components/common/Select.test.tsx`
- [ ] `components/common/Table.test.tsx`
- [ ] `components/common/CreatableSelect.test.tsx`

#### 5.2 Business Components (Priority: HIGH)
- [ ] `components/sales/AddSaleModal.test.tsx`
- [ ] `components/sales/SaleDetailsModal.test.tsx`
- [ ] `components/products/StockBatchManager.test.tsx`
- [ ] `components/products/CostPriceCarousel.test.tsx`

#### 5.3 Layout Components (Priority: LOW)
- [ ] `components/layout/MainLayout.test.tsx`
- [ ] `components/layout/Sidebar.test.tsx`
- [ ] `components/layout/Navbar.test.tsx`

### Phase 6: Context Testing (Week 11)

#### 6.1 Authentication Context (Priority: HIGH)
- [ ] `contexts/AuthContext.test.tsx`
  - User authentication
  - Company management
  - Password updates
  - Session management

### Phase 7: Page Testing (Week 12)

#### 7.1 Core Pages (Priority: MEDIUM)
- [ ] `pages/Dashboard.test.tsx`
- [ ] `pages/Products.test.tsx`
- [ ] `pages/Sales.test.tsx`
- [ ] `pages/Expenses.test.tsx`

#### 7.2 Secondary Pages (Priority: LOW)
- [ ] `pages/Reports.test.tsx`
- [ ] `pages/Settings.test.tsx`
- [ ] `pages/Suppliers.test.tsx`

---

## Testing Patterns & Best Practices

### 1. Component Testing Patterns

#### Basic Component Test
```typescript
import { render, screen, userEvent } from '@/__tests__/utils/render'
import { Button } from '@/components/common/Button'

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('handles click events', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()
    
    render(<Button onClick={handleClick}>Click me</Button>)
    
    await user.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('shows loading state', () => {
    render(<Button isLoading>Loading</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })
})
```

#### Form Component Test
```typescript
import { render, screen, userEvent, waitFor } from '@/__tests__/utils/render'
import { AddSaleModal } from '@/components/sales/AddSaleModal'

describe('AddSaleModal', () => {
  it('submits form with valid data', async () => {
    const user = userEvent.setup()
    const mockOnClose = vi.fn()
    
    render(<AddSaleModal isOpen={true} onClose={mockOnClose} />)
    
    // Fill form
    await user.type(screen.getByLabelText(/customer name/i), 'John Doe')
    await user.type(screen.getByLabelText(/phone/i), '1234567890')
    
    // Add product
    await user.click(screen.getByText(/add product/i))
    await user.selectOptions(screen.getByLabelText(/product/i), 'product-1')
    await user.type(screen.getByLabelText(/quantity/i), '2')
    
    // Submit
    await user.click(screen.getByRole('button', { name: /save sale/i }))
    
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled()
    })
  })
})
```

### 2. Hook Testing Patterns

#### Custom Hook Test
```typescript
import { renderHook, act } from '@testing-library/react'
import { useFinancialData } from '@/hooks/useFinancialData'

describe('useFinancialData', () => {
  it('calculates financial data correctly', async () => {
    const { result } = renderHook(() => useFinancialData())
    
    await act(async () => {
      // Wait for data to load
    })
    
    expect(result.current.financialCalculations.profit).toBeGreaterThan(0)
    expect(result.current.financialCalculations.totalSalesAmount).toBeGreaterThan(0)
  })
})
```

### 3. Service Testing Patterns

#### Firestore Service Test
```typescript
import { vi } from 'vitest'
import { addProduct, getProducts } from '@/services/firestore'
import { mockFirestore } from '@/__tests__/mocks/firebase'

describe('Firestore Services', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('adds product successfully', async () => {
    const productData = {
      name: 'Test Product',
      costPrice: 10,
      sellingPrice: 15,
      stock: 100
    }

    const result = await addProduct(productData)
    
    expect(result.id).toBeDefined()
    expect(mockFirestore.collection).toHaveBeenCalledWith('products')
  })
})
```

### 4. Utility Function Testing Patterns

#### Pure Function Test
```typescript
import { calculateFIFOProfit, consumeStockFromBatches } from '@/utils/inventoryManagement'
import { mockStockBatches } from '@/__tests__/utils/fixtures/products'

describe('inventoryManagement', () => {
  describe('consumeStockFromBatches', () => {
    it('consumes stock using FIFO method', () => {
      const batches = mockStockBatches
      const quantity = 5
      
      const result = consumeStockFromBatches(batches, quantity, 'FIFO')
      
      expect(result.consumedBatches).toHaveLength(2)
      expect(result.totalCost).toBe(50) // 3 * 10 + 2 * 10
      expect(result.primaryBatchId).toBe('batch-1')
    })
  })
})
```

---

## Mocking Strategies

### 1. Firebase/Firestore Mocking

#### `src/__tests__/mocks/firebase.ts`
```typescript
import { vi } from 'vitest'

export const mockFirestore = {
  collection: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
  writeBatch: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}

export const mockAuth = {
  currentUser: null,
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}

// Mock Firebase modules
vi.mock('firebase/firestore', () => ({
  ...mockFirestore,
  Timestamp: {
    fromDate: vi.fn((date) => ({ seconds: date.getTime() / 1000, nanoseconds: 0 })),
    now: vi.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
  }
}))

vi.mock('firebase/auth', () => ({
  ...mockAuth,
  getAuth: vi.fn(() => mockAuth),
}))

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
}))
```

### 2. MSW API Handlers

#### `src/__tests__/mocks/handlers.ts`
```typescript
import { http, HttpResponse } from 'msw'

export const handlers = [
  // Products API
  http.get('/api/products', () => {
    return HttpResponse.json({
      products: [
        { id: '1', name: 'Product 1', costPrice: 10, sellingPrice: 15 },
        { id: '2', name: 'Product 2', costPrice: 20, sellingPrice: 25 },
      ]
    })
  }),

  http.post('/api/products', async ({ request }) => {
    const product = await request.json()
    return HttpResponse.json({ id: '3', ...product }, { status: 201 })
  }),

  // Sales API
  http.get('/api/sales', () => {
    return HttpResponse.json({
      sales: [
        { id: '1', totalAmount: 100, status: 'paid' },
        { id: '2', totalAmount: 150, status: 'pending' },
      ]
    })
  }),

  // Error scenarios
  http.get('/api/error', () => {
    return HttpResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }),
]
```

### 3. localStorage Mocking

#### `src/__tests__/mocks/localStorage.ts`
```typescript
import { vi } from 'vitest'

const createLocalStorageMock = () => {
  let store: Record<string, string> = {}

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  }
}

export const mockLocalStorage = createLocalStorageMock()

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
})
```

### 4. Custom Render Function

#### `src/__tests__/utils/render.tsx`
```typescript
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n/config'

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[]
  user?: any
  company?: any
}

const AllTheProviders = ({ children, user, company }: any) => {
  return (
    <BrowserRouter>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </I18nextProvider>
    </BrowserRouter>
  )
}

const customRender = (
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { initialEntries = ['/'], user = null, company = null, ...renderOptions } = options

  // Mock auth state if provided
  if (user) {
    vi.mocked(mockAuth.currentUser).mockReturnValue(user)
  }

  return render(ui, {
    wrapper: (props) => <AllTheProviders {...props} user={user} company={company} />,
    ...renderOptions,
  })
}

export * from '@testing-library/react'
export { customRender as render }
```

---

## Coverage Goals

### Target Coverage Metrics
- **Overall Project**: 85%+
- **Utility Functions**: 95%+
- **Service Layer**: 90%+
- **Custom Hooks**: 85%+
- **Components**: 80%+
- **Pages**: 70%+

### Coverage Configuration
```typescript
// vitest.config.ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  exclude: [
    'node_modules/',
    'src/__tests__/',
    '**/*.d.ts',
    '**/*.config.*',
    'dist/',
    'public/',
    'src/main.tsx',
    'src/vite-env.d.ts'
  ],
  thresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Specific thresholds for critical files
    'src/utils/inventoryManagement.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    'src/services/firestore.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
}
```

---

## Commands & Scripts

### Package.json Scripts
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:watch": "vitest --watch",
    "test:run": "vitest run",
    "test:ci": "vitest run --coverage --reporter=verbose",
    "test:update-snapshots": "vitest --update-snapshots"
  }
}
```

### Common Test Commands
```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui

# Run specific test file
npm run test Button.test.tsx

# Run tests matching pattern
npm run test -- --grep "Button"

# Run tests in specific directory
npm run test src/components/common/

# Update snapshots
npm run test:update-snapshots
```

---

## Troubleshooting

### Common Issues & Solutions

#### 1. Firebase Import Issues
```typescript
// Problem: Firebase modules not mocking correctly
// Solution: Ensure proper module mocking in setup.ts

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  // ... other exports
}))
```

#### 2. React Router Issues
```typescript
// Problem: useNavigate/useLocation not working in tests
// Solution: Wrap components with BrowserRouter in custom render

const customRender = (ui: React.ReactElement) => {
  return render(ui, {
    wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>
  })
}
```

#### 3. Async Operations
```typescript
// Problem: Tests failing due to async operations
// Solution: Use proper async/await patterns

it('handles async operation', async () => {
  const { result } = renderHook(() => useFinancialData())
  
  await act(async () => {
    // Wait for async operation to complete
  })
  
  expect(result.current.loading).toBe(false)
})
```

#### 4. MSW Not Intercepting Requests
```typescript
// Problem: MSW not intercepting API calls
// Solution: Ensure proper server setup and handlers

import { server } from '@/__tests__/mocks/server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

#### 5. localStorage Issues
```typescript
// Problem: localStorage not working in tests
// Solution: Use proper localStorage mocking

const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
})
```

### Performance Optimization

#### 1. Parallel Test Execution
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false
      }
    }
  }
})
```

#### 2. Test Data Optimization
```typescript
// Use factories for test data generation
const createProduct = (overrides = {}) => ({
  id: '1',
  name: 'Test Product',
  costPrice: 10,
  sellingPrice: 15,
  stock: 100,
  ...overrides
})
```

#### 3. Mock Optimization
```typescript
// Use vi.hoisted for expensive mocks
const mockExpensiveFunction = vi.hoisted(() => vi.fn())
```

---

## Conclusion

This comprehensive testing strategy will ensure your Le Bon Prix application is robust, maintainable, and reliable. The phased approach allows for incremental implementation while maintaining development velocity.

### Key Success Factors:
1. **Start with utilities** - They're the foundation of your application
2. **Mock external dependencies** - Firebase, localStorage, APIs
3. **Test user behavior** - Focus on what users do, not implementation
4. **Maintain high coverage** - Especially for business logic
5. **Keep tests fast** - Use proper mocking and parallel execution

### Next Steps:
1. Set up the testing environment (Phase 1)
2. Begin with utility function tests (Phase 2)
3. Gradually move to services, hooks, and components
4. Continuously monitor coverage and test quality

Remember: **Good tests are an investment in your application's future maintainability and reliability.**
