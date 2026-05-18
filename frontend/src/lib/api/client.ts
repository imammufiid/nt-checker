import type { ApiEnvelope } from '../types';

const API_BASE = '/api';

/**
 * ApiError carries the BE error envelope so component code can branch on
 * `error.code` (e.g. DUPLICATE_EMAIL) rather than the human message.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(opts: {
    status: number;
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }) {
    super(opts.message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
  }
}

/**
 * Auth provider hook injected from AuthProvider. The client calls back into
 * AuthProvider to (a) read the current access token, (b) request a single-flight
 * refresh on 401, and (c) hard-logout when refresh fails.
 */
export interface AuthClientHooks {
  getAccessToken(): string | null;
  refresh(): Promise<boolean>;
  forceLogout(): void;
}

let authHooks: AuthClientHooks | null = null;

/** AuthProvider calls this on mount to wire up the refresh interceptor. */
export function setAuthHooks(hooks: AuthClientHooks | null): void {
  authHooks = hooks;
}

interface RequestOptions {
  method?: string;
  body?: BodyInit | object | null;
  headers?: Record<string, string>;
  /** Skip the 401-refresh-retry dance — used internally for /auth/refresh. */
  skipRefresh?: boolean;
  /** Send no Authorization header — used for /auth/login, /auth/signup. */
  skipAuth?: boolean;
}

const REFRESH_ELIGIBLE_CODES = new Set(['TOKEN_EXPIRED', 'UNAUTHORIZED']);

async function buildFetchInit(
  opts: RequestOptions,
  isRetry: boolean,
): Promise<RequestInit> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };

  if (!opts.skipAuth && authHooks) {
    const token = authHooks.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let body: BodyInit | null | undefined = undefined;
  if (opts.body !== undefined && opts.body !== null) {
    if (
      opts.body instanceof FormData ||
      opts.body instanceof Blob ||
      opts.body instanceof URLSearchParams ||
      typeof opts.body === 'string'
    ) {
      body = opts.body as BodyInit;
    } else {
      body = JSON.stringify(opts.body);
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
    }
  }

  // Mark the retry so server-side or proxy logs can distinguish, harmless if ignored.
  if (isRetry) headers['X-Retry-After-Refresh'] = '1';

  return {
    method: opts.method ?? 'GET',
    headers,
    body,
    credentials: 'include',
  };
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;

  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    // Non-JSON or empty body — fall through.
  }

  if (!res.ok || (body && body.success === false)) {
    const err = body && body.success === false ? body.error : undefined;
    throw new ApiError({
      status: res.status,
      code: err?.code ?? 'UNKNOWN',
      message: err?.message ?? `Request failed (${res.status})`,
      details: err?.details,
    });
  }

  if (body && body.success === true) return body.data;
  // Defensive: response was 2xx but didn't follow the envelope; return raw.
  return body as unknown as T;
}

/**
 * Low-level request: handles auth header injection, 401 → refresh → retry-once
 * dance, and unwraps the standard envelope.
 */
export async function request<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  const init = await buildFetchInit(opts, false);
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: e instanceof Error ? e.message : 'Network error',
    });
  }

  // Try to refresh on 401 with eligible code, retry once, then give up.
  if (res.status === 401 && !opts.skipRefresh && authHooks) {
    let code = 'UNAUTHORIZED';
    let cloned: Response;
    try {
      cloned = res.clone();
      const body = (await cloned.json()) as ApiEnvelope<T>;
      if (body && body.success === false) code = body.error.code;
    } catch {
      // No JSON body — assume UNAUTHORIZED.
    }

    if (REFRESH_ELIGIBLE_CODES.has(code)) {
      const ok = await authHooks.refresh();
      if (!ok) {
        authHooks.forceLogout();
        throw new ApiError({
          status: 401,
          code: 'UNAUTHORIZED',
          message: 'Session expired',
        });
      }
      const retryInit = await buildFetchInit(opts, true);
      try {
        res = await fetch(url, retryInit);
      } catch (e) {
        throw new ApiError({
          status: 0,
          code: 'NETWORK_ERROR',
          message: e instanceof Error ? e.message : 'Network error',
        });
      }
      if (res.status === 401) {
        authHooks.forceLogout();
        throw new ApiError({
          status: 401,
          code: 'UNAUTHORIZED',
          message: 'Session expired',
        });
      }
    }
  }

  return parseResponse<T>(res);
}
