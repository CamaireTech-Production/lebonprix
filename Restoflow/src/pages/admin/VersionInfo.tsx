import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { getCurrentVersionInfo, getVersionHistory, checkForUpdates } from '../../utils/versionManager';
import { APP_VERSION } from '../../config/version';
import { RefreshCw, Calendar, Hash, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import AdminDashboardLayout from '../../components/layout/AdminDashboardLayout';

const VersionInfo: React.FC = () => {
  const { currentAdmin } = useAdminAuth();
  const [versionInfo, setVersionInfo] = useState(getCurrentVersionInfo());
  const [versionHistory, setVersionHistory] = useState<any[]>([]);
  const [updateInfo, setUpdateInfo] = useState(checkForUpdates());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setVersionHistory(getVersionHistory());
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setVersionInfo(getCurrentVersionInfo());
      setVersionHistory(getVersionHistory());
      setUpdateInfo(checkForUpdates());
      setIsRefreshing(false);
    }, 1000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getUpdateStatusIcon = () => {
    if (updateInfo.hasUpdate) {
      return <AlertTriangle className="text-yellow-500" size={20} />;
    }
    return <CheckCircle className="text-green-500" size={20} />;
  };

  const getUpdateStatusText = () => {
    if (updateInfo.hasUpdate) {
      return 'Update Available';
    }
    return 'Up to Date';
  };

  const getUpdateStatusColor = () => {
    if (updateInfo.hasUpdate) {
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
    return 'text-green-600 bg-green-50 border-green-200';
  };

  return (
    <AdminDashboardLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Version Information</h1>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`${isRefreshing ? 'animate-spin' : ''}`} size={16} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Current Version Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Version</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Hash className="text-gray-400" size={20} />
                <div>
                  <p className="text-sm text-gray-500">Version</p>
                  <p className="font-semibold text-gray-900">v{versionInfo.version}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Hash className="text-gray-400" size={20} />
                <div>
                  <p className="text-sm text-gray-500">Build Number</p>
                  <p className="font-semibold text-gray-900">{versionInfo.buildNumber}</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Calendar className="text-gray-400" size={20} />
                <div>
                  <p className="text-sm text-gray-500">Build Date</p>
                  <p className="font-semibold text-gray-900">{versionInfo.buildDate}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Info className="text-gray-400" size={20} />
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <div className="flex items-center space-x-2">
                    {getUpdateStatusIcon()}
                    <span className={`font-semibold ${getUpdateStatusColor()}`}>
                      {getUpdateStatusText()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Release Notes */}
        {versionInfo.releaseNotes && versionInfo.releaseNotes.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Release Notes</h2>
            <ul className="space-y-2">
              {versionInfo.releaseNotes.map((note, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span className="text-gray-700">{note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Version History */}
        {versionHistory.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Version History</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Version
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Build
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Accessed At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User Agent
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {versionHistory.map((entry, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        v{entry.version}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {entry.buildNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(entry.accessedAt)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">
                        {entry.userAgent}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Update Information */}
        {updateInfo.hasUpdate && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="text-yellow-500 mt-0.5" size={20} />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">
                  Update Available
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  A new version ({updateInfo.latestVersion}) is available. 
                  Current version: {updateInfo.currentVersion}
                </p>
                {updateInfo.releaseNotes.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-yellow-800 mb-1">What's new:</p>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      {updateInfo.releaseNotes.slice(0, 3).map((note, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-yellow-600 mr-1">•</span>
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminDashboardLayout>
  );
};

export default VersionInfo; 