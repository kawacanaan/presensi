import React from 'react';
import { School, CheckCircle2, Star } from 'lucide-react';

interface TestimonialSectionProps {
  lang: 'ID' | 'EN';
}

export const TestimonialSection: React.FC<TestimonialSectionProps> = ({ lang }) => {
  const isId = lang === 'ID';

  const testimonials = isId ? [
    {
      id: '1',
      name: 'Siti Nurhayati, S.Pd.',
      role: 'KEPALA SEKOLAH',
      school: 'SDN 1 Sukamaju',
      rating: 5,
      tag: 'Efisiensi Administrasi',
      tagColor: 'bg-blue-50 text-blue-600 border-blue-100',
      avatarBg: 'bg-[#1952BE] text-white',
      avatarType: 'initials' as const,
      initials: 'SP',
      quote: 'Sistem presensi ini sangat membantu kami dalam mengelola kehadiran guru dan siswa. Laporan bisa diakses dengan mudah dan cepat, sehingga pekerjaan administrasi sekolah jadi lebih ringan.',
      cornerBlob: 'bg-blue-100/30'
    },
    {
      id: '2',
      name: 'Rina Wulandari, S.Pd.',
      role: 'WALI KELAS',
      school: 'SDN 2 Harapan Jaya',
      rating: 5,
      tag: 'Mudah Digunakan Guru',
      tagColor: 'bg-blue-50 text-blue-600 border-blue-100',
      avatarBg: 'bg-blue-100 text-blue-700',
      avatarType: 'illustration' as const,
      avatarGender: 'female',
      quote: 'Tampilannya sederhana dan mudah digunakan. Guru-guru di sekolah kami cepat beradaptasi, bahkan yang masih kurang familiar dengan teknologi pun bisa menggunakannya.',
      cornerBlob: 'bg-indigo-100/30'
    },
    {
      id: '3',
      name: 'Budi Santoso, S.Pd.',
      role: 'GURU MAPEL',
      school: 'SDN 3 Cemara Indah',
      rating: 5,
      tag: 'Integrasi Data Terpusat',
      tagColor: 'bg-blue-50 text-blue-600 border-blue-100',
      avatarBg: 'bg-blue-100 text-blue-700',
      avatarType: 'illustration' as const,
      avatarGender: 'male',
      quote: 'Data siswa, guru, dan kelas sudah terintegrasi dengan baik. Ini sangat membantu kami dalam membuat laporan dan perencanaan sekolah dengan lebih akurat dan cepat.',
      cornerBlob: 'bg-emerald-100/30'
    },
    {
      id: '4',
      name: 'Agus Priyono, S.Kom.',
      role: 'TATA USAHA',
      school: 'SDN 4 Melati',
      rating: 5,
      tag: 'Layanan Responsif',
      tagColor: 'bg-blue-50 text-blue-600 border-blue-100',
      avatarBg: 'bg-blue-100 text-blue-700',
      avatarType: 'illustration' as const,
      avatarGender: 'glasses',
      quote: 'Tiim support sangat membantu dan responsif saat kami membutuhkan bantuan. Setiap pertanyaan selalu ditanggapi dengan cepat dan solusi yang tepat.',
      cornerBlob: 'bg-pink-100/30'
    }
  ] : [
    {
      id: '1',
      name: 'Siti Nurhayati, S.Pd.',
      role: 'PRINCIPAL',
      school: 'SDN 1 Sukamaju',
      rating: 5,
      tag: 'Admin Efficiency',
      tagColor: 'bg-blue-50 text-blue-600 border-blue-100',
      avatarBg: 'bg-[#1952BE] text-white',
      avatarType: 'initials' as const,
      initials: 'SP',
      quote: 'This attendance system greatly simplifies teacher and student management. Reports can be accessed quickly and easily, making school administration significantly lighter.',
      cornerBlob: 'bg-blue-100/30'
    },
    {
      id: '2',
      name: 'Rina Wulandari, S.Pd.',
      role: 'HOMEROOM TEACHER',
      school: 'SDN 2 Harapan Jaya',
      rating: 5,
      tag: 'User-Friendly',
      tagColor: 'bg-blue-50 text-blue-600 border-blue-100',
      avatarBg: 'bg-blue-100 text-blue-700',
      avatarType: 'illustration' as const,
      avatarGender: 'female',
      quote: 'The interface is clean and straightforward. Teachers adapted quickly; even those who were previously hesitant with modern tech could easily use it.',
      cornerBlob: 'bg-indigo-100/30'
    },
    {
      id: '3',
      name: 'Budi Santoso, S.Pd.',
      role: 'SUBJECT TEACHER',
      school: 'SDN 3 Cemara Indah',
      rating: 5,
      tag: 'Centralized Records',
      tagColor: 'bg-blue-50 text-blue-600 border-blue-100',
      avatarBg: 'bg-blue-100 text-blue-700',
      avatarType: 'illustration' as const,
      avatarGender: 'male',
      quote: 'Student profiles, staff records, and cohorts are seamlessly unified. This tremendously assists our official academic reporting with unmatched speed.',
      cornerBlob: 'bg-emerald-100/30'
    },
    {
      id: '4',
      name: 'Agus Priyono, S.Kom.',
      role: 'ADMINISTRATIVE STAFF',
      school: 'SDN 4 Melati',
      rating: 5,
      tag: 'Responsive Support',
      tagColor: 'bg-blue-50 text-blue-600 border-blue-100',
      avatarBg: 'bg-blue-100 text-blue-700',
      avatarType: 'illustration' as const,
      avatarGender: 'glasses',
      quote: 'The support team is exceptionally helpful and quick whenever we ask for assistance. Every question is answered thoroughly with practical solutions.',
      cornerBlob: 'bg-pink-100/30'
    }
  ];

  return (
    <section 
      id="testimoni" 
      className="scroll-mt-16 sm:scroll-mt-20 pt-16 sm:pt-20 pb-16 sm:pb-24 lg:py-0 lg:min-h-screen lg:h-screen lg:max-h-screen lg:flex lg:flex-col lg:justify-center bg-gradient-to-b from-[#F3F8FF] via-[#E9F3FE] to-[#DCEBFE] text-slate-900 relative antialiased overflow-hidden"
    >
      {/* Soft Ambient Background Glows */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />

      {/* Decorative Dot Matrix Patterns on Left & Right Margins (as in screenshot) */}
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

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        
        {/* ========================================================================= */}
        {/* SECTION HEADER: Main Title, Subtitle, Airplane & 3D School                */}
        {/* ========================================================================= */}
        <div className="relative text-center mb-6 sm:mb-8 lg:mb-3 xl:mb-5">
          
          {/* Top-Left Playful Paper Airplane with Trajectory Dashes */}
          <div className="hidden lg:block absolute -top-4 left-6 xl:left-12 pointer-events-none select-none">
            <div className="relative w-28 h-20">
              {/* Paper Airplane Dashed Flight Path */}
              <svg className="absolute inset-0 w-full h-full text-blue-400/80" viewBox="0 0 140 100" fill="none">
                <path 
                  d="M10 80 C 25 85, 45 75, 40 50 C 35 25, 65 30, 85 45 C 100 55, 115 35, 125 20" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeDasharray="4 4" 
                  strokeLinecap="round" 
                />
              </svg>
              {/* Airplane Icon / Graphic */}
              <div className="absolute right-0 top-1 rotate-[15deg]">
                <svg className="w-8 h-8 text-blue-500 fill-blue-500/90 drop-shadow-md" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Top-Right 3D Illustration of School with Flag & Bell Tower */}
          <div className="hidden xl:block absolute -top-8 right-2 xl:right-6 pointer-events-none select-none w-32 xl:w-40 opacity-80">
            <img 
              src="/images/pricing_school_3d.jpg" 
              alt="Indonesian School 3D Illustration" 
              className="w-full h-auto object-contain drop-shadow-lg"
              loading="lazy"
            />
          </div>

          {/* High-Contrast Main Title */}
          <h2 className="text-2xl sm:text-3xl lg:text-3xl xl:text-4xl font-black text-slate-900 tracking-tight leading-tight max-w-3xl mx-auto">
            <span>{isId ? 'Kepercayaan Sekolah' : 'Trusted by Schools'}</span>
            <span className="block text-blue-600 mt-0.5">{isId ? 'di Seluruh Indonesia' : 'Across Indonesia'}</span>
          </h2>

          {/* Subtitle Description */}
          <p className="mt-1.5 lg:mt-1 text-slate-600 text-xs sm:text-sm lg:text-xs xl:text-sm leading-relaxed max-w-xl mx-auto font-normal">
            {isId
              ? 'Kisah nyata dari kepala sekolah, wali kelas, guru, dan tata usaha yang telah merasakan manfaat sistem presensi ini.'
              : 'True stories from principals, homeroom teachers, subject instructors, and administrative staff who rely on our platform.'}
          </p>
        </div>

        {/* ========================================================================= */}
        {/* 4 TESTIMONIAL CARDS GRID: 4 Columns (Responsive: 1 Mobile, 2 Tablet, 4 PC) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-3 xl:gap-4">
          {testimonials.map((t) => (
            <div
              key={t.id}
              id={`testimonial-card-${t.id}`}
              className="bg-white rounded-3xl p-4 sm:p-5 lg:p-3 xl:p-4 shadow-[0_8px_24px_-8px_rgba(37,99,235,0.08)] border border-blue-100/80 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group min-h-[220px] lg:min-h-[175px] xl:min-h-[210px]"
            >
              {/* Bottom-right subtle corner organic blob */}
              <div className={`absolute -bottom-8 -right-8 w-28 h-28 ${t.cornerBlob} rounded-tl-full pointer-events-none transition-transform group-hover:scale-110`} />

              <div>
                {/* Top Row: 5 Yellow Stars + Right Tag Pill */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-1">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs ${t.tagColor}`}>
                    {t.tag}
                  </span>
                </div>

                {/* Double Quote Graphic Icons */}
                <div className="text-blue-300 mb-2 select-none">
                  <span className="text-3xl font-serif font-black leading-none opacity-80 inline-block tracking-tight">“</span>
                </div>

                {/* Testimonial Quote Text */}
                <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed font-normal mb-6">
                  "{t.quote}"
                </p>
              </div>

              {/* Author Row: Avatar + Name + Role + School + Green Verified Checkmark */}
              <div className="relative z-10 pt-4 border-t border-slate-100/90 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Avatar rendering */}
                  {t.avatarType === 'initials' ? (
                    <div className={`w-11 h-11 rounded-full ${t.avatarBg} flex items-center justify-center font-black text-sm shrink-0 shadow-xs`}>
                      {t.initials}
                    </div>
                  ) : t.avatarGender === 'female' ? (
                    <div className="w-11 h-11 rounded-full bg-blue-100 border border-blue-200 overflow-hidden flex items-center justify-center shrink-0">
                      {/* Stylized Female Teacher Avatar Illustration */}
                      <svg className="w-full h-full text-blue-700" viewBox="0 0 36 36" fill="currentColor">
                        <circle cx="18" cy="14" r="7" fill="#F8B195" />
                        <path d="M11 15c0-4 3-7 7-7s7 3 7 7c0 1-1 2-2 2-1 0-1-2-1-2s-1 2-4 2-4-2-4-2-1 2-1 2-1-1-2-2z" fill="#2C3E50" />
                        <path d="M8 32c0-5 4-8 10-8s10 3 10 8" fill="#3B82F6" />
                        <path d="M15 24h6v8h-6z" fill="#FFFFFF" />
                      </svg>
                    </div>
                  ) : t.avatarGender === 'glasses' ? (
                    <div className="w-11 h-11 rounded-full bg-blue-100 border border-blue-200 overflow-hidden flex items-center justify-center shrink-0">
                      {/* Stylized Glasses Male Staff Avatar Illustration */}
                      <svg className="w-full h-full text-blue-700" viewBox="0 0 36 36" fill="currentColor">
                        <circle cx="18" cy="14" r="7" fill="#F8B195" />
                        <path d="M12 12c0-4 3-6 6-6s6 2 6 6" fill="#1E293B" />
                        {/* Glasses */}
                        <circle cx="15" cy="14" r="2.5" fill="none" stroke="#1E293B" strokeWidth="1.2" />
                        <circle cx="21" cy="14" r="2.5" fill="none" stroke="#1E293B" strokeWidth="1.2" />
                        <line x1="17.5" y1="14" x2="18.5" y2="14" stroke="#1E293B" strokeWidth="1.2" />
                        <path d="M8 32c0-5 4-8 10-8s10 3 10 8" fill="#2563EB" />
                        <path d="M15 24h6v8h-6z" fill="#E2E8F0" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-blue-100 border border-blue-200 overflow-hidden flex items-center justify-center shrink-0">
                      {/* Stylized Male Teacher Avatar Illustration */}
                      <svg className="w-full h-full text-blue-700" viewBox="0 0 36 36" fill="currentColor">
                        <circle cx="18" cy="14" r="7" fill="#F8B195" />
                        <path d="M12 13c0-4 3-6 6-6s6 2 6 6" fill="#1E293B" />
                        <path d="M8 32c0-5 4-8 10-8s10 3 10 8" fill="#1D4ED8" />
                        <path d="M15 24h6v8h-6z" fill="#FFFFFF" />
                      </svg>
                    </div>
                  )}

                  {/* Name & Role */}
                  <div className="min-w-0">
                    <h4 className="font-black text-slate-900 text-xs sm:text-sm leading-tight truncate">
                      {t.name}
                    </h4>
                    <div className="text-[10px] sm:text-[11px] font-black text-blue-600 tracking-wider mt-0.5 uppercase truncate">
                      {t.role}
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                      <School className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{t.school}</span>
                    </div>
                  </div>
                </div>

                {/* Green Circle Checkmark Verified Badge */}
                <div className="shrink-0 text-emerald-500" title={isId ? 'Terverifikasi' : 'Verified'}>
                  <CheckCircle2 className="w-5 h-5 fill-emerald-50 text-emerald-500" />
                </div>
              </div>

            </div>
          ))}
        </div>

      </div>

      {/* Subtle Bottom Wave Curve to Match Flow */}
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

