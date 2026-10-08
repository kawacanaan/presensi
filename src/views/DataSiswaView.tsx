import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Student } from '../types';
import { getFaseByClassName, getFaseBadgeColor, formatClassDisplay } from '../utils/faseKurikulum';
import { BookLoadingModal, BookVisual } from '../components/BookLoader';
import { normalizeTeacherName, normalizeNip } from '../utils/userScope';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  FileText,
  ClipboardPaste,
  Filter,
  Phone,
} from 'lucide-react';
import {
  parseImportDocument,
  mapRowsToStudents,
  downloadStudentTemplateFile,
  ParsedStudentItem,
  normalizeClassToken,
} from '../utils/documentParser';

export const DataSiswaView: React.FC = () => {
  const {
    currentUser,
    classes,
    teachers,
    students,
    subjects,
    schoolProfile,
    addClass,
    addStudent,
    updateStudent,
    deleteStudent,
    importStudents,
    showToast,
    activeWorkspace,
  } = useApp();
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';

  // Deteksi Ruang Kerja Individu dan Paket Gratis / Guru
  const isPersonalWorkspace =
    activeWorkspace?.workspaceType === 'personal' ||
    currentUser?.subscriptionPlan === 'mulai' ||
    currentUser?.subscriptionPlan === 'free' ||
    currentUser?.subscriptionPlan === 'guru' ||
    currentUser?.subscriptionPlan === 'teacher' ||
    !currentUser?.schoolId;

  const isWaliKelas = currentUser?.role === 'WALI KELAS';
  const isGuru = currentUser?.role === 'GURU MAPEL';
  const isKepalaSekolah = currentUser?.role === 'KEPALA SEKOLAH';

  // Kelas yang diampu oleh Wali Kelas (binaan) / Guru Mapel (diajarkan)
  const myAssignedClasses = useMemo(() => {
    if (isAdmin || isPersonalWorkspace) return classes;
    const ids = new Set<string>();

    const cleanUserName = normalizeTeacherName(currentUser?.name);
    const userNip = normalizeNip(currentUser?.nip) || (/^\d{8,}$/.test(currentUser?.username || '') ? normalizeNip(currentUser?.username) : '');
    const matchedTeacher = (teachers || []).find((t) => {
      if (currentUser?.teacherId && t.id === currentUser.teacherId) return true;
      if (userNip && normalizeNip(t.nip) === userNip) return true;
      if (cleanUserName && normalizeTeacherName(t.nama) === cleanUserName) return true;
      return false;
    });
    const effectiveTeacherId = currentUser?.teacherId || matchedTeacher?.id || null;
    const cleanTeacherName = matchedTeacher?.nama ? normalizeTeacherName(matchedTeacher.nama) : '';

    if (isWaliKelas) {
      if (currentUser?.classIds && currentUser.classIds.length > 0) {
        currentUser.classIds.forEach((id) => ids.add(id));
      }
      if (currentUser?.assignedClassIds && Array.isArray(currentUser.assignedClassIds)) {
        currentUser.assignedClassIds.forEach((id) => ids.add(id));
      }
      classes.forEach((c) => {
        if (effectiveTeacherId && c.waliKelasTeacherId === effectiveTeacherId) {
          ids.add(c.id);
        }
        if (c.waliKelasName) {
          const cleanWaliName = normalizeTeacherName(c.waliKelasName);
          if (cleanUserName && cleanWaliName === cleanUserName) ids.add(c.id);
          if (cleanTeacherName && cleanWaliName === cleanTeacherName) ids.add(c.id);
        }
      });
      // Fallback matching against schoolProfile
      if (ids.size === 0 && schoolProfile?.kelas) {
        const cleanSpKelas = normalizeTeacherName(schoolProfile.kelas);
        const spClass = classes.find((c) => normalizeTeacherName(c.name) === cleanSpKelas);
        if (spClass) ids.add(spClass.id);
      }
    } else if (isGuru) {
      // Guru Mapel: kelas yang diajar diambil dari targetClassIds / targetClassNames mata pelajaran
      subjects.forEach((s) => {
        const cleanSubTeacher = s.teacherName ? normalizeTeacherName(s.teacherName) : '';
        const isTeacherMatch =
          (effectiveTeacherId && s.teacherId === effectiveTeacherId) ||
          (currentUser?.subjectId && s.id === currentUser.subjectId) ||
          (cleanSubTeacher && cleanUserName && (cleanSubTeacher === cleanUserName || cleanSubTeacher.includes(cleanUserName))) ||
          (cleanSubTeacher && cleanTeacherName && (cleanSubTeacher === cleanTeacherName || cleanSubTeacher.includes(cleanTeacherName)));

        if (isTeacherMatch) {
          (s.targetClassIds || []).forEach((cid) => ids.add(cid));
          if (s.targetClassNames && s.targetClassNames.length > 0) {
            classes.forEach((c) => {
              if (s.targetClassNames?.some((cn) => cn.trim().toLowerCase() === c.name.trim().toLowerCase())) {
                ids.add(c.id);
              }
            });
          }
        }
      });
      if (currentUser?.classIds && currentUser.classIds.length > 0) {
        currentUser.classIds.forEach((id) => ids.add(id));
      }
      if (currentUser?.assignedClassIds && Array.isArray(currentUser.assignedClassIds)) {
        currentUser.assignedClassIds.forEach((id) => ids.add(id));
      }
    }

    if (activeWorkspace?.classId) {
      ids.add(activeWorkspace.classId);
    }
    const matched = classes.filter((c) => ids.has(c.id));
    if (matched.length === 0 && (isWaliKelas || isGuru)) {
      return [];
    }
    return matched;
  }, [isAdmin, isPersonalWorkspace, classes, currentUser, activeWorkspace, isWaliKelas, isGuru, subjects, teachers, schoolProfile]);

  const accessibleClassIds = useMemo(() => {
    return new Set(myAssignedClasses.map((c) => c.id));
  }, [myAssignedClasses]);

  const accessibleClassNames = useMemo(() => {
    return new Set(myAssignedClasses.map((c) => c.name.trim().toLowerCase()));
  }, [myAssignedClasses]);

  const [studentScopeFilter, setStudentScopeFilter] = useState<'all' | 'my'>('all');

  // Data siswa yang diizinkan untuk diakses:
  // Wali Kelas: HANYA menampilkan siswa di rombel binaan/penugasannya saja
  // Guru Mapel: HANYA menampilkan siswa dari kelas yang diajarkannya (dibina)
  const accessibleStudents = useMemo(() => {
    if (isAdmin || isPersonalWorkspace) return students;
    if (isWaliKelas || isGuru) {
      // Wali Kelas & Guru Mapel: strictly hanya menampilkan siswa dari kelas binaan/diajarkan
      return students.filter(
        (s) =>
          (s.classId && accessibleClassIds.has(s.classId)) ||
          (s.className && accessibleClassNames.has(s.className.trim().toLowerCase()))
      );
    }
    return students;
  }, [isAdmin, isPersonalWorkspace, isWaliKelas, isGuru, students, accessibleClassIds, accessibleClassNames]);

  const myAssignedStudentsCount = useMemo(() => {
    if (!myAssignedClasses || myAssignedClasses.length === 0) return 0;
    return students.filter(
      (s) =>
        (s.classId && accessibleClassIds.has(s.classId)) ||
        (s.className && accessibleClassNames.has(s.className.trim().toLowerCase()))
    ).length;
  }, [students, myAssignedClasses, accessibleClassIds, accessibleClassNames]);

  // Akses aksi data siswa (tambah/edit/hapus/import) & kolom AKSI
  // Tampil untuk Admin Sekolah, Ruang Kerja Individu (seluruh peran), Wali Kelas, dan Guru Mapel
  const canInputStudents = isAdmin || isPersonalWorkspace || isWaliKelas || isGuru;
  const showAksiColumn = isAdmin || isPersonalWorkspace || isWaliKelas;

  // Kuota siswa pada Paket Sesuai Aturan Resmi (Wali Kelas: 50, Guru Mapel: 300, Sekolah: 1200)
  const maxStudentsLimit = currentUser?.maxStudents || (isPersonalWorkspace ? (isGuru ? 300 : 50) : 1200);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [formData, setFormData] = useState<{
    nisn: string;
    nama: string;
    gender: 'L' | 'P';
    classId: string;
    namaWali: string;
    noHpWali: string;
    hubungannya: string;
  }>({
    nisn: '',
    nama: '',
    gender: 'L',
    classId: myAssignedClasses[0]?.id || classes[0]?.id || '',
    namaWali: '',
    noHpWali: '',
    hubungannya: 'Orang Tua',
  });

  // Delete Confirmation Modal
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);

  // Import Modal States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTab, setImportTab] = useState<'file' | 'paste'>('file');
  const [pasteText, setPasteText] = useState('');
  const [parsedStudents, setParsedStudents] = useState<ParsedStudentItem[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [detectedDocType, setDetectedDocType] = useState<string>('');
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Progressive Book Loading for Student Import
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatusMessage, setImportStatusMessage] = useState('');

  // Available classes: integrated from onboarding registration / workspace classes
  const availableClasses = useMemo(() => {
    if (isWaliKelas || isGuru) {
      return myAssignedClasses && myAssignedClasses.length > 0 ? myAssignedClasses : [];
    }
    return classes || [];
  }, [isWaliKelas, isGuru, myAssignedClasses, classes]);

  // Filter and sort students (otomatis urut alfabetis A - Z)
  const filteredStudents = useMemo(() => {
    return accessibleStudents
      .filter((s) => {
        const q = searchTerm.toLowerCase();
        const matchesSearch = s.nama.toLowerCase().includes(q) || s.nisn.includes(q);
        if (!matchesSearch) return false;

        if (selectedClassFilter !== 'ALL') {
          const selCls = availableClasses.find((c) => c.id === selectedClassFilter);
          const selNorm = selCls ? normalizeClassToken(selCls.name) : '';
          const matchesClass =
            s.classId === selectedClassFilter ||
            (selCls && s.className && s.className.toLowerCase() === selCls.name.toLowerCase()) ||
            (selNorm && s.className && normalizeClassToken(s.className) === selNorm);
          if (!matchesClass) return false;
        }

        return true;
      })
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  }, [accessibleStudents, searchTerm, selectedClassFilter, availableClasses]);

  // Pagination
  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const currentStudents = filteredStudents.slice(startIndex, startIndex + pageSize);

  const openAddModal = () => {
    // Cek apakah ada kelas yang masih memiliki kuota (< 50 siswa)
    const hasAvailableRoom = availableClasses.some((c) => {
      const count = students.filter((s) => s.classId === c.id).length;
      return count < 50;
    });

    if (availableClasses.length > 0 && !hasAvailableRoom) {
      showToast('Seluruh kelas binaan/tersedia telah mencapai kapasitas maksimal (50 siswa per kelas). Sistem menolak penambahan siswa.', 'error');
      return;
    }

    setEditingStudent(null);
    const firstNonFullClass = availableClasses.find((c) => {
      return students.filter((s) => s.classId === c.id).length < 50;
    }) || availableClasses[0];

    setFormData({
      nisn: '',
      nama: '',
      gender: 'L',
      classId: firstNonFullClass?.id || '',
      namaWali: '',
      noHpWali: '',
      hubungannya: 'Orang Tua',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      nisn: student.nisn,
      nama: student.nama,
      gender: student.gender,
      classId: student.classId || availableClasses[0]?.id || '',
      namaWali: student.namaWali || '',
      noHpWali: student.noHpWali || '',
      hubungannya: student.hubungannya || 'Orang Tua',
    });
    setIsModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNama = formData.nama.trim();
    if (!cleanNama) {
      showToast('Nama lengkap siswa wajib diisi.', 'error');
      return;
    }

    const selectedCls = availableClasses.find((c) => c.id === formData.classId) || availableClasses[0];
    const targetClassId = selectedCls && selectedCls.id !== 'onboarding-class-default' ? selectedCls.id : (availableClasses[0]?.id || classes[0]?.id || null);

    // Validasi Kebijakan Sistem Paket: Setiap kelas maksimal 50 siswa. Sistem menolak input jika melebihi batas.
    if (targetClassId) {
      const currentInTarget = students.filter(
        (s) => s.classId === targetClassId && (!editingStudent || s.id !== editingStudent.id)
      ).length;
      if (currentInTarget >= 50) {
        showToast(
          `Kapasitas ${selectedCls?.name || 'kelas ini'} maksimal 50 siswa. Sistem menolak input karena kuota kelas telah mencapai batas maksimal (50 siswa).`,
          'error'
        );
        return;
      }
    }

    setIsSavingStudent(true);
    try {
      if (editingStudent) {
        await updateStudent(editingStudent.id, {
          nisn: formData.nisn.trim(),
          nama: cleanNama.toUpperCase(),
          gender: formData.gender,
          classId: targetClassId,
          namaWali: formData.namaWali.trim(),
          noHpWali: formData.noHpWali.trim(),
          hubungannya: formData.hubungannya,
        });
      } else {
        await addStudent({
          nisn: formData.nisn.trim(),
          nama: cleanNama.toUpperCase(),
          gender: formData.gender,
          classId: targetClassId,
          namaWali: formData.namaWali.trim(),
          noHpWali: formData.noHpWali.trim(),
          hubungannya: formData.hubungannya,
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      showToast(err?.message || 'Gagal menyimpan data siswa.', 'error');
    } finally {
      setIsSavingStudent(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (isDeletingStudent) return;
    setIsDeletingStudent(true);
    try {
      await deleteStudent(id);
      setDeletingId(null);
    } catch {
      // Error is handled with toast in deleteStudent
    } finally {
      setIsDeletingStudent(false);
    }
  };

  const findMatchingClass = (rawClass: string, classList: Array<{ id: string; name: string }>) => {
    if (!rawClass || !rawClass.trim()) return undefined;
    const rawClean = rawClass.trim().toLowerCase();

    // 1. Exact match
    const exact = classList.find((c) => c.name.trim().toLowerCase() === rawClean);
    if (exact) return exact;

    // 2. Normalized token match (handles "4A", "Kelas 4A", "IV-A", "4-A", etc.)
    const normClean = normalizeClassToken(rawClass);
    if (normClean) {
      const match = classList.find((c) => normalizeClassToken(c.name) === normClean);
      if (match) return match;
    }

    // 3. Substring match
    return classList.find((c) => c.name.toLowerCase().includes(rawClean) || rawClean.includes(c.name.toLowerCase()));
  };

  // Fallback class ID jika file tidak mencantumkan kelas
  const fallbackImportClassId =
    (selectedClassFilter !== 'ALL' ? selectedClassFilter : '') ||
    myAssignedClasses[0]?.id ||
    availableClasses[0]?.id ||
    classes[0]?.id ||
    '';

  // Download Template Siswa (Excel atau CSV)
  // Format: NAMA LENGKAP, L/P, NISN, KELAS
  const handleDownloadTemplate = (format: 'xlsx' | 'csv' = 'xlsx') => {
    const currentClass = availableClasses.find((c) => c.id === fallbackImportClassId) || availableClasses[0];
    const defaultClassName = currentClass ? currentClass.name : 'Kelas 1A';
    downloadStudentTemplateFile(format, defaultClassName);
    showToast(
      `Template file ${format === 'xlsx' ? 'Excel (.xlsx)' : 'CSV (.csv)'} Siswa berhasil diunduh. Silakan lengkapi dan unggah kembali.`,
      'success'
    );
  };

  const processStudentFile = async (file: File) => {
    setFileName(file.name);
    setIsParsingFile(true);

    try {
      const docResult = await parseImportDocument(file);
      const parsed = mapRowsToStudents(
        docResult.rows,
        availableClasses,
        fallbackImportClassId,
        docResult.rawText
      );
      setParsedStudents(parsed);

      let typeName = 'File';
      if (docResult.fileType === 'excel') typeName = 'Excel (.xlsx / .xls)';
      else if (docResult.fileType === 'docx') typeName = 'Word (.docx)';
      else if (docResult.fileType === 'pdf') typeName = 'Dokumen PDF (.pdf)';
      else if (docResult.fileType === 'csv') typeName = 'File CSV (.csv)';

      setDetectedDocType(typeName);

      if (parsed.length === 0) {
        showToast(
          `Tidak ada data siswa yang terbaca dari ${file.name}. Pastikan file berisi tabel siswa dengan kolom Nama Lengkap, L/P, NISN, dan Kelas.`,
          'error'
        );
      } else {
        showToast(
          `Berhasil membaca ${parsed.length} baris data siswa dari format ${typeName} (${file.name})`,
          'success'
        );
      }
    } catch (err: any) {
      console.error('[DataSiswaView] Error parsing file:', err);
      showToast(
        `Gagal membaca file: ${err?.message || 'Format dokumen tidak didukung atau file rusak'}`,
        'error'
      );
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processStudentFile(file);
  };

  const handlePasteChange = (text: string) => {
    setPasteText(text);
    const parsed = mapRowsToStudents(
      [],
      availableClasses,
      fallbackImportClassId,
      text
    );
    setParsedStudents(parsed);
  };

  const handleExecuteImport = async () => {
    const validOnes = parsedStudents.filter((p) => p.isValid);
    if (validOnes.length === 0) {
      showToast('Tidak ada data siswa yang valid untuk diimpor', 'error');
      return;
    }

    // Validasi Kapasitas Kebijakan Sistem Paket: Maksimal 50 siswa per kelas
    const classCountMap = new Map<string, number>();
    for (const c of classes) {
      classCountMap.set(c.id, students.filter((s) => s.classId === c.id).length);
    }
    const targetAdditions = new Map<string, number>();
    for (const v of validOnes) {
      const targetClassId = v.matchedClassId || fallbackImportClassId || availableClasses[0]?.id || classes[0]?.id || 'unknown';
      targetAdditions.set(targetClassId, (targetAdditions.get(targetClassId) || 0) + 1);
    }

    for (const [clsId, addCount] of targetAdditions.entries()) {
      const currentCount = classCountMap.get(clsId) || 0;
      if (currentCount + addCount > 50) {
        const clsName = classes.find((c) => c.id === clsId)?.name || 'kelas target';
        showToast(
          `Kapasitas ${clsName} maksimal 50 siswa. Saat ini terisi ${currentCount} siswa dan akan ditambah ${addCount} siswa (total: ${currentCount + addCount}). Sistem menolak input karena melebihi batas 50 siswa.`,
          'error'
        );
        return;
      }
    }

    // Launch calm progressive book loader
    setIsImporting(true);
    setImportProgress(15);
    setImportStatusMessage(`Membaca dan memvalidasi ${validOnes.length} baris data siswa...`);

    try {
      await new Promise((res) => setTimeout(res, 400));
      setImportProgress(40);
      setImportStatusMessage('Memetakan rombel belajar dan memverifikasi NISN siswa...');

      const currentClasses = [...classes];
      const createdClassMap = new Map<string, string>();

      const payload: Array<{ nisn: string; nama: string; gender: 'L' | 'P'; classId: string | null }> = [];

      for (const s of validOnes) {
        let targetClassId = s.matchedClassId || null;

        if (!targetClassId && s.classNameInput && (isAdmin || isPersonalWorkspace || isWaliKelas)) {
          const inputClean = s.classNameInput.trim();
          if (createdClassMap.has(inputClean.toLowerCase())) {
            targetClassId = createdClassMap.get(inputClean.toLowerCase()) || null;
          } else {
            const existing = findMatchingClass(inputClean, currentClasses);
            if (existing) {
              targetClassId = existing.id;
            } else {
              const matchNum = inputClean.match(/\d+/);
              const autoGrade = matchNum ? parseInt(matchNum[0], 10) : 1;
              try {
                await addClass({
                  name: inputClean,
                  grade: autoGrade,
                  academicYear: schoolProfile?.tahunPelajaran || '2026/2027',
                  waliKelasTeacherId: null,
                  waliKelasName: null,
                });
                const newlyAdded = classes.find((c) => c.name.trim().toLowerCase() === inputClean.toLowerCase());
                if (newlyAdded) {
                  targetClassId = newlyAdded.id;
                  createdClassMap.set(inputClean.toLowerCase(), newlyAdded.id);
                }
              } catch (_) {}
            }
          }
        }

        if (!targetClassId) {
          targetClassId = fallbackImportClassId || availableClasses[0]?.id || classes[0]?.id || null;
        }

        payload.push({
          nisn: s.nisn,
          nama: s.nama,
          gender: s.gender,
          classId: targetClassId,
        });
      }

      // Pre-validasi kapasitas maksimal 50 siswa per rombel (Hard Block)
      const classIdSimCounts: Record<string, number> = {};
      students.forEach((st) => {
        if (st.classId) {
          classIdSimCounts[st.classId] = (classIdSimCounts[st.classId] || 0) + 1;
        }
      });
      const addingCountPerClass: Record<string, number> = {};
      payload.forEach((p) => {
        if (!p.classId) return;
        const exists = students.some(
          (st) =>
            (p.nisn && st.nisn === p.nisn) ||
            st.nama.trim().toLowerCase() === p.nama.trim().toLowerCase()
        );
        if (!exists) {
          addingCountPerClass[p.classId] = (addingCountPerClass[p.classId] || 0) + 1;
        }
      });

      for (const cid of Object.keys(addingCountPerClass)) {
        const cur = classIdSimCounts[cid] || 0;
        const add = addingCountPerClass[cid] || 0;
        if (cur + add > 50) {
          const clsName = classes.find((c) => c.id === cid)?.name || 'kelas ini';
          showToast(
            `Impor dibatalkan: Rombel "${clsName}" akan melebihi batas kapasitas maksimal 50 siswa (saat ini: ${cur}, akan ditambah: ${add}). Setiap rombel dibatasi maksimal 50 siswa.`,
            'error'
          );
          setIsImporting(false);
          setImportProgress(0);
          return;
        }
      }

      setImportProgress(75);
      setImportStatusMessage('Menyimpan data siswa ke database presensi sekolah...');
      await new Promise((res) => setTimeout(res, 400));

      const distinctClasses = Array.from(new Set(payload.map((p) => p.classId).filter(Boolean)));
      const singleTargetClassId =
        distinctClasses.length === 1 ? (distinctClasses[0] as string) : undefined;

      await importStudents(payload, true, singleTargetClassId);

      setImportProgress(100);
      setImportStatusMessage('Selesai! Seluruh data siswa berhasil diperbarui.');
      await new Promise((res) => setTimeout(res, 350));

      setIsImportModalOpen(false);
      setParsedStudents([]);
      setPasteText('');
      setFileName('');
      showToast(`Berhasil mengimpor ${payload.length} data siswa.`);
    } catch (err: any) {
      showToast(err?.message || 'Gagal memproses import data siswa', 'error');
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      setImportStatusMessage('');
    }
  };

  const validCount = parsedStudents.filter((p) => p.isValid).length;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200">
      {/* Title */}
      <div className="flex items-center gap-2 text-slate-900 font-black text-lg">
        <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-xs">
          <Users size={18} />
        </div>
        <div>
          <span>Data Siswa</span>
          {isGuru && (
            <p className="text-xs text-slate-500 font-medium">
              Menampilkan siswa dari kelas yang Anda ajar ({accessibleStudents.length} siswa).
            </p>
          )}
        </div>
      </div>

      {/* Main Container Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        {/* Controls: Search, Filter Kelas, Sort By, Show count, Import button & Add button */}
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari NISN atau Nama siswa..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all"
              />
            </div>

            {/* Buttons: Import Siswa (CSV/Excel) & Add Single Student */}
            {canInputStudents && (
              <div className="flex items-center gap-2 justify-end">
                {/* Sembunyikan fitur import siswa pada ruang kerja sekolah untuk role Guru Mapel */}
                {!(isGuru && !isPersonalWorkspace) && (
                  <button
                    onClick={() => {
                      setParsedStudents([]);
                      setPasteText('');
                      setFileName('');
                      setIsImportModalOpen(true);
                    }}
                    id="btn-import-siswa-modal"
                    className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet size={15} />
                    <span>Import Siswa</span>
                  </button>
                )}

                <button
                  onClick={openAddModal}
                  id="btn-tambah-siswa"
                  className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={15} />
                  <span>Tambah Siswa</span>
                </button>
              </div>
            )}
          </div>

          {/* Secondary Controls Bar: Filter by Class and Show Entries */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2.5">
              {!isAdmin && !isPersonalWorkspace && !isWaliKelas && !isGuru && (
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setStudentScopeFilter('all');
                      setSelectedClassFilter('ALL');
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      studentScopeFilter === 'all'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua Siswa Sekolah ({students.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStudentScopeFilter('my');
                      setSelectedClassFilter('ALL');
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      studentScopeFilter === 'my'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {isWaliKelas ? 'Siswa Binaan Saya' : 'Siswa Diajar Saya'} ({myAssignedStudentsCount})
                  </button>
                </div>
              )}

              {/* Filter By Class */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700">
                <Filter size={13} className="text-slate-400" />
                <span className="text-[11px] text-slate-500 font-bold">FILTER KELAS:</span>
                <select
                  value={selectedClassFilter}
                  onChange={(e) => {
                    setSelectedClassFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent font-extrabold text-slate-800 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="ALL">
                    Semua Kelas ({accessibleStudents.length})
                  </option>
                  {availableClasses.map((c) => {
                    const count = accessibleStudents.filter(
                      (s) =>
                        s.classId === c.id ||
                        (s.className && s.className.toLowerCase() === c.name.toLowerCase())
                    ).length;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} ({getFaseByClassName(c.name, c.grade)}) - {count} siswa
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Show entries pagination dropdown */}
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span>SHOW:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                <option value={10}>10 Baris</option>
                <option value={25}>25 Baris</option>
                <option value={50}>50 Baris</option>
                <option value={100}>100 Baris</option>
              </select>
            </div>
          </div>
        </div>

        {/* Total Summary Badge */}
        <div className="flex items-center justify-between text-xs px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-bold text-slate-700">
              Menampilkan:{' '}
              <strong className="text-blue-600 font-extrabold">
                {filteredStudents.length} dari {accessibleStudents.length} Siswa{isWaliKelas ? ' Binaan' : ''}
              </strong>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">
              Laki-laki: <strong className="text-sky-700">{filteredStudents.filter((s) => s.gender === 'L').length}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">
              Perempuan: <strong className="text-rose-700">{filteredStudents.filter((s) => s.gender === 'P').length}</strong>
            </span>
          </div>
          <button
            onClick={() => handleDownloadTemplate('xlsx')}
            className="text-slate-600 hover:text-emerald-700 font-bold flex items-center gap-1.5 text-xs hover:underline cursor-pointer transition-colors"
            title="Unduh format template Excel"
          >
            <Download size={13} className="text-emerald-600" />
            <span>Template</span>
          </button>
        </div>

        {/* Students Table */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-bold text-blue-700 uppercase tracking-widest bg-blue-50/60 select-none">
                <th className="py-3.5 px-4 w-12 rounded-l-xl">NO</th>
                <th className="py-3.5 px-4">NAMA LENGKAP</th>
                <th className="py-3.5 px-4 text-center w-28">L/P</th>
                <th className="py-3.5 px-4 w-40">NISN</th>
                <th className={`py-3.5 px-4 text-center ${!showAksiColumn ? 'rounded-r-xl' : ''}`}>KELAS</th>
                {showAksiColumn && (
                  <th className="py-3.5 px-4 text-center w-24 rounded-r-xl">AKSI</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {currentStudents.length > 0 ? (
                currentStudents.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-400">
                      {startIndex + idx + 1}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 tracking-tight">{s.nama}</div>
                      {s.noHpWali && (
                        <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium mt-0.5">
                          <Phone size={11} className="text-emerald-600" />
                          <span>
                            {s.namaWali ? `${s.namaWali} (${s.hubungannya || 'Wali'}): ` : 'Wali: '}
                            {s.noHpWali}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold border ${
                          s.gender === 'L'
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {s.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-600">{s.nisn}</td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-600">
                      <div className="inline-flex items-center justify-center gap-1.5 flex-wrap">
                        <span>{s.className || 'Belum ada kelas'}</span>
                        {s.className && (
                          <span
                            className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${
                              getFaseBadgeColor(getFaseByClassName(s.className)).bg
                            }`}
                          >
                            {getFaseByClassName(s.className)}
                          </span>
                        )}
                      </div>
                    </td>
                    {showAksiColumn && (
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(s)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Siswa"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => setDeletingId(s.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Siswa"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={showAksiColumn ? 6 : 5} className="text-center py-10 text-slate-400 font-medium">
                    Tidak ada data siswa yang sesuai.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Summary */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 text-xs font-semibold text-slate-500">
          <div>
            SHOWING {filteredStudents.length > 0 ? startIndex + 1 : 0} TO{' '}
            {Math.min(startIndex + pageSize, filteredStudents.length)} OF {filteredStudents.length}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium cursor-pointer"
            >
              Prev
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  currentPage === page
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* IMPORT SISWA (EXCEL / CSV) MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 text-slate-800 max-h-[90vh] flex flex-col">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-bold">
                  <FileSpreadsheet size={22} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    Import Data Siswa Masal
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Mendukung file Excel (.xlsx), CSV, Word (.docx), &amp; PDF
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="overflow-y-auto space-y-5 py-4 flex-1 pr-1">
              {/* Step 1: Download Template Callout */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-xs text-slate-800">Format Template Standar Siswa</h4>
                  <p className="text-[11px] text-slate-500">
                    Kolom: <span className="font-semibold text-slate-700">NAMA LENGKAP, L/P, NISN, KELAS</span>
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
                  <strong>Sumber Tunggal (Replace All):</strong> File yang diunggah menjadi sumber data referensi utama siswa. Sistem akan otomatis mengganti seluruh data dan menghapus data siswa lama yang tidak terdapat dalam file terbaru ini.
                </p>
              </div>

              {/* Step 2: Choose Method (Upload File vs Paste Text) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                    Langkah 2: Masukkan Data Siswa
                  </label>
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setImportTab('file')}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                        importTab === 'file'
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Upload size={13} />
                      <span>Unggah Dokumen (Excel / CSV / Word / PDF)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportTab('paste')}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                        importTab === 'paste'
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <ClipboardPaste size={13} />
                      <span>Tempel / Paste Teks</span>
                    </button>
                  </div>
                </div>

                {importTab === 'file' ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(true);
                    }}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) processStudentFile(file);
                    }}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all space-y-3 group ${
                      isDraggingFile
                        ? 'border-emerald-500 bg-emerald-50/60 scale-[1.01] shadow-sm'
                        : 'border-blue-200 hover:border-emerald-500 bg-gradient-to-b from-blue-50/30 to-emerald-50/20 hover:bg-emerald-50/40'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx, .xls, .csv, .docx, .pdf, .txt, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/pdf, text/plain"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    {isParsingFile ? (
                      <div className="flex flex-col items-center justify-center py-4 gap-2">
                        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-bold text-blue-900">Membaca dan memproses isi dokumen siswa...</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-center py-1">
                          <BookVisual size="sm" showGlow={true} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {fileName ? (
                              <span className="text-emerald-700 font-extrabold">{fileName}</span>
                            ) : (
                              'Klik di sini untuk memilih file dokumen dari komputer'
                            )}
                          </p>
                          {detectedDocType && (
                            <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                              Format Terbaca: {detectedDocType}
                            </span>
                          )}
                          <p className="text-[11px] text-slate-500 mt-1">
                            Mendukung file Excel (.xlsx / .xls), CSV, Word (.docx), dan Dokumen PDF (.pdf)
                          </p>
                          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
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
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <textarea
                      rows={5}
                      value={pasteText}
                      onChange={(e) => handlePasteChange(e.target.value)}
                      placeholder="Salin kolom dari Excel dan tempel di sini...&#10;Format: NAMA LENGKAP	L/P	NISN	KELAS&#10;Contoh:&#10;ADLAN AR RASHAFI SUBHAN	L	3140787024	Kelas 1A&#10;AINUN FAJARIAH	P	3141380962	Kelas 1A&#10;AISYAH AZ ZAHRA	P	3149811568	Kelas 1B"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 leading-relaxed"
                    />
                    <p className="text-[11px] text-slate-400 italic">
                      Tips: Urutan kolom di Excel: NAMA LENGKAP, L/P, NISN, KELAS. Lalu blok baris, tekan Ctrl+C dan Ctrl+V di kotak ini.
                    </p>
                  </div>
                )}
              </div>

              {/* Step 3: Preview Parsed Data */}
              {parsedStudents.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-800">
                        Pratinjau Data Terdeteksi:
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-black text-xs">
                        {validCount} Siswa Siap Diimpor
                      </span>
                    </div>
                    {parsedStudents.length > validCount && (
                      <span className="text-xs font-bold text-rose-600">
                        {parsedStudents.length - validCount} Baris Tidak Valid
                      </span>
                    )}
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="p-2.5 w-10">NO</th>
                          <th className="p-2.5">NAMA LENGKAP</th>
                          <th className="p-2.5 w-16 text-center">L/P</th>
                          <th className="p-2.5 w-28">NISN</th>
                          <th className="p-2.5 w-32">KELAS</th>
                          <th className="p-2.5 w-20 text-center">STATUS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedStudents.map((item, idx) => (
                          <tr
                            key={idx}
                            className={item.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/50'}
                          >
                            <td className="p-2.5 font-bold text-slate-400">{idx + 1}</td>
                            <td className="p-2.5 font-bold text-slate-900">{item.nama}</td>
                            <td className="p-2.5 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.gender === 'L'
                                    ? 'bg-sky-50 text-sky-700'
                                    : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {item.gender === 'L' ? 'L' : 'P'}
                              </span>
                            </td>
                            <td className="p-2.5 font-mono text-slate-700 font-medium">
                              {item.nisn || <span className="text-rose-500 italic">-</span>}
                            </td>
                            <td className="p-2.5">
                              <select
                                value={item.matchedClassId || fallbackImportClassId || availableClasses[0]?.id || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const targetCls = availableClasses.find((c) => c.id === val);
                                  setParsedStudents((prev) => {
                                    const next = [...prev];
                                    next[idx] = {
                                      ...next[idx],
                                      matchedClassId: val,
                                      matchedClassName: targetCls?.name || '',
                                    };
                                    return next;
                                  });
                                }}
                                className="px-2 py-1 bg-white border border-blue-200 hover:border-blue-400 rounded-lg text-[11px] font-bold text-blue-900 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
                              >
                                {availableClasses.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2.5 text-center">
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
                {validCount > 0 ? `${validCount} siswa siap diproses` : 'Pilih file/tempel data untuk mulai'}
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
                  <span>Proses Import ({validCount} Siswa)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Single Student Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 text-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-4 pt-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  NISN
                </label>
                <input
                  type="text"
                  required
                  value={formData.nisn}
                  onChange={(e) => setFormData({ ...formData, nisn: e.target.value })}
                  placeholder="Contoh: 3140787024"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  NAMA LENGKAP
                </label>
                <input
                  type="text"
                  required
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  placeholder="Contoh: ADLAN AR RASHAFI SUBHAN"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  KELAS SISWA
                </label>
                <select
                  value={formData.classId || availableClasses[0]?.id || ''}
                  onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                  required
                >
                  {availableClasses.length > 1 && <option value="">Pilih kelas siswa...</option>}
                  {availableClasses.map((c) => {
                    const count = students.filter((s) => s.classId === c.id).length;
                    const isFull = count >= 50 && (!editingStudent || editingStudent.classId !== c.id);
                    return (
                      <option key={c.id} value={c.id} disabled={isFull}>
                        {c.name} ({getFaseByClassName(c.name, c.grade)}) — {count}/50 Siswa {isFull ? '(KAPASITAS PENUH)' : ''}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-slate-500 mt-1.5 font-medium flex items-center justify-between">
                  <span>* Kapasitas setiap rombel maksimal 50 siswa.</span>
                  {formData.classId && (
                    <span className="font-bold text-blue-700">
                      Terisi: {students.filter((s) => s.classId === formData.classId).length}/50 Siswa
                    </span>
                  )}
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  JENIS KELAMIN
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border cursor-pointer font-bold text-xs transition-all ${
                      formData.gender === 'L'
                        ? 'bg-sky-50 border-sky-400 text-sky-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="gender"
                      checked={formData.gender === 'L'}
                      onChange={() => setFormData({ ...formData, gender: 'L' })}
                      className="hidden"
                    />
                    <span>Laki-laki (L)</span>
                  </label>

                  <label
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border cursor-pointer font-bold text-xs transition-all ${
                      formData.gender === 'P'
                        ? 'bg-rose-50 border-rose-400 text-rose-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="gender"
                      checked={formData.gender === 'P'}
                      onChange={() => setFormData({ ...formData, gender: 'P' })}
                      className="hidden"
                    />
                    <span>Perempuan (P)</span>
                  </label>
                </div>
              </div>

              {/* Data Kontak Orang Tua / Wali */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs font-bold">
                    <Phone size={13} />
                  </div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Kontak Orang Tua / Wali (Untuk Notifikasi Guru)
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                      NAMA ORANG TUA / WALI
                    </label>
                    <input
                      type="text"
                      value={formData.namaWali}
                      onChange={(e) => setFormData({ ...formData, namaWali: e.target.value })}
                      placeholder="Contoh: Bapak Hendra"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:border-blue-600 focus:bg-white outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                      HUBUNGAN KELUARGA
                    </label>
                    <select
                      value={formData.hubungannya}
                      onChange={(e) => setFormData({ ...formData, hubungannya: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:border-blue-600 focus:bg-white outline-none transition-all"
                    >
                      <option value="Ayah">Ayah Kandung</option>
                      <option value="Ibu">Ibu Kandung</option>
                      <option value="Wali">Wali Murid</option>
                      <option value="Orang Tua">Orang Tua</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    NO. WHATSAPP ORANG TUA / WALI
                  </label>
                  <input
                    type="tel"
                    value={formData.noHpWali}
                    onChange={(e) => setFormData({ ...formData, noHpWali: e.target.value })}
                    placeholder="Contoh: 081234567890"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:border-blue-600 focus:bg-white outline-none transition-all"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Nomor WhatsApp ini digunakan guru/wali kelas untuk mengirimkan rekap atau pemberitahuan kehadiran siswa.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingStudent}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingStudent && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{isSavingStudent ? 'Menyimpan...' : 'Simpan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center text-slate-800">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 size={24} />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Hapus data siswa?</h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Data siswa dan seluruh data terkait, termasuk riwayat absensi, akan dihapus. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                disabled={isDeletingStudent}
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeletingStudent}
                onClick={() => void handleDelete(deletingId)}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md cursor-pointer disabled:opacity-50"
              >
                {isDeletingStudent ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Book Loading Modal for Import Data Siswa */}
      <BookLoadingModal
        isOpen={isImporting}
        title="Mengimpor Data Siswa..."
        subtitle="Sistem sedang memproses berkas, memvalidasi NISN, dan menyusun rombel belajar."
        badgeText="PROSES IMPORT DATA SISWA"
        progress={importProgress}
        statusMessage={importStatusMessage}
      />
    </div>
  );
};
