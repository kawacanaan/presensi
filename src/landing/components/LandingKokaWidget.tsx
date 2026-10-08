import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Send,
  Sparkles,
  RotateCcw,
  Volume2,
  VolumeX,
  Palette,
  ChevronDown,
  Copy,
  Check,
  Mic,
  MicOff,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';
import { getKokaLandingResponse, KokaAnswerResult } from '../utils/kokaKnowledge';
import { getCurrentLandingContext } from '../utils/landingContextTracker';

export type ChatTheme = 'indigo' | 'emerald' | 'rose' | 'amber' | 'cyan';

const THEMES: Record<
  ChatTheme,
  {
    name: string;
    gradientHeader: string;
    userBubble: string;
    actionBtn: string;
  }
> = {
  indigo: {
    name: 'Ocean Blue',
    gradientHeader: 'from-blue-600 via-sky-600 to-indigo-700',
    userBubble: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white',
    actionBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  },
  emerald: {
    name: 'Emerald Green',
    gradientHeader: 'from-emerald-600 via-teal-600 to-green-700',
    userBubble: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white',
    actionBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  rose: {
    name: 'Rose Sunset',
    gradientHeader: 'from-rose-600 via-pink-600 to-red-600',
    userBubble: 'bg-gradient-to-r from-rose-600 to-pink-600 text-white',
    actionBtn: 'bg-rose-600 hover:bg-rose-700 text-white',
  },
  amber: {
    name: 'Golden Amber',
    gradientHeader: 'from-amber-500 via-orange-500 to-yellow-600',
    userBubble: 'bg-gradient-to-r from-amber-600 to-orange-600 text-white',
    actionBtn: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  cyan: {
    name: 'Neon Cyber',
    gradientHeader: 'from-cyan-600 via-sky-500 to-blue-600',
    userBubble: 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white',
    actionBtn: 'bg-cyan-600 hover:bg-cyan-700 text-white',
  },
};

export interface LandingChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  category?: string;
  suggestions?: string[];
  actionType?: KokaAnswerResult['actionType'];
  actionLabel?: string;
}

interface LandingKokaWidgetProps {
  onOpenLogin: () => void;
  onOpenRegister: (planId?: 'free' | 'teacher' | 'school') => void;
  lang: 'ID' | 'EN';
}

export const LandingKokaWidget: React.FC<LandingKokaWidgetProps> = ({
  onOpenLogin,
  onOpenRegister,
  lang = 'ID',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<LandingChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showGreetingBubble, setShowGreetingBubble] = useState(false);
  const [theme, setTheme] = useState<ChatTheme>('indigo');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // Web Speech API
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Posisi Terbang Koka (Draggable bebas di layar)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 300, y: 500 };
    try {
      const saved = localStorage.getItem('koka_landing_flight_pos_v1');
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
      localStorage.setItem('koka_landing_flight_pos_v1', JSON.stringify(defaultPos));
    } catch (_) {}
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
        localStorage.setItem('koka_landing_flight_pos_v1', JSON.stringify(position));
      } catch (_) {}
    }

    dragStartRef.current = { startX: 0, startY: 0, posX: 0, posY: 0, hasMoved: false };
    setIsDragging(false);
    setFlightTilt(0);
  };

  // Web Audio chime generator
  const playNotificationSound = (type: 'message' | 'success' = 'message') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08); // A5
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch (_) {}
  };

  // Muat riwayat obrolan atau tampilkan pesan sambutan awal
  useEffect(() => {
    try {
      const saved = localStorage.getItem('koka_landing_messages_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch (_) {}

    // Pesan perkenalan resmi Presiden Konoha di Landing Page sesuai instruksi
    const initialGreeting: LandingChatMessage = {
      id: 'presiden-konoha-welcome',
      role: 'assistant',
      content:
        lang === 'EN'
          ? "Halo, selamat datang di KawaCanaan Presensi! 👋 Saya Presiden Konoha. Ada yang bisa saya bantu terkait fitur presensi, alur sistem, atau pilihan paket sekolah?"
          : "Halo, selamat datang di KawaCanaan Presensi! 👋 Saya Presiden Konoha. Ada yang bisa saya bantu terkait fitur presensi, alur sistem, atau pilihan paket sekolah?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      category: 'welcome',
    };
    setMessages([initialGreeting]);
  }, [lang]);

  // Tampilkan speech bubble sapaan sebentar saja saat awal (muncul setelah 2.5s, menghilang otomatis setelah 6s)
  useEffect(() => {
    // Jangan tampilkan lagi jika chat sudah pernah dibuka di sesi ini atau pengguna sudah menutupnya
    const hasSeenGreeting = sessionStorage.getItem('koka_landing_greeting_dismissed');
    if (hasSeenGreeting || isOpen) return;

    let hideTimer: NodeJS.Timeout | null = null;
    const showTimer = setTimeout(() => {
      if (!isOpen) {
        setShowGreetingBubble(true);
        // Otomatis tutup sapaan setelah 6 detik agar tidak menetap dan tidak mengganggu
        hideTimer = setTimeout(() => {
          setShowGreetingBubble(false);
          try {
            sessionStorage.setItem('koka_landing_greeting_dismissed', 'true');
          } catch (_) {}
        }, 6000);
      }
    }, 2500);

    return () => {
      clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [isOpen]);

  // Auto-scroll ke pesan terbaru
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  // Fokus input saat chat terbuka
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // Kirim pesan dengan integrasi AI cerdas & fallback instan
  const handleSendMessage = async (text?: string) => {
    const query = (text || inputText).trim();
    if (!query || isTyping) return;

    setInputText('');
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg: LandingChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: timeString,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setIsTyping(true);

    try {
      localStorage.setItem('koka_landing_messages_v2', JSON.stringify(nextMessages.slice(-20)));
    } catch (_) {}

    // 1. Coba panggil server-side Gemini AI via /api/ai dengan konteks dinamis landing page
    let aiResponse: any = null;
    const currentContext = getCurrentLandingContext(lang === 'EN' ? 'EN' : 'ID');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'landing',
          question: query,
          context: currentContext,
          history: nextMessages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && data.answer && !data.fallback) {
          aiResponse = {
            text: data.answer,
            category: 'ai_live',
          };
        }
      }
    } catch (_) {
      // Jaringan lambat, timeout, atau offline: fallback ke engine lokal berstandar tinggi
    }

    // 2. Jika AI tidak merespons atau offline, gunakan Koka Knowledge Engine lokal dengan konteks dinamis
    if (!aiResponse) {
      await new Promise((r) => setTimeout(r, 600));
      aiResponse = getKokaLandingResponse(
        query,
        lang === 'EN' ? 'EN' : 'ID',
        currentContext,
        nextMessages.map((m) => ({ role: m.role, content: m.content }))
      );
    }

    const assistantMsg: LandingChatMessage = {
      id: `koka-${Date.now()}`,
      role: 'assistant',
      content: aiResponse.text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      category: aiResponse.category,
    };

    const finalMessages = [...nextMessages, assistantMsg];
    setMessages(finalMessages);
    setIsTyping(false);
    playNotificationSound('message');

    try {
      localStorage.setItem('koka_landing_messages_v2', JSON.stringify(finalMessages.slice(-20)));
    } catch (_) {}
  };

  const handleClearChat = () => {
    const initialGreeting: LandingChatMessage = {
      id: `presiden-konoha-welcome-${Date.now()}`,
      role: 'assistant',
      content:
        lang === 'EN'
          ? "Halo 👋 Saya Presiden Konoha. Ada yang ingin Anda ketahui tentang KawaCanaan Presensi?"
          : "Halo 👋 Saya Presiden Konoha. Ada yang ingin Anda ketahui tentang KawaCanaan Presensi?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([initialGreeting]);
    try {
      localStorage.removeItem('koka_landing_messages_v2');
    } catch (_) {}
  };

  const handleActionClick = (actionType?: KokaAnswerResult['actionType']) => {
    if (!actionType) return;
    if (actionType === 'open_login') {
      onOpenLogin();
      setIsOpen(false);
    } else if (actionType === 'open_register_free') {
      onOpenRegister('free');
      setIsOpen(false);
    } else if (actionType === 'open_register_school') {
      onOpenRegister('school');
      setIsOpen(false);
    } else if (actionType === 'open_community') {
      window.open(
        'https://chat.whatsapp.com/DfK5WYAavgLJVuHAGFetha?s=cl&p=a&mlu=4&ilr=4',
        '_blank',
        'noopener,noreferrer'
      );
      setIsOpen(false);
    } else if (actionType === 'scroll_pricing') {
      const el = document.getElementById('paket-harga');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      setIsOpen(false);
    } else if (actionType === 'scroll_features') {
      const el = document.getElementById('fitur');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      setIsOpen(false);
    } else if (actionType === 'scroll_how_it_works') {
      const el = document.getElementById('cara-kerja');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      setIsOpen(false);
    } else if (actionType === 'scroll_faq') {
      const el = document.getElementById('faq');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      setIsOpen(false);
    } else if (actionType === 'scroll_contact') {
      const el = document.getElementById('kontak');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      setIsOpen(false);
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedMsgId(id);
      setTimeout(() => setCopiedMsgId(null), 2000);
    } catch (_) {}
  };

  // Web Speech API untuk input suara
  const toggleVoiceInput = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = lang === 'EN' ? 'en-US' : 'id-ID';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (_) {
      setIsListening(false);
    }
  };

  const activeTheme = THEMES[theme] || THEMES.indigo;

  // Simple Markdown parser for bold and linebreaks
  const renderMessageContent = (content: string) => {
    const paragraphs = content.split('\n\n');
    return paragraphs.map((p, pIdx) => {
      const lines = p.split('\n');
      return (
        <p key={pIdx} className={pIdx > 0 ? 'mt-2' : ''}>
          {lines.map((line, lIdx) => {
            // Replace **bold** with <strong>
            const parts = line.split(/(\*\*.*?\*\*)/g);
            return (
              <React.Fragment key={lIdx}>
                {lIdx > 0 && <br />}
                {parts.map((part, partIdx) => {
                  if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={partIdx} className="font-bold">{part.slice(2, -2)}</strong>;
                  }
                  return part;
                })}
              </React.Fragment>
            );
          })}
        </p>
      );
    });
  };

  return (
    <>
      {/* 1. FLOATING DRAGGABLE KOKA MASCOT (Identik dengan Dashboard) */}
      <div
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0px)`,
        }}
        className="fixed top-0 left-0 z-40 touch-none select-none transition-[transform] duration-75 ease-out"
        id="koka-landing-flying-container"
      >
        {/* Proactive Speech Bubble Saat Pengunjung Membuka Landing Page */}
        {showGreetingBubble && !isOpen && (
          <div
            className={`absolute z-50 w-72 sm:w-80 p-3.5 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-sky-200 text-slate-800 animate-in fade-in zoom-in-95 duration-200 ${
              position.x > (typeof window !== 'undefined' ? window.innerWidth / 2 : 400)
                ? 'right-full mr-3.5 origin-bottom-right'
                : 'left-full ml-3.5 origin-bottom-left'
            } ${
              position.y > (typeof window !== 'undefined' ? window.innerHeight / 2 : 400)
                ? 'bottom-0'
                : 'top-0'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-sky-100/80">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full overflow-hidden bg-white border border-sky-200 shrink-0 p-0.5 shadow-2xs">
                  <img src="/presiden-konoha.png" alt="Presiden Konoha" className="w-full h-full object-contain" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900 tracking-tight">Presiden Konoha</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowGreetingBubble(false);
                  try {
                    sessionStorage.setItem('koka_landing_greeting_dismissed', 'true');
                  } catch (_) {}
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
                title="Tutup sapaan"
              >
                <X size={14} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              {lang === 'EN'
                ? 'Halo, selamat datang di KawaCanaan Presensi! Ada informasi seputar fitur presensi atau paket sekolah yang ingin Anda tanyakan?'
                : 'Halo, selamat datang di KawaCanaan Presensi! Ada informasi seputar fitur presensi atau paket sekolah yang ingin Anda tanyakan?'}
            </p>

            <div className="mt-2.5 pt-2 border-t border-sky-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowGreetingBubble(false);
                  try {
                    sessionStorage.setItem('koka_landing_greeting_dismissed', 'true');
                  } catch (_) {}
                  setIsOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white text-[11px] font-bold shadow-xs hover:shadow-md hover:from-sky-600 hover:to-blue-700 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles size={11} className="text-amber-200" />
                <span>Tanya Sekarang</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowGreetingBubble(false);
                  try {
                    sessionStorage.setItem('koka_landing_greeting_dismissed', 'true');
                  } catch (_) {}
                }}
                className="text-[11px] font-medium text-slate-400 hover:text-slate-600 px-2 py-1 transition-colors cursor-pointer"
              >
                Nanti saja
              </button>
            </div>

            {/* Bubble Beak Pointer */}
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
          title={isOpen ? 'Tutup Presiden Konoha' : 'Presiden Konoha - Tarik untuk menerbangkan ke mana saja'}
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

            {/* Hover Tooltip on Desktop */}
            {!isOpen && !isDragging && (
              <div className="hidden sm:group-hover:flex absolute -bottom-7 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-slate-900/90 text-[10px] text-white font-medium whitespace-nowrap shadow-lg border border-slate-700 items-center gap-1 pointer-events-none">
                <Sparkles size={10} className="text-yellow-400" />
                <span>Presiden Konoha • Tanya Sistem Kawacanaan</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. JENDELA CHAT KOKA (POPUP INTERAKTIF RESMI) */}
      {isOpen && (
        <div
          id="window-koka-landing-chat"
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-24px)] sm:w-[440px] h-[580px] max-h-[82vh] bg-white rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 zoom-in-95 duration-200"
        >
          {/* HEADER JENDELA CHAT */}
          <div
            className={`p-4 bg-gradient-to-r ${activeTheme.gradientHeader} text-white flex items-center justify-between relative shrink-0 select-none`}
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center gap-3 relative z-10">
              {/* Avatar Presiden Konoha */}
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/40 backdrop-blur-xs flex items-center justify-center p-0.5 shadow-xs overflow-hidden">
                  <img src="/presiden-konoha.png" alt="Presiden Konoha" className="w-full h-full object-contain" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-indigo-900 animate-pulse" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-white tracking-tight leading-tight">Presiden Konoha</h3>
                <div className="flex items-center gap-1.5 text-[11px] text-blue-100/90 font-medium mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Online • Panduan & Informasi Sistem</span>
                </div>
              </div>
            </div>

            {/* Header Action Tools */}
            <div className="flex items-center gap-1 relative z-10">
              {/* Reset Posisi */}
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

              {/* Theme Selector */}
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
                        <span className={`w-3 h-3 rounded-full bg-gradient-to-r ${THEMES[key].gradientHeader}`} />
                        <span>{THEMES[key].name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Clear Chat */}
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
                title="Tutup obrolan Presiden Konoha"
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
              >
                <ChevronDown size={18} />
              </button>
            </div>
          </div>

          {/* GUARDRAIL & PRIVACY NOTICE BANNER */}
          <div className="bg-blue-50/90 border-b border-blue-100 px-4 py-2 flex items-center justify-between text-[11px] text-blue-900 shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <ShieldCheck size={14} className="text-blue-600 shrink-0" />
              <span className="font-medium truncate">
                Ranah Presiden Konoha: <strong>Stabilitas Sistem, Regulasi Fitur, & Paket Resmi</strong>
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300/80 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Privasi Terlindungi
              </span>
            </div>
          </div>

          {/* DAFTAR PESAN CHAT */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-[#F8FAFC]/70">
            {messages.map((msg) => {
              const isAssistant = msg.role === 'assistant';

              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2.5 ${isAssistant ? 'justify-start' : 'justify-end'}`}
                >
                  {/* Avatar Presiden Konoha */}
                  {isAssistant && (
                    <div className="w-7 h-7 rounded-xl overflow-hidden bg-white border border-sky-300 flex items-center justify-center shrink-0 shadow-2xs self-start mt-1 p-0.5">
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
                    {/* Header Label */}
                    <div className="flex items-center justify-between gap-3 mb-1 text-[10px] opacity-75">
                      <span className="font-bold">{isAssistant ? 'Presiden Konoha' : 'Anda'}</span>
                      <div className="flex items-center gap-1">
                        <span>{msg.timestamp}</span>
                        {isAssistant && (
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            title="Salin teks pesan"
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-slate-900 cursor-pointer"
                          >
                            {copiedMsgId === msg.id ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Konten Pesan */}
                    <div className="space-y-1">{renderMessageContent(msg.content)}</div>
                  </div>
                </div>
              );
            })}

            {/* Koka Sedang Mengetik */}
            {isTyping && (
              <div className="flex items-end gap-2.5 justify-start">
                <div className="w-7 h-7 rounded-xl overflow-hidden bg-white border border-sky-300 flex items-center justify-center shrink-0 shadow-2xs self-start mt-1 p-0.5">
                  <img src="/presiden-konoha.png" alt="Presiden Konoha" className="w-full h-full object-contain" />
                </div>
                <div className="bg-white border border-slate-200/90 rounded-2xl rounded-bl-xs px-3.5 py-2.5 shadow-2xs flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-medium">Presiden Konoha sedang mengoordinasikan jawaban</span>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* INPUT BAR */}
          <div className="p-3 bg-white border-t border-slate-200/80 flex items-center gap-2 shrink-0">
            {/* Input Suara */}
            <button
              type="button"
              onClick={toggleVoiceInput}
              title={isListening ? 'Hentikan mendengarkan' : 'Bicara dengan suara'}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isListening
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
            >
              {isListening ? <MicOff size={17} /> : <Mic size={17} />}
            </button>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex-1 flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  lang === 'EN'
                    ? 'Coordinate with Presiden Konoha on features or pricing...'
                    : 'Koordinasikan pertanyaan tentang fitur, paket, atau stabilitas presensi...'
                }
                className="flex-1 bg-slate-100 border border-transparent focus:border-blue-500 focus:bg-white rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden transition-all"
              />

              <button
                type="submit"
                disabled={!inputText.trim() || isTyping}
                title="Kirim pertanyaan"
                className={`p-2 rounded-xl text-white transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${activeTheme.actionBtn}`}
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
