import React, { useState, useEffect, useRef } from 'react';
import {
  GraduationCap,
  Sparkles,
  CheckCircle2,
  X,
  ArrowRight,
  ArrowLeft,
  UserCheck,
  CreditCard,
  QrCode,
  Copy,
  Check,
  Building2,
  Calendar,
  Layers,
  FileText,
  Clock,
  Printer,
  ShieldCheck,
  Loader2,
  Zap,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { InvoiceModal } from './InvoiceModal';
import { fetchMidtransClientConfig, loadMidtransSnapScript } from '../utils/midtransClient';

interface TeacherUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface PaymentSessionData {
  orderId: string;
  snapToken: string | null;
  amount: number;
  planTitle: string;
  billingCycle: 'monthly' | 'yearly';
  status: 'PENDING' | 'SETTLED' | 'EXPIRED';
}

export const TeacherUpgradeModal: React.FC<TeacherUpgradeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const {
    currentUser,
    schoolProfile,
    isSchoolPro,
    hasUsedTeacherTrial,
    activateTeacherTrial,
    createTeacherMidtransTransaction,
    completeTeacherUpgrade,
    showToast,
  } = useApp();

  // Wizard Steps:
  // 1: Konfirmasi Profil & Penugasan Pendidik (Wali Kelas / Guru Mapel)
  // 2: Pilihan Aktivasi (Trial 14 Hari vs Langganan Midtrans)
  // 3: Pembayaran Payment Gateway Midtrans (Snap / QRIS / VA)
  // 4: Paket Guru Aktif (Sukses)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedRole, setSelectedRole] = useState<'homeroom' | 'subject'>('homeroom');
  const [targetClassCount, setTargetClassCount] = useState<number>(3);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');

  // Trial activation state
  const [isActivatingTrial, setIsActivatingTrial] = useState(false);

  // Payment state
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentSession, setPaymentSession] = useState<PaymentSessionData | null>(null);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [paymentCheckMessage, setPaymentCheckMessage] = useState<string | null>(null);
  const [copiedInvoice, setCopiedInvoice] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const pollingRef = useRef<any>(null);

  const teacherName = currentUser?.name || currentUser?.username || 'Bapak/Ibu Guru';
  const teacherEmail = currentUser?.email || 'guru@kawacanaan.sch.id';
  const teacherNip = currentUser?.nip || '-';

  const monthlyPrice = 5000;
  const yearlyPrice = 60000;
  const baseAmount = billingCycle === 'yearly' ? yearlyPrice : monthlyPrice;
  const amountToPay = baseAmount;
  const [isProductionGateway, setIsProductionGateway] = useState<boolean>(true);

  // Load Midtrans Snap Script on modal open
  useEffect(() => {
    if (!isOpen) return;

    fetchMidtransClientConfig()
      .then((cfg) => {
        setIsProductionGateway(Boolean(cfg.is_production));
        loadMidtransSnapScript(cfg);
      })
      .catch(() => {});
  }, [isOpen]);

  // Real-time polling when waiting for payment in step 3
  useEffect(() => {
    if (paymentSession && paymentSession.status === 'PENDING' && step === 3) {
      if (!pollingRef.current) {
        pollingRef.current = setInterval(async () => {
          try {
            const res = await fetch(
              `/api/midtrans?action=check_status&order_id=${encodeURIComponent(paymentSession.orderId)}`
            );
            const body = await res.json();
            if (res.ok && (body.is_settled || body.status === 'settlement' || body.status === 'capture')) {
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
              }
              handleFinishPaymentActivation(paymentSession.orderId);
            }
          } catch (_) {}
        }, 4000);
      }
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [paymentSession, step]);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setPaymentSession(null);
      setPaymentCheckMessage(null);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. Aktivasi Trial 14 Hari
  const handleActivateTrial = async () => {
    if (hasUsedTeacherTrial) {
      showToast('Masa uji coba 14 hari telah pernah digunakan sebelumnya.', 'error');
      return;
    }

    setIsActivatingTrial(true);
    try {
      const ok = await activateTeacherTrial();
      if (ok) {
        setStep(4);
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      showToast(err?.message || 'Gagal mengaktifkan masa uji coba.', 'error');
    } finally {
      setIsActivatingTrial(false);
    }
  };

  // 2. Buat Transaksi Midtrans
  const handleCreatePaymentSession = async () => {
    setIsSubmittingPayment(true);
    setPaymentCheckMessage(null);
    try {
      const resData = await createTeacherMidtransTransaction(billingCycle);

      const session: PaymentSessionData = {
        orderId: resData.order_id,
        snapToken: resData.snap_token || null,
        amount: resData.amount ?? amountToPay,
        planTitle: resData.plan_title || `Paket Guru (${billingCycle === 'yearly' ? '1 Tahun' : '1 Bulan'})`,
        billingCycle,
        status: 'PENDING',
      };

      setPaymentSession(session);
      setStep(3);

      // Otomatis buka Snap modal jika tersedia
      if (session.snapToken) {
        if (resData.client_key) {
          try {
            await loadMidtransSnapScript({
              ok: true,
              client_key: resData.client_key,
              is_production: Boolean(resData.is_production),
              snap_url: resData.snap_url,
              enabled: true,
            });
          } catch (_) {}
        }
        setTimeout(() => {
          handleLaunchSnap(session.snapToken!);
        }, 500);
      }
    } catch (err: any) {
      showToast(err?.message || 'Gagal membuat sesi pembayaran.', 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Buka Popup Snap Midtrans
  const handleLaunchSnap = (token: string) => {
    if (!(window as any).snap) {
      setPaymentCheckMessage(
        'Komponen Snap belum termuat. Anda dapat menggunakan verifikasi pembayaran langsung di bawah.'
      );
      return;
    }

    (window as any).snap.pay(token, {
      onSuccess: () => {
        if (paymentSession) {
          handleFinishPaymentActivation(paymentSession.orderId);
        }
      },
      onPending: () => {
        setPaymentCheckMessage('Menunggu penyelesaian transfer/pembayaran Anda via Midtrans.');
      },
      onError: (err: any) => {
        setPaymentCheckMessage(err?.status_message || 'Pembayaran dibatalkan atau gagal.');
      },
      onClose: () => {
        setPaymentCheckMessage('Jendela pembayaran Snap ditutup. Anda dapat membukanya kembali.');
      },
    });
  };

  // Cek Status Pembayaran Manual
  const handleCheckPaymentStatus = async () => {
    if (!paymentSession) return;
    setIsCheckingPayment(true);
    setPaymentCheckMessage('Memeriksa status pembayaran ke Midtrans...');

    try {
      const res = await fetch(
        `/api/midtrans?action=check_status&order_id=${encodeURIComponent(paymentSession.orderId)}`
      );
      const data = await res.json();

      if (res.ok && (data.is_settled || data.status === 'settlement' || data.status === 'capture')) {
        setPaymentCheckMessage('Pembayaran terverifikasi! Mengaktifkan Paket Guru...');
        await handleFinishPaymentActivation(paymentSession.orderId);
      } else {
        setPaymentCheckMessage(
          `Status saat ini: ${data.status || 'PENDING'}. Menunggu pembayaran diselesaikan.`
        );
      }
    } catch (_) {
      setPaymentCheckMessage('Gagal memeriksa status ke Midtrans. Silakan coba kembali.');
    } finally {
      setIsCheckingPayment(false);
    }
  };

  // Selesaikan Aktivasi Berbayar
  const handleFinishPaymentActivation = async (orderId: string) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    try {
      await completeTeacherUpgrade(orderId, billingCycle);
      setStep(4);
      if (onSuccess) onSuccess();
    } catch (e: any) {
      showToast(e?.message || 'Gagal menyelesaikan upgrade.', 'error');
    }
  };

  const handleCopyInvoice = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedInvoice(true);
    setTimeout(() => setCopiedInvoice(false), 2000);
  };

  if (isSchoolPro) {
    const schoolName = schoolProfile?.namaSekolah || 'Satuan Pendidikan Anda';
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
        <div
          className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden text-left animate-in zoom-in-95 duration-200 my-auto"
          id="modal-teacher-upgrade-blocked"
        >
          {/* Header Visual */}
          <div className="relative bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-800 p-5 sm:p-6 text-white">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
              id="btn-close-teacher-upgrade"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-[11px] font-bold tracking-wide uppercase">
                <ShieldCheck size={13} />
                Paket Sekolah Aktif
              </span>
            </div>

            <h3 className="text-lg sm:text-xl font-black leading-snug">
              Sekolah Anda Telah Berlangganan Paket Sekolah
            </h3>
            <p className="text-xs sm:text-sm text-blue-100 mt-1 leading-relaxed">
              Ruang kerja satuan pendidikan <strong>{schoolName}</strong> saat ini aktif berlangganan Paket Sekolah.
            </p>
          </div>

          {/* Modal Body */}
          <div className="p-5 sm:p-6 space-y-4">
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Building2 size={20} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs sm:text-sm font-black text-slate-900">
                    Akses Fitur Paket Guru Telah Otomatis Terbuka Penuh
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Akun Anda (<strong>{teacherName}</strong>) bersama seluruh Kepala Sekolah, Wali Kelas, dan Guru Mapel di sekolah ini telah mendapatkan akses penuh tanpa batasan.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-blue-200/60">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>Manajemen rombel & siswa tanpa batas</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>Presensi mapel & rekap real-time</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>Format cetak dokumen resmi kedinasan</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>Sinkronisasi otomatis database sekolah</span>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 flex items-start gap-2.5 text-amber-900">
              <AlertCircle size={17} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <p className="font-bold">Ketentuan Lisensi:</p>
                <p className="text-amber-800 leading-relaxed">
                  Pengguna yang bernaung di bawah Paket Sekolah <strong>tidak dapat dan tidak perlu membeli Paket Guru</strong>. Apabila masa aktif langganan sekolah telah habis, status akun akan otomatis kembali ke Paket Gratis dan aturan pemilihan paket kembali ke awal.
                </p>
              </div>
            </div>
          </div>

          {/* Footer Navigation */}
          <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-xs font-bold text-white transition shadow-sm cursor-pointer"
            >
              Tutup & Kembali ke Aplikasi
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden text-left animate-in zoom-in-95 duration-200 my-auto"
        id="modal-teacher-upgrade"
      >
        {/* Header Visual */}
        <div className="relative bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-700 p-5 sm:p-6 text-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
            id="btn-close-teacher-upgrade"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold tracking-wide uppercase">
              <Sparkles size={12} className="text-amber-300" />
              Onboarding Ruang Kerja Individu
            </span>
            <span className="text-[11px] text-emerald-100 font-medium">
              Langkah {step} dari 4
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black leading-snug">
            {step === 1 && 'Konfirmasi Profil & Penugasan Pendidik'}
            {step === 2 && 'Pilih Opsi Langganan atau Uji Coba 14 Hari'}
            {step === 3 && 'Pembayaran Payment Gateway Midtrans'}
            {step === 4 && 'Selamat Datang di Paket Guru!'}
          </h3>
          <p className="text-xs sm:text-sm text-emerald-100 mt-1">
            {step === 1 && 'Akun Anda sudah terdaftar. Konfirmasi tugas mengajar Anda untuk menyesuaikan kapasitas.'}
            {step === 2 && 'Pilih uji coba 14 hari gratis atau langsung berlangganan resmi via Midtrans.'}
            {step === 3 && 'Selesaikan pembayaran aman menggunakan Midtrans Snap (QRIS, VA Bank, Transfer).'}
            {step === 4 && 'Akses fitur multi-rombel, presensi mapel, dan cetak PDF resmi langsung aktif.'}
          </p>

          {/* Stepper Dots */}
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step
                    ? 'w-8 bg-white'
                    : s < step
                    ? 'w-4 bg-emerald-300'
                    : 'w-2 bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Modal Body Steps */}
        <div className="p-5 sm:p-7 space-y-6">
          {/* STEP 1: PROFIL & PENUGASAN PENDIDIK */}
          {step === 1 && (
            <div className="space-y-5">
              {/* Profil Saat Ini */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-base shrink-0">
                    <GraduationCap size={22} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800">{teacherName}</h4>
                    <p className="text-xs text-slate-500">
                      NIP: <span className="font-semibold">{teacherNip}</span> • Email: <span className="font-semibold">{teacherEmail}</span>
                    </p>
                  </div>
                </div>
                <span className="hidden sm:inline-block px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-lg uppercase">
                  Akun Terhubung
                </span>
              </div>

              {/* Pilihan Penugasan Pendidik */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Pilih Penugasan Utama Anda di Sekolah:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('homeroom')}
                    className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between gap-3 ${
                      selectedRole === 'homeroom'
                        ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        <UserCheck size={18} />
                      </div>
                      {selectedRole === 'homeroom' && (
                        <CheckCircle2 size={18} className="text-emerald-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800">Wali Kelas Utama</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Mengampu 1 rombel binaan utama dengan kapasitas maksimal 50 siswa.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole('subject');
                      if (targetClassCount < 1) setTargetClassCount(1);
                    }}
                    className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between gap-3 ${
                      selectedRole === 'subject'
                        ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                        <Layers size={18} />
                      </div>
                      {selectedRole === 'subject' && (
                        <CheckCircle2 size={18} className="text-emerald-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800">Guru Mata Pelajaran</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Mengajar mapel tertentu (PJOK, PAI, dll) hingga 6 rombel (maks 300 siswa).
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Rencana Rombel */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  {selectedRole === 'homeroom'
                    ? 'Kapasitas Wali Kelas (Maksimal 1 Kelas):'
                    : 'Rencana Jumlah Rombel yang Dikelola (Maksimal 6 Kelas):'}
                </label>
                <div className="flex items-center gap-2">
                  {(selectedRole === 'homeroom' ? [1] : [1, 2, 3, 4, 5, 6]).map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setTargetClassCount(count)}
                      className={`flex-1 py-2 rounded-xl text-xs font-black border transition cursor-pointer ${
                        targetClassCount === count
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {count} Kelas
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500">
                  {selectedRole === 'homeroom'
                    ? 'Paket Guru untuk Wali Kelas mencakup maksimal 1 kelas dan maksimal 50 siswa.'
                    : 'Paket Guru untuk Guru Mapel mencakup hingga 6 rombongan belajar dan maksimal 300 siswa (maks 50 siswa per kelas).'}
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: PILIHAN AKTIVASI (TRIAL 14 HARI ATAU LANGGANAN MIDTRANS) */}
          {step === 2 && (
            <div className="space-y-5">
              {/* OPSI 1: TRIAL 14 HARI (HANYA JIKA BELUM PERNAH DIGUNAKAN) */}
              <div
                className={`p-4 rounded-2xl border transition ${
                  hasUsedTeacherTrial
                    ? 'bg-slate-50 border-slate-200 opacity-75'
                    : 'bg-gradient-to-br from-amber-50/70 to-emerald-50/50 border-amber-300 ring-1 ring-amber-400/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-slate-900">Uji Coba 14 Hari Gratis</h4>
                        {hasUsedTeacherTrial ? (
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold">
                            Sudah Pernah Digunakan
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase tracking-wide animate-pulse">
                            Tersedia
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {hasUsedTeacherTrial
                          ? 'Kesempatan uji coba 14 hari telah digunakan. Silakan pilih paket langganan resmi di bawah ini.'
                          : 'Coba seluruh fitur Paket Guru selama 14 hari penuh tanpa biaya dan tanpa kartu kredit.'}
                      </p>
                    </div>
                  </div>

                  {!hasUsedTeacherTrial && (
                    <button
                      type="button"
                      onClick={handleActivateTrial}
                      disabled={isActivatingTrial}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-black transition shadow-sm shrink-0 flex items-center gap-1.5 cursor-pointer"
                    >
                      {isActivatingTrial ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Mengaktifkan...</span>
                        </>
                      ) : (
                        <>
                          <Zap size={14} />
                          <span>Mulai Uji Coba 14 Hari</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {!hasUsedTeacherTrial && (
                  <p className="text-[11px] text-amber-800 font-medium mt-3 bg-amber-100/60 p-2 rounded-xl border border-amber-200/50">
                    *Catatan: Jika dalam 14 hari tidak melakukan upgrade berbayar, akun akan otomatis kembali ke Paket Gratis dan tidak ada kesempatan uji coba lagi.
                  </p>
                )}
              </div>

              {/* DIVIDER ATAU PILIHAN RESMI */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Atau Berlangganan Resmi via Midtrans
                </span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              {/* OPSI 2: SIKLUS LANGGANAN BERBAYAR */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Tahunan (Rekomendasi) */}
                <div
                  onClick={() => setBillingCycle('yearly')}
                  className={`relative p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                    billingCycle === 'yearly'
                      ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase tracking-wide shadow-2xs">
                    Aktif 1 Tahun
                  </span>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 uppercase">Langganan 1 Tahun</span>
                      {billingCycle === 'yearly' && (
                        <CheckCircle2 size={18} className="text-emerald-600" />
                      )}
                    </div>
                    <div className="mt-2">
                      <span className="text-2xl font-black text-slate-900">Rp 60.000</span>
                      <span className="text-xs text-slate-500"> / tahun</span>
                    </div>
                    <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                      Setara Rp 5.000/bulan (12 bulan aktif)
                    </p>
                  </div>
                </div>

                {/* Bulanan */}
                <div
                  onClick={() => setBillingCycle('monthly')}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                    billingCycle === 'monthly'
                      ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 uppercase">Langganan Bulanan</span>
                      {billingCycle === 'monthly' && (
                        <CheckCircle2 size={18} className="text-emerald-600" />
                      )}
                    </div>
                    <div className="mt-2">
                      <span className="text-2xl font-black text-slate-900">Rp 5.000</span>
                      <span className="text-xs text-slate-500"> / bulan</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Perpanjangan fleksibel setiap 30 hari
                    </p>
                  </div>
                </div>
              </div>

              {/* Rincian 6 Fasilitas Baku yang Langsung Terbuka */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Fasilitas Profesional yang Segera Aktif:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>Hingga 5 Rombel Belajar</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>Presensi per Jam Mata Pelajaran</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>Cetak PDF Resmi A4 Siap SPJ</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>Kapasitas hingga 150 Siswa</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>Pengaturan Hari Libur & Kalender HEB</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>Dukungan Bantuan Teknis WhatsApp</span>
                  </div>
                </div>
              </div>

              {/* RINGKASAN BIAYA */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Harga Paket ({billingCycle === 'yearly' ? '1 Tahun' : '1 Bulan'})</span>
                    <span className="font-semibold">Rp {baseAmount.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-2 text-slate-900 border-t border-dashed border-slate-200">
                    <span className="font-bold text-slate-700">Total Tagihan:</span>
                    <span className="font-black text-base text-emerald-700">
                      Rp {amountToPay.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: INTEGRASI MIDTRANS & PEMBAYARAN GATEWAY */}
          {step === 3 && paymentSession && (
            <div className="space-y-5">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-500">Nomor Order / Invoice Midtrans</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm font-mono font-bold text-slate-800">{paymentSession.orderId}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyInvoice(paymentSession.orderId)}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Salin Nomor Faktur"
                      >
                        {copiedInvoice ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold flex items-center gap-1.5 animate-pulse">
                    <Clock size={12} />
                    Menunggu Pembayaran
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Nama Akun:</span>
                    <span className="font-bold text-slate-800">{teacherName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Paket:</span>
                    <span className="font-bold text-slate-800">
                      Paket Guru ({billingCycle === 'yearly' ? '1 Tahun' : '1 Bulan'})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gateway:</span>
                    <span className="font-semibold text-emerald-700">Midtrans (QRIS, VA BCA/Mandiri/BNI/BRI, GoPay)</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-black text-slate-900">
                    <span>Total Tagihan:</span>
                    <span className="text-emerald-700">Rp {paymentSession.amount.toLocaleString('id-ID')}</span>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowInvoiceModal(true)}
                    className="w-full py-2.5 px-3 rounded-xl border border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <FileText size={14} />
                    <span>Lihat & Cetak Faktur / Tagihan Resmi</span>
                  </button>
                </div>
              </div>

              {/* Status Message */}
              {paymentCheckMessage && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2 text-xs text-blue-800">
                  <AlertCircle size={15} className="shrink-0 text-blue-600" />
                  <span>{paymentCheckMessage}</span>
                </div>
              )}

              {/* Tombol Snap & Cek Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {paymentSession.snapToken && (
                  <button
                    type="button"
                    onClick={() => handleLaunchSnap(paymentSession.snapToken!)}
                    className="p-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    <CreditCard size={16} />
                    <span>Buka Jendela Pembayaran Snap</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCheckPaymentStatus}
                  disabled={isCheckingPayment}
                  className="p-3.5 rounded-xl border border-slate-300 hover:bg-slate-100 disabled:opacity-50 text-slate-700 font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw size={14} className={isCheckingPayment ? 'animate-spin' : ''} />
                  <span>{isCheckingPayment ? 'Memeriksa...' : 'Cek Status Pembayaran'}</span>
                </button>
              </div>

              {/* Status Environment & Opsi Simulasi (Khusus Sandbox) */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                {isProductionGateway ? (
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Gateway Resmi Midtrans (Live / Produksi)</span>
                  </div>
                ) : (
                  <>
                    <span className="text-[11px] text-slate-400">
                      Lingkungan Uji Coba Midtrans Sandbox
                    </span>
                    <button
                      type="button"
                      onClick={() => handleFinishPaymentActivation(paymentSession.orderId)}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
                    >
                      Simulasi Pembayaran Berhasil (Instan)
                    </button>
                  </>
                )}
                {isProductionGateway && (
                  <span className="text-[10px] text-slate-400 font-medium">
                    QRIS &amp; Virtual Account Terverifikasi
                  </span>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: SUKSES & PANDUAN */}
          {step === 4 && (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h4 className="text-xl font-black text-slate-800">
                  Selamat, Akun Anda Kini Paket Guru!
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 mt-1.5 max-w-md mx-auto">
                  Paket Guru pada Ruang Kerja Individu <strong>{teacherName}</strong> telah aktif. Seluruh fitur profesional siap digunakan.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2.5 max-w-md mx-auto text-xs text-slate-700">
                <p className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">
                  Fasilitas yang Siap Digunakan Sekarang:
                </p>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">1</span>
                  <span>Kelola hingga <strong>5 Rombongan Belajar</strong> di menu Data Kelas.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">2</span>
                  <span>Catat presensi fleksibel per jam di <strong>Presensi Guru Mapel</strong>.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">3</span>
                  <span>Cetak dokumen <strong>Laporan Resmi PDF A4</strong> siap penandatanganan.</span>
                </div>
              </div>

              {paymentSession && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInvoiceModal(true)}
                    className="py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold inline-flex items-center gap-2 shadow-xs transition cursor-pointer"
                  >
                    <Printer size={15} className="text-emerald-600" />
                    <span>Cetak Bukti Pembayaran / Invoice Lunas</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          {step > 1 && step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as any)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-white transition cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft size={14} />
              <span>Sebelumnya</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-white transition cursor-pointer"
            >
              {step === 4 ? 'Tutup' : 'Batal'}
            </button>
          )}

          <div className="flex items-center gap-2">
            {step === 1 && (
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-black text-white transition shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span>Lanjut Pilih Paket</span>
                <ArrowRight size={14} />
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={handleCreatePaymentSession}
                disabled={isSubmittingPayment}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-xs font-black text-white transition shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
              >
                {isSubmittingPayment ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <CreditCard size={15} />
                    <span>Lanjut Bayar Midtrans (Rp {amountToPay.toLocaleString('id-ID')})</span>
                  </>
                )}
              </button>
            )}

            {step === 4 && (
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-black text-white transition shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span>Mulai Gunakan Fitur Sekarang</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {showInvoiceModal && paymentSession && (
        <InvoiceModal
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          data={{
            invoiceNumber: paymentSession.orderId,
            orderId: paymentSession.orderId,
            schoolName: schoolProfile?.name || 'Ruang Kerja Pendidik Mandiri',
            customerName: teacherName,
            customerEmail: teacherEmail,
            customerPhone: currentUser?.phone,
            planName: `Paket Guru (${billingCycle === 'yearly' ? '1 Tahun' : '1 Bulan'})`,
            amount: paymentSession.amount,
            issueDate: new Date().toLocaleDateString('id-ID', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            }),
            dueDate: new Date(Date.now() + 24 * 3600 * 1000).toLocaleDateString('id-ID', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            }),
            paidAt:
              step === 4
                ? new Date().toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })
                : undefined,
            paymentMethod: 'Midtrans Payment Gateway (QRIS / Virtual Account)',
            status: step === 4 ? 'settled' : 'pending',
            notes: `Lisensi Pendidik Profesional Kawacanaan (${billingCycle === 'yearly' ? 'Tahunan' : 'Bulanan'}) - Akses pengampu hingga 5 Rombel dan Presensi Guru Mapel.`,
          }}
        />
      )}
    </div>
  );
};
