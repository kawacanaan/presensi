import React, { useState } from 'react';

/**
 * Mini Sparkline SVG for the top 5 metric cards
 */
export const MetricSparkline: React.FC<{
  color: 'blue' | 'purple' | 'emerald' | 'amber' | 'rose';
  className?: string;
}> = ({ color, className = 'w-20 h-8' }) => {
  const colorMap = {
    blue: { stroke: '#3B82F6', fill: '#DBEAFE' },
    purple: { stroke: '#A855F7', fill: '#F3E8FF' },
    emerald: { stroke: '#10B981', fill: '#D1FAE5' },
    amber: { stroke: '#F59E0B', fill: '#FEF3C7' },
    rose: { stroke: '#F43F5E', fill: '#FFE4E6' },
  };

  const c = colorMap[color] || colorMap.blue;

  return (
    <div className={`overflow-hidden select-none pointer-events-none ${className}`}>
      <svg viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
          <linearGradient id={`sparkGrad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.fill} stopOpacity="0.8" />
            <stop offset="100%" stopColor={c.fill} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path
          d="M 0 32 Q 20 36, 35 24 T 65 28 T 85 14 L 100 12 L 100 40 L 0 40 Z"
          fill={`url(#sparkGrad-${color})`}
        />
        <path
          d="M 0 32 Q 20 36, 35 24 T 65 28 T 85 14 L 100 12"
          fill="none"
          stroke={c.stroke}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

/**
 * 7-Day System Activity Multi-Line Smooth Chart
 * Responsive curve lines, axes and styling fitted for side-by-side dashboard view.
 */
export interface SystemActivity7Days {
  dates: string[];
  login: number[];
  attendance: number[];
  transaction: number[];
}

export const ActivityChart: React.FC<{
  className?: string;
  activityData?: SystemActivity7Days;
}> = ({ className = '', activityData }) => {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'login' | 'attendance' | 'transaction'>('all');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // 7 Hari Terakhir (Dinamis berbasis kalender lokal atau data API)
  const defaultDates = React.useMemo(() => {
    const result: string[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      result.push(
        d.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
        })
      );
    }
    return result;
  }, []);

  const dates = activityData?.dates && activityData.dates.length === 7 ? activityData.dates : defaultDates;
  const loginData = activityData?.login && activityData.login.length === 7 ? activityData.login : [0, 0, 0, 0, 0, 0, 0];
  const attendanceData = activityData?.attendance && activityData.attendance.length === 7 ? activityData.attendance : [0, 0, 0, 0, 0, 0, 0];
  const transactionData = activityData?.transaction && activityData.transaction.length === 7 ? activityData.transaction : [0, 0, 0, 0, 0, 0, 0];

  // SVG coordinate transformation for compact side-by-side card
  const chartW = 460;
  const chartH = 135;
  const startX = 42;
  const startY = 12;

  // Hitung batas atas skala (maxVal) dinamis dari data riil
  const rawMax = Math.max(
    ...loginData,
    ...attendanceData,
    ...transactionData,
    0
  );
  let maxVal = 10;
  if (rawMax <= 10) maxVal = 10;
  else if (rawMax <= 25) maxVal = 25;
  else if (rawMax <= 50) maxVal = 50;
  else if (rawMax <= 100) maxVal = 100;
  else if (rawMax <= 250) maxVal = 250;
  else if (rawMax <= 500) maxVal = 500;
  else if (rawMax <= 1000) maxVal = 1000;
  else maxVal = Math.ceil(rawMax / 500) * 500;

  const yTicks = [
    maxVal,
    Math.round(maxVal * 0.75),
    Math.round(maxVal * 0.5),
    Math.round(maxVal * 0.25),
    0,
  ];

  const getX = (index: number) => startX + (index / (dates.length - 1)) * chartW;
  const getY = (val: number) => startY + chartH - (val / maxVal) * chartH;

  const buildPath = (data: number[]) => {
    return data.reduce((acc, val, i, arr) => {
      const x = getX(i);
      const y = getY(val);
      if (i === 0) return `M ${x} ${y}`;
      const prevX = getX(i - 1);
      const prevY = getY(arr[i - 1]);
      const cp1x = prevX + (x - prevX) / 2;
      const cp1y = prevY;
      const cp2x = prevX + (x - prevX) / 2;
      const cp2y = y;
      return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x} ${y}`;
    }, '');
  };

  const loginPath = buildPath(loginData);
  const attendancePath = buildPath(attendanceData);
  const transactionPath = buildPath(transactionData);

  const loginArea = `${loginPath} L ${getX(dates.length - 1)} ${startY + chartH} L ${getX(0)} ${startY + chartH} Z`;

  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-xs p-4 sm:p-5 flex flex-col justify-between ${className}`}>
      {/* Header & Filter Controls */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight">
              Aktivitas Sistem 7 Hari Terakhir
            </h3>
            <p className="text-[11px] text-slate-400">
              Monitoring login, presensi, &amp; transaksi
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value as any)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value="all">Semua Aktivitas</option>
              <option value="login">Hanya Login</option>
              <option value="attendance">Hanya Presensi</option>
              <option value="transaction">Hanya Transaksi</option>
            </select>
          </div>
        </div>

        {/* Legend Indicators */}
        <div className="flex items-center gap-3.5 mt-2.5 text-xs font-semibold text-slate-600">
          {(selectedFilter === 'all' || selectedFilter === 'login') && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
              <span className="text-[11px]">Login</span>
            </div>
          )}
          {(selectedFilter === 'all' || selectedFilter === 'attendance') && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-[11px]">Presensi</span>
            </div>
          )}
          {(selectedFilter === 'all' || selectedFilter === 'transaction') && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
              <span className="text-[11px]">Transaksi</span>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Chart Area */}
      <div className="relative mt-2.5 w-full h-[185px] sm:h-[195px]">
        <svg
          viewBox="0 0 520 185"
          className="w-full h-full overflow-visible"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="loginAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid Lines & Y-Axis Labels */}
          {yTicks.map((val) => {
            const y = getY(val);
            return (
              <g key={val}>
                <line
                  x1={startX}
                  y1={y}
                  x2={startX + chartW}
                  y2={y}
                  stroke="#F1F5F9"
                  strokeWidth="1.2"
                />
                <text
                  x={startX - 6}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="9.5"
                  fontWeight="600"
                  fill="#94A3B8"
                >
                  {val === 0 ? '0' : val.toLocaleString('id-ID')}
                </text>
              </g>
            );
          })}

          {/* Area Fill under Login line */}
          {(selectedFilter === 'all' || selectedFilter === 'login') && (
            <path d={loginArea} fill="url(#loginAreaGrad)" />
          )}

          {/* Wave Lines */}
          {(selectedFilter === 'all' || selectedFilter === 'login') && (
            <path
              d={loginPath}
              fill="none"
              stroke="#3B82F6"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}

          {(selectedFilter === 'all' || selectedFilter === 'attendance') && (
            <path
              d={attendancePath}
              fill="none"
              stroke="#10B981"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          )}

          {(selectedFilter === 'all' || selectedFilter === 'transaction') && (
            <path
              d={transactionPath}
              fill="none"
              stroke="#A855F7"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          )}

          {/* X-Axis Labels */}
          {dates.map((date, i) => {
            const x = getX(i);
            const isHovered = hoverIndex === i;
            return (
              <g key={date}>
                <text
                  x={x}
                  y={startY + chartH + 16}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight={isHovered ? '700' : '500'}
                  fill={isHovered ? '#1E293B' : '#94A3B8'}
                >
                  {date}
                </text>

                {/* Invisible Hover Hitbox for column */}
                <rect
                  x={x - chartW / dates.length / 2}
                  y={startY}
                  width={chartW / dates.length}
                  height={chartH + 20}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoverIndex(i)}
                />
              </g>
            );
          })}

          {/* Active Hover Guide Line and Dots */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={startY}
                x2={getX(hoverIndex)}
                y2={startY + chartH}
                stroke="#94A3B8"
                strokeDasharray="3 3"
                strokeWidth="1.2"
              />

              {/* Login Dot */}
              <circle
                cx={getX(hoverIndex)}
                cy={getY(loginData[hoverIndex])}
                r="4"
                fill="#3B82F6"
                stroke="#FFFFFF"
                strokeWidth="2"
                className="drop-shadow-xs"
              />

              {/* Attendance Dot */}
              <circle
                cx={getX(hoverIndex)}
                cy={getY(attendanceData[hoverIndex])}
                r="4"
                fill="#10B981"
                stroke="#FFFFFF"
                strokeWidth="2"
                className="drop-shadow-xs"
              />

              {/* Transaction Dot */}
              <circle
                cx={getX(hoverIndex)}
                cy={getY(transactionData[hoverIndex])}
                r="4"
                fill="#A855F7"
                stroke="#FFFFFF"
                strokeWidth="2"
                className="drop-shadow-xs"
              />
            </g>
          )}
        </svg>

        {/* Floating Tooltip when hovered */}
        {hoverIndex !== null && (
          <div
            className="absolute -top-3 pointer-events-none bg-slate-900/90 backdrop-blur-xs text-white text-[10px] px-2.5 py-1.5 rounded-lg shadow-lg z-20 transition-all font-mono"
            style={{
              left: `${(getX(hoverIndex) / 520) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-bold text-slate-200 border-b border-slate-700/80 pb-0.5 mb-1">
              {dates[hoverIndex]}
            </div>
            <div className="text-blue-400">Login: {loginData[hoverIndex].toLocaleString('id-ID')}</div>
            <div className="text-emerald-400">Presensi: {attendanceData[hoverIndex].toLocaleString('id-ID')}</div>
            <div className="text-purple-400">Transaksi: {transactionData[hoverIndex].toLocaleString('id-ID')}</div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Tenant Distribution Donut Chart
 * Matching the exact circular donut layout + legend on the right side from reference image.
 */
export const TenantDonutChart: React.FC<{
  onViewAll?: () => void;
  schools?: any[];
}> = ({ onViewAll, schools = [] }) => {
  // 4 items matching reference image
  const tenants = [
    { name: 'SDN KAWUNG LUWUK', count: 1, color: '#3B82F6' },
    { name: 'SD Uji Keamanan', count: 2, color: '#10B981' },
    { name: 'SMPN 1', count: 1, color: '#06B6D4' },
    { name: 'SMA 1', count: 1, color: '#8B5CF6' },
  ];

  const total = tenants.reduce((acc, t) => acc + t.count, 0);

  // SVG Donut calculation
  const size = 130;
  const center = size / 2;
  const radius = 45;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-50">
        <h3 className="text-sm font-black text-slate-900 tracking-tight">
          Distribusi Tenant (Sekolah)
        </h3>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 transition cursor-pointer"
          >
            Lihat Semua &gt;
          </button>
        )}
      </div>

      {/* Chart and Legend Row */}
      <div className="flex items-center justify-between gap-4 my-auto pt-3">
        {/* Donut Circle */}
        <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
          <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
            {tenants.map((t, i) => {
              const percent = t.count / total;
              const strokeDasharray = `${percent * circumference} ${circumference}`;
              const strokeDashoffset = -accumulatedPercent * circumference;
              accumulatedPercent += percent;

              return (
                <circle
                  key={t.name}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="transparent"
                  stroke={t.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-300 hover:opacity-85 cursor-pointer"
                />
              );
            })}
          </svg>

          {/* Center text in donut */}
          <div className="absolute inset-0 flex flex-col items-center justify-center select-none pointer-events-none">
            <span className="text-2xl font-black text-slate-900 leading-none">{total}</span>
            <span className="text-[10px] font-semibold text-slate-400 mt-1">Tenant Aktif</span>
          </div>
        </div>

        {/* Legend List on the right */}
        <div className="flex-1 space-y-2.5 min-w-0">
          {tenants.map((t) => (
            <div key={t.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: t.color }}
                />
                <span className="text-slate-700 font-bold truncate max-w-[110px]" title={t.name}>
                  {t.name}
                </span>
              </div>
              <span className="text-slate-500 font-bold font-mono ml-2 shrink-0">{t.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Service Summary Donut Chart for Schools Management View
 * Matches the reference image: Donut with 49 Total Sekolah and status breakdown.
 */
export const ServiceSummaryDonutChart: React.FC<{
  activeCount?: number;
  inactiveCount?: number;
  attentionCount?: number;
  totalCount?: number;
}> = ({
  activeCount = 42,
  inactiveCount = 4,
  attentionCount = 5,
  totalCount = 49,
}) => {
  const total = totalCount || activeCount + inactiveCount + attentionCount || 1;

  const data = [
    { label: 'Aktif', count: activeCount, color: '#10B981', pct: ((activeCount / total) * 100).toFixed(1) },
    { label: 'Nonaktif', count: inactiveCount, color: '#64748B', pct: ((inactiveCount / total) * 100).toFixed(1) },
    { label: 'Perlu Perhatian', count: attentionCount, color: '#F59E0B', pct: ((attentionCount / total) * 100).toFixed(1) },
  ];

  const size = 120;
  const center = size / 2;
  const radius = 42;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      {/* Donut Circle */}
      <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
          {data.map((item) => {
            const percent = item.count / total;
            const strokeDasharray = `${percent * circumference} ${circumference}`;
            const strokeDashoffset = -accumulatedPercent * circumference;
            accumulatedPercent += percent;

            return (
              <circle
                key={item.label}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-300 hover:opacity-85"
              />
            );
          })}
        </svg>

        {/* Center text in donut */}
        <div className="absolute inset-0 flex flex-col items-center justify-center select-none pointer-events-none">
          <span className="text-xl font-black text-slate-900 leading-none">{total}</span>
          <span className="text-[9px] font-semibold text-slate-400 mt-0.5">Total Sekolah</span>
        </div>
      </div>

      {/* Legend on the right */}
      <div className="flex-1 space-y-2 min-w-0 pl-1">
        {data.map((item) => (
          <div key={item.label} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-slate-700 font-semibold truncate text-[11px]">{item.label}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-bold text-slate-900 text-xs">{item.count}</span>
              <span className="text-[10px] text-slate-400 w-9 text-right font-mono">{item.pct.replace('.', ',')}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Package Distribution Progress Bar for Schools Management View
 * Matches the reference image: Gratis, Basic, Pro, Enterprise with horizontal bars.
 */
export const PackageDistributionBarChart: React.FC<{
  distribution?: {
    gratis: number;
    basic: number;
    pro: number;
  };
}> = ({
  distribution = { gratis: 21, basic: 17, pro: 11 },
}) => {
  const total = distribution.gratis + distribution.basic + distribution.pro || 1;

  const packages = [
    { label: 'Gratis', count: distribution.gratis, color: 'bg-sky-400', barColor: '#38BDF8' },
    { label: 'Paket Guru', count: distribution.basic, color: 'bg-blue-500', barColor: '#3B82F6' },
    { label: 'Paket Sekolah', count: distribution.pro, color: 'bg-purple-500', barColor: '#A855F7' },
  ];

  return (
    <div className="space-y-2.5 pt-2">
      {packages.map((pkg) => {
        const pct = ((pkg.count / total) * 100);
        return (
          <div key={pkg.label} className="flex items-center gap-3 text-xs">
            <div className="w-20 font-medium text-slate-600 text-[11px] flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pkg.barColor }} />
              <span>{pkg.label}</span>
            </div>
            <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(pct, 4)}%`,
                  backgroundColor: pkg.barColor,
                }}
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0 text-right w-14 justify-end">
              <span className="font-bold text-slate-800 text-xs">{pkg.count}</span>
              <span className="text-[10px] text-slate-400 font-mono">
                {pct.toFixed(1).replace('.', ',')}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
