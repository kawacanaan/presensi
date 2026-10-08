import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { getUserRoleScope, normalizeUserRole } from '../utils/userScope';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import {
  Users,
  Calendar,
  Building,
  Building2,
  UserCheck,
  ClipboardList,
  BarChart2,
  FileText,
  Settings,
  ArrowRight,
  TrendingUp,
  Percent,
  CalendarCheck,
  GraduationCap,
  BookOpen,
  Sparkles,
  Zap,
  ShieldCheck,
  Clock,
  Copy,
  Check,
  Key,
  User,
  Crown,
  Award,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Printer,
  PieChart,
  CalendarX,
} from 'lucide-react';
import disneySchoolBuildingBanner from '../assets/images/disney_school_building_1790204694548.jpg';
import { TeacherLeaveApprovalModal } from '../components/TeacherLeaveApprovalModal';

interface SummaryCache {
  scopedTotal: number;
  scopedMale: number;
  scopedFemale: number;
  usersCount: number;
  studentsCount: number;
  classesCount: number;
  guruKsCount: number;
  hadirCount: number;
  sakitCount: number;
  izinCount: number;
  alfaCount: number;
  recordTotal: number;
  hadirPercent: number;
  trendData: { day: string; count: number }[];
  timestamp: number;
  cachedDate?: string;
}

