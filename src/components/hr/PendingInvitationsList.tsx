import { useState, useEffect } from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import { cancelInvitation, sendInvitationEmailToUser, getInvitationLink } from '../../services/invitationService';
import { getTemplateById } from '../../services/permissionTemplateService';
import { formatDistanceToNow } from 'date-fns';
import { Mail, Clock, User, Trash2, RefreshCw, Copy } from 'lucide-react';
import type { Invitation } from '../../types/models';
import type { PermissionTemplate } from '../../types/permissions';
import { showSuccessToast, showErrorToast } from '../../utils/toast';

interface PendingInvitationsListProps {
  invitations: Invitation[];
  onInvitationCancelled: () => void;
}

const PendingInvitationsList = ({ invitations, onInvitationCancelled }: PendingInvitationsListProps) => {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Record<string, PermissionTemplate>>({});

  useEffect(() => {
    // Load templates for all invitations
    const loadTemplates = async () => {
      const templateMap: Record<string, PermissionTemplate> = {};
      for (const invitation of invitations) {
        if (invitation.permissionTemplateId && invitation.companyId) {
          try {
            const template = await getTemplateById(invitation.companyId, invitation.permissionTemplateId);
            if (template) {
              templateMap[invitation.permissionTemplateId] = template;
            }
          } catch (error) {
            console.error(`Error loading template ${invitation.permissionTemplateId}:`, error);
          }
        }
      }
      setTemplates(templateMap);
    };

    if (invitations.length > 0) {
      loadTemplates();
    }
  }, [invitations]);

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

  const handleCopyLink = async (invitationId: string) => {
    try {
      const link = getInvitationLink(invitationId);
      await navigator.clipboard.writeText(link);
      setCopiedId(invitationId);
      showSuccessToast('Invitation link copied to clipboard');
      
      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopiedId(null);
      }, 2000);
    } catch (error) {
      console.error('Error copying link:', error);
      showErrorToast('Failed to copy link');
    }
  };

  const getTemplateDisplayName = (invitation: Invitation) => {
    if (invitation.permissionTemplateId && templates[invitation.permissionTemplateId]) {
      return templates[invitation.permissionTemplateId].name;
    }
    return 'Loading...';
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
                        <span className="font-medium">Template:</span>
                        <span className="ml-1">{getTemplateDisplayName(invitation)}</span>
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
                    
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Invitation Link:
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={getInvitationLink(invitation.id)}
                          className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm font-mono text-gray-800 focus:outline-none focus:ring-0"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyLink(invitation.id)}
                          className="shrink-0"
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          {copiedId === invitation.id ? 'Copié !' : 'Copier'}
                        </Button>
                      </div>
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
