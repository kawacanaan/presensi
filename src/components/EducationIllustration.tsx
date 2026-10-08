import React from 'react';

export const EducationIllustration: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`relative w-full max-w-[420px] select-none pointer-events-none ${className}`}>
      {/* Soft Ambient Radial Blur */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-100/50 rounded-full blur-3xl" />
      <div className="absolute top-1/3 left-1/4 w-60 h-60 bg-amber-100/40 rounded-full blur-2xl" />

      {/* Isometric Vector Education Cluster (Inspired by Lalamove's decorative left-edge composition) */}
      <svg
        viewBox="0 0 450 420"
        className="w-full h-auto drop-shadow-lg"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="bookBlue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <linearGradient id="bookAmber" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <linearGradient id="bookEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <linearGradient id="tabletGlass" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F1F5F9" />
          </linearGradient>
          <filter id="isoShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="16" stdDeviation="18" floodColor="#1E293B" floodOpacity="0.07" />
          </filter>
        </defs>

        {/* Global Ground Isometric Soft Shadow */}
        <ellipse cx="225" cy="360" rx="180" ry="40" fill="#E2E8F0" opacity="0.65" />
        <ellipse cx="140" cy="330" rx="110" ry="26" fill="#CBD5E1" opacity="0.5" />

        {/* ISOMETRIC TABLET / DIGITAL SCREEN */}
        <g filter="url(#isoShadow)" transform="translate(130, 80)">
          {/* Base Tablet */}
          <polygon points="120,20 250,95 130,165 0,90" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="2.5" />
          {/* Screen area */}
          <polygon points="120,32 235,98 130,158 15,92" fill="url(#tabletGlass)" />
          {/* Tablet bezel depth */}
          <polygon points="0,90 130,165 130,175 0,100" fill="#CBD5E1" />
          <polygon points="130,165 250,95 250,105 130,175" fill="#94A3B8" />

          {/* Screen UI accents */}
          <polygon points="80,55 180,112 165,121 65,64" fill="#DBEAFE" />
          <polygon points="70,70 140,110 130,116 60,76" fill="#3B82F6" opacity="0.75" />
          <circle cx="210" cy="98" r="4.5" fill="#10B981" />
          <circle cx="196" cy="90" r="4.5" fill="#F59E0B" />
        </g>

        {/* STACK OF ISOMETRIC BOOKS (Foreground Left) */}
        <g filter="url(#isoShadow)" transform="translate(30, 160)">
          {/* Book 1 (Bottom Emerald) */}
          <g transform="translate(0, 80)">
            <polygon points="90,10 190,68 100,120 0,62" fill="url(#bookEmerald)" />
            <polygon points="0,62 100,120 100,135 0,77" fill="#065F46" />
            <polygon points="100,120 190,68 190,83 100,135" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="0.5" />
            {/* Book Ribbon / Bookmark */}
            <polygon points="120,85 132,92 128,115 120,110" fill="#F59E0B" />
          </g>

          {/* Book 2 (Middle Amber/Gold) */}
          <g transform="translate(10, 48)">
            <polygon points="85,10 180,65 95,114 0,59" fill="url(#bookAmber)" />
            <polygon points="0,59 95,114 95,128 0,73" fill="#92400E" />
            <polygon points="95,114 180,65 180,79 95,128" fill="#FFFBEB" stroke="#FDE68A" strokeWidth="0.5" />
          </g>

          {/* Book 3 (Top Royal Blue) */}
          <g transform="translate(20, 16)">
            <polygon points="80,10 170,62 90,108 0,56" fill="url(#bookBlue)" />
            <polygon points="0,56 90,108 90,121 0,69" fill="#1E3A8A" />
            <polygon points="90,108 170,62 170,75 90,121" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="0.5" />
            {/* Book Spine Detail */}
            <line x1="12" y1="62" x2="88" y2="106" stroke="#93C5FD" strokeWidth="1.5" strokeDasharray="3 3" />
          </g>
        </g>

        {/* GRADUATION CAP / TOGA (Hovering on Top Right) */}
        <g filter="url(#isoShadow)" transform="translate(260, 40)">
          {/* Cap Diamond Top */}
          <polygon points="65,5 125,30 65,55 5,30" fill="#1E293B" stroke="#0F172A" strokeWidth="1.5" />
          <polygon points="65,8 120,30 65,52 10,30" fill="#334155" />
          
          {/* Cap Base / Skullcap */}
          <path d="M38,40 C38,58 92,58 92,40" fill="#1E293B" />

          {/* Gold Tassel button & string */}
          <circle cx="65" cy="30" r="3.5" fill="#F59E0B" />
          <path d="M65,30 Q88,34 90,56" stroke="#F59E0B" strokeWidth="2" fill="none" />
          <rect x="87" y="56" width="6" height="10" rx="1.5" fill="#D97706" />
        </g>

        {/* DIPLOMA / CERTIFICATE SCROLL (Right Foreground) */}
        <g filter="url(#isoShadow)" transform="translate(300, 190)">
          {/* Certificate Card */}
          <polygon points="50,5 110,40 60,100 0,65" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
          <polygon points="12,60 52,15 95,40 55,85" fill="#F8FAFC" />
          {/* Lines of text */}
          <line x1="25" y1="52" x2="65" y2="28" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="28" y1="62" x2="78" y2="33" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
          <line x1="33" y1="70" x2="80" y2="42" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
          {/* Gold Ribbon Seal */}
          <circle cx="48" cy="74" r="9" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1.5" />
          <path d="M45,74 L47,76 L52,71" stroke="#D97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* PENCIL / STYLUS (Angled) */}
        <g transform="translate(190, 260) rotate(-25)">
          <polygon points="0,0 8,0 8,65 0,65" fill="#F59E0B" />
          <polygon points="8,0 12,0 12,65 8,65" fill="#D97706" />
          <polygon points="0,65 12,65 6,80" fill="#FEF3C7" />
          <polygon points="4,75 8,75 6,80" fill="#1E293B" />
          {/* Eraser */}
          <polygon points="0,0 12,0 12,-10 0,-10" fill="#F43F5E" />
          <rect x="0" y="-3" width="12" height="3" fill="#94A3B8" />
        </g>

        {/* Subtle Floating Sparkles of Knowledge */}
        <path d="M100,90 L102,96 L108,98 L102,100 L100,106 L98,100 L92,98 L98,96 Z" fill="#F59E0B" />
        <path d="M340,110 L341,114 L345,115 L341,116 L340,120 L339,116 L335,115 L339,114 Z" fill="#3B82F6" />
        <path d="M50,260 L51,263 L54,264 L51,265 L50,268 L49,265 L46,264 L49,263 Z" fill="#10B981" />
      </svg>
    </div>
  );
};
