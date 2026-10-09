import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function getClientSupabaseConfig() {
  const win = typeof window !== 'undefined' ? (window as any) : {};
  const cfEnv = win.__CLOUDFLARE_ENV__ || win.__ENV__ || {};

  // 1. PRIORITAS TERTINGGI: Nilai runtime dari Cloudflare Worker (Dashboard)
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

export let supabase: SupabaseClient = createInstance(supabaseUrl, supabaseAnonKey);

export function reconfigureSupabase(url: string, key: string) {
  if (!url || !key || url.includes('placeholder')) return;
  supabaseUrl = url;
  supabaseAnonKey = key;
  supabase = createInstance(url, key);
  if (typeof window !== 'undefined') {
    (window as any).__KAWACANAAN_SUPABASE__ = supabase;
    window.dispatchEvent(new CustomEvent('kawacanaan-supabase-configured', { detail: { url, key } }));
  }
}

// Background bootstrap: sinkronkan secara proaktif dari /api/config agar runtime terbaru selalu digunakan
if (typeof window !== 'undefined') {
  fetch('/api/config')
    .then((r) => r.json())
    .then((data) => {
      if (data?.ok && data.supabaseUrl && data.supabaseAnonKey) {
        if (!data.supabaseUrl.includes('placeholder') && (data.supabaseUrl !== supabaseUrl || data.supabaseAnonKey !== supabaseAnonKey)) {
          reconfigureSupabase(data.supabaseUrl, data.supabaseAnonKey);
        }
      }
    })
    .catch(() => {});
}

export const usernameToEmail = (username: string) => `${username.trim().toLowerCase()}@login.edushift.local`;
