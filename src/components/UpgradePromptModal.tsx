import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  CheckCircle2,
  X,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Check,
  RefreshCw,
  ExternalLink,
  Clock,
  Building2,
  Heart,
  Calendar,
  Sprout,
} from 'lucide-react';
import { SYSTEM_FEATURES } from '../utils/featureRegistry';
import { useApp } from '../context/AppContext';
import { fetchMidtransClientConfig, loadMidtransSnapScript } from '../utils/midtransClient';

export interface UpgradePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureId?: string;
  customTitle?: string;
  customMessage?: string;
  targetPackage?: 'guru_pro' | 'sekolah_pro';
  onOpenTeacherUpgrade?: () => void;
  onOpenSchoolUpgrade?: () => void;
}

interface PaymentSession {
  orderId: string;
  snapToken: string | null;
  amount: number;
  planTitle: string;
}

export const UpgradePromptModal: React.FC<UpgradePromptModalProps> = ({
  isOpen,
  onClose,
  featureId,
  customTitle,
  customMessage,
}) => {
  const {
    currentUser,
    schoolProfile,
    isSchoolPro,
    createTeacherMidtransTransaction,
    completeTeacherUpgrade,
    showToast,
  } = useApp();

  // State wizard: 'prompt' | 'paying' | 'success'
  const [step, setStep] = useState<'prompt' | 'paying' | 'success'>('prompt');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null);
  const [paymentStatusText, setPaymentStatusText] = useState<string | null>(null);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [verifiedExpiresAt, setVerifiedExpiresAt] = useState<string | null>(null);

  const pollingRef = useRef<any>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('prompt');
      setIsSubmitting(false);
      setPaymentSession(null);
      setPaymentStatusText(null);
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  }, [isOpen]);

  // Load Midtrans Snap Script once modal is opened
  useEffect(() => {
    if (!isOpen) return;

    fetchMidtransClientConfig()
      .then((cfg) => {
        loadMidtransSnapScript(cfg);
      })
      .catch(() => {});
  }, [isOpen]);

  // Polling payment status when in 'paying' state
  useEffect(() => {
    if (step === 'paying' && paymentSession?.orderId) {
      if (!pollingRef.current) {
        pollingRef.current = setInterval(async () => {
          try {
            const res = await fetch(
              `/api/midtrans?action=check_status&order_id=${encodeURIComponent(paymentSession.orderId)}`
            );
            const data = await res.json();
            if (res.ok && (data.is_settled || data.status === 'settlement' || data.status === 'capture')) {
              handlePaymentSuccess(paymentSession.orderId);
            }
          } catch (_) {}
        }, 3500);
      }
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [step, paymentSession]);

  if (!isOpen) return null;

  const featureInfo = featureId
    ? SYSTEM_FEATURES.find((f) => f.id === featureId)
    : null;

  const resolvedFeatureName = customTitle || featureInfo?.name;

  // 1. Launch Midtrans Snap directly
  const handleLaunchSnap = (token: string, orderId: string) => {
    if (!(window as any).snap) {
      setPaymentStatusText(
        'Jendela Midtrans Snap sedang dimuat. Anda juga dapat memeriksa verifikasi pembayaran di bawah.'
      );
      return;
    }

    (window as any).snap.pay(token, {
      onSuccess: () => {
        handlePaymentSuccess(orderId);
      },
      onPending: () => {
        setPaymentStatusText('Menunggu pembayaran diselesaikan via Midtrans...');
      },
      onError: (err: any) => {
        setPaymentStatusText(err?.status_message || 'Pembayaran gagal atau dibatalkan.');
      },
      onClose: () => {
        setPaymentStatusText('Jendela Midtrans ditutup. Anda dapat membukanya kembali kapan saja.');
      },
    });
  };

  // 2. Buat transaksi Midtrans & langsung arahkan ke Payment Gateway
  const handleUpgradeToTeacher = async () => {
    setIsSubmitting(true);
    setPaymentStatusText(null);

    try {
      const resData = await createTeacherMidtransTransaction();

      const session: PaymentSession = {
        orderId: resData.order_id,
        snapToken: resData.snap_token || null,
        amount: resData.amount ?? 5000,
        planTitle: resData.plan_title || 'Dukungan Pengembangan Paket Guru',
      };

      setPaymentSession(session);
      setStep('paying');

      // Buka Snap otomatis jika token tersedia
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
          handleLaunchSnap(session.snapToken!, session.orderId);
        }, 300);
      }
    } catch (err: any) {
      showToast(err?.message || 'Gagal menyiapkan sesi pembayaran Midtrans.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Selesaikan Upgrade ke Paket Guru
  const handlePaymentSuccess = async (orderId: string) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    try {
      let expiryFromCheck: string | null = null;
      let grossFromCheck = paymentSession?.amount || 5000;
      try {
        const checkRes = await fetch(`/api/midtrans?action=check_status&order_id=${encodeURIComponent(orderId)}`);
        const checkData = await checkRes.json();
        if (checkData?.expires_at) {
          expiryFromCheck = checkData.expires_at;
        } else if (checkData?.payment?.expires_at) {
          expiryFromCheck = checkData.payment.expires_at;
        }
        if (checkData?.gross_amount) {
          grossFromCheck = Number(checkData.gross_amount) || grossFromCheck;
        }
      } catch (_) {}

      await completeTeacherUpgrade(orderId, grossFromCheck, expiryFromCheck);
      if (expiryFromCheck) {
        setVerifiedExpiresAt(expiryFromCheck);
      }
      setStep('success');
    } catch (err: any) {
      showToast(err?.message || 'Gagal memperbarui status paket.', 'error');
    }
  };

  // 4. Cek Status Pembayaran Manual
  const handleCheckStatus = async () => {
    if (!paymentSession?.orderId) return;
    setIsCheckingPayment(true);
    setPaymentStatusText('Memeriksa status pembayaran ke server Midtrans...');

    try {
      const res = await fetch(
        `/api/midtrans?action=check_status&order_id=${encodeURIComponent(paymentSession.orderId)}`
      );
      const data = await res.json();

      if (res.ok && (data.is_settled || data.status === 'settlement' || data.status === 'capture')) {
        setPaymentStatusText('Pembayaran berhasil diverifikasi!');
        await handlePaymentSuccess(paymentSession.orderId);
      } else {
        setPaymentStatusText(
          `Status pembayaran saat ini: ${data.status || 'PENDING'}. Silakan selesaikan transaksi Anda.`
        );
      }
    } catch (_) {
      setPaymentStatusText('Belum dapat memverifikasi. Silakan coba beberapa saat lagi.');
    } finally {
      setIsCheckingPayment(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div
        className="bg-white w-full max-w-[390px] sm:max-w-[430px] md:max-w-[440px] rounded-[24px] sm:rounded-[28px] shadow-2xl shadow-blue-950/20 border border-slate-100 overflow-hidden text-left animate-in zoom-in-95 duration-200 my-auto relative max-h-[92vh] flex flex-col"
        id="modal-upgrade-prompt"
      >
        {/* STEP 1: SESUAI ACUAN REFERENSI GAMBAR - COMPACT & HIGH-CONVERSION COMMERCIAL */}
        {step === 'prompt' && (
          <div className="overflow-y-auto p-4 sm:p-5 md:p-5.5 space-y-3.5 sm:space-y-4">
            {/* Top Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100/90 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer z-10 shadow-2xs"
              id="btn-close-upgrade-modal"
              aria-label="Tutup"
            >
              <X size={15} strokeWidth={2.5} />
            </button>

            {/* Header Section: Badge, Title, Subtitle, and Right Laptop Illustration */}
            <div className="relative pt-0.5 flex items-start justify-between gap-2.5">
              <div className="flex-1 min-w-0 pr-1">
                {/* Pill Badge: Red Heart + DUKUNG PENGEMBANGAN */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#1D68F2] text-white text-[9.5px] sm:text-[10.5px] font-black tracking-wider uppercase mb-2 shadow-2xs">
                  <Heart size={10} className="fill-red-500 text-red-500 shrink-0" />
                  <span>DUKUNG PENGEMBANGAN</span>
                </div>

                {/* Title */}
                <h2 className="text-[20px] sm:text-[23px] font-black leading-[1.15] tracking-tight">
                  <span className="text-slate-900 block">Bantu Kami</span>
                  <span className="text-[#1D68F2] block">Terus Berkembang</span>
                </h2>

                {/* Subtitle */}
                <p className="text-[11px] sm:text-[12px] text-slate-500 leading-snug mt-1.5 font-medium">
                  Dukungan kecil dari Anda membantu kami menjaga aplikasi tetap aktif, aman, dan terus dikembangkan untuk kebutuhan sekolah.
                </p>
                {resolvedFeatureName && (
                  <p className="text-[10px] text-blue-700 bg-blue-50/90 px-2 py-0.5 rounded-md inline-block font-semibold mt-1">
                    Akses fitur: {resolvedFeatureName}
                  </p>
                )}
              </div>

              {/* Top-Right 3D Illustration - Proportional & Compact */}
              <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 relative flex items-center justify-center overflow-hidden rounded-xl sm:rounded-2xl border border-blue-50/80 shadow-2xs bg-slate-50">
                <img
                  src="/images/laptop_books_plant_3d.jpg"
                  alt="Dukungan Pendidikan"
                  className="w-full h-full object-cover rounded-xl sm:rounded-2xl"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            </div>

            {/* Info Card: "Dukung aplikasi ini agar terus berjalan" */}
            <div className="bg-[#F0F7FF] border border-[#D8EAFF] rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex items-center gap-3">
              {/* Graphic Avatar with warm peach circle and hand cradling red heart with sparkles */}
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#FFEFEA] border border-[#FED8CF] flex items-center justify-center shrink-0 shadow-2xs">
                <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 48 48" fill="none">
                  {/* Golden Sparkles */}
                  <path d="M12 13L13.5 9L15 13L19 14.5L15 16L13.5 20L12 16L8 14.5L12 13Z" fill="#F59E0B" />
                  <path d="M35 11L36 8L37 11L40 12L37 13L36 16L35 13L32 12L35 11Z" fill="#FBBF24" />
                  <circle cx="39" cy="21" r="1.5" fill="#F59E0B" />
                  {/* Glowing Red Heart */}
                  <path d="M24 16.5C22.2 12 16.8 12 14.5 15.2C12.2 18.5 14.5 22.8 24 30.5C33.5 22.8 35.8 18.5 33.5 15.2C31.2 12 25.8 12 24 16.5Z" fill="#EF4444" />
                  {/* Supportive Blue Hand */}
                  <path d="M13 29C14.8 27.8 18.5 30 22.5 31.8C25.5 33.2 30.5 32.2 33.5 30.8C35.2 30 36.2 31.2 35.2 32.8C32.5 36.5 26.5 40 21.5 39C17.2 38 13.5 34.5 11.2 32.2C9.5 30.8 10.5 29 13 29Z" fill="#1D68F2" />
                  <path d="M11.5 32.5L8.5 35.5C7.2 36.8 9 39 10.8 38.2L15.5 36.8" stroke="#1D68F2" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>

              {/* Text content */}
              <div className="space-y-0.5 min-w-0">
                <h3 className="font-bold text-[#0F294A] text-[12.5px] sm:text-[13.5px] leading-tight">
                  Dukung aplikasi ini agar terus berjalan
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-600 leading-snug font-normal">
                  Setiap dukungan yang Anda berikan sangat berarti bagi kami untuk menjaga layanan tetap stabil dan menghadirkan fitur baru.
                </p>
              </div>
            </div>

            {isSchoolPro ? (
              <div className="space-y-3 pt-0.5">
                <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-blue-900 font-bold text-xs sm:text-sm">
                    <Building2 size={16} className="text-blue-700 shrink-0" />
                    <span>Sekolah Anda Berlangganan Paket Sekolah</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Ruang kerja satuan pendidikan <strong>{schoolProfile?.namaSekolah || 'sekolah Anda'}</strong> saat ini telah memiliki lisensi aktif. Seluruh fitur profesional telah dibuka secara otomatis.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Mengerti, Kembali ke Aplikasi</span>
                </button>
              </div>
            ) : (
              <>
                {/* Direct Action Section: "Beri Dukungan via Midtrans" */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={handleUpgradeToTeacher}
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 rounded-xl sm:rounded-2xl bg-[#1D68F2] hover:bg-[#1557CD] active:bg-[#0F47AB] text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    id="btn-upgrade-to-paket-guru"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        <span>Menyiapkan Pembayaran Midtrans...</span>
                      </>
                    ) : (
                      <>
                        <Heart size={15} className="fill-white text-white" />
                        <span>Beri Dukungan via Midtrans</span>
                        <ArrowRight size={15} strokeWidth={2.5} />
                      </>
                    )}
                  </button>

                  {/* Payment Security Note */}
                  <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] text-slate-500 font-medium pt-0.5">
                    <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                    <span>Pembayaran resmi &amp; aman melalui Midtrans (QRIS, VA Bank &amp; E-Wallet)</span>
                  </div>
                </div>
              </>
            )}

            {/* Bottom Footer: Thank you note & "Nanti Saja" */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[10px] sm:text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-500 italic min-w-0">
                <Heart size={12} className="text-emerald-500 shrink-0 stroke-[2]" />
                <span className="truncate">Terima kasih atas dukungan Anda.</span>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="text-slate-500 hover:text-slate-800 font-semibold transition cursor-pointer shrink-0 py-0.5 px-1.5 rounded-md hover:bg-slate-100"
                id="btn-dismiss-upgrade"
              >
                Nanti Saja
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: JENDELA PEMBAYARAN MIDTRANS SEDANG BERJALAN */}
        {step === 'paying' && paymentSession && (
          <div className="overflow-y-auto p-5 sm:p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1D68F2] flex items-center justify-center mx-auto animate-pulse">
              <CreditCard size={24} />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1D68F2] text-[10.5px] font-bold mb-1.5">
                <Clock size={12} className="animate-spin" />
                <span>Menunggu Pembayaran via Midtrans</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900">
                Selesaikan Pembayaran
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
                Silakan lakukan pembayaran melalui jendela Midtrans yang muncul di layar.
              </p>
            </div>

            {/* Rincian Transaksi */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 text-left space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 text-[11px]">Keterangan:</span>
                <span className="font-bold text-slate-800 text-[11px]">{paymentSession.planTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-[11px]">Nomor Tagihan:</span>
                <span className="font-mono text-slate-700 text-[11px]">{paymentSession.orderId}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-slate-200 text-xs sm:text-sm font-black text-slate-900">
                <span>Metode Pembayaran:</span>
                <span className="text-[#1D68F2]">Midtrans (QRIS, VA & E-Wallet)</span>
              </div>
            </div>

            {paymentStatusText && (
              <p className="text-[11px] text-blue-800 bg-blue-50 border border-blue-200/60 rounded-xl p-2.5 leading-relaxed">
                {paymentStatusText}
              </p>
            )}

            <div className="space-y-2 pt-1">
              {paymentSession.snapToken && (
                <button
                  type="button"
                  onClick={() => handleLaunchSnap(paymentSession.snapToken!, paymentSession.orderId)}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#1D68F2] hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ExternalLink size={14} />
                  <span>Buka Kembali Jendela Midtrans</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCheckStatus}
                disabled={isCheckingPayment}
                className="w-full py-2 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={13} className={isCheckingPayment ? 'animate-spin' : ''} />
                <span>{isCheckingPayment ? 'Memeriksa Status...' : 'Cek Status Pembayaran'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-[11px] text-slate-400 hover:text-slate-600 font-medium transition cursor-pointer pt-1"
            >
              Tutup Jendela (Pembayaran tetap dapat dilanjutkan nanti)
            </button>
          </div>
        )}

        {/* STEP 3: CELEBRATION SUKSES & STATUS AKTIF */}
        {step === 'success' && (
          <div className="overflow-y-auto p-5 sm:p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto ring-6 ring-emerald-50">
              <CheckCircle2 size={32} />
            </div>

            <div>
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase mb-1.5">
                <Sparkles size={12} />
                <span>Dukungan Berhasil</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900">
                Terima Kasih Atas Dukungan Anda!
              </h3>
              <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto leading-relaxed">
                Dukungan Anda telah kami terima. Fitur lengkap untuk ruang kerja Anda kini telah aktif sepenuhnya demi kelancaran operasional presensi sekolah.
              </p>
            </div>

            <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-3 text-[11px] text-emerald-800 text-left space-y-1.5">
              <div className="flex items-center gap-2 font-bold">
                <Check size={13} className="text-emerald-600 shrink-0" />
                <span>Status Akun: Paket Guru Resmi Aktif</span>
              </div>
              {(verifiedExpiresAt || currentUser?.subscriptionExpiresAt) && (
                <div className="flex items-center gap-2 font-bold text-emerald-950 bg-emerald-100/90 p-2 rounded-lg border border-emerald-200/70">
                  <Calendar size={14} className="text-emerald-700 shrink-0" />
                  <span>
                    Masa Aktif Lisensi: Hingga{' '}
                    {new Date(verifiedExpiresAt || currentUser?.subscriptionExpiresAt || '').toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-slate-600 text-[10.5px]">
                <Check size={13} className="text-emerald-600 shrink-0" />
                <span>Akses fitur lengkap aktif seketika di ruang kerja Anda</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md transition cursor-pointer"
              id="btn-finish-upgrade-success"
            >
              Mulai Gunakan Fitur
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
