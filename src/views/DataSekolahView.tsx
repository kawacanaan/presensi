import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { SchoolProfile } from '../types';
import {
  Building2,
  GraduationCap,
  MapPin,
  Phone,
  School,
  Info,
  Calendar,
  Check,
  Mail,
  Globe,
  UserCheck,
  RefreshCw,
  Save
} from 'lucide-react';

export const DataSekolahView: React.FC = () => {
  const { schoolProfile, updateSchoolProfile, currentUser, showToast, activeWorkspace } = useApp();
  const schoolId = currentUser?.schoolId || activeWorkspace?.workspaceId || 'default';
  const draftKey = `kawacanaan_draft_school_profile_${schoolId}`;

  const [formData, setFormData] = useState<SchoolProfile>(() => {
    let base = { ...schoolProfile };
    try {
      const cached = localStorage.getItem(`kawacanaan_school_profile_${schoolId}`);
      if (cached) {
        base = { ...base, ...JSON.parse(cached) };
      }
    } catch (_) {}
    return {
      ...base,
      jenjang: 'SD/MI',
      tahunPelajaran: base.tahunPelajaran || '2025/2026',
      semester: base.semester || '1 (Ganjil)',
    };
  });
  const [saving, setSaving] = useState(false);
  const isDirtyRef = React.useRef(false);

  // Sinkronisasi stabil: Hanya memperbarui data jika form belum diubah user dan konteks membawa data valid
  useEffect(() => {
    if (!isDirtyRef.current) {
      setFormData((prev) => ({
        ...prev,
        ...schoolProfile,
        namaSekolah: schoolProfile.namaSekolah || prev.namaSekolah || '',
        npsn: schoolProfile.npsn || prev.npsn || '',
        jalan: schoolProfile.jalan || prev.jalan || '',
        desaKelurahan: schoolProfile.desaKelurahan || prev.desaKelurahan || '',
        kecamatan: schoolProfile.kecamatan || prev.kecamatan || '',
        kabupatenKota: schoolProfile.kabupatenKota || prev.kabupatenKota || '',
        provinsi: schoolProfile.provinsi || prev.provinsi || '',
        kodePos: schoolProfile.kodePos || prev.kodePos || '',
        teleponFax: schoolProfile.teleponFax || prev.teleponFax || '',
        email: schoolProfile.email || prev.email || '',
        website: schoolProfile.website || prev.website || '',
        namaKepalaSekolah: schoolProfile.namaKepalaSekolah || prev.namaKepalaSekolah || '',
        nipKepalaSekolah: schoolProfile.nipKepalaSekolah || prev.nipKepalaSekolah || '',
        jenjang: 'SD/MI',
        tahunPelajaran: schoolProfile.tahunPelajaran || prev.tahunPelajaran || '2025/2026',
        semester: schoolProfile.semester || prev.semester || '1 (Ganjil)',
      }));
    }
  }, [schoolProfile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    isDirtyRef.current = true;
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      try {
        localStorage.setItem(`kawacanaan_school_profile_${schoolId}`, JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSchoolProfile({
        ...formData,
        jenjang: 'SD/MI',
      });
      isDirtyRef.current = false;
      showToast('Identitas dan profil sekolah berhasil disimpan!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan identitas sekolah.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const isPersonalWorkspace =
    activeWorkspace?.workspaceType === 'personal' ||
    activeWorkspace?.workspaceType === 'individu' ||
    (currentUser?.subscriptionPlan === 'mulai' && !currentUser?.schoolId);

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  const isWaliKelas = currentUser?.role === 'WALI KELAS';
  const isGuruMapel = currentUser?.role === 'GURU MAPEL';

  // Ketentuan: Identitas sekolah memiliki akses read-only untuk role Wali Kelas dan Guru Mapel di Ruang Kerja Sekolah
  const isReadOnly = !isAdmin && !isPersonalWorkspace;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200">
      {isPersonalWorkspace && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 text-blue-900 rounded-2xl text-xs font-medium">
          <Info size={18} className="text-blue-600 shrink-0" />
          <span>
            <strong>Ruang Kerja Individu:</strong> Anda dapat mengatur identitas sekolah tempat Anda bertugas untuk keperluan format cetak laporan, banner kop surat, dan semester aktif kelas binaan Anda.
          </span>
        </div>
      )}

      {isReadOnly && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs font-medium">
          <Info size={18} className="text-amber-600 shrink-0" />
          <span>
            Mode Hanya Lihat: Anda sedang berada di Ruang Kerja Sekolah dengan hak akses <strong>{currentUser?.role}</strong>. Hanya Administrator Sekolah yang dapat mengubah identitas sekolah induk.
          </span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ================= SECTION 1: IDENTITAS SEKOLAH ================= */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <Building2 size={18} />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900">Identitas Sekolah</h2>
                <p className="text-[11px] text-slate-500">Informasi pokok data identitas satuan pendidikan, jenjang, NPSN, tahun pelajaran, dan semester.</p>
              </div>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-12 gap-5">
            {/* Nama Satuan Pendidikan */}
            <div className="sm:col-span-12 space-y-1.5">
              <label htmlFor="input-nama-sekolah" className="block text-xs font-bold text-slate-700">
                Nama Satuan Pendidikan <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Building2 size={16} />
                </div>
                <input
                  id="input-nama-sekolah"
                  type="text"
                  name="namaSekolah"
                  disabled={isReadOnly}
                  required
                  value={formData.namaSekolah}
                  onChange={handleChange}
                  placeholder="Contoh: SD Negeri 01 Cibinong"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 outline-none transition disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>
              <span className="text-[10px] text-slate-400 block">Nama resmi sekolah yang tercetak pada kop surat resmi, rekapitulasi kehadiran, dan laporan absensi.</span>
            </div>

            {/* Jenjang Pendidikan: SD / MI Sederajat */}
            <div className="sm:col-span-4 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Jenjang Pendidikan <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold text-xs">
                <GraduationCap size={18} className="text-blue-600 shrink-0" />
                <div className="flex-1">
                  <span>SD / MI Sederajat</span>
                  <span className="block text-[10px] text-slate-500 font-normal">Sekolah Dasar / Madrasah Ibtidaiyah</span>
                </div>
              </div>
            </div>

            {/* NPSN (Input Manual) */}
            <div className="sm:col-span-8 space-y-1.5">
              <label htmlFor="input-npsn" className="block text-xs font-bold text-slate-700">
                NPSN (Nomor Pokok Sekolah Nasional) <span className="text-rose-500">*</span>
              </label>
              <input
                id="input-npsn"
                type="text"
                name="npsn"
                disabled={isReadOnly}
                required
                value={formData.npsn}
                onChange={handleChange}
                placeholder="Contoh: 20104501"
                maxLength={8}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 outline-none transition disabled:bg-slate-100 disabled:text-slate-500"
              />
              <span className="text-[10px] text-slate-400 block">
                Nomor Pokok Sekolah Nasional 8 digit resmi.
              </span>
            </div>

            {/* Tahun Pelajaran */}
            <div className="sm:col-span-6 space-y-1.5">
              <label htmlFor="input-tahun-pelajaran" className="block text-xs font-bold text-slate-700">
                Tahun Pelajaran <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Calendar size={16} />
                </div>
                <input
                  id="input-tahun-pelajaran"
                  type="text"
                  name="tahunPelajaran"
                  disabled={isReadOnly}
                  required
                  value={formData.tahunPelajaran || '2025/2026'}
                  onChange={handleChange}
                  placeholder="Contoh: 2025/2026"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 outline-none transition disabled:bg-slate-100"
                />
              </div>
              <span className="text-[10px] text-slate-400 block">Tahun ajaran kalender pendidikan saat ini.</span>
            </div>

            {/* Semester */}
            <div className="sm:col-span-6 space-y-1.5">
              <label htmlFor="select-semester" className="block text-xs font-bold text-slate-700">
                Semester <span className="text-rose-500">*</span>
              </label>
              <select
                id="select-semester"
                name="semester"
                disabled={isReadOnly}
                value={formData.semester || '1 (Ganjil)'}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 outline-none transition cursor-pointer disabled:bg-slate-100"
              >
                <option value="1 (Ganjil)">Semester 1 (Ganjil)</option>
                <option value="2 (Genap)">Semester 2 (Genap)</option>
              </select>
              <span className="text-[10px] text-slate-400 block">Periode semester yang sedang berjalan.</span>
            </div>
          </div>
        </div>

        {/* ================= SECTION 2: ALAMAT SEKOLAH ================= */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <MapPin size={18} />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900">2. Alamat Sekolah</h2>
                <p className="text-[11px] text-slate-500">Struktur alamat satuan pendidikan: Jalan, RT/RW, Desa/Kelurahan, Kecamatan, Kabupaten/Kota, Provinsi, dan Kode Pos.</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Alamat Jalan */}
            <div className="space-y-1.5">
              <label htmlFor="input-jalan" className="block text-xs font-bold text-slate-700">
                Alamat Jalan / Dusun / RT & RW <span className="text-rose-500">*</span>
              </label>
              <input
                id="input-jalan"
                type="text"
                name="jalan"
                disabled={isReadOnly}
                value={formData.jalan || ''}
                onChange={handleChange}
                placeholder="Contoh: Jl. Pendidikan No. 12 RT 02 / RW 05"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 rounded-xl text-xs sm:text-sm font-medium text-slate-900 outline-none transition disabled:bg-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Desa / Kelurahan */}
              <div className="space-y-1.5">
                <label htmlFor="input-desa" className="block text-xs font-bold text-slate-700">
                  Desa / Kelurahan
                </label>
                <input
                  id="input-desa"
                  type="text"
                  name="desaKelurahan"
                  disabled={isReadOnly}
                  value={formData.desaKelurahan || ''}
                  onChange={handleChange}
                  placeholder="Contoh: Cibinong"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 rounded-xl text-xs sm:text-sm font-medium text-slate-900 outline-none transition disabled:bg-slate-100"
                />
              </div>

              {/* Kecamatan */}
              <div className="space-y-1.5">
                <label htmlFor="input-kecamatan" className="block text-xs font-bold text-slate-700">
                  Kecamatan
                </label>
                <input
                  id="input-kecamatan"
                  type="text"
                  name="kecamatan"
                  disabled={isReadOnly}
                  value={formData.kecamatan || ''}
                  onChange={handleChange}
                  placeholder="Contoh: Kec. Cibinong"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 rounded-xl text-xs sm:text-sm font-medium text-slate-900 outline-none transition disabled:bg-slate-100"
                />
              </div>

              {/* Kabupaten / Kota */}
              <div className="space-y-1.5">
                <label htmlFor="input-kabupaten" className="block text-xs font-bold text-slate-700">
                  Kabupaten / Kota <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-kabupaten"
                  type="text"
                  name="kabupatenKota"
                  disabled={isReadOnly}
                  value={formData.kabupatenKota || ''}
                  onChange={handleChange}
                  placeholder="Contoh: Kab. Bogor"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 rounded-xl text-xs sm:text-sm font-medium text-slate-900 outline-none transition disabled:bg-slate-100"
                />
              </div>

              {/* Provinsi */}
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
                <label htmlFor="input-provinsi" className="block text-xs font-bold text-slate-700">
                  Provinsi <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-provinsi"
                  type="text"
                  name="provinsi"
                  disabled={isReadOnly}
                  value={formData.provinsi || ''}
                  onChange={handleChange}
                  placeholder="Contoh: Jawa Barat"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 rounded-xl text-xs sm:text-sm font-medium text-slate-900 outline-none transition disabled:bg-slate-100"
                />
              </div>

              {/* Kode Pos */}
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <label htmlFor="input-kodepos" className="block text-xs font-bold text-slate-700">
                  Kode Pos
                </label>
                <input
                  id="input-kodepos"
                  type="text"
                  name="kodePos"
                  disabled={isReadOnly}
                  value={formData.kodePos || ''}
                  onChange={handleChange}
                  placeholder="Contoh: 16911"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 outline-none transition disabled:bg-slate-100"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ================= SECTION 3: KONTAK & MEDIA RESMI ================= */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <Phone size={18} />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900">3. Saluran Kontak & Komunikasi Resmi</h2>
                <p className="text-[11px] text-slate-500">Nomor telepon kantor sekolah, alamat surat elektronik (email), dan website resmi.</p>
              </div>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Telepon / Fax */}
            <div className="space-y-1.5">
              <label htmlFor="input-telepon" className="block text-xs font-bold text-slate-700">
                Telepon / Fax
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Phone size={16} />
                </div>
                <input
                  id="input-telepon"
                  type="text"
                  name="teleponFax"
                  disabled={isReadOnly}
                  value={formData.teleponFax || ''}
                  onChange={handleChange}
                  placeholder="(021) 8751234"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 rounded-xl text-xs sm:text-sm font-medium text-slate-900 outline-none transition disabled:bg-slate-100"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="input-email" className="block text-xs font-bold text-slate-700">
                Email Resmi Sekolah
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail size={16} />
                </div>
                <input
                  id="input-email"
                  type="email"
                  name="email"
                  disabled={isReadOnly}
                  value={formData.email || ''}
                  onChange={handleChange}
                  placeholder="sdn01cibinong@gmail.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 rounded-xl text-xs sm:text-sm font-medium text-slate-900 outline-none transition disabled:bg-slate-100"
                />
              </div>
            </div>

            {/* Website */}
            <div className="space-y-1.5">
              <label htmlFor="input-website" className="block text-xs font-bold text-slate-700">
                Website / Portal Sekolah
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Globe size={16} />
                </div>
                <input
                  id="input-website"
                  type="text"
                  name="website"
                  disabled={isReadOnly}
                  value={formData.website || ''}
                  onChange={handleChange}
                  placeholder="https://sdn01cibinong.sch.id"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 rounded-xl text-xs sm:text-sm font-medium text-slate-900 outline-none transition disabled:bg-slate-100"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ================= SECTION 4: KEPALA SEKOLAH ================= */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <UserCheck size={18} />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900">4. Kepala Sekolah</h2>
                <p className="text-[11px] text-slate-500">Nama lengkap dan NIP Kepala Sekolah sebagai penandatangan dokumen resmi kehadiran.</p>
              </div>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Nama Kepala Sekolah */}
            <div className="space-y-1.5">
              <label htmlFor="input-kepala-sekolah" className="block text-xs font-bold text-slate-700">
                Nama Lengkap Kepala Sekolah <span className="text-rose-500">*</span>
              </label>
              <input
                id="input-kepala-sekolah"
                type="text"
                name="namaKepalaSekolah"
                disabled={isReadOnly}
                required
                value={formData.namaKepalaSekolah || ''}
                onChange={handleChange}
                placeholder="Contoh: Dra. Hj. Siti Aminah, M.Pd"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 outline-none transition disabled:bg-slate-100"
              />
            </div>

            {/* NIP Kepala Sekolah */}
            <div className="space-y-1.5">
              <label htmlFor="input-nip-kepala-sekolah" className="block text-xs font-bold text-slate-700">
                NIP / NUPTK Kepala Sekolah
              </label>
              <input
                id="input-nip-kepala-sekolah"
                type="text"
                name="nipKepalaSekolah"
                disabled={isReadOnly}
                value={formData.nipKepalaSekolah || ''}
                onChange={handleChange}
                placeholder="Contoh: 19750512 200003 2 001 atau -"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 rounded-xl text-xs sm:text-sm font-mono font-medium text-slate-900 outline-none transition disabled:bg-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        {!isReadOnly && (
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-600/20 transition cursor-pointer"
            >
              {saving ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Menyimpan...
                </>
              ) : (
                <>
                  <Save size={16} /> Simpan Identitas Sekolah
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
