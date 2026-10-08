import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, loadEnv, Plugin} from 'vite';

function vercelApiDevPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'vercel-api-dev-middleware',
    configureServer(server) {
      for (const [k, v] of Object.entries(env)) {
        if (process.env[k] === undefined) {
          process.env[k] = v;
        }
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
  return {
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
