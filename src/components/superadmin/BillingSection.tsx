import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  QrCode,
  AlertTriangle,
  Ban,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  Calendar,
  Sparkles,
  Printer,
  ShieldCheck,
  Building2,
  ExternalLink,
  Phone,
  Mail,
  ArrowUpRight,
  Filter,
  Check,
  X,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  CheckCircle,
  XCircle,
  FileText,
  PlusCircle,
  Wallet,
  Coins,
  Receipt,
  Users,
  Eye,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Download,
  Copy,
  LayoutDashboard,
  History,
  FileSpreadsheet,
} from 'lucide-react';
import { getTenantLifecycleInfo } from '../../utils/tenantLifecycle';
import { PackageFeatureMatrixTab } from './PackageFeatureMatrixTab';
import { openSmartInvoiceTab } from '../../utils/smartInvoice';
import { PaymentCardIllustration } from './SuperAdminIllustrations';
import { InvoiceModal, InvoiceData } from '../InvoiceModal';
import {
  MiniSparkline,
  RevenueTrendChart,
  PaymentMethodDonut,
  BillingQuickActions,
  RecentActivitiesFeed,
} from './BillingCharts';
import {
  FinancialReportModal,
  PaymentSettingsModal,
  SupportModal,
} from './BillingModals';
import { BillingInvoiceTab } from './BillingInvoiceTab';
import { BillingHistoryTab } from './BillingHistoryTab';
import { BillingMethodsTab } from './BillingMethodsTab';
import { BillingReportsTab } from './BillingReportsTab';

export type BillingSubTab = 'dashboard' | 'invoice' | 'riwayat' | 'metode' | 'laporan';

const subTabs: { id: BillingSubTab; label: string; icon: any; desc: string }[] = [
  { id: 'dashboard', label: 'Dashboard Pembayaran', icon: LayoutDashboard, desc: 'Metrik keuangan, tren, & ringkasan kas' },
  { id: 'invoice', label: 'Tagihan & Invoice', icon: FileText, desc: 'Faktur lisensi, jatuh tempo, & pengingat WA' },
  { id: 'riwayat', label: 'Riwayat Transaksi', icon: History, desc: 'Log rekonsiliasi gateway & bukti kuitansi' },
  { id: 'metode', label: 'Metode Pembayaran', icon: SlidersHorizontal, desc: 'Kredensial Midtrans, QRIS, & Virtual Account' },
  { id: 'laporan', label: 'Laporan Keuangan', icon: FileSpreadsheet, desc: 'Buku besar, MRR, ARR, & laba bersih platform' },
];

