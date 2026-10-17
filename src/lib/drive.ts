import { uploadResumable } from './drive-upload';
import { authHeaders, API, registerTemporaryProject, request, setLocalMedia } from './api';
import type { Project } from './types';
export type DriveStatus = { configured: boolean; connected: boolean };
export type SavedProject = { id: string; name: string; revision: number; updated_at: string };
export const driveStatus = () => request<DriveStatus>('/cloud/status');
export const savedProjects = () => request<SavedProject[]>('/cloud/projects');
const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export async function connectDrive() {
  const { url } = await request<{ url: string }>('/cloud/connect', { method: 'POST' });
  window.location.assign(url);
}
export async function saveDriveProject(p: Project) {
  if (!p.cloudId || p.cloudAudioOnly) return;
  const saved = await request<{ revision: number }>(`/cloud/projects/${p.cloudId}/save`, json({ workerId: p.id, revision: p.cloudRevision ?? 0 }));
  p.cloudRevision = saved.revision;
}
export async function openDriveProject(id: string): Promise<Project> {
  const p = await request<Project>(`/cloud/projects/${id}/open`, json({}));
  registerTemporaryProject(p.id);
  return p;
}
export async function exportToDrive(p: Project, exportId: string) {
  return request<{ url: string }>(`/cloud/projects/${p.cloudId}/exports`, json({ workerId: p.id, exportId }));
}

// Conservative best-effort extraction: never decode large mobile videos into RAM.
// Unsupported codecs, long clips, decode failures and timeouts use HF extraction.
export async function extractAudio(file: File): Promise<Blob | null> {
  if (file.size > 12 * 1024 * 1024 || !window.AudioContext) return null;
  let context: AudioContext | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    context = new AudioContext({ sampleRate: 16000 });
    const decoded = await Promise.race([
      context.decodeAudioData(await file.arrayBuffer()),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Decode timed out')), 12000); }),
    ]);
    if (decoded.duration > 180) return null;
    const renderer = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
    const source = renderer.createBufferSource(); source.buffer = decoded; source.connect(renderer.destination); source.start();
    const mono = (await renderer.startRendering()).getChannelData(0);
    const bytes = new ArrayBuffer(44 + mono.length * 2); const view = new DataView(bytes);
    const text = (offset: number, value: string) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
    text(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    text(36, 'data'); view.setUint32(40, mono.length * 2, true);
    mono.forEach((n, i) => view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, n)) * 32767), true));
    return new Blob([bytes], { type: 'audio/wav' });
  } catch { return null; }
  finally { clearTimeout(timer); if (context) void context.close().catch(() => {}); }
}

const pendingDrive = new Map<string, Promise<Project>>();
export async function waitForDrive(p: Project): Promise<void> {
  const pending = pendingDrive.get(p.id);
  if (pending) await pending;
  else if (p.cloudAudioOnly) throw new Error('The original video has not finished saving. Retry the Drive save before exporting.');
}
const retries = new Map<string, () => Promise<Project>>();
export async function retryDriveSave(p: Project) {
  const existing = pendingDrive.get(p.id);
  if (existing) return void await existing;
  const retry = retries.get(p.id);
  if (!retry) return waitForDrive(p);
  const pending = retry(); pendingDrive.set(p.id, pending);
  await pending;
}
async function videoGeometry(file: File): Promise<{ width: number; height: number }> {
  if (!file.type.startsWith('video/')) return { width: 720, height: 1280 };
  const video = document.createElement('video'); const url = URL.createObjectURL(file);
  video.preload = 'metadata'; video.src = url;
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Video metadata unavailable')), 5000);
      video.onloadedmetadata = () => { clearTimeout(timer); resolve({ width: video.videoWidth, height: video.videoHeight }); };
      video.onerror = () => { clearTimeout(timer); reject(new Error('Video metadata unavailable')); };
    });
  } finally { video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); }
}
export async function uploadDrive(file: File, script: string, language: string,
  progress: (n: number) => void, status: (message: string) => void,
  settled: (project: Project | null, error?: Error) => void): Promise<Project> {
  const mime = file.type || (/\.(mp3|wav|m4a|ogg|flac)$/i.test(file.name) ? 'audio/octet-stream' : 'video/octet-stream');
  const session = await request<{ id: string; uploadUrl: string }>('/cloud/uploads', json({ name: file.name, mime, size: file.size }));
  status('Saving original video to Drive…');
  let early = false;
  // Handle upload rejection immediately, even while decoding audio in parallel.
  const videoUpload = uploadResumable(session.uploadUrl, file, n => {
    if (!early) progress(n); else status(`Saving original to Drive… ${n}%`);
  }).then(() => null, error => error as Error);
  let audioProject: Project | null = null;
  try {
    const blob = await extractAudio(file);
    if (blob) {
      const geometry = await videoGeometry(file);
      const params = new URLSearchParams({ kind: mime.startsWith('video/') ? 'video' : 'audio',
        width: String(geometry.width), height: String(geometry.height) });
      const r = await fetch(`${API}/api/cloud/projects/${session.id}/audio?${params}`, {
        method: 'PUT', headers: authHeaders({ 'Content-Type': 'audio/wav' }), body: blob,
      });
      if (r.ok) audioProject = await r.json() as Project;
    }
  } catch { /* Secure original retrieval is the fallback on every extraction failure. */ }
  if (audioProject) {
    early = true;
    const p = audioProject;
    registerTemporaryProject(p.id); setLocalMedia(p.id, file);
    let originalUploaded = false;
    const finish = async (first: boolean) => {
      try {
        const failed = first ? await videoUpload : originalUploaded ? null : (await uploadResumable(session.uploadUrl, file, n => status(`Saving original to Drive… ${n}%`)), null);
        if (failed) throw failed;
        originalUploaded = true;
        status('Original saved. Preparing the export source…');
        const complete = await request<Project>(`/cloud/projects/${session.id}/commit`, json({ workerId: p.id, revision: 0 }));
        retries.delete(p.id); pendingDrive.delete(p.id);
        status(''); settled(complete);
        return complete;
      } catch (error) {
        pendingDrive.delete(p.id);
        status('Drive save interrupted. Keep this tab open and retry before exporting.');
        settled(null, error as Error); throw error;
      }
    };
    retries.set(p.id, () => finish(false));
    const pending = finish(true); pendingDrive.set(p.id, pending);
    void pending.catch(() => {});
    return p;
  }
  const failed = await videoUpload;
  if (failed) throw failed;
  status('Original saved. Preparing your private editing session…');
  const p = await request<Project>(`/cloud/projects/${session.id}/open`, json({ script, language }));
  registerTemporaryProject(p.id); setLocalMedia(p.id, file);
  return p;
}
