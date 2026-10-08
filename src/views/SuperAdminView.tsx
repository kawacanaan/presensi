import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  ShieldCheck,
  Menu,
  X,
  LogOut,
  Calendar,
  Megaphone,
  Plus,
  RefreshCw,
  ChevronRight,
  Sparkles,
  Activity,
  CheckCircle2,
  KeyRound,
  Shield,
  Layers,
  ArrowUpRight,
  Search,
  Bell,
  ChevronDown,
  BarChart3,
  Database,
  SlidersHorizontal,
  Lock,
  Settings,
  Users,
  Radio,
  FileText,
  Receipt,
  Wallet,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { SchoolLogo } from '../components/SchoolLogo';
import { KawacanaanEmblem } from '../components/KawacanaanEmblem';

// 4 Rumpun Terpadu Sections
import { OverviewSection } from '../components/superadmin/OverviewSection';
import { SchoolsSection } from '../components/superadmin/SchoolsSection';
import { BillingSection } from '../components/superadmin/BillingSection';
import { SystemSection } from '../components/superadmin/SystemSection';

export type SuperAdminCluster = 'dashboard' | 'sekolah' | 'billing' | 'sistem';

export interface SubMenuItem {
  id: string;
  label: string;
  icon?: any;
  badge?: string;
}

export interface ClusterConfig {
  id: SuperAdminCluster;
  label: string;
  sublabel: string;
  icon: any;
  badge?: string;
  submenus: SubMenuItem[];
}

const clusters: ClusterConfig[] = [
  {
    id: 'dashboard',
    label: 'Beranda',
    sublabel: 'Metrik, KPI & Monitoring',
    icon: LayoutDashboard,
    // Submenu di beranda dihapus sesuai instruksi user (hanya menu beranda dan isinya yang dipertahankan)
    submenus: [],
  },
  {
    id: 'sekolah',
    label: 'Sekolah',
    sublabel: 'Direktori & Pengguna Tenant',
    icon: Building2,
    submenus: [
      { id: 'manajemen', label: 'Manajemen Sekolah', icon: Building2 },
      { id: 'paket-lisensi', label: 'Paket & Lisensi', icon: Layers },
      { id: 'pengguna', label: 'Pengguna', icon: Users },
      { id: 'riwayat', label: 'Riwayat', icon: Activity },
    ],
  },
  {
    id: 'billing',
    label: 'Pembayaran',
    sublabel: 'Transaksi & Lisensi Sekolah',
    icon: CreditCard,
    // Urutan submenu pembayaran persis sesuai instruksi user:
    // 1. Dashboard Pembayaran, 2. Tagihan & Invoice, 3. Riwayat Transaksi, 4. Metode Pembayaran, 5. Laporan Keuangan
    submenus: [
      { id: 'dashboard', label: 'Dashboard Pembayaran', icon: CreditCard },
      { id: 'invoice', label: 'Tagihan & Invoice', icon: FileText },
      { id: 'riwayat', label: 'Riwayat Transaksi', icon: Receipt },
      { id: 'metode', label: 'Metode Pembayaran', icon: Wallet },
      { id: 'laporan', label: 'Laporan Keuangan', icon: TrendingUp },
    ],
  },
  {
    id: 'sistem',
    label: 'Sistem',
    sublabel: 'Tata Kelola, AI & Integrasi',
    icon: ShieldCheck,
    submenus: [
      { id: 'platform', label: 'Konfigurasi Platform', icon: SlidersHorizontal },
      { id: 'koka-ai', label: 'Mesin AI Presiden Konoha', icon: Sparkles },
      { id: 'evolution-api', label: 'Gateway WhatsApp', icon: Radio },
      { id: 'siaran', label: 'Siaran Pengumuman', icon: Megaphone },
      { id: 'keamanan', label: 'Pusat Keamanan & Audit', icon: Shield },
      { id: 'database', label: 'Basis Data & Pemeliharaan', icon: Database },
    ],
  },
];

