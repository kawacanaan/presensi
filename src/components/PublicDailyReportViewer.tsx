import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Printer, Share2, CheckCircle2, ArrowLeft, FileText, Loader2, AlertCircle, Smartphone } from 'lucide-react';
import { SchoolLogo } from './SchoolLogo';
import { useApp } from '../context/AppContext';
import { getFaseByClassName } from '../utils/faseKurikulum';
import { getUserRoleScope } from '../utils/userScope';
import { normalizeClassToken } from '../utils/documentParser';
import { buildCanonicalReportUrl, CanonicalReportParams } from '../utils/smartReport';

function cleanDisplayAddress(raw: string | undefined | null): string {
  if (!raw) return '';
  const str = String(raw).trim();
  if (str.startsWith('__EXTJSON__:') || str.startsWith('{')) {
    try {
      const json = JSON.parse(str.startsWith('__EXTJSON__:') ? str.slice(12) : str);
      return json.full || json.alamat || [json.jalan, json.desaKelurahan, json.kecamatan, json.kabupatenKota, json.provinsi].filter(Boolean).join(', ') || '';
    } catch (_) {
      return '';
    }
  }
  return str;
}

const isPlaceholderText = (text: string | null | undefined): boolean => {
  if (!text) return true;
  const clean = text.trim().toLowerCase();
  return (
    clean === '' ||
    clean === '-' ||
    clean === 'guru mata pelajaran' ||
    clean === 'guru mapel' ||
    clean === 'wali kelas' ||
    clean === 'nama guru' ||
    clean === 'nama pendidik' ||
    clean === 'pendidik' ||
    clean.startsWith('wali ')
  );
};

export interface PublicDailyReportViewerProps {
  isPublicView?: boolean;
  schoolId?: string | null;
  classId?: string;
  className?: string;
  date?: string;
  attendanceType?: 'DAILY' | 'SUBJECT';
  subjectId?: string | null;
  onBackToApp?: () => void;
  reportType?: 'Laporan Harian' | 'Laporan Mingguan' | 'Laporan Bulanan' | 'Laporan Semester' | 'Laporan Kepala Sekolah (Bulanan)' | 'Laporan Kepala Sekolah (Semester)';
  selectedWeek?: string;
  month?: string;
  year?: string;
  semester?: 'Ganjil' | 'Genap';
  academicYear?: string;
}

