import React from 'react';
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Lock,
  FileText,
  PlusCircle,
  Eye,
  Calendar,
  User,
  HeartPulse,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import type { Student, StudentLeaveRequest, AttendanceRecord, SystemConfig, SchoolClass } from '../types';
import { ParentPushNotificationCard } from './ParentPushNotificationCard';

interface ParentMonitoringSectionProps {
  student: Student;
  studentClass?: SchoolClass;
  todayRecord?: AttendanceRecord;
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
  isLockedForHoliday: boolean;
  dayStatus: { isEffective: boolean; label: string; eventTitle?: string };
  formattedRealTimeDate: string;
  systemConfig: SystemConfig;
  studentLeaveRequests: StudentLeaveRequest[];
  onOpenLeaveModal: () => void;
  onViewAttachment: (url: string) => void;
  attendanceStats: {
    hadir: number;
    sakit: number;
    izin: number;
    alfa: number;
    rate: number;
  };
}

export const ParentMonitoringSection: React.FC<ParentMonitoringSectionProps> = ({
  student,
  studentClass,
  todayRecord,
  hasCheckedIn,
  hasCheckedOut,
  isLockedForHoliday,
  dayStatus,
  formattedRealTimeDate,
  systemConfig,
  studentLeaveRequests,
  onOpenLeaveModal,
  onViewAttachment,
  attendanceStats,
}) => {
  const isLate = todayRecord?.notes?.toLowerCase().includes('terlambat') || false;

  // Status text for parent peace of mind
  const getParentStatusBadge = () => {
    if (isLockedForHoliday) {
      return {
        bg: 'bg-slate-100 border-slate-300 text-slate-700',
        title: '🔒 Hari Libur / Tidak Ada Kegiatan Belajar',
        desc: `Hari ini bukan hari belajar efektif (${dayStatus.label}). Tidak ada presensi.`,
        tag: 'Libur',
      };
    }
    if (todayRecord?.status === 'Sakit') {
      return {
        bg: 'bg-sky-50 border-sky-300 text-sky-900',
        title: '🤒 Tercatat Sakit',
        desc: todayRecord.notes || 'Telah diverifikasi oleh pihak sekolah/wali kelas.',
        tag: 'Sakit',
      };
    }
    if (todayRecord?.status === 'Izin') {
      return {
        bg: 'bg-amber-50 border-amber-300 text-amber-900',
        title: '📝 Tercatat Izin Resmi',
        desc: todayRecord.notes || 'Izin telah disetujui wali kelas.',
        tag: 'Izin',
      };
    }
    if (todayRecord?.status === 'Alfa') {
      return {
        bg: 'bg-rose-50 border-rose-300 text-rose-900',
        title: '⚠️ Belum Hadir / Alfa',
        desc: 'Ananda belum melakukan presensi hingga batas waktu masuk berakhir.',
        tag: 'Alfa',
      };
    }
    if (hasCheckedIn && hasCheckedOut) {
      return {
        bg: 'bg-blue-50 border-blue-300 text-blue-900',
        title: '🏠 Sudah Pulang dari Sekolah',
        desc: `Presensi pulang tercatat pukul ${todayRecord?.checkOutTime} WIB. Ananda telah menyelesaikan jam belajar.`,
        tag: 'Sudah Pulang',
      };
    }
    if (hasCheckedIn) {
      return {
        bg: 'bg-emerald-50 border-emerald-300 text-emerald-900',
        title: '🏫 Sedang Berada di Sekolah (Hadir)',
        desc: `Presensi masuk tercatat pukul ${todayRecord?.checkInTime} WIB ${
          isLate ? '(Terlambat)' : '(Tepat Waktu)'
        }. Saat ini sedang mengikuti kegiatan belajar.`,
        tag: isLate ? 'Hadir Terlambat' : 'Hadir Tepat Waktu',
      };
    }
    return {
      bg: 'bg-amber-50/70 border-amber-200 text-amber-900',
      title: '⏳ Belum Tiba di Sekolah',
      desc: `Presensi dibuka pukul ${systemConfig.checkInStartTime || '06:00'} s/d ${
        systemConfig.checkInDeadlineTime || '07:00'
      } WIB.`,
      tag: 'Belum Presensi',
    };
  };

  const statusBadge = getParentStatusBadge();

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. KARTU PEMANTAUAN REAL-TIME KEBERADAAN ANAK (Parent Live Monitoring) */}
      <div className={`p-4 sm:p-5 rounded-3xl border shadow-sm transition-all ${statusBadge.bg}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/80 shadow-xs flex items-center justify-center text-slate-800 shrink-0">
              <ShieldCheck size={22} className="text-blue-600" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                PEMANTAUAN KEBERADAAN ANANDA HARI INI
              </span>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                {statusBadge.title}
              </h3>
            </div>
          </div>
          <span className="inline-flex items-center self-start sm:self-center px-3 py-1 rounded-full text-xs font-black bg-white shadow-2xs border border-black/10">
            {statusBadge.tag}
          </span>
        </div>

        <p className="text-xs sm:text-sm font-medium mt-3 leading-relaxed">
          {statusBadge.desc}
        </p>

        {/* Timestamps Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-black/5">
          <div className="bg-white/70 p-2.5 rounded-xl border border-black/5">
            <span className="text-[10px] font-bold text-slate-500 block uppercase">Jam Kedatangan</span>
            <span className="text-xs sm:text-sm font-black text-slate-800">
              {todayRecord?.checkInTime && todayRecord.checkInTime !== '-'
                ? `${todayRecord.checkInTime} WIB`
                : '—'}
            </span>
          </div>

          <div className="bg-white/70 p-2.5 rounded-xl border border-black/5">
            <span className="text-[10px] font-bold text-slate-500 block uppercase">Jam Kepulangan</span>
            <span className="text-xs sm:text-sm font-black text-slate-800">
              {todayRecord?.checkOutTime && todayRecord.checkOutTime !== '-'
                ? `${todayRecord.checkOutTime} WIB`
                : '—'}
            </span>
          </div>

          <div className="bg-white/70 p-2.5 rounded-xl border border-black/5">
            <span className="text-[10px] font-bold text-slate-500 block uppercase">Batas Tepat Waktu</span>
            <span className="text-xs sm:text-sm font-black text-slate-800">
              {systemConfig.checkInDeadlineTime || '07:00'} WIB
            </span>
          </div>

          <div className="bg-white/70 p-2.5 rounded-xl border border-black/5">
            <span className="text-[10px] font-bold text-slate-500 block uppercase">Wali Kelas</span>
            <span className="text-xs sm:text-sm font-black text-slate-800 truncate block">
              {studentClass?.waliKelasName || 'Wali Kelas'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. NOTIFIKASI PUSH PRESENSI PWA (MULTI-DEVICE ORANG TUA: MASUK & PULANG) */}
      <ParentPushNotificationCard student={student} schoolId={student.schoolId} />

      {/* 3. PENGAJUAN SURAT IZIN & SAKIT BERLAMPIRAN FOTO DOKTER */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
              <FileText size={20} />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-black text-slate-900">
                Surat Izin & Sakit (Online)
              </h4>
              <p className="text-[11px] text-slate-500">
                Ajukan surat izin atau lampirkan foto surat keterangan dokter langsung ke wali kelas
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenLeaveModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black text-xs shadow-sm cursor-pointer transition-all shrink-0"
          >
            <PlusCircle size={15} />
            <span>+ Buat Surat Izin / Sakit Baru</span>
          </button>
        </div>

        {/* Riwayat Surat Izin Siswa */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Riwayat Pengajuan Surat oleh Akun Ini ({studentLeaveRequests.length})</span>
            <span className="text-[10px] text-slate-400">Terhubung langsung dengan data absensi sekolah</span>
          </div>

          {studentLeaveRequests.length === 0 ? (
            <div className="p-5 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-1">
              <p className="text-xs font-bold text-slate-600">Belum ada pengajuan izin atau sakit</p>
              <p className="text-[11px] text-slate-400">
                Jika ananda berhalangan hadir karena sakit atau ada acara keluarga, klik tombol di atas.
              </p>
            </div>
          ) : (
            studentLeaveRequests.map((req) => (
              <div
                key={req.id}
                className="p-3.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl transition-all space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                          req.leaveType === 'sakit'
                            ? 'bg-sky-100 text-sky-800 border-sky-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                      >
                        {req.leaveType === 'sakit' ? '🤒 Sakit' : '📝 Izin'}
                      </span>
                      {req.subCategory && (
                        <span className="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {req.subCategory}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          req.status === 'PENDING'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : req.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {req.status === 'PENDING'
                          ? '⏳ Menunggu Verifikasi Wali Kelas'
                          : req.status === 'APPROVED'
                          ? '✅ Disetujui Wali Kelas'
                          : '❌ Ditolak / Perlu Perbaikan'}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-slate-700 pt-0.5">
                      <span className="font-bold">Tanggal:</span> {req.startDate}
                      {req.endDate && req.endDate !== req.startDate ? ` s/d ${req.endDate}` : ''}
                    </p>
                    <p className="text-xs text-slate-600 italic">"{req.reason}"</p>
                  </div>

                  {/* Thumbnail / View Attachment */}
                  {req.attachmentUrl && (
                    <button
                      type="button"
                      onClick={() => onViewAttachment(req.attachmentUrl!)}
                      className="shrink-0 p-1.5 bg-white border border-slate-200 rounded-xl hover:border-blue-400 transition-all flex flex-col items-center gap-1 cursor-pointer group"
                      title="Klik untuk melihat foto surat dokter"
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center">
                        <img
                          src={req.attachmentUrl}
                          alt="Lampiran"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <span className="text-[9px] font-bold text-blue-600 flex items-center gap-0.5">
                        <Eye size={10} />
                        Foto Bukti
                      </span>
                    </button>
                  )}
                </div>

                {req.reviewedBy && (
                  <div className="pt-2 border-t border-slate-200/60 text-[10px] text-slate-500">
                    Ditinjau oleh: <strong className="text-slate-700">{req.reviewedBy}</strong>
                    {req.reviewNotes ? ` • Catatan: ${req.reviewNotes}` : ''}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 4. STATISTIK KEHADIRAN BULAN INI UNTUK ORANG TUA */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-600" />
            <h4 className="text-xs sm:text-sm font-black text-slate-900">
              Ringkasan Kehadiran Bulan Ini
            </h4>
          </div>
          <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            {attendanceStats.rate}% Kehadiran
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-2.5">
            <span className="text-[10px] font-bold text-emerald-800 block uppercase tracking-wider">
              HADIR
            </span>
            <span className="text-lg font-black text-emerald-900">{attendanceStats.hadir}</span>
            <span className="text-[9px] text-emerald-700 block font-medium">Hari</span>
          </div>
          <div className="bg-sky-50 border border-sky-100 rounded-2xl p-2.5">
            <span className="text-[10px] font-bold text-sky-800 block uppercase tracking-wider">
              SAKIT
            </span>
            <span className="text-lg font-black text-sky-900">{attendanceStats.sakit}</span>
            <span className="text-[9px] text-sky-700 block font-medium">Hari</span>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-2.5">
            <span className="text-[10px] font-bold text-amber-800 block uppercase tracking-wider">
              IZIN
            </span>
            <span className="text-lg font-black text-amber-900">{attendanceStats.izin}</span>
            <span className="text-[9px] text-amber-700 block font-medium">Hari</span>
          </div>
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-2.5">
            <span className="text-[10px] font-bold text-rose-800 block uppercase tracking-wider">
              ALFA
            </span>
            <span className="text-lg font-black text-rose-900">{attendanceStats.alfa}</span>
            <span className="text-[9px] text-rose-700 block font-medium">Hari</span>
          </div>
        </div>
      </div>
    </div>
  );
};
