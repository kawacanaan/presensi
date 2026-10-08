import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { AcademicEvent } from '../types';
import {
  ArrowLeft,
  Calendar,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  CalendarDays,
  X,
  Info,
  CalendarCheck2,
  Building,
  ExternalLink,
  Lock,
  ShieldCheck,
  Sliders,
  Check,
  ArrowRight,
  User,
  Clock,
  Sparkles,
  Loader2,
} from 'lucide-react';

/**
 * Helper to parse startYear and endYear from schoolProfile.tahunPelajaran
 * Supports '2026/2027', '2025/2026', '2026-2027', '2026', etc.
 */
export const parseAcademicYears = (tpStr: string) => {
  const cleanStr = tpStr || '';
  const matches = cleanStr.match(/\d{4}/g);
  if (matches && matches.length >= 2) {
    const y1 = parseInt(matches[0], 10);
    const y2 = parseInt(matches[1], 10);
    return { startYear: y1, endYear: y2, academicYearLabel: `${y1}/${y2}` };
  } else if (matches && matches.length === 1) {
    const y1 = parseInt(matches[0], 10);
    return { startYear: y1, endYear: y1 + 1, academicYearLabel: `${y1}/${y1 + 1}` };
  }
  const currentYear = new Date().getFullYear();
  return { startYear: currentYear, endYear: currentYear + 1, academicYearLabel: `${currentYear}/${currentYear + 1}` };
};

