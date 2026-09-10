import type { Project } from './types';

const defaultBase = import.meta.env.DEV ? '' : 'https://n3owise-bol-studio-backend.hf.space';
export const API = (import.meta.env.VITE_API_BASE || defaultBase).replace(/\/$/, '');
export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}/api${path}`, options);
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
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)); };
    xhr.onerror = () => reject(new Error('The local studio is unavailable. Start the app and try again.'));
    xhr.onload = () => {
      try { const data = JSON.parse(xhr.responseText); if (xhr.status >= 200 && xhr.status < 300) resolve(data); else reject(new Error(typeof data.detail === 'string' ? data.detail : 'This file could not be uploaded.')); }
      catch { reject(new Error('The upload could not be completed. Please try again.')); }
    };
    xhr.send(body);
  });
}
