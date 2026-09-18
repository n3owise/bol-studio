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
 * This is now the signed-out path only. With accounts configured the server
 * ignores the header entirely and takes the owner from the verified token, so a
 * client cannot use it to claim a workspace.
 */
const OWNER_STORAGE_KEY = 'bol.workspace-id';

const localWorkspaceId = (() => {
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
  const headers: Record<string, string> = { ...extra, 'X-Bol-Owner': getOwner() };
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
 * project's media for fifteen minutes and nothing else.
 *
 * Signed out, the workspace id rides here as before — without it the browser
 * asks for its own project's video as a stranger and is correctly refused.
 */
export function mediaUrl(path: string): string {
  const base = path.startsWith('http') ? path : `${API}${path}`;
  const query = new URLSearchParams();
  if (API_KEY) query.set('key', API_KEY);
  if (AUTH_ENABLED) {
    // No token yet means no authorised URL yet. Returning one anyway sends a
    // request that is certain to be refused, and a <video> that has been handed
    // a 401 stays broken until its source changes — so pressing play in the
    // moment before the token lands reports that the media cannot be played,
    // which is both alarming and untrue. An empty string instead: callers hand
    // the element nothing until there is something worth loading.
    const token = mediaTokens.get(projectIdIn(base))?.token;
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
 * The token is part of the URL, so replacing one reloads the player and rejects
 * any pending play(). The server's two-hour lifetime and this margin are chosen
 * together so that an ordinary session never reaches the point of needing a new
 * one.
 */
const REMINT_WITHIN_MS = 15 * 60 * 1000;
const mediaTokens = new Map<string, { token: string; expiresAt: number }>();
const mintingNow = new Map<string, Promise<string>>();

export async function ensureMediaToken(projectId: string): Promise<string> {
  if (!AUTH_ENABLED) return '';
  const held = mediaTokens.get(projectId);
  if (held && held.expiresAt - Date.now() > REMINT_WITHIN_MS) return held.token;
  const already = mintingNow.get(projectId);
  if (already) return already;
  const minting = request<{ token: string; expiresIn: number }>(
    `/projects/${projectId}/media-token`, { method: 'POST' },
  ).then(result => {
    mediaTokens.set(projectId, {
      token: result.token,
      expiresAt: Date.now() + result.expiresIn * 1000,
    });
    return result.token;
  }).finally(() => { mintingNow.delete(projectId); });
  mintingNow.set(projectId, minting);
  return minting;
}

/** Drop every media token, so signing out cannot leave one usable. */
export function forgetMediaTokens(): void {
  mediaTokens.clear();
  mintingNow.clear();
}
export async function request<T>(path: string, options?: RequestInit, retried = false): Promise<T> {
  const response = await fetch(`${API}/api${path}`, {
    ...options,
    headers: authHeaders(options?.headers as Record<string, string> | undefined),
  });
  // A session that ended has to be told apart from a request that failed. An
  // expired token means the account is fine and the token is stale, so refresh
  // and try once — exactly once, because the editor polls every seven seconds
  // and a loop here would be expensive before anybody noticed. Anything else
  // means the session is not coming back, so sign out and let the gate appear.
  if (response.status === 401 && AUTH_ENABLED && supabase) {
    const body = await response.clone().json().catch(() => ({} as { code?: string }));
    if (body.code === 'token_expired' && !retried) {
      const { data } = await supabase.auth.refreshSession();
      if (data.session) return request<T>(path, options, true);
    }
    await supabase.auth.signOut();
    throw new Error('Please sign in to continue.');
  }
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
    for (const [name, value] of Object.entries(authHeaders())) xhr.setRequestHeader(name, value);
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
