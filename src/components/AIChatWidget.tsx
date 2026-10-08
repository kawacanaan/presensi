import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabaseClient';
import { buildAIAttendanceContext } from '../utils/aiContext';
import { getUserRoleScope } from '../utils/userScope';
import {
  resolveAttendanceIntent,
  detectLocalCommandIntent,
  create_attendance,
  update_attendance,
  PendingAction,
  PendingAttendanceRecord,
  formatIndonesianDate,
  normalizeStatus,
} from '../utils/aiAttendanceTools';
import {
  MessageSquare,
  X,
  Send,
  Mic,
  MicOff,
  Bot,
  Sparkles,
  RotateCcw,
  Copy,
  Check,
  AlertCircle,
  Volume2,
  VolumeX,
  ChevronDown,
  Palette,
  User,
  ClipboardCheck,
  CheckCircle2,
  Calendar,
  Clock,
  HelpCircle,
} from 'lucide-react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  type?: 'text' | 'confirmation' | 'result' | 'error' | 'disambiguation';
  pendingAction?: PendingAction | null;
  statusState?: 'pending' | 'confirmed' | 'cancelled' | 'executing';
  actionResult?: {
    success: boolean;
    count: number;
    records: PendingAttendanceRecord[];
    message?: string;
  };
  disambiguation?: {
    queryName: string;
    candidates: Array<{ student: any; className: string }>;
    targetStatus?: string;
    targetDate?: string;
    targetNotes?: string;
    targetTime?: string;
    remainingIntent?: any[];
  };
}

export type ChatTheme = 'indigo' | 'blue' | 'emerald' | 'violet';

interface ThemeConfig {
  name: string;
  badge: string;
  gradientHeader: string;
  userBubble: string;
  primaryBtn: string;
  activeRing: string;
  avatarBg: string;
}

const THEMES: Record<ChatTheme, ThemeConfig> = {
  indigo: {
    name: 'Biru Indigo',
    badge: 'bg-indigo-500/20 text-indigo-700',
    gradientHeader: 'from-blue-700 via-indigo-700 to-indigo-900',
    userBubble: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white',
    primaryBtn: 'bg-indigo-700 hover:bg-indigo-800 text-white',
    activeRing: 'focus:border-indigo-600 focus:ring-indigo-100',
    avatarBg: 'bg-gradient-to-tr from-blue-600 to-indigo-700 text-white',
  },
  blue: {
    name: 'Biru Edukasi',
    badge: 'bg-blue-500/20 text-blue-700',
    gradientHeader: 'from-sky-600 via-blue-600 to-blue-800',
    userBubble: 'bg-gradient-to-r from-sky-600 to-blue-600 text-white',
    primaryBtn: 'bg-blue-600 hover:bg-blue-700 text-white',
    activeRing: 'focus:border-blue-600 focus:ring-blue-100',
    avatarBg: 'bg-gradient-to-tr from-sky-600 to-blue-700 text-white',
  },
  emerald: {
    name: 'Emerald Segar',
    badge: 'bg-emerald-500/20 text-emerald-700',
    gradientHeader: 'from-emerald-700 via-teal-700 to-teal-900',
    userBubble: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white',
    primaryBtn: 'bg-emerald-700 hover:bg-emerald-800 text-white',
    activeRing: 'focus:border-emerald-600 focus:ring-emerald-100',
    avatarBg: 'bg-gradient-to-tr from-emerald-600 to-teal-700 text-white',
  },
  violet: {
    name: 'Violet Kreatif',
    badge: 'bg-violet-500/20 text-violet-700',
    gradientHeader: 'from-violet-700 via-purple-700 to-purple-900',
    userBubble: 'bg-gradient-to-r from-violet-600 to-purple-600 text-white',
    primaryBtn: 'bg-violet-700 hover:bg-violet-800 text-white',
    activeRing: 'focus:border-violet-600 focus:ring-violet-100',
    avatarBg: 'bg-gradient-to-tr from-violet-600 to-purple-700 text-white',
  },
};

const DEFAULT_SUGGESTIONS = [
  'Tolong input absensi hari ini yang sakit Andi',
  'Siapa saja siswa yang belum diabsen hari ini?',
  'Catat Budi izin dan Citra sakit hari ini',
  'Catat Doni terlambat masuk jam 07.18',
  'Berapa persen kehadiran kelas saya hari ini?',
  'Tandai semua siswa hadir hari ini',
];

function getStatusBadgeClass(status?: string | null): string {
  switch (status) {
    case 'Hadir':
      return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
    case 'Sakit':
      return 'bg-amber-100 text-amber-800 border border-amber-300';
    case 'Izin':
      return 'bg-blue-100 text-blue-800 border border-blue-300';
    case 'Alfa':
      return 'bg-rose-100 text-rose-800 border border-rose-300';
    default:
      return 'bg-slate-100 text-slate-800 border border-slate-300';
  }
}

