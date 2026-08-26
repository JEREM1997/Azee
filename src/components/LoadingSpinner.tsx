import React from 'react';
import KrispyKremeLoader from './KrispyKremeLoader';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  fullScreen?: boolean;
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  fullScreen = false,
  message = 'Opération en cours…',
}) => {
  const mappedSize = { small: 'sm', medium: 'md', large: 'lg' } as const;
  return <KrispyKremeLoader size={mappedSize[size]} label={message} fullscreen={fullScreen} />;
};

export default LoadingSpinner;
