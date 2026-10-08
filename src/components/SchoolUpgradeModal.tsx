import React, { useState, useEffect, useRef } from 'react';
import {
  School,
  Sparkles,
  CheckCircle2,
  X,
  ArrowRight,
  ArrowLeft,
  Building2,
  ShieldCheck,
  Copy,
  Check,
  Users,
  FileText,
  Printer,
  Calendar,
  Layers,
  Loader2,
  CreditCard,
  RefreshCw,
  Clock,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { InvoiceModal } from './InvoiceModal';
import { fetchMidtransClientConfig, loadMidtransSnapScript } from '../utils/midtransClient';

interface SchoolUpgradeModalProps {
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

export const SchoolUpgradeModal: React.FC<SchoolUpgradeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const {
    currentUser,
    createSchoolMidtransTransaction,
    completeSchoolUpgrade,
    showToast,
  } = useApp();

  // Wizard Steps:
  // 1: Data Identitas Satuan Pendidikan & Kepala Sekolah
  // 2: Siklus Tagihan Langganan Sekolah Resmi (Tanpa Trial)
  // 3: Pembayaran Payment Gateway Midtrans (Snap / QRIS / VA)
  // 4: Ruang Kerja Sekolah Aktif & Kode Sekolah
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form Fields Satuan Pendidikan
  const [schoolName, setSchoolName] = useState('SDN Percontohan Jakarta');
  const [npsn, setNpsn] = useState('20104567');
  const [city, setCity] = useState('Jakarta Pusat');
  const [province, setProvince] = useState('DKI Jakarta');
  const [status, setStatus] = useState<'Negeri' | 'Swasta'>('Negeri');

  // Pejabat & Pimpinan
  const [principalName, setPrincipalName] = useState('Dra. Hj. Nurjanah, M.Pd.');
  const [principalNip, setPrincipalNip] = useState('197508122000032001');

  // Admin Sekolah Terhubung
  const adminName = currentUser?.name || currentUser?.username || 'Administrator Sekolah';
  const adminEmail = currentUser?.email || 'admin@sekolah.kawacanaan.sch.id';

  // Siklus Tagihan (Paket Sekolah Tidak Ada Trial)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');

  // Payment Session State
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentSession, setPaymentSession] = useState<PaymentSessionData | null>(null);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [paymentCheckMessage, setPaymentCheckMessage] = useState<string | null>(null);
  const [copiedInvoice, setCopiedInvoice] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Hasil Sukses
  const [generatedSchoolCode, setGeneratedSchoolCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const pollingRef = useRef<any>(null);

  const [isFirstTimePurchase, setIsFirstTimePurchase] = useState(true);
  const [monthlyPrice, setMonthlyPrice] = useState(25000);
  const [yearlyPrice, setYearlyPrice] = useState(250000); // Rp 250.000 perdana, Rp 300.000 normal
  const baseAmount = billingCycle === 'yearly' ? yearlyPrice : monthlyPrice;
  const amountToPay = baseAmount;
  const [isProductionGateway, setIsProductionGateway] = useState<boolean>(true);

  // Check pricing eligibility dynamically from API
  useEffect(() => {
    if (!isOpen) return;

    const targetSchoolId = (currentUser as any)?.school_id || (currentUser as any)?.schoolId || '';
    const targetNpsn = npsn || '';
    fetch(`/api/midtrans?action=check_pricing&plan_id=school&school_id=${encodeURIComponent(targetSchoolId)}&npsn=${encodeURIComponent(targetNpsn)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setIsFirstTimePurchase(data.is_first_time);
          if (data.monthly_amount) setMonthlyPrice(data.monthly_amount);
          if (data.yearly_amount) setYearlyPrice(data.yearly_amount);
        }
      })
      .catch(() => {});
  }, [isOpen, (currentUser as any)?.school_id, (currentUser as any)?.schoolId, npsn]);

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

  // Reset state on modal close
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

  // Step 2 Submission: Buat Transaksi Midtrans untuk Sekolah
  const handleProceedToPayment = async () => {
    if (!schoolName.trim()) {
      showToast('Nama satuan pendidikan wajib diisi.', 'error');
      return;
    }
    if (!npsn.trim() || npsn.length < 8) {
      showToast('NPSN minimal 8 digit angka.', 'error');
      return;
    }

    setIsSubmittingPayment(true);
    setPaymentCheckMessage(null);

    try {
      const resData = await createSchoolMidtransTransaction(
        {
          schoolName: schoolName.trim(),
          npsn: npsn.trim(),
          principalName,
          principalNip,
          city,
          province,
          adminName,
        },
        billingCycle
      );

      const session: PaymentSessionData = {
        orderId: resData.order_id,
        snapToken: resData.snap_token || null,
        amount: resData.amount ?? amountToPay,
        planTitle: resData.plan_title || `Paket Sekolah (${billingCycle === 'yearly' ? '1 Tahun' : '1 Bulan'})`,
        billingCycle,
        status: 'PENDING',
      };

      setPaymentSession(session);
      setStep(3);

      // Auto-launch Snap popup if available
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
      showToast(err?.message || 'Gagal membuat sesi transaksi Midtrans.', 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Launch Snap Modal
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
        setPaymentCheckMessage('Menunggu penyelesaian transfer/pembayaran sekolah via Midtrans.');
      },
      onError: (err: any) => {
        setPaymentCheckMessage(err?.status_message || 'Pembayaran dibatalkan atau gagal.');
      },
      onClose: () => {
        setPaymentCheckMessage('Jendela pembayaran Snap ditutup. Anda dapat membukanya kembali.');
      },
    });
  };

  // Manual status check
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
        setPaymentCheckMessage('Pembayaran terverifikasi! Mengaktifkan Ruang Kerja Sekolah...');
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

  // Selesaikan Aktivasi Sekolah setelah pembayaran sukses
  const handleFinishPaymentActivation = async (orderId: string) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    try {
      const res = await completeSchoolUpgrade(
        {
          schoolName: schoolName.trim(),
          npsn: npsn.trim(),
          city,
          province,
          status,
          principalName,
          principalNip,
          adminName,
        },
        orderId,
        billingCycle
      );

      if (res?.schoolCode) {
        setGeneratedSchoolCode(res.schoolCode);
      } else {
        setGeneratedSchoolCode(npsn.trim());
      }

      setStep(4);
      if (onSuccess) onSuccess();
    } catch (e: any) {
      showToast(e?.message || 'Gagal membentuk ruang kerja sekolah.', 'error');
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedSchoolCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyInvoice = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedInvoice(true);
    setTimeout(() => setCopiedInvoice(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden text-left animate-in zoom-in-95 duration-200 my-auto"
        id="modal-school-upgrade"
      >
        {/* Header Visual */}
        <div className="relative bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-700 p-5 sm:p-6 text-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
            id="btn-close-school-upgrade"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold tracking-wide uppercase">
              <Building2 size={12} className="text-sky-300" />
              Onboarding Ruang Kerja Sekolah
            </span>
            <span className="text-[11px] text-blue-100 font-medium">
              Langkah {step} dari 4
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black leading-snug">
            {step === 1 && 'Identitas Satuan Pendidikan & Pimpinan'}
            {step === 2 && 'Pilih Siklus Langganan Resmi Sekolah'}
            {step === 3 && 'Pembayaran Payment Gateway Midtrans'}
            {step === 4 && 'Ruang Kerja Sekolah Berhasil Diaktifkan!'}
          </h3>
          <p className="text-xs sm:text-sm text-blue-100 mt-1">
            {step === 1 && 'Sama dengan onboarding pendaftaran sekolah. Akun Anda otomatis menjadi Admin Sekolah.'}
            {step === 2 && 'Paket Sekolah adalah langganan resmi institusi tanpa masa uji coba/trial.'}
            {step === 3 && 'Selesaikan pembayaran resmi sekolah via Midtrans Snap (QRIS, VA Bank, Transfer).'}
            {step === 4 && 'Bagikan Kode Sekolah kepada seluruh guru dan wali kelas untuk bergabung.'}
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
                    ? 'w-4 bg-sky-300'
                    : 'w-2 bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Modal Body Steps */}
        <div className="p-5 sm:p-7 space-y-6">
          {/* STEP 1: FORMULIR SEKOLAH & PIMPINAN */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Box Akun Admin Terhubung */}
              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-center justify-between gap-3 text-xs text-blue-900">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                    <Users size={16} />
                  </div>
                  <div>
                    <span className="text-[11px] text-blue-600 block">Penanggung Jawab / Admin Sekolah:</span>
                    <span className="font-black text-slate-800">{adminName}</span>
                    <span className="text-slate-500 ml-1">({adminEmail})</span>
                  </div>
                </div>
                <span className="hidden sm:inline-block px-2.5 py-1 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-lg uppercase">
                  Akun Terhubung
                </span>
              </div>

              {/* Data Satuan Pendidikan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700">Nama Satuan Pendidikan (SD):</label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="Contoh: SDN Cideng 07 Pagi"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">NPSN (8 Digit):</label>
                  <input
                    type="text"
                    maxLength={8}
                    value={npsn}
                    onChange={(e) => setNpsn(e.target.value.replace(/\D/g, ''))}
                    placeholder="20104567"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Status Sekolah:</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="Negeri">Negeri</option>
                    <option value="Swasta">Swasta</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Kota / Kabupaten:</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Jakarta Pusat"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Provinsi:</label>
                  <input
                    type="text"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    placeholder="DKI Jakarta"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Data Pimpinan */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Pimpinan Satuan Pendidikan:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500">Nama Kepala Sekolah:</label>
                    <input
                      type="text"
                      value={principalName}
                      onChange={(e) => setPrincipalName(e.target.value)}
                      placeholder="Dra. Hj. Nurjanah, M.Pd."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500">NIP Kepala Sekolah:</label>
                    <input
                      type="text"
                      value={principalNip}
                      onChange={(e) => setPrincipalNip(e.target.value)}
                      placeholder="197508122000032001"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PILIHAN SIKLUS TAGIHAN RESMI (TANPA TRIAL) */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-2xl flex items-center gap-2 text-xs text-sky-900">
                <ShieldCheck size={18} className="text-sky-600 shrink-0" />
                <p>
                  <strong>Paket Sekolah Resmi:</strong> Berbeda dengan ruang kerja individu guru, pendaftaran Ruang Kerja Sekolah <strong>tidak menyediakan masa uji coba/trial</strong> dan langsung diaktifkan dengan lisensi resmi institusi.
                </p>
              </div>

              {/* Siklus Tagihan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Tahunan (Rekomendasi) */}
                <div
                  onClick={() => setBillingCycle('yearly')}
                  className={`relative p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                    billingCycle === 'yearly'
                      ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <span className={`absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-white text-[10px] font-black uppercase tracking-wide shadow-2xs ${
                    isFirstTimePurchase ? 'bg-amber-500' : 'bg-blue-600'
                  }`}>
                    {isFirstTimePurchase ? 'Hemat 2 Bulan' : 'Paket Tahunan'}
                  </span>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 uppercase">Langganan 1 Tahun</span>
                      {billingCycle === 'yearly' && (
                        <CheckCircle2 size={18} className="text-blue-600" />
                      )}
                    </div>
                    <div className="mt-2">
                      <span className="text-2xl font-black text-slate-900">
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(yearlyPrice)}
                      </span>
                      <span className="text-xs text-slate-500"> / tahun</span>
                    </div>
                    <p className="text-[11px] text-blue-700 font-semibold mt-1">
                      {isFirstTimePurchase
                        ? 'Promo Perdana: hemat 2 bulan (Rp 50.000) dari tarif normal Rp 300.000'
                        : 'Tarif perpanjangan resmi Rp 300.000 / tahun'}
                    </p>
                  </div>
                </div>

                {/* Bulanan */}
                <div
                  onClick={() => setBillingCycle('monthly')}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                    billingCycle === 'monthly'
                      ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 uppercase">Langganan Bulanan</span>
                      {billingCycle === 'monthly' && (
                        <CheckCircle2 size={18} className="text-blue-600" />
                      )}
                    </div>
                    <div className="mt-2">
                      <span className="text-2xl font-black text-slate-900">
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(monthlyPrice)}
                      </span>
                      <span className="text-xs text-slate-500"> / bulan</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Perpanjangan berkala per 30 hari
                    </p>
                  </div>
                </div>
              </div>

              {/* Fasilitas Ruang Kerja Sekolah */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Fasilitas Lengkap Ruang Kerja Sekolah Terpadu:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                    <span>Hingga 100 Akun Guru & Wali Kelas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                    <span>Kapasitas hingga 1.200 Siswa SD</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                    <span>Hingga 24 Rombel (Maks 50 Siswa/Kelas)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                    <span>Portal Khusus Administrator Sekolah</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                    <span>Presensi Mandiri Siswa via HP</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                    <span>Kop Surat Kedinasan & Tanda Tangan KS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                    <span>Prioritas Bantuan Teknis WhatsApp</span>
                  </div>
                </div>
              </div>

              {/* RINGKASAN BIAYA & TOTAL */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Harga Paket ({billingCycle === 'yearly' ? '1 Tahun' : '1 Bulan'})</span>
                    <span className="font-semibold">Rp {baseAmount.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-2 text-slate-900 border-t border-dashed border-slate-200">
                    <span className="font-bold text-slate-700">Total Tagihan:</span>
                    <span className="font-black text-base text-blue-700">
                      Rp {amountToPay.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: INTEGRASI MIDTRANS SNAP SEKOLAH */}
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
                        {copiedInvoice ? <Check size={14} className="text-blue-600" /> : <Copy size={14} />}
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
                    <span>Satuan Pendidikan:</span>
                    <span className="font-bold text-slate-800">{schoolName} (NPSN: {npsn})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Admin Penanggung Jawab:</span>
                    <span className="font-bold text-slate-800">{adminName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Produk:</span>
                    <span className="font-bold text-slate-800">
                      Paket Sekolah ({billingCycle === 'yearly' ? '1 Tahun' : '1 Bulan'})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gateway:</span>
                    <span className="font-semibold text-blue-700">Midtrans (QRIS, VA Bank, Transfer Instan)</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-black text-slate-900">
                    <span>Total Tagihan:</span>
                    <span className="text-blue-700">Rp {paymentSession.amount.toLocaleString('id-ID')}</span>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowInvoiceModal(true)}
                    className="w-full py-2.5 px-3 rounded-xl border border-blue-300 bg-blue-50/70 hover:bg-blue-100 text-blue-800 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <FileText size={14} />
                    <span>Lihat & Cetak Faktur / Tagihan Resmi Sekolah</span>
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
                    className="p-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
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
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
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
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline cursor-pointer"
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

          {/* STEP 4: SUKSES AKTIVASI SEKOLAH & KODE SEKOLAH */}
          {step === 4 && (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h4 className="text-xl font-black text-slate-800">
                  Ruang Kerja Sekolah Berhasil Aktif!
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 mt-1.5 max-w-md mx-auto">
                  Satuan Pendidikan <strong>{schoolName}</strong> kini resmi beroperasi di Kawacanaan dengan status <strong>Paket Sekolah</strong>.
                </p>
              </div>

              {/* Kartu Kode Sekolah untuk Bergabung */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 text-center max-w-md mx-auto space-y-2">
                <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block">
                  Kode Bergabung Sekolah (School Code):
                </span>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl font-mono font-black text-blue-900 tracking-widest bg-white px-4 py-1.5 rounded-xl border border-blue-300 shadow-xs">
                    {generatedSchoolCode || npsn}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm cursor-pointer"
                    title="Salin Kode Sekolah"
                  >
                    {copiedCode ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                <p className="text-[11px] text-blue-800 font-medium">
                  Bagikan kode ini kepada para guru dan wali kelas agar mereka dapat langsung bergabung ke Ruang Kerja Sekolah ini.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2.5 max-w-md mx-auto text-xs text-slate-700">
                <p className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">
                  Hak Akses Anda sebagai Administrator Sekolah:
                </p>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">1</span>
                  <span>Kelola seluruh data rombel, guru mapel, dan wali kelas di portal Admin.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">2</span>
                  <span>Atur jam masuk, jam pulang, dan presensi mandiri siswa via HP.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">3</span>
                  <span>Sekolah otomatis terdaftar dan terpantau di Super Admin platform.</span>
                </div>
              </div>

              {paymentSession && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInvoiceModal(true)}
                    className="py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold inline-flex items-center gap-2 shadow-xs transition cursor-pointer"
                  >
                    <Printer size={15} className="text-blue-600" />
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
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-black text-white transition shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span>Lanjut Pilih Siklus</span>
                <ArrowRight size={14} />
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={handleProceedToPayment}
                disabled={isSubmittingPayment}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-xs font-black text-white transition shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
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
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-black text-white transition shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span>Masuk ke Ruang Kerja Sekolah</span>
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
            schoolName: schoolName,
            npsn: npsn,
            customerName: adminName,
            customerEmail: adminEmail,
            customerPhone: currentUser?.phone,
            planName: `Paket Sekolah (${billingCycle === 'yearly' ? '1 Tahun' : '1 Bulan'})`,
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
            paymentMethod: 'Midtrans Payment Gateway (QRIS / Virtual Account / Transfer)',
            status: step === 4 ? 'settled' : 'pending',
            notes: `Lisensi Satuan Pendidikan Kawacanaan (${billingCycle === 'yearly' ? 'Tahunan' : 'Bulanan'}) untuk NPSN ${npsn}.`,
          }}
        />
      )}
    </div>
  );
};
