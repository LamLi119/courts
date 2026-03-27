import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { buildVenueOgMeta, injectVenueOgIntoHtml } from './lib/venueOgMeta.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      // Proxy /api to court server so login works without env in dev
      proxy: {
        '/api': {
          target: (env.VITE_THE_GRIND_API_URL || env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, ''),
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vue: ['vue'],
          },
        },
      },
    },
    plugins: [
      vue(),
      tailwindcss(),
      {
        name: 'spa-fallback-admin',
        configureServer(server) {
          const apiBase = (
            env.VITE_THE_GRIND_API_URL ||
            env.VITE_API_URL ||
            'http://localhost:3001'
          ).replace(/\/$/, '');

          server.middlewares.use(async (req, res, next) => {
            if (req.method !== 'GET' || !req.url) return next();
            const pathname = decodeURIComponent(req.url.split('?')[0]);
            if (!pathname.startsWith('/venues/')) return next();
            const slug = pathname.slice('/venues/'.length).replace(/\/$/, '').split('/')[0];
            if (!slug) return next();

            const indexPath = path.resolve(server.config.root, 'index.html');
            const sendHtml = (html: string) => {
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(html);
            };

            try {
              const r = await fetch(
                `${apiBase}/api/venues/slug/${encodeURIComponent(slug)}`
              );
              if (!r.ok) {
                return fs.readFile(indexPath, 'utf-8', (err, html) => {
                  if (err) return next(err);
                  sendHtml(html);
                });
              }
              const venue = await r.json();
              const host = (req.headers.host || `localhost:${server.config.server?.port ?? 3000}`).toString();
              const origin = `http://${host}`;
              const pageUrl = new URL(pathname, `${origin}/`).href;
              const meta = buildVenueOgMeta(venue, {
                pageUrl,
                origin,
                lang: 'en',
              });
              fs.readFile(indexPath, 'utf-8', (err, html) => {
                if (err) return next(err);
                sendHtml(injectVenueOgIntoHtml(html, meta));
              });
            } catch {
              return fs.readFile(indexPath, 'utf-8', (err, html) => {
                if (err) return next(err);
                sendHtml(html);
              });
            }
          });

          server.middlewares.use((req, res, next) => {
            if (req.method !== 'GET' || !req.url) return next();
            const pathname = req.url.split('?')[0];
            if (pathname !== '/admin' && !pathname.startsWith('/admin/')) return next();
            const indexPath = path.resolve(server.config.root, 'index.html');
            fs.readFile(indexPath, 'utf-8', (err, html) => {
              if (err) return next(err);
              res.setHeader('Content-Type', 'text/html');
              res.end(html);
            });
          });
        },
      },
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GOOGLE_API_KEY': JSON.stringify(env.GOOGLE_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
