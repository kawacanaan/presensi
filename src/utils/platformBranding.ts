/**
 * Platform Branding Manager for Kawacanaan System
 * Menyediakan sinkronisasi reaktif logo dan identitas platform ke seluruh aplikasi.
 */

import { useState, useEffect } from 'react';

export const DEFAULT_PLATFORM_LOGO = '/lk.png';
export const DEFAULT_PLATFORM_NAME = 'Kawacanaan Presensi';

const STORAGE_KEY_LOGO = 'kawacanaan_platform_logo';
const STORAGE_KEY_NAME = 'kawacanaan_platform_name';
const EVENT_BRAND_UPDATED = 'kawacanaan:brand-updated';

// In-memory state initialized from localStorage if available
let currentLogo: string = (() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_LOGO);
    return saved && saved.trim() ? saved.trim() : DEFAULT_PLATFORM_LOGO;
  } catch (_) {
    return DEFAULT_PLATFORM_LOGO;
  }
})();

let currentName: string = (() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_NAME);
    return saved && saved.trim() ? saved.trim() : DEFAULT_PLATFORM_NAME;
  } catch (_) {
    return DEFAULT_PLATFORM_NAME;
  }
})();

/**
 * Update favicon in browser tab dynamically
 */
export function updateFavicon(logoUrl?: string) {
  if (typeof document === 'undefined') return;
  // Jika logo adalah default atau kosong, gunakan favicon.png / logo default
  const isDefault = !logoUrl || !logoUrl.trim() || logoUrl === DEFAULT_PLATFORM_LOGO || logoUrl === '/lk.png';
  const targetUrl = isDefault ? '/favicon.png' : logoUrl.trim();

  try {
    // Cari atau buat link icon
    let iconLink = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (!iconLink) {
      iconLink = document.createElement('link');
      iconLink.rel = 'icon';
      document.head.appendChild(iconLink);
    }
    iconLink.href = targetUrl;

    // Cari atau buat apple-touch-icon
    let appleLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null;
    if (!appleLink) {
      appleLink = document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      document.head.appendChild(appleLink);
    }
    appleLink.href = targetUrl;
  } catch (err) {
    console.warn('[Branding] Gagal memperbarui favicon:', err);
  }
}

/**
 * Update PWA Web Manifest secara dinamis agar ikon aplikasi yang diinstal
 * di Android maupun Windows selalu mengikuti logo resmi yang sedang aktif.
 */
export function updateWebManifest(logoUrl?: string, appName?: string) {
  if (typeof document === 'undefined') return;
  const activeLogo = logoUrl && logoUrl.trim() ? logoUrl.trim() : DEFAULT_PLATFORM_LOGO;
  const activeName = appName && appName.trim() ? appName.trim() : DEFAULT_PLATFORM_NAME;

  try {
    const manifestObj = {
      id: '/?v=2',
      name: activeName,
      short_name: activeName.replace(/\s+Presensi$/i, ''),
      description: 'Sistem Presensi Digital Terpadu Sekolah — Portal Siswa & Wali Murid Real-Time',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#F8FAFC',
      theme_color: '#2563EB',
      orientation: 'portrait',
      icons: [
        {
          src: activeLogo,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: activeLogo,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: activeLogo,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    };

    const manifestBlob = new Blob([JSON.stringify(manifestObj)], { type: 'application/manifest+json' });
    const manifestUrl = URL.createObjectURL(manifestBlob);

    let manifestLink = document.querySelector("link[rel='manifest']") as HTMLLinkElement | null;
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = manifestUrl;
  } catch (err) {
    console.warn('[Branding] Gagal memperbarui Web Manifest:', err);
  }
}

/**
 * Get active platform logo URL
 */
export function getPlatformLogo(): string {
  return currentLogo;
}

/**
 * Get active platform name
 */
export function getPlatformName(): string {
  return currentName;
}

/**
 * Check if the current logo is the default one
 */
export function isUsingDefaultLogo(): boolean {
  return !currentLogo || currentLogo === DEFAULT_PLATFORM_LOGO || currentLogo === '/lk.png';
}

/**
 * Set and broadcast new platform brand (logo & name)
 */
export function setPlatformBrand(updates: { logoUrl?: string | null; appName?: string | null }) {
  const newLogo = updates.logoUrl !== undefined 
    ? (updates.logoUrl && updates.logoUrl.trim() ? updates.logoUrl.trim() : DEFAULT_PLATFORM_LOGO)
    : currentLogo;
    
  const newName = updates.appName !== undefined 
    ? (updates.appName && updates.appName.trim() ? updates.appName.trim() : DEFAULT_PLATFORM_NAME)
    : currentName;

  currentLogo = newLogo;
  currentName = newName;

  try {
    if (newLogo === DEFAULT_PLATFORM_LOGO) {
      localStorage.removeItem(STORAGE_KEY_LOGO);
    } else {
      localStorage.setItem(STORAGE_KEY_LOGO, newLogo);
    }

    if (newName === DEFAULT_PLATFORM_NAME) {
      localStorage.removeItem(STORAGE_KEY_NAME);
    } else {
      localStorage.setItem(STORAGE_KEY_NAME, newName);
    }
  } catch (_) {}

  // Update favicon and dynamic web manifest for PWA installation
  updateFavicon(newLogo);
  updateWebManifest(newLogo, newName);

  // Broadcast event to all listening components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(EVENT_BRAND_UPDATED, {
        detail: { logoUrl: newLogo, appName: newName },
      })
    );
  }
}

let syncPromise: Promise<void> | null = null;

/**
 * Fetch public brand from server and update local cache if changed
 */
export async function syncPlatformBrandFromServer(): Promise<void> {
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_public_brand' }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.ok) {
        const serverLogo = data.app_logo_url;
        const serverName = data.app_name;
        setPlatformBrand({
          logoUrl: serverLogo,
          appName: serverName,
        });
      }
    } catch (_) {
      // Ignore background network errors
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
}

// Initial sync on app load
if (typeof window !== 'undefined') {
  updateFavicon(currentLogo);
  updateWebManifest(currentLogo, currentName);
  // Defer server sync slightly to avoid blocking initial render
  setTimeout(() => {
    void syncPlatformBrandFromServer();
  }, 100);
}

/**
 * React Hook to consume synchronized platform logo and name
 */
export function usePlatformBrand() {
  const [logoUrl, setLogoUrl] = useState<string>(currentLogo);
  const [appName, setAppName] = useState<string>(currentName);

  useEffect(() => {
    const handleBrandUpdate = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail) {
        if (detail.logoUrl !== undefined) setLogoUrl(detail.logoUrl);
        if (detail.appName !== undefined) setAppName(detail.appName);
      } else {
        setLogoUrl(getPlatformLogo());
        setAppName(getPlatformName());
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_LOGO || e.key === STORAGE_KEY_NAME) {
        setLogoUrl(getPlatformLogo());
        setAppName(getPlatformName());
      }
    };

    window.addEventListener(EVENT_BRAND_UPDATED, handleBrandUpdate);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(EVENT_BRAND_UPDATED, handleBrandUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return {
    logoUrl,
    appName,
    isDefaultLogo: !logoUrl || logoUrl === DEFAULT_PLATFORM_LOGO || logoUrl === '/lk.png',
    setBrand: setPlatformBrand,
    refreshFromServer: syncPlatformBrandFromServer,
  };
}
