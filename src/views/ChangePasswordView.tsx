import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { KawacanaanEmblem } from '../components/KawacanaanEmblem';
import { supabase } from '../lib/supabase';
import { Lock, Eye, EyeOff, Loader2, ShieldAlert, LogOut } from 'lucide-react';

// Ditampilkan wajib (tidak bisa dilewati) saat currentUser.mustChangePassword === true,
// yaitu setelah akun baru dibuat ADMIN atau setelah ADMIN mereset password akun tersebut.
export const ChangePasswordView: React.FC = () => {
  const { currentUser, showToast, changeOwnPassword, logout } = useApp();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogout = () => {
    void logout();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (newPassword.length < 8) {
      setErrorMessage('Password baru minimal 8 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Konfirmasi password tidak sama.');
      return;
    }
    if (currentUser && (newPassword === currentUser.username)) {
      setErrorMessage('Jangan gunakan username/NISN/NIP sebagai password baru.');
      return;
    }

    setIsLoading(true);
    const result = await changeOwnPassword(newPassword);
    setIsLoading(false);
    if (!result.success) {
      setErrorMessage(result.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-lg p-6 sm:p-8">
        <div className="flex flex-col items-center text-center gap-3 mb-6">
          <KawacanaanEmblem size={44} />
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
            <ShieldAlert size={22} className="text-amber-600" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900">Ganti Password Anda</h1>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Untuk keamanan akun{currentUser?.name ? `, ${currentUser.name}` : ''}, Anda wajib
              mengganti password sebelum melanjutkan. Ini biasanya karena akun baru dibuat atau
              password Anda baru saja direset oleh ADMIN.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Password Baru</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
                className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Konfirmasi Password Baru</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {errorMessage && (
            <div className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
          >
            {isLoading && <Loader2 size={16} className="animate-spin" />}
            Simpan & Lanjutkan
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-slate-700 text-xs font-semibold py-2"
          >
            <LogOut size={13} /> Keluar dan lanjutkan nanti
          </button>
        </form>
      </div>
    </div>
  );
};
