import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Printer,
  Download,
  QrCode,
  Sparkles,
  ShieldCheck,
  Smartphone,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  ChevronDown,
  Monitor,
  Building2,
  UserCheck,
  Clock,
  ExternalLink,
  Lock,
  AlertTriangle
} from 'lucide-react';
import { SchoolClass, SchoolProfile, SystemConfig } from '../types';
import { generateClassQrDataUrl, generateClassQrPayload } from '../utils/classQr';
import { getFaseByGrade } from '../utils/faseKurikulum';
import { useApp } from '../context/AppContext';
import { getUserRoleScope } from '../utils/userScope';

export interface ClassQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  classItem?: SchoolClass | null;
  schoolClass?: SchoolClass | null;
  schoolProfile?: SchoolProfile | null;
  systemConfig?: SystemConfig | null;
  schoolId?: string | null;
  classList?: SchoolClass[];
}

export const ClassQrModal: React.FC<ClassQrModalProps> = ({
  isOpen,
  onClose,
  classItem,
  schoolClass,
  schoolProfile: propSchoolProfile,
  systemConfig: propSystemConfig,
  schoolId: propSchoolId,
  classList: propClassList,
}) => {
  const {
    schoolProfile: contextSchoolProfile,
    systemConfig: contextSystemConfig,
    classes: contextClasses,
    teachers: contextTeachers,
    subjects: contextSubjects,
    currentUser,
    activeWorkspace,
  } = useApp();

  const isPersonalWorkspace =
    activeWorkspace?.type === 'personal' ||
    (activeWorkspace as any)?.workspaceType === 'personal' ||
    (activeWorkspace as any)?.workspaceType === 'individu' ||
    (!currentUser?.schoolId && !contextSchoolProfile?.namaSekolah);

  // 1. Otorisasi Kelas: Tentukan secara ketat daftar kelas yang sah menjadi hak milik/kewenangan pengguna
  const authorizedClasses = useMemo<SchoolClass[]>(() => {
    const rawClasses = propClassList && propClassList.length > 0 ? propClassList : contextClasses || [];
    
    // Administrator & Super Admin memiliki akses institusi penuh
    const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
    if (isAdmin) {
      return rawClasses;
    }

    // Pada Ruang Kerja Individu, pengguna adalah pemilik ruang kerja dan mengelola kelasnya sendiri
    if (isPersonalWorkspace) {
      return rawClasses;
    }

    // Pada Ruang Kerja Sekolah, batasi secara ketat hanya pada kelas masing-masing
    const userScope = getUserRoleScope(
      currentUser,
      contextClasses || [],
      contextSubjects || [],
      contextTeachers || []
    );

    if (userScope.isWaliKelas) {
      // Wali Kelas hanya memiliki hak akses tepat 1 kelas binaannya sendiri
      if (userScope.assignedWaliClass) {
        return [userScope.assignedWaliClass];
      }
      if (userScope.assignedWaliClassId) {
        const found = (contextClasses || []).find((c) => c.id === userScope.assignedWaliClassId);
        if (found) return [found];
      }
      // Fallback mencocokkan kelas yang waliKelasName atau waliKelasTeacherId sama dengan guru
      const matched = (contextClasses || []).filter((c) => {
        if (currentUser?.teacherId && c.waliKelasTeacherId === currentUser.teacherId) return true;
        if (currentUser?.assignedClassIds?.includes(c.id)) return true;
        if (currentUser?.classIds?.includes(c.id)) return true;
        return false;
      });
      return matched;
    }

    if (userScope.isGuruMapel) {
      // Guru Mapel hanya dapat melihat rombel yang diajar (sesuai mapping subjek/penugasan)
      return userScope.accessibleClasses;
    }

    if (userScope.isSiswa) {
      // Siswa hanya berhak pada kelasnya sendiri
      return userScope.accessibleClasses;
    }

    // Fallback: periksa ID kelas yang terikat pada akun
    const boundClassIds = new Set<string>();
    if (currentUser?.classId) boundClassIds.add(currentUser.classId);
    if (currentUser?.assignedClassIds) currentUser.assignedClassIds.forEach((id) => boundClassIds.add(id));
    if (currentUser?.classIds) currentUser.classIds.forEach((id) => boundClassIds.add(id));
    if (activeWorkspace?.classId) boundClassIds.add(activeWorkspace.classId);

    if (boundClassIds.size > 0) {
      return (contextClasses || []).filter((c) => boundClassIds.has(c.id));
    }

    return [];
  }, [
    currentUser,
    contextClasses,
    contextSubjects,
    contextTeachers,
    isPersonalWorkspace,
    propClassList,
    activeWorkspace,
  ]);

  const targetClass = classItem || schoolClass || authorizedClasses[0] || null;
  const [selectedClassId, setSelectedClassId] = useState<string>(targetClass?.id || '');

  // Keep selectedClassId synced when initialClass changes
  useEffect(() => {
    if (targetClass?.id) {
      setSelectedClassId(targetClass.id);
    }
  }, [targetClass?.id]);

  const activeClass =
    authorizedClasses.find((c) => c.id === selectedClassId) ||
    targetClass;

  // Cek apakah pengguna diizinkan melihat QR Barcode kelas ini
  const isAuthorized = useMemo(() => {
    if (!activeClass) return false;
    const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
    if (isAdmin || isPersonalWorkspace) return true;
    return authorizedClasses.some((c) => c.id === activeClass.id);
  }, [activeClass, authorizedClasses, currentUser?.role, isPersonalWorkspace]);

  const schoolProfile = propSchoolProfile || contextSchoolProfile;
  const systemConfig = propSystemConfig || contextSystemConfig;
  const schoolId = propSchoolId ?? currentUser?.schoolId;

  const workspaceDisplayName =
    activeWorkspace?.name ||
    schoolProfile?.namaSekolah ||
    (isPersonalWorkspace ? 'Ruang Kerja Guru Mandiri' : 'Satuan Pendidikan');

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Generate high-resolution QR data URL (800px) HANYA jika terotorisasi
  useEffect(() => {
    if (isOpen && activeClass && isAuthorized) {
      generateClassQrDataUrl(activeClass, schoolId, 800)
        .then(setQrDataUrl)
        .catch((err) => console.error('Error generating QR:', err));
    } else {
      setQrDataUrl('');
    }
  }, [isOpen, activeClass, schoolId, isAuthorized]);

  if (!isOpen || !activeClass) return null;

  const fase = getFaseByGrade(activeClass.grade);

  const handlePrint = () => {
    if (!isAuthorized) return;
    window.print();
  };

  const handleDownload = () => {
    if (!qrDataUrl || !isAuthorized) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR-Presensi-${activeClass.name.replace(/\s+/g, '_')}.png`;
    a.click();
  };

  const handleCopyPayload = () => {
    if (!isAuthorized) return;
    const payload = generateClassQrPayload(activeClass, schoolId);
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* On-screen Modal View */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto print:hidden">
        <div
          className={`relative w-full ${
            isFullscreen
              ? 'max-w-5xl xl:max-w-6xl shadow-2xl ring-4 ring-blue-500/20'
              : 'max-w-[420px] sm:max-w-md md:max-w-3xl lg:max-w-4xl'
          } bg-white border border-slate-200 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden text-slate-900 my-auto animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] transition-all`}
        >
          {/* Header Bar */}
          <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-3.5 sm:p-4 md:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black shadow-inner shrink-0">
                <QrCode className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/20 text-[9.5px] sm:text-[10.5px] font-bold text-blue-300 uppercase tracking-wider">
                  <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">
                    {isAuthorized
                      ? isFullscreen
                        ? 'Mode Proyektor / Layar Sentuh Pintar'
                        : 'QR Barcode Tetap Rombel'
                      : 'Akses Rombel Dibatasi'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <h3 className="font-black text-white text-sm sm:text-base md:text-lg tracking-tight truncate">
                    Presensi {activeClass.name}
                  </h3>
                  {/* Selector hanya muncul untuk kelas yang SAH menjadi kewenangan pengguna */}
                  {isAuthorized && authorizedClasses.length > 1 && (
                    <div className="relative inline-block shrink-0">
                      <select
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-[11px] sm:text-xs rounded-lg px-2 py-0.5 sm:py-1 pr-5 appearance-none outline-none cursor-pointer transition max-w-[130px] sm:max-w-[170px] truncate"
                        title="Pilih Kelas yang Anda Kelola"
                      >
                        {authorizedClasses.map((c) => (
                          <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3 h-3 text-white/70 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Top Actions: Fullscreen & Close */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {isAuthorized && (
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className={`p-1.5 sm:p-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
                    isFullscreen
                      ? 'bg-blue-600 text-white hover:bg-blue-500'
                      : 'bg-white/10 text-slate-300 hover:text-white hover:bg-white/20'
                  }`}
                  title={isFullscreen ? 'Kembali ke Tampilan Standar' : 'Tampilan Mode Proyektor / Papan Pintar (IFP)'}
                >
                  {isFullscreen ? (
                    <>
                      <Minimize2 className="w-4 h-4" />
                      <span className="hidden md:inline text-[11px]">Kecilkan</span>
                    </>
                  ) : (
                    <>
                      <Monitor className="w-4 h-4" />
                      <span className="hidden md:inline text-[11px]">Mode Layar Lebar</span>
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 sm:p-2 rounded-xl bg-white/10 text-slate-300 hover:text-white hover:bg-white/20 transition cursor-pointer"
                title="Tutup Jendela"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* BODY: CEK OTORISASI - HANYA UNTUK KELAS MASING-MASING */}
          {/* ========================================================= */}
          <div className="p-3.5 sm:p-5 md:p-6 overflow-y-auto flex-1 space-y-4">
            {!isAuthorized ? (
              /* TAMPILAN JIKA TIDAK MEMILIKI HAK AKSES KE KELAS INI */
              <div className="py-8 sm:py-12 px-4 text-center space-y-4 max-w-md mx-auto my-auto animate-in zoom-in-95">
                <div className="w-16 h-16 rounded-3xl bg-rose-50 border-2 border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
                  <Lock className="w-8 h-8" />
                </div>

                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Akses Barcode Dibatasi</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900">
                    Bukan Rombel Binaan Anda
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    QR Barcode presensi <strong>{activeClass.name}</strong> hanya dapat ditampilkan untuk guru yang berwenang di kelas ini. Anda tidak dapat melihat atau mencetak barcode rombel lain demi menjaga integritas presensi.
                  </p>
                </div>

                {authorizedClasses.length > 0 && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedClassId(authorizedClasses[0].id)}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20 cursor-pointer inline-flex items-center gap-2"
                    >
                      <QrCode size={15} />
                      <span>Buka QR Rombel Saya ({authorizedClasses[0].name})</span>
                    </button>
                  </div>
                )}
              </div>
            ) : isFullscreen ? (
              /* ===================================================== */
              /* MODE PROYEKTOR / PAPAN PINTAR (IFP) & MONITOR BESAR */
              /* ===================================================== */
              <div className="flex flex-col items-center justify-center text-center py-4 sm:py-6 space-y-4 sm:space-y-6 animate-in fade-in">
                {/* School & Class Header */}
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>{workspaceDisplayName}</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
                    PRESENSI {activeClass.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    Tingkat Kelas {activeClass.grade} • {fase} • Wali Kelas:{' '}
                    <strong className="text-slate-700">{activeClass.waliKelasName || 'Belum Ditetapkan'}</strong>
                  </p>
                </div>

                {/* Ultra Crisp Large QR Code Container */}
                <div className="p-4 sm:p-6 bg-white border-4 border-slate-900 rounded-3xl shadow-xl inline-block transition-transform hover:scale-[1.01]">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`QR Presensi ${activeClass.name}`}
                      className="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 xl:w-[400px] xl:h-[400px] object-contain mx-auto"
                    />
                  ) : (
                    <div className="w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center text-slate-400 text-sm">
                      Membuat QR Code...
                    </div>
                  )}
                </div>

                {/* Student Prompt */}
                <div className="bg-blue-50/90 border border-blue-200 rounded-2xl p-3.5 sm:p-4 max-w-lg mx-auto text-center space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-blue-800 font-extrabold text-sm sm:text-base">
                    <Smartphone className="w-4 h-4 text-blue-600" />
                    <span>Arahkan Kamera Portal Siswa ke Barcode Ini</span>
                  </div>
                  <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed font-normal">
                    Siswa dapat memindai langsung dari tempat duduk masing-masing. Jam masuk & kepulangan tercatat otomatis dengan jam resmi sekolah.
                  </p>
                </div>
              </div>
            ) : (
              /* ===================================================== */
              /* MODE STANDAR: RESPONSIVE DARI PONSEL HINGGA PC/LAPTOP */
              /* ===================================================== */
              <>
                {/* 1. Identity Banner (Kompak di HP, Lega di Desktop) */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-4">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-black text-lg sm:text-xl shrink-0 shadow-2xs">
                      {activeClass.grade || 'K'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-black text-slate-900 text-sm sm:text-base tracking-tight">
                          {activeClass.name}
                        </h4>
                        <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] sm:text-[11px] font-bold">
                          {fase}
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate">
                        Wali Kelas: <strong className="text-slate-700">{activeClass.waliKelasName || 'Belum Ditetapkan'}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="w-full sm:w-auto text-left sm:text-right sm:border-l sm:border-slate-200 sm:pl-4 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/70">
                    <span className="text-[9.5px] sm:text-[10px] text-slate-400 font-bold uppercase block">
                      {isPersonalWorkspace ? 'Ruang Kerja' : 'Satuan Pendidikan'}
                    </span>
                    <span className="text-[11px] sm:text-xs font-bold text-slate-700 truncate max-w-[240px] block">
                      {workspaceDisplayName}
                    </span>
                  </div>
                </div>

                {/* 2. Main Content Layout: Stack on Mobile, 2-Column on Tablet / Laptop / PC */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 sm:gap-4 md:gap-5 items-start">
                  
                  {/* LEFT COLUMN: QR Code Barcode Card */}
                  <div className="md:col-span-5 lg:col-span-5 flex flex-col items-center justify-center p-4 sm:p-5 bg-gradient-to-b from-blue-50/50 to-slate-50 border-2 border-blue-200/90 rounded-2xl sm:rounded-3xl text-center relative">
                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] sm:text-[11px] font-black uppercase tracking-wider mb-2.5 shadow-2xs">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                      <span>Scan via Portal Siswa (HP)</span>
                    </div>

                    {/* QR Code Container (Scales automatically to fit screen width) */}
                    <div className="p-2 sm:p-3 bg-white border-2 border-slate-300 rounded-xl sm:rounded-2xl shadow-md inline-block my-1 max-w-full">
                      {qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt={`QR Presensi ${activeClass.name}`}
                          className="w-44 h-44 xs:w-52 xs:h-52 sm:w-56 sm:h-56 md:w-52 md:h-52 lg:w-60 lg:h-60 max-w-full aspect-square object-contain mx-auto"
                        />
                      ) : (
                        <div className="w-44 h-44 xs:w-52 xs:h-52 sm:w-56 sm:h-56 flex items-center justify-center text-slate-400 text-xs">
                          Membuat QR Code...
                        </div>
                      )}
                    </div>

                    <p className="text-[11.5px] sm:text-xs font-extrabold text-slate-900 mt-2">
                      QR Barcode Permanen • {activeClass.name}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-slate-500 max-w-xs mt-0.5 leading-snug">
                      Kode ini tetap dan tidak berubah setiap hari. Cukup dicetak atau ditempel di meja/dinding kelas.
                    </p>

                    {/* Quick Token Action */}
                    <div className="mt-2.5 pt-2 border-t border-blue-100 w-full flex items-center justify-center">
                      <button
                        type="button"
                        onClick={handleCopyPayload}
                        className="text-[10.5px] sm:text-xs font-bold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1.5 transition cursor-pointer"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Kode Token Berhasil Disalin!' : 'Salin Token Barcode'}</span>
                      </button>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: Instructions, Operating Rules & Details */}
                  <div className="md:col-span-7 lg:col-span-7 space-y-3 sm:space-y-3.5">
                    
                    {/* Petunjuk Presensi Mandiri Siswa */}
                    <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-2 shadow-2xs">
                      <h5 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                        <Smartphone className="w-4 h-4 text-blue-600" />
                        <span>Petunjuk Presensi Siswa Mandiri</span>
                      </h5>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] sm:text-xs">
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">1</span>
                          <p className="text-slate-600 leading-snug">
                            Buka <strong>Portal Siswa</strong> di HP dan login ke akun.
                          </p>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">2</span>
                          <p className="text-slate-600 leading-snug">
                            Pilih tombol <strong>"Scan QR Presensi"</strong> (kamera HP).
                          </p>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">3</span>
                          <p className="text-slate-600 leading-snug">
                            Arahkan kamera ke QR ini. Masuk/Pulang tercatat otomatis.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Aturan Waktu & Keamanan Validasi */}
                    <div className="p-3 sm:p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl sm:rounded-2xl text-amber-900 text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-amber-950 text-xs sm:text-[13px]">
                        <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>Jadwal Operasional & Keamanan Sistem:</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10.5px] sm:text-[11px] pt-0.5">
                        <div className="bg-white/80 rounded-lg p-2 border border-amber-200/60">
                          <span className="text-slate-500 block font-medium">Presensi Masuk:</span>
                          <span className="font-extrabold text-slate-800">
                            Mulai {systemConfig.checkInStartTime || '06:00'} s/d {systemConfig.checkInDeadlineTime || '07:00'} WIB
                          </span>
                        </div>
                        <div className="bg-white/80 rounded-lg p-2 border border-amber-200/60">
                          <span className="text-slate-500 block font-medium">Presensi Pulang:</span>
                          <span className="font-extrabold text-slate-800">
                            Mulai {systemConfig.checkOutStartTime || '12:30'} WIB
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-amber-800 leading-relaxed font-normal pt-0.5">
                        Siswa dari rombel lain akan otomatis ditolak oleh sistem. Waktu absensi mengacu pada jam server sekolah untuk mencegah kecurangan jam perangkat.
                      </p>
                    </div>

                  </div>
                </div>
              </>
            )}
          </div>

          {/* ========================================================= */}
          {/* FOOTER ACTIONS: BERSIH & RESPONSIF DI SEMUA RESOLUSI */}
          {/* ========================================================= */}
          <div className="p-3 sm:p-4 md:p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
            {isAuthorized ? (
              <>
                <div className="flex items-center justify-between sm:justify-start gap-2">
                  <button
                    type="button"
                    onClick={handleCopyPayload}
                    className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition shadow-2xs"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Tersalin!' : 'Salin Token'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Gambar</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-black inline-flex items-center justify-center gap-2 cursor-pointer transition shadow-md shadow-blue-600/20"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak Poster Rombel (A4)</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="w-full flex items-center justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Printable A4 Poster View (hidden on screen, only appears during window.print()) */}
      {isAuthorized && (
        <div className="hidden print:block fixed inset-0 bg-white p-8 font-sans text-slate-900">
          <div className="border-4 border-slate-900 rounded-3xl p-8 max-w-2xl mx-auto text-center space-y-6">
            
            {/* Header Kop */}
            <div className="border-b-2 border-slate-900 pb-4 text-center">
              <h2 className="text-xl font-black uppercase tracking-wider text-slate-900">
                {workspaceDisplayName}
              </h2>
              <p className="text-xs text-slate-600 font-semibold mt-0.5">
                SISTEM PRESENSI DIGITAL MANDIRI PESERTA DIDIK
              </p>
              <p className="text-[11px] text-slate-500 font-mono">
                Tahun Ajaran {schoolProfile?.tahunPelajaran || '2025/2026'} • Semester {schoolProfile?.semester || '1 (Ganjil)'}
              </p>
            </div>

            {/* Class Title Badge */}
            <div className="py-2">
              <span className="inline-block px-6 py-2 rounded-2xl bg-slate-900 text-white font-black text-2xl uppercase tracking-wider">
                {activeClass.name}
              </span>
              <div className="mt-2 text-sm font-bold text-slate-700">
                {fase} • Tingkat Kelas {activeClass.grade}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                Wali Kelas: <strong>{activeClass.waliKelasName || '—'}</strong>
              </div>
            </div>

            {/* Large QR Code */}
            <div className="my-4">
              <div className="inline-block p-4 border-4 border-slate-900 rounded-3xl bg-white shadow-none">
                {qrDataUrl && (
                  <img
                    src={qrDataUrl}
                    alt={`QR Presensi ${activeClass.name}`}
                    className="w-72 h-72 mx-auto object-contain"
                  />
                )}
              </div>
            </div>

            {/* Student Instructions */}
            <div className="border-2 border-slate-300 rounded-2xl p-4 bg-slate-50 text-left space-y-2">
              <p className="font-black text-xs uppercase tracking-wider text-slate-800 text-center border-b border-slate-200 pb-1.5">
                PETUNJUK PRESENSI SISWA
              </p>
              <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-700 pt-1">
                <div>
                  <strong>1. Masuk Portal:</strong>
                  <p>Buka Portal Siswa di HP & login akun Anda.</p>
                </div>
                <div>
                  <strong>2. Tekan Scan:</strong>
                  <p>Klik tombol hijau Scan QR Presensi.</p>
                </div>
                <div>
                  <strong>3. Scan Kode:</strong>
                  <p>Arahkan kamera ke QR ini. Jam masuk/pulang tercatat otomatis.</p>
                </div>
              </div>
            </div>

            {/* Footer note & security warning */}
            <div className="pt-2 text-[10px] text-slate-500 flex items-center justify-between border-t border-slate-200">
              <span>*QR ini tetap dan berlaku untuk seluruh mata pelajaran di kelas ini.</span>
              <span>Waktu presensi menggunakan jam server resmi sekolah.</span>
            </div>

          </div>
        </div>
      )}
    </>
  );
};

