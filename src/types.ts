export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'KEPALA SEKOLAH' | 'WALI KELAS' | 'GURU MAPEL' | 'SISWA';

export type WorkspaceType = 'personal' | 'school' | (string & {});
export type OfficialWorkspaceType = 'personal' | 'school';
export type WorkspaceRoleKey = 'super_admin' | 'school_admin' | 'homeroom_teacher' | 'subject_teacher' | 'student';
export type SubscriptionPackage = 'guru_gratis' | 'guru_pro' | 'sekolah_pro';
export type SubscriptionPlan = 'guru_gratis' | 'guru_pro' | 'sekolah_pro';
export type WorkspaceSubscriptionStatus = 'active' | 'expiring_soon' | 'grace_period' | 'suspended' | 'expired' | 'gratis' | 'pro';

// Re-export Sistem Paket, Ruang Kerja & Validasi
export * from './utils/packageSystem';

export interface WorkspaceSubscription {
  package: SubscriptionPackage;
  status: WorkspaceSubscriptionStatus;
  expiresAt?: string | null;
  maxTeachers?: number;
  maxStudents?: number;
  maxClasses?: number;
  paketId?: string;
  paketNama?: string;
  statusPaket?: 'gratis' | 'pro';
}

export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType; // 'personal' | 'school'
  npsn?: string | null;
  ownerId?: string | null;
  subscription: WorkspaceSubscription;
  schoolProfile?: SchoolProfile;
  createdAt?: string;
  metadata?: any;
}

export interface WorkspaceMembership {
  id: string;
  userId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceType: WorkspaceType;
  role: UserRole; // 'WALI KELAS' | 'GURU MAPEL' | 'ADMIN' | 'SISWA' | 'SUPER_ADMIN'
  roleKey?: WorkspaceRoleKey;
  roleLabel?: string; // e.g. "Wali Kelas", "Guru Mata Pelajaran", "Siswa", "Admin Sekolah"
  subjectId?: string | null;
  subjectName?: string | null;
  classId?: string | null;
  className?: string | null;
  studentId?: string | null;
  studentName?: string | null;
  npsn?: string | null;
  workspaceCode?: string | null;
  subscriptionPlan?: string | null;
  subscriptionExpiresAt?: string | null;
  subscriptionStatus?: string | null;
  subscription?: WorkspaceSubscription;
  joinedAt?: string;
}

// -------------------------------------------------------------
// STANDAR ENTITAS DATABASE BAHASA INDONESIA
// -------------------------------------------------------------
export type RuangKerja = Workspace;
export type AnggotaRuangKerja = WorkspaceMembership;
export type Siswa = Student;
export type Guru = Teacher;
export type Kelas = SchoolClass;
export type MataPelajaran = Subject;
export type TahunAjaran = string;


export interface SchoolClass {
  id: string;
  name: string;
  grade: number;
  academicYear?: string;
  waliKelasTeacherId?: string | null;
  waliKelasName?: string | null;
}

export interface TeacherClassAssignment {
  id: string;
  teacherId: string;
  classId: string;
  className?: string;
}

// Data master Guru (Pendidik)
export interface Teacher {
  id: string;
  nama: string;
  nip: string;
  jenisKelamin: 'L' | 'P';
  tugasUtama?: 'Wali Kelas' | 'Guru Mapel' | string;
  tugas_utama?: string;
}

export type AttendanceStatus = 'Hadir' | 'Sakit' | 'Izin' | 'Alfa' | '' | '-';

export interface Student {
  id: string;
  nisn: string;
  nama: string;
  gender: 'L' | 'P'; // L = Putra, P = Putri
  schoolId?: string | null;
  classId?: string | null;
  className?: string;
  namaWali?: string;
  noHpWali?: string; // Nomor WhatsApp Orang Tua / Wali
  hubungannya?: 'Ayah' | 'Ibu' | 'Wali' | string;
}

export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface StudentLeaveRequest {
  id: string;
  schoolId?: string | null;
  studentId: string;
  studentName: string;
  nisn?: string;
  classId?: string | null;
  className?: string;
  requesterName: string;
  requesterRole: 'Ayah' | 'Ibu' | 'Wali' | 'Siswa';
  requesterPhone?: string; // Nomor WhatsApp orang tua/pengaju
  leaveType: 'sakit' | 'izin';
  subCategory?: string; // misal "Sakit (Surat Keterangan Dokter)", "Sakit (Istirahat di Rumah)", "Acara Keluarga", "Dispensasi Kegiatan/Lomba"
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string;
  attachmentUrl?: string; // Data URL / Base64 foto surat dokter atau surat izin bertanda tangan
  attachmentName?: string;
  status: LeaveRequestStatus;
  submittedAt: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
}

