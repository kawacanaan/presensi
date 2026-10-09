import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __PWA_DEFERRED_PROMPT__?: BeforeInstallPromptEvent | null;
  }
}

// Global listener agar event beforeinstallprompt tidak terlewat sebelum komponen mount
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    window.__PWA_DEFERRED_PROMPT__ = e as BeforeInstallPromptEvent;
  });

  window.addEventListener('appinstalled', () => {
    try {
      localStorage.setItem('kawacanaan_pwa_installed', 'true');
    } catch (_) {}
    window.__PWA_DEFERRED_PROMPT__ = null;
  });
}

/**
 * Memeriksa apakah aplikasi sudah terpasang di perangkat
 * (mode standalone window PWA, Android app referrer, atau status instalasi tersimpan).
 */
export function isPWAAlreadyInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if ((window.navigator as unknown as { standalone?: boolean }).standalone === true) return true;
  if (typeof document !== 'undefined' && document.referrer && document.referrer.startsWith('android-app://')) return true;
  try {
    if (localStorage.getItem('kawacanaan_pwa_installed') === 'true') {
      return true;
    }
  } catch (_) {}
  return false;
}

/**
 * Memeriksa apakah perangkat adalah Windows (Laptop/PC dengan Chrome atau Edge)
 */
export function isWindowsDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = (window.navigator?.userAgent || '').toLowerCase();
  const navAny = window.navigator as any;
  const platform = (navAny.userAgentData?.platform || navAny.platform || '').toLowerCase();
  return /windows|win32|win64/.test(ua) || /win/.test(platform);
}

/**
 * Memeriksa apakah perangkat adalah Android
 */
export function isAndroidDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = (window.navigator?.userAgent || '').toLowerCase();
  const navAny = window.navigator as any;
  const platform = (navAny.userAgentData?.platform || navAny.platform || '').toLowerCase();
  return /android/.test(ua) || /android/.test(platform);
}

/**
 * Memeriksa apakah perangkat adalah Android atau Windows
 */
export function isAndroidOrWindows(): boolean {
  return isWindowsDevice() || isAndroidDevice();
}

/**
 * Bersihkan penundaan kotak dialog bawaan browser saat user baru login
 */
export function clearPWADismissedState(userId?: string, role?: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`kawacanaan_pwa_native_dismissed_${userId || role || 'user'}`);
    localStorage.removeItem('kawacanaan_pwa_native_dismissed_session');
  } catch (_) {}
}

/**
 * Eksekusi langsung kotak dialog instalasi bawaan browser (Chrome / Edge di Windows & Android)
 * Dijalankan dalam konteks user gesture (misalnya saat tombol login ditekan).
 */
export async function executeImmediatePWAInstall(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (isPWAAlreadyInstalled()) return false;
  const promptEvt = window.__PWA_DEFERRED_PROMPT__;
  if (!promptEvt) return false;
  try {
    await promptEvt.prompt();
    const choice = await promptEvt.userChoice;
    if (choice?.outcome === 'accepted') {
      try {
        localStorage.setItem('kawacanaan_pwa_installed', 'true');
      } catch (_) {}
      window.__PWA_DEFERRED_PROMPT__ = null;
      return true;
    }
  } catch (err) {
    console.debug('[PWA] Immediate install deferral:', err);
  }
  return false;
}

/**
 * Memicu kotak dialog resmi instalasi bawaan browser/perangkat (Laptop/PC Windows Chrome/Edge & Android).
 * Berlaku saat pengguna login di sistem.
 * Otomatis dilewati jika aplikasi sudah terpasang di perangkat (standalone window).
 * Menampilkan 100% dialog native browser (tanpa pop-up buatan Kawacanaan).
 */
