import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@contexts/AuthContext';
import Modal, { ModalFooter } from '@components/common/Modal';
import { AlertCircle, Send } from 'lucide-react';
import { createActionRequest, hasPendingRequest } from '@services/firestore/hr/actionRequestService';
import { showSuccessToast, showErrorToast, showWarningToast } from '@utils/core/toast';

interface RequestActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: string; // e.g., 'delete', 'edit', 'view'
  resource: string; // RESOURCES constant value
  resourceId?: string;
  resourceName?: string;
  onRequestSent?: () => void;
}

/**
 * Modal for employees to request access to a restricted action
 */
const RequestActionModal = ({
  isOpen,
  onClose,
  action,
  resource,
  resourceId,
  resourceName,
  onRequestSent,
}: RequestActionModalProps) => {
  const { t } = useTranslation();
  const { user, company } = useAuth();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getActionLabel = (action: string): string => {
    const labels: Record<string, string> = {
      delete: t('common.delete', 'Delete'),
      edit: t('common.edit', 'Edit'),
      view: t('common.view', 'View'),
      create: t('common.create', 'Create'),
    };
    return labels[action] || action;
  };

  const handleSubmit = async () => {
    if (!user?.uid || !company?.id) {
      showErrorToast(t('common.error', 'Error'));
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if there's already a pending request
      const alreadyPending = await hasPendingRequest(
        company.id,
        user.uid,
        action,
        resource,
        resourceId
      );

      if (alreadyPending) {
        showWarningToast(
          t('actionRequests.alreadyPending', 'You already have a pending request for this action')
        );
        onClose();
        return;
      }

      // Create the request
      await createActionRequest(company.id, {
        requesterId: user.uid,
        requesterName: user.displayName || user.email || 'Unknown',
        requesterEmail: user.email || undefined,
        requestedAction: action,
        resource,
        resourceId,
        resourceName,
        reason: reason.trim() || undefined,
      });

      showSuccessToast(t('actionRequests.messages.requestSent', 'Action request sent'));
      setReason('');
      onClose();
      onRequestSent?.();
    } catch (error) {
      console.error('Error sending action request:', error);
      showErrorToast(t('actionRequests.messages.sendError', 'Error sending request'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('actionRequests.restrictedAction', 'Restricted Action')}
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={handleSubmit}
          confirmText={
            isSubmitting
              ? t('common.sending', 'Sending...')
              : t('actionRequests.requestAction', 'Request Access')
          }
          cancelText={t('common.cancel', 'Cancel')}
          confirmIcon={<Send className="h-4 w-4 mr-2" />}
          isLoading={isSubmitting}
        />
      }
    >
      <div className="space-y-4">
        {/* Warning message */}
        <div className="flex items-start space-x-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-800">
              {t('actionRequests.noPermissionForAction', "You don't have permission to perform this action.")}
            </p>
            <p className="text-sm text-amber-700 mt-1">
              {t('actionRequests.requestAccessPrompt', 'Would you like to request access from the owner?')}
            </p>
          </div>
        </div>

        {/* Action details */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            {t('actionRequests.actionDetails', 'Action Details')}
          </h4>
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-gray-500">{t('common.actions', 'Action')}:</span>{' '}
              <span className="font-medium text-gray-900">{getActionLabel(action)}</span>
            </p>
            <p>
              <span className="text-gray-500">{t('common.type', 'Type')}:</span>{' '}
              <span className="font-medium text-gray-900">{resource}</span>
            </p>
            {resourceName && (
              <p>
                <span className="text-gray-500">{t('common.name', 'Name')}:</span>{' '}
                <span className="font-medium text-gray-900">{resourceName}</span>
              </p>
            )}
          </div>
        </div>

        {/* Reason input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('actionRequests.reason', 'Reason for request')} ({t('common.optional', 'optional')})
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('actionRequests.reasonPlaceholder', 'Explain why you need access to this action...')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            rows={3}
          />
        </div>
      </div>
    </Modal>
  );
};

export default RequestActionModal;
