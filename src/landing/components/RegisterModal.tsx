import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  School,
  User,
  KeyRound,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Check,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  CreditCard,
  RefreshCw,
  Clock,
  Zap,
  Sparkles,
  Building2,
  ShieldCheck,
  Calendar,
  Layers,
  FileText,
} from 'lucide-react';
import { KawacanaanEmblem } from '../../components/KawacanaanEmblem';
import { supabase } from '../../lib/supabase';
import { LoginCredentialCard, LoginCredentialCardData } from './LoginCredentialCard';
import { fetchMidtransClientConfig, loadMidtransSnapScript } from '../../utils/midtransClient';

// Friendly school building illustration matching reference design
const SchoolIllustration: React.FC<{ className?: string }> = ({ className = "w-20 h-20" }) => (
  <svg viewBox="0 0 160 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Ground line */}
    <rect x="8" y="112" width="144" height="4" rx="2" fill="#93C5FD" opacity="0.5" />
    
    {/* Bushes / Trees */}
    <circle cx="22" cy="98" r="13" fill="#34D399" />
    <circle cx="32" cy="102" r="9" fill="#10B981" />
    <circle cx="138" cy="98" r="13" fill="#34D399" />
    <circle cx="128" cy="102" r="9" fill="#10B981" />
    <rect x="20" y="105" width="4" height="7" rx="1" fill="#047857" />
    <rect x="136" y="105" width="4" height="7" rx="1" fill="#047857" />

    {/* School Base Building */}
    <rect x="36" y="52" width="88" height="60" rx="4" fill="#FFFFFF" />
    <rect x="36" y="52" width="88" height="5" fill="#DBEAFE" />

    {/* Roof & Pediment */}
    <path d="M30 54 L80 18 L130 54 Z" fill="#2563EB" />
    <path d="M42 52 L80 23 L118 52 Z" fill="#3B82F6" />

    {/* Clock Tower / Cupola */}
    <rect x="70" y="8" width="20" height="20" rx="2" fill="#1D4ED8" />
    <path d="M66 10 L80 1 L94 10 Z" fill="#1E40AF" />
    {/* Flag */}
    <path d="M80 1 V-5 H90 L86 -2 L90 1 H80" fill="#EF4444" />
    <line x1="80" y1="1" x2="80" y2="-6" stroke="#FFFFFF" strokeWidth="1.5" />
    {/* Clock dial */}
    <circle cx="80" cy="18" r="5" fill="#FFFFFF" />
    <line x1="80" y1="18" x2="80" y2="15" stroke="#1E3A8A" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="80" y1="18" x2="82.5" y2="18" stroke="#1E3A8A" strokeWidth="1.2" strokeLinecap="round" />

    {/* Windows Row 1 */}
    <rect x="46" y="64" width="13" height="13" rx="2" fill="#60A5FA" />
    <rect x="101" y="64" width="13" height="13" rx="2" fill="#60A5FA" />
    <line x1="52.5" y1="64" x2="52.5" y2="77" stroke="#FFFFFF" strokeWidth="1.5" />
    <line x1="46" y1="70.5" x2="59" y2="70.5" stroke="#FFFFFF" strokeWidth="1.5" />
    <line x1="107.5" y1="64" x2="107.5" y2="77" stroke="#FFFFFF" strokeWidth="1.5" />
    <line x1="101" y1="70.5" x2="114" y2="70.5" stroke="#FFFFFF" strokeWidth="1.5" />

    {/* Windows Row 2 */}
    <rect x="46" y="84" width="13" height="13" rx="2" fill="#60A5FA" />
    <rect x="101" y="84" width="13" height="13" rx="2" fill="#60A5FA" />
    <line x1="52.5" y1="84" x2="52.5" y2="97" stroke="#FFFFFF" strokeWidth="1.5" />
    <line x1="46" y1="90.5" x2="59" y2="90.5" stroke="#FFFFFF" strokeWidth="1.5" />
    <line x1="107.5" y1="84" x2="107.5" y2="97" stroke="#FFFFFF" strokeWidth="1.5" />
    <line x1="101" y1="90.5" x2="114" y2="90.5" stroke="#FFFFFF" strokeWidth="1.5" />

    {/* Main Door / Entrance with Pillars */}
    <path d="M70 76 H90 V112 H70 Z" fill="#1E40AF" />
    <path d="M72 78 H88 V112 H72 Z" fill="#2563EB" />
    <path d="M70 76 Q80 70 90 76" fill="#DBEAFE" />
    <rect x="78" y="94" width="2" height="4" rx="1" fill="#FEF08A" />
    <rect x="80" y="94" width="2" height="4" rx="1" fill="#FEF08A" />

    {/* Steps */}
    <rect x="66" y="108" width="28" height="4" rx="1" fill="#93C5FD" />
  </svg>
);

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        callbacks: {
          onSuccess?: (result: any) => void;
          onPending?: (result: any) => void;
          onError?: (result: any) => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

export interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLogin?: () => void;
  initialPlanId?: 'free' | 'teacher' | 'school';
  initialBillingCycle?: 'monthly' | 'yearly';
  allowCycleChange?: boolean;
  lang?: 'ID' | 'EN';
  mode?: 'landing' | 'superadmin';
  onSchoolCreated?: (school: any, admin: any) => void;
}

interface PaymentSessionData {
  orderId: string;
  snapToken: string | null;
  redirectUrl: string | null;
  amount: number;
  planTitle: string;
  billingCycle: 'monthly' | 'yearly';
  schoolId?: string;
  schoolName: string;
  schoolCode?: string;
  npsn?: string;
  contactName: string;
  email: string;
  status: 'PENDING' | 'SETTLED' | 'EXPIRED';
  isSimulation?: boolean;
  notice?: string;
  createdAdminUsername: string;
  createdAdminRole: string;
}

interface RegistrationSuccessData {
  schoolName: string;
  schoolCode: string;
  npsn?: string;
  username: string;
  adminName: string;
  password: string;
  email?: string;
  invoiceNo?: string;
  plan: string;
  billingCycle: 'monthly' | 'yearly';
  expiryDays: number;
  workspaceType?: 'school' | 'personal';
}

