import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@contexts/AuthContext';
import { Card, Button } from '@components/common';
import { Check, X, Clock, User, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import {
  subscribeToActionRequests,
  approveActionRequest,
  rejectActionRequest,
} from '@services/firestore/hr/actionRequestService';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import type { ActionRequest, ActionRequestStatus } from '../../types/models';

interface ActionRequestsListProps {
  companyId: string;
  onRequestProcessed?: () => void;
}

/**
 * Component for owners/admins to review and process action requests
 */
const ActionRequestsList = ({ companyId, onRequestProcessed }: ActionRequestsListProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [requests, setRequests] = useState<ActionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'processed'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;

    setLoading(true);
    const unsubscribe = subscribeToActionRequests(companyId, (actionRequests) => {
      setRequests(actionRequests);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId]);

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const processedRequests = requests.filter((r) => r.status !== 'pending');

  const handleApprove = async (request: ActionRequest, grantType: 'one_time' | 'permanent') => {
    if (!user?.uid) return;

    setProcessingId(request.id);
    try {
      await approveActionRequest(
        request.id,
        user.uid,
        user.displayName || user.email || 'Owner',
        grantType,
        undefined,
        grantType === 'one_time' ? 24 : undefined // 24 hours for one-time
      );
      showSuccessToast(t('actionRequests.messages.requestApproved', 'Request approved'));
      onRequestProcessed?.();
    } catch (error) {
      console.error('Error approving request:', error);
      showErrorToast(t('actionRequests.messages.approveError', 'Error approving request'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!user?.uid) return;

    setProcessingId(requestId);
    try {
      await rejectActionRequest(
        requestId,
        user.uid,
        user.displayName || user.email || 'Owner',
        rejectNote || undefined
      );
      showSuccessToast(t('actionRequests.messages.requestRejected', 'Request rejected'));
      setShowRejectModal(null);
      setRejectNote('');
      onRequestProcessed?.();
    } catch (error) {
      console.error('Error rejecting request:', error);
      showErrorToast(t('actionRequests.messages.rejectError', 'Error rejecting request'));
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: ActionRequestStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            {t('actionRequests.status.pending', 'Pending')}
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            {t('actionRequests.status.approved', 'Approved')}
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            {t('actionRequests.status.rejected', 'Rejected')}
          </span>
        );
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const displayedRequests = activeTab === 'pending' ? pendingRequests : processedRequests;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Tabs */}
      <div className="mb-4">
        <nav className="flex space-x-4">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-2 text-sm font-medium rounded-md ${
              activeTab === 'pending'
                ? 'bg-emerald-100 text-emerald-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('actionRequests.pendingRequests', 'Pending Requests')} ({pendingRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('processed')}
            className={`px-3 py-2 text-sm font-medium rounded-md ${
              activeTab === 'processed'
                ? 'bg-emerald-100 text-emerald-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('actionRequests.processedRequests', 'Processed')} ({processedRequests.length})
          </button>
        </nav>
      </div>

      {/* Requests List */}
      {displayedRequests.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {activeTab === 'pending'
                ? t('actionRequests.noRequests', 'No pending action requests')
                : t('actionRequests.noProcessedRequests', 'No processed requests')}
            </h3>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {displayedRequests.map((request) => (
            <Card key={request.id}>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <User className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{request.requesterName}</h4>
                      <p className="text-sm text-gray-500">{request.requesterEmail}</p>
                    </div>
                  </div>
                  {getStatusBadge(request.status)}
                </div>

                <div className="mt-4 bg-gray-50 p-3 rounded-lg">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">{t('common.actions', 'Action')}:</span>{' '}
                      <span className="font-medium">{request.requestedAction}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">{t('common.type', 'Resource')}:</span>{' '}
                      <span className="font-medium">{request.resource}</span>
                    </div>
                    {request.resourceName && (
                      <div className="col-span-2">
                        <span className="text-gray-500">{t('common.name', 'Item')}:</span>{' '}
                        <span className="font-medium">{request.resourceName}</span>
                      </div>
                    )}
                  </div>
                  {request.reason && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <span className="text-gray-500 text-sm">{t('actionRequests.reason', 'Reason')}:</span>
                      <p className="text-sm text-gray-700 mt-1">{request.reason}</p>
                    </div>
                  )}
                </div>

                <div className="mt-3 text-xs text-gray-500">
                  {t('common.date', 'Date')}: {formatDate(request.createdAt)}
                </div>

                {/* Action buttons for pending requests */}
                {request.status === 'pending' && (
                  <div className="mt-4 flex items-center space-x-2">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(request, 'one_time')}
                      disabled={processingId === request.id}
                      icon={<Check className="h-4 w-4" />}
                    >
                      {t('actionRequests.grantType.one_time', 'One-time')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApprove(request, 'permanent')}
                      disabled={processingId === request.id}
                      icon={<Check className="h-4 w-4" />}
                    >
                      {t('actionRequests.grantType.permanent', 'Permanent')}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setShowRejectModal(request.id)}
                      disabled={processingId === request.id}
                      icon={<X className="h-4 w-4" />}
                    >
                      {t('actionRequests.reject', 'Reject')}
                    </Button>
                  </div>
                )}

                {/* Show review info for processed requests */}
                {request.status !== 'pending' && request.reviewedByName && (
                  <div className="mt-3 pt-3 border-t border-gray-200 text-sm">
                    <p className="text-gray-600">
                      {request.status === 'approved' ? 'Approved' : 'Rejected'} by{' '}
                      <span className="font-medium">{request.reviewedByName}</span>
                      {request.reviewedAt && ` on ${formatDate(request.reviewedAt)}`}
                    </p>
                    {request.grantType && (
                      <p className="text-gray-500 mt-1">
                        Grant type: {request.grantType === 'permanent' ? 'Permanent' : 'One-time (24h)'}
                      </p>
                    )}
                    {request.reviewNote && (
                      <p className="text-gray-500 mt-1">Note: {request.reviewNote}</p>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black opacity-30" onClick={() => setShowRejectModal(null)}></div>
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {t('actionRequests.rejectRequest', 'Reject Request')}
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('actionRequests.reviewNote', 'Note (optional)')}
                </label>
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder={t('actionRequests.rejectNotePlaceholder', 'Explain why the request is rejected...')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={3}
                />
              </div>
              <div className="mt-4 flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowRejectModal(null)}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleReject(showRejectModal)}
                  disabled={processingId === showRejectModal}
                >
                  {t('actionRequests.reject', 'Reject')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionRequestsList;
