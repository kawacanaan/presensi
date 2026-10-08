import React from 'react';
import { ArrowRight, Gift } from 'lucide-react';
import { DeviceMockup } from './DeviceMockup';
import { PublicStatsBanner } from './PublicStatsBanner';

interface HeroSectionProps {
  onOpenRegister: () => void;
  onOpenRegisterSchool?: () => void;
  onOpenLogin: () => void;
  lang: 'ID' | 'EN';
}

export const HeroSection: React.FC<HeroSectionProps> = ({ 
  onOpenRegister, 
  onOpenRegisterSchool,
  lang 
}) => {
  const isId = lang === 'ID';

  return (
    <section 
      id="beranda" 
      className="relative min-h-[calc(100vh-70px)] lg:min-h-screen lg:h-screen lg:max-h-screen pt-20 sm:pt-24 lg:pt-20 xl:pt-24 pb-6 sm:pb-8 lg:pb-3 flex flex-col justify-between overflow-hidden bg-gradient-to-b from-[#F5F9FF] via-[#ECF4FE] to-[#DCEBFE] text-slate-900 antialiased scroll-mt-20"
    >
      {/* Background Soft Glow Circles & Orbs (as in screenshot) */}
      <div className="absolute -top-12 -left-12 w-64 h-64 sm:w-96 sm:h-96 bg-blue-300/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/4 -left-10 w-44 h-44 rounded-full bg-blue-200/40 blur-2xl pointer-events-none" />
      <div className="absolute top-16 right-1/4 w-80 h-80 bg-sky-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-20 right-10 w-40 h-28 bg-white/60 rounded-full blur-xl pointer-events-none" />

      {/* Decorative Dot Matrix on Left and Right Margins (as in screenshot) */}
      <div className="hidden xl:block absolute left-6 top-1/2 -translate-y-8 pointer-events-none opacity-40 select-none">
        <div className="grid grid-cols-4 gap-2.5">
          {[...Array(24)].map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          ))}
        </div>
      </div>
      <div className="hidden xl:block absolute right-6 top-1/2 translate-y-6 pointer-events-none opacity-40 select-none">
        <div className="grid grid-cols-4 gap-2.5">
          {[...Array(24)].map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          ))}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 lg:gap-8 items-center pt-1 sm:pt-2 lg:pt-0">
          
          {/* ========================================================================= */}
          {/* Left Column: Bold Headline, Narrative Text & CTA Buttons */}
          {/* ========================================================================= */}
          <div className="w-full lg:col-span-6 xl:col-span-6 space-y-3.5 sm:space-y-4 lg:space-y-3 xl:space-y-4 text-left">
            
            {/* Main Headline with 2 Dedicated Scaled Lines */}
            <h1 className="leading-[1.1] sm:leading-[1.08] font-black tracking-tight uppercase select-none">
              {isId ? (
                <>
                  <span className="block text-[22px] min-[380px]:text-[26px] sm:text-3xl md:text-4xl lg:text-[38px] xl:text-[46px] text-slate-900 whitespace-normal sm:whitespace-nowrap">
                    PRESENSI SEKOLAH DASAR
                  </span>
                  <span className="block text-[24px] min-[380px]:text-[28px] sm:text-3xl md:text-4xl lg:text-[42px] xl:text-[50px] text-[#0066FF] mt-1 whitespace-normal sm:whitespace-nowrap">
                    LEBIH TERTIB & AKURAT
                  </span>
                </>
              ) : (
                <>
                  <span className="block text-[22px] min-[380px]:text-[26px] sm:text-3xl md:text-4xl lg:text-[38px] xl:text-[46px] text-slate-900 whitespace-normal sm:whitespace-nowrap">
                    PRIMARY ATTENDANCE
                  </span>
                  <span className="block text-[24px] min-[380px]:text-[28px] sm:text-3xl md:text-4xl lg:text-[42px] xl:text-[50px] text-[#0066FF] mt-1 whitespace-normal sm:whitespace-nowrap">
                    STRUCTURED & PRECISE
                  </span>
                </>
              )}
            </h1>

            {/* Narrative with Left Blue Border Accent (as in screenshot) */}
            <p className="text-sm sm:text-base lg:text-[16px] text-slate-600 leading-relaxed max-w-xl border-l-[3.5px] border-[#0066FF] pl-4 sm:pl-5 font-normal pt-0.5">
              {isId 
                ? "Sistem presensi digital terpadu untuk Sekolah Dasar. Mendukung presensi harian oleh Wali Kelas, presensi per mata pelajaran yang fleksibel sesuai kebutuhan sekolah masing-masing, penghitungan otomatis hari efektif belajar, hingga cetak laporan administrasi format kedinasan."
                : "Integrated digital attendance platform built specifically for Primary Schools. Supporting daily homeroom check-ins, flexible subject-based attendance tailored to each school's unique needs, automatic effective school day calculations, and official administrative report exports."
              }
            </p>

            {/* Action Buttons Group (as in screenshot) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-2 w-full sm:w-auto">
              
              {/* Primary Button: MULAI GRATIS with Rotating Light List Border Beam & Shimmer Sheen */}
              <div className="relative rounded-2xl w-full sm:w-auto inline-flex items-center justify-center group transition-all duration-300">
                {/* Ambient Soft Glow Aura behind the rotating light beam */}
                <div 
                  className="absolute -inset-0.5 rounded-2xl opacity-70 group-hover:opacity-100 blur-md pointer-events-none transition-opacity duration-300 animate-pulse-aura"
                  style={{
                    background: 'conic-gradient(from 0deg, #0066FF, #38bdf8, #818cf8, #60a5fa, #0066FF)'
                  }}
                  aria-hidden="true"
                />

                {/* Masked Border Container: strictly clips the rotating conic gradient to the perimeter */}
                <div className="relative p-[2.5px] rounded-2xl overflow-hidden w-full sm:w-auto inline-flex items-center justify-center shadow-lg shadow-blue-500/25">
                  {/* Rotating colorful laser light beam (conic gradient) */}
                  <div 
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320%] aspect-square pointer-events-none animate-spin-border"
                    style={{
                      background: 'conic-gradient(from 0deg, #0066FF 0%, #38bdf8 18%, #ffffff 32%, #60a5fa 50%, #818cf8 70%, #0066FF 100%)'
                    }}
                    aria-hidden="true"
                  />

                  {/* Core Button Face with Sheen Sweep */}
                  <button
                    type="button"
                    id="btn-hero-trial"
                    onClick={onOpenRegister}
                    className="relative z-10 w-full sm:w-auto bg-[#0066FF] hover:bg-blue-600 active:scale-[0.98] text-white px-7 sm:px-8 py-3.5 sm:py-4 text-xs sm:text-sm font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2.5 cursor-pointer rounded-[13.5px] overflow-hidden select-none"
                  >
                    {/* Subtle Light Sheen Reflection pass */}
                    <div 
                      className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none animate-shimmer-sweep" 
                      aria-hidden="true" 
                    />

                    <Gift className="relative z-10 w-4 h-4 shrink-0 text-white" />
                    <span className="relative z-10">{isId ? 'MULAI GRATIS' : 'START FOR FREE'}</span>
                    <ArrowRight className="relative z-10 w-4 h-4 shrink-0 ml-0.5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>

              {/* Secondary Button: DAFTAR SEKOLAH with Clean Dark Navy Border & Rounded-2xl */}
              <button
                type="button"
                id="btn-hero-register-school"
                onClick={onOpenRegisterSchool || onOpenRegister}
                className="w-full sm:w-auto border-2 border-slate-900 hover:bg-white/80 bg-white/40 text-slate-900 px-6 sm:px-8 py-3.5 sm:py-4 text-xs sm:text-sm font-black uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer rounded-2xl select-none"
              >
                <span>{isId ? 'DAFTAR SEKOLAH' : 'REGISTER SCHOOL'}</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>

            </div>

          </div>

          {/* ========================================================================= */}
          {/* Right Column: Interactive Laptop Dashboard + Smartphone + 3D School Model */}
          {/* ========================================================================= */}
          <div className="w-full lg:col-span-6 xl:col-span-6 flex justify-center lg:justify-end relative pt-4 lg:pt-0">
            <div className="relative w-full max-w-lg lg:max-w-none flex justify-center items-center">
              
              {/* 3D Stylized School with Flag, Clock Tower & Trees in the background (as in screenshot) */}
              <div className="hidden sm:block absolute -right-2 sm:-right-4 lg:-right-6 top-1/2 -translate-y-1/2 w-48 sm:w-56 lg:w-64 xl:w-72 pointer-events-none select-none z-0">
                <img 
                  src="/images/hero_school_3d.jpg" 
                  alt="Indonesian School 3D Building" 
                  className="w-full h-auto object-contain drop-shadow-2xl rounded-3xl"
                  loading="lazy"
                />
              </div>

              {/* Left Green Foliage Accent behind Laptop (as in screenshot) */}
              <div className="hidden sm:block absolute -left-6 bottom-8 w-20 h-28 pointer-events-none select-none z-0">
                <div className="w-16 h-16 bg-emerald-400/80 rounded-full blur-xs transform -rotate-12" />
                <div className="w-14 h-14 bg-emerald-500/80 rounded-full blur-xs -mt-6 ml-4" />
              </div>

              {/* Main Interactive Laptop & Smartphone Mockup */}
              <div className="relative z-10 w-full">
                <DeviceMockup lang={lang} />
              </div>

            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* Solid Blue Horizontal Public Statistics Banner (as in screenshot)         */}
        {/* ========================================================================= */}
        <div className="mt-8 sm:mt-10 lg:mt-4 xl:mt-6 w-full">
          <PublicStatsBanner lang={lang} />
        </div>
      </div>

      {/* Curved Wave Bottom Divider (as in screenshot) */}
      <div className="w-full overflow-hidden leading-none pointer-events-none mt-4 sm:mt-6 lg:mt-2 xl:mt-4 shrink-0">
        <svg 
          className="relative block w-full h-8 sm:h-12 lg:h-8 xl:h-10 text-white fill-current" 
          viewBox="0 0 1200 120" 
          preserveAspectRatio="none"
        >
          <path d="M0,0 C150,90 350,-40 500,45 C650,130 900,10 1200,50 L1200,120 L0,120 Z" />
        </svg>
      </div>

    </section>
  );
};


