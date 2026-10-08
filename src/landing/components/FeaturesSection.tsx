import React from 'react';
import { 
  Clock, 
  Sparkles, 
  QrCode, 
  MessageCircle, 
  FileSpreadsheet, 
  ShieldCheck, 
  ArrowRight
} from 'lucide-react';

interface FeaturesSectionProps {
  lang: 'ID' | 'EN';
  onOpenRegister?: () => void;
}

export const FeaturesSection: React.FC<FeaturesSectionProps> = ({ lang, onOpenRegister }) => {
  const isId = lang === 'ID';

  const card1 = isId ? {
    title: 'Presensi Dual-Mode SD',
    desc: 'Presensi harian Wali Kelas dan presensi jam oleh Guru Mapel khusus dalam satu alur.',
    tag: 'Harian & Mapel',
  } : {
    title: 'Dual-Mode Attendance',
    desc: 'Daily homeroom check-ins and subject period logs for specialist teachers.',
    tag: 'Homeroom & Subject',
  };

  const card2 = isId ? {
    title: 'Asisten AI Cerdas "Presiden Konoha"',
    desc: 'Bantu rekap dan catat absensi lewat perintah percakapan cerdas tanpa ribet klik manual.',
    tag: 'Asisten Cerdas',
  } : {
    title: 'Smart AI Assistant "President Konoha"',
    desc: 'Automate attendance logs and recaps through smart natural voice and text commands.',
    tag: 'Smart AI Assistant',
  };

  const bottomCards = isId ? [
    {
      icon: QrCode,
      title: 'Absensi QR Code',
      desc: 'Scan QR dinamis via kamera HP siswa atau kelas dengan validasi instan tanpa antrean.',
      tag: 'Cepat & Akurat',
      theme: {
        iconBg: 'bg-indigo-600',
        tagBg: 'bg-indigo-50 text-indigo-700 border-indigo-100',
        btnBg: 'bg-indigo-600 hover:bg-indigo-700',
        glowBg: 'bg-indigo-100/50',
      }
    },
    {
      icon: MessageCircle,
      title: 'Notifikasi WhatsApp',
      desc: 'Kirim rekap kehadiran dan status siswa langsung ke WhatsApp orang tua secara real-time.',
      tag: 'Real-time WA',
      theme: {
        iconBg: 'bg-amber-500',
        tagBg: 'bg-amber-50 text-amber-700 border-amber-100',
        btnBg: 'bg-amber-500 hover:bg-amber-600',
        glowBg: 'bg-amber-100/50',
      }
    },
    {
      icon: FileSpreadsheet,
      title: 'Format Cetak Kedinasan',
      desc: 'Ekspor dokumen A4 standar kedinasan siap tanda tangan resmi kepala sekolah.',
      tag: 'Standar A4',
      theme: {
        iconBg: 'bg-teal-600',
        tagBg: 'bg-teal-50 text-teal-700 border-teal-100',
        btnBg: 'bg-teal-600 hover:bg-teal-700',
        glowBg: 'bg-teal-100/50',
      }
    },
    {
      icon: ShieldCheck,
      title: 'Portal Siswa & Orang Tua/Wali Murid',
      desc: 'Akses transparan bagi orang tua untuk pantau kehadiran harian dan kirim surat izin.',
      tag: 'Akses Mandiri',
      theme: {
        iconBg: 'bg-rose-500',
        tagBg: 'bg-rose-50 text-rose-700 border-rose-100',
        btnBg: 'bg-rose-500 hover:bg-rose-600',
        glowBg: 'bg-rose-100/50',
      }
    },
  ] : [
    {
      icon: QrCode,
      title: 'QR Code Attendance',
      desc: 'Dynamic QR scanning via classroom camera with instant verification and no queues.',
      tag: 'Fast & Accurate',
      theme: {
        iconBg: 'bg-indigo-600',
        tagBg: 'bg-indigo-50 text-indigo-700 border-indigo-100',
        btnBg: 'bg-indigo-600 hover:bg-indigo-700',
        glowBg: 'bg-indigo-100/50',
      }
    },
    {
      icon: MessageCircle,
      title: 'WhatsApp Notifications',
      desc: 'Send real-time attendance recaps and student status alerts directly to parents WhatsApp.',
      tag: 'Real-time WA',
      theme: {
        iconBg: 'bg-amber-500',
        tagBg: 'bg-amber-50 text-amber-700 border-amber-100',
        btnBg: 'bg-amber-500 hover:bg-amber-600',
        glowBg: 'bg-amber-100/50',
      }
    },
    {
      icon: FileSpreadsheet,
      title: 'Official Print Reports',
      desc: 'Print-ready standard A4 records with institutional principal signature boxes.',
      tag: 'A4 Standard',
      theme: {
        iconBg: 'bg-teal-600',
        tagBg: 'bg-teal-50 text-teal-700 border-teal-100',
        btnBg: 'bg-teal-600 hover:bg-teal-700',
        glowBg: 'bg-teal-100/50',
      }
    },
    {
      icon: ShieldCheck,
      title: 'Student & Parent/Guardian Portal',
      desc: 'Direct portal for parents to verify daily attendance and submit official leaves.',
      tag: 'Direct Access',
      theme: {
        iconBg: 'bg-rose-500',
        tagBg: 'bg-rose-50 text-rose-700 border-rose-100',
        btnBg: 'bg-rose-500 hover:bg-rose-600',
        glowBg: 'bg-rose-100/50',
      }
    },
  ];

  return (
    <section 
      id="fitur" 
      className="scroll-mt-16 sm:scroll-mt-20 pt-16 sm:pt-20 pb-14 sm:pb-16 lg:py-0 lg:min-h-screen lg:h-screen lg:max-h-screen lg:flex lg:flex-col lg:justify-center bg-gradient-to-b from-[#F2F8FF] via-[#EAF3FE] to-[#DCEBFE] text-slate-900 relative antialiased overflow-hidden"
    >
      {/* Gentle Floating Atmospheric Background Orbs */}
      <div className="absolute top-10 left-1/4 w-80 h-80 bg-blue-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 right-10 w-96 h-96 bg-sky-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 left-10 w-72 h-72 bg-indigo-100/30 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        
        {/* ========================================================================= */}
        {/* SECTION HEADER: Main Title, Subtitle & Playful Doodles                   */}
        {/* ========================================================================= */}
        <div className="relative text-center mb-6 sm:mb-8 lg:mb-3 xl:mb-5">
          
          {/* Top-Left Playful Origami Paper Airplane with Looped Flight Path */}
          <div className="hidden md:block absolute -top-4 left-6 lg:left-12 pointer-events-none select-none">
            <svg 
              className="w-32 lg:w-40 h-24 text-blue-400/80" 
              viewBox="0 0 160 100" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Dotted Trajectory Trail with Loop */}
              <path 
                d="M 10 75 C 30 80, 50 65, 45 40 C 40 20, 65 25, 80 50 C 95 70, 115 50, 135 25" 
                stroke="#60A5FA" 
                strokeWidth="1.8" 
                strokeDasharray="4 4" 
                strokeLinecap="round"
              />
              {/* Origami Paper Airplane Facing Top-Right */}
              <g transform="translate(130, 12) rotate(22) scale(0.9)">
                {/* Main Body Facet */}
                <polygon points="0,22 28,0 20,28" fill="#3B82F6" />
                {/* Wing Top */}
                <polygon points="28,0 6,10 0,22" fill="#93C5FD" />
                {/* Wing Underside Fold */}
                <polygon points="0,22 14,18 20,28" fill="#1D4ED8" />
                <polygon points="14,18 28,0 20,28" fill="#2563EB" opacity="0.9" />
              </g>
            </svg>
          </div>

          {/* Top-Right Hand-Drawn Playful Typography Doodles */}
          <div className="hidden md:block absolute -top-2 right-6 lg:right-14 pointer-events-none select-none text-right">
            <div className="inline-block rotate-[8deg] bg-white/40 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-blue-200/40 shadow-2xs">
              <div className="relative font-bold text-blue-600 leading-tight tracking-tight text-sm lg:text-base select-none">
                <div className="flex items-center justify-end gap-1">
                  <span>{isId ? 'Mudah' : 'Easy'}</span>
                  <span className="text-blue-500 font-extrabold text-xs">ᐟ</span>
                </div>
                <div className="text-blue-700">{isId ? 'Cepat' : 'Fast'}</div>
                <div className="text-blue-800 font-extrabold">{isId ? 'Terpercaya' : 'Reliable'}</div>

                {/* Decorative Doodle Rays */}
                <svg className="absolute -top-3 -right-2.5 w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2V6M19 5L16 8M22 12H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* Big High-Contrast Title */}
          <h2 className="text-2xl sm:text-3xl lg:text-3xl xl:text-4xl font-black text-slate-900 tracking-tight leading-tight uppercase max-w-2xl mx-auto">
            <span>{isId ? 'Fitur Kawacanaan' : 'Kawacanaan Features'}</span>
            <span className="block text-blue-600 mt-0.5">{isId ? 'Sekolah Dasar' : 'Primary School'}</span>
          </h2>

          {/* Subtitle Description */}
          <p className="mt-2 lg:mt-1.5 text-slate-600 text-xs sm:text-sm lg:text-xs xl:text-sm leading-relaxed max-w-xl mx-auto font-normal">
            {isId 
              ? 'Sistem presensi terpadu, rekapitulasi rombel kelas 1–6, dan pelaporan kedinasan dalam satu antarmuka bersih.'
              : 'Integrated attendance logging, grade 1–6 cohort recap, and official educational reporting in one clean interface.'}
          </p>
        </div>

        {/* ========================================================================= */}
        {/* BARIS ATAS: KARTU KIRI + 3D SHOWCASE ILUSTRASI TENGAH + KARTU KANAN       */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-4 xl:gap-6 items-center mb-4 sm:mb-6 lg:mb-3 xl:mb-4">
          
          {/* KARTU 1 (Kiri): Presensi Dual-Mode SD */}
          <div className="lg:col-span-4 bg-white/95 rounded-3xl p-5 sm:p-6 lg:p-4 xl:p-5 shadow-[0_12px_30px_-10px_rgba(37,99,235,0.12)] border border-blue-100/80 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group min-h-[190px] lg:min-h-[160px] xl:min-h-[185px]">
            {/* Bottom-right organic pastel decorative corner shape */}
            <div className="absolute -bottom-8 -right-8 w-28 h-28 bg-blue-100/60 rounded-tl-full pointer-events-none transition-transform group-hover:scale-110" />

            <div className="relative z-10">
              {/* Header Icon + Tag */}
              <div className="flex items-center justify-between gap-3 mb-2.5 lg:mb-2 xl:mb-3">
                <div className="w-10 h-10 lg:w-9 lg:h-9 xl:w-11 xl:h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30 shrink-0">
                  <Clock className="w-5 h-5 lg:w-4.5 lg:h-4.5 xl:w-5.5 xl:h-5.5" />
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  {card1.tag}
                </span>
              </div>

              {/* Title & Description */}
              <h3 className="text-base sm:text-lg lg:text-sm xl:text-base font-black text-slate-900 tracking-tight leading-snug mb-1 group-hover:text-blue-600 transition-colors">
                {card1.title}
              </h3>
              <p className="text-xs lg:text-[11.5px] xl:text-xs text-slate-500 leading-relaxed">
                {card1.desc}
              </p>
            </div>

            {/* Bottom Arrow Action Button */}
            <div className="relative z-10 pt-3 lg:pt-2 xl:pt-3">
              <button 
                type="button"
                onClick={onOpenRegister}
                aria-label={card1.title}
                className="w-7 h-7 lg:w-6.5 lg:h-6.5 xl:w-7 xl:h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs group-hover:bg-blue-700 group-hover:translate-x-1 transition-all cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* CENTERPIECE: 3D Schoolhouse, Modern Tablet Dashboard & Playful Note */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center py-1 lg:py-0 relative">
            <div className="w-full max-w-[280px] sm:max-w-[340px] lg:max-w-[240px] xl:max-w-[290px] mx-auto relative group">
              {/* Backdrop Glow */}
              <div className="absolute inset-0 bg-blue-400/20 rounded-3xl blur-xl transform group-hover:scale-105 transition-transform" />
              
              {/* High-Resolution 3D School & Attendance Tablet Visual */}
              <div className="relative rounded-2xl overflow-hidden shadow-[0_14px_30px_-8px_rgba(30,58,138,0.2)] border border-white/80 bg-white">
                <img 
                  src="/images/school_features_3d_showcase.jpg" 
                  alt="Kawacanaan 3D School & Attendance Dashboard" 
                  className="w-full h-auto object-cover object-center transform transition-transform duration-500 hover:scale-[1.02]"
                  loading="lazy"
                />
              </div>

              {/* Playful Handwritten Annotation Underneath with Curved Arrow */}
              <div className="flex items-center justify-center gap-1.5 mt-2 text-center">
                <span className="text-[11px] lg:text-[11px] xl:text-xs font-bold text-blue-700 tracking-tight font-sans">
                  {isId ? 'Administrasi sekolah dasar lebih mudah!' : 'Primary school administration made simple!'}
                </span>
                <svg className="w-4 h-4 text-blue-600 -rotate-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 14c4-6 10-6 14-2" />
                  <polyline points="15 8 18 12 14 14" />
                </svg>
              </div>
            </div>
          </div>

          {/* KARTU 2 (Kanan): Asisten AI Cerdas "Presiden Konoha" */}
          <div className="lg:col-span-4 bg-white/95 rounded-3xl p-5 sm:p-6 lg:p-4 xl:p-5 shadow-[0_12px_30px_-10px_rgba(16,185,129,0.12)] border border-emerald-100/80 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group min-h-[190px] lg:min-h-[160px] xl:min-h-[185px]">
            {/* Bottom-right organic pastel decorative corner shape */}
            <div className="absolute -bottom-8 -right-8 w-28 h-28 bg-emerald-100/60 rounded-tl-full pointer-events-none transition-transform group-hover:scale-110" />

            <div className="relative z-10">
              {/* Header Icon + Tag */}
              <div className="flex items-center justify-between gap-3 mb-2.5 lg:mb-2 xl:mb-3">
                <div className="w-10 h-10 lg:w-9 lg:h-9 xl:w-11 xl:h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30 shrink-0">
                  <Sparkles className="w-5 h-5 lg:w-4.5 lg:h-4.5 xl:w-5.5 xl:h-5.5" />
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                  {card2.tag}
                </span>
              </div>

              {/* Title & Description */}
              <h3 className="text-base sm:text-lg lg:text-sm xl:text-base font-black text-slate-900 tracking-tight leading-snug mb-1 group-hover:text-emerald-600 transition-colors">
                {card2.title}
              </h3>
              <p className="text-xs lg:text-[11.5px] xl:text-xs text-slate-500 leading-relaxed">
                {card2.desc}
              </p>
            </div>

            {/* Bottom Arrow Action Button */}
            <div className="relative z-10 pt-3 lg:pt-2 xl:pt-3">
              <button 
                type="button"
                onClick={onOpenRegister}
                aria-label={card2.title}
                className="w-7 h-7 lg:w-6.5 lg:h-6.5 xl:w-7 xl:h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs group-hover:bg-emerald-700 group-hover:translate-x-1 transition-all cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* BARIS BAWAH: 4 KARTU FITUR SPESIFIK BERJEJER RAPI SECARA HORIZONTAL       */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-3 xl:gap-4">
          {bottomCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={idx}
                id={`feature-bottom-card-${idx}`}
                className="bg-white/95 rounded-3xl p-4 sm:p-5 lg:p-3 xl:p-4 shadow-[0_8px_24px_-8px_rgba(15,23,42,0.06)] border border-slate-100/90 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group min-h-[160px] lg:min-h-[135px] xl:min-h-[155px]"
              >
                {/* Bottom-right organic pastel decorative corner glow */}
                <div className={`absolute -bottom-8 -right-8 w-24 h-24 ${card.theme.glowBg} rounded-tl-full pointer-events-none transition-transform group-hover:scale-110`} />

                <div className="relative z-10">
                  {/* Top Bar: Icon + Tag */}
                  <div className="flex items-center justify-between gap-2 mb-2 lg:mb-1.5 xl:mb-2.5">
                    <div className={`w-9 h-9 lg:w-8 lg:h-8 xl:w-10 xl:h-10 rounded-2xl ${card.theme.iconBg} text-white flex items-center justify-center shadow-xs shrink-0`}>
                      <Icon className="w-4.5 h-4.5 lg:w-4 lg:h-4 xl:w-5 xl:h-5" />
                    </div>
                    <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${card.theme.tagBg}`}>
                      {card.tag}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-sm sm:text-base lg:text-xs xl:text-sm font-bold text-slate-900 tracking-tight leading-snug mb-1 group-hover:text-blue-600 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs lg:text-[10.5px] xl:text-xs text-slate-500 leading-relaxed font-normal line-clamp-2">
                    {card.desc}
                  </p>
                </div>

                {/* Bottom Arrow Action Button */}
                <div className="relative z-10 pt-2 lg:pt-1.5 xl:pt-2">
                  <button 
                    type="button"
                    onClick={onOpenRegister}
                    aria-label={card.title}
                    className={`w-6 h-6 lg:w-5.5 lg:h-5.5 xl:w-6.5 xl:h-6.5 rounded-full ${card.theme.btnBg} text-white flex items-center justify-center shadow-2xs group-hover:translate-x-1 transition-all cursor-pointer`}
                  >
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* Subtle Bottom Wave Section Transition */}
      <div className="absolute bottom-0 left-0 right-0 w-full overflow-hidden leading-none pointer-events-none">
        <svg 
          className="relative block w-full h-8 sm:h-12 text-white fill-current" 
          viewBox="0 0 1200 120" 
          preserveAspectRatio="none"
        >
          <path d="M0,0 C150,90 350,-40 500,45 C650,130 900,10 1200,50 L1200,120 L0,120 Z" />
        </svg>
      </div>
    </section>
  );
};


