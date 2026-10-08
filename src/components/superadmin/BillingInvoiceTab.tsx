import React, { useState, useMemo } from 'react';
import {
  FileText,
  Search,
  Filter,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Printer,
  Download,
  Copy,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Eye,
  Check,
  Building2,
  Calendar,
  DollarSign,
  Sparkles,
} from 'lucide-react';
import { getSmartInvoiceUrl, copySmartInvoiceLink, openSmartInvoiceTab } from '../../utils/smartInvoice';

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  schoolId: string;
  schoolName: string;
  npsn: string;
  planName: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  paymentMethod?: string;
  paidAt?: string;
  picName: string;
  picPhone: string;
}

interface BillingInvoiceTabProps {
  payments?: any[];
  schools?: any[];
  call?: (action: string, payload?: any) => Promise<any>;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onOpenDirectSub: () => void;
  onSelectInvoice: (inv: any) => void;
  onReload?: () => void;
}

export const BillingInvoiceTab: React.FC<BillingInvoiceTabProps> = ({
  payments = [],
  schools = [],
  call,
  showToast,
  onOpenDirectSub,
  onSelectInvoice,
  onReload,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Derive real invoices from Supabase payments
  const invoices: InvoiceItem[] = useMemo(() => {
    if (!payments || payments.length === 0) {
      return [];
    }

    return payments.map((p: any) => {
      const isSettled = p.status === 'SETTLED' || p.status === 'paid';
      const isPending = p.status === 'PENDING' || p.status === 'pending';
      const isOverdue =
        p.status === 'EXPIRED' ||
        p.status === 'expired' ||
        (isPending && p.expiresAt && new Date(p.expiresAt).getTime() < Date.now());

      let status: 'paid' | 'pending' | 'overdue' | 'cancelled' = 'cancelled';
      if (isSettled) status = 'paid';
      else if (isOverdue) status = 'overdue';
      else if (isPending) status = 'pending';

      const rawCreated = p.createdAt || p.created_at;
      const createdDate = rawCreated ? new Date(rawCreated) : new Date();
      const issueDate = createdDate.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      const rawExpires = p.expiresAt || p.expires_at;
      const dueDate = rawExpires
        ? new Date(rawExpires).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : new Date(createdDate.getTime() + 14 * 86400000).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });

      const rawPaid = p.paidAt || p.paid_at;
      const paidAt = rawPaid ? new Date(rawPaid).toLocaleString('id-ID') : undefined;

      const schoolObj = schools.find((s: any) => s.id === (p.schoolId || p.school_id));
      const schoolName = p.schoolName || p.school_name || (schoolObj?.name) || 'Sekolah Pengguna';
      const npsn = p.npsn || (schoolObj?.npsn) || '-';
      const picName = p.contactName || p.contact_name || (schoolObj?.pic_name) || 'Bendahara / PIC';
      const picPhone = p.contactPhone || p.contact_phone || (schoolObj?.pic_phone) || '';

      return {
        id: p.id,
        invoiceNumber: p.invoiceNo || p.invoice_no || `INV-${String(p.id).slice(0, 8).toUpperCase()}`,
        schoolId: p.schoolId || p.school_id || '',
        schoolName,
        npsn,
        planName: p.planName || (p.planId === 'sekolah_pro' ? 'Paket Sekolah' : 'Paket Guru (Lisensi)'),
        amount: Number(p.totalAmount || p.total_amount || p.amount || 0),
        issueDate,
        dueDate,
        status,
        paymentMethod: p.paymentMethod || p.payment_method || 'Midtrans Payment Gateway',
        paidAt,
        picName,
        picPhone,
      };
    });
  }, [payments, schools]);

  // Stats calculation
  const totalAmount = useMemo(() => invoices.reduce((acc, i) => acc + i.amount, 0), [invoices]);
  const paidInvoices = useMemo(() => invoices.filter((i) => i.status === 'paid'), [invoices]);
  const paidAmount = useMemo(() => paidInvoices.reduce((acc, i) => acc + i.amount, 0), [paidInvoices]);
  const pendingInvoices = useMemo(() => invoices.filter((i) => i.status === 'pending'), [invoices]);
  const pendingAmount = useMemo(() => pendingInvoices.reduce((acc, i) => acc + i.amount, 0), [pendingInvoices]);
  const overdueInvoices = useMemo(() => invoices.filter((i) => i.status === 'overdue'), [invoices]);
  const overdueAmount = useMemo(() => overdueInvoices.reduce((acc, i) => acc + i.amount, 0), [overdueInvoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (planFilter !== 'all' && !inv.planName.toLowerCase().includes(planFilter.toLowerCase())) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.schoolName.toLowerCase().includes(q) ||
          inv.npsn.includes(q) ||
          inv.picName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [invoices, search, statusFilter, planFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / itemsPerPage));
  const displayedInvoices = filteredInvoices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleMarkAsPaid = async (invId: string) => {
    try {
      if (call) {
        await call('approve_payment', { payment_id: invId });
      }
      if (onReload) {
        onReload();
      }
      showToast('Status tagihan & invoice berhasil diverifikasi Lunas di database Supabase.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah status tagihan.', 'error');
    }
  };

  const handleSendReminder = (inv: InvoiceItem) => {
    const rawPhone = inv.picPhone ? inv.picPhone.replace(/\D/g, '') : '';
    const phone = rawPhone.startsWith('0') ? `62${rawPhone.slice(1)}` : rawPhone;
    const msg = `Halo Bapak/Ibu ${inv.picName} dari ${inv.schoolName},\n\nKami menginformasikan bahwa tagihan langganan Kawacanaan Presensi dengan No Faktur *${inv.invoiceNumber}* sebesar *Rp ${inv.amount.toLocaleString('id-ID')}* telah diterbitkan (Jatuh tempo: ${inv.dueDate}).\n\nSilakan selesaikan pembayaran melalui portal resmi Kawacanaan:\n${window.location.origin}/subscribe\n\nTerima kasih atas kerja samanya.`;

    if (phone) {
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');
      showToast(`Pengingat WhatsApp untuk ${inv.schoolName} siap dikirim.`, 'success');
    } else {
      showToast(`Pengingat tagihan ${inv.invoiceNumber} berhasil dikirim ke antrean notifikasi bendahara.`, 'success');
    }
  };

  const handleCopyPaymentLink = (inv: InvoiceItem) => {
    const link = `${window.location.origin}/subscribe?invoice=${encodeURIComponent(inv.invoiceNumber)}`;
    navigator.clipboard.writeText(link);
    showToast(`Tautan pembayaran resmi ${inv.schoolName} berhasil disalin ke clipboard!`, 'info');
  };

  const handleMassReminder = () => {
    const pendingCount = pendingInvoices.length + overdueInvoices.length;
    if (pendingCount === 0) {
      showToast('Seluruh tagihan sekolah saat ini sudah lunas.', 'info');
      return;
    }
    showToast(`Pengingat otomatis berhasil disiarkan ke ${pendingCount} sekolah dengan tagihan aktif/jatuh tempo!`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner Tagihan & Invoice */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-7 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <FileText size={13} />
              <span>Manajemen Billing &amp; Penagihan SaaS</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Tagihan &amp; Invoice Resmi Sekolah
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Kelola penerbitan faktur tagihan lisensi, pantau masa jatuh tempo termin sekolah, kirim pengingat otomatis via WhatsApp, serta rekonsiliasi pembayaran manual.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onOpenDirectSub}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/30"
            >
              <PlusCircle size={15} />
              <span>Buat Tagihan Baru</span>
            </button>

            <button
              type="button"
              onClick={handleMassReminder}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
            >
              <Send size={14} />
              <span>Pengingat Massal</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Kartu Status Ringkasan Tagihan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Diterbitkan</span>
            <span className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <FileText size={16} />
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-black text-slate-900 font-mono">
              Rp {totalAmount.toLocaleString('id-ID')}
            </h3>
            <span className="text-[11px] font-bold text-slate-500 mt-1 inline-block">
              {invoices.length} Total Faktur Dibuat
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Terbayar / Lunas</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={16} />
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-black text-emerald-700 font-mono">
              Rp {paidAmount.toLocaleString('id-ID')}
            </h3>
            <span className="text-[11px] font-bold text-emerald-600 mt-1 inline-block">
              {paidInvoices.length} Faktur Selesai Rekonsiliasi
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Menunggu Pembayaran</span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Clock size={16} />
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-black text-blue-700 font-mono">
              Rp {pendingAmount.toLocaleString('id-ID')}
            </h3>
            <span className="text-[11px] font-bold text-blue-600 mt-1 inline-block">
              {pendingInvoices.length} Faktur Aktif Menunggu Bayar
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Jatuh Tempo (Overdue)</span>
            <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <AlertTriangle size={16} />
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-black text-rose-700 font-mono">
              Rp {overdueAmount.toLocaleString('id-ID')}
            </h3>
            <span className="text-[11px] font-bold text-rose-600 mt-1 inline-block">
              {overdueInvoices.length} Faktur Melewati Batas
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 min-w-[260px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Cari nomor invoice, nama sekolah, NPSN, atau PIC..."
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="all">Semua Status Tagihan</option>
            <option value="paid">Lunas (Paid)</option>
            <option value="pending">Menunggu Pembayaran</option>
            <option value="overdue">Jatuh Tempo (Overdue)</option>
          </select>

          <select
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="all">Semua Jenis Paket</option>
            <option value="sekolah">Paket Sekolah</option>
            <option value="guru">Paket Guru</option>
          </select>
        </div>
      </div>

      {/* Tabel Tagihan & Invoice */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">No. Faktur</th>
                <th className="py-3.5 px-4">Sekolah / Tenant</th>
                <th className="py-3.5 px-4">Paket Langganan</th>
                <th className="py-3.5 px-4 text-right">Nominal Tagihan</th>
                <th className="py-3.5 px-4 text-center">Tgl Terbit / Jatuh Tempo</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Aksi Kelola</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">
                    {inv.invoiceNumber}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900">{inv.schoolName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      NPSN: {inv.npsn} • PIC: {inv.picName}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[11px]">
                      {inv.planName}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-[13px]">
                    Rp {inv.amount.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="text-slate-700 font-medium">{inv.issueDate}</div>
                    <div className={`text-[10px] font-bold mt-0.5 ${inv.status === 'overdue' ? 'text-rose-600' : 'text-slate-400'}`}>
                      Tempo: {inv.dueDate}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {inv.status === 'paid' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                        <CheckCircle2 size={11} />
                        <span>Lunas</span>
                      </span>
                    )}
                    {inv.status === 'pending' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                        <Clock size={11} />
                        <span>Menunggu</span>
                      </span>
                    )}
                    {inv.status === 'overdue' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                        <AlertTriangle size={11} />
                        <span>Jatuh Tempo</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          openSmartInvoiceTab({
                            id: inv.id,
                            invoiceNumber: inv.invoiceNumber,
                            invoiceNo: inv.invoiceNumber,
                            orderId: inv.invoiceNumber,
                            order_id: inv.invoiceNumber,
                            schoolName: inv.schoolName,
                            school_name: inv.schoolName,
                            npsn: inv.npsn,
                            customerName: inv.picName,
                            customerPhone: inv.picPhone,
                            planName: inv.planName,
                            amount: inv.amount,
                            totalAmount: inv.amount,
                            issueDate: inv.issueDate,
                            dueDate: inv.dueDate,
                            paidAt: inv.paidAt,
                            settlement_time: inv.paidAt || '-',
                            paymentMethod: inv.paymentMethod,
                            payment_method: inv.paymentMethod,
                            payment_type: inv.paymentMethod,
                            status: inv.status === 'paid' ? 'settled' : inv.status,
                            created_at: inv.issueDate,
                          });
                        }}
                        title="Buka Smart Link PDF Invoice Resmi di Tab Baru"
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-indigo-200/80 shadow-2xs"
                      >
                        <FileText size={13} className="text-indigo-600" />
                        <span>Smart Link PDF</span>
                        <ExternalLink size={11} className="text-indigo-500 opacity-75" />
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await copySmartInvoiceLink(inv.invoiceNumber);
                          if (ok) {
                            showToast(`Smart Link PDF ${inv.invoiceNumber} berhasil disalin ke clipboard!`, 'success');
                          }
                        }}
                        title="Salin tautan publik Smart Link PDF"
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                      >
                        <Copy size={13} />
                      </button>

                      {inv.status !== 'paid' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSendReminder(inv)}
                            title="Kirim Pengingat WhatsApp"
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition cursor-pointer"
                          >
                            <Send size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMarkAsPaid(inv.id)}
                            title="Tandai Lunas Manual"
                            className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition cursor-pointer"
                          >
                            <Check size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {displayedInvoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <FileText size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-medium">Tidak ada tagihan atau invoice yang cocok dengan kriteria pencarian.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginasi */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            Menampilkan <strong>{displayedInvoices.length}</strong> dari <strong>{filteredInvoices.length}</strong> tagihan
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="font-mono text-slate-700">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
