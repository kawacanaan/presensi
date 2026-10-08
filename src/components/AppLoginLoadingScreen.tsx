import React, { useState, useEffect } from 'react';

const LETTERS = ['K', 'A', 'W', 'A', 'C', 'A', 'N', 'A', 'A', 'N'];

export const AppLoginLoadingScreen: React.FC = () => {
  const [visibleCount, setVisibleCount] = useState<number>(1);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (visibleCount < LETTERS.length) {
      timer = setTimeout(() => {
        setVisibleCount((prev) => prev + 1);
      }, 110);
    } else {
      // Tahan teks penuh selama 850ms, lalu loop kembali
      timer = setTimeout(() => {
        setVisibleCount(1);
      }, 850);
    }
    return () => clearTimeout(timer);
  }, [visibleCount]);

  return (
    <div
      id="app-login-loading-screen"
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/10 backdrop-blur-[4px] select-none transition-all duration-300 animate-in fade-in duration-200"
    >
      {/* Kartu Loading Kecil Elegan di Tengah Halaman Login */}
      <div className="w-full max-w-[240px] sm:max-w-[260px] bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/90 shadow-[0_16px_40px_-12px_rgba(15,23,42,0.14)] px-6 py-5 flex flex-col items-center justify-center text-center transition-all">
        
        {/* Animasi Spinner Segmented Petal Minimalis (Sesuai Referensi Visual) */}
        <div className="relative mb-3.5 flex items-center justify-center">
          <svg
            className="w-7 h-7 sm:w-8 sm:h-8 animate-spin text-slate-800"
            style={{ animationDuration: '0.85s', animationTimingFunction: 'linear' }}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {[...Array(12)].map((_, i) => (
              <rect
                key={i}
                x="11"
                y="1.5"
                width="2"
                height="5"
                rx="1"
                transform={`rotate(${i * 30} 12 12)`}
                fill="currentColor"
                opacity={0.12 + (i / 11) * 0.88}
              />
            ))}
          </svg>
        </div>

        {/* Animasi Huruf Teks "Kawacanaan" Muncul Satu per Satu (Menggantikan Progres Bar) */}
        <div className="flex items-center justify-center font-sans tracking-[0.25em] pl-[0.25em] text-xs sm:text-sm font-bold select-none h-5">
          {LETTERS.map((letter, idx) => {
            const isVisible = idx < visibleCount;
            const isLatest = idx === visibleCount - 1;
            return (
              <span
                key={idx}
                className={`inline-block transition-all duration-200 ease-out ${
                  isVisible
                    ? isLatest
                      ? 'text-blue-600 scale-110 opacity-100 font-extrabold'
                      : 'text-slate-800 scale-100 opacity-100'
                    : 'opacity-0 scale-90 translate-y-1'
                }`}
              >
                {letter}
              </span>
            );
          })}
        </div>

        {/* Indikator Status Halus & Komersial */}
        <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
          <span>Memproses masuk...</span>
        </div>
      </div>
    </div>
  );
};
