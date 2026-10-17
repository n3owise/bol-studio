import { MediaCredentials, unsignedMediaPath } from './media-credentials';
import { fetchProtectedResource } from './protected-fetch';
export { ApiError } from './protected-fetch';
import type { MediaAsset, Project } from './types';
import { AUTH_ENABLED, currentAccessToken, currentUserId, supabase } from './auth';

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

/** Temporary editor identity. Nothing is written to browser project storage.
 * A new page creates a fresh workspace; authentication remains independent.
 * Persistent project discovery can be reintroduced behind this boundary later.
 */
const localWorkspaceId = crypto.randomUUID();

// This registry exists only in the current page. Never restore an old upload.
const temporaryProjects = new Set<string>();
export function registerTemporaryProject(id: string) { temporaryProjects.add(id); }
const localMedia = new Map<string, string>();
export function discardLocalMedia(id: string): boolean {
  const url = localMedia.get(id);
  if (!url) return false;
  URL.revokeObjectURL(url); localMedia.delete(id); return true;
}
export function setLocalMedia(id: string, file?: File) {
  for (const url of localMedia.values()) URL.revokeObjectURL(url);
  localMedia.clear();
  if (file) localMedia.set(id, URL.createObjectURL(file));
}
function renewTemporaryProjects(closing = false) {
  for (const id of temporaryProjects) {
    // Same-origin keepalive avoids starting a cross-origin preflight while the
    // document is being destroyed. Only this tiny close notification uses the
    // Vercel proxy; large uploads and ordinary worker calls stay direct.
    const leaseBase = closing && import.meta.env.PROD && API === 'https://n3owise-bol-studio-backend.hf.space' ? '' : API;
    void fetch(`${leaseBase}/api/projects/${id}/temporary-session${closing ? '?closing=true' : ''}`, {
      method: 'POST', headers: authHeaders(), keepalive: closing,
    }).catch(() => { /* The server lease also expires after an abrupt close. */ });
  }
}
if (typeof window !== 'undefined') {
  window.setInterval(() => renewTemporaryProjects(), 60_000);
  window.addEventListener('pagehide', () => renewTemporaryProjects(true));
  window.addEventListener('pageshow', () => renewTemporaryProjects());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') renewTemporaryProjects();
  });
}

/**
 * Who the app is acting as. A function rather than the constant this used to be:
 * a const is evaluated once at import, so it could never become the person who
 * signed in a moment later.
 */
export function getOwner(): string {
  return currentUserId() || localWorkspaceId;
}

/** Header form, for anything that goes through fetch or XHR. */
export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra, 'X-Bol-Owner': getOwner(), 'X-Bol-Temporary-Session': localWorkspaceId };
  if (API_KEY) headers['X-API-Key'] = API_KEY;
  const token = currentAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/**
 * Absolute URL for a file the browser loads by itself — <video src>, <img src>,
 * download links. Those cannot set headers, so the credentials ride as query
 * parameters instead.
 *
 * Signed in, that credential is a media token and not the access token: an
 * access token is good for an hour and for everything, and a query string ends
 * up in proxy logs, browser history and Referer headers. A media token opens one
 * project's media for two hours and nothing else.
 *
 * Signed out, the workspace id rides here as before — without it the browser
 * asks for its own project's video as a stranger and is correctly refused.
 */
export function mediaUrl(path: string): string {
  const route = unsignedMediaPath(path);
  if (!route) return '';
  const local = localMedia.get(projectIdIn(route));
  if (local && /\/media$/.test(route)) return local;
  const base = `${API}${route}`;
  const query = new URLSearchParams();
  if (API_KEY) query.set('key', API_KEY);
  if (AUTH_ENABLED) {
    // No token yet means no authorised URL yet. Returning one anyway sends a
    // request that is certain to be refused, and a <video> that has been handed
    // a 401 stays broken until its source changes — so pressing play in the
    // moment before the token lands reports that the media cannot be played,
    // which is both alarming and untrue. An empty string instead: callers hand
    // the element nothing until there is something worth loading.
    const token = mediaCredentials.token(projectIdIn(base));
    if (!token) return '';
    query.set('t', token);
  } else {
    query.set('owner', getOwner());
  }
  return `${base}${base.includes('?') ? '&' : '?'}${query}`;
}

