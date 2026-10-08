import { normalizePlan, OfficialPlan } from './packageSystem';

/**
 * MASTER FITUR REGISTRY SISTEM KAWACANAAN
 * 
 * 24 Fitur Eksplisit yang seragam untuk seluruh paket:
 * - guru_gratis: Paket Gratis (Ruang Kerja Individu)
 * - guru_pro: Paket Guru (Ruang Kerja Individu Berbayar)
 * - sekolah_pro: Paket Sekolah (Ruang Kerja Sekolah Berbayar - 100% Terceklis)
 */

export type FeatureCategory = 
  | 'Data Referensi'
  | 'Presensi Siswa'
  | 'Rekapitulasi'
  | 'Laporan & Cetak'
  | 'Kalender & Jam'
  | 'Multi-User & Portal';

export interface SystemFeatureItem {
  id: string;
  name: string;
  category: FeatureCategory;
  description: string;
  defaultChecked: {
    guru_gratis: boolean;
    guru_pro: boolean;
    sekolah_pro: boolean;
  };
}

export const SYSTEM_FEATURES: SystemFeatureItem[] = [
  // 1. Data Referensi
  {
    id: 'data_siswa',
    name: 'Akses Data Siswa',
    category: 'Data Referensi',
    description: 'Kelola identitas peserta didik, NISN, NIS, jenis kelamin, dan nomor kontak orang tua.',
    defaultChecked: { guru_gratis: true, guru_pro: true, sekolah_pro: true },
  },
  {
    id: 'data_kelas',
    name: 'Akses Data Kelas & Rombel',
    category: 'Data Referensi',
    description: 'Manajemen rombongan belajar dan fase kurikulum SD (Fase A, B, C).',
    defaultChecked: { guru_gratis: true, guru_pro: true, sekolah_pro: true },
  },
  {
    id: 'data_guru',
    name: 'Akses Data Dewan Guru',
    category: 'Data Referensi',
    description: 'Daftar pendidik, NIP, penugasan wali kelas, dan guru mata pelajaran sekolah.',
    defaultChecked: { guru_gratis: false, guru_pro: true, sekolah_pro: true },
  },
  {
    id: 'data_mapel',
    name: 'Akses Data Mata Pelajaran',
    category: 'Data Referensi',
    description: 'Master mata pelajaran kurikulum SD, kode mapel, dan pembagian guru pengampu.',
    defaultChecked: { guru_gratis: false, guru_pro: true, sekolah_pro: true },
  },
  {
    id: 'data_sekolah',
    name: 'Akses Identitas Sekolah',
    category: 'Data Referensi',
    description: 'Profil legalitas sekolah ber-NPSN, alamat, akreditasi, dan identitas Kepala Sekolah.',
    defaultChecked: { guru_gratis: false, guru_pro: true, sekolah_pro: true },
  },

  // 2. Presensi Siswa
  {
    id: 'presensi_harian',
    name: 'Presensi Harian Wali Kelas',
    category: 'Presensi Siswa',
    description: 'Pencatatan presensi harian siswa (Hadir, Sakit, Izin, Alfa) per rombongan belajar.',
    defaultChecked: { guru_gratis: true, guru_pro: true, sekolah_pro: true },
  },
  {
    id: 'presensi_mapel',
    name: 'Presensi Guru Mapel',
    category: 'Presensi Siswa',
    description: 'Pencatatan presensi per jam pelajaran mata pelajaran dan lintas kelas yang diajarkan.',
    defaultChecked: { guru_gratis: false, guru_pro: true, sekolah_pro: true },
  },
  {
    id: 'aksi_cepat',
    name: 'Aksi Cepat Presensi',
    category: 'Presensi Siswa',
    description: 'Tombol pintas praktis Set Semua Hadir dan Reset Status dalam satu kali klik.',
    defaultChecked: { guru_gratis: true, guru_pro: true, sekolah_pro: true },
  },
  {
    id: 'catatan_kehadiran',
    name: 'Catatan Khusus Kehadiran',
    category: 'Presensi Siswa',
    description: 'Input keterangan dan alasan izin/sakit per siswa untuk catatan administratif berkala.',
    defaultChecked: { guru_gratis: false, guru_pro: true, sekolah_pro: true },
  },

  // 3. Rekapitulasi
  {
    id: 'rekap_bulanan',
    name: 'Rekapitulasi Matriks Bulanan',
    category: 'Rekapitulasi',
    description: 'Tabel matriks kehadiran siswa tanggal 1 sampai 31 dengan rekap total H, S, I, A.',
    defaultChecked: { guru_gratis: true, guru_pro: true, sekolah_pro: true },
  },
  {
    id: 'persentase_kehadiran',
    name: 'Perhitungan Persentase Kehadiran',
    category: 'Rekapitulasi',
    description: 'Kalkulasi otomatis persentase kehadiran terhadap total hari efektif belajar.',
    defaultChecked: { guru_gratis: true, guru_pro: true, sekolah_pro: true },
  },
  {
    id: 'filter_fase',
    name: 'Filter Fase Kurikulum SD',
    category: 'Rekapitulasi',
    description: 'Pengelompokan dan penyaringan data kehadiran berdasarkan Fase A (Kls 1-2), B (Kls 3-4), C (Kls 5-6).',
    defaultChecked: { guru_gratis: false, guru_pro: true, sekolah_pro: true },
  },

  // 4. Laporan & Cetak
  {
    id: 'ekspor_excel',
    name: 'Ekspor Spreadsheet (Excel)',
    category: 'Laporan & Cetak',
    description: 'Unduh rekapitulasi data mentah berformat file Microsoft Excel (.xlsx / .csv).',
    defaultChecked: { guru_gratis: true, guru_pro: true, sekolah_pro: true },
  },
  {
    id: 'cetak_pdf',
    name: 'Cetak Dokumen PDF Resmi A4',
    category: 'Laporan & Cetak',
    description: 'Format dokumen siap cetak presisi ukuran kertas A4 Landscape dengan lembar tanda tangan.',
    defaultChecked: { guru_gratis: false, guru_pro: true, sekolah_pro: true },
  },
  {
    id: 'kop_surat',
    name: 'Kop Surat Dinas Otomatis & Logo',
    category: 'Laporan & Cetak',
    description: 'Header resmi Dinas Pendidikan, logo lambang daerah / sekolah, dan garis ganda standar dinas.',
    defaultChecked: { guru_gratis: false, guru_pro: true, sekolah_pro: true },
  },
  {
    id: 'stempel_digital',
    name: 'Stempel Digital & Pengesahan KS',
    category: 'Laporan & Cetak',
    description: 'Bubuhan stempel sekolah digital dan kolom pengesahan Kepala Sekolah lengkap dengan NIP.',
    defaultChecked: { guru_gratis: false, guru_pro: true, sekolah_pro: true },
  },
  {
    id: 'laporan_kepsek',
    name: 'Laporan Supervisi Kepala Sekolah',
    category: 'Laporan & Cetak',
    description: 'Rekapitulasi komparasi kehadiran antar seluruh kelas, rekap semester, dan tahunan sekolah.',
    defaultChecked: { guru_gratis: false, guru_pro: true, sekolah_pro: true },
  },

  // 5. Kalender & Jam
  {
    id: 'kalender_pendidikan',
    name: 'Kalender Pendidikan & Libur Nasional',
    category: 'Kalender & Jam',
    description: 'Kalender interaktif sekolah dengan tanda hari libur nasional dan cuti bersama resmi.',
    defaultChecked: { guru_gratis: true, guru_pro: true, sekolah_pro: true },
  },
  {
    id: 'pengaturan_heb',
    name: 'Pengaturan Hari Efektif Belajar (HEB)',
    category: 'Kalender & Jam',
    description: 'Kustomisasi jumlah hari efektif belajar per bulan dan agenda kegiatan khusus kelas.',
    defaultChecked: { guru_gratis: false, guru_pro: true, sekolah_pro: true },
  },
  {
    id: 'pengaturan_jam',
    name: 'Pengaturan Jam Masuk & Pulang Sekolah',
    category: 'Kalender & Jam',
    description: 'Batas waktu toleransi keterlambatan dan jam operasional kegiatan belajar mengajar.',
    defaultChecked: { guru_gratis: false, guru_pro: true, sekolah_pro: true },
  },

  // 6. Multi-User & Portal
  {
    id: 'portal_siswa',
    name: 'Presensi Mandiri Siswa (Integrasi Waktu Real-Time HP / Portal Siswa)',
    category: 'Multi-User & Portal',
    description: 'Presensi mandiri siswa via HP dengan integrasi waktu real-time dan portal pantauan orang tua (Default Off di Pengaturan).',
    defaultChecked: { guru_gratis: false, guru_pro: true, sekolah_pro: true },
  },
  {
    id: 'izin_online',
    name: 'Pengajuan Izin / Sakit Online Siswa',
    category: 'Multi-User & Portal',
    description: 'Formulir digital pengajuan surat izin sakit mandiri dari wali murid langsung ke guru kelas.',
    defaultChecked: { guru_gratis: false, guru_pro: true, sekolah_pro: true },
  },
  {
    id: 'generator_akun',
    name: 'Generator Akun Otomatis Massal',
    category: 'Multi-User & Portal',
    description: 'Pembuatan otomatis nama pengguna dan kata sandi untuk seluruh guru dan siswa dalam 1 klik.',
    defaultChecked: { guru_gratis: false, guru_pro: true, sekolah_pro: true },
  },
  {
    id: 'manajemen_multiuser',
    name: 'Manajemen Multi-User & Hak Akses',
    category: 'Multi-User & Portal',
    description: 'Pengaturan peran terpadu (Admin Sekolah, Kepala Sekolah, Wali Kelas, Guru Mapel, Siswa).',
    defaultChecked: { guru_gratis: false, guru_pro: true, sekolah_pro: true },
  },
];

