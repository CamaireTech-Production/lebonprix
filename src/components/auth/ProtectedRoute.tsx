import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingScreen from '../common/LoadingScreen';
import { getUserSession, hasActiveSession } from '../../utils/userSession';
import { useEffect, useState } from 'react';

const ProtectedRoute = () => {
  const { currentUser, loading } = useAuth();
  const [checkingSession, setCheckingSession] = useState(true);

  // Check localStorage session while Firebase auth is loading
  useEffect(() => {
    if (loading && hasActiveSession()) {
      const session = getUserSession();
      if (session) {
        // Session exists - wait a bit for Firebase auth to restore
        // Don't redirect yet, let Firebase auth persistence work
        const timeout = setTimeout(() => {
          setCheckingSession(false);
        }, 2000); // Give Firebase auth 2 seconds to restore
        
        return () => clearTimeout(timeout);
      }
    }
    setCheckingSession(false);
  }, [loading]);

  // Show loading while checking auth state or validating session
  if (loading || checkingSession) {
    return <LoadingScreen />;
  }

  // If no Firebase user but session exists, still allow access (Firebase will restore)
  // This handles the case where Firebase auth persistence hasn't restored yet
  if (!currentUser && !hasActiveSession()) {
    return <Navigate to="/auth/login" />;
  }

  return <Outlet />;
};

export default ProtectedRoute;