import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  Download,
  Plus,
  KeyRound,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Mail,
  UserCheck,
  UserX,
  X,
  Shield,
  Eye,
  EyeOff,
  User,
  School,
  Lock,
  Award,
  BookOpen,
  GraduationCap,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';

export interface SchoolUsersTabProps {
  call: (action: string, payload?: any) => Promise<any>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  schools?: any[];
  onNavigateToSchool?: (schoolId: string) => void;
}

type UserCategory = 'admin' | 'headmaster' | 'homeroom' | 'subject_teacher' | 'student' | 'all';

interface PopupState {
  schoolId: string;
  schoolName: string;
  npsn?: string | null;
  category: UserCategory;
  categoryLabel: string;
  users: any[];
}

export const SchoolUsersTab: React.FC<SchoolUsersTabProps> = ({
  call,
  showToast,
  schools = [],
  onNavigateToSchool,
}) => {
  const [recapData, setRecapData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    total_schools: 0,
    total_admins: 0,
    total_headmasters: 0,
    total_homerooms: 0,
    total_subject_teachers: 0,
    total_students: 0,
    total_users: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Interactive Popup Modal state
  const [popupState, setPopupState] = useState<PopupState | null>(null);
  const [popupSearch, setPopupSearch] = useState('');
  const [popupRoleTab, setPopupRoleTab] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State Tambah Pengguna
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    school_id: '',
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'ADMIN',
  });
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [showAddPassword, setShowAddPassword] = useState(false);

  // Modal State Reset Sandi
  const [resetModalUser, setResetModalUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const loadRecap = async () => {
    setLoading(true);
    try {
      const res = await call('school_users_recap');
      if (res.ok) {
        setRecapData(res.recap || []);
        if (res.summary) setSummary(res.summary);
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat data rekapitulasi pengguna.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecap();
  }, []);

  // Filter Baris Tabel berdasarkan pencarian sekolah / NPSN / status
  const filteredRecap = useMemo(() => {
    return recapData.filter((item) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        (item.school_name && item.school_name.toLowerCase().includes(q)) ||
        (item.npsn && item.npsn.toLowerCase().includes(q)) ||
        (item.code && item.code.toLowerCase().includes(q));

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && item.status === 'active') ||
        (statusFilter === 'inactive' && item.status === 'inactive');

      return matchSearch && matchStatus;
    });
  }, [recapData, search, statusFilter]);

  // Buka Popup Data Pengguna saat angka diklik
  const handleCellClick = (
    item: any,
    category: UserCategory,
    categoryLabel: string
  ) => {
    const list = item.users?.[category] || [];
    setPopupSearch('');
    setPopupRoleTab('all');
    setPopupState({
      schoolId: item.school_id,
      schoolName: item.school_name,
      npsn: item.npsn,
      category,
      categoryLabel,
      users: list,
    });
  };

  // Filter Pengguna di dalam Popup
  const filteredPopupUsers = useMemo(() => {
    if (!popupState) return [];
    return popupState.users.filter((u) => {
      const q = popupSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.nisn && u.nisn.toLowerCase().includes(q)) ||
        (u.class_name && u.class_name.toLowerCase().includes(q));

      let matchRole = true;
      if (popupState.category === 'all' && popupRoleTab !== 'all') {
        matchRole = (u.role || '').toUpperCase() === popupRoleTab.toUpperCase();
      }

      return matchSearch && matchRole;
    });
  }, [popupState, popupSearch, popupRoleTab]);

  // Handle Tambah Akun Pengguna Baru
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.school_id) {
      showToast('Pilih sekolah / ruang kerja terlebih dahulu.', 'error');
      return;
    }
    if (!addForm.name.trim() || !addForm.username.trim() || !addForm.password.trim()) {
      showToast('Nama, username, dan kata sandi wajib diisi.', 'error');
      return;
    }
    if (addForm.password.length < 8) {
      showToast('Kata sandi minimal 8 karakter.', 'error');
      return;
    }

    setIsSubmittingAdd(true);
    try {
      const res = await call('create_user', {
        school_id: addForm.school_id,
        name: addForm.name.trim(),
        username: addForm.username.trim().toLowerCase(),
        email: addForm.email.trim().toLowerCase() || null,
        password: addForm.password,
        role: addForm.role,
      });

      if (res.ok) {
        showToast(`Akun ${addForm.role} atas nama ${addForm.name} berhasil dibuat!`, 'success');
        setIsAddUserOpen(false);
        setAddForm({
          school_id: '',
          name: '',
          username: '',
          email: '',
          password: '',
          role: 'ADMIN',
        });
        loadRecap();
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal membuat akun pengguna.', 'error');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Handle Reset Sandi Pengguna
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser || !newPassword || newPassword.length < 8) {
      showToast('Kata sandi baru minimal 8 karakter.', 'error');
      return;
    }

    setIsResetting(true);
    try {
      const res = await call('reset_admin_password', {
        user_id: resetModalUser.id || resetModalUser.profile_id,
        password: newPassword,
      });

      if (res.ok) {
        showToast(`Kata sandi untuk ${resetModalUser.name} berhasil diperbarui.`, 'success');
        setResetModalUser(null);
        setNewPassword('');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal mereset kata sandi.', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  // Handle Salin Info Akun
  const handleCopyCredentials = (u: any) => {
    const text = `Akun Kawacanaan:\nNama: ${u.name}\nUsername: ${u.username || u.nisn}\nRole: ${u.role}\nInstansi: ${popupState?.schoolName || '-'}`;
    navigator.clipboard.writeText(text);
    setCopiedId(u.id);
    showToast('Info akun berhasil disalin ke clipboard!', 'info');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getCategoryIcon = (category: UserCategory) => {
    switch (category) {
      case 'admin':
        return <Shield size={16} className="text-blue-600" />;
      case 'headmaster':
        return <Award size={16} className="text-purple-600" />;
      case 'homeroom':
        return <Users size={16} className="text-emerald-600" />;
      case 'subject_teacher':
        return <BookOpen size={16} className="text-amber-600" />;
      case 'student':
        return <GraduationCap size={16} className="text-sky-600" />;
      default:
        return <Building2 size={16} className="text-indigo-600" />;
    }
  };

  return (
    <div className="space-y-4 select-none">
      {/* ========================================================================= */}
      {/* 1. HEADER & GLOBAL SUMMARY RECAPITULATION CARDS                           */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Rekapitulasi Pengguna per Sekolah</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
              Multi-Tenant
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tabel rekapitulasi data Admin, Kepala Sekolah, Wali Kelas, Guru Mapel, dan Siswa. Klik angka pada tabel untuk melihat rincian pengguna.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadRecap}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-blue-600' : ''} />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddUserOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
          >
            <Plus size={14} />
            <span>Tambah Akun Baru</span>
          </button>
        </div>
      </div>

      {/* Grid Ringkasan Global */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {/* Sekolah */}
        <div className="bg-white rounded-2xl border border-slate-100 p-3 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            <School size={13} className="text-slate-500" />
            <span>Total Sekolah</span>
          </div>
          <div className="mt-1.5 text-xl font-black text-slate-900">
            {summary.total_schools}
          </div>
          <div className="text-[10px] text-slate-400 font-medium mt-0.5">Instansi tenant</div>
        </div>

        {/* Admin */}
        <div className="bg-white rounded-2xl border border-blue-100 p-3 shadow-2xs flex flex-col justify-between bg-blue-50/20">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700">
            <Shield size={13} className="text-blue-600" />
            <span>Admin</span>
          </div>
          <div className="mt-1.5 text-xl font-black text-blue-950">
            {summary.total_admins}
          </div>
          <div className="text-[10px] text-blue-600 font-medium mt-0.5">Operator sekolah</div>
        </div>

        {/* Kepala Sekolah */}
        <div className="bg-white rounded-2xl border border-purple-100 p-3 shadow-2xs flex flex-col justify-between bg-purple-50/20">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-700">
            <Award size={13} className="text-purple-600" />
            <span>Kepala Sekolah</span>
          </div>
          <div className="mt-1.5 text-xl font-black text-purple-950">
            {summary.total_headmasters}
          </div>
          <div className="text-[10px] text-purple-600 font-medium mt-0.5">Pimpinan instansi</div>
        </div>

        {/* Wali Kelas */}
        <div className="bg-white rounded-2xl border border-emerald-100 p-3 shadow-2xs flex flex-col justify-between bg-emerald-50/20">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
            <Users size={13} className="text-emerald-600" />
            <span>Wali Kelas</span>
          </div>
          <div className="mt-1.5 text-xl font-black text-emerald-950">
            {summary.total_homerooms}
          </div>
          <div className="text-[10px] text-emerald-600 font-medium mt-0.5">Pembina rombel</div>
        </div>

        {/* Guru Mapel */}
        <div className="bg-white rounded-2xl border border-amber-100 p-3 shadow-2xs flex flex-col justify-between bg-amber-50/20">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700">
            <BookOpen size={13} className="text-amber-600" />
            <span>Guru Mapel</span>
          </div>
          <div className="mt-1.5 text-xl font-black text-amber-950">
            {summary.total_subject_teachers}
          </div>
          <div className="text-[10px] text-amber-600 font-medium mt-0.5">Pengajar kurikulum</div>
        </div>

        {/* Siswa */}
        <div className="bg-white rounded-2xl border border-sky-100 p-3 shadow-2xs flex flex-col justify-between bg-sky-50/20">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-700">
            <GraduationCap size={13} className="text-sky-600" />
            <span>Siswa</span>
          </div>
          <div className="mt-1.5 text-xl font-black text-sky-950">
            {summary.total_students.toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-sky-600 font-medium mt-0.5">Peserta didik</div>
        </div>

        {/* Total Pengguna */}
        <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-3 shadow-md text-white flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-100">
            <UserCheck size={13} className="text-indigo-200" />
            <span>Total Pengguna</span>
          </div>
          <div className="mt-1.5 text-xl font-black text-white tracking-tight">
            {summary.total_users.toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-indigo-200 font-medium mt-0.5">Semua entitas</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SEARCH & FILTER TOOLBAR                                                */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-3 flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama sekolah / NPSN..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter size={13} className="text-slate-400" />
            <span className="text-[11px] font-semibold">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-xs font-semibold px-2.5 py-1 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="active">Sekolah Aktif</option>
              <option value="inactive">Sekolah Nonaktif</option>
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. TABEL REKAPITULASI PENGGUNA PER SEKOLAH (PERSIS SPESIFIKASI USER)      */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/90 text-slate-700 border-b border-slate-200/80 uppercase font-black text-[10.5px] tracking-wider">
                <th className="py-3 px-4 min-w-[220px]">Sekolah (Nama Sekolah)</th>
                <th className="py-3 px-3 text-center min-w-[85px]">Admin</th>
                <th className="py-3 px-3 text-center min-w-[110px]">Kepala Sekolah</th>
                <th className="py-3 px-3 text-center min-w-[95px]">Wali Kelas</th>
                <th className="py-3 px-3 text-center min-w-[95px]">Guru Mapel</th>
                <th className="py-3 px-3 text-center min-w-[85px]">Siswa</th>
                <th className="py-3 px-4 text-center min-w-[125px] bg-slate-100/70">Jumlah Pengguna</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={22} className="animate-spin text-blue-600" />
                      <span className="text-xs font-medium">Memuat data rekapitulasi sekolah...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRecap.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <School size={28} className="text-slate-300" />
                      <span className="text-xs font-semibold text-slate-600">
                        Tidak ada data sekolah yang sesuai dengan pencarian.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecap.map((item, idx) => (
                  <tr
                    key={item.school_id || idx}
                    className="hover:bg-blue-50/30 transition-colors group"
                  >
                    {/* Kolom 1: Sekolah (Nama Sekolah) */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-100">
                          <School size={15} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                            <span className="truncate">{item.school_name}</span>
                            {item.status === 'active' ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Aktif" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" title="Nonaktif" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10.5px] text-slate-400 mt-0.5">
                            <span>NPSN: {item.npsn || '-'}</span>
                            {item.code && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-slate-500">{item.code}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Kolom 2: Admin (Clickable Number) */}
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleCellClick(item, 'admin', 'Admin')}
                        className={`inline-flex items-center justify-center min-w-[34px] px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                          item.admin_count > 0
                            ? 'bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200/60 shadow-2xs'
                            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                        }`}
                        title={`Klik untuk melihat detail ${item.admin_count} Admin`}
                      >
                        {item.admin_count}
                      </button>
                    </td>

                    {/* Kolom 3: Kepala Sekolah (Clickable Number) */}
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleCellClick(item, 'headmaster', 'Kepala Sekolah')}
                        className={`inline-flex items-center justify-center min-w-[34px] px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                          item.headmaster_count > 0
                            ? 'bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white border border-purple-200/60 shadow-2xs'
                            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                        }`}
                        title={`Klik untuk melihat detail ${item.headmaster_count} Kepala Sekolah`}
                      >
                        {item.headmaster_count}
                      </button>
                    </td>

                    {/* Kolom 4: Wali Kelas (Clickable Number) */}
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleCellClick(item, 'homeroom', 'Wali Kelas')}
                        className={`inline-flex items-center justify-center min-w-[34px] px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                          item.homeroom_count > 0
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200/60 shadow-2xs'
                            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                        }`}
                        title={`Klik untuk melihat detail ${item.homeroom_count} Wali Kelas`}
                      >
                        {item.homeroom_count}
                      </button>
                    </td>

                    {/* Kolom 5: Guru Mapel (Clickable Number) */}
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleCellClick(item, 'subject_teacher', 'Guru Mapel')}
                        className={`inline-flex items-center justify-center min-w-[34px] px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                          item.subject_teacher_count > 0
                            ? 'bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white border border-amber-200/60 shadow-2xs'
                            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                        }`}
                        title={`Klik untuk melihat detail ${item.subject_teacher_count} Guru Mapel`}
                      >
                        {item.subject_teacher_count}
                      </button>
                    </td>

                    {/* Kolom 6: Siswa (Clickable Number) */}
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleCellClick(item, 'student', 'Siswa')}
                        className={`inline-flex items-center justify-center min-w-[34px] px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                          item.student_count > 0
                            ? 'bg-sky-50 text-sky-700 hover:bg-sky-600 hover:text-white border border-sky-200/60 shadow-2xs'
                            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                        }`}
                        title={`Klik untuk melihat detail ${item.student_count} Siswa`}
                      >
                        {item.student_count.toLocaleString('id-ID')}
                      </button>
                    </td>

                    {/* Kolom 7: Jumlah Pengguna (Clickable Number - Highlighted) */}
                    <td className="py-3 px-4 text-center bg-slate-50/50">
                      <button
                        type="button"
                        onClick={() => handleCellClick(item, 'all', 'Semua Pengguna')}
                        className={`inline-flex items-center justify-center min-w-[42px] px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 ${
                          item.total_users > 0
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs'
                            : 'text-slate-400 hover:bg-slate-200'
                        }`}
                        title={`Klik untuk melihat total ${item.total_users} Pengguna di ${item.school_name}`}
                      >
                        {item.total_users.toLocaleString('id-ID')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Total Row di Bawah Tabel */}
            {filteredRecap.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/80 font-black text-slate-800 border-t-2 border-slate-200">
                  <td className="py-3 px-4">
                    <span className="text-xs font-black">TOTAL KESELURUHAN ({filteredRecap.length} SEKOLAH)</span>
                  </td>
                  <td className="py-3 px-3 text-center text-blue-700">
                    {filteredRecap.reduce((acc, r) => acc + r.admin_count, 0)}
                  </td>
                  <td className="py-3 px-3 text-center text-purple-700">
                    {filteredRecap.reduce((acc, r) => acc + r.headmaster_count, 0)}
                  </td>
                  <td className="py-3 px-3 text-center text-emerald-700">
                    {filteredRecap.reduce((acc, r) => acc + r.homeroom_count, 0)}
                  </td>
                  <td className="py-3 px-3 text-center text-amber-700">
                    {filteredRecap.reduce((acc, r) => acc + r.subject_teacher_count, 0)}
                  </td>
                  <td className="py-3 px-3 text-center text-sky-700">
                    {filteredRecap.reduce((acc, r) => acc + r.student_count, 0).toLocaleString('id-ID')}
                  </td>
                  <td className="py-3 px-4 text-center text-indigo-900 bg-slate-200/60 font-black">
                    {filteredRecap.reduce((acc, r) => acc + r.total_users, 0).toLocaleString('id-ID')}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. POPUP MODAL DATA PENGGUNA (MUNCUL KETIKA ANGKA DIKLIK)                 */}
      {/* ========================================================================= */}
      {popupState && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0 bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center shrink-0">
                  {getCategoryIcon(popupState.category)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900">
                      Rincian {popupState.categoryLabel}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                      {popupState.users.length} pengguna
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <span className="font-semibold text-slate-700">{popupState.schoolName}</span>
                    {popupState.npsn && <span>• NPSN: {popupState.npsn}</span>}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPopupState(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Toolbar Filter di dalam Modal */}
            <div className="px-5 py-3 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
              <div className="relative w-full sm:w-80">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={popupSearch}
                  onChange={(e) => setPopupSearch(e.target.value)}
                  placeholder="Cari nama, username, email, NISN, atau kelas..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {popupSearch && (
                  <button
                    onClick={() => setPopupSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Tab filter per role jika sedang melihat 'Semua Pengguna' */}
              {popupState.category === 'all' && (
                <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0">
                  {['all', 'ADMIN', 'KEPALA SEKOLAH', 'WALI KELAS', 'GURU MAPEL', 'SISWA'].map((r) => (
                    <button
                      key={r}
                      onClick={() => setPopupRoleTab(r)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                        popupRoleTab === r
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {r === 'all' ? 'Semua Role' : r}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* List Tabel Pengguna */}
            <div className="flex-1 overflow-y-auto p-5">
              {filteredPopupUsers.length === 0 ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <User size={32} className="text-slate-300" />
                  <span className="text-xs font-bold text-slate-600">
                    {popupSearch
                      ? 'Tidak ada pengguna yang cocok dengan pencarian.'
                      : `Belum ada data ${popupState.categoryLabel.toLowerCase()} terdaftar di sekolah ini.`}
                  </span>
                </div>
              ) : (
                <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 border-b border-slate-200/80 font-black text-[10.5px] uppercase tracking-wider">
                        <th className="py-2.5 px-3 w-10 text-center">No</th>
                        <th className="py-2.5 px-3">Nama Lengkap</th>
                        <th className="py-2.5 px-3">Username / NISN</th>
                        <th className="py-2.5 px-3">Role / Jabatan</th>
                        <th className="py-2.5 px-3">Email / Kontak</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPopupUsers.map((u, i) => {
                        const roleUpper = (u.role || '').toUpperCase();
                        let roleBadgeClass = 'bg-slate-100 text-slate-700';
                        if (roleUpper === 'ADMIN') roleBadgeClass = 'bg-blue-100 text-blue-800 border-blue-200';
                        else if (roleUpper === 'KEPALA SEKOLAH') roleBadgeClass = 'bg-purple-100 text-purple-800 border-purple-200';
                        else if (roleUpper === 'WALI KELAS') roleBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                        else if (roleUpper === 'GURU MAPEL') roleBadgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
                        else if (roleUpper === 'SISWA') roleBadgeClass = 'bg-sky-100 text-sky-800 border-sky-200';

                        const isUserActive = u.is_active !== false && u.status !== 'inactive';

                        return (
                          <tr key={u.id || i} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3 text-center text-slate-400 font-medium">
                              {i + 1}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                                  {u.name ? u.name.charAt(0).toUpperCase() : '?'}
                                </div>
                                <span>{u.name}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">
                              {u.username || u.nisn || '-'}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black border ${roleBadgeClass}`}
                              >
                                {u.role}
                              </span>
                              {u.class_name && (
                                <span className="ml-1 text-[10px] text-slate-500 font-medium">
                                  ({u.class_name})
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">
                              {u.email || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isUserActive
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                                }`}
                              >
                                {isUserActive ? 'Aktif' : 'Nonaktif'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleCopyCredentials(u)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                                  title="Salin Info Pengguna"
                                >
                                  {copiedId === u.id ? (
                                    <Check size={13} className="text-emerald-600" />
                                  ) : (
                                    <Copy size={13} />
                                  )}
                                </button>
                                {u.profile_id && (
                                  <button
                                    type="button"
                                    onClick={() => setResetModalUser(u)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                                    title="Reset Sandi"
                                  >
                                    <KeyRound size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span>
                Menampilkan <strong className="text-slate-800">{filteredPopupUsers.length}</strong> dari{' '}
                {popupState.users.length} data
              </span>
              <button
                type="button"
                onClick={() => setPopupState(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL TAMBAH PENGGUNA BARU                                            */}
      {/* ========================================================================= */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Users size={16} />
                </div>
                <h3 className="text-sm font-black text-slate-900">Tambah Akun Pengguna Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddUserOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Sekolah / Instansi *</label>
                <select
                  required
                  value={addForm.school_id}
                  onChange={(e) => setAddForm({ ...addForm, school_id: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-blue-600"
                >
                  <option value="">-- Pilih Sekolah / Instansi --</option>
                  {recapData.map((s) => (
                    <option key={s.school_id} value={s.school_id}>
                      {s.school_name} {s.npsn ? `(${s.npsn})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Role Akun *</label>
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-blue-600"
                >
                  <option value="ADMIN">Admin Sekolah</option>
                  <option value="KEPALA SEKOLAH">Kepala Sekolah</option>
                  <option value="WALI KELAS">Wali Kelas</option>
                  <option value="GURU MAPEL">Guru Mata Pelajaran</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="cth. Budi Santoso, S.Pd."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={addForm.username}
                    onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                    placeholder="cth. budi_admin"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email (Opsional)</label>
                  <input
                    type="email"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    placeholder="budi@sekolah.sch.id"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kata Sandi *</label>
                <div className="relative">
                  <input
                    type={showAddPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    placeholder="Minimal 8 karakter"
                    className="w-full px-3.5 py-2 pr-10 rounded-xl border border-slate-200 text-xs font-medium focus:outline-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddPassword(!showAddPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showAddPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {isSubmittingAdd ? 'Menyimpan...' : 'Buat Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL RESET PASSWORD                                                  */}
      {/* ========================================================================= */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-100">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <KeyRound size={16} />
                </div>
                <h3 className="text-sm font-black text-slate-900">Reset Kata Sandi</h3>
              </div>
              <button
                type="button"
                onClick={() => setResetModalUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Tetapkan sandi login baru untuk pengguna <strong className="text-slate-900">{resetModalUser.name}</strong> (@{resetModalUser.username}).
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kata Sandi Baru *</label>
                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2 pr-10 rounded-xl border border-slate-200 text-xs font-medium focus:outline-amber-600"
                    placeholder="Minimal 8 karakter"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showResetPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {isResetting ? 'Menyimpan...' : 'Simpan Sandi Baru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
