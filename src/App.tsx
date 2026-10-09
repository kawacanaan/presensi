import React from 'react';
import { AppProvider, useApp, hasPersistedAuthToken, isAuthCallbackUrl } from './context/AppContext';
import { Header } from './components/Header';
import { LoginView } from './views/LoginView';
import { ChangePasswordView } from './views/ChangePasswordView';
import { ResetPasswordView } from './views/ResetPasswordView';
import { DashboardView } from './views/DashboardView';
import { DataReferensiView } from './views/DataReferensiView';
import { DataPenggunaView } from './views/DataPenggunaView';
import { KalenderAkademikView } from './views/KalenderAkademikView';
import { AbsensiView } from './views/AbsensiView';
import { RekapitulasiView } from './views/RekapitulasiView';
import { LaporanView } from './views/LaporanView';
import { PengaturanView } from './views/PengaturanView';
import { PortalSiswaView } from './views/PortalSiswaView';
import { LandingPageView } from './views/LandingPageView';
import { SuperAdminView } from './views/SuperAdminView';
import { SetupSuperAdminView } from './views/SetupSuperAdminView';
import { OnboardingView } from './views/OnboardingView';
import { AppLoginLoadingScreen } from './components/AppLoginLoadingScreen';
import { AppAuthLoadingSkeleton } from './components/DashboardSkeleton';
import { BookLoadingModal } from './components/BookLoader';
import { AIChatWidget } from './components/AIChatWidget';
import { UpgradePromptModal } from './components/UpgradePromptModal';
import { TeacherUpgradeModal } from './components/TeacherUpgradeModal';
import { SchoolUpgradeModal } from './components/SchoolUpgradeModal';
import { PublicDailyReportViewer } from './components/PublicDailyReportViewer';
import { PublicSmartInvoiceViewer } from './components/PublicSmartInvoiceViewer';
import { parseCanonicalReportParams } from './utils/smartReport';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PWAFloatingInstallPrompt } from './components/PWAInstallButton';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import type { ActiveView, UserRole } from './types';

// Peta akses per-role untuk setiap view. Ini adalah lapisan pertahanan kedua di sisi klien:
// data sesungguhnya tetap dilindungi oleh RLS Supabase + /api/admin-users, tapi tanpa guard ini
// UI sensitif (mis. Manajemen Pengguna, Pengaturan Sistem) bisa ter-render hanya karena
// `activeView` di-set lewat state, meski tautan menunya sudah disembunyikan.
const VIEW_ACCESS: Record<ActiveView, UserRole[] | 'all'> = {
  login: 'all',
  dashboard: ['ADMIN', 'KEPALA SEKOLAH', 'WALI KELAS', 'GURU MAPEL'],
  superadmin: ['SUPER_ADMIN'],
  'data-referensi': ['ADMIN', 'KEPALA SEKOLAH', 'WALI KELAS', 'GURU MAPEL'],
  'data-pengguna': ['ADMIN', 'SUPER_ADMIN'],
  'kalender-akademik': ['ADMIN', 'KEPALA SEKOLAH', 'WALI KELAS', 'GURU MAPEL'],
  absensi: ['ADMIN', 'WALI KELAS', 'GURU MAPEL'],
  rekapitulasi: ['ADMIN', 'KEPALA SEKOLAH', 'WALI KELAS', 'GURU MAPEL'],
  laporan: ['ADMIN', 'KEPALA SEKOLAH', 'WALI KELAS', 'GURU MAPEL'],
  pengaturan: ['ADMIN', 'KEPALA SEKOLAH', 'WALI KELAS', 'GURU MAPEL'],
  'portal-siswa': ['SISWA', 'KEPALA SEKOLAH'],
};

