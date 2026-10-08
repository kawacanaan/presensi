import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getUserRoleScope } from '../utils/userScope';
import {
  CalendarDays,
  BarChart3,
  Search,
  Printer,
  Users,
  CheckCircle2,
  AlertCircle,
  Award,
  TrendingUp,
  Download,
  Eye,
  X,
  FileSpreadsheet,
  ArrowLeft,
  FileText,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { PublicDailyReportViewer } from '../components/PublicDailyReportViewer';
import { getFaseByClassName, formatClassDisplay } from '../utils/faseKurikulum';
import { normalizeClassToken } from '../utils/documentParser';

export const RekapitulasiView: React.FC = () => {
  const {
    students,
    attendanceRecords,
    schoolProfile,
    getEffectiveDaysForMonth,
    setActiveView,
    showToast,
    classes,
    subjects,
    teachers,
    currentUser,
    activeWorkspace,
  } = useApp();

  const isPersonalWorkspace =
    activeWorkspace?.workspaceType === 'personal' ||
    currentUser?.workspaceType === 'personal' ||
    currentUser?.subscriptionPlan === 'guru_pro' ||
    currentUser?.subscriptionPlan === 'mulai' ||
    currentUser?.subscriptionPlan === 'teacher' ||
    !currentUser?.schoolId;

  const userScope = useMemo(
    () => getUserRoleScope(currentUser, classes, subjects, teachers),
    [currentUser, classes, subjects, teachers]
  );

  // Mode: 'bulanan' | 'semester'
  const [rekapMode, setRekapMode] = useState<'bulanan' | 'semester'>('bulanan');

  // Attendance Category: 'DAILY' | 'SUBJECT'
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
    if (userScope.isGuruMapel && userScope.accessibleClasses.length > 0) {
      return userScope.accessibleClasses[0].id;
    }
    return classes[0]?.id || '';
  });

  // Keep state in sync with user role authority
  useEffect(() => {
    if (userScope.isWaliKelas) {
      setAttendanceType('DAILY');
      const waliClassIds = userScope.accessibleClasses.map((c) => c.id);
      if (waliClassIds.length > 0 && !waliClassIds.includes(selectedClassId)) {
        setSelectedClassId(userScope.assignedWaliClassId || waliClassIds[0]);
      }
    } else if (userScope.isGuruMapel) {
      setAttendanceType('SUBJECT');
      if (userScope.assignedSubjects.length > 0 && !userScope.assignedSubjects.some((s) => s.id === selectedSubjectId)) {
        setSelectedSubjectId(userScope.assignedSubjects[0].id);
      }
      if (userScope.accessibleClasses.length > 0 && !userScope.accessibleClasses.some((c) => c.id === selectedClassId)) {
        setSelectedClassId(userScope.accessibleClasses[0].id);
      }
    }
  }, [userScope]);

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

  const selectedSubjectObj = useMemo(() => {
    return subjects.find((s) => s.id === selectedSubjectId) || null;
  }, [subjects, selectedSubjectId]);

  const selectedClassObj = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId) || null;
  }, [classes, selectedClassId]);

  // Print modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Academic year deduction
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

  // Filters for Bulanan
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    String(new Date().getMonth() + 1).padStart(2, '0')
  );
  const [selectedYear, setSelectedYear] = useState<string>(() => String(new Date().getFullYear()));

  // Filters for Semester (1 = Ganjil: Jul-Des, 2 = Genap: Jan-Jun)
  const [selectedSemester, setSelectedSemester] = useState<'1' | '2'>('1');
  const [semesterYear, setSemesterYear] = useState<string>(() => String(startYear));

  // Search & Detail Modal
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [detailStudentId, setDetailStudentId] = useState<string | null>(null);

  const monthNames: { [key: string]: string } = {
    '01': 'Januari',
    '02': 'Februari',
    '03': 'Maret',
    '04': 'April',
    '05': 'Mei',
    '06': 'Juni',
    '07': 'Juli',
    '08': 'Agustus',
    '09': 'September',
    '10': 'Oktober',
    '11': 'November',
    '12': 'Desember',
  };

  // Filtered Students and Attendance Records strictly for selected/active class
  const targetStudents = useMemo(() => {
    const targetClass = selectedClassObj || classes.find((c) => c.id === selectedClassId);
    if (!targetClass) return [];
    return students
      .filter((s) => {
        if (s.classId && s.classId === targetClass.id) return true;
        if (s.className && normalizeClassToken(s.className) === normalizeClassToken(targetClass.name)) return true;
        return false;
      })
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  }, [students, selectedClassId, selectedClassObj, classes]);

  const targetRecords = useMemo(() => {
    const studentIds = new Set(targetStudents.map((s) => s.id));
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
  }, [attendanceRecords, attendanceType, selectedSubjectId, targetStudents]);

  // ==========================================
  // 1. REKAP BULANAN CALCULATION
  // ==========================================
  const monthKey = `${selectedYear}-${selectedMonth}`;
  const effectiveDaysThisMonth = getEffectiveDaysForMonth(monthKey) || 21;

  const monthlyRecapData = useMemo(() => {
    return targetStudents.map((student) => {
      const studentMonthRecords = targetRecords.filter(
        (r) => r.studentId === student.id && r.date.startsWith(monthKey)
      );

      const hadir = studentMonthRecords.filter((r) => r.status === 'Hadir').length;
      const sakit = studentMonthRecords.filter((r) => r.status === 'Sakit').length;
      const izin = studentMonthRecords.filter((r) => r.status === 'Izin').length;
      const alfa = studentMonthRecords.filter((r) => r.status === 'Alfa').length;
      const totalRecorded = studentMonthRecords.length;

      const baseDenominator = effectiveDaysThisMonth > 0 ? effectiveDaysThisMonth : 1;
      const percentage = Math.min(100, Math.round((hadir / baseDenominator) * 100));

      return {
        student,
        hadir,
        sakit,
        izin,
        alfa,
        totalRecorded,
        percentage,
        records: studentMonthRecords,
      };
    });
  }, [targetStudents, targetRecords, monthKey, effectiveDaysThisMonth]);

  // Filtered monthly data
  const filteredMonthlyRecap = useMemo(() => {
    if (!searchTerm.trim()) return monthlyRecapData;
    const term = searchTerm.toLowerCase();
    return monthlyRecapData.filter(
      (item) =>
        item.student.nama.toLowerCase().includes(term) ||
        item.student.nisn.toLowerCase().includes(term)
    );
  }, [monthlyRecapData, searchTerm]);

  // Overall Monthly Stats
  const monthlyOverallStats = useMemo(() => {
    const totalStudents = targetStudents.length;
    if (totalStudents === 0) return { avgPercentage: 0, totalH: 0, totalS: 0, totalI: 0, totalA: 0 };

    let sumPercent = 0;
    let totalH = 0;
    let totalS = 0;
    let totalI = 0;
    let totalA = 0;

    monthlyRecapData.forEach((item) => {
      sumPercent += item.percentage;
      totalH += item.hadir;
      totalS += item.sakit;
      totalI += item.izin;
      totalA += item.alfa;
    });

    const avgPercentage = Math.round(sumPercent / totalStudents);
    return { avgPercentage, totalH, totalS, totalI, totalA };
  }, [monthlyRecapData, targetStudents.length]);

  // ==========================================
  // 2. REKAP SEMESTER CALCULATION
  // ==========================================
  const semesterMonthList = useMemo(() => {
    if (selectedSemester === '1') {
      // Semester 1 (Ganjil): Juli - Desember (Start Year)
      return [
        { code: '07', name: 'Juli', key: `${semesterYear}-07` },
        { code: '08', name: 'Agustus', key: `${semesterYear}-08` },
        { code: '09', name: 'September', key: `${semesterYear}-09` },
        { code: '10', name: 'Oktober', key: `${semesterYear}-10` },
        { code: '11', name: 'November', key: `${semesterYear}-11` },
        { code: '12', name: 'Desember', key: `${semesterYear}-12` },
      ];
    } else {
      // Semester 2 (Genap): Januari - Juni (Next Year)
      const nextY = String(Number(semesterYear) + 1);
      return [
        { code: '01', name: 'Januari', key: `${nextY}-01` },
        { code: '02', name: 'Februari', key: `${nextY}-02` },
        { code: '03', name: 'Maret', key: `${nextY}-03` },
        { code: '04', name: 'April', key: `${nextY}-04` },
        { code: '05', name: 'Mei', key: `${nextY}-05` },
        { code: '06', name: 'Juni', key: `${nextY}-06` },
      ];
    }
  }, [selectedSemester, semesterYear]);

  const semesterTotalEffectiveDays = useMemo(() => {
    return semesterMonthList.reduce((acc, m) => acc + (getEffectiveDaysForMonth(m.key) || 20), 0);
  }, [semesterMonthList, getEffectiveDaysForMonth]);

  const semesterRecapData = useMemo(() => {
    return targetStudents.map((student) => {
      let totalHadir = 0;
      let totalSakit = 0;
      let totalIzin = 0;
      let totalAlfa = 0;

      const monthlyBreakdown = semesterMonthList.map((m) => {
        const monthRecs = targetRecords.filter(
          (r) => r.studentId === student.id && r.date.startsWith(m.key)
        );
        const h = monthRecs.filter((r) => r.status === 'Hadir').length;
        const s = monthRecs.filter((r) => r.status === 'Sakit').length;
        const i = monthRecs.filter((r) => r.status === 'Izin').length;
        const a = monthRecs.filter((r) => r.status === 'Alfa').length;

        totalHadir += h;
        totalSakit += s;
        totalIzin += i;
        totalAlfa += a;

        return { ...m, h, s, i, a };
      });

      const denom = semesterTotalEffectiveDays > 0 ? semesterTotalEffectiveDays : 1;
      
      // Calculate percentages for each attendance status over the semester
      const pctHadir = Math.min(100, Math.round((totalHadir / denom) * 100));
      const pctSakit = Math.round((totalSakit / denom) * 100 * 10) / 10;
      const pctIzin = Math.round((totalIzin / denom) * 100 * 10) / 10;
      const pctAlfa = Math.round((totalAlfa / denom) * 100 * 10) / 10;

      let predicate = 'Sangat Baik';
      let predicateBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300';
      if (pctHadir < 75) {
        predicate = 'Perlu Pembinaan';
        predicateBadge = 'bg-rose-100 text-rose-800 border-rose-300';
      } else if (pctHadir < 85) {
        predicate = 'Cukup';
        predicateBadge = 'bg-amber-100 text-amber-800 border-amber-300';
      } else if (pctHadir < 95) {
        predicate = 'Baik';
        predicateBadge = 'bg-blue-100 text-blue-800 border-blue-300';
      }

      return {
        student,
        totalHadir,
        totalSakit,
        totalIzin,
        totalAlfa,
        pctHadir,
        pctSakit,
        pctIzin,
        pctAlfa,
        percentage: pctHadir,
        predicate,
        predicateBadge,
        monthlyBreakdown,
      };
    });
  }, [targetStudents, targetRecords, semesterMonthList, semesterTotalEffectiveDays]);

  const filteredSemesterRecap = useMemo(() => {
    if (!searchTerm.trim()) return semesterRecapData;
    const term = searchTerm.toLowerCase();
    return semesterRecapData.filter(
      (item) =>
        item.student.nama.toLowerCase().includes(term) ||
        item.student.nisn.toLowerCase().includes(term)
    );
  }, [semesterRecapData, searchTerm]);

  // Overall Semester Stats
  const semesterOverallStats = useMemo(() => {
    const totalStudents = targetStudents.length;
    if (totalStudents === 0) return { avgPercentage: 0, totalH: 0, totalS: 0, totalI: 0, totalA: 0 };

    let sumPercent = 0;
    let totalH = 0;
    let totalS = 0;
    let totalI = 0;
    let totalA = 0;

    semesterRecapData.forEach((item) => {
      sumPercent += item.percentage;
      totalH += item.totalHadir;
      totalS += item.totalSakit;
      totalI += item.totalIzin;
      totalA += item.totalAlfa;
    });

    const avgPercentage = Math.round(sumPercent / totalStudents);
    return { avgPercentage, totalH, totalS, totalI, totalA };
  }, [semesterRecapData, targetStudents.length]);

  // Selected student for detail popup
  const detailStudentData = useMemo(() => {
    if (!detailStudentId) return null;
    return targetStudents.find((s) => s.id === detailStudentId) || null;
  }, [detailStudentId, targetStudents]);

  // Print function -> Menggunakan Smart Link Document Viewer
  const handlePrint = () => {
    setIsPrintModalOpen(true);
  };

  if (isPrintModalOpen) {
    return (
      <PublicDailyReportViewer
        schoolId={currentUser?.schoolId || (activeWorkspace as any)?.workspaceId || null}
        classId={selectedClassId || ''}
        className={selectedClassObj?.name || ''}
        date={`${selectedYear}-${selectedMonth}-01`}
        attendanceType={attendanceType}
        subjectId={attendanceType === 'SUBJECT' ? (selectedSubjectId || null) : null}
        reportType={rekapMode === 'bulanan' ? 'Laporan Bulanan' : 'Laporan Semester'}
        month={
          rekapMode === 'bulanan'
            ? monthNames[selectedMonth] || 'Januari'
            : selectedSemester === '1'
            ? 'Juli'
            : 'Januari'
        }
        year={rekapMode === 'bulanan' ? selectedYear : semesterYear}
        semester={selectedSemester === '2' ? 'Genap' : 'Ganjil'}
        academicYear={schoolProfile.tahunPelajaran}
        onBackToApp={() => {
          setIsPrintModalOpen(false);
          try {
            window.history.pushState(null, '', window.location.pathname);
          } catch (_) {}
        }}
      />
    );
  }

  return (
    <div className="w-full max-w-6xl 2xl:max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 animate-in fade-in duration-200 pb-20">
      {/* Top Navigation */}
      <div>
        <button
          onClick={() => setActiveView('dashboard')}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs min-h-[38px] cursor-pointer"
          id="btn-back-dashboard-rekap"
        >
          <ArrowLeft size={14} />
          <span>Dashboard</span>
        </button>
      </div>

      {/* Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
            <BarChart3 size={22} />
          </div>
          <div>
            {!isPersonalWorkspace && userScope.isGuruMapel && (
              <div className="flex items-center gap-2 mb-0.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 font-bold text-[11px] border border-indigo-200">
                  <ShieldCheck size={11} />
                  <span>Guru {specializedSubjects[0]?.name || 'Mapel'}</span>
                </span>
              </div>
            )}
            <h1 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900">
              Rekapitulasi Kehadiran Siswa
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              {userScope.isWaliKelas
                ? `Laporan dan ringkasan presensi harian siswa khusus ${userScope.assignedWaliClassName?.toLowerCase().startsWith('kelas') ? userScope.assignedWaliClassName : `Kelas ${userScope.assignedWaliClassName || ''}`}`
                : userScope.isGuruMapel
                ? `Laporan dan ringkasan presensi mata pelajaran untuk rombel yang Anda ajar`
                : 'Pilih jenis rekapitulasi (Bulanan atau Semester) untuk melihat ringkasan presensi sekolah'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setActiveView('laporan')}
            className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 transition-all flex items-center gap-2 cursor-pointer shadow-xs min-h-[38px]"
          >
            <Printer size={15} />
            <span>Format Cetak</span>
          </button>

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handlePrint();
            }}
            id="btn-cetak-rekap-pdf"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer min-h-[38px]"
            title={`Buka dokumen resmi rekapitulasi ${rekapMode === 'bulanan' ? 'bulanan' : 'semester'} untuk diunduh sebagai PDF atau dicetak`}
          >
            <Download size={15} />
            <span>Cetak {rekapMode === 'bulanan' ? 'Bulanan' : 'Semester'}</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs (Rekap Bulanan vs Rekap Semester) & Category (Wali Kelas vs Guru Mapel) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Bulanan vs Semester Switcher */}
          <div className="bg-slate-200/80 p-1.5 rounded-2xl flex items-center gap-1.5 border border-slate-200 shadow-inner w-full md:w-auto">
            <button
              onClick={() => setRekapMode('bulanan')}
              className={`flex-1 md:flex-initial py-2 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                rekapMode === 'bulanan'
                  ? 'bg-white text-blue-700 shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays size={16} />
              <span>Rekap Bulanan</span>
            </button>

            <button
              onClick={() => setRekapMode('semester')}
              className={`flex-1 md:flex-initial py-2 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                rekapMode === 'semester'
                  ? 'bg-white text-blue-700 shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 size={16} />
              <span>Rekap Semester</span>
            </button>
          </div>

          {/* Kategori Presensi: Harian (Wali Kelas) vs Mapel (Guru Mapel) & Kelas Filter */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            {/* Format toggle: only show switch if not restricted to specific role */}
            {!userScope.isWaliKelas && !userScope.isGuruMapel ? (
              <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setAttendanceType('DAILY');
                    setSelectedSubjectId('');
                  }}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    attendanceType === 'DAILY'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Harian (Wali Kelas)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAttendanceType('SUBJECT');
                    if (!selectedSubjectId && specializedSubjects.length > 0) {
                      setSelectedSubjectId(specializedSubjects[0].id);
                    }
                  }}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    attendanceType === 'SUBJECT'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Mata Pelajaran
                </button>
              </div>
            ) : userScope.isGuruMapel ? (
              <div className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-bold rounded-xl flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-indigo-600" />
                <span>Format: Guru Mapel</span>
              </div>
            ) : null}

            {/* If SUBJECT, dropdown mapel */}
            {attendanceType === 'SUBJECT' && (
              userScope.isGuruMapel && specializedSubjects.length === 1 ? (
                <div className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-bold rounded-xl flex items-center gap-1.5">
                  <span>{specializedSubjects[0].name}</span>
                </div>
              ) : (
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white cursor-pointer"
                >
                  {specializedSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code || s.name})
                    </option>
                  ))}
                </select>
              )
            )}

            {/* Filter Kelas */}
            {(!userScope.isWaliKelas || selectableClasses.length > 1) && (
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white cursor-pointer"
              >
                {!userScope.isGuruMapel && !userScope.isWaliKelas && (
                  <option value="">Semua Kelas ({students.length} Siswa)</option>
                )}
                {selectableClasses.map((c) => {
                  const label = `${formatClassDisplay(c.name).toUpperCase()} (${getFaseByClassName(c.name, c.grade)})`;
                  return (
                    <option key={c.id} value={c.id}>
                      {userScope.isGuruMapel ? label : `${c.name} (${getFaseByClassName(c.name, c.grade)}) ${c.waliKelasName ? `• Wali: ${c.waliKelasName}` : ''}`}
                    </option>
                  );
                })}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 1. REKAP BULANAN VIEW */}
      {/* ============================================================== */}
      {rekapMode === 'bulanan' && (
        <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-150">
          {/* Filter Bar & Summary Cards */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold shrink-0">
                  <CalendarDays size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900">
                    Periode: {monthNames[selectedMonth]} {selectedYear}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {effectiveDaysThisMonth} Hari Efektif Belajar • {students.length} Total Siswa
                  </p>
                </div>
              </div>

              {/* Month & Year Selectors */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white cursor-pointer"
                >
                  {Object.entries(monthNames).map(([code, name]) => (
                    <option key={code} value={code}>
                      Bulan {name}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  min={2020}
                  max={2035}
                  className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>
            </div>

            {/* 4 Counters + Average Percentage */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <span className="text-[10px] font-bold text-blue-800 block uppercase">RATA-RATA HADIR</span>
                <span className="text-xl font-black text-blue-900">{monthlyOverallStats.avgPercentage}%</span>
                <span className="text-[10px] text-blue-700 block font-medium">Persentase Kelas</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <span className="text-[10px] font-bold text-emerald-800 block uppercase">TOTAL HADIR (H)</span>
                <span className="text-xl font-black text-emerald-900">{monthlyOverallStats.totalH}</span>
                <span className="text-[10px] text-emerald-700 block font-medium">Presensi Masuk</span>
              </div>
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3">
                <span className="text-[10px] font-bold text-sky-800 block uppercase">TOTAL SAKIT (S)</span>
                <span className="text-xl font-black text-sky-900">{monthlyOverallStats.totalS}</span>
                <span className="text-[10px] text-sky-700 block font-medium">Surat Dokter</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <span className="text-[10px] font-bold text-amber-800 block uppercase">TOTAL IZIN (I)</span>
                <span className="text-xl font-black text-amber-900">{monthlyOverallStats.totalI}</span>
                <span className="text-[10px] text-amber-700 block font-medium">Izin Tertulis</span>
              </div>
              <div className="col-span-2 sm:col-span-1 bg-rose-50 border border-rose-200 rounded-xl p-3">
                <span className="text-[10px] font-bold text-rose-800 block uppercase">TOTAL ALFA (A)</span>
                <span className="text-xl font-black text-rose-900">{monthlyOverallStats.totalA}</span>
                <span className="text-[10px] text-rose-700 block font-medium">Tanpa Keterangan</span>
              </div>
            </div>
          </div>

          {/* Search and Table of Students */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-3 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari nama siswa atau NISN..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>
              <span className="text-xs font-bold text-slate-500">
                Menampilkan {filteredMonthlyRecap.length} dari {students.length} Siswa
              </span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3.5 text-center w-12">No</th>
                    <th className="py-3 px-4">Nama Siswa</th>
                    <th className="py-3 px-3 text-center">NISN</th>
                    <th className="py-3 px-3 text-center">L/P</th>
                    <th className="py-3 px-3 text-center bg-emerald-50/70 text-emerald-900">Hadir (H)</th>
                    <th className="py-3 px-3 text-center bg-sky-50/70 text-sky-900">Sakit (S)</th>
                    <th className="py-3 px-3 text-center bg-amber-50/70 text-amber-900">Izin (I)</th>
                    <th className="py-3 px-3 text-center bg-rose-50/70 text-rose-900">Alfa (A)</th>
                    <th className="py-3 px-3 text-center">Kehadiran</th>
                    <th className="py-3 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {filteredMonthlyRecap.length > 0 ? (
                    filteredMonthlyRecap.map((row, index) => (
                      <tr key={row.student.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="py-3 px-3.5 text-center font-bold text-slate-500">{index + 1}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{row.student.nama}</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-600">{row.student.nisn}</td>
                        <td className="py-3 px-3 text-center font-bold text-slate-500">{row.student.gender}</td>
                        <td className="py-3 px-3 text-center font-extrabold text-emerald-700 bg-emerald-50/30">{row.hadir}</td>
                        <td className="py-3 px-3 text-center font-bold text-sky-700 bg-sky-50/30">{row.sakit}</td>
                        <td className="py-3 px-3 text-center font-bold text-amber-700 bg-amber-50/30">{row.izin}</td>
                        <td className="py-3 px-3 text-center font-bold text-rose-700 bg-rose-50/30">{row.alfa}</td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                              row.percentage >= 90
                                ? 'bg-emerald-100 text-emerald-800'
                                : row.percentage >= 75
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {row.percentage}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => setDetailStudentId(row.student.id)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Lihat Rincian Harian"
                          >
                            <Eye size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        Tidak ada data siswa yang cocok dengan kata kunci.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. REKAP SEMESTER VIEW */}
      {/* ============================================================== */}
      {rekapMode === 'semester' && (
        <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-150">
          {/* Filter Bar & Summary Cards */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900">
                    Rekap {selectedSemester === '1' ? 'Semester 1 (Ganjil: Jul - Des)' : 'Semester 2 (Genap: Jan - Jun)'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {semesterTotalEffectiveDays} Total Hari Efektif Belajar 6 Bulan
                  </p>
                </div>
              </div>

              {/* Semester & Year Selectors */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value as '1' | '2')}
                  className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white cursor-pointer"
                >
                  <option value="1">Semester 1 (Ganjil)</option>
                  <option value="2">Semester 2 (Genap)</option>
                </select>

                <input
                  type="number"
                  value={semesterYear}
                  onChange={(e) => setSemesterYear(e.target.value)}
                  min={2020}
                  max={2035}
                  className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>
            </div>

            {/* 4 Counters + Average Percentage */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                <span className="text-[10px] font-bold text-indigo-800 block uppercase">RATA-RATA SEMESTER</span>
                <span className="text-xl font-black text-indigo-900">{semesterOverallStats.avgPercentage}%</span>
                <span className="text-[10px] text-indigo-700 block font-medium">Persentase Kelas</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <span className="text-[10px] font-bold text-emerald-800 block uppercase">TOTAL HADIR</span>
                <span className="text-xl font-black text-emerald-900">{semesterOverallStats.totalH}</span>
                <span className="text-[10px] text-emerald-700 block font-medium">6 Bulan Terakumulasi</span>
              </div>
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3">
                <span className="text-[10px] font-bold text-sky-800 block uppercase">TOTAL SAKIT</span>
                <span className="text-xl font-black text-sky-900">{semesterOverallStats.totalS}</span>
                <span className="text-[10px] text-sky-700 block font-medium">6 Bulan Terakumulasi</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <span className="text-[10px] font-bold text-amber-800 block uppercase">TOTAL IZIN</span>
                <span className="text-xl font-black text-amber-900">{semesterOverallStats.totalI}</span>
                <span className="text-[10px] text-amber-700 block font-medium">6 Bulan Terakumulasi</span>
              </div>
              <div className="col-span-2 sm:col-span-1 bg-rose-50 border border-rose-200 rounded-xl p-3">
                <span className="text-[10px] font-bold text-rose-800 block uppercase">TOTAL ALFA</span>
                <span className="text-xl font-black text-rose-900">{semesterOverallStats.totalA}</span>
                <span className="text-[10px] text-rose-700 block font-medium">6 Bulan Terakumulasi</span>
              </div>
            </div>
          </div>

          {/* Search and Table of Semester Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-3 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari nama siswa atau NISN..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>
              <span className="text-xs font-bold text-slate-500">
                Menampilkan {filteredSemesterRecap.length} dari {students.length} Siswa
              </span>
            </div>

            {/* Table with 6 Months Breakdown & Complete Percentages */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th rowSpan={2} className="py-3 px-3 text-center w-10 border-r border-slate-200">No</th>
                    <th rowSpan={2} className="py-3 px-4 border-r border-slate-200 min-w-[160px]">Nama Siswa</th>
                    <th rowSpan={2} className="py-3 px-2 text-center border-r border-slate-200">NISN</th>
                    {semesterMonthList.map((m) => (
                      <th key={m.code} colSpan={4} className="py-2 px-1 text-center border-r border-slate-200 bg-blue-50/50">
                        {m.name}
                      </th>
                    ))}
                    <th colSpan={4} className="py-2 px-2 text-center border-r border-slate-200 bg-amber-50/60">Total Semester (Hari)</th>
                    <th colSpan={4} className="py-2 px-2 text-center bg-indigo-50/60">Persentase Semester (%)</th>
                  </tr>
                  <tr className="bg-slate-100/70 text-[9px] text-slate-600 border-t border-slate-200">
                    {semesterMonthList.map((m) => (
                      <React.Fragment key={m.code}>
                        <th className="py-1 px-1 text-center text-emerald-800 font-bold">H</th>
                        <th className="py-1 px-1 text-center text-sky-800 font-bold">S</th>
                        <th className="py-1 px-1 text-center text-amber-800 font-bold">I</th>
                        <th className="py-1 px-1 text-center text-rose-800 font-bold border-r border-slate-200">A</th>
                      </React.Fragment>
                    ))}
                    <th className="py-1 px-1.5 text-center text-emerald-900 font-black bg-emerald-50">H</th>
                    <th className="py-1 px-1.5 text-center text-sky-900 font-black bg-sky-50">S</th>
                    <th className="py-1 px-1.5 text-center text-amber-900 font-black bg-amber-50">I</th>
                    <th className="py-1 px-1.5 text-center text-rose-900 font-black bg-rose-50 border-r border-slate-200">A</th>
                    
                    {/* Persentase Columns per Siswa */}
                    <th className="py-1 px-1.5 text-center text-emerald-900 font-black bg-emerald-100/60">%H</th>
                    <th className="py-1 px-1.5 text-center text-sky-900 font-black bg-sky-100/60">%S</th>
                    <th className="py-1 px-1.5 text-center text-amber-900 font-black bg-amber-100/60">%I</th>
                    <th className="py-1 px-1.5 text-center text-rose-900 font-black bg-rose-100/60 border-r border-slate-200">%A</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800 text-[11px]">
                  {filteredSemesterRecap.length > 0 ? (
                    filteredSemesterRecap.map((row, index) => (
                      <tr key={row.student.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-500 border-r border-slate-100">{index + 1}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-900 border-r border-slate-100">{row.student.nama}</td>
                        <td className="py-2.5 px-2 text-center font-mono text-slate-600 border-r border-slate-100">{row.student.nisn}</td>
                        {row.monthlyBreakdown.map((m) => (
                          <React.Fragment key={m.code}>
                            <td className="py-2 px-1 text-center text-emerald-700 font-semibold">{m.h || 0}</td>
                            <td className="py-2 px-1 text-center text-sky-700 font-semibold">{m.s || 0}</td>
                            <td className="py-2 px-1 text-center text-amber-700 font-semibold">{m.i || 0}</td>
                            <td className="py-2 px-1 text-center text-rose-700 font-semibold border-r border-slate-100">{m.a || 0}</td>
                          </React.Fragment>
                        ))}
                        {/* Total Hari */}
                        <td className="py-2 px-1.5 text-center font-extrabold text-emerald-800 bg-emerald-50/50">{row.totalHadir}</td>
                        <td className="py-2 px-1.5 text-center font-bold text-sky-800 bg-sky-50/50">{row.totalSakit}</td>
                        <td className="py-2 px-1.5 text-center font-bold text-amber-800 bg-amber-50/50">{row.totalIzin}</td>
                        <td className="py-2 px-1.5 text-center font-bold text-rose-800 bg-rose-50/50 border-r border-slate-100">{row.totalAlfa}</td>

                        {/* Persentase Siswa per Status (H%, S%, I%, A%) */}
                        <td className="py-2 px-1.5 text-center font-black text-emerald-700 bg-emerald-50/30">
                          {row.pctHadir}%
                        </td>
                        <td className="py-2 px-1.5 text-center font-bold text-sky-700 bg-sky-50/30">
                          {row.pctSakit}%
                        </td>
                        <td className="py-2 px-1.5 text-center font-bold text-amber-700 bg-amber-50/30">
                          {row.pctIzin}%
                        </td>
                        <td className="py-2 px-1.5 text-center font-bold text-rose-700 bg-rose-50/30">
                          {row.pctAlfa}%
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={34} className="py-8 text-center text-slate-400">
                        Tidak ada data siswa yang cocok.
                      </td>
                    </tr>
                  )}
                </tbody>
                {/* Footer Totals and Class Overall Percentages */}
                {filteredSemesterRecap.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100 font-extrabold text-[10px] text-slate-800 border-t-2 border-slate-300">
                      <td colSpan={3 + semesterMonthList.length * 4} className="py-2 px-3 text-center uppercase tracking-wider font-black">
                        TOTAL KESELURUHAN (HARI)
                      </td>
                      <td className="py-2 px-1.5 text-center text-emerald-900 bg-emerald-100/70 font-black">
                        {semesterOverallStats.totalH}
                      </td>
                      <td className="py-2 px-1.5 text-center text-sky-900 bg-sky-100/70 font-black">
                        {semesterOverallStats.totalS}
                      </td>
                      <td className="py-2 px-1.5 text-center text-amber-900 bg-amber-100/70 font-black">
                        {semesterOverallStats.totalI}
                      </td>
                      <td className="py-2 px-1.5 text-center text-rose-900 bg-rose-100/70 font-black border-r border-slate-200">
                        {semesterOverallStats.totalA}
                      </td>
                      <td colSpan={4} className="py-2 px-2 text-center text-blue-900 bg-blue-100/60 font-black">
                        RATA-RATA HADIR: {semesterOverallStats.avgPercentage}%
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal for Selected Student */}
      {detailStudentData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-base">{detailStudentData.nama}</h3>
                <p className="text-xs text-slate-500">
                  NISN: {detailStudentData.nisn} • Kelas {schoolProfile.kelas || '6A'}
                </p>
              </div>
              <button
                onClick={() => setDetailStudentId(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Catatan Presensi {monthNames[selectedMonth]} {selectedYear}
              </h4>

              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {attendanceRecords
                  .filter((r) => r.studentId === detailStudentData.id && r.date.startsWith(monthKey))
                  .map((r) => (
                    <div
                      key={r.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-800">{r.date}</span>
                        {r.notes && <span className="text-[10px] text-slate-500 ml-2">({r.notes})</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500">
                          {r.checkInTime || '-'} s/d {r.checkOutTime || '-'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            r.status === 'Hadir'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.status === 'Sakit'
                              ? 'bg-sky-100 text-sky-800'
                              : r.status === 'Izin'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDetailStudentId(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
