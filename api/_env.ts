/**
 * Universal Environment Manager & Sync Helper
 * Menjembatani environment variables Cloudflare Workers (env object)
 * dengan runtime Node.js/Vercel (process.env).
 */

let workerEnvSnapshot: Record<string, any> = {};

export function setWorkerEnv(env: Record<string, any> | undefined | null) {
  if (!env || typeof env !== 'object') return;
  workerEnvSnapshot = { ...workerEnvSnapshot, ...env };

  // 1. Inisialisasi globalThis.process.env jika belum tersedia
  if (typeof (globalThis as any).process === 'undefined') {
    (globalThis as any).process = { env: {} };
  } else if (!(globalThis as any).process.env) {
    (globalThis as any).process.env = {};
  }

  // 2. Salin seluruh binding dan secret dari Cloudflare Worker ke process.env
  for (const [key, val] of Object.entries(env)) {
    if (typeof val === 'string' && val !== '') {
      (globalThis as any).process.env[key] = val;
    }
  }

  // 3. Normalisasi alias kunci penting (Supabase, Midtrans, AI)
  const p = (globalThis as any).process.env;

  const sbCandidates = [p.SUPABASE_URL, p.VITE_SUPABASE_URL];
  const preferredSbUrl = sbCandidates.find((u) => u && typeof u === 'string' && u.includes('.supabase.co')) || p.SUPABASE_URL || p.VITE_SUPABASE_URL;
  if (preferredSbUrl) {
    p.SUPABASE_URL = preferredSbUrl;
    p.VITE_SUPABASE_URL = preferredSbUrl;
  }

  if (!p.SUPABASE_SERVICE_ROLE_KEY && p.SUPABASE_SECRET_KEY) p.SUPABASE_SERVICE_ROLE_KEY = p.SUPABASE_SECRET_KEY;
  if (!p.SUPABASE_SECRET_KEY && p.SUPABASE_SERVICE_ROLE_KEY) p.SUPABASE_SECRET_KEY = p.SUPABASE_SERVICE_ROLE_KEY;
  if (!p.SUPABASE_ANON_KEY && p.VITE_SUPABASE_ANON_KEY) p.SUPABASE_ANON_KEY = p.VITE_SUPABASE_ANON_KEY;
  if (!p.SUPABASE_ANON_KEY && p.VITE_SUPABASE_PUBLISHABLE_KEY) p.SUPABASE_ANON_KEY = p.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!p.VITE_SUPABASE_PUBLISHABLE_KEY && p.SUPABASE_ANON_KEY) p.VITE_SUPABASE_PUBLISHABLE_KEY = p.SUPABASE_ANON_KEY;

  if (!p.MIDTRANS_CLIENT_KEY && p.VITE_MIDTRANS_CLIENT_KEY) p.MIDTRANS_CLIENT_KEY = p.VITE_MIDTRANS_CLIENT_KEY;
  if (!p.VITE_MIDTRANS_CLIENT_KEY && p.MIDTRANS_CLIENT_KEY) p.VITE_MIDTRANS_CLIENT_KEY = p.MIDTRANS_CLIENT_KEY;

  if (!p.GEMINI_API_KEY && p.GOOGLE_API_KEY) p.GEMINI_API_KEY = p.GOOGLE_API_KEY;
}

export function getEnv(key: string, env?: any, req?: any, fallback = ''): string {
  // 1. Objek env langsung dari Cloudflare Worker
  if (env && typeof env === 'object' && env[key] !== undefined && env[key] !== null && env[key] !== '') {
    return String(env[key]);
  }
  // 2. Objek req.env (injected by adapter)
  if (req?.env && typeof req.env === 'object' && req.env[key] !== undefined && req.env[key] !== null && req.env[key] !== '') {
    return String(req.env[key]);
  }
  // 3. Snapshot module
  if (workerEnvSnapshot[key] !== undefined && workerEnvSnapshot[key] !== null && workerEnvSnapshot[key] !== '') {
    return String(workerEnvSnapshot[key]);
  }
  // 4. process.env (Vercel / Node fallback)
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined && process.env[key] !== null && process.env[key] !== '') {
    return String(process.env[key]);
  }
  return fallback;
}

export function getSupabaseConfig(env?: any, req?: any) {
  const sbCandidates = [
    getEnv('SUPABASE_URL', env, req),
    getEnv('VITE_SUPABASE_URL', env, req),
  ];
  const url = sbCandidates.find((u) => u && typeof u === 'string' && u.includes('.supabase.co')) || sbCandidates[0] || sbCandidates[1] || '';

  const serviceKey =
    getEnv('SUPABASE_SERVICE_ROLE_KEY', env, req) ||
    getEnv('SUPABASE_SECRET_KEY', env, req) ||
    getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY', env, req) ||
    getEnv('SERVICE_ROLE_KEY', env, req) ||
    getEnv('SUPABASE_KEY', env, req);

  const anonKey =
    getEnv('VITE_SUPABASE_PUBLISHABLE_KEY', env, req) ||
    getEnv('VITE_SUPABASE_ANON_KEY', env, req) ||
    getEnv('SUPABASE_ANON_KEY', env, req) ||
    getEnv('SUPABASE_PUBLISHABLE_KEY', env, req);

  return { url, serviceKey, anonKey };
}