export const SuperAdminView: React.FC = () => {
  const { currentUser, showToast, logout, globalAnnouncement } = useApp();

  const [activeCluster, setActiveClusterState] = useState<SuperAdminCluster>(() => {
    try {
      const saved = localStorage.getItem('kawacanaan_superadmin_cluster');
      if (saved === 'sekolah') return 'sekolah';
      if (saved === 'billing' || saved === 'pembayaran') return 'billing';
      if (saved === 'sistem' || saved === 'keamanan' || saved === 'pengaturan') return 'sistem';
      return 'dashboard';
    } catch (_) {}
    return 'dashboard';
  });

  const setActiveCluster = (cluster: SuperAdminCluster) => {
    setActiveClusterState(cluster);
    try {
      localStorage.setItem('kawacanaan_superadmin_cluster', cluster);
    } catch (_) {}
    setIsMobileSidebarOpen(false);
  };

  // State untuk navigasi spesifik antar sub-fitur
  const [overviewSubTab, setOverviewSubTab] = useState<string>('ringkasan');
  const [schoolsSubTab, setSchoolsSubTab] = useState<string>('manajemen');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [billingSubTab, setBillingSubTab] = useState<string>('dashboard');
  const [systemSubTab, setSystemSubTab] = useState<string>('platform');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  // State accordion: daftar rumpun menu yang submenunya sedang terbuka kebawah (expanded)
  const [expandedClusters, setExpandedClusters] = useState<SuperAdminCluster[]>(() => {
    try {
      const saved = localStorage.getItem('kawacanaan_superadmin_cluster');
      if (saved === 'sekolah' || saved === 'billing' || saved === 'sistem') {
        return [saved as SuperAdminCluster];
      }
    } catch (_) {}
    return ['billing'];
  });

  // Handler klik menu utama di sidebar kiri:
  // - Pada saat superadmin menekan menu, submenu muncul kebawah.
  // - Jika superadmin menekan menu itu lagi, submenu tidak muncul (toggle tutup).
  // - Isi konten submenu terlihat jika sudah dipilih oleh superadmin, selama belum memilih submenu, konten tidak berganti.
  const handleClusterClick = (clusterId: SuperAdminCluster) => {
    const cluster = clusters.find((c) => c.id === clusterId);
    if (!cluster?.submenus || cluster.submenus.length === 0) {
      setActiveCluster(clusterId);
      setIsMobileSidebarOpen(false);
      return;
    }

    // Toggle buka/tutup submenu kebawah
    setExpandedClusters((prev) =>
      prev.includes(clusterId)
        ? prev.filter((id) => id !== clusterId)
        : [...prev, clusterId]
    );
  };

  // Helper untuk cek status aktif submenu
  const getIsSubActive = (clusterId: SuperAdminCluster, subId: string) => {
    if (activeCluster !== clusterId) return false;
    if (clusterId === 'dashboard') return overviewSubTab === subId;
    if (clusterId === 'sekolah') return schoolsSubTab === subId;
    if (clusterId === 'billing') return billingSubTab === subId;
    if (clusterId === 'sistem') return systemSubTab === subId;
    return false;
  };

  // Handler klik submenu terintegrasi:
  // Konten baru akan dimuat/ditampilkan setelah superadmin memilih salah satu item submenu
  const handleSubMenuClick = (clusterId: SuperAdminCluster, subMenuId: string) => {
    setActiveCluster(clusterId);
    setExpandedClusters((prev) => (prev.includes(clusterId) ? prev : [...prev, clusterId]));

    if (clusterId === 'dashboard') {
      setOverviewSubTab(subMenuId);
    } else if (clusterId === 'sekolah') {
      setSchoolsSubTab(subMenuId);
      setSelectedSchoolId(null);
    } else if (clusterId === 'billing') {
      setBillingSubTab(subMenuId);
    } else if (clusterId === 'sistem') {
      setSystemSubTab(subMenuId);
    }
    setIsMobileSidebarOpen(false);
  };

  const token = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  };

  const call = async (action: string, p: any = {}) => {
    const r = await fetch('/api/superadmin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await token()}`,
      },
      body: JSON.stringify({ action, ...p }),
    });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(b.error || 'Operasi gagal dieksekusi.');
    return b;
  };

  // Handler integrasi navigasi universal dari OverviewSection / kartu metrik
  const handleNavigate = (tab: string, subTab?: string, extraId?: string) => {
    const target = tab.toLowerCase();
    if (target === 'sekolah' || target === 'schools') {
      setActiveCluster('sekolah');
      setExpandedClusters((prev) => (prev.includes('sekolah') ? prev : [...prev, 'sekolah']));
      if (extraId) setSelectedSchoolId(extraId);
      if (subTab) setSchoolsSubTab(subTab);
    } else if (target === 'pembayaran' || target === 'billing') {
      setActiveCluster('billing');
      setExpandedClusters((prev) => (prev.includes('billing') ? prev : [...prev, 'billing']));
      if (subTab) setBillingSubTab(subTab);
    } else if (target === 'keamanan' || target === 'security' || target === 'audit') {
      setActiveCluster('sistem');
      setExpandedClusters((prev) => (prev.includes('sistem') ? prev : [...prev, 'sistem']));
      setSystemSubTab('keamanan');
    } else if (target === 'pengaturan' || target === 'system' || target === 'sistem') {
      setActiveCluster('sistem');
      setExpandedClusters((prev) => (prev.includes('sistem') ? prev : [...prev, 'sistem']));
      if (subTab) setSystemSubTab(subTab);
    } else {
      setActiveCluster('dashboard');
      if (subTab) setOverviewSubTab(subTab);
    }
  };

  // Tanggal terformat bahasa Indonesia
  const getFormattedDate = () => {
    return new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    showToast('Memperbarui data super admin...', 'info');
    setTimeout(() => {
      setIsRefreshing(false);
      showToast('Data berhasil diperbarui.', 'success');
    }, 600);
  };

  const currentClusterConfig = clusters.find((c) => c.id === activeCluster) || clusters[0];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex text-slate-800 antialiased selection:bg-indigo-600 selection:text-white">
      {/* ========================================================================= */}
      {/* 1. SIDEBAR KIRI DESKTOP & OVERLAY MOBILE                                */}
      {/* ========================================================================= */}

      {/* Backdrop Mobile Drawer */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar Component */}
      <aside
        className={`fixed md:sticky top-0 h-screen w-72 bg-slate-950 text-slate-100 flex flex-col justify-between z-50 transition-transform duration-300 ease-in-out border-r border-slate-800/80 shadow-2xl ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Atas Sidebar: Logo & Identitas Super Admin */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-950/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 select-none">
              <KawacanaanEmblem size={40} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-black text-white text-base tracking-tight truncate">KAWACANAAN</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                    SaaS
                  </span>
                </div>
                <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mt-0.5 truncate">
                  SUPER ADMIN CONSOLE
                </p>
              </div>
            </div>

            {/* Tombol Tutup pada Layar Mobile */}
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Status Koneksi Platform Ringkas */}
          <div className="mt-3.5 px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-semibold text-slate-300">Supabase Multi-Tenant</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
              Online
            </span>
          </div>
        </div>

        {/* Tengah Sidebar: Menu Utama & Submenu Terpadu (Commercial SaaS Layout) */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-4">
          <div className="px-3 pb-1 text-[10px] font-black tracking-widest text-slate-500 uppercase">
            NAVIGASI MULTI-TENANT
          </div>

          <nav className="space-y-2">
            {clusters.map((c) => {
              const isActive = activeCluster === c.id;
              const hasSubmenus = Boolean(c.submenus && c.submenus.length > 0);
              const isExpanded = expandedClusters.includes(c.id);
              const Icon = c.icon;

              return (
                <div key={c.id} className="space-y-1">
                  {/* Tombol Menu Utama */}
                  <button
                    type="button"
                    onClick={() => handleClusterClick(c.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all duration-150 cursor-pointer group select-none min-h-[44px] ${
                      isActive
                        ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400/40'
                        : isExpanded
                        ? 'bg-slate-900/90 text-white font-semibold ring-1 ring-slate-800'
                        : 'text-slate-300 hover:text-white hover:bg-slate-900/80'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl transition-colors shrink-0 ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : isExpanded
                          ? 'bg-slate-800 text-indigo-400'
                          : 'bg-slate-900 text-slate-400 group-hover:text-white group-hover:bg-slate-800'
                      }`}
                    >
                      <Icon size={17} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black truncate">{c.label}</span>
                        {hasSubmenus && (
                          <ChevronDown
                            size={15}
                            className={`transition-transform duration-200 shrink-0 ${
                              isExpanded
                                ? isActive
                                  ? 'text-indigo-200 rotate-180'
                                  : 'text-slate-300 rotate-180'
                                : 'text-slate-500 group-hover:text-slate-300'
                            }`}
                          />
                        )}
                      </div>
                      <p
                        className={`text-[10px] truncate mt-0.5 ${
                          isActive ? 'text-indigo-100 font-medium' : 'text-slate-400'
                        }`}
                      >
                        {c.sublabel}
                      </p>
                    </div>
                  </button>

                  {/* Submenu List - Muncul kebawah saat expanded */}
                  {hasSubmenus && isExpanded && (
                    <div className="ml-5 pl-3 border-l-2 border-slate-800/90 space-y-1 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                      {c.submenus.map((sub) => {
                        const isSubActive = getIsSubActive(c.id, sub.id);
                        const SubIcon = sub.icon;

                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => handleSubMenuClick(c.id, sub.id)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all duration-150 cursor-pointer min-h-[38px] ${
                              isSubActive
                                ? 'bg-indigo-600/25 text-indigo-300 font-bold border border-indigo-500/40 shadow-xs'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              {SubIcon ? (
                                <SubIcon
                                  size={14}
                                  className={`shrink-0 ${isSubActive ? 'text-indigo-400' : 'text-slate-500'}`}
                                />
                              ) : (
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    isSubActive ? 'bg-indigo-400' : 'bg-slate-600'
                                  }`}
                                />
                              )}
                              <span className="truncate">{sub.label}</span>
                            </div>

                            {sub.badge && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                                {sub.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bawah Sidebar: Profil Pengguna & Tombol Keluar */}
        <div className="p-3.5 sm:p-4 border-t border-slate-800/80 bg-slate-950/90">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/90 flex items-center justify-center font-black text-white text-base shadow-inner shrink-0">
                {currentUser?.name?.charAt(0) || 'S'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  {currentUser?.name || 'Super Administrator'}
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  @{currentUser?.username || 'superadmin'}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                if (window.confirm('Keluar dari sesi Super Administrator?')) {
                  void logout();
                }
              }}
              title="Keluar dari sistem"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer shrink-0"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. AREA UTAMA (TOPBAR RAMPING + KONTEN WORKSPACE)                         */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Universal Topbar Super Admin */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4 shadow-2xs">
          {/* Sisi Kiri: Hamburger Mobile + Search Input (Persis Referensi Gambar) */}
          <div className="flex items-center gap-3 flex-1 max-w-xl">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer shrink-0"
            >
              <Menu size={18} />
            </button>

            {/* Input Pencarian Universal */}
            <div className="relative w-full max-w-md">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    setActiveCluster('sekolah');
                    setSchoolsSubTab('semua');
                  }
                }}
                placeholder="Cari sekolah, tenant, pengguna, atau menu..."
                className="w-full pl-9 pr-4 py-2 bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs font-medium text-slate-800 placeholder-slate-400 rounded-xl border border-transparent focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 transition-all outline-none"
              />
            </div>
          </div>

          {/* Sisi Kanan: Lonceng Notif, Tanggal, dan Profil Super Admin */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Lonceng Notifikasi dengan Red Dot */}
            <button
              type="button"
              onClick={() => {
                setActiveCluster('sistem');
                setSystemSubTab('siaran');
              }}
              title="Notifikasi Sistem"
              className="relative p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
            >
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
            </button>

            {/* Tanggal Hari Ini (Persis Box di Gambar: Rabu, 20 September 2026) */}
            <div className="hidden lg:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50/80 text-slate-700 text-xs font-semibold select-none">
              <Calendar size={13} className="text-slate-400" />
              <span>{getFormattedDate()}</span>
            </div>

            {/* Profil Super Admin (SA / Super Admin / Administrator ∨) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center gap-2.5 p-1 sm:px-2 sm:py-1 rounded-xl hover:bg-slate-100 transition cursor-pointer select-none"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs shrink-0">
                  SA
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-black text-slate-900 leading-tight">
                    Super Admin
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    Administrator
                  </div>
                </div>
                <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
              </button>

              {/* Profile Dropdown */}
              {isProfileDropdownOpen && (
                <div className="absolute right-0 top-11 bg-white border border-slate-200 shadow-xl rounded-2xl py-2 w-48 z-40 text-left">
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {currentUser?.name || 'Super Administrator'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono truncate">
                      @{currentUser?.username || 'superadmin'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      setActiveCluster('sistem');
                    }}
                    className="w-full px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                  >
                    <ShieldCheck size={14} className="text-indigo-600" />
                    <span>Pengaturan Sistem</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      handleManualRefresh();
                    }}
                    className="w-full px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                  >
                    <RefreshCw size={14} className="text-emerald-600" />
                    <span>Segarkan Data</span>
                  </button>
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <button
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        if (window.confirm('Keluar dari sesi Super Administrator?')) {
                          void logout();
                        }
                      }}
                      className="w-full px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-bold"
                    >
                      <LogOut size={14} />
                      <span>Keluar</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Konten Utama Workspace Berdasarkan Rumpun Terpilih */}
        <main className="flex-1 p-3.5 sm:p-5 lg:p-6 max-w-7xl 2xl:max-w-[1600px] w-full mx-auto space-y-4 sm:space-y-5">
          {/* 1. Rumpun Dashboard */}
          {activeCluster === 'dashboard' && (
            <OverviewSection
              call={call}
              showToast={showToast}
              activeSubTab={overviewSubTab}
              onSubTabChange={setOverviewSubTab}
              onNavigate={handleNavigate}
            />
          )}

          {/* 2. Rumpun Kelola Sekolah */}
          {activeCluster === 'sekolah' && (
            <SchoolsSection
              call={call}
              showToast={showToast}
              activeSubTab={schoolsSubTab}
              initialSchoolId={selectedSchoolId || undefined}
              onSubTabChange={setSchoolsSubTab}
            />
          )}

          {/* 3. Rumpun Billing & Lisensi */}
          {activeCluster === 'billing' && (
            <BillingSection
              call={call}
              showToast={showToast}
              activeSubTab={billingSubTab}
              onSubTabChange={setBillingSubTab}
              onNavigateToSchool={(id) => handleNavigate('sekolah', 'ringkasan', id)}
            />
          )}

          {/* 4. Rumpun Pusat Sistem */}
          {activeCluster === 'sistem' && (
            <SystemSection
              call={call}
              showToast={showToast}
              activeSubTab={systemSubTab}
              onSubTabChange={setSystemSubTab}
            />
          )}
        </main>
      </div>
    </div>
  );
};
