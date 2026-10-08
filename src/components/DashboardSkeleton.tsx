import React from 'react';

export const DashboardSkeleton: React.FC<{ isTeacherOrWali?: boolean }> = ({ isTeacherOrWali }) => {
  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1500px] mx-auto px-3.5 sm:px-6 lg:px-8 py-3.5 sm:py-5 space-y-3.5 sm:space-y-4 animate-pulse">
      {/* Top Title Card Skeleton */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0 space-y-2 flex-1">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-48 bg-slate-200 rounded-md" />
            <div className="h-5 w-32 bg-slate-200 rounded-full" />
          </div>
          <div className="h-3.5 w-3/4 max-w-md bg-slate-100 rounded" />
        </div>
        <div className="h-6 w-24 bg-slate-200 rounded-lg shrink-0" />
      </div>

      {/* KPI Stat Cards Skeleton */}
      {isTeacherOrWali ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-3.5 sm:p-4.5 border border-slate-200 shadow-sm flex items-center gap-3.5"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-slate-100 border border-slate-200 shrink-0" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-2.5 w-16 bg-slate-200 rounded" />
                <div className="h-6 w-12 bg-slate-200 rounded" />
                <div className="h-3 w-20 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200 shadow-sm flex items-center gap-3"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 border border-slate-200 shrink-0" />
              <div className="min-w-0 space-y-1.5 flex-1">
                <div className="h-2 w-14 bg-slate-200 rounded" />
                <div className="h-5 w-8 bg-slate-200 rounded" />
                <div className="h-2.5 w-16 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts Section Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4">
        {/* Left Chart Skeleton */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-3.5 sm:p-4.5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-slate-200 rounded" />
              <div className="h-4 w-44 bg-slate-200 rounded" />
            </div>
            <div className="h-3 w-16 bg-slate-100 rounded" />
          </div>
          <div className="h-36 sm:h-44 w-full bg-slate-50/80 rounded-xl flex items-end justify-between p-4 gap-2">
            {[40, 65, 30, 80, 55, 90, 75].map((h, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full max-w-[28px] bg-slate-200 rounded-t"
                  style={{ height: `${h}%` }}
                />
                <div className="h-2 w-6 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Right Donut Skeleton */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-3.5 sm:p-4.5 border border-slate-200 shadow-sm flex flex-col justify-between items-center text-center">
          <div className="w-full flex items-center justify-start gap-2 mb-2">
            <div className="w-4 h-4 bg-slate-200 rounded" />
            <div className="h-4 w-28 bg-slate-200 rounded" />
          </div>
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-8 border-slate-200 my-2 flex items-center justify-center">
            <div className="h-4 w-10 bg-slate-200 rounded" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-3 w-14 bg-slate-100 rounded-full" />
            ))}
          </div>
        </div>
      </div>

      {/* Agenda & Action Row Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4">
        {/* Agenda */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-3.5 sm:p-4.5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="h-4 w-32 bg-slate-200 rounded" />
            <div className="h-3 w-16 bg-slate-100 rounded" />
          </div>
          <div className="space-y-2 mt-1">
            {[1, 2].map((i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-2.5 flex items-center gap-2.5 border border-slate-100">
                <div className="w-10 h-10 rounded-lg bg-slate-200 shrink-0" />
                <div className="space-y-1 flex-1">
                  <div className="h-3 w-32 bg-slate-200 rounded" />
                  <div className="h-2.5 w-24 bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Banner */}
        <div className="lg:col-span-8 bg-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="h-5 w-48 bg-slate-300 rounded" />
            <div className="h-3.5 w-full max-w-lg bg-slate-300 rounded" />
          </div>
          <div className="flex gap-2.5 mt-4">
            <div className="h-9 w-32 bg-slate-300 rounded-xl" />
            <div className="h-9 w-28 bg-slate-300 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Menu Navigation Skeleton */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <div className="h-4 w-28 bg-slate-200 rounded" />
          <div className="h-3 w-20 bg-slate-100 rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 shadow-xs min-h-[58px]"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-100 shrink-0" />
              <div className="space-y-1 flex-1">
                <div className="h-3 w-24 bg-slate-200 rounded" />
                <div className="h-2 w-32 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const AppAuthLoadingSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col antialiased">
      {/* Header Skeleton */}
      <header className="w-full bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-6 lg:px-8 py-2.5 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl 2xl:max-w-[1500px] mx-auto flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-200 shrink-0" />
            <div className="space-y-1.5 min-w-0">
              <div className="h-4 w-36 sm:w-52 bg-slate-200 rounded-md" />
              <div className="h-2.5 w-24 bg-slate-100 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <div className="hidden md:block h-7 w-36 bg-slate-100 rounded-full" />
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-200 shrink-0" />
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-200 shrink-0" />
          </div>
        </div>
      </header>

      {/* Body Skeleton */}
      <main className="flex-1 pb-12">
        <DashboardSkeleton />
      </main>
    </div>
  );
};
