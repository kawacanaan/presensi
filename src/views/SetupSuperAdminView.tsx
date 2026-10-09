import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, ArrowLeft, KeyRound, User, Mail, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export const SetupSuperAdminView: React.FC = () => {
  const [secret, setSecret] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('Super Admin Platform');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusChecking, setStatusChecking] = useState(true);
  const [hasExistingSuperAdmin, setHasExistingSuperAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/setup-superadmin')
      .then((r) => r.json())
      .then((data) => {
        if (isMounted) {
          setHasExistingSuperAdmin(Boolean(data?.hasSuperAdmin));
          setStatusChecking(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setStatusChecking(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret || !email || !password) {
      setError('Harap isi Setup Secret, Email, dan Password.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/setup-superadmin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Superadmin-Secret': secret.trim(),
        },
        body: JSON.stringify({
          secret: secret.trim(),
          email: email.trim().toLowerCase(),
          name: name.trim() || 'Super Admin Platform',
          password: password,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Gagal memproses setup Super Admin.');
      }

      setSuccess('Akun Super Admin berhasil dikonfigurasi! Anda sekarang dapat masuk.');
      setHasExistingSuperAdmin(true);
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f6fb] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/80 shadow-xl p-6 sm:p-8">
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-md">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">Setup Super Admin</h1>
            <p className="text-xs font-medium text-slate-500">Inisialisasi & Otorisasi Platform</p>
          </div>
        </div>

        {statusChecking ? (
          <div className="py-8 flex flex-col items-center justify-center gap-3 text-slate-500 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span>Memeriksa status konfigurasi...</span>
          </div>
        ) : (
          <>
            {hasExistingSuperAdmin && !success && (
              <div className="p-3.5 mb-5 rounded-2xl bg-blue-50 border border-blue-200/80 text-xs text-blue-900 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  Super Admin aktif telah terdeteksi pada database. Anda dapat menggunakan form ini dengan kunci <strong>SUPERADMIN_SETUP_SECRET</strong> untuk memperbarui kredensial atau menyetel akun Super Admin baru.
                </div>
              </div>
            )}

            {error && (
              <div className="p-3.5 mb-5 rounded-2xl bg-rose-50 border border-rose-200/80 text-xs text-rose-800 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            {success ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-sm mb-1">Berhasil!</strong>
                    {success}
                  </div>
                </div>
                <a
                  href="/"
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Masuk ke Halaman Login
                </a>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-slate-500" /> Setup Secret (SUPERADMIN_SETUP_SECRET)
                  </label>
                  <input
                    type="password"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder="Masukkan kunci setup rahasia"
                    required
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Kunci ini dikonfigurasi di Cloudflare Dashboard / Worker Secrets.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-500" /> Email Super Admin
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="superadmin@sekolah.id"
                    required
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" /> Nama Lengkap
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Super Admin Platform"
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-500" /> Password Baru
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 8 karakter"
                    required
                    minLength={8}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Memproses Setup...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-emerald-400" /> Konfigurasi Akun Super Admin
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <a href="/" className="hover:text-slate-900 font-semibold flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Ke Halaman Login
              </a>
              <span className="text-[11px] text-slate-400 font-mono">v1.0 • Cloudflare Worker</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
