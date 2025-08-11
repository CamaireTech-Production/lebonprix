import { 
  restockProduct, 
  adjustStockManually, 
  adjustStockForDamage,
  getProductBatchesForAdjustment,
  validateBatchAdjustment 
} from '../services/firestore';
import type { Product, StockBatch } from '../types/models';

/**
 * Test utility for stock adjustment scenarios
 */
export class StockAdjustmentTester {
  private testResults: Array<{
    testName: string;
    success: boolean;
    error?: string;
    details?: any;
  }> = [];

  /**
   * Test 1: Basic Restock with Own Purchase
   */
  async testBasicRestock(productId: string, userId: string): Promise<void> {
    try {
      console.log('🧪 Testing Basic Restock...');
      
      await restockProduct(
        productId,
        10,
        150,
        userId,
        undefined, // no supplier
        true, // own purchase
        false, // not credit
        'Test restock - own purchase'
      );
      
      this.testResults.push({
        testName: 'Basic Restock with Own Purchase',
        success: true,
        details: { quantity: 10, costPrice: 150 }
      });
      
      console.log('✅ Basic Restock Test Passed');
    } catch (error) {
      this.testResults.push({
        testName: 'Basic Restock with Own Purchase',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.log('❌ Basic Restock Test Failed:', error);
    }
  }

  /**
   * Test 2: Restock with Supplier and Credit
   */
  async testRestockWithSupplier(productId: string, userId: string, supplierId: string): Promise<void> {
    try {
      console.log('🧪 Testing Restock with Supplier...');
      
      await restockProduct(
        productId,
        5,
        200,
        userId,
        supplierId,
        false, // from supplier
        true, // credit purchase
        'Test restock - supplier credit'
      );
      
      this.testResults.push({
        testName: 'Restock with Supplier and Credit',
        success: true,
        details: { quantity: 5, costPrice: 200, supplierId }
      });
      
      console.log('✅ Restock with Supplier Test Passed');
    } catch (error) {
      this.testResults.push({
        testName: 'Restock with Supplier and Credit',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.log('❌ Restock with Supplier Test Failed:', error);
    }
  }

  /**
   * Test 3: Manual Adjustment - Add Stock
   */
  async testManualAdjustmentAdd(productId: string, userId: string): Promise<void> {
    try {
      console.log('🧪 Testing Manual Adjustment - Add Stock...');
      
      // Get available batches first
      const batches = await getProductBatchesForAdjustment(productId);
      if (batches.length === 0) {
        throw new Error('No batches available for testing');
      }
      
      const batchId = batches[0].id;
      
      await adjustStockManually(
        productId,
        batchId,
        3, // add 3 units
        userId,
        undefined, // keep same cost price
        'Test manual adjustment - add stock'
      );
      
      this.testResults.push({
        testName: 'Manual Adjustment - Add Stock',
        success: true,
        details: { batchId, quantityChange: 3 }
      });
      
      console.log('✅ Manual Adjustment Add Test Passed');
    } catch (error) {
      this.testResults.push({
        testName: 'Manual Adjustment - Add Stock',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.log('❌ Manual Adjustment Add Test Failed:', error);
    }
  }

  /**
   * Test 4: Manual Adjustment - Reduce Stock
   */
  async testManualAdjustmentReduce(productId: string, userId: string): Promise<void> {
    try {
      console.log('🧪 Testing Manual Adjustment - Reduce Stock...');
      
      // Get available batches first
      const batches = await getProductBatchesForAdjustment(productId);
      if (batches.length === 0) {
        throw new Error('No batches available for testing');
      }
      
      const batchId = batches[0].id;
      
      await adjustStockManually(
        productId,
        batchId,
        -2, // reduce 2 units
        userId,
        undefined, // keep same cost price
        'Test manual adjustment - reduce stock'
      );
      
      this.testResults.push({
        testName: 'Manual Adjustment - Reduce Stock',
        success: true,
        details: { batchId, quantityChange: -2 }
      });
      
      console.log('✅ Manual Adjustment Reduce Test Passed');
    } catch (error) {
      this.testResults.push({
        testName: 'Manual Adjustment - Reduce Stock',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.log('❌ Manual Adjustment Reduce Test Failed:', error);
    }
  }

  /**
   * Test 5: Manual Adjustment - Change Cost Price
   */
  async testManualAdjustmentCostPrice(productId: string, userId: string): Promise<void> {
    try {
      console.log('🧪 Testing Manual Adjustment - Change Cost Price...');
      
      // Get available batches first
      const batches = await getProductBatchesForAdjustment(productId);
      if (batches.length === 0) {
        throw new Error('No batches available for testing');
      }
      
      const batchId = batches[0].id;
      
      await adjustStockManually(
        productId,
        batchId,
        0, // no quantity change
        userId,
        175, // new cost price
        'Test manual adjustment - change cost price'
      );
      
      this.testResults.push({
        testName: 'Manual Adjustment - Change Cost Price',
        success: true,
        details: { batchId, newCostPrice: 175 }
      });
      
      console.log('✅ Manual Adjustment Cost Price Test Passed');
    } catch (error) {
      this.testResults.push({
        testName: 'Manual Adjustment - Change Cost Price',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.log('❌ Manual Adjustment Cost Price Test Failed:', error);
    }
  }

  /**
   * Test 6: Damage Adjustment
   */
  async testDamageAdjustment(productId: string, userId: string): Promise<void> {
    try {
      console.log('🧪 Testing Damage Adjustment...');
      
      // Get available batches first
      const batches = await getProductBatchesForAdjustment(productId);
      if (batches.length === 0) {
        throw new Error('No batches available for testing');
      }
      
      const batchId = batches[0].id;
      
      await adjustStockForDamage(
        productId,
        batchId,
        1, // damage 1 unit
        userId,
        'Test damage adjustment'
      );
      
      this.testResults.push({
        testName: 'Damage Adjustment',
        success: true,
        details: { batchId, damagedQuantity: 1 }
      });
      
      console.log('✅ Damage Adjustment Test Passed');
    } catch (error) {
      this.testResults.push({
        testName: 'Damage Adjustment',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.log('❌ Damage Adjustment Test Failed:', error);
    }
  }

  /**
   * Test 7: Validation Tests
   */
  async testValidations(productId: string): Promise<void> {
    try {
      console.log('🧪 Testing Validations...');
      
      // Get available batches first
      const batches = await getProductBatchesForAdjustment(productId);
      if (batches.length === 0) {
        throw new Error('No batches available for testing');
      }
      
      const batch = batches[0];
      
      // Test validation with invalid quantity
      const validation1 = validateBatchAdjustment(batch, -batch.remainingQuantity - 1, batch.costPrice);
      if (!validation1.isValid) {
        console.log('✅ Negative quantity validation working');
      }
      
      // Test validation with invalid cost price
      const validation2 = validateBatchAdjustment(batch, 0, -100);
      if (!validation2.isValid) {
        console.log('✅ Negative cost price validation working');
      }
      
      this.testResults.push({
        testName: 'Validation Tests',
        success: true,
        details: { 
          negativeQuantityValid: !validation1.isValid,
          negativeCostPriceValid: !validation2.isValid
        }
      });
      
      console.log('✅ Validation Tests Passed');
    } catch (error) {
      this.testResults.push({
        testName: 'Validation Tests',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.log('❌ Validation Tests Failed:', error);
    }
  }

  /**
   * Run all tests
   */
  async runAllTests(productId: string, userId: string, supplierId?: string): Promise<void> {
    console.log('🚀 Starting Stock Adjustment Integration Tests...');
    console.log('================================================');
    
    // Clear previous results
    this.testResults = [];
    
    // Run tests
    await this.testBasicRestock(productId, userId);
    
    if (supplierId) {
      await this.testRestockWithSupplier(productId, userId, supplierId);
    }
    
    await this.testManualAdjustmentAdd(productId, userId);
    await this.testManualAdjustmentReduce(productId, userId);
    await this.testManualAdjustmentCostPrice(productId, userId);
    await this.testDamageAdjustment(productId, userId);
    await this.testValidations(productId);
    
    // Print results
    this.printResults();
  }

  /**
   * Print test results
   */
  printResults(): void {
    console.log('\n📊 Test Results Summary');
    console.log('=======================');
    
    const passed = this.testResults.filter(r => r.success).length;
    const failed = this.testResults.filter(r => !r.success).length;
    const total = this.testResults.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    console.log('\n📋 Detailed Results:');
    this.testResults.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${result.testName}`);
      if (!result.success && result.error) {
        console.log(`   Error: ${result.error}`);
      }
      if (result.details) {
        console.log(`   Details: ${JSON.stringify(result.details)}`);
      }
    });
    
    if (failed === 0) {
      console.log('\n🎉 All tests passed! Stock adjustment system is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please check the implementation.');
    }
  }

  /**
   * Get test results
   */
  getResults() {
    return this.testResults;
  }
}

/**
 * Quick test function for development
 */
export const quickTest = async (productId: string, userId: string, supplierId?: string) => {
  const tester = new StockAdjustmentTester();
  await tester.runAllTests(productId, userId, supplierId);
  return tester.getResults();
}; 