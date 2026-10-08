import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Users, 
  ExternalLink, 
  Sparkles, 
  CheckCircle2, 
  ShieldCheck, 
  QrCode, 
  Download, 
  Copy, 
  Check, 
  Maximize2, 
  ChevronRight,
  Share2
} from 'lucide-react';
import QRCode from 'qrcode';
import { KawacanaanEmblem } from '../../components/KawacanaanEmblem';
import { getPlatformLogo } from '../../utils/platformBranding';
import { WhatsAppQrModal } from './WhatsAppQrModal';

interface ContactSectionProps {
  lang: 'ID' | 'EN';
  onOpenRegister?: () => void;
}

export const ContactSection: React.FC<ContactSectionProps> = ({ lang }) => {
  // Official WhatsApp Group Community Link (Updated as requested)
  const whatsappCommunityLink = 'https://chat.whatsapp.com/Fjs8tXlNzkN44wolTS9zBC?s=cl&p=a&mlu=4&ilr=4';
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // Generate high-resolution scannable QR Code matching the group link
  useEffect(() => {
    QRCode.toDataURL(whatsappCommunityLink, {
      width: 500,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#071F42', // Deep navy for crisp optical scanner contrast
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Gagal membuat QR Code WhatsApp:', err);
      });
  }, [whatsappCommunityLink]);

  const handleCopyLink = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(whatsappCommunityLink);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = whatsappCommunityLink;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  // Generate downloadable flyer image (canvas export matching the uploaded poster exactly)
  const handleDownloadFlyer = () => {
    if (!qrDataUrl) return;
    setIsDownloading(true);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 720;
      canvas.height = 1280; // 9:16 vertical poster ratio matching official WhatsApp invite
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        setIsDownloading(false);
        return;
      }

      // WhatsApp Brand Green Background (#20C659 / #25D366)
      ctx.fillStyle = '#20C659';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // White invitation card container
      const cardW = 580;
      const cardH = 680;
      const cardX = (canvas.width - cardW) / 2;
      const cardY = 260;
      const cardRadius = 28;

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
      ctx.fill();

      // Load QR Image & Emblem
      const qrImg = new Image();
      qrImg.onload = () => {
        const emblemImg = new Image();
        emblemImg.onload = () => {
          // Circular emblem on top edge of white card
          const emblemSize = 100;
          const emblemX = (canvas.width - emblemSize) / 2;
          const emblemY = cardY - (emblemSize / 2);

          // White ring around emblem
          ctx.save();
          ctx.beginPath();
          ctx.arc(canvas.width / 2, cardY, (emblemSize / 2) + 6, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          ctx.restore();

          // Clip and draw emblem
          ctx.save();
          ctx.beginPath();
          ctx.arc(canvas.width / 2, cardY, emblemSize / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(emblemImg, emblemX, emblemY, emblemSize, emblemSize);
          ctx.restore();

          // Card Titles
          ctx.fillStyle = '#111827';
          ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Kawacanaan Presensi', canvas.width / 2, cardY + 95);

          ctx.fillStyle = '#4B5563';
          ctx.font = '500 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText('Grup WhatsApp', canvas.width / 2, cardY + 138);

          // Draw QR Code
          const qrSize = 420;
          const qrX = (canvas.width - qrSize) / 2;
          const qrY = cardY + 180;
          ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

          // Center WhatsApp badge on QR
          const pinSize = 64;
          const pinX = (canvas.width - pinSize) / 2;
          const pinY = qrY + (qrSize - pinSize) / 2;

          ctx.save();
          ctx.beginPath();
          ctx.arc(canvas.width / 2, qrY + (qrSize / 2), (pinSize / 2) + 4, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(canvas.width / 2, qrY + (qrSize / 2), pinSize / 2, 0, Math.PI * 2);
          ctx.fillStyle = '#25D366';
          ctx.fill();
          ctx.restore();

          // Bottom caption on green background (matching the uploaded image text)
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '500 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Pindai kode QR ini menggunakan', canvas.width / 2, cardY + cardH + 90);
          ctx.fillText('kamera WhatsApp untuk bergabung', canvas.width / 2, cardY + cardH + 128);
          ctx.fillText('ke grup ini', canvas.width / 2, cardY + cardH + 166);

          // Trigger download
          const link = document.createElement('a');
          link.download = 'Barcode-WhatsApp-Kawacanaan-Presensi.png';
          link.href = canvas.toDataURL('image/png');
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setIsDownloading(false);
        };
        emblemImg.src = getPlatformLogo();
      };
      qrImg.src = qrDataUrl;
    } catch (err) {
      console.error('Gagal mengunduh flyer barcode:', err);
      setIsDownloading(false);
    }
  };

  return (
    <section 
      id="kontak" 
      className="scroll-mt-16 sm:scroll-mt-20 pt-16 sm:pt-20 pb-16 sm:pb-24 lg:py-0 lg:min-h-screen lg:h-screen lg:max-h-screen lg:flex lg:flex-col lg:justify-center bg-gradient-to-b from-[#F3F8FF] via-[#E9F3FE] to-[#DCEBFE] text-slate-900 relative antialiased overflow-hidden"
    >
      {/* Background Soft Glows & Ambient Orbs */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-100/30 rounded-full blur-3xl pointer-events-none" />

      {/* Decorative Dot Matrix Patterns on Left & Right Margins (as in uploaded screenshot) */}
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

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* ================= SECTION HEADER: Fluid 3-Column / No Overlap Layout ================= */}
        <div className="relative mb-6 sm:mb-8 lg:mb-3 xl:mb-5">
          
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            
            {/* Left Decorative Doodle (Cleanly separated on wide viewports, no text collision) */}
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
                  {lang === 'ID' ? 'Jangan ragu' : 'Do not hesitate'}
                  <br />
                  <span className="text-blue-500 font-medium">
                    {lang === 'ID' ? 'untuk menghubungi' : 'to contact'}
                  </span>
                  <br />
                  <span className="font-extrabold text-blue-700">
                    {lang === 'ID' ? 'kami!' : 'our team!'}
                  </span>
                </p>

                {/* Curved Underline Arrow pointing toward the contact container */}
                <svg className="w-16 h-5 text-blue-400 mt-0.5 -rotate-6" viewBox="0 0 100 24" fill="none">
                  <path d="M5 12 Q 50 24 95 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {/* Center Content: Title, Subtitle, Indicator */}
            <div className="text-center flex-1 max-w-2xl mx-auto">
              {/* Main Heading */}
              <h2 className="text-2xl sm:text-3xl lg:text-3xl xl:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                <span>{lang === 'ID' ? 'Kontak Kami' : 'Contact Us'}</span>
                <span className="block text-blue-600 mt-0.5">Kawacanaan Presensi</span>
              </h2>
              
              {/* Subtitle Description */}
              <p className="mt-1.5 lg:mt-1 text-slate-600 text-xs sm:text-sm lg:text-xs xl:text-sm leading-relaxed font-normal max-w-xl mx-auto">
                {lang === 'ID'
                  ? 'Kami siap membantu Anda. Silakan hubungi kami melalui komunitas resmi, konsultasi langsung, atau pindai barcode WhatsApp di bawah ini.'
                  : 'We are ready to assist you. Reach out through our official educator community, direct consultation, or scan the WhatsApp barcode below.'}
              </p>
            </div>

            {/* Right 3D Stylized Envelope, Phone & Message Illustration */}
            <div className="hidden xl:flex justify-end w-40 pointer-events-none select-none shrink-0 pr-2">
              <div className="w-32 xl:w-36">
                <img 
                  src="/images/contact_envelope_clean.jpg" 
                  alt="3D Contact Message Envelope Illustration" 
                  className="w-full h-auto object-contain drop-shadow-xl rounded-2xl"
                  loading="lazy"
                />
              </div>
            </div>

          </div>

        </div>

        {/* ================= MAIN CONTAINER: 2 BALANCED COLUMNS (PRESERVED CONTENT) ================= */}
        <div className="max-w-5xl mx-auto">
          <div className="bg-white border border-blue-100 rounded-3xl shadow-[0_8px_30px_-10px_rgba(37,99,235,0.08)] overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0 items-stretch">
            
            {/* ================= LEFT COLUMN: INFORMASI & NILAI KOMUNITAS (7 COLS) ================= */}
            <div className="lg:col-span-7 p-5 sm:p-6 lg:p-4 xl:p-6 flex flex-col justify-between space-y-4 sm:space-y-5 lg:space-y-3 xl:space-y-4 border-b lg:border-b-0 lg:border-r border-slate-100">
              
              <div className="space-y-3 lg:space-y-2 xl:space-y-3">
                {/* Header Sub-badge */}
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10.5px] font-bold uppercase tracking-wider font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>WhatsApp Community SD</span>
                  </span>
                  
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{lang === 'ID' ? 'Terbuka & Gratis' : 'Free & Open'}</span>
                  </span>
                </div>

                {/* Subtitle & Value Proposition */}
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg lg:text-base xl:text-lg font-black text-[#0B2F64] tracking-tight uppercase">
                    {lang === 'ID' ? 'Mari Berjejaring & Maju Bersama' : 'Network & Grow Together'}
                  </h3>
                  <p className="text-xs lg:text-[11px] xl:text-xs text-slate-600 leading-relaxed font-normal">
                    {lang === 'ID'
                      ? 'Dapatkan bimbingan teknis langsung, template administrasi kehadiran siap cetak, dan pertukaran informasi seputar pengelolaan kelas sekolah dasar secara cepat melalui WhatsApp.'
                      : 'Get direct technical guidance, print-ready attendance administration templates, and rapid information sharing on primary school management.'}
                  </p>
                </div>

                {/* 4 Feature Highlights in 2x2 Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:border-blue-200 transition-colors">
                    <div className="flex items-center gap-2 font-bold text-[11px] sm:text-xs text-slate-900">
                      <div className="w-6 h-6 rounded-lg bg-blue-100/70 text-blue-700 flex items-center justify-center shrink-0">
                        <Users className="w-3 h-3" />
                      </div>
                      <span className="truncate">{lang === 'ID' ? 'Praktik Baik Guru & Wali' : 'Teacher Best Practices'}</span>
                    </div>
                    <p className="text-[10px] sm:text-[10.5px] text-slate-500 mt-1 leading-relaxed">
                      {lang === 'ID' ? 'Diskusi pengelolaan presensi harian dan mapel kelas 1 sampai 6.' : 'Daily and subject attendance management for grades 1-6.'}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:border-emerald-200 transition-colors">
                    <div className="flex items-center gap-2 font-bold text-[11px] sm:text-xs text-slate-900">
                      <div className="w-6 h-6 rounded-lg bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0">
                        <Sparkles className="w-3 h-3" />
                      </div>
                      <span className="truncate">{lang === 'ID' ? 'Update Rilis & Kedinasan' : 'Official Updates'}</span>
                    </div>
                    <p className="text-[10px] sm:text-[10.5px] text-slate-500 mt-1 leading-relaxed">
                      {lang === 'ID' ? 'Info format cetak standar kedinasan dan pembaruan fitur baru.' : 'Official educational printing standards and feature release updates.'}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:border-amber-200 transition-colors">
                    <div className="flex items-center gap-2 font-bold text-[11px] sm:text-xs text-slate-900">
                      <div className="w-6 h-6 rounded-lg bg-amber-100/70 text-amber-800 flex items-center justify-center shrink-0">
                        <MessageSquare className="w-3.5 h-3.5" />
                      </div>
                      <span className="truncate">{lang === 'ID' ? 'Diskusi & Tanya Jawab' : 'Q&A Discussions'}</span>
                    </div>
                    <p className="text-[10px] sm:text-[10.5px] text-slate-500 mt-1 leading-relaxed">
                      {lang === 'ID' ? 'Saling berbagi solusi kendala operasional presensi di lapangan.' : 'Rapid peer solutions for daily school operational attendance.'}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:border-purple-200 transition-colors">
                    <div className="flex items-center gap-2 font-bold text-[11px] sm:text-xs text-slate-900">
                      <div className="w-6 h-6 rounded-lg bg-purple-100/70 text-purple-700 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-3 h-3" />
                      </div>
                      <span className="truncate">{lang === 'ID' ? '100% Akses Terbuka' : '100% Free Access'}</span>
                    </div>
                    <p className="text-[10px] sm:text-[10.5px] text-slate-500 mt-1 leading-relaxed">
                      {lang === 'ID' ? 'Terbuka bagi guru, operator, dan kepala sekolah di Indonesia.' : 'Open to all teachers, operators, and principals nationwide.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Area: Direct Join & Copy Link */}
              <div className="space-y-2 pt-1">
                {/* Primary CTA: Direct Join WhatsApp Community */}
                <a
                  href={whatsappCommunityLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  id="btn-join-whatsapp-direct"
                  className="w-full py-2.5 sm:py-3 px-4 bg-[#25D366] hover:bg-[#20bd5a] active:scale-[0.99] text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider transition-all rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                  <span>{lang === 'ID' ? 'Gabung Komunitas WhatsApp' : 'Join WhatsApp Community'}</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-1 shrink-0" />
                </a>

                {/* Secondary Action: Copy Link */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    id="btn-copy-community-link"
                    className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                      copied
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                    <span>
                      {copied
                        ? (lang === 'ID' ? '✓ Tautan Berhasil Disalin!' : '✓ Link Copied to Clipboard!')
                        : (lang === 'ID' ? 'Salin Tautan Undangan' : 'Copy Invitation Link')}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    id="btn-enlarge-qr"
                    className="py-2 sm:py-2.5 px-3 rounded-xl text-[11px] sm:text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all flex items-center justify-center gap-1 cursor-pointer"
                    title={lang === 'ID' ? 'Perbesar Barcode QR' : 'Enlarge Barcode QR'}
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden sm:inline">{lang === 'ID' ? 'Perbesar' : 'Enlarge'}</span>
                  </button>
                </div>

                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10.5px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>{lang === 'ID' ? 'Tautan Resmi Terverifikasi' : 'Official Verified Link'}</span>
                  </div>
                  <span className="font-mono text-[9.5px] text-slate-400 hidden sm:inline">chat.whatsapp.com</span>
                </div>
              </div>

            </div>

            {/* ================= RIGHT COLUMN: WHATSAPP BARCODE FLYER (5 COLS) ================= */}
            {/* Styled faithfully to match the uploaded WhatsApp flyer card */}
            <div className="lg:col-span-5 bg-gradient-to-b from-[#20C659] via-[#1EB852] to-[#128C7E] p-4 sm:p-5 lg:p-3 xl:p-5 flex flex-col items-center justify-center text-center relative">
              
              {/* Subtle ambient light behind white card */}
              <div className="absolute inset-0 bg-white/5 pointer-events-none" />

              {/* The WhatsApp White Card */}
              <div className="relative w-full max-w-[240px] sm:max-w-[270px] lg:max-w-[220px] xl:max-w-[250px] bg-white rounded-3xl p-4 sm:p-5 lg:p-3.5 xl:p-4.5 shadow-xl border border-white/40 my-1">
                
                {/* Circular Emblem at top of card */}
                <div className="flex justify-center -mt-8 sm:-mt-9 lg:-mt-7 xl:-mt-8 mb-1.5">
                  <div className="p-1 rounded-2xl bg-white shadow-md ring-2 ring-slate-100">
                    <KawacanaanEmblem size={44} />
                  </div>
                </div>

                {/* Card Titles */}
                <h4 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-snug">
                  Kawacanaan Presensi
                </h4>
                <p className="text-[11px] text-slate-500 font-semibold mb-2">
                  Grup WhatsApp
                </p>

                {/* QR Code Container with WhatsApp Pin */}
                <div 
                  className="relative mx-auto p-1.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs cursor-pointer group"
                  onClick={() => setIsModalOpen(true)}
                  title="Klik untuk memperbesar Barcode QR"
                >
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Barcode QR WhatsApp Kawacanaan Presensi"
                      className="w-36 h-36 sm:w-40 sm:h-40 lg:w-32 lg:h-32 xl:w-36 xl:h-36 object-contain rounded-lg mx-auto transition-transform duration-200 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="w-36 h-36 sm:w-40 sm:h-40 lg:w-32 lg:h-32 xl:w-36 xl:h-36 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                      <QrCode className="w-10 h-10 animate-pulse text-slate-300" />
                    </div>
                  )}

                  {/* Centered WhatsApp Telephone Badge */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white p-0.5 shadow-md border border-slate-100 flex items-center justify-center pointer-events-none">
                    <div className="w-full h-full rounded-full bg-[#25D366] flex items-center justify-center text-white">
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                      </svg>
                    </div>
                  </div>

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-slate-900/60 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5 backdrop-blur-2xs">
                    <Maximize2 className="w-4 h-4" />
                    <span>{lang === 'ID' ? 'Perbesar' : 'Enlarge'}</span>
                  </div>
                </div>

              </div>

              {/* Caption text below white card (matches the uploaded image) */}
              <p className="text-white text-[11px] sm:text-xs font-medium leading-relaxed max-w-[240px] sm:max-w-[260px] mt-2 opacity-95">
                {lang === 'ID'
                  ? 'Pindai kode QR ini menggunakan kamera WhatsApp untuk bergabung ke grup ini'
                  : 'Scan this QR code using your WhatsApp camera to join this group'}
              </p>

              {/* Download Flyer Button */}
              <div className="w-full max-w-[240px] sm:max-w-[270px] lg:max-w-[220px] xl:max-w-[250px] mt-2.5">
                <button
                  type="button"
                  onClick={handleDownloadFlyer}
                  disabled={isDownloading}
                  className="w-full py-2 px-3 bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 active:scale-98 shadow-xs"
                  title={lang === 'ID' ? 'Unduh Barcode Format Siap Cetak & Bagikan' : 'Download Barcode Ready to Print/Share'}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {isDownloading 
                      ? (lang === 'ID' ? 'Menyiapkan Gambar...' : 'Preparing Image...') 
                      : (lang === 'ID' ? 'Unduh Barcode (PNG)' : 'Download Barcode (PNG)')}
                  </span>
                </button>
              </div>

            </div>

          </div>
        </div>

      </div>

      {/* WhatsApp QR Modal for High-Resolution Scan & Download */}
      <WhatsAppQrModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        qrDataUrl={qrDataUrl}
        communityUrl={whatsappCommunityLink}
        lang={lang}
        onDownloadQr={handleDownloadFlyer}
      />

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
