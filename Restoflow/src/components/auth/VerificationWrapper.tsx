import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import VerificationPending from './VerificationPending';
import LoadingSpinner from '../ui/LoadingSpinner';

interface VerificationWrapperProps {
  children: React.ReactNode;
}

const VerificationWrapper: React.FC<VerificationWrapperProps> = ({ children }) => {
  const { currentUser, restaurant, loading, isVerified, signOut } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  // If user is not authenticated, show the children (login/register pages)
  if (!currentUser || !restaurant) {
    return <>{children}</>;
  }

  // If user is authenticated but not verified, show verification pending UI
  if (!isVerified) {
    return <VerificationPending restaurant={restaurant} onLogout={signOut} />;
  }

  // If user is verified, show the protected content
  return <>{children}</>;
};

export default VerificationWrapper;

