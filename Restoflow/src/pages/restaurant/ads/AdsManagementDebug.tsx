import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { db } from '../../../firebase/config';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

const AdsManagementDebug: React.FC = () => {
  const { restaurant, currentUser } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AdsManagementDebug: Component mounted');
    console.log('Restaurant:', restaurant);
    console.log('Current User:', currentUser);
    
    setDebugInfo({
      restaurant: restaurant ? {
        id: restaurant.id,
        name: restaurant.name,
        email: restaurant.email
      } : null,
      currentUser: currentUser ? {
        uid: currentUser.uid,
        email: currentUser.email
      } : null,
      timestamp: new Date().toISOString()
    });

    if (!restaurant?.id) {
      console.log('No restaurant ID found');
      setLoading(false);
      return;
    }

    console.log('Setting up Firebase listener for restaurant:', restaurant.id);
    
    const adsQuery = query(
      collection(db, 'ads'),
      where('restaurantId', '==', restaurant.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(adsQuery, 
      (snapshot) => {
        console.log('Firebase snapshot received:', snapshot.docs.length, 'ads');
        const adsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log('Ads data:', adsData);
        setDebugInfo(prev => ({
          ...prev,
          adsCount: adsData.length,
          ads: adsData,
          lastUpdate: new Date().toISOString()
        }));
        setLoading(false);
      },
      (error) => {
        console.error('Firebase error:', error);
        setDebugInfo(prev => ({
          ...prev,
          error: error.message,
          lastUpdate: new Date().toISOString()
        }));
        setLoading(false);
      }
    );

    return () => {
      console.log('Cleaning up Firebase listener');
      unsubscribe();
    };
  }, [restaurant?.id, currentUser]);

  if (loading) {
    return (
      <DashboardLayout title="Ads Management - Debug">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <span className="ml-4">Loading debug info...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Ads Management - Debug">
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Debug Information</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-700">Authentication Status:</h3>
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold text-gray-700">Restaurant Info:</h3>
              <p>ID: {restaurant?.id || 'Not found'}</p>
              <p>Name: {restaurant?.name || 'Not found'}</p>
              <p>Email: {restaurant?.email || 'Not found'}</p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-700">User Info:</h3>
              <p>UID: {currentUser?.uid || 'Not found'}</p>
              <p>Email: {currentUser?.email || 'Not found'}</p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-700">Firebase Connection:</h3>
              <p>Database: {db ? 'Connected' : 'Not connected'}</p>
              <p>Ads Count: {debugInfo.adsCount || 0}</p>
              {debugInfo.error && (
                <p className="text-red-600">Error: {debugInfo.error}</p>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-gray-700">Actions:</h3>
              <button
                onClick={() => {
                  console.log('Manual refresh triggered');
                  setDebugInfo(prev => ({
                    ...prev,
                    manualRefresh: new Date().toISOString()
                  }));
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Manual Refresh
              </button>
            </div>
          </div>
        </div>

        {debugInfo.ads && debugInfo.ads.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Ads Data</h2>
            <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto max-h-96">
              {JSON.stringify(debugInfo.ads, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdsManagementDebug;
