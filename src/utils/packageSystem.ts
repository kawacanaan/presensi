/**
 * SISTEM PAKET, RUANG KERJA, LANGGANAN, DAN ROLE KAWACANAAN
 * 
 * Standar Penamaan Entitas & Database (Bahasa Indonesia):
 * - ruang_kerja: Ruang kerja tenant (tipe: 'individu' | 'sekolah')
 * - anggota_ruang_kerja: Keanggotaan pengguna dalam ruang kerja dengan role
 * - paket: Master konfigurasi paket (Paket Gratis, Paket Guru, Paket Sekolah)
 * - langganan: Status langganan ruang kerja ('gratis' | 'uji_coba' | 'pro')
 * - pembayaran: Transaksi & invoice pembayaran upgrade paket
 * - tahun_ajaran: Tahun ajaran aktif untuk isolasi penugasan
 * - siswa: Data peserta didik
 * - guru: Data pendidik (Wali Kelas ATAU Guru Mapel per tahun ajaran)
 * - kelas: Rombongan belajar
 * - mata_pelajaran: Mata pelajaran yang diampu oleh Guru Mapel
 */

export type RuangKerjaType = 'personal' | 'school';
export type PaketStatus = 'gratis' | 'pro';

export type PaketGuruId = 'guru_gratis' | 'guru_pro';
export type PaketSekolahId = 'sekolah_pro';
export type PaketId = 'guru_gratis' | 'guru_pro' | 'sekolah_pro';
export type OfficialPlan = PaketId;
export type OfficialWorkspaceType = RuangKerjaType;

/**
 * Normalisasi paket dari berbagai variasi teks (termasuk nilai legacy).
 * Aturan wajib:
 * - free / mulai -> guru_gratis
 * - teacher / guru -> guru_pro
 * - school / sekolah -> sekolah_pro
 * - guru_gratis -> guru_gratis
 * - guru_pro -> guru_pro
 * - sekolah_pro -> sekolah_pro
 * - default fallback -> guru_gratis
 */
export function normalizePlan(rawPlan?: string | null): OfficialPlan {
  const p = (rawPlan || '').toLowerCase().trim();
  if (p === 'guru_pro' || p === 'teacher' || p === 'guru') {
    return 'guru_pro';
  }
  if (p === 'sekolah_pro' || p === 'school' || p === 'sekolah') {
    return 'sekolah_pro';
  }
  return 'guru_gratis';
}

/**
 * Normalisasi tipe ruang kerja.
 * Aturan:
 * - Workspace hanya 'personal' (Ruang Kerja Individu) dan 'school' (Ruang Kerja Sekolah).
 * - Legacy 'individu' dinormalisasi ke 'personal'.
 * - Legacy 'sekolah' dinormalisasi ke 'school'.
 */
export function normalizeWorkspaceType(rawType?: string | null): OfficialWorkspaceType {
  const t = (rawType || '').toLowerCase().trim();
  if (t === 'personal' || t === 'individu') {
    return 'personal';
  }
  return 'school';
}

/**
 * Mendapatkan nama resmi paket untuk antarmuka pengguna (UI):
 * - guru_gratis -> 'Paket Gratis'
 * - guru_pro -> 'Paket Guru'
 * - sekolah_pro -> 'Paket Sekolah'
 */
export function getPlanDisplayName(rawPlan?: string | null): string {
  const norm = normalizePlan(rawPlan);
  switch (norm) {
    case 'guru_gratis':
      return 'Paket Gratis';
    case 'guru_pro':
      return 'Paket Guru';
    case 'sekolah_pro':
      return 'Paket Sekolah';
  }
}

/**
 * Mendapatkan label resmi ruang kerja untuk antarmuka pengguna (UI):
 * - personal -> 'Ruang Kerja Individu'
 * - school -> 'Ruang Kerja Sekolah'
 */
export function getWorkspaceTypeDisplayName(rawType?: string | null): string {
  const norm = normalizeWorkspaceType(rawType);
  return norm === 'personal' ? 'Ruang Kerja Individu' : 'Ruang Kerja Sekolah';
}

