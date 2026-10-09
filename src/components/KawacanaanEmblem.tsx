import React from 'react';
import { usePlatformBrand, DEFAULT_PLATFORM_LOGO } from '../utils/platformBranding';

export type EmblemSizePreset = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface KawacanaanEmblemProps {
  className?: string;
  size?: number | EmblemSizePreset;
  alt?: string;
  src?: string;
}

const SIZE_MAP: Record<EmblemSizePreset, number> = {
  xs: 24,
  sm: 32,
  md: 48,
  lg: 64,
  xl: 80,
};

export const KawacanaanEmblem: React.FC<KawacanaanEmblemProps> = ({
  className = '',
  size = 64,
  alt = 'Emblem Resmi Kawacanaan',
  src,
}) => {
  const { logoUrl } = usePlatformBrand();
  const activeSrc = src || logoUrl || DEFAULT_PLATFORM_LOGO;
  const numericSize = typeof size === 'number' ? size : SIZE_MAP[size] || 64;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: numericSize, height: numericSize }}
      id="kawacanaan-emblem"
    >
      <img
        key={activeSrc}
        src={activeSrc}
        alt={alt}
        className="w-full h-full object-contain hover:scale-105 transition-transform duration-300 drop-shadow-sm"
        onError={(e) => {
          // Fallback jika logo custom gagal dimuat, selalu gunakan logo terbaru default (/lk.png)
          const target = e.currentTarget;
          if (target.src !== `${window.location.origin}/lk.png` && !target.src.endsWith('/lk.png')) {
            target.src = '/lk.png';
          }
        }}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