export type AttendanceType = 'DAILY' | 'SUBJECT';

export interface SubjectClassSchedule {
  classId: string;
  className?: string;
  days: string[]; // e.g. ['Senin'] or ['Senin', 'Kamis']
  startTime?: string; // e.g. "07:30"
  endTime?: string; // e.g. "09:00"
}

export interface Subject {
  id: string;
  name: string;
  code?: string; // Akronim (e.g. PJOK, PABP, MTK)
  isSpecialized?: boolean; // true for guru mapel
  teacherId?: string | null; // ID guru pengajar terintegrasi
  teacherName?: string | null; // Nama guru pengajar
  targetClassIds?: string[]; // Daftar ID kelas yang diajar
  targetClassNames?: string[]; // Daftar nama kelas yang diajar
  scheduleDays?: string[]; // Hari jadwal diajarkan (Senin, Selasa, ...)
  classSchedules?: SubjectClassSchedule[]; // Jadwal per kelas dan hari (e.g. Kelas 6A: Senin, Kelas 6B: Rabu)
  lessonPeriod?: string; // Jam/pertemuan ke (e.g. Jam ke 1-2)
  defaultStartTime?: string; // Default jam mulai (e.g. "07:30")
  defaultEndTime?: string; // Default jam selesai (e.g. "09:00")
}

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
  checkInTime: string; // e.g. "06:30 AM" or "06:30"
  checkOutTime: string; // e.g. "12:20 PM" or "12:20"
  notes?: string;
  type?: AttendanceType; // 'DAILY' (Wali Kelas) or 'SUBJECT' (Guru Mapel)
  subjectId?: string | null;
  subjectName?: string | null;
  classId?: string | null;
  teacherId?: string | null;
  teacherName?: string | null;
  learningActivity?: string; // Catatan keaktifan/pembelajaran guru mapel
}

export type TenantSubscriptionStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'GRACE_PERIOD' | 'SUSPENDED';

export interface UserAccount {
  id: string;
  teacherId?: string | null;
  name: string;
  username: string;
  nip?: string | null;
  password?: string;
  role: UserRole;
  email?: string | null;
  authProvider?: string | null;
  isGoogleAuth?: boolean;
  studentId?: string | null;
  schoolId?: string | null;
  schoolCode?: string | null;
  subscriptionPlan?: string | null;
  subscriptionStatus?: string | null;
  subscriptionExpiresAt?: string | null;
  lifecycleStatus?: TenantSubscriptionStatus;
  maxTeachers?: number;
  maxStudents?: number;
  maxClasses?: number;
  mustChangePassword?: boolean;
  classId?: string | null;
  classIds?: string[];
  assignedClassIds?: string[];
  classNames?: string[];
  subjectId?: string | null;
  subjectName?: string | null;
  jenisKelamin?: 'L' | 'P';
  gender?: 'L' | 'P';
  impersonatedFrom?: UserAccount | null;
}

export interface UserAccountInput {
  name: string;
  email?: string | null;
  username: string;
  password: string;
  role: UserRole;
  studentId?: string | null;
  classId?: string | null;
  classIds?: string[];
  subjectId?: string | null;
  subjectName?: string | null;
}

export interface SchoolProfile {
  namaSekolah: string;
  jenjang?: string; // SD, SMP, SMA, SMK, PAUD/TK, SLB, dll
  npsn: string;
  kodeSekolah?: string; // Kode Undangan Bergabung Sekolah (e.g. 20104501 atau CIDENG07)
  // Alamat Dipecah
  alamat?: string; // Alamat gabungan (formatted string untuk kop & cetak)
  jalan?: string;
  desaKelurahan?: string;
  kecamatan?: string;
  kabupatenKota?: string;
  provinsi?: string;
  kodePos?: string;
  // Kontak & Media Komunikasi Dipecah
  teleponFax?: string;
  email?: string;
  website?: string;
  // Pimpinan & Referensi Akademik
  namaKepalaSekolah: string;
  nipKepalaSekolah: string;
  tahunPelajaran?: string;
  semester?: string;
  kelas?: string;
  namaWaliKelas?: string;
  nipWaliKelas?: string;
  // Titik Koordinat GPS Sekolah untuk Geofencing Anti-Titip Absen
  latitude?: number;
  longitude?: number;
}

