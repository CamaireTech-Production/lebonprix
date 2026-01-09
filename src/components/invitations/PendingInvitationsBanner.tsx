import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '@components/common';
import { 
  getPendingInvitationsByEmail, 
  acceptInvitation, 
  rejectInvitation 
} from '@services/firestore/employees/invitationService';
import { Building2, Mail, X, Check, Clock } from 'lucide-react';
import type { Invitation } from '../../types/models';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import { useAuth } from '@contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

interface PendingInvitationsBannerProps {
  userEmail: string;
  compact?: boolean; // For smaller display in selection mode
}

const PendingInvitationsBanner = ({ userEmail, compact = false }: PendingInvitationsBannerProps) => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const loadInvitations = async () => {
      if (!userEmail) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const pendingInvitations = await getPendingInvitationsByEmail(userEmail);
        setInvitations(pendingInvitations);
      } catch (error) {
        console.error('Error loading pending invitations:', error);
        showErrorToast('Failed to load pending invitations');
      } finally {
        setLoading(false);
      }
    };

    loadInvitations();
  }, [userEmail]);

  const handleAccept = async (invitation: Invitation) => {
    if (!user?.uid) {
      // User not logged in, redirect to login with invitation
      navigate(`/auth/login?invite=${invitation.id}`);
      return;
    }

    setProcessingId(invitation.id);
    try {
      await acceptInvitation(invitation.id, user.uid);
      // Remove from list
      setInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
      // Redirect to company dashboard
      navigate(`/company/${invitation.companyId}/dashboard`);
    } catch (error) {
      console.error('Error accepting invitation:', error);
      showErrorToast(error instanceof Error ? error.message : 'Failed to accept invitation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (invitation: Invitation) => {
    if (!confirm(`Are you sure you want to reject the invitation from ${invitation.companyName}?`)) {
      return;
    }

    setProcessingId(invitation.id);
    try {
      await rejectInvitation(invitation.id);
      // Remove from list
      setInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
      showSuccessToast('Invitation rejected');
    } catch (error) {
      console.error('Error rejecting invitation:', error);
      showErrorToast(error instanceof Error ? error.message : 'Failed to reject invitation');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return null; // Don't show loading state, just wait
  }

  if (invitations.length === 0) {
    return null; // No invitations to show
  }

  if (compact) {
    // Compact version for selection mode
    return (
      <div className="mb-6">
        <Card className="bg-blue-50 border-blue-200">
          <div className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Mail className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-semibold text-blue-900">
                  {invitations.length} Pending Invitation{invitations.length > 1 ? 's' : ''}
                </h3>
              </div>
            </div>
            <div className="space-y-2">
              {invitations.slice(0, 2).map((invitation) => (
                <div
                  key={invitation.id}
                  className="bg-white rounded-lg p-3 border border-blue-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <Building2 className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-900">
                          {invitation.companyName}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Invited by {invitation.invitedByName}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {formatDistanceToNow(
                          new Date((invitation.createdAt as any).seconds * 1000),
                          { addSuffix: true }
                        )}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 ml-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(invitation)}
                        disabled={processingId === invitation.id}
                        className="text-xs px-2 py-1 flex items-center"
                        title="Reject"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAccept(invitation)}
                        isLoading={processingId === invitation.id}
                        disabled={processingId === invitation.id}
                        className="text-xs px-2 py-1 flex items-center"
                        title="Accept"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {invitations.length > 2 && (
                <p className="text-xs text-blue-700 text-center pt-1">
                  +{invitations.length - 2} more invitation{invitations.length - 2 > 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Full version for dashboard pages
  return (
    <div className="mb-6">
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Pending Invitations
                </h3>
                <p className="text-sm text-gray-600">
                  You have {invitations.length} pending invitation{invitations.length > 1 ? 's' : ''} to join companies
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="bg-white rounded-lg p-4 border border-blue-200 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Building2 className="h-5 w-5 text-blue-600" />
                      <h4 className="text-base font-semibold text-gray-900">
                        {invitation.companyName}
                      </h4>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>
                        <span className="font-medium">Invited by:</span> {invitation.invitedByName}
                      </p>
                      <p className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>
                          {formatDistanceToNow(
                            new Date((invitation.createdAt as any).seconds * 1000),
                            { addSuffix: true }
                          )}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      variant="outline"
                      onClick={() => handleReject(invitation)}
                      disabled={processingId === invitation.id}
                      className="border-red-300 text-red-700 hover:bg-red-50"
                    >
                      <span className="flex items-center">
                        <X className="h-4 w-4 mr-1.5" />
                        <span>Reject</span>
                      </span>
                    </Button>
                    <Button
                      onClick={() => handleAccept(invitation)}
                      isLoading={processingId === invitation.id}
                      disabled={processingId === invitation.id}
                    >
                      <span className="flex items-center">
                        <Check className="h-4 w-4 mr-1.5" />
                        <span>Accept</span>
                      </span>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default PendingInvitationsBanner;

