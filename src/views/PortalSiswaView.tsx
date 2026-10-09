import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Home,
  Calendar,
  User,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Clock,
  XCircle,
  HelpCircle,
  QrCode,
  MapPin,
  Smile,
  ShieldCheck,
  Info,
  Bell,
  Camera,
  RotateCcw,
  Sparkles,
  Award,
  UploadCloud,
  LogOut,
  Building,
  GraduationCap,
  CalendarDays,
  Check,
  AlertCircle,
  X,
  FileText,
  Lock,
  Navigation,
  AlertTriangle,
  HeartPulse,
  ShieldAlert,
} from 'lucide-react';
import type { Student, AttendanceRecord, SchoolClass } from '../types';
import { parseClassQrPayload } from '../utils/classQr';
import { playChimeSuccess, playChimeWarning } from '../utils/audioFeedback';
import { getServerNow, formatServerTimeString, formatServerDateString, syncServerTime } from '../utils/serverTime';
import { ParentPushNotificationCard } from '../components/ParentPushNotificationCard';
import { PWAInstallButton } from '../components/PWAInstallButton';
import {
  getDevicePushStatus,
  requestAdaptiveNativePushPermission,
  subscribeParentDevice,
  detectDeviceName,
} from '../utils/webPushManager';

type MobileScreen = 'beranda' | 'absensi-menu' | 'profil' | 'scanner' | 'riwayat' | 'detail' | 'izin-sakit';

