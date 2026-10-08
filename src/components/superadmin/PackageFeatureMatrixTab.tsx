import React, { useState, useEffect, useMemo } from 'react';
import {
  Check,
  X,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  ShieldCheck,
  Info,
  CheckCircle2,
  Lock,
  Filter,
} from 'lucide-react';
import {
  SYSTEM_FEATURES,
  FeatureCategory,
  getActiveFeatureMatrix,
  saveActiveFeatureMatrix,
  resetFeatureMatrixToDefault,
  PackageMatrixOverrides,
} from '../../utils/featureRegistry';

export const PackageFeatureMatrixTab: React.FC<{
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}> = ({ showToast }) => {
  const [matrix, setMatrix] = useState<PackageMatrixOverrides>(() => getActiveFeatureMatrix());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [hasChanges, setHasChanges] = useState(false);

  // Sync state if external change happens
  useEffect(() => {
    const handleUpdate = () => {
      setMatrix(getActiveFeatureMatrix());
      setHasChanges(false);
    };
    window.addEventListener('kawacanaan_feature_matrix_updated', handleUpdate);
    return () => window.removeEventListener('kawacanaan_feature_matrix_updated', handleUpdate);
  }, []);

  const categories = useMemo<FeatureCategory[]>(() => [
    'Data Referensi',
    'Presensi Siswa',
    'Rekapitulasi',
    'Laporan & Cetak',
    'Kalender & Jam',
    'Multi-User & Portal',
  ], []);

  const filteredFeatures = useMemo(() => {
    return SYSTEM_FEATURES.filter((feat) => {
      const matchCat = selectedCategory === 'all' || feat.category === selectedCategory;
      const matchQuery =
        !searchQuery.trim() ||
        feat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feat.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feat.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [searchQuery, selectedCategory]);

  const toggleFeature = (pkgKey: 'guru_gratis' | 'guru_pro' | 'sekolah_pro', featId: string) => {
    setMatrix((prev) => {
      const next = { ...prev };
      if (!next[pkgKey]) next[pkgKey] = {};
      next[pkgKey] = {
        ...next[pkgKey],
        [featId]: !next[pkgKey][featId],
      };
      return next;
    });
    setHasChanges(true);
  };

  const handleSave = () => {
    saveActiveFeatureMatrix(matrix);
    setHasChanges(false);
    showToast('Konfigurasi matriks ceklis fitur berhasil disimpan ke sistem!', 'success');
  };

  const handleReset = () => {
    if (window.confirm('Kembalikan konfigurasi matriks ceklis ke setelan pabrik default?')) {
      const def = resetFeatureMatrixToDefault();
      setMatrix(def);
      setHasChanges(false);
      showToast('Matriks fitur dikembalikan ke setelan default pabrik.', 'info');
    }
  };

  // Metrik total aktif
  const stats = useMemo(() => {
    let gratis = 0;
    let guru = 0;
    let sekolah = 0;
    const total = SYSTEM_FEATURES.length;

    SYSTEM_FEATURES.forEach((feat) => {
      if (matrix.guru_gratis?.[feat.id]) gratis++;
      if (matrix.guru_pro?.[feat.id]) guru++;
      if (matrix.sekolah_pro?.[feat.id]) sekolah++;
    });

    return { gratis, guru, sekolah, total };
  }, [matrix]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Info */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-lg border border-blue-800/40 relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-bold uppercase tracking-wider">
            <SlidersHorizontal size={13} className="text-blue-400" />
            <span>Integrasi Kontrol Hak Akses Super Admin</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            Matriks Ceklis Fitur Paket Sistem Kawacanaan
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Daftar 24 fitur resmi sistem disajikan seragam untuk seluruh paket. Tanda ceklis (✅) menandakan hak akses terbuka, sedangkan silang (❌) akan mengarahkan pengguna ke pesan upgrade yang ramah.
          </p>
        </div>

        {/* Floating Abstract Shapes */}
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* KPI Cards: Ringkasan Fitur per Paket */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Paket Gratis */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              Ruang Kerja Individu
            </span>
            <h4 className="text-sm font-black text-slate-900 mt-1">Paket Gratis</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {stats.gratis} dari {stats.total} Fitur Aktif
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-black text-base flex items-center justify-center shadow-2xs">
            {Math.round((stats.gratis / stats.total) * 100)}%
          </div>
        </div>

        {/* 2. Paket Guru */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800">
              Ruang Kerja Individu
            </span>
            <h4 className="text-sm font-black text-slate-900 mt-1">Paket Guru (Pro)</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {stats.guru} dari {stats.total} Fitur Aktif
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 font-black text-base flex items-center justify-center shadow-2xs">
            {Math.round((stats.guru / stats.total) * 100)}%
          </div>
        </div>

        {/* 3. Paket Sekolah */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
              Ruang Kerja Sekolah
            </span>
            <h4 className="text-sm font-black text-slate-900 mt-1">Paket Sekolah</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {stats.sekolah} dari {stats.total} Fitur Aktif (Terceklis Penuh)
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-black text-base flex items-center justify-center shadow-2xs">
            {Math.round((stats.sekolah / stats.total) * 100)}%
          </div>
        </div>
      </div>

      {/* Control Bar: Filter & Action Buttons */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full lg:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari fitur sistem..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
              id="input-search-feature"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-slate-50/50 text-slate-700 cursor-pointer"
            id="select-category-filter"
          >
            <option value="all">Semua Kategori (6 Rumpun)</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition active:scale-95 cursor-pointer"
            title="Kembalikan semua centang ke setelan default sistem"
            id="btn-reset-matrix"
          >
            <RotateCcw size={13} />
            <span>Setelan Pabrik</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer ${
              hasChanges
                ? 'bg-blue-600 hover:bg-blue-700 text-white animate-pulse'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            }`}
            id="btn-save-feature-matrix"
          >
            <Save size={14} />
            <span>Simpan Perubahan Matriks</span>
          </button>
        </div>
      </div>

      {/* Main Table: Matriks 24 Fitur */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-3.5 px-4 font-black uppercase tracking-wider text-[11px] w-12 text-center">
                  No
                </th>
                <th className="py-3.5 px-4 font-black uppercase tracking-wider text-[11px] min-w-[280px]">
                  Daftar Fitur Sistem Kawacanaan
                </th>
                <th className="py-3.5 px-4 font-black uppercase tracking-wider text-[11px] w-48 text-center bg-slate-100/50">
                  <div className="flex flex-col items-center">
                    <span className="text-slate-800">Paket Gratis</span>
                    <span className="text-[10px] font-normal text-slate-400">Ruang Kerja Individu</span>
                  </div>
                </th>
                <th className="py-3.5 px-4 font-black uppercase tracking-wider text-[11px] w-48 text-center bg-blue-50/40">
                  <div className="flex flex-col items-center">
                    <span className="text-blue-900">Paket Guru</span>
                    <span className="text-[10px] font-normal text-blue-600">Ruang Kerja Individu</span>
                  </div>
                </th>
                <th className="py-3.5 px-4 font-black uppercase tracking-wider text-[11px] w-48 text-center bg-indigo-50/40">
                  <div className="flex flex-col items-center">
                    <span className="text-indigo-900">Paket Sekolah</span>
                    <span className="text-[10px] font-normal text-indigo-600">Ruang Kerja Sekolah (100%)</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFeatures.map((feat, idx) => {
                const isGratis = !!matrix.guru_gratis?.[feat.id];
                const isGuru = !!matrix.guru_pro?.[feat.id];
                const isSekolah = !!matrix.sekolah_pro?.[feat.id];

                return (
                  <tr
                    key={feat.id}
                    className="hover:bg-blue-50/20 transition-colors group"
                    id={`row-feat-${feat.id}`}
                  >
                    {/* No */}
                    <td className="py-3 px-4 text-center font-bold text-slate-500 text-xs">
                      {SYSTEM_FEATURES.findIndex((f) => f.id === feat.id) + 1}
                    </td>

                    {/* Feature Name & Category */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-slate-800 text-xs group-hover:text-blue-700 transition-colors">
                            {feat.name}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-200">
                            {feat.category}
                          </span>
                          {feat.id === 'portal_siswa' && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Poin 21 - Default Off di Pengaturan
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          {feat.description}
                        </p>
                      </div>
                    </td>

                    {/* 1. Paket Gratis Checkbox */}
                    <td className="py-3 px-4 text-center bg-slate-100/30">
                      <button
                        type="button"
                        onClick={() => toggleFeature('guru_gratis', feat.id)}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-xl transition-all cursor-pointer shadow-2xs ${
                          isGratis
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
                            : 'bg-slate-200 hover:bg-slate-300 text-slate-400'
                        }`}
                        title={isGratis ? 'Terceklis (Aktif di Paket Gratis)' : 'Tidak Terceklis (Terkunci)'}
                        id={`btn-toggle-gratis-${feat.id}`}
                      >
                        {isGratis ? <Check size={16} className="stroke-[2.5]" /> : <X size={16} />}
                      </button>
                    </td>

                    {/* 2. Paket Guru Checkbox */}
                    <td className="py-3 px-4 text-center bg-blue-50/20">
                      <button
                        type="button"
                        onClick={() => toggleFeature('guru_pro', feat.id)}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-xl transition-all cursor-pointer shadow-2xs ${
                          isGuru
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                            : 'bg-slate-200 hover:bg-slate-300 text-slate-400'
                        }`}
                        title={isGuru ? 'Terceklis (Aktif di Paket Guru)' : 'Tidak Terceklis (Terkunci)'}
                        id={`btn-toggle-guru-${feat.id}`}
                      >
                        {isGuru ? <Check size={16} className="stroke-[2.5]" /> : <X size={16} />}
                      </button>
                    </td>

                    {/* 3. Paket Sekolah Checkbox */}
                    <td className="py-3 px-4 text-center bg-indigo-50/20">
                      <button
                        type="button"
                        onClick={() => toggleFeature('sekolah_pro', feat.id)}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-xl transition-all cursor-pointer shadow-2xs ${
                          isSekolah
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                            : 'bg-slate-200 hover:bg-slate-300 text-slate-400'
                        }`}
                        title={isSekolah ? 'Terceklis (Aktif di Paket Sekolah)' : 'Tidak Terceklis (Terkunci)'}
                        id={`btn-toggle-sekolah-${feat.id}`}
                      >
                        {isSekolah ? <Check size={16} className="stroke-[2.5]" /> : <X size={16} />}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredFeatures.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400 text-xs">
                    Tidak ditemukan fitur sistem yang sesuai dengan kata kunci pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Info size={14} className="text-blue-600 shrink-0" />
            <span>Perubahan ceklis langsung diterapkan ke aturan verifikasi hak akses pengguna saat disimpan.</span>
          </div>
          <span className="font-bold text-slate-700">
            Total {filteredFeatures.length} Fitur Terdaftar
          </span>
        </div>
      </div>
    </div>
  );
};
