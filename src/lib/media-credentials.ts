/** Project-scoped credentials. Clearing invalidates in-flight mint requests too. */
export class MediaCredentials {
  private held = new Map<string, { token: string; expiresAt: number }>();
  private pending = new Map<string, Promise<string>>();
  private generation = 0;
  constructor(private mint: (id: string) => Promise<{token: string; expiresIn: number}>, private now = Date.now) {}
  token(id: string): string { const value = this.held.get(id); return value && value.expiresAt > this.now() ? value.token : ''; }
  ensure(id: string): Promise<string> {
    const value = this.held.get(id);
    if (value && value.expiresAt - this.now() > 15 * 60 * 1000) return Promise.resolve(value.token);
    const pending = this.pending.get(id); if (pending) return pending;
    const generation = this.generation;
    const promise = this.mint(id).then(result => {
      if (generation !== this.generation) return '';
      this.held.set(id, {token: result.token, expiresAt: this.now() + result.expiresIn * 1000});
      return result.token;
    }).finally(() => { if (this.pending.get(id) === promise) this.pending.delete(id); });
    this.pending.set(id, promise); return promise;
  }
  clear() { this.generation++; this.held.clear(); this.pending.clear(); }
}

export function assetMediaPath(projectId: string, assetId: string): string {
  return assetId === 'primary' ? `/api/projects/${projectId}/media` : `/api/projects/${projectId}/assets/${assetId}/file`;
}

/** Saved URLs may contain an old signature or deployment origin. Keep only the route. */
export function unsignedMediaPath(path: string): string {
  if (!path) return '';
  let url: URL;
  try { url = new URL(path, 'http://bol.local'); } catch { return ''; }
  if (!/^\/api\/projects\/[0-9a-fA-F-]{36}\//.test(url.pathname)) return '';
  for (const key of ['t', 'key', 'owner']) url.searchParams.delete(key);
  return url.pathname + url.search;
}

/** Replace cached DOM sources only when fresh authorization changes the URL. */
export function syncMediaSource(element: { getAttribute(name: string): string | null; src: string }, source: string): boolean {
  if (!source || element.getAttribute('src') === source) return false;
  element.src = source;
  return true;
}
