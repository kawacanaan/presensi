import React from 'react';
import { Sparkles, ShieldCheck, Database, CheckCircle2 } from 'lucide-react';

interface GlowingLoadingCircleProps {
  title?: string;
  statusMessage?: string;
  subMessage?: string;
  step?: number; // 1 to 4
  isOverlay?: boolean;
}

export const GlowingLoadingCircle: React.FC<GlowingLoadingCircleProps> = ({
  title = 'Menyiapkan Data Akun',
  statusMessage = 'Memverifikasi kredensial dan menyiapkan data aplikasi...',
  subMessage = 'Sistem sedang membaca data akun dan sekolah agar dashboard langsung siap digunakan tanpa jeda.',
  step = 2,
  isOverlay = true,
}) => {
  const steps = [
    { num: 1, label: 'Kredensial', icon: ShieldCheck },
    { num: 2, label: 'Profil Akun', icon: Sparkles },
    { num: 3, label: 'Data Sekolah', icon: Database },
    { num: 4, label: 'Dashboard', icon: CheckCircle2 },
  ];

  const content = (
    <div
      role="status"
      aria-live="polite"
      className="relative z-10 w-full max-w-md mx-auto p-6 sm:p-8 bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/80 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.25)] flex flex-col items-center text-center transition-all animate-in fade-in zoom-in-95 duration-300"
    >
      {/* Ambient background glow behind the circle */}
      <div className="relative mb-6 flex items-center justify-center">
        {/* Deep soft radiant auras */}
        <div className="absolute w-44 h-44 rounded-full bg-blue-500/20 blur-2xl animate-radial-aura-breath pointer-events-none" />
        <div className="absolute w-36 h-36 rounded-full bg-emerald-500/20 blur-xl animate-radial-aura-breath pointer-events-none delay-500" />
        
        {/* Main Glowing Circle Loader SVG */}
        <div className="relative w-32 h-32 flex items-center justify-center">
          <svg
            className="w-full h-full overflow-visible"
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Vibrant linear gradient for the glowing stroke */}
              <linearGradient id="glowingRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2563EB" />
                <stop offset="50%" stopColor="#06B6D4" />
                <stop offset="100%" stopColor="#10B981" />
              </linearGradient>

              {/* Inner glowing glow filter */}
              <filter id="svgGlowFilter" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Inactive track ring */}
            <circle
              cx="60"
              cy="60"
              r="48"
              stroke="#E2E8F0"
              strokeWidth="6"
              className="opacity-70"
            />

            {/* Outer subtle dashed counter-orbit */}
            <circle
              cx="60"
              cy="60"
              r="55"
              stroke="#93C5FD"
              strokeWidth="1.5"
              strokeDasharray="6 8"
              className="animate-spin-reverse-circle origin-center opacity-60"
            />

            {/* Active primary glowing circle ring with glow filter */}
            <circle
              cx="60"
              cy="60"
              r="48"
              stroke="url(#glowingRingGradient)"
              strokeWidth="6.5"
              strokeLinecap="round"
              strokeDasharray="301"
              strokeDashoffset="95"
              filter="url(#svgGlowFilter)"
              className="animate-spin-glow-circle origin-center"
            />
          </svg>

          {/* Glowing Center Core */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-emerald-500 p-0.5 shadow-lg shadow-blue-500/30 animate-glow-pulse-center flex items-center justify-center">
              <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-blue-600 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Typography */}
      <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-1.5">
        {title}
      </h3>
      <p className="text-sm font-semibold text-blue-600 min-h-[22px] flex items-center justify-center gap-1.5 mb-2 transition-all">
        <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping inline-block" />
        {statusMessage}
      </p>
      <p className="text-xs text-slate-500 leading-relaxed max-w-xs mb-5">
        {subMessage}
      </p>

      {/* 4-Step Progress Indicator */}
      <div className="w-full pt-4 border-t border-slate-100 flex items-center justify-between gap-1">
        {steps.map((s) => {
          const isDone = s.num < step;
          const isCurrent = s.num === step;
          const Icon = s.icon;

          return (
            <div key={s.num} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isDone
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : isCurrent
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-sm animate-pulse'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
              </div>
              <span
                className={`text-[10px] font-medium tracking-tight whitespace-nowrap ${
                  isCurrent
                    ? 'text-blue-600 font-semibold'
                    : isDone
                    ? 'text-emerald-700'
                    : 'text-slate-400'
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (!isOverlay) {
    return content;
  }

  return (
    <div
      id="glowing-loading-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200"
    >
      {content}
    </div>
  );
};
