import React from 'react';
import { useOfflineSync } from '../../contexts/OfflineSyncContext';

const bannerStyle: React.CSSProperties = {
  width: '100%',
  background: '#ffe066',
  color: '#333',
  padding: '8px 16px',
  textAlign: 'center',
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  zIndex: 1000,
  borderBottom: '1px solid #ffd700',
};

const buttonStyle: React.CSSProperties = {
  background: '#ffd700',
  color: '#333',
  border: 'none',
  borderRadius: 4,
  padding: '4px 12px',
  fontWeight: 600,
  cursor: 'pointer',
  marginLeft: 16,
};

const OfflineStatusBanner: React.FC = () => {
  const { isOnline, syncing, syncNow, lastSync } = useOfflineSync();

  // Show banner only when offline
  if (isOnline) return null;

  return (
    <div style={bannerStyle}>
      <span>
        <span role="img" aria-label="offline">⚠️</span> Offline mode: changes will be synced when back online.
        {lastSync && (
          <span style={{ marginLeft: 12, fontSize: 13, color: '#888' }}>
            Last sync: {new Date(lastSync).toLocaleString()}
          </span>
        )}
      </span>
      <button style={buttonStyle} onClick={syncNow} disabled={syncing}>
        {syncing ? 'Syncing...' : 'Sync Now'}
      </button>
    </div>
  );
};

export default OfflineStatusBanner;
