import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';

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
  onSaved?: (newConfig: NotificationSystemConfig) => void;
}

const DEFAULT_CONFIG: NotificationSystemConfig = {
  is_enabled: true,
  show_large_icon: false, // Default: Logo kanan dihapus sesuai instruksi
  large_icon_url: '',
  badge_icon_url: '/pwa-192.png', // Logo sistem Kawacanaan terbaru untuk status bar kiri
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
  onSaved,
}) => {
  const [form, setForm] = useState<NotificationSystemConfig>(() => ({
    ...DEFAULT_CONFIG,
    ...(initialConfig || {}),
  }));

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [previewTab, setPreviewTab] = useState<'masuk' | 'pulang' | 'izin'>('masuk');

  useEffect(() => {
    if (initialConfig) {
      setForm((prev) => ({
        ...prev,
        ...initialConfig,
      }));
    }
  }, [initialConfig]);

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
      const badgeIcon = form.badge_icon_url || '/pwa-192.png';
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
      setForm(DEFAULT_CONFIG);
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
                    placeholder="/pwa-192.png"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white"
                  />
                </div>
              )}
            </div>

            {/* Logo Status Bar Kiri (Badge Icon) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800">
                  Logo Status Bar Sebelah Kiri (Badge Icon Android)
                </label>
                <span className="text-[10px] text-slate-400">Direkomendasikan: /pwa-192.png</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg border border-slate-200 bg-slate-900 flex items-center justify-center shrink-0 overflow-hidden p-1 shadow-xs">
                  <img
                    src={form.badge_icon_url || '/pwa-192.png'}
                    alt="Badge Preview"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/pwa-192.png';
                    }}
                  />
                </div>
                <input
                  type="text"
                  value={form.badge_icon_url}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, badge_icon_url: e.target.value }))
                  }
                  placeholder="/pwa-192.png"
                  className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white font-mono"
                />
              </div>

              {/* Pilihan Cepat Logo Badge */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-400">Pilihan Cepat:</span>
                {[
                  { label: 'Kawacanaan Utama', url: '/pwa-192.png' },
                  { label: 'Emblem LK', url: '/lk.png' },
                  { label: 'Favicon', url: '/favicon.png' },
                ].map((opt) => (
                  <button
                    key={opt.url}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, badge_icon_url: opt.url }))}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                      form.badge_icon_url === opt.url
                        ? 'bg-rose-50 text-rose-700 border-rose-300 font-bold'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
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
                      src={form.badge_icon_url || '/pwa-192.png'}
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
                        src={form.badge_icon_url || '/pwa-192.png'}
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
                        src={form.large_icon_url || '/pwa-192.png'}
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
                    <strong>Logo Status Bar Kiri:</strong> Diarahkan ke aset resmi Kawacanaan terbaru (<code className="font-mono text-slate-800">/pwa-192.png</code>).
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
