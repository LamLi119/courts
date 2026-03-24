import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

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
