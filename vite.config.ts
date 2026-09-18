import { defineConfig, type Plugin } from 'vite';
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

export default defineConfig({
  plugins: [react(), excludeLocalFonts()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '::',
    port: 5173,
    proxy: { '/api': 'http://localhost:8765' },
  },
});
