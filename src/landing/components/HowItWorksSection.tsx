import React from 'react';
import { School, UserPlus, CheckCircle2, ArrowRight, BookOpen, FileSpreadsheet } from 'lucide-react';

interface HowItWorksSectionProps {
  lang: 'ID' | 'EN';
  onOpenRegister: () => void;
}

export const HowItWorksSection: React.FC<HowItWorksSectionProps> = ({ lang, onOpenRegister }) => {
  const steps = lang === 'ID' ? [
    {
      step: '01',
      title: 'PROFIL SD & ROMBEL 1-6',
      desc: 'Masukkan NPSN sekolah, tetapkan rombongan belajar Kelas 1 sampai Kelas 6, serta atur kalender hari belajar efektif.',
      icon: School,
      tag: 'Konfigurasi Awal'
    },
    {
      step: '02',
      title: 'DATA SISWA & PENUGASAN GURU',
      desc: 'Import data siswa dan NISN dari file Excel atau Dapodik, lalu tugaskan akun Wali Kelas dan Guru Mata Pelajaran sesuai struktur sekolah.',
      icon: UserPlus,
      tag: 'Sinkronisasi Data'
    },
    {
      step: '03',
      title: 'PRESENSI & CETAK KEDINASAN',
      desc: 'Mulai pencatatan kehadiran harian atau jam mapel, dan unduh laporan rekapitulasi format A4 siap tanda tangan kapan saja.',
      icon: FileSpreadsheet,
      tag: 'Operasional & Laporan'
    },
  ] : [
    {
      step: '01',
      title: 'SD PROFILE & GRADE 1-6',
      desc: 'Input school ID, configure Grade 1 through 6 study groups, and set up the official effective learning calendar.',
      icon: School,
      tag: 'Initial Setup'
    },
    {
      step: '02',
      title: 'STUDENTS & TEACHER ROLES',
      desc: 'Import student rosters with national IDs from Excel, and assign Homeroom and subject teacher accounts tailored to your school.',
      icon: UserPlus,
      tag: 'Data Sync'
    },
    {
      step: '03',
      title: 'ATTENDANCE & KEDINASAN EXPORT',
      desc: 'Conduct daily and subject check-ins, then export official A4 printable reports ready for signatures anytime.',
      icon: FileSpreadsheet,
      tag: 'Live Operations & Reports'
    },
  ];

  return (
    <section id="cara-kerja" className="py-16 sm:py-20 lg:py-24 bg-slate-50 text-slate-900 relative border-b border-blue-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-left max-w-3xl space-y-4 mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-[10px] font-bold uppercase tracking-wider">
            <span>{lang === 'ID' ? 'ALUR PENERAPAN DI SD' : 'PRIMARY SCHOOL IMPLEMENTATION'}</span>
          </div>
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-[#0B2F64] tracking-tight uppercase leading-[1.05]">
            {lang === 'ID' ? (
              <>
                MULAI DALAM<br />
                <span className="text-blue-600">3 LANGKAH MUDAH</span>
              </>
            ) : (
              <>
                GET STARTED IN<br />
                <span className="text-blue-600">3 SIMPLE STEPS</span>
              </>
            )}
          </h2>
          <p className="text-slate-600 text-xs sm:text-base lg:text-lg leading-relaxed border-l-4 border-blue-600 pl-3 sm:pl-4 font-normal">
            {lang === 'ID'
              ? 'Proses adopsi sistem cepat dan mudah, disesuaikan dengan struktur organisasi dan kebutuhan Sekolah Dasar.'
              : 'Rapid and smooth onboarding aligned with Primary School organizational structure and operational needs.'}
          </p>
        </div>

        {/* 3 Steps Grid with connecting line */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {steps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div 
                key={idx}
                id={`how-it-works-step-${idx}`}
                className="bg-white border border-slate-200 rounded-xl p-8 shadow-xs hover:border-blue-500 hover:shadow-md transition-all relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-mono text-3xl font-black text-[#0B2F64]">
                      {item.step}
                    </span>
                    <div className="w-12 h-12 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>

                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-1 block font-mono">
                    {item.tag}
                  </span>
                  <h3 className="text-lg font-black text-[#0B2F64] mb-3 uppercase tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed font-normal">
                    {item.desc}
                  </p>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <span>{lang === 'ID' ? `Tahap ${idx + 1} dari 3` : `Step ${idx + 1} of 3`}</span>
                  {idx < 2 && (
                    <span className="text-blue-700 font-bold hidden md:inline">
                      {lang === 'ID' ? 'Lanjut →' : 'Next →'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Callout bar */}
        <div className="mt-12 p-6 bg-blue-50/60 border border-blue-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs">
          <div className="text-center sm:text-left">
            <h4 className="text-sm font-black uppercase text-[#0B2F64] tracking-wide">
              {lang === 'ID' ? 'Butuh bantuan migrasi data siswa SD dari Dapodik / Excel?' : 'Need help importing elementary student rosters from Excel?'}
            </h4>
            <p className="text-xs text-slate-600 mt-0.5">
              {lang === 'ID' 
                ? 'Tim Kawacanaan siap membantu import data rombel kelas 1-6 dan setup kalender akademik sekolah Anda.'
                : 'The Kawacanaan team is ready to assist with class 1-6 roster imports and academic calendar configurations.'}
            </p>
          </div>
          <button
            onClick={onOpenRegister}
            className="px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold uppercase tracking-wider transition-all rounded-lg shrink-0 cursor-pointer shadow-sm flex items-center gap-2"
          >
            <span>{lang === 'ID' ? 'Daftar Sekolah Sekarang' : 'Register School Now'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </section>
  );
};
