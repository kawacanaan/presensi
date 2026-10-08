import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  FileText,
  Calendar,
  User,
  Phone,
  MessageSquare,
  Eye,
  Clock,
  Search,
  Filter,
  AlertCircle,
  Check,
  PlusCircle,
  Sparkles,
  ChevronDown,
  Upload,
  HeartPulse,
  Send,
  Loader2,
  ShieldCheck,
  ArrowRight,
  Inbox,
} from 'lucide-react';
import type { StudentLeaveRequest, Student } from '../types';
import { LeaveAttachmentLightbox } from './LeaveAttachmentLightbox';
import { useApp } from '../context/AppContext';

interface TeacherLeaveApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  leaveRequests: StudentLeaveRequest[];
  onUpdateStatus: (
    requestId: string,
    status: 'APPROVED' | 'REJECTED',
    reviewNotes?: string
  ) => Promise<{ success: boolean; message?: string }>;
  selectedClassName?: string;
  selectedClassId?: string;
  schoolId?: string;
}

const normalizeClassStr = (s?: string | null) =>
  s ? s.toLowerCase().replace(/^(kelas|kls)\s+/i, '').replace(/[^a-z0-9]/g, '') : '';

export const TeacherLeaveApprovalModal: React.FC<TeacherLeaveApprovalModalProps> = ({
  isOpen,
  onClose,
  leaveRequests,
  onUpdateStatus,
  selectedClassName,
  selectedClassId,
  schoolId,
}) => {
  const { students, currentUser, activeWorkspace, submitLeaveRequest } = useApp();

  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [filterClassOnly, setFilterClassOnly] = useState<boolean>(Boolean(selectedClassName));
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  // Mode Buat Permohonan Baru (untuk Guru/Admin yang menerima surat fisik/WA secara langsung)
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [newStudentId, setNewStudentId] = useState<string>('');
  const [newLeaveType, setNewLeaveType] = useState<'sakit' | 'izin'>('sakit');
  const [newSubCategory, setNewSubCategory] = useState<string>('Sakit (Surat Dokter)');
  const [newStartDate, setNewStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [newEndDate, setNewEndDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [newRequesterName, setNewRequesterName] = useState<string>('Orang Tua Siswa');
  const [newRequesterRole, setNewRequesterRole] = useState<'Ayah' | 'Ibu' | 'Wali' | 'Siswa'>('Ibu');
  const [newRequesterPhone, setNewRequesterPhone] = useState<string>('');
  const [newReason, setNewReason] = useState<string>('');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState<string>('');
  const [newAttachmentName, setNewAttachmentName] = useState<string>('');
  const [isSubmittingNew, setIsSubmittingNew] = useState<boolean>(false);
  const [createErrorMsg, setCreateErrorMsg] = useState<string>('');

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !lightboxImage) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, lightboxImage, onClose]);

  const isPersonal = useMemo(() => {
    return (
      activeWorkspace?.workspaceType === 'personal' ||
      activeWorkspace?.workspaceType === 'individu' ||
      (!currentUser?.schoolId && currentUser?.role !== 'SUPER_ADMIN')
    );
  }, [activeWorkspace?.workspaceType, currentUser?.schoolId, currentUser?.role]);

  const effectiveSchoolId = schoolId || activeWorkspace?.workspaceId || currentUser?.schoolId;

  // Filter siswa yang relevan untuk form pembuatan baru
  const candidateStudents = useMemo(() => {
    if (!students || students.length === 0) return [];
    if (selectedClassId) {
      return students.filter((s) => s.classId === selectedClassId);
    }
    if (selectedClassName) {
      const norm = normalizeClassStr(selectedClassName);
      return students.filter((s) => normalizeClassStr(s.className) === norm);
    }
    return students;
  }, [students, selectedClassId, selectedClassName]);

  // Set default student saat membuka form pembuatan baru
  useEffect(() => {
    if (candidateStudents.length > 0 && !newStudentId) {
      setNewStudentId(candidateStudents[0].id);
    }
  }, [candidateStudents, newStudentId]);

  if (!isOpen) return null;

  const isMatchingClass = (req: StudentLeaveRequest) => {
    if (!filterClassOnly || !selectedClassName) return true;
    if (selectedClassId && req.classId && req.classId === selectedClassId) return true;
    if (req.className && normalizeClassStr(req.className) === normalizeClassStr(selectedClassName)) return true;
    return false;
  };

  const visibleBase = (leaveRequests || []).filter((req) => {
    // Isolasi sekolah: jangan pernah tampilkan pengajuan dari sekolah lain
    if (effectiveSchoolId && req.schoolId && req.schoolId !== effectiveSchoolId) return false;
    if (filterClassOnly && selectedClassName) return isMatchingClass(req);
    return true;
  });

  const pendingCount = visibleBase.filter((r) => r.status === 'PENDING').length;
  const approvedCount = visibleBase.filter((r) => r.status === 'APPROVED').length;
  const rejectedCount = visibleBase.filter((r) => r.status === 'REJECTED').length;

  const filteredRequests = visibleBase.filter((req) => {
    if (filterStatus !== 'ALL' && req.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = req.studentName.toLowerCase().includes(q);
      const matchNisn = req.nisn?.toLowerCase().includes(q);
      const matchParent = req.requesterName.toLowerCase().includes(q);
      const matchReason = req.reason.toLowerCase().includes(q);
      const matchClass = (req.className || '').toLowerCase().includes(q);
      if (!matchName && !matchNisn && !matchParent && !matchReason && !matchClass) return false;
    }
    return true;
  });

  const handleApprove = async (id: string) => {
    setIsProcessing(id);
    try {
      await onUpdateStatus(id, 'APPROVED');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleRejectSubmit = async (id: string) => {
    setIsProcessing(id);
    try {
      await onUpdateStatus(id, 'REJECTED', rejectReason || 'Ditolak oleh pihak sekolah/wali kelas');
      setRejectingId(null);
      setRejectReason('');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleChatWhatsApp = (phone: string, studentName: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('0') ? `62${cleanPhone.slice(1)}` : cleanPhone;
    const text = encodeURIComponent(
      `Halo Bapak/Ibu Wali dari ${studentName}, kami dari pihak sekolah terkait surat permohonan izin/sakit yang diajukan...`
    );
    const url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${text}`;
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Submit manual creation by teacher/admin
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetStudent = candidateStudents.find((s) => s.id === newStudentId) || candidateStudents[0];
    if (!targetStudent) {
      setCreateErrorMsg('Pilih siswa yang bersangkutan terlebih dahulu.');
      return;
    }
    if (!newReason.trim()) {
      setCreateErrorMsg('Alasan pengajuan izin / sakit wajib diisi.');
      return;
    }

    setIsSubmittingNew(true);
    setCreateErrorMsg('');

    try {
      const res = await submitLeaveRequest({
        studentId: targetStudent.id,
        studentName: targetStudent.nama,
        nisn: targetStudent.nisn,
        classId: targetStudent.classId,
        className: targetStudent.className,
        requesterName: newRequesterName.trim() || 'Wali Murid',
        requesterRole: newRequesterRole,
        requesterPhone: newRequesterPhone.trim() || undefined,
        leaveType: newLeaveType,
        subCategory: newSubCategory,
        startDate: newStartDate,
        endDate: newEndDate,
        reason: newReason.trim(),
        attachmentUrl: newAttachmentUrl || undefined,
        attachmentName: newAttachmentName || undefined,
      });

      if (res.success) {
        setIsCreatingNew(false);
        setNewReason('');
        setNewAttachmentUrl('');
        setNewAttachmentName('');
        setFilterStatus('PENDING');
      } else {
        setCreateErrorMsg(res.message || 'Gagal menyimpan permohonan izin.');
      }
    } catch (err: any) {
      setCreateErrorMsg(err?.message || 'Gagal menyimpan permohonan.');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 md:p-6 lg:p-8 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing && !isSubmittingNew) onClose();
      }}
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-full sm:max-w-2xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl my-auto overflow-hidden shadow-2xl border border-slate-200/90 flex flex-col max-h-[96vh] sm:max-h-[92vh] transition-all">
        
        {/* Modern Commercial Header */}
        <div className="p-3.5 sm:p-4 md:p-5 border-b border-slate-200/80 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-white/10 border border-white/15 text-blue-300 flex items-center justify-center shadow-xs shrink-0">
              <FileText size={20} className="sm:w-5.5 sm:h-5.5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-base sm:text-lg tracking-tight text-white leading-snug">
                  Verifikasi Surat Izin & Sakit Siswa
                </h3>
                {pendingCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400 text-amber-950 font-black text-[11px] shadow-2xs animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-900" />
                    {pendingCount} Menunggu Verifikasi
                  </span>
                )}
              </div>
              <p className="text-xs text-blue-200/90 font-medium mt-0.5">
                {isPersonal ? 'Ruang Kerja Mandiri' : 'Ruang Kerja Sekolah'}
                {selectedClassName ? ` • Rombel ${selectedClassName}` : ' • Seluruh Kelas Terdaftar'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isCreatingNew && (
              <button
                type="button"
                onClick={() => setIsCreatingNew(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-extrabold text-xs shadow-xs cursor-pointer transition-all"
              >
                <PlusCircle size={14} />
                <span>+ Buat Surat Baru</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Tutup dialog"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Toolbar & Filter Bar */}
        {!isCreatingNew && (
          <div className="p-3 sm:p-4 bg-slate-50/90 border-b border-slate-200/80 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shrink-0">
            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setFilterStatus('PENDING')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterStatus === 'PENDING'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Menunggu</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterStatus === 'PENDING' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    {pendingCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterStatus('APPROVED')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterStatus === 'APPROVED'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Disetujui</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterStatus === 'APPROVED' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    {approvedCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterStatus('REJECTED')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterStatus === 'REJECTED'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Ditolak</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterStatus === 'REJECTED' ? 'bg-rose-700 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    {rejectedCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterStatus('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterStatus === 'ALL'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua ({visibleBase.length})
                </button>
              </div>

              {/* Toggle Class Filter (jika ada selectedClassName) */}
              {selectedClassName && (
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setFilterClassOnly(true)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      filterClassOnly
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {selectedClassName}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterClassOnly(false)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      !filterClassOnly
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua Rombel
                  </button>
                </div>
              )}
            </div>

            {/* Search and Mobile Create Button */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 lg:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari siswa, NISN, wali murid..."
                  className="w-full pl-8.5 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-blue-600 shadow-2xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsCreatingNew(true)}
                className="sm:hidden px-3 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center gap-1 shrink-0"
              >
                <PlusCircle size={14} />
                <span>+ Buat</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal Main Content */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 md:p-6 font-sans">
          
          {/* Mode 1: Form Buat Surat Izin / Sakit Baru oleh Guru/Admin */}
          {isCreatingNew ? (
            <div className="max-w-3xl mx-auto space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h4 className="text-base font-black text-slate-900">Input Permohonan Izin / Sakit Siswa</h4>
                  <p className="text-xs text-slate-500">
                    Catat permohonan surat izin atau keterangan dokter yang diterima secara offline atau pesan WA
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold cursor-pointer"
                >
                  Kembali ke Daftar
                </button>
              </div>

              {createErrorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 text-xs font-semibold">
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  <span>{createErrorMsg}</span>
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                {/* Pilih Siswa */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
                  <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                    Pilih Siswa Target
                  </label>
                  <select
                    value={newStudentId}
                    onChange={(e) => setNewStudentId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600"
                    required
                  >
                    {candidateStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nama} ({s.className || 'Kelas'} • NISN: {s.nisn || '-'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Jenis & Kategori */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                      Jenis Permohonan
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNewLeaveType('sakit');
                          setNewSubCategory('Sakit (Surat Dokter)');
                        }}
                        className={`py-2.5 px-3 rounded-xl border-2 font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          newLeaveType === 'sakit'
                            ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <HeartPulse size={16} className={newLeaveType === 'sakit' ? 'text-rose-600' : 'text-slate-400'} />
                        <span>Sakit (S)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setNewLeaveType('izin');
                          setNewSubCategory('Acara Keluarga / Mendesak');
                        }}
                        className={`py-2.5 px-3 rounded-xl border-2 font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          newLeaveType === 'izin'
                            ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <FileText size={16} className={newLeaveType === 'izin' ? 'text-amber-600' : 'text-slate-400'} />
                        <span>Izin (I)</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                      Kategori Keterangan
                    </label>
                    <select
                      value={newSubCategory}
                      onChange={(e) => setNewSubCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600"
                    >
                      {newLeaveType === 'sakit' ? (
                        <>
                          <option value="Sakit (Surat Dokter)">Sakit (Dengan Surat Keterangan Dokter)</option>
                          <option value="Sakit (Istirahat di Rumah)">Sakit (Istirahat di Rumah / Rawat Jalan)</option>
                          <option value="Sakit (Rawat Inap / Rumah Sakit)">Sakit (Rawat Inap / Rumah Sakit)</option>
                        </>
                      ) : (
                        <>
                          <option value="Acara Keluarga / Mendesak">Acara Keluarga / Keperluan Mendesak</option>
                          <option value="Dispensasi Kegiatan / Lomba">Dispensasi Lomba / Kegiatan Resmi</option>
                          <option value="Ibadah / Keagamaan">Ibadah / Keagamaan</option>
                          <option value="Lainnya">Keperluan Mendesak Lainnya</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* Rentang Tanggal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Mulai Tanggal</label>
                    <input
                      type="date"
                      value={newStartDate}
                      onChange={(e) => {
                        setNewStartDate(e.target.value);
                        if (e.target.value > newEndDate) setNewEndDate(e.target.value);
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Sampai Tanggal</label>
                    <input
                      type="date"
                      value={newEndDate}
                      min={newStartDate}
                      onChange={(e) => setNewEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600"
                      required
                    />
                  </div>
                </div>

                {/* Alasan */}
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                    Alasan / Keterangan Surat
                  </label>
                  <textarea
                    rows={3}
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                    placeholder="Tuliskan keterangan sakit atau keperluan izin ananda..."
                    required
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-blue-600 resize-none leading-relaxed"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsCreatingNew(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingNew}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {isSubmittingNew ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        <span>Simpan & Terbitkan Surat</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Mode 2: Daftar Permohonan Izin / Sakit */
            <div className="space-y-3.5">
              {filteredRequests.length === 0 ? (
                <div className="text-center py-16 px-4 space-y-3 max-w-md mx-auto">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto shadow-2xs">
                    {filterStatus === 'PENDING' ? (
                      <CheckCircle2 size={30} className="text-emerald-600" />
                    ) : (
                      <Inbox size={30} />
                    )}
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-800">
                      {filterStatus === 'PENDING'
                        ? 'Tidak Ada Surat Izin yang Menunggu'
                        : 'Tidak Ada Data Ditemukan'}
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed mt-1">
                      {filterStatus === 'PENDING'
                        ? 'Semua permohonan surat izin dan keterangan dokter telah ditindaklanjuti. Stabilitas absensi kelas terjaga.'
                        : 'Tidak ada surat permohonan izin/sakit yang sesuai dengan kriteria pencarian atau filter saat ini.'}
                    </p>
                  </div>
                  {filterStatus !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterStatus('ALL');
                        setSearchQuery('');
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
                    >
                      Tampilkan Semua Status
                    </button>
                  )}
                </div>
              ) : (
                filteredRequests.map((req) => {
                  const isPending = req.status === 'PENDING';
                  const isApproved = req.status === 'APPROVED';
                  const isRejected = req.status === 'REJECTED';

                  return (
                    <div
                      key={req.id}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all shadow-2xs ${
                        isPending
                          ? 'bg-amber-50/25 border-amber-300/80 hover:border-amber-400'
                          : isApproved
                          ? 'bg-emerald-50/20 border-emerald-200'
                          : 'bg-slate-50/60 border-slate-200'
                      }`}
                    >
                      {/* Responsive Grid Card Layout */}
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        
                        {/* Col 1: Student & Request Meta */}
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border shadow-2xs ${
                                req.leaveType === 'sakit'
                                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                                  : 'bg-amber-100 text-amber-900 border-amber-300'
                              }`}
                            >
                              {req.leaveType === 'sakit' ? '🤒 SAKIT' : '📝 IZIN RESMI'}
                            </span>

                            {req.subCategory && (
                              <span className="text-[10px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                                {req.subCategory}
                              </span>
                            )}

                            <span
                              className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                                isPending
                                  ? 'bg-amber-200/90 text-amber-950 font-black'
                                  : isApproved
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {isPending
                                ? '⏳ Menunggu Verifikasi'
                                : isApproved
                                ? '✅ Disetujui'
                                : '❌ Ditolak'}
                            </span>
                          </div>

                          <div className="flex items-baseline gap-2 flex-wrap">
                            <h4 className="text-base font-black text-slate-900 tracking-tight">
                              {req.studentName}
                            </h4>
                            <span className="text-xs font-semibold text-slate-500">
                              • Rombel {req.className || 'Kelas'} • NISN: {req.nisn || '-'}
                            </span>
                          </div>

                          {/* Info Waktu & Pemohon */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 pt-0.5">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={13} className="text-blue-600 shrink-0" />
                              <span>
                                Tanggal: <strong className="text-slate-800">{req.startDate}</strong>
                                {req.endDate && req.endDate !== req.startDate ? ` s/d ${req.endDate}` : ''}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <User size={13} className="text-blue-600 shrink-0" />
                              <span>
                                Pemohon: <strong className="text-slate-800">{req.requesterName}</strong> ({req.requesterRole})
                              </span>
                            </div>
                          </div>

                          {/* Keterangan / Alasan */}
                          <div className="bg-white/90 p-3 rounded-xl border border-slate-200/90 text-xs text-slate-700 shadow-2xs">
                            <span className="font-extrabold text-slate-800 block mb-0.5 text-[11px] uppercase tracking-wider">
                              Alasan / Catatan:
                            </span>
                            <p className="leading-relaxed italic text-slate-700">{req.reason}</p>
                          </div>

                          {/* Lampiran Bukti Foto Surat Dokter */}
                          {req.attachmentUrl && (
                            <div className="pt-1 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setLightboxImage(req.attachmentUrl!)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200/80 transition-colors cursor-pointer shadow-2xs"
                              >
                                <Eye size={13} />
                                <span>Lihat Berkas Foto / Surat Dokter</span>
                              </button>
                            </div>
                          )}

                          {/* Informasi Review */}
                          {req.reviewedBy && (
                            <div className="text-[11px] text-slate-500 pt-0.5 flex items-center gap-1.5 flex-wrap">
                              <ShieldCheck size={13} className="text-emerald-600" />
                              <span>Diverifikasi oleh: <strong className="text-slate-700">{req.reviewedBy}</strong></span>
                              {req.reviewNotes && <span>• Catatan: <em className="text-slate-600">"{req.reviewNotes}"</em></span>}
                            </div>
                          )}
                        </div>

                        {/* Col 2: Action Buttons */}
                        <div className="flex sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200">
                          {req.requesterPhone && (
                            <button
                              type="button"
                              onClick={() => handleChatWhatsApp(req.requesterPhone!, req.studentName)}
                              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all"
                              title="Kirim pesan WhatsApp ke Orang Tua"
                            >
                              <MessageSquare size={14} />
                              <span>Chat WhatsApp</span>
                            </button>
                          )}

                          {isPending && (
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <button
                                type="button"
                                disabled={isProcessing === req.id}
                                onClick={() => handleApprove(req.id)}
                                className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                              >
                                {isProcessing === req.id ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <Check size={14} />
                                )}
                                <span>Setujui</span>
                              </button>

                              <button
                                type="button"
                                disabled={isProcessing === req.id}
                                onClick={() => setRejectingId(req.id)}
                                className="flex-1 sm:flex-none px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl cursor-pointer transition-all disabled:opacity-50"
                              >
                                Tolak
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Reject note inline box */}
                      {rejectingId === req.id && (
                        <div className="mt-3.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2 animate-in fade-in">
                          <p className="text-xs font-bold text-rose-900">
                            Masukkan alasan penolakan permohonan surat:
                          </p>
                          <input
                            type="text"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Contoh: Bukti surat dokter belum dilampirkan atau tanggal tidak sesuai..."
                            className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-rose-500"
                          />
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingId(null);
                                setRejectReason('');
                              }}
                              className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectSubmit(req.id)}
                              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                            >
                              Konfirmasi Tolak
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <CheckCircle2 size={13} className="text-emerald-600" />
            <span>Persetujuan surat otomatis mencatat status Sakit/Izin di buku presensi harian siswa.</span>
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-800 font-extrabold rounded-xl cursor-pointer transition-all"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Lightbox for previewing doctor notes / letters */}
      {lightboxImage && (
        <LeaveAttachmentLightbox
          isOpen={!!lightboxImage}
          onClose={() => setLightboxImage(null)}
          imageUrl={lightboxImage}
        />
      )}
    </div>
  );
};
