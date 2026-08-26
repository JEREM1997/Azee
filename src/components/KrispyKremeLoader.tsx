import React, { useId } from 'react';

export interface KrispyKremeLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  inline?: boolean;
  fullscreen?: boolean;
  className?: string;
}

const pixels = { sm: 20, md: 40, lg: 70 } as const;

/** A lightweight, brand-specific progress indicator for short, indeterminate work. */
const KrispyKremeLoader: React.FC<KrispyKremeLoaderProps> = ({
  size = 'md', label, inline = false, fullscreen = false, className = '',
}) => {
  const reactId = useId().replace(/:/g, '');
  const gradientId = `kk-dough-${reactId}`;
  const glazeId = `kk-glaze-${reactId}`;
  const depthId = `kk-depth-${reactId}`;
  const holeId = `kk-hole-${reactId}`;
  const compact = size === 'sm';
  const content = (
    <div
      className={`kk-loader ${inline ? 'kk-loader--inline' : ''} ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label || 'Opération en cours'}
    >
      <svg
        className="kk-loader__doughnut"
        width={pixels[size]}
        height={pixels[size]}
        viewBox="0 0 72 72"
        aria-hidden="true"
      >
        {compact ? (
          <>
            <circle cx="36" cy="36" r="23" fill="none" stroke="#B9722E" strokeWidth="14" />
            <circle cx="36" cy="36" r="23" fill="none" stroke="#F4E1BE" strokeWidth="9" strokeDasharray="31 7" strokeLinecap="round" />
          </>
        ) : (
          <>
            <defs>
              <linearGradient id={gradientId} x1="15" y1="12" x2="57" y2="61" gradientUnits="userSpaceOnUse">
                <stop stopColor="#D99A47" /><stop offset="1" stopColor="#A96225" />
              </linearGradient>
              <linearGradient id={glazeId} x1="20" y1="14" x2="54" y2="55" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FFF8E9" /><stop offset="1" stopColor="#E8D3AE" />
              </linearGradient>
              <filter id={depthId} x="-12%" y="-12%" width="124%" height="130%"><feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#633914" floodOpacity=".2" /></filter>
              <mask id={holeId}><rect width="72" height="72" fill="white" /><path d="M28.4 35.7c.1-5 3.2-8.1 7.7-8.2 4.8-.1 7.9 3.2 7.7 8.3-.2 5-3.1 8.1-7.7 8-4.7 0-7.8-3.1-7.7-8.1Z" fill="black" /></mask>
            </defs>
            <g filter={`url(#${depthId})`} mask={`url(#${holeId})`}>
              <path fill={`url(#${gradientId})`} d="M62 35.7c.1 15.3-10.2 26.5-25.7 26.8C20.6 62.8 9.8 52.3 10 36.4 10.2 20.8 20.7 9.8 36 9.5c15.6-.2 25.9 10.5 26 26.2Z" />
              <path fill={`url(#${glazeId})`} d="M58.9 31.5c.3 4.5-2.5 4.6-3.9 7.8-1.3 3.1.3 5.4-2.9 8.5-3.4 3.4-6.7 1.9-10 4.5-2.5 2-4.1 4.6-8.7 3.7-4.4-.9-4.8-4-8.2-5.4-3.7-1.4-6.3.3-8.6-3.8-2.2-3.8.3-6.1-.8-9.7-1-3.3-3.5-4.9-1.5-9.2 2-4.1 5.2-3.3 7.7-6.2 2.2-2.7 1.8-5.8 6.4-7.1 4.3-1.3 5.9 1.5 9.5 1.6 3.7.1 5.4-2.5 9.3-.5 4.1 2 3.2 5.2 6.2 7.5 2.7 2.1 5.2 3.8 5.5 8.3Z" />
              <path d="M21.5 25.5c5-6.8 15.5-9.4 23.2-5.3" fill="none" stroke="#FFF" strokeOpacity=".62" strokeWidth="2.2" strokeLinecap="round" />
            </g>
          </>
        )}
      </svg>
      {label && <span className={inline ? 'kk-loader__inline-label' : 'kk-loader__label'}>{label}</span>}
    </div>
  );

  return fullscreen ? <div className="kk-loader-screen">{content}</div> : content;
};

export default KrispyKremeLoader;
