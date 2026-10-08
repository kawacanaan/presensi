import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2 } from 'lucide-react';

interface BookVisualProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showGlow?: boolean;
  className?: string;
}

/**
 * Visual open book animation with gently turning pages in soft modern blue and green.
 */
export const BookVisual: React.FC<BookVisualProps> = ({
  size = 'md',
  showGlow = true,
  className = '',
}) => {
  // Dimensions based on size
  const sizeConfig = {
    sm: { width: 90, height: 60, scale: 'scale-75' },
    md: { width: 120, height: 80, scale: 'scale-100' },
    lg: { width: 150, height: 100, scale: 'scale-125' },
    xl: { width: 180, height: 120, scale: 'scale-150' },
  }[size];

  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      {/* Soft Ambient Blue-Green Aura Glow */}
      {showGlow && (
        <div className="absolute inset-0 -m-6 rounded-full bg-gradient-to-tr from-blue-400/20 via-teal-300/25 to-emerald-400/20 blur-xl pointer-events-none animate-soft-aura" />
      )}

      {/* Floating Sparkles */}
      <div className="absolute -top-2 -right-2 text-emerald-500 animate-bounce duration-1000">
        <Sparkles size={size === 'sm' ? 12 : 16} className="text-teal-500/80" />
      </div>
      <div className="absolute -bottom-1 -left-2 text-blue-500 animate-pulse duration-1000">
        <Sparkles size={size === 'sm' ? 10 : 14} className="text-blue-500/70" />
      </div>

      {/* Book Container with floating animation */}
      <div className={`relative animate-book-float ${sizeConfig.scale} transform-gpu`}>
        {/* Book Cover / Shadow Base */}
        <div className="relative w-[130px] h-[84px]">
          {/* Bottom Drop Shadow */}
          <div className="absolute -bottom-2.5 left-2 right-2 h-4 bg-slate-800/10 rounded-full blur-xs" />

          {/* Book Spine Center / Binding */}
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-3 bg-gradient-to-b from-[#0B2F64] to-[#1E3A8A] rounded-sm z-30 shadow-xs border-t border-blue-400/40" />

          {/* Emerald Bookmark Ribbon hanging at bottom */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[-10px] w-2 h-4 bg-emerald-500 rounded-b-sm z-35 shadow-xs flex items-end justify-center">
            <div className="w-0 h-0 border-x-2 border-x-transparent border-t-2 border-t-white/40 mb-0.5" />
          </div>

          {/* Book Outer Cover (Hardcover Backing) */}
          <div className="absolute inset-0 bg-[#0B2F64] rounded-lg shadow-md border border-blue-800/80 flex">
            {/* Left Cover Trim */}
            <div className="w-1/2 h-full rounded-l-lg bg-gradient-to-r from-[#0B2F64] to-[#144286] border-r border-blue-900/60" />
            {/* Right Cover Trim */}
            <div className="w-1/2 h-full rounded-r-lg bg-gradient-to-l from-[#0B2F64] to-[#144286] border-l border-blue-900/60" />
          </div>

          {/* Left Page (Static Base in Soft Blue Tint) */}
          <div className="absolute left-1.5 top-1.5 bottom-1.5 w-[58px] bg-gradient-to-r from-blue-50 to-white rounded-l-sm border border-blue-100/80 shadow-inner z-10 p-2 overflow-hidden">
            {/* Simulated text lines */}
            <div className="space-y-1.5 mt-0.5">
              <div className="h-1 w-3/4 bg-blue-300/60 rounded-full" />
              <div className="h-1 w-full bg-slate-200/80 rounded-full" />
              <div className="h-1 w-5/6 bg-slate-200/80 rounded-full" />
              <div className="h-1 w-2/3 bg-teal-300/60 rounded-full" />
              <div className="h-1 w-4/5 bg-slate-200/70 rounded-full" />
            </div>
            {/* Page corner shadow */}
            <div className="absolute top-0 right-0 bottom-0 w-2 bg-gradient-to-l from-slate-200/40 to-transparent" />
          </div>

          {/* Right Page (Static Base in Soft Green Tint) */}
          <div className="absolute right-1.5 top-1.5 bottom-1.5 w-[58px] bg-gradient-to-l from-emerald-50 to-white rounded-r-sm border border-emerald-100/80 shadow-inner z-10 p-2 overflow-hidden">
            {/* Simulated text lines */}
            <div className="space-y-1.5 mt-0.5">
              <div className="h-1 w-2/3 bg-emerald-400/60 rounded-full ml-auto" />
              <div className="h-1 w-full bg-slate-200/80 rounded-full" />
              <div className="h-1 w-4/5 bg-slate-200/80 rounded-full" />
              <div className="h-1 w-full bg-blue-300/50 rounded-full" />
              <div className="h-1 w-3/4 bg-slate-200/70 rounded-full" />
            </div>
            {/* Page corner shadow */}
            <div className="absolute top-0 left-0 bottom-0 w-2 bg-gradient-to-r from-slate-200/40 to-transparent" />
          </div>

          {/* Animated Turning Page 1 (Soft Blue-White Layer) */}
          <div
            className="absolute left-[63px] top-1.5 bottom-1.5 w-[56px] rounded-r-sm border border-blue-200/90 z-20 p-2 overflow-hidden animate-page-turn-1"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <div className="space-y-1.5 mt-0.5">
              <div className="h-1 w-4/5 bg-blue-400/70 rounded-full" />
              <div className="h-1 w-full bg-slate-300/70 rounded-full" />
              <div className="h-1 w-2/3 bg-emerald-400/70 rounded-full" />
              <div className="h-1 w-5/6 bg-slate-300/60 rounded-full" />
            </div>
          </div>

          {/* Animated Turning Page 2 (Soft Mint-Green Layer) */}
          <div
            className="absolute left-[63px] top-1.5 bottom-1.5 w-[56px] rounded-r-sm border border-emerald-200/90 z-21 p-2 overflow-hidden animate-page-turn-2"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <div className="space-y-1.5 mt-0.5">
              <div className="h-1 w-2/3 bg-emerald-400/70 rounded-full" />
              <div className="h-1 w-5/6 bg-slate-300/70 rounded-full" />
              <div className="h-1 w-full bg-blue-300/60 rounded-full" />
              <div className="h-1 w-1/2 bg-slate-300/60 rounded-full" />
            </div>
          </div>

          {/* Animated Turning Page 3 (Soft Aqua Layer) */}
          <div
            className="absolute left-[63px] top-1.5 bottom-1.5 w-[56px] rounded-r-sm border border-teal-200/90 z-22 p-2 overflow-hidden animate-page-turn-3"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <div className="space-y-1.5 mt-0.5">
              <div className="h-1 w-full bg-teal-400/70 rounded-full" />
              <div className="h-1 w-3/4 bg-slate-300/70 rounded-full" />
              <div className="h-1 w-4/5 bg-emerald-300/60 rounded-full" />
              <div className="h-1 w-2/3 bg-blue-300/60 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export interface BookLoadingModalProps {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  badgeText?: string;
  progress?: number; // 0 to 100
  statusMessage?: string;
  tips?: string[];
  onCancel?: () => void;
}

const DEFAULT_TIPS = [
  'Format data siswa diatur rapi dan otomatis diurutkan secara alfabetis (A-Z).',
  'Data presensi tersimpan otomatis dan siap diekspor ke format resmi dinas A4.',
  'Sistem memverifikasi kelengkapan NISN dan rombel belajar untuk validasi rapor.',
  'Rekapitulasi otomatis menghitung persentase kehadiran semesteran tanpa rumus manual.',
];

/**
 * Full modal dialog with the animated open book loader for import, report generation, and data processing.
 */
export const BookLoadingModal: React.FC<BookLoadingModalProps> = ({
  isOpen,
  title = 'Memproses Data...',
  subtitle = 'Mohon tunggu sebentar, sistem sedang menyelesaikan proses.',
  badgeText = 'SEDANG BERJALAN',
  progress,
  statusMessage,
  tips = DEFAULT_TIPS,
  onCancel,
}) => {
  const [tipIndex, setTipIndex] = useState(0);

  // Cycle through educational tips every 3.5 seconds
  useEffect(() => {
    if (!isOpen || tips.length <= 1) return;
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % tips.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [isOpen, tips.length]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-blue-100 text-center space-y-5 relative overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Top Decorative Gradient Line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-teal-400 to-emerald-500" />

        {/* Badge Header */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-[11px] font-black uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{badgeText}</span>
        </div>

        {/* Animated Open Book */}
        <div className="py-2 flex justify-center">
          <BookVisual size="lg" showGlow={true} />
        </div>

        {/* Text Details */}
        <div className="space-y-1.5">
          <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
            {statusMessage || subtitle}
          </p>
        </div>

        {/* Progress Bar (Determinate or Indeterminate Shimmer) */}
        <div className="space-y-1.5 text-left">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
            <span>Kemajuan Proses</span>
            <span className="font-mono text-blue-700">
              {typeof progress === 'number' ? `${Math.round(progress)}%` : 'Memproses...'}
            </span>
          </div>
          <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
            {typeof progress === 'number' ? (
              <div
                className="h-full bg-gradient-to-r from-blue-600 via-teal-400 to-emerald-500 rounded-full transition-all duration-300 relative overflow-hidden"
                style={{ width: `${Math.max(5, Math.min(100, progress))}%` }}
              >
                <div className="absolute inset-0 bg-white/30 animate-shimmer-progress rounded-full" />
              </div>
            ) : (
              <div className="h-full w-2/5 bg-gradient-to-r from-blue-600 via-teal-400 to-emerald-500 rounded-full animate-shimmer-progress" />
            )}
          </div>
        </div>

        {/* Rotating Educational Tip Card */}
        {tips.length > 0 && (
          <div className="p-3 bg-gradient-to-r from-blue-50/70 via-emerald-50/50 to-blue-50/70 border border-blue-100 rounded-2xl text-left flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-lg bg-white border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
              <Sparkles size={12} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase font-black text-blue-800 tracking-wider block mb-0.5">
                Info Sistem
              </span>
              <p className="text-[11px] text-slate-600 leading-snug transition-opacity duration-300">
                {tips[tipIndex]}
              </p>
            </div>
          </div>
        )}

        {/* Optional Cancel Button */}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer transition-colors"
          >
            Batalkan Proses
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Inline card / box loader with the animated open book.
 */
export const BookLoadingCard: React.FC<{
  title?: string;
  subtitle?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}> = ({
  title = 'Memuat Data...',
  subtitle = 'Menyiapkan berkas dan daftar siswa...',
  className = '',
  size = 'md',
}) => {
  return (
    <div
      className={`p-8 bg-white border border-blue-100 rounded-2xl shadow-xs text-center flex flex-col items-center justify-center space-y-4 ${className}`}
    >
      <BookVisual size={size} showGlow={true} />
      <div className="space-y-1 max-w-sm">
        <h4 className="font-bold text-slate-800 text-sm sm:text-base">{title}</h4>
        <p className="text-xs text-slate-500 leading-relaxed">{subtitle}</p>
      </div>
    </div>
  );
};
