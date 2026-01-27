// useInvitations hook for Restoflow
import { useState, useEffect, useCallback } from 'react';
import type { Invitation } from '../../types/geskap';
import {
  subscribeToInvitations,
  subscribeToPendingInvitations,
  createInvitation,
  acceptInvitation,
  rejectInvitation,
  cancelInvitation
} from '../../services/firestore/employees/invitationService';

interface UseInvitationsOptions {
  restaurantId: string;
  restaurantName: string;
  invitedBy: string;
  invitedByName: string;
}

interface UseInvitationsReturn {
  invitations: Invitation[];
  pendingInvitations: Invitation[];
  loading: boolean;
  error: string | null;
  inviteEmployee: (
    email: string,
    permissionTemplateId: string,
    additionalInfo?: {
      firstname?: string;
      lastname?: string;
      phone?: string;
    }
  ) => Promise<Invitation>;
  acceptInvite: (invitationId: string) => Promise<void>;
  rejectInvite: (invitationId: string) => Promise<void>;
  cancelInvite: (invitationId: string) => Promise<void>;
}

export const useInvitations = ({
  restaurantId,
  restaurantName,
  invitedBy,
  invitedByName
}: UseInvitationsOptions): UseInvitationsReturn => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setInvitations([]);
      setPendingInvitations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribeAll = subscribeToInvitations(restaurantId, (data) => {
      setInvitations(data);
      setLoading(false);
    });

    const unsubscribePending = subscribeToPendingInvitations(restaurantId, (data) => {
      setPendingInvitations(data);
    });

    return () => {
      unsubscribeAll();
      unsubscribePending();
    };
  }, [restaurantId]);

  const handleInviteEmployee = useCallback(
    async (
      email: string,
      permissionTemplateId: string,
      additionalInfo?: {
        firstname?: string;
        lastname?: string;
        phone?: string;
      }
    ) => {
      try {
        return await createInvitation(
          restaurantId,
          restaurantName,
          invitedBy,
          invitedByName,
          email,
          permissionTemplateId,
          additionalInfo
        );
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId, restaurantName, invitedBy, invitedByName]
  );

  const handleAcceptInvite = useCallback(
    async (invitationId: string) => {
      try {
        await acceptInvitation(restaurantId, invitationId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleRejectInvite = useCallback(
    async (invitationId: string) => {
      try {
        await rejectInvitation(restaurantId, invitationId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleCancelInvite = useCallback(
    async (invitationId: string) => {
      try {
        await cancelInvitation(restaurantId, invitationId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  return {
    invitations,
    pendingInvitations,
    loading,
    error,
    inviteEmployee: handleInviteEmployee,
    acceptInvite: handleAcceptInvite,
    rejectInvite: handleRejectInvite,
    cancelInvite: handleCancelInvite
  };
};
