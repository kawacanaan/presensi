import React, { useState, useEffect } from 'react';
import {
  Radio,
  Send,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Save,
  MessageSquare,
  Smartphone,
  Server,
  Key,
  HelpCircle,
  Bell,
  Clock,
  CheckCheck,
  FileText
} from 'lucide-react';

interface EvolutionConfig {
  server_url: string;
  instance_name: string;
  is_enabled: boolean;
  sender_phone: string;
  notify_on_present: boolean;
  notify_on_late: boolean;
  notify_on_leave_approval: boolean;
  template_present: string;
  template_late: string;
  template_leave_approved: string;
  is_api_key_configured?: boolean;
  api_key?: string;
}

interface Props {
  call: (action: string, payload?: any) => Promise<any>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  initialConfig?: EvolutionConfig;
  onSaved?: (newConfig: EvolutionConfig) => void;
}

export const SystemEvolutionAPITab: React.FC<Props> = ({
  call,
  showToast,
  initialConfig,
  onSaved,
}) => {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    state?: string;
    message?: string;
    latencyMs?: number;
    error?: string;
  } | null>(null);

  const [form, setForm] = useState<EvolutionConfig>(() => ({
    server_url: initialConfig?.server_url || '',
    instance_name: initialConfig?.instance_name || 'kawacanaan-notif',
    is_enabled: initialConfig?.is_enabled ?? false,
    sender_phone: initialConfig?.sender_phone || '',
    notify_on_present: initialConfig?.notify_on_present ?? false,
    notify_on_late: initialConfig?.notify_on_late ?? true,
    notify_on_leave_approval: initialConfig?.notify_on_leave_approval ?? true,
    template_present:
      initialConfig?.template_present ||
      'Halo Bapak/Ibu Wali dari {nama_siswa}, ananda telah terdata HADIR tepat waktu di sekolah ({kelas}) pada {tanggal} pukul {jam}. Terima kasih.',
    template_late:
      initialConfig?.template_late ||
      'Pemberitahuan: Ananda {nama_siswa} ({kelas}) terdata HADIR TERLAMBAT pada {tanggal} pukul {jam}. Mohon kerja sama Bapak/Ibu untuk mendampingi ananda berangkat lebih awal.',
    template_leave_approved:
      initialConfig?.template_leave_approved ||
      'Surat permohonan izin sakit ananda {nama_siswa} ({kelas}) untuk tanggal {tanggal} telah DISETUJUI oleh Wali Kelas. Semoga lekas pulih dan sehat kembali.',
    is_api_key_configured: initialConfig?.is_api_key_configured ?? false,
    api_key: initialConfig?.is_api_key_configured ? '••••••••••••••••' : '',
  }));

  useEffect(() => {
    if (initialConfig) {
      setForm({
        server_url: initialConfig.server_url || '',
        instance_name: initialConfig.instance_name || 'kawacanaan-notif',
        is_enabled: initialConfig.is_enabled ?? false,
        sender_phone: initialConfig.sender_phone || '',
        notify_on_present: initialConfig.notify_on_present ?? false,
        notify_on_late: initialConfig.notify_on_late ?? true,
        notify_on_leave_approval: initialConfig.notify_on_leave_approval ?? true,
        template_present:
          initialConfig.template_present ||
          'Halo Bapak/Ibu Wali dari {nama_siswa}, ananda telah terdata HADIR tepat waktu di sekolah ({kelas}) pada {tanggal} pukul {jam}. Terima kasih.',
        template_late:
          initialConfig.template_late ||
          'Pemberitahuan: Ananda {nama_siswa} ({kelas}) terdata HADIR TERLAMBAT pada {tanggal} pukul {jam}. Mohon kerja sama Bapak/Ibu untuk mendampingi ananda berangkat lebih awal.',
        template_leave_approved:
          initialConfig.template_leave_approved ||
          'Surat permohonan izin sakit ananda {nama_siswa} ({kelas}) untuk tanggal {tanggal} telah DISETUJUI oleh Wali Kelas. Semoga lekas pulih dan sehat kembali.',
        is_api_key_configured: initialConfig.is_api_key_configured ?? false,
        api_key: initialConfig.is_api_key_configured ? '••••••••••••••••' : '',
      });
    }
  }, [initialConfig]);

  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Halo! Ini adalah pesan uji coba WhatsApp Gateway dari Sistem Kawacanaan Presensi.');
  const [sendingTest, setSendingTest] = useState(false);
  const [testSendResult, setTestSendResult] = useState<{
    ok: boolean;
    message?: string;
    error?: string;
    latencyMs?: number;
  } | null>(null);

  const handleSendTest = async () => {
    if (!testPhone.trim()) {
      showToast('Nomor WhatsApp tujuan wajib diisi.', 'error');
      return;
    }
    setSendingTest(true);
    setTestSendResult(null);
    try {
      const payload: any = {
        server_url: form.server_url,
        instance_name: form.instance_name,
        phone: testPhone,
        message: testMessage,
      };
      if (form.api_key && !form.api_key.includes('••••')) {
        payload.api_key = form.api_key;
      }
      const res = await call('send_test_whatsapp', payload);
      if (res.ok) {
        setTestSendResult({
          ok: true,
          message: res.message || 'Pesan berhasil dikirim!',
          latencyMs: res.latencyMs,
        });
        showToast(`Pesan berhasil dikirim ke ${testPhone}!`, 'success');
      } else {
        setTestSendResult({
          ok: false,
          error: res.error || 'Gagal mengirim pesan',
          latencyMs: res.latencyMs,
        });
        showToast(res.error || 'Gagal mengirim pesan WhatsApp.', 'error');
      }
    } catch (err: any) {
      setTestSendResult({
        ok: false,
        error: err.message || 'Koneksi gagal',
      });
      showToast(err.message || 'Pengiriman gagal.', 'error');
    } finally {
      setSendingTest(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (payload.api_key && payload.api_key.includes('••••')) {
        delete payload.api_key;
      }
      const res = await call('update_system_settings', {
        section: 'evolution_api',
        data: payload,
      });
      if (res.ok) {
        showToast('Konfigurasi Evolution API berhasil disimpan di server.', 'success');
        if (onSaved) onSaved(form);
      } else {
        throw new Error(res.error || 'Gagal menyimpan konfigurasi.');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan konfigurasi Evolution API.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!form.server_url.trim()) {
      showToast('Harap isi Server URL Evolution API terlebih dahulu.', 'error');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const payload: any = {
        server_url: form.server_url,
        instance_name: form.instance_name,
      };
      if (form.api_key && !form.api_key.includes('••••')) {
        payload.api_key = form.api_key;
      }
      const res = await call('test_evolution_api', payload);
      if (res.ok) {
        setTestResult({
          ok: true,
          state: res.state,
          message: res.message,
          latencyMs: res.latencyMs,
        });
        showToast(`Terhubung ke Evolution API (${res.state})!`, 'success');
      } else {
        setTestResult({
          ok: false,
          error: res.error || 'Gagal terhubung',
          latencyMs: res.latencyMs,
        });
        showToast(res.error || 'Uji koneksi gagal.', 'error');
      }
    } catch (err: any) {
      setTestResult({
        ok: false,
        error: err.message || 'Gagal menghubungi server Evolution API',
      });
      showToast(err.message || 'Uji koneksi gagal.', 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Evolution API */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-5 sm:p-6 text-white shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center text-white shrink-0">
              <Radio size={24} className="text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight">WhatsApp Gateway: Evolution API</h3>
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold text-emerald-150">
                  Baileys-Engine
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5 leading-relaxed">
                Kirim otomatis laporan presensi dan persetujuan surat sakit langsung ke nomor WhatsApp orang tua siswa.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
                form.is_enabled
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'bg-black/20 text-slate-200 border border-white/10'
              }`}
            >
              {form.is_enabled ? <CheckCircle2 size={13} className="text-emerald-300" /> : <Clock size={13} />}
              <span>{form.is_enabled ? 'Gateway Aktif' : 'Gateway Non-Aktif'}</span>
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Bagian 1: Kredensial & Endpoint Evolution API */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Server size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Koneksi Server Evolution API</h3>
                <p className="text-xs text-slate-500">URL server, Global API Key, dan nama instance WhatsApp aktif.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 mr-1">Aktifkan Gateway:</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_enabled}
                  onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Server URL Evolution API
              </label>
              <input
                type="url"
                value={form.server_url}
                onChange={(e) => setForm({ ...form, server_url: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none font-mono text-[11px] text-slate-800"
                placeholder="Contoh: https://wa-api.sekolah.id:8080"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">URL endpoint instans Evolution API Anda.</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Nama Instance (Instance Name)
              </label>
              <input
                type="text"
                value={form.instance_name}
                onChange={(e) => setForm({ ...form, instance_name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none font-medium text-slate-800"
                placeholder="kawacanaan-notif"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Nama instance yang didaftarkan di Evolution API.</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                API Key / Token (Global atau Instance)
              </label>
              <input
                type="password"
                value={form.api_key}
                onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none font-mono text-[11px] text-slate-800"
                placeholder="Masukkan API Key Evolution API"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                {form.is_api_key_configured
                  ? 'API Key sudah tersimpan di database. Biarkan tanda titik jika tidak ingin mengubah.'
                  : 'Token otentikasi dari Evolution API.'}
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Nomor Pengirim Terhubung (Sender Phone)
              </label>
              <input
                type="text"
                value={form.sender_phone}
                onChange={(e) => setForm({ ...form, sender_phone: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none font-mono text-slate-800"
                placeholder="Contoh: 6281234567890"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Nomor WhatsApp bot yang telah di-scan QR code.</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || !form.server_url}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {testing ? <RefreshCw size={14} className="animate-spin" /> : <Radio size={14} className="text-emerald-600" />}
              <span>{testing ? 'Menguji Koneksi...' : 'Uji Koneksi (Ping Evolution API)'}</span>
            </button>

            {testResult && (
              <div
                className={`text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 ${
                  testResult.ok
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {testResult.ok ? <CheckCircle2 size={14} className="text-emerald-600" /> : <XCircle size={14} className="text-rose-600" />}
                <span className="font-semibold">{testResult.ok ? testResult.message : testResult.error}</span>
                {testResult.latencyMs && (
                  <span className="text-[10px] text-slate-500 font-mono">({testResult.latencyMs} ms)</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bagian 2: Sakelar Jenis Notifikasi Otomatis */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Bell size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Aturan Pengiriman Otomatis ke Orang Tua</h3>
              <p className="text-xs text-slate-500">Pilih peristiwa presensi yang akan otomatis memicu pesan WhatsApp ke kontak wali murid.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
            {/* Presensi Hadir */}
            <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-slate-800">Siswa Hadir Tepat Waktu</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Kirim notifikasi setiap kali siswa tap presensi masuk normal.</p>
              </div>
              <input
                type="checkbox"
                checked={form.notify_on_present}
                onChange={(e) => setForm({ ...form, notify_on_present: e.target.checked })}
                className="w-4 h-4 text-emerald-600 rounded mt-0.5"
              />
            </div>

            {/* Presensi Terlambat */}
            <div className="p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/40 flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-amber-900">Siswa Terlambat</p>
                <p className="text-[11px] text-amber-700 mt-0.5">Pemberitahuan kepada orang tua jika siswa hadir melewati batas toleransi.</p>
              </div>
              <input
                type="checkbox"
                checked={form.notify_on_late}
                onChange={(e) => setForm({ ...form, notify_on_late: e.target.checked })}
                className="w-4 h-4 text-amber-600 rounded mt-0.5"
              />
            </div>

            {/* Surat Izin Sakit Disetujui */}
            <div className="p-3.5 rounded-xl border border-blue-200/80 bg-blue-50/40 flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-blue-900">Surat Sakit Disetujui</p>
                <p className="text-[11px] text-blue-700 mt-0.5">Konfirmasi ke orang tua saat wali kelas menyetujui izin sakit.</p>
              </div>
              <input
                type="checkbox"
                checked={form.notify_on_leave_approval}
                onChange={(e) => setForm({ ...form, notify_on_leave_approval: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded mt-0.5"
              />
            </div>
          </div>
        </div>

        {/* Bagian 3: Editor Templat Pesan WhatsApp */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                <MessageSquare size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Templat Pesan WhatsApp</h3>
                <p className="text-xs text-slate-500">Format susunan pesan otomatis yang dikirim ke nomor kontak wali murid.</p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl">
              <HelpCircle size={13} className="text-slate-400" />
              <span>Variabel: <code>{'{nama_siswa}'}</code>, <code>{'{kelas}'}</code>, <code>{'{jam}'}</code>, <code>{'{tanggal}'}</code></span>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Templat: Siswa Hadir Tepat Waktu
              </label>
              <textarea
                rows={2}
                value={form.template_present}
                onChange={(e) => setForm({ ...form, template_present: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none text-slate-800 font-medium leading-relaxed"
              />
            </div>

            <div>
              <label className="block font-semibold text-amber-900 mb-1">
                Templat: Siswa Terlambat Masuk
              </label>
              <textarea
                rows={2}
                value={form.template_late}
                onChange={(e) => setForm({ ...form, template_late: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 outline-none text-slate-800 font-medium leading-relaxed"
              />
            </div>

            <div>
              <label className="block font-semibold text-blue-900 mb-1">
                Templat: Konfirmasi Izin Sakit Disetujui
              </label>
              <textarea
                rows={2}
                value={form.template_leave_approved}
                onChange={(e) => setForm({ ...form, template_leave_approved: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-slate-800 font-medium leading-relaxed"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan WhatsApp Gateway'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Bagian 4: Sandbox Uji Coba Pengiriman Pesan WhatsApp Nyata */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
            <Send size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Uji Coba Pengiriman Pesan WhatsApp Langsung</h3>
            <p className="text-xs text-slate-500">
              Kirimkan pesan uji coba ke nomor WhatsApp Anda untuk memverifikasi fungsionalitas pengiriman secara nyata.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Nomor WhatsApp Tujuan</label>
            <input
              type="text"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="Contoh: 6281234567890"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 outline-none font-mono text-slate-800"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">Gunakan kode negara (628...).</span>
          </div>

          <div className="md:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1.5">Isi Pesan Uji Coba</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Tulis pesan uji coba..."
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 outline-none text-slate-800 font-medium"
              />
              <button
                type="button"
                onClick={handleSendTest}
                disabled={sendingTest || !testPhone.trim() || !form.server_url}
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
              >
                {sendingTest ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                <span>{sendingTest ? 'Mengirim...' : 'Kirim Pesan'}</span>
              </button>
            </div>
          </div>
        </div>

        {testSendResult && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
              testSendResult.ok
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {testSendResult.ok ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              ) : (
                <XCircle size={16} className="text-rose-600 shrink-0" />
              )}
              <span className="font-semibold">
                {testSendResult.ok ? testSendResult.message : testSendResult.error}
              </span>
            </div>
            {testSendResult.latencyMs && (
              <span className="text-[10px] text-slate-500 font-mono ml-3 shrink-0">
                Latensi: {testSendResult.latencyMs} ms
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
