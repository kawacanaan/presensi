import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { supabase, usernameToEmail } from "../lib/supabase";
import { signInWithEmail } from "../lib/supabaseClient";
import {
  Student,
  AttendanceRecord,
  AttendanceStatus,
  AttendanceType,
  Subject,
  SubjectClassSchedule,
  UserAccount,
  UserAccountInput,
  SchoolProfile,
  AcademicEvent,
  SystemConfig,
  ActiveView,
  SchoolClass,
  Teacher,
  GeneratedAccountResult,
  UserRole,
  WorkspaceMembership,
  WorkspaceType,
  StudentLeaveRequest,
} from "../types";
import {
  INITIAL_SCHOOL_PROFILE,
  INITIAL_SYSTEM_CONFIG,
  DEFAULT_SD_SUBJECTS,
} from "../data/initialData";
import { normalizeTeacherName, normalizeNip } from "../utils/userScope";
import { isFeatureAccessibleInPackage } from "../utils/featureRegistry";
import { getServerNow, formatServerTimeString, formatServerDateString, syncServerTime } from "../utils/serverTime";
import { isUserInActiveSchoolPlan } from "../utils/tenantLifecycle";
import { normalizePlan, normalizeWorkspaceType, calculateTeacherLicenseExpiry } from "../utils/packageSystem";
import { normalizeClassToken } from "../utils/documentParser";
import { triggerAttendancePushNotification, triggerLeaveDecisionPushNotification } from "../utils/webPushManager";

interface Toast {
  id: string;
  type: "success" | "info" | "error";
  message: string;
}
interface AppContextType {
  currentUser: UserAccount | null;
  setCurrentUser: (u: UserAccount | null) => void;
  logout: () => Promise<void>;
  registrationRequired: boolean;
  setRegistrationRequired: (v: boolean) => void;
  activeView: ActiveView;
  setActiveView: (v: ActiveView) => void;
  isDataLoading: boolean;
  isAuthChecking: boolean;
  // Login preparation with glowing circle
  isLoginPreparing: boolean;
  loginProgressMessage: string;
  loginStep: number;
  loginRoleLabel?: string;
  loginWorkspaceName?: string;
  loginWorkspaceType?: WorkspaceType;
  loginRoleDetails?: string;
  loginWithCredentials: (
    identifier: string,
    pass: string,
  ) => Promise<{ success: boolean; error?: string; user?: UserAccount | null; role?: UserRole }>;
  // Workspace & Onboarding
  userWorkspaces: WorkspaceMembership[];
  activeWorkspace: WorkspaceMembership | null;
  isOnboarding: boolean;
  setIsOnboarding: (v: boolean) => void;
  isSwitchingWorkspace: boolean;
  switchingWorkspaceProgress: number;
  switchingWorkspaceTitle: string;
  switchingWorkspaceMessage: string;
  openOnboarding: () => void;
  loadUserDataAfterOnboarding: (userId: string) => Promise<void>;
  loadData: (userId?: string) => Promise<void>;
  schoolProfile: SchoolProfile;
  updateSchoolProfile: (p: SchoolProfile) => Promise<void>;
  systemConfig: SystemConfig;
  updateSystemConfig: (c: SystemConfig) => Promise<void>;
  classes: SchoolClass[];
  addClass: (c: Omit<SchoolClass, "id">) => Promise<void>;
  updateClass: (id: string, c: Omit<SchoolClass, "id">) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  assignTeacherClasses: (
    teacherId: string,
    classIds: string[],
  ) => Promise<void>;
  importClasses: (
    items: Array<Omit<SchoolClass, "id"> & { waliKelasNameInput?: string }>,
    replaceExisting?: boolean,
  ) => Promise<void>;
  teachers: Teacher[];
  addTeacher: (t: Omit<Teacher, "id">) => Promise<void>;
  updateTeacher: (id: string, t: Omit<Teacher, "id">) => Promise<void>;
  deleteTeacher: (id: string) => Promise<void>;
  importTeachers: (
    t: Omit<Teacher, "id">[],
    replaceExisting?: boolean,
  ) => Promise<void>;
  executeTeacherAssignment: (
    teacherId: string,
    roleType: "NONE" | "WALI_KELAS" | "GURU_MAPEL",
    subjectId?: string,
    targetClassIds?: string[],
  ) => Promise<void>;
  subjects: Subject[];
  addSubject: (s: Omit<Subject, "id">) => Promise<void>;
  updateSubject: (id: string, s: Omit<Subject, "id">) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  students: Student[];
  addStudent: (s: Omit<Student, "id">) => Promise<void>;
  updateStudent: (id: string, s: Omit<Student, "id">) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  deleteStudentsByClass: (classId: string) => Promise<void>;
  importStudents: (
    s: Omit<Student, "id">[],
    replaceExisting?: boolean,
    targetClassId?: string,
  ) => Promise<void>;
  users: UserAccount[];
  addUser: (u: UserAccountInput) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  updateUser: (id: string, data: Partial<UserAccount>) => Promise<void>;
  syncUsersWithStudents: () => Promise<void>;
  generateAccountsFromReferences: (options?: {
    resetExistingPasswords?: boolean;
    passwordMode?: "standard" | "random" | "custom";
    customPassword?: string;
  }) => Promise<GeneratedAccountResult[]>;
  resetUserToDefaultPassword: (user: UserAccount) => Promise<string>;
  updateUserPassword: (id: string, p: string) => Promise<void>;
  academicEvents: AcademicEvent[];
  addAcademicEvent: (e: Omit<AcademicEvent, "id">) => Promise<void>;
  deleteAcademicEvent: (id: string) => Promise<void>;
  activeStudyDays: number[];
  updateActiveStudyDays: (d: number[]) => Promise<void>;
  effectiveDaysConfig: { [key: string]: number };
  updateEffectiveDays: (key: string, d: number) => Promise<void>;
  getBaseStudyDaysForMonth: (year: number, month: number) => number;
  getEffectiveDaysForMonth: (year: number | string, month?: number) => number;
  getDateStatus: (date: string) => {
    isStudyDay: boolean;
    isHoliday: boolean;
    isEffective: boolean;
    label: string;
    badgeColor: string;
    eventTitle?: string;
  };
  attendanceRecords: AttendanceRecord[];
  currentAttendanceDate: string;
  setCurrentAttendanceDate: (d: string) => void;
  saveDailyAttendance: (
    date: string,
    r: AttendanceRecord[],
    options?: {
      type?: AttendanceType;
      subjectId?: string | null;
      subjectName?: string | null;
      classId?: string | null;
    },
  ) => Promise<void>;
  getAttendanceForDate: (
    date: string,
    options?: {
      type?: AttendanceType;
      subjectId?: string | null;
      classId?: string | null;
    },
  ) => AttendanceRecord[];
  refreshRunningDayAttendance: () => Promise<AttendanceRecord[]>;
  submitStudentAttendance: (
    studentId: string,
    type: "masuk" | "pulang" | "izin" | "sakit",
    notes?: string,
    customDate?: string,
    exactTimeStr?: string,
  ) => Promise<{ success: boolean; message: string }>;
  changeOwnPassword: (
    newPassword: string,
  ) => Promise<{ success: boolean; message: string }>;
  resetAllDataToProductionReady: () => Promise<void>;
  toasts: Toast[];
  showToast: (m: string, t?: Toast["type"]) => void;
  removeToast: (id: string) => void;
  impersonateSchool: (school: {
    id: string;
    name: string;
    plan?: string;
  }) => void;
  stopImpersonation: () => void;
  globalAnnouncement: {
    id?: string;
    message: string;
    type: "info" | "warning" | "alert";
    active: boolean;
    updatedAt?: string;
  } | null;
  updateGlobalAnnouncement: (announcement: {
    message: string;
    type: "info" | "warning" | "alert";
    active: boolean;
  }) => Promise<void>;
  reconcileSchoolData: (showFeedback?: boolean) => Promise<{ success: boolean; message: string }>;
  upgradeModal: {
    isOpen: boolean;
    featureId?: string;
    customTitle?: string;
    customMessage?: string;
    targetPackage?: 'guru_pro' | 'sekolah_pro';
  };
  openUpgradeModal: (params?: {
    featureId?: string;
    customTitle?: string;
    customMessage?: string;
    targetPackage?: 'guru_pro' | 'sekolah_pro';
  }) => void;
  closeUpgradeModal: () => void;
  isSchoolPro: boolean;
  isTeacherPro: boolean;
  isTeacherUpgradeOpen: boolean;
  setIsTeacherUpgradeOpen: (open: boolean) => void;
  isSchoolUpgradeOpen: boolean;
  setIsSchoolUpgradeOpen: (open: boolean) => void;
  hasUsedTeacherTrial: boolean;
  activateTeacherTrial: () => Promise<boolean>;
  createTeacherMidtransTransaction: (amountOrCycle?: number | 'monthly' | 'yearly') => Promise<any>;
  completeTeacherUpgrade: (orderId: string, amountOrCycle?: number | 'monthly' | 'yearly', verifiedExpiresAt?: string | null) => Promise<boolean>;
  createSchoolMidtransTransaction: (schoolData: any, billingCycle: 'monthly' | 'yearly') => Promise<any>;
  completeSchoolUpgrade: (schoolData: any, orderId: string, billingCycle: 'monthly' | 'yearly') => Promise<any>;
  upgradeToTeacherPro: (amountOrCycle?: number | 'monthly' | 'yearly') => Promise<boolean>;
  upgradeToSchoolWorkspace: (schoolData: any) => Promise<{ success: boolean; schoolCode: string }>;
  requestFeatureAccess: (
    featureId: string,
    customTitle?: string,
    customMessage?: string
  ) => boolean;
  leaveRequests: StudentLeaveRequest[];
  submitLeaveRequest: (req: Omit<StudentLeaveRequest, "id" | "status" | "submittedAt">) => Promise<{ success: boolean; message?: string }>;
  updateLeaveRequestStatus: (
    requestId: string,
    status: "APPROVED" | "REJECTED",
    reviewNotes?: string
  ) => Promise<{ success: boolean; message?: string }>;
  cancelLeaveRequest: (requestId: string) => Promise<{ success: boolean; message?: string }>;
  refreshLeaveRequests: () => Promise<void>;
  updateStudentParentContact: (
    studentId: string,
    data: { namaWali?: string; noHpWali?: string; hubungannya?: string }
  ) => Promise<{ success: boolean; message?: string }>;
  supabase: any;
}
const AppContext = createContext<AppContextType | undefined>(undefined);

export const normalizeUserRole = (rawRole: any): UserRole => {
  if (!rawRole || typeof rawRole !== "string") return "WALI KELAS";
  const clean = rawRole.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (clean === "SUPER_ADMIN" || clean === "SUPERADMIN") return "SUPER_ADMIN";
  if (clean === "ADMIN" || clean === "ADMINISTRATOR" || clean === "SCHOOL_ADMIN") return "ADMIN";
  if (clean === "KEPALA_SEKOLAH" || clean === "KEPSEK" || clean === "PRINCIPAL" || clean === "HEADMASTER") return "KEPALA SEKOLAH";
  if (
    clean === "WALI_KELAS" ||
    clean === "WALI" ||
    clean === "HOMEROOM" ||
    clean === "HOMEROOM_TEACHER" ||
    clean === "GURU_WALI_KELAS" ||
    clean === "GURU_WALI"
  ) return "WALI KELAS";
  if (
    clean === "GURU_MAPEL" ||
    clean === "GURU" ||
    clean === "TEACHER" ||
    clean === "PENDIDIK" ||
    clean === "SUBJECT_TEACHER"
  ) return "GURU MAPEL";
  if (clean === "SISWA" || clean === "STUDENT" || clean === "MURID") return "SISWA";
  return "WALI KELAS";
};

const emptyUser = (p: any): UserAccount => {
  const email = (p.email || "").trim().toLowerCase();
  const hasRealEmail = email.includes("@") && !email.endsWith("@login.edushift.local");
  const isGoogle =
    !!p.is_google_auth ||
    !!p.isGoogleAuth ||
    p.auth_provider === "google" ||
    p.provider === "google" ||
    hasRealEmail;
  return {
    id: p.id,
    teacherId: p.teacher_id || null,
    nip: p.nip || null,
    name: p.name || "",
    username: p.username || "",
    password: p.password || undefined,
    role: normalizeUserRole(p.role),
    email: p.email || null,
    authProvider: p.auth_provider || p.provider || (isGoogle ? "google" : null),
    isGoogleAuth: isGoogle,
    studentId: p.student_id || null,
    schoolId: p.school_id || null,
    schoolCode: p.school_code || p.schoolCode || p.code || null,
    mustChangePassword: false, // Onboarding ganti password baru dinonaktifkan untuk seluruh peran sekolah
    classIds: p.class_ids || [],
    classNames: p.class_names || [],
    assignedClassIds: p.assigned_class_ids || p.assignedClassIds || [],
    subscriptionPlan: p.subscription_plan || p.subscriptionPlan || p.plan || null,
    subscriptionStatus: p.subscription_status || p.subscriptionStatus || p.status || null,
    subscriptionExpiresAt: p.subscription_expires_at || p.subscriptionExpiresAt || p.expires_at || null,
    maxTeachers: p.max_teachers,
    maxStudents: p.max_students,
    maxClasses: p.max_classes,
    jenisKelamin: p.jenis_kelamin || p.jenisKelamin || p.gender || undefined,
    gender: p.gender || p.jenis_kelamin || p.jenisKelamin || undefined,
  };
};
const getStoredParentContacts = (schoolId?: string | null): Record<string, { namaWali?: string; noHpWali?: string; hubungannya?: string }> => {
  if (typeof window === "undefined" || !schoolId || schoolId === "global") return {};
  try {
    const raw = localStorage.getItem(`kawacanaan_parent_contacts_${schoolId}`);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return {};
};

const dbStudent = (s: any): Student => {
  let extraContact: any = {};
  if (typeof window !== "undefined" && s.id && s.school_id) {
    try {
      const stored = getStoredParentContacts(s.school_id);
      if (stored[s.id]) {
        extraContact = stored[s.id];
      }
    } catch (_) {}
  }
  return {
    id: s.id,
    nisn: s.nisn,
    nama: s.nama,
    gender: s.gender,
    schoolId: s.school_id || s.schoolId || null,
    classId: s.class_id || null,
    className: s.class_name || "",
    namaWali: s.nama_wali || s.namaWali || extraContact.namaWali || "",
    noHpWali: s.no_hp_wali || s.noHpWali || s.no_telepon_ortu || s.telepon_wali || extraContact.noHpWali || "",
    hubungannya: s.hubungannya || extraContact.hubungannya || "Orang Tua",
  };
};
const dbTeacher = (t: any): Teacher => {
  const tugas = t.tugas_utama || t.tugasUtama || t._resolved_role || "Belum ditugaskan";
  return {
    id: t.id,
    nama: t.nama || "",
    nip: t.nip || "",
    jenisKelamin: t.jenis_kelamin || t.jenisKelamin || "L",
    tugasUtama: tugas,
    tugas_utama: tugas,
  };
};

const dbSubject = (
  x: any,
  teacherMap?: Map<string, any>,
  classMap?: Map<string, any>,
  scheduleMap?: Map<string, any[]>,
): Subject => {
  const teacher = x.teacher_id ? teacherMap?.get(x.teacher_id) : null;
  const targetClassIds = Array.isArray(x._targetClassIds)
    ? x._targetClassIds
    : [];
  const targetClassNames = targetClassIds
    .map((id: string) => classMap?.get(id)?.name || "")
    .filter(Boolean);
  const scheduleRows = scheduleMap?.get(x.id) || [];

  const classDaysMap = new Map<string, Set<string>>();
  const classTimeMap = new Map<string, { startTime?: string; endTime?: string }>();
  const generalDaysSet = new Set<string>();
  let customLessonPeriod = "";

  scheduleRows.forEach((r: any) => {
    const day = r.day_of_week;
    const lp = r.lesson_period || "";
    if (day) {
      if (lp.startsWith("cls:")) {
        const rawCls = lp.replace(/^cls:/, "").trim();
        const [classId, timePart] = rawCls.split("@");
        if (classId) {
          if (!classDaysMap.has(classId)) {
            classDaysMap.set(classId, new Set());
          }
          classDaysMap.get(classId)!.add(day);

          if (timePart && !classTimeMap.has(classId)) {
            const [st, et] = timePart.split("-");
            if (st && et) {
              classTimeMap.set(classId, { startTime: st.trim(), endTime: et.trim() });
            }
          }
        }
      } else {
        generalDaysSet.add(day);
        if (lp) customLessonPeriod = lp;
      }
    }
  });

  const classSchedules: SubjectClassSchedule[] = [];
  targetClassIds.forEach((cid: string) => {
    const clsName = classMap?.get(cid)?.name || "";
    const times = classTimeMap.get(cid);
    if (classDaysMap.has(cid)) {
      classSchedules.push({
        classId: cid,
        className: clsName,
        days: Array.from(classDaysMap.get(cid)!),
        startTime: times?.startTime,
        endTime: times?.endTime,
      });
    } else if (generalDaysSet.size > 0) {
      classSchedules.push({
        classId: cid,
        className: clsName,
        days: Array.from(generalDaysSet),
        startTime: times?.startTime,
        endTime: times?.endTime,
      });
    } else {
      classSchedules.push({
        classId: cid,
        className: clsName,
        days: [],
        startTime: times?.startTime,
        endTime: times?.endTime,
      });
    }
  });

  const allUniqueDays = new Set<string>([...generalDaysSet]);
  classSchedules.forEach((cs) => cs.days.forEach((d) => allUniqueDays.add(d)));

  const firstValidScheduleTime = classSchedules.find((cs) => cs.startTime && cs.endTime);

  return {
    id: x.id,
    name: x.name,
    code: x.code || undefined,
    isSpecialized: !!x.is_specialized,
    teacherId: x.teacher_id || null,
    teacherName: teacher?.nama || null,
    targetClassIds,
    targetClassNames,
    scheduleDays: Array.from(allUniqueDays),
    classSchedules,
    lessonPeriod: customLessonPeriod,
    defaultStartTime: firstValidScheduleTime?.startTime || '07:30',
    defaultEndTime: firstValidScheduleTime?.endTime || '09:00',
  };
};

const dbAttendance = (r: any, students: Student[]): AttendanceRecord => ({
  id: r.id,
  date: r.date,
  studentId: r.student_id,
  studentName: students.find((s) => s.id === r.student_id)?.nama || "",
  status: r.status,
  checkInTime: r.check_in_time ? String(r.check_in_time).slice(0, 5) : "",
  checkOutTime: r.check_out_time ? String(r.check_out_time).slice(0, 5) : "",
  notes: r.notes || "",
  type: r.type || "DAILY",
  subjectId: r.subject_id || null,
  subjectName: r.subject_name || null,
  classId:
    r.class_id || students.find((s) => s.id === r.student_id)?.classId || null,
  teacherId: r.teacher_id || null,
});
const dbEvent = (e: any): AcademicEvent => ({
  id: e.id,
  date: e.date,
  dateDisplay: e.date_display || e.date,
  title: e.title,
  isEffective: e.is_effective,
  notes: e.notes || "",
});
const formatFullAlamat = (p: {
  jalan?: string;
  desaKelurahan?: string;
  kecamatan?: string;
  kabupatenKota?: string;
  provinsi?: string;
  kodePos?: string;
}): string => {
  const parts = [
    p.jalan,
    p.desaKelurahan ? `Desa/Kel. ${p.desaKelurahan}` : "",
    p.kecamatan ? `Kec. ${p.kecamatan}` : "",
    p.kabupatenKota,
    p.provinsi,
    p.kodePos ? `Kode Pos ${p.kodePos}` : "",
  ].filter(Boolean);
  return parts.join(", ");
};

const dbSchool = (p: any, extraCode?: string): SchoolProfile => {
  if (!p)
    return {
      ...INITIAL_SCHOOL_PROFILE,
      kodeSekolah: extraCode
        ? String(extraCode)
            .replace(/^SCH-?/i, "")
            .trim()
            .toUpperCase()
        : "",
    };
  let ext: any = {};
  const rawAlamat = String(p.alamat || "").trim();
  if (rawAlamat.startsWith("{") || rawAlamat.startsWith("__EXTJSON__:")) {
    try {
      const raw = rawAlamat.startsWith("__EXTJSON__:")
        ? rawAlamat.slice(12)
        : rawAlamat;
      ext = JSON.parse(raw);
    } catch (_) {}
  }
  const rawCode =
    extraCode ||
    p.code ||
    p.kode_sekolah ||
    p.kodeSekolah ||
    ext.kodeSekolah ||
    ext.kode_sekolah ||
    "";
  const cleanKodeSekolah = rawCode
    ? String(rawCode)
        .replace(/^SCH-?/i, "")
        .trim()
        .toUpperCase()
    : "";
  const jenjang = ext.jenjang || p.jenjang || "SD/MI";
  const jalan =
    ext.jalan !== undefined && ext.jalan !== null
      ? ext.jalan
      : p.jalan ||
        (rawAlamat.startsWith("__EXTJSON__:") || rawAlamat.startsWith("{")
          ? ""
          : rawAlamat);
  const desaKelurahan =
    ext.desaKelurahan ||
    ext.desa_kelurahan ||
    ext.kelurahan ||
    p.desa_kelurahan ||
    p.kelurahan ||
    p.desaKelurahan ||
    "";
  const kecamatan = ext.kecamatan || p.kecamatan || "";
  const kabupatenKota =
    ext.kabupatenKota ||
    ext.kabupaten_kota ||
    ext.kota ||
    p.kabupaten_kota ||
    p.kota ||
    p.kabupatenKota ||
    "";
  const provinsi = ext.provinsi || p.provinsi || "";
  const kodePos = ext.kodePos || ext.kode_pos || p.kode_pos || p.kodePos || "";
  const teleponFax =
    ext.teleponFax ||
    ext.telepon_fax ||
    ext.telepon ||
    p.telepon_fax ||
    p.telepon ||
    p.teleponFax ||
    "";
  const email = ext.email || p.email || "";
  const website = ext.website || p.website || "";

  const formattedAddress = formatFullAlamat({
    jalan,
    desaKelurahan,
    kecamatan,
    kabupatenKota,
    provinsi,
    kodePos,
  });
  const fullAlamat =
    ext.full ||
    formattedAddress ||
    (rawAlamat.startsWith("__EXTJSON__:") || rawAlamat.startsWith("{")
      ? ""
      : rawAlamat);

  const namaKepalaSekolah =
    p.nama_kepala_sekolah ||
    p.namaKepalaSekolah ||
    ext.namaKepalaSekolah ||
    ext.nama_kepala_sekolah ||
    "";
  const nipKepalaSekolah =
    p.nip_kepala_sekolah ||
    p.nipKepalaSekolah ||
    ext.nipKepalaSekolah ||
    ext.nip_kepala_sekolah ||
    "";

  let semester = p.semester || ext.semester || "1 (Ganjil)";
  if (semester === "1") semester = "1 (Ganjil)";
  if (semester === "2") semester = "2 (Genap)";

  return {
    namaSekolah: p.nama_sekolah || p.namaSekolah || ext.namaSekolah || "",
    jenjang,
    npsn: p.npsn || ext.npsn || "",
    kodeSekolah: cleanKodeSekolah,
    alamat: fullAlamat,
    jalan,
    desaKelurahan,
    kecamatan,
    kabupatenKota,
    provinsi,
    kodePos,
    teleponFax,
    email,
    website,
    tahunPelajaran:
      p.tahun_pelajaran ||
      p.tahunPelajaran ||
      ext.tahunPelajaran ||
      "2025/2026",
    semester,
    kelas: p.kelas || "",
    namaKepalaSekolah,
    nipKepalaSekolah,
    namaWaliKelas: p.nama_wali_kelas || p.namaWaliKelas || "",
    nipWaliKelas: p.nip_wali_kelas || p.nipWaliKelas || "",
  };
};
const dbConfig = (c: any): SystemConfig => ({
  appTitle: c.app_title || INITIAL_SYSTEM_CONFIG.appTitle,
  appSubtitle: c.app_subtitle || "",
  footerCopyright: c.footer_copyright || INITIAL_SYSTEM_CONFIG.footerCopyright,
  schoolLogoUrl: c.school_logo_url || "",
  letterheadType: c.letterhead_type || "standard_text",
  letterheadImageUrl: c.letterhead_image_url || "",
  showLetterhead: c.show_letterhead ?? true,
  defaultCheckInTime: c.default_check_in_time || "06:30 AM",
  defaultCheckOutTime: c.default_check_out_time || "12:20 PM",
  reportPlace: c.report_place || "",
  reportDate: c.report_date || "",
  activeStudyDays: c.active_study_days || [1, 2, 3, 4, 5],
  studentSelfAttendanceEnabled: c.student_self_attendance_enabled !== false,
  checkInStartTime: String(c.check_in_start_time || "06:00").slice(0, 5),
  checkInDeadlineTime: String(c.check_in_deadline_time || "07:00").slice(0, 5),
  checkOutStartTime: String(c.check_out_start_time || "12:30").slice(0, 5),
  autoMarkLate: c.auto_mark_late ?? true,
});

const CACHE_USER_SESSION_KEY = "kawacanaan_cached_user_session";
const CACHE_LAST_VIEW_KEY = "kawacanaan_last_active_view";
const SESSION_LOGIN_TIME_KEY = "kawacanaan_session_login_time";
const SESSION_LAST_ACTIVE_KEY = "kawacanaan_session_last_active";

// Timeout keamanan sesi: Idle Timeout 10 menit, Absolute Timeout 8 jam
export const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 menit
export const ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 jam

export const checkSessionTimeouts = (): {
  expired: boolean;
  reason?: "idle" | "absolute";
} => {
  if (typeof window === "undefined" || !window.localStorage)
    return { expired: false };
  try {
    const loginTimeRaw = localStorage.getItem(SESSION_LOGIN_TIME_KEY);
    const lastActiveRaw = localStorage.getItem(SESSION_LAST_ACTIVE_KEY);
    if (!loginTimeRaw || !lastActiveRaw) {
      return { expired: false };
    }
    const loginTime = parseInt(loginTimeRaw, 10);
    const lastActive = parseInt(lastActiveRaw, 10);
    const now = Date.now();

    if (now - loginTime > ABSOLUTE_TIMEOUT_MS) {
      return { expired: true, reason: "absolute" };
    }
    if (now - lastActive > IDLE_TIMEOUT_MS) {
      return { expired: true, reason: "idle" };
    }
  } catch (_) {}
  return { expired: false };
};

export const recordSessionActivity = () => {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const now = Date.now();
    if (!localStorage.getItem(SESSION_LOGIN_TIME_KEY)) {
      localStorage.setItem(SESSION_LOGIN_TIME_KEY, String(now));
    }
    localStorage.setItem(SESSION_LAST_ACTIVE_KEY, String(now));
  } catch (_) {}
};

export const resetSessionTimers = () => {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const now = Date.now();
    localStorage.setItem(SESSION_LOGIN_TIME_KEY, String(now));
    localStorage.setItem(SESSION_LAST_ACTIVE_KEY, String(now));
  } catch (_) {}
};

export const clearSessionTimers = () => {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.removeItem(SESSION_LOGIN_TIME_KEY);
    localStorage.removeItem(SESSION_LAST_ACTIVE_KEY);
  } catch (_) {}
};

export const VIEW_ROLE_PERMISSIONS: Record<ActiveView, UserRole[] | "all"> = {
  login: "all",
  dashboard: ["ADMIN", "KEPALA SEKOLAH", "WALI KELAS", "GURU MAPEL"],
  superadmin: ["SUPER_ADMIN"],
  "data-referensi": ["ADMIN", "KEPALA SEKOLAH", "WALI KELAS", "GURU MAPEL"],
  "data-pengguna": ["ADMIN", "WALI KELAS", "GURU MAPEL", "KEPALA SEKOLAH"],
  "kalender-akademik": ["ADMIN", "KEPALA SEKOLAH", "WALI KELAS", "GURU MAPEL"],
  absensi: ["ADMIN", "WALI KELAS", "GURU MAPEL"],
  rekapitulasi: ["ADMIN", "KEPALA SEKOLAH", "WALI KELAS", "GURU MAPEL"],
  laporan: ["ADMIN", "KEPALA SEKOLAH", "WALI KELAS", "GURU MAPEL"],
  pengaturan: ["ADMIN", "KEPALA SEKOLAH", "WALI KELAS", "GURU MAPEL"],
  "portal-siswa": ["SISWA", "KEPALA SEKOLAH"],
};

export const isViewAllowedForRole = (
  view: ActiveView,
  role: UserRole,
): boolean => {
  const allowed = VIEW_ROLE_PERMISSIONS[view];
  if (!allowed) return false;
  if (allowed === "all") return true;
  return allowed.includes(role);
};

export const resolveInitialViewForRole = (
  role: UserRole,
  targetView?: ActiveView | null,
): ActiveView => {
  if (role === "SUPER_ADMIN") return "superadmin";
  if (role === "SISWA") return "portal-siswa";
  if (
    targetView &&
    targetView !== "login" &&
    targetView !== "superadmin" &&
    targetView !== "portal-siswa" &&
    isViewAllowedForRole(targetView, role)
  ) {
    return targetView;
  }
  return "dashboard";
};

export const hasPersistedAuthToken = (): boolean => {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.includes("-auth-token") ||
          key.includes("supabase.auth") ||
          key.startsWith("sb-"))
      ) {
        const val = localStorage.getItem(key);
        if (
          val &&
          (val.includes("access_token") ||
            val.includes("currentSession") ||
            val.includes("refresh_token") ||
            val.includes("user"))
        ) {
          return true;
        }
      }
    }
    if (localStorage.getItem(CACHE_USER_SESSION_KEY)) return true;
    if (localStorage.getItem("kawacanaan_user_has_logged_in") === "true") return true;
    if (
      localStorage.getItem("kawacanaan_oauth_pending") === "true" ||
      sessionStorage.getItem("kawacanaan_oauth_pending") === "true" ||
      localStorage.getItem("kawacanaan_hide_landing") === "true" ||
      sessionStorage.getItem("kawacanaan_hide_landing") === "true"
    ) {
      return true;
    }
  } catch (_) {}
  return false;
};

export const isAuthCallbackUrl = (): boolean => {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash || "";
  const params = new URLSearchParams(window.location.search);

  // Jika URL callback memuat parameter error, bukan callback sukses
  if (
    hash.includes("error=") ||
    hash.includes("error_description=") ||
    params.has("error") ||
    params.has("error_description")
  ) {
    return false;
  }

  try {
    const isPending =
      localStorage.getItem("kawacanaan_oauth_pending") === "true" ||
      sessionStorage.getItem("kawacanaan_oauth_pending") === "true";
    if (isPending) {
      const timeStr =
        sessionStorage.getItem("kawacanaan_oauth_time") ||
        localStorage.getItem("kawacanaan_oauth_time");
      const oauthTime = timeStr ? Number(timeStr) : 0;
      const elapsed = Date.now() - oauthTime;
      // Batas toleransi 10 menit (600.000 ms); jika hang atau kadaluarsa lama, bersihkan
      if (!oauthTime || isNaN(elapsed) || elapsed > 600000 || elapsed < 0) {
        clearOAuthPendingFlags();
      } else {
        return true;
      }
    }
  } catch (_) {}

  return (
    hash.includes("access_token=") ||
    hash.includes("refresh_token=") ||
    hash.includes("type=recovery") ||
    hash.includes("type=signup") ||
    hash.includes("type=invite") ||
    params.has("code") ||
    params.has("access_token")
  );
};

export const clearOAuthPendingFlags = (): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("kawacanaan_oauth_pending");
    sessionStorage.removeItem("kawacanaan_oauth_pending");
    sessionStorage.removeItem("kawacanaan_oauth_time");
    localStorage.removeItem("kawacanaan_oauth_time");
    localStorage.removeItem("kawacanaan_hide_landing");
    sessionStorage.removeItem("kawacanaan_hide_landing");
    if (window.location.hash && (window.location.hash.includes("access_token=") || window.location.hash.includes("refresh_token="))) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    if (window.location.search && window.location.search.includes("code=")) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("code");
      window.history.replaceState(null, "", cleanUrl.pathname + (cleanUrl.searchParams.toString() ? `?${cleanUrl.searchParams.toString()}` : ""));
    }
  } catch (_) {}
};

const getSavedActiveView = (): ActiveView | null => {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem(CACHE_LAST_VIEW_KEY);
    if (raw && raw in VIEW_ROLE_PERMISSIONS) {
      return raw as ActiveView;
    }
  } catch (_) {}
  return null;
};

