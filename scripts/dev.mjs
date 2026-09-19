import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
if (!existsSync('.venv/bin/python')) {
  console.error('Set up the Python environment first. See README.md.'); process.exit(1);
}

/**
 * Hand .env to the backend too.
 *
 * Vite reads it for VITE_ variables; the Python process inherits the shell and
 * would see none of it. That splits the two halves apart in a way that is
 * genuinely hard to read from the outside: the editor would ask people to sign
 * in while the backend verified nothing, accepting whatever owner the browser
 * claimed, and every request would still succeed.
 */
function dotenv() {
  if (!existsSync('.env')) return {};
  const values = {};
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (match) values[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  return values;
}

// The real environment wins, so `BOL_SUPABASE_URL= npm run dev` still turns
// accounts off for one run without editing the file.
const env = { ...process.env, ...dotenv(), ...process.env };
const children = [
  // --reload, scoped to server/. Without it the web half hot-reloads and the
  // Python half does not, so an endpoint added mid-session is simply not there
  // and the symptom lands in the browser: the delete button returned 405
  // "Method Not Allowed" against a backend that had been up since before the
  // route existed, which reads as a frontend bug and is not one.
  //
  // Scoped rather than watching everything because the repo root holds
  // node_modules and data/, and the recogniser model inside data/ is over a
  // gigabyte — handing that to the reloader's watcher is how the dev server
  // starts pinning a core.
  spawn('.venv/bin/python', ['-m', 'uvicorn', 'server.app:app', '--host', '::', '--port', '8765',
                             '--reload', '--reload-dir', 'server'], { stdio: 'inherit', env }),
  spawn('npm', ['run', 'dev:web'], { stdio: 'inherit' }),
];
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; children.forEach(c => c.kill('SIGTERM')); process.exitCode = code; }
children.forEach(c => c.on('exit', code => stop(code ?? 1)));
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
