import React, { useState } from 'react';
import { Info, X } from 'lucide-react';
import { APP_VERSION, formatVersionDisplay, getVersionBadgeColor } from '../../config/version';

interface VersionDisplayProps {
  variant?: 'badge' | 'text' | 'detailed';
  showReleaseNotes?: boolean;
  className?: string;
}

const VersionDisplay: React.FC<VersionDisplayProps> = ({ 
  variant = 'badge', 
  showReleaseNotes = false,
  className = ''
}) => {
  const [showNotes, setShowNotes] = useState(false);

  const renderBadge = () => (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getVersionBadgeColor(APP_VERSION)} ${className}`}>
      {formatVersionDisplay(APP_VERSION)}
    </span>
  );

  const renderText = () => (
    <span className={`text-sm text-gray-600 ${className}`}>
      {formatVersionDisplay(APP_VERSION)}
    </span>
  );

  const renderDetailed = () => (
    <div className={`flex items-center space-x-2 ${className}`}>
      <span className="text-sm text-gray-600">
        {formatVersionDisplay(APP_VERSION)}
      </span>
      {showReleaseNotes && APP_VERSION.releaseNotes && (
        <button
          onClick={() => setShowNotes(!showNotes)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title="View release notes"
        >
          <Info size={14} />
        </button>
      )}
    </div>
  );

  const renderReleaseNotes = () => {
    if (!showNotes || !APP_VERSION.releaseNotes) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Release Notes</h3>
            <button
              onClick={() => setShowNotes(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-600 mb-3">
              Version {APP_VERSION.version} • Build {APP_VERSION.buildNumber}
            </p>
            <ul className="space-y-1">
              {APP_VERSION.releaseNotes.map((note, index) => (
                <li key={index} className="text-sm text-gray-700 flex items-start">
                  <span className="text-blue-500 mr-2">•</span>
                  {note}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {variant === 'badge' && renderBadge()}
      {variant === 'text' && renderText()}
      {variant === 'detailed' && renderDetailed()}
      {renderReleaseNotes()}
    </>
  );
};

export default VersionDisplay; 