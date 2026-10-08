import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { AttendanceRecord, AttendanceStatus, AttendanceType } from '../types';
import { getUserRoleScope } from '../utils/userScope';
import { getFaseByClassName, formatClassDisplay } from '../utils/faseKurikulum';
import { normalizeClassToken } from '../utils/documentParser';
import { getServerNow, formatServerDateString, syncServerTime } from '../utils/serverTime';
import {
  ArrowLeft,
  ClipboardList,
  Calendar,
  CheckCircle2,
  LogOut,
  RotateCcw,
  Save,
  Clock,
  BookOpen,
  UserCheck,
  Sparkles,
  Info,
  GraduationCap,
  FileText,
  Check,
  Lock,
  ShieldCheck,
  Loader2,
  QrCode,
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  ArrowRightLeft,
  X,
  CalendarX,
  CalendarCheck,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';
import { ClassQrModal } from '../components/ClassQrModal';
import { TeacherLeaveApprovalModal } from '../components/TeacherLeaveApprovalModal';

const isClassMatch = (nameA?: string | null, nameB?: string | null) => {
  if (!nameA || !nameB) return false;
  const clean = (s: string) => s.toLowerCase().replace(/^(kelas|kls)\s+/i, '').replace(/[^a-z0-9]/g, '');
  return clean(nameA) === clean(nameB);
};

const checkClassSchedule = (
  sub: { classSchedules?: { classId?: string; className?: string; days?: string[] }[]; scheduleDays?: string[]; targetClassIds?: string[]; targetClassNames?: string[] },
  cls: { id: string; name: string },
  day: string
): boolean => {
  if (!day) return false;
  const hasSpecific = sub.classSchedules && sub.classSchedules.some((cs) => cs.days && cs.days.length > 0);
  if (hasSpecific) {
    const cs = sub.classSchedules!.find(
      (item) => item.classId === cls.id || isClassMatch(item.className, cls.name)
    );
    return !!(cs && cs.days && cs.days.includes(day));
  }
  if (sub.scheduleDays && sub.scheduleDays.length > 0) {
    const isTarget =
      !sub.targetClassIds ||
      sub.targetClassIds.length === 0 ||
      sub.targetClassIds.includes(cls.id) ||
      (sub.targetClassNames && sub.targetClassNames.some((cn) => isClassMatch(cn, cls.name)));
    return isTarget && sub.scheduleDays.includes(day);
  }
  return false;
};

export const AbsensiView: React.FC = () => {
  const {
    students,
    subjects,
    classes,
    teachers,
    currentUser,
    activeWorkspace,
    systemConfig,
    activeStudyDays,
    schoolProfile,
    currentAttendanceDate,
    setCurrentAttendanceDate,
    getAttendanceForDate,
    saveDailyAttendance,
    getDateStatus,
    setActiveView,
    showToast,
    attendanceRecords,
    requestFeatureAccess,
    leaveRequests,
    updateLeaveRequestStatus,
    refreshLeaveRequests,
  } = useApp();

  const isPersonalWorkspace =
    activeWorkspace?.workspaceType === 'personal' ||
    activeWorkspace?.workspaceType === 'individu' ||
    (currentUser?.subscriptionPlan === 'mulai' && !currentUser?.schoolId) ||
    !currentUser?.schoolId;

  useEffect(() => {
    refreshLeaveRequests();
  }, [refreshLeaveRequests]);

  const userScope = useMemo(
    () => getUserRoleScope(currentUser, classes, subjects, teachers),
    [currentUser, classes, subjects, teachers]
  );

  const isWaliKelasRole =
    currentUser?.role === 'WALI KELAS' || userScope.isWaliKelas;
  const isGuruMapelRole =
    !isWaliKelasRole && (currentUser?.role === 'GURU MAPEL' || userScope.isGuruMapel);

  const isTeacherOrWali = useMemo(() => {
    return (
      currentUser?.role === 'WALI KELAS' ||
      currentUser?.role === 'GURU MAPEL' ||
      userScope.isWaliKelas ||
      userScope.isGuruMapel
    );
  }, [currentUser?.role, userScope.isWaliKelas, userScope.isGuruMapel]);

  const initialMode: AttendanceType = isGuruMapelRole ? 'SUBJECT' : 'DAILY';

  const [date, setDate] = useState<string>(() =>
    formatServerDateString(getServerNow())
  );
  const [attendanceMode, setAttendanceMode] = useState<AttendanceType>(initialMode);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showArchivedRecords, setShowArchivedRecords] = useState<boolean>(false);
  const [allowExtraSession, setAllowExtraSession] = useState<boolean>(false);

  // Pastikan tampilan default Menu Absensi Siswa selalu mengikuti hari berjalan
  // baik di Ruang Kerja Individu maupun Ruang Kerja Sekolah
  useEffect(() => {
    const runningToday = formatServerDateString(getServerNow());
    setDate(runningToday);
    setCurrentAttendanceDate(runningToday);
    if (isWaliKelasRole) {
      setAttendanceMode('DAILY');
      if (userScope.assignedWaliClassId) {
        setSelectedClassId(userScope.assignedWaliClassId);
      }
    }
    syncServerTime()
      .then(() => {
        const syncedToday = formatServerDateString(getServerNow());
        if (!isDirtyRef.current) {
          setDate(syncedToday);
          setCurrentAttendanceDate(syncedToday);
        }
      })
      .catch(() => {});
    try {
      window.dispatchEvent(new Event('kawacanaan_attendance_updated'));
    } catch (_) {}
  }, [
    activeWorkspace?.workspaceId,
    activeWorkspace?.workspaceType,
    currentUser?.id,
    currentUser?.schoolId,
    currentUser?.role,
    isWaliKelasRole,
    userScope.assignedWaliClassId,
    setCurrentAttendanceDate,
  ]);

  const isGuruMapel = isGuruMapelRole || (!isWaliKelasRole && attendanceMode === 'SUBJECT');

  // Nama hari dari tanggal aktif
  const currentDayName = useMemo(() => {
    try {
      const [y, m, d] = date.split('-');
      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const dObj = new Date(Number(y), Number(m) - 1, Number(d));
      return dayNames[dObj.getDay()] || '';
    } catch {
      return '';
    }
  }, [date]);
  
  // Subject state
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => {
    if (userScope.isGuruMapel && userScope.assignedSubjects.length > 0) {
      let dayN = '';
      try {
        const [y, m, d] = currentAttendanceDate.split('-');
        const dNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        dayN = dNames[new Date(Number(y), Number(m) - 1, Number(d)).getDay()] || '';
      } catch (_) {}

      if (dayN) {
        const subWithScheduleToday = userScope.assignedSubjects.find((sub) =>
          userScope.accessibleClasses.some((c) => checkClassSchedule(sub, c, dayN))
        );
        if (subWithScheduleToday) return subWithScheduleToday.id;
      }
      return userScope.assignedSubjects[0].id;
    }
    return subjects.find((s) => s.isSpecialized)?.id || subjects[0]?.id || '';
  });

  // Class state: Untuk Guru Mapel, prioritaskan kelas yang terjadwal pada hari ini sebagai tampilan default
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    if (userScope.isWaliKelas && userScope.assignedWaliClassId) {
      return userScope.assignedWaliClassId;
    }
    if (userScope.isGuruMapel && userScope.accessibleClasses.length > 0) {
      let dayN = '';
      try {
        const [y, m, d] = currentAttendanceDate.split('-');
        const dNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        dayN = dNames[new Date(Number(y), Number(m) - 1, Number(d)).getDay()] || '';
      } catch (_) {}

      if (dayN) {
        const subsToCheck = userScope.assignedSubjects.length > 0 ? userScope.assignedSubjects : subjects;
        for (const sub of subsToCheck) {
          const scheduled = userScope.accessibleClasses.find((c) => checkClassSchedule(sub, c, dayN));
          if (scheduled) return scheduled.id;
        }
      }
      return userScope.accessibleClasses[0].id;
    }
    return classes[0]?.id || '';
  });

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isClassQrOpen, setIsClassQrOpen] = useState<boolean>(false);
  const [isLeaveApprovalOpen, setIsLeaveApprovalOpen] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const isDirtyRef = React.useRef<boolean>(false);
  const prevContextKeyRef = React.useRef<string>('');

  const draftStorageKey = useMemo(() => {
    const schoolKey = currentUser?.schoolId || 'default';
    return `kawacanaan_att_draft_${schoolKey}_${selectedClassId}_${date}_${attendanceMode}_${selectedSubjectId || 'none'}`;
  }, [currentUser?.schoolId, selectedClassId, date, attendanceMode, selectedSubjectId]);

  const currentContextKey = `${selectedClassId}_${date}_${attendanceMode}_${selectedSubjectId}`;

  const dateStatus = getDateStatus(date);
  const isHoliday = !!dateStatus.isHoliday;
  const isNonStudyDay = !dateStatus.isStudyDay;
  const isNonEffectiveDay = !dateStatus.isEffective;

  // Active study days formatted text (e.g. Senin s.d. Jumat)
  const activeStudyDaysText = useMemo(() => {
    const dayNames: { [key: number]: string } = {
      1: 'Senin',
      2: 'Selasa',
      3: 'Rabu',
      4: 'Kamis',
      5: 'Jumat',
      6: 'Sabtu',
      0: 'Minggu',
    };
    const effectiveDays =
      Array.isArray(activeStudyDays) && activeStudyDays.length > 0
        ? activeStudyDays
        : systemConfig.activeStudyDays || [1, 2, 3, 4, 5];
    const list = effectiveDays
      .map((d) => dayNames[d])
      .filter(Boolean);
    if (list.length === 5 && list[0] === 'Senin' && list[4] === 'Jumat') {
      return 'Senin s.d. Jumat (5 Hari Sekolah)';
    }
    if (list.length === 6 && list[0] === 'Senin' && list[5] === 'Sabtu') {
      return 'Senin s.d. Sabtu (6 Hari Sekolah)';
    }
    return list.join(', ');
  }, [activeStudyDays, systemConfig.activeStudyDays]);

  // Available subjects for current user
  const selectableSubjects = useMemo(() => {
    if (userScope.isGuruMapel && userScope.assignedSubjects.length > 0) {
      return userScope.assignedSubjects;
    }
    if (userScope.isWaliKelas && userScope.assignedWaliClassId) {
      const classId = userScope.assignedWaliClassId;
      const className = userScope.assignedWaliClassName || '';
      const matched = subjects.filter((s) => {
        const hasClassId = s.targetClassIds && s.targetClassIds.includes(classId);
        const hasClassName = s.targetClassNames && s.targetClassNames.some((cn) => cn.trim().toLowerCase() === className.trim().toLowerCase());
        return hasClassId || hasClassName;
      });
      return matched.length > 0 ? matched : subjects;
    }
    return subjects;
  }, [userScope, subjects]);

  const activeSubject = selectableSubjects.find((s) => s.id === selectedSubjectId) || selectableSubjects[0];

  // Cek apakah sebuah rombel memiliki jadwal mengajar resmi pada hari target
  const isClassScheduledOnDay = useMemo(() => {
    return (clsId: string, clsName?: string, dayName?: string) => {
      if (!activeSubject) return false;
      const targetDay = dayName || currentDayName;
      if (!targetDay) return false;

      const clsObj = { id: clsId, name: clsName || '' };
      return checkClassSchedule(activeSubject, clsObj, targetDay);
    };
  }, [activeSubject, currentDayName]);

  // Available classes for current selection and mode
  // Sesuai instruksi:
  // "Role guru mapel ; dashboard ; absensi siswa ; pilih rombel yang di ajar ; hanya menampilkan pilihan kelas sesuai dengan hari jadwal absensinya hari itu"
  const availableClasses = useMemo(() => {
    if (userScope.isWaliKelas) {
      return userScope.accessibleClasses.length > 0
        ? userScope.accessibleClasses
        : (userScope.assignedWaliClass ? [userScope.assignedWaliClass] : classes.slice(0, 1));
    }

    let baseClasses = userScope.isGuruMapel ? userScope.accessibleClasses : classes;
    if (activeSubject?.targetClassIds && activeSubject.targetClassIds.length > 0) {
      const filtered = baseClasses.filter((c) => activeSubject.targetClassIds?.includes(c.id));
      if (filtered.length > 0) baseClasses = filtered;
    }

    if (userScope.isGuruMapel || attendanceMode === 'SUBJECT') {
      const hasAnyScheduleConfigured =
        (activeSubject?.classSchedules && activeSubject.classSchedules.some((cs) => cs.days && cs.days.length > 0)) ||
        (activeSubject?.scheduleDays && activeSubject.scheduleDays.length > 0);

      // Jika belum ada jadwal sama sekali yang diatur admin, tetap tampilkan rombel binaan
      if (!hasAnyScheduleConfigured) {
        return baseClasses;
      }

      // Filter HANYA rombel yang sesuai jadwal hari ini
      const scheduledToday = baseClasses.filter((c) => isClassScheduledOnDay(c.id, c.name, currentDayName));

      // Jika ada sesi ekstra/pengganti yang diaktifkan secara sadar oleh guru:
      if (allowExtraSession) {
        return baseClasses;
      }

      // HANYA menampilkan pilihan kelas sesuai dengan hari jadwal absensinya hari itu
      return scheduledToday;
    }

    return baseClasses;
  }, [userScope, attendanceMode, activeSubject, classes, currentDayName, isClassScheduledOnDay, allowExtraSession]);

  // Synchronize mode and selected class/subject when role scope changes
  useEffect(() => {
    if (userScope.isWaliKelas) {
      const waliClassIds = userScope.accessibleClasses.map((c) => c.id);
      if (waliClassIds.length > 0 && !waliClassIds.includes(selectedClassId)) {
        setSelectedClassId(userScope.assignedWaliClassId || waliClassIds[0]);
      }
      if (selectableSubjects.length > 0 && !selectableSubjects.some((s) => s.id === selectedSubjectId)) {
        setSelectedSubjectId(selectableSubjects[0].id);
      }
    } else if (userScope.isGuruMapel) {
      setAttendanceMode('SUBJECT');
      if (userScope.assignedSubjects.length > 0 && !userScope.assignedSubjects.some((s) => s.id === selectedSubjectId)) {
        setSelectedSubjectId(userScope.assignedSubjects[0].id);
      }
      // "jika hari belajar tampilkan absensi kelas yang sesuai hari mengajar jadwalnya/ hari itu (default tampilan)"
      if (availableClasses.length > 0) {
        if (!availableClasses.some((c) => c.id === selectedClassId)) {
          setSelectedClassId(availableClasses[0].id);
        }
      }
    } else {
      // Admin / KS
      if (availableClasses.length > 0 && !availableClasses.some((c) => c.id === selectedClassId)) {
        setSelectedClassId(availableClasses[0].id);
      }
    }
  }, [userScope, availableClasses, selectedClassId, selectedSubjectId, selectableSubjects]);

  // Otomatis sinkronkan kelas default Guru Mapel ketika tanggal atau daftar rombel terjadwal berubah
  useEffect(() => {
    if (userScope.isGuruMapel || attendanceMode === 'SUBJECT') {
      if (availableClasses.length > 0) {
        if (!availableClasses.some((c) => c.id === selectedClassId)) {
          setSelectedClassId(availableClasses[0].id);
        }
      }
    }
  }, [date, currentDayName, availableClasses, userScope.isGuruMapel, attendanceMode, selectedClassId]);

  // Otomatis sinkronkan mata pelajaran Guru Mapel jika mapel saat ini tidak ada jadwal tapi mapel lain ada
  useEffect(() => {
    if (userScope.isGuruMapel && userScope.assignedSubjects.length > 1) {
      const currentHasClasses = availableClasses.length > 0;
      if (!currentHasClasses && currentDayName) {
        const otherSubToday = userScope.assignedSubjects.find((sub) =>
          sub.id !== selectedSubjectId &&
          userScope.accessibleClasses.some((c) => checkClassSchedule(sub, c, currentDayName))
        );
        if (otherSubToday) {
          setSelectedSubjectId(otherSubToday.id);
        }
      }
    }
  }, [userScope.isGuruMapel, userScope.assignedSubjects, userScope.accessibleClasses, availableClasses.length, currentDayName, selectedSubjectId]);

  // Active target class for QR Presensi Rombel & modal
  const activeTargetClass = useMemo(() => {
    return (
      classes.find((c) => c.id === selectedClassId) ||
      availableClasses.find((c) => c.id === selectedClassId) ||
      availableClasses[0] ||
      classes[0] ||
      null
    );
  }, [classes, availableClasses, selectedClassId]);

  const pendingClassLeaveRequestsCount = useMemo(() => {
    return (leaveRequests || []).filter((r) => {
      if (r.status !== 'PENDING') return false;
      if (!activeTargetClass) return true;

      // 1. Direct class ID match
      if (r.classId && activeTargetClass.id && r.classId === activeTargetClass.id) return true;

      // 2. Class name clean match (e.g. "6A" vs "Kelas 6A")
      if (r.className && activeTargetClass.name && isClassMatch(r.className, activeTargetClass.name)) return true;

      // 3. Match student enrollment in active target class
      const stu = students.find((s) => 
        s.id === r.studentId || 
        (s.nisn && r.nisn && String(s.nisn).trim() === String(r.nisn).trim()) ||
        (s.nama && r.studentName && s.nama.trim().toLowerCase() === r.studentName.trim().toLowerCase())
      );
      if (stu) {
        if (stu.classId && activeTargetClass.id && stu.classId === activeTargetClass.id) return true;
        if (stu.className && activeTargetClass.name && isClassMatch(stu.className, activeTargetClass.name)) return true;
      }

      // 4. Jika Wali Kelas melihat absensi kelas binaannya dan permohonan tanpa kelas eksplisit
      if (userScope.isWaliKelas) {
        if (!r.classId && !r.className) return true;
      }

      return false;
    }).length;
  }, [leaveRequests, activeTargetClass, students, userScope.isWaliKelas]);

  // State toggle rincian perbedaan presensi di banner peringatan
  const [showDiscrepancyDetails, setShowDiscrepancyDetails] = useState<boolean>(false);

  // Peta catatan presensi Guru Mapel hari ini untuk setiap siswa
  const subjectRecordsTodayByStudent = useMemo(() => {
    const map = new Map<string, Array<{ record: AttendanceRecord; subjectName: string }>>();
    (attendanceRecords || []).forEach((ar) => {
      if (ar.date === date && ar.type === 'SUBJECT' && ar.status && ar.status !== '-') {
        const sub = subjects.find((s) => s.id === ar.subjectId);
        const subjectName = ar.subjectName || sub?.code || sub?.name || 'Mapel';
        const list = map.get(ar.studentId) || [];
        list.push({ record: ar, subjectName });
        map.set(ar.studentId, list);
      }
    });
    return map;
  }, [attendanceRecords, date, subjects]);

  // Peringatan Pilihan 3: Daftar siswa dengan perbedaan status antara Wali Kelas (Harian) dan Guru Mapel
  const discrepancyList = useMemo(() => {
    if (attendanceMode !== 'DAILY') return [];
    const list: Array<{
      studentId: string;
      studentName: string;
      dailyStatus: AttendanceStatus;
      subjectDiscrepancies: Array<{
        subjectName: string;
        subjectStatus: AttendanceStatus;
        notes?: string;
      }>;
    }> = [];

    records.forEach((r) => {
      const mapelItems = subjectRecordsTodayByStudent.get(r.studentId) || [];
      if (mapelItems.length === 0) return;

      const diffs = mapelItems.filter((item) => {
        // Jika status harian sudah ada dan status mapel berbeda
        if (r.status && item.record.status !== r.status) return true;
        // Jika status harian belum diisi tapi guru mapel sudah menandai Sakit, Izin, atau Alfa
        if (!r.status && item.record.status && item.record.status !== 'Hadir') return true;
        return false;
      });

      if (diffs.length > 0) {
        list.push({
          studentId: r.studentId,
          studentName: r.studentName,
          dailyStatus: r.status,
          subjectDiscrepancies: diffs.map((d) => ({
            subjectName: d.subjectName,
            subjectStatus: d.record.status,
            notes: d.record.notes,
          })),
        });
      }
    });

    return list;
  }, [attendanceMode, records, subjectRecordsTodayByStudent]);

  // Daftar hari jadwal mengajar resmi untuk rombel terpilih
  const scheduledDaysForClass = useMemo(() => {
    if (!activeSubject) return [];
    const hasSpecificClassSchedules =
      activeSubject.classSchedules &&
      activeSubject.classSchedules.some((cs) => cs.days && cs.days.length > 0);

    if (hasSpecificClassSchedules) {
      if (selectedClassId) {
        const clsSched = activeSubject.classSchedules!.find(
          (cs) =>
            cs.classId === selectedClassId ||
            (activeTargetClass?.name && isClassMatch(cs.className, activeTargetClass.name))
        );
        if (clsSched && clsSched.days && clsSched.days.length > 0) {
          return clsSched.days;
        }
      }
      return [];
    }

    if (activeSubject.scheduleDays && activeSubject.scheduleDays.length > 0) {
      return activeSubject.scheduleDays;
    }
    return [];
  }, [activeSubject, selectedClassId, activeTargetClass]);

  // Jadwal spesifik untuk rombel terpilih (jam mulai dan jam selesai KBM)
  const activeClassSchedule = useMemo(() => {
    if (!activeSubject) return null;
    if (selectedClassId && activeSubject.classSchedules && activeSubject.classSchedules.length > 0) {
      return (
        activeSubject.classSchedules.find(
          (cs) => cs.classId === selectedClassId || (activeTargetClass?.name && isClassMatch(cs.className, activeTargetClass.name))
        ) || null
      );
    }
    return null;
  }, [activeSubject, selectedClassId, activeTargetClass]);

  // Parsing jam mulai & jam selesai dari format text lessonPeriod jika ada (misal: "07:30 - 09:00" atau "08.00-09.30")
  const parsedLessonPeriod = useMemo(() => {
    if (!activeSubject?.lessonPeriod) return null;
    const match = activeSubject.lessonPeriod.match(/(\d{1,2}[:.]\d{2})\s*[-–—s.d]+\s*(\d{1,2}[:.]\d{2})/i);
    if (match) {
      return {
        start: match[1].replace('.', ':').padStart(5, '0'),
        end: match[2].replace('.', ':').padStart(5, '0'),
      };
    }
    const singleMatch = activeSubject.lessonPeriod.match(/(\d{1,2}[:.]\d{2})/);
    if (singleMatch) {
      return {
        start: singleMatch[1].replace('.', ':').padStart(5, '0'),
        end: '09:00',
      };
    }
    return null;
  }, [activeSubject?.lessonPeriod]);

  // Cari fallback waktu dari jadwal kelas manapun pada mata pelajaran ini jika belum diset khusus
  const anyScheduleWithTime = useMemo(() => {
    if (!activeSubject?.classSchedules) return null;
    return activeSubject.classSchedules.find((cs) => cs.startTime && cs.endTime) || null;
  }, [activeSubject]);

  const scheduledStartTime =
    activeClassSchedule?.startTime ||
    activeSubject?.defaultStartTime ||
    anyScheduleWithTime?.startTime ||
    parsedLessonPeriod?.start ||
    '07:30';

  const scheduledEndTime =
    activeClassSchedule?.endTime ||
    activeSubject?.defaultEndTime ||
    anyScheduleWithTime?.endTime ||
    parsedLessonPeriod?.end ||
    '09:00';

  const isScheduleConfigured = scheduledDaysForClass.length > 0;

  const scheduledDaysText = useMemo(() => {
    if (scheduledDaysForClass.length === 0) return 'Belum diatur';
    return scheduledDaysForClass.join(', ');
  }, [scheduledDaysForClass]);

  const isScheduledToday = useMemo(() => {
    if (attendanceMode !== 'SUBJECT' || !activeSubject) {
      return true;
    }
    if (!isScheduleConfigured) {
      return false;
    }
    return scheduledDaysForClass.includes(currentDayName);
  }, [attendanceMode, activeSubject, isScheduleConfigured, scheduledDaysForClass, currentDayName]);

  // Auto-lock for Guru Mapel if selected day is not a scheduled teaching day
  const isLockedForGuruMapel = useMemo(() => {
    if (isGuruMapel) {
      if (currentDayName === 'Minggu') return true;
      if (allowExtraSession) return false;
      if (scheduledDaysForClass.length > 0) {
        return !scheduledDaysForClass.includes(currentDayName);
      }
      return true;
    }
    return false;
  }, [isGuruMapel, currentDayName, allowExtraSession, scheduledDaysForClass]);

  // Combined Lock Status (Locked if Holiday, Non-Effective Day, or Non-Teaching Day for Guru Mapel)
  const isDateLocked = isNonEffectiveDay || isLockedForGuruMapel;
  const isGuruMapelOffOrNonTeaching = isGuruMapel && (isNonEffectiveDay || !isScheduledToday);

  // Cek apakah ada kelas lain dari mapel ini yang memiliki jadwal hari ini
  const otherClassScheduledToday = useMemo(() => {
    if (!isGuruMapel || !activeSubject) return null;
    return availableClasses.find((c) => {
      if (c.id === selectedClassId) return false;
      const clsSched = activeSubject.classSchedules?.find((cs) => cs.classId === c.id);
      if (clsSched && clsSched.days && clsSched.days.length > 0) {
        return clsSched.days.includes(currentDayName);
      }
      return false;
    });
  }, [isGuruMapel, activeSubject, availableClasses, selectedClassId, currentDayName]);

  // Informasi hari jadwal mengajar terdekat untuk rombel ini
  const nextTeachingDayInfo = useMemo(() => {
    if (scheduledDaysForClass.length === 0) return null;
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    try {
      const [y, m, d] = date.split('-');
      const curr = new Date(Number(y), Number(m) - 1, Number(d));
      for (let i = 1; i <= 7; i++) {
        const next = new Date(curr);
        next.setDate(next.getDate() + i);
        const dayName = dayNames[next.getDay()];
        if (scheduledDaysForClass.includes(dayName)) {
          const nextY = next.getFullYear();
          const nextM = String(next.getMonth() + 1).padStart(2, '0');
          const nextD = String(next.getDate()).padStart(2, '0');
          return {
            dateStr: `${nextY}-${nextM}-${nextD}`,
            dayName,
            formatted: `${dayName}, ${nextD}/${nextM}/${nextY}`,
          };
        }
      }
    } catch (_) {}
    return null;
  }, [date, scheduledDaysForClass]);

  // Helper untuk melompat langsung ke hari mengajar terdekat
  const jumpToNextTeachingDay = () => {
    if (!nextTeachingDayInfo) return;
    handleDateChange(nextTeachingDayInfo.dateStr);
    showToast(`Beralih ke hari jadwal mengajar: ${nextTeachingDayInfo.formatted}`);
  };

  // Jumlah catatan presensi tersimpan pada tanggal ini
  const savedRecordsCount = useMemo(() => {
    return records.filter((r) => r.status && r.status !== '-').length;
  }, [records]);
  const hasSavedRecordsForDate = savedRecordsCount > 0;

  // Apakah isi visualisasi dan daftar absensi siswa boleh ditampilkan:
  // Untuk Guru Mapel: HANYA menampilkan absensi jika sesuai dengan jadwalnya atau harinya
  // Jika libur atau bukan hari mengajar, berikan keterangannya.
  const shouldShowAttendanceContent = useMemo(() => {
    if (!isGuruMapel) {
      return true;
    }
    // Hari libur / bukan hari efektif belajar
    if (isNonEffectiveDay) {
      return showArchivedRecords;
    }
    // Jadwal belum dikonfigurasi
    if (!isScheduleConfigured) {
      return allowExtraSession;
    }
    // Bukan hari mengajar sesuai jadwal
    if (!isScheduledToday) {
      return allowExtraSession || showArchivedRecords;
    }
    // Sesuai jadwal mengajar dan hari efektif belajar
    return true;
  }, [
    isGuruMapel,
    isNonEffectiveDay,
    isScheduleConfigured,
    isScheduledToday,
    allowExtraSession,
    showArchivedRecords,
  ]);

  // Load records for the chosen date, mode, and subject with dirty-protection and draft restore
  useEffect(() => {
    const isContextSwitch = prevContextKeyRef.current !== currentContextKey;
    prevContextKeyRef.current = currentContextKey;

    if (isContextSwitch) {
      // 1. Cek apakah ada draft yang belum tersimpan di session storage
      let restoredDraft: AttendanceRecord[] | null = null;
      try {
        const draftRaw = sessionStorage.getItem(draftStorageKey);
        if (draftRaw) {
          restoredDraft = JSON.parse(draftRaw);
        }
      } catch (_) {}

      if (restoredDraft && Array.isArray(restoredDraft) && restoredDraft.length > 0) {
        setRecords(restoredDraft);
        setIsDirty(true);
        isDirtyRef.current = true;
        return;
      }

      // 2. Jika tidak ada draft, ambil data absensi resmi dari store
      const loaded = getAttendanceForDate(date, {
        type: attendanceMode,
        subjectId: attendanceMode === 'SUBJECT' ? selectedSubjectId : null,
        classId: selectedClassId || null,
      });
      const sorted = [...loaded].sort((a, b) => a.studentName.localeCompare(b.studentName, 'id'));
      setRecords(sorted);
      setIsDirty(false);
      isDirtyRef.current = false;
    } else {
      // Context sama (misal background sync data siswa atau sinkronisasi data master)
      const loaded = getAttendanceForDate(date, {
        type: attendanceMode,
        subjectId: attendanceMode === 'SUBJECT' ? selectedSubjectId : null,
        classId: selectedClassId || null,
      });

      if (isDirtyRef.current) {
        // Jangan timpa input yang sedang diedit oleh pengguna!
        setRecords((prev) => {
          const mapPrev = new Map<string, AttendanceRecord>(prev.map((r) => [r.studentId, r]));
          const merged = loaded.map((fresh) => {
            const existing = mapPrev.get(fresh.studentId);
            if (existing && (existing.status || existing.checkInTime || existing.checkOutTime || existing.notes)) {
              return { ...fresh, ...existing };
            }
            return fresh;
          });
          return [...merged].sort((a, b) => a.studentName.localeCompare(b.studentName, 'id'));
        });
      } else {
        // Context sama dan data baru tersimpan atau background sync:
        // Gunakan loaded langsung dari store agar reset presensi dari Wali Kelas langsung efektif
        setRecords([...loaded].sort((a, b) => a.studentName.localeCompare(b.studentName, 'id')));
      }
    }
  }, [currentContextKey, draftStorageKey, students, systemConfig, attendanceRecords]);

  const handleDateChange = (newDate: string) => {
    if (isSaving) {
      showToast('Mohon tunggu hingga proses penyimpanan absensi selesai...', 'error');
      return;
    }
    setDate(newDate);
    setCurrentAttendanceDate(newDate);
    setShowArchivedRecords(false);
    setAllowExtraSession(false);
  };

  const updateRecord = (studentId: string, updates: Partial<AttendanceRecord>) => {
    if (isNonEffectiveDay) {
      showToast(`Presensi siswa terkunci: ${dateStatus.label}`, 'error');
      return;
    }
    if (isLockedForGuruMapel) {
      showToast('Presensi terkunci karena bukan jadwal mengajar mata pelajaran ini', 'error');
      return;
    }
    setIsDirty(true);
    isDirtyRef.current = true;
    setRecords((prev) => {
      const updated = prev.map((r) => {
        if (r.studentId !== studentId) return r;
        const merged = { ...r, ...updates };
        // Aturan: Siswa dengan status Izin, Sakit, atau Alfa tidak memiliki jam masuk/mulai & pulang/selesai (kolom waktu dikunci)
        if (merged.status === 'Sakit' || merged.status === 'Izin' || merged.status === 'Alfa') {
          merged.checkInTime = '';
          merged.checkOutTime = '';
        }
        return merged;
      });
      try {
        sessionStorage.setItem(draftStorageKey, JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  // Handler Pilihan 3: Menyelaraskan status presensi harian siswa dengan catatan Guru Mapel
  const handleApplySubjectStatusToDaily = (
    studentId: string,
    targetStatus: AttendanceStatus,
    subjectName: string,
    notes?: string
  ) => {
    const combinedNotes = notes 
      ? `(Catatan Mapel ${subjectName}: ${notes})` 
      : `(Diselaraskan dari Mapel ${subjectName})`;
    updateRecord(studentId, {
      status: targetStatus,
      notes: combinedNotes,
    });
    showToast(`Status diselaraskan ke "${targetStatus}" dari Guru Mapel ${subjectName}`);
  };

  // Handler Pilihan 3: Menyelaraskan seluruh selisih yang ditemukan dengan 1 klik
  const handleSyncAllDiscrepancies = () => {
    if (discrepancyList.length === 0) return;
    setIsDirty(true);
    isDirtyRef.current = true;
    setRecords((prev) => {
      const updated = prev.map((r) => {
        const item = discrepancyList.find((d) => d.studentId === r.studentId);
        if (item && item.subjectDiscrepancies.length > 0) {
          const first = item.subjectDiscrepancies[0];
          return {
            ...r,
            status: first.subjectStatus,
            notes: first.notes 
              ? `(Catatan Mapel ${first.subjectName}: ${first.notes})` 
              : `(Diselaraskan dari Mapel ${first.subjectName})`,
          };
        }
        return r;
      });
      try {
        sessionStorage.setItem(draftStorageKey, JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
    showToast(`${discrepancyList.length} siswa berhasil diselaraskan dengan catatan Guru Mapel`);
  };

  // Bulk Actions
  const handleHadirSemua = () => {
    if (isNonEffectiveDay) {
      showToast(`Presensi siswa terkunci: ${dateStatus.label}`, 'error');
      return;
    }
    if (isLockedForGuruMapel) {
      showToast('Presensi terkunci karena bukan hari jadwal mengajar', 'error');
      return;
    }
    setIsDirty(true);
    isDirtyRef.current = true;

    const rawFallbackCheckIn =
      attendanceMode === 'DAILY'
        ? (systemConfig?.defaultCheckInTime || '07:00')
        : (scheduledStartTime || systemConfig?.defaultCheckInTime || '07:00');
    const fallbackCheckIn = (rawFallbackCheckIn && String(rawFallbackCheckIn).trim() !== '') ? String(rawFallbackCheckIn).trim() : '07:00';

    let preservedCount = 0;
    let newlyMarkedCount = 0;
    let skippedAbsentCount = 0;

    setRecords((prev) => {
      const updated = prev.map((r) => {
        // Jangan timpa status dan jangan isi waktu bagi siswa yang berstatus Izin, Sakit, atau Alfa
        if (r.status === 'Sakit' || r.status === 'Izin' || r.status === 'Alfa') {
          skippedAbsentCount++;
          return {
            ...r,
            checkInTime: '',
            checkOutTime: '',
          };
        }

        const hasExistingCheckIn = Boolean(r.checkInTime && r.checkInTime.trim() !== '');
        if (hasExistingCheckIn) {
          preservedCount++;
        } else {
          newlyMarkedCount++;
        }

        return {
          ...r,
          status: 'Hadir',
          // PERTAHANKAN WAKTU SCAN QR: Hanya isi jam default jika siswa belum memiliki catatan jam masuk
          checkInTime: hasExistingCheckIn ? r.checkInTime : fallbackCheckIn,
          // Saat menekan tombol Hadir Semua: Yang terisi HANYA kolom status kehadiran dan jam mulai / masuk (jam selesai/pulang tetap kosong)
          checkOutTime: '',
        };
      });
      try {
        sessionStorage.setItem(draftStorageKey, JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });

    if (preservedCount > 0) {
      showToast(`Siswa diatur Hadir (${preservedCount} jam scan QR tetap dipertahankan${skippedAbsentCount > 0 ? `, ${skippedAbsentCount} siswa izin/sakit/alfa tidak ditimpa` : ''})`);
    } else {
      showToast(
        attendanceMode === 'DAILY'
          ? `Siswa diatur ke status Hadir (Jam Masuk: ${fallbackCheckIn}${skippedAbsentCount > 0 ? `, ${skippedAbsentCount} siswa izin/sakit/alfa tidak ditimpa` : ''})`
          : `Siswa diatur Hadir KBM (Jam Mulai: ${scheduledStartTime}${skippedAbsentCount > 0 ? `, ${skippedAbsentCount} siswa izin/sakit/alfa tidak ditimpa` : ''})`
      );
    }
  };

  const handlePulangMasal = () => {
    if (isNonEffectiveDay) {
      showToast(`Presensi siswa terkunci: ${dateStatus.label}`, 'error');
      return;
    }
    if (isLockedForGuruMapel) {
      showToast('Presensi terkunci karena bukan hari jadwal mengajar', 'error');
      return;
    }
    setIsDirty(true);
    isDirtyRef.current = true;

    const rawTargetEndTime =
      attendanceMode === 'DAILY'
        ? (systemConfig?.defaultCheckOutTime || systemConfig?.checkOutStartTime || '14:00')
        : (scheduledEndTime || systemConfig?.defaultCheckOutTime || '14:00');
    const targetEndTime = (rawTargetEndTime && String(rawTargetEndTime).trim() !== '') ? String(rawTargetEndTime).trim() : '14:00';

    const rawFallbackCheckIn =
      attendanceMode === 'DAILY'
        ? (systemConfig?.defaultCheckInTime || '07:00')
        : (scheduledStartTime || systemConfig?.defaultCheckInTime || '07:00');
    const fallbackCheckIn = (rawFallbackCheckIn && String(rawFallbackCheckIn).trim() !== '') ? String(rawFallbackCheckIn).trim() : '07:00';

    let updatedCount = 0;
    let preservedCount = 0;
    let skippedAbsentCount = 0;

    setRecords((prev) => {
      const updated = prev.map((r) => {
        // Jangan timpa status dan waktu bagi siswa yang berstatus Izin, Sakit, atau Alfa
        const isAbsent = r.status === 'Sakit' || r.status === 'Izin' || r.status === 'Alfa';
        if (isAbsent) {
          skippedAbsentCount++;
          return {
            ...r,
            checkInTime: '',
            checkOutTime: '',
          };
        }

        const hasExistingCheckIn = Boolean(r.checkInTime && r.checkInTime.trim() !== '');
        const hasExistingCheckOut = Boolean(r.checkOutTime && r.checkOutTime.trim() !== '');

        if (hasExistingCheckOut) {
          preservedCount++;
        } else {
          updatedCount++;
        }

        return {
          ...r,
          status: 'Hadir',
          // Jika belum ada jam masuk, isi dengan jam masuk default
          checkInTime: hasExistingCheckIn ? r.checkInTime : fallbackCheckIn,
          // Pertahankan jika sudah ada jam checkout riil (misal scan QR pulang), jika belum ada terapkan targetEndTime
          checkOutTime: hasExistingCheckOut ? r.checkOutTime : targetEndTime,
        };
      });

      try {
        sessionStorage.setItem(draftStorageKey, JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });

    if (preservedCount > 0) {
      showToast(
        attendanceMode === 'DAILY'
          ? `Jam pulang masal (${targetEndTime}) diterapkan (${updatedCount} siswa diperbarui, ${preservedCount} jam checkout riil tetap dipertahankan${skippedAbsentCount > 0 ? `, ${skippedAbsentCount} siswa izin/sakit/alfa dilewati` : ''})`
          : `Jam selesai KBM masal (${targetEndTime}) diterapkan (${updatedCount} siswa diperbarui, ${preservedCount} jam selesai riil tetap dipertahankan${skippedAbsentCount > 0 ? `, ${skippedAbsentCount} siswa izin/sakit/alfa dilewati` : ''})`
      );
    } else {
      showToast(
        attendanceMode === 'DAILY'
          ? `Jam pulang masal (${targetEndTime}) diterapkan bagi seluruh siswa hadir (${updatedCount} siswa)${skippedAbsentCount > 0 ? `, ${skippedAbsentCount} siswa izin/sakit/alfa tidak ditimpa` : ''}`
          : `Jam selesai KBM masal (${targetEndTime}) diterapkan bagi seluruh siswa hadir (${updatedCount} siswa)${skippedAbsentCount > 0 ? `, ${skippedAbsentCount} siswa izin/sakit/alfa tidak ditimpa` : ''}`
      );
    }
  };

  const handleReset = async () => {
    if (isNonEffectiveDay) {
      showToast(`Presensi siswa terkunci: ${dateStatus.label}`, 'error');
      return;
    }
    if (isLockedForGuruMapel) {
      showToast('Presensi terkunci karena bukan hari jadwal mengajar', 'error');
      return;
    }
    // Identifikasi rombel target dan seluruh siswa yang terkait
    const targetClassObj = selectedClassId
      ? classes.find((c) => c.id === selectedClassId || normalizeClassToken(c.name) === normalizeClassToken(selectedClassId))
      : null;

    const targetStudents = selectedClassId
      ? students.filter((s) => {
          if (s.classId === selectedClassId) return true;
          if (targetClassObj && (s.classId === targetClassObj.id || (s.className && normalizeClassToken(s.className) === normalizeClassToken(targetClassObj.name)))) return true;
          return false;
        })
      : students;

    const studentMap = new Map<string, string>();
    targetStudents.forEach((s) => studentMap.set(s.id, s.nama));
    records.forEach((r) => {
      if (r.studentId) studentMap.set(r.studentId, r.studentName || studentMap.get(r.studentId) || '');
    });

    const resetRecords: AttendanceRecord[] = Array.from(studentMap.entries()).map(([sId, sName]) => ({
      id: `att-${date}-${attendanceMode === 'SUBJECT' ? selectedSubjectId : 'daily'}-${sId}`,
      date,
      studentId: sId,
      studentName: sName,
      status: '' as AttendanceStatus,
      checkInTime: '',
      checkOutTime: '',
      notes: '',
      type: attendanceMode,
      subjectId: attendanceMode === 'SUBJECT' ? selectedSubjectId : null,
      classId: selectedClassId || targetClassObj?.id || null,
    })).sort((a, b) => a.studentName.localeCompare(b.studentName, 'id'));

    setRecords(resetRecords);
    setIsDirty(false);
    isDirtyRef.current = false;
    try {
      sessionStorage.removeItem(draftStorageKey);
    } catch (_) {}

    await saveDailyAttendance(date, resetRecords, {
      type: attendanceMode,
      subjectId: attendanceMode === 'SUBJECT' ? selectedSubjectId : null,
      subjectName: activeSubject?.name || null,
      classId: selectedClassId || targetClassObj?.id || null,
    });
    showToast('Presensi kelas berhasil di-reset. Siswa kini dapat melakukan scan barcode kembali.', 'info');
  };

  const handleSave = async () => {
    if (isSaving) return;
    if (isNonEffectiveDay) {
      showToast(`Presensi siswa terkunci: ${dateStatus.label}`, 'error');
      return;
    }
    if (isLockedForGuruMapel) {
      showToast('Presensi terkunci karena bukan hari jadwal mengajar', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const res = await saveDailyAttendance(date, records, {
        type: attendanceMode,
        subjectId: attendanceMode === 'SUBJECT' ? selectedSubjectId : null,
        subjectName: activeSubject?.name || null,
        classId: selectedClassId || null,
      });
      if (res?.success) {
        setIsDirty(false);
        isDirtyRef.current = false;
        try {
          sessionStorage.removeItem(draftStorageKey);
        } catch (_) {}
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Status counts
  const countHadir = records.filter((r) => r.status === 'Hadir').length;
  const countSakit = records.filter((r) => r.status === 'Sakit').length;
  const countIzin = records.filter((r) => r.status === 'Izin').length;
  const countAlfa = records.filter((r) => r.status === 'Alfa').length;
  const countBelum = records.filter((r) => !r.status || r.status === '-').length;
  const countTotalDiabsen = countHadir + countSakit + countIzin + countAlfa;
  const percentageDiabsen = records.length > 0 ? Math.round((countTotalDiabsen / records.length) * 100) : 0;

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase().trim();
    return records.filter((r) => r.studentName.toLowerCase().includes(q));
  }, [records, searchQuery]);

  const changeDateByOffset = (offsetDays: number) => {
    try {
      const [y, m, d] = date.split('-');
      const current = new Date(Number(y), Number(m) - 1, Number(d));
      current.setDate(current.getDate() + offsetDays);
      const newY = current.getFullYear();
      const newM = String(current.getMonth() + 1).padStart(2, '0');
      const newD = String(current.getDate()).padStart(2, '0');
      handleDateChange(`${newY}-${newM}-${newD}`);
    } catch (_) {}
  };

  const isToday = useMemo(() => {
    return date === formatServerDateString(getServerNow());
  }, [date]);

  const goToToday = () => {
    handleDateChange(formatServerDateString(getServerNow()));
  };

  const formatDateIndo = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-');
      const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
      ];
      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const dObj = new Date(Number(y), Number(m) - 1, Number(d));
      const dayName = dayNames[dObj.getDay()] || 'Hari';
      const monthName = monthNames[Number(m) - 1] || m;
      return `${dayName}, ${d} ${monthName} ${y}`;
    } catch {
      return dateStr;
    }
  };

  const currentSelectedClassName = classes.find((c) => c.id === selectedClassId)?.name || 'Semua Kelas';

  return (
    <div className="w-full max-w-6xl 2xl:max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3.5 sm:py-5 space-y-3.5 sm:space-y-5 animate-in fade-in duration-200 pb-28">
      {/* Top Navigation & Fast Context Bar */}
      <div className="flex items-center justify-between gap-2.5">
        <button
          type="button"
          onClick={() => setActiveView('dashboard')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs min-h-[36px] cursor-pointer active:scale-95"
          id="btn-back-dashboard"
        >
          <ArrowLeft size={13} />
          <span>Dashboard</span>
        </button>

        {!userScope.isGuruMapel && attendanceMode === 'DAILY' && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 hidden sm:inline">
              Rombel:
            </span>
            {userScope.isWaliKelas && userScope.accessibleClasses.length > 1 ? (
              <div className="inline-flex p-0.5 bg-blue-50 border border-blue-200 rounded-xl gap-1">
                {userScope.accessibleClasses.map((cls) => (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => setSelectedClassId(cls.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      selectedClassId === cls.id
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-blue-800 hover:bg-blue-100/60'
                    }`}
                  >
                    {cls.name}
                  </button>
                ))}
              </div>
            ) : (
              <span className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs font-extrabold shadow-2xs">
                {currentSelectedClassName}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Header Info & Responsive Date Picker */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
            <ClipboardList size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h1 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
                Pencatatan Presensi
              </h1>
              {dateStatus.label !== 'Hari Efektif Belajar' && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${dateStatus.badgeColor}`}>
                  {dateStatus.label}
                </span>
              )}
              {isNonEffectiveDay && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                  <Lock size={10} />
                  <span>Terkunci</span>
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5 truncate">
              {attendanceMode === 'DAILY' ? (
                <span>Wali Kelas • {currentSelectedClassName}</span>
              ) : (
                <span>Guru Mapel • {activeSubject?.name || 'Mapel'} ({currentSelectedClassName})</span>
              )}{' '}
              • <strong className="text-slate-700">{formatDateIndo(date)}</strong>
            </p>
          </div>
        </div>

        {/* Date Selector Box with Prev / Today / Next Quick Jumps */}
        <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-50/90 p-1 rounded-xl border border-slate-200 shadow-2xs self-stretch sm:self-auto justify-between sm:justify-start">
          <button
            type="button"
            onClick={() => changeDateByOffset(-1)}
            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
            title="Hari Sebelumnya (H-1)"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-lg border border-slate-200/80 shadow-2xs">
            <Calendar size={13} className="text-blue-600 shrink-0" />
            <input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={() => changeDateByOffset(1)}
            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
            title="Hari Berikutnya (H+1)"
          >
            <ChevronRight size={16} />
          </button>

          {!isToday && (
            <button
              type="button"
              onClick={goToToday}
              className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
            >
              Hari Ini
            </button>
          )}
        </div>
      </div>

      {/* Holiday / Non-Effective Study Day Lock Warning Banner */}
      {isNonEffectiveDay && (
        <div
          className={`p-4 rounded-2xl border flex items-start gap-3.5 shadow-xs ${
            isHoliday
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-amber-50 border-amber-300 text-amber-950'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs mt-0.5 ${
              isHoliday
                ? 'bg-rose-100 border border-rose-300 text-rose-700'
                : 'bg-amber-100 border border-amber-300 text-amber-800'
            }`}
          >
            <Lock size={20} />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-black tracking-tight">
                {isHoliday
                  ? 'Presensi Siswa Dikunci Otomatis (Hari Libur)'
                  : 'Presensi Siswa Dikunci Otomatis (Bukan Hari Efektif Belajar)'}
              </h3>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                  isHoliday ? 'bg-rose-200 text-rose-900' : 'bg-amber-200 text-amber-900'
                }`}
              >
                Akses Terkunci
              </span>
            </div>
            <p className="text-xs leading-relaxed font-medium">
              {isHoliday ? (
                <>
                  Tanggal <strong>{formatDateIndo(date)}</strong> tercatat sebagai{' '}
                  <strong>{dateStatus.eventTitle || dateStatus.label}</strong> pada Kalender Akademik.
                  Pengisian dan perubahan data absensi siswa (Wali Kelas & Guru) dikunci secara otomatis.
                </>
              ) : (
                <>
                  Hari <strong>{currentDayName} ({formatDateIndo(date)})</strong> bukan merupakan hari efektif belajar sekolah.
                  Jadwal hari belajar aktif: <strong>{activeStudyDaysText}</strong>.
                  Pengisian dan perubahan data absensi siswa dinonaktifkan secara otomatis.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Mode Selector & Configuration Toolbar (Hanya untuk Admin / KS / Guru Mapel) */}
      {!userScope.isWaliKelas && (
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-4">
          {/* Toggle Mode / Role Scoped Mode */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">
                {userScope.isGuruMapel
                  ? 'FORMAT ABSENSI (GURU MAPEL)'
                  : 'PILIH FORMAT ABSENSI'}
              </span>
              <div className="inline-flex p-1 bg-slate-200/80 rounded-xl gap-1">
                {/* Wali Kelas Button: Hidden for Guru Mapel */}
                {!userScope.isGuruMapel && (
                  <button
                    type="button"
                    onClick={() => setAttendanceMode('DAILY')}
                    id="btn-mode-daily"
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${
                      attendanceMode === 'DAILY'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 cursor-pointer'
                    }`}
                  >
                    <UserCheck size={15} />
                    <span>Format Wali Kelas (Harian)</span>
                  </button>
                )}

                {/* Guru Mapel Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (userScope.isGuruMapel) return;
                    if (
                      !requestFeatureAccess(
                        'presensi_mapel',
                        'Presensi Guru Mata Pelajaran',
                        'Pencatatan presensi per jam pelajaran dan lintas kelas binaan merupakan fasilitas pada Paket Guru dan Paket Sekolah.'
                      )
                    ) {
                      return;
                    }
                    setAttendanceMode('SUBJECT');
                  }}
                  id="btn-mode-subject"
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${
                    attendanceMode === 'SUBJECT'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 cursor-pointer'
                  }`}
                >
                  <BookOpen size={15} />
                  <span>Format Guru Mapel (Per Jam Pelajaran)</span>
                </button>
              </div>
            </div>

            {/* Select Class (Admin/KS Daily) or Subject + Class (Guru Mapel / Admin Subject) */}
            <div className="flex flex-wrap items-center gap-3">
              {attendanceMode === 'DAILY' ? (
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    PILIH KELAS
                  </label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="px-3.5 py-2 bg-white border border-slate-300 text-slate-900 text-xs font-bold rounded-xl shadow-xs outline-none focus:border-blue-600 cursor-pointer min-w-[160px]"
                    >
                      {availableClasses.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name} ({getFaseByClassName(cls.name, cls.grade)}) {cls.waliKelasName ? `• Wali: ${cls.waliKelasName}` : ''}
                        </option>
                      ))}
                    </select>
                    {activeTargetClass && (
                      <button
                        type="button"
                        onClick={() => setIsClassQrOpen(true)}
                        id="btn-quick-qr-daily"
                        className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl transition cursor-pointer shrink-0"
                        title={`Lihat / Cetak QR Presensi ${activeTargetClass.name}`}
                      >
                        <QrCode size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <span>MATA PELAJARAN</span>
                      {userScope.isGuruMapel && selectableSubjects.length === 1 && (
                        <Lock size={10} className="text-indigo-600" />
                      )}
                    </label>
                    {userScope.isGuruMapel && selectableSubjects.length === 1 ? (
                      <div className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-black rounded-xl shadow-xs inline-flex items-center gap-2">
                        <BookOpen size={14} className="text-indigo-600" />
                        <span>{selectableSubjects[0].name}</span>
                      </div>
                    ) : (
                      <select
                        value={selectedSubjectId}
                        onChange={(e) => setSelectedSubjectId(e.target.value)}
                        id="select-subject"
                        className="px-3.5 py-2 bg-white border border-blue-300 text-blue-900 text-xs font-bold rounded-xl shadow-xs outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                      >
                        {selectableSubjects.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name} {sub.teacherName ? `• ${sub.teacherName}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                      PILIH KELAS
                    </label>
                    <div className="flex items-center gap-1.5">
                      {availableClasses.length > 0 ? (
                        <select
                          value={selectedClassId}
                          onChange={(e) => setSelectedClassId(e.target.value)}
                          id="select-class"
                          className="px-3.5 py-2 bg-white border border-blue-300 text-blue-900 text-xs font-bold rounded-xl shadow-xs outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer min-w-[140px]"
                        >
                          {availableClasses.map((cls) => {
                            const label = `${formatClassDisplay(cls.name).toUpperCase()} (${getFaseByClassName(cls.name, cls.grade)})`;
                            return (
                              <option key={cls.id} value={cls.id}>
                                {userScope.isGuruMapel ? label : `${cls.name} (${getFaseByClassName(cls.name, cls.grade)}) ${cls.waliKelasName ? `• Wali: ${cls.waliKelasName}` : ''}`}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold rounded-xl flex items-center gap-1.5">
                          <AlertCircle size={13} className="text-amber-600 shrink-0" />
                          <span>Tidak ada kelas terjadwal hari {currentDayName}</span>
                        </div>
                      )}
                      {activeTargetClass && availableClasses.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setIsClassQrOpen(true)}
                          id="btn-quick-qr-subject"
                          className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl transition cursor-pointer shrink-0"
                          title={`Lihat / Cetak QR Presensi ${activeTargetClass.name}`}
                        >
                          <QrCode size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Dynamic Context Header (Guru Mapel) */}
          {attendanceMode === 'SUBJECT' && (
            <div className="pt-2 border-t border-slate-200">
              {/* Subject Schedule & Teacher Info Box */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-blue-200 text-xs shadow-2xs">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 font-extrabold text-slate-800">
                    <UserCheck size={15} className="text-blue-600 shrink-0" />
                    <span>Pengajar: {activeSubject?.teacherName || 'Guru Mapel'}</span>
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 font-bold text-xs shadow-2xs">
                    <Clock size={13} className="text-blue-600 shrink-0" />
                    <span>Jam KBM: <strong className="font-extrabold text-blue-950">{scheduledStartTime} - {scheduledEndTime}</strong></span>
                  </div>
                </div>

                {isGuruMapelOffOrNonTeaching ? (
                  <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 font-bold text-[11px] flex items-center gap-1.5 border border-rose-200">
                    <Lock size={12} />
                    <span>{isHoliday ? 'Hari Libur' : !isScheduledToday ? 'Bukan Hari Mengajar' : 'Bukan Hari Efektif'}</span>
                  </span>
                ) : isScheduledToday ? (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center gap-1.5 border border-emerald-200">
                    <CheckCircle2 size={12} />
                    <span>Sesuai Jadwal Mengajar</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 font-bold text-[11px] border border-amber-200">
                    KBM Tambahan (Hari {currentDayName})
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selector Rombel Khusus Wali Kelas Rangkap (2 Rombel) */}
      {userScope.isWaliKelas && userScope.accessibleClasses.length > 1 && (
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50/60 to-blue-50 border border-blue-200/90 p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
              2x
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-900 block">
                Penugasan Wali Kelas Merangkap 2 Rombel
              </span>
              <p className="text-xs text-blue-800 font-medium">
                Pilih rombel binaan yang ingin Anda rekap atau isi absensinya hari ini:
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {userScope.accessibleClasses.map((cls) => {
              const isSel = selectedClassId === cls.id;
              const studentCount = students.filter(
                (s) => s.classId === cls.id || (s.className && isClassMatch(s.className, cls.name))
              ).length;
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => setSelectedClassId(cls.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                    isSel
                      ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/20'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-2xs'
                  }`}
                >
                  <span>{cls.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${isSel ? 'bg-blue-700 text-blue-100 font-extrabold' : 'bg-slate-100 text-slate-600 font-bold'}`}>
                    {studentCount} Siswa
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Unsaved Changes Alert Banner */}
      {isDirty && !isDateLocked && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs font-bold animate-fadeIn">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0 animate-ping" />
          <span>Ada perubahan absensi yang belum disimpan. Klik <strong>Simpan Presensi</strong> untuk menyimpan permanen.</span>
        </div>
      )}

      {/* Visualisasi Presensi atau Keterangan Jadwal Mengajar & Hari Libur */}
      {!shouldShowAttendanceContent ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-5 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                isNonEffectiveDay
                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                  : !isScheduleConfigured
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-blue-100 text-blue-700 border border-blue-200'
              }`}
            >
              {isNonEffectiveDay ? (
                <CalendarX size={24} />
              ) : !isScheduleConfigured ? (
                <Info size={24} />
              ) : (
                <Clock size={24} />
              )}
            </div>

            <div className="space-y-1 text-center sm:text-left min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {isNonEffectiveDay
                    ? `Presensi Ditiadakan: ${dateStatus.eventTitle || dateStatus.label}`
                    : !isScheduleConfigured
                    ? `Jadwal Mengajar Belum Dikonfigurasi`
                    : `Bukan Hari Jadwal Mengajar ${activeSubject?.name || 'Mata Pelajaran'}`}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                    isNonEffectiveDay
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : !isScheduleConfigured
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  {isNonEffectiveDay
                    ? 'Hari Libur'
                    : !isScheduleConfigured
                    ? 'Belum Ada Jadwal'
                    : `Tidak Ada Jadwal Hari ${currentDayName}`}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {currentSelectedClassName} • {activeSubject?.name || 'Mapel'} •{' '}
                <strong className="text-slate-700">{formatDateIndo(date)}</strong>
              </p>
            </div>
          </div>

          {/* Details Box */}
          {isNonEffectiveDay ? (
            <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 text-xs text-rose-950 space-y-2">
              <p className="leading-relaxed font-medium">
                Tanggal <strong>{formatDateIndo(date)}</strong> tercatat sebagai{' '}
                <strong>{dateStatus.eventTitle || dateStatus.label}</strong> pada Kalender Akademik.
              </p>
              <p className="text-rose-800 text-[11px] leading-relaxed">
                Sesuai ketentuan hari efektif belajar sekolah ({activeStudyDaysText}), kegiatan belajar mengajar (KBM) tidak dilaksanakan pada hari libur sehingga penginputan presensi siswa ditiadakan.
              </p>
            </div>
          ) : !isScheduleConfigured ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2">
              <p className="leading-relaxed font-medium">
                Mata pelajaran <strong>{activeSubject?.name}</strong> untuk rombel{' '}
                <strong>{currentSelectedClassName}</strong> belum memiliki jadwal hari mengajar resmi.
              </p>
              <p className="text-amber-800 text-[11px] leading-relaxed">
                Silakan atur hari jadwal mengajar di menu <strong>Data Referensi ➔ Mata Pelajaran</strong> agar absensi siswa muncul secara otomatis mengikuti hari mengajarnya, atau klik tombol di bawah untuk membuka presensi khusus.
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  Jadwal Resmi Mengajar {currentSelectedClassName}:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {scheduledDaysForClass.map((d) => (
                    <span
                      key={d}
                      className="px-2.5 py-1 rounded-lg bg-blue-100 border border-blue-200 text-blue-900 font-extrabold text-xs"
                    >
                      Hari {d}
                    </span>
                  ))}
                  {activeSubject?.lessonPeriod && (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-200/80 text-slate-700 font-bold text-xs">
                      {activeSubject.lessonPeriod}
                    </span>
                  )}
                </div>
              </div>

              <p className="text-slate-600 leading-relaxed font-medium">
                Hari ini adalah hari <strong>{currentDayName}</strong>. Karena bukan merupakan hari jadwal mengajar mata pelajaran <strong>{activeSubject?.name}</strong> untuk kelas <strong>{currentSelectedClassName}</strong>, daftar presensi siswa dinonaktifkan sesuai jadwal resmi KBM.
              </p>

              {otherClassScheduledToday && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 text-emerald-950 text-xs font-bold">
                    <Sparkles size={16} className="text-emerald-600 shrink-0" />
                    <span>
                      Hari ini ({currentDayName}) Anda memiliki jadwal mengajar di kelas{' '}
                      <strong>{otherClassScheduledToday.name}</strong>.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedClassId(otherClassScheduledToday.id)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer shadow-2xs transition active:scale-95"
                  >
                    Buka Presensi {otherClassScheduledToday.name}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Quick Action Navigation Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            {nextTeachingDayInfo && (
              <button
                type="button"
                onClick={jumpToNextTeachingDay}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
                title={`Lompat ke tanggal ${nextTeachingDayInfo.formatted}`}
              >
                <CalendarCheck size={15} />
                <span>Beralih ke Jadwal Mengajar Terdekat ({nextTeachingDayInfo.formatted})</span>
              </button>
            )}

            {isNonEffectiveDay ? (
              <button
                type="button"
                onClick={() => setActiveView('kalender-akademik')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition active:scale-95 cursor-pointer"
              >
                <Calendar size={15} />
                <span>Buka Kalender Akademik</span>
              </button>
            ) : !isScheduleConfigured ? (
              <button
                type="button"
                onClick={() => setAllowExtraSession(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition active:scale-95 cursor-pointer"
              >
                <BookOpen size={15} />
                <span>Buka Presensi Khusus Kelas Ini</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAllowExtraSession(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition active:scale-95 cursor-pointer"
                title="Buka penginputan presensi jika terdapat jam pelajaran tambahan atau KBM pengganti"
              >
                <BookOpen size={15} />
                <span>Buka Presensi Tambahan / Pengganti</span>
              </button>
            )}

            {hasSavedRecordsForDate && (
              <button
                type="button"
                onClick={() => setShowArchivedRecords(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition active:scale-95 cursor-pointer"
                title="Lihat data presensi yang pernah tersimpan pada tanggal ini"
              >
                <Eye size={15} />
                <span>Lihat Catatan Tersimpan ({savedRecordsCount} Siswa)</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Active Session Notice Banners */}
          {allowExtraSession && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="font-bold">
                  Sesi KBM Tambahan / Pengganti Aktif (Hari {currentDayName}). Anda dapat menginput dan menyimpan presensi siswa untuk sesi ini.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAllowExtraSession(false)}
                className="px-2.5 py-1 bg-amber-200/80 hover:bg-amber-300 text-amber-900 rounded-lg font-bold text-[11px] cursor-pointer"
              >
                Tutup Sesi Tambahan
              </button>
            </div>
          )}

          {showArchivedRecords && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-950">
              <div className="flex items-center gap-2">
                <Eye size={14} className="text-indigo-600" />
                <span className="font-bold">
                  Menampilkan arsip catatan presensi tersimpan pada tanggal {formatDateIndo(date)} (Mode Hanya Baca).
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowArchivedRecords(false)}
                className="px-2.5 py-1 bg-indigo-200/80 hover:bg-indigo-300 text-indigo-900 rounded-lg font-bold text-[11px] cursor-pointer"
              >
                Sembunyikan Arsip
              </button>
            </div>
          )}

          {/* Sesuai Jadwal Mengajar Banner untuk Guru Mapel */}
          {isGuruMapel && isScheduledToday && !isNonEffectiveDay && !allowExtraSession && !showArchivedRecords && (
            <div className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-bold shadow-2xs">
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              <span>
                Sesuai Jadwal Mengajar Resmi: Hari {currentDayName} • {activeSubject?.name} ({currentSelectedClassName})
              </span>
            </div>
          )}

          {/* Bulk Action Buttons - Compact Toolbar (Disejajarkan Layoutnya Secara Harmonis) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={handleHadirSemua}
              disabled={isDateLocked || isSaving}
              id="btn-hadir-semua"
              title="Atur semua siswa ke status Hadir. Siswa yang sudah scan QR akan tetap mempertahankan waktu aslinya."
              className={`w-full py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs min-h-[42px] ${
                isDateLocked || isSaving
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-700 cursor-pointer'
              }`}
            >
              {isDateLocked ? <Lock size={15} /> : <CheckCircle2 size={15} />}
              <span>Hadir Semua</span>
            </button>

            {attendanceMode === 'DAILY' ? (
              <button
                type="button"
                onClick={handlePulangMasal}
                disabled={isDateLocked || isSaving}
                id="btn-pulang-masal"
                title="Terapkan jam pulang standar bagi siswa hadir yang belum memiliki jam pulang (waktu checkout riil tetap dipertahankan)."
                className={`w-full py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs min-h-[42px] ${
                  isDateLocked || isSaving
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'border-blue-300 bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-700 cursor-pointer'
                }`}
              >
                {isDateLocked ? <Lock size={15} /> : <LogOut size={15} />}
                <span>Pulang Masal</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePulangMasal}
                disabled={isDateLocked || isSaving}
                id="btn-selesai-kbm-masal"
                title={`Terapkan jam selesai KBM (${scheduledEndTime}) serentak untuk seluruh siswa yang hadir`}
                className={`w-full py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs min-h-[42px] ${
                  isDateLocked || isSaving
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'border-blue-300 bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-700 cursor-pointer'
                }`}
              >
                {isDateLocked ? <Lock size={15} /> : <Clock size={15} />}
                <span>Selesai KBM Masal</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsClassQrOpen(true)}
              disabled={!activeTargetClass}
              id="btn-qr-presensi-rombel"
              className={`w-full py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs min-h-[42px] ${
                !activeTargetClass
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 cursor-pointer'
              }`}
              title={`Tampilkan / Cetak QR Code Presensi ${activeTargetClass?.name || 'Rombel Kelas'}`}
            >
              <QrCode size={15} />
              <span>QR Presensi</span>
            </button>

            <button
              type="button"
              onClick={() => setIsLeaveApprovalOpen(true)}
              id="btn-verifikasi-surat-izin"
              className="relative w-full py-2.5 px-3 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs min-h-[42px] cursor-pointer"
              title="Verifikasi Surat Izin / Sakit dari Orang Tua Siswa"
            >
              <FileText size={15} className="text-amber-700 shrink-0" />
              <span>Surat Izin Wali</span>
              {pendingClassLeaveRequestsCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center shadow-xs animate-pulse">
                  {pendingClassLeaveRequestsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleReset}
              disabled={isDateLocked || isSaving}
              id="btn-reset-absensi"
              className={`w-full col-span-2 sm:col-span-1 md:col-span-1 py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs min-h-[42px] ${
                isDateLocked || isSaving
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'border-rose-300 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 cursor-pointer'
              }`}
              title="Reset status kehadiran siswa"
            >
              {isDateLocked ? <Lock size={15} /> : <RotateCcw size={15} />}
              <span>Reset</span>
            </button>
          </div>

          {/* Unified Status Ribbon & Completion Meter */}
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Status Pills */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Hadir:</span>
                  <strong className="text-emerald-950">{countHadir}</strong>
                </span>

                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 text-xs font-bold shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                  <span>Sakit:</span>
                  <strong className="text-sky-950">{countSakit}</strong>
                </span>

                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Izin:</span>
                  <strong className="text-amber-950">{countIzin}</strong>
                </span>

                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>Alfa:</span>
                  <strong className="text-rose-950">{countAlfa}</strong>
                </span>

                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span>Belum:</span>
                  <strong className="text-slate-900">{countBelum}</strong>
                </span>
              </div>

              {/* Progress Percent */}
              <div className="text-xs font-extrabold text-slate-700 flex items-center gap-2">
                <span>
                  {countTotalDiabsen} / {records.length} Diabsen
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-black">
                  {percentageDiabsen}%
                </span>
              </div>
            </div>

            {/* Progress Bar Line */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${percentageDiabsen}%` }}
              />
            </div>
          </div>

          {/* Peringatan Selisih Presensi Antara Wali Kelas & Guru Mapel (Pilihan 3) */}
          {attendanceMode === 'DAILY' && discrepancyList.length > 0 && (
            <div className="bg-amber-50/90 border border-amber-300/80 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-3 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0 shadow-2xs">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-amber-950">
                        Peringatan Selisih Presensi dengan Guru Mapel
                      </h4>
                      <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 text-[10px] font-black">
                        {discrepancyList.length} Siswa Berbeda
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-snug mt-0.5 font-medium">
                      Guru Mata Pelajaran mencatat status kehadiran berbeda pada jam pelajarannya hari ini. Anda dapat meninjau rincian atau menyelaraskannya dengan satu klik.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setShowDiscrepancyDetails((prev) => !prev)}
                    className="px-3 py-1.5 rounded-xl border border-amber-300 bg-white hover:bg-amber-100/60 active:scale-95 text-amber-950 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  >
                    {showDiscrepancyDetails ? 'Tutup Rincian' : `Lihat Rincian (${discrepancyList.length})`}
                  </button>
                  <button
                    type="button"
                    onClick={handleSyncAllDiscrepancies}
                    disabled={isDateLocked || isSaving}
                    className="px-3 py-1.5 rounded-xl border border-amber-500 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-black transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
                    title="Terapkan status dari Guru Mapel ke buku presensi harian untuk seluruh siswa yang berselisih"
                  >
                    <ArrowRightLeft size={13} />
                    <span>Selaraskan Semua</span>
                  </button>
                </div>
              </div>

              {/* Rincian Selisih per Siswa (Bila Dibuka) */}
              {showDiscrepancyDetails && (
                <div className="pt-2.5 border-t border-amber-200/80 divide-y divide-amber-200/50">
                  {discrepancyList.map((item) => (
                    <div key={item.studentId} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-extrabold text-slate-900">{item.studentName}</span>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px]">
                          <span className="text-slate-600">
                            Wali Kelas: <strong className="text-slate-900">{item.dailyStatus || '(Belum Diabsen)'}</strong>
                          </span>
                          <span className="text-amber-400">•</span>
                          {item.subjectDiscrepancies.map((sd, i) => (
                            <span key={i} className="text-amber-900 font-semibold">
                              Mapel {sd.subjectName}: <strong className="text-amber-950 font-black">{sd.subjectStatus}</strong>
                              {sd.notes && <span className="text-amber-700 ml-1">({sd.notes})</span>}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                        {item.subjectDiscrepancies.map((sd, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleApplySubjectStatusToDaily(item.studentId, sd.subjectStatus, sd.subjectName, sd.notes)}
                            disabled={isDateLocked || isSaving}
                            className="px-2.5 py-1 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-950 text-[11px] font-black cursor-pointer transition-colors shadow-2xs"
                          >
                            Terapkan {sd.subjectStatus} ({sd.subjectName})
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Student List Container with Search Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
            {/* Header & Quick Search Bar */}
            <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-slate-800">
                  Daftar Siswa {currentSelectedClassName}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-700 text-[11px] font-bold">
                  {filteredRecords.length} dari {records.length}
                </span>
              </div>

              {/* Search Box */}
              <div className="relative flex items-center min-w-[200px] sm:max-w-xs w-full sm:w-auto">
                <Search size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama siswa..."
                  className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-2xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5"
                    title="Hapus pencarian"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* 1. Mobile Phone Touch Card View (< md) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((r, idx) => (
                  <div key={r.studentId} className="p-3.5 space-y-2.5 hover:bg-slate-50/60 transition-colors">
                    {/* Card Top: Number + Name + Subject Sync Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-extrabold text-xs text-slate-900 truncate">
                          {r.studentName}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Status Surat Izin / Sakit Orang Tua */}
                        {(() => {
                          const activeLeave = (leaveRequests || []).find(
                            (lr) =>
                              lr.studentId === r.studentId &&
                              lr.startDate <= date &&
                              (lr.endDate || lr.startDate) >= date
                          );
                          if (!activeLeave) return null;
                          if (activeLeave.status === 'PENDING') {
                            return (
                              <button
                                type="button"
                                onClick={() => setIsLeaveApprovalOpen(true)}
                                className="inline-flex items-center gap-1 text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded-full hover:bg-amber-200 transition-colors shrink-0 shadow-2xs cursor-pointer animate-pulse"
                                title={`Ada permohonan surat izin/sakit: "${activeLeave.reason}". Klik untuk verifikasi.`}
                              >
                                <FileText size={10} className="text-amber-700" />
                                <span>Surat Izin</span>
                              </button>
                            );
                          }
                          if (activeLeave.status === 'APPROVED') {
                            return (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200 px-1.5 py-0.5 rounded-full shrink-0"
                                title={`Surat izin disetujui: ${activeLeave.subCategory || activeLeave.leaveType} (${activeLeave.reason})`}
                              >
                                <CheckCircle2 size={10} className="text-sky-600" />
                                <span>{activeLeave.leaveType === 'sakit' ? 'Sakit Resmi' : 'Izin Resmi'}</span>
                              </span>
                            );
                          }
                          return null;
                        })()}

                        {attendanceMode === 'DAILY' &&
                          (() => {
                            const mapelList = subjectRecordsTodayByStudent.get(r.studentId) || [];
                            if (mapelList.length === 0) return null;
                            return (
                              <div className="flex flex-wrap items-center gap-1">
                                {mapelList.map(({ record: ar, subjectName }) => {
                                  const isDifferent = r.status && ar.status !== r.status;
                                  if (isDifferent) {
                                    return (
                                      <div
                                        key={ar.id || subjectName}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-50 border border-amber-300 text-amber-900 shadow-2xs"
                                        title={`Guru Mapel ${subjectName} mencatat: ${ar.status}${ar.notes ? ` (${ar.notes})` : ''}`}
                                      >
                                        <AlertTriangle size={10} className="text-amber-600 shrink-0" />
                                        <span>{subjectName}: <strong>{ar.status}</strong></span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleApplySubjectStatusToDaily(r.studentId, ar.status, subjectName, ar.notes);
                                          }}
                                          className="ml-0.5 px-1 py-0.2 rounded bg-amber-200 hover:bg-amber-300 text-amber-950 font-black text-[9px] cursor-pointer"
                                          title={`Terapkan status ${ar.status} dari ${subjectName} ke presensi harian`}
                                        >
                                          Samakan
                                        </button>
                                      </div>
                                    );
                                  }
                                  return (
                                    <span
                                      key={ar.id || subjectName}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-800"
                                      title={`Sesuai dengan Guru Mapel ${subjectName}: ${ar.status}`}
                                    >
                                      <span className="w-1 h-1 rounded-full bg-emerald-500" />
                                      {subjectName}: {ar.status}
                                    </span>
                                  );
                                })}
                              </div>
                            );
                          })()}

                        {attendanceMode === 'SUBJECT' &&
                          (() => {
                            const dailyRec = attendanceRecords.find(
                              (ar) =>
                                ar.studentId === r.studentId &&
                                ar.date === date &&
                                (!ar.type || ar.type === 'DAILY')
                            );
                            if (dailyRec?.status === 'Hadir') {
                              return (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md shrink-0">
                                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                                  Hadir Wali
                                </span>
                              );
                            }
                            if (dailyRec?.status === 'Sakit' || dailyRec?.status === 'Izin') {
                              return (
                                <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md shrink-0">
                                  {dailyRec.status} (Wali)
                                </span>
                              );
                            }
                            if (dailyRec?.status === 'Alfa') {
                              return (
                                <span className="inline-flex items-center text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md shrink-0">
                                  Alfa (Wali)
                                </span>
                              );
                            }
                            return null;
                          })()}
                      </div>
                    </div>

                    {/* Card 1-Tap Quick Attendance Buttons */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['Hadir', 'Sakit', 'Izin', 'Alfa'] as AttendanceStatus[]).map((statusOption) => {
                        const isSelected = r.status === statusOption;
                        let activeColor = '';
                        if (isSelected) {
                          if (statusOption === 'Hadir')
                            activeColor = 'bg-emerald-600 text-white border-emerald-600 shadow-xs font-black';
                          else if (statusOption === 'Sakit')
                            activeColor = 'bg-sky-600 text-white border-sky-600 shadow-xs font-black';
                          else if (statusOption === 'Izin')
                            activeColor = 'bg-amber-600 text-white border-amber-600 shadow-xs font-black';
                          else if (statusOption === 'Alfa')
                            activeColor = 'bg-rose-600 text-white border-rose-600 shadow-xs font-black';
                        } else {
                          activeColor =
                            'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 font-bold';
                        }

                        return (
                          <button
                            key={statusOption}
                            type="button"
                            disabled={isDateLocked}
                            onClick={() => {
                              const newStatus = isSelected ? '' : statusOption;
                              const isAbsent = newStatus === 'Sakit' || newStatus === 'Izin' || newStatus === 'Alfa';
                              updateRecord(r.studentId, {
                                status: newStatus as AttendanceStatus,
                                checkInTime: isAbsent
                                  ? ''
                                  : newStatus === 'Hadir' && !r.checkInTime
                                  ? attendanceMode === 'DAILY'
                                    ? (systemConfig?.defaultCheckInTime || '07:00')
                                    : scheduledStartTime
                                  : r.checkInTime,
                                checkOutTime: isAbsent
                                  ? ''
                                  : (r.checkOutTime || ''),
                              });
                            }}
                            className={`py-2 px-1 rounded-xl text-xs border text-center transition-all cursor-pointer min-h-[38px] active:scale-95 ${activeColor}`}
                          >
                            {statusOption}
                          </button>
                        );
                      })}
                    </div>

                    {/* Card Extra Fields: Times and Notes (Diselaraskan format antara Wali Kelas dan Guru Mapel) */}
                    {(() => {
                      const isAbsentStatus = r.status === 'Sakit' || r.status === 'Izin' || r.status === 'Alfa';
                      const isTimeDisabled = isDateLocked || isAbsentStatus;
                      return (
                        <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-colors ${
                            isTimeDisabled
                              ? 'bg-slate-100/90 border-slate-200 text-slate-400 cursor-not-allowed'
                              : 'bg-slate-50 border-slate-200'
                          }`}>
                            {isAbsentStatus ? (
                              <Lock size={11} className="text-slate-400 shrink-0" />
                            ) : (
                              <Clock size={11} className="text-slate-400 shrink-0" />
                            )}
                            <span className="text-[10px] text-slate-500 font-bold shrink-0">
                              {attendanceMode === 'DAILY' ? 'Masuk:' : 'Mulai:'}
                            </span>
                            <input
                              type="text"
                              value={isAbsentStatus ? '' : (r.checkInTime || '')}
                              disabled={isTimeDisabled}
                              readOnly={isTimeDisabled}
                              placeholder={isAbsentStatus ? '-' : (attendanceMode === 'DAILY' ? (systemConfig.defaultCheckInTime || '07:00') : scheduledStartTime)}
                              onChange={(e) => updateRecord(r.studentId, { checkInTime: e.target.value })}
                              className={`w-full bg-transparent text-xs font-semibold outline-none ${
                                isTimeDisabled ? 'cursor-not-allowed text-slate-400' : 'text-slate-800'
                              }`}
                              title={
                                isAbsentStatus
                                  ? `Waktu dikunci untuk status ${r.status}`
                                  : attendanceMode === 'DAILY'
                                  ? 'Jam Masuk Sekolah'
                                  : `Jam Mulai Pelajaran ${activeSubject?.name || 'Mapel'} (Terintegrasi: ${scheduledStartTime})`
                              }
                            />
                          </div>

                          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-colors ${
                            isTimeDisabled
                              ? 'bg-slate-100/90 border-slate-200 text-slate-400 cursor-not-allowed'
                              : 'bg-slate-50 border-slate-200'
                          }`}>
                            {isAbsentStatus ? (
                              <Lock size={11} className="text-slate-400 shrink-0" />
                            ) : (
                              <Clock size={11} className="text-slate-400 shrink-0" />
                            )}
                            <span className="text-[10px] text-slate-500 font-bold shrink-0">
                              {attendanceMode === 'DAILY' ? 'Pulang:' : 'Selesai:'}
                            </span>
                            <input
                              type="text"
                              value={isAbsentStatus ? '' : (r.checkOutTime || '')}
                              disabled={isTimeDisabled}
                              readOnly={isTimeDisabled}
                              placeholder={isAbsentStatus ? '-' : (attendanceMode === 'DAILY' ? (systemConfig.defaultCheckOutTime || '14:00') : scheduledEndTime)}
                              onChange={(e) => updateRecord(r.studentId, { checkOutTime: e.target.value })}
                              className={`w-full bg-transparent text-xs font-semibold outline-none ${
                                isTimeDisabled ? 'cursor-not-allowed text-slate-400' : 'text-slate-800'
                              }`}
                              title={
                                isAbsentStatus
                                  ? `Waktu dikunci untuk status ${r.status}`
                                  : attendanceMode === 'DAILY'
                                  ? 'Jam Pulang Sekolah'
                                  : `Jam Selesai Pelajaran ${activeSubject?.name || 'Mapel'} (Terintegrasi: ${scheduledEndTime})`
                              }
                            />
                          </div>

                          <div className="col-span-2">
                            <input
                              type="text"
                              value={r.notes || ''}
                              disabled={isDateLocked}
                              placeholder={
                                attendanceMode === 'DAILY'
                                  ? 'Catatan / keterangan surat izin...'
                                  : 'Catatan keaktifan siswa saat jam pelajaran...'
                              }
                              onChange={(e) => updateRecord(r.studentId, { notes: e.target.value })}
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Tidak ada siswa yang sesuai dengan filter atau pencarian.
                </div>
              )}
            </div>

            {/* 2. Desktop & Tablet Compact High-Density Table (≥ md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-bold text-blue-700 uppercase tracking-widest bg-blue-50/60">
                    <th className="py-2.5 px-3 w-10 text-center">NO</th>
                    <th className="py-2.5 px-3.5">NAMA SISWA</th>
                    <th className="py-2.5 px-3 w-38">STATUS KEHADIRAN</th>
                    {attendanceMode === 'DAILY' ? (
                      <>
                        <th className="py-2.5 px-3 w-28">JAM MASUK</th>
                        <th className="py-2.5 px-3 w-28">JAM PULANG</th>
                        <th className="py-2.5 px-3.5 w-52">KETERANGAN WALI KELAS</th>
                      </>
                    ) : (
                      <>
                        <th className="py-2.5 px-3 w-28">JAM MULAI</th>
                        <th className="py-2.5 px-3 w-28">JAM SELESAI</th>
                        <th className="py-2.5 px-3.5 w-52">KETERANGAN GURU MAPEL</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map((r, idx) => (
                      <tr key={r.studentId} className="hover:bg-slate-50/80 transition-colors">
                        {/* No */}
                        <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                          {idx + 1}
                        </td>

                        {/* Nama Siswa */}
                        <td className="py-2.5 px-3.5 font-bold text-slate-900 tracking-tight">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{r.studentName}</span>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Status Surat Izin / Sakit Orang Tua */}
                              {(() => {
                                const activeLeave = (leaveRequests || []).find(
                                  (lr) =>
                                    lr.studentId === r.studentId &&
                                    lr.startDate <= date &&
                                    (lr.endDate || lr.startDate) >= date
                                );
                                if (!activeLeave) return null;
                                if (activeLeave.status === 'PENDING') {
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => setIsLeaveApprovalOpen(true)}
                                      className="inline-flex items-center gap-1 text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full hover:bg-amber-200 transition-colors shadow-2xs cursor-pointer animate-pulse"
                                      title={`Ada permohonan surat izin/sakit: "${activeLeave.reason}". Klik untuk verifikasi.`}
                                    >
                                      <FileText size={10} className="text-amber-700" />
                                      <span>Surat Izin</span>
                                    </button>
                                  );
                                }
                                if (activeLeave.status === 'APPROVED') {
                                  return (
                                    <span
                                      className="inline-flex items-center gap-1 text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200 px-2 py-0.5 rounded-full"
                                      title={`Surat izin disetujui: ${activeLeave.subCategory || activeLeave.leaveType} (${activeLeave.reason})`}
                                    >
                                      <CheckCircle2 size={10} className="text-sky-600" />
                                      <span>
                                        {activeLeave.leaveType === 'sakit' ? 'Sakit Resmi' : 'Izin Resmi'}
                                      </span>
                                    </span>
                                  );
                                }
                                return null;
                              })()}

                              {attendanceMode === 'DAILY' &&
                                (() => {
                                  const mapelList = subjectRecordsTodayByStudent.get(r.studentId) || [];
                                  if (mapelList.length === 0) return null;
                                  return (
                                    <div className="flex flex-wrap items-center gap-1">
                                      {mapelList.map(({ record: ar, subjectName }) => {
                                        const isDifferent = r.status && ar.status !== r.status;
                                        if (isDifferent) {
                                          return (
                                            <div
                                              key={ar.id || subjectName}
                                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-50 border border-amber-300 text-amber-900 shadow-2xs"
                                              title={`Guru Mapel ${subjectName} mencatat: ${ar.status}${ar.notes ? ` (${ar.notes})` : ''}`}
                                            >
                                              <AlertTriangle size={10} className="text-amber-600 shrink-0" />
                                              <span>{subjectName}: <strong>{ar.status}</strong></span>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleApplySubjectStatusToDaily(r.studentId, ar.status, subjectName, ar.notes);
                                                }}
                                                className="ml-0.5 px-1 py-0.2 rounded bg-amber-200 hover:bg-amber-300 text-amber-950 font-black text-[9px] cursor-pointer"
                                                title={`Terapkan status ${ar.status} dari ${subjectName} ke presensi harian`}
                                              >
                                                Samakan
                                              </button>
                                            </div>
                                          );
                                        }
                                        return (
                                          <span
                                            key={ar.id || subjectName}
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-800"
                                            title={`Sesuai dengan Guru Mapel ${subjectName}: ${ar.status}`}
                                          >
                                            <span className="w-1 h-1 rounded-full bg-emerald-500" />
                                            {subjectName}: {ar.status}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}

                              {attendanceMode === 'SUBJECT' &&
                                (() => {
                                  const dailyRec = attendanceRecords.find(
                                    (ar) =>
                                      ar.studentId === r.studentId &&
                                      ar.date === date &&
                                      (!ar.type || ar.type === 'DAILY')
                                  );
                                  if (dailyRec?.status === 'Hadir') {
                                    return (
                                      <span
                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded shrink-0"
                                        title={`Siswa hadir di sekolah (dicatat Wali Kelas)`}
                                      >
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        Hadir
                                      </span>
                                    );
                                  }
                                  if (dailyRec?.status === 'Sakit' || dailyRec?.status === 'Izin') {
                                    return (
                                      <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded shrink-0">
                                        {dailyRec.status} (Wali)
                                      </span>
                                    );
                                  }
                                  if (dailyRec?.status === 'Alfa') {
                                    return (
                                      <span className="inline-flex items-center text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded shrink-0">
                                        Alfa (Wali)
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                            </div>
                          </div>
                        </td>

                        {/* Status Dropdown */}
                        <td className="py-2.5 px-3">
                          <select
                            value={r.status}
                            disabled={isDateLocked}
                            onChange={(e) => {
                              const newStatus = e.target.value as AttendanceStatus;
                              const isAbsent = newStatus === 'Sakit' || newStatus === 'Izin' || newStatus === 'Alfa';
                              updateRecord(r.studentId, {
                                status: newStatus,
                                checkInTime: isAbsent
                                  ? ''
                                  : newStatus === 'Hadir' && !r.checkInTime
                                  ? attendanceMode === 'DAILY'
                                    ? (systemConfig?.defaultCheckInTime || '07:00')
                                    : scheduledStartTime
                                  : r.checkInTime,
                                checkOutTime: isAbsent
                                  ? ''
                                  : (r.checkOutTime || ''),
                              });
                            }}
                            className={`w-full px-2 py-1 rounded-lg text-xs font-bold border transition-colors outline-none cursor-pointer ${
                              isDateLocked
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                : r.status === 'Hadir'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : r.status === 'Sakit'
                                ? 'bg-sky-50 text-sky-700 border-sky-300'
                                : r.status === 'Izin'
                                ? 'bg-amber-50 text-amber-700 border-amber-300'
                                : r.status === 'Alfa'
                                ? 'bg-rose-50 text-rose-700 border-rose-300'
                                : 'bg-slate-50 text-slate-500 border-slate-200'
                            }`}
                          >
                            <option value="">- Belum Diabsen -</option>
                            <option value="Hadir">Hadir</option>
                            <option value="Sakit">Sakit</option>
                            <option value="Izin">Izin</option>
                            <option value="Alfa">Alfa</option>
                          </select>
                        </td>

                        {(() => {
                          const isAbsentStatus = r.status === 'Sakit' || r.status === 'Izin' || r.status === 'Alfa';
                          const isTimeLocked = isDateLocked || isAbsentStatus;

                          return attendanceMode === 'DAILY' ? (
                            <>
                              {/* Masuk Time (Wali Kelas) */}
                              <td className="py-2.5 px-3">
                                <div className="relative flex items-center">
                                  <input
                                    type="text"
                                    value={isAbsentStatus ? '' : (r.checkInTime || '')}
                                    placeholder={isAbsentStatus ? '-' : (systemConfig.defaultCheckInTime || '07:00')}
                                    disabled={isTimeLocked}
                                    readOnly={isTimeLocked}
                                    onChange={(e) => updateRecord(r.studentId, { checkInTime: e.target.value })}
                                    className={`w-full pl-2 pr-5 py-1 border rounded-lg text-xs font-semibold outline-none transition-colors ${
                                      isTimeLocked
                                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed text-center'
                                        : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-600 focus:bg-white'
                                    }`}
                                    title={isAbsentStatus ? `Waktu dikunci untuk status ${r.status}` : 'Jam Masuk Sekolah (Wali Kelas)'}
                                  />
                                  {isAbsentStatus ? (
                                    <Lock size={10} className="absolute right-1.5 text-slate-400 pointer-events-none" />
                                  ) : (
                                    <Clock size={11} className="absolute right-1.5 text-slate-400 pointer-events-none" />
                                  )}
                                </div>
                              </td>

                              {/* Pulang Time (Wali Kelas) */}
                              <td className="py-2.5 px-3">
                                <div className="relative flex items-center">
                                  <input
                                    type="text"
                                    value={isAbsentStatus ? '' : (r.checkOutTime || '')}
                                    placeholder={isAbsentStatus ? '-' : (systemConfig.defaultCheckOutTime || '14:00')}
                                    disabled={isTimeLocked}
                                    readOnly={isTimeLocked}
                                    onChange={(e) => updateRecord(r.studentId, { checkOutTime: e.target.value })}
                                    className={`w-full pl-2 pr-5 py-1 border rounded-lg text-xs font-semibold outline-none transition-colors ${
                                      isTimeLocked
                                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed text-center'
                                        : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-600 focus:bg-white'
                                    }`}
                                    title={isAbsentStatus ? `Waktu dikunci untuk status ${r.status}` : 'Jam Pulang Sekolah (Wali Kelas)'}
                                  />
                                  {isAbsentStatus ? (
                                    <Lock size={10} className="absolute right-1.5 text-slate-400 pointer-events-none" />
                                  ) : (
                                    <Clock size={11} className="absolute right-1.5 text-slate-400 pointer-events-none" />
                                  )}
                                </div>
                              </td>

                              {/* Catatan Wali Kelas */}
                              <td className="py-2.5 px-3.5">
                                <input
                                  type="text"
                                  value={r.notes || ''}
                                  disabled={isDateLocked}
                                  readOnly={isDateLocked}
                                  onChange={(e) => updateRecord(r.studentId, { notes: e.target.value })}
                                  placeholder="Keterangan surat / izin..."
                                  className={`w-full px-2 py-1 rounded-lg text-xs outline-none transition-colors ${
                                    isDateLocked
                                      ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed placeholder-slate-400'
                                      : 'bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:bg-white'
                                  }`}
                                />
                              </td>
                            </>
                          ) : (
                            <>
                              {/* Jam Mulai (Guru Mapel - Terintegrasi dengan Data Referensi Mata Pelajaran) */}
                              <td className="py-2.5 px-3">
                                <div className="relative flex items-center">
                                  <input
                                    type="text"
                                    value={isAbsentStatus ? '' : (r.checkInTime || '')}
                                    placeholder={isAbsentStatus ? '-' : scheduledStartTime}
                                    disabled={isTimeLocked}
                                    readOnly={isTimeLocked}
                                    onChange={(e) => updateRecord(r.studentId, { checkInTime: e.target.value })}
                                    className={`w-full pl-2 pr-5 py-1 border rounded-lg text-xs font-semibold outline-none transition-colors ${
                                      isTimeLocked
                                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed text-center'
                                        : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-600 focus:bg-white'
                                    }`}
                                    title={isAbsentStatus ? `Waktu dikunci untuk status ${r.status}` : `Jam Mulai Pelajaran ${activeSubject?.name || 'Mapel'} (Terintegrasi Data Referensi: ${scheduledStartTime})`}
                                  />
                                  {isAbsentStatus ? (
                                    <Lock size={10} className="absolute right-1.5 text-slate-400 pointer-events-none" />
                                  ) : (
                                    <Clock size={11} className="absolute right-1.5 text-slate-400 pointer-events-none" />
                                  )}
                                </div>
                              </td>

                              {/* Jam Selesai (Guru Mapel - Terintegrasi dengan Data Referensi Mata Pelajaran) */}
                              <td className="py-2.5 px-3">
                                <div className="relative flex items-center">
                                  <input
                                    type="text"
                                    value={isAbsentStatus ? '' : (r.checkOutTime || '')}
                                    placeholder={isAbsentStatus ? '-' : scheduledEndTime}
                                    disabled={isTimeLocked}
                                    readOnly={isTimeLocked}
                                    onChange={(e) => updateRecord(r.studentId, { checkOutTime: e.target.value })}
                                    className={`w-full pl-2 pr-5 py-1 border rounded-lg text-xs font-semibold outline-none transition-colors ${
                                      isTimeLocked
                                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed text-center'
                                        : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-600 focus:bg-white'
                                    }`}
                                    title={isAbsentStatus ? `Waktu dikunci untuk status ${r.status}` : `Jam Selesai Pelajaran ${activeSubject?.name || 'Mapel'} (Terintegrasi Data Referensi: ${scheduledEndTime})`}
                                  />
                                  {isAbsentStatus ? (
                                    <Lock size={10} className="absolute right-1.5 text-slate-400 pointer-events-none" />
                                  ) : (
                                    <Clock size={11} className="absolute right-1.5 text-slate-400 pointer-events-none" />
                                  )}
                                </div>
                              </td>

                              {/* Catatan / Keterangan Guru Mapel */}
                              <td className="py-2.5 px-3.5">
                                <input
                                  type="text"
                                  value={r.notes || ''}
                                  disabled={isDateLocked}
                                  readOnly={isDateLocked}
                                  onChange={(e) => updateRecord(r.studentId, { notes: e.target.value })}
                                  placeholder="Catatan keaktifan siswa saat jam pelajaran..."
                                  className={`w-full px-2 py-1 rounded-lg text-xs outline-none transition-colors ${
                                    isDateLocked
                                      ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed placeholder-slate-400'
                                      : 'bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:bg-white'
                                  }`}
                                />
                              </td>
                            </>
                          );
                        })()}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-8 text-slate-400 font-medium text-xs"
                      >
                        {searchQuery
                          ? 'Tidak ada siswa yang cocok dengan kata kunci pencarian.'
                          : `Belum ada siswa di ${formatClassDisplay(currentSelectedClassName)}.`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Floating Sticky Bottom Save Bar */}
          <div className="sticky bottom-3 z-30 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 self-start sm:self-auto">
              {isDirty && !isDateLocked ? (
                <span className="inline-flex items-center gap-1.5 text-amber-600 font-extrabold text-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Ada perubahan belum disimpan</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 text-xs">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  <span>Semua data tersinkron</span>
                </span>
              )}
              <span className="text-slate-300">•</span>
              <span className="text-[11px] text-slate-500 font-medium">
                {countTotalDiabsen} / {records.length} terisi
              </span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={isDateLocked || isSaving}
                id="btn-simpan-absensi"
                className={`flex-1 sm:flex-none px-5 py-2.5 font-extrabold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 min-h-[42px] cursor-pointer ${
                  isDateLocked || isSaving
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white hover:shadow-md'
                }`}
              >
                {isSaving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : isDateLocked ? (
                  <Lock size={16} />
                ) : (
                  <Save size={16} />
                )}
                <span>
                  {isSaving
                    ? 'Menyimpan...'
                    : isNonEffectiveDay
                    ? 'Presensi Terkunci (Hari Libur)'
                    : isLockedForGuruMapel
                    ? 'Terkunci (Bukan Jadwal Mengajar)'
                    : 'Simpan Presensi'}
                </span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Class QR Attendance Code Modal */}
      {isClassQrOpen && activeTargetClass && (
        <ClassQrModal
          isOpen={isClassQrOpen}
          onClose={() => setIsClassQrOpen(false)}
          schoolClass={activeTargetClass}
          classItem={activeTargetClass}
          schoolProfile={schoolProfile}
          systemConfig={systemConfig}
          classList={availableClasses}
        />
      )}

      {/* Teacher Leave Approval Modal */}
      {isLeaveApprovalOpen && (
        <TeacherLeaveApprovalModal
          isOpen={isLeaveApprovalOpen}
          onClose={() => setIsLeaveApprovalOpen(false)}
          leaveRequests={leaveRequests || []}
          onUpdateStatus={updateLeaveRequestStatus}
          selectedClassName={activeTargetClass?.name}
          selectedClassId={activeTargetClass?.id}
          schoolId={currentUser?.schoolId || activeTargetClass?.school_id || (activeWorkspace as any)?.workspaceId}
        />
      )}
    </div>
  );
};