/**
 * Batas Maksimal Siswa per Kelas:
 * Kebijakan sistem: Setiap kelas memiliki kapasitas maksimal 50 siswa.
 * Berlaku baik untuk Ruang Kerja Individu maupun Ruang Kerja Sekolah.
 * Sistem menolak input jika melebihi batas 50 siswa per kelas.
 */
export const MAX_STUDENTS_PER_CLASS = 50;

/**
 * 12 Kelas Standar Ruang Kerja Sekolah:
 * Struktur: Kelas 1–6 paralel A/B (1A, 1B, 2A, 2B, 3A, 3B, 4A, 4B, 5A, 5B, 6A, 6B)
 */
export const STANDARD_SCHOOL_CLASSES: readonly string[] = [
  '1A', '1B',
  '2A', '2B',
  '3A', '3B',
  '4A', '4B',
  '5A', '5B',
  '6A', '6B',
] as const;

export const DEFAULT_SCHOOL_CLASSES_COUNT = 24;

/**
 * Batas Kelas Ruang Kerja Individu berdasarkan Peran Pendidik:
 * - Wali Kelas: Kapasitas hanya 1 kelas (data & visual terbatas untuk kelas binaan sendiri)
 * - Guru Mapel: Kapasitas maksimal 6 kelas (dapat akses data/visual hingga 6 kelas berbeda)
 */
export const INDIVIDUAL_HOMEROOM_MAX_CLASSES = 2;
export const INDIVIDUAL_SUBJECT_MAX_CLASSES = 6;
export const HOMEROOM_MAX_STUDENTS = 100; // 2 kelas x 50 siswa
export const SUBJECT_TEACHER_MAX_STUDENTS = 300; // 6 kelas x 50 siswa
export const SCHOOL_MAX_STUDENTS = 1200;
export const SCHOOL_MAX_TEACHERS = 100;
export const SCHOOL_MAX_CLASSES = 24;

/**
 * Mendapatkan batas kapasitas kelas berdasarkan tipe ruang kerja dan peran pengguna
 */
export function getWorkspaceClassCapacity(
  workspaceType: string | null | undefined,
  role?: string | null | undefined
): number {
  const normType = normalizeWorkspaceType(workspaceType);
  const isPersonal = normType === 'personal';

  if (isPersonal) {
    const normRole = (role || '').toUpperCase().trim();
    if (normRole === 'GURU MAPEL' || normRole === 'SUBJECT_TEACHER') {
      return INDIVIDUAL_SUBJECT_MAX_CLASSES; // 6 kelas
    }
    return INDIVIDUAL_HOMEROOM_MAX_CLASSES; // 1 kelas (Wali Kelas / default)
  }

  // Ruang Kerja Sekolah: Kapasitas maksimal 24 kelas
  return SCHOOL_MAX_CLASSES;
}

/**
 * Mendapatkan batas kapasitas siswa berdasarkan tipe ruang kerja, paket, dan peran pengguna
 */
export function getWorkspaceStudentCapacity(
  plan?: string | null | undefined,
  workspaceType?: string | null | undefined,
  role?: string | null | undefined
): number {
  const normPlan = normalizePlan(plan);
  const normType = normalizeWorkspaceType(workspaceType);
  if (normType === 'school' || normPlan === 'sekolah_pro') {
    return SCHOOL_MAX_STUDENTS; // 1200 siswa
  }
  if (normPlan === 'guru_pro') {
    const normRole = (role || '').toUpperCase().trim();
    if (normRole === 'GURU MAPEL' || normRole === 'SUBJECT_TEACHER') {
      return SUBJECT_TEACHER_MAX_STUDENTS; // 300 siswa
    }
    return HOMEROOM_MAX_STUDENTS; // 50 siswa
  }
  // guru_gratis
  return HOMEROOM_MAX_STUDENTS; // 50 siswa
}

