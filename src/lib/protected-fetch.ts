export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

type SessionHooks = {
  headers: (extra?: Record<string, string>) => Record<string, string>;
  authEnabled: boolean;
  refresh: () => Promise<boolean>;
  signOut: () => Promise<void>;
};

/** Fetch files and JSON through the same account boundary; retry expiration once. */
export async function fetchProtectedResource(
  url: string, options: RequestInit | undefined, session: SessionHooks,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetcher(url, {
      ...options, headers: session.headers(Object.fromEntries(new Headers(options?.headers).entries())),
    });
    if (response.status === 401 && session.authEnabled) {
      const body = await response.clone().json().catch(() => ({}));
      if (body.code === 'token_expired' && attempt === 0 && await session.refresh()) continue;
      await session.signOut();
      throw new ApiError('Please sign in to continue.', 401);
    }
    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try {
        const error = await response.json();
        message = typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail ?? error);
      } catch { /* Keep the status when a proxy returns a non-JSON error. */ }
      throw new ApiError(message, response.status);
    }
    return response;
  }
  throw new ApiError('Please sign in to continue.', 401);
}
