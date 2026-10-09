import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellRing,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  ShieldCheck,
  Loader2,
  Trash2,
  Users,
  Info,
  Clock,
} from 'lucide-react';
import {
  getDevicePushStatus,
  subscribeParentDevice,
  unsubscribeParentDevice,
  PushDeviceStatus,
} from '../utils/webPushManager';
import { PWAInstallButton } from './PWAInstallButton';
import type { Student } from '../types';

interface ParentPushNotificationCardProps {
  student: Student;
  schoolId?: string;
}

export const ParentPushNotificationCard: React.FC<ParentPushNotificationCardProps> = ({
  student,
  schoolId,
}) => {
  const [status, setStatus] = useState<PushDeviceStatus>({
    isSupported: true,
    permission: 'default',
    isSubscribed: false,
    connectedDevicesCount: 0,
  });
  const [parentRole, setParentRole] = useState<'Ibu' | 'Ayah' | 'Wali Murid'>('Ibu');
  const [customName, setCustomName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const checkStatus = async () => {
    const s = await getDevicePushStatus(student.id);
    setStatus(s);
  };

  useEffect(() => {
    checkStatus();

    const handleStatusChange = () => {
      checkStatus();
    };

    window.addEventListener('kawacanaan_push_status_changed', handleStatusChange);
    return () => {
      window.removeEventListener('kawacanaan_push_status_changed', handleStatusChange);
    };
  }, [student.id]);

  const handleSubscribe = async () => {
    setIsLoading(true);
    setFeedback(null);
    const chosenName = customName.trim() ? `${parentRole} (${customName.trim()})` : `Ponsel ${parentRole}`;
    const res = await subscribeParentDevice({
      studentId: student.id,
      parentName: chosenName,
      schoolId,
    });
    setIsLoading(false);
    if (res.success) {
      setFeedback({ type: 'success', message: res.message });
      await checkStatus();
    } else {
      setFeedback({ type: 'error', message: res.message });
    }
  };

  const handleUnsubscribe = async () => {
    if (!window.confirm('Hentikan penerimaan notifikasi presensi pada ponsel ini?')) return;
    setIsLoading(true);
    setFeedback(null);
    const res = await unsubscribeParentDevice(student.id);
    setIsLoading(false);
    setFeedback({ type: res.success ? 'info' : 'error', message: res.message });
    await checkStatus();
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
            {status.isSubscribed ? <BellRing size={20} className="animate-pulse" /> : <Bell size={20} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm sm:text-base font-black text-slate-900">
                Notifikasi Waktu Masuk & Keluar Kelas
              </h4>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                PWA Web Push
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Pemberitahuan otomatis ke ponsel saat Ananda scan presensi masuk dan keluar kelas
            </p>
          </div>
        </div>

        <PWAInstallButton variant="compact" />
      </div>

      {/* Status Banner */}
      {status.isSubscribed ? (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <div>
              <span className="text-xs font-black text-emerald-950 block">
                Notifikasi Aktif di Perangkat Ini
              </span>
              <span className="text-[11px] text-emerald-700">
                Waktu masuk dan keluar kelas Ananda {student.nama} akan otomatis terkirim ke ponsel Anda.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              onClick={handleUnsubscribe}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Hentikan notifikasi pada perangkat ini"
            >
              <Trash2 size={13} />
              <span>Matikan Notifikasi</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed flex items-start gap-2.5">
            <Clock size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              Aktifkan notifikasi pada ponsel ini agar Anda langsung mengetahui kapan{' '}
              <strong className="text-slate-900">Ananda {student.nama}</strong> masuk kelas dan kapan keluar kelas.
            </div>
          </div>

          {/* Form Pemilihan Peran Orang Tua (Multi-Device: Ayah & Ibu) */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
            <div className="sm:col-span-5">
              <label className="block text-[11px] font-extrabold text-slate-600 uppercase mb-1">
                Daftarkan Sebagai
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['Ibu', 'Ayah', 'Wali Murid'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setParentRole(r)}
                    className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                      parentRole === r
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-4">
              <label className="block text-[11px] font-extrabold text-slate-600 uppercase mb-1">
                Nama Panggilan (Opsional)
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Contoh: Ibu Rina"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-blue-600 outline-none"
              />
            </div>

            <div className="sm:col-span-3">
              <button
                onClick={handleSubscribe}
                disabled={isLoading}
                className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />}
                <span>Aktifkan Notifikasi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Device Support Indicator */}
      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500 font-medium">
        <div className="flex items-center gap-1.5">
          <Users size={14} className="text-blue-600 shrink-0" />
          <span>
            <strong>Dukungan Multi-Perangkat:</strong> Ayah dan Ibu dapat sama-sama mengaktifkan notifikasi di ponsel masing-masing.
          </span>
        </div>

        {status.connectedDevicesCount > 0 && (
          <span className="inline-flex items-center gap-1 font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md self-start sm:self-auto">
            <span>{status.connectedDevicesCount}</span> perangkat terhubung
          </span>
        )}
      </div>

      {/* Feedback Messages */}
      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : feedback.type === 'error'
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          ) : feedback.type === 'error' ? (
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
          ) : (
            <Info size={16} className="text-blue-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}
    </div>
  );
};
