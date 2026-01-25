import React, { useEffect, useState } from 'react';
import { t } from '../../utils/i18n';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface LoadingMessageProps {
  language: string;
  onReload?: () => void;
}

const LoadingMessage: React.FC<LoadingMessageProps> = ({ language, onReload }) => {
  const [showMessage, setShowMessage] = useState<number>(0); // 0: no message, 1: slow, 2: very slow, 3: timeout
  const [messageVisible, setMessageVisible] = useState(false);

  useEffect(() => {
    // Show first message after 15 seconds
    const slowTimer = setTimeout(() => {
      setShowMessage(1);
      setMessageVisible(true);
    }, 15000);

    // Show second message after 30 seconds
    const verySlowTimer = setTimeout(() => {
      setShowMessage(2);
      setMessageVisible(true);
    }, 30000);

    // Show final message after 45 seconds
    const timeoutTimer = setTimeout(() => {
      setShowMessage(3);
      setMessageVisible(true);
    }, 45000);

    // Auto-hide messages after 5 seconds (except the final one)
    let hideTimer: NodeJS.Timeout;
    if (showMessage < 3) {
      hideTimer = setTimeout(() => {
        setMessageVisible(false);
      }, 5000);
    }

    return () => {
      clearTimeout(slowTimer);
      clearTimeout(verySlowTimer);
      clearTimeout(timeoutTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [showMessage]);

  if (!messageVisible) return null;

  const getMessage = () => {
    switch (showMessage) {
      case 1:
        return t('slow_internet_message', language);
      case 2:
        return t('very_slow_internet_message', language);
      case 3:
        return (
          <div className="flex flex-col items-center">
            <p className="mb-2">{t('connection_timeout_message', language)}</p>
            <button
              onClick={onReload}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              <RefreshCcw size={16} />
              {t('reload_page', language)}
            </button>
          </div>
        );
      default:
        return '';
    }
  };

  return (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 
      ${showMessage === 3 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'} 
      border rounded-lg px-6 py-3 shadow-lg transition-all duration-300 fade-in-out`}
    >
      <div className="flex items-center gap-2">
        <AlertCircle className={showMessage === 3 ? 'text-red-500' : 'text-amber-500'} size={20} />
        <span className={showMessage === 3 ? 'text-red-700' : 'text-amber-700'}>
          {getMessage()}
        </span>
      </div>
    </div>
  );
};

export default LoadingMessage;
