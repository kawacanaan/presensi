import React from 'react';
import { Calendar, Clock, BookOpen, ArrowRight } from 'lucide-react';

interface BlogSectionProps {
  lang: 'ID' | 'EN';
}

export const BlogSection: React.FC<BlogSectionProps> = ({ lang }) => {
  const isId = lang === 'ID';

  const posts = isId ? [
    {
      id: '1',
      title: 'Mengapa Sekolah Perlu Beralih ke Sistem Presensi Digital?',
      category: 'Digitalisasi Sekolah',
      readTime: '4 menit baca',
      date: '18 Agu 2026',
      snippet: 'Membahas efisiensi teknologi presensi digital dalam merapikan administrasi rombel dan meningkatkan akurasi data kehadiran di sekolah dasar.',
      image: '/images/blog/330-ribu-sekolah-akan-dibekali-layar-digital-pintar-tahun-ini-1758534297510_169.jpeg',
    },
    {
      id: '2',
      title: 'Cara Mengelola Rekap Kehadiran Siswa dengan Lebih Efisien',
      category: 'Manajemen Kehadiran',
      readTime: '5 menit baca',
      date: '12 Agu 2026',
      snippet: 'Langkah praktis menyusun rekapitulasi kehadiran bulanan dan semester tanpa risiko kesalahan, menggunakan sistem presensi terpadu.',
      image: '/images/blog/batas-usia-masuk-sd-diperbarui-anak-di-bawah-7-tahun-bisa-sekolah-dengan-syarat-ini-154159.webp',
    },
    {
      id: '3',
      title: 'Digitalisasi Administrasi Sekolah: Dari Data hingga Laporan',
      category: 'Administrasi Sekolah',
      readTime: '6 menit baca',
      date: '05 Agu 2026',
      snippet: 'Panduan menyederhanakan alur kerja tata usaha dan dewan guru SD dalam pembuatan laporan dengan sistem digital yang terintegrasi.',
      image: '/images/blog/IFP_Elementary_School-_4259-scaled.jpg',
    }
  ] : [
    {
      id: '1',
      title: 'Why Should Schools Transition to Digital Attendance Systems?',
      category: 'School Digitalization',
      readTime: '4 min read',
      date: 'Aug 18, 2026',
      snippet: 'Exploring how modern attendance tools streamline primary school administration and improve attendance accuracy.',
      image: '/images/blog/330-ribu-sekolah-akan-dibekali-layar-digital-pintar-tahun-ini-1758534297510_169.jpeg',
    },
    {
      id: '2',
      title: 'How to Manage Student Attendance Summaries Efficiently',
      category: 'Attendance Management',
      readTime: '5 min read',
      date: 'Aug 12, 2026',
      snippet: 'Practical steps to compile monthly and term attendance records without spreadsheet errors using integrated attendance.',
      image: '/images/blog/batas-usia-masuk-sd-diperbarui-anak-di-bawah-7-tahun-bisa-sekolah-dengan-syarat-ini-154159.webp',
    },
    {
      id: '3',
      title: 'School Administration Digitization: From Data to Reporting',
      category: 'School Administration',
      readTime: '6 min read',
      date: 'Aug 05, 2026',
      snippet: 'Comprehensive insights into simplifying primary school workflows into integrated, digital-ready institutional formats.',
      image: '/images/blog/IFP_Elementary_School-_4259-scaled.jpg',
    }
  ];

  return (
    <section 
      id="blog" 
      className="scroll-mt-16 sm:scroll-mt-20 pt-16 sm:pt-20 pb-16 sm:pb-24 lg:py-0 lg:min-h-screen lg:h-screen lg:max-h-screen lg:flex lg:flex-col lg:justify-center bg-gradient-to-b from-[#F3F8FF] via-[#E9F3FE] to-[#DCEBFE] text-slate-900 relative antialiased overflow-hidden"
    >
      {/* Background Soft Glows & Ambient Orbs */}
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
        {/* SECTION HEADER: Main Title, Subtitle, Doodle & 3D Idea Laptop            */}
        {/* ========================================================================= */}
        <div className="relative text-center mb-6 sm:mb-8 lg:mb-3 xl:mb-5">
          
          {/* Top-Left Playful Handwritten Doodle Note (as in screenshot) */}
          <div className="hidden lg:block absolute -top-2 left-6 xl:left-14 pointer-events-none select-none text-left">
            <div className="relative">
              {/* Doodle Spark Lines */}
              <div className="absolute -top-3.5 right-6 flex gap-1 rotate-12">
                <div className="w-1 h-3 bg-blue-500 rounded-full -rotate-15" />
                <div className="w-1 h-3.5 bg-blue-500 rounded-full" />
                <div className="w-1 h-3 bg-blue-500 rounded-full rotate-15" />
              </div>
              
              {/* Handwritten Blue Note */}
              <p className="font-sans font-bold text-sm xl:text-base text-blue-600 -rotate-8 leading-snug tracking-tight">
                {isId ? 'Wawasan Baru' : 'New Insights'}
                <br />
                <span className="text-blue-500 font-medium">
                  {isId ? 'untuk Sekolah' : 'for Progressive'}
                </span>
                <br />
                <span className="font-extrabold text-blue-700">
                  {isId ? 'Lebih Maju' : 'Schools'}
                </span>
              </p>

              {/* Curved Underline Arrow */}
              <svg className="w-16 h-4 text-blue-400 mt-0.5 -rotate-6" viewBox="0 0 100 24" fill="none">
                <path d="M5 12 Q 50 24 95 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* Top-Right 3D Stylized Laptop, Glowing Bulb & Books Illustration */}
          <div className="hidden xl:block absolute -top-8 right-4 xl:right-10 pointer-events-none select-none w-32 xl:w-40">
            <img 
              src="/images/blog_3d_idea_laptop.jpg" 
              alt="Digital School 3D Illustration with Light Bulb and Laptop" 
              className="w-full h-auto object-contain drop-shadow-lg rounded-2xl"
              loading="lazy"
            />
          </div>

          {/* High-Contrast Main Title */}
          <h2 className="text-2xl sm:text-3xl lg:text-3xl xl:text-4xl font-black text-slate-900 tracking-tight leading-tight max-w-3xl mx-auto">
            <span>{isId ? 'Tips & Digitalisasi' : 'Tips & Digitalization'}</span>
            <span className="block text-blue-600 mt-0.5">{isId ? 'Sekolah Dasar' : 'for Primary Schools'}</span>
          </h2>

          {/* Subtitle Description */}
          <p className="mt-1.5 lg:mt-1 text-slate-600 text-xs sm:text-sm lg:text-xs xl:text-sm leading-relaxed max-w-xl mx-auto font-normal">
            {isId
              ? 'Edukasi dan panduan praktis pengelolaan presensi serta administrasi sekolah dasar.'
              : 'Actionable guidance and practical insights for primary school attendance administration.'}
          </p>
        </div>

        {/* ========================================================================= */}
        {/* 3 BLOG POST CARDS: 3 Columns Grid                                         */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-3.5 xl:gap-5">
          {posts.map((post) => (
            <article
              key={post.id}
              id={`blog-card-${post.id}`}
              className="bg-white rounded-3xl overflow-hidden shadow-[0_8px_24px_-8px_rgba(37,99,235,0.08)] border border-blue-100/80 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 group flex flex-col justify-between"
            >
              <div>
                {/* Thumbnail Image with Category Badge */}
                <div className="relative h-40 sm:h-44 lg:h-28 xl:h-36 overflow-hidden bg-slate-100 block">
                  <img 
                    src={post.image} 
                    alt={post.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  {/* Category Pill Tag */}
                  <span className="absolute top-2.5 left-2.5 bg-[#144CB3]/90 backdrop-blur-xs text-white px-2.5 py-0.5 rounded-md text-[10.5px] font-bold tracking-wide shadow-xs">
                    {post.category}
                  </span>
                </div>

                {/* Card Content */}
                <div className="p-4 sm:p-5 lg:p-3 xl:p-4 pb-1 space-y-2">
                  {/* Date & Read Time */}
                  <div className="flex items-center gap-2.5 text-[11px] font-semibold text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" /> {post.date}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" /> {post.readTime}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm sm:text-base lg:text-xs xl:text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors leading-snug line-clamp-2">
                    {post.title}
                  </h3>

                  {/* Snippet */}
                  <p className="text-xs lg:text-[11px] xl:text-xs text-slate-600 leading-relaxed font-normal line-clamp-2">
                    {post.snippet}
                  </p>
                </div>
              </div>

              {/* Read More Link */}
              <div className="p-4 pt-1 lg:p-3 lg:pt-1">
                <span className="text-xs lg:text-[11px] xl:text-xs font-bold uppercase tracking-wider text-blue-600 group-hover:text-blue-700 inline-flex items-center gap-1 transition-colors cursor-pointer">
                  {isId ? 'BACA SELENGKAPNYA →' : 'READ MORE →'}
                </span>
              </div>
            </article>
          ))}
        </div>

        {/* Bottom CTA Button: "Lihat Semua Artikel →" */}
        <div className="text-center mt-4 sm:mt-6 lg:mt-3 xl:mt-5">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-600/20 hover:shadow-blue-600/30 transition-all duration-200 cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-white" />
            <span>{isId ? 'Lihat Semua Artikel' : 'View All Articles'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
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

