import React, { useState, useEffect } from 'react';
import {
  Megaphone,
  Bell,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Save,
  RefreshCw,
  Eye,
  Trash2,
  Users,
  Power
} from 'lucide-react';

interface AnnouncementData {
  message: string;
  type: 'info' | 'warning' | 'emergency' | 'success';
  active: boolean;
  target_audience?: 'all' | 'teachers' | 'admins';
  updatedAt?: string | null;
}

interface Props {
  call: (action: string, payload?: any) => Promise<any>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  initialAnnouncement?: AnnouncementData;
  onSaved?: (newAnn: AnnouncementData) => void;
}

export const SystemAnnouncementTab: React.FC<Props> = ({
  call,
  showToast,
  initialAnnouncement,
  onSaved,
}) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AnnouncementData>(() => ({
    message: initialAnnouncement?.message || '',
    type: initialAnnouncement?.type || 'info',
    active: initialAnnouncement?.active ?? false,
    target_audience: initialAnnouncement?.target_audience || 'all',
    updatedAt: initialAnnouncement?.updatedAt || null,
  }));

  useEffect(() => {
    if (initialAnnouncement) {
      setForm({
        message: initialAnnouncement.message || '',
        type: initialAnnouncement.type || 'info',
        active: initialAnnouncement.active ?? false,
        target_audience: initialAnnouncement.target_audience || 'all',
        updatedAt: initialAnnouncement.updatedAt || null,
      });
    }
  }, [initialAnnouncement]);

  const handleSave = async (activeState = form.active) => {
    if (activeState && !form.message.trim()) {
      showToast('Pesan pengumuman tidak boleh kosong jika status aktif.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        message: form.message,
        type: form.type,
        active: activeState,
        target_audience: form.target_audience,
      };
      const res = await call('update_system_settings', {
        section: 'announcement',
        data: payload,
      });
      if (res.ok) {
        const updated: AnnouncementData = {
          ...payload,
          updatedAt: new Date().toISOString(),
        };
        setForm(updated);
        showToast(
          activeState
            ? 'Siaran pengumuman berhasil diterbitkan ke seluruh sistem!'
            : 'Siaran pengumuman dinonaktifkan.',
          'success'
        );
        if (onSaved) onSaved(updated);
      } else {
        throw new Error(res.error || 'Gagal menyimpan siaran.');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan siaran.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const getBadgeStyle = (t: string) => {
    switch (t) {
      case 'emergency':
        return 'bg-rose-50 border-rose-200 text-rose-900 icon-rose';
      case 'warning':
        return 'bg-amber-50 border-amber-200 text-amber-900 icon-amber';
      case 'success':
        return 'bg-emerald-50 border-emerald-200 text-emerald-900 icon-emerald';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-900 icon-blue';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
            <Megaphone size={22} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Siaran & Pengumuman Global</h3>
            <p className="text-xs text-slate-500">
              Kirimkan pengumuman banner serentak yang muncul di atas layar seluruh pengguna sekolah.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave(!form.active)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
              form.active
                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            <Power size={14} />
            <span>{form.active ? 'Nonaktifkan Siaran' : 'Aktifkan & Tayangkan'}</span>
          </button>
        </div>
      </div>

      {/* Pratinjau Siaran (Live Preview) */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Eye size={15} className="text-indigo-600" />
            <span>Pratinjau Tampilan Banner (Live Preview)</span>
          </div>
          <span className="text-[11px] text-slate-400">
            {form.active ? 'Status: Sedang Tayang di Dashboard' : 'Status: Draft (Tidak Tayang)'}
          </span>
        </div>

        {form.message.trim() ? (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3.5 transition-all shadow-xs ${getBadgeStyle(
              form.type
            )}`}
          >
            <div className="shrink-0 mt-0.5">
              {form.type === 'emergency' && <AlertCircle size={20} className="text-rose-600" />}
              {form.type === 'warning' && <AlertTriangle size={20} className="text-amber-600" />}
              {form.type === 'success' && <CheckCircle2 size={20} className="text-emerald-600" />}
              {form.type === 'info' && <Info size={20} className="text-blue-600" />}
            </div>
            <div className="text-xs flex-1">
              <div className="flex items-center gap-2 font-bold mb-0.5 text-[11px]">
                <span className="uppercase tracking-wider">PENGUMUMAN PUSAT KAWACANAAN</span>
                <span className="px-2 py-0.2 rounded-full bg-white/60 border border-current text-[9px]">
                  Target: {form.target_audience === 'teachers' ? 'Khusus Guru' : form.target_audience === 'admins' ? 'Khusus Admin/KS' : 'Semua Pengguna'}
                </span>
              </div>
              <p className="leading-relaxed font-medium">{form.message}</p>
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
            Belum ada teks siaran. Ketikkan pesan pengumuman pada formulir di bawah.
          </div>
        )}
      </div>

      {/* Formulir Konfigurasi Siaran */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
        <h4 className="text-xs font-bold text-slate-800 pb-2 border-b border-slate-100">
          Formulir Pesan & Target Siaran
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Tipe Visual Banner</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as any })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none font-medium bg-white text-slate-800"
            >
              <option value="info">Informasi Umum (Warna Biru)</option>
              <option value="warning">Peringatan Penting (Warna Kuning/Oranye)</option>
              <option value="emergency">Darurat / Pemeliharaan Segera (Warna Merah)</option>
              <option value="success">Rilis Fitur Baru / Sukses (Warna Hijau)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Target Audiens Penerima</label>
            <select
              value={form.target_audience}
              onChange={(e) => setForm({ ...form, target_audience: e.target.value as any })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none font-medium bg-white text-slate-800"
            >
              <option value="all">Semua Pengguna (Guru, KS, Admin Sekolah)</option>
              <option value="teachers">Khusus Guru (Wali Kelas & Guru Mapel)</option>
              <option value="admins">Khusus Kepala Sekolah & Admin Sekolah</option>
            </select>
          </div>
        </div>

        <div className="text-xs">
          <label className="block font-semibold text-slate-700 mb-1.5">
            Isi Pesan Pengumuman
          </label>
          <textarea
            rows={4}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none font-medium text-slate-800 leading-relaxed"
            placeholder="Tuliskan isi pengumuman yang ingin disampaikan ke seluruh sekolah..."
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <span className="text-[11px] text-slate-400">
            {form.updatedAt
              ? `Terakhir diperbarui: ${new Date(form.updatedAt).toLocaleString('id-ID')}`
              : 'Belum pernah diperbarui.'}
          </span>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {form.message && (
              <button
                type="button"
                onClick={() => setForm({ ...form, message: '' })}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                title="Hapus Teks"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(true)}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{saving ? 'Menyimpan...' : 'Simpan & Tayangkan Siaran'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