const PROJECT_IN_PATH = /\/api\/projects\/([0-9a-fA-F-]{36})\//;

function projectIdIn(url: string): string {
  return PROJECT_IN_PATH.exec(url)?.[1] ?? '';
}

/**
 * Media tokens, minted per project and reused until they are nearly out.
 *
 * Re-minted with time to spare rather than on expiry: a <video> element that
 * asks for a byte range mid-playback with a token that died a second ago stalls
 * with nothing to say. Concurrent callers share one request, because the editor
 * asks for the video, the thumbnail and the waveform at once.
 *
 * Replacing a token changes media URLs. The editor updates cached overlay
 * sources and restores the primary player's position and playback state.
 */
const mediaCredentials = new MediaCredentials(id => request<{ token: string; expiresIn: number }>(
  `/projects/${id}/media-token`, { method: 'POST' },
));
export async function ensureMediaToken(projectId: string): Promise<string> {
  return AUTH_ENABLED ? mediaCredentials.ensure(projectId) : '';
}
/** Sign-out also invalidates mint requests that have not finished. */
export function forgetMediaTokens(): void { mediaCredentials.clear(); setLocalMedia(''); }
/** Share authentication and one-shot session refresh between JSON and file requests. */
async function apiResponse(path: string, options?: RequestInit): Promise<Response> {
  return fetchProtectedResource(`${path.startsWith('/admin/') ? '' : API}/api${path}`, options, {
    headers: extra => authHeaders(extra),
    authEnabled: AUTH_ENABLED && !!supabase,
    refresh: async () => {
      const { data } = await supabase!.auth.refreshSession();
      return !!data.session;
    },
    signOut: async () => { await supabase!.auth.signOut(); },
  });
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await apiResponse(path, options);
  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function downloadAudioBlob(projectId: string): Promise<Blob> {
  const response = await apiResponse(`/projects/${projectId}/audio`);
  return response.blob();
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
    for (const [name, value] of Object.entries(authHeaders())) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)); };
    xhr.onerror = () => reject(new Error('The studio backend is unavailable. Please check your connection or try again.'));
    xhr.onload = () => {
      try { const data = JSON.parse(xhr.responseText); if (xhr.status >= 200 && xhr.status < 300) { temporaryProjects.add(data.id); resolve(data); } else reject(new Error(typeof data.detail === 'string' ? data.detail : 'This file could not be uploaded.')); }
      catch { reject(new Error('The upload could not be completed. Please try again.')); }
    };
    xhr.send(body);
  });
}

/**
 * What this deployment will accept, and what the caller's work already costs.
 *
 * The editor read `maxExportSeconds` out of this and dropped the rest on the
 * floor, so the upload size and clip length ceilings were only ever discovered
 * by hitting them, and the disk figures — which nothing else on the machine can
 * see — were fetched and thrown away. The Settings panel shows all of it.
 */
export type Limits = {
  maxExportSeconds: number | null;
  maxUploadBytes: number;
  maxDurationSeconds: number;
  diskTotalBytes: number;
  diskFreeBytes: number;
  /** Projects belonging to this account or workspace, not to the machine. */
  projectCount: number;
  diskUsedByProjectsBytes: number;
};

export function fetchLimits(): Promise<Limits> {
  return request<Limits>('/limits');
}

/**
 * Delete a project and everything on disk beneath it. There is no undo, here or
 * on the server.
 *
 * Resolves on 204 and nothing else. It is deliberately not typed as returning a
 * body: the endpoint sends none, and a caller that believed it did would be
 * reading `undefined.status` on every success.
 *
 * Rejects with the server's own sentence on 404 and on 409 — the worker refuses
 * while it is still inside the project, and that refusal says which job to wait
 * for, which is the whole of what the person needs. Swallowing it here would
 * leave the panel with nothing to show but a generic failure.
 */
export function deleteProject(projectId: string): Promise<void> {
  return request<void>(`/projects/${projectId}`, { method: 'DELETE' });
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
    for (const [name, value] of Object.entries(authHeaders())) xhr.setRequestHeader(name, value);
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
