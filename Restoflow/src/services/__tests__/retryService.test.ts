/**
 * Tests for retry service
 */

import { RetryService } from '../retryService';

describe('RetryService', () => {
  let retryService: RetryService;

  beforeEach(() => {
    retryService = RetryService.getInstance();
    retryService.clearRetryLog();
  });

  describe('executeWithRetry', () => {
    it('should execute successful operation on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await retryService.executeWithRetry(operation, 'test-operation');
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry failed operation and succeed', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');
      
      const result = await retryService.executeWithRetry(operation, 'test-operation', {
        maxAttempts: 2,
        baseDelay: 10
      });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(2);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should fail after max attempts', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Persistent error'));
      
      const result = await retryService.executeWithRetry(operation, 'test-operation', {
        maxAttempts: 2,
        baseDelay: 10
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.attempts).toBe(2);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Validation error'));
      
      const result = await retryService.executeWithRetry(operation, 'test-operation', {
        maxAttempts: 3,
        baseDelay: 10
      });
      
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('executeWithCustomRetry', () => {
    it('should use custom retry logic', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Retryable error'))
        .mockResolvedValue('success');
      
      const shouldRetry = (error: Error, attempt: number) => 
        error.message.includes('Retryable') && attempt < 2;
      const getDelay = (attempt: number) => 10 * attempt;
      
      const result = await retryService.executeWithCustomRetry(
        operation,
        'test-operation',
        shouldRetry,
        getDelay
      );
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(2);
    });
  });

  describe('getRetryStatistics', () => {
    it('should return correct statistics', async () => {
      // Add some successful operations
      await retryService.executeWithRetry(
        () => Promise.resolve('success1'),
        'operation1'
      );
      await retryService.executeWithRetry(
        () => Promise.resolve('success2'),
        'operation2'
      );
      
      // Add some failed operations
      await retryService.executeWithRetry(
        () => Promise.reject(new Error('Non-retryable error')),
        'operation3'
      );
      
      const stats = retryService.getRetryStatistics();
      
      expect(stats.totalOperations).toBe(3);
      expect(stats.successfulOperations).toBe(2);
      expect(stats.failedOperations).toBe(1);
      expect(stats.averageAttempts).toBe(1);
    });
  });
});

