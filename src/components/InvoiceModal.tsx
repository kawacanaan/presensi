import React, { useRef, useState } from 'react';
import {
  X,
  Printer,
  Download,
  Copy,
  Check,
  ExternalLink,
  Share2,
  FileText,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { InvoiceDocument, InvoiceItemData } from './InvoiceDocument';
import { getSmartInvoiceUrl, copySmartInvoiceLink, exportInvoiceToPdf, openSmartInvoiceTab } from '../utils/smartInvoice';

export type InvoiceData = InvoiceItemData;

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: InvoiceData | null;
  onShowToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  data,
  onShowToast,
}) => {
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const printContainerRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !data) return null;

  const smartUrl = getSmartInvoiceUrl(data.invoiceNumber);

  const handleCopySmartLink = async () => {
    const ok = await copySmartInvoiceLink(data.invoiceNumber);
    if (ok) {
      setCopied(true);
      if (onShowToast) {
        onShowToast('Smart Link PDF berhasil disalin ke clipboard!', 'success');
      }
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleOpenSmartLink = () => {
    openSmartInvoiceTab(data);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!printContainerRef.current) {
      window.print();
      return;
    }
    setIsExporting(true);
    try {
      await exportInvoiceToPdf(printContainerRef.current, `Invoice_${data.invoiceNumber}.pdf`);
      if (onShowToast) {
        onShowToast('Invoice PDF berhasil diunduh.', 'success');
      }
    } catch (err) {
      console.error('Invoice PDF export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible">
      {/* Container Faktur / Smart Link PDF Modal */}
      <div className="bg-slate-100 rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-300/80 overflow-hidden my-6 flex flex-col print:shadow-none print:border-none print:rounded-none print:my-0 print:max-w-full print:bg-white animate-in fade-in zoom-in-95 duration-200">
        {/* ACTION BAR: Smart Link PDF Controls (Hidden in Print) */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <FileText size={16} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-slate-100">
                  Smart Link PDF Invoice
                </span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                  <Sparkles size={10} />
                  <span>Aktif</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono truncate max-w-xs sm:max-w-md">
                {smartUrl}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Salin Smart Link */}
            <button
              type="button"
              onClick={handleCopySmartLink}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                copied
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title="Salin tautan Smart Link untuk dibagikan ke WhatsApp / Email"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span className="hidden sm:inline">{copied ? 'Tersalin' : 'Salin Smart Link'}</span>
            </button>

            {/* Buka Tab Baru */}
            <button
              type="button"
              onClick={handleOpenSmartLink}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Buka tampilan publik Smart Link di tab baru"
            >
              <ExternalLink size={14} />
              <span className="hidden md:inline">Buka Tab Baru</span>
            </button>

            {/* Unduh PDF */}
            <button
              type="button"
              disabled={isExporting}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void handleDownloadPdf(e);
              }}
              id="btn-unduh-pdf-invoice-modal"
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              title="Unduh file PDF A4 resmi"
            >
              {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              <span>{isExporting ? 'Membuat PDF...' : 'Unduh PDF'}</span>
            </button>

            {/* Cetak */}
            <button
              type="button"
              onClick={handlePrint}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
              title="Cetak langsung lewat printer browser"
            >
              <Printer size={15} />
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer ml-1"
              title="Tutup Pratinjau"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* INVOICE CANVAS / PRINTABLE AREA */}
        <div className="p-4 sm:p-8 flex items-center justify-center overflow-x-auto bg-slate-100/90 print:p-0 print:bg-white">
          <div
            ref={printContainerRef}
            className="w-full max-w-[820px] bg-white rounded-2xl shadow-xl border border-slate-200 print:shadow-none print:border-none print:rounded-none overflow-hidden"
          >
            <InvoiceDocument data={data} />
          </div>
        </div>

        {/* BOTTOM ACTION BAR (Hidden in print) */}
        <div className="bg-white px-6 py-3.5 border-t border-slate-200 flex items-center justify-between gap-3 print:hidden text-xs">
          <div className="text-slate-500 text-[11.5px] flex items-center gap-2">
            <span className="font-semibold text-slate-700">Tips:</span>
            <span>Tautan Smart Link dapat diakses langsung oleh sekolah &amp; guru tanpa login.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySmartLink}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Share2 size={13} />
              <span>Bagi Link</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer size={13} />
              <span>Cetak Sekarang</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