export const PublicDailyReportViewer: React.FC<PublicDailyReportViewerProps> = ({
  isPublicView = false,
  schoolId: propSchoolId,
  classId: propClassId,
  className: propClassName,
  date: propDate,
  attendanceType = 'DAILY',
  subjectId = null,
  onBackToApp,
  reportType = 'Laporan Harian',
  selectedWeek = 'Minggu Ke-1',
  month = 'Juli',
  year = '2026',
  semester = 'Ganjil',
  academicYear: propAcademicYear,
}) => {
  const {
    currentUser,
    activeWorkspace,
    schoolProfile: ctxSchoolProfile,
    systemConfig: ctxSystemConfig,
    classes: ctxClasses,
    students: ctxStudents,
    attendanceRecords: ctxAttendanceRecords,
    teachers: ctxTeachers,
    subjects: ctxSubjects,
    openUpgradeModal,
    isTeacherPro,
    isSchoolPro,
  } = useApp();

  const userScope = useMemo(
    () => getUserRoleScope(currentUser, ctxClasses, ctxSubjects, ctxTeachers),
    [currentUser, ctxClasses, ctxSubjects, ctxTeachers]
  );

  // Mobile responsive scaling state
  const reportRef = useRef<HTMLDivElement>(null);
  const [windowWidth, setWindowWidth] = useState<number>(() => (typeof window !== 'undefined' ? window.innerWidth : 1024));
  const [docHeight, setDocHeight] = useState<number>(1100);
  const [isFitToScreen, setIsFitToScreen] = useState<boolean>(true);

  // Jika isPublicView diset true (dari tautan publik WhatsApp/browser), WAJIB mode publik mandiri tanpa bergantung pada memori sesi
  const isInternalUser = Boolean(!isPublicView && currentUser && ctxClasses && ctxClasses.length > 0);

  // External fetch state (for public visitors via smart link without active session)
  const [loading, setLoading] = useState(!isInternalUser);
  const [error, setError] = useState<string | null>(null);
  const [externalReportData, setExternalReportData] = useState<any | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const p = new URLSearchParams(window.location.search);
      const r = p.get('r') || p.get('class') || p.get('classId') || '';
      const periodCode = p.get('p') || p.get('period') || 'daily';
      const w = p.get('w') || p.get('week') || '';
      const m = p.get('mo') || p.get('month') || '';
      const y = p.get('y') || p.get('year') || '';
      const sem = p.get('sem') || p.get('semester') || '';
      const ay = p.get('ay') || p.get('academicYear') || '';
      const key = `kawacanaan_report_${r}_${periodCode}_${w}_${m}_${y}_${sem}_${ay}`;
      const cached = localStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.students?.length > 0 || parsed.schoolName)) {
          return parsed;
        }
      }
    } catch (_) {}
    return null;
  });
  const [copiedLink, setCopiedLink] = useState(false);

  // Sync loading state immediately when internal data is ready
  useEffect(() => {
    if (isInternalUser) {
      setLoading(false);
    }
  }, [isInternalUser]);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        setWindowWidth(window.innerWidth);
      }
      if (reportRef.current) {
        setDocHeight(reportRef.current.scrollHeight || reportRef.current.clientHeight || 1100);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      handleResize();
      const t = setTimeout(handleResize, 300);
      return () => {
        window.removeEventListener('resize', handleResize);
        clearTimeout(t);
      };
    }
  }, [externalReportData, loading]);

  const selectedDate = propDate || new Date().toISOString().split('T')[0];
  const isKepsekReport = reportType.startsWith('Laporan Kepala Sekolah');

  const indoMonthsList = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const defaultMonthName = indoMonthsList[new Date().getMonth()] || 'September';
  const rawMonthProp = String(month || externalReportData?.month || defaultMonthName).trim();

  const getMonthNumber = (m: string): number => {
    if (!m) return new Date().getMonth() + 1;
    if (/^\d+$/.test(m)) return Math.min(12, Math.max(1, parseInt(m, 10)));
    const clean = m.toLowerCase();
    const map: Record<string, number> = {
      januari: 1, january: 1, jan: 1,
      februari: 2, february: 2, feb: 2,
      maret: 3, march: 3, mar: 3,
      april: 4, apr: 4,
      mei: 5, may: 5,
      juni: 6, june: 6, jun: 6,
      juli: 7, july: 7, jul: 7,
      agustus: 8, august: 8, aug: 8,
      september: 9, sep: 9, sept: 9,
      oktober: 10, october: 10, okt: 10, oct: 10,
      november: 11, nov: 11,
      desember: 12, december: 12, des: 12, dec: 12,
    };
    return map[clean] || (new Date().getMonth() + 1);
  };

  const mNum = getMonthNumber(rawMonthProp);
  const effectiveYear = Number(year || externalReportData?.year) || new Date().getFullYear();
  const rawSemesterProp = String(semester || externalReportData?.semester || 'Ganjil').trim();
  const activeSemester: 'Ganjil' | 'Genap' = (rawSemesterProp.toLowerCase() === 'genap' || rawSemesterProp === '2') ? 'Genap' : 'Ganjil';
  const rawAcademicYear = String(propAcademicYear || externalReportData?.academicYear || externalReportData?.tahunPelajaran || ctxSchoolProfile?.tahunPelajaran || `${effectiveYear}/${effectiveYear + 1}`).trim();
  const academicYear = rawAcademicYear || `${effectiveYear}/${effectiveYear + 1}`;

  const yearParts = academicYear.split('/');
  const startYear = parseInt(yearParts[0] || String(effectiveYear), 10) || effectiveYear;
  const endYear = parseInt(yearParts[1] || String(startYear + 1), 10) || (startYear + 1);

  // Effective days helper
  const getEffectiveDaysForMonth = (yr: number, mIndex: number) => {
    let count = 0;
    const daysInMonth = new Date(yr, mIndex, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(yr, mIndex - 1, d).getDay();
      if (day >= 1 && day <= 5) count++;
    }
    return count > 0 ? count : 20;
  };

  const effectiveDays = getEffectiveDaysForMonth(effectiveYear, mNum);
  const monthKey = `${effectiveYear}-${String(mNum).padStart(2, '0')}`;

  // Week working days - selalu mulai dari hari Senin
  const activeWeek = String(selectedWeek || externalReportData?.week || 'Minggu Ke-1').trim();
  const weekNum = parseInt(activeWeek.replace(/\D/g, ''), 10) || 1;
  const weekWorkingDays = useMemo(() => {
    // Tentukan hari Senin pertama untuk bulan terpilih
    const firstOfMonth = new Date(effectiveYear, mNum - 1, 1);
    const dow = firstOfMonth.getDay(); // 0 = Minggu, 1 = Senin, 2 = Selasa, ..., 6 = Sabtu
    let firstMonday: Date;
    if (dow === 1) {
      firstMonday = new Date(effectiveYear, mNum - 1, 1);
    } else if (dow === 6) {
      firstMonday = new Date(effectiveYear, mNum - 1, 3);
    } else if (dow === 0) {
      firstMonday = new Date(effectiveYear, mNum - 1, 2);
    } else {
      // Selasa(2), Rabu(3), Kamis(4), Jumat(5) -> Mundur ke Senin pada minggu yang sama
      firstMonday = new Date(effectiveYear, mNum - 1, 1 - (dow - 1));
    }

    const weekMonday = new Date(firstMonday);
    weekMonday.setDate(firstMonday.getDate() + (weekNum - 1) * 7);

    const is6Days = ctxSystemConfig?.activeStudyDays?.includes(6);
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
  }, [effectiveYear, mNum, weekNum, ctxSystemConfig?.activeStudyDays]);

  // Semester months list
  const semesterMonthList = useMemo(() => {
    if (activeSemester === 'Genap') {
      return [
        { name: 'Januari', num: 1, year: endYear },
        { name: 'Februari', num: 2, year: endYear },
        { name: 'Maret', num: 3, year: endYear },
        { name: 'April', num: 4, year: endYear },
        { name: 'Mei', num: 5, year: endYear },
        { name: 'Juni', num: 6, year: endYear },
      ];
    }
    return [
      { name: 'Juli', num: 7, year: startYear },
      { name: 'Agustus', num: 8, year: startYear },
      { name: 'September', num: 9, year: startYear },
      { name: 'Oktober', num: 10, year: startYear },
      { name: 'November', num: 11, year: startYear },
      { name: 'Desember', num: 12, year: startYear },
    ];
  }, [activeSemester, startYear, endYear]);

  const semesterTotalEffectiveDays = useMemo(() => {
    return semesterMonthList.reduce((acc, m) => acc + getEffectiveDaysForMonth(m.year, m.num), 0);
  }, [semesterMonthList]);

  // Target class resolution - strictly resolves the requested or active class
  const resolvedClass = useMemo(() => {
    if (!isInternalUser) return null;
    if (propClassId) {
      const byId = ctxClasses.find((c) => c.id === propClassId);
      if (byId) return byId;
      const byNormId = ctxClasses.find((c) => normalizeClassToken(c.name) === normalizeClassToken(propClassId));
      if (byNormId) return byNormId;
      const byName = ctxClasses.find((c) => c.name.toLowerCase() === propClassId.toLowerCase());
      if (byName) return byName;
      const cleanTarget = propClassId.replace(/^kelas\s*/i, '').trim().toLowerCase();
      const byClean = ctxClasses.find((c) => c.name.replace(/^kelas\s*/i, '').trim().toLowerCase() === cleanTarget);
      if (byClean) return byClean;
      // Do not substitute an unrelated class if specific class was requested!
      return null;
    }
    if (userScope.isWaliKelas && userScope.assignedWaliClass) {
      return userScope.assignedWaliClass;
    }
    if (userScope.isGuruMapel && userScope.accessibleClasses.length > 0) {
      return userScope.accessibleClasses[0];
    }
    return ctxClasses[0] || null;
  }, [isInternalUser, propClassId, ctxClasses, userScope]);

  const resolvedSubject = useMemo(() => {
    if (!isInternalUser) return null;
    if (attendanceType === 'DAILY') return null;
    if (subjectId) {
      const byId = ctxSubjects.find((s) => s.id === subjectId);
      if (byId) return byId;
      const byName = ctxSubjects.find((s) => s.name.toLowerCase() === subjectId.toLowerCase());
      if (byName) return byName;
    }
    if (userScope.isGuruMapel) {
      if (userScope.primarySubject) return userScope.primarySubject;
      if (userScope.assignedSubjects.length > 0) return userScope.assignedSubjects[0];
    }
    return null;
  }, [isInternalUser, attendanceType, subjectId, ctxSubjects, userScope]);

  const resolvedWaliKelas = useMemo(() => {
    if (!isInternalUser || !resolvedClass) return null;
    // 1. Match by waliKelasTeacherId in teachers master
    if (resolvedClass.waliKelasTeacherId) {
      const t = ctxTeachers.find((tch) => tch.id === resolvedClass.waliKelasTeacherId);
      if (t) return t;
    }
    // 2. Match by waliKelasName
    if (resolvedClass.waliKelasName && !isPlaceholderText(resolvedClass.waliKelasName)) {
      const cleanName = resolvedClass.waliKelasName.trim().toLowerCase();
      const t = ctxTeachers.find((tch) => tch.nama.trim().toLowerCase() === cleanName);
      if (t) return t;
    }
    // 3. Fallback: if currentUser is WALI KELAS assigned to THIS specific class
    if (userScope.isWaliKelas || currentUser?.role === 'WALI KELAS') {
      const userClassIds = [
        ...(currentUser?.classIds || []),
        ...((currentUser as any)?.assignedClassIds || []),
      ];
      const isAssigned =
        userClassIds.includes(resolvedClass.id) ||
        userScope.assignedWaliClassId === resolvedClass.id ||
        normalizeClassToken(userScope.assignedWaliClassName || '') === normalizeClassToken(resolvedClass.name);
      if (isAssigned) {
        if (userScope.currentTeacher) return userScope.currentTeacher;
        if (currentUser?.teacherId) {
          const t = ctxTeachers.find((tch) => tch.id === currentUser.teacherId);
          if (t) return t;
        }
        return {
          id: currentUser?.teacherId || currentUser?.id || 'wali-kelas',
          nama: currentUser?.name || '',
          nip: currentUser?.nip || (currentUser?.username && /^\d{10,}$/.test(currentUser.username) ? currentUser.username : ''),
          jenisKelamin: (currentUser as any)?.jenisKelamin || (currentUser as any)?.gender || 'L',
        };
      }
    }
    return null;
  }, [isInternalUser, resolvedClass, ctxTeachers, currentUser, userScope]);

  const resolvedSubjectTeacher = useMemo(() => {
    // 1. By subject.teacherId
    if (resolvedSubject?.teacherId) {
      const t = ctxTeachers.find((tch) => tch.id === resolvedSubject.teacherId);
      if (t) return t;
    }
    // 2. By subject.teacherName
    if (resolvedSubject?.teacherName && !isPlaceholderText(resolvedSubject.teacherName)) {
      const cleanName = resolvedSubject.teacherName.trim().toLowerCase();
      const t = ctxTeachers.find((tch) => tch.nama.trim().toLowerCase() === cleanName);
      if (t) return t;
    }
    // 3. Fallback to currentUser / userScope if user is GURU MAPEL
    if (userScope.isGuruMapel || currentUser?.role === 'GURU MAPEL') {
      if (userScope.currentTeacher) return userScope.currentTeacher;
      if (currentUser?.teacherId) {
        const t = ctxTeachers.find((tch) => tch.id === currentUser.teacherId);
        if (t) return t;
      }
      return {
        id: currentUser?.teacherId || currentUser?.id || 'guru-mapel',
        nama: currentUser?.name || '',
        nip: currentUser?.nip || (currentUser?.username && /^\d{10,}$/.test(currentUser.username) ? currentUser.username : ''),
        jenisKelamin: (currentUser as any)?.jenisKelamin || (currentUser as any)?.gender || 'L',
      };
    }
    return null;
  }, [resolvedSubject, ctxTeachers, currentUser, userScope]);

  const resolvedPrincipalTeacher = useMemo(() => {
    const pName = ctxSchoolProfile?.namaKepalaSekolah || externalReportData?.principalName || '';
    if (pName) {
      const cleanName = pName.trim().toLowerCase();
      const t = ctxTeachers.find((tch) => tch.nama.trim().toLowerCase() === cleanName);
      if (t) return t;
    }
    if (currentUser?.role === 'KEPALA SEKOLAH') {
      if (currentUser.teacherId) {
        const t = ctxTeachers.find((tch) => tch.id === currentUser.teacherId);
        if (t) return t;
      }
      return {
        id: currentUser.teacherId || currentUser.id,
        nama: currentUser.name,
        nip: currentUser.nip || (currentUser.username && /^\d{10,}$/.test(currentUser.username) ? currentUser.username : ''),
        jenisKelamin: currentUser.jenisKelamin || currentUser.gender || 'L',
      };
    }
    return null;
  }, [ctxSchoolProfile, externalReportData, ctxTeachers, currentUser]);

  // Target students
  const targetStudents = useMemo(() => {
    if (!isInternalUser) {
      if (externalReportData?.students && Array.isArray(externalReportData.students) && externalReportData.students.length > 0) {
        return externalReportData.students.map((s: any, idx: number) => ({
          id: s.id || `ext-std-${idx}`,
          nama: s.nama || 'Siswa',
          nisn: s.nisn || '-',
          gender: s.gender === 'Perempuan' || s.gender === 'P' ? 'P' : 'L',
          classId: propClassId || '',
          className: externalReportData?.className || propClassName || '',
        }));
      }
      // Fallback jika ada data siswa di context internal (pengguna sedang login atau ada cache memori)
      if (ctxStudents && ctxStudents.length > 0) {
        const clsId = propClassId || resolvedClass?.id;
        const filtered = ctxStudents.filter(
          (s) => !clsId || s.classId === clsId || (propClassName && s.className && normalizeClassToken(s.className) === normalizeClassToken(propClassName))
        );
        if (filtered.length > 0) {
          return filtered.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
        }
        return ctxStudents.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
      }
      return [];
    }
    if (isKepsekReport) return ctxStudents;
    if (!resolvedClass) return [];
    return ctxStudents
      .filter((s) => {
        if (s.classId && s.classId === resolvedClass.id) return true;
        if (s.className && normalizeClassToken(s.className) === normalizeClassToken(resolvedClass.name)) return true;
        return false;
      })
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  }, [isInternalUser, externalReportData, isKepsekReport, resolvedClass, ctxStudents, propClassId, propClassName]);

  // Target records
  const targetRecords = useMemo(() => {
    if (!isInternalUser) {
      if (externalReportData?.records && Array.isArray(externalReportData.records) && externalReportData.records.length > 0) {
        return externalReportData.records;
      }
      if (externalReportData?.students && Array.isArray(externalReportData.students)) {
        return externalReportData.students.map((s: any, idx: number) => ({
          id: `ext-rec-${idx}`,
          studentId: s.id || `ext-std-${idx}`,
          studentName: s.nama,
          date: selectedDate,
          status: s.status || 'Hadir',
          checkInTime: s.checkInTime || '',
          checkOutTime: s.checkOutTime || '',
          notes: s.notes || '',
          type: attendanceType,
          subjectId: subjectId || null,
        }));
      }
      if (ctxAttendanceRecords && ctxAttendanceRecords.length > 0) {
        const studentIds = new Set(targetStudents.map((s) => s.id));
        return ctxAttendanceRecords.filter((r) => studentIds.has(r.studentId));
      }
      return [];
    }
    const studentIds = new Set(targetStudents.map((s) => s.id));
    return ctxAttendanceRecords.filter((r) => {
      const matchesStudent = studentIds.has(r.studentId);
      if (!matchesStudent) return false;
      if (attendanceType === 'SUBJECT') {
        return r.type === 'SUBJECT' && (!subjectId || r.subjectId === subjectId);
      }
      return r.type === 'DAILY' || !r.type;
    });
  }, [isInternalUser, externalReportData, selectedDate, attendanceType, subjectId, targetStudents, ctxAttendanceRecords]);

  const formatPct = (val: number) => (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1));

  // --- 1. DATA COMPUTATION FOR LAPORAN HARIAN ---
  const dailyStudentRows = useMemo(() => {
    return targetStudents.map((s) => {
      const record = targetRecords.find((r) => r.studentId === s.id && String(r.date || '') === selectedDate);
      const status = record?.status || 'Belum Diabsen';
      const timeIn = record?.checkInTime || '-';
      const timeOut = record?.checkOutTime || '-';
      const note = record?.notes || '-';
      return {
        ...s,
        status,
        timeIn,
        timeOut,
        note,
      };
    });
  }, [targetStudents, targetRecords, selectedDate]);

  const dailyHadir = dailyStudentRows.filter((s) => s.status === 'Hadir').length;
  const dailySakit = dailyStudentRows.filter((s) => s.status === 'Sakit').length;
  const dailyIzin = dailyStudentRows.filter((s) => s.status === 'Izin').length;
  const dailyAlfa = dailyStudentRows.filter((s) => s.status === 'Alfa').length;
  const dailyTotalKnown = dailyHadir + dailySakit + dailyIzin + dailyAlfa;
  const dailyDenom = dailyTotalKnown > 0 ? dailyTotalKnown : targetStudents.length || 1;

  const dailyPctHadir = (dailyHadir / dailyDenom) * 100;
  const dailyPctSakit = (dailySakit / dailyDenom) * 100;
  const dailyPctIzin = (dailyIzin / dailyDenom) * 100;
  const dailyPctAlfa = (dailyAlfa / dailyDenom) * 100;

  // --- 2. DATA COMPUTATION FOR LAPORAN MINGGUAN ---
  const weeklyStudentRows = useMemo(() => {
    const weekDateStrings = weekWorkingDays.map((d) => d.dateStr);
    return targetStudents.map((s) => {
      const recordsForWeek = targetRecords.filter(
        (r) => r.studentId === s.id && weekDateStrings.includes(String(r.date || ''))
      );

      const dayStatusMap: { [dateStr: string]: string } = {};
      weekWorkingDays.forEach((wDay) => {
        const found = recordsForWeek.find((r) => r.date === wDay.dateStr);
        dayStatusMap[wDay.dateStr] = found ? (found.status === 'Hadir' || found.status === 'Terlambat' ? 'H' : found.status === 'Sakit' ? 'S' : found.status === 'Izin' ? 'I' : found.status === 'Alfa' ? 'A' : '-') : '-';
      });

      const hadir = recordsForWeek.filter((r) => r.status === 'Hadir' || r.status === 'Terlambat').length;
      const sakit = recordsForWeek.filter((r) => r.status === 'Sakit').length;
      const izin = recordsForWeek.filter((r) => r.status === 'Izin').length;
      const alfa = recordsForWeek.filter((r) => r.status === 'Alfa').length;
      const totalDaysInWeek = weekWorkingDays.length || 1;
      const pct = (hadir / totalDaysInWeek) * 100;

      return {
        ...s,
        dayStatusMap,
        hadir,
        sakit,
        izin,
        alfa,
        pct: formatPct(pct),
      };
    });
  }, [targetStudents, targetRecords, weekWorkingDays]);

  const weeklyTotalHadir = weeklyStudentRows.reduce((a, b) => a + b.hadir, 0);
  const weeklyTotalSakit = weeklyStudentRows.reduce((a, b) => a + b.sakit, 0);
  const weeklyTotalIzin = weeklyStudentRows.reduce((a, b) => a + b.izin, 0);
  const weeklyTotalAlfa = weeklyStudentRows.reduce((a, b) => a + b.alfa, 0);
  const weeklyTotalRecorded = weeklyTotalHadir + weeklyTotalSakit + weeklyTotalIzin + weeklyTotalAlfa;
  const weeklyDenom = (targetStudents.length * (weekWorkingDays.length || 1)) || weeklyTotalRecorded || 1;

  const weeklyPctHadir = (weeklyTotalHadir / weeklyDenom) * 100;
  const weeklyPctSakit = (weeklyTotalSakit / weeklyDenom) * 100;
  const weeklyPctIzin = (weeklyTotalIzin / weeklyDenom) * 100;
  const weeklyPctAlfa = (weeklyTotalAlfa / weeklyDenom) * 100;

  // --- 3. DATA COMPUTATION FOR LAPORAN BULANAN ---
  const monthlyStudentRows = useMemo(() => {
    return targetStudents.map((s) => {
      const recordsForMonth = targetRecords.filter(
        (r) => r.studentId === s.id && String(r.date || '').startsWith(monthKey)
      );

      const hadir = recordsForMonth.filter((r) => r.status === 'Hadir' || r.status === 'Terlambat').length;
      const sakit = recordsForMonth.filter((r) => r.status === 'Sakit').length;
      const izin = recordsForMonth.filter((r) => r.status === 'Izin').length;
      const alfa = recordsForMonth.filter((r) => r.status === 'Alfa').length;
      const totalRecorded = hadir + sakit + izin + alfa;
      const denom = effectiveDays > 0 ? effectiveDays : (totalRecorded > 0 ? totalRecorded : 1);
      const pct = (hadir / denom) * 100;

      return {
        ...s,
        hadir,
        sakit,
        izin,
        alfa,
        pct: formatPct(pct),
      };
    });
  }, [targetStudents, targetRecords, monthKey, effectiveDays]);

  const monthlyTotalHadir = monthlyStudentRows.reduce((a, b) => a + b.hadir, 0);
  const monthlyTotalSakit = monthlyStudentRows.reduce((a, b) => a + b.sakit, 0);
  const monthlyTotalIzin = monthlyStudentRows.reduce((a, b) => a + b.izin, 0);
  const monthlyTotalAlfa = monthlyStudentRows.reduce((a, b) => a + b.alfa, 0);
  const monthlyTotalRecorded = monthlyTotalHadir + monthlyTotalSakit + monthlyTotalIzin + monthlyTotalAlfa;
  const monthlyDenom = (targetStudents.length * effectiveDays) || monthlyTotalRecorded || 1;

  const monthlyPctHadir = (monthlyTotalHadir / monthlyDenom) * 100;
  const monthlyPctSakit = (monthlyTotalSakit / monthlyDenom) * 100;
  const monthlyPctIzin = (monthlyTotalIzin / monthlyDenom) * 100;
  const monthlyPctAlfa = (monthlyTotalAlfa / monthlyDenom) * 100;

  // --- 4. DATA COMPUTATION FOR LAPORAN SEMESTER ---
  const semesterStudentRows = useMemo(() => {
    const monthPrefixes = semesterMonthList.map((m) => `${m.year}-${String(m.num).padStart(2, '0')}`);
    return targetStudents.map((s) => {
      const recordsForSemester = targetRecords.filter((r) =>
        r.studentId === s.id && monthPrefixes.some((p) => String(r.date || '').startsWith(p))
      );

      const hadir = recordsForSemester.filter((r) => r.status === 'Hadir' || r.status === 'Terlambat').length;
      const sakit = recordsForSemester.filter((r) => r.status === 'Sakit').length;
      const izin = recordsForSemester.filter((r) => r.status === 'Izin').length;
      const alfa = recordsForSemester.filter((r) => r.status === 'Alfa').length;
      const totalRecorded = hadir + sakit + izin + alfa;
      const denom = semesterTotalEffectiveDays > 0 ? semesterTotalEffectiveDays : (totalRecorded > 0 ? totalRecorded : 1);

      const pctHadir = (hadir / denom) * 100;
      const pctSakit = (sakit / denom) * 100;
      const pctIzin = (izin / denom) * 100;
      const pctAlfa = (alfa / denom) * 100;

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
        pctHadir: formatPct(pctHadir),
        pctSakit: formatPct(pctSakit),
        pctIzin: formatPct(pctIzin),
        pctAlfa: formatPct(pctAlfa),
        predicate,
      };
    });
  }, [targetStudents, targetRecords, semesterMonthList, semesterTotalEffectiveDays]);

  const semesterTotalHadir = semesterStudentRows.reduce((a, b) => a + b.hadir, 0);
  const semesterTotalSakit = semesterStudentRows.reduce((a, b) => a + b.sakit, 0);
  const semesterTotalIzin = semesterStudentRows.reduce((a, b) => a + b.izin, 0);
  const semesterTotalAlfa = semesterStudentRows.reduce((a, b) => a + b.alfa, 0);
  const semesterTotalRecorded = semesterTotalHadir + semesterTotalSakit + semesterTotalIzin + semesterTotalAlfa;
  const semesterDenom = (targetStudents.length * semesterTotalEffectiveDays) || semesterTotalRecorded || 1;

  const semesterPctHadir = (semesterTotalHadir / semesterDenom) * 100;
  const semesterPctSakit = (semesterTotalSakit / semesterDenom) * 100;
  const semesterPctIzin = (semesterTotalIzin / semesterDenom) * 100;
  const semesterPctAlfa = (semesterTotalAlfa / semesterDenom) * 100;

  // --- 5. DATA COMPUTATION FOR LAPORAN SUPERVISI KEPALA SEKOLAH ---
  const isKepsekSemester = reportType === 'Laporan Kepala Sekolah (Semester)';
  const kepsekEffectiveDays = isKepsekSemester ? semesterTotalEffectiveDays : effectiveDays;

  const kepsekClassRows = useMemo(() => {
    if (!isInternalUser) {
      if (externalReportData?.classes && Array.isArray(externalReportData.classes)) {
        return externalReportData.classes;
      }
      return [];
    }
    return ctxClasses.map((cls) => {
      const clsStudents = ctxStudents.filter(
        (s) => s.classId === cls.id || s.className === cls.name
      );
      const maleCount = clsStudents.filter((s) => s.gender === 'Laki-laki' || s.gender === 'L').length;
      const femaleCount = clsStudents.filter((s) => s.gender === 'Perempuan' || s.gender === 'P').length;
      const totalClsStudents = clsStudents.length;

      const clsStudentIds = new Set(clsStudents.map((s) => s.id));
      let clsRecords: any[] = [];

      if (isKepsekSemester) {
        const monthPrefixes = semesterMonthList.map((m) => `${m.year}-${String(m.num).padStart(2, '0')}`);
        clsRecords = ctxAttendanceRecords.filter(
          (r) =>
            clsStudentIds.has(r.studentId) &&
            (r.type === 'DAILY' || !r.type) &&
            monthPrefixes.some((p) => String(r.date || '').startsWith(p))
        );
      } else {
        clsRecords = ctxAttendanceRecords.filter(
          (r) =>
            clsStudentIds.has(r.studentId) &&
            (r.type === 'DAILY' || !r.type) &&
            String(r.date || '').startsWith(monthKey)
        );
      }

      const hadir = clsRecords.filter((r) => r.status === 'Hadir').length;
      const sakit = clsRecords.filter((r) => r.status === 'Sakit').length;
      const izin = clsRecords.filter((r) => r.status === 'Izin').length;
      const alfa = clsRecords.filter((r) => r.status === 'Alfa').length;
      const totalRecorded = hadir + sakit + izin + alfa;

      const denom = (totalClsStudents * kepsekEffectiveDays) || totalRecorded || 1;
      const pctHadir = (hadir / denom) * 100;

      let predicate = 'Sangat Baik';
      if (pctHadir < 75) predicate = 'Perlu Pembinaan';
      else if (pctHadir < 85) predicate = 'Cukup';
      else if (pctHadir < 95) predicate = 'Baik';

      let waliName = '-';
      if (cls.waliKelasTeacherId) {
        const tch = ctxTeachers.find((t) => t.id === cls.waliKelasTeacherId);
        if (tch) waliName = tch.nama;
      }
      if (waliName === '-' && cls.waliKelasName) {
        waliName = cls.waliKelasName;
      }

      return {
        classId: cls.id,
        className: String(cls.name || '').replace(/^kelas\s*/i, ''),
        grade: cls.grade,
        fase: getFaseByClassName(cls.name, cls.grade),
        waliKelasName: waliName,
        maleCount,
        femaleCount,
        totalStudents: totalClsStudents,
        hadir,
        sakit,
        izin,
        alfa,
        totalRecorded,
        pctHadir: formatPct(pctHadir),
        predicate,
      };
    });
  }, [isInternalUser, externalReportData, ctxClasses, ctxStudents, ctxAttendanceRecords, ctxTeachers, isKepsekSemester, semesterMonthList, monthKey, kepsekEffectiveDays]);

  const kepsekSchoolTotalMale = kepsekClassRows.reduce((a, c) => a + c.maleCount, 0);
  const kepsekSchoolTotalFemale = kepsekClassRows.reduce((a, c) => a + c.femaleCount, 0);
  const kepsekSchoolTotalStudents = kepsekClassRows.reduce((a, c) => a + c.totalStudents, 0);
  const kepsekSchoolTotalHadir = kepsekClassRows.reduce((a, c) => a + c.hadir, 0);
  const kepsekSchoolTotalSakit = kepsekClassRows.reduce((a, c) => a + c.sakit, 0);
  const kepsekSchoolTotalIzin = kepsekClassRows.reduce((a, c) => a + c.izin, 0);
  const kepsekSchoolTotalAlfa = kepsekClassRows.reduce((a, c) => a + c.alfa, 0);
  const kepsekSchoolTotalRecorded = kepsekSchoolTotalHadir + kepsekSchoolTotalSakit + kepsekSchoolTotalIzin + kepsekSchoolTotalAlfa;
  const kepsekSchoolDenom = (kepsekSchoolTotalStudents * kepsekEffectiveDays) || kepsekSchoolTotalRecorded || 1;

  const kepsekSchoolPctHadir = (kepsekSchoolTotalHadir / kepsekSchoolDenom) * 100;
  const kepsekSchoolPctSakit = (kepsekSchoolTotalSakit / kepsekSchoolDenom) * 100;
  const kepsekSchoolPctIzin = (kepsekSchoolTotalIzin / kepsekSchoolDenom) * 100;
  const kepsekSchoolPctAlfa = (kepsekSchoolTotalAlfa / kepsekSchoolDenom) * 100;

  let kepsekSchoolPredicate = 'Sangat Baik';
  if (kepsekSchoolPctHadir < 75) kepsekSchoolPredicate = 'Perlu Pembinaan';
  else if (kepsekSchoolPctHadir < 85) kepsekSchoolPredicate = 'Cukup';
  else if (kepsekSchoolPctHadir < 95) kepsekSchoolPredicate = 'Baik';

  // State untuk retry / muat ulang
  const [retryCount, setRetryCount] = useState(0);

  // Fallback fetching for external visitor via URL
  useEffect(() => {
    if (isInternalUser) {
      setLoading(false);
      return;
    }
    let isMounted = true;
    const abortController = new AbortController();

    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const resolvedClassName = propClassName || urlParams?.get('cn') || urlParams?.get('className') || '';
        const targetSchoolId = propSchoolId || urlParams?.get('sid') || urlParams?.get('schoolId') || ctxSchoolProfile?.schoolId || currentUser?.schoolId || null;

        const res = await fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortController.signal,
          body: JSON.stringify({
            action: 'get_public_daily_report',
            schoolId: targetSchoolId,
            classId: propClassId,
            className: resolvedClassName,
            date: selectedDate,
            attendanceType,
            subjectId,
            period: reportType,
            week: activeWeek,
            month: rawMonthProp,
            year: String(effectiveYear),
            semester: activeSemester,
            academicYear,
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (isMounted) {
          if (res.ok && json.ok && json.report) {
            setExternalReportData(json.report);
            setError(null);
            try {
              const periodTag = reportType === 'Laporan Bulanan'
                ? `monthly_${monthKey}`
                : reportType === 'Laporan Mingguan'
                ? `weekly_${monthKey}_w${weekNum}`
                : reportType === 'Laporan Semester'
                ? `semester_${activeSemester}_${startYear}_${endYear}`
                : selectedDate;
              const rKey = `kawacanaan_report_${propClassId || ''}_${periodTag}`;
              localStorage.setItem(rKey, JSON.stringify(json.report));
            } catch (_) {}
          } else {
            // Cek apakah ada cache lokal sebelum menampilkan error
            let foundInCache = false;
            try {
              const periodTag = reportType === 'Laporan Bulanan'
                ? `monthly_${monthKey}`
                : reportType === 'Laporan Mingguan'
                ? `weekly_${monthKey}_w${weekNum}`
                : reportType === 'Laporan Semester'
                ? `semester_${activeSemester}_${startYear}_${endYear}`
                : selectedDate;
              const rKey = `kawacanaan_report_${propClassId || ''}_${periodTag}`;
              const cached = localStorage.getItem(rKey);
              if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed && (parsed.students?.length > 0 || parsed.schoolName)) {
                  setExternalReportData(parsed);
                  setError(null);
                  foundInCache = true;
                }
              }
            } catch (_) {}

            if (!foundInCache) {
              setError(json.error || 'Data rekap kehadiran untuk rombel dan periode ini belum tersedia di sistem.');
              setExternalReportData(null);
            }
          }
        }
      } catch (err: any) {
        if (isMounted && err?.name !== 'AbortError') {
          let foundInCache = false;
          try {
            const rKey = `kawacanaan_report_${propClassId || ''}_${selectedDate}`;
            const cached = localStorage.getItem(rKey) || localStorage.getItem('kawacanaan_last_report');
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed && (parsed.students?.length > 0 || parsed.schoolName)) {
                setExternalReportData(parsed);
                setError(null);
                foundInCache = true;
              }
            }
          } catch (_) {}

          if (!foundInCache) {
            setError('Gagal memuat dokumen rekap kehadiran. Silakan periksa jaringan internet Anda atau muat ulang halaman.');
            setExternalReportData(null);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchReport();
    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [isInternalUser, propClassId, propClassName, selectedDate, attendanceType, subjectId, reportType, selectedWeek, month, year, semester, academicYear, retryCount]);

  // Active School and Teacher Profile Data (Didefinisikan di awal sebelum early return agar konsisten)
  const schoolName = !isInternalUser
    ? (externalReportData?.schoolName || 'SATUAN PENDIDIKAN')
    : (ctxSchoolProfile?.namaSekolah || externalReportData?.schoolName || 'SATUAN PENDIDIKAN');

  const pemerintahDaerah = !isInternalUser
    ? (externalReportData?.pemerintahDaerah || '')
    : (ctxSystemConfig?.pemerintahDaerah || externalReportData?.pemerintahDaerah || '');

  const dinasPendidikan = !isInternalUser
    ? (externalReportData?.dinasPendidikan || 'DINAS PENDIDIKAN')
    : (ctxSystemConfig?.dinasPendidikan || externalReportData?.dinasPendidikan || 'DINAS PENDIDIKAN');

  const npsn = !isInternalUser
    ? (externalReportData?.npsn || '-')
    : (ctxSchoolProfile?.npsn || externalReportData?.npsn || '-');

  const alamatSekolah = cleanDisplayAddress(!isInternalUser
    ? (externalReportData?.alamat || '')
    : (ctxSchoolProfile?.alamat || externalReportData?.alamat || ''));

  const showLetterhead = !isInternalUser
    ? (externalReportData?.showLetterhead ?? true)
    : (ctxSystemConfig?.showLetterhead ?? externalReportData?.showLetterhead ?? true);

  const letterheadType = !isInternalUser
    ? (externalReportData?.letterheadType || 'standard_text')
    : (ctxSystemConfig?.letterheadType || externalReportData?.letterheadType || 'standard_text');

  const letterheadImageUrl = !isInternalUser
    ? (externalReportData?.letterheadImageUrl || '')
    : (ctxSystemConfig?.letterheadImageUrl || externalReportData?.letterheadImageUrl || '');

  const schoolLogoUrl = !isInternalUser
    ? (externalReportData?.logoUrl || '')
    : (ctxSystemConfig?.schoolLogoUrl || externalReportData?.logoUrl || '');

  const rawClassName = !isInternalUser
    ? (externalReportData?.className || propClassName || 'Kelas')
    : (resolvedClass?.name || externalReportData?.className || propClassName || 'Kelas');
  const activeClassName = String(rawClassName || 'Kelas');
  const activeClassClean = activeClassName.replace(/^kelas\s*/i, '') || activeClassName;
  const activeFase = resolvedClass ? getFaseByClassName(resolvedClass.name, resolvedClass.grade) : (externalReportData?.fase || 'Fase A');

  const principalName = !isInternalUser
    ? (externalReportData?.principalName || 'Kepala Sekolah')
    : (ctxSchoolProfile?.namaKepalaSekolah || resolvedPrincipalTeacher?.nama || externalReportData?.principalName || 'Kepala Sekolah');

  const principalNip = !isInternalUser
    ? (externalReportData?.principalNip || '-')
    : ((ctxSchoolProfile?.nipKepalaSekolah && ctxSchoolProfile.nipKepalaSekolah !== '-')
        ? ctxSchoolProfile.nipKepalaSekolah
        : (resolvedPrincipalTeacher?.nip || (currentUser?.role === 'KEPALA SEKOLAH' ? (currentUser.nip || (currentUser.username && /^\d{10,}$/.test(currentUser.username) ? currentUser.username : '')) : '') || externalReportData?.principalNip || '-'));

  // Penentuan Nama, NIP, dan Jabatan Penandatangan sesuai Role Pengguna & Konteks Dokumen
  const resolvedTeacherInfo = useMemo(() => {
    // Jalur Cepat & Bersih untuk Pengunjung Publik (Orang Tua / Tamu via WhatsApp)
    if (!isInternalUser) {
      const extName = externalReportData?.teacherName;
      const cleanExtName = (extName && !isPlaceholderText(extName)) ? extName : '( ......................................... )';
      const extNip = externalReportData?.teacherNip && externalReportData.teacherNip !== '-' ? externalReportData.teacherNip : '-';
      const extTitle = externalReportData?.teacherTitle || (attendanceType === 'SUBJECT' ? `Guru Mata Pelajaran ${externalReportData?.subjectName || ''}`.trim() : 'Wali Kelas');
      return {
        name: cleanExtName,
        nip: extNip,
        title: extTitle,
      };
    }

    const isCurrentUserWaliKelas = Boolean(
      userScope.isWaliKelas ||
      currentUser?.role === 'WALI KELAS' ||
      userScope.assignedWaliClassId ||
      userScope.assignedWaliClassName
    );

    // KASUS 1: USER YANG MENCETAK ADALAH WALI KELAS
    if (isCurrentUserWaliKelas) {
      let name = '';
      let nip = '-';

      const rawUserName = userScope.currentTeacher?.nama || currentUser?.name || '';
      if (!isPlaceholderText(rawUserName)) {
        name = rawUserName;
        nip = userScope.currentTeacher?.nip || currentUser?.nip || (currentUser?.username && /^\d{10,}$/.test(currentUser.username) ? currentUser.username : '') || '-';
      }

      if (!name && resolvedWaliKelas?.nama && !isPlaceholderText(resolvedWaliKelas.nama)) {
        name = resolvedWaliKelas.nama;
        if (resolvedWaliKelas.nip && nip === '-') nip = resolvedWaliKelas.nip;
      }
      if (!name && resolvedClass?.waliKelasTeacherId) {
        const matched = ctxTeachers.find((t) => t.id === resolvedClass.waliKelasTeacherId);
        if (matched?.nama) {
          name = matched.nama;
          if (matched.nip && nip === '-') nip = matched.nip;
        }
      }
      if (!name && resolvedClass?.waliKelasName && !isPlaceholderText(resolvedClass.waliKelasName)) {
        name = resolvedClass.waliKelasName;
        const matched = ctxTeachers.find((t) => t.nama.trim().toLowerCase() === resolvedClass.waliKelasName!.trim().toLowerCase());
        if (matched?.nip) nip = matched.nip;
      }
      if (!name && ctxSchoolProfile?.namaWaliKelas && !isPlaceholderText(ctxSchoolProfile.namaWaliKelas)) {
        name = ctxSchoolProfile.namaWaliKelas;
        if (ctxSchoolProfile?.nipWaliKelas && nip === '-') nip = ctxSchoolProfile.nipWaliKelas;
      }

      return {
        name: isPlaceholderText(name) ? '' : name,
        nip,
        title: 'Wali Kelas',
      };
    }

    // KASUS 2: USER YANG LOGIN ADALAH GURU MATA PELAJARAN (Role Guru Mapel)
    if (userScope.isGuruMapel || currentUser?.role === 'GURU MAPEL') {
      const rawName = userScope.currentTeacher?.nama || currentUser?.name || '';
      const name = isPlaceholderText(rawName) ? '' : rawName;
      const nip = userScope.currentTeacher?.nip || currentUser?.nip || (currentUser?.username && /^\d{10,}$/.test(currentUser.username) ? currentUser.username : '') || '-';
      const subjName = resolvedSubject?.name || currentUser?.subjectName || userScope.primarySubject?.name || '';
      return {
        name,
        nip,
        title: subjName ? `Guru Mata Pelajaran ${subjName}` : 'Guru Mata Pelajaran',
      };
    }

    // KASUS 3: DOKUMEN ADALAH PRESENSI MATA PELAJARAN (dilihat oleh Admin/Kepsek/Tamu)
    if (attendanceType === 'SUBJECT' || resolvedSubject) {
      let name = '';
      let nip = '-';

      if (resolvedSubjectTeacher?.nama && !isPlaceholderText(resolvedSubjectTeacher.nama)) {
        name = resolvedSubjectTeacher.nama;
        nip = resolvedSubjectTeacher.nip || '-';
      } else if (resolvedSubject?.teacherName && !isPlaceholderText(resolvedSubject.teacherName)) {
        name = resolvedSubject.teacherName;
        const matched = ctxTeachers.find((t) => t.nama.trim().toLowerCase() === resolvedSubject.teacherName!.trim().toLowerCase());
        if (matched?.nip) nip = matched.nip;
      } else if (resolvedSubject?.teacherId) {
        const matched = ctxTeachers.find((t) => t.id === resolvedSubject.teacherId);
        if (matched) {
          name = matched.nama;
          nip = matched.nip || '-';
        }
      } else if (externalReportData?.teacherName && !isPlaceholderText(externalReportData.teacherName)) {
        name = externalReportData.teacherName;
        nip = externalReportData.teacherNip || '-';
      }

      const subjName = resolvedSubject?.name || externalReportData?.subjectName || '';
      return {
        name: isPlaceholderText(name) ? '' : name,
        nip,
        title: subjName ? `Guru Mata Pelajaran ${subjName}` : 'Guru Mata Pelajaran',
      };
    }

    // KASUS 4: DOKUMEN ADALAH PRESENSI HARIAN / WALI KELAS (dilihat oleh Admin/Kepsek/Tamu)
    let name = '';
    let nip = '-';

    if (resolvedClass?.waliKelasTeacherId) {
      const matched = ctxTeachers.find((t) => t.id === resolvedClass.waliKelasTeacherId);
      if (matched?.nama) {
        name = matched.nama;
        nip = matched.nip || '-';
      }
    }
    if (!name && resolvedClass?.waliKelasName && !isPlaceholderText(resolvedClass.waliKelasName)) {
      name = resolvedClass.waliKelasName;
      const matched = ctxTeachers.find((t) => t.nama.trim().toLowerCase() === resolvedClass.waliKelasName!.trim().toLowerCase());
      if (matched?.nip) nip = matched.nip;
    }

    if (!name && externalReportData?.teacherName && !isPlaceholderText(externalReportData.teacherName)) {
      name = externalReportData.teacherName;
      nip = externalReportData.teacherNip || '-';
    }

    if (!name && ctxSchoolProfile?.namaWaliKelas && !isPlaceholderText(ctxSchoolProfile.namaWaliKelas)) {
      name = ctxSchoolProfile.namaWaliKelas;
      if (ctxSchoolProfile.nipWaliKelas) nip = ctxSchoolProfile.nipWaliKelas;
    }

    return {
      name: isPlaceholderText(name) ? '' : name,
      nip,
      title: 'Wali Kelas',
    };
  }, [
    userScope,
    currentUser,
    resolvedClass,
    resolvedWaliKelas,
    resolvedSubject,
    resolvedSubjectTeacher,
    activeClassName,
    attendanceType,
    ctxTeachers,
    ctxSchoolProfile,
    externalReportData,
    isInternalUser,
  ]);

  const teacherName = resolvedTeacherInfo.name || '( ......................................... )';
  const teacherNip = resolvedTeacherInfo.nip && resolvedTeacherInfo.nip !== '-' ? resolvedTeacherInfo.nip : '-';
  const teacherSignatureTitle = isKepsekReport
    ? 'Koordinator Kurikulum / Tim Presensi'
    : resolvedTeacherInfo.title;
  const reportPlace = ctxSystemConfig?.reportPlace || externalReportData?.reportPlace || 'Jakarta';
  const reportDateOfficial = (ctxSystemConfig?.reportDate && ctxSystemConfig.reportDate.trim())
    ? ctxSystemConfig.reportDate.trim()
    : (externalReportData?.reportDateOfficial || new Date().toISOString().slice(0, 10));

  const formatReportDateIndo = (dateStr: string): string => {
    if (!dateStr || typeof dateStr !== 'string') return '-';
    try {
      const parts = dateStr.trim().split('-');
      if (parts.length === 3) {
        const months = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
        ];
        const day = parseInt(parts[2], 10);
        const monthIdx = parseInt(parts[1], 10) - 1;
        const yr = parts[0];
        return `${day} ${months[monthIdx] || ''} ${yr}`.trim();
      }
      return String(dateStr);
    } catch (_) {
      return String(dateStr || '-');
    }
  };

  const getDayNameIndo = (dateStr: string): string => {
    if (!dateStr || typeof dateStr !== 'string') return 'Senin';
    try {
      const parts = dateStr.trim().split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        return days[d.getDay()] || 'Senin';
      }
      return 'Senin';
    } catch (_) {
      return 'Senin';
    }
  };

  // Metadata Display Helpers for Hasil Cetak Presensi
  const semesterDisplay = useMemo(() => {
    const semVal = semester || ctxSchoolProfile?.semester || externalReportData?.semester || 'Ganjil';
    const clean = String(semVal).trim();
    if (clean.toLowerCase().startsWith('semester')) return clean;
    return `Semester ${clean}`;
  }, [semester, ctxSchoolProfile?.semester, externalReportData?.semester]);

  const classNameDisplay = useMemo(() => {
    if (isKepsekReport) {
      const rombelCount = ctxClasses?.length || externalReportData?.classesCount || 0;
      return `Semua Rombel (${rombelCount > 0 ? `${rombelCount} Kelas` : 'Paralel 1-6'})`;
    }
    return `${activeClassName}${activeFase ? ` (${activeFase})` : ''}`;
  }, [isKepsekReport, ctxClasses?.length, externalReportData?.classesCount, activeClassName, activeFase]);

  const displayEffectiveDays = useMemo(() => {
    if (reportType === 'Laporan Semester' || isKepsekSemester) {
      return `${semesterTotalEffectiveDays} Hari`;
    }
    if (reportType === 'Laporan Mingguan') {
      return `${weekWorkingDays.length} Hari`;
    }
    return `${effectiveDays} Hari`;
  }, [reportType, isKepsekSemester, semesterTotalEffectiveDays, weekWorkingDays.length, effectiveDays]);

  const displayPeriodText = useMemo(() => {
    if (reportType === 'Laporan Harian') {
      return formatReportDateIndo(selectedDate);
    }
    if (reportType === 'Laporan Mingguan') {
      return `${activeWeek} (${rawMonthProp} ${effectiveYear})`;
    }
    if (reportType === 'Laporan Bulanan') {
      return `${rawMonthProp} ${effectiveYear}`;
    }
    if (isKepsekReport) {
      return isKepsekSemester ? `Semester ${semester} (${academicYear})` : `${rawMonthProp} ${effectiveYear}`;
    }
    return `${rawMonthProp} ${effectiveYear}`;
  }, [reportType, isKepsekReport, isKepsekSemester, selectedDate, activeWeek, rawMonthProp, effectiveYear, semester, academicYear]);

  // Update document.title so when user prints or saves as PDF, the PDF filename matches the active class
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const originalTitle = document.title;
    const cleanCls = isKepsekReport ? 'Supervisi_Kepala_Sekolah' : (activeClassClean || 'Kelas');
    const cleanPeriod = (displayPeriodText || 'Laporan').replace(/[^a-zA-Z0-9_-]/g, '_');
    document.title = `Laporan_Presensi_${cleanCls}_${cleanPeriod}`;
    return () => {
      document.title = originalTitle;
    };
  }, [activeClassClean, isKepsekReport, displayPeriodText]);

  const handlePrint = () => {
    if (!isPublicView && isInternalUser) {
      const isPersonal =
        activeWorkspace?.workspaceType === 'personal' ||
        activeWorkspace?.workspaceType === 'individu' ||
        currentUser?.subscriptionPlan === 'guru_uji_coba' ||
        currentUser?.subscriptionPlan === 'teacher' ||
        currentUser?.subscriptionPlan === 'guru_pro' ||
        currentUser?.subscriptionPlan === 'mulai' ||
        currentUser?.subscriptionPlan === 'guru_gratis' ||
        (!currentUser?.schoolId && currentUser?.role !== 'SUPER_ADMIN');

      const isFree =
        (isPersonal || !currentUser?.schoolId || currentUser?.subscriptionPlan === 'guru_gratis' || currentUser?.subscriptionPlan === 'mulai') &&
        !isTeacherPro &&
        !isSchoolPro &&
        currentUser?.role !== 'SUPER_ADMIN';

      if (isFree) {
        openUpgradeModal({
          featureId: 'cetak_pdf',
          customTitle: `Cetak ${reportType}`,
          customMessage:
            'Fitur Cetak Dokumen Laporan Kehadiran resmi siap cetak memerlukan dukungan pengembangan aplikasi. Silakan berikan dukungan untuk mengaktifkan fitur cetak laporan.',
          targetPackage: 'guru_pro',
        });
        return;
      }
    }
    window.print();
  };

  // Canonical report params & URL
  const canonicalParams: CanonicalReportParams = useMemo(() => ({
    classId: resolvedClass?.id || propClassId || externalReportData?.classId,
    className: resolvedClass?.name || propClassName || externalReportData?.className || activeClassName,
    schoolId: propSchoolId || currentUser?.schoolId || (activeWorkspace as any)?.workspaceId || externalReportData?.schoolId || null,
    date: selectedDate,
    attendanceType,
    subjectId,
    reportType,
    selectedWeek: activeWeek,
    month: rawMonthProp,
    year: String(effectiveYear),
    semester: activeSemester,
    academicYear,
  }), [resolvedClass, propClassId, propClassName, externalReportData, activeClassName, propSchoolId, currentUser, activeWorkspace, selectedDate, attendanceType, subjectId, reportType, activeWeek, rawMonthProp, effectiveYear, activeSemester, academicYear]);

  const canonicalShareUrl = useMemo(() => {
    return buildCanonicalReportUrl(canonicalParams);
  }, [canonicalParams]);

  // Simpan snapshot laporan ke localStorage saat pengguna internal membukanya
  // agar saat tautan dibagikan atau dibuka di tab baru, data langsung siap tanpa delay
  useEffect(() => {
    if (isInternalUser && targetStudents.length > 0 && typeof window !== 'undefined') {
      try {
        const snap = {
          schoolId: propSchoolId || currentUser?.schoolId || null,
          classId: resolvedClass?.id || propClassId || '',
          className: activeClassName,
          schoolName,
          pemerintahDaerah: ctxSystemConfig?.pemerintahDaerah || '',
          dinasPendidikan: ctxSystemConfig?.dinasPendidikan || 'DINAS PENDIDIKAN',
          npsn: ctxSchoolProfile?.npsn || '',
          alamat: ctxSchoolProfile?.alamat || '',
          logoUrl: ctxSystemConfig?.schoolLogoUrl || null,
          letterheadType: ctxSystemConfig?.letterheadType || 'standard_text',
          letterheadImageUrl: ctxSystemConfig?.letterheadImageUrl || null,
          showLetterhead: ctxSystemConfig?.showLetterhead ?? true,
          date: selectedDate,
          attendanceType,
          subjectName: resolvedSubject?.name || null,
          teacherName,
          teacherNip,
          principalName,
          principalNip,
          reportPlace: ctxSystemConfig?.reportPlace || 'Jakarta',
          reportDateOfficial: ctxSystemConfig?.reportDate?.trim() || selectedDate,
          reportType,
          week: activeWeek,
          month: rawMonthProp,
          year: String(effectiveYear),
          semester: activeSemester,
          academicYear,
          students: targetStudents.map((s, idx) => {
            const rec = targetRecords.find((r) => r.studentId === s.id && String(r.date || '') === selectedDate);
            return {
              id: s.id,
              no: idx + 1,
              nisn: s.nisn || '',
              nama: s.nama,
              gender: s.gender === 'P' || s.gender === 'Perempuan' ? 'P' : 'L',
              status: rec?.status || 'Hadir',
              checkInTime: rec?.checkInTime || '',
              checkOutTime: rec?.checkOutTime || '',
              notes: rec?.notes || '',
            };
          }),
          records: targetRecords,
        };
        const periodTag = reportType === 'Laporan Bulanan'
          ? `monthly_${monthKey}`
          : reportType === 'Laporan Mingguan'
          ? `weekly_${monthKey}_w${weekNum}`
          : reportType === 'Laporan Semester'
          ? `semester_${activeSemester}_${startYear}_${endYear}`
          : selectedDate;
        const rKey = `kawacanaan_report_${resolvedClass?.id || propClassId || ''}_${periodTag}`;
        localStorage.setItem(rKey, JSON.stringify(snap));
      } catch (_) {}
    }
  }, [isInternalUser, targetStudents, targetRecords, schoolName, principalName, teacherName, selectedDate, resolvedClass, propClassId, activeClassName, ctxSystemConfig, ctxSchoolProfile, attendanceType, resolvedSubject, reportType, activeWeek, weekNum, rawMonthProp, effectiveYear, monthKey]);

  // Sinkronkan address bar secara halus agar saat URL disalin manual tetap berupa Smart Link dokumen
  useEffect(() => {
    if (typeof window !== 'undefined' && canonicalShareUrl) {
      try {
        const u = new URL(canonicalShareUrl);
        window.history.replaceState(null, '', u.pathname + (u.search ? u.search : ''));
      } catch (_) {}
    }
  }, [canonicalShareUrl]);

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      const shareUrl = canonicalShareUrl || window.location.href;
      const schoolTitle = ctxSchoolProfile?.namaSekolah || externalReportData?.schoolName || 'Sekolah';
      const shareTitle = `${reportType} - ${schoolTitle}`;
      if (navigator.share) {
        navigator.share({
          title: shareTitle,
          text: `Dokumen Rekap Kehadiran Resmi: ${schoolTitle} - ${activeClassName || 'Kelas'}`,
          url: shareUrl,
        }).catch(() => {});
      } else {
        navigator.clipboard?.writeText(shareUrl);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      }
    }
  };

  // Determine current active metrics for the summary cards
  const activeMetrics = useMemo(() => {
    if (!isInternalUser && externalReportData) {
      if (reportType === 'Laporan Bulanan') {
        return {
          pctHadir: formatPct(monthlyPctHadir),
          pctSakit: formatPct(monthlyPctSakit),
          pctIzin: formatPct(monthlyPctIzin),
          pctAlfa: formatPct(monthlyPctAlfa),
        };
      }
      if (reportType === 'Laporan Semester') {
        return {
          pctHadir: formatPct(semesterPctHadir),
          pctSakit: formatPct(semesterPctSakit),
          pctIzin: formatPct(semesterPctIzin),
          pctAlfa: formatPct(semesterPctAlfa),
        };
      }
      if (reportType === 'Laporan Mingguan') {
        return {
          pctHadir: formatPct(weeklyPctHadir),
          pctSakit: formatPct(weeklyPctSakit),
          pctIzin: formatPct(weeklyPctIzin),
          pctAlfa: formatPct(weeklyPctAlfa),
        };
      }
      const stats = externalReportData.stats || {};
      const total = stats.totalStudents || (Array.isArray(externalReportData.students) ? externalReportData.students.length : 1) || 1;
      const h = Number(stats.hadir) || 0;
      const s = Number(stats.sakit) || 0;
      const i = Number(stats.izin) || 0;
      const a = Number(stats.alfa) || 0;
      return {
        pctHadir: formatPct((h / total) * 100),
        pctSakit: formatPct((s / total) * 100),
        pctIzin: formatPct((i / total) * 100),
        pctAlfa: formatPct((a / total) * 100),
      };
    }
    if (isKepsekReport) {
      return {
        pctHadir: formatPct(kepsekSchoolPctHadir),
        pctSakit: formatPct(kepsekSchoolPctSakit),
        pctIzin: formatPct(kepsekSchoolPctIzin),
        pctAlfa: formatPct(kepsekSchoolPctAlfa),
      };
    }
    if (reportType === 'Laporan Mingguan') {
      return {
        pctHadir: formatPct(weeklyPctHadir),
        pctSakit: formatPct(weeklyPctSakit),
        pctIzin: formatPct(weeklyPctIzin),
        pctAlfa: formatPct(weeklyPctAlfa),
      };
    }
    if (reportType === 'Laporan Bulanan') {
      return {
        pctHadir: formatPct(monthlyPctHadir),
        pctSakit: formatPct(monthlyPctSakit),
        pctIzin: formatPct(monthlyPctIzin),
        pctAlfa: formatPct(monthlyPctAlfa),
      };
    }
    if (reportType === 'Laporan Semester') {
      return {
        pctHadir: formatPct(semesterPctHadir),
        pctSakit: formatPct(semesterPctSakit),
        pctIzin: formatPct(semesterPctIzin),
        pctAlfa: formatPct(semesterPctAlfa),
      };
    }
    return {
      pctHadir: formatPct(dailyPctHadir),
      pctSakit: formatPct(dailyPctSakit),
      pctIzin: formatPct(dailyPctIzin),
      pctAlfa: formatPct(dailyPctAlfa),
    };
  }, [
    isInternalUser,
    externalReportData,
    reportType,
    isKepsekReport,
    dailyPctHadir,
    dailyPctSakit,
    dailyPctIzin,
    dailyPctAlfa,
    weeklyPctHadir,
    weeklyPctSakit,
    weeklyPctIzin,
    weeklyPctAlfa,
    monthlyPctHadir,
    monthlyPctSakit,
    monthlyPctIzin,
    monthlyPctAlfa,
    semesterPctHadir,
    semesterPctSakit,
    semesterPctIzin,
    semesterPctAlfa,
    kepsekSchoolPctHadir,
    kepsekSchoolPctSakit,
    kepsekSchoolPctIzin,
    kepsekSchoolPctAlfa,
  ]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-4 animate-bounce">
          <FileText size={28} />
        </div>
        <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
          Memuat Dokumen Rekap Kehadiran Resmi...
        </h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Sistem sedang merender lembar laporan presensi resmi secara langsung dari database.
        </p>
        <Loader2 size={24} className="animate-spin text-blue-600 mt-5" />
      </div>
    );
  }

  if (!isInternalUser && (error || !externalReportData)) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-4 shadow-xs">
          <AlertCircle size={28} />
        </div>
        <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
          Dokumen Tidak Ditemukan atau Belum Tersedia
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-md leading-relaxed">
          {error || 'Data rekap kehadiran untuk rombel dan periode ini belum diterbitkan oleh pihak sekolah.'}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setRetryCount((c) => c + 1)}
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-2"
          >
            <span>Muat Ulang Dokumen</span>
          </button>
          {onBackToApp && (
            <button
              type="button"
              onClick={onBackToApp}
              className="px-5 py-2.5 rounded-xl bg-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-300 transition-all cursor-pointer"
            >
              Kembali ke Beranda
            </button>
          )}
        </div>
      </div>
    );
  }

  if (targetStudents.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4 shadow-xs">
          <AlertCircle size={28} />
        </div>
        <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
          Dokumen Belum Tersedia
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-md leading-relaxed">
          Data siswa atau rekap presensi untuk rombel dan periode ini belum tersedia.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setRetryCount((c) => c + 1)}
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            Coba Lagi
          </button>
          {onBackToApp && (
            <button
              type="button"
              onClick={onBackToApp}
              className="px-5 py-2.5 rounded-xl bg-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-300 transition-all cursor-pointer"
            >
              Kembali ke Beranda
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-200/70 text-slate-900 antialiased print:bg-white print:p-0 font-sans">
      {/* Floating Top Action Bar (Non-Printable) */}
      <header className="print:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-300 shadow-xs px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {onBackToApp && (
              <button
                type="button"
                onClick={onBackToApp}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                title="Kembali ke Pengaturan Laporan"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-900 tracking-tight">
                  Dokumen Rekap Resmi Kehadiran Siswa
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {schoolName} • {isKepsekReport ? 'Supervisi Seluruh Rombel' : activeClassName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tombol Ukuran Pas Layar HP vs 100% Zoom */}
            {windowWidth < 768 && (
              <button
                type="button"
                onClick={() => setIsFitToScreen((prev) => !prev)}
                id="btn-toggle-fit-mobile-report"
                className={`p-2 sm:px-2.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                  isFitToScreen
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
                title={isFitToScreen ? 'Ubah ke Tampilan Zoom Detail (100%)' : 'Ubah ke Tampilan Pas Layar HP (1 Halaman Penuh)'}
              >
                <Smartphone size={15} />
                <span className="hidden sm:inline">{isFitToScreen ? 'Pas Layar' : '100%'}</span>
              </button>
            )}

            {/* 1. Tombol Bagikan Smart Link */}
            <button
              type="button"
              onClick={handleShare}
              id="btn-bagikan-smart-report"
              className={`p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                copiedLink
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
              title="Bagikan Tautan Smart Link Dokumen"
            >
              {copiedLink ? <CheckCircle2 size={15} className="text-emerald-600" /> : <Share2 size={15} />}
              <span className="hidden sm:inline">{copiedLink ? 'Link Tersalin!' : 'Bagikan'}</span>
            </button>

            {/* 2. Tombol Cetak Browser */}
            <button
              type="button"
              onClick={handlePrint}
              id="btn-cetak-unduh-smart-report"
              className="px-4 py-2 rounded-xl bg-[#1D82F5] hover:bg-blue-600 text-white text-xs font-black transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Cetak lembar A4 ke printer fisik atau simpan PDF peramban"
            >
              <Printer size={15} />
              <span>Cetak</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Printable Document Sheet (Exact Official A4 Layout) */}
      <main className="w-full max-w-4xl mx-auto p-2 sm:p-6 md:p-8 print:p-0 print:max-w-none flex flex-col items-center">
        <div
          style={windowWidth < 768 && isFitToScreen ? {
            width: `${794 * Math.min(1, Math.max(0.35, (windowWidth - 20) / 794))}px`,
            height: docHeight ? `${docHeight * Math.min(1, Math.max(0.35, (windowWidth - 20) / 794))}px` : 'auto',
            overflow: 'hidden',
          } : undefined}
          className="transition-all duration-150 print:!w-full print:!h-auto print:!overflow-visible"
        >
          <div
            id="printable-report"
            ref={reportRef}
            style={windowWidth < 768 && isFitToScreen ? {
              width: '794px',
              minWidth: '794px',
              maxWidth: '794px',
              transform: `scale(${Math.min(1, Math.max(0.35, (windowWidth - 20) / 794))})`,
              transformOrigin: 'top left',
            } : undefined}
            className="bg-white rounded-xl shadow-xl border border-slate-300 p-5 sm:p-8 md:p-12 font-serif text-slate-900 leading-normal print:p-4 print:shadow-none print:border-none print:rounded-none print:!transform-none print:!w-full print:!max-w-none"
          >
          {/* 1. Formal Indonesian School Letterhead (Kop Surat) */}
          {showLetterhead && (
            <>
              {letterheadType === 'custom_image' && letterheadImageUrl ? (
                /* Custom Image Letterhead */
                <div className="kop-surat-a4-container w-full mb-5 pb-2 border-b-2 border-slate-900 break-inside-avoid print:mb-4 print:pb-1 flex justify-center items-center">
                  <img
                    src={letterheadImageUrl}
                    alt="Kop Surat Resmi Sekolah"
                    className="kop-surat-a4-img w-full max-w-full h-auto object-contain mx-auto block max-h-[140px] print:max-h-[155px]"
                  />
                </div>
              ) : (
                /* Standard Text Letterhead with School Logo & Double Lines */
                <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 pb-3 border-b-4 border-double border-slate-900 mb-6 text-center sm:text-left break-inside-avoid">
                  {schoolLogoUrl ? (
                    <div className="w-16 h-16 sm:w-[74px] sm:h-[74px] shrink-0 flex items-center justify-center">
                      <img
                        src={schoolLogoUrl}
                        alt="Logo Sekolah"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <SchoolLogo size={60} className="sm:w-[74px] sm:h-[74px] shrink-0" />
                  )}
                  <div className="flex-1 text-center font-sans">
                    <h4 className="text-[10px] sm:text-xs font-bold tracking-wider uppercase text-slate-700 leading-tight">
                      {pemerintahDaerah}
                    </h4>
                    <h4 className="text-[10px] sm:text-xs font-bold tracking-wider uppercase text-slate-700 leading-tight">
                      {dinasPendidikan}
                    </h4>
                    <h2 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900 uppercase my-0.5">
                      {schoolName}
                    </h2>
                    <p className="text-[10px] sm:text-[11px] text-slate-600 font-normal">
                      {alamatSekolah}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-slate-600 font-semibold">
                      {isKepsekReport ? (
                        <>NPSN: {npsn} | TAHUN PELAJARAN: {academicYear} | KEPALA SEKOLAH: {principalName}</>
                      ) : (
                        <>NPSN: {npsn} | KELAS: {activeClassClean} | FASE: {String(activeFase || 'Fase A').toUpperCase()}</>
                      )}
                    </p>
                  </div>
                  <div className="w-16 hidden sm:block" />
                </div>
              )}
            </>
          )}

          {/* 2. Official Report Title based on Selected Period */}
          <div className="text-center mb-5 sm:mb-6 font-sans">
            <h3 className="text-sm sm:text-lg font-extrabold uppercase underline tracking-wide">
              {isKepsekReport
                ? (isKepsekSemester ? 'LAPORAN REKAPITULASI KEHADIRAN SEMESTER' : 'LAPORAN REKAPITULASI KEHADIRAN BULANAN')
                : reportType === 'Laporan Harian'
                ? 'LAPORAN KEHADIRAN HARIAN SISWA'
                : reportType === 'Laporan Mingguan'
                ? 'LAPORAN KEHADIRAN MINGGUAN SISWA'
                : reportType === 'Laporan Bulanan'
                ? 'LAPORAN REKAPITULASI KEHADIRAN BULANAN'
                : 'LAPORAN REKAPITULASI KEHADIRAN SEMESTER'}
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-600 font-bold mt-1 uppercase">
              {isKepsekReport ? (
                isKepsekSemester
                  ? <>SEMESTER: {String(semester || 'Ganjil').toUpperCase()} | TAHUN PELAJARAN: {academicYear} (KOMPARASI SELURUH KELAS)</>
                  : <>BULAN: {String(month || '').toUpperCase()} {year} | SEMESTER: {String(semester || 'Ganjil').toUpperCase()} (KOMPARASI SELURUH KELAS)</>
              ) : reportType === 'Laporan Harian' ? (
                <>HARI/TANGGAL: {String(getDayNameIndo(selectedDate) || 'Senin').toUpperCase()}, {String(formatReportDateIndo(selectedDate) || '-').toUpperCase()} | SEMESTER: {String(semester || 'Ganjil').toUpperCase()} (TP: {academicYear})</>
              ) : reportType === 'Laporan Mingguan' ? (
                <>PERIODE: {String(selectedWeek || 'Minggu Ke-1').toUpperCase()} ({String(month || '').toUpperCase()} {year}) | KELAS: {activeClassClean} (TP: {academicYear})</>
              ) : reportType === 'Laporan Bulanan' ? (
                <>BULAN: {String(month || '').toUpperCase()} {year} | SEMESTER: {String(semester || 'Ganjil').toUpperCase()} (TP: {academicYear})</>
              ) : (
                <>SEMESTER: {String(semester || 'Ganjil').toUpperCase()} | TAHUN PELAJARAN: {academicYear}</>
              )}
            </p>
          </div>

          {/* 3. School and Class Attributes Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs font-sans mb-4 border border-slate-200 p-3 rounded-lg bg-slate-50/50">
            <div>
              <p>
                <span className="font-semibold text-slate-600">Nama Sekolah:</span> {schoolName}
              </p>
              <p>
                <span className="font-semibold text-slate-600">Tahun Ajaran:</span> {academicYear}
              </p>
              <p>
                <span className="font-semibold text-slate-600">Semester:</span> {semesterDisplay}
              </p>
            </div>
            <div>
              <p>
                <span className="font-semibold text-slate-600">Kelas:</span> {classNameDisplay}
              </p>
              <p>
                <span className="font-semibold text-slate-600">Hari Efektif:</span> {displayEffectiveDays}
              </p>
              <p>
                <span className="font-semibold text-slate-600">Periode Presensi:</span> {displayPeriodText}
              </p>
            </div>
            {(attendanceType === 'SUBJECT' || (Boolean(resolvedSubject) && !userScope.isWaliKelas)) && (
              <div className="col-span-1 sm:col-span-2 pt-2 border-t border-slate-200 flex flex-wrap items-center gap-4 text-xs font-sans">
                <p>
                  <span className="font-semibold text-slate-600">Mata Pelajaran:</span>{' '}
                  <strong className="text-blue-900">{resolvedSubject?.name || currentUser?.subjectName || externalReportData?.subjectName || 'Mata Pelajaran'}</strong>
                </p>
                <p>
                  <span className="font-semibold text-slate-600">Guru Pengajar:</span>{' '}
                  <strong>{teacherName}</strong>
                </p>
              </div>
            )}
          </div>

          {/* 4. TABEL PRESENSI (KOLOM TIDAK DIUBAH SAMA SEKALI - TETAP & DIPERTAHANKAN) */}

          {/* A. PREVIEW & CETAK: LAPORAN HARIAN */}
          {reportType === 'Laporan Harian' && (
            <div className="overflow-x-auto mb-6 sm:mb-8">
              <table className="w-full text-left border-collapse border border-slate-400 text-xs font-sans min-w-[500px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-400 text-center font-bold">
                    <th className="border border-slate-400 p-1.5 w-8">NO</th>
                    <th className="border border-slate-400 p-1.5 w-24 sm:w-28">NISN</th>
                    <th className="border border-slate-400 p-1.5 text-left">NAMA SISWA</th>
                    <th className="border border-slate-400 p-1.5 w-10">L/P</th>
                    <th className="border border-slate-400 p-1.5 w-20">STATUS</th>
                    <th className="border border-slate-400 p-1.5 w-20">{attendanceType === 'SUBJECT' ? 'MULAI' : 'MASUK'}</th>
                    <th className="border border-slate-400 p-1.5 w-20">{attendanceType === 'SUBJECT' ? 'SELESAI' : 'PULANG'}</th>
                    <th className="border border-slate-400 p-1.5 text-left">
                      {attendanceType === 'SUBJECT' ? 'KETERANGAN / CATATAN MAPEL' : 'KETERANGAN'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(isInternalUser ? dailyStudentRows : (externalReportData?.students || [])).map((s: any, idx: number) => (
                    <tr key={idx} className="border-b border-slate-300">
                      <td className="border border-slate-300 p-1 text-center font-semibold">{s.no || (idx + 1)}</td>
                      <td className="border border-slate-300 p-1 text-center font-mono">{s.nisn || '-'}</td>
                      <td className="border border-slate-300 p-1 font-semibold">{s.nama}</td>
                      <td className="border border-slate-300 p-1 text-center">{s.gender === 'Laki-laki' || s.gender === 'L' ? 'L' : 'P'}</td>
                      <td className="border border-slate-300 p-1 text-center font-bold">
                        <span
                          className={
                            s.status === 'Hadir'
                              ? 'text-emerald-700'
                              : s.status === 'Sakit'
                              ? 'text-sky-700'
                              : s.status === 'Izin'
                              ? 'text-amber-700'
                              : s.status === 'Alfa'
                              ? 'text-rose-700'
                              : 'text-slate-500'
                          }
                        >
                          {s.status || '-'}
                        </span>
                      </td>
                      <td className="border border-slate-300 p-1 text-center font-mono text-[11px]">{s.timeIn || s.checkInTime || '-'}</td>
                      <td className="border border-slate-300 p-1 text-center font-mono text-[11px]">{s.timeOut || s.checkOutTime || '-'}</td>
                      <td className="border border-slate-300 p-1 text-slate-600 italic text-[11px]">{s.note || s.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* B. PREVIEW & CETAK: LAPORAN MINGGUAN */}
          {reportType === 'Laporan Mingguan' && (
            <div className="overflow-x-auto mb-6 sm:mb-8">
              <table className="w-full text-left border-collapse border border-slate-400 text-xs font-sans min-w-[500px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-400 text-center font-bold">
                    <th className="border border-slate-400 p-1.5 w-8">NO</th>
                    <th className="border border-slate-400 p-1.5 w-24">NISN</th>
                    <th className="border border-slate-400 p-1.5 text-left">NAMA SISWA</th>
                    <th className="border border-slate-400 p-1.5 w-8">L/P</th>
                    {weekWorkingDays.map((d) => (
                      <th key={d.dateStr} className="border border-slate-400 p-1 text-center w-10 sm:w-12">
                        <div className="text-[9px]">{d.dayShort}</div>
                        <div className="text-[8px] text-slate-500 font-normal">{d.dayNum}</div>
                      </th>
                    ))}
                    <th className="border border-slate-400 p-1 w-8 text-emerald-800">H</th>
                    <th className="border border-slate-400 p-1 w-8 text-sky-800">S</th>
                    <th className="border border-slate-400 p-1 w-8 text-amber-800">I</th>
                    <th className="border border-slate-400 p-1 w-8 text-rose-800">A</th>
                    <th className="border border-slate-400 p-1.5 w-14">% HADIR</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyStudentRows.map((s, idx) => (
                    <tr key={s.id} className="border-b border-slate-300">
                      <td className="border border-slate-300 p-1 text-center font-semibold">{idx + 1}</td>
                      <td className="border border-slate-300 p-1 text-center font-mono">{s.nisn || '-'}</td>
                      <td className="border border-slate-300 p-1 font-semibold">{s.nama}</td>
                      <td className="border border-slate-300 p-1 text-center">{s.gender === 'Laki-laki' || s.gender === 'L' ? 'L' : 'P'}</td>
                      {weekWorkingDays.map((d) => {
                        const st = s.dayStatusMap[d.dateStr] || '-';
                        return (
                          <td key={d.dateStr} className="border border-slate-300 p-1 text-center font-bold text-[11px]">
                            <span
                              className={
                                st === 'H'
                                  ? 'text-emerald-700'
                                  : st === 'S'
                                  ? 'text-sky-700'
                                  : st === 'I'
                                  ? 'text-amber-700'
                                  : st === 'A'
                                  ? 'text-rose-700'
                                  : 'text-slate-300'
                              }
                            >
                              {st}
                            </span>
                          </td>
                        );
                      })}
                      <td className="border border-slate-300 p-1 text-center font-semibold text-emerald-800">{s.hadir}</td>
                      <td className="border border-slate-300 p-1 text-center font-semibold text-sky-800">{s.sakit}</td>
                      <td className="border border-slate-300 p-1 text-center font-semibold text-amber-800">{s.izin}</td>
                      <td className="border border-slate-300 p-1 text-center font-semibold text-rose-800">{s.alfa}</td>
                      <td className="border border-slate-300 p-1 text-center font-bold text-blue-900">{s.pct}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                    <td colSpan={4 + weekWorkingDays.length} className="border border-slate-400 p-1.5 text-center uppercase">
                      TOTAL / RATA-RATA
                    </td>
                    <td className="border border-slate-400 p-1.5 text-center text-emerald-900 font-extrabold">{weeklyTotalHadir}</td>
                    <td className="border border-slate-400 p-1.5 text-center text-sky-900 font-extrabold">{weeklyTotalSakit}</td>
                    <td className="border border-slate-400 p-1.5 text-center text-amber-900 font-extrabold">{weeklyTotalIzin}</td>
                    <td className="border border-slate-400 p-1.5 text-center text-rose-900 font-extrabold">{weeklyTotalAlfa}</td>
                    <td className="border border-slate-400 p-1.5 text-center text-blue-950 font-black">{formatPct(weeklyPctHadir)}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* C. PREVIEW & CETAK: LAPORAN BULANAN */}
          {reportType === 'Laporan Bulanan' && (
            <div className="overflow-x-auto mb-6 sm:mb-8">
              <table className="w-full text-left border-collapse border border-slate-400 text-xs font-sans min-w-[500px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-400 text-center font-bold">
                    <th className="border border-slate-400 p-1.5 w-8">NO</th>
                    <th className="border border-slate-400 p-1.5 w-28">NISN</th>
                    <th className="border border-slate-400 p-1.5 text-left">NAMA SISWA</th>
                    <th className="border border-slate-400 p-1.5 w-10">L/P</th>
                    <th className="border border-slate-400 p-1.5 w-16 text-emerald-800">HADIR</th>
                    <th className="border border-slate-400 p-1.5 w-16 text-sky-800">SAKIT</th>
                    <th className="border border-slate-400 p-1.5 w-16 text-amber-800">IZIN</th>
                    <th className="border border-slate-400 p-1.5 w-16 text-rose-800">ALFA</th>
                    <th className="border border-slate-400 p-1.5 w-20">% HADIR</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyStudentRows.map((s, idx) => (
                    <tr key={s.id} className="border-b border-slate-300">
                      <td className="border border-slate-300 p-1 text-center font-semibold">{idx + 1}</td>
                      <td className="border border-slate-300 p-1 text-center font-mono">{s.nisn || '-'}</td>
                      <td className="border border-slate-300 p-1 font-semibold">{s.nama}</td>
                      <td className="border border-slate-300 p-1 text-center">{s.gender === 'Laki-laki' || s.gender === 'L' ? 'L' : 'P'}</td>
                      <td className="border border-slate-300 p-1 text-center font-semibold text-emerald-800">{s.hadir}</td>
                      <td className="border border-slate-300 p-1 text-center font-semibold text-sky-800">{s.sakit}</td>
                      <td className="border border-slate-300 p-1 text-center font-semibold text-amber-800">{s.izin}</td>
                      <td className="border border-slate-300 p-1 text-center font-semibold text-rose-800">{s.alfa}</td>
                      <td className="border border-slate-300 p-1 text-center font-bold text-blue-900">{s.pct}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                    <td colSpan={4} className="border border-slate-400 p-1.5 text-center uppercase">
                      TOTAL / RATA-RATA
                    </td>
                    <td className="border border-slate-400 p-1.5 text-center text-emerald-900 font-extrabold">{monthlyTotalHadir}</td>
                    <td className="border border-slate-400 p-1.5 text-center text-sky-900 font-extrabold">{monthlyTotalSakit}</td>
                    <td className="border border-slate-400 p-1.5 text-center text-amber-900 font-extrabold">{monthlyTotalIzin}</td>
                    <td className="border border-slate-400 p-1.5 text-center text-rose-900 font-extrabold">{monthlyTotalAlfa}</td>
                    <td className="border border-slate-400 p-1.5 text-center text-blue-950 font-black">{formatPct(monthlyPctHadir)}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* D. PREVIEW & CETAK: LAPORAN SEMESTER */}
          {reportType === 'Laporan Semester' && (
            <div className="overflow-x-auto mb-6 sm:mb-8">
              <table className="w-full text-left border-collapse border border-slate-400 text-xs font-sans min-w-[500px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-400 text-center font-bold">
                    <th rowSpan={2} className="border border-slate-400 p-2 w-8 text-center">NO</th>
                    <th rowSpan={2} className="border border-slate-400 p-2 w-28 text-center">NISN</th>
                    <th rowSpan={2} className="border border-slate-400 p-2 text-left">NAMA SISWA</th>
                    <th rowSpan={2} className="border border-slate-400 p-2 w-10 text-center">L/P</th>
                    <th colSpan={4} className="border border-slate-400 p-1.5 text-center bg-slate-200/70 font-extrabold text-[11px]">
                      REKAP KEHADIRAN (HARI)
                    </th>
                    <th colSpan={4} className="border border-slate-400 p-1.5 text-center bg-slate-200/70 font-extrabold text-[11px]">
                      PERSENTASE KEHADIRAN (%)
                    </th>
                  </tr>
                  <tr className="bg-slate-50 border-b border-slate-400 text-center font-bold text-[11px]">
                    <th className="border border-slate-400 p-1 text-center w-12 text-emerald-800">H</th>
                    <th className="border border-slate-400 p-1 text-center w-12 text-sky-800">S</th>
                    <th className="border border-slate-400 p-1 text-center w-12 text-amber-800">I</th>
                    <th className="border border-slate-400 p-1 text-center w-12 text-rose-800">A</th>
                    <th className="border border-slate-400 p-1 text-center w-14 text-emerald-900 font-extrabold">%H</th>
                    <th className="border border-slate-400 p-1 text-center w-14 text-sky-900 font-extrabold">%S</th>
                    <th className="border border-slate-400 p-1 text-center w-14 text-amber-900 font-extrabold">%I</th>
                    <th className="border border-slate-400 p-1 text-center w-14 text-rose-900 font-extrabold">%A</th>
                  </tr>
                </thead>
                <tbody>
                  {semesterStudentRows.map((s, idx) => (
                    <tr key={s.id} className="border-b border-slate-300 hover:bg-slate-50/50">
                      <td className="border border-slate-300 p-1.5 text-center font-semibold">{idx + 1}</td>
                      <td className="border border-slate-300 p-1.5 text-center font-mono">{s.nisn || '-'}</td>
                      <td className="border border-slate-300 p-1.5 font-semibold">{s.nama}</td>
                      <td className="border border-slate-300 p-1.5 text-center">{s.gender === 'Laki-laki' || s.gender === 'L' ? 'L' : 'P'}</td>
                      <td className="border border-slate-300 p-1.5 text-center font-semibold text-emerald-800">{s.hadir}</td>
                      <td className="border border-slate-300 p-1.5 text-center font-semibold text-sky-800">{s.sakit}</td>
                      <td className="border border-slate-300 p-1.5 text-center font-semibold text-amber-800">{s.izin}</td>
                      <td className="border border-slate-300 p-1.5 text-center font-semibold text-rose-800">{s.alfa}</td>
                      <td className="border border-slate-300 p-1.5 text-center font-bold text-emerald-900 bg-emerald-50/30">{s.pctHadir}%</td>
                      <td className="border border-slate-300 p-1.5 text-center text-sky-900 bg-sky-50/30">{s.pctSakit}%</td>
                      <td className="border border-slate-300 p-1.5 text-center text-amber-900 bg-amber-50/30">{s.pctIzin}%</td>
                      <td className="border border-slate-300 p-1.5 text-center text-rose-900 bg-rose-50/30">{s.pctAlfa}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                    <td colSpan={4} className="border border-slate-400 p-2 text-center uppercase font-extrabold">
                      TOTAL / RATA-RATA
                    </td>
                    <td className="border border-slate-400 p-1.5 text-center text-emerald-900 font-extrabold">{semesterTotalHadir}</td>
                    <td className="border border-slate-400 p-1.5 text-center text-sky-900 font-extrabold">{semesterTotalSakit}</td>
                    <td className="border border-slate-400 p-1.5 text-center text-amber-900 font-extrabold">{semesterTotalIzin}</td>
                    <td className="border border-slate-400 p-1.5 text-center text-rose-900 font-extrabold">{semesterTotalAlfa}</td>
                    <td className="border border-slate-400 p-1.5 text-center text-emerald-950 font-black bg-emerald-100/50">{formatPct(semesterPctHadir)}%</td>
                    <td className="border border-slate-400 p-1.5 text-center text-sky-950 font-black bg-sky-100/50">{formatPct(semesterPctSakit)}%</td>
                    <td className="border border-slate-400 p-1.5 text-center text-amber-950 font-black bg-amber-100/50">{formatPct(semesterPctIzin)}%</td>
                    <td className="border border-slate-400 p-1.5 text-center text-rose-950 font-black bg-rose-100/50">{formatPct(semesterPctAlfa)}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* E. PREVIEW & CETAK: LAPORAN SUPERVISI KEPALA SEKOLAH */}
          {isKepsekReport && (
            <div className="overflow-x-auto mb-6 sm:mb-8">
              <table className="w-full text-left border-collapse border border-slate-400 text-xs font-sans min-w-[500px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-400 text-center font-bold">
                    <th className="border border-slate-400 p-1.5 w-8">NO</th>
                    <th className="border border-slate-400 p-1.5 w-20">KELAS</th>
                    <th className="border border-slate-400 p-1.5 w-12">FASE</th>
                    <th className="border border-slate-400 p-1.5 text-left">WALI KELAS</th>
                    <th className="border border-slate-400 p-1 w-8">L</th>
                    <th className="border border-slate-400 p-1 w-8">P</th>
                    <th className="border border-slate-400 p-1 w-10">TOTAL</th>
                    <th className="border border-slate-400 p-1.5 w-12 text-emerald-800">HADIR</th>
                    <th className="border border-slate-400 p-1.5 w-12 text-sky-800">SAKIT</th>
                    <th className="border border-slate-400 p-1.5 w-12 text-amber-800">IZIN</th>
                    <th className="border border-slate-400 p-1.5 w-12 text-rose-800">ALFA</th>
                    <th className="border border-slate-400 p-1.5 w-14">TOTAL REKAP</th>
                    <th className="border border-slate-400 p-1.5 w-16">% KEHADIRAN</th>
                    <th className="border border-slate-400 p-1.5 w-24">PREDIKAT</th>
                  </tr>
                </thead>
                <tbody>
                  {kepsekClassRows.map((c, idx) => (
                    <tr key={c.classId} className="border-b border-slate-300">
                      <td className="border border-slate-300 p-1 text-center font-semibold">{idx + 1}</td>
                      <td className="border border-slate-300 p-1 text-center font-bold">{c.className}</td>
                      <td className="border border-slate-300 p-1 text-center">{c.fase}</td>
                      <td className="border border-slate-300 p-1">{c.waliKelasName}</td>
                      <td className="border border-slate-300 p-1 text-center font-mono">{c.maleCount}</td>
                      <td className="border border-slate-300 p-1 text-center font-mono">{c.femaleCount}</td>
                      <td className="border border-slate-300 p-1 text-center font-bold font-mono">{c.totalStudents}</td>
                      <td className="border border-slate-300 p-1 text-center font-semibold text-emerald-800">{c.hadir}</td>
                      <td className="border border-slate-300 p-1 text-center font-semibold text-sky-800">{c.sakit}</td>
                      <td className="border border-slate-300 p-1 text-center font-semibold text-amber-800">{c.izin}</td>
                      <td className="border border-slate-300 p-1 text-center font-semibold text-rose-800">{c.alfa}</td>
                      <td className="border border-slate-300 p-1 text-center font-mono">{c.totalRecorded}</td>
                      <td className="border border-slate-300 p-1 text-center font-black text-blue-900">{c.pctHadir}%</td>
                      <td className="border border-slate-300 p-1 text-center font-bold text-[11px]">{c.predicate}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                    <td colSpan={4} className="border border-slate-400 p-1.5 text-right uppercase">
                      TOTAL SEKOLAH:
                    </td>
                    <td className="border border-slate-400 p-1.5 text-center font-mono">{kepsekSchoolTotalMale}</td>
                    <td className="border border-slate-400 p-1.5 text-center font-mono">{kepsekSchoolTotalFemale}</td>
                    <td className="border border-slate-400 p-1.5 text-center font-mono text-blue-950 font-black">{kepsekSchoolTotalStudents}</td>
                    <td className="border border-slate-400 p-1.5 text-center text-emerald-900 font-extrabold">{kepsekSchoolTotalHadir}</td>
                    <td className="border border-slate-400 p-1.5 text-center text-sky-900 font-extrabold">{kepsekSchoolTotalSakit}</td>
                    <td className="border border-slate-400 p-1.5 text-center text-amber-900 font-extrabold">{kepsekSchoolTotalIzin}</td>
                    <td className="border border-slate-400 p-1.5 text-center text-rose-900 font-extrabold">{kepsekSchoolTotalAlfa}</td>
                    <td className="border border-slate-400 p-1.5 text-center font-mono">{kepsekSchoolTotalRecorded}</td>
                    <td className="border border-slate-400 p-1.5 text-center text-blue-950 font-black">{formatPct(kepsekSchoolPctHadir)}%</td>
                    <td className="border border-slate-400 p-1.5 text-center font-extrabold text-blue-950">{kepsekSchoolPredicate}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* 5. Summary & Evaluation Box */}
          <div className="border border-slate-400 bg-slate-50/70 p-3.5 sm:p-4 rounded-lg font-sans mb-6 text-xs break-inside-avoid">
            <h4 className="font-bold text-slate-900 uppercase text-[11px] sm:text-xs mb-2 border-b border-slate-300 pb-1 flex items-center justify-between">
              <span>KESIMPULAN & RINGKASAN REKAPITULASI KEHADIRAN</span>
              <span className="text-[10px] text-slate-500 font-normal">
                {reportType === 'Laporan Harian' && `Tanggal: ${formatReportDateIndo(selectedDate)}`}
                {reportType === 'Laporan Mingguan' && `Periode: ${selectedWeek} (${month} ${year})`}
                {reportType === 'Laporan Bulanan' && `Bulan: ${month} ${year}`}
                {reportType === 'Laporan Semester' && `Semester: ${semester} (${academicYear})`}
                {isKepsekReport && (isKepsekSemester ? `Semester ${semester} (${academicYear})` : `Bulan ${month} ${year}`)}
              </span>
            </h4>

            {/* Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-center my-2.5">
              <div className="p-2.5 bg-emerald-50/90 border border-emerald-300 rounded-lg text-emerald-950">
                <span className="text-[10px] block font-bold uppercase text-emerald-700">Hadir (H)</span>
                <span className="text-lg sm:text-xl font-black text-emerald-800 tracking-tight">
                  {activeMetrics.pctHadir}%
                </span>
                <span className="block text-[9px] font-semibold text-emerald-600 uppercase">
                  Persentase Kehadiran
                </span>
              </div>
              <div className="p-2.5 bg-sky-50/90 border border-sky-300 rounded-lg text-sky-950">
                <span className="text-[10px] block font-bold uppercase text-sky-700">Sakit (S)</span>
                <span className="text-lg sm:text-xl font-black text-sky-800 tracking-tight">
                  {activeMetrics.pctSakit}%
                </span>
                <span className="block text-[9px] font-semibold text-sky-600 uppercase">
                  Persentase Sakit
                </span>
              </div>
              <div className="p-2.5 bg-amber-50/90 border border-amber-300 rounded-lg text-amber-950">
                <span className="text-[10px] block font-bold uppercase text-amber-700">Izin (I)</span>
                <span className="text-lg sm:text-xl font-black text-amber-800 tracking-tight">
                  {activeMetrics.pctIzin}%
                </span>
                <span className="block text-[9px] font-semibold text-amber-600 uppercase">
                  Persentase Izin
                </span>
              </div>
              <div className="p-2.5 bg-rose-50/90 border border-rose-300 rounded-lg text-rose-950">
                <span className="text-[10px] block font-bold uppercase text-rose-700">Alfa (A)</span>
                <span className="text-lg sm:text-xl font-black text-rose-800 tracking-tight">
                  {activeMetrics.pctAlfa}%
                </span>
                <span className="block text-[9px] font-semibold text-rose-600 uppercase">
                  Persentase Tanpa Keterangan
                </span>
              </div>
            </div>

            <div className="text-[11px] text-slate-700 pt-1.5 border-t border-slate-200 leading-relaxed">
              <p>
                <strong>Catatan Evaluasi:</strong> Tingkat kehadiran {isKepsekReport ? 'seluruh rombel sekolah' : `siswa ${activeClassName}`} pada periode ini tercatat sebesar{' '}
                <span className="font-extrabold text-blue-900 bg-blue-50 px-1 py-0.5 rounded border border-blue-200">
                  {activeMetrics.pctHadir}%
                </span>.
              </p>
            </div>
          </div>

          {/* 6. Lembar Pengesahan Tanda Tangan Resmi - Sejajar di Ponsel Maupun Layar Lebar */}
          <div className="grid grid-cols-2 gap-3 sm:gap-8 text-[11px] sm:text-xs font-sans pt-4 break-inside-avoid">
            <div className="text-center">
              <p className="text-[11px] sm:text-xs">Mengetahui,</p>
              <p className="font-bold text-[11px] sm:text-xs leading-tight">Kepala {schoolName}</p>
              <div className="h-12 sm:h-20" />
              <p className="font-bold underline text-xs sm:text-sm">{principalName}</p>
              <p className="text-slate-600 font-mono text-[10px] sm:text-xs">
                {principalNip && principalNip !== '-' ? `NIP. ${principalNip}` : 'NIP. -'}
              </p>
            </div>

            <div className="text-center">
              <p className="text-[11px] sm:text-xs">
                {reportPlace}, {formatReportDateIndo(reportDateOfficial)}
              </p>
              <p className="font-bold text-[11px] sm:text-xs leading-tight">
                {teacherSignatureTitle}
              </p>
              <div className="h-12 sm:h-20" />
              <p className="font-bold underline text-xs sm:text-sm">
                {isKepsekReport ? (ctxSchoolProfile?.namaWaliKelas || teacherName) : teacherName}
              </p>
              <p className="text-slate-600 font-mono text-[10px] sm:text-xs">
                {teacherNip && teacherNip !== '-' ? `NIP. ${teacherNip}` : 'NIP. -'}
              </p>
            </div>
          </div>

          {/* 7. Footer Verifikasi Digital */}
          <div className="mt-10 pt-4 border-t border-slate-300 text-center text-[10px] text-slate-500 font-sans">
            Dokumen Rekapitulasi Presensi Resmi • Diterbitkan oleh Sistem Kawacanaan Presensi
          </div>
        </div>
      </div>
    </main>
    </div>
  );
};
