import React, { useEffect, useState } from 'react';
import { useApp, isAuthCallbackUrl, resolveInitialViewForRole } from '../context/AppContext';
import { AppLoginLoadingScreen } from '../components/AppLoginLoadingScreen';
import { KawacanaanEmblem } from '../components/KawacanaanEmblem';
import { usePlatformBrand } from '../utils/platformBranding';
import { clearPWADismissedState, executeImmediatePWAInstall, isAndroidOrWindows } from '../utils/usePWAInstall';
import { FreeStartModal } from '../landing/components/FreeStartModal';
import { TermsAndLegalModal, LegalTabType } from '../landing/components/TermsAndLegalModal';
import {
  supabase,
  signInWithEmail,
  signInWithGoogle,
  resetPassword,
  isSupabaseConfigured,
  setSessionFromTokenOrUrl,
} from '../lib/supabaseClient';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
} from 'lucide-react';

interface LoginViewProps {
  onBackToLanding?: () => void;
  onEnterDashboard?: (target?: any) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onBackToLanding, onEnterDashboard }) => {
  const {
    showToast,
    schoolProfile,
    registrationRequired,
    openOnboarding,
    loadData,
    loginWithCredentials,
    currentUser,
    setActiveView,
    isLoginPreparing,
    loginProgressMessage,
    loginStep,
  } = useApp();
  const { appName } = usePlatformBrand();

  // Mode: 'login' | 'forgot-password'
  const [authMode, setAuthMode] = useState<'login' | 'forgot-password'>('login');
  const [isFreeStartOpen, setIsFreeStartOpen] = useState(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTabType>('terms');

  // Form states
  const [emailOrUser, setEmailOrUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem('kwc_prefill_username');
      if (stored) return stored;
      const p = new URLSearchParams(window.location.search);
      return p.get('user') || p.get('username') || '';
    } catch (_) {
      return '';
    }
  });
  const [password, setPassword] = useState(() => {
    try {
      return sessionStorage.getItem('kwc_prefill_password') || '';
    } catch (_) {
      return '';
    }
  });
  const [showPassword, setShowPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  // Loading & feedback states
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState('');

  // Auto-detect if current window has auth hash, code, or error on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash || '';

    // 1. Deteksi kegagalan / pembatalan OAuth dari Google
    const errDesc =
      params.get('error_description') ||
      (hash.includes('error_description=')
        ? decodeURIComponent(hash.split('error_description=')[1].split('&')[0])
        : null);
    const errCode =
      params.get('error') ||
      (hash.includes('error=') ? hash.split('error=')[1].split('&')[0] : null);

    if (errDesc || errCode) {
      const friendlyMsg = errDesc
        ? decodeURIComponent(errDesc.replace(/\+/g, ' '))
        : 'Autentikasi Google dibatalkan atau ditolak.';
      setErrorMessage(friendlyMsg);
      showToast(friendlyMsg, 'error');
      try {
        window.history.replaceState(null, '', window.location.pathname);
      } catch (_) {}
      setIsGoogleLoading(false);
      return;
    }

    // 2. Jika sedang memproses callback PKCE code atau hash token Google, tampilkan indikator loading
    if (params.has('code') || hash.includes('access_token=')) {
      setIsGoogleLoading(true);
    }

    if (hash && hash.includes('access_token=')) {
      setSessionFromTokenOrUrl(hash)
        .then(() => {
          showToast('Sesi Google berhasil diaktifkan. Memuat data...', 'success');
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        })
        .catch((err) => {
          console.warn('Auto token process error:', err);
          setIsGoogleLoading(false);
        });
    }
  }, [showToast, setSessionFromTokenOrUrl]);

  useEffect(() => {
    if (registrationRequired) {
      openOnboarding();
    }
  }, [registrationRequired, openOnboarding]);

  useEffect(() => {
    if (currentUser) {
      const targetView = resolveInitialViewForRole(currentUser.role);
      if (onEnterDashboard) {
        onEnterDashboard(targetView);
      } else {
        setActiveView(targetView);
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('page');
          window.history.pushState(null, '', url.pathname + (url.search ? url.search : ''));
        } catch (_) {}
      }
    }
  }, [currentUser, onEnterDashboard, setActiveView]);

  // Handle standard login through Supabase Auth.
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const identifier = emailOrUser.trim();
    const pass = password;

    if (!identifier || !pass) {
      setErrorMessage('Harap masukkan email/username dan kata sandi Anda.');
      return;
    }

    if (!isSupabaseConfigured()) {
      setErrorMessage('Koneksi Supabase belum dikonfigurasi. Periksa VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await loginWithCredentials(identifier, pass);

      if (!res.success) {
        setErrorMessage(res.error || 'Login gagal. Silakan coba lagi.');
        showToast('Login gagal.', 'error');
        setIsLoading(false);
        return;
      }

      showToast('Login berhasil. Selamat datang!', 'success');
      const targetRole = res?.role || res?.user?.role || currentUser?.role || 'ADMIN';
      const targetView = resolveInitialViewForRole(targetRole);

      // Bersihkan batas waktu penolakan dan eksekusi kotak dialog instalasi bawaan browser (Windows Chrome/Edge & Android)
      clearPWADismissedState(res?.user?.id, targetRole);
      if (isAndroidOrWindows()) {
        void executeImmediatePWAInstall();
      }

      // Transisi ke portal / dashboard sesuai hak akses role pengguna (Siswa -> portal-siswa, Guru/Admin -> dashboard)
      if (onEnterDashboard) {
        onEnterDashboard(targetView);
      } else {
        setActiveView(targetView);
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('page');
          window.history.pushState(null, '', url.pathname + (url.search ? url.search : ''));
        } catch (_) {}
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMessage(err?.message || 'Terjadi kendala saat proses autentikasi. Silakan coba lagi.');
      showToast('Login gagal.', 'error');
      setIsLoading(false);
    }
  };

  // Google OAuth handler
  const handleGoogleOAuth = async () => {
    setErrorMessage('');

    if (!isSupabaseConfigured()) {
      setErrorMessage(
        'Koneksi Supabase belum dikonfigurasi. Periksa konfigurasi Supabase.'
      );
      return;
    }

    setIsGoogleLoading(true);

    try {
      // Periksa apakah sesi Supabase aktif sudah ada sebelumnya
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        await loadData(sessionData.session.user.id);
        setIsGoogleLoading(false);
        return;
      }

      const res = await signInWithGoogle();
      if (res.error) {
        setErrorMessage(res.error.message || 'Gagal melanjutkan dengan Google.');
        setIsGoogleLoading(false);
        return;
      }
      if (res.data?.url && typeof window !== 'undefined') {
        window.location.assign(res.data.url);
      }
    } catch (err: any) {
      console.error('Google OAuth exception:', err);
      setErrorMessage(
        err?.message ||
          'Terjadi kendala saat menghubungkan ke Google. Silakan coba lagi.'
      );
      setIsGoogleLoading(false);
    }
  };

  // Handle Reset Password via Supabase Auth
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setResetSuccessMessage('');

    const email = resetEmail.trim();
    if (!email || !email.includes('@')) {
      setErrorMessage('Harap masukkan alamat email yang valid.');
      return;
    }

    setIsLoading(true);

    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      setResetSuccessMessage(
        `Permintaan reset kata sandi untuk ${email} dicatat. Hubungi Administrator Sekolah untuk menyetel ulang kata sandi.`
      );
      return;
    }

    try {
      const { error } = await resetPassword(email);
      if (error) {
        setErrorMessage(error.message || 'Gagal mengirim instruksi reset kata sandi.');
      } else {
        setResetSuccessMessage(
          `Tautan instruksi penyetelan ulang kata sandi telah dikirimkan ke email ${email}. Silakan periksa kotak masuk atau folder spam Anda.`
        );
        showToast('Tautan reset kata sandi terkirim ke email', 'success');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal memproses reset kata sandi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-slate-50 text-slate-800 flex flex-col justify-between p-4 sm:p-6 md:p-8 relative overflow-x-hidden font-sans select-none">
      {/* Animasi Loading Screen Login minimalis di tengah dengan background transparan/blur */}
      {(isLoading || isLoginPreparing || isGoogleLoading || isAuthCallbackUrl()) && (
        <AppLoginLoadingScreen />
      )}

      {/* Background Soft Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#E2E8F0_1px,transparent_1px)] [background-size:24px_24px] opacity-70 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-50/50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-slate-100/70 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header / Back Button */}
      <div className="w-full max-w-[400px] sm:max-w-[430px] md:max-w-[450px] lg:max-w-[460px] mx-auto flex items-center justify-start z-10 pt-1 sm:pt-2">
        {onBackToLanding && (
          <button
            type="button"
            id="btn-back-to-landing"
            onClick={onBackToLanding}
            className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-white hover:bg-slate-100/90 border border-slate-200 text-slate-600 hover:text-blue-700 text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow-sm cursor-pointer group"
          >
            <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Kembali ke Beranda</span>
          </button>
        )}
      </div>

      {/* Main Content Area: Responsive Centered Card */}
      <div className="w-full max-w-[400px] sm:max-w-[430px] md:max-w-[450px] lg:max-w-[460px] mx-auto my-auto py-5 sm:py-7 z-10">
        <div className="w-full bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-9 shadow-lg sm:shadow-xl shadow-slate-200/80 border border-slate-200/90 transition-all text-slate-800">
          
          {/* Top Brand Header dengan Logo Resmi Kawacanaan yang Terintegrasi */}
          <div className="flex flex-col items-center justify-center mb-5 sm:mb-6 text-center">
            <KawacanaanEmblem size={52} className="mb-2.5 drop-shadow-sm" />
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" />
              <span>{appName || 'Kawacanaan Presensi'}</span>
            </div>

            {authMode === 'forgot-password' && (
              <>
                <h1 className="text-lg sm:text-xl md:text-2xl font-black tracking-tight text-slate-900 mt-2.5">
                  Reset Kata Sandi
                </h1>
                <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed max-w-xs">
                  Masukkan email terdaftar untuk menerima tautan penyetelan ulang kata sandi.
                </p>
              </>
            )}

            {schoolProfile.namaSekolah && (
              <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] font-semibold text-slate-700">
                <Building2 size={13} className="text-slate-400 shrink-0" />
                <span className="truncate max-w-[240px] sm:max-w-[280px]">{schoolProfile.namaSekolah}</span>
              </div>
            )}
          </div>

          {/* Error Alert Box */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl sm:rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 leading-relaxed animate-in fade-in duration-200">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Success Alert Box */}
          {resetSuccessMessage && (
            <div className="mb-4 p-3.5 rounded-xl sm:rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 leading-relaxed animate-in fade-in duration-200">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
              <div className="flex-1 font-medium">{resetSuccessMessage}</div>
            </div>
          )}

          {/* VIEW 1: LOGIN FORM */}
          {authMode === 'login' && (
            <div>
              <form onSubmit={handleLogin} className="space-y-4" id="form-kawacanaan-login">
                {/* Email or Username Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">
                    Email atau Username
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-slate-400 pointer-events-none">
                      <Mail size={17} />
                    </span>
                    <input
                      id="input-login-email"
                      type="text"
                      required
                      value={emailOrUser}
                      onChange={(e) => setEmailOrUser(e.target.value)}
                      placeholder="Email atau username"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-slate-800 placeholder-slate-400 rounded-xl sm:rounded-2xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 outline-none text-xs sm:text-sm font-medium transition-all"
                    />
                  </div>
                </div>

                {/* Password Input with Show/Hide Toggle */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 ml-1 mr-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Kata Sandi
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('forgot-password');
                        setErrorMessage('');
                        setResetSuccessMessage('');
                      }}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                      id="btn-forgot-password-link"
                    >
                      Lupa kata sandi?
                    </button>
                  </div>

                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-slate-400 pointer-events-none">
                      <Lock size={17} />
                    </span>
                    <input
                      id="input-login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan kata sandi"
                      className="w-full pl-10 pr-11 py-3 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-slate-800 placeholder-slate-400 rounded-xl sm:rounded-2xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 outline-none text-xs sm:text-sm font-medium transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
                      tabIndex={-1}
                      title={showPassword ? 'Sembunyikan' : 'Tampilkan'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Primary Login Button */}
                <button
                  id="btn-submit-masuk"
                  type="submit"
                  disabled={isLoading || isLoginPreparing}
                  className="w-full mt-2 py-3.5 px-6 rounded-xl sm:rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-extrabold text-sm tracking-wide transition-all shadow-md shadow-blue-600/20 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 min-h-[46px] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading || isLoginPreparing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Menyiapkan Data Akun...</span>
                    </>
                  ) : (
                    <span>Masuk</span>
                  )}
                </button>
              </form>

              {/* Clean Divider "Atau" */}
              <div className="relative flex py-4 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="shrink mx-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  Atau
                </span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              {/* Google OAuth Supabase Button */}
              <button
                type="button"
                id="btn-google-oauth-login"
                onClick={handleGoogleOAuth}
                disabled={isGoogleLoading}
                className="w-full py-3 px-4 rounded-xl sm:rounded-2xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs sm:text-sm transition-all shadow-2xs hover:shadow-sm flex items-center justify-center gap-3 cursor-pointer active:scale-[0.99] min-h-[44px]"
              >
                {isGoogleLoading ? (
                  <Loader2 size={18} className="animate-spin text-blue-600" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                )}
                <span>Lanjutkan dengan Google</span>
              </button>

              {/* Footer registration note inside card */}
              <div className="text-center mt-6 text-xs text-slate-500 font-medium space-y-2">
                <div>
                  Belum punya akun?{' '}
                  <button
                    type="button"
                    onClick={() => setIsFreeStartOpen(true)}
                    className="font-bold text-blue-700 hover:underline cursor-pointer"
                    id="btn-link-buat-akun-gratis"
                  >
                    Buat akun gratis
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: FORGOT PASSWORD FORM */}
          {authMode === 'forgot-password' && (
            <div>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setErrorMessage('');
                  setResetSuccessMessage('');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 mb-4 transition-colors cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Kembali ke Halaman Masuk</span>
              </button>

              <div className="mb-4">
                <h2 className="text-base font-extrabold text-slate-900">
                  Pemulihan Kata Sandi
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                  Masukkan email akun Anda untuk menerima instruksi reset kata sandi melalui Supabase.
                </p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">
                    Alamat Email
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-slate-400 pointer-events-none">
                      <Mail size={17} />
                    </span>
                    <input
                      id="input-reset-email"
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="contoh: nama@sekolah.sch.id"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-slate-800 placeholder-slate-400 rounded-xl sm:rounded-2xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 outline-none text-xs sm:text-sm font-medium transition-all"
                    />
                  </div>
                </div>

                <button
                  id="btn-submit-reset-password"
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-6 rounded-xl sm:rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-extrabold text-xs sm:text-sm tracking-wide transition-all shadow-md shadow-blue-600/20 hover:shadow-lg focus:outline-none min-h-[44px] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Mengirim Tautan...</span>
                    </>
                  ) : (
                    <span>Kirim Tautan Reset Kata Sandi</span>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Footer Links */}
      <footer className="w-full max-w-[400px] sm:max-w-[430px] md:max-w-[450px] lg:max-w-[460px] mx-auto flex items-center justify-center text-center text-[11px] sm:text-xs text-slate-400 pt-3 pb-2 z-10">
        <div className="flex items-center justify-center gap-3 font-medium text-slate-500">
          <button
            type="button"
            id="btn-login-terms"
            onClick={() => {
              setLegalTab('terms');
              setIsLegalModalOpen(true);
            }}
            className="hover:text-blue-700 transition-colors cursor-pointer"
          >
            Syarat & Ketentuan
          </button>
          <span>•</span>
          <button
            type="button"
            id="btn-login-privacy"
            onClick={() => {
              setLegalTab('privacy');
              setIsLegalModalOpen(true);
            }}
            className="hover:text-blue-700 transition-colors cursor-pointer"
          >
            Kebijakan Privasi
          </button>
        </div>
      </footer>

      {/* Modal Syarat & Ketentuan & Kebijakan Privasi (Sama dengan footer Landing Page) */}
      <TermsAndLegalModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
        initialTab={legalTab}
        lang="ID"
      />

      {/* Modal Mulai Gratis: Pemilihan Peran & Pendaftaran Akun Pendidik (alur pendaftaran sama persis dengan page landing) */}
      <FreeStartModal
        isOpen={isFreeStartOpen}
        onClose={() => setIsFreeStartOpen(false)}
        onOpenLogin={(prefill) => {
          setIsFreeStartOpen(false);
          if (prefill?.username) {
            setEmailOrUser(prefill.username);
            if (prefill.password) {
              setPassword(prefill.password);
            }
            setErrorMessage('');
            setResetSuccessMessage('Akun baru berhasil dibuat. Silakan klik Masuk untuk mulai menggunakan sistem.');
          }
        }}
        onEnterSystem={() => {
          setIsFreeStartOpen(false);
          const target = currentUser ? resolveInitialViewForRole(currentUser.role) : 'dashboard';
          if (onEnterDashboard) {
            onEnterDashboard(target);
          } else {
            setActiveView(target);
          }
        }}
        onEnterDashboard={() => {
          setIsFreeStartOpen(false);
          const target = currentUser ? resolveInitialViewForRole(currentUser.role) : 'dashboard';
          if (onEnterDashboard) {
            onEnterDashboard(target);
          } else {
            setActiveView(target);
          }
        }}
        lang="ID"
      />
    </div>
  );
};

