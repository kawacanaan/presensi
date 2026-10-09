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
