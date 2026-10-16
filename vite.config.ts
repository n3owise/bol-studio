import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { handle as controlHandler } from './server/control/handler';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

/**
 * Keep faces licensed for this machine only out of a production build.
 *
 * public/ is copied into dist wholesale, so putting the files there — which is
 * what lets the dev server and the Remotion renderer both find them — also puts
 * them in anything built here and uploaded by hand. They are gitignored, so a
 * build from a clone never has them and this does nothing; the case it covers
 * is a build on the machine that does.
 *
 * Deleting after the fact rather than filtering: Vite offers no way to exclude
 * part of publicDir, and a wrong guess at an internal hook would fail silently,
 * which is the failure this exists to prevent.
 */
function excludeLocalFonts(): Plugin {
  return {
    name: 'bol-exclude-local-fonts',
    apply: 'build',
    closeBundle() {
      const shipped = path.resolve(__dirname, 'dist/fonts/satoshi');
      fs.rmSync(shipped, { recursive: true, force: true });
      const parent = path.resolve(__dirname, 'dist/fonts');
      if (fs.existsSync(parent) && fs.readdirSync(parent).length === 0) fs.rmdirSync(parent);
    },
  };
}

/** Run the same admin handler locally; processing remains on the Python worker. */
const controlPlane: Plugin = {
  name: 'bol-control-plane',
  configResolved(config) {
    const values = loadEnv(config.mode, config.root, 'BOL_');
    for (const [key, value] of Object.entries(values)) if (process.env[key] === undefined) process.env[key] = value;
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const route = req.url?.split('?')[0];
      if (route === '/api/admin/access' || route === '/api/admin/analytics') {
        void controlHandler(req, res, route.endsWith('/access'));
      } else next();
    });
  },
};

/**
 * Two pages: the public landing page at / (index.html) and the editor at
 * /studio (studio.html). Vercel rewrites do this in production; this is the
 * same mapping for the dev server, where /studio would otherwise get index.html.
 */
const studioRoutes: Plugin = {
  name: 'bol-studio-routes',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const route = req.url?.split('?')[0] ?? '';
      if (route === '/studio' || route.startsWith('/studio/') || route.startsWith('/admin/')) {
        req.url = '/studio.html' + (req.url!.includes('?') ? req.url!.slice(req.url!.indexOf('?')) : '');
      }
      next();
    });
  },
};

export default defineConfig({
  plugins: [controlPlane, studioRoutes, react(), excludeLocalFonts(), ...(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT ? [sentryVitePlugin({
    authToken: process.env.SENTRY_AUTH_TOKEN, org: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT,
    release: { name: process.env.VITE_APP_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA },
    sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] }, telemetry: false,
  })] : [])],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    sourcemap: Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT),
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        studio: path.resolve(__dirname, 'studio.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (/posthog|rrweb/.test(id)) return 'vendor-posthog';
            if (id.includes('@sentry')) return 'vendor-sentry';
            if (id.includes('@remotion') || id.includes('remotion')) {
              return 'vendor-remotion';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            // React on its own, so the landing page does not download the
            // editor's other dependencies along with it.
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    host: '::',
    port: 5173,
    proxy: { '/api': process.env.BOL_DEV_API_TARGET || 'http://localhost:8765' },
  },
});
