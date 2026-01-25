import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@contexts/AuthContext';
import {
  hasApprovedRequest,
  createActionRequest,
  getUserActionRequests,
} from '@services/firestore/hr/actionRequestService';
import type { ActionRequest } from '../../types/models';

interface UseActionRequestOptions {
  action: string;
  resource: string;
  resourceId?: string;
  resourceName?: string;
}

interface UseActionRequestResult {
  hasApproval: boolean;
  pendingRequest: ActionRequest | null;
  loading: boolean;
  requestAccess: (reason: string) => Promise<boolean>;
  checkApproval: () => Promise<boolean>;
}

/**
 * Hook for employees to check if they have access to a restricted action
 * and to request access if needed.
 *
 * Usage:
 * const { hasApproval, pendingRequest, requestAccess } = useActionRequest({
 *   action: 'delete',
 *   resource: 'products',
 *   resourceId: productId,
 *   resourceName: product.name,
 * });
 *
 * if (!hasApproval) {
 *   // Show request access button
 * }
 */
export function useActionRequest({
  action,
  resource,
  resourceId,
  resourceName,
}: UseActionRequestOptions): UseActionRequestResult {
  const { user, company, isOwner, effectiveRole } = useAuth();
  const [hasApproval, setHasApproval] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<ActionRequest | null>(null);
  const [loading, setLoading] = useState(true);

  // Owner always has approval
  const isActualOwner = isOwner || effectiveRole === 'owner';

  const checkApproval = useCallback(async () => {
    if (!company?.id || !user?.uid) {
      setLoading(false);
      return false;
    }

    // Owners always have approval
    if (isActualOwner) {
      setHasApproval(true);
      setLoading(false);
      return true;
    }

    try {
      // Check if there's an approved request
      const approved = await hasApprovedRequest(
        company.id,
        user.uid,
        action,
        resource,
        resourceId
      );

      if (approved) {
        setHasApproval(true);
        setPendingRequest(null);
        setLoading(false);
        return true;
      }

      // Check for pending request
      const userRequests = await getUserActionRequests(company.id, user.uid);
      const pending = userRequests.find(
        (r) =>
          r.status === 'pending' &&
          r.requestedAction === action &&
          r.resource === resource &&
          (resourceId ? r.resourceId === resourceId : true)
      );

      setPendingRequest(pending || null);
      setHasApproval(false);
      setLoading(false);
      return false;
    } catch (error) {
      console.error('Error checking action request approval:', error);
      setLoading(false);
      return false;
    }
  }, [company?.id, user?.uid, action, resource, resourceId, isActualOwner]);

  useEffect(() => {
    checkApproval();
  }, [checkApproval]);

  const requestAccess = useCallback(
    async (reason: string): Promise<boolean> => {
      if (!company?.id || !user?.uid) {
        return false;
      }

      try {
        const request = await createActionRequest(company.id, {
          requesterId: user.uid,
          requesterName: user.displayName || user.email || 'Employee',
          requesterEmail: user.email || '',
          requestedAction: action,
          resource,
          resourceId,
          resourceName,
          reason,
        });

        setPendingRequest(request);
        return true;
      } catch (error) {
        console.error('Error creating action request:', error);
        return false;
      }
    },
    [company?.id, user?.uid, user?.displayName, user?.email, action, resource, resourceId, resourceName]
  );

  return {
    hasApproval: isActualOwner || hasApproval,
    pendingRequest,
    loading,
    requestAccess,
    checkApproval,
  };
}

/**
 * Simplified hook to check if user can perform a specific action
 * without the full request functionality.
 */
export function useCanPerformAction(action: string, resource: string, resourceId?: string) {
  const { hasApproval, loading } = useActionRequest({ action, resource, resourceId });
  return { canPerform: hasApproval, loading };
}

export default useActionRequest;