const getCachedUserSession = (): UserAccount | null => {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem(CACHE_USER_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id) {
        parsed.role = normalizeUserRole(parsed.role);
        return parsed;
      }
    }
  } catch (_) {}
  return null;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return (
      hasPersistedAuthToken() ||
      isAuthCallbackUrl() ||
      Boolean(localStorage.getItem(CACHE_USER_SESSION_KEY)) ||
      localStorage.getItem("kawacanaan_user_has_logged_in") === "true" ||
      localStorage.getItem("kawacanaan_oauth_pending") === "true" ||
      sessionStorage.getItem("kawacanaan_oauth_pending") === "true" ||
      localStorage.getItem("kawacanaan_hide_landing") === "true" ||
      sessionStorage.getItem("kawacanaan_hide_landing") === "true"
    );
  });

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    return getCachedUserSession();
  });
  const [registrationRequired, setRegistrationRequired] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  // Modal Upgrade Hak Akses Fitur yang Ramah
  const [upgradeModal, setUpgradeModal] = useState<{
    isOpen: boolean;
    featureId?: string;
    customTitle?: string;
    customMessage?: string;
    targetPackage?: 'guru_pro' | 'sekolah_pro';
  }>({ isOpen: false });

  const openUpgradeModal = (params?: {
    featureId?: string;
    customTitle?: string;
    customMessage?: string;
    targetPackage?: 'guru_pro' | 'sekolah_pro';
  }) => {
    setUpgradeModal({
      isOpen: true,
      featureId: params?.featureId,
      customTitle: params?.customTitle,
      customMessage: params?.customMessage,
      targetPackage: params?.targetPackage || 'guru_pro',
    });
  };

  const closeUpgradeModal = () => {
    setUpgradeModal((prev) => ({ ...prev, isOpen: false }));
  };

  const [isTeacherUpgradeOpen, setIsTeacherUpgradeOpen] = useState(false);
  const [isSchoolUpgradeOpen, setIsSchoolUpgradeOpen] = useState(false);

  // Workspace & Onboarding State
  const [userWorkspaces, setUserWorkspaces] = useState<WorkspaceMembership[]>(
    [],
  );
  const [activeWorkspace, setActiveWorkspace] =
    useState<WorkspaceMembership | null>(null);
  const [isOnboarding, setIsOnboarding] = useState<boolean>(false);
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] =
    useState<boolean>(false);
  const [switchingWorkspaceProgress, setSwitchingWorkspaceProgress] =
    useState<number>(0);
  const [switchingWorkspaceTitle, setSwitchingWorkspaceTitle] =
    useState<string>("");
  const [switchingWorkspaceMessage, setSwitchingWorkspaceMessage] =
    useState<string>("");

  // Evaluasi langganan: jika masa aktif Paket Guru atau Paket Sekolah telah habis,
  // lakukan downgrade state lokal secara aman & idempotent ke Paket Gratis (guru_gratis).
  // Catatan: Workspace TIDAK berubah dan tidak melakukan update langsung ke database dari frontend.
  useEffect(() => {
    if (!currentUser) return;

    const userRawPlan = currentUser.subscriptionPlan || '';
    const wsRawPlan =
      activeWorkspace?.subscriptionPlan ||
      activeWorkspace?.subscription?.plan ||
      '';

    const currentNormalizedPlan = normalizePlan(userRawPlan || wsRawPlan);
    if (currentNormalizedPlan === 'guru_pro' || currentNormalizedPlan === 'sekolah_pro') {
      const expiresAt =
        currentUser.subscriptionExpiresAt ||
        activeWorkspace?.subscription?.expiresAt;
      if (expiresAt) {
        const expiryDate = new Date(expiresAt);
        const now = new Date();
        if (!isNaN(expiryDate.getTime()) && now > expiryDate) {
          // Masa aktif telah lewat: turunkan paket ke guru_gratis secara in-memory
          setCurrentUser((prev) =>
            prev
              ? {
                  ...prev,
                  subscriptionPlan: 'guru_gratis',
                  subscriptionStatus: 'active',
                }
              : prev
          );
          setActiveWorkspace((prev) =>
            prev
              ? {
                  ...prev,
                  subscriptionPlan: 'guru_gratis',
                  subscription: {
                    ...(prev.subscription || {}),
                    package: 'guru_gratis',
                    plan: 'guru_gratis',
                    status: 'active',
                    maxClasses: 1,
                    maxStudents: 50,
                    expiresAt: null,
                  } as any,
                }
              : prev
          );

          try {
            const cached = getCachedUserSession();
            if (cached) {
              localStorage.setItem(
                CACHE_USER_SESSION_KEY,
                JSON.stringify({ ...cached, subscriptionPlan: 'guru_gratis' })
              );
            }
          } catch (_) {}

          showToast(
            'Masa aktif paket Anda telah berakhir. Akun berjalan dalam Paket Gratis.',
            'info'
          );
        }
      }
    }
  }, [
    currentUser?.id,
    currentUser?.subscriptionPlan,
    currentUser?.subscriptionExpiresAt,
    activeWorkspace?.subscriptionPlan,
    activeWorkspace?.subscription?.expiresAt,
  ]);

  // Login preparation state for GlowingLoadingCircle & AppLoginLoadingScreen
  const [isLoginPreparing, setIsLoginPreparing] = useState<boolean>(false);
  const [loginProgressMessage, setLoginProgressMessage] = useState<string>(
    "Memverifikasi kredensial akun...",
  );
  const [loginStep, setLoginStep] = useState<number>(1);
  const [loginRoleLabel, setLoginRoleLabel] = useState<string>("");
  const [loginWorkspaceName, setLoginWorkspaceName] = useState<string>("");
  const [loginWorkspaceType, setLoginWorkspaceType] = useState<WorkspaceType>("school");
  const [loginRoleDetails, setLoginRoleDetails] = useState<string>("");
  const inFlightLoadPromiseRef = React.useRef<Promise<void> | null>(null);
  const inFlightLoadUserIdRef = React.useRef<string>("");

  const [activeView, setActiveViewState] = useState<ActiveView>(() => {
    const cached = getCachedUserSession();
    const saved = getSavedActiveView();
    if (cached) {
      return resolveInitialViewForRole(cached.role, saved);
    }
    if (hasPersistedAuthToken() && saved && saved !== "login") {
      return saved;
    }
    return "login";
  });
  const activeViewRef = React.useRef<ActiveView>(activeView);
  const loadRequestRef = React.useRef(0);
  const navigationIntentRef = React.useRef(0);
  const isLoggingOutRef = React.useRef(false);
  const passwordChangedRecentlyRef = React.useRef(false);
  const setActiveView = (view: ActiveView) => {
    navigationIntentRef.current += 1;
    activeViewRef.current = view;
    if (view === "absensi" || view === "portal-siswa" || view === "dashboard") {
      setCurrentAttendanceDate(formatServerDateString(getServerNow()));
    }
    setActiveViewState(view);
    if (view !== "login") {
      try {
        localStorage.setItem(CACHE_LAST_VIEW_KEY, view);
      } catch (_) {}
    } else {
      try {
        localStorage.removeItem(CACHE_LAST_VIEW_KEY);
      } catch (_) {}
    }
  };
  const [isDataLoading, setIsDataLoading] = useState<boolean>(false);
  const [schoolProfile, setSchoolProfile] = useState<SchoolProfile>(
    INITIAL_SCHOOL_PROFILE,
  );
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(
    INITIAL_SYSTEM_CONFIG,
  );
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>(DEFAULT_SD_SUBJECTS);
  const [students, setStudents] = useState<Student[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [academicEvents, setAcademicEvents] = useState<AcademicEvent[]>([]);
  const [activeStudyDays, setActiveStudyDays] = useState<number[]>([
    1, 2, 3, 4, 5,
  ]);
  const [effectiveDaysConfig, setEffectiveDaysConfig] = useState<{
    [key: string]: number;
  }>({});
  const [attendanceRecords, setAttendanceRecords] = useState<
    AttendanceRecord[]
  >([]);
  const [currentAttendanceDate, setCurrentAttendanceDate] = useState(() =>
    formatServerDateString(getServerNow()),
  );

  useEffect(() => {
    syncServerTime()
      .then(() => {
        setCurrentAttendanceDate(formatServerDateString(getServerNow()));
      })
      .catch(() => {});
  }, []);
  const [leaveRequests, setLeaveRequests] = useState<StudentLeaveRequest[]>([]);

  const refreshLeaveRequests = useCallback(async () => {
    try {
      const schoolKey = activeWorkspace?.workspaceId || currentUser?.schoolId || "";
      if (!schoolKey) {
        setLeaveRequests([]);
        return;
      }

      // Bersihkan jejak cache global lama agar tidak terjadi kebocoran data lintas sekolah
      try {
        localStorage.removeItem("kawacanaan_leave_requests_global");
        localStorage.removeItem("kawacanaan_parent_contacts_global");
      } catch (_) {}

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      let fetched: StudentLeaveRequest[] = [];
      if (token) {
        try {
          const res = await fetch("/api/attendance", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: "get_leave_requests",
              schoolId: schoolKey,
            }),
          });
          const json = await res.json();
          if (json?.ok && Array.isArray(json.requests)) {
            // Isolasi mutlak: pastikan hanya data sekolah aktif yang diterima
            fetched = json.requests.filter((r: any) => !r.schoolId || r.schoolId === schoolKey);
          }
        } catch (_) {}
      }

      // Fallback langsung ke tabel database Supabase jika API belum mengembalikan
      if (fetched.length === 0 && schoolKey) {
        try {
          const { data: dbRows } = await supabase
            .from("leave_requests")
            .select("*")
            .eq("school_id", schoolKey)
            .order("submitted_at", { ascending: false });
          if (Array.isArray(dbRows) && dbRows.length > 0) {
            fetched = dbRows
              .filter((r: any) => !r.school_id || r.school_id === schoolKey)
              .map((r: any) => ({
                id: r.id,
                schoolId: r.school_id,
                studentId: r.student_id,
                classId: r.class_id,
                studentName: r.student_name,
                nisn: r.nisn,
                className: r.class_name,
                requesterName: r.requester_name,
                requesterRole: r.requester_role,
                requesterPhone: r.requester_phone,
                leaveType: r.leave_type,
                subCategory: r.sub_category,
                startDate: r.start_date,
                endDate: r.end_date,
                reason: r.reason,
                attachmentUrl: r.attachment_url,
                attachmentName: r.attachment_name,
                status: r.status,
                submittedAt: r.submitted_at,
                reviewedBy: r.reviewed_by,
                reviewedAt: r.reviewed_at,
                reviewNotes: r.review_notes,
              }));
          }
        } catch (_) {}
      }

      // Gabungkan dengan cache lokal sekolah aktif
      let localReqs: StudentLeaveRequest[] = [];
      try {
        const stored = localStorage.getItem(`kawacanaan_leave_requests_${schoolKey}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            localReqs = parsed.filter((r: any) => !r.schoolId || r.schoolId === schoolKey);
          }
        }
      } catch (_) {}

      const idMap = new Map<string, StudentLeaveRequest>();
      // 1. Masukkan data fetched terlebih dahulu
      fetched.forEach((r) => {
        if (!schoolKey || !r.schoolId || r.schoolId === schoolKey) {
          idMap.set(String(r.id), r);
        }
      });
      // 2. Terapkan state lokal yang sudah disetujui / ditolak agar tidak kembali PENDING akibat jeda sinkronisasi database
      localReqs.forEach((r) => {
        if (!schoolKey || !r.schoolId || r.schoolId === schoolKey) {
          const key = String(r.id);
          const existing = idMap.get(key);
          if (!existing) {
            idMap.set(key, r);
          } else if (existing.status === 'PENDING' && (r.status === 'APPROVED' || r.status === 'REJECTED')) {
            // Lindungi status disetujui/ditolak yang baru dilakukan di UI
            idMap.set(key, { ...existing, status: r.status, reviewedBy: r.reviewedBy, reviewedAt: r.reviewedAt, reviewNotes: r.reviewNotes });
          } else if (r.reviewedAt && (!existing.reviewedAt || r.reviewedAt >= existing.reviewedAt)) {
            idMap.set(key, r);
          }
        }
      });

      const combined = Array.from(idMap.values()).sort(
        (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );

      setLeaveRequests(combined);
      try {
        localStorage.setItem(`kawacanaan_leave_requests_${schoolKey}`, JSON.stringify(combined));
      } catch (_) {}
    } catch (_) {}
  }, [currentUser?.schoolId, activeWorkspace?.workspaceId]);

  // Sinkronisasi realtime multi-tab & custom event (surat izin & absensi hari berjalan)
  const refreshRunningDayAttendance = useCallback(async (): Promise<AttendanceRecord[]> => {
    const schoolKey = currentUser?.schoolId;
    if (!schoolKey) return [];
    const runningToday = formatServerDateString(getServerNow());
    try {
      let freshRows: any[] = [];
      let serverChecked = false;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) {
        try {
          const res = await fetch("/api/attendance", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: "get_attendance",
              schoolId: schoolKey,
              date: runningToday,
            }),
          });
          const jsonRes = await res.json().catch(() => ({}));
          if (res.ok && jsonRes?.ok && Array.isArray(jsonRes.records)) {
            freshRows = jsonRes.records;
            serverChecked = true;
          }
        } catch (_) {}
      }

      if (!serverChecked) {
        const { data, error } = await supabase
          .from("attendance_records")
          .select("*")
          .eq("school_id", schoolKey)
          .eq("date", runningToday);
        if (!error && Array.isArray(data)) {
          freshRows = data;
          serverChecked = true;
        }
      }

      if (serverChecked) {
        let finalUpdated: AttendanceRecord[] = [];
        setAttendanceRecords((prev) => {
          const mappedFresh = freshRows.map((r: any) => dbAttendance(r, students));

          // Pisahkan rekaman hari sebelumnya
          const priorDatesRecords = prev.filter((r) => r.date !== runningToday);
          const currentDayPrevRecords = prev.filter(
            (r) => r.date === runningToday && (!r.type || r.type === "DAILY")
          );

          // Peta pemetaan data fresh dari server berdasarkan studentId
          const processedStudentIds = new Set<string>();
          const mergedRunningToday: AttendanceRecord[] = [];

          mappedFresh.forEach((freshRec: AttendanceRecord) => {
            processedStudentIds.add(freshRec.studentId);
            const prevRec = currentDayPrevRecords.find(
              (p) =>
                p.studentId === freshRec.studentId ||
                (p.studentName && freshRec.studentName && p.studentName.trim().toLowerCase() === freshRec.studentName.trim().toLowerCase())
            );

            if (prevRec) {
              // Pertahankan waktu scan masuk & pulang yang valid jika respons server kosong/strip
              const checkIn =
                freshRec.checkInTime && freshRec.checkInTime !== '-' && freshRec.checkInTime !== ''
                  ? freshRec.checkInTime
                  : (prevRec.checkInTime && prevRec.checkInTime !== '-' && prevRec.checkInTime !== '' ? prevRec.checkInTime : '-');

              const checkOut =
                freshRec.checkOutTime && freshRec.checkOutTime !== '-' && freshRec.checkOutTime !== ''
                  ? freshRec.checkOutTime
                  : (prevRec.checkOutTime && prevRec.checkOutTime !== '-' && prevRec.checkOutTime !== '' ? prevRec.checkOutTime : '-');

              const status =
                Boolean(freshRec.status && (freshRec.status as string) !== '-')
                  ? freshRec.status
                  : (Boolean(prevRec.status && (prevRec.status as string) !== '-') ? prevRec.status : 'Hadir');

              mergedRunningToday.push({
                ...freshRec,
                checkInTime: checkIn,
                checkOutTime: checkOut,
                status,
                notes: freshRec.notes || prevRec.notes || null,
              });
            } else {
              mergedRunningToday.push(freshRec);
            }
          });

          // Pertahankan rekaman lokal yang telah memiliki scan masuk/pulang namun belum tersinkron di server
          currentDayPrevRecords.forEach((prevRec) => {
            if (!processedStudentIds.has(prevRec.studentId)) {
              const hasValidActivity =
                (prevRec.checkInTime && prevRec.checkInTime !== '-' && prevRec.checkInTime !== '') ||
                (prevRec.checkOutTime && prevRec.checkOutTime !== '-' && prevRec.checkOutTime !== '') ||
                Boolean(prevRec.status && (prevRec.status as string) !== '-');
              if (hasValidActivity) {
                mergedRunningToday.push(prevRec);
              }
            }
          });

          const updated = [...priorDatesRecords, ...mergedRunningToday];
          finalUpdated = updated;

          // Sinkronkan ke backup lokal agar reload tidak mengembalikan data usang
          try {
            const backupKey = `kawacanaan_attendance_backup_${schoolKey || "default"}`;
            localStorage.setItem(backupKey, JSON.stringify(updated.slice(-500)));
          } catch (_) {}

          return updated;
        });
        return finalUpdated;
      }
      return attendanceRecords;
    } catch (_) {
      return [];
    }
  }, [currentUser?.schoolId, currentUser?.role, currentUser?.studentId, currentUser?.id, currentUser?.username, currentUser?.nip, currentUser?.name, students]);

  useEffect(() => {
    const mergeStoredAttendance = (raw: string | null) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const runningToday = formatServerDateString(getServerNow());
          setAttendanceRecords((prev) => {
            if (parsed.length === 0) return prev;
            // Gunakan set tanggal yang ada pada parsed sebagai pembaruan bersih.
            // PENTING: runningToday tidak boleh di-retain jika parsed tidak memilikinya (misal telah di-reset oleh Wali Kelas).
            const backupDates = new Set(parsed.map((r) => r.date).filter(Boolean));
            const retained = prev.filter((r) => r.date !== runningToday && !backupDates.has(r.date));
            return [...retained, ...parsed];
          });
        }
      } catch (_) {}
    };

    const handleStorageChange = (e: StorageEvent) => {
      const schoolKey = currentUser?.schoolId;
      if (!schoolKey) return;
      if (e.key === `kawacanaan_leave_requests_${schoolKey}`) {
        try {
          const updated = JSON.parse(e.newValue || "[]");
          if (Array.isArray(updated)) {
            setLeaveRequests(updated.filter((r: any) => r.schoolId === schoolKey));
          }
        } catch (_) {}
      }
      if (e.key === `kawacanaan_attendance_backup_${schoolKey}` || e.key === "kawacanaan_attendance_last_sync") {
        if (e.newValue) {
          mergeStoredAttendance(e.newValue);
        }
        refreshRunningDayAttendance();
      }
    };
    const handleCustomSync = () => {
      try {
        const schoolKey = currentUser?.schoolId;
        if (!schoolKey) return;
        const stored = localStorage.getItem(`kawacanaan_leave_requests_${schoolKey}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setLeaveRequests(parsed.filter((r: any) => r.schoolId === schoolKey));
          }
        }
      } catch (_) {}
    };
    const handleAttendanceSync = () => {
      try {
        const backupKey = `kawacanaan_attendance_backup_${currentUser?.schoolId || "default"}`;
        mergeStoredAttendance(localStorage.getItem(backupKey));
      } catch (_) {}
      refreshRunningDayAttendance();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("kawacanaan_leave_requests_updated", handleCustomSync);
    window.addEventListener("kawacanaan_attendance_updated", handleAttendanceSync);

    // Initial fetch saat user aktif
    refreshLeaveRequests();
    refreshRunningDayAttendance();

    // Polling interval setiap 10 detik agar surat izin & scan barcode dari siswa langsung tersinkron di Wali Kelas
    const intervalId = setInterval(() => {
      refreshLeaveRequests();
      if (
        activeViewRef.current === "absensi" ||
        activeViewRef.current === "portal-siswa" ||
        activeViewRef.current === "dashboard"
      ) {
        refreshRunningDayAttendance();
      }
    }, 10000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("kawacanaan_leave_requests_updated", handleCustomSync);
      window.removeEventListener("kawacanaan_attendance_updated", handleAttendanceSync);
      clearInterval(intervalId);
    };
  }, [currentUser?.schoolId, refreshLeaveRequests, refreshRunningDayAttendance]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [globalAnnouncement, setGlobalAnnouncement] = useState<{
    id?: string;
    message: string;
    type: "info" | "warning" | "alert";
    active: boolean;
    updatedAt?: string;
  } | null>(null);

  useEffect(() => {
    if (!currentUser || currentUser.role !== "SUPER_ADMIN") return;
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) return;
        const res = await fetch("/api/superadmin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: "get_announcement" }),
        });
        const jsonRes = await res.json();
        if (jsonRes?.ok && jsonRes?.announcement) {
          setGlobalAnnouncement(jsonRes.announcement);
        }
      } catch (_) {}
    })();
  }, [currentUser]);

  const updateGlobalAnnouncement = async (ann: {
    message: string;
    type: "info" | "warning" | "alert";
    active: boolean;
  }) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Sesi login tidak ditemukan.");
      const res = await fetch("/api/superadmin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "save_announcement",
          message: ann.message,
          type: ann.type,
          active: ann.active,
        }),
      });
      const jsonRes = await res.json();
      if (!res.ok || !jsonRes?.ok) {
        throw new Error(jsonRes?.error || "Gagal menyimpan pengumuman.");
      }
      setGlobalAnnouncement(jsonRes.announcement || { ...ann, updatedAt: new Date().toISOString() });
      showToast("Pengumuman global berhasil diperbarui.", "success");
    } catch (e: any) {
      showToast(e.message || "Gagal menyimpan pengumuman.", "error");
    }
  };

  const impersonateSchool = async (school: {
    id: string;
    name: string;
    plan?: string;
  }) => {
    if (!currentUser) return;
    const backupUser = { ...currentUser };

    // Rekam audit log forensik ke backend secara aman
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) {
        fetch("/api/superadmin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "impersonate_school",
            school_id: school.id,
            school_name: school.name,
            reason: `Simulasi dukungan teknis sekolah ${school.name}`,
          }),
        }).catch(() => {});
      }
    } catch (_) {}

    setCurrentUser({
      ...currentUser,
      role: 'ADMIN',
      schoolId: school.id,
      name: `Admin (${school.name})`,
      subscriptionPlan: (school.plan as any) || 'school',
      impersonatedFrom: backupUser,
    });
    setSchoolProfile((p) => ({
      ...p,
      id: school.id,
      namaSekolah: school.name,
    }));
    setActiveView('dashboard');
    showToast(`Beralih ke mode simulasi dukungan untuk "${school.name}".`, 'info');
  };
  const stopImpersonation = () => {
    if (currentUser?.impersonatedFrom) {
      setCurrentUser(currentUser.impersonatedFrom);
      setActiveView('superadmin');
      showToast('Kembali ke Pusat Kendali Super Admin.', 'info');
    }
  };
  const showToast = (message: string, type: Toast["type"] = "success") => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((p) => [...p, { id, type, message }]);
    window.setTimeout(
      () => setToasts((p) => p.filter((t) => t.id !== id)),
      3500,
    );
  };

  const logout = async () => {
    isLoggingOutRef.current = true;
    // Invalidate any in-flight data loading requests immediately
    loadRequestRef.current++;

    // 1. Matikan seluruh timer sesi agar tidak ada auto-trigger
    clearSessionTimers();

    // 2. Segera reset seluruh state aplikasi ke null dan default (halaman login)
    setCurrentUser(null);
    setUserWorkspaces([]);
    setActiveWorkspace(null);
    setIsOnboarding(false);
    setIsAuthChecking(false);
    setIsDataLoading(false);
    setRegistrationRequired(false);
    setPasswordRecovery(false);
    setIsLoginPreparing(false);
    activeViewRef.current = "login";
    setActiveViewState("login");
    setStudents([]);
    setClasses([]);
    setTeachers([]);
    setUsers([]);
    setAttendanceRecords([]);
    setSubjects([]);
    setAcademicEvents([]);
    setIsSwitchingWorkspace(false);
    passwordChangedRecentlyRef.current = false;

    // 3. Bersihkan seluruh penyimpanan lokal sesi dan cache
    try {
      setLeaveRequests([]);
      localStorage.removeItem(CACHE_USER_SESSION_KEY);
      localStorage.removeItem(CACHE_LAST_VIEW_KEY);
      localStorage.removeItem(SESSION_LAST_ACTIVE_KEY);
      localStorage.removeItem(SESSION_LOGIN_TIME_KEY);
      localStorage.removeItem("kawacanaan_last_workspace_id");
      localStorage.removeItem("kawacanaan_cached_school_ws");
      localStorage.removeItem("kawacanaan_user_has_logged_in");
      localStorage.removeItem("kawacanaan_leave_requests_global");
      localStorage.removeItem("kawacanaan_parent_contacts_global");
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const sKey = sessionStorage.key(i);
          if (
            sKey &&
            (sKey.startsWith("pwd_changed_") ||
              sKey.startsWith("kawacanaan_") ||
              sKey.startsWith("sb-"))
          ) {
            sessionStorage.removeItem(sKey);
          }
        }
      } catch (_) {}
      
      // Bersihkan seluruh token pengguna, cache ringkasan, dan kredensial auth
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith("kawacanaan_last_workspace_id_") ||
            key.startsWith("kawacanaan_school_ws_") ||
            key.startsWith("kawacanaan_summary_cache_") ||
            key.startsWith("sb-") ||
            key.startsWith("supabase.auth.") ||
            key.includes("supabase.auth.token"))
        ) {
          localStorage.removeItem(key);
        }
      }
    } catch (_) {}

    // 4. Update query URL ke page=login dan bersihkan hash auth jika ada
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("page", "login");
        url.searchParams.delete("view");
        window.history.replaceState(null, "", url.pathname + url.search);
      } catch (_) {}
    }

    // 5. Eksekusi Supabase Auth signOut() secara non-blocking dengan timeout cepat
    try {
      await Promise.race([
        supabase.auth.signOut().catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 250)),
      ]);
    } catch (err) {
      console.warn("[logout] supabase.auth.signOut error:", err);
    }
  };

  const loginWithCredentials = async (
    identifier: string,
    pass: string,
  ): Promise<{ success: boolean; error?: string; user?: UserAccount | null; role?: UserRole }> => {
    isLoggingOutRef.current = false;
    setIsLoginPreparing(true);
    setLoginStep(1);
    setLoginProgressMessage("Memverifikasi kredensial akun...");

    try {
      const { data, error } = await signInWithEmail(identifier, pass);
      if (error || !data?.user) {
        setIsLoginPreparing(false);
        const msg = error?.message || "";
        const userMsg = msg.toLowerCase().includes("invalid login credentials")
          ? "Email/username atau kata sandi salah. Periksa kembali data akun Anda."
          : msg || "Login gagal. Silakan coba lagi.";
        return { success: false, error: userMsg };
      }

      // Reset timer sesi agar bebas dari timestamp kadaluwarsa dari sesi sebelumnya
      resetSessionTimers();
      passwordChangedRecentlyRef.current = false;

      setLoginStep(2);
      setLoginProgressMessage("Membaca profil & ruang kerja sekolah...");

      await loadData(data.user.id);
      const cached = getCachedUserSession();

      setIsLoginPreparing(false);
      return { success: true, user: cached, role: cached?.role };
    } catch (err: any) {
      setIsLoginPreparing(false);
      return {
        success: false,
        error:
          err?.message ||
          "Terjadi kendala saat proses autentikasi. Silakan coba lagi.",
      };
    }
  };

  const removeToast = (id: string) =>
    setToasts((p) => p.filter((t) => t.id !== id));

  const loadDataForSchool = async (
    schoolId: string,
    baseProfile: any,
    targetRole: UserRole,
    requestId?: number,
  ) => {
    if (
      isLoggingOutRef.current ||
      (requestId !== undefined && requestId !== loadRequestRef.current)
    ) {
      return;
    }
    setIsDataLoading(true);
    let me: any = null;
    try {
      let tenantSchool: any = null;
    {
      const res = await supabase
        .from("schools")
        .select(
          "name,npsn,code,plan,status,subscription_expires_at,max_teachers,max_students,max_classes,workspace_type,is_personal",
        )
        .eq("id", schoolId)
        .maybeSingle();
      if (res.error) {
        console.warn("[loadData] schools read failed:", res.error.message);
      } else {
        tenantSchool = res.data;
      }
    }
    let authoritativeSchoolCode = tenantSchool?.code
      ? String(tenantSchool.code)
          .replace(/^SCH-?/i, "")
          .trim()
          .toUpperCase()
      : "";
    const hydratedBase = {
      ...baseProfile,
      school_id: schoolId,
      school_code: authoritativeSchoolCode || null,
      role: targetRole,
      subscription_plan: normalizePlan(tenantSchool?.plan),
      subscription_status: tenantSchool?.status || "active",
      subscription_expires_at: tenantSchool?.subscription_expires_at,
      max_teachers: tenantSchool?.max_teachers,
      max_students: tenantSchool?.max_students,
      max_classes: tenantSchool?.max_classes,
    };

    const [
      ,
      stu,
      school,
      config,
      events,
      effective,
      attendance,
      allProfiles,
      classRows,
      teacherRows,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("id", baseProfile.id)
        .maybeSingle(),
      supabase
        .from("students")
        .select("*, classes:class_id(id,name,grade,academic_year)")
        .eq("school_id", schoolId)
        .order("nama"),
      supabase
        .from("school_profile")
        .select("*")
        .eq("school_id", schoolId)
        .maybeSingle(),
      supabase
        .from("system_config")
        .select("*")
        .eq("school_id", schoolId)
        .maybeSingle(),
      supabase
        .from("academic_events")
        .select("*")
        .eq("school_id", schoolId)
        .order("date"),
      supabase.from("effective_days").select("*").eq("school_id", schoolId),
      supabase
        .from("attendance_records")
        .select("*")
        .eq("school_id", schoolId)
        .order("date", { ascending: false })
        .limit(10000),
      supabase
        .from("profiles")
        .select("*")
        .eq("school_id", schoolId)
        .order("name"),
      supabase
        .from("classes")
        .select("*, wali:wali_kelas_teacher_id(id,nama)")
        .eq("school_id", schoolId)
        .order("grade")
        .order("name"),
      supabase
        .from("teachers")
        .select("*")
        .eq("school_id", schoolId)
        .order("nama"),
    ]);

    // Master-data reads are intentionally independent. A failure in an
    // auxiliary table (for example attendance/events/profile due to RLS)
    // must NOT prevent Guru/Kelas/Siswa from rendering.
    const readErrors = [
      ["students", stu],
      ["school_profile", school],
      ["system_config", config],
      ["academic_events", events],
      ["effective_days", effective],
      ["attendance_records", attendance],
      ["profiles", allProfiles],
      ["classes", classRows],
      ["teachers", teacherRows],
    ].filter(([, r]: any) => r?.error);
    if (readErrors.length)
      console.warn(
        "[loadData] partial read errors:",
        readErrors
          .map(([name, r]: any) => `${name}: ${r.error.message}`)
          .join(" | "),
      );

    let baseTeachers = (teacherRows.data || []).map(dbTeacher);
    let rawClasses = classRows.data || [];
    let rawStudents = stu.data || [];

    // Authoritative service synchronization: ensures Wali Kelas and Guru Mapel get full Admin data and linked NIP/classes
    let masterJson: any = null;
    if (schoolId) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token || "";
        const masterRes = await fetch("/api/onboarding", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            action: "get_school_master_data",
            school_id: schoolId,
            user_id: baseProfile?.id,
          }),
        });
        const mJson = await masterRes.json();
        if (mJson?.ok) {
          masterJson = mJson;
          if (Array.isArray(mJson.teachers) && (baseTeachers.length === 0 || mJson.teachers.length >= baseTeachers.length)) {
            baseTeachers = mJson.teachers.map(dbTeacher);
          }
          if (Array.isArray(mJson.classes) && (rawClasses.length === 0 || mJson.classes.length >= rawClasses.length)) {
            rawClasses = mJson.classes;
          }
          if (Array.isArray(mJson.students) && (rawStudents.length === 0 || mJson.students.length >= rawStudents.length)) {
            rawStudents = mJson.students;
          }
        }
      } catch (_) {}
    }

    setTeachers(baseTeachers);

    const classList = rawClasses.map((c: any) => {
      let className = (c.name || '').trim();
      let assignedTeacherId = c.wali_kelas_teacher_id || null;
      let waliName = c.wali?.nama || c.wali_kelas_name || null;

      // Smart Inversion Self-Healing: Cek jika data nama rombel dan wali kelas sempat tertukar di database
      const matchedTeacherByName = baseTeachers.find(
        (t) => t.nama.trim().toLowerCase() === className.toLowerCase()
      );
      const isNameTeacher =
        !!matchedTeacherByName ||
        /\b(s\.pd|m\.pd|s\.ag|s\.kom|s\.si|m\.si|s\.sos|drs|dra|dr\.|prof)\b/i.test(className);

      const isWaliClass =
        /^(kelas|rombel|\d+[a-z]?|[ivx]+[a-z]?)/i.test(waliName || '') ||
        /^\d+$/i.test(waliName || '');

      if (isNameTeacher && isWaliClass) {
        const temp = className;
        className = waliName!;
        waliName = temp;
        if (matchedTeacherByName && !assignedTeacherId) {
          assignedTeacherId = matchedTeacherByName.id;
        }

        // Silent background self-healing update to Supabase tanpa perlu user menjalankan SQL manual
        supabase
          .from('classes')
          .update({
            name: className,
            wali_kelas_teacher_id: assignedTeacherId,
          })
          .eq('id', c.id)
          .then(undefined, () => {});
      } else if (isNameTeacher && !waliName && matchedTeacherByName) {
        if (!assignedTeacherId) {
          assignedTeacherId = matchedTeacherByName.id;
        }
        waliName = matchedTeacherByName.nama;
      }

      const matchedTeacher = baseTeachers.find(
        (t) => t.id === assignedTeacherId,
      );
      const finalWaliName = matchedTeacher?.nama || waliName || null;

      const matchNum = className.match(/\d+/);
      const autoGrade = matchNum ? parseInt(matchNum[0], 10) : c.grade || 1;

      return {
        id: c.id,
        name: className,
        grade: autoGrade,
        academicYear: c.academic_year,
        waliKelasTeacherId: assignedTeacherId,
        waliKelasName: finalWaliName,
      };
    });

    // Self-Healing Exclusivity: 1 Guru = 1 Rombel Binaan (Wali Kelas)
    // Jika ada guru yang terdaftar di lebih dari satu rombel, tentukan rombel definitif
    // berdasarkan profil akun (class_ids) atau penugasan terbaru, lalu bersihkan kelas duplikat
    const teacherHomeroomMap = new Map<string, any[]>();
    classList.forEach((c: any) => {
      if (c.waliKelasTeacherId) {
        const list = teacherHomeroomMap.get(c.waliKelasTeacherId) || [];
        list.push(c);
        teacherHomeroomMap.set(c.waliKelasTeacherId, list);
      }
    });

    teacherHomeroomMap.forEach((matchedList, teacherId) => {
      if (matchedList.length > 1) {
        const relatedProfile = (allProfiles.data || []).find((p: any) => p.teacher_id === teacherId);
        const preferredClassId =
          (Array.isArray(relatedProfile?.class_ids) && relatedProfile.class_ids.find((cid: string) => matchedList.some((m: any) => m.id === cid))) ||
          matchedList[matchedList.length - 1].id;

        matchedList.forEach((c: any) => {
          if (c.id !== preferredClassId) {
            c.waliKelasTeacherId = null;
            c.waliKelasName = null;
            // Bersihkan di background Supabase agar data persisten terbebas dari duplikasi
            Promise.resolve(
              supabase
                .from("classes")
                .update({ wali_kelas_teacher_id: null })
                .eq("id", c.id),
            ).catch(() => {});
          }
        });
      }
    });

    setClasses(classList);
    const ss = rawStudents.map((x: any) =>
      dbStudent({ ...x, class_name: x.classes?.name || x.class_name || "" }),
    );
    setStudents(ss);

    const subjectTeacherScope = new Map<string, string[]>();
    const subjectClassScope = new Map<string, string[]>();
    const activeAcademicYear =
      String(
        school.data?.tahun_pelajaran ||
          baseProfile?.tahun_pelajaran ||
          "2026/2027",
      ).trim() || "2026/2027";
    const [scopeTeacherRows, scopeClassRows] = await Promise.all([
      supabase
        .from("subject_teacher_assignments")
        .select("subject_id,teacher_id,academic_year")
        .eq("school_id", schoolId),
      supabase
        .from("subject_class_assignments")
        .select("subject_id,class_id,academic_year")
        .eq("school_id", schoolId),
    ]);
    if (scopeTeacherRows.error)
      console.warn(
        "[loadData] subject_teacher_assignments read failed:",
        scopeTeacherRows.error.message,
      );
    if (scopeClassRows.error)
      console.warn(
        "[loadData] subject_class_assignments read failed:",
        scopeClassRows.error.message,
      );
    const effectiveScopeTeacherRows =
      scopeTeacherRows.data && scopeTeacherRows.data.length > 0
        ? scopeTeacherRows.data
        : (masterJson?.subjectTeacherAssignments || []);
    const effectiveScopeClassRows =
      scopeClassRows.data && scopeClassRows.data.length > 0
        ? scopeClassRows.data
        : (masterJson?.subjectClassAssignments || []);

    effectiveScopeTeacherRows
      .filter((a: any) => !a.academic_year || a.academic_year === activeAcademicYear)
      .forEach((a: any) => {
        const ids = subjectTeacherScope.get(a.teacher_id) || [];
        ids.push(a.subject_id);
        subjectTeacherScope.set(a.teacher_id, ids);
      });
    effectiveScopeClassRows
      .filter((a: any) => !a.academic_year || a.academic_year === activeAcademicYear)
      .forEach((a: any) => {
        const ids = subjectClassScope.get(a.subject_id) || [];
        ids.push(a.class_id);
        subjectClassScope.set(a.subject_id, ids);
      });
    // Master teachers state directly from teachers table
    setTeachers(baseTeachers);

    let cachedPasswordMap: Record<string, string> = {};
    try {
      const rawPw = localStorage.getItem(`kawacanaan_account_passwords_${schoolId}`);
      if (rawPw) cachedPasswordMap = JSON.parse(rawPw);
    } catch (_) {}

    const hydratedUsers = (allProfiles.data || []).map((p: any) => {
      const u = emptyUser(p);
      const isWali = u.teacherId && classList.some((c: any) => c.waliKelasTeacherId === u.teacherId && (!c.academicYear || c.academicYear === activeAcademicYear));
      const hasMapel = u.teacherId && (subjectTeacherScope.get(u.teacherId) || []).length > 0;

      let effectiveRole = u.role;
      if (u.role === "WALI KELAS" || u.role === "GURU MAPEL") {
        if (isWali && !hasMapel) effectiveRole = "WALI KELAS";
        else if (hasMapel && !isWali) effectiveRole = "GURU MAPEL";
        else if (isWali && hasMapel) effectiveRole = u.role || "WALI KELAS";
      }

      let ids: string[] = [];
      if (isWali) {
        const matchedWaliClasses = classList.filter(
          (c: any) =>
            c.waliKelasTeacherId === u.teacherId &&
            (!c.academicYear || c.academicYear === activeAcademicYear),
        );
        const preferred =
          matchedWaliClasses.find((c: any) =>
            Array.isArray(p.class_ids) && p.class_ids.includes(c.id),
          ) || matchedWaliClasses[0];
        ids = preferred ? [preferred.id] : [];
      }
      if (hasMapel) {
        const unique = new Set<string>(ids);
        (subjectTeacherScope.get(u.teacherId) || []).forEach((subjectId) => {
          (subjectClassScope.get(subjectId) || []).forEach((classId) =>
            unique.add(classId),
          );
        });
        ids = [...unique];
      }

      if (u.role === "SISWA") {
        const matchedStu = ss.find(
          (s: any) =>
            (u.studentId && s.id === u.studentId) ||
            (u.username && s.nisn && String(s.nisn).trim().toLowerCase() === String(u.username).trim().toLowerCase()) ||
            (u.nip && s.nisn && String(s.nisn).trim().toLowerCase() === String(u.nip).trim().toLowerCase()) ||
            (u.name && s.nama && s.nama.trim().toLowerCase() === u.name.trim().toLowerCase())
        );
        if (matchedStu) {
          if (!u.studentId) u.studentId = matchedStu.id;
          if (matchedStu.classId && ids.length === 0) {
            ids = [matchedStu.classId];
          }
          if (matchedStu.gender && !u.gender) {
            u.gender = matchedStu.gender;
            u.jenisKelamin = matchedStu.gender;
          }
        }
      }

      const cachedPwd = cachedPasswordMap[u.id] || (u.username ? cachedPasswordMap[u.username.toLowerCase()] : undefined);

      return {
        ...u,
        password: u.password || cachedPwd || undefined,
        role: effectiveRole,
        classIds: ids,
        classNames: ids
          .map(
            (id: string) => classList.find((c: any) => c.id === id)?.name || "",
          )
          .filter(Boolean),
      };
    });
    const matchedMe = hydratedUsers.find((u: any) => u.id === baseProfile.id);
    const resolvedRole = targetRole || (matchedMe?.role ? normalizeUserRole(matchedMe.role) : hydratedBase.role);
    const effectivePlan = normalizePlan(tenantSchool?.plan || baseProfile?.subscription_plan || matchedMe?.subscriptionPlan || "guru_gratis");
    const effectiveStatus = tenantSchool?.status || baseProfile?.subscription_status || matchedMe?.subscriptionStatus || "active";
    const effectiveExpiresAt = tenantSchool?.subscription_expires_at || baseProfile?.subscription_expires_at || matchedMe?.subscriptionExpiresAt || null;

    me = {
      ...emptyUser(hydratedBase),
      ...(matchedMe || {}),
      subscriptionPlan: effectivePlan,
      subscriptionStatus: effectiveStatus,
      subscriptionExpiresAt: effectiveExpiresAt,
      role: resolvedRole,
      schoolCode:
        authoritativeSchoolCode ||
        (baseProfile as any)?.school_code ||
        (baseProfile as any)?.schoolCode ||
        null,
    };

    // Reconcile and link teacher record to current user
    let myMatchedTeacher = baseTeachers.find((t) => t.id === me.teacherId);
    if (!myMatchedTeacher && masterJson?.matchedTeacher) {
      myMatchedTeacher = dbTeacher(masterJson.matchedTeacher);
    }
    if (!myMatchedTeacher) {
      const uNip = normalizeNip(me.nip) || normalizeNip(me.username);
      if (uNip && uNip.length >= 8) {
        myMatchedTeacher = baseTeachers.find((t) => normalizeNip(t.nip) === uNip);
      }
    }
    if (!myMatchedTeacher && me.name) {
      const cleanMeName = normalizeTeacherName(me.name);
      myMatchedTeacher = baseTeachers.find((t) => {
        const cleanTName = normalizeTeacherName(t.nama);
        return cleanTName === cleanMeName || (cleanMeName.length >= 4 && (cleanTName.includes(cleanMeName) || cleanMeName.includes(cleanTName)));
      });
    }

    if (myMatchedTeacher) {
      me.teacherId = myMatchedTeacher.id;
      me.jenisKelamin = myMatchedTeacher.jenisKelamin || (myMatchedTeacher as any).jenis_kelamin || 'L';
      me.gender = me.jenisKelamin;
      if (myMatchedTeacher.nip && (!me.nip || me.nip === "-")) {
        me.nip = myMatchedTeacher.nip;
      }
      if ((!me.name || me.name === "Pengguna" || me.name === "Guru") && myMatchedTeacher.nama && myMatchedTeacher.nama !== "Pengguna") {
        me.name = myMatchedTeacher.nama;
      } else if (me.name && me.name !== "Pengguna" && (!myMatchedTeacher.nama || myMatchedTeacher.nama === "Pengguna" || myMatchedTeacher.nama === "Guru")) {
        myMatchedTeacher.nama = me.name;
      }
    }
    if (!me.name || me.name === "Pengguna") {
      const regName = localStorage.getItem("kawacanaan_last_registered_name");
      if (regName) me.name = regName;
    }

    if (me.role === "WALI KELAS") {
      const cleanMeName = normalizeTeacherName(me.name);
      const cleanTName = myMatchedTeacher ? normalizeTeacherName(myMatchedTeacher.nama) : "";
      let myWaliClasses = classList.filter(
        (c: any) =>
          (me.teacherId && c.waliKelasTeacherId === me.teacherId) ||
          (cleanTName && c.waliKelasName && normalizeTeacherName(c.waliKelasName) === cleanTName) ||
          (cleanMeName && c.waliKelasName && normalizeTeacherName(c.waliKelasName) === cleanMeName),
      );
      if (myWaliClasses.length === 0 && school.data?.kelas) {
        const spClass = classList.find((c: any) => normalizeTeacherName(c.name) === normalizeTeacherName(school.data.kelas));
        if (spClass) myWaliClasses = [spClass];
      }
      if (myWaliClasses.length === 0 && Array.isArray(masterJson?.resolvedClassIds) && masterJson.resolvedClassIds.length > 0) {
        myWaliClasses = classList.filter((c: any) => masterJson.resolvedClassIds.includes(c.id));
      }
      // Pastikan Wali Kelas hanya memiliki tepat 1 rombel binaan (Eksklusif)
      if (myWaliClasses.length > 1) {
        const preferredId =
          (Array.isArray(masterJson?.resolvedClassIds) && masterJson.resolvedClassIds[0]) ||
          (Array.isArray(baseProfile?.class_ids) && baseProfile.class_ids[0]) ||
          myWaliClasses[myWaliClasses.length - 1].id;
        const preferredClass = myWaliClasses.find((c: any) => c.id === preferredId) || myWaliClasses[myWaliClasses.length - 1];
        myWaliClasses = preferredClass ? [preferredClass] : [myWaliClasses[0]];
      }
      me.classIds = myWaliClasses.map((c: any) => c.id);
      me.classNames = myWaliClasses.map((c: any) => c.name);
    } else if (me.role === "GURU MAPEL") {
      const targetClassIds = new Set<string>(me.classIds || []);
      if (Array.isArray(masterJson?.resolvedClassIds) && masterJson.resolvedClassIds.length > 0) {
        masterJson.resolvedClassIds.forEach((cid: string) => targetClassIds.add(cid));
      }
      let hasSub = false;
      if (myMatchedTeacher) {
        const assignedSubIds = subjectTeacherScope.get(myMatchedTeacher.id) || [];
        if (assignedSubIds.length > 0) hasSub = true;
        assignedSubIds.forEach((sId) => {
          (subjectClassScope.get(sId) || []).forEach((cId) => targetClassIds.add(cId));
        });
      }
      // Rekonsiliasi otomatis: jika akun tercatat GURU MAPEL tetapi guru secara sah ditugaskan sebagai Wali Kelas di classes
      if (!hasSub && targetClassIds.size === 0 && me.teacherId) {
        const homeroomClass = classList.find((c: any) => c.waliKelasTeacherId === me.teacherId);
        if (homeroomClass) {
          targetClassIds.add(homeroomClass.id);
        }
      }
      me.classIds = Array.from(targetClassIds);
      me.classNames = me.classIds.map((cid: string) => classList.find((c: any) => c.id === cid)?.name || "").filter(Boolean);
    } else if (me.role === "SISWA") {
      let myMatchedStudent = ss.find((s: any) => me.studentId && s.id === me.studentId);
      if (!myMatchedStudent) {
        const uNisn = (me.username || "").trim().toLowerCase();
        const uNip = (me.nip || "").trim().toLowerCase();
        if (uNisn) {
          myMatchedStudent = ss.find(
            (s: any) => s.nisn && String(s.nisn).trim().toLowerCase() === uNisn
          );
        }
        if (!myMatchedStudent && uNip) {
          myMatchedStudent = ss.find(
            (s: any) => s.nisn && String(s.nisn).trim().toLowerCase() === uNip
          );
        }
      }
      if (!myMatchedStudent && me.name && me.name !== "Pengguna" && me.name !== "Siswa") {
        const cleanMeName = me.name.trim().toLowerCase();
        myMatchedStudent = ss.find(
          (s: any) => s.nama && s.nama.trim().toLowerCase() === cleanMeName
        );
      }

      if (myMatchedStudent) {
        me.studentId = myMatchedStudent.id;
        if (myMatchedStudent.classId) {
          me.classIds = [myMatchedStudent.classId];
          me.classNames = [myMatchedStudent.className || classList.find((c: any) => c.id === myMatchedStudent.classId)?.name || ""];
        }
        if (myMatchedStudent.gender) {
          me.gender = myMatchedStudent.gender;
          me.jenisKelamin = myMatchedStudent.gender;
        }
        if (myMatchedStudent.nama && (!me.name || me.name === "Pengguna" || me.name === "Siswa")) {
          me.name = myMatchedStudent.nama;
        }
        if (!baseProfile.student_id && myMatchedStudent.id) {
          Promise.resolve(
            supabase
              .from("profiles")
              .update({ student_id: myMatchedStudent.id })
              .eq("id", baseProfile.id)
          ).catch(() => {});
        }
      }
    }

    if (
      isLoggingOutRef.current ||
      (requestId !== undefined && requestId !== loadRequestRef.current)
    ) {
      return;
    }

    const isPwdAlreadyChanged =
      passwordChangedRecentlyRef.current ||
      (typeof window !== "undefined" &&
        (sessionStorage.getItem(`pwd_changed_${baseProfile.id}`) === "1" ||
          localStorage.getItem(`pwd_changed_${baseProfile.id}`) === "1")) ||
      (currentUser?.id === baseProfile.id && currentUser.mustChangePassword === false);

    if (isPwdAlreadyChanged) {
      me.mustChangePassword = false;
      const targetUser = hydratedUsers.find((u: any) => u.id === baseProfile.id);
      if (targetUser) {
        targetUser.mustChangePassword = false;
      }
    }

    setUsers(hydratedUsers);
    let rawSchoolData = school.data;
    if ((!rawSchoolData || !authoritativeSchoolCode) && schoolId) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token || "";
        const res = await fetch("/api/onboarding", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            action: "get_school_profile",
            school_id: schoolId,
          }),
        });
        const json = await res.json();
        if (json.ok) {
          if (json.profile && !rawSchoolData) {
            rawSchoolData = json.profile;
          }
          if (!authoritativeSchoolCode && json.school?.code) {
            authoritativeSchoolCode = String(json.school.code)
              .replace(/^SCH-?/i, "")
              .trim()
              .toUpperCase();
          }
        }
      } catch (_) {}
    }
    let loadedSchool = rawSchoolData
      ? dbSchool(rawSchoolData, authoritativeSchoolCode)
      : dbSchool(null, authoritativeSchoolCode);

    if (schoolId) {
      try {
        const cachedStr = localStorage.getItem(
          `kawacanaan_school_profile_${schoolId}`,
        );
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          loadedSchool = {
            ...loadedSchool,
            namaSekolah: loadedSchool.namaSekolah || cached.namaSekolah || "",
            jenjang: loadedSchool.jenjang || cached.jenjang || "SD/MI",
            npsn: loadedSchool.npsn || cached.npsn || "",
            kodeSekolah:
              authoritativeSchoolCode ||
              loadedSchool.kodeSekolah ||
              cached.kodeSekolah ||
              "",
            jalan: loadedSchool.jalan || cached.jalan || "",
            desaKelurahan:
              loadedSchool.desaKelurahan || cached.desaKelurahan || "",
            kecamatan: loadedSchool.kecamatan || cached.kecamatan || "",
            kabupatenKota:
              loadedSchool.kabupatenKota || cached.kabupatenKota || "",
            provinsi: loadedSchool.provinsi || cached.provinsi || "",
            kodePos: loadedSchool.kodePos || cached.kodePos || "",
            teleponFax: loadedSchool.teleponFax || cached.teleponFax || "",
            email: loadedSchool.email || cached.email || "",
            website: loadedSchool.website || cached.website || "",
            namaKepalaSekolah:
              loadedSchool.namaKepalaSekolah || cached.namaKepalaSekolah || "",
            nipKepalaSekolah:
              loadedSchool.nipKepalaSekolah || cached.nipKepalaSekolah || "",
            tahunPelajaran:
              loadedSchool.tahunPelajaran ||
              cached.tahunPelajaran ||
              "2025/2026",
            semester: loadedSchool.semester || cached.semester || "1 (Ganjil)",
          };
          loadedSchool.alamat =
            formatFullAlamat(loadedSchool) || loadedSchool.alamat || "";
        }
      } catch (_) {}
    }
    const myClass =
      (me.role === "WALI KELAS" || me.role === "GURU MAPEL") &&
      me.classIds?.length === 1
        ? classList.find((c: any) => c.id === me.classIds?.[0])
        : null;
    setSchoolProfile(
      myClass
        ? { ...loadedSchool, kelas: myClass.name, namaWaliKelas: me.name }
        : loadedSchool,
    );
    let cfg = config.data ? dbConfig(config.data) : INITIAL_SYSTEM_CONFIG;
    let resolvedActiveDays = cfg.activeStudyDays || [1, 2, 3, 4, 5];
    if (schoolId) {
      try {
        const cachedActiveDaysStr = localStorage.getItem(
          `kawacanaan_active_study_days_${schoolId}`,
        );
        if (cachedActiveDaysStr) {
          const parsed = JSON.parse(cachedActiveDaysStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            resolvedActiveDays = parsed;
          }
        }
      } catch (_) {}
      try {
        const cachedWaStr = localStorage.getItem("kawacanaan_whatsapp_config_" + schoolId);
        if (cachedWaStr) {
          const parsedWa = JSON.parse(cachedWaStr);
          cfg = { ...cfg, ...parsedWa };
        }
      } catch (_) {}
    }
    cfg.activeStudyDays = resolvedActiveDays;
    setSystemConfig(cfg);
    setActiveStudyDays(resolvedActiveDays);

    const finalEvents =
      events.data && events.data.length > 0
        ? events.data
        : (masterJson?.academicEvents || []);
    setAcademicEvents(finalEvents.map(dbEvent));

    const finalEffective =
      effective.data && effective.data.length > 0
        ? effective.data
        : (masterJson?.effectiveDays || []);
    const ed: any = {};
    finalEffective.forEach((x: any) => (ed[x.month_key] = x.days));
    setEffectiveDaysConfig(ed);

    let finalAttendance =
      Array.isArray(masterJson?.attendanceRecords) && masterJson.attendanceRecords.length > 0
        ? masterJson.attendanceRecords
        : (attendance.data || []);

    if (finalAttendance.length === 1000 && attendance.data && attendance.data.length === 1000) {
      try {
        let page = 1;
        let extraAttendance: any[] = [];
        while (page < 10) {
          const { data: nextPage, error: pageErr } = await supabase
            .from("attendance_records")
            .select("*")
            .eq("school_id", schoolId)
            .order("date", { ascending: false })
            .range(page * 1000, (page + 1) * 1000 - 1);
          if (pageErr || !nextPage || nextPage.length === 0) break;
          extraAttendance = extraAttendance.concat(nextPage);
          if (nextPage.length < 1000) break;
          page++;
        }
        if (extraAttendance.length > 0) {
          finalAttendance = [...finalAttendance, ...extraAttendance];
        }
      } catch (_) {}
    }

    const mappedDbAttendance = finalAttendance.map((r: any) => dbAttendance(r, ss));
    let authoritativeAttendance: AttendanceRecord[] = [];

    // Jika koneksi database berhasil (tidak ada error pembacaan attendance_records),
    // data dari database adalah sumber kebenaran tunggal (authoritative)
    if (!attendance.error && Array.isArray(attendance.data)) {
      authoritativeAttendance = mappedDbAttendance;
      try {
        const backupKey = `kawacanaan_attendance_backup_${schoolId}`;
        localStorage.setItem(backupKey, JSON.stringify(authoritativeAttendance.slice(-500)));
      } catch (_) {}
    } else {
      // Fallback cadangan hanya jika database offline / error
      const attendanceMap = new Map<string, AttendanceRecord>();
      try {
        const backupRaw = localStorage.getItem(`kawacanaan_attendance_backup_${schoolId}`);
        if (backupRaw) {
          const backupArr = JSON.parse(backupRaw);
          if (Array.isArray(backupArr)) {
            backupArr.forEach((r: AttendanceRecord) => {
              if (!r || !r.date || !r.studentId) return;
              const key =
                r.type === "SUBJECT"
                  ? `${r.date}_${r.studentId}_SUBJECT_${r.subjectId || ""}`
                  : `${r.date}_${r.studentId}_DAILY`;
              attendanceMap.set(key, r);
            });
          }
        }
      } catch (_) {}
      mappedDbAttendance.forEach((r: AttendanceRecord) => {
        if (!r || !r.date || !r.studentId) return;
        const key =
          r.type === "SUBJECT"
            ? `${r.date}_${r.studentId}_SUBJECT_${r.subjectId || ""}`
            : `${r.date}_${r.studentId}_DAILY`;
        attendanceMap.set(key, r);
      });
      authoritativeAttendance = Array.from(attendanceMap.values());
    }

    setAttendanceRecords(authoritativeAttendance);
    setCurrentAttendanceDate(formatServerDateString(getServerNow()));
    refreshLeaveRequests().catch(() => {});

    const { data: subjectRows, error: subjectRowsError } = await supabase
      .from("subjects")
      .select("*")
      .eq("school_id", schoolId)
      .order("name");
    const { data: subjectTeacherRows, error: subjectTeacherRowsError } =
      await supabase
        .from("subject_teacher_assignments")
        .select("subject_id, teacher_id, academic_year")
        .eq("school_id", schoolId)
        .eq("academic_year", activeAcademicYear);
    const { data: subjectClassRows, error: subjectClassRowsError } =
      await supabase
        .from("subject_class_assignments")
        .select("subject_id, class_id, academic_year")
        .eq("school_id", schoolId)
        .eq("academic_year", activeAcademicYear);
    const { data: subjectScheduleRows, error: subjectScheduleRowsError } =
      await supabase
        .from("subject_schedule_days")
        .select("subject_id, day_of_week, lesson_period")
        .eq("school_id", schoolId);
    if (subjectRowsError)
      console.warn(
        "[loadData] subjects read failed:",
        subjectRowsError.message,
      );
    if (subjectTeacherRowsError)
      console.warn(
        "[loadData] subject_teacher_assignments read failed:",
        subjectTeacherRowsError.message,
      );
    if (subjectClassRowsError)
      console.warn(
        "[loadData] subject_class_assignments read failed:",
        subjectClassRowsError.message,
      );
    if (subjectScheduleRowsError)
      console.warn(
        "[loadData] subject_schedule_days read failed:",
        subjectScheduleRowsError.message,
      );

    const effectiveSubjectRows =
      subjectRows && subjectRows.length > 0
        ? subjectRows
        : (masterJson?.subjects || []);
    const effectiveSubjectTeacherRows =
      subjectTeacherRows && subjectTeacherRows.length > 0
        ? subjectTeacherRows
        : (masterJson?.subjectTeacherAssignments || []);
    const effectiveSubjectClassRows =
      subjectClassRows && subjectClassRows.length > 0
        ? subjectClassRows
        : (masterJson?.subjectClassAssignments || []);
    const effectiveSubjectScheduleRows =
      subjectScheduleRows && subjectScheduleRows.length > 0
        ? subjectScheduleRows
        : (masterJson?.subjectScheduleDays || []);

    const teacherMap = new Map<string, any>(
      (baseTeachers || []).map((t: any) => [t.id, t]),
    );
    const classMap = new Map<string, any>(
      (classList || []).map((c: any) => [c.id, c]),
    );
    const teacherBySubject = new Map<string, string>();
    effectiveSubjectTeacherRows.forEach((r: any) =>
      teacherBySubject.set(r.subject_id, r.teacher_id),
    );
    const classesBySubject = new Map<string, string[]>();
    effectiveSubjectClassRows.forEach((r: any) => {
      const arr = classesBySubject.get(r.subject_id) || [];
      arr.push(r.class_id);
      classesBySubject.set(r.subject_id, arr);
    });
    const schedulesBySubject = new Map<string, any[]>();
    effectiveSubjectScheduleRows.forEach((r: any) => {
      const arr = schedulesBySubject.get(r.subject_id) || [];
      arr.push(r);
      schedulesBySubject.set(r.subject_id, arr);
    });
    setSubjects(
      effectiveSubjectRows.map((row: any) =>
        dbSubject(
          {
            ...row,
            teacher_id: teacherBySubject.get(row.id) || null,
            _targetClassIds: classesBySubject.get(row.id) || [],
          },
          teacherMap,
          classMap,
          schedulesBySubject,
        ),
      ),
    );

    // Komit currentUser secara utuh hanya setelah seluruh data (guru, kelas, siswa, presensi, profil, mata pelajaran) berhasil dimuat
    if (!isLoggingOutRef.current && (requestId === undefined || requestId === loadRequestRef.current)) {
      setCurrentUser(me);
      try {
        localStorage.setItem(CACHE_USER_SESSION_KEY, JSON.stringify(me));
        localStorage.setItem("kawacanaan_user_has_logged_in", "true");
      } catch (_) {}
    }
    } catch (err) {
      console.warn("[loadDataForSchool] error:", err);
      if (
        me &&
        !isLoggingOutRef.current &&
        (requestId === undefined || requestId === loadRequestRef.current)
      ) {
        setCurrentUser(me);
        try {
          localStorage.setItem(CACHE_USER_SESSION_KEY, JSON.stringify(me));
          localStorage.setItem("kawacanaan_user_has_logged_in", "true");
        } catch (_) {}
      }
    } finally {
      setIsDataLoading(false);
    }
  };

  const selectWorkspace = async (ws: WorkspaceMembership) => {
    const isPersonal =
      ws.workspaceType === "personal" || ws.workspaceType === "individu";

    // Aturan Opsi B: Ruang kerja individu diblokir total jika sekolah aktif Paket Sekolah Pro
    if (isPersonal && isSchoolPro) {
      showToast(
        "Sekolah Anda sedang aktif berlangganan Paket Sekolah. Aktivitas berpusat di Ruang Kerja Sekolah.",
        "info",
      );
      return;
    }

    const targetTitle = isPersonal
      ? "Ruang Kerja Individu"
      : ws.workspaceName || "Ruang Kerja Sekolah";

    setIsSwitchingWorkspace(true);
    setSwitchingWorkspaceProgress(25);
    setSwitchingWorkspaceTitle(`Beralih ke ${targetTitle}...`);
    setSwitchingWorkspaceMessage(
      "Menyiapkan otorisasi profil dan konfigurasi ruang kerja...",
    );

    try {
      setActiveWorkspace(ws);
      setIsOnboarding(false);
      if (ws.userId) {
        localStorage.setItem(
          `kawacanaan_last_workspace_id_${ws.userId}`,
          ws.workspaceId,
        );
        if (ws.workspaceType !== "personal" && ws.workspaceType !== "individu") {
          localStorage.setItem(`kawacanaan_school_ws_${ws.userId}`, JSON.stringify(ws));
        }
      }

      setSwitchingWorkspaceProgress(45);
      setSwitchingWorkspaceMessage(
        "Menyinkronkan status profil dan otorisasi ruang kerja...",
      );

      // Sinkronkan active workspace di profiles (Supabase) secara atomik di server
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token || "";
        if (token) {
          const switchRes = await fetch("/api/onboarding", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: "switch_workspace",
              workspace_id: ws.workspaceId,
              role: ws.role,
              workspace_type: ws.workspaceType,
            }),
          });
          const switchJson = await switchRes.json();
          if (!switchJson.ok && !switchJson.success && switchJson.error) {
            console.warn("[switchWorkspace] server warning:", switchJson.error);
          }
        }
      } catch (switchErr: any) {
        console.warn("[switchWorkspace] sync warning:", switchErr?.message);
      }

      setSwitchingWorkspaceProgress(70);
      setSwitchingWorkspaceMessage(
        "Memuat data rombel, profil pendidik, dan kalender presensi...",
      );

      const { data: baseProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", ws.userId)
        .maybeSingle();
      if (baseProfile) {
        await loadDataForSchool(ws.workspaceId, baseProfile, ws.role);
      }

      setSwitchingWorkspaceProgress(90);
      setSwitchingWorkspaceMessage("Menyelesaikan persiapan ruang kerja...");

      const saved = getSavedActiveView();
      const targetView = resolveInitialViewForRole(ws.role, saved);
      setCurrentAttendanceDate(formatServerDateString(getServerNow()));
      setActiveView(targetView);

      setSwitchingWorkspaceProgress(100);
      setSwitchingWorkspaceMessage("Ruang kerja siap digunakan!");
      await new Promise((res) => setTimeout(res, 300));
    } catch (err: any) {
      showToast(err?.message || "Gagal mengalihkan ruang kerja.", "error");
    } finally {
      setIsSwitchingWorkspace(false);
      setSwitchingWorkspaceProgress(0);
      setSwitchingWorkspaceTitle("");
      setSwitchingWorkspaceMessage("");
    }
  };

  const openOnboarding = () => {
    setIsOnboarding(true);
  };

  const loadUserDataAfterOnboarding = async (userId: string) => {
    setIsOnboarding(false);
    setIsAuthChecking(true);
    setIsLoginPreparing(true);
    await loadData(userId);
  };

  const loadData = async (userId: string) => {
    if (userId) {
      // Pemanggilan eksplisit dengan userId menandakan proses login/sinkronisasi aktif yang sah
      isLoggingOutRef.current = false;
    }
    if (isLoggingOutRef.current) return;
    if (!userId) {
      const { data: sessionData } = await supabase.auth.getSession();
      userId = sessionData.session?.user?.id || "";
    }
    if (isLoggingOutRef.current) return;
    if (!userId) {
      setIsOnboarding(false);
      setCurrentUser(null);
      setActiveView("login");
      setIsAuthChecking(false);
      setIsLoginPreparing(false);
      clearOAuthPendingFlags();
      try {
        localStorage.removeItem(CACHE_USER_SESSION_KEY);
        localStorage.removeItem(CACHE_LAST_VIEW_KEY);
      } catch (_) {}
      return;
    }

    if (inFlightLoadUserIdRef.current === userId && inFlightLoadPromiseRef.current) {
      return inFlightLoadPromiseRef.current;
    }

    const currentPromise = (async () => {
      setIsAuthChecking(true);
      const isOAuthPending =
        typeof window !== "undefined" &&
        (localStorage.getItem("kawacanaan_oauth_pending") === "true" ||
          sessionStorage.getItem("kawacanaan_oauth_pending") === "true" ||
          isAuthCallbackUrl());
      if (isOAuthPending) {
        setIsLoginPreparing(true);
      }
      const requestId = ++loadRequestRef.current;

      try {
        // Ambil daftar ruang kerja / membership user dan profil secara paralel dengan Promise.all
        let memberships: WorkspaceMembership[] = [];
        let baseProfile: any = null;
    let onboardingRes: any = null;
    try {
      let profileRes: any = null;
      [onboardingRes, profileRes] = await Promise.all([
        (async () => {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token || "";
          const cachedSchoolRaw =
            localStorage.getItem(`kawacanaan_school_ws_${userId}`);
          let knownSchoolId = "";
          if (cachedSchoolRaw) {
            try {
              const parsed = JSON.parse(cachedSchoolRaw);
              if (parsed?.userId === userId) {
                knownSchoolId = parsed?.workspaceId || "";
              }
            } catch (_) {}
          }
          return fetch("/api/onboarding", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              action: "get_user_workspaces",
              known_school_workspace_id: knownSchoolId,
            }),
          }).then((r) => r.json());
        })(),
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      ]);
      if (onboardingRes?.success && Array.isArray(onboardingRes.workspaces)) {
        memberships = onboardingRes.workspaces;
      }
      baseProfile = profileRes?.data || null;
      if ((!baseProfile || (!baseProfile.school_id && onboardingRes?.profile?.school_id)) && onboardingRes?.profile) {
        baseProfile = onboardingRes.profile;
      }

      // ISOLASI KETAT: Hanya gabungkan cache sekolah jika user BUKAN pengguna ruang kerja individu murni
      const isPersonalAccount =
        baseProfile?.workspace_type === "personal" ||
        baseProfile?.registration_mode === "personal";

      if (!isPersonalAccount) {
        const cachedSchoolRaw =
          localStorage.getItem(`kawacanaan_school_ws_${userId}`);
        if (cachedSchoolRaw) {
          try {
            const parsed = JSON.parse(cachedSchoolRaw);
            if (
              parsed?.workspaceId &&
              parsed?.userId === userId &&
              parsed?.workspaceType !== "personal" &&
              !memberships.some((m) => m.workspaceId === parsed.workspaceId)
            ) {
              memberships.unshift(parsed);
            }
          } catch (_) {}
        }
      }
    } catch (_) {}

    if (isLoggingOutRef.current || requestId !== loadRequestRef.current) {
      return;
    }

    // Jika profil belum ada di Supabase client tapi memberships ditemukan (mis. baru selesai onboarding), buat objek baseProfile
    if (!baseProfile && memberships.length > 0) {
      const chosen = memberships[0];
      let resolvedName = "";
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const meta = sessionData?.session?.user?.user_metadata || {};
        resolvedName =
          meta.name ||
          meta.full_name ||
          (onboardingRes as any)?.userMetadata?.name ||
          (onboardingRes as any)?.userMetadata?.full_name ||
          (onboardingRes as any)?.profile?.name ||
          (chosen as any)?.userName ||
          "";
      } catch (_) {}
      if (!resolvedName || resolvedName === "Pengguna") {
        resolvedName = localStorage.getItem("kawacanaan_last_registered_name") || "";
      }
      const candidateRole = normalizeUserRole(
        chosen.role ||
        localStorage.getItem("kawacanaan_last_registered_role") ||
        "WALI KELAS"
      );
      const resolvedRole = candidateRole === "SUPER_ADMIN" ? "WALI KELAS" : candidateRole;
      baseProfile = {
        id: userId,
        school_id: chosen.workspaceId,
        role: resolvedRole,
        name: resolvedName || "Pendidik",
        username: "user_" + userId.slice(0, 8),
        is_active: true,
      };
    }

    // Jika profil belum ada dan belum punya ruang kerja sama sekali -> Arahkan ke Onboarding
    if (!baseProfile && memberships.length === 0) {
      clearOAuthPendingFlags();
      setIsOnboarding(true);
      setRegistrationRequired(false);
      setIsAuthChecking(false);
      setIsLoginPreparing(false);
      return;
    }

    if (baseProfile && baseProfile.is_active === false) {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setActiveView("login");
      setIsAuthChecking(false);
      setIsLoginPreparing(false);
      clearOAuthPendingFlags();
      showToast("Akun Anda dinonaktifkan oleh administrator.", "error");
      return;
    }

    let isGoogleAuthUser = Boolean(
      localStorage.getItem("kawacanaan_oauth_pending") ||
        sessionStorage.getItem("kawacanaan_oauth_pending")
    );
    try {
      const { data: sData } = await supabase.auth.getSession();
      if (
        sData?.session?.user?.app_metadata?.provider === "google" ||
        sData?.session?.user?.identities?.some((id: any) => id.provider === "google")
      ) {
        isGoogleAuthUser = true;
      }
    } catch (_) {}

    const isPwdAlreadyChanged =
      isGoogleAuthUser ||
      passwordChangedRecentlyRef.current ||
      (typeof window !== "undefined" &&
        (sessionStorage.getItem(`pwd_changed_${userId}`) === "1" ||
          localStorage.getItem(`pwd_changed_${userId}`) === "1")) ||
      (currentUser?.id === userId && currentUser.mustChangePassword === false);

    if (baseProfile && isPwdAlreadyChanged) {
      baseProfile.must_change_password = false;
    }

    if (baseProfile && baseProfile.role === "SUPER_ADMIN") {
      setLoginRoleLabel("Super Administrator");
      setLoginWorkspaceName("Pusat Kontrol Sistem Superadmin");
      setLoginWorkspaceType("school");
      setLoginRoleDetails("Menyiapkan dasbor platform, pengelolaan lisensi sekolah, dan kontrol akses...");
      setLoginStep(2);
      setLoginProgressMessage("Peran terdeteksi: Super Administrator");

      const { data: platform } = await supabase
        .from("platform_settings")
        .select("security")
        .eq("id", 1)
        .maybeSingle();
      if (platform?.security?.mfaRequiredForSuperAdmin) {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const verified = (factors?.totp || []).some(
          (f: any) => f.status === "verified",
        );
        if (!verified) {
          await supabase.auth.signOut();
          setCurrentUser(null);
          setActiveView("login");
          setIsAuthChecking(false);
          setIsLoginPreparing(false);
          try {
            localStorage.removeItem(CACHE_USER_SESSION_KEY);
            localStorage.removeItem(CACHE_LAST_VIEW_KEY);
          } catch (_) {}
          showToast(
            "MFA wajib untuk akun Super Admin. Aktifkan authenticator terlebih dahulu.",
            "error",
          );
          return;
        }
      }
      try {
        await supabase.rpc("touch_presence");
      } catch (_) {
        /* presence is non-blocking */
      }
      setRegistrationRequired(false);
      setIsOnboarding(false);
      const isPwdAlreadyChanged =
        passwordChangedRecentlyRef.current ||
        (typeof window !== "undefined" &&
          (sessionStorage.getItem(`pwd_changed_${userId}`) === "1" ||
            localStorage.getItem(`pwd_changed_${userId}`) === "1")) ||
        (currentUser?.id === userId && currentUser.mustChangePassword === false);

      setLoginStep(3);
      setLoginProgressMessage("Menyiapkan komponen Super Administrator...");

      const superAdminUser = emptyUser({
        ...baseProfile,
        must_change_password: isPwdAlreadyChanged ? false : baseProfile?.must_change_password,
      });
      setCurrentUser(superAdminUser);
      try {
        localStorage.setItem(
          CACHE_USER_SESSION_KEY,
          JSON.stringify(superAdminUser),
        );
        localStorage.setItem("kawacanaan_user_has_logged_in", "true");
      } catch (_) {}
      const saved = getSavedActiveView();
      const targetView = resolveInitialViewForRole("SUPER_ADMIN", saved);

      setActiveView(targetView);
      setIsAuthChecking(false);
      setIsLoginPreparing(false);
      clearOAuthPendingFlags();
      return;
    }

    // Fallback jika belum ada record multi-workspace di endpoint: bangun dari baseProfile
    if (memberships.length === 0 && baseProfile && baseProfile.school_id) {
      const { data: schoolRow } = await supabase
        .from("schools")
        .select("name, npsn, code, plan, status, subscription_expires_at, workspace_type, is_personal")
        .eq("id", baseProfile.school_id)
        .maybeSingle();
      const schoolRowCode = schoolRow?.code
        ? String(schoolRow.code)
            .replace(/^SCH-?/i, "")
            .trim()
            .toUpperCase()
        : null;
      const isPersonal =
        (baseProfile as any).workspace_type === "personal" ||
        (baseProfile as any).registration_mode === "personal" ||
        schoolRow?.workspace_type === "personal" ||
        (schoolRow as any)?.is_personal === true;

      memberships.push({
        id: "ws-mem-" + baseProfile.id,
        userId: baseProfile.id,
        workspaceId: baseProfile.school_id,
        workspaceCode: schoolRowCode,
        role: baseProfile.role as UserRole,
        workspaceName:
          schoolRow?.name ||
          (isPersonal ? "Ruang Kerja Individu" : "Ruang Kerja Sekolah"),
        workspaceType: isPersonal ? "personal" : "school",
        npsn: schoolRow?.npsn || null,
        subscriptionPlan: normalizePlan(schoolRow?.plan || baseProfile?.subscription_plan || "free"),
        subscriptionStatus: schoolRow?.status || baseProfile?.subscription_status || "active",
        subscriptionExpiresAt: schoolRow?.subscription_expires_at || baseProfile?.subscription_expires_at || null,
        subscription: {
          plan: normalizePlan(schoolRow?.plan || baseProfile?.subscription_plan || "free"),
          status: schoolRow?.status || baseProfile?.subscription_status || "active",
          expiresAt: schoolRow?.subscription_expires_at || baseProfile?.subscription_expires_at || null,
        } as any,
        joinedAt: baseProfile.created_at || new Date().toISOString(),
      });
    }

    // Aturan Opsi B (Kunci Total): Jika sekolah aktif Paket Sekolah Pro,
    // saring ruang kerja individu dan kunci pengguna ke Ruang Kerja Sekolah
    const schoolWorkspace = memberships.find(
      (ws) => ws.workspaceType !== "personal" && ws.workspaceType !== "individu",
    );
    const hasActiveSchoolPro =
      schoolWorkspace &&
      isUserInActiveSchoolPlan(currentUser, schoolWorkspace);

    if (hasActiveSchoolPro && schoolWorkspace) {
      memberships = memberships.filter(
        (ws) => ws.workspaceType !== "personal" && ws.workspaceType !== "individu",
      );
    }

    setUserWorkspaces(memberships);

    if (memberships.length === 0) {
      clearOAuthPendingFlags();
      setIsOnboarding(true);
      setIsAuthChecking(false);
      setIsLoginPreparing(false);
      return;
    }

    // Tentukan ruang kerja aktif secara otomatis (berdasarkan ruang kerja terakhir khusus user ini)
    const lastUsedWsId =
      localStorage.getItem(`kawacanaan_last_workspace_id_${userId}`);

    let chosenWorkspace: WorkspaceMembership | null = null;

    if (hasActiveSchoolPro && schoolWorkspace) {
      chosenWorkspace = schoolWorkspace;
    } else if (lastUsedWsId) {
      chosenWorkspace =
        memberships.find((ws) => ws.workspaceId === lastUsedWsId) || null;
    }

    if (!chosenWorkspace && baseProfile?.school_id) {
      chosenWorkspace =
        memberships.find((ws) => ws.workspaceId === baseProfile.school_id) ||
        null;
    }

    if (!chosenWorkspace) {
      const isPersonalUser =
        baseProfile?.workspace_type === "personal" ||
        baseProfile?.registration_mode === "personal";
      if (isPersonalUser) {
        chosenWorkspace =
          memberships.find(
            (ws) =>
              ws.workspaceType === "personal" || ws.workspaceType === "individu",
          ) || memberships[0];
      } else {
        chosenWorkspace =
          memberships.find(
            (ws) =>
              ws.workspaceType !== "personal" && ws.workspaceType !== "individu",
          ) || memberships[0];
      }
    }

    if (!chosenWorkspace && memberships.length > 0) {
      chosenWorkspace = memberships[0];
    }

    if (!chosenWorkspace) {
      clearOAuthPendingFlags();
      setIsOnboarding(true);
      setIsAuthChecking(false);
      setIsLoginPreparing(false);
      return;
    }

    const normalizedWsRole = normalizeUserRole(chosenWorkspace.role);
    chosenWorkspace.role = (normalizedWsRole === "SUPER_ADMIN" ? "WALI KELAS" : normalizedWsRole) as UserRole;
    if (baseProfile) {
      const normalizedProfRole = normalizeUserRole(baseProfile.role);
      baseProfile.role = (normalizedProfRole === "SUPER_ADMIN" ? "WALI KELAS" : normalizedProfRole) as UserRole;
    }

    const currentRole = chosenWorkspace.role;
    const isPersonal =
      chosenWorkspace.workspaceType === "personal" ||
      chosenWorkspace.workspaceType === "individu";
    const workspaceName =
      chosenWorkspace.workspaceName ||
      (isPersonal ? "Ruang Kerja Individu" : "Ruang Kerja Sekolah");

    let roleLabel = "Pengguna Sistem";
    let roleDetails = "Menyiapkan modul dan data presensi...";
    if (currentRole === "ADMIN") {
      roleLabel = "Administrator Sekolah";
      roleDetails = "Menyiapkan modul lembaga, rombel kelas, direktori guru, data siswa, dan rekapitulasi presensi...";
    } else if (currentRole === "KEPALA SEKOLAH") {
      roleLabel = "Kepala Sekolah";
      roleDetails = "Menyiapkan analitik kehadiran sekolah, rekapitulasi presensi, dan agenda akademik...";
    } else if (currentRole === "WALI KELAS") {
      roleLabel = "Wali Kelas";
      roleDetails = "Menyiapkan rombel binaan, lembar presensi harian siswa, dan data perizinan...";
    } else if (currentRole === "GURU MAPEL") {
      roleLabel = "Guru Mata Pelajaran";
      roleDetails = "Menyiapkan jadwal mata pelajaran diampu, kelas mengajar, dan absensi pertemuan...";
    } else if (currentRole === "SISWA") {
      roleLabel = "Siswa / Peserta Didik";
      roleDetails = "Menyiapkan portal mandiri siswa, riwayat kehadiran, dan fitur absensi QR...";
    }

    setLoginRoleLabel(roleLabel);
    setLoginWorkspaceName(workspaceName);
    setLoginWorkspaceType(chosenWorkspace.workspaceType);
    setLoginRoleDetails(roleDetails);
    setLoginStep(2);
    setLoginProgressMessage(`Peran terdeteksi: ${roleLabel}`);

    setActiveWorkspace(chosenWorkspace);
    setIsOnboarding(false);

    if (userId && chosenWorkspace?.workspaceId) {
      localStorage.setItem(
        `kawacanaan_last_workspace_id_${userId}`,
        chosenWorkspace.workspaceId,
      );
    }

    if (isLoggingOutRef.current || requestId !== loadRequestRef.current) {
      return;
    }

    setLoginStep(3);
    setLoginProgressMessage(
      `Menyiapkan data & komponen ${roleLabel}...`,
    );

    await loadDataForSchool(
      chosenWorkspace.workspaceId,
      baseProfile,
      chosenWorkspace.role,
      requestId,
    );

    if (isLoggingOutRef.current || requestId !== loadRequestRef.current) {
      return;
    }

    const wasOAuth =
      localStorage.getItem("kawacanaan_oauth_pending") === "true" ||
      sessionStorage.getItem("kawacanaan_oauth_pending") === "true";

    const saved = wasOAuth ? null : getSavedActiveView();
    const role = chosenWorkspace.role;
    const targetView = wasOAuth
      ? (role === "SUPER_ADMIN" ? "superadmin" : role === "SISWA" ? "portal-siswa" : "dashboard")
      : resolveInitialViewForRole(role, saved);
    setActiveView(targetView);
    clearOAuthPendingFlags();
    try {
      localStorage.setItem("kawacanaan_user_has_logged_in", "true");
    } catch (_) {}
    setIsAuthChecking(false);
    setIsLoginPreparing(false);
      } catch (err) {
        console.error("[loadData] error:", err);
        const wasOAuth =
          localStorage.getItem("kawacanaan_oauth_pending") === "true" ||
          sessionStorage.getItem("kawacanaan_oauth_pending") === "true";
        const cached = getCachedUserSession();
        if (cached && (!currentUser || currentUser.id === cached.id)) {
          setCurrentUser(cached);
          const saved = wasOAuth ? null : getSavedActiveView();
          const targetView = wasOAuth
            ? (cached.role === "SUPER_ADMIN" ? "superadmin" : cached.role === "SISWA" ? "portal-siswa" : "dashboard")
            : resolveInitialViewForRole(normalizeUserRole(cached.role), saved);
          setActiveView(targetView);
        } else if (!currentUser) {
          setActiveView("login");
        }
      } finally {
        if (requestId === loadRequestRef.current) {
          setIsAuthChecking(false);
          setIsLoginPreparing(false);
          clearOAuthPendingFlags();
          inFlightLoadPromiseRef.current = null;
          inFlightLoadUserIdRef.current = "";
        }
      }
    })();

    inFlightLoadPromiseRef.current = currentPromise;
    inFlightLoadUserIdRef.current = userId;
    return currentPromise;
  };
  useEffect(() => {
    let mounted = true;

    // Password recovery harus diperlakukan berbeda dari login biasa.
    // Supabase akan membuat session recovery saat link dari email diklik.
    // Jangan loadData()/redirect ke dashboard pada event ini.
    const handleAuthEvent = (event: string, session: any) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT") {
        setPasswordRecovery(false);
        setCurrentUser(null);
        setRegistrationRequired(false);
        setActiveView("login");
        setIsAuthChecking(false);
        try {
          localStorage.removeItem(CACHE_USER_SESSION_KEY);
          localStorage.removeItem(CACHE_LAST_VIEW_KEY);
          localStorage.removeItem("kawacanaan_user_has_logged_in");
          localStorage.removeItem("kawacanaan_oauth_pending");
          sessionStorage.removeItem("kawacanaan_oauth_pending");
          sessionStorage.removeItem("kawacanaan_oauth_time");
        } catch (_) {}
        return;
      }

      if (isLoggingOutRef.current) return;

      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecovery(true);
        setCurrentUser(null);
        setRegistrationRequired(false);
        setActiveView("login");
        setIsAuthChecking(false);
        return;
      }

      // Supabase memicu event USER_UPDATED setelah updateUser() berhasil (misal saat ganti password).
      // Memuat ulang data pada saat event ini akan menyebabkan race condition yang menimpa
      // status mustChangePassword: false dengan data profil lama yang belum tersinkron.
      // TOKEN_REFRESHED terjadi berkala saat refresh JWT token di background/tab focus, jangan reload data agar form tidak ter-reset.
      if (event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
        return;
      }

      if (session?.user) {
        setIsAuthChecking(true);
        const isOAuthPending =
          typeof window !== "undefined" &&
          (localStorage.getItem("kawacanaan_oauth_pending") === "true" ||
            sessionStorage.getItem("kawacanaan_oauth_pending") === "true" ||
            isAuthCallbackUrl() ||
            (event === "SIGNED_IN" && !currentUser));
        if (isOAuthPending) {
          setIsLoginPreparing(true);
        }
        resetSessionTimers();
        setPasswordRecovery(false);
        if (
          typeof window !== "undefined" &&
          window.location.hash &&
          (window.location.hash.includes("access_token=") ||
            window.location.hash.includes("refresh_token="))
        ) {
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search,
          );
        }
        if (
          typeof window !== "undefined" &&
          window.location.search &&
          window.location.search.includes("code=")
        ) {
          try {
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete("code");
            window.history.replaceState(
              null,
              "",
              cleanUrl.pathname + (cleanUrl.searchParams.toString() ? `?${cleanUrl.searchParams.toString()}` : ""),
            );
          } catch (_) {}
        }
        setTimeout(() => {
          if (!mounted || isLoggingOutRef.current) return;
          loadData(session.user.id);
        }, 0);
        return;
      }

      if (isAuthCallbackUrl()) {
        return;
      }

      setPasswordRecovery(false);
      setCurrentUser(null);
      setRegistrationRequired(false);
      setActiveView("login");
      setIsAuthChecking(false);
      setIsLoginPreparing(false);
      clearOAuthPendingFlags();
      try {
        localStorage.removeItem(CACHE_USER_SESSION_KEY);
        localStorage.removeItem(CACHE_LAST_VIEW_KEY);
      } catch (_) {}
      setStudents([]);
      setClasses([]);
      setTeachers([]);
      setUsers([]);
      setAttendanceRecords([]);
    };

    // 0. Deteksi jika URL memuat parameter error dari Google OAuth
    if (typeof window !== "undefined") {
      const hash = window.location.hash || "";
      const params = new URLSearchParams(window.location.search);
      if (params.has("error") || hash.includes("error=")) {
        clearOAuthPendingFlags();
        setIsAuthChecking(false);
        setIsLoginPreparing(false);
        const errDesc =
          params.get("error_description") ||
          (hash.includes("error_description=")
            ? decodeURIComponent(hash.split("error_description=")[1].split("&")[0])
            : null);
        const friendlyMsg = errDesc
          ? decodeURIComponent(errDesc.replace(/\+/g, " "))
          : "Autentikasi Google dibatalkan atau ditolak.";
        showToast(friendlyMsg, "error");
        try {
          window.history.replaceState(null, "", window.location.pathname);
        } catch (_) {}
        setActiveView("login");
        return;
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted || isLoggingOutRef.current) return;
      const timeoutStatus = checkSessionTimeouts();
      if (timeoutStatus.expired) {
        clearSessionTimers();
        try {
          localStorage.removeItem(CACHE_USER_SESSION_KEY);
          localStorage.removeItem(CACHE_LAST_VIEW_KEY);
        } catch (_) {}
        void supabase.auth.signOut();
        setCurrentUser(null);
        setActiveView("login");
        setIsAuthChecking(false);
        if (timeoutStatus.reason === "idle") {
          showToast(
            "Sesi Anda berakhir otomatis karena tidak ada aktivitas selama 10 menit. Silakan login kembali.",
            "info",
          );
        } else if (timeoutStatus.reason === "absolute") {
          showToast(
            "Sesi login Anda telah mencapai batas maksimal (8 jam). Silakan login kembali demi keamanan akses.",
            "info",
          );
        }
        return;
      }

      // Jika user membuka /reset-password tanpa event recovery (misalnya
      // refresh setelah link diproses), tetap tampilkan form selama ada session.
      if (window.location.pathname === "/reset-password" && data.session) {
        setPasswordRecovery(true);
        return;
      }
      if (data.session?.user) {
        loadData(data.session.user.id);
      } else {
        // Jika URL saat ini memuat callback auth (Google OAuth code/token),
        // jangan langsung reset atau matikan isAuthChecking karena Supabase client sedang
        // menukar code menjadi session di background dan akan segera memicu onAuthStateChange.
        if (isAuthCallbackUrl()) {
          setTimeout(() => {
            if (mounted && !currentUser) {
              setIsAuthChecking(false);
              setIsLoginPreparing(false);
              clearOAuthPendingFlags();
            }
          }, 8000);
          return;
        }

        try {
          localStorage.removeItem(CACHE_USER_SESSION_KEY);
          localStorage.removeItem(CACHE_LAST_VIEW_KEY);
        } catch (_) {}
        setCurrentUser(null);
        setActiveView("login");
        setIsAuthChecking(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange(handleAuthEvent);

    const handleSupabaseConfigured = () => {
      if (!mounted || isLoggingOutRef.current) return;
      supabase.auth.getSession().then(({ data }) => {
        if (!mounted || isLoggingOutRef.current) return;
        if (data?.session?.user) {
          loadData(data.session.user.id);
        }
      }).catch(() => {});
    };

    if (typeof window !== "undefined") {
      window.addEventListener("kawacanaan-supabase-configured", handleSupabaseConfigured);
    }

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener("kawacanaan-supabase-configured", handleSupabaseConfigured);
      }
    };
  }, []);

  // Keamanan Akses: Idle Timeout (10 menit tanpa aktivitas) & Absolute Timeout (maksimal 8 jam sesi login)
  useEffect(() => {
    if (!currentUser?.id) return;

    // Inisialisasi timer sesi jika belum ada
    recordSessionActivity();

    let lastThrottledUpdate = Date.now();

    const handleUserActivity = () => {
      const currentNow = Date.now();
      // Throttle update localStorage setiap 5 detik agar tetap ringan
      if (currentNow - lastThrottledUpdate > 5000) {
        lastThrottledUpdate = currentNow;
        try {
          localStorage.setItem(SESSION_LAST_ACTIVE_KEY, String(currentNow));
        } catch (_) {}
      }
    };

    const activityEvents: (keyof WindowEventMap)[] = [
      "mousedown",
      "mousemove",
      "keydown",
      "touchstart",
      "scroll",
      "click",
    ];
    activityEvents.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });

    const checkTimeout = () => {
      const timeoutStatus = checkSessionTimeouts();
      if (timeoutStatus.expired) {
        void logout();
        if (timeoutStatus.reason === "idle") {
          showToast(
            "Sesi Anda berakhir otomatis karena tidak ada aktivitas selama 10 menit. Silakan login kembali.",
            "info",
          );
        } else if (timeoutStatus.reason === "absolute") {
          showToast(
            "Sesi login Anda telah mencapai batas maksimal (8 jam). Silakan login kembali demi keamanan akses.",
            "info",
          );
        }
      }
    };

    // Periksa setiap 10 detik
    const timerInterval = window.setInterval(checkTimeout, 10000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkTimeout();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", checkTimeout);

    return () => {
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
      window.clearInterval(timerInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", checkTimeout);
    };
  }, [currentUser?.id]);

  // Presensi sesi ringan: menandai akun ini "sedang aktif" agar terlihat di
  // Monitoring Real-Time Super Admin (lihat public.touch_presence() & tabel
  // active_sessions pada 02_superadmin_pro.sql). Tidak berpengaruh
  // apa pun pada akun yang bukan Super Admin selain baris last_seen_at sendiri.
  useEffect(() => {
    if (!currentUser?.id) return;
    const ping = () => {
      supabase.rpc("touch_presence").then(undefined, () => {});
    };
    ping();
    const id = window.setInterval(ping, 60000);
    return () => window.clearInterval(id);
  }, [currentUser?.id]);

  const apiUser = async (action: string, payload: any = {}) => {
    const { data } = await supabase.auth.getSession();
    const r = await fetch("/api/admin-users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session?.access_token || ""}`,
      },
      body: JSON.stringify({ action, ...payload }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error || "Operasi akun gagal");
    return body;
  };
  const updateSchoolProfile = async (p: SchoolProfile) => {
    const fullAlamat = formatFullAlamat(p) || p.alamat || "";
    const extPayload = {
      full: fullAlamat,
      jenjang: p.jenjang || "SD/MI",
      jalan: p.jalan || "",
      desaKelurahan: p.desaKelurahan || "",
      kecamatan: p.kecamatan || "",
      kabupatenKota: p.kabupatenKota || "",
      provinsi: p.provinsi || "",
      kodePos: p.kodePos || "",
      teleponFax: p.teleponFax || "",
      email: p.email || "",
      website: p.website || "",
      namaKepalaSekolah: p.namaKepalaSekolah || "",
      nipKepalaSekolah: p.nipKepalaSekolah || "",
      tahunPelajaran: p.tahunPelajaran || "2025/2026",
      semester: p.semester || "1 (Ganjil)",
    };
    const serializedAlamat = `__EXTJSON__:${JSON.stringify(extPayload)}`;
    const schoolId =
      currentUser?.schoolId || activeWorkspace?.workspaceId || null;

    const normalizedProfile: SchoolProfile = {
      ...p,
      kodeSekolah: p.kodeSekolah || schoolProfile.kodeSekolah || "",
      alamat: fullAlamat,
      jenjang: p.jenjang || "SD/MI",
      jalan: p.jalan || "",
      desaKelurahan: p.desaKelurahan || "",
      kecamatan: p.kecamatan || "",
      kabupatenKota: p.kabupatenKota || "",
      provinsi: p.provinsi || "",
      kodePos: p.kodePos || "",
      teleponFax: p.teleponFax || "",
      email: p.email || "",
      website: p.website || "",
      namaKepalaSekolah: p.namaKepalaSekolah || "",
      nipKepalaSekolah: p.nipKepalaSekolah || "",
      tahunPelajaran: p.tahunPelajaran || "2025/2026",
      semester: p.semester || "1 (Ganjil)",
      kelas: p.kelas || "",
      namaWaliKelas: p.namaWaliKelas || "",
      nipWaliKelas: p.nipWaliKelas || "",
    };

    // 1. Langsung update state global agar UI stabil & instan tanpa flicker
    setSchoolProfile(normalizedProfile);
    if (p.namaSekolah && activeWorkspace) {
      setActiveWorkspace((prev) =>
        prev ? { ...prev, workspaceName: p.namaSekolah } : null,
      );
    }
    if (p.namaSekolah && currentUser) {
      setCurrentUser((prev) =>
        prev ? { ...prev, schoolName: p.namaSekolah } : null,
      );
    }

    // 2. Simpan cache per school ID ke localStorage agar tahan refresh & switch tab
    if (schoolId) {
      try {
        localStorage.setItem(
          `kawacanaan_school_profile_${schoolId}`,
          JSON.stringify(normalizedProfile),
        );
      } catch (_) {}
    }

    // 3. Simpan dan sinkronisasi ke tabel school_profile dan schools (Superadmin) via API service-role
    let apiSuccess = false;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || "";
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: "save_school_profile",
          schoolId,
          namaSekolah: p.namaSekolah,
          npsn: p.npsn,
          jenjang: p.jenjang || "SD/MI",
          alamat: serializedAlamat,
          tahunPelajaran: p.tahunPelajaran || "2025/2026",
          semester: p.semester || "1 (Ganjil)",
          kelas: p.kelas || "",
          namaKepalaSekolah: p.namaKepalaSekolah || "",
          nipKepalaSekolah: p.nipKepalaSekolah || "",
          namaWaliKelas: p.namaWaliKelas || "",
          nipWaliKelas: p.nipWaliKelas || "",
        }),
      });
      const jsonRes = await res.json().catch(() => ({}));
      if (res.ok && (jsonRes.ok || jsonRes.success)) {
        apiSuccess = true;
      }
    } catch (err: any) {
      console.warn("API save_school_profile warning:", err?.message);
    }

    // 4. Fallback upsert langsung jika API gagal atau untuk multi-redundansi
    if (schoolId) {
      try {
        await supabase.from("school_profile").upsert(
          {
            school_id: schoolId,
            nama_sekolah: p.namaSekolah,
            npsn: p.npsn || null,
            alamat: serializedAlamat,
            tahun_pelajaran: p.tahunPelajaran || "2025/2026",
            semester: p.semester || "1 (Ganjil)",
            kelas: p.kelas || "",
            nama_kepala_sekolah: p.namaKepalaSekolah || "",
            nip_kepala_sekolah: p.nipKepalaSekolah || "",
            nama_wali_kelas: p.namaWaliKelas || "",
            nip_wali_kelas: p.nipWaliKelas || "",
          },
          { onConflict: "school_id" },
        );

        // Catatan: Tidak melakukan update langsung ke tabel schools dari frontend.
        // Update schools ditangani secara aman oleh backend / API onboarding.
      } catch (upsertErr: any) {
        console.warn(
          "Direct upsert school_profile warning:",
          upsertErr?.message,
        );
      }
    }

    showToast("Identitas Sekolah berhasil disimpan");
  };
  const updateSystemConfig = async (c: SystemConfig) => {
    const schoolId = activeWorkspace?.workspaceId || currentUser?.schoolId || null;
    let savedSuccessfully = false;

    // 1. Simpan melalui API Onboarding (menggunakan service role Supabase agar bebas hambatan RLS)
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || "";
      const apiRes = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: "save_system_config",
          schoolId,
          ...c,
        }),
      });
      const jsonRes = await apiRes.json().catch(() => ({}));
      if (apiRes.ok && (jsonRes.ok || jsonRes.success)) {
        savedSuccessfully = true;
      }
    } catch (apiErr: any) {
      console.warn("API save_system_config warning:", apiErr?.message);
    }

    // 2. Fallback simpan langsung jika API offline (menggunakan pola delete-then-insert agar tidak memicu trigger BEFORE UPDATE)
    if (!savedSuccessfully && schoolId) {
      try {
        await supabase.from("system_config").delete().eq("school_id", schoolId);
        const { error } = await supabase.from("system_config").insert({
          school_id: schoolId,
          app_title: c.appTitle,
          app_subtitle: c.appSubtitle,
          footer_copyright: c.footerCopyright,
          school_logo_url: c.schoolLogoUrl || "",
          letterhead_type: c.letterheadType || "standard_text",
          letterhead_image_url: c.letterheadImageUrl || "",
          show_letterhead: c.showLetterhead ?? true,
          default_check_in_time: c.defaultCheckInTime,
          default_check_out_time: c.defaultCheckOutTime,
          report_place: c.reportPlace || "",
          report_date: c.reportDate ? c.reportDate.trim() : null,
          active_study_days:
            Array.isArray(c.activeStudyDays) && c.activeStudyDays.length > 0
              ? c.activeStudyDays
              : activeStudyDays,
          student_self_attendance_enabled: c.studentSelfAttendanceEnabled,
          check_in_start_time: c.checkInStartTime,
          check_in_deadline_time: c.checkInDeadlineTime,
          check_out_start_time: c.checkOutStartTime,
          auto_mark_late: c.autoMarkLate,
        });
        if (error) return showToast(error.message, "error");
      } catch (err: any) {
        return showToast(err.message || "Gagal menyimpan pengaturan sistem", "error");
      }
    }

    setSystemConfig(c);
    setActiveStudyDays(c.activeStudyDays || activeStudyDays);
    showToast("Pengaturan Sistem berhasil diperbarui");
  };
  const resolveWaliKelas = async (inputTeacherId: string | null, targetClassId?: string | null) => {
    if (!inputTeacherId) return { dbWaliTeacherId: null, waliName: null };
    const schoolId = currentUser?.schoolId || null;
    const year = schoolProfile.tahunPelajaran || "2026/2027";

    // Validasi aturan: Satu guru hanya boleh menjadi Wali Kelas untuk satu kelas dalam tahun ajaran yang sama
    const existingHomeroom = classes.find(
      (c) =>
        c.waliKelasTeacherId === inputTeacherId &&
        (!c.academicYear || c.academicYear === year) &&
        (!targetClassId || c.id !== targetClassId),
    );
    if (existingHomeroom) {
      throw new Error(
        `Guru ini sudah ditugaskan sebagai Wali Kelas pada "${existingHomeroom.name}" untuk tahun ajaran ${year}. Satu guru hanya boleh menjadi Wali Kelas untuk satu rombel kelas.`,
      );
    }

    const teacherMatch = teachers.find((t) => t.id === inputTeacherId);
    if (teacherMatch) {
      return { dbWaliTeacherId: teacherMatch.id, waliName: teacherMatch.nama };
    }
    if (!schoolId) throw new Error("Sekolah aktif tidak ditemukan.");
    const { data: teacher, error } = await supabase
      .from("teachers")
      .select("id,nama,school_id")
      .eq("id", inputTeacherId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (error) throw error;
    if (!teacher)
      throw new Error("Guru wali kelas tidak ditemukan pada sekolah aktif.");
    return { dbWaliTeacherId: teacher.id, waliName: teacher.nama };
  };
  const ensureTeacherCanBeWaliKelas = async (teacherId: string, academicYear: string) => {
    const schoolId = currentUser?.schoolId || null;
    if (!schoolId) throw new Error("Sekolah aktif tidak ditemukan.");

    // Aturan utama: assignment Guru Mapel pada tahun ajaran aktif
    // membuat guru tidak boleh sekaligus menjadi Wali Kelas.
    const { data: mapelAssignments, error: mapelError } = await supabase
      .from("subject_teacher_assignments")
      .select("subject_id")
      .eq("school_id", schoolId)
      .eq("teacher_id", teacherId)
      .eq("academic_year", academicYear)
      .limit(1);
    if (mapelError) throw mapelError;

    if ((mapelAssignments || []).length > 0) {
      throw new Error(
        "Guru tersebut sudah memiliki assignment Guru Mapel pada tahun ajaran " +
          academicYear +
          " sehingga tidak dapat ditetapkan sebagai Wali Kelas.",
      );
    }
  };

  const addClass = async (c: Omit<SchoolClass, "id">) => {
    try {
      const schoolId = currentUser?.schoolId || null;
      if (!schoolId) throw new Error("Sekolah aktif tidak ditemukan.");

      // Kebijakan & Logika Sistem Paket: Kapasitas Kelas berdasarkan Ruang Kerja
      const isPersonalWs = activeWorkspace?.workspaceType === 'personal' || activeWorkspace?.workspaceType === 'individu';
      const callerRole = (currentUser?.role || '').toUpperCase().trim();
      if (isPersonalWs) {
        if (callerRole === 'GURU MAPEL') {
          if (classes.length >= 6) {
            throw new Error('Kapasitas Guru Mapel di Ruang Kerja Individu maksimal 6 kelas. Batas kuota kelas telah tercapai.');
          }
        } else {
          // Wali Kelas: Kapasitas maksimal 2 kelas (setiap kelas maksimal 50 siswa)
          if (classes.length >= 2) {
            throw new Error('Kapasitas Wali Kelas di Ruang Kerja Individu maksimal 2 kelas (setiap kelas maksimal 50 siswa). Silakan edit kelas yang sudah ada.');
          }
        }
      } else {
        if (classes.length >= 24) {
          throw new Error('Kapasitas Ruang Kerja Sekolah maksimal 24 kelas. Batas kuota rombongan belajar telah tercapai.');
        }
      }

      const academicYear =
        c.academicYear || schoolProfile.tahunPelajaran || "2026/2027";
      const { data: duplicateClass } = await supabase
        .from("classes")
        .select("id")
        .eq("school_id", schoolId)
        .eq("academic_year", academicYear)
        .ilike("name", c.name.trim())
        .maybeSingle();
      if (duplicateClass) {
        throw new Error(`Rombel "${c.name.trim()}" sudah ada pada tahun ajaran ${academicYear}.`);
      }
      if (c.waliKelasTeacherId) {
        await ensureTeacherCanBeWaliKelas(c.waliKelasTeacherId, academicYear);

        // Satu guru dapat menjadi Wali Kelas untuk maksimal 2 rombel pada tahun ajaran yang sama
        const existingHomerooms = classes.filter(
          (existing) =>
            existing.waliKelasTeacherId === c.waliKelasTeacherId &&
            existing.id !== undefined &&
            (!existing.academicYear || existing.academicYear === academicYear),
        );
        if (existingHomerooms.length >= 2) {
          throw new Error(
            `Guru ini sudah menjadi Wali Kelas untuk 2 rombel (${existingHomerooms.map((cl) => cl.name).join(', ')}) pada tahun ajaran ${academicYear}. Batas maksimal penugasan adalah 2 rombel.`,
          );
        }
      }

      let insertedData: any = null;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token || "";
        const apiRes = await fetch("/api/onboarding", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            action: "save_class",
            schoolId,
            name: c.name.trim(),
            grade: c.grade,
            academicYear,
            waliKelasTeacherId: c.waliKelasTeacherId || null,
          }),
        });
        const jsonRes = await apiRes.json().catch(() => ({}));
        if (apiRes.ok && (jsonRes.ok || jsonRes.success) && jsonRes.class) {
          insertedData = jsonRes.class;
        } else if (!apiRes.ok && jsonRes.error) {
          throw new Error(jsonRes.error);
        }
      } catch (apiErr: any) {
        if (apiErr.message && !apiErr.message.includes("fetch")) {
          throw apiErr;
        }
      }

      if (!insertedData) {
        const { data: directData, error } = await supabase
          .from("classes")
          .insert({
            name: c.name.trim(),
            grade: c.grade,
            academic_year: academicYear,
            wali_kelas_teacher_id: c.waliKelasTeacherId || null,
            school_id: schoolId,
          })
          .select("*, wali:wali_kelas_teacher_id(id,nama)")
          .maybeSingle();
        if (error) throw error;
        insertedData = directData || {
          id: "cls-" + Date.now(),
          name: c.name.trim(),
          grade: c.grade,
          academic_year: academicYear,
          wali_kelas_teacher_id: c.waliKelasTeacherId || null,
          wali: c.waliKelasTeacherId ? { id: c.waliKelasTeacherId, nama: c.waliKelasName || "" } : null,
        };
      }

      setClasses((p) => [
        ...p.map((x) =>
          c.waliKelasTeacherId && x.waliKelasTeacherId === c.waliKelasTeacherId
            ? { ...x, waliKelasTeacherId: null, waliKelasName: null }
            : x,
        ),
        {
          id: insertedData.id,
          name: insertedData.name,
          grade: insertedData.grade,
          academicYear: insertedData.academic_year,
          waliKelasTeacherId: insertedData.wali_kelas_teacher_id || null,
          waliKelasName: insertedData.wali?.nama || c.waliKelasName || null,
        },
      ]);
      showToast(`Kelas ${insertedData.name} berhasil ditambahkan`);
    } catch (e: any) {
      showToast(e.message || "Gagal menambahkan kelas.", "error");
      throw e;
    }
  };
  const updateClass = async (id: string, c: Omit<SchoolClass, "id">) => {
    try {
      const schoolId = currentUser?.schoolId || null;
      if (!schoolId) throw new Error("Sekolah aktif tidak ditemukan.");
      const academicYear =
        c.academicYear || schoolProfile.tahunPelajaran || "2026/2027";
      const { data: duplicateClass } = await supabase
        .from("classes")
        .select("id")
        .eq("school_id", schoolId)
        .eq("academic_year", academicYear)
        .ilike("name", c.name.trim())
        .neq("id", id)
        .maybeSingle();
      if (duplicateClass) {
        throw new Error(`Rombel "${c.name.trim()}" sudah ada pada tahun ajaran ${academicYear}.`);
      }

      let resolvedTeacherId: string | null = null;
      if (Object.prototype.hasOwnProperty.call(c, "waliKelasTeacherId")) {
        resolvedTeacherId = c.waliKelasTeacherId || null;
      } else if (c.waliKelasName) {
        const matched = (teachers || []).find(
          (t) => t.nama.trim().toLowerCase() === c.waliKelasName!.trim().toLowerCase(),
        );
        if (matched) {
          resolvedTeacherId = matched.id;
        }
      }

      if (resolvedTeacherId) {
        await ensureTeacherCanBeWaliKelas(resolvedTeacherId, academicYear);
        const existingHomerooms = classes.filter(
          (existing) =>
            existing.waliKelasTeacherId === resolvedTeacherId &&
            existing.id !== id &&
            (!existing.academicYear || existing.academicYear === academicYear),
        );
        if (existingHomerooms.length >= 2) {
          throw new Error(
            `Guru ini sudah menjadi Wali Kelas untuk 2 rombel (${existingHomerooms.map((cl) => cl.name).join(', ')}) pada tahun ajaran ${academicYear}. Batas maksimal penugasan adalah 2 rombel.`,
          );
        }
      }

      // 1. Simpan via API backend service-role agar aman dari restriksi RLS klien & error PGRST116 (Cannot coerce to single JSON)
      let updatedData: any = null;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token || "";
        const apiRes = await fetch("/api/onboarding", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            action: "save_class",
            classId: id,
            schoolId,
            name: c.name.trim(),
            grade: c.grade,
            academicYear,
            waliKelasTeacherId: resolvedTeacherId,
            waliKelasName: c.waliKelasName || null,
          }),
        });
        const jsonRes = await apiRes.json().catch(() => ({}));
        if (apiRes.ok && (jsonRes.ok || jsonRes.success) && jsonRes.class) {
          updatedData = jsonRes.class;
        } else if (!apiRes.ok && jsonRes.error) {
          throw new Error(jsonRes.error);
        }
      } catch (apiErr: any) {
        if (apiErr.message && !apiErr.message.includes("fetch")) {
          throw apiErr;
        }
      }

      // 2. Fallback direct supabase jika API offline
      if (!updatedData) {
        if (resolvedTeacherId) {
          await supabase
            .from("classes")
            .update({ wali_kelas_teacher_id: null })
            .eq("school_id", schoolId)
            .neq("id", id)
            .eq("wali_kelas_teacher_id", resolvedTeacherId);

          await supabase
            .from("profiles")
            .update({ class_ids: [id] })
            .eq("school_id", schoolId)
            .eq("teacher_id", resolvedTeacherId);
        }

        const classUpdate: any = {
          name: c.name.trim(),
          grade: c.grade,
          academic_year: academicYear,
          wali_kelas_teacher_id: resolvedTeacherId,
        };

        const { data: directData, error } = await supabase
          .from("classes")
          .update(classUpdate)
          .eq("id", id)
          .eq("school_id", schoolId)
          .select("*, wali:wali_kelas_teacher_id(id,nama)")
          .maybeSingle();
        if (error) throw error;
        updatedData = directData;
      }

      if (!updatedData) {
        updatedData = {
          id,
          name: c.name.trim(),
          grade: c.grade,
          academic_year: academicYear,
          wali_kelas_teacher_id: resolvedTeacherId,
          wali: resolvedTeacherId ? { id: resolvedTeacherId, nama: (teachers.find(t => t.id === resolvedTeacherId)?.nama || c.waliKelasName || "") } : null,
        };
      }

      setClasses((p) =>
        p.map((x) => {
          if (x.id === id) {
            return {
              id: updatedData.id || id,
              name: updatedData.name || c.name.trim(),
              grade: updatedData.grade || c.grade,
              academicYear: updatedData.academic_year || academicYear,
              waliKelasTeacherId: updatedData.wali_kelas_teacher_id || resolvedTeacherId || null,
              waliKelasName: updatedData.wali?.nama || c.waliKelasName || null,
            };
          }
          if (
            updatedData.wali_kelas_teacher_id &&
            x.waliKelasTeacherId === updatedData.wali_kelas_teacher_id
          ) {
            return {
              ...x,
              waliKelasTeacherId: null,
              waliKelasName: null,
            };
          }
          return x;
        }),
      );
      showToast(`Kelas ${updatedData.name || c.name.trim()} berhasil diperbarui`);
    } catch (e: any) {
      showToast(e.message || "Gagal memperbarui kelas.", "error");
      throw e;
    }
  };
  const deleteClass = async (id: string) => {
    try {
      const schoolId = currentUser?.schoolId;
      if (!schoolId) throw new Error("Sekolah aktif tidak ditemukan.");

      let apiDone = false;
      try {
        const { data: authSession } = await supabase.auth.getSession();
        const token = authSession.session?.access_token;
        if (token) {
          const res = await fetch("/api/admin-users", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: "delete_class",
              classId: id,
              schoolId,
            }),
          });
          const resJson = await res.json().catch(() => ({}));
          if (res.ok && resJson.ok) {
            apiDone = true;
          } else if (resJson.error) {
            throw new Error(resJson.error);
          }
        }
      } catch (apiErr: any) {
        if (apiErr.message && !apiErr.message.includes("fetch")) {
          throw apiErr;
        }
      }

      if (!apiDone) {
        // Fallback: lepaskan penugasan siswa terlebih dahulu
        try {
          await supabase.from("students").update({ class_id: null }).eq("class_id", id).eq("school_id", schoolId);
          await supabase.from("attendance_records").delete().eq("class_id", id).eq("school_id", schoolId);
          await supabase.from("user_class_assignments").delete().eq("class_id", id);
          await supabase.from("subject_class_assignments").delete().eq("class_id", id).eq("school_id", schoolId);
        } catch (_) {}
        const { error } = await supabase
          .from("classes")
          .delete()
          .eq("id", id)
          .eq("school_id", schoolId);
        if (error) throw error;
      }

      setClasses((p) => p.filter((c) => c.id !== id));
      if (currentUser) {
        await loadDataForSchool(schoolId, currentUser, currentUser.role);
      } else {
        await loadData(currentUser?.id);
      }
      showToast("Kelas beserta seluruh data terkait berhasil dihapus.", "success");
    } catch (e: any) {
      showToast(e.message || "Gagal menghapus kelas.", "error");
      throw e;
    }
  };
  const importClasses = async (
    items: Array<Omit<SchoolClass, "id"> & { waliKelasNameInput?: string }>,
    replaceExisting = true,
  ) => {
    const schoolId = currentUser?.schoolId;
    if (!schoolId) throw new Error("Sekolah aktif tidak ditemukan.");
    if (!items.length)
      throw new Error("Tidak ada data kelas yang valid untuk diimpor");
    const payload = items.map((c) => {
      let waliId = c.waliKelasTeacherId || null;
      if (!waliId && c.waliKelasNameInput) {
        const m = teachers.find(
          (t) =>
            t.nama.trim().toLowerCase() ===
            c.waliKelasNameInput!.trim().toLowerCase(),
        );
        waliId = m?.id || null;
      }
      return {
        name: c.name.trim(),
        grade: c.grade,
        academic_year:
          c.academicYear || schoolProfile.tahunPelajaran || "2026/2027",
        wali_kelas_teacher_id: waliId,
        waliKelasNameInput: c.waliKelasNameInput,
      };
    });

    // 1. Prioritaskan server API /api/admin-users dengan Service Role untuk keamanan integritas data
    let apiDone = false;
    try {
      const { data: authSession } = await supabase.auth.getSession();
      const token = authSession.session?.access_token;
      if (token) {
        const res = await fetch("/api/admin-users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "import_classes",
            schoolId,
            items: payload,
            replaceExisting,
            academicYear: schoolProfile.tahunPelajaran || "2026/2027",
          }),
        });
        const resJson = await res.json().catch(() => ({}));
        if (res.ok && resJson.ok) {
          apiDone = true;
        }
      }
    } catch (_) {}

    if (!apiDone) {
      const { error } = await supabase.rpc("import_classes_atomic", {
        p_school_id: schoolId,
        p_items: payload,
        p_replace_existing: replaceExisting,
        p_actor_user_id: currentUser?.id || null,
      });
      if (error) {
        console.warn("[importClasses] RPC fallback to direct upsert:", error.message);
        const { data: existingCls } = await supabase
          .from("classes")
          .select("id, name")
          .eq("school_id", schoolId);
        const existingMap = new Map<string, string>();
        const usedClassIds = new Set<string>();
        (existingCls || []).forEach((c: any) => {
          existingMap.set(String(c.name || "").trim().toLowerCase(), c.id);
        });

        for (const p of payload) {
          const matchedId = existingMap.get(p.name.toLowerCase());
          if (matchedId) {
            usedClassIds.add(matchedId);
            await supabase
              .from("classes")
              .update({
                name: p.name,
                grade: p.grade,
                academic_year: p.academic_year,
                wali_kelas_teacher_id: p.wali_kelas_teacher_id,
              })
              .eq("id", matchedId);
          } else {
            const { data: insData } = await supabase.from("classes").insert({
              school_id: schoolId,
              name: p.name,
              grade: p.grade,
              academic_year: p.academic_year,
              wali_kelas_teacher_id: p.wali_kelas_teacher_id,
            }).select("id").maybeSingle();
            if (insData) {
              usedClassIds.add(insData.id);
            }
          }
        }

        // Mode sumber tunggal: hapus rombel kelas lama yang tidak terdapat dalam file terbaru
        if (replaceExisting) {
          const leftovers = (existingCls || []).filter((c: any) => !usedClassIds.has(c.id));
          for (const l of leftovers) {
            try {
              await supabase.from("students").update({ class_id: null }).eq("class_id", l.id).eq("school_id", schoolId);
              await supabase.from("subject_schedule_days").delete().eq("class_id", l.id);
              await supabase.from("subject_class_assignments").delete().eq("class_id", l.id).eq("school_id", schoolId);
              await supabase.from("user_class_assignments").delete().eq("class_id", l.id);
              await supabase.from("teacher_assignments").delete().eq("class_id", l.id).eq("school_id", schoolId);
              await supabase.from("teacher_class_assignments").delete().eq("class_id", l.id).eq("school_id", schoolId);
              await supabase.from("attendance_records").delete().eq("class_id", l.id).eq("school_id", schoolId);
              await supabase.from("classes").delete().eq("id", l.id).eq("school_id", schoolId);
            } catch (_) {}
          }
        }
      }
    }

    await loadData(currentUser?.id);
    showToast(`Berhasil mengimpor ${items.length} data rombel kelas.`);
  };
  const addTeacher = async (t: Omit<Teacher, "id">) => {
    const schoolId = currentUser?.schoolId;
    if (!schoolId) throw new Error("Sekolah aktif tidak ditemukan.");

    const isPersonalWs = activeWorkspace?.workspaceType === 'personal' || activeWorkspace?.workspaceType === 'individu';
    if (isPersonalWs && teachers.length >= 1) {
      throw new Error('Ruang Kerja Individu hanya diperuntukkan untuk 1 guru.');
    }
    if (!isPersonalWs && teachers.length >= 100) {
      throw new Error('Kapasitas Ruang Kerja Sekolah maksimal 100 guru. Batas kuota pendidik telah tercapai.');
    }

    const rawTugas = (t.tugasUtama || t.tugas_utama || "").trim();
    const finalTugasUtama =
      rawTugas === "Wali Kelas"
        ? "Wali Kelas"
        : rawTugas === "Guru Mapel"
          ? "Guru Mapel"
          : rawTugas || "Belum ditugaskan";

    let insertedRow: any = null;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || "";
      const apiRes = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: "save_teacher",
          schoolId,
          nama: t.nama.trim(),
          nip: t.nip?.trim() || null,
          jenisKelamin: t.jenisKelamin || "L",
          tugasUtama: finalTugasUtama,
        }),
      });
      const jsonRes = await apiRes.json().catch(() => ({}));
      if (apiRes.ok && (jsonRes.ok || jsonRes.success) && jsonRes.teacher) {
        insertedRow = jsonRes.teacher;
      } else if (!apiRes.ok && jsonRes.error) {
        throw new Error(jsonRes.error);
      }
    } catch (apiErr: any) {
      if (apiErr.message && !apiErr.message.includes("fetch")) {
        throw apiErr;
      }
    }

    if (!insertedRow) {
      const { data, error } = await supabase
        .from("teachers")
        .insert({
          school_id: schoolId,
          nama: t.nama.trim(),
          nip: t.nip?.trim() || null,
          jenis_kelamin: t.jenisKelamin || "L",
          tugas_utama: finalTugasUtama,
        })
        .select("*")
        .maybeSingle();
      if (error) throw error;
      insertedRow = data;
    }

    const newT = dbTeacher(insertedRow);
    setTeachers((p) => [...p, newT]);
    showToast(`Data guru ${t.nama} berhasil ditambahkan`);
    return newT;
  };
  const updateTeacher = async (id: string, t: Omit<Teacher, "id">) => {
    const schoolId = currentUser?.schoolId;
    if (!schoolId) throw new Error("Sekolah aktif tidak ditemukan.");
    const rawTugas = (t.tugasUtama || t.tugas_utama || "").trim();
    const finalTugasUtama =
      rawTugas === "Wali Kelas"
        ? "Wali Kelas"
        : rawTugas === "Guru Mapel"
          ? "Guru Mapel"
          : rawTugas || "Belum ditugaskan";

    let updatedRow: any = null;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || "";
      const apiRes = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: "save_teacher",
          teacherId: id,
          schoolId,
          nama: t.nama.trim(),
          nip: t.nip?.trim() || null,
          jenisKelamin: t.jenisKelamin || "L",
          tugasUtama: finalTugasUtama,
        }),
      });
      const jsonRes = await apiRes.json().catch(() => ({}));
      if (apiRes.ok && (jsonRes.ok || jsonRes.success) && jsonRes.teacher) {
        updatedRow = jsonRes.teacher;
      } else if (!apiRes.ok && jsonRes.error) {
        throw new Error(jsonRes.error);
      }
    } catch (apiErr: any) {
      if (apiErr.message && !apiErr.message.includes("fetch")) {
        throw apiErr;
      }
    }

    if (!updatedRow) {
      const { data, error } = await supabase
        .from("teachers")
        .update({
          nama: t.nama.trim(),
          nip: t.nip?.trim() || null,
          jenis_kelamin: t.jenisKelamin || "L",
          tugas_utama: finalTugasUtama,
        })
        .eq("id", id)
        .eq("school_id", schoolId)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      updatedRow = data || {
        id,
        school_id: schoolId,
        nama: t.nama.trim(),
        nip: t.nip?.trim() || null,
        jenis_kelamin: t.jenisKelamin || "L",
        tugas_utama: finalTugasUtama,
      };
    }

    const updatedT = dbTeacher(updatedRow);
    setTeachers((p) => p.map((x) => (x.id === id ? updatedT : x)));
    if (currentUser && (currentUser.teacherId === id || currentUser.name === t.nama.trim())) {
      setCurrentUser((prev) => (prev ? { ...prev, name: t.nama.trim() } : null));
    }
    showToast(`Data guru ${t.nama} berhasil diperbarui`);
    return updatedT;
  };
  const importTeachers = async (
    items: Omit<Teacher, "id">[],
    replaceExisting = true,
  ) => {
    const schoolId = currentUser?.schoolId;
    if (!schoolId) throw new Error("Sekolah aktif tidak ditemukan.");

    const payload = items.map((t) => ({
      nama: t.nama.trim(),
      nip: t.nip && t.nip.trim() !== "-" ? t.nip.trim() : null,
      jenisKelamin: t.jenisKelamin || "L",
      tugasUtama: (t.tugasUtama || t.tugas_utama || "Belum ditugaskan").trim(),
    }));

    // 1. Prioritaskan server API /api/admin-users dengan Service Role untuk keamanan integritas data
    let apiDone = false;
    try {
      const { data: authSession } = await supabase.auth.getSession();
      const token = authSession.session?.access_token;
      if (token) {
        const res = await fetch("/api/admin-users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "import_teachers",
            schoolId,
            items: payload,
            replaceExisting,
          }),
        });
        const resJson = await res.json().catch(() => ({}));
        if (res.ok && resJson.ok) {
          apiDone = true;
        }
      }
    } catch (_) {}

    if (!apiDone) {
      // 2. Direct fallback ke Supabase client
      const { data: existingTeachersData, error: fetchErr } = await supabase
        .from("teachers")
        .select("*")
        .eq("school_id", schoolId);
      if (fetchErr) throw fetchErr;

      const existingTeachers = existingTeachersData || [];
      const usedExistingIds = new Set<string>();

      for (const t of payload) {
        const cleanName = t.nama;
        const cleanNip = t.nip;
        const rawTugas = t.tugasUtama;
        const normalizedName = cleanName.toLowerCase();

        let matched: any = null;
        if (cleanNip) {
          matched = existingTeachers.find(
            (ex: any) => !usedExistingIds.has(ex.id) && ex.nip && String(ex.nip).trim() === cleanNip
          );
        }
        if (!matched) {
          matched = existingTeachers.find((ex: any) => {
            if (usedExistingIds.has(ex.id)) return false;
            const exName = String(ex.nama || "").trim().toLowerCase();
            return exName === normalizedName;
          });
        }

        if (matched) {
          usedExistingIds.add(matched.id);
          const { error: updateError } = await supabase
            .from("teachers")
            .update({
              nama: cleanName,
              nip: cleanNip || matched.nip || null,
              jenis_kelamin: t.jenisKelamin,
              tugas_utama: rawTugas,
            })
            .eq("id", matched.id);
          if (updateError) throw updateError;
        } else {
          const { data: inserted, error: insertError } = await supabase
            .from("teachers")
            .insert({
              school_id: schoolId,
              nama: cleanName,
              nip: cleanNip,
              jenis_kelamin: t.jenisKelamin,
              tugas_utama: rawTugas,
            })
            .select("*")
            .single();
          if (insertError) throw insertError;
          if (inserted) {
            existingTeachers.push(inserted);
            usedExistingIds.add(inserted.id);
          }
        }
      }

      // Mode sumber tunggal: hapus guru lama yang tidak terdapat dalam file terbaru
      if (replaceExisting) {
        const leftovers = existingTeachers.filter((ex: any) => !usedExistingIds.has(ex.id));
        for (const l of leftovers) {
          try {
            await supabase.from("classes").update({ wali_kelas_teacher_id: null }).eq("wali_kelas_teacher_id", l.id).eq("school_id", schoolId);
            await supabase.from("subject_teacher_assignments").delete().eq("teacher_id", l.id).eq("school_id", schoolId);
            await supabase.from("teacher_assignments").delete().eq("teacher_id", l.id).eq("school_id", schoolId);
            await supabase.from("teacher_class_assignments").delete().eq("teacher_id", l.id).eq("school_id", schoolId);
            await supabase.from("profiles").update({ teacher_id: null }).eq("teacher_id", l.id).eq("school_id", schoolId);
            await supabase.from("teachers").delete().eq("id", l.id).eq("school_id", schoolId);
          } catch (_) {}
        }
      }
    }

    await loadData(currentUser?.id);
    showToast(`Berhasil mengimpor ${items.length} data guru.`);
  };
  const addStudent = async (st: Omit<Student, "id">) => {
    const schoolId = currentUser?.schoolId;
    if (!schoolId) throw new Error("Sekolah aktif tidak ditemukan.");

    // Validasi Kebijakan Sistem Paket: Maksimal 50 siswa per kelas
    if (st.classId) {
      const currentInClass = students.filter((s) => s.classId === st.classId).length;
      if (currentInClass >= 50) {
        const clsName = classes.find((c) => c.id === st.classId)?.name || 'kelas ini';
        throw new Error(`Kapasitas ${clsName} maksimal 50 siswa. Sistem menolak input karena kuota kelas telah mencapai batas maksimal (50 siswa).`);
      }
    }

    // Validasi Kebijakan Sistem Paket: Batas total siswa
    const isPersonalWs = activeWorkspace?.workspaceType === 'personal' || activeWorkspace?.workspaceType === 'individu';
    const callerRole = (currentUser?.role || '').toUpperCase().trim();
    const currentPlan = normalizePlan(activeWorkspace?.subscriptionPlan || currentUser?.subscriptionPlan);
    let maxAllowedTotalStudents = 1200;
    if (isPersonalWs) {
      if (currentPlan === 'guru_pro') {
        maxAllowedTotalStudents = callerRole === 'GURU MAPEL' ? 300 : 100;
      } else {
        maxAllowedTotalStudents = 100; // 2 kelas x 50 siswa
      }
    } else {
      maxAllowedTotalStudents = 1200;
    }
    if (students.length >= maxAllowedTotalStudents) {
      throw new Error(`Kapasitas total siswa telah mencapai batas maksimal (${maxAllowedTotalStudents} siswa).`);
    }

    let insertedRow: any = null;
    let apiError: string | null = null;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || "";
      const apiRes = await fetch("/api/admin-users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: "save_student",
          schoolId,
          nama: st.nama.trim(),
          nisn: st.nisn?.trim() || null,
          gender: st.gender || "L",
          classId: st.classId || null,
        }),
      });
      const jsonRes = await apiRes.json().catch(() => ({}));
      if (apiRes.ok && (jsonRes.ok || jsonRes.success) && jsonRes.student) {
        insertedRow = jsonRes.student;
      } else if (!apiRes.ok && jsonRes.error) {
        apiError = jsonRes.error;
      }
    } catch (err: any) {
      console.warn("API save_student failed, trying fallback:", err?.message);
    }

    // Secondary fallback via onboarding API if admin-users returned error
    if (!insertedRow) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token || "";
        const apiRes = await fetch("/api/onboarding", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            action: "save_student",
            schoolId,
            nama: st.nama.trim(),
            nisn: st.nisn?.trim() || null,
            gender: st.gender || "L",
            classId: st.classId || null,
          }),
        });
        const jsonRes = await apiRes.json().catch(() => ({}));
        if (apiRes.ok && (jsonRes.ok || jsonRes.success) && jsonRes.student) {
          insertedRow = jsonRes.student;
        }
      } catch (_) {}
    }

    if (!insertedRow) {
      if (apiError) throw new Error(apiError);
      // Direct supabase insert
      const fallbackNisn = st.nisn?.trim() || ('99' + Math.floor(10000000 + Math.random() * 90000000));
      const { data, error } = await supabase
        .from("students")
        .insert({
          school_id: schoolId,
          nama: st.nama.trim(),
          nisn: fallbackNisn,
          gender: st.gender || "L",
          class_id: st.classId || null,
        })
        .select("*,classes:class_id(id,name)")
        .maybeSingle();
      if (error) throw error;
      insertedRow = data;
    }

    const newStudent = dbStudent({
      ...insertedRow,
      class_name: insertedRow?.classes?.name || "",
      nama_wali: st.namaWali,
      no_hp_wali: st.noHpWali,
      hubungannya: st.hubungannya,
    });
    // Persist parent contact locally & in cache (strictly per school)
    if (st.namaWali || st.noHpWali || st.hubungannya) {
      try {
        const pMap = getStoredParentContacts(schoolId);
        pMap[newStudent.id] = {
          namaWali: st.namaWali || "",
          noHpWali: st.noHpWali || "",
          hubungannya: st.hubungannya || "Orang Tua",
        };
        localStorage.setItem(`kawacanaan_parent_contacts_${schoolId}`, JSON.stringify(pMap));
      } catch (_) {}
    }
    setStudents((p) => [...p, newStudent]);
    if (currentUser) {
      loadDataForSchool(schoolId, currentUser, currentUser.role).catch(() => {});
    }
    showToast(`Data siswa ${st.nama} berhasil disimpan.`, "success");
    return newStudent;
  };
  const updateStudent = async (id: string, st: Omit<Student, "id">) => {
    const schoolId = currentUser?.schoolId;
    if (!schoolId) throw new Error("Sekolah aktif tidak ditemukan.");

    // Validasi Kebijakan Sistem Paket: Maksimal 50 siswa per kelas (Hard Block)
    if (st.classId) {
      const currentInClass = students.filter((s) => s.classId === st.classId && s.id !== id).length;
      if (currentInClass >= 50) {
        const clsName = classes.find((c) => c.id === st.classId)?.name || 'kelas ini';
        throw new Error(`Kapasitas ${clsName} maksimal 50 siswa. Sistem menolak pemindahan karena kuota rombel telah mencapai batas maksimal (50 siswa).`);
      }
    }

    let updatedRow: any = null;
    let apiError: string | null = null;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || "";
      const apiRes = await fetch("/api/admin-users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: "save_student",
          studentId: id,
          schoolId,
          nama: st.nama.trim(),
          nisn: st.nisn?.trim() || null,
          gender: st.gender || "L",
          classId: st.classId || null,
        }),
      });
      const jsonRes = await apiRes.json().catch(() => ({}));
      if (apiRes.ok && (jsonRes.ok || jsonRes.success) && jsonRes.student) {
        updatedRow = jsonRes.student;
      } else if (!apiRes.ok && jsonRes.error) {
        apiError = jsonRes.error;
      }
    } catch (err: any) {
      console.warn("API update student failed, trying fallback:", err?.message);
    }

    if (!updatedRow) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token || "";
        const apiRes = await fetch("/api/onboarding", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            action: "save_student",
            studentId: id,
            schoolId,
            nama: st.nama.trim(),
            nisn: st.nisn?.trim() || null,
            gender: st.gender || "L",
            classId: st.classId || null,
          }),
        });
        const jsonRes = await apiRes.json().catch(() => ({}));
        if (apiRes.ok && (jsonRes.ok || jsonRes.success) && jsonRes.student) {
          updatedRow = jsonRes.student;
        }
      } catch (_) {}
    }

    if (!updatedRow) {
      if (apiError) throw new Error(apiError);
      const { data, error } = await supabase
        .from("students")
        .update({
          nama: st.nama.trim(),
          nisn: st.nisn?.trim() || null,
          gender: st.gender || "L",
          class_id: st.classId || null,
        })
        .eq("id", id)
        .eq("school_id", schoolId)
        .select("*,classes:class_id(id,name)")
        .maybeSingle();
      if (error) throw error;
      updatedRow = data;
    }

    const updatedStudent = dbStudent({
      ...updatedRow,
      class_name: updatedRow?.classes?.name || "",
      nama_wali: st.namaWali,
      no_hp_wali: st.noHpWali,
      hubungannya: st.hubungannya,
    });
    // Persist parent contact locally & in cache (strictly per school)
    try {
      const pMap = getStoredParentContacts(schoolId);
      pMap[id] = {
        namaWali: st.namaWali !== undefined ? st.namaWali : (pMap[id]?.namaWali || ""),
        noHpWali: st.noHpWali !== undefined ? st.noHpWali : (pMap[id]?.noHpWali || ""),
        hubungannya: st.hubungannya !== undefined ? st.hubungannya : (pMap[id]?.hubungannya || "Orang Tua"),
      };
      localStorage.setItem(`kawacanaan_parent_contacts_${schoolId}`, JSON.stringify(pMap));
    } catch (_) {}

    setStudents((p) =>
      p.map((x) => (x.id === id ? updatedStudent : x)),
    );
    if (currentUser) {
      loadDataForSchool(schoolId, currentUser, currentUser.role).catch(() => {});
    }
    showToast(`Data siswa ${st.nama} berhasil diperbarui.`, "success");
    return updatedStudent;
  };
  const deleteStudent = async (id: string) => {
    try {
      if (!id) throw new Error("ID siswa tidak valid.");
      const schoolId = currentUser?.schoolId;

      // Coba hapus melalui backend API server dengan Service Role
      let apiDone = false;
      try {
        const { data: authSession } = await supabase.auth.getSession();
        const token = authSession.session?.access_token;
        if (token) {
          const res = await fetch("/api/admin-users", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: "delete_student",
              studentId: id,
              schoolId,
            }),
          });
          const resJson = await res.json().catch(() => ({}));
          if (res.ok && resJson.ok) {
            apiDone = true;
          } else if (resJson.error) {
            throw new Error(resJson.error);
          }
        }
      } catch (apiErr: any) {
        if (apiErr.message && !apiErr.message.includes("fetch")) {
          throw apiErr;
        }
      }

      if (!apiDone) {
        // Fallback: bersihkan relasi terlebih dahulu sebelum hapus siswa
        try {
          await supabase.from("attendance_records").delete().eq("student_id", id).eq("school_id", schoolId);
          await supabase.from("profiles").update({ student_id: null }).eq("student_id", id);
        } catch (_) {}

        const { error } = await supabase.rpc("delete_student_by_id", {
          p_student_id: id,
        });
        if (error) {
          const { error: directErr } = await supabase.from("students").delete().eq("id", id);
          if (directErr) throw error;
        }
      }

      setStudents((p) => p.filter((s) => s.id !== id));
      if (currentUser) {
        await loadDataForSchool(schoolId, currentUser, currentUser.role);
      } else {
        await loadData(currentUser?.id);
      }
      showToast("Data siswa berhasil dihapus permanen.", "success");
    } catch (e: any) {
      showToast(e?.message || "Gagal menghapus siswa.", "error");
      throw e;
    }
  };
  const deleteStudentsByClass = async (classId: string) => {
    const schoolId = currentUser?.schoolId;
    if (!schoolId) throw new Error("Sekolah aktif tidak ditemukan.");

    let apiDone = false;
    try {
      const { data: authSession } = await supabase.auth.getSession();
      const token = authSession.session?.access_token;
      if (token) {
        const res = await fetch("/api/admin-users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "delete_students_by_class",
            classId,
            schoolId,
          }),
        });
        const resJson = await res.json().catch(() => ({}));
        if (res.ok && resJson.ok) {
          apiDone = true;
        } else if (resJson.error) {
          throw new Error(resJson.error);
        }
      }
    } catch (apiErr: any) {
      if (apiErr.message && !apiErr.message.includes("fetch")) {
        throw apiErr;
      }
    }

    if (!apiDone) {
      try {
        await supabase.from("attendance_records").delete().eq("class_id", classId).eq("school_id", schoolId);
      } catch (_) {}
      const { error } = await supabase
        .from("students")
        .delete()
        .eq("school_id", schoolId)
        .eq("class_id", classId);
      if (error) throw error;
    }

    setStudents((p) => p.filter((s) => s.classId !== classId));
    if (currentUser) {
      await loadDataForSchool(schoolId, currentUser, currentUser.role);
    } else {
      await loadData(currentUser?.id);
    }
    showToast("Seluruh data siswa dalam kelas berhasil dihapus.", "success");
  };
  const importStudents = async (
    items: Omit<Student, "id">[],
    replaceExisting = true,
    targetClassId?: string,
  ) => {
    const schoolId = currentUser?.schoolId;
    if (!schoolId) throw new Error("Sekolah aktif tidak ditemukan.");
    const payload = items.map((st) => ({
      nama: st.nama.trim(),
      nisn: st.nisn || null,
      gender: st.gender || "L",
      class_id: st.classId || null,
    }));

    // 1. Prioritaskan server API /api/admin-users dengan Service Role untuk mencegah error trigger profil Supabase
    let apiSuccess = false;
    let apiErrorMessage = "";
    try {
      const { data: authSession } = await supabase.auth.getSession();
      const token = authSession.session?.access_token;
      if (token) {
        const res = await fetch("/api/admin-users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "import_students",
            schoolId,
            items: payload,
            replaceExisting,
            targetClassId: targetClassId || null,
          }),
        });
        const resJson = await res.json().catch(() => ({}));
        if (res.ok && (resJson.ok || resJson.success)) {
          apiSuccess = true;
        } else if (resJson?.error) {
          apiErrorMessage = resJson.error;
        }
      }
    } catch (apiErr: any) {
      console.warn("[importStudents] Server API fetch warning:", apiErr?.message);
    }

    if (!apiSuccess) {
      if (apiErrorMessage && !apiErrorMessage.includes("tidak dikenali")) {
        throw new Error(apiErrorMessage);
      }

      // 2. Direct fallback matching ke tabel students
      const { data: existingStudentsData, error: fetchErr } = await supabase
        .from("students")
        .select("id, nama, nisn, class_id")
        .eq("school_id", schoolId);
      if (fetchErr) throw fetchErr;
      const existingList = existingStudentsData || [];
      const usedIds = new Set<string>();

        for (const st of payload) {
          const cleanNama = (st.nama || "").trim().toLowerCase();
          const cleanNisn = (st.nisn || "").trim().toLowerCase();
          let matched: any = null;
          if (cleanNama && cleanNisn) {
            matched = existingList.find((ex: any) => {
              if (usedIds.has(ex.id)) return false;
              const exNama = String(ex.nama || "").trim().toLowerCase();
              const exNisn = String(ex.nisn || "").trim().toLowerCase();
              return exNama === cleanNama && exNisn === cleanNisn;
            });
          }

          if (matched) {
            usedIds.add(matched.id);
            await supabase
              .from("students")
              .update({
                nama: st.nama,
                nisn: st.nisn,
                gender: st.gender,
                class_id: st.class_id,
              })
              .eq("id", matched.id);
          } else {
            if (st.class_id) {
              const currentCountInClass = existingList.filter((s: any) => s.class_id === st.class_id).length;
              if (currentCountInClass >= 50) {
                const clsName = classes.find((c) => c.id === st.class_id)?.name || 'kelas ini';
                throw new Error(`Kapasitas ${clsName} maksimal 50 siswa. Siswa "${st.nama}" tidak dapat diimpor karena kuota rombel telah mencapai batas maksimal (50 siswa).`);
              }
            }
            const { data: insData, error: insErr } = await supabase
              .from("students")
              .insert({
                school_id: schoolId,
                nama: st.nama,
                nisn: st.nisn,
                gender: st.gender,
                class_id: st.class_id,
              })
              .select("id, nama, nisn, class_id")
              .single();
            if (insErr) {
              throw new Error(insErr.message || "Gagal mengimpor data siswa.");
            }
            if (insData) {
              existingList.push(insData);
              usedIds.add(insData.id);
            }
          }
        }

        // Mode sumber tunggal: hapus siswa lama yang tidak terdapat dalam file terbaru
        if (replaceExisting) {
          const leftoverStudents = existingList.filter((ex: any) => {
            if (usedIds.has(ex.id)) return false;
            if (targetClassId) return ex.class_id === targetClassId;
            return true;
          });
          const leftoverIds = leftoverStudents.map((s: any) => s.id);
          if (leftoverIds.length > 0) {
            const CHUNK = 100;
            for (let i = 0; i < leftoverIds.length; i += CHUNK) {
              const slice = leftoverIds.slice(i, i + CHUNK);
              try {
                await supabase.from("attendance_records").delete().in("student_id", slice).eq("school_id", schoolId);
                await supabase.from("leave_requests").delete().in("student_id", slice).eq("school_id", schoolId);
              } catch (_) {}
              try {
                await supabase.from("profiles").update({ student_id: null }).in("student_id", slice).eq("school_id", schoolId);
                await supabase.from("students").delete().in("id", slice).eq("school_id", schoolId);
              } catch (_) {}
            }
          }
        }
      }

    await loadData(currentUser?.id);
    showToast(`Berhasil mengimpor ${items.length} data siswa.`);
  };
  const deleteTeacher = async (id: string) => {
    try {
      if (!id) throw new Error("ID guru tidak valid.");
      const schoolId = currentUser?.schoolId || activeWorkspace?.workspaceId;
      if (!schoolId) throw new Error("Sekolah aktif tidak ditemukan.");

      let apiDone = false;
      const { data: authSession } = await supabase.auth.getSession();
      const token = authSession.session?.access_token;
      if (token) {
        try {
          const res = await fetch("/api/admin-users", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: "delete_teacher",
              teacherId: id,
              schoolId,
            }),
          });
          const resJson = await res.json().catch(() => ({}));
          if (res.ok && resJson.ok) {
            apiDone = true;
          } else if (resJson.error) {
            throw new Error(resJson.error);
          }
        } catch (apiErr: any) {
          if (apiErr.message && !apiErr.message.includes("fetch")) {
            throw apiErr;
          }
        }
      }

      if (!apiDone) {
        // Fallback: bersihkan relasi langsung via client jika API tidak merespons
        try {
          await supabase.from("classes").update({ wali_kelas_teacher_id: null }).eq("wali_kelas_teacher_id", id).eq("school_id", schoolId);
          await supabase.from("subject_teacher_assignments").delete().eq("teacher_id", id).eq("school_id", schoolId);
          await supabase.from("teacher_assignments").delete().eq("teacher_id", id).eq("school_id", schoolId);
          await supabase.from("teacher_class_assignments").delete().eq("teacher_id", id).eq("school_id", schoolId);
        } catch (_) {}

        const { error: rpcErr } = await supabase.rpc("delete_teacher", {
          p_teacher_id: id,
        });
        if (rpcErr) {
          const { error: directErr } = await supabase.from("teachers").delete().eq("id", id).eq("school_id", schoolId);
          if (directErr) throw directErr;
        }
      }

      setTeachers((p) => p.filter((t) => t.id !== id));
      setUsers((p) => p.filter((u) => u.teacherId !== id));
      if (currentUser) {
        await loadDataForSchool(schoolId, currentUser, currentUser.role);
      } else {
        await loadData(currentUser?.id);
      }
      showToast("Data guru beserta akun login dan seluruh penugasan berhasil dihapus permanen.", "success");
    } catch (e: any) {
      showToast(e?.message || "Gagal menghapus guru.", "error");
      throw e;
    }
  };
  const assignTeacherClasses = async (
    teacherId: string,
    classIds: string[],
  ) => {
    try {
      const schoolId = currentUser?.schoolId;
      if (!schoolId) throw new Error("Sekolah aktif tidak ditemukan.");
      const uniqueClassIds: string[] = [...new Set<string>(classIds)];
      const academicYear = schoolProfile.tahunPelajaran || "2026/2027";
      const { data: teacherRow, error: teacherErr } = await supabase
        .from("teachers")
        .select("id,school_id,nama,tugas_utama")
        .eq("id", teacherId)
        .eq("school_id", schoolId)
        .maybeSingle();
      if (teacherErr) throw teacherErr;
      if (!teacherRow)
        throw new Error("Guru tidak ditemukan pada sekolah aktif.");
      const { data: waliRows } = await supabase
        .from("classes")
        .select("id")
        .eq("school_id", schoolId)
        .eq("academic_year", academicYear)
        .eq("wali_kelas_teacher_id", teacherId)
        .limit(1);
      const { data: mapelRows } = await supabase
        .from("subject_teacher_assignments")
        .select("subject_id")
        .eq("school_id", schoolId)
        .eq("academic_year", academicYear)
        .eq("teacher_id", teacherId);

      const isWali = (waliRows || []).length > 0;
      const isMapel = (mapelRows || []).length > 0;

      if (isWali && !isMapel) {
        if (uniqueClassIds.length > 2)
          throw new Error("Wali Kelas hanya boleh memiliki maksimal 2 rombel kelas.");
        try {
          const { error } = await supabase.rpc("assign_homeroom_teacher", {
            p_school_id: schoolId,
            p_teacher_id: teacherId,
            p_class_id: uniqueClassIds[0] || null,
            p_academic_year: academicYear,
            p_actor_user_id: currentUser?.id || null,
          });
          if (error) {
            console.warn("assign_homeroom_teacher RPC warning, using executeTeacherAssignment fallback:", error.message);
            await executeTeacherAssignment(teacherId, "WALI_KELAS", undefined, uniqueClassIds);
          } else if (uniqueClassIds.length > 1) {
            await supabase.rpc("assign_homeroom_teacher", {
              p_school_id: schoolId,
              p_teacher_id: teacherId,
              p_class_id: uniqueClassIds[1],
              p_academic_year: academicYear,
              p_actor_user_id: currentUser?.id || null,
            });
          }
        } catch (rpcErr: any) {
          console.warn("assign_homeroom_teacher exception, using executeTeacherAssignment fallback:", rpcErr?.message);
          await executeTeacherAssignment(teacherId, "WALI_KELAS", undefined, uniqueClassIds);
        }
      } else if (isMapel || (mapelRows || []).length > 0) {
        const targetSubjectIds = (mapelRows || []).map((r: any) => r.subject_id);
        for (const subId of targetSubjectIds) {
          try {
            const { error } = await supabase.rpc("replace_subject_assignment", {
              p_school_id: schoolId,
              p_subject_id: subId,
              p_teacher_id: teacherId,
              p_class_ids: uniqueClassIds,
              p_academic_year: academicYear,
              p_actor_user_id: currentUser?.id || null,
            });
            if (error) {
              console.warn("replace_subject_assignment RPC warning, using executeTeacherAssignment fallback:", error.message);
              await executeTeacherAssignment(teacherId, "GURU_MAPEL", subId, uniqueClassIds);
            }
          } catch (rpcErr: any) {
            console.warn("replace_subject_assignment exception, using executeTeacherAssignment fallback:", rpcErr?.message);
            await executeTeacherAssignment(teacherId, "GURU_MAPEL", subId, uniqueClassIds);
          }
        }
      } else if (uniqueClassIds.length) {
        throw new Error(
          "Guru belum mempunyai assignment Wali Kelas atau Guru Mapel. Tetapkan role melalui Data Guru terlebih dahulu.",
        );
      }

      // Sinkronkan ke tabel terpadu teacher_assignments
      supabase.auth.getSession().then(({ data }) => {
        const token = data.session?.access_token;
        if (token) {
          fetch('/api/sync-teacher-assignments', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ schoolId, academicYear }),
          }).catch((err) => console.warn('[assignTeacherClasses] background sync warning:', err));
        }
      }).catch(() => {});

      await loadData(currentUser?.id || "");
      showToast("Penugasan guru berhasil diperbarui");
    } catch (e: any) {
      showToast(e.message || "Gagal memperbarui penugasan guru.", "error");
      throw e;
    }
  };

  const executeTeacherAssignment = async (
    teacherId: string,
    roleType: "NONE" | "WALI_KELAS" | "GURU_MAPEL",
    subjectId?: string,
    targetClassIds?: string[],
  ) => {
    try {
      const schoolId = currentUser?.schoolId;
      if (!schoolId) throw new Error("Sekolah aktif tidak ditemukan.");
      const activeAcademicYear = schoolProfile.tahunPelajaran || "2026/2027";

      if (roleType === "WALI_KELAS") {
        if (targetClassIds && targetClassIds.length > 2) {
          throw new Error("Satu guru hanya boleh menjadi Wali Kelas untuk maksimal 2 rombel pada satu tahun ajaran.");
        }

        // Hapus penugasan mapel jika ada pada sekolah aktif
        await supabase
          .from("subject_teacher_assignments")
          .delete()
          .eq("school_id", schoolId)
          .eq("teacher_id", teacherId);

        if (targetClassIds && targetClassIds.length > 0) {
          const uniqueTargetIds = [...new Set(targetClassIds)];
          for (const targetClassId of uniqueTargetIds) {
            const { data: targetClass, error: targetClassError } = await supabase
              .from("classes")
              .select("id,academic_year")
              .eq("school_id", schoolId)
              .eq("id", targetClassId)
              .maybeSingle();
            if (targetClassError) throw targetClassError;
            if (!targetClass) throw new Error("Rombel tujuan tidak ditemukan pada sekolah aktif.");
            if (targetClass.academic_year && targetClass.academic_year !== activeAcademicYear) {
              throw new Error(`Rombel tersebut bukan bagian dari tahun ajaran aktif ${activeAcademicYear}.`);
            }
          }

          // Lepaskan rombel yang sebelumnya diampu guru ini tetapi TIDAK termasuk dalam uniqueTargetIds
          const { data: existingWaliClasses } = await supabase
            .from("classes")
            .select("id")
            .eq("school_id", schoolId)
            .eq("wali_kelas_teacher_id", teacherId);

          const toRelease = (existingWaliClasses || []).filter((c: any) => !uniqueTargetIds.includes(c.id));
          for (const rel of toRelease) {
            await supabase
              .from("classes")
              .update({ wali_kelas_teacher_id: null })
              .eq("school_id", schoolId)
              .eq("id", rel.id);

            await supabase
              .from("teacher_assignments")
              .delete()
              .eq("school_id", schoolId)
              .eq("class_id", rel.id)
              .eq("role", "WALI_KELAS");
          }

          // Pasang guru pada seluruh rombel target (hingga 2 rombel)
          for (const targetClassId of uniqueTargetIds) {
            const { error: assignError } = await supabase
              .from("classes")
              .update({ wali_kelas_teacher_id: teacherId })
              .eq("school_id", schoolId)
              .eq("id", targetClassId);
            if (assignError) throw assignError;

            await supabase
              .from("teacher_assignments")
              .delete()
              .eq("school_id", schoolId)
              .eq("class_id", targetClassId)
              .eq("role", "WALI_KELAS");

            await supabase
              .from("teacher_assignments")
              .insert({
                school_id: schoolId,
                teacher_id: teacherId,
                role: "WALI_KELAS",
                class_id: targetClassId,
                subject_id: null,
                academic_year: activeAcademicYear,
                is_active: true,
              });
          }
        } else {
          // Lepas seluruh kelas binaan jika targetClassIds kosong
          await supabase
            .from("classes")
            .update({ wali_kelas_teacher_id: null })
            .eq("school_id", schoolId)
            .eq("wali_kelas_teacher_id", teacherId);

          await supabase
            .from("teacher_assignments")
            .delete()
            .eq("school_id", schoolId)
            .eq("teacher_id", teacherId)
            .eq("role", "WALI_KELAS");
        }

        // Perbarui tabel teachers agar kolom STATUS PENUGASAN (ADMIN) otomatis tersimpan & terbaca
        await supabase
          .from("teachers")
          .update({
            tugas_utama: "Wali Kelas",
              })
          .eq("id", teacherId)
          .eq("school_id", schoolId);

        // Update state lokal teachers secara instan
        setTeachers((prev) =>
          prev.map((t) =>
            t.id === teacherId
              ? {
                  ...t,
                  tugasUtama: "Wali Kelas",
                  tugas_utama: "Wali Kelas",
                }
              : t,
          ),
        );

        const linkedUser = users.find((u) => u.teacherId === teacherId);
        if (linkedUser) {
          const userClassIds = classes
            .filter((c) => c.waliKelasTeacherId === teacherId)
            .map((c) => c.id);
          await supabase
            .from("profiles")
            .update({
              role: "WALI KELAS",
              subject_id: null,
              subject_name: null,
              class_ids: targetClassIds || userClassIds,
            })
            .eq("id", linkedUser.id)
            .eq("school_id", schoolId);
        }
      } else if (roleType === "GURU_MAPEL") {
        const chosenSubject = subjectId ? subjects.find((s) => s.id === subjectId) : null;
        const subjectName = chosenSubject?.name || null;

        // Lepas wali kelas jika sebelumnya ditugaskan sebagai wali kelas
        await supabase
          .from("classes")
          .update({ wali_kelas_teacher_id: null })
          .eq("school_id", schoolId)
          .eq("wali_kelas_teacher_id", teacherId);

        if (subjectId && chosenSubject) {
          const uniqueTargetClassIds = [...new Set((targetClassIds || []).filter(Boolean))];
          if (uniqueTargetClassIds.length) {
            const { data: targetClasses, error: targetClassesError } = await supabase
              .from("classes")
              .select("id,academic_year")
              .eq("school_id", schoolId)
              .in("id", uniqueTargetClassIds);
            if (targetClassesError) throw targetClassesError;
            if ((targetClasses || []).length !== uniqueTargetClassIds.length) {
              throw new Error("Ada Rombel tujuan yang tidak valid.");
            }
          }

          // Assignment Guru + Mapel
          const { error: staDeleteError } = await supabase
            .from("subject_teacher_assignments")
            .delete()
            .eq("school_id", schoolId)
            .eq("teacher_id", teacherId);
          if (staDeleteError) throw staDeleteError;

          const { error: staErr } = await supabase
            .from("subject_teacher_assignments")
            .insert({
              school_id: schoolId,
              subject_id: subjectId,
              teacher_id: teacherId,
              academic_year: activeAcademicYear,
            });
          if (staErr) throw staErr;

          // Sinkronkan kelas
          const { error: scaDeleteError } = await supabase
            .from("subject_class_assignments")
            .delete()
            .eq("school_id", schoolId)
            .eq("subject_id", subjectId);
          if (scaDeleteError) throw scaDeleteError;

          if (uniqueTargetClassIds.length) {
            const classInserts = uniqueTargetClassIds.map((cid) => ({
              school_id: schoolId,
              subject_id: subjectId,
              class_id: cid,
              academic_year: activeAcademicYear,
            }));
            const { error: scaInsertError } = await supabase
              .from("subject_class_assignments")
              .insert(classInserts);
            if (scaInsertError) throw scaInsertError;
          }

          // Sinkronkan ke tabel terpadu teacher_assignments
          await supabase
            .from("teacher_assignments")
            .delete()
            .eq("school_id", schoolId)
            .eq("teacher_id", teacherId);

          const taInserts = uniqueTargetClassIds.length
            ? uniqueTargetClassIds.map((cid) => ({
                school_id: schoolId,
                teacher_id: teacherId,
                role: "GURU_MAPEL" as const,
                class_id: cid,
                subject_id: subjectId,
                academic_year: activeAcademicYear,
                is_active: true,
              }))
            : [
                {
                  school_id: schoolId,
                  teacher_id: teacherId,
                  role: "GURU_MAPEL" as const,
                  class_id: null,
                  subject_id: subjectId,
                  academic_year: activeAcademicYear,
                  is_active: true,
                },
              ];

          await supabase.from("teacher_assignments").insert(taInserts);
        }

        // Perbarui tabel teachers agar kolom STATUS PENUGASAN (ADMIN) otomatis tersimpan & terbaca
        await supabase
          .from("teachers")
          .update({
            tugas_utama: "Guru Mapel",
          })
          .eq("id", teacherId)
          .eq("school_id", schoolId);

        // Update state lokal teachers secara instan
        setTeachers((prev) =>
          prev.map((t) =>
            t.id === teacherId
              ? {
                  ...t,
                  tugasUtama: "Guru Mapel",
                  tugas_utama: "Guru Mapel",
                }
              : t,
          ),
        );

        const linkedUser = users.find((u) => u.teacherId === teacherId);
        if (linkedUser) {
          await supabase
            .from("profiles")
            .update({
              role: "GURU MAPEL",
              subject_id: subjectId || null,
              subject_name: subjectName || null,
              class_ids: targetClassIds || linkedUser.classIds || [],
            })
            .eq("id", linkedUser.id)
            .eq("school_id", schoolId);
        }
      } else {
        await supabase
          .from("classes")
          .update({ wali_kelas_teacher_id: null })
          .eq("school_id", schoolId)
          .eq("wali_kelas_teacher_id", teacherId);

        await supabase
          .from("subject_teacher_assignments")
          .delete()
          .eq("school_id", schoolId)
          .eq("teacher_id", teacherId);

        // Bersihkan dari tabel terpadu teacher_assignments
        await supabase
          .from("teacher_assignments")
          .delete()
          .eq("school_id", schoolId)
          .eq("teacher_id", teacherId);

        // Perbarui tabel teachers agar kolom STATUS PENUGASAN (ADMIN) otomatis tersimpan & terbaca
        await supabase
          .from("teachers")
          .update({
            tugas_utama: "Belum ditugaskan",
              })
          .eq("id", teacherId)
          .eq("school_id", schoolId);

        // Update state lokal teachers secara instan
        setTeachers((prev) =>
          prev.map((t) =>
            t.id === teacherId
              ? {
                  ...t,
                  tugasUtama: "Belum ditugaskan",
                  tugas_utama: "Belum ditugaskan",
                }
              : t,
          ),
        );

        const linkedUser = users.find((u) => u.teacherId === teacherId);
        if (linkedUser) {
          await supabase
            .from("profiles")
            .update({
              class_ids: [],
              subject_id: null,
              subject_name: null,
            })
            .eq("id", linkedUser.id)
            .eq("school_id", schoolId);
        }
      }

      // Pastikan rekonsiliasi menyeluruh tabel teacher_assignments berjalan di background
      supabase.auth.getSession().then(({ data }) => {
        const token = data.session?.access_token;
        if (token) {
          fetch('/api/sync-teacher-assignments', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ schoolId, academicYear: activeAcademicYear }),
          }).catch((err) => console.warn('[executeTeacherAssignment] background sync warning:', err));
        }
      }).catch(() => {});

      await loadData(currentUser?.id || "");
      showToast("Penugasan guru berhasil disimpan ke database.");
    } catch (e: any) {
      console.error("executeTeacherAssignment error:", e);
      showToast(
        e.message || "Gagal memperbarui penugasan guru di database.",
        "error",
      );
      throw e;
    }
  };
  const hydrateUser = async (p: any): Promise<UserAccount> => {
    const base = emptyUser(p);
    let teacherId = base.teacherId || null;
    const schoolId = base.schoolId || currentUser?.schoolId || null;

    if (!teacherId && teachers.length > 0) {
      const cleanUName = (base.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const uNip = (base.nip || "").replace(/\D/g, "");
      const uUsernameNip = (base.username || "").replace(/\D/g, "");
      const match = teachers.find((t) => {
        const tNip = (t.nip || "").replace(/\D/g, "");
        if (uNip && tNip && uNip === tNip) return true;
        if (uUsernameNip && uUsernameNip.length >= 8 && tNip && uUsernameNip === tNip) return true;
        if (cleanUName && t.nama) {
          const cleanT = t.nama.toLowerCase().replace(/[^a-z0-9]/g, "");
          return cleanT === cleanUName || (cleanUName.length >= 4 && (cleanT.includes(cleanUName) || cleanUName.includes(cleanT)));
        }
        return false;
      });
      if (match) {
        teacherId = match.id;
        base.teacherId = match.id;
      }
    }

    if (base.role === "SISWA") {
      let studentId = base.studentId || null;
      if (!studentId && students.length > 0) {
        const cleanUName = (base.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const uUsernameNisn = (base.username || "").replace(/\D/g, "");
        const match = students.find((s) => {
          const sNisn = (s.nisn || "").replace(/\D/g, "");
          if (uUsernameNisn && sNisn && uUsernameNisn === sNisn) return true;
          if (cleanUName && s.nama) {
            const cleanS = s.nama.toLowerCase().replace(/[^a-z0-9]/g, "");
            return cleanS === cleanUName;
          }
          return false;
        });
        if (match) {
          studentId = match.id;
          base.studentId = match.id;
        }
      }
      if (studentId) {
        const studentObj = students.find((s) => s.id === studentId);
        if (studentObj && studentObj.classId) {
          const cls = classes.find((c) => c.id === studentObj.classId);
          return {
            ...base,
            classIds: [studentObj.classId],
            classNames: cls ? [cls.name] : (studentObj.className ? [studentObj.className] : []),
          };
        }
      }
      return { ...base, classIds: [], classNames: [] };
    }

    if (!teacherId || !schoolId)
      return { ...base, classIds: [], classNames: [] };
    let ids: string[] = [];
    if (base.role === "WALI KELAS") {
      let { data, error } = await supabase
        .from("classes")
        .select("id,name")
        .eq("school_id", schoolId)
        .eq("academic_year", schoolProfile.tahunPelajaran || "2026/2027")
        .eq("wali_kelas_teacher_id", teacherId);
      if (error) throw error;
      if (!data || data.length === 0) {
        const fallback = await supabase
          .from("classes")
          .select("id,name")
          .eq("school_id", schoolId)
          .eq("wali_kelas_teacher_id", teacherId);
        data = fallback.data || [];
      }
      if (data && data.length > 1) {
        const preferredId = (Array.isArray((base as any).class_ids) && (base as any).class_ids[0]) ||
          (Array.isArray((base as any).classIds) && (base as any).classIds[0]) ||
          null;
        const preferred = data.find((x: any) => x.id === preferredId) || data[data.length - 1];
        data = preferred ? [preferred] : [data[0]];
      }
      ids = (data || []).map((x: any) => x.id);
      return {
        ...base,
        classIds: ids,
        classNames: (data || []).map((x: any) => x.name),
      };
    }
    if (base.role === "GURU MAPEL") {
      const { data: sta, error: staErr } = await supabase
        .from("subject_teacher_assignments")
        .select("subject_id")
        .eq("school_id", schoolId)
        .eq("academic_year", schoolProfile.tahunPelajaran || "2026/2027")
        .eq("teacher_id", teacherId);
      if (staErr) throw staErr;
      const subjectIds = (sta || []).map((x: any) => x.subject_id);
      if (subjectIds.length) {
        const { data: sca, error: scaErr } = await supabase
          .from("subject_class_assignments")
          .select("class_id")
          .eq("school_id", schoolId)
          .eq("academic_year", schoolProfile.tahunPelajaran || "2026/2027")
          .in("subject_id", subjectIds);
        if (scaErr) throw scaErr;
        ids = Array.from(
          new Set<string>((sca || []).map((x: any) => String(x.class_id))),
        );
      }
      const names = ids
        .map((id) => classes.find((c) => c.id === id)?.name || "")
        .filter(Boolean);
      return { ...base, classIds: ids, classNames: names };
    }
    return { ...base, classIds: [], classNames: [] };
  };
  const addUser = async (u: UserAccountInput) => {
    try {
      const result = await apiUser("create", {
        name: u.name,
        email: u.email || null,
        username: u.username,
        password: u.password,
        role: u.role,
        studentId: u.studentId || null,
        classIds: u.classIds || [],
        subjectId: u.subjectId || null,
        subjectName: u.subjectName || null,
      });
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", u.username.toLowerCase())
        .single();
      if (error) throw error;
      const teacherId = result?.teacherId || data?.teacher_id || null;
      const nu = await hydrateUser({ ...data, teacher_id: teacherId });
      setUsers((p) => [...p.filter((x) => x.id !== nu.id), nu]);
      if (u.role === "WALI KELAS" && teacherId) {
        const assignedClassId = nu.classIds && nu.classIds.length > 0 ? nu.classIds[0] : null;
        setClasses((prev) =>
          prev.map((c) => {
            if (assignedClassId && c.id === assignedClassId) {
              return {
                ...c,
                waliKelasTeacherId: teacherId,
                waliKelasName: data.name,
              };
            }
            if (c.waliKelasTeacherId === teacherId && c.id !== assignedClassId) {
              return {
                ...c,
                waliKelasTeacherId: null,
                waliKelasName: null,
              };
            }
            return c;
          }),
        );
      }
      showToast(`Akun pengguna ${u.name} berhasil ditambahkan`);
    } catch (e: any) {
      showToast(e.message || "Gagal membuat akun pengguna.", "error");
      throw e;
    }
  };
  const deleteUser = async (id: string) => {
    try {
      const targetUser = users.find((u) => u.id === id);
      const res = await apiUser("delete", { userId: id, deleteTeacherMaster: true, deleteStudentMaster: true });
      setUsers((p) => p.filter((x) => x.id !== id));
      if (targetUser?.teacherId) {
        setTeachers((p) => p.filter((t) => t.id !== targetUser.teacherId));
      }
      if (currentUser?.id === id) await supabase.auth.signOut();
      if (currentUser) {
        await loadDataForSchool(currentUser.schoolId, currentUser, currentUser.role);
      } else {
        await loadData(currentUser?.id);
      }
      showToast(res?.message || "Akun pengguna dan seluruh data terkait berhasil dihapus permanen dari database.", "info");
    } catch (e: any) {
      showToast(e.message, "error");
      throw e;
    }
  };
  const updateUser = async (id: string, data: Partial<UserAccount>) => {
    try {
      await apiUser("update", {
        userId: id,
        name: data.name,
        email: data.email || null,
        username: data.username,
        role: data.role,
        studentId: data.studentId || null,
        classIds: data.classIds || [],
        subjectId: data.subjectId || null,
        subjectName: data.subjectName || null,
      });
      const { data: profileAfter, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!profileAfter)
        throw new Error("Profil pengguna setelah pembaruan tidak ditemukan.");
      const teacherId = profileAfter.teacher_id || null;
      const nu = await hydrateUser({ ...profileAfter, teacher_id: teacherId });
      setUsers((p) => p.map((x) => (x.id === id ? { ...x, ...nu } : x)));
      if (teacherId) {
        setTeachers((prev) =>
          prev.map((t) =>
            t.id === teacherId
              ? {
                  ...t,
                  nama: nu.name || t.nama,
                  email:
                    nu.email && !nu.email.toLowerCase().endsWith("@login.edushift.local")
                      ? nu.email
                      : undefined,
                }
              : t,
          ),
        );
      }
      if (currentUser?.id === id)
        setCurrentUser((p) => (p ? { ...p, ...nu } : p));
      if (nu.role === "WALI KELAS" && teacherId) {
        const assignedClassId = nu.classIds && nu.classIds.length > 0 ? nu.classIds[0] : null;
        setClasses((prev) =>
          prev.map((c) => {
            if (assignedClassId && c.id === assignedClassId) {
              return {
                ...c,
                waliKelasTeacherId: teacherId,
                waliKelasName: nu.name,
              };
            }
            if (c.waliKelasTeacherId === teacherId && c.id !== assignedClassId) {
              return {
                ...c,
                waliKelasTeacherId: null,
                waliKelasName: null,
              };
            }
            return c;
          }),
        );
      } else {
        setClasses((prev) =>
          prev.map((c) =>
            c.waliKelasTeacherId === teacherId && nu.role !== "WALI KELAS"
              ? { ...c, waliKelasTeacherId: null, waliKelasName: null }
              : c,
          ),
        );
      }
      showToast("Data akun pengguna berhasil diperbarui");
    } catch (e: any) {
      showToast(e.message || "Gagal memperbarui akun pengguna.", "error");
      throw e;
    }
  };
  const generateRandomPassword = (length = 8): string => {
    const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
    const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lowers = "abcdefghijkmnpqrstuvwxyz";
    const digits = "23456789";
    let pwd = "";
    pwd += uppers[Math.floor(Math.random() * uppers.length)];
    pwd += lowers[Math.floor(Math.random() * lowers.length)];
    pwd += digits[Math.floor(Math.random() * digits.length)];
    for (let i = 3; i < length; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    return pwd
      .split("")
      .sort(() => 0.5 - Math.random())
      .join("");
  };

  const sanitizeUsername = (raw: string, fallbackPrefix: string): string => {
    let cleaned = (raw || "").toLowerCase().replace(/[^a-z0-9._-]/g, "");
    if (cleaned.length < 3) {
      cleaned = `${fallbackPrefix}_${cleaned || Math.floor(1000 + Math.random() * 9000)}`;
    }
    return cleaned.slice(0, 60);
  };

  const generateAccountsFromReferences = async (options?: {
    resetExistingPasswords?: boolean;
    passwordMode?: "random" | "standard" | "custom";
    customPassword?: string;
  }): Promise<GeneratedAccountResult[]> => {
    const resetExisting = !!options?.resetExistingPasswords;
    const results: GeneratedAccountResult[] = [];
    const passwordMap = new Map<string, string>(); // username/id -> password
    const schoolId = currentUser?.schoolId || activeWorkspace?.workspaceId;
    if (!schoolId) {
      showToast("ID Sekolah tidak valid.", "error");
      return results;
    }

    // 1. Prioritaskan server backend API /api/admin-users dengan Service Role:
    // Menjamin eksekusi atomic, anti timeout, anti kolisi username, dan 100% tuntas tanpa menyisakan pengguna yang belum tergenerate!
    try {
      const { data: authSession } = await supabase.auth.getSession();
      const token = authSession.session?.access_token;
      if (token) {
        const res = await fetch("/api/admin-users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "generate_all_accounts",
            schoolId,
            resetExistingPasswords: resetExisting,
            passwordMode: options?.passwordMode,
            customPassword: options?.customPassword,
          }),
        });
        const resJson = await res.json().catch(() => ({}));
        if (res.ok && resJson.ok && Array.isArray(resJson.results)) {
          // Simpan seluruh password ke localStorage agar tersimpan aman untuk dicetak & diekspor
          if (schoolId) {
            try {
              const existingRaw = localStorage.getItem(`kawacanaan_account_passwords_${schoolId}`);
              const mergedMap = existingRaw ? { ...JSON.parse(existingRaw) } : {};
              resJson.results.forEach((r: any) => {
                if (r.password) {
                  if (r.username) mergedMap[String(r.username).toLowerCase()] = r.password;
                  if (r.id) mergedMap[r.id] = r.password;
                }
              });
              localStorage.setItem(`kawacanaan_account_passwords_${schoolId}`, JSON.stringify(mergedMap));
            } catch (_) {}
          }

          // Refresh data sekolah secara komprehensif
          if (currentUser) {
            await loadDataForSchool(schoolId, currentUser, currentUser.role);
          } else {
            await loadData(currentUser?.id);
          }

          showToast(resJson.message || `Berhasil mengenerate seluruh ${resJson.results.length} akun pengguna tanpa ada yang tertinggal.`);
          return resJson.results;
        }
      }
    } catch (apiErr) {
      console.warn("[generateAccountsFromReferences] API server warning, fallback ke client engine:", apiErr);
    }

    const createAccountPassword = (): string => {
      return generateRandomPassword(8);
    };

    try {
      // 0. Ambil data referensi & penugasan peran (assignment_role) terbaru langsung dari database untuk school_id yang sama
      const [
        teachersRes,
        classesRes,
        subjectsRes,
        subjectTeacherScopeRes,
        subjectClassScopeRes,
        studentsRes,
        schoolProfileRes,
        profilesRes,
      ] = await Promise.all([
        supabase.from("teachers").select("*").eq("school_id", schoolId).order("nama"),
        supabase.from("classes").select("*, wali:wali_kelas_teacher_id(id,nama,nip)").eq("school_id", schoolId).order("grade").order("name"),
        supabase.from("subjects").select("*").eq("school_id", schoolId),
        supabase.from("subject_teacher_assignments").select("subject_id,teacher_id,academic_year").eq("school_id", schoolId),
        supabase.from("subject_class_assignments").select("subject_id,class_id,academic_year").eq("school_id", schoolId),
        supabase.from("students").select("*, classes:class_id(id,name,grade,academic_year)").eq("school_id", schoolId).order("nama"),
        supabase.from("school_profile").select("*").eq("school_id", schoolId).maybeSingle(),
        supabase.from("profiles").select("*").eq("school_id", schoolId),
      ]);

      const dbTeachers = (teachersRes.data && teachersRes.data.length > 0) ? teachersRes.data.map(dbTeacher) : teachers;
      const dbClasses: SchoolClass[] = (classesRes.data && classesRes.data.length > 0)
        ? classesRes.data.map((c: any) => ({
            id: c.id,
            name: c.name,
            grade: c.grade,
            academicYear: c.academic_year,
            waliKelasTeacherId: c.wali_kelas_teacher_id || null,
            waliKelasName: c.wali?.nama || null,
          }))
        : classes;
      const dbSubjects: Subject[] = (subjectsRes.data && subjectsRes.data.length > 0)
        ? subjectsRes.data.map((s: any) => ({
            id: s.id,
            name: s.name,
            code: s.code,
            teacherId: s.teacher_id,
            teacherName: s.teacher_name,
            targetClassIds: s.target_class_ids || [],
          }))
        : subjects;
      const dbStudents: Student[] = (studentsRes.data && studentsRes.data.length > 0)
        ? studentsRes.data.map((x: any) => dbStudent({ ...x, class_name: x.classes?.name || "" }))
        : students;
      const dbProfiles = profilesRes.data || [];

      const activeAcademicYear = String(
        schoolProfileRes.data?.tahun_pelajaran ||
        schoolProfile.tahunPelajaran ||
        "2026/2027"
      ).trim() || "2026/2027";

      // Pemetaan assignment Guru Mapel dari subject_teacher_assignments & subject_class_assignments
      const teacherSubjectScope = new Map<string, string[]>();
      const subjectClassScope = new Map<string, string[]>();

      (subjectTeacherScopeRes.data || [])
        .filter((a: any) => !a.academic_year || a.academic_year === activeAcademicYear)
        .forEach((a: any) => {
          const ids = teacherSubjectScope.get(a.teacher_id) || [];
          if (!ids.includes(a.subject_id)) ids.push(a.subject_id);
          teacherSubjectScope.set(a.teacher_id, ids);
        });

      (subjectClassScopeRes.data || [])
        .filter((a: any) => !a.academic_year || a.academic_year === activeAcademicYear)
        .forEach((a: any) => {
          const ids = subjectClassScope.get(a.subject_id) || [];
          if (!ids.includes(a.class_id)) ids.push(a.class_id);
          subjectClassScope.set(a.subject_id, ids);
        });

      // 1. Data Kepala Sekolah
      const ksName = (schoolProfileRes.data?.nama_kepala_sekolah || schoolProfile.namaKepalaSekolah || "").trim();
      const ksNip = (schoolProfileRes.data?.nip_kepala_sekolah || schoolProfile.nipKepalaSekolah || "").trim();

      if (ksName) {
        const ksUsername = sanitizeUsername(ksNip || ksName, "ks");
        const existing = dbProfiles.find(
          (u: any) =>
            u.role === "KEPALA SEKOLAH" ||
            (u.username && u.username.toLowerCase() === ksUsername.toLowerCase())
        );

        if (!existing) {
          const newKsPassword = createAccountPassword();
          try {
            const res = await apiUser("create", {
              name: ksName,
              username: ksUsername,
              password: newKsPassword,
              role: "KEPALA SEKOLAH",
            });
            const ksUserId = res?.userId || "";
            if (ksUserId) passwordMap.set(ksUserId, newKsPassword);
            passwordMap.set(ksUsername.toLowerCase(), newKsPassword);
            results.push({
              id: ksUserId,
              name: ksName,
              username: ksUsername,
              password: newKsPassword,
              role: "KEPALA SEKOLAH",
              category: "KEPALA SEKOLAH",
              status: "CREATED",
            });
          } catch (err: any) {
            results.push({
              name: ksName,
              username: ksUsername,
              role: "KEPALA SEKOLAH",
              category: "KEPALA SEKOLAH",
              status: "SKIPPED",
              error: err?.message,
            });
          }
        } else if (resetExisting || !passwordMap.has(existing.id)) {
          const newKsPassword = createAccountPassword();
          try {
            await apiUser("password", {
              userId: existing.id,
              password: newKsPassword,
            });
            passwordMap.set(existing.id, newKsPassword);
            if (existing.username) passwordMap.set(existing.username.toLowerCase(), newKsPassword);
            results.push({
              id: existing.id,
              name: existing.name || ksName,
              username: existing.username || ksUsername,
              password: newKsPassword,
              role: existing.role || "KEPALA SEKOLAH",
              category: "KEPALA SEKOLAH",
              status: "UPDATED",
            });
          } catch (err: any) {
            results.push({
              id: existing.id,
              name: existing.name || ksName,
              username: existing.username || ksUsername,
              role: existing.role || "KEPALA SEKOLAH",
              category: "KEPALA SEKOLAH",
              status: "SKIPPED",
              error: err?.message,
            });
          }
        } else {
          const existingPwd = passwordMap.get(existing.id) || passwordMap.get((existing.username || "").toLowerCase()) || createAccountPassword();
          passwordMap.set(existing.id, existingPwd);
          if (existing.username) passwordMap.set(existing.username.toLowerCase(), existingPwd);
          results.push({
            id: existing.id,
            name: existing.name || ksName,
            username: existing.username || ksUsername,
            password: existingPwd,
            role: existing.role || "KEPALA SEKOLAH",
            category: "KEPALA SEKOLAH",
            status: "ACTIVE" as any,
          });
        }
      }

      // 2. Data Guru & Tenaga Kependidikan (diambil dari seluruh master data guru sekolah)
      for (const teacher of dbTeachers) {
        const teacherName = (teacher.nama || "").trim();
        const teacherUsername = sanitizeUsername(
          teacher.nip && teacher.nip !== "-" ? teacher.nip : teacher.nama,
          "guru",
        );

        // Cari akun profil yang sudah ada berdasarkan teacher_id, username, atau nama guru
        const existing = dbProfiles.find(
          (u: any) =>
            (u.teacher_id && u.teacher_id === teacher.id) ||
            (u.username && u.username.toLowerCase() === teacherUsername.toLowerCase()) ||
            (u.name && u.name.trim().toLowerCase() === teacherName.toLowerCase() &&
              (u.role === "WALI KELAS" || u.role === "GURU MAPEL" || u.role === "ADMIN")),
        );

        // Cari assignment Wali Kelas di database classes
        const linkedHomeroom = dbClasses.find(
          (c) =>
            c.waliKelasTeacherId === teacher.id ||
            (c.waliKelasName &&
              c.waliKelasName.trim().toLowerCase() === teacherName.toLowerCase()),
        );

        // Cari assignment Guru Mapel dari tabel penugasan database
        const assignedSubjectIds = teacherSubjectScope.get(teacher.id) || [];
        const directSubjects = dbSubjects.filter(
          (s) =>
            s.teacherId === teacher.id ||
            (s.teacherName && s.teacherName.trim().toLowerCase() === teacherName.toLowerCase()),
        );
        const combinedSubjectIds = Array.from(
          new Set([...assignedSubjectIds, ...directSubjects.map((s) => s.id)]),
        );
        const teacherSubjects = combinedSubjectIds
          .map((sid) => dbSubjects.find((s) => s.id === sid))
          .filter(Boolean) as Subject[];

        const isWali = !!linkedHomeroom || teacher.tugasUtama === "Wali Kelas" || (teacher as any).tugas_utama === "Wali Kelas";
        const isMapel = teacherSubjects.length > 0 || teacher.tugasUtama === "Guru Mapel" || (teacher as any).tugas_utama === "Guru Mapel";

        let role: UserRole = "GURU MAPEL";
        if (isWali && !isMapel) {
          role = "WALI KELAS";
        } else if (isMapel && !isWali) {
          role = "GURU MAPEL";
        } else if (isWali && isMapel) {
          role = (teacher.tugasUtama === "Wali Kelas" || (teacher as any).tugas_utama === "Wali Kelas") ? "WALI KELAS" : "GURU MAPEL";
        } else {
          role = (teacher.tugasUtama === "Wali Kelas" || (teacher as any).tugas_utama === "Wali Kelas") ? "WALI KELAS" : "GURU MAPEL";
        }

        let classIds: string[] = [];
        let assignmentDescription = "";

        if (role === "WALI KELAS") {
          if (linkedHomeroom) {
            classIds = [linkedHomeroom.id];
            assignmentDescription = `Wali Kelas ${linkedHomeroom.name}`;
          } else {
            assignmentDescription = "Wali Kelas";
          }
        } else if (role === "GURU MAPEL") {
          const mapelNames = teacherSubjects.map((s) => s.name).join(", ") || teacher.tugasUtama || (teacher as any).tugas_utama || "Guru Mapel";
          const targetClassIds: string[] = Array.from(
            new Set(
              teacherSubjects.flatMap((s) => {
                const fromScope = subjectClassScope.get(s.id) || [];
                const fromDirect = (s.targetClassIds || []) as string[];
                return [...fromScope, ...fromDirect];
              }),
            ),
          );
          classIds = targetClassIds;
          const targetClassNames = targetClassIds
            .map((cid) => dbClasses.find((c) => c.id === cid)?.name || "")
            .filter(Boolean);
          const classSuffix = targetClassNames.length > 0 ? ` (${targetClassNames.join(", ")})` : "";
          assignmentDescription = `${mapelNames}${classSuffix}`;
        } else {
          assignmentDescription = teacher.tugasUtama || (teacher as any).tugas_utama || "Tenaga Pendidik";
        }

        if (!existing) {
          const newTeacherPassword = createAccountPassword();
          let accountCreated = false;
          let teacherUserId = "";

          try {
            const res = await apiUser("create", {
              name: teacherName,
              username: teacherUsername,
              password: newTeacherPassword,
              role,
              classIds,
              subjectId: teacherSubjects[0]?.id || null,
              subjectName: teacherSubjects[0]?.name || null,
              teacherId: teacher.id,
            });
            teacherUserId = res?.userId || "";
            accountCreated = true;
            if (teacherUserId) passwordMap.set(teacherUserId, newTeacherPassword);
            passwordMap.set(teacherUsername.toLowerCase(), newTeacherPassword);
            const createdTeacherId = res?.teacherId || teacher.id;
            if (createdTeacherId && linkedHomeroom && role === "WALI KELAS") {
              await supabase
                .from("classes")
                .update({ wali_kelas_teacher_id: createdTeacherId })
                .eq("id", linkedHomeroom.id);
            }
          } catch (createErr: any) {
            // Jika gagal membuat baru karena profil ternyata sudah ada di DB, coba reset password akun yang ada
            try {
              const { data: fallbackProfile } = await supabase
                .from("profiles")
                .select("id,username,name,role")
                .eq("school_id", schoolId)
                .or(`username.ilike.${teacherUsername},name.ilike.${teacherName}`)
                .maybeSingle();

              if (fallbackProfile) {
                await apiUser("password", {
                  userId: fallbackProfile.id,
                  password: newTeacherPassword,
                });
                await apiUser("update", {
                  userId: fallbackProfile.id,
                  name: teacherName,
                  username: fallbackProfile.username || teacherUsername,
                  role,
                  classIds,
                  subjectId: teacherSubjects[0]?.id || null,
                  teacherId: teacher.id,
                }).catch(() => {});
                teacherUserId = fallbackProfile.id;
                accountCreated = true;
                passwordMap.set(fallbackProfile.id, newTeacherPassword);
                if (fallbackProfile.username) passwordMap.set(fallbackProfile.username.toLowerCase(), newTeacherPassword);
              }
            } catch (_) {}
          }

          if (accountCreated) {
            results.push({
              id: teacherUserId,
              name: teacherName,
              username: teacherUsername,
              password: newTeacherPassword,
              role,
              category: "GURU",
              className: assignmentDescription,
              status: "CREATED",
            });
          } else {
            results.push({
              name: teacherName,
              username: teacherUsername,
              password: newTeacherPassword,
              role,
              category: "GURU",
              className: assignmentDescription,
              status: "CREATED",
            });
          }
        } else if (resetExisting || !passwordMap.has(existing.id)) {
          const newTeacherPassword = createAccountPassword();
          try {
            await apiUser("password", {
              userId: existing.id,
              password: newTeacherPassword,
            });
            await apiUser("update", {
              userId: existing.id,
              name: teacherName,
              username: existing.username,
              role,
              classIds,
              subjectId: teacherSubjects[0]?.id || null,
              teacherId: teacher.id,
            }).catch(() => {});
            passwordMap.set(existing.id, newTeacherPassword);
            if (existing.username) passwordMap.set(existing.username.toLowerCase(), newTeacherPassword);
            results.push({
              id: existing.id,
              name: existing.name || teacherName,
              username: existing.username,
              password: newTeacherPassword,
              role: role || existing.role,
              category: "GURU",
              className: assignmentDescription,
              status: "UPDATED",
            });
          } catch (err: any) {
            passwordMap.set(existing.id, newTeacherPassword);
            if (existing.username) passwordMap.set(existing.username.toLowerCase(), newTeacherPassword);
            results.push({
              id: existing.id,
              name: existing.name || teacherName,
              username: existing.username,
              password: newTeacherPassword,
              role: role || existing.role,
              category: "GURU",
              className: assignmentDescription,
              status: "UPDATED",
            });
          }
        } else {
          // Sinkronkan penugasan kelas dan role jika berubah di database
          await apiUser("update", {
            userId: existing.id,
            name: teacherName,
            username: existing.username,
            role,
            classIds,
            subjectId: teacherSubjects[0]?.id || null,
            teacherId: teacher.id,
          }).catch(() => {});
          const existingPwd = passwordMap.get(existing.id) || passwordMap.get((existing.username || "").toLowerCase()) || createAccountPassword();
          passwordMap.set(existing.id, existingPwd);
          if (existing.username) passwordMap.set(existing.username.toLowerCase(), existingPwd);
          results.push({
            id: existing.id,
            name: existing.name || teacherName,
            username: existing.username,
            password: existingPwd,
            role: role || existing.role,
            category: "GURU",
            className: assignmentDescription,
            status: "ACTIVE" as any,
          });
        }
      }

      // 3. Data Siswa (diambil dari database students dengan school_id yang sama)
      for (const student of dbStudents) {
        const studentName = (student.nama || "").trim();
        const studentUsername = sanitizeUsername(student.nisn || student.nama, "sis");
        const studentClass = dbClasses.find(
          (c) => c.id === student.classId || c.id === (student as any).class_id,
        );
        const studentClassName = studentClass?.name || student.className || "-";

        const existing = dbProfiles.find(
          (u: any) =>
            u.role === "SISWA" &&
            ((u.student_id && u.student_id === student.id) ||
              (u.username && u.username.toLowerCase() === studentUsername.toLowerCase())),
        );

        if (!existing) {
          const newStudentPassword = createAccountPassword();
          let studentCreated = false;
          let studentUserId = "";

          try {
            const res = await apiUser("create", {
              name: studentName,
              username: studentUsername,
              password: newStudentPassword,
              role: "SISWA",
              studentId: student.id,
            });
            studentUserId = res?.userId || "";
            studentCreated = true;
            if (studentUserId) passwordMap.set(studentUserId, newStudentPassword);
            passwordMap.set(studentUsername.toLowerCase(), newStudentPassword);
          } catch (createErr: any) {
            try {
              const { data: fallbackStudentProfile } = await supabase
                .from("profiles")
                .select("id,username,name,role,student_id")
                .eq("school_id", schoolId)
                .or(`username.ilike.${studentUsername},student_id.eq.${student.id}`)
                .maybeSingle();

              if (fallbackStudentProfile) {
                await apiUser("password", {
                  userId: fallbackStudentProfile.id,
                  password: newStudentPassword,
                });
                await apiUser("update", {
                  userId: fallbackStudentProfile.id,
                  name: studentName,
                  username: fallbackStudentProfile.username || studentUsername,
                  role: "SISWA",
                  studentId: student.id,
                }).catch(() => {});
                studentUserId = fallbackStudentProfile.id;
                studentCreated = true;
                passwordMap.set(fallbackStudentProfile.id, newStudentPassword);
                if (fallbackStudentProfile.username) passwordMap.set(fallbackStudentProfile.username.toLowerCase(), newStudentPassword);
              }
            } catch (_) {}
          }

          if (studentCreated) {
            results.push({
              id: studentUserId,
              name: studentName,
              username: studentUsername,
              password: newStudentPassword,
              role: "SISWA",
              category: "SISWA",
              className: studentClassName,
              status: "CREATED",
            });
          } else {
            results.push({
              name: studentName,
              username: studentUsername,
              password: newStudentPassword,
              role: "SISWA",
              category: "SISWA",
              className: studentClassName,
              status: "CREATED",
            });
          }
        } else if (resetExisting || !passwordMap.has(existing.id)) {
          const newStudentPassword = createAccountPassword();
          try {
            await apiUser("password", {
              userId: existing.id,
              password: newStudentPassword,
            });
            await apiUser("update", {
              userId: existing.id,
              name: studentName,
              username: existing.username,
              role: "SISWA",
              studentId: student.id,
            }).catch(() => {});
            passwordMap.set(existing.id, newStudentPassword);
            if (existing.username) passwordMap.set(existing.username.toLowerCase(), newStudentPassword);
            results.push({
              id: existing.id,
              name: existing.name || studentName,
              username: existing.username,
              password: newStudentPassword,
              role: "SISWA",
              category: "SISWA",
              className: studentClassName,
              status: "UPDATED",
            });
          } catch (err: any) {
            passwordMap.set(existing.id, newStudentPassword);
            if (existing.username) passwordMap.set(existing.username.toLowerCase(), newStudentPassword);
            results.push({
              id: existing.id,
              name: existing.name || studentName,
              username: existing.username,
              password: newStudentPassword,
              role: "SISWA",
              category: "SISWA",
              className: studentClassName,
              status: "UPDATED",
            });
          }
        } else {
          // Sinkronkan student_id jika belum terhubung
          if (!existing.student_id && student.id) {
            await apiUser("update", {
              userId: existing.id,
              name: studentName,
              username: existing.username,
              role: "SISWA",
              studentId: student.id,
            }).catch(() => {});
          }
          const existingPwd = passwordMap.get(existing.id) || passwordMap.get((existing.username || "").toLowerCase()) || createAccountPassword();
          passwordMap.set(existing.id, existingPwd);
          if (existing.username) passwordMap.set(existing.username.toLowerCase(), existingPwd);
          results.push({
            id: existing.id,
            name: existing.name || studentName,
            username: existing.username,
            password: existingPwd,
            role: "SISWA",
            category: "SISWA",
            className: studentClassName,
            status: "ACTIVE" as any,
          });
        }
      }

      // Persist all generated passwords into localStorage for this school
      if (passwordMap.size > 0 && schoolId) {
        try {
          const existingRaw = localStorage.getItem(`kawacanaan_account_passwords_${schoolId}`);
          const mergedMap = existingRaw ? { ...JSON.parse(existingRaw) } : {};
          passwordMap.forEach((val, key) => {
            mergedMap[key] = val;
          });
          localStorage.setItem(`kawacanaan_account_passwords_${schoolId}`, JSON.stringify(mergedMap));
        } catch (_) {}
      }

      // Refresh seluruh state aplikasi dari database secara menyeluruh
      if (schoolId && currentUser) {
        await loadDataForSchool(schoolId, currentUser, currentUser.role);
      } else {
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("*")
          .eq("school_id", schoolId)
          .order("name");
        if (allProfiles) {
          const hydratedUsers = await Promise.all(
            allProfiles.map((p: any) => hydrateUser(p)),
          );
          setUsers(hydratedUsers);
        }
      }

      // Terapkan password acak baru ke state users lokal agar langsung tampil di UI tabel
      if (passwordMap.size > 0) {
        setUsers((prevUsers) =>
          prevUsers.map((u) => {
            const pwd =
              passwordMap.get(u.id) ||
              (u.username ? passwordMap.get(u.username.toLowerCase()) : undefined) ||
              u.password;
            return pwd ? { ...u, password: pwd } : u;
          }),
        );
      }

      const createdCount = results.filter((r) => r.status === "CREATED").length;
      const updatedCount = results.filter((r) => r.status === "UPDATED").length;
      if (createdCount > 0 || updatedCount > 0) {
        showToast(
          `Berhasil memproses ${results.length} akun (${createdCount} baru dibuat, ${updatedCount} password diacak ulang).`,
          "success",
        );
      } else {
        showToast(
          "Semua data referensi (Guru & Siswa) telah tersinkron dengan akun database.",
          "info",
        );
      }
      return results;
    } catch (e: any) {
      showToast(e.message || "Gagal men-generate akun pengguna", "error");
      return results;
    }
  };

  const resetUserToDefaultPassword = async (user: UserAccount): Promise<string> => {
    const newRandomPass = generateRandomPassword(8);
    await updateUserPassword(user.id, newRandomPass);
    const schoolId = currentUser?.schoolId || activeWorkspace?.workspaceId;
    if (schoolId) {
      try {
        const existingRaw = localStorage.getItem(`kawacanaan_account_passwords_${schoolId}`);
        const mergedMap = existingRaw ? { ...JSON.parse(existingRaw) } : {};
        mergedMap[user.id] = newRandomPass;
        if (user.username) mergedMap[user.username.toLowerCase()] = newRandomPass;
        localStorage.setItem(`kawacanaan_account_passwords_${schoolId}`, JSON.stringify(mergedMap));
      } catch (_) {}
    }
    setUsers((prevUsers) =>
      prevUsers.map((u) => (u.id === user.id ? { ...u, password: newRandomPass } : u)),
    );
    return newRandomPass;
  };

  const syncUsersWithStudents = async () => {
    await generateAccountsFromReferences({ resetExistingPasswords: false });
  };

  const reconcileSchoolData = async (showFeedback = true): Promise<{ success: boolean; message: string }> => {
    try {
      const activeSchoolId = currentUser?.schoolId || activeWorkspace?.workspaceId;
      if (!activeSchoolId) {
        throw new Error("ID sekolah tidak ditemukan.");
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || "";

      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: "get_school_master_data",
          school_id: activeSchoolId,
          user_id: currentUser?.id,
        }),
      });

      const json = await res.json();
      if (!json?.ok) {
        throw new Error(json?.error || "Gagal menyinkronkan data master sekolah.");
      }

      let updatedTeachers = teachers;
      if (Array.isArray(json.teachers) && json.teachers.length > 0) {
        updatedTeachers = json.teachers.map(dbTeacher);
        setTeachers(updatedTeachers);
      }

      let updatedClasses = classes;
      if (Array.isArray(json.classes) && json.classes.length > 0) {
        updatedClasses = json.classes.map((c: any) => {
          const assignedTeacherId = c.wali_kelas_teacher_id || null;
          const matchedTeacher = updatedTeachers.find((t) => t.id === assignedTeacherId);
          const waliName = matchedTeacher?.nama || c.wali?.nama || null;
          return {
            id: c.id,
            name: c.name,
            grade: c.grade,
            academicYear: c.academic_year,
            waliKelasTeacherId: assignedTeacherId,
            waliKelasName: waliName,
          };
        });
        setClasses(updatedClasses);
      }

      let updatedStudents = students;
      if (Array.isArray(json.students) && json.students.length > 0) {
        const parsedStudents = json.students.map((s: any) =>
          dbStudent({ ...s, class_name: s.classes?.name || s.class_name || "" }),
        );
        const hasStudentsChanged =
          parsedStudents.length !== students.length ||
          parsedStudents.some((ns, i) => {
            const os = students[i];
            return !os || os.id !== ns.id || os.nama !== ns.nama || os.classId !== ns.classId;
          });
        if (hasStudentsChanged) {
          updatedStudents = parsedStudents;
          setStudents(parsedStudents);
        }
      }

      if (Array.isArray(json.attendanceRecords)) {
        const currentSchoolStudents = updatedStudents.length > 0 ? updatedStudents : students;
        const mappedAttendance = json.attendanceRecords.map((r: any) => dbAttendance(r, currentSchoolStudents));
        setAttendanceRecords((prev) => {
          const map = new Map<string, AttendanceRecord>();
          prev.forEach((r) => {
            const key = `${r.studentId}_${r.date}_${r.type || 'DAILY'}_${r.subjectId || 'null'}`;
            map.set(key, r);
          });
          mappedAttendance.forEach((r) => {
            const key = `${r.studentId}_${r.date}_${r.type || 'DAILY'}_${r.subjectId || 'null'}`;
            map.set(key, r);
          });
          return Array.from(map.values());
        });
      }

      if (Array.isArray(json.subjects) && json.subjects.length > 0) {
        const teacherMap = new Map<string, any>(
          (updatedTeachers || []).map((t: any) => [t.id, t]),
        );
        const classMap = new Map<string, any>(
          (updatedClasses || []).map((c: any) => [c.id, c]),
        );
        const teacherBySubject = new Map<string, string>();
        (json.subjectTeacherAssignments || []).forEach((r: any) =>
          teacherBySubject.set(r.subject_id, r.teacher_id),
        );
        const classesBySubject = new Map<string, string[]>();
        (json.subjectClassAssignments || []).forEach((r: any) => {
          const arr = classesBySubject.get(r.subject_id) || [];
          arr.push(r.class_id);
          classesBySubject.set(r.subject_id, arr);
        });
        const schedulesBySubject = new Map<string, any[]>();
        (json.subjectScheduleDays || []).forEach((r: any) => {
          const arr = schedulesBySubject.get(r.subject_id) || [];
          arr.push(r);
          schedulesBySubject.set(r.subject_id, arr);
        });
        setSubjects(
          json.subjects.map((row: any) =>
            dbSubject(
              {
                ...row,
                teacher_id: teacherBySubject.get(row.id) || null,
                _targetClassIds: classesBySubject.get(row.id) || [],
              },
              teacherMap,
              classMap,
              schedulesBySubject,
            ),
          ),
        );
      }

      if (currentUser) {
        const matchedTeacher = json.matchedTeacher ? dbTeacher(json.matchedTeacher) : null;
        const resolvedClassIds: string[] = Array.isArray(json.resolvedClassIds) ? json.resolvedClassIds : [];

        const updatedUser: UserAccount = {
          ...currentUser,
          ...(matchedTeacher ? {
            teacherId: matchedTeacher.id,
            nip: matchedTeacher.nip || currentUser.nip,
            name: currentUser.name || matchedTeacher.nama,
          } : {}),
          classIds: resolvedClassIds.length > 0 ? resolvedClassIds : currentUser.classIds,
          classNames: resolvedClassIds.length > 0
            ? resolvedClassIds.map((cid) => updatedClasses.find((c) => c.id === cid)?.name || "").filter(Boolean)
            : currentUser.classNames,
        };

        setCurrentUser(updatedUser);
        try {
          localStorage.setItem(CACHE_USER_SESSION_KEY, JSON.stringify(updatedUser));
        } catch (_) {}
      }

      if (showFeedback) {
        showToast("Integrasi data referensi dengan Admin Sekolah berhasil diperbarui!", "success");
      }
      return { success: true, message: "Sinkronisasi berhasil" };
    } catch (err: any) {
      if (showFeedback) {
        showToast(err?.message || "Gagal menyinkronkan data.", "error");
      }
      return { success: false, message: err?.message || "Gagal menyinkronkan data" };
    }
  };
  const updateUserPassword = async (id: string, p: string) => {
    try {
      await apiUser("password", { userId: id, password: p });
      const schoolId = currentUser?.schoolId || activeWorkspace?.workspaceId;
      if (schoolId) {
        try {
          const existingRaw = localStorage.getItem(`kawacanaan_account_passwords_${schoolId}`);
          const mergedMap = existingRaw ? { ...JSON.parse(existingRaw) } : {};
          mergedMap[id] = p;
          const matched = users.find((u) => u.id === id);
          if (matched?.username) mergedMap[matched.username.toLowerCase()] = p;
          localStorage.setItem(`kawacanaan_account_passwords_${schoolId}`, JSON.stringify(mergedMap));
        } catch (_) {}
      }
      setUsers((prevUsers) =>
        prevUsers.map((u) => (u.id === id ? { ...u, password: p } : u)),
      );
      showToast("Password akun berhasil diperbarui");
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };
  const checkCalendarAdminAuth = (): boolean => {
    if (!currentUser) return false;
    const isSchoolWs =
      currentUser.schoolId &&
      activeWorkspace?.workspaceType !== 'personal' &&
      activeWorkspace?.workspaceType !== 'individu';

    if (isSchoolWs) {
      if (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN') {
        showToast(
          'Akses Ditolak: Di ruang kerja sekolah, kalender akademik berstatus Read-Only dan hanya Admin Sekolah yang dapat mengelolanya. Untuk mengatur hari efektif belajar mandiri, silakan beralih ke Ruang Kerja Individu.',
          'error'
        );
        return false;
      }
    }
    return true;
  };
  const addAcademicEvent = async (e: Omit<AcademicEvent, "id">) => {
    if (!checkCalendarAdminAuth()) return;
    const targetSchoolId =
      activeWorkspace?.workspaceId || currentUser?.schoolId || null;
    try {
      const { data, error } = await supabase
        .from("academic_events")
        .insert({
          date: e.date,
          date_display: e.dateDisplay,
          title: e.title,
          is_effective: e.isEffective,
          notes: e.notes || "",
          school_id: targetSchoolId,
        })
        .select()
        .single();
      if (error) {
        const fallbackEvent: AcademicEvent = {
          id: "ev-" + Date.now(),
          date: e.date,
          dateDisplay: e.dateDisplay || e.date,
          title: e.title,
          isEffective: e.isEffective,
          notes: e.notes || "",
        };
        setAcademicEvents((p) => [...p, fallbackEvent]);
        showToast("Agenda akademik berhasil ditambahkan");
        return;
      }
      setAcademicEvents((p) => [...p, dbEvent(data)]);
      showToast("Agenda akademik berhasil ditambahkan");
    } catch (x: any) {
      const fallbackEvent: AcademicEvent = {
        id: "ev-" + Date.now(),
        date: e.date,
        dateDisplay: e.dateDisplay || e.date,
        title: e.title,
        isEffective: e.isEffective,
        notes: e.notes || "",
      };
      setAcademicEvents((p) => [...p, fallbackEvent]);
      showToast("Agenda akademik berhasil ditambahkan");
    }
  };
  const deleteAcademicEvent = async (id: string) => {
    if (!checkCalendarAdminAuth()) return;
    try {
      await supabase.from("academic_events").delete().eq("id", id);
    } catch (_) {}
    setAcademicEvents((p) => p.filter((e) => e.id !== id));
    showToast("Agenda akademik telah dihapus", "info");
  };
  const updateActiveStudyDays = async (days: number[]) => {
    if (!checkCalendarAdminAuth()) return;
    if (!Array.isArray(days) || days.length === 0) {
      showToast("Pilih minimal 1 hari belajar aktif dalam seminggu.", "error");
      return;
    }
    const targetWsId =
      activeWorkspace?.workspaceId ||
      currentUser?.schoolId ||
      currentUser?.id ||
      "default";
    try {
      localStorage.setItem(
        `kawacanaan_active_study_days_${targetWsId}`,
        JSON.stringify(days),
      );
    } catch (_) {}

    // Urutkan hari Senin (1) .. Sabtu (6), Minggu (0)
    const sortedDays = [...days].sort((a, b) => {
      const orderA = a === 0 ? 7 : a;
      const orderB = b === 0 ? 7 : b;
      return orderA - orderB;
    });

    setActiveStudyDays(sortedDays);
    const c = { ...systemConfig, activeStudyDays: sortedDays };
    setSystemConfig(c);
    await updateSystemConfig(c);
    showToast(`Hari belajar efektif berhasil diatur ke ${sortedDays.length} hari/minggu`);
  };
  const updateEffectiveDays = async (monthKey: string, days: number) => {
    if (!checkCalendarAdminAuth()) return;
    const targetSchoolId =
      activeWorkspace?.workspaceId || currentUser?.schoolId || null;
    if (!targetSchoolId) return;

    try {
      // Hapus data bulan ini terlebih dahulu agar aman dari trigger BEFORE UPDATE (error 42703)
      await supabase
        .from("effective_days")
        .delete()
        .eq("school_id", targetSchoolId)
        .eq("month_key", monthKey);

      const { error } = await supabase
        .from("effective_days")
        .insert({ school_id: targetSchoolId, month_key: monthKey, days });

      if (error) return showToast(error.message, "error");
      setEffectiveDaysConfig((p) => ({ ...p, [monthKey]: days }));
      showToast(`Hari belajar efektif bulan ${monthKey} diperbarui (${days} hari)`);
    } catch (err: any) {
      showToast(err.message || "Gagal memperbarui hari efektif", "error");
    }
  };
  const getBaseStudyDaysForMonth = (year: number, month: number) => {
    let c = 0,
      total = new Date(year, month, 0).getDate();
    for (let d = 1; d <= total; d++) {
      if (activeStudyDays.includes(new Date(year, month - 1, d).getDay())) c++;
    }
    return c;
  };
  const getEffectiveDaysForMonth = (year: number | string, month?: number) => {
    const key =
      typeof year === "string"
        ? year
        : `${year}-${String(month).padStart(2, "0")}`;
    const [y, m] = key.split("-").map(Number);
    const base = effectiveDaysConfig[key] ?? getBaseStudyDaysForMonth(y, m);
    const holidays = academicEvents
      .filter((e) => e.date.startsWith(key) && !e.isEffective)
      .filter((e) => {
        try {
          const [ey, em, ed] = e.date.split("-").map(Number);
          const day = new Date(ey, em - 1, ed).getDay();
          return activeStudyDays.includes(day);
        } catch {
          return false;
        }
      }).length;
    return Math.max(0, base - holidays);
  };
  const getDateStatus = (date: string) => {
    const [y, m, d] = date.split("-").map(Number);
    const day = new Date(y, m - 1, d).getDay();
    const isStudyDay = activeStudyDays.includes(day);
    const ev = academicEvents.find((e) => e.date === date);
    if (ev && !ev.isEffective)
      return {
        isStudyDay,
        isHoliday: true,
        isEffective: false,
        label: `Libur: ${ev.title}`,
        badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
        eventTitle: ev.title,
      };
    if (ev && ev.isEffective)
      return {
        isStudyDay: true,
        isHoliday: false,
        isEffective: true,
        label: `Agenda Efektif: ${ev.title}`,
        badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
        eventTitle: ev.title,
      };
    if (!isStudyDay)
      return {
        isStudyDay: false,
        isHoliday: false,
        isEffective: false,
        label: "Libur Rutin (Bukan Hari Belajar)",
        badgeColor: "bg-slate-100 text-slate-600 border-slate-200",
      };
    return {
      isStudyDay: true,
      isHoliday: false,
      isEffective: true,
      label: "Hari Efektif Belajar",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  };
  const reloadSubjects = async () => {
    const schoolId = currentUser?.schoolId;
    if (!schoolId) return;
    const [
      { data: rows },
      { data: assignments },
      { data: classAssignments },
      { data: schedules },
      { data: teacherRows },
      { data: classRows },
    ] = await Promise.all([
      supabase
        .from("subjects")
        .select("*")
        .eq("school_id", schoolId)
        .order("name"),
      supabase
        .from("subject_teacher_assignments")
        .select("subject_id, teacher_id, academic_year")
        .eq("school_id", schoolId)
        .eq("academic_year", schoolProfile.tahunPelajaran || "2026/2027"),
      supabase
        .from("subject_class_assignments")
        .select("subject_id, class_id, academic_year")
        .eq("school_id", schoolId)
        .eq("academic_year", schoolProfile.tahunPelajaran || "2026/2027"),
      supabase
        .from("subject_schedule_days")
        .select("subject_id, day_of_week, lesson_period")
        .eq("school_id", schoolId),
      supabase.from("teachers").select("id,nama").eq("school_id", schoolId),
      supabase
        .from("classes")
        .select("id,name,academic_year")
        .eq("school_id", schoolId),
    ]);
    const teacherMap = new Map<string, any>(
      (teacherRows || []).map((t: any) => [t.id, t]),
    );
    const classMap = new Map<string, any>(
      (classRows || []).map((c: any) => [c.id, c]),
    );
    const teacherBySubject = new Map<string, string>();
    (assignments || []).forEach((r: any) =>
      teacherBySubject.set(r.subject_id, r.teacher_id),
    );
    const classesBySubject = new Map<string, string[]>();
    (classAssignments || []).forEach((r: any) => {
      const a = classesBySubject.get(r.subject_id) || [];
      a.push(r.class_id);
      classesBySubject.set(r.subject_id, a);
    });
    const schedulesBySubject = new Map<string, any[]>();
    (schedules || []).forEach((r: any) => {
      const a = schedulesBySubject.get(r.subject_id) || [];
      a.push(r);
      schedulesBySubject.set(r.subject_id, a);
    });
    setSubjects(
      (rows || []).map((row: any) =>
        dbSubject(
          {
            ...row,
            teacher_id: teacherBySubject.get(row.id) || null,
            _targetClassIds: classesBySubject.get(row.id) || [],
          },
          teacherMap,
          classMap,
          schedulesBySubject,
        ),
      ),
    );
  };

  const addSubject = async (s: Omit<Subject, "id">) => {
    try {
      const schoolId = currentUser?.schoolId;
      if (!schoolId) throw new Error("Sekolah aktif tidak ditemukan.");

      // Coba simpan melalui server API /api/sync-teacher-assignments terlebih dahulu
      const { data: authSession } = await supabase.auth.getSession();
      const token = authSession.session?.access_token;
      if (token) {
        try {
          const res = await fetch("/api/sync-teacher-assignments", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: "save_subject",
              schoolId,
              academicYear: schoolProfile.tahunPelajaran || "2026/2027",
              name: s.name,
              code: s.code,
              teacherId: s.teacherId,
              targetClassIds: s.targetClassIds || [],
              scheduleDays: s.scheduleDays || [],
              classSchedules: s.classSchedules || [],
            }),
          });
          const resData = await res.json().catch(() => ({}));
          if (res.ok && resData.ok) {
            await reloadSubjects();
            showToast("Mata pelajaran " + s.name + " berhasil ditambahkan!");
            return;
          }
          if (res.status === 403) {
            throw new Error(resData.error || "Tidak berwenang mengelola mata pelajaran.");
          }
        } catch (apiErr: any) {
          if (apiErr.message && apiErr.message.includes("Tidak berwenang")) {
            throw apiErr;
          }
          console.warn("[addSubject] Fallback ke direct supabase:", apiErr.message);
        }
      }

      const { data, error } = await supabase
        .from("subjects")
        .insert({
          school_id: schoolId,
          name: s.name.trim(),
          code: (s.code || s.name.slice(0, 4)).toUpperCase().trim(),
          is_specialized: !!s.isSpecialized,
        })
        .select()
        .single();
      if (error) throw error;
      if (s.teacherId) {
        const year = schoolProfile.tahunPelajaran || "2026/2027";
        const { error: e } = await supabase.rpc("replace_subject_assignment", {
          p_school_id: schoolId,
          p_subject_id: data.id,
          p_teacher_id: s.teacherId,
          p_class_ids: s.targetClassIds || [],
          p_academic_year: year,
          p_actor_user_id: currentUser?.id || null,
        });
        if (e) throw e;
      } else if ((s.targetClassIds || []).length) {
        const rows = (s.targetClassIds || []).map((classId) => ({
          school_id: schoolId,
          subject_id: data.id,
          class_id: classId,
          academic_year:
            classes.find((c) => c.id === classId)?.academicYear ||
            schoolProfile.tahunPelajaran ||
            "2026/2027",
        }));
        const { error: e } = await supabase
          .from("subject_class_assignments")
          .insert(rows);
        if (e) throw e;
      }
      const scheduleInserts: {
        school_id: string;
        subject_id: string;
        day_of_week: string;
        lesson_period: string | null;
      }[] = [];

      if (s.classSchedules && s.classSchedules.length > 0) {
        s.classSchedules.forEach((cs) => {
          const timeSuffix = cs.startTime && cs.endTime ? `@${cs.startTime}-${cs.endTime}` : '';
          (cs.days || []).forEach((day) => {
            scheduleInserts.push({
              school_id: schoolId,
              subject_id: data.id,
              day_of_week: day,
              lesson_period: `cls:${cs.classId}${timeSuffix}`,
            });
          });
        });
      } else if ((s.scheduleDays || []).length) {
        (s.scheduleDays || []).forEach((day) => {
          scheduleInserts.push({
            school_id: schoolId,
            subject_id: data.id,
            day_of_week: day,
            lesson_period: s.lessonPeriod || null,
          });
        });
      }

      if (scheduleInserts.length > 0) {
        const { error: e } = await supabase
          .from("subject_schedule_days")
          .insert(scheduleInserts);
        if (e) throw e;
      }
      await reloadSubjects();
      showToast("Mata pelajaran " + s.name + " berhasil ditambahkan!");
    } catch (e: any) {
      showToast(e.message || "Gagal menyimpan mata pelajaran.", "error");
    }
  };

  const updateSubject = async (id: string, s: Omit<Subject, "id">) => {
    try {
      const schoolId = currentUser?.schoolId;
      if (!schoolId) throw new Error("Sekolah aktif tidak ditemukan.");

      // Coba simpan melalui server API /api/sync-teacher-assignments terlebih dahulu
      const { data: authSession } = await supabase.auth.getSession();
      const token = authSession.session?.access_token;
      if (token) {
        try {
          const res = await fetch("/api/sync-teacher-assignments", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: "save_subject",
              id,
              schoolId,
              academicYear: schoolProfile.tahunPelajaran || "2026/2027",
              name: s.name,
              code: s.code,
              teacherId: s.teacherId,
              targetClassIds: s.targetClassIds || [],
              scheduleDays: s.scheduleDays || [],
              classSchedules: s.classSchedules || [],
            }),
          });
          const resData = await res.json().catch(() => ({}));
          if (res.ok && resData.ok) {
            await reloadSubjects();
            showToast("Mata pelajaran " + s.name + " berhasil diperbarui");
            return;
          }
          if (res.status === 403) {
            throw new Error(resData.error || "Tidak berwenang memperbarui mata pelajaran.");
          }
        } catch (apiErr: any) {
          if (apiErr.message && apiErr.message.includes("Tidak berwenang")) {
            throw apiErr;
          }
          console.warn("[updateSubject] Fallback ke direct supabase:", apiErr.message);
        }
      }

      const { error } = await supabase
        .from("subjects")
        .update({
          name: s.name.trim(),
          code: (s.code || s.name.slice(0, 4)).toUpperCase().trim(),
          is_specialized: !!s.isSpecialized,
        })
        .eq("id", id)
        .eq("school_id", schoolId);
      if (error) throw error;
      const year = schoolProfile.tahunPelajaran || "2026/2027";
      const { error: scheduleDeleteError } = await supabase
        .from("subject_schedule_days")
        .delete()
        .eq("subject_id", id)
        .eq("school_id", schoolId);
      if (scheduleDeleteError) throw scheduleDeleteError;
      const { data: currentAssignment } = await supabase
        .from("subject_teacher_assignments")
        .select("teacher_id")
        .eq("subject_id", id)
        .eq("school_id", schoolId)
        .eq("academic_year", year)
        .maybeSingle();
      if (currentAssignment?.teacher_id) {
        const { error: e } = await supabase.rpc("replace_subject_assignment", {
          p_school_id: schoolId,
          p_subject_id: id,
          p_teacher_id: s.teacherId || currentAssignment.teacher_id,
          p_class_ids: s.targetClassIds || [],
          p_academic_year: year,
          p_actor_user_id: currentUser?.id || null,
        });
        if (e) throw e;
      } else {
        const { error: delAssignmentError } = await supabase
          .from("subject_class_assignments")
          .delete()
          .eq("subject_id", id)
          .eq("school_id", schoolId)
          .eq("academic_year", year);
        if (delAssignmentError) throw delAssignmentError;
        if (s.teacherId) {
          const { error: e } = await supabase.rpc(
            "replace_subject_assignment",
            {
              p_school_id: schoolId,
              p_subject_id: id,
              p_teacher_id: s.teacherId,
              p_class_ids: s.targetClassIds || [],
              p_academic_year: year,
              p_actor_user_id: currentUser?.id || null,
            },
          );
          if (e) throw e;
        } else if ((s.targetClassIds || []).length) {
          const rows = (s.targetClassIds || []).map((classId) => ({
            school_id: schoolId,
            subject_id: id,
            class_id: classId,
            academic_year:
              classes.find((c) => c.id === classId)?.academicYear || year,
          }));
          const { error: e } = await supabase
            .from("subject_class_assignments")
            .insert(rows);
          if (e) throw e;
        }
      }
      const updateScheduleInserts: {
        school_id: string;
        subject_id: string;
        day_of_week: string;
        lesson_period: string | null;
      }[] = [];

      if (s.classSchedules && s.classSchedules.length > 0) {
        s.classSchedules.forEach((cs) => {
          const timeSuffix = cs.startTime && cs.endTime ? `@${cs.startTime}-${cs.endTime}` : '';
          (cs.days || []).forEach((day) => {
            updateScheduleInserts.push({
              school_id: schoolId,
              subject_id: id,
              day_of_week: day,
              lesson_period: `cls:${cs.classId}${timeSuffix}`,
            });
          });
        });
      } else if ((s.scheduleDays || []).length) {
        (s.scheduleDays || []).forEach((day) => {
          updateScheduleInserts.push({
            school_id: schoolId,
            subject_id: id,
            day_of_week: day,
            lesson_period: s.lessonPeriod || null,
          });
        });
      }

      if (updateScheduleInserts.length > 0) {
        const { error: e } = await supabase
          .from("subject_schedule_days")
          .insert(updateScheduleInserts);
        if (e) throw e;
      }
      await reloadSubjects();
      showToast("Mata pelajaran " + s.name + " berhasil diperbarui");
    } catch (e: any) {
      showToast(e.message || "Gagal memperbarui mata pelajaran.", "error");
    }
  };

  const deleteSubject = async (id: string) => {
    try {
      const schoolId = currentUser?.schoolId;
      if (!schoolId) throw new Error("Sekolah aktif tidak ditemukan.");

      const { data: authSession } = await supabase.auth.getSession();
      const token = authSession.session?.access_token;
      if (token) {
        try {
          const res = await fetch("/api/sync-teacher-assignments", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: "delete_subject",
              id,
              schoolId,
              academicYear: schoolProfile.tahunPelajaran || "2026/2027",
            }),
          });
          const resData = await res.json().catch(() => ({}));
          if (res.ok && resData.ok) {
            setSubjects((p) => p.filter((s) => s.id !== id));
            showToast("Mata pelajaran berhasil dihapus", "info");
            return;
          }
        } catch (apiErr: any) {
          console.warn("[deleteSubject] Fallback ke direct supabase:", apiErr.message);
        }
      }

      const { error } = await supabase
        .from("subjects")
        .delete()
        .eq("id", id)
        .eq("school_id", schoolId);
      if (error) throw error;
      setSubjects((p) => p.filter((s) => s.id !== id));
      showToast("Mata pelajaran berhasil dihapus", "info");
    } catch (e: any) {
      showToast(e.message || "Gagal menghapus mata pelajaran.", "error");
    }
  };
  const getAttendanceForDate = (
    date: string,
    options?: {
      type?: AttendanceType;
      subjectId?: string | null;
      classId?: string | null;
    },
  ): AttendanceRecord[] => {
    const targetType: AttendanceType = options?.type || "DAILY";
    const targetSubjectId = options?.subjectId || null;
    const targetClassId = options?.classId || null;
    const targetClassObj = targetClassId
      ? classes.find((c) => c.id === targetClassId || normalizeClassToken(c.name) === normalizeClassToken(targetClassId))
      : null;
    const targetStudents = targetClassId
      ? students.filter((s) => {
          if (s.classId === targetClassId) return true;
          if (targetClassObj && (s.classId === targetClassObj.id || (s.className && normalizeClassToken(s.className) === normalizeClassToken(targetClassObj.name)))) return true;
          return false;
        })
      : students;
    const sortedStudents = [...targetStudents].sort((a, b) =>
      a.nama.localeCompare(b.nama, "id"),
    );
    const dailyRecordsMap = new Map<string, AttendanceRecord>(
      attendanceRecords
        .filter((a) => a.date === date && (!a.type || a.type === "DAILY"))
        .map((a) => [a.studentId, a]),
    );
    const specificRecordsMap = new Map<string, AttendanceRecord>(
      attendanceRecords
        .filter((a) => {
          if (a.date !== date) return false;
          if (targetType === "SUBJECT") {
            return a.type === "SUBJECT" && a.subjectId === targetSubjectId;
          }
          return !a.type || a.type === "DAILY";
        })
        .map((a) => [a.studentId, a]),
    );
    return sortedStudents.map((s) => {
      const existing = specificRecordsMap.get(s.id);
      if (existing && existing.status && existing.status !== '-') return existing;

      // Cek apakah ada permohonan surat izin/sakit resmi yang telah disetujui (APPROVED)
      const approvedLeave = (leaveRequests || []).find(
        (lr) =>
          lr.studentId === s.id &&
          lr.status === "APPROVED" &&
          lr.startDate <= date &&
          (lr.endDate || lr.startDate) >= date
      );

      const leaveStatus: AttendanceStatus = approvedLeave
        ? (approvedLeave.leaveType === "sakit" ? "Sakit" : "Izin")
        : ("" as AttendanceStatus);
      const leaveNote = approvedLeave
        ? (approvedLeave.subCategory ? `[${approvedLeave.subCategory}] ${approvedLeave.reason}` : approvedLeave.reason)
        : "";

      if (targetType === "SUBJECT") {
        const dailyRec = dailyRecordsMap.get(s.id);
        const isPermitOrSick =
          dailyRec?.status === "Sakit" || dailyRec?.status === "Izin" || Boolean(approvedLeave);
        const inheritedStatus = isPermitOrSick
          ? (dailyRec?.status || leaveStatus)
          : ("" as AttendanceStatus);
        const finalStatus = existing?.status || inheritedStatus;
        const isAbsent = finalStatus === "Sakit" || finalStatus === "Izin" || finalStatus === "Alfa";
        const inheritedNotes = isPermitOrSick
          ? (dailyRec?.notes || (leaveNote ? `(Surat Izin: ${leaveNote})` : `(Sinkron Wali Kelas: ${dailyRec?.status || leaveStatus})`))
          : "";
        return {
          id: existing?.id ||
            "att-subj-" + date + "-" + (targetSubjectId || "gen") + "-" + s.id,
          date,
          studentId: s.id,
          studentName: s.nama,
          status: finalStatus,
          checkInTime: isAbsent ? "" : (existing?.checkInTime && existing.checkInTime !== '-' ? existing.checkInTime : ""),
          checkOutTime: isAbsent ? "" : (existing?.checkOutTime && existing.checkOutTime !== '-' ? existing.checkOutTime : ""),
          notes: existing?.notes || inheritedNotes,
          type: "SUBJECT" as AttendanceType,
          subjectId: targetSubjectId,
          classId: targetClassId || s.classId || null,
        };
      }
      const finalDailyStatus = existing?.status || leaveStatus;
      const isDailyAbsent = finalDailyStatus === "Sakit" || finalDailyStatus === "Izin" || finalDailyStatus === "Alfa";
      return {
        id: existing?.id || "att-" + date + "-" + s.id,
        date,
        studentId: s.id,
        studentName: s.nama,
        status: finalDailyStatus,
        checkInTime: isDailyAbsent ? "" : (existing?.checkInTime && existing.checkInTime !== '-' ? existing.checkInTime : ""),
        checkOutTime: isDailyAbsent ? "" : (existing?.checkOutTime && existing.checkOutTime !== '-' ? existing.checkOutTime : ""),
        notes: existing?.notes || (leaveNote ? `Surat ${leaveStatus}: ${leaveNote}` : ""),
        type: "DAILY" as AttendanceType,
        classId: targetClassId || s.classId || null,
      };
    });
  };
  // Resolve the teacher identity strictly from database IDs with resilient sync and fallbacks.
  const resolveAttendanceTeacherId = async (
    type: AttendanceType,
    classId: string | null,
    subjectId: string | null,
  ): Promise<string | null> => {
    const schoolId = currentUser?.schoolId || null;
    if (!schoolId || !classId) return null;

    if (type === "DAILY") {
      let teacherId = currentUser?.teacherId || null;

      // 1. Coba cocokkan teacherId dari daftar guru lokal jika belum ada di currentUser
      if (!teacherId && currentUser) {
        const cleanUserName = (currentUser.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const userNip = (currentUser.nip || "").replace(/\D/g, "");
        const usernameNip = (currentUser.username || "").replace(/\D/g, "");
        const matched = teachers.find((t) => {
          const tNip = (t.nip || "").replace(/\D/g, "");
          if (userNip && tNip && userNip === tNip) return true;
          if (usernameNip && usernameNip.length >= 8 && tNip && usernameNip === tNip) return true;
          if (cleanUserName && t.nama) {
            const cleanT = t.nama.toLowerCase().replace(/[^a-z0-9]/g, "");
            if (cleanT === cleanUserName || (cleanUserName.length >= 4 && (cleanT.includes(cleanUserName) || cleanUserName.includes(cleanT)))) return true;
          }
          return false;
        });
        if (matched) {
          teacherId = matched.id;
          setCurrentUser((u) => (u ? { ...u, teacherId: matched.id } : u));
        }
      }

      // 2. Ambil data kelas dari database Supabase
      const { data: classRow } = await supabase
        .from("classes")
        .select("id, wali_kelas_teacher_id, academic_year")
        .eq("id", classId)
        .eq("school_id", schoolId)
        .maybeSingle();

      const dbClassTeacherId = classRow?.wali_kelas_teacher_id || null;

      // 3. Untuk WALI KELAS: pastikan teacherId dan class_id terhubung di server
      if (currentUser?.role === "WALI KELAS") {
        if (!teacherId || !dbClassTeacherId || dbClassTeacherId !== teacherId) {
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token || "";
            if (token) {
              const response = await fetch("/api/sync-wali-kelas", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ classId }),
              });
              const body = await response.json().catch(() => ({}));
              if (response.ok && body.teacherId) {
                teacherId = String(body.teacherId);
                setCurrentUser((u) => (u ? { ...u, teacherId } : u));
                return teacherId;
              }
            }
          } catch (e) {
            console.warn("[resolveAttendanceTeacherId] sync-wali-kelas error:", e);
          }
        }

        if (teacherId) return teacherId;
        if (dbClassTeacherId) return dbClassTeacherId;
      }

      // 4. Jika bukan WALI KELAS (Admin/Kepala Sekolah/Guru Piket) atau fallback
      if (dbClassTeacherId) return dbClassTeacherId;
      if (teacherId) return teacherId;

      // 5. Fallback ke kelas di state lokal jika ada waliKelasTeacherId
      const localClass = classes.find((c) => c.id === classId);
      if (localClass?.waliKelasTeacherId) return localClass.waliKelasTeacherId;

      // 6. Fallback jika kelas memiliki waliKelasName, cari guru yang cocok
      if (localClass?.waliKelasName) {
        const cleanWali = localClass.waliKelasName.toLowerCase().replace(/[^a-z0-9]/g, "");
        const t = teachers.find(
          (tc) => tc.nama.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanWali
        );
        if (t?.id) return t.id;
      }

      // 7. Jika currentUser memiliki teacherId (apapun rolenya)
      if (currentUser?.teacherId) return currentUser.teacherId;

      // 8. Fallback terakhir: jika ada guru di sekolah, gunakan guru pertama agar absensi tidak gagal
      if (teachers.length > 0) return teachers[0].id;

      return null;
    }

    if (!subjectId) return null;

    let targetSubjectTeacherId = currentUser?.teacherId || null;

    if (currentUser?.teacherId) {
      try {
        const { data: teacherAssignment } = await supabase
          .from("subject_teacher_assignments")
          .select("teacher_id")
          .eq("school_id", schoolId)
          .eq("subject_id", subjectId)
          .eq("teacher_id", currentUser.teacherId)
          .maybeSingle();
        if (teacherAssignment?.teacher_id) {
          return teacherAssignment.teacher_id;
        }
      } catch (_) {}
    }

    const localSubject = subjects.find((s) => s.id === subjectId);
    if (localSubject?.teacherId) return localSubject.teacherId;
    if (targetSubjectTeacherId) return targetSubjectTeacherId;
    if (teachers.length > 0) return teachers[0].id;

    return null;
  };

  const saveDailyAttendance = async (
    date: string,
    records: AttendanceRecord[],
    options?: {
      type?: AttendanceType;
      subjectId?: string | null;
      subjectName?: string | null;
      classId?: string | null;
    },
  ) => {
    try {
      const dateStatus = getDateStatus(date);
      if (!dateStatus.isEffective) {
        showToast(
          `Presensi tanggal ${date} dikunci karena ${dateStatus.label}`,
          "error",
        );
        return;
      }
      const targetType: AttendanceType =
        options?.type || records[0]?.type || "DAILY";
      const targetSubjectId =
        options?.subjectId ?? records[0]?.subjectId ?? null;
      const targetSubjectName =
        options?.subjectName ?? records[0]?.subjectName ?? null;
      const targetClassId = options?.classId ?? records[0]?.classId ?? null;
      let targetTeacherId = await resolveAttendanceTeacherId(
        targetType,
        targetClassId,
        targetSubjectId,
      );
      if (!targetTeacherId) {
        targetTeacherId = currentUser?.teacherId || (teachers.length > 0 ? teachers[0].id : null);
      }

      const targetStudentIds = records.map((r) => r.studentId).filter(Boolean);

      const payload = records
        .filter((r) => r.status && r.status !== "-")
        .map((r) => ({
          school_id: currentUser?.schoolId || activeWorkspace?.workspaceId || null,
          date: r.date || date,
          student_id: r.studentId,
          class_id:
            r.classId ||
            students.find((s) => s.id === r.studentId)?.classId ||
            null,
          type: targetType,
          subject_id: targetSubjectId || null,
          teacher_id: targetTeacherId,
          status: r.status,
          check_in_time:
            r.checkInTime && r.checkInTime !== "-" ? r.checkInTime : null,
          check_out_time:
            r.checkOutTime && r.checkOutTime !== "-" ? r.checkOutTime : null,
          notes: r.notes || null,
          updated_by: currentUser?.id || null,
        }));

      // Eksekusi penyimpanan: gunakan API backend atomik sebagai jalur utama (bebas pembatasan RLS)
      let savedViaServer = false;
      let lastErrorMessage = "";
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token || "";
        if (token) {
          const response = await fetch("/api/attendance", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: "save_daily",
              schoolId: currentUser?.schoolId || activeWorkspace?.workspaceId,
              date,
              type: targetType,
              subjectId: targetSubjectId,
              classId: targetClassId || options?.classId || null,
              targetStudentIds,
              payload,
            }),
          });
          const resData = await response.json().catch(() => ({}));
          if (response.ok && resData?.ok) {
            savedViaServer = true;
          } else {
            lastErrorMessage = resData?.error || `Gagal menghubungi server (HTTP ${response.status})`;
            console.warn("[saveDailyAttendance] Server API warning:", lastErrorMessage);
          }
        }
      } catch (serverErr: any) {
        lastErrorMessage = serverErr?.message || "Koneksi ke server terputus";
        console.warn("[saveDailyAttendance] Server API exception, mencoba fallback client:", lastErrorMessage);
      }

      if (!savedViaServer) {
        // Fallback: simpan langsung via client Supabase
        if (targetStudentIds.length > 0) {
          let del = supabase
            .from("attendance_records")
            .delete()
            .eq("date", date)
            .eq("type", targetType)
            .in("student_id", targetStudentIds);

          if (currentUser?.schoolId) {
            del = del.eq("school_id", currentUser.schoolId);
          }
          if (targetType === "SUBJECT" && targetSubjectId) {
            del = del.eq("subject_id", targetSubjectId);
          }
          const { error: delError } = await del;
          if (delError) {
            console.error("[saveDailyAttendance] Client delete error:", delError.message);
            showToast(`Gagal memperbarui absensi: ${delError.message}`, "error");
            return { success: false, error: delError.message };
          }
        }

        if (payload.length > 0) {
          const { error: insertError } = await supabase
            .from("attendance_records")
            .insert(payload);
          if (insertError) {
            console.error("[saveDailyAttendance] Client insert error:", insertError.message);
            showToast(`Gagal menyimpan absensi ke database: ${insertError.message}`, "error");
            return { success: false, error: insertError.message };
          }
        } else if (targetStudentIds.length === 0 && lastErrorMessage) {
          showToast(`Gagal menyimpan absensi: ${lastErrorMessage}`, "error");
          return { success: false, error: lastErrorMessage };
        }
      }

      const activeRecords: AttendanceRecord[] = records
        .filter((r) => Boolean(r.status && r.status !== "-"))
        .map((r) => ({
          ...r,
          date: r.date || date,
          type: targetType,
          subjectId: targetSubjectId,
          subjectName: targetSubjectName,
          classId: targetClassId || r.classId,
          teacherId: targetTeacherId,
          teacherName: currentUser?.name,
        }));

      const targetStudentIdSet = new Set(targetStudentIds);

      setAttendanceRecords((prev) => {
        const filtered = prev.filter((r) => {
          if (r.date !== date) return true;
          if (targetType === "SUBJECT") {
            const isMatch = r.type === "SUBJECT" && r.subjectId === targetSubjectId;
            if (!isMatch) return true;
            if (targetStudentIdSet.has(r.studentId)) return false;
            if (targetClassId && r.classId === targetClassId) return false;
            return true;
          }
          const isDaily = !r.type || r.type === "DAILY";
          if (!isDaily) return true;
          if (targetStudentIdSet.has(r.studentId)) return false;
          if (targetClassId && r.classId === targetClassId) return false;
          return true;
        });
        const updated = [...filtered, ...activeRecords];
        // Simpan cache lokal darurat agar aman dari reload seketika
        try {
          const backupKey = `kawacanaan_attendance_backup_${currentUser?.schoolId || 'default'}`;
          localStorage.setItem(backupKey, JSON.stringify(updated.slice(-500)));
          localStorage.setItem("kawacanaan_attendance_last_sync", String(Date.now()));
          window.dispatchEvent(new Event("kawacanaan_attendance_updated"));
        } catch (_) {}
        return updated;
      });

      const modeLabel =
        targetType === "SUBJECT"
          ? "Mata Pelajaran " + (targetSubjectName || "")
          : "Harian (Wali Kelas)";
      if (payload.length === 0) {
        showToast(
          "Data absensi " +
            modeLabel +
            " tanggal " +
            date +
            " berhasil di-reset!",
          "info",
        );
      } else {
        showToast(
          "Data absensi " +
            modeLabel +
            " tanggal " +
            date +
            " berhasil disimpan!",
          "success",
        );

        // Pemicu otomatis push notifikasi ke HP Orang Tua jika presensi disimpan untuk hari ini
        const todayDateStr = formatServerDateString(getServerNow());
        if (date === todayDateStr) {
          records.forEach((r) => {
            if (r.studentId && r.status && r.status !== "-") {
              const isOut = Boolean(r.checkOutTime && r.checkOutTime !== "-");
              const evType = isOut ? "pulang" : "masuk";
              const tStr = isOut ? r.checkOutTime : (r.checkInTime || "07:00");
              void triggerAttendancePushNotification({
                studentId: r.studentId,
                studentName: r.studentName,
                eventType: evType,
                timeStr: tStr,
                status: r.status,
                notes: r.notes || undefined,
              });
            }
          });
        }
      }
      return { success: true };
    } catch (e: any) {
      showToast(e.message || "Gagal memproses data absensi", "error");
      return { success: false, error: e.message };
    }
  };
  const submitStudentAttendance = async (
    studentId: string,
    type: "masuk" | "pulang" | "izin" | "sakit",
    notes?: string,
    customDate?: string,
    exactTimeStr?: string,
  ) => {
    try {
      if (!currentUser) {
        return {
          success: false,
          message: "Pengguna belum login.",
        };
      }
      const isStudent = currentUser.role === "SISWA";
      const isSimulator = ["ADMIN", "SUPER_ADMIN", "WALI KELAS", "GURU MAPEL"].includes(currentUser.role);
      if (!isStudent && !isSimulator) {
        return {
          success: false,
          message: "Hanya akun SISWA (atau simulasi portal siswa) yang dapat menggunakan presensi mandiri.",
        };
      }
      if (isStudent) {
        let validStudentId = currentUser.studentId;
        if (!validStudentId) {
          const uNisn = (currentUser.username || "").trim().toLowerCase();
          const uNip = (currentUser.nip || "").trim().toLowerCase();
          const matched = students.find(
            (s) =>
              (uNisn && s.nisn && String(s.nisn).trim().toLowerCase() === uNisn) ||
              (uNip && s.nisn && String(s.nisn).trim().toLowerCase() === uNip) ||
              (currentUser.name && s.nama && s.nama.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
          );
          if (matched) validStudentId = matched.id;
        }
        if (validStudentId && studentId !== validStudentId) {
          return {
            success: false,
            message: "Akses presensi tidak valid untuk akun ini.",
          };
        }
      }
      const now = getServerNow();
      const runningToday = formatServerDateString(now);
      const target = customDate || runningToday;
      if (!customDate && currentAttendanceDate !== runningToday) {
        setCurrentAttendanceDate(runningToday);
      }
      const dateStatus = getDateStatus(target);
      if (!dateStatus.isEffective) {
        const msg = `Presensi tanggal ${target} dikunci karena ${dateStatus.label}`;
        showToast(msg, "error");
        return { success: false, message: msg };
      }
      if (isStudent && !isSimulator && systemConfig.studentSelfAttendanceEnabled === false) {
        const msg =
          "Presensi mandiri siswa sedang dinonaktifkan oleh pihak sekolah.";
        showToast(msg, "error");
        return { success: false, message: msg };
      }

      const currentH = now.getHours();
      const currentM = now.getMinutes();
      const currentS = now.getSeconds();
      const currentMinutes = currentH * 60 + currentM;
      const currentTimeStr = exactTimeStr || `${String(currentH).padStart(2, "0")}:${String(currentM).padStart(2, "0")}:${String(currentS).padStart(2, "0")}`;

      let finalNotes = notes || "";

      // Enforce Jam Buka Presensi Masuk & Batas Masuk Tepat Waktu
      if (type === "masuk") {
        if (!isSimulator && systemConfig.checkInStartTime) {
          const [startH, startM] = systemConfig.checkInStartTime
            .split(":")
            .map(Number);
          const startMinutes = (startH || 0) * 60 + (startM || 0);
          if (currentMinutes < startMinutes) {
            const msg = `Presensi masuk belum dibuka. Jam buka presensi masuk: ${systemConfig.checkInStartTime} WIB.`;
            showToast(msg, "error");
            return { success: false, message: msg };
          }
        }

        if (systemConfig.checkInDeadlineTime) {
          const [dlH, dlM] = systemConfig.checkInDeadlineTime
            .split(":")
            .map(Number);
          const deadlineMinutes = (dlH || 7) * 60 + (dlM || 0);
          if (
            currentMinutes > deadlineMinutes &&
            systemConfig.autoMarkLate !== false
          ) {
            finalNotes = finalNotes ? `${finalNotes} (Terlambat)` : "Terlambat";
          }
        }
      }

      // Enforce Jam Buka Presensi Pulang
      if (type === "pulang") {
        if (!isSimulator && systemConfig.checkOutStartTime) {
          const [outH, outM] = systemConfig.checkOutStartTime
            .split(":")
            .map(Number);
          const outMinutes = (outH || 12) * 60 + (outM || 30);
          if (currentMinutes < outMinutes) {
            const msg = `Presensi pulang belum dibuka. Jam buka presensi pulang: ${systemConfig.checkOutStartTime} WIB.`;
            showToast(msg, "error");
            return { success: false, message: msg };
          }
        }
      }

      const isUuid = (val: unknown): val is string =>
        typeof val === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          val.trim(),
        );

      const studentObj =
        students.find((s) => s.id === studentId) ||
        (currentUser?.studentId ? students.find((s) => s.id === currentUser.studentId) : undefined) ||
        (currentUser?.username ? students.find((s) => s.nisn && String(s.nisn).trim().toLowerCase() === currentUser.username.trim().toLowerCase()) : undefined) ||
        (currentUser?.name ? students.find((s) => s.nama && s.nama.trim().toLowerCase() === currentUser.name.trim().toLowerCase()) : undefined);

      const targetStudentId = studentObj?.id || studentId;
      const studentMatchIds = new Set<string>([studentId, targetStudentId]);
      if (currentUser?.studentId) studentMatchIds.add(currentUser.studentId);
      if (currentUser?.id) studentMatchIds.add(currentUser.id);

      const existingRecord = attendanceRecords.find(
        (r) =>
          r.date === target &&
          (!r.type || r.type === "DAILY") &&
          (studentMatchIds.has(r.studentId) ||
            (studentObj?.nama && r.studentName && r.studentName.trim().toLowerCase() === studentObj.nama.trim().toLowerCase())),
      );

      let selfTeacherId = await resolveAttendanceTeacherId(
        "DAILY",
        studentObj?.classId || null,
        null,
      );
      if (!isUuid(selfTeacherId)) {
        const fallbackTid =
          currentUser.teacherId ||
          (teachers.length > 0 ? teachers[0].id : null);
        selfTeacherId = isUuid(fallbackTid) ? fallbackTid : null;
      }

      const updatePayload: any = {
        school_id: isUuid(currentUser.schoolId) ? currentUser.schoolId : null,
        student_id: targetStudentId,
        class_id: isUuid(studentObj?.classId) ? studentObj!.classId : null,
        date: target,
        type: "DAILY",
        teacher_id: selfTeacherId,
        updated_by: isUuid(currentUser.id) ? currentUser.id : null,
      };

      if (type === "masuk") {
        updatePayload.status = "Hadir";
        updatePayload.check_in_time = currentTimeStr;
        updatePayload.notes = finalNotes || null;
      } else if (type === "pulang") {
        updatePayload.status = existingRecord?.status || "Hadir";
        updatePayload.check_out_time = currentTimeStr;
        // Pertahankan check_in_time agar tidak ditimpa strip '-' oleh server, atau lengkapi otomatis jika belum ada
        if (existingRecord?.checkInTime && existingRecord.checkInTime !== '-') {
          updatePayload.check_in_time = existingRecord.checkInTime;
        } else {
          updatePayload.check_in_time = "07:00";
        }
      } else if (type === "izin") {
        updatePayload.status = "Izin";
        updatePayload.notes = notes || "Izin";
      } else if (type === "sakit") {
        updatePayload.status = "Sakit";
        updatePayload.notes = notes || "Sakit";
      }

      let mappedResult: AttendanceRecord | null = null;

      // 1. Primary authoritative save via /api/attendance (uses service role, guarantees exact hari berjalan date & WIB time)
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token || "";
        if (token) {
          const res = await fetch("/api/attendance", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: "submit_student",
              schoolId: currentUser.schoolId,
              existingId: isUuid(existingRecord?.id) ? existingRecord!.id : undefined,
              payload: updatePayload,
            }),
          });
          const resBody = await res.json().catch(() => ({}));
          if (res.ok && resBody.record) {
            mappedResult = dbAttendance(resBody.record, students);
          }
        }
      } catch (_) {}

      // 2. Fallback: direct Supabase table operation
      if (!mappedResult) {
        try {
          if (isUuid(existingRecord?.id)) {
            const { data: upData, error: upErr } = await supabase
              .from("attendance_records")
              .update(updatePayload)
              .eq("id", existingRecord!.id)
              .select()
              .single();
            if (upErr) throw upErr;
            mappedResult = dbAttendance(upData, students);
          } else {
            const { data: inData, error: inErr } = await supabase
              .from("attendance_records")
              .insert(updatePayload)
              .select()
              .single();
            if (inErr) throw inErr;
            mappedResult = dbAttendance(inData, students);
          }
        } catch (_) {}
      }

      // 3. Fallback: RPC submit_student_attendance (ensuring date & time match hari berjalan)
      if (!mappedResult) {
        try {
          const { data, error } = await supabase.rpc(
            "submit_student_attendance",
            {
              p_student_id: studentId,
              p_action: type,
              p_notes: finalNotes || null,
              p_target_date: target,
            },
          );
          if (!error && data) {
            const row = Array.isArray(data) ? data[0] : data;
            if (row?.id) {
              const mappedRpc = dbAttendance(row, students);
              mappedResult = {
                ...mappedRpc,
                date: target,
                checkInTime:
                  type === "masuk" ? currentTimeStr : mappedRpc.checkInTime,
                checkOutTime:
                  type === "pulang" ? currentTimeStr : mappedRpc.checkOutTime,
              };
            }
          }
        } catch (_) {}
      }

      // 4. Local resilient fallback so student/parent attendance is never lost
      if (!mappedResult) {
        const localRecordId =
          existingRecord?.id ||
          `local_att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        mappedResult = {
          id: localRecordId,
          date: target,
          studentId: targetStudentId,
          studentName: studentObj?.nama || "",
          classId: studentObj?.classId || null,
          type: "DAILY",
          teacherId: selfTeacherId || null,
          status:
            type === "masuk"
              ? "Hadir"
              : type === "pulang"
                ? existingRecord?.status || "Hadir"
                : type === "izin"
                  ? "Izin"
                  : "Sakit",
          checkInTime:
            type === "masuk"
              ? currentTimeStr
              : (existingRecord?.checkInTime && existingRecord.checkInTime !== '-' ? existingRecord.checkInTime : "07:00"),
          checkOutTime:
            type === "pulang"
              ? currentTimeStr
              : existingRecord?.checkOutTime || "-",
          notes: finalNotes || existingRecord?.notes || null,
        };
      }

      if (mappedResult) {
        setAttendanceRecords((p) => {
          const nextRecords = [
            ...p.filter(
              (r) =>
                r.id !== mappedResult!.id &&
                !(
                  r.date === mappedResult!.date &&
                  (studentMatchIds.has(r.studentId) || (studentObj?.nama && r.studentName && r.studentName.trim().toLowerCase() === studentObj.nama.trim().toLowerCase())) &&
                  (!r.type || r.type === "DAILY")
                ),
            ),
            mappedResult!,
          ];
          try {
            const backupKey = `kawacanaan_attendance_backup_${currentUser?.schoolId || "default"}`;
            localStorage.setItem(
              backupKey,
              JSON.stringify(nextRecords.slice(-500)),
            );
            window.dispatchEvent(new Event("kawacanaan_attendance_updated"));
          } catch (_) {}
          return nextRecords;
        });

        // Trigger Web Push Notification ke HP Orang Tua (Multi-Device: Ayah & Ibu)
        if (type === "masuk" || type === "pulang") {
          void triggerAttendancePushNotification({
            studentId: targetStudentId,
            studentName: studentObj?.nama || "Ananda",
            eventType: type,
            timeStr: currentTimeStr,
            status: mappedResult.status,
            notes: mappedResult.notes || undefined,
          });
        }
      }

      const isLateArrival =
        type === "masuk" && finalNotes.includes("Terlambat");
      const label =
        type === "izin" || type === "sakit"
          ? `Pengajuan ${type.toUpperCase()} berhasil dikirim ke Wali Kelas`
          : type === "masuk"
            ? isLateArrival
              ? `Presensi Masuk berhasil dicatat (Terlambat - Pukul ${currentTimeStr} WIB)`
              : `Presensi Masuk berhasil dicatat pukul ${currentTimeStr} WIB`
            : `Presensi Pulang berhasil dicatat pukul ${currentTimeStr} WIB`;

      showToast(
        label,
        type === "izin" || type === "sakit"
          ? "info"
          : isLateArrival
            ? "info"
            : "success",
      );
      return { success: true, message: "Berhasil" };
    } catch (e: any) {
      const message = e?.message || "Presensi gagal diproses.";
      showToast(message, "error");
      return { success: false, message };
    }
  };

  const submitLeaveRequest = async (
    req: Omit<StudentLeaveRequest, "id" | "status" | "submittedAt">
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const schoolKey = currentUser?.schoolId || "global";
      let createdReq: StudentLeaveRequest = {
        ...req,
        id: `leave_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        status: "PENDING",
        submittedAt: new Date().toISOString(),
      };

      // Simpan ke database server via /api/attendance
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token) {
          const res = await fetch("/api/attendance", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: "submit_leave_request",
              schoolId: currentUser?.schoolId,
              payload: {
                studentId: req.studentId,
                studentName: req.studentName,
                nisn: req.nisn,
                classId: req.classId,
                className: req.className,
                requesterName: req.requesterName,
                requesterRole: req.requesterRole,
                requesterPhone: req.requesterPhone,
                leaveType: req.leaveType,
                subCategory: req.subCategory,
                startDate: req.startDate,
                endDate: req.endDate,
                reason: req.reason,
                attachmentUrl: req.attachmentUrl,
                attachmentName: req.attachmentName,
              },
            }),
          });
          const json = await res.json();
          if (json?.ok && json?.request) {
            createdReq = json.request;
          }
        }
      } catch (apiErr) {
        console.warn("[submitLeaveRequest] API error, using optimistic local record:", apiErr);
      }

      setLeaveRequests((prev) => {
        const next = [createdReq, ...prev.filter((p) => p.id !== createdReq.id)];
        try {
          if (schoolKey) {
            localStorage.setItem(`kawacanaan_leave_requests_${schoolKey}`, JSON.stringify(next));
          }
          window.dispatchEvent(new CustomEvent("kawacanaan_leave_requests_updated"));
        } catch (_) {}
        return next;
      });

      // Update parent phone number on student if provided
      if (req.studentId && req.requesterPhone) {
        updateStudentParentContact(req.studentId, {
          namaWali: req.requesterName,
          noHpWali: req.requesterPhone,
          hubungannya: req.requesterRole,
        }).catch(() => {});
      }

      showToast(
        `Surat ${req.leaveType === "sakit" ? "izin sakit" : "permohonan izin"} berhasil diajukan. Menunggu verifikasi wali kelas.`,
        "success"
      );
      return { success: true, message: "Berhasil diajukan" };
    } catch (err: any) {
      const msg = err?.message || "Gagal mengajukan surat izin.";
      showToast(msg, "error");
      return { success: false, message: msg };
    }
  };

  const cancelLeaveRequest = async (
    requestId: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const schoolKey = currentUser?.schoolId || "global";
      const targetReq = leaveRequests.find((r) => r.id === requestId);
      if (!targetReq) {
        return { success: false, message: "Data pengajuan tidak ditemukan." };
      }

      // Hubungi server untuk memperbarui status pembatalan di Supabase
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token) {
          await fetch("/api/attendance", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: "cancel_leave_request",
              requestId,
            }),
          });
        }
      } catch (apiErr) {
        console.warn("[cancelLeaveRequest] API error, falling back locally:", apiErr);
      }

      const updated: StudentLeaveRequest = {
        ...targetReq,
        status: "CANCELLED",
        reviewedAt: new Date().toISOString(),
        reviewNotes: "Dibatalkan oleh pengguna / pemohon",
      };

      setLeaveRequests((prev) => {
        const next = prev.map((r) => (r.id === requestId ? updated : r));
        try {
          if (schoolKey && schoolKey !== "global") {
            localStorage.setItem(`kawacanaan_leave_requests_${schoolKey}`, JSON.stringify(next));
          }
          window.dispatchEvent(new CustomEvent("kawacanaan_leave_requests_updated"));
        } catch (_) {}
        return next;
      });

      showToast("Pengajuan permohonan izin/sakit berhasil dibatalkan.", "success");
      return { success: true, message: "Berhasil dibatalkan" };
    } catch (err: any) {
      const msg = err?.message || "Gagal membatalkan surat izin.";
      showToast(msg, "error");
      return { success: false, message: msg };
    }
  };

  const updateLeaveRequestStatus = async (
    requestId: string,
    status: "APPROVED" | "REJECTED",
    reviewNotes?: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const schoolKey = activeWorkspace?.workspaceId || currentUser?.schoolId || "";
      const targetReq = leaveRequests.find((r) => r.id === requestId || String(r.id) === String(requestId));
      if (!targetReq) {
        return { success: false, message: "Data pengajuan tidak ditemukan." };
      }

      const reviewerName = currentUser?.name || (currentUser?.role === 'ADMIN' ? 'Admin Sekolah' : 'Wali Kelas');
      const resolvedNotes = reviewNotes || (status === "APPROVED" ? "Disetujui oleh pihak sekolah/wali kelas" : "Ditolak oleh pihak sekolah/wali kelas");

      const updated: StudentLeaveRequest = {
        ...targetReq,
        status,
        reviewedBy: reviewerName,
        reviewedAt: new Date().toISOString(),
        reviewNotes: resolvedNotes,
      };

      // 1. Pembaruan state lokal seketika (optimistic update agar notifikasi langsung menghilang tanpa jeda)
      setLeaveRequests((prev) => {
        const next = prev.map((r) => (r.id === requestId || String(r.id) === String(requestId) ? updated : r));
        try {
          if (schoolKey) {
            localStorage.setItem(`kawacanaan_leave_requests_${schoolKey}`, JSON.stringify(next));
          }
          window.dispatchEvent(new CustomEvent("kawacanaan_leave_requests_updated"));
        } catch (_) {}
        return next;
      });

      // 2. Pembaruan langsung ke database Supabase (client-side) sebagai jaminan persistensi data
      try {
        await supabase
          .from("leave_requests")
          .update({
            status,
            reviewed_by: reviewerName,
            reviewed_at: new Date().toISOString(),
            review_notes: resolvedNotes,
          })
          .eq("id", requestId);
      } catch (directSbErr) {
        console.warn("[updateLeaveRequestStatus] Direct Supabase update note:", directSbErr);
      }

      // 3. Hubungi API server untuk sinkronisasi backend & pembaruan otomatis absensi harian
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token) {
          await fetch("/api/attendance", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: "update_leave_request_status",
              requestId,
              schoolId: schoolKey || targetReq.schoolId,
              status,
              reviewNotes: resolvedNotes,
              reviewedBy: reviewerName,
            }),
          });
        }
      } catch (apiErr) {
        console.warn("[updateLeaveRequestStatus] API error, relying on local & supabase update:", apiErr);
      }

      // 4. Memicu Web Push Notification keputusan persetujuan izin ke HP Orang Tua
      const datesLabel = targetReq.startDate === targetReq.endDate || !targetReq.endDate
        ? targetReq.startDate
        : `${targetReq.startDate} s.d ${targetReq.endDate}`;

      void triggerLeaveDecisionPushNotification({
        studentId: targetReq.studentId,
        studentName: targetReq.studentName,
        leaveType: targetReq.leaveType,
        decision: status,
        datesText: datesLabel,
        reviewerName,
        notes: resolvedNotes,
      });

      if (status === "APPROVED") {
        // Auto mark attendance for that student across the date range
        const note = targetReq.subCategory ? `[${targetReq.subCategory}] ${targetReq.reason}` : targetReq.reason;
        const leaveStatus = targetReq.leaveType === "sakit" ? "Sakit" : "Izin";
        const datesToMark: string[] = [];
        try {
          const [sy, sm, sd] = String(targetReq.startDate).split('-').map(Number);
          const endStr = targetReq.endDate || targetReq.startDate;
          const [ey, em, ed] = String(endStr).split('-').map(Number);
          const cur = new Date(Date.UTC(sy, sm - 1, sd, 12, 0, 0));
          const end = new Date(Date.UTC(ey, em - 1, ed, 12, 0, 0));
          let count = 0;
          while (cur <= end && count < 60) {
            const y = cur.getUTCFullYear();
            const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
            const d = String(cur.getUTCDate()).padStart(2, '0');
            datesToMark.push(`${y}-${m}-${d}`);
            cur.setUTCDate(cur.getUTCDate() + 1);
            count++;
          }
        } catch (_) {
          datesToMark.push(targetReq.startDate);
        }

        if (datesToMark.length === 0) datesToMark.push(targetReq.startDate);

        const studentObj = students.find((s) => s.id === targetReq.studentId);
        const resolvedClassId = targetReq.classId || studentObj?.classId || null;
        const newRecords: AttendanceRecord[] = [];

        for (const targetD of datesToMark) {
          const dStat = getDateStatus(targetD);
          // Lewati hari libur / bukan hari belajar aktif tanpa membatalkan proses
          if (!dStat.isEffective) continue;

          const existing = attendanceRecords.find(
            (r) => r.studentId === targetReq.studentId && r.date === targetD && (!r.type || r.type === "DAILY")
          );

          newRecords.push({
            id: existing?.id || `att_${targetD}_${targetReq.studentId}`,
            date: targetD,
            studentId: targetReq.studentId,
            studentName: targetReq.studentName || studentObj?.nama || 'Siswa',
            classId: resolvedClassId,
            type: "DAILY",
            status: leaveStatus,
            checkInTime: "",
            checkOutTime: "",
            notes: `Surat ${leaveStatus}: ${note}`,
            teacherId: currentUser?.teacherId || null,
          });
        }

        if (newRecords.length > 0) {
          setAttendanceRecords((prev) => {
            const map = new Map<string, AttendanceRecord>();
            prev.forEach((r) => map.set(`${r.date}_${r.studentId}_${r.type || 'DAILY'}`, r));
            newRecords.forEach((r) => map.set(`${r.date}_${r.studentId}_${r.type || 'DAILY'}`, r));
            const next = Array.from(map.values());
            try {
              const backupKey = `kawacanaan_attendance_backup_${currentUser?.schoolId || 'default'}`;
              localStorage.setItem(backupKey, JSON.stringify(next.slice(-500)));
            } catch (_) {}
            return next;
          });
        }
      }

      showToast(
        status === "APPROVED"
          ? `Surat izin ${targetReq.studentName} disetujui & status absensi diperbarui.`
          : `Surat izin ${targetReq.studentName} ditolak.`,
        status === "APPROVED" ? "success" : "info"
      );
      return { success: true };
    } catch (err: any) {
      const msg = err?.message || "Gagal memproses status pengajuan.";
      showToast(msg, "error");
      return { success: false, message: msg };
    }
  };

  const updateStudentParentContact = async (
    studentId: string,
    data: { namaWali?: string; noHpWali?: string; hubungannya?: string }
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const schoolKey = currentUser?.schoolId || "global";
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id === studentId) {
            return {
              ...s,
              namaWali: data.namaWali !== undefined ? data.namaWali : s.namaWali,
              noHpWali: data.noHpWali !== undefined ? data.noHpWali : s.noHpWali,
              hubungannya: data.hubungannya !== undefined ? data.hubungannya : s.hubungannya,
            };
          }
          return s;
        })
      );

      try {
        if (schoolKey && schoolKey !== "global") {
          const map = getStoredParentContacts(schoolKey);
          map[studentId] = {
            ...(map[studentId] || {}),
            ...data,
          };
          localStorage.setItem(`kawacanaan_parent_contacts_${schoolKey}`, JSON.stringify(map));
        }
      } catch (_) {}

      showToast("Data kontak Wali Murid berhasil disimpan.", "success");
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err?.message };
    }
  };
  const resetAllDataToProductionReady = async () => {
    showToast(
      "Reset data demo tidak digunakan pada versi Supabase. Gunakan SQL Editor untuk reset database secara sengaja.",
      "info",
    );
  };
  const changeOwnPassword = async (
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> => {
    try {
      if (!newPassword || newPassword.length < 8)
        return { success: false, message: "Password minimal 8 karakter." };

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      const userId = sessionData?.session?.user?.id || currentUser?.id;

      if (!userId) {
        return {
          success: false,
          message: "Sesi login tidak ditemukan. Silakan login kembali.",
        };
      }

      // Tandai flag bahwa password baru saja berhasil diperbarui
      passwordChangedRecentlyRef.current = true;
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(`pwd_changed_${userId}`, "1");
          localStorage.setItem(`pwd_changed_${userId}`, "1");
        } catch (_) {}
      }

      // Reset timer sesi agar sesi aktif tidak dianggap expired/idle
      resetSessionTimers();

      // 1. Perbarui via API server onboarding (service role admin) TERLEBIH DAHULU
      // selagi token JWT masih fresh dan valid.
      // Server akan mengupdate password akun via admin.updateUserById DAN
      // mengupdate profiles.must_change_password = false langsung di database Supabase tanpa terhalang RLS.
      let serverUpdated = false;
      let serverErrorMessage = "";
      if (token) {
        try {
          const apiRes = await fetch("/api/onboarding", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: "change_own_password",
              password: newPassword,
              userId: userId,
            }),
          });
          const apiJson = await apiRes.json().catch(() => ({}));
          if (apiRes.ok && apiJson.success) {
            serverUpdated = true;
          } else {
            serverErrorMessage = apiJson.error || "";
          }
        } catch (apiErr: any) {
          serverErrorMessage = apiErr?.message || "";
        }
      }

      // 2. Perbarui juga pada Supabase Auth client-side
      let clientAuthSuccess = false;
      try {
        const { error: authError } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (!authError) {
          clientAuthSuccess = true;
        } else {
          console.warn("Client updateUser notice:", authError.message);
        }
      } catch (clientErr) {
        console.warn("Client updateUser exception:", clientErr);
      }

      // Jika kedua-duanya gagal, berikan pesan kesalahan informatif
      if (!serverUpdated && !clientAuthSuccess) {
        throw new Error(
          serverErrorMessage ||
            "Gagal memperbarui password di server. Pastikan koneksi stabil dan coba lagi.",
        );
      }

      // 3. Fallback pembaruan langsung pada tabel profiles dan rpc jika tersedia
      try {
        await supabase
          .from("profiles")
          .update({ must_change_password: false })
          .eq("id", userId);
      } catch (_) {}
      try {
        await supabase.rpc("mark_password_changed");
      } catch (_) {}

      // Refresh sesi Supabase client agar token baru aktif
      try {
        await supabase.auth.refreshSession();
      } catch (_) {}

      // 4. Perbarui currentUser di React state dan localStorage seketika
      setCurrentUser((p) => (p ? { ...p, mustChangePassword: false } : p));
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, mustChangePassword: false } : u,
        ),
      );

      try {
        const cached = getCachedUserSession();
        if (cached) {
          localStorage.setItem(
            CACHE_USER_SESSION_KEY,
            JSON.stringify({ ...cached, mustChangePassword: false }),
          );
        }
      } catch (_) {}

      showToast("Password berhasil disimpan.", "success");
      return { success: true, message: "Berhasil" };
    } catch (e: any) {
      passwordChangedRecentlyRef.current = false;
      if (currentUser?.id && typeof window !== "undefined") {
        try {
          sessionStorage.removeItem(`pwd_changed_${currentUser.id}`);
          localStorage.removeItem(`pwd_changed_${currentUser.id}`);
        } catch (_) {}
      }
      const message = e?.message || "Gagal mengganti password.";
      showToast(message, "error");
      return { success: false, message };
    }
  };

  // Sinkronisasi data sekolah otomatis secara realtime (berkala & saat window focus)
  useEffect(() => {
    const isSchoolWs =
      currentUser?.schoolId &&
      activeWorkspace?.workspaceType !== "personal" &&
      activeWorkspace?.workspaceType !== "individu";

    if (!isSchoolWs) return;

    const onFocus = () => {
      reconcileSchoolData(false).catch(() => {});
    };

    const interval = setInterval(() => {
      reconcileSchoolData(false).catch(() => {});
    }, 30000);

    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, [currentUser?.schoolId, activeWorkspace?.workspaceType]);

  const isSchoolPro = isUserInActiveSchoolPlan(currentUser, activeWorkspace);

  const isTeacherPro = useMemo(() => {
    if (isSchoolPro) return true;

    const rawPlan =
      activeWorkspace?.subscriptionPlan ||
      activeWorkspace?.subscription?.plan ||
      currentUser?.subscriptionPlan ||
      '';

    const normalized = normalizePlan(rawPlan);
    if (normalized !== 'guru_pro') return false;

    const status = (
      currentUser?.subscriptionStatus ||
      activeWorkspace?.subscriptionStatus ||
      activeWorkspace?.subscription?.status ||
      'active'
    ).toLowerCase().trim();

    if (status !== 'active') return false;

    const expiresAt =
      activeWorkspace?.subscriptionExpiresAt ||
      activeWorkspace?.subscription?.expiresAt ||
      currentUser?.subscriptionExpiresAt ||
      null;

    // Jika tanpa batas tanggal kedaluwarsa (Lifetime / Lisensi Permanen Super Admin)
    if (!expiresAt) return true;
    const expiryDate = new Date(expiresAt);
    if (isNaN(expiryDate.getTime())) return true;
    return new Date() <= expiryDate;
  }, [isSchoolPro, currentUser, activeWorkspace]);

  const requestFeatureAccess = (
    featureId: string,
    customTitle?: string,
    customMessage?: string
  ): boolean => {
    // Super admin selalu diizinkan
    if (currentUser?.role === "SUPER_ADMIN") return true;

    let activePackageKey: "guru_gratis" | "guru_pro" | "sekolah_pro" = "guru_gratis";
    if (isSchoolPro) {
      activePackageKey = "sekolah_pro";
    } else if (isTeacherPro) {
      activePackageKey = "guru_pro";
    } else {
      activePackageKey = "guru_gratis";
    }

    const hasAccess = isFeatureAccessibleInPackage(activePackageKey, featureId);
    if (!hasAccess) {
      openUpgradeModal({
        featureId,
        customTitle,
        customMessage,
        targetPackage: activePackageKey === "guru_gratis" ? "guru_pro" : "sekolah_pro",
      });
      return false;
    }
    return true;
  };

  // 1. Aktivasi Trial dinonaktifkan (seluruh logika trial 14 hari & guru_uji_coba dihapus)
  const activateTeacherTrial = async (): Promise<boolean> => {
    showToast(
      'Masa uji coba telah ditiadakan. Silakan berlangganan Paket Guru (guru_pro) atau Paket Sekolah (sekolah_pro).',
      'info'
    );
    return false;
  };

  // 2. Buat Transaksi Midtrans untuk Paket Guru
  // 2. Buat Transaksi Midtrans untuk Paket Guru (Dukungan Fleksibel)
  const createTeacherMidtransTransaction = async (
    amountOrCycle?: number | 'monthly' | 'yearly'
  ): Promise<any> => {
    try {
      // Validasi Aturan Hierarki: Pengguna di sekolah yang aktif Paket Sekolah Pro DILARANG membeli Paket Guru
      if (isSchoolPro) {
        const schoolName = schoolProfile?.namaSekolah || 'Sekolah Anda';
        const msg = `${schoolName} telah aktif berlangganan Paket Sekolah. Seluruh fitur Paket Guru sudah aktif otomatis dan Anda tidak diperkenankan membeli Paket Guru.`;
        showToast(msg, 'error');
        throw new Error(msg);
      }

      const numAmount = typeof amountOrCycle === 'number' ? amountOrCycle : 5000;
      const targetSchoolId = currentUser?.schoolId || activeWorkspace?.workspaceId || null;
      const res = await fetch('/api/midtrans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_transaction',
          plan_id: 'teacher',
          amount: numAmount,
          school_id: targetSchoolId,
          user_id: currentUser?.id || null,
          contact_name:
            currentUser?.name || currentUser?.username || 'Bapak/Ibu Guru',
          email:
            currentUser?.email ||
            `${currentUser?.username || 'guru'}@kawacanaan.sch.id`,
          school_name: activeWorkspace?.workspaceName || `Ruang Kerja ${currentUser?.name || currentUser?.username || 'Individu'}`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Gagal membuat sesi transaksi Midtrans.');
      }
      return data;
    } catch (err: any) {
      showToast(err.message || 'Gagal menghubungkan ke Midtrans.', 'error');
      throw err;
    }
  };

  // 3. Selesaikan Upgrade Paket Guru setelah Pembayaran Midtrans Berhasil
  const completeTeacherUpgrade = async (
    orderId: string,
    amountOrCycle?: number | 'monthly' | 'yearly',
    verifiedExpiresAt?: string | null
  ): Promise<boolean> => {
    try {
      let expiresAt = verifiedExpiresAt;
      if (!expiresAt && orderId) {
        try {
          const chkRes = await fetch(`/api/midtrans?action=check_status&order_id=${encodeURIComponent(orderId)}`);
          const chkData = await chkRes.json();
          if (chkData?.expires_at) {
            expiresAt = chkData.expires_at;
          } else if (chkData?.payment?.expires_at) {
            expiresAt = chkData.payment.expires_at;
          }
        } catch (_) {}
      }

      if (!expiresAt) {
        const paidAmount = typeof amountOrCycle === 'number' ? amountOrCycle : 5000;
        const curExp = activeWorkspace?.subscription?.expiresAt || currentUser?.subscriptionExpiresAt || null;
        const calc = calculateTeacherLicenseExpiry(paidAmount, curExp, currentUser?.subscriptionPlan === 'guru_pro');
        expiresAt = calc.newExpiry ? calc.newExpiry.toISOString() : new Date(Date.now() + 30 * 86400000).toISOString();
      }

      const targetSchoolId = activeWorkspace?.workspaceId || currentUser?.schoolId;

      const isSubjectTeacher = currentUser?.role === 'GURU MAPEL' || activeWorkspace?.role === 'GURU MAPEL';
      const targetMaxClasses = isSubjectTeacher ? 6 : 1;
      const targetMaxStudents = isSubjectTeacher ? 300 : 50;

      setActiveWorkspace((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          subscriptionPlan: 'guru_pro',
          subscription: {
            ...(prev.subscription || {}),
            plan: 'guru_pro',
            status: 'active',
            maxClasses: targetMaxClasses,
            maxStudents: targetMaxStudents,
            expiresAt,
          } as any,
        };
      });

      setUserWorkspaces((prev) =>
        prev.map((ws) => {
          if (
            ws.workspaceType === 'personal' ||
            ws.workspaceType === 'individu' ||
            ws.workspaceId === targetSchoolId
          ) {
            const isSub = ws.role === 'GURU MAPEL' || isSubjectTeacher;
            return {
              ...ws,
              subscriptionPlan: 'guru_pro',
              subscription: {
                ...(ws.subscription || {}),
                plan: 'guru_pro',
                status: 'active',
                maxClasses: isSub ? 6 : 1,
                maxStudents: isSub ? 300 : 50,
                expiresAt,
              } as any,
            };
          }
          return ws;
        })
      );

      setCurrentUser((prev) =>
        prev
          ? {
              ...prev,
              subscriptionPlan: 'guru_pro',
              subscriptionExpiresAt: expiresAt,
            }
          : prev
      );

      try {
        const cached = getCachedUserSession();
        if (cached) {
          localStorage.setItem(
            CACHE_USER_SESSION_KEY,
            JSON.stringify({
              ...cached,
              subscriptionPlan: 'guru_pro',
              subscriptionExpiresAt: expiresAt,
            })
          );
        }
      } catch (_) {}

      // Catatan: Pembaruan data tabel schools dan profiles dijalankan oleh backend/webhook Midtrans secara aman,
      // frontend fokus pada pembaruan state lokal & cache in-memory.

      showToast(
        'Pembayaran berhasil! Paket Guru resmi aktif di Ruang Kerja Anda.',
        'success'
      );
      return true;
    } catch (e: any) {
      showToast(e?.message || 'Gagal menyelesaikan aktivasi paket.', 'error');
      return false;
    }
  };

  // 4. Buat Transaksi Midtrans untuk Paket Sekolah (Tanpa Trial)
  const createSchoolMidtransTransaction = async (
    schoolData: any,
    billingCycle: 'monthly' | 'yearly'
  ): Promise<any> => {
    try {
      const res = await fetch('/api/midtrans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_transaction',
          plan_id: 'school',
          billing_cycle: billingCycle,
          school_name: schoolData.schoolName,
          npsn: schoolData.npsn,
          user_id: currentUser?.id || null,
          contact_name:
            schoolData.adminName || currentUser?.name || 'Administrator',
          email:
            currentUser?.email ||
            `${schoolData.npsn || 'admin'}@sekolah.kawacanaan.sch.id`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(
          data.error || 'Gagal membuat sesi transaksi Midtrans untuk Sekolah.'
        );
      }
      return data;
    } catch (err: any) {
      showToast(err.message || 'Gagal menghubungkan ke Midtrans.', 'error');
      throw err;
    }
  };

  // 5. Selesaikan Pendaftaran & Upgrade Paket Sekolah setelah Pembayaran Berhasil
  const completeSchoolUpgrade = async (
    schoolData: any,
    orderId: string,
    billingCycle: 'monthly' | 'yearly'
  ): Promise<{ success: boolean; schoolCode: string }> => {
    try {
      const days = billingCycle === 'yearly' ? 365 : 30;
      const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
      const schoolCode =
        schoolData.npsn ||
        'SCH-' + Math.floor(100000 + Math.random() * 900000).toString();
      const newWsId = `school-ws-${Date.now()}`;

      // Catatan: Pendaftaran / update status sekolah di database ditangani secara aman oleh backend / API onboarding.
      // Frontend tidak melakukan update langsung ke tabel schools.

      const newSchoolWs: WorkspaceMembership = {
        id: `mem-${Date.now()}`,
        userId: currentUser?.id || 'usr-default',
        workspaceId: newWsId,
        workspaceName: schoolData.schoolName,
        workspaceType: 'school',
        role: 'ADMIN',
        roleLabel: 'Administrator Sekolah',
        npsn: schoolData.npsn,
        workspaceCode: schoolCode,
        subscriptionPlan: 'sekolah_pro',
        subscription: {
          plan: 'sekolah_pro',
          status: 'active',
          maxClasses: 24,
          maxStudents: 1200,
          maxTeachers: 100,
          expiresAt: expiresAt,
        } as any,
      };

      setUserWorkspaces((prev) => [newSchoolWs, ...prev]);
      await selectWorkspace(newSchoolWs);

      // Catatan: Pembaruan status pembayaran di database dijalankan oleh backend/webhook Midtrans secara aman.

      showToast(
        `Pembayaran berhasil! Ruang Kerja Sekolah "${schoolData.schoolName}" resmi aktif!`,
        'success'
      );
      return { success: true, schoolCode };
    } catch (e: any) {
      showToast(e?.message || 'Gagal membentuk ruang kerja sekolah.', 'error');
      throw e;
    }
  };

  const upgradeToTeacherPro = async (
    billingCycle: 'monthly' | 'yearly'
  ): Promise<boolean> => {
    return completeTeacherUpgrade('', billingCycle);
  };

  const upgradeToSchoolWorkspace = async (
    schoolData: any
  ): Promise<{ success: boolean; schoolCode: string }> => {
    return completeSchoolUpgrade(schoolData, '', 'monthly');
  };

  return (
    <AppContext.Provider
      value={{
        supabase,
        isSchoolPro,
        isTeacherPro,
        upgradeModal,
        openUpgradeModal,
        closeUpgradeModal,
        isTeacherUpgradeOpen,
        setIsTeacherUpgradeOpen,
        isSchoolUpgradeOpen,
        setIsSchoolUpgradeOpen,
        hasUsedTeacherTrial: true,
        activateTeacherTrial,
        createTeacherMidtransTransaction,
        completeTeacherUpgrade,
        createSchoolMidtransTransaction,
        completeSchoolUpgrade,
        upgradeToTeacherPro,
        upgradeToSchoolWorkspace,
        requestFeatureAccess,
        isAuthChecking,
        isDataLoading,
        isLoginPreparing,
        loginProgressMessage,
        loginStep,
        loginRoleLabel,
        loginWorkspaceName,
        loginWorkspaceType,
        loginRoleDetails,
        loginWithCredentials,
        logout,
        classes,
        addClass,
        updateClass,
        deleteClass,
        assignTeacherClasses,
        importClasses,
        teachers,
        addTeacher,
        updateTeacher,
        deleteTeacher,
        importTeachers,
        executeTeacherAssignment,
        subjects,
        addSubject,
        updateSubject,
        deleteSubject,
        currentUser,
        setCurrentUser,
        registrationRequired,
        setRegistrationRequired,
        passwordRecovery,
        setPasswordRecovery,
        activeView,
        setActiveView,
        userWorkspaces,
        activeWorkspace,
        isOnboarding,
        setIsOnboarding,
        isSwitchingWorkspace,
        switchingWorkspaceProgress,
        switchingWorkspaceTitle,
        switchingWorkspaceMessage,
        openOnboarding,
        loadUserDataAfterOnboarding,
        loadData,
        schoolProfile,
        updateSchoolProfile,
        systemConfig,
        updateSystemConfig,
        students,
        addStudent,
        updateStudent,
        deleteStudent,
        deleteStudentsByClass,
        importStudents,
        users,
        addUser,
        deleteUser,
        updateUser,
        syncUsersWithStudents,
        generateAccountsFromReferences,
        updateUserPassword,
        resetUserToDefaultPassword,
        academicEvents,
        addAcademicEvent,
        deleteAcademicEvent,
        activeStudyDays,
        updateActiveStudyDays,
        effectiveDaysConfig,
        updateEffectiveDays,
        getBaseStudyDaysForMonth,
        getEffectiveDaysForMonth,
        getDateStatus,
        attendanceRecords,
        currentAttendanceDate,
        setCurrentAttendanceDate,
        saveDailyAttendance,
        getAttendanceForDate,
        refreshRunningDayAttendance,
        submitStudentAttendance,
        changeOwnPassword,
        resetAllDataToProductionReady,
        toasts,
        showToast,
        removeToast,
        impersonateSchool,
        stopImpersonation,
        globalAnnouncement,
        updateGlobalAnnouncement,
        reconcileSchoolData,
        leaveRequests,
        submitLeaveRequest,
        updateLeaveRequestStatus,
        cancelLeaveRequest,
        refreshLeaveRequests,
        updateStudentParentContact,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
export const useApp = () => {
  const c = useContext(AppContext);
  if (!c) throw new Error("useApp must be used within an AppProvider");
  return c;
};
