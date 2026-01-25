/**
 * Retry service for handling failed operations
 */

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  jitter: true
};

/**
 * Retry service for handling failed operations
 */
export class RetryService {
  private static instance: RetryService;
  private retryLog: Array<{ operation: string; attempts: number; success: boolean; time: number }> = [];

  static getInstance(): RetryService {
    if (!RetryService.instance) {
      RetryService.instance = new RetryService();
    }
    return RetryService.instance;
  }

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    config: Partial<RetryConfig> = {}
  ): Promise<RetryResult<T>> {
    const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        // Log successful retry
        this.retryLog.push({
          operation: operationName,
          attempts: attempt,
          success: true,
          time: Date.now() - startTime
        });

        return {
          success: true,
          result,
          attempts: attempt,
          totalTime: Date.now() - startTime
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on last attempt
        if (attempt === finalConfig.maxAttempts) {
          break;
        }

        // Check if error is retryable
        if (!this.isRetryableError(lastError)) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt, finalConfig);
        
        // Wait before retry
        await this.sleep(delay);
      }
    }

    // Log failed retry
    this.retryLog.push({
      operation: operationName,
      attempts: finalConfig.maxAttempts,
      success: false,
      time: Date.now() - startTime
    });

    return {
      success: false,
      error: lastError,
      attempts: finalConfig.maxAttempts,
      totalTime: Date.now() - startTime
    };
  }

  /**
   * Execute operation with custom retry logic
   */
  async executeWithCustomRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    shouldRetry: (error: Error, attempt: number) => boolean,
    getDelay: (attempt: number) => number
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let lastError: Error | undefined;
    let attempt = 1;

    while (true) {
      try {
        const result = await operation();
        
        // Log successful retry
        this.retryLog.push({
          operation: operationName,
          attempts: attempt,
          success: true,
          time: Date.now() - startTime
        });

        return {
          success: true,
          result,
          attempts: attempt,
          totalTime: Date.now() - startTime
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if should retry
        if (!shouldRetry(lastError, attempt)) {
          break;
        }

        // Calculate delay
        const delay = getDelay(attempt);
        
        // Wait before retry
        await this.sleep(delay);
        attempt++;
      }
    }

    // Log failed retry
    this.retryLog.push({
      operation: operationName,
      attempts: attempt,
      success: false,
      time: Date.now() - startTime
    });

    return {
      success: false,
      error: lastError,
      attempts: attempt,
      totalTime: Date.now() - startTime
    };
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    
    // Apply jitter to prevent thundering herd
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    // Cap at max delay
    delay = Math.min(delay, config.maxDelay);
    
    return Math.round(delay);
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryablePatterns = [
      'network',
      'timeout',
      'connection',
      'rate limit',
      'service unavailable',
      'temporary',
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT'
    ];

    const errorMessage = error.message.toLowerCase();
    return retryablePatterns.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get retry statistics
   */
  getRetryStatistics(): {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageAttempts: number;
    averageTime: number;
    operationsByStatus: Record<string, number>;
  } {
    const totalOperations = this.retryLog.length;
    const successfulOperations = this.retryLog.filter(log => log.success).length;
    const failedOperations = totalOperations - successfulOperations;
    const averageAttempts = this.retryLog.reduce((sum, log) => sum + log.attempts, 0) / totalOperations;
    const averageTime = this.retryLog.reduce((sum, log) => sum + log.time, 0) / totalOperations;

    const operationsByStatus: Record<string, number> = {};
    this.retryLog.forEach(log => {
      const status = log.success ? 'success' : 'failed';
      operationsByStatus[status] = (operationsByStatus[status] || 0) + 1;
    });

    return {
      totalOperations,
      successfulOperations,
      failedOperations,
      averageAttempts: Math.round(averageAttempts * 100) / 100,
      averageTime: Math.round(averageTime),
      operationsByStatus
    };
  }

  /**
   * Clear retry log
   */
  clearRetryLog(): void {
    this.retryLog = [];
  }
}

// Export singleton instance
export const retryService = RetryService.getInstance();

// Utility functions for common retry scenarios
export async function retryNetworkOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxAttempts: number = 3
): Promise<T> {
  const result = await retryService.executeWithRetry(operation, operationName, { maxAttempts });
  
  if (!result.success) {
    throw result.error || new Error('Operation failed after retries');
  }
  
  return result.result!;
}

export async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  operationName: string,
  baseDelay: number = 1000,
  maxAttempts: number = 3
): Promise<T> {
  const result = await retryService.executeWithRetry(operation, operationName, {
    maxAttempts,
    baseDelay,
    backoffMultiplier: 2
  });
  
  if (!result.success) {
    throw result.error || new Error('Operation failed after retries');
  }
  
  return result.result!;
}

export async function retryWithLinearBackoff<T>(
  operation: () => Promise<T>,
  operationName: string,
  delay: number = 1000,
  maxAttempts: number = 3
): Promise<T> {
  const result = await retryService.executeWithCustomRetry(
    operation,
    operationName,
    (error, attempt) => attempt < maxAttempts && retryService['isRetryableError'](error),
    (attempt) => delay * attempt
  );
  
  if (!result.success) {
    throw result.error || new Error('Operation failed after retries');
  }
  
  return result.result!;
}