/**
 * Menghitung durasi aktif lisensi Paket Guru (dalam bulan) berdasarkan nominal pembayaran riil:
 * - Pembayaran Rp1 sampai Rp5.000: 1 bulan
 * - Pembayaran Rp5.001 sampai Rp10.000: 2 bulan
 * - Pembayaran Rp10.001 sampai Rp15.000: 3 bulan
 * - Pembayaran Rp15.001 sampai Rp20.000: 4 bulan
 * - Pembayaran Rp20.001 sampai Rp25.000: 5 bulan
 * - Pembayaran Rp25.001 sampai Rp30.000: 6 bulan
 * - Pembayaran Rp30.001 sampai Rp35.000: 7 bulan
 * - Pembayaran Rp35.001 sampai Rp40.000: 8 bulan
 * - Pembayaran Rp40.001 sampai Rp45.000: 9 bulan
 * - Pembayaran Rp45.001 sampai Rp50.000: 10 bulan
 * - Pembayaran Rp50.001 sampai Rp55.000: 11 bulan
 * - Pembayaran Rp55.001 atau lebih: 12 bulan (1 tahun maksimal)
 * - Nominal <= 0 atau < 1: 0 bulan (tidak aktif)
 */
export function calculateTeacherLicenseMonths(amount: number): number {
  const cleanAmount = Number(amount) || 0;
  if (cleanAmount < 1) return 0;
  if (cleanAmount <= 5000) return 1;
  if (cleanAmount <= 10000) return 2;
  if (cleanAmount <= 15000) return 3;
  if (cleanAmount <= 20000) return 4;
  if (cleanAmount <= 25000) return 5;
  if (cleanAmount <= 30000) return 6;
  if (cleanAmount <= 35000) return 7;
  if (cleanAmount <= 40000) return 8;
  if (cleanAmount <= 45000) return 9;
  if (cleanAmount <= 50000) return 10;
  if (cleanAmount <= 55000) return 11;
  return 12; // Rp55.001 ke atas dibatasi maksimal 12 bulan (1 tahun)
}

/**
 * Menghitung tanggal kedaluwarsa baru lisensi Paket Guru berdasarkan nominal pembayaran.
 * Jika pengguna sebelumnya di paket gratis atau lisensi telah habis, durasi dihitung dari sekarang (now).
 * Jika lisensi guru_pro masih aktif, durasi ditambahkan dari tanggal kedaluwarsa aktif.
 */
export function calculateTeacherLicenseExpiry(
  amount: number,
  currentExpiry?: string | null,
  isAlreadyActivePro: boolean = false
): { months: number; newExpiry: Date | null } {
  const months = calculateTeacherLicenseMonths(amount);
  if (months <= 0) return { months: 0, newExpiry: null };

  const now = new Date();
  let baseDate = now;

  if (isAlreadyActivePro && currentExpiry) {
    const curExp = new Date(currentExpiry);
    if (!isNaN(curExp.getTime()) && curExp > now) {
      baseDate = curExp;
    }
  }

  const newExpiry = new Date(baseDate);
  newExpiry.setMonth(newExpiry.getMonth() + months);
  return { months, newExpiry };
}

/**
 * Mendapatkan batas kapasitas guru berdasarkan tipe ruang kerja dan paket
 */
export function getWorkspaceTeacherCapacity(
  plan?: string | null | undefined,
  workspaceType?: string | null | undefined
): number {
  const normPlan = normalizePlan(plan);
  const normType = normalizeWorkspaceType(workspaceType);
  if (normType === 'school' || normPlan === 'sekolah_pro') {
    return SCHOOL_MAX_TEACHERS; // 100 guru
  }
  return 1;
}

/**
 * Memvalidasi apakah penambahan siswa ke dalam kelas diizinkan (maksimal 50 siswa per kelas)
 */
export function validateStudentCapacityForClass(
  currentCountInClass: number,
  newStudentsToAdd: number = 1,
  className: string = 'kelas'
): { allowed: boolean; message?: string } {
  if (currentCountInClass + newStudentsToAdd > MAX_STUDENTS_PER_CLASS) {
    const sisaSlot = Math.max(0, MAX_STUDENTS_PER_CLASS - currentCountInClass);
    return {
      allowed: false,
      message: `Kapasitas ${className} maksimal ${MAX_STUDENTS_PER_CLASS} siswa. Sistem menolak input karena kuota kelas tidak mencukupi (saat ini: ${currentCountInClass}, akan ditambah: ${newStudentsToAdd}, sisa slot: ${sisaSlot} siswa).`,
    };
  }
  return { allowed: true };
}

