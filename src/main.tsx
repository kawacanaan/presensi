import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';
import { syncPlatformBrandFromServer } from './utils/platformBranding';
import { registerServiceWorker } from './utils/webPushManager';

// Inisialisasi sinkronisasi identitas & logo platform dari server database
syncPlatformBrandFromServer();

// Daftarkan PWA Service Worker untuk Push Notification & offline shell
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void registerServiceWorker();
  });
}

// Deteksi jika jendela saat ini adalah jendela popup OAuth Google
if (typeof window !== 'undefined' && window.opener && window.opener !== window) {
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  if (
    hash.includes('access_token=') ||
    hash.includes('refresh_token=') ||
    search.includes('code=')
  ) {
    try {
      window.opener.postMessage(
        {
          type: 'KAWACANAAN_GOOGLE_AUTH_CALLBACK',
          hash,
          search,
          url: window.location.href,
        },
        '*'
      );
      setTimeout(() => {
        try {
          window.close();
        } catch (_) {}
      }, 400);
    } catch (_) {}
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

