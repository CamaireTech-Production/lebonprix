import React from 'react';
import { Loader2, FileText } from 'lucide-react';

interface ProcessingModalProps {
  isVisible: boolean;
  title: string;
  message: string;
  progress?: number;
  currentStep?: string;
  totalSteps?: number;
}

const ProcessingModal: React.FC<ProcessingModalProps> = ({
  isVisible,
  title,
  message,
  progress,
  currentStep,
  totalSteps
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 bg-primary bg-opacity-10 rounded-full flex items-center justify-center mb-4">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-600">{message}</p>
        </div>

        {/* Progress Bar */}
        {progress !== undefined && (
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Current Step */}
        {currentStep && (
          <div className="mb-6">
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
              <FileText size={16} />
              <span>{currentStep}</span>
              {totalSteps && (
                <span className="text-gray-400">
                  ({Math.floor((progress || 0) / (100 / totalSteps)) + 1}/{totalSteps})
                </span>
              )}
            </div>
          </div>
        )}

        {/* Processing Animation */}
        <div className="flex justify-center space-x-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>

        {/* Footer Message */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">
            Please don't close this window while processing...
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProcessingModal;