export const AIChatWidget: React.FC = () => {
  const {
    currentUser,
    activeWorkspace,
    students,
    classes,
    teachers,
    subjects,
    attendanceRecords,
    saveDailyAttendance,
    showToast,
  } = useApp();

  // Hanya tampilkan widget untuk akun staf/guru/admin yang login
  if (!currentUser || currentUser.role === 'SISWA') {
    return null;
  }

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [theme, setTheme] = useState<ChatTheme>('indigo');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // Web Speech API
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<any>(null);

  const storageKey = `koka_ai_chat_${currentUser.id}_${activeWorkspace?.id || 'default'}`;
  const legacyStorageKey = `kawa_ai_chat_${currentUser.id}_${activeWorkspace?.id || 'default'}`;
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const userScope = useMemo(
    () => getUserRoleScope(currentUser, classes, subjects, teachers),
    [currentUser, classes, subjects, teachers]
  );

  // 1. Identifikasi Jenis Kelamin Guru & Panggilan Hormat Santun (Supabase Database)
  const userGender: 'L' | 'P' = useMemo(() => {
    if (currentUser.jenisKelamin === 'P' || currentUser.gender === 'P') return 'P';
    if (currentUser.jenisKelamin === 'L' || currentUser.gender === 'L') return 'L';
    const matchedT = teachers.find(
      (t) =>
        t.id === currentUser.teacherId ||
        (currentUser.nip && t.nip && t.nip === currentUser.nip) ||
        (currentUser.name && t.nama && t.nama.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
    );
    if (matchedT?.jenisKelamin === 'P' || (matchedT as any)?.jenis_kelamin === 'P') return 'P';
    if (matchedT?.jenisKelamin === 'L' || (matchedT as any)?.jenis_kelamin === 'L') return 'L';
    return 'L';
  }, [currentUser, teachers]);

  const honorific = userGender === 'P' ? 'Ibu' : 'Bapak';
  const teacherShortName = useMemo(() => {
    const raw = (currentUser.name || 'Guru').trim();
    const parts = raw.split(' ');
    return `${honorific} ${parts[0] || 'Guru'}`;
  }, [currentUser.name, honorific]);

  const teacherFullName = useMemo(() => {
    return `${honorific} ${currentUser.name || 'Guru'}`;
  }, [currentUser.name, honorific]);

  const getTimeGreeting = () => {
    const h = new Date().getHours();
    if (h >= 4 && h < 11) return 'Selamat pagi';
    if (h >= 11 && h < 15) return 'Selamat siang';
    if (h >= 15 && h < 18) return 'Selamat sore';
    return 'Selamat malam';
  };

  // 2. Analisis Proaktif Status Presensi Hari Ini Berdasarkan Database
  const attendanceStatus = useMemo(() => {
    const today = todayStr;

    if (userScope.isWaliKelas && userScope.assignedWaliClassId) {
      const classId = userScope.assignedWaliClassId;
      const className = userScope.assignedWaliClassName || 'Kelas Binaan';
      const classStudents = students.filter((s) => s.classId === classId);
      const todayRecords = attendanceRecords.filter(
        (r) => r.classId === classId && r.date === today && (!r.subjectId || r.subjectId === 'daily')
      );
      const recordedStudentIds = new Set(todayRecords.map((r) => r.studentId));
      const unrecordedStudents = classStudents.filter((s) => !recordedStudentIds.has(s.id));
      const hadirCount = todayRecords.filter((r) => r.status === 'Hadir').length;
      const sakitCount = todayRecords.filter((r) => r.status === 'Sakit').length;
      const izinCount = todayRecords.filter((r) => r.status === 'Izin').length;
      const alfaCount = todayRecords.filter((r) => r.status === 'Alfa').length;
      const isComplete = classStudents.length > 0 && unrecordedStudents.length === 0;

      return {
        roleType: 'WALI_KELAS' as const,
        className,
        classId,
        totalStudents: classStudents.length,
        recordedCount: recordedStudentIds.size,
        unrecordedCount: unrecordedStudents.length,
        unrecordedStudents,
        isComplete,
        hadirCount,
        sakitCount,
        izinCount,
        alfaCount,
      };
    }

    if (userScope.isGuruMapel) {
      const assignedSubjects = userScope.assignedSubjects;
      const todayMapelRecords = attendanceRecords.filter(
        (r) => r.date === today && r.subjectId && assignedSubjects.some((s) => s.id === r.subjectId)
      );
      return {
        roleType: 'GURU_MAPEL' as const,
        subjects: assignedSubjects,
        recordedCount: todayMapelRecords.length,
        isComplete: todayMapelRecords.length > 0,
      };
    }

    const todayRecords = attendanceRecords.filter((r) => r.date === today);
    return {
      roleType: 'STAFF' as const,
      totalStudents: students.length,
      recordedCount: todayRecords.length,
      isComplete: todayRecords.length > 0,
    };
  }, [userScope, students, attendanceRecords, todayStr]);

  // Ringkasan sapaan proaktif untuk speech bubble
  const greetingSummaryText = useMemo(() => {
    if (attendanceStatus.roleType === 'WALI_KELAS') {
      if (!attendanceStatus.isComplete) {
        return `Hasil pendataan nasional menunjukkan presensi untuk ${attendanceStatus.className} belum dicatat (${attendanceStatus.unrecordedCount} dari ${attendanceStatus.totalStudents} siswa belum terdata). Mohon segera koordinasikan!`;
      }
      return `Stabilitas absensi ${attendanceStatus.className} hari ini terpantau aman terkendali (${attendanceStatus.hadirCount} Hadir${attendanceStatus.sakitCount > 0 ? `, ${attendanceStatus.sakitCount} Sakit` : ''}${attendanceStatus.izinCount > 0 ? `, ${attendanceStatus.izinCount} Izin` : ''}${attendanceStatus.alfaCount > 0 ? `, ${attendanceStatus.alfaCount} Alfa` : ''}). Jalankan tugas kenegaraan ini dengan tertib!`;
    }
    if (attendanceStatus.roleType === 'GURU_MAPEL') {
      const subNames = (attendanceStatus.subjects || []).map((s: any) => s.name).join(', ') || 'Mata Pelajaran';
      if (!attendanceStatus.isComplete) {
        return `Tercatat agenda pengajaran ${subNames} hari ini. Presiden Konoha siap menerima disposisi presensi siswa.`;
      }
      return `Pendataan presensi sesi ${subNames} telah terverifikasi aman hari ini.`;
    }
    return `Presiden Konoha siap mengawal stabilitas presensi dan pendataan sekolah hari ini. Ada urusan yang perlu dikoordinasikan?`;
  }, [attendanceStatus]);

  // 3. Posisi Terbang Koka di Layar (Draggable bebas ke mana saja)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 300, y: 500 };
    try {
      const saved = localStorage.getItem('koka_flight_pos_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return {
            x: Math.max(16, Math.min(window.innerWidth - 80, parsed.x)),
            y: Math.max(16, Math.min(window.innerHeight - 80, parsed.y)),
          };
        }
      }
    } catch (_) {}
    return {
      x: window.innerWidth - 88,
      y: window.innerHeight - 96,
    };
  });

  const [isDragging, setIsDragging] = useState(false);
  const [flightTilt, setFlightTilt] = useState(0);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number; hasMoved: boolean }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
    hasMoved: false,
  });

  // Jaga posisi tetap dalam viewport saat layar di-resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => ({
        x: Math.max(16, Math.min(window.innerWidth - 80, prev.x)),
        y: Math.max(16, Math.min(window.innerHeight - 80, prev.y)),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const resetPositionToDefault = () => {
    const defaultPos = {
      x: window.innerWidth - 88,
      y: window.innerHeight - 96,
    };
    setPosition(defaultPos);
    try {
      localStorage.setItem('koka_flight_pos_v2', JSON.stringify(defaultPos));
    } catch (_) {}
    if (showToast) {
      showToast('Posisi Presiden Konoha dikembalikan ke sudut layar', 'info');
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
      hasMoved: false,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current.startX) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;

    if (!dragStartRef.current.hasMoved && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      dragStartRef.current.hasMoved = true;
      setIsDragging(true);
    }

    if (dragStartRef.current.hasMoved) {
      const newX = Math.max(16, Math.min(window.innerWidth - 80, dragStartRef.current.posX + dx));
      const newY = Math.max(16, Math.min(window.innerHeight - 80, dragStartRef.current.posY + dy));
      setPosition({ x: newX, y: newY });
      const tilt = Math.max(-18, Math.min(18, dx * 0.4));
      setFlightTilt(tilt);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}

    if (!dragStartRef.current.hasMoved) {
      // Klik murni: toggle buka/tutup chat Koka
      setIsOpen((prev) => !prev);
      setShowGreetingBubble(false);
    } else {
      // Selesai drag: simpan posisi terbang Koka
      try {
        localStorage.setItem('koka_flight_pos_v2', JSON.stringify(position));
      } catch (_) {}
    }

    dragStartRef.current = { startX: 0, startY: 0, posX: 0, posY: 0, hasMoved: false };
    setIsDragging(false);
    setFlightTilt(0);
  };

  // 4. Proactive Greeting Bubble Saat Pertama Kali Masuk Aplikasi
  const [showGreetingBubble, setShowGreetingBubble] = useState(false);

  useEffect(() => {
    const sessionGreetingKey = `koka_welcomed_${currentUser.id}_${todayStr}`;
    const alreadyGreeted = sessionStorage.getItem(sessionGreetingKey);

    if (!alreadyGreeted) {
      const timer = setTimeout(() => {
        setShowGreetingBubble(true);
        playNotificationSound('message');
        sessionStorage.setItem(sessionGreetingKey, 'true');
      }, 750);

      const autoDismiss = setTimeout(() => {
        setShowGreetingBubble(false);
      }, 12000);

      return () => {
        clearTimeout(timer);
        clearTimeout(autoDismiss);
      };
    }
  }, [currentUser.id, todayStr]);

  // Soft notification sound using Web Audio API
  const playNotificationSound = (type: 'message' | 'success' = 'message') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === 'success') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.2); // G5
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      }
    } catch (_) {}
  };

  // 5. Inisialisasi Riwayat Percakapan dari LocalStorage
  useEffect(() => {
    try {
      let saved = localStorage.getItem(storageKey);
      if (!saved) {
        saved = localStorage.getItem(legacyStorageKey);
      }
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch (_) {}

    // Sapaan awal kenegaraan dari Presiden Konoha dengan info presensi
    let reminderText = '';
    if (attendanceStatus.roleType === 'WALI_KELAS') {
      if (!attendanceStatus.isComplete) {
        reminderText = `\n\n📌 **Laporan Pendataan**: Presensi harian untuk **${attendanceStatus.className}** belum dicatat (${attendanceStatus.unrecordedCount} dari ${attendanceStatus.totalStudents} siswa belum terabsen). Anda dapat mendisposisikan: *"Tolong bantu absenkan ${attendanceStatus.className} hari ini"* atau sebutkan siswa yang sakit/izin demi menjaga stabilitas kelas.`;
      } else {
        reminderText = `\n\n✅ **Status Stabilitas**: Presensi **${attendanceStatus.className}** hari ini telah lengkap (${attendanceStatus.hadirCount} Hadir${attendanceStatus.sakitCount > 0 ? `, ${attendanceStatus.sakitCount} Sakit` : ''}${attendanceStatus.izinCount > 0 ? `, ${attendanceStatus.izinCount} Izin` : ''}${attendanceStatus.alfaCount > 0 ? `, ${attendanceStatus.alfaCount} Alfa` : ''}). Stabilitas kelas terjaga dengan baik, ${teacherShortName}!`;
      }
    } else if (attendanceStatus.roleType === 'GURU_MAPEL') {
      const subNames = (attendanceStatus.subjects || []).map((s: any) => s.name).join(', ') || 'Mata Pelajaran';
      if (!attendanceStatus.isComplete) {
        reminderText = `\n\n📌 **Laporan Agenda**: Terjadwal agenda mengajar sesi **${subNames}** hari ini. Presiden Konoha siap menerima instruksi pencatatan kehadiran siswa.`;
      }
    }

    const initialGreeting: ChatMessage = {
      id: `welcome-${Date.now()}`,
      role: 'assistant',
      type: 'text',
      content: `Salam kehormatan ${teacherFullName}! 👋 ${getTimeGreeting()}.\n\nSaya **Presiden Konoha**, aparatur tertinggi pengawal stabilitas presensi Anda di Kawacanaan. Kami memandang urusan absensi ini setara urusan kenegaraan yang amat genting. Silakan sampaikan disposisi kehadiran atau kebutuhan pendataan Anda.${reminderText}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([initialGreeting]);
  }, [storageKey, legacyStorageKey, currentUser.name, teacherFullName, teacherShortName, attendanceStatus]);

  // Simpan riwayat chat ke LocalStorage setiap ada perubahan pesan
  const persistMessages = (updated: ChatMessage[]) => {
    setMessages(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated.slice(-40)));
    } catch (_) {}
  };

  // Auto-scroll ke pesan terbaru
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  // Fokus input saat chat window dibuka
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // 2. Setup Supabase Realtime Channel
  useEffect(() => {
    const channelName = `ai-chat:${currentUser.id}`;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: true },
      },
    });

    channel
      .on('broadcast', { event: 'new_message' }, ({ payload }) => {
        if (payload && payload.id) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.id)) return prev;
            const next = [...prev, payload];
            try {
              localStorage.setItem(storageKey, JSON.stringify(next.slice(-40)));
            } catch (_) {}
            return next;
          });
          if (payload.role === 'assistant') {
            playNotificationSound('message');
          }
        }
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        setIsTyping(Boolean(payload?.isTyping));
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [currentUser.id, storageKey, soundEnabled]);

  // 3. Listen to custom window event to open chat from anywhere
  useEffect(() => {
    const handleOpenChat = (event: any) => {
      setIsOpen(true);
      const prompt = event?.detail?.prompt;
      if (prompt) {
        setTimeout(() => {
          handleSendMessage(prompt);
        }, 200);
      }
    };

    window.addEventListener('open-koka-ai-chat', handleOpenChat);
    window.addEventListener('open-kawa-ai-chat', handleOpenChat);
    window.addEventListener('open-presiden-konoha-ai-chat', handleOpenChat);
    return () => {
      window.removeEventListener('open-koka-ai-chat', handleOpenChat);
      window.removeEventListener('open-kawa-ai-chat', handleOpenChat);
      window.removeEventListener('open-presiden-konoha-ai-chat', handleOpenChat);
    };
  }, [currentUser, activeWorkspace, students, classes, teachers, subjects, attendanceRecords]);

  // 4. Voice Input via Web Speech API
  const handleVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      if (showToast) {
        showToast('Browser Anda belum mendukung input suara. Silakan gunakan teks.', 'warning');
      }
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'id-ID';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (e: any) => {
        const transcript = e.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
        setIsListening(false);
      };
      recognition.onerror = (e: any) => {
        console.warn('SpeechRecognition error:', e.error);
        setIsListening(false);
      };
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Speech error:', err);
      setIsListening(false);
    }
  };

  // 5. Eksekusi Tindakan Absensi Setelah Konfirmasi Pengguna
  const handleExecuteAction = async (messageId: string, pendingAction: PendingAction) => {
    setIsExecutingAction(true);
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
      // 1. Jalankan tool mutasi resmi menggunakan endpoint absensi yang sudah ada
      let result;
      if (pendingAction.type === 'update_attendance') {
        result = await update_attendance(pendingAction.records, saveDailyAttendance);
      } else {
        result = await create_attendance(pendingAction.records, saveDailyAttendance);
      }

      if (!result.success) {
        throw new Error(result.error || 'Absensi belum tersimpan karena terjadi kesalahan pada server.');
      }

      // 2. Tandai pesan konfirmasi sebagai selesai
      setMessages((prev) => {
        const updated = prev.map((m) =>
          m.id === messageId ? { ...m, statusState: 'confirmed' as const } : m
        );

        // 3. Buat pesan hasil keberhasilan (Result Card)
        const resultMsg: ChatMessage = {
          id: `res-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          role: 'assistant',
          type: 'result',
          content: 'Data absensi telah berhasil disimpan dan diverifikasi dalam sistem.',
          timestamp: timeString,
          actionResult: {
            success: true,
            count: pendingAction.records.length,
            records: pendingAction.records,
          },
        };

        const finalMessages = [...updated, resultMsg];
        persistMessages(finalMessages);

        // Broadcast pesan hasil
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'new_message',
            payload: resultMsg,
          });
        }

        return finalMessages;
      });

      playNotificationSound('success');
      showToast('Presensi berhasil disimpan melalui AI Assistant!', 'success');
    } catch (err: any) {
      console.error('[AIChatWidget] execution error:', err);
      showToast(err.message || 'Absensi belum tersimpan karena terjadi kesalahan pada server.', 'error');

      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        role: 'assistant',
        type: 'error',
        content: `Absensi belum tersimpan karena terjadi kesalahan pada server: ${err.message || 'Harap coba lagi.'}`,
        timestamp: timeString,
      };

      setMessages((prev) => {
        const updated = [...prev, errorMsg];
        persistMessages(updated);
        return updated;
      });
    } finally {
      setIsExecutingAction(false);
    }
  };

  // 6. Batalkan Tindakan Absensi
  const handleCancelAction = (messageId: string) => {
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => {
      const updated = prev.map((m) =>
        m.id === messageId ? { ...m, statusState: 'cancelled' as const } : m
      );

      const cancelMsg: ChatMessage = {
        id: `cancel-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        role: 'assistant',
        type: 'text',
        content: 'Tindakan input absensi dibatalkan. Tidak ada perubahan data yang disimpan.',
        timestamp: timeString,
      };

      const finalMessages = [...updated, cancelMsg];
      persistMessages(finalMessages);
      return finalMessages;
    });
  };

  // 7. Penanganan Pemilihan Siswa Ambigu (Disambiguation)
  const handleSelectDisambiguation = (
    messageId: string,
    candidate: { student: any; className: string },
    disambiguationData: NonNullable<ChatMessage['disambiguation']>
  ) => {
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const targetDate = disambiguationData.targetDate || todayStr;
    const targetStatus = normalizeStatus(disambiguationData.targetStatus);

    const pendingRec: PendingAttendanceRecord = {
      studentId: candidate.student.id,
      studentName: candidate.student.nama,
      className: candidate.className,
      classId: candidate.student.classId,
      date: targetDate,
      formattedDate: formatIndonesianDate(targetDate),
      status: targetStatus,
      checkInTime: disambiguationData.targetTime || (targetStatus === 'Hadir' ? '07:00' : null),
      notes: disambiguationData.targetNotes || (targetStatus === 'Sakit' ? 'Sakit' : targetStatus === 'Izin' ? 'Izin' : null),
    };

    const newPendingAction: PendingAction = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'create_attendance',
      records: [pendingRec],
      createdAt: Date.now(),
    };

    setMessages((prev) => {
      const updated = prev.map((m) =>
        m.id === messageId ? { ...m, statusState: 'confirmed' as const } : m
      );

      const confirmMsg: ChatMessage = {
        id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        role: 'assistant',
        type: 'confirmation',
        content: `Saya menemukan siswa: **${candidate.student.nama}** (${candidate.className}). Mohon konfirmasi penyimpanan absensi:`,
        timestamp: timeString,
        pendingAction: newPendingAction,
        statusState: 'pending',
      };

      const finalMessages = [...updated, confirmMsg];
      persistMessages(finalMessages);
      return finalMessages;
    });
  };

  // 8. Kirim Pesan & Dapatkan Jawaban AI atau Siapkan Konfirmasi Tindakan
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputText).trim();
    if (!textToSend || isTyping) return;

    setErrorMessage(null);
    setInputText('');

    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Pesan Pengguna
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      role: 'user',
      content: textToSend,
      timestamp: timeString,
    };

    // Tambahkan dan broadcast pesan pengguna
    const updatedMessages = [...messages, userMsg];
    persistMessages(updatedMessages);

    // Broadcast event realtime pesan pengguna
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'new_message',
        payload: userMsg,
      });
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { isTyping: true },
      });
    }

    setIsTyping(true);

    try {
      // 1. Cek deteksi intent lokal tercepat untuk perintah absensi
      const localIntent = detectLocalCommandIntent(textToSend, todayStr);

      // 2. Dapatkan token Supabase
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (sessionError || !token) {
        throw new Error('Sesi autentikasi Anda tidak ditemukan. Harap muat ulang halaman.');
      }

      // 3. Bangun konteks absensi
      const context = buildAIAttendanceContext({
        currentUser,
        activeWorkspace,
        students,
        classes,
        teachers,
        subjects,
        attendanceRecords,
      });

      // Format dialog history (6 turn terakhir)
      const history = updatedMessages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // 4. Panggil backend API AI
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question: textToSend,
          context,
          history,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'AI sedang tidak dapat digunakan. Silakan coba lagi.');
      }

      let assistantMsg: ChatMessage;

      // 5. Evaluasi apakah AI atau parser lokal mendeteksi perintah tindakan (ACTION COMMAND)
      const isActionRequest =
        result.responseType === 'action_request' &&
        Array.isArray(result.records) &&
        result.records.length > 0;

      const recordsToProcess = isActionRequest
        ? result.records
        : localIntent.isCommand && localIntent.records
        ? localIntent.records
        : null;

      const actionTypeToProcess = (isActionRequest ? result.action : localIntent.action) || 'create_attendance';

      if (recordsToProcess && recordsToProcess.length > 0) {
        // AI / Intent mendeteksi perintah tindakan absensi!
        // Validasi siswa, role scope, dan susun konfirmasi
        const resolved = resolveAttendanceIntent(recordsToProcess, actionTypeToProcess, {
          userScope,
          allStudents: students,
          classes,
          attendanceRecords,
          defaultDate: todayStr,
        });

        if (resolved.notFound) {
          assistantMsg = {
            id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            role: 'assistant',
            type: 'error',
            content: `Saya tidak menemukan siswa bernama "${resolved.notFound.queryName}" dalam data yang dapat Anda akses.`,
            timestamp: timeString,
          };
        } else if (resolved.permissionDenied) {
          assistantMsg = {
            id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            role: 'assistant',
            type: 'error',
            content: `Anda tidak memiliki akses untuk mengubah absensi siswa ${resolved.permissionDenied.studentName} (${resolved.permissionDenied.className}).`,
            timestamp: timeString,
          };
        } else if (resolved.ambiguous) {
          const listText = resolved.ambiguous.candidates
            .map((c, i) => `${i + 1}. ${c.student.nama} — ${c.className}`)
            .join('\n');

          assistantMsg = {
            id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            role: 'assistant',
            type: 'disambiguation',
            content: `Saya menemukan beberapa siswa bernama **${resolved.ambiguous.queryName}**:\n${listText}\n\nSilakan pilih siswa yang dimaksud:`,
            timestamp: timeString,
            disambiguation: {
              queryName: resolved.ambiguous.queryName,
              candidates: resolved.ambiguous.candidates,
              remainingIntent: resolved.ambiguous.remainingRecords,
              targetStatus: recordsToProcess[0]?.status || 'Hadir',
              targetDate: recordsToProcess[0]?.date || todayStr,
              targetNotes: recordsToProcess[0]?.notes || undefined,
              targetTime: recordsToProcess[0]?.check_in_time || undefined,
            },
          };
        } else if (resolved.ready && resolved.pendingAction) {
          // Lolos validasi penuh -> Tampilkan Card Konfirmasi Tindakan
          const isMulti = resolved.pendingAction.records.length > 1;
          const isUpdate = resolved.pendingAction.type === 'update_attendance';

          let leadText = '';
          if (isMulti) {
            leadText = `Saya telah menyiapkan ${resolved.pendingAction.records.length} data absensi untuk dicatat. Mohon periksa dan konfirmasi rincian di bawah:`;
          } else if (isUpdate) {
            leadText = `Saya menemukan catatan absensi siswa yang akan diperbarui. Mohon konfirmasi perubahan berikut:`;
          } else {
            leadText = `Saya menemukan data siswa untuk dicatat. Mohon konfirmasi absensi berikut:`;
          }

          assistantMsg = {
            id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            role: 'assistant',
            type: 'confirmation',
            content: leadText,
            timestamp: timeString,
            pendingAction: resolved.pendingAction,
            statusState: 'pending',
          };
        } else {
          assistantMsg = {
            id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            role: 'assistant',
            type: 'text',
            content: resolved.error || result.answer || 'Mohon sebutkan nama siswa dan status absensi secara lengkap.',
            timestamp: timeString,
          };
        }
      } else {
        // Pertanyaan / Informasi biasa (read-only query)
        const answerText = result.answer || 'Maaf, data presensi untuk pertanyaan tersebut belum tersedia.';
        assistantMsg = {
          id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          role: 'assistant',
          type: 'text',
          content: answerText,
          timestamp: timeString,
        };
      }

      // Matikan status typing dan broadcast pesan AI
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { isTyping: false },
        });
        channelRef.current.send({
          type: 'broadcast',
          event: 'new_message',
          payload: assistantMsg,
        });
      }

      setIsTyping(false);
      persistMessages([...updatedMessages, assistantMsg]);
      playNotificationSound('message');
    } catch (err: any) {
      console.error('[AIChatWidget] error:', err);
      setIsTyping(false);
      const safeErrorMsg = err?.message && err.message.includes('koordinasi')
        ? err.message
        : 'Permasalahan sedang dalam tahap koordinasi lintas sistem. Mohon tetap tenang.';
      setErrorMessage(safeErrorMsg);

      const errAssistantMsg: ChatMessage = {
        id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        role: 'assistant',
        type: 'error',
        content: safeErrorMsg,
        timestamp: timeString,
      };

      persistMessages([...updatedMessages, errAssistantMsg]);

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { isTyping: false },
        });
      }
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleClearChat = () => {
    const freshGreeting: ChatMessage = {
      id: `welcome-${Date.now()}`,
      role: 'assistant',
      type: 'text',
      content: `Riwayat obrolan telah dibersihkan. Ada lagi data presensi yang ingin Anda diskusikan atau tindakan yang ingin dijalankan?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    persistMessages([freshGreeting]);
    setErrorMessage(null);
  };

  const activeTheme = THEMES[theme] || THEMES.indigo;

  return (
    <>
      {/* 1. FLOATING DRAGGABLE KOKA MASCOT ("Bisa terbang ke mana saja di layar") */}
      <div
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0px)`,
        }}
        className="fixed top-0 left-0 z-40 touch-none select-none transition-[transform] duration-75 ease-out"
        id="koka-flying-mascot-container"
      >
        {/* Proactive Speech Bubble Saat Pertama Masuk Aplikasi */}
        {showGreetingBubble && !isOpen && (
          <div
            className={`absolute z-50 w-[calc(100vw-36px)] sm:w-84 max-w-[340px] p-3.5 bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl border border-sky-200 text-slate-800 animate-in fade-in zoom-in-95 duration-200 ${
              position.x > (typeof window !== 'undefined' ? window.innerWidth / 2 : 400)
                ? 'right-full mr-3.5 origin-bottom-right'
                : 'left-full ml-3.5 origin-bottom-left'
            } ${
              position.y > (typeof window !== 'undefined' ? window.innerHeight / 2 : 400)
                ? 'bottom-0'
                : 'top-0'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-base shrink-0">👋</span>
                <span className="text-xs sm:text-[13px] font-black text-sky-950 leading-tight">
                  {getTimeGreeting()}, {teacherShortName}!
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowGreetingBubble(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer shrink-0"
                title="Tutup sapaan"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed break-words">
              {greetingSummaryText}
            </p>

            <div className="mt-3 pt-2.5 border-t border-sky-100 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowGreetingBubble(false);
                  setIsOpen(true);
                  if (!attendanceStatus.isComplete && attendanceStatus.roleType === 'WALI_KELAS') {
                    handleSendMessage(`Tolong bantu cek dan input presensi kelas ${attendanceStatus.className} hari ini`);
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white text-xs font-bold shadow-xs hover:shadow-md hover:from-sky-600 hover:to-blue-700 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95"
              >
                <Sparkles size={12} className="text-amber-200" />
                <span>Buka Presiden Konoha</span>
              </button>
              <button
                type="button"
                onClick={() => setShowGreetingBubble(false)}
                className="px-2 py-1 text-xs font-medium text-slate-400 hover:text-slate-600 cursor-pointer whitespace-nowrap"
              >
                Nanti saja
              </button>
            </div>

            {/* Bubble pointer triangle beak */}
            <div
              className={`absolute w-3 h-3 bg-white border-sky-200 transform rotate-45 pointer-events-none ${
                position.x > (typeof window !== 'undefined' ? window.innerWidth / 2 : 400)
                  ? '-right-1.5 border-t border-r'
                  : '-left-1.5 border-b border-l'
              } ${
                position.y > (typeof window !== 'undefined' ? window.innerHeight / 2 : 400)
                  ? 'bottom-5'
                  : 'top-5'
              }`}
            />
          </div>
        )}

        {/* Karakter Terbang Koka Avatar */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="group relative cursor-grab active:cursor-grabbing select-none"
          style={{
            transform: `rotate(${flightTilt}deg)`,
            transition: isDragging ? 'none' : 'transform 0.25s ease-out',
          }}
          title={isOpen ? 'Tutup obrolan Presiden Konoha' : 'Presiden Konoha - Tarik untuk menerbangkan ke mana saja'}
        >
          <div className={`relative ${isDragging ? 'scale-110' : 'animate-koka-float'}`}>
            <div
              className={`relative w-15 h-15 sm:w-16 sm:h-16 rounded-full p-1 shadow-2xl flex items-center justify-center transition-all ${
                isOpen
                  ? 'bg-gradient-to-tr from-slate-700 to-slate-900 ring-4 ring-sky-300/40'
                  : 'bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-600 ring-4 ring-sky-400/30 hover:ring-sky-400/50'
              }`}
            >
              {isOpen ? (
                <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-white">
                  <X size={24} />
                </div>
              ) : (
                <div className="w-full h-full rounded-full overflow-hidden bg-white/95 border-2 border-white flex items-center justify-center shadow-inner relative">
                  <img
                    src="/presiden-konoha.png"
                    alt="Presiden Konoha"
                    className="w-full h-full object-contain pointer-events-none select-none scale-105"
                    draggable={false}
                  />
                </div>
              )}

              {/* Status Online Ping Dot */}
              {!isOpen && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 pointer-events-none">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white" />
                </span>
              )}

              {/* Jet Thruster glow beneath Koka */}
              {!isOpen && (
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-2 bg-cyan-400/80 rounded-full blur-xs animate-koka-thruster pointer-events-none" />
              )}
            </div>

            {/* Drag Flight Pill on Desktop Hover */}
            {!isOpen && !isDragging && (
              <div
                className={`hidden sm:group-hover:flex absolute -bottom-7 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-slate-900/90 text-[10px] text-white font-medium whitespace-nowrap shadow-lg border border-slate-700 items-center gap-1 pointer-events-none`}
              >
                <Sparkles size={10} className="text-yellow-400" />
                <span>Presiden Konoha • Tarik untuk terbang</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. JENDELA CHAT (POPUP LIVE CHAT WINDOW) */}
      {isOpen && (
        <div
          id="window-ai-live-chat"
          className="fixed bottom-3 right-3 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-24px)] sm:w-[460px] h-[620px] max-h-[86vh] bg-white rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 zoom-in-95 duration-200"
        >
          {/* HEADER JENDELA CHAT */}
          <div
            className={`px-4 py-3.5 bg-gradient-to-r ${activeTheme.gradientHeader} text-white flex items-center justify-between relative shrink-0 select-none`}
          >
            {/* Background Glow Deco */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center gap-3 relative z-10 min-w-0 flex-1">
              {/* Avatar Presiden Konoha di Header */}
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/40 backdrop-blur-xs flex items-center justify-center p-0.5 shadow-xs overflow-hidden">
                  <img
                    src="/presiden-konoha.png"
                    alt="Presiden Konoha"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-indigo-900 animate-pulse" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-sm sm:text-base font-black text-white tracking-tight leading-tight">
                  Presiden Konoha
                </h3>
                <div className="flex items-center gap-1.5 text-[11px] text-blue-100/90 font-medium mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                  <span>Online • Siap Membantu</span>
                </div>
              </div>
            </div>

            {/* Header Control Buttons */}
            <div className="flex items-center gap-1 relative z-10 shrink-0 ml-2">
              {/* Reset Posisi Terbang Presiden Konoha */}
              <button
                type="button"
                onClick={resetPositionToDefault}
                title="Kembalikan posisi Presiden Konoha ke sudut layar"
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
              >
                <RotateCcw size={15} />
              </button>

              {/* Sound Toggle */}
              <button
                type="button"
                onClick={() => setSoundEnabled((prev) => !prev)}
                title={soundEnabled ? 'Matikan suara notifikasi' : 'Nyalakan suara notifikasi'}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
              >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>

              {/* Theme Picker Dropdown Toggle */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowThemePicker((prev) => !prev)}
                  title="Ganti warna tema"
                  className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
                >
                  <Palette size={16} />
                </button>

                {showThemePicker && (
                  <div className="absolute right-0 top-9 w-40 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 text-slate-800 text-xs z-50 animate-in fade-in zoom-in-95">
                    <div className="font-bold text-[10px] text-slate-400 uppercase tracking-wider px-2 py-1">
                      Warna Tema
                    </div>
                    {(Object.keys(THEMES) as ChatTheme[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setTheme(key);
                          setShowThemePicker(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-xl font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                          theme === key ? 'bg-slate-100 text-indigo-700' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={`w-3 h-3 rounded-full bg-gradient-to-r ${THEMES[key].gradientHeader}`}
                        />
                        <span>{THEMES[key].name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Clear Chat Button */}
              <button
                type="button"
                onClick={handleClearChat}
                title="Bersihkan riwayat percakapan"
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
              >
                <RotateCcw size={16} />
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Tutup jendela chat"
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
              >
                <ChevronDown size={18} />
              </button>
            </div>
          </div>

          {/* SCOPE AKSES KELAS & SISTEM PRESENSI */}
          <div className="bg-slate-50 border-b border-slate-200/80 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 shrink-0">
            <div className="flex items-center gap-1.5 min-w-0 leading-tight">
              <span className="text-slate-500 shrink-0">Akses:</span>
              <strong className="text-slate-800 font-bold">{userScope.roleBadgeLabel}</strong>
              {userScope.assignedWaliClassName && (
                <span className="text-slate-600 font-medium">
                  • Kelas {userScope.assignedWaliClassName.replace(/^(kelas|kls)\s+/i, '')}
                </span>
              )}
            </div>
            <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200/90 text-[10px] font-semibold text-slate-700 shadow-2xs shrink-0">
              {attendanceStatus.roleType === 'WALI_KELAS' ? 'Presensi Harian' : 'Presensi Terintegrasi'}
            </span>
          </div>

          {/* DAFTAR PESAN (CHAT MESSAGE LIST) */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-[#F8FAFC]/60">
            {messages.map((msg) => {
              const isAssistant = msg.role === 'assistant';

              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2.5 ${isAssistant ? 'justify-start' : 'justify-end'}`}
                >
                  {/* Avatar Presiden Konoha di Sebelah Kiri */}
                  {isAssistant && (
                    <div
                      className="w-7 h-7 rounded-xl overflow-hidden bg-white border border-sky-300 flex items-center justify-center shrink-0 shadow-2xs self-start mt-1 p-0.5"
                    >
                      <img src="/presiden-konoha.png" alt="Presiden Konoha" className="w-full h-full object-contain" />
                    </div>
                  )}

                  {/* Bubble Pesan */}
                  <div
                    className={`relative group max-w-[88%] sm:max-w-[84%] rounded-2xl p-3.5 text-xs sm:text-[13px] leading-relaxed transition-all shadow-2xs ${
                      isAssistant
                        ? 'bg-white border border-slate-200/90 text-slate-800 rounded-bl-xs font-normal'
                        : `${activeTheme.userBubble} rounded-br-xs font-medium`
                    }`}
                  >
                    {/* Header Label Bubble */}
                    <div className="flex items-center justify-between gap-3 mb-1 text-[10px] opacity-75">
                      <span className="font-bold tracking-tight">
                        {isAssistant ? 'Presiden Konoha' : 'Anda'}
                      </span>
                      <span>{msg.timestamp}</span>
                    </div>

                    {/* Isi Pesan Teks Utama */}
                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>

                    {/* 1. CARD DISAMBIGUASI (PILIHAN BEBERAPA SISWA DENGAN NAMA SAMA) */}
                    {msg.type === 'disambiguation' && msg.disambiguation && (
                      <div className="mt-3 bg-blue-50/90 border border-blue-200/90 rounded-2xl p-3 text-xs text-blue-900 shadow-2xs">
                        <div className="flex items-center gap-1.5 font-bold mb-2 text-blue-950 text-[11px]">
                          <HelpCircle size={14} className="text-blue-600" />
                          <span>Pilih Siswa yang Dimaksud:</span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {msg.disambiguation.candidates.map((c: any, idx: number) => (
                            <button
                              key={c.student?.id || idx}
                              type="button"
                              disabled={msg.statusState === 'confirmed'}
                              onClick={() => handleSelectDisambiguation(msg.id, c, msg.disambiguation!)}
                              className="text-left px-3 py-2 rounded-xl bg-white border border-blue-200 hover:border-blue-400 hover:bg-blue-50/60 text-slate-800 font-semibold text-xs shadow-2xs transition-all cursor-pointer flex items-center justify-between group/item disabled:opacity-60"
                            >
                              <span>
                                {idx + 1}. <strong>{c.student.nama}</strong> — {c.className}
                              </span>
                              <span className="text-[10px] text-blue-600 group-hover/item:translate-x-0.5 transition-transform font-bold">
                                Pilih →
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 2. CARD KONFIRMASI TINDAKAN (PREVIEW & KONFIRMASI PENGGUNA) */}
                    {msg.type === 'confirmation' && msg.pendingAction && (
                      <div className="mt-3 bg-gradient-to-b from-amber-50/90 to-amber-100/60 border border-amber-200/90 rounded-2xl p-3.5 shadow-2xs text-slate-800 animate-in fade-in zoom-in-98 duration-150">
                        {/* Header Card Konfirmasi */}
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-200/80">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0">
                              <ClipboardCheck size={13} />
                            </div>
                            <span className="font-extrabold text-xs text-amber-950">
                              Konfirmasi Tindakan
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-amber-800/80 uppercase tracking-wider">
                            {msg.pendingAction.records.length > 1
                              ? `${msg.pendingAction.records.length} Siswa`
                              : '1 Siswa'}
                          </span>
                        </div>

                        <p className="text-[11px] font-semibold text-amber-900/90 mb-2">
                          Data yang akan diubah:
                        </p>

                        {/* Rincian: 1 Siswa */}
                        {msg.pendingAction.records.length === 1 ? (
                          <div className="bg-white/95 border border-amber-200/80 rounded-xl p-3 space-y-1.5 text-xs shadow-2xs">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-medium text-[11px]">Siswa:</span>
                              <span className="font-bold text-slate-900">
                                {msg.pendingAction.records[0].studentName}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-medium text-[11px]">Kelas:</span>
                              <span className="font-semibold text-slate-700">
                                {msg.pendingAction.records[0].className}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-medium text-[11px]">Tanggal:</span>
                              <span className="font-semibold text-slate-700">
                                {msg.pendingAction.records[0].formattedDate}
                              </span>
                            </div>

                            {/* Tampilan Perubahan (Jika Update) */}
                            {msg.pendingAction.records[0].previousStatus ? (
                              <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                                <span className="text-slate-500 font-medium text-[11px]">Sebelumnya:</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                  {msg.pendingAction.records[0].previousStatus}
                                </span>
                              </div>
                            ) : null}

                            <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                              <span className="text-slate-500 font-medium text-[11px]">
                                {msg.pendingAction.records[0].previousStatus ? 'Menjadi:' : 'Status:'}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${getStatusBadgeClass(
                                  msg.pendingAction.records[0].status
                                )}`}
                              >
                                {msg.pendingAction.records[0].status}
                                {msg.pendingAction.records[0].notes?.toLowerCase().includes('terlambat')
                                  ? ' (Terlambat)'
                                  : ''}
                              </span>
                            </div>

                            {msg.pendingAction.records[0].checkInTime && (
                              <div className="flex justify-between items-center">
                                <span className="text-slate-500 font-medium text-[11px]">Jam Masuk:</span>
                                <span className="font-semibold text-slate-700">
                                  {msg.pendingAction.records[0].checkInTime}
                                </span>
                              </div>
                            )}

                            {msg.pendingAction.records[0].notes &&
                              !msg.pendingAction.records[0].notes.toLowerCase().includes('terlambat') && (
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-500 font-medium text-[11px]">Catatan:</span>
                                  <span className="font-medium text-slate-600 italic text-[11px]">
                                    {msg.pendingAction.records[0].notes}
                                  </span>
                                </div>
                              )}
                          </div>
                        ) : (
                          /* Rincian: Banyak Siswa */
                          <div className="space-y-2">
                            <div className="bg-white/95 border border-amber-200/80 rounded-xl p-2.5 max-h-48 overflow-y-auto space-y-1.5 text-xs divide-y divide-slate-100 shadow-2xs">
                              {msg.pendingAction.records.map((rec, idx) => (
                                <div
                                  key={idx}
                                  className="pt-1.5 first:pt-0 flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0 flex-1">
                                    <span className="font-bold text-slate-900 block truncate">
                                      {rec.studentName}
                                    </span>
                                    <span className="text-[10px] text-slate-500">{rec.className}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {rec.previousStatus && (
                                      <>
                                        <span className="text-[10px] text-slate-400 line-through">
                                          {rec.previousStatus}
                                        </span>
                                        <span className="text-[10px] text-slate-400">→</span>
                                      </>
                                    )}
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusBadgeClass(
                                        rec.status
                                      )}`}
                                    >
                                      {rec.status}
                                      {rec.notes?.toLowerCase().includes('terlambat') ? ' (Terlambat)' : ''}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between items-center px-1 text-[11px] text-slate-600 font-medium">
                              <span>Tanggal: <strong>{msg.pendingAction.records[0]?.formattedDate}</strong></span>
                              <span>Total: <strong>{msg.pendingAction.records.length} Siswa</strong></span>
                            </div>
                          </div>
                        )}

                        {/* Tombol Konfirmasi Pengguna */}
                        {msg.statusState === 'pending' || !msg.statusState ? (
                          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-amber-200/60">
                            <button
                              type="button"
                              onClick={() => handleCancelAction(msg.id)}
                              className="flex-1 py-2 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                            >
                              Batalkan
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExecuteAction(msg.id, msg.pendingAction!)}
                              disabled={isExecutingAction}
                              className={`flex-1 py-2 px-3 rounded-xl ${activeTheme.primaryBtn} text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5`}
                            >
                              {isExecutingAction ? (
                                <>
                                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  <span>Menyimpan...</span>
                                </>
                              ) : (
                                <span>
                                  {msg.pendingAction.records.length > 1
                                    ? 'Simpan Semua'
                                    : msg.pendingAction.type === 'update_attendance'
                                    ? 'Simpan Perubahan'
                                    : 'Simpan Absensi'}
                                </span>
                              )}
                            </button>
                          </div>
                        ) : msg.statusState === 'confirmed' ? (
                          <div className="mt-2.5 py-1.5 px-3 rounded-xl bg-emerald-100/90 text-emerald-800 text-[11px] font-bold flex items-center gap-1.5">
                            <Check size={14} className="text-emerald-700" />
                            <span>Tindakan telah dikonfirmasi dan disimpan</span>
                          </div>
                        ) : msg.statusState === 'cancelled' ? (
                          <div className="mt-2.5 py-1.5 px-3 rounded-xl bg-slate-200/80 text-slate-600 text-[11px] font-semibold flex items-center gap-1.5">
                            <X size={14} className="text-slate-500" />
                            <span>Tindakan dibatalkan oleh pengguna</span>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* 3. CARD HASIL (RESULT CARD) */}
                    {msg.type === 'result' && msg.actionResult && (
                      <div className="mt-2.5 bg-emerald-50/95 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-950 shadow-2xs animate-in fade-in">
                        <div className="flex items-center gap-1.5 font-bold mb-1.5 text-emerald-800">
                          <CheckCircle2 size={16} className="text-emerald-600" />
                          <span>Berhasil Menyimpan Absensi</span>
                        </div>
                        <ul className="space-y-1 text-[11px] pl-1 divide-y divide-emerald-100/70">
                          {msg.actionResult.records.map((r, i) => (
                            <li key={i} className="flex items-center justify-between pt-1 first:pt-0">
                              <span>
                                • <strong>{r.studentName}</strong> ({r.className})
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getStatusBadgeClass(r.status)}`}>
                                {r.status}
                                {r.notes?.toLowerCase().includes('terlambat') ? ' (Terlambat)' : ''}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-[10px] text-emerald-700 mt-2 pt-1.5 border-t border-emerald-200/60 font-semibold">
                          ✓ Terverifikasi di database sekolah
                        </p>
                      </div>
                    )}

                    {/* Tombol Copy untuk Pesan Asisten */}
                    {isAssistant && (
                      <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg.id, msg.content)}
                          className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                          title="Salin pesan"
                        >
                          {copiedMsgId === msg.id ? (
                            <>
                              <Check size={11} className="text-emerald-600" />
                              <span className="text-emerald-600 font-bold">Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span>Salin</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Avatar Pengguna di Sebelah Kanan */}
                  {!isAssistant && (
                    <div className="w-7 h-7 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 shadow-2xs font-bold text-[11px] border border-white self-start mt-1">
                      <User size={14} />
                    </div>
                  )}
                </div>
              );
            })}

            {/* ANIMASI INDIKATOR "SEDANG MENGETIK..." (TYPING INDICATOR) */}
            {isTyping && (
              <div className="flex items-end gap-2.5 justify-start animate-in fade-in duration-200">
                {/* Avatar Presiden Konoha di Sebelah Kiri */}
                <div
                  className="w-7 h-7 rounded-xl overflow-hidden bg-white border border-sky-300 flex items-center justify-center shrink-0 shadow-2xs p-0.5"
                >
                  <img src="/presiden-konoha.png" alt="Presiden Konoha" className="w-full h-full object-contain" />
                </div>

                {/* Bubble Typing dengan 3 Titik Animasi */}
                <div className="bg-white border border-slate-200/90 rounded-2xl rounded-bl-xs px-3.5 py-2.5 shadow-2xs flex items-center gap-2 text-slate-500">
                  <span className="text-[11px] font-semibold text-slate-600">
                    Presiden Konoha sedang mengoordinasikan data
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce" />
                  </div>
                </div>
              </div>
            )}

            {/* Pesan Kesalahan Jika Ada */}
            {errorMessage && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold block">Pemberitahuan</span>
                  <span className="text-[11px]">{errorMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="text-rose-600 hover:text-rose-800 text-[10px] font-bold cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* CHIP REKOMENDASI PERTANYAAN & TINDAKAN (QUICK SUGGESTIONS) */}
          <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {DEFAULT_SUGGESTIONS.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                disabled={isTyping}
                onClick={() => handleSendMessage(sug)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 text-[11px] font-medium border border-slate-200/80 hover:border-indigo-200 transition-all shrink-0 cursor-pointer disabled:opacity-50"
              >
                {sug}
              </button>
            ))}
          </div>

          {/* FOOTER FORMULIR INPUT CHAT */}
          <div className="p-3 bg-white border-t border-slate-200/80 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    isListening
                      ? 'Mendengarkan ucapan Anda...'
                      : 'Ketik perintah atau pertanyaan absensi...'
                  }
                  disabled={isTyping}
                  className={`w-full pl-3.5 pr-9 py-2.5 rounded-2xl border border-slate-200 text-xs sm:text-[13px] text-slate-800 bg-white outline-none transition-all ${activeTheme.activeRing} focus:ring-2 disabled:opacity-50 min-h-[42px]`}
                  id="input-live-ai-chat"
                />

                {isListening && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
                  </span>
                )}
              </div>

              {/* Tombol Suara Mikrofon */}
              <button
                type="button"
                onClick={handleVoiceInput}
                disabled={isTyping}
                title={isListening ? 'Hentikan rekaman' : 'Kirim dengan suara (Mikrofon)'}
                className={`p-2.5 rounded-2xl border transition-all flex items-center justify-center min-h-[42px] min-w-[42px] cursor-pointer ${
                  isListening
                    ? 'bg-rose-600 text-white border-rose-700 shadow-md animate-pulse'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600 hover:text-indigo-700'
                } disabled:opacity-50`}
                id="btn-voice-live-ai-chat"
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              {/* Tombol Kirim Pesan */}
              <button
                type="submit"
                disabled={isTyping || !inputText.trim()}
                className={`p-2.5 rounded-2xl ${activeTheme.primaryBtn} transition-all shadow-sm flex items-center justify-center min-h-[42px] min-w-[42px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
                id="btn-send-live-ai-chat"
                title="Kirim perintah (Enter)"
              >
                <Send size={16} />
              </button>
            </form>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 px-1">
              <span>Tekan Enter untuk mengirim</span>
              <span>Presiden Konoha • Presensi Terintegrasi</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
