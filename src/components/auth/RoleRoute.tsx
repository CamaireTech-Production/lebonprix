import React, { useEffect, useRef } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { useRolePermissions } from '@hooks/business/useRolePermissions';
import { LoadingScreen } from '@components/common';
import { showErrorToast } from '@utils/core/toast';

interface RoleRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<'vendeur' | 'gestionnaire' | 'magasinier' | 'owner'>; // Deprecated: use requiredResource instead
  requiredResource?: string; // New: check template permissions for resource access
  fallbackPath?: string;
}

const RoleRoute = ({ children, allowedRoles, requiredResource, fallbackPath }: RoleRouteProps) => {
  const { effectiveRole, isOwner, loading, companyLoading, user, company } = useAuth();
  const { companyId } = useParams<{ companyId: string }>();
  const { canAccess, canAccessFinance, canAccessHR, canAccessSettings, templateLoading, template } = useRolePermissions(company?.id);
  // Note: canAccessFinance, canAccessHR, canAccessSettings are computed from canView for backward compatibility
  const hasShownError = useRef(false);

  // Reset error flag when resource changes - DOIT être avant tous les returns conditionnels
  useEffect(() => {
    hasShownError.current = false;
  }, [requiredResource]);

  if (loading || companyLoading || templateLoading) {
    return <LoadingScreen />;
  }

  // Si pas owner et pas de template chargé, afficher un loader ou un message d'erreur
  const isActualOwner = isOwner || effectiveRole === 'owner';
  if (!isActualOwner && !template) {
    return <LoadingScreen message="Chargement des permissions..." />;
  }

  // Si l'utilisateur est propriétaire (isOwner) ou a le rôle 'owner', il a accès à tout
  // Note: isOwner vérifie si l'utilisateur est le créateur de l'entreprise (userId === companyId)
  // effectiveRole === 'owner' peut exister pour les employés avec rôle owner
  // isActualOwner est déjà déclaré ligne 40
  
  if (isActualOwner) {
    return <>{children}</>;
  }

  // Priority 1: Check by required resource (permission-based access)
  if (requiredResource) {
    // Toutes les ressources utilisent maintenant canAccess (unifié avec canView array)
    const hasAccess = canAccess(requiredResource);
    
    if (!hasAccess) {
      // Afficher le toast dans un useEffect pour éviter le warning React
      if (!hasShownError.current) {
        hasShownError.current = true;
        showErrorToast('Accès refusé. Vous n\'avez pas les permissions nécessaires.');
      }
      
      // Si on est dans une route company, rediriger vers le dashboard de cette company
      if (companyId) {
        return <Navigate to={`/company/${companyId}/dashboard`} replace />;
      }
      
      // Si pas de companyId mais qu'un fallbackPath est fourni, l'utiliser
      if (fallbackPath) {
        return <Navigate to={fallbackPath} replace />;
      }
      
      // Dernier recours : rediriger vers la sélection d'entreprise si l'utilisateur existe
      if (user?.uid) {
        return <Navigate to={`/companies/me/${user.uid}`} replace />;
      }
      
      // Fallback absolu : rediriger vers login
      return <Navigate to="/auth/login" replace />;
    }
    
    return <>{children}</>;
  }

  // Priority 2: Deprecated role-based check (for backward compatibility)
  if (allowedRoles) {
    if (!effectiveRole || !allowedRoles.includes(effectiveRole as any)) {
      // Afficher le toast dans un useEffect pour éviter le warning React
      if (!hasShownError.current) {
        hasShownError.current = true;
        showErrorToast('Accès refusé. Vous n\'avez pas les permissions nécessaires.');
      }
      
      // Si on est dans une route company, rediriger vers le dashboard de cette company
      if (companyId) {
        return <Navigate to={`/company/${companyId}/dashboard`} replace />;
      }
      
      // Si pas de companyId mais qu'un fallbackPath est fourni, l'utiliser
      if (fallbackPath) {
        return <Navigate to={fallbackPath} replace />;
      }

      // Dernier recours : rediriger vers la sélection d'entreprise si l'utilisateur existe
      if (user?.uid) {
        return <Navigate to={`/companies/me/${user.uid}`} replace />;
      }
      
      // Fallback absolu : rediriger vers login
      return <Navigate to="/auth/login" replace />;
    }
  }

  return <>{children}</>;
};

export default RoleRoute;
