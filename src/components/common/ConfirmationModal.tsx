import { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal, { ModalFooter } from './Modal';
import Button from './Button';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger'
}: ConfirmationModalProps) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const getIconColor = () => {
    switch (type) {
      case 'danger': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      case 'info': return 'text-blue-600';
      default: return 'text-red-600';
    }
  };

  const getIconBgColor = () => {
    switch (type) {
      case 'danger': return 'bg-red-100';
      case 'warning': return 'bg-yellow-100';
      case 'info': return 'bg-blue-100';
      default: return 'bg-red-100';
    }
  };

  const getButtonType = (): 'danger' | 'primary' | 'warning' => {
    switch (type) {
      case 'danger': return 'danger';
      case 'warning': return 'warning';
      case 'info': return 'primary';
      default: return 'danger';
    }
  };

  const modalContent: ReactNode = (
    <div className="flex items-start space-x-4 py-2">
      <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${getIconBgColor()}`}>
        <AlertTriangle className={`w-6 h-6 ${getIconColor()}`} />
      </div>
      <div className="flex-1 pt-1">
        <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
      </div>
    </div>
  );

  const modalFooter = (
    <ModalFooter
      onCancel={onClose}
      onConfirm={handleConfirm}
      confirmText={confirmText}
      cancelText={cancelText}
      isDanger={type === 'danger'}
    />
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
    >
      <div className="pb-6">
        {modalContent}
      </div>
      {modalFooter}
    </Modal>
  );
};

export default ConfirmationModal;
