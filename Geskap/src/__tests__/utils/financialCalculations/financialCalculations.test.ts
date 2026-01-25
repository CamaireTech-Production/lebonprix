import { describe, it, expect } from 'vitest'
import {
  calculateTotalProfit,
  calculateTotalExpenses,
  calculateSolde,
  calculateTotalPurchasePrice,
  calculateTotalSalesAmount,
  calculateTotalDeliveryFee,
  calculateTotalProductsSold,
  calculateTotalOrders,
  calculateTotalDebt
} from '../../../utils/financialCalculations'
import type { Sale, Product, Expense, FinanceEntry, StockChange } from '../../../types/models'
import { Timestamp } from 'firebase/firestore'

/**
 * PROBLEMS IDENTIFIED BEFORE TESTS:
 * 
 * 1. Business logic was mixed with UI components - REFACTORED
 *    - Extracted all financial calculations into pure functions in financialCalculations.ts
 * 
 * 2. Calculations were duplicated across Finance.tsx, Dashboard.tsx, useFinancialData.ts - REFACTORED
 *    - Created single source of truth in financialCalculations.ts
 * 
 * REFACTORING PERFORMED:
 * - Created 9 pure functions for all financial calculations
 * - Refactored Finance.tsx, Dashboard.tsx, useFinancialData.ts, Suppliers.tsx to use extracted functions
 * - All calculations are now testable in isolation
 */

// Helper to create mock Timestamp
const createTimestamp = (date: Date): Timestamp => {
  return Timestamp.fromDate(date)
}

// Mock data factories
const createMockProduct = (id: string, name: string, stock: number = 10, costPrice: number = 100): Product => ({
  id,
  name,
  costPrice,
  sellingPrice: 150,
  stock,
  reference: `REF-${id}`,
  userId: 'user1',
  companyId: 'company1',
  createdAt: createTimestamp(new Date()),
  updatedAt: createTimestamp(new Date())
})

const createMockSale = (
  id: string,
  products: Array<{ productId: string; quantity: number; basePrice: number; negotiatedPrice?: number }>,
  deliveryFee: number = 0
): Sale => {
  const totalAmount = products.reduce((sum, p) => sum + (p.negotiatedPrice || p.basePrice) * p.quantity, 0) + deliveryFee
  
  return {
    id,
    products: products.map(p => ({
      productId: p.productId,
      quantity: p.quantity,
      basePrice: p.basePrice,
      negotiatedPrice: p.negotiatedPrice,
      costPrice: 0,
      profit: 0,
      profitMargin: 0
    })),
    totalAmount,
    status: 'paid' as const,
    paymentStatus: 'paid' as const,
    customerInfo: {
      name: 'Test Customer',
      phone: '1234567890'
    },
    deliveryFee,
    userId: 'user1',
    companyId: 'company1',
    createdAt: createTimestamp(new Date()),
    updatedAt: createTimestamp(new Date())
  }
}

const createMockExpense = (id: string, amount: number, category: string = 'Utilities'): Expense => ({
  id,
  description: `${category} expense`,
  amount,
  category,
  userId: 'user1',
  companyId: 'company1',
  createdAt: createTimestamp(new Date()),
  updatedAt: createTimestamp(new Date())
})

const createMockFinanceEntry = (
  id: string,
  type: string,
  amount: number,
  sourceType: 'sale' | 'expense' | 'manual' | 'supplier' = 'manual',
  refundedDebtId?: string
): FinanceEntry => ({
  id,
  userId: 'user1',
  companyId: 'company1',
  sourceType,
  type,
  amount,
  date: createTimestamp(new Date()),
  isDeleted: false,
  createdAt: createTimestamp(new Date()),
  updatedAt: createTimestamp(new Date()),
  refundedDebtId
})

const createMockStockChange = (
  id: string,
  productId: string,
  change: number,
  costPrice: number,
  timestamp: Date = new Date()
): StockChange => ({
  id,
  productId,
  change,
  reason: 'restock' as const,
  costPrice,
  userId: 'user1',
  companyId: 'company1',
  createdAt: createTimestamp(timestamp),
  updatedAt: createTimestamp(timestamp)
})