export function triggerNativePWAInstallPrompt({
  role,
  userId,
}: {
  role?: string;
  userId?: string;
} = {}): () => void {
  if (typeof window === 'undefined') return () => {};

  // 1. Abaikan jika aplikasi sudah terpasang di perangkat
  if (isPWAAlreadyInstalled()) {
    return () => {};
  }

  // 2. Hanya jalankan pada perangkat Laptop/PC Windows (Chrome / Edge) atau Android
  if (!isAndroidOrWindows()) {
    return () => {};
  }

  // 3. Jangan aktifkan pada konsol Super Admin
  if (role === 'SUPER_ADMIN') {
    return () => {};
  }

  // 4. Cek penolakan sebelumnya (snooze 1 hari agar tidak berulang kali memblokir aktivitas yang sama)
  const dismissedKey = `kawacanaan_pwa_native_dismissed_${userId || role || 'user'}`;
  try {
    const snoozedUntil = localStorage.getItem(dismissedKey);
    if (snoozedUntil && Number(snoozedUntil) > Date.now()) {
      return () => {};
    }
  } catch (_) {}

  let isCleanedUp = false;
  let interactionCleanup: (() => void) | null = null;
  let timer: any = null;

  const showPrompt = async (promptEvt: BeforeInstallPromptEvent) => {
    if (isCleanedUp) return;
    try {
      await promptEvt.prompt();
      const choice = await promptEvt.userChoice;
      if (choice?.outcome === 'accepted') {
        try {
          localStorage.setItem('kawacanaan_pwa_installed', 'true');
        } catch (_) {}
        window.__PWA_DEFERRED_PROMPT__ = null;
      } else {
        // Pengguna memilih batal/nanti pada dialog native browser -> tunda 1 hari
        try {
          localStorage.setItem(dismissedKey, String(Date.now() + 24 * 60 * 60 * 1000));
        } catch (_) {}
      }
    } catch (err) {
      // Browser (Chrome/Edge desktop di Windows) mensyaratkan user gesture aktif,
      // pasang listener interaksi pertama (klik/keyboard)
      setupFallbackGesture(promptEvt);
    }
  };

  const setupFallbackGesture = (promptEvt: BeforeInstallPromptEvent) => {
    if (isCleanedUp) return;
    if (interactionCleanup) {
      interactionCleanup();
      interactionCleanup = null;
    }

    const handleGesture = () => {
      cleanupGesture();
      if (!isCleanedUp) {
        void showPrompt(promptEvt);
      }
    };

    const cleanupGesture = () => {
      window.removeEventListener('click', handleGesture, true);
      window.removeEventListener('pointerup', handleGesture, true);
      window.removeEventListener('keydown', handleGesture, true);
      interactionCleanup = null;
    };

    interactionCleanup = cleanupGesture;
    window.addEventListener('click', handleGesture, { capture: true, once: true });
    window.addEventListener('pointerup', handleGesture, { capture: true, once: true });
    window.addEventListener('keydown', handleGesture, { capture: true, once: true });
  };

  const tryPrompting = () => {
    const promptEvt = window.__PWA_DEFERRED_PROMPT__;
    if (promptEvt) {
      // Pada Laptop/PC Windows atau Android, coba langsung jalankan dialog bawaan browser
      // Jika browser memblokir karena membutuhkan user gesture, listener gesture langsung aktif
      void showPrompt(promptEvt);
    }
  };

  // Jika event beforeinstallprompt sudah tertangkap sebelumnya:
  if (window.__PWA_DEFERRED_PROMPT__) {
    // Jalankan segera setelah render siap (300ms)
    timer = setTimeout(() => {
      tryPrompting();
    }, 300);
  }

  // Dengarkan juga event beforeinstallprompt jika baru datang sesaat setelah login
  const onBeforeInstallPrompt = (e: Event) => {
    e.preventDefault();
    const promptEvt = e as BeforeInstallPromptEvent;
    window.__PWA_DEFERRED_PROMPT__ = promptEvt;
    tryPrompting();
  };

  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);

  return () => {
    isCleanedUp = true;
    if (timer) clearTimeout(timer);
    if (interactionCleanup) interactionCleanup();
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  };
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    return (typeof window !== 'undefined' ? window.__PWA_DEFERRED_PROMPT__ : null) || null;
  });
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isWindows, setIsWindows] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect standalone mode (already installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));
    setIsAndroid(/android/.test(ua));
    setIsWindows(/win/.test(ua));

    if (window.__PWA_DEFERRED_PROMPT__) {
      setDeferredPrompt(window.__PWA_DEFERRED_PROMPT__);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__PWA_DEFERRED_PROMPT__ = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      window.__PWA_DEFERRED_PROMPT__ = null;
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    const promptEvent = deferredPrompt || (typeof window !== 'undefined' ? window.__PWA_DEFERRED_PROMPT__ : null);
    if (!promptEvent) return false;
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        if (typeof window !== 'undefined') {
          window.__PWA_DEFERRED_PROMPT__ = null;
        }
        setDeferredPrompt(null);
        return true;
      }
    } catch (_) {}
    return false;
  };

  return {
    isInstallable: Boolean(deferredPrompt || (typeof window !== 'undefined' && window.__PWA_DEFERRED_PROMPT__)),
    isInstalled,
    isIOS,
    isAndroid,
    isWindows,
    deferredPrompt,
    install,
  };
}
