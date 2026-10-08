import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  X, 
  User, 
  Mail, 
  Shield, 
  Building, 
  GraduationCap, 
  BookOpen, 
  KeyRound, 
  Phone, 
  CheckCircle2, 
  School,
  Lock,
  Calendar,
  Layers,
  Building2,
  UserCheck,
  ArrowRightLeft,
  Sparkles,
  ChevronRight,
  Heart
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenChangePassword?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  onOpenChangePassword
}) => {
  const { 
    currentUser, 
    schoolProfile, 
    classes, 
    teachers, 
    students, 
    activeWorkspace, 
    userWorkspaces,
    isSchoolPro,
    isTeacherPro,
    openUpgradeModal
  } = useApp();

  if (!isOpen || !currentUser) return null;

  const getInitials = (name?: string, username?: string): string => {
    const target = (name || username || 'U').trim();
    const words = target.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return target.slice(0, 2).toUpperCase();
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return { label: 'Super Admin Platform', bg: 'bg-amber-100 text-amber-900 border-amber-300' };
      case 'ADMIN':
        return { label: 'Administrator Sekolah', bg: 'bg-purple-100 text-purple-900 border-purple-300' };
      case 'KEPALA SEKOLAH':
        return { label: 'Kepala Sekolah', bg: 'bg-sky-100 text-sky-900 border-sky-300' };
      case 'WALI KELAS':
        return { label: 'Wali Kelas', bg: 'bg-blue-100 text-blue-900 border-blue-300' };
      case 'GURU MAPEL':
        return { label: 'Guru Mata Pelajaran', bg: 'bg-indigo-100 text-indigo-900 border-indigo-300' };
      case 'SISWA':
      default:
        return { label: 'Siswa / Murid', bg: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
    }
  };

  const roleInfo = getRoleBadge(currentUser.role);
  const userInitials = getInitials(currentUser.name, currentUser.username);

  // Derive extra details
  const myStudent = currentUser.role === 'SISWA'
    ? (students.find(s => 
        (currentUser.studentId && s.id === currentUser.studentId) ||
        (currentUser.username && s.nisn && String(s.nisn).trim().toLowerCase() === currentUser.username.trim().toLowerCase()) ||
        (currentUser.nip && s.nisn && String(s.nisn).trim().toLowerCase() === currentUser.nip.trim().toLowerCase()) ||
        (currentUser.name && s.nama && s.nama.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
      ) || null)
    : null;

  const myTeacher = (currentUser.role === 'WALI KELAS' || currentUser.role === 'GURU MAPEL')
    ? teachers.find(t => t.nama.toLowerCase() === currentUser.name.toLowerCase() || t.nip === currentUser.username)
    : null;

  const myAssignedClasses = currentUser.classNames && currentUser.classNames.length > 0
    ? currentUser.classNames.join(', ')
    : (currentUser.classIds && currentUser.classIds.length > 0
      ? classes.filter(c => currentUser.classIds?.includes(c.id)).map(c => c.name).join(', ')
      : null);

  const displayEmail = currentUser.email || `${currentUser.username.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`;

  const isCurrentlyPersonal =
    activeWorkspace?.workspaceType === 'personal' ||
    activeWorkspace?.workspaceType === 'individu' ||
    (currentUser.subscriptionPlan === 'mulai' && !currentUser.schoolId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 to-sky-600 px-6 py-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Tutup"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white text-blue-600 flex items-center justify-center font-black text-xl shadow-lg shrink-0 ring-4 ring-white/30">
              {userInitials}
            </div>
            <div className="min-w-0 pr-6">
              <h3 className="text-xl font-black uppercase tracking-tight text-white truncate">
                {currentUser.name || currentUser.username}
              </h3>
              <p className="text-xs text-sky-100 italic truncate mt-0.5">
                {displayEmail}
              </p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className={`inline-block px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full border shadow-2xs ${roleInfo.bg}`}>
                  {roleInfo.label}
                </span>
                <span className="text-white text-xs font-semibold">
                  {isCurrentlyPersonal ? 'Ruang Kerja Individu' : 'Ruang Kerja Sekolah'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Section: Status Ruang Kerja Akun Permanen */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                <Building2 size={15} className="text-indigo-600" />
                <span>Ruang Kerja Akun</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                isCurrentlyPersonal ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
              }`}>
                {isCurrentlyPersonal ? 'Ruang Kerja Individu' : 'Ruang Kerja Sekolah'}
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200/90 text-xs space-y-1">
              <div className="text-[10px] uppercase font-bold text-slate-400">Nama Ruang Kerja:</div>
              <div className="font-bold text-slate-900 text-sm truncate">
                {activeWorkspace?.workspaceName || (isCurrentlyPersonal ? 'Ruang Kerja Individu' : schoolProfile.namaSekolah || 'SD Negeri')}
              </div>
              <div className="text-[11px] text-slate-500 pt-0.5">
                Ruang kerja ini terikat secara permanen dengan akun Anda.
              </div>
            </div>

            {/* Status Paket & Opsi Dukungan Pengembangan */}
            {isCurrentlyPersonal && (
              <div className="p-3 bg-[#F0F7FF] rounded-xl border border-[#D8EAFF] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#1D68F2] text-white flex items-center justify-center shrink-0">
                    <Heart size={14} className="fill-white text-white" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-[#1D68F2] block">
                      Paket Aktif: {isTeacherPro ? 'Paket Guru Pro' : 'Paket Gratis'}
                    </span>
                    <span className="text-xs font-semibold text-slate-700 truncate block">
                      {isTeacherPro ? 'Status Dukungan Aktif' : 'Bantu kami menjaga aplikasi tetap aktif'}
                    </span>
                  </div>
                </div>

                {!isTeacherPro && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      openUpgradeModal();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#1D68F2] hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0 cursor-pointer"
                  >
                    Dukung
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Section: Akun & Akses */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Shield size={14} className="text-blue-600" />
              <span>Informasi Akun Pengguna</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Username Login</span>
                <span className="font-semibold text-slate-800">{currentUser.username}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Peran (Role)</span>
                <span className="font-semibold text-slate-800">{currentUser.role}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Email Terdaftar</span>
                <span className="font-semibold text-slate-800 truncate block">{displayEmail}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Status Akun</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                  <CheckCircle2 size={12} /> Aktif & Terverifikasi
                </span>
              </div>
            </div>
          </div>

          {/* Section: Sekolah / Lembaga */}
          {currentUser.role !== 'SUPER_ADMIN' && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <School size={14} className="text-blue-600" />
                <span>Data Satuan Pendidikan</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Nama Lembaga / Sekolah</span>
                  <span className="font-semibold text-slate-800">{schoolProfile.namaSekolah || (isCurrentlyPersonal ? 'Ruang Kerja Individu' : 'SD Negeri Nusantara')}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">NPSN / Kode</span>
                  <span className="font-semibold text-slate-800">{schoolProfile.npsn || schoolProfile.kodeSekolah || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Tahun Pelajaran / Semester</span>
                  <span className="font-semibold text-slate-800">{schoolProfile.tahunPelajaran} (Sem. {schoolProfile.semester})</span>
                </div>
              </div>
            </div>
          )}

          {/* Section: Khusus Wali Kelas / Guru Mapel */}
          {(currentUser.role === 'WALI KELAS' || currentUser.role === 'GURU MAPEL') && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <BookOpen size={14} className="text-blue-600" />
                <span>Penugasan Pendidik</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">NIP / NUPTK</span>
                  <span className="font-semibold text-slate-800">{myTeacher?.nip || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Mata Pelajaran / Tugas</span>
                  <span className="font-semibold text-slate-800">{currentUser.subjectName || myTeacher?.mataPelajaran || (currentUser.role === 'WALI KELAS' ? 'Guru Kelas (Wali Kelas)' : 'Guru Mata Pelajaran')}</span>
                </div>
                {myAssignedClasses && (
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Rombongan Belajar Diampu</span>
                    <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100 inline-block mt-0.5">
                      {myAssignedClasses}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section: Khusus Siswa */}
          {currentUser.role === 'SISWA' && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <GraduationCap size={14} className="text-emerald-600" />
                <span>Data Peserta Didik</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">NISN Siswa</span>
                  <span className="font-semibold text-slate-800">{myStudent?.nisn || currentUser.username}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Kelas</span>
                  <span className="font-semibold text-slate-800">{myStudent?.className || 'Kelas Terdaftar'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Jenis Kelamin</span>
                  <span className="font-semibold text-slate-800">{myStudent?.gender === 'L' ? 'Laki-laki' : myStudent?.gender === 'P' ? 'Perempuan' : '-'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200/80 px-6 py-4 flex items-center justify-between gap-3">
          {onOpenChangePassword ? (
            <button
              onClick={() => {
                onClose();
                onOpenChangePassword();
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:border-slate-800 text-slate-800 font-bold text-xs uppercase tracking-wider transition-colors shadow-2xs cursor-pointer active:scale-95"
            >
              <Lock size={14} className="text-blue-600" />
              <span>Ganti Password</span>
            </button>
          ) : <div />}

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-xs cursor-pointer active:scale-95"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
