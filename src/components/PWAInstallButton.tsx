import React, { useState } from 'react';
import { usePWAInstall } from '../utils/usePWAInstall';
import { Download, Smartphone, X, CheckCircle2, Share } from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'banner' | 'compact' | 'button';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Jika sudah terpasang sebagai PWA / mode standalone, sembunyikan
  if (isInstalled) {
    return null;
  }

  // Jika tidak installable dan bukan iOS (misal desktop browser tanpa prompt), sembunyikan
  if (!isInstallable && !isIOS) {
    return null;
  }

  const handleAction = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
    } else {
      await install();
    }
  };

  if (variant === 'banner') {
    return (
      <>
        <div className={`p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-md flex items-center justify-between gap-3 ${className}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Smartphone size={22} className="text-white" />
            </div>
            <div>
              <h4 className="text-sm font-black">Pasang Aplikasi Kawacanaan</h4>
              <p className="text-xs text-blue-100">
                Akses cepat presensi & notifikasi langsung dari layar utama ponsel Anda.
              </p>
            </div>
          </div>
          <button
            onClick={handleAction}
            className="px-3.5 py-2 rounded-xl bg-white text-blue-700 text-xs font-black shadow-xs hover:bg-blue-50 transition-all shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <Download size={14} />
            <span>Pasang</span>
          </button>
        </div>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone size={20} className="text-blue-600" />
                  <h3 className="text-base font-black text-slate-900">Pasang di iPhone / iPad</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600">
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div>
                    Ketuk tombol <strong>Bagikan (Share)</strong>{' '}
                    <Share size={12} className="inline text-blue-600" /> di bilah bawah browser Safari.
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div>
                    Gulir ke bawah lalu pilih menu{' '}
                    <strong className="text-slate-900">Tambahkan ke Layar Utama (Add to Home Screen)</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div>
                    Ketuk <strong>Tambah (Add)</strong> di pojok kanan atas. Aplikasi siap digunakan!
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-all cursor-pointer"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <button
        onClick={handleAction}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-all cursor-pointer ${className}`}
        title="Pasang aplikasi ke Layar Utama ponsel"
      >
        <Download size={14} />
        <span>Pasang Aplikasi</span>
      </button>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone size={20} className="text-blue-600" />
                <h3 className="text-base font-black text-slate-900">Pasang di iPhone / iPad</h3>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  Ketuk tombol <strong>Bagikan (Share)</strong>{' '}
                  <Share size={12} className="inline text-blue-600" /> di bilah bawah browser Safari.
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  Gulir ke bawah lalu pilih menu{' '}
                  <strong className="text-slate-900">Tambahkan ke Layar Utama (Add to Home Screen)</strong>.
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  Ketuk <strong>Tambah (Add)</strong> di pojok kanan atas.
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-all cursor-pointer"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
};
