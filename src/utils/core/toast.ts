import toast, { ToastOptions } from 'react-hot-toast';

const defaultOptions: ToastOptions = {
  duration: 4000,
  position: 'top-right',
  style: {
    background: '#fff',
    color: '#333',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    borderRadius: '0.375rem',
    padding: '1rem',
    zIndex: 10000, // Higher than modals (z-[9999]) to ensure toast appears above everything
  },
};

export const showSuccessToast = (message: string): string => {
  return toast.success(message, {
    ...defaultOptions,
    icon: '✅',
    style: {
      ...defaultOptions.style,
      borderLeft: '4px solid #10B981', // emerald-500
      zIndex: 10000, // Higher than modals to ensure toast appears above everything
    },
  });
};

export const showErrorToast = (message: string): string => {
  return toast.error(message, {
    ...defaultOptions,
    duration: 10000, // 10 seconds for error toasts
    icon: '❌',
    style: {
      ...defaultOptions.style,
      borderLeft: '4px solid #EF4444', // red-500
    },
  });
};

export const showWarningToast = (message: string): string => {
  return toast(message, {
    ...defaultOptions,
    icon: '⚠️',
    style: {
      ...defaultOptions.style,
      borderLeft: '4px solid #F59E0B', // amber-500
    },
  });
};

export const showInfoToast = (message: string): string => {
  return toast(message, {
    ...defaultOptions,
    icon: 'ℹ️',
    style: {
      ...defaultOptions.style,
      borderLeft: '4px solid #3B82F6', // blue-500
    },
  });
}; 