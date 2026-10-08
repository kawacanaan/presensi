import React from 'react';
import { SecuritySection } from './SecuritySection';
import { ShieldCheck, Lock, KeyRound, AlertCircle } from 'lucide-react';

interface Props {
  call: (action: string, payload?: any) => Promise<any>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const SystemSecurityTab: React.FC<Props> = ({ call, showToast }) => {
  return (
    <div className="space-y-6">
      {/* Kartu Header Keamanan & Audit Trail */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold shrink-0">
            <ShieldCheck size={22} className="text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Pusat Keamanan & Audit Trail Forensik</h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                RLS Protected
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pantau seluruh riwayat login, tindakan administratif, dan perubahan status langganan sekolah secara real-time.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
            <Lock size={13} className="text-indigo-600" />
            <span>Sesi Super Admin Aktif</span>
          </span>
        </div>
      </div>

      {/* Komponen Log Keamanan Terpadu */}
      <SecuritySection call={call} showToast={showToast} activeFilter="all" />
    </div>
  );
};
