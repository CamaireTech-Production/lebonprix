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
  const { effectiveRole, isOwner, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  // Si l'utilisateur est propriétaire, il a accès à tout
  if (isOwner) {
    return <>{children}</>;
  }

  // Vérifier si l'utilisateur a le rôle requis
  if (!effectiveRole || !allowedRoles.includes(effectiveRole)) {
    showErrorToast('Accès refusé. Vous n\'avez pas les permissions nécessaires.');
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};

export default RoleRoute;
