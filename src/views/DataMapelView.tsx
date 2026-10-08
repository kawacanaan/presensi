import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Subject, SubjectClassSchedule, Teacher } from '../types';
import { getUserRoleScope } from '../utils/userScope';
import { validateTeacherRoleAssignment } from '../utils/packageSystem';
import { getFaseByClassName, getFaseBadgeColor, FaseKurikulum, formatClassDisplay } from '../utils/faseKurikulum';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  BookOpen,
  Search,
  CheckCircle2,
  Calendar,
  UserCheck,
  GraduationCap,
  Layers,
  Sparkles,
  Filter,
  Info,
  Clock,
  CheckSquare,
  ChevronDown,
  Check,
  AlertCircle,
  Copy,
  ArrowRight,
  ArrowLeft,
  Sliders,
} from 'lucide-react';

const COMMON_SUBJECT_PRESETS = [
  { name: 'Pendidikan Agama Islam dan Budi Pekerti', code: 'PAI' },
  { name: 'Pendidikan Agama Kristen', code: 'PAK' },
  { name: 'Pendidikan Jasmani, Olahraga, dan Kesehatan', code: 'PJOK' },
  { name: 'Bahasa Inggris', code: 'B. Inggris' },
  { name: 'Koding & Kecerdasan Artifisial / Informatika', code: 'KODING' },
  { name: 'Bahasa Sunda', code: 'B. Sunda' },
  { name: 'Bahasa Jawa', code: 'B. Jawa' },
  { name: 'Pendidikan Lingkungan dan Budaya Jakarta', code: 'PLBJ' },
];

