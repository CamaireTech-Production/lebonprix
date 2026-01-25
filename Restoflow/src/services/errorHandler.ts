/**
 * Comprehensive error handling service
 */

export interface ErrorContext {
  service: string;
  operation: string;
  userId?: string;
  restaurantId?: string;
  timestamp: number;
  userAgent?: string;
  url?: string;
}

export interface ErrorDetails {
  message: string;
  code: string;
  context: ErrorContext;
  stack?: string;
  originalError?: any;
}

export class ServiceError extends Error {
  public readonly code: string;
  public readonly context: ErrorContext;
  public readonly originalError?: any;
  public readonly isRetryable: boolean;

  constructor(
    message: string,
    code: string,
    context: ErrorContext,
    originalError?: any,
    isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.context = context;
    this.originalError = originalError;
    this.isRetryable = isRetryable;
  }
}

export class ValidationError extends ServiceError {
  constructor(message: string, context: ErrorContext, field?: string) {
    super(
      field ? `${field}: ${message}` : message,
      'VALIDATION_ERROR',
      context,
      undefined,
      false
    );
    this.name = 'ValidationError';
  }
}

export class NetworkError extends ServiceError {
  constructor(message: string, context: ErrorContext, originalError?: any) {
    super(message, 'NETWORK_ERROR', context, originalError, true);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends ServiceError {
  constructor(message: string, context: ErrorContext) {
    super(message, 'AUTHENTICATION_ERROR', context, undefined, false);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ServiceError {
  constructor(message: string, context: ErrorContext) {
    super(message, 'AUTHORIZATION_ERROR', context, undefined, false);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends ServiceError {
  constructor(message: string, context: ErrorContext) {
    super(message, 'NOT_FOUND_ERROR', context, undefined, false);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ServiceError {
  constructor(message: string, context: ErrorContext) {
    super(message, 'CONFLICT_ERROR', context, undefined, false);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends ServiceError {
  constructor(message: string, context: ErrorContext) {
    super(message, 'RATE_LIMIT_ERROR', context, undefined, true);
    this.name = 'RateLimitError';
  }
}

export class ServiceUnavailableError extends ServiceError {
  constructor(message: string, context: ErrorContext) {
    super(message, 'SERVICE_UNAVAILABLE_ERROR', context, undefined, true);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Error handler service
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: ErrorDetails[] = [];
  private maxLogSize = 1000;

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle and log error
   */
  handleError(error: any, context: ErrorContext): ServiceError {
    let serviceError: ServiceError;

    if (error instanceof ServiceError) {
      serviceError = error;
    } else {
      // Convert unknown error to ServiceError
      serviceError = new ServiceError(
        error.message || 'Unknown error occurred',
        'UNKNOWN_ERROR',
        context,
        error,
        this.isRetryableError(error)
      );
    }

    // Log error
    this.logError(serviceError);

    return serviceError;
  }

  /**
   * Create error context
   */
  createContext(service: string, operation: string, additionalContext?: Partial<ErrorContext>): ErrorContext {
    return {
      service,
      operation,
      timestamp: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      ...additionalContext
    };
  }

  /**
   * Log error details
   */
  private logError(error: ServiceError): void {
    const errorDetails: ErrorDetails = {
      message: error.message,
      code: error.code,
      context: error.context,
      stack: error.stack,
      originalError: error.originalError
    };

    this.errorLog.push(errorDetails);

    // Keep log size manageable
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Service Error:', errorDetails);
    }
  }

  /**
   * Get error log
   */
  getErrorLog(): ErrorDetails[] {
    return [...this.errorLog];
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (error instanceof ServiceError) {
      return error.isRetryable;
    }

    // Check for common retryable error patterns
    const retryablePatterns = [
      'network',
      'timeout',
      'connection',
      'rate limit',
      'service unavailable',
      'temporary'
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return retryablePatterns.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByCode: Record<string, number>;
    errorsByService: Record<string, number>;
    recentErrors: ErrorDetails[];
  } {
    const errorsByCode: Record<string, number> = {};
    const errorsByService: Record<string, number> = {};

    this.errorLog.forEach(error => {
      errorsByCode[error.code] = (errorsByCode[error.code] || 0) + 1;
      errorsByService[error.context.service] = (errorsByService[error.context.service] || 0) + 1;
    });

    return {
      totalErrors: this.errorLog.length,
      errorsByCode,
      errorsByService,
      recentErrors: this.errorLog.slice(-10) // Last 10 errors
    };
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Utility functions for common error scenarios
export function createValidationError(message: string, service: string, operation: string, field?: string): ValidationError {
  const context = errorHandler.createContext(service, operation);
  return new ValidationError(message, context, field);
}

export function createNetworkError(message: string, service: string, operation: string, originalError?: any): NetworkError {
  const context = errorHandler.createContext(service, operation);
  return new NetworkError(message, context, originalError);
}

export function createAuthenticationError(message: string, service: string, operation: string): AuthenticationError {
  const context = errorHandler.createContext(service, operation);
  return new AuthenticationError(message, context);
}

export function createAuthorizationError(message: string, service: string, operation: string): AuthorizationError {
  const context = errorHandler.createContext(service, operation);
  return new AuthorizationError(message, context);
}

export function createNotFoundError(message: string, service: string, operation: string): NotFoundError {
  const context = errorHandler.createContext(service, operation);
  return new NotFoundError(message, context);
}

export function createConflictError(message: string, service: string, operation: string): ConflictError {
  const context = errorHandler.createContext(service, operation);
  return new ConflictError(message, context);
}

export function createRateLimitError(message: string, service: string, operation: string): RateLimitError {
  const context = errorHandler.createContext(service, operation);
  return new RateLimitError(message, context);
}

export function createServiceUnavailableError(message: string, service: string, operation: string): ServiceUnavailableError {
  const context = errorHandler.createContext(service, operation);
  return new ServiceUnavailableError(message, context);
}

