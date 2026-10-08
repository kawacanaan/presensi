import React, { useState } from 'react';
import { KawacanaanEmblem } from '../components/KawacanaanEmblem';
import { supabase } from '../lib/supabase';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export const ResetPasswordView: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (newPassword.length < 8) {
      setErrorMessage('Password baru minimal 8 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Konfirmasi password tidak sama.');
      return;
    }

    setIsLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        throw new Error(
          'Sesi reset password tidak ditemukan atau sudah kedaluwarsa. Silakan minta link reset password baru.'
        );
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      // Password sudah benar-benar tersimpan di Supabase Auth.
      // Session tetap dipertahankan, lalu aplikasi dimuat ulang agar
      // AppContext membaca profil pengguna dan membuka dashboard.
      setSuccessMessage('Password berhasil dibuat. Mengarahkan ke dashboard...');

      window.setTimeout(() => {
        window.location.assign('/');
      }, 700);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Password gagal diperbarui. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(#E2E8F0_1px,transparent_1px)] [background-size:28px_28px] opacity-60 pointer-events-none" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50/70 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-50/70 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[430px] bg-white rounded-3xl p-7 sm:p-9 shadow-xl shadow-slate-200/80 border border-slate-200/90 relative z-10">
        <div className="flex flex-col items-center text-center mb-7">
          <div className="mb-3">
            <KawacanaanEmblem size={68} />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-wide text-slate-900">
            Buat Password Baru
          </h1>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Buat password baru untuk akun Kawacanaan Anda. Setelah berhasil, Anda akan diarahkan
            kembali ke dashboard.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 leading-relaxed">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 leading-relaxed">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
            <div className="flex-1 font-medium">{successMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Password Baru
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
                autoComplete="new-password"
                autoFocus
                className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Konfirmasi Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                autoComplete="new-password"
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !!successMessage}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
          >
            {isLoading && <Loader2 size={16} className="animate-spin" />}
            Simpan Password
          </button>
        </form>
      </div>
    </div>
  );
};
