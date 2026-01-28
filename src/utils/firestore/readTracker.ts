/**
 * Firebase Read Tracker
 * Tracks Firestore read operations for monitoring and optimization
 */

interface ReadOperation {
  collection: string;
  operation: 'getDoc' | 'getDocs' | 'onSnapshot' | 'query';
  timestamp: number;
  documentCount?: number;
  limit?: number;
  hasLimit: boolean;
}

interface ReadStats {
  totalReads: number;
  readsByCollection: Record<string, number>;
  readsByOperation: Record<string, number>;
  readsWithLimit: number;
  readsWithoutLimit: number;
  snapshotListeners: number;
  oneTimeReads: number;
}

class FirebaseReadTracker {
  private reads: ReadOperation[] = [];
  private maxStoredReads = 1000; // Keep last 1000 operations
  private isEnabled: boolean;
  private statsInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Only enable in development mode
    this.isEnabled = import.meta.env.DEV || import.meta.env.MODE === 'development';
    
    // Clear old reads periodically
    if (this.isEnabled) {
      this.statsInterval = setInterval(() => {
        this.clearOldReads();
      }, 60000); // Every minute
    }
  }

  /**
   * Track a read operation
   */
  trackRead(
    collection: string,
    operation: 'getDoc' | 'getDocs' | 'onSnapshot' | 'query',
    documentCount?: number,
    limit?: number
  ): void {
    if (!this.isEnabled) return;

    const read: ReadOperation = {
      collection,
      operation,
      timestamp: Date.now(),
      documentCount,
      limit,
      hasLimit: limit !== undefined && limit > 0
    };

    this.reads.push(read);

    // Keep only last N reads
    if (this.reads.length > this.maxStoredReads) {
      this.reads = this.reads.slice(-this.maxStoredReads);
    }

    // Log in development
    if (import.meta.env.DEV) {
      const limitInfo = read.hasLimit ? ` (limit: ${limit})` : ' (NO LIMIT!)';
      console.log(
        `[Firebase Read] ${operation} on ${collection}${limitInfo}${documentCount ? ` - ${documentCount} docs` : ''}`
      );
    }
  }

  /**
   * Get current statistics
   */
  getStats(): ReadStats {
    const stats: ReadStats = {
      totalReads: this.reads.length,
      readsByCollection: {},
      readsByOperation: {},
      readsWithLimit: 0,
      readsWithoutLimit: 0,
      snapshotListeners: 0,
      oneTimeReads: 0
    };

    this.reads.forEach(read => {
      // Count by collection
      stats.readsByCollection[read.collection] = 
        (stats.readsByCollection[read.collection] || 0) + 1;

      // Count by operation
      stats.readsByOperation[read.operation] = 
        (stats.readsByOperation[read.operation] || 0) + 1;

      // Count with/without limit
      if (read.hasLimit) {
        stats.readsWithLimit++;
      } else {
        stats.readsWithoutLimit++;
      }

      // Count snapshot listeners vs one-time reads
      if (read.operation === 'onSnapshot') {
        stats.snapshotListeners++;
      } else {
        stats.oneTimeReads++;
      }
    });

    return stats;
  }

  /**
   * Get reads for a specific collection
   */
  getCollectionReads(collection: string): ReadOperation[] {
    return this.reads.filter(read => read.collection === collection);
  }

  /**
   * Get reads without limits (potential issues)
   */
  getReadsWithoutLimit(): ReadOperation[] {
    return this.reads.filter(read => !read.hasLimit && read.operation !== 'getDoc');
  }

  /**
   * Clear old reads (older than 1 hour)
   */
  private clearOldReads(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.reads = this.reads.filter(read => read.timestamp > oneHourAgo);
  }

  /**
   * Reset all tracking data
   */
  reset(): void {
    this.reads = [];
  }

  /**
   * Get summary report
   */
  getReport(): string {
    const stats = this.getStats();
    const readsWithoutLimit = this.getReadsWithoutLimit();

    let report = '\n' + '='.repeat(80) + '\n';
    report += '🔥 FIREBASE READ TRACKING REPORT\n';
    report += '='.repeat(80) + '\n\n';
    
    report += `Total Reads: ${stats.totalReads}\n`;
    report += `  - With Limit: ${stats.readsWithLimit} (${((stats.readsWithLimit / stats.totalReads) * 100).toFixed(1)}%)\n`;
    report += `  - Without Limit: ${stats.readsWithoutLimit} (${((stats.readsWithoutLimit / stats.totalReads) * 100).toFixed(1)}%)\n\n`;
    
    report += `Operation Types:\n`;
    report += `  - Snapshot Listeners: ${stats.snapshotListeners}\n`;
    report += `  - One-time Reads: ${stats.oneTimeReads}\n\n`;

    if (Object.keys(stats.readsByCollection).length > 0) {
      report += `Reads by Collection:\n`;
      const sortedCollections = Object.entries(stats.readsByCollection)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Top 10
      
      sortedCollections.forEach(([collection, count]) => {
        report += `  - ${collection}: ${count}\n`;
      });
      report += '\n';
    }

    if (readsWithoutLimit.length > 0) {
      report += `⚠️  WARNING: ${readsWithoutLimit.length} reads without limits detected!\n`;
      report += `Top collections without limits:\n`;
      const collectionCounts: Record<string, number> = {};
      readsWithoutLimit.forEach(read => {
        collectionCounts[read.collection] = (collectionCounts[read.collection] || 0) + 1;
      });
      
      Object.entries(collectionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([collection, count]) => {
          report += `  - ${collection}: ${count}\n`;
        });
    }

    report += '\n' + '='.repeat(80) + '\n';

    return report;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    this.reads = [];
  }
}

// Singleton instance
export const readTracker = new FirebaseReadTracker();

// Export utility functions
export const trackRead = (
  collection: string,
  operation: 'getDoc' | 'getDocs' | 'onSnapshot' | 'query',
  documentCount?: number,
  limit?: number
) => {
  readTracker.trackRead(collection, operation, documentCount, limit);
};

export const getReadStats = () => readTracker.getStats();
export const getReadReport = () => readTracker.getReport();
export const resetReadTracking = () => readTracker.reset();

// Make tracker available globally in development
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).__firebaseReadTracker = {
    getStats: getReadStats,
    getReport: getReadReport,
    reset: resetReadTracking
  };
  
  console.log(
    '%c[Firebase Read Tracker]',
    'color: #ff6b6b; font-weight: bold;',
    'Tracking enabled. Use window.__firebaseReadTracker to view stats.'
  );
}

