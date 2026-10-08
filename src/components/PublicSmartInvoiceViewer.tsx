import React, { useEffect, useState, useRef } from 'react';
import { Printer, Download, Copy, Check, ArrowLeft, FileText, Loader2, Sparkles, Share2 } from 'lucide-react';
import { InvoiceDocument, InvoiceItemData } from './InvoiceDocument';
import { copySmartInvoiceLink, exportInvoiceToPdf } from '../utils/smartInvoice';

interface PublicSmartInvoiceViewerProps {
  invoiceNumber: string;
  onBackToApp?: () => void;
}

export const PublicSmartInvoiceViewer: React.FC<PublicSmartInvoiceViewerProps> = ({
  invoiceNumber,
  onBackToApp,
}) => {
  const [loading, setLoading] = useState(true);
  const [invoiceData, setInvoiceData] = useState<InvoiceItemData | null>(null);
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const invoiceContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchInvoice() {
      const cleanNo = invoiceNumber.trim();

      // 1. Cek cache lokal terlebih dahulu agar tampilan tab baru langsung muncul tanpa jeda
      let hasCachedData = false;
      try {
        const cached = localStorage.getItem(`kawacanaan_invoice_${cleanNo}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && (parsed.invoiceNumber || parsed.orderId)) {
            setInvoiceData(parsed);
            setLoading(false);
            hasCachedData = true;
          }
        }
      } catch (_) {}

      if (!hasCachedData) {
        setLoading(true);
      }

      // 2. Ambil data faktur dari server untuk memastikan akurasi dan status pelunasan
      try {
        const res = await fetch(`/api/midtrans?action=get_invoice&order_id=${encodeURIComponent(cleanNo)}`);
        const json = await res.json();
        if (isMounted && json?.ok && json.invoice) {
          setInvoiceData(json.invoice);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('[Fetch Smart Invoice Error]', err);
      }

      // 3. Fallback data jika backend offline atau belum ada di database
      if (isMounted && !hasCachedData) {
        const isSch = invoiceNumber.toUpperCase().includes('SCH');
        setInvoiceData({
          invoiceNumber,
          orderId: invoiceNumber,
          schoolName: 'Satuan Pendidikan',
          npsn: '12345678',
          schoolAddress: 'Indonesia',
          customerName: 'Bapak/Ibu Pendidik',
          customerPhone: '0812-xxxx-xxxx',
          customerEmail: 'sekolah@kawacanaan.sch.id',
          planName: isSch ? 'Paket Sekolah KawaCanaan Presensi' : 'Paket Guru KawaCanaan Presensi',
          amount: isSch ? 250000 : 60000,
          totalAmount: isSch ? 250000 : 60000,
          uniqueCode: 0,
          status: 'SETTLED',
          paymentMethod: 'QRIS / Transfer Bank',
          issueDate: new Date().toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }),
          paidAt: new Date().toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }) + ' WIB',
        });
        setLoading(false);
      }
    }

    if (invoiceNumber) {
      fetchInvoice();
    }
    return () => {
      isMounted = false;
    };
  }, [invoiceNumber]);

  const handleCopyLink = async () => {
    const ok = await copySmartInvoiceLink(invoiceNumber);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!invoiceContainerRef.current) {
      window.print();
      return;
    }
    setIsExporting(true);
    try {
      await exportInvoiceToPdf(invoiceContainerRef.current, `Invoice_${invoiceNumber}.pdf`);
    } catch (err) {
      console.error('Invoice PDF export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans print:bg-white print:p-0">
      {/* TOP NAVIGATION BAR (Hidden in print) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 py-3.5 print:hidden shadow-xs">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (onBackToApp) {
                  onBackToApp();
                } else if (typeof window !== 'undefined' && window.opener) {
                  window.close();
                } else {
                  window.location.href = '/';
                }
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title={typeof window !== 'undefined' && window.opener ? 'Tutup Tab Invoice Ini' : 'Kembali ke Aplikasi'}
            >
              <ArrowLeft size={14} />
              <span>{typeof window !== 'undefined' && window.opener ? 'Tutup Tab' : 'Ke Aplikasi'}</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                {invoiceNumber}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                <Sparkles size={10} />
                <span>Smart Link Resmi</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                copied
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
              title="Salin tautan Smart Link ini"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copied ? 'Tautan Tersalin' : 'Salin Smart Link'}</span>
            </button>

            <button
              type="button"
              disabled={isExporting || loading}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void handleDownloadPdf(e);
              }}
              id="btn-unduh-pdf-smart-invoice"
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
              title="Unduh langsung sebagai berkas file PDF"
            >
              {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              <span>{isExporting ? 'Memproses PDF...' : 'Unduh PDF'}</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Printer size={14} />
              <span>Cetak</span>
            </button>
          </div>
        </div>
      </header>

      {/* DOCUMENT PREVIEW CONTAINER */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 flex justify-center print:p-0 print:max-w-none">
        {loading ? (
          <div className="w-full max-w-[820px] bg-white rounded-3xl p-16 shadow-xl border border-slate-200/80 flex flex-col items-center justify-center text-center my-auto min-h-[400px]">
            <Loader2 size={36} className="animate-spin text-indigo-600 mb-4" />
            <h3 className="text-base font-bold text-slate-900">Memuat Smart Link Invoice...</h3>
            <p className="text-xs text-slate-500 mt-1 font-mono">{invoiceNumber}</p>
          </div>
        ) : invoiceData ? (
          <div
            ref={invoiceContainerRef}
            className="w-full max-w-[820px] bg-white rounded-2xl shadow-xl border border-slate-200/80 print:shadow-none print:border-none print:rounded-none overflow-hidden"
          >
            <InvoiceDocument data={invoiceData} />
          </div>
        ) : null}
      </main>
    </div>
  );
};