export type PackageMatrixOverrides = Record<string, Record<string, boolean>>;

const STORAGE_KEY_MATRIX = 'kawacanaan_package_feature_matrix_v1';

/**
 * Mendapatkan konfigurasi matriks ceklis aktif (dengan opsi kustomisasi Super Admin)
 */
export function getActiveFeatureMatrix(): PackageMatrixOverrides {
  // Buat default dari SYSTEM_FEATURES
  const defaults: PackageMatrixOverrides = {
    guru_gratis: {},
    guru_pro: {},
    sekolah_pro: {},
  };

  SYSTEM_FEATURES.forEach((feat) => {
    defaults.guru_gratis[feat.id] = feat.defaultChecked.guru_gratis;
    defaults.guru_pro[feat.id] = feat.defaultChecked.guru_pro;
    defaults.sekolah_pro[feat.id] = feat.defaultChecked.sekolah_pro;
  });

  try {
    const saved = localStorage.getItem(STORAGE_KEY_MATRIX);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        guru_gratis: { ...defaults.guru_gratis, ...(parsed.guru_gratis || {}) },
        guru_pro: { ...defaults.guru_pro, ...(parsed.guru_pro || {}) },
        sekolah_pro: { ...defaults.sekolah_pro, ...(parsed.sekolah_pro || {}) },
      };
    }
  } catch (_) {}

  return defaults;
}