export const RegisterModal: React.FC<RegisterModalProps> = ({
  isOpen,
  onClose,
  onOpenLogin,
  initialPlanId = 'school',
  initialBillingCycle = 'monthly',
  allowCycleChange = true,
  lang = 'ID',
  mode = 'landing',
  onSchoolCreated,
}) => {
  const isSuperadmin = mode === 'superadmin';

  // 1. FORM STATE - ONBOARDING DAFTAR SEKOLAH
  const [schoolName, setSchoolName] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameManuallyEdited, setUsernameManuallyEdited] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(initialBillingCycle);

  // Khusus Superadmin: opsi layanan ruang kerja & masa berlaku Direct Subscription
  const [workspaceService, setWorkspaceService] = useState<'school_integrated' | 'teacher_independent'>('school_integrated');
  const [durationPreset, setDurationPreset] = useState<'monthly' | 'yearly' | 'permanent'>('yearly');
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [npsn, setNpsn] = useState('');

  const handleSelectDuration = (preset: 'monthly' | 'yearly' | 'permanent') => {
    setDurationPreset(preset);
    if (preset === 'monthly') {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      setSubscriptionExpiresAt(d.toISOString().slice(0, 10));
      setBillingCycle('monthly');
    } else if (preset === 'yearly') {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      setSubscriptionExpiresAt(d.toISOString().slice(0, 10));
      setBillingCycle('yearly');
    } else {
      setSubscriptionExpiresAt('');
      setBillingCycle('yearly');
    }
  };

  // 2. SUBMISSION & ERROR STATE
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // 3. MIDTRANS & PAYMENT SESSION STATE (Hanya untuk Landing Page)
  const [paymentSession, setPaymentSession] = useState<PaymentSessionData | null>(null);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [paymentCheckMessage, setPaymentCheckMessage] = useState<string | null>(null);
  const pollingRef = useRef<any>(null);

  // 4. SUCCESS ACTIVATION STATE
  const [registrationSuccessData, setRegistrationSuccessData] = useState<RegistrationSuccessData | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);
  const [copiedInvoice, setCopiedInvoice] = useState(false);

  // Midtrans Client Key & Snap script loader (Hanya diperlukan di Landing Page flow)
  useEffect(() => {
    if (!isOpen || isSuperadmin) return;

    fetchMidtransClientConfig()
      .then((cfg) => {
        loadMidtransSnapScript(cfg);
      })
      .catch(() => {});
  }, [isOpen, isSuperadmin]);

  // Reset states on modal open
  useEffect(() => {
    if (isOpen) {
      setSchoolName('');
      setAdminFullName('');
      setUsername('');
      setUsernameManuallyEdited(false);
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setSubmitError('');
      setPaymentCheckMessage(null);
      setPaymentSession(null);
      setRegistrationSuccessData(null);
      setAdminNotes('');
      setNpsn('');
      setWorkspaceService('school_integrated');
      setDurationPreset('yearly');
      const defaultExp = new Date();
      defaultExp.setFullYear(defaultExp.getFullYear() + 1);
      setSubscriptionExpiresAt(defaultExp.toISOString().slice(0, 10));
      setBillingCycle(initialBillingCycle || 'yearly');
      setCopiedCredentials(false);
      setCopiedInvoice(false);
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  }, [isOpen, initialBillingCycle]);

  // Real-time polling when waiting for payment (Landing Page only)
  useEffect(() => {
    if (!isSuperadmin && paymentSession && paymentSession.status === 'PENDING' && !registrationSuccessData) {
      if (!pollingRef.current) {
        pollingRef.current = setInterval(async () => {
          try {
            const res = await fetch(`/api/midtrans?action=check_status&order_id=${encodeURIComponent(paymentSession.orderId)}`);
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
  }, [paymentSession, registrationSuccessData, isSuperadmin]);

  if (!isOpen) return null;

  // Auto-generate username from Admin Full Name
  const handleAdminNameChange = (name: string) => {
    setAdminFullName(name);
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

  const handleUsernameChange = (val: string) => {
    setUsernameManuallyEdited(true);
    setUsername(val.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 28));
  };

  const handleResetAutoUsername = () => {
    setUsernameManuallyEdited(false);
    const sanitized = adminFullName
      .toLowerCase()
      .replace(/dr\.|dra\.|drs\.|s\.pd\.|m\.pd\.|h\.|hj\./gi, '')
      .trim()
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9.]/g, '')
      .slice(0, 24);
    setUsername(sanitized || 'admin.sekolah');
  };

  // Pricing calculation (Landing page - Pendaftaran Sekolah Baru)
  const priceMonthly = 25000;
  const priceYearly = 250000; // Hemat 2 bulan (Rp 50.000) untuk promo perdana pendaftaran sekolah
  const activeAmount = billingCycle === 'yearly' ? priceYearly : priceMonthly;

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Trigger Snap Payment Modal (Landing Page)
  const triggerSnapPay = (token: string, session: PaymentSessionData) => {
    if (!window.snap) {
      setPaymentCheckMessage('Komponen Midtrans Snap sedang disiapkan. Silakan klik tombol bayar di bawah.');
      return;
    }
    window.snap.pay(token, {
      onSuccess: async () => {
        setIsCheckingPayment(true);
        try {
          await fetch(`/api/midtrans?action=check_status&order_id=${encodeURIComponent(session.orderId)}`);
          handleCompleteActivation(session);
        } catch (_) {
          handleCompleteActivation(session);
        } finally {
          setIsCheckingPayment(false);
        }
      },
      onPending: () => {
        setPaymentCheckMessage('Transaksi tercatat di Midtrans. Menunggu konfirmasi pembayaran Anda.');
      },
      onError: () => {
        setPaymentCheckMessage('Pembayaran belum berhasil. Silakan coba kembali atau gunakan metode lain.');
      },
      onClose: () => {
        setPaymentCheckMessage('Jendela pembayaran ditutup. Anda dapat membuka kembali pembayaran atau mengecek status.');
      },
    });
  };

  // Check Status Inquiry (Landing Page)
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
        setPaymentCheckMessage(`Status pembayaran: ${body.status || 'PENDING'}. Menunggu transfer/konfirmasi.`);
      }
    } catch (e: any) {
      setPaymentCheckMessage(e.message || 'Gagal menghubungi server Midtrans.');
    } finally {
      setIsCheckingPayment(false);
    }
  };

  // Selesaikan Aktivasi & Terbitkan Kredensial (Landing Page)
  const handleCompleteActivation = (session: PaymentSessionData | null) => {
    if (!session) return;
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    const successData: RegistrationSuccessData = {
      schoolName: session.schoolName,
      schoolCode: session.schoolCode || 'SCH-' + Math.floor(100000 + Math.random() * 900000),
      npsn: session.npsn,
      username: session.createdAdminUsername,
      adminName: session.contactName,
      password: password,
      email: session.email,
      invoiceNo: session.orderId,
      plan: 'Paket Sekolah',
      billingCycle: session.billingCycle,
      expiryDays: session.billingCycle === 'yearly' ? 365 : 30,
    };

    setRegistrationSuccessData(successData);
    setPaymentSession(null);
  };

  // Submit Handler: Menangani Pendaftaran Onboarding
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    const cleanSchoolName = schoolName.trim();
    const cleanAdminName = adminFullName.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanSchoolName) {
      setSubmitError(lang === 'ID' ? 'Nama satuan pendidikan / sekolah wajib diisi.' : 'School name is required.');
      return;
    }
    if (!cleanAdminName) {
      setSubmitError(lang === 'ID' ? 'Nama lengkap penanggung jawab / admin wajib diisi.' : 'Admin name is required.');
      return;
    }
    if (!cleanUsername) {
      setSubmitError(lang === 'ID' ? 'Username akses admin wajib ditentukan.' : 'Admin username is required.');
      return;
    }
    if (password.length < 6) {
      setSubmitError(lang === 'ID' ? 'Kata sandi minimal 6 karakter demi keamanan.' : 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError(lang === 'ID' ? 'Konfirmasi kata sandi tidak cocok.' : 'Password confirmation does not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      // -------------------------------------------------------------
      // ALUR SUPERADMIN: Langsung masuk onboarding tanpa pembayaran!
      // -------------------------------------------------------------
      if (isSuperadmin) {
        const isPersonal = workspaceService === 'teacher_independent';
        const regPayload = {
          schoolName: cleanSchoolName,
          namaSekolah: cleanSchoolName,
          adminName: cleanAdminName,
          fullName: cleanAdminName,
          username: cleanUsername,
          email: cleanEmail || undefined,
          password: password,
          plan: isPersonal ? 'teacher' : 'school',
          workspace_type: isPersonal ? 'personal' : 'school',
          workspace_service: workspaceService,
          subscription_expires_at: subscriptionExpiresAt || null,
          notes: adminNotes || undefined,
          npsn: npsn.trim() || undefined,
          isSuperadmin: true,
          mode: 'superadmin',
        };

        const { data: authSession } = await supabase.auth.getSession();
        const token = authSession?.session?.access_token;
        const regHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) {
          regHeaders['Authorization'] = `Bearer ${token}`;
        }

        const regRes = await fetch('/api/register-school', {
          method: 'POST',
          headers: regHeaders,
          body: JSON.stringify(regPayload),
        });

        const regData = await regRes.json();
        if (!regRes.ok || !regData.ok) {
          throw new Error(regData?.error || 'Pendaftaran sekolah oleh Superadmin gagal diproses.');
        }

        const createdSchool = regData.school;
        const createdAdmin = regData.admin;

        // Direct Subscription: bypass Midtrans payment completely, jumps directly to success activation screen
        const successData: RegistrationSuccessData = {
          schoolName: createdSchool?.name || cleanSchoolName,
          schoolCode: createdSchool?.code || createdSchool?.schoolCode || 'SCH-' + Math.floor(100000 + Math.random() * 900000),
          npsn: createdSchool?.npsn || (npsn.trim() ? npsn.trim() : undefined),
          username: createdAdmin?.username || cleanUsername,
          adminName: createdAdmin?.name || cleanAdminName,
          password: password,
          email: cleanEmail || undefined,
          invoiceNo: 'DIRECT-SUBSCRIPTION',
          plan: isPersonal ? 'Ruang Kerja Individu (Guru Mandiri)' : 'Ruang Kerja Sekolah (Sekolah Terpadu)',
          billingCycle: durationPreset === 'monthly' ? 'monthly' : 'yearly',
          expiryDays: subscriptionExpiresAt
            ? Math.max(1, Math.round((new Date(subscriptionExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            : 9999,
          workspaceType: isPersonal ? 'personal' : 'school',
        };

        setRegistrationSuccessData(successData);
        if (onSchoolCreated) {
          onSchoolCreated(createdSchool, createdAdmin);
        }
        return;
      }

      // -------------------------------------------------------------
      // ALUR LANDING PAGE: Wajib menyelesaikan pembayaran Midtrans
      // -------------------------------------------------------------
      const regPayload = {
        schoolName: cleanSchoolName,
        adminName: cleanAdminName,
        fullName: cleanAdminName,
        username: cleanUsername,
        email: cleanEmail || undefined,
        password: password,
        plan: 'school',
      };

      const regRes = await fetch('/api/register-school', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regPayload),
      });

      const regData = await regRes.json();
      if (!regRes.ok || !regData.ok) {
        throw new Error(regData?.error || 'Pendaftaran sekolah gagal diproses.');
      }

      const createdSchool = regData.school;
      const createdAdmin = regData.admin;

      // Buat Transaksi Midtrans Snap
      const midtransPayload = {
        action: 'create_transaction',
        plan_id: 'school',
        billing_cycle: billingCycle,
        school_id: createdSchool?.id,
        school_name: cleanSchoolName,
        school_code: createdSchool?.code || createdSchool?.schoolCode,
        npsn: createdSchool?.npsn,
        contact_name: cleanAdminName,
        email: cleanEmail || `${cleanUsername}@login.kawacanaan.local`,
      };

      const midRes = await fetch('/api/midtrans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(midtransPayload),
      });

      const midData = await midRes.json();
      if (!midRes.ok || !midData.ok) {
        throw new Error(midData?.error || 'Gagal menyiapkan tagihan Midtrans.');
      }

      const session: PaymentSessionData = {
        orderId: midData.order_id,
        snapToken: midData.snap_token || midData.token || null,
        redirectUrl: midData.redirect_url || null,
        amount: midData.amount || activeAmount,
        planTitle: midData.plan_title || (billingCycle === 'yearly' ? 'Paket Sekolah Dasar (1 Tahun)' : 'Paket Sekolah Dasar (1 Bulan)'),
        billingCycle,
        schoolId: createdSchool?.id,
        schoolName: cleanSchoolName,
        schoolCode: createdSchool?.code || createdSchool?.schoolCode,
        npsn: createdSchool?.npsn,
        contactName: cleanAdminName,
        email: cleanEmail,
        status: 'PENDING',
        isSimulation: !!midData.is_simulation,
        notice: midData.notice,
        createdAdminUsername: createdAdmin?.username || cleanUsername,
        createdAdminRole: createdAdmin?.role || 'ADMIN',
      };

      setPaymentSession(session);

      // Otomatis buka popup Midtrans Snap jika tersedia
      if (session.snapToken) {
        if (midData.client_key) {
          try {
            await loadMidtransSnapScript({
              ok: true,
              client_key: midData.client_key,
              is_production: Boolean(midData.is_production),
              snap_url: midData.snap_url,
              enabled: true,
            });
          } catch (_) {}
        }
        setTimeout(() => {
          triggerSnapPay(session.snapToken!, session);
        }, 300);
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Terjadi kesalahan sistem saat pendaftaran.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Salin Kredensial
  const handleCopyCredentials = () => {
    if (!registrationSuccessData) return;
    const text = `KREDENSIAL ADMINISTRATOR KAWACANAAN SD
Nama Satuan Pendidikan: ${registrationSuccessData.schoolName}
Tipe Ruang Kerja: ${registrationSuccessData.workspaceType === 'personal' ? 'Ruang Kerja Individu (Guru Mandiri)' : 'Ruang Kerja Sekolah (Sekolah Terpadu)'}
Kode Undangan Sekolah: ${registrationSuccessData.schoolCode}
${registrationSuccessData.npsn ? `NPSN: ${registrationSuccessData.npsn}\n` : ''}Nama Admin: ${registrationSuccessData.adminName}
Username: ${registrationSuccessData.username}
Kata Sandi: ${registrationSuccessData.password}
Email: ${registrationSuccessData.email || '-'}
Paket: ${registrationSuccessData.plan}
Status: ${isSuperadmin ? 'AKTIF (DIRECT SUBSCRIPTION)' : 'AKTIF / LUNAS'}
Masa Aktif: ${registrationSuccessData.expiryDays >= 9000 ? 'Permanen (Seumur Hidup)' : `${registrationSuccessData.expiryDays} Hari`}
${isSuperadmin ? 'Metode: Direct Subscription (Super Admin)' : `Invoice: ${registrationSuccessData.invoiceNo || '-'}`}`;

    navigator.clipboard.writeText(text);
    setCopiedCredentials(true);
    setTimeout(() => setCopiedCredentials(false), 2500);
  };

  // Navigasi Masuk ke Dashboard Sekolah (Landing Page)
  const handleEnterDashboard = () => {
    if (registrationSuccessData) {
      try {
        sessionStorage.setItem('kwc_prefill_username', registrationSuccessData.username);
        sessionStorage.setItem('kwc_prefill_password', registrationSuccessData.password);
      } catch (_) {}
    }
    onClose();
    if (onOpenLogin) {
      onOpenLogin();
    }
  };

  // Selesai & Tutup untuk Superadmin
  const handleFinishSuperadmin = () => {
    onClose();
  };

  return (
    <div
      id="register-school-modal"
      className="fixed inset-0 z-[999] flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div
        id="register-school-card"
        className="relative w-full max-w-md sm:max-w-xl lg:max-w-[780px] xl:max-w-[800px] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden my-auto flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] lg:max-h-[85vh]"
      >
        {/* Header Modal - Clean White Minimalist matching Navbar & Screenshot */}
        <div
          id="modal-header"
          className="relative bg-white border-b border-slate-100 text-slate-900 px-4 py-2.5 sm:px-5 sm:py-3 shrink-0"
        >
          <button
            id="btn-close-register-modal"
            onClick={onClose}
            className="absolute top-2.5 sm:top-3 right-3 sm:right-4 w-7 h-7 sm:w-8 sm:h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center z-10"
            aria-label="Tutup modal"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pr-8 sm:pr-12 gap-2 sm:gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 rounded-xl flex items-center justify-center text-white font-black text-sm sm:text-base shadow-md shadow-blue-700/25 shrink-0 border border-blue-500/40 relative">
                <span className="relative z-10">K</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500">
                    {isSuperadmin ? 'KAWACANAAN SD • SUPER ADMIN' : 'KAWACANAAN SD'}
                  </span>
                  {isSuperadmin && (
                    <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-bold text-amber-800">
                      <Zap className="w-2.5 h-2.5 text-amber-600" />
                      Direct Subscription
                    </span>
                  )}
                </div>
                <h2 className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 leading-snug">
                  {registrationSuccessData
                    ? isSuperadmin
                      ? 'Sekolah & Admin Berhasil Diterbitkan'
                      : 'Aktivasi Paket Sekolah Berhasil'
                    : paymentSession
                    ? 'Gateway Pembayaran Midtrans'
                    : isSuperadmin
                    ? 'Pendaftaran Satuan Pendidikan (Direct Subscription)'
                    : 'Pendaftaran Sekolah SD'}
                </h2>
              </div>
            </div>

            {/* Step Indicator Minimalist */}
            {isSuperadmin ? (
              /* Step Indicator Khusus Superadmin: 2 Langkah Direct Subscription */
              <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold shrink-0">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
                    !registrationSuccessData
                      ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      !registrationSuccessData ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-700'
                    }`}
                  >
                    1
                  </span>
                  <span className={!registrationSuccessData ? 'text-blue-700' : 'text-slate-500'}>
                    Pendaftaran
                  </span>
                </div>
                <span className="text-slate-300 select-none">—</span>
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
                    registrationSuccessData
                      ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200'
                      : 'bg-slate-50 text-slate-400'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      registrationSuccessData ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    2
                  </span>
                  <span className={registrationSuccessData ? 'text-emerald-700' : 'text-slate-400'}>
                    Direct Subscription
                  </span>
                </div>
              </div>
            ) : (
              /* Step Indicator Landing Page: 3 Langkah (1 Pendaftaran - 2 Pembayaran - 3 Aktif) */
              <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold shrink-0">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
                    !paymentSession && !registrationSuccessData
                      ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                    !paymentSession && !registrationSuccessData ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-700'
                  }`}>
                    1
                  </span>
                  <span className={!paymentSession && !registrationSuccessData ? 'text-blue-700' : 'text-slate-500'}>
                    Pendaftaran
                  </span>
                </div>
                <span className="text-slate-300 select-none">—</span>
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
                    paymentSession
                      ? 'bg-amber-50 text-amber-800 font-bold border border-amber-200'
                      : 'bg-slate-50 text-slate-400'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                    paymentSession ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    2
                  </span>
                  <span className={paymentSession ? 'text-amber-800' : 'text-slate-400'}>
                    Pembayaran
                  </span>
                </div>
                <span className="text-slate-300 select-none hidden sm:inline">—</span>
                <div
                  className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
                    registrationSuccessData
                      ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200'
                      : 'bg-slate-50 text-slate-400'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                    registrationSuccessData ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    3
                  </span>
                  <span className={registrationSuccessData ? 'text-emerald-700' : 'text-slate-400'}>
                    Aktif
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* VIEW 3: LAYAR PAKET SEKOLAH AKTIF & KREDENSIAL TERBIT (KARTU KREDENSIAL LOGIN) */}
        {/* ------------------------------------------------------------------ */}
        {registrationSuccessData ? (
          <div
            id="registration-success-view"
            className="p-3 sm:p-5 md:p-6 space-y-4 overflow-y-auto flex-1 animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Header Status Sukses */}
            <div className="text-center space-y-1.5 max-w-lg mx-auto">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span>
                  {isSuperadmin
                    ? 'Sekolah & Akun Administrator Berhasil Dibuat!'
                    : 'Paket Sekolah Aktif & Terverifikasi!'}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Kartu Kredensial Ruang Kerja Sekolah
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Simpan atau unduh kartu kredensial login resmi Anda di bawah ini sebagai bukti pendaftaran & akses portal administrator.
              </p>
            </div>

            {/* Komponen Kartu Kredensial Login 480 × 300 px Sesuai Format Referensi Visual */}
            <LoginCredentialCard
              data={{
                workspaceType: 'school', // Teks pill: RUANG KERJA SEKOLAH
                schoolName: registrationSuccessData.schoolName,
                personInCharge: `${registrationSuccessData.adminName} (Administrator)`,
                role: 'ADMINISTRATOR',
                username: registrationSuccessData.username,
                password: registrationSuccessData.password,
                expiryDateText:
                  registrationSuccessData.expiryDays >= 9000
                    ? 'Permanen (Seumur Hidup)'
                    : `${registrationSuccessData.expiryDays} Hari Aktif`,
                invoiceNo:
                  registrationSuccessData.invoiceNo ||
                  `INV-SCH-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`,
                nominalText: isSuperadmin ? 'Superadmin Direct' : 'Rp 25.000 (LUNAS)',
                paymentMethodText: isSuperadmin
                  ? 'Registrasi Superadmin'
                  : 'Gateway Midtrans Terverifikasi',
              }}
              onEnterSystem={isSuperadmin ? handleFinishSuperadmin : handleEnterDashboard}
            />

            {/* Informasi Alur Pembuatan Akun Guru oleh Administrator */}
            <div className="max-w-[480px] mx-auto bg-slate-50 border border-slate-200/90 rounded-xl p-3 shadow-2xs flex items-center gap-2.5 text-left">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                <Building2 size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-800">
                  Manajemen Akun Terpusat
                </div>
                <div className="text-[10px] text-slate-500 leading-snug">
                  Akun Wali Kelas dan Guru Mata Pelajaran dapat langsung dibuat dan dikelola oleh Administrator melalui menu <strong>Data Pengguna</strong> di dalam dashboard.
                </div>
              </div>
            </div>
          </div>
        ) : paymentSession ? (
          /* ------------------------------------------------------------------ */
          /* VIEW 2: TAHAP PEMBAYARAN MIDTRANS GATEWAY (LANDING PAGE ONLY)      */
          /* ------------------------------------------------------------------ */
          <div
            id="payment-gateway-view"
            className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1"
          >
            <div className="lg:grid lg:grid-cols-12 lg:gap-6 items-stretch">
              {/* Kolom Kiri: Rincian Tagihan & Invoice */}
              <div className="lg:col-span-5 flex flex-col justify-between space-y-3.5">
                <div className="flex items-start gap-3 p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl">
                  <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                        Menunggu Pembayaran
                      </span>
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                      {paymentSession.planTitle}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Satuan pendidikan: <span className="font-bold text-slate-900">{paymentSession.schoolName}</span>
                    </p>
                  </div>
                </div>

                {/* Summary Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <div>
                      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Nomor Invoice</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {paymentSession.orderId}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(paymentSession.orderId);
                            setCopiedInvoice(true);
                            setTimeout(() => setCopiedInvoice(false), 2000);
                          }}
                          className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
                          title="Salin Nomor Invoice"
                        >
                          {copiedInvoice ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total Investasi</div>
                      <div className="text-base sm:text-lg font-black text-blue-700">
                        {formatRupiah(paymentSession.amount)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Siklus:</span>
                      <span className="font-bold text-slate-800 text-xs">
                        {paymentSession.billingCycle === 'yearly' ? 'Tahunan (12 Bulan)' : 'Bulanan (1 Bulan)'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Metode:</span>
                      <span className="font-bold text-slate-800 text-xs">
                        QRIS, VA Bank, GoPay
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-950 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>
                    Akun Admin <strong className="font-mono font-bold text-blue-900">{paymentSession.createdAdminUsername}</strong> otomatis aktif setelah pembayaran.
                  </span>
                </div>
              </div>

              {/* Kolom Kanan: Tombol Aksi Gateway */}
              <div className="lg:col-span-7 mt-3 lg:mt-0 flex flex-col justify-between space-y-3">
                {paymentCheckMessage && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>{paymentCheckMessage}</span>
                  </div>
                )}

                <div className="space-y-2.5">
                  {paymentSession.snapToken ? (
                    <button
                      id="btn-open-snap"
                      type="button"
                      onClick={() => triggerSnapPay(paymentSession.snapToken!, paymentSession)}
                      className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 hover:from-blue-800 hover:to-indigo-800 text-white font-bold text-sm shadow-md transition-all cursor-pointer min-h-[44px]"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Bayar Sekarang via Midtrans Snap</span>
                    </button>
                  ) : null}

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      id="btn-check-payment-status"
                      type="button"
                      disabled={isCheckingPayment}
                      onClick={() => handleCheckStatus(paymentSession.orderId)}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-800 font-bold text-xs disabled:opacity-60 transition-colors cursor-pointer min-h-[40px]"
                    >
                      {isCheckingPayment ? (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      <span>Cek Status Pembayaran</span>
                    </button>
                  </div>
                </div>

                <div className="text-center text-[10px] text-slate-400">
                  Terhubung ke Gateway Resmi Midtrans & database pusat Kawacanaan SD. Terintegrasi ke Super Admin.
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ------------------------------------------------------------------ */
          /* VIEW 1: FORMULIR ONBOARDING DAFTAR SEKOLAH                         */
          /* ------------------------------------------------------------------ */
          <form
            id="register-school-form"
            onSubmit={handleSubmit}
            className="p-3 sm:p-4 lg:p-4.5 space-y-2.5 overflow-y-auto lg:overflow-visible flex-1"
          >
            {submitError && (
              <div
                id="submit-error-alert"
                className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800 text-xs"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Mohon lengkapi data:</div>
                  <div className="mt-0.5">{submitError}</div>
                </div>
              </div>
            )}

            {/* Layout 2 Kolom Profesional Layaknya Aplikasi Komersial */}
            <div className="lg:grid lg:grid-cols-12 lg:gap-4 items-stretch">
              {/* KOLOM KIRI: Superadmin Panel vs Landing Commercial Card */}
              {isSuperadmin ? (
                /* Card Khusus Superadmin: Tampilan Persis Daftar Sekolah dengan Direct Subscription & Pilihan Ruang Kerja */
                <div className="lg:col-span-5 bg-gradient-to-b from-[#1D4ED8] via-[#1E40AF] to-[#1E3A8A] text-white rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-lg relative overflow-hidden space-y-3">
                  <div className="space-y-3">
                    {/* Header Card: Direct Subscription Badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-white border border-white/30 backdrop-blur-xs flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-300" />
                          Direct Subscription
                        </span>
                        <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full">
                          Super Admin
                        </span>
                      </div>
                      <span className="text-[10px] text-blue-100 font-medium">Bypass Bayar</span>
                    </div>

                    {/* 1. PILIHAN MENENTUKAN RUANG KERJA */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-blue-100">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-amber-300" />
                          Pilihan Ruang Kerja:
                        </span>
                        <span className="text-[10px] text-amber-300 font-bold">
                          {workspaceService === 'school_integrated' ? 'Institusi Sekolah' : 'Pendidik Mandiri'}
                        </span>
                      </div>
                      <div className="bg-black/25 p-1 rounded-xl border border-white/20 grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          id="btn-workspace-school"
                          onClick={() => setWorkspaceService('school_integrated')}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            workspaceService === 'school_integrated'
                              ? 'bg-white text-blue-900 shadow-sm font-black'
                              : 'text-blue-100 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          <span>Ruang Kerja Sekolah</span>
                        </button>
                        <button
                          type="button"
                          id="btn-workspace-teacher"
                          onClick={() => setWorkspaceService('teacher_independent')}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            workspaceService === 'teacher_independent'
                              ? 'bg-white text-blue-900 shadow-sm font-black'
                              : 'text-blue-100 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <User className="w-3.5 h-3.5" />
                          <span>Ruang Kerja Individu</span>
                        </button>
                      </div>
                    </div>

                    {/* 2. PILIHAN MASA AKTIF DIRECT SUBSCRIPTION */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-blue-100">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-amber-300" />
                          Masa Aktif Lisensi:
                        </span>
                        <span className="text-[10px] text-amber-300 font-mono font-bold">
                          {durationPreset === 'permanent'
                            ? 'Permanen'
                            : durationPreset === 'yearly'
                            ? '1 Tahun (365 Hari)'
                            : '1 Bulan (30 Hari)'}
                        </span>
                      </div>
                      <div className="bg-black/25 p-1 rounded-xl border border-white/20 grid grid-cols-3 gap-1">
                        <button
                          type="button"
                          id="btn-duration-monthly"
                          onClick={() => handleSelectDuration('monthly')}
                          className={`py-1 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                            durationPreset === 'monthly'
                              ? 'bg-white text-blue-900 shadow-sm'
                              : 'text-blue-100 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          Bulanan
                        </button>
                        <button
                          type="button"
                          id="btn-duration-yearly"
                          onClick={() => handleSelectDuration('yearly')}
                          className={`py-1 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                            durationPreset === 'yearly'
                              ? 'bg-amber-400 text-slate-950 shadow-sm font-black'
                              : 'text-blue-100 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          Tahunan
                        </button>
                        <button
                          type="button"
                          id="btn-duration-permanent"
                          onClick={() => handleSelectDuration('permanent')}
                          className={`py-1 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                            durationPreset === 'permanent'
                              ? 'bg-emerald-400 text-slate-950 shadow-sm font-black'
                              : 'text-blue-100 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          Permanen
                        </button>
                      </div>
                    </div>

                    {/* Title & Description Dinamis */}
                    <div>
                      <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight leading-snug">
                        {workspaceService === 'school_integrated'
                          ? 'Presensi Terpadu untuk Seluruh Kelas'
                          : 'Presensi Mandiri untuk Ruang Guru'}
                      </h3>
                      <p className="mt-1 text-xs text-blue-100/85 leading-relaxed font-normal">
                        {workspaceService === 'school_integrated'
                          ? 'Solusi lengkap untuk mengelola presensi siswa di seluruh kelas dengan mudah, aman dan efisien.'
                          : 'Kelola rombel binaan, jurnal mengajar dan kehadiran siswa secara mandiri dan fleksibel.'}
                      </p>
                    </div>

                    {/* School Graphic & Direct Subscription Status */}
                    <div className="flex items-center gap-3 py-1 bg-white/5 rounded-xl p-2.5 border border-white/10">
                      <SchoolIllustration className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 drop-shadow-md" />
                      <div>
                        <span className="text-[10px] sm:text-[11px] text-blue-200 font-medium block">
                          Metode Pendaftaran
                        </span>
                        <div className="text-base sm:text-lg font-black text-white tracking-tight flex items-baseline gap-1">
                          <span>Direct Subscription</span>
                        </div>
                        <div className="text-[10px] text-emerald-300 font-bold flex items-center gap-1 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>
                            {durationPreset === 'permanent'
                              ? 'Aktif Permanen (Seumur Hidup)'
                              : durationPreset === 'yearly'
                              ? 'Aktif 1 Tahun (365 Hari)'
                              : 'Aktif 1 Bulan (30 Hari)'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Feature Checklist (Dinamis sesuai Ruang Kerja) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 pt-0.5">
                      {workspaceService === 'school_integrated' ? (
                        <>
                          <div className="flex items-center gap-2 text-xs text-white/95 font-medium">
                            <div className="w-4.5 h-4.5 rounded-full bg-blue-500/70 text-white flex items-center justify-center shrink-0 border border-blue-300/40 shadow-xs">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                            <span>Input &amp; Kelola Rombel Mandiri</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-white/95 font-medium">
                            <div className="w-4.5 h-4.5 rounded-full bg-blue-500/70 text-white flex items-center justify-center shrink-0 border border-blue-300/40 shadow-xs">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                            <span>Maks. 50 Siswa per Rombel</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-white/95 font-medium">
                            <div className="w-4.5 h-4.5 rounded-full bg-blue-500/70 text-white flex items-center justify-center shrink-0 border border-blue-300/40 shadow-xs">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                            <span>Multi-Akun Guru &amp; Wali Kelas</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-white/95 font-medium">
                            <div className="w-4.5 h-4.5 rounded-full bg-blue-500/70 text-white flex items-center justify-center shrink-0 border border-blue-300/40 shadow-xs">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                            <span>Rekap Format Kedinasan Resmi</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 text-xs text-white/95 font-medium">
                            <div className="w-4.5 h-4.5 rounded-full bg-blue-500/70 text-white flex items-center justify-center shrink-0 border border-blue-300/40 shadow-xs">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                            <span>Ruang Kerja Mandiri Pendidik</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-white/95 font-medium">
                            <div className="w-4.5 h-4.5 rounded-full bg-blue-500/70 text-white flex items-center justify-center shrink-0 border border-blue-300/40 shadow-xs">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                            <span>Rombel Binaan Kelas (s.d. 50 Siswa)</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-white/95 font-medium">
                            <div className="w-4.5 h-4.5 rounded-full bg-blue-500/70 text-white flex items-center justify-center shrink-0 border border-blue-300/40 shadow-xs">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                            <span>Akun Guru &amp; Jurnal Mengajar</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-white/95 font-medium">
                            <div className="w-4.5 h-4.5 rounded-full bg-blue-500/70 text-white flex items-center justify-center shrink-0 border border-blue-300/40 shadow-xs">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                            <span>Rekap Format Kedinasan Resmi</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Bottom Info Pill */}
                  <div className="p-2 sm:p-2.5 rounded-xl bg-blue-950/50 border border-white/10 flex items-center gap-2 text-xs text-blue-100">
                    <div className="w-5 h-5 rounded-lg bg-blue-500/30 flex items-center justify-center shrink-0 border border-blue-400/30">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-200" />
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-medium leading-tight">
                      Direct Subscription: Sekolah &amp; Akun Admin langsung tersimpan &amp; aktif di Panel Super Admin.
                    </span>
                  </div>
                </div>
              ) : (
                /* Card Landing Page: Sesuai desain referensi screenshot */
                <div className="lg:col-span-5 bg-gradient-to-b from-[#1D4ED8] via-[#1E40AF] to-[#1E3A8A] text-white rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-lg relative overflow-hidden space-y-3">
                  <div className="space-y-3">
                    {/* Pilihan Siklus Pembayaran (Aktif untuk Beranda, Terkunci tanpa tombol untuk Section Harga) */}
                    {allowCycleChange ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-blue-100">
                          <span>Pilihan Periode Langganan:</span>
                          <span className="text-[10px] text-amber-300 font-bold">
                            {billingCycle === 'yearly' ? 'Hemat 2 Bulan (Promo)' : 'Bayar per Bulan'}
                          </span>
                        </div>
                        <div className="bg-black/25 p-1 rounded-xl border border-white/20 flex items-center gap-1">
                          <button
                            type="button"
                            id="btn-school-billing-monthly"
                            onClick={() => setBillingCycle('monthly')}
                            className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                              billingCycle === 'monthly'
                                ? 'bg-white text-blue-900 shadow-sm'
                                : 'text-blue-100 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            <span>Bulanan</span>
                            <span className={`text-[10px] font-medium ${billingCycle === 'monthly' ? 'text-blue-700' : 'text-blue-200'}`}>
                              (Rp 25rb/bln)
                            </span>
                          </button>
                          <button
                            type="button"
                            id="btn-school-billing-yearly"
                            onClick={() => setBillingCycle('yearly')}
                            className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
                              billingCycle === 'yearly'
                                ? 'bg-amber-400 text-slate-950 shadow-sm font-black'
                                : 'text-blue-100 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            <span>Tahunan</span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-black ${
                              billingCycle === 'yearly' ? 'bg-slate-900 text-amber-300' : 'bg-amber-400 text-slate-950'
                            }`}>
                              Hemat 2 Bln
                            </span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Tampilan badge statis khusus saat dipilih dari Section Harga (tanpa pilihan bulanan/tahunan) */
                      <div className="flex items-center gap-2">
                        <div
                          className={`px-3.5 py-1.5 rounded-full text-xs font-black tracking-wide uppercase flex items-center gap-1.5 ${
                            billingCycle === 'yearly'
                              ? 'bg-amber-400 text-slate-950 shadow-xs ring-2 ring-amber-300/80'
                              : 'bg-white text-blue-900 shadow-xs ring-2 ring-white/60'
                          }`}
                        >
                          <span>{billingCycle === 'yearly' ? 'Paket Tahunan' : 'Paket Bulanan'}</span>
                          {billingCycle === 'yearly' && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-black bg-slate-900 text-amber-300">
                              Hemat 2 Bln
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-blue-100 font-medium">
                          {billingCycle === 'yearly' ? 'Aktif 12 Bulan (Rp 250.000)' : 'Aktif 1 Bulan (Rp 25.000)'}
                        </span>
                      </div>
                    )}

                    {/* Title & Description */}
                    <div>
                      <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight leading-snug">
                        Presensi Terpadu untuk Seluruh Kelas
                      </h3>
                      <p className="mt-1 text-xs text-blue-100/85 leading-relaxed font-normal">
                        Solusi lengkap untuk mengelola presensi siswa di seluruh kelas dengan mudah, aman dan efisien.
                      </p>
                    </div>

                    {/* School Graphic & Investment Price */}
                    <div className="flex items-center gap-3 py-1 bg-white/5 rounded-xl p-2 border border-white/10">
                      <SchoolIllustration className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 drop-shadow-md" />
                      <div>
                        <span className="text-[10px] sm:text-[11px] text-blue-200 font-medium block">
                          Biaya Investasi
                        </span>
                        <div className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-baseline gap-1">
                          <span>{formatRupiah(activeAmount)}</span>
                          <span className="text-xs sm:text-sm font-normal text-blue-200">
                            /{billingCycle === 'yearly' ? 'tahun' : 'bulan'}
                          </span>
                        </div>
                        {billingCycle === 'yearly' && (
                          <div className="text-[10px] text-emerald-300 font-bold flex items-center gap-1 mt-0.5">
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>Hemat Rp 50.000 (2 Bulan Gratis)</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Feature Checklist */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 pt-0.5">
                      <div className="flex items-center gap-2 text-xs text-white/95 font-medium">
                        <div className="w-4.5 h-4.5 rounded-full bg-blue-500/70 text-white flex items-center justify-center shrink-0 border border-blue-300/40 shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>Input &amp; Kelola Rombel Mandiri</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/95 font-medium">
                        <div className="w-4.5 h-4.5 rounded-full bg-blue-500/70 text-white flex items-center justify-center shrink-0 border border-blue-300/40 shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>Maks. 50 Siswa per Rombel</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/95 font-medium">
                        <div className="w-4.5 h-4.5 rounded-full bg-blue-500/70 text-white flex items-center justify-center shrink-0 border border-blue-300/40 shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>Multi-Akun Guru & Wali Kelas</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/95 font-medium">
                        <div className="w-4.5 h-4.5 rounded-full bg-blue-500/70 text-white flex items-center justify-center shrink-0 border border-blue-300/40 shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>Rekap Format Kedinasan Resmi</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Info Pill */}
                  <div className="p-2 sm:p-2.5 rounded-xl bg-blue-950/50 border border-white/10 flex items-center gap-2 text-xs text-blue-100">
                    <div className="w-5 h-5 rounded-lg bg-blue-500/30 flex items-center justify-center shrink-0 border border-blue-400/30">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-200" />
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-medium leading-tight">
                      Midtrans Gateway (QRIS, VA Bank) + Aktivasi Otomatis
                    </span>
                  </div>
                </div>
              )}

              {/* KOLOM KANAN: Form Input Fields & Tombol Submit */}
              <div className="lg:col-span-7 mt-3 lg:mt-0 flex flex-col justify-between space-y-3">
                <div className="space-y-2.5 sm:space-y-3">
                  {/* Header Form Title matching screenshot with mobile cycle toggle */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
                        <School className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">
                          Data Sekolah
                        </h3>
                        <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate">
                          Lengkapi informasi sekolah Anda untuk melanjutkan.
                        </p>
                      </div>
                    </div>

                    {!isSuperadmin && allowCycleChange && (
                      <div className="lg:hidden flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
                        <button
                          type="button"
                          id="btn-school-mobile-cycle-monthly"
                          onClick={() => setBillingCycle('monthly')}
                          className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                            billingCycle === 'monthly'
                              ? 'bg-white text-blue-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Bulanan
                        </button>
                        <button
                          type="button"
                          id="btn-school-mobile-cycle-yearly"
                          onClick={() => setBillingCycle('yearly')}
                          className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                            billingCycle === 'yearly'
                              ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Tahunan
                        </button>
                      </div>
                    )}
                    {!isSuperadmin && !allowCycleChange && (
                      <span className={`lg:hidden px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 border ${
                        billingCycle === 'yearly'
                          ? 'bg-amber-100 text-amber-950 border-amber-300'
                          : 'bg-blue-100 text-blue-900 border-blue-200'
                      }`}>
                        {billingCycle === 'yearly' ? 'Tahunan' : 'Bulanan'}
                      </span>
                    )}
                  </div>

                  {/* 1. NAMA SATUAN PENDIDIKAN & 2. NAMA LENGKAP ADMIN (Berdampingan 2 Kolom) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                    <div>
                      <label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                        <School className="w-3.5 h-3.5 text-blue-600" />
                        <span>Nama Satuan Pendidikan</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="input-school-name"
                        type="text"
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        placeholder="Contoh: SD Negeri 01 Menteng"
                        required
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all bg-white shadow-2xs h-9.5 sm:h-10"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-blue-600" />
                        <span>Nama Lengkap Admin</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="input-admin-name"
                        type="text"
                        value={adminFullName}
                        onChange={(e) => handleAdminNameChange(e.target.value)}
                        placeholder="Contoh: Dra. Hj. Siti Aminah, M.Pd"
                        required
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all bg-white shadow-2xs h-9.5 sm:h-10"
                      />
                    </div>
                  </div>

                  {/* 3. USERNAME ADMIN & 4. EMAIL RESMI (Berdampingan 2 Kolom) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-blue-600" />
                          <span>Username Admin</span>
                          <span className="text-rose-500">*</span>
                        </label>
                        {usernameManuallyEdited ? (
                          <button
                            type="button"
                            onClick={handleResetAutoUsername}
                            className="text-[10px] text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
                          >
                            Reset
                          </button>
                        ) : (
                          <span className="text-[9px] bg-blue-50 text-blue-600 font-bold px-1.5 py-0.5 rounded-full border border-blue-200">
                            Otomatis
                          </span>
                        )}
                      </div>
                      <input
                        id="input-username"
                        type="text"
                        value={username}
                        onChange={(e) => handleUsernameChange(e.target.value)}
                        placeholder="admin.sekolah"
                        required
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all bg-white shadow-2xs h-9.5 sm:h-10"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-blue-600" />
                        <span>Email Resmi (Opsional)</span>
                      </label>
                      <input
                        id="input-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@sekolah.sch.id"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all bg-white shadow-2xs h-9.5 sm:h-10"
                      />
                    </div>
                  </div>

                  {/* 4. KATA SANDI & ULANGI SANDI (2 Kolom Seimbang) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                    <div>
                      <label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5 text-blue-600" />
                        <span>Kata Sandi</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          id="input-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Min 6 karakter"
                          required
                          minLength={6}
                          className="w-full px-3 py-2 pr-8 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all bg-white shadow-2xs h-9.5 sm:h-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5 text-blue-600" />
                        <span>Ulangi Sandi</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          id="input-confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Ketik ulang sandi"
                          required
                          minLength={6}
                          className={`w-full px-3 py-2 pr-8 rounded-xl border text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all bg-white shadow-2xs h-9.5 sm:h-10 ${
                            confirmPassword && password === confirmPassword
                              ? 'border-emerald-400 bg-emerald-50/20'
                              : confirmPassword && password !== confirmPassword
                              ? 'border-amber-400 bg-amber-50/20'
                              : 'border-slate-200'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                          tabIndex={-1}
                        >
                          {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 6. KHUSUS SUPERADMIN: NPSN & CATATAN INTERNAL */}
                  {isSuperadmin && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-slate-100">
                      <div>
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          <span>NPSN Sekolah (Opsional)</span>
                        </label>
                        <input
                          id="input-superadmin-npsn"
                          type="text"
                          value={npsn}
                          onChange={(e) => setNpsn(e.target.value)}
                          placeholder="Nomor Pokok Sekolah Nasional"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all bg-white shadow-2xs h-9.5 sm:h-10"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-blue-600" />
                          <span>Catatan Super Admin (Opsional)</span>
                        </label>
                        <input
                          id="input-superadmin-notes"
                          type="text"
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                          placeholder="Contoh: Sekolah binaan dinas, aktivasi mandiri"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all bg-white shadow-2xs h-9.5 sm:h-10"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* SUBMIT BUTTON & FOOTER NOTE matching screenshot */}
                <div className="pt-2 space-y-1.5">
                  <button
                    id="btn-submit-registration"
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full py-2.5 sm:py-3 px-5 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider text-white shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 min-h-[44px] active:scale-[0.99] ${
                      isSuperadmin
                        ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/25'
                        : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/25'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Mendaftarkan Sekolah...</span>
                      </>
                    ) : isSuperadmin ? (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>DAFTAR &amp; AKTIFKAN LANGSUNG (DIRECT SUBSCRIPTION)</span>
                      </>
                    ) : (
                      <>
                        <span>DAFTAR &amp; LANJUT BAYAR ({formatRupiah(activeAmount).toUpperCase()})</span>
                        <ArrowRight className="w-4 h-4 stroke-[3]" />
                      </>
                    )}
                  </button>

                  <div className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5 pt-0.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {isSuperadmin
                        ? 'Metode Direct Subscription • Terintegrasi otomatis ke database pusat & Panel Super Admin.'
                        : 'Pembayaran aman via Midtrans • Aktivasi otomatis ke database pusat.'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
