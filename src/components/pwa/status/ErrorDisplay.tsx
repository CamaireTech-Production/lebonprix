import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, X, ChevronDown, ChevronUp, Trash2, Download, Copy, Bug } from 'lucide-react';
import { errorLogger, LogEntry } from '@/services/errorLogger';
import toast from 'react-hot-toast';

interface ErrorDisplayProps {
  /** Show the error panel by default */
  defaultOpen?: boolean;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ defaultOpen = false }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load initial logs
    setLogs(errorLogger.getLogs());

    // Subscribe to new logs
    const unsubscribe = errorLogger.subscribe((newLogs) => {
      setLogs(newLogs);
      
      // Auto-scroll to bottom when new logs arrive
      if (isExpanded && logsEndRef.current) {
        setTimeout(() => {
          logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    });

    return unsubscribe;
  }, [isExpanded]);

  // Auto-open if there are errors
  useEffect(() => {
    const errors = errorLogger.getErrors();
    if (errors.length > 0 && !isOpen) {
      // Only auto-open for critical errors (not just warnings)
      const criticalErrors = errors.filter(
        (e) => e.type === 'error' || e.type === 'unhandledRejection' || e.type === 'reactError'
      );
      if (criticalErrors.length > 0) {
        setIsOpen(true);
      }
    }
  }, [logs, isOpen]);

  const handleClear = () => {
    errorLogger.clearLogs();
    setLogs([]);
    setSelectedLog(null);
    toast.success('Logs cleared');
  };

  const handleExport = () => {
    const exportData = errorLogger.exportLogs();
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Logs exported');
  };

  const handleCopy = (log: LogEntry) => {
    const text = `${log.type.toUpperCase()}: ${log.message}\n\n${log.stack || ''}\n\nTimestamp: ${new Date(log.timestamp).toISOString()}`;
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard');
    });
  };

  const getErrorCount = () => {
    return logs.filter((log) => log.type === 'error' || log.type === 'unhandledRejection' || log.type === 'reactError').length;
  };

  const getWarningCount = () => {
    return logs.filter((log) => log.type === 'warn').length;
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'error':
      case 'unhandledRejection':
      case 'reactError':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warn':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Bug className="h-4 w-4 text-blue-500" />;
    }
  };

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'error':
      case 'unhandledRejection':
      case 'reactError':
        return 'bg-red-50 border-red-200 hover:bg-red-100';
      case 'warn':
        return 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100';
      default:
        return 'bg-gray-50 border-gray-200 hover:bg-gray-100';
    }
  };

  const errorCount = getErrorCount();
  const warningCount = getWarningCount();

  if (!isOpen && errorCount === 0 && warningCount === 0) {
    return null;
  }

  return (
    <>
      {/* Floating Toggle Button - Always visible when there are errors */}
      {!isOpen && (errorCount > 0 || warningCount > 0) && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-[10000] bg-red-500 text-white p-3 rounded-full shadow-lg hover:bg-red-600 transition-colors flex items-center justify-center"
          aria-label="Show errors"
        >
          <AlertTriangle className="h-5 w-5" />
          {errorCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-white text-red-500 text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {errorCount}
            </span>
          )}
        </button>
      )}

      {/* Error Panel */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 left-0 md:left-auto md:w-96 z-[10000] bg-white border-t md:border-l md:border-t-0 border-gray-300 shadow-2xl flex flex-col max-h-[80vh]">
          {/* Header */}
          <div className="bg-red-500 text-white p-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bug className="h-5 w-5" />
              <h3 className="font-semibold text-sm">Error Logs</h3>
              {errorCount > 0 && (
                <span className="bg-white text-red-500 text-xs font-bold px-2 py-0.5 rounded-full">
                  {errorCount}
                </span>
              )}
              {warningCount > 0 && (
                <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full">
                  {warningCount}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 hover:bg-red-600 rounded transition-colors"
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-red-600 rounded transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Logs List */}
          <div className={`flex-1 overflow-y-auto ${isExpanded ? '' : 'max-h-48'}`}>
            {logs.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No logs</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-3 cursor-pointer border-l-4 ${getLogColor(log.type)}`}
                    onClick={() => setSelectedLog(log)}
                  >
                    <div className="flex items-start space-x-2">
                      {getLogIcon(log.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase text-gray-600">
                            {log.type}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(log.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 mt-1 break-words line-clamp-2">
                          {log.message}
                        </p>
                        {log.source && (
                          <p className="text-xs text-gray-500 mt-1">{log.source}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="border-t border-gray-200 p-2 flex items-center justify-between bg-gray-50">
            <div className="flex space-x-1">
              <button
                onClick={handleClear}
                className="p-2 text-gray-600 hover:bg-gray-200 rounded transition-colors"
                aria-label="Clear logs"
                title="Clear logs"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={handleExport}
                className="p-2 text-gray-600 hover:bg-gray-200 rounded transition-colors"
                aria-label="Export logs"
                title="Export logs"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
            <div className="text-xs text-gray-500">
              {logs.length} log{logs.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}

      {/* Log Detail Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[10001] flex items-center justify-center p-4"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-red-500 text-white p-4 flex items-center justify-between">
              <h3 className="font-semibold">Log Details</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 hover:bg-red-600 rounded transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase">Type</label>
                  <p className="text-sm text-gray-800 mt-1">{selectedLog.type}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase">Message</label>
                  <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap break-words">
                    {selectedLog.message}
                  </p>
                </div>
                {selectedLog.stack && (
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">Stack Trace</label>
                    <pre className="text-xs text-gray-800 mt-1 bg-gray-100 p-3 rounded overflow-x-auto">
                      {selectedLog.stack}
                    </pre>
                  </div>
                )}
                {selectedLog.source && (
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">Source</label>
                    <p className="text-sm text-gray-800 mt-1">{selectedLog.source}</p>
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase">Timestamp</label>
                  <p className="text-sm text-gray-800 mt-1">
                    {new Date(selectedLog.timestamp).toLocaleString()}
                  </p>
                </div>
                {selectedLog.data && (
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">Additional Data</label>
                    <pre className="text-xs text-gray-800 mt-1 bg-gray-100 p-3 rounded overflow-x-auto">
                      {JSON.stringify(selectedLog.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
            <div className="border-t border-gray-200 p-4 flex justify-end">
              <button
                onClick={() => handleCopy(selectedLog)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors flex items-center space-x-2"
              >
                <Copy className="h-4 w-4" />
                <span>Copy</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

