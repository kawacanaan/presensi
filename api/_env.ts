/**
 * Universal Environment Manager & Sync Helper
 * Menjembatani environment variables Cloudflare Workers (env object)
 * dengan runtime Node.js/Vercel (process.env).
 */

let workerEnvSnapshot: Record<string, any> = {};

export function setWorkerEnv(env: Record<string, any> | undefined | null) {
  if (!env || typeof env !== 'object') return;
  workerEnvSnapshot = { ...env };

  // 1. Inisialisasi globalThis.process.env jika belum tersedia
  if (typeof (globalThis as any).process === 'undefined') {
    (globalThis as any).process = { env: {} };
  } else if (!(globalThis as any).process.env) {
    (globalThis as any).process.env = {};
  }

  // 2. Salin seluruh binding dan secret dari Cloudflare Worker ke process.env
  for (const [key, val] of Object.entries(env)) {
    if (typeof val === 'string') {
      (globalThis as any).process.env[key] = val;
    }
  }

  // 3. Normalisasi alias kunci penting (Supabase, Midtrans, AI)
  const p = (globalThis as any).process.env;

  // Supabase URL
  if (!p.SUPABASE_URL && p.VITE_SUPABASE_URL) {
    p.SUPABASE_URL = p.VITE_SUPABASE_URL;
  }
  if (!p.VITE_SUPABASE_URL && p.SUPABASE_URL) {
    p.VITE_SUPABASE_URL = p.SUPABASE_URL;
  }

  // Supabase Keys
  if (!p.SUPABASE_SERVICE_ROLE_KEY && p.SUPABASE_SECRET_KEY) {
    p.SUPABASE_SERVICE_ROLE_KEY = p.SUPABASE_SECRET_KEY;
  }
  if (!p.SUPABASE_SECRET_KEY && p.SUPABASE_SERVICE_ROLE_KEY) {
    p.SUPABASE_SECRET_KEY = p.SUPABASE_SERVICE_ROLE_KEY;
  }
  if (!p.SUPABASE_ANON_KEY && p.VITE_SUPABASE_ANON_KEY) {
    p.SUPABASE_ANON_KEY = p.VITE_SUPABASE_ANON_KEY;
  }

  // Midtrans Keys
  if (!p.MIDTRANS_CLIENT_KEY && p.VITE_MIDTRANS_CLIENT_KEY) {
    p.MIDTRANS_CLIENT_KEY = p.VITE_MIDTRANS_CLIENT_KEY;
  }
  if (!p.VITE_MIDTRANS_CLIENT_KEY && p.MIDTRANS_CLIENT_KEY) {
    p.VITE_MIDTRANS_CLIENT_KEY = p.MIDTRANS_CLIENT_KEY;
  }
}

export function getEnv(key: string, req?: any): string {
  if (req?.env && req.env[key] !== undefined && req.env[key] !== null) {
    return String(req.env[key]);
  }
  if (workerEnvSnapshot[key] !== undefined && workerEnvSnapshot[key] !== null) {
    return String(workerEnvSnapshot[key]);
  }
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined && process.env[key] !== null) {
    return String(process.env[key]);
  }
  return '';
}