export interface AcademicEvent {
  id: string;
  date: string; // e.g. "2026-08-17"
  dateDisplay: string; // e.g. "17 Aug 26"
  title: string;
  isEffective: boolean; // if false, reduces effective study days
  notes?: string;
}

export interface SystemConfig {
  appTitle: string;
  appSubtitle: string;
  footerCopyright: string;
  schoolLogoUrl?: string;
  // Pengaturan Kop Surat Resmi Laporan
  letterheadType?: 'custom_image' | 'standard_text'; // Tipe Kop: Gambar Hasil Upload atau Kop Teks Standar
  letterheadImageUrl?: string; // Gambar Kop Surat yang diupload (Banner Kop Resmi)
  showLetterhead?: boolean; // Tampilkan Kop Surat pada hasil cetakan
  defaultCheckInTime: string;
  defaultCheckOutTime: string;
  reportPlace: string;
  reportDate: string; // e.g. "2026-06-27"
  activeStudyDays?: number[]; // [1, 2, 3, 4, 5] where 1=Senin ... 6=Sabtu, 0=Minggu
  // Pengaturan Presensi Real-Time Siswa
  studentSelfAttendanceEnabled: boolean; // Izinkan presensi mandiri siswa lewat HP
  checkInStartTime: string; // Jam buka presensi masuk (misal "06:00")
  checkInDeadlineTime: string; // Batas jam masuk tepat waktu (misal "07:00")
  checkOutStartTime: string; // Jam buka presensi pulang (misal "12:30")
  autoMarkLate: boolean; // Tandai otomatis (Terlambat) jika lewat batas jam masuk
  // Pengaturan Anti-Titip Absen & Geofencing GPS
  geofenceEnabled?: boolean; // Aktifkan validasi radius lokasi GPS
  radiusMeters?: number; // Radius toleransi presensi di area sekolah (default 200m)
}

// ---------- Super Admin Pro: Role & Izin, Monitoring, Pengaturan Global, Audit ----------
export type AdminLevel = 'owner' | 'manager' | 'support';

export interface Permission {
  code: string;
  category: string;
  label: string;
  description: string;
}

export interface AppRole {
  id: string;
  key: string;
  label: string;
  description: string;
  is_system: boolean;
}

export interface RolePermission {
  role_key: string;
  permission_code: string;
  granted: boolean;
}

export interface AuditLogEntry {
  id: number;
  actor_id: string | null;
  actor_name: string;
  actor_role: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  school_id: string | null;
  changes: any;
  created_at: string;
}

export interface ActiveSession {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  school_id: string | null;
  school_name: string | null;
  last_seen_at: string;
}

export interface PlatformSettings {
  id: number;
  theme: { primaryColor: string; brandName: string; logoUrl: string };
  integrations: { whatsappEnabled: boolean; emailNotifEnabled: boolean; webhookUrl: string };
  security: { mfaRequiredForSuperAdmin: boolean; sessionTimeoutMinutes: number; passwordMinLength: number };
  backup: { lastExportAt: string | null; lastExportBy: string | null };
  updated_at: string;
}

export interface SuperAdminStaff {
  id: string;
  name: string;
  username: string;
  admin_level: AdminLevel;
  last_seen_at: string | null;
  created_at: string;
}

export interface GeneratedAccountResult {
  id?: string;
  name: string;
  username: string;
  password?: string;
  role: UserRole;
  category: 'GURU' | 'SISWA' | 'KEPALA SEKOLAH' | 'ADMIN';
  className?: string;
  status: 'CREATED' | 'UPDATED' | 'SKIPPED';
  error?: string;
}

export type ActiveView =
  | 'dashboard'
  | 'login'
  | 'data-referensi'
  | 'data-pengguna'
  | 'kalender-akademik'
  | 'absensi'
  | 'rekapitulasi'
  | 'laporan'
  | 'pengaturan'
  | 'portal-siswa'
  | 'superadmin';

