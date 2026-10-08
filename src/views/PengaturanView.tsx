import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { SystemConfig } from '../types';
import { SchoolLogo } from '../components/SchoolLogo';
import {
  ArrowLeft,
  Settings,
  Upload,
  Save,
  Clock,
  Smartphone,
  FileText,
  Image,
  Trash2,
  Eye,
  Award,
  Sparkles,
  MapPin,
  Calendar,
  Lock,
  ShieldCheck,
  Building2,
  Users,
  Layers,
  Globe,
  Info,
  MessageSquare,
} from 'lucide-react';

// Sample Banner Generator for official Kop Surat
const generateSampleKopSurat = (
  namaSekolah = 'SD NEGERI 01 CONTOH',
  alamat = 'Jl. Pendidikan No. 123, Kel. Merdeka, Kec. Nusantara, Kota Administrasi Jakarta Pusat'
): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 230" width="1200" height="230">
    <rect width="100%" height="100%" fill="#ffffff"/>
    
    <!-- Left Emblem / Tut Wuri Handayani -->
    <g transform="translate(35, 20)">
      <circle cx="70" cy="70" r="65" fill="#7A1D1D" stroke="#D39F38" stroke-width="3"/>
      <circle cx="70" cy="70" r="55" fill="#991B1B" stroke="#FDE047" stroke-width="1.5" stroke-dasharray="3,2"/>
      <path d="M70 30 C85 30 100 42 100 65 C100 90 70 105 70 105 C70 105 40 90 40 65 C40 42 55 30 70 30 Z" fill="#5B1313" stroke="#FDE047" stroke-width="1.5"/>
      <polygon points="70,42 74,54 86,54 76,62 80,74 70,66 60,74 64,62 54,54 66,54" fill="#FDE047"/>
      <path d="M52 82 Q70 76 70 86 Q70 76 88 82 L86 92 Q70 86 70 96 Q70 86 54 92 Z" fill="#FFFFFF" stroke="#D39F38" stroke-width="1"/>
      <rect x="35" y="105" width="70" height="15" rx="4" fill="#FEF08A" stroke="#CA8A04" stroke-width="1"/>
      <text x="70" y="116" font-family="Arial, sans-serif" font-size="7.5" font-weight="bold" fill="#78350F" text-anchor="middle">TUT WURI HANDAYANI</text>
    </g>

    <!-- Header Text (Centered) -->
    <g text-anchor="middle" font-family="Arial, Helvetica, sans-serif">
      <text x="615" y="42" font-size="19" font-weight="bold" fill="#1E293B" letter-spacing="1">PEMERINTAH PROVINSI DAERAH KHUSUS IBUKOTA JAKARTA</text>
      <text x="615" y="70" font-size="21" font-weight="bold" fill="#0F172A" letter-spacing="1.5">DINAS PENDIDIKAN</text>
      <text x="615" y="108" font-size="28" font-weight="900" fill="#0284C7" letter-spacing="1.2">${(namaSekolah || 'SD NEGERI 01 CONTOH').toUpperCase()}</text>
      <text x="615" y="136" font-size="14" font-weight="500" fill="#475569">${alamat || 'Jl. Pendidikan No. 123, Kel. Merdeka, Kec. Nusantara, Kota Administrasi Jakarta Pusat'}</text>
      <text x="615" y="158" font-size="13" font-weight="500" fill="#64748B">Telp: (021) 12345678 | Email: info@sekolah.sch.id | NPSN: 20104501</text>
    </g>

    <!-- Right Emblem / City Emblem Placeholder -->
    <g transform="translate(1025, 20)">
      <circle cx="70" cy="70" r="65" fill="#0369A1" stroke="#BAE6FD" stroke-width="3"/>
      <polygon points="70,30 100,50 100,90 70,110 40,90 40,50" fill="#0284C7" stroke="#FDE047" stroke-width="2"/>
      <polygon points="70,45 80,68 105,68 85,82 92,105 70,90 48,105 55,82 35,68 60,68" fill="#FDE047"/>
    </g>

    <!-- Double Line Divider -->
    <line x1="35" y1="188" x2="1165" y2="188" stroke="#0F172A" stroke-width="3.5"/>
    <line x1="35" y1="195" x2="1165" y2="195" stroke="#0F172A" stroke-width="1.2"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

