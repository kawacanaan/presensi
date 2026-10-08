import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { PublicDailyReportViewer } from '../components/PublicDailyReportViewer';
import { getUserRoleScope } from '../utils/userScope';
import { getFaseByClassName, formatClassDisplay } from '../utils/faseKurikulum';
import { normalizeClassToken } from '../utils/documentParser';
import {
  ArrowLeft,
  FileText,
  Printer,
  Lock,
  ShieldCheck,
  CheckCircle2,
  Building2,
  Calendar,
  Layers,
  GraduationCap,
  Sparkles,
  Users,
  Check,
} from 'lucide-react';

export const LaporanView: React.FC = () => {
  const {
    schoolProfile,
    systemConfig,
    setActiveView,
    students,
    attendanceRecords,
    getEffectiveDaysForMonth,
    classes,
    subjects,
    teachers,
    currentUser,
    activeWorkspace,
    requestFeatureAccess,
    openUpgradeModal,
    isTeacherPro,
    isSchoolPro,
  } = useApp();

  const isPersonalWorkspace =
    activeWorkspace?.workspaceType === 'personal' ||
    activeWorkspace?.workspaceType === 'individu' ||
    currentUser?.subscriptionPlan === 'guru_uji_coba' ||
    currentUser?.subscriptionPlan === 'teacher' ||
    currentUser?.subscriptionPlan === 'guru_pro' ||
    currentUser?.subscriptionPlan === 'mulai' ||
    currentUser?.subscriptionPlan === 'guru_gratis' ||
    (!currentUser?.schoolId && currentUser?.role !== 'SUPER_ADMIN');

  const isFreePlan =
    (isPersonalWorkspace || !currentUser?.schoolId || currentUser?.subscriptionPlan === 'guru_gratis' || currentUser?.subscriptionPlan === 'mulai') &&
    !isTeacherPro &&
    !isSchoolPro &&
    currentUser?.role !== 'SUPER_ADMIN';

  const userScope = useMemo(
    () => getUserRoleScope(currentUser, classes, subjects, teachers),
    [currentUser, classes, subjects, teachers]
  );

  const { startYear, endYear } = useMemo(() => {
    const matches = (schoolProfile.tahunPelajaran || '').match(/\d{4}/g);
    if (matches && matches.length >= 2) {
      return { startYear: parseInt(matches[0], 10), endYear: parseInt(matches[1], 10) };
    } else if (matches && matches.length === 1) {
      const y1 = parseInt(matches[0], 10);
      return { startYear: y1, endYear: y1 + 1 };
    }
    return { startYear: 2026, endYear: 2027 };
  }, [schoolProfile.tahunPelajaran]);

  // Mode for admin/kepsek: 'KEPSEK' (Sekolah-wide) vs 'CLASS' (Per Rombel)
  const isDefaultKepsek = userScope.isKepalaSekolah || currentUser?.role === 'KEPALA SEKOLAH';
  const [viewScopeMode, setViewScopeMode] = useState<'KEPSEK' | 'CLASS'>(
    isDefaultKepsek ? 'KEPSEK' : 'CLASS'
  );

  // Kepala Sekolah Sub-Tab: 'bulanan' | 'semester' | 'tahunan'
  const [kepsekTab, setKepsekTab] = useState<'bulanan' | 'semester' | 'tahunan'>('bulanan');
  const [kepsekSemester, setKepsekSemester] = useState<'Ganjil' | 'Genap'>('Ganjil');
  const [kepsekAcademicYear, setKepsekAcademicYear] = useState<string>(
    schoolProfile.tahunPelajaran || `${startYear}/${endYear}`
  );

  // Class/Standard report state
  const [reportType, setReportType] = useState('Laporan Bulanan');
  const [attendanceType, setAttendanceType] = useState<'DAILY' | 'SUBJECT'>(
    userScope.isGuruMapel ? 'SUBJECT' : 'DAILY'
  );

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => {
    if (userScope.isGuruMapel && userScope.assignedSubjects.length > 0) {
      return userScope.assignedSubjects[0].id;
    }
    return subjects.find((s) => s.isSpecialized)?.id || subjects[0]?.id || '';
  });

  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    if (userScope.isWaliKelas && userScope.assignedWaliClassId) {
      return userScope.assignedWaliClassId;
    }
    if (userScope.isWaliKelas && userScope.assignedWaliClass?.id) {
      return userScope.assignedWaliClass.id;
    }
    if (userScope.isGuruMapel && userScope.accessibleClasses.length > 0) {
      return userScope.accessibleClasses[0].id;
    }
    return classes[0]?.id || '';
  });

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedWeek, setSelectedWeek] = useState('Minggu Ke-1');
  const [month, setMonth] = useState(() => {
    const mNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return mNames[new Date().getMonth()] || 'Juli';
  });
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Keep state in sync with user role authority
  useEffect(() => {
    if (userScope.isWaliKelas) {
      setViewScopeMode('CLASS');
      setAttendanceType('DAILY');
      const waliClassIds = userScope.accessibleClasses.map((c) => c.id);
      if (waliClassIds.length > 0 && (!selectedClassId || !waliClassIds.includes(selectedClassId))) {
        setSelectedClassId(userScope.assignedWaliClassId || waliClassIds[0]);
      }
    } else if (userScope.isGuruMapel) {
      setViewScopeMode('CLASS');
      setAttendanceType('SUBJECT');
      if (userScope.assignedSubjects.length > 0 && !userScope.assignedSubjects.some((s) => s.id === selectedSubjectId)) {
        setSelectedSubjectId(userScope.assignedSubjects[0].id);
      }
      if (userScope.accessibleClasses.length > 0 && (!selectedClassId || !userScope.accessibleClasses.some((c) => c.id === selectedClassId))) {
        setSelectedClassId(userScope.accessibleClasses[0].id);
      }
    } else if (userScope.isKepalaSekolah) {
      setViewScopeMode('KEPSEK');
    }
  }, [userScope, classes, selectedClassId, selectedSubjectId]);

  // Specialized subjects for current user
  const specializedSubjects = useMemo(() => {
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
      if (matched.length > 0) return matched;
    }
    return subjects.filter((s) => s.isSpecialized).length > 0
      ? subjects.filter((s) => s.isSpecialized)
      : subjects;
  }, [userScope, subjects]);

  const selectableClasses = useMemo(() => {
    if (userScope.isWaliKelas) {
      return userScope.accessibleClasses.length > 0
        ? userScope.accessibleClasses
        : (userScope.assignedWaliClass ? [userScope.assignedWaliClass] : classes.slice(0, 1));
    }
    if (userScope.isGuruMapel) {
      return userScope.accessibleClasses;
    }
    return classes;
  }, [userScope, classes]);

  const effectiveClassId = useMemo(() => {
    if (selectedClassId) return selectedClassId;
    if (userScope.isWaliKelas) {
      return (
        userScope.assignedWaliClassId ||
        userScope.assignedWaliClass?.id ||
        classes.find((c) => c.name.toLowerCase() === (userScope.assignedWaliClassName || '').toLowerCase())?.id ||
        classes[0]?.id ||
        ''
      );
    }
    if (userScope.isGuruMapel) {
      return userScope.accessibleClasses[0]?.id || classes[0]?.id || '';
    }
    return classes[0]?.id || '';
  }, [selectedClassId, userScope, classes]);

  const effectiveSubjectId = useMemo(() => {
    if (selectedSubjectId) return selectedSubjectId;
    if (userScope.isGuruMapel) {
      return userScope.assignedSubjects[0]?.id || specializedSubjects[0]?.id || subjects[0]?.id || '';
    }
    return '';
  }, [selectedSubjectId, userScope, specializedSubjects, subjects]);

  const selectedSubjectObj = useMemo(() => {
    return subjects.find((s) => s.id === (effectiveSubjectId || selectedSubjectId)) || null;
  }, [subjects, effectiveSubjectId, selectedSubjectId]);

  const selectedClassObj = useMemo(() => {
    return classes.find((c) => c.id === (effectiveClassId || selectedClassId)) || null;
  }, [classes, effectiveClassId, selectedClassId]);

  // Auto-sync year based on semester
  React.useEffect(() => {
    const isSem1 = ['Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].includes(month);
    setYear(String(isSem1 ? startYear : endYear));
  }, [month, startYear, endYear]);

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const weeks = [
    'Minggu Ke-1',
    'Minggu Ke-2',
    'Minggu Ke-3',
    'Minggu Ke-4',
    'Minggu Ke-5',
  ];

  const monthNumberMap: { [key: string]: number } = {
    'Januari': 1, 'Februari': 2, 'Maret': 3, 'April': 4,
    'Mei': 5, 'Juni': 6, 'Juli': 7, 'Agustus': 8,
    'September': 9, 'Oktober': 10, 'November': 11, 'Desember': 12
  };

  const mNum = monthNumberMap[month] || 7;
  const monthKey = `${year}-${String(mNum).padStart(2, '0')}`;
  const effectiveDays = getEffectiveDaysForMonth(Number(year) || 2026, mNum);

  // Filter students strictly by selected class (never leak all students or other classes)
  const filteredStudents = useMemo(() => {
    const targetClass = selectedClassObj || classes.find((c) => c.id === effectiveClassId || c.id === selectedClassId);
    if (!targetClass) return [];
    return students
      .filter((s) => {
        if (s.classId && s.classId === targetClass.id) return true;
        if (s.className && normalizeClassToken(s.className) === normalizeClassToken(targetClass.name)) return true;
        return false;
      })
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  }, [students, selectedClassObj, classes, effectiveClassId, selectedClassId]);

  // Semester calculation for Class View
  const isSemesterGenap = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni'].includes(month);
  const classSemester: 'Ganjil' | 'Genap' = isSemesterGenap ? 'Genap' : 'Ganjil';
  const semYear = isSemesterGenap ? endYear : startYear;

  const semesterMonths = useMemo(() => {
    if (isSemesterGenap) {
      return [
        { code: '01', name: 'Januari', mNum: 1, key: `${endYear}-01` },
        { code: '02', name: 'Februari', mNum: 2, key: `${endYear}-02` },
        { code: '03', name: 'Maret', mNum: 3, key: `${endYear}-03` },
        { code: '04', name: 'April', mNum: 4, key: `${endYear}-04` },
        { code: '05', name: 'Mei', mNum: 5, key: `${endYear}-05` },
        { code: '06', name: 'Juni', mNum: 6, key: `${endYear}-06` },
      ];
    } else {
      return [
        { code: '07', name: 'Juli', mNum: 7, key: `${startYear}-07` },
        { code: '08', name: 'Agustus', mNum: 8, key: `${startYear}-08` },
        { code: '09', name: 'September', mNum: 9, key: `${startYear}-09` },
        { code: '10', name: 'Oktober', mNum: 10, key: `${startYear}-10` },
        { code: '11', name: 'November', mNum: 11, key: `${startYear}-11` },
        { code: '12', name: 'Desember', mNum: 12, key: `${startYear}-12` },
      ];
    }
  }, [isSemesterGenap, startYear, endYear]);

  const semesterEffectiveDays = useMemo(() => {
    return semesterMonths.reduce(
      (acc, m) => acc + (getEffectiveDaysForMonth(semYear, m.mNum) || 20),
      0
    );
  }, [semesterMonths, semYear, getEffectiveDaysForMonth]);

  // Filter attendance records based strictly on selected class students
  const relevantRecords = useMemo(() => {
    const studentIds = new Set(filteredStudents.map((s) => s.id));
    if (studentIds.size === 0) return [];
    return attendanceRecords.filter((r) => {
      if (!studentIds.has(r.studentId)) return false;
      if (attendanceType === 'SUBJECT') {
        if (r.type !== 'SUBJECT') return false;
        if (selectedSubjectId && r.subjectId !== selectedSubjectId) return false;
      } else {
        if (r.type === 'SUBJECT') return false;
      }
      return true;
    });
  }, [attendanceRecords, attendanceType, selectedSubjectId, filteredStudents]);

  // 1. DATA COMPUTATION: LAPORAN HARIAN
  const dailyRows = useMemo(() => {
    return filteredStudents.map((s) => {
      const rec = relevantRecords.find((r) => r.studentId === s.id && r.date === selectedDate);
      return {
        ...s,
        status: rec?.status || 'Belum Diabsen',
        timeIn: rec?.checkInTime || '-',
        timeOut: rec?.checkOutTime || '-',
        notes: rec?.notes || '-',
      };
    });
  }, [filteredStudents, relevantRecords, selectedDate]);

  // 2. DATA COMPUTATION: LAPORAN MINGGUAN - selalu mulai hari Senin
  const weekNum = parseInt(selectedWeek.replace(/\D/g, ''), 10) || 1;
  const weeklyDays = useMemo(() => {
    const yearNum = Number(year) || 2026;
    const firstOfMonth = new Date(yearNum, mNum - 1, 1);
    const dow = firstOfMonth.getDay(); // 0 = Minggu, 1 = Senin, 2 = Selasa, ..., 6 = Sabtu
    let firstMonday: Date;
    if (dow === 1) {
      firstMonday = new Date(yearNum, mNum - 1, 1);
    } else if (dow === 6) {
      firstMonday = new Date(yearNum, mNum - 1, 3);
    } else if (dow === 0) {
      firstMonday = new Date(yearNum, mNum - 1, 2);
    } else {
      // Selasa(2), Rabu(3), Kamis(4), Jumat(5) -> Mundur ke Senin pada minggu yang sama
      firstMonday = new Date(yearNum, mNum - 1, 1 - (dow - 1));
    }

    const weekMonday = new Date(firstMonday);
    weekMonday.setDate(firstMonday.getDate() + (weekNum - 1) * 7);

    const is6Days = systemConfig?.activeStudyDays?.includes(6);
    const daysCount = is6Days ? 6 : 5;

    const days: { dateStr: string; dayNum: number; dayShort: string; dayName: string }[] = [];
    const dayNamesShort = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const dayNamesFull = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    for (let i = 0; i < daysCount; i++) {
      const d = new Date(weekMonday);
      d.setDate(weekMonday.getDate() + i);
      const dowIndex = d.getDay();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayOfMonth = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${dayOfMonth}`;

      days.push({
        dateStr,
        dayNum: d.getDate(),
        dayShort: dayNamesShort[dowIndex],
        dayName: dayNamesFull[dowIndex],
      });
    }
    return days;
  }, [year, mNum, weekNum, systemConfig?.activeStudyDays]);

  const weekDates = useMemo(() => weeklyDays.map((d) => d.dateStr), [weeklyDays]);

  const weeklyRows = useMemo(() => {
    return filteredStudents.map((s) => {
      const recs = relevantRecords.filter((r) => r.studentId === s.id && weekDates.includes(r.date));
      const dayMap: { [dateStr: string]: string } = {};
      weeklyDays.forEach((d) => {
        const found = recs.find((r) => r.date === d.dateStr);
        dayMap[d.dateStr] = found
          ? found.status === 'Hadir'
            ? 'H'
            : found.status === 'Sakit'
            ? 'S'
            : found.status === 'Izin'
            ? 'I'
            : 'A'
          : '-';
      });
      const hadir = recs.filter((r) => r.status === 'Hadir').length;
      const sakit = recs.filter((r) => r.status === 'Sakit').length;
      const izin = recs.filter((r) => r.status === 'Izin').length;
      const alfa = recs.filter((r) => r.status === 'Alfa').length;
      const totalDays = weeklyDays.length || 1;
      const pct = Math.round((hadir / totalDays) * 100);
      return { ...s, dayMap, hadir, sakit, izin, alfa, pct };
    });
  }, [filteredStudents, relevantRecords, weeklyDays, weekDates]);

  // 3. DATA COMPUTATION: LAPORAN BULANAN
  const monthlyRows = useMemo(() => {
    return filteredStudents.map((s) => {
      const recs = relevantRecords.filter((r) => r.studentId === s.id && r.date.startsWith(monthKey));
      const hadir = recs.filter((r) => r.status === 'Hadir').length;
      const sakit = recs.filter((r) => r.status === 'Sakit').length;
      const izin = recs.filter((r) => r.status === 'Izin').length;
      const alfa = recs.filter((r) => r.status === 'Alfa').length;
      const totalRecorded = hadir + sakit + izin + alfa;
      const baseDenom = effectiveDays || totalRecorded || 1;
      const pct = Math.min(100, Math.round((hadir / baseDenom) * 100));
      return { ...s, hadir, sakit, izin, alfa, totalRecorded, pct };
    });
  }, [filteredStudents, relevantRecords, monthKey, effectiveDays]);

  // 4. DATA COMPUTATION: LAPORAN SEMESTER
  const semesterRows = useMemo(() => {
    const denom = semesterEffectiveDays || 1;
    return filteredStudents.map((s) => {
      const recs = relevantRecords.filter(
        (r) => r.studentId === s.id && semesterMonths.some((m) => r.date.startsWith(m.key))
      );
      const hadir = recs.filter((r) => r.status === 'Hadir').length;
      const sakit = recs.filter((r) => r.status === 'Sakit').length;
      const izin = recs.filter((r) => r.status === 'Izin').length;
      const alfa = recs.filter((r) => r.status === 'Alfa').length;
      const totalRecorded = hadir + sakit + izin + alfa;

      const pctHadir = Math.min(100, Math.round((hadir / denom) * 100));
      const pctSakit = Math.round((sakit / denom) * 100 * 10) / 10;
      const pctIzin = Math.round((izin / denom) * 100 * 10) / 10;
      const pctAlfa = Math.round((alfa / denom) * 100 * 10) / 10;

      let predicate = 'Sangat Baik';
      if (pctHadir < 75) predicate = 'Perlu Pembinaan';
      else if (pctHadir < 85) predicate = 'Cukup';
      else if (pctHadir < 95) predicate = 'Baik';

      return {
        ...s,
        hadir,
        sakit,
        izin,
        alfa,
        totalRecorded,
        pctHadir,
        pctSakit,
        pctIzin,
        pctAlfa,
        predicate,
      };
    });
  }, [filteredStudents, relevantRecords, semesterMonths, semesterEffectiveDays]);

  // Live Summary Stats for single-class preview according to selected period
  const liveSummary = useMemo(() => {
    const formatPct = (val: number) => (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1));

    if (reportType === 'Laporan Harian') {
      const hadir = dailyRows.filter((r) => r.status === 'Hadir').length;
      const sakit = dailyRows.filter((r) => r.status === 'Sakit').length;
      const izin = dailyRows.filter((r) => r.status === 'Izin').length;
      const alfa = dailyRows.filter((r) => r.status === 'Alfa').length;
      const total = hadir + sakit + izin + alfa;
      const denom = filteredStudents.length || total || 1;
      return {
        hadir,
        sakit,
        izin,
        alfa,
        total,
        pctHadir: formatPct((hadir / denom) * 100),
        pctSakit: formatPct((sakit / denom) * 100),
        pctIzin: formatPct((izin / denom) * 100),
        pctAlfa: formatPct((alfa / denom) * 100),
      };
    }

    if (reportType === 'Laporan Mingguan') {
      const hadir = weeklyRows.reduce((acc, r) => acc + r.hadir, 0);
      const sakit = weeklyRows.reduce((acc, r) => acc + r.sakit, 0);
      const izin = weeklyRows.reduce((acc, r) => acc + r.izin, 0);
      const alfa = weeklyRows.reduce((acc, r) => acc + r.alfa, 0);
      const total = hadir + sakit + izin + alfa;
      const denom = (filteredStudents.length * (weeklyDays.length || 1)) || total || 1;
      return {
        hadir,
        sakit,
        izin,
        alfa,
        total,
        pctHadir: formatPct((hadir / denom) * 100),
        pctSakit: formatPct((sakit / denom) * 100),
        pctIzin: formatPct((izin / denom) * 100),
        pctAlfa: formatPct((alfa / denom) * 100),
      };
    }

    if (reportType === 'Laporan Bulanan') {
      const hadir = monthlyRows.reduce((acc, r) => acc + r.hadir, 0);
      const sakit = monthlyRows.reduce((acc, r) => acc + r.sakit, 0);
      const izin = monthlyRows.reduce((acc, r) => acc + r.izin, 0);
      const alfa = monthlyRows.reduce((acc, r) => acc + r.alfa, 0);
      const total = hadir + sakit + izin + alfa;
      const denom = (filteredStudents.length * (effectiveDays || 20)) || total || 1;
      return {
        hadir,
        sakit,
        izin,
        alfa,
        total,
        pctHadir: formatPct((hadir / denom) * 100),
        pctSakit: formatPct((sakit / denom) * 100),
        pctIzin: formatPct((izin / denom) * 100),
        pctAlfa: formatPct((alfa / denom) * 100),
      };
    }

    // Laporan Semester
    const hadir = semesterRows.reduce((acc, r) => acc + r.hadir, 0);
    const sakit = semesterRows.reduce((acc, r) => acc + r.sakit, 0);
    const izin = semesterRows.reduce((acc, r) => acc + r.izin, 0);
    const alfa = semesterRows.reduce((acc, r) => acc + r.alfa, 0);
    const total = hadir + sakit + izin + alfa;
    const denom = (filteredStudents.length * (semesterEffectiveDays || 1)) || total || 1;
    return {
      hadir,
      sakit,
      izin,
      alfa,
      total,
      pctHadir: formatPct((hadir / denom) * 100),
      pctSakit: formatPct((sakit / denom) * 100),
      pctIzin: formatPct((izin / denom) * 100),
      pctAlfa: formatPct((alfa / denom) * 100),
    };
  }, [reportType, dailyRows, weeklyRows, monthlyRows, semesterRows, filteredStudents.length, weeklyDays.length, effectiveDays, semesterEffectiveDays]);

  // =========================================================================
  // KEPALA SEKOLAH COMPUTED DATA (AUTO AGGREGATION FROM WALI KELAS INPUTS)
  // =========================================================================
  const kepsekPeriodData = useMemo(() => {
    if (kepsekTab === 'bulanan') {
      const curMNum = monthNumberMap[month] || 7;
      const curMKey = `${year}-${String(curMNum).padStart(2, '0')}`;
      const effDays = getEffectiveDaysForMonth(Number(year) || 2026, curMNum) || 20;
      return {
        label: `Bulan ${month} ${year}`,
        monthKeys: [curMKey],
        effectiveDays: effDays,
        reportTypeModal: 'Laporan Kepala Sekolah (Bulanan)',
      };
    } else if (kepsekTab === 'semester') {
      const isSem1 = kepsekSemester === 'Ganjil';
      const semYear = isSem1 ? startYear : endYear;
      const mList = isSem1
        ? [7, 8, 9, 10, 11, 12].map((m) => ({ mNum: m, key: `${startYear}-${String(m).padStart(2, '0')}` }))
        : [1, 2, 3, 4, 5, 6].map((m) => ({ mNum: m, key: `${endYear}-${String(m).padStart(2, '0')}` }));
      const effDays = mList.reduce((acc, item) => acc + (getEffectiveDaysForMonth(semYear, item.mNum) || 20), 0);
      return {
        label: `Semester ${isSem1 ? '1 (Ganjil)' : '2 (Genap)'} TP ${kepsekAcademicYear}`,
        monthKeys: mList.map((m) => m.key),
        effectiveDays: effDays,
        reportTypeModal: 'Laporan Kepala Sekolah (Semester)',
      };
    } else {
      // Tahunan (Semester Ganjil + Genap)
      const sem1List = [7, 8, 9, 10, 11, 12].map((m) => ({ mNum: m, key: `${startYear}-${String(m).padStart(2, '0')}` }));
      const sem2List = [1, 2, 3, 4, 5, 6].map((m) => ({ mNum: m, key: `${endYear}-${String(m).padStart(2, '0')}` }));
      const allMonths = [...sem1List, ...sem2List];
      const effDays = sem1List.reduce((acc, item) => acc + (getEffectiveDaysForMonth(startYear, item.mNum) || 20), 0) +
                      sem2List.reduce((acc, item) => acc + (getEffectiveDaysForMonth(endYear, item.mNum) || 20), 0);
      return {
        label: `Tahun Pelajaran Penuh ${kepsekAcademicYear} (Ganjil + Genap)`,
        monthKeys: allMonths.map((m) => m.key),
        effectiveDays: effDays,
        reportTypeModal: 'Laporan Kepala Sekolah (Tahunan)',
      };
    }
  }, [kepsekTab, month, year, kepsekSemester, kepsekAcademicYear, startYear, endYear, getEffectiveDaysForMonth, monthNumberMap]);

  // Aggregate class rows for Kepala Sekolah
  const kepsekClassRows = useMemo(() => {
    const sortedClasses = [...classes].sort((a, b) => (a.grade || 1) - (b.grade || 1) || a.name.localeCompare(b.name));

    return sortedClasses.map((cls) => {
      const classStudents = students.filter((s) => s.classId === cls.id);
      const studentIds = new Set(classStudents.map((s) => s.id));
      const maleCount = classStudents.filter((s) => s.gender === 'L').length;
      const femaleCount = classStudents.filter((s) => s.gender === 'P').length;
      const totalStudents = classStudents.length;

      // Filter daily attendance records for this class
      const clsRecords = attendanceRecords.filter((r) => {
        if (r.type === 'SUBJECT') return false;
        const isClassMatch = r.classId === cls.id || studentIds.has(r.studentId);
        if (!isClassMatch) return false;
        return kepsekPeriodData.monthKeys.some((mKey) => r.date.startsWith(mKey));
      });

      const hadir = clsRecords.filter((r) => r.status === 'Hadir').length;
      const sakit = clsRecords.filter((r) => r.status === 'Sakit').length;
      const izin = clsRecords.filter((r) => r.status === 'Izin').length;
      const alfa = clsRecords.filter((r) => r.status === 'Alfa').length;
      const totalRecorded = hadir + sakit + izin + alfa;

      const denom = (totalStudents * kepsekPeriodData.effectiveDays) || totalRecorded || 1;
      const pctHadir = denom > 0 ? (hadir / denom) * 100 : 0;
      const pctSakit = denom > 0 ? (sakit / denom) * 100 : 0;
      const pctIzin = denom > 0 ? (izin / denom) * 100 : 0;
      const pctAlfa = denom > 0 ? (alfa / denom) * 100 : 0;

      let predicate = 'Sangat Baik';
      if (pctHadir < 75) predicate = 'Perlu Pembinaan';
      else if (pctHadir < 85) predicate = 'Cukup';
      else if (pctHadir < 95) predicate = 'Baik';

      let waliName = cls.waliKelasName || '';
      if (!waliName && cls.waliKelasTeacherId) {
        const t = teachers.find((tc) => tc.id === cls.waliKelasTeacherId);
        if (t) waliName = t.nama;
      }

      const formatVal = (val: number) => (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1));

      return {
        classId: cls.id,
        className: formatClassDisplay(cls.name),
        grade: cls.grade,
        fase: getFaseByClassName(cls.name, cls.grade),
        waliKelasName: waliName || '-',
        maleCount,
        femaleCount,
        totalStudents,
        hadir,
        sakit,
        izin,
        alfa,
        totalRecorded,
        pctHadir: formatVal(pctHadir),
        pctSakit: formatVal(pctSakit),
        pctIzin: formatVal(pctIzin),
        pctAlfa: formatVal(pctAlfa),
        pctHadirNum: pctHadir,
        predicate,
      };
    });
  }, [classes, students, attendanceRecords, kepsekPeriodData, teachers]);

  // Aggregate School Totals for Kepala Sekolah
  const kepsekSchoolTotals = useMemo(() => {
    const totalMale = kepsekClassRows.reduce((a, c) => a + c.maleCount, 0);
    const totalFemale = kepsekClassRows.reduce((a, c) => a + c.femaleCount, 0);
    const totalStudents = kepsekClassRows.reduce((a, c) => a + c.totalStudents, 0);
    const totalHadir = kepsekClassRows.reduce((a, c) => a + c.hadir, 0);
    const totalSakit = kepsekClassRows.reduce((a, c) => a + c.sakit, 0);
    const totalIzin = kepsekClassRows.reduce((a, c) => a + c.izin, 0);
    const totalAlfa = kepsekClassRows.reduce((a, c) => a + c.alfa, 0);
    const grandRecorded = totalHadir + totalSakit + totalIzin + totalAlfa;

    const grandDenom = (totalStudents * kepsekPeriodData.effectiveDays) || grandRecorded || 1;
    const pctHadir = grandDenom > 0 ? (totalHadir / grandDenom) * 100 : 0;
    const pctSakit = grandDenom > 0 ? (totalSakit / grandDenom) * 100 : 0;
    const pctIzin = grandDenom > 0 ? (totalIzin / grandDenom) * 100 : 0;
    const pctAlfa = grandDenom > 0 ? (totalAlfa / grandDenom) * 100 : 0;

    let predicate = 'Sangat Baik';
    if (pctHadir < 75) predicate = 'Perlu Pembinaan';
    else if (pctHadir < 85) predicate = 'Cukup';
    else if (pctHadir < 95) predicate = 'Baik';

    const formatVal = (val: number) => (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1));

    return {
      totalMale,
      totalFemale,
      totalStudents,
      totalHadir,
      totalSakit,
      totalIzin,
      totalAlfa,
      grandRecorded,
      pctHadir: formatVal(pctHadir),
      pctSakit: formatVal(pctSakit),
      pctIzin: formatVal(pctIzin),
      pctAlfa: formatVal(pctAlfa),
      pctHadirNum: pctHadir,
      predicate,
    };
  }, [kepsekClassRows, kepsekPeriodData.effectiveDays]);

  // Format date display for info banner
  const formatReportDateIndo = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-');
      const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      return `${parseInt(d, 10)} ${monthNames[Number(m) - 1] || m} ${y}`;
    } catch {
      return dateStr;
    }
  };

  const handlePrintSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsPrintModalOpen(true);
  };

  const handleKepsekPrint = () => {
    if (
      !requestFeatureAccess(
        'laporan_kepsek',
        'Laporan Supervisi Kepala Sekolah',
        'Laporan supervisi komparasi kehadiran seluruh rombel sekolah tersedia khusus pada Paket Sekolah.'
      )
    ) {
      return;
    }
    setIsPrintModalOpen(true);
  };

  // Render Smart Link Document Viewer langsung menggantikan modal popup lama
  if (isPrintModalOpen) {
    const activeSelectedClass = classes.find(c => c.id === (effectiveClassId || selectedClassId));
    return (
      <PublicDailyReportViewer
        schoolId={currentUser?.schoolId || (activeWorkspace as any)?.workspaceId || null}
        classId={viewScopeMode === 'KEPSEK' ? (classes[0]?.id || '') : (effectiveClassId || selectedClassId || '')}
        className={viewScopeMode === 'KEPSEK' ? 'Semua Rombel' : (activeSelectedClass?.name || '')}
        date={selectedDate}
        attendanceType={viewScopeMode === 'KEPSEK' ? 'DAILY' : attendanceType}
        subjectId={viewScopeMode === 'KEPSEK' ? null : (attendanceType === 'SUBJECT' ? (effectiveSubjectId || selectedSubjectId || null) : null)}
        reportType={viewScopeMode === 'KEPSEK' ? kepsekPeriodData.reportTypeModal : reportType}
        selectedWeek={selectedWeek}
        month={month}
        year={year}
        semester={viewScopeMode === 'KEPSEK' ? kepsekSemester : classSemester}
        academicYear={viewScopeMode === 'KEPSEK' ? kepsekAcademicYear : (schoolProfile.tahunPelajaran || `${startYear}/${endYear}`)}
        onBackToApp={() => {
          setIsPrintModalOpen(false);
          try {
            const url = new URL(window.location.href);
            url.search = '';
            window.history.pushState(null, '', url.pathname);
          } catch (_) {}
        }}
      />
    );
  }

  return (
    <div className="w-full max-w-6xl 2xl:max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6 animate-in fade-in duration-200 pb-20">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setActiveView('dashboard')}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs min-h-[38px] cursor-pointer"
          id="btn-back-dashboard"
        >
          <ArrowLeft size={14} />
          <span>Dashboard</span>
        </button>

        {/* Admin or Kepsek Toggle */}
        {(userScope.isAdmin || userScope.isKepalaSekolah) && (
          <div className="inline-flex p-1 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold">
            <button
              onClick={() => setViewScopeMode('KEPSEK')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                viewScopeMode === 'KEPSEK'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 size={13} />
              <span>Laporan Kepala Sekolah</span>
            </button>
            <button
              onClick={() => setViewScopeMode('CLASS')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                viewScopeMode === 'CLASS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users size={13} />
              <span>Laporan Per Rombel/Kelas</span>
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* VIEW MODE 1: LAPORAN KEPALA SEKOLAH (TINGKAT SEKOLAH - SELURUH KELAS) */}
      {/* ========================================================================= */}
      {viewScopeMode === 'KEPSEK' ? (
        <div className="space-y-5 sm:space-y-6">
          {/* Main Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
                <Building2 size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-2xl font-black text-slate-900">
                    Laporan Kepala Sekolah
                  </h1>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">
                    Tingkat Sekolah
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Rekapitulasi otomatis kehadiran dari absensi seluruh Wali Kelas untuk administrasi resmi sekolah.
                </p>
              </div>
            </div>

            <button
              onClick={handleKepsekPrint}
              id="btn-cetak-laporan-kepsek"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all cursor-pointer min-h-[44px]"
            >
              <Printer size={18} />
              <span>CETAK LAPORAN</span>
            </button>
          </div>

          {/* Sub Navigation Tabs: 1. Bulanan, 2. Semester, 3. Tahunan */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
              <button
                type="button"
                onClick={() => setKepsekTab('bulanan')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
                  kepsekTab === 'bulanan'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Calendar size={15} />
                <span>1. Rekap Bulanan</span>
              </button>

              <button
                type="button"
                onClick={() => setKepsekTab('semester')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
                  kepsekTab === 'semester'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Layers size={15} />
                <span>2. Rekap Semester</span>
              </button>

              <button
                type="button"
                onClick={() => setKepsekTab('tahunan')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
                  kepsekTab === 'tahunan'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <GraduationCap size={15} />
                <span>3. Rekap Tahunan</span>
              </button>
            </div>

            {/* Filter Controls tailored to selected tab */}
            <div className="pt-1">
              {kepsekTab === 'bulanan' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                      PILIH BULAN
                    </label>
                    <select
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none cursor-pointer"
                    >
                      {months.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                      PILIH TAHUN
                    </label>
                    <select
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none cursor-pointer"
                    >
                      <option value={String(startYear)}>{startYear}</option>
                      <option value={String(endYear)}>{endYear}</option>
                      {year !== String(startYear) && year !== String(endYear) && (
                        <option value={year}>{year}</option>
                      )}
                    </select>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-1 flex items-end">
                    <div className="w-full p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 font-medium flex items-center justify-between">
                      <span>Hari Efektif:</span>
                      <strong className="text-blue-950 font-bold">{kepsekPeriodData.effectiveDays} Hari Belajar</strong>
                    </div>
                  </div>
                </div>
              )}

              {kepsekTab === 'semester' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                      PILIH SEMESTER
                    </label>
                    <select
                      value={kepsekSemester}
                      onChange={(e) => setKepsekSemester(e.target.value as 'Ganjil' | 'Genap')}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none cursor-pointer"
                    >
                      <option value="Ganjil">Semester 1 (Ganjil: Juli - Desember)</option>
                      <option value="Genap">Semester 2 (Genap: Januari - Juni)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                      TAHUN PELAJARAN
                    </label>
                    <input
                      type="text"
                      value={kepsekAcademicYear}
                      onChange={(e) => setKepsekAcademicYear(e.target.value)}
                      placeholder="2026/2027"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-1 flex items-end">
                    <div className="w-full p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 font-medium flex items-center justify-between">
                      <span>Total Efektif Semester:</span>
                      <strong className="text-blue-950 font-bold">{kepsekPeriodData.effectiveDays} Hari Belajar</strong>
                    </div>
                  </div>
                </div>
              )}

              {kepsekTab === 'tahunan' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                      TAHUN PELAJARAN
                    </label>
                    <input
                      type="text"
                      value={kepsekAcademicYear}
                      onChange={(e) => setKepsekAcademicYear(e.target.value)}
                      placeholder="2026/2027"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none"
                    />
                  </div>

                  <div className="flex items-end">
                    <div className="w-full p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-950 font-medium flex items-center justify-between">
                      <span>Akumulasi Semester:</span>
                      <strong className="font-bold">Ganjil + Genap ({kepsekPeriodData.effectiveDays} Hari)</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Executive Summary Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block">
                Total Rombel / Kelas
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                {kepsekClassRows.length} <span className="text-xs font-semibold text-slate-500">Kelas</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium mt-1 block">
                Tingkat SD (Kelas 1 - 6)
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block">
                Total Siswa Sekolah
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                {kepsekSchoolTotals.totalStudents} <span className="text-xs font-semibold text-slate-500">Siswa</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium mt-1 block">
                L: {kepsekSchoolTotals.totalMale} • P: {kepsekSchoolTotals.totalFemale}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-emerald-700 tracking-wider block">
                Rata-rata Kehadiran
              </span>
              <div className="text-xl sm:text-2xl font-black text-emerald-800 mt-1">
                {kepsekSchoolTotals.pctHadir}%
              </div>
              <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
                Predikat: {kepsekSchoolTotals.predicate}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block">
                Ketidakhadiran Sekolah
              </span>
              <div className="flex items-center gap-2 mt-1 text-sm font-bold text-slate-800">
                <span className="text-sky-800">S: {kepsekSchoolTotals.totalSakit}</span>
                <span>•</span>
                <span className="text-amber-800">I: {kepsekSchoolTotals.totalIzin}</span>
                <span>•</span>
                <span className="text-rose-800">A: {kepsekSchoolTotals.totalAlfa}</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium mt-1 block">
                Akumulasi seluruh rombel
              </span>
            </div>
          </div>

          {/* Live Data Table for All Classes */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                  Rekapitulasi Kehadiran Seluruh Rombel Kelas
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Periode: <strong className="text-slate-800 font-semibold">{kepsekPeriodData.label}</strong>
                </p>
              </div>
              <span className="text-[11px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-bold">
                {classes.length} Rombel Terdata
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-center">
                    <th className="p-3 w-10" rowSpan={2}>No</th>
                    <th className="p-3 text-left" rowSpan={2}>Rombel / Kelas</th>
                    <th className="p-3 text-left" rowSpan={2}>Wali Kelas</th>
                    <th className="p-2 border-l border-slate-200" colSpan={3}>Jumlah Siswa</th>
                    <th className="p-2 border-l border-slate-200" colSpan={4}>Rekap Presensi (Hari)</th>
                    <th className="p-2 border-l border-slate-200" colSpan={4}>Persentase (%)</th>
                    <th className="p-3 border-l border-slate-200" rowSpan={2}>Predikat</th>
                  </tr>
                  <tr className="bg-slate-50 text-slate-600 text-[10px] font-bold border-b border-slate-200 text-center">
                    <th className="p-1.5 border-l border-slate-200 w-8">L</th>
                    <th className="p-1.5 w-8">P</th>
                    <th className="p-1.5 w-10 font-black">Tot</th>
                    <th className="p-1.5 border-l border-slate-200 w-10 bg-emerald-50 text-emerald-800">H</th>
                    <th className="p-1.5 w-10 bg-sky-50 text-sky-800">S</th>
                    <th className="p-1.5 w-10 bg-amber-50 text-amber-800">I</th>
                    <th className="p-1.5 w-10 bg-rose-50 text-rose-800">A</th>
                    <th className="p-1.5 border-l border-slate-200 w-12 bg-emerald-50 text-emerald-800 font-black">%H</th>
                    <th className="p-1.5 w-11 text-sky-800">%S</th>
                    <th className="p-1.5 w-11 text-amber-800">%I</th>
                    <th className="p-1.5 w-11 text-rose-800">%A</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kepsekClassRows.map((cls, idx) => (
                    <tr key={cls.classId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-900">
                        {cls.className}
                        <span className="block text-[10px] text-slate-500 font-normal">{cls.fase}</span>
                      </td>
                      <td className="p-3 text-slate-700 font-medium">{cls.waliKelasName}</td>
                      <td className="p-2 border-l border-slate-100 text-center text-slate-600">{cls.maleCount}</td>
                      <td className="p-2 text-center text-slate-600">{cls.femaleCount}</td>
                      <td className="p-2 text-center font-bold text-slate-900 bg-slate-50/50">{cls.totalStudents}</td>
                      <td className="p-2 border-l border-slate-100 text-center font-semibold text-emerald-800 bg-emerald-50/30">{cls.hadir}</td>
                      <td className="p-2 text-center text-sky-800 bg-sky-50/30">{cls.sakit}</td>
                      <td className="p-2 text-center text-amber-800 bg-amber-50/30">{cls.izin}</td>
                      <td className="p-2 text-center text-rose-800 bg-rose-50/30">{cls.alfa}</td>
                      <td className="p-2 border-l border-slate-100 text-center font-bold text-emerald-700 bg-emerald-50/50">{cls.pctHadir}%</td>
                      <td className="p-2 text-center text-sky-700">{cls.pctSakit}%</td>
                      <td className="p-2 text-center text-amber-700">{cls.pctIzin}%</td>
                      <td className="p-2 text-center text-rose-700">{cls.pctAlfa}%</td>
                      <td className="p-2 border-l border-slate-100 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          cls.pctHadirNum >= 95 ? 'bg-emerald-100 text-emerald-800' :
                          cls.pctHadirNum >= 85 ? 'bg-blue-100 text-blue-800' :
                          cls.pctHadirNum >= 75 ? 'bg-amber-100 text-amber-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {cls.predicate}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/80 border-t-2 border-slate-300 font-bold text-slate-900 text-center">
                    <td colSpan={3} className="p-3 text-left font-black uppercase text-xs">
                      TOTAL KESELURUHAN SEKOLAH
                    </td>
                    <td className="p-2 border-l border-slate-200">{kepsekSchoolTotals.totalMale}</td>
                    <td className="p-2">{kepsekSchoolTotals.totalFemale}</td>
                    <td className="p-2 bg-slate-200 font-black">{kepsekSchoolTotals.totalStudents}</td>
                    <td className="p-2 border-l border-slate-200 text-emerald-950 bg-emerald-100 font-black">{kepsekSchoolTotals.totalHadir}</td>
                    <td className="p-2 text-sky-950 bg-sky-100">{kepsekSchoolTotals.totalSakit}</td>
                    <td className="p-2 text-amber-950 bg-amber-100">{kepsekSchoolTotals.totalIzin}</td>
                    <td className="p-2 text-rose-950 bg-rose-100">{kepsekSchoolTotals.totalAlfa}</td>
                    <td className="p-2 border-l border-slate-200 text-emerald-950 bg-emerald-200 font-black">{kepsekSchoolTotals.pctHadir}%</td>
                    <td className="p-2 text-sky-950 bg-sky-100">{kepsekSchoolTotals.pctSakit}%</td>
                    <td className="p-2 text-amber-950 bg-amber-100">{kepsekSchoolTotals.pctIzin}%</td>
                    <td className="p-2 text-rose-950 bg-rose-100">{kepsekSchoolTotals.pctAlfa}%</td>
                    <td className="p-2 border-l border-slate-200 font-black text-[10px] bg-slate-200">
                      {kepsekSchoolTotals.predicate}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Document Print Info */}
          <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs text-amber-900 leading-relaxed flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0 mt-0.5 shadow-xs">
              <FileText size={16} />
            </div>
            <div className="pt-0.5">
              <span className="font-bold">Format Cetak Laporan Kepala Sekolah:</span> Dokumen dirancang khusus memenuhi standar administrasi sekolah, lengkap dengan Kop Surat Sekolah, tabel komparasi seluruh rombel, akumulasi tingkat sekolah, kolom evaluasi manajerial, serta lembar pengesahan resmi oleh{' '}
              <strong className="underline">Kepala Sekolah</strong>.
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* VIEW MODE 2: LAPORAN PER ROMBEL / KELAS (WALI KELAS & GURU MAPEL) */
        /* ========================================================================= */
        <div className="space-y-5 sm:space-y-6">
          {/* Main Header */}
          <div className="flex items-center gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
              <FileText size={22} />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900">Laporan Kehadiran Rombel</h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Cetak laporan administratif kehadiran per kelas atau mata pelajaran.
              </p>
            </div>
          </div>

          {/* Center Configuration Card */}
          <div className="max-w-xl mx-auto bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-8 lg:p-10 space-y-5 sm:space-y-6">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Konfigurasi Laporan
            </h2>

            <form onSubmit={handlePrintSubmit} className="space-y-4 sm:space-y-5">
              {/* TIPE PRESENSI (DUAL-MODE SD: WALI KELAS VS GURU MAPEL) */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                  KATEGORI PRESENSI
                </label>
                {!userScope.isWaliKelas && !userScope.isGuruMapel ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAttendanceType('DAILY');
                        setSelectedSubjectId('');
                      }}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        attendanceType === 'DAILY'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Absensi Harian (Wali Kelas)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAttendanceType('SUBJECT');
                        if (!selectedSubjectId && specializedSubjects.length > 0) {
                          setSelectedSubjectId(specializedSubjects[0].id);
                        }
                      }}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        attendanceType === 'SUBJECT'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Absensi Mata Pelajaran
                    </button>
                  </div>
                ) : userScope.isWaliKelas ? (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-bold text-blue-950 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock size={14} className="text-blue-600" />
                      <span>Presensi Wali Kelas</span>
                    </div>
                    <span className="text-[10px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded font-black">
                      Terkunci
                    </span>
                  </div>
                ) : (
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-950 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={14} className="text-indigo-600" />
                      <span>Format Absensi Guru Mata Pelajaran</span>
                    </div>
                    <span className="text-[10px] bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded font-black">
                      Terkunci
                    </span>
                  </div>
                )}
              </div>

              {/* PILIH MATA PELAJARAN (JIKA TIPE SUBJECT) */}
              {attendanceType === 'SUBJECT' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    MATA PELAJARAN
                  </label>
                  {userScope.isGuruMapel && specializedSubjects.length === 1 ? (
                    <div className="w-full px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs sm:text-sm font-bold text-indigo-900 flex items-center gap-2">
                      <span>{specializedSubjects[0].name}</span>
                      {specializedSubjects[0].code && (
                        <span className="text-[10px] bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded">
                          {specializedSubjects[0].code}
                        </span>
                      )}
                    </div>
                  ) : (
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none cursor-pointer min-h-[44px]"
                    >
                      {specializedSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code || s.name})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* PILIH KELAS / ROMBEL */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                  {userScope.isGuruMapel ? 'PILIH ROMBEL KELAS' : 'PILIH KELAS'}
                </label>
                {userScope.isWaliKelas && selectableClasses.length <= 1 ? (
                  <div className="w-full px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-xs sm:text-sm font-bold text-blue-900 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-blue-600" />
                      <span>
                        {(userScope.assignedWaliClassName || schoolProfile.kelas || '').toLowerCase().startsWith('kelas')
                          ? (userScope.assignedWaliClassName || schoolProfile.kelas)
                          : `Kelas ${userScope.assignedWaliClassName || schoolProfile.kelas || '1'}`}
                      </span>
                    </div>
                    <span className="text-[10px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded font-black">
                      Kelas Binaan Anda
                    </span>
                  </div>
                ) : (
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none cursor-pointer min-h-[44px]"
                  >
                    {!userScope.isGuruMapel && !userScope.isWaliKelas && (
                      <option value="">Semua Kelas ({students.length} Siswa)</option>
                    )}
                    {selectableClasses.map((c) => {
                      const label = `${formatClassDisplay(c.name).toUpperCase()} (${getFaseByClassName(c.name, c.grade)})`;
                      return (
                        <option key={c.id} value={c.id}>
                          {userScope.isGuruMapel ? label : `${c.name} (${getFaseByClassName(c.name, c.grade)}) ${c.waliKelasName ? `• ${c.waliKelasName}` : ''}`}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {/* JENIS LAPORAN */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                  PERIODE LAPORAN
                </label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none cursor-pointer min-h-[44px]"
                >
                  <option value="Laporan Bulanan">Laporan Bulanan</option>
                  <option value="Laporan Mingguan">Laporan Mingguan</option>
                  <option value="Laporan Harian">Laporan Harian</option>
                  <option value="Laporan Semester">Laporan Semester</option>
                </select>
              </div>

              {/* Conditional Field: LAPORAN HARIAN -> PILIH TANGGAL */}
              {reportType === 'Laporan Harian' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    PILIH TANGGAL
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none min-h-[44px] cursor-pointer"
                  />
                </div>
              )}

              {/* Conditional Field: LAPORAN MINGGUAN -> PILIH MINGGU */}
              {reportType === 'Laporan Mingguan' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    PILIH MINGGU
                  </label>
                  <select
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none cursor-pointer min-h-[44px]"
                  >
                    {weeks.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* BULAN & TAHUN */}
              {(reportType === 'Laporan Bulanan' || reportType === 'Laporan Mingguan') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                      BULAN
                    </label>
                    <select
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none cursor-pointer min-h-[44px]"
                    >
                      {months.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                      TAHUN
                    </label>
                    <select
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none cursor-pointer min-h-[44px]"
                    >
                      <option value={String(startYear)}>{startYear} (Semester 1)</option>
                      <option value={String(endYear)}>{endYear} (Semester 2)</option>
                      {year !== String(startYear) && year !== String(endYear) && (
                        <option value={year}>{year}</option>
                      )}
                    </select>
                  </div>
                </div>
              )}

              {/* Conditional Field: LAPORAN SEMESTER */}
              {reportType === 'Laporan Semester' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                      SEMESTER
                    </label>
                    <select
                      value={classSemester}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'Ganjil') {
                          setMonth('Juli');
                          setYear(String(startYear));
                        } else {
                          setMonth('Januari');
                          setYear(String(endYear));
                        }
                      }}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none cursor-pointer min-h-[44px]"
                    >
                      <option value="Ganjil">Semester 1 (Ganjil)</option>
                      <option value="Genap">Semester 2 (Genap)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                      TAHUN PELAJARAN
                    </label>
                    <input
                      type="text"
                      value={schoolProfile.tahunPelajaran || `${startYear}/${endYear}`}
                      readOnly
                      className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 outline-none min-h-[44px] cursor-not-allowed"
                    />
                  </div>
                </div>
              )}

              {/* Ringkasan & Kesimpulan Cepat */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                  <span className="uppercase tracking-wider">Ringkasan Persentase ({reportType}):</span>
                  <span className="text-blue-700 font-extrabold">
                    {reportType === 'Laporan Harian' && formatReportDateIndo(selectedDate)}
                    {reportType === 'Laporan Mingguan' && `${selectedWeek} (${month} ${year})`}
                    {reportType === 'Laporan Bulanan' && `${month} ${year}`}
                    {reportType === 'Laporan Semester' && `Semester ${classSemester === 'Genap' ? '2 (Genap)' : '1 (Ganjil)'} (${schoolProfile.tahunPelajaran || `${startYear}/${endYear}`})`}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[9px] block font-bold text-emerald-700 uppercase">Hadir</span>
                    <span className="text-base sm:text-lg font-black text-emerald-900 leading-tight">{liveSummary.pctHadir}%</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200">
                    <span className="text-[9px] block font-bold text-sky-700 uppercase">Sakit</span>
                    <span className="text-base sm:text-lg font-black text-sky-900 leading-tight">{liveSummary.pctSakit}%</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                    <span className="text-[9px] block font-bold text-amber-700 uppercase">Izin</span>
                    <span className="text-base sm:text-lg font-black text-amber-900 leading-tight">{liveSummary.pctIzin}%</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                    <span className="text-[9px] block font-bold text-rose-700 uppercase">Alfa</span>
                    <span className="text-base sm:text-lg font-black text-rose-900 leading-tight">{liveSummary.pctAlfa}%</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Cetak PDF */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  id="btn-cetak-laporan-pdf"
                  title="Buka dokumen resmi laporan untuk dicetak atau disimpan sebagai PDF"
                  className="flex-1 py-3.5 px-6 rounded-xl bg-[#1D82F5] hover:bg-blue-600 active:scale-98 text-white font-black text-xs sm:text-sm tracking-wider uppercase transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 min-h-[48px] sm:min-h-[50px] cursor-pointer"
                >
                  <Printer size={18} />
                  <span>CETAK LAPORAN</span>
                </button>
              </div>
            </form>

            {/* Informational Banner */}
            <div className="p-4 bg-[#FEF9E7] border border-[#F9E79F] rounded-2xl text-xs text-[#7D6608] leading-relaxed flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#FDEBD0] text-[#B7950B] shrink-0 mt-0.5 shadow-xs">
                <FileText size={16} />
              </div>
              <div className="pt-0.5">
                <span className="font-bold text-[#7D6608]">Informasi Tanggal Cetak:</span> Laporan akan dicetak dengan keterangan lokasi dan tanggal{' '}
                <span className="font-bold underline text-[#4A235A]">
                  {systemConfig.reportPlace || 'Jakarta'}, {formatReportDateIndo(systemConfig.reportDate?.trim() || new Date().toISOString().slice(0, 10))}
                </span>{' '}
                {systemConfig.reportDate?.trim() ? '(sesuai pengaturan admin)' : '(mengikuti tanggal berjalan default)'}.
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
