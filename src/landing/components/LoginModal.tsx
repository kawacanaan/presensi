import React, { useState } from 'react';
import {
  signInWithGoogle,
  isSupabaseConfigured,
} from '../../lib/supabaseClient';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  UserCheck, 
  GraduationCap, 
  School, 
  ShieldCheck, 
  Users, 
  Lock, 
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { KawacanaanEmblem } from '../../components/KawacanaanEmblem';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDemo: () => void;
  lang?: 'ID' | 'EN';
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onOpenDemo, lang = 'ID' }) => {
  const { loadData, showToast } = useApp();
  const [role, setRole] = useState<'guru' | 'kepsek' | 'admin' | 'wali'>('guru');
  const [emailOrNip, setEmailOrNip] = useState('guru.kelas3@kawacanaan.sch.id');
  const [password, setPassword] = useState('••••••••');
  const [loggedInSuccess, setLoggedInSuccess] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');

  if (!isOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoggedInSuccess(true);
    setTimeout(() => {
      setLoggedInSuccess(false);
      onClose();
      onOpenDemo();
    }, 1200);
  };

  const handleRoleChange = (newRole: 'guru' | 'kepsek' | 'admin' | 'wali') => {
    setRole(newRole);
    if (newRole === 'guru') {
      setEmailOrNip('guru.kelas3@kawacanaan.sch.id');
    } else if (newRole === 'kepsek') {
      setEmailOrNip('kepsek.sd@kawacanaan.sch.id');
    } else if (newRole === 'admin') {
      setEmailOrNip('admin.sekolah@kawacanaan.sch.id');
    } else {
      setEmailOrNip('081234567890 (No WA Wali)');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white border border-slate-300 rounded-xl shadow-2xl overflow-hidden text-slate-900 p-6 space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <KawacanaanEmblem size={38} />
            <div>
              <h3 className="font-black uppercase tracking-tight text-slate-900 text-base">
                {lang === 'ID' ? 'Masuk' : 'Sign In'}
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Kawacanaan Presensi</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Selectors */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-2">
            {lang === 'ID' ? 'Pilih Peran Masuk:' : 'Select Login Role:'}
          </label>
          <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 text-center text-[10px] font-bold uppercase tracking-wider">
            <button
              type="button"
              onClick={() => handleRoleChange('guru')}
              className={`py-2 rounded transition-all cursor-pointer ${
                role === 'guru' ? 'bg-[#0B2F64] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {lang === 'ID' ? 'Guru' : 'Teacher'}
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange('kepsek')}
              className={`py-2 rounded transition-all cursor-pointer ${
                role === 'kepsek' ? 'bg-[#0B2F64] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {lang === 'ID' ? 'Kepala SD' : 'Principal'}
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange('admin')}
              className={`py-2 rounded transition-all cursor-pointer ${
                role === 'admin' ? 'bg-[#0B2F64] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {lang === 'ID' ? 'Admin/TU' : 'Admin'}
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange('wali')}
              className={`py-2 rounded transition-all cursor-pointer ${
                role === 'wali' ? 'bg-[#0B2F64] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {lang === 'ID' ? 'Wali Murid' : 'Parent'}
            </button>
          </div>
        </div>

        {loggedInSuccess ? (
          <div className="py-8 text-center space-y-2 bg-emerald-50 rounded-lg border border-emerald-300">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto animate-bounce" />
            <div className="font-bold text-emerald-950 text-sm uppercase tracking-wide">
              {lang === 'ID' ? 'Autentikasi Berhasil!' : 'Authentication Successful!'}
            </div>
            <p className="text-xs text-emerald-700">
              {lang === 'ID'
                ? `Membuka Dashboard ${role.toUpperCase()}...`
                : `Opening ${role.toUpperCase()} Dashboard...`}
            </p>
          </div>
        ) : (
          <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-bold text-[10px] uppercase tracking-wider mb-1.5">
                {role === 'wali'
                  ? (lang === 'ID' ? 'Nomor WhatsApp / NISN Siswa' : 'WhatsApp Number / Student ID')
                  : (lang === 'ID' ? 'Email Akun / NIP Guru' : 'Account Email / Teacher ID')}
              </label>
              <input
                type="text"
                required
                value={emailOrNip}
                onChange={(e) => setEmailOrNip(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3.5 py-2.5 text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-slate-700 font-bold text-[10px] uppercase tracking-wider">
                  {lang === 'ID' ? 'Kata Sandi (PIN)' : 'Password (PIN)'}
                </label>
                <a href="#reset" onClick={(e) => e.preventDefault()} className="text-blue-600 hover:underline font-bold text-[10px] uppercase tracking-wider">
                  {lang === 'ID' ? 'Lupa PIN?' : 'Forgot PIN?'}
                </a>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3.5 py-2.5 text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-hidden"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <span>{lang === 'ID' ? 'Masuk Dashboard' : 'Open Dashboard'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="relative my-3 flex items-center justify-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-3 text-[10px] uppercase font-bold text-slate-400">
                {lang === 'ID' ? 'Atau' : 'Or'}
              </span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <button
              type="button"
              onClick={async () => {
                setGoogleError('');
                if (!isSupabaseConfigured()) {
                  setGoogleError('Koneksi Supabase belum dikonfigurasi.');
                  return;
                }
                setGoogleLoading(true);
                try {
                  const res = await signInWithGoogle();
                  if (res.error) {
                    setGoogleError(res.error.message || 'Gagal masuk menggunakan Google.');
                    setGoogleLoading(false);
                    return;
                  }
                  if (res.data?.url && typeof window !== 'undefined') {
                    window.location.assign(res.data.url);
                  }
                } catch (err: any) {
                  setGoogleError(err?.message || 'Gagal masuk menggunakan Google.');
                  setGoogleLoading(false);
                }
              }}
              className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs transition-all shadow-2xs hover:shadow-xs flex items-center justify-center gap-2.5 cursor-pointer"
            >
              {googleLoading ? (
                <span className="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
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
              <span>{lang === 'ID' ? 'Lanjutkan dengan Google' : 'Continue with Google'}</span>
            </button>
            {googleError && <div className="text-center text-[10px] text-red-600 font-semibold">{googleError}</div>}

            <div className="text-center pt-2 text-[11px] text-slate-500 font-medium">
              {lang === 'ID' ? 'Belum mendaftarkan sekolah Anda?' : "Haven't registered your school yet?"}{' '}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDemo();
                }}
                className="text-blue-600 font-bold hover:underline cursor-pointer"
              >
                {lang === 'ID' ? 'Coba Demo Live' : 'Try Live Demo'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