const defaultViewForRole = (role: UserRole): ActiveView => role === 'SUPER_ADMIN' ? 'superadmin' : (role === 'SISWA' ? 'portal-siswa' : 'dashboard');

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-5 sm:bottom-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto p-3.5 sm:p-4 rounded-xl shadow-xl border flex items-center justify-between gap-3 text-xs font-semibold animate-in slide-in-from-bottom-3 duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-emerald-900/10'
              : toast.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200 shadow-rose-900/10'
              : 'bg-white text-slate-800 border-slate-200 shadow-slate-900/10'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toast.type === 'success' && <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />}
            {toast.type === 'error' && <AlertCircle size={18} className="text-rose-600 flex-shrink-0" />}
            {toast.type === 'info' && <Info size={18} className="text-blue-600 flex-shrink-0" />}
            <span className="leading-snug">{toast.message}</span>
          </div>

          <button
            onClick={() => removeToast(toast.id)}
            className="text-slate-400 hover:text-slate-600 p-1 transition-colors flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};


import { getTenantLifecycleInfo } from './utils/tenantLifecycle';

const SubscriptionGate: React.FC = () => {
  const { currentUser, logout } = useApp();
  const lifecycle = getTenantLifecycleInfo({
    status: currentUser?.subscriptionStatus,
    subscription_expires_at: currentUser?.subscriptionExpiresAt,
  });

  if (!currentUser || currentUser.role === 'SUPER_ADMIN' || lifecycle.canAccessApp) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white border border-rose-200 rounded-3xl p-8 text-center shadow-lg animate-in fade-in zoom-in-95">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-2xl font-black">
          !
        </div>
        <h1 className="mt-5 text-2xl font-black text-slate-900">Akses Operasional Ditangguhkan</h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          {lifecycle.description || 'Masa aktif paket sekolah Anda dan masa tenggang telah berakhir atau sekolah sedang dinonaktifkan.'} Data tetap tersimpan aman di sistem dan dapat diakses kembali setelah langganan diperpanjang oleh Administrator.
        </p>
        <div className="mt-5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600 flex items-center justify-around">
          <span>Paket: <strong className="text-slate-900">{currentUser?.subscriptionPlan || 'Standar'}</strong></span>
          <span>Kedaluwarsa: <strong className="text-rose-600">{currentUser?.subscriptionExpiresAt || '-'}</strong></span>
        </div>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => {
              void logout();
            }}
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
          >
            Keluar (Logout)
          </button>
        </div>
      </div>
    </div>
  );
};

