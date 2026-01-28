import React, { useEffect, useRef, useMemo } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { useRolePermissions } from '@hooks/business/useRolePermissions';
import { SkeletonAppLoading } from '@components/common';
import { showErrorToast } from '@utils/core/toast';

interface RoleRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<'vendeur' | 'gestionnaire' | 'magasinier' | 'owner'>; // Deprecated: use requiredResource instead
  requiredResource?: string; // New: check template permissions for resource access
  requiredAction?: 'view' | 'create' | 'edit' | 'delete'; // Action to check (default: 'view')
  fallbackPath?: string;
}

const RoleRoute = ({ children, allowedRoles, requiredResource, requiredAction = 'view', fallbackPath }: RoleRouteProps) => {
  const { effectiveRole, isOwner, loading, companyLoading, user, company } = useAuth();
  const { companyId } = useParams<{ companyId: string }>();
  const { canAccess, canCreate, canEdit, canDelete, canAccessFinance, canAccessHR, canAccessSettings, templateLoading, template } = useRolePermissions(company?.id);
  // Note: canAccessFinance, canAccessHR, canAccessSettings are computed from canView for backward compatibility
  const hasShownError = useRef(false);
  const hasLoadedOnceRef = useRef(false);

  // Reset error flag when resource changes - DOIT être avant tous les returns conditionnels
  useEffect(() => {
    hasShownError.current = false;
  }, [requiredResource]);

  // Track if we've loaded permissions at least once
  useEffect(() => {
    if (!templateLoading && template) {
      hasLoadedOnceRef.current = true;
    }
  }, [templateLoading, template]);

  // Memoize isActualOwner to prevent unnecessary recalculations
  const isActualOwner = useMemo(() => {
    return isOwner || effectiveRole === 'owner';
  }, [isOwner, effectiveRole]);

  // For initial loading (auth or company), show loading screen
  if (loading || companyLoading) {
    return <SkeletonAppLoading />;
  }

  // For employees: Show loading overlay instead of unmounting children
  // This prevents LivePreview from being unmounted during template loading
  // After first load, always keep children mounted to prevent iframe reloads
  if (!isActualOwner && (templateLoading || !template)) {
    // If we've loaded once before, keep children mounted and show overlay
    if (hasLoadedOnceRef.current) {
      return (
        <div style={{ position: 'relative', minHeight: '100vh' }}>
          <div style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            zIndex: 1000,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <SkeletonAppLoading />
          </div>
          {children}
        </div>
      );
    }
    // First time loading, show full loading screen (only on initial mount)
    return <SkeletonAppLoading />;
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
    // Check permission based on required action
    let hasAccess = false;
    switch (requiredAction) {
      case 'view':
        hasAccess = canAccess(requiredResource);
        break;
      case 'create':
        hasAccess = canCreate(requiredResource);
        break;
      case 'edit':
        hasAccess = canEdit(requiredResource);
        break;
      case 'delete':
        // Delete is owner-only, but we check canDelete for consistency
        hasAccess = canDelete(requiredResource);
        break;
    }
    
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
