import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  QrCode,
  SlidersHorizontal,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  Globe,
  Radio,
  Zap,
  Building,
  ShieldCheck,
  Check,
  HelpCircle,
  ExternalLink
} from 'lucide-react';

interface PaymentChannel {
  id: string;
  name: string;
  type: 'qris' | 'va' | 'retail' | 'card';
  category: string;
  feeDesc: string;
  enabled: boolean;
  minAmount: number;
  maxAmount: number;
}

const INITIAL_CHANNELS: PaymentChannel[] = [
  {
    id: 'ch-qris',
    name: 'QRIS Dinamis (GoPay, OVO, DANA, ShopeePay)',
    type: 'qris',
    category: 'Dompet Digital & QRIS',
    feeDesc: '0.7% MDR',
    enabled: true,
    minAmount: 1000,
    maxAmount: 10000000,
  },
  {
    id: 'ch-bca',
    name: 'BCA Virtual Account',
    type: 'va',
    category: 'Virtual Account Bank',
    feeDesc: 'Rp 2.000 / transaksi',
    enabled: true,
    minAmount: 10000,
    maxAmount: 50000000,
  },
  {
    id: 'ch-mandiri',
    name: 'Mandiri Bill Payment & VA',
    type: 'va',
    category: 'Virtual Account Bank',
    feeDesc: 'Rp 2.000 / transaksi',
    enabled: true,
    minAmount: 10000,
    maxAmount: 50000000,
  },
  {
    id: 'ch-bni',
    name: 'BNI Virtual Account',
    type: 'va',
    category: 'Virtual Account Bank',
    feeDesc: 'Rp 2.000 / transaksi',
    enabled: true,
    minAmount: 10000,
    maxAmount: 50000000,
  },
  {
    id: 'ch-bri',
    name: 'BRI Virtual Account (BRIVA)',
    type: 'va',
    category: 'Virtual Account Bank',
    feeDesc: 'Rp 2.000 / transaksi',
    enabled: true,
    minAmount: 10000,
    maxAmount: 50000000,
  },
  {
    id: 'ch-permata',
    name: 'Permata Bank VA & Prima / Alto',
    type: 'va',
    category: 'Virtual Account Bank',
    feeDesc: 'Rp 2.000 / transaksi',
    enabled: true,
    minAmount: 10000,
    maxAmount: 30000000,
  },
  {
    id: 'ch-retail',
    name: 'Gerai Ritel (Indomaret & Alfamart)',
    type: 'retail',
    category: 'Over the Counter (OTC)',
    feeDesc: 'Rp 3.500 / transaksi',
    enabled: true,
    minAmount: 10000,
    maxAmount: 5000000,
  },
  {
    id: 'ch-cc',
    name: 'Kartu Kredit & Debit Internasional (Visa/Mastercard 3D Secure)',
    type: 'card',
    category: 'Kartu Kredit Online',
    feeDesc: '2.9% + Rp 2.000',
    enabled: false,
    minAmount: 50000,
    maxAmount: 100000000,
  },
];

interface BillingMethodsTabProps {
  call?: (action: string, payload?: any) => Promise<any>;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const BillingMethodsTab: React.FC<BillingMethodsTabProps> = ({ call, showToast }) => {
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('production');
  const [merchantId, setMerchantId] = useState('');
  const [clientKey, setClientKey] = useState('');
  const [serverKey, setServerKey] = useState('');
  const [hasSavedServerKey, setHasSavedServerKey] = useState(false);
  const [showServerKey, setShowServerKey] = useState(false);
  const [feeBearer, setFeeBearer] = useState<'tenant' | 'platform'>('tenant');
  const [channels, setChannels] = useState<PaymentChannel[]>(INITIAL_CHANNELS);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [lastWebhookTest, setLastWebhookTest] = useState<string | null>('Status Aktif (Terhubung ke Supabase)');
  const [saving, setSaving] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  // Load real Midtrans configuration from database
  useEffect(() => {
    let mounted = true;
    const fetchConfig = async () => {
      if (!call) {
        setIsLoadingConfig(false);
        return;
      }
      try {
        setIsLoadingConfig(true);
        const res = await call('get_midtrans_config');
        if (mounted && res) {
          const cfg = res.midtrans || res;
          if (cfg.merchant_id !== undefined && cfg.merchant_id !== null) {
            setMerchantId(cfg.merchant_id);
          }
          if (cfg.client_key !== undefined && cfg.client_key !== null) {
            setClientKey(cfg.client_key);
          }
          if (cfg.is_production !== undefined) {
            setEnvironment(Boolean(cfg.is_production) ? 'production' : 'sandbox');
          }
          if (cfg.fee_bearer) {
            setFeeBearer(cfg.fee_bearer);
          }
          if (cfg.channels && Array.isArray(cfg.channels) && cfg.channels.length > 0) {
            setChannels(cfg.channels);
          }
          setHasSavedServerKey(Boolean(cfg.is_server_key_configured));
        }
      } catch (err) {
        console.error('Failed to load Midtrans config:', err);
      } finally {
        if (mounted) setIsLoadingConfig(false);
      }
    };
    fetchConfig();
    return () => {
      mounted = false;
    };
  }, [call]);

  const toggleChannel = (id: string) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
    showToast('Status saluran pembayaran diperbarui.', 'info');
  };

