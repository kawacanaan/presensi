import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Activity,
  LogIn,
  AlertTriangle,
  Search,
  RefreshCw,
  Clock,
  User,
  Building2,
  FileText,
  Filter,
  CheckCircle2,
  XCircle,
  Database,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Download
} from 'lucide-react';

export type AuditFilterType = 'all' | 'auth' | 'critical' | 'data_change';

const filterPills: { id: AuditFilterType; label: string; countKey?: string }[] = [
  { id: 'all', label: 'Semua Log' },
  { id: 'auth', label: 'Autentikasi / Login' },
  { id: 'critical', label: 'Tindakan Kritis' },
  { id: 'data_change', label: 'Perubahan Data' },
];

export const SecuritySection: React.FC<{
  call: any;
  showToast: any;
  activeFilter?: AuditFilterType;
}> = ({ call, showToast, activeFilter = 'all' }) => {
  const [filter, setFilter] = useState<AuditFilterType>(activeFilter);
  const [logs, setLogs] = useState<any[]>([]);
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [auditRes, loginRes] = await Promise.all([
        call('audit', { limit: 200 }),
        call('login_history', { limit: 100 }).catch(() => ({ history: [] })),
      ]);
      setLogs(auditRes.logs || []);
      setLoginHistory(loginRes.history || []);
    } catch (e: any) {
      showToast(e.message || 'Gagal memuat log keamanan & audit.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Klasifikasi log menjadi kategori
  const isAuthLog = (action: string) => {
    const act = (action || '').toUpperCase();
    return act.includes('LOGIN') || act.includes('LOGOUT') || act.includes('AUTH') || act.includes('SESSION') || act.includes('PASSWORD');
  };

  const isCriticalLog = (action: string) => {
    const act = (action || '').toUpperCase();
    return (
      act.includes('DELETE') ||
      act.includes('SUSPEND') ||
      act.includes('PAYMENT') ||
      act.includes('APPROVE') ||
      act.includes('SETTLED') ||
      act.includes('RESET') ||
      act.includes('CONFIG') ||
      act.includes('BROADCAST') ||
      act.includes('ANNOUNCEMENT')
    );
  };

  const isDataChangeLog = (action: string) => {
    const act = (action || '').toUpperCase();
    return (
      act.includes('CREATE') ||
      act.includes('UPDATE') ||
      act.includes('ASSIGN') ||
      act.includes('IMPORT') ||
      act.includes('STATUS') ||
      act.includes('EXTEND')
    );
  };

  // Filter gabungan
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const act = log.action || '';
      if (filter === 'auth' && !isAuthLog(act)) return false;
      if (filter === 'critical' && !isCriticalLog(act)) return false;
      if (filter === 'data_change' && !isDataChangeLog(act)) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (log.actor_name || log.actor_username || '').toLowerCase().includes(q) ||
        (log.actor_role || '').toLowerCase().includes(q) ||
        (log.school_name || '').toLowerCase().includes(q) ||
        (log.action || '').toLowerCase().includes(q) ||
        (log.ip_address || '').toLowerCase().includes(q) ||
        JSON.stringify(log.details || {}).toLowerCase().includes(q)
      );
    });
  }, [logs, filter, search]);

  const counts = useMemo(() => {
    let auth = 0;
    let critical = 0;
    let dataChange = 0;
    logs.forEach((l) => {
      const act = l.action || '';
      if (isAuthLog(act)) auth++;
      if (isCriticalLog(act)) critical++;
      if (isDataChangeLog(act)) dataChange++;
    });
    return { all: logs.length, auth, critical, dataChange };
  }, [logs]);

  const getActionBadgeColor = (action: string) => {
    const act = (action || '').toUpperCase();
    if (act.includes('DELETE') || act.includes('SUSPEND') || act.includes('FAIL')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (act.includes('APPROVE') || act.includes('SETTLED') || act.includes('CREATE') || act.includes('SUCCESS')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (act.includes('LOGIN') || act.includes('AUTH')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (act.includes('UPDATE') || act.includes('CONFIG') || act.includes('EXTEND')) {
      return 'bg-amber-50 text-amber-800 border-amber-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const handleExportAuditLogs = () => {
    if (filteredLogs.length === 0) {
      showToast('Tidak ada data audit untuk diekspor.', 'info');
      return;
    }
    const headers = ['ID', 'Waktu', 'Aktor', 'Role', 'Sekolah', 'Aksi', 'IP', 'Detail'];
    const csvRows = filteredLogs.map((l) => [
      `"${l.id || ''}"`,
      `"${l.created_at || ''}"`,
      `"${(l.actor_name || l.actor_username || '').replace(/"/g, '""')}"`,
      `"${l.actor_role || ''}"`,
      `"${(l.school_name || '').replace(/"/g, '""')}"`,
      `"${l.action || ''}"`,
      `"${l.ip_address || ''}"`,
      `"${JSON.stringify(l.details || {}).replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${filter}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Berhasil mengekspor ${filteredLogs.length} baris log audit!`, 'success');
  };

  return (
    <div className="space-y-4">
      {/* Bar Filter Terpadu & Pencarian */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {filterPills.map((pill) => {
            const isActive = filter === pill.id;
            const count =
              pill.id === 'all'
                ? counts.all
                : pill.id === 'auth'
                ? counts.auth
                : pill.id === 'critical'
                ? counts.critical
                : counts.dataChange;

            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setFilter(pill.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
              >
                <span>{pill.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                    isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-600 font-mono'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Pencarian & Tombol Refresh & Export */}
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari aktor, IP, aksi, detail..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-600"
            />
          </div>

          <button
            type="button"
            onClick={handleExportAuditLogs}
            title="Ekspor CSV log ini"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer shrink-0"
          >
            <Download size={15} />
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            title="Muat ulang data audit"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer shrink-0 disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-indigo-600' : ''} />
          </button>
        </div>
      </div>

      {/* 1 Tabel Audit Terpadu */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <RefreshCw size={24} className="animate-spin text-indigo-600 mb-2" />
            <span className="text-xs font-semibold">Memuat rekaman log audit forensik...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            Tidak ada catatan log audit yang sesuai dengan filter atau kata kunci pencarian.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50/80">
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Pelaku (Aktor)</th>
                  <th className="py-3 px-4">Sekolah / Instansi</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Tindakan (Aksi)</th>
                  <th className="py-3 px-4">Perubahan Data / Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log, i) => {
                  const logKey = log.id || i;
                  const isExpanded = expandedLogId === logKey;
                  const detailsStr = log.details ? JSON.stringify(log.details, null, 2) : '-';

                  return (
                    <React.Fragment key={logKey}>
                      <tr className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                          {log.created_at ? new Date(log.created_at).toLocaleString('id-ID') : '-'}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">
                            {log.actor_name || log.actor_username || 'Super Admin'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {log.actor_role || 'SUPER_ADMIN'}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {log.school_name ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50/70 px-2 py-0.5 rounded-md text-[11px] border border-indigo-100">
                              <Building2 size={11} />
                              <span>{log.school_name}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Sistem Platform</span>
                          )}
                        </td>

                        <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                          {log.ip_address || log.details?.ip || '127.0.0.1'}
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${getActionBadgeColor(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>

                        <td className="py-3 px-4 max-w-xs">
                          {log.details ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setExpandedLogId(isExpanded ? null : logKey)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded cursor-pointer transition"
                              >
                                <span>{isExpanded ? 'Tutup Rincian' : 'Lihat Rincian'}</span>
                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              </button>
                              <span className="text-[11px] text-slate-400 truncate max-w-[180px]">
                                {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>
                      </tr>

                      {/* Expandable JSON Detail */}
                      {isExpanded && (
                        <tr className="bg-slate-900 text-slate-100">
                          <td colSpan={6} className="p-4">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold text-slate-400">
                              <span>Detail Payload Perubahan Data:</span>
                              <span className="font-mono text-[10px]">ID: {log.id || '-'}</span>
                            </div>
                            <pre className="mt-2 text-[11px] font-mono text-indigo-300 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-48">
                              {detailsStr}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
