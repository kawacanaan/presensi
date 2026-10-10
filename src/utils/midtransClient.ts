/**
 * Midtrans Client Configuration & Snap Script Loader
 * 
 * Modul ini menyediakan utilitas aman di sisi frontend untuk:
 * 1. Mengambil konfigurasi publik Midtrans (Client Key & URL Snap) dari API server.
 * 2. Memuat script Midtrans Snap (Sandbox vs Production) secara dinamis sesuai environment.
 * 3. Menghindari hardcode endpoint Sandbox sebagai satu-satunya fallback.
 * 4. Menjamin Server Key tidak pernah diminta atau diproses di sisi klien.
 */

export interface MidtransClientConfig {
  ok: boolean;
  client_key?: string;
  is_production?: boolean;
  enabled?: boolean;
  is_configured?: boolean;
  snap_url?: string;
  payment_link_teacher?: string;
  error?: string;
}

/**
 * Mendapatkan URL Snap JS library fallback yang sesuai dengan mode environment.
 */
export function getSnapJsFallbackUrl(isProduction?: boolean): string {
  const isProd =
    isProduction ??
    (typeof import.meta !== 'undefined' &&
      (import.meta.env?.VITE_MIDTRANS_IS_PRODUCTION === 'true' ||
        import.meta.env?.VITE_MIDTRANS_IS_PRODUCTION === '1' ||
        import.meta.env?.VITE_MIDTRANS_IS_PRODUCTION === 'production'));

  return isProd
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js';
}

let cachedConfig: { data: MidtransClientConfig; timestamp: number } | null = null;
let pendingConfigRequest: Promise<MidtransClientConfig> | null = null;

/**
 * Mengambil konfigurasi publik Midtrans dari endpoint backend /api/midtrans?action=get_client_config.
 * Endpoint ini aman karena hanya mengembalikan client_key publik, mode environment, dan URL Snap.
 */
export async function fetchMidtransClientConfig(forceRefresh = false): Promise<MidtransClientConfig> {
  const now = Date.now();
  if (cachedConfig && !forceRefresh && (now - cachedConfig.timestamp < 10000)) {
    return cachedConfig.data;
  }

  if (pendingConfigRequest && !forceRefresh) {
    return pendingConfigRequest;
  }

  pendingConfigRequest = (async () => {
    try {
      const res = await fetch(`/api/midtrans?action=get_client_config&_t=${now}`);
      const data = await res.json();
      if (res.ok && data) {
        const result: MidtransClientConfig = {
          ok: Boolean(data.ok),
          client_key: data.client_key || '',
          is_production: Boolean(data.is_production),
          enabled: data.enabled !== undefined ? Boolean(data.enabled) : true,
          is_configured: Boolean(data.is_configured),
          snap_url: data.snap_url || getSnapJsFallbackUrl(Boolean(data.is_production)),
          payment_link_teacher: data.payment_link_teacher || data.guru_payment_link || '',
        };
        cachedConfig = { data: result, timestamp: Date.now() };
        return result;
      }
      return { ok: false, error: data?.error || 'Gagal memuat konfigurasi pembayaran Midtrans' };
    } catch (err: any) {
      console.warn('[Midtrans Client] Gagal menghubungi endpoint konfigurasi:', err);
      // Fallback menggunakan variabel lingkungan runtime frontend jika tersedia
      const win = typeof window !== 'undefined' ? (window as any) : {};
      const cf = win.__CLOUDFLARE_ENV__ || {};
      const viteKey =
        cf.MIDTRANS_CLIENT_KEY ||
        cf.VITE_MIDTRANS_CLIENT_KEY ||
        (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_MIDTRANS_CLIENT_KEY : '') ||
        '';
      const rawProd =
        cf.MIDTRANS_IS_PRODUCTION ||
        cf.VITE_MIDTRANS_IS_PRODUCTION ||
        (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_MIDTRANS_IS_PRODUCTION : '');
      const viteProd = rawProd === 'true' || rawProd === '1' || rawProd === 'production';

      const fallbackResult: MidtransClientConfig = {
        ok: Boolean(viteKey),
        client_key: viteKey || '',
        is_production: viteProd,
        enabled: Boolean(viteKey),
        is_configured: Boolean(viteKey),
        snap_url: getSnapJsFallbackUrl(viteProd),
      };
      cachedConfig = { data: fallbackResult, timestamp: Date.now() };
      return fallbackResult;
    } finally {
      pendingConfigRequest = null;
    }
  })();

  return pendingConfigRequest;
}

/**
 * Memuat script snap.js ke dalam DOM secara dinamis dan aman.
 * Jika script sebelumnya sudah ada namun berbeda mode (Sandbox vs Production) atau client key berubah,
 * script lama akan digantikan dengan yang baru agar transaksi diproses di environment yang tepat.
 */
export function loadMidtransSnapScript(cfg: MidtransClientConfig): Promise<HTMLScriptElement | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return resolve(null);
    }

    if (!cfg.enabled || !cfg.client_key) {
      return resolve(null);
    }

    const expectedSrc = cfg.snap_url || getSnapJsFallbackUrl(cfg.is_production);
    const scriptId = 'midtrans-snap-script';
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (existing) {
      const currentSrc = existing.src || '';
      const currentKey = existing.getAttribute('data-client-key') || '';
      if (currentSrc === expectedSrc && currentKey === cfg.client_key) {
        // Script sudah sesuai dan aktif
        return resolve(existing);
      }
      // Mode environment atau Client Key berganti, hapus script lama
      try {
        existing.remove();
        if ((window as any).snap) {
          delete (window as any).snap;
        }
      } catch (_) {}
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = expectedSrc;
    script.setAttribute('data-client-key', cfg.client_key);
    script.async = true;

    script.onload = () => {
      resolve(script);
    };

    script.onerror = (e) => {
      console.warn('[Midtrans Client] Gagal mengunduh script snap.js dari:', expectedSrc, e);
      resolve(null);
    };

    document.body.appendChild(script);
  });
}
