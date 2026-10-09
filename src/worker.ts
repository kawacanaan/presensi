/**
 * Cloudflare Worker Entry Point — KawaCanaan Presensi
 *
 * Menggabungkan backend API (/api/*) dan frontend SPA static assets (./dist)
 * dalam satu Cloudflare Worker runtime tanpa mengubah logika bisnis yang sudah ada.
 */

import { setWorkerEnv } from '../api/_env';
import handleAdminUsers from '../api/admin-users';
import handleAi from '../api/ai';
import handleAttendance from '../api/attendance';
import handleMidtrans from '../api/midtrans';
import handleOnboarding from '../api/onboarding';
import handlePushNotification from '../api/push-notification';
import handleRegisterSchool from '../api/register-school';
import handleResolveLogin from '../api/resolve-login';
import handleSchoolLookup from '../api/school-lookup';
import handleSetupSuperadmin from '../api/setup-superadmin';
import handleSuperadmin from '../api/superadmin';
import handleSyncTeacherAssignments from '../api/sync-teacher-assignments';
import handleSyncWaliKelas from '../api/sync-wali-kelas';

interface WorkerFetcher {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  ASSETS: WorkerFetcher;
  SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  MIDTRANS_CLIENT_KEY?: string;
  VITE_MIDTRANS_CLIENT_KEY?: string;
  MIDTRANS_SERVER_KEY?: string;
  MIDTRANS_MERCHANT_ID?: string;
  MIDTRANS_IS_PRODUCTION?: string;
  VITE_MIDTRANS_IS_PRODUCTION?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  GEMINI_API_KEY?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  [key: string]: any;
}

type ApiHandler = (req: any, res: any, env?: Env) => Promise<any> | any;

const ROUTES: Record<string, ApiHandler> = {
  'admin-users': handleAdminUsers,
  'ai': handleAi,
  'attendance': handleAttendance,
  'midtrans': handleMidtrans,
  'onboarding': handleOnboarding,
  'push-notification': handlePushNotification,
  'register-school': handleRegisterSchool,
  'resolve-login': handleResolveLogin,
  'school-lookup': handleSchoolLookup,
  'setup-superadmin': handleSetupSuperadmin,
  'superadmin': handleSuperadmin,
  'sync-teacher-assignments': handleSyncTeacherAssignments,
  'sync-wali-kelas': handleSyncWaliKelas,

  // Aliases & Rewrites (kompatibilitas Vercel / Midtrans)
  'teacher-subject': handleSyncTeacherAssignments,
  'payments': handleMidtrans,
  'midtrans-webhook': handleMidtrans,
  'midtrans/webhook': handleMidtrans,
  'billing/webhook': handleMidtrans,
};

function resolveRoute(pathname: string): ApiHandler | null {
  const clean = pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
  if (!clean) return null;

  if (ROUTES[clean]) {
    return ROUTES[clean];
  }

  // Cek nested subpath (misal: /api/midtrans/webhook)
  const segments = clean.split('/');
  if (segments.length > 1 && ROUTES[clean]) {
    return ROUTES[clean];
  }
  if (ROUTES[segments[0]]) {
    return ROUTES[segments[0]];
  }

  return null;
}

function resolveWorkerSupabaseUrl(env: Env): string {
  const candidates = [env.SUPABASE_URL, env.VITE_SUPABASE_URL];
  const sbCo = candidates.find((c) => c && typeof c === 'string' && c.includes('.supabase.co'));
  if (sbCo) return sbCo.trim();
  for (const c of candidates) {
    if (c && typeof c === 'string' && c.trim() && !c.includes('placeholder')) {
      return c.trim();
    }
  }
  return '';
}

function resolveWorkerSupabaseAnonKey(env: Env): string {
  const candidates = [
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
    env.VITE_SUPABASE_ANON_KEY,
    env.SUPABASE_ANON_KEY,
    env.SUPABASE_PUBLISHABLE_KEY,
  ];
  for (const c of candidates) {
    if (c && typeof c === 'string' && c.trim() && !c.includes('placeholder')) {
      return c.trim();
    }
  }
  return '';
}

