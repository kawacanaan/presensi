import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  X,
  Camera,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Lock,
  Sparkles,
  UploadCloud,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { Student, AttendanceRecord, SystemConfig, SchoolClass } from '../types';
import { parseClassQrPayload } from '../utils/classQr';
import { playChimeSuccess, playChimeWarning } from '../utils/audioFeedback';
import { getServerNow, formatServerTimeString, formatServerDateString } from '../utils/serverTime';

interface StudentQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeStudent: Student;
  classes: SchoolClass[];
  todayRecord?: AttendanceRecord;
  systemConfig: SystemConfig;
  onSubmitAttendance: (
    studentId: string,
    action: 'masuk' | 'pulang',
    notes?: string,
    targetDate?: string,
    exactTimeStr?: string
  ) => Promise<{ success: boolean; message?: string }>;
  targetDate: string;
  targetAction?: 'masuk' | 'pulang';
  isSimulation?: boolean;
}

export type ScanStatusType =
  | 'idle'
  | 'processing'
  | 'success_masuk'
  | 'success_pulang'
  | 'debounced'
  | 'rejected'
  | 'completed';

export const StudentQrScannerModal: React.FC<StudentQrScannerModalProps> = ({
  isOpen,
  onClose,
  activeStudent,
  classes,
  todayRecord,
  systemConfig,
  onSubmitAttendance,
  targetDate,
  targetAction,
  isSimulation,
}) => {
  const [scanStatus, setScanStatus] = useState<ScanStatusType>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [recordedTime, setRecordedTime] = useState<string>('');
  const [cameraError, setCameraError] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  // Student's registered class
  const studentClass = classes.find(
    (c) => c.id === activeStudent.classId || c.name === activeStudent.className
  );

  // Check initial state
  const hasCheckedIn = !!(
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
  const hasCheckedOut = !!(
    todayRecord &&
    todayRecord.checkOutTime &&
    todayRecord.checkOutTime !== '-' &&
    todayRecord.checkOutTime !== ''
  );

  // Cleanup scanner on unmount or close
  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
      scannerRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startScanner = async (mode: 'environment' | 'user') => {
    setCameraError('');
    await stopScanner();

    // Check if element exists
    const container = document.getElementById('qr-camera-viewport');
    if (!container) return;

    try {
      const html5QrCode = new Html5Qrcode('qr-camera-viewport');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: mode },
        {
          fps: 12,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleDecodedPayload(decodedText);
        },
        () => {
          // Ignore frequent frame decode misses
        }
      );
      setIsCameraActive(true);
    } catch (err: any) {
      console.error('Camera start error:', err);
      const msg = String(err?.message || err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission denied')) {
        setCameraError('Izin kamera ditolak. Silakan izinkan akses kamera di browser Anda untuk memindai QR.');
      } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError')) {
        setCameraError('Kamera tidak ditemukan pada perangkat ini.');
      } else {
        setCameraError('Gagal membuka kamera: ' + msg);
      }
      setIsCameraActive(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setScanStatus('idle');
      setStatusMessage('');
      setRecordedTime('');
      isProcessingRef.current = false;
      // Slight delay to ensure DOM is rendered
      const t = setTimeout(() => {
        startScanner(facingMode);
      }, 300);
      return () => clearTimeout(t);
    } else {
      stopScanner();
    }
  }, [isOpen]);

  // Flip Camera
  const toggleCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startScanner(nextMode);
  };

  // Process decoded QR payload
  const handleDecodedPayload = async (decodedText: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    const serverNow = getServerNow();
    const exactServerDate = formatServerDateString(serverNow);
    const exactServerTime = formatServerTimeString(serverNow);
    const [curH, curM] = [serverNow.getHours(), serverNow.getMinutes()];
    const currentTotalMinutes = curH * 60 + curM;

    // 1. Parse QR payload
    const parsed = parseClassQrPayload(decodedText);
    if (!parsed.valid || !parsed.classId) {
      playChimeWarning();
      setScanStatus('rejected');
      setStatusMessage(parsed.error || 'Format QR Code tidak valid.');
      isProcessingRef.current = false;
      return;
    }

    // 2. Validate Class Ownership (Akun Siswa -> Siswa -> Kelas Siswa -> QR Kelas)
    const scannedClassId = parsed.classId;
    const scannedClassName = parsed.className || 'Rombel Lain';

    const cleanStudentClassName = (activeStudent.className || studentClass?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanScannedClassName = (parsed.className || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // Verify if student matches class (with simulation bypass and loose name matching)
    const isClassMatch =
      Boolean(isSimulation) ||
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
      setScanStatus('rejected');
      const studentClassName = activeStudent.className || studentClass?.name || 'Kelas Terdaftar';
      setStatusMessage(
        `QR Code ini milik ${scannedClassName}. Anda terdaftar di ${studentClassName}. Presensi ditolak.`
      );
      isProcessingRef.current = false;
      return;
    }

    // 3. Time Window Checks
    const [startH, startM] = (systemConfig.checkInStartTime || '06:00').split(':').map(Number);
    const startMinutes = (startH || 6) * 60 + (startM || 0);

    const [dlH, dlM] = (systemConfig.checkInDeadlineTime || '07:00').split(':').map(Number);
    const deadlineMinutes = (dlH || 7) * 60 + (dlM || 0);
    const cutoffMinutes = deadlineMinutes + 60; // 60 menit toleransi setelah deadline

    const [outH, outM] = (systemConfig.checkOutStartTime || '12:30').split(':').map(Number);
    const outMinutes = (outH || 12) * 60 + (outM || 30);

    // 4. State Machine Evaluation
    // CASE A: Both Check-in & Check-out already completed -> LOCKED
    if (hasCheckedIn && hasCheckedOut) {
      playChimeWarning();
      setScanStatus('completed');
      setStatusMessage(
        `Presensi hari ini sudah lengkap (Masuk: ${todayRecord?.checkInTime} • Pulang: ${todayRecord?.checkOutTime}). Selamat beristirahat!`
      );
      setRecordedTime(todayRecord?.checkOutTime || exactServerTime);
      isProcessingRef.current = false;
      return;
    }

    // Specific validation if student clicked "Scan Presensi Masuk" but has already checked in
    if (targetAction === 'masuk' && hasCheckedIn) {
      playChimeWarning();
      setScanStatus('debounced');
      setStatusMessage(
        `Presensi masuk Anda sudah tercatat pukul ${todayRecord?.checkInTime} WIB. Gunakan tombol Scan Presensi Pulang saat jam pulang sekolah.`
      );
      setRecordedTime(todayRecord?.checkInTime || exactServerTime);
      isProcessingRef.current = false;
      return;
    }

    const isCheckOutScan = targetAction ? targetAction === 'pulang' : hasCheckedIn;

    // CASE B: Has Checked In, attempting scan for pulang
    if (isCheckOutScan) {
      // Check if checkout time is NOT yet reached
      if (!isSimulation && currentTotalMinutes < outMinutes) {
        playChimeWarning();
        setScanStatus('debounced');
        setStatusMessage(
          `Presensi masuk sudah tercatat pukul ${todayRecord?.checkInTime} WIB. Presensi pulang baru dibuka pukul ${systemConfig.checkOutStartTime || '12:30'} WIB. Tidak perlu scan ulang.`
        );
        setRecordedTime(todayRecord?.checkInTime || exactServerTime);
        isProcessingRef.current = false;
        return;
      }

      // Check for rapid accidental double-scan right after check-in (less than 2 mins)
      if (!isSimulation && todayRecord?.checkInTime) {
        const [inH, inM] = todayRecord.checkInTime.split(':').map(Number);
        const inMinutes = inH * 60 + inM;
        if (Math.abs(currentTotalMinutes - inMinutes) < 2) {
          playChimeWarning();
          setScanStatus('debounced');
          setStatusMessage(
            `Presensi masuk baru saja tercatat (${todayRecord.checkInTime} WIB). Mohon tunggu sebelum presensi pulang.`
          );
          isProcessingRef.current = false;
          return;
        }
      }

      // Eligible for PULANG (Check-out)
      setScanStatus('processing');
      setStatusMessage('Mencatat presensi pulang...');

      const res = await onSubmitAttendance(
        activeStudent.id,
        'pulang',
        undefined,
        exactServerDate,
        exactServerTime
      );

      if (res.success) {
        playChimeSuccess();
        setScanStatus('success_pulang');
        setRecordedTime(exactServerTime);
        setStatusMessage(`Presensi pulang berhasil dicatat pukul ${exactServerTime} WIB. Hati-hati di jalan!`);
      } else {
        playChimeWarning();
        setScanStatus('rejected');
        setStatusMessage(res.message || 'Gagal memproses presensi pulang.');
      }
      isProcessingRef.current = false;
      return;
    }

    // CASE C: Scan -> MASUK (Check-in)
    if (!hasCheckedIn) {
      // Check if too early
      if (!isSimulation && currentTotalMinutes < startMinutes) {
        playChimeWarning();
        setScanStatus('rejected');
        setStatusMessage(
          `Presensi masuk belum dibuka. Jam buka presensi: ${systemConfig.checkInStartTime || '06:00'} WIB.`
        );
        isProcessingRef.current = false;
        return;
      }

      // Check if after cutoff window (only enforce if autoMarkLate is disabled)
      if (!isSimulation && systemConfig.autoMarkLate === false && currentTotalMinutes > cutoffMinutes) {
        playChimeWarning();
        setScanStatus('rejected');
        setStatusMessage(
          `Waktu scan mandiri masuk telah ditutup (lewat batas toleransi). Silakan lapor langsung ke Wali Kelas Anda.`
        );
        isProcessingRef.current = false;
        return;
      }

      const isLate = currentTotalMinutes > deadlineMinutes;
      const notes = isLate ? 'Terlambat (via Scan QR)' : 'Hadir Tepat Waktu (via Scan QR)';

      setScanStatus('processing');
      setStatusMessage('Mencatat presensi masuk...');

      const res = await onSubmitAttendance(
        activeStudent.id,
        'masuk',
        notes,
        exactServerDate,
        exactServerTime
      );

      if (res.success) {
        playChimeSuccess();
        setScanStatus('success_masuk');
        setRecordedTime(exactServerTime);
        setStatusMessage(
          `Presensi masuk berhasil dicatat pukul ${exactServerTime} WIB.${isLate ? ' Status: Terlambat.' : ' Selamat belajar!'}`
        );
      } else {
        playChimeWarning();
        setScanStatus('rejected');
        setStatusMessage(res.message || 'Gagal memproses presensi masuk.');
      }
      isProcessingRef.current = false;
      return;
    }
  };

  // Fallback: Scan from image file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setScanStatus('processing');
      setStatusMessage('Membaca gambar QR Code...');
      const html5QrCode = new Html5Qrcode('qr-camera-viewport');
      const decoded = await html5QrCode.scanFile(file, true);
      handleDecodedPayload(decoded);
    } catch (err: any) {
      playChimeWarning();
      setScanStatus('rejected');
      setStatusMessage('Tidak dapat mendeteksi QR Code dari gambar yang dipilih.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden text-slate-900 my-auto animate-in zoom-in-95 duration-200 flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black shadow-inner">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-white text-sm sm:text-base tracking-tight">
                {targetAction === 'masuk'
                  ? 'Scan Presensi Masuk'
                  : targetAction === 'pulang'
                  ? 'Scan Presensi Pulang'
                  : 'Scan Presensi Rombel'}
              </h3>
              <p className="text-[11px] text-blue-300 font-semibold truncate max-w-[240px]">
                {activeStudent.nama} • {studentClass?.name || 'Kelas Siswa'} • {formatServerDateString(getServerNow())}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {isCameraActive && (
              <button
                type="button"
                onClick={toggleCamera}
                className="p-1.5 rounded-xl bg-white/10 text-slate-300 hover:text-white hover:bg-white/20 transition cursor-pointer"
                title="Ganti Kamera"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 text-slate-300 hover:text-white hover:bg-white/20 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewport Area */}
        <div className="p-4 space-y-4">
          
          {/* Camera Viewport Container */}
          <div className="relative w-full aspect-square bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border-2 border-slate-800 shadow-inner">
            
            {/* HTML5 QR Camera Element */}
            <div id="qr-camera-viewport" className="w-full h-full overflow-hidden" />

            {/* Target Laser / Scanning Overlay */}
            {isCameraActive && scanStatus === 'idle' && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-56 h-56 border-2 border-blue-400/70 rounded-2xl relative shadow-2xl">
                  {/* Corner accents */}
                  <span className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                  <span className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                  <span className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                  {/* Animated laser line */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-bounce mt-24 shadow-md shadow-emerald-400/50" />
                </div>
              </div>
            )}

            {/* Camera Error Display */}
            {cameraError && (
              <div className="absolute inset-0 bg-slate-900/95 p-6 flex flex-col items-center justify-center text-center text-white space-y-3 z-20">
                <AlertCircle className="w-10 h-10 text-rose-400" />
                <p className="text-xs text-rose-200 leading-relaxed max-w-xs">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => startScanner(facingMode)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Coba Akses Kamera Lagi
                </button>
              </div>
            )}
          </div>

          {/* Status Feedback Banner */}
          {scanStatus === 'success_masuk' ? (
            <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl text-emerald-950 flex items-start gap-3 animate-in zoom-in-95">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="space-y-0.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-emerald-900 text-sm">🟢 SUDAH MASUK</span>
                  <span className="px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-900 font-mono font-bold text-[10px]">
                    {recordedTime} WIB
                  </span>
                </div>
                <p className="text-emerald-800 leading-snug">{statusMessage}</p>
              </div>
            </div>
          ) : scanStatus === 'success_pulang' ? (
            <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-2xl text-blue-950 flex items-start gap-3 animate-in zoom-in-95">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="space-y-0.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-blue-900 text-sm">🔵 SUDAH PULANG</span>
                  <span className="px-1.5 py-0.2 rounded bg-blue-200 text-blue-900 font-mono font-bold text-[10px]">
                    {recordedTime} WIB
                  </span>
                </div>
                <p className="text-blue-800 leading-snug">{statusMessage}</p>
              </div>
            </div>
          ) : scanStatus === 'debounced' ? (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl text-amber-950 flex items-start gap-3 animate-in zoom-in-95">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="space-y-0.5 text-xs">
                <span className="font-black text-amber-900 text-sm">🟢 PRESENSI MASUK SUDAH TERCATAT</span>
                <p className="text-amber-800 leading-snug">{statusMessage}</p>
              </div>
            </div>
          ) : scanStatus === 'completed' ? (
            <div className="p-4 bg-slate-100 border-2 border-slate-300 rounded-2xl text-slate-800 flex items-start gap-3 animate-in zoom-in-95">
              <div className="w-9 h-9 rounded-xl bg-slate-700 text-white flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div className="space-y-0.5 text-xs">
                <span className="font-black text-slate-900 text-sm">🔒 PRESENSI HARI INI SELESAI</span>
                <p className="text-slate-600 leading-snug">{statusMessage}</p>
              </div>
            </div>
          ) : scanStatus === 'rejected' ? (
            <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl text-rose-950 flex items-start gap-3 animate-in zoom-in-95">
              <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-0.5 text-xs">
                <span className="font-black text-rose-900 text-sm">⚠️ PRESENSI DITOLAK</span>
                <p className="text-rose-800 leading-snug">{statusMessage}</p>
              </div>
            </div>
          ) : (
            /* Idle Instruction */
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl text-xs text-blue-900 flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                Arahkan kamera tepat ke <strong>QR Code Rombel {studentClass?.name || 'Kelas Anda'}</strong>. Waktu server dicatat otomatis.
              </span>
            </div>
          )}

          {/* Current Status Preview Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Status Hari Ini:</span>
              <div className="font-extrabold text-slate-800 mt-0.5">
                {hasCheckedIn && hasCheckedOut
                  ? '🔒 Lengkap (Masuk & Pulang)'
                  : hasCheckedIn
                  ? `🟢 Masuk (${todayRecord?.checkInTime} WIB)`
                  : '🟡 Belum Presensi'}
              </div>
            </div>

            {/* Upload image fallback */}
            <label className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs">
              <UploadCloud className="w-3.5 h-3.5 text-slate-500" />
              <span>Pilih Gambar</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
          >
            {scanStatus === 'success_masuk' || scanStatus === 'success_pulang' ? 'Selesai' : 'Tutup Scanner'}
          </button>
        </div>

      </div>
    </div>
  );
};