/**
 * Memvalidasi apakah penambahan rombongan belajar (kelas) diizinkan sesuai kapasitas ruang kerja
 */
export function validateClassAddition(
  workspaceType: string | null | undefined,
  role: string | null | undefined,
  currentClassesCount: number
): { allowed: boolean; maxAllowed: number; message?: string } {
  const maxAllowed = getWorkspaceClassCapacity(workspaceType, role);
  const isPersonal = normalizeWorkspaceType(workspaceType) === 'personal';
  const isHomeroom = (role || '').toUpperCase().trim() === 'WALI KELAS';
  const isSubject = (role || '').toUpperCase().trim() === 'GURU MAPEL';

  if (currentClassesCount >= maxAllowed) {
    if (isPersonal) {
      if (isHomeroom) {
        return {
          allowed: false,
          maxAllowed,
          message: 'Wali Kelas di Ruang Kerja Individu dibatasi maksimal 2 rombel binaan (setiap rombel maksimal 50 siswa). Silakan edit rombel yang ada untuk mengubah data.',
        };
      }
      if (isSubject) {
        return {
          allowed: false,
          maxAllowed,
          message: 'Kapasitas Guru Mapel di Ruang Kerja Individu maksimal 6 kelas. Anda telah mencapai batas maksimal 6 rombel yang diajar.',
        };
      }
      return {
        allowed: false,
        maxAllowed,
        message: 'Kapasitas Ruang Kerja Individu telah mencapai batas maksimal kelas.',
      };
    } else {
      return {
        allowed: false,
        maxAllowed,
        message: 'Kapasitas Ruang Kerja Sekolah maksimal 24 kelas. Anda telah mencapai batas kuota rombongan belajar.',
      };
    }
  }

  return { allowed: true, maxAllowed };
}

/**
 * 4 Role Resmi dalam Ruang Kerja Sekolah:
 * 1. Admin Sekolah ('ADMIN')
 * 2. Wali Kelas ('WALI KELAS')
 * 3. Guru Mapel ('GURU MAPEL')
 * 4. Siswa ('SISWA')
 */
export type SchoolRole = 'Admin Sekolah' | 'Wali Kelas' | 'Guru Mapel' | 'Siswa';

export interface PaketConfig {
  id: PaketId;
  nama: string;
  tipeRuangKerja: RuangKerjaType;
  statusPaket: PaketStatus;
  harga: number; // Dalam Rupiah (IDR) - default harga bulanan
  hargaBulanan?: number; // Harga per bulan
  hargaTahunan?: number; // Harga per tahun (dengan diskon tahunan)
  hargaTahunanPerdana?: number; // Harga tahunan perdana (cth: Rp 250.000 untuk pembelian pertama paket sekolah)
  hargaFormatted?: string;
  diskonTahunanLabel?: string; // Label penghematan (cth: 'Hemat 2 Bulan')
  durasiHari: number; // Hari masa aktif (0 = tanpa batas / lifetime)
  kapasitasSiswa: number; // Maksimal siswa - Dapat diatur Super Admin
  kapasitasGuru: number; // Maksimal guru - Dapat diatur Super Admin
  kapasitasKelas: number; // Maksimal kelas - Dapat diatur Super Admin
  fitur: string[]; // Daftar fitur yang aktif
  deskripsi: string;
  isAktif?: boolean;
}

export interface LanggananRuangKerja {
  paketId: PaketId;
  paketNama: string;
  tipeRuangKerja: RuangKerjaType;
  status: PaketStatus;
  tanggalMulai: string | null;
  tanggalKedaluwarsa: string | null;
  sisaHari: number | null;
  maksSiswa: number;
  maksGuru: number;
  maksKelas: number;
  fiturAktif: string[];
}

export interface MasterPaketSettings {
  guru_gratis: PaketConfig;
  guru_pro: PaketConfig;
  sekolah_pro: PaketConfig;
}