// Sample School Logo Generator
const generateSampleLogo = (): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
    <circle cx="100" cy="100" r="95" fill="#1E3A8A" stroke="#F59E0B" stroke-width="6"/>
    <circle cx="100" cy="100" r="82" fill="#1E40AF" stroke="#FDE68A" stroke-width="2" stroke-dasharray="4 3"/>
    
    <!-- Shield -->
    <path d="M100 35 C130 35 155 52 155 90 C155 130 100 160 100 160 C100 160 45 130 45 90 C45 52 70 35 100 35 Z" fill="#1D4ED8" stroke="#FDE047" stroke-width="3"/>
    
    <!-- Star -->
    <polygon points="100,50 106,68 125,68 110,80 116,98 100,86 84,98 90,80 75,68 94,68" fill="#FDE047" stroke="#D97706" stroke-width="1.5"/>
    
    <!-- Book -->
    <path d="M72 110 Q100 102 100 115 Q100 102 128 110 L126 128 Q100 120 100 134 Q100 120 74 128 Z" fill="#FFFFFF" stroke="#F59E0B" stroke-width="2"/>
    
    <!-- Ribbon -->
    <path d="M40 148 Q100 170 160 148 L155 165 Q100 188 45 165 Z" fill="#FEF3C7" stroke="#D97706" stroke-width="2"/>
    <text x="100" y="161" font-family="Arial, sans-serif" font-size="10" font-weight="900" fill="#78350F" text-anchor="middle">SEKOLAH CONTOH</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const PengaturanView: React.FC = () => {
  const {
    systemConfig,
    updateSystemConfig,
    schoolProfile,
    setActiveView,
    showToast,
    currentUser,
    activeWorkspace,
    requestFeatureAccess,
    isTeacherPro,
  } = useApp();

  const isPersonalWorkspace =
    activeWorkspace?.workspaceType === 'personal' ||
    activeWorkspace?.workspaceType === 'individu' ||
    currentUser?.subscriptionPlan === 'guru_uji_coba' ||
    currentUser?.subscriptionPlan === 'teacher' ||
    currentUser?.subscriptionPlan === 'guru_pro' ||
    currentUser?.subscriptionPlan === 'mulai' ||
    currentUser?.subscriptionPlan === 'guru_gratis' ||
    (!currentUser?.schoolId && currentUser?.role !== 'SUPER_ADMIN');

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';

  const [formData, setFormData] = useState<SystemConfig>(() => {
    const initialSelfAttendance = systemConfig.studentSelfAttendanceEnabled !== false;

    return {
      ...systemConfig,
      studentSelfAttendanceEnabled: initialSelfAttendance,
    };
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const kopInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast('Ukuran logo maksimal 2MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        if (uploadEvent.target?.result) {
          setFormData((prev) => ({
            ...prev,
            schoolLogoUrl: uploadEvent.target!.result as string,
          }));
          showToast('Logo sekolah berhasil dipilih', 'success');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplySampleLogo = () => {
    const sampleLogo = generateSampleLogo();
    setFormData((prev) => ({
      ...prev,
      schoolLogoUrl: sampleLogo,
    }));
    showToast('Contoh logo resmi sekolah berhasil diterapkan sebagai sampel', 'success');
  };

  const handleKopUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        showToast('Ukuran gambar kop surat maksimal 3MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        if (uploadEvent.target?.result) {
          const rawDataUrl = uploadEvent.target.result as string;
          const img = document.createElement('img');
          img.onload = () => {
            setFormData((prev) => ({
              ...prev,
              letterheadImageUrl: rawDataUrl,
              letterheadType: 'custom_image',
              showLetterhead: true,
            }));
            showToast('Kop surat berhasil diunggah & otomatis disesuaikan dengan ukuran cetak A4', 'success');
          };
          img.src = rawDataUrl;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplySampleKop = () => {
    const sampleKop = generateSampleKopSurat(
      schoolProfile.namaSekolah || 'SD NEGERI 01 CONTOH',
      schoolProfile.alamat || 'Jl. Pendidikan No. 123, Kel. Merdeka, Kec. Nusantara, Kota Administrasi Jakarta Pusat'
    );
    setFormData((prev) => ({
      ...prev,
      letterheadImageUrl: sampleKop,
      letterheadType: 'custom_image',
      showLetterhead: true,
    }));
    showToast('Sampel gambar banner kop surat sekolah resmi berhasil dimuat', 'success');
  };

  const handleRemoveKop = () => {
    setFormData((prev) => ({
      ...prev,
      letterheadImageUrl: '',
      letterheadType: 'standard_text',
    }));
    showToast('Kop surat gambar dihapus, beralih ke kop teks standar', 'info');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.studentSelfAttendanceEnabled) {
      const allowed = requestFeatureAccess(
        'portal_siswa',
        'Presensi Mandiri Siswa (Portal Siswa HP)',
        'Fitur ini tersedia di Paket Guru. Upgrade sekarang untuk akses penuh: tambah kelas, laporan lengkap, dan manajemen guru.'
      );
      if (!allowed) {
        return;
      }
    }
    updateSystemConfig(formData);
  };

  return (
    <div className="w-full max-w-5xl 2xl:max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 animate-in fade-in duration-200 pb-20">
      {/* Top Bar */}
      <div>
        <button
          onClick={() => setActiveView('dashboard')}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs min-h-[38px] cursor-pointer"
          id="btn-back-dashboard"
        >
          <ArrowLeft size={14} />
          <span>Dashboard</span>
        </button>
      </div>

      {/* Main Header */}
      <div className="flex items-center gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
          <Settings size={22} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900">Pengaturan Sistem</h1>
            {isPersonalWorkspace && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                Ruang Kerja Individu
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Konfigurasi parameter operasional presensi mandiri real-time siswa, logo resmi sekolah, format kop surat resmi, dan parameter cetak laporan.
          </p>
        </div>
      </div>

      {isPersonalWorkspace && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 text-blue-900 rounded-2xl text-xs font-medium">
          <ShieldCheck size={18} className="text-blue-600 shrink-0" />
          <span>
            <strong>Mode Ruang Kerja Individu:</strong> Anda memiliki akses penuh untuk mengatur presensi mandiri siswa, batas jam masuk/pulang, logo, banner kop surat, dan parameter tanggal/tempat cetak laporan kelas Anda. Fitur yang menyangkut tata kelola multi-pengguna dan kebijakan institusi sekolah dikunci.
          </span>
        </div>
      )}

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Section 1: Presensi Mandiri Siswa (Real-Time HP) */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 lg:p-8 space-y-5">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                <Smartphone size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Presensi Mandiri Siswa (Integrasi Waktu Real-Time HP)
                </h2>
                <p className="text-xs text-slate-500">
                  Kelola izin akses dan batas jam penekanan tombol Masuk & Pulang oleh siswa dari HP masing-masing.
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-block px-2.5 py-1 text-[10px] font-extrabold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              REAL-TIME
            </span>
          </div>

          {/* Toggle Aktifkan Presensi Mandiri */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-slate-900">
                  Izinkan Siswa Presensi Mandiri Lewat HP
                </p>
                {formData.studentSelfAttendanceEnabled ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                    AKTIF (DEFAULT ON)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-600">
                    NONAKTIF
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Sistem memberikan setelan bawaan <strong>Aktif (On)</strong>. Siswa yang login dapat melakukan presensi mandiri atau scan barcode QR. Matikan opsi ini jika presensi hanya boleh dicatat langsung oleh guru atau wali kelas.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(formData.studentSelfAttendanceEnabled)}
              onClick={() => {
                const willEnable = !formData.studentSelfAttendanceEnabled;
                if (willEnable) {
                  const allowed = requestFeatureAccess(
                    'portal_siswa',
                    'Presensi Mandiri Siswa (Portal Siswa HP)',
                    'Fitur ini tersedia di Paket Guru. Upgrade sekarang untuk akses penuh: presensi mandiri siswa lewat HP, tambah kelas, dan rekapitulasi lengkap.'
                  );
                  if (!allowed) {
                    return;
                  }
                }
                setFormData((prev) => ({ ...prev, studentSelfAttendanceEnabled: willEnable }));
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                formData.studentSelfAttendanceEnabled ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
              id="toggle-student-self-attendance"
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  formData.studentSelfAttendanceEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Pengaturan Jam Real-time Siswa */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
            {/* Jam Buka Presensi Masuk */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                JAM BUKA PRESENSI MASUK
              </label>
              <div className="relative flex items-center">
                <input
                  type="time"
                  name="checkInStartTime"
                  value={formData.checkInStartTime || '06:00'}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 outline-none transition-all min-h-[42px] cursor-pointer"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Tombol masuk aktif mulai jam ini</p>
            </div>

            {/* Batas Jam Masuk Tepat Waktu */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                BATAS MASUK TEPAT WAKTU
              </label>
              <div className="relative flex items-center">
                <input
                  type="time"
                  name="checkInDeadlineTime"
                  value={formData.checkInDeadlineTime || '07:00'}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 outline-none transition-all min-h-[42px] cursor-pointer"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Lewat dari jam ini dihitung terlambat</p>
            </div>

            {/* Jam Buka Presensi Pulang */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                JAM BUKA PRESENSI PULANG
              </label>
              <div className="relative flex items-center">
                <input
                  type="time"
                  name="checkOutStartTime"
                  value={formData.checkOutStartTime || '12:30'}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 outline-none transition-all min-h-[42px] cursor-pointer"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Tombol pulang aktif saat jam pulang tiba</p>
            </div>
          </div>

          {/* Toggle Auto Mark Late */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-900">
                Tandai Otomatis Catatan &quot;Terlambat&quot;
              </p>
              <p className="text-xs text-slate-500">
                Jika siswa menekan tombol Masuk setelah batas jam masuk tepat waktu ({formData.checkInDeadlineTime || '07:00'}), sistem otomatis menambahkan keterangan Terlambat pada catatan presensi.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
              <input
                type="checkbox"
                name="autoMarkLate"
                checked={formData.autoMarkLate ?? true}
                onChange={handleChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Section 2: Logo Resmi Sekolah (Tersedia di Menu Pengaturan) */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                <Award size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Logo Resmi Sekolah
                </h2>
                <p className="text-xs text-slate-500">
                  Kelola file logo resmi sekolah untuk kop surat cetak laporan, header navigasi, dan kartu portal siswa.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
              IDENTITAS RESMI
            </span>
          </div>

          {/* Logo Sekolah Upload Box */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white border-2 border-slate-200 flex items-center justify-center p-2.5 shadow-xs shrink-0 relative group">
              {formData.schoolLogoUrl ? (
                <img
                  src={formData.schoolLogoUrl}
                  alt="Logo Preview"
                  className="w-full h-full object-contain rounded-xl"
                />
              ) : (
                <SchoolLogo size={72} />
              )}
            </div>

            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div>
                <h3 className="text-xs font-bold text-slate-900 flex items-center justify-center sm:justify-start gap-1.5">
                  <span>File Logo Sekolah Saat Ini</span>
                  {formData.schoolLogoUrl ? (
                    <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      Logo Kustom Aktif
                    </span>
                  ) : (
                    <span className="text-[10px] font-extrabold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-md">
                      Logo Default Sistem
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Unggah file gambar logo sekolah Anda (disarankan format PNG / SVG / JPG dengan latar transparan, ukuran maksimal 2MB).
                </p>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleLogoUpload}
                accept="image/*"
                className="hidden"
              />

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 min-h-[40px] cursor-pointer"
                >
                  <Upload size={15} />
                  <span>{formData.schoolLogoUrl ? 'Ganti Logo Sekolah' : 'Unggah File Logo'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleApplySampleLogo}
                  className="px-3.5 py-2.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl transition-colors min-h-[40px] flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Sparkles size={14} className="text-amber-500" />
                  <span>Gunakan Contoh Logo</span>
                </button>

                {formData.schoolLogoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, schoolLogoUrl: '' }));
                      showToast('Logo kustom dihapus, kembali ke logo default sekolah', 'info');
                    }}
                    className="px-3.5 py-2.5 text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold rounded-xl transition-colors min-h-[40px] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 size={14} />
                    <span>Pakai Logo Default</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Pengaturan & Upload Kop Surat Resmi (Integrasi Cetak Laporan) */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 lg:p-8 space-y-5">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
                <FileText size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Kop Surat Resmi (Terintegrasi Hasil Cetakan / Printout)
                </h2>
                <p className="text-xs text-slate-500">
                  Pilih model kop surat teks standar atau upload gambar banner kop resmi sekolah untuk seluruh cetakan laporan.
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-block px-2.5 py-1 text-[10px] font-extrabold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              CETAK / PRINTOUT
            </span>
          </div>

          {/* Toggle Aktifkan Kop Surat pada Cetakan */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-900">
                Sertakan Kop Surat Pada Semua Hasil Cetakan
              </p>
              <p className="text-xs text-slate-500">
                Menampilkan bagian kepala surat (Kop) pada Laporan Harian, Mingguan, Bulanan, dan Semester.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
              <input
                type="checkbox"
                name="showLetterhead"
                checked={formData.showLetterhead ?? true}
                onChange={handleChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Pilih Tipe Kop Surat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div
              onClick={() => setFormData((prev) => ({ ...prev, letterheadType: 'standard_text' }))}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                (formData.letterheadType || 'standard_text') === 'standard_text'
                  ? 'border-blue-600 bg-blue-50/40 text-blue-900 shadow-xs'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <FileText size={15} /> 1. Format Teks Standar Dinas
                  </span>
                  {(formData.letterheadType || 'standard_text') === 'standard_text' && (
                    <span className="text-[10px] font-black uppercase text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                      Aktif
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Menggunakan tata letak logo sekolah dan teks formal Dinas Pendidikan, Nama Sekolah ({schoolProfile.namaSekolah || 'SD Negeri 01 Contoh'}), alamat lengkap ({schoolProfile.alamat || 'Jl. Pendidikan No. 123, Kel. Merdeka, Kec. Nusantara, Kota Jakarta'}), dan garis ganda resmi.
                </p>
              </div>
            </div>

            <div
              onClick={() => {
                if (formData.letterheadImageUrl) {
                  setFormData((prev) => ({ ...prev, letterheadType: 'custom_image' }));
                } else {
                  kopInputRef.current?.click();
                }
              }}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                formData.letterheadType === 'custom_image'
                  ? 'border-amber-500 bg-amber-50/40 text-amber-900 shadow-xs'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Image size={15} /> 2. Upload Gambar Banner Kop Resmi
                  </span>
                  {formData.letterheadType === 'custom_image' && (
                    <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      Aktif
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Mengganti kepala surat dengan gambar utuh (scan/desain banner kop resmi sekolah Anda) pada seluruh cetakan dokumen.
                </p>
              </div>
            </div>
          </div>

          {/* Upload Area Kop Surat */}
          <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Image size={15} className="text-amber-600" />
                  <span>File Gambar Kop Surat Sekolah</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Unggah gambar banner kop surat (disarankan rasio memanjang horizontal, format PNG/JPG maks 3MB).
                </p>
              </div>

              <input
                type="file"
                ref={kopInputRef}
                onChange={handleKopUpload}
                accept="image/*"
                className="hidden"
              />

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => kopInputRef.current?.click()}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 min-h-[38px] cursor-pointer"
                >
                  <Upload size={14} />
                  <span>{formData.letterheadImageUrl ? 'Ganti Gambar Kop' : 'Unggah Kop Surat'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleApplySampleKop}
                  className="px-3.5 py-2.5 bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold rounded-xl transition-colors min-h-[38px] flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Sparkles size={14} className="text-amber-500" />
                  <span>Gunakan Contoh Banner Kop</span>
                </button>

                {formData.letterheadImageUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveKop}
                    className="p-2.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                    title="Hapus Gambar Kop"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Preview Box Kop Surat dengan Simulasi Kertas A4 */}
            <div className="border border-slate-300 rounded-xl p-3 sm:p-4 bg-slate-50 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-bold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Eye size={14} className="text-blue-600" />
                  <span>Pratinjau Kertas A4 (Lebar 210 mm)</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-800 font-extrabold bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-200">
                  ✓ Penyesuaian Otomatis A4 Aktif
                </span>
              </div>

              <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-3 sm:p-4 transition-all overflow-hidden">
                {formData.letterheadType === 'custom_image' && formData.letterheadImageUrl ? (
                  <div className="w-full bg-white rounded-lg overflow-hidden border-b-2 border-slate-900 pb-2 flex flex-col items-center justify-center">
                    <img
                      src={formData.letterheadImageUrl}
                      alt="Preview Kop Surat"
                      className="w-full max-h-36 object-contain block mx-auto"
                    />
                    <span className="text-[9px] text-slate-400 font-medium mt-1.5">
                      Ukuran gambar otomatis diskalakan 100% mengisi lebar kepala halaman A4 tanpa distorsi
                    </span>
                  </div>
                ) : (
                  <div className="w-full bg-white p-2 rounded-lg text-center font-sans">
                    <div className="flex items-center justify-center gap-3 sm:gap-4 pb-2 border-b-2 border-slate-900">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 flex items-center justify-center">
                        {formData.schoolLogoUrl ? (
                          <img src={formData.schoolLogoUrl} alt="Logo" className="w-full h-full object-contain" />
                        ) : (
                          <SchoolLogo size={48} />
                        )}
                      </div>
                      <div className="text-center flex-1">
                        <p className="text-[9px] font-bold uppercase text-slate-600 leading-tight">
                          PEMERINTAH PROVINSI DAERAH KHUSUS IBUKOTA JAKARTA
                        </p>
                        <p className="text-[9px] font-bold uppercase text-slate-600 leading-tight">
                          DINAS PENDIDIKAN
                        </p>
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase">
                          {schoolProfile.namaSekolah || 'SD NEGERI 01 CONTOH'}
                        </h4>
                        <p className="text-[9px] text-slate-500 truncate">
                          {schoolProfile.alamat || 'Jl. Pendidikan No. 123, Kel. Merdeka, Kec. Nusantara, Kota Administrasi Jakarta Pusat'}
                        </p>
                      </div>
                      <div className="w-12 hidden sm:block" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Parameter Laporan & Operasional */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900">
              Parameter Laporan & Operasional
            </h2>
            <p className="text-xs text-slate-500">
              Konfigurasi jam acuan default dan informasi lokasi/tanggal pada tanda tangan cetak dokumen.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {/* Jam Masuk */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                JAM MASUK (DEFAULT LAPORAN)
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  name="defaultCheckInTime"
                  value={formData.defaultCheckInTime}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 outline-none transition-all pr-10 min-h-[42px]"
                />
                <Clock size={16} className="absolute right-3 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Jam Pulang */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                JAM PULANG (DEFAULT LAPORAN)
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  name="defaultCheckOutTime"
                  value={formData.defaultCheckOutTime}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 outline-none transition-all pr-10 min-h-[42px]"
                />
                <Clock size={16} className="absolute right-3 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {/* Tempat Cetak Laporan */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                TEMPAT CETAK LAPORAN
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  name="reportPlace"
                  value={formData.reportPlace}
                  onChange={handleChange}
                  placeholder="Contoh: Jakarta / Kota Administrasi Jakarta Pusat"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 outline-none transition-all pr-10 min-h-[42px]"
                />
                <MapPin size={16} className="absolute right-3 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Tanggal Cetak Laporan */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  TANGGAL CETAK LAPORAN
                </label>
                {formData.reportDate ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, reportDate: '' }));
                      showToast('Tanggal cetak dikosongkan. Mengikuti tanggal berjalan (default).', 'info');
                    }}
                    className="text-[10px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                  >
                    Hapus (Pakai Tanggal Berjalan)
                  </button>
                ) : (
                  <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Tanggal Berjalan (Default)
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <input
                  type="date"
                  name="reportDate"
                  value={formData.reportDate || ''}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 outline-none transition-all min-h-[42px]"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                {formData.reportDate ? (
                  <span className="text-blue-700 font-medium">
                    ✓ Tanggal cetak manual aktif: <strong>{formData.reportDate}</strong>. Seluruh cetakan laporan mengikuti tanggal ini. Kosongkan untuk kembali ke tanggal berjalan.
                  </span>
                ) : (
                  <span className="text-emerald-700 font-medium">
                    ✓ Default aktif: Tanggal berjalan (Hari ini: <strong>{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>). Laporan akan otomatis menggunakan tanggal saat dicetak.
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end pt-2">
          <button
            type="submit"
            id="btn-simpan-pengaturan"
            className="w-full sm:w-auto px-7 py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
          >
            <Save size={18} />
            <span>Simpan Seluruh Pengaturan</span>
          </button>
        </div>
      </form>
    </div>
  );
};


