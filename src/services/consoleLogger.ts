/**
 * Console Logger - Vanilla JS implementation
 * 
 * This runs BEFORE React loads and captures ALL console logs
 * Works even if React crashes or white screen occurs
 */

interface ConsoleLog {
  id: string;
  type: 'log' | 'error' | 'warn' | 'info' | 'debug';
  message: string;
  timestamp: number;
  data?: any[];
  stack?: string;
}

class ConsoleLogger {
  private logs: ConsoleLog[] = [];
  private maxLogs = 500;
  private originalConsole: any = {};
  private isInitialized = false;
  private panelElement: HTMLElement | null = null;
  private isPanelVisible = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Check if early logs exist from inline script
    if (typeof window !== 'undefined' && (window as any).__earlyConsoleLogs) {
      this.logs = (window as any).__earlyConsoleLogs;
      (window as any).__earlyConsoleLogs = null; // Clear to avoid duplication
    }

    // Store original console methods (or use the ones from inline script)
    if (typeof window !== 'undefined' && (window as any).__originalConsole) {
      this.originalConsole = (window as any).__originalConsole;
    } else {
      this.originalConsole = {
        log: console.log.bind(console),
        error: console.error.bind(console),
        warn: console.warn.bind(console),
        info: console.info.bind(console),
        debug: console.debug.bind(console),
      };
    }

    // Check if already intercepted by inline script
    const isAlreadyIntercepted = typeof window !== 'undefined' && (window as any).__consoleIntercepted;
    
    if (isAlreadyIntercepted) {
      // Wrap existing intercepted methods to also call our addLog
      const existingLog = console.log;
      const existingError = console.error;
      const existingWarn = console.warn;
      const existingInfo = console.info;
      const existingDebug = console.debug;
      
      console.log = (...args: any[]) => {
        existingLog(...args);
        this.addLog('log', args);
      };
      console.error = (...args: any[]) => {
        existingError(...args);
        this.addLog('error', args);
      };
      console.warn = (...args: any[]) => {
        existingWarn(...args);
        this.addLog('warn', args);
      };
      console.info = (...args: any[]) => {
        existingInfo(...args);
        this.addLog('info', args);
      };
      console.debug = (...args: any[]) => {
        existingDebug(...args);
        this.addLog('debug', args);
      };
    } else {
      // Intercept ALL console methods
      console.log = (...args: any[]) => {
        this.originalConsole.log(...args);
        this.addLog('log', args);
      };

      console.error = (...args: any[]) => {
        this.originalConsole.error(...args);
        this.addLog('error', args);
      };

      console.warn = (...args: any[]) => {
        this.originalConsole.warn(...args);
        this.addLog('warn', args);
      };

      console.info = (...args: any[]) => {
        this.originalConsole.info(...args);
        this.addLog('info', args);
      };

      console.debug = (...args: any[]) => {
        this.originalConsole.debug(...args);
        this.addLog('debug', args);
      };
    }

    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      this.addLog('error', [
        `Global Error: ${event.message}`,
        event.filename,
        `Line ${event.lineno}:${event.colno}`,
        event.error
      ], event.error?.stack);
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason;
      const message = error instanceof Error ? error.message : String(error);
      this.addLog('error', [`Unhandled Promise Rejection: ${message}`, error], error?.stack);
    });

    // Load persisted logs
    this.loadFromStorage();

    // UI creation disabled - logging works in background only
    // Access logs via: window.consoleLogger.getLogs() in browser console
  }

  private addLog(type: ConsoleLog['type'], args: any[], stack?: string) {
    const message = this.formatMessage(args);
    const log: ConsoleLog = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      timestamp: Date.now(),
      data: args,
      stack: stack || (args[0] instanceof Error ? args[0].stack : undefined),
    };

    this.logs.push(log);

    // Keep only last maxLogs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Save to localStorage
    this.saveToStorage();

    // UI disabled - no need to update
  }

  private formatMessage(args: any[]): string {
    return args
      .map((arg) => {
        if (arg instanceof Error) {
          return arg.message;
        }
        if (typeof arg === 'object' && arg !== null) {
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

  private createUI() {
    // UI creation disabled - logging still works in background
    // Logs can be accessed via window.consoleLogger.getLogs() in browser console
    return;
  }

  private updateBadge() {
    // Badge update disabled - no UI to update
    return;
  }

  private togglePanel() {
    // Panel toggle disabled - no UI
    return;
  }

  private updateUI() {
    // UI update disabled - no UI to update
    return;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private saveToStorage() {
    try {
      // Save only last 100 logs to avoid localStorage bloat
      const logsToSave = this.logs.slice(-100);
      localStorage.setItem('console_logs', JSON.stringify(logsToSave));
    } catch (e) {
      // localStorage might be full
    }
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem('console_logs');
      if (saved) {
        const savedLogs = JSON.parse(saved);
        // Merge with existing logs, avoiding duplicates
        const existingIds = new Set(this.logs.map(l => l.id));
        const newLogs = savedLogs.filter((l: ConsoleLog) => !existingIds.has(l.id));
        this.logs = [...this.logs, ...newLogs].slice(-this.maxLogs);
        // UI disabled - no need to update
      }
    } catch (e) {
      // Ignore
    }
  }

  public getLogs(): ConsoleLog[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
    this.saveToStorage();
    // UI disabled - no need to update
  }
}

// Initialize immediately
const consoleLogger = new ConsoleLogger();

// Also load from storage on init
if (typeof window !== 'undefined') {
  consoleLogger['loadFromStorage']();
}

// Export for React components if needed
if (typeof window !== 'undefined') {
  (window as any).consoleLogger = consoleLogger;
}

export default consoleLogger;