/**
 * Konfigurasi Standar Master Paket (Default Factory Settings)
 * Hanya mencakup 3 paket resmi:
 * 1. Paket Gratis (guru_gratis)
 * 2. Paket Guru (guru_pro)
 * 3. Paket Sekolah (sekolah_pro)
 */
export const DEFAULT_MASTER_PAKET: MasterPaketSettings = {
  // -------------------------------------------------------------
  // 1. PAKET GRATIS (RUANG KERJA INDIVIDU / DEFAULT FALLBACK)
  // -------------------------------------------------------------
  guru_gratis: {
    id: 'guru_gratis',
    nama: 'Paket Gratis',
    tipeRuangKerja: 'personal',
    statusPaket: 'gratis',
    harga: 0,
    hargaBulanan: 0,
    hargaTahunan: 0,
    durasiHari: 0, // Tanpa batas kedaluwarsa (Seumur Hidup)
    kapasitasSiswa: 50, // Maksimal 50 siswa per kelas
    kapasitasGuru: 1,
    kapasitasKelas: 1,
    fitur: [
      'Presensi Harian Siswa 1 Rombel',
      'Maksimal 50 Siswa per Kelas',
      'Rekap Kehadiran Bulanan Standar',
      'Unduh Rekap Spreadsheet (Excel)',
      'Akses Tanpa Batas Waktu (Selamanya)'
    ],
    deskripsi: 'Akses gratis selamanya bagi guru untuk mengelola presensi 1 rombel binaan secara mandiri (maks 50 siswa).'
  },

  // -------------------------------------------------------------
  // 2. PAKET GURU (RUANG KERJA INDIVIDU - DUKUNGAN PENGEMBANGAN)
  // -------------------------------------------------------------
  guru_pro: {
    id: 'guru_pro',
    nama: 'Paket Guru',
    tipeRuangKerja: 'personal',
    statusPaket: 'pro',
    harga: 5000, // Nominal dasar dukungan
    hargaBulanan: 5000,
    hargaTahunan: 60000,
    durasiHari: 30,
    kapasitasSiswa: 300, // Hingga 6 rombel x 50 siswa
    kapasitasGuru: 1,
    kapasitasKelas: 6, // Maksimal 6 kelas untuk Guru Mapel
    fitur: [
      'Presensi Harian & Jadwal Mata Pelajaran',
      'Kelola hingga 6 Rombel (Guru Mapel) atau 1 Rombel (Wali Kelas)',
      'Kapasitas hingga 50 Siswa per Kelas',
      'Cetak Laporan Format Resmi Kedinasan',
      'Ekspor Lengkap PDF & Excel per Semester',
      'Dukungan Bantuan Teknis WhatsApp'
    ],
    deskripsi: 'Aktivasi lisensi Paket Guru berdasarkan dukungan nominal via Midtrans (1 s.d. 12 bulan).'
  },

  // -------------------------------------------------------------
  // 3. PAKET SEKOLAH (RUANG KERJA SEKOLAH BERBAYAR)
  // -------------------------------------------------------------
  sekolah_pro: {
    id: 'sekolah_pro',
    nama: 'Paket Sekolah',
    tipeRuangKerja: 'school',
    statusPaket: 'pro',
    harga: 25000, // Rp 25.000 / bulan
    hargaBulanan: 25000,
    hargaTahunan: 300000, // Rp 300.000 / tahun (perpanjangan resmi)
    hargaTahunanPerdana: 250000, // Rp 250.000 (hemat 2 bulan / Rp 50.000 untuk pembelian pertama kali)
    diskonTahunanLabel: 'Hemat 2 Bulan',
    durasiHari: 30, // Perpanjangan bulanan / tahunan
    kapasitasSiswa: 1200,
    kapasitasGuru: 100,
    kapasitasKelas: 24, // Maksimal 24 kelas (rombel)
    fitur: [
      'Seluruh Fitur Presensi Terbuka Penuh',
      'Multi-Role Terpadu (Admin, Kepsek, Wali Kelas, Guru Mapel)',
      'Kapasitas Maksimal 24 Rombel (Kelas 1–6)',
      'Kapasitas Maksimal 100 Guru',
      'Kapasitas Maksimal 1.200 Siswa SD',
      'Kapasitas Maksimal 50 Siswa per Kelas',
      'Perhitungan Hari Efektif Kalender Pendidikan Otomatis',
      'Cetak Laporan Format Kedinasan A4 Standar Diknas',
      'Kop Surat Resmi Sekolah & Stempel Digital',
      'Portal Siswa & Pengajuan Izin Mandiri',
      'Bantuan Migrasi & Unggah Data Siswa Awal'
    ],
    deskripsi: 'Sistem presensi multi-user terpadu dan profesional untuk seluruh unit sekolah (maksimal 1.200 siswa, 100 guru, 24 kelas, maks 50 siswa/kelas).'
  }
};

