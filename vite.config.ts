import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { buildVenueOgMeta, injectPageSeoIntoHtml } from './lib/venueOgMeta.js';
import { injectLastModified } from './lib/injectLastModified.js';
import {
  buildExplorePageMeta,
  buildHomePageMeta,
  buildSearchPageMeta,
  buildDistrictSportPageMeta,
} from './lib/pageSeoMeta.js';

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
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['green-G.svg', 'placeholder.svg', 'venues-bootstrap.json'],
        manifest: {
          name: 'Courts | Find Sports Courts in Hong Kong',
          short_name: 'Courts',
          description:
            'Find and book Hong Kong sports courts near MTR stations. Compare venues, fees, and walking distance.',
          theme_color: '#007a67',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait-primary',
          scope: '/',
          start_url: '/',
          lang: 'en',
          icons: [
            {
              src: '/green-G.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp}'],
          navigateFallback: '/index.html',
          // Never serve index.html for API routes, hashed assets, or static file URLs.
          navigateFallbackDenylist: [/^\/api/, /^\/assets\//, /\/[^/?]+\.[^/]+$/],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-stylesheets',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
          ],
        },
      }),
      {
        name: 'spa-fallback-admin',
        configureServer(server) {
          const apiBase = (
            env.VITE_THE_GRIND_API_URL ||
            env.VITE_API_URL ||
            'http://localhost:3001'
          ).replace(/\/$/, '');

          const readBootstrap = () => {
            try {
              const bootstrapPath = path.resolve(server.config.root, 'public/venues-bootstrap.json');
              if (!fs.existsSync(bootstrapPath)) return { venues: [], sports: [] };
              const data = JSON.parse(fs.readFileSync(bootstrapPath, 'utf-8'));
              return {
                venues: Array.isArray(data.venues) ? data.venues : [],
                sports: Array.isArray(data.sports) ? data.sports : [],
              };
            } catch {
              return { venues: [], sports: [] };
            }
          };

          server.middlewares.use(async (req, res, next) => {
            if (req.method !== 'GET' || !req.url) return next();
            const pathname = decodeURIComponent(req.url.split('?')[0]);
            const indexPath = path.resolve(server.config.root, 'index.html');
            const host = (req.headers.host || `localhost:${server.config.server?.port ?? 3000}`).toString();
            const origin = `http://${host}`;
            const sendHtml = (html: string) => {
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(html);
            };

            const injectAndSend = async (meta: Parameters<typeof injectPageSeoIntoHtml>[1]) => {
              try {
                let html = fs.readFileSync(indexPath, 'utf-8');
                html = await server.transformIndexHtml(pathname || '/', html);
                sendHtml(injectLastModified(injectPageSeoIntoHtml(html, meta)));
              } catch (err) {
                next(err);
              }
            };

            if (pathname === '/' || pathname === '') {
              const { venues, sports } = readBootstrap();
              return void injectAndSend(buildHomePageMeta({ venues, sports, origin, lang: 'en' }));
            }

            if (pathname === '/explore') {
              const { venues } = readBootstrap();
              return void injectAndSend(buildExplorePageMeta({ venues, origin, lang: 'en' }));
            }

            if (pathname.startsWith('/search/')) {
              const parts = pathname.slice('/search/'.length).replace(/\/$/, '').split('/').filter(Boolean);
              const sportSlug = parts[0];
              const districtSlug = parts[1];
              if (sportSlug && districtSlug) {
                const { venues, sports } = readBootstrap();
                return void injectAndSend(
                  buildDistrictSportPageMeta({
                    sportSlug,
                    districtSlug,
                    venues,
                    sports,
                    origin,
                    lang: 'en',
                  })
                );
              }
              if (sportSlug) {
                const { venues, sports } = readBootstrap();
                return void injectAndSend(
                  buildSearchPageMeta({ sportSlug, venues, sports, origin, lang: 'en' })
                );
              }
            }

            if (!pathname.startsWith('/venues/')) return next();
            const slug = pathname.slice('/venues/'.length).replace(/\/$/, '').split('/')[0];
            if (!slug) return next();

            try {
              const r = await fetch(
                `${apiBase}/api/venues/slug/${encodeURIComponent(slug)}`
              );
              if (!r.ok) {
                let html = fs.readFileSync(indexPath, 'utf-8');
                html = await server.transformIndexHtml(pathname, html);
                return sendHtml(injectLastModified(html));
              }
              const venue = await r.json();
              const pageUrl = new URL(pathname, `${origin}/`).href;
              const meta = buildVenueOgMeta(venue, {
                pageUrl,
                origin,
                lang: 'en',
              });
              return void injectAndSend(meta);
            } catch {
              try {
                let html = fs.readFileSync(indexPath, 'utf-8');
                html = await server.transformIndexHtml(pathname, html);
                sendHtml(injectLastModified(html));
              } catch (err) {
                next(err);
              }
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
              res.end(injectLastModified(html));
            });
          });
        },
      },
      {
        name: 'inject-last-modified',
        enforce: 'post',
        transformIndexHtml(html) {
          return injectLastModified(html);
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
