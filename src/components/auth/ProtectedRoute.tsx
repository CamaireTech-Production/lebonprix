import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingScreen from '../common/LoadingScreen';

const ProtectedRoute = () => {
  const { currentUser, loading } = useAuth();

  console.log('🛡️ ProtectedRoute check:', { 
    hasCurrentUser: !!currentUser, 
    currentUserId: currentUser?.uid, 
    loading 
  });

  if (loading) {
    console.log('⏳ ProtectedRoute: Still loading...');
    return <LoadingScreen />;
  }

  if (!currentUser) {
    console.log('❌ ProtectedRoute: No currentUser, redirecting to login');
    return <Navigate to="/auth/login" />;
  }

  console.log('✅ ProtectedRoute: User authenticated, allowing access');
  return <Outlet />;
};

export default ProtectedRoute;