import React, { useState, useEffect, useRef } from 'react';
import {
  SlidersHorizontal,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Save,
  RefreshCw,
  Building2,
  ShieldAlert,
  Info,
  Layers,
  FileCheck,
  Upload,
  Image as ImageIcon,
  Trash2,
  Eye,
  Link as LinkIcon,
  Sparkles,
  Check,
  Globe,
} from 'lucide-react';
import {
  DEFAULT_PLATFORM_LOGO,
  DEFAULT_PLATFORM_NAME,
  setPlatformBrand,
} from '../../utils/platformBranding';

export interface PlatformConfig {
  app_name: string;
  app_url: string;
  app_logo_url?: string;
  default_academic_year: string;
  default_semester: string;
  attendance_rules: {
    checkin_start: string;
    checkin_late: string;
    checkout_start: string;
    active_days_per_week: number;
    require_photo_for_leave: boolean;
  };
  maintenance_mode: {
    enabled: boolean;
    message: string;
    estimated_finish?: string;
  };
  workspace_rules?: any;
}

interface PlatformStats {
  schoolsCount?: number;
  studentsCount?: number;
  teachersCount?: number;
  classesCount?: number;
  updatedAt?: string;
}

interface Props {
  call: (action: string, payload?: any) => Promise<any>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  initialConfig?: PlatformConfig;
  platformStats?: PlatformStats;
  onSaved?: (newConfig: PlatformConfig) => void;
}

