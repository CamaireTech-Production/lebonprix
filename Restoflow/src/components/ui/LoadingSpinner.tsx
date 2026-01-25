import React from 'react';
import { Oval } from 'react-loader-spinner';
import designSystem from '../../designSystem';

interface LoadingSpinnerProps {
  size?: number;
  color?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 40, 
  color = designSystem.colors.primary 
}) => {
  return (
    <Oval
      height={size}
      width={size}
      color={color}
      visible={true}
      secondaryColor={designSystem.colors.secondary}
      strokeWidth={4}
      strokeWidthSecondary={4}
    />
  );
};

export default LoadingSpinner;