const MainAppContent: React.FC = () => {
  const { 
    currentUser, 
    activeWorkspace,
    activeView, 
    setActiveView, 
    showToast, 
    passwordRecovery, 
    isOnboarding, 
    openOnboarding, 
    loadUserDataAfterOnboarding,
    isAuthChecking,
    isLoginPreparing,
    isSwitchingWorkspace,
    switchingWorkspaceProgress,
    switchingWorkspaceTitle,
    switchingWorkspaceMessage,
    upgradeModal,
    closeUpgradeModal,
    isTeacherUpgradeOpen,
    setIsTeacherUpgradeOpen,
    isSchoolUpgradeOpen,
    setIsSchoolUpgradeOpen,
  } = useApp();
  const [showLanding, setShowLanding] = React.useState(() => {
    if (typeof window === 'undefined') return true;
    const params = new URLSearchParams(window.location.search);

    // Jika pengguna sudah pernah login, ada token sesi, atau sedang dalam callback OAuth:
    // JANGAN PERNAH buka landing page secara default!
    if (
      hasPersistedAuthToken() ||
      isAuthCallbackUrl() ||
      Boolean(localStorage.getItem('kawacanaan_cached_user_session')) ||
      localStorage.getItem('kawacanaan_user_has_logged_in') === 'true' ||
      localStorage.getItem('kawacanaan_oauth_pending') === 'true' ||
      sessionStorage.getItem('kawacanaan_oauth_pending') === 'true' ||
      localStorage.getItem('kawacanaan_hide_landing') === 'true' ||
      sessionStorage.getItem('kawacanaan_hide_landing') === 'true'
    ) {
      return false;
    }

    return params.get('page') !== 'login' && params.get('page') !== 'setup';
  });

  // Check if public smart report link is accessed (e.g. by parents/supervisors clicking link from WhatsApp)
  const [publicReportParams, setPublicReportParams] = React.useState(() => {
    if (typeof window === 'undefined') return null;
    return parseCanonicalReportParams(new URLSearchParams(window.location.search));
  });

  // Check if public Smart Link PDF Invoice is accessed
  const [smartInvoiceNumber, setSmartInvoiceNumber] = React.useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const p = new URLSearchParams(window.location.search);
    return p.get('smart_invoice') || p.get('invoice') || null;
  });

  // Pastikan landing page tertutup jika user sudah login, sedang onboarding, recovery password, atau OAuth pending
  React.useEffect(() => {
    if (
      isOnboarding ||
      currentUser ||
      passwordRecovery ||
      isAuthCallbackUrl() ||
      isAuthChecking ||
      isLoginPreparing ||
      localStorage.getItem('kawacanaan_oauth_pending') === 'true' ||
      sessionStorage.getItem('kawacanaan_oauth_pending') === 'true' ||
      localStorage.getItem('kawacanaan_hide_landing') === 'true' ||
      sessionStorage.getItem('kawacanaan_hide_landing') === 'true'
    ) {
      setShowLanding(false);
    }
  }, [isOnboarding, currentUser, passwordRecovery, isAuthChecking, isLoginPreparing]);

  // Handle browser back / forward navigation (PopState)
  React.useEffect(() => {
    const handlePopState = () => {
      const parsed = parseCanonicalReportParams(new URLSearchParams(window.location.search));
      setPublicReportParams(parsed);

      const params = new URLSearchParams(window.location.search);
      if (
        !currentUser &&
        !hasPersistedAuthToken() &&
        !isAuthCallbackUrl() &&
        !isAuthChecking &&
        !isLoginPreparing &&
        localStorage.getItem('kawacanaan_user_has_logged_in') !== 'true' &&
        localStorage.getItem('kawacanaan_oauth_pending') !== 'true' &&
        sessionStorage.getItem('kawacanaan_oauth_pending') !== 'true' &&
        localStorage.getItem('kawacanaan_hide_landing') !== 'true' &&
        sessionStorage.getItem('kawacanaan_hide_landing') !== 'true' &&
        !localStorage.getItem('kawacanaan_cached_user_session') &&
        params.get('page') !== 'login' &&
        params.get('page') !== 'setup'
      ) {
        setShowLanding(true);
      } else if (params.get('page') === 'login' || isAuthCallbackUrl()) {
        setShowLanding(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser, isAuthChecking, isLoginPreparing]);

  React.useEffect(() => {
    if (currentUser) {
      if (activeView === 'login') {
        const targetView = defaultViewForRole(currentUser.role);
        setActiveView(targetView);
      }
      setShowLanding(false);
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get('page') === 'login') {
          url.searchParams.delete('page');
          window.history.pushState(null, '', url.pathname + (url.search ? url.search : ''));
        }
      } catch (_) {}
    }
  }, [currentUser, activeView, setActiveView]);

  const handleEnterSystem = () => {
    setShowLanding(false);
    setActiveView('login');
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('page', 'login');
      window.history.pushState(null, '', url.toString());
    } catch (_) {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEnterDashboard = () => {
    setShowLanding(false);
    setActiveView('dashboard');
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('page');
      window.history.pushState(null, '', url.pathname + (url.search ? url.search : ''));
    } catch (_) {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToLanding = () => {
    setShowLanding(true);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('page');
      window.history.pushState(null, '', url.pathname + (url.search ? url.search : ''));
    } catch (_) {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 0. Public Smart Report Viewer (Link yang diklik oleh orang tua/wali via WhatsApp / Publik)
  // HARUS DICEK PALING PERTAMA: Pengunjung publik tidak perlu melewati proses login, onboarding, atau recovery apapun!
  if (publicReportParams) {
    return (
      <ErrorBoundary fallbackTitle="Lembar Rekap Presensi">
        <PublicDailyReportViewer
          isPublicView={true}
          schoolId={publicReportParams.schoolId}
          classId={publicReportParams.classId}
          className={publicReportParams.className}
          date={publicReportParams.date}
          attendanceType={publicReportParams.attendanceType}
          subjectId={publicReportParams.subjectId}
          reportType={publicReportParams.reportType}
          selectedWeek={publicReportParams.selectedWeek}
          month={publicReportParams.month}
          year={publicReportParams.year}
          semester={publicReportParams.semester}
          academicYear={publicReportParams.academicYear}
          onBackToApp={() => {
            setPublicReportParams(null);
            try {
              window.history.pushState(null, '', window.location.pathname);
            } catch (_) {}
          }}
        />
      </ErrorBoundary>
    );
  }

  const isSetupPage = new URLSearchParams(window.location.search).get('page') === 'setup';

  if (isSetupPage && !currentUser) return <SetupSuperAdminView />;

  if (passwordRecovery) {
    return <ResetPasswordView />;
  }

  // 1. Jika user sedang dalam proses Onboarding (mis. registrasi akun pertama via Google / Baru)
  if (isOnboarding) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <OnboardingView onCompleted={(userId) => void loadUserDataAfterOnboarding(userId)} />
        <ToastContainer />
      </div>
    );
  }

  // 2. Jika sedang dalam proses login awal (kredensial / Google OAuth) dan profil belum ter-hydrate,
  // tampilkan LoginView dengan overlay loading screen di tengah sehingga background halaman login tetap terlihat dengan blur ringan.
  // BUKAN saat reload dashboard biasa.
  if ((isLoginPreparing || isAuthCallbackUrl()) && !currentUser) {
    return (
      <>
        <LoginView onBackToLanding={handleBackToLanding} onEnterDashboard={handleEnterDashboard} />
        <ToastContainer />
      </>
    );
  }

  // 4. Jika sedang memeriksa sesi auth saat reload halaman tanpa data cache sesi
  if (isAuthChecking && !currentUser && hasPersistedAuthToken()) {
    return <AppAuthLoadingSkeleton />;
  }

  // Smart Link PDF Invoice Viewer (Bisa diakses langsung oleh sekolah, guru, atau auditor via link)
  if (smartInvoiceNumber) {
    return (
      <PublicSmartInvoiceViewer
        invoiceNumber={smartInvoiceNumber}
        onBackToApp={() => {
          setSmartInvoiceNumber(null);
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete('smart_invoice');
            url.searchParams.delete('invoice');
            window.history.pushState(null, '', url.pathname + (url.search ? url.search : ''));
          } catch (_) {}
        }}
      />
    );
  }

  // Tampilan landing page sebagai layar awal SAAT pengguna memang belum login sama sekali
  if (showLanding && !currentUser) {
    return (
      <>
        <LandingPageView onEnterSystem={handleEnterSystem} onEnterDashboard={handleEnterDashboard} />
        <ToastContainer />
      </>
    );
  }

  if (!currentUser || activeView === 'login') {
    return (
      <>
        <LoginView onBackToLanding={handleBackToLanding} onEnterDashboard={handleEnterDashboard} />
        <ToastContainer />
        <PWAFloatingInstallPrompt />
      </>
    );
  }

  // Onboarding ganti password baru dinonaktifkan untuk admin, kepala sekolah, wali kelas, guru mapel, dan siswa.
  const isSchoolUser = ['ADMIN', 'KEPALA SEKOLAH', 'WALI KELAS', 'GURU MAPEL', 'SISWA'].includes(currentUser.role);
  if (currentUser.mustChangePassword && !isSchoolUser) {
    return <ChangePasswordView />;
  }

  // Jika langganan berakhir, jangan pernah memblokir total akses operasional guru/siswa.
  // Sistem otomatis menerapkan fallback / downgrade ke mode gratis terbatas (presensi tetap berjalan).

  // Defense-in-depth: jangan pernah render view yang perannya tidak diizinkan,
  // apa pun cara `activeView` bisa berubah.
  const isPersonalWs =
    activeWorkspace?.workspaceType === 'personal' ||
    activeWorkspace?.workspaceType === 'individu' ||
    (currentUser?.subscriptionPlan === 'mulai' && !currentUser?.schoolId);

  const allowedRoles = VIEW_ACCESS[activeView];
  let isAllowed = allowedRoles === 'all' || allowedRoles.includes(currentUser.role);

  // Akses menu Data Pengguna:
  // Di Ruang Kerja Individu, izinkan semua pendidik (Wali Kelas, Guru Mapel, Guru) mengakses Data Pengguna.
  if (activeView === 'data-pengguna' && isPersonalWs) {
    isAllowed = true;
  }

  // Aturan akses khusus Pengaturan Sistem di Ruang Kerja Sekolah:
  // Hanya dapat diakses oleh Admin dan Kepala Sekolah.
  // Sembunyikan & tolak akses untuk Wali Kelas dan Guru Mapel di Ruang Kerja Sekolah.
  // Di Ruang Kerja Individu, tetap diizinkan.
  if (activeView === 'pengaturan' && !isPersonalWs && (currentUser.role === 'WALI KELAS' || currentUser.role === 'GURU MAPEL')) {
    isAllowed = false;
  }

  if (!isAllowed) {
    const fallback = defaultViewForRole(currentUser.role);
    // Jangan setState saat render; jadwalkan redirect lalu tampilkan layar kosong sesaat.
    setTimeout(() => {
      const errMsg = activeView === 'pengaturan'
        ? 'Menu Pengaturan Sistem hanya dapat diakses oleh Administrator dan Kepala Sekolah di ruang kerja sekolah.'
        : 'Anda tidak memiliki hak akses untuk membuka halaman tersebut.';
      showToast(errMsg, 'error');
      setActiveView(fallback);
    }, 0);
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col antialiased">
        <Header />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col antialiased selection:bg-blue-600 selection:text-white">
      {/* Universal Top Header (disembunyikan khusus Super Admin view dan Portal Siswa agar layout portal HP tampil penuh dan navigasi bawah selalu terlihat) */}
      {activeView !== 'superadmin' && activeView !== 'portal-siswa' && <Header />}

      {/* Dynamic View Body */}
      <main className={`flex-1 ${activeView === 'superadmin' || activeView === 'portal-siswa' ? '' : 'pb-12'}`}>
        {activeView === 'superadmin' && <SuperAdminView />}
        {activeView === 'dashboard' && <DashboardView />}
        {activeView === 'data-referensi' && <DataReferensiView />}
        {activeView === 'data-pengguna' && <DataPenggunaView />}
        {activeView === 'kalender-akademik' && <KalenderAkademikView />}
        {activeView === 'absensi' && <AbsensiView />}
        {activeView === 'rekapitulasi' && <RekapitulasiView />}
        {activeView === 'laporan' && <LaporanView />}
        {activeView === 'pengaturan' && <PengaturanView />}
        {activeView === 'portal-siswa' && <PortalSiswaView />}
      </main>

      {/* Visual Book Loading Modal for Workspace Switch */}
      <BookLoadingModal
        isOpen={isSwitchingWorkspace}
        title={switchingWorkspaceTitle || "Memuat Ruang Kerja..."}
        subtitle="Sistem sedang mengalihkan profil, izin akses rombel kelas, dan basis data presensi."
        badgeText="PERGANTIAN RUANG KERJA"
        progress={switchingWorkspaceProgress}
        statusMessage={switchingWorkspaceMessage}
      />

      {/* Live AI Attendance Assistant Chat Widget */}
      <AIChatWidget />

      {/* Universal Upgrade Prompt Modal with Friendly Wording & Dual Onboarding Options */}
      <UpgradePromptModal
        isOpen={upgradeModal.isOpen}
        onClose={closeUpgradeModal}
        featureId={upgradeModal.featureId}
        customTitle={upgradeModal.customTitle}
        customMessage={upgradeModal.customMessage}
        targetPackage={upgradeModal.targetPackage}
        onOpenTeacherUpgrade={() => setIsTeacherUpgradeOpen(true)}
        onOpenSchoolUpgrade={() => setIsSchoolUpgradeOpen(true)}
      />

      {/* Onboarding Upgrade Paket Guru (Ruang Kerja Individu Pro) */}
      <TeacherUpgradeModal
        isOpen={isTeacherUpgradeOpen}
        onClose={() => setIsTeacherUpgradeOpen(false)}
      />

      {/* Onboarding Upgrade Paket Sekolah (Ruang Kerja Sekolah Terpadu) */}
      <SchoolUpgradeModal
        isOpen={isSchoolUpgradeOpen}
        onClose={() => setIsSchoolUpgradeOpen(false)}
      />

      {/* Global PWA Floating Install Prompt for Android & Windows */}
      <PWAFloatingInstallPrompt />

      {/* Global Toast Notifications */}
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
