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

    // Create UI when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.createUI());
    } else {
      this.createUI();
    }

    // Also try after a short delay to ensure it works
    setTimeout(() => this.createUI(), 1000);
    setTimeout(() => this.createUI(), 3000); // Try again after 3 seconds
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

    // Update UI if visible
    this.updateUI();
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
    // Don't create if already exists
    if (document.getElementById('console-logger-panel')) {
      return;
    }

    // Create toggle button (always visible)
    const toggleButton = document.createElement('button');
    toggleButton.id = 'console-logger-toggle';
    toggleButton.innerHTML = '📋';
    toggleButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: #ef4444;
      color: white;
      border: none;
      font-size: 20px;
      cursor: pointer;
      z-index: 99999;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    toggleButton.onclick = () => this.togglePanel();
    document.body.appendChild(toggleButton);

    // Create panel
    const panel = document.createElement('div');
    panel.id = 'console-logger-panel';
    panel.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      width: calc(100vw - 40px);
      max-width: 500px;
      max-height: calc(100vh - 100px);
      background: white;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      z-index: 99998;
      display: none;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      background: #ef4444;
      color: white;
      padding: 12px 16px;
      border-radius: 8px 8px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    header.innerHTML = `
      <div style="font-weight: 600; font-size: 14px;">Console Logs (${this.logs.length})</div>
      <div style="display: flex; gap: 8px;">
        <button id="console-logger-clear" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">Clear</button>
        <button id="console-logger-close" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">✕</button>
      </div>
    `;
    panel.appendChild(header);

    // Logs container
    const logsContainer = document.createElement('div');
    logsContainer.id = 'console-logger-logs';
    logsContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      font-size: 12px;
    `;
    panel.appendChild(logsContainer);

    document.body.appendChild(panel);
    this.panelElement = panel;

    // Event listeners
    document.getElementById('console-logger-clear')?.addEventListener('click', () => {
      this.logs = [];
      this.saveToStorage();
      this.updateUI();
    });

    document.getElementById('console-logger-close')?.addEventListener('click', () => {
      this.togglePanel();
    });

    // Update badge count
    this.updateBadge();

    // Initial render
    this.updateUI();

    // Load from storage again after UI is created
    this.loadFromStorage();
  }

  private updateBadge() {
    const toggleButton = document.getElementById('console-logger-toggle');
    if (!toggleButton) return;

    const errorCount = this.logs.filter(l => l.type === 'error').length;
    const warnCount = this.logs.filter(l => l.type === 'warn').length;
    const totalCount = errorCount + warnCount;

    if (totalCount > 0) {
      toggleButton.innerHTML = `📋 <span style="position: absolute; top: -5px; right: -5px; background: white; color: #ef4444; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold;">${totalCount}</span>`;
    } else {
      toggleButton.innerHTML = '📋';
    }
  }

  private togglePanel() {
    if (!this.panelElement) {
      this.createUI();
      return;
    }

    this.isPanelVisible = !this.isPanelVisible;
    this.panelElement.style.display = this.isPanelVisible ? 'flex' : 'none';
    
    if (this.isPanelVisible) {
      this.updateUI();
      // Scroll to bottom
      const logsContainer = document.getElementById('console-logger-logs');
      if (logsContainer) {
        setTimeout(() => {
          logsContainer.scrollTop = logsContainer.scrollHeight;
        }, 100);
      }
    }
  }

  private updateUI() {
    const logsContainer = document.getElementById('console-logger-logs');
    if (!logsContainer) return;

    // Update header count
    const header = this.panelElement?.querySelector('div:first-child');
    if (header) {
      header.innerHTML = `Console Logs (${this.logs.length})`;
    }

    // Render logs
    logsContainer.innerHTML = this.logs.map(log => {
      const typeColor = {
        error: '#ef4444',
        warn: '#f59e0b',
        info: '#3b82f6',
        debug: '#6b7280',
        log: '#374151'
      }[log.type] || '#374151';

      const time = new Date(log.timestamp).toLocaleTimeString();
      
      return `
        <div style="
          padding: 8px;
          margin-bottom: 4px;
          border-left: 3px solid ${typeColor};
          background: ${log.type === 'error' ? '#fef2f2' : log.type === 'warn' ? '#fffbeb' : '#f9fafb'};
          border-radius: 4px;
          font-size: 11px;
        ">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 600; color: ${typeColor}; text-transform: uppercase; font-size: 10px;">${log.type}</span>
            <span style="color: #6b7280; font-size: 10px;">${time}</span>
          </div>
          <div style="color: #1f2937; word-break: break-word; white-space: pre-wrap; font-family: 'Courier New', monospace;">${this.escapeHtml(log.message)}</div>
          ${log.stack ? `<details style="margin-top: 4px;"><summary style="cursor: pointer; color: #6b7280; font-size: 10px;">Stack trace</summary><pre style="font-size: 10px; color: #6b7280; margin-top: 4px; white-space: pre-wrap; word-break: break-word;">${this.escapeHtml(log.stack)}</pre></details>` : ''}
        </div>
      `;
    }).join('');

    this.updateBadge();
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
        if (this.panelElement) {
          this.updateUI();
        }
        this.updateBadge();
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
    this.updateUI();
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

