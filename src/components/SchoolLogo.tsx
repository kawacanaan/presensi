import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { usePlatformBrand, DEFAULT_PLATFORM_LOGO } from '../utils/platformBranding';

interface SchoolLogoProps {
  className?: string;
  size?: number | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export const SchoolLogo: React.FC<SchoolLogoProps> = ({ className = '', size = 48 }) => {
  const { systemConfig } = useApp();
  const { logoUrl } = usePlatformBrand();
  const [imageError, setImageError] = useState(false);

  const numericSize =
    typeof size === 'number'
      ? size
      : size === 'xs'
      ? 24
      : size === 'sm'
      ? 32
      : size === 'md'
      ? 48
      : size === 'lg'
      ? 64
      : size === 'xl'
      ? 80
      : 48;

  // Jika sekolah memiliki logo kustom dan belum error, tampilkan logo sekolah.
  // Jika belum diunggah atau gagal dimuat, selalu tampilkan logo branding resmi Kawacanaan.
  const activeSrc =
    !imageError && systemConfig.schoolLogoUrl?.trim()
      ? systemConfig.schoolLogoUrl.trim()
      : logoUrl || DEFAULT_PLATFORM_LOGO || '/lk.png';

  return (
    <img
      key={activeSrc}
      src={activeSrc}
      alt="Logo"
      className={`object-contain rounded-full shadow-sm flex-shrink-0 ${className}`}
      style={{ width: numericSize, height: numericSize }}
      onError={(e) => {
        // Jika logo sekolah eksternal gagal dimuat, fallback ke logo branding Kawacanaan
        if (!imageError) {
          setImageError(true);
        } else {
          // Jika logo branding pun bermasalah, fallback ke aset lokal pasti ada
          const target = e.currentTarget;
          if (target.src !== `${window.location.origin}/lk.png` && !target.src.endsWith('/lk.png')) {
            target.src = '/lk.png';
          }
        }
      }}
      referrerPolicy="no-referrer"
    />
  );
};

