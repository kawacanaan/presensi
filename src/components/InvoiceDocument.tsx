import React from 'react';
import { KawacanaanEmblem } from './KawacanaanEmblem';

export interface InvoiceItemData {
  id?: string;
  invoiceNumber: string;
  orderId?: string;
  schoolName: string;
  npsn?: string;
  schoolAddress?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  planName: string;
  periodText?: string;
  quantity?: number;
  amount: number;
  uniqueCode?: number;
  totalAmount?: number;
  issueDate?: string;
  dueDate?: string;
  paidAt?: string;
  paymentMethod?: string;
  status: 'paid' | 'settled' | 'pending' | 'overdue' | 'expired' | 'cancelled' | string;
  notes?: string;
}

interface InvoiceDocumentProps {
  data: InvoiceItemData;
  className?: string;
}

export const InvoiceDocument: React.FC<InvoiceDocumentProps> = ({ data, className = '' }) => {
  const isSettled =
    data.status === 'paid' ||
    data.status === 'settled' ||
    data.status === 'SETTLED' ||
    data.status === 'SUCCESS' ||
    data.status === 'capture';

  const isPending =
    data.status === 'pending' ||
    data.status === 'PENDING';

  const isExpired =
    data.status === 'overdue' ||
    data.status === 'expired' ||
    data.status === 'EXPIRED' ||
    data.status === 'cancelled';

  // Resolusi nama paket & periode
  const rawPlan = (data.planName || '').toLowerCase();
  const isSchool = rawPlan.includes('sekolah');
  const isYearly = rawPlan.includes('tahun') || (isSchool ? data.amount >= 200000 : data.amount >= 50000);

  const displayPlanName = data.planName
    ? (data.planName.startsWith('Paket') ? data.planName : `Paket ${data.planName}`)
    : isSchool
    ? 'Paket Sekolah KawaCanaan Presensi'
    : 'Paket Guru KawaCanaan Presensi';

  // Format tanggal & periode jika belum ada
  const today = new Date();
  const issueDateFormatted = data.issueDate || today.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const nextYear = new Date(today.getTime() + (isYearly ? 365 : 30) * 24 * 60 * 60 * 1000);
  const nextYearFormatted = nextYear.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const currentFormatted = today.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const periodString = data.periodText || `${currentFormatted} – ${nextYearFormatted}`;

  const paidAtFormatted = data.paidAt || (isSettled ? `${issueDateFormatted}, 22:15 WIB` : '-');

  const basePrice = data.amount || 60000;
  const uniqueCode = data.uniqueCode || 0;
  const grandTotal = data.totalAmount || (basePrice + uniqueCode);
  const qty = data.quantity || 1;

  return (
    <div
      className={`bg-white text-slate-800 p-8 sm:p-12 max-w-[820px] mx-auto font-sans leading-normal select-text print:p-6 print:max-w-none print:w-full ${className}`}
      style={{ minHeight: '1050px' }}
    >
      {/* 1. HEADER: Logo, Brand & Title INVOICE */}
      <div className="flex items-start justify-between gap-4">
        {/* Left: Kawacanaan Brand */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 shrink-0">
            <KawacanaanEmblem size="lg" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 uppercase">
              KAWACANAAN
            </h1>
            <p className="text-xs sm:text-[13px] text-slate-500 font-medium mt-0.5">
              Platform Presensi Digital Sekolah Dasar
            </p>
          </div>
        </div>

        {/* Right: Big Blue INVOICE */}
        <div className="text-right">
          <span className="text-2xl sm:text-3xl font-black tracking-tight text-[#1a56db] uppercase">
            INVOICE
          </span>
        </div>
      </div>

      {/* Blue Horizontal Divider Line */}
      <div className="h-[2.5px] bg-[#1a56db] w-full mt-4 mb-6" />

      {/* 2. STATUS BANNER (Sesuai Desain: Mint Green box dengan checkmark & teks) */}
      {isSettled && (
        <div className="bg-[#ecfdf5] border border-emerald-100 rounded-xl p-4 flex items-center gap-5 mb-6">
          <div className="text-[#16a34a] font-black text-base sm:text-lg flex items-center gap-1.5 shrink-0 pl-1">
            <span className="text-xl">✓</span>
            <span>LUNAS</span>
          </div>
          <div className="border-l border-emerald-200/80 pl-5">
            <div className="font-bold text-slate-900 text-xs sm:text-sm">
              Pembayaran berhasil diterima
            </div>
            <div className="text-slate-600 text-[11px] sm:text-xs mt-0.5">
              Invoice ini merupakan bukti pembayaran yang sah.
            </div>
          </div>
        </div>
      )}

      {isPending && (
        <div className="bg-[#eff6ff] border border-blue-100 rounded-xl p-4 flex items-center gap-5 mb-6">
          <div className="text-blue-600 font-black text-base sm:text-lg flex items-center gap-1.5 shrink-0 pl-1">
            <span className="text-xl">⏳</span>
            <span>MENUNGGU</span>
          </div>
          <div className="border-l border-blue-200 pl-5">
            <div className="font-bold text-slate-900 text-xs sm:text-sm">
              Menunggu Pelunasan Pembayaran
            </div>
            <div className="text-slate-600 text-[11px] sm:text-xs mt-0.5">
              Silakan selesaikan pembayaran sebelum batas waktu jatuh tempo berakhir.
            </div>
          </div>
        </div>
      )}

      {isExpired && (
        <div className="bg-[#fff1f2] border border-rose-100 rounded-xl p-4 flex items-center gap-5 mb-6">
          <div className="text-rose-600 font-black text-base sm:text-lg flex items-center gap-1.5 shrink-0 pl-1">
            <span className="text-xl">✕</span>
            <span>KEDALUWARSA</span>
          </div>
          <div className="border-l border-rose-200 pl-5">
            <div className="font-bold text-slate-900 text-xs sm:text-sm">
              Tagihan Telah Kedaluwarsa / Dibatalkan
            </div>
            <div className="text-slate-600 text-[11px] sm:text-xs mt-0.5">
              Batas waktu pembayaran telah habis. Harap buat pesanan baru jika ingin berlangganan.
            </div>
          </div>
        </div>
      )}

      {/* 3. METADATA & DITAGIHKAN KEPADA (2 Kolom) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 my-6 text-xs leading-relaxed">
        {/* Kolom Kiri: Metadata Faktur */}
        <div className="space-y-1.5">
          <div className="grid grid-cols-[130px_1fr] items-baseline">
            <span className="text-slate-500 font-medium">Nomor Invoice</span>
            <span className="font-mono font-bold text-slate-900">{data.invoiceNumber}</span>
          </div>
          <div className="grid grid-cols-[130px_1fr] items-baseline">
            <span className="text-slate-500 font-medium">Tanggal Invoice</span>
            <span className="text-slate-800">{issueDateFormatted}</span>
          </div>
          <div className="grid grid-cols-[130px_1fr] items-baseline">
            <span className="text-slate-500 font-medium">Tanggal Pembayaran</span>
            <span className="text-slate-800">{paidAtFormatted}</span>
          </div>
          <div className="grid grid-cols-[130px_1fr] items-baseline">
            <span className="text-slate-500 font-medium">Status</span>
            <div>
              {isSettled ? (
                <span className="font-black text-[#16a34a] uppercase">LUNAS</span>
              ) : isPending ? (
                <span className="font-black text-blue-600 uppercase">MENUNGGU PEMBAYARAN</span>
              ) : (
                <span className="font-black text-rose-600 uppercase">KEDALUWARSA</span>
              )}
            </div>
          </div>
        </div>

        {/* Kolom Kanan: DITAGIHKAN KEPADA */}
        <div className="space-y-1 sm:pl-4">
          <div className="text-[11px] font-black uppercase tracking-wider text-slate-900 pb-0.5">
            DITAGIHKAN KEPADA
          </div>
          <div className="font-bold text-slate-900 text-sm">
            {data.schoolName || 'Satuan Pendidikan SD'}
          </div>
          <div className="text-slate-700">
            NPSN: <span className="font-mono">{data.npsn && data.npsn !== '-' ? data.npsn : '12345678'}</span>
          </div>
          <div className="text-slate-600">
            {data.schoolAddress || 'Jl. Pendidikan No. 10, Jakarta'}
          </div>
          <div className="text-slate-800">
            {data.customerName || 'Bapak/Ibu Pendidik'}
            <span className="mx-1 text-slate-400">—</span>
            <span className="font-mono">{data.customerPhone || '0812-xxxx-xxxx'}</span>
          </div>
          <div className="text-slate-600 font-mono text-[11.5px]">
            {data.customerEmail || 'sekolah@example.sch.id'}
          </div>
        </div>
      </div>

      {/* 4. RINCIAN LAYANAN */}
      <div className="mt-8 mb-6">
        <div className="text-[11px] font-black uppercase tracking-wider text-slate-900 mb-2.5">
          RINCIAN LAYANAN
        </div>

        {/* Tabel Layanan */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#eff6ff] text-slate-800 font-bold border-b border-slate-200">
                <th className="py-2.5 px-4 font-bold">Deskripsi</th>
                <th className="py-2.5 px-4 font-bold">Periode</th>
                <th className="py-2.5 px-3 text-center font-bold">Qty</th>
                <th className="py-2.5 px-4 text-right font-bold">Harga</th>
                <th className="py-2.5 px-4 text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              <tr>
                <td className="py-3.5 px-4 font-medium text-slate-900">
                  {displayPlanName}
                </td>
                <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                  {periodString}
                </td>
                <td className="py-3.5 px-3 text-center font-semibold text-slate-700">
                  {qty}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-slate-800 whitespace-nowrap">
                  Rp{basePrice.toLocaleString('id-ID')}
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                  Rp{(basePrice * qty).toLocaleString('id-ID')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Ringkasan Subtotal, Kode Unik & Total Dibayar */}
        <div className="flex justify-end mt-4">
          <div className="w-64 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-700">
              <span>Subtotal</span>
              <span className="font-mono">Rp{(basePrice * qty).toLocaleString('id-ID')}</span>
            </div>

            {uniqueCode > 0 ? (
              <div className="flex justify-between text-slate-700">
                <span>Kode Unik</span>
                <span className="font-mono">Rp{uniqueCode.toLocaleString('id-ID')}</span>
              </div>
            ) : null}

            {/* Garis pemisah tegas */}
            <div className="border-t-2 border-slate-900 my-1 pt-1.5 flex justify-between items-baseline font-black text-slate-900 text-sm">
              <span>TOTAL DIBAYAR</span>
              <span className="font-mono text-base">
                Rp{grandTotal.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. DETAIL PEMBAYARAN */}
      <div className="mt-8 mb-10">
        <div className="text-[11px] font-black uppercase tracking-wider text-slate-900 mb-2.5">
          DETAIL PEMBAYARAN
        </div>
        <div className="bg-[#f8fafc] border border-slate-200/80 rounded-xl p-4 sm:p-5 text-xs text-slate-800 space-y-1 leading-relaxed">
          <div>
            <span className="font-semibold text-slate-700">Metode Pembayaran: </span>
            <span className="font-bold text-slate-900">{data.paymentMethod || 'QRIS'}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-700">Status Transaksi: </span>
            <span className="font-bold text-slate-900">
              {isSettled
                ? 'LUNAS / BERHASIL'
                : isPending
                ? 'MENUNGGU PEMBAYARAN'
                : 'KEDALUWARSA'}
            </span>
          </div>
          <div>
            <span className="font-semibold text-slate-700">Tanggal Pembayaran: </span>
            <span className="font-mono text-slate-800">{paidAtFormatted}</span>
          </div>
          <div className="pt-1 text-slate-600 text-[11.5px]">
            {isSettled
              ? 'Invoice ini telah dibayar dan tidak memiliki sisa tagihan.'
              : isPending
              ? 'Silakan scan QRIS atau bayar via Virtual Account sebelum waktu batas habis.'
              : 'Invoice ini telah kedaluwarsa atau dibatalkan oleh sistem.'}
          </div>
        </div>
      </div>

      {/* 6. FOOTER RESMI (Sesuai Gambar: KawaCanaan Presensi di kiri, Diterbitkan Elektronik & Halaman di kanan) */}
      <div className="border-t border-slate-200 pt-4 mt-auto flex items-end justify-between text-xs text-slate-600">
        {/* Left Footer */}
        <div className="space-y-0.5">
          <div className="font-bold text-slate-900 text-xs">KawaCanaan Presensi</div>
          <div className="text-[11px] text-slate-600">
            Presensi digital yang lebih tertib, akurat, dan mudah digunakan untuk Sekolah Dasar.
          </div>
          <div className="text-[11px] text-slate-500 pt-0.5 font-medium">
            Website: <span className="text-slate-700 font-semibold">kawacanaan.com</span>
            <span className="mx-2 text-slate-300">|</span>
            Email: <span className="text-slate-700 font-semibold">admin@kawacanaan.com</span>
          </div>
        </div>

        {/* Right Footer */}
        <div className="text-right space-y-1">
          <div className="text-[11px] text-slate-500">
            Invoice diterbitkan<br />secara elektronik.
          </div>
          <div className="text-xs font-bold text-slate-900 pt-1">
            1 dari 1
          </div>
        </div>
      </div>
    </div>
  );
};