/**
 * Adapter untuk mengubah Request/Response Cloudflare Worker
 * menjadi format Node/Vercel (req, res) yang diharapkan oleh /api/*.ts.
 */
async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  // 1. CORS Preflight (OPTIONS)
  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('origin') || '*';
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Superadmin-Secret, X-Superadmin-Key, X-Requested-With',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
      },
    });
  }

  // 2. Endpoint khusus konfigurasi publik runtime (/api/config)
  if (url.pathname === '/api/config' || url.pathname === '/api/public-config') {
    const supabaseUrl = resolveWorkerSupabaseUrl(env);
    const supabaseAnonKey = resolveWorkerSupabaseAnonKey(env);
    return new Response(
      JSON.stringify({
        ok: true,
        supabaseUrl,
        supabaseAnonKey,
        isConfigured: Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder')),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  // 3. Cari route handler yang cocok
  const handler = resolveRoute(url.pathname);
  if (!handler) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: `Endpoint API tidak ditemukan: ${url.pathname}`,
      }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  // 4. Sinkronisasikan Environment Variables Cloudflare Worker ke process.env
  setWorkerEnv(env);

  // 5. Parse query parameters
  const query: Record<string, string> = {};
  url.searchParams.forEach((val, key) => {
    query[key] = val;
  });

  // 6. Parse headers (simpan format lower-case dan original untuk kompatibilitas penuh)
  const headers: Record<string, string> = {};
  request.headers.forEach((val, key) => {
    headers[key.toLowerCase()] = val;
    headers[key] = val;
  });

  // 7. Parse request body
  let body: any = {};
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const contentType = request.headers.get('content-type') || '';
    try {
      if (contentType.includes('application/json')) {
        body = await request.json();
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const text = await request.text();
        const search = new URLSearchParams(text);
        const formObj: Record<string, string> = {};
        search.forEach((v, k) => {
          formObj[k] = v;
        });
        body = formObj;
      } else {
        const rawText = await request.text();
        if (rawText) {
          try {
            body = JSON.parse(rawText);
          } catch {
            body = rawText;
          }
        }
      }
    } catch {
      body = {};
    }
  }

  // 8. Siapkan objek `req` dengan menyertakan env langsung
  const req: any = {
    method: request.method,
    url: request.url,
    headers,
    query,
    body,
    env,
    rawRequest: request,
  };

  // 9. Siapkan objek `res` dan Promise resolusi
  let statusCode = 200;
  const resHeaders = new Headers();
  let resBody: BodyInit | null = null;
  let isEnded = false;

  let resolveResponse: (response: Response) => void;
  const responsePromise = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });

  const finishResponse = (payload?: any) => {
    if (isEnded) return;
    isEnded = true;

    if (payload !== undefined && payload !== null) {
      if (typeof payload === 'string' || payload instanceof Uint8Array || payload instanceof ArrayBuffer) {
        resBody = payload;
      } else {
        if (!resHeaders.has('content-type')) {
          resHeaders.set('content-type', 'application/json; charset=utf-8');
        }
        resBody = JSON.stringify(payload);
      }
    }

    // 204/205/304 response cannot have a body per fetch spec
    if (statusCode === 204 || statusCode === 205 || statusCode === 304) {
      resBody = null;
    }

    // Default CORS headers: prioritaskan origin spesifik dari request
    const reqOrigin = request.headers.get('origin');
    if (!resHeaders.has('access-control-allow-origin')) {
      if (reqOrigin) {
        resHeaders.set('access-control-allow-origin', reqOrigin);
        resHeaders.set('vary', 'Origin');
      } else {
        resHeaders.set('access-control-allow-origin', '*');
      }
    }

    resolveResponse(
      new Response(resBody, {
        status: statusCode,
        headers: resHeaders,
      })
    );
  };

  const res: any = {
    get statusCode() {
      return statusCode;
    },
    set statusCode(code: number) {
      statusCode = code;
    },
    status(code: number) {
      statusCode = code;
      return res;
    },
    setHeader(name: string, value: string) {
      resHeaders.set(name, value);
      return res;
    },
    getHeader(name: string) {
      return resHeaders.get(name);
    },
    removeHeader(name: string) {
      resHeaders.delete(name);
      return res;
    },
    json(data: any) {
      if (!resHeaders.has('content-type')) {
        resHeaders.set('content-type', 'application/json; charset=utf-8');
      }
      finishResponse(JSON.stringify(data));
      return res;
    },
    send(data: any) {
      finishResponse(data);
      return res;
    },
    end(data?: any) {
      finishResponse(data);
      return res;
    },
  };

  // 10. Jalankan handler dengan menyertakan env langsung
  try {
    const maybePromise = handler(req, res, env);
    let result: any = null;
    if (maybePromise && typeof maybePromise.then === 'function') {
      result = await maybePromise;
    } else {
      result = maybePromise;
    }
    if (result instanceof Response) {
      return result;
    }
    if (!isEnded) {
      finishResponse();
    }
    return await responsePromise;
  } catch (err: any) {
    console.error(`[Worker API Error ${url.pathname}]`, err);
    if (!isEnded) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: err?.message || 'Internal Server Error pada Cloudflare Worker API',
        }),
        {
          status: 500,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'access-control-allow-origin': '*',
          },
        }
      );
    }
    return await responsePromise;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 1. Rute API Backend (/api/*)
    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request, env);
    }

    // 2. Static Assets Frontend (./dist)
    if (env.ASSETS) {
      let assetResponse = await env.ASSETS.fetch(request);

      // SPA Fallback: Jika aset tidak ditemukan (404) dan bukan file berekstensi,
      // sajikan /index.html agar routing React SPA berfungsi normal
      const isFileRequest = /\.[a-zA-Z0-9]+$/.test(url.pathname);
      if (assetResponse.status === 404 && request.method === 'GET' && !isFileRequest) {
        const indexRequest = new Request(new URL('/index.html', request.url).toString(), request);
        assetResponse = await env.ASSETS.fetch(indexRequest);
      }

      // Injeksi otomatis runtime environment Supabase ke dalam HTML
      const contentType = assetResponse.headers.get('content-type') || '';
      if (
        (contentType.includes('text/html') || url.pathname === '/' || url.pathname.endsWith('.html')) &&
        assetResponse.ok
      ) {
        const supabaseUrl = resolveWorkerSupabaseUrl(env);
        const supabaseAnonKey = resolveWorkerSupabaseAnonKey(env);

        if (supabaseUrl && !supabaseUrl.includes('placeholder')) {
          try {
            const html = await assetResponse.text();
            const configScript = `<script id="__CLOUDFLARE_RUNTIME_CONFIG__">window.__CLOUDFLARE_ENV__=${JSON.stringify({
              VITE_SUPABASE_URL: supabaseUrl,
              VITE_SUPABASE_PUBLISHABLE_KEY: supabaseAnonKey,
              VITE_SUPABASE_ANON_KEY: supabaseAnonKey,
              VITE_APP_URL: env.VITE_APP_URL || '',
              MIDTRANS_CLIENT_KEY: env.MIDTRANS_CLIENT_KEY || env.VITE_MIDTRANS_CLIENT_KEY || '',
              VITE_MIDTRANS_CLIENT_KEY: env.VITE_MIDTRANS_CLIENT_KEY || env.MIDTRANS_CLIENT_KEY || '',
              MIDTRANS_IS_PRODUCTION: env.MIDTRANS_IS_PRODUCTION || env.VITE_MIDTRANS_IS_PRODUCTION || 'false',
              VITE_MIDTRANS_IS_PRODUCTION: env.VITE_MIDTRANS_IS_PRODUCTION || env.MIDTRANS_IS_PRODUCTION || 'false',
            })};</script>`;

            const modifiedHtml = html.includes('</head>')
              ? html.replace('</head>', `${configScript}</head>`)
              : configScript + html;

            const newHeaders = new Headers(assetResponse.headers);
            newHeaders.set('cache-control', 'no-cache, must-revalidate');

            return new Response(modifiedHtml, {
              status: assetResponse.status,
              headers: newHeaders,
            });
          } catch (_) {
            return assetResponse;
          }
        }
      }

      return assetResponse;
    }

    return new Response('Binding static assets (env.ASSETS) tidak ditemukan.', { status: 500 });
  },
};
