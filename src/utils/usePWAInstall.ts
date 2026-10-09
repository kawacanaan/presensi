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
 * Memeriksa apakah perangkat adalah Android atau Windows
 */
export function isAndroidOrWindows(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isAndroid = /android/.test(ua);
  const isWindows = /win/.test(ua);
  return isAndroid || isWindows;
}

/**
 * Memicu kotak dialog resmi instalasi bawaan browser/perangkat (Android & Windows).
 * Berlaku untuk semua role kecuali SUPER_ADMIN.
 * Otomatis dilewati jika aplikasi sudah terpasang di perangkat.
 * Tanpa pop-up atau modal buatan sistem Kawacanaan sama sekali.
 */
export function triggerNativePWAInstallPrompt({
  role,
  userId,
}: {
  role?: string;
  userId?: string;
}): () => void {
  if (typeof window === 'undefined') return () => {};

  // 1. Abaikan jika superadmin
  if (role === 'SUPER_ADMIN') {
    return () => {};
  }

  // 2. Abaikan jika aplikasi sudah terpasang di perangkat
  if (isPWAAlreadyInstalled()) {
    return () => {};
  }

  // 3. Hanya jalankan pada perangkat Android dan Windows
  if (!isAndroidOrWindows()) {
    return () => {};
  }

  // 4. Cek apakah pengguna baru saja menolak native dialog (snooze 3 hari agar tidak spamming sistem OS)
  const dismissedKey = `kawacanaan_pwa_native_dismissed_${userId || role || 'user'}`;
  try {
    const snoozedUntil = localStorage.getItem(dismissedKey);
    if (snoozedUntil && Number(snoozedUntil) > Date.now()) {
      return () => {};
    }
  } catch (_) {}

  let isCleanedUp = false;
  let interactionCleanup: (() => void) | null = null;

  const showPrompt = async (promptEvt: BeforeInstallPromptEvent) => {
    if (isCleanedUp) return;
    try {
      await promptEvt.prompt();
      const choice = await promptEvt.userChoice;
      if (choice.outcome === 'accepted') {
        try {
          localStorage.setItem('kawacanaan_pwa_installed', 'true');
        } catch (_) {}
        window.__PWA_DEFERRED_PROMPT__ = null;
      } else {
        // Pengguna menolak di dialog native browser -> tunda 3 hari
        try {
          localStorage.setItem(dismissedKey, String(Date.now() + 3 * 24 * 60 * 60 * 1000));
        } catch (_) {}
      }
    } catch (err) {
      // Jika browser mensyaratkan user activation (gesture), pasang listener interaksi pertama
      setupFallbackGesture(promptEvt);
    }
  };

  const setupFallbackGesture = (promptEvt: BeforeInstallPromptEvent) => {
    if (isCleanedUp) return;
    const handleGesture = () => {
      cleanupGesture();
      if (!isCleanedUp) {
        void showPrompt(promptEvt);
      }
    };
    const cleanupGesture = () => {
      window.removeEventListener('click', handleGesture, true);
      window.removeEventListener('touchend', handleGesture, true);
      window.removeEventListener('keydown', handleGesture, true);
    };
    interactionCleanup = cleanupGesture;
    window.addEventListener('click', handleGesture, { capture: true, once: true });
    window.addEventListener('touchend', handleGesture, { capture: true, once: true });
    window.addEventListener('keydown', handleGesture, { capture: true, once: true });
  };

  let timer: NodeJS.Timeout | null = null;

  const tryPrompting = () => {
    const promptEvt = window.__PWA_DEFERRED_PROMPT__;
    if (promptEvt) {
      // Tunggu 800ms agar halaman dan dashboard selesai dimuat
      timer = setTimeout(() => {
        void showPrompt(promptEvt);
      }, 800);
    }
  };

  // Jika event beforeinstallprompt sudah tertangkap sebelumnya:
  if (window.__PWA_DEFERRED_PROMPT__) {
    tryPrompting();
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
