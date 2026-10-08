import { UserAccount, SchoolClass, Subject, Teacher, UserRole } from '../types';
import { formatHomeroomDutyLabel } from './formatTeacherTitle';

export function normalizeUserRole(rawRole: any): UserRole {
  if (!rawRole || typeof rawRole !== 'string') return 'WALI KELAS';
  const clean = rawRole.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (clean === 'SUPER_ADMIN' || clean === 'SUPERADMIN') return 'SUPER_ADMIN';
  if (clean === 'ADMIN' || clean === 'ADMINISTRATOR' || clean === 'SCHOOL_ADMIN') return 'ADMIN';
  if (clean === 'KEPALA_SEKOLAH' || clean === 'KEPSEK' || clean === 'PRINCIPAL' || clean === 'HEADMASTER') return 'KEPALA SEKOLAH';
  if (
    clean === 'WALI_KELAS' ||
    clean === 'WALI' ||
    clean === 'HOMEROOM' ||
    clean === 'HOMEROOM_TEACHER' ||
    clean === 'GURU_WALI_KELAS' ||
    clean === 'GURU_WALI'
  ) return 'WALI KELAS';
  if (
    clean === 'GURU_MAPEL' ||
    clean === 'GURU' ||
    clean === 'TEACHER' ||
    clean === 'PENDIDIK' ||
    clean === 'SUBJECT_TEACHER'
  ) return 'GURU MAPEL';
  if (clean === 'SISWA' || clean === 'STUDENT' || clean === 'MURID') return 'SISWA';
  return 'WALI KELAS';
}

export function normalizeTeacherName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b(dr|dra|drs|h|hj|prof|ir)\b\.?/gi, '')
    .replace(/,\s*(s\.pd|m\.pd|s\.pd\.i|m\.pd\.i|s\.ag|m\.ag|s\.si|m\.si|s\.kom|m\.kom|s\.e|m\.m|gr|b\.a|m\.a)\.?/gi, '')
    .replace(/\b(s\.pd|m\.pd|s\.pd\.i|m\.pd\.i|s\.ag|m\.ag|s\.si|m\.si|s\.kom|m\.kom|s\.e|m\.m|gr)\b/gi, '')
    .replace(/[^a-z0-9]/gi, '')
    .trim();
}

export function normalizeNip(nip: string | null | undefined): string {
  if (!nip) return '';
  return nip.replace(/\D/g, '').trim();
}

export interface UserRoleScope {
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isKepalaSekolah: boolean;
  isWaliKelas: boolean;
  isGuruMapel: boolean;
  isSiswa: boolean;

  currentTeacher: Teacher | null;

  assignedWaliClass: SchoolClass | null;
  assignedWaliClasses: SchoolClass[];
  assignedWaliClassId: string | null;
  assignedWaliClassName: string | null;

  assignedSubjects: Subject[];
  assignedSubjectIds: string[];
  primarySubject: Subject | null;

  accessibleClasses: SchoolClass[];
  accessibleClassIds: string[];

  roleBadgeLabel: string;
  scopeDescription: string;
}

/**
 * Resolves the UI scope from authoritative identity/assignment fields.
 *
 * SECURITY NOTE:
 * This function is intentionally fail-closed. It is only a UX filter;
 * Supabase RLS remains the actual security boundary.
 *
 * Never infer authorization from display names, the first class, or a
 * "specialized" subject fallback. Missing assignment means no access.
 */