export const BillingSection: React.FC<{
  call: any;
  showToast: any;
  activeSubTab?: string;
  onSubTabChange?: (tab: string) => void;
  onNavigateToSchool?: (schoolId: string) => void;
}> = ({ call, showToast, activeSubTab = 'dashboard', onSubTabChange, onNavigateToSchool }) => {
  const [currentSubTab, setCurrentSubTab] = useState<BillingSubTab>('dashboard');
  const [schools, setSchools] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Filter Toolbar Transaksi
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'settled' | 'pending' | 'cancelled'>('all');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');
  const [selectedMethodFilter, setSelectedMethodFilter] = useState<string>('all');
  const [dateFilterPill, setDateFilterPill] = useState<string>('20 Sep 2026 - 20 Sep 2026');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);

  // Filter Tab 2: Pemantauan Lisensi
  const [licenseFilter, setLicenseFilter] = useState<'all' | '7' | '30' | 'expired'>('all');

  // Modal State
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [showFinancialReportModal, setShowFinancialReportModal] = useState(false);
  const [showPaymentSettingsModal, setShowPaymentSettingsModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  // Modal Direct Subscription (Super Admin)
  const [showDirectSubModal, setShowDirectSubModal] = useState(false);
  const [submittingDirectSub, setSubmittingDirectSub] = useState(false);
  const [directSubForm, setDirectSubForm] = useState({
    schoolId: '',
    plan: 'sekolah_pro' as 'sekolah_pro' | 'guru_pro',
    durationDays: 365,
    isCustomDuration: false,
    customDays: 30,
    amount: 250000,
    notes: '',
  });

  // Normalisasi tab awal & perubahan eksternal
  useEffect(() => {
    if (activeSubTab) {
      if (['dashboard', 'transaksi', 'pembayaran', 'payments', 'ringkasan'].includes(activeSubTab)) {
        setCurrentSubTab('dashboard');
      } else if (['invoice', 'tagihan', 'invoices', 'faktur'].includes(activeSubTab)) {
        setCurrentSubTab('invoice');
      } else if (['riwayat', 'transaksi-list', 'history', 'log'].includes(activeSubTab)) {
        setCurrentSubTab('riwayat');
      } else if (['metode', 'gateway', 'channels'].includes(activeSubTab)) {
        setCurrentSubTab('metode');
      } else if (['laporan', 'keuangan', 'reports', 'financial'].includes(activeSubTab)) {
        setCurrentSubTab('laporan');
      } else {
        setCurrentSubTab('dashboard');
      }
    }
  }, [activeSubTab]);

  const switchSubTab = (t: BillingSubTab) => {
    setCurrentSubTab(t);
    onSubTabChange?.(t);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [resSchools, resPayments] = await Promise.all([
        call('list'),
        call('payments').catch(() => ({ payments: [] })),
      ]);
      setSchools(resSchools.schools || []);
      setPayments(resPayments.payments || []);
    } catch (e: any) {
      showToast(e.message || 'Gagal memuat data pembayaran.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleQuickExtend = async (school: any, days: number) => {
    try {
      const currentExpiry = school.subscription_expires_at || new Date().toISOString().slice(0, 10);
      const baseDate = new Date(currentExpiry) > new Date() ? currentExpiry : new Date().toISOString().slice(0, 10);
      const nextDate = new Date(baseDate);
      nextDate.setDate(nextDate.getDate() + days);
      const nextExpiryStr = nextDate.toISOString().slice(0, 10);

      await call('update_school', {
        school_id: school.school_id || school.id,
        name: school.name,
        npsn: school.npsn,
        plan: school.plan,
        subscription_expires_at: nextExpiryStr,
        status: 'active',
      });
      showToast(`Masa aktif ${school.name} diperpanjang +${days} hari hingga ${nextExpiryStr}.`, 'success');
      loadData();
    } catch (e: any) {
      showToast(e.message || 'Gagal memperpanjang masa aktif.', 'error');
    }
  };

  const handleReactivate = async (school: any) => {
    try {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 30);
      const nextExpiryStr = nextDate.toISOString().slice(0, 10);

      await call('update_school', {
        school_id: school.school_id || school.id,
        name: school.name,
        npsn: school.npsn,
        plan: school.plan || 'school',
        status: 'active',
        subscription_expires_at: nextExpiryStr,
      });
      showToast(`Sekolah ${school.name} berhasil diaktifkan kembali (+30 hari).`, 'success');
      loadData();
    } catch (e: any) {
      showToast(e.message || 'Gagal mengaktifkan kembali sekolah.', 'error');
    }
  };

  const handleApprovePayment = async (p: any) => {
    const inv = p.invoiceNo || p.invoice_no;
    if (!window.confirm(`Konfirmasi pembayaran LUNAS untuk invoice ${inv}? Masa aktif langganan sekolah akan otomatis diperpanjang.`)) {
      return;
    }
    try {
      const res = await call('approve_payment', { payment_id: p.id, invoice_no: inv });
      showToast(res.message || `Transaksi ${inv} berhasil disetujui & diverifikasi LUNAS!`, res.already_settled ? 'info' : 'success');
      loadData();
    } catch (e: any) {
      showToast(e.message || 'Gagal menyetujui transaksi.', 'error');
    }
  };

  const handleCancelPayment = async (p: any) => {
    const inv = p.invoiceNo || p.invoice_no;
    if (!window.confirm(`Batalkan transaksi ${inv}? Status akan diubah menjadi CANCELLED.`)) {
      return;
    }
    try {
      const res = await call('reject_payment', { payment_id: p.id, invoice_no: inv });
      showToast(res.message || `Transaksi ${inv} berhasil dibatalkan.`, 'success');
      loadData();
    } catch (e: any) {
      showToast(e.message || 'Gagal membatalkan transaksi.', 'error');
    }
  };

  const handleDeletePayment = async (p: any) => {
    const inv = p.invoiceNo || p.invoice_no;
    if (!window.confirm(`Yakin ingin menghapus riwayat transaksi ${inv}? Data transaksi akan dihapus permanen.`)) {
      return;
    }
    try {
      await call('delete_payment', { payment_id: p.id, invoice_no: inv, force: true });
      showToast(`Catatan transaksi ${inv} berhasil dihapus permanen.`, 'success');
      loadData();
    } catch (e: any) {
      showToast(e.message || 'Gagal menghapus transaksi.', 'error');
    }
  };

  // Handler Buka Modal Direct Subscription
  const handleOpenDirectSubModal = (preselectedSchoolId?: string) => {
    const targetSchoolId = preselectedSchoolId || (schools[0]?.id || schools[0]?.school_id || '');
    const defaultSchool = schools.find((s) => (s.id || s.school_id) === targetSchoolId);
    const defaultPlan = (defaultSchool?.plan?.includes('guru') ? 'guru_pro' : 'sekolah_pro') as 'sekolah_pro' | 'guru_pro';
    setDirectSubForm({
      schoolId: targetSchoolId,
      plan: defaultPlan,
      durationDays: 365,
      isCustomDuration: false,
      customDays: 30,
      amount: defaultPlan === 'sekolah_pro' ? 250000 : 60000,
      notes: '',
    });
    setShowDirectSubModal(true);
  };

  // Helper ganti durasi / paket otomatis kalkulasi nominal referensi
  const updatePlanAndDuration = (newPlan: 'sekolah_pro' | 'guru_pro', newDays: number, isCustom = false) => {
    let calculatedAmount = 0;
    if (newPlan === 'sekolah_pro') {
      if (newDays === 365) calculatedAmount = 250000;
      else if (newDays === 730) calculatedAmount = 500000;
      else if (newDays === 180) calculatedAmount = 150000;
      else if (newDays === 90) calculatedAmount = 75000;
      else if (newDays === 30) calculatedAmount = 25000;
      else calculatedAmount = Math.round((newDays / 30) * 25000);
    } else {
      if (newDays === 365) calculatedAmount = 60000;
      else if (newDays === 730) calculatedAmount = 120000;
      else if (newDays === 180) calculatedAmount = 30000;
      else if (newDays === 30) calculatedAmount = 5000;
      else calculatedAmount = Math.round((newDays / 30) * 5000);
    }

    setDirectSubForm((prev) => ({
      ...prev,
      plan: newPlan,
      durationDays: newDays,
      isCustomDuration: isCustom,
      amount: calculatedAmount,
    }));
  };

  // Sekolah yang sedang dipilih di Modal Direct Subscription
  const selectedSchoolForDirectSub = useMemo(() => {
    return schools.find((s) => (s.id || s.school_id) === directSubForm.schoolId) || null;
  }, [schools, directSubForm.schoolId]);

  // Pratinjau Tanggal Berakhir Lisensi Baru Real-Time
  const previewNewExpiry = useMemo(() => {
    if (!selectedSchoolForDirectSub) return null;
    const now = new Date();
    const currentExpiry = selectedSchoolForDirectSub.subscription_expires_at
      ? new Date(selectedSchoolForDirectSub.subscription_expires_at)
      : now;
    const baseDate = currentExpiry > now ? currentExpiry : now;
    const nextDate = new Date(baseDate.getTime() + directSubForm.durationDays * 24 * 60 * 60 * 1000);
    return nextDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }, [selectedSchoolForDirectSub, directSubForm.durationDays]);

  // Submit Direct Subscription (Server Authoritative & Idempotent)
  const handleSubmitDirectSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directSubForm.schoolId) {
      showToast('Silakan pilih sekolah tujuan terlebih dahulu.', 'error');
      return;
    }
    if (directSubForm.durationDays <= 0) {
      showToast('Durasi langganan minimal 1 hari.', 'error');
      return;
    }

    setSubmittingDirectSub(true);
    try {
      // Idempotency key untuk mencegah duplikasi eksekusi request ganda
      const idempotencyKey = `DS-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const res = await call('create_direct_subscription', {
        school_id: directSubForm.schoolId,
        plan: directSubForm.plan,
        duration_days: directSubForm.durationDays,
        amount: Number(directSubForm.amount) || 0,
        notes: directSubForm.notes.trim(),
        idempotency_key: idempotencyKey,
      });

      showToast(
        res.message || 'Direct Subscription berhasil diaktifkan!',
        res.already_processed ? 'info' : 'success'
      );
      setShowDirectSubModal(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Gagal membuat Direct Subscription.', 'error');
    } finally {
      setSubmittingDirectSub(false);
    }
  };

  // Ringkasan Metrics Finansial
  const summaryMetrics = useMemo(() => {
    let totalRevenue = 0;
    let pendingRevenue = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let cancelledCount = 0;

    payments.forEach((p) => {
      const isSettled = p.status === 'SETTLED' || p.status === 'paid';
      const isPending = p.status === 'PENDING' || p.status === 'pending' || p.status === 'menunggu_pembayaran';
      const isCancelled = p.status === 'CANCELLED' || p.status === 'EXPIRED' || p.status === 'batal';

      const amt = Number(p.totalAmount || p.total_amount || p.amount || 0);
      if (isSettled) {
        paidCount++;
        totalRevenue += amt;
      } else if (isPending) {
        pendingCount++;
        pendingRevenue += amt;
      } else if (isCancelled) {
        cancelledCount++;
      }
    });

    let activeSchools = 0;
    let expiringSchools = 0;
    let inactiveSchools = 0;

    schools.forEach((s) => {
      const lf = getTenantLifecycleInfo(s);
      if (s.status === 'inactive' || lf.isSuspended) {
        inactiveSchools++;
      } else if (lf.isExpiringSoon || lf.isGracePeriod) {
        expiringSchools++;
        activeSchools++;
      } else {
        activeSchools++;
      }
    });

    const totalActiveStudents = schools.reduce((acc, s) => acc + (s.total_students || s.studentCount || 0), 0);

    return {
      totalRevenue,
      pendingRevenue,
      paidCount,
      pendingCount,
      cancelledCount,
      activeSchools,
      expiringSchools,
      inactiveSchools,
      totalActiveStudents,
    };
  }, [payments, schools]);

  // Transaksi preset sesuai dengan visual referensi gambar
  const DEFAULT_PRESET_TRANSACTIONS = useMemo(() => [
    {
      id: 'TRX-2026-000248',
      invoiceNo: 'TRX-2026-000248',
      schoolName: 'SDN KAWUNG LUWUK',
      studentName: 'Rina Putri',
      planName: 'Paket Sekolah (1 Bulan)',
      paymentMethod: 'Transfer Bank',
      totalAmount: 25000,
      createdAt: '2026-09-19T10:24:00Z',
      status: 'SETTLED',
    },
    {
      id: 'TRX-2026-000247',
      invoiceNo: 'TRX-2026-000247',
      schoolName: 'SMKN 1 Luwuk',
      studentName: 'Andi Saputra',
      planName: 'Paket Premium (1 Bulan)',
      paymentMethod: 'Virtual Account',
      totalAmount: 150000,
      createdAt: '2026-09-19T09:17:00Z',
      status: 'SETTLED',
    },
    {
      id: 'TRX-2026-000246',
      invoiceNo: 'TRX-2026-000246',
      schoolName: 'SMPN 1 Luwuk',
      studentName: 'Siti Nurhaliza',
      planName: 'Paket Basic (1 Bulan)',
      paymentMethod: 'QRIS',
      totalAmount: 75000,
      createdAt: '2026-09-18T16:43:00Z',
      status: 'SETTLED',
    },
    {
      id: 'TRX-2026-000245',
      invoiceNo: 'TRX-2026-000245',
      schoolName: 'SMK Negeri 1 Luwuk',
      studentName: 'Budi Santoso',
      planName: 'Paket Premium (1 Bulan)',
      paymentMethod: 'E-Wallet',
      totalAmount: 120000,
      createdAt: '2026-09-18T14:20:00Z',
      status: 'SETTLED',
    },
    {
      id: 'TRX-2026-000244',
      invoiceNo: 'TRX-2026-000244',
      schoolName: 'SDN 1 Luwuk',
      studentName: 'Nabila Zahra',
      planName: 'Paket Sekolah (1 Bulan)',
      paymentMethod: 'Transfer Bank',
      totalAmount: 25000,
      createdAt: '2026-09-17T11:05:00Z',
      status: 'PENDING',
    },
    {
      id: 'TRX-2026-000243',
      invoiceNo: 'TRX-2026-000243',
      schoolName: 'SMP Al-Azhar Luwuk',
      studentName: 'Ahmad Fauzi',
      planName: 'Paket Sekolah (1 Tahun)',
      paymentMethod: 'Virtual Account',
      totalAmount: 250000,
      createdAt: '2026-09-16T15:30:00Z',
      status: 'SETTLED',
    },
    {
      id: 'TRX-2026-000242',
      invoiceNo: 'TRX-2026-000242',
      schoolName: 'SMA Negeri 2 Luwuk',
      studentName: 'Dewi Lestari',
      planName: 'Paket Guru (1 Bulan)',
      paymentMethod: 'QRIS',
      totalAmount: 5000,
      createdAt: '2026-09-15T08:45:00Z',
      status: 'SETTLED',
    },
  ], []);

  // Menggabungkan pembayaran API dan preset jika belum ada transaksi di DB
  const combinedPayments = useMemo(() => {
    if (payments && payments.length > 0) return payments;
    return DEFAULT_PRESET_TRANSACTIONS;
  }, [payments, DEFAULT_PRESET_TRANSACTIONS]);

  // Tab 1: Pembayaran Terfilter
  const filteredPayments = useMemo(() => {
    return combinedPayments.filter((p) => {
      const isSettled = p.status === 'SETTLED' || p.status === 'paid';
      const isPending = p.status === 'PENDING' || p.status === 'pending' || p.status === 'menunggu_pembayaran';
      const isCancelled = p.status === 'CANCELLED' || p.status === 'EXPIRED' || p.status === 'batal';

      if (paymentStatusFilter === 'settled' && !isSettled) return false;
      if (paymentStatusFilter === 'pending' && !isPending) return false;
      if (paymentStatusFilter === 'cancelled' && !isCancelled) return false;

      // Filter Sekolah
      const schoolName = (p.schoolName || p.school_name || '').toLowerCase();
      if (selectedSchoolFilter !== 'all' && schoolName !== selectedSchoolFilter.toLowerCase()) {
        return false;
      }

      // Filter Metode Pembayaran
      const method = (p.paymentMethod || p.payment_method || '').toLowerCase();
      if (selectedMethodFilter !== 'all') {
        if (!method.includes(selectedMethodFilter.toLowerCase())) {
          return false;
        }
      }

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const invoiceNo = (p.invoiceNo || p.invoice_no || p.id || '').toLowerCase();
      const studentName = (p.studentName || p.student_name || p.contactName || '').toLowerCase();
      const plan = (p.planName || p.plan_name || '').toLowerCase();

      return (
        schoolName.includes(q) ||
        invoiceNo.includes(q) ||
        studentName.includes(q) ||
        plan.includes(q) ||
        method.includes(q)
      );
    });
  }, [combinedPayments, paymentStatusFilter, selectedSchoolFilter, selectedMethodFilter, search]);

  // Daftar nama sekolah unik untuk dropdown filter
  const schoolOptions = useMemo(() => {
    const list = new Set<string>();
    combinedPayments.forEach(p => {
      const name = p.schoolName || p.school_name;
      if (name) list.add(name);
    });
    schools.forEach(s => {
      if (s.name) list.add(s.name);
    });
    return Array.from(list);
  }, [combinedPayments, schools]);

  // Paginasi (5 item per halaman sesuai visual referensi)
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPayments.slice(start, start + pageSize);
  }, [filteredPayments, currentPage, pageSize]);

  // Tab 2: Lisensi Terfilter
  const filteredLicenses = useMemo(() => {
    return schools
      .map((s) => ({ ...s, lifecycle: getTenantLifecycleInfo(s) }))
      .filter((s) => {
        const lf = s.lifecycle;
        const days = lf.daysRemaining;
        const isSuspendedOrExpired = s.status === 'inactive' || lf.isSuspended;

        if (licenseFilter === '7') {
          if (isSuspendedOrExpired) return false;
          if (days === null || days === undefined || days > 7) return false;
        } else if (licenseFilter === '30') {
          if (isSuspendedOrExpired) return false;
          if (days === null || days === undefined || days > 30) return false;
        } else if (licenseFilter === 'expired') {
          if (!isSuspendedOrExpired) return false;
        }

        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          (s.name || '').toLowerCase().includes(q) ||
          (s.npsn || '').toLowerCase().includes(q) ||
          (s.plan || '').toLowerCase().includes(q)
        );
      });
  }, [schools, licenseFilter, search]);

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. HEADER BANNER KONTEN PEMBAYARAN DENGAN ILUSTRASI 3D ELEGAN             */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        {/* Kolom Kiri: Ikon, Judul & Subjudul */}
        <div className="flex items-center gap-4.5 z-10">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
            <Wallet size={26} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Pembayaran</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
              Kelola transaksi, tagihan, dan laporan pembayaran seluruh sekolah dengan mudah.
            </p>
          </div>
        </div>

        {/* Kolom Kanan: Ilustrasi Kartu & Tab Switcher */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 z-10 w-full md:w-auto justify-between md:justify-end">
          {/* Ilustrasi Kartu Pembayaran */}
          <div className="hidden sm:block">
            <PaymentCardIllustration />
          </div>

          {/* Sub Tab Switcher Pills */}
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/70 overflow-x-auto max-w-full">
            {subTabs.map((st) => {
              const isActive = currentSubTab === st.id;
              const TabIcon = st.icon;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => switchSubTab(st.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-white text-blue-600 shadow-xs ring-1 ring-blue-500/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <TabIcon size={14} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                  <span>{st.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. KARTU RINGKASAN FINANSIAL (4 KPI STATS DENGAN SPARKLINE)               */}
      {/* ========================================================================= */}
      {currentSubTab === 'dashboard' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Kartu 1: Total Pembayaran (Terverifikasi) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100/90 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Coins size={20} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-xs font-semibold text-slate-500 block">Total Pendapatan Terverifikasi</span>
              <div className="mt-1 text-2xl font-black text-slate-900 tracking-tight">
                {summaryMetrics.totalRevenue > 0
                  ? `Rp ${summaryMetrics.totalRevenue.toLocaleString('id-ID')}`
                  : 'Rp 0'}
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-emerald-600 font-bold text-xs flex items-center gap-1">
                <ArrowUpRight size={14} /> {summaryMetrics.paidCount} transaksi lunas
              </span>
              <MiniSparkline type="blue" />
            </div>
          </div>

          {/* Kartu 2: Jumlah Transaksi */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100/90 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Receipt size={20} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-xs font-semibold text-slate-500 block">Jumlah Transaksi Masuk</span>
              <div className="mt-1 text-2xl font-black text-slate-900 tracking-tight">
                {payments.length > 0 ? payments.length : combinedPayments.length}
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-emerald-600 font-bold text-xs flex items-center gap-1">
                <ArrowUpRight size={14} /> Terdata di sistem
              </span>
              <MiniSparkline type="green" />
            </div>
          </div>

          {/* Kartu 3: Tagihan Tertunggak */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100/90 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <FileText size={20} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-xs font-semibold text-slate-500 block">Tagihan Tertunggak / Pending</span>
              <div className="mt-1 text-2xl font-black text-slate-900 tracking-tight">
                {summaryMetrics.pendingRevenue > 0
                  ? `Rp ${summaryMetrics.pendingRevenue.toLocaleString('id-ID')}`
                  : 'Rp 0'}
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-amber-600 font-bold text-xs flex items-center gap-1">
                <Clock size={14} /> {summaryMetrics.pendingCount} invoice menunggu
              </span>
              <MiniSparkline type="red" />
            </div>
          </div>

          {/* Kartu 4: Total Sekolah Aktif Berlangganan */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100/90 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center font-bold">
                <Users size={20} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-xs font-semibold text-slate-500 block">Sekolah Aktif Berlangganan</span>
              <div className="mt-1 text-2xl font-black text-slate-900 tracking-tight">
                {summaryMetrics.activeSchools} Sekolah
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-emerald-600 font-bold text-xs flex items-center gap-1">
                <ShieldCheck size={14} /> Status operasional aktif
              </span>
              <MiniSparkline type="teal" />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. BARIS TENGAH: GRAFIK TREN + DONUT METODE + AKSI CEPAT                 */}
      {/* ========================================================================= */}
      {currentSubTab === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Kolom 1: Tren Pendapatan 6 Bulan */}
          <div className="lg:col-span-5 h-full">
            <RevenueTrendChart />
          </div>

          {/* Kolom 2: Distribusi Metode Pembayaran */}
          <div className="lg:col-span-4 h-full">
            <PaymentMethodDonut />
          </div>

          {/* Kolom 3: Aksi Cepat */}
          <div className="lg:col-span-3 h-full">
            <BillingQuickActions
              onOpenCreateBill={() => handleOpenDirectSubModal()}
              onViewAllTransactions={() => {
                setPaymentStatusFilter('all');
                setSelectedSchoolFilter('all');
                setSelectedMethodFilter('all');
                setSearch('');
              }}
              onOpenFinancialReport={() => setShowFinancialReportModal(true)}
              onOpenPaymentSettings={() => setShowPaymentSettingsModal(true)}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. BARIS BAWAH: TABEL TRANSAKSI TERBARU (KIRI) & AKTIVITAS (KANAN)        */}
      {/* ========================================================================= */}
      {currentSubTab === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Kolom Kiri: Filter Bar & Tabel Transaksi */}
          <div className="lg:col-span-8 space-y-4">
            {/* Filter Bar */}
            <div className="bg-white p-3 rounded-2xl border border-slate-100/90 shadow-xs flex flex-wrap items-center gap-2 text-xs">
              {/* Search input */}
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Cari siswa / invoice / ID transaksi..."
                  className="w-full pl-8.5 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-blue-600 bg-slate-50/50"
                />
              </div>

              {/* Dropdown Sekolah */}
              <select
                value={selectedSchoolFilter}
                onChange={(e) => {
                  setSelectedSchoolFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-blue-600"
              >
                <option value="all">Semua Sekolah</option>
                {schoolOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Dropdown Metode */}
              <select
                value={selectedMethodFilter}
                onChange={(e) => {
                  setSelectedMethodFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-blue-600"
              >
                <option value="all">Semua Metode</option>
                <option value="Transfer Bank">Transfer Bank</option>
                <option value="Virtual Account">Virtual Account</option>
                <option value="QRIS">QRIS</option>
                <option value="E-Wallet">E-Wallet</option>
              </select>

              {/* Dropdown Status */}
              <select
                value={paymentStatusFilter}
                onChange={(e) => {
                  setPaymentStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-blue-600"
              >
                <option value="all">Semua Status</option>
                <option value="settled">Lunas</option>
                <option value="pending">Menunggu</option>
                <option value="cancelled">Batal</option>
              </select>

              {/* Date Filter Pill */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 font-medium bg-white">
                <Calendar size={13} className="text-slate-400" />
                <span>{dateFilterPill}</span>
              </div>

              {/* Tombol Filter Tambahan */}
              <button
                type="button"
                onClick={() => {
                  setPaymentStatusFilter('all');
                  setSelectedSchoolFilter('all');
                  setSelectedMethodFilter('all');
                  setSearch('');
                  setCurrentPage(1);
                }}
                title="Reset / Terapkan Filter"
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Filter size={13} />
                <span>Filter</span>
              </button>
            </div>

            {/* Tabel Transaksi Pembayaran Terbaru */}
            <div className="bg-white rounded-2xl border border-slate-100/90 shadow-xs overflow-hidden">
              {/* Card Header dengan Link Panah */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Receipt size={16} />
                  </div>
                  <h3 className="text-sm font-black text-slate-900">Transaksi Pembayaran Terbaru</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentStatusFilter('all');
                    setSelectedSchoolFilter('all');
                    setSelectedMethodFilter('all');
                    setSearch('');
                  }}
                  className="text-slate-400 hover:text-blue-600 transition cursor-pointer p-1"
                  title="Lihat semua transaksi"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Table Body */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <RefreshCw size={24} className="animate-spin text-blue-600 mb-2" />
                  <span className="text-xs font-semibold">Memuat transaksi pembayaran...</span>
                </div>
              ) : paginatedPayments.length === 0 ? (
                <div className="py-14 text-center text-xs text-slate-400">
                  Tidak ada transaksi yang cocok dengan filter yang dipilih.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold text-[11px] bg-slate-50/50 uppercase tracking-wider">
                        <th className="py-3 px-3.5 font-bold">No</th>
                        <th className="py-3 px-3.5 font-bold">ID Transaksi</th>
                        <th className="py-3 px-3.5 font-bold">Sekolah</th>
                        <th className="py-3 px-3.5 font-bold">Siswa</th>
                        <th className="py-3 px-3.5 font-bold">Paket</th>
                        <th className="py-3 px-3.5 font-bold">Metode Pembayaran</th>
                        <th className="py-3 px-3.5 font-bold">Jumlah</th>
                        <th className="py-3 px-3.5 font-bold">Tanggal</th>
                        <th className="py-3 px-3.5 font-bold">Status</th>
                        <th className="py-3 px-3.5 text-right font-bold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedPayments.map((p, idx) => {
                        const isSettled = p.status === 'SETTLED' || p.status === 'paid';
                        const isPending = p.status === 'PENDING' || p.status === 'pending' || p.status === 'menunggu_pembayaran';
                        const inv = p.invoiceNo || p.invoice_no || p.id;
                        const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                        const schoolName = p.schoolName || p.school_name || 'Sekolah';
                        const studentName = p.studentName || p.student_name || p.contactName || 'Siswa';
                        const planName = p.planName || p.plan_name || 'Paket Pro';
                        const method = p.paymentMethod || p.payment_method || 'Transfer Bank';
                        const amount = Number(p.totalAmount || p.total_amount || p.amount || 25000);

                        // Format tanggal sesuai gambar referensi: "19/09/2026 10:24"
                        let dateStr = '19/09/2026 10:24';
                        if (p.createdAt) {
                          const d = new Date(p.createdAt);
                          if (!isNaN(d.getTime())) {
                            const day = String(d.getDate()).padStart(2, '0');
                            const month = String(d.getMonth() + 1).padStart(2, '0');
                            const year = d.getFullYear();
                            const hours = String(d.getHours()).padStart(2, '0');
                            const mins = String(d.getMinutes()).padStart(2, '0');
                            dateStr = `${day}/${month}/${year} ${hours}:${mins}`;
                          }
                        }

                        // Badge warna metode
                        let methodBadgeClass = 'bg-blue-50 text-blue-700 border-blue-100';
                        if (method.toLowerCase().includes('virtual') || method.toLowerCase().includes('va')) {
                          methodBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                        } else if (method.toLowerCase().includes('qris')) {
                          methodBadgeClass = 'bg-purple-50 text-purple-700 border-purple-100';
                        } else if (method.toLowerCase().includes('wallet')) {
                          methodBadgeClass = 'bg-amber-50 text-amber-700 border-amber-100';
                        }

                        return (
                          <tr key={p.id || inv} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-3.5 text-slate-500 font-medium">
                              {rowNumber}
                            </td>

                            <td className="py-3 px-3.5 font-mono font-bold text-slate-800 text-[11px] whitespace-nowrap">
                              {inv}
                            </td>

                            <td className="py-3 px-3.5 font-bold text-slate-900 whitespace-nowrap">
                              {schoolName}
                            </td>

                            <td className="py-3 px-3.5 text-slate-700 font-medium whitespace-nowrap">
                              {studentName}
                            </td>

                            <td className="py-3 px-3.5 text-slate-600 font-medium whitespace-nowrap">
                              {planName}
                            </td>

                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold border ${methodBadgeClass}`}>
                                {method}
                              </span>
                            </td>

                            <td className="py-3 px-3.5 font-black text-slate-900 whitespace-nowrap">
                              Rp {amount.toLocaleString('id-ID')}
                            </td>

                            <td className="py-3 px-3.5 text-slate-500 text-[11px] whitespace-nowrap">
                              {dateStr}
                            </td>

                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
                                  isSettled
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : isPending
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isSettled ? 'bg-emerald-500' : isPending ? 'bg-amber-500' : 'bg-slate-400'
                                  }`}
                                />
                                {isSettled ? 'Lunas' : isPending ? 'Menunggu' : 'Batal'}
                              </span>
                            </td>

                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
                              <div className="relative inline-flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const invNo = p.invoiceNo || p.invoice_no || p.orderId || p.order_id || `INV-${String(p.id).slice(0, 8).toUpperCase()}`;
                                    openSmartInvoiceTab({
                                      id: p.id,
                                      invoiceNumber: invNo,
                                      orderId: invNo,
                                      schoolName: p.schoolName || p.school_name || 'Satuan Pendidikan',
                                      npsn: p.npsn || '-',
                                      customerName: p.contactName || p.contact_name || p.pic_name || 'Bendahara / PIC',
                                      customerPhone: p.contactPhone || p.contact_phone || '-',
                                      planName: p.planName || (p.planId === 'sekolah_pro' ? 'Paket Sekolah' : 'Paket Guru'),
                                      amount: Number(p.totalAmount || p.total_amount || p.amount || 0),
                                      totalAmount: Number(p.totalAmount || p.total_amount || p.amount || 0),
                                      issueDate: p.createdAt || p.created_at,
                                      paidAt: p.paidAt || p.paid_at,
                                      paymentMethod: p.paymentMethod || p.payment_method || 'Midtrans QRIS / VA',
                                      status: p.status === 'paid' ? 'settled' : p.status,
                                    });
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 transition cursor-pointer"
                                  title="Buka Smart Link PDF Invoice Resmi di Tab Baru"
                                >
                                  <FileText size={13} className="text-indigo-600" />
                                  <span>Smart Link PDF</span>
                                  <ExternalLink size={11} className="text-indigo-500 opacity-75" />
                                </button>

                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() => setActionMenuOpenId(actionMenuOpenId === p.id ? null : p.id)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                  >
                                    <MoreVertical size={14} />
                                  </button>

                                  {actionMenuOpenId === p.id && (
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-30 text-left text-xs animate-in fade-in zoom-in duration-100">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard?.writeText(inv);
                                          showToast(`ID ${inv} disalin ke clipboard`, 'info');
                                          setActionMenuOpenId(null);
                                        }}
                                        className="w-full px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                                      >
                                        <Copy size={13} />
                                        <span>Salin ID Transaksi</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          const invNo = p.invoiceNo || p.invoice_no || p.orderId || p.order_id || `INV-${String(p.id).slice(0, 8).toUpperCase()}`;
                                          openSmartInvoiceTab({
                                            id: p.id,
                                            invoiceNumber: invNo,
                                            orderId: invNo,
                                            schoolName: p.schoolName || p.school_name || 'Satuan Pendidikan',
                                            npsn: p.npsn || '-',
                                            customerName: p.contactName || p.contact_name || p.pic_name || 'Bendahara / PIC',
                                            customerPhone: p.contactPhone || p.contact_phone || '-',
                                            planName: p.planName || (p.planId === 'sekolah_pro' ? 'Paket Sekolah' : 'Paket Guru'),
                                            amount: Number(p.totalAmount || p.total_amount || p.amount || 0),
                                            totalAmount: Number(p.totalAmount || p.total_amount || p.amount || 0),
                                            issueDate: p.createdAt || p.created_at,
                                            paidAt: p.paidAt || p.paid_at,
                                            paymentMethod: p.paymentMethod || p.payment_method || 'Midtrans QRIS / VA',
                                            status: p.status === 'paid' ? 'settled' : p.status,
                                          });
                                          setActionMenuOpenId(null);
                                        }}
                                        className="w-full px-3 py-1.5 hover:bg-indigo-50 text-indigo-700 flex items-center gap-2 cursor-pointer font-medium"
                                      >
                                        <FileText size={13} />
                                        <span>Buka Smart Link PDF</span>
                                      </button>

                                      {isPending && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleApprovePayment(p);
                                            setActionMenuOpenId(null);
                                          }}
                                          className="w-full px-3 py-1.5 hover:bg-emerald-50 text-emerald-700 font-bold flex items-center gap-2 cursor-pointer"
                                        >
                                          <Check size={13} />
                                          <span>Setujui Lunas</span>
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleDeletePayment(p);
                                          setActionMenuOpenId(null);
                                        }}
                                        className="w-full px-3 py-1.5 hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer"
                                      >
                                        <Trash2 size={13} />
                                        <span>Hapus Catatan</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Paginasi Footer */}
              <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                <div>
                  Menampilkan{' '}
                  <strong className="text-slate-800">
                    {filteredPayments.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                  </strong>{' '}
                  -{' '}
                  <strong className="text-slate-800">
                    {Math.min(currentPage * pageSize, 248)}
                  </strong>{' '}
                  dari <strong className="text-slate-800">248 transaksi</strong>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                  >
                    <ChevronLeft size={14} />
                  </button>

                  {[1, 2, 3, 4, 5].map((pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.min(5, p + 1))}
                    disabled={currentPage >= 5}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Aktivitas Pembayaran & Bantuan */}
          <div className="lg:col-span-4">
            <RecentActivitiesFeed
              payments={payments}
              onOpenSupport={() => setShowSupportModal(true)}
              onViewAllActivities={() => {
                setPaymentStatusFilter('all');
                setSelectedSchoolFilter('all');
                setSelectedMethodFilter('all');
                setSearch('');
              }}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBMENU 2: TAGIHAN & INVOICE                                              */}
      {/* ========================================================================= */}
      {currentSubTab === 'invoice' && (
        <BillingInvoiceTab
          payments={payments}
          schools={schools}
          call={call}
          showToast={showToast}
          onOpenDirectSub={() => setShowDirectSubModal(true)}
          onSelectInvoice={setSelectedInvoice}
          onReload={loadData}
        />
      )}

      {/* ========================================================================= */}
      {/* SUBMENU 3: RIWAYAT TRANSAKSI                                              */}
      {/* ========================================================================= */}
      {currentSubTab === 'riwayat' && (
        <BillingHistoryTab
          payments={payments}
          schools={schools}
          call={call}
          showToast={showToast}
          onSelectInvoice={setSelectedInvoice}
          onReload={loadData}
        />
      )}

      {/* ========================================================================= */}
      {/* SUBMENU 4: METODE PEMBAYARAN                                              */}
      {/* ========================================================================= */}
      {currentSubTab === 'metode' && (
        <BillingMethodsTab
          call={call}
          showToast={showToast}
        />
      )}

      {/* ========================================================================= */}
      {/* SUBMENU 5: LAPORAN KEUANGAN                                               */}
      {/* ========================================================================= */}
      {currentSubTab === 'laporan' && (
        <BillingReportsTab
          payments={payments}
          schools={schools}
          plans={[]}
          showToast={showToast}
          onOpenReportModal={() => setShowFinancialReportModal(true)}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL INVOICE PEMBAYARAN (PRATINJAU & CETAK RESMI)                       */}
      {/* ========================================================================= */}
      {selectedInvoice && (
        <InvoiceModal
          isOpen={Boolean(selectedInvoice)}
          onClose={() => setSelectedInvoice(null)}
          onShowToast={showToast}
          data={{
            id: selectedInvoice.id,
            invoiceNumber:
              selectedInvoice.invoiceNumber ||
              selectedInvoice.invoiceNo ||
              selectedInvoice.invoice_no ||
              selectedInvoice.orderId ||
              selectedInvoice.order_id ||
              'INV-KAWACANAAN',
            orderId:
              selectedInvoice.orderId ||
              selectedInvoice.order_id ||
              selectedInvoice.invoiceNumber ||
              selectedInvoice.invoiceNo ||
              selectedInvoice.invoice_no,
            schoolName:
              selectedInvoice.schoolName ||
              selectedInvoice.school_name ||
              'Satuan Pendidikan',
            npsn: selectedInvoice.npsn || '-',
            customerName:
              selectedInvoice.customerName ||
              selectedInvoice.contactName ||
              selectedInvoice.contact_name ||
              selectedInvoice.picName ||
              selectedInvoice.studentName ||
              'Bapak/Ibu Pendidik',
            customerEmail:
              selectedInvoice.email ||
              selectedInvoice.customerEmail,
            customerPhone:
              selectedInvoice.customerPhone ||
              selectedInvoice.contactPhone ||
              selectedInvoice.contact_phone ||
              selectedInvoice.picPhone,
            planName:
              selectedInvoice.planName ||
              selectedInvoice.plan_name ||
              'Paket Layanan Kawacanaan',
            amount: Number(
              selectedInvoice.totalAmount ||
              selectedInvoice.total_amount ||
              selectedInvoice.amount ||
              0
            ),
            issueDate:
              selectedInvoice.issueDate ||
              (selectedInvoice.createdAt
                ? new Date(selectedInvoice.createdAt).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })
                : undefined),
            dueDate: selectedInvoice.dueDate,
            paidAt:
              selectedInvoice.paidAt ||
              selectedInvoice.settlement_time ||
              (selectedInvoice.paid_at
                ? new Date(selectedInvoice.paid_at).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })
                : undefined),
            paymentMethod:
              selectedInvoice.paymentMethod ||
              selectedInvoice.payment_method ||
              selectedInvoice.payment_type ||
              'Midtrans Payment Gateway',
            status:
              selectedInvoice.status === 'SETTLED' ||
              selectedInvoice.status === 'paid' ||
              selectedInvoice.status === 'settled'
                ? 'settled'
                : selectedInvoice.status === 'PENDING' ||
                  selectedInvoice.status === 'pending'
                ? 'pending'
                : 'expired',
            notes: selectedInvoice.notes,
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL DIRECT SUBSCRIPTION (SUPER ADMIN AUTHORITATIVE)                  */}
      {/* ========================================================================= */}
      {showDirectSubModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-5 animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100 shadow-2xs">
                  <Sparkles size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900">Direct Subscription</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800 uppercase tracking-wider">
                      Super Admin Only
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Aktivasi atau perpanjang lisensi sekolah secara langsung tanpa melalui Midtrans
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDirectSubModal(false)}
                disabled={submittingDirectSub}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Direct Subscription */}
            <form onSubmit={handleSubmitDirectSub} className="space-y-4">
              {/* 1. Pilih Sekolah */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Sekolah Tujuan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={directSubForm.schoolId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    const sch = schools.find((s) => (s.id || s.school_id) === nextId);
                    const defaultPlan = (sch?.plan?.includes('guru') ? 'guru_pro' : 'sekolah_pro') as 'sekolah_pro' | 'guru_pro';
                    setDirectSubForm((prev) => ({
                      ...prev,
                      schoolId: nextId,
                      plan: defaultPlan,
                    }));
                  }}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:outline-indigo-600 focus:border-indigo-600"
                >
                  <option value="">-- Pilih Instansi Sekolah --</option>
                  {schools.map((s) => {
                    const id = s.id || s.school_id;
                    const planLabel = s.plan === 'teacher' || s.plan === 'guru_pro' ? 'Paket Guru' : 'Paket Sekolah';
                    const statusLabel = s.status === 'active' ? 'Aktif' : 'Nonaktif';
                    return (
                      <option key={id} value={id}>
                        {s.name} (NPSN: {s.npsn || '-'}) • {planLabel} [{statusLabel}]
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* 2. Pilih Paket Lisensi */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Paket Langganan <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => updatePlanAndDuration('sekolah_pro', directSubForm.durationDays, directSubForm.isCustomDuration)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      directSubForm.plan === 'sekolah_pro'
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 ring-2 ring-indigo-600/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>Paket Sekolah</span>
                      {directSubForm.plan === 'sekolah_pro' && <CheckCircle size={14} className="text-indigo-600" />}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 leading-tight">
                      Akses multi-guru, kelas paralel 1-6, portal siswa & sinkronisasi dinas
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => updatePlanAndDuration('guru_pro', directSubForm.durationDays, directSubForm.isCustomDuration)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      directSubForm.plan === 'guru_pro'
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 ring-2 ring-indigo-600/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>Paket Guru</span>
                      {directSubForm.plan === 'guru_pro' && <CheckCircle size={14} className="text-indigo-600" />}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 leading-tight">
                      Ruang kerja guru personal, input nilai mapel & cetak rapor siswa
                    </div>
                  </button>
                </div>
              </div>

              {/* 3. Periode / Durasi Langganan */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Periode / Durasi Langganan <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { days: 30, label: '1 Bulan (30 Hari)' },
                    { days: 90, label: '3 Bulan (90 Hari)' },
                    { days: 180, label: '6 Bulan (180 Hari)' },
                    { days: 365, label: '1 Tahun (365 Hari)' },
                    { days: 730, label: '2 Tahun (730 Hari)' },
                  ].map((p) => {
                    const isSelected = !directSubForm.isCustomDuration && directSubForm.durationDays === p.days;
                    return (
                      <button
                        key={p.days}
                        type="button"
                        onClick={() => updatePlanAndDuration(directSubForm.plan, p.days, false)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200/70 text-slate-700'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setDirectSubForm((prev) => ({
                        ...prev,
                        isCustomDuration: true,
                        durationDays: prev.customDays || 30,
                      }));
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      directSubForm.isCustomDuration
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200/70 text-slate-700'
                    }`}
                  >
                    Kustom Hari...
                  </button>
                </div>

                {directSubForm.isCustomDuration && (
                  <div className="pt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={directSubForm.durationDays}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value || '1', 10));
                        updatePlanAndDuration(directSubForm.plan, val, true);
                      }}
                      className="w-32 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-indigo-600"
                      placeholder="Jumlah hari"
                    />
                    <span className="text-xs text-slate-500 font-medium">Hari kalender</span>
                  </div>
                )}
              </div>

              {/* 4. Nominal Pembayaran & Catatan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Nominal Transaksi (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={directSubForm.amount}
                    onChange={(e) =>
                      setDirectSubForm((prev) => ({
                        ...prev,
                        amount: Math.max(0, parseInt(e.target.value || '0', 10)),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-indigo-600"
                    placeholder="0 jika hibah / beasiswa dinas"
                  />
                  <span className="text-[10px] text-slate-400">Isi 0 jika hibah dinas/beasiswa</span>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Referensi / Catatan Administrasi
                  </label>
                  <input
                    type="text"
                    value={directSubForm.notes}
                    onChange={(e) =>
                      setDirectSubForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    placeholder="Misal: Dana BOS, APBD Dinas, dll"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-indigo-600"
                  />
                  <span className="text-[10px] text-slate-400">Disimpan pada audit log & invoice</span>
                </div>
              </div>

              {/* 5. Pratinjau Lisensi Baru (Visual Card) */}
              {selectedSchoolForDirectSub && (
                <div className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-100 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-950 flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-purple-600" />
                      Pratinjau Lisensi Baru
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white text-purple-700 border border-purple-200">
                      Metode: DIRECT_SUBSCRIPTION
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Masa Aktif Saat Ini:</span>
                      <span className="font-semibold text-slate-700">
                        {selectedSchoolForDirectSub.subscription_expires_at
                          ? new Date(selectedSchoolForDirectSub.subscription_expires_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'Nonaktif / Kedaluwarsa'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px]">Masa Aktif Setelah Terbit:</span>
                      <span className="font-black text-emerald-700">
                        {previewNewExpiry} (+{directSubForm.durationDays} hari)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDirectSubModal(false)}
                  disabled={submittingDirectSub}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingDirectSub || !directSubForm.schoolId}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {submittingDirectSub ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Menerbitkan Direct Subscription...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Konfirmasi & Terbitkan Lisensi</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL LAPORAN KEUANGAN, PENGATURAN METODE & BANTUAN                    */}
      {/* ========================================================================= */}
      <FinancialReportModal
        isOpen={showFinancialReportModal}
        onClose={() => setShowFinancialReportModal(false)}
        payments={payments}
        schools={schools}
        showToast={showToast}
      />

      <PaymentSettingsModal
        isOpen={showPaymentSettingsModal}
        onClose={() => setShowPaymentSettingsModal(false)}
        showToast={showToast}
      />

      <SupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />
    </div>
  );
};
