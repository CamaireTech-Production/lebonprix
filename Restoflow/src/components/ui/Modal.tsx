import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import ReactDOM from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  theme?: 'light' | 'dark';
}

export default function Modal({ isOpen, title, onClose, children, className, theme = 'light' }: ModalProps) {
  // close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center bg-black bg-opacity-50 pt-4 pb-4 sm:items-center sm:pt-0 sm:pb-0"
      onClick={onClose}
    >
      <div
        className={`${theme === 'dark' ? 'bg-[#0f0f0f] text-[#f3f3f3]' : 'bg-white'} rounded-lg shadow-xl w-full mx-3 sm:mx-4 relative ${className || 'max-w-lg'} max-h-[90vh] flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="flex-shrink-0 p-4 sm:p-6 border-b border-gray-200">
          <button
            onClick={onClose}
            className={`absolute top-3 right-3 z-10 ${theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
          {title && <h2 className={`text-xl font-semibold pr-8 ${theme === 'dark' ? 'text-white' : ''}`}>{title}</h2>}
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
