import { createClient, SupabaseClient } from '@supabase/supabase-js';

const CONFIG_CACHE_KEY = 'kawacanaan_cached_supabase_config';

export function getClientSupabaseConfig() {
  const win = typeof window !== 'undefined' ? (window as any) : {};
  const cfEnv = win.__CLOUDFLARE_ENV__ || win.__ENV__ || {};

  // 0. MEMORY CACHE (jika sudah diset secara runtime di window)
  if (win.__DYNAMIC_SUPABASE_URL__ && win.__DYNAMIC_SUPABASE_ANON_KEY__) {
    const dUrl = String(win.__DYNAMIC_SUPABASE_URL__).trim();
    const dKey = String(win.__DYNAMIC_SUPABASE_ANON_KEY__).trim();
    if (dUrl && dKey && !dUrl.includes('placeholder')) {
      return { url: dUrl, key: dKey };
    }
  }

  // 1. PRIORITAS TERTINGGI: Nilai runtime dari Cloudflare Worker (Dashboard via __CLOUDFLARE_ENV__)
  const runtimeUrlCandidates = [
    cfEnv.VITE_SUPABASE_URL,
    cfEnv.SUPABASE_URL,
  ];
  let url = '';
  for (const c of runtimeUrlCandidates) {
    if (c && typeof c === 'string' && c.trim() && !c.includes('placeholder') && !c.includes('your-project-id')) {
      url = c.trim();
      break;
    }
  }

  // 1.5 PERSISTENT LOCALSTORAGE CACHE (jika sebelumnya sudah pernah disinkronkan dari /api/config)
  if (!url && typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(CONFIG_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.url && typeof parsed.url === 'string' && !parsed.url.includes('placeholder')) {
          url = parsed.url.trim();
        }
      }
    } catch (_) {}
  }

  // 2. FALLBACK HANYA JIKA RUNTIME BELUM TERSEDIA: Build-time import.meta.env
  if (!url) {
    const buildUrlCandidates = [
      (import.meta.env.VITE_SUPABASE_URL as string),
    ];
    for (const c of buildUrlCandidates) {
      if (c && typeof c === 'string' && c.trim() && !c.includes('placeholder') && !c.includes('your-project-id')) {
        url = c.trim();
        break;
      }
    }
  }

  // 1. PRIORITAS TERTINGGI: Kunci publik runtime dari Cloudflare Worker
  const runtimeKeyCandidates = [
    cfEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
    cfEnv.VITE_SUPABASE_ANON_KEY,
    cfEnv.SUPABASE_ANON_KEY,
    cfEnv.SUPABASE_PUBLISHABLE_KEY,
  ];
  let key = '';
  for (const k of runtimeKeyCandidates) {
    if (k && typeof k === 'string' && k.trim() && !k.includes('placeholder') && !k.includes('your-anon-key')) {
      key = k.trim();
      break;
    }
  }

  // 1.5 PERSISTENT LOCALSTORAGE CACHE KEY
  if (!key && typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(CONFIG_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.key && typeof parsed.key === 'string' && !parsed.key.includes('placeholder') && parsed.key !== 'your-anon-key') {
          key = parsed.key.trim();
        }
      }
    } catch (_) {}
  }

  // 2. FALLBACK: Build-time import.meta.env
  if (!key) {
    const buildKeyCandidates = [
      (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string),
      (import.meta.env.VITE_SUPABASE_ANON_KEY as string),
    ];
    for (const k of buildKeyCandidates) {
      if (k && typeof k === 'string' && k.trim() && !k.includes('placeholder') && !k.includes('your-anon-key')) {
        key = k.trim();
        break;
      }
    }
  }

  return { url: url.trim(), key: key.trim() };
}

const config = getClientSupabaseConfig();
export let supabaseUrl = config.url;
export let supabaseAnonKey = config.key;

function createInstance(url: string, key: string): SupabaseClient {
  return createClient(
    url || 'https://placeholder.supabase.co',
    key || 'placeholder-anon-key',
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );
}

let activeInstance: SupabaseClient = createInstance(supabaseUrl, supabaseAnonKey);

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const val = (activeInstance as any)[prop];
    if (typeof val === 'function') {
      return val.bind(activeInstance);
    }
    return val;
  },
});

export function reconfigureSupabase(url: string, key: string) {
  if (!url || !key || url.includes('placeholder')) return;
  supabaseUrl = url.trim();
  supabaseAnonKey = key.trim();

  if (typeof window !== 'undefined') {
    const win = window as any;
    win.__DYNAMIC_SUPABASE_URL__ = supabaseUrl;
    win.__DYNAMIC_SUPABASE_ANON_KEY__ = supabaseAnonKey;
    if (!win.__CLOUDFLARE_ENV__) win.__CLOUDFLARE_ENV__ = {};
    win.__CLOUDFLARE_ENV__.VITE_SUPABASE_URL = supabaseUrl;
    win.__CLOUDFLARE_ENV__.SUPABASE_URL = supabaseUrl;
    win.__CLOUDFLARE_ENV__.VITE_SUPABASE_ANON_KEY = supabaseAnonKey;
    win.__CLOUDFLARE_ENV__.SUPABASE_ANON_KEY = supabaseAnonKey;

    try {
      localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({ url: supabaseUrl, key: supabaseAnonKey }));
    } catch (_) {}
  }

  activeInstance = createInstance(supabaseUrl, supabaseAnonKey);

  if (typeof window !== 'undefined') {
    (window as any).__KAWACANAAN_SUPABASE__ = activeInstance;
    window.dispatchEvent(new CustomEvent('kawacanaan-supabase-configured', { detail: { url: supabaseUrl, key: supabaseAnonKey } }));
  }
}

// Background bootstrap: sinkronkan secara proaktif dari /api/config agar runtime terbaru selalu digunakan
if (typeof window !== 'undefined') {
  fetch('/api/config')
    .then((r) => r.json())
    .then((data) => {
      if (data?.ok && data.supabaseUrl && data.supabaseAnonKey) {
        if (!data.supabaseUrl.includes('placeholder') && (!supabaseUrl || !supabaseAnonKey || data.supabaseUrl !== supabaseUrl || data.supabaseAnonKey !== supabaseAnonKey)) {
          reconfigureSupabase(data.supabaseUrl, data.supabaseAnonKey);
        }
      }
    })
    .catch(() => {});
}

export const usernameToEmail = (username: string) => `${username.trim().toLowerCase()}@login.edushift.local`;
