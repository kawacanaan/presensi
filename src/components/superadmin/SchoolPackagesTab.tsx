import React, { useState, useMemo } from 'react';
import {
  Layers,
  Search,
  Filter,
  RefreshCw,
  Download,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  Sparkles,
  SlidersHorizontal,
  ChevronRight,
  X,
  CreditCard,
  Zap,
  Info,
  Check,
  Lock,
} from 'lucide-react';
import { normalizePlan } from '../../utils/packageSystem';
import { PackageFeatureMatrixTab } from './PackageFeatureMatrixTab';

export interface SchoolPackagesTabProps {
  call: (action: string, payload?: any) => Promise<any>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  schools: any[];
  onReloadSchools: () => void;
  onNavigateToSchool?: (schoolId: string) => void;
}

export const SchoolPackagesTab: React.FC<SchoolPackagesTabProps> = ({
  call,
  showToast,
  schools,
  onReloadSchools,
  onNavigateToSchool,
}) => {
  const [activeTabMode, setActiveTabMode] = useState<'licenses' | 'matrix'>('licenses');
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState<'all' | 'guru_gratis' | 'guru_pro' | 'sekolah_pro'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expiring' | 'expired'>('all');
  const [isUpdating, setIsUpdating] = useState(false);

  // Modal Ubah Paket
  const [selectedSchoolForEdit, setSelectedSchoolForEdit] = useState<any | null>(null);
  const [modalPlan, setModalPlan] = useState<'guru_gratis' | 'guru_pro' | 'sekolah_pro'>('sekolah_pro');
  const [modalExpiry, setModalExpiry] = useState<string>('');
  const [modalStatus, setModalStatus] = useState<'active' | 'inactive'>('active');

  // Perhitungan statistik lisensi
  const stats = useMemo(() => {
    let total = schools.length;
    let sekolahPro = 0;
    let guruPro = 0;
    let gratis = 0;
    let expiring = 0;
    let expired = 0;

    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    schools.forEach((s) => {
      const p = normalizePlan(s.plan);
      if (p === 'sekolah_pro') sekolahPro++;
      else if (p === 'guru_pro') guruPro++;
      else gratis++;

      if (s.subscription_expires_at) {
        const expDate = new Date(s.subscription_expires_at);
        if (expDate <= now) {
          expired++;
        } else if (expDate <= thirtyDaysLater) {
          expiring++;
        }
      }
    });

    return { total, sekolahPro, guruPro, gratis, expiring, expired };
  }, [schools]);

  // Filter daftar sekolah
  const filteredSchools = useMemo(() => {
    return schools.filter((s) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.npsn && s.npsn.toLowerCase().includes(q)) ||
        (s.code && s.code.toLowerCase().includes(q));

      const currentPlan = normalizePlan(s.plan);
      const matchPlan = filterPlan === 'all' || currentPlan === filterPlan;

      let matchStatus = true;
      const now = new Date();
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const expDate = s.subscription_expires_at ? new Date(s.subscription_expires_at) : null;

      if (filterStatus === 'active') {
        matchStatus = s.status === 'active' && (!expDate || expDate > now);
      } else if (filterStatus === 'expiring') {
        matchStatus = !!(expDate && expDate > now && expDate <= thirtyDays);
      } else if (filterStatus === 'expired') {
        matchStatus = !!(expDate && expDate <= now);
      }

      return matchSearch && matchPlan && matchStatus;
    });
  }, [schools, search, filterPlan, filterStatus]);

  // Buka Modal Edit
  const handleOpenEdit = (school: any) => {
    setSelectedSchoolForEdit(school);
    setModalPlan(normalizePlan(school.plan));
    setModalExpiry(school.subscription_expires_at || '');
    setModalStatus(school.status || 'active');
  };

  // Simpan Perubahan Paket
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchoolForEdit) return;

    setIsUpdating(true);
    try {
      const sId = selectedSchoolForEdit.school_id || selectedSchoolForEdit.id;
      await call('update_school', {
        school_id: sId,
        name: selectedSchoolForEdit.name,
        npsn: selectedSchoolForEdit.npsn,
        plan: modalPlan,
        status: modalStatus,
        subscription_expires_at: modalExpiry || null,
      });

      showToast(`Lisensi untuk "${selectedSchoolForEdit.name}" berhasil diperbarui.`, 'success');
      setSelectedSchoolForEdit(null);
      onReloadSchools();
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui lisensi sekolah.', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  // Quick Extend (+X days)
  const handleQuickExtend = async (school: any, days: number) => {
    const sId = school.school_id || school.id;
    const currentExpiry = school.subscription_expires_at || new Date().toISOString().slice(0, 10);
    const baseDate = new Date(currentExpiry) > new Date() ? currentExpiry : new Date().toISOString().slice(0, 10);
    const nextDate = new Date(baseDate);
    nextDate.setDate(nextDate.getDate() + days);
    const nextExpiryStr = nextDate.toISOString().slice(0, 10);

    try {
      await call('update_school', {
        school_id: sId,
        name: school.name,
        npsn: school.npsn,
        plan: school.plan,
        status: 'active',
        subscription_expires_at: nextExpiryStr,
      });
      showToast(`Masa aktif ${school.name} diperpanjang +${days} hari (hingga ${nextExpiryStr}).`, 'success');
      onReloadSchools();
    } catch (err: any) {
      showToast(err.message || 'Gagal memperpanjang lisensi.', 'error');
    }
  };

  // Ekspor CSV
  const handleExportCSV = () => {
    if (filteredSchools.length === 0) {
      showToast('Tidak ada data lisensi yang dapat diekspor.', 'info');
      return;
    }
    const headers = ['Nama Sekolah', 'NPSN', 'Kode Masuk', 'Paket Lisensi', 'Masa Berlaku', 'Status Operasional'];
    const rows = filteredSchools.map((s) => [
      `"${s.name || ''}"`,
      `"${s.npsn || ''}"`,
      `"${s.code || ''}"`,
      `"${normalizePlan(s.plan)}"`,
      `"${s.subscription_expires_at || 'Seumur Hidup'}"`,
      `"${s.status || 'active'}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lisensi_sekolah_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Data lisensi berhasil diekspor ke CSV!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
            <Layers size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Paket & Lisensi Sekolah
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                SaaS Subscription Hub
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola alokasi kuota lisensi, durasi masa aktif instansi, dan konfigurasi fitur paket sekolah.
            </p>
          </div>
        </div>

        {/* Action Controls Kanan */}
        <div className="flex items-center gap-2">
          {/* Switcher Tab Lisensi vs Matriks */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTabMode('licenses')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTabMode === 'licenses'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daftar Lisensi
            </button>
            <button
              type="button"
              onClick={() => setActiveTabMode('matrix')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTabMode === 'matrix'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <SlidersHorizontal size={13} />
              <span>Matriks Fitur</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onReloadSchools}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer"
            title="Muat Ulang Data Lisensi"
          >
            <RefreshCw size={15} />
          </button>

          {activeTabMode === 'licenses' && (
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Ekspor CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Instansi</span>
            <Building2 size={16} className="text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.total}</div>
          <p className="text-[10px] text-slate-400 mt-1">Seluruh sekolah terdaftar</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-xs">
          <div className="flex items-center justify-between text-indigo-600 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Paket Sekolah</span>
            <Sparkles size={16} className="text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-700">{stats.sekolahPro}</div>
          <p className="text-[10px] text-slate-400 mt-1">Tenant institusi lengkap</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Paket Guru</span>
            <Zap size={16} className="text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-700">{stats.guruPro}</div>
          <p className="text-[10px] text-slate-400 mt-1">Ruang kerja mandiri</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Paket Gratis</span>
            <Layers size={16} className="text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-700">{stats.gratis}</div>
          <p className="text-[10px] text-slate-400 mt-1">Edisi standar dasar</p>
        </div>
      </div>

      {/* 3. TAMPILAN MATRIKS FITUR ATAU TABEL LISENSI */}
      {activeTabMode === 'matrix' ? (
        <PackageFeatureMatrixTab showToast={showToast} />
      ) : (
        <div className="space-y-4">
          {/* TOOLBAR FILTER */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama instansi, NPSN, atau kode..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-600 placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              {/* Filter Paket */}
              <select
                value={filterPlan}
                onChange={(e: any) => setFilterPlan(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-indigo-600"
              >
                <option value="all">Semua Paket</option>
                <option value="sekolah_pro">Paket Sekolah</option>
                <option value="guru_pro">Paket Guru</option>
                <option value="guru_gratis">Paket Gratis</option>
              </select>

              {/* Filter Status Kadaluwarsa */}
              <select
                value={filterStatus}
                onChange={(e: any) => setFilterStatus(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-indigo-600"
              >
                <option value="all">Semua Status</option>
                <option value="active">Aktif Normal</option>
                <option value="expiring">Segera Habis (&lt;30 Hari)</option>
                <option value="expired">Telah Kedaluwarsa</option>
              </select>
            </div>
          </div>

          {/* TABEL LISENSI SEKOLAH */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50/80">
                    <th className="py-3 px-4">Nama Instansi / Sekolah</th>
                    <th className="py-3 px-4">Paket Langganan</th>
                    <th className="py-3 px-4">Masa Berlaku</th>
                    <th className="py-3 px-4">Sisa Hari</th>
                    <th className="py-3 px-4">Status Layanan</th>
                    <th className="py-3 px-4 text-right">Aksi Kelola</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSchools.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        Tidak ada data lisensi sekolah yang sesuai dengan filter pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredSchools.map((s) => {
                      const p = normalizePlan(s.plan);
                      const now = new Date();
                      const expDate = s.subscription_expires_at ? new Date(s.subscription_expires_at) : null;
                      const isExpired = expDate ? expDate <= now : false;
                      const diffDays = expDate ? Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

                      return (
                        <tr key={s.id || s.school_id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{s.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                              <span>NPSN: {s.npsn || '-'}</span>
                              <span>•</span>
                              <span>Kode: {s.code || '-'}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                p === 'sekolah_pro'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : p === 'guru_pro'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {p === 'sekolah_pro' ? (
                                <>
                                  <Sparkles size={11} />
                                  <span>Paket Sekolah</span>
                                </>
                              ) : p === 'guru_pro' ? (
                                <>
                                  <Zap size={11} />
                                  <span>Paket Guru</span>
                                </>
                              ) : (
                                <span>Paket Gratis</span>
                              )}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-medium text-slate-700 flex items-center gap-1.5">
                              <Calendar size={13} className="text-slate-400" />
                              <span>{s.subscription_expires_at ? s.subscription_expires_at : 'Permanen / Uji Coba'}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {diffDays === null ? (
                              <span className="text-slate-400 font-medium">Tanpa Batas</span>
                            ) : isExpired ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                Kedaluwarsa ({Math.abs(diffDays)} hari lalu)
                              </span>
                            ) : diffDays <= 30 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                {diffDays} hari lagi
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-bold text-xs">
                                {diffDays} hari aktif
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                s.status === 'active' && !isExpired
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {s.status === 'active' && !isExpired ? 'Aktif' : 'Nonaktif / Habis'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleQuickExtend(s, 30)}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-bold transition cursor-pointer"
                                title="Perpanjang 30 Hari Langsung"
                              >
                                +30 Hari
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickExtend(s, 365)}
                                className="px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold transition cursor-pointer"
                                title="Perpanjang 1 Tahun Langsung"
                              >
                                +1 Tahun
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(s)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition cursor-pointer"
                              >
                                Kelola
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL KELOLA PAKET & MASA AKTIF */}
      {selectedSchoolForEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Layers size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Ubah Paket & Lisensi</h3>
                  <p className="text-[11px] text-slate-500 font-medium truncate max-w-[240px]">
                    {selectedSchoolForEdit.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSchoolForEdit(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Pilih Paket Lisensi</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalPlan('guru_gratis')}
                    className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                      modalPlan === 'guru_gratis'
                        ? 'border-indigo-600 bg-indigo-50/60 text-indigo-900 font-bold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 text-xs'
                    }`}
                  >
                    <div className="text-xs font-bold">Paket Gratis</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Dasar</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalPlan('guru_pro')}
                    className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                      modalPlan === 'guru_pro'
                        ? 'border-blue-600 bg-blue-50/60 text-blue-900 font-bold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 text-xs'
                    }`}
                  >
                    <div className="text-xs font-bold">Paket Guru</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Mandiri</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalPlan('sekolah_pro')}
                    className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                      modalPlan === 'sekolah_pro'
                        ? 'border-indigo-600 bg-indigo-50/60 text-indigo-900 font-bold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 text-xs'
                    }`}
                  >
                    <div className="text-xs font-bold">Paket Sekolah</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Institusi</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Kedaluwarsa</label>
                <input
                  type="date"
                  value={modalExpiry}
                  onChange={(e) => setModalExpiry(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-600"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Kosongkan jika ingin masa aktif permanen / tanpa batas kedaluwarsa.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status Operasional Layanan</label>
                <select
                  value={modalStatus}
                  onChange={(e: any) => setModalStatus(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-600 bg-white"
                >
                  <option value="active">Aktif (Dapat digunakan)</option>
                  <option value="inactive">Nonaktif / Dibekukan</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedSchoolForEdit(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {isUpdating ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
