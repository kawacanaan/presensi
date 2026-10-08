import React, { useState } from 'react';
import {
  GraduationCap,
  BookOpen,
  Users,
  CreditCard,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  User,
  Building2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  X,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import waliKelasWanitaImg from '../../assets/images/wali_kelas_wanita_1789830539387.jpg';
import guruMapelPriaImg from '../../assets/images/guru_mapel_pria_1789830556851.jpg';
import { LoginCredentialCard, LoginCredentialCardData } from './LoginCredentialCard';
import { KawacanaanEmblem } from '../../components/KawacanaanEmblem';

interface FreeStartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLogin: (prefill?: { username: string; password?: string }) => void;
  onEnterSystem: () => void;
  onEnterDashboard?: () => void;
  lang: 'ID' | 'EN';
}

type RoleType = 'homeroom' | 'subject';

export const FreeStartModal: React.FC<FreeStartModalProps> = ({
  isOpen,
  onClose,
  onOpenLogin,
  onEnterSystem,
  onEnterDashboard,
  lang,
}) => {
  const { loginWithCredentials, setActiveView } = useApp();

  const handleModalClose = () => {
    if (createdCredentialData) {
      onOpenLogin({
        username: createdCredentialData.username,
        password: createdCredentialData.password,
      });
    }
    onClose();
  };

  // Wizard Steps: 1 = Pilih Peran, 2 = Formulir Identitas & Akun, 3 = Selesai & Kartu Kredensial
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedRole, setSelectedRole] = useState<RoleType>('homeroom');

  // Form Fields
  const [schoolName, setSchoolName] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameManuallyEdited, setUsernameManuallyEdited] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Submission & Error State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnteringSystem, setIsEnteringSystem] = useState(false);
  const [formError, setFormError] = useState('');
  const [createdCredentialData, setCreatedCredentialData] = useState<LoginCredentialCardData | null>(null);

  if (!isOpen) return null;

  // Auto-generate suggested username from Full Name if not manually edited
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanSchool = schoolName.trim();
    const cleanName = fullName.trim();
    const cleanUsername = username.trim().toLowerCase();

    if (!cleanSchool) {
      setFormError(lang === 'ID' ? 'Nama satuan pendidikan wajib diisi.' : 'School name is required.');
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
      const cleanEmail = email.trim().toLowerCase() || `${cleanUsername}@login.edushift.local`;

      const payload = {
        action: 'register_and_onboard',
        fullName: cleanName,
        username: cleanUsername,
        email: cleanEmail,
        password: password,
        role: payloadRole,
        mode: 'personal',
        nip: '-',
        gender: 'L',
        phone: '-',
        employmentStatus: 'PNS',
        grade: 1,
        className: 'Kelas 1',
        subjectName: selectedRole === 'subject' ? 'Guru Mata Pelajaran' : undefined,
        workspaceName: cleanSchool,
        schoolName: cleanSchool,
        schoolId: null,
      };

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || (!data.ok && !data.success)) {
        throw new Error(data.error || (lang === 'ID' ? 'Pendaftaran gagal. Silakan coba lagi.' : 'Registration failed.'));
      }

      // Bersihkan cache lama
      try {
        localStorage.removeItem('kawacanaan_cached_school_ws');
        localStorage.removeItem('kawacanaan_last_workspace_id');
        localStorage.setItem('kawacanaan_last_registered_name', cleanName);
        localStorage.setItem('kawacanaan_last_registered_school', cleanSchool);
        localStorage.setItem('kawacanaan_last_registered_role', payloadRole);
        if (data.userId && data.schoolId) {
          localStorage.setItem(`kawacanaan_last_workspace_id_${data.userId}`, data.schoolId);
          const personalWs = {
            id: `ws-mem-${data.userId}-${data.schoolId}`,
            userId: data.userId,
            workspaceId: data.schoolId,
            workspaceCode: null,
            role: payloadRole,
            workspaceName: cleanSchool,
            workspaceType: 'personal',
            registrationMode: 'personal',
            npsn: null,
            subscriptionPlan: 'mulai',
            joinedAt: new Date().toISOString(),
          };
          localStorage.setItem(`kawacanaan_school_ws_${data.userId}`, JSON.stringify(personalWs));
        }
      } catch (_) {}

      // Siapkan data kredensial untuk ditampilkan pada kartu kredensial login
      const credentialPayload: LoginCredentialCardData = {
        workspaceType: 'personal',
        schoolName: cleanSchool,
        personInCharge: `${cleanName} (${selectedRole === 'homeroom' ? 'Wali Kelas' : 'Guru Mapel'})`,
        username: cleanUsername,
        password: password,
        schoolCode: data.schoolCode || data.workspaceCode || 'MANDIRI-FREE',
        expiryDateText: 'Aktif Selamanya',
        nominalText: 'GRATIS (Rp 0)',
        paymentMethodText: 'Pendaftaran Mandiri Otomatis',
        invoiceNo: `INV-FREE-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`,
      };

      setCreatedCredentialData(credentialPayload);
      setStep(3);
    } catch (err: any) {
      setFormError(err.message || (lang === 'ID' ? 'Terjadi kesalahan pada sistem.' : 'A system error occurred.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDirectLogin = async () => {
    if (!createdCredentialData) return;
    setIsEnteringSystem(true);
    try {
      const cleanEmail = email.trim().toLowerCase() || `${createdCredentialData.username}@login.edushift.local`;
      const loginResult = await loginWithCredentials(createdCredentialData.username, createdCredentialData.password);
      if (!loginResult.success) {
        const retryEmailResult = await loginWithCredentials(cleanEmail, createdCredentialData.password);
        if (!retryEmailResult.success) {
          onOpenLogin({
            username: createdCredentialData.username,
            password: createdCredentialData.password,
          });
          onClose();
          return;
        }
      }

      setActiveView('dashboard');
      if (onEnterDashboard) {
        onEnterDashboard();
      } else if (onEnterSystem) {
        onEnterSystem();
      } else {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('page');
          window.history.pushState(null, '', url.pathname + (url.search ? url.search : ''));
        } catch (_) {}
      }
      onClose();
    } catch (err) {
      console.error(err);
      if (createdCredentialData) {
        onOpenLogin({
          username: createdCredentialData.username,
          password: createdCredentialData.password,
        });
      } else {
        onOpenLogin();
      }
      onClose();
    } finally {
      setIsEnteringSystem(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl md:max-w-2xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden my-auto animate-in zoom-in-95 duration-200 flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[90vh]">
        
        {/* ========================================================================= */}
        {/* TOP HEADER: Brand Logo Kawacanaan & Stepper 1 Pilih Peran 2 Buat Akun    */}
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

          {/* Stepper & Close Button */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Stepper Indicator: 1 Pilih Peran -> 2 Buat Akun -> 3 Kredensial */}
            <div className="flex items-center gap-1 sm:gap-1.5 text-xs">
              <div className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${
                step === 1 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'bg-blue-50 text-blue-700 border border-blue-200/70'
              }`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] ${
                  step === 1 ? 'bg-white text-blue-600 font-black' : 'bg-blue-600 text-white font-bold'
                }`}>
                  {step > 1 ? '✓' : '1'}
                </span>
                <span className="hidden xs:inline">{lang === 'ID' ? 'Peran' : 'Role'}</span>
              </div>

              <span className="text-slate-300 font-bold text-[10px] sm:text-xs">→</span>

              <div className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${
                step === 2 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : step > 2
                  ? 'bg-blue-50 text-blue-700 border border-blue-200/70'
                  : 'bg-slate-100 text-slate-400'
              }`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] ${
                  step === 2 ? 'bg-white text-blue-600 font-black' : step > 2 ? 'bg-blue-600 text-white font-bold' : 'bg-slate-300 text-white font-bold'
                }`}>
                  {step > 2 ? '✓' : '2'}
                </span>
                <span className="hidden xs:inline">{lang === 'ID' ? 'Akun' : 'Account'}</span>
              </div>

              <span className="text-slate-300 font-bold text-[10px] sm:text-xs">→</span>

              <div className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${
                step === 3 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'bg-slate-100 text-slate-400'
              }`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] ${
                  step === 3 ? 'bg-white text-emerald-600 font-black' : 'bg-slate-300 text-white font-bold'
                }`}>
                  3
                </span>
                <span>{lang === 'ID' ? 'Kredensial' : 'Credentials'}</span>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={handleModalClose}
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
          {/* LANGKAH 1: PILIH PERAN (URUTAN 1)                                         */}
          {/* ========================================================================= */}
          {step === 1 && (
            <div>
              {/* Minimalist Heading */}
              <div className="mb-3.5 sm:mb-5">
                <h2 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight">
                  {lang === 'ID' ? 'Pilih Peran Pendidik' : 'Select Your Educator Role'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {lang === 'ID' 
                    ? 'Pilih modul presensi yang sesuai dengan tugas mengajar Anda di sekolah.' 
                    : 'Choose the attendance module that fits your teaching assignment.'}
                </p>
              </div>

              {/* Two Role Selection Cards - Responsive for Mobile & Desktop */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                
                {/* KARTU 1: WALI KELAS */}
                <div 
                  className="bg-white border border-slate-200 hover:border-blue-500 rounded-xl sm:rounded-2xl p-3 sm:p-4 relative flex flex-col justify-between shadow-2xs hover:shadow-md transition-all duration-150 group"
                >
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
                          {lang === 'ID' ? 'Wali Kelas' : 'Homeroom Teacher'}
                        </h3>
                        <p className="text-[11px] font-semibold text-blue-600 mt-0.5 truncate">
                          {lang === 'ID' ? 'Presensi Harian Kelas SD' : 'Class Attendance & Recap'}
                        </p>
                      </div>
                    </div>

                    {/* Brief Description */}
                    <p className="text-xs text-slate-600 mt-2.5 leading-relaxed line-clamp-2 sm:line-clamp-none">
                      {lang === 'ID'
                        ? 'Kelola presensi seluruh siswa satu kelas, rekap bulanan otomatis, dan cetak format kedinasan.'
                        : 'Manage daily attendance for your classroom students, monthly recaps, and official reports.'}
                    </p>

                    {/* Feature Badges */}
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
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
                    id="btn-choose-homeroom"
                    className="mt-3.5 sm:mt-4 w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold py-2.5 px-3.5 rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer text-xs min-h-[44px]"
                  >
                    <span>{lang === 'ID' ? 'Pilih Wali Kelas' : 'Select Homeroom'}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>

                {/* KARTU 2: GURU MAPEL */}
                <div 
                  className="bg-white border border-slate-200 hover:border-emerald-500 rounded-xl sm:rounded-2xl p-3 sm:p-4 relative flex flex-col justify-between shadow-2xs hover:shadow-md transition-all duration-150 group"
                >
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
                          {lang === 'ID' ? 'Guru Mapel' : 'Subject Teacher'}
                        </h3>
                        <p className="text-[11px] font-semibold text-emerald-600 mt-0.5 truncate">
                          {lang === 'ID' ? 'Presensi Jam Pelajaran SD' : 'Subject Attendance & Journal'}
                        </p>
                      </div>
                    </div>

                    {/* Brief Description */}
                    <p className="text-xs text-slate-600 mt-2.5 leading-relaxed line-clamp-2 sm:line-clamp-none">
                      {lang === 'ID'
                        ? 'Catat kehadiran per jam pelajaran (PJOK, PAI, dll), kelola multi-rombel, dan jurnal mengajar.'
                        : 'Record attendance by subject periods, manage multiple classroom groups, and teaching journals.'}
                    </p>

                    {/* Feature Badges */}
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
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
                    id="btn-choose-subject"
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
                  <span>{lang === 'ID' ? 'Data tersimpan aman & tanpa kartu kredit' : 'Secure data storage & no credit card required'}</span>
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
          {/* LANGKAH 2: FORMULIR BUAT AKUN (URUTAN 2)                                  */}
          {/* ========================================================================= */}
          {step === 2 && (
            <div className="max-w-lg mx-auto">
              {/* Back to Step 1 & Selected Role Banner */}
              <div className="flex items-center justify-between gap-3 pb-3 mb-3.5 border-b border-slate-100">
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

                <div className="flex items-center gap-1.5">
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
                </div>
              </div>

              {/* Title Header */}
              <div className="mb-4 sm:mb-5">
                <h3 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
                  {lang === 'ID' ? 'Buat Akun Pendidik Anda' : 'Create Your Educator Account'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {lang === 'ID'
                    ? 'Lengkapi data akun untuk langsung mengakses Ruang Kerja digital gratis.'
                    : 'Fill in your details to immediately access your free digital workspace.'}
                </p>
              </div>

              {/* Error Alert Banner */}
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-start gap-2 mb-4">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span className="font-semibold leading-tight">{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {/* Nama Satuan Pendidikan & Nama Lengkap Berdampingan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Kolom 1: Nama Satuan Pendidikan */}
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
                        id="input-free-schoolname"
                      />
                    </div>
                  </div>

                  {/* Kolom 2: Nama Lengkap */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Nama Lengkap <span className="text-rose-500">*</span>
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
                        id="input-free-fullname"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Username */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Username <span className="text-rose-500">*</span>
                    </label>
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
                      id="input-free-username"
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
                        placeholder="nama@sekolah.sch.id"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium text-slate-900 bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition-all h-11"
                        id="input-free-email"
                      />
                    </div>
                  </div>
                </div>

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
                        id="input-free-password"
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
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Konfirmasi Sandi <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Ketik ulang sandi"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium text-slate-900 bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition-all h-11"
                        id="input-free-confirm-password"
                      />
                    </div>
                  </div>
                </div>

                {/* Tombol Simpan & Masuk */}
                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-xs sm:text-sm uppercase tracking-wider transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer min-h-[46px]"
                    id="btn-submit-free-registration"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>{lang === 'ID' ? 'Menyiapkan Ruang Kerja...' : 'Setting up Workspace...'}</span>
                      </>
                    ) : (
                      <>
                        <span>
                          {lang === 'ID'
                            ? 'Selesaikan Pendaftaran'
                            : 'Complete Registration'}
                        </span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>

                {/* Tautan kembali ke Login jika sudah memiliki akun */}
                <div className="pt-2 text-center text-xs text-slate-500 font-medium">
                  <span>{lang === 'ID' ? 'Sudah memiliki akun? ' : 'Already have an account? '}</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenLogin(username ? { username } : undefined);
                    }}
                    className="font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    {lang === 'ID' ? 'Masuk di sini' : 'Sign in here'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* LANGKAH 3: TAHAP SELESAI & KARTU KREDENSIAL LOGIN (SESUAI GAMBAR ACUAN)    */}
          {/* ========================================================================= */}
          {step === 3 && createdCredentialData && (
            <div className="space-y-4 py-2 animate-in fade-in zoom-in-95 duration-200">
              <div className="text-center space-y-1.5 max-w-md mx-auto">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span>{lang === 'ID' ? 'Pendaftaran Berhasil & Aktif' : 'Registration Successful'}</span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  {lang === 'ID' ? 'Kartu Kredensial Ruang Kerja Anda' : 'Your Workspace Credential Card'}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {lang === 'ID'
                    ? 'Simpan atau unduh kartu kredensial login resmi Anda di bawah ini sebagai bukti pendaftaran & akses portal.'
                    : 'Save or download your official login credential card below for secure portal access.'}
                </p>
              </div>

              {/* Komponen Kartu Kredensial Login 480 × 300 px */}
              <LoginCredentialCard
                data={createdCredentialData}
                onEnterSystem={handleDirectLogin}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
