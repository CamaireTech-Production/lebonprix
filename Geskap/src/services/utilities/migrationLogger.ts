// src/services/migrationLogger.ts
// MigrationResult type is available but not used in this file

interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: any;
}

export class MigrationLogger {
  private logs: LogEntry[] = [];
  private startTime: Date = new Date();

  log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      data
    };
    
    this.logs.push(logEntry);
    
    // Also log to console
    const timestamp = logEntry.timestamp.toISOString();
    const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    
    switch (level) {
      case 'info':
        console.log(logMessage, data || '');
        break;
      case 'warn':
        console.warn(logMessage, data || '');
        break;
      case 'error':
        console.error(logMessage, data || '');
        break;
    }
  }

  generateReport(): string {
    const endTime = new Date();
    const duration = endTime.getTime() - this.startTime.getTime();
    
    const infoLogs = this.logs.filter(log => log.level === 'info').length;
    const warnLogs = this.logs.filter(log => log.level === 'warn').length;
    const errorLogs = this.logs.filter(log => log.level === 'error').length;
    
    let report = `
=== MIGRATION REPORT ===
Start Time: ${this.startTime.toISOString()}
End Time: ${endTime.toISOString()}
Duration: ${Math.round(duration / 1000)} seconds

Log Summary:
- Info: ${infoLogs}
- Warnings: ${warnLogs}
- Errors: ${errorLogs}

`;

    if (errorLogs > 0) {
      report += '\nErrors:\n';
      this.logs
        .filter(log => log.level === 'error')
        .forEach(log => {
          report += `- ${log.timestamp.toISOString()}: ${log.message}\n`;
        });
    }

    if (warnLogs > 0) {
      report += '\nWarnings:\n';
      this.logs
        .filter(log => log.level === 'warn')
        .forEach(log => {
          report += `- ${log.timestamp.toISOString()}: ${log.message}\n`;
        });
    }

    return report;
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
    this.startTime = new Date();
  }
}