export const PortalSiswaView: React.FC = () => {
  const {
    currentUser,
    students,
    classes,
    schoolProfile,
    systemConfig,
    attendanceRecords,
    currentAttendanceDate,
    setCurrentAttendanceDate,
    submitStudentAttendance,
    submitLeaveRequest,
    cancelLeaveRequest,
    refreshLeaveRequests,
    refreshRunningDayAttendance,
    leaveRequests,
    getDateStatus,
    showToast,
    setActiveView,
    logout,
  } = useApp();

  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    refreshLeaveRequests();
    refreshRunningDayAttendance();
    const handleSync = () => {
      refreshRunningDayAttendance();
    };
    window.addEventListener('kawacanaan_attendance_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('kawacanaan_attendance_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [refreshLeaveRequests, refreshRunningDayAttendance]);

  const [runningDate, setRunningDate] = useState<string>(() =>
    formatServerDateString(getServerNow())
  );

  // Navigation Screen State
  const [currentScreen, setCurrentScreen] = useState<MobileScreen>('beranda');
  const [previousScreen, setPreviousScreen] = useState<MobileScreen>('beranda');

  // Scanner Mode: 'masuk' or 'pulang'
  const [scannerAction, setScannerAction] = useState<'masuk' | 'pulang'>('masuk');

  // Detail screen target date
  const [selectedDetailDate, setSelectedDetailDate] = useState<string>(() =>
    formatServerDateString(getServerNow())
  );

  // Riwayat filter: 'harian' | 'mingguan' | 'bulanan'
  const [riwayatFilter, setRiwayatFilter] = useState<'harian' | 'mingguan' | 'bulanan'>('harian');

  // Month & Year state for ringkasan & riwayat
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    const d = getServerNow();
    return d.getMonth(); // 0 - 11
  });
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return getServerNow().getFullYear();
  });

  // Month selector modal toggle
  const [showMonthPickerModal, setShowMonthPickerModal] = useState<boolean>(false);

  // Camera Scanner Ref & State for Screen 2
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [scanStatusMessage, setScanStatusMessage] = useState<string>('');
  const [scanStatusType, setScanStatusType] = useState<'idle' | 'processing' | 'success' | 'rejected'>('idle');
  const isProcessingRef = useRef<boolean>(false);

  // Leave Request Form State (Fitur Pengajuan Izin / Sakit Mandiri)
  const [leaveType, setLeaveType] = useState<'sakit' | 'izin'>('sakit');
  const [leaveStartDate, setLeaveStartDate] = useState<string>(() =>
    formatServerDateString(getServerNow())
  );
  const [leaveEndDate, setLeaveEndDate] = useState<string>(() =>
    formatServerDateString(getServerNow())
  );

  // Sinkronkan tanggal hari berjalan secara realtime di Portal Siswa
  useEffect(() => {
    const syncRunningToday = () => {
      const now = getServerNow();
      const todayStr = formatServerDateString(now);
      setRunningDate((prev) => {
        if (prev !== todayStr) {
          setSelectedDetailDate(todayStr);
          setLeaveStartDate(todayStr);
          setLeaveEndDate(todayStr);
          setSelectedMonth(now.getMonth());
          setSelectedYear(now.getFullYear());
        }
        return todayStr;
      });
      if (currentAttendanceDate !== todayStr) {
        setCurrentAttendanceDate(todayStr);
      }
    };
    syncRunningToday();
    syncServerTime()
      .then(() => syncRunningToday())
      .catch(() => {});
    const timer = setInterval(syncRunningToday, 15000);
    return () => clearInterval(timer);
  }, [currentAttendanceDate, setCurrentAttendanceDate]);
  const [leaveReason, setLeaveReason] = useState<string>('');
  const [leaveRequesterRole, setLeaveRequesterRole] = useState<'Orang Tua' | 'Wali' | 'Siswa'>('Orang Tua');
  const [leaveRequesterName, setLeaveRequesterName] = useState<string>('');
  const [leaveRequesterPhone, setLeaveRequesterPhone] = useState<string>('');
  const [leaveAttachment, setLeaveAttachment] = useState<string>('');
  const [leaveAttachmentName, setLeaveAttachmentName] = useState<string>('');
  const [isSubmittingLeave, setIsSubmittingLeave] = useState<boolean>(false);

  // Getar Halus (Haptic Feedback) Helper
  const triggerHaptic = (type: 'success' | 'warning' | 'error' | 'tap' = 'tap') => {
    if (typeof window === 'undefined' || !navigator?.vibrate) return;
    try {
      if (type === 'success') {
        navigator.vibrate(45);
      } else if (type === 'warning') {
        navigator.vibrate([40, 50, 40]);
      } else if (type === 'error') {
        navigator.vibrate([70, 50, 70]);
      } else if (type === 'tap') {
        navigator.vibrate(12);
      }
    } catch (_) {}
  };

  // Resolusi akun siswa yang definitif (Sistem Produksi Nyata)
  const activeStudent: Student = useMemo(() => {
    if (currentUser?.role === 'SISWA') {
      if (currentUser.studentId) {
        const byId = students.find((s) => s.id === currentUser.studentId);
        if (byId) return byId;
      }
      const uNisn = (currentUser.username || '').trim().toLowerCase();
      const uNip = (currentUser.nip || '').trim().toLowerCase();
      if (uNisn) {
        const byNisn = students.find(
          (s) => s.nisn && String(s.nisn).trim().toLowerCase() === uNisn
        );
        if (byNisn) return byNisn;
      }
      if (uNip) {
        const byNip = students.find(
          (s) => s.nisn && String(s.nisn).trim().toLowerCase() === uNip
        );
        if (byNip) return byNip;
      }
      if (currentUser.name && currentUser.name !== 'Pengguna' && currentUser.name !== 'Siswa') {
        const uName = currentUser.name.trim().toLowerCase();
        const byName = students.find(
          (s) => s.nama && s.nama.trim().toLowerCase() === uName
        );
        if (byName) return byName;
      }

      // Jika belum cocok, cari student pada sekolah yang sama
      if (students.length > 0) {
        const bySchool = students.find((s) => s.schoolId === currentUser.schoolId);
        if (bySchool) return bySchool;
        return students[0];
      }

      const userClassId = (currentUser.classIds && currentUser.classIds[0]) || null;
      const userClassName =
        (currentUser.classNames && currentUser.classNames[0]) ||
        (userClassId ? classes.find((c) => c.id === userClassId)?.name : '') ||
        '';

      return {
        id: currentUser.studentId || currentUser.id,
        nisn: currentUser.username || currentUser.nip || '3149271621',
        nama: currentUser.name || 'Ayesha Khansa Zahira',
        gender: (currentUser.gender || currentUser.jenisKelamin || 'P') as 'L' | 'P',
        classId: userClassId,
        className: userClassName || '6A',
      };
    }

    return (
      students[0] || {
        id: 'siswa-utama',
        nisn: '3149271621',
        nama: 'Ayesha Khansa Zahira',
        gender: 'P',
        classId: null,
        className: '6A',
      }
    );
  }, [currentUser, students, classes]);

  // Status Push Notifikasi Otomatis pada Ponsel
  const [devicePushActive, setDevicePushActive] = useState<boolean>(false);

  // Inisialisasi izin notifikasi native adaptif begitu siswa/orang tua mendarat di Portal Siswa:
  // - Android / Desktop: langsung memicu dialog native izin ponsel (Notification.requestPermission()) tanpa tombol perantara.
  // - iPhone (iOS Safari / PWA): Apple mewajibkan gesture sentuhan, dipicu otomatis pada sentuhan pertama di mana saja.
  useEffect(() => {
    if (!activeStudent?.id) return;

    let isMounted = true;
    getDevicePushStatus(activeStudent.id).then((st) => {
      if (isMounted) setDevicePushActive(st.isSubscribed);
    });

    const cleanup = requestAdaptiveNativePushPermission({
      studentId: activeStudent.id,
      schoolId: activeStudent.schoolId || schoolProfile?.id || currentUser?.schoolId,
      onSuccess: () => {
        if (isMounted) {
          setDevicePushActive(true);
          showToast('Notifikasi kehadiran resmi aktif pada ponsel ini!', 'success');
        }
      },
    });

    const handleStatusChange = (e: any) => {
      if (isMounted && e?.detail?.isSubscribed !== undefined) {
        setDevicePushActive(Boolean(e.detail.isSubscribed));
      }
    };
    window.addEventListener('kawacanaan_push_status_changed', handleStatusChange);

    return () => {
      isMounted = false;
      cleanup();
      window.removeEventListener('kawacanaan_push_status_changed', handleStatusChange);
    };
  }, [activeStudent?.id, currentUser?.schoolId, schoolProfile?.id, showToast]);

  // Resolusi kelas siswa
  const studentClass = useMemo(() => {
    if (!activeStudent) return null;
    if (activeStudent.classId) {
      const found = classes.find((c) => c.id === activeStudent.classId);
      if (found) return found;
    }
    if (activeStudent.className) {
      const clean = activeStudent.className.toLowerCase().replace(/[^a-z0-9]/g, '');
      const found = classes.find((c) => c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === clean);
      if (found) return found;
    }
    return null;
  }, [activeStudent, classes]);

  const studentDisplayClassName = useMemo(() => {
    if (studentClass?.name) return studentClass.name;
    if (activeStudent.className) return activeStudent.className;
    return 'Kelas 6A';
  }, [studentClass, activeStudent]);

  // Himpunan ID identitas siswa untuk pencocokan absensi yang presisi
  const studentIdsSet = useMemo(() => {
    const ids = new Set<string>();
    if (activeStudent?.id) ids.add(activeStudent.id);
    if (currentUser?.studentId) ids.add(currentUser.studentId);
    if (currentUser?.id) ids.add(currentUser.id);
    const uNisn = (currentUser?.username || currentUser?.nip || '').trim().toLowerCase();
    const uName = (currentUser?.name || '').trim().toLowerCase();
    students.forEach((s) => {
      if (
        (uNisn && s.nisn && String(s.nisn).trim().toLowerCase() === uNisn) ||
        (uName && s.nama && s.nama.trim().toLowerCase() === uName)
      ) {
        ids.add(s.id);
      }
    });
    return ids;
  }, [activeStudent, currentUser, students]);

  const isRecordForStudent = useCallback(
    (r: AttendanceRecord | undefined | null) => {
      if (!r) return false;
      if (studentIdsSet.has(r.studentId)) return true;
      if (activeStudent?.id && r.studentId === activeStudent.id) return true;
      if (currentUser?.studentId && r.studentId === currentUser.studentId) return true;
      if (currentUser?.id && r.studentId === currentUser.id) return true;
      if (
        activeStudent?.nama &&
        r.studentName &&
        r.studentName.trim().toLowerCase() === activeStudent.nama.trim().toLowerCase()
      ) {
        return true;
      }
      return false;
    },
    [studentIdsSet, activeStudent, currentUser]
  );

  // Record presensi hari berjalan (hari ini)
  const todayRecord = useMemo(() => {
    if (!activeStudent) return undefined;

    return attendanceRecords.find(
      (r) =>
        isRecordForStudent(r) &&
        r.date === runningDate &&
        (!r.type || r.type === 'DAILY') &&
        ((r.checkInTime && r.checkInTime !== '-') ||
          (r.checkOutTime && r.checkOutTime !== '-') ||
          Boolean(r.status && r.status !== '-'))
    );
  }, [activeStudent, isRecordForStudent, runningDate, attendanceRecords]);

  const hasCheckedIn = Boolean(
    todayRecord &&
    (
      (todayRecord.checkInTime && todayRecord.checkInTime !== '-' && todayRecord.checkInTime !== '') ||
      todayRecord.status === 'Hadir' ||
      todayRecord.status === 'Terlambat' ||
      String(todayRecord.status || '').toLowerCase().includes('hadir') ||
      String(todayRecord.status || '').toLowerCase().includes('terlambat')
    ) &&
    todayRecord.status !== 'Izin' &&
    todayRecord.status !== 'Sakit' &&
    todayRecord.status !== 'Alfa'
  );
  const hasCheckedOut = Boolean(
    todayRecord &&
    todayRecord.checkOutTime &&
    todayRecord.checkOutTime !== '-' &&
    todayRecord.checkOutTime !== ''
  );

  // Month names
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  const currentMonthDisplay = `${monthNames[selectedMonth]} ${selectedYear}`;

  // Monthly stats calculations for activeStudent
  const monthlyStats = useMemo(() => {
    if (!activeStudent) return { hadir: 0, izin: 0, sakit: 0, alfa: 0 };
    const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

    let hadir = 0;
    let izin = 0;
    let sakit = 0;
    let alfa = 0;

    attendanceRecords.forEach((r) => {
      if (r.studentId === activeStudent.id && r.date.startsWith(monthPrefix) && (!r.type || r.type === 'DAILY')) {
        if (r.status === 'Hadir') hadir++;
        else if (r.status === 'Izin') izin++;
        else if (r.status === 'Sakit') sakit++;
        else if (r.status === 'Alfa') alfa++;
      }
    });

    return { hadir, izin, sakit, alfa };
  }, [activeStudent, selectedMonth, selectedYear, attendanceRecords]);

  // Riwayat attendance records for list
  const historyList = useMemo(() => {
    if (!activeStudent) return [];
    const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

    // Get all calendar days in the month
    const totalDaysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const days: Array<{
      date: string;
      dayName: string;
      formattedDate: string;
      record?: AttendanceRecord;
      isFuture: boolean;
      isEffective: boolean;
    }> = [];

    const dayShortNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dObj = new Date(selectedYear, selectedMonth, day);
      const dayIndex = dObj.getDay();
      const dayName = dayShortNames[dayIndex];
      const formattedDate = `${dayName}, ${day} ${monthShortNames[selectedMonth]} ${selectedYear}`;

      const rec = attendanceRecords.find(
        (r) => r.studentId === activeStudent.id && r.date === dateStr && (!r.type || r.type === 'DAILY')
      );

      const isFuture = dateStr > runningDate;
      const status = getDateStatus(dateStr);

      days.push({
        date: dateStr,
        dayName,
        formattedDate,
        record: rec,
        isFuture,
        isEffective: status.isEffective,
      });
    }

    // Sort descending (latest dates first)
    return days.sort((a, b) => b.date.localeCompare(a.date));
  }, [activeStudent, selectedMonth, selectedYear, attendanceRecords, runningDate, getDateStatus]);

  // Navigate to screen
  const navigateTo = (screen: MobileScreen) => {
    setPreviousScreen(currentScreen);
    setCurrentScreen(screen);
    if (screen === 'scanner' || screen === 'absensi-menu' || screen === 'beranda') {
      refreshRunningDayAttendance();
    }
  };

  const handleOpenScanner = async (action: 'masuk' | 'pulang') => {
    // Sinkronkan data presensi terbaru sebelum validasi tombol scanner
    const freshRecords = await refreshRunningDayAttendance();
    const candidateRecords = [
      ...(Array.isArray(freshRecords) ? freshRecords : []),
      ...attendanceRecords,
    ];
    const freshRecord = candidateRecords.find(
      (r) =>
        isRecordForStudent(r) &&
        r.date === runningDate &&
        (!r.type || r.type === 'DAILY') &&
        ((r.checkInTime && r.checkInTime !== '-') ||
          (r.checkOutTime && r.checkOutTime !== '-') ||
          Boolean(r.status && r.status !== '-'))
    );

    const isRecordPresent = (r: any) => {
      if (!r) return false;
      const hasTime = Boolean(r.checkInTime && r.checkInTime !== '-' && r.checkInTime !== '');
      const st = String(r.status || '').toLowerCase();
      const isPresentSt = st === 'hadir' || st === 'terlambat' || st.includes('hadir') || st.includes('terlambat');
      const isAbsent = st === 'izin' || st === 'sakit' || st === 'alfa';
      return (hasTime || isPresentSt) && !isAbsent;
    };

    const checkedInNow = Boolean(isRecordPresent(freshRecord) || hasCheckedIn);
    const checkedOutNow = Boolean(
      (freshRecord &&
        freshRecord.checkOutTime &&
        freshRecord.checkOutTime !== '-' &&
        freshRecord.checkOutTime !== '') ||
      hasCheckedOut
    );

    // Penguncian scan QR kode jika sudah melakukan scan dan belum di-reset oleh Wali Kelas
    if (action === 'masuk' && checkedInNow) {
      const recordedTime = freshRecord?.checkInTime || todayRecord?.checkInTime;
      showToast(
        `Presensi masuk sudah tercatat hari ini${recordedTime ? ` (${recordedTime} WIB)` : ''}. Scan masuk dikunci.`,
        'warning'
      );
      triggerHaptic('warning');
      return;
    }
    if (action === 'pulang' && checkedOutNow) {
      const recordedTime = freshRecord?.checkOutTime || todayRecord?.checkOutTime;
      showToast(
        `Presensi pulang sudah tercatat hari ini${recordedTime ? ` (${recordedTime} WIB)` : ''}. Scan pulang dikunci.`,
        'warning'
      );
      triggerHaptic('warning');
      return;
    }

    triggerHaptic('tap');
    setScannerAction(action);
    navigateTo('scanner');
  };

  const handleOpenDetail = (date: string) => {
    triggerHaptic('tap');
    setSelectedDetailDate(date);
    navigateTo('detail');
  };

  // Prefill requester contacts from activeStudent
  useEffect(() => {
    if (activeStudent) {
      if (activeStudent.namaWali) {
        setLeaveRequesterName(activeStudent.namaWali);
      }
      if (activeStudent.noHpWali) {
        setLeaveRequesterPhone(activeStudent.noHpWali);
      }
    }
  }, [activeStudent]);

  // Filter leave requests for current active student (strictly isolated per student & school)
  const myLeaveRequests = useMemo(() => {
    if (!activeStudent || !leaveRequests) return [];
    const targetSchoolId = activeStudent.schoolId || currentUser?.schoolId;
    return leaveRequests
      .filter((r) => {
        // Enforce school boundary
        if (targetSchoolId && r.schoolId && r.schoolId !== targetSchoolId) return false;
        if (r.studentId === activeStudent.id) return true;
        if (activeStudent.nisn && r.nisn && String(activeStudent.nisn).trim() === String(r.nisn).trim()) return true;
        return false;
      })
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }, [activeStudent, leaveRequests, currentUser?.schoolId]);

  const handleCancelLeave = async (requestId: string) => {
    if (!window.confirm('Apakah Anda yakin ingin membatalkan pengajuan surat izin ini?')) {
      return;
    }
    setCancellingId(requestId);
    try {
      await cancelLeaveRequest(requestId);
      triggerHaptic('tap');
      playChimeSuccess();
    } finally {
      setCancellingId(null);
    }
  };

  // Handle upload foto surat izin / surat dokter
  const handleLeaveFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Ukuran foto maksimal 5MB.', 'error');
      triggerHaptic('warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLeaveAttachment(reader.result as string);
      setLeaveAttachmentName(file.name);
      triggerHaptic('tap');
    };
    reader.readAsDataURL(file);
  };

  // Handle submit pengajuan izin / sakit mandiri (Menunggu Persetujuan Wali Kelas)
  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveReason.trim()) {
      showToast('Harap jelaskan alasan izin atau sakit secara jelas.', 'error');
      triggerHaptic('warning');
      return;
    }

    setIsSubmittingLeave(true);
    try {
      // Submit official leave request for Wali Kelas approval
      await submitLeaveRequest({
        studentId: activeStudent.id,
        studentName: activeStudent.nama,
        nisn: activeStudent.nisn,
        classId: activeStudent.classId,
        className: studentDisplayClassName,
        requesterName: leaveRequesterName || activeStudent.namaWali || activeStudent.nama,
        requesterRole: (leaveRequesterRole === 'Orang Tua' ? 'Ibu' : leaveRequesterRole === 'Wali' ? 'Wali' : 'Siswa') as any,
        requesterPhone: leaveRequesterPhone,
        leaveType,
        subCategory: leaveType === 'sakit' ? 'Sakit (Istirahat / Surat Dokter)' : 'Izin Keperluan Keluarga',
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        reason: leaveReason,
        attachmentUrl: leaveAttachment || undefined,
        attachmentName: leaveAttachmentName || undefined,
      });

      playChimeSuccess();
      triggerHaptic('success');
      showToast(
        `Surat ${leaveType === 'sakit' ? 'izin sakit' : 'permohonan izin'} berhasil diajukan! Menunggu verifikasi dan persetujuan Wali Kelas.`,
        'success'
      );

      // Reset form
      setLeaveReason('');
      setLeaveAttachment('');
      setLeaveAttachmentName('');

      // Navigate back to Beranda
      navigateTo('beranda');
    } catch (err: any) {
      playChimeWarning();
      triggerHaptic('error');
      showToast(err?.message || 'Gagal mengirim pengajuan izin/sakit.', 'error');
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  // CAMERA SCANNER LOGIC FOR SCREEN 2
  const startCameraScanner = async (overrideMode?: 'environment' | 'user') => {
    setCameraError('');
    setScanStatusMessage('');
    setScanStatusType('idle');
    isProcessingRef.current = false;

    // Penguncian: Cek apakah tindakan ini sudah pernah dicatat
    if (scannerAction === 'masuk' && hasCheckedIn) {
      setScanStatusType('rejected');
      setScanStatusMessage(`Presensi masuk sudah tercatat (${todayRecord?.checkInTime} WIB). Pemindaian dikunci.`);
      return;
    }
    if (scannerAction === 'pulang' && hasCheckedOut) {
      setScanStatusType('rejected');
      setScanStatusMessage(`Presensi pulang sudah tercatat (${todayRecord?.checkOutTime} WIB). Pemindaian dikunci.`);
      return;
    }

    try {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch (_) {}
      }

      const html5Qr = new Html5Qrcode('mobile-qr-viewfinder');
      scannerRef.current = html5Qr;

      const activeFacing = overrideMode || cameraFacingMode;

      const onScanSuccess = async (decodedText: string) => {
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;

        // 1. Penguncian Check: Hindari scan ulang
        if (scannerAction === 'masuk' && hasCheckedIn) {
          playChimeWarning();
          triggerHaptic('warning');
          setScanStatusType('rejected');
          setScanStatusMessage(`Presensi masuk sudah tercatat pukul ${todayRecord?.checkInTime} WIB. Pemindaian dikunci.`);
          setTimeout(() => { isProcessingRef.current = false; }, 2500);
          return;
        }
        if (scannerAction === 'pulang' && hasCheckedOut) {
          playChimeWarning();
          triggerHaptic('warning');
          setScanStatusType('rejected');
          setScanStatusMessage(`Presensi pulang sudah tercatat pukul ${todayRecord?.checkOutTime} WIB. Pemindaian dikunci.`);
          setTimeout(() => { isProcessingRef.current = false; }, 2500);
          return;
        }

        // 2. Parse QR code
        const parsed = parseClassQrPayload(decodedText);
        if (!parsed.valid || (!parsed.classId && !parsed.isGate)) {
          playChimeWarning();
          triggerHaptic('warning');
          setScanStatusType('rejected');
          setScanStatusMessage(parsed.error || 'Format QR Code tidak valid.');
          setTimeout(() => {
            isProcessingRef.current = false;
          }, 2500);
          return;
        }

        // 3. Check class match
        const isSim = currentUser?.role !== 'SISWA';
        const scannedClassId = parsed.classId;
        const cleanStudentClassName = (activeStudent.className || studentClass?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanScannedClassName = (parsed.className || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        const isGateQr = Boolean(
          parsed.isGate ||
          cleanScannedClassName.includes('gerbang') ||
          cleanScannedClassName.includes('sekolah') ||
          cleanScannedClassName.includes('gate')
        );

        const isClassMatch =
          isSim ||
          isGateQr ||
          !activeStudent.classId ||
          (activeStudent.classId && activeStudent.classId === scannedClassId) ||
          (studentClass && studentClass.id === scannedClassId) ||
          (cleanStudentClassName && cleanScannedClassName && (
            cleanStudentClassName === cleanScannedClassName ||
            cleanStudentClassName.includes(cleanScannedClassName) ||
            cleanScannedClassName.includes(cleanStudentClassName)
          ));

        if (!isClassMatch) {
          playChimeWarning();
          triggerHaptic('warning');
          setScanStatusType('rejected');
          setScanStatusMessage(`QR Code ini untuk ${parsed.className || 'Rombel Lain'}. Bukan kelas Anda.`);
          setTimeout(() => {
            isProcessingRef.current = false;
          }, 2500);
          return;
        }

        // 4. Catat Presensi mengikuti hari berjalan pada saat absensi
        setScanStatusType('processing');
        setScanStatusMessage('Mencatat presensi...');

        const now = getServerNow();
        const scanDate = formatServerDateString(now);
        const timeStr = formatServerTimeString(now);
        setRunningDate(scanDate);
        setCurrentAttendanceDate(scanDate);

        const notes = scannerAction === 'masuk' ? 'Hadir via Scan QR' : 'Pulang via Scan QR';
        const res = await submitStudentAttendance(
          activeStudent.id,
          scannerAction,
          notes,
          scanDate,
          timeStr
        );

        if (res.success) {
          playChimeSuccess();
          triggerHaptic('success');
          setScanStatusType('success');
          setScanStatusMessage(
            scannerAction === 'masuk'
              ? `Presensi Masuk berhasil dicatat pukul ${timeStr} WIB (${formatIndonesianDate(scanDate)})!`
              : `Presensi Pulang berhasil dicatat pukul ${timeStr} WIB (${formatIndonesianDate(scanDate)})!`
          );
          // Pemicu push notifikasi kini diproses secara otomatis & terpusat oleh server (/api/attendance)
          // untuk mencegah pengiriman ganda (duplicate push) pada perangkat orang tua/siswa.
          setTimeout(() => {
            stopCameraScanner();
            setSelectedDetailDate(scanDate);
            setCurrentScreen('detail');
          }, 1800);
        } else {
          playChimeWarning();
          triggerHaptic('error');
          setScanStatusType('rejected');
          setScanStatusMessage(res.message || 'Presensi gagal diproses.');
          setTimeout(() => {
            isProcessingRef.current = false;
          }, 2500);
        }
      };

      const onScanFailure = () => {
        // Abaikan kegagalan frame individual
      };

      try {
        await html5Qr.start(
          { facingMode: activeFacing },
          {
            fps: 12,
            qrbox: { width: 230, height: 230 },
            aspectRatio: 1.0,
          },
          onScanSuccess,
          onScanFailure
        );
      } catch (err: any) {
        // Fallback otomatis jika kamera environment tidak ada (misal webcam laptop / desktop)
        const fallbackFacing = activeFacing === 'environment' ? 'user' : 'environment';
        try {
          await html5Qr.start(
            { facingMode: fallbackFacing },
            {
              fps: 12,
              qrbox: { width: 230, height: 230 },
              aspectRatio: 1.0,
            },
            onScanSuccess,
            onScanFailure
          );
          setCameraFacingMode(fallbackFacing);
        } catch {
          throw err;
        }
      }

      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('Camera start error:', err);
      setIsCameraActive(false);
      const msg = String(err?.message || err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission denied')) {
        setCameraError('Izin akses kamera ditolak. Silakan izinkan akses kamera di browser Anda untuk scan barcode.');
      } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError')) {
        setCameraError('Perangkat kamera tidak ditemukan. Gunakan opsi unggah foto QR di bawah.');
      } else {
        setCameraError('Kamera tidak dapat diakses. Silakan coba muat ulang atau gunakan opsi unggah foto QR.');
      }
    }
  };

  const stopCameraScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.warn('Error stopping scanner:', e);
      }
      scannerRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Flip Camera Front / Back
  const handleToggleCameraFacing = () => {
    const nextMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(nextMode);
    triggerHaptic('tap');
    startCameraScanner(nextMode);
  };

  useEffect(() => {
    if (currentScreen === 'scanner') {
      const t = setTimeout(() => {
        startCameraScanner();
      }, 300);
      return () => {
        clearTimeout(t);
        stopCameraScanner();
      };
    } else {
      stopCameraScanner();
    }
  }, [currentScreen]);

  // Efek pembukaan otomatis: jika Wali Kelas mereset presensi, buka kunci scanner dan nyalakan kamera kembali
  useEffect(() => {
    if (currentScreen === 'scanner') {
      const isLocked = (scannerAction === 'masuk' && hasCheckedIn) || (scannerAction === 'pulang' && hasCheckedOut);
      if (!isLocked) {
        if (scanStatusType === 'rejected' || isProcessingRef.current) {
          setScanStatusType('idle');
          setScanStatusMessage('');
          isProcessingRef.current = false;
          startCameraScanner();
        }
      } else {
        stopCameraScanner();
      }
    }
  }, [currentScreen, scannerAction, hasCheckedIn, hasCheckedOut, scanStatusType]);

  // Handle manual QR image file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const freshRecords = await refreshRunningDayAttendance();
    const candidateRecords = [
      ...(Array.isArray(freshRecords) ? freshRecords : []),
      ...attendanceRecords,
    ];
    const freshRecord = candidateRecords.find(
      (r) =>
        isRecordForStudent(r) &&
        r.date === runningDate &&
        (!r.type || r.type === 'DAILY') &&
        ((r.checkInTime && r.checkInTime !== '-') ||
          (r.checkOutTime && r.checkOutTime !== '-') ||
          Boolean(r.status && r.status !== '-'))
    );

    const checkedInNow = Boolean(
      (freshRecord &&
        freshRecord.checkInTime &&
        freshRecord.checkInTime !== '-' &&
        freshRecord.checkInTime !== '' &&
        freshRecord.status !== 'Izin' &&
        freshRecord.status !== 'Sakit' &&
        freshRecord.status !== 'Alfa') ||
      hasCheckedIn
    );
    const checkedOutNow = Boolean(
      (freshRecord &&
        freshRecord.checkOutTime &&
        freshRecord.checkOutTime !== '-' &&
        freshRecord.checkOutTime !== '') ||
      hasCheckedOut
    );

    // 1. Penguncian Check (hanya jika sudah presensi dan belum di-reset)
    if (scannerAction === 'masuk' && checkedInNow) {
      playChimeWarning();
      triggerHaptic('warning');
      const recTime = freshRecord?.checkInTime || todayRecord?.checkInTime;
      showToast(`Presensi masuk sudah tercatat hari ini${recTime ? ` (${recTime} WIB)` : ''}. Scan masuk dikunci.`, 'warning');
      return;
    }
    if (scannerAction === 'pulang' && checkedOutNow) {
      playChimeWarning();
      triggerHaptic('warning');
      const recTime = freshRecord?.checkOutTime || todayRecord?.checkOutTime;
      showToast(`Presensi pulang sudah tercatat hari ini${recTime ? ` (${recTime} WIB)` : ''}. Scan pulang dikunci.`, 'warning');
      return;
    }

    try {
      const html5Qr = new Html5Qrcode('file-scanner-temp');
      const decodedText = await html5Qr.scanFile(file, true);
      html5Qr.clear();

      const parsed = parseClassQrPayload(decodedText);
      if (!parsed.valid || (!parsed.classId && !parsed.isGate)) {
        playChimeWarning();
        triggerHaptic('warning');
        showToast('QR Code dalam gambar tidak valid.', 'error');
        return;
      }

      // Check class match
      const isSim = currentUser?.role !== 'SISWA';
      const scannedClassId = parsed.classId;
      const cleanStudentClassName = (activeStudent.className || studentClass?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanScannedClassName = (parsed.className || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      const isGateQr = Boolean(
        parsed.isGate ||
        cleanScannedClassName.includes('gerbang') ||
        cleanScannedClassName.includes('sekolah') ||
        cleanScannedClassName.includes('gate')
      );

      const isClassMatch =
        isSim ||
        isGateQr ||
        !activeStudent.classId ||
        (activeStudent.classId && activeStudent.classId === scannedClassId) ||
        (studentClass && studentClass.id === scannedClassId) ||
        (cleanStudentClassName && cleanScannedClassName && (
          cleanStudentClassName === cleanScannedClassName ||
          cleanStudentClassName.includes(cleanScannedClassName) ||
          cleanScannedClassName.includes(cleanStudentClassName)
        ));

      if (!isClassMatch) {
        playChimeWarning();
        triggerHaptic('warning');
        showToast(`QR Code ini untuk ${parsed.className || 'Rombel Lain'}. Bukan kelas Anda.`, 'error');
        return;
      }

      const now = getServerNow();
      const scanDate = formatServerDateString(now);
      const timeStr = formatServerTimeString(now);
      setRunningDate(scanDate);
      setCurrentAttendanceDate(scanDate);

      const notes = scannerAction === 'masuk' ? 'Hadir via Upload QR' : 'Pulang via Upload QR';
      const res = await submitStudentAttendance(
        activeStudent.id,
        scannerAction,
        notes,
        scanDate,
        timeStr
      );
      if (res.success) {
        playChimeSuccess();
        triggerHaptic('success');
        showToast('Presensi berhasil melalui foto QR!', 'success');
        // Pemicu push notifikasi kini diproses otomatis oleh server (/api/attendance)
        setSelectedDetailDate(scanDate);
        setCurrentScreen('detail');
      } else {
        playChimeWarning();
        triggerHaptic('error');
        showToast(res.message || 'Presensi gagal diproses.', 'error');
      }
    } catch (err) {
      playChimeWarning();
      triggerHaptic('error');
      showToast('Gagal memindai gambar QR. Pastikan foto jelas dan memiliki pencahayaan cukup.', 'error');
    }
  };

  // Helper date formatter Indonesian
  const formatIndonesianDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-');
      const dObj = new Date(Number(y), Number(m) - 1, Number(d));
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
      ];
      return `${days[dObj.getDay()]}, ${Number(d)} ${months[dObj.getMonth()]} ${y}`;
    } catch {
      return dateStr;
    }
  };

  // Record for selectedDetailDate
  const currentDetailRecord = useMemo(() => {
    if (!activeStudent) return undefined;
    return attendanceRecords.find(
      (r) =>
        r.studentId === activeStudent.id &&
        r.date === selectedDetailDate &&
        (!r.type || r.type === 'DAILY')
    );
  }, [activeStudent, selectedDetailDate, attendanceRecords]);

  // =========================================================================
  // RENDER SECTIONS
  // =========================================================================

  return (
    <div className="min-h-screen bg-slate-100/90 flex justify-center items-start sm:py-6 px-0 sm:px-4 font-sans antialiased text-slate-800 select-none">
      {/* Mobile Smartphone Frame Container (Designed specifically for Mobile Screen) */}
      <div className="w-full max-w-md bg-white sm:rounded-[36px] sm:shadow-2xl sm:border sm:border-slate-200/90 flex flex-col relative min-h-screen sm:min-h-[844px] pb-24 overflow-hidden">
        
        {/* Hidden temp div for file upload scanner */}
        <div id="file-scanner-temp" className="hidden" />

        {/* 2. DYNAMIC CONTENT SCROLL AREA */}
        <div className="flex-1 relative bg-white">
          
          {/* ========================================================================= */}
          {/* SCREEN 1: BERANDA (HOME) */}
          {/* ========================================================================= */}
          {currentScreen === 'beranda' && (
            <div className="p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
              {/* Greeting & Student Circular Avatar */}
              <div className="flex items-center justify-between pt-2 pb-1">
                <div>
                  <span className="text-xs text-slate-500 font-medium block">Halo,</span>
                  <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-tight">
                    {activeStudent.nama}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-semibold text-slate-500">
                      Kelas {studentDisplayClassName}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (devicePushActive) {
                          showToast('Notifikasi presensi sudah aktif pada perangkat ini.', 'info');
                          return;
                        }
                        try {
                          const perm = await Notification.requestPermission();
                          if (perm === 'granted') {
                            const res = await subscribeParentDevice({
                              studentId: activeStudent.id,
                              schoolId: activeStudent.schoolId || schoolProfile?.id || currentUser?.schoolId,
                              parentName: detectDeviceName(),
                            });
                            if (res.success) {
                              setDevicePushActive(true);
                              showToast('Notifikasi kehadiran resmi aktif pada ponsel ini!', 'success');
                            }
                          } else {
                            showToast('Izin notifikasi tidak diberikan pada peramban ponsel.', 'info');
                          }
                        } catch (_) {}
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black transition-all cursor-pointer ${
                        devicePushActive
                          ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                          : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      <Bell size={11} className={devicePushActive ? 'fill-blue-600' : ''} />
                      <span>{devicePushActive ? 'Notifikasi Aktif' : 'Notifikasi'}</span>
                    </button>
                    <PWAInstallButton variant="compact" className="text-[10px] py-0.5 px-2 rounded-full" />
                  </div>
                </div>

                {/* Circular Student Anime Avatar */}
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 p-0.5 shadow-md shrink-0 overflow-hidden border-2 border-white">
                  <div className="w-full h-full rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      <circle cx="50" cy="50" r="48" fill="#93C5FD" />
                      {/* Body & Collar */}
                      <path d="M22 92 C22 72 35 68 50 68 C65 68 78 72 78 92 Z" fill="#1E3A8A" />
                      <polygon points="50,68 44,82 56,82" fill="#FFFFFF" />
                      <polygon points="50,74 47,88 53,88" fill="#EF4444" />
                      {/* Head */}
                      <circle cx="50" cy="45" r="22" fill="#FDE047" />
                      {/* Hair */}
                      <path d="M28 42 C28 26 40 20 50 20 C60 20 72 26 72 42 C72 48 70 52 70 52 C70 52 64 36 50 36 C36 36 30 52 30 52 Z" fill="#451A03" />
                      {/* Eyes & Smile */}
                      <circle cx="43" cy="44" r="3" fill="#1E293B" />
                      <circle cx="57" cy="44" r="3" fill="#1E293B" />
                      <path d="M46 51 Q50 55 54 51" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" fill="none" />
                      {/* Blushes */}
                      <circle cx="39" cy="48" r="2.5" fill="#FCA5A5" />
                      <circle cx="61" cy="48" r="2.5" fill="#FCA5A5" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Banner PWA: Pasang Aplikasi ke Layar Utama (Android, Windows PC, iOS) */}
              <PWAInstallButton variant="banner" className="mb-4" />

              {/* Hero Card: Absensi Hari Ini (Vibrant Blue Card with School Illustration) */}
              <div className="rounded-3xl bg-gradient-to-r from-blue-600 via-blue-500 to-sky-500 text-white p-4 sm:p-5 relative overflow-hidden shadow-lg shadow-blue-500/25">
                {/* Background decorative circles */}
                <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />

                <div className="relative z-10 flex items-center justify-between gap-2">
                  <div className="max-w-[62%] space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0">
                        <Calendar size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-black tracking-tight leading-tight">
                          Absensi Hari Ini
                        </h3>
                        <span className="text-[11px] font-bold text-blue-100 block">
                          {formatIndonesianDate(runningDate)}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-blue-50 opacity-95 leading-normal pt-1">
                      {hasCheckedIn && hasCheckedOut
                        ? `✓ Sudah lengkap (Masuk: ${todayRecord?.checkInTime} • Pulang: ${todayRecord?.checkOutTime} WIB)`
                        : hasCheckedIn
                        ? `✓ Sudah masuk pukul ${todayRecord?.checkInTime} WIB. Siap untuk scan pulang.`
                        : 'Pastikan kamu sudah melakukan scan masuk di gerbang/kelas.'}
                    </p>

                    <button
                      onClick={() => {
                        triggerHaptic('tap');
                        if (hasCheckedIn && hasCheckedOut) {
                          handleOpenDetail(runningDate);
                        } else {
                          handleOpenScanner(hasCheckedIn ? 'pulang' : 'masuk');
                        }
                      }}
                      className="mt-2.5 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white text-blue-600 hover:bg-blue-50 active:scale-95 transition-all text-xs font-black shadow-sm cursor-pointer"
                    >
                      <span>
                        {hasCheckedIn && hasCheckedOut
                          ? 'Lihat Bukti Presensi'
                          : hasCheckedIn
                          ? 'Scan Pulang'
                          : 'Scan Sekarang'}
                      </span>
                      <ChevronRight size={14} />
                    </button>
                  </div>

                  {/* School Building Vector Illustration */}
                  <div className="w-28 h-24 sm:w-32 sm:h-28 shrink-0 relative flex items-center justify-center">
                    <svg viewBox="0 0 140 120" className="w-full h-full drop-shadow-md">
                      {/* Sky & ground */}
                      <ellipse cx="70" cy="115" rx="60" ry="8" fill="#1E3A8A" opacity="0.3" />
                      {/* Trees */}
                      <circle cx="25" cy="85" r="14" fill="#34D399" />
                      <circle cx="115" cy="85" r="14" fill="#34D399" />
                      <rect x="23" y="90" width="4" height="20" fill="#78350F" />
                      <rect x="113" y="90" width="4" height="20" fill="#78350F" />
                      {/* Main Building Base */}
                      <rect x="36" y="60" width="68" height="50" rx="3" fill="#F8FAFC" />
                      {/* Roof Orange */}
                      <polygon points="70,30 28,62 112,62" fill="#FB923C" />
                      <polygon points="70,32 34,60 106,60" fill="#F97316" />
                      {/* Tower & Clock */}
                      <rect x="62" y="16" width="16" height="20" fill="#F8FAFC" />
                      <polygon points="70,6 58,18 82,18" fill="#EA580C" />
                      <circle cx="70" cy="24" r="5" fill="#FEF08A" />
                      {/* Flag Pole & Indonesian Flag */}
                      <line x1="70" y1="6" x2="70" y2="0" stroke="#E2E8F0" strokeWidth="1.5" />
                      <rect x="70" y="0" width="10" height="3" fill="#EF4444" />
                      <rect x="70" y="3" width="10" height="3" fill="#FFFFFF" />
                      {/* Door */}
                      <rect x="63" y="85" width="14" height="25" rx="2" fill="#3B82F6" />
                      {/* Windows */}
                      <rect x="44" y="70" width="10" height="12" rx="1" fill="#60A5FA" />
                      <rect x="86" y="70" width="10" height="12" rx="1" fill="#60A5FA" />
                      <rect x="44" y="90" width="10" height="12" rx="1" fill="#60A5FA" />
                      <rect x="86" y="90" width="10" height="12" rx="1" fill="#60A5FA" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Quick Action: Pengajuan Izin / Sakit Mandiri */}
              <div
                onClick={() => {
                  triggerHaptic('tap');
                  navigateTo('izin-sakit');
                }}
                className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 hover:border-amber-300 rounded-3xl p-3.5 flex items-center justify-between shadow-2xs transition-all active:scale-98 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <FileText size={20} />
                  </div>
                  <div className="text-left">
                    <h4 className="text-xs font-black text-slate-900 leading-tight">
                      Tidak Masuk Sekolah?
                    </h4>
                    <p className="text-[11px] font-semibold text-slate-600 mt-0.5">
                      Ajukan surat izin atau surat sakit mandiri
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-amber-800 font-bold text-xs shrink-0 bg-white/90 px-3 py-1.5 rounded-full border border-amber-200 shadow-2xs">
                  <span>Ajukan</span>
                  <ChevronRight size={14} />
                </div>
              </div>

              {/* Notifikasi Push PWA ke HP Orang Tua (Masuk & Pulang - Multi-Device: Ayah & Ibu) */}
              <ParentPushNotificationCard student={activeStudent} schoolId={activeStudent.schoolId} />

              {/* Ringkasan Absensi Section */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">
                    Ringkasan Absensi
                  </h3>
                  <button
                    onClick={() => setShowMonthPickerModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition-all cursor-pointer"
                  >
                    <Calendar size={13} className="text-blue-600" />
                    <span>{currentMonthDisplay}</span>
                  </button>
                </div>

                {/* 4 Stat Cards in 2x2 Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Hadir */}
                  <div className="bg-white border border-slate-100 rounded-3xl p-3.5 shadow-xs space-y-1.5">
                    <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black">
                      <Check size={16} strokeWidth={3} />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 block">Hadir</span>
                      <span className="text-2xl font-black text-slate-900 leading-none">
                        {monthlyStats.hadir}
                      </span>
                      <span className="text-[11px] text-slate-400 font-semibold ml-1">Hari</span>
                    </div>
                  </div>

                  {/* Izin */}
                  <div className="bg-white border border-slate-100 rounded-3xl p-3.5 shadow-xs space-y-1.5">
                    <div className="w-7 h-7 rounded-full bg-amber-400 text-white flex items-center justify-center font-black">
                      <Clock size={16} strokeWidth={2.5} />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 block">Izin</span>
                      <span className="text-2xl font-black text-slate-900 leading-none">
                        {monthlyStats.izin}
                      </span>
                      <span className="text-[11px] text-slate-400 font-semibold ml-1">Hari</span>
                    </div>
                  </div>

                  {/* Sakit */}
                  <div className="bg-white border border-slate-100 rounded-3xl p-3.5 shadow-xs space-y-1.5">
                    <div className="w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center font-black">
                      <X size={16} strokeWidth={3} />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 block">Sakit</span>
                      <span className="text-2xl font-black text-slate-900 leading-none">
                        {monthlyStats.sakit}
                      </span>
                      <span className="text-[11px] text-slate-400 font-semibold ml-1">Hari</span>
                    </div>
                  </div>

                  {/* Alfa */}
                  <div className="bg-white border border-slate-100 rounded-3xl p-3.5 shadow-xs space-y-1.5">
                    <div className="w-7 h-7 rounded-full bg-slate-400 text-white flex items-center justify-center font-black">
                      <X size={16} strokeWidth={3} />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 block">Alfa</span>
                      <span className="text-2xl font-black text-slate-900 leading-none">
                        {monthlyStats.alfa}
                      </span>
                      <span className="text-[11px] text-slate-400 font-semibold ml-1">Hari</span>
                    </div>
                  </div>
                </div>

                {/* Motivational Pill Banner */}
                <button
                  onClick={() => navigateTo('riwayat')}
                  className="w-full bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 rounded-2xl p-3 flex items-center justify-between text-left transition-all active:scale-98 cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                      <Check size={14} strokeWidth={3} />
                    </div>
                    <span className="text-xs font-bold text-emerald-950">
                      Kamu sudah hadir {monthlyStats.hadir} hari di bulan ini. Tetap semangat!
                    </span>
                  </div>
                  <ChevronRight size={16} className="text-emerald-700 shrink-0" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SCREEN 2: SCAN ABSENSI (CAMERA SCANNER VIEW) */}
          {/* ========================================================================= */}
          {currentScreen === 'scanner' && (
            <div className="p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
              {/* Header with Back Arrow & Camera Flip Button */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => navigateTo(previousScreen || 'beranda')}
                    className="w-9 h-9 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 transition-all cursor-pointer shrink-0"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-black text-slate-900 leading-tight truncate">
                      Scan Absensi {scannerAction === 'masuk' ? '(Masuk)' : '(Pulang)'}
                    </h2>
                    <p className="text-xs text-slate-500 truncate">
                      Hari Berjalan: <strong className="text-slate-700">{formatIndonesianDate(runningDate)}</strong>
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleToggleCameraFacing}
                  className="px-3 py-1.5 rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-200 flex items-center gap-1.5 text-blue-700 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                  title="Ganti Kamera Depan / Belakang"
                >
                  <RotateCcw size={14} />
                  <span className="hidden sm:inline">
                    {cameraFacingMode === 'environment' ? 'Kamera Depan' : 'Kamera Belakang'}
                  </span>
                </button>
              </div>

              {/* Viewfinder Camera Box with White Corner Brackets */}
              <div className="relative rounded-3xl overflow-hidden bg-slate-900 border-4 border-slate-800 shadow-xl aspect-square flex items-center justify-center">
                {/* HTML5 Camera Target Element */}
                <div id="mobile-qr-viewfinder" className="w-full h-full overflow-hidden" />

                {/* Reticle Overlay Corner Brackets */}
                <div className="absolute inset-8 pointer-events-none flex flex-col justify-between z-10">
                  <div className="flex justify-between">
                    <div className="w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl" />
                    <div className="w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl" />
                  </div>
                  <div className="flex justify-between">
                    <div className="w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl" />
                    <div className="w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl" />
                  </div>
                </div>

                {/* Lock Overlay when already scanned */}
                {((scannerAction === 'masuk' && hasCheckedIn) || (scannerAction === 'pulang' && hasCheckedOut)) && (
                  <div className="absolute inset-0 bg-slate-950/92 text-white p-5 flex flex-col items-center justify-center text-center z-25 space-y-3 animate-in fade-in">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-lg">
                      <Lock size={26} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-black text-white">
                        Presensi {scannerAction === 'masuk' ? 'Masuk' : 'Pulang'} Terkunci
                      </h3>
                      <p className="text-xs text-slate-300 max-w-xs leading-relaxed">
                        Anda sudah tercatat {scannerAction === 'masuk' ? `masuk pukul ${todayRecord?.checkInTime} WIB` : `pulang pukul ${todayRecord?.checkOutTime} WIB`}. Scanner dikunci untuk mencegah duplikasi.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                      <button
                        onClick={async () => {
                          triggerHaptic('tap');
                          const fresh = await refreshRunningDayAttendance();
                          const candidateRecords = [
                            ...(Array.isArray(fresh) ? fresh : []),
                            ...attendanceRecords,
                          ];
                          const rec = candidateRecords.find(
                            (r) => isRecordForStudent(r) && r.date === runningDate && (!r.type || r.type === 'DAILY') && Boolean(r.status && r.status !== '-')
                          );
                          const isStillCheckedIn = Boolean(
                            rec &&
                            rec.checkInTime &&
                            rec.checkInTime !== '-' &&
                            rec.checkInTime !== '' &&
                            rec.status !== 'Izin' &&
                            rec.status !== 'Sakit' &&
                            rec.status !== 'Alfa'
                          );
                          if (!isStillCheckedIn) {
                            showToast('Presensi telah di-reset oleh Wali Kelas! Scanner barcode dibuka kembali.', 'success');
                            isProcessingRef.current = false;
                            setScanStatusType('idle');
                            setScanStatusMessage('');
                            startCameraScanner();
                          } else {
                            showToast('Presensi masih tercatat dari Wali Kelas.', 'info');
                          }
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-bold text-xs cursor-pointer shadow-md transition-all active:scale-95 inline-flex items-center gap-1.5"
                      >
                        <RotateCcw size={14} />
                        <span>Cek Reset Wali Kelas</span>
                      </button>
                      <button
                        onClick={() => {
                          triggerHaptic('tap');
                          handleOpenDetail(runningDate);
                        }}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs cursor-pointer shadow-md transition-all active:scale-95"
                      >
                        Lihat Bukti Presensi
                      </button>
                    </div>
                  </div>
                )}

                {/* Camera Error Message Fallback */}
                {cameraError && (
                  <div className="absolute inset-0 bg-slate-950/90 text-white p-5 flex flex-col items-center justify-center text-center z-20 space-y-3">
                    <Camera size={36} className="text-rose-400" />
                    <p className="text-xs font-semibold leading-relaxed max-w-xs">{cameraError}</p>
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      <button
                        onClick={() => startCameraScanner()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold text-xs cursor-pointer shadow-xs"
                      >
                        <RotateCcw size={14} />
                        <span>Coba Kamera Lagi</span>
                      </button>
                      <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs cursor-pointer shadow-md">
                        <UploadCloud size={15} />
                        <span>Pilih Foto QR</span>
                        <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                      </label>
                    </div>
                  </div>
                )}

                {/* Scan Status Toast Overlay */}
                {scanStatusMessage && (
                  <div
                    className={`absolute bottom-3 left-4 right-4 p-2.5 rounded-2xl text-xs font-black text-center z-20 shadow-lg ${
                      scanStatusType === 'success'
                        ? 'bg-emerald-600 text-white'
                        : scanStatusType === 'rejected'
                        ? 'bg-rose-600 text-white'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    {scanStatusMessage}
                  </div>
                )}
              </div>

              {/* Instruction Card with QR Icon */}
              <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-xs flex items-center gap-3.5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  scannerAction === 'pulang' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                }`}>
                  <QrCode size={24} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">
                    {scannerAction === 'pulang' ? 'Presensi Pulang Sekolah' : 'Presensi Masuk Sekolah'}
                  </h4>
                  <p className="text-xs font-medium text-slate-600 leading-snug mt-0.5">
                    {scannerAction === 'pulang'
                      ? (todayRecord?.checkInTime && todayRecord.checkInTime !== '-'
                          ? `Masuk tercatat ${todayRecord.checkInTime} WIB. Arahkan kamera ke QR Rombel/Gerbang untuk mencatat kepulangan.`
                          : 'Arahkan kamera ke QR Rombel/Gerbang untuk mencatat kepulangan.')
                      : 'Arahkan kamera ke QR Rombel kelas atau gerbang sekolah untuk mencatat kehadiran hari ini.'}
                  </p>
                </div>
              </div>

              {/* Tips Card */}
              <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-blue-700 font-black text-xs">
                  <Info size={15} />
                  <span>Tips</span>
                </div>
                <ul className="text-xs text-slate-600 space-y-1 pl-1">
                  <li>• Pastikan pencahayaan cukup.</li>
                  <li>• Jaga jarak 10–20 cm dari QR code.</li>
                </ul>
              </div>

              {/* Upload QR Image Fallback Button */}
              <div className="pt-1 flex justify-center">
                <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-all">
                  <UploadCloud size={15} />
                  <span>Atau pilih dari galeri foto</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SCREEN 3: RIWAYAT ABSENSI (HISTORY VIEW) */}
          {/* ========================================================================= */}
          {currentScreen === 'riwayat' && (
            <div className="p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
              {/* Header with Back Arrow */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigateTo('beranda')}
                  className="w-9 h-9 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 transition-all cursor-pointer"
                >
                  <ArrowLeft size={18} />
                </button>
                <h2 className="text-base font-black text-slate-900 leading-tight">
                  Riwayat Absensi
                </h2>
              </div>

              {/* Segment Tabs: Harian, Mingguan, Bulanan */}
              <div className="flex items-center bg-slate-100 p-1 rounded-2xl">
                <button
                  onClick={() => setRiwayatFilter('harian')}
                  className={`flex-1 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
                    riwayatFilter === 'harian'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Harian
                </button>
                <button
                  onClick={() => setRiwayatFilter('mingguan')}
                  className={`flex-1 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
                    riwayatFilter === 'mingguan'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Mingguan
                </button>
                <button
                  onClick={() => setRiwayatFilter('bulanan')}
                  className={`flex-1 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
                    riwayatFilter === 'bulanan'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Bulanan
                </button>
              </div>

              {/* Month Navigator Header */}
              <div className="flex items-center justify-between bg-white border border-slate-100 rounded-2xl p-2.5 shadow-2xs">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-blue-600" />
                  <span className="text-xs font-black text-slate-900">{currentMonthDisplay}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      if (selectedMonth === 0) {
                        setSelectedMonth(11);
                        setSelectedYear((y) => y - 1);
                      } else {
                        setSelectedMonth((m) => m - 1);
                      }
                    }}
                    className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => {
                      if (selectedMonth === 11) {
                        setSelectedMonth(0);
                        setSelectedYear((y) => y + 1);
                      } else {
                        setSelectedMonth((m) => m + 1);
                      }
                    }}
                    className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* History List */}
              <div className="space-y-2.5">
                {historyList.map((item) => {
                  const hasRecord = Boolean(item.record);
                  const isHadir = item.record?.status === 'Hadir';
                  const isIzin = item.record?.status === 'Izin';
                  const isSakit = item.record?.status === 'Sakit';
                  const isAlfa = item.record?.status === 'Alfa';

                  return (
                    <div
                      key={item.date}
                      onClick={() => handleOpenDetail(item.date)}
                      className="bg-white border border-slate-100 hover:border-blue-200 rounded-3xl p-3.5 shadow-xs flex items-center justify-between cursor-pointer transition-all active:scale-98 group"
                    >
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-500 block">
                          {item.formattedDate}
                        </span>

                        <div className="flex items-center gap-2">
                          {/* Status Circle Icon */}
                          {isHadir ? (
                            <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                              <Check size={12} strokeWidth={3} />
                            </div>
                          ) : isIzin ? (
                            <div className="w-5 h-5 rounded-full bg-amber-400 text-white flex items-center justify-center shrink-0">
                              <Clock size={12} strokeWidth={2.5} />
                            </div>
                          ) : isSakit ? (
                            <div className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0">
                              <X size={12} strokeWidth={3} />
                            </div>
                          ) : isAlfa ? (
                            <div className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0">
                              <X size={12} strokeWidth={3} />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-slate-300 text-slate-600 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-black">+</span>
                            </div>
                          )}

                          <span className="text-xs font-black text-slate-900">
                            {hasRecord ? item.record!.status : 'Belum Ada Data'}
                          </span>
                        </div>

                        {/* Timestamps / Details */}
                        <div className="text-[11px] text-slate-500 pl-7 space-y-0.5">
                          {hasRecord && item.record?.checkInTime && item.record.checkInTime !== '-' ? (
                            <>
                              <p>• {item.record.checkInTime} • Scan Masuk</p>
                              {item.record.checkOutTime && item.record.checkOutTime !== '-' && (
                                <p>• {item.record.checkOutTime} • Scan Pulang</p>
                              )}
                            </>
                          ) : (
                            <p className="italic">Belum melakukan scan hari ini</p>
                          )}
                        </div>
                      </div>

                      <ChevronRight size={18} className="text-slate-400 group-hover:text-blue-600 transition-colors shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SCREEN 4: DETAIL ABSENSI (DETAIL VIEW) */}
          {/* ========================================================================= */}
          {currentScreen === 'detail' && (
            <div className="p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
              {/* Header with Back Arrow */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigateTo('riwayat')}
                  className="w-9 h-9 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 transition-all cursor-pointer"
                >
                  <ArrowLeft size={18} />
                </button>
                <h2 className="text-base font-black text-slate-900 leading-tight">
                  Detail Absensi
                </h2>
              </div>

              {/* Status Hero Card (Adapts to Hadir, Izin, Sakit, Alfa) */}
              {(() => {
                const status = currentDetailRecord?.status || 'Hadir';
                if (status === 'Sakit') {
                  return (
                    <div className="bg-rose-50/90 border border-rose-200 rounded-3xl p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-500/20">
                        <HeartPulse size={26} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-black text-rose-950 leading-tight">
                          Sakit
                        </h3>
                        <p className="text-xs font-semibold text-rose-800 mt-0.5">
                          {formatIndonesianDate(selectedDetailDate)}
                        </p>
                        {currentDetailRecord?.notes && (
                          <p className="text-xs text-rose-700/90 font-medium mt-1.5 bg-white/70 px-3 py-1.5 rounded-xl border border-rose-100">
                            {currentDetailRecord.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }
                if (status === 'Izin') {
                  return (
                    <div className="bg-amber-50/90 border border-amber-200 rounded-3xl p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                        <FileText size={26} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-black text-amber-950 leading-tight">
                          Izin
                        </h3>
                        <p className="text-xs font-semibold text-amber-800 mt-0.5">
                          {formatIndonesianDate(selectedDetailDate)}
                        </p>
                        {currentDetailRecord?.notes && (
                          <p className="text-xs text-amber-700/90 font-medium mt-1.5 bg-white/70 px-3 py-1.5 rounded-xl border border-amber-100">
                            {currentDetailRecord.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }
                if (status === 'Alfa') {
                  return (
                    <div className="bg-slate-100 border border-slate-300 rounded-3xl p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-slate-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-slate-500/20">
                        <X size={26} strokeWidth={3} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-black text-slate-900 leading-tight">
                          Alfa (Tanpa Keterangan)
                        </h3>
                        <p className="text-xs font-semibold text-slate-600 mt-0.5">
                          {formatIndonesianDate(selectedDetailDate)}
                        </p>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="bg-emerald-50/90 border border-emerald-200 rounded-3xl p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
                      <Check size={28} strokeWidth={3} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-emerald-950 leading-tight">
                        Hadir
                      </h3>
                      <p className="text-xs font-semibold text-emerald-800 mt-0.5">
                        {formatIndonesianDate(selectedDetailDate)}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Timestamps Row: Scan Masuk & Scan Pulang Side-by-Side */}
              <div className="grid grid-cols-2 gap-3">
                {/* Scan Masuk */}
                <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-xs space-y-2">
                  <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <QrCode size={18} />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block">Scan Masuk</span>
                    <span className="text-sm font-black text-slate-900 block mt-0.5">
                      {currentDetailRecord?.checkInTime && currentDetailRecord.checkInTime !== '-'
                        ? `${currentDetailRecord.checkInTime} WIB`
                        : 'Belum Scan'}
                    </span>
                  </div>
                </div>

                {/* Scan Pulang */}
                <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-xs space-y-2">
                  <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <QrCode size={18} />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block">Scan Pulang</span>
                    <span className="text-sm font-black text-slate-900 block mt-0.5">
                      {currentDetailRecord?.checkOutTime && currentDetailRecord.checkOutTime !== '-'
                        ? `${currentDetailRecord.checkOutTime} WIB`
                        : 'Belum Scan'}
                    </span>
                  </div>
                </div>
              </div>

              {/* School Location Card */}
              <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-xs flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <MapPin size={18} />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 block">Lokasi Sekolah</span>
                  <span className="text-xs font-black text-slate-900 block">
                    {schoolProfile.namaSekolah || 'SD Cideng 07'}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5 leading-snug">
                    {schoolProfile.alamat || 'Jl. Melati No. 12, Jakarta Pusat'}
                  </span>
                </div>
              </div>

              {/* Cheerful Mascot Card: "Semangat belajar!" */}
              <div className="bg-sky-50/70 border border-sky-100 rounded-3xl p-4 relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-center gap-2 text-sky-900 font-bold text-xs">
                  <Smile size={18} className="text-sky-600 shrink-0" />
                  <span>Terima kasih sudah melakukan absensi hari ini!</span>
                </div>

                {/* Cartoon Mascot Illustration */}
                <div className="mt-4 flex items-end justify-between">
                  <div className="w-24 h-28 shrink-0 relative">
                    <svg viewBox="0 0 100 120" className="w-full h-full">
                      {/* Hair Back */}
                      <path d="M25 50 C25 20 45 15 65 20 C78 24 85 45 80 65 C80 65 75 75 75 80 C70 70 70 60 70 60 Z" fill="#38220F" />
                      {/* Body Uniform */}
                      <path d="M30 85 C30 75 42 70 55 70 C68 70 78 75 78 85 L76 115 L32 115 Z" fill="#1E3A8A" />
                      {/* Collar & Tie */}
                      <polygon points="55,70 48,82 62,82" fill="#FFFFFF" />
                      <polygon points="55,76 52,94 58,94" fill="#EF4444" />
                      {/* Head */}
                      <circle cx="55" cy="48" r="20" fill="#FDE047" />
                      {/* Face */}
                      <circle cx="48" cy="46" r="2.5" fill="#0F172A" />
                      <circle cx="62" cy="46" r="2.5" fill="#0F172A" />
                      <path d="M51 52 Q55 57 59 52" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" fill="none" />
                      <circle cx="44" cy="50" r="2.5" fill="#FCA5A5" />
                      <circle cx="66" cy="50" r="2.5" fill="#FCA5A5" />
                      {/* Hair Front */}
                      <path d="M35 44 C35 30 45 25 58 25 C68 25 76 32 75 44 C72 38 65 35 55 35 C45 35 38 40 35 44 Z" fill="#451A03" />
                      {/* Raised Fist (Semangat!) */}
                      <path d="M32 75 L20 60 C18 57 23 54 26 57 L34 68 Z" fill="#FDE047" />
                      <circle cx="21" cy="58" r="5" fill="#FDE047" />
                    </svg>
                  </div>

                  {/* Speech Bubble */}
                  <div className="bg-white rounded-2xl px-4 py-2 shadow-xs border border-sky-200 relative mb-4">
                    <span className="text-xs font-black text-blue-600 block">
                      Semangat belajar!
                    </span>
                    <div className="absolute -left-2 bottom-3 w-0 h-0 border-t-6 border-t-transparent border-r-8 border-r-white border-b-6 border-b-transparent" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SCREEN 5: ABSENSI (MENU UTAMA SCAN MASUK / PULANG) */}
          {/* ========================================================================= */}
          {currentScreen === 'absensi-menu' && (
            <div className="p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
              {/* Header: Title + History Icon */}
              <div className="flex items-center justify-between pt-1">
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  Absensi
                </h2>
                <button
                  onClick={() => navigateTo('riwayat')}
                  className="w-9 h-9 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-700 transition-all active:scale-95 cursor-pointer"
                  title="Lihat Riwayat Absensi"
                >
                  <RotateCcw size={17} />
                </button>
              </div>

              {/* Action Card 1: Scan Masuk (Green Theme) */}
              <div
                onClick={() => handleOpenScanner('masuk')}
                className={`border rounded-3xl p-4 flex items-center justify-between transition-all shadow-xs ${
                  hasCheckedIn
                    ? 'bg-emerald-50/60 border-emerald-300 opacity-90 cursor-default'
                    : 'bg-emerald-50 hover:bg-emerald-100/70 border-emerald-200 cursor-pointer active:scale-98 group'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
                    {hasCheckedIn ? <CheckCircle2 size={24} /> : <QrCode size={24} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-emerald-950 leading-tight">
                        Scan Masuk
                      </h3>
                      {hasCheckedIn && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                          <Lock size={10} />
                          <span>Tercatat</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-emerald-700 mt-0.5">
                      {hasCheckedIn
                        ? `Sudah masuk pukul ${todayRecord?.checkInTime} WIB (Terkunci)`
                        : 'Datang ke sekolah'}
                    </p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800">
                  {hasCheckedIn ? <Lock size={15} /> : <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                </div>
              </div>

              {/* Action Card 2: Scan Pulang (Blue Theme) */}
              <div
                onClick={() => handleOpenScanner('pulang')}
                className={`border rounded-3xl p-4 flex items-center justify-between transition-all shadow-xs ${
                  hasCheckedOut
                    ? 'bg-blue-50/60 border-blue-300 opacity-90 cursor-default'
                    : 'bg-blue-50 hover:bg-blue-100/70 border-blue-200 cursor-pointer active:scale-98 group'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-12 h-12 rounded-2xl text-white flex items-center justify-center shadow-md shrink-0 ${
                    hasCheckedOut ? 'bg-blue-600 shadow-blue-500/20' : 'bg-blue-600 shadow-blue-500/20'
                  }`}>
                    {hasCheckedOut ? <CheckCircle2 size={24} /> : <QrCode size={24} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-blue-950 leading-tight">
                        Scan Pulang
                      </h3>
                      {hasCheckedOut && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-full">
                          <Lock size={10} />
                          <span>Tercatat</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-blue-700 mt-0.5">
                      {hasCheckedOut
                        ? `Sudah pulang pukul ${todayRecord?.checkOutTime} WIB (Terkunci)`
                        : 'Pulang dari sekolah'}
                    </p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-800">
                  {hasCheckedOut ? <Lock size={15} /> : <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                </div>
              </div>

              {/* Action Card 3: Ajukan Izin / Sakit Mandiri (Amber Theme) */}
              <div
                onClick={() => {
                  triggerHaptic('tap');
                  navigateTo('izin-sakit');
                }}
                className="bg-amber-50 hover:bg-amber-100/70 border border-amber-200 rounded-3xl p-4 flex items-center justify-between cursor-pointer transition-all shadow-xs active:scale-98 group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-amber-950 leading-tight">
                      Pengajuan Izin / Sakit
                    </h3>
                    <p className="text-xs font-medium text-amber-800 mt-0.5">
                      Kirim surat dokter atau permohonan izin
                    </p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 group-hover:translate-x-1 transition-transform">
                  <ChevronRight size={18} />
                </div>
              </div>

              {/* Informasi Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-blue-600 font-black text-xs">
                  <Info size={16} />
                  <span>Informasi</span>
                </div>
                <ul className="text-xs text-slate-600 space-y-1.5 pl-1 leading-relaxed">
                  <li>• Scan masuk dilakukan saat tiba di sekolah.</li>
                  <li>• Scan pulang dilakukan saat selesai belajar.</li>
                  <li>• Pastikan QR code tersedia di lokasi sekolah.</li>
                </ul>
              </div>

              {/* Mascot Footer Illustration */}
              <div className="pt-2 flex flex-col items-center justify-center text-center space-y-2">
                <div className="bg-white border border-blue-100 px-4 py-1.5 rounded-full shadow-2xs inline-flex items-center gap-1.5 text-[11px] font-black text-blue-700">
                  <span>Disiplin Membentuk Masa Depan</span>
                  <Smile size={14} className="text-blue-600" />
                </div>

                <div className="w-48 h-24 relative flex items-center justify-center">
                  <svg viewBox="0 0 160 80" className="w-full h-full">
                    <ellipse cx="80" cy="74" rx="70" ry="6" fill="#E2E8F0" />
                    <circle cx="30" cy="55" r="10" fill="#34D399" />
                    <circle cx="130" cy="55" r="10" fill="#34D399" />
                    {/* Mini School */}
                    <rect x="50" y="40" width="60" height="34" rx="2" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" />
                    <polygon points="80,18 45,42 115,42" fill="#FB923C" />
                    <rect x="74" y="8" width="12" height="12" fill="#FFFFFF" />
                    <polygon points="80,2 70,9 90,9" fill="#EA580C" />
                    <circle cx="80" cy="14" r="3" fill="#FDE047" />
                    {/* Door */}
                    <rect x="73" y="56" width="14" height="18" rx="1" fill="#3B82F6" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SCREEN 6: PROFIL (PROFILE VIEW) */}
          {/* ========================================================================= */}
          {currentScreen === 'profil' && (
            <div className="p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
              {/* Header */}
              <div className="pt-1">
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  Profil
                </h2>
              </div>

              {/* Large Avatar & Name */}
              <div className="flex flex-col items-center justify-center text-center space-y-2 pt-2">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 p-1 shadow-lg shrink-0 overflow-hidden border-2 border-white">
                  <div className="w-full h-full rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      <circle cx="50" cy="50" r="48" fill="#93C5FD" />
                      {/* Body */}
                      <path d="M22 92 C22 72 35 68 50 68 C65 68 78 72 78 92 Z" fill="#1E3A8A" />
                      <polygon points="50,68 44,82 56,82" fill="#FFFFFF" />
                      <polygon points="50,74 47,88 53,88" fill="#EF4444" />
                      {/* Head */}
                      <circle cx="50" cy="45" r="22" fill="#FDE047" />
                      {/* Hair */}
                      <path d="M28 42 C28 26 40 20 50 20 C60 20 72 26 72 42 C72 48 70 52 70 52 C70 52 64 36 50 36 C36 36 30 52 30 52 Z" fill="#451A03" />
                      {/* Eyes */}
                      <circle cx="43" cy="44" r="3" fill="#1E293B" />
                      <circle cx="57" cy="44" r="3" fill="#1E293B" />
                      <path d="M46 51 Q50 55 54 51" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" fill="none" />
                      <circle cx="39" cy="48" r="2.5" fill="#FCA5A5" />
                      <circle cx="61" cy="48" r="2.5" fill="#FCA5A5" />
                    </svg>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-black text-slate-900 leading-tight">
                    {activeStudent.nama}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    Kelas {studentDisplayClassName} • {schoolProfile.namaSekolah || 'SD Cideng 07'}
                  </p>
                </div>
              </div>

              {/* Profile Details List Card */}
              <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-xs divide-y divide-slate-100">
                {/* NISN */}
                <div className="py-2.5 flex items-center justify-between first:pt-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center">
                      <User size={16} />
                    </div>
                    <span className="text-xs font-semibold text-slate-500">NISN</span>
                  </div>
                  <span className="text-xs font-black text-slate-900">
                    {activeStudent.nisn || '3149271621'}
                  </span>
                </div>

                {/* Sekolah */}
                <div className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center">
                      <Building size={16} />
                    </div>
                    <span className="text-xs font-semibold text-slate-500">Sekolah</span>
                  </div>
                  <span className="text-xs font-black text-slate-900">
                    {schoolProfile.namaSekolah || 'SD Cideng 07'}
                  </span>
                </div>

                {/* Kelas */}
                <div className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center">
                      <GraduationCap size={16} />
                    </div>
                    <span className="text-xs font-semibold text-slate-500">Kelas</span>
                  </div>
                  <span className="text-xs font-black text-slate-900">
                    {studentDisplayClassName}
                  </span>
                </div>

                {/* Tahun Ajaran */}
                <div className="py-2.5 flex items-center justify-between last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center">
                      <CalendarDays size={16} />
                    </div>
                    <span className="text-xs font-semibold text-slate-500">Tahun Ajaran</span>
                  </div>
                  <span className="text-xs font-black text-slate-900">
                    {schoolProfile.tahunAjaran || '2026/2027'}
                  </span>
                </div>
              </div>

              {/* Encouragement Card with Blue Shield Icon */}
              <div className="bg-blue-50/80 border border-blue-100 rounded-3xl p-4 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2.5 text-blue-900 font-black text-xs">
                  <ShieldCheck size={20} className="text-blue-600 shrink-0" />
                  <span>Tetap disiplin dalam berabsensi!</span>
                </div>
                <Smile size={20} className="text-blue-600 shrink-0" />
              </div>

              {/* Profile Bottom Actions */}
              {currentUser?.role === 'SISWA' ? (
                <div className="pt-2">
                  <button
                    onClick={logout}
                    className="w-full py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                  >
                    <LogOut size={16} />
                    <span>Keluar dari Akun Siswa</span>
                  </button>
                </div>
              ) : (
                <div className="pt-2">
                  <button
                    onClick={() => setActiveView('dashboard')}
                    className="w-full py-2.5 rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                  >
                    <ArrowLeft size={16} />
                    <span>Kembali ke Dashboard Utama</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* SCREEN 7: PENGAJUAN IZIN / SAKIT MANDIRI */}
          {/* ========================================================================= */}
          {currentScreen === 'izin-sakit' && (
            <div className="p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
              {/* Header with Back Arrow */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('tap');
                    navigateTo(previousScreen || 'beranda');
                  }}
                  className="w-9 h-9 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 transition-all cursor-pointer"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h2 className="text-base font-black text-slate-900 leading-tight">
                    Pengajuan Izin / Sakit
                  </h2>
                  <p className="text-xs text-slate-500">
                    Form resmi permohonan ketidakhadiran
                  </p>
                </div>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmitLeave} className="space-y-3.5">
                {/* 1. Pilih Kategori: Sakit vs Izin */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 block">
                    Jenis Ketidakhadiran
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('tap');
                        setLeaveType('sakit');
                      }}
                      className={`p-3 rounded-2xl border-2 font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        leaveType === 'sakit'
                          ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <HeartPulse size={18} className={leaveType === 'sakit' ? 'text-rose-600' : 'text-slate-400'} />
                      <span>Sakit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('tap');
                        setLeaveType('izin');
                      }}
                      className={`p-3 rounded-2xl border-2 font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        leaveType === 'izin'
                          ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <FileText size={18} className={leaveType === 'izin' ? 'text-amber-600' : 'text-slate-400'} />
                      <span>Izin</span>
                    </button>
                  </div>
                </div>

                {/* 2. Rentang Tanggal */}
                <div className="bg-white border border-slate-200/90 rounded-3xl p-3.5 space-y-2.5 shadow-2xs">
                  <span className="text-xs font-black text-slate-800 block">
                    Rentang Waktu
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 block mb-1">Mulai Tanggal</span>
                      <input
                        type="date"
                        value={leaveStartDate}
                        onChange={(e) => setLeaveStartDate(e.target.value)}
                        className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
                        required
                      />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 block mb-1">Sampai Tanggal</span>
                      <input
                        type="date"
                        value={leaveEndDate}
                        onChange={(e) => setLeaveEndDate(e.target.value)}
                        className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Alasan / Keterangan */}
                <div className="bg-white border border-slate-200/90 rounded-3xl p-3.5 space-y-1.5 shadow-2xs">
                  <label className="text-xs font-black text-slate-800 block">
                    Alasan / Keterangan Lengkap
                  </label>
                  <textarea
                    rows={3}
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    placeholder={
                      leaveType === 'sakit'
                        ? 'Contoh: Mengalami demam tinggi sejak semalam, istirahat di rumah...'
                        : 'Contoh: Ada keperluan keluarga di luar kota...'
                    }
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-2xl p-3 outline-none focus:border-blue-500 focus:bg-white transition-all resize-none leading-relaxed"
                    required
                  />
                </div>

                {/* 4. Data Pengaju & Kontak */}
                <div className="bg-white border border-slate-200/90 rounded-3xl p-3.5 space-y-2.5 shadow-2xs">
                  <span className="text-xs font-black text-slate-800 block">
                    Data Pengaju & Kontak
                  </span>
                  
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      {(['Orang Tua', 'Wali', 'Siswa'] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            triggerHaptic('tap');
                            setLeaveRequesterRole(r);
                          }}
                          className={`flex-1 py-1.5 rounded-xl text-[11px] font-black border transition-all cursor-pointer ${
                            leaveRequesterRole === r
                              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-500 block">Nama Pengaju</span>
                      <input
                        type="text"
                        value={leaveRequesterName}
                        onChange={(e) => setLeaveRequesterName(e.target.value)}
                        placeholder="Nama Orang Tua / Siswa"
                        className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:bg-white transition-all"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-500 block">Nomor WhatsApp</span>
                      <input
                        type="tel"
                        value={leaveRequesterPhone}
                        onChange={(e) => setLeaveRequesterPhone(e.target.value)}
                        placeholder="08xxxxxxxxxx"
                        className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Lampiran Bukti / Surat Dokter */}
                <div className="bg-white border border-slate-200/90 rounded-3xl p-3.5 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 block">
                      Lampiran Surat (Foto / Bukti)
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      Opsional / Disarankan
                    </span>
                  </div>

                  {leaveAttachment ? (
                    <div className="space-y-2">
                      <div className="relative rounded-2xl overflow-hidden border border-slate-200 max-h-48 bg-slate-50 flex items-center justify-center">
                        <img src={leaveAttachment} alt="Lampiran Surat" className="max-h-48 object-contain" />
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('tap');
                            setLeaveAttachment('');
                            setLeaveAttachmentName('');
                          }}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md cursor-pointer hover:bg-rose-700"
                        >
                          <X size={15} />
                        </button>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600 block truncate">
                        ✓ {leaveAttachmentName || 'Foto surat berhasil dilampirkan'}
                      </span>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all space-y-1">
                      <UploadCloud size={24} className="text-blue-600 mb-1" />
                      <span className="text-xs font-black text-slate-800">
                        Unggah Foto Surat Dokter / Keterangan
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Mendukung kamera HP / galeri (JPG, PNG maks. 5MB)
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLeaveFileChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* 6. Info Callout */}
                <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-3 flex items-start gap-2.5">
                  <ShieldAlert size={16} className="text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Pengajuan resmi akan diteruskan ke Wali Kelas ({studentDisplayClassName}) untuk diverifikasi. Setelah disetujui, sistem otomatis mencatat presensi Anda sebagai <b>{leaveType === 'sakit' ? 'Sakit' : 'Izin'}</b>.
                  </p>
                </div>

                {/* 7. Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmittingLeave}
                  className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-xs shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70"
                >
                  <FileText size={16} />
                  <span>
                    {isSubmittingLeave ? 'Mengirim Pengajuan...' : `Kirim Pengajuan ${leaveType === 'sakit' ? 'Sakit' : 'Izin'}`}
                  </span>
                </button>
              </form>

              {/* Riwayat Pengajuan Surat Izin Siswa */}
              <div className="space-y-2.5 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900 tracking-tight">
                    Riwayat Pengajuan Surat ({myLeaveRequests.length})
                  </h3>
                </div>

                {myLeaveRequests.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-center text-xs text-slate-500 font-medium">
                    Belum ada pengajuan izin atau sakit yang diajukan.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {myLeaveRequests.map((req) => (
                      <div
                        key={req.id}
                        className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {req.leaveType === 'sakit' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                                <HeartPulse size={11} />
                                <span>Sakit</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                                <FileText size={11} />
                                <span>Izin</span>
                              </span>
                            )}
                            <span className="text-[11px] font-bold text-slate-500">
                              {req.startDate}{req.endDate && req.endDate !== req.startDate ? ` s.d. ${req.endDate}` : ''}
                            </span>
                          </div>

                          {/* Approval Status Badge & Cancel Action */}
                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            {req.status === 'PENDING' ? (
                              <>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                  <Clock size={10} />
                                  <span>Menunggu Wali Kelas</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCancelLeave(req.id)}
                                  disabled={cancellingId === req.id}
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                                  title="Batalkan surat pengajuan izin ini"
                                >
                                  <XCircle size={10} />
                                  <span>{cancellingId === req.id ? 'Membatalkan...' : 'Batalkan'}</span>
                                </button>
                              </>
                            ) : req.status === 'APPROVED' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                                <CheckCircle2 size={10} />
                                <span>Disetujui</span>
                              </span>
                            ) : req.status === 'CANCELLED' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-300">
                                <XCircle size={10} />
                                <span>Dibatalkan</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-900 border border-rose-300">
                                <XCircle size={10} />
                                <span>Ditolak</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-slate-700 leading-relaxed font-medium bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                          {req.reason}
                        </p>

                        {/* Review info if approved, rejected, or cancelled */}
                        {req.status === 'APPROVED' && (
                          <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                            <Check size={12} strokeWidth={3} />
                            <span>Diverifikasi oleh {req.reviewedBy || 'Wali Kelas'}. Presensi resmi dicatat.</span>
                          </div>
                        )}
                        {req.status === 'REJECTED' && (
                          <div className="text-[10px] text-rose-700 font-bold flex items-center gap-1">
                            <AlertCircle size={12} />
                            <span>Catatan Wali Kelas: {req.reviewNotes || 'Pengajuan tidak disetujui.'}</span>
                          </div>
                        )}
                        {req.status === 'CANCELLED' && (
                          <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                            <AlertCircle size={12} className="text-slate-400" />
                            <span>Pengajuan telah dibatalkan oleh siswa/wali murid.</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* 3. PERSISTENT FIXED BOTTOM NAVIGATION BAR (Beranda, Absensi, Profil) */}
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-50 bg-white border-t border-slate-200/90 px-6 py-2 flex items-center justify-around shadow-[0_-4px_25px_rgba(0,0,0,0.08)] select-none pb-[max(0.625rem,env(safe-area-inset-bottom))]">
          {/* Beranda */}
          <button
            id="nav-btn-beranda"
            onClick={() => {
              triggerHaptic('tap');
              setCurrentScreen('beranda');
            }}
            className={`flex flex-col items-center gap-1 transition-all cursor-pointer py-1 px-4 rounded-xl active:scale-95 ${
              currentScreen === 'beranda'
                ? 'text-blue-600 font-black'
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <Home size={22} strokeWidth={currentScreen === 'beranda' ? 2.5 : 2} />
            <span className="text-[11px] tracking-tight font-bold">Beranda</span>
          </button>

          {/* Absensi */}
          <button
            id="nav-btn-absensi"
            onClick={() => {
              triggerHaptic('tap');
              setCurrentScreen('absensi-menu');
            }}
            className={`flex flex-col items-center gap-1 transition-all cursor-pointer py-1 px-4 rounded-xl active:scale-95 ${
              ['absensi-menu', 'scanner', 'riwayat', 'detail', 'izin-sakit'].includes(currentScreen)
                ? 'text-blue-600 font-black'
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <Calendar size={22} strokeWidth={['absensi-menu', 'scanner', 'riwayat', 'detail', 'izin-sakit'].includes(currentScreen) ? 2.5 : 2} />
            <span className="text-[11px] tracking-tight font-bold">Absensi</span>
          </button>

          {/* Profil */}
          <button
            id="nav-btn-profil"
            onClick={() => {
              triggerHaptic('tap');
              setCurrentScreen('profil');
            }}
            className={`flex flex-col items-center gap-1 transition-all cursor-pointer py-1 px-4 rounded-xl active:scale-95 ${
              currentScreen === 'profil'
                ? 'text-blue-600 font-black'
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <User size={22} strokeWidth={currentScreen === 'profil' ? 2.5 : 2} />
            <span className="text-[11px] tracking-tight font-bold">Profil</span>
          </button>
        </nav>

        {/* MONTH PICKER MODAL */}
        {showMonthPickerModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-xs w-full p-5 shadow-2xl border border-slate-100 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-sm font-black text-slate-900">Pilih Bulan & Tahun</h4>
                <button
                  onClick={() => setShowMonthPickerModal(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 max-h-56 overflow-y-auto">
                {monthNames.map((m, idx) => (
                  <button
                    key={m}
                    onClick={() => {
                      setSelectedMonth(idx);
                      setShowMonthPickerModal(false);
                    }}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedMonth === idx
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {m.slice(0, 3)}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs font-bold">
                <button
                  onClick={() => setSelectedYear((y) => y - 1)}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  &larr; {selectedYear - 1}
                </button>
                <span className="font-black text-slate-900">{selectedYear}</span>
                <button
                  onClick={() => setSelectedYear((y) => y + 1)}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  {selectedYear + 1} &rarr;
                </button>
              </div>
            </div>
          </div>
        )}



      </div>
    </div>
  );
};