export function getUserRoleScope(
  currentUser: UserAccount | null | undefined,
  classes: SchoolClass[],
  subjects: Subject[],
  teachers: Teacher[] = []
): UserRoleScope {
  const empty = (overrides: Partial<UserRoleScope> = {}): UserRoleScope => ({
    isSuperAdmin: false,
    isAdmin: false,
    isKepalaSekolah: false,
    isWaliKelas: false,
    isGuruMapel: false,
    isSiswa: false,
    currentTeacher: null,
    assignedWaliClass: null,
    assignedWaliClasses: [],
    assignedWaliClassId: null,
    assignedWaliClassName: null,
    assignedSubjects: [],
    assignedSubjectIds: [],
    primarySubject: null,
    accessibleClasses: [],
    accessibleClassIds: [],
    roleBadgeLabel: 'Pengguna',
    scopeDescription: '',
    ...overrides,
  });

  if (!currentUser) return empty();

  const rawRoleStr = String(currentUser.role || '');
  const teacherRole = String((currentUser as any)?.teacherRole || (currentUser as any)?.teacher_role || '');
  const isWaliByExplicitRole =
    rawRoleStr === 'WALI KELAS' ||
    rawRoleStr === 'WALI' ||
    rawRoleStr === 'wali_kelas' ||
    teacherRole === 'wali_kelas' ||
    teacherRole === 'WALI KELAS';

  let role = normalizeUserRole(rawRoleStr);
  if (isWaliByExplicitRole) {
    role = 'WALI KELAS';
  }

  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isKepalaSekolah = role === 'KEPALA SEKOLAH';
  const isSiswa = role === 'SISWA';

  // Prefer explicit teacher identity, with fallback to NIP / Name matching with normalization
  const currentTeacherId = currentUser.teacherId || null;
  const cleanUserName = normalizeTeacherName(currentUser.name);
  const userNip = normalizeNip(currentUser.nip);
  const usernameNip = /^\d{8,}$/.test(currentUser.username || '') ? normalizeNip(currentUser.username) : '';

  const currentTeacher = currentTeacherId
    ? teachers.find((teacher) => teacher.id === currentTeacherId) || null
    : teachers.find((teacher) => {
        const teacherNip = normalizeNip(teacher.nip);
        if (userNip && teacherNip && userNip === teacherNip) return true;
        if (usernameNip && teacherNip && usernameNip === teacherNip) return true;
        if (cleanUserName && teacher.nama) {
          const cleanTName = normalizeTeacherName(teacher.nama);
          if (cleanTName === cleanUserName) return true;
          if (cleanUserName.length >= 4 && (cleanTName.includes(cleanUserName) || cleanUserName.includes(cleanTName))) return true;
        }
        return false;
      }) || null;

  const effectiveTeacherId = currentTeacherId || currentTeacher?.id || null;
  const cleanTeacherName = currentTeacher?.nama ? normalizeTeacherName(currentTeacher.nama) : '';

  // Authoritative role resolution for teachers:
  // In Supabase DB: "For teacher assignment scope, classes and subject_*_assignments are authoritative."
  const hasAuthoritativeWaliClass = !!classes.find((schoolClass) => {
    if (effectiveTeacherId && schoolClass.waliKelasTeacherId === effectiveTeacherId) return true;
    if (Array.isArray(currentUser.classIds) && currentUser.classIds.includes(schoolClass.id)) return true;
    if (currentUser.classId && schoolClass.id === currentUser.classId) return true;
    if (schoolClass.waliKelasName) {
      const cleanWaliName = normalizeTeacherName(schoolClass.waliKelasName);
      if (cleanTeacherName && cleanWaliName === cleanTeacherName) return true;
      if (cleanUserName && cleanWaliName === cleanUserName) return true;
    }
    return false;
  });

  const hasAuthoritativeSubjects = !!(
    (effectiveTeacherId && subjects.some((s) => s.teacherId === effectiveTeacherId)) ||
    (currentUser.subjectId && subjects.some((s) => s.id === currentUser.subjectId))
  );

  let isWaliKelas =
    role === 'WALI KELAS' ||
    isWaliByExplicitRole ||
    (!isSuperAdmin && !isKepalaSekolah && !isSiswa && hasAuthoritativeWaliClass);
  let isGuruMapel =
    (role === 'GURU MAPEL' || (!isWaliKelas && !isSuperAdmin && !isKepalaSekolah && !isSiswa && hasAuthoritativeSubjects)) &&
    !isWaliKelas;
  let isAdmin = (role === 'ADMIN' || isSuperAdmin) && !isWaliKelas && !isGuruMapel;

  // WALI KELAS: explicit classes.wali_kelas_teacher_id relation, classIds, or verified name (Dapat mengampu hingga 2 rombel binaan)
  const assignedWaliClasses = isWaliKelas
    ? classes.filter((schoolClass) => {
        if (Array.isArray(currentUser.classIds) && currentUser.classIds.includes(schoolClass.id)) {
          return true;
        }
        if (Array.isArray(currentUser.assignedClassIds) && currentUser.assignedClassIds.includes(schoolClass.id)) {
          return true;
        }
        if (currentUser.classId && schoolClass.id === currentUser.classId) {
          return true;
        }
        if (effectiveTeacherId && schoolClass.waliKelasTeacherId === effectiveTeacherId) return true;
        if (schoolClass.waliKelasName) {
          const cleanWaliName = normalizeTeacherName(schoolClass.waliKelasName);
          if (cleanTeacherName && cleanWaliName === cleanTeacherName) return true;
          if (cleanUserName && cleanWaliName === cleanUserName) return true;
        }
        return false;
      })
    : [];

  const assignedWaliClass = assignedWaliClasses.length > 0
    ? assignedWaliClasses[0]
    : (isWaliKelas && classes.length > 0 ? classes[0] : null);

  // GURU MAPEL: subject assignment must be explicit.
  let assignedSubjects: Subject[] = [];
  if (isGuruMapel) {
    if (effectiveTeacherId) {
      assignedSubjects = subjects.filter((subject) => subject.teacherId === effectiveTeacherId);
    }
    if (currentUser.subjectId) {
      const directSubject = subjects.find((subject) => subject.id === currentUser.subjectId);
      if (directSubject && !assignedSubjects.some((subject) => subject.id === directSubject.id)) {
        assignedSubjects.push(directSubject);
      }
    }
    if (cleanTeacherName) {
      const byTeacherName = subjects.filter((s) => {
        if (!s.teacherName) return false;
        const cleanSubTeacher = normalizeTeacherName(s.teacherName);
        return cleanSubTeacher === cleanTeacherName || (cleanTeacherName.length >= 4 && cleanSubTeacher.includes(cleanTeacherName));
      });
      byTeacherName.forEach((s) => {
        if (!assignedSubjects.some((sub) => sub.id === s.id)) {
          assignedSubjects.push(s);
        }
      });
    }
    if (cleanUserName) {
      const byUserName = subjects.filter((s) => {
        if (!s.teacherName) return false;
        const cleanSubTeacher = normalizeTeacherName(s.teacherName);
        return cleanSubTeacher === cleanUserName || (cleanUserName.length >= 4 && cleanSubTeacher.includes(cleanUserName));
      });
      byUserName.forEach((s) => {
        if (!assignedSubjects.some((sub) => sub.id === s.id)) {
          assignedSubjects.push(s);
        }
      });
    }
  }

  // Class scope for Wali Kelas and Guru Mapel
  let accessibleClasses: SchoolClass[] = [];
  if (isSuperAdmin || isAdmin || isKepalaSekolah) {
    accessibleClasses = classes;
  } else if (isWaliKelas) {
    // Ruang Kerja Wali Kelas: Mendukung 1 hingga 2 rombel kelas binaan
    accessibleClasses = assignedWaliClasses.length > 0
      ? assignedWaliClasses
      : (assignedWaliClass ? [assignedWaliClass] : (classes.length > 0 ? [classes[0]] : []));
  } else if (isGuruMapel) {
    // Ruang Kerja Guru Mapel: Kapasitas maksimal 6 kelas (bisa akses data/visual hingga 6 kelas berbeda)
    const targetClassIds = new Set<string>();
    assignedSubjects.forEach((subject) => {
      (subject.targetClassIds || []).forEach((classId) => targetClassIds.add(classId));
      if (subject.targetClassNames && subject.targetClassNames.length > 0) {
        classes.forEach((c) => {
          if (subject.targetClassNames?.some((cn) => cn.trim().toLowerCase() === c.name.trim().toLowerCase())) {
            targetClassIds.add(c.id);
          }
        });
      }
    });
    if (currentUser.classIds && currentUser.classIds.length > 0) {
      currentUser.classIds.forEach((cid) => targetClassIds.add(cid));
    }
    if (currentUser.assignedClassIds && currentUser.assignedClassIds.length > 0) {
      currentUser.assignedClassIds.forEach((cid) => targetClassIds.add(cid));
    }
    
    let matched = classes.filter((schoolClass) => targetClassIds.has(schoolClass.id));
    // Ruang kerja individu: jika belum ada pemetaan spesifik, berikan kelas default pertama
    if (matched.length === 0 && !currentUser.schoolId && classes.length > 0) {
      matched = classes.slice(0, 1);
    }
    accessibleClasses = matched.slice(0, 6);
  } else if (isSiswa) {
    accessibleClasses = currentUser.classIds?.length
      ? classes.filter((schoolClass) => currentUser.classIds?.includes(schoolClass.id))
      : [];
  }

  let roleBadgeLabel: string = role;
  let scopeDescription = '';

  if (isSuperAdmin) {
    roleBadgeLabel = 'Super Admin';
    scopeDescription = 'Akses penuh ke seluruh sekolah & platform';
  } else if (isAdmin) {
    roleBadgeLabel = 'Administrator';
    scopeDescription = 'Akses penuh ke seluruh data & kelas sekolah';
  } else if (isKepalaSekolah) {
    roleBadgeLabel = 'Kepala Sekolah';
    scopeDescription = 'Akses supervisi & rekapitulasi data sekolah';
  } else if (isWaliKelas) {
    if (accessibleClasses.length > 1) {
      const classNames = accessibleClasses.map((c) => c.name.replace(/^kelas\s*/i, '')).join(' & ');
      roleBadgeLabel = `Wali Kelas ${classNames}`;
      scopeDescription = `Kewenangan Wali Kelas untuk ${accessibleClasses.length} Rombel Binaan (${accessibleClasses.map((c) => c.name).join(', ')})`;
    } else {
      const className = assignedWaliClass?.name || 'Tidak ada kelas';
      roleBadgeLabel = assignedWaliClass ? formatHomeroomDutyLabel(className) : 'Wali Kelas';
      const displayClassName = className.replace(/^kelas\s*/i, '').trim();
      scopeDescription = assignedWaliClass
        ? `Kewenangan khusus Kelas ${displayClassName}`
        : 'Belum memiliki assignment Wali Kelas';
    }
  } else if (isGuruMapel) {
    const subjectNames = assignedSubjects.map((subject) => subject.name).join(', ') || 'Tidak ada mapel';
    roleBadgeLabel = `Guru ${assignedSubjects[0]?.code || assignedSubjects[0]?.name || 'Mapel'}`;
    scopeDescription = assignedSubjects.length > 0
      ? `Kewenangan Guru Mapel (${subjectNames}) untuk ${accessibleClasses.length} Rombel`
      : 'Belum memiliki assignment Guru Mapel';
  } else if (isSiswa) {
    roleBadgeLabel = 'Siswa';
    scopeDescription = 'Portal kehadiran mandiri siswa';
  }

  return {
    isSuperAdmin,
    isAdmin,
    isKepalaSekolah,
    isWaliKelas,
    isGuruMapel,
    isSiswa,
    currentTeacher,
    assignedWaliClass,
    assignedWaliClasses,
    assignedWaliClassId: assignedWaliClass?.id || null,
    assignedWaliClassName: assignedWaliClass?.name || null,
    assignedSubjects,
    assignedSubjectIds: assignedSubjects.map((subject) => subject.id),
    primarySubject: assignedSubjects[0] || null,
    accessibleClasses,
    accessibleClassIds: accessibleClasses.map((schoolClass) => schoolClass.id),
    roleBadgeLabel,
    scopeDescription,
  };
}
