import React, { useState, useEffect } from 'react';
import {
  School,
  Building2,
  Users,
  UserCheck,
  CreditCard,
  ArrowUp,
  BookOpen,
  Layers,
  MoreVertical,
  ChevronRight,
  X,
  ShieldCheck,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { LaptopIllustration } from './SuperAdminIllustrations';
import { MetricSparkline, ActivityChart } from './SuperAdminCharts';

interface OverviewSectionProps {
  call: any;
  showToast: any;
  activeSubTab?: string;
  onSubTabChange?: (tab: string) => void;
  onNavigate: (
    category: 'beranda' | 'sekolah' | 'pembayaran' | 'sistem' | 'keamanan' | 'pengaturan',
    subTab?: string,
    extraId?: string
  ) => void;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  call,
  showToast,
  activeSubTab = 'ringkasan',
  onSubTabChange,
  onNavigate,
}) => {
  const [data, setData] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [activeMenuSchoolId, setActiveMenuSchoolId] = useState<string | null>(null);

  const load = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setIsRefreshing(true);
    try {
      const [dash, pays] = await Promise.all([
        call('dashboard').catch(() => null),
        call('payments').catch(() => ({ payments: [] })),
      ]);
      setData(dash);
      setPayments(pays?.payments || []);
      setLastUpdated(new Date());
    } catch (e: any) {
      if (!isSilent) {
        showToast(e.message || 'Gagal memuat ringkasan data.', 'error');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // Auto-refresh data setiap 45 detik untuk memastikan status realtime
    const timer = setInterval(() => {
      load(true);
    }, 45000);
    return () => clearInterval(timer);
  }, []);

  const totals = data?.totals || {};
  const dbSchools = data?.schools || [];

  // Data sekolah terbaru persis dari database yang sebenarnya
  const recentSchools = dbSchools.slice(0, 5).map((s: any, idx: number) => ({
    id: s.id || s.school_id || `sc-${idx}`,
    name: s.name || 'Sekolah Terdaftar',
    tenant: 'Kawacanaan',
    status: s.status === 'inactive' ? 'Nonaktif' : 'Aktif',
    registeredAt: s.created_at
      ? new Date(s.created_at).toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : 'Baru saja',
  }));

  const lastUpdatedFormatted = lastUpdated.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="space-y-3.5 sm:space-y-4 select-none">
      {/* ========================================================================= */}
      {/* 1. WELCOME HEADER & KAWACANAAN PRESENSI PROMO BANNER                      */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-stretch">
        {/* Kiri: Welcome Greeting & Real-time Live Badge */}
        <div className="lg:col-span-6 flex flex-col justify-center py-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Realtime Live</span>
            </span>
            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
              <Clock size={11} />
              <span>Diperbarui {lastUpdatedFormatted}</span>
            </span>
            <button
              onClick={() => load(false)}
              disabled={loading || isRefreshing}
              title="Segarkan data sekarang"
              className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading || isRefreshing ? 'animate-spin text-blue-600' : ''} />
            </button>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Selamat Datang, Super Admin</span>
            <span className="inline-block animate-wave origin-[70%_70%]">👋</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal leading-relaxed max-w-xl">
            Kelola seluruh tenant, sekolah, pengguna, dan sistem dalam satu dashboard terpadu.
          </p>
        </div>

        {/* Kanan: Kawacanaan Presensi Banner Card */}
        <div className="lg:col-span-6 relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-4 text-white shadow-md shadow-blue-500/15 flex items-center justify-between gap-4">
          <div className="relative z-10 max-w-xs sm:max-w-sm space-y-1">
            <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
              Kawacanaan Presensi
            </h2>
            <p className="text-[11px] sm:text-xs text-blue-100 font-medium leading-relaxed">
              Solusi presensi sekolah yang aman, fleksibel, dan terintegrasi untuk multi-tenant.
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowGuideModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-blue-900 font-bold text-xs hover:bg-blue-50 transition-all shadow-xs active:scale-95 cursor-pointer"
              >
                <BookOpen size={13} className="text-blue-600" />
                <span>Lihat Panduan</span>
                <span className="text-blue-500">&gt;</span>
              </button>
            </div>
          </div>

          {/* 3D Laptop Preview Illustration & Shield */}
          <div className="hidden sm:flex items-center justify-end shrink-0 -mr-1">
            <LaptopIllustration className="w-36 h-24 sm:w-40 sm:h-26" />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TOP 4 METRIC CARDS (REALTIME DATA)                                    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
        {/* Card 1: Total Sekolah Terdaftar */}
        <div
          onClick={() => onNavigate('sekolah')}
          className="bg-white rounded-2xl border border-slate-100 shadow-xs hover:shadow-md p-3 sm:p-3.5 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0 group-hover:scale-105 transition-transform">
              <Building2 size={17} />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 leading-tight">
              Total Sekolah
            </span>
          </div>

          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {totals.schools !== undefined ? totals.schools : dbSchools.length}
            </div>
          </div>

          <div className="mt-1 pt-1 flex items-end justify-between">
            <div className="text-[10.5px] font-bold text-emerald-600 flex items-center gap-0.5">
              <ArrowUp size={12} strokeWidth={2.5} />
              <span>
                {totals.newSchoolsThisMonth !== undefined
                  ? `${totals.newSchoolsThisMonth} baru bln ini`
                  : `${totals.active ?? dbSchools.length} aktif`}
              </span>
            </div>
            <MetricSparkline color="blue" className="w-14 h-6" />
          </div>
        </div>

        {/* Card 2: Total Siswa Terdaftar */}
        <div
          onClick={() => onNavigate('sekolah')}
          className="bg-white rounded-2xl border border-slate-100 shadow-xs hover:shadow-md p-3 sm:p-3.5 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500 text-white flex items-center justify-center shadow-md shadow-purple-500/20 shrink-0 group-hover:scale-105 transition-transform">
              <Users size={17} />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 leading-tight">
              Total Siswa
            </span>
          </div>

          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {(totals.students ?? 0).toLocaleString('id-ID')}
            </div>
          </div>

          <div className="mt-1 pt-1 flex items-end justify-between">
            <div className="text-[10.5px] font-bold text-emerald-600 flex items-center gap-0.5">
              <ArrowUp size={12} strokeWidth={2.5} />
              <span>
                {totals.newStudentsThisMonth !== undefined
                  ? `${totals.newStudentsThisMonth} baru bln ini`
                  : 'Terdaftar di rombel'}
              </span>
            </div>
            <MetricSparkline color="purple" className="w-14 h-6" />
          </div>
        </div>

        {/* Card 3: Total Guru & Pendidik */}
        <div
          onClick={() => onNavigate('sekolah')}
          className="bg-white rounded-2xl border border-slate-100 shadow-xs hover:shadow-md p-3 sm:p-3.5 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0 group-hover:scale-105 transition-transform">
              <UserCheck size={17} />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 leading-tight">
              Total Guru
            </span>
          </div>

          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {(totals.teachers ?? 0).toLocaleString('id-ID')}
            </div>
          </div>

          <div className="mt-1 pt-1 flex items-end justify-between">
            <div className="text-[10.5px] font-bold text-emerald-600 flex items-center gap-0.5">
              <ArrowUp size={12} strokeWidth={2.5} />
              <span>
                {totals.newTeachersThisMonth !== undefined
                  ? `${totals.newTeachersThisMonth} baru bln ini`
                  : 'Pendidik & Operator'}
              </span>
            </div>
            <MetricSparkline color="emerald" className="w-14 h-6" />
          </div>
        </div>

        {/* Card 4: Total Pengguna */}
        <div
          onClick={() => onNavigate('sekolah', 'pengguna')}
          className="bg-white rounded-2xl border border-slate-100 shadow-xs hover:shadow-md p-3 sm:p-3.5 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0 group-hover:scale-105 transition-transform">
              <Users size={17} />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 leading-tight">
              Total Pengguna
            </span>
          </div>

          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {(totals.users ?? 0).toLocaleString('id-ID')}
            </div>
          </div>

          <div className="mt-1 pt-1 flex items-end justify-between">
            <div className="text-[10.5px] font-bold text-emerald-600 flex items-center gap-0.5">
              <ArrowUp size={12} strokeWidth={2.5} />
              <span>
                {totals.newUsersThisMonth !== undefined
                  ? `${totals.newUsersThisMonth} baru bln ini`
                  : 'Akun terdaftar'}
              </span>
            </div>
            <MetricSparkline color="amber" className="w-14 h-6" />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. ROW 2: AKTIVITAS SISTEM 7 HARI & SEKOLAH TERBARU (BERDAMPINGAN)        */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4 items-stretch">
        {/* Widget 1: Aktivitas Sistem 7 Hari Terakhir (Realtime Chart) */}
        <div className="flex">
          <ActivityChart
            className="w-full h-full"
            activityData={totals.activity7Days}
          />
        </div>

        {/* Widget 2: Sekolah Terbaru */}
        <div className="w-full bg-white rounded-2xl border border-slate-100 shadow-xs p-4 sm:p-5 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <School size={17} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">
                    Sekolah Terbaru
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Pendaftaran &amp; penambahan instansi tenant terakhir
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('sekolah')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 transition cursor-pointer flex items-center gap-1 shrink-0"
              >
                <span>Lihat Semua</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {/* List Sekolah Terbaru Berdampingan */}
            {recentSchools.length > 0 ? (
              <div className="divide-y divide-slate-50 mt-1">
                {recentSchools.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onNavigate('sekolah', 'ringkasan', item.id)}
                    className="py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-slate-50/80 rounded-xl transition-colors group cursor-pointer relative"
                  >
                    {/* Nama Sekolah & Tenant */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-blue-50/80 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/60 font-bold group-hover:scale-105 transition-transform">
                        <School size={15} />
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-xs truncate block">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10.5px] text-slate-400">
                          <span className="font-medium text-slate-500 truncate">{item.tenant}</span>
                          <span>•</span>
                          <span className="shrink-0">{item.registeredAt}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status & Menu Aksi */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === 'Aktif'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                        }`}
                      >
                        {item.status}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuSchoolId(activeMenuSchoolId === item.id ? null : item.id);
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                      >
                        <MoreVertical size={14} />
                      </button>
                    </div>

                    {/* Dropdown Menu Ringkas */}
                    {activeMenuSchoolId === item.id && (
                      <div
                        className="absolute right-2 top-9 bg-white border border-slate-200 shadow-xl rounded-xl py-1 w-36 z-30 text-left"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setActiveMenuSchoolId(null);
                            onNavigate('sekolah', 'ringkasan', item.id);
                          }}
                          className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
                        >
                          <Building2 size={13} />
                          <span>Detail Sekolah</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveMenuSchoolId(null);
                            onNavigate('pembayaran', 'pembayaran');
                          }}
                          className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
                        >
                          <CreditCard size={13} />
                          <span>Cek Tagihan</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                <School size={24} className="text-slate-300" />
                <span>Belum ada sekolah terdaftar di database.</span>
                <button
                  onClick={() => onNavigate('sekolah', 'tambah')}
                  className="mt-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 font-bold text-xs hover:bg-blue-100 transition cursor-pointer"
                >
                  + Tambah Sekolah
                </button>
              </div>
            )}
          </div>

          {/* Footer Card Ringkas */}
          <div className="pt-2 mt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>
              Total Instansi: <strong className="text-slate-800 font-bold">{totals.schools !== undefined ? totals.schools : dbSchools.length}</strong>
            </span>
            <button
              onClick={() => onNavigate('sekolah', 'tambah')}
              className="text-blue-600 hover:text-blue-700 font-bold hover:underline cursor-pointer"
            >
              + Tambah Sekolah
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. MODAL PANDUAN PENGGUNAAN (DI-TRIGGER DARI BANNER ATAS)                */}
      {/* ========================================================================= */}
      {showGuideModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <BookOpen size={16} />
                </div>
                <h3 className="text-base font-black text-slate-900">
                  Panduan Super Admin Kawacanaan
                </h3>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
              <div className="p-3 rounded-2xl bg-blue-50 border border-blue-100 text-blue-900 font-medium">
                Selamat datang di platform Multi-Tenant Kawacanaan Presensi. Gunakan kontrol ini untuk memantau performa, sekolah, dan transaksi secara menyeluruh.
              </div>

              <div className="space-y-2">
                <div className="font-black text-slate-900 flex items-center gap-1.5">
                  <Building2 size={14} className="text-blue-600" />
                  <span>1. Manajemen Sekolah &amp; Tenant</span>
                </div>
                <p className="text-slate-500 pl-5">
                  Daftarkan unit sekolah baru melalui tombol <strong>Tambah Sekolah</strong>, atur paket lisensi (Paket Gratis, Paket Guru, atau Paket Sekolah), dan konfigurasi kuota rombel.
                </p>
              </div>

              <div className="space-y-2">
                <div className="font-black text-slate-900 flex items-center gap-1.5">
                  <CreditCard size={14} className="text-emerald-600" />
                  <span>2. Transaksi &amp; Pembayaran</span>
                </div>
                <p className="text-slate-500 pl-5">
                  Setiap transaksi via Midtrans tercatat otomatis. Webhook Midtrans memperbarui status langganan sekolah saat pembayaran berhasil.
                </p>
              </div>

              <div className="space-y-2">
                <div className="font-black text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-purple-600" />
                  <span>3. Audit Log &amp; Keamanan</span>
                </div>
                <p className="text-slate-500 pl-5">
                  Pantau aktivitas autentikasi, perubahan data kritis, dan kirimkan siaran pengumuman global ke seluruh pengguna aplikasi.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