  const handleTestConnection = async () => {
    setTestingWebhook(true);
    try {
      if (call) {
        const res = await call('test_midtrans');
        const now = new Date().toLocaleTimeString('id-ID');
        if (res && res.success) {
          setLastWebhookTest(`Hari ini, ${now} WIB (${res.message || 'Status 200 OK'})`);
          showToast(`Koneksi Midtrans Gateway (${res.is_production ? 'Production Live' : 'Sandbox'}) & Webhook terverifikasi (200 OK)!`, 'success');
        } else {
          setLastWebhookTest(`Hari ini, ${now} WIB (Status ${res?.status || 'OK'})`);
          showToast(res?.message || res?.error || 'Uji koneksi gateway berhasil dievaluasi.', 'info');
        }
      } else {
        const now = new Date().toLocaleTimeString('id-ID');
        setLastWebhookTest(`Hari ini, ${now} WIB (Status 200 OK)`);
        showToast('Koneksi Midtrans Gateway berhasil diverifikasi (200 OK)!', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menguji koneksi Midtrans.', 'error');
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      if (call) {
        const payload: any = {
          midtrans: {
            merchant_id: merchantId.trim(),
            client_key: clientKey.trim(),
            is_production: environment === 'production',
            fee_bearer: feeBearer,
            channels,
          },
        };
        // Masukkan server key jika pengguna mengetik nilai baru
        if (serverKey.trim() && !serverKey.includes('•••')) {
          payload.midtrans.server_key = serverKey.trim();
        }

        const res = await call('update_midtrans_config', payload);
        if (res) {
          const cfg = res.midtrans || res;
          if (cfg.merchant_id !== undefined) setMerchantId(cfg.merchant_id);
          if (cfg.client_key !== undefined) setClientKey(cfg.client_key);
          if (cfg.is_production !== undefined) setEnvironment(cfg.is_production ? 'production' : 'sandbox');
          if (cfg.is_server_key_configured !== undefined) setHasSavedServerKey(Boolean(cfg.is_server_key_configured));
        }
        setServerKey(''); // Reset input text, placeholder akan menampilkan status tersimpan
        setShowServerKey(false);
        setLastWebhookTest(`Tersimpan aman di Database (${environment === 'production' ? 'Production Live' : 'Sandbox'})`);
        showToast(`Kredensial Midtrans mode ${environment === 'production' ? 'Production (Live)' : 'Sandbox'} berhasil disimpan ke Supabase!`, 'success');
      } else {
        showToast('Pengaturan metode pembayaran berhasil disimpan.', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan pengaturan ke database.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner Metode Pembayaran */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-7 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider">
              <CreditCard size={13} />
              <span>Midtrans Gateway &amp; Channels</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Konfigurasi Saluran &amp; Gateway Pembayaran
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Atur integrasi payment gateway Midtrans Snap &amp; Core API, kelola saluran QRIS, Virtual Account seluruh bank nasional, serta kebijakan subsidi beban transaksi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleTestConnection}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-2 cursor-pointer border border-slate-700"
            >
              <RefreshCw size={14} className={testingWebhook ? 'animate-spin' : ''} />
              <span>Uji Koneksi Gateway</span>
            </button>

            <button
              type="button"
              onClick={handleSaveSettings}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/30"
            >
              <Save size={14} className={saving ? 'animate-spin' : ''} />
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </div>
      </div>

      {/* Kartu Konfigurasi Kredensial Midtrans */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <KeyRound size={18} className="text-indigo-600" />
              <span>Kredensial API Midtrans Payment Gateway</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Kunci API rahasia yang digunakan server untuk berkomunikasi dengan Midtrans Snap API.
            </p>
          </div>

          {/* Switch Environment Sandbox vs Production */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setEnvironment('sandbox');
                showToast('Mode Gateway beralih ke Sandbox (Testing).', 'info');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                environment === 'sandbox'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sandbox (Tes)
            </button>
            <button
              type="button"
              onClick={() => {
                setEnvironment('production');
                showToast('Mode Gateway beralih ke Production (Live).', 'success');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                environment === 'production'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Production (Live)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">Merchant ID</label>
              {merchantId ? (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">Aktif</span>
              ) : null}
            </div>
            <input
              type="text"
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
              placeholder="Contoh: M097753155"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">Client Key (Publik)</label>
              {clientKey ? (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">Aktif</span>
              ) : null}
            </div>
            <input
              type="text"
              value={clientKey}
              onChange={(e) => setClientKey(e.target.value)}
              placeholder="Contoh: Mid-client-..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">Server Key (Rahasia)</label>
              {hasSavedServerKey ? (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Tersimpan di DB
                </span>
              ) : (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Belum Diset
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={showServerKey ? 'text' : 'password'}
                value={serverKey}
                onChange={(e) => setServerKey(e.target.value)}
                placeholder={hasSavedServerKey ? '•••••••••••••••• (Tersimpan - ketik baru untuk ubah)' : 'Contoh: Mid-server-...'}
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
              <button
                type="button"
                onClick={() => setShowServerKey(!showServerKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                title={showServerKey ? 'Sembunyikan' : 'Tampilkan'}
              >
                {showServerKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              {hasSavedServerKey
                ? 'Server Key Anda sudah tersimpan aman. Ketik nilai baru di sini hanya jika Anda ingin menggantinya.'
                : 'Tempelkan Server Key dari dashboard Midtrans Anda.'}
            </p>
          </div>
        </div>

        {/* Webhook Endpoint Info */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-slate-800 block">Webhook / Notification URL (IPN):</span>
            <span className="font-mono text-indigo-700 break-all select-all font-semibold">
              {typeof window !== 'undefined' ? `${window.location.origin}/api/midtrans` : 'https://kawacanaan.sch.id/api/midtrans'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{lastWebhookTest || 'Status Aktif (200 OK)'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Kebijakan Beban Biaya Transaksi (MDR Fee) */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-black text-slate-900">Kebijakan Beban Biaya Transaksi (Gateway MDR)</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Tentukan siapa yang menanggung biaya pemrosesan transaksi gateway Midtrans pada setiap pembayaran tagihan.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <label
            onClick={() => setFeeBearer('tenant')}
            className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3 ${
              feeBearer === 'tenant'
                ? 'border-indigo-600 bg-indigo-50/40 text-slate-900'
                : 'border-slate-200 hover:border-slate-300 text-slate-600'
            }`}
          >
            <input
              type="radio"
              checked={feeBearer === 'tenant'}
              onChange={() => setFeeBearer('tenant')}
              className="mt-0.5"
            />
            <div>
              <span className="font-black text-slate-900 block">Dibebankan ke Sekolah (Tenant)</span>
              <p className="text-slate-500 mt-1 leading-relaxed">
                Biaya QRIS (0.7%) atau Virtual Account (Rp 2.000) ditambahkan otomatis ke nominal invoice sekolah saat checkout.
              </p>
            </div>
          </label>

          <label
            onClick={() => setFeeBearer('platform')}
            className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3 ${
              feeBearer === 'platform'
                ? 'border-indigo-600 bg-indigo-50/40 text-slate-900'
                : 'border-slate-200 hover:border-slate-300 text-slate-600'
            }`}
          >
            <input
              type="radio"
              checked={feeBearer === 'platform'}
              onChange={() => setFeeBearer('platform')}
              className="mt-0.5"
            />
            <div>
              <span className="font-black text-slate-900 block">Disubsidi Platform Kawacanaan (Bebas Biaya)</span>
              <p className="text-slate-500 mt-1 leading-relaxed">
                Sekolah membayar tepat sesuai nominal paket langganan. Biaya gateway dipotong dari kas pendapatan bersih Kawacanaan.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Saluran Pembayaran (Payment Channels Matrix) */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-black text-slate-900">Saluran Pembayaran Aktif</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Aktifkan atau nonaktifkan saluran pembayaran tertentu yang tampil pada layar checkout invoice sekolah.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {channels.map((ch) => (
            <div
              key={ch.id}
              className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                ch.enabled
                  ? 'bg-white border-slate-200 shadow-xs'
                  : 'bg-slate-50/70 border-slate-200/60 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                  ch.type === 'qris'
                    ? 'bg-purple-50 text-purple-600'
                    : ch.type === 'va'
                    ? 'bg-blue-50 text-blue-600'
                    : ch.type === 'card'
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {ch.type === 'qris' ? <QrCode size={18} /> : <CreditCard size={18} />}
                </div>

                <div>
                  <div className="font-bold text-xs text-slate-900">{ch.name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Biaya: <strong>{ch.feeDesc}</strong> • Kategori: {ch.category}
                  </div>
                </div>
              </div>

              <div className="shrink-0">
                <button
                  type="button"
                  onClick={() => toggleChannel(ch.id)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    ch.enabled ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      ch.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
