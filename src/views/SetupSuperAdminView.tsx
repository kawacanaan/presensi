import React from 'react';
import { ShieldAlert, Lock, ArrowLeft } from 'lucide-react';

export const SetupSuperAdminView: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f4f6fb] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/80 shadow-xl p-6 sm:p-8">
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-md">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">Setup Dinonaktifkan</h1>
            <p className="text-xs font-medium text-slate-500">Proteksi Keamanan Production</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-xs text-amber-800 mb-6 flex items-start gap-3 leading-relaxed">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            Halaman inisialisasi dan perombakan Super Admin telah ditutup secara permanen pada lingkungan production. Silakan masuk melalui halaman login utama menggunakan kredensial Super Admin resmi yang telah terdaftar.
          </div>
        </div>

        <a
          href="/"
          className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Halaman Login
        </a>
      </div>
    </div>
  );
};
