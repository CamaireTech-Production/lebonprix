// src/components/common/SyncIndicator.tsx
import React from 'react';

interface SyncIndicatorProps {
  isSyncing: boolean;
  message?: string;
  className?: string;
}

const SyncIndicator: React.FC<SyncIndicatorProps> = ({ 
  isSyncing, 
  message = "Updating products...", 
  className = "" 
}) => {
  if (!isSyncing) return null;

  return (
    <div className={`bg-blue-50 border-l-4 border-blue-400 p-3 mb-4 ${className}`}>
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        </div>
        <div className="ml-3">
          <p className="text-sm text-blue-700 font-medium">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SyncIndicator;