export const KalenderAkademikView: React.FC = () => {
  const {
    currentUser,
    activeWorkspace,
    schoolProfile,
    academicEvents,
    addAcademicEvent,
    deleteAcademicEvent,
    activeStudyDays,
    updateActiveStudyDays,
    effectiveDaysConfig,
    getBaseStudyDaysForMonth,
    setActiveView,
    showToast,
    isSchoolPro,
  } = useApp();

  const isSchoolWorkspace =
    activeWorkspace?.workspaceType !== 'personal' &&
    activeWorkspace?.workspaceType !== 'individu' &&
    !!currentUser?.schoolId;

  // Di ruang kerja sekolah: Role Wali Kelas dan Guru Mapel berstatus Read Only. Hanya Admin Sekolah (atau Super Admin) yang dapat mengelola agenda.
  const canManageCalendar = !isSchoolWorkspace || currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  const isReadOnly = !canManageCalendar;

  // Extract startYear and endYear from schoolProfile.tahunPelajaran
  const { startYear, endYear, academicYearLabel } = useMemo(() => {
    return parseAcademicYears(schoolProfile.tahunPelajaran);
  }, [schoolProfile.tahunPelajaran]);

  // Dapatkan bulan dan tahun berjalan (current running month & year)
  const now = useMemo(() => new Date(), []);
  const currentRunningMonth = useMemo(() => {
    return String(now.getMonth() + 1).padStart(2, '0');
  }, [now]);
  const currentRunningYear = useMemo(() => {
    return now.getFullYear();
  }, [now]);

  // Default selalu menampilkan bulan berjalan (current running month)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const m = new Date().getMonth() + 1;
    return String(m).padStart(2, '0');
  });
  const [selectedYear, setSelectedYear] = useState<string>(() => {
    const currentM = new Date().getMonth() + 1;
    const currentY = new Date().getFullYear();
    if (currentY === startYear || currentY === endYear) {
      return String(currentY);
    }
    return String(currentM >= 7 ? startYear : endYear);
  });
  const [searchAgenda, setSearchAgenda] = useState<string>('');

  // Pastikan kalender selalu menampilkan bulan berjalan saat berpindah ruang kerja sekolah maupun individu
  useEffect(() => {
    const m = String(new Date().getMonth() + 1).padStart(2, '0');
    setSelectedMonth(m);
    const isSemester1 = ['07', '08', '09', '10', '11', '12'].includes(m);
    setSelectedYear(String(isSemester1 ? startYear : endYear));
  }, [activeWorkspace?.workspaceId, startYear, endYear]);

  // Automatically adjust selectedYear based on selectedMonth and schoolProfile.tahunPelajaran
  // Semester 1 (Juli - Desember) uses startYear, Semester 2 (Januari - Juni) uses endYear
  useEffect(() => {
    const isSemester1 = ['07', '08', '09', '10', '11', '12'].includes(selectedMonth);
    const targetYear = String(isSemester1 ? startYear : endYear);
    setSelectedYear(targetYear);
  }, [selectedMonth, startYear, endYear]);

  // Add Event Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventDate, setEventDate] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [eventTitle, setEventTitle] = useState('');
  const [isEffective, setIsEffective] = useState(false); // false means holiday / reduces effective day
  const [eventNotes, setEventNotes] = useState('');

  // Active study days configuration modal state
  const [isConfigStudyDaysModalOpen, setIsConfigStudyDaysModalOpen] = useState(false);
  const [modalStudyDays, setModalStudyDays] = useState<number[]>(activeStudyDays);
  const [isSavingDays, setIsSavingDays] = useState(false);

  useEffect(() => {
    setModalStudyDays(activeStudyDays);
  }, [activeStudyDays]);

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
    const list = activeStudyDays.map((d) => dayNames[d]).filter(Boolean);
    if (list.length === 5 && list[0] === 'Senin' && list[4] === 'Jumat') {
      return 'Senin s.d. Jumat (5 Hari Belajar)';
    }
    if (list.length === 6 && list[0] === 'Senin' && list[5] === 'Sabtu') {
      return 'Senin s.d. Sabtu (6 Hari Belajar)';
    }
    return list.length > 0 ? list.join(', ') : 'Belum diatur';
  }, [activeStudyDays]);

  const is5DaysPreset =
    activeStudyDays.length === 5 &&
    [1, 2, 3, 4, 5].every((d) => activeStudyDays.includes(d));
  const is6DaysPreset =
    activeStudyDays.length === 6 &&
    [1, 2, 3, 4, 5, 6].every((d) => activeStudyDays.includes(d));

  const handleToggleDay = async (dayNumber: number) => {
    if (!canManageCalendar) return;
    let nextDays: number[];
    if (activeStudyDays.includes(dayNumber)) {
      if (activeStudyDays.length <= 1) {
        showToast('Minimal harus ada 1 hari belajar aktif dalam seminggu.', 'error');
        return;
      }
      nextDays = activeStudyDays.filter((d) => d !== dayNumber);
    } else {
      nextDays = [...activeStudyDays, dayNumber];
    }
    try {
      setIsSavingDays(true);
      await updateActiveStudyDays(nextDays);
    } finally {
      setIsSavingDays(false);
    }
  };

  const handleApplyPreset = async (preset: 5 | 6) => {
    if (!canManageCalendar) return;
    const targetDays = preset === 5 ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6];
    try {
      setIsSavingDays(true);
      await updateActiveStudyDays(targetDays);
    } finally {
      setIsSavingDays(false);
    }
  };

  const handleOpenConfigModal = () => {
    setModalStudyDays([...activeStudyDays]);
    setIsConfigStudyDaysModalOpen(true);
  };

  const handleModalToggleDay = (dayNumber: number) => {
    if (modalStudyDays.includes(dayNumber)) {
      if (modalStudyDays.length <= 1) {
        showToast('Minimal harus ada 1 hari belajar aktif dalam seminggu.', 'error');
        return;
      }
      setModalStudyDays(modalStudyDays.filter((d) => d !== dayNumber));
    } else {
      setModalStudyDays([...modalStudyDays, dayNumber]);
    }
  };

  const handleModalApplyPreset = (preset: 5 | 6) => {
    setModalStudyDays(preset === 5 ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6]);
  };

  const handleSaveModalDays = async () => {
    if (modalStudyDays.length === 0) {
      showToast('Pilih minimal 1 hari belajar aktif dalam seminggu.', 'error');
      return;
    }
    try {
      setIsSavingDays(true);
      await updateActiveStudyDays(modalStudyDays);
      setIsConfigStudyDaysModalOpen(false);
    } finally {
      setIsSavingDays(false);
    }
  };

  const monthKey = `${selectedYear}-${selectedMonth}`;
  const baseHariBelajar = effectiveDaysConfig[monthKey] !== undefined
    ? effectiveDaysConfig[monthKey]
    : getBaseStudyDaysForMonth(Number(selectedYear), Number(selectedMonth));

  // Filter events for the selected month and search query
  const filteredEvents = useMemo(() => {
    return academicEvents.filter((e) => {
      const inMonth = e.date.startsWith(monthKey);
      const matchesQuery = e.title.toLowerCase().includes(searchAgenda.toLowerCase()) ||
        (e.notes && e.notes.toLowerCase().includes(searchAgenda.toLowerCase()));
      return inMonth && matchesQuery;
    });
  }, [academicEvents, monthKey, searchAgenda]);

  // Calculate non-effective events in this month that fall on an active study day
  const nonEffectiveEventsInMonth = useMemo(() => {
    return academicEvents.filter((e) => {
      if (!e.date.startsWith(monthKey) || e.isEffective) return false;
      try {
        const [y, m, d] = e.date.split('-').map(Number);
        const dayOfWeek = new Date(y, m - 1, d).getDay();
        return activeStudyDays.includes(dayOfWeek);
      } catch {
        return false;
      }
    });
  }, [academicEvents, monthKey, activeStudyDays]);

  const nonEffectiveCount = nonEffectiveEventsInMonth.length;
  const finalEffectiveDays = Math.max(0, baseHariBelajar - nonEffectiveCount);

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

  const weekdaysList = [
    { dayNumber: 1, label: 'Senin', short: 'Sen' },
    { dayNumber: 2, label: 'Selasa', short: 'Sel' },
    { dayNumber: 3, label: 'Rabu', short: 'Rab' },
    { dayNumber: 4, label: 'Kamis', short: 'Kam' },
    { dayNumber: 5, label: 'Jumat', short: 'Jum' },
    { dayNumber: 6, label: 'Sabtu', short: 'Sab' },
    { dayNumber: 0, label: 'Minggu', short: 'Min' },
  ];

  // 12 Months of the Academic Year (Juli year 1 s/d Juni year 2)
  const academicMonthsList = useMemo(() => {
    return [
      { m: '07', y: startYear, name: 'Juli', semester: 1, semesterLabel: 'Semester 1 (Ganjil)' },
      { m: '08', y: startYear, name: 'Agustus', semester: 1, semesterLabel: 'Semester 1 (Ganjil)' },
      { m: '09', y: startYear, name: 'September', semester: 1, semesterLabel: 'Semester 1 (Ganjil)' },
      { m: '10', y: startYear, name: 'Oktober', semester: 1, semesterLabel: 'Semester 1 (Ganjil)' },
      { m: '11', y: startYear, name: 'November', semester: 1, semesterLabel: 'Semester 1 (Ganjil)' },
      { m: '12', y: startYear, name: 'Desember', semester: 1, semesterLabel: 'Semester 1 (Ganjil)' },
      { m: '01', y: endYear, name: 'Januari', semester: 2, semesterLabel: 'Semester 2 (Genap)' },
      { m: '02', y: endYear, name: 'Februari', semester: 2, semesterLabel: 'Semester 2 (Genap)' },
      { m: '03', y: endYear, name: 'Maret', semester: 2, semesterLabel: 'Semester 2 (Genap)' },
      { m: '04', y: endYear, name: 'April', semester: 2, semesterLabel: 'Semester 2 (Genap)' },
      { m: '05', y: endYear, name: 'Mei', semester: 2, semesterLabel: 'Semester 2 (Genap)' },
      { m: '06', y: endYear, name: 'Juni', semester: 2, semesterLabel: 'Semester 2 (Genap)' },
    ];
  }, [startYear, endYear]);

  // Summaries calculation for Semester 1, Semester 2, and Full Academic Year
  const { semester1Summary, semester2Summary, fullYearSummary } = useMemo(() => {
    let s1Cal = 0;
    let s1Base = 0;
    let s1Libur = 0;
    let s1Heb = 0;

    let s2Cal = 0;
    let s2Base = 0;
    let s2Libur = 0;
    let s2Heb = 0;

    academicMonthsList.forEach((row) => {
      const mNum = Number(row.m);
      const totalDays = new Date(row.y, mNum, 0).getDate();
      const baseDays = getBaseStudyDaysForMonth(row.y, mNum);
      const mKey = `${row.y}-${row.m}`;

      const libur = academicEvents.filter((e) => {
        if (!e.date.startsWith(mKey) || e.isEffective) return false;
        try {
          const [ey, em, ed] = e.date.split('-').map(Number);
          const dayOfWeek = new Date(ey, em - 1, ed).getDay();
          return activeStudyDays.includes(dayOfWeek);
        } catch {
          return false;
        }
      }).length;

      const heb = Math.max(0, baseDays - libur);

      if (row.semester === 1) {
        s1Cal += totalDays;
        s1Base += baseDays;
        s1Libur += libur;
        s1Heb += heb;
      } else {
        s2Cal += totalDays;
        s2Base += baseDays;
        s2Libur += libur;
        s2Heb += heb;
      }
    });

    return {
      semester1Summary: { cal: s1Cal, base: s1Base, libur: s1Libur, heb: s1Heb },
      semester2Summary: { cal: s2Cal, base: s2Base, libur: s2Libur, heb: s2Heb },
      fullYearSummary: {
        cal: s1Cal + s2Cal,
        base: s1Base + s2Base,
        libur: s1Libur + s2Libur,
        heb: s1Heb + s2Heb,
      },
    };
  }, [academicMonthsList, academicEvents, activeStudyDays, getBaseStudyDaysForMonth]);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageCalendar) return;
    if (!eventTitle.trim()) return;

    const [ey, em, ed] = eventDate.split('-').map(Number);
    const day = String(ed).padStart(2, '0');
    const monthShortIndo = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'][em - 1] || 'Jan';
    const yStr = String(ey).slice(-2);
    const dateDisplay = `${day} ${monthShortIndo} '${yStr}`;

    await addAcademicEvent({
      date: eventDate,
      dateDisplay,
      title: eventTitle.trim(),
      isEffective,
      notes: eventNotes.trim(),
    });

    // Otomatis arahkan tampilan kalender ke bulan & tahun agenda baru yang dibuat
    const newMonth = String(em).padStart(2, '0');
    const newYear = String(ey);
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);

    setIsModalOpen(false);
    setEventTitle('');
    setEventNotes('');
  };

  const openAddModalForMonth = () => {
    if (!canManageCalendar) return;
    setEventDate(`${selectedYear}-${selectedMonth}-01`);
    setIsModalOpen(true);
  };

  const handleSelectMonthFromTable = (m: string, y: number) => {
    setSelectedMonth(m);
    setSelectedYear(String(y));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="w-full max-w-6xl 2xl:max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 animate-in fade-in duration-200 pb-20">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setActiveView('dashboard')}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs min-h-[38px] cursor-pointer"
          id="btn-back-dashboard"
        >
          <ArrowLeft size={14} />
          <span>Dashboard</span>
        </button>
      </div>

      {/* Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
            <Calendar size={22} />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900">
              Kalender Akademik & Hari Belajar
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Terintegrasi langsung dengan Tahun Pelajaran <b>{schoolProfile.tahunPelajaran || `${startYear}/${endYear}`}</b>{schoolProfile.namaSekolah ? ` (${schoolProfile.namaSekolah})` : ''}.
            </p>
          </div>
        </div>
      </div>

      {/* Read-Only Notice for non-admin in school workspace */}
      {isReadOnly && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 shadow-xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0">
              <Lock size={16} />
            </div>
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-xs sm:text-sm">Mode Ruang Kerja Sekolah: Lihat Saja (Read-Only)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200/80 text-amber-900 border border-amber-300">
                  {currentUser?.role === 'WALI KELAS' ? 'WALI KELAS' : currentUser?.role === 'GURU MAPEL' ? 'GURU MAPEL' : currentUser?.role || 'READ ONLY'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-amber-800 leading-relaxed">
                Di ruang kerja sekolah, jadwal hari efektif belajar ({activeStudyDays.length} hari: {activeStudyDaysText}) dan agenda dikelola terpusat oleh Admin Sekolah.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Individual Workspace banner for teachers */}
      {!isSchoolWorkspace && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-blue-50/90 border border-blue-200 text-blue-950 shadow-xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 border border-blue-300 text-blue-800 flex items-center justify-center shrink-0">
              <User size={16} />
            </div>
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-xs sm:text-sm">Ruang Kerja Individu: Pengaturan Mandiri Pendidik</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-200/80 text-blue-900 border border-blue-300">
                  {currentUser?.role === 'WALI KELAS' ? 'WALI KELAS' : currentUser?.role === 'GURU MAPEL' ? 'GURU MAPEL' : currentUser?.role || 'PENDIDIK'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-blue-800 leading-relaxed">
                Anda memiliki akses penuh untuk mengatur hari efektif belajar selama seminggu (5 hari, 6 hari, atau kustom) sesuai jadwal mengajar atau binaan Anda. Hari belajar aktif saat ini: <b>{activeStudyDaysText}</b> ({activeStudyDays.length} hari/minggu).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleOpenConfigModal}
            id="btn-modal-atur-hari-individu"
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Sliders size={13} />
            <span>Atur Hari Belajar ({activeStudyDays.length} Hari)</span>
          </button>
        </div>
      )}

      {/* Section 1: Agenda Bulanan & Analisis Efektivitas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* Left Column: Agenda Table & Controls */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* Controls Toolbar: Period Selectors, Search, and Action Buttons */}
          <div className="flex flex-col gap-3">
            {/* Row 1: Month, Quick Jump & Year */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Month Selector */}
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="flex-1 sm:flex-initial px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-600 cursor-pointer min-h-[40px]"
                id="select-kalender-bulan"
              >
                {Object.entries(monthNames).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v} {k === currentRunningMonth ? '• (Bulan Berjalan)' : ''}
                  </option>
                ))}
              </select>

              {/* Integrated Year Selector based on Tahun Pelajaran */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-blue-700 focus:outline-none focus:border-blue-600 cursor-pointer min-h-[40px]"
                title="Tahun terintegrasi dari Tahun Pelajaran di Identitas Sekolah"
                id="select-kalender-tahun"
              >
                <option value={String(startYear)}>
                  {startYear} (Semester 1)
                </option>
                <option value={String(endYear)}>
                  {endYear} (Semester 2)
                </option>
                {selectedYear !== String(startYear) && selectedYear !== String(endYear) && (
                  <option value={selectedYear}>{selectedYear}</option>
                )}
              </select>

              {/* Quick Jump to Bulan Berjalan Button if different month selected */}
              {selectedMonth !== currentRunningMonth && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMonth(currentRunningMonth);
                    const isSemester1 = ['07', '08', '09', '10', '11', '12'].includes(currentRunningMonth);
                    setSelectedYear(String(isSemester1 ? startYear : endYear));
                  }}
                  className="w-full sm:w-auto px-2.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shrink-0 min-h-[40px]"
                  title="Kembali ke Bulan Berjalan"
                >
                  <CalendarCheck2 size={14} className="text-emerald-600" />
                  <span>Bulan Berjalan ({monthNames[currentRunningMonth]})</span>
                </button>
              )}
            </div>

            {/* Row 2: Search Bar & Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              {/* Search Bar */}
              <div className="relative flex-1 sm:max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchAgenda}
                  onChange={(e) => setSearchAgenda(e.target.value)}
                  placeholder="Cari agenda kegiatan..."
                  className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 min-h-[40px]"
                  id="input-cari-agenda"
                />
                {searchAgenda && (
                  <button
                    type="button"
                    onClick={() => setSearchAgenda('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    aria-label="Bersihkan pencarian"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              {canManageCalendar ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenConfigModal}
                    id="btn-atur-hari-belajar"
                    className="flex-1 sm:flex-initial px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-extrabold text-xs rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 min-h-[40px] shrink-0 cursor-pointer"
                    title="Atur jumlah hari efektif belajar dalam seminggu (5 hari, 6 hari, atau kustom)"
                  >
                    <Sliders size={14} className="text-blue-600" />
                    <span>Atur Hari Belajar ({activeStudyDays.length} Hari)</span>
                  </button>

                  <button
                    onClick={openAddModalForMonth}
                    id="btn-tambah-agenda"
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 min-h-[40px] shrink-0 cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>+ Agenda</span>
                  </button>
                </div>
              ) : (
                <div
                  className="w-full sm:w-auto px-3.5 py-2 bg-slate-100 border border-slate-200 text-slate-500 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 min-h-[40px] shrink-0 cursor-default"
                  title="Akses Read-Only: Hanya Admin Sekolah yang dapat menambah agenda"
                >
                  <Lock size={13} className="text-slate-400" />
                  <span>Lihat Saja (Read Only)</span>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Agenda Card List (HP View) */}
          <div className="block sm:hidden space-y-2.5">
            <div className="flex items-center justify-between px-1 text-xs font-bold text-slate-700">
              <span>Daftar Agenda ({filteredEvents.length})</span>
              <span className="text-[10px] font-semibold text-slate-400">
                {monthNames[selectedMonth]} {selectedYear}
              </span>
            </div>

            {filteredEvents.length > 0 ? (
              <div className="space-y-2">
                {filteredEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-200 transition-colors shadow-2xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-800">
                          <Calendar size={12} className="text-blue-600" />
                          <span>{ev.dateDisplay}</span>
                        </div>
                        <h4 className="font-bold text-xs text-slate-900 leading-snug">
                          {ev.title}
                        </h4>
                        {ev.notes && (
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            {ev.notes}
                          </p>
                        )}
                      </div>

                      {canManageCalendar && (
                        <button
                          type="button"
                          onClick={() => deleteAcademicEvent(ev.id)}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0 cursor-pointer"
                          title="Hapus Agenda"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    <div className="pt-1 flex items-center justify-between border-t border-slate-100">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                          ev.isEffective
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {ev.isEffective ? 'Hari Efektif Belajar' : 'Hari Libur / Non-Efektif'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-200 text-slate-400 font-medium text-xs bg-slate-50">
                Belum ada agenda kegiatan untuk bulan {monthNames[selectedMonth]} {selectedYear}.
              </div>
            )}
          </div>

          {/* Desktop & Tablet Table (Hidden on Mobile HP) */}
          <div className="hidden sm:block border border-slate-100 rounded-xl overflow-hidden">
            <div className="p-2.5 sm:p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Daftar Agenda {monthNames[selectedMonth]} {selectedYear} ({filteredEvents.length})
              </span>
              <span className="text-[10px] text-slate-400 hidden sm:inline-block md:hidden">← Geser tabel jika diperlukan →</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[460px]">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-bold text-blue-700 uppercase tracking-widest bg-blue-50/60">
                    <th className="py-3 px-3 sm:px-4 w-28 sm:w-32">Tanggal</th>
                    <th className="py-3 px-3 sm:px-4">Nama Kegiatan</th>
                    {canManageCalendar && <th className="py-3 px-3 sm:px-4 text-center w-20">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredEvents.length > 0 ? (
                    filteredEvents.map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-3 sm:px-4 font-bold text-slate-800 whitespace-nowrap">{ev.dateDisplay}</td>
                        <td className="py-3.5 px-3 sm:px-4">
                          <p className="font-bold text-slate-900">{ev.title}</p>
                          {ev.notes && <p className="text-[11px] text-slate-500 mt-0.5">{ev.notes}</p>}
                          <span
                            className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                              ev.isEffective
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {ev.isEffective ? 'Hari Efektif Belajar' : 'Hari Libur / Non-Efektif'}
                          </span>
                        </td>
                        {canManageCalendar && (
                          <td className="py-3.5 px-3 sm:px-4 text-center">
                            <button
                              onClick={() => deleteAcademicEvent(ev.id)}
                              className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors min-h-[36px] min-w-[36px] inline-flex items-center justify-center cursor-pointer"
                              title="Hapus Agenda"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={canManageCalendar ? 3 : 2} className="text-center py-8 text-slate-400 font-medium">
                        Belum ada agenda kegiatan untuk bulan {monthNames[selectedMonth]} {selectedYear}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Analisis Efektivitas Card */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
          <div>
            {/* Header Banner */}
            <div className="bg-blue-50 border-b border-blue-100 text-blue-700 p-4 flex items-center justify-between font-bold text-sm">
              <div className="flex items-center gap-2">
                <Calendar size={18} />
                <h3 className="tracking-wide font-extrabold">Analisis Efektivitas</h3>
              </div>
              <span className="text-[11px] font-mono font-bold bg-blue-100/70 text-blue-800 px-2 py-0.5 rounded">
                {selectedYear}
              </span>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Active Study Days Configuration Widget */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sliders size={14} className="text-blue-600" />
                    <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">
                      Hari Belajar Seminggu
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md border border-blue-200">
                    {activeStudyDays.length} Hari/Minggu
                  </span>
                </div>

                {canManageCalendar ? (
                  <>
                    {/* Quick Presets: 5 Hari vs 6 Hari */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleApplyPreset(5)}
                        id="btn-quick-preset-5-hari"
                        disabled={isSavingDays}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          is5DaysPreset
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                        title="Terapkan jadwal 5 Hari Belajar (Senin - Jumat)"
                      >
                        {is5DaysPreset && <Check size={13} className="shrink-0" />}
                        <span>5 Hari (Sen–Jum)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyPreset(6)}
                        id="btn-quick-preset-6-hari"
                        disabled={isSavingDays}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          is6DaysPreset
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                        title="Terapkan jadwal 6 Hari Belajar (Senin - Sabtu)"
                      >
                        {is6DaysPreset && <Check size={13} className="shrink-0" />}
                        <span>6 Hari (Sen–Sab)</span>
                      </button>
                    </div>

                    {/* Interactive Day Pills */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-semibold text-slate-500">
                          Toggle Hari Aktif:
                        </span>
                        <button
                          type="button"
                          onClick={handleOpenConfigModal}
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          Buka Dialog Lengkap
                        </button>
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {weekdaysList.map((w) => {
                          const isActive = activeStudyDays.includes(w.dayNumber);
                          return (
                            <button
                              key={w.dayNumber}
                              type="button"
                              onClick={() => handleToggleDay(w.dayNumber)}
                              disabled={isSavingDays}
                              id={`toggle-day-${w.dayNumber}`}
                              title={`Klik untuk ${isActive ? 'nonaktifkan' : 'aktifkan'} ${w.label}`}
                              className={`py-1.5 px-0.5 rounded-lg text-center text-[11px] font-black border transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs hover:bg-blue-700'
                                  : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-700 line-through'
                              }`}
                            >
                              {w.short}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Active description & scope */}
                    <div className="text-[11px] text-slate-600 leading-snug pt-0.5">
                      Jadwal aktif: <strong className="text-slate-900">{activeStudyDaysText}</strong>.
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {isSchoolWorkspace
                          ? '• Berlaku untuk seluruh rombel & presensi sekolah.'
                          : '• Berlaku khusus untuk ruang kerja individu Anda.'}
                      </p>
                    </div>
                  </>
                ) : (
                  /* Read-Only display for non-admin in school workspace */
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {weekdaysList.map((w) => {
                        const isActive = activeStudyDays.includes(w.dayNumber);
                        return (
                          <span
                            key={w.dayNumber}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${
                              isActive
                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                            }`}
                          >
                            {w.short}
                          </span>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Jadwal sekolah: <b>{activeStudyDaysText}</b> (diatur oleh Admin Sekolah).
                    </p>
                  </div>
                )}
              </div>

              {/* Calculations breakdown */}
              <div className="space-y-3 divide-y divide-slate-100 text-xs">
                <div className="flex items-center justify-between text-slate-600 pt-1">
                  <span>Hari Belajar ({activeStudyDays.length} hari/minggu)</span>
                  <span className="font-extrabold text-slate-900 text-sm">{baseHariBelajar}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 pt-3">
                  <span>Agenda Libur Sekolah</span>
                  <span className="font-extrabold text-rose-600 text-sm">
                    {nonEffectiveCount > 0 ? `-${nonEffectiveCount}` : '0'}
                  </span>
                </div>
              </div>

              {/* Big Center Total */}
              <div className="text-center py-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                  HARI EFEKTIF BELAJAR
                </p>
                <div className="text-4xl font-black text-blue-700 leading-none my-1">
                  {finalEffectiveDays}
                </div>
                <p className="text-xs font-bold text-slate-700">Bulan {monthNames[selectedMonth]} {selectedYear}</p>
              </div>

              {/* Informational Banner */}
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-800 leading-relaxed flex items-start gap-2">
                <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <span>
                  Perhitungan otomatis terhubung ke formulir <b>Absensi</b>, panel <b>Rekapitulasi</b>, dan <b>Cetak Laporan</b> TP {schoolProfile.tahunPelajaran || `${startYear}/${endYear}`}.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: 12-Month Academic Year Breakdown Table (Integrated with tahunPelajaran) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <CalendarCheck2 size={18} className="text-blue-600" />
              <span>
                Rekapitulasi Hari Efektif Per Bulan (Tahun Pelajaran {schoolProfile.tahunPelajaran || `${startYear}/${endYear}`})
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Tahun otomatis disinkronkan dengan Identitas Sekolah ({startYear} untuk Semester 1 & {endYear} untuk Semester 2).
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl">
              Total Hari Belajar/Minggu: {activeStudyDays.length} Hari
            </div>
          </div>
        </div>

        {/* Mobile Cards (HP / Small Tablet View) */}
        <div className="block md:hidden space-y-4">
          {/* SEMESTER 1 (GANJIL) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Semester 1 (Ganjil) - Tahun {startYear}
              </span>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                Subtotal: {semester1Summary.heb} HEB
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {academicMonthsList.slice(0, 6).map((row) => {
                const mNum = Number(row.m);
                const totalDaysInMonth = new Date(row.y, mNum, 0).getDate();
                const baseDays = getBaseStudyDaysForMonth(row.y, mNum);
                const mKey = `${row.y}-${row.m}`;
                const liburAgenda = academicEvents.filter((e) => {
                  if (!e.date.startsWith(mKey) || e.isEffective) return false;
                  try {
                    const [ey, em, ed] = e.date.split('-').map(Number);
                    const dayOfWeek = new Date(ey, em - 1, ed).getDay();
                    return activeStudyDays.includes(dayOfWeek);
                  } catch {
                    return false;
                  }
                }).length;
                const heb = Math.max(0, baseDays - liburAgenda);
                const isCurrentSelected = row.m === selectedMonth && String(row.y) === selectedYear;
                const isBulanBerjalan = row.m === currentRunningMonth && (row.y === currentRunningYear || !academicMonthsList.some(r => r.m === currentRunningMonth && r.y === currentRunningYear));

                return (
                  <div
                    key={mKey}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isCurrentSelected
                        ? 'border-blue-500 bg-blue-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5 pb-2 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-xs text-slate-900">{row.name} {row.y}</h4>
                          {isBulanBerjalan && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Bulan Berjalan
                            </span>
                          )}
                          {isCurrentSelected && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-600 text-white">
                              Terpilih
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">{row.semesterLabel}</span>
                      </div>

                      <button
                        onClick={() => handleSelectMonthFromTable(row.m, row.y)}
                        className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[10px] font-bold text-blue-700 transition-colors shrink-0 cursor-pointer min-h-[30px]"
                      >
                        Lihat Agenda
                      </button>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-500">
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-slate-400">Kalender</div>
                          <div className="font-bold text-slate-700">{totalDaysInMonth} hr</div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-slate-400">Rutin</div>
                          <div className="font-bold text-slate-700">{baseDays} hr</div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-slate-400">Libur</div>
                          <div className="font-bold text-rose-600">{liburAgenda > 0 ? `-${liburAgenda}` : '0'} hr</div>
                        </div>
                      </div>

                      <div className="text-right pl-2 border-l border-slate-100">
                        <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">HEB</div>
                        <div className="text-base font-black text-blue-700 leading-none">{heb} hr</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SEMESTER 2 (GENAP) */}
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Semester 2 (Genap) - Tahun {endYear}
              </span>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                Subtotal: {semester2Summary.heb} HEB
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {academicMonthsList.slice(6, 12).map((row) => {
                const mNum = Number(row.m);
                const totalDaysInMonth = new Date(row.y, mNum, 0).getDate();
                const baseDays = getBaseStudyDaysForMonth(row.y, mNum);
                const mKey = `${row.y}-${row.m}`;
                const liburAgenda = academicEvents.filter((e) => {
                  if (!e.date.startsWith(mKey) || e.isEffective) return false;
                  try {
                    const [ey, em, ed] = e.date.split('-').map(Number);
                    const dayOfWeek = new Date(ey, em - 1, ed).getDay();
                    return activeStudyDays.includes(dayOfWeek);
                  } catch {
                    return false;
                  }
                }).length;
                const heb = Math.max(0, baseDays - liburAgenda);
                const isCurrentSelected = row.m === selectedMonth && String(row.y) === selectedYear;
                const isBulanBerjalan = row.m === currentRunningMonth && (row.y === currentRunningYear || !academicMonthsList.some(r => r.m === currentRunningMonth && r.y === currentRunningYear));

                return (
                  <div
                    key={mKey}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isCurrentSelected
                        ? 'border-blue-500 bg-blue-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5 pb-2 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-xs text-slate-900">{row.name} {row.y}</h4>
                          {isBulanBerjalan && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Bulan Berjalan
                            </span>
                          )}
                          {isCurrentSelected && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-600 text-white">
                              Terpilih
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">{row.semesterLabel}</span>
                      </div>

                      <button
                        onClick={() => handleSelectMonthFromTable(row.m, row.y)}
                        className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[10px] font-bold text-blue-700 transition-colors shrink-0 cursor-pointer min-h-[30px]"
                      >
                        Lihat Agenda
                      </button>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-500">
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-slate-400">Kalender</div>
                          <div className="font-bold text-slate-700">{totalDaysInMonth} hr</div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-slate-400">Rutin</div>
                          <div className="font-bold text-slate-700">{baseDays} hr</div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-slate-400">Libur</div>
                          <div className="font-bold text-rose-600">{liburAgenda > 0 ? `-${liburAgenda}` : '0'} hr</div>
                        </div>
                      </div>

                      <div className="text-right pl-2 border-l border-slate-100">
                        <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">HEB</div>
                        <div className="text-base font-black text-blue-700 leading-none">{heb} hr</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grand Total Mobile Card */}
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-900">
                ★ Total 1 Tahun Pelajaran
              </span>
              <span className="text-xs font-black text-emerald-800 bg-white px-2.5 py-0.5 rounded-full border border-emerald-200">
                {fullYearSummary.heb} HARI EFEKTIF
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px] text-emerald-800 pt-1 border-t border-emerald-200/60">
              <div>
                <span className="text-[10px] text-emerald-600 block">Kalender</span>
                <strong>{fullYearSummary.cal} Hari</strong>
              </div>
              <div>
                <span className="text-[10px] text-emerald-600 block">Hari Belajar</span>
                <strong>{fullYearSummary.base} Hari</strong>
              </div>
              <div>
                <span className="text-[10px] text-emerald-600 block">Libur Agenda</span>
                <strong className="text-rose-600">{fullYearSummary.libur > 0 ? `-${fullYearSummary.libur}` : '0'} Hari</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop & Tablet Table (Hidden on Mobile HP) */}
        <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[650px]">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-bold text-blue-700 uppercase tracking-widest bg-blue-50/60 text-center">
                  <th className="py-3 px-3 sm:px-4 text-left">Bulan</th>
                  <th className="py-3 px-3 sm:px-4">Tahun</th>
                  <th className="py-3 px-3 sm:px-4">Semester</th>
                  <th className="py-3 px-3 sm:px-4">Total Hari Kalender</th>
                  <th className="py-3 px-3 sm:px-4">Hari Belajar Rutin</th>
                  <th className="py-3 px-3 sm:px-4 text-rose-600">Agenda Libur</th>
                  <th className="py-3 px-3 sm:px-4 text-emerald-700 font-extrabold bg-blue-100/50">Hari Efektif (HEB)</th>
                  <th className="py-3 px-3 sm:px-4">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {/* Render Semester 1 (Juli - Desember) */}
                <tr className="bg-slate-100/80 font-bold text-slate-700 text-[11px]">
                  <td colSpan={8} className="py-2 px-3 sm:px-4">
                    SEMESTER 1 (GANJIL) - TAHUN {startYear}
                  </td>
                </tr>
                {academicMonthsList.slice(0, 6).map((row) => {
                  const mNum = Number(row.m);
                  const totalDaysInMonth = new Date(row.y, mNum, 0).getDate();
                  const baseDays = getBaseStudyDaysForMonth(row.y, mNum);
                  const mKey = `${row.y}-${row.m}`;
                  
                  const liburAgenda = academicEvents.filter((e) => {
                    if (!e.date.startsWith(mKey) || e.isEffective) return false;
                    try {
                      const [ey, em, ed] = e.date.split('-').map(Number);
                      const dayOfWeek = new Date(ey, em - 1, ed).getDay();
                      return activeStudyDays.includes(dayOfWeek);
                    } catch {
                      return false;
                    }
                  }).length;

                  const heb = Math.max(0, baseDays - liburAgenda);
                  const isCurrentSelected = row.m === selectedMonth && String(row.y) === selectedYear;
                  const isBulanBerjalan = row.m === currentRunningMonth && (row.y === currentRunningYear || !academicMonthsList.some(r => r.m === currentRunningMonth && r.y === currentRunningYear));

                  return (
                    <tr
                      key={mKey}
                      className={`hover:bg-slate-50 transition-colors ${
                        isCurrentSelected ? 'bg-blue-50/50 font-bold' : ''
                      }`}
                    >
                      <td className="py-3 px-3 sm:px-4 font-bold text-slate-900 text-left">
                        {row.name}
                        {isBulanBerjalan && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Bulan Berjalan
                          </span>
                        )}
                        {isCurrentSelected && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-600 text-white">
                            Terpilih
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-center font-mono font-bold text-blue-700">{row.y}</td>
                      <td className="py-3 px-3 sm:px-4 text-center text-slate-500 text-[11px]">{row.semesterLabel}</td>
                      <td className="py-3 px-3 sm:px-4 text-center text-slate-600">{totalDaysInMonth} Hari</td>
                      <td className="py-3 px-3 sm:px-4 text-center font-semibold">{baseDays} Hari</td>
                      <td className="py-3 px-3 sm:px-4 text-center font-semibold text-rose-600">
                        {liburAgenda > 0 ? `-${liburAgenda}` : '0'}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-center font-black text-blue-700 bg-blue-50/60 text-sm">
                        {heb} Hari
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-center">
                        <button
                          onClick={() => handleSelectMonthFromTable(row.m, row.y)}
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-[11px] font-bold text-blue-600 transition-colors cursor-pointer"
                        >
                          Lihat Agenda
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Subtotal Semester 1 */}
                <tr className="bg-blue-50/70 font-bold text-blue-900 border-t-2 border-b-2 border-blue-200">
                  <td colSpan={3} className="py-2.5 px-3 sm:px-4 uppercase tracking-wider text-[11px]">
                    Subtotal Semester 1 (Ganjil {startYear})
                  </td>
                  <td className="py-2.5 px-3 sm:px-4 text-center">{semester1Summary.cal} Hari</td>
                  <td className="py-2.5 px-3 sm:px-4 text-center">{semester1Summary.base} Hari</td>
                  <td className="py-2.5 px-3 sm:px-4 text-center text-rose-600">
                    {semester1Summary.libur > 0 ? `-${semester1Summary.libur}` : '0'}
                  </td>
                  <td className="py-2.5 px-3 sm:px-4 text-center font-black text-blue-800 text-sm bg-blue-100/60">
                    {semester1Summary.heb} Hari
                  </td>
                  <td className="py-2.5 px-3 sm:px-4 text-center text-[10px] text-blue-600 font-bold">
                    (6 Bulan)
                  </td>
                </tr>

                {/* Render Semester 2 (Januari - Juni) */}
                <tr className="bg-slate-100/80 font-bold text-slate-700 text-[11px]">
                  <td colSpan={8} className="py-2 px-3 sm:px-4">
                    SEMESTER 2 (GENAP) - TAHUN {endYear}
                  </td>
                </tr>
                {academicMonthsList.slice(6, 12).map((row) => {
                  const mNum = Number(row.m);
                  const totalDaysInMonth = new Date(row.y, mNum, 0).getDate();
                  const baseDays = getBaseStudyDaysForMonth(row.y, mNum);
                  const mKey = `${row.y}-${row.m}`;
                  
                  const liburAgenda = academicEvents.filter((e) => {
                    if (!e.date.startsWith(mKey) || e.isEffective) return false;
                    try {
                      const [ey, em, ed] = e.date.split('-').map(Number);
                      const dayOfWeek = new Date(ey, em - 1, ed).getDay();
                      return activeStudyDays.includes(dayOfWeek);
                    } catch {
                      return false;
                    }
                  }).length;

                  const heb = Math.max(0, baseDays - liburAgenda);
                  const isCurrentSelected = row.m === selectedMonth && String(row.y) === selectedYear;
                  const isBulanBerjalan = row.m === currentRunningMonth && (row.y === currentRunningYear || !academicMonthsList.some(r => r.m === currentRunningMonth && r.y === currentRunningYear));

                  return (
                    <tr
                      key={mKey}
                      className={`hover:bg-slate-50 transition-colors ${
                        isCurrentSelected ? 'bg-blue-50/50 font-bold' : ''
                      }`}
                    >
                      <td className="py-3 px-3 sm:px-4 font-bold text-slate-900 text-left">
                        {row.name}
                        {isBulanBerjalan && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Bulan Berjalan
                          </span>
                        )}
                        {isCurrentSelected && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-600 text-white">
                            Terpilih
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-center font-mono font-bold text-blue-700">{row.y}</td>
                      <td className="py-3 px-3 sm:px-4 text-center text-slate-500 text-[11px]">{row.semesterLabel}</td>
                      <td className="py-3 px-3 sm:px-4 text-center text-slate-600">{totalDaysInMonth} Hari</td>
                      <td className="py-3 px-3 sm:px-4 text-center font-semibold">{baseDays} Hari</td>
                      <td className="py-3 px-3 sm:px-4 text-center font-semibold text-rose-600">
                        {liburAgenda > 0 ? `-${liburAgenda}` : '0'}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-center font-black text-blue-700 bg-blue-50/60 text-sm">
                        {heb} Hari
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-center">
                        <button
                          onClick={() => handleSelectMonthFromTable(row.m, row.y)}
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-[11px] font-bold text-blue-600 transition-colors cursor-pointer"
                        >
                          Lihat Agenda
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Subtotal Semester 2 */}
                <tr className="bg-blue-50/70 font-bold text-blue-900 border-t-2 border-b-2 border-blue-200">
                  <td colSpan={3} className="py-2.5 px-3 sm:px-4 uppercase tracking-wider text-[11px]">
                    Subtotal Semester 2 (Genap {endYear})
                  </td>
                  <td className="py-2.5 px-3 sm:px-4 text-center">{semester2Summary.cal} Hari</td>
                  <td className="py-2.5 px-3 sm:px-4 text-center">{semester2Summary.base} Hari</td>
                  <td className="py-2.5 px-3 sm:px-4 text-center text-rose-600">
                    {semester2Summary.libur > 0 ? `-${semester2Summary.libur}` : '0'}
                  </td>
                  <td className="py-2.5 px-3 sm:px-4 text-center font-black text-blue-800 text-sm bg-blue-100/60">
                    {semester2Summary.heb} Hari
                  </td>
                  <td className="py-2.5 px-3 sm:px-4 text-center text-[10px] text-blue-600 font-bold">
                    (6 Bulan)
                  </td>
                </tr>

                {/* Grand Total 1 Tahun Pelajaran */}
                <tr className="bg-emerald-50 font-black text-emerald-900 border-t-2 border-emerald-300">
                  <td colSpan={3} className="py-3 px-3 sm:px-4 uppercase tracking-wider text-xs">
                    ★ TOTAL 1 TAHUN PELAJARAN ({schoolProfile.tahunPelajaran || `${startYear}/${endYear}`})
                  </td>
                  <td className="py-3 px-3 sm:px-4 text-center">{fullYearSummary.cal} Hari</td>
                  <td className="py-3 px-3 sm:px-4 text-center">{fullYearSummary.base} Hari</td>
                  <td className="py-3 px-3 sm:px-4 text-center text-rose-700">
                    {fullYearSummary.libur > 0 ? `-${fullYearSummary.libur}` : '0'}
                  </td>
                  <td className="py-3 px-3 sm:px-4 text-center font-black text-emerald-800 text-base bg-emerald-100/80">
                    {fullYearSummary.heb} HARI
                  </td>
                  <td className="py-3 px-3 sm:px-4 text-center text-[10px] text-emerald-700 font-bold">
                    (12 Bulan Penuh)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      {canManageCalendar && isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 text-slate-800 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Tambah Agenda Akademik</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddEvent} className="space-y-4 pt-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  TANGGAL
                </label>
                <input
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none min-h-[40px]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  NAMA KEGIATAN / AGENDA
                </label>
                <input
                  type="text"
                  required
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="Contoh: Hari Kemerdekaan, Rapat Pleno, dll."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none min-h-[40px]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  SIFAT HARI
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEffective(false)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all min-h-[40px] cursor-pointer ${
                      !isEffective
                        ? 'bg-rose-50 border-rose-400 text-rose-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Libur / Non-Efektif (-1 Hari)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEffective(true)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all min-h-[40px] cursor-pointer ${
                      isEffective
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Tetap Hari Efektif
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  KETERANGAN / CATATAN
                </label>
                <textarea
                  rows={2}
                  value={eventNotes}
                  onChange={(e) => setEventNotes(e.target.value)}
                  placeholder="Keterangan tambahan..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl min-h-[38px] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md min-h-[38px] cursor-pointer"
                >
                  Simpan Agenda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Atur Hari Efektif Belajar Seminggu */}
      {isConfigStudyDaysModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center text-white">
                  <Sliders size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg leading-snug">
                    Atur Hari Efektif Belajar Seminggu
                  </h3>
                  <p className="text-[11px] text-blue-100 font-medium">
                    {isSchoolWorkspace
                      ? 'Ruang Kerja Sekolah (Admin Sekolah)'
                      : 'Ruang Kerja Individu (Pendidik Mandiri)'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigStudyDaysModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Tutup dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-slate-800">
              {/* Context Explanation */}
              <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 text-blue-900 text-xs leading-relaxed space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Sparkles size={14} className="text-blue-600" />
                  <span>
                    {isSchoolWorkspace
                      ? 'Pengaturan Hari Belajar Tingkat Sekolah'
                      : 'Pengaturan Hari Belajar Ruang Kerja Individu'}
                  </span>
                </div>
                <p className="text-[11px] text-blue-800">
                  {isSchoolWorkspace
                    ? 'Hari belajar yang Anda tentukan akan otomatis menjadi dasar perhitungan Hari Belajar Rutin di kalender akademik, jadwal absensi kelas, dan rekapitulasi kehadiran seluruh rombel sekolah.'
                    : 'Sebagai Wali Kelas / Guru Mapel di Ruang Kerja Individu, Anda dapat menyesuaikan hari belajar efektif mandiri sesuai jadwal pembelajaran rombel atau mata pelajaran Anda.'}
                </p>
              </div>

              {/* Presets Selection */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                  PILIHAN CEPAT (PRESET STANDAR)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleModalApplyPreset(5)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                      modalStudyDays.length === 5 && [1, 2, 3, 4, 5].every((d) => modalStudyDays.includes(d))
                        ? 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100/70 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-xs text-slate-900">5 Hari Belajar</span>
                      {modalStudyDays.length === 5 && [1, 2, 3, 4, 5].every((d) => modalStudyDays.includes(d)) && (
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                          <Check size={12} />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">Senin s.d. Jumat</p>
                    <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                      Sabtu & Minggu Libur
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleModalApplyPreset(6)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                      modalStudyDays.length === 6 && [1, 2, 3, 4, 5, 6].every((d) => modalStudyDays.includes(d))
                        ? 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100/70 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-xs text-slate-900">6 Hari Belajar</span>
                      {modalStudyDays.length === 6 && [1, 2, 3, 4, 5, 6].every((d) => modalStudyDays.includes(d)) && (
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                          <Check size={12} />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">Senin s.d. Sabtu</p>
                    <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                      Minggu Libur
                    </span>
                  </button>
                </div>
              </div>

              {/* Day-by-day Checkboxes */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                  RINCIAN SETIAP HARI (KLIK UNTUK MENGUBAH)
                </label>
                <div className="space-y-1.5">
                  {weekdaysList.map((w) => {
                    const isChecked = modalStudyDays.includes(w.dayNumber);
                    return (
                      <div
                        key={w.dayNumber}
                        onClick={() => handleModalToggleDay(w.dayNumber)}
                        className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer select-none ${
                          isChecked
                            ? 'bg-blue-50/50 border-blue-300 text-slate-900'
                            : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                              isChecked
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-white border-slate-300 text-transparent'
                            }`}
                          >
                            <Check size={13} strokeWidth={3} />
                          </div>
                          <div>
                            <span className={`text-xs font-black ${isChecked ? 'text-slate-900' : 'text-slate-500'}`}>
                              Hari {w.label}
                            </span>
                            <span className="text-[11px] text-slate-400 ml-2">
                              ({w.short})
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                            isChecked
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {isChecked ? 'HARI BELAJAR' : 'LIBUR MINGGUAN'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Preview Box */}
              <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-700 block">Total Hari Belajar Aktif:</span>
                  <span className="text-[11px] text-slate-500">
                    {modalStudyDays.length} hari per minggu (libur mingguan: {7 - modalStudyDays.length} hari)
                  </span>
                </div>
                <div className="px-3 py-1 bg-white border border-slate-300 rounded-xl font-black text-blue-700 text-sm">
                  {modalStudyDays.length} Hari / Minggu
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsConfigStudyDaysModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer min-h-[38px]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveModalDays}
                disabled={isSavingDays || modalStudyDays.length === 0}
                className="px-5 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[38px]"
              >
                {isSavingDays ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Simpan Hari Belajar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
