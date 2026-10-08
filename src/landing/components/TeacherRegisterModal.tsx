import React, { useState, useEffect, useRef } from 'react';
import {
  GraduationCap,
  BookOpen,
  ArrowLeft,
  ArrowRight,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  X,
  ShieldCheck,
  CheckCircle2,
  QrCode,
  Copy,
  Check,
  CreditCard,
  RefreshCw,
  Zap,
  Clock,
  Sparkles,
  Wallet,
  Building2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import waliKelasWanitaImg from '../../assets/images/wali_kelas_wanita_1789830539387.jpg';
import guruMapelPriaImg from '../../assets/images/guru_mapel_pria_1789830556851.jpg';
import { LoginCredentialCard, LoginCredentialCardData } from './LoginCredentialCard';
import { KawacanaanEmblem } from '../../components/KawacanaanEmblem';
import { fetchMidtransClientConfig, loadMidtransSnapScript } from '../../utils/midtransClient';

interface TeacherRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLogin: () => void;
  onEnterSystem?: () => void;
  onEnterDashboard?: () => void;
  initialBillingCycle?: BillingCycle;
  lang: 'ID' | 'EN';
}

type RoleType = 'homeroom' | 'subject';
type BillingCycle = 'monthly' | 'yearly';

interface PaymentSessionData {
  orderId: string;
  snapToken: string | null;
  amount: number;
  planTitle: string;
  billingCycle: BillingCycle;
  teacherFullName: string;
  schoolName?: string;
  username: string;
  role: string;
  schoolId?: string;
  schoolCode?: string;
  status: 'PENDING' | 'SETTLED' | 'EXPIRED';
}

interface RegistrationSuccessData {
  teacherName: string;
  schoolName?: string;
  username: string;
  password?: string;
  email?: string;
  role: string;
  workspaceName: string;
  invoiceNo?: string;
  billingCycle: BillingCycle;
  amount: number;
  expiresInDays: number;
}

