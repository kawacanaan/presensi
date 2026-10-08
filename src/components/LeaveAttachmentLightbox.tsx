import React from 'react';
import { X, ExternalLink, Download } from 'lucide-react';

interface LeaveAttachmentLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title?: string;
}

export const LeaveAttachmentLightbox: React.FC<LeaveAttachmentLightboxProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title = 'Bukti Surat Izin / Keterangan Dokter',
}) => {
  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 md:p-6 lg:p-8 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl sm:rounded-3xl max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl w-full overflow-hidden shadow-2xl border border-slate-200/90 flex flex-col max-h-[95vh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3.5 sm:p-4.5 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/90 shrink-0">
          <div>
            <h3 className="font-black text-slate-900 text-sm sm:text-base">{title}</h3>
            <p className="text-[11px] text-slate-500">Lampiran bukti permohonan ketidakhadiran siswa</p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <a
              href={imageUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-200 transition-colors"
              title="Buka dokumen di tab baru"
            >
              <ExternalLink size={17} />
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Tutup pratinjau"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-slate-900/5 min-h-[280px]">
          <img
            src={imageUrl}
            alt={title}
            className="max-w-full max-h-[72vh] object-contain rounded-xl shadow-lg border border-slate-200/90 bg-white"
          />
        </div>

        <div className="p-3 sm:p-3.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="text-[11px] text-slate-500 font-medium">Dokumen Terlampir Resmi</span>
          <a
            href={imageUrl}
            download="berkas-surat-izin.jpg"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-2xs transition-colors"
          >
            <Download size={14} />
            <span>Unduh Berkas</span>
          </a>
        </div>
      </div>
    </div>
  );
};
