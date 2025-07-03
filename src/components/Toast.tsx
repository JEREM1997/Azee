import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XCircle, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

const toastTypeConfig = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-50',
    textColor: 'text-green-800',
    borderColor: 'border-green-400',
    iconColor: 'text-green-400',
  },
  error: {
    icon: XCircle,
    bgColor: 'bg-red-50',
    textColor: 'text-red-800',
    borderColor: 'border-red-400',
    iconColor: 'text-red-400',
  },
  warning: {
    icon: AlertCircle,
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-800',
    borderColor: 'border-yellow-400',
    iconColor: 'text-yellow-400',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-400',
    iconColor: 'text-blue-400',
  },
};

const Toast: React.FC<ToastProps> = ({
  message,
  type,
  onClose,
  duration = 5000,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const config = toastTypeConfig[type];
  const Icon = config.icon;

  return createPortal(
    <div
      className={`fixed bottom-4 right-4 flex items-center p-4 mb-4 rounded-lg border ${config.bgColor} ${config.textColor} ${config.borderColor}`}
      role="alert"
    >
      <Icon className={`w-5 h-5 mr-2 ${config.iconColor}`} />
      <span className="sr-only">{type}:</span>
      <div className="text-sm font-medium mr-6">{message}</div>
      <button
        type="button"
        className={`ml-auto -mx-1.5 -my-1.5 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 inline-flex h-8 w-8 ${config.textColor} hover:bg-gray-100`}
        onClick={onClose}
        aria-label="Close"
      >
        <span className="sr-only">Close</span>
        <XCircle className="w-5 h-5" />
      </button>
    </div>,
    document.body
  );
};

export default Toast; 