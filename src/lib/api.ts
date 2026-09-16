import type { MediaAsset, Project } from './types';

/**
 * The backend's own origin in production, not a relative path.
 *
 * Relative paths would go through the /api rewrite in vercel.json, and that
 * proxy severs the connection at 50 MB: a 258 MB clip uploaded 50,003,686
 * bytes and then died with no response at all, which surfaces in the editor as
 * "The studio backend is unavailable". The same file posted straight to the
 * Space succeeds at 270 MB. Since this app accepts uploads up to 1 GB, the
 * proxy cannot be on the upload path.
 *
 * Routing through the rewrite was done for same-origin requests, to sidestep
 * CORS. That was not worth anything: a Hugging Face Space reflects whatever
 * Origin it is sent, from their proxy, after the application has replied — so
 * the allowlist is unenforceable there either way, and the rewrite bought a
 * 50 MB ceiling in exchange for nothing.
 *
 * VITE_API_BASE still overrides, for a backend hosted elsewhere.
 */
const defaultBase = import.meta.env.DEV ? '' : 'https://n3owise-bol-studio-backend.hf.space';
export const API = (import.meta.env.VITE_API_BASE || defaultBase).replace(/\/$/, '');

/**
 * Shared key for a deployed backend, set at build time with VITE_API_KEY.
 * Empty locally, where the server leaves its gate open.
 *
 * It ships inside this bundle, so treat it as a deterrent against drive-by
 * traffic rather than as authentication.
 */
export const API_KEY = (import.meta.env.VITE_API_KEY || '').trim();

/**
 * Which workspace this browser's projects belong to.
 *
 * Without it every visitor to a shared deployment sees every other visitor's
 * uploads, because projects were keyed by id alone. This is a random id kept in
 * localStorage, sent on every request, and stored on each project the browser
 * creates.
 *
 * It is separation, not authentication: it lives in the browser and rides in a
 * header, so anyone can change it to anything. It keeps a group of people out
 * of each other's work by default; it does not stop someone who looks.
 *
 * When real accounts arrive this is the seam. The server already reads the
 * value as an opaque owner string, so a signed-in session supplies its user id
 * here instead and nothing about the stored projects has to change.
 */
const OWNER_STORAGE_KEY = 'bol.workspace-id';

export const WORKSPACE_ID = (() => {
  try {
    const existing = localStorage.getItem(OWNER_STORAGE_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(OWNER_STORAGE_KEY, created);
    return created;
  } catch {
    // Private windows and blocked storage throw. A per-session id still keeps
    // this tab's work separate; it just will not survive a reload.
    return crypto.randomUUID();
  }
})();

/** Header form, for anything that goes through fetch or XHR. */
export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra, 'X-Bol-Owner': WORKSPACE_ID };
  if (API_KEY) headers['X-API-Key'] = API_KEY;
  return headers;
}

/**
 * Absolute URL for a file the browser loads by itself — <video src>, <img src>,
 * download links. Those cannot set headers, so both the key and the workspace
 * ride as query parameters instead.
 *
 * The workspace matters here as much as the key: media sits under
 * /api/projects/{id}, so without it the browser asks for its own project's
 * video as a stranger and is correctly refused.
 */
export function mediaUrl(path: string): string {
  const base = path.startsWith('http') ? path : `${API}${path}`;
  const query = new URLSearchParams();
  if (API_KEY) query.set('key', API_KEY);
  query.set('owner', WORKSPACE_ID);
  return `${base}${base.includes('?') ? '&' : '?'}${query}`;
}
export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}/api${path}`, {
    ...options,
    headers: authHeaders(options?.headers as Record<string, string> | undefined),
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { const error = await response.json(); message = typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail ?? error); } catch { /* Preserve status when the worker is offline. */ }
    throw new Error(message);
  }
  return response.json();
}
/**
 * Upload without starting recognition.
 *
 * The editor asks what language was spoken once the file has landed, so
 * transcription has to wait for that answer. Starting it on upload ran the
 * recogniser with whatever settings the previous clip left behind, and left the
 * project busy — which disabled the button meant to start it properly.
 */
export function upload(file: File, script: string, language: string, onProgress: (progress: number) => void): Promise<Project> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest(); const body = new FormData();
    body.append('file', file); body.append('script', script); body.append('language', language);
    body.append('autostart', 'false');
    xhr.open('POST', `${API}/api/projects`);
    xhr.setRequestHeader('X-Bol-Owner', WORKSPACE_ID);
    if (API_KEY) xhr.setRequestHeader('X-API-Key', API_KEY);
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)); };
    xhr.onerror = () => reject(new Error('The studio backend is unavailable. Please check your connection or try again.'));
    xhr.onload = () => {
      try { const data = JSON.parse(xhr.responseText); if (xhr.status >= 200 && xhr.status < 300) resolve(data); else reject(new Error(typeof data.detail === 'string' ? data.detail : 'This file could not be uploaded.')); }
      catch { reject(new Error('The upload could not be completed. Please try again.')); }
    };
    xhr.send(body);
  });
}

export function fetchMediaAssets(projectId: string): Promise<MediaAsset[]> {
  return request<MediaAsset[]>(`/projects/${projectId}/assets`);
}

export function uploadMediaAsset(
  projectId: string,
  file: File,
  onProgress: (pct: number, loaded: number, total: number) => void
): { promise: Promise<MediaAsset>; abort: () => void } {
  let xhrRef: XMLHttpRequest | null = null;
  const promise = new Promise<MediaAsset>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrRef = xhr;
    const body = new FormData();
    body.append('file', file);
    xhr.open('POST', `${API}/api/projects/${projectId}/assets`);
    xhr.setRequestHeader('X-Bol-Owner', WORKSPACE_ID);
    if (API_KEY) xhr.setRequestHeader('X-API-Key', API_KEY);
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100), e.loaded, e.total);
      }
    };
    xhr.onabort = () => reject(new Error('Upload canceled.'));
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(typeof data.detail === 'string' ? data.detail : 'Upload failed.'));
      } catch {
        reject(new Error('Upload processing failed.'));
      }
    };
    xhr.send(body);
  });
  return {
    promise,
    abort: () => {
      if (xhrRef) {
        xhrRef.abort();
      }
    },
  };
}

export function updateMediaAsset(
  projectId: string,
  assetId: string,
  patch: { name?: string; greenScreen?: any }
): Promise<any> {
  return request(`/projects/${projectId}/assets/${assetId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export function duplicateMediaAsset(projectId: string, assetId: string): Promise<MediaAsset> {
  return request<MediaAsset>(`/projects/${projectId}/assets/${assetId}/duplicate`, {
    method: 'POST',
  });
}

export function deleteMediaAsset(projectId: string, assetId: string): Promise<{ status: string }> {
  return request<{ status: string }>(`/projects/${projectId}/assets/${assetId}`, {
    method: 'DELETE',
  });
}