describe('Financial Calculations', () => {
  describe('calculateTotalProfit', () => {
    it('should calculate profit correctly for single sale with single product', () => {
      const products = [createMockProduct('p1', 'Product 1')]
      const sales = [createMockSale('s1', [{ productId: 'p1', quantity: 2, basePrice: 150 }])]
      const stockChanges = [createMockStockChange('sc1', 'p1', 10, 100)]

      const profit = calculateTotalProfit(sales, products, stockChanges)

      // Profit = (sellingPrice - costPrice) * quantity = (150 - 100) * 2 = 100
      expect(profit).toBe(100)
    })

    it('should calculate profit correctly for multiple products', () => {
      const products = [
        createMockProduct('p1', 'Product 1'),
        createMockProduct('p2', 'Product 2')
      ]
      const sales = [
        createMockSale('s1', [
          { productId: 'p1', quantity: 2, basePrice: 150 },
          { productId: 'p2', quantity: 3, basePrice: 200 }
        ])
      ]
      const stockChanges = [
        createMockStockChange('sc1', 'p1', 10, 100),
        createMockStockChange('sc2', 'p2', 10, 150)
      ]

      const profit = calculateTotalProfit(sales, products, stockChanges)

      // P1: (150 - 100) * 2 = 100
      // P2: (200 - 150) * 3 = 150
      // Total = 250
      expect(profit).toBe(250)
    })

    it('should use negotiated price when available', () => {
      const products = [createMockProduct('p1', 'Product 1')]
      const sales = [createMockSale('s1', [{ productId: 'p1', quantity: 2, basePrice: 150, negotiatedPrice: 140 }])]
      const stockChanges = [createMockStockChange('sc1', 'p1', 10, 100)]

      const profit = calculateTotalProfit(sales, products, stockChanges)

      // Profit = (negotiatedPrice - costPrice) * quantity = (140 - 100) * 2 = 80
      expect(profit).toBe(80)
    })

    it('should return 0 for empty sales', () => {
      const products = [createMockProduct('p1', 'Product 1')]
      const sales: Sale[] = []
      const stockChanges = [createMockStockChange('sc1', 'p1', 10, 100)]

      const profit = calculateTotalProfit(sales, products, stockChanges)

      expect(profit).toBe(0)
    })

    it('should skip products not found in product list', () => {
      const products = [createMockProduct('p1', 'Product 1')]
      const sales = [
        createMockSale('s1', [
          { productId: 'p1', quantity: 2, basePrice: 150 },
          { productId: 'p_nonexistent', quantity: 3, basePrice: 200 }
        ])
      ]
      const stockChanges = [createMockStockChange('sc1', 'p1', 10, 100)]

      const profit = calculateTotalProfit(sales, products, stockChanges)

      // Only P1 profit: (150 - 100) * 2 = 100
      expect(profit).toBe(100)
    })

    it('should skip products with undefined cost price', () => {
      const products = [createMockProduct('p1', 'Product 1'), createMockProduct('p2', 'Product 2')]
      const sales = [
        createMockSale('s1', [
          { productId: 'p1', quantity: 2, basePrice: 150 },
          { productId: 'p2', quantity: 3, basePrice: 200 }
        ])
      ]
      // Only p1 has cost price info
      const stockChanges = [createMockStockChange('sc1', 'p1', 10, 100)]

      const profit = calculateTotalProfit(sales, products, stockChanges)

      // Only P1 profit: (150 - 100) * 2 = 100
      expect(profit).toBe(100)
    })

    it('should handle empty products array', () => {
      const products: Product[] = []
      const sales = [createMockSale('s1', [{ productId: 'p1', quantity: 2, basePrice: 150 }])]
      const stockChanges = [createMockStockChange('sc1', 'p1', 10, 100)]

      const profit = calculateTotalProfit(sales, products, stockChanges)

      expect(profit).toBe(0)
    })

    it('should handle empty stock changes array', () => {
      const products = [createMockProduct('p1', 'Product 1')]
      const sales = [createMockSale('s1', [{ productId: 'p1', quantity: 2, basePrice: 150 }])]
      const stockChanges: StockChange[] = []

      const profit = calculateTotalProfit(sales, products, stockChanges)

      expect(profit).toBe(0)
    })

    it('should calculate profit for multiple sales', () => {
      const products = [createMockProduct('p1', 'Product 1')]
      const sales = [
        createMockSale('s1', [{ productId: 'p1', quantity: 2, basePrice: 150 }]),
        createMockSale('s2', [{ productId: 'p1', quantity: 3, basePrice: 150 }])
      ]
      const stockChanges = [createMockStockChange('sc1', 'p1', 10, 100)]

      const profit = calculateTotalProfit(sales, products, stockChanges)

      // Sale 1: (150 - 100) * 2 = 100
      // Sale 2: (150 - 100) * 3 = 150
      // Total = 250
      expect(profit).toBe(250)
    })
  })

  describe('calculateTotalExpenses', () => {
    it('should calculate total expenses from expenses only', () => {
      const expenses = [
        createMockExpense('e1', 1000),
        createMockExpense('e2', 2000)
      ]
      const manualEntries: FinanceEntry[] = []

      const total = calculateTotalExpenses(expenses, manualEntries)

      expect(total).toBe(3000)
    })

    it('should include absolute value of negative manual entries', () => {
      const expenses = [createMockExpense('e1', 1000)]
      const manualEntries = [
        createMockFinanceEntry('m1', 'manual', -500, 'manual'),
        createMockFinanceEntry('m2', 'manual', -300, 'manual')
      ]

      const total = calculateTotalExpenses(expenses, manualEntries)

      // 1000 + |-500| + |-300| = 1000 + 500 + 300 = 1800
      expect(total).toBe(1800)
    })

    it('should ignore positive manual entries', () => {
      const expenses = [createMockExpense('e1', 1000)]
      const manualEntries = [
        createMockFinanceEntry('m1', 'manual', 500, 'manual'),
        createMockFinanceEntry('m2', 'manual', -300, 'manual')
      ]

      const total = calculateTotalExpenses(expenses, manualEntries)

      // 1000 + |-300| = 1000 + 300 = 1300 (positive 500 ignored)
      expect(total).toBe(1300)
    })

    it('should return 0 for empty inputs', () => {
      const total = calculateTotalExpenses([], [])

      expect(total).toBe(0)
    })

    it('should handle only expenses with empty manual entries', () => {
      const expenses = [createMockExpense('e1', 1500)]
      const manualEntries: FinanceEntry[] = []

      const total = calculateTotalExpenses(expenses, manualEntries)

      expect(total).toBe(1500)
    })

    it('should handle only manual entries with empty expenses', () => {
      const expenses: Expense[] = []
      const manualEntries = [
        createMockFinanceEntry('m1', 'manual', -500, 'manual'),
        createMockFinanceEntry('m2', 'manual', -300, 'manual')
      ]

      const total = calculateTotalExpenses(expenses, manualEntries)

      expect(total).toBe(800)
    })
  })

  describe('calculateSolde', () => {
    it('should calculate solde from non-debt entries only', () => {
      const financeEntries = [
        createMockFinanceEntry('f1', 'sale', 5000, 'sale'),
        createMockFinanceEntry('f2', 'expense', -1000, 'expense'),
        createMockFinanceEntry('f3', 'manual', 2000, 'manual')
      ]

      const solde = calculateSolde(financeEntries, [], [])

      // 5000 + (-1000) + 2000 = 6000
      expect(solde).toBe(6000)
    })

    it('should exclude debt entries from calculation', () => {
      const financeEntries = [
        createMockFinanceEntry('f1', 'sale', 5000, 'sale'),
        createMockFinanceEntry('f2', 'debt', 3000, 'manual'),
        createMockFinanceEntry('f3', 'manual', 2000, 'manual')
      ]

      const solde = calculateSolde(financeEntries, [], [])

      // 5000 + 2000 = 7000 (debt excluded)
      expect(solde).toBe(7000)
    })

    it('should exclude refund entries from calculation', () => {
      const financeEntries = [
        createMockFinanceEntry('f1', 'sale', 5000, 'sale'),
        createMockFinanceEntry('f2', 'refund', 1000, 'manual'),
        createMockFinanceEntry('f3', 'manual', 2000, 'manual')
      ]

      const solde = calculateSolde(financeEntries, [], [])

      // 5000 + 2000 = 7000 (refund excluded)
      expect(solde).toBe(7000)
    })

    it('should exclude supplier_debt entries from calculation', () => {
      const financeEntries = [
        createMockFinanceEntry('f1', 'sale', 5000, 'sale'),
        createMockFinanceEntry('f2', 'supplier_debt', 2000, 'supplier'),
        createMockFinanceEntry('f3', 'manual', 1000, 'manual')
      ]

      const solde = calculateSolde(financeEntries, [], [])

      // 5000 + 1000 = 6000 (supplier_debt excluded)
      expect(solde).toBe(6000)
    })

    it('should exclude supplier_refund entries from calculation', () => {
      const financeEntries = [
        createMockFinanceEntry('f1', 'sale', 5000, 'sale'),
        createMockFinanceEntry('f2', 'supplier_refund', 500, 'supplier'),
        createMockFinanceEntry('f3', 'manual', 1000, 'manual')
      ]

      const solde = calculateSolde(financeEntries, [], [])

      // 5000 + 1000 = 6000 (supplier_refund excluded)
      expect(solde).toBe(6000)
    })

    it('should add customer debt when debt entries provided', () => {
      const financeEntries = [
        createMockFinanceEntry('f1', 'sale', 5000, 'sale')
      ]
      const debtEntries = [
        createMockFinanceEntry('d1', 'debt', 3000, 'manual')
      ]
      const refundEntries: FinanceEntry[] = []

      const solde = calculateSolde(financeEntries, debtEntries, refundEntries)

      // 5000 + 3000 = 8000
      expect(solde).toBe(8000)
    })

    it('should subtract linked refunds from customer debt', () => {
      const financeEntries = [
        createMockFinanceEntry('f1', 'sale', 5000, 'sale')
      ]
      const debtEntries = [
        createMockFinanceEntry('d1', 'debt', 3000, 'manual')
      ]
      const refundEntries = [
        createMockFinanceEntry('r1', 'refund', 1000, 'manual', 'd1')
      ]

      const solde = calculateSolde(financeEntries, debtEntries, refundEntries)

      // 5000 + (3000 - 1000) = 7000
      expect(solde).toBe(7000)
    })

    it('should not go negative for fully refunded debt', () => {
      const financeEntries = [
        createMockFinanceEntry('f1', 'sale', 5000, 'sale')
      ]
      const debtEntries = [
        createMockFinanceEntry('d1', 'debt', 2000, 'manual')
      ]
      const refundEntries = [
        createMockFinanceEntry('r1', 'refund', 2500, 'manual', 'd1') // Over-refunded
      ]

      const solde = calculateSolde(financeEntries, debtEntries, refundEntries)

      // 5000 + max(0, 2000 - 2500) = 5000 + 0 = 5000
      expect(solde).toBe(5000)
    })

    it('should return 0 for empty finance entries', () => {
      const solde = calculateSolde([], [], [])

      expect(solde).toBe(0)
    })
  })

  describe('calculateTotalPurchasePrice', () => {
    it('should calculate total purchase price for single product', () => {
      const products = [createMockProduct('p1', 'Product 1', 10)]
      const stockChanges = [createMockStockChange('sc1', 'p1', 10, 100)]

      const total = calculateTotalPurchasePrice(products, stockChanges)

      // costPrice * stock = 100 * 10 = 1000
      expect(total).toBe(1000)
    })

    it('should calculate total purchase price for multiple products', () => {
      const products = [
        createMockProduct('p1', 'Product 1', 10),
        createMockProduct('p2', 'Product 2', 5)
      ]
      const stockChanges = [
        createMockStockChange('sc1', 'p1', 10, 100),
        createMockStockChange('sc2', 'p2', 5, 200)
      ]

      const total = calculateTotalPurchasePrice(products, stockChanges)

      // P1: 100 * 10 = 1000
      // P2: 200 * 5 = 1000
      // Total = 2000
      expect(total).toBe(2000)
    })

    it('should skip products with undefined cost price', () => {
      const products = [
        createMockProduct('p1', 'Product 1', 10),
        createMockProduct('p2', 'Product 2', 5)
      ]
      // Only p1 has cost price
      const stockChanges = [createMockStockChange('sc1', 'p1', 10, 100)]

      const total = calculateTotalPurchasePrice(products, stockChanges)

      // Only P1: 100 * 10 = 1000
      expect(total).toBe(1000)
    })

    it('should return 0 for empty products', () => {
      const products: Product[] = []
      const stockChanges = [createMockStockChange('sc1', 'p1', 10, 100)]

      const total = calculateTotalPurchasePrice(products, stockChanges)

      expect(total).toBe(0)
    })

    it('should return 0 for empty stock changes', () => {
      const products = [createMockProduct('p1', 'Product 1', 10)]
      const stockChanges: StockChange[] = []

      const total = calculateTotalPurchasePrice(products, stockChanges)

      expect(total).toBe(0)
    })

    it('should handle products with zero stock', () => {
      const products = [createMockProduct('p1', 'Product 1', 0)]
      const stockChanges = [createMockStockChange('sc1', 'p1', 10, 100)]

      const total = calculateTotalPurchasePrice(products, stockChanges)

      expect(total).toBe(0)
    })
  })

  describe('calculateTotalSalesAmount', () => {
    it('should calculate total sales amount for single sale', () => {
      const sales = [createMockSale('s1', [{ productId: 'p1', quantity: 2, basePrice: 150 }], 10)]

      const total = calculateTotalSalesAmount(sales)

      // 2 * 150 + 10 = 310
      expect(total).toBe(310)
    })

    it('should calculate total sales amount for multiple sales', () => {
      const sales = [
        createMockSale('s1', [{ productId: 'p1', quantity: 2, basePrice: 150 }], 10),
        createMockSale('s2', [{ productId: 'p2', quantity: 3, basePrice: 200 }], 20)
      ]

      const total = calculateTotalSalesAmount(sales)

      // Sale 1: 310, Sale 2: 620
      // Total = 930
      expect(total).toBe(930)
    })

    it('should return 0 for empty sales', () => {
      const total = calculateTotalSalesAmount([])

      expect(total).toBe(0)
    })
  })

  describe('calculateTotalDeliveryFee', () => {
    it('should calculate total delivery fee', () => {
      const sales = [
        createMockSale('s1', [{ productId: 'p1', quantity: 2, basePrice: 150 }], 10),
        createMockSale('s2', [{ productId: 'p2', quantity: 3, basePrice: 200 }], 20)
      ]

      const total = calculateTotalDeliveryFee(sales)

      // 10 + 20 = 30
      expect(total).toBe(30)
    })

    it('should handle sales with no delivery fee', () => {
      const sales = [
        createMockSale('s1', [{ productId: 'p1', quantity: 2, basePrice: 150 }], 0),
        createMockSale('s2', [{ productId: 'p2', quantity: 3, basePrice: 200 }])
      ]

      const total = calculateTotalDeliveryFee(sales)

      expect(total).toBe(0)
    })

    it('should return 0 for empty sales', () => {
      const total = calculateTotalDeliveryFee([])

      expect(total).toBe(0)
    })
  })

  describe('calculateTotalProductsSold', () => {
    it('should calculate total products sold for single sale', () => {
      const sales = [
        createMockSale('s1', [
          { productId: 'p1', quantity: 2, basePrice: 150 },
          { productId: 'p2', quantity: 3, basePrice: 200 }
        ])
      ]

      const total = calculateTotalProductsSold(sales)

      // 2 + 3 = 5
      expect(total).toBe(5)
    })

    it('should calculate total products sold for multiple sales', () => {
      const sales = [
        createMockSale('s1', [{ productId: 'p1', quantity: 2, basePrice: 150 }]),
        createMockSale('s2', [{ productId: 'p2', quantity: 3, basePrice: 200 }])
      ]

      const total = calculateTotalProductsSold(sales)

      // 2 + 3 = 5
      expect(total).toBe(5)
    })

    it('should return 0 for empty sales', () => {
      const total = calculateTotalProductsSold([])

      expect(total).toBe(0)
    })
  })

  describe('calculateTotalOrders', () => {
    it('should return correct number of orders', () => {
      const sales = [
        createMockSale('s1', [{ productId: 'p1', quantity: 2, basePrice: 150 }]),
        createMockSale('s2', [{ productId: 'p2', quantity: 3, basePrice: 200 }]),
        createMockSale('s3', [{ productId: 'p3', quantity: 1, basePrice: 100 }])
      ]

      const total = calculateTotalOrders(sales)

      expect(total).toBe(3)
    })

    it('should return 0 for empty sales', () => {
      const total = calculateTotalOrders([])

      expect(total).toBe(0)
    })
  })

  describe('calculateTotalDebt', () => {
    it('should calculate total debt without refunds', () => {
      const debtEntries = [
        createMockFinanceEntry('d1', 'debt', 3000, 'manual'),
        createMockFinanceEntry('d2', 'debt', 2000, 'manual')
      ]
      const refundEntries: FinanceEntry[] = []

      const total = calculateTotalDebt(debtEntries, refundEntries)

      // 3000 + 2000 = 5000
      expect(total).toBe(5000)
    })

    it('should subtract linked refunds from debt', () => {
      const debtEntries = [
        createMockFinanceEntry('d1', 'debt', 3000, 'manual'),
        createMockFinanceEntry('d2', 'debt', 2000, 'manual')
      ]
      const refundEntries = [
        createMockFinanceEntry('r1', 'refund', 1000, 'manual', 'd1'),
        createMockFinanceEntry('r2', 'refund', 500, 'manual', 'd2')
      ]

      const total = calculateTotalDebt(debtEntries, refundEntries)

      // (3000 - 1000) + (2000 - 500) = 2000 + 1500 = 3500
      expect(total).toBe(3500)
    })

    it('should not go negative for fully refunded debt', () => {
      const debtEntries = [
        createMockFinanceEntry('d1', 'debt', 2000, 'manual')
      ]
      const refundEntries = [
        createMockFinanceEntry('r1', 'refund', 2500, 'manual', 'd1')
      ]

      const total = calculateTotalDebt(debtEntries, refundEntries)

      // max(0, 2000 - 2500) = 0
      expect(total).toBe(0)
    })

    it('should handle multiple refunds for single debt', () => {
      const debtEntries = [
        createMockFinanceEntry('d1', 'debt', 5000, 'manual')
      ]
      const refundEntries = [
        createMockFinanceEntry('r1', 'refund', 1000, 'manual', 'd1'),
        createMockFinanceEntry('r2', 'refund', 1500, 'manual', 'd1'),
        createMockFinanceEntry('r3', 'refund', 500, 'manual', 'd1')
      ]

      const total = calculateTotalDebt(debtEntries, refundEntries)

      // 5000 - (1000 + 1500 + 500) = 5000 - 3000 = 2000
      expect(total).toBe(2000)
    })

    it('should ignore refunds not linked to any debt', () => {
      const debtEntries = [
        createMockFinanceEntry('d1', 'debt', 3000, 'manual')
      ]
      const refundEntries = [
        createMockFinanceEntry('r1', 'refund', 1000, 'manual', 'd1'),
        createMockFinanceEntry('r2', 'refund', 500, 'manual', 'd_nonexistent')
      ]

      const total = calculateTotalDebt(debtEntries, refundEntries)

      // 3000 - 1000 = 2000 (r2 not linked to d1)
      expect(total).toBe(2000)
    })

    it('should return 0 for empty debt entries', () => {
      const total = calculateTotalDebt([], [])

      expect(total).toBe(0)
    })

    it('should handle supplier_debt type', () => {
      const debtEntries = [
        createMockFinanceEntry('d1', 'debt', 2000, 'manual'),
        createMockFinanceEntry('d2', 'supplier_debt', 3000, 'supplier')
      ]
      const refundEntries: FinanceEntry[] = []

      const total = calculateTotalDebt(debtEntries, refundEntries)

      // 2000 + 3000 = 5000
      expect(total).toBe(5000)
    })
  })
})

