import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Teacher } from '../types';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Search,
  UsersRound,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Lock,
  FileSpreadsheet,
  UploadCloud,
  FileText,
  Download,
  Check,
  AlertCircle,
  GraduationCap,
  BookOpen,
  UserCog,
  Info
} from 'lucide-react';
import { validateTeacherRoleAssignment } from '../utils/packageSystem';
import { supabase } from '../lib/supabase';
import { BookLoadingModal } from '../components/BookLoader';
import { normalizeTeacherName, normalizeNip } from '../utils/userScope';
import { formatHomeroomDutyLabel, formatSubjectTeacherDutyLabel } from '../utils/formatTeacherTitle';
import {
  parseImportDocument,
  mapRowsToTeachers,
  downloadTeacherTemplateFile,
  ParsedTeacherItem,
} from '../utils/documentParser';

export const DataGuruView: React.FC = () => {
  const {
    currentUser,
    teachers,
    users,
    classes,
    subjects,
    schoolProfile,
    addTeacher,
    updateTeacher,
    deleteTeacher,
    updateClass,
    importTeachers,
    executeTeacherAssignment,
    addUser,
    showToast,
    activeWorkspace,
    loadData,
    requestFeatureAccess,
  } = useApp();

  const isPersonalWorkspace =
    activeWorkspace?.workspaceType === 'personal' ||
    activeWorkspace?.workspaceType === 'individu' ||
    (currentUser?.subscriptionPlan === 'mulai' && !currentUser?.schoolId);

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  const isWaliKelas = currentUser?.role === 'WALI KELAS';
  const isGuruMapel = currentUser?.role === 'GURU MAPEL';

  const isGuruPro =
    activeWorkspace?.subscriptionPlan === 'guru_pro' ||
    currentUser?.subscriptionPlan === 'guru_pro' ||
    activeWorkspace?.subscription?.plan === 'guru_pro' ||
    activeWorkspace?.subscriptionPlan === 'sekolah_pro' ||
    currentUser?.subscriptionPlan === 'sekolah_pro' ||
    activeWorkspace?.subscription?.plan === 'sekolah_pro' ||
    isAdmin;

  const isFreePlan = !isGuruPro;

  const canAdd = isAdmin || isPersonalWorkspace;
  const canEdit = isAdmin || isPersonalWorkspace;
  const canDelete = isAdmin || isPersonalWorkspace;

  const [searchTerm, setSearchTerm] = useState('');
  const [teacherScopeFilter, setTeacherScopeFilter] = useState<'all' | 'my'>('all');
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [deleting, setDeleting] = useState<Teacher | null>(null);
  const [isDeletingTeacher, setIsDeletingTeacher] = useState(false);
  const [open, setOpen] = useState(false);

  // Assignment Modal for Admin Sekolah
  const [assigningTeacher, setAssigningTeacher] = useState<Teacher | null>(null);
  const [assignRoleType, setAssignRoleType] = useState<'NONE' | 'WALI_KELAS' | 'GURU_MAPEL'>('NONE');
  const [assignWaliClassId, setAssignWaliClassId] = useState<string>('');
  const [assignSubjectId, setAssignSubjectId] = useState<string>('');
  const [assignMapelClassIds, setAssignMapelClassIds] = useState<string[]>([]);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);

  // Quick Create Account Modal State
  const [accountTeacher, setAccountTeacher] = useState<Teacher | null>(null);
  const [accountUsername, setAccountUsername] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountRole, setAccountRole] = useState<'GURU MAPEL' | 'WALI KELAS'>('WALI KELAS');
  const [accountClassId, setAccountClassId] = useState('');
  const [accountClassIds, setAccountClassIds] = useState<string[]>([]);
  const [accountSubjectId, setAccountSubjectId] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  const [nama, setNama] = useState('');
  const [nip, setNip] = useState('');
  const [jenisKelamin, setJenisKelamin] = useState<'L' | 'P'>('L');

  // Tugas Utama state in Add/Edit Teacher Modal (hanya 2: Wali Kelas dan Guru Mapel)
  const [modalRoleType, setModalRoleType] = useState<'WALI_KELAS' | 'GURU_MAPEL'>('WALI_KELAS');
  const [modalWaliClassId, setModalWaliClassId] = useState<string>('');
  const [modalSubjectId, setModalSubjectId] = useState<string>('');
  const [modalMapelClassIds, setModalMapelClassIds] = useState<string[]>([]);

  // Import Guru Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTab, setImportTab] = useState<'upload' | 'paste'>('upload');
  const [fileName, setFileName] = useState('');
  const [detectedDocType, setDetectedDocType] = useState<string>('');
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsedTeachers, setParsedTeachers] = useState<ParsedTeacherItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatusMessage, setImportStatusMessage] = useState('');

  // Helper to get detailed assignment info for a teacher based on actual assignments & role
  const getTeacherAssignmentDetails = (t: Teacher) => {
    if (!t) {
      return {
        type: 'Belum Ditugaskan' as const,
        label: 'BELUM DITUGASKAN',
        badgeColor: 'bg-slate-100 text-slate-600 border-slate-200',
        badges: [
          {
            type: 'Belum Ditugaskan' as const,
            label: 'BELUM DITUGASKAN',
            badgeColor: 'bg-slate-100 text-slate-600 border-slate-200',
          },
        ],
      };
    }

    const homeroomClasses = (classes || []).filter(
      (c) => c.waliKelasTeacherId === t.id
    );

    const assignedSubjects = (subjects || []).filter(
      (s) => s.teacherId === t.id
    );

    const badges: Array<{
      type: 'Wali Kelas' | 'Guru Mapel' | 'Belum Ditugaskan';
      label: string;
      title?: string;
      badgeColor: string;
    }> = [];

    const savedRegRole = localStorage.getItem('kawacanaan_last_registered_role');
    const rawDuty = (t.tugasUtama || t.tugas_utama || '').trim().toLowerCase();
    const isExplicitMapel =
      rawDuty.includes('mapel') ||
      rawDuty.includes('pelajaran') ||
      (isPersonalWorkspace && (isGuruMapel || savedRegRole === 'GURU MAPEL'));
    const isExplicitWali =
      rawDuty.includes('wali') ||
      (isPersonalWorkspace && (isWaliKelas || savedRegRole === 'WALI KELAS'));

    // Jika di ruang kerja individu dan peran eksplisit adalah Guru Mapel, utamakan Guru Mapel
    if (isPersonalWorkspace && isExplicitMapel && !rawDuty.includes('wali')) {
      if (assignedSubjects.length > 0) {
        const seenDutyLabels = new Set<string>();
        assignedSubjects.forEach((sub) => {
          const dutyLabel = formatSubjectTeacherDutyLabel(sub.name, sub.code);
          const targetNames = (sub.targetClassIds || [])
            .map((cid) => (classes || []).find((c) => c.id === cid)?.name || '')
            .filter(Boolean);
          const tooltipText = targetNames.length > 0
            ? `${sub.name} (Kelas: ${targetNames.join(', ')})`
            : sub.name;

          if (!seenDutyLabels.has(dutyLabel)) {
            seenDutyLabels.add(dutyLabel);
            badges.push({
              type: 'Guru Mapel',
              label: dutyLabel,
              title: tooltipText,
              badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
            });
          }
        });
      }
      if (badges.length === 0) {
        badges.push({
          type: 'Guru Mapel',
          label: 'Guru Mapel',
          title: 'Guru Mapel (Mata Pelajaran)',
          badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
        });
      }
    } else {
      // Prioritas 1: Rombel aktif Wali Kelas atau status eksplisit Wali Kelas (Eksklusif: 1 Guru = 1 Rombel)
      const isWali =
        homeroomClasses.length > 0 ||
        isExplicitWali ||
        (isPersonalWorkspace && isWaliKelas && (t.id === currentUser?.teacherId || normalizeTeacherName(t.nama) === normalizeTeacherName(currentUser?.name)));

      if (homeroomClasses.length > 0) {
        const activeYear = schoolProfile?.tahunPelajaran || '2026/2027';
        const yearMatchingClasses = homeroomClasses.filter((hc) => !hc.academicYear || hc.academicYear === activeYear);
        const effectiveClass = yearMatchingClasses.length > 0 ? yearMatchingClasses[yearMatchingClasses.length - 1] : homeroomClasses[homeroomClasses.length - 1];
        badges.push({
          type: 'Wali Kelas',
          label: formatHomeroomDutyLabel(effectiveClass.name),
          title: `Wali Kelas untuk ${effectiveClass.name}`,
          badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        });
      } else if (isWali) {
        badges.push({
          type: 'Wali Kelas',
          label: 'Wali Kelas',
          title: 'Wali Kelas',
          badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        });
      }

      // Prioritas 2: Penugasan Mapel aktif atau status eksplisit Guru Mapel
      const isMapel =
        assignedSubjects.length > 0 ||
        isExplicitMapel;

      if (assignedSubjects.length > 0 && badges.length === 0) {
        const seenDutyLabels = new Set<string>();
        assignedSubjects.forEach((sub) => {
          const dutyLabel = formatSubjectTeacherDutyLabel(sub.name, sub.code);
          const targetNames = (sub.targetClassIds || [])
            .map((cid) => (classes || []).find((c) => c.id === cid)?.name || '')
            .filter(Boolean);
          const tooltipText = targetNames.length > 0
            ? `${sub.name} (Kelas: ${targetNames.join(', ')})`
            : sub.name;

          if (!seenDutyLabels.has(dutyLabel)) {
            seenDutyLabels.add(dutyLabel);
            badges.push({
              type: 'Guru Mapel',
              label: dutyLabel,
              title: tooltipText,
              badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
            });
          }
        });
      } else if (isMapel && badges.length === 0) {
        badges.push({
          type: 'Guru Mapel',
          label: 'Guru Mapel',
          title: 'Guru Mapel (Belum ada mapel terhubung)',
          badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
        });
      }
    }

    // Default mutlak: BELUM DITUGASKAN
    if (badges.length === 0) {
      badges.push({
        type: 'Belum Ditugaskan',
        label: 'BELUM DITUGASKAN',
        title: 'Pendidik belum ditentukan tugas utamanya',
        badgeColor: 'bg-slate-100 text-slate-600 border-slate-200',
      });
    }

    return {
      type: badges[0].type,
      label: badges.map((b) => b.label).join(', '),
      badgeColor: badges[0].badgeColor,
      badges,
    };
  };

  const baseTeacherList = useMemo(() => {
    const savedRegName = localStorage.getItem('kawacanaan_last_registered_name');
    const effectiveName =
      (currentUser?.name && currentUser.name !== 'Pengguna' && currentUser.name !== 'Guru')
        ? currentUser.name
        : (savedRegName || (teachers && teachers[0]?.nama && teachers[0].nama !== 'Pengguna' ? teachers[0].nama : 'Pendidik'));

    // Ruang Kerja Individu: selalu 1 guru mandiri
    if (isPersonalWorkspace) {
      const cleanUserName = normalizeTeacherName(effectiveName);
      const userNip = normalizeNip(currentUser?.nip) || (/^\d{8,}$/.test(currentUser?.username || '') ? normalizeNip(currentUser?.username) : '');
      const savedRegRole = localStorage.getItem('kawacanaan_last_registered_role');
      const isRegisteredMapel = isGuruMapel || savedRegRole === 'GURU MAPEL';
      const expectedDuty = isRegisteredMapel ? 'Guru Mapel' : 'Wali Kelas';

      const found = (teachers || []).find((t) => {
        if (currentUser?.teacherId && t.id === currentUser.teacherId) return true;
        if (userNip && normalizeNip(t.nip) === userNip) return true;
        if (cleanUserName && normalizeTeacherName(t.nama) === cleanUserName) return true;
        return false;
      }) || (teachers && teachers[0]);

      if (found) {
        const rawTugas = (found.tugasUtama || found.tugas_utama || '').trim();
        const effectiveDuty = (rawTugas && rawTugas !== 'Belum ditugaskan') ? rawTugas : expectedDuty;
        return [{
          ...found,
          nama: (found.nama && found.nama !== 'Pengguna' && found.nama !== 'Guru') ? found.nama : effectiveName,
          nip: (found.nip && found.nip !== '-') ? found.nip : (userNip || currentUser?.nip || '-'),
          jabatan: found.jabatan || effectiveDuty,
          tugasUtama: effectiveDuty,
          tugas_utama: effectiveDuty,
        }];
      }
      return [
        {
          id: currentUser?.teacherId || currentUser?.id || 'teacher-self',
          nama: effectiveName,
          nip: userNip || currentUser?.nip || '-',
          jenisKelamin: 'L' as const,
          jabatan: expectedDuty,
          tugasUtama: expectedDuty,
          tugas_utama: expectedDuty,
        },
      ];
    }

    // Ruang Kerja Sekolah: Data dewan guru sekolah terintegrasi dari Admin Sekolah
    const cleanUserName = normalizeTeacherName(effectiveName);
    const userNip = normalizeNip(currentUser?.nip) || (/^\d{8,}$/.test(currentUser?.username || '') ? normalizeNip(currentUser?.username) : '');
    const userExpectedDuty = isWaliKelas ? 'Wali Kelas' : (isGuruMapel ? 'Guru Mapel' : undefined);

    // Pastikan data guru yang terhubung dengan akun saat ini memiliki NIP valid & nama benar
    const allEnrichedTeachers = (teachers || []).map((t) => {
      const isMatch =
        (currentUser?.teacherId && t.id === currentUser.teacherId) ||
        (userNip && normalizeNip(t.nip) === userNip) ||
        (cleanUserName && normalizeTeacherName(t.nama) === cleanUserName);

      if (isMatch) {
        return {
          ...t,
          nama: (t.nama && t.nama !== 'Pengguna' && t.nama !== 'Guru') ? t.nama : effectiveName,
          nip: (t.nip && t.nip !== '-') ? t.nip : (userNip || currentUser?.nip || t.nip || '-'),
          tugasUtama: t.tugasUtama || userExpectedDuty || t.tugas_utama,
          tugas_utama: t.tugas_utama || userExpectedDuty || t.tugasUtama,
        };
      }
      return t;
    });

    // Ruang Kerja Sekolah: Untuk Wali Kelas dan Guru Mapel, HANYA tampilkan akun/data guru yang bersangkutan saja
    if ((isWaliKelas || isGuruMapel) && !isAdmin) {
      const myOnly = allEnrichedTeachers.filter((t) => {
        if (currentUser?.teacherId && t.id === currentUser.teacherId) return true;
        if (userNip && normalizeNip(t.nip) === userNip) return true;
        if (cleanUserName && normalizeTeacherName(t.nama) === cleanUserName) return true;
        return false;
      });
      if (myOnly.length > 0) return myOnly;
      if (currentUser) {
        const defaultDuty = isGuruMapel ? 'Guru Mapel' : 'Wali Kelas';
        return [
          {
            id: currentUser.teacherId || currentUser.id || 'teacher-self',
            nama: effectiveName,
            nip: userNip || currentUser.nip || '-',
            jenisKelamin: ((currentUser as any)?.jenisKelamin || (currentUser as any)?.gender || 'L') as 'L' | 'P',
            jabatan: defaultDuty,
            tugasUtama: defaultDuty,
            tugas_utama: defaultDuty,
          },
        ];
      }
    }

    return allEnrichedTeachers;
  }, [isAdmin, isWaliKelas, isGuruMapel, isPersonalWorkspace, teachers, currentUser]);

  const filteredTeachers = useMemo(() => {
    const q = (searchTerm || '').trim().toLowerCase();
    if (!q) return baseTeacherList;
    return baseTeacherList.filter((t) => {
      if (!t) return false;
      const namaMatch = (t.nama || '').toLowerCase().includes(q);
      const nipMatch = (t.nip || '').toLowerCase().includes(q);
      const assign = getTeacherAssignmentDetails(t);
      const roleMatch =
        (assign.label || '').toLowerCase().includes(q) ||
        (assign.type || '').toLowerCase().includes(q);
      return namaMatch || nipMatch || roleMatch;
    });
  }, [baseTeacherList, searchTerm, classes, subjects, users]);

  // Helper untuk mengecek akun guru
  const getTeacherAccount = (t: Teacher) => {
    if (!t) return undefined;
    const teacherNip = (t.nip || '').trim().toLowerCase();
    const teacherName = (t.nama || '').trim().toLowerCase();
    return (users || []).find(
      (u) =>
        (teacherNip && teacherNip !== '-' && (u.username || '').toLowerCase() === teacherNip) ||
        ((u.name || '').trim().toLowerCase() === teacherName && teacherName.length > 0)
    );
  };

  const resetForm = () => {
    setNama('');
    setNip('');
    setJenisKelamin('L');
    setModalRoleType('WALI_KELAS');
    setModalWaliClassId('');
    setModalSubjectId('');
    setModalMapelClassIds([]);
  };

  const openAdd = () => {
    if (isFreePlan && baseTeacherList.length >= 1) {
      if (
        !requestFeatureAccess(
          'data_guru',
          'Manajemen Dewan Guru',
          'Fitur ini tersedia di Paket Guru. Upgrade sekarang untuk akses penuh: tambah kelas, laporan lengkap, dan manajemen guru.'
        )
      ) {
        return;
      }
    }
    setEditing(null);
    resetForm();
    setOpen(true);
  };

  const openEdit = (t: Teacher) => {
    setEditing(t);
    setNama(t.nama);
    setNip(t.nip);
    setJenisKelamin(t.jenisKelamin);

    // Initial state for Tugas Utama in edit modal based on assignments and current teacher role
    const homeroomClass = classes.find((c) => c.waliKelasTeacherId === t.id);
    const normTugas = (t.tugasUtama || t.tugas_utama || '').trim().toLowerCase();
    const savedRegRole = localStorage.getItem('kawacanaan_last_registered_role');

    let initialRoleType: 'WALI_KELAS' | 'GURU_MAPEL' = 'WALI_KELAS';
    if (isPersonalWorkspace) {
      if (normTugas.includes('mapel') || isGuruMapel || savedRegRole === 'GURU MAPEL') {
        initialRoleType = 'GURU_MAPEL';
      } else {
        initialRoleType = 'WALI_KELAS';
      }
    } else {
      if (homeroomClass || normTugas.includes('wali')) {
        initialRoleType = 'WALI_KELAS';
      } else if (normTugas.includes('mapel')) {
        initialRoleType = 'GURU_MAPEL';
      } else {
        initialRoleType = 'WALI_KELAS';
      }
    }

    setModalRoleType(initialRoleType);
    setModalWaliClassId(homeroomClass ? homeroomClass.id : '');

    setOpen(true);
  };

  const openAssignModal = (t: Teacher) => {
    setAssigningTeacher(t);
    const homeroomClass = classes.find((c) => c.waliKelasTeacherId === t.id);
    const assignedSubject = subjects.find((s) => s.teacherId === t.id);
    const normTugas = (t.tugasUtama || t.tugas_utama || '').trim().toLowerCase();

    if (homeroomClass || normTugas.includes('wali')) {
      setAssignRoleType('WALI_KELAS');
      setAssignWaliClassId(homeroomClass ? homeroomClass.id : '');
    } else {
      setAssignRoleType('GURU_MAPEL');
      setAssignWaliClassId('');
    }
  };

  const handleSaveDirectAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningTeacher) return;
    setIsSavingAssignment(true);
    try {
      await executeTeacherAssignment(
        assigningTeacher.id,
        assignRoleType
      );
      setAssigningTeacher(null);
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan penugasan guru', 'error');
    } finally {
      setIsSavingAssignment(false);
    }
  };

  const openCreateAccountModal = (t: Teacher) => {
    setAccountTeacher(t);
    const cleanNip = (t.nip || '').trim();
    const defaultUsername = cleanNip && cleanNip !== '-' 
      ? cleanNip.toLowerCase().replace(/[^a-z0-9]/g, '')
      : t.nama.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);
    
    // Cari apakah guru ini ditugaskan di salah satu Data Kelas
    const matchedClass = classes.find(
      (c) => c.waliKelasTeacherId === t.id || (c.waliKelasName && c.waliKelasName.trim().toLowerCase() === t.nama.trim().toLowerCase())
    );

    const assignedSubject = subjects.find((sub) => sub.teacherId === t.id && (sub.targetClassIds || []).length > 0);
    const isWali = !!matchedClass;
    setAccountUsername(defaultUsername);
    setAccountPassword('123456');
    setAccountEmail('');
    setAccountRole(isWali ? 'WALI KELAS' : 'GURU MAPEL');
    setAccountClassId(matchedClass ? matchedClass.id : '');
    setAccountClassIds(assignedSubject?.targetClassIds || (matchedClass ? [matchedClass.id] : []));
    setAccountSubjectId(assignedSubject?.id || '');
  };

  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountTeacher || !accountUsername.trim() || !accountPassword.trim()) return;
    if (accountRole === 'GURU MAPEL') {
      if (!accountSubjectId) {
        showToast('Guru Mapel harus ditetapkan ke Mata Pelajaran terlebih dahulu.', 'error');
        return;
      }
      if (accountClassIds.length === 0) {
        showToast('Guru Mapel harus mempunyai minimal satu kelas yang diajar.', 'error');
        return;
      }
      const chosenSubject = subjects.find((s) => s.id === accountSubjectId);
      if (chosenSubject?.teacherId && chosenSubject.teacherId !== accountTeacher.id) {
        showToast('Mata Pelajaran tersebut sudah ditugaskan kepada guru lain. Pilih mapel yang belum dimiliki guru lain.', 'error');
        return;
      }
    }

    // Validate role exclusivity
    const targetRole = accountRole === 'WALI KELAS' ? 'wali_kelas' : 'guru_mapel';
    const validation = validateTeacherRoleAssignment(
      accountTeacher.id,
      targetRole,
      classes,
      subjects,
      schoolProfile.tahunPelajaran
    );

    if (!validation.valid) {
      showToast(validation.errorMessage || 'Konflik peran guru terdeteksi.', 'error');
      return;
    }

    setIsCreatingAccount(true);
    try {
      await addUser({
        name: accountTeacher.nama.trim(),
        username: accountUsername.trim().toLowerCase(),
        password: accountPassword.trim(),
        email: accountEmail.trim() || null,
        role: accountRole,
        classIds: accountRole === 'GURU MAPEL' ? accountClassIds : (accountClassId ? [accountClassId] : []),
        subjectId: accountRole === 'GURU MAPEL' ? accountSubjectId : null,
        subjectName: accountRole === 'GURU MAPEL' ? (subjects.find((s) => s.id === accountSubjectId)?.name || null) : null,
      });
      setAccountTeacher(null);
    } catch (err: any) {
      showToast(err.message || 'Gagal membuat akun', 'error');
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) return showToast('Nama guru wajib diisi', 'error');

    if (!editing && isFreePlan && baseTeacherList.length >= 1) {
      requestFeatureAccess(
        'data_guru',
        'Manajemen Dewan Guru',
        'Fitur ini tersedia di Paket Guru. Upgrade sekarang untuk akses penuh: tambah kelas, laporan lengkap, dan manajemen guru.'
      );
      return;
    }

    const payload = {
      nama: nama.trim(),
      nip: nip.trim(),
      jenisKelamin,
      tugasUtama: modalRoleType === 'WALI_KELAS' ? 'Wali Kelas' : modalRoleType === 'GURU_MAPEL' ? 'Guru Mapel' : 'Belum ditugaskan',
      tugas_utama: modalRoleType === 'WALI_KELAS' ? 'Wali Kelas' : modalRoleType === 'GURU_MAPEL' ? 'Guru Mapel' : 'Belum ditugaskan',
      mataPelajaran: '',
    };

    try {
      let targetTeacherId = editing?.id;
      if (editing) {
        await updateTeacher(editing.id, payload);
      } else {
        const created = await addTeacher(payload);
        targetTeacherId = (created as any)?.id;
      }

      // Sinkronkan peran saat ini jika ini personal workspace
      if (isPersonalWorkspace) {
        const newRole = modalRoleType === 'WALI_KELAS' ? 'WALI KELAS' : 'GURU MAPEL';
        localStorage.setItem('kawacanaan_last_registered_role', newRole);
        if (currentUser) {
          currentUser.role = newRole;
        }
        if (targetTeacherId && classes.length > 0) {
          const firstCls = classes[0];
          if (modalRoleType === 'WALI_KELAS' && firstCls.waliKelasTeacherId !== targetTeacherId) {
            await updateClass(firstCls.id, {
              ...firstCls,
              waliKelasTeacherId: targetTeacherId,
              waliKelasName: nama.trim(),
            });
          } else if (modalRoleType === 'GURU_MAPEL' && firstCls.waliKelasTeacherId === targetTeacherId) {
            await updateClass(firstCls.id, {
              ...firstCls,
              waliKelasTeacherId: null,
              waliKelasName: null,
            });
          }
        }
      }

      // If in school workspace as Admin and penugasan is configured in modal
      if (isAdmin && !isPersonalWorkspace && targetTeacherId && modalRoleType) {
        await executeTeacherAssignment(
          targetTeacherId,
          modalRoleType
        );
      }

      setOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan data guru', 'error');
    }
  };

  const removeTeacher = async () => {
    if (!deleting || isDeletingTeacher) return;
    setIsDeletingTeacher(true);
    try {
      await deleteTeacher(deleting.id);
      setDeleting(null);
    } catch {
      // Error handling and toast are handled inside deleteTeacher
    } finally {
      setIsDeletingTeacher(false);
    }
  };

  // Download Template Guru (Excel atau CSV)
  const handleDownloadTemplate = (format: 'xlsx' | 'csv' = 'xlsx') => {
    downloadTeacherTemplateFile(format);
    showToast(
      `Template file ${format === 'xlsx' ? 'Excel (.xlsx)' : 'CSV (.csv)'} Guru berhasil diunduh. Silakan lengkapi dan unggah kembali.`,
      'success'
    );
  };

  const processTeacherFile = async (file: File) => {
    setFileName(file.name);
    setIsParsingFile(true);

    try {
      const docResult = await parseImportDocument(file);
      const parsed = mapRowsToTeachers(docResult.rows, docResult.rawText);
      setParsedTeachers(parsed);

      let typeName = 'File';
      if (docResult.fileType === 'excel') typeName = 'Excel (.xlsx / .xls)';
      else if (docResult.fileType === 'docx') typeName = 'Word (.docx)';
      else if (docResult.fileType === 'pdf') typeName = 'Dokumen PDF (.pdf)';
      else if (docResult.fileType === 'csv') typeName = 'File CSV (.csv)';

      setDetectedDocType(typeName);

      if (parsed.length === 0) {
        showToast(
          `Tidak ada data guru yang terbaca dari ${file.name}. Pastikan file berisi tabel guru dengan kolom Nama, NIP/NUPTK, Jenis Kelamin, dan Tugas Utama.`,
          'error'
        );
      } else {
        showToast(
          `Berhasil membaca ${parsed.length} baris data guru dari format ${typeName} (${file.name})`,
          'success'
        );
      }
    } catch (err: any) {
      console.error('[DataGuruView] Error parsing file:', err);
      showToast(
        `Gagal membaca file: ${err?.message || 'Pastikan file tidak terkunci atau rusak'}`,
        'error'
      );
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processTeacherFile(file);
  };

  const handlePasteChange = (text: string) => {
    setPasteText(text);
    const parsed = mapRowsToTeachers([], text);
    setParsedTeachers(parsed);
  };

  const handleExecuteImport = async () => {
    const validOnes = parsedTeachers.filter((p) => p.isValid);
    if (validOnes.length === 0) {
      showToast('Tidak ada data guru yang valid untuk diimpor', 'error');
      return;
    }

    setIsImporting(true);
    setImportProgress(20);
    setImportStatusMessage(`Membaca dan memvalidasi ${validOnes.length} data tenaga pendidik...`);

    try {
      await new Promise((res) => setTimeout(res, 300));
      setImportProgress(55);
      setImportStatusMessage('Menyinkronkan data pendidik dan penugasan ke database...');

      const payload = validOnes.map((t) => ({
        nama: t.nama,
        nip: t.nip && t.nip !== '-' ? t.nip : null,
        jenisKelamin: t.jenisKelamin,
        tugasUtama: t.tugasUtama || 'Belum ditugaskan',
        tugas_utama: t.tugas_utama || t.tugasUtama || 'Belum ditugaskan',
        mataPelajaran: '',
      }));

      await importTeachers(payload, true);

      setImportProgress(100);
      setImportStatusMessage('Selesai! Seluruh data guru berhasil diimpor.');
      await new Promise((res) => setTimeout(res, 300));

      setIsImportModalOpen(false);
      setParsedTeachers([]);
      setPasteText('');
      setFileName('');
    } catch (err: any) {
      showToast(err?.message || 'Gagal memproses import data guru', 'error');
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      setImportStatusMessage('');
    }
  };

  const validCount = parsedTeachers.filter((p) => p.isValid).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-xs">
            <UsersRound size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">
              Data Guru
            </h2>
            <p className="text-xs text-slate-500">
              {isPersonalWorkspace
                ? 'Data profil pendidik Anda di Ruang Kerja Individu. Profil dan penugasan terhubung otomatis dengan peran utama Anda.'
                : !isAdmin && (isWaliKelas || isGuruMapel)
                ? `Menampilkan data guru yang sesuai dengan akun Anda (${currentUser?.name || 'Pendidik'}).`
                : 'Master pendidik sekolah. Penugasan Wali Kelas dan Guru Mapel bersifat eksklusif per tahun ajaran.'}
            </p>
          </div>
        </div>

        {/* Action Buttons: Import Guru (Ruang Kerja Sekolah) & Tambah Guru */}
        <div className="flex items-center gap-2">
          {canAdd && !isPersonalWorkspace && (
            <button
              onClick={() => {
                setParsedTeachers([]);
                setPasteText('');
                setFileName('');
                setIsImportModalOpen(true);
              }}
              id="btn-import-guru-modal"
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-extrabold shadow-md transition-all cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              <span>Import Guru</span>
            </button>
          )}

          {canAdd && !isPersonalWorkspace && (
            <button
              onClick={openAdd}
              id="btn-tambah-guru"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-extrabold shadow-md transition-all cursor-pointer"
            >
              <Plus size={15} />
              <span>Tambah Guru</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari Nama, NIP, atau Tugas Utama (Wali Kelas / Guru Mapel)..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all"
          />
        </div>

        {!isAdmin && !isPersonalWorkspace && !isWaliKelas && !isGuruMapel && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setTeacherScopeFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                teacherScopeFilter === 'all'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Guru Sekolah ({(teachers || []).length})
            </button>
            <button
              type="button"
              onClick={() => setTeacherScopeFilter('my')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                teacherScopeFilter === 'my'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Profil Saya (Akun Ini)
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto border border-slate-100 rounded-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-[10px] font-bold text-blue-700 uppercase tracking-widest bg-blue-50/60">
              <th className="py-3.5 px-4 w-12 rounded-l-xl">NO</th>
              <th className="py-3.5 px-4">NAMA GURU</th>
              <th className="py-3.5 px-4 w-44">NIP</th>
              <th className="py-3.5 px-4 w-24 text-center">JK</th>
              <th className="py-3.5 px-4 text-center">TUGAS UTAMA</th>
              {canEdit && <th className="py-3.5 px-4 w-32 text-center rounded-r-xl">AKSI</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filteredTeachers.length > 0 ? (
              filteredTeachers.map((t, idx) => {
                const assignDetails = getTeacherAssignmentDetails(t);
                const cleanUserName = normalizeTeacherName(currentUser?.name);
                const userNip = normalizeNip(currentUser?.nip) || (/^\d{8,}$/.test(currentUser?.username || '') ? normalizeNip(currentUser?.username) : '');
                const isMe =
                  (currentUser?.teacherId && t.id === currentUser.teacherId) ||
                  (userNip && normalizeNip(t.nip) === userNip) ||
                  (cleanUserName && normalizeTeacherName(t.nama) === cleanUserName);

                const displayNip = (t.nip && t.nip !== '-')
                  ? t.nip
                  : (isMe && currentUser?.nip && currentUser.nip !== '-' ? currentUser.nip : (isMe && userNip ? userNip : '—'));

                return (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-400">{idx + 1}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{t.nama}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-600">{displayNip}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          t.jenisKelamin === 'L' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'
                        }`}
                      >
                        {t.jenisKelamin === 'L' ? 'L' : 'P'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {assignDetails.badges.map((b, bIdx) => (
                          <span
                            key={bIdx}
                            title={b.title || b.label}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${b.badgeColor}`}
                          >
                            {b.type === 'Wali Kelas' && <GraduationCap size={13} className="shrink-0" />}
                            {b.type === 'Guru Mapel' && <BookOpen size={13} className="shrink-0" />}
                            <span>{b.label}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    {canEdit && (
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isAdmin && !isPersonalWorkspace && (
                            <button
                              type="button"
                              onClick={() => openAssignModal(t)}
                              title="Tentukan Tugas Utama (Wali Kelas / Guru Mapel)"
                              className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                            >
                              <UserCog size={15} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEdit(t)}
                            title="Edit Data Guru"
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                          >
                            <Edit2 size={14} />
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleting(t)}
                              title="Hapus Guru"
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={canEdit ? 6 : 5} className="py-8 text-center text-slate-400">
                  Tidak ada data guru yang ditemukan
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Penugasan Tugas Utama oleh Admin Sekolah */}
      {assigningTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 text-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <UserCog size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Tentukan Tugas Utama Pendidik
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Tentukan tugas utama untuk: <strong className="text-slate-800">{assigningTeacher.nama}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssigningTeacher(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveDirectAssignment} className="space-y-4 text-xs">
              <div className="space-y-2">
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  Pilih Tugas Utama *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAssignRoleType('WALI_KELAS')}
                    className={`p-3.5 rounded-xl border font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      assignRoleType === 'WALI_KELAS'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <GraduationCap size={20} className={assignRoleType === 'WALI_KELAS' ? 'text-emerald-600' : 'text-slate-400'} />
                    <span className="text-xs">Wali Kelas</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAssignRoleType('GURU_MAPEL')}
                    className={`p-3.5 rounded-xl border font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      assignRoleType === 'GURU_MAPEL'
                        ? 'bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <BookOpen size={20} className={assignRoleType === 'GURU_MAPEL' ? 'text-amber-600' : 'text-slate-400'} />
                    <span className="text-xs">Guru Mapel</span>
                  </button>
                </div>
              </div>

              {assignRoleType === 'WALI_KELAS' && (
                <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-2 animate-in fade-in">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-emerald-950 text-xs">Tugas Utama: Wali Kelas</h4>
                      <p className="text-[11px] text-emerald-800 mt-1 leading-relaxed">
                        Guru ini terdaftar dengan tugas utama sebagai <strong>Wali Kelas</strong>. Rombel/kelas binaan dapat dipilih langsung saat menambah kelas di menu <strong>Data Kelas</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {assignRoleType === 'GURU_MAPEL' && (
                <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200 space-y-2 animate-in fade-in">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-amber-950 text-xs">Tugas Utama: Guru Mapel</h4>
                      <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                        Guru ini terdaftar dengan tugas utama sebagai <strong>Guru Mapel</strong>. Penetapan mata pelajaran yang diampu dan kelas target dapat ditentukan melalui menu <strong>Data Mata Pelajaran</strong> dan <strong>Data Kelas</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setAssigningTeacher(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingAssignment}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>{isSavingAssignment ? 'Menyimpan ke Supabase...' : 'Simpan Tugas Utama'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Import Guru (Ruang Kerja Sekolah) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 text-slate-800 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Import Data Guru Masal</h3>
                  <p className="text-xs text-slate-500">Mendukung file Excel (.xlsx), CSV, Word (.docx), &amp; PDF</p>
                </div>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 py-4 overflow-y-auto flex-1 pr-1">
              {/* Step 1: Download Template */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-xs text-slate-800">Format Template Standar</h4>
                  <p className="text-[11px] text-slate-500">
                    Kolom: <span className="font-semibold text-slate-700">NAMA GURU, NIP/NUPTK, JENIS KELAMIN (L/P), TUGAS UTAMA</span>
                  </p>
                </div>
                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDownloadTemplate('xlsx')}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Unduh format template Excel"
                  >
                    <Download size={14} />
                    <span>Template</span>
                  </button>
                </div>
              </div>

              {/* Notice Mode Sumber Tunggal */}
              <div className="p-3 bg-amber-50/90 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs">
                <span className="font-bold text-amber-800 text-sm leading-none mt-0.5">ℹ️</span>
                <p className="leading-relaxed text-[11px]">
                  <strong>Sumber Tunggal (Replace All):</strong> File yang diunggah menjadi sumber data referensi utama guru. Sistem akan otomatis mengganti seluruh data dan menghapus data guru lama yang tidak terdapat dalam file terbaru ini.
                </p>
              </div>

              {/* Step 2: Tab Selector (Upload File vs Tempel Teks) */}
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Metode Input Data
                </label>
                <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setImportTab('upload')}
                    className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
                      importTab === 'upload' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <UploadCloud size={14} />
                    <span>Unggah Dokumen (Excel / CSV / Word / PDF)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportTab('paste')}
                    className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
                      importTab === 'paste' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileText size={14} />
                    <span>Tempel Data (Salin dari Spreadsheet)</span>
                  </button>
                </div>
              </div>

              {/* Upload File Body */}
              {importTab === 'upload' ? (
                <div>
                  <label
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(true);
                    }}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) processTeacherFile(file);
                    }}
                    className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-2.5 cursor-pointer transition-all ${
                      isDraggingFile
                        ? 'border-emerald-500 bg-emerald-50/60 scale-[1.01] shadow-sm'
                        : 'border-slate-200 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/20'
                    }`}
                  >
                    {isParsingFile ? (
                      <div className="flex flex-col items-center gap-2 py-2">
                        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-bold text-emerald-800">
                          Membaca dan memproses isi dokumen...
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-emerald-100/70 text-emerald-700 flex items-center justify-center">
                          <UploadCloud size={22} />
                        </div>
                        <div className="text-center">
                          <span className="text-xs font-extrabold text-slate-800 block">
                            {fileName ? `File: ${fileName}` : 'Klik untuk memilih file dari komputer'}
                          </span>
                          {detectedDocType && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                              Format Terbaca: {detectedDocType}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1">
                          <span className="px-2 py-0.5 rounded bg-emerald-100/80 text-emerald-900 text-[10px] font-bold">
                            📊 Excel (.xlsx / .xls)
                          </span>
                          <span className="px-2 py-0.5 rounded bg-sky-100/80 text-sky-900 text-[10px] font-bold">
                            📄 CSV (.csv)
                          </span>
                          <span className="px-2 py-0.5 rounded bg-blue-100/80 text-blue-900 text-[10px] font-bold">
                            📝 Word (.docx)
                          </span>
                          <span className="px-2 py-0.5 rounded bg-rose-100/80 text-rose-900 text-[10px] font-bold">
                            📑 PDF (.pdf)
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Sistem otomatis membaca baris tabel dan memetakan kolom nama guru, NIP, gender, &amp; tugas utama
                        </span>
                      </>
                    )}
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv, .docx, .pdf, .txt, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/pdf, text/plain"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <div>
                  <textarea
                    rows={4}
                    value={pasteText}
                    onChange={(e) => handlePasteChange(e.target.value)}
                    placeholder="Tempel data guru dari spreadsheet Excel di sini...&#10;Contoh:&#10;Budi Santoso, S.Pd.&#9;198503152010011012&#9;L&#9;Wali Kelas&#10;Siti Aminah, M.Pd.&#9;199008222015022003&#9;P&#9;Guru Mapel"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
                  />
                </div>
              )}

              {/* Data Preview Table */}
              {parsedTeachers.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                      Pratinjau Data ({parsedTeachers.length} Baris Terdeteksi)
                    </label>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {validCount} Baris Valid
                    </span>
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                        <tr>
                          <th className="p-2 w-8">#</th>
                          <th className="p-2">Nama Guru</th>
                          <th className="p-2">NIP</th>
                          <th className="p-2 text-center w-12">JK</th>
                          <th className="p-2">Tugas Utama</th>
                          <th className="p-2 text-center w-16">Validasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedTeachers.map((item, i) => (
                          <tr key={i} className={item.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/40'}>
                            <td className="p-2 text-slate-400 font-mono text-[11px]">{i + 1}</td>
                            <td className="p-2 font-bold text-slate-800">{item.nama}</td>
                            <td className="p-2 font-mono text-slate-600">{item.nip}</td>
                            <td className="p-2 text-center">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  item.jenisKelamin === 'L' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'
                                }`}
                              >
                                {item.jenisKelamin}
                              </span>
                            </td>
                            <td className="p-2">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                {item.tugasUtama || 'Belum Ditugaskan'}
                              </span>
                            </td>
                            <td className="p-2 text-center">
                              {item.isValid ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  <Check size={10} /> Valid
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                  {item.error || 'Error'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 shrink-0">
              <span className="text-xs font-semibold text-slate-500">
                {validCount > 0 ? `${validCount} guru siap diproses` : 'Pilih file/tempel data untuk mulai'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={validCount === 0}
                  onClick={handleExecuteImport}
                  className="px-5 py-2.5 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Check size={14} />
                  <span>Proses Import ({validCount} Guru)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add / Edit Single Teacher */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm">
                {editing ? 'Edit Data Guru' : 'Tambah Guru Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={save} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap Guru *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso, S.Pd."
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium focus:bg-white focus:border-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">NIP (Nomor Induk Pegawai)</label>
                <input
                  type="text"
                  placeholder="Contoh: 198503152010011012 atau isi -"
                  value={nip}
                  onChange={(e) => setNip(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono focus:bg-white focus:border-blue-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenis Kelamin</label>
                  <select
                    value={jenisKelamin}
                    onChange={(e) => setJenisKelamin(e.target.value as 'L' | 'P')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium focus:bg-white focus:border-blue-600 outline-none"
                  >
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tugas Utama *
                  </label>
                  {isPersonalWorkspace ? (
                    <input
                      type="text"
                      readOnly
                      value={modalRoleType === 'WALI_KELAS' ? 'Wali Kelas' : 'Guru Mapel'}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 outline-none cursor-default"
                    />
                  ) : (
                    <select
                      value={modalRoleType}
                      onChange={(e) => setModalRoleType(e.target.value as 'WALI_KELAS' | 'GURU_MAPEL')}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold focus:bg-white focus:border-blue-600 outline-none text-slate-800"
                    >
                      <option value="WALI_KELAS">Wali Kelas</option>
                      <option value="GURU_MAPEL">Guru Mapel</option>
                    </select>
                  )}
                </div>
              </div>

              {modalRoleType === 'WALI_KELAS' && (
                <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-emerald-950 text-xs">Tugas Utama: Wali Kelas</h4>
                      <p className="text-[11px] text-emerald-800 leading-relaxed">
                        Data guru terdaftar dengan tugas utama <strong>Wali Kelas</strong>. Rombel/nama kelas binaan dapat dikelola langsung di menu <strong>Data Kelas</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {modalRoleType === 'GURU_MAPEL' && (
                <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-amber-950 text-xs">Tugas Utama: Guru Mapel</h4>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Data guru terdaftar dengan tugas utama <strong>Guru Mapel</strong>. Penetapan mata pelajaran dan kelas yang diampu dapat ditentukan melalui menu <strong>Data Mata Pelajaran</strong> dan <strong>Data Kelas</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {isPersonalWorkspace ? (
                <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 flex items-start gap-2 text-[11px] text-indigo-900">
                  <ShieldCheck size={14} className="shrink-0 mt-0.5 text-indigo-600" />
                  <span>
                    <strong>Ruang Kerja Individu:</strong> Dibatasi khusus untuk 1 pendidik akun mandiri ({modalRoleType === 'WALI_KELAS' ? 'Wali Kelas' : 'Guru Mapel'}).
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-start gap-2 text-[11px] text-blue-800">
                  <ShieldCheck size={14} className="shrink-0 mt-0.5 text-blue-600" />
                  <span>
                    <strong>Aturan Penugasan:</strong> Seorang guru tidak dapat bertindak ganda sebagai Wali Kelas sekaligus Guru Mapel dalam tahun ajaran yang sama.
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  Simpan Guru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Quick Create Account */}
      {accountTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm">
                Buat Akun Pengguna untuk {accountTeacher.nama}
              </h3>
              <button
                type="button"
                onClick={() => setAccountTeacher(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAccountSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Username Login *</label>
                <input
                  type="text"
                  required
                  value={accountUsername}
                  onChange={(e) => setAccountUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono focus:bg-white focus:border-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Password Awal *</label>
                <input
                  type="text"
                  required
                  value={accountPassword}
                  onChange={(e) => setAccountPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono focus:bg-white focus:border-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Role Akun</label>
                <select
                  value={accountRole}
                  onChange={(e) => setAccountRole(e.target.value as 'WALI KELAS' | 'GURU MAPEL')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold focus:bg-white focus:border-blue-600 outline-none"
                >
                  <option value="WALI KELAS">Wali Kelas</option>
                  <option value="GURU MAPEL">Guru Mapel</option>
                </select>
              </div>

              {accountRole === 'GURU MAPEL' && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Mata Pelajaran *</label>
                    <select
                      required
                      value={accountSubjectId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setAccountSubjectId(id);
                        const sub = subjects.find((x) => x.id === id);
                        setAccountClassIds(sub?.targetClassIds || []);
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold focus:bg-white focus:border-blue-600 outline-none"
                    >
                      <option value="">Pilih mata pelajaran...</option>
                      {subjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}{sub.teacherId && sub.teacherId !== accountTeacher.id ? ' — sudah ditugaskan ke guru lain' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Kelas yang Diajar *</label>
                    <div className="grid grid-cols-2 gap-2 max-h-28 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                      {classes.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 text-[11px] font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={accountClassIds.includes(c.id)}
                            onChange={(e) => setAccountClassIds((v) => e.target.checked ? [...new Set([...v, c.id])] : v.filter((id) => id !== c.id))}
                            className="rounded text-blue-600"
                          />
                          {c.name}
                        </label>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Penugasan kelas disimpan melalui subject_class_assignments.</p>
                  </div>
                </>
              )}

              {accountRole === 'WALI KELAS' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kelas Wali *</label>
                  <select
                    required
                    value={accountClassId}
                    onChange={(e) => setAccountClassId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold focus:bg-white focus:border-blue-600 outline-none"
                  >
                    <option value="">Pilih kelas...</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">Satu Wali Kelas hanya boleh memiliki satu kelas.</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setAccountTeacher(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreatingAccount}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {isCreatingAccount ? 'Memproses...' : 'Buat Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-slate-900 text-sm">Hapus data guru?</h3>
              <p className="text-xs text-slate-500">
                Data guru dan seluruh data terkait, termasuk riwayat absensi, akan dihapus. Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                disabled={isDeletingTeacher}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={removeTeacher}
                disabled={isDeletingTeacher}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-md shadow-rose-600/20 cursor-pointer disabled:opacity-50"
              >
                {isDeletingTeacher ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visual Book Loading Modal for Import Guru */}
      <BookLoadingModal
        isOpen={isImporting}
        title="Mengimpor Data Guru..."
        subtitle="Sistem sedang memproses data pendidik, memvalidasi NIP, dan memperbarui daftar tenaga pendidik."
        badgeText="PROSES IMPORT DATA GURU"
        progress={importProgress}
        statusMessage={importStatusMessage}
      />
    </div>
  );
};
