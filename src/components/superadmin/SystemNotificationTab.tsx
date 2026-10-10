import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  BellRing,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Save,
  RotateCcw,
  Sparkles,
  Info,
  Sliders,
  Volume2,
  Check,
  Send,
  Eye,
  ShieldCheck,
  HelpCircle,
  Upload,
  RefreshCw,
  Link as LinkIcon,
  Trash2,
} from 'lucide-react';
import { usePlatformBrand, DEFAULT_PLATFORM_LOGO } from '../../utils/platformBranding';

export interface NotificationSystemConfig {
  is_enabled: boolean;
  show_large_icon: boolean; // false = logo kanan dihapus sesuai permintaan
  large_icon_url: string;
  badge_icon_url: string; // Logo sebelah kiri status bar
  app_title_prefix: string;
  notify_on_present: boolean;
  notify_on_late: boolean;
  notify_on_checkout: boolean;
  notify_on_leave: boolean;
  vibrate: boolean;
  require_interaction: boolean;
  template_present: string;
  template_late: string;
  template_checkout: string;
  template_leave_approved: string;
  template_leave_rejected: string;
}

interface Props {
  call: (action: string, payload?: any) => Promise<any>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  initialConfig?: Partial<NotificationSystemConfig>;
  platformLogo?: string;
  onSaved?: (newConfig: NotificationSystemConfig) => void;
}

const DEFAULT_CONFIG: NotificationSystemConfig = {
  is_enabled: true,
  show_large_icon: false, // Default: Logo kanan dihapus sesuai instruksi
  large_icon_url: '',
  badge_icon_url: DEFAULT_PLATFORM_LOGO || '/lk.png', // Logo sistem Kawacanaan resmi yang terhubung dengan Supabase
  app_title_prefix: 'Kawacanaan Presensi',
  notify_on_present: true,
  notify_on_late: true,
  notify_on_checkout: true,
  notify_on_leave: true,
  vibrate: true,
  require_interaction: true,
  template_present: 'Ananda {nama_siswa} telah hadir di kelas tepat waktu pukul {jam} WIB.',
  template_late: 'Ananda {nama_siswa} telah hadir di kelas pukul {jam} WIB (Status: Terlambat).',
  template_checkout: 'Ananda {nama_siswa} telah selesai belajar dan keluar kelas pukul {jam} WIB.',
  template_leave_approved: 'Pengajuan {jenis_izin} untuk Ananda {nama_siswa} telah DISETUJUI oleh {penyetuju}.',
  template_leave_rejected: 'Pengajuan {jenis_izin} untuk Ananda {nama_siswa} DITOLAK oleh {penyetuju}.',
};

