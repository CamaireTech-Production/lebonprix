import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingScreen from '../common/LoadingScreen';
import { showErrorToast } from '../../utils/toast';

interface RoleRouteProps {
  children: React.ReactNode;
  allowedRoles: Array<'vendeur' | 'gestionnaire' | 'magasinier' | 'owner'>;
  fallbackPath?: string;
}

const RoleRoute = ({ children, allowedRoles, fallbackPath = '/' }: RoleRouteProps) => {
  const { effectiveRole, isOwner, loading, companyLoading } = useAuth();

  console.log('🔐 RoleRoute check:', { 
    effectiveRole, 
    isOwner, 
    loading, 
    companyLoading,
    allowedRoles 
  });

  if (loading || companyLoading) {
    console.log('⏳ RoleRoute: Still loading (auth or company)...');
    return <LoadingScreen />;
  }

  // Si l'utilisateur est propriétaire, il a accès à tout
  if (isOwner) {
    console.log('✅ RoleRoute: User is owner, allowing access');
    return <>{children}</>;
  }

  // Vérifier si l'utilisateur a le rôle requis
  if (!effectiveRole || !allowedRoles.includes(effectiveRole)) {
    console.log('❌ RoleRoute: Access denied - role:', effectiveRole, 'allowed:', allowedRoles);
    showErrorToast('Accès refusé. Vous n\'avez pas les permissions nécessaires.');
    return <Navigate to={fallbackPath} replace />;
  }

  console.log('✅ RoleRoute: User has required role, allowing access');
  return <>{children}</>;
};

export default RoleRoute;
