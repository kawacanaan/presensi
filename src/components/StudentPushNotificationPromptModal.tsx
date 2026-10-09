import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellRing,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  ShieldCheck,
  Loader2,
  X,
  Share2,
  PlusSquare,
  Sparkles,
  Volume2,
} from 'lucide-react';
import {
  subscribeParentDevice,
  getDevicePushStatus,
  PushDeviceStatus,
  detectDeviceName,
} from '../utils/webPushManager';
import { PWAInstallButton } from './PWAInstallButton';
import type { Student } from '../types';

interface StudentPushNotificationPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  schoolId?: string;
  onSubscribedSuccess?: () => void;
}

export const StudentPushNotificationPromptModal: React.FC<StudentPushNotificationPromptModalProps> = ({
  isOpen,
  onClose,
  student,
  schoolId,
  onSubscribedSuccess,
}) => {
  const [deviceRole, setDeviceRole] = useState<'Ponsel Siswa' | 'Ponsel Ibu' | 'Ponsel Ayah' | 'Ponsel Wali'>('Ponsel Siswa');
  const [customName, setCustomName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [status, setStatus] = useState<PushDeviceStatus | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Deteksi apakah perangkat adalah iPhone / iPad di Safari non-standalone
  const [isIosBrowser, setIsIosBrowser] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isStandalone =
      (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;

    setIsIosBrowser(isIos && !isStandalone);
  }, []);

  useEffect(() => {
    if (isOpen && student?.id) {
      getDevicePushStatus(student.id).then(setStatus);
      setFeedback(null);
    }
  }, [isOpen, student?.id]);

  if (!isOpen) return null;

  const handleSubscribe = async () => {
    setIsLoading(true);
    setFeedback(null);

    const chosenName = customName.trim()
      ? `${deviceRole} (${customName.trim()})`
      : deviceRole;

    const res = await subscribeParentDevice({
      studentId: student.id,
      parentName: chosenName,
      schoolId: schoolId || student.schoolId,
    });

    setIsLoading(false);

    if (res.success) {
      setFeedback({ type: 'success', message: res.message });
      try {
        localStorage.setItem(`kawacanaan_push_prompt_dismissed_${student.id}`, 'subscribed');
      } catch (_) {}
      const updated = await getDevicePushStatus(student.id);
      setStatus(updated);
      if (onSubscribedSuccess) {
        onSubscribedSuccess();
      }
    } else {
      setFeedback({ type: 'error', message: res.message });
    }
  };

  const handleTestNotification = async () => {
    setIsTesting(true);
    try {
      const res = await fetch('/api/push-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_attendance',
          studentId: student.id,
          studentName: student.nama,
          eventType: 'masuk',
          timeStr: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          status: 'Hadir',
          notes: 'Uji Coba Notifikasi Mandiri',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setFeedback({
          type: 'success',
          message: 'Pesan uji coba terkirim! Periksa bilah status notifikasi ponsel Anda.',
        });
      } else {
        setFeedback({
          type: 'info',
          message: 'Uji coba telah dikirim ke push service perangkat terdaftar.',
        });
      }
    } catch (_) {
      setFeedback({
        type: 'error',
        message: 'Gagal mengirimkan notifikasi uji coba.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDismiss = () => {
    try {
      // Simpan tunda selama 7 hari
      const snoozeUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
      localStorage.setItem(`kawacanaan_push_prompt_dismissed_${student.id}`, String(snoozeUntil));
    } catch (_) {}
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden text-slate-900 my-auto animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Header Visual */}
        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 text-white p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 translate-x-4 -translate-y-4 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 text-white flex items-center justify-center shadow-inner shrink-0">
              <BellRing size={24} className="animate-bounce" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-blue-50 inline-block mb-1">
                PWA Web Push Notifikasi
              </span>
              <h3 className="text-lg font-black text-white leading-tight">
                Aktifkan Notifikasi Presensi
              </h3>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          <p className="text-slate-600 leading-relaxed">
            Dapatkan pemberitahuan otomatis ke ponsel Anda setiap kali <strong className="text-slate-900">{student.nama}</strong> berhasil scan barcode presensi masuk & pulang sekolah.
          </p>

          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`p-3 rounded-2xl border flex items-start gap-2.5 text-xs font-semibold ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : feedback.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : 'bg-blue-50 text-blue-800 border-blue-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="leading-snug">{feedback.message}</div>
            </div>
          )}

          {/* iOS Safari Special Instructions */}
          {isIosBrowser && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <Share2 size={16} className="text-amber-700" />
                <span>Petunjuk Khusus Pengguna iPhone (iOS)</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Kebijakan Apple mengharuskan web dipasang ke Layar Utama sebelum notifikasi push dapat diaktifkan:
              </p>
              <ol className="list-decimal list-inside text-[11px] text-amber-900 space-y-1 font-medium pl-1">
                <li>Ketuk ikon <strong>Bagikan (Share)</strong> di bilah bawah Safari.</li>
                <li>Pilih <strong>Tambahkan ke Layar Utama (Add to Home Screen)</strong>.</li>
                <li>Buka aplikasi KawaCanaan dari Layar Utama ponsel Anda lalu aktifkan notifikasi.</li>
              </ol>
            </div>
          )}

          {/* Pilihan Perangkat */}
          {(!status?.isSubscribed || feedback?.type !== 'success') && (
            <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
              <label className="block text-[11px] font-bold text-slate-700">
                Siapa yang menggunakan ponsel ini?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['Ponsel Siswa', 'Ponsel Ibu', 'Ponsel Ayah', 'Ponsel Wali'] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setDeviceRole(role)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                      deviceRole === role
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Nama Pemilik Perangkat (Opsional)
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Contoh: Ibu Siti / Ponsel Ananda"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-1">
                <Smartphone size={12} className="text-slate-400 shrink-0" />
                <span>Terdeteksi: {detectDeviceName()}</span>
              </div>
            </div>
          )}

          {/* Jika Sudah Aktif */}
          {status?.isSubscribed && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <div className="text-xs font-black text-emerald-950">Notifikasi Sudah Aktif</div>
                  <div className="text-[10px] text-emerald-700">
                    Ponsel ini siap menerima waktu masuk & pulang otomatis.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleTestNotification}
                disabled={isTesting}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {isTesting ? <Loader2 size={12} className="animate-spin" /> : <Volume2 size={12} />}
                <span>Uji Suara</span>
              </button>
            </div>
          )}

          {/* Pasang Aplikasi PWA */}
          <PWAInstallButton variant="card" />

          {/* Keunggulan Fitur */}
          <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-start gap-2.5 text-[11px] text-blue-900">
            <ShieldCheck size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <span className="leading-snug">
              Multi-Device: Ayah, Ibu, dan Siswa dapat sama-sama menerima notifikasi di ponsel masing-masing secara bersamaan.
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleDismiss}
            className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-white text-slate-600 text-xs font-bold transition-all cursor-pointer"
          >
            {status?.isSubscribed ? 'Selesai' : 'Nanti Saja'}
          </button>

          {!status?.isSubscribed && (
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Mengaktifkan...</span>
                </>
              ) : (
                <>
                  <Bell size={14} />
                  <span>Aktifkan Sekarang</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
