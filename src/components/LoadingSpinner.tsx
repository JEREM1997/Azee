import React from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  fullScreen?: boolean;
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  fullScreen = false,
  message = 'Loading...',
}) => {
  const sizeClasses = {
    small: 'h-5 w-5',
    medium: 'h-8 w-8',
    large: 'h-12 w-12',
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center">
      <svg
        className={`animate-spin text-krispy-green ${sizeClasses[size]}`}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48"
        fill="none"
        role="status"
        aria-label={message}
      >
        <circle
          cx="24"
          cy="24"
          r="20"
          stroke="currentColor"
          strokeWidth="6"
          strokeOpacity="0.15"
          fill="none"
        />
        <circle
          cx="24"
          cy="24"
          r="20"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="125.6"
          strokeDashoffset="94.2"
          fill="none"
        />
      </svg>
      {message && (
        <p className="mt-2 text-sm text-gray-500">{message}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-50 bg-opacity-75">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export default LoadingSpinner;