/**
 * Format mata uang Rupiah
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Menggabungkan konfigurasi master paket default dengan penyesuaian dinamis dari Super Admin
 */
export function mergeMasterPaketConfig(customConfig?: Partial<MasterPaketSettings> | null): MasterPaketSettings {
  if (!customConfig) return DEFAULT_MASTER_PAKET;

  const result = { ...DEFAULT_MASTER_PAKET };
  const keys: (keyof MasterPaketSettings)[] = [
    'guru_gratis',
    'guru_pro',
    'sekolah_pro'
  ];

  for (const k of keys) {
    if (customConfig[k]) {
      result[k] = {
        ...DEFAULT_MASTER_PAKET[k],
        ...customConfig[k],
        hargaFormatted: formatRupiah(customConfig[k]?.harga ?? DEFAULT_MASTER_PAKET[k].harga)
      };
    } else {
      result[k].hargaFormatted = formatRupiah(result[k].harga);
    }
  }

  return result;
}

/**
 * Mendapatkan informasi langganan ruang kerja yang aktif, menghitung sisa hari,
 * dan menerapkan aturan downgrade resmi:
 * - Paket Guru expired -> target 'guru_gratis' (Paket Gratis)
 * - Paket Sekolah expired -> target 'guru_gratis' (Paket Gratis)
 * - Workspace TIDAK PERNAH berubah karena downgrade (personal tetap personal, school tetap school).
 * - DATA TIDAK DIHAPUS saat turun ke Gratis.
 */
