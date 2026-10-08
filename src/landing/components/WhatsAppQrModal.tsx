import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  ExternalLink, 
  QrCode, 
  Sparkles,
  Smartphone,
  ShieldCheck
} from 'lucide-react';
import { KawacanaanEmblem } from '../../components/KawacanaanEmblem';

interface WhatsAppQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrDataUrl: string;
  communityUrl: string;
  lang: 'ID' | 'EN';
  onDownloadQr?: () => void;
}

export const WhatsAppQrModal: React.FC<WhatsAppQrModalProps> = ({
  isOpen,
  onClose,
  qrDataUrl,
  communityUrl,
  lang,
  onDownloadQr,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(communityUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = communityUrl;
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

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-sm sm:max-w-md bg-gradient-to-b from-[#128C7E] to-[#075E54] rounded-3xl p-4 sm:p-6 shadow-2xl text-white border border-emerald-400/30 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        id="modal-whatsapp-qr"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 w-9 h-9 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-all cursor-pointer z-20"
          aria-label="Tutup"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-4 pt-1">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-emerald-100 text-[10px] font-bold uppercase tracking-wider mb-2">
            <QrCode className="w-3.5 h-3.5" />
            <span>{lang === 'ID' ? 'KODE QR KOMUNITAS RESMI' : 'OFFICIAL COMMUNITY QR'}</span>
          </span>
          <h3 className="text-lg sm:text-xl font-black tracking-tight text-white">
            {lang === 'ID' ? 'Bergabung via Barcode QR' : 'Join via Barcode QR'}
          </h3>
          <p className="text-xs text-emerald-100/80 mt-0.5">
            {lang === 'ID' 
              ? 'Arahkan kamera WhatsApp ponsel Anda langsung ke kode di bawah'
              : 'Point your WhatsApp phone camera directly at the code below'}
          </p>
        </div>

        {/* The WhatsApp Invitation Card Container (White Paper) */}
        <div className="bg-white text-slate-900 rounded-2xl p-5 sm:p-6 shadow-xl relative text-center">
          
          {/* Top Emblem Badge */}
          <div className="flex justify-center -mt-9 sm:-mt-10 mb-2.5">
            <div className="p-1 rounded-2xl bg-white shadow-md ring-2 ring-slate-100">
              <KawacanaanEmblem size={52} />
            </div>
          </div>

          {/* Group Title */}
          <h4 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
            Kawacanaan Presensi
          </h4>
          <p className="text-xs text-slate-500 font-semibold mb-3">
            Grup WhatsApp
          </p>

          {/* QR Code Canvas / Image with WhatsApp Center Badge */}
          <div className="relative inline-block mx-auto p-2 bg-white rounded-xl border border-slate-200/80 shadow-xs">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Barcode QR WhatsApp Komunitas Kawacanaan"
                className="w-52 h-52 sm:w-60 sm:h-60 object-contain rounded-lg mx-auto"
              />
            ) : (
              <div className="w-52 h-52 sm:w-60 sm:h-60 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                <QrCode className="w-12 h-12 animate-pulse text-slate-300" />
              </div>
            )}

            {/* Centered WhatsApp Pin */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white p-1 shadow-md border border-slate-100 flex items-center justify-center pointer-events-none">
              <div className="w-full h-full rounded-full bg-[#25D366] flex items-center justify-center text-white">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Instruction Note */}
          <p className="text-[11px] sm:text-xs text-slate-600 mt-3 font-medium leading-relaxed max-w-[280px] mx-auto">
            {lang === 'ID' 
              ? 'Pindai kode QR ini menggunakan kamera WhatsApp untuk bergabung ke grup ini'
              : 'Scan this QR code using WhatsApp camera to join this group'}
          </p>

          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[10px] text-emerald-800 font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Grup Resmi Kawacanaan Presensi</span>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="mt-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                copied 
                  ? 'bg-emerald-400 text-slate-950 border-emerald-300' 
                  : 'bg-white/15 hover:bg-white/25 text-white border-white/20'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? (lang === 'ID' ? 'Tersalin!' : 'Copied!') : (lang === 'ID' ? 'Salin Tautan' : 'Copy Link')}</span>
            </button>

            {onDownloadQr && (
              <button
                type="button"
                onClick={onDownloadQr}
                className="py-2.5 px-3 rounded-xl text-xs font-bold bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{lang === 'ID' ? 'Unduh Barcode' : 'Download QR'}</span>
              </button>
            )}
          </div>

          <a
            href={communityUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <span>{lang === 'ID' ? 'Buka Langsung di WhatsApp' : 'Open Directly in WhatsApp'}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

      </div>
    </div>
  );
};