export const DashboardView: React.FC = () => {
  const {
    currentUser,
    activeWorkspace,
    users,
    classes,
    subjects,
    teachers,
    students,
    attendanceRecords,
    academicEvents,
    effectiveDaysConfig,
    getEffectiveDaysForMonth,
    setActiveView,
    schoolProfile,
    systemConfig,
    currentAttendanceDate,
    isDataLoading,
    leaveRequests,
    updateLeaveRequestStatus,
    refreshLeaveRequests,
    getDateStatus,
  } = useApp();

  const [copiedCode, setCopiedCode] = useState(false);
  const [trendPeriod, setTrendPeriod] = useState<'7' | '14' | '30'>('7');
  const [showTrendDropdown, setShowTrendDropdown] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

  useEffect(() => {
    if (refreshLeaveRequests) {
      refreshLeaveRequests();
    }
  }, [refreshLeaveRequests]);

  // Workspace cache key (strictly isolated per school and role)
  const currentSchoolId = activeWorkspace?.workspaceId || currentUser?.schoolId;

  // Resolve effective role with normalization & priority
  const effectiveRole = useMemo(() => {
    const wsRole = activeWorkspace?.role || (activeWorkspace as any)?.roleKey;
    const userTeacherRole = (currentUser as any)?.teacherRole || (currentUser as any)?.teacher_role;
    if (wsRole) {
      const normalized = normalizeUserRole(wsRole);
      if (normalized) return normalized;
    }
    if (userTeacherRole) {
      const normalized = normalizeUserRole(userTeacherRole);
      if (normalized === 'WALI KELAS' || normalized === 'GURU MAPEL') return normalized;
    }
    return normalizeUserRole(currentUser?.role);
  }, [activeWorkspace?.role, (activeWorkspace as any)?.roleKey, currentUser]);

  const effectiveUser = useMemo(() => {
    if (!currentUser) return null;
    return {
      ...currentUser,
      role: effectiveRole,
      classId: activeWorkspace?.classId || currentUser.classId,
      classIds:
        activeWorkspace?.classId && (!currentUser.classIds || currentUser.classIds.length === 0)
          ? [activeWorkspace.classId]
          : currentUser.classIds,
    };
  }, [currentUser, effectiveRole, activeWorkspace?.classId]);

  // Resolve user role scope (Wali Kelas, Guru Mapel, Admin, KS)
  const userScope = useMemo(
    () => getUserRoleScope(effectiveUser, classes, subjects, teachers),
    [effectiveUser, classes, subjects, teachers]
  );

  const isPersonalWorkspace = useMemo(() => {
    return (
      activeWorkspace?.workspaceType === 'personal' ||
      activeWorkspace?.workspaceType === 'individu' ||
      currentUser?.subscriptionPlan === 'guru_uji_coba' ||
      currentUser?.subscriptionPlan === 'teacher' ||
      currentUser?.subscriptionPlan === 'guru_pro' ||
      currentUser?.subscriptionPlan === 'mulai' ||
      currentUser?.subscriptionPlan === 'guru_gratis' ||
      (!currentUser?.schoolId && currentUser?.role !== 'SUPER_ADMIN')
    );
  }, [activeWorkspace?.workspaceType, currentUser?.subscriptionPlan, currentUser?.schoolId, currentUser?.role]);

  // Role Wali Kelas: baik dari workspace role, akun profile, teacherRole, maupun assignment kelas
  const isWaliKelas = useMemo(() => {
    if (effectiveRole === 'WALI KELAS') return true;
    if (currentUser?.role === 'WALI KELAS') return true;
    if ((currentUser as any)?.teacherRole === 'wali_kelas' || (currentUser as any)?.teacherRole === 'WALI KELAS') return true;
    if ((activeWorkspace as any)?.roleKey === 'wali_kelas' || (activeWorkspace as any)?.roleKey === 'homeroom_teacher') return true;
    return userScope.isWaliKelas;
  }, [effectiveRole, currentUser, activeWorkspace, userScope.isWaliKelas]);

  const isTeacherOrWali = isWaliKelas || userScope.isGuruMapel;

  // Status role Admin Sekolah atau Kepala Sekolah di Ruang Kerja Sekolah (eksklusif jika bukan Wali Kelas / Guru Mapel)
  const isSchoolAdminOrKS = useMemo(() => {
    if (isPersonalWorkspace) return false;
    // Jika terdeteksi Wali Kelas atau Guru Mapel, MUTLAK BUKAN Admin Sekolah
    if (isWaliKelas || userScope.isWaliKelas || userScope.isGuruMapel || effectiveRole === 'WALI KELAS' || effectiveRole === 'GURU MAPEL') {
      return false;
    }
    return (
      effectiveRole === 'ADMIN' ||
      effectiveRole === 'SUPER_ADMIN' ||
      effectiveRole === 'KEPALA SEKOLAH' ||
      userScope.isAdmin ||
      userScope.isSuperAdmin ||
      userScope.isKepalaSekolah
    );
  }, [isPersonalWorkspace, isWaliKelas, userScope, effectiveRole]);

  const cacheKey = currentSchoolId
    ? `kawacanaan_summary_cache_${currentSchoolId}_${effectiveRole || 'user'}_${currentUser?.id || 'default'}`
    : null;

  // Read initial cache from localStorage to prevent zero-value flash
  const [cachedSummary, setCachedSummary] = useState<SummaryCache | null>(() => {
    try {
      if (!cacheKey) return null;
      const raw = localStorage.getItem(cacheKey);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  });

  // Month & time calculation
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const monthNames = useMemo(
    () => [
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember',
    ],
    []
  );
  const currentMonthName = monthNames[now.getMonth()];
  const effectiveDaysThisMonth = getEffectiveDaysForMonth(currentYear, currentMonth);

  const normalizeClassStr = (s?: string | null) =>
    s ? s.toLowerCase().replace(/^(kelas|kls)\s+/i, '').replace(/[^a-z0-9]/g, '') : '';

  // Nama bersih rombel kelas binaan Wali Kelas (tanpa duplikasi kata "Kelas" atau "Kls")
  const cleanWaliClassName = useMemo(() => {
    if (userScope.accessibleClasses && userScope.accessibleClasses.length > 1 && isWaliKelas) {
      return userScope.accessibleClasses
        .map((c) => (c.name || '').trim().replace(/^((kelas|kls)\s*)+/gi, '').trim())
        .filter(Boolean)
        .join(' & ');
    }
    const rawName = userScope.assignedWaliClassName || userScope.assignedWaliClass?.name || '';
    if (!rawName) return '';
    return rawName
      .trim()
      .replace(/^((kelas|kls)\s*)+/gi, '')
      .trim();
  }, [userScope.assignedWaliClassName, userScope.assignedWaliClass, userScope.accessibleClasses, isWaliKelas]);

  // Scoped students calculation based on role
  // Untuk Admin Sekolah & Kepala Sekolah serta Ruang Kerja Individu: mencakup seluruh siswa aktif
  // Untuk Wali Kelas: mencakup HANYA siswa di rombel / kelas binaan yang sah
  const scopedStudents = useMemo(() => {
    if (isSchoolAdminOrKS || isPersonalWorkspace) {
      return students;
    }
    if (isWaliKelas) {
      const targetClassIds = new Set(userScope.accessibleClasses.map((c) => c.id));
      if (userScope.assignedWaliClassId) targetClassIds.add(userScope.assignedWaliClassId);
      if (Array.isArray(currentUser?.classIds)) {
        currentUser.classIds.forEach((cid: string) => targetClassIds.add(cid));
      }
      if (currentUser?.classId) targetClassIds.add(currentUser.classId);

      const targetClassNames = new Set(
        userScope.accessibleClasses.map((c) => normalizeClassStr(c.name)).filter(Boolean)
      );
      if (userScope.assignedWaliClassName) targetClassNames.add(normalizeClassStr(userScope.assignedWaliClassName));
      if (Array.isArray(currentUser?.classNames)) {
        currentUser.classNames.forEach((cn: string) => targetClassNames.add(normalizeClassStr(cn)));
      }

      if (targetClassIds.size > 0 || targetClassNames.size > 0) {
        const byClass = students.filter((s) => {
          if (s.classId && targetClassIds.has(s.classId)) return true;
          if (s.className && targetClassNames.has(normalizeClassStr(s.className))) return true;
          return false;
        });
        return byClass;
      }
      return [];
    }
    if (userScope.isGuruMapel) {
      const accessibleClassIds = userScope.accessibleClasses.map((c) => c.id);
      const accessibleClassNames = new Set(
        userScope.accessibleClasses.map((c) => normalizeClassStr(c.name)).filter(Boolean)
      );
      if (accessibleClassIds.length > 0 || accessibleClassNames.size > 0) {
        return students.filter((s) => {
          if (s.classId && accessibleClassIds.includes(s.classId)) return true;
          if (s.className && accessibleClassNames.has(normalizeClassStr(s.className))) return true;
          return false;
        });
      }
      return isPersonalWorkspace ? students : [];
    }
    return students;
  }, [isSchoolAdminOrKS, isPersonalWorkspace, isWaliKelas, userScope, students, currentUser]);

  const scopedStudentIds = useMemo(() => new Set(scopedStudents.map((s) => s.id)), [scopedStudents]);

  // Permohonan surat izin / sakit yang menunggu verifikasi Wali Kelas
  const pendingWaliLeaveRequests = useMemo(() => {
    if (!leaveRequests) return [];
    return leaveRequests.filter((r) => {
      if (r.status !== 'PENDING') return false;
      // Isolasi sekolah: abaikan jika pengajuan milik sekolah lain
      if (currentSchoolId && r.schoolId && r.schoolId !== currentSchoolId) return false;
      if (isSchoolAdminOrKS || isPersonalWorkspace) return true;
      if (isWaliKelas) {
        const targetClassIds = new Set(userScope.accessibleClasses.map((c) => c.id));
        if (userScope.assignedWaliClassId) targetClassIds.add(userScope.assignedWaliClassId);
        const targetClassNames = new Set(
          userScope.accessibleClasses.map((c) => normalizeClassStr(c.name)).filter(Boolean)
        );
        if (userScope.assignedWaliClassName) targetClassNames.add(normalizeClassStr(userScope.assignedWaliClassName));

        if (r.classId && targetClassIds.has(r.classId)) return true;
        if (r.className && targetClassNames.has(normalizeClassStr(r.className))) return true;
        if (scopedStudentIds.has(r.studentId)) return true;
        return false;
      }
      return false;
    });
  }, [leaveRequests, currentSchoolId, isSchoolAdminOrKS, isPersonalWorkspace, isWaliKelas, userScope, scopedStudentIds]);

  // Metrics for scoped students
  const scopedTotal = (isSchoolAdminOrKS || isPersonalWorkspace ? students.length : scopedStudents.length) || 0;
  const scopedMale = scopedStudents.filter((s) => s.gender === 'L').length || 0;
  const scopedFemale = scopedStudents.filter((s) => s.gender === 'P').length || 0;

  // Tanggal hari berjalan (current running day) secara lokal disinkronkan dengan tanggal presensi aktif
  const todayDate = useMemo(() => {
    if (currentAttendanceDate) {
      const parts = currentAttendanceDate.split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
      }
    }
    return new Date();
  }, [currentAttendanceDate]);

  const todayFormatted = useMemo(() => {
    if (currentAttendanceDate) return currentAttendanceDate;
    const y = todayDate.getFullYear();
    const m = String(todayDate.getMonth() + 1).padStart(2, '0');
    const d = String(todayDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [currentAttendanceDate, todayDate]);

  const dayNamesIndo = useMemo(
    () => ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
    []
  );
  const monthShortIndo = useMemo(
    () => ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'],
    []
  );
  const currentDayName = useMemo(() => dayNamesIndo[todayDate.getDay()], [dayNamesIndo, todayDate]);

  const todayFormattedDisplay = useMemo(() => {
    return `${currentDayName}, ${todayDate.getDate()} ${
      monthShortIndo[todayDate.getMonth()]
    } ${todayDate.getFullYear()}`;
  }, [todayDate, currentDayName, monthShortIndo]);

  const isCacheValidForToday = cachedSummary?.cachedDate === todayFormatted;

  const todayDateStatus = useMemo(() => {
    if (getDateStatus) {
      return getDateStatus(todayFormatted);
    }
    return {
      isStudyDay: true,
      isHoliday: false,
      isEffective: true,
      label: 'Hari Efektif Belajar',
      badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    };
  }, [getDateStatus, todayFormatted]);

  const isTodayHoliday = !todayDateStatus.isEffective || todayDateStatus.isHoliday;

  // Daftar kelas yang diajar Guru Mapel pada hari berjalan (today)
  const classesTaughtToday = useMemo(() => {
    if (!userScope.isGuruMapel) return [];

    const matchedClassIds = new Set<string>();
    const matchedClassNames = new Set<string>();
    let hasAnyScheduleConfigured = false;

    userScope.assignedSubjects.forEach((sub) => {
      const hasSpecificClassSchedules =
        sub.classSchedules && sub.classSchedules.some((cs) => cs.days && cs.days.length > 0);

      // 1. Cek classSchedules spesifik per kelas
      if (hasSpecificClassSchedules) {
        hasAnyScheduleConfigured = true;
        sub.classSchedules!.forEach((cs) => {
          if (cs.days && cs.days.length > 0 && cs.days.includes(currentDayName)) {
            if (cs.classId) matchedClassIds.add(cs.classId);
            if (cs.className) matchedClassNames.add(cs.className.trim().toLowerCase());
          }
        });
      } else if (sub.scheduleDays && sub.scheduleDays.length > 0) {
        // 2. Cek scheduleDays umum mapel (hanya jika jadwal per kelas belum diatur)
        hasAnyScheduleConfigured = true;
        if (sub.scheduleDays.includes(currentDayName)) {
          (sub.targetClassIds || []).forEach((cid) => matchedClassIds.add(cid));
          (sub.targetClassNames || []).forEach((cn) => matchedClassNames.add(cn.trim().toLowerCase()));
          // Jika targetClassIds belum spesifik tapi accessibleClasses ada
          if (
            (!sub.targetClassIds || sub.targetClassIds.length === 0) &&
            (!sub.targetClassNames || sub.targetClassNames.length === 0)
          ) {
            userScope.accessibleClasses.forEach((c) => matchedClassIds.add(c.id));
          }
        }
      }
    });

    // 3. Fallback: jika guru mapel memiliki rombel tetapi belum diatur konfigurasi hari jadwal sama sekali
    // Pada hari efektif Senin - Sabtu, anggap mengajar di rombel binaan mapel
    if (!hasAnyScheduleConfigured && currentDayName !== 'Minggu') {
      return userScope.accessibleClasses;
    }

    return userScope.accessibleClasses.filter(
      (c) => matchedClassIds.has(c.id) || matchedClassNames.has(c.name.trim().toLowerCase())
    );
  }, [userScope, currentDayName]);

  // Siswa dari kelas yang diajar hari ini (untuk perhitungan presensi status hari berjalan Guru Mapel)
  const todayTaughtStudents = useMemo(() => {
    if (!userScope.isGuruMapel) return scopedStudents;
    const taughtClassIds = new Set(classesTaughtToday.map((c) => c.id));
    return scopedStudents.filter((s) => taughtClassIds.has(s.classId || ''));
  }, [userScope.isGuruMapel, classesTaughtToday, scopedStudents]);

  const todayTaughtStudentIds = useMemo(
    () => new Set(todayTaughtStudents.map((s) => s.id)),
    [todayTaughtStudents]
  );

  const classesTaughtTodayLabel = useMemo(() => {
    if (!userScope.isGuruMapel) return '-';
    if (classesTaughtToday.length === 0) return 'Tidak Ada';
    if (classesTaughtToday.length === 1) return classesTaughtToday[0].name;
    if (classesTaughtToday.length === 2) {
      return classesTaughtToday.map((c) => c.name.replace(/^kelas\s*/i, '')).join(', ');
    }
    return `${classesTaughtToday.length} Kelas`;
  }, [userScope.isGuruMapel, classesTaughtToday]);

  const classesTaughtTodaySubtext = useMemo(() => {
    if (!userScope.isGuruMapel) return '';
    if (classesTaughtToday.length === 0) return `Tidak ada jadwal hari ${currentDayName}`;
    if (classesTaughtToday.length <= 2) return `Jadwal hari ${currentDayName}`;
    return classesTaughtToday.map((c) => c.name.replace(/^kelas\s*/i, '')).join(', ');
  }, [userScope.isGuruMapel, classesTaughtToday, currentDayName]);

  const mapelDiampuLabel = useMemo(() => {
    if (!userScope.isGuruMapel) return '-';
    if (userScope.assignedSubjects.length === 0) {
      return userScope.primarySubject?.name || 'Mata Pelajaran';
    }
    if (userScope.assignedSubjects.length === 1) {
      return userScope.assignedSubjects[0].name;
    }
    return userScope.assignedSubjects.map((s) => s.code || s.name).join(', ');
  }, [userScope.isGuruMapel, userScope.assignedSubjects, userScope.primarySubject]);

  const mapelDiampuSubtext = useMemo(() => {
    if (!userScope.isGuruMapel) return '';
    if (userScope.assignedSubjects.length <= 1) {
      const sub = userScope.assignedSubjects[0] || userScope.primarySubject;
      return sub?.code ? `Kode: ${sub.code} • Guru Mapel` : 'Mata Pelajaran Diampu';
    }
    return `${userScope.assignedSubjects.length} Mata Pelajaran Diampu`;
  }, [userScope.isGuruMapel, userScope.assignedSubjects, userScope.primarySubject]);

  // Today's attendance calculation (strictly following hari berjalan / tanggal aktif)
  // Untuk Admin Sekolah & Kepala Sekolah serta Ruang Kerja Individu: mencakup akumulasi presensi siswa
  const todayRecords = useMemo(() => {
    return attendanceRecords.filter((r) => {
      // Mengikuti hari berjalan secara akurat
      if (r.date !== todayFormatted) return false;

      if (isSchoolAdminOrKS || isPersonalWorkspace) {
        // Akumulasi data absensi semua siswa di sekolah atau ruang kerja individu
        return true;
      }

      if (isWaliKelas) {
        return scopedStudentIds.has(r.studentId) && r.type !== 'SUBJECT';
      }
      if (userScope.isGuruMapel) {
        // Siswa dari rombel/kelas yang diajar hari ini atau scoped
        if (todayTaughtStudentIds.size > 0) {
          if (!todayTaughtStudentIds.has(r.studentId)) return false;
        } else if (scopedStudentIds.size > 0 && !scopedStudentIds.has(r.studentId)) {
          return false;
        }

        const assignedSubjectIds = new Set(userScope.assignedSubjectIds);
        if (assignedSubjectIds.size > 0) {
          return (
            r.type === 'SUBJECT' &&
            r.subjectId &&
            assignedSubjectIds.has(r.subjectId)
          );
        }
        return r.type === 'SUBJECT';
      }
      return r.type !== 'SUBJECT';
    });
  }, [attendanceRecords, todayFormatted, isSchoolAdminOrKS, isPersonalWorkspace, userScope, scopedStudentIds, todayTaughtStudentIds]);

  // Pemetaan status unik per siswa untuk hari berjalan (mencegah duplikasi perhitungan)
  // Prioritaskan presensi harian (DAILY) jika siswa juga memiliki record mapel (SUBJECT)
  const todayStudentStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    const sorted = [...todayRecords].sort((a, b) => {
      if (a.type !== 'SUBJECT' && b.type === 'SUBJECT') return -1;
      if (a.type === 'SUBJECT' && b.type !== 'SUBJECT') return 1;
      return 0;
    });
    for (const r of sorted) {
      if (!map.has(r.studentId) && r.status && r.status !== '-') {
        map.set(r.studentId, r.status);
      }
    }
    // Fallback: periksa juga jika ada surat izin resmi yang telah disetujui (APPROVED) untuk hari ini
    if (leaveRequests && leaveRequests.length > 0) {
      for (const lr of leaveRequests) {
        if (
          lr.status === 'APPROVED' &&
          lr.startDate <= todayFormatted &&
          (lr.endDate || lr.startDate) >= todayFormatted
        ) {
          if (!map.has(lr.studentId)) {
            map.set(lr.studentId, lr.leaveType === 'sakit' ? 'Sakit' : 'Izin');
          }
        }
      }
    }
    return map;
  }, [todayRecords, leaveRequests, todayFormatted]);

  const hadirCount = useMemo(() => {
    let count = 0;
    for (const status of todayStudentStatusMap.values()) {
      if (status === 'Hadir') count++;
    }
    return count;
  }, [todayStudentStatusMap]);

  const sakitCount = useMemo(() => {
    let count = 0;
    for (const status of todayStudentStatusMap.values()) {
      if (status === 'Sakit') count++;
    }
    return count;
  }, [todayStudentStatusMap]);

  const izinCount = useMemo(() => {
    let count = 0;
    for (const status of todayStudentStatusMap.values()) {
      if (status === 'Izin') count++;
    }
    return count;
  }, [todayStudentStatusMap]);

  const alfaCount = useMemo(() => {
    let count = 0;
    for (const status of todayStudentStatusMap.values()) {
      if (status === 'Alfa') count++;
    }
    return count;
  }, [todayStudentStatusMap]);

  // Target total siswa yang harus diinput presensinya hari ini (untuk Guru Mapel disesuaikan dengan rombel yang diajarkan hari ini)
  const targetTotal = (isSchoolAdminOrKS || isPersonalWorkspace ? students.length : userScope.isGuruMapel ? (todayTaughtStudents.length || scopedTotal) : scopedTotal) || 0;

  // Jumlah siswa yang datanya telah di-input hari ini
  const totalInputted = todayStudentStatusMap.size;

  // Jumlah siswa yang belum di-input hari ini
  const totalBelumInput = Math.max(0, targetTotal - totalInputted);

  // Status kelengkapan penginputan presensi hari berjalan
  const isAttendanceInputtedToday = totalInputted > 0;
  const isAttendanceFullyInputted = targetTotal > 0 && totalInputted >= targetTotal;

  // Persentase data yang telah di-input
  const inputPercent = targetTotal > 0 ? Math.round((totalInputted / targetTotal) * 100) : 0;

  // Persentase kehadiran hari ini disesuaikan dengan data yang telah di-input atau belum di-input:
  // - Jika belum di-input sama sekali -> 0%
  // - Jika sudah di-input -> (Hadir / Target Total Siswa) * 100
  const hadirPercent = targetTotal > 0 ? Math.round((hadirCount / targetTotal) * 100) : 0;
  const hadirPercentOfInputted = totalInputted > 0 ? Math.round((hadirCount / totalInputted) * 100) : 0;

  // 7-day trend data (Sab, Min, Sen, Sel, Rab, Kam, Jum)
  // Untuk Admin Sekolah & Kepala Sekolah: mengakumulasi seluruh data kehadiran dari semua kelas di sekolah
  const dayNames = useMemo(() => ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'], []);
  const trendData = useMemo(() => {
    if (attendanceRecords.length === 0 && cachedSummary?.trendData && isCacheValidForToday) {
      return cachedSummary.trendData;
    }
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dy = d.getFullYear();
      const dm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dStr = `${dy}-${dm}-${dd}`;

      if (isSchoolAdminOrKS || isPersonalWorkspace) {
        // Akumulasi data absensi semua siswa di sekolah atau ruang kerja individu
        const dayMap = new Map<string, string>();
        const dayRecs = attendanceRecords.filter((r) => r.date === dStr);
        const sortedDayRecs = [...dayRecs].sort((a, b) => {
          if (a.type !== 'SUBJECT' && b.type === 'SUBJECT') return -1;
          if (a.type === 'SUBJECT' && b.type !== 'SUBJECT') return 1;
          return 0;
        });
        for (const r of sortedDayRecs) {
          if (!dayMap.has(r.studentId) && r.status && r.status !== '-') {
            dayMap.set(r.studentId, r.status);
          }
        }
        let hCount = 0;
        for (const status of dayMap.values()) {
          if (status === 'Hadir') hCount++;
        }
        return {
          day: dayNames[d.getDay()],
          count: hCount,
        };
      }

      const recs = attendanceRecords.filter((r) => {
        if (r.date !== dStr) return false;
        if (isWaliKelas) {
          return scopedStudentIds.has(r.studentId) && r.type !== 'SUBJECT';
        }
        if (userScope.isGuruMapel) {
          const assignedSubjectIds = new Set(userScope.assignedSubjectIds);
          if (assignedSubjectIds.size > 0) {
            return (
              scopedStudentIds.has(r.studentId) &&
              r.type === 'SUBJECT' &&
              r.subjectId &&
              assignedSubjectIds.has(r.subjectId)
            );
          }
          return scopedStudentIds.has(r.studentId) && r.type === 'SUBJECT';
        }
        return r.type !== 'SUBJECT';
      });
      const hCount = recs.filter((r) => r.status === 'Hadir').length;
      return {
        day: dayNames[d.getDay()],
        count: hCount,
      };
    });
  }, [attendanceRecords, cachedSummary?.trendData, isCacheValidForToday, dayNames, isSchoolAdminOrKS, userScope, scopedStudentIds]);

  // Save calculated summary to localStorage cache for lightning-fast next load
  useEffect(() => {
    if (!isDataLoading && (students.length > 0 || users.length > 0 || classes.length > 0)) {
      const summaryToCache: SummaryCache = {
        scopedTotal,
        scopedMale,
        scopedFemale,
        usersCount: users.length,
        studentsCount: students.length,
        classesCount: classes.length,
        guruKsCount: users.filter(
          (u) =>
            u.role === 'GURU MAPEL' ||
            u.role === 'WALI KELAS' ||
            u.role === 'KEPALA SEKOLAH'
        ).length,
        hadirCount,
        sakitCount,
        izinCount,
        alfaCount,
        recordTotal: targetTotal,
        hadirPercent,
        trendData,
        timestamp: Date.now(),
        cachedDate: todayFormatted,
      };
      try {
        localStorage.setItem(cacheKey, JSON.stringify(summaryToCache));
      } catch (_) {}
    }
  }, [
    isDataLoading,
    cacheKey,
    scopedTotal,
    scopedMale,
    scopedFemale,
    users,
    students,
    classes,
    hadirCount,
    sakitCount,
    izinCount,
    alfaCount,
    targetTotal,
    hadirPercent,
    trendData,
    todayFormatted,
  ]);

  // Agenda Mendatang: hanya untuk bulan berjalan dan tanggal yang belum terlewat (>= tanggal hari ini)
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const currentDay = String(now.getDate()).padStart(2, '0');
    const todayFormatted = `${currentYear}-${currentMonth}-${currentDay}`;
    const currentMonthPrefix = `${currentYear}-${currentMonth}`;

    return academicEvents
      .filter((e) => {
        if (!e.date) return false;
        // Hanya untuk bulan berjalan
        const inCurrentMonth = e.date.startsWith(currentMonthPrefix);
        // Tanggal yang belum terlewat (>= tanggal hari ini)
        const isUpcomingOrToday = e.date >= todayFormatted;
        return inCurrentMonth && isUpcomingOrToday;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [academicEvents]);

  const menuItems = [
    {
      id: 'data-referensi',
      title: 'Data Referensi',
      desc: 'Sekolah, Guru, Siswa & Kelas',
      icon: Building,
      color: 'text-blue-600',
      bg: 'bg-blue-50 border border-blue-100',
    },
    {
      id: 'data-pengguna',
      title: 'Data Pengguna',
      desc: 'Hak Akses & Akun Sistem',
      icon: UserCheck,
      color: 'text-blue-600',
      bg: 'bg-blue-50 border border-blue-100',
    },
    {
      id: 'kalender-akademik',
      title: 'Kalender Akademik',
      desc: 'Agenda & Hari Efektif',
      icon: Calendar,
      color: 'text-blue-600',
      bg: 'bg-blue-50 border border-blue-100',
    },
    {
      id: 'absensi',
      title: 'Absensi Siswa',
      desc: cleanWaliClassName
        ? `Presensi Kelas ${cleanWaliClassName}`
        : userScope.primarySubject?.name
        ? `Presensi Mapel ${userScope.primarySubject.name}`
        : 'Presensi & Validasi Harian',
      icon: ClipboardList,
      color: 'text-blue-600',
      bg: 'bg-blue-50 border border-blue-100',
    },
    {
      id: 'portal-siswa',
      title: 'Portal Siswa & Wali Murid',
      desc: 'Simulasi Mandiri & Pantau Orang Tua',
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50 border border-blue-100',
    },
    {
      id: 'rekapitulasi',
      title: 'Rekapitulasi',
      desc: 'Statistik & Matriks Bulanan',
      icon: BarChart2,
      color: 'text-blue-600',
      bg: 'bg-blue-50 border border-blue-100',
    },
    {
      id: 'laporan',
      title: userScope.isKepalaSekolah ? 'Laporan Kepala Sekolah' : 'Laporan',
      desc: userScope.isKepalaSekolah
        ? 'Rekap Bulanan, Semester & Tahunan'
        : 'Cetak & Ekspor Dokumen',
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50 border border-blue-100',
    },
    {
      id: 'pengaturan',
      title: 'Pengaturan Sistem',
      desc: 'Konfigurasi & Jam Real-Time',
      icon: Settings,
      color: 'text-blue-600',
      bg: 'bg-blue-50 border border-blue-100',
    },
  ] as const;

  const allowedMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (!currentUser) return false;

      // 0. Ruang Kerja Individu: Pendidik mandiri memiliki kontrol penuh atas data dan Pengaturan Sistem
      if (isPersonalWorkspace) {
        if (item.id === 'portal-siswa') return false;
        return true;
      }

      // 1. Wali Kelas: HANYA 5 menu yang relevan
      if (isWaliKelas) {
        return [
          'data-referensi',
          'kalender-akademik',
          'absensi',
          'rekapitulasi',
          'laporan',
        ].includes(item.id);
      }

      // 2. Guru Mapel: 5 menu yang relevan
      if (
        effectiveRole === 'GURU MAPEL' ||
        currentUser.role === 'GURU MAPEL' ||
        userScope.isGuruMapel
      ) {
        return [
          'data-referensi',
          'kalender-akademik',
          'absensi',
          'rekapitulasi',
          'laporan',
        ].includes(item.id);
      }

      // 3. Kepala Sekolah
      if (
        effectiveRole === 'KEPALA SEKOLAH' ||
        currentUser.role === 'KEPALA SEKOLAH' ||
        userScope.isKepalaSekolah
      ) {
        return [
          'data-referensi',
          'kalender-akademik',
          'portal-siswa',
          'rekapitulasi',
          'laporan',
          'pengaturan',
        ].includes(item.id);
      }

      // 4. Admin Sekolah & Super Admin
      if (
        isSchoolAdminOrKS ||
        effectiveRole === 'ADMIN' ||
        effectiveRole === 'SUPER_ADMIN' ||
        currentUser.role === 'ADMIN' ||
        currentUser.role === 'SUPER_ADMIN'
      ) {
        if (item.id === 'portal-siswa') return false;
        return true;
      }

      return false;
    });
  }, [currentUser, menuItems, isPersonalWorkspace, isWaliKelas, effectiveRole, isSchoolAdminOrKS, userScope]);

  // Role-specific widgets definition
  const toneClasses: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-100 text-blue-600',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    violet: 'bg-violet-50 border-violet-100 text-violet-600',
    sky: 'bg-sky-50 border-sky-100 text-sky-600',
    amber: 'bg-amber-50 border-amber-100 text-amber-600',
  };

  const usersCountDisplay = users.length || cachedSummary?.usersCount || 0;
  const studentsCountDisplay = students.length || cachedSummary?.studentsCount || 0;
  const classesCountDisplay = classes.length || cachedSummary?.classesCount || 0;
  const guruKsCountDisplay =
    users.filter(
      (u) =>
        u.role === 'GURU MAPEL' ||
        u.role === 'WALI KELAS' ||
        u.role === 'KEPALA SEKOLAH'
    ).length || cachedSummary?.guruKsCount || 0;

  // Calculated percentage for clean single-meaning metrics
  const malePercent = scopedTotal > 0 ? Math.round((scopedMale / scopedTotal) * 100) : 0;
  const femalePercent = scopedTotal > 0 ? Math.round((scopedFemale / scopedTotal) * 100) : 0;

  // Show Skeleton Loader if data is completely empty and currently loading
  const isInitialEmptyLoad = isDataLoading && !cachedSummary && students.length === 0 && users.length === 0;

  if (!currentUser) {
    return <DashboardSkeleton isTeacherOrWali={isTeacherOrWali} />;
  }

  if (isInitialEmptyLoad) {
    return <DashboardSkeleton isTeacherOrWali={isTeacherOrWali} />;
  }

  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1560px] mx-auto px-3 sm:px-4 lg:px-5 py-2 sm:py-2.5 space-y-2 sm:space-y-2.5 animate-in fade-in duration-200">
      
      {/* 1. Spanduk Hero (Sleek Commercial SaaS Enterprise Banner) */}
      <div className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs bg-gradient-to-r from-blue-50/80 via-white to-sky-50/40 flex flex-col md:flex-row items-stretch justify-between min-h-[80px] sm:min-h-[88px] lg:h-[90px]">
        {/* Left: Title + Subtitle */}
        <div className="p-3 sm:p-3.5 lg:p-4 flex-1 z-10 flex flex-col justify-center space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base lg:text-lg font-black text-slate-900 tracking-tight leading-tight">
              {isWaliKelas
                ? `Panel Kontrol Wali Kelas ${cleanWaliClassName}`.trim()
                : userScope.isGuruMapel
                ? `Panel Kontrol Guru Mata Pelajaran`
                : isSchoolAdminOrKS
                ? 'Panel Kontrol Administrator Sekolah'
                : isPersonalWorkspace
                ? 'Panel Kontrol Ruang Kerja Mandiri'
                : 'Panel Kontrol Utama'}
            </h1>
            {isWaliKelas && cleanWaliClassName && (
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black border border-blue-200">
                Rombel {cleanWaliClassName}
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-500 font-medium max-w-xl truncate leading-normal">
            {isWaliKelas
              ? `Monitoring kehadiran siswa ${cleanWaliClassName ? `kelas ${cleanWaliClassName}` : 'kelas binaan'} dan verifikasi permohonan izin/sakit siswa.`
              : isPersonalWorkspace
              ? 'Monitoring kehadiran kelas binaan, jadwal mengajar, dan rekapitulasi mandiri secara akurat.'
              : userScope.isGuruMapel
              ? `Presensi mata pelajaran ${userScope.primarySubject?.name || 'diampu'} (${userScope.accessibleClasses.length} rombel).`
              : 'Monitoring data kehadiran siswa sekolah, rombel kelas, direktori guru, dan rekapitulasi real-time.'}
          </p>
        </div>

        {/* Right: Gedung Sekolah Animasi Bergaya Disney */}
        <div className="relative flex items-center justify-end shrink-0 md:w-[35%] lg:w-[40%] overflow-hidden min-h-[55px] md:min-h-auto">
          {/* Panoramic Disney Pixar Animation Style School Building */}
          <div className="absolute inset-0 z-0">
            <img
              src={disneySchoolBuildingBanner}
              alt="Gedung Sekolah Animasi Bergaya Disney"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/images/disney_school_building.jpg';
              }}
            />
            {/* Smooth gradient blend overlay on the left */}
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/50 to-transparent w-2/5" />
          </div>
        </div>
      </div>

      {/* Notifikasi Permohonan Surat Izin / Sakit Menunggu Verifikasi */}
      {pendingWaliLeaveRequests.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 via-amber-50/90 to-orange-50/80 border border-amber-300 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <FileText size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xs sm:text-sm text-amber-950">
                  {pendingWaliLeaveRequests.length} Surat Izin / Sakit Menunggu Verifikasi
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black animate-pulse">
                  Baru
                </span>
              </div>
              <p className="text-[11px] text-amber-900 font-medium">
                {isWaliKelas
                  ? `Orang tua siswa ${cleanWaliClassName ? `Kelas ${cleanWaliClassName}` : 'kelas binaan'} telah mengajukan surat permohonan izin/sakit.`
                  : 'Terdapat permohonan surat izin/sakit dari orang tua siswa yang menunggu tindak lanjut sekolah.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsLeaveModalOpen(true)}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FileText size={13} />
              <span>Verifikasi Surat Izin</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* 2. Stat Cards: 5 Cards for Administrator, 4 Cards for Wali Kelas / Guru Mapel */}
      {isSchoolAdminOrKS ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5">
          {/* Admin Card 1: Total Siswa Sekolah */}
          <div
            onClick={() => setActiveView('data-referensi')}
            className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs hover:shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Users size={17} className="stroke-[2.2]" />
              </div>
              <ArrowRight size={14} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
            </div>

            <div className="my-1.5">
              <p className="text-[11px] font-semibold text-slate-500">Jumlah Siswa</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                {studentsCountDisplay}
              </p>
            </div>

            <div className="flex items-center justify-between gap-1 text-[10px] font-bold">
              <span className="text-slate-500 truncate">{classesCountDisplay} Rombel</span>
              <span className="inline-flex items-center text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100/80 shrink-0">
                Siswa Aktif
              </span>
            </div>
          </div>

          {/* Admin Card 2: Rombongan Belajar */}
          <div
            onClick={() => setActiveView('data-referensi')}
            className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs hover:shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Building size={17} className="stroke-[2.2]" />
              </div>
              <ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
            </div>

            <div className="my-1.5">
              <p className="text-[11px] font-semibold text-slate-500">Rombel Kelas</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                {classesCountDisplay}
              </p>
            </div>

            <div className="flex items-center justify-between gap-1 text-[10px] font-bold">
              <span className="text-slate-500 truncate">Semua Tingkat</span>
              <span className="inline-flex items-center text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100/80 shrink-0">
                Terdaftar
              </span>
            </div>
          </div>

          {/* Admin Card 3: Guru & Tendik */}
          <div
            onClick={() => setActiveView('data-referensi')}
            className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs hover:shadow-xs hover:border-violet-300 transition-all flex flex-col justify-between group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 border border-violet-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Award size={17} className="stroke-[2.2]" />
              </div>
              <ArrowRight size={14} className="text-slate-300 group-hover:text-violet-600 group-hover:translate-x-0.5 transition-all" />
            </div>

            <div className="my-1.5">
              <p className="text-[11px] font-semibold text-slate-500">Guru & Tendik</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                {guruKsCountDisplay}
              </p>
            </div>

            <div className="flex items-center justify-between gap-1 text-[10px] font-bold">
              <span className="text-slate-500 truncate">Pendidik</span>
              <span className="inline-flex items-center text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-100/80 shrink-0">
                Aktif
              </span>
            </div>
          </div>

          {/* Admin Card 4: Pengguna Sistem */}
          <div
            onClick={() => setActiveView('data-pengguna')}
            className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs hover:shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <UserCheck size={17} className="stroke-[2.2]" />
              </div>
              <ArrowRight size={14} className="text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
            </div>

            <div className="my-1.5">
              <p className="text-[11px] font-semibold text-slate-500">Pengguna Sistem</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                {usersCountDisplay}
              </p>
            </div>

            <div className="flex items-center justify-between gap-1 text-[10px] font-bold">
              <span className="text-slate-500 truncate">Akun Terdaftar</span>
              <span className="inline-flex items-center text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100/80 shrink-0">
                Akses Aktif
              </span>
            </div>
          </div>

          {/* Admin Card 5: Hari Efektif Belajar */}
          <div
            onClick={() => setActiveView('kalender-akademik')}
            className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs hover:shadow-xs hover:border-amber-300 transition-all flex flex-col justify-between group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Calendar size={17} className="stroke-[2.2]" />
              </div>
              <ArrowRight size={14} className="text-slate-300 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
            </div>

            <div className="my-1.5">
              <p className="text-[11px] font-semibold text-slate-500">Hari Efektif</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                {effectiveDaysThisMonth} Hari
              </p>
            </div>

            <div className="flex items-center justify-between gap-1 text-[10px] font-bold">
              <span className="text-slate-500 truncate">Bulan {currentMonthName}</span>
              <span className="inline-flex items-center text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100/80 shrink-0">
                Target Semester
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Wali Kelas / Guru Mapel: 4 Cards tailored specifically for class scope */
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
          {/* Card 1: Siswa Binaan */}
          <div
            onClick={() => setActiveView('data-referensi')}
            className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs hover:shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Users size={17} className="stroke-[2.2]" />
              </div>
              <ArrowRight size={14} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
            </div>

            <div className="my-1.5">
              <p className="text-[11px] font-semibold text-slate-500">
                {isWaliKelas
                  ? cleanWaliClassName
                    ? `Siswa Kelas ${cleanWaliClassName}`
                    : 'Siswa Kelas Binaan'
                  : 'Siswa Rombel Diajar'}
              </p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                {scopedTotal}
              </p>
            </div>

            <div className="flex items-center justify-between gap-1 text-[10px] font-bold">
              <span className="text-slate-500 truncate">
                {isWaliKelas
                  ? (cleanWaliClassName ? `Kelas ${cleanWaliClassName}` : 'Kelas Binaan')
                  : `${userScope.accessibleClasses.length} Rombel Diajar`}
              </span>
              <span className="inline-flex items-center text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100/80 shrink-0">
                {isWaliKelas ? 'Binaan' : 'Siswa Aktif'}
              </span>
            </div>
          </div>

          {/* Card 2: Siswa Laki-Laki */}
          <div
            onClick={() => setActiveView('data-referensi')}
            className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs hover:shadow-xs hover:border-teal-300 transition-all flex flex-col justify-between group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <UserCheck size={17} className="stroke-[2.2]" />
              </div>
              <ArrowRight size={14} className="text-slate-300 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all" />
            </div>

            <div className="my-1.5">
              <p className="text-[11px] font-semibold text-slate-500">Siswa Laki-Laki</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                {scopedMale}
              </p>
            </div>

            <div className="flex items-center justify-between gap-1 text-[10px] font-bold">
              <span className="text-slate-500">Proporsi</span>
              <span className="inline-flex items-center text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100/80 shrink-0">
                {malePercent}% dari kelas
              </span>
            </div>
          </div>

          {/* Card 3: Siswa Perempuan */}
          <div
            onClick={() => setActiveView('data-referensi')}
            className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs hover:shadow-xs hover:border-pink-300 transition-all flex flex-col justify-between group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-pink-50 text-pink-600 border border-pink-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <User size={17} className="stroke-[2.2]" />
              </div>
              <ArrowRight size={14} className="text-slate-300 group-hover:text-pink-600 group-hover:translate-x-0.5 transition-all" />
            </div>

            <div className="my-1.5">
              <p className="text-[11px] font-semibold text-slate-500">Siswa Perempuan</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                {scopedFemale}
              </p>
            </div>

            <div className="flex items-center justify-between gap-1 text-[10px] font-bold">
              <span className="text-slate-500">Proporsi</span>
              <span className="inline-flex items-center text-pink-700 bg-pink-50 px-2 py-0.5 rounded-full border border-pink-100/80 shrink-0">
                {femalePercent}% dari kelas
              </span>
            </div>
          </div>

          {/* Card 4: Hari Efektif Belajar */}
          <div
            onClick={() => setActiveView('kalender-akademik')}
            className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs hover:shadow-xs hover:border-amber-300 transition-all flex flex-col justify-between group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Calendar size={17} className="stroke-[2.2]" />
              </div>
              <ArrowRight size={14} className="text-slate-300 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
            </div>

            <div className="my-1.5">
              <p className="text-[11px] font-semibold text-slate-500">Hari Efektif</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                {effectiveDaysThisMonth} Hari
              </p>
            </div>

            <div className="flex items-center justify-between gap-1 text-[10px] font-bold">
              <span className="text-slate-500 truncate">
                {totalInputted > 0 ? `${hadirCount} Hadir (${hadirPercent}%)` : `Bulan ${currentMonthName}`}
              </span>
              <span className="inline-flex items-center text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100/80 shrink-0">
                {totalInputted > 0 ? `${hadirCount}/${scopedTotal} Siswa` : 'Semester Ini'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Three Aligned Widgets: Tren Kehadiran + Grafik Lingkaran + Status Hari Ini */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2.5 items-stretch">
        
        {/* Widget 1: Tren Kehadiran (7 Hari) */}
        <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs flex flex-col justify-between h-[215px] sm:h-[225px]">
          {/* Header */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <TrendingUp size={14} className="stroke-[2.2]" />
              </div>
              <h2 className="font-bold text-slate-900 text-xs sm:text-sm">
                {isWaliKelas
                  ? `Tren Kehadiran ${cleanWaliClassName ? `Kelas ${cleanWaliClassName}` : 'Kelas Binaan'} (${trendPeriod} Hari)`
                  : isSchoolAdminOrKS
                  ? `Tren Kehadiran Sekolah (${trendPeriod} Hari)`
                  : `Tren Kehadiran (${trendPeriod} Hari)`}
              </h2>
            </div>

            {/* Filter Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTrendDropdown(!showTrendDropdown)}
                className="px-2 py-0.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[10px] font-semibold text-slate-700 inline-flex items-center gap-1 transition-colors cursor-pointer select-none"
              >
                <span>{trendPeriod} Hari</span>
                <ChevronDown size={10} className="text-slate-400" />
              </button>
              {showTrendDropdown && (
                <div className="absolute right-0 top-full mt-1 w-28 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95 duration-100 text-left">
                  {(['7', '14', '30'] as const).map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => {
                        setTrendPeriod(period);
                        setShowTrendDropdown(false);
                      }}
                      className={`w-full text-left px-2.5 py-1 text-xs font-semibold hover:bg-blue-50 hover:text-blue-600 transition-colors ${
                        trendPeriod === period ? 'text-blue-600 font-bold bg-blue-50/50' : 'text-slate-700'
                      }`}
                    >
                      {period} Hari
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Dedicated Line Chart */}
          <div className="w-full h-28 sm:h-32 my-auto relative">
            <svg viewBox="0 0 320 120" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="trendBlueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Gridlines */}
              {(() => {
                const maxVal = Math.max((isSchoolAdminOrKS ? students.length : scopedTotal) || 24, 10);
                return [maxVal, Math.round(maxVal * 0.5), 0].map((val, idx) => {
                  const y = 10 + idx * 45;
                  return (
                    <g key={idx}>
                      <line x1="28" y1={y} x2="310" y2={y} stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                      <text x="22" y={y + 3} textAnchor="end" fontSize="8" fill="#94A3B8" fontWeight="600">
                        {val}
                      </text>
                    </g>
                  );
                });
              })()}

              {/* Area & Polyline */}
              {(() => {
                const maxVal = Math.max((isSchoolAdminOrKS ? students.length : scopedTotal) || 24, 10);
                const countPoints = trendData.length;
                const stepX = (310 - 32) / Math.max(countPoints - 1, 1);
                const points = trendData.map((d, i) => {
                  const x = 32 + i * stepX;
                  const ratio = Math.min(Math.max(d.count / maxVal, 0), 1);
                  const y = 100 - ratio * 90;
                  return { x, y };
                });

                const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                const areaPath = `${linePath} L ${points[points.length - 1]?.x || 310} 100 L ${points[0]?.x || 32} 100 Z`;

                return (
                  <>
                    <path d={areaPath} fill="url(#trendBlueGradient)" />
                    <path d={linePath} fill="none" stroke="#2563EB" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    {points.map((pt, idx) => (
                      <g key={idx} className="cursor-pointer group">
                        <circle cx={pt.x} cy={pt.y} r="3.5" className="fill-blue-600 stroke-white stroke-2 group-hover:scale-125 transition-transform" />
                        <title>{`${trendData[idx]?.day}: ${trendData[idx]?.count} Siswa Hadir`}</title>
                      </g>
                    ))}
                  </>
                );
              })()}

              {/* X Labels */}
              {(() => {
                const countPoints = trendData.length;
                const stepX = (310 - 32) / Math.max(countPoints - 1, 1);
                return trendData.map((item, idx) => {
                  const x = 32 + idx * stepX;
                  return (
                    <text key={item.day} x={x} y="115" textAnchor="middle" fontSize="8" fill="#64748B" fontWeight="600">
                      {item.day}
                    </text>
                  );
                });
              })()}
            </svg>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] font-semibold text-slate-500">
            <span>Puncak: {Math.max(...trendData.map(d => d.count), 0)} siswa</span>
            <span className="text-blue-600 font-bold">
              {isWaliKelas ? (userScope.assignedWaliClassName ? `Rombel ${userScope.assignedWaliClassName.replace(/^(kelas|kls)\s+/i, '')}` : 'Kelas Binaan') : isSchoolAdminOrKS ? 'Seluruh Sekolah' : 'Tren Terpantau'}
            </span>
          </div>
        </div>

        {/* Widget 2: Grafik Lingkaran */}
        <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs flex flex-col justify-between h-[215px] sm:h-[225px]">
          {/* Header */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <PieChart size={14} className="stroke-[2.2]" />
              </div>
              <h2 className="font-bold text-slate-900 text-xs sm:text-sm">
                {isWaliKelas
                  ? `Distribusi Presensi ${cleanWaliClassName ? `Kelas ${cleanWaliClassName}` : 'Kelas Binaan'}`
                  : isSchoolAdminOrKS
                  ? 'Distribusi Presensi Sekolah'
                  : 'Grafik Lingkaran'}
              </h2>
            </div>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
              {isWaliKelas ? 'Kelas Binaan' : 'Distribusi'}
            </span>
          </div>

          {/* Donut Chart with Center Label & Legend */}
          <div className="flex items-center justify-center gap-3 my-auto">
            {/* Donut SVG */}
            <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                {/* Track */}
                <circle cx="50" cy="50" r="38" fill="none" stroke="#F1F5F9" strokeWidth="12" />

                {/* Hadir (Emerald) */}
                {hadirCount > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="12"
                    strokeDasharray={`${(hadirCount / Math.max(targetTotal, 1)) * 238.76} 238.76`}
                    strokeDashoffset="0"
                  />
                )}

                {/* Sakit (Sky) */}
                {sakitCount > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="12"
                    strokeDasharray={`${(sakitCount / Math.max(targetTotal, 1)) * 238.76} 238.76`}
                    strokeDashoffset={`-${(hadirCount / Math.max(targetTotal, 1)) * 238.76}`}
                  />
                )}

                {/* Izin (Amber) */}
                {izinCount > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="12"
                    strokeDasharray={`${(izinCount / Math.max(targetTotal, 1)) * 238.76} 238.76`}
                    strokeDashoffset={`-${((hadirCount + sakitCount) / Math.max(targetTotal, 1)) * 238.76}`}
                  />
                )}

                {/* Alfa (Rose) */}
                {alfaCount > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="12"
                    strokeDasharray={`${(alfaCount / Math.max(targetTotal, 1)) * 238.76} 238.76`}
                    strokeDashoffset={`-${((hadirCount + sakitCount + izinCount) / Math.max(targetTotal, 1)) * 238.76}`}
                  />
                )}
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-black text-slate-900 tracking-tight leading-none">
                  {totalInputted > 0 ? `${hadirPercent}%` : '0%'}
                </span>
                <span className={`text-[8px] font-bold tracking-wider uppercase mt-0.5 ${totalInputted > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {totalInputted > 0 ? 'HADIR' : 'BELUM INPUT'}
                </span>
              </div>
            </div>

            {/* Legend column */}
            <div className="space-y-1 text-[10px] font-semibold text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0" />
                <span className="truncate">Hadir: <strong className="text-slate-900">{hadirCount}</strong> <span className="text-slate-400 font-normal">({targetTotal > 0 ? Math.round((hadirCount / targetTotal) * 100) : 0}%)</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-500 inline-block shrink-0" />
                <span className="truncate">Sakit: <strong className="text-slate-900">{sakitCount}</strong> <span className="text-slate-400 font-normal">({targetTotal > 0 ? Math.round((sakitCount / targetTotal) * 100) : 0}%)</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block shrink-0" />
                <span className="truncate">Izin: <strong className="text-slate-900">{izinCount}</strong> <span className="text-slate-400 font-normal">({targetTotal > 0 ? Math.round((izinCount / targetTotal) * 100) : 0}%)</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block shrink-0" />
                <span className="truncate">Alfa: <strong className="text-slate-900">{alfaCount}</strong> <span className="text-slate-400 font-normal">({targetTotal > 0 ? Math.round((alfaCount / targetTotal) * 100) : 0}%)</span></span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] font-semibold text-slate-500">
            <span>
              Total: {targetTotal} Siswa {isWaliKelas ? `(${cleanWaliClassName ? `Kelas ${cleanWaliClassName}` : 'Binaan'})` : isSchoolAdminOrKS ? '(Sekolah)' : ''}
            </span>
            <span className={totalInputted > 0 ? "text-indigo-600 font-bold" : "text-slate-400 font-medium"}>
              {totalInputted > 0 ? `${totalInputted} Terdata (${inputPercent}%)` : 'Belum Ada Input'}
            </span>
          </div>
        </div>

        {/* Widget 3: Status Hari Ini */}
        <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs flex flex-col justify-between h-[215px] sm:h-[225px]">
          {/* Header */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Clock size={14} className="stroke-[2.2]" />
              </div>
              <h2 className="font-bold text-slate-900 text-xs sm:text-sm">
                {isWaliKelas
                  ? `Status Presensi ${cleanWaliClassName ? `Kelas ${cleanWaliClassName}` : 'Kelas Binaan'}`
                  : isSchoolAdminOrKS
                  ? 'Status Presensi Sekolah'
                  : 'Status Hari Ini'}
              </h2>
            </div>
            <span className="text-[10px] text-slate-500 font-medium truncate max-w-[130px]">
              {todayFormattedDisplay}
            </span>
          </div>

          {/* Widget Content: 4 Status Cards or Explanation for Guru Mapel on Holiday / Off-Day */}
          {userScope.isGuruMapel && isTodayHoliday ? (
            <div
              onClick={() => setActiveView('absensi')}
              className="my-auto p-3 rounded-xl bg-rose-50/80 border border-rose-200/80 flex items-center gap-3 cursor-pointer hover:bg-rose-100/70 transition-colors shadow-2xs"
            >
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 border border-rose-200">
                <CalendarX size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-black text-rose-950 truncate">Hari Libur Sekolah</p>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-rose-200 text-rose-800">
                    Libur
                  </span>
                </div>
                <p className="text-[10px] text-rose-800 line-clamp-1 mt-0.5">
                  {todayDateStatus.eventTitle || todayDateStatus.label || 'KBM Diliburkan'}
                </p>
              </div>
            </div>
          ) : userScope.isGuruMapel && classesTaughtToday.length === 0 ? (
            <div
              onClick={() => setActiveView('absensi')}
              className="my-auto p-3 rounded-xl bg-slate-50 border border-slate-200/90 flex items-center gap-3 cursor-pointer hover:bg-slate-100 transition-colors shadow-2xs"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200">
                <BookOpen size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-black text-slate-900 truncate">Bukan Hari Mengajar</p>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-slate-200 text-slate-700">
                    {currentDayName}
                  </span>
                </div>
                <p className="text-[10px] text-slate-600 line-clamp-1 mt-0.5">
                  {classesTaughtTodaySubtext || `Tidak ada jadwal mengajar pada hari ${currentDayName}`}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 my-auto">
              {/* Hadir */}
              <div
                onClick={() => setActiveView('absensi')}
                className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-100 hover:border-emerald-300 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-700">Hadir</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </div>
                <p className="text-base font-black text-slate-900 mt-0.5">{hadirCount}</p>
              </div>

              {/* Sakit */}
              <div
                onClick={() => setActiveView('absensi')}
                className="p-2 rounded-lg bg-sky-50/70 border border-sky-100 hover:border-sky-300 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-sky-700">Sakit</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                </div>
                <p className="text-base font-black text-slate-900 mt-0.5">{sakitCount}</p>
              </div>

              {/* Izin */}
              <div
                onClick={() => setActiveView('absensi')}
                className="p-2 rounded-lg bg-amber-50/70 border border-amber-100 hover:border-amber-300 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-700">Izin</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                </div>
                <p className="text-base font-black text-slate-900 mt-0.5">{izinCount}</p>
              </div>

              {/* Alfa */}
              <div
                onClick={() => setActiveView('absensi')}
                className="p-2 rounded-lg bg-rose-50/70 border border-rose-100 hover:border-rose-300 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-rose-700">Alfa</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                </div>
                <p className="text-base font-black text-slate-900 mt-0.5">{alfaCount}</p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-500">
            <span className="truncate">
              {userScope.isGuruMapel && isTodayHoliday
                ? 'KBM & Presensi Ditiadakan'
                : userScope.isGuruMapel && classesTaughtToday.length === 0
                ? `Tidak ada jadwal hari ${currentDayName}`
                : totalInputted === 0
                ? 'Belum ada presensi diinput'
                : isAttendanceFullyInputted
                ? '✓ Seluruh siswa terdata'
                : `${totalInputted} terdata • ${totalBelumInput} belum`}
            </span>
            <div className="flex items-center gap-1.5 shrink-0 ml-1">
              {(isWaliKelas || isSchoolAdminOrKS) && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsLeaveModalOpen(true)}
                    className="font-bold text-amber-700 hover:text-amber-800 hover:underline flex items-center gap-0.5 cursor-pointer"
                    title="Buka permohonan surat izin / sakit siswa"
                  >
                    <FileText size={11} />
                    <span>Surat Izin{pendingWaliLeaveRequests.length > 0 ? ` (${pendingWaliLeaveRequests.length})` : ''}</span>
                  </button>
                  <span className="text-slate-300">•</span>
                </>
              )}
              <button
                onClick={() => setActiveView('absensi')}
                className="font-bold text-blue-600 hover:text-blue-800 hover:underline shrink-0 cursor-pointer"
              >
                {userScope.isGuruMapel && (isTodayHoliday || classesTaughtToday.length === 0)
                  ? 'Buka Presensi'
                  : isWaliKelas
                  ? (totalInputted > 0 && isAttendanceFullyInputted ? 'Detail Presensi' : 'Input Presensi')
                  : totalInputted > 0 && isAttendanceFullyInputted
                  ? 'Detail'
                  : 'Input Presensi'}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* 4. Bottom Section: Agenda Mendatang (4 Cols) + Action Banner (8 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-2.5">
        
        {/* Left: Agenda Mendatang (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100">
            <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs sm:text-sm">
              <Calendar size={15} className="text-blue-600" />
              <span>Agenda Mendatang</span>
            </div>
            <button
              onClick={() => setActiveView('kalender-akademik')}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
            >
              Lihat Semua
            </button>
          </div>

          <div className="space-y-1.5 my-auto">
            {upcomingEvents.length === 0 ? (
              <div className="py-4 text-center text-slate-400 bg-slate-50/70 rounded-lg border border-dashed border-slate-200">
                <Calendar size={18} className="mx-auto mb-1 text-slate-300" />
                <p className="text-[11px] font-semibold text-slate-600">Tidak ada agenda mendatang bulan ini</p>
                <p className="text-[9px] text-slate-400">Kalender akademik telah up-to-date</p>
              </div>
            ) : (
              upcomingEvents.slice(0, 2).map((ev) => (
                <div
                  key={ev.id}
                  className="bg-slate-50 hover:bg-blue-50/50 transition-colors rounded-lg p-2 flex items-center gap-2 border border-slate-100"
                >
                  <div className="w-8 h-8 rounded-md bg-white border border-blue-200 flex flex-col items-center justify-center shrink-0 text-center shadow-2xs">
                    <span className="text-[7px] font-bold text-slate-400 uppercase leading-none">
                      {ev.dateDisplay.split(' ')[1] || 'AGU'}
                    </span>
                    <span className="text-xs font-black text-blue-600 leading-none mt-0.5">
                      {ev.dateDisplay.split(' ')[0] || '17'}
                    </span>
                  </div>
                  <div className="truncate min-w-0">
                    <p className="font-bold text-slate-800 text-[11px] truncate">{ev.title}</p>
                    <p className="text-[9px] text-slate-500 truncate">
                      {ev.isEffective ? 'Hari efektif' : 'Libur sekolah'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-1.5 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Kalender Akademik {currentYear}</span>
            <span className="font-medium">{upcomingEvents.length} Acara Terjadwal</span>
          </div>
        </div>

        {/* Right: Big Action Banner (8 cols) - Enterprise SaaS Styling */}
        <div className="lg:col-span-8 bg-gradient-to-r from-[#0F1E4A] via-[#162D6E] to-[#1E3A8A] rounded-xl p-3 sm:p-4 text-white shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="max-w-md z-10 space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/10 text-blue-200 text-[9px] font-bold uppercase tracking-wider">
              <Building2 size={11} className="text-blue-300" />
              <span>
                {isWaliKelas
                  ? `Presensi Rombel ${cleanWaliClassName || 'Binaan'}`
                  : isSchoolAdminOrKS
                  ? 'Manajemen Sekolah'
                  : 'Manajemen Presensi'}
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-bold tracking-tight text-white">
              {isWaliKelas
                ? `Administrasi Presensi Kelas ${cleanWaliClassName || 'Binaan'}`
                : currentUser?.role === 'KEPALA SEKOLAH'
                ? 'Supervisi Kehadiran Sekolah'
                : 'Efisiensi Administrasi Terkendali'}
            </h3>
            <p className="text-blue-100/80 text-[11px] leading-snug">
              {isWaliKelas
                ? `Input kehadiran harian ${cleanWaliClassName ? `kelas ${cleanWaliClassName}` : 'kelas binaan'}, verifikasi permohonan surat izin/sakit orang tua, dan unduh dokumen rekapitulasi semester.`
                : 'Pantau kehadiran berkala, sinkronisasi data kelas, dan rekapitulasi semester secara otomatis dan transparan.'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 mt-2.5 z-10">
            {currentUser?.role === 'KEPALA SEKOLAH' ? (
              <button
                id="btn-banner-rekapitulasi"
                onClick={() => setActiveView('rekapitulasi')}
                className="px-3.5 py-1.5 bg-[#0070F3] hover:bg-blue-600 active:scale-95 text-white font-extrabold text-xs rounded-lg shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Rekapitulasi Presensi</span>
                <ArrowRight size={13} />
              </button>
            ) : isWaliKelas ? (
              <button
                id="btn-banner-mulai-absensi"
                onClick={() => setActiveView('absensi')}
                className="px-3.5 py-1.5 bg-[#0070F3] hover:bg-blue-600 active:scale-95 text-white font-extrabold text-xs rounded-lg shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Absensi {cleanWaliClassName ? `Kelas ${cleanWaliClassName}` : 'Kelas Binaan'}</span>
                <ArrowRight size={13} />
              </button>
            ) : (
              <button
                id="btn-banner-mulai-absensi"
                onClick={() => setActiveView('absensi')}
                className="px-3.5 py-1.5 bg-[#0070F3] hover:bg-blue-600 active:scale-95 text-white font-extrabold text-xs rounded-lg shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Absensi Siswa</span>
                <ArrowRight size={13} />
              </button>
            )}
            <button
              id="btn-banner-cetak-laporan"
              onClick={() => setActiveView('laporan')}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs rounded-lg border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={12} className="text-blue-200" />
              <span>{isWaliKelas ? 'Laporan Kelas' : 'Cetak Laporan'}</span>
            </button>
          </div>

          {/* 3D Laptop Illustration on Far Right - Blends seamlessly with gradient mask */}
          <div className="hidden sm:block absolute right-0 bottom-0 top-0 w-36 md:w-48 lg:w-56 pointer-events-none overflow-hidden select-none [mask-image:linear-gradient(to_left,black_65%,transparent)]">
            <img
              src="/images/laptop_books_plant_3d.jpg"
              alt="Ilustrasi Administrasi 3D"
              className="w-full h-full object-contain object-right-bottom mix-blend-screen opacity-95"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/images/blog_3d_idea_laptop.jpg';
              }}
            />
          </div>
        </div>

      </div>

      {/* 5. Menu Navigasi Section (Slightly larger, balanced & no truncated text) */}
      <div className="space-y-2.5 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4.5 bg-blue-600 rounded-full" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900">Menu Navigasi</h2>
          </div>
          <span className="text-xs text-slate-500 font-semibold">
            {allowedMenuItems.length} Menu Tersedia • {userScope.roleBadgeLabel}
          </span>
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${
          allowedMenuItems.length === 6
            ? 'xl:grid-cols-3'
            : allowedMenuItems.length === 5
            ? 'xl:grid-cols-3 2xl:grid-cols-5'
            : 'xl:grid-cols-4'
        } gap-3 sm:gap-3.5`}>
          {allowedMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                id={`btn-menu-${item.id}`}
                onClick={() => setActiveView(item.id as any)}
                className="bg-white hover:bg-blue-50/60 hover:border-blue-400 border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 flex items-center gap-3.5 sm:gap-4 shadow-2xs hover:shadow-xs transition-all group cursor-pointer active:scale-98 text-left min-h-[76px] sm:min-h-[84px]"
              >
                <div
                  className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl ${item.bg} ${item.color} flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 shadow-2xs`}
                >
                  <Icon size={21} className="sm:w-[22px] sm:h-[22px] stroke-[2.2]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-slate-900 text-sm sm:text-[15px] group-hover:text-blue-600 transition-colors leading-snug">
                    {item.title}
                  </p>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-relaxed mt-0.5 sm:mt-1">
                    {item.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Dashboard Footer (Copyright aligned to bottom right) */}
      <footer className="pt-3 pb-1 border-t border-slate-200/80 flex items-center justify-end text-right text-[10px] text-slate-400 font-medium">
        <p>
          {systemConfig.footerCopyright || '© 2026 Kawacanaan by Maulana Yusuf. All Rights Reserved.'}
        </p>
      </footer>

      {/* Teacher Leave Approval Modal */}
      {isLeaveModalOpen && (
        <TeacherLeaveApprovalModal
          isOpen={isLeaveModalOpen}
          onClose={() => setIsLeaveModalOpen(false)}
          leaveRequests={leaveRequests || []}
          onUpdateStatus={updateLeaveRequestStatus}
          selectedClassName={userScope.assignedWaliClassName || undefined}
          selectedClassId={userScope.assignedWaliClassId || undefined}
          schoolId={currentSchoolId}
        />
      )}
    </div>
  );
};

