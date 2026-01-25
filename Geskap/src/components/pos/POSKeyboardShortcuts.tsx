import { useEffect } from 'react';

interface POSKeyboardShortcutsProps {
  onFocusSearch: () => void;
  onCompleteSale: () => void;
  onCloseModal?: () => void;
  disabled?: boolean;
}

export const POSKeyboardShortcuts: React.FC<POSKeyboardShortcutsProps> = ({
  onFocusSearch,
  onCompleteSale,
  onCloseModal,
  disabled = false,
}) => {
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Ctrl+Enter and Escape even in inputs
        if (e.key === 'Escape' && onCloseModal) {
          onCloseModal();
        }
        if (e.ctrlKey && e.key === 'Enter') {
          e.preventDefault();
          onCompleteSale();
        }
        return;
      }

      // Focus search: / or Ctrl+K
      if (e.key === '/' || (e.ctrlKey && e.key === 'k')) {
        e.preventDefault();
        onFocusSearch();
      }

      // Complete sale: Ctrl+Enter
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        onCompleteSale();
      }

      // Close modal: Escape
      if (e.key === 'Escape' && onCloseModal) {
        onCloseModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onFocusSearch, onCompleteSale, onCloseModal, disabled]);

  return null;
};

