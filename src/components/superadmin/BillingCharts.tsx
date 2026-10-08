import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Wallet,
  Building,
  CreditCard,
  QrCode,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  ChevronRight,
  Headphones,
  Download,
  SlidersHorizontal,
  FileSpreadsheet,
  AlertTriangle
} from 'lucide-react';

/**
 * 1. Sparkline Mini Chart for KPI Cards
 */
export const MiniSparkline: React.FC<{
  type: 'blue' | 'green' | 'red' | 'teal';
  className?: string;
}> = ({ type, className = "w-20 h-8" }) => {
  const configs = {
    blue: {
      stroke: '#3B82F6',
      fill: 'url(#sparkGradBlue)',
      d: 'M 0 24 Q 15 22 25 15 T 45 18 T 65 8 T 80 4',
      area: 'M 0 24 Q 15 22 25 15 T 45 18 T 65 8 T 80 4 L 80 32 L 0 32 Z',
      gradId: 'sparkGradBlue',
      gradColor: '#3B82F6',
    },
    green: {
      stroke: '#10B981',
      fill: 'url(#sparkGradGreen)',
      d: 'M 0 26 Q 15 20 28 22 T 50 12 T 68 14 T 80 5',
      area: 'M 0 26 Q 15 20 28 22 T 50 12 T 68 14 T 80 5 L 80 32 L 0 32 Z',
      gradId: 'sparkGradGreen',
      gradColor: '#10B981',
    },
    red: {
      stroke: '#F43F5E',
      fill: 'url(#sparkGradRed)',
      d: 'M 0 22 Q 18 25 32 16 T 52 20 T 66 10 T 80 6',
      area: 'M 0 22 Q 18 25 32 16 T 52 20 T 66 10 T 80 6 L 80 32 L 0 32 Z',
      gradId: 'sparkGradRed',
      gradColor: '#F43F5E',
    },
    teal: {
      stroke: '#06B6D4',
      fill: 'url(#sparkGradTeal)',
      d: 'M 0 25 Q 16 18 30 20 T 52 10 T 68 12 T 80 4',
      area: 'M 0 25 Q 16 18 30 20 T 52 10 T 68 12 T 80 4 L 80 32 L 0 32 Z',
      gradId: 'sparkGradTeal',
      gradColor: '#06B6D4',
    },
  };

  const c = configs[type];

  return (
    <div className={`shrink-0 select-none ${className}`}>
      <svg viewBox="0 0 80 32" fill="none" className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id={c.gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.gradColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={c.gradColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={c.area} fill={c.fill} />
        <path d={c.d} stroke={c.stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

/**
 * 2. Interactive 6-Month Revenue & Arrears Trend Line Chart
 * Computes trend dynamically from real payments in database
 */
export const RevenueTrendChart: React.FC<{ payments?: any[] }> = ({ payments = [] }) => {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  const months = useMemo(() => {
    const now = new Date();
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mIdx = d.getMonth();
      const y = d.getFullYear();
      const monthShort = d.toLocaleDateString('id-ID', { month: 'short' });
      const label = `${monthShort} ${y}`;

      let revenue = 0;
      let arrears = 0;

      (payments || []).forEach((p: any) => {
        const rawDate = p.createdAt || p.created_at;
        if (!rawDate) return;
        const pDate = new Date(rawDate);
        if (pDate.getFullYear() === y && pDate.getMonth() === mIdx) {
          const amt = Number(p.totalAmount || p.total_amount || p.amount || 0);
          const isSettled = p.status === 'SETTLED' || p.status === 'paid';
          const isPending = p.status === 'PENDING' || p.status === 'pending';
          if (isSettled) revenue += amt;
          else if (isPending) arrears += amt;
        }
      });

      const formatShort = (val: number) => {
        if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(1).replace('.0', '')} jt`;
        if (val >= 1000) return `Rp ${(val / 1000).toFixed(0)} rb`;
        return `Rp ${val.toLocaleString('id-ID')}`;
      };

      result.push({
        label,
        revenue,
        revenueFormatted: formatShort(revenue),
        arrears,
        arrearsFormatted: formatShort(arrears),
        x: 45 + (5 - i) * 80,
      });
    }
    return result;
  }, [payments]);

  // Max value calculation based on real data
  const maxRecorded = Math.max(...months.map(m => Math.max(m.revenue, m.arrears)), 0);
  const maxVal = maxRecorded > 0 ? Math.ceil((maxRecorded * 1.3) / 10000) * 10000 : 250000;

  const getY = (val: number) => {
    const ratio = Math.min(1, Math.max(0, val / maxVal));
    return 180 - ratio * 160;
  };

  const revenuePoints = months.map(m => ({ x: m.x, y: getY(m.revenue) }));
  const arrearsPoints = months.map(m => ({ x: m.x, y: getY(m.arrears) }));

  const createSmoothPath = (pts: { x: number; y: number }[]) => {
    return pts.reduce((acc, pt, i, arr) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      const prev = arr[i - 1];
      const cpX1 = prev.x + (pt.x - prev.x) / 2;
      const cpY1 = prev.y;
      const cpX2 = prev.x + (pt.x - prev.x) / 2;
      const cpY2 = pt.y;
      return `${acc} C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${pt.x} ${pt.y}`;
    }, '');
  };

  const revenueLinePath = createSmoothPath(revenuePoints);
  const arrearsLinePath = createSmoothPath(arrearsPoints);
  const revenueAreaPath = `${revenueLinePath} L ${months[months.length - 1].x} 180 L ${months[0].x} 180 Z`;

  // Total efficiency metric
  const totalSettledCount = payments.filter((p: any) => p.status === 'SETTLED' || p.status === 'paid').length;
  const totalValidCount = payments.length;
  const efficiencyRate = totalValidCount > 0 ? Math.round((totalSettledCount / totalValidCount) * 100) : 100;

  const yLabels = [
    { label: maxVal >= 1000000 ? `${(maxVal / 1000000).toFixed(0)} jt` : `${(maxVal / 1000).toFixed(0)} rb`, val: maxVal },
    { label: maxVal * 0.75 >= 1000000 ? `${(maxVal * 0.75 / 1000000).toFixed(1)} jt` : `${(maxVal * 0.75 / 1000).toFixed(0)} rb`, val: maxVal * 0.75 },
    { label: maxVal * 0.5 >= 1000000 ? `${(maxVal * 0.5 / 1000000).toFixed(1)} jt` : `${(maxVal * 0.5 / 1000).toFixed(0)} rb`, val: maxVal * 0.5 },
    { label: maxVal * 0.25 >= 1000000 ? `${(maxVal * 0.25 / 1000000).toFixed(1)} jt` : `${(maxVal * 0.25 / 1000).toFixed(0)} rb`, val: maxVal * 0.25 },
    { label: '0', val: 0 },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 flex flex-col justify-between h-full">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Tren Pembayaran 6 Bulan Terakhir</h3>
            <p className="text-[11px] text-slate-400">Total penerimaan vs tagihan belum dibayar</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3.5 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-100" />
            <span className="text-slate-600 text-[11px]">Total Pembayaran</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-100" />
            <span className="text-slate-600 text-[11px]">Tunggakan</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-hidden mt-3 pt-2">
        <svg
          viewBox="0 0 500 215"
          className="w-full h-auto overflow-visible select-none text-[10px]"
          fill="none"
        >
          <defs>
            <linearGradient id="chartRevenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Grid lines & Y-Axis labels */}
          {yLabels.map((grid, i) => {
            const y = getY(grid.val);
            return (
              <g key={i}>
                <text x="32" y={y + 3.5} textAnchor="end" fill="#94A3B8" className="font-medium text-[9.5px]">
                  {grid.label}
                </text>
                <line
                  x1="45"
                  y1={y}
                  x2="475"
                  y2={y}
                  stroke="#F1F5F9"
                  strokeWidth="1"
                  strokeDasharray={i === yLabels.length - 1 ? "none" : "3 3"}
                />
              </g>
            );
          })}

          {/* Shaded Area under Blue Curve */}
          <path d={revenueAreaPath} fill="url(#chartRevenueGrad)" />

          {/* Orange Curve: Tunggakan */}
          <path
            d={arrearsLinePath}
            stroke="#F59E0B"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Blue Curve: Total Pembayaran */}
          <path
            d={revenueLinePath}
            stroke="#3B82F6"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points and Interactivity */}
          {months.map((m, idx) => {
            const ry = getY(m.revenue);
            const ay = getY(m.arrears);
            const isHovered = hoveredMonth === idx;

            return (
              <g
                key={idx}
                className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => setHoveredMonth(idx)}
                onMouseLeave={() => setHoveredMonth(null)}
              >
                {/* Vertical hover guide bar */}
                {isHovered && (
                  <line
                    x1={m.x}
                    y1={15}
                    x2={m.x}
                    y2={180}
                    stroke="#94A3B8"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    opacity="0.8"
                  />
                )}

                {/* X-Axis Label */}
                <text
                  x={m.x}
                  y="200"
                  textAnchor="middle"
                  fill={isHovered ? "#1E293B" : "#64748B"}
                  className={`font-semibold transition-colors ${isHovered ? 'text-[10.5px] font-bold' : 'text-[9.5px]'}`}
                >
                  {m.label}
                </text>

                {/* Orange Dot */}
                <circle
                  cx={m.x}
                  cy={ay}
                  r={isHovered ? 5.5 : 4}
                  fill="#FFFFFF"
                  stroke="#F59E0B"
                  strokeWidth={isHovered ? 3 : 2}
                  className="transition-all duration-150 drop-shadow-xs"
                />

                {/* Blue Dot */}
                <circle
                  cx={m.x}
                  cy={ry}
                  r={isHovered ? 6 : 4.5}
                  fill="#FFFFFF"
                  stroke="#3B82F6"
                  strokeWidth={isHovered ? 3.5 : 2.5}
                  className="transition-all duration-150 drop-shadow-xs"
                />

                {/* Tooltip on hover */}
                {isHovered && (
                  <g>
                    <rect
                      x={Math.max(10, Math.min(380, m.x - 55))}
                      y={Math.max(10, ry - 46)}
                      width="120"
                      height="38"
                      rx="6"
                      fill="#0F172A"
                      className="drop-shadow-lg"
                    />
                    <text
                      x={Math.max(10, Math.min(380, m.x - 55)) + 8}
                      y={Math.max(10, ry - 46) + 15}
                      fill="#93C5FD"
                      className="text-[9px] font-bold"
                    >
                      ● Masuk: {m.revenueFormatted}
                    </text>
                    <text
                      x={Math.max(10, Math.min(380, m.x - 55)) + 8}
                      y={Math.max(10, ry - 46) + 29}
                      fill="#FCD34D"
                      className="text-[9px] font-bold"
                    >
                      ● Tunggak: {m.arrearsFormatted}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="pt-2 mt-2 border-t border-slate-50 flex items-center justify-between text-[11px] text-slate-500">
        <span>Periode Berjalan Tahun Ajaran 2026/2027</span>
        <span className="text-emerald-600 font-bold flex items-center gap-1">
          <ArrowUpRight size={13} /> {efficiencyRate}% Efisiensi Penagihan Lunas
        </span>
      </div>
    </div>
  );
};

/**
 * 3. Donut Chart for Payment Methods
 * Dynamically computed from payments table in Supabase
 */
export const PaymentMethodDonut: React.FC<{ payments?: any[] }> = ({ payments = [] }) => {
  const { methods, totalCount } = useMemo(() => {
    let transfer = 0;
    let va = 0;
    let qris = 0;
    let ewallet = 0;
    let other = 0;

    payments.forEach((p: any) => {
      const m = String(p.paymentMethod || p.payment_method || '').toLowerCase();
      if (m.includes('qris')) qris++;
      else if (m.includes('va') || m.includes('virtual') || m.includes('bca') || m.includes('bri') || m.includes('bni') || m.includes('mandiri')) va++;
      else if (m.includes('wallet') || m.includes('gopay') || m.includes('ovo') || m.includes('dana') || m.includes('shopee')) ewallet++;
      else if (m.includes('transfer') || m.includes('bank') || m.includes('manual') || m.includes('direct') || m.includes('superadmin')) transfer++;
      else if (m) other++;
      else transfer++;
    });

    const total = payments.length;
    if (total === 0) {
      return {
        totalCount: 0,
        methods: [
          { label: 'Transfer Bank', pct: 0, count: 0, color: '#3B82F6', dotClass: 'bg-blue-500' },
          { label: 'Virtual Account', pct: 0, count: 0, color: '#10B981', dotClass: 'bg-emerald-500' },
          { label: 'QRIS', pct: 0, count: 0, color: '#8B5CF6', dotClass: 'bg-purple-500' },
          { label: 'E-Wallet', pct: 0, count: 0, color: '#F59E0B', dotClass: 'bg-amber-500' },
        ],
      };
    }

    const calcPct = (cnt: number) => Math.round((cnt / total) * 1000) / 10;
    return {
      totalCount: total,
      methods: [
        { label: 'Transfer Bank', pct: calcPct(transfer), count: transfer, color: '#3B82F6', dotClass: 'bg-blue-500' },
        { label: 'Virtual Account', pct: calcPct(va), count: va, color: '#10B981', dotClass: 'bg-emerald-500' },
        { label: 'QRIS', pct: calcPct(qris), count: qris, color: '#8B5CF6', dotClass: 'bg-purple-500' },
        { label: 'E-Wallet / Lain', pct: calcPct(ewallet + other), count: ewallet + other, color: '#F59E0B', dotClass: 'bg-amber-500' },
      ],
    };
  }, [payments]);

  // Circumference of radius 52 is 2 * PI * 52 ≈ 326.7
  const circumference = 326.7;

  const seg1 = ((methods[0]?.pct || 0) / 100) * circumference;
  const seg2 = ((methods[1]?.pct || 0) / 100) * circumference;
  const seg3 = ((methods[2]?.pct || 0) / 100) * circumference;
  const seg4 = ((methods[3]?.pct || 0) / 100) * circumference;

  const offset1 = 0;
  const offset2 = -seg1;
  const offset3 = -(seg1 + seg2);
  const offset4 = -(seg1 + seg2 + seg3);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <PieChart size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Metode Pembayaran</h3>
            <p className="text-[11px] text-slate-400">Distribusi kanal transaksi nyata</p>
          </div>
        </div>
      </div>

      {/* Donut & Legend Container */}
      <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-2">
        {/* SVG Donut Graphic */}
        <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
          <svg viewBox="0 0 130 130" className="w-full h-full -rotate-90">
            {/* Background ring */}
            <circle
              cx="65"
              cy="65"
              r="52"
              fill="transparent"
              stroke="#F1F5F9"
              strokeWidth="16"
            />
            {totalCount > 0 ? (
              <>
                {/* Segment 1: Transfer Bank */}
                {seg1 > 0 && (
                  <circle
                    cx="65"
                    cy="65"
                    r="52"
                    fill="transparent"
                    stroke="#3B82F6"
                    strokeWidth="16"
                    strokeDasharray={`${seg1} ${circumference - seg1}`}
                    strokeDashoffset={offset1}
                    strokeLinecap="round"
                  />
                )}
                {/* Segment 2: Virtual Account */}
                {seg2 > 0 && (
                  <circle
                    cx="65"
                    cy="65"
                    r="52"
                    fill="transparent"
                    stroke="#10B981"
                    strokeWidth="16"
                    strokeDasharray={`${seg2} ${circumference - seg2}`}
                    strokeDashoffset={offset2}
                    strokeLinecap="round"
                  />
                )}
                {/* Segment 3: QRIS */}
                {seg3 > 0 && (
                  <circle
                    cx="65"
                    cy="65"
                    r="52"
                    fill="transparent"
                    stroke="#8B5CF6"
                    strokeWidth="16"
                    strokeDasharray={`${seg3} ${circumference - seg3}`}
                    strokeDashoffset={offset3}
                    strokeLinecap="round"
                  />
                )}
                {/* Segment 4: E-Wallet */}
                {seg4 > 0 && (
                  <circle
                    cx="65"
                    cy="65"
                    r="52"
                    fill="transparent"
                    stroke="#F59E0B"
                    strokeWidth="16"
                    strokeDasharray={`${seg4} ${circumference - seg4}`}
                    strokeDashoffset={offset4}
                    strokeLinecap="round"
                  />
                )}
              </>
            ) : null}
          </svg>

          {/* Center Hole Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none select-none">
            <span className="text-xl font-black text-slate-900 tracking-tight leading-none">{totalCount}</span>
            <span className="text-[10px] font-semibold text-slate-400 mt-0.5">Transaksi</span>
          </div>
        </div>

        {/* Legend Right / Bottom */}
        <div className="w-full sm:w-auto space-y-2.5 text-xs">
          {methods.map((m, idx) => (
            <div key={idx} className="flex items-center justify-between sm:justify-start gap-4">
              <div className="flex items-center gap-2 min-w-[110px]">
                <span className={`w-2.5 h-2.5 rounded-full ${m.dotClass}`} />
                <span className="font-medium text-slate-700 text-[11px] truncate">{m.label}</span>
              </div>
              <span className="font-black text-slate-900 text-xs">
                {m.pct}% ({m.count})
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-2 mt-2 border-t border-slate-50 flex items-center justify-between text-[11px] text-slate-400">
        <span>Kanal pembayaran terverifikasi</span>
        <span className="font-semibold text-blue-600">
          Data riil Supabase
        </span>
      </div>
    </div>
  );
};

/**
 * 4. Aksi Cepat (Quick Actions)
 * - Buat Tagihan
 * - Lihat Semua Transaksi
 * - Laporan Keuangan
 * - Pengaturan Metode Pembayaran
 */
export const BillingQuickActions: React.FC<{
  onOpenCreateBill: () => void;
  onViewAllTransactions: () => void;
  onOpenFinancialReport: () => void;
  onOpenPaymentSettings: () => void;
}> = ({
  onOpenCreateBill,
  onViewAllTransactions,
  onOpenFinancialReport,
  onOpenPaymentSettings
}) => {
  const actions = [
    {
      id: 'create-bill',
      title: 'Buat Tagihan',
      desc: 'Generate tagihan baru',
      icon: FileText,
      iconBg: 'bg-blue-50 text-blue-600',
      onClick: onOpenCreateBill,
    },
    {
      id: 'view-all',
      title: 'Lihat Semua Transaksi',
      desc: 'Riwayat pembayaran',
      icon: Wallet,
      iconBg: 'bg-emerald-50 text-emerald-600',
      onClick: onViewAllTransactions,
    },
    {
      id: 'report',
      title: 'Laporan Keuangan',
      desc: 'Download laporan',
      icon: Download,
      iconBg: 'bg-purple-50 text-purple-600',
      onClick: onOpenFinancialReport,
    },
    {
      id: 'settings',
      title: 'Pengaturan Metode Pembayaran',
      desc: 'Kelola metode & rekening',
      icon: SlidersHorizontal,
      iconBg: 'bg-amber-50 text-amber-600',
      onClick: onOpenPaymentSettings,
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2">
        <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <Clock size={16} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Aksi Cepat</h3>
          <p className="text-[11px] text-slate-400">Pintasan operasional billing</p>
        </div>
      </div>

      {/* 4 Action Buttons */}
      <div className="space-y-2 my-auto py-1">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.id}
              type="button"
              onClick={act.onClick}
              className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-slate-50/80 transition-all duration-150 cursor-pointer group text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-xl ${act.iconBg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                  <Icon size={17} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                    {act.title}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    {act.desc}
                  </div>
                </div>
              </div>

              <ChevronRight size={15} className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
            </button>
          );
        })}
      </div>

      <div className="pt-2 border-t border-slate-50 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Integrasi Midtrans Otomatis</span>
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
      </div>
    </div>
  );
};

/**
 * 5. Feed Aktivitas Terbaru & Widget Bantuan (Right Sidebar Column)
 */
export const RecentActivitiesFeed: React.FC<{
  payments?: any[];
  onOpenSupport: () => void;
  onViewAllActivities: () => void;
}> = ({ payments = [], onOpenSupport, onViewAllActivities }) => {
  const activities = useMemo(() => {
    if (!payments || payments.length === 0) {
      return [];
    }

    return payments.slice(0, 5).map((p: any) => {
      const isSettled = p.status === 'SETTLED' || p.status === 'paid';
      const isPending = p.status === 'PENDING' || p.status === 'pending';
      const amt = Number(p.totalAmount || p.total_amount || p.amount || 0);
      const rawDate = p.paidAt || p.paid_at || p.createdAt || p.created_at;
      const d = rawDate ? new Date(rawDate) : new Date();
      const timeStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

      if (isSettled) {
        return {
          id: p.id || String(Math.random()),
          title: 'Pembayaran Lunas',
          subtitle: `${p.schoolName || p.school_name || 'Sekolah'} - ${p.planName || 'Paket Pro'}`,
          amount: `Rp ${amt.toLocaleString('id-ID')}`,
          time: timeStr,
          type: 'success',
          icon: CheckCircle2,
          color: 'bg-emerald-50 text-emerald-600',
        };
      }

      if (isPending) {
        return {
          id: p.id || String(Math.random()),
          title: 'Menunggu Pembayaran',
          subtitle: `${p.schoolName || p.school_name || 'Sekolah'} - ${p.invoiceNo || p.invoice_no || 'Tagihan'}`,
          amount: `Rp ${amt.toLocaleString('id-ID')}`,
          time: timeStr,
          type: 'warning',
          icon: Clock,
          color: 'bg-amber-50 text-amber-600',
        };
      }

      return {
        id: p.id || String(Math.random()),
        title: 'Transaksi Dibatalkan / Expired',
        subtitle: `${p.schoolName || p.school_name || 'Sekolah'} - ${p.invoiceNo || p.invoice_no || ''}`,
        amount: amt > 0 ? `Rp ${amt.toLocaleString('id-ID')}` : '',
        time: timeStr,
        type: 'danger',
        icon: AlertTriangle,
        color: 'bg-rose-50 text-rose-600',
      };
    });
  }, [payments]);

  return (
    <div className="space-y-4">
      {/* Aktivitas Terbaru Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">Aktivitas Terbaru</h3>
          </div>
          <button
            type="button"
            onClick={onViewAllActivities}
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
          >
            Lihat Semua &gt;
          </button>
        </div>

        {/* Activity Items List */}
        {activities.length > 0 ? (
          <div className="divide-y divide-slate-100 space-y-2">
            {activities.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="pt-2.5 first:pt-0 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-xl ${item.color} flex items-center justify-center shrink-0 mt-0.5`}>
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate leading-snug">
                        {item.title}
                      </div>
                      <div className="text-[10.5px] text-slate-400 truncate mt-0.5">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {item.amount && (
                      <div className={`text-[11px] font-bold ${item.type === 'danger' ? 'text-rose-600' : 'text-slate-800'}`}>
                        {item.amount}
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                      {item.time}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center text-slate-400">
            <Clock size={24} className="mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-medium">Belum ada riwayat aktivitas transaksi.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Data pembayaran akan tercatat otomatis di sini.</p>
          </div>
        )}
      </div>

      {/* Widget Butuh Bantuan? */}
      <div
        onClick={onOpenSupport}
        className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50/80 border border-blue-100 flex items-center justify-between cursor-pointer hover:shadow-xs hover:border-blue-200 transition-all duration-150 group select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Headphones size={18} />
          </div>
          <div>
            <div className="text-xs font-black text-slate-900">
              Butuh bantuan?
            </div>
            <div className="text-[11px] text-blue-600 font-medium group-hover:underline mt-0.5 flex items-center gap-1">
              <span>Tim support siap membantu</span>
              <span className="font-bold">&gt;</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
