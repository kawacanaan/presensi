import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function getClientSupabaseConfig() {
  const win = typeof window !== 'undefined' ? (window as any) : {};
  const cfEnv = win.__CLOUDFLARE_ENV__ || win.__ENV__ || {};

  const url =
    cfEnv.VITE_SUPABASE_URL ||
    cfEnv.SUPABASE_URL ||
    (import.meta.env.VITE_SUPABASE_URL as string) ||
    '';

  const key =
    cfEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
    cfEnv.VITE_SUPABASE_ANON_KEY ||
    cfEnv.SUPABASE_ANON_KEY ||
    cfEnv.SUPABASE_PUBLISHABLE_KEY ||
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
    '';

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

// Background bootstrap: jika saat build belum ada kredensial, ambil dari Cloudflare Worker /api/config
if (typeof window !== 'undefined' && (!supabaseUrl || supabaseUrl.includes('placeholder'))) {
  fetch('/api/config')
    .then((r) => r.json())
    .then((data) => {
      if (data?.ok && data.supabaseUrl && data.supabaseAnonKey && !data.supabaseUrl.includes('placeholder')) {
        reconfigureSupabase(data.supabaseUrl, data.supabaseAnonKey);
      }
    })
    .catch(() => {});
}

export const usernameToEmail = (username: string) => `${username.trim().toLowerCase()}@login.edushift.local`;