export const TeacherRegisterModal: React.FC<TeacherRegisterModalProps> = ({
  isOpen,
  onClose,
  onOpenLogin,
  onEnterDashboard,
  initialBillingCycle,
  lang,
}) => {
  const { loginWithCredentials, setActiveView } = useApp();

  // Wizard Steps:
  // 1: Pilih Peran
  // 2: Pendaftaran (Form Identitas & Akun)
  // 3: Pembayaran (Metode Pembayaran Midtrans)
  // 4: Aktif (Kredensial & Ruang Kerja Aktif)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedRole, setSelectedRole] = useState<RoleType>('homeroom');

  // Form Fields (Pendaftaran)
  const [schoolName, setSchoolName] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameManuallyEdited, setUsernameManuallyEdited] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialBillingCycle || 'monthly');

  // Payment & Success States
  const [paymentSession, setPaymentSession] = useState<PaymentSessionData | null>(null);
  const [registrationSuccessData, setRegistrationSuccessData] = useState<RegistrationSuccessData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [formError, setFormError] = useState('');
  const [paymentCheckMessage, setPaymentCheckMessage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const pollingRef = useRef<any>(null);

  // Pricing: Monthly Rp 5.000, Yearly Rp 60.000
  const monthlyPrice = 5000;
  const yearlyPrice = 60000;
  const currentPrice = billingCycle === 'yearly' ? yearlyPrice : monthlyPrice;

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Load Midtrans Snap Script on modal open
  useEffect(() => {
    if (!isOpen) return;

    fetchMidtransClientConfig()
      .then((cfg) => {
        loadMidtransSnapScript(cfg);
      })
      .catch(() => {});
  }, [isOpen]);

  // Reset or cleanup on close
  useEffect(() => {
    if (isOpen) {
      setFormError('');
      setPaymentCheckMessage(null);
      setBillingCycle(initialBillingCycle || 'monthly');
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  }, [isOpen, initialBillingCycle]);

  // Real-time polling when waiting for payment in step 3
  useEffect(() => {
    if (paymentSession && paymentSession.status === 'PENDING' && !registrationSuccessData && step === 3) {
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
              handleCompleteActivation(paymentSession);
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
  }, [paymentSession, registrationSuccessData, step]);

  if (!isOpen) return null;

  // Auto-generate suggested username from Full Name (sama dengan FreeStartModal)
  const handleFullNameChange = (name: string) => {
    setFullName(name);
    if (!usernameManuallyEdited) {
      const sanitized = name
        .toLowerCase()
        .replace(/dr\.|dra\.|drs\.|s\.pd\.|m\.pd\.|h\.|hj\./gi, '')
        .trim()
        .replace(/\s+/g, '.')
        .replace(/[^a-z0-9.]/g, '')
        .slice(0, 24);
      if (sanitized) {
        setUsername(sanitized);
      }
    }
  };

  const handleSelectRole = (role: RoleType) => {
    setSelectedRole(role);
    setFormError('');
    setStep(2);
  };

  // Step 2 Submission: Register Account & Create Midtrans Transaction
  const handleSubmitAndProceedPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanSchool = schoolName.trim();
    const cleanName = fullName.trim();
    const cleanUsername = username.trim().toLowerCase();

    if (!cleanSchool) {
      setFormError(lang === 'ID' ? 'Nama satuan pendidikan wajib diisi.' : 'Educational unit / school name is required.');
      return;
    }
    if (!cleanName) {
      setFormError(lang === 'ID' ? 'Nama lengkap wajib diisi.' : 'Full name is required.');
      return;
    }
    if (!cleanUsername) {
      setFormError(lang === 'ID' ? 'Username wajib diisi.' : 'Username is required.');
      return;
    }
    if (cleanUsername.length < 3) {
      setFormError(lang === 'ID' ? 'Username minimal 3 karakter.' : 'Username must be at least 3 characters.');
      return;
    }
    if (!/^[a-z0-9._-]+$/.test(cleanUsername)) {
      setFormError(
        lang === 'ID'
          ? 'Username hanya boleh berisi huruf kecil, angka, titik, atau strip.'
          : 'Username can only contain lowercase letters, numbers, dots, or hyphens.'
      );
      return;
    }
    if (!password) {
      setFormError(lang === 'ID' ? 'Kata sandi wajib diisi.' : 'Password is required.');
      return;
    }
    if (password.length < 6) {
      setFormError(lang === 'ID' ? 'Kata sandi minimal 6 karakter.' : 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError(lang === 'ID' ? 'Konfirmasi kata sandi tidak cocok.' : 'Password confirmation does not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payloadRole = selectedRole === 'homeroom' ? 'WALI KELAS' : 'GURU MAPEL';
      const cleanEmail = email.trim().toLowerCase() || `${cleanUsername}@guru.kawacanaan.sch.id`;

      // 1. Daftarkan akun guru dengan Ruang Kerja Individu Pro di backend
      const onboardRes = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register_and_onboard',
          fullName: cleanName,
          username: cleanUsername,
          email: cleanEmail,
          password: password,
          role: payloadRole,
          mode: 'personal',
          plan: 'guru_gratis',
          nip: '-',
          gender: 'L',
          grade: 1,
          className: 'Kelas 1',
          subjectName: selectedRole === 'subject' ? 'Guru Mata Pelajaran' : undefined,
          workspaceName: cleanSchool,
          schoolId: null,
        }),
      });

      const onboardData = await onboardRes.json();
      if (!onboardRes.ok || (!onboardData.ok && !onboardData.success)) {
        throw new Error(
          onboardData.error ||
            (lang === 'ID' ? 'Pendaftaran akun guru gagal. Silakan coba lagi.' : 'Teacher registration failed.')
        );
      }

      const createdSchoolId = onboardData.schoolId;
      const createdSchoolCode = onboardData.schoolCode;

      // 2. Buat Tagihan Midtrans Snap untuk Paket Guru
      const midtransRes = await fetch('/api/midtrans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_transaction',
          plan_id: 'teacher',
          billing_cycle: billingCycle,
          school_id: createdSchoolId || null,
          school_name: cleanSchool,
          contact_name: cleanName,
          email: cleanEmail,
          npsn: null,
        }),
      });

      const midtransData = await midtransRes.json();
      if (!midtransRes.ok || !midtransData.ok) {
        throw new Error(
          midtransData.error ||
            (lang === 'ID'
              ? 'Gagal membuat sesi pembayaran Midtrans. Silakan coba lagi.'
              : 'Failed to create payment session.')
        );
      }

      const session: PaymentSessionData = {
        orderId: midtransData.order_id,
        snapToken: midtransData.snap_token || midtransData.token || null,
        amount: midtransData.amount || currentPrice,
        planTitle: midtransData.plan_title || `Paket Guru (${billingCycle === 'yearly' ? '1 Tahun' : '1 Bulan'})`,
        billingCycle,
        teacherFullName: cleanName,
        schoolName: cleanSchool,
        username: cleanUsername,
        role: payloadRole,
        schoolId: createdSchoolId,
        schoolCode: createdSchoolCode,
        status: 'PENDING',
      };

      setPaymentSession(session);
      setStep(3);

      // Auto-launch Snap popup if available
      if (session.snapToken && (window as any).snap) {
        setTimeout(() => {
          handleLaunchSnap(session.snapToken!);
        }, 400);
      }
    } catch (err: any) {
      setFormError(err.message || (lang === 'ID' ? 'Terjadi kesalahan sistem.' : 'A system error occurred.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Launch Midtrans Snap Modal
  const handleLaunchSnap = (token: string) => {
    if (!(window as any).snap) {
      setPaymentCheckMessage(
        'Komponen Midtrans Snap belum siap. Silakan klik tombol Cek Status atau Verifikasi Instan di bawah.'
      );
      return;
    }

    (window as any).snap.pay(token, {
      onSuccess: () => {
        handleCompleteActivation(paymentSession);
      },
      onPending: () => {
        setPaymentCheckMessage('Menunggu penyelesaian transfer/pembayaran Anda via Midtrans.');
      },
      onError: (err: any) => {
        setPaymentCheckMessage(err?.status_message || 'Pembayaran dibatalkan atau gagal.');
      },
      onClose: () => {
        setPaymentCheckMessage(
          'Jendela pembayaran ditutup. Anda dapat membuka kembali atau mengecek status secara berkala.'
        );
      },
    });
  };

  // Check Status Inquiry via Midtrans API
  const handleCheckStatus = async (orderId: string) => {
    setIsCheckingPayment(true);
    setPaymentCheckMessage(null);
    try {
      const res = await fetch(`/api/midtrans?action=check_status&order_id=${encodeURIComponent(orderId)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Gagal memeriksa status pembayaran.');

      if (body.is_settled || body.status === 'settlement' || body.status === 'capture') {
        handleCompleteActivation(paymentSession);
      } else {
        setPaymentCheckMessage(`Status pembayaran: ${body.status || 'PENDING'}. Menunggu transfer.`);
      }
    } catch (e: any) {
      setPaymentCheckMessage(e.message || 'Gagal menghubungi server Midtrans.');
    } finally {
      setIsCheckingPayment(false);
    }
  };

  // Final Transition to Step 4 (Paket Guru Aktif & Kredensial)
  const handleCompleteActivation = (session: PaymentSessionData | null) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    const tName = session?.teacherFullName || fullName.trim();
    const sName = session?.schoolName || schoolName.trim() || `Ruang Kerja ${tName}`;
    const uName = session?.username || username.trim();
    const rName = session?.role || (selectedRole === 'homeroom' ? 'WALI KELAS' : 'GURU MAPEL');
    const isYr = billingCycle === 'yearly' || session?.billingCycle === 'yearly';

    setRegistrationSuccessData({
      teacherName: tName,
      schoolName: sName,
      username: uName,
      password: password,
      email: email.trim() || `${uName}@guru.kawacanaan.sch.id`,
      role: rName,
      workspaceName: sName,
      invoiceNo: session?.orderId,
      billingCycle: isYr ? 'yearly' : 'monthly',
      amount: session?.amount || (isYr ? yearlyPrice : monthlyPrice),
      expiresInDays: isYr ? 365 : 30,
    });

    setStep(4);
  };

  // Direct login and enter Individual Workspace Dashboard
  const handleEnterDashboard = async () => {
    const cleanUsername = registrationSuccessData?.username || username.trim();
    const cleanPassword = password;

    try {
      sessionStorage.setItem('kwc_prefill_username', cleanUsername);
      sessionStorage.setItem('kwc_prefill_password', cleanPassword);
    } catch (_) {}

    setIsSubmitting(true);
    try {
      const loginRes = await loginWithCredentials(cleanUsername, cleanPassword);
      if (loginRes.success) {
        onClose();
        setActiveView('dashboard');
        if (onEnterDashboard) {
          onEnterDashboard();
        }
      } else {
        onClose();
        onOpenLogin();
      }
    } catch (_) {
      onClose();
      onOpenLogin();
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div
      id="teacher-register-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
    >
      <div
        id="teacher-register-modal-content"
        className="relative w-full max-w-xl md:max-w-2xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden my-auto animate-in zoom-in-95 duration-200 flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[90vh]"
      >
        {/* ========================================================================= */}
        {/* TOP HEADER: Brand Logo Kawacanaan & Stepper (1 Peran, 2 Daftar, 3 Bayar, 4 Aktif) */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between px-3.5 sm:px-6 py-2.5 sm:py-3.5 border-b border-slate-100 bg-white shrink-0">
          {/* Brand / Logo Kawacanaan SD */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <KawacanaanEmblem size={36} />
            <div className="flex items-center gap-1.5">
              <span className="font-black text-slate-900 text-sm sm:text-base tracking-tight uppercase">
                Kawacanaan
              </span>
              <span className="px-1.5 py-0.5 bg-blue-100/90 text-blue-800 text-[9px] font-black rounded font-mono uppercase tracking-wider border border-blue-200/80">
                SD
              </span>
            </div>
          </div>

          {/* Stepper Indicator & Close Button (Persis Mulai Gratis) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Stepper Indicator */}
            <div className="flex items-center gap-1 sm:gap-1.5 text-xs">
              {step <= 2 ? (
                <>
                  <div
                    className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${
                      step === 1
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-blue-50 text-blue-700 border border-blue-200/70'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] ${
                        step === 1 ? 'bg-white text-blue-600 font-black' : 'bg-blue-600 text-white font-bold'
                      }`}
                    >
                      {step > 1 ? '✓' : '1'}
                    </span>
                    <span>{lang === 'ID' ? 'Pilih Peran' : 'Select Role'}</span>
                  </div>

                  <span className="text-slate-300 font-bold text-[10px] sm:text-xs">→</span>

                  <div
                    className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${
                      step === 2
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] ${
                        step === 2 ? 'bg-white text-blue-600 font-black' : 'bg-slate-300 text-white font-bold'
                      }`}
                    >
                      2
                    </span>
                    <span>{lang === 'ID' ? 'Buat Akun' : 'Create Account'}</span>
                  </div>
                </>
              ) : step === 3 ? (
                <>
                  <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/70">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] bg-blue-600 text-white font-bold">
                      ✓
                    </span>
                    <span>{lang === 'ID' ? 'Akun Guru' : 'Account'}</span>
                  </div>

                  <span className="text-slate-300 font-bold text-[10px] sm:text-xs">→</span>

                  <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold bg-blue-600 text-white shadow-xs">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] bg-white text-blue-600 font-black">
                      3
                    </span>
                    <span>{lang === 'ID' ? 'Pembayaran' : 'Payment'}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold bg-emerald-600 text-white shadow-xs">
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] bg-white text-emerald-600 font-black">
                    ✓
                  </span>
                  <span>{lang === 'ID' ? 'Akun Aktif' : 'Active'}</span>
                </div>
              )}
            </div>

            {/* Close Button */}
            <button
              type="button"
              id="btn-teacher-close"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content Body */}
        <div className="p-3.5 sm:p-5 md:p-6 overflow-y-auto flex-1">
          {/* ========================================================================= */}
          {/* LANGKAH 1: PILIH PERAN (URUTAN 1 - PERSIS DENGAN MULAI GRATIS)             */}
          {/* ========================================================================= */}
          {step === 1 && (
            <div>
              {/* Minimalist Heading with Billing Cycle Switcher */}
              <div className="mb-3.5 sm:mb-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-1">
                  <div>
                    <h2 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight">
                      {lang === 'ID' ? 'Pilih Peran Pendidik' : 'Select Educator Role'}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {lang === 'ID'
                        ? 'Pilih modul presensi yang sesuai dengan tugas mengajar Anda di sekolah.'
                        : 'Choose the attendance module that fits your teaching assignment.'}
                    </p>
                  </div>

                  {/* Badge Paket Sesuai Pilihan Section Harga (Tanpa Opsi Pilihan di Popup) */}
                  <div className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 self-start sm:self-center border shadow-2xs ${
                    billingCycle === 'yearly'
                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                      : 'bg-blue-50 text-blue-900 border-blue-200'
                  }`}>
                    {billingCycle === 'yearly'
                      ? (lang === 'ID' ? `Paket Guru Tahunan (${formatRupiah(yearlyPrice)}/thn)` : `Yearly Teacher Plan (${formatRupiah(yearlyPrice)}/yr)`)
                      : (lang === 'ID' ? `Paket Guru Bulanan (${formatRupiah(monthlyPrice)}/bln)` : `Monthly Teacher Plan (${formatRupiah(monthlyPrice)}/mo)`)}
                  </div>
                </div>
              </div>

              {/* Two Role Selection Cards - Responsive for Mobile & Desktop (Persis Mulai Gratis) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* KARTU 1: WALI KELAS */}
                <div className="bg-white border border-slate-200 hover:border-blue-500 rounded-xl sm:rounded-2xl p-3 sm:p-4 relative flex flex-col justify-between shadow-2xs hover:shadow-md transition-all duration-150 group">
                  <div>
                    {/* Top Row: 3D Educator Avatar & Title */}
                    <div className="flex items-center gap-3">
                      <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-xl sm:rounded-2xl overflow-hidden border-2 border-blue-100 shadow-2xs bg-blue-50/60">
                        <img
                          src={waliKelasWanitaImg}
                          alt="Wali Kelas"
                          className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="w-fit px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider mb-1">
                          Wali Kelas
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-snug">
                          {lang === 'ID' ? 'Wali Kelas / Guru Kelas' : 'Homeroom Teacher'}
                        </h3>
                        <p className="text-[11px] font-semibold text-blue-600 mt-0.5 truncate">
                          {lang === 'ID' ? 'Presensi Harian Kelas SD' : 'Class Attendance & Recap'}
                        </p>
                      </div>
                    </div>

                    {/* Brief Description */}
                    <p className="text-xs text-slate-600 mt-2.5 leading-relaxed line-clamp-2 sm:line-clamp-none">
                      {lang === 'ID'
                        ? 'Kelola presensi seluruh siswa satu kelas, rekap bulanan otomatis, dan cetak format kedinasan resmi.'
                        : 'Manage daily attendance for your classroom students, monthly recaps, and official reports.'}
                    </p>

                    {/* Feature Badges */}
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200/80 text-blue-700 text-[10px] font-semibold">
                        1 Rombel (50 Siswa)
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/80 text-slate-600 text-[10px] font-medium">
                        {lang === 'ID' ? 'Format Kedinasan' : 'Official Report'}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/80 text-slate-600 text-[10px] font-medium">
                        {lang === 'ID' ? 'Hari Efektif Otomatis' : 'Auto School Days'}
                      </span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    type="button"
                    onClick={() => handleSelectRole('homeroom')}
                    id="btn-choose-teacher-homeroom"
                    className="mt-3.5 sm:mt-4 w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold py-2.5 px-3.5 rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer text-xs min-h-[44px]"
                  >
                    <span>{lang === 'ID' ? 'Pilih Wali Kelas' : 'Select Homeroom'}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>

                {/* KARTU 2: GURU MAPEL */}
                <div className="bg-white border border-slate-200 hover:border-emerald-500 rounded-xl sm:rounded-2xl p-3 sm:p-4 relative flex flex-col justify-between shadow-2xs hover:shadow-md transition-all duration-150 group">
                  <div>
                    {/* Top Row: 3D Educator Avatar & Title */}
                    <div className="flex items-center gap-3">
                      <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-xl sm:rounded-2xl overflow-hidden border-2 border-emerald-100 shadow-2xs bg-emerald-50/60">
                        <img
                          src={guruMapelPriaImg}
                          alt="Guru Mapel"
                          className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="w-fit px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider mb-1">
                          Guru Mapel
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-snug">
                          {lang === 'ID' ? 'Guru Mata Pelajaran' : 'Subject Teacher'}
                        </h3>
                        <p className="text-[11px] font-semibold text-emerald-600 mt-0.5 truncate">
                          {lang === 'ID' ? 'Presensi Jam Pelajaran SD' : 'Subject Attendance & Journal'}
                        </p>
                      </div>
                    </div>

                    {/* Brief Description */}
                    <p className="text-xs text-slate-600 mt-2.5 leading-relaxed line-clamp-2 sm:line-clamp-none">
                      {lang === 'ID'
                        ? 'Catat kehadiran per jam pelajaran (PJOK, PAI, dll), kelola multi-rombel hingga 6 kelas, dan jurnal.'
                        : 'Record attendance by subject periods, manage up to 6 classroom groups, and teaching journals.'}
                    </p>

                    {/* Feature Badges */}
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-[10px] font-semibold">
                        Maks. 6 Rombel (300 Siswa)
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/80 text-slate-600 text-[10px] font-medium">
                        {lang === 'ID' ? 'Jadwal Jam Mengajar' : 'Teaching Periods'}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/80 text-slate-600 text-[10px] font-medium">
                        {lang === 'ID' ? 'Jurnal Pembelajaran' : 'Teaching Journal'}
                      </span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    type="button"
                    onClick={() => handleSelectRole('subject')}
                    id="btn-choose-teacher-subject"
                    className="mt-3.5 sm:mt-4 w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-semibold py-2.5 px-3.5 rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer text-xs min-h-[44px]"
                  >
                    <span>{lang === 'ID' ? 'Pilih Guru Mapel' : 'Select Subject'}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>

              {/* Minimalist Bottom Footer */}
              <div className="mt-4 sm:mt-5 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
                <div className="flex items-center gap-1.5 font-medium text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>
                    {lang === 'ID'
                      ? 'Ruang Kerja Individu Pro • Pembayaran Gateway Midtrans Resmi'
                      : 'Teacher Workspace Pro • Official Midtrans Gateway'}
                  </span>
                </div>

                <div className="flex items-center gap-1 font-medium text-[11px]">
                  <span>{lang === 'ID' ? 'Sudah punya akun?' : 'Have an account?'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenLogin();
                    }}
                    className="font-bold text-blue-600 hover:underline cursor-pointer inline-flex items-center gap-0.5 py-0.5"
                  >
                    <span>{lang === 'ID' ? 'Masuk' : 'Sign in'}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* LANGKAH 2: PENDAFTARAN (URUTAN 2 - PERSIS DENGAN FORMULIR MULAI GRATIS)    */}
          {/* ========================================================================= */}
          {step === 2 && (
            <div className="max-w-lg mx-auto">
              {/* Back to Step 1 & Selected Role Banner */}
              <div className="flex items-center justify-between gap-3 pb-3 mb-3.5 border-b border-slate-100 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setFormError('');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer py-1"
                  id="btn-back-to-step1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{lang === 'ID' ? 'Ganti Peran' : 'Change Role'}</span>
                </button>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-500 font-medium hidden xs:inline">
                    {lang === 'ID' ? 'Peran:' : 'Role:'}
                  </span>
                  {selectedRole === 'homeroom' ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
                      <img
                        src={waliKelasWanitaImg}
                        alt="Wali Kelas"
                        className="w-4 h-4 rounded-full object-cover shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <span>{lang === 'ID' ? 'Wali Kelas' : 'Homeroom Teacher'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                      <img
                        src={guruMapelPriaImg}
                        alt="Guru Mapel"
                        className="w-4 h-4 rounded-full object-cover shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <span>{lang === 'ID' ? 'Guru Mapel' : 'Subject Teacher'}</span>
                    </div>
                  )}

                  {/* Badge Paket Sesuai Pilihan Section Harga (Tanpa Opsi Pilihan di Popup) */}
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${
                    billingCycle === 'yearly'
                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                      : 'bg-blue-50 text-blue-900 border-blue-200'
                  }`}>
                    <span>
                      {billingCycle === 'yearly'
                        ? (lang === 'ID' ? `Paket Tahunan (${formatRupiah(yearlyPrice)} / thn)` : `Yearly Plan (${formatRupiah(yearlyPrice)} / yr)`)
                        : (lang === 'ID' ? `Paket Bulanan (${formatRupiah(monthlyPrice)} / bln)` : `Monthly Plan (${formatRupiah(monthlyPrice)} / mo)`)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Title Header */}
              <div className="mb-4 sm:mb-5">
                <h3 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
                  {lang === 'ID' ? 'Pendaftaran Akun Paket Guru' : 'Teacher Plan Registration'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {lang === 'ID'
                    ? `Lengkapi data identitas dan akun pendidik Anda (${billingCycle === 'yearly' ? 'Paket Tahunan' : 'Paket Bulanan'}) untuk melanjutkan ke pembayaran.`
                    : `Fill in your educator account details (${billingCycle === 'yearly' ? 'Yearly Plan' : 'Monthly Plan'}) to proceed to payment.`}
                </p>
              </div>

              {/* Error Alert Banner */}
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-start gap-2 mb-4">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span className="font-semibold leading-tight">{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmitAndProceedPayment} className="space-y-3.5">
                {/* 1. Nama Satuan Pendidikan & Nama Lengkap Guru (Berdampingan 2 Kolom) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Nama Satuan Pendidikan */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      {lang === 'ID' ? 'Nama Satuan Pendidikan' : 'Educational Unit / School Name'} <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        placeholder={lang === 'ID' ? 'Contoh: SDN 1 Kawacanaan' : 'e.g. Kawacanaan Elementary School'}
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium text-slate-900 bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition-all h-11"
                        id="input-teacher-schoolname"
                      />
                    </div>
                  </div>

                  {/* Nama Lengkap Guru */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      {lang === 'ID' ? 'Nama Lengkap Guru' : 'Full Name'} <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => handleFullNameChange(e.target.value)}
                        placeholder="Contoh: Dra. Sri Wahyuni, M.Pd"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium text-slate-900 bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition-all h-11"
                        id="input-teacher-fullname"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Username & Email (Grid 2 Kolom) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Username */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        Username <span className="text-rose-500">*</span>
                      </label>
                      {usernameManuallyEdited && (
                        <button
                          type="button"
                          onClick={() => {
                            setUsernameManuallyEdited(false);
                            handleFullNameChange(fullName);
                          }}
                          className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => {
                        setUsernameManuallyEdited(true);
                        setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''));
                      }}
                      placeholder="username.anda"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono font-medium text-slate-900 bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition-all h-11"
                      id="input-teacher-username"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Email (Opsional)
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="guru@sekolah.sch.id"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium text-slate-900 bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition-all h-11"
                        id="input-teacher-email"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Kata Sandi & Konfirmasi Sandi (Grid 2 Kolom) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Kata Sandi */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Kata Sandi <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 6 karakter"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium text-slate-900 bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition-all h-11"
                        id="input-teacher-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 w-7 h-7 flex items-center justify-center cursor-pointer"
                        aria-label="Tampilkan sandi"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Konfirmasi Sandi */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        Ulangi Sandi <span className="text-rose-500">*</span>
                      </label>
                      {confirmPassword && password === confirmPassword && (
                        <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                          <Check className="w-3 h-3" /> Cocok
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Ketik ulang sandi"
                        className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-medium text-slate-900 bg-white focus:ring-2 focus:ring-blue-600/20 outline-none transition-all h-11 ${
                          confirmPassword && password === confirmPassword
                            ? 'border-emerald-400 focus:border-emerald-500'
                            : confirmPassword && password !== confirmPassword
                            ? 'border-amber-400 focus:border-amber-500'
                            : 'border-slate-300 focus:border-blue-600'
                        }`}
                        id="input-teacher-confirm-password"
                      />
                    </div>
                  </div>
                </div>

                {/* Tombol Lanjut ke Pembayaran */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-xs sm:text-sm uppercase tracking-wider transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer min-h-[46px]"
                    id="btn-submit-teacher-registration"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>{lang === 'ID' ? 'Menyiapkan Pembayaran...' : 'Preparing Payment...'}</span>
                      </>
                    ) : (
                      <>
                        <span>
                          {lang === 'ID'
                            ? `Lanjut ke Pembayaran • ${formatRupiah(currentPrice)} ${billingCycle === 'yearly' ? '/ thn' : '/ bln'}`
                            : `Proceed to Payment • ${formatRupiah(currentPrice)} ${billingCycle === 'yearly' ? '/ yr' : '/ mo'}`}
                        </span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 mt-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Didukung Midtrans Gateway • QRIS, VA Bank & E-Wallet Real-Time</span>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* LANGKAH 3: PEMBAYARAN (URUTAN 3 - METODE PEMBAYARAN MIDTRANS)               */}
          {/* ========================================================================= */}
          {step === 3 && paymentSession && (
            <div className="max-w-lg mx-auto space-y-3.5">
              {/* Back to Step 2 & Session Status Header */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setStep(2);
                    setFormError('');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer py-1"
                  id="btn-back-to-step2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{lang === 'ID' ? 'Ubah Data Pendaftaran' : 'Edit Registration'}</span>
                </button>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Sesi Pembayaran Aktif</span>
                </div>
              </div>

              {/* Rincian Tagihan Order */}
              <div className="p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                      Paket Guru
                    </span>
                    <h4 className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">
                      {paymentSession.planTitle}
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {paymentSession.teacherFullName} • {paymentSession.role}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">Total Tagihan</span>
                    <span className="text-base sm:text-lg font-black text-blue-700">
                      {formatRupiah(paymentSession.amount)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-mono text-slate-600 text-[11px]">
                    <span className="text-slate-400">Invoice:</span>
                    <span className="font-bold text-slate-800">{paymentSession.orderId}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(paymentSession.orderId, 'invoice')}
                    className="text-[11px] text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedField === 'invoice' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedField === 'invoice' ? 'Disalin' : 'Salin'}</span>
                  </button>
                </div>
              </div>

              {/* Tampilan Pilihan Metode Pembayaran yang Tersedia */}
              <div className="p-3.5 bg-blue-50/50 border border-blue-200/80 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-blue-600" />
                    <span>Metode Pembayaran Resmi</span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                    Aktivasi Otomatis
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Metode 1: QRIS */}
                  <div className="p-2.5 bg-white border border-blue-100 rounded-xl flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200/60">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 block text-[11px]">QRIS Instan</span>
                      <span className="text-[10px] text-slate-500">GoPay, OVO, Dana, BCA</span>
                    </div>
                  </div>

                  {/* Metode 2: Virtual Account */}
                  <div className="p-2.5 bg-white border border-blue-100 rounded-xl flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200/60">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 block text-[11px]">Virtual Account</span>
                      <span className="text-[10px] text-slate-500">BCA, Mandiri, BRI, BNI</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Menunggu Pembayaran */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-amber-900 text-xs">
                <Clock className="w-4 h-4 shrink-0 animate-pulse text-amber-600" />
                <div className="flex-1">
                  <span className="font-bold block">Menunggu Konfirmasi Pembayaran</span>
                  <span className="text-[11px] text-amber-700 leading-tight block">
                    Sistem mendeteksi pembayaran Midtrans secara otomatis setiap 4 detik.
                  </span>
                </div>
              </div>

              {paymentCheckMessage && (
                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-blue-600" />
                  <span>{paymentCheckMessage}</span>
                </div>
              )}

              {/* Tombol Aksi Pembayaran */}
              <div className="space-y-2 pt-1">
                {/* 1. Tombol Buka Snap */}
                {paymentSession.snapToken && (
                  <button
                    type="button"
                    id="btn-teacher-open-snap"
                    onClick={() => handleLaunchSnap(paymentSession.snapToken!)}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-xs font-bold uppercase tracking-wider rounded-2xl shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Bayar Sekarang via Midtrans</span>
                  </button>
                )}

                {/* 2. Tombol Cek Status */}
                <button
                  type="button"
                  id="btn-teacher-check-status"
                  disabled={isCheckingPayment}
                  onClick={() => handleCheckStatus(paymentSession.orderId)}
                  className="w-full py-2.5 border border-slate-300 bg-white hover:bg-slate-50 active:scale-[0.99] text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isCheckingPayment ? (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  ) : (
                    <RefreshCw className="w-4 h-4 text-slate-500" />
                  )}
                  <span>Cek Status Pembayaran</span>
                </button>
              </div>

              <div className="text-center text-[10px] text-slate-400">
                Terhubung langsung ke sistem verifikasi pembayaran Midtrans resmi.
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* LANGKAH 4: AKTIF (URUTAN 4 - SUKSES AKTIVASI & KREDENSIAL AKUN)            */}
          {/* ========================================================================= */}
          {step === 4 && registrationSuccessData && (
            <div className="space-y-4 py-2 animate-in fade-in zoom-in-95 duration-200">
              {/* Badge Sukses */}
              <div className="text-center space-y-1.5 max-w-md mx-auto">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span>
                    {lang === 'ID'
                      ? `Paket Guru (${billingCycle === 'yearly' ? 'Tahunan' : 'Bulanan'}) Aktif!`
                      : 'Teacher Workspace Activated!'}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  {lang === 'ID' ? 'Kartu Kredensial Ruang Kerja Anda' : 'Your Workspace Credential Card'}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {lang === 'ID'
                    ? `Selamat! Ruang Kerja Individu Paket Guru Anda telah aktif selama ${registrationSuccessData.expiresInDays} hari. Silakan unduh atau salin kredensial login Anda di bawah ini.`
                    : `Congratulations! Your Teacher Workspace is now active for ${registrationSuccessData.expiresInDays} days. Please download your card below.`}
                </p>
              </div>

              {/* Komponen Kartu Kredensial Login 480 × 300 px Sesuai Format Referensi */}
              <LoginCredentialCard
                data={{
                  workspaceType: 'personal',
                  schoolName: registrationSuccessData.schoolName || schoolName.trim() || `Ruang Kerja Pro - ${registrationSuccessData.teacherName}`,
                  personInCharge: `${registrationSuccessData.teacherName} (${registrationSuccessData.role === 'homeroom' ? 'Wali Kelas' : 'Guru Mapel'})`,
                  role: registrationSuccessData.role === 'homeroom' ? 'WALI KELAS' : 'GURU MAPEL',
                  username: registrationSuccessData.username,
                  password: registrationSuccessData.password || '••••••••',
                  expiryDateText: `${registrationSuccessData.expiresInDays} Hari (${billingCycle === 'yearly' ? 'Tahunan' : 'Bulanan'})`,
                  invoiceNo: registrationSuccessData.invoiceNo || `INV-TCH-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`,
                  nominalText: `Rp ${Number(registrationSuccessData.amount || currentPrice).toLocaleString('id-ID')} (LUNAS)`,
                  paymentMethodText: 'Gateway Midtrans Terverifikasi',
                }}
                onEnterSystem={handleEnterDashboard}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
