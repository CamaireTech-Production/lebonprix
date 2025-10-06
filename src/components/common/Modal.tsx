import { Fragment, ReactNode } from 'react';
import { X } from 'lucide-react';
import Button from './Button';
import { useTranslation } from 'react-i18next';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeButtonClassName?: string;
}

const Modal = ({ isOpen, onClose, title, children, footer, size = 'md', closeButtonClassName }: ModalProps) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md mx-4',
    md: 'max-w-lg mx-4',
    lg: 'max-w-2xl mx-4',
    xl: 'max-w-4xl mx-4'
  };

  return (
    <Fragment>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-[60] overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-2 sm:p-4">
          <div 
            className={`relative bg-white rounded-lg shadow-xl w-full ${sizeClasses[size]} transform transition-all max-h-[90vh] overflow-visible`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <button
                onClick={onClose}
                className={closeButtonClassName || "text-gray-400 hover:text-gray-500 focus:outline-none"}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-120px)]">{children}</div>
            
            {/* Footer */}
            {footer && (
              <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-2">
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </Fragment>
  );
};

export const ModalFooter = ({ 
  onCancel, 
  onConfirm, 
  confirmText = 'Save', 
  cancelText = 'Cancel',
  isLoading = false, 
  isDanger = false,
  disabled = false
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  isDanger?: boolean;
  disabled?: boolean;
}) => {
  useTranslation();
  
  return (
    <>
      <Button variant="outline" onClick={onCancel}>
        {cancelText}
      </Button>
      <Button 
        variant={isDanger ? 'danger' : 'primary'} 
        onClick={onConfirm} 
        isLoading={isLoading}
        disabled={disabled}
      >
        {confirmText}
      </Button>
    </>
  );
};

export default Modal;