/**
 * Menyimpan konfigurasi matriks ceklis yang diatur oleh Super Admin
 */
export function saveActiveFeatureMatrix(matrix: PackageMatrixOverrides): void {
  try {
    localStorage.setItem(STORAGE_KEY_MATRIX, JSON.stringify(matrix));
    // Trigger custom event agar komponen UI langsung tersinkron
    window.dispatchEvent(new CustomEvent('kawacanaan_feature_matrix_updated'));
  } catch (_) {}
}

/**
 * Mereset matriks ke setelan pabrik (default standard)
 */
export function resetFeatureMatrixToDefault(): PackageMatrixOverrides {
  const defaults: PackageMatrixOverrides = {
    guru_gratis: {},
    guru_pro: {},
    sekolah_pro: {},
  };

  SYSTEM_FEATURES.forEach((feat) => {
    defaults.guru_gratis[feat.id] = feat.defaultChecked.guru_gratis;
    defaults.guru_pro[feat.id] = feat.defaultChecked.guru_pro;
    defaults.sekolah_pro[feat.id] = feat.defaultChecked.sekolah_pro;
  });

  saveActiveFeatureMatrix(defaults);
  return defaults;
}

/**
 * Cek apakah paket tertentu memiliki akses ke fitur yang dituju
 */
export function isFeatureAccessibleInPackage(
  packageKey: OfficialPlan | string,
  featureId: string
): boolean {
  // Normalisasi key sesuai aturan resmi
  const targetKey = normalizePlan(packageKey);

  const matrix = getActiveFeatureMatrix();
  const pkgConfig = matrix[targetKey];
  if (pkgConfig && typeof pkgConfig[featureId] === 'boolean') {
    return pkgConfig[featureId];
  }

  // Fallback ke default sistem
  const feat = SYSTEM_FEATURES.find((f) => f.id === featureId);
  if (!feat) return false;
  return feat.defaultChecked[targetKey] ?? false;
}