export function resolveWorkspaceSubscription(
  workspace: {
    workspace_type?: string | null;
    workspaceType?: string | null;
    plan?: string | null;
    status?: string | null;
    subscription_started_at?: string | null;
    subscriptionStartedAt?: string | null;
    subscription_expires_at?: string | null;
    subscriptionExpiresAt?: string | null;
    max_teachers?: number | null;
    max_students?: number | null;
    max_classes?: number | null;
  } | null | undefined,
  masterPaket: MasterPaketSettings = DEFAULT_MASTER_PAKET
): LanggananRuangKerja {
  // 1. Tipe Ruang Kerja murni: 'personal' atau 'school' (TIDAK BERUBAH)
  const rawWsType = workspace?.workspace_type || workspace?.workspaceType;
  const tipeRuangKerja: RuangKerjaType = normalizeWorkspaceType(rawWsType);

  // 2. Normalisasi paket (legacy free/mulai -> guru_gratis, teacher/guru -> guru_pro, school/sekolah -> sekolah_pro)
  const normalizedPlan = normalizePlan(workspace?.plan);
  const expiresAtStr = workspace?.subscription_expires_at || workspace?.subscriptionExpiresAt || null;
  const startedAtStr = workspace?.subscription_started_at || workspace?.subscriptionStartedAt || null;

  let sisaHari: number | null = null;
  let isExpired = false;

  if (expiresAtStr) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expiry = new Date(expiresAtStr);
    expiry.setHours(0, 0, 0, 0);
    const diffMs = expiry.getTime() - now.getTime();
    sisaHari = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (sisaHari < 0) {
      isExpired = true;
    }
  }

  // 3. Penerapan Aturan Status & Downgrade:
  // - Jika paket guru_pro atau sekolah_pro telah expired -> target selalu 'guru_gratis', status 'gratis'
  // - Jika paket guru_pro atau sekolah_pro masih aktif -> status 'pro'
  // - Jika paket guru_gratis -> status 'gratis'
  let status: PaketStatus = 'gratis';
  let targetPaketId: PaketId = 'guru_gratis';

  if (normalizedPlan === 'guru_pro' || normalizedPlan === 'sekolah_pro') {
    if (isExpired) {
      status = 'gratis';
      targetPaketId = 'guru_gratis';
    } else {
      status = 'pro';
      targetPaketId = normalizedPlan;
    }
  } else {
    status = 'gratis';
    targetPaketId = 'guru_gratis';
  }

  const paketDef = masterPaket[targetPaketId] || masterPaket.guru_gratis;

  let maksSiswa = workspace?.max_students ?? paketDef.kapasitasSiswa;
  let maksGuru = workspace?.max_teachers ?? paketDef.kapasitasGuru;
  let maksKelas = workspace?.max_classes ?? paketDef.kapasitasKelas;

  // Samakan dengan aturan resmi:
  if (targetPaketId === 'guru_gratis') {
    maksSiswa = 50;
    maksKelas = 1;
    maksGuru = 1;
  } else if (targetPaketId === 'sekolah_pro') {
    if (!maksSiswa || maksSiswa === 1000 || maksSiswa === 999999 || maksSiswa === 600 || maksSiswa === 500) maksSiswa = 1200;
    if (!maksGuru || maksGuru === 25 || maksGuru === 50 || maksGuru === 999999) maksGuru = 100;
    if (!maksKelas || maksKelas === 999999 || maksKelas === 12) maksKelas = 24;
  } else if (targetPaketId === 'guru_pro') {
    if (maksSiswa === 150) maksSiswa = 300;
    if (maksKelas === 5) maksKelas = 6;
  }

  return {
    paketId: targetPaketId,
    paketNama: paketDef.nama,
    tipeRuangKerja,
    status,
    tanggalMulai: startedAtStr,
    tanggalKedaluwarsa: expiresAtStr,
    sisaHari: isExpired ? 0 : sisaHari,
    maksSiswa,
    maksGuru,
    maksKelas,
    fiturAktif: paketDef.fitur,
  };
}

/**
 * =========================================================================
 * ATURAN PENUGASAN ROLE GURU DALAM RUANG KERJA SEKOLAH:
 * - Wali Kelas ditentukan dari classes.wali_kelas_teacher_id.
 * - Satu guru hanya boleh menjadi Wali Kelas untuk satu kelas dalam tahun/periode ajaran yang sama.
 * - Guru Mapel ditentukan dari subject_teacher_assignments.
 * - Guru Mapel dapat mengajar beberapa kelas.
 * - Wali Kelas juga boleh menjadi Guru Mapel jika dibuatkan penugasan secara eksplisit.
 * =========================================================================
 */
export interface TeacherRoleValidationResult {
  valid: boolean;
  conflictType?: 'WALI_KELAS_CONFLICT' | 'GURU_MAPEL_CONFLICT' | null;
  conflictDetails?: string;
  errorMessage?: string;
  isMultiClassNotice?: boolean;
  noticeMessage?: string;
}

