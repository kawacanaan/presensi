import { Student, AttendanceRecord, UserAccount, SchoolProfile, AcademicEvent, SystemConfig, Subject } from '../types';

// Standar Mata Pelajaran Sekolah Dasar (SD) Indonesia
export const DEFAULT_SD_SUBJECTS: Subject[] = [];

// Bersih & siap pakai: data siswa awal dikosongkan (diisi via tambah manual / import CSV)
export const INITIAL_STUDENTS: Student[] = [];

// Profil Identitas Sekolah: Dikosongkan untuk diisi langsung oleh pengguna/sekolah
export const INITIAL_SCHOOL_PROFILE: SchoolProfile = {
  namaSekolah: '',
  jenjang: 'SD',
  npsn: '',
  alamat: '',
  jalan: '',
  desaKelurahan: '',
  kecamatan: '',
  kabupatenKota: '',
  provinsi: '',
  kodePos: '',
  teleponFax: '',
  email: '',
  website: '',
  namaKepalaSekolah: '',
  nipKepalaSekolah: '',
  tahunPelajaran: '2026/2027',
  semester: '1',
  kelas: '',
  namaWaliKelas: '',
  nipWaliKelas: '',
};

// Konfigurasi Sistem Operasional & Format Laporan
export const INITIAL_SYSTEM_CONFIG: SystemConfig = {
  appTitle: 'Absensi Siswa',
  appSubtitle: '',
  footerCopyright: '© 2026 Kawacanaan by Maulana Yusuf. All Rights Reserved.',
  letterheadType: 'standard_text',
  letterheadImageUrl: '',
  showLetterhead: true,
  defaultCheckInTime: '06:30 AM',
  defaultCheckOutTime: '12:20 PM',
  reportPlace: '',
  reportDate: '',
  studentSelfAttendanceEnabled: true,
  checkInStartTime: '06:00',
  checkInDeadlineTime: '07:00',
  checkOutStartTime: '12:30',
  autoMarkLate: true,
};

// Authentication is managed exclusively by Supabase Auth. No local/default password is stored here.
export const INITIAL_USERS: UserAccount[] = [];

// Kalender Agenda Awal: Kosong
export const INITIAL_EVENTS: AcademicEvent[] = [];

// Riwayat Absensi Awal: Bersih / Kosong
export const INITIAL_ATTENDANCE: AttendanceRecord[] = [];
