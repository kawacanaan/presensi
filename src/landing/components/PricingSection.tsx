import React, { useState } from 'react';
import { 
  Check, 
  Sparkles, 
  QrCode, 
  ArrowRight, 
  ShieldCheck, 
  Building2, 
  User, 
  Users, 
  CreditCard,
  Headphones,
  RefreshCw,
  Star,
  Zap,
  Globe
} from 'lucide-react';
import { formatRupiah } from '../../utils/packageSystem';

export type BillingCycle = 'monthly' | 'yearly';
export type PlanIdType = 'free' | 'teacher' | 'school';

interface PricingSectionProps {
  onOpenRegister: (planId?: PlanIdType, billingCycle?: BillingCycle) => void;
  lang: 'ID' | 'EN';
  customPackagesConfig?: any;
}

export const PricingSection: React.FC<PricingSectionProps> = ({ onOpenRegister, lang, customPackagesConfig }) => {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [activeMobilePlan, setActiveMobilePlan] = useState<PlanIdType>('school');
  const isId = lang === 'ID';

  const scrollToPlan = (id: PlanIdType) => {
    setActiveMobilePlan(id);
    const el = document.getElementById(`pricing-card-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  };

  // Ambil data harga dari customPackagesConfig (Super Admin) jika tersedia, atau gunakan default
  const freeConfig = customPackagesConfig?.guru_gratis;
  const teacherConfig = customPackagesConfig?.guru_pro;
  const schoolConfig = customPackagesConfig?.sekolah_pro;

  // Harga Bulanan & Tahunan
  const teacherMonthlyPrice = teacherConfig?.hargaBulanan ?? teacherConfig?.harga ?? 5000;
  const teacherYearlyPrice = teacherConfig?.hargaTahunan ?? 60000;

  const schoolMonthlyPrice = schoolConfig?.hargaBulanan ?? schoolConfig?.harga ?? 25000;
  const schoolYearlyRegularPrice = schoolConfig?.hargaTahunan ?? 300000;
  const schoolYearlyEffectivePrice = schoolConfig?.hargaTahunanPerdana ?? 250000;

  const plans = [
    // -------------------------------------------------------------
    // 1. PAKET GRATIS (Ruang Kerja Individu / Guru)
    // -------------------------------------------------------------
    {
      id: 'free' as const,
      name: isId ? 'Paket Gratis' : 'Free Plan',
      workspaceType: isId ? 'Ruang Kerja Individu' : 'Personal Workspace',
      workspaceIcon: User,
      price: 'Rp0',
      period: isId ? '/selamanya' : '/lifetime',
      originalPrice: null,
      savingsBadge: null,
      subNote: null,
      tagline: isId
        ? 'Akses dasar mandiri untuk 1 guru mengelola presensi harian 1 rombel tanpa biaya.'
        : 'Basic self-service access for 1 teacher to manage 1 class cohort with zero fees.',
      highlight: false,
      badge: null,
      features: freeConfig?.fitur && freeConfig.fitur.length > 0 ? freeConfig.fitur : [
        isId ? '1 Akun Guru (Wali Kelas Mandiri)' : '1 Teacher Account (Homeroom)',
        isId ? 'Maksimal 50 Siswa SD' : 'Up to 50 Elementary Students',
        isId ? '1 Rombongan Belajar / Kelas' : '1 Class Cohort',
        isId ? 'Presensi Pagi & Rekap Bulanan' : 'Daily Morning Check-in & Monthly Recap',
        isId ? 'Unduh Format Spreadsheet (Excel)' : 'Download Spreadsheet Recap (Excel)',
        isId ? 'Aktif Selamanya (Tanpa Expired)' : 'Active Forever (No Expiration)'
      ],
      ctaText: isId ? 'Mulai Gratis Sekarang' : 'Start for Free',
      paymentNote: isId ? 'TANPA KARTU KREDIT / RP0' : 'NO CREDIT CARD REQUIRED',
    },

    // -------------------------------------------------------------
    // 2. PAKET GURU (Ruang Kerja Individu Pro)
    // -------------------------------------------------------------
    {
      id: 'teacher' as const,
      name: isId ? 'Paket Guru' : 'Teacher Plan',
      workspaceType: isId ? 'Ruang Kerja Individu' : 'Teacher Workspace',
      workspaceIcon: Users,
      price: billingCycle === 'monthly'
        ? formatRupiah(teacherMonthlyPrice)
        : formatRupiah(teacherYearlyPrice),
      period: billingCycle === 'monthly'
        ? (isId ? '/bulan' : '/month')
        : (isId ? '/tahun' : '/year'),
      originalPrice: null,
      savingsBadge: billingCycle === 'yearly'
        ? (isId ? 'Aktif 1 Tahun Penuh' : 'Full 1 Year Access')
        : null,
      subNote: null,
      tagline: isId
        ? 'Solusi lengkap bagi wali kelas atau guru mapel yang mengajar beberapa rombel belajar.'
        : 'Complete solution for homeroom or subject specialist teachers managing multiple classes.',
      highlight: false,
      isPopular: true,
      badge: isId ? 'Paling Populer' : 'Most Popular',
      features: teacherConfig?.fitur && teacherConfig.fitur.length > 0 ? teacherConfig.fitur : [
        isId ? 'Semua Fitur Paket Gratis' : 'All Free Plan Features',
        isId ? 'Wali Kelas: 1 Rombel (50 Siswa)' : 'Homeroom: 1 Class (50 Students)',
        isId ? 'Guru Mapel: s/d 6 Rombel (300 Siswa)' : 'Subject Teacher: up to 6 Classes (300 Students)',
        isId ? 'Presensi Jam Mata Pelajaran' : 'Subject Schedule Check-in',
        isId ? 'Cetak Laporan Format Kedinasan' : 'Print Official Kedinasan Format',
        isId ? 'Ekspor Rekap Semester PDF & Excel' : 'Semester PDF & Excel Recap Export',
        isId ? 'Bantuan Teknis Cepat via WhatsApp' : 'Fast WhatsApp Technical Support'
      ],
      ctaText: isId ? 'Pilih Paket Guru' : 'Select Teacher Plan',
      paymentNote: isId ? 'QRIS / REAL-TIME SETTLEMENT' : 'QRIS / REAL-TIME SETTLEMENT',
    },

    // -------------------------------------------------------------
    // 3. PAKET SEKOLAH (Ruang Kerja Sekolah / Institusi)
    // -------------------------------------------------------------
    {
      id: 'school' as const,
      name: isId ? 'Paket Sekolah' : 'School Plan',
      workspaceType: isId ? 'Ruang Kerja Sekolah (Institusi)' : 'School Workspace (Full)',
      workspaceIcon: Building2,
      price: billingCycle === 'monthly'
        ? formatRupiah(schoolMonthlyPrice)
        : formatRupiah(schoolYearlyEffectivePrice),
      period: billingCycle === 'monthly'
        ? (isId ? '/bulan' : '/month')
        : (isId ? '/tahun' : '/year'),
      originalPrice: billingCycle === 'yearly'
        ? formatRupiah(schoolYearlyRegularPrice)
        : null,
      savingsBadge: billingCycle === 'yearly'
        ? (isId ? 'Hemat 2 Bulan' : 'Save 2 Months')
        : null,
      subNote: billingCycle === 'yearly'
        ? (isId ? 'Catatan: Pembelian perdana Rp250.000 (hemat 2 bulan). Perpanjangan tahun berikutnya: Rp300.000/thn.' : 'Special note: First purchase Rp250,000 (save 2 months). Annual renewal: Rp300,000/yr.')
        : null,
      tagline: isId
        ? 'Sistem presensi terpadu 1 sekolah dasar, kepala sekolah, operator, seluruh guru & siswa.'
        : 'Integrated attendance system for entire school, principal, operator, all teachers & students.',
      highlight: true,
      badge: isId ? 'Rekomendasi Utama Sekolah' : 'Primary School Recommendation',
      features: schoolConfig?.fitur && schoolConfig.fitur.length > 0 ? schoolConfig.fitur : [
        isId ? 'Seluruh Fitur Terbuka Penuh' : 'All Features Fully Unlocked',
        isId ? 'Hingga 100 Guru & Tenaga Kependidikan' : 'Up to 100 Teachers & School Staff',
        isId ? 'Hingga 24 Rombel Kelas 1–6 (Maks 50 Siswa/Kelas)' : 'Up to 24 Classes 1 to 6 (Max 50 Students/Class)',
        isId ? 'Kapasitas hingga 1.200 Siswa SD' : 'Capacity up to 1,200 Students',
        isId ? 'Perhitungan Hari Efektif Kalender' : 'Automatic Effective Days Calculation',
        isId ? 'Cetak Format Kedinasan & Kop Resmi' : 'Official Printable Kedinasan Reports',
        isId ? 'Portal Siswa & Pengajuan Izin Daring' : 'Student & Parent Online Leave Portal',
        isId ? 'Bantuan Migrasi & Unggah Data Awal' : 'Data Migration & Initial Setup Support'
      ],
      ctaText: isId ? 'Daftarkan Sekolah' : 'Register School',
      paymentNote: isId ? 'QRIS / SEMUA BANK & FAKTUR' : 'QRIS / ALL BANKS & INVOICE',
    }
  ];

  const handleCtaClick = (planId: PlanIdType) => {
    onOpenRegister(planId, billingCycle);
  };

  return (
    <section 
      id="harga" 
      className="scroll-mt-16 sm:scroll-mt-20 pt-16 sm:pt-20 pb-16 sm:pb-20 lg:py-4 xl:py-7 lg:min-h-screen lg:flex lg:flex-col lg:justify-center lg:items-center bg-gradient-to-b from-[#F3F8FF] via-[#E9F3FE] to-[#DCEBFE] text-slate-900 relative antialiased overflow-x-clip"
    >
      {/* Background Soft Glows & Ambient Orbs */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-blue-200/35 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />

      {/* Decorative Dot Matrix Patterns on Left & Right Margins (matching screenshot) */}
      <div className="hidden 2xl:block absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-30 select-none">
        <div className="grid grid-cols-4 gap-2.5">
          {[...Array(24)].map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          ))}
        </div>
      </div>
      <div className="hidden 2xl:block absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-30 select-none">
        <div className="grid grid-cols-4 gap-2.5">
          {[...Array(24)].map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          ))}
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col justify-center items-center">
        
        {/* ========================================================================= */}
        {/* SECTION HEADER: Main Title, Subtitle & 3D School & Doodle                */}
        {/* Exact same positions as AdvantagesSection: left-4 xl:left-8 & right-2 xl:right-6 */}
        {/* ========================================================================= */}
        <div className="relative w-full text-center mb-5 sm:mb-7 lg:mb-2 xl:mb-3">
          
          {/* Top-Left Playful Handwritten Annotation with Rays - Aligned with AdvantagesSection */}
          <div className="hidden lg:block absolute -top-4 left-4 xl:left-8 pointer-events-none select-none text-left">
            <div className="inline-block -rotate-[7deg] bg-white/50 backdrop-blur-xs px-3.5 py-2 rounded-2xl border border-blue-200/50 shadow-2xs">
              <div className="relative font-bold text-blue-600 leading-tight tracking-tight text-xs xl:text-sm">
                <div className="text-blue-600 font-medium">`Solusi Lengkap</div>
                <div className="text-blue-700 font-extrabold">untuk Manajemen`</div>
                <div className="text-blue-800 font-black">{isId ? 'Sekolah Anda.' : 'Your School.'}</div>

                {/* Playful Ray Lines */}
                <svg className="absolute -top-3.5 -right-3 w-7 h-7 text-blue-500" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2V6M19 5L16 8M22 12H18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* Top-Right 3D Illustration of Indonesian School - Aligned with AdvantagesSection */}
          <div className="hidden lg:block absolute -top-8 right-2 xl:right-6 pointer-events-none select-none w-32 xl:w-40 opacity-80">
            <img 
              src="/images/pricing_school_3d.jpg" 
              alt="School 3D Illustration" 
              className="w-full h-auto object-contain drop-shadow-lg"
              loading="lazy"
            />
          </div>

          {/* High-Contrast Main Title */}
          <h2 className="text-2xl sm:text-3xl lg:text-lg xl:text-2xl 2xl:text-3xl font-black text-slate-900 tracking-tight leading-tight uppercase max-w-2xl mx-auto">
            <span>{isId ? 'Pilih Paket Sesuai' : 'Choose Plan For'}</span>
            <span className="block text-blue-600 mt-0.5">{isId ? 'Ruang Kerja Anda' : 'Your Workspace'}</span>
          </h2>

          {/* Subtitle Description */}
          <p className="mt-1 lg:mt-0.5 text-slate-600 text-xs sm:text-sm lg:text-[11px] xl:text-xs leading-relaxed max-w-lg mx-auto font-normal">
            {isId
              ? 'Paket ditentukan berdasarkan ruang kerja: mulai dari Ruang Kerja Individu hingga Ruang Kerja Sekolah terpadu.'
              : 'Plans are organized by workspace: from standalone personal workspaces for individual teachers to fully integrated institutional school deployment.'}
          </p>

          {/* Toggle Switch Periode Waktu: Bulanan vs Tahunan (Rounded Pill Style) */}
          <div className="pt-2 lg:pt-1 xl:pt-1.5 flex items-center justify-center">
            <div className="inline-flex items-center p-0.5 bg-white border border-slate-200/90 rounded-full shadow-2xs">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-3.5 sm:px-5 lg:px-2.5 xl:px-3.5 py-1 sm:py-1.5 lg:py-0.5 xl:py-1 rounded-full text-xs sm:text-sm lg:text-[10px] xl:text-[11.5px] font-bold transition-all cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isId ? 'Bulanan' : 'Monthly'}
              </button>

              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`px-3.5 sm:px-5 lg:px-2.5 xl:px-3.5 py-1 sm:py-1.5 lg:py-0.5 xl:py-1 rounded-full text-xs sm:text-sm lg:text-[10px] xl:text-[11.5px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  billingCycle === 'yearly'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{isId ? 'Tahunan' : 'Yearly'}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] lg:text-[8px] xl:text-[9px] font-black bg-emerald-500 text-white">
                  {isId ? 'Hemat 2 Bulan' : 'Save 2 Mos'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Quick Plan Switcher Bar */}
        <div className="md:hidden flex items-center justify-between gap-1 p-1 bg-blue-100/60 border border-blue-200/80 rounded-2xl mb-4 overflow-x-auto w-full max-w-sm">
          {plans.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => scrollToPlan(p.id)}
              className={`flex-1 min-w-[70px] py-2 px-2 text-xs font-black rounded-xl transition-all text-center whitespace-nowrap cursor-pointer ${
                activeMobilePlan === p.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {p.id === 'free' ? (isId ? 'Gratis' : 'Free') :
               p.id === 'teacher' ? (isId ? 'Guru' : 'Teacher') :
               (isId ? 'Sekolah ★' : 'School ★')}
            </button>
          ))}
        </div>

        {/* ========================================================================= */}
        {/* 3 PRICING CARDS: Professional, Compact Commercial SaaS Proportions        */}
        {/* Balanced max width (not stretched wide) for genuine SaaS aesthetic        */}
        {/* ========================================================================= */}
        <div className="w-full flex md:grid md:grid-cols-3 overflow-x-auto md:overflow-x-visible snap-x snap-mandatory gap-3.5 sm:gap-4 lg:gap-3 xl:gap-4 items-stretch pt-4 sm:pt-4 lg:pt-3.5 xl:pt-4 pb-2 md:pb-0 -mx-3 px-3 sm:mx-0 sm:px-0 max-w-5xl lg:max-w-[880px] xl:max-w-[940px] 2xl:max-w-[980px] mx-auto">
          
          {/* CARD 1: PAKET GRATIS (Ruang Kerja Individu) */}
          <div 
            id="pricing-card-free"
            className="w-[85vw] sm:w-[320px] md:w-auto shrink-0 md:shrink snap-center bg-white rounded-2xl p-5 sm:p-5 lg:p-3 xl:p-3.5 flex flex-col justify-between border border-blue-100/90 shadow-[0_6px_20px_-6px_rgba(37,99,235,0.08)] hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 relative overflow-visible"
          >
            <div>
              {/* Workspace Badge */}
              <div className="h-5 lg:h-4.5 xl:h-5 flex items-center gap-1.5 mb-1.5 lg:mb-1 xl:mb-1.5">
                <div className="w-5 h-5 lg:w-4 lg:h-4 xl:w-5 xl:h-5 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                  <User className="w-2.5 h-2.5 lg:w-2 lg:h-2 xl:w-2.5 xl:h-2.5" />
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs lg:text-[9.5px] xl:text-[10px] font-bold bg-blue-50 text-blue-700">
                  {plans[0].workspaceType}
                </span>
              </div>

              {/* Title & Tagline */}
              <h3 className="text-base sm:text-lg lg:text-xs xl:text-sm font-black text-slate-900 tracking-tight mb-0.5">
                {plans[0].name}
              </h3>
              <p className="text-xs sm:text-[12px] lg:text-[9.5px] xl:text-[10px] text-slate-500 leading-snug min-h-[30px] lg:min-h-[24px] xl:min-h-[26px] mb-2 lg:mb-1 xl:mb-1.5">
                {plans[0].tagline}
              </p>

              {/* Price Block */}
              <div className="mb-2 pb-2 lg:mb-1 lg:pb-1 xl:mb-1.5 xl:pb-1.5 border-b border-slate-100">
                {billingCycle === 'yearly' && (
                  <div className="h-3.5 lg:h-3 mb-0.5" />
                )}
                <div className="flex items-baseline gap-1">
                  <span className="text-xl sm:text-2xl lg:text-base xl:text-lg font-black text-slate-900 tracking-tight">
                    {plans[0].price}
                  </span>
                  <span className="text-xs lg:text-[9px] xl:text-[10px] font-bold text-slate-500">
                    {plans[0].period}
                  </span>
                </div>
                <div className="mt-1 lg:mt-0.5 text-[10px] lg:text-[8px] xl:text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <CreditCard className="w-3 h-3 lg:w-2.5 lg:h-2.5 text-slate-400" />
                  <span>{plans[0].paymentNote}</span>
                </div>
              </div>

              {/* Features List */}
              <div className="space-y-1 lg:space-y-0.5 xl:space-y-0.5 mb-3 lg:mb-1.5 xl:mb-2.5">
                <div className="text-[10px] lg:text-[8px] xl:text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1 lg:mb-0.5">
                  {isId ? 'FITUR UTAMA:' : 'KEY FEATURES:'}
                </div>
                {plans[0].features.map((feat, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-slate-600">
                    <div className="w-3 h-3 lg:w-2.5 lg:h-2.5 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5 text-blue-600">
                      <Check className="w-1.5 h-1.5 stroke-[3]" />
                    </div>
                    <span className="text-xs sm:text-[12px] lg:text-[9.5px] xl:text-[10px] leading-tight">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Button */}
            <button
              type="button"
              onClick={() => handleCtaClick('free')}
              className="w-full py-2 px-3 lg:py-1 lg:px-2.5 xl:py-1.5 xl:px-3 text-xs lg:text-[10px] xl:text-[11px] font-bold text-blue-600 bg-white border-2 border-blue-500 hover:bg-blue-50 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-98"
            >
              <span>{plans[0].ctaText}</span>
              <ArrowRight className="w-3 h-3 lg:w-2.5 lg:h-2.5" />
            </button>
          </div>

          {/* CARD 2: PAKET GURU (Ruang Kerja Individu Pro) - Paling Populer */}
          <div 
            id="pricing-card-teacher"
            className="w-[85vw] sm:w-[320px] md:w-auto shrink-0 md:shrink snap-center bg-white rounded-2xl p-5 sm:p-5 lg:p-3 xl:p-3.5 flex flex-col justify-between border-2 border-blue-500 shadow-[0_10px_28px_-6px_rgba(37,99,235,0.18)] hover:shadow-2xl transition-all duration-300 relative overflow-visible"
          >
            {/* Top Pill Badge - Paling Populer (Centered) */}
            <div className="absolute -top-3 lg:-top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 lg:px-2 lg:py-0.5 rounded-full text-[10px] lg:text-[8px] xl:text-[9px] font-black uppercase tracking-wider bg-blue-600 text-white shadow-md flex items-center gap-1 z-30 whitespace-nowrap">
              <Star className="w-3 h-3 lg:w-2 lg:h-2 fill-white shrink-0" />
              <span>{plans[1].badge}</span>
            </div>

            <div>
              {/* Workspace Badge */}
              <div className="h-5 lg:h-4.5 xl:h-5 flex items-center gap-1.5 mb-1.5 lg:mb-1 xl:mb-1.5 mt-0.5 lg:mt-0">
                <div className="w-5 h-5 lg:w-4 lg:h-4 xl:w-5 xl:h-5 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                  <Users className="w-2.5 h-2.5 lg:w-2 lg:h-2 xl:w-2.5 xl:h-2.5" />
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs lg:text-[9.5px] xl:text-[10px] font-bold bg-blue-50 text-blue-700">
                  {plans[1].workspaceType}
                </span>
              </div>

              {/* Title & Tagline */}
              <h3 className="text-base sm:text-lg lg:text-xs xl:text-sm font-black text-slate-900 tracking-tight mb-0.5">
                {plans[1].name}
              </h3>
              <p className="text-xs sm:text-[12px] lg:text-[9.5px] xl:text-[10px] text-slate-500 leading-snug min-h-[30px] lg:min-h-[24px] xl:min-h-[26px] mb-2 lg:mb-1 xl:mb-1.5">
                {plans[1].tagline}
              </p>

              {/* Price Block */}
              <div className="mb-2 pb-2 lg:mb-1 lg:pb-1 xl:mb-1.5 xl:pb-1.5 border-b border-slate-100">
                {billingCycle === 'yearly' && (
                  <div className="h-3.5 lg:h-3 mb-0.5" />
                )}
                <div className="flex items-baseline gap-1">
                  <span className="text-xl sm:text-2xl lg:text-base xl:text-lg font-black text-slate-900 tracking-tight">
                    {plans[1].price}
                  </span>
                  <span className="text-xs lg:text-[9px] xl:text-[10px] font-bold text-slate-500">
                    {plans[1].period}
                  </span>
                </div>
                <div className="mt-1 lg:mt-0.5 text-[10px] lg:text-[8px] xl:text-[9px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                  <QrCode className="w-3 h-3 lg:w-2.5 lg:h-2.5 text-blue-600" />
                  <span>{plans[1].paymentNote}</span>
                </div>
              </div>

              {/* Features List */}
              <div className="space-y-1 lg:space-y-0.5 xl:space-y-0.5 mb-3 lg:mb-1.5 xl:mb-2.5">
                <div className="text-[10px] lg:text-[8px] xl:text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1 lg:mb-0.5">
                  {isId ? 'FITUR UTAMA:' : 'KEY FEATURES:'}
                </div>
                {plans[1].features.map((feat, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-slate-600">
                    <div className="w-3 h-3 lg:w-2.5 lg:h-2.5 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5 text-blue-600">
                      <Check className="w-1.5 h-1.5 stroke-[3]" />
                    </div>
                    <span className="text-xs sm:text-[12px] lg:text-[9.5px] xl:text-[10px] leading-tight">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Button */}
            <button
              type="button"
              onClick={() => handleCtaClick('teacher')}
              className="w-full py-2 px-3 lg:py-1 lg:px-2.5 xl:py-1.5 xl:px-3 text-xs lg:text-[10px] xl:text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-blue-500/25 active:scale-98"
            >
              <span>{plans[1].ctaText}</span>
              <ArrowRight className="w-3 h-3 lg:w-2.5 lg:h-2.5" />
            </button>
          </div>

          {/* CARD 3: PAKET SEKOLAH (Ruang Kerja Sekolah / Institusi) - Dark Blue Theme */}
          <div 
            id="pricing-card-school"
            className="w-[85vw] sm:w-[320px] md:w-auto shrink-0 md:shrink snap-center bg-[#0C2D64] text-white rounded-2xl p-5 sm:p-5 lg:p-3 xl:p-3.5 flex flex-col justify-between shadow-xl relative overflow-visible"
          >
            {/* Top Pill Badge - Rekomendasi Utama Sekolah (Centered & Never Cut Off) */}
            <div className="absolute -top-3 lg:-top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 lg:px-2 lg:py-0.5 rounded-full text-[10px] lg:text-[8px] xl:text-[9px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 shadow-md flex items-center gap-1 z-30 whitespace-nowrap">
              <Star className="w-3 h-3 lg:w-2 lg:h-2 fill-slate-950 shrink-0" />
              <span>{plans[2].badge}</span>
            </div>

            <div>
              {/* Workspace Badge */}
              <div className="h-5 lg:h-4.5 xl:h-5 flex items-center gap-1.5 mb-1.5 lg:mb-1 xl:mb-1.5 mt-0.5 lg:mt-0">
                <div className="w-5 h-5 lg:w-4 lg:h-4 xl:w-5 xl:h-5 rounded-full bg-blue-800/70 flex items-center justify-center text-blue-300 shrink-0">
                  <Building2 className="w-2.5 h-2.5 lg:w-2 lg:h-2 xl:w-2.5 xl:h-2.5" />
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs lg:text-[9.5px] xl:text-[10px] font-bold bg-blue-800/60 text-blue-200">
                  {plans[2].workspaceType}
                </span>
              </div>

              {/* Title & Tagline */}
              <h3 className="text-base sm:text-lg lg:text-xs xl:text-sm font-black text-white tracking-tight mb-0.5">
                {plans[2].name}
              </h3>
              <p className="text-xs sm:text-[12px] lg:text-[9.5px] xl:text-[10px] text-blue-200/90 leading-snug min-h-[30px] lg:min-h-[24px] xl:min-h-[26px] mb-2 lg:mb-1 xl:mb-1.5">
                {plans[2].tagline}
              </p>

              {/* Price Block */}
              <div className="mb-2 pb-2 lg:mb-1 lg:pb-1 xl:mb-1.5 xl:pb-1.5 border-b border-blue-800/80">
                {billingCycle === 'yearly' ? (
                  <div className="h-3.5 lg:h-3 mb-0.5 flex items-center">
                    {plans[2].originalPrice ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] lg:text-[9px] line-through text-blue-300 font-bold">
                          {plans[2].originalPrice}
                        </span>
                        <span className="px-1.5 py-0.2 rounded-full text-[8.5px] lg:text-[7.5px] xl:text-[8.5px] font-black bg-emerald-500 text-white">
                          {plans[2].savingsBadge}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex items-baseline gap-1">
                  <span className="text-xl sm:text-2xl lg:text-base xl:text-lg font-black text-white tracking-tight">
                    {plans[2].price}
                  </span>
                  <span className="text-xs lg:text-[9px] xl:text-[10px] font-bold text-blue-200">
                    {plans[2].period}
                  </span>
                </div>
                <div className="mt-1 lg:mt-0.5 text-[10px] lg:text-[8px] xl:text-[9px] font-bold text-blue-300 uppercase tracking-wider flex items-center gap-1">
                  <QrCode className="w-3 h-3 lg:w-2.5 lg:h-2.5 text-blue-300" />
                  <span>{plans[2].paymentNote}</span>
                </div>
              </div>

              {/* Features List */}
              <div className="space-y-1 lg:space-y-0.5 xl:space-y-0.5 mb-3 lg:mb-1.5 xl:mb-2.5">
                <div className="text-[10px] lg:text-[8px] xl:text-[9px] font-black uppercase tracking-wider text-blue-300 mb-1 lg:mb-0.5">
                  {isId ? 'FITUR UTAMA:' : 'KEY FEATURES:'}
                </div>
                {plans[2].features.map((feat, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-blue-50">
                    <div className="w-3 h-3 lg:w-2.5 lg:h-2.5 rounded-full bg-blue-500 flex items-center justify-center shrink-0 mt-0.5 text-white">
                      <Check className="w-1.5 h-1.5 stroke-[3]" />
                    </div>
                    <span className="text-xs sm:text-[12px] lg:text-[9.5px] xl:text-[10px] leading-tight">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Button: Yellow/Amber Accent */}
            <button
              type="button"
              onClick={() => handleCtaClick('school')}
              className="w-full py-2 px-3 lg:py-1 lg:px-2.5 xl:py-1.5 xl:px-3 text-xs lg:text-[10px] xl:text-[11px] font-black text-slate-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-amber-400/20 active:scale-98"
            >
              <span>{plans[2].ctaText}</span>
              <ArrowRight className="w-3 h-3 lg:w-2.5 lg:h-2.5" />
            </button>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* BOTTOM GUARANTEE & TRUST BAR: Matched width to cards container            */}
        {/* ========================================================================= */}
        <div className="mt-3.5 sm:mt-5 lg:mt-2 xl:mt-2.5 bg-white/90 backdrop-blur-xs rounded-2xl lg:rounded-xl p-3 sm:p-4 lg:py-1.5 lg:px-3 xl:py-2 xl:px-3.5 border border-blue-100/80 shadow-[0_6px_20px_-8px_rgba(37,99,235,0.06)] max-w-5xl lg:max-w-[880px] xl:max-w-[940px] 2xl:max-w-[980px] mx-auto w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 lg:gap-2 xl:gap-2.5">
            
            {/* 1. Aman & Terpercaya */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 lg:w-5 lg:h-5 xl:w-5.5 xl:h-5.5 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                <ShieldCheck className="w-3.5 h-3.5 lg:w-2.5 lg:h-2.5 xl:w-3 xl:h-3" />
              </div>
              <div>
                <h4 className="text-xs lg:text-[9.5px] xl:text-[10.5px] font-black text-slate-900 leading-tight mb-0.2">
                  {isId ? 'Aman & Terpercaya' : 'Secure & Trusted'}
                </h4>
                <p className="text-[10.5px] lg:text-[8px] xl:text-[9px] text-slate-500 leading-tight">
                  {isId ? 'Data sekolah Anda terlindungi sistem keamanan modern.' : 'Your school data is protected with modern security systems.'}
                </p>
              </div>
            </div>

            {/* 2. Akses Fleksibel */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 lg:w-5 lg:h-5 xl:w-5.5 xl:h-5.5 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                <Globe className="w-3.5 h-3.5 lg:w-2.5 lg:h-2.5 xl:w-3 xl:h-3" />
              </div>
              <div>
                <h4 className="text-xs lg:text-[9.5px] xl:text-[10.5px] font-black text-slate-900 leading-tight mb-0.2">
                  {isId ? 'Akses Fleksibel' : 'Flexible Access'}
                </h4>
                <p className="text-[10.5px] lg:text-[8px] xl:text-[9px] text-slate-500 leading-tight">
                  {isId ? 'Bisa diakses dari mana saja, kapan saja, di semua perangkat.' : 'Accessible from anywhere, anytime, across all devices.'}
                </p>
              </div>
            </div>

            {/* 3. Dukungan Penuh */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 lg:w-5 lg:h-5 xl:w-5.5 xl:h-5.5 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                <Headphones className="w-3.5 h-3.5 lg:w-2.5 lg:h-2.5 xl:w-3 xl:h-3" />
              </div>
              <div>
                <h4 className="text-xs lg:text-[9.5px] xl:text-[10.5px] font-black text-slate-900 leading-tight mb-0.2">
                  {isId ? 'Dukungan Penuh' : 'Full Support'}
                </h4>
                <p className="text-[10.5px] lg:text-[8px] xl:text-[9px] text-slate-500 leading-tight">
                  {isId ? 'Tim support siap membantu kapanpun Anda butuh.' : 'Our support team is ready to assist whenever you need.'}
                </p>
              </div>
            </div>

            {/* 4. Update Berkala */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 lg:w-5 lg:h-5 xl:w-5.5 xl:h-5.5 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                <RefreshCw className="w-3.5 h-3.5 lg:w-2.5 lg:h-2.5 xl:w-3 xl:h-3" />
              </div>
              <div>
                <h4 className="text-xs lg:text-[9.5px] xl:text-[10.5px] font-black text-slate-900 leading-tight mb-0.2">
                  {isId ? 'Update Berkala' : 'Regular Updates'}
                </h4>
                <p className="text-[10.5px] lg:text-[8px] xl:text-[9px] text-slate-500 leading-tight">
                  {isId ? 'Fitur selalu berkembang sesuai kebutuhan sekolah.' : 'Features constantly evolve with modern school requirements.'}
                </p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};

