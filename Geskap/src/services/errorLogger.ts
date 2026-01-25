/**
 * Error Logger Service
 * 
 * Intercepts console methods and captures all errors, warnings, and logs
 * for display in the mobile PWA error interface.
 */

export interface LogEntry {
  id: string;
  type: 'error' | 'warn' | 'info' | 'log' | 'unhandledRejection' | 'reactError';
  message: string;
  timestamp: number;
  stack?: string;
  source?: string;
  data?: any;
}

class ErrorLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 100; // Keep last 100 logs
  private listeners: Set<(logs: LogEntry[]) => void> = new Set();
  private originalConsole: {
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
    log: typeof console.log;
  };

  constructor() {
    // Store original console methods
    this.originalConsole = {
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console),
      log: console.log.bind(console),
    };

    this.initialize();
  }

  private initialize() {
    // Intercept console.error
    console.error = (...args: any[]) => {
      this.originalConsole.error(...args);
      this.addLog('error', this.formatMessage(args), args);
    };

    // Intercept console.warn
    console.warn = (...args: any[]) => {
      this.originalConsole.warn(...args);
      this.addLog('warn', this.formatMessage(args), args);
    };

    // Intercept console.info
    console.info = (...args: any[]) => {
      this.originalConsole.info(...args);
      this.addLog('info', this.formatMessage(args), args);
    };

    // Intercept console.log (optional, can be disabled for less noise)
    console.log = (...args: any[]) => {
      this.originalConsole.log(...args);
      // Only log if it contains "error" or "Error" to reduce noise
      const message = this.formatMessage(args);
      if (message.toLowerCase().includes('error') || message.toLowerCase().includes('fail')) {
        this.addLog('log', message, args);
      }
    };

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason;
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      
      this.addLog('unhandledRejection', `Unhandled Promise Rejection: ${message}`, {
        reason: error,
        stack,
      });
      
      // Still log to console
      this.originalConsole.error('Unhandled Promise Rejection:', error);
    });

    // Capture global errors
    window.addEventListener('error', (event) => {
      const message = event.message || 'Unknown error';
      const stack = event.error?.stack;
      const source = event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined;
      
      this.addLog('error', `Global Error: ${message}`, {
        error: event.error,
        stack,
        source,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Load persisted logs from localStorage
    this.loadPersistedLogs();
  }

  private formatMessage(args: any[]): string {
    return args
      .map((arg) => {
        if (arg instanceof Error) {
          return arg.message;
        }
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ');
  }

  private addLog(type: LogEntry['type'], message: string, data?: any) {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      timestamp: Date.now(),
      stack: data?.stack || (data instanceof Error ? data.stack : undefined),
      source: data?.source,
      data: data && typeof data === 'object' ? data : undefined,
    };

    this.logs.push(entry);

    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Persist to localStorage
    this.persistLogs();

    // Notify listeners
    this.notifyListeners();
  }

  public addReactError(error: Error, errorInfo?: React.ErrorInfo) {
    const message = error.message || 'React Error';
    const stack = error.stack;
    
    this.addLog('reactError', `React Error: ${message}`, {
      error,
      stack,
      componentStack: errorInfo?.componentStack,
    });
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public getErrors(): LogEntry[] {
    return this.logs.filter((log) => log.type === 'error' || log.type === 'unhandledRejection' || log.type === 'reactError');
  }

  public clearLogs() {
    this.logs = [];
    this.persistLogs();
    this.notifyListeners();
  }

  public subscribe(listener: (logs: LogEntry[]) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.logs);
      } catch (error) {
        this.originalConsole.error('Error in log listener:', error);
      }
    });
  }

  private persistLogs() {
    try {
      // Only persist errors and warnings to avoid localStorage bloat
      const importantLogs = this.logs.filter(
        (log) => log.type === 'error' || log.type === 'unhandledRejection' || log.type === 'reactError'
      );
      
      // Keep only last 50 important logs in localStorage
      const logsToPersist = importantLogs.slice(-50);
      
      localStorage.setItem('errorLogger_logs', JSON.stringify(logsToPersist));
    } catch (error) {
      // localStorage might be full or unavailable
      this.originalConsole.warn('Failed to persist logs:', error);
    }
  }

  private loadPersistedLogs() {
    try {
      const persisted = localStorage.getItem('errorLogger_logs');
      if (persisted) {
        const parsed = JSON.parse(persisted) as LogEntry[];
        // Add persisted logs to current logs
        this.logs = [...parsed, ...this.logs];
        // Still respect maxLogs limit
        if (this.logs.length > this.maxLogs) {
          this.logs = this.logs.slice(-this.maxLogs);
        }
      }
    } catch (error) {
      this.originalConsole.warn('Failed to load persisted logs:', error);
    }
  }

  public exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Singleton instance
export const errorLogger = new ErrorLogger();