export const SystemPlatformTab: React.FC<Props> = ({
  call,
  showToast,
  initialConfig,
  platformStats,
  onSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoInputType, setLogoInputType] = useState<'upload' | 'url'>('upload');
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<PlatformConfig>(() => ({
    app_name: initialConfig?.app_name || DEFAULT_PLATFORM_NAME,
    app_url: initialConfig?.app_url || 'https://kawacanaanpresensi.vercel.app',
    app_logo_url: initialConfig?.app_logo_url || '',
    default_academic_year: initialConfig?.default_academic_year || '2026/2027',
    default_semester: initialConfig?.default_semester || '1 (Ganjil)',
    attendance_rules: {
      checkin_start: initialConfig?.attendance_rules?.checkin_start || '06:00',
      checkin_late: initialConfig?.attendance_rules?.checkin_late || '07:00',
      checkout_start: initialConfig?.attendance_rules?.checkout_start || '12:30',
      active_days_per_week: initialConfig?.attendance_rules?.active_days_per_week || 6,
      require_photo_for_leave: initialConfig?.attendance_rules?.require_photo_for_leave ?? true,
    },
    maintenance_mode: {
      enabled: initialConfig?.maintenance_mode?.enabled ?? false,
      message:
        initialConfig?.maintenance_mode?.message ||
        'Sistem Kawacanaan Presensi sedang dalam pemeliharaan rutin. Silakan kembali dalam beberapa saat.',
      estimated_finish: initialConfig?.maintenance_mode?.estimated_finish || '',
    },
  }));

  useEffect(() => {
    if (initialConfig) {
      setForm({
        app_name: initialConfig.app_name || DEFAULT_PLATFORM_NAME,
        app_url: initialConfig.app_url || 'https://kawacanaanpresensi.vercel.app',
        app_logo_url: initialConfig.app_logo_url || '',
        default_academic_year: initialConfig.default_academic_year || '2026/2027',
        default_semester: initialConfig.default_semester || '1 (Ganjil)',
        attendance_rules: {
          checkin_start: initialConfig.attendance_rules?.checkin_start || '06:00',
          checkin_late: initialConfig.attendance_rules?.checkin_late || '07:00',
          checkout_start: initialConfig.attendance_rules?.checkout_start || '12:30',
          active_days_per_week: initialConfig.attendance_rules?.active_days_per_week || 6,
          require_photo_for_leave: initialConfig.attendance_rules?.require_photo_for_leave ?? true,
        },
        maintenance_mode: {
          enabled: initialConfig.maintenance_mode?.enabled ?? false,
          message:
            initialConfig.maintenance_mode?.message ||
            'Sistem Kawacanaan Presensi sedang dalam pemeliharaan rutin. Silakan kembali dalam beberapa saat.',
          estimated_finish: initialConfig.maintenance_mode?.estimated_finish || '',
        },
      });
    }
  }, [initialConfig]);

  const handleLogoFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('File harus berupa gambar (PNG, JPG, SVG, WebP).', 'error');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      showToast('Ukuran file gambar maksimal 4MB.', 'error');
      return;
    }

    setIsProcessingLogo(true);
    try {
      if (file.type.includes('svg')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const res = e.target?.result as string;
          if (res) {
            setForm((prev) => ({ ...prev, app_logo_url: res }));
            showToast('Logo SVG berhasil diunggah. Klik "Simpan Konfigurasi" untuk menerapkan ke seluruh sistem.', 'info');
          }
          setIsProcessingLogo(false);
        };
        reader.onerror = () => {
          setIsProcessingLogo(false);
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
          // Kompresi dan skala proporsional maksimal 320x320 agar sangat tajam namun super ringan (< 40 KB)
          const maxDim = 320;
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
            // Gunakan format webp jika didukung untuk efisiensi ukuran, fallback ke png
            const webpUrl = canvas.toDataURL('image/webp', 0.85);
            const optimized = webpUrl.startsWith('data:image/webp') ? webpUrl : canvas.toDataURL('image/png', 0.85);
            setForm((prev) => ({ ...prev, app_logo_url: optimized }));
            showToast('Logo berhasil dioptimasi & dikompresi. Klik "Simpan Konfigurasi" untuk menyinkronkan ke seluruh sistem.', 'info');
          } else {
            setForm((prev) => ({ ...prev, app_logo_url: rawDataUrl }));
          }
          setIsProcessingLogo(false);
        };
        img.onerror = () => {
          setIsProcessingLogo(false);
          showToast('Gagal memuat gambar untuk dioptimasi.', 'error');
        };
        img.src = rawDataUrl;
      };
      reader.onerror = () => {
        setIsProcessingLogo(false);
        showToast('Gagal membaca file gambar.', 'error');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsProcessingLogo(false);
      showToast('Gagal memproses file logo.', 'error');
    }
  };

  const handleResetToDefault = () => {
    setForm((prev) => ({ ...prev, app_logo_url: '' }));
    showToast('Logo diatur kembali ke logo default Kawacanaan (/lk.png). Klik "Simpan Konfigurasi" untuk menerapkan.', 'info');
  };

  const activeLogoPreview = form.app_logo_url && form.app_logo_url.trim() ? form.app_logo_url.trim() : DEFAULT_PLATFORM_LOGO;
  const isCustomLogoActive = Boolean(form.app_logo_url && form.app_logo_url.trim() && form.app_logo_url !== DEFAULT_PLATFORM_LOGO);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await call('update_system_settings', {
        section: 'platform',
        data: form,
      });
      if (res.ok) {
        // Segera sinkronkan brand dan favicon secara reaktif ke seluruh aplikasi
        setPlatformBrand({
          logoUrl: form.app_logo_url || null,
          appName: form.app_name,
        });

        showToast('Konfigurasi platform & logo sistem berhasil disimpan dan disinkronkan ke seluruh aplikasi.', 'success');
        if (onSaved) onSaved(form);
      } else {
        throw new Error(res.error || 'Gagal menyimpan.');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan konfigurasi platform.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Banner Maintenance Alert jika aktif */}
      {form.maintenance_mode.enabled && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3.5 text-amber-800">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-amber-900 text-sm">Mode Pemeliharaan (Maintenance) Sedang Aktif</p>
            <p className="mt-0.5 text-amber-800">
              Pengguna non-superadmin yang membuka aplikasi akan melihat pesan pemeliharaan.
            </p>
          </div>
        </div>
      )}

      {/* Ringkasan Metrik Multi-Tenant Real-Time dari Database */}
      {platformStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Tenant Sekolah</span>
            <p className="text-xl font-black text-slate-900 mt-1 font-mono">{platformStats.schoolsCount || 0}</p>
            <span className="text-[10px] text-emerald-600 font-medium mt-0.5 block flex items-center gap-1">
              <CheckCircle2 size={11} /> Instansi Terhubung
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Siswa Terdaftar</span>
            <p className="text-xl font-black text-slate-900 mt-1 font-mono">{platformStats.studentsCount || 0}</p>
            <span className="text-[10px] text-indigo-600 font-medium mt-0.5 block">Akun Siswa Multi-Tenant</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Guru & Tendik Aktif</span>
            <p className="text-xl font-black text-slate-900 mt-1 font-mono">{platformStats.teachersCount || 0}</p>
            <span className="text-[10px] text-blue-600 font-medium mt-0.5 block">Wali Kelas & Mapel</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rombel Kelas</span>
            <p className="text-xl font-black text-slate-900 mt-1 font-mono">{platformStats.classesCount || 0}</p>
            <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">
              {platformStats.updatedAt ? `Update: ${new Date(platformStats.updatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB` : 'Sinkronisasi Otomatis'}
            </span>
          </div>
        </div>
      )}

      {/* Bagian: Logo Resmi Sistem Kawacanaan (Sinkronisasi Global) */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-sm">
              <ImageIcon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Logo Resmi Sistem Kawacanaan</h3>
                {isCustomLogoActive ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 size={11} /> Logo Kustom Aktif
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    Logo Default Kawacanaan (/lk.png)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Logo utama platform. Saat logo diubah, seluruh komponen (Header, Sidebar Superadmin, Landing Page, Modal Login, Portal, dan Favicon) otomatis tersinkronisasi.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {isCustomLogoActive && (
              <button
                type="button"
                onClick={handleResetToDefault}
                className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100/80 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Hapus logo kustom dan kembalikan ke logo default /lk.png"
              >
                <Trash2 size={13} />
                Kembalikan Default
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Kolom Kiri: Pengunggahan File & Input */}
          <div className="lg:col-span-6 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Metode Input Logo:</span>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
                <button
                  type="button"
                  onClick={() => setLogoInputType('upload')}
                  className={`px-3 py-1 rounded-md font-medium transition-all ${
                    logoInputType === 'upload'
                      ? 'bg-white text-indigo-700 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Unggah File
                </button>
                <button
                  type="button"
                  onClick={() => setLogoInputType('url')}
                  className={`px-3 py-1 rounded-md font-medium transition-all ${
                    logoInputType === 'url'
                      ? 'bg-white text-indigo-700 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tautan URL
                </button>
              </div>
            </div>

            {logoInputType === 'upload' ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  const file = e.dataTransfer?.files?.[0];
                  if (file) handleLogoFile(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-indigo-500 bg-indigo-50/60'
                    : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/80 bg-slate-50/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoFile(file);
                  }}
                />

                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3 shadow-inner">
                  {isProcessingLogo ? (
                    <RefreshCw size={22} className="animate-spin text-indigo-600" />
                  ) : (
                    <Upload size={22} />
                  )}
                </div>

                <p className="font-bold text-slate-800 text-xs">
                  {isProcessingLogo ? 'Sedang Memproses & Mengoptimasi...' : 'Klik untuk Pilih File atau Seret ke Sini'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                  Mendukung PNG transparan, JPG, WebP, atau SVG. Disarankan rasio 1:1 (persegi) dengan latar transparan.
                </p>

                <div className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-semibold border border-indigo-200/60">
                  <Sparkles size={11} /> Auto-Kompresi Tajam & Presisi Tinggi
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block font-semibold text-slate-700">URL Gambar Logo (HTTPS)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <LinkIcon size={14} />
                  </div>
                  <input
                    type="url"
                    value={form.app_logo_url || ''}
                    onChange={(e) => setForm({ ...form, app_logo_url: e.target.value })}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-slate-800 font-mono text-[11px]"
                    placeholder="https://cdn.example.com/logo-kawacanaan.png"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Pastikan URL dapat diakses secara publik dan mendukung HTTPS (CORS friendly).
                </p>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 flex items-start gap-2.5 text-blue-900">
              <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <p className="font-semibold text-blue-950">Integrasi Otomatis:</p>
                <p className="mt-0.5 text-blue-800">
                  Setelah menekan <strong>Simpan Konfigurasi</strong>, logo baru langsung diterapkan pada seluruh komponen tanpa perlu reload ulang aplikasi.
                </p>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Multi-Surface Live Preview */}
          <div className="lg:col-span-6 space-y-3 text-xs">
            <span className="font-semibold text-slate-700 block">
              Pratinjau Multi-Permukaan (Simulasi Tampilan Nyata):
            </span>

            {/* Preview 1: Super Admin Dark Sidebar */}
            <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800/80 shadow-md">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider pb-2 border-b border-slate-800/80 mb-2.5">
                <span>Sidebar Super Admin Console (Latar Gelap)</span>
                <span className="text-indigo-400">Preview</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-center p-1.5 shrink-0">
                  <img
                    src={activeLogoPreview}
                    alt="Preview Dark"
                    className="w-full h-full object-contain drop-shadow"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = DEFAULT_PLATFORM_LOGO;
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-white text-sm tracking-tight truncate">
                      {form.app_name ? form.app_name.toUpperCase() : 'KAWACANAAN'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      SaaS
                    </span>
                  </div>
                  <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mt-0.5 truncate">
                    SUPER ADMIN CONSOLE
                  </p>
                </div>
              </div>
            </div>

            {/* Preview 2: Header Aplikasi / Navbar Guru (Latar Terang) */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider pb-2 border-b border-slate-200 mb-2.5">
                <span>Header Navigasi & Navbar (Latar Terang)</span>
                <span className="text-blue-600">Preview</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-center p-1.5 shrink-0">
                  <img
                    src={activeLogoPreview}
                    alt="Preview Light"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = DEFAULT_PLATFORM_LOGO;
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-[#1E40AF] text-sm leading-tight truncate">
                    {form.app_name || 'Kawacanaan Presensi'}
                  </h4>
                  <p className="text-[9px] font-bold tracking-wider text-slate-500 uppercase mt-0.5 truncate">
                    PORTAL PRESENSI SISWA & MULTI-TENANT
                  </p>
                </div>
              </div>
            </div>

            {/* Preview 3: Favicon Tab Browser */}
            <div className="bg-slate-100 rounded-xl p-3 border border-slate-200">
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">
                <span>Favicon Tab Browser</span>
                <Globe size={12} className="text-slate-400" />
              </div>
              <div className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs max-w-full">
                <img
                  src={activeLogoPreview}
                  alt="Favicon"
                  className="w-4 h-4 object-contain rounded-xs shrink-0"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = DEFAULT_PLATFORM_LOGO;
                  }}
                />
                <span className="text-[11px] font-medium text-slate-700 truncate max-w-[200px]">
                  {form.app_name} | Sistem Presensi
                </span>
                <span className="text-slate-400 text-[10px] ml-1">×</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bagian 1: Identitas & Domain Platform */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <SlidersHorizontal size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Identitas & Lingkungan Platform</h3>
            <p className="text-xs text-slate-500">Konfigurasi nama aplikasi, domain publik, dan tahun ajaran acuan nasional.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Nama Aplikasi Sistem</label>
            <input
              type="text"
              value={form.app_name}
              onChange={(e) => setForm({ ...form, app_name: e.target.value })}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-slate-800 font-medium"
              placeholder="Contoh: Kawacanaan Presensi"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">URL Aplikasi (Production Domain)</label>
            <input
              type="url"
              value={form.app_url}
              onChange={(e) => setForm({ ...form, app_url: e.target.value })}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-slate-800 font-medium font-mono text-[11px]"
              placeholder="https://kawacanaanpresensi.vercel.app"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Tahun Ajaran Default (Sekolah Baru)</label>
            <input
              type="text"
              value={form.default_academic_year}
              onChange={(e) => setForm({ ...form, default_academic_year: e.target.value })}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-slate-800 font-medium"
              placeholder="2026/2027"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Semester Acuan Default</label>
            <select
              value={form.default_semester}
              onChange={(e) => setForm({ ...form, default_semester: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-slate-800 font-medium bg-white"
            >
              <option value="1 (Ganjil)">Semester 1 (Ganjil)</option>
              <option value="2 (Genap)">Semester 2 (Genap)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bagian 2: Standar Presensi Bawaan Nasional */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Clock size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Standar Jam & Aturan Presensi Bawaan</h3>
            <p className="text-xs text-slate-500">Nilai default yang otomatis diterapkan pada saat sekolah baru mendaftarkan instansinya.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Jam Masuk Dibuka</label>
            <input
              type="time"
              value={form.attendance_rules.checkin_start}
              onChange={(e) =>
                setForm({
                  ...form,
                  attendance_rules: { ...form.attendance_rules, checkin_start: e.target.value },
                })
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-slate-800 font-medium"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Batas Toleransi Terlambat</label>
            <input
              type="time"
              value={form.attendance_rules.checkin_late}
              onChange={(e) =>
                setForm({
                  ...form,
                  attendance_rules: { ...form.attendance_rules, checkin_late: e.target.value },
                })
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-slate-800 font-medium"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Jam Pulang Dibuka</label>
            <input
              type="time"
              value={form.attendance_rules.checkout_start}
              onChange={(e) =>
                setForm({
                  ...form,
                  attendance_rules: { ...form.attendance_rules, checkout_start: e.target.value },
                })
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-slate-800 font-medium"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Hari Efektif Belajar per Minggu</label>
            <select
              value={form.attendance_rules.active_days_per_week}
              onChange={(e) =>
                setForm({
                  ...form,
                  attendance_rules: {
                    ...form.attendance_rules,
                    active_days_per_week: Number(e.target.value),
                  },
                })
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-slate-800 font-medium bg-white"
            >
              <option value={5}>5 Hari (Senin - Jumat)</option>
              <option value={6}>6 Hari (Senin - Sabtu)</option>
            </select>
          </div>

          <div className="sm:col-span-2 flex items-center gap-3 pt-6">
            <input
              type="checkbox"
              id="require_photo"
              checked={form.attendance_rules.require_photo_for_leave}
              onChange={(e) =>
                setForm({
                  ...form,
                  attendance_rules: {
                    ...form.attendance_rules,
                    require_photo_for_leave: e.target.checked,
                  },
                })
              }
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="require_photo" className="text-slate-700 font-semibold cursor-pointer select-none">
              Wajibkan Unggah Foto Bukti / Surat Dokter untuk Izin & Sakit Siswa
            </label>
          </div>
        </div>
      </div>

      {/* Bagian 3: Mode Pemeliharaan Sistem (Maintenance Mode) */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <ShieldAlert size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Mode Pemeliharaan (Maintenance Mode)</h3>
              <p className="text-xs text-slate-500">Batasi akses seluruh tenant saat perbaikan platform berlangsung.</p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={form.maintenance_mode.enabled}
              onChange={(e) =>
                setForm({
                  ...form,
                  maintenance_mode: { ...form.maintenance_mode, enabled: e.target.checked },
                })
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
          </label>
        </div>

        {form.maintenance_mode.enabled && (
          <div className="space-y-4 pt-2 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Pesan Pemeliharaan ke Pengguna</label>
              <textarea
                rows={3}
                value={form.maintenance_mode.message}
                onChange={(e) =>
                  setForm({
                    ...form,
                    maintenance_mode: { ...form.maintenance_mode, message: e.target.value },
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 outline-none text-slate-800 font-medium"
                placeholder="Tuliskan pesan pemeliharaan yang akan tampil di halaman pengunjung..."
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Estimasi Selesai (Opsional)</label>
              <input
                type="text"
                value={form.maintenance_mode.estimated_finish || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    maintenance_mode: { ...form.maintenance_mode, estimated_finish: e.target.value },
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 outline-none text-slate-800 font-medium"
                placeholder="Contoh: 23 September 2026, Pukul 15:00 WIB"
              />
            </div>
          </div>
        )}
      </div>

      {/* Bagian 4: Ketentuan Ruang Kerja Sistem */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Layers size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Regulasi Ruang Kerja Multi-Tenant</h3>
            <p className="text-xs text-slate-500">Prinsip arsitektur pemisahan ruang kerja sekolah dan ruang kerja individu.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-purple-100 bg-purple-50/40">
            <div className="flex items-center gap-2 mb-2 font-bold text-purple-900">
              <Building2 size={16} />
              Ruang Kerja Sekolah (Institutional Workspace)
            </div>
            <p className="text-purple-800 text-[11px] leading-relaxed">
              Opsi bergabung kelas institusi terdaftar pada paket Sekolah Pro atau registrasi resmi sekolah. Mendukung multi-guru, operator, rekap per rombel paralel, dan integrasi WhatsApp sekolah.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40">
            <div className="flex items-center gap-2 mb-2 font-bold text-indigo-900">
              <FileCheck size={16} />
              Ruang Kerja Individu (Personal Workspace)
            </div>
            <p className="text-indigo-800 text-[11px] leading-relaxed">
              Opsi guru kelola kelas mandiri. Memiliki kemandirian penuh untuk rombel kelas tunggal tanpa terikat pada administrasi sekolah induk formal.
            </p>
          </div>
        </div>
      </div>

      {/* Tombol Simpan Konfigurasi */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all cursor-pointer"
        >
          {saving ? (
            <>
              <RefreshCw size={15} className="animate-spin" />
              Menyimpan Perubahan...
            </>
          ) : (
            <>
              <Save size={15} />
              Simpan Konfigurasi Platform & Logo
            </>
          )}
        </button>
      </div>
    </form>
  );
};
