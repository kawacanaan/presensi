import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabaseClient';
import {
  GraduationCap,
  BookOpen,
  ArrowRight,
  AlertCircle,
  Loader2,
  ShieldCheck,
  X,
  LogOut,
} from 'lucide-react';
import waliKelasWanitaImg from '../assets/images/wali_kelas_wanita_1789830539387.jpg';
import guruMapelPriaImg from '../assets/images/guru_mapel_pria_1789830556851.jpg';

type RoleType = 'homeroom' | 'subject';

interface OnboardingViewProps {
  onCompleted?: (userId: string) => void;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onCompleted }) => {
  const {
    showToast,
    logout,
    loadUserDataAfterOnboarding,
    setActiveView,
    setIsOnboarding,
  } = useApp();

  const [selectedRole, setSelectedRole] = useState<RoleType>('homeroom');
  const [googleUserEmail, setGoogleUserEmail] = useState('');
  const [googleUserId, setGoogleUserId] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Periksa sesi aktif Google / Supabase saat mount
  useEffect(() => {
    let isMounted = true;
    const checkActiveSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const sessionUser = data?.session?.user;
        if (sessionUser && isMounted) {
          setGoogleUserId(sessionUser.id);
          const userEmail = sessionUser.email || '';
          setGoogleUserEmail(userEmail);

          const meta = sessionUser.user_metadata || {};
          const detectedName = meta.full_name || meta.name || '';
          const finalName = detectedName || (userEmail ? userEmail.split('@')[0] : 'Pendidik');
          setFullName(finalName);
        }
      } catch (err) {
        console.warn('Session check warning in OnboardingView:', err);
      }
    };

    void checkActiveSession();
    return () => {
      isMounted = false;
    };
  }, []);

  // Alur Pemilihan Peran: Simpan Peran & Buat Ruang Kerja Personal -> Langsung Menuju Dashboard
  const handleSelectGoogleRole = async (role: RoleType) => {
    setSelectedRole(role);
    setFormError('');
    setIsSubmitting(true);

    try {
      const cleanName = fullName.trim() || (googleUserEmail ? googleUserEmail.split('@')[0] : 'Pendidik');
      const payloadRole = role === 'homeroom' ? 'WALI KELAS' : 'GURU MAPEL';
      const action = role === 'homeroom' ? 'onboard_homeroom' : 'onboard_subject_teacher';

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const targetUserId = googleUserId || sessionData?.session?.user?.id;

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action,
          mode: 'personal',
          teacherName: cleanName,
          nip: '-',
          gender: 'L',
          phone: '-',
          employmentStatus: 'PNS',
          workspaceName:
            role === 'homeroom'
              ? `Ruang Kerja Wali Kelas - ${cleanName}`
              : `Ruang Kerja Guru Mapel - ${cleanName}`,
          subjectName: role === 'subject' ? 'Guru Mata Pelajaran' : undefined,
          grade: 1,
          className: 'Kelas 1',
        }),
      });

      const data = await res.json();
      if (!res.ok || (!data.ok && !data.success)) {
        throw new Error(data.error || 'Gagal menyiapkan ruang kerja. Silakan coba lagi.');
      }

      // Simpan preferensi akun di localStorage
      try {
        localStorage.removeItem('kawacanaan_cached_school_ws');
        localStorage.removeItem('kawacanaan_last_workspace_id');
        localStorage.setItem('kawacanaan_last_registered_name', cleanName);
        localStorage.setItem('kawacanaan_last_registered_role', payloadRole);
        localStorage.setItem('kawacanaan_user_has_logged_in', 'true');
        const resolvedUserId = targetUserId || data.userId;
        if (resolvedUserId && data.schoolId) {
          localStorage.setItem(`kawacanaan_last_workspace_id_${resolvedUserId}`, data.schoolId);
          const personalWs = {
            id: `ws-mem-${resolvedUserId}-${data.schoolId}`,
            userId: resolvedUserId,
            workspaceId: data.schoolId,
            workspaceCode: null,
            role: payloadRole,
            workspaceName: role === 'homeroom' ? 'Ruang Kerja Wali Kelas' : 'Ruang Kerja Guru Mapel',
            workspaceType: 'personal',
            registrationMode: 'personal',
            npsn: null,
            subscriptionPlan: 'mulai',
            joinedAt: new Date().toISOString(),
          };
          localStorage.setItem(`kawacanaan_school_ws_${resolvedUserId}`, JSON.stringify(personalWs));
        }
      } catch (_) {}

      showToast(
        `Selamat datang, ${cleanName}! Ruang kerja ${role === 'homeroom' ? 'Wali Kelas' : 'Guru Mapel'} Anda siap digunakan.`,
        'success'
      );
      setIsOnboarding(false);

      const finalUserId = targetUserId || data.userId;
      if (onCompleted) {
        onCompleted(finalUserId);
      } else if (loadUserDataAfterOnboarding) {
        await loadUserDataAfterOnboarding(finalUserId);
      } else {
        setActiveView('dashboard');
      }
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan pada sistem saat menyiapkan ruang kerja.');
      setIsSubmitting(false);
    }
  };

  const handleBackToLogin = async () => {
    try {
      await logout();
    } catch (_) {}
    setIsOnboarding(false);
    setActiveView('login');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl md:max-w-2xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden my-auto animate-in zoom-in-95 duration-200 flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[90vh]">
        {/* ========================================================================= */}
        {/* TOP HEADER: Brand Logo Kawacanaan & Status Pilih Peran (Persis Mulai Gratis) */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between px-3.5 sm:px-6 py-2.5 sm:py-3.5 border-b border-slate-100 bg-white shrink-0">
          {/* Brand / Logo Kawacanaan SD */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 rounded-xl flex items-center justify-center text-white font-black text-sm sm:text-base shadow-sm shadow-blue-700/25 shrink-0 border border-blue-500/40 relative">
              <span className="relative z-10">K</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-slate-900 text-sm sm:text-base tracking-tight uppercase">
                Kawacanaan
              </span>
              <span className="px-1.5 py-0.5 bg-blue-100/90 text-blue-800 text-[9px] font-black rounded font-mono uppercase tracking-wider border border-blue-200/80">
                SD
              </span>
            </div>
          </div>

          {/* Stepper Indicator & Close Button */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-[10px] sm:text-xs font-bold bg-blue-600 text-white shadow-xs">
              <span className="w-4 h-4 rounded-full bg-white text-blue-600 flex items-center justify-center text-[9px] sm:text-[10px] font-black">
                1
              </span>
              <span>Pilih Peran</span>
            </div>

            {/* Close / Exit Button */}
            <button
              type="button"
              onClick={handleBackToLogin}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
              aria-label="Tutup dan Kembali"
              id="btn-close-google-role-modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content Body */}
        <div className="p-3.5 sm:p-5 md:p-6 overflow-y-auto flex-1">
          {/* Minimalist Heading */}
          <div className="mb-3.5 sm:mb-5">
            <h2 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight">
              Pilih Peran Pendidik
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Pilih modul presensi yang sesuai dengan tugas mengajar Anda di sekolah.
            </p>
          </div>

          {/* Form Error Banner */}
          {formError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span className="font-semibold">{formError}</span>
            </div>
          )}

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
                      Wali Kelas
                    </h3>
                    <p className="text-[11px] font-semibold text-blue-600 mt-0.5 truncate">
                      Presensi Harian Kelas SD
                    </p>
                  </div>
                </div>

                {/* Brief Description */}
                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed line-clamp-2 sm:line-clamp-none">
                  Kelola presensi seluruh siswa satu kelas, rekap bulanan otomatis, dan cetak format kedinasan.
                </p>

                {/* Feature Badges */}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/80 text-slate-600 text-[10px] font-medium">
                    Format Kedinasan
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/80 text-slate-600 text-[10px] font-medium">
                    Hari Efektif Otomatis
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSelectGoogleRole('homeroom')}
                id="btn-choose-homeroom"
                className="mt-3.5 sm:mt-4 w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold py-2.5 px-3.5 rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer text-xs min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting && selectedRole === 'homeroom' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyiapkan Ruang Kerja...</span>
                  </>
                ) : (
                  <>
                    <span>Pilih Wali Kelas</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
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
                      Guru Mapel
                    </h3>
                    <p className="text-[11px] font-semibold text-emerald-600 mt-0.5 truncate">
                      Presensi Jam Pelajaran SD
                    </p>
                  </div>
                </div>

                {/* Brief Description */}
                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed line-clamp-2 sm:line-clamp-none">
                  Catat kehadiran per jam pelajaran (PJOK, PAI, dll), kelola multi-rombel, dan jurnal mengajar.
                </p>

                {/* Feature Badges */}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/80 text-slate-600 text-[10px] font-medium">
                    Jadwal Jam Mengajar
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/80 text-slate-600 text-[10px] font-medium">
                    Jurnal Pembelajaran
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSelectGoogleRole('subject')}
                id="btn-choose-subject"
                className="mt-3.5 sm:mt-4 w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-semibold py-2.5 px-3.5 rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer text-xs min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting && selectedRole === 'subject' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyiapkan Ruang Kerja...</span>
                  </>
                ) : (
                  <>
                    <span>Pilih Guru Mapel</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Minimalist Bottom Footer */}
          <div className="mt-4 sm:mt-5 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <div className="flex items-center gap-1.5 font-medium text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Data tersimpan aman & langsung aktif</span>
            </div>

            <div className="flex items-center gap-2 font-medium text-[11px]">
              {googleUserEmail && (
                <span className="text-slate-400 truncate max-w-[200px]" title={googleUserEmail}>
                  {googleUserEmail}
                </span>
              )}
              <button
                type="button"
                onClick={handleBackToLogin}
                className="font-bold text-slate-600 hover:text-slate-900 cursor-pointer inline-flex items-center gap-1 py-0.5"
                id="btn-google-role-logout"
              >
                <LogOut className="w-3 h-3 text-slate-400" />
                <span>Keluar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
