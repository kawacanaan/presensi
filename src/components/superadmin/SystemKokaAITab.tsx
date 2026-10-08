import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Zap,
  CheckCircle2,
  XCircle,
  Play,
  Save,
  RefreshCw,
  Sliders,
  MessageSquare,
  Bot,
  Cpu
} from 'lucide-react';

interface KokaConfig {
  enabled_landing: boolean;
  enabled_dashboard: boolean;
  active_model: string;
  temperature: number;
  system_persona: string;
  max_tokens: number;
  daily_limit_per_tenant: number;
  has_cloudflare_config?: boolean;
}

interface Props {
  call: (action: string, payload?: any) => Promise<any>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  initialConfig?: KokaConfig;
  onSaved?: (newConfig: KokaConfig) => void;
}

export const SystemKokaAITab: React.FC<Props> = ({
  call,
  showToast,
  initialConfig,
  onSaved,
}) => {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPrompt, setTestPrompt] = useState(
    'Siapa yang belum absen?'
  );
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    reply?: string;
    model?: string;
    latencyMs?: number;
    error?: string;
  } | null>(null);

  const defaultOfficialPersona =
    'Kamu adalah Presiden Konoha AI. Berbicara seperti pejabat negara yang sangat formal dan berwibawa, tetapi lucu dan nyeleneh. Menganggap urusan absensi sekolah sebagai urusan negara. Sering menggunakan istilah birokrasi seperti koordinasi, disposisi, pendataan, dan stabilitas tanpa berlebihan. Tetap ramah, singkat, dan membantu guru. Selalu prioritaskan ketepatan data dan tindakan nyata dibanding humor.';

  const [form, setForm] = useState<KokaConfig>(() => ({
    enabled_landing: initialConfig?.enabled_landing ?? true,
    enabled_dashboard: initialConfig?.enabled_dashboard ?? true,
    active_model: initialConfig?.active_model || '@cf/zai-org/glm-4.7-flash',
    temperature: initialConfig?.temperature ?? 0.7,
    system_persona: initialConfig?.system_persona || defaultOfficialPersona,
    max_tokens: initialConfig?.max_tokens || 1024,
    daily_limit_per_tenant: initialConfig?.daily_limit_per_tenant || 100,
    has_cloudflare_config: initialConfig?.has_cloudflare_config ?? true,
  }));

  useEffect(() => {
    if (initialConfig) {
      setForm({
        enabled_landing: initialConfig.enabled_landing ?? true,
        enabled_dashboard: initialConfig.enabled_dashboard ?? true,
        active_model: initialConfig.active_model || '@cf/zai-org/glm-4.7-flash',
        temperature: initialConfig.temperature ?? 0.7,
        system_persona: initialConfig.system_persona || defaultOfficialPersona,
        max_tokens: initialConfig.max_tokens || 1024,
        daily_limit_per_tenant: initialConfig.daily_limit_per_tenant || 100,
        has_cloudflare_config: initialConfig.has_cloudflare_config ?? true,
      });
    }
  }, [initialConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await call('update_system_settings', {
        section: 'koka',
        data: form,
      });
      if (res.ok) {
        showToast('Konfigurasi mesin AI Presiden Konoha berhasil diperbarui di server.', 'success');
        if (onSaved) onSaved(form);
      } else {
        throw new Error(res.error || 'Gagal menyimpan.');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui Presiden Konoha AI.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestAI = async () => {
    if (!testPrompt.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await call('test_koka_ai', { prompt: testPrompt, model: form.active_model });
      if (res.ok) {
        setTestResult({
          ok: true,
          reply: res.reply,
          model: res.model,
          latencyMs: res.latencyMs,
        });
        showToast(`Presiden Konoha AI (${res.model}) merespons dalam ${res.latencyMs} ms!`, 'success');
      } else {
        setTestResult({
          ok: false,
          error: res.error || 'Gagal menghubungi AI',
          latencyMs: res.latencyMs,
        });
        showToast(res.error || 'Gagal uji coba Presiden Konoha AI', 'error');
      }
    } catch (err: any) {
      setTestResult({
        ok: false,
        error: err.message || 'Koneksi waktu habis',
      });
      showToast(err.message || 'Uji coba gagal.', 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info Card */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-700 rounded-2xl p-5 sm:p-6 text-white shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center text-white shrink-0">
              <Sparkles size={24} className="text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight">Presiden Konoha AI Engine</h3>
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold text-amber-200">
                  Cloudflare Workers AI
                </span>
              </div>
              <p className="text-xs text-indigo-150 mt-0.5 leading-relaxed">
                Pusat kendali kecerdasan buatan terpadu untuk analisis presensi guru dan asisten interaktif Presiden Konoha di Kawacanaan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
                form.has_cloudflare_config
                  ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/30'
                  : 'bg-rose-500/20 text-rose-100 border border-rose-400/30'
              }`}
            >
              {form.has_cloudflare_config ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
              <span>{form.has_cloudflare_config ? 'Server Cloudflare AI Siap' : 'Kunci Cloudflare Belum Disetel'}</span>
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Kontrol Sakelar Area Presiden Konoha */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
              <Zap size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Aktivasi Presiden Konoha di Antarmuka Pengguna</h3>
              <p className="text-xs text-slate-500">
                Pilih di mana widget asisten Presiden Konoha akan tampil bagi pengguna.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Sakelar Landing Page */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200/80 bg-slate-50/60">
              <div className="pr-3">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <Bot size={15} className="text-violet-600" />
                  <span>Presiden Konoha di Halaman Utama (Landing Page)</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Menjawab pertanyaan calon pengguna, paket sekolah, dan panduan dasar presensi.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={form.enabled_landing}
                  onChange={(e) => setForm({ ...form, enabled_landing: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
              </label>
            </div>

            {/* Sakelar Ruang Guru & Dashboard */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200/80 bg-slate-50/60">
              <div className="pr-3">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <MessageSquare size={15} className="text-indigo-600" />
                  <span>Presiden Konoha di Dashboard Guru (Ruang Kerja)</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Mendampingi wali kelas dan guru mapel dalam analisis kehadiran & catatan pembinaan.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={form.enabled_dashboard}
                  onChange={(e) => setForm({ ...form, enabled_dashboard: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Pengaturan Model & Parameter AI */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Sliders size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Parameter Mesin & Kuota Cloudflare AI</h3>
              <p className="text-xs text-slate-500">Konfigurasi batas interaksi harian dan instruksi dasar (system persona).</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Model Cloudflare AI Utama</label>
              <select
                value={form.active_model}
                onChange={(e) => setForm({ ...form, active_model: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 outline-none bg-white font-medium text-slate-800"
              >
                <option value="@cf/zai-org/glm-4.7-flash">GLM 4.7 Flash (@cf/zai-org/glm-4.7-flash - Sangat Cepat & Akurat)</option>
                <option value="@cf/meta/llama-3.3-70b-instruct">Llama 3.3 70B (@cf/meta/llama-3.3-70b-instruct - Komprehensif)</option>
                <option value="@cf/meta/llama-3.1-8b-instruct">Llama 3.1 8B (@cf/meta/llama-3.1-8b-instruct - Ringan)</option>
                <option value="@cf/qwen/qwen2.5-72b-instruct">Qwen 2.5 72B (@cf/qwen/qwen2.5-72b-instruct - Multibahasa)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Maksimum Token Respon</label>
              <input
                type="number"
                min={256}
                max={2048}
                value={form.max_tokens}
                onChange={(e) => setForm({ ...form, max_tokens: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 outline-none font-medium text-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Batas Kuota Tanya per Hari / Tenant</label>
              <input
                type="number"
                min={10}
                max={500}
                value={form.daily_limit_per_tenant}
                onChange={(e) => setForm({ ...form, daily_limit_per_tenant: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 outline-none font-medium text-slate-800"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-slate-700 mb-1.5">Instruksi Dasar Persona Presiden Konoha (System Prompt)</label>
            <textarea
              rows={3}
              value={form.system_persona}
              onChange={(e) => setForm({ ...form, system_persona: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 outline-none text-slate-800 font-medium leading-relaxed"
              placeholder="Karakter dan aturan instruksi Presiden Konoha..."
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Instruksi ini menjadi pedoman perilaku Presiden Konoha saat menjawab pertanyaan guru dan pengunjung.
            </span>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan Presiden Konoha AI'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Kotak Uji Coba Langsung (Live Sandbox) */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Cpu size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Sandbox Uji Coba Langsung Presiden Konoha AI</h3>
            <p className="text-xs text-slate-500">
              Ketik pertanyaan untuk mengetes respon model Cloudflare Workers AI secara langsung dari server.
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Pertanyaan Uji Coba</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleTestAI();
                  }
                }}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none text-slate-800 font-medium"
                placeholder="Tanyakan sesuatu pada Presiden Konoha..."
              />
              <button
                type="button"
                onClick={handleTestAI}
                disabled={testing || !testPrompt.trim()}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
              >
                {testing ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                <span>{testing ? 'Mengirim...' : 'Kirim Uji Coba'}</span>
              </button>
            </div>
          </div>

          {/* Kotak Hasil Respon Sandbox */}
          {testResult && (
            <div
              className={`p-4 rounded-xl border text-xs transition-all ${
                testResult.ok
                  ? 'bg-emerald-50/50 border-emerald-200 text-slate-800'
                  : 'bg-rose-50/50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center justify-between font-bold pb-2 mb-2 border-b border-slate-200/60 text-[11px]">
                <span className="flex items-center gap-1.5">
                  {testResult.ok ? (
                    <CheckCircle2 size={14} className="text-emerald-600" />
                  ) : (
                    <XCircle size={14} className="text-rose-600" />
                  )}
                  <span>
                    {testResult.ok ? 'Respon Presiden Konoha AI (Sukses)' : 'Uji Coba Gagal'}
                  </span>
                </span>
                {testResult.latencyMs && (
                  <span className="text-slate-500 font-mono">
                    Latensi: {testResult.latencyMs} ms
                  </span>
                )}
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">
                {testResult.ok ? testResult.reply : testResult.error}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
