/**
 * Firebase Read Monitor Component
 * Displays real-time Firebase read statistics in development mode
 */

import React, { useState, useEffect } from 'react';
import { Activity, X, AlertTriangle, CheckCircle, BarChart3 } from 'lucide-react';
import { getReadStats, getReadReport, resetReadTracking } from '@utils/firestore/readTracker';

interface FirebaseReadMonitorProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

const FirebaseReadMonitor: React.FC<FirebaseReadMonitorProps> = ({ 
  position = 'bottom-right' 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState(getReadStats());
  const [report, setReport] = useState('');

  // Only show in development
  if (import.meta.env.PROD) {
    return null;
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(getReadStats());
      setReport(getReadReport());
    }, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, []);

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4'
  };

  const readsWithoutLimit = stats.readsWithoutLimit;
  const hasIssues = readsWithoutLimit > 0;

  return (
    <div className={`fixed ${positionClasses[position]} z-50`}>
      {!isOpen ? (
        // Collapsed view
        <button
          onClick={() => setIsOpen(true)}
          className={`
            bg-white dark:bg-gray-800 
            border-2 ${hasIssues ? 'border-red-500' : 'border-blue-500'} 
            rounded-lg shadow-lg p-3
            hover:shadow-xl transition-all
            flex items-center gap-2
          `}
          title="Firebase Read Monitor"
        >
          <Activity className={`w-5 h-5 ${hasIssues ? 'text-red-500' : 'text-blue-500'}`} />
          <div className="text-sm font-semibold">
            <div className="text-gray-700 dark:text-gray-300">
              Reads: {stats.totalReads}
            </div>
            {hasIssues && (
              <div className="text-red-600 dark:text-red-400 text-xs">
                ⚠️ {readsWithoutLimit} no limit
              </div>
            )}
          </div>
        </button>
      ) : (
        // Expanded view
        <div className="bg-white dark:bg-gray-800 border-2 border-blue-500 rounded-lg shadow-xl p-4 w-80 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              <h3 className="font-bold text-gray-800 dark:text-gray-200">
                Firebase Reads
              </h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 text-sm">
            {/* Summary */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-600 dark:text-gray-400">Total Reads</span>
                <span className="font-bold text-gray-800 dark:text-gray-200">
                  {stats.totalReads}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">With Limit</span>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {stats.readsWithLimit}
                </span>
              </div>
              {stats.readsWithoutLimit > 0 && (
                <div className="flex items-center justify-between mt-1">
                  <span className="text-red-600 dark:text-red-400">Without Limit</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    {stats.readsWithoutLimit}
                  </span>
                </div>
              )}
            </div>

            {/* Operation Types */}
            <div>
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Operation Types
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Listeners</span>
                  <span className="font-semibold">{stats.snapshotListeners}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>One-time</span>
                  <span className="font-semibold">{stats.oneTimeReads}</span>
                </div>
              </div>
            </div>

            {/* Top Collections */}
            {Object.keys(stats.readsByCollection).length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  Top Collections
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {Object.entries(stats.readsByCollection)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([collection, count]) => (
                      <div key={collection} className="flex justify-between text-xs">
                        <span className="truncate">{collection}</span>
                        <span className="font-semibold ml-2">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-600">
              <button
                onClick={() => {
                  const report = getReadReport();
                  console.log(report);
                  navigator.clipboard.writeText(report).then(() => {
                    alert('Report copied to clipboard!');
                  });
                }}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs py-1.5 px-2 rounded transition-colors"
              >
                Copy Report
              </button>
              <button
                onClick={() => {
                  if (confirm('Reset all tracking data?')) {
                    resetReadTracking();
                    setStats(getReadStats());
                    setReport('');
                  }
                }}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white text-xs py-1.5 px-2 rounded transition-colors"
              >
                Reset
              </button>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center gap-2 text-xs pt-2 border-t border-gray-200 dark:border-gray-600">
              {hasIssues ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-red-600 dark:text-red-400">
                    Some reads without limits detected
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-green-600 dark:text-green-400">
                    All reads optimized
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FirebaseReadMonitor;

