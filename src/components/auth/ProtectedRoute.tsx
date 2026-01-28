import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { SkeletonAppLoading } from '@components/common';
import { getUserSession, hasActiveSession } from '@utils/storage/userSession';
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
    // If not loading or no session, check if we need to wait for auth state
    // During signup flow, auth state might not be ready immediately
    if (!loading) {
      // Give a small delay to allow auth state to propagate after signup
      const timeout = setTimeout(() => {
        setCheckingSession(false);
      }, 300); // Small delay for auth state propagation
      
      return () => clearTimeout(timeout);
    }
    setCheckingSession(false);
  }, [loading]);

  // Show loading while checking auth state or validating session
  if (loading || checkingSession) {
    return <SkeletonAppLoading />;
  }

  // If no Firebase user but session exists, still allow access (Firebase will restore)
  // This handles the case where Firebase auth persistence hasn't restored yet
  // Also handles signup flow where session is saved but currentUser might not be set yet
  if (!currentUser && !hasActiveSession()) {
    return <Navigate to="/auth/login" />;
  }

  return <Outlet />;
};

export default ProtectedRoute;