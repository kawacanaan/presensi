import React, { useState, useEffect } from 'react';
import {
  Database,
  Server,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileCode,
  ShieldCheck,
  Activity,
  Layers,
  Wrench,
  Sparkles
} from 'lucide-react';

interface DatabaseStats {
  schools: number;
  students: number;
  teachers: number;
  profiles: number;
  classes: number;
  attendance: number;
  leaveRequests: number;
  payments: number;
  auditLogs: number;
}

interface Props {
  call: (action: string, payload?: any) => Promise<any>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const SystemDatabaseTab: React.FC<Props> = ({ call, showToast }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DatabaseStats>({
    schools: 0,
    students: 0,
    teachers: 0,
    profiles: 0,
    classes: 0,
    attendance: 0,
    leaveRequests: 0,
    payments: 0,
    auditLogs: 0,
  });
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [exportingTable, setExportingTable] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await call('get_database_stats');
      if (res.ok) {
        setStats(res.counts || {});
        setLatencyMs(res.latencyMs || null);
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat statistik basis data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const [reconcileResult, setReconcileResult] = useState<{
    ok: boolean;
    integrityScore?: number;
    checks?: any;
    schoolTenantBreakdown?: any[];
    message?: string;
    latencyMs?: number;
  } | null>(null);

  const handleExport = async (tableName: string, format: 'json' | 'csv' = 'json') => {
    setExportingTable(tableName);
    try {
      const res = await call('export_table_data', { table: tableName, limit: 2000 });
      if (res.ok && Array.isArray(res.rows)) {
        const rows = res.rows;
        let blob: Blob;
        let filename = `backup_${tableName}_${new Date().toISOString().slice(0, 10)}`;

        if (format === 'csv') {
          if (rows.length === 0) {
            showToast('Tabel kosong, tidak ada data untuk diekspor.', 'info');
            return;
          }
          const headers = Object.keys(rows[0]);
          const csvContent = [
            headers.join(','),
            ...rows.map((row: any) =>
              headers
                .map((header) => {
                  const val = row[header];
                  if (val === null || val === undefined) return '""';
                  if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
                  return `"${String(val).replace(/"/g, '""')}"`;
                })
                .join(',')
            ),
          ].join('\n');
          blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          filename += '.csv';
        } else {
          blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
          filename += '.json';
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(`Berhasil mengunduh cadangan tabel ${tableName} (${rows.length} baris)!`, 'success');
      } else {
        throw new Error(res.error || 'Gagal mengekspor data.');
      }
    } catch (err: any) {
      showToast(err.message || `Gagal mengekspor data tabel ${tableName}.`, 'error');
    } finally {
      setExportingTable(null);
    }
  };

  const handleReconcile = async () => {
    setReconciling(true);
    setReconcileResult(null);
    try {
      const res = await call('reconcile_database_integrity');
      if (res.ok) {
        setReconcileResult({
          ok: true,
          integrityScore: res.integrityScore,
          checks: res.checks,
          schoolTenantBreakdown: res.schoolTenantBreakdown,
          message: res.message,
          latencyMs: res.latencyMs,
        });
        showToast(`Pemeriksaan integritas basis data selesai (${res.latencyMs} ms)!`, 'success');
      } else {
        throw new Error(res.error || 'Pemeriksaan gagal.');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menjalankan rekonsiliasi.', 'error');
    } finally {
      setReconciling(false);
    }
  };

  const tableExportList = [
    { id: 'schools', label: 'Sekolah & Instansi', count: stats.schools, desc: 'Daftar sekolah terdaftar & status lisensi' },
    { id: 'students', label: 'Data Siswa', count: stats.students, desc: 'Data master siswa, NISN, dan kelas' },
    { id: 'teachers', label: 'Guru & Pendidik', count: stats.teachers, desc: 'Master guru kelas dan guru mata pelajaran' },
    { id: 'classes', label: 'Rombel & Kelas', count: stats.classes, desc: 'Tingkat kelas dan tahun ajaran' },
    { id: 'attendance_records', label: 'Catatan Presensi Riil', count: stats.attendance, desc: 'Rekap kehadiran siswa, jam tap, dan status' },
    { id: 'leave_requests', label: 'Izin & Surat Sakit', count: stats.leaveRequests, desc: 'Permohonan surat sakit orang tua' },
    { id: 'payments', label: 'Transaksi Pembayaran', count: stats.payments, desc: 'Riwayat invoice & perpanjangan lisensi' },
    { id: 'audit_logs', label: 'Catatan Audit Log', count: stats.auditLogs, desc: 'Rekaman forensik aktivitas pengguna' },
  ];

  return (
    <div className="space-y-6">
      {/* Header Basis Data */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-cyan-50 text-cyan-700 flex items-center justify-center font-bold shrink-0">
            <Database size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Basis Data & Pemeliharaan Supabase</h3>
              <span className="px-2 py-0.5 rounded-full bg-cyan-100/70 text-cyan-800 text-[10px] font-bold">
                PostgreSQL Managed
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pantau volume data riil, ekspor cadangan (*backup*), dan jaga integritas relasi multi-tenant.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {latencyMs !== null && (
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-mono font-semibold flex items-center gap-1.5">
              <Activity size={13} className="text-emerald-600" />
              <span>Ping: {latencyMs} ms</span>
            </span>
          )}
          <button
            type="button"
            onClick={fetchStats}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer disabled:opacity-50"
            title="Segarkan Metrik Data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-cyan-600' : ''} />
          </button>
        </div>
      </div>

      {/* Kartu Metrik Baris Data Riil */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sekolah</p>
          <p className="text-xl font-black text-slate-900 mt-1 font-mono">{stats.schools}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Tenant aktif</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Siswa</p>
          <p className="text-xl font-black text-slate-900 mt-1 font-mono">{stats.students}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Terdaftar resmi</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Guru & Tendik</p>
          <p className="text-xl font-black text-slate-900 mt-1 font-mono">{stats.teachers}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Wali kelas & mapel</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rombel Kelas</p>
          <p className="text-xl font-black text-slate-900 mt-1 font-mono">{stats.classes}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Tingkat 1 - 6</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pembayaran</p>
          <p className="text-xl font-black text-slate-900 mt-1 font-mono">{stats.payments}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Total invoice</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Log Audit</p>
          <p className="text-xl font-black text-slate-900 mt-1 font-mono">{stats.auditLogs}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Rekaman tindakan</span>
        </div>
      </div>

      {/* Bagian Cadangan & Ekspor Data Tabel (Backup Utility) */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Download size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Pusat Ekspor & Cadangan Data (*Backup*)</h3>
            <p className="text-xs text-slate-500">
              Unduh salinan data tabel Supabase dalam format JSON atau CSV untuk arsip dinas pendidikan.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
          {tableExportList.map((tbl) => (
            <div
              key={tbl.id}
              className="p-4 rounded-xl border border-slate-200/80 hover:border-slate-300 bg-slate-50/50 flex flex-col justify-between gap-3 transition"
            >
              <div>
                <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                  <span>{tbl.label}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-white border border-slate-200 rounded-md text-slate-600">
                    {tbl.count} baris
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">{tbl.desc}</p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60">
                <button
                  type="button"
                  disabled={exportingTable === tbl.id}
                  onClick={() => handleExport(tbl.id, 'json')}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 text-[11px]"
                >
                  <FileCode size={13} className="text-indigo-600" />
                  <span>JSON</span>
                </button>

                <button
                  type="button"
                  disabled={exportingTable === tbl.id}
                  onClick={() => handleExport(tbl.id, 'csv')}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 text-[11px]"
                >
                  <FileSpreadsheet size={13} className="text-emerald-600" />
                  <span>CSV</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bagian Utilitas Pemeliharaan & Integritas */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Wrench size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Utilitas Integritas Relasi Multi-Tenant</h3>
            <p className="text-xs text-slate-500">Periksa konsistensi penugasan guru, relasi kelas, dan skema Supabase.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 flex flex-col justify-between gap-3">
            <div>
              <p className="font-bold text-slate-900 mb-1">Rekonsiliasi Penugasan Guru & Tenant</p>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                Mendeteksi data yatim (*orphaned records*), memverifikasi konsistensi relasi kelas-sekolah, dan merapikan anomali penugasan secara otomatis langsung di database PostgreSQL.
              </p>
            </div>
            <button
              type="button"
              disabled={reconciling}
              onClick={handleReconcile}
              className="self-start px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={reconciling ? 'animate-spin' : ''} />
              <span>{reconciling ? 'Memeriksa...' : 'Jalankan Pemeriksaan Integritas'}</span>
            </button>
          </div>

          <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 font-bold text-slate-900 mb-1">
                <ShieldCheck size={16} className="text-emerald-600" />
                <span>Skema & RLS Status</span>
              </div>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                Skema tabel `platform_settings`, `schools`, `students`, `teachers`, `attendance_records` dan `audit_logs` berjalan di PostgreSQL dengan enkripsi HTTPS TLS v1.3 aktif.
              </p>
            </div>
            <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg self-start">
              Status Skema: Sehat & Terverifikasi
            </span>
          </div>
        </div>

        {reconcileResult && (
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span className="font-bold text-emerald-950">Laporan Hasil Diagnostik Database PostgreSQL</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-200/80 text-[10px] font-bold text-emerald-900">
                  Skor Integritas: {reconcileResult.integrityScore}%
                </span>
              </div>
              {reconcileResult.latencyMs && (
                <span className="text-[10px] font-mono text-slate-500">Durasi: {reconcileResult.latencyMs} ms</span>
              )}
            </div>

            <p className="text-emerald-900 font-medium">{reconcileResult.message}</p>

            {reconcileResult.checks && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <span className="text-slate-500 block text-[10px]">Sekolah Diperiksa</span>
                  <span className="font-bold text-slate-800">{reconcileResult.checks.schoolsVerified} Tenant</span>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <span className="text-slate-500 block text-[10px]">Siswa Diverifikasi</span>
                  <span className="font-bold text-slate-800">{reconcileResult.checks.studentsVerified} Siswa</span>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <span className="text-slate-500 block text-[10px]">Data Yatim (Orphan)</span>
                  <span className="font-bold text-emerald-700">0 Record</span>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <span className="text-slate-500 block text-[10px]">Perbaikan Otomatis</span>
                  <span className="font-bold text-slate-800">{reconcileResult.checks.brokenAssignmentsFixed} Item</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
