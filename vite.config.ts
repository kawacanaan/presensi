import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, loadEnv, Plugin} from 'vite';

function getEffectiveSupabaseUrl(env: Record<string, string>): string {
  const candidates = [
    process.env.SUPABASE_URL,
    env.SUPABASE_URL,
    process.env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_URL,
  ];
  // 1. Prioritaskan URL asli yang mengarah ke .supabase.co
  const sbCo = candidates.find((c) => c && typeof c === 'string' && c.includes('.supabase.co'));
  if (sbCo) return sbCo.trim();

  // 2. Fallback kandidat non-placeholder
  for (const c of candidates) {
    if (c && typeof c === 'string' && c.trim() && !c.includes('placeholder')) {
      return c.trim();
    }
  }
  return '';
}

function getEffectiveSupabaseAnonKey(env: Record<string, string>): string {
  const candidates = [
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    process.env.VITE_SUPABASE_ANON_KEY,
    process.env.SUPABASE_ANON_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
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

function vercelApiDevPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'vercel-api-dev-middleware',
    configureServer(server) {
      for (const [k, v] of Object.entries(env)) {
        if (process.env[k] === undefined) {
          process.env[k] = v;
        }
      }

      const effectiveUrl = getEffectiveSupabaseUrl(env);
      if (effectiveUrl) {
        process.env.SUPABASE_URL = effectiveUrl;
        process.env.VITE_SUPABASE_URL = effectiveUrl;
      }

      server.middlewares.use(async (req: any, res: any, next: any) => {
        const rawUrl = req.url || '';
        if (!rawUrl.startsWith('/api/')) {
          return next();
        }

        const parsedUrl = new URL(rawUrl, 'http://localhost:3000');
        let routeName = parsedUrl.pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
        if (!routeName || routeName.includes('..')) {
          return next();
        }

        const rewrites: Record<string, string> = {
          'teacher-subject': 'sync-teacher-assignments',
          'payments': 'midtrans',
          'midtrans-webhook': 'midtrans',
          'midtrans/webhook': 'midtrans',
          'billing/webhook': 'midtrans',
        };
        if (rewrites[routeName]) {
          routeName = rewrites[routeName];
        }

        if (routeName === 'config' || routeName === 'public-config') {
          const supabaseUrl = getEffectiveSupabaseUrl(env);
          const supabaseAnonKey = getEffectiveSupabaseAnonKey(env);
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              ok: true,
              supabaseUrl,
              supabaseAnonKey,
              isConfigured: Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder')),
            })
          );
          return;
        }

        const apiFilePath = path.resolve(__dirname, 'api', `${routeName}.ts`);
        if (!fs.existsSync(apiFilePath)) {
          return next();
        }

        try {
          const query: Record<string, string> = {};
          parsedUrl.searchParams.forEach((value, key) => {
            query[key] = value;
          });
          req.query = query;

          if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            if (req.body === undefined) {
              const chunks: Buffer[] = [];
              for await (const chunk of req) {
                chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
              }
              const rawBody = Buffer.concat(chunks).toString('utf8');
              if (rawBody) {
                try {
                  req.body = JSON.parse(rawBody);
                } catch {
                  req.body = rawBody;
                }
              } else {
                req.body = {};
              }
            }
          }

          if (typeof res.status !== 'function') {
            res.status = (code: number) => {
              res.statusCode = code;
              return res;
            };
          }
          if (typeof res.json !== 'function') {
            res.json = (data: unknown) => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
              return res;
            };
          }

          const mod = await server.ssrLoadModule(`/api/${routeName}.ts`);
          if (typeof mod?.default === 'function') {
            await mod.default(req, res);
            return;
          }
          return next();
        } catch (err: any) {
          console.error(`[api/${routeName}] error:`, err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err?.message || 'Internal Server Error' }));
          }
        }
      });
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');

  const supabaseUrl = getEffectiveSupabaseUrl(env);
  const supabaseAnonKey = getEffectiveSupabaseAnonKey(env);

  return {
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(supabaseAnonKey),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
    },
    plugins: [react(), tailwindcss(), vercelApiDevPlugin(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});