import React, { useState } from 'react';
import { usePWAInstall } from '../utils/usePWAInstall';
import { Download, Smartphone, Monitor, Apple, X, Share, CheckCircle2, Sparkles, ExternalLink } from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'banner' | 'compact' | 'button' | 'card' | 'floating';
  className?: string;
  showSubtitle?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'compact',
  className = '',
  showSubtitle = true,
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isWindows, install } = usePWAInstall();
  const [showModalGuide, setShowModalGuide] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [activeTab, setActiveTab] = useState<'android' | 'windows' | 'ios'>(() => {
    if (isIOS) return 'ios';
    if (isWindows) return 'windows';
    return 'android';
  });

  // Jika sudah terpasang sebagai PWA (standalone window) atau di-dismiss, sembunyikan tombol instal
  if (isInstalled || (variant === 'floating' && isDismissed)) {
    return null;
  }

  const handleAction = async () => {
    // Jika browser mendukung native prompt, coba jalankan
    if (isInstallable) {
      const success = await install();
      if (success) return;
    }
    // Jika native prompt belum siap atau perangkat iOS/desktop, buka panduan interaktif
    setShowModalGuide(true);
  };

  const renderGuideModal = () => {
    if (!showModalGuide) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
        <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4 border border-slate-100 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Download size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  Instal Aplikasi Kawacanaan
                </h3>
                <p className="text-[11px] text-slate-500 font-semibold">
                  Pasang di perangkat Anda untuk akses cepat & notifikasi
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowModalGuide(false)}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 cursor-pointer transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Platform Selector Tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl text-xs font-black">
            <button
              type="button"
              onClick={() => setActiveTab('android')}
              className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'android' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone size={14} />
              <span>Android</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('windows')}
              className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'windows' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Monitor size={14} />
              <span>Windows/PC</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ios')}
              className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'ios' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Apple size={14} />
              <span>iPhone/iPad</span>
            </button>
          </div>

          {/* Tab 1: Android Instructions */}
          {activeTab === 'android' && (
            <div className="space-y-3 text-xs text-slate-600 animate-in fade-in">
              <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 text-blue-900 font-medium">
                Gunakan browser <strong>Google Chrome</strong> di ponsel Android untuk pengalaman terbaik:
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  1
                </div>
                <div>
                  Ketuk ikon <strong>titik tiga (⋮)</strong> di sudut kanan atas browser Chrome.
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  2
                </div>
                <div>
                  Pilih menu <strong>"Instal aplikasi"</strong> atau <strong>"Tambahkan ke Layar Utama" (Add to Home screen)</strong>.
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  3
                </div>
                <div>
                  Ketuk <strong>Instal</strong>. Ikon Kawacanaan akan muncul di layar ponsel Anda layaknya aplikasi Play Store.
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Windows / PC Instructions */}
          {activeTab === 'windows' && (
            <div className="space-y-3 text-xs text-slate-600 animate-in fade-in">
              <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 text-blue-900 font-medium">
                Gunakan browser <strong>Google Chrome</strong> atau <strong>Microsoft Edge</strong> di komputer Windows/Mac:
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  1
                </div>
                <div>
                  Lihat ke <strong>Bilah Alamat (Address Bar)</strong> browser di bagian atas kanan.
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  2
                </div>
                <div>
                  Klik ikon komputer kecil <strong>"Instal Kawacanaan Presensi"</strong> (atau ikon panah/layar).
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  3
                </div>
                <div>
                  <em>Alternatif:</em> Klik menu titik tiga (⋮) di Chrome &rarr; pilih <strong>"Simpan dan bagikan" &rarr; "Instal Kawacanaan Presensi"</strong>.
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: iOS / iPhone Instructions */}
          {activeTab === 'ios' && (
            <div className="space-y-3 text-xs text-slate-600 animate-in fade-in">
              <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 text-blue-900 font-medium">
                Buka web ini menggunakan browser <strong>Safari</strong> di iPhone atau iPad:
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  1
                </div>
                <div>
                  Ketuk tombol <strong>Bagikan (Share)</strong>{' '}
                  <Share size={12} className="inline text-blue-600 mx-1" /> di bilah navigasi bawah Safari.
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  2
                </div>
                <div>
                  Gulir ke bawah dan ketuk menu{' '}
                  <strong className="text-slate-900">Tambahkan ke Layar Utama (Add to Home Screen)</strong>.
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  3
                </div>
                <div>
                  Ketuk <strong>Tambah (Add)</strong> di pojok kanan atas. Ikon aplikasi akan langsung terpasang di Home Screen iPhone!
                </div>
              </div>
            </div>
          )}

          {/* Action button */}
          <div className="pt-2">
            <button
              onClick={() => setShowModalGuide(false)}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-all cursor-pointer shadow-md shadow-blue-500/20"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Varian Banner Prominen (Sangat cocok di bagian atas Portal Siswa)
  if (variant === 'banner') {
    return (
      <>
        <div className={`p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-md shadow-blue-600/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 ${className}`}>
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/25">
              <Download size={22} className="text-white animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm sm:text-base font-black">Instal Aplikasi Kawacanaan</h4>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white">
                  PWA Gratis
                </span>
              </div>
              {showSubtitle && (
                <p className="text-xs text-blue-100 mt-0.5 leading-relaxed">
                  Pasang di ponsel Android, Windows PC, atau iPhone untuk akses presensi instan & notifikasi real-time tanpa lewat browser.
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleAction}
            className="px-4 py-2.5 rounded-2xl bg-white text-blue-700 text-xs font-black shadow-md hover:bg-blue-50 active:scale-95 transition-all shrink-0 cursor-pointer flex items-center justify-center gap-2"
          >
            <Download size={15} />
            <span>Instal Sekarang</span>
          </button>
        </div>
        {renderGuideModal()}
      </>
    );
  }

  // Varian Card / Menu
  if (variant === 'card') {
    return (
      <>
        <div className={`bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3 ${className}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
                <Download size={20} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900">Pasang Aplikasi di Perangkat</h4>
                <p className="text-[11px] text-slate-500">Mendukung Android, Windows PC, dan iPhone</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAction}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Download size={14} />
              <span>Instal</span>
            </button>
          </div>
        </div>
        {renderGuideModal()}
      </>
    );
  }

  // Varian Floating (Bilah Melayang Bawah Layar untuk Android & Windows)
  if (variant === 'floating') {
    return (
      <>
        <div className={`fixed bottom-4 left-3 right-3 sm:left-auto sm:right-5 sm:bottom-5 sm:max-w-md z-45 bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 shadow-2xl rounded-2xl p-3.5 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-4 duration-300 ${className}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/30">
              <Download size={20} className="animate-bounce" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-black text-white truncate">
                Instal Aplikasi Kawacanaan
              </h4>
              <p className="text-[11px] text-slate-300 truncate">
                Pasang di Android / Windows untuk notifikasi instan
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleAction}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-black transition-all cursor-pointer shadow-md shadow-blue-600/30 flex items-center gap-1.5"
            >
              <Download size={13} />
              <span>Instal</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsDismissed(true);
                try {
                  sessionStorage.setItem('kawacanaan_pwa_floating_dismissed', 'true');
                } catch (_) {}
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Tutup"
            >
              <X size={15} />
            </button>
          </div>
        </div>
        {renderGuideModal()}
      </>
    );
  }

  // Varian Compact (Cocok di Header / Navbar / Baris Tombol)
  return (
    <>
      <button
        type="button"
        onClick={handleAction}
        className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-all cursor-pointer active:scale-95 shrink-0 ${className}`}
        title="Instal aplikasi ke Android, Windows, atau iPhone"
      >
        <Download size={14} />
        <span className="hidden sm:inline">Instal Aplikasi</span>
        <span className="inline sm:hidden">Instal</span>
      </button>
      {renderGuideModal()}
    </>
  );
};

export const PWAFloatingInstallPrompt: React.FC = () => {
  return <PWAInstallButton variant="floating" />;
};

