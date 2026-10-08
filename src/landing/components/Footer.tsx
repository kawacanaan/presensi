import React from 'react';
import { 
  ArrowUp, 
  Phone, 
  Mail, 
  Globe, 
  Instagram, 
  MessageSquare,
  ShieldCheck,
  FileText,
  BookOpen
} from 'lucide-react';
import { LegalTabType } from './TermsAndLegalModal';
import { KawacanaanEmblem } from '../../components/KawacanaanEmblem';

interface FooterProps {
  lang: 'ID' | 'EN';
  onOpenLegal: (tab: LegalTabType) => void;
}

export const Footer: React.FC<FooterProps> = ({ lang, onOpenLegal }) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navLinks = [
    { label: lang === 'ID' ? 'Beranda' : 'Home', href: '#beranda' },
    { label: lang === 'ID' ? 'Fitur' : 'Features', href: '#fitur' },
    { label: lang === 'ID' ? 'Keunggulan' : 'Advantages', href: '#keunggulan' },
    { label: lang === 'ID' ? 'Harga' : 'Pricing', href: '#harga' },
    { label: lang === 'ID' ? 'Testimoni' : 'Testimonials', href: '#testimoni' },
    { label: lang === 'ID' ? 'Blog' : 'Blog', href: '#blog' },
  ];

  return (
    <footer className="bg-[#07162C] text-slate-400 text-xs border-t border-blue-950 relative overflow-hidden">
      {/* Subtle background glow effect */}
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-900/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-sky-900/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8 mb-14">
          
          {/* Column 1: Brand Info & Description & Socials */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-center gap-3">
              <KawacanaanEmblem size={44} />
              <div>
                <span className="text-lg font-black text-white uppercase tracking-tight block">
                  Kawacanaan
                </span>
                <span className="text-[10px] text-blue-200 font-bold uppercase tracking-wider">
                  {lang === 'ID' ? 'Sistem Presensi Digital Sekolah Dasar' : 'Primary School Digital Attendance'}
                </span>
              </div>
            </div>

            <div className="space-y-3 max-w-md">
              <p className="text-slate-300 text-xs leading-relaxed font-medium">
                {lang === 'ID'
                  ? 'Solusi terpadu presensi dan administrasi kesiswaan khusus Sekolah Dasar di Indonesia.'
                  : 'Integrated attendance and student administration solution dedicated to Primary Schools in Indonesia.'}
              </p>
              
              <p className="text-slate-400 text-xs leading-relaxed font-normal">
                Kawacanaan Presensi — Dual-mode presensi harian & mapel, kalkulasi otomatis hari belajar efektif, rekapitulasi berkala, dan laporan format standar kedinasan A4.
              </p>
            </div>

            {/* Social Icons */}
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="w-9 h-9 rounded-lg bg-blue-950/80 border border-blue-900/60 hover:border-blue-500 hover:bg-blue-900 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-xs"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="https://wa.me/6281312498919?text=Halo%20Admin%20Kawacanaan,%20saya%20ingin%20konsultasi%20Sistem%20Presensi%20Digital"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="w-9 h-9 rounded-lg bg-blue-950/80 border border-blue-900/60 hover:border-emerald-500 hover:bg-emerald-900/40 text-slate-400 hover:text-emerald-400 flex items-center justify-center transition-all cursor-pointer shadow-xs"
              >
                <MessageSquare className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Column 2: Menu */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="font-black text-white text-xs uppercase tracking-wider">
              {lang === 'ID' ? 'Menu' : 'Menu'}
            </h4>
            <ul className="space-y-2.5 text-xs">
              {navLinks.map((link, idx) => (
                <li key={idx}>
                  <a 
                    href={link.href} 
                    className="text-slate-400 hover:text-white transition-colors block font-medium"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Bantuan (User Guide, Privacy Policy, Terms & Conditions) */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="font-black text-white text-xs uppercase tracking-wider">
              {lang === 'ID' ? 'Bantuan' : 'Support & Legal'}
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegal('guide')}
                  className="text-slate-400 hover:text-blue-400 transition-colors text-left font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 opacity-70" />
                  <span>{lang === 'ID' ? 'Panduan Pengguna' : 'User Guide'}</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegal('privacy')}
                  className="text-slate-400 hover:text-blue-400 transition-colors text-left font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 opacity-70" />
                  <span>{lang === 'ID' ? 'Kebijakan Privasi' : 'Privacy Policy'}</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegal('terms')}
                  className="text-slate-400 hover:text-blue-400 transition-colors text-left font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 opacity-70" />
                  <span>{lang === 'ID' ? 'Syarat & Ketentuan' : 'Terms & Conditions'}</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Column 4: Hubungi Kami */}
          <div className="lg:col-span-3 space-y-4">
            <h4 className="font-black text-white text-xs uppercase tracking-wider">
              {lang === 'ID' ? 'Hubungi Kami' : 'Contact Us'}
            </h4>
            
            <ul className="space-y-3 text-xs text-slate-400">
              <li>
                <a 
                  href="tel:+6281312498919" 
                  className="flex items-center gap-2.5 hover:text-white transition-colors group"
                >
                  <Phone className="w-4 h-4 text-blue-400/70 group-hover:text-blue-400 shrink-0" />
                  <span className="font-semibold text-slate-300 group-hover:text-white">+62 813-1249-8919</span>
                </a>
              </li>
              <li>
                <a 
                  href="mailto:maulanayusuf05@guru.sd.belajar.id" 
                  className="flex items-center gap-2.5 hover:text-white transition-colors group"
                >
                  <Mail className="w-4 h-4 text-blue-400/70 group-hover:text-blue-400 shrink-0" />
                  <span className="break-all font-medium">maulanayusuf05@guru.sd.belajar.id</span>
                </a>
              </li>
              <li>
                <a 
                  href="https://kawacanaan.sch.id" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 hover:text-white transition-colors group"
                >
                  <Globe className="w-4 h-4 text-blue-400/70 group-hover:text-blue-400 shrink-0" />
                  <span className="font-medium">www.kawacanaan.sch.id</span>
                </a>
              </li>
              <li className="pt-1 text-[11px] text-slate-500 font-medium">
                Indonesia
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-blue-900/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-medium text-slate-500">
          <div>
            © 2026 Kawacanaan. {lang === 'ID' ? 'Seluruh hak cipta dilindungi.' : 'All rights reserved.'}
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => onOpenLegal('terms')}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              {lang === 'ID' ? 'Syarat & Ketentuan' : 'Terms'}
            </button>
            <button
              onClick={() => onOpenLegal('privacy')}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              {lang === 'ID' ? 'Privasi' : 'Privacy'}
            </button>
            <button 
              onClick={scrollToTop} 
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors cursor-pointer font-bold"
            >
              <span>{lang === 'ID' ? 'Ke Atas' : 'Back to Top'}</span>
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
};
