import { useState } from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import { cancelInvitation, sendInvitationEmailToUser } from '../../services/invitationService';
import { formatDistanceToNow } from 'date-fns';
import { Mail, Clock, User, Trash2, RefreshCw } from 'lucide-react';
import type { Invitation } from '../../types/models';

interface PendingInvitationsListProps {
  invitations: Invitation[];
  onInvitationCancelled: () => void;
}

const PendingInvitationsList = ({ invitations, onInvitationCancelled }: PendingInvitationsListProps) => {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return;
    
    setCancellingId(invitationId);
    try {
      await cancelInvitation(invitationId);
      onInvitationCancelled();
    } catch (error) {
      console.error('Error cancelling invitation:', error);
    } finally {
      setCancellingId(null);
    }
  };

  const handleResendInvitation = async (invitation: Invitation) => {
    setResendingId(invitation.id);
    try {
      await sendInvitationEmailToUser(invitation);
    } catch (error) {
      console.error('Error resending invitation:', error);
    } finally {
      setResendingId(null);
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'staff': return 'Staff (Vendeur)';
      case 'manager': return 'Manager (Gestionnaire)';
      case 'admin': return 'Admin (Magasinier)';
      default: return role;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'accepted': return 'text-green-600 bg-green-100';
      case 'rejected': return 'text-red-600 bg-red-100';
      case 'expired': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const isExpired = (expiresAt: any) => {
    return new Date() > (expiresAt as any).toDate();
  };

  if (invitations.length === 0) {
    return (
      <Card>
        <div className="text-center py-8">
          <Mail className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No pending invitations</h3>
          <p className="mt-1 text-sm text-gray-500">
            All invitations have been processed or there are no invitations yet.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Pending Invitations</h3>
        
        <div className="space-y-4">
          {invitations.map((invitation) => {
            const expired = isExpired(invitation.expiresAt);
            const status = expired ? 'expired' : invitation.status;
            
            return (
              <div
                key={invitation.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <User className="h-5 w-5 text-gray-400" />
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">
                          {invitation.firstname} {invitation.lastname}
                        </h4>
                        <p className="text-sm text-gray-500">{invitation.email}</p>
                      </div>
                    </div>
                    
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                      <span className="flex items-center">
                        <span className="font-medium">Role:</span>
                        <span className="ml-1">{getRoleDisplayName(invitation.role)}</span>
                      </span>
                      <span className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        <span>
                          {expired ? 'Expired' : `Expires ${formatDistanceToNow(invitation.expiresAt.toDate(), { addSuffix: true })}`}
                        </span>
                      </span>
                    </div>
                    
                    <div className="mt-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {status === 'pending' && !expired && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResendInvitation(invitation)}
                        isLoading={resendingId === invitation.id}
                        disabled={resendingId === invitation.id}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Resend
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancelInvitation(invitation.id)}
                      isLoading={cancellingId === invitation.id}
                      disabled={cancellingId === invitation.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};

export default PendingInvitationsList;
