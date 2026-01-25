import React from 'react';

interface AdDebuggerProps {
  restaurantId?: string;
  ads: any[];
  currentAd: any;
  restaurant: any;
}

const AdDebugger: React.FC<AdDebuggerProps> = ({ 
  restaurantId, 
  ads, 
  currentAd, 
  restaurant 
}) => {
  if (process.env.NODE_ENV !== 'development') {
    return null; // Only show in development
  }

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <h4>Ad Debug Info</h4>
      <div><strong>Restaurant ID:</strong> {restaurantId || 'None'}</div>
      <div><strong>Restaurant Name:</strong> {restaurant?.name || 'None'}</div>
      <div><strong>Ads Count:</strong> {ads.length}</div>
      <div><strong>Current Ad:</strong> {currentAd ? currentAd.title : 'None'}</div>
      <div><strong>Current Ad ID:</strong> {currentAd?.id || 'None'}</div>
      <div><strong>Current Ad Status:</strong> {currentAd?.status || 'None'}</div>
      {ads.length > 0 && (
        <div>
          <strong>All Ads:</strong>
          <ul style={{ margin: '5px 0', paddingLeft: '15px' }}>
            {ads.map((ad, index) => (
              <li key={ad.id}>
                {ad.title} (Status: {ad.status})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AdDebugger;