const DAYS_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const DataMapelView: React.FC = () => {
  const {
    currentUser,
    subjects,
    teachers,
    classes,
    attendanceRecords,
    schoolProfile,
    addSubject,
    updateSubject,
    deleteSubject,
    setActiveView,
    showToast,
    activeWorkspace,
  } = useApp();

  const isPersonalWorkspace =
    activeWorkspace?.workspaceType === 'personal' ||
    activeWorkspace?.workspaceType === 'individu' ||
    (currentUser?.subscriptionPlan === 'mulai' && !currentUser?.schoolId);

  const userScope = useMemo(
    () => getUserRoleScope(currentUser, classes, subjects, teachers),
    [currentUser, classes, subjects, teachers]
  );

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  const isWaliKelas = userScope.isWaliKelas;
  const isGuruMapel = userScope.isGuruMapel || currentUser?.role === 'GURU MAPEL';
  const assignedWaliClass = userScope.assignedWaliClass;

  // Find teacher record linked to currentUser
  const currentTeacher = useMemo(() => {
    if (userScope.currentTeacher) return userScope.currentTeacher;
    if (currentUser?.teacherId) {
      return teachers.find((t) => t.id === currentUser.teacherId) || null;
    }
    const cleanName = (currentUser?.name || '').toLowerCase().trim();
    return teachers.find((t) => t.nama.toLowerCase().trim() === cleanName) || null;
  }, [currentUser, teachers, userScope.currentTeacher]);

  // Check if a specific subject is taught by current user
  const isMySubject = (sub: Subject) => {
    if (!currentUser) return false;
    if (sub.teacherId && currentUser.teacherId && sub.teacherId === currentUser.teacherId) return true;
    if (currentTeacher?.id && sub.teacherId && sub.teacherId === currentTeacher.id) return true;
    if (currentUser.subjectId && sub.id === currentUser.subjectId) return true;
    if (userScope.assignedSubjectIds.includes(sub.id)) return true;
    if (sub.teacherName) {
      const cleanSubTeacher = sub.teacherName.toLowerCase().trim();
      const cleanUserName = (currentUser.name || '').toLowerCase().trim();
      const cleanTeacherName = (currentTeacher?.nama || '').toLowerCase().trim();
      if (cleanUserName && cleanSubTeacher === cleanUserName) return true;
      if (cleanTeacherName && cleanSubTeacher === cleanTeacherName) return true;
    }
    return false;
  };

  const mySubjectsCount = useMemo(() => {
    return subjects.filter((s) => isMySubject(s)).length;
  }, [subjects, currentUser, currentTeacher, userScope.assignedSubjectIds]);

  // Kumpulan ID dan Nama kelas yang diampu oleh Wali Kelas
  const waliAccessibleClassIds = useMemo(() => {
    const ids = new Set<string>();
    if (assignedWaliClass?.id) ids.add(assignedWaliClass.id);
    (userScope.accessibleClassIds || []).forEach((id) => ids.add(id));
    (userScope.accessibleClasses || []).forEach((c) => ids.add(c.id));
    if (currentUser?.classIds && currentUser.classIds.length > 0) {
      currentUser.classIds.forEach((id) => ids.add(id));
    }
    return ids;
  }, [assignedWaliClass, userScope.accessibleClassIds, userScope.accessibleClasses, currentUser?.classIds]);

  const waliAccessibleClassNames = useMemo(() => {
    const names = new Set<string>();
    if (assignedWaliClass?.name) names.add(assignedWaliClass.name.trim().toLowerCase());
    (userScope.accessibleClasses || []).forEach((c) => names.add(c.name.trim().toLowerCase()));
    return names;
  }, [assignedWaliClass, userScope.accessibleClasses]);

  const isSubjectInWaliAssignment = (sub: Subject) => {
    if (!isWaliKelas) return true;
    const targetIds = sub.targetClassIds || [];
    const targetNames = (sub.targetClassNames || []).map((n) => n.trim().toLowerCase());
    const schedules = sub.classSchedules || [];

    const matchesClassId = targetIds.some((cid) => waliAccessibleClassIds.has(cid));
    const matchesClassName = targetNames.some((cn) => waliAccessibleClassNames.has(cn));
    const matchesSchedule = schedules.some(
      (cs) => waliAccessibleClassIds.has(cs.classId) || (cs.className && waliAccessibleClassNames.has(cs.className.trim().toLowerCase()))
    );
    const matchesTeacher = isMySubject(sub);

    return matchesClassId || matchesClassName || matchesSchedule || matchesTeacher;
  };

  // Search & Class Filter & Scope Filter (Semua vs Mapel Saya)
  const [searchTerm, setSearchTerm] = useState('');
  const [viewScopeTab, setViewScopeTab] = useState<'ALL' | 'MY'>(() => {
    return isGuruMapel && mySubjectsCount > 0 ? 'MY' : 'ALL';
  });

  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');

  // Modal Add / Edit
  const [openModal, setOpenModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [acronym, setAcronym] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  // Mapping: classId -> array of days (e.g. { 'cls-1': ['Senin'], 'cls-2': ['Rabu'] })
  const [classSchedulesMap, setClassSchedulesMap] = useState<Record<string, string[]>>({});
  // Mapping: classId -> { startTime: string; endTime: string }
  const [classTimesMap, setClassTimesMap] = useState<Record<string, { startTime: string; endTime: string }>>({});

  // Modal Interactive States (Tabs & Filters)
  const [modalActiveTab, setModalActiveTab] = useState<'all' | 'info' | 'schedule'>('all');
  const [modalClassSearch, setModalClassSearch] = useState('');
  const [modalClassFaseFilter, setModalClassFaseFilter] = useState<'ALL' | 'Fase A' | 'Fase B' | 'Fase C'>('ALL');

  // Delete Confirmation Modal
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);

  // Keyboard accessibility: ESC closes open modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (openModal) setOpenModal(false);
        if (deletingSubject) setDeletingSubject(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openModal, deletingSubject]);

  // Helper untuk mengecek apakah seorang guru adalah Wali Kelas
  const isTeacherWaliKelas = (t: Teacher) => {
    const tugas = (t.tugasUtama || t.tugas_utama || '').toLowerCase().trim();
    if (tugas === 'wali kelas' || tugas === 'walikelas') return true;
    if (classes.some((c) => c.waliKelasTeacherId === t.id)) return true;
    return false;
  };

  // Filter guru yang berstatus Guru Mapel (di Ruang Kerja Sekolah, Wali Kelas tidak ditampilkan; di Ruang Kerja Individu fleksibel)
  const guruMapelList = useMemo(() => {
    const strictList = teachers.filter((t) => !isTeacherWaliKelas(t));
    if (strictList.length === 0 && isPersonalWorkspace) {
      return teachers;
    }
    return strictList;
  }, [teachers, classes, isPersonalWorkspace]);

  const activeFilterClass = useMemo(() => {
    if (selectedClassFilter === 'ALL') return null;
    return classes.find((c) => c.id === selectedClassFilter) || null;
  }, [classes, selectedClassFilter]);

  // Filtered Subjects:
  const filteredSubjects = useMemo(() => {
    return subjects.filter((sub) => {
      // Untuk Wali Kelas di Ruang Kerja Sekolah: HANYA tampilkan mata pelajaran yang ada dalam penugasannya saja
      if (isWaliKelas && !isAdmin) {
        if (!isSubjectInWaliAssignment(sub)) return false;
      }

      // Untuk Guru Mapel di Ruang Kerja Sekolah: HANYA menampilkan akun yang bersangkutan
      if (isGuruMapel && !isAdmin && !isPersonalWorkspace) {
        if (!isMySubject(sub)) return false;
      }

      // Filter tab Mapel Saya
      if (viewScopeTab === 'MY') {
        if (!isMySubject(sub)) return false;
      }

      // Filter berdasarkan Kelas
      if (selectedClassFilter !== 'ALL') {
        const targetIds = sub.targetClassIds || [];
        const targetNames = (sub.targetClassNames || []).map((n) => n.trim().toLowerCase());
        const hasIdMatch = targetIds.includes(selectedClassFilter);
        const hasNameMatch = activeFilterClass && targetNames.includes(activeFilterClass.name.trim().toLowerCase());
        const hasAttendanceMatch = attendanceRecords.some(
          (r) => r.type === 'SUBJECT' && r.subjectId === sub.id && r.classId === selectedClassFilter
        );
        const isMatchedClass = hasIdMatch || hasNameMatch || hasAttendanceMatch;
        if (!isMatchedClass) return false;
      }

      // Text search
      const q = searchTerm.toLowerCase();
      if (!q) return true;
      const matchesName = sub.name.toLowerCase().includes(q);
      const matchesCode = (sub.code || '').toLowerCase().includes(q);
      const matchesTeacher = (sub.teacherName || '').toLowerCase().includes(q);
      const matchesClasses = (sub.targetClassNames || []).some((cn) => cn.toLowerCase().includes(q));
      const matchesDays = (sub.scheduleDays || []).some((d) => d.toLowerCase().includes(q));
      return matchesName || matchesCode || matchesTeacher || matchesClasses || matchesDays;
    });
  }, [subjects, isWaliKelas, isAdmin, viewScopeTab, searchTerm, selectedClassFilter, activeFilterClass, attendanceRecords, currentUser, currentTeacher, userScope.assignedSubjectIds, waliAccessibleClassIds, waliAccessibleClassNames]);

  const openAdd = () => {
    setEditingSubject(null);
    setName('');
    setAcronym('');

    // Auto-select guru mapel yang valid (atau pemilik ruang kerja individu)
    const validCurrentTeacher =
      currentTeacher && (!isTeacherWaliKelas(currentTeacher) || isPersonalWorkspace)
        ? currentTeacher.id
        : '';
    const defaultTeacherId = validCurrentTeacher || guruMapelList[0]?.id || (isPersonalWorkspace ? 'SELF_OWNER' : '');
    setSelectedTeacherId(defaultTeacherId);

    // Default kelas terpilih: jika filter kelas spesifik aktif atau hanya ada 1 kelas, langsung centang; jika banyak kelas, biarkan bersih agar pengguna memilih yang diajar
    const initialClassIds =
      selectedClassFilter !== 'ALL'
        ? [selectedClassFilter]
        : classes.length === 1
        ? [classes[0].id]
        : [];
    setSelectedClassIds(initialClassIds);

    const initialMap: Record<string, string[]> = {};
    const initialTimes: Record<string, { startTime: string; endTime: string }> = {};
    initialClassIds.forEach((cid) => {
      initialMap[cid] = ['Senin'];
      initialTimes[cid] = { startTime: '07:30', endTime: '09:00' };
    });
    setClassSchedulesMap(initialMap);
    setClassTimesMap(initialTimes);

    setModalClassSearch('');
    setModalClassFaseFilter('ALL');
    setModalActiveTab('all');
    setOpenModal(true);
  };

  const openEdit = (sub: Subject) => {
    setEditingSubject(sub);
    setName(sub.name);
    setAcronym(sub.code || '');
    const validCurrentTeacher =
      currentTeacher && (!isTeacherWaliKelas(currentTeacher) || isPersonalWorkspace)
        ? currentTeacher.id
        : '';
    const fallbackTeacherId = validCurrentTeacher || guruMapelList[0]?.id || (isPersonalWorkspace ? 'SELF_OWNER' : '');
    setSelectedTeacherId(sub.teacherId || fallbackTeacherId);
    const cids = sub.targetClassIds || [];
    setSelectedClassIds(cids);

    const initialMap: Record<string, string[]> = {};
    const initialTimes: Record<string, { startTime: string; endTime: string }> = {};

    if (sub.classSchedules && sub.classSchedules.length > 0) {
      sub.classSchedules.forEach((cs) => {
        initialMap[cs.classId] = cs.days || [];
        initialTimes[cs.classId] = {
          startTime: cs.startTime || sub.defaultStartTime || '07:30',
          endTime: cs.endTime || sub.defaultEndTime || '09:00',
        };
      });
      cids.forEach((cid) => {
        if (!initialMap[cid]) {
          initialMap[cid] = sub.scheduleDays && sub.scheduleDays.length > 0 ? [...sub.scheduleDays] : ['Senin'];
        }
        if (!initialTimes[cid]) {
          initialTimes[cid] = {
            startTime: sub.defaultStartTime || '07:30',
            endTime: sub.defaultEndTime || '09:00',
          };
        }
      });
    } else {
      cids.forEach((cid) => {
        initialMap[cid] = sub.scheduleDays && sub.scheduleDays.length > 0 ? [...sub.scheduleDays] : ['Senin'];
        initialTimes[cid] = {
          startTime: sub.defaultStartTime || '07:30',
          endTime: sub.defaultEndTime || '09:00',
        };
      });
    }
    setClassSchedulesMap(initialMap);
    setClassTimesMap(initialTimes);

    setModalClassSearch('');
    setModalClassFaseFilter('ALL');
    setModalActiveTab('all');
    setOpenModal(true);
  };

  const toggleClassSelection = (classId: string) => {
    setSelectedClassIds((prev) => {
      const exists = prev.includes(classId);
      if (exists) {
        return prev.filter((id) => id !== classId);
      } else {
        setClassSchedulesMap((m) => {
          if (!m[classId] || m[classId].length === 0) {
            return { ...m, [classId]: ['Senin'] };
          }
          return m;
        });
        setClassTimesMap((tm) => {
          if (!tm[classId]) {
            return { ...tm, [classId]: { startTime: '07:30', endTime: '09:00' } };
          }
          return tm;
        });
        return [...prev, classId];
      }
    });
  };

  const selectAllClasses = () => {
    const allIds = classes.map((c) => c.id);
    setSelectedClassIds(allIds);
    setClassSchedulesMap((prev) => {
      const next = { ...prev };
      allIds.forEach((cid) => {
        if (!next[cid] || next[cid].length === 0) {
          next[cid] = ['Senin'];
        }
      });
      return next;
    });
    setClassTimesMap((prev) => {
      const next = { ...prev };
      allIds.forEach((cid) => {
        if (!next[cid]) {
          next[cid] = { startTime: '07:30', endTime: '09:00' };
        }
      });
      return next;
    });
  };

  const clearAllClasses = () => {
    setSelectedClassIds([]);
  };

  const toggleDayForClass = (classId: string, day: string) => {
    setClassSchedulesMap((prev) => {
      const currentDays = prev[classId] || [];
      const nextDays = currentDays.includes(day)
        ? currentDays.filter((d) => d !== day)
        : [...currentDays, day];
      return { ...prev, [classId]: nextDays };
    });
  };

  const updateTimeForClass = (classId: string, field: 'startTime' | 'endTime', value: string) => {
    setClassTimesMap((prev) => {
      const current = prev[classId] || { startTime: '07:30', endTime: '09:00' };
      return {
        ...prev,
        [classId]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  const applyBulkTimesToAllSelected = (startTime: string, endTime: string) => {
    setClassTimesMap((prev) => {
      const next = { ...prev };
      selectedClassIds.forEach((cid) => {
        next[cid] = { startTime, endTime };
      });
      return next;
    });
    showToast(`Jam KBM (${startTime} s.d. ${endTime}) diterapkan ke seluruh kelas`);
  };

  const selectClassesByFase = (fase: FaseKurikulum) => {
    const targetClasses = classes.filter((c) => getFaseByClassName(c.name) === fase);
    const targetIds = targetClasses.map((c) => c.id);
    setSelectedClassIds((prev) => Array.from(new Set([...prev, ...targetIds])));
    setClassSchedulesMap((prev) => {
      const next = { ...prev };
      targetIds.forEach((cid) => {
        if (!next[cid] || next[cid].length === 0) {
          next[cid] = ['Senin'];
        }
      });
      return next;
    });
    setClassTimesMap((prev) => {
      const next = { ...prev };
      targetIds.forEach((cid) => {
        if (!next[cid]) {
          next[cid] = { startTime: '07:30', endTime: '09:00' };
        }
      });
      return next;
    });
  };

  const copyScheduleToAllClasses = (sourceClassId: string) => {
    const sourceDays = classSchedulesMap[sourceClassId] || ['Senin'];
    const sourceTime = classTimesMap[sourceClassId] || { startTime: '07:30', endTime: '09:00' };
    setClassSchedulesMap((prev) => {
      const next = { ...prev };
      selectedClassIds.forEach((cid) => {
        next[cid] = [...sourceDays];
      });
      return next;
    });
    setClassTimesMap((prev) => {
      const next = { ...prev };
      selectedClassIds.forEach((cid) => {
        next[cid] = { ...sourceTime };
      });
      return next;
    });
    showToast(`Jadwal (${sourceDays.join(', ')} • ${sourceTime.startTime}-${sourceTime.endTime}) disalin ke semua rombel.`);
  };

  const filteredModalClasses = useMemo(() => {
    return classes.filter((cls) => {
      if (modalClassFaseFilter !== 'ALL') {
        const fase = getFaseByClassName(cls.name);
        if (fase !== modalClassFaseFilter) return false;
      }
      if (modalClassSearch.trim()) {
        const q = modalClassSearch.toLowerCase().trim();
        return cls.name.toLowerCase().includes(q);
      }
      return true;
    });
  }, [classes, modalClassFaseFilter, modalClassSearch]);

  const classesByFaseCount = useMemo(() => {
    return {
      all: classes.length,
      faseA: classes.filter((c) => getFaseByClassName(c.name) === 'Fase A').length,
      faseB: classes.filter((c) => getFaseByClassName(c.name) === 'Fase B').length,
      faseC: classes.filter((c) => getFaseByClassName(c.name) === 'Fase C').length,
    };
  }, [classes]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherId && !isPersonalWorkspace) {
      return showToast('Silakan pilih Pengajar (Guru Mapel) terlebih dahulu', 'error');
    }
    if (!name.trim()) {
      return showToast('Nama mata pelajaran wajib diisi', 'error');
    }
    if (selectedClassIds.length === 0) {
      return showToast('Pilih minimal satu kelas yang diajar pada Blok 2', 'error');
    }

    const cleanAcronym = acronym.trim().toUpperCase() || name.slice(0, 4).toUpperCase();
    const chosenTeacher =
      selectedTeacherId && selectedTeacherId !== 'SELF_OWNER'
        ? teachers.find((t) => t.id === selectedTeacherId)
        : currentTeacher || null;
    const chosenClasses = classes.filter((c) => selectedClassIds.includes(c.id));
    const targetClassNames = chosenClasses.map((c) => c.name);

    if (chosenTeacher && isTeacherWaliKelas(chosenTeacher) && !isPersonalWorkspace) {
      showToast('Guru yang dipilih berstatus Wali Kelas. Pengajar mapel harus berstatus Guru Mapel.', 'error');
      return;
    }

    const classSchedules: SubjectClassSchedule[] = selectedClassIds.map((cid) => {
      const cls = classes.find((c) => c.id === cid);
      const days = classSchedulesMap[cid] && classSchedulesMap[cid].length > 0
        ? classSchedulesMap[cid]
        : ['Senin'];
      const timeInfo = classTimesMap[cid] || { startTime: '07:30', endTime: '09:00' };
      return {
        classId: cid,
        className: cls?.name || '',
        days,
        startTime: timeInfo.startTime || '07:30',
        endTime: timeInfo.endTime || '09:00',
      };
    });

    const allUniqueDays = Array.from(new Set(classSchedules.flatMap((cs) => cs.days)));

    const payload: Omit<Subject, 'id'> = {
      name: name.trim(),
      code: cleanAcronym,
      isSpecialized: true, // Khusus guru mapel
      teacherId: chosenTeacher ? chosenTeacher.id : null,
      teacherName: chosenTeacher ? chosenTeacher.nama : (currentUser?.name || null),
      targetClassIds: selectedClassIds,
      targetClassNames,
      scheduleDays: allUniqueDays,
      classSchedules,
      defaultStartTime: classSchedules[0]?.startTime || '07:30',
      defaultEndTime: classSchedules[0]?.endTime || '09:00',
    };

    if (editingSubject) {
      await updateSubject(editingSubject.id, payload);
    } else {
      await addSubject(payload);
    }

    setOpenModal(false);
  };

  const handleConfirmDelete = async () => {
    if (!deletingSubject) return;
    await deleteSubject(deletingSubject.id);
    setDeletingSubject(null);
  };

  const isPersonalWaliKelas = isPersonalWorkspace && isWaliKelas && !isAdmin;
  const isSchoolWaliKelas = !isPersonalWorkspace && isWaliKelas && !isAdmin;

  // Ketentuan: Wali Kelas read-only, Guru Mapel akses dibuka (tambah/edit/jadwal)
  const canAdd = !isWaliKelas && (isAdmin || isGuruMapel || isPersonalWorkspace);
  const canEditSubject = (sub: Subject) => {
    if (isWaliKelas && !isAdmin) return false;
    if (isAdmin || isPersonalWorkspace) return true;
    if (isGuruMapel) return true; // Guru Mapel akses dibuka
    return false;
  };
  const canDeleteSubject = (sub: Subject) => {
    if (isWaliKelas && !isAdmin) return false;
    if (isAdmin || isPersonalWorkspace) return true;
    if (isGuruMapel && isMySubject(sub)) return true;
    return false;
  };

  return (
    <div className="space-y-6">
      {!openModal && (
        <>
          {/* Header & Add Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-xs">
            <BookOpen size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900">Data Mata Pelajaran & Guru Mapel</h2>
              {isGuruMapel && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Akses Guru Mapel
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {isGuruMapel && !isPersonalWorkspace
                ? `Menampilkan daftar mata pelajaran yang Anda ampu (${filteredSubjects.length} mata pelajaran).`
                : isWaliKelas && assignedWaliClass
                ? `Menampilkan daftar mata pelajaran yang diinput dan diajar oleh Guru Mapel untuk ${formatClassDisplay(assignedWaliClass.name)}.`
                : isGuruMapel
                ? 'Kelola mata pelajaran yang Anda ampu, tentukan rombel kelas binaan/sasaran yang diajar, dan atur hari jadwal KBM.'
                : 'Kelola mata pelajaran, penetapan guru pengajar mapel, pembagian rombel kelas yang diajar, dan jadwal KBM.'}
            </p>
          </div>
        </div>

        {canAdd && (
          <button
            onClick={openAdd}
            id="btn-tambah-mapel"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus size={15} />
            <span>Tambah Mata Pelajaran</span>
          </button>
        )}
      </div>

      {/* Info Banner untuk Guru Mapel */}
      {isGuruMapel && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50/95 via-blue-50/90 to-purple-50/90 border border-indigo-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-slate-800">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
              <Sparkles size={18} />
            </div>
            <div className="space-y-1 text-xs">
              <div className="font-extrabold text-indigo-950 text-sm flex items-center gap-2">
                <span>Panel Referensi Guru Mapel: {currentUser?.name}</span>
                {mySubjectsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-mono font-bold">
                    {mySubjectsCount} Mapel Aktif
                  </span>
                )}
              </div>
              <p className="text-slate-600 leading-relaxed max-w-3xl">
                Sebagai Guru Mata Pelajaran, Anda dapat mengelola data mata pelajaran yang Anda ajar, mengatur rombongan belajar (lintas rombel yang tersedia), serta menentukan hari jadwal KBM mingguan.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveView('absensi')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-extrabold shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <CheckSquare size={14} />
            <span>Mulai Presensi KBM</span>
          </button>
        </div>
      )}

      {/* Info Banner untuk Wali Kelas (Read-Only) */}
      {isWaliKelas && !isAdmin && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border border-blue-200/80 shadow-xs flex items-start gap-3 text-slate-800">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
            <GraduationCap size={16} />
          </div>
          <div className="space-y-1 text-xs">
            <div className="font-extrabold text-blue-950 text-sm flex items-center gap-2">
              <span>Mata Pelajaran {assignedWaliClass ? `Kelas Binaan: ${assignedWaliClass.name}` : 'Kelas Binaan'}</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold">
                Read Only (Hanya Lihat)
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Sebagai Wali Kelas, Anda memiliki akses <strong>hanya lihat (read only)</strong> untuk memantau mata pelajaran yang diajarkan oleh Guru Mata Pelajaran di kelas Anda. Penambahan dan pengelolaan mata pelajaran dilakukan langsung oleh Guru Mapel bersangkutan atau Admin Sekolah.
            </p>
          </div>
        </div>
      )}

      {/* Toolbar: Search & Scope Filter & Class Filter */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2 border-t border-slate-100">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-3xl">
          {/* Quick Scope Filter for Guru Mapel: hanya tampil di personal workspace */}
          {isGuruMapel && isPersonalWorkspace && (
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setViewScopeTab('MY')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  viewScopeTab === 'MY'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Mapel Saya ({mySubjectsCount})
              </button>
              <button
                type="button"
                onClick={() => setViewScopeTab('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  viewScopeTab === 'ALL'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Semua Mapel ({subjects.length})
              </button>
            </div>
          )}

          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari mapel, kode, pengajar, kelas, jadwal hari..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all"
            />
          </div>

          {/* Filter Kelas Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
              <Filter size={13} className="text-blue-600 shrink-0" />
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Filter Kelas:</span>
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="bg-transparent font-extrabold text-blue-900 outline-none cursor-pointer text-xs"
              >
                {isGuruMapel && !isPersonalWorkspace && !isAdmin ? (
                  <>
                    <option value="ALL">Semua Kelas Yang Diajar</option>
                    {userScope.accessibleClasses.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} ({getFaseByClassName(cls.name, cls.grade)})
                      </option>
                    ))}
                  </>
                ) : isWaliKelas && !isAdmin ? (
                  <>
                    <option value="ALL">
                      {assignedWaliClass ? `Semua Mapel ${formatClassDisplay(assignedWaliClass.name)}` : 'Semua Mapel Penugasan'}
                    </option>
                    {userScope.accessibleClasses.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} ({getFaseByClassName(cls.name, cls.grade)})
                      </option>
                    ))}
                  </>
                ) : (
                  <>
                    <option value="ALL">Semua Rombel ({subjects.length} Mapel)</option>
                    {isWaliKelas && assignedWaliClass && (
                      <option value={assignedWaliClass.id}>
                        Kelas Binaan ({assignedWaliClass.name})
                      </option>
                    )}
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} ({getFaseByClassName(cls.name, cls.grade)})
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>
        </div>

        <div className="text-xs font-bold text-slate-500 flex items-center gap-2">
          <span>
            Menampilkan: <span className="text-blue-700 font-extrabold">{filteredSubjects.length}</span>{' '}
            {isWaliKelas && !isAdmin
              ? assignedWaliClass
                ? `Mapel di ${formatClassDisplay(assignedWaliClass.name)}`
                : 'Mapel Penugasan'
              : `dari ${subjects.length} Mapel`}
          </span>
        </div>
      </div>

      {/* Grid of Subjects */}
      {filteredSubjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSubjects.map((sub) => {
            // Check input attendance by Guru Mapel for this subject (and class filter if applied)
            const mapelAttendance = attendanceRecords.filter(
              (r) =>
                r.type === 'SUBJECT' &&
                r.subjectId === sub.id &&
                (selectedClassFilter === 'ALL' ? true : r.classId === selectedClassFilter)
            );
            const inputCount = mapelAttendance.length;
            const lastRecord = mapelAttendance[mapelAttendance.length - 1];
            const isMine = isMySubject(sub);

            return (
              <div
                key={sub.id}
                className={`p-4 bg-white rounded-2xl border transition-all flex flex-col justify-between group relative overflow-hidden ${
                  isMine
                    ? 'border-indigo-200/90 shadow-sm hover:border-indigo-300 ring-1 ring-indigo-500/10'
                    : 'border-slate-200 shadow-xs hover:shadow-md'
                }`}
              >
                {/* Accent Top Strip */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    isMine
                      ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600'
                      : 'bg-gradient-to-r from-blue-500 to-indigo-600 opacity-80'
                  }`}
                />

                <div className="space-y-3.5 pt-1">
                  {/* Header Card */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="inline-block px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono text-[11px] font-black border border-blue-200">
                          {sub.code || 'MAPEL'}
                        </span>
                        {isMine && (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-extrabold border border-indigo-200">
                            Mapel Saya ✓
                          </span>
                        )}
                        {sub.isSpecialized && (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-bold border border-purple-200">
                            Guru Mapel
                          </span>
                        )}
                      </div>
                      <h3 className="font-extrabold text-slate-900 text-sm leading-snug">
                        {sub.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {canEditSubject(sub) && (
                        <button
                          onClick={() => openEdit(sub)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Mata Pelajaran & Rombel"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                      {canDeleteSubject(sub) && (
                        <button
                          onClick={() => setDeletingSubject(sub)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Mata Pelajaran"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Pengajar Mapel */}
                  <div className={`p-2.5 rounded-xl border text-xs ${
                    isMine ? 'bg-indigo-50/50 border-indigo-100' : 'bg-slate-50 border-slate-200/80'
                  }`}>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                      GURU PENGAJAR
                    </span>
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <UserCheck size={14} className={isMine ? 'text-indigo-600 shrink-0' : 'text-blue-600 shrink-0'} />
                      <span className={isMine ? 'text-indigo-950 font-black' : ''}>
                        {sub.teacherName || <span className="text-slate-400 font-normal italic">Belum ditentukan</span>}
                      </span>
                    </div>
                  </div>

                  {/* Pembagian Kelas & Jadwal Hari */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      <span>PEMBAGIAN KELAS & HARI ({sub.targetClassIds?.length || sub.targetClassNames?.length || 0} KELAS)</span>
                    </div>
                    <div className="space-y-1 max-h-44 overflow-y-auto pr-0.5">
                      {sub.targetClassIds && sub.targetClassIds.length > 0 ? (
                        sub.targetClassIds.map((cid, i) => {
                          const clsObj = classes.find((c) => c.id === cid);
                          const clsName = clsObj?.name || sub.targetClassNames?.[i] || 'Kelas';
                          const clsSched = sub.classSchedules?.find((cs) => cs.classId === cid);
                          const days = clsSched && clsSched.days && clsSched.days.length > 0
                            ? clsSched.days
                            : (sub.scheduleDays || []);
                          const isCurrentActive =
                            activeFilterClass && activeFilterClass.id === cid;

                          return (
                            <div
                              key={cid}
                              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                                isCurrentActive
                                  ? 'bg-blue-50/80 border-blue-300 ring-1 ring-blue-500/20 shadow-2xs'
                                  : 'bg-slate-50 border-slate-200/80'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                                <span className={`w-1.5 h-1.5 rounded-full ${isCurrentActive ? 'bg-blue-600' : 'bg-slate-400'}`} />
                                <span className={isCurrentActive ? 'text-blue-900 font-extrabold' : ''}>{clsName}</span>
                              </div>
                              <div className="flex flex-wrap gap-1 items-center justify-end">
                                {days.length > 0 ? (
                                  days.map((d) => (
                                    <span
                                      key={d}
                                      className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-extrabold text-[10px]"
                                    >
                                      {d}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">Belum diatur</span>
                                )}
                                {clsSched?.startTime && clsSched?.endTime && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 font-bold text-[10px]">
                                    <Clock size={10} className="text-blue-600" />
                                    <span>{clsSched.startTime} - {clsSched.endTime}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-400 italic">
                          Belum ada pembagian kelas & jadwal
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Input Data Presensi dari Guru Mapel */}
                  <div className="p-2.5 rounded-xl border text-[11px] bg-slate-50/80 border-slate-200">
                    <div className="flex items-center gap-1.5 mb-1 font-bold text-slate-700">
                      <Clock size={12} className="text-blue-600 shrink-0" />
                      <span>Status Input Presensi:</span>
                    </div>
                    {inputCount > 0 ? (
                      <div className="space-y-0.5 text-emerald-700 font-semibold text-[10px]">
                        <div className="flex items-center gap-1 font-bold">
                          <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                          <span>Sudah ada {inputCount} data presensi mapel</span>
                        </div>
                        {lastRecord && (
                          <span className="text-slate-500 block pl-4">
                            Terakhir diinput: {lastRecord.date}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Info size={11} className="shrink-0 text-slate-400" />
                        <span>
                          {activeFilterClass
                            ? `Menunggu Guru Mapel menginput presensi di ${activeFilterClass.name}`
                            : 'Belum ada catatan presensi mapel'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-blue-600 font-bold text-[10px]">
                    <Sparkles size={11} /> Terintegrasi Rombel
                  </span>

                  {!isPersonalWaliKelas && (
                    <button
                      type="button"
                      onClick={() => setActiveView('absensi')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white transition-all text-[10px] font-black cursor-pointer shadow-2xs"
                    >
                      <span>Presensi</span>
                      <CheckSquare size={11} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
          <BookOpen size={32} className="mx-auto text-slate-300 mb-2" />
          <p className="text-xs font-bold text-slate-700">
            {searchTerm
              ? 'Tidak ditemukan mata pelajaran sesuai pencarian.'
              : viewScopeTab === 'MY'
              ? 'Belum ada mata pelajaran yang tertaut dengan akun Anda. Klik tombol Tambah Mata Pelajaran untuk mendaftarkan mata pelajaran Anda.'
              : selectedClassFilter !== 'ALL' && activeFilterClass
              ? `Belum ada mata pelajaran yang diinput oleh Guru Mapel untuk ${activeFilterClass.name}.`
              : 'Belum ada mata pelajaran. Klik tombol Tambah Mata Pelajaran untuk mulai.'}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            {viewScopeTab === 'MY' && (
              <button
                onClick={() => setViewScopeTab('ALL')}
                className="text-xs font-extrabold text-indigo-600 hover:underline cursor-pointer"
              >
                Lihat Semua Mata Pelajaran
              </button>
            )}
            {selectedClassFilter !== 'ALL' && (
              <button
                onClick={() => setSelectedClassFilter('ALL')}
                className="text-xs font-extrabold text-blue-600 hover:underline cursor-pointer"
              >
                Tampilkan Semua Rombel
              </button>
            )}
          </div>
        </div>
      )}
        </>
      )}

      {/* TAMPILAN FORMULIR TAMBAH / EDIT MATA PELAJARAN LANGSUNG DI HALAMAN (TANPA POPUP) */}
      {openModal && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-200">
          {/* Top Bar Navigasi Kembali & Judul Form */}
          <div className="px-5 sm:px-6 py-4 bg-slate-50/90 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-extrabold text-slate-700 transition-colors shadow-2xs cursor-pointer shrink-0"
              >
                <ArrowLeft size={14} />
                <span>Kembali ke Daftar Mapel</span>
              </button>
              <div className="h-5 w-px bg-slate-200 hidden sm:block" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-slate-900">
                    {editingSubject ? 'Edit Mata Pelajaran & Jadwal KBM' : 'Tambah Mata Pelajaran Baru'}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black uppercase">
                    {isPersonalWorkspace ? 'Ruang Kerja Individu' : 'Ruang Kerja Sekolah'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Isi identitas mata pelajaran pada Blok 1, lalu centang kelas beserta hari & jam mengajar pada Blok 2.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 self-start sm:self-auto">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{selectedClassIds.length} Kelas Dipilih</span>
              <span className="text-slate-300">•</span>
              <span>{Array.from(new Set(selectedClassIds.flatMap((cid) => classSchedulesMap[cid] || []))).length} Hari Aktif</span>
            </div>
          </div>

          <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-6">
            {/* =====================================================================
                BLOK 1: IDENTITAS MATA PELAJARAN & GURU PENGAJAR (RINGKAS 1 BARIS)
            ===================================================================== */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    1
                  </span>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
                    Identitas Mata Pelajaran & Guru Pengajar
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">
                  Klik chip Kurikulum Merdeka di bawah untuk mengisi nama & kode otomatis
                </span>
              </div>

              {/* Pilihan Cepat (Chip 1-Klik) */}
              <div className="flex flex-wrap gap-1.5">
                {COMMON_SUBJECT_PRESETS.map((preset) => {
                  const isCurrent =
                    name.trim().toLowerCase() === preset.name.toLowerCase() ||
                    (acronym.trim().toLowerCase() === preset.code.toLowerCase() && acronym.trim() !== '') ||
                    (preset.code === 'B. Inggris' && acronym.trim().toLowerCase() === 'bing');
                  return (
                    <button
                      key={preset.code}
                      type="button"
                      title={`${preset.code} — ${preset.name}`}
                      onClick={() => {
                        setName(preset.name);
                        setAcronym(preset.code);
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer flex items-center gap-1.5 ${
                        isCurrent
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-white hover:bg-blue-50 text-slate-700 border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      <span>{preset.code}</span>
                      <span className={`text-[10px] font-medium hidden sm:inline ${isCurrent ? 'text-blue-100' : 'text-slate-400'}`}>
                        • {preset.name.length > 22 ? `${preset.name.slice(0, 22)}…` : preset.name}
                      </span>
                      {isCurrent && <Check size={12} className="shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Susunan 1 Baris (3 Kolom: Nama Mapel, Kode/Singkatan, Guru Pengajar) */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 pt-1">
                {/* Kolom 1: Nama Mata Pelajaran */}
                <div className="sm:col-span-6">
                  <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nama Mata Pelajaran <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      setName(newName);
                      if (!acronym.trim()) {
                        const matchedPreset = COMMON_SUBJECT_PRESETS.find(
                          (p) => p.name.toLowerCase() === newName.trim().toLowerCase()
                        );
                        if (matchedPreset) {
                          setAcronym(matchedPreset.code);
                        }
                      }
                    }}
                    placeholder="Contoh: Pendidikan Jasmani, Olahraga, dan Kesehatan"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all shadow-2xs"
                  />
                </div>

                {/* Kolom 2: Kode / Singkatan */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                    Kode Mapel
                  </label>
                  <input
                    type="text"
                    value={acronym}
                    onChange={(e) => setAcronym(e.target.value)}
                    placeholder="PJOK"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono font-black text-blue-700 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all shadow-2xs"
                  />
                </div>

                {/* Kolom 3: Guru Pengajar */}
                <div className="sm:col-span-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                      Guru Pengajar <span className="text-rose-500">*</span>
                    </label>
                    {currentTeacher && (!isTeacherWaliKelas(currentTeacher) || isPersonalWorkspace) && (
                      <button
                        type="button"
                        onClick={() => setSelectedTeacherId(currentTeacher.id)}
                        className="text-[10px] font-extrabold text-blue-600 hover:underline cursor-pointer"
                      >
                        Pakai Akun Saya
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <select
                      required={!isPersonalWorkspace}
                      value={selectedTeacherId}
                      onChange={(e) => setSelectedTeacherId(e.target.value)}
                      className="w-full appearance-none px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all cursor-pointer pr-9 shadow-2xs"
                    >
                      <option value="">-- Pilih Guru Mapel --</option>
                      {isPersonalWorkspace && !currentTeacher && guruMapelList.length === 0 && (
                        <option value="SELF_OWNER">
                          ★ {currentUser?.name || 'Saya (Pemilik Ruang Kerja)'}
                        </option>
                      )}
                      {currentTeacher && (!isTeacherWaliKelas(currentTeacher) || isPersonalWorkspace) && (
                        <option value={currentTeacher.id}>
                          ★ {currentTeacher.nama} (Saya)
                        </option>
                      )}
                      {guruMapelList
                        .filter(
                          (t) =>
                            t.id !==
                            (currentTeacher && (!isTeacherWaliKelas(currentTeacher) || isPersonalWorkspace)
                              ? currentTeacher.id
                              : '')
                        )
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nama} {t.nip && t.nip !== '-' ? `(${t.nip})` : ''}
                          </option>
                        ))}
                    </select>
                    <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {guruMapelList.length === 0 && !isPersonalWorkspace && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="text-amber-600 shrink-0" />
                  <span>
                    Belum ada guru berstatus <strong>Guru Mapel</strong>. Silakan tambahkan atau atur penugasan guru pada tab <strong>Data Guru</strong> terlebih dahulu.
                  </span>
                </div>
              )}
            </div>

            {/* =====================================================================
                BLOK 2: TABEL TERPADU KELAS & JADWAL KBM (1 BARIS PER KELAS — TANPA POPUP)
            ===================================================================== */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5 space-y-4">
              {/* Header Blok 2 */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    2
                  </span>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
                    Pilih Rombel Kelas & Jadwal KBM Terpadu
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-black">
                    {selectedClassIds.length} dari {classes.length} Kelas Dicentang
                  </span>
                </div>

                {/* Tombol Pilih Cepat Rombel */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                  <button
                    type="button"
                    onClick={selectAllClasses}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors shadow-2xs"
                  >
                    Pilih Semua ({classes.length})
                  </button>
                  {classesByFaseCount.faseA > 0 && (
                    <button
                      type="button"
                      onClick={() => selectClassesByFase('Fase A')}
                      className="px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 cursor-pointer transition-colors shadow-2xs"
                    >
                      + Fase A ({classesByFaseCount.faseA})
                    </button>
                  )}
                  {classesByFaseCount.faseB > 0 && (
                    <button
                      type="button"
                      onClick={() => selectClassesByFase('Fase B')}
                      className="px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 cursor-pointer transition-colors shadow-2xs"
                    >
                      + Fase B ({classesByFaseCount.faseB})
                    </button>
                  )}
                  {classesByFaseCount.faseC > 0 && (
                    <button
                      type="button"
                      onClick={() => selectClassesByFase('Fase C')}
                      className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 cursor-pointer transition-colors shadow-2xs"
                    >
                      + Fase C ({classesByFaseCount.faseC})
                    </button>
                  )}
                  {selectedClassIds.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAllClasses}
                      className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors shadow-2xs"
                    >
                      Reset Pilihan
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Pencarian Kelas & Preset Jam Serentak */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={modalClassSearch}
                      onChange={(e) => setModalClassSearch(e.target.value)}
                      placeholder="Cari kelas (misal: 1A, 4, 6)..."
                      className="w-full pl-8.5 pr-7 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-600 outline-none shadow-2xs"
                    />
                    {modalClassSearch && (
                      <button
                        type="button"
                        onClick={() => setModalClassSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shrink-0">
                    {(['ALL', 'Fase A', 'Fase B', 'Fase C'] as const).map((fase) => (
                      <button
                        key={fase}
                        type="button"
                        onClick={() => setModalClassFaseFilter(fase)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                          modalClassFaseFilter === fase
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {fase === 'ALL' ? 'Semua' : fase}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preset Jam KBM Serentak */}
                {selectedClassIds.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-500 font-bold">Samakan Jam KBM:</span>
                    {[
                      { label: '07:30 - 09:00', start: '07:30', end: '09:00' },
                      { label: '09:15 - 10:45', start: '09:15', end: '10:45' },
                      { label: '10:00 - 11:30', start: '10:00', end: '11:30' },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => applyBulkTimesToAllSelected(preset.start, preset.end)}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-600 hover:text-white text-blue-800 font-bold border border-blue-200 text-[11px] cursor-pointer transition-all shadow-2xs"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tabel / Daftar Terpadu 1 Baris per Kelas */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                {/* Header Kolom Tabel (Desktop) */}
                <div className="hidden lg:grid lg:grid-cols-12 gap-3 px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  <div className="col-span-3">Rombel Kelas</div>
                  <div className="col-span-5">Hari Mengajar (Klik Hari)</div>
                  <div className="col-span-4 text-right">Jam Pelajaran (KBM)</div>
                </div>

                {filteredModalClasses.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {filteredModalClasses.map((cls) => {
                      const isSelected = selectedClassIds.includes(cls.id);
                      const fase = getFaseByClassName(cls.name);
                      const faseBadge = getFaseBadgeColor(fase);
                      const currentDays = classSchedulesMap[cls.id] || [];
                      const currentTime = classTimesMap[cls.id] || { startTime: '07:30', endTime: '09:00' };

                      return (
                        <div
                          key={cls.id}
                          className={`px-4 py-3 transition-colors grid grid-cols-1 lg:grid-cols-12 gap-3 items-center ${
                            isSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/80'
                          }`}
                        >
                          {/* Kolom Kiri: Checkbox + Nama Kelas + Fase */}
                          <div className="lg:col-span-3 flex items-center justify-between lg:justify-start gap-2.5">
                            <label className="flex items-center gap-2.5 cursor-pointer select-none min-w-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleClassSelection(cls.id)}
                                className="w-4 h-4 rounded text-blue-600 accent-blue-600 cursor-pointer shrink-0"
                              />
                              <span
                                className={`text-xs sm:text-sm font-black truncate ${
                                  isSelected ? 'text-blue-950' : 'text-slate-700'
                                }`}
                              >
                                {cls.name}
                              </span>
                            </label>
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border shrink-0 ${faseBadge.bg}`}
                            >
                              {fase}
                            </span>
                          </div>

                          {/* Kolom Tengah: Pilihan Hari Mengajar Langsung di Baris Ini */}
                          <div className="lg:col-span-5">
                            {isSelected ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {DAYS_LIST.map((day) => {
                                  const isChecked = currentDays.includes(day);
                                  return (
                                    <button
                                      key={day}
                                      type="button"
                                      onClick={() => toggleDayForClass(cls.id, day)}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border transition-all cursor-pointer flex items-center gap-1 ${
                                        isChecked
                                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                      }`}
                                    >
                                      <span>{day}</span>
                                      {isChecked && <Check size={11} className="shrink-0" />}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleClassSelection(cls.id)}
                                className="text-xs text-slate-400 hover:text-blue-600 italic cursor-pointer text-left transition-colors"
                              >
                                Centang kelas ini untuk mengatur hari & jam KBM →
                              </button>
                            )}
                          </div>

                          {/* Kolom Kanan: Jam KBM & Tombol Salin ke Semua */}
                          <div className="lg:col-span-4 flex items-center justify-start lg:justify-end gap-2 flex-wrap">
                            {isSelected ? (
                              <>
                                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                                  <Clock size={12} className="text-blue-600 shrink-0" />
                                  <input
                                    type="time"
                                    value={currentTime.startTime || '07:30'}
                                    onChange={(e) => updateTimeForClass(cls.id, 'startTime', e.target.value)}
                                    className="bg-transparent font-bold text-slate-900 text-xs outline-none cursor-pointer"
                                    title="Jam Mulai KBM"
                                  />
                                  <span className="text-slate-400 text-[11px] font-bold">-</span>
                                  <input
                                    type="time"
                                    value={currentTime.endTime || '09:00'}
                                    onChange={(e) => updateTimeForClass(cls.id, 'endTime', e.target.value)}
                                    className="bg-transparent font-bold text-slate-900 text-xs outline-none cursor-pointer"
                                    title="Jam Selesai KBM"
                                  />
                                </div>

                                {selectedClassIds.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => copyScheduleToAllClasses(cls.id)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-blue-600 hover:text-white text-slate-600 border border-slate-200 text-[11px] font-bold cursor-pointer transition-all shadow-2xs"
                                    title={`Salin hari & jam ${cls.name} ke semua kelas yang dicentang`}
                                  >
                                    <Copy size={11} />
                                    <span>Salin ke Semua</span>
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-300 font-semibold hidden lg:inline">
                                Nonaktif
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs space-y-1">
                    <Info size={20} className="mx-auto text-slate-300 mb-1" />
                    <p className="font-bold text-slate-600">Tidak ada kelas yang sesuai pencarian/filter.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Simpan & Batal */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-700 text-xs flex-wrap">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span className="font-black text-slate-900">
                  {name ? `${name} (${acronym.trim().toUpperCase() || 'MAPEL'})` : 'Mata Pelajaran Baru'}
                </span>
                <span className="text-slate-400">•</span>
                <span>
                  <strong className="text-blue-700">{selectedClassIds.length}</strong> Rombel Kelas Terpilih
                </span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setOpenModal(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-black shadow-md shadow-blue-600/20 transition-all cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle2 size={15} />
                  <span>{editingSubject ? 'Simpan Perubahan Mata Pelajaran' : 'Simpan Mata Pelajaran & Jadwal'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Modal Hapus Mapel Komersial & Responsif */}
      {deletingSubject && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 text-center animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4 shadow-2xs">
              <Trash2 size={28} />
            </div>
            <h3 className="font-black text-slate-900 text-lg sm:text-xl mb-2">
              Hapus Mata Pelajaran?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
              Anda yakin ingin menghapus mata pelajaran <strong className="text-slate-900 font-extrabold">{deletingSubject.name}</strong> ({deletingSubject.code}) beserta seluruh alokasi jadwal rombel yang tertaut? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeletingSubject(null)}
                className="px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-6 py-2.5 text-xs sm:text-sm font-black text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-xl shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                Ya, Hapus Mapel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
