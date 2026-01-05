import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/**
 * InviteActivate - Legacy redirect page
 * 
 * This page is kept for backward compatibility with old invitation links.
 * New invitations redirect directly to the login page with invite parameter.
 * 
 * This page simply redirects to the login page with the invite parameter.
 */
export default function InviteActivate() {
  const { inviteId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (inviteId) {
      // Redirect to login page with invite parameter
      navigate(`/auth/login?invite=${inviteId}`, { replace: true });
    } else {
      // Invalid invite ID, redirect to login
      navigate('/auth/login', { replace: true });
    }
  }, [inviteId, navigate]);

  // Show nothing while redirecting
  return null;

  const loadInvitation = useCallback(async () => {
    try {
      setLoading(true);
      const invite = await getInvitation(inviteId!);
      
      if (!invite) {
        setError('Invitation not found or has expired');
        return;
      }
      
      // Check if invitation is expired
      const now = new Date();
      let expiresAt: Date;
      if (invite.expiresAt instanceof Timestamp) {
        expiresAt = invite.expiresAt.toDate();
      } else if (invite.expiresAt && typeof invite.expiresAt === 'object' && 'toDate' in invite.expiresAt) {
        expiresAt = (invite.expiresAt as Timestamp).toDate();
      } else if (invite.expiresAt && typeof invite.expiresAt === 'object' && 'seconds' in invite.expiresAt) {
        expiresAt = new Date((invite.expiresAt as Timestamp).seconds * 1000);
      } else {
        expiresAt = new Date((invite.expiresAt as unknown as number));
      }
      if (now > expiresAt) {
        setError('This invitation has expired');
        return;
      }
      
      // Check if invitation is already processed
      if (invite.status !== 'pending') {
        setError(`This invitation has already been ${invite.status}`);
        return;
      }
      
      setInvitation(invite);
      
      // Load permission template
      if (invite.permissionTemplateId) {
        try {
          const tmpl = await getTemplateById(invite.companyId, invite.permissionTemplateId);
          setTemplate(tmpl);
        } catch (error) {
          console.error('Error loading template:', error);
          // Template is optional for display, so don't fail the whole invitation
        }
      }
    } catch (error) {
      console.error('Error loading invitation:', error);
      setError(error instanceof Error ? error.message : 'Failed to load invitation');
    } finally {
      setLoading(false);
    }
  }, [inviteId]);

  useEffect(() => {
    if (!inviteId) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }
    
    loadInvitation();
  }, [inviteId, loadInvitation]);

  const handleAcceptInvitation = async () => {
    if (!user) {
      // Redirect to login with invitation context
      navigate(`/auth/login?invite=${inviteId}`);
      return;
    }
    
    if (!invitation) return;
    
    setProcessing(true);
    try {
      await acceptInvitation(invitation.id, user.uid);
      
      // Redirect to company dashboard
      navigate(`/company/${invitation.companyId}/dashboard`);
    } catch (error) {
      console.error('Error accepting invitation:', error);
      showErrorToast(error instanceof Error ? error.message : 'Failed to accept invitation');
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectInvitation = async () => {
    if (!invitation) return;
    
    if (!confirm('Are you sure you want to reject this invitation?')) return;
    
    setProcessing(true);
    try {
      await rejectInvitation(invitation.id);
      navigate('/auth/login');
    } catch (error) {
      console.error('Error rejecting invitation:', error);
      showErrorToast('Failed to reject invitation');
    } finally {
      setProcessing(false);
    }
  };

  const getTemplateDisplayName = () => {
    if (template) {
      return template.name;
    }
    return 'Loading...';
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto py-12">
        <Card>
          <div className="text-center">
            <XCircle className="mx-auto h-12 w-12 text-red-400" />
            <h1 className="text-xl font-semibold text-gray-900 mt-4">Invalid Invitation</h1>
            <p className="text-gray-600 mt-2">{error}</p>
            <Button
              className="mt-4"
              onClick={() => navigate('/auth/login')}
            >
              Go to Login
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="max-w-md mx-auto py-12">
        <Card>
          <div className="text-center">
            <XCircle className="mx-auto h-12 w-12 text-red-400" />
            <h1 className="text-xl font-semibold text-gray-900 mt-4">Invitation Not Found</h1>
            <p className="text-gray-600 mt-2">This invitation link is invalid or has expired.</p>
            <Button
              className="mt-4"
              onClick={() => navigate('/auth/login')}
            >
              Go to Login
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-12">
      <Card>
        <div className="text-center mb-6">
          <Building2 className="mx-auto h-12 w-12 text-emerald-500" />
          <h1 className="text-xl font-semibold text-gray-900 mt-4">You're Invited!</h1>
          <p className="text-gray-600 mt-2">
            {invitation.invitedByName} has invited you to join their team.
          </p>
        </div>

        {/* Invitation Details */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="space-y-3">
            <div className="flex items-center">
              <Building2 className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">{invitation.companyName}</p>
                <p className="text-xs text-gray-500">Company</p>
              </div>
            </div>
            
            <div className="flex items-center">
              <User className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">{getTemplateDisplayName()}</p>
                <p className="text-xs text-gray-500">Your access will be determined by this template's permissions</p>
              </div>
            </div>
            
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Expires {formatDistanceToNow(
                    invitation.expiresAt instanceof Timestamp 
                      ? invitation.expiresAt.toDate() 
                      : (invitation.expiresAt && typeof invitation.expiresAt === 'object' && 'seconds' in invitation.expiresAt)
                      ? new Date((invitation.expiresAt as Timestamp).seconds * 1000)
                      : new Date((invitation.expiresAt as unknown as number)), 
                    { addSuffix: true }
                  )}
                </p>
                <p className="text-xs text-gray-500">Invitation Valid Until</p>
              </div>
            </div>
          </div>
        </div>

        {/* User Status */}
        {!user ? (
          <div className="mb-6">
            <p className="text-sm text-gray-600 text-center mb-4">
              You need to log in to accept this invitation.
            </p>
            <div className="space-y-3">
              <Button
                className="w-full"
                onClick={() => navigate(`/auth/login?invite=${inviteId}`)}
              >
                Log In to Accept
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/auth/register')}
              >
                Create Account
              </Button>
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <p className="text-sm text-gray-600 text-center mb-4">
              Welcome back, {user.displayName || user.email}! Ready to join the team?
            </p>
            <div className="space-y-3">
              <Button
                className="w-full"
                onClick={handleAcceptInvitation}
                isLoading={processing}
                disabled={processing}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Accept Invitation
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleRejectInvitation}
                isLoading={processing}
                disabled={processing}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Decline Invitation
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            By accepting this invitation, you agree to join {invitation.companyName}. Your access to different sections will be controlled by the permissions defined in the {template?.name || 'assigned'} template, not by a fixed role.
          </p>
        </div>
      </Card>
    </div>
  );
}




