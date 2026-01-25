/**
 * Tests for error handler service
 */

import { ErrorHandler, ServiceError, ValidationError, NetworkError } from '../errorHandler';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = ErrorHandler.getInstance();
    errorHandler.clearErrorLog();
  });

  describe('handleError', () => {
    it('should handle ServiceError correctly', () => {
      const context = errorHandler.createContext('test-service', 'test-operation');
      const serviceError = new ServiceError('Test error', 'TEST_ERROR', context);
      
      const result = errorHandler.handleError(serviceError, context);
      
      expect(result).toBe(serviceError);
      expect(result.message).toBe('Test error');
      expect(result.code).toBe('TEST_ERROR');
    });

    it('should convert unknown error to ServiceError', () => {
      const context = errorHandler.createContext('test-service', 'test-operation');
      const unknownError = new Error('Unknown error');
      
      const result = errorHandler.handleError(unknownError, context);
      
      expect(result).toBeInstanceOf(ServiceError);
      expect(result.message).toBe('Unknown error');
      expect(result.code).toBe('UNKNOWN_ERROR');
    });

    it('should log error details', () => {
      const context = errorHandler.createContext('test-service', 'test-operation');
      const error = new Error('Test error');
      
      errorHandler.handleError(error, context);
      
      const log = errorHandler.getErrorLog();
      expect(log).toHaveLength(1);
      expect(log[0].message).toBe('Test error');
      expect(log[0].context.service).toBe('test-service');
    });
  });

  describe('createContext', () => {
    it('should create context with required fields', () => {
      const context = errorHandler.createContext('test-service', 'test-operation');
      
      expect(context.service).toBe('test-service');
      expect(context.operation).toBe('test-operation');
      expect(context.timestamp).toBeGreaterThan(0);
    });

    it('should include additional context', () => {
      const additionalContext = { userId: 'user123', restaurantId: 'restaurant456' };
      const context = errorHandler.createContext('test-service', 'test-operation', additionalContext);
      
      expect(context.userId).toBe('user123');
      expect(context.restaurantId).toBe('restaurant456');
    });
  });

  describe('getErrorStatistics', () => {
    it('should return correct statistics', () => {
      const context = errorHandler.createContext('test-service', 'test-operation');
      
      // Add some errors
      errorHandler.handleError(new Error('Error 1'), context);
      errorHandler.handleError(new Error('Error 2'), context);
      
      const stats = errorHandler.getErrorStatistics();
      
      expect(stats.totalErrors).toBe(2);
      expect(stats.errorsByService['test-service']).toBe(2);
    });
  });
});

describe('ServiceError', () => {
  it('should create ServiceError with correct properties', () => {
    const context = { service: 'test', operation: 'test', timestamp: Date.now() };
    const error = new ServiceError('Test message', 'TEST_CODE', context);
    
    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.context).toBe(context);
    expect(error.isRetryable).toBe(false);
  });
});

describe('ValidationError', () => {
  it('should create ValidationError with field information', () => {
    const context = { service: 'test', operation: 'test', timestamp: Date.now() };
    const error = new ValidationError('Invalid input', context, 'email');
    
    expect(error.message).toBe('email: Invalid input');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.isRetryable).toBe(false);
  });
});

describe('NetworkError', () => {
  it('should create NetworkError as retryable', () => {
    const context = { service: 'test', operation: 'test', timestamp: Date.now() };
    const error = new NetworkError('Network failed', context);
    
    expect(error.message).toBe('Network failed');
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.isRetryable).toBe(true);
  });
});