export function validateTeacherRoleAssignment(
  paramsOrTeacherId:
    | {
        teacherId?: string | null;
        teacherName?: string | null;
        teacherNip?: string | null;
        targetRole: 'WALI KELAS' | 'GURU MAPEL' | 'ADMIN' | 'SISWA' | 'wali_kelas' | 'guru_mapel' | string;
        schoolId?: string | null;
        academicYear?: string | null;
        existingClasses: Array<{
          id: string;
          name: string;
          waliKelasTeacherId?: string | null;
          waliKelasName?: string | null;
          academicYear?: string | null;
        }>;
        existingSubjects?: Array<{
          id: string;
          name: string;
          teacherId?: string | null;
          teacherName?: string | null;
        }>;
        teachers?: Array<{
          id: string;
          nama: string;
          nip?: string;
          tugasUtama?: string;
          tugas_utama?: string;
          jabatan?: string;
        }>;
      }
    | string,
  targetRolePos?: string,
  existingClassesPos?: Array<any>,
  existingSubjectsPos?: Array<any>,
  academicYearPos?: string | null,
  teachersPos?: Array<any>
): TeacherRoleValidationResult {
  let teacherId: string | null | undefined;
  let teacherName: string | null | undefined;
  let teacherNip: string | null | undefined;
  let targetRole: string;
  let academicYear: string | null | undefined;
  let existingClasses: Array<any>;
  let existingSubjects: Array<any>;
  let teachers: Array<any> = [];

  if (typeof paramsOrTeacherId === 'object' && paramsOrTeacherId !== null) {
    teacherId = paramsOrTeacherId.teacherId;
    teacherName = paramsOrTeacherId.teacherName;
    teacherNip = paramsOrTeacherId.teacherNip;
    targetRole = paramsOrTeacherId.targetRole;
    academicYear = paramsOrTeacherId.academicYear;
    existingClasses = paramsOrTeacherId.existingClasses || [];
    existingSubjects = paramsOrTeacherId.existingSubjects || [];
    teachers = paramsOrTeacherId.teachers || [];
  } else {
    teacherId = typeof paramsOrTeacherId === 'string' ? paramsOrTeacherId : null;
    targetRole = targetRolePos || '';
    existingClasses = existingClassesPos || [];
    existingSubjects = existingSubjectsPos || [];
    academicYear = academicYearPos;
    teachers = teachersPos || [];
  }

  let roleClean = targetRole.toUpperCase().trim();
  if (roleClean === 'WALI_KELAS') roleClean = 'WALI KELAS';
  if (roleClean === 'GURU_MAPEL') roleClean = 'GURU MAPEL';

  if (roleClean !== 'WALI KELAS') {
    return { valid: true };
  }

  const cleanName = (teacherName || '').trim().toLowerCase();
  const cleanNip = (teacherNip || '').trim().toLowerCase();

  // Cari referensi guru terkait
  const matchedTeacher = teachers.find(
    (t) =>
      (teacherId && t.id === teacherId) ||
      (cleanNip && cleanNip !== '-' && t.nip && t.nip.trim().toLowerCase() === cleanNip) ||
      (cleanName && t.nama && t.nama.trim().toLowerCase() === cleanName)
  );

  const tId = teacherId || matchedTeacher?.id;
  const tName = (matchedTeacher?.nama || teacherName || '').trim().toLowerCase();

  // Jika hendak menugaskan sebagai WALI KELAS:
  // Cek apakah guru ini SUDAH menjadi Wali Kelas pada kelas lain di tahun ajaran yang sama
  if (roleClean === 'WALI KELAS') {
    const existingHomeroomClasses = existingClasses.filter((cls) => {
      if (academicYear && cls.academicYear && cls.academicYear !== academicYear) return false;
      if (tId && cls.waliKelasTeacherId && cls.waliKelasTeacherId === tId) return true;
      if (tName && cls.waliKelasName && cls.waliKelasName.trim().toLowerCase() === tName) return true;
      return false;
    });

    // Praktik lapangan (termasuk sekolah di Jawa Barat / Indonesia dengan kebutuhan kelas rangkap / defisit guru):
    // Seorang guru diizinkan membina hingga 2 rombel kelas.
    if (existingHomeroomClasses.length >= 2) {
      const classNames = existingHomeroomClasses.map((c) => c.name).join(' & ');
      const details = `Guru "${matchedTeacher?.nama || teacherName || 'Pendidik'}" saat ini sudah menjadi Wali Kelas pada 2 rombel (${classNames}). Batas maksimal penugasan Wali Kelas rangkap adalah 2 rombel dalam tahun ajaran yang sama.`;
      return {
        valid: false,
        conflictType: 'WALI_KELAS_CONFLICT',
        conflictDetails: details,
        errorMessage: details,
      };
    }

    if (existingHomeroomClasses.length === 1) {
      const details = `Guru "${matchedTeacher?.nama || teacherName || 'Pendidik'}" saat ini sudah menjadi Wali Kelas pada "${existingHomeroomClasses[0].name}". Penugasan ini akan menjadikan beliau mengampu 2 rombel kelas binaan sekaligus.`;
      return {
        valid: true,
        isMultiClassNotice: true,
        noticeMessage: details,
      };
    }
  }

  return { valid: true };
}
