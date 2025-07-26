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
  },
};

export const showSuccessToast = (message: string): string => {
  return toast.success(message, {
    ...defaultOptions,
    icon: '✅',
    style: {
      ...defaultOptions.style,
      borderLeft: '4px solid #10B981', // emerald-500
    },
  });
};

export const showErrorToast = (message: string): string => {
  return toast.error(message, {
    ...defaultOptions,
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