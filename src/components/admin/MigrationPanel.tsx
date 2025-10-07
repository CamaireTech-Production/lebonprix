// src/components/admin/MigrationPanel.tsx
import React, { useState } from 'react';
import { runImageMigration, analyzeImageStorage } from '../../utils/migrationUtils';
import { MigrationResult } from '../../types/migration';

export const MigrationPanel: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<MigrationResult[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [config, setConfig] = useState({
    batchSize: 10,
    maxConcurrent: 5,
    retryAttempts: 3,
    dryRun: true
  });

  const handleAnalyze = async () => {
    try {
      const analysisResult = await analyzeImageStorage();
      setAnalysis(analysisResult);
    } catch (error) {
      console.error('Analysis failed:', error);
    }
  };

  const handleMigration = async () => {
    setIsRunning(true);
    try {
      const migrationResults = await runImageMigration(config);
      setResults(migrationResults);
    } catch (error) {
      console.error('Migration failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalImages = results.reduce((sum, r) => sum + r.imagesUploaded, 0);

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Image Migration Panel</h2>
      
      {/* Analysis Section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Storage Analysis</h3>
        <button
          onClick={handleAnalyze}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Analyze Current Storage
        </button>
        
        {analysis && (
          <div className="mt-4 p-4 bg-gray-100 rounded">
            <p>Total Products: {analysis.totalProducts}</p>
            <p>Total Images: {analysis.totalImages}</p>
            <p>Total Size: {(analysis.totalSize / 1024 / 1024).toFixed(2)} MB</p>
            <p>Users with Images: {analysis.usersWithImages}</p>
          </div>
        )}
      </div>

      {/* Configuration Section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Migration Configuration</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Batch Size</label>
            <input
              type="number"
              value={config.batchSize}
              onChange={(e) => setConfig({...config, batchSize: parseInt(e.target.value)})}
              className="w-full p-2 border rounded"
              min="1"
              max="50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Max Concurrent</label>
            <input
              type="number"
              value={config.maxConcurrent}
              onChange={(e) => setConfig({...config, maxConcurrent: parseInt(e.target.value)})}
              className="w-full p-2 border rounded"
              min="1"
              max="10"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Retry Attempts</label>
            <input
              type="number"
              value={config.retryAttempts}
              onChange={(e) => setConfig({...config, retryAttempts: parseInt(e.target.value)})}
              className="w-full p-2 border rounded"
              min="1"
              max="5"
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="dryRun"
              checked={config.dryRun}
              onChange={(e) => setConfig({...config, dryRun: e.target.checked})}
              className="mr-2"
            />
            <label htmlFor="dryRun" className="text-sm font-medium">Dry Run</label>
          </div>
        </div>
      </div>

      {/* Migration Section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Run Migration</h3>
        <button
          onClick={handleMigration}
          disabled={isRunning}
          className={`px-6 py-2 rounded font-medium ${
            isRunning
              ? 'bg-gray-400 cursor-not-allowed'
              : config.dryRun
              ? 'bg-yellow-500 hover:bg-yellow-600'
              : 'bg-green-500 hover:bg-green-600'
          } text-white`}
        >
          {isRunning ? 'Running...' : config.dryRun ? 'Test Migration' : 'Run Migration'}
        </button>
        
        {config.dryRun && (
          <p className="text-sm text-yellow-600 mt-2">
            ⚠️ Dry run mode - no actual changes will be made
          </p>
        )}
      </div>

      {/* Results Section */}
      {results.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Migration Results</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="p-4 bg-green-100 rounded">
              <p className="text-2xl font-bold text-green-600">{successful}</p>
              <p className="text-sm text-green-700">Successful</p>
            </div>
            <div className="p-4 bg-red-100 rounded">
              <p className="text-2xl font-bold text-red-600">{failed}</p>
              <p className="text-sm text-red-700">Failed</p>
            </div>
            <div className="p-4 bg-blue-100 rounded">
              <p className="text-2xl font-bold text-blue-600">{totalImages}</p>
              <p className="text-sm text-blue-700">Images Migrated</p>
            </div>
          </div>
          
          {failed > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Failed Products:</h4>
              <div className="max-h-40 overflow-y-auto">
                {results.filter(r => !r.success).map((result, index) => (
                  <div key={index} className="p-2 bg-red-50 border-l-4 border-red-400 mb-2">
                    <p className="font-medium">{result.productId}</p>
                    <p className="text-sm text-red-600">{result.errors.join(', ')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
