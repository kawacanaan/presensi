import React, { useState } from 'react';
import { ChevronUp, ChevronDown, MessageSquare, ArrowRight } from 'lucide-react';

interface FaqSectionProps {
  lang: 'ID' | 'EN';
  onOpenRegister: () => void;
}

export const FaqSection: React.FC<FaqSectionProps> = ({ lang }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const isId = lang === 'ID';

  const faqs = isId ? [
    {
      id: '01',
      q: 'Apakah Kawacanaan dapat digunakan oleh semua sekolah?',
      a: 'Ya. Sistem dapat dikonfigurasi sesuai kebutuhan data dan operasional sekolah.'
    },
    {
      id: '02',
      q: 'Siapa saja yang dapat menggunakan Kawacanaan?',
      a: 'Sistem mendukung beberapa peran, seperti Admin, Kepala Sekolah, Wali Kelas/Guru, dan Siswa.'
    },
    {
      id: '03',
      q: 'Apakah siswa dapat melakukan presensi sendiri?',
      a: 'Ya. Sekolah dapat mengaktifkan fitur presensi mandiri siswa sesuai kebutuhan.'
    },
    {
      id: '04',
      q: 'Apakah data kehadiran dapat direkap?',
      a: 'Ya. Sistem menyediakan rekapitulasi berdasarkan periode tertentu, termasuk harian, mingguan, bulanan, dan semester.'
    },
    {
      id: '05',
      q: 'Apakah laporan dapat digunakan untuk kebutuhan administrasi sekolah?',
      a: 'Ya. Data kehadiran dapat disusun menjadi laporan berdasarkan periode yang dipilih.'
    },
    {
      id: '06',
      q: 'Apakah setiap pengguna memiliki akses yang sama?',
      a: 'Tidak. Akses sistem disesuaikan berdasarkan peran pengguna.'
    }
  ] : [
    {
      id: '01',
      q: 'Can Kawacanaan be used by any school?',
      a: 'Yes. The system can be configured flexibly according to the specific data structures and operational workflows of your school.'
    },
    {
      id: '02',
      q: 'Who can use the Kawacanaan platform?',
      a: 'The system supports distinct role-based access for Administrators, School Principals, Homeroom/Subject Teachers, and Students.'
    },
    {
      id: '03',
      q: 'Can students record their attendance independently?',
      a: 'Yes. Schools can enable student self check-in features via individual mobile or web devices as needed.'
    },
    {
      id: '04',
      q: 'Can attendance records be summarized automatically?',
      a: 'Yes. The system provides automatic recapitulation across customizable periods including daily, weekly, monthly, and semester views.'
    },
    {
      id: '05',
      q: 'Are reports suitable for official school administration?',
      a: 'Yes. Attendance records are readily formatted into structured printable PDFs and Excel spreadsheets for institutional filing.'
    },
    {
      id: '06',
      q: 'Does every user have the same level of access?',
      a: 'No. Access permissions and administrative capabilities are strictly scoped by user roles to ensure security and privacy.'
    }
  ];

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section 
      id="faq" 
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

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        
        {/* ========================================================================= */}
        {/* SECTION HEADER: Non-overlapping 3-Column / Fluid Layout                    */}
        {/* ========================================================================= */}
        <div className="relative mb-6 sm:mb-8 lg:mb-3 xl:mb-5">
          
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            
            {/* Left Decorative Doodle (Visible on large screens, cleanly positioned outside text) */}
            <div className="hidden xl:flex flex-col items-start w-40 pointer-events-none select-none shrink-0 pl-2">
              <div className="relative">
                {/* Doodle Spark Lines */}
                <div className="absolute -top-3.5 right-4 flex gap-1 rotate-12">
                  <div className="w-1 h-3 bg-blue-500 rounded-full -rotate-15" />
                  <div className="w-1 h-3.5 bg-blue-500 rounded-full" />
                  <div className="w-1 h-3 bg-blue-500 rounded-full rotate-15" />
                </div>
                
                {/* Handwritten Blue Note */}
                <p className="font-sans font-bold text-sm text-blue-600 -rotate-6 leading-snug tracking-tight">
                  {isId ? 'Masih ada' : 'Still have'}
                  <br />
                  <span className="font-extrabold text-blue-700">
                    {isId ? 'pertanyaan?' : 'questions?'}
                  </span>
                </p>

                {/* Curved Underline Arrow pointing toward the accordion cards */}
                <svg className="w-14 h-6 text-blue-500 mt-0.5 -rotate-6" viewBox="0 0 100 40" fill="none">
                  <path d="M10 10 Q 30 35 70 30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M60 22 L 72 30 L 62 38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* Center Content: Title, Subtitle, Indicator */}
            <div className="text-center flex-1 max-w-2xl mx-auto">
              {/* High-Contrast Main Title */}
              <h2 className="text-2xl sm:text-3xl lg:text-3xl xl:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                <span>{isId ? 'Pertanyaan yang Sering' : 'Frequently Asked'}</span>
                <span className="block text-blue-600 mt-0.5">{isId ? 'Ditanyakan' : 'Questions'}</span>
              </h2>

              {/* Subtitle Description */}
              <p className="mt-1.5 lg:mt-1 text-slate-600 text-xs sm:text-sm lg:text-xs xl:text-sm leading-relaxed max-w-xl mx-auto font-normal">
                {isId
                  ? 'Jawaban lengkap seputar fitur, akses pengguna, dan implementasi sistem Kawacanaan.'
                  : 'Complete answers regarding features, user access levels, and system implementation of Kawacanaan.'}
              </p>
            </div>

            {/* Right 3D Stylized School with Flag, Clock Tower & Textbooks */}
            <div className="hidden xl:flex justify-end w-40 pointer-events-none select-none shrink-0 pr-2">
              <div className="w-32 xl:w-36">
                <img 
                  src="/images/faq_school_clean.jpg" 
                  alt="Indonesian Elementary School 3D Illustration" 
                  className="w-full h-auto object-contain drop-shadow-xl rounded-2xl"
                  loading="lazy"
                />
              </div>
            </div>

          </div>

        </div>

        {/* ========================================================================= */}
        {/* ACCORDION FAQ CARDS: Modern Clean Cards with Rounded Corners & Blue Ring  */}
        {/* ========================================================================= */}
        <div className="space-y-2 lg:space-y-2 xl:space-y-2.5 max-w-3xl mx-auto">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={faq.id}
                id={`faq-item-${idx}`}
                className={`bg-white rounded-2xl sm:rounded-3xl transition-all duration-200 border ${
                  isOpen 
                    ? 'border-blue-400 shadow-[0_8px_24px_-6px_rgba(37,99,235,0.12)]' 
                    : 'border-blue-100/90 hover:border-blue-300 shadow-[0_2px_12px_-4px_rgba(37,99,235,0.04)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full px-4 py-3 sm:px-5 sm:py-3.5 lg:py-2.5 xl:py-3 text-left flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Number Pill Badge (e.g. 01, 02) */}
                    <span className="font-sans text-xs font-bold text-blue-600 bg-blue-100/80 w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0">
                      {faq.id}
                    </span>
                    <h3 className="text-xs sm:text-sm lg:text-xs xl:text-sm font-bold text-slate-900 leading-snug">
                      {faq.q}
                    </h3>
                  </div>

                  {/* Circular Chevron Toggle Button */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ${
                    isOpen ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-100'
                  }`}>
                    {isOpen ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 sm:px-5 sm:pb-4.5 pt-0 text-xs lg:text-[11.5px] xl:text-xs text-slate-600 leading-relaxed border-t border-slate-100 mt-0.5 pt-2.5 pl-12 sm:pl-14 font-normal">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* BOTTOM CONSULTATION CTA BANNER (as in screenshot)                         */}
        {/* ========================================================================= */}
        <div className="mt-4 sm:mt-6 lg:mt-3 xl:mt-4.5 max-w-2xl mx-auto">
          <div className="p-3 sm:p-3.5 bg-white/80 backdrop-blur-xs border border-blue-200/90 rounded-2xl sm:rounded-3xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-700 font-medium">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-blue-600">
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              <span>
                {isId 
                  ? 'Punya pertanyaan spesifik seputar sekolah Anda?' 
                  : 'Have specific questions about your institution?'}
              </span>
            </div>

            <a
              href="https://wa.me/6281312498919?text=Halo%20Tim%20Kawacanaan%2C%20saya%20ingin%20konsultasi%20gratis%20mengenai%20presensi%20sekolah"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 hover:shadow-blue-600/30 transition-all cursor-pointer shrink-0"
            >
              <span>{isId ? 'Konsultasi Gratis dengan Tim Kami' : 'Free Consultation with Our Team'}</span>
              <ArrowRight className="w-3 h-3" />
            </a>
          </div>
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

