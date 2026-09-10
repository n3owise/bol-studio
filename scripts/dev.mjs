import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
if (!existsSync('.venv/bin/python')) {
  console.error('Set up the Python environment first. See README.md.'); process.exit(1);
}
const children = [
  spawn('.venv/bin/python', ['-m', 'uvicorn', 'server.app:app', '--host', '::', '--port', '8765'], { stdio: 'inherit' }),
  spawn('npm', ['run', 'dev:web'], { stdio: 'inherit' }),
];
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; children.forEach(c => c.kill('SIGTERM')); process.exitCode = code; }
children.forEach(c => c.on('exit', code => stop(code ?? 1)));
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