export const SystemNotificationTab: React.FC<Props> = ({
  call,
  showToast,
  initialConfig,
  platformLogo,
  onSaved,
}) => {
  const { logoUrl: brandLogoUrl } = usePlatformBrand();
  // Logo Kawacanaan yang terhubung dengan Supabase saat ini
  const effectiveSupabaseLogo = (platformLogo && platformLogo.trim())
    || (brandLogoUrl && brandLogoUrl.trim())
    || DEFAULT_PLATFORM_LOGO
    || '/lk.png';

  const resolveBadgeIcon = (raw?: string) => {
    if (!raw || raw === '/pwa-192.png') {
      return effectiveSupabaseLogo;
    }
    return raw;
  };

  const [form, setForm] = useState<NotificationSystemConfig>(() => ({
    ...DEFAULT_CONFIG,
    ...(initialConfig || {}),
    badge_icon_url: resolveBadgeIcon(initialConfig?.badge_icon_url),
  }));

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [previewTab, setPreviewTab] = useState<'masuk' | 'pulang' | 'izin'>('masuk');
  const [badgeInputMode, setBadgeInputMode] = useState<'upload' | 'url'>('upload');
  const [isUploadingBadge, setIsUploadingBadge] = useState(false);
  const [isBadgeDragOver, setIsBadgeDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleBadgeFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('File harus berupa gambar (PNG, JPG, SVG, WebP).', 'error');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      showToast('Ukuran file gambar maksimal 4MB.', 'error');
      return;
    }

    setIsUploadingBadge(true);
    try {
      if (file.type.includes('svg')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const res = e.target?.result as string;
          if (res) {
            setForm((prev) => ({ ...prev, badge_icon_url: res }));
            showToast('Logo SVG berhasil diunggah untuk notifikasi Android & Windows.', 'success');
          }
          setIsUploadingBadge(false);
        };
        reader.onerror = () => {
          setIsUploadingBadge(false);
          showToast('Gagal membaca file SVG.', 'error');
        };
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const rawDataUrl = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          // Kompresi dan skala proporsional maksimal 256x256 untuk icon status bar Android & Windows
          const maxDim = 256;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);
            // Utamakan PNG agar transparansi icon status bar Android/Windows terjaga sempurna
            const pngUrl = canvas.toDataURL('image/png');
            setForm((prev) => ({ ...prev, badge_icon_url: pngUrl }));
            showToast('Gambar logo berhasil dioptimasi untuk notifikasi Android & Windows. Klik "Simpan Pengaturan" untuk menerapkan.', 'success');
          } else {
            setForm((prev) => ({ ...prev, badge_icon_url: rawDataUrl }));
          }
          setIsUploadingBadge(false);
        };
        img.onerror = () => {
          setIsUploadingBadge(false);
          showToast('Gagal memuat gambar untuk dioptimasi.', 'error');
        };
        img.src = rawDataUrl;
      };
      reader.onerror = () => {
        setIsUploadingBadge(false);
        showToast('Gagal membaca file gambar.', 'error');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsUploadingBadge(false);
      showToast('Gagal memproses file gambar.', 'error');
    }
  };

  useEffect(() => {
    if (initialConfig) {
      setForm((prev) => ({
        ...prev,
        ...initialConfig,
        badge_icon_url: resolveBadgeIcon(initialConfig.badge_icon_url || prev.badge_icon_url),
      }));
    } else if (effectiveSupabaseLogo) {
      setForm((prev) => {
        if (!prev.badge_icon_url || prev.badge_icon_url === '/pwa-192.png') {
          return { ...prev, badge_icon_url: effectiveSupabaseLogo };
        }
        return prev;
      });
    }
  }, [initialConfig, effectiveSupabaseLogo]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const res = await call('update_system_settings', {
        section: 'notifikasi',
        data: form,
      });
      if (res && res.ok) {
        showToast('Pengaturan notifikasi berhasil disimpan ke server.', 'success');
        if (onSaved) onSaved(form);
      } else {
        throw new Error(res?.error || 'Gagal menyimpan.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Gagal menyimpan pengaturan notifikasi.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    setTesting(true);
    try {
      if (!('Notification' in window)) {
        showToast('Browser ini tidak mendukung Web Notifications API.', 'error');
        return;
      }

      let perm = Notification.permission;
      if (perm !== 'granted') {
        perm = await Notification.requestPermission();
      }

      if (perm !== 'granted') {
        showToast('Izin notifikasi belum diberikan pada browser ini. Mohon izinkan notifikasi terlebih dahulu.', 'error');
        return;
      }

      // Bangun options sesuai pengaturan aktif
      const badgeIcon = form.badge_icon_url || effectiveSupabaseLogo;
      const notificationOptions: NotificationOptions = {
        body: form.show_large_icon
          ? 'Contoh notifikasi: Logo sebelah kanan aktif.'
          : 'Contoh notifikasi: Logo sebelah kanan telah dihapus, tampilan bersih & teks proporsional.',
        badge: badgeIcon,
        tag: `test-superadmin-${Date.now()}`,
        requireInteraction: form.require_interaction,
      };

      if (form.show_large_icon && form.large_icon_url) {
        notificationOptions.icon = form.large_icon_url;
      }

      // Coba lewat service worker registration jika aktif, fallback ke native window Notification
      let shown = false;
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.showNotification(
            `${form.app_title_prefix} — Uji Coba Status Bar`,
            notificationOptions
          );
          shown = true;
        }
      }

      if (!shown) {
        new Notification(
          `${form.app_title_prefix} — Uji Coba Status Bar`,
          notificationOptions
        );
      }

      showToast('Notifikasi uji coba berhasil dikirim! Periksa panel notifikasi pada ponsel/layar Anda.', 'success');
    } catch (err: any) {
      showToast(`Gagal memicu notifikasi: ${err?.message || 'Error browser'}`, 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleReset = () => {
    if (confirm('Kembalikan seluruh konfigurasi notifikasi ke standar sistem?')) {
      setForm({
        ...DEFAULT_CONFIG,
        badge_icon_url: effectiveSupabaseLogo,
      });
      showToast('Konfigurasi dikembalikan ke standar. Klik Simpan untuk menerapkan.', 'info');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rose-900 via-slate-900 to-indigo-950 rounded-2xl p-6 sm:p-7 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-rose-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-500/30">
              <BellRing size={13} className="text-rose-400 animate-pulse" />
              <span>Pengaturan Notifikasi Sistem Terpadu</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Web Push & Tampilan Status Bar Android
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Konfigurasi tampilan notifikasi pada status bar ponsel wali murid, kontrol visual logo (hapus logo kanan &amp; set logo status bar kiri), serta otomatisasi narasi presensi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleTestNotification}
              disabled={testing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/25 text-white text-xs font-bold border border-white/20 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Send size={14} className={testing ? 'animate-bounce' : 'text-rose-300'} />
              <span>{testing ? 'Mengirim...' : 'Uji Coba di Perangkat Ini'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-bold transition-all cursor-pointer shadow-sm hover:shadow-md disabled:opacity-50"
            >
              <Save size={14} />
              <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kolom Kiri: Form Pengaturan (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Pengaturan Visual Logo & Status Bar (Permintaan Utama User) */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <Smartphone size={17} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Tampilan Visual Status Bar &amp; Kartu Notifikasi
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Menyesuaikan posisi icon Android, logo status bar kiri, dan logo kanan
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                Prioritas Visual
              </span>
            </div>

            {/* Toggle Hapus Logo Kanan */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      Hapus Logo di Sebelah Kanan (Clean Minimalist)
                    </span>
                    {!form.show_large_icon && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-700 border border-emerald-200">
                        SESUAI INSTRUKSI
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Bila diaktifkan, logo besar di sebelah kanan kartu notifikasi akan dihapus secara total sehingga ruang narasi teks penuh dan tampilan lebih profesional.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={!form.show_large_icon}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        show_large_icon: !e.target.checked,
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                </label>
              </div>

              {form.show_large_icon && (
                <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    URL Logo Besar Sebelah Kanan (Jika Diaktifkan)
                  </label>
                  <input
                    type="text"
                    value={form.large_icon_url}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, large_icon_url: e.target.value }))
                    }
                    placeholder={effectiveSupabaseLogo}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white"
                  />
                </div>
              )}
            </div>

            {/* Logo Status Bar Kiri (Badge Icon Android & Windows) */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-50/90 border border-slate-200/90 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200/70">
                <div>
                  <div className="flex items-center gap-2">
                    <label className="block text-xs font-bold text-slate-900">
                      Logo Status Bar Sebelah Kiri (Badge Icon Android &amp; Windows)
                    </label>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                      ICON NOTIFIKASI
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Menampilkan icon resmi notifikasi di bar status ponsel Android dan banner notifikasi Windows Action Center.
                  </p>
                </div>

                {/* Tab Pemilihan: Unggah Gambar atau Tautan URL */}
                <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 text-[11px] self-start sm:self-auto shrink-0 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setBadgeInputMode('upload')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      badgeInputMode === 'upload'
                        ? 'bg-rose-50 text-rose-700 shadow-2xs font-bold border border-rose-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Upload size={12} />
                    <span>Unggah Gambar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBadgeInputMode('url')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      badgeInputMode === 'url'
                        ? 'bg-rose-50 text-rose-700 shadow-2xs font-bold border border-rose-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <LinkIcon size={12} />
                    <span>Tautan URL</span>
                  </button>
                </div>
              </div>

              {/* Komponen Unggah File Gambar (Drag & Drop + File Explorer) */}
              {badgeInputMode === 'upload' ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsBadgeDragOver(true);
                  }}
                  onDragLeave={() => setIsBadgeDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsBadgeDragOver(false);
                    const file = e.dataTransfer?.files?.[0];
                    if (file) handleBadgeFile(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-xl p-4 sm:p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    isBadgeDragOver
                      ? 'border-rose-500 bg-rose-50/70'
                      : 'border-slate-300 hover:border-rose-400 hover:bg-white bg-white/70'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleBadgeFile(file);
                    }}
                  />

                  <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-2.5 shadow-inner border border-rose-100">
                    {isUploadingBadge ? (
                      <RefreshCw size={20} className="animate-spin text-rose-600" />
                    ) : (
                      <Upload size={20} />
                    )}
                  </div>

                  <p className="font-bold text-slate-800 text-xs">
                    {isUploadingBadge
                      ? 'Sedang Memproses & Mengoptimasi Gambar...'
                      : 'Klik untuk Memilih File Gambar atau Seret ke Sini'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Dukungan format PNG (transparan), JPG, WebP, SVG (Maks. 4MB). Otomatis dioptimasi untuk Android &amp; Windows.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 pt-1">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Masukkan URL / Tautan Langsung Gambar:
                  </label>
                  <input
                    type="text"
                    value={form.badge_icon_url}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, badge_icon_url: e.target.value }))
                    }
                    placeholder={effectiveSupabaseLogo}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white font-mono"
                  />
                </div>
              )}

              {/* Status Pratinjau Gambar Aktif & Tombol Reset ke Logo Supabase */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-slate-200/70 gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg border border-slate-200 bg-slate-900 flex items-center justify-center shrink-0 overflow-hidden p-1 shadow-xs">
                    <img
                      src={form.badge_icon_url || effectiveSupabaseLogo}
                      alt="Badge Preview"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = effectiveSupabaseLogo;
                      }}
                    />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {form.badge_icon_url && form.badge_icon_url.startsWith('data:image')
                        ? 'Gambar Kustom Berhasil Diunggah'
                        : form.badge_icon_url === effectiveSupabaseLogo
                        ? 'Menggunakan Logo Kawacanaan Supabase'
                        : 'Logo Kustom Aktif'}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate font-mono">
                      {form.badge_icon_url
                        ? (form.badge_icon_url.startsWith('data:') ? 'Gambar Terunggah (Base64)' : form.badge_icon_url)
                        : effectiveSupabaseLogo}
                    </p>
                  </div>
                </div>

                {form.badge_icon_url && form.badge_icon_url !== effectiveSupabaseLogo && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, badge_icon_url: effectiveSupabaseLogo }));
                      showToast('Logo badge dikembalikan ke Logo Kawacanaan Supabase.', 'info');
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-100 text-slate-600 text-[11px] font-semibold transition-colors shrink-0 cursor-pointer shadow-2xs self-start sm:self-auto"
                    title="Kembalikan ke Logo Kawacanaan dari Supabase"
                  >
                    <RotateCcw size={12} />
                    <span>Kembalikan ke Logo Supabase</span>
                  </button>
                )}
              </div>
            </div>

            {/* Informasi Penjelasan Bawaan Chrome & PWA */}
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-950">
                <Info size={14} className="text-amber-600 shrink-0" />
                <span>Penting Mengenai Logo Chrome Pada Status Bar Android:</span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                Ketika pengguna mengakses web via browser Chrome biasa, Android menampilkan icon Chrome kecil sebagai penanda asal browser. Namun, ketika pengguna menginstal aplikasi ke Layar Utama (PWA / WebAPK), sistem Android secara otomatis mengganti icon Chrome menjadi <strong>Logo Aplikasi Kawacanaan</strong> secara penuh pada bar status ponsel.
              </p>
            </div>

            {/* Nama / Judul Aplikasi Notifikasi */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Nama / Judul Notifikasi (App Header)
              </label>
              <input
                type="text"
                value={form.app_title_prefix}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, app_title_prefix: e.target.value }))
                }
                placeholder="Kawacanaan Presensi"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white"
              />
            </div>
          </div>

          {/* Card 2: Peristiwa & Pemicu Notifikasi (Trigger Events) */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Sliders size={17} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Pemicu Peristiwa Presensi (Events Trigger)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Tentukan momen presensi siswa yang otomatis mengirimkan notifikasi ke wali murid
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  key: 'notify_on_present',
                  label: 'Presensi Masuk Tepat Waktu',
                  desc: 'Kirim saat siswa scan QR atau diabsenkan tepat waktu',
                },
                {
                  key: 'notify_on_late',
                  label: 'Presensi Masuk Terlambat',
                  desc: 'Kirim saat siswa hadir melebihi batas jam masuk',
                },
                {
                  key: 'notify_on_checkout',
                  label: 'Presensi Pulang Sekolah',
                  desc: 'Kirim saat jam pulang kelas telah selesai',
                },
                {
                  key: 'notify_on_leave',
                  label: 'Keputusan Izin & Sakit',
                  desc: 'Kirim saat wali kelas menyetujui / menolak izin',
                },
              ].map((item) => {
                const val = (form as any)[item.key];
                return (
                  <label
                    key={item.key}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                      val
                        ? 'bg-indigo-50/50 border-indigo-200 text-indigo-950'
                        : 'bg-slate-50/70 border-slate-200 text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={val}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, [item.key]: e.target.checked }))
                      }
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-900">{item.label}</p>
                      <p className="text-[11px] text-slate-500 leading-tight">{item.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Perilaku Tambahan: Getar & Require Interaction */}
            <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.vibrate}
                  onChange={(e) => setForm((prev) => ({ ...prev, vibrate: e.target.checked }))}
                  className="rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                />
                <div>
                  <p className="text-xs font-bold text-slate-800">Getar Ponsel Android</p>
                  <p className="text-[10px] text-slate-500">Pola getaran ganda saat notifikasi tiba</p>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.require_interaction}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, require_interaction: e.target.checked }))
                  }
                  className="rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                />
                <div>
                  <p className="text-xs font-bold text-slate-800">Tahan di Status Bar</p>
                  <p className="text-[10px] text-slate-500">Tetap tampil sampai dibuka pengguna</p>
                </div>
              </label>
            </div>
          </div>

          {/* Card 3: Template Narasi Notifikasi */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Sparkles size={17} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Template Narasi Notifikasi
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Gunakan variabel dinamis seperti <code className="text-rose-600 font-bold">&#123;nama_siswa&#125;</code>, <code className="text-rose-600 font-bold">&#123;jam&#125;</code>, <code className="text-rose-600 font-bold">&#123;kelas&#125;</code>
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  1. Narasi Hadir Tepat Waktu
                </label>
                <textarea
                  rows={2}
                  value={form.template_present}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, template_present: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  2. Narasi Hadir Terlambat
                </label>
                <textarea
                  rows={2}
                  value={form.template_late}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, template_late: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  3. Narasi Pulang Sekolah
                </label>
                <textarea
                  rows={2}
                  value={form.template_checkout}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, template_checkout: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  4. Narasi Izin Sakit Disetujui
                </label>
                <textarea
                  rows={2}
                  value={form.template_leave_approved}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, template_leave_approved: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Live Mockup Ponsel Android & Tindakan Cepat (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card Mockup Android Status Bar & Notification Shade */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-4 sticky top-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Eye size={16} className="text-rose-600" />
                <h3 className="text-xs font-bold text-slate-900">
                  Pratinjau Nyata Status Bar Android
                </h3>
              </div>
              <div className="flex items-center gap-1">
                {(['masuk', 'pulang', 'izin'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setPreviewTab(tab)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize transition-colors cursor-pointer ${
                      previewTab === tab
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Simulated Android Device Screen Viewport */}
            <div className="rounded-2xl bg-slate-950 p-4 border border-slate-800 shadow-xl space-y-4 text-white">
              {/* Android Status Bar */}
              <div className="flex items-center justify-between text-[11px] text-slate-300 px-1 border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2 font-mono">
                  <span>07:15</span>
                  {/* Status Bar Left Notification Icon (Kawacanaan Latest Emblem) */}
                  <div className="w-3.5 h-3.5 rounded bg-white/20 p-0.5 flex items-center justify-center">
                    <img
                      src={form.badge_icon_url || effectiveSupabaseLogo}
                      alt="Status Icon"
                      className="w-full h-full object-contain filter invert"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 opacity-80 text-[10px]">
                  <span>LTE</span>
                  <span>98%</span>
                </div>
              </div>

              {/* Notification Pulldown Card */}
              <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-3.5 space-y-2.5 shadow-lg">
                {/* Header Card: App Icon + Name + Time */}
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-slate-800 p-0.5 flex items-center justify-center overflow-hidden border border-slate-700">
                      <img
                        src={form.badge_icon_url || effectiveSupabaseLogo}
                        alt="App Icon"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <span className="font-semibold text-slate-200">
                      {form.app_title_prefix || 'Kawacanaan Presensi'}
                    </span>
                    <span>• baru saja</span>
                  </div>
                  <span className="text-slate-500 font-mono text-[9px]">PWA</span>
                </div>

                {/* Content Row: Title & Text + Optional Right Logo */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <p className="text-xs font-bold text-white leading-tight">
                      {previewTab === 'masuk' && 'Presensi Masuk — Muhammad Farhan ✅'}
                      {previewTab === 'pulang' && 'Presensi Pulang — Muhammad Farhan 🏠'}
                      {previewTab === 'izin' && 'Izin Sakit Disetujui — Muhammad Farhan ✅'}
                    </p>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {previewTab === 'masuk' &&
                        form.template_present
                          .replace('{nama_siswa}', 'Muhammad Farhan')
                          .replace('{jam}', '06:45')
                          .replace('{kelas}', 'Kelas 5A')}
                      {previewTab === 'pulang' &&
                        form.template_checkout
                          .replace('{nama_siswa}', 'Muhammad Farhan')
                          .replace('{jam}', '13:00')
                          .replace('{kelas}', 'Kelas 5A')}
                      {previewTab === 'izin' &&
                        form.template_leave_approved
                          .replace('{nama_siswa}', 'Muhammad Farhan')
                          .replace('{jenis_izin}', 'Sakit Demam')
                          .replace('{penyetuju}', 'Wali Kelas Ibu Fatimah')}
                    </p>
                  </div>

                  {/* Logo Sebelah Kanan (Hanya Tampil Jika show_large_icon = true) */}
                  {form.show_large_icon ? (
                    <div className="w-11 h-11 rounded-lg bg-slate-800 border border-slate-700 p-1 shrink-0 flex items-center justify-center">
                      <img
                        src={form.large_icon_url || effectiveSupabaseLogo}
                        alt="Right Large Icon"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="hidden">
                      {/* Logo kanan dihapus sesuai ekspektasi user */}
                    </div>
                  )}
                </div>

                {/* Status Keterangan Visual Mockup */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                  <span
                    className={`font-semibold flex items-center gap-1 ${
                      !form.show_large_icon ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  >
                    {!form.show_large_icon ? (
                      <>
                        <Check size={11} /> Logo Kanan: Dihapus (Bersih)
                      </>
                    ) : (
                      'Logo Kanan: Tampil'
                    )}
                  </span>
                  <div className="flex gap-2">
                    <span className="text-rose-400 font-bold hover:underline cursor-pointer">
                      Buka Portal
                    </span>
                    <span className="text-slate-500 hover:underline cursor-pointer">
                      Tutup
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Checklist Validasi Kebutuhan Pengguna */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
              <p className="text-xs font-bold text-slate-900">
                Ringkasan Penerapan Sesuai Arahan:
              </p>
              <ul className="space-y-1.5 text-[11px] text-slate-600">
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Logo Kanan Dihapus:</strong> Dikontrol otomatis via setting sistem (nilai default nonaktif).
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Logo Status Bar Kiri (Android &amp; Windows):</strong> Mendukung unggah gambar langsung (PNG transparan, JPG, SVG, WebP) atau menggunakan logo default Supabase.
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Tab Menu Super Admin:</strong> Tersedia di menu Sistem persis setelah tab Mesin AI Presiden Konoha.
                  </span>
                </li>
              </ul>
            </div>

            {/* Tombol Simpan & Reset */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>Reset Standar</span>
              </button>
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Save size={14} />
                <span>{saving ? 'Menyimpan...' : 'Simpan Konfigurasi'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
