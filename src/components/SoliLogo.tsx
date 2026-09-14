import React from 'react';

interface SoliLogoProps {
  className?: string;
  size?: number | string;
}

export const SoliLogo: React.FC<SoliLogoProps> = ({ className = 'w-10 h-10', size }) => {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <img 
      src="/logo.svg" 
      alt="Soli Medical MICU Logo" 
      className={`object-contain ${className}`}
      style={style}
    />
  );
};
