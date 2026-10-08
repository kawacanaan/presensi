import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { UserAccount, UserRole, UserAccountInput, GeneratedAccountResult } from '../types';
import { exportGeneratedAccountsPdf } from '../utils/exportGeneratedAccountsPdf';
import { BookLoadingModal } from '../components/BookLoader';
import { formatHomeroomDutyLabel } from '../utils/formatTeacherTitle';
import {
  ArrowLeft,
  UserCheck,
  Search,
  Key,
  X,
  Trash2,
  Edit2,
  AlertTriangle,
  GraduationCap,
  BookOpen,
  Sparkles,
  Copy,
  Check,
  Users,
  ShieldCheck,
  School,
  FileText,
  Eye,
  EyeOff,
  ChevronDown,
  Printer,
  Plus,
  Download,
  Share2,
  Lock,
  Filter,
  CheckCircle2,
  RefreshCw,
  Loader2,
} from 'lucide-react';

export const DataPenggunaView: React.FC = () => {
  const {
    currentUser,
    users,
    classes,
    students,
    teachers,
    subjects,
    schoolProfile,
    systemConfig,
    addUser,
    deleteUser,
    updateUser,
    generateAccountsFromReferences,
    updateUserPassword,
    setActiveView,
    showToast,
    activeWorkspace,
    openUpgradeModal,
    isTeacherPro,
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

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'administrator' | 'guru' | 'siswa'>('guru');

  // Di Ruang Kerja Individu, hanya tab 'guru' (Guru & KS) dan 'siswa' yang diizinkan
  const effectiveActiveTab = isPersonalWorkspace
    ? (activeTab === 'siswa' ? 'siswa' : 'guru')
    : activeTab;
  const [guruSubFilter, setGuruSubFilter] = useState<'ALL' | 'WALI_KELAS' | 'GURU_MAPEL' | 'KEPALA_SEKOLAH'>('ALL');
  const [siswaClassFilter, setSiswaClassFilter] = useState<string>('ALL');
  const [authFilter, setAuthFilter] = useState<'ALL' | 'GOOGLE' | 'PASSWORD'>('ALL');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Generate Accounts Modal & Result State
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);
  const [generateStatusMessage, setGenerateStatusMessage] = useState('');
  const [generateResetExisting, setGenerateResetExisting] = useState(true);
  const [generatedResults, setGeneratedResults] = useState<GeneratedAccountResult[] | null>(null);
  const [resultFilterTab, setResultFilterTab] = useState<'ALL' | 'GURU' | 'SISWA' | 'KEPALA SEKOLAH'>('ALL');
  const [resultSearchTerm, setResultSearchTerm] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showMainExportMenu, setShowMainExportMenu] = useState(false);

  // Add User Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addUsername, setAddUsername] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addRole, setAddRole] = useState<UserRole>('WALI KELAS');
  const [addStudentId, setAddStudentId] = useState('');
  const [addTeacherType, setAddTeacherType] = useState<'wali_kelas' | 'guru_mapel'>('wali_kelas');
  const [addSingleClassId, setAddSingleClassId] = useState('');
  const [addClassIds, setAddClassIds] = useState<string[]>([]);
  const [addSubjectId, setAddSubjectId] = useState('');
  const [showAddPassword, setShowAddPassword] = useState(true);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Edit User Modal State
  const [editUser, setEditUser] = useState<UserAccount | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('ADMIN');
  const [editStudentId, setEditStudentId] = useState('');
  const [editTeacherType, setEditTeacherType] = useState<'wali_kelas' | 'guru_mapel'>('wali_kelas');
  const [editSingleClassId, setEditSingleClassId] = useState('');
  const [editClassIds, setEditClassIds] = useState<string[]>([]);
  const [editSubjectId, setEditSubjectId] = useState('');

  // Change Password Modal State
  const [targetPasswordUser, setTargetPasswordUser] = useState<UserAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showModalPassword, setShowModalPassword] = useState(true);

  // Delete User Confirmation State
  const [userToDelete, setUserToDelete] = useState<UserAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Random Password Generator Helper
  const generateRandomPassword = (length = 8): string => {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Password Display Check
  const isGoogleUser = (u: UserAccount | null | undefined): boolean => {
    if (!u) return false;
    if (u.isGoogleAuth === true || u.authProvider === 'google' || (u as any).provider === 'google') return true;
    const email = (u.email || '').trim().toLowerCase();
    if (email.includes('@') && !email.endsWith('@login.edushift.local')) {
      return true;
    }
    return false;
  };

  // Helper to resolve detailed Hak Akses & Penugasan (Wali Kelas / Guru Mapel / Kepala Sekolah)
  const getUserAssignmentDetails = (u: UserAccount | null | undefined) => {
    if (!u) {
      return {
        type: 'ADMIN' as const,
        roleLabel: 'PENGGUNA',
        badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
        assignmentText: '-',
        classes: [],
        subjects: [],
        matchedTeacher: null,
      };
    }

    const safeClasses = classes || [];
    const safeTeachers = teachers || [];
    const safeStudents = students || [];
    const safeSubjects = subjects || [];

    const uName = (u.name || '').trim().toLowerCase();
    const uUsername = (u.username || '').trim().toLowerCase();

    if (u.role === 'ADMIN' || u.role === 'SUPER_ADMIN') {
      return {
        type: 'ADMIN' as const,
        roleLabel: 'Administrator',
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
        assignmentText: 'Akses Penuh Pengelolaan Sistem & Data',
        classes: [],
        subjects: [],
        matchedTeacher: null,
      };
    }
    if (u.role === 'SISWA') {
      const s = safeStudents.find((st) => st && (st.id === u.studentId || (st.nisn && uUsername && String(st.nisn).trim().toLowerCase() === uUsername)));
      const className = s?.className || (u.classIds && u.classIds.length > 0 ? (safeClasses.find(c => c && c.id === u.classIds![0])?.name || '') : '');
      return {
        type: 'SISWA' as const,
        roleLabel: 'Siswa',
        badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
        assignmentText: className ? `Rombel: ${className}` : 'Peserta Didik',
        classes: className ? [className] : [],
        subjects: [],
        matchedTeacher: null,
      };
    }
    if (u.role === 'KEPALA SEKOLAH') {
      return {
        type: 'KEPALA_SEKOLAH' as const,
        roleLabel: 'Kepala Sekolah',
        badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
        assignmentText: 'Pimpinan Satuan Pendidikan (Seluruh Rombel)',
        classes: ['Semua Rombel'],
        subjects: [],
        matchedTeacher: null,
      };
    }

    // Match teacher from master teachers list
    const matchedTeacher = safeTeachers.find(
      (t) =>
        t &&
        ((u.teacherId && t.id === u.teacherId) ||
        (t.nip && t.nip !== '-' && uUsername && String(t.nip).trim().toLowerCase() === uUsername) ||
        (t.nama && uName && String(t.nama).trim().toLowerCase() === uName))
    );

    // Homeroom assignments (Eksklusif: 1 Guru = 1 Rombel)
    let homeroomClasses = safeClasses.filter(
      (c) =>
        c &&
        ((matchedTeacher && c.waliKelasTeacherId === matchedTeacher.id) ||
        (u.teacherId && c.waliKelasTeacherId === u.teacherId) ||
        (c.waliKelasName && uName && String(c.waliKelasName).trim().toLowerCase() === uName) ||
        (u.role === 'WALI KELAS' && u.classIds && u.classIds.includes(c.id)))
    );

    if (homeroomClasses.length > 1) {
      const preferred = homeroomClasses.find((c) => u.classIds && u.classIds.includes(c.id)) || homeroomClasses[0];
      homeroomClasses = preferred ? [preferred] : [homeroomClasses[0]];
    }

    // Subject teacher assignments
    const teacherSubjects = safeSubjects.filter(
      (s) =>
        s &&
        ((matchedTeacher && s.teacherId === matchedTeacher.id) ||
        (u.teacherId && s.teacherId === u.teacherId) ||
        (s.teacherName && uName && String(s.teacherName).trim().toLowerCase() === uName) ||
        (u.subjectId && s.id === u.subjectId))
    );

    const isWali =
      homeroomClasses.length > 0 ||
      u.role === 'WALI KELAS' ||
      (matchedTeacher && (matchedTeacher.tugasUtama === 'Wali Kelas' || (matchedTeacher as any).tugas_utama === 'Wali Kelas'));

    const isMapel =
      teacherSubjects.length > 0 ||
      u.role === 'GURU MAPEL' ||
      (matchedTeacher && (matchedTeacher.tugasUtama === 'Guru Mapel' || (matchedTeacher as any).tugas_utama === 'Guru Mapel'));

    if (isWali && !isMapel) {
      const classNames = homeroomClasses.map((c) => c?.name).filter(Boolean);
      const classList = classNames.length > 0
        ? [classNames[0]]
        : (u.classNames && u.classNames.length > 0 ? [u.classNames[0]] : []);
      const assignedClassStr = classList.length > 0 ? classList[0] : '';
      return {
        type: 'WALI_KELAS' as const,
        roleLabel: 'Wali Kelas',
        badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        assignmentText: assignedClassStr ? formatHomeroomDutyLabel(assignedClassStr) : 'Wali Kelas (Belum Dipetakan)',
        classes: classList,
        subjects: [],
        matchedTeacher,
      };
    }

    if (isMapel) {
      const mapelNames = teacherSubjects.map((s) => s?.name).filter(Boolean);
      let targetClassNames: string[] = [];
      teacherSubjects.forEach((s) => {
        (s?.targetClassIds || []).forEach((cid) => {
          const c = safeClasses.find((cl) => cl && cl.id === cid);
          if (c?.name && !targetClassNames.includes(c.name)) targetClassNames.push(c.name);
        });
      });
      if (targetClassNames.length === 0 && u.classNames && u.classNames.length > 0) {
        targetClassNames = u.classNames;
      }
      const mapelStr = mapelNames.length > 0 ? mapelNames.join(', ') : (u.subjectName || 'Guru Mapel');
      const classStr = targetClassNames.length > 0 ? ` (${targetClassNames.join(', ')})` : '';

      return {
        type: 'GURU_MAPEL' as const,
        roleLabel: 'Guru Mapel',
        badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-200',
        assignmentText: `${mapelStr}${classStr}`,
        classes: targetClassNames,
        subjects: mapelNames.length > 0 ? mapelNames : (u.subjectName ? [u.subjectName] : []),
        matchedTeacher,
      };
    }

    return {
      type: 'GURU_MAPEL' as const,
      roleLabel: u.role === 'WALI KELAS' ? 'Wali Kelas' : 'Guru Mapel',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      assignmentText: u.classNames && u.classNames.length > 0 ? `Rombel: ${u.classNames.join(', ')}` : 'Tenaga Pendidik',
      classes: u.classNames || [],
      subjects: u.subjectName ? [u.subjectName] : [],
      matchedTeacher,
    };
  };

  // Summary counts for Guru & KS & All
  const stats = useMemo(() => {
    let countAdmin = 0;
    let countWali = 0;
    let countMapel = 0;
    let countKepsek = 0;
    let countSiswa = 0;
    let countGoogle = 0;
    let countPassword = 0;

    const userList = users || [];
    const teacherList = teachers || [];
    const studentList = students || [];

    userList.forEach((u) => {
      if (!u) return;
      if (isGoogleUser(u)) countGoogle++;
      else countPassword++;

      if (u.role === 'ADMIN' || u.role === 'SUPER_ADMIN') {
        countAdmin++;
      } else if (u.role === 'SISWA') {
        countSiswa++;
      } else {
        const details = getUserAssignmentDetails(u);
        if (details.type === 'WALI_KELAS') countWali++;
        else if (details.type === 'GURU_MAPEL') countMapel++;
        else if (details.type === 'KEPALA_SEKOLAH') countKepsek++;
        else countMapel++;
      }
    });

    // Count teachers in master data without user account
    const unlinkedTeachers = teacherList.filter((t) => {
      if (!t) return false;
      const cleanTNip = (t.nip || "").replace(/\D/g, "");
      const cleanTName = (t.nama || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      return !userList.some((u) => {
        if (!u) return false;
        if (u.teacherId && u.teacherId === t.id) return true;
        const cleanUNip = (u.nip || "").replace(/\D/g, "");
        const cleanUUsername = (u.username || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (cleanTNip && cleanTNip.length >= 6 && (cleanUNip === cleanTNip || cleanUUsername.includes(cleanTNip))) return true;
        const cleanUName = (u.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (cleanTName && cleanUName && (cleanTName === cleanUName || cleanTName.includes(cleanUName) || cleanUName.includes(cleanTName))) return true;
        if (cleanTName && cleanUUsername && (cleanUUsername === cleanTName || cleanUUsername.includes(cleanTName) || cleanTName.includes(cleanUUsername))) return true;
        return false;
      });
    });

    // Count students in master data without user account
    const unlinkedStudents = studentList.filter((s) => {
      if (!s) return false;
      const cleanSNisn = (s.nisn || "").replace(/\D/g, "");
      const cleanSName = (s.nama || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      return !userList.some((u) => {
        if (!u) return false;
        if (u.studentId && u.studentId === s.id) return true;
        const cleanUUsername = (u.username || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (cleanSNisn && cleanSNisn.length >= 4 && (cleanUUsername === cleanSNisn || cleanUUsername.includes(cleanSNisn))) return true;
        const cleanUName = (u.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (cleanSName && cleanUName && (cleanSName === cleanUName || cleanSName.includes(cleanUName) || cleanUName.includes(cleanSName))) return true;
        if (cleanSName && cleanUUsername && (cleanUUsername === cleanSName || cleanUUsername.includes(cleanSName) || cleanSName.includes(cleanUUsername))) return true;
        return false;
      });
    });

    return {
      total: userList.length,
      admin: countAdmin,
      guruKsTotal: countWali + countMapel + countKepsek,
      wali: countWali,
      mapel: countMapel,
      kepsek: countKepsek,
      siswa: countSiswa,
      google: countGoogle,
      password: countPassword,
      unlinkedTeachersCount: unlinkedTeachers.length,
      unlinkedStudentsCount: unlinkedStudents.length,
      unlinkedTeachers,
      unlinkedStudents,
    };
  }, [users, teachers, classes, subjects, students]);

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    const userList = users || [];
    const safeClasses = classes || [];
    const safeStudents = students || [];

    return userList.filter((u) => {
      if (!u) return false;
      const isTeacherRole = u.role === 'WALI KELAS' || u.role === 'GURU MAPEL' || u.role === 'KEPALA SEKOLAH';
      
      let matchesTab = true;
      if (effectiveActiveTab === 'administrator') {
        matchesTab = u.role === 'ADMIN' || u.role === 'SUPER_ADMIN';
      } else if (effectiveActiveTab === 'guru') {
        matchesTab = isTeacherRole;
      } else if (effectiveActiveTab === 'siswa') {
        matchesTab = u.role === 'SISWA';
      }

      if (!matchesTab) return false;

      // Sub-filter for Guru & KS tab
      if (effectiveActiveTab === 'guru' && guruSubFilter !== 'ALL') {
        const details = getUserAssignmentDetails(u);
        if (guruSubFilter === 'WALI_KELAS' && details.type !== 'WALI_KELAS') return false;
        if (guruSubFilter === 'GURU_MAPEL' && details.type !== 'GURU_MAPEL') return false;
        if (guruSubFilter === 'KEPALA_SEKOLAH' && details.type !== 'KEPALA_SEKOLAH') return false;
      }

      // Filter for Siswa tab by Class
      if (effectiveActiveTab === 'siswa' && siswaClassFilter !== 'ALL') {
        const s = safeStudents.find((st) => st && (st.id === u.studentId || (st.nisn && u.username && String(st.nisn).trim().toLowerCase() === String(u.username).trim().toLowerCase())));
        const className = s?.className || (u.classIds && u.classIds.length > 0 ? (safeClasses.find(c => c && c.id === u.classIds![0])?.name || '') : '');
        if (className !== siswaClassFilter) return false;
      }

      // Filter by Auth Type
      if (authFilter === 'GOOGLE' && !isGoogleUser(u)) return false;
      if (authFilter === 'PASSWORD' && isGoogleUser(u)) return false;

      // Search Query
      const q = (searchTerm || '').trim().toLowerCase();
      if (!q) return true;

      const details = getUserAssignmentDetails(u);
      const nameMatch = (u.name || '').toLowerCase().includes(q);
      const usernameMatch = (u.username || '').toLowerCase().includes(q);
      const emailMatch = (u.email || '').toLowerCase().includes(q);
      const assignMatch = (details.assignmentText || '').toLowerCase().includes(q);
      const classMatch = (details.classes || []).some((c) => c && String(c).toLowerCase().includes(q));
      const subjectMatch = (details.subjects || []).some((s) => s && String(s).toLowerCase().includes(q));

      return nameMatch || usernameMatch || emailMatch || assignMatch || classMatch || subjectMatch;
    });
  }, [users, searchTerm, effectiveActiveTab, guruSubFilter, siswaClassFilter, authFilter, classes, subjects, teachers, students]);

  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const currentUsers = filteredUsers.slice(startIndex, startIndex + pageSize);

  const isTeacherRole = (role: UserRole) => role === 'WALI KELAS' || role === 'GURU MAPEL';

  // Open Add User Modal with default values
  const openAddUser = () => {
    if (isPersonalWorkspace) return;
    setAddName('');
    setAddEmail('');
    setAddUsername('');
    setAddPassword(generateRandomPassword(8));
    setAddRole('WALI KELAS');
    setAddTeacherType('wali_kelas');
    setAddSingleClassId(classes[0]?.id || '');
    setAddClassIds(classes.length > 0 ? [classes[0].id] : []);
    setAddSubjectId(subjects[0]?.id || '');
    setAddStudentId('');
    setShowAddPassword(true);
    setIsAddModalOpen(true);
  };

  // Handle Quick Select Master Teacher for Adding User
  const handleSelectTeacherForAdd = (teacherId: string) => {
    const t = teachers.find((tc) => tc.id === teacherId);
    if (!t) return;
    setAddName(t.nama);
    setAddUsername(t.nip && t.nip !== '-' ? t.nip.replace(/\s+/g, '') : t.nama.toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (t.tugasUtama === 'Wali Kelas' || t.tugas_utama === 'Wali Kelas') {
      setAddRole('WALI KELAS');
      setAddTeacherType('wali_kelas');
      const cls = classes.find((c) => c.waliKelasTeacherId === t.id);
      if (cls) setAddSingleClassId(cls.id);
    } else if (t.tugasUtama === 'Guru Mapel' || t.tugas_utama === 'Guru Mapel') {
      setAddRole('GURU MAPEL');
      setAddTeacherType('guru_mapel');
      const sub = subjects.find((s) => s.teacherId === t.id);
      if (sub) {
        setAddSubjectId(sub.id);
        if (sub.targetClassIds && sub.targetClassIds.length > 0) {
          setAddClassIds(sub.targetClassIds);
        }
      }
    }
  };

  // Handle Quick Select Master Student for Adding User
  const handleSelectStudentForAdd = (studentId: string) => {
    const s = students.find((st) => st.id === studentId);
    if (!s) return;
    setAddName(s.nama);
    setAddUsername(s.nisn && s.nisn !== '-' ? s.nisn.trim() : s.nama.toLowerCase().replace(/[^a-z0-9]/g, ''));
    setAddRole('SISWA');
    setAddStudentId(s.id);
  };

  // Submit Add User
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addUsername.trim() || !addPassword.trim()) {
      showToast('Mohon lengkapi Nama, Username, dan Password', 'warning');
      return;
    }

    // Check duplicate username
    const exists = users.some((u) => u.username.toLowerCase() === addUsername.trim().toLowerCase());
    if (exists) {
      showToast(`Username "${addUsername.trim()}" sudah digunakan oleh akun lain.`, 'error');
      return;
    }

    setIsSubmittingAdd(true);
    try {
      let targetClasses: string[] = [];
      let targetSubjectName = '';
      if (isTeacherRole(addRole)) {
        if (addTeacherType === 'wali_kelas') {
          targetClasses = addSingleClassId ? [addSingleClassId] : [];
        } else {
          targetClasses = addClassIds;
          const sub = subjects.find((s) => s.id === addSubjectId);
          if (sub) targetSubjectName = sub.name;
        }
      }

      const input: UserAccountInput = {
        name: addName.trim(),
        email: addEmail.trim() || null,
        username: addUsername.trim(),
        password: addPassword.trim(),
        role: addRole,
        studentId: addRole === 'SISWA' ? (addStudentId || null) : null,
        classIds: targetClasses,
        subjectId: addRole === 'GURU MAPEL' ? (addSubjectId || null) : null,
        subjectName: targetSubjectName || null,
      };

      await addUser(input);
      setIsAddModalOpen(false);
    } catch (err: any) {
      // Toast already shown in AppContext
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const openEditUser = (u: UserAccount) => {
    setEditUser(u);
    setEditName(u.name);
    const currentEmail = (u.email || '').trim();
    setEditEmail(currentEmail.toLowerCase().endsWith('@login.edushift.local') ? '' : currentEmail);
    setEditUsername(u.username);
    setEditRole(u.role);
    setEditStudentId(u.studentId || '');
    setEditSubjectId(u.subjectId || '');

    const existingClassIds = u.classIds || [];
    if (existingClassIds.length === 1) {
      setEditTeacherType('wali_kelas');
      setEditSingleClassId(existingClassIds[0]);
      setEditClassIds(existingClassIds);
    } else {
      setEditTeacherType(existingClassIds.length > 1 ? 'guru_mapel' : 'wali_kelas');
      setEditSingleClassId(existingClassIds[0] || '');
      setEditClassIds(existingClassIds);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser || !editName.trim() || !editUsername.trim()) return;

    let targetClasses: string[] = [];
    if (isTeacherRole(editRole)) {
      if (editTeacherType === 'wali_kelas') {
        targetClasses = editSingleClassId ? [editSingleClassId] : [];
      } else {
        targetClasses = editClassIds;
      }
    }

    try {
      await updateUser(editUser.id, {
        name: editName.trim(),
        email: editEmail.trim() || null,
        username: editUsername.trim(),
        role: editRole,
        studentId: editRole === 'SISWA' ? (editStudentId || null) : null,
        classIds: isTeacherRole(editRole) ? targetClasses : [],
        subjectId: editRole === 'GURU MAPEL' ? (editSubjectId || null) : null,
      });

      setEditUser(null);
    } catch (_) {
      // Toast error ditangani oleh updateUser di AppContext
    }
  };

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPasswordUser || !newPassword.trim()) return;

    updateUserPassword(targetPasswordUser.id, newPassword.trim());
    setTargetPasswordUser(null);
    setNewPassword('');
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete || isDeleting) return;
    if (currentUser && currentUser.id === userToDelete.id) {
      showToast('Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.', 'error');
      setUserToDelete(null);
      return;
    }
    const target = userToDelete;
    try {
      setIsDeleting(true);
      await deleteUser(target.id);
      setUserToDelete(null);
    } catch (_) {
      // Toast telah ditangani oleh deleteUser di AppContext
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenGenerate = (resetExisting: boolean = true) => {
    if (isPersonalWorkspace && !isTeacherPro) {
      openUpgradeModal({
        featureId: 'generator_akun',
        customTitle: 'Upgrade ke Paket Guru',
        customMessage:
          'Fitur Generate Akun & Password otomatis untuk Kepala Sekolah dan Siswa memerlukan Paket Guru. Silakan upgrade untuk mengaktifkan fitur ini.',
        targetPackage: 'guru_pro',
      });
      return;
    }
    setGenerateResetExisting(resetExisting);
    setIsGenerateModalOpen(true);
  };

  const handleGenerateSubmit = async () => {
    if (isPersonalWorkspace && !isTeacherPro) {
      setIsGenerateModalOpen(false);
      openUpgradeModal({
        featureId: 'generator_akun',
        customTitle: 'Upgrade ke Paket Guru',
        customMessage:
          'Fitur Generate Akun & Password otomatis untuk Kepala Sekolah dan Siswa memerlukan Paket Guru. Silakan upgrade untuk mengaktifkan fitur ini.',
        targetPackage: 'guru_pro',
      });
      return;
    }

    setIsGenerating(true);
    setGenerateProgress(15);
    setGenerateStatusMessage('Membaca data referensi guru, tenaga pendidik, dan siswa...');
    try {
      await new Promise((res) => setTimeout(res, 350));
      setGenerateProgress(45);
      setGenerateStatusMessage('Men-generate username, password acak aman, dan memetakan hak akses rombel...');
      await new Promise((res) => setTimeout(res, 350));
      setGenerateProgress(75);
      setGenerateStatusMessage('Menyinkronkan kredensial akun pengguna ke database sekolah...');

      const results = await generateAccountsFromReferences({
        resetExistingPasswords: generateResetExisting,
      });

      setGenerateProgress(100);
      setGenerateStatusMessage(`Selesai! Berhasil memproses ${results?.length || 0} akun pengguna.`);
      await new Promise((res) => setTimeout(res, 300));

      setGeneratedResults(results);
      setIsGenerateModalOpen(false);
    } catch (err: any) {
      showToast(err?.message || 'Gagal mengenerate akun pengguna', 'error');
    } finally {
      setIsGenerating(false);
      setGenerateProgress(0);
      setGenerateStatusMessage('');
    }
  };

  const handleCopyPassword = (pwd: string, idx: number) => {
    navigator.clipboard.writeText(pwd);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Copy all generated credentials to clipboard as formatted text
  const handleCopyAllGeneratedCredentials = () => {
    if (!generatedResults || generatedResults.length === 0) return;
    const lines = [
      `REKAPITULASI KREDENSIAL AKUN LOGIN - ${schoolProfile?.namaSekolah || 'SEKOLAH'}`,
      `Waktu Generate: ${new Date().toLocaleString('id-ID')}`,
      '--------------------------------------------------------------------------------',
      'No | Nama Lengkap | Username | Password | Role / Penugasan | Status',
      '--------------------------------------------------------------------------------',
      ...generatedResults.map((r, i) => `${i + 1}. ${r.name} | User: ${r.username} | Pass: ${r.password} | ${r.role} (${r.className || '-'}) | ${r.status === 'CREATED' ? 'Baru' : 'Diupdate'}`),
      '--------------------------------------------------------------------------------',
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    showToast('Seluruh daftar kredensial akun berhasil disalin ke clipboard!', 'success');
  };

  // Quick Copy Account Credential Message
  const handleCopyCredentialMessage = (u: UserAccount) => {
    const details = getUserAssignmentDetails(u);
    const pwd = u.password || (isGoogleUser(u) ? 'Gunakan Tombol Masuk dengan Google' : 'Hubungi Admin');
    const schoolName = schoolProfile?.namaSekolah || 'SEKOLAH';
    const msg = `*KREDENSIAL LOGIN APLIKASI PRESENSI ${schoolName}*\n----------------------------------------\nNama: ${u.name || '-'}\nPeran / Hak Akses: ${details.roleLabel} (${details.assignmentText})\nUsername: ${u.username || '-'}\nPassword: ${pwd}\n----------------------------------------\nSilakan simpan dan jaga kerahasiaan akun ini.`;
    navigator.clipboard.writeText(msg);
    setCopiedUserId(u.id);
    showToast(`Format kredensial login untuk ${u.name || u.username} telah disalin ke clipboard`, 'success');
    setTimeout(() => setCopiedUserId(null), 2500);
  };

  // Export Users to CSV / Spreadsheet
  const handleExportCSV = () => {
    if (filteredUsers.length === 0) {
      showToast('Tidak ada data pengguna yang sesuai untuk diekspor.', 'warning');
      return;
    }

    const schoolId = currentUser?.schoolId;
    let cachedPasswordMap: Record<string, string> = {};
    if (schoolId) {
      try {
        const raw = localStorage.getItem(`kawacanaan_account_passwords_${schoolId}`);
        if (raw) cachedPasswordMap = JSON.parse(raw);
      } catch (_) {}
    }

    const headers = ['No', 'Nama Pengguna', 'Username', 'Password', 'Email', 'Hak Akses', 'Penugasan/Kelas', 'Metode Auth'];
    const rows = filteredUsers.map((u, idx) => {
      const details = getUserAssignmentDetails(u);
      const authType = isGoogleUser(u) ? 'Google SSO' : 'Supabase';
      const pwd = isGoogleUser(u)
        ? 'Login Google'
        : (u.password || cachedPasswordMap[u.id] || (u.username ? cachedPasswordMap[u.username.toLowerCase()] : '') || '-');
      return [
        idx + 1,
        `"${(u.name || '').replace(/"/g, '""')}"`,
        `"${(u.username || '').replace(/"/g, '""')}"`,
        `"${pwd.replace(/"/g, '""')}"`,
        `"${(u.email || '-').replace(/"/g, '""')}"`,
        `"${details.roleLabel}"`,
        `"${(details.assignmentText || '-').replace(/"/g, '""')}"`,
        `"${authType}"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Data_Pengguna_${schoolProfile?.namaSekolah || 'Sekolah'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Data pengguna berhasil diekspor ke format CSV / Spreadsheet', 'success');
  };

  // Helper to map UserAccount[] to GeneratedAccountResult[] for PDF export
  const mapUsersToExportAccounts = (userList: UserAccount[]): GeneratedAccountResult[] => {
    let cachedPasswordMap: Record<string, string> = {};
    const schoolId = currentUser?.schoolId;
    if (schoolId) {
      try {
        const raw = localStorage.getItem(`kawacanaan_account_passwords_${schoolId}`);
        if (raw) cachedPasswordMap = JSON.parse(raw);
      } catch (_) {}
    }

    return userList.map((u) => {
      const details = getUserAssignmentDetails(u);
      let category: 'ADMIN' | 'GURU' | 'SISWA' | 'KEPALA SEKOLAH' = 'ADMIN';

      if (u.role === 'SISWA') {
        category = 'SISWA';
      } else if (u.role === 'KEPALA SEKOLAH') {
        category = 'KEPALA SEKOLAH';
      } else if (u.role === 'WALI KELAS' || u.role === 'GURU MAPEL') {
        category = 'GURU';
      } else {
        category = 'ADMIN';
      }

      let pwdDisplay = u.password || cachedPasswordMap[u.id] || (u.username ? cachedPasswordMap[u.username.toLowerCase()] : '') || '';
      if (isGoogleUser(u)) {
        pwdDisplay = 'Google SSO';
      }

      return {
        id: u.id,
        name: u.name,
        username: u.username,
        password: pwdDisplay,
        role: u.role,
        category,
        className: details.assignmentText || details.classes.join(', ') || '-',
        status: 'ACTIVE' as any,
      };
    });
  };

  // Unified Export PDF handler (Guru / Siswa / Semua Akun)
  const handleExportPDF = async (scope: 'GURU' | 'SISWA' | 'ALL') => {
    setIsExportingPdf(true);
    setShowExportMenu(false);
    setShowMainExportMenu(false);
    try {
      let targetAccounts: GeneratedAccountResult[] = [];
      let filterCategory = 'ALL';
      let docTitle = 'DAFTAR REKAPITULASI AKUN PENGGUNA & PASSWORD ACAK';

      const sourceList = generatedResults && generatedResults.length > 0
        ? generatedResults
        : mapUsersToExportAccounts(users);

      if (scope === 'GURU') {
        targetAccounts = sourceList.filter(
          (r) =>
            r.category === 'GURU' ||
            r.category === 'KEPALA SEKOLAH' ||
            r.role === 'GURU MAPEL' ||
            r.role === 'WALI KELAS' ||
            r.role === 'KEPALA SEKOLAH'
        );
        filterCategory = 'GURU';
        docTitle = 'DAFTAR REKAPITULASI AKUN GURU & KEPALA SEKOLAH';
      } else if (scope === 'SISWA') {
        targetAccounts = sourceList.filter(
          (r) => r.category === 'SISWA' || r.role === 'SISWA'
        );
        filterCategory = 'SISWA';
        docTitle = 'DAFTAR REKAPITULASI AKUN PESERTA DIDIK (SISWA)';
      } else {
        targetAccounts = sourceList;
        filterCategory = 'ALL';
        docTitle = 'DAFTAR REKAPITULASI AKUN PENGGUNA & PASSWORD ACAK';
      }

      if (targetAccounts.length === 0) {
        showToast('Tidak ada data akun untuk diekspor ke PDF.', 'warning');
        return;
      }

      await exportGeneratedAccountsPdf({
        schoolProfile,
        systemConfig,
        accounts: targetAccounts,
        categoryFilter: filterCategory,
        adminName: currentUser?.name || currentUser?.username || 'Administrator Sekolah',
        documentTitle: docTitle,
      });

      const scopeName = scope === 'GURU' ? 'Akun Guru & KS' : scope === 'SISWA' ? 'Akun Siswa' : 'Semua Akun Pengguna';
      showToast(`Dokumen PDF Rekapitulasi ${scopeName} berhasil diekspor dengan kop surat resmi.`, 'success');
    } catch (err) {
      console.error('Error generating PDF:', err);
      showToast('Gagal membuat dokumen PDF.', 'error');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const filteredGeneratedResults = useMemo(() => {
    if (!generatedResults || !Array.isArray(generatedResults)) return [];
    return generatedResults.filter((r) => {
      if (!r) return false;
      const matchTab =
        resultFilterTab === 'ALL'
          ? true
          : resultFilterTab === 'GURU'
          ? r.category === 'GURU'
          : resultFilterTab === 'SISWA'
          ? r.category === 'SISWA'
          : r.category === 'KEPALA SEKOLAH';
      const q = (resultSearchTerm || '').trim().toLowerCase();
      const matchSearch =
        !q ||
        (r.name || '').toLowerCase().includes(q) ||
        (r.username || '').toLowerCase().includes(q) ||
        ((r.className || '').toLowerCase().includes(q));
      return matchTab && matchSearch;
    });
  }, [generatedResults, resultFilterTab, resultSearchTerm]);

  return (
    <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-5 space-y-3.5 sm:space-y-4 animate-in fade-in duration-200">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setActiveView('dashboard')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer min-h-[34px]"
          id="btn-back-dashboard"
        >
          <ArrowLeft size={14} />
          <span>Dashboard</span>
        </button>

        {!isPersonalWorkspace && (
          <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
            <School size={13} className="text-blue-600" />
            <span>{schoolProfile?.namaSekolah || 'Sistem Sekolah'}</span>
          </div>
        )}
      </div>

      {/* Header & Main Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
            <UserCheck size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Data Pengguna & Hak Akses</h1>
              {!isPersonalWorkspace && (
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-extrabold border border-blue-200/60">
                  {stats.total} Akun
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola kredensial login, hak akses akun, dan cetak dokumen kredensial resmi.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Add User Manual Button - Hanya muncul di Ruang Kerja Sekolah, dihilangkan di Ruang Kerja Individu */}
          {!isPersonalWorkspace && (
            <button
              type="button"
              onClick={openAddUser}
              id="btn-add-user"
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer min-h-[36px]"
              title="Tambah akun pengguna baru secara manual"
            >
              <Plus size={15} />
              <span>Tambah Pengguna</span>
            </button>
          )}

          {/* Export Dropdown (PDF & CSV) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMainExportMenu((prev) => !prev)}
              disabled={isExportingPdf}
              className="px-3 py-2 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 font-extrabold text-xs rounded-xl border border-slate-200 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[36px]"
              title="Export atau Cetak Dokumen PDF Resmi"
              id="btn-main-export-menu"
            >
              {isExportingPdf ? (
                <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download size={14} className="text-slate-600" />
              )}
              <span>Export & Cetak</span>
              <ChevronDown size={12} className={`transition-transform duration-200 ${showMainExportMenu ? 'rotate-180' : ''}`} />
            </button>

            {showMainExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMainExportMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 text-slate-800">
                  <div className="px-3.5 py-1.5 border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Pilihan Ekspor & Cetak Resmi
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => handleExportPDF('ALL')}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer group"
                    id="btn-main-export-pdf-all"
                  >
                    <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors shadow-2xs">
                      <Printer size={14} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-purple-700">
                        Cetak PDF Rekapitulasi Semua Akun
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        Rekapitulasi lengkap ({stats.total} akun)
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportPDF('GURU')}
                    className="w-full px-3 py-2 text-left hover:bg-blue-50/80 flex items-center gap-2.5 transition-colors cursor-pointer group"
                    id="btn-main-export-pdf-guru"
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-2xs">
                      <GraduationCap size={14} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700">
                        Cetak PDF Akun Guru & KS
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        Kop Surat Resmi ({stats.guruKsTotal} akun)
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportPDF('SISWA')}
                    className="w-full px-3 py-2 text-left hover:bg-emerald-50/80 flex items-center gap-2.5 transition-colors cursor-pointer group"
                    id="btn-main-export-pdf-siswa"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-2xs">
                      <Users size={14} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700">
                        Cetak PDF Akun Siswa
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        Kop Surat Resmi ({stats.siswa} akun)
                      </div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Generate Accounts Button */}
          <button
            onClick={() => handleOpenGenerate(true)}
            id="btn-generate-akun"
            className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[36px]"
            title={
              isPersonalWorkspace && !isTeacherPro
                ? 'Upgrade ke Paket Guru untuk mengaktifkan fitur Generate Akun & Password otomatis'
                : 'Generate semua akun otomatis dari data referensi Guru & Siswa dengan password yang diacak'
            }
          >
            <Sparkles size={14} />
            <span>Generate Akun & Password</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {stats.unlinkedTeachersCount > 0 || stats.unlinkedStudentsCount > 0 ? (
        <div className="bg-amber-50/90 border border-amber-200/80 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <AlertTriangle size={17} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">
                Data Pengguna Belum Tersinkronkan Sepenuhnya
              </h4>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Terdapat{' '}
                {stats.unlinkedTeachersCount > 0 && (
                  <span className="font-bold">{stats.unlinkedTeachersCount} Guru </span>
                )}
                {stats.unlinkedTeachersCount > 0 && stats.unlinkedStudentsCount > 0 && 'dan '}
                {stats.unlinkedStudentsCount > 0 && (
                  <span className="font-bold">{stats.unlinkedStudentsCount} Siswa </span>
                )}
                dari data referensi yang belum memiliki akun aktif.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleOpenGenerate(false)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs rounded-lg shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Sparkles size={13} />
            <span>Generate Tersisa</span>
          </button>
        </div>
      ) : (teachers.length > 0 || students.length > 0) ? (
        <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span className="text-xs font-bold text-emerald-900">
              100% Data referensi telah memiliki akun pengguna aktif.
            </span>
          </div>
          <span className="text-[10px] font-semibold text-emerald-700 hidden md:inline">
            Total {stats.total} Akun Tersinkronkan
          </span>
        </div>
      ) : null}

      {/* Main Table Container Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 sm:p-5 space-y-3.5">
        {/* Navigation Tabs & Subfilters Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* Main Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit border border-slate-200 overflow-x-auto">
            {isPersonalWorkspace ? (
              <>
                <button
                  type="button"
                  onClick={() => { setActiveTab('guru'); setCurrentPage(1); }}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    effectiveActiveTab === 'guru' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  id="tab-guru-ks"
                >
                  <GraduationCap size={14} />
                  <span>Akun Pendidik</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-blue-100/70 text-blue-800">
                    {stats.guruKsTotal}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('siswa'); setCurrentPage(1); }}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    effectiveActiveTab === 'siswa' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  id="tab-siswa"
                >
                  <Users size={14} />
                  <span>Akun Siswa</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-emerald-100/70 text-emerald-800">
                    {stats.siswa}
                  </span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  id="tab-all"
                >
                  Semua ({stats.total})
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('administrator'); setCurrentPage(1); }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'administrator' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  id="tab-admin"
                >
                  Administrator ({stats.admin})
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('guru'); setCurrentPage(1); }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'guru' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  id="tab-guru-ks"
                >
                  Guru & KS ({stats.guruKsTotal})
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('siswa'); setCurrentPage(1); }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'siswa' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  id="tab-siswa"
                >
                  Siswa ({stats.siswa})
                </button>
              </>
            )}
          </div>

          {/* Sub Filters for Guru or Siswa */}
          <div className="flex flex-wrap items-center gap-2">
            {!isPersonalWorkspace && effectiveActiveTab === 'guru' && (
              <div className="flex items-center gap-1 p-0.5 bg-slate-50 rounded-lg border border-slate-200 text-xs overflow-x-auto">
                <button
                  type="button"
                  onClick={() => { setGuruSubFilter('ALL'); setCurrentPage(1); }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                    guruSubFilter === 'ALL' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  Semua ({stats.guruKsTotal})
                </button>
                <button
                  type="button"
                  onClick={() => { setGuruSubFilter('WALI_KELAS'); setCurrentPage(1); }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                    guruSubFilter === 'WALI_KELAS' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-800 hover:bg-emerald-50'
                  }`}
                >
                  Wali Kelas ({stats.wali})
                </button>
                <button
                  type="button"
                  onClick={() => { setGuruSubFilter('GURU_MAPEL'); setCurrentPage(1); }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                    guruSubFilter === 'GURU_MAPEL' ? 'bg-indigo-600 text-white shadow-xs' : 'text-indigo-800 hover:bg-indigo-50'
                  }`}
                >
                  Guru Mapel ({stats.mapel})
                </button>
                <button
                  type="button"
                  onClick={() => { setGuruSubFilter('KEPALA_SEKOLAH'); setCurrentPage(1); }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                    guruSubFilter === 'KEPALA_SEKOLAH' ? 'bg-sky-600 text-white shadow-xs' : 'text-sky-800 hover:bg-sky-50'
                  }`}
                >
                  Kepala Sekolah ({stats.kepsek})
                </button>
              </div>
            )}

            {effectiveActiveTab === 'siswa' && classes.length > 1 && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-bold text-slate-500 text-[11px]">Rombel:</span>
                <select
                  value={siswaClassFilter}
                  onChange={(e) => { setSiswaClassFilter(e.target.value); setCurrentPage(1); }}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="ALL">Semua Rombel ({stats.siswa})</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.name}>
                      Kelas {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Auth Filter (Only for Siswa or School Workspace) */}
            {(!isPersonalWorkspace || effectiveActiveTab === 'siswa') && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-bold text-slate-500 text-[11px]">Auth:</span>
                <select
                  value={authFilter}
                  onChange={(e) => { setAuthFilter(e.target.value as any); setCurrentPage(1); }}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="ALL">Semua Metode</option>
                  <option value="PASSWORD">Password Sistem</option>
                  <option value="GOOGLE">Google SSO</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Controls: Search & Per Page */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari Nama, Username, Kelas, NIP/NISN..."
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end text-[11px] font-semibold text-slate-500">
            <span>TAMPILKAN:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-600 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto border border-slate-200/80 rounded-xl shadow-2xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-bold text-blue-700 uppercase tracking-widest bg-blue-50/60">
                <th className="py-2.5 px-3 sm:px-3.5 w-12 rounded-l-xl">NO</th>
                <th className="py-2.5 px-3 sm:px-3.5 min-w-44">NAMA PENGGUNA</th>
                <th className="py-2.5 px-3 sm:px-3.5 w-36">USERNAME</th>
                <th className="py-2.5 px-3 sm:px-3.5 text-center w-32">AUTH / STATUS</th>
                <th className="py-2.5 px-3 sm:px-3.5 min-w-40">HAK AKSES</th>
                <th className="py-2.5 px-3 sm:px-3.5 text-center w-28 rounded-r-xl">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {currentUsers.length > 0 ? (
                currentUsers.map((u, idx) => {
                  const details = getUserAssignmentDetails(u);
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 sm:px-3.5 font-semibold text-slate-400">
                        {startIndex + idx + 1}
                      </td>
                      <td className="py-2.5 px-3 sm:px-3.5">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{u.name}</span>
                        </div>
                        {u.email && !u.email.toLowerCase().endsWith('@login.edushift.local') && (
                          <div className="text-[11px] text-slate-400 font-normal">{u.email}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 sm:px-3.5 font-mono font-bold text-blue-600 text-xs">
                        {u.username}
                      </td>
                      <td className="py-2.5 px-3 sm:px-3.5 text-center">
                        {isGoogleUser(u) ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-bold select-none"
                            title="Autentikasi Akun Google (SSO)"
                          >
                            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                            </svg>
                            <span className="font-extrabold text-[11px] text-slate-800 tracking-tight">Google</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50/90 border border-emerald-200/80 text-emerald-900 text-[11px] font-bold select-none"
                            title="Autentikasi Sistem Terenkripsi"
                          >
                            <svg className="w-3 h-3 shrink-0" viewBox="0 0 109 113" fill="none">
                              <path d="M63.7076 110.284C60.848 113.885 55.0243 111.972 54.8437 107.382L51.8131 30.3957H99.4136C105.794 30.3957 109.314 37.8447 105.247 42.7364L63.7076 110.284Z" fill="#3ECF8E"/>
                              <path d="M45.617 2.71633C48.4766 -0.884572 54.3003 1.02847 54.4809 5.61836L57.5115 82.6043H9.91097C3.53073 82.6043 0.0108376 75.1553 4.07765 70.2636L45.617 2.71633Z" fill="#3ECF8E"/>
                            </svg>
                            <span className="font-extrabold text-[10px] text-emerald-950 tracking-tight">Terenkripsi</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 sm:px-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${details.badgeColor}`}>
                          {details.type === 'WALI_KELAS' ? (
                            <GraduationCap size={12} className="text-emerald-700 shrink-0" />
                          ) : details.type === 'GURU_MAPEL' ? (
                            <BookOpen size={12} className="text-indigo-700 shrink-0" />
                          ) : details.type === 'KEPALA_SEKOLAH' ? (
                            <ShieldCheck size={12} className="text-sky-700 shrink-0" />
                          ) : details.type === 'ADMIN' ? (
                            <ShieldCheck size={12} className="text-purple-700 shrink-0" />
                          ) : (
                            <Users size={12} className="text-slate-600 shrink-0" />
                          )}
                          <span className="text-[11px]">{details.roleLabel}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 sm:px-3.5 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          {/* Copy Credential Format */}
                          <button
                            type="button"
                            onClick={() => handleCopyCredentialMessage(u)}
                            className="p-1 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Salin Pesan Kredensial Login (Username & Password)"
                            id={`btn-copy-credential-${u.id}`}
                          >
                            {copiedUserId === u.id ? <Check size={13} className="text-emerald-600 stroke-[3]" /> : <Share2 size={13} />}
                          </button>

                          {/* Edit User */}
                          <button
                            onClick={() => openEditUser(u)}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Data & Username Pengguna"
                            id={`btn-edit-user-${u.id}`}
                          >
                            <Edit2 size={13} />
                          </button>

                          {/* Change Password */}
                          <button
                            onClick={() => {
                              setTargetPasswordUser(u);
                              setNewPassword(u.password || '');
                              setShowModalPassword(true);
                            }}
                            className="p-1 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Ubah Password"
                            id={`btn-change-password-${u.id}`}
                          >
                            <Key size={13} />
                          </button>

                          {/* Delete User */}
                          <button
                            onClick={() => setUserToDelete(u)}
                            disabled={currentUser?.id === u.id}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title={currentUser?.id === u.id ? 'Tidak dapat menghapus akun Anda sendiri' : 'Hapus Akun'}
                            id={`btn-delete-user-${u.id}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400 font-medium">
                    Tidak ada akun pengguna yang terdaftar atau sesuai filter pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Status Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-500">
          <div>
            MENAMPILKAN {Math.min(startIndex + 1, filteredUsers.length)} - {Math.min(startIndex + pageSize, filteredUsers.length)} DARI {filteredUsers.length} PENGGUNA
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs"
            >
              Sebelumnya
            </button>
            <span className="px-2.5 py-1 font-bold text-slate-800 text-xs">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {!isPersonalWorkspace && isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 text-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                  <Plus size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Tambah Akun Pengguna Baru</h3>
                  <p className="text-[11px] text-slate-500">Buat akun untuk Admin, Guru, KS, atau Siswa</p>
                </div>
              </div>
              <button
                onClick={() => !isSubmittingAdd && setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 pt-4">
              {/* Role Selection */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  HAK AKSES / PERAN
                </label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-blue-600 focus:bg-white outline-none cursor-pointer"
                >
                  <option value="WALI KELAS">GURU WALI KELAS</option>
                  <option value="GURU MAPEL">GURU MATA PELAJARAN</option>
                  <option value="KEPALA SEKOLAH">KEPALA SEKOLAH</option>
                  <option value="ADMIN">ADMINISTRATOR</option>
                  <option value="SISWA">PESERTA DIDIK (SISWA)</option>
                </select>
              </div>

              {/* Quick Pick from Master Teachers if Role is Teacher / KS */}
              {(addRole === 'WALI KELAS' || addRole === 'GURU MAPEL' || addRole === 'KEPALA SEKOLAH') && (
                <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-1.5">
                  <label className="block text-[10px] font-bold text-blue-900 uppercase tracking-wider">
                    PILIH DARI DATA REFERENSI GURU (OPSIONAL)
                  </label>
                  <select
                    onChange={(e) => handleSelectTeacherForAdd(e.target.value)}
                    defaultValue=""
                    className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-xs font-medium text-slate-800 outline-none"
                  >
                    <option value="">-- Pilih Guru dari Data Referensi --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nama} ({t.nip && t.nip !== '-' ? `NIP: ${t.nip}` : 'Non-NIP'}) — {t.tugasUtama || 'Pendidik'}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-blue-700">
                    Memilih guru akan otomatis mengisi Nama, Username (NIP), dan penugasan kelas.
                  </p>
                </div>
              )}

              {/* Quick Pick from Master Students if Role is Student */}
              {addRole === 'SISWA' && (
                <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-1.5">
                  <label className="block text-[10px] font-bold text-emerald-900 uppercase tracking-wider">
                    PILIH DARI DATA REFERENSI SISWA (OPSIONAL)
                  </label>
                  <select
                    onChange={(e) => handleSelectStudentForAdd(e.target.value)}
                    defaultValue=""
                    className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-xs font-medium text-slate-800 outline-none"
                  >
                    <option value="">-- Pilih Siswa dari Data Referensi --</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nama} ({s.nisn && s.nisn !== '-' ? `NISN: ${s.nisn}` : 'No NISN'}) — {s.className || 'Tanpa Kelas'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  NAMA LENGKAP PENGGUNA *
                </label>
                <input
                  type="text"
                  required
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="Masukkan nama lengkap"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:border-blue-600 focus:bg-white outline-none"
                />
              </div>

              {/* Username & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    USERNAME LOGIN *
                  </label>
                  <input
                    type="text"
                    required
                    value={addUsername}
                    onChange={(e) => setAddUsername(e.target.value.replace(/\s+/g, '').toLowerCase())}
                    placeholder="contoh: 19850101... atau admin"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-medium text-slate-900 focus:border-blue-600 focus:bg-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    EMAIL GOOGLE (OPSIONAL)
                  </label>
                  <input
                    type="email"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="user@sekolah.sch.id"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:border-blue-600 focus:bg-white outline-none"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    PASSWORD AKUN *
                  </label>
                  <button
                    type="button"
                    onClick={() => setAddPassword(generateRandomPassword(8))}
                    className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer"
                  >
                    Acak Password Baru
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showAddPassword ? 'text' : 'password'}
                    required
                    minLength={4}
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 focus:border-blue-600 focus:bg-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddPassword(!showAddPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showAddPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Assignment Details for Teachers */}
              {isTeacherRole(addRole) && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest">
                    PENUGASAN ROMBEL / MATA PELAJARAN
                  </label>

                  {addRole === 'WALI KELAS' && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                        PILIH ROMBEL KELAS BINAAN (1 KELAS)
                      </label>
                      <select
                        value={addSingleClassId}
                        onChange={(e) => setAddSingleClassId(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-blue-600 outline-none"
                      >
                        <option value="">Pilih Rombel...</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            Kelas {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {addRole === 'GURU MAPEL' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                          MATA PELAJARAN YANG DIAMPU
                        </label>
                        <select
                          value={addSubjectId}
                          onChange={(e) => setAddSubjectId(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-blue-600 outline-none"
                        >
                          <option value="">Pilih Mata Pelajaran...</option>
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.code || 'Mapel'})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                          PILIH ROMBEL KELAS YANG DIAJAR (BISA MULTI-ROMBEL)
                        </label>
                        <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-white rounded-xl border border-slate-200">
                          {classes.map((c) => (
                            <label key={c.id} className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                              <input
                                type="checkbox"
                                checked={addClassIds.includes(c.id)}
                                onChange={(e) =>
                                  setAddClassIds((v) =>
                                    e.target.checked ? [...v, c.id] : v.filter((id) => id !== c.id)
                                  )
                                }
                                className="rounded text-blue-600"
                              />
                              Kelas {c.name}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSubmittingAdd}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingAdd ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check size={15} />
                  )}
                  <span>Simpan Akun Pengguna</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 text-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Edit2 size={16} className="text-blue-600" />
                <span>Edit Data Pengguna</span>
              </h3>
              <button
                onClick={() => setEditUser(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5 pt-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  NAMA PENGGUNA
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:border-blue-600 focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  EMAIL GOOGLE / EMAIL LOGIN
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="contoh: nama@gmail.com atau guru@belajar.id"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:border-blue-600 focus:bg-white outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                  Jika diisi dengan email Google aktif, pengguna dapat langsung masuk menekan tombol <strong>Lanjutkan dengan Google</strong>.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  USERNAME
                </label>
                <input
                  type="text"
                  required
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:border-blue-600 focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  HAK AKSES (ROLE) — PERMANEN
                </label>
                <select
                  value={editRole}
                  disabled
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-500 cursor-not-allowed"
                >
                  <option value="ADMIN">ADMINISTRATOR</option>
                  <option value="KEPALA SEKOLAH">KEPALA SEKOLAH</option>
                  <option value="WALI KELAS">WALI KELAS</option>
                  <option value="GURU MAPEL">GURU MAPEL</option>
                  <option value="SISWA">SISWA</option>
                </select>
                <p className="text-[10px] text-amber-700 mt-1 font-medium">
                  * Kebijakan Sistem Paket: Peran kunci bersifat permanen dan tidak dapat diubah setelah pendaftaran karena terikat aturan paket & kapasitas ruang kerja.
                </p>
              </div>

              {isTeacherRole(editRole) && (
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
                  <label className="block text-[10px] font-bold text-blue-900 uppercase tracking-widest">
                    TIPE PENUGASAN GURU
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditTeacherType('wali_kelas')}
                      className={`p-2.5 rounded-lg border text-left text-xs font-bold transition-all cursor-pointer ${
                        editTeacherType === 'wali_kelas'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <GraduationCap size={14} />
                        <span>Wali Kelas</span>
                      </div>
                      <p className={`text-[10px] mt-1 font-normal ${editTeacherType === 'wali_kelas' ? 'text-blue-100' : 'text-slate-400'}`}>
                        1 rombel binaan
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditTeacherType('guru_mapel')}
                      className={`p-2.5 rounded-lg border text-left text-xs font-bold transition-all cursor-pointer ${
                        editTeacherType === 'guru_mapel'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <BookOpen size={14} />
                        <span>Guru Mapel</span>
                      </div>
                      <p className={`text-[10px] mt-1 font-normal ${editTeacherType === 'guru_mapel' ? 'text-blue-100' : 'text-slate-400'}`}>
                        Banyak rombel
                      </p>
                    </button>
                  </div>

                  {editTeacherType === 'wali_kelas' ? (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                        PILIH KELAS BINAAN (1 KELAS)
                      </label>
                      <select
                        value={editSingleClassId}
                        onChange={(e) => setEditSingleClassId(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:border-blue-600 outline-none"
                      >
                        <option value="">Belum ditentukan (Pilih nanti)</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            Kelas {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                        PILIH KELAS YANG DIAJAR (BISA LEBIH DARI 1)
                      </label>
                      <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-white rounded-xl border border-slate-200">
                        {classes.map((c) => (
                          <label key={c.id} className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editClassIds.includes(c.id)}
                              onChange={(e) =>
                                setEditClassIds((v) =>
                                  e.target.checked ? [...v, c.id] : v.filter((id) => id !== c.id)
                                )
                              }
                              className="rounded text-blue-600"
                            />
                            Kelas {c.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {editRole === 'SISWA' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">HUBUNGKAN DENGAN SISWA</label>
                  <select
                    value={editStudentId}
                    onChange={(e) => setEditStudentId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:border-blue-600 outline-none"
                  >
                    <option value="">Pilih siswa yang terhubung...</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nama} — {s.nisn} ({s.className || 'Tanpa Kelas'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {targetPasswordUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 text-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Key size={16} className="text-blue-600" />
                <span>Ubah Password Akun</span>
              </h3>
              <button
                onClick={() => setTargetPasswordUser(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSavePassword} className="space-y-4 pt-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Pengguna:</span>
                  <span className="font-bold text-slate-800">{targetPasswordUser.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Username:</span>
                  <span className="font-mono text-slate-700">{targetPasswordUser.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Password Saat Ini:</span>
                  <span className="font-mono font-bold text-blue-700 select-all">
                    {targetPasswordUser.password || '-'}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    PASSWORD BARU
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewPassword(generateRandomPassword(8))}
                    className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer"
                  >
                    Acak Password
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showModalPassword ? 'text' : 'password'}
                    required
                    minLength={4}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Masukkan password baru"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-semibold text-slate-900 focus:border-blue-600 focus:bg-white outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowModalPassword(!showModalPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showModalPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Password dapat langsung dilihat tanpa sensor.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTargetPasswordUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md cursor-pointer"
                >
                  Simpan Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 text-slate-800">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
                <AlertTriangle size={20} />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Hapus Akun Pengguna?</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Apakah Anda yakin ingin menghapus akun <strong>{userToDelete.name}</strong> (@{userToDelete.username})? Tindakan ini akan menghapus akun login, profil, dan seluruh relasi penugasan terkait secara permanen dari database.
            </p>
            <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isDeleting ? 'Menghapus...' : 'Hapus Akun'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Confirmation Modal */}
      {isGenerateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 text-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Generate Akun Pengguna & Password Acak</h3>
                  <p className="text-[11px] text-slate-500">Sinkronisasi & pembuatan akun otomatis dari Data Referensi</p>
                </div>
              </div>
              <button
                onClick={() => !isGenerating && setIsGenerateModalOpen(false)}
                disabled={isGenerating}
                className="text-slate-400 hover:text-slate-700 cursor-pointer disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <span className="block text-lg font-black text-blue-700">{teachers.length}</span>
                  <span className="text-[10px] font-bold text-blue-600 uppercase">Data Guru</span>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="block text-lg font-black text-emerald-700">{students.length}</span>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase">Data Siswa</span>
                </div>
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                  <span className="block text-lg font-black text-purple-700">{schoolProfile.namaKepalaSekolah ? '1' : '0'}</span>
                  <span className="text-[10px] font-bold text-purple-600 uppercase">Kepala Sekolah</span>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed space-y-1">
                <p className="font-bold text-amber-950 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-amber-700" />
                  Bagaimana Proses Generate Bekerja?
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-800 text-[11px]">
                  <li>
                    {isPersonalWorkspace
                      ? 'Sistem akan membuatkan akun dan password acak aman untuk Kepala Sekolah dan Siswa sesuai dengan data yang telah Anda inputkan.'
                      : 'Membaca semua data Guru dan Siswa yang telah tersimpan di Data Referensi.'}
                  </li>
                  <li>Membuatkan akun login dan <b>men-generate password acak 8 karakter</b> untuk masing-masing pengguna.</li>
                  <li>
                    {isPersonalWorkspace
                      ? 'Menghubungkan akun Kepala Sekolah dan Siswa ke ruang kerja individu Anda secara otomatis.'
                      : 'Menyimpan dan menghubungkan pembagian kelas bagi Guru Wali Kelas dan Guru Mapel secara otomatis.'}
                  </li>
                </ul>
              </div>

              {/* Strategy Choice: Radio Cards */}
              <div className="space-y-2">
                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">
                  PILIH STRATEGI PEMBUATAN PASSWORD:
                </label>

                <div className="grid grid-cols-1 gap-2.5">
                  {/* Option 1: Reset All */}
                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                      generateResetExisting
                        ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/30'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="generateStrategy"
                      checked={generateResetExisting === true}
                      onChange={() => setGenerateResetExisting(true)}
                      disabled={isGenerating}
                      className="mt-1 text-amber-600 focus:ring-amber-500"
                    />
                    <div className="text-xs">
                      <div className="font-extrabold text-slate-900 flex items-center gap-2">
                        <span>Acak Ulang Password untuk Semua Akun</span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-200 text-amber-900">
                          Rekomendasi
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        Sistem membuatkan password acak baru 8 karakter untuk seluruh Guru, KS, dan Siswa serta menyinkronkannya ke sistem login. Semua kredensial langsung terdata ulang di tabel dan siap dicetak di dokumen PDF baru.
                      </p>
                    </div>
                  </label>

                  {/* Option 2: New Users Only */}
                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                      !generateResetExisting
                        ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-400/30'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="generateStrategy"
                      checked={generateResetExisting === false}
                      onChange={() => setGenerateResetExisting(false)}
                      disabled={isGenerating}
                      className="mt-1 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="text-xs">
                      <div className="font-extrabold text-slate-900">
                        Hanya Pengguna Baru Saja
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        Hanya membuat akun dan password acak baru bagi guru atau siswa yang belum terdaftar. Akun yang sudah ada sebelumnya tidak akan diubah password-nya.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsGenerateModalOpen(false)}
                  disabled={isGenerating}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleGenerateSubmit}
                  disabled={isGenerating}
                  className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-xl shadow-md cursor-pointer flex items-center gap-2 disabled:opacity-75"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sedang Mengenerate...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>Mulai Generate</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generated Accounts Result Modal */}
      {generatedResults && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 text-slate-800">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-xs">
                  <Check size={20} className="stroke-[3]" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Hasil Generate Akun & Password Acak</h3>
                  <p className="text-xs text-slate-500">
                    Total {generatedResults.length} akun diproses ({generatedResults.filter(r => r.status === 'CREATED').length} akun baru dibuat, {generatedResults.filter(r => r.status === 'UPDATED').length} password diacak ulang).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Copy All Credentials Button */}
                <button
                  type="button"
                  onClick={handleCopyAllGeneratedCredentials}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Salin semua akun dan password ke clipboard"
                  id="btn-copy-all-credentials"
                >
                  <Copy size={13} />
                  <span className="hidden sm:inline">Salin Semua</span>
                </button>

                {/* Export PDF Button with 3 Choices: Semua / Guru / Siswa */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowExportMenu((prev) => !prev)}
                    disabled={isExportingPdf || !generatedResults || generatedResults.length === 0}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Pilih untuk mengekspor PDF Rekapitulasi Akun"
                    id="btn-export-pdf-generated"
                  >
                    {isExportingPdf ? (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Printer size={13} />
                    )}
                    <span>Export PDF</span>
                    <ChevronDown size={13} className={`transition-transform duration-200 ${showExportMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {showExportMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowExportMenu(false)}
                      />
                      <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 text-slate-800">
                        <div className="px-3.5 py-1.5 border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                          Pilihan Cetak Dokumen PDF
                        </div>

                        <button
                          type="button"
                          onClick={() => handleExportPDF('ALL')}
                          className="w-full px-3.5 py-2.5 text-left hover:bg-rose-50/80 flex items-center gap-3 transition-colors cursor-pointer group"
                          id="btn-export-pdf-all"
                        >
                          <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors shadow-xs">
                            <Printer size={16} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 group-hover:text-rose-700">
                              Export PDF Rekapitulasi Semua Akun
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">
                              Cetak seluruh {generatedResults?.length || 0} akun pengguna
                            </div>
                          </div>
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => handleExportPDF('GURU')}
                          className="w-full px-3.5 py-2.5 text-left hover:bg-rose-50/80 flex items-center gap-3 transition-colors cursor-pointer group"
                          id="btn-export-pdf-guru"
                        >
                          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-xs">
                            <GraduationCap size={16} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 group-hover:text-rose-700">
                              Export PDF Guru & KS
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">
                              Cetak Akun Guru Wali Kelas, Guru Mapel & KS ({generatedResults?.filter(r => r.category === 'GURU' || r.category === 'KEPALA SEKOLAH' || r.role === 'GURU MAPEL' || r.role === 'WALI KELAS' || r.role === 'KEPALA SEKOLAH').length || 0} akun)
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExportPDF('SISWA')}
                          className="w-full px-3.5 py-2.5 text-left hover:bg-rose-50/80 flex items-center gap-3 transition-colors cursor-pointer group"
                          id="btn-export-pdf-siswa"
                        >
                          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-xs">
                            <Users size={16} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 group-hover:text-rose-700">
                              Export PDF Siswa
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">
                              Cetak Akun Peserta Didik ({generatedResults?.filter(r => r.category === 'SISWA' || r.role === 'SISWA').length || 0} akun)
                            </div>
                          </div>
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={() => setGeneratedResults(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-3 sm:px-5 sm:py-3 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs w-full sm:w-auto overflow-x-auto">
                <button
                  onClick={() => setResultFilterTab('ALL')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
                    resultFilterTab === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Semua ({generatedResults.length})
                </button>
                <button
                  onClick={() => setResultFilterTab('GURU')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
                    resultFilterTab === 'GURU' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Guru & Pendidik ({generatedResults.filter(r => r.category === 'GURU' || r.role === 'GURU MAPEL' || r.role === 'WALI KELAS').length})
                </button>
                <button
                  onClick={() => setResultFilterTab('SISWA')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
                    resultFilterTab === 'SISWA' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Siswa ({generatedResults.filter(r => r.category === 'SISWA' || r.role === 'SISWA').length})
                </button>
                <button
                  onClick={() => setResultFilterTab('KEPALA SEKOLAH')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
                    resultFilterTab === 'KEPALA SEKOLAH' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Kepala Sekolah ({generatedResults.filter(r => r.category === 'KEPALA SEKOLAH' || r.role === 'KEPALA SEKOLAH').length})
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={resultSearchTerm}
                  onChange={(e) => setResultSearchTerm(e.target.value)}
                  placeholder="Cari nama, username..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Results Table */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3 w-12">NO</th>
                      <th className="py-2.5 px-3">NAMA</th>
                      <th className="py-2.5 px-3">USERNAME</th>
                      <th className="py-2.5 px-3">PASSWORD</th>
                      <th className="py-2.5 px-3">ROLE / PENUGASAN</th>
                      <th className="py-2.5 px-3 text-center w-24">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {filteredGeneratedResults.length > 0 ? (
                      filteredGeneratedResults.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold text-slate-900">{r.name}</td>
                          <td className="py-2 px-3 font-mono text-blue-600 font-bold">{r.username}</td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded text-xs select-all">
                                {r.password}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyPassword(r.password, idx)}
                                className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors cursor-pointer"
                                title="Salin Password"
                              >
                                {copiedIndex === idx ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                              </button>
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <span className="text-[11px] font-semibold text-slate-700">
                              {r.role} {r.className ? `(${r.className})` : ''}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            {r.status === 'CREATED' ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                                BARU
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-200">
                                DIUPDATE
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-400">
                          Tidak ada data yang sesuai filter atau pencarian.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/70 rounded-b-2xl flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Menampilkan {filteredGeneratedResults.length} dari {generatedResults.length} akun
              </span>
              <button
                type="button"
                onClick={() => setGeneratedResults(null)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Tutup Jendela
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Book Loading Modal during generation */}
      <BookLoadingModal
        isOpen={isGenerating}
        progress={generateProgress}
        statusMessage={generateStatusMessage}
      />
    </div>
  );
};
