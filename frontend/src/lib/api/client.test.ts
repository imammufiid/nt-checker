import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  request,
  setAuthHooks,
  type AuthClientHooks,
} from './client';

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(
  status: number,
  body: unknown,
  init: Partial<ResponseInit> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function setFetchMock(mock: FetchMock) {
  // jsdom doesn't ship fetch by default; assign onto globalThis.
  (globalThis as unknown as { fetch: typeof fetch }).fetch =
    mock as unknown as typeof fetch;
}

describe('api/client', () => {
  beforeEach(() => {
    setAuthHooks(null);
  });

  afterEach(() => {
    setAuthHooks(null);
    vi.restoreAllMocks();
  });

  it('returns unwrapped data from a 2xx envelope', async () => {
    const fetchMock: FetchMock = vi.fn(async () =>
      jsonResponse(200, { success: true, data: { hello: 'world' } }),
    );
    setFetchMock(fetchMock);

    const data = await request<{ hello: string }>('/anything');
    expect(data).toEqual({ hello: 'world' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws ApiError when envelope is success:false', async () => {
    const fetchMock: FetchMock = vi.fn(async () =>
      jsonResponse(400, {
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Bad', details: { f: 1 } },
      }),
    );
    setFetchMock(fetchMock);

    await expect(request('/bad')).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      code: 'INVALID_INPUT',
      message: 'Bad',
    });
  });

  it('returns undefined on 204 No Content', async () => {
    const fetchMock: FetchMock = vi.fn(
      async () => new Response(null, { status: 204 }),
    );
    setFetchMock(fetchMock);

    const out = await request<void>('/empty', { method: 'DELETE' });
    expect(out).toBeUndefined();
  });

  it('on 401 TOKEN_EXPIRED, refreshes and retries once, returns retried data', async () => {
    const refresh = vi.fn(async () => true);
    const forceLogout = vi.fn();
    const hooks: AuthClientHooks = {
      getAccessToken: () => 'old-token',
      refresh,
      forceLogout,
    };
    setAuthHooks(hooks);

    const fetchMock: FetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(401, {
          success: false,
          error: { code: 'TOKEN_EXPIRED', message: 'expired' },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { success: true, data: { ok: 1 } }),
      );
    setFetchMock(fetchMock);

    const data = await request<{ ok: number }>('/protected');
    expect(data).toEqual({ ok: 1 });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(forceLogout).not.toHaveBeenCalled();
  });

  it('on 401 + refresh fails, calls forceLogout and throws UNAUTHORIZED', async () => {
    const refresh = vi.fn(async () => false);
    const forceLogout = vi.fn();
    setAuthHooks({
      getAccessToken: () => 'old',
      refresh,
      forceLogout,
    });

    const fetchMock: FetchMock = vi.fn(async () =>
      jsonResponse(401, {
        success: false,
        error: { code: 'TOKEN_EXPIRED', message: 'expired' },
      }),
    );
    setFetchMock(fetchMock);

    await expect(request('/protected')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      code: 'UNAUTHORIZED',
    });
    expect(forceLogout).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1); // never retried
  });

  it('on double-401 (retry also fails), forceLogout and throws — no infinite loop', async () => {
    const refresh = vi.fn(async () => true);
    const forceLogout = vi.fn();
    setAuthHooks({
      getAccessToken: () => 'old',
      refresh,
      forceLogout,
    });

    const fetchMock: FetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(401, {
          success: false,
          error: { code: 'TOKEN_EXPIRED', message: 'expired' },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(401, {
          success: false,
          error: { code: 'TOKEN_EXPIRED', message: 'still expired' },
        }),
      );
    setFetchMock(fetchMock);

    await expect(request('/protected')).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });
    expect(refresh).toHaveBeenCalledTimes(1); // only one refresh, not two
    expect(forceLogout).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('non-401 errors throw immediately without calling refresh', async () => {
    const refresh = vi.fn(async () => true);
    const forceLogout = vi.fn();
    setAuthHooks({
      getAccessToken: () => 'tok',
      refresh,
      forceLogout,
    });

    const fetchMock: FetchMock = vi.fn(async () =>
      jsonResponse(500, {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'boom' },
      }),
    );
    setFetchMock(fetchMock);

    await expect(request('/blow-up')).rejects.toBeInstanceOf(ApiError);
    expect(refresh).not.toHaveBeenCalled();
    expect(forceLogout).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends Authorization header when access token is available', async () => {
    setAuthHooks({
      getAccessToken: () => 'my-token',
      refresh: vi.fn(),
      forceLogout: vi.fn(),
    });
    const fetchMock: FetchMock = vi.fn(async () =>
      jsonResponse(200, { success: true, data: 'ok' }),
    );
    setFetchMock(fetchMock);

    await request('/me');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBe('Bearer my-token');
    expect(init.credentials).toBe('include');
  });

  it('skipAuth omits the Authorization header', async () => {
    setAuthHooks({
      getAccessToken: () => 'tok',
      refresh: vi.fn(),
      forceLogout: vi.fn(),
    });
    const fetchMock: FetchMock = vi.fn(async () =>
      jsonResponse(200, { success: true, data: 'ok' }),
    );
    setFetchMock(fetchMock);

    await request('/auth/login', {
      method: 'POST',
      body: { email: 'a', password: 'b' },
      skipAuth: true,
      skipRefresh: true,
    });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBeUndefined();
  });
});
