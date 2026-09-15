import type { MediaAsset, Project } from './types';

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

/** Header form, for anything that goes through fetch or XHR. */
export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return API_KEY ? { ...extra, 'X-API-Key': API_KEY } : { ...extra };
}

/**
 * Absolute URL for a file the browser loads by itself — <video src>, <img src>,
 * download links. Those cannot set headers, so the key rides as a query
 * parameter instead.
 */
export function mediaUrl(path: string): string {
  const base = path.startsWith('http') ? path : `${API}${path}`;
  if (!API_KEY) return base;
  return `${base}${base.includes('?') ? '&' : '?'}key=${encodeURIComponent(API_KEY)}`;
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
export function upload(file: File, script: string, language: string, onProgress: (progress: number) => void): Promise<Project> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest(); const body = new FormData();
    body.append('file', file); body.append('script', script); body.append('language', language);
    xhr.open('POST', `${API}/api/projects`);
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
